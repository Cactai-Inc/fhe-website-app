/*
  # Re-signing after a withdrawal — archive, then free the slot (deal plan L9)

  Found in live testing, and it took two wrong turns to get right — both worth
  recording so nobody repeats them:

  THE BUG. signatures is UNIQUE on (document_id, signer_contact_id, party_role)
  and remove_my_signature soft-deleted the row. record_signature's INSERT then
  hit the dead row, and its ON CONFLICT ... WHERE signed_at IS NULL did not match
  (a withdrawn row still carries the signed_at of the signature that was given).
  So a party who removed their signature could NEVER sign again — fatal for L9,
  whose whole point is remove → review → sign again.

  WRONG FIX 1: widen record_signature's ON CONFLICT to revive the dead row. The
  schema refused, and rightly: block_signed_signature_update rejects any mutation
  of a row with signed_at set — "use void-and-reissue, not a direct update". A
  given signature is evidence; reviving it rewrites history in place.

  WRONG FIX 2: soft-delete and ALSO insert a fresh pending row. The unique index
  spans soft-deleted rows, so the reissue collides with the row just withdrawn.

  THE FIX. Archive the withdrawn signature into audit_logs — the same archive
  block_signed_signature_update itself writes to for identity merges — capturing
  the full attested state (typed name, signed_at, ip, user agent, method). Then
  free the slot so the party can sign again. The evidence outlives the row: the
  audit entry proves a signature was given, by whom, when, and from where, and
  contract_change_log records the withdrawal as an event on the document.
*/

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
  v_n      int := 0;
  s        record;
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

  v_roles := ARRAY[]::text[];

  FOR s IN
    SELECT * FROM signatures
     WHERE document_id = p_document_id AND signer_contact_id = v_target
       AND signed_at IS NOT NULL AND deleted_at IS NULL
  LOOP
    -- 1. ARCHIVE the attested state. This is the evidence, and it is permanent.
    INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, old_value, new_value, ip, user_agent)
    VALUES (auth.uid(), 'DELETE', 'signatures', s.id,
            jsonb_build_object(
              'reason', 'signature_withdrawn_by_party',
              'document_id', s.document_id,
              'signer_contact_id', s.signer_contact_id,
              'party_role', s.party_role,
              'typed_name', s.typed_name,
              'signed_at', s.signed_at,
              'method', s.method),
            jsonb_build_object('withdrawn_at', now(), 'withdrawn_by_contact_id', v_me),
            s.ip_address, s.user_agent);

    -- 2. FREE the slot. The unique key spans soft-deleted rows, so the row must
    --    go for the party to be able to sign again. Its content now lives in
    --    audit_logs, and the withdrawal is logged on the document below.
    DELETE FROM signatures WHERE id = s.id;

    v_roles := v_roles || s.party_role;
    v_n := v_n + 1;
  END LOOP;

  IF v_n = 0 THEN
    RETURN jsonb_build_object('removed', 0, 'message', 'no standing signature to remove');
  END IF;

  -- 3. REISSUE a pending row per role, so the signing surface has something to
  --    render and the party can sign again once they have reviewed the changes.
  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, method)
  SELECT v_org, p_document_id, v_target, role_key, 'TYPED'
    FROM unnest(v_roles) AS role_key
  ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

  UPDATE documents
     SET signatures_voided_at = now(),
         signatures_voided_roles = coalesce(signatures_voided_roles, '{}') || v_roles,
         status = CASE WHEN status = 'EXECUTED' THEN status ELSE 'AWAITING_SIGNATURE' END,
         -- a locked document returns to editable once a signature comes off
         workflow_state = CASE WHEN workflow_state = 'locked' THEN 'editable' ELSE workflow_state END
   WHERE id = p_document_id;

  PERFORM log_contract_change(p_document_id, 'signature_removed', NULL,
                              'Signature removed', NULL, NULL, NULL,
                              jsonb_build_object('roles', to_jsonb(v_roles),
                                                 'by_contact_id', v_me));

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

-- the changes-since diff keys off the withdrawal EVENT now that the row is gone
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
  -- when this party's signature last came off (the withdrawal event), else when
  -- they last signed. Nothing before that is "new" to them.
  SELECT max(l.created_at) INTO v_since
    FROM contract_change_log l
   WHERE l.document_id = p_document_id
     AND l.change_kind = 'signature_removed'
     AND (l.detail ->> 'by_contact_id')::uuid = v_target;

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
