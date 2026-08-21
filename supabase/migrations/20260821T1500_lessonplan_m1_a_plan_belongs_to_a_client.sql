-- TASK LESSONPLAN m1 — THE PLAN. It belongs to a CLIENT, it is versioned, and
-- the lesson's copy of it hangs off the form instance that already exists.
--
-- Owner, 2026-08-21: "we also need a full lesson plan building for claire to use
-- to generate lesson plans for each client and then the lesson schedule updates
-- with the plan for that day and after the lesson when the progress is recorded
-- the plan updates and the next lesson gets its plans."
--
-- ════════════════════════════════════════════════════════════════════════════
-- WHAT ALREADY EXISTED, AND WHY THE PLAN IS NOT A booking_form (task §2)
-- ════════════════════════════════════════════════════════════════════════════
-- booking_forms (TASK-LESSONFORM) is ONE INSTANCE PER BOOKING. It is created by
-- trg_booking_form_lifecycle when a booking gains a client, it is retired with
-- its cancelled booking, and it is UNIQUE (booking_id). That is exactly right for
-- "what happened at this lesson" and exactly wrong for "the plan": a plan is per
-- CLIENT, outlives every individual lesson, and its whole job is to survive one
-- lesson and arrive at the next one changed. A plan stored as a booking_form
-- would die with the booking it was written on (D11's retire path) and would
-- have to be copied forward by hand from lesson to lesson — which is the "plan
-- that does not roll forward" the task calls a note.
--
-- SO THE SPLIT IS:
--   lesson_plans      the plan, per client, versioned. NEW — nothing in the
--                     system held a forward-looking, client-scoped record.
--   booking_forms     unchanged as the per-lesson record, and it gains ONE
--                     COLUMN (plan_id) — the lesson's pin to the plan version it
--                     was taught against. No second per-booking table, no rival
--                     answers store; progress still writes through
--                     save_booking_form(), the one writer LESSONFORM installed.
--
-- WHY VERSIONS RATHER THAN AN EDITABLE ROW: §4 says "never silently overwrite —
-- the prior plan state is retained and the change logged", and D27 says a record
-- is never locked but every change is logged. A version row IS the retention:
-- superseding is the supersession spine this codebase already runs on documents
-- (a newer version executing marks the prior one `superseded`, retained as
-- evidence). status_events carries the log. Nothing is destroyed to make a
-- change, and nothing is locked to prevent one.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE TABLE
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS lesson_plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id),
  /** THE SUBJECT. A plan is per client — the rider Claire is teaching. */
  client_id      uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  version        integer NOT NULL DEFAULT 1,
  status         text NOT NULL DEFAULT 'current'
                   CHECK (status IN ('current', 'superseded')),
  /** The version this one replaced. Reading supersedes_id backwards IS the
   *  history, which is why no separate history table exists. */
  supersedes_id  uuid REFERENCES lesson_plans(id),

  /** THE HEADLINE. One line: what this rider is working on right now. This is
   *  what a scheduled lesson shows on the day (§2) and what the rider sees. */
  focus          text,
  /** THE ORDERED WORK. An array — array ORDER is the "what comes next" the task
   *  asks for, and the first objective not yet achieved is next up.
   *  [{ id, label, state: planned|working|achieved, note }]
   *  `note` is RIDER-VISIBLE, deliberately: the plan is the thing the rider is
   *  meant to know. The staff-private lane is coach_notes, below. */
  objectives     jsonb NOT NULL DEFAULT '[]'::jsonb,
  /** STAFF ONLY. Never returned by my_lesson_plan(). §5's "client-visible
   *  content must not leak staff-private notes", answered with two named
   *  columns rather than a visibility rule nobody can see. */
  coach_notes    text,

  /** Set when this version was produced by recording progress on a lesson,
   *  NULL when Claire authored it directly. Makes the history read
   *  "advanced after the Riding Lesson on 21 Aug" instead of "v4". */
  advanced_from_booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,

  created_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid,
  superseded_at  timestamptz,

  CHECK (jsonb_typeof(objectives) = 'array'),
  UNIQUE (client_id, version)
);

COMMENT ON TABLE lesson_plans IS
  'LESSONPLAN: the riding plan for one client, versioned. Exactly one row per '
  'client has status=''current''; every earlier version is retained with '
  'status=''superseded'' and a supersedes_id chain back through the whole '
  'history. Recording progress on a lesson produces the next version '
  '(record_lesson_progress), which is what makes the next lesson carry an '
  'updated plan. Nothing here is ever updated in place except the transition '
  'to superseded.';

