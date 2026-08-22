-- DEALAUTO §1 (consequence) — the governing document is found by KIND, not by
-- one hardcoded template_key.
--
-- Not a redesign of `deal_completion_state` (out of scope, and its ruling on
-- companion documents is untouched here). This is the lookup that feeds it.
--
-- WHY IT HAD TO CHANGE THE MOMENT DEALS AUTO-GENERATE. `deal_status` finds the
-- deal's governing document with `t.template_key = deal_governing_template(
-- deal_type)` — a single literal: 'HORSE_LEASE_V2' for LEASE,
-- 'HORSE_BILL_OF_SALE' for SALE. Production has FOUR active lease templates
-- (HORSE_LEASE_V2, HORSE_LEASE_FULL, HORSE_LEASE_SIMPLE, and HORSE_LEASE) and
-- `start_lease_contract_v2` takes the template key as an argument (LEASEFORK).
-- A lease authored as HORSE_LEASE_FULL matches nothing, so `deal_status`
-- returns 'created', `deal_completion_state` reports "The lease agreement is
-- not signed by all parties" forever, and the deal never completes. The same
-- hole on the sale side is wider still: `start_sale_contract` authors
-- HORSE_SALE_V2 and the literal is HORSE_BILL_OF_SALE.
--
-- With 0 deals in production this was invisible. From migration 1 onward every
-- contract has a deal, so it would have become the normal case.
--
-- The predicate is the one already used by `apply_contract_execution_effects`
-- and `deal_autocomplete_on_execution` — no new classification. Where the
-- canonical template IS present the resolution is unchanged, because the ORDER
-- BY still prefers an exact `deal_governing_template` match: a sale carrying
-- both an agreement and a bill of sale still governs on the bill of sale.

CREATE OR REPLACE FUNCTION public.is_deal_governing_template(
  p_deal_type text, p_template_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT CASE p_deal_type
    WHEN 'LEASE' THEN coalesce(is_horse_lease_template(p_template_key), false)
    WHEN 'SALE'  THEN p_template_key = 'HORSE_PURCHASE_SALE'
                   OR coalesce((SELECT ct.contract_kind FROM contract_templates ct
                                 WHERE ct.template_key = p_template_key
                                 ORDER BY ct.version DESC LIMIT 1), '')
                      IN ('HORSE_SALE', 'HORSE_BILL_OF_SALE')
    ELSE false
  END;
$function$;

-- The one document a deal stands or falls on. NULL means nothing has been
-- opened yet — `deal_status` reads that as its existing 'created' state.
CREATE OR REPLACE FUNCTION public.deal_governing_document(p_deal_id uuid)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT d.id
    FROM deals dl
    JOIN documents d ON d.contract_id = dl.contract_id
    JOIN contract_templates t ON t.id = d.template_id
   WHERE dl.id = p_deal_id AND dl.deleted_at IS NULL
     AND d.deleted_at IS NULL AND coalesce(d.workflow_state, '') <> 'void'
     AND is_deal_governing_template(dl.deal_type, t.template_key)
   ORDER BY (t.template_key = deal_governing_template(dl.deal_type)) DESC,
            d.created_at DESC
   LIMIT 1;
$function$;

-- ── deal_status: same shape, same codes, one lookup replaced ────────────────
CREATE OR REPLACE FUNCTION public.deal_status(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal   deals%ROWTYPE;
  v_doc    record;
  v_need   int;
  v_have   int;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown deal: %', p_deal_id; END IF;

  IF v_deal.status = 'void' THEN
    RETURN jsonb_build_object('code', 'void', 'label', 'Void');
  END IF;

  SELECT d.id, d.workflow_state, d.status INTO v_doc
    FROM documents d WHERE d.id = deal_governing_document(p_deal_id);

  -- no governing document yet: the deal exists, nothing has been opened
  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', 'created', 'label', 'Created');
  END IF;

  SELECT count(*) FILTER (WHERE dp.is_signer) INTO v_need
    FROM document_parties dp WHERE dp.document_id = v_doc.id;
  SELECT count(*) INTO v_have
    FROM signatures s
   WHERE s.document_id = v_doc.id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL;

  IF v_doc.workflow_state = 'executed' OR (v_need > 0 AND v_have >= v_need) THEN
    RETURN jsonb_build_object('code', 'complete', 'label', 'Complete',
                              'signed', v_have, 'required', v_need);
  END IF;

  IF v_have > 0 THEN
    RETURN jsonb_build_object('code', 'signed',
                              'label', 'Signed ' || v_have || '/' || greatest(v_need, v_have),
                              'signed', v_have, 'required', greatest(v_need, v_have));
  END IF;

  RETURN jsonb_build_object('code', 'editable', 'label', 'Editable');
END;
$function$;

-- ── deal_detail: the "governing" flag follows the same resolution ───────────
-- Flag and sort now key on the resolved document ID rather than on a
-- template_key equality that a HORSE_LEASE_FULL lease could never satisfy.
CREATE OR REPLACE FUNCTION public.deal_detail(p_deal_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_deal deals%ROWTYPE; v_roles text[]; v_gov uuid;
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
  v_gov   := deal_governing_document(p_deal_id);

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
               'governing', (d.id = v_gov),
               'signed', (SELECT count(*) FROM signatures s
                           WHERE s.document_id = d.id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL),
               'signers', (SELECT count(*) FROM document_parties dp
                            WHERE dp.document_id = d.id AND dp.is_signer))
             ORDER BY (d.id = v_gov) DESC, d.created_at)
        FROM documents d JOIN contract_templates t ON t.id = d.template_id
       WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL), '[]'::jsonb)
  );
END;
$function$;
