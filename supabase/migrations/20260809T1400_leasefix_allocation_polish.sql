/*
  # LEASEFIX batch 2d — three defects found rendering the rebuilt section

  1. `to_char(60, 'FM990.99')` yields "60." — the contract printed "(60.%)".
     Percentages now format through rtrim(..., '.'), so a whole number prints "60%"
     and a fraction still prints "62.5%".

  2. The split sentence printed a hole. With "$180 paid by Lessor" and the Lessee's
     share left for the remainder, the clause read
       "...split between the parties: $180 paid by Lessor and  paid by Lessee."
     The remainder was stated correctly one line below, but a blank mid-sentence in
     an executed instrument is not acceptable. The two share inputs become authoring
     controls and the SENTENCE is composed, exactly as the allocation line already
     was — so it reads "…and the remaining balance paid by Lessee".

  3. `TXN.MORT_DED_RESP` and `TXN.MED_DED_RESP` were both labelled "Deductible
     responsibility", so the lock blocker listed the same words twice with no way to
     tell which section was unanswered.

  Requires PGCLIENTENCODING=UTF8.
*/

CREATE TEMP TABLE _lf(k text) ON COMMIT DROP;
INSERT INTO _lf VALUES
  ('HORSE_LEASE_V2'), ('HORSE_LEASE_STANDARD'), ('HORSE_LEASE_FULL'), ('HORSE_LEASE_SIMPLE');


-- ── 3. tell the two deductible questions apart ───────────────────────────────
UPDATE contract_field_defs SET label = 'Mortality deductible responsibility'
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MORT_DED_RESP';
UPDATE contract_field_defs SET label = 'Medical deductible responsibility'
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.MED_DED_RESP';
UPDATE contract_field_defs SET label = 'General liability deductible responsibility'
 WHERE template_key IN (SELECT k FROM _lf) AND field_key = 'TXN.GL_DED_RESP';


-- ── 2. the split sentence becomes composed text ──────────────────────────────
INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, required, is_optional, sort_order, conditional_on)
SELECT k, 'TXN.MORT_COST_SPLIT_TEXT', 'Split (composed)', 'INSURANCE_RISK',
       'INSURANCE_RISK.MORT_COST_SPLIT', 'SYSTEM', 'text', 'text', false, true, 207,
       '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
                 {"equals": ["SPLIT"], "field_key": "TXN.MORT_COST_RESP"}]}'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;

INSERT INTO contract_field_defs (
  template_key, field_key, label, section, clause_key, owner_role,
  input_kind, value_type, required, is_optional, sort_order, conditional_on)
SELECT k, 'TXN.MED_COST_SPLIT_TEXT', 'Split (composed)', 'INSURANCE_RISK',
       'INSURANCE_RISK.MED_COST_SPLIT', 'SYSTEM', 'text', 'text', false, true, 307,
       '{"all": [{"equals": ["REQUIRED"], "field_key": "TXN.MORT_ELECTION"},
                 {"equals": ["YES"], "field_key": "TXN.MED_INCLUDED"},
                 {"equals": ["SPLIT"], "field_key": "TXN.MED_COST_RESP"}]}'::jsonb
  FROM _lf
ON CONFLICT (template_key, field_key) DO NOTHING;

UPDATE contract_clause_defs
   SET body = 'The cost of the policy shall be split between the parties: {{TXN.MORT_COST_SPLIT_TEXT}}'
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MORT_COST_SPLIT';

UPDATE contract_clause_defs
   SET body = 'The cost of the medical component shall be split between the parties: {{TXN.MED_COST_SPLIT_TEXT}}'
 WHERE template_key IN (SELECT k FROM _lf) AND clause_key = 'INSURANCE_RISK.MED_COST_SPLIT';


