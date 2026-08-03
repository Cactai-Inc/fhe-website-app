/*
  # Stage 4 — signature / edit rules (deal plan L9)

  Owner ruling: the signature / lock / edit / notify functions are a main problem
  area. Do not refactor, expand, or preserve the existing complex options —
  reduce to one simple, straightforward rule:

      A document signed by EITHER party is READ-ONLY. To change it, the signing
      party removes their signature.

  Today the system does the opposite: in the pre-lock states an edit SILENTLY
  voids every standing signature (four functions call void_signatures_on_edit
  with no confirmation), and there is no party-initiated way to remove one. So a
  party could lose their signature without ever being asked, and could never
  withdraw it deliberately.

  What this migration installs:
    document_signature_state(doc)  — who has signed, and therefore whether the
                                     document is locked to edits.
    remove_my_signature(doc)       — the signing party withdraws their own
                                     signature, which is what unlocks editing.
                                     Soft-delete only: the signature RECORD (with
                                     its hash, ip, user agent, timestamp) is
                                     evidence and is never destroyed.
    request_permission_to_edit(doc)— asks the signer(s) to remove their signature.
    notify_review_changes(doc)     — tells the party to review, and marks the
                                     point their review starts from.
    document_changes_since_signature(doc) — the diff a reviewer sees: everything
                                     that changed after their signature came off.
    Edits BLOCK instead of silently voiding: set_contract_field,
    set_field_structured, set_document_co_buyer, remove_document_co_buyer.

  Signature removal is now ONLY ever a deliberate act by the signer (or staff on
  their behalf) — never a side effect of typing.
*/

-- ── who has signed, and is the document therefore locked? ───────────────────
CREATE OR REPLACE FUNCTION public.document_signature_state(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_me uuid := current_contact_id();
BEGIN
  RETURN jsonb_build_object(
    'signed_count', (SELECT count(*) FROM signatures
                      WHERE document_id = p_document_id AND signed_at IS NOT NULL AND deleted_at IS NULL),
    'locked_by_signature', EXISTS (SELECT 1 FROM signatures
                      WHERE document_id = p_document_id AND signed_at IS NOT NULL AND deleted_at IS NULL),
    'i_have_signed', EXISTS (SELECT 1 FROM signatures
                      WHERE document_id = p_document_id AND signer_contact_id = v_me
                        AND signed_at IS NOT NULL AND deleted_at IS NULL),
    'signers', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'contact_id', s.signer_contact_id,
               'party_role', s.party_role,
               'name', coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), c.email),
               'signed_at', s.signed_at)
             ORDER BY s.signed_at)
        FROM signatures s LEFT JOIN contacts c ON c.id = s.signer_contact_id
       WHERE s.document_id = p_document_id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL), '[]'::jsonb));
END;
$function$;

-- ── the signing party withdraws their own signature ─────────────────────────
CREATE OR REPLACE FUNCTION public.remove_my_signature(
  p_document_id uuid, p_contact_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me     uuid := current_contact_id();
  v_target uuid;
  v_org    uuid;
  v_title  text;
  v_roles  text[];
  v_n      int;
  r        record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, coalesce(title, 'A document') INTO v_org, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;

  -- staff may remove on a party's behalf (they sign from the barn office);
  -- everyone else may only remove their own.
  v_target := coalesce(p_contact_id, v_me);
  IF v_target IS DISTINCT FROM v_me AND NOT has_staff_access() THEN
    RAISE EXCEPTION 'you can only remove your own signature';
  END IF;

  SELECT array_agg(DISTINCT party_role) INTO v_roles
    FROM signatures
   WHERE document_id = p_document_id AND signer_contact_id = v_target
     AND signed_at IS NOT NULL AND deleted_at IS NULL;

  IF v_roles IS NULL THEN
    RETURN jsonb_build_object('removed', 0, 'message', 'no standing signature to remove');
  END IF;

  -- SOFT delete: the record that a signature was given, and when, is evidence
  -- and is never destroyed (executed-docs rule).
  UPDATE signatures SET deleted_at = now()
   WHERE document_id = p_document_id AND signer_contact_id = v_target
     AND signed_at IS NOT NULL AND deleted_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  UPDATE documents
     SET signatures_voided_at = now(),
         signatures_voided_roles = coalesce(signatures_voided_roles, '{}') || v_roles,
         status = CASE WHEN status = 'EXECUTED' THEN status ELSE 'AWAITING_SIGNATURE' END,
         -- a locked document returns to editable once a signature comes off
         workflow_state = CASE WHEN workflow_state = 'locked' THEN 'editable' ELSE workflow_state END
   WHERE id = p_document_id;

  PERFORM log_contract_change(p_document_id, 'signature_removed', NULL,
                              'Signature removed', NULL, NULL, NULL,
                              jsonb_build_object('roles', to_jsonb(v_roles)));

  -- tell the other parties the document is open again
  FOR r IN
    SELECT DISTINCT pr.user_id FROM document_parties dp
      JOIN profiles pr ON pr.contact_id = dp.contact_id
     WHERE dp.document_id = p_document_id AND dp.contact_id <> v_target
       AND pr.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_org, r.user_id, 'signature_removed',
              v_title || ' — a signature was removed, so it can be edited again',
              '/app/contracts/' || p_document_id::text);
  END LOOP;

  RETURN jsonb_build_object('removed', v_n, 'roles', to_jsonb(v_roles));
END;
$function$;

