-- TASK LESSONPLAN m3 — THE LOOP CLOSES. Recording progress advances the plan,
-- and the next lesson inherits it.
--
-- Owner: "after the lesson when the progress is recorded the plan updates and
-- the next lesson gets its plans."
--
-- ── ONE WRITER FOR THE FORM, ONE WRITER FOR THE PLAN (D18) ──────────────────
-- record_lesson_progress() does NOT write booking_forms.answers itself. It calls
-- save_booking_form(), the writer TASK-LESSONFORM installed, which also keeps the
-- bookings.activity_log / bookings.notes projections the rider-facing surfaces
-- read. Building a second answers writer here is precisely the failure D18 was
-- written about, so the progress RPC composes with the existing engine instead of
-- reaching past it.
--
-- Symmetrically, _write_lesson_plan_version() is the ONLY thing that inserts a
-- lesson_plans row. Authoring a plan, advancing one after a lesson, and restoring
-- an earlier version all go through it, so "supersede the old one, number the new
-- one, log it" exists once.
--
-- ── NEVER SILENTLY OVERWRITE (§4), AND NEVER VERSION-SPAM EITHER ────────────
-- Every content change makes a NEW version and marks the prior one superseded,
-- retained. But a save that changes nothing makes NO version — otherwise the
-- history that exists to show what changed fills with rows where nothing did,
-- and the retention is worthless in the one moment it is needed. _lesson_plan_same()
-- is the test, and it is the same shape as the supersession rule already used for
-- documents.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE ONE INSERTER
-- ════════════════════════════════════════════════════════════════════════════
/** Write the next version of a client's plan and retire the previous one.
 *  Returns the new row. p_reason is a vocab code from status_events_vocab
 *  ('created' | 'revised' | 'advanced'), so the log says WHY the version exists. */
CREATE OR REPLACE FUNCTION public._write_lesson_plan_version(
  p_client_id  uuid,
  p_focus      text,
  p_objectives jsonb,
  p_coach_notes text,
  p_reason     text,
  p_detail     text DEFAULT NULL,
  p_from_booking uuid DEFAULT NULL)
RETURNS lesson_plans
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cur  lesson_plans%ROWTYPE;
  v_new  lesson_plans%ROWTYPE;
  v_org  uuid;