COMMENT ON COLUMN lesson_plans.objectives IS
  'Ordered array of {id, label, state, note}. state is planned|working|achieved. '
  'Array order is the running order — the first non-achieved objective is what '
  'comes next. note is RIDER-VISIBLE; coach_notes is the staff-private lane.';

/** ONE current plan per client. The whole design rests on this: "the plan" is
 *  a well-defined thing to look up, and an advance is a swap under this index
 *  rather than a race between two rows both claiming to be current. */
CREATE UNIQUE INDEX IF NOT EXISTS lesson_plans_one_current_idx
  ON lesson_plans (client_id) WHERE status = 'current';
CREATE INDEX IF NOT EXISTS lesson_plans_client_idx
  ON lesson_plans (client_id, version DESC);
CREATE INDEX IF NOT EXISTS lesson_plans_org_idx
  ON lesson_plans (org_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE lesson_plans ENABLE ROW LEVEL SECURITY;

-- Staff read every plan in their own org. coalesce per D1a: the platform account
-- has a NULL current_org() and must come out FALSE, not NULL.
DROP POLICY IF EXISTS lesson_plans_staff_read ON lesson_plans;
CREATE POLICY lesson_plans_staff_read ON lesson_plans
  FOR SELECT TO authenticated
  USING (coalesce(org_id = current_org() AND has_staff_access(), false));

-- THE RIDER GETS NO ROW POLICY AT ALL, and that is the point.
--
-- `coach_notes` is a column on this table. A "the rider may read their own plan"
-- policy would be true of the ROW, which means true of that column too — and
-- `supabase.from('lesson_plans').select('*')` would hand a rider the private
-- notes their instructor keeps about them. §5 says client-visible content must
-- not leak staff-private notes; the only way to mean that is for the rider to
-- have no read on the table and to go through my_lesson_plan(), which is
-- SECURITY DEFINER and builds its payload field by field.
--
-- (An earlier draft of this migration DID add that policy, with a comment saying
-- the distinction was enforced at the RPC. It was not: the RPC was simply the
-- only caller, which is a different and much weaker thing.)
DROP POLICY IF EXISTS lesson_plans_own_read ON lesson_plans;

-- Every write goes through the SECURITY DEFINER RPCs in m3. There is no
-- PostgREST write path to a plan — D18: no second writer beside the engine.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON lesson_plans FROM authenticated;
REVOKE ALL ON lesson_plans FROM anon;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. THE LESSON'S PIN — one column on the instance that already exists
-- ════════════════════════════════════════════════════════════════════════════
-- NULL means "this lesson shows whatever the client's plan is right now", which
-- is what a lesson that has not happened yet should do — that is how the NEXT
-- lesson inherits an updated plan with no scheduling machinery and nothing to
-- keep in step. It is SET when progress is recorded, pinning the version that
-- was actually taught against, which is what makes the history true afterwards.
ALTER TABLE booking_forms
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES lesson_plans(id);

COMMENT ON COLUMN booking_forms.plan_id IS
  'LESSONPLAN: the plan version this lesson was TAUGHT AGAINST, pinned when '
  'progress is recorded. NULL while the lesson is still ahead — an unheld '
  'lesson resolves the client''s current plan live, which is exactly how the '
  'next lesson picks up a plan that changed after the last one.';

CREATE INDEX IF NOT EXISTS booking_forms_plan_idx
  ON booking_forms (plan_id) WHERE plan_id IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. THE LOG — status_events, widened by one entity kind (not a sixth ledger)
-- ════════════════════════════════════════════════════════════════════════════
-- Same move stage5 made for 'fulfillment': widen the CHECK, add vocab, reuse
-- log_status_event(). D19's complaint is that four ledgers are written and never
-- read back to a human — so m2 also gives these events a reader
-- (lesson_plan_history), and the plan surface renders it.
--
-- Every code here is is_true_status=false (a log entry, not a lifecycle state).
-- That is deliberate: a plan version's real state is lesson_plans.status, and
-- log_status_event()'s denormalizing branch has no table to write for this
-- entity kind. Marking them sub-status means that branch is never entered, so
-- log_status_event needs no change at all.
ALTER TABLE status_events_vocab DROP CONSTRAINT IF EXISTS status_events_vocab_entity_type_check;
ALTER TABLE status_events_vocab ADD CONSTRAINT status_events_vocab_entity_type_check
  CHECK (entity_type IN ('account','document','order','offering','fulfillment','lesson_plan'));
ALTER TABLE status_events DROP CONSTRAINT IF EXISTS status_events_entity_type_check;
ALTER TABLE status_events ADD CONSTRAINT status_events_entity_type_check
  CHECK (entity_type IN ('account','document','order','offering','fulfillment','lesson_plan'));

INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES ('lesson_plan','created','Plan started',false,false,10),
       ('lesson_plan','revised','Plan revised',false,false,20),
       ('lesson_plan','advanced','Plan advanced after a lesson',false,false,30),
       ('lesson_plan','scrubbed','Content scrubbed',false,false,90)
ON CONFLICT (entity_type, code) DO UPDATE
  SET display_name = excluded.display_name, is_true_status = excluded.is_true_status,
      is_terminal = excluded.is_terminal, sort_order = excluded.sort_order;

-- 'progress_recorded' on the lesson itself, so the lesson's own trail says the
-- work was written up. entity_type 'offering' is what bookings already log under.
INSERT INTO status_events_vocab (entity_type, code, display_name, is_true_status, is_terminal, sort_order)
VALUES ('offering','progress_recorded','Progress recorded',false,false,23)
ON CONFLICT (entity_type, code) DO UPDATE
  SET display_name = excluded.display_name, is_true_status = excluded.is_true_status,
      is_terminal = excluded.is_terminal, sort_order = excluded.sort_order;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. HELPERS
-- ════════════════════════════════════════════════════════════════════════════

/** Normalise and validate an objectives array. Rejects the shapes that would
 *  make a plan unreadable rather than storing them and discovering it on a
 *  screen: a non-array, an entry that is not an object, a blank label, an
 *  unknown state. Fills in a stable id for any entry that arrives without one
 *  (Claire adding a line in the browser) so that progress can be recorded
 *  against it later by id and not by its label, which she may reword. */
CREATE OR REPLACE FUNCTION public._lesson_plan_objectives(p_objectives jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  v_in  jsonb := coalesce(p_objectives, '[]'::jsonb);
  v_out jsonb := '[]'::jsonb;
  v_e   jsonb;
  v_lbl text;
  v_st  text;
BEGIN
  IF jsonb_typeof(v_in) <> 'array' THEN
    RAISE EXCEPTION 'objectives must be an array';
  END IF;

  FOR v_e IN SELECT jsonb_array_elements(v_in) LOOP
    IF jsonb_typeof(v_e) <> 'object' THEN
      RAISE EXCEPTION 'each objective must be an object';
    END IF;
    v_lbl := btrim(coalesce(v_e ->> 'label', ''));
    CONTINUE WHEN v_lbl = '';          -- a blank line Claire left behind is not an objective
    v_st := lower(btrim(coalesce(v_e ->> 'state', 'planned')));
    IF v_st NOT IN ('planned', 'working', 'achieved') THEN
      RAISE EXCEPTION 'unknown objective state: %', v_st;
    END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'id',    coalesce(nullif(btrim(coalesce(v_e ->> 'id', '')), ''), gen_random_uuid()::text),
      'label', v_lbl,
      'state', v_st,
      'note',  nullif(btrim(coalesce(v_e ->> 'note', '')), '')
    ));
  END LOOP;

  RETURN v_out;
