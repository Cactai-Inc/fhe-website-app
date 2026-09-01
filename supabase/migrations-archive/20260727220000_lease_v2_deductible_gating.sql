-- Deductible-driven gating (owner, 2026-07-27)
--
-- 1. The stated deductible (Lessor-has / Lessor-will) is REQUIRED — a $ amount
--    or N/A.
-- 2. Deductible N/A / unparseable / under $2 -> the deductible-responsibility
--    assignment is moot: the select is hidden, its value (and the split/other
--    children) are cleared, and no responsibility sentence renders.
-- 3. Deductible $2+ -> the responsibility select shows and is required.
-- 4. Lessee-must-obtain election (no stated deductible exists at signing) keeps
--    the responsibility select — the future policy's deductible is unknown but
--    assignable.
--
-- Mechanism: new numeric `gte` operator in clause_condition_met (SQL) and
-- clauseConditionMet (frontend mirror, same change), used by the field/clause
-- conditionals; the split-sync trigger extends to clear moot values and
-- recompute $-mode shares when the stated deductible changes.

BEGIN;

-- ============================================================================
-- 1. clause_condition_met: numeric gte operator
-- ============================================================================
CREATE OR REPLACE FUNCTION public.clause_condition_met(p_cond jsonb, v_fields jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key   text;
  v_raw   text;
  v_have  text[];
  v_v     jsonb;
  v_sub   jsonb;
BEGIN
  IF p_cond IS NULL THEN RETURN true; END IF;

  -- composite AND: every sub-condition must hold
  IF p_cond ? 'all' THEN
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_cond -> 'all') LOOP
      IF NOT clause_condition_met(v_sub, v_fields) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;

  -- composite OR: any sub-condition holding is enough
  IF p_cond ? 'any' THEN
    FOR v_sub IN SELECT * FROM jsonb_array_elements(p_cond -> 'any') LOOP
      IF clause_condition_met(v_sub, v_fields) THEN RETURN true; END IF;
    END LOOP;
    RETURN false;
  END IF;

  v_key := p_cond ->> 'field_key';
  IF v_key IS NULL THEN RETURN true; END IF;
  v_raw := coalesce(v_fields ->> v_key, '');

  IF p_cond ? 'equals' THEN
    IF p_cond -> 'equals' ? v_raw THEN RETURN true; END IF;
  END IF;

  IF p_cond ? 'contains' THEN
    IF jsonb_typeof(to_jsonb(v_raw)) = 'array' THEN
      v_have := ARRAY(SELECT jsonb_array_elements_text(v_raw::jsonb));
    ELSE
      v_have := ARRAY(SELECT btrim(x) FROM regexp_split_to_table(v_raw, ',') x WHERE btrim(x) <> '');
    END IF;
    FOR v_v IN SELECT * FROM jsonb_array_elements(p_cond -> 'contains') LOOP
      IF (v_v #>> '{}') = ANY (v_have) THEN RETURN true; END IF;
    END LOOP;
  END IF;

  -- numeric gate: met when the field's parsed numeric value >= gte.
  -- Unparseable values (empty, "N/A") never meet it.
  IF p_cond ? 'gte' THEN
    BEGIN
      IF nullif(regexp_replace(v_raw, '[^0-9.]', '', 'g'), '')::numeric
         >= (p_cond ->> 'gte')::numeric THEN
        RETURN true;
      END IF;
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  RETURN false;
END;
$function$;

-- ============================================================================
-- 2. field defs: deductible required; responsibility gated on $2+ (or the
--    Lessee-obtain election) and required
-- ============================================================================
UPDATE contract_field_defs SET
  label = 'Deductible (enter a $ amount or N/A)',
  required = true,
  guidance = 'Required. Enter the policy''s deductible as a dollar amount, or N/A if there is none. $1 or less (or N/A): no deductible-responsibility assignment is needed.'
WHERE template_key='HORSE_LEASE_V2'
  AND field_key IN ('TXN.GL_DEDUCTIBLE','TXN.MORTALITY_DEDUCTIBLE','TXN.MAJOR_MEDICAL_DEDUCTIBLE');

UPDATE contract_field_defs f SET
  required = true,
  conditional_on = jsonb_build_object('any', jsonb_build_array(
    jsonb_build_object('all', jsonb_build_array(
      jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS','LESSOR_WILL'), 'field_key', t.pfx || '_ELECTION'),
      jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'))),
    jsonb_build_object('equals', jsonb_build_array('LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION')))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx)
WHERE f.template_key='HORSE_LEASE_V2' AND f.field_key = t.pfx || '_DEDUCTIBLE_PARTY';

-- ============================================================================
-- 3. responsibility clauses carry the same gate (belt-and-braces alongside the
--    trigger clearing), so a moot sentence can never render
-- ============================================================================
UPDATE contract_clause_defs c SET
  conditional_on = jsonb_build_object('all', jsonb_build_array(
    jsonb_build_object('any', jsonb_build_array(
      jsonb_build_object('all', jsonb_build_array(
        jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS','LESSOR_WILL'), 'field_key', t.pfx || '_ELECTION'),
        jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'))),
      jsonb_build_object('equals', jsonb_build_array('LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'))),
    jsonb_build_object('equals', s.party_vals, 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx),
     (VALUES ('_DED_PARTY', '["LESSOR","LESSEE"]'::jsonb),
             ('_DED_SPLIT', '["SPLIT"]'::jsonb),
             ('_DED_OTHER', '["OTHER"]'::jsonb)) AS s(suffix, party_vals)
WHERE c.template_key='HORSE_LEASE_V2'
  AND c.clause_key = replace(t.pfx,'TXN.','INSURANCE_RISK.') || s.suffix;

-- ============================================================================
-- 4. trigger: moot-clear on deductible change; clear children on party change;
--    keep the split share sync
-- ============================================================================
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
  v_share text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  -- (a) stated deductible edited: under $2 / N-A / unparseable makes the
  -- responsibility assignment moot -> clear it and all children. $2+ with an
  -- active $-mode split -> recompute the counterpart share.
  IF NEW.field_key ~ '_DEDUCTIBLE$' THEN
    v_base := regexp_replace(NEW.field_key, '_DEDUCTIBLE$', '');
    BEGIN
      v_d := nullif(regexp_replace(coalesce(NEW.value,''), '[^0-9.]', '', 'g'), '')::numeric;
    EXCEPTION WHEN others THEN
      v_d := NULL;
    END;
    IF v_d IS NULL OR v_d < 2 THEN
      UPDATE contract_fields SET value = ''
       WHERE document_id = NEW.document_id
         AND field_key IN (v_base || '_DEDUCTIBLE_PARTY', v_base || '_DEDUCTIBLE_SPLIT_MODE',
                           v_base || '_DEDUCTIBLE_SPLIT_LESSOR', v_base || '_DEDUCTIBLE_SPLIT_LESSEE',
                           v_base || '_DEDUCTIBLE_OTHER')
         AND coalesce(value,'') <> '';
    ELSE
      SELECT value INTO v_mode FROM contract_fields
       WHERE document_id = NEW.document_id AND field_key = v_base || '_DEDUCTIBLE_SPLIT_MODE';
      IF v_mode = 'DOLLAR' THEN
        SELECT value INTO v_share FROM contract_fields
         WHERE document_id = NEW.document_id AND field_key = v_base || '_DEDUCTIBLE_SPLIT_LESSOR';
        v_counterpart := v_base || '_DEDUCTIBLE_SPLIT_LESSEE';
        IF coalesce(v_share,'') = '' THEN
          SELECT value INTO v_share FROM contract_fields
           WHERE document_id = NEW.document_id AND field_key = v_base || '_DEDUCTIBLE_SPLIT_LESSEE';
          v_counterpart := v_base || '_DEDUCTIBLE_SPLIT_LESSOR';
        END IF;
        BEGIN
          v_n := nullif(regexp_replace(coalesce(v_share,''), '[^0-9.]', '', 'g'), '')::numeric;
        EXCEPTION WHEN others THEN
          v_n := NULL;
        END;
        IF v_n IS NOT NULL AND v_n <= v_d THEN
          UPDATE contract_fields SET value = to_char(v_d - v_n, 'FM$999,999,990.00')
           WHERE document_id = NEW.document_id AND field_key = v_counterpart;
        ELSIF v_n IS NOT NULL THEN
          UPDATE contract_fields SET value = ''
           WHERE document_id = NEW.document_id
             AND field_key IN (v_base || '_DEDUCTIBLE_SPLIT_LESSOR', v_base || '_DEDUCTIBLE_SPLIT_LESSEE')
             AND coalesce(value,'') <> '';
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- (b) responsibility selection changed: clear children that no longer apply
  IF NEW.field_key ~ '_DEDUCTIBLE_PARTY$' THEN
    IF NEW.value IS DISTINCT FROM OLD.value THEN
      v_base := regexp_replace(NEW.field_key, '_DEDUCTIBLE_PARTY$', '');
      IF coalesce(NEW.value,'') <> 'SPLIT' THEN
        UPDATE contract_fields SET value = ''
         WHERE document_id = NEW.document_id
           AND field_key IN (v_base || '_DEDUCTIBLE_SPLIT_MODE',
                             v_base || '_DEDUCTIBLE_SPLIT_LESSOR', v_base || '_DEDUCTIBLE_SPLIT_LESSEE')
           AND coalesce(value,'') <> '';
      END IF;
      IF coalesce(NEW.value,'') <> 'OTHER' THEN
        UPDATE contract_fields SET value = ''
         WHERE document_id = NEW.document_id
           AND field_key = v_base || '_DEDUCTIBLE_OTHER'
           AND coalesce(value,'') <> '';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- (c) mode change: clear both shares for fresh entry
  IF NEW.field_key ~ '_DEDUCTIBLE_SPLIT_MODE$' THEN
    IF NEW.value IS DISTINCT FROM OLD.value THEN
      v_base := regexp_replace(NEW.field_key, '_DEDUCTIBLE_SPLIT_MODE$', '');
      UPDATE contract_fields SET value = ''
       WHERE document_id = NEW.document_id
         AND field_key IN (v_base || '_DEDUCTIBLE_SPLIT_LESSOR', v_base || '_DEDUCTIBLE_SPLIT_LESSEE')
         AND coalesce(value,'') <> '';
    END IF;
    RETURN NEW;
  END IF;

  -- (d) share entry: normalize + auto-fill the counterpart
  IF NEW.field_key !~ '_DEDUCTIBLE_SPLIT_(LESSOR|LESSEE)$' THEN RETURN NEW; END IF;
  IF coalesce(NEW.value,'') = '' OR NEW.value IS NOT DISTINCT FROM OLD.value THEN
    RETURN NEW;
  END IF;
  v_base := regexp_replace(NEW.field_key, '_DEDUCTIBLE_SPLIT_(LESSOR|LESSEE)$', '');
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
WHEN (NEW.field_key LIKE '%DEDUCTIBLE%')
EXECUTE FUNCTION contract_split_deductible_sync();

-- ============================================================================
-- 5. verify
-- ============================================================================
DO $$
BEGIN
  IF NOT clause_condition_met('{"gte":2,"field_key":"X"}'::jsonb, '{"X":"$2,500"}'::jsonb) THEN
    RAISE EXCEPTION 'gte: $2,500 should meet >= 2';
  END IF;
  IF clause_condition_met('{"gte":2,"field_key":"X"}'::jsonb, '{"X":"$1.00"}'::jsonb) THEN
    RAISE EXCEPTION 'gte: $1.00 should not meet >= 2';
  END IF;
  IF clause_condition_met('{"gte":2,"field_key":"X"}'::jsonb, '{"X":"N/A"}'::jsonb) THEN
    RAISE EXCEPTION 'gte: N/A should not meet >= 2';
  END IF;
  IF clause_condition_met('{"gte":2,"field_key":"X"}'::jsonb, '{}'::jsonb) THEN
    RAISE EXCEPTION 'gte: unset should not meet >= 2';
  END IF;

  IF (SELECT count(*) FROM contract_field_defs
       WHERE template_key='HORSE_LEASE_V2' AND field_key LIKE '%\_DEDUCTIBLE\_PARTY'
         AND required AND conditional_on::text LIKE '%gte%') <> 3 THEN
    RAISE EXCEPTION 'responsibility selects not gated/required';
  END IF;
  IF (SELECT count(*) FROM contract_clause_defs
       WHERE template_key='HORSE_LEASE_V2' AND clause_key LIKE 'INSURANCE_RISK.%\_DED\_%'
         AND conditional_on::text LIKE '%gte%') <> 9 THEN
    RAISE EXCEPTION 'responsibility clauses not gated';
  END IF;
END $$;

COMMIT;
