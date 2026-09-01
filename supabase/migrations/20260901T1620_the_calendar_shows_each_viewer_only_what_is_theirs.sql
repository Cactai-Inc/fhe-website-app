-- TASK-LIFECYCLE · C — CANCELLED IS VISIBLE TO ITS PARTIES, AND A HELD SLOT SAYS SO
--
-- Owner, 2026-09-01:
--   *"cancelled is the status for an order that was cancelled by staff or client,
--   it shows as cancelled to both parties and open and available to everyone else."*
--   *"a held slot isnt empty and available until the new booking is approved then
--   the hold is released."* · *"to everyone else it can show as pending reschedule,
--   to indicate its likely to open up."*
--
-- ⚠️ TRAP 3, AND IT IS THE WHOLE OF THIS FILE. `calendar_free_busy` carried
-- `AND b.status NOT IN ('cancelled','expired')` in its WHERE, which hides a
-- cancellation from THE PEOPLE IT HAPPENED TO. The filter moves out of the WHERE
-- and into the CASE: the staff arm and the client's-own arm are above it, so the
-- parties keep their row, and only the outsider's arm returns NULL — which the
-- existing `WHERE item IS NOT NULL` drops, so the slot renders as empty space.
-- ⚠️ THIS CHANGES WHAT REAL USERS SEE TODAY. That is the point of the change.
-- Six cancelled bookings become visible to their own parties.
--
-- `expired` stays hidden from everyone: it is not the owner's subject here, and
-- widening it was not asked for.
--
-- A `moved` booking is the HOLD. It sits at its OLD time until the new time is
-- approved — `decide_booking_change` then applies the delta to this same row,
-- which releases the old slot by construction. To an outsider it reads
-- `pending_reschedule`; to the parties it reads `moved`.
CREATE OR REPLACE FUNCTION public.calendar_free_busy(p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org    uuid := current_org();
  v_staff  boolean := has_staff_access();
  v_client uuid := current_client_id();
  v_items  jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF p_to <= p_from OR p_to - p_from > interval '62 days' THEN
    RAISE EXCEPTION 'range must be positive and <= 62 days';
  END IF;

  -- ⚠️ FIX2 §4b: sort on the TIMESTAMP, not its text. `(item->>'starts_at')` is a
  -- text sort of a timestamptz and orders two items an offset apart backwards
  -- inside the DST fall-back hour (AR1 F26b).
  SELECT coalesce(jsonb_agg(item ORDER BY ((item->>'starts_at')::timestamptz)), '[]'::jsonb) INTO v_items
  FROM (
    SELECT CASE
      -- staff/admin: full detail on every item
      WHEN v_staff THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', b.status, 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', b.is_flexible, 'is_mine', false, 'mine_role', 'staff',
        'client_id', b.client_id, 'horse_id', b.horse_id, 'purchase_id', b.purchase_id,
        -- ⚠️ FIX2 §1/§4b: WHO IS DELIVERING IT. Staff-only, read-only, and the
        -- reason the panel can now show the stamp instead of guessing at it.
        'instructor_user_id', b.instructor_user_id,
        'offering_id', b.offering_id, 'location_id', b.location_id, 'address', b.address,
        'price_amount', b.price_amount, 'notes', b.notes,
        'travel_before_minutes', b.travel_before_minutes,
        'travel_after_minutes', b.travel_after_minutes, 'series_id', b.series_id)
      -- the client's OWN item: full detail
      WHEN b.client_id = v_client THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', b.status, 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', b.is_flexible, 'is_mine', true, 'mine_role', 'client',
        'horse_id', b.horse_id, 'offering_id', b.offering_id,
        'location_id', b.location_id, 'address', b.address, 'notes', b.notes,
        'series_id', b.series_id)
      -- ⚠️ EVERYONE ELSE'S CANCELLATION IS NOT THEIRS TO SEE. NULL here, dropped
      -- by `WHERE item IS NOT NULL` below, so the slot renders as empty space —
      -- and empty IS available (there is no availability chip to render).
      WHEN b.status = 'cancelled' THEN NULL
      -- a flexible-open block: bookable suggestion
      WHEN b.is_flexible AND b.status = 'available' THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', 'available', 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', true, 'is_mine', false, 'offering_id', b.offering_id,
        'location_id', b.location_id)
      -- everyone else's taken time: opaque, travel folded into the window.
      -- A held slot says it is likely to open up, and nothing more.
      ELSE jsonb_build_object(
        'id', b.id,
        'status', CASE WHEN b.status = 'moved' THEN 'pending_reschedule' ELSE 'unavailable' END,
        'is_mine', false,
        'all_day', b.all_day,
        'starts_at', b.starts_at - make_interval(mins => b.travel_before_minutes),
        'ends_at', b.ends_at + make_interval(mins => b.travel_after_minutes))
    END AS item
    FROM bookings b
    WHERE b.org_id = v_org
      AND b.status <> 'expired'
      AND b.starts_at < p_to
      AND (b.ends_at IS NULL OR b.ends_at > p_from)
      -- clients never see other people's drafts
      AND (v_staff OR b.status <> 'draft' OR b.client_id = v_client)
  ) rows
  WHERE item IS NOT NULL;

  RETURN jsonb_build_object(
    'from', p_from, 'to', p_to,
    'role', CASE WHEN v_staff THEN 'staff' ELSE 'client' END,
    'hours', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'weekday', weekday, 'open', open_time, 'close', close_time, 'closed', closed)
        ORDER BY weekday), '[]'::jsonb)
      FROM business_hours WHERE org_id = v_org),
    'items', v_items
  );
END;
$function$;