BEGIN
  SELECT c.org_id INTO v_org FROM clients c WHERE c.id = p_client_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'client not found'; END IF;

  v_cur := _current_lesson_plan(p_client_id);

  -- The prior version is RETAINED, marked superseded — never updated in place
  -- and never deleted. Same rule as a superseded document version.
  IF v_cur.id IS NOT NULL THEN
    UPDATE lesson_plans
       SET status = 'superseded', superseded_at = now()
     WHERE id = v_cur.id;
  END IF;

  INSERT INTO lesson_plans (org_id, client_id, version, status, supersedes_id,
                            focus, objectives, coach_notes,
                            advanced_from_booking_id, created_by)
  VALUES (v_org, p_client_id, coalesce(v_cur.version, 0) + 1, 'current', v_cur.id,
          nullif(btrim(coalesce(p_focus, '')), ''),
          _lesson_plan_objectives(p_objectives),
          nullif(btrim(coalesce(p_coach_notes, '')), ''),
          p_from_booking, auth.uid())
  RETURNING * INTO v_new;

  -- THE LOG. status_events, widened by m1 — not a fifth ledger, and it has a
  -- reader (client_lesson_plan's 'log'), which is the part D19 says is missing
  -- everywhere else.
  PERFORM log_status_event('lesson_plan', v_new.id, p_reason,
            coalesce(p_detail, 'Version ' || v_new.version), v_org);

  RETURN v_new;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. AUTHORING — Claire writes the plan (§1)
-- ════════════════════════════════════════════════════════════════════════════
-- p_coach_notes NULL means "leave the private notes as they are"; passing '' is
-- how they are cleared. The distinction matters because the plan editor and the
-- progress recorder are different screens and neither should silently blank a
-- field it does not show.
CREATE OR REPLACE FUNCTION public.save_lesson_plan(
  p_client_id   uuid,
  p_focus       text,
  p_objectives  jsonb DEFAULT '[]'::jsonb,
  p_coach_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_c    clients%ROWTYPE;
  v_cur  lesson_plans%ROWTYPE;
  v_objs jsonb;
  v_notes text;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;

  SELECT * INTO v_c FROM clients WHERE id = p_client_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'client not found in this org'; END IF;

  v_objs := _lesson_plan_objectives(p_objectives);
  v_cur  := _current_lesson_plan(p_client_id);
  v_notes := CASE WHEN p_coach_notes IS NULL THEN v_cur.coach_notes ELSE p_coach_notes END;

  IF v_cur.id IS NULL THEN
    PERFORM _write_lesson_plan_version(p_client_id, p_focus, v_objs, v_notes,
              'created', 'Plan started');
  ELSIF _lesson_plan_same(v_cur.focus, v_cur.objectives, v_cur.coach_notes,
                          p_focus, v_objs, v_notes) THEN
    -- nothing changed: no version, no log entry, no noise in the history
    NULL;
  ELSE
    PERFORM _write_lesson_plan_version(p_client_id, p_focus, v_objs, v_notes,
              'revised', 'Edited by staff');
  END IF;

  RETURN client_lesson_plan(p_client_id);
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. RECORDING PROGRESS — §3 and §4 in one call
-- ════════════════════════════════════════════════════════════════════════════
-- p_outcomes is an array of {id, state, note} against the objectives of the plan
-- this lesson carried, PLUS optionally {label, state, note} entries with no id,
-- which are appended as new objectives — because "what we should work on next"
-- is a thing Claire discovers during a lesson, and making her leave the form to
-- add it is how it stops being recorded.
--
-- WHAT IS PINNED AND WHY: booking_forms.plan_id is set to the version that was
-- IN FORCE when this lesson happened, not the version this call produces. The
-- lesson was taught against the old one; the new one is what the NEXT lesson
-- gets. Pinning the old one is what stops this lesson's write-up from silently
-- re-reading as if it had been taught against a plan written afterwards.
CREATE OR REPLACE FUNCTION public.record_lesson_progress(
  p_booking_id  uuid,
  p_answers     jsonb   DEFAULT '{}'::jsonb,
  p_outcomes    jsonb   DEFAULT '[]'::jsonb,
  p_next_focus  text    DEFAULT NULL,
  p_coach_notes text    DEFAULT NULL,
  p_submit      boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_b        bookings%ROWTYPE;
  v_taught   lesson_plans%ROWTYPE;
  v_base     lesson_plans%ROWTYPE;
  v_next     lesson_plans%ROWTYPE;
  v_objs     jsonb := '[]'::jsonb;
  v_o        jsonb;
  v_hit      jsonb;
  v_outcomes jsonb := coalesce(p_outcomes, '[]'::jsonb);
  v_focus    text;
  v_notes    text;
  v_advanced boolean := false;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  IF jsonb_typeof(v_outcomes) <> 'array' THEN
    RAISE EXCEPTION 'outcomes must be an array';
  END IF;

  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'lesson not found in this org'; END IF;
  IF v_b.client_id IS NULL THEN
    RAISE EXCEPTION 'this session has no client, so there is no plan to record progress against';
  END IF;

  -- ── 1. the record of what happened, through the ONE form writer ───────────
  -- The outcomes ride in the form's answers under their own key, so the write-up
  -- and the per-objective result are one saved thing and cannot half-land.
  PERFORM save_booking_form(
    p_booking_id,
    coalesce(p_answers, '{}'::jsonb) || jsonb_build_object('plan_progress', v_outcomes),
    p_submit);

  -- ── 2. two plans, and they are only the same thing the FIRST time ────────
  -- v_taught  what this lesson carried. It is what gets PINNED, and what the
  --           write-up is true about afterwards.
  -- v_base    where the plan is RIGHT NOW. It is what an advance moves on from.
  --
  -- On a first recording these are the same row. On a SECOND recording of the
  -- same lesson they are not, because the first one already advanced the plan —
  -- and advancing from v_taught again would re-derive a version the plan has
  -- already moved past, writing an identical version every time Claire re-saves
  -- and discarding any hand edit made in between. Objective ids are stable
  -- across versions, so the outcomes still land on the right objectives when
  -- applied to the current plan.
  v_taught := _lesson_plan_for_booking(p_booking_id);
  v_base   := _current_lesson_plan(v_b.client_id);
  IF v_base.id IS NULL THEN v_base := v_taught; END IF;

  IF v_taught.id IS NULL THEN
    -- No plan yet. Outcomes cannot mean anything (they name objectives that do
    -- not exist), so say so rather than inventing a plan out of them. A bare
    -- "next focus" is allowed and starts the plan — that is Claire finishing a
    -- first lesson and writing down where this rider is going.
    IF jsonb_array_length(v_outcomes) > 0 THEN
      RAISE EXCEPTION 'this client has no lesson plan yet — start one before recording progress against it';
    END IF;
    IF nullif(btrim(coalesce(p_next_focus, '')), '') IS NOT NULL
       OR nullif(btrim(coalesce(p_coach_notes, '')), '') IS NOT NULL THEN
      v_next := _write_lesson_plan_version(v_b.client_id, p_next_focus, '[]'::jsonb,
                  p_coach_notes, 'created', 'Started while recording this lesson', p_booking_id);
      v_advanced := true;
    END IF;
  ELSE
    -- ── 3. apply the outcomes, in order, to the plan's objectives ──────────
    FOR v_o IN SELECT jsonb_array_elements(coalesce(v_base.objectives, '[]'::jsonb)) LOOP
      SELECT x INTO v_hit
        FROM jsonb_array_elements(v_outcomes) AS x
       WHERE x ->> 'id' IS NOT NULL AND x ->> 'id' = v_o ->> 'id'
       LIMIT 1;
      IF v_hit IS NOT NULL THEN
        v_o := v_o
             || CASE WHEN nullif(btrim(coalesce(v_hit ->> 'state', '')), '') IS NOT NULL
                     THEN jsonb_build_object('state', lower(btrim(v_hit ->> 'state')))
                     ELSE '{}'::jsonb END
             || CASE WHEN v_hit ? 'note'
                     THEN jsonb_build_object('note', nullif(btrim(coalesce(v_hit ->> 'note', '')), ''))
                     ELSE '{}'::jsonb END;
        v_hit := NULL;
      END IF;
      v_objs := v_objs || jsonb_build_array(v_o);
    END LOOP;

    -- outcomes that name no existing objective but carry a label are NEW work
    FOR v_hit IN SELECT jsonb_array_elements(v_outcomes) LOOP
      IF nullif(btrim(coalesce(v_hit ->> 'label', '')), '') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM jsonb_array_elements(coalesce(v_base.objectives, '[]'::jsonb)) AS y
            WHERE y ->> 'id' = v_hit ->> 'id') THEN
        v_objs := v_objs || jsonb_build_array(jsonb_build_object(
          'label', btrim(v_hit ->> 'label'),
          'state', coalesce(nullif(btrim(coalesce(v_hit ->> 'state', '')), ''), 'planned'),
          'note',  nullif(btrim(coalesce(v_hit ->> 'note', '')), '')));
      END IF;
    END LOOP;

    v_objs  := _lesson_plan_objectives(v_objs);
    v_focus := coalesce(nullif(btrim(coalesce(p_next_focus, '')), ''), v_base.focus);
    v_notes := CASE WHEN p_coach_notes IS NULL THEN v_base.coach_notes ELSE p_coach_notes END;

    -- ── 4. advance, unless the plan ALREADY SAYS THIS ──────────────────────
    -- Compared against where the plan is now, not against what this lesson
    -- carried: re-saving a lesson that has already been recorded must be a
    -- no-op, not a fresh identical version.
    IF NOT _lesson_plan_same(v_base.focus, v_base.objectives, v_base.coach_notes,
                             v_focus, v_objs, v_notes) THEN
      v_next := _write_lesson_plan_version(v_b.client_id, v_focus, v_objs, v_notes,
                  'advanced', 'Advanced after the Riding Lesson on '
                              || to_char(v_b.starts_at, 'FMDD Mon YYYY'),
                  p_booking_id);
      v_advanced := true;
    END IF;
  END IF;

  -- ── 5. pin the version this lesson was taught against ────────────────────
  -- After the form save, because save_booking_form is what guarantees the row
  -- exists (it ensures the instance). Pinning is what freezes this lesson's copy
  -- so a later advance does not rewrite its history.
  IF v_taught.id IS NOT NULL THEN
    UPDATE booking_forms
       SET plan_id = v_taught.id, updated_at = now()
     WHERE booking_id = p_booking_id;
  END IF;

  -- ── 6. the lesson's own trail ────────────────────────────────────────────
  PERFORM log_status_event('offering', p_booking_id, 'progress_recorded',
            CASE WHEN v_advanced THEN 'Progress recorded; the plan advanced to version '
                                      || v_next.version
                 ELSE 'Progress recorded' END,
            v_b.org_id);

  RETURN jsonb_build_object(
    'booking_id',    p_booking_id,
    'plan_advanced', v_advanced,
    'taught_against', _lesson_plan_json(v_taught, true),
    'plan',          _lesson_plan_json(
                       CASE WHEN v_next.id IS NOT NULL THEN v_next
                            ELSE _current_lesson_plan(v_b.client_id) END, true),
    'form',          booking_form(p_booking_id));
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. UNDO — D19(4): a value-moving action must be reversible
-- ════════════════════════════════════════════════════════════════════════════
-- Restoring does NOT resurrect the old row (that would break the one-current
-- index and lose the fact that the intervening version ever existed). It writes
-- the old CONTENT forward as a new version, so the history reads
-- "v3 → v4 → v5 (restored from v3)" and every step is still there.
CREATE OR REPLACE FUNCTION public.restore_lesson_plan_version(p_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old lesson_plans%ROWTYPE;
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;

  SELECT * INTO v_old FROM lesson_plans WHERE id = p_plan_id AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'plan version not found in this org'; END IF;
  IF v_old.status = 'current' THEN
    RAISE EXCEPTION 'that version is already the current plan';
  END IF;

  PERFORM _write_lesson_plan_version(v_old.client_id, v_old.focus, v_old.objectives,
            v_old.coach_notes, 'revised',
            'Restored the plan as it stood at version ' || v_old.version);

  RETURN client_lesson_plan(v_old.client_id);
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. GRANTS
-- ════════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public._write_lesson_plan_version(uuid, text, jsonb, text, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_lesson_plan(uuid, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_lesson_progress(uuid, jsonb, jsonb, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_lesson_plan_version(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.save_lesson_plan(uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_lesson_progress(uuid, jsonb, jsonb, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_lesson_plan_version(uuid) TO authenticated;
-- _write_lesson_plan_version is deliberately NOT granted: it is the engine, and
-- the only callers are the three RPCs above.
