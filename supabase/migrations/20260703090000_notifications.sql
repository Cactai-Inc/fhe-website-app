/*
  # FHE CRM — Notifications spine (BOOKING_FLOWS_PLAN §1 Messaging / §5 Lane-1.4)

  ADDITIVE ONLY — live production data. No new messaging build: flows are driven
  by this notifications table (dashboard cards + bell), community surfaces stay
  soft-hidden at launch.

  1. notifications table — per-user, org-scoped. RESTRICTIVE org boundary
     (org_id = current_org()) exactly like migration 26 (20260629190000);
     permissive access: the owner reads their own rows and may mark them read;
     staff (is_admin()) may INSERT directly. Producers are otherwise
     SECURITY DEFINER paths (record_signature v4 below, notify_user).
  2. RPCs (authenticated): my_notifications(p_limit) newest-first jsonb array,
     mark_notification_read(p_id) owner-only, my_unread_count().
  3. notify_user(...) — SECURITY DEFINER producer for staff / service_role /
     internal callers (same fence as provision_lesson_invitation). Stamps the
     org from the TARGET user's profile (profiles.org_id), falling back to
     current_org().
  4. record_signature v4 = v3 (20260703030000 — latest issue; 20260703050000
     did not re-issue it) + the first real producer: when a document flips
     EXECUTED, notify the signer's app user (profiles.contact_id = signer
     contact; skipped silently when the signer has no app account).
     kind: 'document_executed'.
*/

-- ============================================================
-- 1. notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  title      text NOT NULL,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_idx ON notifications (user_id, read_at);
CREATE INDEX IF NOT EXISTS notifications_org_idx ON notifications (org_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- tenant boundary (RESTRICTIVE — ANDs with the permissive policies below),
-- mirroring 20260629190000's org-boundary pattern.
DROP POLICY IF EXISTS notifications_org_boundary ON notifications;
CREATE POLICY notifications_org_boundary ON notifications AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- owner reads their own
DROP POLICY IF EXISTS notifications_owner_read ON notifications;
CREATE POLICY notifications_owner_read ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- owner may update their own rows (the sanctioned mutation is read_at, via
-- mark_notification_read; rows are the owner's own data and org-bounded).
DROP POLICY IF EXISTS notifications_owner_update ON notifications;
CREATE POLICY notifications_owner_update ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- staff produce notifications directly (SECURITY DEFINER paths bypass RLS)
DROP POLICY IF EXISTS notifications_staff_write ON notifications;
CREATE POLICY notifications_staff_write ON notifications FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- ============================================================
-- 2. member RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION my_notifications(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $fn$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'title', n.title, 'body', n.body,
      'link', n.link, 'read_at', n.read_at, 'created_at', n.created_at)
      ORDER BY n.created_at DESC, n.id DESC), '[]'::jsonb)
  FROM (
    SELECT * FROM notifications
    WHERE user_id = auth.uid()
    ORDER BY created_at DESC, id DESC
    LIMIT greatest(coalesce(p_limit, 20), 1)
  ) n
$fn$;

