-- TASK ONBOARD §7 — the client half of booking: what you're booking against, editing
-- while it is still a request, the 48-hour boundary, and a fee schedule that is DATA.
--
-- Owner: "they then go to the booking calendar where they see the available credits for
-- the items they purchased and they see the open slots and they can click on a slot, then
-- select what they are requesting that slot for from the items they purchased and then
-- submit to us for confirmation and until that is confirmed by us it stays pending and
-- its fully editable by the user until its confirmed, once its confirmed its editable up
-- to 48hrs prior to the booking and the same process plays out if they want to make a
-- change within the 48hrs we have a fee schedule and the booking doesnt submit to us
-- until they confirm they made the payment with zelle or say they will pay cash."
--
-- WHAT WAS ALREADY THERE (verified, not rebuilt): `pending` is where a claimed slot
-- lands (REVIEWQ R1, live), booking_change_requests / request_booking_change /
-- decide_booking_change carry the change flow, and reschedule_fee() already owns the
-- 48-hour boundary. This adds the four things that were missing.
--
-- ⚠️ NO FEE AMOUNTS ARE INVENTED HERE. The owner is supplying the tiered schedule. This
-- migration ships the MECHANISM and seeds ZERO rows, so today's behaviour is bit-for-bit
-- what it is now (the flat calendar_settings.reschedule_fee, currently 0.00). Where the
-- owner's numbers plug in is spelled out at the table below and in the report: it is a
-- data change through the calendar settings panel, not a migration (D13).

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE FEE SCHEDULE, AS DATA
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS booking_change_fees (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  /** The band: a change made with FEWER than this many hours before the booking
   *  starts costs fee_amount. Bands overlap on purpose — the tightest one that
   *  still applies wins, which is what makes "48h → $25, 24h → $50, 4h → $100"
   *  behave the way a person reading it expects. */
  hours_before integer NOT NULL CHECK (hours_before > 0),
  fee_amount   numeric NOT NULL CHECK (fee_amount >= 0),
  /** What the client is told, e.g. "Inside 24 hours". Optional. */
  label        text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, hours_before)
);

COMMENT ON TABLE booking_change_fees IS
  'ONBOARD §7: THE TIERED CHANGE-FEE SCHEDULE, and the place the owner''s numbers go. '
  'One row per band: hours_before + fee_amount (+ a label the client sees). Empty by '
  'design — with no rows, reschedule_fee() falls back to the incumbent flat '
  'calendar_settings.reschedule_fee, so behaviour is unchanged until the owner enters '
  'the schedule. Edited from the calendar settings panel via '
  'set_booking_change_fee_schedule(); adding a tier is never a migration (D13).';

ALTER TABLE booking_change_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS booking_change_fees_read ON booking_change_fees;
-- Members must be able to read their own tenant's schedule: they are quoted a fee
-- before they commit to a change, and a price you cannot see is not a price.
CREATE POLICY booking_change_fees_read ON booking_change_fees
  FOR SELECT USING (org_id = current_org());

-- reschedule_fee keeps its signature and its meaning; only the source of the number
-- changes. The 48-hour boundary is NOT reimplemented — it survives as the fallback,
-- and becomes just another band once the owner enters one.
CREATE OR REPLACE FUNCTION public.reschedule_fee(p_org uuid, p_start timestamp with time zone)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    -- the tightest band that still applies (smallest hours_before that the
    -- remaining time is inside) — i.e. the latest change costs the most
    (SELECT f.fee_amount
       FROM booking_change_fees f
      WHERE f.org_id = p_org AND f.active
        AND p_start - now() < make_interval(hours => f.hours_before)
      ORDER BY f.hours_before ASC
      LIMIT 1),
    -- no schedule entered yet: exactly the behaviour that shipped before
    CASE WHEN p_start - now() < interval '48 hours'
         THEN coalesce((SELECT cs.reschedule_fee FROM calendar_settings cs WHERE cs.org_id = p_org), 0)
         ELSE 0 END)
$function$;

/** The whole schedule, for the client's "what will this cost me" panel and for the
 *  settings editor. Readable by any member of the org — it is a price list. */
CREATE OR REPLACE FUNCTION public.booking_change_fee_schedule()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', f.id, 'hours_before', f.hours_before,
           'fee_amount', f.fee_amount, 'label', f.label, 'active', f.active)
         ORDER BY f.hours_before DESC), '[]'::jsonb)
    FROM booking_change_fees f
   WHERE f.org_id = current_org()
