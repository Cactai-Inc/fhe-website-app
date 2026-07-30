-- ─────────────────────────────────────────────────────────────────────────────
-- DOCUMENT-BEFORE-CONTRACT GATING (owner rule, 2026-07-29)
--
-- The rule: a person with ASSIGNED-BUT-UNSATISFIED onboarding documents (the
-- wall-gating class — rider + horse-owner releases) must complete those BEFORE
-- they can review or execute a contract.
--
-- The rationale is a DATA DEPENDENCY, not policy: the contract needs everything
-- the onboarding documents collect and MORE (the mailing address). Signing a
-- lease before the releases exist would produce a contract whose party tokens
-- (LESSEE.ADDRESS via fill_party_fields_from_contacts → compose_address) may be
-- unfilled, and would seat a party who has not accepted the facility rules.
--
-- Three seams, one shared predicate — never re-implement the rule:
--   1. contact_document_wall_state(contact) — THE predicate. Extracted from the
--      body of my_wall_state() so the wall and the contract gate can never
--      disagree. my_wall_state() is re-pointed at it below.
--   2. contract_lock_blockers(document)     — adds the 'onboarding_documents'
--      blocker, so locking / approve_contract_review refuse while any signing
--      party is unsatisfied. (Both already route ALL preconditions here.)
--   3. record_signature(document, …)        — the HARD guard. Every signing path
--      (lock_and_sign_contract, the onboarding flow, staff sign-on-behalf) funnels
--      through this one function, so a deep-linked contract URL cannot bypass it.
--
-- SCOPE — deliberately narrow, so this rule never eats its own tail:
--   • Onboarding documents themselves are EXEMPT (they ARE the wall; gating them
--     on their own completion would deadlock the member permanently).
--   • Staff are exempt from the signature guard when signing as/for the org, in
--     line with the existing "staff are never hard-walled" rule (D8 / 3f). Staff
--     still SEE the blocker, so ops knows the counterparty is not ready.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. The shared predicate ──────────────────────────────────────────────────
-- Unsatisfied = assigned in contact_required_documents, whose newest ACTIVE
-- template version has no EXECUTED, non-superseded document at >= that version.
-- Identical logic to the pre-existing my_wall_state() body; `gating` counts only
-- wall_gating templates, which is what actually walls a session.
CREATE OR REPLACE FUNCTION public.contact_document_wall_state(p_contact_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pending int; v_gating int; v_titles text[];
BEGIN
  IF p_contact_id IS NULL THEN
    RETURN jsonb_build_object('pending', 0, 'gating', 0, 'titles', '[]'::jsonb);
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE ct.wall_gating),
         array_agg(coalesce(ct.title, ct.template_key)
                   ORDER BY coalesce(ct.title, ct.template_key))
           FILTER (WHERE ct.wall_gating)
    INTO v_pending, v_gating, v_titles
    FROM contact_required_documents crd
    JOIN contract_templates ct ON ct.template_key = crd.template_key
     AND ct.active AND ct.deleted_at IS NULL
     AND ct.version = (SELECT max(x.version) FROM contract_templates x
                        WHERE x.template_key = ct.template_key
                          AND x.active AND x.deleted_at IS NULL)
   WHERE crd.contact_id = p_contact_id
     AND NOT EXISTS (
       SELECT 1 FROM documents d
       JOIN contract_templates ct2 ON ct2.id = d.template_id
      WHERE d.contact_id = p_contact_id AND d.deleted_at IS NULL
        AND d.status = 'EXECUTED'
        AND coalesce(d.current_status,'') <> 'superseded'
        AND ct2.template_key = crd.template_key
        AND ct2.version >= ct.version);

  RETURN jsonb_build_object(
    'pending', coalesce(v_pending, 0),
    'gating',  coalesce(v_gating, 0),
    'titles',  to_jsonb(coalesce(v_titles, ARRAY[]::text[])));
END;
$function$;

COMMENT ON FUNCTION public.contact_document_wall_state(uuid) IS
  'THE shared onboarding-document predicate: how many assigned documents a contact '
  'has not yet satisfied at the current active template version, and how many of '
  'those are wall_gating. The signing wall (my_wall_state), the contract lock '
  'preconditions (contract_lock_blockers) and the signature guard (record_signature) '
  'all read this one function so they can never disagree.';

