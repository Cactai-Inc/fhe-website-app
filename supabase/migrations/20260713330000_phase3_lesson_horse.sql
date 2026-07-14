/*
  # Phase 3 — a horse on every lesson (internal tracking)

  Every lesson booking carries a horse INTERNALLY for tracking — the barn horse
  a beginner rode, or the rider's own horse. The client never sees it on a
  regular (barn-horse) lesson: my_lesson_sessions already exposes no horse, so
  that stays hidden for free. Staff pick the horse at the internal booking step
  (from the org roster), and can attach/correct it afterward — the mechanism the
  "wrong-lesson-type" fix rides on.

  A. bookings.horse_id — the horse a booking concerns (lesson or purchase).
  B. schedule_lesson_session gains p_horse_id (optional; stamped + echoed).
  C. set_booking_horse(booking, horse) — staff attach/correct after the fact.
*/

-- ── A. the booking's horse ───────────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS horse_id uuid REFERENCES horses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bookings_horse_idx ON bookings (horse_id) WHERE horse_id IS NOT NULL;

-- ── B. schedule_lesson_session + horse ───────────────────────────────────────
-- Appended p_horse_id keeps every named-param caller working; the old 7-arg
-- overload is dropped so the signature stays unique.
DROP FUNCTION IF EXISTS schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION schedule_lesson_session(
  p_client_id     uuid,
  p_starts_at     timestamptz,
  p_ends_at       timestamptz,
  p_engagement_id uuid DEFAULT NULL,   -- ignored (engagements retired); echoed for shape
  p_request_id    uuid DEFAULT NULL,
  p_location      text DEFAULT NULL,
  p_notes         text DEFAULT NULL,
  p_horse_id      uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org     uuid;
  v_contact uuid;
  v_id      uuid;
  v_user    uuid;
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to schedule lessons';
  END IF;
  IF p_starts_at IS NULL OR p_ends_at IS NULL OR p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'a lesson needs a start and an end, and the end must be after the start';
  END IF;

  SELECT cl.org_id, cl.contact_id INTO v_org, v_contact
    FROM clients cl WHERE cl.id = p_client_id AND cl.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown client: %', p_client_id;
  END IF;
  IF coalesce(auth.role(), '') <> 'service_role' AND v_org IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'client % is not in your organization', p_client_id;
  END IF;

  -- a supplied horse must belong to the same tenant
  IF p_horse_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM horses h WHERE h.id = p_horse_id AND h.org_id = v_org AND h.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'horse % is not in your organization', p_horse_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.kind = 'lesson' AND b.client_id = p_client_id AND b.org_id = v_org
      AND b.status = 'scheduled'
      AND b.starts_at < p_ends_at AND b.ends_at > p_starts_at
  ) THEN
    RAISE EXCEPTION 'this client already has a lesson scheduled that overlaps % – %',
      to_char(p_starts_at, 'FMMonth FMDD, HH12:MI AM'), to_char(p_ends_at, 'HH12:MI AM');
  END IF;

  SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_contact;

  INSERT INTO bookings
      (org_id, kind, client_id, account_contact_id, account_user_id, request_id, horse_id,
       starts_at, ends_at, location, notes, status)
    VALUES
      (v_org, 'lesson', p_client_id, v_contact, v_user, p_request_id, p_horse_id,
       p_starts_at, p_ends_at,
       NULLIF(trim(coalesce(p_location, '')), ''), NULLIF(trim(coalesce(p_notes, '')), ''),
       'scheduled')
    RETURNING id INTO v_id;

  IF p_request_id IS NOT NULL THEN
    UPDATE requests SET status = 'converted' WHERE id = p_request_id;
  END IF;

  IF v_user IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_org, v_user, 'lesson_scheduled',
              'Your lesson is booked — ' || to_char(p_starts_at, 'FMMonth FMDD, HH12:MI AM'),
              '/app/schedule');
  END IF;

  RETURN jsonb_build_object(
    'session_id',    v_id,
    'client_id',     p_client_id,
    'starts_at',     p_starts_at,
    'ends_at',       p_ends_at,
    'status',        'SCHEDULED',
    'location',      NULLIF(trim(coalesce(p_location, '')), ''),
    'horse_id',      p_horse_id,
    'engagement_id', p_engagement_id,
    'request_id',    p_request_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION schedule_lesson_session(uuid, timestamptz, timestamptz, uuid, uuid, text, text, uuid) TO authenticated, service_role;

-- ── C. attach / correct a booking's horse (staff, same tenant) ────────────────
CREATE OR REPLACE FUNCTION set_booking_horse(p_booking_id uuid, p_horse_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid := current_org();
BEGIN
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  IF p_horse_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM horses h WHERE h.id = p_horse_id AND h.org_id = v_org AND h.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'horse % is not in your organization', p_horse_id;
  END IF;

  UPDATE bookings
     SET horse_id = p_horse_id
   WHERE id = p_booking_id
     AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking not found in this org';
  END IF;

  RETURN jsonb_build_object('booking_id', p_booking_id, 'horse_id', p_horse_id);
END;
$fn$;

REVOKE ALL ON FUNCTION set_booking_horse(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION set_booking_horse(uuid, uuid) TO authenticated, service_role;
