-- Move the two Competition clauses (may-enter-competitions + expenses/winnings)
-- above the Transport clause within Permitted Use. Order becomes:
--   … Training (27) → Competitions (30) → Competition Expenses (31) → Transport (35)
UPDATE contract_clause_defs SET sort_order = 30
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'COMPETITIONS.INTRO';
UPDATE contract_clause_defs SET sort_order = 31
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'COMPETITIONS.TERMS';

-- also fix a double period on the transport line (body had a trailing "." after
-- the token, and a filled value often ends in one too).
UPDATE contract_clause_defs
   SET body = replace(body, ': {{TXN.OFFSITE_TRANSPORT}}.', ': {{TXN.OFFSITE_TRANSPORT}}')
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'PERMITTED_USE.TRANSPORT';
