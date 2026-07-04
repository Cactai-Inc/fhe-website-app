/*
  # CA e-signature legal hardening (release-signing audit — BOOKING_FLOWS_PLAN)

  ADDITIVE ONLY — live production data. Executed documents' existing rows are
  never touched: every new write below lands on NEW signatures/consents or on a
  document AT the moment it flips EXECUTED (guarded status <> 'EXECUTED').

  The audit gaps closed here:

  1. SESSION ATTRIBUTION — signatures gain user_agent (ip_address already
     exists). record_signature v5 and sign_release capture BOTH on every new
     signature; when not supplied as parameters they are read server-side from
     PostgREST's request context: current_setting('request.headers', true)
     ->> 'x-forwarded-for' (first hop) / ->> 'user-agent'. The guarded
     current_setting (missing_ok = true) makes the read a NULL outside
     PostgREST (e.g. PGlite tests — which may also SET the GUC to exercise it).

  2. E-SIGN CONSENT LOG — esign_consents: a separately-logged record of the
     signer's consent to transact electronically (UETA / ESIGN). Org-boundary
     RLS mirrors signatures; staff read; INSERTs only via the SECURITY DEFINER
     signing paths (no insert policy). record_signature v5 and sign_release
     gain p_esign_consent boolean DEFAULT false as their LAST parameter, so
     every existing positional caller keeps working. Consent is REQUIRED for
     new kiosk signings (sign_release raises when false — the kiosk UI ships a
     required checkbox); it stays optional-but-logged on record_signature so
     staff-facilitated signings that predate the checkbox keep working.
     sign_general_release v4 forwards its own new trailing p_esign_consent —
     consent always comes from the user, never hardcoded.

  3. TAMPER EVIDENCE — documents gain execution_hash: at the EXECUTED flip
     (record_signature v5 for in-app/staff paths; sign_release flips status
     itself for the kiosk, NOT via record_signature) we store
       encode(digest(final_merged_body || '|' || signer_contact_id || '|' ||
                     typed_name || '|' || signed_at::text, 'sha256'), 'hex')
     computed AFTER the {{SIG.*}} substitution, so the hash covers the final
     text plus the sealing signature's stored fields. pgcrypto provides
     digest(); it is enabled feature-detected below and the hash computation
     degrades to NULL (never blocks a signing) where pgcrypto is unavailable.
     Documents executed before this migration keep execution_hash NULL.

  (4./5. — delivery-email hash lines and the UI consent checkbox + kiosk print
   affordance live in api/deliver-document.ts and the React pages.)
*/

-- ============================================================
-- 0. pgcrypto — digest() for the execution hash. Feature-detected: an
--    environment that cannot install it still migrates (hashes stay NULL).
--    (PGlite loads pgcrypto via the test harness's extensions option.)
-- ============================================================
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'pgcrypto unavailable (%): execution hashes will be NULL', SQLERRM;
END $$;

-- ============================================================
-- 1. Columns (additive; IF NOT EXISTS — safe on live data)
-- ============================================================
ALTER TABLE signatures ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE documents  ADD COLUMN IF NOT EXISTS execution_hash text;

COMMENT ON COLUMN signatures.user_agent IS
  'Signer''s browser user-agent at signing (device attribution for the e-sign audit trail). Captured server-side from PostgREST request headers when not supplied.';
COMMENT ON COLUMN documents.execution_hash IS
  'SHA-256 over the final merged_body + sealing signature fields (signer contact id, typed_name, signed_at), hex. Stamped once at the EXECUTED flip; NULL for drafts and for documents executed before 20260703110000.';

-- The signature seal (20260629050000) extends over the new attribution column:
-- once signed_at is set, user_agent is immutable like ip_address.
CREATE OR REPLACE FUNCTION block_signed_signature_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.signed_at IS NOT NULL AND (
       NEW.typed_name        IS DISTINCT FROM OLD.typed_name
    OR NEW.signed_at         IS DISTINCT FROM OLD.signed_at
    OR NEW.ip_address        IS DISTINCT FROM OLD.ip_address
    OR NEW.user_agent        IS DISTINCT FROM OLD.user_agent
    OR NEW.method            IS DISTINCT FROM OLD.method
    OR NEW.party_role        IS DISTINCT FROM OLD.party_role
    OR NEW.signer_contact_id IS DISTINCT FROM OLD.signer_contact_id
    OR NEW.document_id       IS DISTINCT FROM OLD.document_id
  ) THEN
    RAISE EXCEPTION 'signature % is sealed (signed_at set); use void-and-reissue, not a direct update', OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. esign_consents — the separately-logged consent to transact electronically
-- ============================================================
CREATE TABLE IF NOT EXISTS esign_consents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  contact_id   uuid NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  document_id  uuid REFERENCES documents(id) ON DELETE RESTRICT,
  kind         text NOT NULL DEFAULT 'ESIGN_CONSENT',
  consented_at timestamptz NOT NULL DEFAULT now(),
  ip_address   text,
  user_agent   text
);

