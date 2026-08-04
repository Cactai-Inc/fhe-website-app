/*
  # Deal RPCs for the container model (2026-08-04)

  Rewrites every function that referenced deal_consideration, which is gone. A
  deal is a blank named container: it holds a name, a type, its parties, its
  horse and its documents. Nothing about "what each side gives" lives here —
  that is inside the documents.

  Threshold change: a document could previously only be added once both sides
  had a person AND something given. There is no "given" any more, so the
  threshold is simply a person on each side — which the creation modal supplies,
  so in practice a new deal can add its documents immediately.

  Completion change (owner ruling): a deal is complete when its GOVERNING
  document is signed — the bill of sale for a sale, the lease agreement for a
  lease. Optional add-ons (an agreement, an affidavit) never gate completion:
  the parties may attach one and decide not to use it, and that is their
  business, not the system's.
*/

-- Signatures and return shapes change, so the old definitions must go first
-- (Postgres will not alter a function's return type in place).
DROP FUNCTION IF EXISTS public.create_deal(text, uuid[], uuid[], text);
DROP FUNCTION IF EXISTS public.update_deal(uuid, text, text);
DROP FUNCTION IF EXISTS public.list_deals();
DROP FUNCTION IF EXISTS public.horse_deals(uuid);

-- ── create: now takes the deal's NAME ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_deal(
  p_deal_type text,
  p_party_a_contact_ids uuid[] DEFAULT '{}',
  p_party_b_contact_ids uuid[] DEFAULT '{}',
  p_notes text DEFAULT NULL,
  p_title text DEFAULT NULL,
  p_horse_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_roles text[]; v_contract uuid; v_deal uuid; v_id uuid; v_n int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to create a deal'; END IF;

  v_roles := deal_party_roles(p_deal_type);
  IF v_roles IS NULL THEN
    RAISE EXCEPTION 'unknown deal type: % (expected SALE or LEASE)', p_deal_type;
  END IF;

  v_org := current_org();

  INSERT INTO contracts (org_id, segment, status, horse_id, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', p_horse_id, current_contact_id(),
            jsonb_build_object('deal_kind', p_deal_type))
    RETURNING id INTO v_contract;

  INSERT INTO deals (org_id, contract_id, deal_type, title, notes, created_by_contact_id)
    VALUES (v_org, v_contract, p_deal_type,
            nullif(btrim(coalesce(p_title,'')),''),
            nullif(btrim(coalesce(p_notes,'')),''), current_contact_id())
    RETURNING id INTO v_deal;

  FOREACH v_id IN ARRAY coalesce(p_party_a_contact_ids, '{}') LOOP
    PERFORM add_deal_member(v_deal, v_roles[1], v_id); v_n := v_n + 1;
  END LOOP;
  FOREACH v_id IN ARRAY coalesce(p_party_b_contact_ids, '{}') LOOP
    PERFORM add_deal_member(v_deal, v_roles[2], v_id); v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('deal_id', v_deal, 'contract_id', v_contract,
                            'deal_type', p_deal_type, 'roles', v_roles,
                            'members_added', v_n);
END;
$function$;

-- ── rename / retitle a deal ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_deal(
  p_deal_id uuid, p_deal_type text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_title text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deal deals%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  -- the title is the user's own name for the deal: always editable, including
  -- on a finished deal (renaming changes nothing about what happened)
  IF p_title IS NOT NULL THEN
    UPDATE deals SET title = nullif(btrim(p_title),'') WHERE id = p_deal_id;
  END IF;

  IF v_deal.status <> 'pending' THEN
    IF p_deal_type IS NOT NULL OR p_notes IS NOT NULL THEN
      RAISE EXCEPTION 'this deal is % and can no longer be edited', v_deal.status;
    END IF;
    RETURN;
  END IF;

  IF p_deal_type IS NOT NULL AND p_deal_type IS DISTINCT FROM v_deal.deal_type THEN
    IF EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id)
       OR EXISTS (SELECT 1 FROM documents WHERE contract_id = v_deal.contract_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'the deal type cannot change once parties or documents exist — void this deal and start another';
    END IF;
    IF deal_party_roles(p_deal_type) IS NULL THEN
      RAISE EXCEPTION 'unknown deal type: %', p_deal_type;
    END IF;
    UPDATE deals SET deal_type = p_deal_type WHERE id = p_deal_id;
    UPDATE contracts SET terms = terms || jsonb_build_object('deal_kind', p_deal_type)
     WHERE id = v_deal.contract_id;
  END IF;

  IF p_notes IS NOT NULL THEN
    UPDATE deals SET notes = nullif(btrim(p_notes),'') WHERE id = p_deal_id;
  END IF;
END;
$function$;

-- ── the deal page's read ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deal_detail(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deal deals%ROWTYPE; v_roles text[];
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  IF NOT (has_staff_access() AND v_deal.org_id = current_org())
     AND NOT EXISTS (SELECT 1 FROM contract_parties cp
                      WHERE cp.contract_id = v_deal.contract_id
                        AND cp.contact_id = current_contact_id()) THEN
    RAISE EXCEPTION 'not authorized for this deal';
  END IF;

  v_roles := deal_party_roles(v_deal.deal_type);

  RETURN jsonb_build_object(
    'id', v_deal.id,
    'display_code', v_deal.display_code,
    'title', v_deal.title,
    'deal_type', v_deal.deal_type,
    'status', v_deal.status,
    'badge', deal_status(v_deal.id),
    'completed_at', v_deal.completed_at,
    'notes', v_deal.notes,
    'contract_id', v_deal.contract_id,
    'created_at', v_deal.created_at,
    'roles', to_jsonb(v_roles),
    'horse', (SELECT jsonb_build_object('id', h.id,
                'name', coalesce(nullif(h.registered_name,''), h.nickname))
                FROM horses h JOIN contracts ct ON ct.horse_id = h.id
               WHERE ct.id = v_deal.contract_id),
    'parties', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'party_role', cp.party_role, 'contact_id', cp.contact_id,
               'name', nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
               'email', c.email, 'display_code', c.display_code)
             ORDER BY array_position(v_roles, cp.party_role), cp.signer_order, cp.id)
        FROM contract_parties cp JOIN contacts c ON c.id = cp.contact_id
       WHERE cp.contract_id = v_deal.contract_id), '[]'::jsonb),
    'documents', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'document_id', d.id, 'title', d.title, 'display_code', d.display_code,
               'template_key', t.template_key, 'status', d.status,
               'workflow_state', d.workflow_state, 'created_at', d.created_at,
               'governing', (t.template_key = deal_governing_template(v_deal.deal_type)),
               'signed', (SELECT count(*) FROM signatures s
                           WHERE s.document_id = d.id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL),
               'signers', (SELECT count(*) FROM document_parties dp
                            WHERE dp.document_id = d.id AND dp.is_signer))
             ORDER BY (t.template_key = deal_governing_template(v_deal.deal_type)) DESC, d.created_at)
        FROM documents d JOIN contract_templates t ON t.id = d.template_id
       WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL), '[]'::jsonb)
  );
