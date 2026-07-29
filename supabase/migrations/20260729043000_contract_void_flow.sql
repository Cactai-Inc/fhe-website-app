-- ─────────────────────────────────────────────────────────────────────────────
-- CHANGE-REQUEST / CHANGE-HISTORY / VOID — Part 4 of 4: the void flow.
--
-- Replaces the current hard-void (advance_document_workflow → 'void', which was
-- staff-only) with a party-facing flow:
--
--   • A party may void UNTIL THEY have signed. It stays available even after the
--     OTHER party signs. Once THAT party signs, voiding is gone for them.
--   • Voiding carries a NOTE so the voiding party can tell the other party why.
--   • The counterparty is notified, note included, and gets the same
--     keep-or-remove choice.
--   • OWNER DECISION: keep-or-remove is PER-PARTY. "Remove" hides the document
--     from that party's view ONLY. The document is NEVER destroyed — the legal
--     record survives for the other party and for staff/ops. Removal is a
--     per-party hidden flag, modelled on the existing document_party_archives
--     precedent (same shape, same RLS posture).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── who voided, why, when ────────────────────────────────────────────────────
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS voided_at   timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by   uuid REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS void_reason text;

COMMENT ON COLUMN public.documents.void_reason IS
  'The voiding party''s note to the other party ("why I am no longer interested"). '
  'Shown to the counterparty in their notification and on the voided document.';

-- ── per-party hide ("remove from my documents page") ─────────────────────────
-- Deliberately NOT a delete. One row = one party who has chosen not to see this
-- document. Staff and the other party are unaffected.
CREATE TABLE IF NOT EXISTS public.document_party_hidden (
  document_id uuid        NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  contact_id  uuid        NOT NULL REFERENCES public.contacts(id),
  org_id      uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  hidden_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, contact_id)
);

ALTER TABLE public.document_party_hidden ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dph_self ON public.document_party_hidden;
CREATE POLICY dph_self ON public.document_party_hidden
  USING      (contact_id = current_contact_id() OR (has_staff_access() AND org_id = current_org()))
  WITH CHECK (contact_id = current_contact_id() OR (has_staff_access() AND org_id = current_org()));

COMMENT ON TABLE public.document_party_hidden IS
  'Per-party visibility flag. A row hides the document from THAT contact''s '
  'documents page only; the document row itself is never deleted and stays '
  'visible to every other party and to staff/ops.';

