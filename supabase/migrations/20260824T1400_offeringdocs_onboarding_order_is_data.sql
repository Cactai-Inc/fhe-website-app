-- TASK-OFFERINGDOCS — the onboarding running order is DATA, and MEDIA_RELEASE
-- stops being named in code at all.
--
-- Owner, 2026-08-24: "media release has been retired as a standalone thing and
-- its a disclosure in the liability releases... this is the type of legacy code
-- that shouldnt even exist."
--
-- He is right twice over. The template is already retired properly — active
-- false, never deleted (D16), zero rows in contact_required_documents,
-- category_document_requirements, contract_role_documents or documents. The DATA
-- is clean. What survived is the KEY, hardcoded into a display-ordering array in
-- two function bodies:
--
--   ORDER BY coalesce(array_position(
--     ARRAY['COMPANY_POLICIES','FACILITY_RULES',...,'MEDIA_RELEASE'],
--     ct.template_key), 99)
--
-- Deleting the string from two arrays would fix this instance and leave the
-- mechanism that produced it. The running order of a tenant's onboarding is
-- CONFIGURATION — D21: "a hardcoded business formula is a defect by default" —
-- so it becomes a column, seeded with exactly the order those arrays encoded,
-- minus the retired one. A template retired in future drops out by itself.
ALTER TABLE contract_templates
  ADD COLUMN IF NOT EXISTS onboarding_order integer;

COMMENT ON COLUMN contract_templates.onboarding_order IS
  'Running order on the onboarding flow (low first; NULL sorts last). The order '
  'a member meets their paperwork in — was a hardcoded array in '
  'generate_my_onboarding_documents and my_onboarding_state until 2026-08-24.';

UPDATE contract_templates ct SET onboarding_order = v.ord
  FROM (VALUES
    ('COMPANY_POLICIES', 1), ('FACILITY_RULES', 2), ('RELEASE_PARTICIPANT', 3),
    ('RELEASE_HORSE_CARE', 4), ('RELEASE_HORSE_EXERCISE', 5), ('RELEASE_GENERAL', 6),
    ('HUMAN_EMERGENCY_MEDICAL', 7), ('HORSE_EMERGENCY_VET', 8)
    -- MEDIA_RELEASE is deliberately absent: retired as a standalone document,
    -- now a disclosure inside the liability releases. The row stays (D16); the
    -- key stops being named anywhere that decides behaviour.
  ) AS v(key, ord)
 WHERE ct.template_key = v.key AND ct.onboarding_order IS DISTINCT FROM v.ord;

-- ── Both function bodies stop naming templates ───────────────────────────────
DO $mig$
DECLARE
  v_fn   text;
  v_src  text;
  v_old  text;
  v_new  text;
  v_hits int := 0;
BEGIN
  v_old := $ord$ORDER BY coalesce(array_position(
      ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
            'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
            'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET','MEDIA_RELEASE'],
      ct.template_key), 99), ct.template_key$ord$;

  v_new := $ord$ORDER BY coalesce((SELECT max(x.onboarding_order) FROM contract_templates x
                       WHERE x.template_key = ct.template_key), 99), ct.template_key$ord$;

  FOREACH v_fn IN ARRAY ARRAY['generate_my_onboarding_documents', 'my_onboarding_state'] LOOP
    SELECT pg_get_functiondef(oid) INTO v_src FROM pg_proc WHERE proname = v_fn;
    IF v_src IS NULL THEN RAISE EXCEPTION '% not found', v_fn; END IF;
    IF position(v_old IN v_src) = 0 THEN
      IF position('MEDIA_RELEASE' IN v_src) > 0 THEN
        RAISE EXCEPTION '% still names MEDIA_RELEASE but not in the shape expected', v_fn;
      END IF;
      RAISE NOTICE '% already reads the column — skipped', v_fn;
      CONTINUE;
    END IF;
    v_src := replace(v_src, v_old, v_new);
    IF position('MEDIA_RELEASE' IN v_src) > 0 THEN
      RAISE EXCEPTION 'MEDIA_RELEASE survived the rewrite of % — refusing to install', v_fn;
    END IF;
    EXECUTE v_src;
    v_hits := v_hits + 1;
  END LOOP;

  RAISE NOTICE 'onboarding order is data now; % function(s) rewritten', v_hits;
END
$mig$;
