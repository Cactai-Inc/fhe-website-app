/*
  # FHE Suite — Visitor general-release kiosk RPC (sign_general_release)

  The public /release kiosk: a visitor types their name/contact, reads the
  rendered RELEASE_GENERAL, and signs by typing their name. generate_document
  requires an engagement, so this SECURITY DEFINER RPC orchestrates the WHOLE
  legal flow through the REAL engines (nothing re-implemented, nothing faked):

    find-or-create contact → find-or-create client shell → minimal engagement
    → generate_document(eng,'RELEASE_GENERAL') → sealed PARTICIPANT signature
    → document status via record_signature's every-signer-signed rule.

  DESIGN CHOICES (documented per the platform contract):

  - service_type: engagements.service_type was NOT NULL, but a visitor release
    is a NON-SERVICE engagement — RELEASE_* contract_templates themselves carry
    service_type NULL ("NULL for non-service docs", migration 11 /
    20260701070000). Inventing a service code would be dishonest (it would also
    drag the release into required_documents_for / settlement rollups and break
    the frozen 13-code catalog test). So this migration DROPS the NOT NULL and
    the kiosk engagement carries service_type NULL. Every existing writer
    supplies an explicit code, and every reader (generate_document ENG/TXN
    arms, rollups) already NULL-coalesces.

  - org resolution (documented choice):
      coalesce(p_org, current_org(), current_addressed_org(), sole_org())
    · p_org                    — an explicit tenant (kiosk deployed per-tenant).
    · current_org()            — an authenticated org member, or the seed/service
                                 context's app.current_org GUC (harness/pipeline).
    · current_addressed_org()  — the addressed public tenant (app.addressed_org,
                                 20260630030000).
    · sole_org()               — single-tenant launch fallback (20260702010000);
                                 with 2+ unaddressed tenants it is NULL and the
                                 RPC fails loudly rather than cross-wiring.
    The resolved org is pinned to the transaction-local app.current_org GUC so
    the DEFAULT current_org() columns inside generate_document stamp the SAME
    tenant for an anon caller; the documents row is additionally pinned
    explicitly (belt-and-braces for authenticated callers of another org).

  - COMPANY countersign: mirrors the migration-42 owner rule — when the tenant
    has designated a signatory (business_config.signatory_contact_id) a COMPANY
    signer party is attached, so the document stays AWAITING_SIGNATURE until
    the company countersigns (via the existing record_signature RPC); without a
    signatory the participant is the only signer and the document EXECUTES
    immediately.

  - PARTICIPANT role: 'VISITOR' is not in the party_role CHECKs; RELEASE_GENERAL
    deliberately uses the PARTICIPANT namespace for the visitor (20260701070000).

  - Rate-limit / abuse surface: this RPC is the ONLY anon-executable mutation
    seam added for the kiosk (explicit REVOKE/GRANT below), and it validates
    every input hard — bounded name, email format, phone format, at least one
    contact channel, and the typed signature must match the printed name.
*/

-- ============================================================
-- 1. A visitor release is a NON-SERVICE engagement (see header).
-- ============================================================
ALTER TABLE engagements ALTER COLUMN service_type DROP NOT NULL;

COMMENT ON COLUMN engagements.service_type IS
  'Canonical service code (service_types); NULL for non-service engagements (e.g. the visitor general-release kiosk), mirroring contract_templates.service_type NULL for non-service docs.';

