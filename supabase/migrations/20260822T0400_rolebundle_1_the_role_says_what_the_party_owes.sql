-- TASK-ROLEBUNDLE §1 — D31's "one known event": the CONTRACT ROLE says what the
-- party owes, and until now nothing asked it.
--
-- `contract_role_documents (org_id, doc_role, template_key)` has existed since
-- 20260728050000 (stage1h), seeded and correct:
--
--   LESSEE → COMPANY_POLICIES, FACILITY_RULES, HORSE_EMERGENCY_VET, RELEASE_HORSE_CARE
--   LESSOR → COMPANY_POLICIES, RELEASE_GENERAL
--   BUYER  → COMPANY_POLICIES, RELEASE_GENERAL
--   SELLER → COMPANY_POLICIES, RELEASE_GENERAL
--
-- **Verified 2026-08-22: zero functions, zero views, zero policies and zero
-- lines of `src/` or `api/` referenced it.** It was seeded and left unwired. It
-- was also UNREADABLE: row security is enabled on it with NO policy at all, so
-- even a staff session selecting from it gets nothing back.
--
-- This migration does the smallest thing that makes the table mean something:
--   1. a staff read policy, so the table is visible to the people who maintain it;
--   2. `contract_role_document_requirements(document_id)` — the ONE place that
--      answers "what does each party on this contract owe, by virtue of the role
--      they hold on it, and is it satisfied?"
--
-- ⚠️ IT COMPUTES, IT DOES NOT STORE — and that is D31, not a shortcut. D31:
-- *"Obligation … computed from what was actually purchased or what relationship
-- currently exists, never from static category membership alone."* A contract
-- role IS a relationship, and `document_parties` already records it. Copying the
-- bundle into `contact_required_documents` would (a) be account-global, which is
-- the opposite of "scoped to that contract", and (b) rebuild the static-bucket
-- model D31 exists to retire. The party row is the fact; this reads it.
--
-- ⚠️ WHAT THIS DELIBERATELY DOES NOT DO: generate documents. Two of LESSEE's four
-- templates — HORSE_EMERGENCY_VET and RELEASE_HORSE_CARE — ALREADY have an
-- incumbent writer. `apply_contract_execution_effects` calls
-- `ensure_horse_documents(horse, contract_id, true)` at EXECUTION, and CLOSEOUT
-- §1.5 (owner-ruled 2026-08-18) deliberately REMOVED the earlier lock-time call:
-- *"A party reviewing a lease they might not sign gets nothing else attached;
-- execution creates HORSE_EMERGENCY_VET + RELEASE_HORSE_CARE, because only then
-- is the horse genuinely coming into care."* Generating them at party-add would
-- be a second write path for the same two templates (D18) and would reverse that
-- ruling. The `owned_by` field below names the incumbent instead, so the surface
-- can say "attaches on execution" rather than silently showing a gap.
--
-- Measured on production, WALK3's executed lease: both horse documents exist,
-- `contract_id` set, sign_sequence 2 and 3 — and both are addressed to the HORSE
-- OWNER (French Heritage Equestrian), not to the LESSEE the seed table names.
-- That disagreement is REPORTED here, not resolved: `addressed_to_contact_id`
-- shows who actually holds each satisfied document, so the two can be compared
-- rather than assumed equal.

-- ── 1. make the table readable by the people who own it ─────────────────────
DROP POLICY IF EXISTS contract_role_documents_staff_read ON contract_role_documents;
CREATE POLICY contract_role_documents_staff_read ON contract_role_documents
  FOR SELECT TO authenticated
  USING (org_id = current_org() AND has_staff_access());