$function$;

/** Replace the whole schedule in one call — the shape an editable table wants.
 *  Staff only. p_rows: [{hours_before, fee_amount, label}] */
CREATE OR REPLACE FUNCTION public.set_booking_change_fee_schedule(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid := current_org();
  v_n   integer := 0;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  IF v_org IS NULL THEN RAISE EXCEPTION 'no organization in scope'; END IF;

  DELETE FROM booking_change_fees WHERE org_id = v_org;

  INSERT INTO booking_change_fees (org_id, hours_before, fee_amount, label, active)
  SELECT v_org,
         (r->>'hours_before')::int,
         (r->>'fee_amount')::numeric,
         nullif(btrim(coalesce(r->>'label', '')), ''),
         coalesce((r->>'active')::boolean, true)
    FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
   WHERE coalesce(nullif(r->>'hours_before',''), '') <> ''
     AND coalesce(nullif(r->>'fee_amount',''), '') <> '';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. BOOK A SLOT AGAINST A CHOSEN PURCHASED ITEM
-- ════════════════════════════════════════════════════════════════════════════
-- FLOWTRACE §9: the offering parameter exists end to end and no client surface ever
-- passed it, so the credit debited was whatever sorted first. The member now names
-- the item, and the named credit is the one that gets debited. A drop-and-recreate
-- because a new parameter would otherwise create an overload PostgREST cannot
-- disambiguate; grants are restored below, anon revoked by name (this database's
-- default privileges hand EXECUTE on new functions to anon, and REVOKE … FROM PUBLIC
-- does not remove that direct grant).
DROP FUNCTION IF EXISTS public.book_open_slot(uuid, uuid);

CREATE OR REPLACE FUNCTION public.book_open_slot(
  p_booking_id uuid,
  p_horse_id   uuid DEFAULT NULL::uuid,
  p_credit_id  uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client  uuid := current_client_id();
  v_contact uuid := current_contact_id();
  v_b       bookings%ROWTYPE;
  v_kind    text;
  v_offering uuid;
  v_credit  uuid;
  v_gate    jsonb;
  v_cr_off  uuid;
  v_cr_pur  uuid;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no member profile'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR NOT v_b.is_flexible OR v_b.status <> 'available' THEN
    RAISE EXCEPTION 'that time is no longer open';
  END IF;

  SELECT CASE WHEN o.segment = 'horse' THEN 'care' ELSE 'lesson' END, o.id
    INTO v_kind, v_offering
    FROM offerings o WHERE o.id = v_b.offering_id;
  v_kind := coalesce(v_kind, 'lesson');

  IF v_kind = 'care' THEN
    IF p_horse_id IS NULL THEN RAISE EXCEPTION 'a horse is required for a care booking'; END IF;
    v_gate := assert_horse_care_eligible(v_contact, p_horse_id);
    IF NOT (v_gate->>'eligible')::boolean THEN
      RAISE EXCEPTION 'HORSE_CARE_DOCS_REQUIRED: %', v_gate->>'missing'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- lesson branch: an explicit horse must be one the caller may use (owner or
  -- active lease); NULL stays allowed (barn-supplied horse). No care-docs gate
  -- here — that's care-specific.
  IF v_kind = 'lesson' AND p_horse_id IS NOT NULL THEN
    IF NOT caller_may_use_horse(v_contact, p_horse_id) THEN
      RAISE EXCEPTION 'that horse is not yours';
    END IF;
  END IF;

  -- ── ONBOARD §7: the member NAMED which purchased item this is against ──
  -- Their choice is honoured exactly: this credit or nothing. Falling back to
  -- "some other credit" would silently spend the wrong thing, which is worse
  -- than telling them the one they picked is gone.
  IF p_credit_id IS NOT NULL THEN
    UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
     WHERE id = (SELECT lc.id FROM lesson_credits lc
                  WHERE lc.id = p_credit_id
                    AND lc.client_id = v_client
                    AND lc.deleted_at IS NULL
                    AND lc.credits_remaining > 0
                  FOR UPDATE)
     RETURNING id INTO v_credit;
    IF v_credit IS NULL THEN RAISE EXCEPTION 'NO_CREDITS'; END IF;
  ELSE
  -- credit-gated: both lessons and care debit one service credit, preferring a
  -- credit tagged with this offering, falling back to any untagged balance.
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = (SELECT id FROM lesson_credits
               WHERE client_id = v_client AND org_id = v_b.org_id
                 AND deleted_at IS NULL AND credits_remaining > 0
                 AND (
                   -- offering-tagged slot: that offering's credits, or untagged
                   (v_offering IS NOT NULL AND (offering_id = v_offering OR offering_id IS NULL))
                   -- GENERIC slot (published from business hours, no offering):
                   -- any untagged credit, or any credit whose offering is not a
                   -- horse-care SKU — the slot is generic time; the credit says
                   -- what was bought. Without this, every real purchase (always
                   -- offering-tagged) was rejected by generic open slots.
                   OR (v_offering IS NULL AND (offering_id IS NULL OR EXISTS (
                        SELECT 1 FROM offerings oc WHERE oc.id = offering_id AND oc.segment <> 'horse')))
                 )
               ORDER BY (offering_id = v_offering) DESC NULLS LAST, purchased_at, created_at
               LIMIT 1 FOR UPDATE)
   RETURNING id INTO v_credit;
  IF v_credit IS NULL THEN RAISE EXCEPTION 'NO_CREDITS'; END IF;
  END IF;

  -- BOOKWRITE: what the debited credit knows — the service and the order.
  SELECT lc.offering_id, lc.purchase_id INTO v_cr_off, v_cr_pur
    FROM lesson_credits lc WHERE lc.id = v_credit;

  -- REVIEWQ R1: claiming an open slot is a REQUEST, not a confirmation —
  -- status lands 'pending' (was 'scheduled' — FLOWTRACE item 10).
  UPDATE bookings SET
    kind = v_kind, status = 'pending', is_flexible = false,
    client_id = v_client,
    account_user_id = auth.uid(),
    account_contact_id = v_contact,
    offering_id = coalesce(offering_id, v_cr_off),
    purchase_id = coalesce(purchase_id, v_cr_pur),
    horse_id = coalesce(p_horse_id, horse_id),
    credit_id = v_credit,
    updated_at = now()
  WHERE id = p_booking_id;

  -- REVIEWQ R2: the companion request row the staff queue (open_change_
  -- requests / decide_booking_change) reads.
  INSERT INTO booking_change_requests (
    org_id, booking_id, requested_by, request_kind,
    proposed_starts_at, proposed_ends_at, status)
  VALUES (v_b.org_id, p_booking_id, auth.uid(), 'new', v_b.starts_at, v_b.ends_at, 'pending');

  PERFORM notify_staff(v_b.org_id, 'booking_time_requested',
    'A client claimed ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'pending', 'kind', v_kind);
END;
$function$;

REVOKE ALL ON FUNCTION public.book_open_slot(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_open_slot(uuid, uuid, uuid) TO authenticated, service_role, postgres;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. WHILE IT IS STILL A REQUEST, THE CLIENT JUST EDITS IT
-- ════════════════════════════════════════════════════════════════════════════
-- "until that is confirmed by us it stays pending and its fully editable by the user
-- until its confirmed." Nothing has been agreed yet, so a pending change is not a
-- request to change anything — there is no counterparty commitment to renegotiate.
-- It moves the booking and its companion 'new' row directly, with no fee and no
-- second approval step. Confirmed bookings keep going through request_booking_change.
CREATE OR REPLACE FUNCTION public.update_my_pending_booking(
  p_booking_id uuid,
  p_new_start  timestamptz,
  p_new_end    timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid := current_client_id();
  v_b      bookings%ROWTYPE;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no member profile'; END IF;
  IF p_new_start IS NULL OR p_new_end IS NULL THEN RAISE EXCEPTION 'a new time is required'; END IF;
  IF p_new_end <= p_new_start THEN RAISE EXCEPTION 'the end must be after the start'; END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_b.client_id IS DISTINCT FROM v_client THEN
    RAISE EXCEPTION 'not your booking';
  END IF;
  IF v_b.status <> 'pending' THEN
    RAISE EXCEPTION 'NOT_PENDING: this booking is confirmed — use a change request';
  END IF;

  UPDATE bookings
     SET starts_at = p_new_start, ends_at = p_new_end,
         reminder_1h_sent_at = NULL, reminder_2h_sent_at = NULL,
         updated_at = now()
   WHERE id = p_booking_id;

  -- the companion open row follows it, so the staff queue shows the time the
  -- client actually wants rather than the one they first picked
  UPDATE booking_change_requests
     SET proposed_starts_at = p_new_start, proposed_ends_at = p_new_end
   WHERE booking_id = p_booking_id AND status = 'pending' AND NOT coalesce(awaiting_client, false);

  PERFORM notify_staff(v_b.org_id, 'booking_time_requested',
    'A client changed their requested time to ' || to_char(p_new_start, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'pending',
                            'starts_at', p_new_start, 'ends_at', p_new_end);
END;
$function$;

/** Withdraw a request that was never confirmed. The credit comes straight back —
 *  nothing was ever agreed, so nothing is forfeited. */
CREATE OR REPLACE FUNCTION public.withdraw_my_pending_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid := current_client_id();
  v_b      bookings%ROWTYPE;
  v_refund boolean := false;
BEGIN
  IF v_client IS NULL THEN RAISE EXCEPTION 'no member profile'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_b.client_id IS DISTINCT FROM v_client THEN
    RAISE EXCEPTION 'not your booking';
  END IF;
  IF v_b.status <> 'pending' THEN
    RAISE EXCEPTION 'NOT_PENDING: this booking is confirmed — use a change request';
  END IF;

  IF v_b.credit_id IS NOT NULL THEN v_refund := _refund_booking_credit(v_b); END IF;
  UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = p_booking_id;
  UPDATE booking_change_requests
     SET status = 'withdrawn', decided_by = auth.uid(), decided_at = now()
   WHERE booking_id = p_booking_id AND status = 'pending';

  PERFORM notify_staff(v_b.org_id, 'booking_withdrawn',
    'A client withdrew their request for ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM'),
    '/app/calendar');

  RETURN jsonb_build_object('booking_id', p_booking_id, 'status', 'cancelled',
                            'credit_refunded', v_refund);
END;
$function$;

REVOKE ALL ON FUNCTION public.update_my_pending_booking(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_my_pending_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_pending_booking(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.withdraw_my_pending_booking(uuid) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. INSIDE THE WINDOW, THE CHANGE DOES NOT SUBMIT UNTIL THE FEE IS SETTLED
-- ════════════════════════════════════════════════════════════════════════════
-- "the booking doesnt submit to us until they confirm they made the payment with zelle
-- or say they will pay cash." The gate is server-side: without a fee acknowledgement,
-- request_booking_change REFUSES rather than creating a row someone has to chase. The
-- acknowledgement is recorded in the same shape as an order's — a claim, with an
-- optional confirmation number — and fee_paid still only moves via mark_change_fee_paid
-- (staff). Saying you paid is not paying.
ALTER TABLE booking_change_requests ADD COLUMN IF NOT EXISTS fee_reported_method    text;
ALTER TABLE booking_change_requests ADD COLUMN IF NOT EXISTS fee_reported_reference text;
ALTER TABLE booking_change_requests ADD COLUMN IF NOT EXISTS fee_reported_at        timestamptz;

COMMENT ON COLUMN booking_change_requests.fee_reported_method IS
  'ONBOARD §7: ''zelle'' or ''cash'' — what the CLIENT said they did about the change '
  'fee, captured before the request was allowed to submit. A claim; fee_paid is still '
  'only ever set by staff through mark_change_fee_paid.';

DROP FUNCTION IF EXISTS public.request_booking_change(uuid, text, timestamptz, timestamptz, text, text);

CREATE OR REPLACE FUNCTION public.request_booking_change(
  p_booking_id uuid,
  p_kind text,
  p_new_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_new_end timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_scope text DEFAULT 'one'::text,
  p_note text DEFAULT NULL::text,
  p_fee_method text DEFAULT NULL::text,
  p_fee_reference text DEFAULT NULL::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid := current_client_id();
  v_b      bookings%ROWTYPE;
  v_fee    numeric;
  v_phone  boolean;
  v_id     uuid;
  v_recurring boolean;
  v_method text := nullif(lower(btrim(coalesce(p_fee_method, ''))), '');
  v_ref    text := nullif(btrim(coalesce(p_fee_reference, '')), '');
BEGIN
  IF p_kind NOT IN ('reschedule','cancel','defer') THEN RAISE EXCEPTION 'bad change kind'; END IF;
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  IF NOT coalesce(has_staff_access() OR (v_client IS NOT NULL AND v_b.client_id = v_client), false) THEN
    RAISE EXCEPTION 'not your booking';
  END IF;
  IF p_kind = 'reschedule' AND (p_new_start IS NULL OR p_new_end IS NULL) THEN
    RAISE EXCEPTION 'a reschedule needs a new time';
  END IF;

  -- BOOKLINK B4: monthly lessons don't carry over — a reschedule request
  -- that would push the lesson into a different calendar month is refused.
  IF p_kind = 'reschedule' AND v_b.purchase_id IS NOT NULL THEN
    SELECT true INTO v_recurring
      FROM purchase_items pi JOIN offerings o ON o.id = pi.offering_id
     WHERE pi.purchase_id = v_b.purchase_id AND o.config_kind = 'recurring' LIMIT 1;
    IF coalesce(v_recurring, false)
       AND date_trunc('month', p_new_start) <> date_trunc('month', v_b.starts_at) THEN
      RAISE EXCEPTION 'monthly lessons must be used within the same month — no carryover to next month';
    END IF;
  END IF;

  v_fee   := CASE WHEN p_kind = 'reschedule' THEN reschedule_fee(v_b.org_id, v_b.starts_at) ELSE 0 END;
  v_phone := v_b.starts_at - now() < interval '24 hours';

  -- ONBOARD §7 — the fee gate. A chargeable change is not accepted until the
  -- client has said how they are settling it. Staff are exempt: they are acting
  -- on the client's behalf and can waive at decision time.
  IF coalesce(v_fee, 0) > 0 AND NOT has_staff_access() THEN
    IF v_method IS NULL OR v_method NOT IN ('zelle','cash') THEN
      RAISE EXCEPTION 'FEE_CONFIRMATION_REQUIRED: a % fee applies to this change', v_fee
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  INSERT INTO booking_change_requests (
    org_id, booking_id, requested_by, request_kind,
    proposed_starts_at, proposed_ends_at, scope, status,
    fee_amount, phone_required, note,
    fee_reported_method, fee_reported_reference, fee_reported_at)
  VALUES (
    v_b.org_id, p_booking_id, auth.uid(), p_kind,
    p_new_start, p_new_end, p_scope, 'pending',
    NULLIF(v_fee,0), v_phone, p_note,
    CASE WHEN coalesce(v_fee,0) > 0 THEN v_method END,
    CASE WHEN coalesce(v_fee,0) > 0 THEN v_ref END,
    CASE WHEN coalesce(v_fee,0) > 0 AND v_method IS NOT NULL THEN now() END)
  RETURNING id INTO v_id;

  UPDATE bookings SET status = 'pending', updated_at = now()
   WHERE id = p_booking_id AND status IN ('scheduled','confirmed');

  -- staff get an in-app heads-up (email rides the sweep)
  PERFORM notify_staff(v_b.org_id, 'booking_change_requested',
    initcap(p_kind) || ' requested — ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM')
      || CASE WHEN coalesce(v_fee,0) > 0
              THEN ' · ' || fmt_money(v_fee) || ' fee — client says '
                   || CASE WHEN v_method = 'cash' THEN 'they will pay cash'
                           ELSE 'they sent it by Zelle' || coalesce(' (ref ' || v_ref || ')', '') END
                   || ', not yet confirmed'
              ELSE '' END,
    '/app/calendar');

  RETURN jsonb_build_object(
    'change_id', v_id, 'fee_amount', NULLIF(v_fee,0), 'phone_required', v_phone,
    'kind', p_kind, 'fee_method', CASE WHEN coalesce(v_fee,0) > 0 THEN v_method END);
END;
$function$;

REVOKE ALL ON FUNCTION public.request_booking_change(uuid, text, timestamptz, timestamptz, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_booking_change(uuid, text, timestamptz, timestamptz, text, text, text, text) TO authenticated, service_role, postgres;

REVOKE ALL ON FUNCTION public.set_booking_change_fee_schedule(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_booking_change_fee_schedule(jsonb) TO authenticated, service_role;
-- The read is harmless to anon (current_org() is NULL for it, so it returns []),
-- but the standing posture after SECFIX/PARTYSTAGING is that a new RPC is not
-- anon-callable unless it has a reason to be, and this one does not.
REVOKE ALL ON FUNCTION public.booking_change_fee_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_change_fee_schedule() TO authenticated, service_role;
