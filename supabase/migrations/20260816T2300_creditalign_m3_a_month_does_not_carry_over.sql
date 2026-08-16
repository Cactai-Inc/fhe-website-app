-- TASK CREDITALIGN m3 — the month boundary is enforced wherever a credit is spent,
-- counted or shown, and the refund seam stops laundering an expiry away.
--
-- Owner (BOOKLINK §B4, restated by this task): a month's allotment expires at month
-- end and does not carry over. m1 gave `lesson_credits` an `expires_at`; an expiry
-- nothing reads is a comment, so every site that spends or counts is amended here.
-- `expires_at IS NULL` means "never expires" and covers every existing row and every
-- session pack, so pack behaviour is bit-for-bit unchanged.
--
-- FIVE SITES, and they are all of them (verified: `select proname from pg_proc where
-- prosrc ilike '%lesson_credits%'` returns ten functions — the other five are
-- purge_account, redeem_gift, admin_client_accounts, _provision_purchase_for_offerings
-- and decide_booking_change, none of which picks a credit to spend).
--
-- TRAP OBSERVED: book_open_slot is re-declared here with its ONE live signature
-- (p_booking_id, p_horse_id, p_credit_id) — checked against pg_proc first, which shows
-- a single overload. A thread re-applied REVIEWQ's m2 on 2026-08-15 and resurrected a
-- second overload; PostgREST resolves by argument name, so a stray second signature
-- lets the credit picker silently spend the wrong item.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE REFUND SEAM — one seam, and it now returns the entitlement to where it
--    came from instead of minting a fresh, never-expiring one
-- ════════════════════════════════════════════════════════════════════════════
-- The shipped body ALWAYS inserted a new 1-credit row. With monthly allotments that is
-- a laundering machine: refund a September allotment credit and you get back a credit
-- that never expires and belongs to no period. It is also uncapped — call it twice for
-- one booking and the client is a credit up.
--
-- New shape, in strict order of preference:
--   (a) the source row is still live  → put the credit back on it (never above its own
--       credits_total, so a double refund cannot invent one), keeping period and expiry;
--   (b) the source row is gone (soft-deleted) → a compensating row that INHERITS the
--       service, the order, the period and the expiry.
-- Returns false when there was nothing outstanding to give back. Still the only refund
-- in the system: decide_booking_change, withdraw_my_pending_booking and (new)
-- swap_booking_item all call this and nothing else.
CREATE OR REPLACE FUNCTION public._refund_booking_credit(p_booking bookings)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_src lesson_credits%ROWTYPE;
BEGIN
  IF p_booking.credit_id IS NULL OR p_booking.client_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_src FROM lesson_credits WHERE id = p_booking.credit_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_src.deleted_at IS NULL THEN
    -- (a) still live. Only give back what was actually taken.
    IF v_src.credits_remaining < v_src.credits_total THEN
      UPDATE lesson_credits
         SET credits_remaining = credits_remaining + 1
       WHERE id = v_src.id;
      RETURN true;
    END IF;
    -- already whole — nothing was outstanding against it.
    RETURN false;
  END IF;

  -- (b) the source is gone. Compensate, carrying its meaning forward: the same
  -- service, the same order, the same month, the same expiry. purchase_item_id is
  -- deliberately left NULL so this row can never collide with, or masquerade as, the
  -- allotment for that line and period.
  INSERT INTO lesson_credits (org_id, client_id, package_key, credits_total, credits_remaining,
      purchased_at, offering_id, purchase_id, period_start, expires_at)
    VALUES (p_booking.org_id, p_booking.client_id, 'change_credit', 1, 1, now(),
            v_src.offering_id, v_src.purchase_id, v_src.period_start, v_src.expires_at);
  RETURN true;
END;
$function$;

COMMENT ON FUNCTION public._refund_booking_credit(bookings) IS
  'CREDITALIGN: THE one refund seam. Restores the source credit in place when it is '
  'still live (capped at its own credits_total, so a double refund cannot mint), else '
  'compensates with a row inheriting offering/purchase/period/expiry. A monthly '
  'allotment refunded in September stays a September credit.';

