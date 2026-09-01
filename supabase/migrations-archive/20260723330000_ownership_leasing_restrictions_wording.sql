-- Ownership: reword the "limitations on ownership" question/input to "ownership
-- related leasing restrictions".
UPDATE contract_clause_defs
   SET body = 'Are there any ownership related leasing restrictions? {{TXN.HAS_OWNERSHIP_LIMITS}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.OWNERSHIP_LIMITS_Q';
UPDATE contract_clause_defs
   SET body = 'Ownership related leasing restrictions: {{TXN.OWNERSHIP_LIMITATIONS}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.OWNERSHIP_LIMITS';
