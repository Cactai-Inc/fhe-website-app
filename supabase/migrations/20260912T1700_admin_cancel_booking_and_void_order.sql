-- 20260912T1700 — staff cancel a booking (one / future / all) and void a whole order.
--
-- The engines to do both already exist and are proven; what was missing was a
-- staff-facing entry that does them from a client's record. Both are additive.
--
-- 1. admin_cancel_booking(p_booking_id, p_scope, p_reason)
--    Cancels a booking and, for a recurring rider, its future siblings in one
--    act. Scope: 'one' (just this booking) · 'future' (this one + every later
--    scheduled booking in the same standing series) · 'all' (every scheduled
--    booking in the series, past-dated ones excepted — you cannot un-hold a
--    lesson that already happened). A cancel is a plain status='cancelled'
--    UPDATE, which the existing `trg_booking_unit_link` trigger already turns
--    into a fulfillment-unit release (the slot/credit returns) — so this adds NO
--    second refund path (D18). The member is notified per booking.
--
-- 2. admin_void_order(p_purchase_id, p_reason)
--    Cancels an ENTIRE order by voiding every live line item through the existing
--    `void_purchase_item` (evidence retained, total recomputed, order voided when
--    the last line goes). One door for "cancel this whole order" beside the
--    per-line void.

CREATE OR REPLACE FUNCTION public.admin_cancel_booking(
  p_booking_id uuid, p_scope text DEFAULT 'one', p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_b        bookings%ROWTYPE;
  v_ids      uuid[];
  v_id       uuid;
  v_n        int := 0;
  v_reason   text := nullif(btrim(p_reason), '');
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'only staff may cancel a booking';
  END IF;
  IF p_scope NOT IN ('one', 'future', 'all') THEN
    RAISE EXCEPTION 'scope must be one, future or all';
  END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND OR v_b.org_id IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'booking not found';
  END IF;

  -- The set to cancel. 'one' is just this booking; 'future'/'all' reach the
  -- standing series (same client + offering, i.e. the weekly rider's slot), only
  -- ever touching bookings that are still SCHEDULED. 'future' keeps everything
  -- before this booking's start; 'all' keeps only what has already happened.
  IF p_scope = 'one' THEN
    v_ids := ARRAY[p_booking_id];
  ELSE
    SELECT array_agg(b.id) INTO v_ids
      FROM bookings b
     WHERE b.org_id = v_b.org_id
       AND b.status = 'scheduled'
       AND b.account_contact_id IS NOT DISTINCT FROM v_b.account_contact_id
       AND b.offering_id IS NOT DISTINCT FROM v_b.offering_id
       AND (p_scope = 'all' OR b.starts_at >= v_b.starts_at);
  END IF;

  FOREACH v_id IN ARRAY coalesce(v_ids, ARRAY[]::uuid[]) LOOP
    -- Only scheduled bookings can be cancelled; skip anything already
    -- cancelled/completed/no_show so a mixed series does not error out.
    UPDATE bookings SET status = 'cancelled',
           notes = CASE WHEN v_reason IS NULL THEN notes
                        ELSE coalesce(notes || E'\n', '') || 'Cancelled: ' || v_reason END
     WHERE id = v_id AND status = 'scheduled';
    IF FOUND THEN
      v_n := v_n + 1;
      -- Tell the member (when there is a login), per cancelled booking.
      IF v_b.account_user_id IS NOT NULL THEN
        INSERT INTO notifications (org_id, user_id, kind, title, link)
        SELECT b.org_id, b.account_user_id, 'lesson_cancelled',
               'Your ' || coalesce(b.kind, 'booking') || ' on '
                 || to_char(b.starts_at, 'FMMonth FMDD, HH12:MI AM') || ' was cancelled',
               '/app/schedule'
          FROM bookings b WHERE b.id = v_id AND b.account_user_id IS NOT NULL;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('cancelled', v_n, 'scope', p_scope);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_cancel_booking(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_booking(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_void_order(p_purchase_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid;
  v_item uuid;
  v_n int := 0;
BEGIN
  IF NOT coalesce(has_staff_access(), false) THEN
    RAISE EXCEPTION 'only staff may cancel an order';
  END IF;
  SELECT org_id INTO v_org FROM purchases WHERE id = p_purchase_id;
  IF v_org IS NULL OR v_org IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'order not found';
  END IF;

  -- Void every live line — void_purchase_item recomputes the total and voids the
  -- ORDER when the last live line goes. No second engine.
  FOR v_item IN
    SELECT id FROM purchase_items WHERE purchase_id = p_purchase_id AND voided_at IS NULL
  LOOP
    PERFORM void_purchase_item(v_item, p_reason);
    v_n := v_n + 1;
  END LOOP;

  RETURN (SELECT jsonb_build_object('purchase_id', p_purchase_id,
            'voided_items', v_n, 'status', p.status)
          FROM purchases p WHERE p.id = p_purchase_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_void_order(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_void_order(uuid, text) TO authenticated;
