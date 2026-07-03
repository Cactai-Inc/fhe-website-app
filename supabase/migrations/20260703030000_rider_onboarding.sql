/*
  # FHE CRM — Rider Onboarding Flow (owner template revision 2026-07-03)

  The one-hour rider flow: admin provisions a paid lesson invitation → client
  registers → completes profile → reviews + signs the populated required set
  (COMPANY_POLICIES, FACILITY_RULES, RELEASE_PARTICIPANT, HUMAN_EMERGENCY_MEDICAL)
  → documents EXECUTE on signature → dashboard shows the purchased plan.

  1. contacts — profile fields the revised templates consume (emergency contacts,
     riding attestation). The profile is the canonical store; documents are
     projections of it (BOOKING_FLOWS_PLAN §4).
  2. client_purchases — snapshot of what was bought (tier, lessons, cadence, paid).
  3. contract_requirements — COMPANY_POLICIES joins every service's required set.
  4. generate_document v9 — CUT-marker processing (owner's conditional sections),
     DOC.EFFECTIVE_DATE + ORD.* resolution, CLIENT.* emergency/attestation fields,
     explicit org stamp on the documents insert (service-role safe).
  5. record_signature v3 — substitutes {{SIG.<ROLE>.NAME/DATE}} into merged_body at
     signing (self-signed docs no longer carry raw tokens into emails/records) and
     stamps signatures.org_id from the document (not the session GUC).
  6. provision_lesson_invitation — staff/service-role RPC: contact + client +
     engagement (AWAITING_SIGNATURE) + paid INVOICE transaction + purchase snapshot
     + invitation, org derived from the tier's offering (never current_org()).
  7. update_my_onboarding_profile / generate_my_onboarding_documents /
     my_onboarding_state — the authenticated client's onboarding seams.
*/

-- ============================================================
-- 1. contacts — document-projection profile fields
-- ============================================================
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS emergency_contact_1_name         text,
  ADD COLUMN IF NOT EXISTS emergency_contact_1_relationship text,
  ADD COLUMN IF NOT EXISTS emergency_contact_1_phone        text,
  ADD COLUMN IF NOT EXISTS emergency_contact_2_name         text,
  ADD COLUMN IF NOT EXISTS emergency_contact_2_relationship text,
  ADD COLUMN IF NOT EXISTS emergency_contact_2_phone        text,
  ADD COLUMN IF NOT EXISTS riding_experience_years          text,
  ADD COLUMN IF NOT EXISTS jump_experience                  text,
  ADD COLUMN IF NOT EXISTS riding_background                text,
  ADD COLUMN IF NOT EXISTS jump_limitations                 text;

-- ============================================================
-- 2. client_purchases — what the client bought (dashboard plan card + Flow D later)
-- ============================================================
CREATE TABLE IF NOT EXISTS client_purchases (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id) DEFAULT current_org(),
  engagement_id    uuid NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  tier_id          uuid REFERENCES offering_tiers(id) ON DELETE SET NULL,
  tier_label       text NOT NULL,
  amount           numeric(12,2) NOT NULL DEFAULT 0,
  lessons_included integer,          -- punch cards / single lessons
  cadence          text,             -- subscriptions: '2 lessons/week'
  paid             boolean NOT NULL DEFAULT false,
  payment_method   text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS client_purchases_org_idx ON client_purchases (org_id);
CREATE INDEX IF NOT EXISTS client_purchases_eng_idx ON client_purchases (engagement_id);

ALTER TABLE client_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_purchases_org_boundary ON client_purchases;
CREATE POLICY client_purchases_org_boundary ON client_purchases
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

DROP POLICY IF EXISTS client_purchases_read ON client_purchases;
CREATE POLICY client_purchases_read ON client_purchases
  FOR SELECT TO authenticated
  USING (is_admin() OR caller_owns_engagement(engagement_id));

DROP POLICY IF EXISTS client_purchases_admin_write ON client_purchases;
CREATE POLICY client_purchases_admin_write ON client_purchases
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- 3. matrix — COMPANY_POLICIES required for every service that requires anything
-- ============================================================
INSERT INTO contract_requirements (org_id, service_type, template_key)
SELECT DISTINCT cr.org_id, cr.service_type, 'COMPANY_POLICIES'
FROM contract_requirements cr
WHERE NOT EXISTS (
  SELECT 1 FROM contract_requirements x
  WHERE x.org_id = cr.org_id AND x.service_type = cr.service_type
    AND x.template_key = 'COMPANY_POLICIES'
);

