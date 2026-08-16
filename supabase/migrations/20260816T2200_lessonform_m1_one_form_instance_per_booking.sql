-- TASK LESSONFORM m1 — THE INSTANCE. One activity form per booking, as a real row.
--
-- Owner: "each booking is assigned a form with an actual link between them. this makes
-- it possible for claire to find the forms to fill out for the past lessons, delete them
-- if she doesnt want to fill it in, or they move automatically when a booking is
-- rescheduled and they automatically self delete when the booking is cancelled and is
-- regenerated when a new booking is added as a replacement for the cancelled one."
--
-- WHAT WAS MEASURED ON PROD BEFORE WRITING THIS (2026-08-16):
--   form_definitions      27 rows — 15 INTAKE_* (audience CLIENT, filled once per
--                         client at intake) and 12 ENGAGEMENT_* (audience COMPANY,
--                         filled once per engagement). NONE of the 27 is a per-session
--                         activity form, and none can become one: an intake form is
--                         answered before the service starts and an engagement form is
--                         answered when the engagement is created. The task said to say
--                         so rather than invent a fit — this migration says so, and
--                         seeds exactly ONE new definition (below) rather than bending
--                         an existing row into a shape it was not built for.
--   activity_checklists   31 rows across 5 service types (RIDING_LESSON 8,
--                         JUMPER_TRAINING 6, HORSE_TRAINING 6, HORSE_EXERCISE 6,
--                         HORSEMANSHIP_TRAINING 5). NOT DEAD — they become the
--                         "What we did" field of the form instance, resolved LIVE per
--                         the booking's own service type (activity_checklist()), never
--                         baked into the definition. Editing the checklist therefore
--                         still changes the form (D13).
--   booking_notes         correct shape, 0 rows — but the task doc's claim that "no
--                         client code references it" is FALSE on current main:
--                         add_booking_note() is called from src/lib/ops/api-member.ts
--                         and src/lib/ops/api-lessons.ts, and booking_report() reads
--                         the thread back. It is the AUTHORED CONVERSATION between
--                         rider and instructor (pre/post, uneditable, one row per
--                         utterance) — a different thing from a form's answers, which
--                         are keyed, revisable, and belong to one instance. It stays
--                         alive and is NOT the response store; see the report.
--
-- WHY A NEW TABLE AND NOT booking_notes: a note has no field key, no form linkage, no
-- lifecycle, and is deliberately append-only. Storing "activities = [Warm-up, Canter
-- work]" as a note body would make the answers unreadable and unrevisable. One row per
-- instance is also what makes "move it / retire it / delete it" a single-row operation.
--
-- WHY NOT A GENERIC form_responses TABLE: the only subject that has a lifecycle spec is
-- a booking. A polymorphic response table would be two-thirds unused, which is the
-- exact trap this task names ("do not leave a third unused table behind"). Intake-form
-- responses remain unstored — a real, separate gap, stated in the report.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE DEFINITION — the one form that did not exist
-- ════════════════════════════════════════════════════════════════════════════
-- audience is COMPANY because form_definitions_audience_check permits only
-- CLIENT | COMPANY, and this is the staff-side record of what happened. No
-- constraint is widened for it.
--
-- The checklist field carries "source": "activity_checklists" instead of a baked
-- options list. The renderer resolves it through activity_checklist(service_type),
-- so the 31 checklist rows stay the editable source of truth and one definition
-- serves every service.
INSERT INTO form_definitions (form_key, audience, title, purpose, schema, version, active)
VALUES (
  'ACTIVITY_SESSION',
  'COMPANY',
  'Session Activity Form',
  'Filled in during or after a lesson or care session — attendance, what was worked on, the instructor record, and the notes the rider sees.',
  jsonb_build_object('sections', jsonb_build_array(
    jsonb_build_object(
      'heading', 'Attendance',
      'fields', jsonb_build_array(
        jsonb_build_object(
          'key', 'attendance', 'type', 'radio', 'label', 'Did the participant attend?',
          'options', jsonb_build_array('attended', 'no_show'),
          'option_labels', jsonb_build_array('Attended', 'No-show'),
          'help', 'Recording a no-show sets the booking to NO_SHOW — the fact the $75 no-show fee (Company Policies §6) rests on.'
        )
      )
    ),
    jsonb_build_object(
      'heading', 'What we did',
      'fields', jsonb_build_array(
        jsonb_build_object(
          'key', 'activities', 'type', 'checklist', 'label', 'Activities',
          'source', 'activity_checklists',
          'help', 'The list comes from this service''s activity checklist and is edited there, not here.'
        )
      )
    ),
    jsonb_build_object(
      'heading', 'Instructor record',
      'fields', jsonb_build_array(
        jsonb_build_object('key', 'log_text', 'type', 'textarea',
          'label', 'Log (instructor record)', 'visibility', 'staff')
      )
    ),
    jsonb_build_object(
      'heading', 'Notes for the rider',
      'fields', jsonb_build_array(
        jsonb_build_object('key', 'report', 'type', 'textarea',
          'label', 'Instructor notes (the rider sees this)', 'visibility', 'client')
      )
    )
  )),
  1,
  true
)
ON CONFLICT (form_key) DO UPDATE
  SET title = EXCLUDED.title, purpose = EXCLUDED.purpose,
      schema = EXCLUDED.schema, active = true, updated_at = now();

