-- 20260912T1800 — the staff calendar carries the client name and the activity name.
--
-- The remastered week grid shows "who + what" on each session (owner, 2026-09-12).
-- calendar_free_busy already returns client_id and offering_id for staff, but not
-- their names — so the grid could only draw "Reserved". This adds two display-only
-- keys to the STAFF branch (client_name, offering_name); every other branch is
-- byte-identical to the live body. Additive, staff-only, no behaviour change.
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

  SELECT coalesce(jsonb_agg(item ORDER BY ((item->>'starts_at')::timestamptz)), '[]'::jsonb) INTO v_items
  FROM (
    SELECT CASE
      -- staff/admin: full detail on every item, now WITH the display names.
      WHEN v_staff THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', b.status, 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', b.is_flexible, 'is_mine', false, 'mine_role', 'staff',
        'client_id', b.client_id, 'horse_id', b.horse_id, 'purchase_id', b.purchase_id,
        'instructor_user_id', b.instructor_user_id,
        'offering_id', b.offering_id, 'location_id', b.location_id, 'address', b.address,
        'price_amount', b.price_amount, 'notes', b.notes,
        'travel_before_minutes', b.travel_before_minutes,
        'travel_after_minutes', b.travel_after_minutes, 'series_id', b.series_id,
        -- ⚠️ DISPLAY-ONLY (2026-09-12): who the session is with, and what it is.
        'client_name', (SELECT coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), c.email)
                          FROM clients cl JOIN contacts c ON c.id = cl.contact_id
                         WHERE cl.id = b.client_id),
        'offering_name', (SELECT o.name FROM offerings o WHERE o.id = b.offering_id))
      WHEN b.client_id = v_client THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', b.status, 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', b.is_flexible, 'is_mine', true, 'mine_role', 'client',
        'horse_id', b.horse_id, 'offering_id', b.offering_id,
        'location_id', b.location_id, 'address', b.address, 'notes', b.notes,
        'series_id', b.series_id)
      WHEN b.status = 'cancelled' THEN NULL
      WHEN b.is_flexible AND b.status = 'available' THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', 'available', 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', true, 'is_mine', false, 'offering_id', b.offering_id,
        'location_id', b.location_id)
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
