-- ============================================================================
-- U5 / STAGE 4b — INSURANCE RESOLUTION FLOW, DB UNIT (D1-D5)
-- Spec: docs/archive/insurance-resolution-spec.md (owner ruling 2026-08-01)
--
-- Mechanism only. This migration writes NO legal language: D2's clause bodies
-- are deliberately bracketed placeholders pending the legal pass (spec C1), and
-- signing is blocked in the unresolved state from D3 onward, so a placeholder
-- body can never reach an executed instrument.
--
-- Applies identically to all three insurance sections: GL, MORT, MED.
--
-- VERIFY-FIRST anchors confirmed live before writing (2026-08-02):
--   * owner_role 'LESSEE' is a real, in-use role (8 field defs carry it).
--     Every existing insurance field is owner_role='LESSOR', including the
--     LESSEE_STATUS fields and the existing certify — so the new certify is
--     the FIRST insurance field owned by the lessee side. That is the point:
--     only the party inheriting responsibility may elect it.
--   * status option value for "does not have and will not obtain" is 'NONE'.
--   * the existing certify is input_kind='certify', value_type='checkbox',
--     values 'YES'/'NO'/''.
--   * clause_condition_met supports 'all' AND 'any'; it has NO not_equals.
--   * {X}_NONE clause sort orders are GL 168 / MORT 220 / MED 305.
--   * HORSE_LEASE_V2 live documents: 5dbce25f + b7446f9e (drafts, repairable)
--     and ecaecd42 (EXECUTED — never touched by this migration).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- D1. New certify field def per section: TXN.{X}_LESSEE_RESPONSIBLE
--
-- Surfaces ONLY in the unresolved state, per the spec's conditional_on: both
-- statuses NONE and the lessor-side certify not YES. required=false (an
-- election, never a mandated answer). owner_role=LESSEE is the enforcement
-- anchor — it is what makes this box the lessee's alone.
--
-- sort_order 6 places it immediately after the existing certify (5) and before
-- the status selects (10/20), so the two mutually-exclusive elections render
-- side by side (spec F1).
-- ---------------------------------------------------------------------------
-- format_type='certify' is what the RENDERER keys on (ContractCascade.tsx:769
-- and ClauseDocument.tsx:573 both branch on format_type, not input_kind). Every
-- pre-existing certify carries both; omitting format_type would have made these
-- three render as plain text inputs instead of checkboxes.
INSERT INTO contract_field_defs (
  template_key, field_key, label, section, owner_role, input_kind, value_type,
  format_type, required, is_optional, sort_order, clause_key, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'TXN.GL_LESSEE_RESPONSIBLE',
   'The Lessee accepts financial responsibility for general liability insurance under this Agreement.',
   'INSURANCE_RISK', 'LESSEE', 'certify', 'checkbox', 'certify', false, true, 6,
   'INSURANCE_RISK.GL_LESSEE_RESP',
   '{"all":[{"equals":["NONE"],"field_key":"TXN.GL_LESSOR_STATUS"},{"equals":["NONE"],"field_key":"TXN.GL_LESSEE_STATUS"},{"equals":["NO",""],"field_key":"TXN.GL_NOT_REQUIRED"}]}'::jsonb),

  ('HORSE_LEASE_V2', 'TXN.MORT_LESSEE_RESPONSIBLE',
   'The Lessee accepts financial responsibility for mortality insurance under this Agreement.',
   'INSURANCE_RISK', 'LESSEE', 'certify', 'checkbox', 'certify', false, true, 6,
   'INSURANCE_RISK.MORT_LESSEE_RESP',
   '{"all":[{"equals":["NONE"],"field_key":"TXN.MORT_LESSOR_STATUS"},{"equals":["NONE"],"field_key":"TXN.MORT_LESSEE_STATUS"},{"equals":["NO",""],"field_key":"TXN.MORT_NOT_REQUIRED"}]}'::jsonb),

  ('HORSE_LEASE_V2', 'TXN.MED_LESSEE_RESPONSIBLE',
   'The Lessee accepts financial responsibility for medical insurance under this Agreement.',
   'INSURANCE_RISK', 'LESSEE', 'certify', 'checkbox', 'certify', false, true, 6,
   'INSURANCE_RISK.MED_LESSEE_RESP',
   '{"all":[{"equals":["NONE"],"field_key":"TXN.MED_LESSOR_STATUS"},{"equals":["NONE"],"field_key":"TXN.MED_LESSEE_STATUS"},{"equals":["NO",""],"field_key":"TXN.MED_NOT_REQUIRED"}]}'::jsonb)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- D2. New clause per section, gated on the new certify being YES, sorted
