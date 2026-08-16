-- TASK LESSONFORM m3 — Claire's surface, server side: find it, fill it, discard it.
--
-- ONE WRITER. save_booking_form() is the only thing that writes a form's answers,
-- and it also writes the two projections the rider-facing surfaces already read
-- (bookings.activity_log, bookings.notes). The two RPCs that used to write those
-- columns directly — set_booking_log() and set_lesson_progress_note() — are
-- re-pointed THROUGH it rather than left as rival writers, so there is no way for
-- the form and the projection to disagree. Both keep their signatures; every
-- existing caller keeps working and now feeds the instance.
--
-- ONE NO-SHOW WRITER TOO. Marking the participant a no-show on the form does not
-- write bookings.status itself — it calls cancel_lesson_session(p_no_show => true),
-- which is the function that already owns that transition (and already leaves the
-- member un-notified for a no-show, which is right: a no-show is a staff record).
-- That is the seam TASK-FEECHOICE reads: see the report.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. READ — one booking's form, its definition, and its live checklist
-- ════════════════════════════════════════════════════════════════════════════
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
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  IF NOT coalesce(has_staff_access() AND v_b.org_id = current_org(), false) THEN
    RAISE EXCEPTION 'operator access required';
  END IF;

  SELECT * INTO v_f FROM booking_forms WHERE booking_id = p_booking_id;
  v_service := coalesce(v_f.service_type, booking_service_type(v_b));
  v_key     := coalesce(v_f.form_key, booking_form_key(v_service));

  RETURN jsonb_build_object(
    'booking_id',   v_b.id,
    'kind',         v_b.kind,
    'starts_at',    v_b.starts_at,
    'ends_at',      v_b.ends_at,
    'booking_status', upper(v_b.status),
    'service_type', v_service,
    -- the checklist is resolved LIVE from activity_checklists, never baked into
    -- the definition, so editing the checklist still edits the form (D13).
    'checklist',    activity_checklist(v_service),
    'definition',   (SELECT jsonb_build_object('form_key', fd.form_key, 'title', fd.title,
                              'purpose', fd.purpose, 'version', fd.version, 'schema', fd.schema)
                       FROM form_definitions fd WHERE fd.form_key = v_key),
    -- null when Claire has discarded it, or when the booking is not one a form
    -- applies to. An absent form is not an error state.
    'form',         CASE WHEN v_f.id IS NULL THEN NULL ELSE jsonb_build_object(
                      'id', v_f.id, 'status', v_f.status, 'answers', v_f.answers,
                      'blank', _booking_form_is_blank(v_f.answers),
                      'submitted_at', v_f.submitted_at, 'retired_at', v_f.retired_at,
                      'created_at', v_f.created_at, 'updated_at', v_f.updated_at) END,
    -- whether the no-show option is offerable at all right now. cancel_lesson_session
    -- owns that transition and accepts only a SCHEDULED lesson.
    'can_mark_no_show', v_b.kind = 'lesson' AND v_b.status = 'scheduled'
  );
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. WRITE — save (and optionally submit) one form
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.save_booking_form(
  p_booking_id uuid,
  p_answers    jsonb,
  p_submit     boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_b        bookings%ROWTYPE;
  v_f        booking_forms%ROWTYPE;
  v_id       uuid;
  v_merged   jsonb;
  v_no_show  boolean;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  IF jsonb_typeof(coalesce(p_answers, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'answers must be an object';
  END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found in this org'; END IF;

  -- The retired check comes BEFORE the ensure, deliberately. A retired form sits
  -- on a booking a form no longer "applies" to (it was cancelled), so ensuring
  -- first would return NULL and report "this booking has no activity form" —
  -- true of the booking, and wrong about the form, which is right there being
  -- kept as a record. Caught by the test of the same name.
  SELECT * INTO v_f FROM booking_forms WHERE booking_id = p_booking_id;
  IF FOUND AND v_f.status = 'retired' THEN
    RAISE EXCEPTION 'this form was retired with its cancelled booking and is kept as a record';
  END IF;

  v_id := _ensure_booking_form(v_b);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'this booking has no activity form (a form applies to an assigned lesson or care session)';
  END IF;

  SELECT * INTO v_f FROM booking_forms WHERE id = v_id;

  -- shallow merge: a partial save never wipes a field it did not mention, and
  -- clearing a field is sending it as '' (which _booking_form_is_blank still
  -- reads as untouched — a cleared textarea is not a record).
  v_merged := coalesce(v_f.answers, '{}'::jsonb) || coalesce(p_answers, '{}'::jsonb);

  UPDATE booking_forms
     SET answers      = v_merged,
         status       = CASE WHEN p_submit THEN 'submitted' ELSE status END,
         submitted_at = CASE WHEN p_submit THEN now() ELSE submitted_at END,
         submitted_by = CASE WHEN p_submit THEN auth.uid() ELSE submitted_by END,
         updated_at   = now()
   WHERE id = v_id;

  -- ── the projections the rider-facing surfaces already read ────────────────
  -- One-way, written here and nowhere else. Same pattern as current_status on
  -- documents/purchases/bookings: the record is the instance, the column is a
  -- denormalized read.
  UPDATE bookings
     SET activity_log = jsonb_build_object(
           'activities', coalesce(v_merged -> 'activities', '[]'::jsonb),
           'text',       nullif(btrim(coalesce(v_merged ->> 'log_text', '')), '')),
         notes = nullif(btrim(coalesce(v_merged ->> 'report', '')), '')
   WHERE id = p_booking_id;

  -- ── attendance ────────────────────────────────────────────────────────────
  v_no_show := coalesce(v_merged ->> 'attendance', '') = 'no_show';
  IF v_no_show AND v_b.status = 'scheduled' THEN
    IF v_b.kind <> 'lesson' THEN
      -- cancel_lesson_session is lesson-only. A care no-show is a real gap and is
      -- named in the report rather than written around here with a second writer.
      RAISE EXCEPTION 'no-show can only be recorded on a lesson booking today';
    END IF;
    PERFORM cancel_lesson_session(p_booking_id, true);
  ELSIF v_no_show AND v_b.status <> 'no_show' THEN
    RAISE EXCEPTION 'only a SCHEDULED lesson can be marked a no-show (this one is %)', upper(v_b.status);
  END IF;

  RETURN booking_form(p_booking_id);
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. DISCARD — "delete them if she doesnt want to fill it in"
-- ════════════════════════════════════════════════════════════════════════════
-- Same rule as the cancel path, for the same reason: a blank records nothing and
-- is deleted; one that has been written in is a record and is retired (D11). The
-- booking is untouched either way — discarding a form never cancels a lesson.
CREATE OR REPLACE FUNCTION public.discard_booking_form(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_b     bookings%ROWTYPE;
  v_f     booking_forms%ROWTYPE;
  v_blank boolean;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found in this org'; END IF;

  SELECT * INTO v_f FROM booking_forms WHERE booking_id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('booking_id', p_booking_id, 'outcome', 'none');
  END IF;

  v_blank := _booking_form_is_blank(v_f.answers);

  IF v_blank THEN
    DELETE FROM booking_forms WHERE id = v_f.id;
    RETURN jsonb_build_object('booking_id', p_booking_id, 'outcome', 'deleted');
  END IF;

  UPDATE booking_forms
     SET status = 'retired', retired_at = now(), retired_by = auth.uid(), updated_at = now()
   WHERE id = v_f.id;
  RETURN jsonb_build_object('booking_id', p_booking_id, 'outcome', 'retired');
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. FIND — the backlog. "find the forms to fill out for the past lessons"
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.lesson_forms(p_scope text DEFAULT 'todo')
RETURNS TABLE (
  form_id        uuid,
  booking_id     uuid,
  starts_at      timestamptz,
  ends_at        timestamptz,
  client_id      uuid,
  client_name    text,
  service_type   text,
  booking_kind   text,
  booking_status text,
  form_status    text,
  has_answers    boolean,
  submitted_at   timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT f.id, b.id, b.starts_at, b.ends_at, b.client_id,
         nullif(btrim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
         f.service_type, b.kind, upper(b.status), f.status,
         NOT _booking_form_is_blank(f.answers), f.submitted_at
    FROM booking_forms f
    JOIN bookings b  ON b.id = f.booking_id
    LEFT JOIN clients cl ON cl.id = b.client_id
    LEFT JOIN contacts c ON c.id = cl.contact_id
   WHERE coalesce(has_staff_access() AND f.org_id = current_org(), false)
     AND CASE coalesce(p_scope, 'todo')
           -- the working list: a lesson that has already happened and whose form
           -- nobody has finished. Retired and submitted forms are out of it.
           WHEN 'todo'     THEN f.status = 'open' AND b.starts_at <= now()
           WHEN 'past'     THEN f.status <> 'retired' AND b.starts_at <= now()
           WHEN 'upcoming' THEN f.status <> 'retired' AND b.starts_at > now()
           WHEN 'retired'  THEN f.status = 'retired'
           ELSE true  -- 'all'
         END
   ORDER BY CASE WHEN coalesce(p_scope, 'todo') = 'upcoming' THEN b.starts_at END ASC,
            b.starts_at DESC
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. THE OLD WRITERS, RE-POINTED (no rival writer left behind)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_booking_log(p_booking_id uuid, p_activities jsonb, p_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- LESSONFORM: was a direct UPDATE of bookings.activity_log. Now it writes the
  -- form instance, which writes that column as its projection. Same signature,
  -- same visible effect, one writer.
  PERFORM save_booking_form(p_booking_id, jsonb_build_object(
    'activities', coalesce(p_activities, '[]'::jsonb),
    'log_text',   coalesce(nullif(btrim(coalesce(p_text, '')), ''), '')));
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_lesson_progress_note(p_session_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- LESSONFORM: as above, for the rider-visible report (bookings.notes).
  PERFORM save_booking_form(p_session_id,
    jsonb_build_object('report', coalesce(nullif(btrim(coalesce(p_note, '')), ''), '')));
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. booking_report — carries the form for staff, and stops leaking the log
-- ════════════════════════════════════════════════════════════════════════════
-- Pre-existing and fixed here because this migration is the one that makes the
-- staff log a named field: booking_report() returned activity_log WHOLESALE to the
-- booking's client, including `text`, which is the instructor's own working record
-- (LessonLogEditor labels it "Log (instructor record)" against "Instructor notes
-- (the rider sees this)"). The rider's SessionNotesView only ever rendered
-- `activities`, so nothing on screen changes — but the field was on the wire.
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
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;

  v_staff := coalesce(has_staff_access() AND v_b.org_id = current_org(), false);
  IF NOT (v_staff OR (v_client IS NOT NULL AND v_b.client_id = v_client)) THEN
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
    -- staff only: the instance itself, so a surface that already loads the report
    -- does not need a second round trip to know whether a form is outstanding.
    'form', CASE WHEN NOT v_staff THEN NULL ELSE (
      SELECT jsonb_build_object('id', f.id, 'status', f.status, 'answers', f.answers,
               'blank', _booking_form_is_blank(f.answers), 'submitted_at', f.submitted_at,
               'form_key', f.form_key)
        FROM booking_forms f WHERE f.booking_id = v_b.id) END
  );
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. GRANTS — anon gets nothing new
-- ════════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.booking_form(uuid)                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_booking_form(uuid, jsonb, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.discard_booking_form(uuid)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lesson_forms(text)                   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_form(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_booking_form(uuid, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.discard_booking_form(uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.lesson_forms(text)                   TO authenticated;
