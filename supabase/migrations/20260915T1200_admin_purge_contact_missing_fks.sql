-- 20260915T1200 — admin_purge_contact: close the FK gaps that still block a delete.
--
-- ⚠️ THE BUG (owner, 2026-09-15): "delete still returns an fk error even when the
-- test-client checkbox is checked." The endpoint routes through admin_purge_contact,
-- so the raw FK error means the teardown misses a table that holds a RESTRICT/NO
-- ACTION foreign key onto one of the anchors it deletes (contacts, purchases,
-- documents). Such a row throws DURING a DELETE and aborts the whole transaction
-- BEFORE the orphan sweep can turn it into a friendly message — which is exactly the
-- symptom.
--
-- The gaps, found by auditing pg_constraint against the function body:
--
--   onto CONTACTS (deleted last), NO ACTION / RESTRICT, not in the delete list and
--   not matched by the attribution NULL-loop's actor/author regex:
--     • payments.payer_contact_id            (a)
--     • requests.contact_id                  (a)   [+ RESTRICT child request_alert_sends]
--     • document_opened.contact_id           (a)
--     • document_party_hidden.contact_id     (a)
--     • document_delivery_holds.contact_id   (a)
--     • contract_change_request_seen.contact_id (a)
--     • booking_note_seen.contact_id         (cascades, but delete explicitly for order)
--
--   onto PURCHASES (deleted mid-teardown), RESTRICT:
--     • payments.purchase_id                 (r)   → must delete payments BEFORE purchases
--
--   onto DOCUMENTS (deleted mid-teardown), RESTRICT — the contact's OWN documents can
--   carry rows that belong to OTHER parties, which the by-contact deletes miss:
--     • document_deliveries.document_id      (r)   (deliveries to other recipients)
--     • esign_consents.document_id           (r)   (consents from other signers)
--     • signatures.document_id               (r)   (the counterparty's signature)
--
-- This is additive: it only widens the teardown. The denylist, company guard,
-- org check, attribution NULL-loop and orphan sweep are all preserved verbatim.
-- Either the whole account goes or nothing does.

CREATE OR REPLACE FUNCTION public.admin_purge_contact(p_contact_id uuid, p_confirm text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
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
  -- ⚠️ 2026-09-15 additions — the contact's own DOCUMENTS may carry rows that
  -- belong to OTHER parties. Clear those FIRST so the documents delete (below)
  -- does not hit a RESTRICT edge from a counterparty's row.
  DELETE FROM signatures          WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM esign_consents      WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM document_deliveries WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM document_opened     WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);
  DELETE FROM document_party_hidden WHERE document_id IN (SELECT id FROM documents WHERE contact_id = p_contact_id);

  DELETE FROM esign_consents        WHERE contact_id = p_contact_id;
  DELETE FROM signatures            WHERE signer_contact_id = p_contact_id;
  DELETE FROM document_shares       WHERE shared_with_contact_id = p_contact_id;
  DELETE FROM document_deliveries   WHERE recipient_contact_id = p_contact_id;
  -- ⚠️ 2026-09-15 — per-contact document interaction rows (NO ACTION onto contacts).
  DELETE FROM document_opened          WHERE contact_id = p_contact_id;
  DELETE FROM document_party_hidden    WHERE contact_id = p_contact_id;
  DELETE FROM document_delivery_holds  WHERE contact_id = p_contact_id;
  DELETE FROM contract_change_request_seen WHERE contact_id = p_contact_id;
  DELETE FROM booking_note_seen        WHERE contact_id = p_contact_id;
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

  -- ⚠️ 2026-09-15 — payments (NO ACTION onto contacts, RESTRICT onto purchases).
  -- Delete by payer AND by the contact's purchases, BEFORE the purchases delete.
  DELETE FROM payments WHERE payer_contact_id = p_contact_id
                          OR purchase_id IN (
                               SELECT id FROM purchases WHERE buyer_contact_id = p_contact_id
                                 OR (v_user IS NOT NULL AND buyer_user_id = v_user));

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

  -- ⚠️ 2026-09-15 — requests (NO ACTION onto contacts) + its RESTRICT child.
  DELETE FROM request_alert_sends WHERE request_id IN (
    SELECT id FROM requests WHERE contact_id = p_contact_id);
  DELETE FROM requests WHERE contact_id = p_contact_id;

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
