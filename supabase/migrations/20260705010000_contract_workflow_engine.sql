/*
  # Generic multi-party contract workflow engine (20260705010000)

  ADDITIVE ONLY — live production data. Nothing is dropped; executed documents
  are never rewritten. This is the WIRED workflow layer that sits ON TOP of the
  existing document/signing machinery — it EXTENDS, it does not fork:

    - documents (DRAFT/AWAITING_SIGNATURE/EXECUTED/VOID; merged_body;
      execution_hash; org_id) + generate_document(engagement, template_key) v9
      remain the generation surface. This migration adds a FINER workflow_state
      layer (editable/editing/in_review/locked/executed/void) beside status.
    - record_signature v5 (20260703110000) remains THE sign/lock/execute/hash
      state machine. It is re-issued here as v6 = v5 + exactly one line: when it
      flips status=EXECUTED it now ALSO sets workflow_state='executed'. Nothing
      else about it changes. The engine NEVER reimplements signing.
    - create_lease_engagement / engagement_parties / notify_user /
      document_shares(new) / esign_consents are reused as-is.

  What was missing (the real gap, not schema): STRUCTURED, PARTY-OWNED FIELDS
  with an ownership-enforcing write path, change tracking, party-to-party shares,
  and a state machine — all as SECURITY DEFINER RPCs so the ownership logic is
  centralized and testable. No table gets a hollow definition: every one gets
  working RPCs, RLS, and PGlite coverage proving the flow end to end.

  Sections:
    1. documents.workflow_state / recipient_editing / originator_contact_id
       + record_signature v6 (v5 + workflow_state='executed' at the EXECUTED flip)
    2. contract_fields          (structured field store with owner_role)
    3. document_change_requests (numbered change tracking)
    4. document_shares          (party-to-party access grants)
    5. helpers + RPCs (seed/set field, share, editing toggle, change request,
       resolve, advance workflow, lock-and-sign bridge, read model)
    6. start_lease_contract     (the first WIRED instance — horse lease e2e)
*/

-- ============================================================
-- 0. Helper — is the caller a PARTY on this document's engagement?
--    caller_owns_document() only matches the engagement's CLIENT (client_id).
--    The contract flow is multi-party: the counterparty (e.g. the LESSOR on a
--    LEASE_IN) is a party via engagement_parties but is NOT the client. This
--    predicate matches ANY party whose contact is the caller's contact.
-- ============================================================
CREATE OR REPLACE FUNCTION caller_is_document_party(p_document_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM documents d
    JOIN engagement_parties ep ON ep.engagement_id = d.engagement_id
    WHERE d.id = p_document_id
      AND d.deleted_at IS NULL
      AND ep.contact_id = current_contact_id()
  );
$$;

COMMENT ON FUNCTION caller_is_document_party(uuid) IS
  'True when the caller''s contact plays ANY party_role on the document''s engagement (broader than caller_owns_document, which matches only the engagement client). Used by contract_fields / change-request / share RLS so a counterparty who is not "our" client can still read their own contract.';

-- The caller's party_role(s) on a document's engagement (may be several rows;
-- a contact could be, e.g., both CLIENT and GUARDIAN). Returns a set of text.
CREATE OR REPLACE FUNCTION caller_party_roles(p_document_id uuid)
RETURNS SETOF text LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT ep.party_role
  FROM documents d
  JOIN engagement_parties ep ON ep.engagement_id = d.engagement_id
  WHERE d.id = p_document_id
    AND d.deleted_at IS NULL
    AND current_contact_id() IS NOT NULL
    AND ep.contact_id = current_contact_id();
$$;

COMMENT ON FUNCTION caller_party_roles(uuid) IS
  'Every party_role the caller''s contact holds on the document''s engagement (a set — a contact may hold more than one). The ownership-enforcing RPCs test the owning role against this set.';

-- ============================================================
-- 1. documents — the finer workflow layer beside status
-- ============================================================
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS workflow_state text NOT NULL DEFAULT 'editable'
    CHECK (workflow_state IN ('editable','editing','in_review','locked','executed','void'));
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS recipient_editing boolean NOT NULL DEFAULT false;
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS originator_contact_id uuid REFERENCES contacts(id);

COMMENT ON COLUMN documents.workflow_state IS
  'Finer multi-party workflow layer beside status (DRAFT..EXECUTED). editable→editing→in_review→locked→executed, plus void. Executed is reached ONLY through record_signature (v6 sets it at the EXECUTED flip); advance_document_workflow rejects a manual →executed.';
COMMENT ON COLUMN documents.recipient_editing IS
  'Whether the NON-originating party may edit DEAL fields / body (vs only their own personal fields). Mirrored from the active document_shares row; toggled by set_recipient_editing / share_document.';
COMMENT ON COLUMN documents.originator_contact_id IS
  'The party who started this contract (always "us"/the initiating client — e.g. the LESSEE on a LEASE_IN). The originator always owns DEAL fields; the counterparty may touch them only when recipient_editing is true.';

-- Backfill workflow_state for any pre-existing documents so the layer is
-- coherent: an already-EXECUTED document is 'executed'; a VOID one 'void';
-- everything else keeps the 'editable' default. IF-guarded to a no-op on a
-- fresh DB where the only rows are seeds.
UPDATE documents SET workflow_state = 'executed'
  WHERE status = 'EXECUTED' AND workflow_state = 'editable';
UPDATE documents SET workflow_state = 'void'
  WHERE status = 'VOID' AND workflow_state = 'editable';

-- ------------------------------------------------------------
-- record_signature v6 = v5 (20260703110000) + ONE change: the EXECUTED flip
-- ALSO sets workflow_state='executed'. Byte-identical to v5 otherwise. The v5
-- body was read from 20260703110000 and only the final UPDATE documents ... SET
-- status='EXECUTED' clause was extended with workflow_state='executed'.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_signature(
  p_document_id   uuid,
  p_party_role    text,
  p_typed_name    text,
  p_ip            text    DEFAULT NULL,
  p_user_agent    text    DEFAULT NULL,
  p_esign_consent boolean DEFAULT false
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
  v_ip      text;
  v_ua      text;
  v_body    text;
  v_sig     record;
  v_hash    text;
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

  -- v5: session attribution — explicit parameters win; otherwise read the
  -- PostgREST request headers (guarded: NULL outside PostgREST).
  SELECT a.ip, a.user_agent INTO v_ip, v_ua FROM http_request_attribution() a;
  v_ip := coalesce(nullif(trim(coalesce(p_ip, '')), ''), v_ip);
  v_ua := coalesce(nullif(trim(coalesce(p_user_agent, '')), ''), v_ua);

  -- one sealed signature per (document, signer, role); ignore a duplicate sign
  -- v3: org stamped from the DOCUMENT (session GUC is wrong/NULL for fresh members)
  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_doc_org, p_document_id, v_signer, p_party_role, p_typed_name, now(), v_ip, v_ua, 'TYPED')
    ON CONFLICT (document_id, signer_contact_id, party_role) DO NOTHING;

  -- v5: the separately-logged consent to transact electronically. Optional
  -- here (staff-facilitated signings predate the checkbox; the in-app UI
  -- always sends true) — when given, it is recorded with the same attribution.
  IF coalesce(p_esign_consent, false) THEN
    INSERT INTO esign_consents (org_id, contact_id, document_id, ip_address, user_agent)
      VALUES (v_doc_org, v_signer, p_document_id, v_ip, v_ua);
  END IF;

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
    -- v5: tamper evidence — hash the FINAL text (post SIG-substitution) plus
    -- the sealing signature's STORED fields. Computed only at the flip; the
    -- status <> 'EXECUTED' guard below means an already-executed document's
    -- row (and hash) is never rewritten.
    SELECT merged_body INTO v_body FROM documents WHERE id = p_document_id;
    SELECT signer_contact_id, typed_name, signed_at INTO v_sig
      FROM signatures
      WHERE document_id = p_document_id AND signer_contact_id = v_signer
        AND party_role = p_party_role AND deleted_at IS NULL;
    IF FOUND THEN
      v_hash := compute_execution_hash(v_body, v_sig.signer_contact_id, v_sig.typed_name, v_sig.signed_at);
    END IF;

    -- v6: the workflow layer follows status at the EXECUTED flip — the ONLY
    -- change from v5. Everything else in this function is byte-identical.
    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date,
                         execution_hash = v_hash, workflow_state = 'executed'
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

