-- Other Allowed Activities: owner call 2026-07-27 — the clause is PERMISSIONS
-- (additional grants beyond the permitted uses, backed by 11.1's catch-all
-- prohibition). The field was keyed TXN.OTHER_PROHIBITED with prohibition
-- flavor — backwards. Zero code/function references to the old keys (verified).
--
-- - Re-key: TXN.OTHER_PROHIBITED -> TXN.ADDITIONAL_ACTIVITIES;
--           TXN.OTHER_PROHIBITED_NOTE -> TXN.ADDITIONAL_ACTIVITIES_OTHER
-- - Options reframed as grants (None -> "None — no additional activities")
-- - Grant-oriented guidance on the free-text Other
-- - Unset/None render: "Lessee is not permitted to engage in any activities
--   with the Horse beyond the permitted uses stated above."

BEGIN;

UPDATE contract_field_defs SET
  field_key = 'TXN.ADDITIONAL_ACTIVITIES',
  label = 'Additional permitted activities',
  options = '[{"value":"NONE","label":"None — no additional activities"},{"value":"BREEDING","label":"Breeding"},{"value":"EMOTIONAL_SUPPORT","label":"Emotional Support Services"},{"value":"FILM_TV_AD","label":"Film / Television / Advertising"},{"value":"OTHER","label":"Other"}]'::jsonb,
  guidance = 'Additional activities GRANTED to Lessee beyond the permitted uses in the Permitted Use(s) clause. Anything not granted remains prohibited by the catch-all. Unset or None renders the no-additional-activities statement.'
WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.OTHER_PROHIBITED';

UPDATE contract_field_defs SET
  field_key = 'TXN.ADDITIONAL_ACTIVITIES_OTHER',
  label = 'Other additional permitted activity',
  guidance = 'An additional activity Lessee is permitted to engage in; restrictions belong in Additional Restrictions.',
  conditional_on = '{"contains":["OTHER"],"field_key":"TXN.ADDITIONAL_ACTIVITIES"}'::jsonb
WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.OTHER_PROHIBITED_NOTE';

UPDATE contract_clause_defs SET
  body = 'Lessee is permitted to engage in the following additional activities with the Horse: {{TXN.ADDITIONAL_ACTIVITIES}}.',
  conditional_on = '{"contains":["BREEDING","EMOTIONAL_SUPPORT","FILM_TV_AD","OTHER"],"field_key":"TXN.ADDITIONAL_ACTIVITIES"}'::jsonb
WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHER';

UPDATE contract_clause_defs SET
  body = 'Other additional permitted activity: {{TXN.ADDITIONAL_ACTIVITIES_OTHER}}.',
  conditional_on = '{"contains":["OTHER"],"field_key":"TXN.ADDITIONAL_ACTIVITIES"}'::jsonb
WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHER_NOTE';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2','PERMITTED_USE','PROHIBITED.OTHER_NONE','Other Allowed Activities',
   'Lessee is not permitted to engage in any activities with the Horse beyond the permitted uses stated above.',
   'input',455,false,'{"equals":["","NONE"],"field_key":"TXN.ADDITIONAL_ACTIVITIES"}'::jsonb)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET heading=EXCLUDED.heading, body=EXCLUDED.body, sort_order=EXCLUDED.sort_order,
      conditional_on=EXCLUDED.conditional_on;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM contract_field_defs
              WHERE template_key='HORSE_LEASE_V2'
                AND field_key IN ('TXN.OTHER_PROHIBITED','TXN.OTHER_PROHIBITED_NOTE')) THEN
    RAISE EXCEPTION 'old prohibition-flavored keys survive';
  END IF;
  IF EXISTS (SELECT 1 FROM contract_clause_defs
              WHERE template_key='HORSE_LEASE_V2'
                AND (body LIKE '%OTHER_PROHIBITED%' OR conditional_on::text LIKE '%OTHER_PROHIBITED%')) THEN
    RAISE EXCEPTION 'clause defs still reference the old key';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_clause_defs
                  WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHER_NONE') THEN
    RAISE EXCEPTION 'unset/none render missing';
  END IF;
END $$;

COMMIT;