-- ── 1 + 2. the composer, rewritten ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compose_insurance_allocation(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pref text; v_noun text;
  v_cost_raw text; v_resp text; v_lr text; v_le text;
  v_cost numeric; v_lr_pct numeric; v_le_pct numeric;
  v_lr_amt numeric; v_le_amt numeric;
  v_alloc text; v_split text;
  fn_num CONSTANT text := '[^0-9.]';
BEGIN
  FOREACH v_pref IN ARRAY ARRAY['MORT','MED'] LOOP
    v_noun := CASE v_pref WHEN 'MORT' THEN 'the policy' ELSE 'the medical component' END;

    SELECT coalesce(trim(value),'') INTO v_cost_raw FROM contract_fields
     WHERE document_id = p_document_id AND field_key = 'TXN.'||v_pref||'_POLICY_COST';
    CONTINUE WHEN NOT FOUND;

    SELECT coalesce(trim(value),'') INTO v_resp FROM contract_fields
     WHERE document_id = p_document_id AND field_key = 'TXN.'||v_pref||'_COST_RESP';
    SELECT coalesce(trim(value),'') INTO v_lr FROM contract_fields
     WHERE document_id = p_document_id AND field_key = 'TXN.'||v_pref||'_COST_SPLIT_LESSOR';
    SELECT coalesce(trim(value),'') INTO v_le FROM contract_fields
     WHERE document_id = p_document_id AND field_key = 'TXN.'||v_pref||'_COST_SPLIT_LESSEE';

    v_alloc := ''; v_split := '';
    v_lr_pct := NULL; v_le_pct := NULL; v_lr_amt := NULL; v_le_amt := NULL;
    v_cost := nullif(regexp_replace(v_cost_raw, fn_num, '', 'g'), '')::numeric;

    -- classify each share as a percentage or a money amount
    IF v_lr LIKE '%\%%' THEN
      v_lr_pct := nullif(regexp_replace(v_lr, fn_num, '', 'g'), '')::numeric;
    ELSE
      v_lr_amt := nullif(regexp_replace(v_lr, fn_num, '', 'g'), '')::numeric;
    END IF;
    IF v_le LIKE '%\%%' THEN
      v_le_pct := nullif(regexp_replace(v_le, fn_num, '', 'g'), '')::numeric;
    ELSE
      v_le_amt := nullif(regexp_replace(v_le, fn_num, '', 'g'), '')::numeric;
    END IF;

    -- ── the split SENTENCE. Composed so a one-sided entry still reads as a
    --    complete sentence: the other side is "the remaining balance".
    IF v_resp = 'SPLIT' THEN
      IF (v_lr_pct IS NOT NULL OR v_le_pct IS NOT NULL)
         AND v_lr_amt IS NULL AND v_le_amt IS NULL THEN
        v_lr_pct := coalesce(v_lr_pct, 100 - v_le_pct);
        v_le_pct := coalesce(v_le_pct, 100 - v_lr_pct);
        IF v_lr_pct >= 0 AND v_le_pct >= 0 THEN
          v_split := rtrim(to_char(v_lr_pct,'FM999990.99'),'.')||'% paid by Lessor and '
                   ||rtrim(to_char(v_le_pct,'FM999990.99'),'.')||'% paid by Lessee.';
        END IF;
      ELSIF v_lr_amt IS NOT NULL AND v_le_amt IS NOT NULL THEN
        v_split := '$'||to_char(v_lr_amt,'FM999,999,990.00')||' paid by Lessor and $'
                 ||to_char(v_le_amt,'FM999,999,990.00')||' paid by Lessee.';
      ELSIF v_lr_amt IS NOT NULL THEN
        v_split := '$'||to_char(v_lr_amt,'FM999,999,990.00')
                 ||' paid by Lessor and the remaining balance paid by Lessee.';
      ELSIF v_le_amt IS NOT NULL THEN
        v_split := '$'||to_char(v_le_amt,'FM999,999,990.00')
                 ||' paid by Lessee and the remaining balance paid by Lessor.';
      END IF;
    END IF;

    -- ── the allocation LINE, only once a policy cost is known
    IF v_cost IS NOT NULL AND v_cost > 0 THEN
      IF v_resp = 'LESSOR_FULL' THEN
        v_alloc := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
                 ||', payable in full by Lessor.';

      ELSIF v_resp = 'LESSEE' THEN
        v_alloc := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
                 ||', payable in full by Lessee.';

      ELSIF v_resp = 'SPLIT' THEN
        IF v_lr_pct IS NOT NULL AND v_le_pct IS NOT NULL
           AND v_lr_amt IS NULL AND v_le_amt IS NULL
           AND v_lr_pct >= 0 AND v_le_pct >= 0 THEN
          v_alloc := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
            ||'. Lessor''s share: $'||to_char(round(v_cost*v_lr_pct/100, 2),'FM999,999,990.00')
            ||' ('||rtrim(to_char(v_lr_pct,'FM999990.99'),'.')||'%)'
            ||'. Lessee''s share: $'||to_char(round(v_cost*v_le_pct/100, 2),'FM999,999,990.00')
            ||' ('||rtrim(to_char(v_le_pct,'FM999990.99'),'.')||'%).';

        ELSIF v_lr_amt IS NOT NULL AND v_le_amt IS NOT NULL THEN
          v_alloc := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
            ||'. Lessor''s share: $'||to_char(v_lr_amt,'FM999,999,990.00')
            ||'. Lessee''s share: $'||to_char(v_le_amt,'FM999,999,990.00')||'.';

        ELSIF v_lr_amt IS NOT NULL AND v_le_amt IS NULL AND v_lr_amt <= v_cost THEN
          v_alloc := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
            ||'. Lessor''s share: $'||to_char(v_lr_amt,'FM999,999,990.00')
            ||'. Lessee''s share: $'||to_char(v_cost-v_lr_amt,'FM999,999,990.00')
            ||' (the remaining balance).';

        ELSIF v_le_amt IS NOT NULL AND v_lr_amt IS NULL AND v_le_amt <= v_cost THEN
          v_alloc := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
            ||'. Lessee''s share: $'||to_char(v_le_amt,'FM999,999,990.00')
            ||'. Lessor''s share: $'||to_char(v_cost-v_le_amt,'FM999,999,990.00')
            ||' (the remaining balance).';
        END IF;
      END IF;
    END IF;

    UPDATE contract_fields SET value = v_alloc, updated_at = now()
     WHERE document_id = p_document_id
       AND field_key = 'TXN.'||v_pref||'_COST_ALLOCATION'
       AND coalesce(value,'') IS DISTINCT FROM v_alloc;

    UPDATE contract_fields SET value = v_split, updated_at = now()
     WHERE document_id = p_document_id
       AND field_key = 'TXN.'||v_pref||'_COST_SPLIT_TEXT'
       AND coalesce(value,'') IS DISTINCT FROM v_split;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.compose_insurance_allocation(uuid) FROM PUBLIC, anon;
