-- Deductible-responsibility: two new options per insurance type (owner, 2026-07-27)
--   3. Both parties shall split the cost: __ ($/%) paid by Lessor and __ ($/%) paid by Lessee
--   4. Other: __ (free text)
--
-- The split option embeds two fill-ins, which cannot nest inside the select's
-- label, so the responsibility sentence moves out of the 9 variant bodies into
-- its own headingless conditional clause per type (one of three shapes renders:
-- simple party / split / other). Existing INSURANCE_RISK sort_orders are
-- multiplied by 10 once to open integer slots between the variant and NONE
-- clauses. Unset responsibility now renders nothing (previously an unset party
-- rendered a subject-less sentence fragment).

BEGIN;

-- 1. open sort_order slots (guarded: only before the new clauses exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs
                  WHERE template_key='HORSE_LEASE_V2'
                    AND clause_key='INSURANCE_RISK.GL_DED_SPLIT') THEN
    UPDATE contract_clause_defs SET sort_order = sort_order * 10
     WHERE template_key='HORSE_LEASE_V2' AND section_key='INSURANCE_RISK';
  END IF;
END $$;

-- 2. remove the responsibility sentence from the 9 variant bodies
UPDATE contract_clause_defs
   SET body = replace(body, ' {{TXN.GL_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy.', '')
 WHERE template_key='HORSE_LEASE_V2' AND clause_key LIKE 'INSURANCE_RISK.GL_%';
UPDATE contract_clause_defs
   SET body = replace(body, ' {{TXN.MORTALITY_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy.', '')
 WHERE template_key='HORSE_LEASE_V2' AND clause_key LIKE 'INSURANCE_RISK.MORTALITY_%';
UPDATE contract_clause_defs
   SET body = replace(body, ' {{TXN.MAJOR_MEDICAL_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy.', '')
 WHERE template_key='HORSE_LEASE_V2' AND clause_key LIKE 'INSURANCE_RISK.MAJOR_MEDICAL_%';

-- 3. add the two options to the three responsibility selects
UPDATE contract_field_defs SET options =
'[{"value":"LESSOR","label":"Lessor"},{"value":"LESSEE","label":"Lessee"},{"value":"SPLIT","label":"Both parties shall split the cost"},{"value":"OTHER","label":"Other"}]'::jsonb
WHERE template_key='HORSE_LEASE_V2'
  AND field_key IN ('TXN.GL_DEDUCTIBLE_PARTY','TXN.MORTALITY_DEDUCTIBLE_PARTY','TXN.MAJOR_MEDICAL_DEDUCTIBLE_PARTY');

-- 4. split/other fill-in fields (per type)
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, clause_key, owner_role,
   input_kind, value_type, format_type, options, conditional_on, guidance, required, sort_order)
