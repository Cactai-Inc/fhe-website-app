-- Evaluation period cleanup: the old design printed a redundant meta-line
-- ("Evaluation period: Evaluation period required.") and a "Evaluation Dates"
-- heading that no longer matches an N+unit duration. Rework to a yes/no enable
-- gate (the N/A affordance the user asked for): an always-visible authoring
-- prompt "Include an evaluation period?" and a duration clause shown only when
-- the answer is Yes. When No/blank, no evaluation prose composes and the section
-- is suppressed — but the enable prompt stays visible so it can be turned on.

-- EVALUATION_ENABLED → a yes/no gate. It sits on its own always-shown gate clause
-- so the author can toggle it even when the duration clause is hidden.
UPDATE contract_field_defs
   SET input_kind = 'yesno', value_type = 'text', format_type = 'yesno',
       options = NULL, label = 'Include an evaluation period?',
       guidance = 'A trial window at the start of the lease during which either party may terminate for any reason. Choose No to omit it entirely.',
       clause_key = 'EVALUATION.CHOICE', sort_order = 10
 WHERE template_key = 'HORSE_LEASE_V2' AND field_key = 'TXN.EVALUATION_ENABLED';

-- gate clause: authoring-only prompt, no printed body (the yes/no renders as an
-- orphan control). Keeping an empty body means it contributes no prose, so the
-- section only shows real text once enabled.
UPDATE contract_clause_defs
   SET heading = NULL, conditional_on = NULL, sort_order = 10, body = ''
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'EVALUATION.CHOICE';

-- duration clause: shown only when enabled; single clean sentence.
UPDATE contract_clause_defs
   SET heading = 'Evaluation Period',
       conditional_on = '{"field_key": "TXN.EVALUATION_ENABLED", "equals": ["YES"]}'::jsonb,
       sort_order = 20,
       body = 'Lessee shall have an evaluation period of {{TXN.EVALUATION_LENGTH}} {{TXN.EVALUATION_UNIT}} beginning on the date this Agreement is fully signed by both parties. All terms of this Agreement apply during the evaluation period. During the evaluation period, either party may terminate this Agreement for any reason upon notice to the other party.'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'EVALUATION.DATES';

-- migrate any in-flight document values from the old select codes to yes/no so
-- the new gate matches (ENABLED→YES, DISABLED→NO).
UPDATE contract_fields
   SET value = CASE value WHEN 'ENABLED' THEN 'YES' WHEN 'DISABLED' THEN 'NO' ELSE value END,
       updated_at = now()
 WHERE field_key = 'TXN.EVALUATION_ENABLED' AND value IN ('ENABLED','DISABLED');
