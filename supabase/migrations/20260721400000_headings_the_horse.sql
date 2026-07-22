-- The "the Horse" normalization earlier covered clause BODIES but not headings.
-- Fix the clause headings that read "... of Horse".
UPDATE contract_clause_defs SET heading='Ownership of the Horse'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.OWNERSHIP';
UPDATE contract_clause_defs SET heading='Location of the Horse'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='LOCATION.MAIN';
UPDATE contract_clause_defs SET heading='Risk of Loss of or Injury to the Horse'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.RISK_OF_LOSS';
