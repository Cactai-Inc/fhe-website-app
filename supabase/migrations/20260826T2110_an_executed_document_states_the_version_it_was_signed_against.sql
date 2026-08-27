-- TASK-SURFACEEDITOR — THE TELL: an executed document states the version it was
-- signed against.
--
-- The handoff's own words: "An executed document must visibly state the version
-- it was signed against, so it is obvious it is not following the template —
-- otherwise the first person to edit a lease template will assume signed copies
-- changed too."
--
-- The FACT already existed and was already enforced: documents.signed_template_version
-- is non-null on all 67 executed documents, and regenerate_contract_document
-- returns the stored merged_body without writing when it differs from the
-- template's current version. What was missing is that nobody could SEE it. The
-- ops documents QUEUE shows it (deriveVersion / VersionCell, TASK-DOCCOLS); the
-- contract workspace — where a lease is actually read — did not.
--
-- This is an ADDITIVE widening of one jsonb object. Nothing that reads
-- contract_document_detail today can break on two extra keys.

CREATE OR REPLACE FUNCTION public.contract_document_detail(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me    uuid := current_contact_id();
  v_org   uuid; v_recip boolean; v_state text; v_orig uuid;
  v_staff boolean; v_roles text[]; v_can_fill boolean; v_can_deal boolean;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, recipient_editing, workflow_state, originator_contact_id
    INTO v_org, v_recip, v_state, v_orig
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;

  v_staff := coalesce(has_staff_access() AND v_org = current_org(), false);
  IF NOT (v_staff OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to read document %', p_document_id;
  END IF;

  SELECT array_agg(r) INTO v_roles FROM caller_party_roles(p_document_id) r;
  v_roles := coalesce(v_roles, ARRAY[]::text[]);

  SELECT bool_or(coalesce(c.can_fill, true)), bool_or(coalesce(c.can_edit_deal, false))
    INTO v_can_fill, v_can_deal
  FROM unnest(v_roles) r
  LEFT JOIN document_party_controls c
    ON c.document_id = p_document_id AND c.party_role = r;
  v_can_fill := coalesce(v_can_fill, true);
  v_can_deal := coalesce(v_can_deal, false);

  SELECT jsonb_build_object(
    'document', (SELECT jsonb_build_object(
        'document_id', d.id, 'title', d.title, 'status', d.status,
        'template_key', (SELECT ct.template_key FROM contract_templates ct WHERE ct.id = d.template_id),
        'workflow_state', d.workflow_state, 'recipient_editing', d.recipient_editing,
        'execution_hash', d.execution_hash, 'merged_body', d.merged_body,
        'is_originator', (d.originator_contact_id = v_me),
        'horse_section_confirmed_at', d.horse_section_confirmed_at,
        'sent_at', d.sent_at, 'archived_at', d.archived_at,
        'voided_at', d.voided_at, 'void_reason', d.void_reason,
        'voided_by_me', (d.voided_by IS NOT NULL AND d.voided_by = v_me),
        'my_hidden_at', (SELECT dph.hidden_at FROM document_party_hidden dph
                          WHERE dph.document_id = d.id AND dph.contact_id = v_me),
        'can_void', can_void_document(d.id),
        'horse_id', d.horse_id,
        'horse_section_confirmed_by', d.horse_section_confirmed_by,
        'terminated_at', d.terminated_at,
        'termination_requested_at', d.termination_requested_at,
        'termination_requested_by', d.termination_requested_by,
        'termination_request_reason', d.termination_request_reason,
        'effective_date', d.effective_date,
        -- TASK-SURFACEEDITOR: THE TELL. An executed document renders the version
        -- it was signed against, forever, and it must SAY SO — otherwise the
        -- first person to edit a lease template assumes signed copies changed
        -- too (D33 is precisely that they do not). Both numbers, because the
        -- fact only reads as a fact when the two can be compared.
        'signed_template_version', d.signed_template_version,
        'template_version_now', (SELECT ct.version FROM contract_templates ct WHERE ct.id = d.template_id),
        'executed_email_sent_at', d.executed_email_sent_at)
      FROM documents d WHERE d.id = p_document_id),
    'my_roles', to_jsonb(v_roles),
    -- TASK COSIGN: roles a staff caller may sign because the role's signer
    -- contact is the org's own company contact — mirrors record_signature's
    -- company branch exactly.
    'company_signable_roles', coalesce((
      SELECT jsonb_agg(DISTINCT dp.party_role)
      FROM document_parties dp
      JOIN contacts cc ON cc.id = dp.contact_id
      WHERE dp.document_id = p_document_id AND dp.is_signer AND cc.is_company
        AND cc.org_id = v_org AND cc.deleted_at IS NULL), '[]'::jsonb),
    'company_contact_name', (
      SELECT cc.first_name FROM document_parties dp
      JOIN contacts cc ON cc.id = dp.contact_id
      WHERE dp.document_id = p_document_id AND cc.is_company
        AND cc.org_id = v_org AND cc.deleted_at IS NULL LIMIT 1),
    'party_controls', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', c.party_role, 'can_fill', c.can_fill,
          'can_edit_deal', c.can_edit_deal, 'can_suggest', c.can_suggest,
          'can_add_clause', coalesce(c.can_add_clause,false)))
      FROM document_party_controls c WHERE c.document_id = p_document_id), '[]'::jsonb),
    'fields', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'field_key', cf.field_key, 'label', cf.label, 'section', cf.section,
          'clause_key', cf.clause_key, 'responsibility_kind', cf.responsibility_kind,
          'custom_kind', cf.custom_kind, 'body', cf.body,
          'added_by_contact_id', cf.added_by_contact_id,
          'added_by_me', cf.added_by_contact_id IS NOT NULL AND cf.added_by_contact_id = current_contact_id(),
          'added_by_contact_id', cf.added_by_contact_id,
          'owner_role', cf.owner_role, 'value', cf.value, 'value_type', cf.value_type,
          'required', cf.required, 'sort_order', cf.sort_order,
          'parent_field_key', cf.parent_field_key, 'input_kind', cf.input_kind,
          'options', cf.options, 'conditional_on', cf.conditional_on, 'guidance', cf.guidance,
          'closed', coalesce(cf.closed, false),
          'is_optional', cf.is_optional, 'included', cf.included, 'is_na', cf.is_na,
          'control_override', cf.control_override, 'responsibility', cf.responsibility,
          'format_type', cf.format_type, 'structured', cf.structured,
          'pair_cost_key', cf.pair_cost_key, 'pair_manage_key', cf.pair_manage_key,
          'can_edit', (
            CASE
              -- F1 / D4: the six insurance responsibility elections are
              -- PARTY-EXCLUSIVE. Staff status does NOT substitute for owning the
              -- role here, mirroring set_contract_field's carve-out exactly so the
              -- UI never offers an edit the server will reject. FHE is itself the
              -- Lessor on these contracts, so without this the app would render
              -- the LESSEE's box as checkable to FHE staff.
              WHEN cf.field_key IN (
                     'TXN.GL_LESSEE_RESPONSIBLE','TXN.MORT_LESSEE_RESPONSIBLE','TXN.MED_LESSEE_RESPONSIBLE',
                     'TXN.GL_NOT_REQUIRED','TXN.MORT_NOT_REQUIRED','TXN.MED_NOT_REQUIRED')
                THEN cf.owner_role = ANY(v_roles) AND v_can_fill
              ELSE
                   v_staff
                OR (cf.owner_role = 'DEAL' AND v_can_deal)
                OR (cf.owner_role <> 'DEAL' AND cf.owner_role = ANY(v_roles) AND v_can_fill)
            END
          ) AND v_state IN ('editable','editing','in_review'))
        ORDER BY cf.sort_order, cf.field_key)
      FROM contract_fields cf WHERE cf.document_id = p_document_id), '[]'::jsonb),
    -- OPEN change requests now come from the surviving table: a ROOT row that has
    -- been SUBMITTED and not yet resolved. Shape preserved for the caller.
    'open_change_requests', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', cr.id, 'annotation_number', cr.annotation_number,
          'target_field_key', cr.anchor_ref, 'target_section', cr.target_section,
          'current_value', NULL::text, 'requested_change', cr.body,
          'status', 'open')
        ORDER BY cr.annotation_number)
      FROM contract_change_requests cr
      WHERE cr.document_id = p_document_id
        AND cr.parent_request_id IS NULL
        AND cr.submitted_at IS NOT NULL AND cr.resolved_at IS NULL), '[]'::jsonb),
    'shares', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'shared_with_contact_id', s.shared_with_contact_id,
          'recipient_editing', s.recipient_editing, 'notified_at', s.notified_at))
      FROM document_shares s WHERE s.document_id = p_document_id), '[]'::jsonb),
    'signatures', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', sg.party_role, 'typed_name', sg.typed_name,
          'signed_at', sg.signed_at)
        ORDER BY sg.party_role)
      FROM signatures sg WHERE sg.document_id = p_document_id AND sg.deleted_at IS NULL), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$

;