REVOKE ALL ON FUNCTION my_notifications(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION my_notifications(int) TO authenticated;

COMMENT ON FUNCTION my_notifications(int) IS
  'The signed-in user''s notifications, newest first (jsonb array; empty array when none).';

CREATE OR REPLACE FUNCTION mark_notification_read(p_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $fn$
  UPDATE notifications SET read_at = now()
    WHERE id = p_id AND user_id = auth.uid() AND read_at IS NULL
  RETURNING true
$fn$;

REVOKE ALL ON FUNCTION mark_notification_read(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION mark_notification_read(uuid) TO authenticated;

COMMENT ON FUNCTION mark_notification_read(uuid) IS
  'Mark one of the CALLER''s notifications read (owner-only; someone else''s id is a silent no-op returning NULL).';

CREATE OR REPLACE FUNCTION my_unread_count()
RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $fn$
  SELECT count(*)::int FROM notifications
  WHERE user_id = auth.uid() AND read_at IS NULL
$fn$;

REVOKE ALL ON FUNCTION my_unread_count() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_unread_count() TO authenticated;

COMMENT ON FUNCTION my_unread_count() IS
  'Unread-notification count for the signed-in user (the bell badge).';

-- ============================================================
-- 3. notify_user — staff/service_role/internal producer
-- ============================================================
CREATE OR REPLACE FUNCTION notify_user(
  p_user_id uuid,
  p_kind    text,
  p_title   text,
  p_body    text DEFAULT NULL,
  p_link    text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid;
  v_id  uuid;
BEGIN
  -- same fence as provision_lesson_invitation
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to send notifications';
  END IF;

  -- stamp the TARGET user's org (their profile), not the caller's; fall back
  -- to current_org() for profiles not yet org-joined.
  SELECT org_id INTO v_org FROM profiles WHERE user_id = p_user_id;
  v_org := coalesce(v_org, current_org());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'cannot resolve an organization for user %', p_user_id;
  END IF;

  INSERT INTO notifications (org_id, user_id, kind, title, body, link)
    VALUES (v_org, p_user_id, p_kind, p_title, p_body, p_link)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$fn$;

REVOKE ALL ON FUNCTION notify_user(uuid, text, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION notify_user(uuid, text, text, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION notify_user(uuid, text, text, text, text) IS
  'Create a notification for a user (staff/service_role only — same fence as provision_lesson_invitation). Org stamped from the target user''s profile, current_org() fallback.';

-- ============================================================
-- 4. record_signature v4 — v3 + document_executed notification
-- ============================================================
CREATE OR REPLACE FUNCTION record_signature(
  p_document_id uuid,
  p_party_role  text,
  p_typed_name  text,
  p_ip          text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_eng_id  uuid;
  v_doc_org uuid;
  v_signer  uuid;
  v_need    integer;
  v_have    integer;
  v_status  text;
  v_user    uuid;
  v_title   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT engagement_id, org_id INTO v_eng_id, v_doc_org
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  -- the contact who plays this party_role on the document's engagement
  SELECT contact_id INTO v_signer FROM engagement_parties
    WHERE engagement_id = v_eng_id AND party_role = p_party_role
    ORDER BY signer_order NULLS LAST LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no % party on this document''s engagement', p_party_role;
  END IF;

  -- AUTHORIZATION: tenant staff facilitate any party; anyone else must BE the
  -- party (their profile's contact is the party row's contact).
  IF NOT (
       (has_staff_access() AND v_doc_org = current_org())
    OR (current_contact_id() IS NOT NULL AND current_contact_id() = v_signer)
  ) THEN
    RAISE EXCEPTION 'not authorized to sign as % on document %', p_party_role, p_document_id;
  END IF;

  -- one sealed signature per (document, signer, role); ignore a duplicate sign
  -- v3: org stamped from the DOCUMENT (session GUC is wrong/NULL for fresh members)
  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, method)
    VALUES (v_doc_org, p_document_id, v_signer, p_party_role, p_typed_name, now(), p_ip, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

  -- v3: the executed record carries the signature, not the token — substitute
  -- {{SIG.<ROLE>.NAME/DATE}} in merged_body so emails/prints show the real signing
  -- (idempotent: tokens are gone after the first substitution).
  UPDATE documents SET merged_body =
      replace(replace(merged_body,
        '{{SIG.' || p_party_role || '.NAME}}', p_typed_name),
        '{{SIG.' || p_party_role || '.DATE}}', to_char(now(), 'FMMonth FMDD, YYYY'))
    WHERE id = p_document_id AND merged_body IS NOT NULL;

  -- executed once every signer party has signed
  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM engagement_parties WHERE engagement_id = v_eng_id;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = p_document_id AND signed_at IS NOT NULL AND deleted_at IS NULL;

  IF v_need > 0 AND v_have >= v_need THEN
    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date
      WHERE id = p_document_id AND status <> 'EXECUTED';

    -- v4: first notifications producer — the document just flipped EXECUTED;
    -- tell the signer's app user (skip silently when the signer has no account).
    IF FOUND THEN
      SELECT p.user_id INTO v_user FROM profiles p WHERE p.contact_id = v_signer;
      IF v_user IS NOT NULL THEN
        SELECT coalesce(d.title, 'Your document') INTO v_title
          FROM documents d WHERE d.id = p_document_id;
        INSERT INTO notifications (org_id, user_id, kind, title, link)
          VALUES (v_doc_org, v_user, 'document_executed', v_title || ' is signed', '/app/documents');
      END IF;
    END IF;
  END IF;

  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  RETURN v_status;
END;
$fn$;

COMMENT ON FUNCTION record_signature(uuid, text, text, text) IS
  'Seal a party''s typed signature (v3: substitutes SIG tokens into merged_body, stamps signatures.org_id from the document; v4: notifies the signer''s app user when the document flips EXECUTED). Caller must be tenant staff or the party''s own contact; flips the document EXECUTED once every signer party has signed.';
