-- TASK LESSONPLAN m2 — THE READ SIDE. The day's lesson carries its plan, and
-- everyone gets the version of it that makes sense for them.
--
-- §2: "Wherever Claire sees the day — the calendar, the lessons list, her
-- dashboard — the scheduled Riding Lesson carries the plan for that day."
-- §5: "everyone sees what makes sense for them … client-visible content must not
-- leak staff-private notes."
--
-- ── THE ONE RESOLUTION RULE, STATED ONCE AND IMPLEMENTED ONCE ────────────────
--   plan_for(lesson) = the version PINNED on its form, if progress has been
--                      recorded (that lesson was taught against that version);
--                      otherwise the client's CURRENT version, live.
-- That single rule is what makes §4's loop work without any scheduling machinery:
-- a lesson that has not happened has no pin, so the moment a plan advances, every
-- lesson still ahead of it shows the new plan — including the next one.
-- _lesson_plan_for_booking() below is the only implementation; every RPC here
-- calls it rather than restating it.
--
-- ── WHAT IS STAFF-ONLY AND WHAT IS NOT ──────────────────────────────────────
--   coach_notes           STAFF. Never selected into a client-facing payload.
--   focus, objectives     SHARED. The plan is the thing the rider is meant to
--                         know — a plan the rider cannot see is a private note
--                         about them, which is not what the owner asked for.
--   answers.log_text      STAFF (LESSONFORM's own split, unchanged).
--   answers.report        CLIENT (likewise).
-- Every client-facing function here builds its object field by field. There is
-- no "strip the private keys afterwards" step anywhere, because that is the
-- shape that leaks the first time somebody adds a column.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE RESOLVER
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._lesson_plan_for_booking(p_booking_id uuid)
RETURNS lesson_plans
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_b    bookings%ROWTYPE;
  v_pin  uuid;
  v_plan lesson_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND OR v_b.client_id IS NULL THEN RETURN NULL; END IF;

  SELECT bf.plan_id INTO v_pin FROM booking_forms bf WHERE bf.booking_id = p_booking_id;

  IF v_pin IS NOT NULL THEN
    SELECT * INTO v_plan FROM lesson_plans WHERE id = v_pin;
    IF FOUND THEN RETURN v_plan; END IF;
  END IF;

  RETURN _current_lesson_plan(v_b.client_id);
END;
$function$;

/** The plan as a payload, with the private lane included or excluded by the
 *  caller's own decision — never by a downstream strip. p_include_private is
 *  passed explicitly at every call site below so that reading the call tells you
 *  which audience it serves. */
CREATE OR REPLACE FUNCTION public._lesson_plan_json(p_plan lesson_plans, p_include_private boolean)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE WHEN p_plan.id IS NULL THEN NULL ELSE
    jsonb_build_object(
      'id',           p_plan.id,
      'client_id',    p_plan.client_id,
      'version',      p_plan.version,
      'status',       p_plan.status,
      'focus',        p_plan.focus,
      'objectives',   p_plan.objectives,
      'created_at',   p_plan.created_at,
      'advanced_from_booking_id', p_plan.advanced_from_booking_id,
      -- the private lane, present ONLY when the caller asked for it
      'coach_notes',  CASE WHEN p_include_private THEN to_jsonb(p_plan.coach_notes) ELSE NULL END
    )
  END
$function$;

/** What comes next: the first objective not yet achieved. The task asked for "an
 *  ordered notion of what comes next" — this is it, and it is derived from the
 *  order rather than stored, so reordering the list in the browser is the whole
 *  interaction and there is no second field to keep in step. */
CREATE OR REPLACE FUNCTION public.lesson_plan_next_up(p_objectives jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT e.v
    FROM jsonb_array_elements(
           CASE WHEN jsonb_typeof(coalesce(p_objectives, '[]'::jsonb)) = 'array'
                THEN p_objectives ELSE '[]'::jsonb END)
         WITH ORDINALITY AS e(v, n)
   WHERE coalesce(e.v ->> 'state', 'planned') <> 'achieved'
   ORDER BY e.n
   LIMIT 1
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. STAFF — the plan for one client, with its whole history
-- ════════════════════════════════════════════════════════════════════════════
-- D19: four ledgers are written and none is read back to a human. The history
-- here is the reader for the lesson_plan status events m1 added, joined to the
-- retained versions themselves, so "what changed, when, and after which lesson"
-- is answerable on a screen instead of only in psql.
CREATE OR REPLACE FUNCTION public.client_lesson_plan(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_c    clients%ROWTYPE;
  v_plan lesson_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_c FROM clients WHERE id = p_client_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'client not found'; END IF;
  IF NOT coalesce(has_staff_access() AND v_c.org_id = current_org(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  v_plan := _current_lesson_plan(p_client_id);

  RETURN jsonb_build_object(
    'client_id',   p_client_id,
    'client_name', (SELECT nullif(btrim(coalesce(ct.first_name,'') || ' ' || coalesce(ct.last_name,'')), '')
                      FROM contacts ct WHERE ct.id = v_c.contact_id),
    -- staff surface: the private lane is included, and the screen labels it
    'plan',        _lesson_plan_json(v_plan, true),
    'next_up',     lesson_plan_next_up(v_plan.objectives),

    -- every retained version, newest first. This IS "the prior plan state is
    -- retained" — no separate history table, the superseded rows are the history.
    'versions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'version', p.version, 'status', p.status,
               'focus', p.focus, 'objectives', p.objectives,
               'coach_notes', p.coach_notes,
               'created_at', p.created_at, 'superseded_at', p.superseded_at,
               'advanced_from_booking_id', p.advanced_from_booking_id,
               'advanced_from_starts_at',
                 (SELECT b.starts_at FROM bookings b WHERE b.id = p.advanced_from_booking_id))
             ORDER BY p.version DESC)
        FROM lesson_plans p WHERE p.client_id = p_client_id), '[]'::jsonb),

    -- the change log, read back to a human (D19)
    'log', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'at', se.created_at, 'code', se.status,
               'label', v.display_name, 'detail', se.detail)
             ORDER BY se.created_at DESC)
        FROM status_events se
        JOIN status_events_vocab v
          ON v.entity_type = se.entity_type AND v.code = se.status
       WHERE se.entity_type = 'lesson_plan'
         AND se.entity_id IN (SELECT p.id FROM lesson_plans p WHERE p.client_id = p_client_id)
      ), '[]'::jsonb)
  );
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. STAFF — one lesson, and the plan it carries
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.lesson_plan_for_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_b    bookings%ROWTYPE;
  v_plan lesson_plans%ROWTYPE;
  v_pin  uuid;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'lesson not found'; END IF;
  IF NOT coalesce(has_staff_access() AND v_b.org_id = current_org(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  v_plan := _lesson_plan_for_booking(p_booking_id);
  SELECT bf.plan_id INTO v_pin FROM booking_forms bf WHERE bf.booking_id = p_booking_id;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'client_id',  v_b.client_id,
    'starts_at',  v_b.starts_at,
    'plan',       _lesson_plan_json(v_plan, true),
    'next_up',    lesson_plan_next_up(v_plan.objectives),
    -- true once this lesson has been written up: the plan shown is the one it
    -- was taught against and no longer moves when the client's plan advances.
    'pinned',     v_pin IS NOT NULL
  );
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. STAFF — the DAY. Claire's landing surface (D26)
-- ════════════════════════════════════════════════════════════════════════════
-- Owner: "the lesson schedule updates with the plan for that day". This is the
-- feed behind that sentence: one row per Riding Lesson on the day, carrying the
-- plan's focus and what comes next, so the plan is on the surface she lands on
-- rather than three clicks into a detail page (D17 — routed is not reachable).
--
-- p_day NULL = today in the tenant's own timezone (set at role level by
-- 20260817T1600 — the cast reads that session setting rather than assuming UTC).
CREATE OR REPLACE FUNCTION public.lesson_plans_for_day(p_day date DEFAULT NULL)
RETURNS TABLE (
  booking_id     uuid,
  starts_at      timestamptz,
  ends_at        timestamptz,
  client_id      uuid,
  client_name    text,
  booking_status text,
  service_type   text,
  plan_id        uuid,
  plan_version   integer,
  focus          text,
  next_up        text,
  objectives     jsonb,
  progress_recorded boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT b.id, b.starts_at, b.ends_at, b.client_id,
         nullif(btrim(coalesce(ct.first_name, '') || ' ' || coalesce(ct.last_name, '')), ''),
         upper(b.status),
         coalesce(bf.service_type, booking_service_type(b)),
         pl.id, pl.version, pl.focus,
         lesson_plan_next_up(pl.objectives) ->> 'label',
         coalesce(pl.objectives, '[]'::jsonb),
         bf.plan_id IS NOT NULL
    FROM bookings b
    LEFT JOIN booking_forms bf ON bf.booking_id = b.id
    LEFT JOIN clients cl       ON cl.id = b.client_id
    LEFT JOIN contacts ct      ON ct.id = cl.contact_id
    LEFT JOIN LATERAL (SELECT * FROM _lesson_plan_for_booking(b.id)) pl ON true
   WHERE coalesce(has_staff_access() AND b.org_id = current_org(), false)
     AND b.kind = 'lesson'
     -- booking_form_applies() already encodes "a serviced booking in a state
     -- that has something to record" (assigned, not deleted, not cancelled).
     -- Reusing it means the day view and the form backlog can never disagree
     -- about which lessons are real.
     AND booking_form_applies(b)
     AND b.starts_at::date = coalesce(p_day, current_date)
   ORDER BY b.starts_at
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4b. STAFF — the roster. THE REACH for authoring a plan (D17)
-- ════════════════════════════════════════════════════════════════════════════
-- D17: routed is not reachable. A plan editor with no list in front of it is a
-- screen you can only get to if you already know a client id. This is the list:
-- every rider who has a lesson on the books or a plan already, whether or not
-- they have one — because "who has no plan yet" is the question Claire actually
-- opens this on.
CREATE OR REPLACE FUNCTION public.lesson_plan_roster()
RETURNS TABLE (
  client_id       uuid,
  client_name     text,
  plan_id         uuid,
  plan_version    integer,
  focus           text,
  next_up         text,
  objective_count integer,
  achieved_count  integer,
  plan_updated_at timestamptz,
  last_lesson_at  timestamptz,
  next_lesson_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT cl.id,
         nullif(btrim(coalesce(ct.first_name, '') || ' ' || coalesce(ct.last_name, '')), ''),
         pl.id, pl.version, pl.focus,
         lesson_plan_next_up(pl.objectives) ->> 'label',
         coalesce(jsonb_array_length(pl.objectives), 0),
         coalesce((SELECT count(*)::int FROM jsonb_array_elements(coalesce(pl.objectives, '[]'::jsonb)) e
                    WHERE e ->> 'state' = 'achieved'), 0),
         pl.created_at,
         (SELECT max(b.starts_at) FROM bookings b
           WHERE b.client_id = cl.id AND b.kind = 'lesson' AND b.deleted_at IS NULL
             AND b.starts_at <= now()),
         (SELECT min(b.starts_at) FROM bookings b
           WHERE b.client_id = cl.id AND b.kind = 'lesson' AND b.deleted_at IS NULL
             AND b.starts_at > now() AND b.status NOT IN ('cancelled', 'expired'))
    FROM clients cl
    LEFT JOIN contacts ct ON ct.id = cl.contact_id
    LEFT JOIN lesson_plans pl ON pl.client_id = cl.id AND pl.status = 'current'
   WHERE coalesce(has_staff_access() AND cl.org_id = current_org(), false)
     AND cl.deleted_at IS NULL
     AND (pl.id IS NOT NULL
          OR EXISTS (SELECT 1 FROM bookings b
                      WHERE b.client_id = cl.id AND b.kind = 'lesson'
                        AND b.deleted_at IS NULL))
   -- riders with a lesson coming up first, then everyone else by recency
   ORDER BY (SELECT min(b.starts_at) FROM bookings b
              WHERE b.client_id = cl.id AND b.kind = 'lesson' AND b.deleted_at IS NULL
                AND b.starts_at > now() AND b.status NOT IN ('cancelled', 'expired'))
            ASC NULLS LAST,
            cl.created_at DESC
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. THE RIDER — their own plan, and never the private lane
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.my_lesson_plan()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client uuid := current_client_id();
  v_plan   lesson_plans%ROWTYPE;
BEGIN
  IF v_client IS NULL THEN RETURN NULL; END IF;
  v_plan := _current_lesson_plan(v_client);
  IF v_plan.id IS NULL THEN RETURN NULL; END IF;

  -- p_include_private => FALSE. coach_notes never reaches this payload.
  RETURN _lesson_plan_json(v_plan, false)
         || jsonb_build_object('next_up', lesson_plan_next_up(v_plan.objectives));
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. THE TWO EXISTING READERS, WIDENED — not replaced
-- ════════════════════════════════════════════════════════════════════════════
-- booking_form() already returns everything the instructor form needs in one
-- round trip. Adding the plan here rather than making the form fetch it
-- separately keeps "what this lesson is" a single read, and means the plan can
-- never render against a stale copy of the form or vice versa.
--
-- Reproduced in full (not string-patched) so this file is replayable on a fresh
-- database — see CLAUDE.md's note about the ~31 in-place rewrites that are not.
CREATE OR REPLACE FUNCTION public.booking_form(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_b  bookings%ROWTYPE;
  v_f  booking_forms%ROWTYPE;
  v_service text;
  v_key text;
  v_plan lesson_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  IF NOT coalesce(has_staff_access() AND v_b.org_id = current_org(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT * INTO v_f FROM booking_forms WHERE booking_id = p_booking_id;
  v_service := coalesce(v_f.service_type, booking_service_type(v_b));
  v_key     := coalesce(v_f.form_key, booking_form_key(v_service));
  v_plan    := _lesson_plan_for_booking(p_booking_id);

  RETURN jsonb_build_object(
    'booking_id',   v_b.id,
    'kind',         v_b.kind,
    'starts_at',    v_b.starts_at,
    'ends_at',      v_b.ends_at,
    'booking_status', upper(v_b.status),
    'client_id',    v_b.client_id,
    'service_type', v_service,
    'checklist',    activity_checklist(v_service),
    'definition',   (SELECT jsonb_build_object('form_key', fd.form_key, 'title', fd.title,
                              'purpose', fd.purpose, 'version', fd.version, 'schema', fd.schema)
                       FROM form_definitions fd WHERE fd.form_key = v_key),
    'form',         CASE WHEN v_f.id IS NULL THEN NULL ELSE jsonb_build_object(
                      'id', v_f.id, 'status', v_f.status, 'answers', v_f.answers,
                      'blank', _booking_form_is_blank(v_f.answers),
                      'submitted_at', v_f.submitted_at, 'retired_at', v_f.retired_at,
                      'plan_id', v_f.plan_id,
                      'created_at', v_f.created_at, 'updated_at', v_f.updated_at) END,
    'can_mark_no_show', v_b.kind = 'lesson' AND v_b.status = 'scheduled',

    -- LESSONPLAN: the plan this lesson carries. Staff surface, so the private
    -- lane is included and the form labels it as staff-only on screen.
    'plan',         _lesson_plan_json(v_plan, true),
    'plan_next_up', lesson_plan_next_up(v_plan.objectives),
    'plan_pinned',  v_f.plan_id IS NOT NULL
  );
END;
$function$;

-- booking_report() is the rider's read of a session (and staff's). The plan goes
-- in WITHOUT the private lane — the same field-by-field construction the
-- activity_log branch already uses to keep the instructor's own log off the
-- wire for a client.
CREATE OR REPLACE FUNCTION public.booking_report(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_b      bookings%ROWTYPE;
  v_client uuid := current_client_id();
  v_staff  boolean;
  v_plan   lesson_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;

  v_staff := coalesce(has_staff_access() AND v_b.org_id = current_org(), false);
  IF NOT (v_staff OR (v_client IS NOT NULL AND v_b.client_id = v_client)) THEN
    RAISE EXCEPTION 'not authorized to view this report';
  END IF;

  v_plan := _lesson_plan_for_booking(p_booking_id);

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
    'activity_log', CASE
                      WHEN v_b.activity_log IS NULL THEN NULL
                      WHEN v_staff THEN v_b.activity_log
                      ELSE jsonb_build_object(
                        'activities', coalesce(v_b.activity_log -> 'activities', '[]'::jsonb),
                        'text', NULL)
                    END,
    'report',       v_b.notes,
    'notes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', n.id, 'author_role', n.author_role, 'author_name', n.author_name,
          'phase', n.phase, 'body', n.body, 'created_at', n.created_at)
        ORDER BY (n.phase = 'pre') DESC, n.created_at)
      FROM booking_notes n WHERE n.booking_id = v_b.id), '[]'::jsonb),
    'form', CASE WHEN NOT v_staff THEN NULL ELSE (
      SELECT jsonb_build_object('id', f.id, 'status', f.status, 'answers', f.answers,
               'blank', _booking_form_is_blank(f.answers), 'submitted_at', f.submitted_at,
               'form_key', f.form_key, 'plan_id', f.plan_id)
        FROM booking_forms f WHERE f.booking_id = v_b.id) END,

    -- LESSONPLAN: what this lesson is for. Private lane included only for staff.
    'plan',         _lesson_plan_json(v_plan, v_staff),
    'plan_next_up', lesson_plan_next_up(v_plan.objectives)
  );
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. GRANTS
-- ════════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public._lesson_plan_for_booking(uuid)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._lesson_plan_json(lesson_plans, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lesson_plan_next_up(jsonb)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.client_lesson_plan(uuid)                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lesson_plan_for_booking(uuid)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lesson_plans_for_day(date)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lesson_plan_roster()                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_lesson_plan()                        FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public._lesson_plan_for_booking(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public._lesson_plan_json(lesson_plans, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_plan_next_up(jsonb)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_lesson_plan(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_plan_for_booking(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_plans_for_day(date)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_plan_roster()                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_lesson_plan()                        TO authenticated;