END;
$function$;

-- ── the deals list ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_deals()
 RETURNS TABLE(id uuid, display_code text, title text, deal_type text, status text,
               badge jsonb, created_at timestamptz, completed_at timestamptz,
               party_summary text, horse_summary text, document_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.id, d.display_code, d.title, d.deal_type, d.status,
    deal_status(d.id), d.created_at, d.completed_at,
    (SELECT string_agg(DISTINCT coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), c.email), ', ')
       FROM contract_parties cp JOIN contacts c ON c.id = cp.contact_id
      WHERE cp.contract_id = d.contract_id),
    (SELECT coalesce(nullif(h.registered_name,''), h.nickname)
       FROM horses h JOIN contracts ct ON ct.horse_id = h.id WHERE ct.id = d.contract_id),
    (SELECT count(*) FROM documents doc
      WHERE doc.contract_id = d.contract_id AND doc.deleted_at IS NULL)
  FROM deals d
  WHERE d.deleted_at IS NULL
    AND ((has_staff_access() AND d.org_id = current_org())
      OR EXISTS (SELECT 1 FROM contract_parties cp
                  WHERE cp.contract_id = d.contract_id AND cp.contact_id = current_contact_id()))
  ORDER BY d.created_at DESC;
$function$;

-- ── the deals a horse appears in (reciprocal link) ──────────────────────────
CREATE OR REPLACE FUNCTION public.horse_deals(p_horse_id uuid)
 RETURNS TABLE(id uuid, display_code text, title text, deal_type text,
               status text, badge jsonb, created_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT d.id, d.display_code, d.title, d.deal_type, d.status,
         deal_status(d.id), d.created_at
  FROM deals d
  JOIN contracts ct ON ct.id = d.contract_id
  WHERE d.deleted_at IS NULL AND ct.horse_id = p_horse_id
    AND ((has_staff_access() AND d.org_id = current_org())
      OR EXISTS (SELECT 1 FROM contract_parties cp
                  WHERE cp.contract_id = d.contract_id AND cp.contact_id = current_contact_id()))
  ORDER BY d.created_at DESC;
$function$;

-- ── add a document: threshold is now just a person on each side ─────────────
CREATE OR REPLACE FUNCTION public.add_deal_document(
  p_deal_id uuid, p_template_key text, p_has_sale_agreement text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal deals%ROWTYPE; v_ctr contracts%ROWTYPE; v_anchor uuid; v_doc uuid;
  v_n int; v_roles text[]; v_horse horses%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to add a document'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;
  IF v_deal.status = 'void' THEN
    RAISE EXCEPTION 'this deal is void — documents cannot be added';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM deal_template_options(v_deal.deal_type) o
                  WHERE o.template_key = p_template_key) THEN
    RAISE EXCEPTION '% is not a document a % deal carries', p_template_key, v_deal.deal_type;
  END IF;

  SELECT * INTO v_ctr FROM contracts WHERE id = v_deal.contract_id;
  v_roles := deal_party_roles(v_deal.deal_type);

  IF NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id AND party_role = v_roles[1])
     OR NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id AND party_role = v_roles[2]) THEN
    RAISE EXCEPTION 'both sides need at least one person before a document can be prepared';
  END IF;

  SELECT contact_id INTO v_anchor FROM contract_parties
   WHERE contract_id = v_deal.contract_id AND party_role = v_roles[2]
   ORDER BY signer_order NULLS LAST, id LIMIT 1;

  SELECT gd.document_id INTO v_doc FROM generate_document(
    v_anchor, p_template_key, v_deal.contract_id, v_ctr.horse_id,
    (SELECT jsonb_agg(jsonb_build_object('contact_id',cp.contact_id,'role',cp.party_role,
                                         'is_signer',cp.is_signer,'signer_order',cp.signer_order))
       FROM contract_parties cp WHERE cp.contract_id = v_deal.contract_id),
    NULL::text) gd;

  UPDATE documents SET originator_contact_id = current_contact_id(),
                       workflow_state = 'editable', status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  INSERT INTO contract_fields (
    org_id, document_id, field_key, label, section, clause_key, owner_role,
    value_type, input_kind, format_type, options, conditional_on, closed, guidance,
    required, is_optional, responsibility, sort_order, parent_field_key, responsibility_kind)
  SELECT v_deal.org_id, v_doc, d.field_key, d.label, d.section, d.clause_key, d.owner_role,
         d.value_type, nullif(d.input_kind,''), d.format_type, d.options, d.conditional_on,
         d.closed, d.guidance, d.required, d.is_optional, d.responsibility, d.sort_order,
         d.parent_field_key, d.responsibility_kind
    FROM contract_field_defs d WHERE d.template_key = p_template_key;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF p_template_key = 'HORSE_BILL_OF_SALE' AND p_has_sale_agreement IN ('YES','NO') THEN
    UPDATE contract_fields SET value = p_has_sale_agreement
     WHERE document_id = v_doc AND field_key = 'TXN.BOS_HAS_SALE_AGREEMENT';
  END IF;

  IF v_ctr.horse_id IS NOT NULL THEN
    PERFORM attach_horse_to_document(v_doc, v_ctr.horse_id);
    SELECT * INTO v_horse FROM horses WHERE id = v_ctr.horse_id;
    UPDATE contract_fields
       SET value = coalesce(horse_field_token_value(v_horse, 'KNOWN_CONDITIONS'), '')
     WHERE document_id = v_doc AND field_key = 'TXN.KNOWN_CONDITIONS'
       AND coalesce(btrim(value), '') = ''
       AND coalesce(horse_field_token_value(v_horse, 'KNOWN_CONDITIONS'), '') <> '';
  END IF;
  PERFORM fill_party_fields_from_contacts(v_doc);
  PERFORM remerge_contract_from_clauses(v_doc);

  RETURN jsonb_build_object('document_id', v_doc, 'template_key', p_template_key,
                            'fields_seeded', v_n);
