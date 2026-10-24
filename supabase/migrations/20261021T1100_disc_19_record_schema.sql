-- Disclosure rebuild, phase 19: record schema to match the approved field specs.
--
-- (a) Medications/supplements: the imported set is Name, Purpose, Dose, Frequency,
--     Cost per dose, Rx required. Add purpose, frequency, cost_per_dose, rx_required;
--     remove conditions_of_use entirely (column + every reference). The remaining
--     care/purchasing fields (instructions, cost, order_units, days_supply,
--     supplier_*, rx_info) stay on the record and are NOT imported.
-- (b) Injuries caused to humans becomes one answer — Yes / No / Unknown — on the
--     record, not a list. jsonb list -> text scalar. No live data to preserve
--     (all empty, verified), so the conversion is a plain retype.
-- (c) Injuries to the horse drops rider_involved / human_hurt / human_was_riding.
--     Known conditions drops status. These keys hold no data in any live entry
--     (verified: only `description` is populated), so there is nothing to rewrite;
--     the composers and form stop emitting/reading them (later phases), and the
--     columns are jsonb lists whose per-entry shape is not DB-constrained.

-- (a) medication columns
ALTER TABLE horse_medications
  ADD COLUMN IF NOT EXISTS purpose       text,
  ADD COLUMN IF NOT EXISTS frequency     text,
  ADD COLUMN IF NOT EXISTS cost_per_dose text,
  ADD COLUMN IF NOT EXISTS rx_required   boolean;

-- strip conditions_of_use from the two functions that still name it, then drop it.
DO $hml$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.horse_medications_list(uuid)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    $o$    'rx_info', rx_info, 'order_units', order_units, 'days_supply', days_supply,
    'conditions_of_use', conditions_of_use)$o$,
    $n$    'rx_info', rx_info, 'order_units', order_units, 'days_supply', days_supply,
    'purpose', purpose, 'frequency', frequency, 'cost_per_dose', cost_per_dose, 'rx_required', rx_required)$n$);
  EXECUTE v_def;
END $hml$;

DO $shm$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.set_horse_medications(uuid,jsonb)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    $o$        supplier_website, supplier_phone, rx_info, order_units, days_supply, conditions_of_use)$o$,
    $n$        supplier_website, supplier_phone, rx_info, order_units, days_supply,
        purpose, frequency, cost_per_dose, rx_required)$n$);
  v_def := replace(v_def,
    $o$        nullif(btrim(it ->> 'order_units'),''), nullif(btrim(it ->> 'days_supply'),''),
        nullif(btrim(it ->> 'conditions_of_use'),''));$o$,
    $n$        nullif(btrim(it ->> 'order_units'),''), nullif(btrim(it ->> 'days_supply'),''),
        nullif(btrim(it ->> 'purpose'),''), nullif(btrim(it ->> 'frequency'),''),
        nullif(btrim(it ->> 'cost_per_dose'),''),
        CASE WHEN it ? 'rx_required' THEN (it ->> 'rx_required')::boolean ELSE NULL END);$n$);
  EXECUTE v_def;
END $shm$;

-- horse_meds_prose_v2 also names conditions_of_use; it is replaced wholesale in the
-- composer phase, but strip the reference now so the DROP COLUMN cannot fail on it.
DO $hmp$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.horse_meds_prose_v2(uuid,text)'::regprocedure) INTO v_def;
  IF position('conditions_of_use' IN v_def) > 0 THEN
    -- strip the clause AND the comma that preceded it (it was the last arg to
    -- concat_ws), so the SQL stays valid. This fn is replaced wholesale in the
    -- composer phase; this keeps it compilable until then and lets DROP COLUMN pass.
    v_def := replace(v_def,
      E'    CASE WHEN nullif(btrim(m.instructions),\'\') IS NOT NULL THEN \'(\' || btrim(m.instructions) || \')\' END,\n    CASE WHEN nullif(btrim(m.conditions_of_use),\'\') IS NOT NULL THEN \'| conditions of use: \' || btrim(m.conditions_of_use) END\n',
      E'    CASE WHEN nullif(btrim(m.instructions),\'\') IS NOT NULL THEN \'(\' || btrim(m.instructions) || \')\' END\n');
    EXECUTE v_def;
  END IF;
END $hmp$;

ALTER TABLE horse_medications DROP COLUMN IF EXISTS conditions_of_use;

-- (b) injuries_to_humans: jsonb list -> text scalar (Yes/No/Unknown/'')
-- Readers are repointed in the composer/token phase; here we only retype the column.
-- create/update_horse_record currently coalesce p->'injuries_to_humans' to '[]'::jsonb;
-- those are rewritten in the record-fns phase. Convert existing values to '' (all empty).
ALTER TABLE horses
  ALTER COLUMN injuries_to_humans DROP DEFAULT,
  ALTER COLUMN injuries_to_humans TYPE text
    USING CASE
      WHEN injuries_to_humans IS NULL THEN NULL
      WHEN jsonb_typeof(injuries_to_humans) = 'array'
        AND jsonb_array_length(injuries_to_humans) = 0 THEN ''
      ELSE '' END;  -- no non-empty lists exist; any legacy list collapses to unanswered

-- repoint the jsonb-shaped readers of injuries_to_humans to the text scalar, so
-- this migration leaves every function consistent with the new column type.
DO $chr$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.create_horse_record(jsonb)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    $o$    coalesce(p -> 'injuries_to_humans', '[]'::jsonb),$o$,
    $n$    nullif(btrim(coalesce(p ->> 'injuries_to_humans','')),''),$n$);
  EXECUTE v_def;
END $chr$;

DO $uhr$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.update_horse_record(uuid,jsonb)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    $o$    injuries_to_humans       = CASE WHEN p ? 'injuries_to_humans'       THEN coalesce(p -> 'injuries_to_humans', '[]'::jsonb)       ELSE injuries_to_humans END,$o$,
    $n$    injuries_to_humans       = CASE WHEN p ? 'injuries_to_humans'       THEN nullif(btrim(coalesce(p ->> 'injuries_to_humans','')),'') ELSE injuries_to_humans END,$n$);
  EXECUTE v_def;
END $uhr$;

-- horse_field_token_value: the content token now returns the scalar answer's
-- representation is handled in the composer phase, but the GATE and raw value must
-- stop calling jsonb functions on a text column. Point both at the scalar here;
-- the composer phase refines the content rendering.
DO $hftv$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.horse_field_token_value(horses,text)'::regprocedure) INTO v_def;
  v_def := replace(v_def,
    $o$    WHEN 'INJURIES_TO_HUMANS'      THEN horse_injuries_humans_prose(v_horse.injuries_to_humans)$o$,
    $n$    WHEN 'INJURIES_TO_HUMANS'      THEN upper(coalesce(nullif(btrim(v_horse.injuries_to_humans),''),''))$n$);
  v_def := replace(v_def,
    $o$    WHEN 'INJURIES_TO_HUMANS_GATE' THEN CASE WHEN jsonb_array_length(coalesce(v_horse.injuries_to_humans,'[]'::jsonb))>0 THEN 'YES' ELSE 'NO' END$o$,
    $n$    WHEN 'INJURIES_TO_HUMANS_GATE' THEN upper(coalesce(nullif(btrim(v_horse.injuries_to_humans),''),''))$n$);
  EXECUTE v_def;
END $hftv$;

-- horse_injuries_humans_prose consumed the old jsonb list; it has no caller now.
DROP FUNCTION IF EXISTS public.horse_injuries_humans_prose(jsonb);
