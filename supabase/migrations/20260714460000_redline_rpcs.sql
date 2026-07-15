/*
  # Contract redlining — RPCs (part 2): propose → highlight → approve → weave

  propose_field_edit / resolve_field_edit  — stage + apply an edit to an existing
    field (staged in proposed_value; accepted overwrites value).
  propose_clause / resolve_clause          — a party-authored new clause; accepted
    clauses fold into the TXN.ADDITIONAL_TERMS field the lease body renders.
  withdraw_field_edit / withdraw_clause    — the proposer retracts their own.

  Gating (server-side): staff/originator may always act. A party may PROPOSE an
  edit only with can_suggest, and a NEW clause only with can_add_clause. Only the
  originator or staff may RESOLVE. Proposals only in editable/editing.
*/

-- caller may propose the given control on this document
CREATE OR REPLACE FUNCTION caller_may_propose(p_document_id uuid, p_control text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid; v_ok boolean;
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF (has_staff_access() AND v_org = current_org()) OR contract_caller_is_originator(p_document_id) THEN
    RETURN true;
  END IF;
  SELECT bool_or(CASE p_control WHEN 'suggest' THEN coalesce(c.can_suggest,false)
                                WHEN 'add_clause' THEN coalesce(c.can_add_clause,false)
                                ELSE false END)
    INTO v_ok
    FROM document_parties dp
    LEFT JOIN document_party_controls c ON c.document_id = dp.document_id AND c.party_role = dp.party_role
    WHERE dp.document_id = p_document_id AND dp.contact_id = current_contact_id();
  RETURN coalesce(v_ok, false);
END;
$fn$;

-- notify the document's parties (except the actor) of a redline event
CREATE OR REPLACE FUNCTION redline_notify(p_document_id uuid, p_kind text, p_prefix text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $fn$
  INSERT INTO notifications (org_id, user_id, kind, title, link)
  SELECT d.org_id, pr.user_id, p_kind,
         p_prefix || coalesce(d.title, 'a contract'),
         '/app/contracts/' || d.id::text
  FROM documents d
  JOIN document_parties dp ON dp.document_id = d.id
  JOIN profiles pr ON pr.contact_id = dp.contact_id
  WHERE d.id = p_document_id AND pr.user_id IS NOT NULL AND pr.user_id <> auth.uid();
$fn$;

-- ── propose / resolve an EDIT to an existing field ──────────────────────────
CREATE OR REPLACE FUNCTION propose_field_edit(p_document_id uuid, p_field_key text, p_proposed_value text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_state text; v_me uuid := current_contact_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT caller_may_propose(p_document_id, 'suggest') THEN RAISE EXCEPTION 'not permitted to propose changes'; END IF;
  SELECT workflow_state INTO v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'the document is not open for changes'; END IF;

  UPDATE contract_fields
     SET proposed_value = p_proposed_value, proposed_by_contact_id = v_me, proposed_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'no field % on this document', p_field_key; END IF;

  PERFORM redline_notify(p_document_id, 'contract_change_proposed', 'A change was proposed on ');
  RETURN jsonb_build_object('ok', true);
END;
$fn$;

CREATE OR REPLACE FUNCTION resolve_field_edit(p_document_id uuid, p_field_key text, p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid; v_pv text; v_pby uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR contract_caller_is_originator(p_document_id)) THEN
    RAISE EXCEPTION 'only the document owner or staff may resolve a proposal';
  END IF;
  SELECT proposed_value, proposed_by_contact_id INTO v_pv, v_pby
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF v_pby IS NULL THEN RAISE EXCEPTION 'no pending proposal on that field'; END IF;

  IF p_accept THEN
    UPDATE contract_fields
       SET value = v_pv, entered_by_contact_id = v_pby, entered_at = now(),
           proposed_value = NULL, proposed_by_contact_id = NULL, proposed_at = NULL, updated_at = now()
     WHERE document_id = p_document_id AND field_key = p_field_key;
  ELSE
    UPDATE contract_fields
       SET proposed_value = NULL, proposed_by_contact_id = NULL, proposed_at = NULL
     WHERE document_id = p_document_id AND field_key = p_field_key;
  END IF;
  RETURN jsonb_build_object('accepted', p_accept);
END;
$fn$;

CREATE OR REPLACE FUNCTION withdraw_field_edit(p_document_id uuid, p_field_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  UPDATE contract_fields
     SET proposed_value = NULL, proposed_by_contact_id = NULL, proposed_at = NULL
   WHERE document_id = p_document_id AND field_key = p_field_key
     AND proposed_by_contact_id = current_contact_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'no proposal of yours on that field'; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$fn$;

-- ── propose / resolve a NEW clause (addendum) ───────────────────────────────
CREATE OR REPLACE FUNCTION propose_clause(p_document_id uuid, p_body text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_org uuid; v_state text; v_me uuid := current_contact_id(); v_num int; v_role text; v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NULLIF(btrim(coalesce(p_body,'')),'') IS NULL THEN RAISE EXCEPTION 'the clause text is empty'; END IF;
  IF NOT caller_may_propose(p_document_id, 'add_clause') THEN RAISE EXCEPTION 'not permitted to add a clause'; END IF;
  SELECT org_id, workflow_state INTO v_org, v_state FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_state NOT IN ('editable','editing') THEN RAISE EXCEPTION 'the document is not open for changes'; END IF;

  SELECT coalesce(max(item_number),0)+1 INTO v_num FROM contract_addenda WHERE document_id = p_document_id;
  SELECT party_role INTO v_role FROM document_parties WHERE document_id = p_document_id AND contact_id = v_me LIMIT 1;

  INSERT INTO contract_addenda (org_id, document_id, item_number, body, proposed_by_contact_id, proposed_by_role, status)
    VALUES (v_org, p_document_id, v_num, btrim(p_body), v_me, v_role, 'open')
    RETURNING id INTO v_id;

  PERFORM redline_notify(p_document_id, 'contract_clause_proposed', 'A new clause was proposed on ');
  RETURN jsonb_build_object('addendum_id', v_id, 'item_number', v_num);
END;
$fn$;

CREATE OR REPLACE FUNCTION resolve_clause(p_addendum_id uuid, p_accept boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE v_doc uuid; v_org uuid; v_terms text := ''; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT document_id, org_id INTO v_doc, v_org FROM contract_addenda WHERE id = p_addendum_id;
  IF v_doc IS NULL THEN RAISE EXCEPTION 'unknown addendum'; END IF;
  IF NOT ((has_staff_access() AND v_org = current_org()) OR contract_caller_is_originator(v_doc)) THEN
    RAISE EXCEPTION 'only the document owner or staff may resolve a clause';
  END IF;

  UPDATE contract_addenda
     SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END,
         resolved_by_contact_id = current_contact_id(), resolved_at = now()
   WHERE id = p_addendum_id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'that clause is already resolved'; END IF;

  -- rebuild TXN.ADDITIONAL_TERMS from all accepted clauses (renumbered A-1, A-2…)
  FOR r IN SELECT body, row_number() OVER (ORDER BY item_number) AS n
             FROM contract_addenda WHERE document_id = v_doc AND status = 'accepted' ORDER BY item_number LOOP
    v_terms := v_terms || 'A-' || r.n || '. ' || r.body || E'\n\n';
  END LOOP;
  IF v_terms <> '' THEN
    v_terms := E'28. ADDITIONAL TERMS\n\nThe following additional terms have been agreed by the parties:\n\n' || btrim(v_terms);
  END IF;

  INSERT INTO contract_fields (org_id, document_id, field_key, label, section, owner_role, value, value_type, sort_order)
    VALUES (v_org, v_doc, 'TXN.ADDITIONAL_TERMS', 'Additional Terms', 'Additional Terms', 'DEAL',
            nullif(v_terms,''), 'longtext', 900)
  ON CONFLICT (document_id, field_key) DO UPDATE SET value = excluded.value, updated_at = now();

  RETURN jsonb_build_object('accepted', p_accept);
END;
$fn$;

CREATE OR REPLACE FUNCTION withdraw_clause(p_addendum_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  UPDATE contract_addenda SET status = 'withdrawn', resolved_at = now()
   WHERE id = p_addendum_id AND status = 'open' AND proposed_by_contact_id = current_contact_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'no open clause of yours to withdraw'; END IF;
  RETURN jsonb_build_object('ok', true);
END;
$fn$;

REVOKE ALL ON FUNCTION propose_field_edit(uuid,text,text), resolve_field_edit(uuid,text,boolean),
  withdraw_field_edit(uuid,text), propose_clause(uuid,text), resolve_clause(uuid,boolean),
  withdraw_clause(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION propose_field_edit(uuid,text,text), resolve_field_edit(uuid,text,boolean),
  withdraw_field_edit(uuid,text), propose_clause(uuid,text), resolve_clause(uuid,boolean),
  withdraw_clause(uuid) TO authenticated, service_role;
