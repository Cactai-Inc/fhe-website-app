/*
  # LEASEFIX batch 2c — the computed cost allocation, and the lock rules

  1. compose_insurance_allocation(). The engine has had no arithmetic: every value
     was typed or composed from text. The owner wants the policy cost stated once
     and each party's share derived from it, so this composes that sentence into
     TXN.{MORT,MED}_COST_ALLOCATION. It runs inside recompose_document_fields,
     which remerge_contract_from_clauses already calls first, so the sentence is
     always current with the fields it is derived from.

     Owner's rules, implemented literally:
       • % is the real mechanism — the disclaimer says percentages govern any
         change in the cost of the policy, so a % share computes both sides.
       • A $ share on one side leaves the other side "the remaining balance",
         rather than back-filling a number that may or may not be intended to
         move when the premium moves.
       • Mixed $/% or unparseable input composes NOTHING rather than guessing.
         A clause line whose only token is empty is dropped by remerge, so the
         contract simply carries the shares as written.

  2. contract_lock_blockers D3 rewrite. The old rule keyed off
     TXN.*_LESSOR_STATUS / _LESSEE_STATUS / _NOT_REQUIRED / _LESSEE_RESPONSIBLE —
     every one of those field keys was retired in batch 2b, so the rule had become
     dead code that could never fire.

     Its replacement is narrower on purpose. The ELECTIONS are `required`, so the
     generic required-fields rule already blocks an unanswered one, gate-aware.
     What that rule cannot see is a certify checkbox: certifications are
     is_optional, because unticked is a legitimate state until signing. But where
     the Lessor has allocated a COST to the Lessee, the Lessee's acceptance is the
     consideration for that allocation, and the contract must not lock without it.

  Requires PGCLIENTENCODING=UTF8.
*/

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
  v_out text;
  -- a value is a percentage if it says so; otherwise it is money
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

    v_out  := '';
    v_cost := nullif(regexp_replace(v_cost_raw, fn_num, '', 'g'), '')::numeric;

    IF v_cost IS NOT NULL AND v_cost > 0 THEN
      IF v_resp = 'LESSOR_FULL' THEN
        v_out := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
                 ||', payable in full by Lessor.';

      ELSIF v_resp = 'LESSEE' THEN
        v_out := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
                 ||', payable in full by Lessee.';

      ELSIF v_resp = 'SPLIT' THEN
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

        -- percentages: one side is enough, the other is the remainder of 100
        IF v_lr_pct IS NOT NULL OR v_le_pct IS NOT NULL THEN
          IF v_lr_amt IS NULL AND v_le_amt IS NULL THEN
            v_lr_pct := coalesce(v_lr_pct, 100 - v_le_pct);
            v_le_pct := coalesce(v_le_pct, 100 - v_lr_pct);
            IF v_lr_pct >= 0 AND v_le_pct >= 0 THEN
              v_out := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
                ||'. Lessor''s share: $'||to_char(round(v_cost*v_lr_pct/100, 2),'FM999,999,990.00')
                ||' ('||to_char(v_lr_pct,'FM990.99')||'%)'
                ||'. Lessee''s share: $'||to_char(round(v_cost*v_le_pct/100, 2),'FM999,999,990.00')
                ||' ('||to_char(v_le_pct,'FM990.99')||'%).';
            END IF;
          END IF;   -- mixed $ and % → nothing composed

        -- money: a stated amount on one side leaves the other the remaining balance
        ELSIF v_lr_amt IS NOT NULL AND v_le_amt IS NOT NULL THEN
          v_out := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
            ||'. Lessor''s share: $'||to_char(v_lr_amt,'FM999,999,990.00')
            ||'. Lessee''s share: $'||to_char(v_le_amt,'FM999,999,990.00')||'.';

        ELSIF v_lr_amt IS NOT NULL AND v_lr_amt <= v_cost THEN
          v_out := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
            ||'. Lessor''s share: $'||to_char(v_lr_amt,'FM999,999,990.00')
            ||'. Lessee''s share: $'||to_char(v_cost-v_lr_amt,'FM999,999,990.00')
            ||' (the remaining balance).';

        ELSIF v_le_amt IS NOT NULL AND v_le_amt <= v_cost THEN
          v_out := 'Cost of '||v_noun||': $'||to_char(v_cost,'FM999,999,990.00')
            ||'. Lessee''s share: $'||to_char(v_le_amt,'FM999,999,990.00')
            ||'. Lessor''s share: $'||to_char(v_cost-v_le_amt,'FM999,999,990.00')
            ||' (the remaining balance).';
        END IF;
      END IF;
    END IF;

    UPDATE contract_fields SET value = v_out, updated_at = now()
     WHERE document_id = p_document_id
       AND field_key = 'TXN.'||v_pref||'_COST_ALLOCATION'
       AND coalesce(value,'') IS DISTINCT FROM v_out;

    v_lr_pct := NULL; v_le_pct := NULL; v_lr_amt := NULL; v_le_amt := NULL;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.compose_insurance_allocation(uuid) FROM PUBLIC, anon;


