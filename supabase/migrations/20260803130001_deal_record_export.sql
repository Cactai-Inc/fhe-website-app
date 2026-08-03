/*
  # Stage 3 — the deal record export (deal plan L7)

  The deal record is GENERATED, not authored: an output the parties never fill
  in. deal_record_export(deal) composes it from what the deal already holds —
  its parties, what each side gives, its documents and their signing state.

  Plain key/value prose, no legal language, no signature blocks: this is the
  receipt-grade summary of a deal, produced on demand. It is deliberately NOT a
  contract_templates row — nothing about it is negotiated, gated, or signed.
*/

CREATE OR REPLACE FUNCTION public.deal_record_export(p_deal_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_deal  deals%ROWTYPE;
  v_roles text[];
  v_out   text[] := '{}';
  v_role  text;
  r       record;
  v_any   boolean;
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

  v_out := v_out || ('DEAL RECORD — ' || initcap(lower(v_deal.deal_type)));
  v_out := v_out || ('Reference: ' || coalesce(v_deal.display_code, v_deal.id::text));
  v_out := v_out || ('Opened: ' || to_char(v_deal.created_at, 'FMMonth FMDD, YYYY'));
  v_out := v_out || ('Status: ' || CASE v_deal.status
                                     WHEN 'pending'  THEN 'Pending'
                                     WHEN 'complete' THEN 'Complete'
                                     ELSE 'Void' END);
  IF v_deal.completed_at IS NOT NULL THEN
    v_out := v_out || ('Completed: ' || to_char(v_deal.completed_at, 'FMMonth FMDD, YYYY'));
  END IF;

  -- each side: who they are, and what they give
  FOREACH v_role IN ARRAY v_roles LOOP
    v_out := v_out || ''::text;
    v_out := v_out || (upper(coalesce(initcap(lower(v_role)), v_role)));

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
                         || coalesce(' · ' || r.email, '')
                         || coalesce(' · ' || r.phone, ''));
      IF nullif(btrim(coalesce(r.addr,'')),'') IS NOT NULL THEN
        v_out := v_out || ('    ' || r.addr);
      END IF;
    END LOOP;
    IF NOT v_any THEN v_out := v_out || '  (nobody named yet)'::text; END IF;

    v_out := v_out || '  Gives:'::text;
    v_any := false;
    FOR r IN
      SELECT dc.kind, dc.amount, dc.detail,
             (SELECT coalesce(nullif(h.registered_name,''), h.nickname) FROM horses h WHERE h.id = dc.horse_id) AS horse
        FROM deal_consideration dc
       WHERE dc.deal_id = p_deal_id AND dc.party_role = v_role
       ORDER BY dc.sort_order
    LOOP
      v_any := true;
      v_out := v_out || ('    ' || CASE r.kind
        WHEN 'HORSE'    THEN 'Horse: ' || coalesce(r.horse, 'unnamed')
        WHEN 'PAYMENT'  THEN 'Payment: ' || coalesce(fmt_money(r.amount), '')
                             || coalesce(' — ' || r.detail, '')
        WHEN 'GOODS'    THEN 'Goods: ' || coalesce(r.detail, '')
        WHEN 'SERVICES' THEN 'Services: ' || coalesce(r.detail, '')
        ELSE r.kind || ': ' || coalesce(r.detail, '') END);
    END LOOP;
    IF NOT v_any THEN v_out := v_out || '    (nothing listed yet)'::text; END IF;
  END LOOP;

  -- documents and where each stands
  v_out := v_out || ''::text;
  v_out := v_out || 'DOCUMENTS'::text;
  v_any := false;
  FOR r IN
    SELECT d.id, coalesce(d.title, t.template_key) AS title, d.display_code, d.status,
           d.workflow_state, d.effective_date,
           (SELECT count(*) FROM signatures s
             WHERE s.document_id = d.id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL) AS signed,
           (SELECT count(*) FROM document_parties dp
             WHERE dp.document_id = d.id AND dp.is_signer) AS signers
      FROM documents d JOIN contract_templates t ON t.id = d.template_id
     WHERE d.contract_id = v_deal.contract_id AND d.deleted_at IS NULL
       -- a voided document is not part of the record of the deal
       AND coalesce(d.workflow_state, '') <> 'void'
     ORDER BY d.created_at
  LOOP
    v_any := true;
    v_out := v_out || ('  ' || r.title
                       || coalesce(' (' || r.display_code || ')', '')
                       || ' — ' || CASE WHEN r.status = 'EXECUTED' THEN 'signed by all parties'
                                        ELSE r.signed || ' of ' || r.signers || ' signatures' END
                       || coalesce(', effective ' || to_char(r.effective_date, 'FMMonth FMDD, YYYY'), ''));
  END LOOP;
  IF NOT v_any THEN v_out := v_out || '  (none yet)'::text; END IF;

  IF nullif(btrim(coalesce(v_deal.notes,'')),'') IS NOT NULL THEN
    v_out := v_out || ''::text;
    v_out := v_out || 'NOTES'::text;
    v_out := v_out || ('  ' || v_deal.notes);
  END IF;

  RETURN array_to_string(v_out, E'\n');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.deal_record_export(uuid) TO authenticated;
