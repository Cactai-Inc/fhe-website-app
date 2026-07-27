-- Lessor-will-purchase deductible is also unknown (owner, 2026-07-27)
--
-- A deductible is only a known fact when the policy already exists. Both
-- "has to get" elections (Lessor will purchase, Lessee must obtain) now share
-- the future-policy treatment previously applied to Lessee-obtain:
--   * the _WILL variant no longer states a deductible amount (policy limit +
--     effective date remain — they are the commitment being made);
--   * the stated-deductible field exists only for LESSOR_HAS;
--   * responsibility renders with the conditional "Any deductible amounts …"
--     phrasing; split is %-only (no $/% selector); Other available;
--   * the factual sentence + $-anchored split are exclusive to LESSOR_HAS.
-- Election family for subtree-clearing becomes: stated (LESSOR_HAS) vs
-- future (LESSOR_WILL, LESSEE_OBTAIN) vs none — switching within the future
-- family preserves entered values.

BEGIN;

-- ============================================================================
-- 1. _WILL variant bodies: drop the stated deductible
-- ============================================================================
UPDATE contract_clause_defs SET body =
'Lessor is in the process of purchasing or agrees to purchase general liability insurance covering the activities contemplated by this Agreement, with a policy limit of {{TXN.GL_POLICY_AMOUNT}} and an effective date no later than {{TXN.GL_EFFECTIVE_DATE}}.'
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.GL_WILL';

UPDATE contract_clause_defs SET body =
'Lessor is in the process of purchasing or agrees to purchase mortality insurance on the Horse with a policy limit of {{TXN.MORTALITY_POLICY_AMOUNT}} and an effective date no later than {{TXN.MORTALITY_EFFECTIVE_DATE}}.'
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MORTALITY_WILL';

UPDATE contract_clause_defs SET body =
'Lessor is in the process of purchasing or agrees to purchase major medical insurance on the Horse with a policy limit of {{TXN.MAJOR_MEDICAL_POLICY_AMOUNT}} and an effective date no later than {{TXN.MAJOR_MEDICAL_EFFECTIVE_DATE}}.'
WHERE template_key='HORSE_LEASE_V2' AND clause_key='INSURANCE_RISK.MAJOR_MEDICAL_WILL';

-- ============================================================================
-- 2. field gating
-- ============================================================================
-- stated deductible: LESSOR_HAS only
UPDATE contract_field_defs f SET
  conditional_on = jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS'), 'field_key', t.pfx || '_ELECTION')
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx)
WHERE f.template_key='HORSE_LEASE_V2' AND f.field_key = t.pfx || '_DEDUCTIBLE';