COMMENT ON FUNCTION record_signature(uuid, text, text, text, text, boolean) IS
  'Seal a party''s typed signature (v6 = v5 20260703110000 + ONE line: the EXECUTED flip also sets documents.workflow_state=''executed''). Everything else preserved verbatim — attribution capture, esign_consents log, execution_hash, SIG-token substitution, the document_executed notification. Caller must be tenant staff or the party''s own contact; flips EXECUTED once every signer party has signed.';

-- ============================================================
-- 2. contract_fields — structured field store WITH PARTY OWNERSHIP
-- ============================================================
CREATE TABLE IF NOT EXISTS contract_fields (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  document_id           uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_key             text NOT NULL,
  label                 text,
  section               text,
  owner_role            text NOT NULL,   -- party_role that owns/must-fill this field, or 'DEAL'
  value                 text,
  value_type            text DEFAULT 'text'
    CHECK (value_type IN ('text','number','date','currency','checkbox','select','longtext')),
  entered_by_contact_id uuid REFERENCES contacts(id),
  entered_at            timestamptz,
  required              boolean DEFAULT false,
  sort_order            int DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, field_key)
);

CREATE INDEX IF NOT EXISTS contract_fields_document_idx ON contract_fields (document_id);
CREATE INDEX IF NOT EXISTS contract_fields_org_idx      ON contract_fields (org_id);

DROP TRIGGER IF EXISTS contract_fields_set_updated_at ON contract_fields;
CREATE TRIGGER contract_fields_set_updated_at BEFORE UPDATE ON contract_fields
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE contract_fields ENABLE ROW LEVEL SECURITY;

-- tenant boundary (RESTRICTIVE — ANDs with the permissive access policies)
DROP POLICY IF EXISTS contract_fields_org_boundary ON contract_fields;
CREATE POLICY contract_fields_org_boundary ON contract_fields AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- read: staff, or ANY party of the document's engagement (the counterparty too)
DROP POLICY IF EXISTS contract_fields_party_read ON contract_fields;
CREATE POLICY contract_fields_party_read ON contract_fields FOR SELECT TO authenticated
  USING (is_admin() OR caller_is_document_party(document_id));

-- NO direct INSERT/UPDATE/DELETE policy for authenticated: every write is the
-- ownership-enforcing set_contract_field() / seed_contract_fields() SECURITY
-- DEFINER path, so the ownership matrix lives in ONE place. Revoke the default
-- Supabase table DML grants so a raw client UPDATE cannot bypass it.
REVOKE INSERT, UPDATE, DELETE ON contract_fields FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE contract_fields IS
  'Structured, party-owned field store for a contract document. owner_role names the party_role that owns/must-fill the field (personal/horse fields → that party; DEAL fields → the originator, and the counterparty only when documents.recipient_editing). All writes go through set_contract_field()/seed_contract_fields() (SECURITY DEFINER) — no direct authenticated DML — so ownership enforcement is centralized.';

-- ============================================================
-- 3. document_change_requests — numbered change tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS document_change_requests (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                   uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  document_id              uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  requested_by_contact_id  uuid NOT NULL REFERENCES contacts(id),
  target_field_key         text,           -- may target a field...
  target_section           text,           -- ...or a free section
  annotation_number        int NOT NULL,   -- the numbered marker 1,2,3… per document
  current_value            text,
  requested_change         text NOT NULL,
  status                   text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','accepted','rejected','withdrawn')),
  resolved_by_contact_id   uuid REFERENCES contacts(id),
  resolved_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, annotation_number)
);

CREATE INDEX IF NOT EXISTS document_change_requests_document_idx ON document_change_requests (document_id);
CREATE INDEX IF NOT EXISTS document_change_requests_org_idx      ON document_change_requests (org_id);

ALTER TABLE document_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_change_requests_org_boundary ON document_change_requests;
CREATE POLICY document_change_requests_org_boundary ON document_change_requests AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

DROP POLICY IF EXISTS document_change_requests_party_read ON document_change_requests;
CREATE POLICY document_change_requests_party_read ON document_change_requests FOR SELECT TO authenticated
  USING (is_admin() OR caller_is_document_party(document_id));

-- writes only via request_document_change() / resolve_change_request()
REVOKE INSERT, UPDATE, DELETE ON document_change_requests FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE document_change_requests IS
  'Numbered change tracking on a contract. A party logs a change (auto-numbered per document via request_document_change); the originator/staff accepts (optionally applying a new DEAL value) or rejects via resolve_change_request. Parties of the engagement read; writes are SECURITY DEFINER only.';

-- ============================================================
-- 4. document_shares — party-to-party access grants
-- ============================================================
CREATE TABLE IF NOT EXISTS document_shares (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  document_id            uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  shared_with_contact_id uuid NOT NULL REFERENCES contacts(id),
  granted_by_contact_id  uuid REFERENCES contacts(id),
  recipient_editing      boolean NOT NULL DEFAULT false,
  notified_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, shared_with_contact_id)
);

CREATE INDEX IF NOT EXISTS document_shares_document_idx ON document_shares (document_id);
CREATE INDEX IF NOT EXISTS document_shares_org_idx      ON document_shares (org_id);

ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_shares_org_boundary ON document_shares;
CREATE POLICY document_shares_org_boundary ON document_shares AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

DROP POLICY IF EXISTS document_shares_party_read ON document_shares;
CREATE POLICY document_shares_party_read ON document_shares FOR SELECT TO authenticated
  USING (is_admin() OR caller_is_document_party(document_id));

