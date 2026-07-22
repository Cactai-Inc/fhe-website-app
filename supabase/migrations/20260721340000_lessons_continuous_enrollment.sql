-- Lessons clause (§12.1 in the composed order when Lessons is a permitted
-- activity): reword to the continuous-enrollment requirement.
UPDATE contract_clause_defs
   SET body = 'Lessee is required to maintain continuous enrollment in weekly riding lessons: {{TXN.LESSONS_REQUIRED}}. Lessons are provided by a French Heritage Equestrian Approved Trainer or Instructor.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.LESSONS';
