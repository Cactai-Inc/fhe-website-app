-- LEASE TEMPLATE ROUND — owner scope change: drop the copy, all fixes on V3.
--
-- Delete HORSE_LEASE_V3_WIP entirely (template + its section/clause/field defs), and
-- move the (f) fix that had landed on WIP onto the live V3: SCHEDULE.TRAINER_CARE
-- (third-party exercise authorization) must not print when a company holds the lessee
-- seat (rule 6), so its gate now also requires LESSEE.PARTY_TYPE = INDIVIDUAL.
-- (b) and (c) are already on V3. This is a def-level change; it does not rewrite any
-- existing document until that document recomposes.

BEGIN;

-- (f) onto live V3
UPDATE contract_clause_defs
   SET conditional_on = '{"all": [
         {"equals": ["YES"], "field_key": "TXN.TRAINER_CARE_INCLUDE"},
         {"equals": ["INDIVIDUAL"], "field_key": "LESSEE.PARTY_TYPE"}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V3' AND clause_key = 'SCHEDULE.TRAINER_CARE';

-- drop the WIP clone completely
DELETE FROM contract_field_defs   WHERE template_key = 'HORSE_LEASE_V3_WIP';
DELETE FROM contract_clause_defs  WHERE template_key = 'HORSE_LEASE_V3_WIP';
DELETE FROM contract_section_defs WHERE template_key = 'HORSE_LEASE_V3_WIP';
DELETE FROM contract_templates    WHERE template_key = 'HORSE_LEASE_V3_WIP';

COMMIT;