-- adjacent to {X}_NONE (168 / 220 / 305 -> 169 / 221 / 306).
--
-- BODY IS A PLACEHOLDER. The spec forbids drafting legal language in the DB
-- thread ("insert as a clearly-bracketed pending body"). The bracket text is
-- machine-detectable so the regeneration gate and the legal pass can both find
-- it, and D3 blocks signing while the state that renders it is unresolved.
-- ---------------------------------------------------------------------------
INSERT INTO contract_clause_defs (
  template_key, section_key, clause_key, heading, body, clause_type, sort_order,
  is_optional, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.GL_LESSEE_RESP',
   'General Liability — Lessee Responsibility',
   '[PENDING LEGAL REVIEW — body to be supplied by the contract review thread (spec C1). Placeholder: the Lessee has accepted financial responsibility for general liability insurance.]',
   'input', 169, false,
   '{"equals":["YES"],"field_key":"TXN.GL_LESSEE_RESPONSIBLE"}'::jsonb),

  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.MORT_LESSEE_RESP',
   'Mortality — Lessee Responsibility',
   '[PENDING LEGAL REVIEW — body to be supplied by the contract review thread (spec C1). Placeholder: the Lessee has accepted financial responsibility for mortality insurance.]',
   'input', 221, false,
   '{"equals":["YES"],"field_key":"TXN.MORT_LESSEE_RESPONSIBLE"}'::jsonb),

  ('HORSE_LEASE_V2', 'INSURANCE_RISK', 'INSURANCE_RISK.MED_LESSEE_RESP',
   'Medical — Lessee Responsibility',
   '[PENDING LEGAL REVIEW — body to be supplied by the contract review thread (spec C1). Placeholder: the Lessee has accepted financial responsibility for medical insurance.]',
   'input', 306, false,
   '{"equals":["YES"],"field_key":"TXN.MED_LESSEE_RESPONSIBLE"}'::jsonb)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- D1 (cont). Materialize the new defs onto the two DRAFT documents only.
-- The EXECUTED document is excluded by the status-keyed data rule: an executed
-- instrument's stored rows are never modified.
-- ---------------------------------------------------------------------------
DO $$
DECLARE d record;
BEGIN
  FOR d IN
    SELECT doc.id FROM documents doc
      JOIN contract_templates ct ON ct.id = doc.template_id
     WHERE ct.template_key = 'HORSE_LEASE_V2'
       AND doc.deleted_at IS NULL
       AND doc.status <> 'EXECUTED'
       AND coalesce(doc.workflow_state,'') <> 'executed'
  LOOP
    PERFORM sync_contract_fields_from_defs(d.id);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- D3. SIGNING GATE — full CREATE OR REPLACE rebuilt from the LIVE body
-- (pg_get_functiondef, captured 2026-08-02). The only change is the appended
-- insurance-resolution block; every pre-existing blocker is byte-identical.
--
-- Rule per section: if both statuses are NONE and neither certify is YES, the
-- section is unresolved and signing is blocked.
-- ---------------------------------------------------------------------------
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
     AND clause_condition_met(cd.conditional_on, v_vals)
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

  -- ── NEW: document-before-contract ──────────────────────────────────────────
  -- Any non-company signing party with unsatisfied wall-gating onboarding
  -- documents blocks the contract. Onboarding documents themselves are exempt
  -- (they are the wall; gating them on themselves would deadlock).
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
  -- Per section: both parties declared NONE and neither party has accepted
  -- responsibility. The contract cannot be signed in that state — someone must
  -- own the risk, or the Lessor must certify the coverage is not required.
  -- Only evaluated when the section's fields actually exist on this document,
  -- so non-lease templates are unaffected.
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