END;
$function$;

-- ── completion: the GOVERNING document alone decides ────────────────────────
CREATE OR REPLACE FUNCTION public.deal_completion_state(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal deals%ROWTYPE; v_roles text[]; v_missing text[] := '{}'; v_badge jsonb;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  v_roles := deal_party_roles(v_deal.deal_type);
  v_badge := deal_status(p_deal_id);

  IF NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id AND party_role = v_roles[1]) THEN
    v_missing := v_missing || ('No ' || lower(initcap(v_roles[1])) || ' named');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id AND party_role = v_roles[2]) THEN
    v_missing := v_missing || ('No ' || lower(initcap(v_roles[2])) || ' named');
  END IF;

  -- ONLY the governing document gates completion. An optional agreement or
  -- affidavit the parties chose not to sign is their business (owner ruling).
  IF (v_badge ->> 'code') <> 'complete' THEN
    v_missing := v_missing || (CASE v_deal.deal_type
      WHEN 'SALE'  THEN 'The bill of sale is not signed by all parties'
      WHEN 'LEASE' THEN 'The lease agreement is not signed by all parties'
      ELSE 'The governing document is not signed' END);
  END IF;

  RETURN jsonb_build_object(
    'deal_id', p_deal_id, 'status', v_deal.status, 'completed_at', v_deal.completed_at,
    'can_complete', (v_deal.status = 'pending' AND coalesce(array_length(v_missing,1),0) = 0),
    'outstanding', to_jsonb(v_missing));
