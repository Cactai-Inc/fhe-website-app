/*
  # contract_lock_blockers — self-gating driver fields must block while unset

  A GATE-DRIVER select (e.g. TXN.BREEDING_ELECTION, TXN.DEPOSIT_ENABLED, the
  lease's TXN.INJURY_HISTORY) links to a clause whose conditional_on references
  THE FIELD ITSELF. While the field is unset, that clause's condition is unmet,
  and the required-fields blocker skipped the field — so a required election
  could stay unanswered straight through signing, silently omitting both the
  elected and the declined language. The content files' declined bodies exist
  precisely so that omission is never silent ("blocks signing").

  Fix: for the REQUIRED check only, a clause condition that references the
  field's own key counts as met. Required-when-shown fields gated by OTHER
  fields (cf.conditional_on) are unaffected.

  Full replace of the live body; the only change is the marked predicate.
*/

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

  -- ── D3: INSURANCE RESPONSIBILITY UNRESOLVED ────────────────────────────────
  FOREACH v_sec IN ARRAY ARRAY['GL','MORT','MED'] LOOP
    v_label := CASE v_sec WHEN 'GL' THEN 'General liability'
                          WHEN 'MORT' THEN 'Mortality'
                          ELSE 'Medical' END;
    IF (v_vals ? ('TXN.' || v_sec || '_LESSOR_STATUS'))
       AND (v_vals ? ('TXN.' || v_sec || '_LESSEE_STATUS'))
       AND coalesce(v_vals ->> ('TXN.' || v_sec || '_LESSOR_STATUS'), '') = 'NONE'
       AND coalesce(v_vals ->> ('TXN.' || v_sec || '_LESSEE_STATUS'), '') = 'NONE'
       AND coalesce(v_vals ->> ('TXN.' || v_sec || '_NOT_REQUIRED'), '') <> 'YES'
       AND coalesce(v_vals ->> ('TXN.' || v_sec || '_LESSEE_RESPONSIBLE'), '') <> 'YES'
    THEN
      v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
        'code', 'insurance_unresolved_' || lower(v_sec),
        'message', v_label || ' insurance responsibility unresolved — one party must accept it'));
    END IF;
  END LOOP;

  RETURN v_blockers;
END;
$function$;
