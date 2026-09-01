-- Permitted Use reorder:
--   • Move the restriction band (Jumping/Competition/Trail/Additional Restrictions)
--     up to start right below Competition Expenses & Winnings (sort 31).
--   • Put "Other Allowed Activities" before "Allowing Others to Ride".
-- New order: MAIN(10) Trainer(20) Lessons(25) Training(27) Competitions(30)
--   CompExpenses(31) → JumpTitle/On/Off(32-34) CompRestr(35-37) TrailRestr(38-40)
--   AdditionalRestr(41) → OtherAllowed(45) + note(46) → AllowingOthers(48)
--   → Transport(50)

-- restrictions band → 32..41
UPDATE contract_clause_defs SET sort_order=32 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.JUMP_TITLE';
UPDATE contract_clause_defs SET sort_order=33 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.JUMP_ON';
UPDATE contract_clause_defs SET sort_order=34 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.JUMP_OFF';
UPDATE contract_clause_defs SET sort_order=35 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.COMP_TITLE';
UPDATE contract_clause_defs SET sort_order=36 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.COMP_ON';
UPDATE contract_clause_defs SET sort_order=37 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.COMP_OFF';
UPDATE contract_clause_defs SET sort_order=38 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.TRAIL_TITLE';
UPDATE contract_clause_defs SET sort_order=39 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.TRAIL_ON';
UPDATE contract_clause_defs SET sort_order=40 WHERE template_key='HORSE_LEASE_V2' AND clause_key='RESTRICT.TRAIL_OFF';
UPDATE contract_clause_defs SET sort_order=41 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PERMITTED_USE.RESTRICTIONS';

-- Other Allowed Activities (+note) before Allowing Others to Ride
UPDATE contract_clause_defs SET sort_order=45 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHER';
UPDATE contract_clause_defs SET sort_order=46 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHER_NOTE';
UPDATE contract_clause_defs SET sort_order=48 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PROHIBITED.OTHERS';

-- Transport last
UPDATE contract_clause_defs SET sort_order=50 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PERMITTED_USE.TRANSPORT';
