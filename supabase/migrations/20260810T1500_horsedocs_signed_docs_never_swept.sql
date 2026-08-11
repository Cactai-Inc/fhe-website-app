/*
  # HORSEDOCS — ensure_horse_documents never sweeps a signed document

  `ensure_horse_documents` soft-deleted the owner's prior horse documents with NO
  status filter and NO signature check. Two EXECUTED documents carrying live
  signatures were in range in production (Sarah Morgan's HORSE_EMERGENCY_VET
  152912dd and RELEASE_HORSE_CARE a8623897, both horse_id NULL), reachable by the
  owner's own next call — proven by a rolled-back call that returned "voided": 2.

  This is the third member of the family: void_signatures_on_edit (dropped by
  NOGUARD2) and the onboarding sweep (guarded by SENDGUARD §3) were the first two.
  The guard here is deliberately the SAME SHAPE as the one SENDGUARD put live in
  generate_my_onboarding_documents.

  ## Owner decision — skip AND supersede (not adopt)

  The signed document is skipped, and the horse-bound replacement is STILL
  generated. Adopting the signed document (what SENDGUARD chose for onboarding)
  is wrong here because these documents have a horse dimension that onboarding
  documents do not: both at-risk documents merged with an EMPTY Horse Name — they
  authorize emergency veterinary care for no identified horse, so they cannot
  stand in for the horse this call is about.

  Supersession is NOT stamped here. The existing `documents_apply_supersession`
  trigger marks the prior EXECUTED document `superseded` when the replacement is
  EXECUTED, which is the codebase's standing opinion and keeps a signed
  authorization live until a signed one replaces it.

  KNOWN, REPORTED, NOT FIXED HERE: `apply_document_supersession` matches on
  contact_id + template_key with no horse_id in its predicate. Once documents are
  horse-bound, executing a vet authorization for one horse will supersede the
  executed vet authorization for a DIFFERENT horse owned by the same contact.
  CJ Z owns two horses. That needs its own spec — the fix is a horse_id
  comparison plus a decision about the NULL-horse_id side, which is exactly the
  state the two documents above are in. See docs/reports/TASK-HORSEDOCS-REPORT.md.

  The only change to the function body is the two guard predicates on the sweep
  UPDATE; everything else is the live definition verbatim. The DO block at the
  end asserts the rewrite actually landed — a body that does not contain the
  guard raises instead of silently reporting success.
*/

