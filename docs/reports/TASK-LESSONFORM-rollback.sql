-- LESSONFORM rollback — restores prod exactly to commit 289a6a9 behaviour.
DROP TRIGGER IF EXISTS booking_form_lifecycle ON bookings;
DROP FUNCTION IF EXISTS public.trg_booking_form_lifecycle();
DROP FUNCTION IF EXISTS public._ensure_booking_form(bookings);
DROP FUNCTION IF EXISTS public.booking_form(uuid);
DROP FUNCTION IF EXISTS public.save_booking_form(uuid, jsonb, boolean);
DROP FUNCTION IF EXISTS public.discard_booking_form(uuid);
DROP FUNCTION IF EXISTS public.lesson_forms(text);

-- the three rewritten-in-place functions, restored to their pre-LESSONFORM bodies
CREATE OR REPLACE FUNCTION public.set_booking_log(p_booking_id uuid, p_activities jsonb, p_text text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  UPDATE bookings
     SET activity_log = jsonb_build_object(
           'activities', coalesce(p_activities, '[]'::jsonb),
           'text', NULLIF(btrim(coalesce(p_text, '')), ''))
   WHERE id = p_booking_id AND kind IN ('lesson','care') AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found in this org'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_lesson_progress_note(p_session_id uuid, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'operator access required'; END IF;
  UPDATE bookings SET notes = NULLIF(btrim(p_note), '')
   WHERE id = p_session_id AND kind = 'lesson' AND org_id = current_org();
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found in this org'; END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.booking_report(p_booking_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_b      bookings%ROWTYPE;
  v_client uuid := current_client_id();
BEGIN
  SELECT * INTO v_b FROM bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking not found'; END IF;
  IF NOT ((coalesce(has_staff_access() AND v_b.org_id = current_org(), false))
          OR (v_client IS NOT NULL AND v_b.client_id = v_client)) THEN
    RAISE EXCEPTION 'not authorized to view this report';
  END IF;
  RETURN jsonb_build_object(
    'booking_id',   v_b.id, 'kind', v_b.kind, 'starts_at', v_b.starts_at, 'ends_at', v_b.ends_at,
    'status', upper(v_b.status), 'location', v_b.location, 'horse_id', v_b.horse_id,
    'service_type', booking_service_type(v_b),
    'checklist',    activity_checklist(booking_service_type(v_b)),
    'activity_log', v_b.activity_log,
    'report',       v_b.notes,
    'notes', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', n.id, 'author_role', n.author_role, 'author_name', n.author_name,
          'phase', n.phase, 'body', n.body, 'created_at', n.created_at)
        ORDER BY (n.phase = 'pre') DESC, n.created_at)
      FROM booking_notes n WHERE n.booking_id = v_b.id), '[]'::jsonb));
END;
$function$;

DROP TABLE IF EXISTS booking_forms;
DROP FUNCTION IF EXISTS public.booking_form_key(text);
DROP FUNCTION IF EXISTS public.booking_form_applies(bookings);
DROP FUNCTION IF EXISTS public._booking_form_is_blank(jsonb);
DELETE FROM form_definitions WHERE form_key = 'ACTIVITY_SESSION';