-- ---------------------------------------------------------------------------
-- D4. MUTUAL EXCLUSIVITY + PARTY-EXCLUSIVE ENFORCEMENT, server-side.
--
-- Full CREATE OR REPLACE rebuilt from the LIVE body (pg_get_functiondef,
-- captured 2026-08-02). Two additions, both confined to the two certify fields:
--
--   (a) THE STAFF CARVE-OUT the spec required explicitly. The live
--       authorization is `IF NOT (v_is_staff OR ...)`, so staff bypass
--       owner_role entirely. Because FHE is ITSELF the Lessor party on these
--       contracts, that bypass would let FHE staff check the LESSEE's box —
--       the precise thing the core rule forbids. For these two field keys ONLY,
--       staff status does not substitute for owning the role. Every other
--       field's authorization is unchanged.
--
--   (b) MUTUAL EXCLUSIVITY: setting either certify to YES while the other is
--       YES is rejected, naming the conflict.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_contract_field(p_document_id uuid, p_field_key text, p_value text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org        uuid;
  v_state      text;
  v_recip_edit boolean;
  v_owner_role text;
  v_is_staff   boolean;
  v_is_orig    boolean;
  v_owns_role  boolean;
  v_can_fill   boolean;
  v_can_deal   boolean;
  v_row        contract_fields%ROWTYPE;
  v_confirmed  timestamptz;
  v_old_value  text;
  v_label      text;
  v_changed    boolean;
  v_format     text;
  v_violation  text;
  v_sec        text;
  v_counterpart text;
  v_is_elect   boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing, horse_section_confirmed_at
    INTO v_org, v_state, v_recip_edit, v_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  SELECT owner_role, value, label INTO v_owner_role, v_old_value, v_label
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no field % on document %', p_field_key, p_document_id;
  END IF;

  IF v_state NOT IN ('editable','editing','in_review') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  -- THE CHANGES FREEZE (Notify model): an author may keep editing the document
  -- until a COUNTERPARTY has actually OPENED it. Requests freeze separately, per
  -- request, on being SEEN. Same predicate the Notify modal copy is built from.
  IF document_changes_frozen(p_document_id, NULL) THEN
    RAISE EXCEPTION 'this contract is fully executed — it can no longer be edited';
  END IF;

  -- U2.1c: money values must be canonical for their declared format BEFORE
  -- anything is written. A bare amount where the fee-schedule object belongs,
  -- a '$'-formatted string where a numeric belongs, or rendered prose saved
  -- back as a value are all rejected here rather than discovered later in a
  -- document that renders wrong.
  SELECT format_type INTO v_format
    FROM contract_field_defs fd
    JOIN documents d ON d.id = p_document_id
   WHERE fd.field_key = p_field_key
     AND fd.template_key = coalesce(
           (SELECT t.template_key FROM contract_templates t WHERE t.id = d.template_id),
           fd.template_key)
   LIMIT 1;
  IF v_format IS NOT NULL THEN
    v_violation := money_shape_violation(v_format, p_value);
    IF v_violation IS NOT NULL THEN
      RAISE EXCEPTION '%', v_violation;
    END IF;
  END IF;

  -- Decided before the write, while v_old_value still holds the prior value.
  v_changed := coalesce(v_old_value,'') IS DISTINCT FROM coalesce(p_value,'');

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := false;  -- H1: originator no longer grants edit rights
  v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = v_owner_role);

  SELECT bool_or(coalesce(c.can_fill, true)), bool_or(coalesce(c.can_edit_deal, false))
    INTO v_can_fill, v_can_deal
  FROM caller_party_roles(p_document_id) r
  LEFT JOIN document_party_controls c
    ON c.document_id = p_document_id AND c.party_role = r;
  v_can_fill := coalesce(v_can_fill, true);
  v_can_deal := coalesce(v_can_deal, false);

  -- D4(a): the two insurance responsibility elections are PARTY-EXCLUSIVE.
  -- An election is a party's own act; staff status does not stand in for it.
  -- FHE is itself the Lessor on these contracts, so without this carve-out
  -- FHE staff could make the Lessee's election for them.
  v_sec := CASE
             WHEN p_field_key IN ('TXN.GL_LESSEE_RESPONSIBLE','TXN.GL_NOT_REQUIRED') THEN 'GL'
             WHEN p_field_key IN ('TXN.MORT_LESSEE_RESPONSIBLE','TXN.MORT_NOT_REQUIRED') THEN 'MORT'
             WHEN p_field_key IN ('TXN.MED_LESSEE_RESPONSIBLE','TXN.MED_NOT_REQUIRED') THEN 'MED'
             ELSE NULL
           END;
  v_is_elect := v_sec IS NOT NULL;

  IF v_is_elect THEN
    -- Only the owning party may elect. No staff substitution.
    IF NOT (v_owns_role AND v_can_fill) THEN
      RAISE EXCEPTION
        'only the % may make this election (field %) — it is that party''s own act and cannot be made on their behalf',
        v_owner_role, p_field_key;
    END IF;
  ELSIF NOT (
       v_is_staff
    OR (v_owner_role = 'DEAL' AND v_can_deal)
    OR (v_owner_role <> 'DEAL' AND v_owns_role AND v_can_fill)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  -- D4(b): mutual exclusivity. While one election is YES, the other cannot be
  -- set to YES. Unchecking your own re-opens the choice (spec).
  IF v_is_elect AND upper(coalesce(p_value,'')) = 'YES' THEN
    v_counterpart := CASE
      WHEN p_field_key LIKE '%_LESSEE_RESPONSIBLE' THEN 'TXN.' || v_sec || '_NOT_REQUIRED'
      ELSE 'TXN.' || v_sec || '_LESSEE_RESPONSIBLE'
    END;
    IF EXISTS (
      SELECT 1 FROM contract_fields
       WHERE document_id = p_document_id
         AND field_key = v_counterpart
         AND upper(coalesce(value,'')) = 'YES'
    ) THEN
      RAISE EXCEPTION
        'conflicting election: % is already accepted on this contract — the other party must uncheck it first',
        v_counterpart;
    END IF;
  END IF;

  -- An edit changes the text a signature attested to, so any standing
  -- signature is voided. A save that writes back the identical value is not
  -- an edit and must leave signatures intact. The signer is told at the next SEND.
  IF v_changed THEN
    PERFORM void_signatures_on_edit(p_document_id);
  END IF;

  UPDATE contract_fields
     SET value = p_value,
         entered_by_contact_id = current_contact_id(),
         entered_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key
   RETURNING * INTO v_row;

  IF p_field_key LIKE 'HORSE.%' AND v_confirmed IS NOT NULL THEN
    UPDATE documents
       SET horse_section_confirmed_at = NULL,
           horse_section_confirmed_by = NULL
     WHERE id = p_document_id;
  END IF;

  -- bidirectional horse sync (contract → record): open states only, party or
  -- staff, never clobbers a differing value, idempotent when unchanged.
  IF p_field_key LIKE 'HORSE.%' THEN
    PERFORM contract_horse_field_writeback(p_document_id, p_field_key, p_value);
  END IF;

  -- audit: only log an actual change
  IF v_changed THEN
    PERFORM log_contract_change(p_document_id, 'field_value', p_field_key, v_label,
                                v_owner_role, v_old_value, p_value, '{}'::jsonb);
  END IF;

  -- D5: the elections drive the unresolved-state notifications. Called after
  -- the write so it observes the new state. Never modifies status values.
  IF v_is_elect OR p_field_key LIKE 'TXN.%_LESSOR_STATUS' OR p_field_key LIKE 'TXN.%_LESSEE_STATUS' THEN
    PERFORM insurance_resolution_sync(p_document_id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id, 'document_id', v_row.document_id, 'field_key', v_row.field_key,
    'owner_role', v_row.owner_role, 'value', v_row.value, 'value_type', v_row.value_type,
    'entered_by_contact_id', v_row.entered_by_contact_id, 'entered_at', v_row.entered_at);
END;
$function$;

COMMIT;
