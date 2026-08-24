-- TASK-OFFERINGDOCS §12 — my_wall_state carries the ASKED-FOR set as well as the
-- demanded one, so the app can surface what is waiting without walling anybody.
CREATE OR REPLACE FUNCTION public.my_wall_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_state jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_contact IS NULL THEN
    RETURN jsonb_build_object('pending', 0, 'wall', false, 'staff', false,
                              'waiting', 0, 'waiting_titles', '[]'::jsonb);
  END IF;

  v_state := contact_document_wall_state(v_contact);

  RETURN jsonb_build_object(
    'pending', (v_state->>'pending')::int,
    'wall', ((v_state->>'gating')::int > 0 AND NOT has_staff_access()),
    'staff_banner', ((v_state->>'gating')::int > 0 AND has_staff_access()),
    'staff', has_staff_access(),
    -- §12: documents ASKED for. Never walls — surfaced at every login until
    -- signed, and dismissable for the session. Staff see their own too; being
    -- staff exempts you from the wall, not from being asked.
    'waiting', (v_state->>'waiting')::int,
    'waiting_titles', coalesce(v_state->'waiting_titles', '[]'::jsonb));
END;
$function$;
