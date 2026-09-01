-- The Schedule section (shown only for a PARTIAL lease) should appear as the
-- section immediately after Purpose & Lease Grant, where the lease type is
-- selected — so choosing "Partial lease" reveals the schedule right there.
-- Move SCHEDULE to sort_order 25 (Purpose=20, Lease Fee=30). For a full lease
-- the whole schedule section is gated off, so it simply doesn't appear.
UPDATE contract_section_defs SET sort_order = 25
 WHERE template_key = 'HORSE_LEASE_V2' AND section_key = 'SCHEDULE';

-- The two FULL-lease care/exercise clauses were sitting in the Schedule section,
-- which kept that section visible for a full lease. They're care obligations, not
-- scheduling — move them into Horse Care & Expenses (CARE). Now the Schedule
-- section is purely partial-lease scheduling and appears only for a partial lease.
UPDATE contract_clause_defs SET section_key='CARE', sort_order=2
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.CARE_DUTY';
UPDATE contract_clause_defs SET section_key='CARE', sort_order=3
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.TRAINER_CARE';
UPDATE contract_field_defs SET section='CARE'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_FOR_CARE';
