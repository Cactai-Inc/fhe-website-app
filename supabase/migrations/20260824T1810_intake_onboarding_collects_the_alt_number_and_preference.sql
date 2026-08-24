-- TASK-INTAKE — the onboarding profile collects the texts-only alternate and the
-- preferred contact method.
--
-- Owner, 2026-08-24: "the onboarding flow they enter into when they claim the link
-- from their email should have a space on the form asking if they have a texts
-- only number they want to add to their account", and the profile "is missing
-- valuable information, like preferred contact method, an alternate number".
--
-- `update_my_onboarding_profile` names every column it writes, so a new field is
-- silently dropped until it is named here too.
DO $mig$
DECLARE v_src text; v_old text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
    FROM pg_proc WHERE proname = 'update_my_onboarding_profile';
  IF v_src IS NULL THEN RAISE EXCEPTION 'update_my_onboarding_profile not found'; END IF;
  IF position('text_only_phone' IN v_src) > 0 THEN
    RAISE NOTICE 'already collected — nothing to do'; RETURN;
  END IF;

  v_old := $q$    phone         = coalesce(NULLIF(trim(p->>'phone'), ''), phone),$q$;
  IF position(v_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'update_my_onboarding_profile is not the shape this migration expected';
  END IF;

  -- Same coalesce discipline as every other field here: a blank never erases
  -- what is already on file, so re-submitting a partly-filled form is safe.
  v_src := replace(v_src, v_old, v_old || $q$
    -- INTAKE 2026-08-24. `phone` IS the mobile number (relabelled, not rewired);
    -- this is the alternate the person only wants TEXTS on.
    text_only_phone   = coalesce(NULLIF(trim(p->>'text_only_phone'), ''), text_only_phone),
    preferred_contact = coalesce(NULLIF(trim(p->>'preferred_contact'), ''), preferred_contact),$q$);
  EXECUTE v_src;
END
$mig$;