-- responsibility select: stated $2+ OR either future election
UPDATE contract_field_defs f SET
  conditional_on = jsonb_build_object('any', jsonb_build_array(
    jsonb_build_object('all', jsonb_build_array(
      jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS'), 'field_key', t.pfx || '_ELECTION'),
      jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'))),
    jsonb_build_object('equals', jsonb_build_array('LESSOR_WILL','LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION')))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx)
WHERE f.template_key='HORSE_LEASE_V2' AND f.field_key = t.pfx || '_DEDUCTIBLE_PARTY';

-- $/% mode selector: LESSOR_HAS only
UPDATE contract_field_defs f SET
  conditional_on = jsonb_build_object('all', jsonb_build_array(
    jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS'), 'field_key', t.pfx || '_ELECTION'),
    jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'),
    jsonb_build_object('equals', jsonb_build_array('SPLIT'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx)
WHERE f.template_key='HORSE_LEASE_V2' AND f.field_key = t.pfx || '_DEDUCTIBLE_SPLIT_MODE';

-- shares: mode-gated for LESSOR_HAS; direct (%-only) for either future election
UPDATE contract_field_defs f SET
  guidance = 'Enter a number. Lessor-held policy in $ mode: the other share auto-fills from the stated deductible. % mode (and always for a policy not yet owned): the other share auto-fills to total 100%.',
  conditional_on = jsonb_build_object('any', jsonb_build_array(
    jsonb_build_object('all', jsonb_build_array(
      jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS'), 'field_key', t.pfx || '_ELECTION'),
      jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'),
      jsonb_build_object('equals', jsonb_build_array('SPLIT'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY'),
      jsonb_build_object('equals', jsonb_build_array('DOLLAR','PERCENT'), 'field_key', t.pfx || '_DEDUCTIBLE_SPLIT_MODE'))),
    jsonb_build_object('all', jsonb_build_array(
      jsonb_build_object('equals', jsonb_build_array('LESSOR_WILL','LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'),
      jsonb_build_object('equals', jsonb_build_array('SPLIT'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx)
WHERE f.template_key='HORSE_LEASE_V2'
  AND f.field_key IN (t.pfx || '_DEDUCTIBLE_SPLIT_LESSOR', t.pfx || '_DEDUCTIBLE_SPLIT_LESSEE');

-- ============================================================================
-- 3. clause gating
-- ============================================================================
-- factual sentence + $-anchored split: LESSOR_HAS only
UPDATE contract_clause_defs c SET
  conditional_on = jsonb_build_object('all', jsonb_build_array(
    jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS'), 'field_key', t.pfx || '_ELECTION'),
    jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'),
    jsonb_build_object('equals', s.party_vals, 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx),
     (VALUES ('_DED_PARTY', '["LESSOR","LESSEE"]'::jsonb),
             ('_DED_SPLIT', '["SPLIT"]'::jsonb)) AS s(suffix, party_vals)
WHERE c.template_key='HORSE_LEASE_V2'
  AND c.clause_key = replace(t.pfx,'TXN.','INSURANCE_RISK.') || s.suffix;

-- conditional-phrasing variants: either future election
UPDATE contract_clause_defs c SET
  conditional_on = jsonb_build_object('all', jsonb_build_array(
    jsonb_build_object('equals', jsonb_build_array('LESSOR_WILL','LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'),
    jsonb_build_object('equals', s.party_vals, 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx),
     (VALUES ('_DED_PARTY_FUTURE', '["LESSOR","LESSEE"]'::jsonb),
             ('_DED_SPLIT_FUTURE', '["SPLIT"]'::jsonb)) AS s(suffix, party_vals)
WHERE c.template_key='HORSE_LEASE_V2'
  AND c.clause_key = replace(t.pfx,'TXN.','INSURANCE_RISK.') || s.suffix;

-- Other: stated $2+ OR either future election
UPDATE contract_clause_defs c SET
  conditional_on = jsonb_build_object('all', jsonb_build_array(
    jsonb_build_object('any', jsonb_build_array(
      jsonb_build_object('all', jsonb_build_array(
        jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS'), 'field_key', t.pfx || '_ELECTION'),
        jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'))),
      jsonb_build_object('equals', jsonb_build_array('LESSOR_WILL','LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'))),
    jsonb_build_object('equals', jsonb_build_array('OTHER'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx)
WHERE c.template_key='HORSE_LEASE_V2'
  AND c.clause_key = replace(t.pfx,'TXN.','INSURANCE_RISK.') || '_DED_OTHER';

-- also gate the OTHER fill-in field the same way
UPDATE contract_field_defs f SET
  conditional_on = jsonb_build_object('all', jsonb_build_array(
    jsonb_build_object('any', jsonb_build_array(
      jsonb_build_object('all', jsonb_build_array(
        jsonb_build_object('equals', jsonb_build_array('LESSOR_HAS'), 'field_key', t.pfx || '_ELECTION'),
        jsonb_build_object('gte', 2, 'field_key', t.pfx || '_DEDUCTIBLE'))),
      jsonb_build_object('equals', jsonb_build_array('LESSOR_WILL','LESSEE_OBTAIN'), 'field_key', t.pfx || '_ELECTION'))),
    jsonb_build_object('equals', jsonb_build_array('OTHER'), 'field_key', t.pfx || '_DEDUCTIBLE_PARTY')))
FROM (VALUES ('TXN.GL'), ('TXN.MORTALITY'), ('TXN.MAJOR_MEDICAL')) AS t(pfx)
WHERE f.template_key='HORSE_LEASE_V2' AND f.field_key = t.pfx || '_DEDUCTIBLE_OTHER';

-- ============================================================================
-- 4. trigger: family = stated (HAS) / future (WILL, OBTAIN) / none;
--    % fallback covers both future elections
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

  -- (a0) election family change (stated / future / none): clear the deductible
  -- subtree so stale values never render. Moves within the future family
  -- (Lessor-will <-> Lessee-obtain) keep entered values.
  IF NEW.field_key ~ '_ELECTION$' THEN
    IF (CASE WHEN coalesce(NEW.value,'') = 'LESSOR_HAS' THEN 'S'
             WHEN coalesce(NEW.value,'') IN ('LESSOR_WILL','LESSEE_OBTAIN') THEN 'F' ELSE 'N' END)
       IS DISTINCT FROM
       (CASE WHEN coalesce(OLD.value,'') = 'LESSOR_HAS' THEN 'S'
             WHEN coalesce(OLD.value,'') IN ('LESSOR_WILL','LESSEE_OBTAIN') THEN 'F' ELSE 'N' END) THEN
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

  -- (a) stated deductible edited (LESSOR_HAS only): under $2 / N-A /
  -- unparseable -> responsibility moot, clear it and all children. $2+ with an
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

  -- (d) share entry: normalize + auto-fill the counterpart. Future-policy
  -- elections (Lessor-will, Lessee-obtain) have no mode selector — always %.
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
    IF v_el IN ('LESSOR_WILL','LESSEE_OBTAIN') THEN v_mode := 'PERCENT'; END IF;
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

-- ============================================================================
-- 5. verify
-- ============================================================================
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2' AND clause_key LIKE '%\_WILL'
     AND section_key='INSURANCE_RISK' AND body LIKE '%deductible of%';
  IF v_n <> 0 THEN RAISE EXCEPTION '% _WILL bodies still state a deductible', v_n; END IF;

  SELECT count(*) INTO v_n FROM contract_field_defs
   WHERE template_key='HORSE_LEASE_V2' AND field_key LIKE '%\_DEDUCTIBLE'
     AND section='INSURANCE_RISK' AND conditional_on::text LIKE '%LESSOR_WILL%';
  IF v_n <> 0 THEN RAISE EXCEPTION 'stated-deductible field still offered for LESSOR_WILL'; END IF;

  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2' AND clause_key LIKE '%\_FUTURE'
     AND conditional_on::text LIKE '%LESSOR_WILL%';
  IF v_n <> 6 THEN RAISE EXCEPTION 'expected 6 future clauses covering LESSOR_WILL, found %', v_n; END IF;

  SELECT count(*) INTO v_n FROM contract_clause_defs
   WHERE template_key='HORSE_LEASE_V2' AND clause_key ~ '_DED_(PARTY|SPLIT)$'
     AND conditional_on::text LIKE '%LESSOR_WILL%';
  IF v_n <> 0 THEN RAISE EXCEPTION 'stated-deductible clauses still include LESSOR_WILL'; END IF;
END $$;

COMMIT;