-- ── my_wall_state re-pointed at the shared predicate (behaviour identical) ────
CREATE OR REPLACE FUNCTION public.my_wall_state()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_contact uuid := current_contact_id();
  v_state jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_contact IS NULL THEN
    RETURN jsonb_build_object('pending', 0, 'wall', false, 'staff', false);
  END IF;

  v_state := contact_document_wall_state(v_contact);

  RETURN jsonb_build_object(
    'pending', (v_state->>'pending')::int,
    'wall', ((v_state->>'gating')::int > 0 AND NOT has_staff_access()),
    'staff_banner', ((v_state->>'gating')::int > 0 AND has_staff_access()),
    'staff', has_staff_access());
END;
$function$;

-- ── 2. The blocker ───────────────────────────────────────────────────────────
-- Rebuilt from the live body with ONE addition (the final block). Every other
-- precondition is carried through byte-for-byte.
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

  RETURN v_blockers;
END;
$function$;

COMMENT ON FUNCTION public.contract_lock_blockers(uuid) IS
  'THE single source of contract lock preconditions (shared by '
  'advance_document_workflow and approve_contract_review). Returns a jsonb ARRAY '
  'of {code,message}. Includes the document-before-contract rule: a signing party '
  'with unsatisfied wall-gating onboarding documents blocks the contract '
  '(code onboarding_documents). Onboarding documents themselves are exempt.';

-- ── 3. The hard guard on the signing path ────────────────────────────────────
-- record_signature is the ONE chokepoint every signing path funnels through
-- (lock_and_sign_contract, the onboarding flow, staff sign-on-behalf), so this
-- guard cannot be bypassed by deep-linking to /app/contracts/<id>.
-- Implemented as a surgical body rewrite: read the live definition and inject
-- the guard immediately before the sequential-execution check, leaving every
-- other line untouched.
DO $do$
DECLARE
  v_def text;
  v_anchor text := '  -- SEQUENTIAL EXECUTION:';
  v_guard text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'record_signature'
     AND pg_get_function_identity_arguments(p.oid)
         = 'p_document_id uuid, p_party_role text, p_typed_name text, p_ip text, p_user_agent text, p_esign_consent boolean';
  IF v_def IS NULL THEN
    RAISE EXCEPTION 'record_signature not found — cannot install the onboarding guard';
  END IF;

  IF position('DOCUMENT-BEFORE-CONTRACT' in v_def) > 0 THEN
    RAISE NOTICE 'record_signature already guarded — skipping';
    RETURN;
  END IF;
  IF position(v_anchor in v_def) = 0 THEN
    RAISE EXCEPTION 'record_signature body changed shape — anchor not found; re-derive the guard';
  END IF;

  v_guard :=
    '  -- DOCUMENT-BEFORE-CONTRACT (2026-07-29): a party with unsatisfied' || E'\n' ||
    '  -- wall-gating onboarding documents may not sign a CONTRACT. Onboarding' || E'\n' ||
    '  -- documents themselves are exempt (they are the wall). Staff acting for' || E'\n' ||
    '  -- the org are exempt, matching the never-hard-wall-staff rule.' || E'\n' ||
    '  IF NOT (has_staff_access() AND v_doc_org = current_org()) THEN' || E'\n' ||
    '    IF NOT coalesce((SELECT ct.wall_gating FROM documents d3' || E'\n' ||
    '                       JOIN contract_templates ct ON ct.id = d3.template_id' || E'\n' ||
    '                      WHERE d3.id = p_document_id), false) THEN' || E'\n' ||
    '      IF (contact_document_wall_state(v_signer)->>''gating'')::int > 0 THEN' || E'\n' ||
    '        RAISE EXCEPTION ''cannot sign: onboarding documents must be completed first'';' || E'\n' ||
    '      END IF;' || E'\n' ||
    '    END IF;' || E'\n' ||
    '  END IF;' || E'\n\n';

  EXECUTE replace(v_def, v_anchor, v_guard || v_anchor);
END
$do$;
