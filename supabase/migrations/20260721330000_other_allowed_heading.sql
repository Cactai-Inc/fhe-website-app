-- The PROHIBITED.OTHER clause was reworked to "allowed activities" (body + field),
-- but its HEADING still read "Other Prohibited Activities" — contradicting the
-- clause text ("Lessee is permitted to engage in..."). Fix the heading to match.
UPDATE contract_clause_defs SET heading = 'Other Allowed Activities'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHER';
