-- TASK ONBOARD §5 — "they have a notice to complete their profile which when clicked
-- takes them to the profile page".
--
-- The predicate already existed, inline, inside my_onboarding_state:
--     v_profile := v_c.phone IS NOT NULL AND v_c.date_of_birth IS NOT NULL
--              AND v_c.emergency_contact_1_name IS NOT NULL
--              AND v_c.emergency_contact_1_phone IS NOT NULL;
-- Copying it into a second function is how two surfaces come to disagree about
-- whether the same person is "done" — the exact failure TASK-WALLSYNC existed to
-- fix. So it is EXTRACTED into contact_profile_complete() and my_onboarding_state
-- is rewritten in place to call it. One predicate, two readers.
--
-- The in-place body rewrite (read pg_get_functiondef, replace, re-execute) is the
-- pattern ~31 migrations in this repo already use, and carries the same documented
-- caveat: it is not replayable on a fresh database, because there would be nothing
-- to rewrite. It asserts that it actually changed something rather than no-opping
-- silently, which is the failure mode that caveat describes.

CREATE OR REPLACE FUNCTION public.contact_profile_complete(p_contact_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (SELECT c.phone IS NOT NULL
        AND c.date_of_birth IS NOT NULL
        AND c.emergency_contact_1_name IS NOT NULL
        AND c.emergency_contact_1_phone IS NOT NULL
       FROM contacts c WHERE c.id = p_contact_id),
    false)
$function$;

COMMENT ON FUNCTION public.contact_profile_complete(uuid) IS
  'ONBOARD §5: the ONE definition of "this person''s profile is filled in" — phone, '
  'date of birth, and a first emergency contact with a number. Read by '
  'my_onboarding_state and by my_profile_completion so the onboarding wizard and the '
  'dashboard notice can never disagree.';

/** What the dashboard needs: is it complete, and if not, what is missing —
 *  in words, so the tile can say why rather than just nagging. */
CREATE OR REPLACE FUNCTION public.my_profile_completion()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid;
  v_c       contacts%ROWTYPE;
  v_missing text[] := '{}';
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  v_contact := current_contact_id();
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('complete', true, 'missing', '[]'::jsonb);
  END IF;
  SELECT * INTO v_c FROM contacts WHERE id = v_contact;

  IF v_c.phone IS NULL                      THEN v_missing := v_missing || 'a phone number'; END IF;
  IF v_c.date_of_birth IS NULL              THEN v_missing := v_missing || 'your date of birth'; END IF;
  IF v_c.emergency_contact_1_name IS NULL
     OR v_c.emergency_contact_1_phone IS NULL THEN v_missing := v_missing || 'an emergency contact'; END IF;

  RETURN jsonb_build_object(
    'complete', contact_profile_complete(v_contact),
    'missing', to_jsonb(v_missing));
END;
$function$;

-- ── my_onboarding_state now reads the shared predicate ──────────────────────
DO $mig$
DECLARE
  v_src text;
  v_new text;
  v_old text := 'v_profile := v_c.phone IS NOT NULL AND v_c.date_of_birth IS NOT NULL'
             || E'\n           AND v_c.emergency_contact_1_name IS NOT NULL'
             || E'\n           AND v_c.emergency_contact_1_phone IS NOT NULL;';
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = 'my_onboarding_state';
  IF v_src IS NULL THEN RAISE EXCEPTION 'my_onboarding_state not found'; END IF;
  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'my_onboarding_state no longer contains the inline profile predicate — '
                    'do not assume this migration applied; re-derive the replacement';
  END IF;
  v_new := replace(v_src, v_old, 'v_profile := contact_profile_complete(v_contact);');
  EXECUTE v_new;
END $mig$;

REVOKE ALL ON FUNCTION public.my_profile_completion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_profile_completion() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contact_profile_complete(uuid) TO authenticated, service_role;
