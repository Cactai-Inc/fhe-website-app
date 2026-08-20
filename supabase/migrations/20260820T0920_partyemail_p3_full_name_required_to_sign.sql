-- PARTYEMAIL PHASE 3 — a full name is required to be signable.
--
-- D22 §7 (owner, 2026-08-20): "only an email address is required for a contract to
-- have a valid party and it must have a full name for it to be signable".
--
-- The second half was not enforced. contract_lock_blockers raised
-- `required_fields`, `party_type_mismatch`, `horse_unconfirmed`,
-- `open_change_requests` and `onboarding_documents` — and no name blocker at all.
-- It also coalesces a party's display name to `... c.email, 'A party'`, so a
-- nameless signer rendered as their email address or as the literal string
-- "A party" and signing was not prevented. A signature whose printed name is
-- "A party" is worthless, and the name is the one thing the signature attests to.
--
-- THE PREDICATE. A signing party blocks when EITHER
--   * their contact record carries no name (the source of truth is empty), OR
--   * the party namespace's .FULL_NAME / .PRINTED_NAME token exists on this
--     document and is blank (what would actually print is empty).
-- The two are checked together because they can disagree: a contract created
-- before the record was named holds blank tokens, and a record named after the
-- fact does not retroactively fill a document nobody has re-generated.
--
-- The 'A party' fallback stays for DISPLAY — it is how this blocker names someone
-- who has neither name nor email — but it no longer satisfies signability.
--
-- The company party is exempt (it signs as an entity, through its company contact),
-- as are the FHE / COMPANY roles, matching the onboarding_documents blocker above it.
--
-- ONE CHECK, NOT TWO. Defect A2 was two disagreeing completeness checks. The
-- screen's blocker list is rendered from THIS function's output (via
-- approve_contract_review and advance_document_workflow), and the Parties & Horse
-- card is changed in the same commit to say that a missing name blocks signing —
-- so the card and the gate say the same thing.
--
-- Reissued from the live prod body (pg_get_functiondef, 2026-08-20) with one added
-- block; everything else is verbatim.

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
  v_unnamed text[];
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

  -- D3 REMOVED 2026-08-10 (owner ruling): the four LESSEE acceptance checkboxes it
  -- read -- TXN.{GL_DED,CCC,MORT,MED}_LESSEE_ACCEPT -- are deleted. The Lessee signs
  -- the contract; a separate acknowledgment of an allocated cost added a control
  -- without adding consent. A blocker keyed on fields that no longer exist could
  -- never be satisfied, so it goes in the same migration. The generic
  -- required-fields rule above is untouched and still blocks a blank declaration,
  -- gate-aware -- which is what enforces a live requirement.

  RETURN v_blockers;
END;
$function$;