CREATE OR REPLACE FUNCTION public.ensure_horse_documents(p_horse_id uuid, p_contract_id uuid DEFAULT NULL::uuid, p_include_care boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org       uuid := current_org();
  v_horse     horses%ROWTYPE;
  v_owner     uuid;
  v_contact   uuid := current_contact_id();
  v_templates text[] := ARRAY['HORSE_EMERGENCY_VET'];
  v_tpl       text;
  v_doc       uuid;
  v_voided    int := 0;
  v_rc        int := 0;
  v_gen       jsonb := '[]'::jsonb;
  v_may       boolean;
  v_seq       int;
BEGIN
  SELECT * INTO v_horse FROM horses WHERE id = p_horse_id AND org_id = v_org AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'horse not found in this org'; END IF;

  v_may := has_staff_access()
    OR v_horse.current_owner_contact_id = v_contact
    OR v_horse.lessee_contact_id = v_contact
    OR EXISTS (SELECT 1 FROM horse_relationships hr WHERE hr.horse_id = p_horse_id AND hr.party_contact_id = v_contact AND hr.active);
  IF NOT v_may THEN RAISE EXCEPTION 'not authorized for this horse'; END IF;

  v_owner := coalesce(v_horse.current_owner_contact_id, v_contact);
  IF v_owner IS NULL THEN RAISE EXCEPTION 'horse has no owner on record to authorize'; END IF;

  IF p_include_care IS TRUE
     OR (p_include_care IS NULL AND owner_has_executed_template(v_owner, 'RELEASE_HORSE_CARE')) THEN
    v_templates := array_append(v_templates, 'RELEASE_HORSE_CARE');
  END IF;

  FOREACH v_tpl IN ARRAY v_templates LOOP
    -- HORSEDOCS: a signed document is evidence and is NEVER swept. Same guard
    -- shape as SENDGUARD §3 in generate_my_onboarding_documents: EXECUTED is
    -- protected, and so is a still-pending document that already carries a live
    -- signature. The replacement below is still generated; the existing
    -- documents_apply_supersession trigger marks this one superseded when that
    -- replacement is executed.
    WITH tmpl AS (SELECT id FROM contract_templates WHERE template_key = v_tpl)
    UPDATE documents d
       SET deleted_at = now(), deleted_by = auth.uid()
     WHERE d.contact_id = v_owner
       AND d.template_id = (SELECT id FROM tmpl)
       AND d.deleted_at IS NULL
       AND d.status <> 'EXECUTED'
       AND NOT EXISTS (SELECT 1 FROM signatures s
                        WHERE s.document_id = d.id AND s.deleted_at IS NULL)
       AND (d.horse_id IS NULL
            OR (d.horse_id = p_horse_id AND d.merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'));
    GET DIAGNOSTICS v_rc = ROW_COUNT;
    v_voided := v_voided + v_rc;

    IF EXISTS (
      SELECT 1 FROM documents d
      JOIN contract_templates t ON t.id = d.template_id
      WHERE d.contact_id = v_owner AND t.template_key = v_tpl
        AND d.horse_id = p_horse_id AND d.deleted_at IS NULL
        AND d.merged_body NOT LIKE '%{{HORSE.REGISTERED_NAME}}%'
    ) THEN
      CONTINUE;
    END IF;

    -- OWNER is the sole party/signer; coverage of FHE + any active-term lessee is
    -- a standing clause in the body, not a named party.
    SELECT gd.document_id INTO v_doc FROM generate_document(
      v_owner, v_tpl, p_contract_id, p_horse_id,
      jsonb_build_array(jsonb_build_object(
        'contact_id', v_owner, 'role', 'CLIENT', 'is_signer', true, 'signer_order', 1)),
      'horse'::text) gd;

    v_seq := CASE WHEN p_contract_id IS NULL THEN NULL
                  WHEN v_tpl = 'HORSE_EMERGENCY_VET' THEN 2
                  WHEN v_tpl = 'RELEASE_HORSE_CARE'  THEN 3 END;
    UPDATE documents SET status = 'AWAITING_SIGNATURE', sign_sequence = v_seq
      WHERE id = v_doc AND status = 'DRAFT';
    v_gen := v_gen || jsonb_build_object('template_key', v_tpl, 'document_id', v_doc);
  END LOOP;

  IF p_contract_id IS NOT NULL THEN
    UPDATE documents d SET sign_sequence = 1
      FROM contract_templates t
     WHERE d.template_id = t.id AND is_horse_lease_template(t.template_key)
       AND d.contract_id = p_contract_id AND d.deleted_at IS NULL
       AND d.sign_sequence IS DISTINCT FROM 1;
  END IF;

  RETURN jsonb_build_object('owner_contact_id', v_owner, 'generated', v_gen, 'voided', v_voided);
END;
$function$;

REVOKE ALL ON FUNCTION ensure_horse_documents(uuid, uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION ensure_horse_documents(uuid, uuid, boolean) TO authenticated, service_role;

-- Assert the rewrite landed. A migration that silently no-ops is the failure mode
-- this repo has ~31 instances of; this one refuses to.
DO $assert$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'ensure_horse_documents';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'HORSEDOCS: ensure_horse_documents does not exist after replace';
  END IF;
  IF v_def NOT LIKE '%d.status <> ''EXECUTED''%' THEN
    RAISE EXCEPTION 'HORSEDOCS: EXECUTED guard missing from ensure_horse_documents';
  END IF;
  IF v_def NOT LIKE '%NOT EXISTS (SELECT 1 FROM signatures s%' THEN
    RAISE EXCEPTION 'HORSEDOCS: signature guard missing from ensure_horse_documents';
  END IF;
  -- the sweep must still do its job: the horse-scoped predicate is intact
  IF v_def NOT LIKE '%d.horse_id = p_horse_id AND d.merged_body LIKE%' THEN
    RAISE EXCEPTION 'HORSEDOCS: horse-scoped sweep predicate lost';
  END IF;
  IF v_def NOT LIKE '%generate_document(%' THEN
    RAISE EXCEPTION 'HORSEDOCS: generation path lost from ensure_horse_documents';
  END IF;
  RAISE NOTICE 'HORSEDOCS: ensure_horse_documents is signature-aware; generation intact';
END;
$assert$;