-- ============================================================
-- 4. generate_document v9 — CUT markers, DOC.EFFECTIVE_DATE, ORD.*, CLIENT.* fields
-- ============================================================
CREATE OR REPLACE FUNCTION generate_document(
  p_engagement_id uuid,
  p_template_key  text
)
RETURNS TABLE (document_id uuid, merged_body text)
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_tmpl    contract_templates%ROWTYPE;
  v_eng     engagements%ROWTYPE;
  v_horse   horses%ROWTYPE;
  v_cfg     business_config%ROWTYPE;
  v_txn     transactions%ROWTYPE;
  v_has_txn boolean := false;
  v_breed   text := '';
  v_color   text := '';
  v_doc_id  uuid;
  v_doc_code text;
  v_body    text;
  v_val     text;
  v_org     text;   -- shared {{ORG.*}}/{{FHE.*}} resolution (aliases)
  v_rate    numeric;
  v_dir     jsonb := '{}'::jsonb;  -- directional token_overrides (v6)
  r         record;
  m         record;
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text; v_db text;
  v_ec1n text; v_ec1r text; v_ec1p text; v_ec2n text; v_ec2r text; v_ec2p text;
  v_ry text; v_jx text; v_rb text; v_jl text;
  v_c_phone text; v_c_email text; v_c_url text;
  v_has_minor boolean := false;
  v_is_jumper boolean := false;
  v_sel text;