CREATE INDEX IF NOT EXISTS esign_consents_org_idx      ON esign_consents (org_id);
CREATE INDEX IF NOT EXISTS esign_consents_contact_idx  ON esign_consents (contact_id);
CREATE INDEX IF NOT EXISTS esign_consents_document_idx ON esign_consents (document_id);

ALTER TABLE esign_consents ENABLE ROW LEVEL SECURITY;

-- tenant boundary (RESTRICTIVE — mirrors signatures_org_boundary, 20260629190000)
DROP POLICY IF EXISTS esign_consents_org_boundary ON esign_consents;
CREATE POLICY esign_consents_org_boundary ON esign_consents AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- staff read (mirrors signatures: is_admin())
DROP POLICY IF EXISTS esign_consents_staff_read ON esign_consents;
CREATE POLICY esign_consents_staff_read ON esign_consents FOR SELECT TO authenticated
  USING (is_admin());

-- writes ONLY via the SECURITY DEFINER signing paths: no INSERT policy at all,
-- and the consent log is append-only for everyone at the grant level.
REVOKE INSERT, UPDATE, DELETE ON esign_consents FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE esign_consents IS
  'Consent-to-electronic-transaction log (UETA/ESIGN): one row per affirmative consent event, with session attribution. Inserted only by the SECURITY DEFINER signing RPCs; staff read; org-bounded like signatures.';

-- ============================================================
-- 3. Helpers
-- ============================================================

-- PostgREST exposes the HTTP request headers as the request.headers GUC (json).
-- Guarded read: missing GUC (outside PostgREST, PGlite tests) → NULLs; a
-- malformed value never blocks a signing. x-forwarded-for keeps the FIRST hop.
CREATE OR REPLACE FUNCTION http_request_attribution(OUT ip text, OUT user_agent text)
LANGUAGE plpgsql STABLE
AS $fn$
DECLARE
  v_hdrs json;
