/*
  # Phase 6 · Slice 1 — the calendar foundation

  One calendar for client/staff/admin, built on the spine `bookings` table plus
  a virtual business-hours frame. We DO NOT pre-generate open slots — the frame
  (10–6, 7 days) is computed; only exceptions are stored (unavailable blocks,
  flexible-open blocks, real bookings, drafts).

  A. business_hours — per-org, per-weekday open/close (seed 10:00–18:00 × 7).
  B. locations — the pick-list (seed Carmel Creek Ranch as the default onsite).
  C. bookings gains the calendar shape: kind='block', is_flexible, series_id,
     travel buffers, address, price, location_id, created_by, all_day, reminder
     stamps; statuses draft/available/unavailable/pending added.
  D. booking_change_requests — the reschedule/cancel/defer/flex-move flow + audit
     (who requested, fee paid/waived, who decided).
  E. calendar_free_busy(from,to) — the role-aware reader the calendar renders:
     staff see everything in full; a client sees their own items in full,
     flexible-open blocks as bookable, and everyone else's taken time as opaque
     'unavailable' (travel buffers folded into the busy window).
  F. business_hours() reader.
*/

-- ── A. business hours (the virtual frame) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS business_hours (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  weekday    smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),  -- 0=Sun … 6=Sat
  open_time  time NOT NULL DEFAULT '10:00',
  close_time time NOT NULL DEFAULT '18:00',
  closed     boolean NOT NULL DEFAULT false,
  UNIQUE (org_id, weekday)
);
ALTER TABLE business_hours ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_hours_read ON business_hours;
CREATE POLICY business_hours_read ON business_hours
  FOR SELECT TO authenticated USING (org_id = current_org());
DROP POLICY IF EXISTS business_hours_write ON business_hours;
CREATE POLICY business_hours_write ON business_hours
  FOR ALL TO authenticated
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());

INSERT INTO business_hours (org_id, weekday, open_time, close_time)
SELECT 'e656f20b-ef43-4725-9029-19e7f0190d9c'::uuid, gs, '10:00', '18:00'
FROM generate_series(0,6) gs
ON CONFLICT (org_id, weekday) DO NOTHING;

-- ── B. locations pick-list ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS locations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       text NOT NULL,
  address    text,
  is_offsite boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS locations_read ON locations;
CREATE POLICY locations_read ON locations
  FOR SELECT TO authenticated USING (org_id = current_org());
DROP POLICY IF EXISTS locations_write ON locations;
CREATE POLICY locations_write ON locations
  FOR ALL TO authenticated
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());

INSERT INTO locations (org_id, name, address, is_offsite, is_default, sort_order)
SELECT 'e656f20b-ef43-4725-9029-19e7f0190d9c'::uuid,
       'Carmel Creek Ranch', 'Carmel Creek Ranch, San Diego, CA', false, true, 0
WHERE NOT EXISTS (
  SELECT 1 FROM locations WHERE org_id = 'e656f20b-ef43-4725-9029-19e7f0190d9c'::uuid AND is_default
);

