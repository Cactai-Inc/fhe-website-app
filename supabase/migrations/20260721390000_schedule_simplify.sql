-- Remove the confusing "Schedule format" dropdown. It let the author choose between
-- the week grid ("Specific days") and a free-text schedule ("Other"), but it was
-- an unnumbered line that consumed §x.1 and the grid showed anyway. Simplify: the
-- week grid is the schedule for a PARTIAL lease, shown directly. The free-text
-- alternative becomes an OPTIONAL "describe custom terms" field the author can add
-- if the grid doesn't fit, no dropdown gating.
DELETE FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.TYPE';
DELETE FROM contract_field_defs  WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.SCHEDULE_TYPE';

-- week grid: shown for any partial lease (no more schedule-type gate).
UPDATE contract_clause_defs
   SET conditional_on='{"field_key":"TXN.LEASE_TYPE","equals":["PARTIAL"]}'::jsonb,
       heading='Schedule for Lessee''s Usage'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.MAIN';

-- custom-terms free text: optional, partial only, always available (no dropdown).
UPDATE contract_clause_defs
   SET conditional_on='{"field_key":"TXN.LEASE_TYPE","equals":["PARTIAL"]}'::jsonb,
       is_optional=true,
       body='Additional or custom schedule terms: {{TXN.SCHEDULE_TERMS}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.OTHER';
UPDATE contract_field_defs SET is_optional=true, label='Additional schedule terms'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.SCHEDULE_TERMS';