BEGIN
  BEGIN
    v_hdrs := nullif(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    v_hdrs := NULL;
  END;
  ip         := nullif(trim(split_part(coalesce(v_hdrs ->> 'x-forwarded-for', ''), ',', 1)), '');
  user_agent := nullif(trim(coalesce(v_hdrs ->> 'user-agent', '')), '');
END;
$fn$;

COMMENT ON FUNCTION http_request_attribution() IS
  'Session attribution from PostgREST''s request.headers GUC: (ip = first x-forwarded-for hop, user_agent). NULLs when the GUC is absent/malformed (guarded current_setting).';

-- The execution-hash formula, shared by every EXECUTED flip:
--   sha256( final_merged_body || '|' || signer_contact_id || '|' ||
--           typed_name || '|' || signed_at::text )   → hex
-- search_path includes `extensions` for Supabase installs where pgcrypto lives
-- there (a nonexistent schema in search_path is harmless, e.g. in PGlite).
-- Feature-detected: pgcrypto missing → NULL, never a failed signing.
CREATE OR REPLACE FUNCTION compute_execution_hash(
  p_body      text,
  p_signer    uuid,
  p_typed     text,
  p_signed_at timestamptz
)
RETURNS text
LANGUAGE plpgsql STABLE SET search_path = public, extensions
AS $fn$
BEGIN
  RETURN encode(digest(convert_to(
      coalesce(p_body, '') || '|' || p_signer::text || '|'
        || coalesce(p_typed, '') || '|' || p_signed_at::text,
      'UTF8'), 'sha256'), 'hex');
EXCEPTION WHEN undefined_function OR invalid_schema_name THEN
  RETURN NULL;
END;
$fn$;

COMMENT ON FUNCTION compute_execution_hash(text, uuid, text, timestamptz) IS
  'Tamper-evidence hash for an EXECUTED document: hex sha256 of merged_body||''|''||signer_contact_id||''|''||typed_name||''|''||signed_at::text. NULL when pgcrypto''s digest() is unavailable (feature-detected).';

-- ============================================================
-- 4. record_signature v5 = v4 (20260703090000) + attribution + consent log +
--    execution hash. The new parameters are LAST with DEFAULTs, so every
--    existing positional caller (3-4 args) keeps working; the old 4-arg
--    signature is dropped so overload resolution stays unambiguous.
-- ============================================================
DROP FUNCTION IF EXISTS record_signature(uuid, text, text, text);

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

    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date,
                         execution_hash = v_hash
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
  'Seal a party''s typed signature (v5: captures ip/user-agent — parameters or PostgREST headers — on the signature; logs an esign_consents row when p_esign_consent; stamps documents.execution_hash at the EXECUTED flip). Caller must be tenant staff or the party''s own contact; flips the document EXECUTED once every signer party has signed. New parameters are trailing with defaults — positional 3-4 arg callers unchanged.';

-- ============================================================
-- 5. sign_release — re-issued from 20260703050000 with e-sign hardening:
--    p_esign_consent (trailing, DEFAULT false) is REQUIRED true for new kiosk
--    signings; ip/user-agent captured from the request headers; consent row
--    logged; execution_hash stamped at the EXECUTED flip (sign_release flips
--    status itself — it does NOT route through record_signature).
-- ============================================================
DROP FUNCTION IF EXISTS sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid);

