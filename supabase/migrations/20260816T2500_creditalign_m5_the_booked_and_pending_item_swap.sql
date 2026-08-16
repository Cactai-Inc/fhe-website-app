-- TASK CREDITALIGN m5 — "make the booked and pending-booking item swap." (owner)
--
-- Changing WHICH purchased item a booking is charged against moves money, which is
-- exactly why ONBOARD stopped at "book against a chosen item" and did not build this.
-- It is a refund AND a debit, and it is only correct if they are one operation:
--   * the debit happens FIRST, so a target with nothing left leaves the booking exactly
--     as it was — no window in which the booking is charged against nothing;
--   * the refund goes through `_refund_booking_credit`, the ONE refund seam (REVIEWQ),
--     which since m3 returns the credit to the row it came from and keeps its month and
--     expiry attached. No second refund is written here;
--   * both run inside one function, hence one transaction — either the swap happened or
--     nothing did.
--
-- WHO MAY SWAP (owner: "the booked and pending-booking item swap"):
--   * the booking's own client, while it is still a REQUEST (`pending`) — the same
--     boundary ONBOARD §7 already draws for editing a request: nothing has been agreed,
--     so it is still theirs to change;
--   * staff, at any time, including a confirmed booking — they are the ones who
--     discover it was billed to the wrong plan.
-- Neither may swap a booking that is over or dead (completed / cancelled / expired /
-- no-show): there is nothing left to charge.
--
-- REFUSALS carry a reason the UI can show verbatim. A swap NEVER mints: the target must
-- already hold the entitlement, unexpired, in the right segment.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE RECORD — who swapped, from what, to what, when
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS booking_item_swaps (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id),
  booking_id         uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  swapped_by         uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  /** 'client' | 'staff' — which authority was used, not which role the person holds. */
  swapped_by_role    text NOT NULL CHECK (swapped_by_role IN ('client','staff')),
  /** The booking's status at the moment of the swap: a pending swap and a confirmed
   *  swap are different events and the log should not make them look alike. */
  booking_status_at  text,
  from_credit_id     uuid,
  from_offering_id   uuid,
  from_purchase_id   uuid,
  from_label         text,
  to_credit_id       uuid NOT NULL,
  to_offering_id     uuid,
  to_purchase_id     uuid,
  to_label           text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE booking_item_swaps IS
  'CREDITALIGN A2: every time a booking was re-charged from one purchased item to '
  'another — who, from what, to what, when, and what state the booking was in. '
  'Deliberately NOT foreign-keyed to lesson_credits: a credit row can be soft-deleted '
  'or superseded and this record has to outlive it (same reasoning as executed '
  'documents — evidence you deleted is evidence you do not have). It is a log, not a '
  'ledger: nothing is ever spent from it.';

CREATE INDEX IF NOT EXISTS booking_item_swaps_booking_idx ON booking_item_swaps (booking_id);
CREATE INDEX IF NOT EXISTS booking_item_swaps_org_idx ON booking_item_swaps (org_id, created_at DESC);

ALTER TABLE booking_item_swaps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_item_swaps_org_boundary ON booking_item_swaps;
CREATE POLICY booking_item_swaps_org_boundary ON booking_item_swaps
  AS RESTRICTIVE TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

DROP POLICY IF EXISTS booking_item_swaps_staff_all ON booking_item_swaps;
CREATE POLICY booking_item_swaps_staff_all ON booking_item_swaps
  TO authenticated
  USING (has_staff_access()) WITH CHECK (has_staff_access());

-- A member sees the history of their own booking — it is their money that moved.
DROP POLICY IF EXISTS booking_item_swaps_client_read_own ON booking_item_swaps;
CREATE POLICY booking_item_swaps_client_read_own ON booking_item_swaps
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings b
                  WHERE b.id = booking_item_swaps.booking_id
                    AND b.client_id = current_client_id()));

-- ════════════════════════════════════════════════════════════════════════════
-- 2. WHAT CAN THIS BOOKING BE SWAPPED TO — one read, both surfaces
-- ════════════════════════════════════════════════════════════════════════════
/** The current charge and the legal targets for one booking. Staff and the booking's
 *  own client both call this; it answers with what the caller is allowed to do, so the
 *  member's panel and the staff panel cannot drift into two different opinions of what
 *  is swappable. */