-- ════════════════════════════════════════════════════════════════════════════
-- 2. book_open_slot — an expired allotment is not spendable, by either branch
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.book_open_slot(p_booking_id uuid, p_horse_id uuid DEFAULT NULL::uuid, p_credit_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
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
  -- CREDITALIGN: "gone" now also means "last month's" — an allotment past its
  -- expires_at is not spendable, because the month does not carry over.
  IF p_credit_id IS NOT NULL THEN
    UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
     WHERE id = (SELECT lc.id FROM lesson_credits lc
                  WHERE lc.id = p_credit_id
                    AND lc.client_id = v_client
                    AND lc.deleted_at IS NULL
                    AND lc.credits_remaining > 0
                    AND (lc.expires_at IS NULL OR lc.expires_at > now())
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
                 AND (expires_at IS NULL OR expires_at > now())
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
               -- CREDITALIGN: spend the thing that expires first. Without this an
               -- expiring monthly allotment sits unused behind a never-expiring pack
               -- and is silently lost at month end.
               ORDER BY (offering_id = v_offering) DESC NULLS LAST,
                        expires_at ASC NULLS LAST,
                        purchased_at, created_at
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

-- ════════════════════════════════════════════════════════════════════════════
-- 3. _debit_or_create_for_booking — the staff/calendar side of the same debit
-- ════════════════════════════════════════════════════════════════════════════
-- Two changes only: expired credits are not spendable, and the recurring branch no
-- longer says "never a credit debit". A recurring purchase now HAS an allotment, so a
-- calendar booking against a monthly plan spends it like anything else, and falls back
-- to the plan's purchase only when the allotment is exhausted.
CREATE OR REPLACE FUNCTION public._debit_or_create_for_booking(p_client_id uuid, p_offering_id uuid, p_purchase_id uuid, p_payment_method text DEFAULT NULL::text, p_mark_paid boolean DEFAULT false)
 RETURNS TABLE(purchase_id uuid, credit_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client   clients%ROWTYPE;
  v_kind     text;
  v_credit   uuid;
  v_cr_pur   uuid;
  v_purchase uuid;
BEGIN
  IF p_offering_id IS NULL THEN
    RETURN QUERY SELECT p_purchase_id, NULL::uuid; RETURN;
  END IF;

  SELECT * INTO v_client FROM clients WHERE id = p_client_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN QUERY SELECT p_purchase_id, NULL::uuid; RETURN;
  END IF;

  SELECT config_kind INTO v_kind FROM offerings WHERE id = p_offering_id;

  -- ── 1. an open, unexpired credit for this offering, optionally scoped to a
  --      staff-chosen purchase (mirrors book_open_slot's own preference) ──
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = (
     SELECT lc.id FROM lesson_credits lc
      WHERE lc.client_id = p_client_id AND lc.deleted_at IS NULL AND lc.credits_remaining > 0
        AND (lc.expires_at IS NULL OR lc.expires_at > now())
        AND (p_purchase_id IS NULL OR lc.purchase_id = p_purchase_id)
        AND (lc.offering_id = p_offering_id OR lc.offering_id IS NULL)
      ORDER BY (lc.offering_id = p_offering_id) DESC NULLS LAST,
               lc.expires_at ASC NULLS LAST, lc.purchased_at, lc.created_at
      LIMIT 1 FOR UPDATE
   )
   RETURNING lesson_credits.id, lesson_credits.purchase_id INTO v_credit, v_cr_pur;
  IF v_credit IS NOT NULL THEN
    RETURN QUERY SELECT v_cr_pur, v_credit; RETURN;
  END IF;

  -- ── 2. a monthly plan whose allotment is spent (or not yet minted): the
  --      purchase is still the assignment, so name it and stop. Creating a
  --      SECOND recurring purchase because this month ran out would bill the
  --      client twice for one month. ──
  IF v_kind = 'recurring' THEN
    SELECT pu.id INTO v_purchase
      FROM purchases pu
      JOIN purchase_items pi ON pi.purchase_id = pu.id AND pi.offering_id = p_offering_id
     WHERE pu.buyer_contact_id = v_client.contact_id AND pu.deleted_at IS NULL
     ORDER BY pu.created_at DESC LIMIT 1;
    IF v_purchase IS NULL THEN
      v_purchase := _provision_purchase_for_offerings(
        v_client.org_id, v_client.contact_id, p_client_id, ARRAY[p_offering_id],
        coalesce(p_mark_paid, false), p_payment_method, 'Monthly plan assigned from calendar');
      -- the mint seam just created this month's allotment for that plan; this
      -- booking consumes one of it.
      UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
       WHERE id = (SELECT lc.id FROM lesson_credits lc
                    WHERE lc.purchase_id = v_purchase AND lc.offering_id = p_offering_id
                      AND lc.deleted_at IS NULL AND lc.credits_remaining > 0
                    LIMIT 1 FOR UPDATE)
       RETURNING lesson_credits.id INTO v_credit;
    END IF;
    RETURN QUERY SELECT v_purchase, v_credit; RETURN;
  END IF;

  -- ── 3. staff explicitly named a purchase and there was nothing on it to
  --      debit — respect their choice; the booking trigger still claims a
  --      fulfillment unit on it if one is open ──
  IF p_purchase_id IS NOT NULL THEN
    RETURN QUERY SELECT p_purchase_id, NULL::uuid; RETURN;
  END IF;

  -- ── 4. an existing purchase with an open unit for this offering but no
  --      credit row ──
  SELECT pu.id INTO v_purchase
    FROM purchases pu
    JOIN purchase_items pi ON pi.purchase_id = pu.id AND pi.offering_id = p_offering_id
    JOIN fulfillment_units u ON u.purchase_item_id = pi.id
   WHERE pu.buyer_contact_id = v_client.contact_id AND pu.deleted_at IS NULL
     AND u.deleted_at IS NULL AND u.current_status = 'open' AND u.unit_kind IN ('session','period')
   ORDER BY pu.created_at LIMIT 1;
  IF v_purchase IS NOT NULL THEN
    RETURN QUERY SELECT v_purchase, NULL::uuid; RETURN;
  END IF;

  -- ── 5. nothing to debit anywhere — create the order, through the spine ──
  v_purchase := _provision_purchase_for_offerings(
    v_client.org_id, v_client.contact_id, p_client_id, ARRAY[p_offering_id],
    coalesce(p_mark_paid, false), p_payment_method, 'Booked from calendar');

  -- that mint just created the credit row for this offering; this booking
  -- consumes it right now.
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = (SELECT lc.id FROM lesson_credits lc
                WHERE lc.purchase_id = v_purchase AND lc.offering_id = p_offering_id
                  AND lc.deleted_at IS NULL AND lc.credits_remaining > 0
                LIMIT 1 FOR UPDATE)
   RETURNING lesson_credits.id INTO v_credit;

  RETURN QUERY SELECT v_purchase, v_credit;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. complete_lesson_session — completing a lesson may not spend last month
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.complete_lesson_session(p_session_id uuid, p_debit_credit boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_b         bookings%ROWTYPE;
  v_credit    uuid;
  v_remaining integer;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to complete lessons';
  END IF;

  SELECT * INTO v_b FROM bookings
    WHERE id = p_session_id AND kind = 'lesson'
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown lesson session: %', p_session_id;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' AND v_b.org_id IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'lesson session % is not in your organization', p_session_id;
  END IF;
  IF v_b.status <> 'scheduled' THEN
    RAISE EXCEPTION 'only a SCHEDULED lesson can be completed (this one is %)', upper(v_b.status);
  END IF;

  UPDATE bookings SET status = 'completed' WHERE id = p_session_id;

  -- CREDITALIGN: a booking that already named its item keeps it. The shipped body
  -- always debited "the oldest row with a balance", which after a swap (or after
  -- book_open_slot honoured an explicit p_credit_id) could take the debit off a
  -- different purchase than the one the booking is charged against.
  IF p_debit_credit AND v_b.credit_id IS NOT NULL THEN
    v_credit := v_b.credit_id;
  ELSIF p_debit_credit THEN
    -- atomically decrement the OLDEST live, UNEXPIRED credit row with balance
    -- (row-locked SELECT ... FOR UPDATE — two concurrent completes can never
    -- double-spend), preferring the one that expires soonest.
    UPDATE lesson_credits lc
       SET credits_remaining = lc.credits_remaining - 1
     WHERE lc.id = (
        SELECT id FROM lesson_credits
        WHERE client_id = v_b.client_id AND org_id = v_b.org_id
          AND deleted_at IS NULL AND credits_remaining > 0
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY expires_at ASC NULLS LAST, purchased_at, created_at
        LIMIT 1
        FOR UPDATE
      )
     RETURNING lc.id INTO v_credit;

    IF v_credit IS NOT NULL THEN
      UPDATE bookings SET credit_id = v_credit WHERE id = p_session_id;
    END IF;
  END IF;

  IF p_debit_credit THEN
    SELECT coalesce(sum(credits_remaining), 0)::int INTO v_remaining
      FROM lesson_credits
      WHERE client_id = v_b.client_id AND org_id = v_b.org_id AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > now());
  END IF;

  RETURN jsonb_build_object(
    'session_id',        p_session_id,
    'status',            'COMPLETED',
    'debited',           v_credit IS NOT NULL,
    'credit_id',         v_credit,
    'credits_remaining', v_remaining
  );
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. credits_roster — the staff "who has credits" list counts spendable ones
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.credits_roster()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_org uuid := current_org();
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
        'client_id', cl.id,
        'name', trim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')),
        'credits_remaining', r.rem) ORDER BY r.rem DESC), '[]'::jsonb)
    FROM (
      SELECT client_id, sum(credits_remaining)::int AS rem
      FROM lesson_credits
      WHERE org_id = v_org AND deleted_at IS NULL
        AND (expires_at IS NULL OR expires_at > now())
      GROUP BY client_id
      HAVING sum(credits_remaining) > 0
    ) r
    JOIN clients cl ON cl.id = r.client_id
    JOIN contacts c ON c.id = cl.contact_id);
END;
$function$;
