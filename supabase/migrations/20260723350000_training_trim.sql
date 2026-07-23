-- Training clause: remove the "Professional training: [dropdown]. Training is
-- provided by … Claire Bourdon." text, keeping only the general provision that
-- professional training must be conducted by an Approved Trainer. Drop the now-
-- unused training-type dropdown field.
UPDATE contract_clause_defs
   SET body = 'Any professional training of the Horse under this Agreement, including groundwork, schooling, and under-saddle training, shall be conducted only by a French Heritage Equestrian Approved Trainer.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'TRAINING_LESSONS.TRAINING';

DELETE FROM contract_field_defs
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.TRAINING_TYPE';
