-- Fix: the 3rd-party-exercise split % field def used value_type='percent', which
-- the contract_fields.value_type check constraint rejects (allowed: text, number,
-- date, currency, checkbox, select, longtext) — so sync_contract_fields_from_defs
-- would fail to materialize the field row. Use value_type='number'; the % rendering
-- comes from input_kind/format_type='percent'.
UPDATE contract_field_defs
   SET value_type = 'number'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_EXERCISE_SPLIT_PCT';
