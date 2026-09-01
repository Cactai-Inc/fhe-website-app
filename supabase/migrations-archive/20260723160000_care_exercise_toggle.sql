-- §13 Horse Care and Expenses: turn two "optional with no way to enable" clauses
-- into explicit checkbox toggles on their own lines.
--   (a) the care/exercise obligation, and
--   (b) the right to hire the approved trainer to exercise the Horse.
-- A checked box includes the clause; unchecked omits it. The checkbox is a pure
-- authoring CONTROL — it must not print as a "Yes"/"No" clause line in the final
-- document, so control tokens (…_INCLUDE) render empty in the composer.

-- ── control tokens render as EMPTY prose (they only gate clauses) ────────────
CREATE OR REPLACE FUNCTION public.token_display_value(p_token text, p_raw text, p_labels jsonb)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE
    WHEN coalesce(p_raw,'') = '' THEN ''
    -- pure include-toggles (checkbox controls) emit no document text; they only
    -- gate their target clause. Convention: token key ends in _INCLUDE.
    WHEN p_token LIKE '%\_INCLUDE' THEN ''
    WHEN p_raw LIKE '%,%' AND p_labels ? p_token THEN (
      SELECT string_agg(
               coalesce(p_labels #>> ARRAY[p_token, btrim(v)], btrim(v)),
               ', ' ORDER BY ord)
        FROM unnest(string_to_array(p_raw, ',')) WITH ORDINALITY AS t(v, ord)
        WHERE btrim(v) <> ''
    )
    WHEN p_labels #>> ARRAY[p_token, p_raw] IS NOT NULL
      THEN p_labels #>> ARRAY[p_token, p_raw]
    WHEN upper(p_raw) = 'YES' THEN 'Yes'
    WHEN upper(p_raw) = 'NO'  THEN 'No'
    ELSE p_raw
  END;
$function$;

-- ── (a) care/exercise obligation toggle ─────────────────────────────────────
-- Rename the field to the _INCLUDE convention (drop the earlier EXERCISE_REQUIRED
-- if it exists from an interim run).
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.EXERCISE_REQUIRED';

INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order)
VALUES
  ('HORSE_LEASE_V2', 'CARE', 'CARE.EXERCISE_TOGGLE', NULL, '{{TXN.EXERCISE_INCLUDE}}', 1)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key = EXCLUDED.section_key, body = EXCLUDED.body, sort_order = EXCLUDED.sort_order;

INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type,
   owner_role, required, is_optional, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V2', 'TXN.EXERCISE_INCLUDE', 'CARE.EXERCISE_TOGGLE', 'CARE',
   'Lessee is required to maintain regular exercise for the Horse on their allowed days.',
   'certify', 'checkbox', 'certify',
   'LESSOR', false, true, 1,
   'Checking this box adds the care-and-exercise obligation clause to the lease. Leaving it unchecked omits that clause.')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, input_kind = EXCLUDED.input_kind, value_type = EXCLUDED.value_type,
      format_type = EXCLUDED.format_type, clause_key = EXCLUDED.clause_key, guidance = EXCLUDED.guidance,
      sort_order = EXCLUDED.sort_order, required = EXCLUDED.required, is_optional = EXCLUDED.is_optional;

UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["YES"], "field_key": "TXN.EXERCISE_INCLUDE"}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'SCHEDULE.CARE_DUTY';

-- ── (b) hire-approved-trainer toggle (was a dropdown) ───────────────────────
-- Revise the clause text and drive it by a checkbox (drop the select field).
DELETE FROM contract_field_defs WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.TRAINER_FOR_CARE';

UPDATE contract_clause_defs
   SET body = 'Lessee is permitted to hire the approved trainer listed above to exercise the Horse. Other persons must be approved in writing by the Lessor.',
       conditional_on = '{"equals": ["YES"], "field_key": "TXN.TRAINER_CARE_INCLUDE"}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'SCHEDULE.TRAINER_CARE';

-- The checkbox that includes the trainer clause — its own line above that clause.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order)
VALUES
  ('HORSE_LEASE_V2', 'CARE', 'CARE.TRAINER_TOGGLE', NULL, '{{TXN.TRAINER_CARE_INCLUDE}}',
   (SELECT sort_order FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V2' AND clause_key='SCHEDULE.TRAINER_CARE') - 1)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key = EXCLUDED.section_key, body = EXCLUDED.body, sort_order = EXCLUDED.sort_order;

INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type,
   owner_role, required, is_optional, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V2', 'TXN.TRAINER_CARE_INCLUDE', 'CARE.TRAINER_TOGGLE', 'CARE',
   'Lessee may hire the approved trainer listed above to exercise the Horse.',
   'certify', 'checkbox', 'certify',
   'LESSOR', false, true, 1,
   'Checking this box adds the clause permitting the Lessee to hire the approved trainer to exercise the Horse. Leaving it unchecked omits that clause.')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, input_kind = EXCLUDED.input_kind, value_type = EXCLUDED.value_type,
      format_type = EXCLUDED.format_type, clause_key = EXCLUDED.clause_key, guidance = EXCLUDED.guidance,
      sort_order = EXCLUDED.sort_order, required = EXCLUDED.required, is_optional = EXCLUDED.is_optional;