BEGIN
  SELECT * INTO v_tmpl FROM contract_templates
    WHERE template_key = p_template_key AND active AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown or inactive contract template: %', p_template_key;
  END IF;
  IF v_tmpl.body IS NULL THEN
    RAISE EXCEPTION 'template % has no body loaded (no source document yet)', p_template_key;
  END IF;

  SELECT * INTO v_eng FROM engagements WHERE id = p_engagement_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown engagement: %', p_engagement_id;
  END IF;

  IF v_eng.primary_horse_id IS NOT NULL THEN
    SELECT * INTO v_horse FROM horses WHERE id = v_eng.primary_horse_id;
    SELECT display_name INTO v_breed FROM horse_breeds WHERE code = v_horse.breed;
    SELECT display_name INTO v_color FROM horse_colors WHERE code = v_horse.color;
  END IF;

  -- config — scope to the ENGAGEMENT'S org (v_eng already loaded above). Explicit,
  -- not RLS-accidental: correct for authenticated AND service_role/BYPASSRLS callers
  -- (current_org() would follow the session GUC, not the target engagement's tenant).
  SELECT * INTO v_cfg FROM business_config WHERE org_id = v_eng.org_id;

  -- public contact (phone/email/url) live in config_values ns CONTACT, resolved for
  -- the engagement's tenant. business_config has NO phone/email/url column.
  SELECT value_text INTO v_c_phone FROM config_values
    WHERE org_id = v_eng.org_id AND namespace = 'CONTACT' AND key = 'PHONE';
  SELECT value_text INTO v_c_email FROM config_values
    WHERE org_id = v_eng.org_id AND namespace = 'CONTACT' AND key = 'EMAIL';
  SELECT value_text INTO v_c_url FROM config_values
    WHERE org_id = v_eng.org_id AND namespace = 'CONTACT' AND key = 'URL';

  -- the engagement's financial record (latest), if any
  SELECT * INTO v_txn FROM transactions
    WHERE engagement_id = p_engagement_id AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;
  v_has_txn := FOUND;

  -- DIRECTIONAL TERMINOLOGY (v6, CONTRACT_MODULE_ARCHITECTURE Layer 1)
  SELECT COALESCE(tv.token_overrides, '{}'::jsonb) INTO v_dir
    FROM engagement_stages es
    LEFT JOIN template_variants tv
      ON tv.template_key = p_template_key
     AND tv.retained_by  = es.retained_by
     AND tv.deal_side    = es.deal_side
     AND tv.active
    WHERE es.engagement_id = p_engagement_id AND es.deleted_at IS NULL
    ORDER BY es.effective_from DESC, es.created_at DESC
    LIMIT 1;
  v_dir := COALESCE(v_dir, '{}'::jsonb);

  -- v9: explicit org stamp — DEFAULT current_org() is NULL for service-role callers.
  INSERT INTO documents (org_id, engagement_id, template_id, title, status)
    VALUES (v_eng.org_id, p_engagement_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  v_body := v_tmpl.body;

  -- ── v9: CUT-marker processing (owner's conditional template sections) ──────
  -- MINOR_* sections stay only when a PARTICIPANT (minor) party is on the
  -- engagement; JUMPER_* sections only for jumper-training engagements. Kept
  -- sections lose their marker comments; excluded sections are removed whole.
  v_has_minor := EXISTS (
    SELECT 1 FROM engagement_parties
    WHERE engagement_id = p_engagement_id AND party_role = 'PARTICIPANT');
  v_is_jumper := v_eng.service_type = 'JUMPER_TRAINING';
  FOR m IN
    SELECT DISTINCT (regexp_matches(v_body, '<!-- CUT-START: ([A-Z_]+)', 'g'))[1] AS name
  LOOP
    IF (m.name LIKE 'MINOR%' AND v_has_minor)
       OR (m.name LIKE 'JUMPER%' AND v_is_jumper) THEN
      v_body := regexp_replace(
        v_body, '[ \t]*<!-- CUT-(START|END): ' || m.name || '[^>]*-->\n?', '', 'g');
    ELSE
      v_body := regexp_replace(
        v_body,
        '\n?[ \t]*<!-- CUT-START: ' || m.name || '[^>]*-->.*<!-- CUT-END: ' || m.name || ' -->\n?',
        E'\n', 'g');
    END IF;
  END LOOP;

  FOR r IN
    SELECT namespace, field, token FROM template_tokens
    WHERE template_id = v_tmpl.id AND kind <> 'signature'
  LOOP
    v_val := '';

    IF r.namespace = 'HORSE' THEN
      v_val := CASE r.field
        WHEN 'REGISTERED_NAME'     THEN v_horse.registered_name
        WHEN 'BARN_NAME'           THEN v_horse.barn_name
        WHEN 'BREED'               THEN v_breed
        WHEN 'COLOR'               THEN v_color
        WHEN 'SEX'                 THEN v_horse.sex
        WHEN 'AGE_DOB'             THEN to_char(v_horse.date_of_birth, 'FMMonth FMDD, YYYY')
        WHEN 'HEIGHT'              THEN v_horse.height
        WHEN 'REGISTRATION_NUMBER' THEN v_horse.registration_number
        WHEN 'MICROCHIP'           THEN v_horse.microchip_id
        WHEN 'CURRENT_LOCATION'    THEN v_horse.current_location
        WHEN 'VET_NAME'            THEN v_horse.vet_name
        WHEN 'VET_PHONE'           THEN v_horse.vet_phone
        WHEN 'FARRIER_NAME'        THEN v_horse.farrier_name
        WHEN 'FARRIER_PHONE'       THEN v_horse.farrier_phone
        ELSE '' END;

    ELSIF r.namespace = 'ENG' THEN
      v_val := CASE r.field
        WHEN 'ID'           THEN v_eng.display_code
        WHEN 'SERVICE_TYPE' THEN v_eng.service_type
        WHEN 'START_DATE'   THEN to_char(v_eng.start_date, 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'DOC' THEN
      v_val := CASE r.field
        WHEN 'UUID'           THEN v_doc_id::text
        WHEN 'ID'             THEN v_doc_code
        WHEN 'GENERATED_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        -- v9: the owner's revised templates open with {{DOC.EFFECTIVE_DATE}}; the
        -- document is generated for same-session signing, so generation date IS the
        -- effective date (documents.effective_date is separately set at EXECUTED).
        WHEN 'EFFECTIVE_DATE' THEN to_char(now(), 'FMMonth FMDD, YYYY')
        ELSE '' END;

    ELSIF r.namespace = 'ORD' THEN
      -- v9: order-form tokens (owner revision) — the document IS the order copy.
      IF r.field = 'SERVICE_SELECTION' THEN
        SELECT cp.tier_label INTO v_sel FROM client_purchases cp
          WHERE cp.engagement_id = p_engagement_id
          ORDER BY cp.created_at DESC LIMIT 1;
        v_val := v_sel;
      ELSE
        v_val := CASE r.field
          WHEN 'UUID' THEN v_doc_id::text
          WHEN 'ID'   THEN v_doc_code
          ELSE '' END;
      END IF;

    ELSIF r.namespace = 'REQ' THEN
      -- request-capture inputs arrive with Flow A's public request form (plan §5);
      -- until then they merge blank (missing-source posture).
      v_val := '';

    ELSIF r.namespace = 'DIR' THEN
      v_val := v_dir ->> r.field;

    ELSIF r.namespace IN ('ORG', 'FHE') THEN
      v_org := CASE r.field
        WHEN 'LEGAL_NAME'       THEN v_cfg.legal_entity_name
        WHEN 'SIGNATORY_NAME'   THEN v_cfg.signatory_name
        WHEN 'SIGNATORY_TITLE'  THEN v_cfg.signatory_title
        WHEN 'ADDRESS'          THEN v_cfg.business_address
        WHEN 'BRAND_NAME'       THEN v_cfg.legal_entity_name
        WHEN 'ENTITY_FORMATION' THEN v_cfg.entity_formation
        WHEN 'REGISTERED_AGENT' THEN v_cfg.registered_agent
        WHEN 'CANCELLATION_FEE' THEN fmt_money(v_cfg.cancellation_fee)
        WHEN 'LATE_FEE'         THEN fmt_money(v_cfg.late_fee)
        WHEN 'NO_SHOW_FEE'      THEN fmt_money(v_cfg.no_show_fee)
        WHEN 'PHONE'            THEN v_c_phone
        WHEN 'EMAIL'            THEN v_c_email
        WHEN 'URL'              THEN v_c_url
        ELSE NULL END;
      IF v_org IS NULL THEN
        SELECT coalesce(cv.value_text, cv.value_num::text, cv.value_json #>> '{}')
          INTO v_org
          FROM config_values cv
          WHERE cv.org_id = v_eng.org_id AND cv.namespace = 'ORG' AND cv.key = r.field;
      END IF;
      v_val := v_org;

    ELSIF r.namespace = 'TXN' THEN
      IF r.field = 'COMMISSION_RATE' THEN
        v_rate := CASE
          WHEN v_eng.service_type ILIKE '%SALE%'  THEN v_cfg.commission_sale_rate
          WHEN v_eng.service_type ILIKE '%LEASE%' THEN v_cfg.commission_lease_rate
          ELSE v_cfg.commission_purchase_rate END;
        v_val := CASE WHEN v_rate IS NULL THEN ''
                      ELSE rtrim(rtrim(to_char(v_rate, 'FM999990.00'), '0'), '.') || '%' END;
      ELSIF r.field = 'COMMISSION_MIN' THEN
        v_val := fmt_money(v_cfg.commission_min);
      ELSIF v_has_txn THEN
        v_val := CASE r.field
          WHEN 'PURCHASE_PRICE'    THEN fmt_money(v_txn.amount)
          WHEN 'DEPOSIT_AMOUNT'    THEN fmt_money(v_txn.deposit_amount)
          WHEN 'DEPOSIT_TERMS'     THEN v_txn.deposit_terms
          WHEN 'BALANCE_DUE'       THEN CASE WHEN v_txn.amount IS NULL THEN ''
                                        ELSE fmt_money(v_txn.amount - COALESCE(v_txn.deposit_amount, 0)) END
          WHEN 'PAYMENT_TERMS'     THEN v_txn.payment_terms
          WHEN 'PAYMENT_SCHEDULE'  THEN v_txn.payment_schedule
          WHEN 'LEASE_TERM'        THEN v_txn.lease_term
          WHEN 'LEASE_FEE'         THEN fmt_money(v_txn.lease_fee)
          WHEN 'TRIAL_PERIOD'      THEN v_txn.trial_period
          WHEN 'DELIVERY_DATE'     THEN to_char(v_txn.delivery_date, 'FMMonth FMDD, YYYY')
          WHEN 'DELIVERY_LOCATION' THEN v_txn.delivery_location
          WHEN 'RETAINER_FEE'      THEN fmt_money(v_txn.retainer_fee)
          WHEN 'SERVICE_FEE'       THEN fmt_money(v_txn.service_fee)
          WHEN 'PACKAGE_FEE'       THEN fmt_money(v_txn.service_fee)
          WHEN 'SUCCESS_FEE'       THEN fmt_money(v_txn.success_fee)
          WHEN 'EVALUATION_FEE'    THEN fmt_money(v_txn.evaluation_fee)
          WHEN 'REPRESENTATION_FEE' THEN fmt_money(v_txn.representation_fee)
          ELSE '' END;
      ELSE
        v_val := '';  -- no transaction yet → blank
      END IF;

    ELSE
      v_fn := NULL; v_ph := NULL; v_em := NULL; v_ad := NULL; v_ti := NULL; v_re := NULL; v_db := NULL;
      v_ec1n := NULL; v_ec1r := NULL; v_ec1p := NULL; v_ec2n := NULL; v_ec2r := NULL; v_ec2p := NULL;
      v_ry := NULL; v_jx := NULL; v_rb := NULL; v_jl := NULL;
      -- the OFFICIAL name is first_name || ' ' || last_name (v7 canon).
      SELECT NULLIF(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''),
             c.phone, c.email, c.address_composed, ep.title, ep.relationship,
             CASE WHEN c.date_of_birth IS NULL THEN NULL
                  ELSE to_char(c.date_of_birth, 'FMMonth FMDD, YYYY') END,
             c.emergency_contact_1_name, c.emergency_contact_1_relationship, c.emergency_contact_1_phone,
             c.emergency_contact_2_name, c.emergency_contact_2_relationship, c.emergency_contact_2_phone,
             c.riding_experience_years, c.jump_experience, c.riding_background, c.jump_limitations
        INTO v_fn, v_ph, v_em, v_ad, v_ti, v_re, v_db,
             v_ec1n, v_ec1r, v_ec1p, v_ec2n, v_ec2r, v_ec2p,
             v_ry, v_jx, v_rb, v_jl
        FROM engagement_parties ep
        JOIN contacts c ON c.id = ep.contact_id
        WHERE ep.engagement_id = p_engagement_id AND ep.party_role = r.namespace
        ORDER BY ep.signer_order NULLS LAST
        LIMIT 1;
      v_val := CASE r.field
        WHEN 'FULL_NAME'    THEN v_fn
        WHEN 'PRINTED_NAME' THEN v_fn
        WHEN 'PHONE'        THEN v_ph
        WHEN 'EMAIL'        THEN v_em
        WHEN 'ADDRESS'      THEN v_ad
        WHEN 'TITLE'        THEN v_ti
        WHEN 'RELATIONSHIP' THEN v_re
        WHEN 'DOB'          THEN v_db
        -- v9: owner-revision CLIENT.* projection fields (stored on contacts)
        WHEN 'EMERGENCY_CONTACT_1_NAME'         THEN v_ec1n
        WHEN 'EMERGENCY_CONTACT_1_RELATIONSHIP' THEN v_ec1r
        WHEN 'EMERGENCY_CONTACT_1_PHONE'        THEN v_ec1p
        WHEN 'EMERGENCY_CONTACT_2_NAME'         THEN v_ec2n
        WHEN 'EMERGENCY_CONTACT_2_RELATIONSHIP' THEN v_ec2r
        WHEN 'EMERGENCY_CONTACT_2_PHONE'        THEN v_ec2p
        WHEN 'RIDING_EXPERIENCE_YEARS'          THEN v_ry
        WHEN 'JUMP_EXPERIENCE'                  THEN v_jx
        WHEN 'RIDING_BACKGROUND'                THEN v_rb
        WHEN 'JUMP_LIMITATIONS'                 THEN v_jl
        ELSE '' END;
    END IF;

    v_body := replace(v_body, r.token, COALESCE(v_val, ''));
  END LOOP;

  UPDATE documents SET merged_body = v_body WHERE id = v_doc_id;

  document_id := v_doc_id;
  merged_body := v_body;
  RETURN NEXT;
END;
$fn$;

-- ============================================================
-- 5. record_signature v3 — SIG token substitution + explicit org stamp
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
  END IF;

  SELECT status INTO v_status FROM documents WHERE id = p_document_id;
  RETURN v_status;
END;
$fn$;

COMMENT ON FUNCTION record_signature(uuid, text, text, text) IS
  'Seal a party''s typed signature (v3: substitutes SIG tokens into merged_body, stamps signatures.org_id from the document). Caller must be tenant staff or the party''s own contact; flips the document EXECUTED once every signer party has signed.';

-- ============================================================
-- 6. provision_lesson_invitation — staff/service-role provisioning in one call
-- ============================================================
CREATE OR REPLACE FUNCTION provision_lesson_invitation(
  p_email          text,
  p_first_name     text,
  p_last_name      text,
  p_tier_id        uuid,
  p_mark_paid      boolean DEFAULT false,
  p_payment_method text DEFAULT NULL,
  p_notes          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_tier       offering_tiers%ROWTYPE;
  v_org        uuid;
  v_service    text;
  v_contact    uuid;
  v_client     uuid;
  v_eng        uuid;
  v_inv_id     uuid;
  v_token      text;
  v_lessons    integer;
  v_cadence    text;
  v_email      text := lower(trim(p_email));
BEGIN
  -- staff in an org session, or the service-role API — never anonymous
  IF NOT (coalesce(auth.role(), '') = 'service_role' OR has_staff_access()) THEN
    RAISE EXCEPTION 'not authorized to provision invitations';
  END IF;
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'email is required';
  END IF;
  IF NULLIF(trim(coalesce(p_first_name,'')),'') IS NULL OR NULLIF(trim(coalesce(p_last_name,'')),'') IS NULL THEN
    RAISE EXCEPTION 'first and last name are required';
  END IF;

  -- the tier tells us the tenant AND the service — no current_org() dependence
  SELECT t.* INTO v_tier FROM offering_tiers t WHERE t.id = p_tier_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown offering tier: %', p_tier_id;
  END IF;
  SELECT o.org_id, o.service_type INTO v_org, v_service
    FROM offerings o WHERE o.id = v_tier.offering_id;
  v_service := coalesce(v_service, 'RIDING_LESSON');

  -- lesson quantity / cadence snapshot from the tier shape
  v_lessons := CASE
    WHEN v_tier.label ~ '(\d+)-Lesson' THEN (regexp_match(v_tier.label, '(\d+)-Lesson'))[1]::int
    WHEN v_tier.price_unit = 'session' THEN 1
    ELSE NULL END;
  v_cadence := CASE
    WHEN v_tier.price_unit = 'month' AND v_tier.label ~ '^(\d+)x' THEN
      (regexp_match(v_tier.label, '^(\d+)x'))[1] || ' lesson' ||
      CASE WHEN (regexp_match(v_tier.label, '^(\d+)x'))[1]::int > 1 THEN 's' ELSE '' END || '/week'
    ELSE NULL END;

  -- contact: reuse by email (not bound to someone else's profile) or create
  SELECT c.id INTO v_contact FROM contacts c
    WHERE lower(c.email) = v_email AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.contact_id = c.id AND lower(coalesce(p.email,'')) <> v_email)
    ORDER BY c.created_at LIMIT 1;
  IF v_contact IS NULL THEN
    INSERT INTO contacts (org_id, first_name, last_name, email)
      VALUES (v_org, trim(p_first_name), trim(p_last_name), v_email)
      RETURNING id INTO v_contact;
  ELSE
    -- heal placeholder names (contact heal: a nameless profile stands in with its
    -- email until a legal name arrives — the admin-entered name IS the legal name)
    UPDATE contacts SET
        first_name = CASE WHEN NULLIF(trim(coalesce(first_name,'')),'') IS NULL
                            OR lower(trim(first_name)) = lower(coalesce(email,''))
                          THEN trim(p_first_name) ELSE first_name END,
        last_name  = CASE WHEN NULLIF(trim(coalesce(last_name,'')),'')  IS NULL THEN trim(p_last_name)  ELSE last_name END
      WHERE id = v_contact;
  END IF;

  SELECT id INTO v_client FROM clients WHERE contact_id = v_contact AND deleted_at IS NULL;
  IF v_client IS NULL THEN
    INSERT INTO clients (org_id, contact_id, source)
      VALUES (v_org, v_contact, 'provisioned invitation')
      RETURNING id INTO v_client;
  END IF;

  INSERT INTO engagements (org_id, client_id, service_type, status, notes)
    VALUES (v_org, v_client, v_service, 'AWAITING_SIGNATURE',
            coalesce(p_notes, v_tier.label || ' (provisioned invitation)'))
    RETURNING id INTO v_eng;

  INSERT INTO engagement_parties (org_id, engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_org, v_eng, v_contact, 'CLIENT', true, 1);

  -- the money record: an INVOICE, PAID when the owner says they already paid
  INSERT INTO transactions (org_id, engagement_id, txn_type, amount, service_fee, status, payment_terms)
    VALUES (v_org, v_eng, 'INVOICE', v_tier.price_amount, v_tier.price_amount,
            CASE WHEN p_mark_paid THEN 'PAID' ELSE 'PENDING' END,
            CASE WHEN p_mark_paid THEN 'Paid in full via ' || coalesce(p_payment_method, 'offline payment')
                 ELSE 'Due before first session' END);

  INSERT INTO client_purchases (org_id, engagement_id, tier_id, tier_label, amount,
                                lessons_included, cadence, paid, payment_method, notes)
    VALUES (v_org, v_eng, v_tier.id, v_tier.label, v_tier.price_amount,
            v_lessons, v_cadence, p_mark_paid, p_payment_method, p_notes);

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO invitations (org_id, email, token, expires_at, status)
    VALUES (v_org, v_email, v_token, now() + interval '14 days', 'sent')
    RETURNING id INTO v_inv_id;

  RETURN jsonb_build_object(
    'invitation_id', v_inv_id,
    'token',         v_token,
    'engagement_id', v_eng,
    'contact_id',    v_contact,
    'tier_label',    v_tier.label,
    'amount',        v_tier.price_amount
  );
END;
$fn$;

REVOKE ALL ON FUNCTION provision_lesson_invitation(text, text, text, uuid, boolean, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION provision_lesson_invitation(text, text, text, uuid, boolean, text, text) TO authenticated, service_role;

-- ============================================================
-- 7a. update_my_onboarding_profile — the profile is the canonical store
-- ============================================================
CREATE OR REPLACE FUNCTION update_my_onboarding_profile(p jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_contact uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RAISE EXCEPTION 'no contact record for this account';
  END IF;

  UPDATE contacts SET
    phone         = coalesce(NULLIF(trim(p->>'phone'), ''), phone),
    date_of_birth = coalesce(NULLIF(trim(p->>'date_of_birth'), '')::date, date_of_birth),
    address_line1 = coalesce(NULLIF(trim(p->>'address_street'), ''), address_line1),
    city          = coalesce(NULLIF(trim(p->>'address_city'), ''), city),
    state         = coalesce(NULLIF(trim(p->>'address_state'), ''), state),
    postal_code   = coalesce(NULLIF(trim(p->>'address_zip'), ''), postal_code),
    emergency_contact_1_name         = coalesce(NULLIF(trim(p->>'emergency_contact_1_name'), ''), emergency_contact_1_name),
    emergency_contact_1_relationship = coalesce(NULLIF(trim(p->>'emergency_contact_1_relationship'), ''), emergency_contact_1_relationship),
    emergency_contact_1_phone        = coalesce(NULLIF(trim(p->>'emergency_contact_1_phone'), ''), emergency_contact_1_phone),
    emergency_contact_2_name         = coalesce(NULLIF(trim(p->>'emergency_contact_2_name'), ''), emergency_contact_2_name),
    emergency_contact_2_relationship = coalesce(NULLIF(trim(p->>'emergency_contact_2_relationship'), ''), emergency_contact_2_relationship),
    emergency_contact_2_phone        = coalesce(NULLIF(trim(p->>'emergency_contact_2_phone'), ''), emergency_contact_2_phone),
    riding_experience_years          = coalesce(NULLIF(trim(p->>'riding_experience_years'), ''), riding_experience_years),
    jump_experience                  = coalesce(NULLIF(trim(p->>'jump_experience'), ''), jump_experience),
    riding_background                = coalesce(NULLIF(trim(p->>'riding_background'), ''), riding_background),
    jump_limitations                 = coalesce(NULLIF(trim(p->>'jump_limitations'), ''), jump_limitations),
    updated_at = now()
  WHERE id = v_contact;
END;
$fn$;

REVOKE ALL ON FUNCTION update_my_onboarding_profile(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION update_my_onboarding_profile(jsonb) TO authenticated;

-- ============================================================
-- 7b. generate_my_onboarding_documents — regenerate unsigned drafts fresh
-- ============================================================
CREATE OR REPLACE FUNCTION generate_my_onboarding_documents()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_contact uuid;
  v_out     jsonb := '[]'::jsonb;
  eng       record;
  req       record;
  v_doc     uuid;
  v_status  text;
  v_title   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RAISE EXCEPTION 'no contact record for this account';
  END IF;

  FOR eng IN
    SELECT e.* FROM engagements e
    JOIN clients cl ON cl.id = e.client_id
    WHERE cl.contact_id = v_contact
      AND e.status = 'AWAITING_SIGNATURE'
      AND e.service_type IS NOT NULL
      AND e.deleted_at IS NULL
    ORDER BY e.created_at
  LOOP
    FOR req IN
      SELECT cr.template_key
      FROM contract_requirements cr
      WHERE cr.service_type = eng.service_type AND cr.org_id = eng.org_id
      ORDER BY coalesce(array_position(
        ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
              'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
              'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET'],
        cr.template_key), 99), cr.template_key
    LOOP
      SELECT d.id, d.status, d.title INTO v_doc, v_status, v_title
        FROM documents d
        JOIN contract_templates t ON t.id = d.template_id
        WHERE d.engagement_id = eng.id AND t.template_key = req.template_key
          AND d.deleted_at IS NULL
        ORDER BY (d.status = 'EXECUTED') DESC, d.created_at DESC
        LIMIT 1;

      IF v_doc IS NULL OR v_status <> 'EXECUTED' THEN
        -- retire any stale unsigned draft, then regenerate with fresh profile data
        UPDATE documents d SET deleted_at = now()
          FROM contract_templates t
          WHERE d.template_id = t.id AND d.engagement_id = eng.id
            AND t.template_key = req.template_key
            AND d.status <> 'EXECUTED' AND d.deleted_at IS NULL;
        SELECT g.document_id INTO v_doc FROM generate_document(eng.id, req.template_key) g;
        SELECT d.status, d.title INTO v_status, v_title FROM documents d WHERE d.id = v_doc;
      END IF;

      v_out := v_out || jsonb_build_object(
        'document_id', v_doc, 'template_key', req.template_key,
        'title', v_title, 'status', v_status);
      v_doc := NULL; v_status := NULL; v_title := NULL;
    END LOOP;
  END LOOP;

  RETURN v_out;
END;
$fn$;

REVOKE ALL ON FUNCTION generate_my_onboarding_documents() FROM public, anon;
GRANT EXECUTE ON FUNCTION generate_my_onboarding_documents() TO authenticated;

-- ============================================================
-- 7c. my_onboarding_state — one read for the stepper + dashboard cards
-- ============================================================
CREATE OR REPLACE FUNCTION my_onboarding_state()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_contact  uuid;
  v_c        contacts%ROWTYPE;
  v_docs     jsonb := '[]'::jsonb;
  v_purchase jsonb;
  v_needed   boolean := false;
  v_profile  boolean := false;
  eng        record;
  req        record;
  v_doc      uuid;
  v_status   text;
  v_title    text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  v_contact := coalesce(current_contact_id(), ensure_contact_for_profile(auth.uid()));
  IF v_contact IS NULL THEN
    RETURN jsonb_build_object('needed', false, 'profile_complete', false,
                              'documents', '[]'::jsonb, 'purchase', NULL);
  END IF;

  SELECT * INTO v_c FROM contacts WHERE id = v_contact;
  v_profile := v_c.phone IS NOT NULL AND v_c.date_of_birth IS NOT NULL
           AND v_c.emergency_contact_1_name IS NOT NULL
           AND v_c.emergency_contact_1_phone IS NOT NULL;

  -- latest purchase snapshot across my engagements (survives onboarding completion)
  SELECT jsonb_build_object(
      'tier_label', cp.tier_label, 'amount', cp.amount,
      'lessons_included', cp.lessons_included, 'cadence', cp.cadence,
      'paid', cp.paid, 'payment_method', cp.payment_method)
    INTO v_purchase
    FROM client_purchases cp
    JOIN engagements e ON e.id = cp.engagement_id
    JOIN clients cl ON cl.id = e.client_id
    WHERE cl.contact_id = v_contact AND e.deleted_at IS NULL
    ORDER BY cp.created_at DESC LIMIT 1;

  FOR eng IN
    SELECT e.* FROM engagements e
    JOIN clients cl ON cl.id = e.client_id
    WHERE cl.contact_id = v_contact
      AND e.status = 'AWAITING_SIGNATURE'
      AND e.service_type IS NOT NULL
      AND e.deleted_at IS NULL
    ORDER BY e.created_at
  LOOP
    FOR req IN
      SELECT cr.template_key
      FROM contract_requirements cr
      WHERE cr.service_type = eng.service_type AND cr.org_id = eng.org_id
      ORDER BY coalesce(array_position(
        ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT',
              'RELEASE_HORSE_CARE','RELEASE_HORSE_EXERCISE','RELEASE_GENERAL',
              'HUMAN_EMERGENCY_MEDICAL','HORSE_EMERGENCY_VET'],
        cr.template_key), 99), cr.template_key
    LOOP
      SELECT d.id, d.status, coalesce(d.title, t.title) INTO v_doc, v_status, v_title
        FROM documents d
        JOIN contract_templates t ON t.id = d.template_id
        WHERE d.engagement_id = eng.id AND t.template_key = req.template_key
          AND d.deleted_at IS NULL
        ORDER BY (d.status = 'EXECUTED') DESC, d.created_at DESC
        LIMIT 1;
      IF v_doc IS NULL THEN
        SELECT title INTO v_title FROM contract_templates WHERE template_key = req.template_key;
        v_status := 'MISSING';
      END IF;
      IF v_status IS DISTINCT FROM 'EXECUTED' THEN
        v_needed := true;
      END IF;
      v_docs := v_docs || jsonb_build_object(
        'document_id', v_doc, 'template_key', req.template_key,
        'title', v_title, 'status', coalesce(v_status, 'MISSING'));
      v_doc := NULL; v_status := NULL; v_title := NULL;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'needed', v_needed,
    'profile_complete', v_profile,
    'documents', v_docs,
    'purchase', v_purchase
  );
END;
$fn$;

REVOKE ALL ON FUNCTION my_onboarding_state() FROM public, anon;
GRANT EXECUTE ON FUNCTION my_onboarding_state() TO authenticated;