CREATE OR REPLACE FUNCTION sign_release(
  p_template_key          text,
  p_first_name            text,
  p_last_name             text,
  p_email                 text,
  p_phone                 text,
  p_typed_name            text,
  p_is_minor              boolean DEFAULT false,
  p_minor_first_name      text    DEFAULT NULL,
  p_minor_last_name       text    DEFAULT NULL,
  p_minor_dob             date    DEFAULT NULL,
  p_guardian_relationship text    DEFAULT NULL,
  p_rules_acknowledged    boolean DEFAULT false,
  p_org                   uuid    DEFAULT NULL,
  p_esign_consent         boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_first     text := trim(coalesce(p_first_name, ''));
  v_last      text := trim(coalesce(p_last_name, ''));
  v_name      text;   -- OFFICIAL signer name: first + ' ' + last (trimmed)
  v_typed     text := trim(coalesce(p_typed_name, ''));
  v_email     text := lower(trim(coalesce(p_email, '')));
  v_phone     text := trim(coalesce(p_phone, ''));
  v_minor_first text := trim(coalesce(p_minor_first_name, ''));
  v_minor_last  text := trim(coalesce(p_minor_last_name, ''));
  v_minor     text;   -- OFFICIAL minor name: first + ' ' + last (trimmed)
  v_rel       text := trim(coalesce(p_guardian_relationship, ''));
  v_org       uuid;
  v_contact   uuid;   -- the SIGNER's contact (the adult, or the parent/guardian)
  v_minor_c   uuid;   -- the minor's contact (minor path)
  v_client    uuid;
  v_eng       uuid;
  v_doc       uuid;
  v_doc_code  text;
  v_body      text;
  v_today     text := to_char(current_date, 'FMMonth FMDD, YYYY');
  v_need      integer;
  v_have      integer;
  v_status    text;
  v_ip        text;
  v_ua        text;
  v_signed_at timestamptz;
  v_hash      text;
BEGIN
  v_name  := trim(v_first || ' ' || v_last);
  v_minor := trim(v_minor_first || ' ' || v_minor_last);

  -- ---- validation (this RPC is the whole anon mutation surface — fail loudly) ----
  IF p_template_key NOT IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT',
                            'RELEASE_HORSE_EXERCISE','RELEASE_HORSE_CARE') THEN
    RAISE EXCEPTION 'unknown release template: %', p_template_key;
  END IF;
  IF NOT coalesce(p_rules_acknowledged, false) THEN
    RAISE EXCEPTION 'the facility rules must be acknowledged before signing';
  END IF;
  -- E-sign hardening 2026-07-03: kiosk signings REQUIRE the signer's explicit
  -- consent to transact electronically (the kiosk UI's required checkbox).
  IF NOT coalesce(p_esign_consent, false) THEN
    RAISE EXCEPTION 'electronic signing consent is required';
  END IF;
  IF v_first = '' THEN
    RAISE EXCEPTION 'a first name is required';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 200 THEN
    RAISE EXCEPTION 'a name is required (2-200 characters)';
  END IF;
  IF v_typed = '' OR lower(v_typed) <> lower(v_name) THEN
    RAISE EXCEPTION 'typed signature must match the full name exactly';
  END IF;
  IF v_email = '' THEN v_email := NULL; END IF;
  IF v_phone = '' THEN v_phone := NULL; END IF;
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'an email address or phone number is required';
  END IF;
  IF v_email IS NOT NULL AND (
       length(v_email) > 320
       OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) THEN
    RAISE EXCEPTION 'invalid email address';
  END IF;
  IF v_phone IS NOT NULL AND v_phone !~ '^[0-9+().\- ]{7,25}$' THEN
    RAISE EXCEPTION 'invalid phone number';
  END IF;
  IF coalesce(p_is_minor, false) THEN
    IF v_minor_first = '' THEN
      RAISE EXCEPTION 'the minor''s first name is required';
    END IF;
    IF length(v_minor) < 2 OR length(v_minor) > 200 THEN
      RAISE EXCEPTION 'the minor''s name is required (2-200 characters)';
    END IF;
    IF p_minor_dob IS NULL OR p_minor_dob >= current_date THEN
      RAISE EXCEPTION 'a valid date of birth for the minor is required';
    END IF;
    IF p_minor_dob + interval '18 years' <= current_date THEN
      RAISE EXCEPTION 'the named person is not a minor (18 or older); sign the adult release';
    END IF;
    IF length(v_rel) < 2 OR length(v_rel) > 100 THEN
      RAISE EXCEPTION 'the guardian''s relationship to the minor is required (2-100 characters)';
    END IF;
  END IF;

  -- ---- org resolution + transaction-local tenant pin (see 20260702020000) ----
  v_org := coalesce(p_org, current_org(), current_addressed_org(), sole_org());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization addressed (multi-tenant deployments must address a tenant)';
  END IF;
  PERFORM 1 FROM organizations WHERE id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown organization: %', v_org;
  END IF;
  PERFORM set_config('app.current_org', v_org::text, true);

  -- ---- session attribution (e-sign hardening): PostgREST request headers ----
  SELECT a.ip, a.user_agent INTO v_ip, v_ua FROM http_request_attribution() a;

  -- ---- find-or-create the SIGNER's contact (per-org email match) ----
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_contact FROM contacts
      WHERE org_id = v_org AND lower(email) = v_email AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
  END IF;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email, phone)
      VALUES (v_org, v_first, NULLIF(v_last, ''), v_email, v_phone)
      RETURNING id INTO v_contact;
  ELSE
    -- Heal placeholder identity on the found contact: profile-triggered contacts
    -- are born with first_name = email (no legal name), which then leaked into
    -- the document's Printed Name (owner-reported). The signer's submitted
    -- legal name governs.
    UPDATE contacts
       SET first_name = v_first,
           last_name  = NULLIF(v_last, ''),
           phone      = coalesce(nullif(phone, ''), v_phone)
     WHERE id = v_contact
       AND (
         NULLIF(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '') IS NULL
         OR lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) = lower(coalesce(email, ''))
       );
  END IF;
  -- The signer is the CLIENT on the document (2026-07-03 canon); a guardian
  -- signing for a minor additionally carries the GUARDIAN domain relationship.
  INSERT INTO contact_roles (contact_id, role_type)
    VALUES (v_contact, 'CLIENT')
    ON CONFLICT (contact_id, role_type) DO NOTHING;
  IF coalesce(p_is_minor, false) THEN
    INSERT INTO contact_roles (contact_id, role_type)
      VALUES (v_contact, 'GUARDIAN')
      ON CONFLICT (contact_id, role_type) DO NOTHING;
  END IF;

  -- ---- find-or-create the client shell (engagements.client_id NOT NULL) ----
  SELECT id INTO v_client FROM clients
    WHERE contact_id = v_contact AND deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, v_contact, 'VISITOR_RELEASE')
      RETURNING id INTO v_client;
  END IF;

  -- ---- the minimal NON-SERVICE engagement (service_type NULL, 20260702020000) ----
  INSERT INTO engagements (org_id, client_id, service_type, status, start_date, notes)
    VALUES (v_org, v_client, NULL, 'AWAITING_SIGNATURE', now()::date,
            format('%s (public release kiosk)', p_template_key))
    RETURNING id INTO v_eng;

  IF coalesce(p_is_minor, false) THEN
    -- Minor path: the minor is the PARTICIPANT party (NOT a signer) — its
    -- presence makes generate_document KEEP the MINOR_* CUT sections and
    -- resolve {{PARTICIPANT.FULL_NAME}}/{{PARTICIPANT.DOB}} from this contact.
    -- The parent/guardian signs as the CLIENT party (relationship recorded).
    -- Minor contact find-or-create by name within the org (minors typically
    -- have no contact channel); the submitted DOB lands on the contact row
    -- (insert + heal) so the {{PARTICIPANT.DOB}} token resolves.
    SELECT id INTO v_minor_c FROM contacts
      WHERE org_id = v_org
        AND lower(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) = lower(v_minor)
        AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
    IF v_minor_c IS NULL THEN
      INSERT INTO contacts (org_id, first_name, last_name, date_of_birth)
        VALUES (v_org, v_minor_first, NULLIF(v_minor_last, ''), p_minor_dob)
        RETURNING id INTO v_minor_c;
    ELSE
      UPDATE contacts SET date_of_birth = p_minor_dob
        WHERE id = v_minor_c AND date_of_birth IS NULL;
    END IF;
    INSERT INTO contact_roles (contact_id, role_type)
      VALUES (v_minor_c, 'PARTICIPANT')
      ON CONFLICT (contact_id, role_type) DO NOTHING;

    INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order, relationship)
      VALUES (v_org, v_eng, v_minor_c, 'PARTICIPANT', false, NULL, NULL),
             (v_org, v_eng, v_contact, 'CLIENT',      true,  1,    v_rel);
  ELSE
    -- Adult path: the CLIENT signs for themself; no PARTICIPANT party, so
    -- generate_document strips the MINOR_* CUT sections whole.
    INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_eng, v_contact, 'CLIENT', true, 1);
  END IF;

  -- NO COMPANY party: releases are unilateral (owner decision 2026-07-02).

  -- ---- generate through the REAL merge engine (v9: CUT processing + CLIENT.*
  --      resolution + {{DOC.EFFECTIVE_DATE}} = signing date); pin the tenant ----
  SELECT gd.document_id, gd.merged_body INTO v_doc, v_body
    FROM generate_document(v_eng, p_template_key) gd;
  UPDATE documents SET org_id = v_org, status = 'AWAITING_SIGNATURE' WHERE id = v_doc;

  -- ---- the completed CLIENT signature (validated fence: the block must exist) ----
  IF position('{{SIG.CLIENT.NAME}}' IN v_body) = 0 THEN
    RAISE EXCEPTION 'template % is missing its CLIENT signature block', p_template_key;
  END IF;
  v_body := replace(v_body, '{{SIG.CLIENT.NAME}}', v_typed);
  v_body := replace(v_body, '{{SIG.CLIENT.DATE}}', v_today);

  -- ---- record the rules acknowledgment ON the executed document ----
  v_body := rtrim(v_body)
    || E'\n\nFACILITY RULES ACKNOWLEDGMENT\n\nSigner acknowledged the Facility Rules and Safety Acknowledgment on '
    || v_today || E'.\n';

  -- ---- the sealed typed signature (signed_at set on insert) + attribution ----
  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, ip_address, user_agent, method)
    VALUES (v_org, v_doc, v_contact, 'CLIENT', v_typed, now(), v_ip, v_ua, 'KIOSK_TYPED')
    RETURNING signed_at INTO v_signed_at;

  -- ---- the separately-logged e-sign consent (required true above) ----
  INSERT INTO esign_consents (org_id, contact_id, document_id, ip_address, user_agent)
    VALUES (v_org, v_contact, v_doc, v_ip, v_ua);

  -- ---- executed once EVERY signer party has signed (single signer here) ----
  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM engagement_parties WHERE engagement_id = v_eng;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = v_doc AND signed_at IS NOT NULL AND deleted_at IS NULL;
  IF v_need > 0 AND v_have >= v_need THEN
    -- tamper evidence: hash the FINAL body (signature substituted + rules
    -- acknowledgment appended — exactly what is persisted below).
    v_hash := compute_execution_hash(v_body, v_contact, v_typed, v_signed_at);
    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date,
                         execution_hash = v_hash
      WHERE id = v_doc;
    UPDATE engagements SET status = 'ACTIVE' WHERE id = v_eng;
  END IF;

  -- persist the FINAL body (signed + rules acknowledgment)
  UPDATE documents SET merged_body = v_body WHERE id = v_doc;

  SELECT status, display_code INTO v_status, v_doc_code FROM documents WHERE id = v_doc;

  RETURN jsonb_build_object(
    'document_id',   v_doc,
    'document_code', v_doc_code,
    'engagement_id', v_eng,
    'contact_id',    v_contact,
    'status',        v_status,
    'merged_body',   v_body
  );