END;
$function$;

-- ── the deal record export, without consideration ───────────────────────────
CREATE OR REPLACE FUNCTION public.deal_record_export(p_deal_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal deals%ROWTYPE; v_roles text[]; v_out text[] := '{}';
  v_role text; r record; v_any boolean;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  IF NOT (has_staff_access() AND v_deal.org_id = current_org())
     AND NOT EXISTS (SELECT 1 FROM contract_parties cp
                      WHERE cp.contract_id = v_deal.contract_id
                        AND cp.contact_id = current_contact_id()) THEN
    RAISE EXCEPTION 'not authorized for this deal';
  END IF;

  v_roles := deal_party_roles(v_deal.deal_type);

  v_out := v_out || (coalesce(v_deal.title, initcap(lower(v_deal.deal_type)) || ' deal'))::text;
  v_out := v_out || ('Reference: ' || coalesce(v_deal.display_code, v_deal.id::text))::text;
  v_out := v_out || ('Type: ' || initcap(lower(v_deal.deal_type)))::text;
  v_out := v_out || ('Opened: ' || to_char(v_deal.created_at, 'FMMonth FMDD, YYYY'))::text;
  v_out := v_out || ('Status: ' || (deal_status(p_deal_id) ->> 'label'))::text;
  IF v_deal.completed_at IS NOT NULL THEN
    v_out := v_out || ('Completed: ' || to_char(v_deal.completed_at, 'FMMonth FMDD, YYYY'))::text;
  END IF;

  SELECT coalesce(nullif(h.registered_name,''), h.nickname) INTO r
    FROM horses h JOIN contracts ct ON ct.horse_id = h.id WHERE ct.id = v_deal.contract_id;
  IF FOUND THEN
    v_out := v_out || ''::text;
    v_out := v_out || 'HORSE'::text;
    v_out := v_out || ('  ' || (SELECT coalesce(nullif(h.registered_name,''), h.nickname)
                                  FROM horses h JOIN contracts ct ON ct.horse_id = h.id
                                 WHERE ct.id = v_deal.contract_id))::text;
  END IF;

  FOREACH v_role IN ARRAY v_roles LOOP
    v_out := v_out || ''::text;
    v_out := v_out || upper(initcap(lower(v_role)))::text;
    v_any := false;
    FOR r IN
      SELECT nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), '') AS nm,
             c.email, c.phone_display AS phone, c.address_composed AS addr
        FROM contract_parties cp JOIN contacts c ON c.id = cp.contact_id
       WHERE cp.contract_id = v_deal.contract_id AND cp.party_role = v_role
       ORDER BY cp.signer_order NULLS LAST, cp.id
    LOOP
      v_any := true;
      v_out := v_out || ('  ' || coalesce(r.nm, r.email, 'Unnamed')
                         || coalesce(' · ' || r.email, '') || coalesce(' · ' || r.phone, ''))::text;
      IF nullif(btrim(coalesce(r.addr,'')),'') IS NOT NULL THEN
        v_out := v_out || ('    ' || r.addr)::text;
      END IF;
    END LOOP;
    IF NOT v_any THEN v_out := v_out || '  (nobody named yet)'::text; END IF;
  END LOOP;

  v_out := v_out || ''::text;
  v_out := v_out || 'DOCUMENTS'::text;
  v_any := false;
  FOR r IN
    SELECT coalesce(d.title, t.template_key) AS title, d.display_code, d.status,
           d.effective_date,
           (SELECT count(*) FROM signatures s WHERE s.document_id = d.id
              AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL) AS signed,
           (SELECT count(*) FROM document_parties dp WHERE dp.document_id = d.id AND dp.is_signer) AS signers
      FROM documents d JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL
       AND coalesce(d.workflow_state,'') <> 'void'
     ORDER BY d.created_at
  LOOP
    v_any := true;
    v_out := v_out || ('  ' || r.title || coalesce(' (' || r.display_code || ')', '')
                       || ' — ' || CASE WHEN r.status = 'EXECUTED' THEN 'complete'
                                        ELSE r.signed || '/' || r.signers || ' signatures' END
                       || coalesce(', effective ' || to_char(r.effective_date, 'FMMonth FMDD, YYYY'), ''))::text;
  END LOOP;
  IF NOT v_any THEN v_out := v_out || '  (none yet)'::text; END IF;

  IF nullif(btrim(coalesce(v_deal.notes,'')),'') IS NOT NULL THEN
    v_out := v_out || ''::text;
    v_out := v_out || 'NOTES'::text;
    v_out := v_out || ('  ' || v_deal.notes)::text;
  END IF;

  RETURN array_to_string(v_out, E'\n');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_deal(text, uuid[], uuid[], text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_deal(uuid, text, text, text) TO authenticated;
