-- Permitted Use cleanups:
-- 1) Competitions: drop the "With Lessor's prior written permission, Lessee may
--    enter the Horse in competitions..." line, and fold the "Competition Expenses
--    and Winnings" subsection content up into the Competitions subsection (no
--    separate descriptive title), matching the two subsections above it.
-- 2) Allowing Others to Ride: reword the lead line and put the "No other person..."
--    sentence on its own line.

-- Competitions subsection now carries the expenses + winnings terms directly.
UPDATE contract_clause_defs
   SET body = 'Expenses of competition (entry fees, transportation, and the like) are: {{TXN.COMPETITION_EXPENSES}}.
Any prize money or winnings earned in competition shall belong to: {{TXN.COMPETITION_WINNINGS}}.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='COMPETITIONS.INTRO';

-- Retire the now-redundant separate "Competition Expenses and Winnings" clause.
UPDATE contract_field_defs SET clause_key='COMPETITIONS.INTRO'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='COMPETITIONS.TERMS';
DELETE FROM contract_clause_defs
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='COMPETITIONS.TERMS';

-- Allowing Others to Ride: reword lead-in + split trailing sentence onto its own line.
UPDATE contract_clause_defs
   SET body = 'The following additional persons may ride or handle the Horse without Lessor''s prior permission: {{TXN.OTHERS_ALLOWED}}.
No other person shall be permitted to ride or handle the Horse without Lessor''s permission.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHERS';