-- writes only via share_document()
REVOKE INSERT, UPDATE, DELETE ON document_shares FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE document_shares IS
  'Party-to-party access grant on a contract, recording the editing permission. share_document() creates/updates it, mirrors recipient_editing onto documents, and notifies the recipient. Parties read; writes are SECURITY DEFINER only.';

-- ============================================================
-- 5. RPCs — the wired workflow surface (SECURITY DEFINER, org-stamped,
--    authenticated-only; anon is NOT granted — the contract flow is account-gated)
-- ============================================================

-- ---- 5.0 shared authorization helpers (used inside the RPCs) ---------------
-- Is the caller staff of the document's org, OR the document's originator?
CREATE OR REPLACE FUNCTION contract_caller_is_originator(p_document_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT current_contact_id() IS NOT NULL AND EXISTS (
    SELECT 1 FROM documents d
    WHERE d.id = p_document_id AND d.deleted_at IS NULL
      AND d.originator_contact_id = current_contact_id()
  );
$$;

-- Internal notification producer for the contract engine: a party (not just
-- staff) drives share/change/review notifications, so we cannot route through
-- notify_user (its fence requires service_role or has_staff_access — a
-- non-staff originator/counterparty would be rejected). Instead we insert
-- directly, the same sanctioned pattern record_signature uses for its
-- document_executed notification: this is a SECURITY DEFINER path, org-stamped
-- from the DOCUMENT (not the caller's session). No-op when the target contact
-- has no app account.
CREATE OR REPLACE FUNCTION contract_notify(
  p_document_id uuid,
  p_to_contact  uuid,
  p_kind        text,
  p_title       text,
  p_body        text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_org  uuid;
  v_user uuid;
BEGIN
  IF p_to_contact IS NULL THEN RETURN; END IF;
  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id;
  SELECT user_id INTO v_user FROM profiles WHERE contact_id = p_to_contact;
  IF v_user IS NOT NULL AND v_org IS NOT NULL THEN
    INSERT INTO notifications (org_id, user_id, kind, title, body, link)
      VALUES (v_org, v_user, p_kind, p_title, p_body,
              '/app/contracts/' || p_document_id::text);
  END IF;
END;
$fn$;

COMMENT ON FUNCTION contract_notify(uuid, uuid, text, text, text) IS
  'Internal contract-engine notification producer: inserts a notifications row (org stamped from the document) for the target contact''s app user, no-op when unaccounted. Used instead of notify_user because a non-staff party drives share/change/review notifications and notify_user''s fence would reject them — mirrors record_signature''s own direct-insert producer.';

-- ---- 5.1 seed_contract_fields ----------------------------------------------
-- staff/originator: bulk-insert (idempotent per document_id/field_key) the
-- field definitions for a generated document. p_fields is a jsonb array of
-- objects: {field_key, label, section, owner_role, value_type, required,
-- sort_order, value}. Existing fields (same field_key) are updated in place.
CREATE OR REPLACE FUNCTION seed_contract_fields(p_document_id uuid, p_fields jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org   uuid;
  v_state text;
  v_f     jsonb;
  v_n     integer := 0;
  v_by    uuid := current_contact_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state INTO v_org, v_state
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF NOT (
       (has_staff_access() AND v_org = current_org())
    OR contract_caller_is_originator(p_document_id)
  ) THEN
    RAISE EXCEPTION 'not authorized to seed fields on document %', p_document_id;
  END IF;

  IF jsonb_typeof(p_fields) <> 'array' THEN
    RAISE EXCEPTION 'p_fields must be a jsonb array of field definitions';
  END IF;

  FOR v_f IN SELECT * FROM jsonb_array_elements(p_fields) LOOP
    IF coalesce(v_f ->> 'field_key', '') = '' THEN
      RAISE EXCEPTION 'each field needs a field_key';
    END IF;
    IF coalesce(v_f ->> 'owner_role', '') = '' THEN
      RAISE EXCEPTION 'field % needs an owner_role', v_f ->> 'field_key';
    END IF;

    INSERT INTO contract_fields (
      org_id, document_id, field_key, label, section, owner_role,
      value, value_type, required, sort_order,
      entered_by_contact_id, entered_at)
    VALUES (
      v_org, p_document_id,
      v_f ->> 'field_key',
      v_f ->> 'label',
      v_f ->> 'section',
      v_f ->> 'owner_role',
      v_f ->> 'value',
      coalesce(nullif(v_f ->> 'value_type', ''), 'text'),
      coalesce((v_f ->> 'required')::boolean, false),
      coalesce((v_f ->> 'sort_order')::int, 0),
      CASE WHEN nullif(v_f ->> 'value', '') IS NOT NULL THEN v_by END,
      CASE WHEN nullif(v_f ->> 'value', '') IS NOT NULL THEN now() END)
    ON CONFLICT (document_id, field_key) DO UPDATE SET
      label      = excluded.label,
      section    = excluded.section,
      owner_role = excluded.owner_role,
      value_type = excluded.value_type,
      required   = excluded.required,
      sort_order = excluded.sort_order,
      -- keep an already-entered value unless the seed provides a new one
      value                 = coalesce(nullif(excluded.value, ''), contract_fields.value),
      entered_by_contact_id = CASE WHEN nullif(excluded.value, '') IS NOT NULL
                                   THEN v_by ELSE contract_fields.entered_by_contact_id END,
      entered_at            = CASE WHEN nullif(excluded.value, '') IS NOT NULL
                                   THEN now() ELSE contract_fields.entered_at END;
    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$fn$;

REVOKE ALL ON FUNCTION seed_contract_fields(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION seed_contract_fields(uuid, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION seed_contract_fields(uuid, jsonb) IS
  'Staff/originator: bulk-insert a generated document''s structured, party-owned field DEFINITIONS from a jsonb array (field_key, label, section, owner_role, value_type, required, sort_order, value). Idempotent per (document_id, field_key). Returns the number of fields processed.';

-- ---- 5.2 set_contract_field — THE ownership-enforcing write ----------------
CREATE OR REPLACE FUNCTION set_contract_field(
  p_document_id uuid,
  p_field_key   text,
  p_value       text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org        uuid;
  v_state      text;
  v_recip_edit boolean;
  v_owner_role text;
  v_is_staff   boolean;
  v_is_orig    boolean;
  v_owns_role  boolean;
  v_row        contract_fields%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, workflow_state, recipient_editing
    INTO v_org, v_state, v_recip_edit
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  SELECT owner_role INTO v_owner_role
    FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no field % on document %', p_field_key, p_document_id;
  END IF;

  -- lock guard FIRST (a clear message regardless of ownership)
  IF v_state NOT IN ('editable','editing') THEN
    RAISE EXCEPTION 'document is locked (workflow_state=%): fields are read-only', v_state;
  END IF;

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := contract_caller_is_originator(p_document_id);
  v_owns_role := EXISTS (SELECT 1 FROM caller_party_roles(p_document_id) r WHERE r = v_owner_role);

  -- OWNERSHIP MATRIX:
  --   staff                                    → any field
  --   owner_role = 'DEAL'                       → originator always; counterparty only if recipient_editing
  --   owner_role = a party_role (personal/horse)→ ONLY the party holding that role
  IF NOT (
       v_is_staff
    OR (v_owner_role = 'DEAL' AND (v_is_orig OR v_recip_edit))
    OR (v_owner_role <> 'DEAL' AND v_owns_role)
  ) THEN
    RAISE EXCEPTION 'not authorized to edit this field (owner_role=%)', v_owner_role;
  END IF;

  UPDATE contract_fields
     SET value = p_value,
         entered_by_contact_id = current_contact_id(),
         entered_at = now()
   WHERE document_id = p_document_id AND field_key = p_field_key
   RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'id', v_row.id, 'document_id', v_row.document_id, 'field_key', v_row.field_key,
    'owner_role', v_row.owner_role, 'value', v_row.value, 'value_type', v_row.value_type,
    'entered_by_contact_id', v_row.entered_by_contact_id, 'entered_at', v_row.entered_at);
END;
$fn$;

REVOKE ALL ON FUNCTION set_contract_field(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_contract_field(uuid, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION set_contract_field(uuid, text, text) IS
  'THE ownership-enforcing field write. Allowed only when the document is editable/editing AND the caller is (a) staff, or (b) for a personal/horse field, the party whose party_role = the field''s owner_role, or (c) for a DEAL field, the originator always / the counterparty only when documents.recipient_editing. Nobody edits another party''s personal fields. Stamps entered_by/entered_at; returns the updated field as jsonb.';

-- ---- 5.3 share_document -----------------------------------------------------
CREATE OR REPLACE FUNCTION share_document(
  p_document_id      uuid,
  p_with_contact_id  uuid,
  p_recipient_editing boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org     uuid;
  v_title   text;
  v_by      uuid := current_contact_id();
  v_share   document_shares%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, coalesce(title, 'A contract') INTO v_org, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF NOT (
       (has_staff_access() AND v_org = current_org())
    OR contract_caller_is_originator(p_document_id)
  ) THEN
    RAISE EXCEPTION 'not authorized to share document %', p_document_id;
  END IF;

  PERFORM 1 FROM contacts WHERE id = p_with_contact_id AND org_id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown contact % in this organization', p_with_contact_id;
  END IF;

  INSERT INTO document_shares (org_id, document_id, shared_with_contact_id,
                              granted_by_contact_id, recipient_editing, notified_at)
    VALUES (v_org, p_document_id, p_with_contact_id, v_by,
            coalesce(p_recipient_editing, false), now())
  ON CONFLICT (document_id, shared_with_contact_id) DO UPDATE SET
    recipient_editing = excluded.recipient_editing,
    granted_by_contact_id = excluded.granted_by_contact_id,
    notified_at = now()
  RETURNING * INTO v_share;

  -- mirror recipient_editing onto the document for the active share
  UPDATE documents SET recipient_editing = coalesce(p_recipient_editing, false)
    WHERE id = p_document_id;

  -- notify the recipient's app user (skip silently when they have no account)
  PERFORM contract_notify(p_document_id, p_with_contact_id, 'contract_shared',
    v_title || ' was shared with you',
    'You have been granted access to review this contract.');

  RETURN jsonb_build_object(
    'id', v_share.id, 'document_id', v_share.document_id,
    'shared_with_contact_id', v_share.shared_with_contact_id,
    'recipient_editing', v_share.recipient_editing, 'notified_at', v_share.notified_at);
END;
$fn$;

REVOKE ALL ON FUNCTION share_document(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION share_document(uuid, uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION share_document(uuid, uuid, boolean) IS
  'Originator/staff: create/update a document_shares grant, mirror recipient_editing onto the document, and notify the recipient (kind ''contract_shared''). Returns the share as jsonb.';

-- ---- 5.4 set_recipient_editing ---------------------------------------------
CREATE OR REPLACE FUNCTION set_recipient_editing(p_document_id uuid, p_on boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id INTO v_org FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF NOT (
       (has_staff_access() AND v_org = current_org())
    OR contract_caller_is_originator(p_document_id)
  ) THEN
    RAISE EXCEPTION 'not authorized to change editing permission on document %', p_document_id;
  END IF;

  UPDATE documents SET recipient_editing = coalesce(p_on, false) WHERE id = p_document_id;
  -- keep the active share row in step, if one exists
  UPDATE document_shares SET recipient_editing = coalesce(p_on, false)
    WHERE document_id = p_document_id;
  RETURN coalesce(p_on, false);
END;
$fn$;

REVOKE ALL ON FUNCTION set_recipient_editing(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION set_recipient_editing(uuid, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION set_recipient_editing(uuid, boolean) IS
  'Originator/staff toggles documents.recipient_editing (whether the counterparty may edit DEAL fields/body). Keeps the active document_shares row in step.';

-- ---- 5.5 request_document_change -------------------------------------------
CREATE OR REPLACE FUNCTION request_document_change(
  p_document_id     uuid,
  p_field_key       text,
  p_target_section  text,
  p_requested_change text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org      uuid;
  v_by       uuid := current_contact_id();
  v_next     int;
  v_current  text;
  v_orig     uuid;
  v_title    text;
  v_row      document_change_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, originator_contact_id, coalesce(title, 'A contract')
    INTO v_org, v_orig, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  -- any party of the engagement (or staff) may log a change request
  IF NOT (
       (has_staff_access() AND v_org = current_org())
    OR caller_is_document_party(p_document_id)
  ) THEN
    RAISE EXCEPTION 'not authorized to request changes on document %', p_document_id;
  END IF;

  IF coalesce(trim(p_requested_change), '') = '' THEN
    RAISE EXCEPTION 'a requested change is required';
  END IF;

  -- next annotation number for this document (1-based, sequential)
  SELECT coalesce(max(annotation_number), 0) + 1 INTO v_next
    FROM document_change_requests WHERE document_id = p_document_id;

  -- snapshot the current field value if the request targets a field
  IF nullif(p_field_key, '') IS NOT NULL THEN
    SELECT value INTO v_current
      FROM contract_fields WHERE document_id = p_document_id AND field_key = p_field_key;
  END IF;

  INSERT INTO document_change_requests (
    org_id, document_id, requested_by_contact_id, target_field_key,
    target_section, annotation_number, current_value, requested_change, status)
  VALUES (
    v_org, p_document_id, v_by, nullif(p_field_key, ''),
    nullif(p_target_section, ''), v_next, v_current, trim(p_requested_change), 'open')
  RETURNING * INTO v_row;

  -- notify the originator's app user (skip silently when unaccounted)
  PERFORM contract_notify(p_document_id, v_orig, 'contract_change_requested',
    'Change requested on ' || v_title,
    'Change #' || v_row.annotation_number || ': ' || v_row.requested_change);

  RETURN jsonb_build_object(
    'id', v_row.id, 'document_id', v_row.document_id,
    'annotation_number', v_row.annotation_number,
    'target_field_key', v_row.target_field_key, 'target_section', v_row.target_section,
    'current_value', v_row.current_value, 'requested_change', v_row.requested_change,
    'status', v_row.status);
END;
$fn$;

REVOKE ALL ON FUNCTION request_document_change(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION request_document_change(uuid, text, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION request_document_change(uuid, text, text, text) IS
  'A party (or staff) logs a change request against a field or a free section; auto-assigns the next per-document annotation_number and snapshots the current field value; notifies the originator (kind ''contract_change_requested''). Returns the request as jsonb.';

-- ---- 5.6 resolve_change_request --------------------------------------------
CREATE OR REPLACE FUNCTION resolve_change_request(
  p_change_id uuid,
  p_accept    boolean,
  p_new_value text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_cr        document_change_requests%ROWTYPE;
  v_org       uuid;
  v_state     text;
  v_owner     text;
  v_by        uuid := current_contact_id();
  v_title     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT * INTO v_cr FROM document_change_requests WHERE id = p_change_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown change request: %', p_change_id;
  END IF;

  SELECT org_id, workflow_state, coalesce(title, 'A contract')
    INTO v_org, v_state, v_title
    FROM documents WHERE id = v_cr.document_id AND deleted_at IS NULL;

  -- only the originator or staff resolves change requests
  IF NOT (
       (has_staff_access() AND v_org = current_org())
    OR contract_caller_is_originator(v_cr.document_id)
  ) THEN
    RAISE EXCEPTION 'not authorized to resolve changes on document %', v_cr.document_id;
  END IF;

  IF v_cr.status <> 'open' THEN
    RAISE EXCEPTION 'change request % is already %', p_change_id, v_cr.status;
  END IF;

  IF coalesce(p_accept, false) THEN
    -- apply p_new_value to the targeted field, if any (originator owns DEAL;
    -- personal/horse fields require the document be editable/editing and that
    -- the owning party's authority is respected — but the originator applying a
    -- field value here is a staff-of-the-deal action, so we write directly for
    -- DEAL fields and, for personal fields, only when the caller may edit them.
    IF nullif(p_new_value, '') IS NOT NULL AND nullif(v_cr.target_field_key, '') IS NOT NULL THEN
      IF v_state NOT IN ('editable','editing') THEN
        RAISE EXCEPTION 'document is locked (workflow_state=%): cannot apply the change', v_state;
      END IF;
      SELECT owner_role INTO v_owner FROM contract_fields
        WHERE document_id = v_cr.document_id AND field_key = v_cr.target_field_key;
      IF v_owner IS NULL THEN
        RAISE EXCEPTION 'targeted field % no longer exists', v_cr.target_field_key;
      END IF;
      -- originator/staff may set DEAL fields directly; a personal/horse field
      -- is only applied when the resolver is staff (staff facilitate any field).
      IF v_owner = 'DEAL' OR (has_staff_access() AND v_org = current_org()) THEN
        UPDATE contract_fields
           SET value = p_new_value, entered_by_contact_id = v_by, entered_at = now()
         WHERE document_id = v_cr.document_id AND field_key = v_cr.target_field_key;
      ELSE
        RAISE EXCEPTION 'cannot apply a value to a % field via a change request (owner must edit it)', v_owner;
      END IF;
    END IF;

    UPDATE document_change_requests
       SET status = 'accepted', resolved_by_contact_id = v_by, resolved_at = now()
     WHERE id = p_change_id RETURNING * INTO v_cr;
  ELSE
    UPDATE document_change_requests
       SET status = 'rejected', resolved_by_contact_id = v_by, resolved_at = now()
     WHERE id = p_change_id RETURNING * INTO v_cr;
  END IF;

  -- notify the requester
  PERFORM contract_notify(v_cr.document_id, v_cr.requested_by_contact_id,
    'contract_change_resolved',
    'Change #' || v_cr.annotation_number || ' on ' || v_title || ' was ' || v_cr.status);

  RETURN jsonb_build_object(
    'id', v_cr.id, 'document_id', v_cr.document_id,
    'annotation_number', v_cr.annotation_number, 'status', v_cr.status,
    'resolved_by_contact_id', v_cr.resolved_by_contact_id, 'resolved_at', v_cr.resolved_at);
END;
$fn$;

REVOKE ALL ON FUNCTION resolve_change_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION resolve_change_request(uuid, boolean, text) TO authenticated, service_role;

COMMENT ON FUNCTION resolve_change_request(uuid, boolean, text) IS
  'Originator/staff accepts (optionally applying p_new_value to the targeted field — DEAL fields via the originator, personal/horse fields only via staff) or rejects a change request; stamps status/resolved_*; notifies the requester. Returns the resolved request as jsonb.';

-- ---- 5.7 advance_document_workflow -----------------------------------------
CREATE OR REPLACE FUNCTION advance_document_workflow(p_document_id uuid, p_to text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_org       uuid;
  v_eng       uuid;
  v_from      text;
  v_recip     boolean;
  v_is_staff  boolean;
  v_is_orig   boolean;
  v_is_party  boolean;
  v_open      int;
  v_missing   int;
  v_title     text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, engagement_id, workflow_state, recipient_editing, coalesce(title, 'A contract')
    INTO v_org, v_eng, v_from, v_recip, v_title
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  IF p_to = 'executed' THEN
    RAISE EXCEPTION 'workflow_state ''executed'' is reached only by signing (record_signature), not manually';
  END IF;
  IF p_to NOT IN ('editable','editing','in_review','locked','void') THEN
    RAISE EXCEPTION 'unknown target workflow_state: %', p_to;
  END IF;

  v_is_staff := has_staff_access() AND v_org = current_org();
  v_is_orig  := contract_caller_is_originator(p_document_id);
  v_is_party := caller_is_document_party(p_document_id);

  IF NOT (v_is_staff OR v_is_party) THEN
    RAISE EXCEPTION 'not authorized to advance document %', p_document_id;
  END IF;

  -- already there → no-op (idempotent)
  IF v_from = p_to THEN
    RETURN v_from;
  END IF;

  -- illegal source: an executed/void document is terminal (void only via staff)
  IF v_from = 'executed' THEN
    RAISE EXCEPTION 'document is executed and cannot change workflow_state';
  END IF;

  -- TRANSITION GUARDS
  IF p_to = 'void' THEN
    IF NOT v_is_staff THEN
      RAISE EXCEPTION 'only staff may void a document';
    END IF;
    -- any→void allowed for staff

  ELSIF p_to = 'editing' THEN
    IF v_from NOT IN ('editable') THEN
      RAISE EXCEPTION 'illegal transition %→editing', v_from;
    END IF;
    -- a non-originating party opening editing requires recipient_editing
    IF NOT v_is_staff AND NOT v_is_orig AND NOT v_recip THEN
      RAISE EXCEPTION 'the counterparty may open editing only when recipient editing is enabled';
    END IF;

  ELSIF p_to = 'editable' THEN
    IF v_from NOT IN ('editing','in_review') THEN
      RAISE EXCEPTION 'illegal transition %→editable', v_from;
    END IF;

  ELSIF p_to = 'in_review' THEN
    IF v_from NOT IN ('editable','editing') THEN
      RAISE EXCEPTION 'illegal transition %→in_review', v_from;
    END IF;

  ELSIF p_to = 'locked' THEN
    IF v_from NOT IN ('in_review','editable','editing') THEN
      RAISE EXCEPTION 'illegal transition %→locked', v_from;
    END IF;
    -- ready-to-sign guards: no OPEN change requests, all REQUIRED fields filled
    SELECT count(*) INTO v_open FROM document_change_requests
      WHERE document_id = p_document_id AND status = 'open';
    IF v_open > 0 THEN
      RAISE EXCEPTION 'cannot lock: % open change request(s) remain', v_open;
    END IF;
    SELECT count(*) INTO v_missing FROM contract_fields
      WHERE document_id = p_document_id AND required
        AND nullif(trim(coalesce(value, '')), '') IS NULL;
    IF v_missing > 0 THEN
      RAISE EXCEPTION 'cannot lock: % required field(s) still empty', v_missing;
    END IF;
  END IF;

  UPDATE documents SET workflow_state = p_to WHERE id = p_document_id;

  -- notify the counterparty when the document is handed off for review or is
  -- locked ready to sign (best-effort; parties without accounts are skipped).
  -- Direct insert (org from the document) — the same producer pattern as
  -- record_signature; a non-staff party may drive this transition.
  IF p_to IN ('in_review','locked') THEN
    INSERT INTO notifications (org_id, user_id, kind, title, link)
      SELECT DISTINCT v_org, pr.user_id,
        CASE p_to WHEN 'in_review' THEN 'contract_in_review' ELSE 'contract_locked' END,
        v_title || (CASE p_to WHEN 'in_review' THEN ' is ready for your review'
                              ELSE ' is ready to sign' END),
        '/app/contracts/' || p_document_id::text
      FROM engagement_parties ep
      JOIN profiles pr ON pr.contact_id = ep.contact_id
      WHERE ep.engagement_id = v_eng
        AND pr.user_id IS NOT NULL
        AND pr.user_id <> auth.uid();
  END IF;

  RETURN p_to;
END;
$fn$;

REVOKE ALL ON FUNCTION advance_document_workflow(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION advance_document_workflow(uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION advance_document_workflow(uuid, text) IS
  'The workflow state machine: editable→editing (a party opens editing; counterparty needs recipient_editing), editing/in_review→editable, editable/editing→in_review, in_review/editable/editing→locked (guarded: no open change requests, all required fields filled), any→void (staff only). Rejects illegal transitions and any manual →executed (that is record_signature''s job). Notifies the counterparty on in_review/locked.';

-- ---- 5.8 lock_and_sign_contract — bridge to the reused signing engine -------
CREATE OR REPLACE FUNCTION lock_and_sign_contract(
  p_document_id   uuid,
  p_party_role    text,
  p_typed_name    text,
  p_esign_consent boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_state text;
  v_open  int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT workflow_state INTO v_state
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  -- Owner's "last to approve signs first" rule: allow signing when the document
  -- is locked (ready), or when it is still editable with NO open change
  -- requests (a clean, uncontested contract may be signed straight through).
  IF v_state NOT IN ('locked','editable','executed') THEN
    RAISE EXCEPTION 'document is not ready to sign (workflow_state=%); lock it first', v_state;
  END IF;
  IF v_state IN ('editable') THEN
    SELECT count(*) INTO v_open FROM document_change_requests
      WHERE document_id = p_document_id AND status = 'open';
    IF v_open > 0 THEN
      RAISE EXCEPTION 'cannot sign: % open change request(s) remain; resolve or lock first', v_open;
    END IF;
  END IF;

  -- Delegate to the REUSED signing engine: record_signature v6 seals the
  -- signature, computes the execution_hash, flips status=EXECUTED and
  -- workflow_state='executed' once every signer party has signed, and notifies.
  RETURN record_signature(p_document_id, p_party_role, p_typed_name, NULL, NULL,
                          coalesce(p_esign_consent, false));
END;
$fn$;

REVOKE ALL ON FUNCTION lock_and_sign_contract(uuid, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION lock_and_sign_contract(uuid, text, text, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION lock_and_sign_contract(uuid, text, text, boolean) IS
  'Thin bridge to the reused signing engine: asserts the document is ready to sign (workflow_state locked, or editable with no open change requests — the owner''s "last to approve signs first" rule) then delegates to record_signature v6, which seals/hashes/EXECUTED-flips (and sets workflow_state=''executed'') once all signer parties have signed. Never reimplements signing.';

-- ---- 5.9 read model — my_contract_documents / contract_document_detail ------
CREATE OR REPLACE FUNCTION my_contract_documents()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $fn$
DECLARE
  v_me uuid := current_contact_id();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF v_me IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.generated_at DESC)
    FROM (
      SELECT DISTINCT
        d.id AS document_id, d.title, d.status, d.workflow_state,
        d.recipient_editing, d.execution_hash, d.generated_at,
        (d.originator_contact_id = v_me) AS is_originator,
        (SELECT string_agg(ep.party_role, ',' ORDER BY ep.party_role)
           FROM engagement_parties ep
           WHERE ep.engagement_id = d.engagement_id AND ep.contact_id = v_me) AS my_roles,
        (SELECT count(*) FROM document_change_requests cr
           WHERE cr.document_id = d.id AND cr.status = 'open') AS open_change_requests
      FROM documents d
      JOIN engagement_parties ep2 ON ep2.engagement_id = d.engagement_id
      WHERE d.deleted_at IS NULL
        AND ep2.contact_id = v_me
        AND EXISTS (SELECT 1 FROM contract_fields cf WHERE cf.document_id = d.id)
    ) t
  ), '[]'::jsonb);
END;
$fn$;

REVOKE ALL ON FUNCTION my_contract_documents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION my_contract_documents() TO authenticated, service_role;

COMMENT ON FUNCTION my_contract_documents() IS
  'The caller''s contract documents (those carrying structured contract_fields where they are a party): document_id, title, status, workflow_state, recipient_editing, execution_hash, is_originator, my_roles (csv), open_change_requests. jsonb array, newest first. The list read model a UI binds to.';

CREATE OR REPLACE FUNCTION contract_document_detail(p_document_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $fn$
DECLARE
  v_me    uuid := current_contact_id();
  v_org   uuid;
  v_recip boolean;
  v_state text;
  v_orig  uuid;
  v_staff boolean;
  v_roles text[];
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  SELECT org_id, recipient_editing, workflow_state, originator_contact_id
    INTO v_org, v_recip, v_state, v_orig
    FROM documents WHERE id = p_document_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown document: %', p_document_id;
  END IF;

  v_staff := has_staff_access() AND v_org = current_org();
  IF NOT (v_staff OR caller_is_document_party(p_document_id)) THEN
    RAISE EXCEPTION 'not authorized to read document %', p_document_id;
  END IF;

  SELECT array_agg(r) INTO v_roles FROM caller_party_roles(p_document_id) r;
  v_roles := coalesce(v_roles, ARRAY[]::text[]);

  SELECT jsonb_build_object(
    'document', (SELECT jsonb_build_object(
        'document_id', d.id, 'title', d.title, 'status', d.status,
        'workflow_state', d.workflow_state, 'recipient_editing', d.recipient_editing,
        'execution_hash', d.execution_hash, 'merged_body', d.merged_body,
        'is_originator', (d.originator_contact_id = v_me))
      FROM documents d WHERE d.id = p_document_id),
    'my_roles', to_jsonb(v_roles),
    'fields', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'field_key', cf.field_key, 'label', cf.label, 'section', cf.section,
          'owner_role', cf.owner_role, 'value', cf.value, 'value_type', cf.value_type,
          'required', cf.required, 'sort_order', cf.sort_order,
          -- can the CALLER write this field right now? (mirrors set_contract_field)
          'can_edit', (
            v_staff
            OR (cf.owner_role = 'DEAL' AND ((v_orig = v_me) OR v_recip))
            OR (cf.owner_role <> 'DEAL' AND cf.owner_role = ANY(v_roles))
          ) AND v_state IN ('editable','editing'))
        ORDER BY cf.sort_order, cf.field_key)
      FROM contract_fields cf WHERE cf.document_id = p_document_id), '[]'::jsonb),
    'open_change_requests', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'id', cr.id, 'annotation_number', cr.annotation_number,
          'target_field_key', cr.target_field_key, 'target_section', cr.target_section,
          'current_value', cr.current_value, 'requested_change', cr.requested_change,
          'status', cr.status)
        ORDER BY cr.annotation_number)
      FROM document_change_requests cr
      WHERE cr.document_id = p_document_id AND cr.status = 'open'), '[]'::jsonb),
    'shares', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'shared_with_contact_id', s.shared_with_contact_id,
          'recipient_editing', s.recipient_editing, 'notified_at', s.notified_at))
      FROM document_shares s WHERE s.document_id = p_document_id), '[]'::jsonb),
    'signatures', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
          'party_role', sg.party_role, 'typed_name', sg.typed_name,
          'signed_at', sg.signed_at)
        ORDER BY sg.party_role)
      FROM signatures sg WHERE sg.document_id = p_document_id AND sg.deleted_at IS NULL), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$fn$;

REVOKE ALL ON FUNCTION contract_document_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION contract_document_detail(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION contract_document_detail(uuid) IS
  'Full read model for one contract the caller is a party to (or staff): the document (status, workflow_state, recipient_editing, execution_hash, merged_body), the caller''s roles, every field with a can_edit flag mirroring set_contract_field''s ownership rule, open change requests, shares, and signature status. jsonb — the detail read model a UI binds to.';

-- ============================================================
-- 6. start_lease_contract — the FIRST WIRED INSTANCE (horse lease e2e)
-- ============================================================
-- Calls create_lease_engagement (LESSEE + LESSOR two-party lease + COMPANY
-- signer when the tenant has a signatory), generate_document('HORSE_LEASE'),
-- seeds the lease's real, correctly-OWNED field set (LESSEE personal→LESSEE;
-- LESSOR personal + all HORSE.*→LESSOR; all TXN/deal terms→'DEAL'), sets the
-- originator (the lessee — "us"/the initiating client) and workflow_state.
CREATE OR REPLACE FUNCTION start_lease_contract(
  p_lessee_contact_id uuid,
  p_lessor_contact_id uuid DEFAULT NULL,
  p_horse_id          uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_eng  uuid;
  v_doc  uuid;
  v_org  uuid;
  v_n    integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  IF NOT (has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to start a lease contract';
  END IF;

  -- REUSE create_lease_engagement (LEASE_IN: our client is the LESSEE): builds
  -- the LESSEE + LESSOR parties (+ COMPANY signer if configured) + transaction.
  v_eng := create_lease_engagement(p_lessee_contact_id, 'LEASE_IN', p_horse_id, p_lessor_contact_id);

  -- REUSE generate_document('HORSE_LEASE'): per-party namespace→role→contact
  -- resolution fills LESSEE.*/LESSOR.*/HORSE.*/TXN.*; leaves {{SIG.*}}.
  SELECT gd.document_id INTO v_doc FROM generate_document(v_eng, 'HORSE_LEASE') gd;

  SELECT org_id INTO v_org FROM documents WHERE id = v_doc;

  -- originator = the lessee ("us"); this contract is workflow-editable.
  UPDATE documents
     SET originator_contact_id = p_lessee_contact_id,
         workflow_state = 'editable',
         status = 'AWAITING_SIGNATURE'
   WHERE id = v_doc;

  -- Seed the lease's structured, party-OWNED fields (HORSE_LEASE.md tokens).
  --   LESSEE personal → LESSEE   |  LESSOR personal + all HORSE.* → LESSOR
  --   all TXN / deal terms       → 'DEAL' (originator sets; counterparty may
  --                                 negotiate only when recipient_editing)
  v_n := seed_contract_fields(v_doc, jsonb_build_array(
    -- ── LESSEE personal (owned by the LESSEE) ──
    jsonb_build_object('field_key','LESSEE.FULL_NAME','label','Lessee Name','section','Lessee','owner_role','LESSEE','value_type','text','required',true,'sort_order',10),
    jsonb_build_object('field_key','LESSEE.ADDRESS','label','Lessee Address','section','Lessee','owner_role','LESSEE','value_type','text','sort_order',11),
    jsonb_build_object('field_key','LESSEE.PHONE','label','Lessee Phone','section','Lessee','owner_role','LESSEE','value_type','text','sort_order',12),
    jsonb_build_object('field_key','LESSEE.EMAIL','label','Lessee Email','section','Lessee','owner_role','LESSEE','value_type','text','sort_order',13),
    -- ── LESSOR personal (owned by the LESSOR) ──
    jsonb_build_object('field_key','LESSOR.FULL_NAME','label','Lessor Name','section','Lessor','owner_role','LESSOR','value_type','text','required',true,'sort_order',20),
    jsonb_build_object('field_key','LESSOR.ADDRESS','label','Lessor Address','section','Lessor','owner_role','LESSOR','value_type','text','sort_order',21),
    jsonb_build_object('field_key','LESSOR.PHONE','label','Lessor Phone','section','Lessor','owner_role','LESSOR','value_type','text','sort_order',22),
    jsonb_build_object('field_key','LESSOR.EMAIL','label','Lessor Email','section','Lessor','owner_role','LESSOR','value_type','text','sort_order',23),
    -- ── HORSE.* (owned by the LESSOR — the horse owner) ──
    jsonb_build_object('field_key','HORSE.REGISTERED_NAME','label','Registered Name','section','Horse','owner_role','LESSOR','value_type','text','required',true,'sort_order',30),
    jsonb_build_object('field_key','HORSE.BARN_NAME','label','Barn Name','section','Horse','owner_role','LESSOR','value_type','text','sort_order',31),
    jsonb_build_object('field_key','HORSE.BREED','label','Breed','section','Horse','owner_role','LESSOR','value_type','text','sort_order',32),
    jsonb_build_object('field_key','HORSE.COLOR','label','Color','section','Horse','owner_role','LESSOR','value_type','text','sort_order',33),
    jsonb_build_object('field_key','HORSE.SEX','label','Sex','section','Horse','owner_role','LESSOR','value_type','text','sort_order',34),
    jsonb_build_object('field_key','HORSE.AGE_DOB','label','Age / DOB','section','Horse','owner_role','LESSOR','value_type','text','sort_order',35),
    jsonb_build_object('field_key','HORSE.REGISTRATION_NUMBER','label','Registration Number','section','Horse','owner_role','LESSOR','value_type','text','sort_order',36),
    jsonb_build_object('field_key','HORSE.MICROCHIP','label','Microchip / ID','section','Horse','owner_role','LESSOR','value_type','text','sort_order',37),
    jsonb_build_object('field_key','HORSE.CURRENT_LOCATION','label','Current Location','section','Horse','owner_role','LESSOR','value_type','text','sort_order',38),
    -- ── TXN / DEAL terms (owned by 'DEAL' — originator sets, counterparty negotiates) ──
    jsonb_build_object('field_key','TXN.LEASE_TYPE','label','Lease Type','section','Terms','owner_role','DEAL','value_type','select','required',true,'sort_order',40),
    jsonb_build_object('field_key','TXN.LEASE_TERM','label','Lease Term','section','Terms','owner_role','DEAL','value_type','text','sort_order',41),
    jsonb_build_object('field_key','TXN.LEASE_START','label','Commencement Date','section','Terms','owner_role','DEAL','value_type','date','sort_order',42),
    jsonb_build_object('field_key','TXN.LEASE_END','label','Expiration Date','section','Terms','owner_role','DEAL','value_type','date','sort_order',43),
    jsonb_build_object('field_key','TXN.RENEWAL_TERMS','label','Renewal Terms','section','Terms','owner_role','DEAL','value_type','longtext','sort_order',44),
    jsonb_build_object('field_key','TXN.PERMITTED_ACTIVITIES','label','Permitted Activities','section','Permitted Use','owner_role','DEAL','value_type','checkbox','sort_order',45),
    jsonb_build_object('field_key','TXN.USE_RESTRICTIONS','label','Use Restrictions','section','Permitted Use','owner_role','DEAL','value_type','longtext','sort_order',46),
    jsonb_build_object('field_key','TXN.RESERVED_DAYS','label','Reserved Days','section','Permitted Use','owner_role','DEAL','value_type','text','sort_order',47),
    jsonb_build_object('field_key','TXN.AUTHORIZED_USERS','label','Authorized Users','section','Permitted Use','owner_role','DEAL','value_type','text','sort_order',48),
    jsonb_build_object('field_key','TXN.LEASE_FEE','label','Lease Fee','section','Payment','owner_role','DEAL','value_type','currency','required',true,'sort_order',50),
    jsonb_build_object('field_key','TXN.PAYMENT_SCHEDULE','label','Payment Schedule','section','Payment','owner_role','DEAL','value_type','text','sort_order',51),
    jsonb_build_object('field_key','TXN.PAYMENT_TERMS','label','Late Payment Terms','section','Payment','owner_role','DEAL','value_type','longtext','sort_order',52),
    jsonb_build_object('field_key','TXN.BOARDING_RESPONSIBILITY','label','Boarding Responsibility','section','Boarding','owner_role','DEAL','value_type','text','sort_order',53),
    jsonb_build_object('field_key','TXN.CARE_RESPONSIBILITY','label','Routine Care Responsibility','section','Care','owner_role','DEAL','value_type','text','sort_order',54),
    jsonb_build_object('field_key','TXN.ROUTINE_VET_RESPONSIBILITY','label','Routine Vet Responsibility','section','Care','owner_role','DEAL','value_type','text','sort_order',55),
    jsonb_build_object('field_key','TXN.EMERGENCY_VET_RESPONSIBILITY','label','Emergency Vet Responsibility','section','Care','owner_role','DEAL','value_type','text','sort_order',56),
    jsonb_build_object('field_key','TXN.VET_AUTH_CONTACT','label','Lessor Vet Authorization Contact','section','Care','owner_role','DEAL','value_type','text','sort_order',57),
    jsonb_build_object('field_key','TXN.FARRIER_RESPONSIBILITY','label','Farrier Responsibility','section','Care','owner_role','DEAL','value_type','text','sort_order',58),
    jsonb_build_object('field_key','TXN.TRAINING_TERMS','label','Training Terms','section','Training','owner_role','DEAL','value_type','longtext','sort_order',59),
    jsonb_build_object('field_key','TXN.INSURANCE_REQUIREMENTS','label','Insurance Requirements','section','Training','owner_role','DEAL','value_type','longtext','sort_order',60),
    jsonb_build_object('field_key','TXN.LESSOR_EQUIPMENT','label','Equipment Provided by Lessor','section','Equipment','owner_role','DEAL','value_type','longtext','sort_order',61),
    jsonb_build_object('field_key','TXN.LESSEE_EQUIPMENT','label','Equipment Provided by Lessee','section','Equipment','owner_role','DEAL','value_type','longtext','sort_order',62),
    jsonb_build_object('field_key','TXN.COMPETITION_TERMS','label','Competition Terms','section','Competition','owner_role','DEAL','value_type','longtext','sort_order',63),
    jsonb_build_object('field_key','TXN.COMPETITION_EXPENSES','label','Competition Expenses','section','Competition','owner_role','DEAL','value_type','text','sort_order',64),
    jsonb_build_object('field_key','TXN.RISK_ALLOCATION','label','Risk of Loss Allocation','section','Risk','owner_role','DEAL','value_type','longtext','sort_order',65),
    jsonb_build_object('field_key','TXN.TERMINATION_TERMS','label','Termination Terms','section','Termination','owner_role','DEAL','value_type','longtext','sort_order',66)
  ));

  RETURN jsonb_build_object('document_id', v_doc, 'engagement_id', v_eng, 'fields_seeded', v_n);
END;
$fn$;

REVOKE ALL ON FUNCTION start_lease_contract(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION start_lease_contract(uuid, uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION start_lease_contract(uuid, uuid, uuid) IS
  'The first WIRED instance of the generic engine: create_lease_engagement (LESSEE+LESSOR) → generate_document(''HORSE_LEASE'') → seed_contract_fields with the lease''s real, correctly-owned field set (LESSEE personal→LESSEE; LESSOR personal + all HORSE.*→LESSOR; all TXN/deal terms→''DEAL''; TXN.PERMITTED_ACTIVITIES is a checkbox field), originator=lessee, workflow_state=editable. Returns {document_id, engagement_id, fields_seeded}.';
