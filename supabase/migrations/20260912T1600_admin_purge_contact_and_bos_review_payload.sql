-- 20260912T1600 — admin hard-delete of a contact + BOS review-email payload.
--
-- TWO INDEPENDENT ADDITIONS, both additive (no existing body is rewritten):
--
-- 1. admin_purge_contact(p_contact_id)
--    The D32-exception hard delete, keyed on a CONTACT and callable by an org
--    admin — the atomic, orphan-checked teardown `/api/hard-delete-client` should
--    have been using all along. The endpoint's bare `DELETE FROM contacts` hits
--    RESTRICT foreign keys (documents, signatures, purchases, document_parties,
--    contract_parties, document_deliveries, esign_consents, billable_lines,
--    board_agreements, cost_allocation_rules) and fails — AFTER it has already
--    deleted the auth login, leaving a half-torn-down account. This reuses the
--    proven cascade in `purge_account` (children first, anchors last, orphan
--    sweep) but is keyed on the contact and gated by staff access rather than the
--    D1 test-identity allowlist. The protected-identity denylist and the company
--    guard from purge_account are kept verbatim — a company contact or a protected
--    identity is still refused. `purge_account` itself is UNTOUCHED (D1's own tool).
--
-- 2. contract_review_payload(p_document_id)
--    Feeds the "notify the other party by EMAIL, with my notes and the changes,
--    so they can see them WITHOUT opening the contract" requirement. Returns the
--    recipient party (email + name), the field changes since their signature came
--    off (reusing document_changes_since_signature), and the note the editor left.
--    The API composes the email from this; the DB stays the single source of the
--    diff and the recipient.

-- ── 1. admin_purge_contact ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_purge_contact(p_contact_id uuid, p_confirm text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  -- Belt-and-braces: never these, whatever they are filed as. Mirrors
  -- purge_account's denylist so the two tools can never disagree about who is
  -- protected. (admin@fhequestrian, hello@fhequestrian, admin@cactai — and the
  -- four protected contacts.)
  c_denied_users constant uuid[] := ARRAY[
    'b45a5503-89bc-489a-b012-c7fbf5c09632',
    'fdbdfe89-76d7-486b-b734-8e23b09e0353',
    '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'
  ]::uuid[];
  c_denied_contacts constant uuid[] := ARRAY[
    '75475f66-8950-4f13-832c-5471070737f8',
    '862b7936-9148-465c-b0db-b83246e236a0',
    '352c3898-65d0-4a90-ad59-29107b7e03fe',
    'c6f7cddc-69da-4948-8e62-4a310f079100'
  ]::uuid[];
  v_org      uuid;
  v_user     uuid;
  v_client   uuid;
  v_email    text;
  r          record;
  v_sql      text;
  v_counts   jsonb := '{}'::jsonb;
  v_n        bigint;
BEGIN
  IF p_confirm IS DISTINCT FROM 'PURGE' THEN
    RAISE EXCEPTION 'admin_purge_contact: confirmation token required';
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF NOT has_staff_access() THEN
    RAISE EXCEPTION 'admin_purge_contact: staff access required';
  END IF;

  SELECT org_id INTO v_org FROM contacts WHERE id = p_contact_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'admin_purge_contact: no such contact'; END IF;
  -- Same org only — a purge never reaches across tenants.
  IF v_org IS DISTINCT FROM current_org() THEN
    RAISE EXCEPTION 'admin_purge_contact: contact is not in your organization';
  END IF;

  -- ── PROTECTED-IDENTITY GATE (kept identical to purge_account) ─────────────
  IF p_contact_id = ANY(c_denied_contacts) THEN
    RAISE EXCEPTION 'admin_purge_contact: protected identity — refusing';
  END IF;
  IF EXISTS (SELECT 1 FROM contacts WHERE id = p_contact_id AND is_company) THEN
    RAISE EXCEPTION 'admin_purge_contact: company contact — refusing';
  END IF;

  SELECT user_id INTO v_user FROM profiles WHERE contact_id = p_contact_id;
  IF v_user = ANY(c_denied_users) THEN
    RAISE EXCEPTION 'admin_purge_contact: protected account — refusing';
  END IF;
  SELECT id INTO v_client FROM clients WHERE contact_id = p_contact_id;
  IF v_user IS NOT NULL THEN SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user; END IF;

  -- ── 1. Attribution columns: NULL them (keep the row, drop the pointer) ────
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confrelid::regclass::text AS ref
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
     WHERE c.contype = 'f'
       AND c.confrelid IN ('contacts'::regclass, 'profiles'::regclass, 'clients'::regclass)
       AND c.conrelid <> 'profiles'::regclass
       AND (a.attname IN ('deleted_by','updated_by','created_by','edited_by','administered_by')
            OR a.attname ~ '(actor|author|granted_by|proposed_by|resolved_by|requested_by|entered_by|cancelled_by|archived_by|confirmed_by|created_by|reopened_by|agreed_by|voided_by|claimed_by|originator|provider|signatory|vendor)')
  LOOP
    IF r.ref = 'contacts' AND p_contact_id IS NULL THEN CONTINUE; END IF;
    IF r.ref = 'profiles' AND v_user IS NULL THEN CONTINUE; END IF;
    IF r.ref = 'clients'  AND v_client  IS NULL THEN CONTINUE; END IF;
    v_sql := format('UPDATE %s SET %I = NULL WHERE %I = %L',
                    r.tbl, r.col, r.col,
                    (CASE r.ref WHEN 'contacts' THEN p_contact_id
                                WHEN 'clients'  THEN v_client
                                ELSE v_user END)::text);
    EXECUTE v_sql;
  END LOOP;

  -- ── 2. Ownership rows: delete, children first (mirrors purge_account) ─────
  DELETE FROM esign_consents        WHERE contact_id = p_contact_id;
  DELETE FROM signatures            WHERE signer_contact_id = p_contact_id;
  DELETE FROM document_shares       WHERE shared_with_contact_id = p_contact_id;
  DELETE FROM document_deliveries   WHERE recipient_contact_id = p_contact_id;
  DELETE FROM document_party_archives WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM document_party_controls WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM contract_change_log   WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM contract_change_requests WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM contract_addenda      WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM contract_fields       WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM contract_execution_audit WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM document_parties      WHERE contact_id = p_contact_id
                                       OR document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM documents             WHERE contact_id = p_contact_id;
  DELETE FROM contract_parties      WHERE contact_id = p_contact_id;
  DELETE FROM contact_required_documents WHERE contact_id = p_contact_id;
  DELETE FROM groups                WHERE contact_id = p_contact_id;
  DELETE FROM evaluation_report_shares WHERE shared_with_contact_id = p_contact_id;
  DELETE FROM evaluation_reports    WHERE contact_id = p_contact_id;
  DELETE FROM horse_relationships   WHERE party_contact_id = p_contact_id;
  UPDATE horses SET current_owner_contact_id = NULL WHERE current_owner_contact_id = p_contact_id;
  UPDATE horses SET lessee_contact_id = NULL WHERE lessee_contact_id = p_contact_id;
  DELETE FROM billable_lines        WHERE payer_contact_id = p_contact_id;
  DELETE FROM cost_allocation_rules WHERE payer_contact_id = p_contact_id;
  DELETE FROM board_agreements      WHERE boarder_contact_id = p_contact_id;
  UPDATE contacts SET guardian_contact_id = NULL WHERE guardian_contact_id = p_contact_id;

  -- money + fulfillment spine
  DELETE FROM fulfillment_units WHERE purchase_id IN (
    SELECT id FROM purchases WHERE buyer_contact_id = p_contact_id
      OR (v_user IS NOT NULL AND buyer_user_id = v_user));
  DELETE FROM receipt_sends WHERE purchase_id IN (
    SELECT id FROM purchases WHERE buyer_contact_id = p_contact_id
      OR (v_user IS NOT NULL AND buyer_user_id = v_user));
  DELETE FROM purchase_items WHERE purchase_id IN (
    SELECT id FROM purchases WHERE buyer_contact_id = p_contact_id
      OR (v_user IS NOT NULL AND buyer_user_id = v_user));
  DELETE FROM status_events WHERE entity_type = 'order' AND entity_id IN (
    SELECT id FROM purchases WHERE buyer_contact_id = p_contact_id
      OR (v_user IS NOT NULL AND buyer_user_id = v_user));
  DELETE FROM purchases WHERE buyer_contact_id = p_contact_id
      OR (v_user IS NOT NULL AND buyer_user_id = v_user);

  -- bookings + credits
  DELETE FROM bookings WHERE account_contact_id = p_contact_id
                          OR (v_user IS NOT NULL AND account_user_id = v_user)
                          OR (v_client IS NOT NULL AND client_id = v_client);
  IF v_client IS NOT NULL THEN
    DELETE FROM lesson_credits WHERE client_id = v_client;
  END IF;

  -- community (only when there is a login)
  IF v_user IS NOT NULL THEN
    DELETE FROM feed_seen          WHERE user_id = v_user;
    DELETE FROM feed_shares        WHERE from_user_id = v_user OR to_user_id = v_user;
    DELETE FROM feed_account_items WHERE user_id = v_user;
    DELETE FROM feed_view_pref     WHERE user_id = v_user;
    DELETE FROM feed_posts         WHERE author_id = v_user;
    DELETE FROM content_acknowledgments WHERE user_id = v_user;
    DELETE FROM notifications      WHERE user_id = v_user;
    DELETE FROM members            WHERE user_id = v_user;
  END IF;
  DELETE FROM invitations        WHERE contact_id = p_contact_id
                                    OR (v_email IS NOT NULL AND lower(email) = v_email);

  -- anchors last
  IF v_client IS NOT NULL THEN DELETE FROM clients WHERE id = v_client; END IF;
  IF v_user IS NOT NULL THEN
    DELETE FROM profiles WHERE user_id = v_user;
    DELETE FROM auth.users WHERE id = v_user;
  END IF;
  DELETE FROM contacts WHERE id = p_contact_id;

  -- ── 3. Orphan sweep: prove nothing still points at the purged identity ────
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confrelid::regclass::text AS ref
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
     WHERE c.contype = 'f'
       AND c.confrelid IN ('contacts'::regclass, 'profiles'::regclass, 'clients'::regclass)
  LOOP
    IF r.ref = 'contacts' AND p_contact_id IS NULL THEN CONTINUE; END IF;
    IF r.ref = 'profiles' AND v_user IS NULL THEN CONTINUE; END IF;
    IF r.ref = 'clients'  AND v_client  IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = %L', r.tbl, r.col,
                   (CASE r.ref WHEN 'contacts' THEN p_contact_id
                               WHEN 'clients'  THEN v_client
                               ELSE v_user END)::text) INTO v_n;
    IF v_n > 0 THEN
      v_counts := v_counts || jsonb_build_object(r.tbl || '.' || r.col, v_n);
    END IF;
  END LOOP;

  IF v_counts <> '{}'::jsonb THEN
    RAISE EXCEPTION 'admin_purge_contact: orphaned references remain: %', v_counts::text;
  END IF;

  RETURN jsonb_build_object('purged', true, 'contact_id', p_contact_id,
                            'user_id', v_user, 'had_login', v_user IS NOT NULL);
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_purge_contact(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_purge_contact(uuid, text) TO authenticated;

-- ── 2. contract_review_payload ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.contract_review_payload(p_document_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me       uuid := current_contact_id();
  v_org      uuid;
  v_title    text;
  v_editor   text;
  v_note     text;
  v_recips   jsonb := '[]'::jsonb;
  r          record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT org_id, coalesce(title, 'A document') INTO v_org, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'document not found'; END IF;

  SELECT coalesce(nullif(btrim(concat_ws(' ', first_name, last_name)), ''), email, 'The other party')
    INTO v_editor FROM contacts WHERE id = v_me;

  -- The most recent review note the editor left, if any — the message that must
  -- travel in the email so they can read it WITHOUT opening the contract.
  SELECT l.detail ->> 'message' INTO v_note
    FROM contract_change_log l
   WHERE l.document_id = p_document_id
     AND l.change_kind IN ('review_requested','signature_removed')
     AND l.detail ->> 'message' IS NOT NULL
   ORDER BY l.created_at DESC
   LIMIT 1;

  -- Every OTHER party (not the editor). Each gets the changes computed for THEM
  -- (their signature came off, so the diff anchors on their withdrawal).
  FOR r IN
    SELECT DISTINCT dp.contact_id,
           coalesce(nullif(btrim(concat_ws(' ', c.first_name, c.last_name)), ''), c.email, 'there') AS name,
           c.email AS email,
           dp.party_role
      FROM document_parties dp
      JOIN contacts c ON c.id = dp.contact_id
     WHERE dp.document_id = p_document_id
       AND dp.contact_id IS DISTINCT FROM v_me
       AND NOT coalesce(c.is_company, false)
       AND c.email IS NOT NULL
  LOOP
    v_recips := v_recips || jsonb_build_array(jsonb_build_object(
      'contact_id', r.contact_id,
      'name', r.name,
      'email', r.email,
      'party_role', r.party_role,
      'changes', document_changes_since_signature(p_document_id, r.contact_id)));
  END LOOP;

  RETURN jsonb_build_object(
    'org_id', v_org,
    'document_id', p_document_id,
    'title', v_title,
    'editor', v_editor,
    'note', v_note,
    'link', '/app/contracts/' || p_document_id::text,
    'recipients', v_recips);
END;
$function$;

REVOKE ALL ON FUNCTION public.contract_review_payload(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contract_review_payload(uuid) TO authenticated;
