/*
  # Stage 2 — deal RPCs (deal plan L2, L2a, L3, L8, L12)

  create_deal          — type FIRST (labels the parties), then members, then
                         consideration. Creates the owned spine row.
  update_deal          — notes / type (type only while nothing is attached).
  add_deal_member      — a person on a side; SELECTED from existing contacts.
  remove_deal_member
  add_deal_consideration / remove_deal_consideration
  deal_detail          — the deal page's read: parties, consideration, documents.
  list_deals           — the deals page.
  horse_deals          — reciprocal link from a horse record (L8).
  void_deal            — the delete/void path for a documentless envelope.

  L2a is enforced here: every member is an existing contact and every HORSE
  consideration is an existing horses row. Nothing is created from a deal.

  L13: none of this touches how documents are generated, filled, locked or
  signed. The spine row is created exactly as the existing starters expect one.
*/

-- ── create ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_deal(
  p_deal_type text,
  p_party_a_contact_ids uuid[] DEFAULT '{}',
  p_party_b_contact_ids uuid[] DEFAULT '{}',
  p_notes text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org      uuid;
  v_roles    text[];
  v_contract uuid;
  v_deal     uuid;
  v_id       uuid;
  v_n        int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized to create a deal'; END IF;

  v_roles := deal_party_roles(p_deal_type);
  IF v_roles IS NULL THEN
    RAISE EXCEPTION 'unknown deal type: % (expected SALE or LEASE)', p_deal_type;
  END IF;

  v_org := current_org();

  -- the owned spine row. Documents attach HERE, unchanged (L12).
  INSERT INTO contracts (org_id, segment, status, originator_contact_id, terms)
    VALUES (v_org, 'acquisition', 'draft', current_contact_id(),
            jsonb_build_object('deal_kind', p_deal_type))
    RETURNING id INTO v_contract;

  INSERT INTO deals (org_id, contract_id, deal_type, notes, created_by_contact_id)
    VALUES (v_org, v_contract, p_deal_type, nullif(btrim(coalesce(p_notes,'')),''), current_contact_id())
    RETURNING id INTO v_deal;

  -- members: SELECTED from existing contacts only (L2a)
  FOREACH v_id IN ARRAY coalesce(p_party_a_contact_ids, '{}') LOOP
    PERFORM add_deal_member(v_deal, v_roles[1], v_id);
    v_n := v_n + 1;
  END LOOP;
  FOREACH v_id IN ARRAY coalesce(p_party_b_contact_ids, '{}') LOOP
    PERFORM add_deal_member(v_deal, v_roles[2], v_id);
    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('deal_id', v_deal, 'contract_id', v_contract,
                            'deal_type', p_deal_type, 'roles', v_roles,
                            'members_added', v_n);
END;
$function$;

-- ── members ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_deal_member(
  p_deal_id uuid, p_party_role text, p_contact_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal  deals%ROWTYPE;
  v_roles text[];
  v_next  int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;
  IF v_deal.status <> 'pending' THEN
    RAISE EXCEPTION 'this deal is % and can no longer be configured', v_deal.status;
  END IF;

  v_roles := deal_party_roles(v_deal.deal_type);
  IF NOT (p_party_role = ANY (v_roles)) THEN
    RAISE EXCEPTION '% is not a party role on a % deal (expected % or %)',
      p_party_role, v_deal.deal_type, v_roles[1], v_roles[2];
  END IF;

  -- L2a: the person must already be in the system
  IF NOT EXISTS (SELECT 1 FROM contacts
                  WHERE id = p_contact_id AND org_id = v_deal.org_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'unknown contact — add the person to the system first';
  END IF;

  SELECT coalesce(max(signer_order), 0) + 1 INTO v_next
    FROM contract_parties WHERE contract_id = v_deal.contract_id;

  INSERT INTO contract_parties (org_id, contract_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_deal.org_id, v_deal.contract_id, p_contact_id, p_party_role, true, v_next)
    ON CONFLICT (contract_id, contact_id, party_role) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_deal_member(
  p_deal_id uuid, p_party_role text, p_contact_id uuid)
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
  IF v_deal.status <> 'pending' THEN
    RAISE EXCEPTION 'this deal is % and can no longer be configured', v_deal.status;
  END IF;

  -- a party already on a generated document is not removable from the deal
  IF EXISTS (
    SELECT 1 FROM document_parties dp
      JOIN documents d ON d.id = dp.document_id AND d.deleted_at IS NULL
     WHERE d.contract_id = v_deal.contract_id
       AND dp.contact_id = p_contact_id AND dp.party_role = p_party_role
  ) THEN
    RAISE EXCEPTION 'this person is a party on a document in this deal — remove them there first';
  END IF;

  DELETE FROM contract_parties
   WHERE contract_id = v_deal.contract_id
     AND contact_id = p_contact_id AND party_role = p_party_role;
END;
$function$;

-- ── consideration ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_deal_consideration(
  p_deal_id uuid, p_party_role text, p_kind text,
  p_horse_id uuid DEFAULT NULL, p_amount numeric DEFAULT NULL, p_detail text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal  deals%ROWTYPE;
  v_roles text[];
  v_id    uuid;
  v_next  int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;
  IF v_deal.status <> 'pending' THEN
    RAISE EXCEPTION 'this deal is % and can no longer be configured', v_deal.status;
  END IF;

  v_roles := deal_party_roles(v_deal.deal_type);
  IF NOT (p_party_role = ANY (v_roles)) THEN
    RAISE EXCEPTION '% is not a party role on a % deal', p_party_role, v_deal.deal_type;
  END IF;

  -- L2a: a horse given as consideration must already be in the system
  IF p_kind = 'HORSE' THEN
    IF NOT EXISTS (SELECT 1 FROM horses
                    WHERE id = p_horse_id AND org_id = v_deal.org_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'unknown horse — add the horse to the system first';
    END IF;
  END IF;

  SELECT coalesce(max(sort_order), 0) + 10 INTO v_next
    FROM deal_consideration WHERE deal_id = p_deal_id AND party_role = p_party_role;

  INSERT INTO deal_consideration (org_id, deal_id, party_role, kind, horse_id, amount, detail, sort_order)
    VALUES (v_deal.org_id, p_deal_id, p_party_role, p_kind,
            CASE WHEN p_kind = 'HORSE' THEN p_horse_id END,
            CASE WHEN p_kind = 'HORSE' THEN NULL ELSE p_amount END,
            nullif(btrim(coalesce(p_detail,'')),''), v_next)
    RETURNING id INTO v_id;

  -- the deal's horse: mirrored onto the spine so document generation (which is
  -- horse-keyed) and the horse-record reciprocal link both resolve.
  IF p_kind = 'HORSE' THEN
    UPDATE contracts SET horse_id = coalesce(horse_id, p_horse_id)
     WHERE id = v_deal.contract_id;
  END IF;

  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.remove_deal_consideration(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deal deals%ROWTYPE; v_row deal_consideration%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN RAISE EXCEPTION 'not authorized'; END IF;

  SELECT * INTO v_row FROM deal_consideration WHERE id = p_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_deal FROM deals WHERE id = v_row.deal_id AND deleted_at IS NULL;
  IF v_deal.status <> 'pending' THEN
    RAISE EXCEPTION 'this deal is % and can no longer be configured', v_deal.status;
  END IF;

  DELETE FROM deal_consideration WHERE id = p_id;

  -- if the removed entry was the spine's horse and no other names one, clear it
  IF v_row.kind = 'HORSE' THEN
    UPDATE contracts SET horse_id = NULL
     WHERE id = v_deal.contract_id AND horse_id = v_row.horse_id
       AND NOT EXISTS (SELECT 1 FROM deal_consideration
                        WHERE deal_id = v_deal.id AND kind = 'HORSE' AND horse_id = v_row.horse_id)
       AND NOT EXISTS (SELECT 1 FROM documents
                        WHERE contract_id = v_deal.contract_id AND deleted_at IS NULL);
  END IF;
END;
$function$;

-- ── reads ───────────────────────────────────────────────────────────────────
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

  -- visibility mirrors the RLS policy: staff in-org, or a party to the deal
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
    'deal_type', v_deal.deal_type,
    'status', v_deal.status,
    'completed_at', v_deal.completed_at,
    'notes', v_deal.notes,
    'contract_id', v_deal.contract_id,
    'created_at', v_deal.created_at,
    'roles', to_jsonb(v_roles),
    'parties', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'party_role', cp.party_role,
               'contact_id', cp.contact_id,
               'name', nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''),
               'email', c.email,
               'display_code', c.display_code)
             ORDER BY array_position(v_roles, cp.party_role), cp.signer_order, cp.id)
        FROM contract_parties cp JOIN contacts c ON c.id = cp.contact_id
       WHERE cp.contract_id = v_deal.contract_id), '[]'::jsonb),
    'consideration', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', dc.id, 'party_role', dc.party_role, 'kind', dc.kind,
               'horse_id', dc.horse_id,
               'horse_name', (SELECT coalesce(nullif(h.registered_name,''), h.nickname)
                                FROM horses h WHERE h.id = dc.horse_id),
               'amount', dc.amount, 'detail', dc.detail)
             ORDER BY array_position(v_roles, dc.party_role), dc.sort_order)
        FROM deal_consideration dc WHERE dc.deal_id = v_deal.id), '[]'::jsonb),
    'documents', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'document_id', d.id, 'title', d.title, 'display_code', d.display_code,
               'template_key', t.template_key, 'status', d.status,
               'workflow_state', d.workflow_state, 'created_at', d.created_at)
             ORDER BY d.created_at)
        FROM documents d JOIN contract_templates t ON t.id = d.template_id
       WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL), '[]'::jsonb)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_deals()
 RETURNS TABLE(id uuid, display_code text, deal_type text, status text,
               created_at timestamptz, party_summary text, horse_summary text,
               document_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.id, d.display_code, d.deal_type, d.status, d.created_at,
    (SELECT string_agg(DISTINCT coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), c.email), ', ')
       FROM contract_parties cp JOIN contacts c ON c.id = cp.contact_id
      WHERE cp.contract_id = d.contract_id),
    (SELECT string_agg(DISTINCT coalesce(nullif(h.registered_name,''), h.nickname), ', ')
       FROM deal_consideration dc JOIN horses h ON h.id = dc.horse_id
      WHERE dc.deal_id = d.id AND dc.kind = 'HORSE'),
    (SELECT count(*) FROM documents doc
      WHERE doc.contract_id = d.contract_id AND doc.deleted_at IS NULL)
  FROM deals d
  WHERE d.deleted_at IS NULL
    AND ((has_staff_access() AND d.org_id = current_org())
      OR EXISTS (SELECT 1 FROM contract_parties cp
                  WHERE cp.contract_id = d.contract_id AND cp.contact_id = current_contact_id()))
  ORDER BY d.created_at DESC;
