-- 3rd Party Exercise: simplify the party dropdowns and add a cost split.
--   Arranging: Lessor / Lessee.
--   Cost:      Lessor / Lessee / Split — choosing Split reveals a "% split" input.

-- Arranging → Lessor / Lessee only.
UPDATE contract_field_defs
   SET options = '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_EXERCISE_ARRANGE';

-- Cost → Lessor / Lessee / Split.
UPDATE contract_field_defs
   SET options = '[{"label":"Lessor","value":"LESSOR"},{"label":"Lessee","value":"LESSEE"},{"label":"Split","value":"SPLIT"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_EXERCISE_COST';

-- The % split input, shown only when cost = Split. Placed on its own body line so
-- the composer's line-level gating drops it unless Split is selected.
UPDATE contract_clause_defs
   SET body = 'Lessee is permitted to engage an approved 3rd party to exercise the Horse. All 3rd party exercise shall be conducted only by a French Heritage Equestrian Approved Trainer. Other 3rd parties must be approved in writing by the Lessor.
Party responsible for arranging: {{TXN.TRAINER_EXERCISE_ARRANGE}}
Party responsible for costs: {{TXN.TRAINER_EXERCISE_COST}}
Lessee''s share of the cost: {{TXN.TRAINER_EXERCISE_SPLIT_PCT}}'
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.TRAINER_CARE';

INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type, owner_role, is_optional, sort_order, conditional_on, guidance)
VALUES
  ('HORSE_LEASE_V2','TXN.TRAINER_EXERCISE_SPLIT_PCT','SCHEDULE.TRAINER_CARE','CARE',
   'Lessee''s share of the cost','percent','percent','percent','LESSOR',true,14,
   '{"all":[{"equals":["YES"],"field_key":"TXN.TRAINER_CARE_INCLUDE"},{"equals":["SPLIT"],"field_key":"TXN.TRAINER_EXERCISE_COST"}]}'::jsonb,
   'Lessee''s percentage share of the 3rd party exercise cost; the remainder is the Lessor''s.')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label=EXCLUDED.label, clause_key=EXCLUDED.clause_key, input_kind=EXCLUDED.input_kind,
      value_type=EXCLUDED.value_type, format_type=EXCLUDED.format_type, owner_role=EXCLUDED.owner_role,
      is_optional=EXCLUDED.is_optional, sort_order=EXCLUDED.sort_order,
      conditional_on=EXCLUDED.conditional_on, guidance=EXCLUDED.guidance;
