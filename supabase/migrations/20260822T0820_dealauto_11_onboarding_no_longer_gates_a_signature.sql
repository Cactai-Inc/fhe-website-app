-- DEALAUTO follow-up §F2 (second half) — the onboarding wall stops gating
-- contract signatures.
--
-- Owner, 2026-08-22, ruling on the report's F2, and confirmed when asked how far
-- it should go: **off entirely.** "Lessee paperwork is handled separately and
-- doesnt gate signing nor required after signing."
--
-- WHAT IS BEING REMOVED, EXACTLY. One of six blockers in
-- `contract_lock_blockers`: the `onboarding_documents` check, which refused to
-- lock or sign ANY contract while ANY individual signer on it still had a
-- gating document outstanding on their onboarding wall — Company Policies,
-- Facility Rules, Human Emergency Medical Authorization, Participant Liability
-- Release. It applied to LESSEE, LESSOR, BUYER and SELLER alike, and it was
-- skipped only when the document being signed was itself a wall document.
--
-- WHAT IS NOT BEING REMOVED. The onboarding wall itself is untouched:
-- `contact_document_wall_state` still computes it, `/app/onboarding` still
-- presents it, and everything else that reads it still reads it. Only its
-- authority over a contract signature goes. The other five blockers stand
-- unchanged — open change requests, empty required fields, a signer with no
-- full name, a LESSEE.PARTY_TYPE that contradicts the party record, and an
-- unconfirmed horse section.
--
-- ⚠️ THE CONSEQUENCE, STATED PLAINLY: a lease or a sale can now be executed by
-- someone who has not signed a participant liability release. That is the
-- owner's call and he made it knowing the trade — the lease and the bill of
-- sale carry their own release, assumption-of-risk and indemnification
-- language, and the wall's purpose is arrival on the property, which is a
-- different event from signing a contract.
--
-- ⚠️ THE UI MIRRORS THIS GUARD INDEPENDENTLY and must move with it.
-- ContractPage calls `myWallState()` itself and hides the signing box on its own
-- answer, so removing only the server-side check would have produced a contract
-- that the database would accept and the page would still refuse to offer —
-- the same defect in reverse. Retired there in the same commit, behind
-- `CONTRACT_ONBOARDING_GATE_RETIRED`.

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
  v_unnamed text[];
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

  -- ── PARTYEMAIL PHASE 3: a signer must have a full name ─────────────────────
  SELECT array_agg(DISTINCT nm ORDER BY nm) INTO v_unnamed
    FROM (
      SELECT coalesce(nullif(btrim(coalesce(c.email,'')), ''), 'A party') AS nm
        FROM (
          SELECT dp.contact_id, dp.party_role,
                 CASE WHEN dp.party_role = 'BUYER'
                       AND row_number() OVER (PARTITION BY dp.party_role
                                              ORDER BY dp.signer_order NULLS LAST, dp.id) > 1
                      THEN 'COBUYER' ELSE dp.party_role END AS ns
            FROM document_parties dp
           WHERE dp.document_id = p_document_id AND dp.is_signer
        ) p
        JOIN contacts c ON c.id = p.contact_id
       WHERE NOT coalesce(c.is_company, false)
         AND p.party_role NOT IN ('FHE','COMPANY')
         AND (
           nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), '') IS NULL
           OR EXISTS (
                SELECT 1 FROM contract_fields cf
                 WHERE cf.document_id = p_document_id
                   AND cf.field_key IN (p.ns || '.FULL_NAME', p.ns || '.PRINTED_NAME')
                   AND nullif(btrim(coalesce(cf.value,'')), '') IS NULL)
         )
    ) x;
  IF v_unnamed IS NOT NULL THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'party_name_required',
      'message', 'A full name is required before signing for: '
                 || array_to_string(v_unnamed, ', ')));
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

  -- ── document-before-contract: REMOVED 2026-08-22 (owner ruling) ────────────
  -- The `onboarding_documents` blocker lived here. It read
  -- contact_document_wall_state(signer)->>'gating' > 0 for every non-company
  -- signer and refused the signature with "Onboarding documents must be
  -- completed first by: <names>". The onboarding wall is still computed, still
  -- presented at /app/onboarding, and still read by everything else that reads
  -- it — it simply no longer decides whether a contract may be signed. The
  -- wall's subject is arrival on the property; a signature is a different
  -- event, and the lease and bill of sale carry their own release and
  -- indemnification language. Asked and confirmed explicitly: off entirely, not
  -- narrowed to the client side.
  --
  -- D3 REMOVED 2026-08-10 (owner ruling): the four LESSEE acceptance checkboxes
  -- it read are deleted; a blocker keyed on fields that no longer exist could
  -- never be satisfied. The generic required-fields rule above is untouched.

  RETURN v_blockers;
END;
$function$;