END;
$function$;

/** The client's live plan row, or NULL. One place that knows what "the plan"
 *  means, so no caller re-derives it. */
CREATE OR REPLACE FUNCTION public._current_lesson_plan(p_client_id uuid)
RETURNS lesson_plans
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.* FROM lesson_plans p
   WHERE p.client_id = p_client_id AND p.status = 'current'
   LIMIT 1
$function$;

/** True when two plan bodies say the same thing. Used to refuse a no-op version:
 *  "never silently overwrite" must not become "a new version every time a screen
 *  saves", which would bury the real changes in the history it exists to show. */
CREATE OR REPLACE FUNCTION public._lesson_plan_same(
  p_a_focus text, p_a_objectives jsonb, p_a_notes text,
  p_b_focus text, p_b_objectives jsonb, p_b_notes text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT coalesce(btrim(coalesce(p_a_focus, '')) = btrim(coalesce(p_b_focus, '')), false)
     AND coalesce(p_a_objectives, '[]'::jsonb) = coalesce(p_b_objectives, '[]'::jsonb)
     AND coalesce(btrim(coalesce(p_a_notes, '')) = btrim(coalesce(p_b_notes, '')), false)
$function$;

REVOKE ALL ON FUNCTION public._lesson_plan_objectives(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._current_lesson_plan(uuid)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._lesson_plan_same(text, jsonb, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._lesson_plan_objectives(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._current_lesson_plan(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public._lesson_plan_same(text, jsonb, text, text, jsonb, text) TO authenticated;
