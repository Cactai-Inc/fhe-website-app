-- Disclaimer of Warranties: remove the "Lessor recommends … professional trainer
-- … Professional suitability evaluation:" text; keep the evaluation choice buttons
-- on their own line below the remaining disclaimer.
UPDATE contract_clause_defs
   SET body = 'Except for the representations expressly stated in this Agreement, LESSOR MAKES NO WARRANTIES, EXPRESS OR IMPLIED, REGARDING THE HORSE, INCLUDING THE WARRANTY OF FITNESS FOR A PARTICULAR PURPOSE.'
           || E'\n' || '{{TXN.TRAINER_EVAL_CHOICE}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'HORSE.WARRANTY';

-- Single-select: these button groups are one-outcome choices. Flag them
-- value_type='select' so the buttons renderer enforces single-select (pick one;
-- click again to clear). input_kind stays 'buttons' (still rendered as buttons).
UPDATE contract_field_defs SET value_type = 'select'
 WHERE template_key = 'HORSE_LEASE_V2'
   AND input_kind = 'buttons'
   AND field_key IN ('TXN.TRAINER_EVAL_CHOICE', 'TXN.EVALUATION_ENABLED', 'TXN.VET_CHECK_CHOICE');

-- (Others-allowed-to-ride and other-allowed-activities STAY multi-select; the UI
-- makes their "None" option mutually exclusive with the real options.)
