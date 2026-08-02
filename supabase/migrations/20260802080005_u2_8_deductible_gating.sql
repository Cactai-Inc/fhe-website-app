-- U2.8 (closure 2026-08-02): deductible-responsibility clauses render only
-- when that section's insurance actually exists — positive equality against
-- the status values that mean a policy is present (HAS_WILL_MAINTAIN /
-- WILL_OBTAIN on either side), never absence-of-NONE and never blank-passes.
-- Rewritten from docs/staged/U2_8_deductible_gating.json into the engine's
-- positive any/equals form per D12; where the staged not_equals intent
-- (blank status renders the clause) conflicts with the owner rule, the rule
-- wins: blank renders nothing.
DO $$
DECLARE
  x text; simple_key text; splitc_key text;
BEGIN
  FOREACH x IN ARRAY ARRAY['GL','MORT','MED'] LOOP
    simple_key := 'INSURANCE_RISK.' || x || CASE WHEN x='GL' THEN '_DED_SIMPLE' ELSE '_DEDR_SIMPLE' END;
    splitc_key := 'INSURANCE_RISK.' || x || CASE WHEN x='GL' THEN '_DED_SPLITC' ELSE '_DEDR_SPLITC' END;

    UPDATE contract_clause_defs SET conditional_on = jsonb_build_object('all', jsonb_build_array(
        jsonb_build_object('equals', jsonb_build_array('NO',''), 'field_key', 'TXN.'||x||'_NOT_REQUIRED'),
        jsonb_build_object('any', jsonb_build_array(
          jsonb_build_object('equals', jsonb_build_array('HAS_WILL_MAINTAIN','WILL_OBTAIN'), 'field_key', 'TXN.'||x||'_LESSOR_STATUS'),
          jsonb_build_object('equals', jsonb_build_array('HAS_WILL_MAINTAIN','WILL_OBTAIN'), 'field_key', 'TXN.'||x||'_LESSEE_STATUS')))))
     WHERE template_key='HORSE_LEASE_V2' AND clause_key = simple_key;

    UPDATE contract_clause_defs SET conditional_on = jsonb_build_object('all', jsonb_build_array(
        jsonb_build_object('equals', jsonb_build_array('NO',''), 'field_key', 'TXN.'||x||'_NOT_REQUIRED'),
        jsonb_build_object('equals', jsonb_build_array('SPLIT'), 'field_key', 'TXN.'||x||'_DED_RESP'),
        jsonb_build_object('any', jsonb_build_array(
          jsonb_build_object('equals', jsonb_build_array('HAS_WILL_MAINTAIN','WILL_OBTAIN'), 'field_key', 'TXN.'||x||'_LESSOR_STATUS'),
          jsonb_build_object('equals', jsonb_build_array('HAS_WILL_MAINTAIN','WILL_OBTAIN'), 'field_key', 'TXN.'||x||'_LESSEE_STATUS')))))
     WHERE template_key='HORSE_LEASE_V2' AND clause_key = splitc_key;
  END LOOP;
END $$;
