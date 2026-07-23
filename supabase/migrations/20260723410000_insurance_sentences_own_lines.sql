-- Mortality and Major Medical insurance: put each sentence of the requirement
-- clause on its own line (requirement/limit, cost, obtaining).
UPDATE contract_clause_defs
   SET body = 'Require mortality insurance? {{TXN.MORTALITY_INSURANCE_REQ}}' || E'\n'
           || 'Mortality insurance is required on the Horse with a minimum limit of {{TXN.MORTALITY_MIN_LIMIT}}.' || E'\n'
           || 'Party responsible for the cost: {{TXN.MORTALITY_COST_PARTY}}.' || E'\n'
           || 'Party responsible for obtaining the policy: {{TXN.MORTALITY_OBTAIN_PARTY}}.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MORTALITY';

UPDATE contract_clause_defs
   SET body = 'Require major medical insurance? {{TXN.MAJOR_MEDICAL_INSURANCE_REQ}}' || E'\n'
           || 'Major medical insurance is required on the Horse with a minimum limit of {{TXN.MAJOR_MEDICAL_MIN_LIMIT}}.' || E'\n'
           || 'Party responsible for the cost: {{TXN.MAJOR_MEDICAL_COST_PARTY}}.' || E'\n'
           || 'Party responsible for obtaining the policy: {{TXN.MAJOR_MEDICAL_OBTAIN_PARTY}}.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.MAJOR_MEDICAL';
