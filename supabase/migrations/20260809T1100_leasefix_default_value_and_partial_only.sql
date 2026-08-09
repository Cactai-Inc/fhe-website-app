/*
  # LEASEFIX batch 2a — seeded defaults, and partial-only leases

  Owner ruling 2026-08-09: a full lease voids the owner's existing mortality policy
  (the policy is cancelled, and a claim submitted against it is denied once the lease
  is discovered), so the full-lease insurance set is materially different work that
  has not been specced. Until it exists, the lease engine must not be able to produce
  a full lease at all.

    1. `contract_field_defs.default_value` — nullable, so every existing def and every
       other template is unaffected. Only `start_lease_contract_v2` reads it, and only
       when seeding a brand-new document; it never overwrites a value a human set.
    2. `TXN.LEASE_TYPE` offers PARTIAL only, and defaults to PARTIAL.

  Reversing this is a one-line options UPDATE once the full-lease insurance clauses
  are built — the FULL value and every conditional that reads it are left in place.

  Requires PGCLIENTENCODING=UTF8.
*/

ALTER TABLE contract_field_defs ADD COLUMN IF NOT EXISTS default_value text;

COMMENT ON COLUMN contract_field_defs.default_value IS
  'Seeded into contract_fields.value when a document is created. NULL = seed blank. '
  'Never applied to an existing document — sync_contract_fields_from_defs deliberately '
  'leaves values alone, so a default cannot retro-answer a question a party already saw.';


-- ── seed defaults on document creation ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.start_lease_contract_v2(
  p_lessee_contact_id uuid,
  p_lessor_contact_id uuid DEFAULT NULL::uuid,
  p_horse_id uuid DEFAULT NULL::uuid,
  p_responsible_role text DEFAULT 'LESSEE'::text,
  p_template_key text DEFAULT 'HORSE_LEASE_V2'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_contract uuid; v_doc uuid; v_n int;
  v_originator uuid; v_lessor uuid; v_key text; v_kind text;
BEGIN
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'not authorized to start a lease contract';
  END IF;
  v_org := current_org();
  v_originator := current_contact_id();

  v_key := coalesce(p_template_key, 'HORSE_LEASE_V2');

  IF p_lessee_contact_id IS NULL THEN
    RAISE EXCEPTION 'a lessee contact is required';
  END IF;

  v_lessor := coalesce(p_lessor_contact_id, org_company_contact_id());
  IF v_lessor IS NULL THEN
    RAISE EXCEPTION 'no lessor contact and no company contact for this organization';
  END IF;

  SELECT contract_kind INTO v_kind
    FROM contract_templates WHERE template_key = v_key;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'unknown lease template: %', v_key;
  END IF;
  IF v_kind IS DISTINCT FROM 'HORSE_LEASE' THEN
    RAISE EXCEPTION 'template % is not a lease template (contract_kind %)',
      v_key, coalesce(v_kind, 'NULL');
  END IF;

  INSERT INTO contracts (org_id, segment, title, horse_id, originator_contact_id, status)
  VALUES (v_org, 'LEASE', 'Horse Lease Agreement', p_horse_id, v_originator, 'draft')
  RETURNING id INTO v_contract;

  INSERT INTO contract_parties (contract_id, party_role, contact_id, is_signer, signer_order, org_id)
  VALUES (v_contract, 'LESSOR', v_lessor, true, 1, v_org),
         (v_contract, 'LESSEE', p_lessee_contact_id, true, 2, v_org);

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

  -- seed fields straight from the clause-model defs (clause_key + responsibility_kind carried).
  -- LEASEFIX 2026-08-09: `value` now seeds from d.default_value (NULL → blank, the
  -- prior behaviour for every def that does not set one).
  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, closed, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key,
    responsibility_kind, value)
  SELECT v_org, v_doc, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on, d.closed, d.guidance,
         d.required, d.is_optional, d.responsibility, d.sort_order, d.parent_field_key,
         d.responsibility_kind, d.default_value
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


-- ── partial only, and partial by default ─────────────────────────────────────
UPDATE contract_field_defs
   SET options = '[{"label": "Partial lease (shared or limited access)", "value": "PARTIAL"}]'::jsonb,
       default_value = 'PARTIAL'
 WHERE template_key IN ('HORSE_LEASE_V2','HORSE_LEASE_STANDARD','HORSE_LEASE_FULL','HORSE_LEASE_SIMPLE')
   AND field_key = 'TXN.LEASE_TYPE'
   AND options @> '[{"value": "FULL"}]'::jsonb;

-- Live non-executed leases: adopt PARTIAL where the question is unanswered, so no
-- in-flight draft sits on a lease type the contract can no longer express. A doc
-- that already says PARTIAL is untouched; none says FULL (verified before applying).
UPDATE contract_fields cf
   SET value = 'PARTIAL', updated_at = now()
  FROM documents d
  JOIN contract_templates t ON t.id = d.template_id
 WHERE d.id = cf.document_id
   AND t.contract_kind = 'HORSE_LEASE'
   AND d.deleted_at IS NULL
   AND d.workflow_state NOT IN ('executed','void')
   AND cf.field_key = 'TXN.LEASE_TYPE'
   AND coalesce(cf.value,'') = '';