-- ── may I still void this? ───────────────────────────────────────────────────
-- True while the caller is a party who has NOT signed and the document is not
-- already dead. Signing by the OTHER party does not take the option away.
CREATE OR REPLACE FUNCTION public.can_void_document(p_document_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_state text; v_cid uuid; v_dead boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  v_cid := current_contact_id();
  IF v_cid IS NULL THEN RETURN false; END IF;

  SELECT workflow_state,
         (voided_at IS NOT NULL OR cancelled_at IS NOT NULL OR terminated_at IS NOT NULL)
    INTO v_state, v_dead
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_state IS NULL OR v_dead OR v_state IN ('executed','void','terminated') THEN
    RETURN false;
  END IF;

  IF NOT caller_is_document_party(p_document_id) THEN RETURN false; END IF;

  -- gone for a party once THAT party has signed
  RETURN NOT EXISTS (
    SELECT 1 FROM signatures s
     WHERE s.document_id = p_document_id
       AND s.deleted_at IS NULL AND s.signed_at IS NOT NULL
       AND s.signer_contact_id = v_cid);
END;
$function$;

-- ── void_document — modal page 1 (confirm + note) ────────────────────────────
CREATE OR REPLACE FUNCTION public.void_document(p_document_id uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_title text; v_cid uuid; v_label text; v_note text;
  v_party record; v_n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT can_void_document(p_document_id) THEN
    RAISE EXCEPTION 'you can no longer void this document';
  END IF;

  SELECT org_id, coalesce(title,'A contract') INTO v_org, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;

  SELECT contact_id, label INTO v_cid, v_label FROM comment_author_identity(p_document_id);
  v_note := nullif(trim(coalesce(p_note,'')), '');

  UPDATE documents
     SET workflow_state = 'void',
         voided_at      = now(),
         voided_by      = v_cid,
         void_reason    = v_note,
         status         = 'VOID'
   WHERE id = p_document_id;

  PERFORM log_contract_change(p_document_id, 'document_voided', NULL, 'Document',
                              NULL, NULL, 'void',
                              jsonb_build_object('note', coalesce(v_note,'')));

  -- notify every OTHER party, note included
  FOR v_party IN
    SELECT DISTINCT dp.contact_id FROM document_parties dp
     WHERE dp.document_id = p_document_id AND dp.contact_id IS DISTINCT FROM v_cid
  LOOP
    v_n := v_n + 1;
    PERFORM contract_notify(p_document_id, v_party.contact_id, 'contract_voided',
      coalesce(v_label,'The other party') || ' voided ' || v_title,
      coalesce(v_note, 'No reason was given.')
        || E'\n\nYou can keep a copy on your documents page or remove it from your view.');
  END LOOP;

  RETURN jsonb_build_object('voided', true, 'notified', v_n, 'note', v_note);
END;
$function$;

-- ── set_document_party_hidden — modal page 2 (keep or remove), PER PARTY ─────
CREATE OR REPLACE FUNCTION public.set_document_party_hidden(
  p_document_id uuid, p_hidden boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_cid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  v_cid := current_contact_id();
  IF v_cid IS NULL THEN RAISE EXCEPTION 'no contact identity for the caller'; END IF;

  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document: %', p_document_id; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;

  IF coalesce(p_hidden, true) THEN
    INSERT INTO document_party_hidden (document_id, contact_id, org_id)
    VALUES (p_document_id, v_cid, v_org)
    ON CONFLICT (document_id, contact_id) DO NOTHING;
  ELSE
    DELETE FROM document_party_hidden
     WHERE document_id = p_document_id AND contact_id = v_cid;
  END IF;

  -- the document itself is untouched — prove it to the caller
  RETURN jsonb_build_object(
    'hidden', coalesce(p_hidden, true),
    'document_still_exists', EXISTS (SELECT 1 FROM documents WHERE id = p_document_id));
END;
$function$;

-- ── my_contract_documents — honour the per-party hide + surface void state ───
CREATE OR REPLACE FUNCTION public.my_contract_documents()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me    uuid := current_contact_id();
  v_staff boolean := has_staff_access();
  v_org   uuid := current_org();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  -- STAFF/OPS see everything, including documents a party has hidden from
  -- themselves. The legal record is never hidden from ops.
  IF v_staff AND v_org IS NOT NULL THEN
    RETURN coalesce((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.generated_at DESC)
      FROM (
        SELECT DISTINCT
          d.id AS document_id, d.title, d.status, d.workflow_state,
          d.recipient_editing, d.execution_hash, d.generated_at, d.sent_at,
          d.archived_at, d.cancelled_at, d.voided_at, d.void_reason,
          (SELECT dpa.archived_at FROM document_party_archives dpa
            WHERE dpa.document_id = d.id AND dpa.contact_id = v_me) AS my_archived_at,
          (SELECT dph.hidden_at FROM document_party_hidden dph
            WHERE dph.document_id = d.id AND dph.contact_id = v_me) AS my_hidden_at,
          (d.originator_contact_id = v_me) AS is_originator,
          (SELECT string_agg(dp.party_role, ',' ORDER BY dp.party_role)
             FROM document_parties dp
            WHERE dp.document_id = d.id AND dp.contact_id = v_me) AS my_roles,
          (SELECT count(*) FROM contract_change_requests cr
            WHERE cr.document_id = d.id AND cr.parent_request_id IS NULL
              AND cr.submitted_at IS NOT NULL AND cr.resolved_at IS NULL) AS open_change_requests
        FROM documents d
        WHERE d.deleted_at IS NULL
          AND d.org_id = v_org
          AND EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
      ) t
    ), '[]'::jsonb);
  END IF;

  IF v_me IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.generated_at DESC)
    FROM (
      SELECT DISTINCT
        d.id AS document_id, d.title, d.status, d.workflow_state,
        d.recipient_editing, d.execution_hash, d.generated_at, d.sent_at,
        d.archived_at, d.cancelled_at, d.voided_at, d.void_reason,
        (SELECT dpa.archived_at FROM document_party_archives dpa
          WHERE dpa.document_id = d.id AND dpa.contact_id = v_me) AS my_archived_at,
        NULL::timestamptz AS my_hidden_at,
        (d.originator_contact_id = v_me) AS is_originator,
        (SELECT string_agg(dp.party_role, ',' ORDER BY dp.party_role)
           FROM document_parties dp
          WHERE dp.document_id = d.id AND dp.contact_id = v_me) AS my_roles,
        (SELECT count(*) FROM contract_change_requests cr
          WHERE cr.document_id = d.id AND cr.parent_request_id IS NULL
            AND cr.submitted_at IS NOT NULL AND cr.resolved_at IS NULL) AS open_change_requests
      FROM documents d
      JOIN document_parties dp2 ON dp2.document_id = d.id
      WHERE d.deleted_at IS NULL
        AND dp2.contact_id = v_me
        AND EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
        -- PER-PARTY HIDE: removed from MY view only. The row still exists and is
        -- still returned to every other party and to staff (branch above).
        AND NOT EXISTS (SELECT 1 FROM document_party_hidden dph
                         WHERE dph.document_id = d.id AND dph.contact_id = v_me)
    ) t
  ), '[]'::jsonb);
END;
$function$;

-- ── contract_document_detail — re-pointed open_change_requests + void fields ──
CREATE OR REPLACE FUNCTION public.contract_document_detail(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
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

  v_staff := has_staff_access() AND v_org = current_org();
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
        'sent_at', d.sent_at, 'archived_at', d.archived_at, 'cancelled_at', d.cancelled_at,
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
        'effective_date', d.effective_date)
      FROM documents d WHERE d.id = p_document_id),
    'my_roles', to_jsonb(v_roles),
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
            v_staff
            OR (cf.owner_role = 'DEAL' AND v_can_deal)
            OR (cf.owner_role <> 'DEAL' AND cf.owner_role = ANY(v_roles) AND v_can_fill)
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
$function$;

COMMIT;
