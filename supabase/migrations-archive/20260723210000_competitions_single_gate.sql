-- Competitions: one source of truth. Remove the §15 in-section enable checkbox;
-- the §11 Permitted Activities "Competitions" selection is the sole gate (like
-- Jumping enabling its restrictions). Revert the clauses to the clean §11 gate.

DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.COMPETITIONS_INCLUDE';
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'COMPETITIONS.TOGGLE';

UPDATE contract_clause_defs
   SET conditional_on = '{"contains": ["COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key IN ('COMPETITIONS.INTRO','COMPETITIONS.TERMS');