CREATE OR REPLACE FUNCTION public.booking_item_options(p_booking_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_b      bookings%ROWTYPE;
  v_client uuid := current_client_id();
  v_staff  boolean := coalesce(has_staff_access(), false);
  v_mine   boolean;
  v_can    boolean := false;
  v_why    text;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  v_mine := v_client IS NOT NULL AND v_b.client_id = v_client;
  IF NOT (v_staff OR v_mine) THEN RAISE EXCEPTION 'not authorized to view this booking'; END IF;

  IF v_b.status IN ('completed','cancelled','expired','no_show') THEN
    v_why := 'This booking is ' || v_b.status || ' — there is nothing left to charge.';
  ELSIF v_staff THEN
    v_can := true;
  ELSIF v_b.status = 'pending' THEN
    v_can := true;
  ELSE
    v_why := 'We have already confirmed this booking — ask us and we will move it for you.';
  END IF;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'kind', v_b.kind,
    'status', v_b.status,
    'can_swap', v_can,
    'reason', v_why,
    'current', (SELECT jsonb_build_object(
                  'credit_id', lc.id,
                  'label', coalesce(o.name, lc.package_key, 'Lesson credit'),
                  'offering_id', lc.offering_id,
                  'purchase_id', lc.purchase_id,
                  'expires_at', lc.expires_at,
                  'remaining', lc.credits_remaining)
                  FROM lesson_credits lc
                  LEFT JOIN offerings o ON o.id = lc.offering_id
                 WHERE lc.id = v_b.credit_id),
    'options', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                  'credit_id', lc.id,
                  'label', coalesce(o.name, lc.package_key, 'Lesson credit'),
                  'offering_id', lc.offering_id,
                  'purchase_id', lc.purchase_id,
                  'segment', o.segment,
                  'remaining', lc.credits_remaining,
                  'period_start', lc.period_start,
                  'expires_at', lc.expires_at)
                  ORDER BY lc.expires_at ASC NULLS LAST, lc.purchased_at), '[]'::jsonb)
                  FROM lesson_credits lc
                  LEFT JOIN offerings o ON o.id = lc.offering_id
                 WHERE lc.client_id = v_b.client_id
                   AND lc.deleted_at IS NULL
                   AND lc.credits_remaining > 0
                   AND (lc.expires_at IS NULL OR lc.expires_at > now())
                   AND lc.id IS DISTINCT FROM v_b.credit_id
                   -- same segment rule book_open_slot enforces: care is funded by
                   -- horse-segment entitlement, lessons by everything else.
                   AND (v_b.kind <> 'care' OR o.segment = 'horse')
                   AND (v_b.kind <> 'lesson' OR coalesce(o.segment, '') <> 'horse'))
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.booking_item_options(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.booking_item_options(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.booking_item_options(uuid) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. THE SWAP
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.swap_booking_item(p_booking_id uuid, p_credit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_b        bookings%ROWTYPE;
  v_client   uuid := current_client_id();
  v_staff    boolean := coalesce(has_staff_access(), false);
  v_mine     boolean;
  v_role     text;
  v_to       lesson_credits%ROWTYPE;
  v_to_seg   text;
  v_to_label text;
  v_from     lesson_credits%ROWTYPE;
  v_from_lbl text;
  v_debited  uuid;
  v_refunded boolean := false;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;

  v_mine := v_client IS NOT NULL AND v_b.client_id = v_client;
  IF v_staff THEN
    v_role := 'staff';
    IF v_b.org_id IS DISTINCT FROM current_org() THEN
      RAISE EXCEPTION 'that booking is not in your organization';
    END IF;
  ELSIF v_mine THEN
    v_role := 'client';
    -- ONBOARD §7's boundary, reused: a request is still yours; a confirmation is ours.
    IF v_b.status <> 'pending' THEN
      RAISE EXCEPTION 'NOT_PENDING: we have already confirmed this booking — ask us and we will move it for you';
    END IF;
  ELSE
    RAISE EXCEPTION 'not authorized to change this booking';
  END IF;

  IF v_b.status IN ('completed','cancelled','expired','no_show') THEN
    RAISE EXCEPTION 'BOOKING_CLOSED: this booking is % — there is nothing left to charge', v_b.status;
  END IF;
  IF v_b.client_id IS NULL THEN
    RAISE EXCEPTION 'BOOKING_UNASSIGNED: this booking has no client to charge';
  END IF;

  -- ── the target has to be real, theirs, live, unexpired, and have something left ──
  SELECT * INTO v_to FROM lesson_credits
   WHERE id = p_credit_id AND client_id = v_b.client_id AND deleted_at IS NULL
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_SUCH_ITEM: that purchased item does not belong to this client';
  END IF;
  IF v_to.id = v_b.credit_id THEN
    RAISE EXCEPTION 'ALREADY_ON_THAT_ITEM: this booking is already charged against that item';
  END IF;
  IF v_to.expires_at IS NOT NULL AND v_to.expires_at <= now() THEN
    RAISE EXCEPTION 'ITEM_EXPIRED: that allotment ran out on % and does not carry over',
      to_char(v_to.expires_at - interval '1 day', 'FMMon FMDD, YYYY');
  END IF;

  SELECT o.segment, coalesce(o.name, v_to.package_key, 'Lesson credit')
    INTO v_to_seg, v_to_label
    FROM offerings o WHERE o.id = v_to.offering_id;
  v_to_label := coalesce(v_to_label, v_to.package_key, 'Lesson credit');

  -- same segment rule book_open_slot enforces at booking time.
  IF v_b.kind = 'care' AND coalesce(v_to_seg, '') <> 'horse' THEN
    RAISE EXCEPTION 'WRONG_SERVICE: "%" is not a horse-care item, so it cannot pay for a care booking', v_to_label;
  END IF;
  IF v_b.kind = 'lesson' AND coalesce(v_to_seg, '') = 'horse' THEN
    RAISE EXCEPTION 'WRONG_SERVICE: "%" is a horse-care item, so it cannot pay for a lesson', v_to_label;
  END IF;

  -- ── DEBIT FIRST. If there is nothing to take, the booking is untouched. ──
  UPDATE lesson_credits SET credits_remaining = credits_remaining - 1
   WHERE id = v_to.id AND credits_remaining > 0
   RETURNING id INTO v_debited;
  IF v_debited IS NULL THEN
    RAISE EXCEPTION 'NO_ENTITLEMENT: "%" has nothing left to book with', v_to_label;
  END IF;

  -- ── THEN REFUND, through the one seam. Same transaction, so the pair is atomic. ──
  IF v_b.credit_id IS NOT NULL THEN
    SELECT * INTO v_from FROM lesson_credits WHERE id = v_b.credit_id;
    SELECT coalesce(o.name, v_from.package_key, 'Lesson credit') INTO v_from_lbl
      FROM offerings o WHERE o.id = v_from.offering_id;
    v_from_lbl := coalesce(v_from_lbl, v_from.package_key, 'Lesson credit');
    v_refunded := _refund_booking_credit(v_b);
  END IF;

  UPDATE bookings SET
    credit_id   = v_to.id,
    offering_id = coalesce(v_to.offering_id, offering_id),
    purchase_id = coalesce(v_to.purchase_id, purchase_id),
    updated_at  = now()
  WHERE id = p_booking_id;

  INSERT INTO booking_item_swaps (
    org_id, booking_id, swapped_by, swapped_by_role, booking_status_at,
    from_credit_id, from_offering_id, from_purchase_id, from_label,
    to_credit_id, to_offering_id, to_purchase_id, to_label)
  VALUES (v_b.org_id, p_booking_id, auth.uid(), v_role, v_b.status,
          v_b.credit_id, v_from.offering_id, v_from.purchase_id, v_from_lbl,
          v_to.id, v_to.offering_id, v_to.purchase_id, v_to_label);

  -- The company confirms bookings, so it needs to know when the thing it confirmed
  -- gets re-charged to something else.
  IF v_role = 'client' THEN
    PERFORM notify_staff(v_b.org_id, 'booking_item_swapped',
      'A client re-assigned ' || to_char(v_b.starts_at, 'FMMon FMDD, HH12:MI AM')
        || ' to ' || v_to_label, '/app/calendar');
  ELSIF v_b.account_user_id IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_b.org_id, v_b.account_user_id, 'booking_item_swapped',
              'Your ' || to_char(v_b.starts_at, 'FMMon FMDD') || ' booking is now against ' || v_to_label,
              '/app/calendar');
  END IF;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'from_credit_id', v_b.credit_id, 'from_label', v_from_lbl,
    'to_credit_id', v_to.id, 'to_label', v_to_label,
    'refunded', v_refunded,
    'by', v_role);
END;
$function$;

COMMENT ON FUNCTION public.swap_booking_item(uuid, uuid) IS
  'CREDITALIGN A2: re-charge a booking from one purchased item to another. Debit first, '
  'then refund through _refund_booking_credit (the one refund seam) — one function, one '
  'transaction. Client while pending, staff any time. Refuses with a readable reason '
  'when the target is expired, empty, the wrong segment or not theirs; never mints.';

REVOKE ALL ON FUNCTION public.swap_booking_item(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.swap_booking_item(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.swap_booking_item(uuid, uuid) TO authenticated, service_role;
