-- 3rd Party Exercise: fix the party dropdown options.
--   Arranging: Lessee / Lessor / Shared.
--   Cost:      Lessee / Lessor / Shared  (Shared reveals the % / share input).
-- Previously arranging lacked Shared, and cost used a "Split" label/value that
-- didn't match the "Shared" wording used everywhere else. Standardize on SHARED.

UPDATE contract_field_defs
   SET options = '[{"label":"Lessee","value":"LESSEE"},{"label":"Lessor","value":"LESSOR"},{"label":"Shared","value":"SHARED"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_EXERCISE_ARRANGE';

UPDATE contract_field_defs
   SET options = '[{"label":"Lessee","value":"LESSEE"},{"label":"Lessor","value":"LESSOR"},{"label":"Shared","value":"SHARED"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_EXERCISE_COST';

-- The % / share input now shows when cost = Shared (was SPLIT).
UPDATE contract_field_defs
   SET conditional_on = '{"all":[{"equals":["YES"],"field_key":"TXN.TRAINER_CARE_INCLUDE"},{"equals":["SHARED"],"field_key":"TXN.TRAINER_EXERCISE_COST"}]}'::jsonb
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_EXERCISE_SPLIT_PCT';

-- Carry over any existing docs where cost was already set to the old SPLIT value.
UPDATE contract_fields SET value='SHARED'
 WHERE field_key='TXN.TRAINER_EXERCISE_COST' AND value='SPLIT';
