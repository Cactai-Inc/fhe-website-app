-- TASK LESSONFORM m2 — THE LIFECYCLE. Created on assignment, moves on reschedule,
-- dies on cancel, regenerated for a replacement.
--
-- ── WHY RESCHEDULE NEEDS NO CODE AT ALL ──────────────────────────────────────
-- "the form moves with it … the SAME instance with its partial answers intact."
-- Every reschedule path in this system edits the booking's times IN PLACE and
-- never changes bookings.id:
--   decide_booking_change()  — request_kind IN ('reschedule','new') applies a
--                              delta:  UPDATE bookings SET starts_at = r.starts_at
--                              + v_delta, ends_at = … WHERE id = rid
--   save_calendar_item()     — the EDIT branch: UPDATE bookings SET starts_at =
--                              v_s, ends_at = v_e … WHERE id = v_row.id
--   gift_reschedule()        — same shape
-- Because the link is booking_id, the instance and every partial answer follow
-- the booking for free. Building a "move the form" step would have been building
-- a way for it to get out of step. The test proves the id and the answers survive.
--
-- ── WHAT CANCEL DOES, AND WHY IT IS NOT ALWAYS A DELETE ──────────────────────
-- The owner said the form should "self delete" on cancel. D11 says nothing in this
-- system is purged, and the task told me to resolve that explicitly: a form that
-- has been WRITTEN IN is a record of what happened at a lesson, so it is RETIRED
-- (kept, hidden from the working views); a form that is UNTOUCHED records nothing,
-- so it is genuinely DELETED. That is not a new invention — it is exactly the rule
-- delete_calendar_item() already applies to bookings themselves: a booking with
-- history (client / purchase / credit / change request) is soft-deleted, one with
-- none is `DELETE FROM bookings`. The form now agrees with its booking instead of
-- contradicting it. If the owner wants written-in forms gone too, that is a
-- one-line change here and nothing else.
--
-- ── WHY "REGENERATED FOR A REPLACEMENT" NEEDS NO REPLACEMENT-DETECTION ───────
-- A replacement booking is a new bookings row, and the ensure branch below fires
-- on any serviced booking that gains a client. There is no need to know that it
-- replaced anything — and no way for the system to be wrong about it.

-- ════════════════════════════════════════════════════════════════════════════
-- 1. ENSURE — create (or revive) the instance for one booking
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._ensure_booking_form(p_booking bookings)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id      uuid;
  v_status  text;
  v_service text;
  v_key     text;
BEGIN
  IF NOT booking_form_applies(p_booking) THEN
    RETURN NULL;
  END IF;

  SELECT bf.id, bf.status INTO v_id, v_status
    FROM booking_forms bf WHERE bf.booking_id = p_booking.id;

  IF FOUND THEN
    -- A booking coming back from cancelled (staff put it back on the calendar)
    -- gets its retired form back, in the state it was in. A form Claire DELETED
    -- has no row and does not come back — deleting it is her decision, and the
    -- ensure branch only fires on a transition INTO a live state, which a
    -- discard is not.
    IF v_status = 'retired' THEN
      UPDATE booking_forms
         SET status = CASE WHEN submitted_at IS NOT NULL THEN 'submitted' ELSE 'open' END,
             retired_at = NULL, retired_by = NULL, updated_at = now()
       WHERE id = v_id;
    END IF;
    RETURN v_id;
  END IF;

  v_service := booking_service_type(p_booking);
  v_key     := booking_form_key(v_service);

  INSERT INTO booking_forms (org_id, booking_id, form_key, form_definition_id, service_type)
  VALUES (p_booking.org_id, p_booking.id, v_key,
          (SELECT fd.id FROM form_definitions fd WHERE fd.form_key = v_key),
          v_service)
  ON CONFLICT (booking_id) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. THE TRIGGER — one function, both directions
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.trg_booking_form_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now boolean := booking_form_applies(NEW);
  v_was boolean := CASE WHEN TG_OP = 'UPDATE' THEN booking_form_applies(OLD) ELSE false END;
BEGIN
  -- ── became live: assignment, or a replacement, or a revival ──────────────
  IF v_now AND NOT v_was THEN
    PERFORM _ensure_booking_form(NEW);
    RETURN NULL;
  END IF;

  -- ── stopped being live: cancelled, expired, soft-deleted, unassigned ─────
  IF v_was AND NOT v_now THEN
    -- untouched blank: it records nothing, so it goes
    DELETE FROM booking_forms bf
     WHERE bf.booking_id = NEW.id
       AND bf.status = 'open'
       AND _booking_form_is_blank(bf.answers);
    -- written in: it is evidence (D11) — kept, and out of the working views
    UPDATE booking_forms bf
       SET status = 'retired', retired_at = now(), retired_by = auth.uid(), updated_at = now()
     WHERE bf.booking_id = NEW.id
       AND bf.status <> 'retired';
  END IF;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS booking_form_lifecycle ON bookings;
CREATE TRIGGER booking_form_lifecycle
  AFTER INSERT OR UPDATE OF client_id, status, deleted_at, kind, offering_id ON bookings
  FOR EACH ROW EXECUTE FUNCTION trg_booking_form_lifecycle();

-- ════════════════════════════════════════════════════════════════════════════
-- 3. BACKFILL — the lessons that already exist
-- ════════════════════════════════════════════════════════════════════════════
-- Every serviced booking already on the books gets its instance, and any log or
-- rider-note already written on the booking is carried IN as the form's answers.
-- Without that carry-in an already-logged lesson would present as a blank form
-- (and would then be silently deleted on cancel), and the projection in m3 would
-- be writing over a record it never read.
INSERT INTO booking_forms (org_id, booking_id, form_key, form_definition_id, service_type,
                           status, answers)
SELECT b.org_id,
       b.id,
       booking_form_key(booking_service_type(b)),
       (SELECT fd.id FROM form_definitions fd
         WHERE fd.form_key = booking_form_key(booking_service_type(b))),
       booking_service_type(b),
       'open',
       coalesce(
         (CASE WHEN b.activity_log ? 'activities'
               THEN jsonb_build_object('activities', b.activity_log -> 'activities')
               ELSE '{}'::jsonb END)
         || (CASE WHEN nullif(btrim(coalesce(b.activity_log ->> 'text', '')), '') IS NOT NULL
                  THEN jsonb_build_object('log_text', b.activity_log ->> 'text')
                  ELSE '{}'::jsonb END)
         || (CASE WHEN nullif(btrim(coalesce(b.notes, '')), '') IS NOT NULL
                  THEN jsonb_build_object('report', b.notes)
                  ELSE '{}'::jsonb END)
         || (CASE WHEN b.status = 'no_show'
                  THEN jsonb_build_object('attendance', 'no_show')
                  ELSE '{}'::jsonb END),
         '{}'::jsonb)
FROM bookings b
WHERE booking_form_applies(b)
ON CONFLICT (booking_id) DO NOTHING;

REVOKE ALL ON FUNCTION public._ensure_booking_form(bookings) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_booking_form_lifecycle() FROM PUBLIC, anon;
