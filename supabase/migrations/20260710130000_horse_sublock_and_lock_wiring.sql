-- SPEC F + SPEC C.4 wiring — Lessor horse-section sub-lock, and the lock-time
-- re-merge wired into the workflow. One migration so the engine functions are
-- each replaced exactly once:
--   * documents + horse_section_confirmed_at / _by (the per-document stamp)
--   * confirm_horse_section / reopen_horse_section (LESSOR or staff)
--   * advance_document_workflow v2 — locked guards now ALSO require the horse
--     section confirmed (only for documents that HAVE LESSOR-owned HORSE.* fields,
--     so non-lease contracts are unaffected) and the locked transition re-merges
--     the body from fields (remerge_contract_from_fields)
--   * lock_and_sign_contract v2 — the straight-from-editable path gets the same
--     gates + defensive re-merge
--   * set_contract_field v2 — editing a HORSE.* field after confirmation clears it
--   * contract_document_detail v2 — exposes the confirmation stamp
-- SAFETY: re-merge never runs once ANY signature exists (record_signature writes
-- SIG text into merged_body; a re-merge would erase it). Lock precedes signatures,
-- so this only bites re-entrant/edge paths — guarded explicitly anyway.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS horse_section_confirmed_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS horse_section_confirmed_by uuid REFERENCES contacts(id);

-- ---- confirm / reopen ---------------------------------------------------------
CREATE OR REPLACE FUNCTION confirm_horse_section(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_doc documents%ROWTYPE;
  v_is_staff boolean;
  v_is_lessor boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;
  IF v_doc.workflow_state NOT IN ('editable','editing') THEN
    RAISE EXCEPTION 'document is % — the horse section can only be confirmed while editable', v_doc.workflow_state;
  END IF;

  v_is_staff  := has_staff_access() AND v_doc.org_id = current_org();
  v_is_lessor := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = 'LESSOR');
  IF NOT (v_is_staff OR v_is_lessor) THEN
    RAISE EXCEPTION 'only the Lessor (or staff) may confirm the horse information';
  END IF;

  UPDATE documents
     SET horse_section_confirmed_at = now(),
         horse_section_confirmed_by = current_contact_id()
   WHERE id = p_document_id;

  RETURN jsonb_build_object(
    'document_id', p_document_id,
    'horse_section_confirmed_at', now(),
    'horse_section_confirmed_by', current_contact_id());
END;
$fn$;

CREATE OR REPLACE FUNCTION reopen_horse_section(p_document_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_doc documents%ROWTYPE;
  v_is_staff boolean;
  v_is_lessor boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  SELECT * INTO v_doc FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;
  IF v_doc.workflow_state NOT IN ('editable','editing') THEN
    RAISE EXCEPTION 'document is % — the horse section cannot be reopened', v_doc.workflow_state;
  END IF;

  v_is_staff  := has_staff_access() AND v_doc.org_id = current_org();
  v_is_lessor := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = 'LESSOR');
  IF NOT (v_is_staff OR v_is_lessor) THEN
    RAISE EXCEPTION 'only the Lessor (or staff) may reopen the horse section';
  END IF;

  UPDATE documents
     SET horse_section_confirmed_at = NULL,
         horse_section_confirmed_by = NULL
   WHERE id = p_document_id;
END;
$fn$;

