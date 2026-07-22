-- Trainer/Instructor: FHE's approved trainer/instructor is Claire Bourdon —
-- hardcode her name and drop the fill-in field and the "Horse Training" definition
-- sentence. Also fix two artifacts from the "the Horse" pass: "the Horse Training"
-- (should be "Horse Training") and "REGARDING HORSE" (all-caps line, → "the Horse").

-- definition clause: name Claire Bourdon; remove the Horse-Training definition.
UPDATE contract_clause_defs
   SET body='For the purposes of this Agreement, "Trainer" and "Instructor" mean a French Heritage Equestrian Approved Trainer or Instructor approved by Lessor. The approved Trainer and Instructor is Claire Bourdon.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PERMITTED_USE.TRAINER_DEF';
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.APPROVED_TRAINERS';

-- "the Horse Training" → "Horse Training" (Horse Training is a named activity)
UPDATE contract_clause_defs
   SET body='Riding Lessons, Horse Training, Jumping, and Competitions may take place only while a French Heritage Equestrian Approved Trainer or Instructor is present.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='PERMITTED_USE.TRAINER';

-- Lessons/Training already reference "a French Heritage Equestrian Approved Trainer
-- or Instructor" generically — name Claire Bourdon explicitly.
UPDATE contract_clause_defs
   SET body='Lessee is required to maintain continuous enrollment in weekly riding lessons: {{TXN.LESSONS_REQUIRED}}. Lessons are provided by French Heritage Equestrian Approved Instructor Claire Bourdon.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.LESSONS';
UPDATE contract_clause_defs
   SET body='Professional training: {{TXN.TRAINING_TYPE}}. Training is provided by French Heritage Equestrian Approved Trainer Claire Bourdon.'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TRAINING_LESSONS.TRAINING';

-- fix "REGARDING HORSE" (missed by the-Horse pass on the all-caps disclaimer line)
UPDATE contract_clause_defs
   SET body=replace(body, 'REGARDING HORSE,', 'REGARDING THE HORSE,')
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='HORSE.WARRANTY';
