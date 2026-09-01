-- Lessee-obtain deductible refinement (owner, 2026-07-27)
--
-- When the Lessor requires the Lessee to obtain the policy, the deductible's
-- existence and amount are unknown at signing ($0 is possible), so:
--   * the responsibility sentence is CONDITIONAL: "Any deductible amounts …
--     shall be the responsibility of …" (vs the factual phrasing used when the
--     Lessor's policy states a deductible);
--   * a split can only be stated in PERCENTAGES — the $/% mode selector is not
--     shown (a $-split of an unknown amount is meaningless; the up-to-$X
--     arrangement is deliberately left to the "Other" option);
--   * "Other" keeps its existing shape for both election families.
--
-- Also: switching the election between families (Lessor-has/will vs
-- Lessee-obtain vs none) clears the deductible subtree, so stale $-mode values
-- can never leak into the %-only sentence.

BEGIN;

-- ============================================================================
-- 1. mode selector: Lessor-has/will only
-- ============================================================================
UPDATE contract_field_defs f SET
  conditional_on = jsonb_build_object('all', jsonb_build_array(
    jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS','LESSOR_WILL'), 'field_key', t.pfx || '_ELECTION'),
    jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'),
    jsonb_build_object('equals', jsonb_build_array('SPLIT'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx)
WHERE f.template_key='HORSE_LEASE_V2' AND f.field_key = t.pfx || '_DEDUCTIBLE_SPLIT_MODE';

-- ============================================================================
-- 2. share fields: after mode for Lessor-has/will; direct (%-only) for
--    Lessee-obtain
-- ============================================================================
UPDATE contract_field_defs f SET
  label = replace(f.label, ' (enter a $ amount or %)', ''),
  guidance = 'Enter a number. Lessor-held policy in $ mode: the other share auto-fills from the stated deductible. % mode (and always when Lessee must obtain the policy): the other share auto-fills to total 100%.',
  conditional_on = jsonb_build_object('any', jsonb_build_array(
    jsonb_build_object('all', jsonb_build_array(
      jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS','LESSOR_WILL'), 'field_key', t.pfx || '_ELECTION'),
      jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'),
      jsonb_build_object('equals', jsonb_build_array('SPLIT'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY'),
      jsonb_build_object('equals', jsonb_build_array('DOLLAR','PERCENT'), 'field_key', t.pfx || '_DEDUCTIBLE_SPLIT_MODE'))),
    jsonb_build_object('all', jsonb_build_array(
      jsonb_build_object('equals', jsonb_build_array('LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'),
      jsonb_build_object('equals', jsonb_build_array('SPLIT'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx)
WHERE f.template_key='HORSE_LEASE_V2'
  AND f.field_key IN (t.pfx || '_DEDUCTIBLE_SPLIT_LESSOR', t.pfx || '_DEDUCTIBLE_SPLIT_LESSEE');

-- ============================================================================
-- 3. existing responsibility clauses: restrict to the stated-deductible family
--    (_DED_OTHER keeps both families)
-- ============================================================================
UPDATE contract_clause_defs c SET
  conditional_on = jsonb_build_object('all', jsonb_build_array(
    jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS','LESSOR_WILL'), 'field_key', t.pfx || '_ELECTION'),
    jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'),
    jsonb_build_object('equals', s.party_vals, 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx),
     (VALUES ('_DED_PARTY', '["LESSOR","LESSEE"]'::jsonb),
             ('_DED_SPLIT', '["SPLIT"]'::jsonb)) AS s(suffix, party_vals)
WHERE c.template_key='HORSE_LEASE_V2'
  AND c.clause_key = replace(t.pfx,'TXN.','INSURANCE_RISK.') || s.suffix;

-- ============================================================================
-- 4. Lessee-obtain conditional-phrasing variants (inline continuations)
-- ============================================================================
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
SELECT 'HORSE_LEASE_V2','INSURANCE_RISK',
       replace(t.pfx,'TXN.','INSURANCE_RISK.') || s.key_suffix, NULL,
       replace(s.body, '@', t.pfx), 'input', t.base + s.off, false,
       jsonb_build_object('all', jsonb_build_array(
         jsonb_build_object('equals', jsonb_build_array('LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'),
         jsonb_build_object('equals', s.party_vals, 'field_key', t.pfx || '_DEDUCTIBLE_PARTY'))),
       true
FROM (VALUES
   ('TXN.GL', 180), ('TXN.MORTALITY', 230), ('TXN.MAJOR_MEDICAL', 330)
 ) AS t(pfx, base),
 (VALUES
   ('_DED_PARTY_FUTURE', 7, '["LESSOR","LESSEE"]'::jsonb,
    'Any deductible amounts for claims made against this insurance policy shall be the responsibility of {{@_DEDUCTIBLE_PARTY}}.'),
   ('_DED_SPLIT_FUTURE', 8, '["SPLIT"]'::jsonb,
    'Any deductible amounts for claims made against this insurance policy shall be split between the parties: {{@_DEDUCTIBLE_SPLIT_LESSEE}} paid by Lessee and {{@_DEDUCTIBLE_SPLIT_LESSOR}} paid by Lessor.')
 ) AS s(key_suffix, off, party_vals, body)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET body = EXCLUDED.body, sort_order = EXCLUDED.sort_order,
      conditional_on = EXCLUDED.conditional_on, render_as_subitem = EXCLUDED.render_as_subitem;

-- ============================================================================
-- 5. trigger: %-mode fallback for Lessee-obtain; election family switch clears
--    the deductible subtree
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
  v_el text;
  v_ded text;
  v_n numeric;
  v_d numeric;
  v_self text;
  v_other text;
  v_share text;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  -- (a0) election family change (Lessor-held vs Lessee-obtain vs none):
  -- clear the whole deductible subtree so stale values never render
  IF NEW.field_key ~ '_ELECTION$' THEN
    IF (CASE WHEN coalesce(NEW.value,'') IN ('LESSOR_HAS','LESSOR_WILL') THEN 'L'
             WHEN coalesce(NEW.value,'') = 'LESSEE_OBTAIN' THEN 'E' ELSE 'N' END)
       IS DISTINCT FROM
       (CASE WHEN coalesce(OLD.value,'') IN ('LESSOR_HAS','LESSOR_WILL') THEN 'L'
             WHEN coalesce(OLD.value,'') = 'LESSEE_OBTAIN' THEN 'E' ELSE 'N' END) THEN
      v_base := regexp_replace(NEW.field_key, '_ELECTION$', '');
      UPDATE contract_fields SET value = ''
       WHERE document_id = NEW.document_id
         AND field_key IN (v_base || '_DEDUCTIBLE', v_base || '_DEDUCTIBLE_PARTY',
                           v_base || '_DEDUCTIBLE_SPLIT_MODE',
                           v_base || '_DEDUCTIBLE_SPLIT_LESSOR', v_base || '_DEDUCTIBLE_SPLIT_LESSEE',
                           v_base || '_DEDUCTIBLE_OTHER')
         AND coalesce(value,'') <> '';
    END IF;
    RETURN NEW;
  END IF;

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

  -- (d) share entry: normalize + auto-fill the counterpart. Lessee-obtain has
  -- no mode selector — it is always a percentage split.
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
  IF coalesce(v_mode,'') = '' THEN
    SELECT value INTO v_el FROM contract_fields
     WHERE document_id = NEW.document_id AND field_key = v_base || '_ELECTION';
    IF v_el = 'LESSEE_OBTAIN' THEN v_mode := 'PERCENT'; END IF;
  END IF;

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
    RETURN NEW; -- no mode resolvable: leave as typed
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
WHEN (NEW.field_key LIKE '%DEDUCTIBLE%' OR NEW.field_key ~ '_ELECTION$')
EXECUTE FUNCTION contract_split_deductible_sync();

-- ============================================================================
-- 6. verify
-- ============================================================================
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2' AND clause_key LIKE '%\_DED\_%\_FUTURE'
     AND render_as_subitem;
  IF v_n <> 6 THEN RAISE EXCEPTION 'expected 6 future-phrasing clauses, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2'
     AND clause_key ~ '_DED_(PARTY|SPLIT)$'
     AND conditional_on::text LIKE '%LESSEE_OBTAIN%';
  IF v_n <> 0 THEN RAISE EXCEPTION 'stated-deductible clauses still include LESSEE_OBTAIN'; END IF;

  SELECT count(*) INTO v_n FROM contract_field_defs
   WHERE template_key='HORSE_LEASE_V2' AND field_key LIKE '%\_DEDUCTIBLE\_SPLIT\_MODE'
     AND conditional_on::text LIKE '%LESSEE_OBTAIN%';
  IF v_n <> 0 THEN RAISE EXCEPTION 'mode selector still offered for LESSEE_OBTAIN'; END IF;
END $$;

COMMIT;
