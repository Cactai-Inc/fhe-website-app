-- Slice 2: send / lock / cancel / archive / delete for contracts, per spec.
--
--   Send to a party = notify + make visible/accessible. (Parties already have RLS
--     access via document_parties; "send" notifies them and stamps sent_at.)
--   Lock before send = advance_document_workflow('locked') — for signature only.
--   Cancel (a party) = notifies ALL parties; the document then awaits a staff
--     decision to archive or delete. A party cannot delete/archive — only cancel.
--   Archive (staff) = findable + resumable: kept in listings, flagged archived,
--     re-openable. NOT deleted.
--   Delete (staff) = hard delete, as if it never existed.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS sent_at       timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at   timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by   uuid REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by  uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- ── Send: notify a party the document is ready for them, grant/confirm access. ──
CREATE OR REPLACE FUNCTION public.send_contract_to_party(p_document_id uuid, p_party_role text)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_state text; v_title text; v_target uuid; v_me uuid := current_contact_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, workflow_state, title INTO v_org, v_state, v_title FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;

  -- only staff, or the originator, may send
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR EXISTS (SELECT 1 FROM documents d WHERE d.id = p_document_id AND d.originator_contact_id = v_me)) THEN
    RAISE EXCEPTION 'not authorized to send this document';
  END IF;

  SELECT contact_id INTO v_target FROM document_parties
   WHERE document_id = p_document_id AND party_role = p_party_role AND contact_id IS NOT NULL LIMIT 1;
  IF v_target IS NULL THEN RAISE EXCEPTION 'that party has no contact to send to'; END IF;

  UPDATE documents SET sent_at = coalesce(sent_at, now()), updated_at = now() WHERE id = p_document_id;

  -- notify the target party (their user, if they have one)
  INSERT INTO notifications (org_id, user_id, kind, title, body, link)
  SELECT v_org, p.user_id, 'contract_sent',
         coalesce(v_title, 'A document') || ' is ready for you',
         'You have a document to review'
           || CASE WHEN v_state IN ('locked') THEN ' and sign.' ELSE ' and complete.' END,
         '/app/contracts/' || p_document_id::text
    FROM profiles p WHERE p.contact_id = v_target;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.send_contract_to_party(uuid, text) TO authenticated;

-- ── Cancel: a PARTY cancels; every other party + staff are notified. The document
--    is flagged cancelled and awaits a staff archive/delete decision. ──
CREATE OR REPLACE FUNCTION public.cancel_contract(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_title text; v_me uuid := current_contact_id(); r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  SELECT org_id, title INTO v_org, v_title FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;

  -- staff, or a party on the document, may cancel
  IF NOT ((has_staff_access() AND v_org = current_org())
          OR EXISTS (SELECT 1 FROM document_parties dp WHERE dp.document_id = p_document_id AND dp.contact_id = v_me)) THEN
    RAISE EXCEPTION 'not authorized to cancel this document';
  END IF;
  IF EXISTS (SELECT 1 FROM documents WHERE id = p_document_id AND workflow_state = 'executed') THEN
    RAISE EXCEPTION 'an executed document cannot be cancelled';
  END IF;

  UPDATE documents SET cancelled_at = now(), cancelled_by = v_me, updated_at = now() WHERE id = p_document_id;

  -- notify every OTHER party
  FOR r IN
    SELECT DISTINCT p.user_id, p.org_id FROM document_parties dp
     JOIN profiles p ON p.contact_id = dp.contact_id
    WHERE dp.document_id = p_document_id AND dp.contact_id IS DISTINCT FROM v_me AND p.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    VALUES (v_org, r.user_id, 'contract_cancelled',
            coalesce(v_title, 'A document') || ' was cancelled',
            'A party cancelled this document. The barn will archive or remove it.',
            '/app/contracts/' || p_document_id::text);
  END LOOP;
  -- notify staff inbox
  PERFORM notify_staff(v_org, 'contract_cancelled',
    coalesce(v_title, 'A document') || ' was cancelled — awaiting archive or delete',
    '/app/ops/documents');
END;
$function$;
GRANT EXECUTE ON FUNCTION public.cancel_contract(uuid) TO authenticated;

-- ── Archive / Unarchive: STAFF only. Findable + resumable. ──
CREATE OR REPLACE FUNCTION public.archive_contract(p_document_id uuid, p_archive boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_me uuid := current_contact_id();
BEGIN
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN RAISE EXCEPTION 'staff access required'; END IF;
  UPDATE documents
     SET archived_at = CASE WHEN p_archive THEN now() ELSE NULL END,
         archived_by = CASE WHEN p_archive THEN v_me ELSE NULL END,
         updated_at = now()
   WHERE id = p_document_id;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.archive_contract(uuid, boolean) TO authenticated;

-- ── Hard delete: STAFF only. As if it never existed. Blocks an executed doc
--    (signed agreements are sacrosanct). ──
CREATE OR REPLACE FUNCTION public.hard_delete_contract(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_org uuid; v_state text; v_contract uuid;
BEGIN
  SELECT org_id, workflow_state, contract_id INTO v_org, v_state, v_contract
    FROM documents WHERE id = p_document_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'unknown document'; END IF;
  IF NOT (has_staff_access() AND v_org = current_org()) THEN RAISE EXCEPTION 'staff access required'; END IF;
  IF v_state = 'executed' THEN RAISE EXCEPTION 'an executed document cannot be deleted'; END IF;

  -- remove dependents, then the document + its contract shell (all created together)
  DELETE FROM contract_fields WHERE document_id = p_document_id;
  DELETE FROM document_parties WHERE document_id = p_document_id;
  DELETE FROM document_change_requests WHERE document_id = p_document_id;
  DELETE FROM contract_addenda WHERE document_id = p_document_id;
  DELETE FROM documents WHERE id = p_document_id;
  IF v_contract IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM documents WHERE contract_id = v_contract) THEN
    DELETE FROM contract_parties WHERE contract_id = v_contract;
    DELETE FROM contracts WHERE id = v_contract;
  END IF;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.hard_delete_contract(uuid) TO authenticated;
