-- ─────────────────────────────────────────────────────────────────────────────
-- H1 — ORIGINATOR AUTHORITY COLLAPSE (owner-approved review-workflow design).
--
-- The company is ALWAYS the author of a contract; "party as author" is removed.
-- Every function that granted rights via the `staff OR
-- contract_caller_is_originator(...)` pattern collapses to the staff check.
-- documents.originator_contact_id / contracts.originator_contact_id are KEPT and
-- still stamped everywhere (D7 provenance) — they just no longer grant rights.
--
-- Enumerated users of the pattern (pg_proc.prosrc ILIKE '%originator%'), and the
-- disposition applied here:
--   AUTHORITY REMOVED (this migration):
--     caller_may_propose, add_contract_element, contract_document_detail
--     (can_edit disjunct), remerge_contract_from_fields, seed_contract_fields,
--     resolve_field_edit, resolve_clause, resolve_change_request,
--     set_contract_field, set_field_structured, set_field_control_override,
--     send_contract_to_party, share_document, set_recipient_editing
--   PARTY-AS-AUTHOR ASSIGNMENT REMOVED (stamp = the staff caller instead):
--     start_lease_contract_v2, start_lease_contract, start_purchase_contract,
--     link_contract_to_purchase
--   AUTHORITY REMOVED IN 20260729023000 (full rewrite there):
--     advance_document_workflow
--   KEPT UNCHANGED (provenance stamp / display / notification only, no rights):
--     claim_document_origination (staff-only stamp), my_contract_documents
--     (is_originator display flag), request_document_change (notify target),
--     redeem_contract_invitation (provenance re-anchor on promotion),
--     contract_caller_is_originator (helper retained; no longer consulted for
--     authority anywhere after 20260729023000)
--
-- NOTE (repo convention): this migration rewrites live function bodies in place
-- (read pg_get_functiondef → strict string replace → re-execute). Like the ~31
-- prior in-place migrations, it is not replayable on a fresh database.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp._patch_fn(p_name text, p_old text, p_new text)
RETURNS void LANGUAGE plpgsql AS $patch$
DECLARE v_oid oid; v_src text; v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = p_name;
  IF v_n <> 1 THEN RAISE EXCEPTION 'expected exactly one public.%, found %', p_name, v_n; END IF;
  SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = p_name;
  v_src := pg_get_functiondef(v_oid);
  IF position(p_old IN v_src) = 0 THEN
    RAISE EXCEPTION 'pattern not found in %: %', p_name, p_old;
  END IF;
  v_src := replace(v_src, p_old, p_new);
  EXECUTE v_src;
END;
$patch$;

-- ── authority collapses ──────────────────────────────────────────────────────
SELECT pg_temp._patch_fn('caller_may_propose',
  '(has_staff_access() AND v_org = current_org()) OR contract_caller_is_originator(p_document_id)',
  '(has_staff_access() AND v_org = current_org())');

SELECT pg_temp._patch_fn('add_contract_element',
E'((has_staff_access() AND v_org = current_org())\n          OR contract_caller_is_originator(p_document_id)\n          OR caller_is_document_party(p_document_id))',
E'((has_staff_access() AND v_org = current_org())\n          OR caller_is_document_party(p_document_id))');

SELECT pg_temp._patch_fn('contract_document_detail',
  'OR (cf.owner_role = ''DEAL'' AND ((v_orig = v_me) OR v_can_deal))',
  'OR (cf.owner_role = ''DEAL'' AND v_can_deal)');

SELECT pg_temp._patch_fn('remerge_contract_from_fields',
E'    OR contract_caller_is_originator(p_document_id)\n    OR caller_is_document_party(p_document_id)',
E'    OR caller_is_document_party(p_document_id)');

SELECT pg_temp._patch_fn('seed_contract_fields',
E'       (has_staff_access() AND v_org = current_org())\n    OR contract_caller_is_originator(p_document_id)\n',
E'       (has_staff_access() AND v_org = current_org())\n');

