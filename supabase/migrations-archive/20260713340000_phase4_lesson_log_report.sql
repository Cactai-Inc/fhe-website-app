/*
  # Phase 4 — the lesson LOG + REPORT engine

  A lesson (or, later, a horse-care session) gets two staff artifacts and a
  thread of authored notes:

    LOG    — activity checkboxes (configurable per service category) + raw text.
             The instructor's record of what was worked on.
    REPORT — the rider-visible write-up: the "Instructor notes" box, kept in the
             existing bookings.notes column (already wired to my_lesson_progress).
    NOTES  — authored, UNEDITABLE, authorship-labeled entries (booking_notes):
             PRE-lesson notes from rider and/or instructor (rendered into the
             report, shown only if present) and POST notes the rider adds for the
             instructor. Insert-only — never edited.

  Same shape serves riding lessons, jumper training, and horsemanship (all
  bookings.kind='lesson' already) and — once horse-care fulfillment sessions
  exist — exercise-category care (kind='care', added here). Clipping is
  report-only: its category simply has no activity checklist, so no log.

  A. activity_checklists — configurable checkboxes, keyed by service_type.
  B. bookings.activity_log (the LOG) + kind='care'.
  C. booking_notes — authored, uneditable pre/post notes.
  D. RPCs: activity_checklist, set_booking_log, add_booking_note, booking_report,
     my_lesson_reports.
  E. seed the default checklists for this tenant.
*/

-- ── A. configurable activity checklist (per service category) ────────────────
CREATE TABLE IF NOT EXISTS activity_checklists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service_type text NOT NULL,
  label        text NOT NULL,
  sort_order   integer NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, service_type, label)
);
CREATE INDEX IF NOT EXISTS activity_checklists_lookup_idx
  ON activity_checklists (org_id, service_type) WHERE active;

ALTER TABLE activity_checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS activity_checklists_read ON activity_checklists;
CREATE POLICY activity_checklists_read ON activity_checklists
  FOR SELECT TO authenticated
  USING (org_id = current_org());

DROP POLICY IF EXISTS activity_checklists_write ON activity_checklists;
CREATE POLICY activity_checklists_write ON activity_checklists
  FOR ALL TO authenticated
  USING (org_id = current_org() AND has_staff_access())
  WITH CHECK (org_id = current_org() AND has_staff_access());

-- ── B. the LOG on the booking + the care kind ────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS activity_log jsonb;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_kind_check;
ALTER TABLE bookings ADD  CONSTRAINT bookings_kind_check CHECK (kind IN ('purchase','lesson','care'));

-- ── C. authored, uneditable notes (pre/post) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id     uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  author_user_id uuid,
  author_role    text NOT NULL CHECK (author_role IN ('rider','instructor','staff','admin')),
  author_name    text,
  phase          text NOT NULL CHECK (phase IN ('pre','post')),
  body           text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_notes_booking_idx ON booking_notes (booking_id, created_at);

ALTER TABLE booking_notes ENABLE ROW LEVEL SECURITY;

-- reads: staff in-org, or the booking's own client. Writes go through the
-- SECURITY DEFINER RPC below (which bypasses RLS), so no write policy is needed.
DROP POLICY IF EXISTS booking_notes_read ON booking_notes;
CREATE POLICY booking_notes_read ON booking_notes
  FOR SELECT TO authenticated
  USING (
    (org_id = current_org() AND has_staff_access())
    OR booking_id IN (SELECT id FROM bookings WHERE client_id = current_client_id())
  );

-- ── D. RPCs ──────────────────────────────────────────────────────────────────

-- the service_type a booking's checklist keys on: an offering-bound booking
-- (horse-care) uses its offering's type; a bare lesson booking defaults to
-- RIDING_LESSON (lessons/jumper/horsemanship share the lesson checklist).
CREATE OR REPLACE FUNCTION booking_service_type(p_booking bookings)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT CASE
    WHEN p_booking.offering_id IS NOT NULL
      THEN (SELECT o.service_type FROM offerings o WHERE o.id = p_booking.offering_id)
    WHEN p_booking.kind = 'lesson' THEN 'RIDING_LESSON'
    ELSE NULL
  END