-- ============================================================
-- 2. sign_general_release — the kiosk orchestration RPC
-- ============================================================
CREATE OR REPLACE FUNCTION sign_general_release(
  p_full_name  text,
  p_email      text,
  p_phone      text,
  p_typed_name text,
  p_org        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_name     text := trim(coalesce(p_full_name, ''));
  v_typed    text := trim(coalesce(p_typed_name, ''));
  v_email    text := lower(trim(coalesce(p_email, '')));
  v_phone    text := trim(coalesce(p_phone, ''));
  v_org      uuid;
  v_contact  uuid;
  v_client   uuid;
  v_eng      uuid;
  v_doc      uuid;
  v_doc_code text;
  v_body     text;
  v_company  uuid;
  v_need     integer;
  v_have     integer;
  v_status   text;
BEGIN
  -- ---- validation (this RPC is the whole anon surface — fail loudly) ----
  IF length(v_name) < 2 OR length(v_name) > 200 THEN
    RAISE EXCEPTION 'full name is required (2-200 characters)';
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

  -- ---- org resolution (see header for the documented order) ----
  v_org := coalesce(p_org, current_org(), current_addressed_org(), sole_org());
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'no organization addressed (multi-tenant deployments must address a tenant)';
  END IF;
  PERFORM 1 FROM organizations WHERE id = v_org;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown organization: %', v_org;
  END IF;

  -- Pin the tenant for this transaction so DEFAULT current_org() columns inside
  -- generate_document resolve for an anon caller (auth.uid() IS NULL reads the GUC).
  PERFORM set_config('app.current_org', v_org::text, true);

  -- ---- find-or-create the visitor's contact (per-org email match) ----
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_contact FROM contacts
      WHERE org_id = v_org AND lower(email) = v_email AND deleted_at IS NULL
      ORDER BY created_at LIMIT 1;
  END IF;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, full_name, email, phone)
      VALUES (v_org, v_name, v_email, v_phone)
      RETURNING id INTO v_contact;
  END IF;
  INSERT INTO contact_roles (contact_id, role_type)
    VALUES (v_contact, 'PARTICIPANT')
    ON CONFLICT (contact_id, role_type) DO NOTHING;

  -- ---- find-or-create the client shell (engagements.client_id NOT NULL) ----
  SELECT id INTO v_client FROM clients
    WHERE contact_id = v_contact AND deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, v_contact, 'VISITOR_RELEASE')
      RETURNING id INTO v_client;
  END IF;

  -- ---- the minimal NON-SERVICE engagement the document layer hangs off ----
  INSERT INTO engagements (org_id, client_id, service_type, status, start_date, notes)
    VALUES (v_org, v_client, NULL, 'AWAITING_SIGNATURE', now()::date,
            'Visitor general release (public kiosk)')
    RETURNING id INTO v_eng;

  INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_eng, v_contact, 'PARTICIPANT', true, 1);

  -- COMPANY countersign party when the tenant designated a signatory (migration-42 rule)
  SELECT signatory_contact_id INTO v_company FROM business_config WHERE org_id = v_org;
  IF v_company IS NOT NULL THEN
    INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_org, v_eng, v_company, 'COMPANY', true, 99);
  END IF;

  -- ---- generate through the REAL merge engine; pin the document's tenant ----
  SELECT gd.document_id, gd.merged_body INTO v_doc, v_body
    FROM generate_document(v_eng, 'RELEASE_GENERAL') gd;
  UPDATE documents SET org_id = v_org, status = 'AWAITING_SIGNATURE' WHERE id = v_doc;

  -- ---- the visitor's PARTICIPANT signature (sealed on insert: signed_at set) ----
  INSERT INTO signatures (org_id, document_id, signer_contact_id, party_role, typed_name, signed_at, method)
    VALUES (v_org, v_doc, v_contact, 'PARTICIPANT', v_typed, now(), 'KIOSK_TYPED');

  -- ---- executed once EVERY signer party has signed (record_signature's rule) ----
  SELECT count(*) FILTER (WHERE is_signer) INTO v_need
    FROM engagement_parties WHERE engagement_id = v_eng;
  SELECT count(*) INTO v_have
    FROM signatures WHERE document_id = v_doc AND signed_at IS NOT NULL AND deleted_at IS NULL;
  IF v_need > 0 AND v_have >= v_need THEN
    UPDATE documents SET status = 'EXECUTED', effective_date = now()::date WHERE id = v_doc;
    UPDATE engagements SET status = 'ACTIVE' WHERE id = v_eng;
  END IF;

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

-- The ONLY anon-executable mutation seam added for the kiosk. (Supabase grants
-- function EXECUTE broadly by default; this makes the intended anon surface
-- explicit — every other RPC either requires auth.uid() internally or is not
-- part of the kiosk surface.)
REVOKE ALL ON FUNCTION sign_general_release(text, text, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sign_general_release(text, text, text, text, uuid)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION sign_general_release(text, text, text, text, uuid) IS
  'Public visitor kiosk: find-or-create contact/client, open a NON-SERVICE engagement, generate RELEASE_GENERAL through the real merge engine, record the sealed PARTICIPANT typed signature; EXECUTED once every signer (incl. COMPANY countersign when designated) has signed. Org: p_org -> current_org() -> addressed org -> sole_org().';
