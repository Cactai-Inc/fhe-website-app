/*
  # TASK LEASEFORK — Phase 3: template selection at write time

  start_lease_contract_v2 gains an optional trailing argument:

      p_template_key text DEFAULT 'HORSE_LEASE_V2'

  Every existing caller behaves exactly as before. This RPC has signed real leases;
  the default is the whole safety story.

  ## Why DROP + CREATE and not CREATE OR REPLACE

  CREATE OR REPLACE cannot add a parameter — a different argument count creates an
  OVERLOAD, and PostgreSQL then cannot resolve a call made at the original arity.
  Proven live against this database with toy functions of the same shape
  (docs/reports/TASK-LEASEFORK-REPORT.md §12), both positionally and with named
  arguments (the form PostgREST/supabase.rpc emits):

      ERROR:  function _probe(a => integer, b => integer) is not unique
      HINT:   Could not choose a best candidate function.

  Leaving both arities in place would therefore break EVERY existing lease-start
  call, which is the opposite of the requirement. So the old 4-argument function is
  dropped and the 5-argument one created in the same transaction: at no point is
  there more than one candidate, and at no committed point is there none.

  Grants do not survive DROP, so they are restored explicitly to match the dropped
  function's ACL exactly ({postgres=X, authenticated=X, service_role=X} — i.e.
  EXECUTE revoked from PUBLIC).

  ## Validation

  The argument must name a template that exists, is active, is not soft-deleted, and
  is contract_kind = 'HORSE_LEASE'. Anything else raises with a message naming the
  key and the reason. There is deliberately NO fallback to HORSE_LEASE_V2 on a bad
  key: silently producing a different contract than the one the author selected is
  the failure mode this whole task exists to prevent.

  NULL is treated as "not specified" and resolves to the default, because a NULL
  argument is indistinguishable from an omitted one at the client boundary. That is
  the documented default, not a fallback from an invalid value. The TypeScript
  wrapper omits the argument entirely when no template is chosen, so this path is
  belt-and-braces rather than load-bearing.

  ## The key is threaded through all FOUR hardcoded sites, not one

  The literal 'HORSE_LEASE_V2' appeared four times in the old body: the pre-flight
  lookup, the error string, the generate_document() call, and the
  contract_field_defs seed. Changing only the lookup would produce a document whose
  shell and seeded fields came from a DIFFERENT template than its template_id
  claims. All four move together.

  Nothing else in the body is changed. Everything below the validation block is the
  previous definition verbatim (contract + parties, document shell, PARTYCTRL
  control seeding, originator/workflow stamp, field seed, horse + party fill,
  remerge).
*/

DROP FUNCTION public.start_lease_contract_v2(uuid, uuid, uuid, text);

CREATE FUNCTION public.start_lease_contract_v2(
  p_lessee_contact_id uuid,
  p_lessor_contact_id uuid DEFAULT NULL::uuid,
  p_horse_id uuid DEFAULT NULL::uuid,
  p_responsible_role text DEFAULT 'LESSEE'::text,
  p_template_key text DEFAULT 'HORSE_LEASE_V2'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contract   uuid;
  v_org        uuid;
  v_doc        uuid;
  v_tmpl       uuid;
  v_originator uuid;
  v_n          int;
  v_key        text;
  v_active     boolean;
  v_deleted    timestamptz;
  v_kind       text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to start a lease contract'; END IF;
  IF p_lessee_contact_id IS NULL THEN RAISE EXCEPTION 'a lessee contact is required'; END IF;

  -- LEASEFORK: which lease version to author. NULL == not specified == the default.
  v_key := coalesce(p_template_key, 'HORSE_LEASE_V2');

  v_originator := current_contact_id();  -- H1: the company (staff caller) is always the author

  SELECT org_id INTO v_org FROM contacts WHERE id = p_lessee_contact_id;

  -- LEASEFORK: validate the selected template. No silent fallback — a bad key
  -- raises rather than quietly authoring a different contract than was chosen.
  SELECT id, active, deleted_at, contract_kind
    INTO v_tmpl, v_active, v_deleted, v_kind
    FROM contract_templates WHERE template_key = v_key;
  IF v_tmpl IS NULL THEN
    RAISE EXCEPTION 'unknown contract template: %', v_key;
  END IF;
  IF v_kind IS DISTINCT FROM 'HORSE_LEASE' THEN
    RAISE EXCEPTION 'template % is not a lease template (contract_kind = %)',
      v_key, coalesce(v_kind, 'NULL');
  END IF;
  IF NOT v_active OR v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'template % is not active', v_key;
  END IF;

  -- contract + parties (spine model)
  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, v_originator, jsonb_build_object('deal_side','LEASE_IN'))
    RETURNING id INTO v_contract;
  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_contract, p_lessee_contact_id, 'LESSEE', true, 1);
  IF p_lessor_contact_id IS NOT NULL THEN
    INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_contract, p_lessor_contact_id, 'LESSOR', true, 2);
  END IF;

  -- document shell (same generator the engine uses; body recomposed below)
  SELECT gd.document_id INTO v_doc FROM generate_document(
    p_lessee_contact_id, v_key, v_contract, p_horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,'is_signer',cp.is_signer,'signer_order',cp.signer_order))
       FROM contract_parties cp WHERE cp.contract_id = v_contract),
    NULL::text) gd;

  -- PARTYCTRL: seed default party controls for every role this document
  -- carries, so the admin panel has rows to render from creation onward.
  INSERT INTO document_party_controls (document_id, party_role, can_fill, can_edit_deal, can_suggest, can_add_clause, org_id)
  SELECT DISTINCT v_doc, dp.party_role, true, true, false, false, v_org
    FROM document_parties dp
   WHERE dp.document_id = v_doc AND dp.party_role NOT IN ('FHE','COMPANY')
  ON CONFLICT (document_id, party_role) DO NOTHING;

  UPDATE documents SET originator_contact_id = v_originator,
                       workflow_state = 'editable', status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  -- seed fields straight from the clause-model defs (clause_key + responsibility_kind carried)
  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, closed, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key,
    responsibility_kind)
  SELECT v_org, v_doc, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on, d.closed, d.guidance,
         d.required, d.is_optional, d.responsibility, d.sort_order, d.parent_field_key,
         d.responsibility_kind
    FROM contract_field_defs d
   WHERE d.template_key = v_key;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- fill horse + party identity fields from records (reuse verified paths)
  IF p_horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, p_horse_id);
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);

  -- compose the numbered clause body
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'contract_id', v_contract,
                            'fields_seeded', v_n, 'template_key', v_key);
END;
$function$;

-- Restore the dropped function's ACL EXACTLY. The old ACL was
--   {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
-- i.e. no PUBLIC and, notably, NO anon.
--
-- anon must be revoked explicitly. `pg_default_acl` on this database grants
-- EXECUTE on every new function in `public` to anon/authenticated/service_role, and
-- REVOKE ... FROM public does not remove a grant held by the ROLE anon. Without
-- this line the recreated function would end up MORE permissive than the one it
-- replaces — verified: the first dry-run produced
--   {postgres=X,anon=X,authenticated=X,service_role=X}
-- which is an ACL widening, not a like-for-like restore.
REVOKE ALL ON FUNCTION public.start_lease_contract_v2(uuid, uuid, uuid, text, text) FROM public;
REVOKE ALL ON FUNCTION public.start_lease_contract_v2(uuid, uuid, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.start_lease_contract_v2(uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_lease_contract_v2(uuid, uuid, uuid, text, text) TO service_role;