SELECT pg_temp._patch_fn('resolve_field_edit',
  'IF NOT ((has_staff_access() AND v_org = current_org()) OR contract_caller_is_originator(p_document_id)) THEN',
  'IF NOT (has_staff_access() AND v_org = current_org()) THEN');

SELECT pg_temp._patch_fn('resolve_clause',
  'IF NOT ((has_staff_access() AND v_org = current_org()) OR contract_caller_is_originator(v_doc)) THEN',
  'IF NOT (has_staff_access() AND v_org = current_org()) THEN');

SELECT pg_temp._patch_fn('resolve_change_request',
E'       (has_staff_access() AND v_org = current_org())\n    OR contract_caller_is_originator(v_cr.document_id)\n',
E'       (has_staff_access() AND v_org = current_org())\n');

SELECT pg_temp._patch_fn('set_contract_field',
  'v_is_orig  := contract_caller_is_originator(p_document_id);',
  'v_is_orig  := false;  -- H1: originator no longer grants edit rights');
SELECT pg_temp._patch_fn('set_contract_field',
  'OR (v_owner_role = ''DEAL'' AND (v_is_orig OR v_can_deal))',
  'OR (v_owner_role = ''DEAL'' AND v_can_deal)');

SELECT pg_temp._patch_fn('set_field_structured',
  'v_is_orig   := contract_caller_is_originator(p_document_id);',
  'v_is_orig   := false;  -- H1: originator no longer grants edit rights');
SELECT pg_temp._patch_fn('set_field_structured',
  'OR (v_owner_role = ''DEAL'' AND (v_is_orig OR v_can_deal))',
  'OR (v_owner_role = ''DEAL'' AND v_can_deal)');

SELECT pg_temp._patch_fn('set_field_control_override',
E'\n          OR EXISTS (SELECT 1 FROM documents d WHERE d.id = p_document_id AND d.originator_contact_id = current_contact_id())',
  '');

SELECT pg_temp._patch_fn('send_contract_to_party',
E'\n          OR EXISTS (SELECT 1 FROM documents d WHERE d.id = p_document_id AND d.originator_contact_id = v_me)',
  '');

SELECT pg_temp._patch_fn('share_document',
E'\n    OR contract_caller_is_originator(p_document_id)',
  '');

SELECT pg_temp._patch_fn('set_recipient_editing',
E'\n    OR contract_caller_is_originator(p_document_id)',
  '');

-- ── party-as-author assignment removal at creation ──────────────────────────
SELECT pg_temp._patch_fn('start_lease_contract_v2',
E'  v_originator := CASE WHEN upper(coalesce(p_responsible_role,''LESSEE'')) = ''LESSOR''\n                       THEN coalesce(p_lessor_contact_id, p_lessee_contact_id)\n                       ELSE p_lessee_contact_id END;',
  '  v_originator := current_contact_id();  -- H1: the company (staff caller) is always the author');

SELECT pg_temp._patch_fn('start_lease_contract',
E'  v_originator := CASE WHEN upper(coalesce(p_responsible_role,''LESSEE'')) = ''LESSOR''\n                       THEN coalesce(p_lessor_contact_id, p_lessee_contact_id)\n                       ELSE p_lessee_contact_id END;',
  '  v_originator := current_contact_id();  -- H1: the company (staff caller) is always the author');

SELECT pg_temp._patch_fn('start_purchase_contract',
  'VALUES (v_org, ''acquisition'', ''draft'', p_horse_id, p_buyer_contact_id, jsonb_build_object(''deal_side'',''PURCHASE''))',
  'VALUES (v_org, ''acquisition'', ''draft'', p_horse_id, current_contact_id(), jsonb_build_object(''deal_side'',''PURCHASE''))');
SELECT pg_temp._patch_fn('start_purchase_contract',
  'SET originator_contact_id = p_buyer_contact_id,',
  'SET originator_contact_id = current_contact_id(),');

SELECT pg_temp._patch_fn('link_contract_to_purchase',
  'originator_contact_id = coalesce(originator_contact_id, v_buyer)',
  'originator_contact_id = coalesce(originator_contact_id, current_contact_id())');

DROP FUNCTION pg_temp._patch_fn(text, text, text);

COMMIT;