REVOKE ALL ON FUNCTION confirm_horse_section(uuid), reopen_horse_section(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION confirm_horse_section(uuid), reopen_horse_section(uuid) TO authenticated, service_role;

-- ---- advance_document_workflow v2 ---------------------------------------------
CREATE OR REPLACE FUNCTION advance_document_workflow(p_document_id uuid, p_to text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org       uuid;
  v_eng       uuid;
  v_from      text;
  v_recip     boolean;
  v_is_staff  boolean;
  v_is_orig   boolean;
  v_is_party  boolean;
  v_open      int;
  v_missing   int;
  v_title     text;
  v_horse_confirmed timestamptz;
  v_needs_horse boolean;
  v_signed    boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, engagement_id, workflow_state, recipient_editing,
         coalesce(title, 'A contract'), horse_section_confirmed_at
    INTO v_org, v_eng, v_from, v_recip, v_title, v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF p_to = 'executed' THEN
    RAISE EXCEPTION 'workflow_state ''executed'' is reached only by signing (record_signature), not manually';
  END IF;
  IF p_to NOT IN ('editable','editing','in_review','locked','void') THEN
    RAISE EXCEPTION 'unknown target workflow_state: %', p_to;
  END IF;

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := contract_caller_is_originator(p_document_id);
  v_is_party := caller_is_document_party(p_document_id);

  IF NOT (v_is_staff OR v_is_party) THEN
    RAISE EXCEPTION 'not authorized to advance document %', p_document_id;
  END IF;

  IF v_from = p_to THEN
    RETURN v_from;
  END IF;

  IF v_from = 'executed' THEN
    RAISE EXCEPTION 'document is executed and cannot change workflow_state';
  END IF;

  IF p_to = 'void' THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'only staff may void a document';
    END IF;

  ELSIF p_to = 'editing' THEN
    IF v_from NOT IN ('editable') THEN
      RAISE EXCEPTION 'illegal transition %→editing', v_from;
    END IF;
    IF NOT v_is_staff AND NOT v_is_orig AND NOT v_recip THEN
      RAISE EXCEPTION 'the counterparty may open editing only when recipient editing is enabled';
    END IF;

  ELSIF p_to = 'editable' THEN
    IF v_from NOT IN ('editing','in_review') THEN
      RAISE EXCEPTION 'illegal transition %→editable', v_from;
    END IF;

  ELSIF p_to = 'in_review' THEN
    IF v_from NOT IN ('editable','editing') THEN
      RAISE EXCEPTION 'illegal transition %→in_review', v_from;
    END IF;

  ELSIF p_to = 'locked' THEN
    IF v_from NOT IN ('in_review','editable','editing') THEN
      RAISE EXCEPTION 'illegal transition %→locked', v_from;
    END IF;
    SELECT count(*) INTO v_open FROM document_change_requests
      WHERE document_id = p_document_id AND status = 'open';
    IF v_open > 0 THEN
      RAISE EXCEPTION 'cannot lock: % open change request(s) remain', v_open;
    END IF;
    SELECT count(*) INTO v_missing FROM contract_fields
      WHERE document_id = p_document_id AND required
        AND nullif(trim(coalesce(value, '')), '') IS NULL;
    IF v_missing > 0 THEN
      RAISE EXCEPTION 'cannot lock: % required field(s) still empty', v_missing;
    END IF;
    -- SPEC F: the Lessor must have confirmed the horse information — only for
    -- documents that carry LESSOR-owned HORSE.* fields (lease-shaped contracts).
    v_needs_horse := EXISTS (
      SELECT 1 FROM contract_fields
      WHERE document_id = p_document_id
        AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
    IF v_needs_horse AND v_horse_confirmed IS NULL THEN
      RAISE EXCEPTION 'cannot lock: the horse information has not been confirmed by the Lessor';
    END IF;
  END IF;

  UPDATE documents SET workflow_state = p_to WHERE id = p_document_id;

  -- SPEC C.4(a): the locked body is re-derived from the negotiated fields (CUT +
  -- strip-unfilled) — the final text the parties sign. Skipped if any signature
  -- already exists (never erase a signer's SIG substitution).
  IF p_to = 'locked' THEN
    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      PERFORM remerge_contract_from_fields(p_document_id);
    END IF;
  END IF;

  IF p_to IN ('in_review','locked') THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      SELECT DISTINCT v_org, pr.user_id,
        CASE p_to WHEN 'in_review' THEN 'contract_in_review' ELSE 'contract_locked' END,
        v_title || (CASE p_to WHEN 'in_review' THEN ' is ready for your review'
                              ELSE ' is ready to sign' END),
        '/app/contracts/' || p_document_id::text
      FROM engagement_parties ep
      JOIN profiles pr ON pr.contact_id = ep.contact_id
      WHERE ep.engagement_id = v_eng
        AND pr.user_id IS NOT NULL
        AND pr.user_id <> auth.uid();
  END IF;

  RETURN p_to;
END;
$fn$;

-- ---- lock_and_sign_contract v2 --------------------------------------------------
CREATE OR REPLACE FUNCTION lock_and_sign_contract(
  p_document_id   uuid,
  p_party_role    text,
  p_typed_name    text,
  p_esign_consent boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_state text;
  v_open  int;
  v_missing int;
  v_horse_confirmed timestamptz;
  v_needs_horse boolean;
  v_signed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT workflow_state, horse_section_confirmed_at INTO v_state, v_horse_confirmed
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF v_state NOT IN ('locked','editable','executed') THEN
    RAISE EXCEPTION 'document is not ready to sign (workflow_state=%); lock it first', v_state;
  END IF;
  IF v_state IN ('editable') THEN
    SELECT count(*) INTO v_open FROM document_change_requests
      WHERE document_id = p_document_id AND status = 'open';
    IF v_open > 0 THEN
      RAISE EXCEPTION 'cannot sign: % open change request(s) remain; resolve or lock first', v_open;
    END IF;
    -- straight-from-editable path gets the same lock gates (spec C.4 + F.3)
    SELECT count(*) INTO v_missing FROM contract_fields
      WHERE document_id = p_document_id AND required
        AND nullif(trim(coalesce(value, '')), '') IS NULL;
    IF v_missing > 0 THEN
      RAISE EXCEPTION 'cannot sign: % required field(s) still empty', v_missing;
    END IF;
    v_needs_horse := EXISTS (
      SELECT 1 FROM contract_fields
      WHERE document_id = p_document_id
        AND owner_role = 'LESSOR' AND field_key LIKE 'HORSE.%');
    IF v_needs_horse AND v_horse_confirmed IS NULL THEN
      RAISE EXCEPTION 'cannot sign: the horse information has not been confirmed by the Lessor';
    END IF;
    -- defensive re-merge so this path also signs a field-sourced, stripped body —
    -- but never once a signature exists (would erase SIG substitutions)
    SELECT EXISTS (SELECT 1 FROM signatures
                   WHERE document_id = p_document_id AND deleted_at IS NULL
                     AND signed_at IS NOT NULL) INTO v_signed;
    IF NOT v_signed THEN
      PERFORM remerge_contract_from_fields(p_document_id);
    END IF;
  END IF;

  RETURN record_signature(p_document_id, p_party_role, p_typed_name, NULL, NULL,
                          coalesce(p_esign_consent, false));
END;
$fn$;

-- ---- set_contract_field v2 (auto-reopen on HORSE.* edit) -------------------------
CREATE OR REPLACE FUNCTION set_contract_field(
  p_document_id uuid,
  p_field_key   text,
  p_value       text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org        uuid;
  v_state      text;
  v_recip_edit boolean;
  v_owner_role text;
  v_is_staff   boolean;
  v_is_orig    boolean;
  v_owns_role  boolean;
  v_row        contract_fields%ROWTYPE;
  v_confirmed  timestamptz;
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

  SELECT owner_role INTO v_owner_role
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no field % on document %', p_field_key, p_document_id;
  END IF;

  IF v_state NOT IN ('editable','editing') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := contract_caller_is_originator(p_document_id);
  v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = v_owner_role);

  IF NOT (
       v_is_staff
    OR (v_owner_role = 'DEAL' AND (v_is_orig OR v_recip_edit))
    OR (v_owner_role <> 'DEAL' AND v_owns_role)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  UPDATE contract_fields
     SET value = p_value,
         entered_by_contact_id = current_contact_id(),
         entered_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key
   RETURNING * INTO v_row;

  -- SPEC F.4: editing horse information after the Lessor confirmed it invalidates
  -- the confirmation — the Lessor must re-confirm the changed facts before lock.
  IF v_owner_role = 'LESSOR' AND p_field_key LIKE 'HORSE.%' AND v_confirmed IS NOT NULL THEN
    UPDATE documents
       SET horse_section_confirmed_at = NULL,
           horse_section_confirmed_by = NULL
     WHERE id = p_document_id;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id, 'document_id', v_row.document_id, 'field_key', v_row.field_key,
    'owner_role', v_row.owner_role, 'value', v_row.value, 'value_type', v_row.value_type,
    'entered_by_contact_id', v_row.entered_by_contact_id, 'entered_at', v_row.entered_at);
END;
$fn$;

-- ---- contract_document_detail v2 (expose the confirmation stamp) ------------------
CREATE OR REPLACE FUNCTION contract_document_detail(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $fn$
DECLARE
  v_me    uuid := current_contact_id();
  v_org   uuid;
  v_recip boolean;
  v_state text;
  v_orig  uuid;
  v_staff boolean;
  v_roles text[];
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, recipient_editing, workflow_state, originator_contact_id
    INTO v_org, v_recip, v_state, v_orig
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  v_staff := has_staff_access() AND v_org = current_org();
  IF NOT (v_staff OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to read document %', p_document_id;
  END IF;

  SELECT array_agg(r) INTO v_roles FROM caller_party_roles(p_document_id) r;
  v_roles := coalesce(v_roles, ARRAY[]::text[]);

  SELECT jsonb_build_object(
    'document', (SELECT jsonb_build_object(
        'document_id', d.id, 'title', d.title, 'status', d.status,
        'workflow_state', d.workflow_state, 'recipient_editing', d.recipient_editing,
        'execution_hash', d.execution_hash, 'merged_body', d.merged_body,
        'is_originator', (d.originator_contact_id = v_me),
        'horse_section_confirmed_at', d.horse_section_confirmed_at,
        'horse_section_confirmed_by', d.horse_section_confirmed_by)
      FROM documents d WHERE d.id = p_document_id),
    'my_roles', to_jsonb(v_roles),
    'fields', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'field_key', cf.field_key, 'label', cf.label, 'section', cf.section,
          'owner_role', cf.owner_role, 'value', cf.value, 'value_type', cf.value_type,
          'required', cf.required, 'sort_order', cf.sort_order,
          'can_edit', (
            v_staff
            OR (cf.owner_role = 'DEAL' AND ((v_orig = v_me) OR v_recip))
            OR (cf.owner_role <> 'DEAL' AND cf.owner_role = ANY(v_roles))
          ) AND v_state IN ('editable','editing'))
        ORDER BY cf.sort_order, cf.field_key)
      FROM contract_fields cf WHERE cf.document_id = p_document_id), '[]'::jsonb),
    'open_change_requests', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', cr.id, 'annotation_number', cr.annotation_number,
          'target_field_key', cr.target_field_key, 'target_section', cr.target_section,
          'current_value', cr.current_value, 'requested_change', cr.requested_change,
          'status', cr.status)
        ORDER BY cr.annotation_number)
      FROM document_change_requests cr
      WHERE cr.document_id = p_document_id AND cr.status = 'open'), '[]'::jsonb),
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
$fn$;
