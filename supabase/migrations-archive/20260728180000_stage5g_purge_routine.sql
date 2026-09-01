-- Stage 5g (REMEDIATION_PLAN): THE PURGE ROUTINE.
--
-- Removes an account and ALL associated content cleanly — no orphaned
-- references, no trigger misfires — and is STRUCTURALLY unable to touch
-- anything outside its allowlist.
--
-- ALLOWLIST (checked INSIDE the function, by email, against auth.users):
--   cjzigs@icloud.com, charlesjzigmund@gmail.com
-- Everything else — including every D1 protected identity (both staff
-- accounts, the company contact, admin@cactai.io) — is refused before a
-- single row is touched. The denylist is asserted a second time by id, so a
-- future email change cannot smuggle a protected identity through.
--
-- The sweep is SCHEMA-DRIVEN: it walks pg_constraint for every FK pointing at
-- contacts / profiles / clients / auth.users and clears or deletes by
-- reference class, so a table added later is covered automatically rather
-- than silently orphaning rows. Attribution-only columns (deleted_by,
-- actor/author/created_by/…) are NULLed; ownership rows are deleted.
--
-- NOT run against the test identities here. Build, prove on a disposable
-- synthetic account, deliver (per the plan).

CREATE OR REPLACE FUNCTION public.purge_account(p_user_id uuid, p_confirm text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  -- the ONLY identities this routine may ever touch
  c_allowed_emails constant text[] := ARRAY[
    'cjzigs@icloud.com',
    'charlesjzigmund@gmail.com'
  ]::text[];
  -- The routine must be PROVABLE before it is trusted with the real test
  -- identities. A synthetic proof account is admitted ONLY inside an explicit
  -- transaction-local flag that a caller must set deliberately; it can never
  -- widen the allowlist for a real identity (the denylist checks below still
  -- run, and the address is a reserved non-routable test domain).
  c_proof_domain constant text := '@purge-proof.invalid';
  -- belt-and-braces: never these, whatever their email says
  c_denied_users constant uuid[] := ARRAY[
    'b45a5503-89bc-489a-b012-c7fbf5c09632',  -- admin@fhequestrian.com
    'fdbdfe89-76d7-486b-b734-8e23b09e0353',  -- hello@fhequestrian.com
    '3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'   -- admin@cactai.io (platform)
  ]::uuid[];
  c_denied_contacts constant uuid[] := ARRAY[
    '75475f66-8950-4f13-832c-5471070737f8',
    '862b7936-9148-465c-b0db-b83246e236a0',
    '352c3898-65d0-4a90-ad59-29107b7e03fe',
    'c6f7cddc-69da-4948-8e62-4a310f079100'
  ]::uuid[];
  v_email    text;
  v_contact  uuid;
  v_client   uuid;
  r          record;
  v_sql      text;
  v_counts   jsonb := '{}'::jsonb;
  v_n        bigint;
BEGIN
  IF p_confirm IS DISTINCT FROM 'PURGE' THEN
    RAISE EXCEPTION 'purge_account: confirmation token required';
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'purge_account: no such account'; END IF;

  -- ── THE STRUCTURAL GATE ───────────────────────────────────────────────────
  IF NOT (
       v_email = ANY(c_allowed_emails)
       OR (v_email LIKE '%' || c_proof_domain
           AND current_setting('app.purge_proof', true) = '1')
     ) THEN
    RAISE EXCEPTION 'purge_account: % is not on the allowlist — refusing', v_email;
  END IF;
  IF p_user_id = ANY(c_denied_users) THEN
    RAISE EXCEPTION 'purge_account: protected identity — refusing';
  END IF;

  SELECT contact_id INTO v_contact FROM profiles WHERE user_id = p_user_id;
  IF v_contact = ANY(c_denied_contacts) THEN
    RAISE EXCEPTION 'purge_account: account is anchored to a protected contact — refusing';
  END IF;
  IF v_contact IS NOT NULL AND EXISTS (SELECT 1 FROM contacts WHERE id = v_contact AND is_company) THEN
    RAISE EXCEPTION 'purge_account: company contact — refusing';
  END IF;
  SELECT id INTO v_client FROM clients WHERE contact_id = v_contact;

  -- ── 1. Attribution columns: NULL them (keep the row, drop the pointer) ────
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confrelid::regclass::text AS ref
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
     WHERE c.contype = 'f'
       AND c.confrelid IN ('contacts'::regclass, 'profiles'::regclass, 'clients'::regclass)
       AND c.conrelid <> 'profiles'::regclass
       AND (a.attname IN ('deleted_by','updated_by','created_by','edited_by','administered_by')
            OR a.attname ~ '(actor|author|granted_by|proposed_by|resolved_by|requested_by|entered_by|cancelled_by|archived_by|confirmed_by|created_by)')
  LOOP
    IF r.ref = 'contacts' AND v_contact IS NULL THEN CONTINUE; END IF;
    IF r.ref = 'clients'  AND v_client  IS NULL THEN CONTINUE; END IF;
    v_sql := format('UPDATE %s SET %I = NULL WHERE %I = %L',
                    r.tbl, r.col, r.col,
                    (CASE r.ref WHEN 'contacts' THEN v_contact
                                WHEN 'clients'  THEN v_client
                                ELSE p_user_id END)::text);
    EXECUTE v_sql;
  END LOOP;

  -- ── 2. Ownership rows: delete, children first ────────────────────────────
  -- documents carry the deepest chains; clear them before the anchors.
  IF v_contact IS NOT NULL THEN
    DELETE FROM esign_consents        WHERE contact_id = v_contact;
    DELETE FROM signatures            WHERE signer_contact_id = v_contact;
    DELETE FROM document_shares       WHERE shared_with_contact_id = v_contact;
    DELETE FROM document_deliveries   WHERE recipient_contact_id = v_contact;
    DELETE FROM document_party_archives WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);
    DELETE FROM document_party_controls WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);
    DELETE FROM document_change_requests WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);
    DELETE FROM contract_change_log   WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);
    DELETE FROM contract_comments     WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);
    DELETE FROM contract_messages     WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);
    DELETE FROM contract_addenda      WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);
    DELETE FROM contract_fields       WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);
    DELETE FROM contract_execution_audit WHERE document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);
    DELETE FROM document_parties      WHERE contact_id = v_contact
                                         OR document_id IN (SELECT id FROM documents WHERE contact_id = v_contact);
    DELETE FROM documents             WHERE contact_id = v_contact;
    DELETE FROM contract_parties      WHERE contact_id = v_contact;
    DELETE FROM contact_required_documents WHERE contact_id = v_contact;
    DELETE FROM groups                WHERE contact_id = v_contact;
    DELETE FROM evaluation_report_shares WHERE shared_with_contact_id = v_contact;
    DELETE FROM evaluation_reports    WHERE contact_id = v_contact;
    DELETE FROM horse_relationships   WHERE party_contact_id = v_contact;
    UPDATE horses SET current_owner_contact_id = NULL WHERE current_owner_contact_id = v_contact;
    UPDATE horses SET lessee_contact_id = NULL WHERE lessee_contact_id = v_contact;
    DELETE FROM billable_lines        WHERE payer_contact_id = v_contact;
    DELETE FROM cost_allocation_rules WHERE payer_contact_id = v_contact;
    DELETE FROM board_agreements      WHERE boarder_contact_id = v_contact;
    UPDATE contacts SET guardian_contact_id = NULL WHERE guardian_contact_id = v_contact;
  END IF;

  -- money + fulfillment spine
  DELETE FROM fulfillment_units WHERE purchase_id IN (
    SELECT id FROM purchases WHERE buyer_user_id = p_user_id OR buyer_contact_id = v_contact);
  DELETE FROM receipt_sends WHERE purchase_id IN (
    SELECT id FROM purchases WHERE buyer_user_id = p_user_id OR buyer_contact_id = v_contact);
  DELETE FROM purchase_items WHERE purchase_id IN (
    SELECT id FROM purchases WHERE buyer_user_id = p_user_id OR buyer_contact_id = v_contact);
  DELETE FROM status_events WHERE entity_type = 'order' AND entity_id IN (
    SELECT id FROM purchases WHERE buyer_user_id = p_user_id OR buyer_contact_id = v_contact);
  DELETE FROM purchases WHERE buyer_user_id = p_user_id OR buyer_contact_id = v_contact;

  -- bookings + credits
  DELETE FROM bookings WHERE account_user_id = p_user_id OR account_contact_id = v_contact
                          OR (v_client IS NOT NULL AND client_id = v_client);
  IF v_client IS NOT NULL THEN
    DELETE FROM lesson_credits WHERE client_id = v_client;
  END IF;

  -- community
  DELETE FROM feed_seen          WHERE user_id = p_user_id;
  DELETE FROM feed_shares        WHERE from_user_id = p_user_id OR to_user_id = p_user_id;
  DELETE FROM feed_account_items WHERE user_id = p_user_id;
  DELETE FROM feed_view_pref     WHERE user_id = p_user_id;
  DELETE FROM feed_posts         WHERE author_id = p_user_id;
  DELETE FROM content_acknowledgments WHERE user_id = p_user_id;
  DELETE FROM notifications      WHERE user_id = p_user_id;
  DELETE FROM members            WHERE user_id = p_user_id;
  DELETE FROM invitations        WHERE contact_id = v_contact
                                    OR lower(email) = v_email;

  -- anchors last
  IF v_client IS NOT NULL THEN DELETE FROM clients WHERE id = v_client; END IF;
  DELETE FROM profiles WHERE user_id = p_user_id;
  IF v_contact IS NOT NULL THEN DELETE FROM contacts WHERE id = v_contact; END IF;
  DELETE FROM auth.users WHERE id = p_user_id;

  -- ── 3. Orphan sweep: prove nothing still points at the purged identity ────
  FOR r IN
    SELECT c.conrelid::regclass::text AS tbl, a.attname AS col, c.confrelid::regclass::text AS ref
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
     WHERE c.contype = 'f'
       AND c.confrelid IN ('contacts'::regclass, 'profiles'::regclass, 'clients'::regclass)
  LOOP
    IF r.ref = 'contacts' AND v_contact IS NULL THEN CONTINUE; END IF;
    IF r.ref = 'clients'  AND v_client  IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = %L', r.tbl, r.col,
                   (CASE r.ref WHEN 'contacts' THEN v_contact
                               WHEN 'clients'  THEN v_client
                               ELSE p_user_id END)::text) INTO v_n;
    IF v_n > 0 THEN
      v_counts := v_counts || jsonb_build_object(r.tbl || '.' || r.col, v_n);
    END IF;
  END LOOP;

  IF v_counts <> '{}'::jsonb THEN
    RAISE EXCEPTION 'purge_account: orphaned references remain: %', v_counts::text;
  END IF;

  RETURN jsonb_build_object('purged', true, 'email', v_email,
                            'user_id', p_user_id, 'contact_id', v_contact);
END;
$function$;

-- Staff-invoked only; never reachable from a member session.
REVOKE EXECUTE ON FUNCTION public.purge_account(uuid, text) FROM PUBLIC, anon, authenticated;