-- ════════════════════════════════════════════════════════════════════════════
-- 2. THE INSTANCE TABLE
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS booking_forms (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES organizations(id),
  /** THE LINK. ON DELETE CASCADE is deliberate and agrees with
   *  delete_calendar_item: that RPC hard-DELETEs a booking only when it carries no
   *  client, purchase, credit or change request — i.e. only when there is nothing
   *  to keep. A form on such a booking has nothing to keep either. Every other
   *  path in that RPC soft-deletes, and the lifecycle trigger (m2) retires the
   *  form instead. */
  booking_id         uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  form_key           text NOT NULL,
  form_definition_id uuid REFERENCES form_definitions(id) ON DELETE SET NULL,
  /** resolved once, at creation, so a later offering change cannot silently
   *  re-point a half-written form at a different checklist. */
  service_type       text,
  status             text NOT NULL DEFAULT 'open'
                       CHECK (status IN ('open', 'submitted', 'retired')),
  answers            jsonb NOT NULL DEFAULT '{}'::jsonb
                       CHECK (jsonb_typeof(answers) = 'object'),
  submitted_at       timestamptz,
  submitted_by       uuid,
  retired_at         timestamptz,
  retired_by         uuid,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  /** ONE instance per booking. A replacement booking is a different booking_id
   *  and therefore gets its own row — which is exactly what "regenerated when a
   *  new booking is added as a replacement" means. */
  UNIQUE (booking_id)
);

COMMENT ON TABLE booking_forms IS
  'LESSONFORM: one activity-form INSTANCE per serviced booking. The link is booking_id, '
  'which is why a reschedule moves the form for free (a reschedule edits the booking''s '
  'times in place and never changes its id). answers is the record; bookings.activity_log '
  'and bookings.notes are one-way projections written by save_booking_form so the '
  'rider-facing surfaces that already read them keep working.';

COMMENT ON COLUMN booking_forms.status IS
  'open = exists, may be blank or partly filled (never an error state — many lessons '
  'will never get one). submitted = Claire says it is done. retired = its booking was '
  'cancelled and the form had been written in, so it is kept as evidence (D11) instead '
  'of deleted. A blank form on a cancelled booking is hard-deleted and has no row here.';

COMMENT ON COLUMN booking_forms.answers IS
  'Keyed by the definition''s field keys: attendance | activities | log_text | report.';

CREATE INDEX IF NOT EXISTS booking_forms_booking_idx ON booking_forms (booking_id);
CREATE INDEX IF NOT EXISTS booking_forms_outstanding_idx
  ON booking_forms (org_id, status) WHERE status = 'open';

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- The instance carries the STAFF record (log_text), so it is staff-only at rest.
-- The rider's view of a session is unchanged: it still comes from booking_report(),
-- which returns only the rider-visible projection.
ALTER TABLE booking_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_forms_staff_read ON booking_forms;
CREATE POLICY booking_forms_staff_read ON booking_forms
  FOR SELECT TO authenticated
  -- coalesce, per D1a: the platform account has a NULL current_org() and must
  -- come out FALSE, not NULL.
  USING (coalesce(org_id = current_org() AND has_staff_access(), false));

-- Every write goes through the SECURITY DEFINER RPCs in m3.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON booking_forms FROM authenticated;
REVOKE ALL ON booking_forms FROM anon;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. HELPERS
-- ════════════════════════════════════════════════════════════════════════════

/** Which definition a booking's form is drawn from. Per-service by construction:
 *  an ACTIVITY_<SERVICE_TYPE> definition wins if one exists, so the owner can add
 *  a bespoke riding-lesson form later through the forms surface and it takes over
 *  with no code change (D13). Today only the generic ACTIVITY_SESSION exists. */
CREATE OR REPLACE FUNCTION public.booking_form_key(p_service_type text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (SELECT fd.form_key FROM form_definitions fd
      WHERE fd.active AND p_service_type IS NOT NULL
        AND fd.form_key = 'ACTIVITY_' || p_service_type),
    'ACTIVITY_SESSION')
$function$;

/** True when nothing has been written into the form. Drives the one rule the task
 *  set: a form with answers is evidence and is RETIRED; an untouched blank records
 *  nothing and is genuinely deleted. Empty strings, empty arrays and empty objects
 *  all count as untouched — a cleared textarea is not a record. */
CREATE OR REPLACE FUNCTION public._booking_form_is_blank(p_answers jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT NOT EXISTS (
    SELECT 1
    FROM jsonb_each(CASE WHEN jsonb_typeof(p_answers) = 'object'
                         THEN p_answers ELSE '{}'::jsonb END) AS e(k, v)
    WHERE CASE jsonb_typeof(e.v)
            WHEN 'null'   THEN false
            WHEN 'string' THEN btrim(e.v #>> '{}') <> ''
            WHEN 'array'  THEN jsonb_array_length(e.v) > 0
            WHEN 'object' THEN e.v <> '{}'::jsonb
            ELSE true
          END
  )
$function$;

/** The booking states in which a form is meant to exist. A slot nobody has taken
 *  (available), a draft, or a dead booking has nothing to record. A COMPLETED or
 *  NO_SHOW lesson very much does — that is the backlog Claire is asked to work
 *  through. */
CREATE OR REPLACE FUNCTION public.booking_form_applies(p_booking bookings)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT p_booking.kind IN ('lesson', 'care')
     AND p_booking.client_id IS NOT NULL
     AND p_booking.deleted_at IS NULL
     AND p_booking.status IN ('pending', 'pending_slot', 'pending_payment',
                              'confirmed', 'scheduled', 'completed', 'no_show')
$function$;

REVOKE ALL ON FUNCTION public.booking_form_key(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._booking_form_is_blank(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.booking_form_applies(bookings) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_form_key(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public._booking_form_is_blank(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.booking_form_applies(bookings) TO authenticated;