-- ── 2. the one reader ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_role_document_requirements(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_contract uuid;
  v_key      text;
  v_is_lease boolean;
  v_rows     jsonb;
BEGIN
  SELECT d.org_id, d.contract_id, ct.template_key
    INTO v_org, v_contract, v_key
    FROM documents d
    LEFT JOIN contract_templates ct ON ct.id = d.template_id
   WHERE d.id = p_document_id AND d.deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  -- Readable by staff, and by anyone who is themselves a party to this contract:
  -- a lessee is entitled to see what their own role owes.
  IF NOT (coalesce(has_staff_access(), false)
          OR EXISTS (SELECT 1 FROM document_parties dp
                      WHERE dp.document_id = p_document_id
                        AND dp.contact_id = current_contact_id())) THEN
    RAISE EXCEPTION 'not a party to this contract';
  END IF;

  v_is_lease := coalesce(is_horse_lease_template(v_key), false);

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'party_role', x->>'template_key'), '[]'::jsonb)
    INTO v_rows
  FROM (
    SELECT jsonb_build_object(
             'contact_id',   dp.contact_id,
             'party_role',   dp.party_role,
             'party_name',   nullif(btrim(coalesce(c.first_name,'') || ' ' || coalesce(c.last_name,'')), ''),
             'party_email',  c.email,
             'template_key', crd.template_key,
             'title',        coalesce(t.title, crd.template_key),
             -- SATISFIED = an executed document of this template already on file
             -- for this party. Deliberately NOT contract-scoped: signing the
             -- Company Policies twice is not an obligation, it is a nuisance.
             'satisfied',    sat.document_id IS NOT NULL,
             'satisfied_document_id', sat.document_id,
             -- Anything of this template already sitting on THIS contract,
             -- whoever it is addressed to — the disagreement described above is
             -- visible rather than assumed away.
             'on_this_contract_document_id', onc.document_id,
             'on_this_contract_addressed_to', onc.contact_id,
             -- Who creates it, when it does not exist yet.
             'owned_by',     CASE
               WHEN v_is_lease AND crd.template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
                 THEN 'ensure_horse_documents@execution'
               ELSE 'unassigned' END
           ) AS x
      FROM document_parties dp
      JOIN contacts c ON c.id = dp.contact_id
      JOIN contract_role_documents crd
        ON crd.org_id = v_org AND crd.doc_role = dp.party_role
      LEFT JOIN contract_templates t ON t.template_key = crd.template_key
      LEFT JOIN LATERAL (
        SELECT d2.id AS document_id FROM documents d2
         JOIN contract_templates t2 ON t2.id = d2.template_id
        WHERE d2.contact_id = dp.contact_id AND t2.template_key = crd.template_key
          AND d2.status = 'EXECUTED' AND d2.deleted_at IS NULL
        ORDER BY d2.generated_at DESC NULLS LAST LIMIT 1) sat ON true
      LEFT JOIN LATERAL (
        SELECT d3.id AS document_id, d3.contact_id FROM documents d3
         JOIN contract_templates t3 ON t3.id = d3.template_id
        WHERE t3.template_key = crd.template_key AND d3.deleted_at IS NULL
          AND (d3.contract_id IS NOT DISTINCT FROM v_contract AND v_contract IS NOT NULL)
        ORDER BY d3.generated_at DESC NULLS LAST LIMIT 1) onc ON true
     WHERE dp.document_id = p_document_id
       AND dp.party_role IN ('BUYER','LESSEE','LESSOR','SELLER')
       -- ⚠️ NEVER THE COMPANY. Wired literally, the seed table asks the LESSOR to
       -- sign Company Policies and a visitor liability release — and on every
       -- lease FHE writes, the LESSOR *is* French Heritage Equestrian. The first
       -- run of this function against WALK4's executed lease produced exactly
       -- that: "French Heritage Equestrian · LESSOR · Company Policies ·
       -- satisfied false". The company does not countersign its own policies.
       -- Same carve-out every other engine here already makes (D7;
       -- promote_contact_to_account refuses a company contact outright;
       -- _ensure_client_account excludes is_company from its email match).
       AND NOT coalesce(c.is_company, false)
  ) s;

  RETURN jsonb_build_object(
    'document_id', p_document_id,
    'contract_id', v_contract,
    'template_key', v_key,
    'requirements', v_rows);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.contract_role_document_requirements(uuid) TO authenticated;
