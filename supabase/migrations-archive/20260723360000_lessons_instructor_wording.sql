-- Lessons clause: reword the instructor line to a general provision (parallel to
-- the training clause) rather than naming Claire Bourdon.
UPDATE contract_clause_defs
   SET body = replace(body,
        'Lessons are provided by French Heritage Equestrian Approved Instructor Claire Bourdon.',
        'Lessons shall be conducted only by a French Heritage Equestrian Approved Instructor.')
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'TRAINING_LESSONS.LESSONS';