SELECT 'HORSE_LEASE_V2', t.pfx || f.suffix, f.label, 'INSURANCE_RISK', t.clause, 'LESSOR',
       'text','text',NULL,NULL,
       CASE f.suffix
         WHEN '_DEDUCTIBLE_OTHER' THEN
           jsonb_build_object('all', jsonb_build_array(
             jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS','LESSOR_WILL','LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'),
             jsonb_build_object('equals', jsonb_build_array('OTHER'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
         ELSE
           jsonb_build_object('all', jsonb_build_array(
             jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS','LESSOR_WILL','LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'),
             jsonb_build_object('equals', jsonb_build_array('SPLIT'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
       END,
       f.guidance, false, f.sort_order
FROM (VALUES
   ('TXN.GL','INSURANCE_RISK.GENERAL_LIABILITY'),
   ('TXN.MORTALITY','INSURANCE_RISK.MORTALITY'),
   ('TXN.MAJOR_MEDICAL','INSURANCE_RISK.MAJOR_MEDICAL')
 ) AS t(pfx, clause),
 (VALUES
   ('_DEDUCTIBLE_SPLIT_LESSOR','Deductible split — paid by Lessor (enter a $ amount or %)','Dollar amount or percentage, e.g. $1,250 or 50%',70),
   ('_DEDUCTIBLE_SPLIT_LESSEE','Deductible split — paid by Lessee (enter a $ amount or %)','Dollar amount or percentage, e.g. $1,250 or 50%',80),
   ('_DEDUCTIBLE_OTHER','Other deductible arrangement','Free text; rendered after "Responsibility for any and all deductible amounts …:"',90)
 ) AS f(suffix, label, guidance, sort_order)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, clause_key = EXCLUDED.clause_key,
      conditional_on = EXCLUDED.conditional_on, guidance = EXCLUDED.guidance,
      sort_order = EXCLUDED.sort_order;

-- 5. responsibility clauses — one of three shapes renders per type
--    (slots: GL after LESSEE@180, MORTALITY after 230, MAJOR_MEDICAL after 330)
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
SELECT 'HORSE_LEASE_V2','INSURANCE_RISK',
       replace(t.pfx,'TXN.','INSURANCE_RISK.') || c.key_suffix, NULL,
       replace(c.body, '@', t.pfx), 'input', t.base + c.off, false,
       jsonb_build_object('all', jsonb_build_array(
         jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS','LESSOR_WILL','LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'),
         jsonb_build_object('equals', c.party_vals, 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
FROM (VALUES
   ('TXN.GL', 180), ('TXN.MORTALITY', 230), ('TXN.MAJOR_MEDICAL', 330)
 ) AS t(pfx, base),
 (VALUES
   ('_DED_PARTY', 2, '["LESSOR","LESSEE"]'::jsonb,
    '{{@_DEDUCTIBLE_PARTY}} is responsible for any and all deductible amounts for claims made against this insurance policy.'),
   ('_DED_SPLIT', 4, '["SPLIT"]'::jsonb,
    'Both parties shall split the cost of any and all deductible amounts for claims made against this insurance policy: {{@_DEDUCTIBLE_SPLIT_LESSOR}} paid by Lessor and {{@_DEDUCTIBLE_SPLIT_LESSEE}} paid by Lessee.'),
   ('_DED_OTHER', 6, '["OTHER"]'::jsonb,
    'Responsibility for any and all deductible amounts for claims made against this insurance policy: {{@_DEDUCTIBLE_OTHER}}.')
 ) AS c(key_suffix, off, party_vals, body)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET body = EXCLUDED.body, sort_order = EXCLUDED.sort_order,
      conditional_on = EXCLUDED.conditional_on;

-- 6. verify
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2' AND clause_key LIKE 'INSURANCE_RISK.%\_DED\_%';
  IF v_n <> 9 THEN RAISE EXCEPTION 'expected 9 responsibility clauses, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2' AND section_key='INSURANCE_RISK'
     AND body LIKE '%is responsible for any and all deductible amounts%'
     AND clause_key NOT LIKE '%_DED_PARTY';
  IF v_n <> 0 THEN RAISE EXCEPTION 'responsibility sentence still embedded in % variant bodies', v_n; END IF;

  SELECT count(*) INTO v_n FROM contract_field_defs
   WHERE template_key='HORSE_LEASE_V2'
     AND (field_key LIKE '%_DEDUCTIBLE_SPLIT_%' OR field_key LIKE '%_DEDUCTIBLE_OTHER')
     AND section='INSURANCE_RISK';
  IF v_n <> 9 THEN RAISE EXCEPTION 'expected 9 split/other fields, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM contract_field_defs
   WHERE template_key='HORSE_LEASE_V2' AND field_key LIKE '%_DEDUCTIBLE_PARTY'
     AND options @> '[{"value":"SPLIT"},{"value":"OTHER"}]'::jsonb;
  IF v_n <> 3 THEN RAISE EXCEPTION 'expected 4-option selects on 3 fields, found %', v_n; END IF;

  -- ordering sanity: each _DED_PARTY sits between its LESSEE variant and NONE
  IF EXISTS (
    SELECT 1 FROM contract_clause_defs a
      JOIN contract_clause_defs b
        ON b.template_key=a.template_key
       AND b.clause_key = replace(a.clause_key,'_DED_PARTY','_NONE')
     WHERE a.template_key='HORSE_LEASE_V2' AND a.clause_key LIKE '%_DED_PARTY'
       AND a.sort_order >= b.sort_order) THEN
    RAISE EXCEPTION 'responsibility clause ordering wrong';
  END IF;
END $$;

COMMIT;