-- ── run the allocation pass wherever fields are recomposed ─────────────────
CREATE OR REPLACE FUNCTION public.recompose_document_fields(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r RECORD; v_manage jsonb;
BEGIN
  -- 1. every field that has structure → compose its own value
  FOR r IN SELECT field_key, format_type, structured, value, label, pair_manage_key
             FROM contract_fields WHERE document_id = p_document_id LOOP
    IF r.pair_manage_key IS NOT NULL THEN
      CONTINUE;  -- cost children handled in pass 2 (need the manage field's structure)
    END IF;
    IF r.structured IS NOT NULL AND r.structured <> '{}'::jsonb THEN
      UPDATE contract_fields
         SET value = compose_field_prose(r.format_type, r.structured, r.label, r.value),
             updated_at = now()
       WHERE document_id = p_document_id AND field_key = r.field_key;
    END IF;
  END LOOP;

  -- 2. pair cost children → compose from the manage field's structure
  FOR r IN SELECT c.field_key, c.label, m.structured AS manage_structured
             FROM contract_fields c
             JOIN contract_fields m ON m.document_id = c.document_id AND m.field_key = c.pair_manage_key
            WHERE c.document_id = p_document_id AND c.pair_manage_key IS NOT NULL LOOP
    IF r.manage_structured IS NOT NULL AND r.manage_structured <> '{}'::jsonb THEN
      UPDATE contract_fields
         SET value = compose_pair_cost(r.manage_structured, r.label), updated_at = now()
       WHERE document_id = p_document_id AND field_key = r.field_key;
    END IF;
  END LOOP;

  -- 3. LEASEFIX 2026-08-09: derived insurance cost allocation. No-ops on every
  --    template that has no TXN.*_POLICY_COST field, i.e. everything but the lease.
  PERFORM compose_insurance_allocation(p_document_id);
END;
$function$;


-- ── lock rules ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_lock_blockers(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_blockers jsonb := '[]'::jsonb;
  v_open int;
  v_vals jsonb := '{}'::jsonb;
  r record;
  v_missing text[];
  v_horse_confirmed timestamptz;
  v_needs_horse boolean;
  v_is_onboarding boolean;
  v_unready text[];
  v_sec text;
  v_label text;
BEGIN
  SELECT horse_section_confirmed_at INTO v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  SELECT count(*) INTO v_open FROM contract_change_requests
   WHERE document_id = p_document_id
     AND parent_request_id IS NULL AND submitted_at IS NOT NULL AND resolved_at IS NULL;
  IF v_open > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'open_change_requests',
      'message', v_open || ' open change request(s) must be resolved'));
  END IF;

  FOR r IN SELECT field_key, coalesce(trim(value), '') AS val
             FROM contract_fields WHERE document_id = p_document_id LOOP
    v_vals := v_vals || jsonb_build_object(r.field_key, r.val);
  END LOOP;
  SELECT array_agg(coalesce(cf.label, cf.field_key) ORDER BY cf.sort_order, cf.field_key)
    INTO v_missing
    FROM contract_fields cf
    LEFT JOIN contract_clause_defs cd
      ON cd.template_key = (SELECT ct.template_key FROM documents d
                             JOIN contract_templates ct ON ct.id = d.template_id
                            WHERE d.id = p_document_id)
     AND cd.clause_key = cf.clause_key
   WHERE cf.document_id = p_document_id AND cf.required
     AND coalesce(cf.included, true) AND NOT coalesce(cf.is_na, false)
     AND nullif(trim(coalesce(cf.value, '')), '') IS NULL
     -- a clause gated on THIS field (a self-gating driver) counts as visible
     -- for the required check — an unanswered gate must block, never hide
     AND (clause_condition_met(cd.conditional_on, v_vals)
          OR (cd.conditional_on IS NOT NULL
              AND cd.conditional_on::text LIKE '%"' || cf.field_key || '"%'))
     AND clause_condition_met(cf.conditional_on, v_vals);
  IF v_missing IS NOT NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'required_fields',
      'message', 'Required field(s) still empty: ' || array_to_string(v_missing, ', ')));
  END IF;

  IF EXISTS (
    SELECT 1 FROM contract_fields cf
      JOIN documents d2 ON d2.id = cf.document_id
      JOIN contract_parties cp2 ON cp2.contract_id = d2.contract_id AND cp2.party_role = 'LESSEE'
      JOIN contacts c2 ON c2.id = cp2.contact_id
     WHERE cf.document_id = p_document_id AND cf.field_key = 'LESSEE.PARTY_TYPE'
       AND ((cf.value = 'INDIVIDUAL' AND coalesce(c2.is_company,false))
         OR (cf.value = 'ENTITY' AND NOT coalesce(c2.is_company,false)))
  ) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'party_type_mismatch',
      'message', 'LESSEE.PARTY_TYPE contradicts the Lessee party record (person vs company) — correct the field or the contact record'));
  END IF;

  v_needs_horse := EXISTS (
    SELECT 1 FROM contract_fields
    WHERE document_id = p_document_id
      AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
  IF v_needs_horse AND v_horse_confirmed IS NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'horse_unconfirmed',
      'message', 'The horse information has not been confirmed by the Lessor'));
  END IF;

  -- ── document-before-contract ───────────────────────────────────────────────
  SELECT coalesce(ct.wall_gating, false) INTO v_is_onboarding
    FROM documents d JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.id = p_document_id;

  IF NOT coalesce(v_is_onboarding, false) THEN
    SELECT array_agg(DISTINCT nm ORDER BY nm) INTO v_unready
      FROM (
        SELECT coalesce(nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
                        c.email, 'A party') AS nm
          FROM document_parties dp
          JOIN contacts c ON c.id = dp.contact_id
         WHERE dp.document_id = p_document_id
           AND dp.is_signer AND dp.contact_id IS NOT NULL
           AND NOT coalesce(c.is_company, false)
           AND dp.party_role NOT IN ('FHE','COMPANY')
           AND (contact_document_wall_state(c.id)->>'gating')::int > 0
      ) x;

    IF v_unready IS NOT NULL THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'onboarding_documents',
        'message', 'Onboarding documents must be completed first by: '
                   || array_to_string(v_unready, ', ')));
    END IF;
  END IF;

  -- ── D3 (rewritten 2026-08-09, LEASEFIX): INSURANCE ACCEPTANCES ────────────
  -- The old rule keyed off TXN.*_LESSOR_STATUS / _LESSEE_STATUS / _NOT_REQUIRED /
  -- _LESSEE_RESPONSIBLE, all retired — it could no longer fire. The elections that
  -- replaced them are `required`, so the generic required-fields rule above already
  -- blocks an unanswered one, gate-aware. This covers what that rule cannot see: a
  -- certify checkbox is is_optional (unticked is legitimate until signing), but
  -- where the Lessor has allocated a COST to the Lessee, the Lessee's acceptance is
  -- the consideration for it and the contract must not lock without it.
  SELECT array_agg(left(coalesce(cf.label, cf.field_key), 60) ORDER BY cf.sort_order)
    INTO v_missing
    FROM contract_fields cf
   WHERE cf.document_id = p_document_id
     AND cf.field_key IN ('TXN.GL_DED_LESSEE_ACCEPT', 'TXN.MORT_LESSEE_ACCEPT',
                          'TXN.MED_LESSEE_ACCEPT', 'TXN.CCC_LESSEE_ACCEPT')
     AND clause_condition_met(cf.conditional_on, v_vals)
     AND upper(coalesce(trim(cf.value), '')) <> 'YES';
  IF v_missing IS NOT NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'insurance_acceptance_unchecked',
      'message', 'Lessee has not accepted a cost allocated to them: '
                 || array_to_string(v_missing, '; ')));
  END IF;

  RETURN v_blockers;
END;
$function$;
