-- Remove the Loss of Use Insurance subsection (clause + its fields).
DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2'
   AND field_key IN ('TXN.LOSS_OF_USE_INSURANCE_REQ','TXN.LOSS_OF_USE_MIN_LIMIT',
                     'TXN.LOSS_OF_USE_COST_PARTY','TXN.LOSS_OF_USE_OBTAIN_PARTY',
                     'TXN.LOSS_OF_USE_INSURANCE_COST');
DELETE FROM contract_clause_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.LOSS_OF_USE';
