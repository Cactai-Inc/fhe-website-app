-- Move "Horse Care and Expenses" (composed §10) up to §3, right after Purpose &
-- Lease Grant; every section after it shifts down one. Placing CARE at sort_order
-- 25 (between PURPOSE=20 and LEASE_FEE=30) does this without renumbering others.
UPDATE contract_section_defs SET sort_order = 25
 WHERE template_key = 'HORSE_LEASE_V2' AND section_key = 'CARE';