END;
$fn$;

REVOKE ALL ON FUNCTION sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid, boolean)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION sign_release(text, text, text, text, text, text, boolean, text, text, date, text, boolean, uuid, boolean) IS
  'Public release kiosk (CLIENT canon 2026-07-03 + e-sign hardening 20260703110000): REQUIRES p_esign_consent (trailing param, DEFAULT false — raises ''electronic signing consent is required'' when not given); captures ip/user-agent from the PostgREST request headers onto the sealed signature; logs an esign_consents row; stamps documents.execution_hash at the EXECUTED flip. Everything else preserved from 20260703050000: rules gate, typed-name fence, unilateral execution, per-org find-or-create, org stamps, KIOSK_TYPED method.';

-- ============================================================
-- 6. sign_general_release v4 — the kiosk wrapper forwards its OWN trailing
--    p_esign_consent (consent must come from the user; the wrapper never
--    hardcodes it). Email stays REQUIRED (v3, 20260703060000).
-- ============================================================
DROP FUNCTION IF EXISTS sign_general_release(text, text, text, text, uuid);

CREATE OR REPLACE FUNCTION sign_general_release(
  p_full_name     text,
  p_email         text,
  p_phone         text,
  p_typed_name    text,
  p_org           uuid    DEFAULT NULL,
  p_esign_consent boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  -- Owner directive 2026-07-03: kiosk signatures must carry an email for
  -- attribution. Fail before any row is written.
  IF NULLIF(trim(coalesce(p_email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'email is required';
  END IF;
  RETURN sign_release(
    'RELEASE_GENERAL',
    NULLIF(split_part(trim(coalesce(p_full_name, '')), ' ', 1), ''),
    CASE WHEN position(' ' IN trim(coalesce(p_full_name, ''))) > 0
         THEN NULLIF(trim(substring(trim(p_full_name) FROM position(' ' IN trim(p_full_name)) + 1)), '')
         ELSE NULL END,
    p_email, p_phone, p_typed_name,
    false, NULL, NULL, NULL, NULL, true, p_org,
    coalesce(p_esign_consent, false));
END;
$fn$;

REVOKE ALL ON FUNCTION sign_general_release(text, text, text, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sign_general_release(text, text, text, text, uuid, boolean)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION sign_general_release(text, text, text, text, uuid, boolean) IS
  'Kiosk wrapper over sign_release(RELEASE_GENERAL, …, adult path). v4: forwards its own trailing p_esign_consent (DEFAULT false — sign_release rejects without it; consent always comes from the user). v3: p_email REQUIRED. Splits its single full-name argument on the first space into first/last. Unilateral: EXECUTES on the visitor signature (signer = CLIENT party).';