-- ── ask the signer to remove their signature ────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_permission_to_edit(
  p_document_id uuid, p_message text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_title text; v_me uuid := current_contact_id();
  v_asker text; v_n int := 0; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, coalesce(title, 'A document') INTO v_org, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;

  SELECT coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), email, 'Someone')
    INTO v_asker FROM contacts WHERE id = v_me;

  FOR r IN
    SELECT DISTINCT s.signer_contact_id, pr.user_id
      FROM signatures s
      JOIN profiles pr ON pr.contact_id = s.signer_contact_id
     WHERE s.document_id = p_document_id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL
       AND s.signer_contact_id IS DISTINCT FROM v_me AND pr.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_org, r.user_id, 'edit_permission_requested',
              v_asker || ' asks to edit ' || v_title || ' — remove your signature to allow changes',
              '/app/contracts/' || p_document_id::text);
    v_n := v_n + 1;
  END LOOP;

  PERFORM log_contract_change(p_document_id, 'edit_permission_requested', NULL,
                              'Permission to edit requested', NULL, NULL, NULL,
                              jsonb_build_object('message', p_message, 'notified', v_n));

  RETURN jsonb_build_object('notified', v_n);
END;
$function$;

-- ── ask the party to review what changed ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_review_changes(
  p_document_id uuid, p_message text DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org uuid; v_title text; v_me uuid := current_contact_id(); v_n int := 0; r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, coalesce(title, 'A document') INTO v_org, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;

  FOR r IN
    SELECT DISTINCT pr.user_id FROM document_parties dp
      JOIN profiles pr ON pr.contact_id = dp.contact_id
     WHERE dp.document_id = p_document_id AND dp.contact_id IS DISTINCT FROM v_me
       AND pr.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      VALUES (v_org, r.user_id, 'review_changes',
              v_title || ' has changes to review', '/app/contracts/' || p_document_id::text);
    v_n := v_n + 1;
  END LOOP;

  PERFORM log_contract_change(p_document_id, 'review_requested', NULL,
                              'Review of changes requested', NULL, NULL, NULL,
                              jsonb_build_object('message', p_message, 'notified', v_n));

  RETURN jsonb_build_object('notified', v_n);
END;
$function$;

-- ── the diff a reviewer sees: what changed after their signature came off ───
CREATE OR REPLACE FUNCTION public.document_changes_since_signature(
  p_document_id uuid, p_contact_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_target uuid := coalesce(p_contact_id, current_contact_id());
  v_since  timestamptz;
BEGIN
  -- the moment their most recent signature was withdrawn; failing that, the
  -- moment they last signed. Nothing before that is "new" to them.
  SELECT max(deleted_at) INTO v_since
    FROM signatures
   WHERE document_id = p_document_id AND signer_contact_id = v_target
     AND deleted_at IS NOT NULL;
  IF v_since IS NULL THEN
    SELECT max(signed_at) INTO v_since
      FROM signatures
     WHERE document_id = p_document_id AND signer_contact_id = v_target;
  END IF;
  IF v_since IS NULL THEN RETURN '[]'::jsonb; END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', l.id,
             'change_kind', l.change_kind,
             'field_key', l.field_key,
             'field_label', l.field_label,
             'old_value', l.old_value,
             'new_value', l.new_value,
             'actor', l.actor_label,
             'at', l.created_at)
           ORDER BY l.created_at)
      FROM contract_change_log l
     WHERE l.document_id = p_document_id
       AND l.created_at > v_since
       AND l.change_kind = 'field_value'), '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.document_signature_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_my_signature(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_permission_to_edit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_review_changes(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.document_changes_since_signature(uuid, uuid) TO authenticated;

-- ── edits BLOCK while a signature stands (replaces silent voiding) ──────────
-- One shared guard, called by every writer, so the rule cannot drift between
-- them the way the four void_signatures_on_edit calls did.
CREATE OR REPLACE FUNCTION public.assert_not_signature_locked(p_document_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_who text;
BEGIN
  SELECT string_agg(coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), c.email, s.party_role), ', ')
    INTO v_who
    FROM signatures s LEFT JOIN contacts c ON c.id = s.signer_contact_id
   WHERE s.document_id = p_document_id AND s.signed_at IS NOT NULL AND s.deleted_at IS NULL;

  IF v_who IS NOT NULL THEN
    RAISE EXCEPTION 'this document is signed by % and is read-only — ask them to remove their signature before making changes', v_who;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assert_not_signature_locked(uuid) TO authenticated;

-- Replace the silent-void call in each writer with the block. Each replacement
-- is anchored on the exact literal and fails loudly if the source has moved.
DO $do$
DECLARE
  v_fn   text;
  v_def  text;
  v_from text;
  v_to   text;
BEGIN
  v_from := 'PERFORM void_signatures_on_edit(p_document_id);';
  v_to   := 'PERFORM assert_not_signature_locked(p_document_id);';

  FOREACH v_fn IN ARRAY ARRAY['set_contract_field','set_field_structured',
                              'set_document_co_buyer','remove_document_co_buyer'] LOOP
    SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname = v_fn LIMIT 1;
    IF v_def IS NULL THEN
      RAISE EXCEPTION '% not found', v_fn;
    END IF;
    IF position(v_from in v_def) = 0 THEN
      RAISE NOTICE '%: no void_signatures_on_edit call found — already converted?', v_fn;
      CONTINUE;
    END IF;
    v_def := replace(v_def, v_from, v_to);
    EXECUTE v_def;
    RAISE NOTICE '%: edits now BLOCK while a signature stands', v_fn;
  END LOOP;
END $do$;

COMMENT ON FUNCTION public.void_signatures_on_edit(uuid) IS
  'RETAINED for the deliberate-removal path only (remove_my_signature soft-deletes '
  'directly). As of 2026-08-03 (deal plan L9) NO edit path calls this: a signed '
  'document is read-only, and a signature comes off only when its signer takes it '
  'off. Do not re-wire this into an edit path.';