$fn$;

-- the active checklist labels for a service category (sorted), org-scoped.
CREATE OR REPLACE FUNCTION activity_checklist(p_service_type text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT coalesce(jsonb_agg(label ORDER BY sort_order, label), '[]'::jsonb)
  FROM activity_checklists
  WHERE org_id = current_org() AND service_type = p_service_type AND active
$fn$;

REVOKE ALL ON FUNCTION activity_checklist(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION activity_checklist(text) TO authenticated, service_role;

-- staff write the LOG: the checked activities + the raw log text.
CREATE OR REPLACE FUNCTION set_booking_log(p_booking_id uuid, p_activities jsonb, p_text text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  UPDATE bookings
     SET activity_log = jsonb_build_object(
           'activities', coalesce(p_activities, '[]'::jsonb),
           'text', NULLIF(btrim(coalesce(p_text, '')), ''))
   WHERE id = p_booking_id
     AND kind IN ('lesson','care')
     AND org_id = current_org();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking not found in this org';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION set_booking_log(uuid, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION set_booking_log(uuid, jsonb, text) TO authenticated, service_role;

-- add an authored note (pre/post). The booking's own client posts as 'rider';
-- staff post as 'instructor'. Insert-only — notes are never edited.
CREATE OR REPLACE FUNCTION add_booking_note(p_booking_id uuid, p_phase text, p_body text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_b       bookings%ROWTYPE;
  v_client  uuid := current_client_id();
  v_contact uuid := current_contact_id();
  v_role    text;
  v_name    text;
  v_id      uuid;
  v_body    text := NULLIF(btrim(coalesce(p_body, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF v_body IS NULL THEN RAISE EXCEPTION 'a note cannot be empty'; END IF;
  IF p_phase NOT IN ('pre','post') THEN RAISE EXCEPTION 'phase must be pre or post'; END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;

  IF v_client IS NOT NULL AND v_b.client_id = v_client THEN
    v_role := 'rider';
    SELECT trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')) INTO v_name
      FROM contacts WHERE id = v_contact;
  ELSIF has_staff_access() AND v_b.org_id = current_org() THEN
    v_role := 'instructor';
    SELECT coalesce(display_name, trim(coalesce(first_name,'') || ' ' || coalesce(last_name,'')))
      INTO v_name FROM profiles WHERE user_id = auth.uid();
  ELSE
    RAISE EXCEPTION 'not authorized to note this booking';
  END IF;

  INSERT INTO booking_notes (org_id, booking_id, author_user_id, author_role, author_name, phase, body)
    VALUES (v_b.org_id, p_booking_id, auth.uid(), v_role, NULLIF(v_name, ''), p_phase, v_body)
    RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'author_role', v_role, 'author_name', NULLIF(v_name,''),
                            'phase', p_phase, 'body', v_body);
END;
$fn$;

REVOKE ALL ON FUNCTION add_booking_note(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION add_booking_note(uuid, text, text) TO authenticated, service_role;

-- the assembled report for one booking: log + report text + authored notes +
-- the resolved checklist. Readable by staff in-org or the booking's own client.
CREATE OR REPLACE FUNCTION booking_report(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_b      bookings%ROWTYPE;
  v_client uuid := current_client_id();
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;

  IF NOT ((has_staff_access() AND v_b.org_id = current_org())
          OR (v_client IS NOT NULL AND v_b.client_id = v_client)) THEN
    RAISE EXCEPTION 'not authorized to view this report';
  END IF;

  RETURN jsonb_build_object(
    'booking_id',   v_b.id,
    'kind',         v_b.kind,
    'starts_at',    v_b.starts_at,
    'ends_at',      v_b.ends_at,
    'status',       upper(v_b.status),
    'location',     v_b.location,
    'horse_id',     v_b.horse_id,
    'service_type', booking_service_type(v_b),
    'checklist',    activity_checklist(booking_service_type(v_b)),
    'activity_log', v_b.activity_log,
    'report',       v_b.notes,
    'notes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', n.id, 'author_role', n.author_role, 'author_name', n.author_name,
          'phase', n.phase, 'body', n.body, 'created_at', n.created_at)
        ORDER BY (n.phase = 'pre') DESC, n.created_at)
      FROM booking_notes n WHERE n.booking_id = v_b.id), '[]'::jsonb)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION booking_report(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION booking_report(uuid) TO authenticated, service_role;

-- the rider's own lesson reports (every lesson that carries any write-up),
-- newest first — the client-facing "Your progress" feed.
CREATE OR REPLACE FUNCTION my_lesson_reports()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
  SELECT coalesce(jsonb_agg(r ORDER BY r.starts_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      b.starts_at,
      jsonb_build_object(
        'booking_id',   b.id,
        'starts_at',    b.starts_at,
        'ends_at',      b.ends_at,
        'status',       upper(b.status),
        'location',     b.location,
        'activity_log', b.activity_log,
        'report',       b.notes,
        'notes', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
              'author_role', n.author_role, 'author_name', n.author_name,
              'phase', n.phase, 'body', n.body, 'created_at', n.created_at)
            ORDER BY (n.phase = 'pre') DESC, n.created_at)
          FROM booking_notes n WHERE n.booking_id = b.id), '[]'::jsonb)
      ) AS r
    FROM bookings b
    WHERE b.kind = 'lesson'
      AND b.client_id = current_client_id()
      AND (
        (b.notes IS NOT NULL AND btrim(b.notes) <> '')
        OR b.activity_log IS NOT NULL
        OR EXISTS (SELECT 1 FROM booking_notes n WHERE n.booking_id = b.id)
      )
    ORDER BY b.starts_at DESC
    LIMIT 50
  ) r
$fn$;

REVOKE ALL ON FUNCTION my_lesson_reports() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_lesson_reports() TO authenticated;

-- ── E. seed the default checklists for this tenant ───────────────────────────
INSERT INTO activity_checklists (org_id, service_type, label, sort_order)
SELECT 'e656f20b-ef43-4725-9029-19e7f0190d9c'::uuid, v.service_type, v.label, v.ord
FROM (VALUES
  ('RIDING_LESSON','Warm-up',1),
  ('RIDING_LESSON','Flatwork',2),
  ('RIDING_LESSON','Trot work',3),
  ('RIDING_LESSON','Canter work',4),
  ('RIDING_LESSON','Transitions',5),
  ('RIDING_LESSON','Gymnastics / grid',6),
  ('RIDING_LESSON','Course work',7),
  ('RIDING_LESSON','Cool-down',8),
  ('JUMPER_TRAINING','Warm-up',1),
  ('JUMPER_TRAINING','Flatwork',2),
  ('JUMPER_TRAINING','Gymnastics / grid',3),
  ('JUMPER_TRAINING','Related distances',4),
  ('JUMPER_TRAINING','Course work',5),
  ('JUMPER_TRAINING','Cool-down',6),
  ('HORSEMANSHIP_TRAINING','Groundwork',1),
  ('HORSEMANSHIP_TRAINING','Grooming & tacking',2),
  ('HORSEMANSHIP_TRAINING','Leading & handling',3),
  ('HORSEMANSHIP_TRAINING','Horse care',4),
  ('HORSEMANSHIP_TRAINING','Stable management',5),
  ('HORSE_EXERCISE','Lunging',1),
  ('HORSE_EXERCISE','Turnout',2),
  ('HORSE_EXERCISE','Under-saddle exercise',3),
  ('HORSE_EXERCISE','Groundwork',4),
  ('HORSE_EXERCISE','Conditioning',5),
  ('HORSE_EXERCISE','Hand-walking',6),
  ('HORSE_TRAINING','Groundwork',1),
  ('HORSE_TRAINING','Under-saddle',2),
  ('HORSE_TRAINING','Desensitization',3),
  ('HORSE_TRAINING','Lateral work',4),
  ('HORSE_TRAINING','Trailer loading',5),
  ('HORSE_TRAINING','Liberty',6)
) AS v(service_type, label, ord)
ON CONFLICT (org_id, service_type, label) DO NOTHING;
