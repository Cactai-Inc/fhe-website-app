-- Split-deductible auto-calculation (owner, 2026-07-27)
--
-- Selecting SPLIT reveals the split definition. New per-type mode selector
-- ($ amount / percentage) plus a sync trigger on contract_fields:
--   * $ mode:  entering either share auto-fills the other from the STATED
--              DEDUCTIBLE (TXN.<T>_DEDUCTIBLE): other = deductible - input.
--              Both values normalize to currency format ($1,000.00).
--              No parseable stated deductible (e.g. Lessee-obtain election,
--              or "N/A") -> the other share stays manual.
--   * % mode:  entering either share auto-fills the other to total 100%
--              (other = 100 - input). Values normalize to "40%" style.
--   * changing the mode clears both shares for fresh entry.
--
-- DB-side so it works in every UI without frontend changes. The RPC layer
-- recomposes the body after the save, so both values land in the rendered
-- sentence. pg_trigger_depth() guards self-recursion.

BEGIN;

-- 1. mode selector per type
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, clause_key, owner_role,
   input_kind, value_type, format_type, options, conditional_on, guidance, required, sort_order)
SELECT 'HORSE_LEASE_V2', t.pfx || '_DEDUCTIBLE_SPLIT_MODE', 'Split entered as', 'INSURANCE_RISK', t.clause, 'LESSOR',
       'select','select','select',
       '[{"value":"DOLLAR","label":"$ amount"},{"value":"PERCENT","label":"% percentage"}]'::jsonb,
       jsonb_build_object('all', jsonb_build_array(
         jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS','LESSOR_WILL','LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'),
         jsonb_build_object('equals', jsonb_build_array('SPLIT'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY'))),
       'Choose whether the split is stated in dollars or percentages. Changing this clears both share fields.',
       false, 65
FROM (VALUES
   ('TXN.GL','INSURANCE_RISK.GENERAL_LIABILITY'),
   ('TXN.MORTALITY','INSURANCE_RISK.MORTALITY'),
   ('TXN.MAJOR_MEDICAL','INSURANCE_RISK.MAJOR_MEDICAL')
 ) AS t(pfx, clause)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, options = EXCLUDED.options,
      conditional_on = EXCLUDED.conditional_on, guidance = EXCLUDED.guidance,
      sort_order = EXCLUDED.sort_order;

-- 2. share-field guidance reflects the auto-fill
UPDATE contract_field_defs SET
  guidance = 'Enter a number. $ mode: the other share auto-fills from the stated deductible (deductible minus this amount). % mode: the other share auto-fills to total 100%.'
WHERE template_key='HORSE_LEASE_V2'
  AND (field_key LIKE '%_DEDUCTIBLE_SPLIT_LESSOR' OR field_key LIKE '%_DEDUCTIBLE_SPLIT_LESSEE');

-- 3. the sync trigger
CREATE OR REPLACE FUNCTION contract_split_deductible_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_base text;
  v_counterpart text;
  v_mode text;
  v_ded text;
  v_n numeric;
  v_d numeric;
  v_self text;
  v_other text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  -- mode change: clear both shares for fresh entry
  IF NEW.field_key LIKE '%\_DEDUCTIBLE\_SPLIT\_MODE' ESCAPE '\' THEN
    IF NEW.value IS DISTINCT FROM OLD.value THEN
      v_base := replace(NEW.field_key, '_DEDUCTIBLE_SPLIT_MODE', '');
      UPDATE contract_fields SET value = ''
       WHERE document_id = NEW.document_id
         AND field_key IN (v_base || '_DEDUCTIBLE_SPLIT_LESSOR', v_base || '_DEDUCTIBLE_SPLIT_LESSEE')
         AND coalesce(value,'') <> '';
    END IF;
    RETURN NEW;
  END IF;

  -- share entry
  IF coalesce(NEW.value,'') = '' OR NEW.value IS NOT DISTINCT FROM OLD.value THEN
    RETURN NEW;
  END IF;
  v_base := regexp_replace(NEW.field_key, '_DEDUCTIBLE_SPLIT_(LESSOR|LESSEE)$', '');
  IF v_base = NEW.field_key THEN RETURN NEW; END IF;
  v_counterpart := CASE WHEN NEW.field_key LIKE '%_LESSOR'
                        THEN v_base || '_DEDUCTIBLE_SPLIT_LESSEE'
                        ELSE v_base || '_DEDUCTIBLE_SPLIT_LESSOR' END;

  SELECT value INTO v_mode FROM contract_fields
   WHERE document_id = NEW.document_id AND field_key = v_base || '_DEDUCTIBLE_SPLIT_MODE';

  BEGIN
    v_n := nullif(regexp_replace(NEW.value, '[^0-9.]', '', 'g'), '')::numeric;
  EXCEPTION WHEN others THEN
    v_n := NULL;
  END;
  IF v_n IS NULL THEN RETURN NEW; END IF;

  IF v_mode = 'PERCENT' THEN
    IF v_n < 0 OR v_n > 100 THEN RETURN NEW; END IF;
    v_self  := to_char(v_n, 'FM990.##') || '%';
    v_other := to_char(100 - v_n, 'FM990.##') || '%';
  ELSIF v_mode = 'DOLLAR' THEN
    v_self := to_char(v_n, 'FM$999,999,990.00');
    SELECT value INTO v_ded FROM contract_fields
     WHERE document_id = NEW.document_id AND field_key = v_base || '_DEDUCTIBLE';
    BEGIN
      v_d := nullif(regexp_replace(coalesce(v_ded,''), '[^0-9.]', '', 'g'), '')::numeric;
    EXCEPTION WHEN others THEN
      v_d := NULL;
    END;
    IF v_d IS NOT NULL AND v_n <= v_d THEN
      v_other := to_char(v_d - v_n, 'FM$999,999,990.00');
    END IF;
  ELSE
    RETURN NEW; -- no mode chosen yet: leave as typed
  END IF;

  IF v_self IS DISTINCT FROM NEW.value THEN
    UPDATE contract_fields SET value = v_self
     WHERE document_id = NEW.document_id AND field_key = NEW.field_key;
  END IF;
  IF v_other IS NOT NULL THEN
    UPDATE contract_fields SET value = v_other
     WHERE document_id = NEW.document_id AND field_key = v_counterpart
       AND value IS DISTINCT FROM v_other;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS contract_fields_split_sync ON contract_fields;
CREATE TRIGGER contract_fields_split_sync
AFTER UPDATE OF value ON contract_fields
FOR EACH ROW
WHEN (NEW.field_key LIKE '%DEDUCTIBLE_SPLIT%')
EXECUTE FUNCTION contract_split_deductible_sync();

-- 4. verify
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM contract_field_defs
   WHERE template_key='HORSE_LEASE_V2' AND field_key LIKE '%\_DEDUCTIBLE\_SPLIT\_MODE';
  IF v_n <> 3 THEN RAISE EXCEPTION 'expected 3 mode fields, found %', v_n; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='contract_fields_split_sync') THEN
    RAISE EXCEPTION 'split sync trigger missing';
  END IF;
END $$;

COMMIT;
