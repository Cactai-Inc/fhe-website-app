-- §2 Purpose: put Lease Grant above the Lease Type line (so Grant becomes 2.2),
-- and give the Lease Type line a heading so it's numbered (2.3) instead of
-- rendering as an unnumbered line.
UPDATE contract_clause_defs SET sort_order = 15
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PURPOSE.GRANT';   -- Grant → 2.2
UPDATE contract_clause_defs SET sort_order = 20, heading = 'Lease Type'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PURPOSE.LEASE_TYPE'; -- Lease type → 2.3