-- ── C. bookings gains the calendar shape ─────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_flexible           boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS series_id             uuid;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_before_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS travel_after_minutes  integer NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS address               text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS price_amount          numeric(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS location_id           uuid REFERENCES locations(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by            uuid;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS all_day               boolean NOT NULL DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_1h_sent_at   timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_2h_sent_at   timestamptz;

CREATE INDEX IF NOT EXISTS bookings_series_idx ON bookings (series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bookings_calendar_range_idx ON bookings (org_id, starts_at)
  WHERE status <> 'cancelled';

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_kind_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_kind_check
  CHECK (kind IN ('purchase','lesson','care','block'));

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_status_check
  CHECK (status IN (
    'draft','available','unavailable','pending',
    'pending_slot','pending_payment','confirmed','cancelled','expired',
    'completed','scheduled','no_show'));

-- ── D. change-request flow (reschedule / cancel / defer / flex-move) ──────────
CREATE TABLE IF NOT EXISTS booking_change_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id       uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  requested_by     uuid,
  request_kind     text NOT NULL CHECK (request_kind IN ('reschedule','cancel','defer','flex_move')),
  proposed_starts_at timestamptz,
  proposed_ends_at   timestamptz,
  -- recurring scope: 'one' | 'weeks:N' | 'permanent' (null for non-recurring)
  scope            text,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','approved','rejected','withdrawn')),
  fee_amount       numeric(10,2),
  fee_paid         boolean NOT NULL DEFAULT false,
  fee_waived       boolean NOT NULL DEFAULT false,
  phone_required   boolean NOT NULL DEFAULT false,  -- true when requested < 24h out
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  decided_by       uuid,
  decided_at       timestamptz
);
CREATE INDEX IF NOT EXISTS booking_change_requests_booking_idx ON booking_change_requests (booking_id);
CREATE INDEX IF NOT EXISTS booking_change_requests_open_idx ON booking_change_requests (org_id, status)
  WHERE status = 'pending';

ALTER TABLE booking_change_requests ENABLE ROW LEVEL SECURITY;
-- reads: staff in-org, or the client who owns the underlying booking. Writes go
-- through SECURITY DEFINER RPCs (Slice 4), so no client write policy here.
DROP POLICY IF EXISTS booking_change_requests_read ON booking_change_requests;
CREATE POLICY booking_change_requests_read ON booking_change_requests
  FOR SELECT TO authenticated
  USING (
    (org_id = current_org() AND has_staff_access())
    OR booking_id IN (SELECT id FROM bookings WHERE client_id = current_client_id())
  );

-- ── E. the role-aware free/busy reader ───────────────────────────────────────
CREATE OR REPLACE FUNCTION calendar_free_busy(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
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

  SELECT coalesce(jsonb_agg(item ORDER BY (item->>'starts_at')), '[]'::jsonb) INTO v_items
  FROM (
    SELECT CASE
      -- staff/admin: full detail on every item
      WHEN v_staff THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', b.status, 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', b.is_flexible, 'is_mine', false, 'mine_role', 'staff',
        'client_id', b.client_id, 'horse_id', b.horse_id, 'purchase_id', b.purchase_id,
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
      -- a flexible-open block: bookable suggestion
      WHEN b.is_flexible AND b.status = 'available' THEN jsonb_build_object(
        'id', b.id, 'kind', b.kind, 'status', 'available', 'all_day', b.all_day,
        'starts_at', b.starts_at, 'ends_at', b.ends_at,
        'is_flexible', true, 'is_mine', false, 'offering_id', b.offering_id,
        'location_id', b.location_id)
      -- everyone else's taken time: opaque, travel folded into the window
      ELSE jsonb_build_object(
        'id', b.id, 'status', 'unavailable', 'is_mine', false,
        'all_day', b.all_day,
        'starts_at', b.starts_at - make_interval(mins => b.travel_before_minutes),
        'ends_at', b.ends_at + make_interval(mins => b.travel_after_minutes))
    END AS item
    FROM bookings b
    WHERE b.org_id = v_org
      AND b.status NOT IN ('cancelled','expired')
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
$fn$;
REVOKE ALL ON FUNCTION calendar_free_busy(timestamptz, timestamptz) FROM public, anon;
GRANT EXECUTE ON FUNCTION calendar_free_busy(timestamptz, timestamptz) TO authenticated, service_role;

-- ── F. business_hours reader ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION business_hours()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'weekday', weekday, 'open', open_time, 'close', close_time, 'closed', closed)
      ORDER BY weekday), '[]'::jsonb)
  FROM business_hours WHERE org_id = current_org()
$fn$;
REVOKE ALL ON FUNCTION business_hours() FROM public, anon;
GRANT EXECUTE ON FUNCTION business_hours() TO authenticated, service_role;