$function$;

-- reciprocal link: the deals a horse appears in (L8)
CREATE OR REPLACE FUNCTION public.horse_deals(p_horse_id uuid)
 RETURNS TABLE(id uuid, display_code text, deal_type text, status text, created_at timestamptz)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT DISTINCT d.id, d.display_code, d.deal_type, d.status, d.created_at
  FROM deals d
  WHERE d.deleted_at IS NULL
    AND (EXISTS (SELECT 1 FROM deal_consideration dc
                  WHERE dc.deal_id = d.id AND dc.horse_id = p_horse_id)
         OR EXISTS (SELECT 1 FROM contracts ct
                     WHERE ct.id = d.contract_id AND ct.horse_id = p_horse_id))
    AND ((has_staff_access() AND d.org_id = current_org())
      OR EXISTS (SELECT 1 FROM contract_parties cp
                  WHERE cp.contract_id = d.contract_id AND cp.contact_id = current_contact_id()))
  ORDER BY d.created_at DESC;
$function$;

-- ── update / void ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_deal(
  p_deal_id uuid, p_deal_type text DEFAULT NULL, p_notes text DEFAULT NULL)
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
  IF v_deal.status <> 'pending' THEN
    RAISE EXCEPTION 'this deal is % and can no longer be edited', v_deal.status;
  END IF;

  IF p_deal_type IS NOT NULL AND p_deal_type IS DISTINCT FROM v_deal.deal_type THEN
    -- the type labels the parties, so it cannot change once anything depends on
    -- those labels (members, consideration, or a generated document)
    IF EXISTS (SELECT 1 FROM contract_parties WHERE contract_id = v_deal.contract_id)
       OR EXISTS (SELECT 1 FROM deal_consideration WHERE deal_id = p_deal_id)
       OR EXISTS (SELECT 1 FROM documents WHERE contract_id = v_deal.contract_id AND deleted_at IS NULL) THEN
      RAISE EXCEPTION 'the deal type cannot change once parties, consideration, or documents exist — void this deal and start another';
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

CREATE OR REPLACE FUNCTION public.void_deal(p_deal_id uuid)
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
  IF NOT FOUND THEN RETURN; END IF;

  -- executed documents are never swept; void the deal around them
  UPDATE deals SET status = 'void', deleted_at = now(), deleted_by = current_contact_id()
   WHERE id = p_deal_id;
  UPDATE contracts SET status = 'void' WHERE id = v_deal.contract_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.create_deal(text, uuid[], uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_deal_member(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_deal_member(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_deal_consideration(uuid, text, text, uuid, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_deal_consideration(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deal_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_deals() TO authenticated;
GRANT EXECUTE ON FUNCTION public.horse_deals(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_deal(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_deal(uuid) TO authenticated;
