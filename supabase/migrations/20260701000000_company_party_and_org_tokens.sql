/*
  # FHE Suite — COMPANY party + ORG token engine (Contracts Legal Pass, migration 42)

  The business is a SOLE PROPRIETORSHIP d/b/a "French Heritage Equestrian"; contracts
  identify the business side via the defined term "COMPANY" and all identity/legal
  wording flows through config tokens (exact attorney wording pending). This migration
  delivers the SQL engine for that pass; the seed values land in the companion
  20260701010000_seed_fhe_company_identity.sql. ADDITIVE except where noted; the four
  shipped generate_document versions (migrations 18/22/27/29) are untouched — this
  re-issues the function via CREATE OR REPLACE, copying the FULL live body from
  20260630020000_value_registry.sql and extending it (resolver v5).

  1. horses — four nullable text columns (vet_name, vet_phone, farrier_name,
     farrier_phone) backing the new {{HORSE.VET_*}}/{{HORSE.FARRIER_*}} tokens.

  2. business_config.signatory_contact_id — the tenant's designated company signatory
     (a contacts row). When set, the engagement-creation RPCs attach a COMPANY signer
     party, making the company a REAL signing party (fixes "the company never signs").

  3. Party-role rename FHE -> COMPANY: drop/re-add the two inline CHECKs
     (engagement_parties from migration 10; signatures from migration 12 — the
     auto-named *_party_role_check constraints), with a defensive
     UPDATE ... SET party_role='COMPANY' WHERE party_role='FHE' first (no repo-seeded
     rows exist; deployed DBs might). The signatures seal trigger is disabled around
     that UPDATE only (it blocks party_role changes on sealed rows by design; this is
     a rename of the same legal party, not a re-signing).

  4. create_purchase_engagement / create_search_engagement / create_lease_engagement —
     re-created with their FULL current bodies from 20260630060000_mod_brokerage.sql
     (require_module guard and all), adding: after the existing party inserts, INSERT
     a COMPANY engagement_parties row (contact_id = business_config.signatory_contact_id
     for the engagement's org, is_signer = true, signer_order = 99) ONLY when
     signatory_contact_id IS NOT NULL. record_signature needs no change (generic on
     party rows). KNOWN BEHAVIOR CHANGE: with a COMPANY is_signer party, documents flip
     EXECUTED only after COMPANY also signs.

  5. generate_document v5 — ORG/FHE arm gains ENTITY_FORMATION / REGISTERED_AGENT
     (typed business_config columns) and CANCELLATION_FEE / LATE_FEE / NO_SHOW_FEE
     (fmt_money over typed columns); the arm's ELSE '' becomes a GENERIC EAV FALLBACK
     over config_values ns ORG keyed off the ENGAGEMENT's org (v_eng.org_id — NOT
     config_value(), which is current_org()-scoped and therefore wrong-tenant for
     service_role callers; see value_registry.sql §config_value). ORG.LEGAL_IDENTITY
     and every future ORG.* token (INVOICE_DUE_DAYS, CANCELLATION_NOTICE_HOURS,
     TERMINATION_NOTICE_DAYS, …) resolve through that fallback — seed-only, no more
     resolver migrations. HORSE arm gains VET_NAME/VET_PHONE/FARRIER_NAME/FARRIER_PHONE.
     Party arm unchanged (it already resolves ANY namespace as a party_role, so
     {{EMERGENCY_CONTACT.*}} works for free — the role is in both CHECKs).

  6. Documentation-only global dictionary rows for the new tokens (template_id NULL
     rows are never merged, §6) and config_keys whitelist rows for the new ORG.* keys
     (the anti-typo guard).
*/

-- ============================================================
-- 1. horses — vet / farrier contact columns ({{HORSE.VET_*}} / {{HORSE.FARRIER_*}})
-- ============================================================
ALTER TABLE horses ADD COLUMN IF NOT EXISTS vet_name      text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS vet_phone     text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS farrier_name  text;
ALTER TABLE horses ADD COLUMN IF NOT EXISTS farrier_phone text;

-- ============================================================
-- 2. business_config.signatory_contact_id — the tenant's company signatory
-- ============================================================
ALTER TABLE business_config
  ADD COLUMN IF NOT EXISTS signatory_contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- ============================================================
-- 3. Party-role rename: FHE -> COMPANY (engagement_parties + signatures CHECKs)
--    Drop first (the UPDATE would violate the old list), rename defensively, re-add.
-- ============================================================
ALTER TABLE engagement_parties DROP CONSTRAINT IF EXISTS engagement_parties_party_role_check;

UPDATE engagement_parties SET party_role = 'COMPANY' WHERE party_role = 'FHE';

ALTER TABLE engagement_parties ADD CONSTRAINT engagement_parties_party_role_check
  CHECK (party_role IN (
    'CLIENT','BUYER','SELLER','LESSOR','LESSEE','OWNER','RIDER',
    'PARTICIPANT','PARENT','GUARDIAN','EMERGENCY_CONTACT',
    'CONTRACTOR','FACILITY_CONTACT','COMPANY'));

ALTER TABLE signatures DROP CONSTRAINT IF EXISTS signatures_party_role_check;

-- The seal trigger (migration 12) blocks party_role changes on signed rows by design.
-- This defensive rename relabels the SAME legal party (FHE -> COMPANY) without touching
-- typed_name/signed_at/ip, so it is disabled for this one statement only.
ALTER TABLE signatures DISABLE TRIGGER signatures_seal_after_sign;
UPDATE signatures SET party_role = 'COMPANY' WHERE party_role = 'FHE';
ALTER TABLE signatures ENABLE TRIGGER signatures_seal_after_sign;

ALTER TABLE signatures ADD CONSTRAINT signatures_party_role_check
  CHECK (party_role IN (
    'CLIENT','BUYER','SELLER','LESSOR','LESSEE','OWNER','RIDER',
    'PARTICIPANT','PARENT','GUARDIAN','EMERGENCY_CONTACT',
    'CONTRACTOR','FACILITY_CONTACT','COMPANY'));

-- ============================================================
-- 4. Engagement-creation RPCs — COMPANY becomes a real signing party.
--    FULL current bodies from 20260630060000_mod_brokerage.sql (require_module guard
--    and every other line preserved); the only addition is the COMPANY party insert
--    after the existing party inserts, gated on business_config.signatory_contact_id
--    for the ENGAGEMENT's org.
-- ============================================================

-- create_purchase_engagement — body from mod_brokerage (which added the
-- require_module guard to migration 23's body) + the COMPANY signer party.
CREATE OR REPLACE FUNCTION create_purchase_engagement(
  p_buyer_contact_id  uuid,
  p_horse_id          uuid    DEFAULT NULL,
  p_seller_contact_id uuid    DEFAULT NULL,
  p_amount            numeric DEFAULT NULL,
  p_deposit           numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_client_id      uuid;
  v_eng_id         uuid;
  v_company_signer uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  PERFORM require_module('mod.brokerage');

  -- find-or-create the buyer's client record (clients.contact_id is UNIQUE)
  SELECT id INTO v_client_id FROM clients WHERE contact_id = p_buyer_contact_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO clients (contact_id) VALUES (p_buyer_contact_id) RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO engagements (client_id, service_type, primary_horse_id, start_date)
    VALUES (v_client_id, 'HORSE_PURCHASE_ASSISTANCE', p_horse_id, now()::date)
    RETURNING id INTO v_eng_id;

  -- the buyer (our client) and, if known, the seller — both signers
  INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_eng_id, p_buyer_contact_id, 'BUYER', true, 1);
  IF p_seller_contact_id IS NOT NULL THEN
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_eng_id, p_seller_contact_id, 'SELLER', true, 2);
  END IF;

  -- COMPANY is a real signing party when the tenant has designated a signatory
  -- (business_config.signatory_contact_id, resolved for the ENGAGEMENT's org).
  SELECT bc.signatory_contact_id INTO v_company_signer
    FROM business_config bc
    JOIN engagements e ON e.org_id = bc.org_id
    WHERE e.id = v_eng_id;
  IF v_company_signer IS NOT NULL THEN
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_eng_id, v_company_signer, 'COMPANY', true, 99);
  END IF;

  INSERT INTO transactions (engagement_id, txn_type, amount, deposit_amount)
    VALUES (v_eng_id, 'PURCHASE', p_amount, p_deposit);

  RETURN v_eng_id;
END;
$fn$;

-- create_search_engagement — body from mod_brokerage + the COMPANY signer party.
CREATE OR REPLACE FUNCTION create_search_engagement(
  p_client_contact_id uuid,
  p_retained_by       text    DEFAULT 'buyer',
  p_deal_side         text    DEFAULT 'BUY',
  p_horse_id          uuid    DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_client_id      uuid;
  v_eng_id         uuid;
  v_company_signer uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  PERFORM require_module('mod.brokerage');

  SELECT id INTO v_client_id FROM clients WHERE contact_id = p_client_contact_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO clients (contact_id) VALUES (p_client_contact_id) RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO engagements (client_id, service_type, primary_horse_id, start_date)
    VALUES (v_client_id, 'HORSE_FINDER', p_horse_id, now()::date)
    RETURNING id INTO v_eng_id;

  INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_eng_id, p_client_contact_id, 'CLIENT', true, 1);

  -- COMPANY is a real signing party when the tenant has designated a signatory
  -- (business_config.signatory_contact_id, resolved for the ENGAGEMENT's org).
  SELECT bc.signatory_contact_id INTO v_company_signer
    FROM business_config bc
    JOIN engagements e ON e.org_id = bc.org_id
    WHERE e.id = v_eng_id;
  IF v_company_signer IS NOT NULL THEN
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_eng_id, v_company_signer, 'COMPANY', true, 99);
  END IF;

  INSERT INTO engagement_stages (engagement_id, stage, retained_by, deal_side, status)
    VALUES (v_eng_id, 'SEARCH', p_retained_by, p_deal_side, 'OPEN');

  RETURN v_eng_id;
END;
$fn$;

-- create_lease_engagement — body from mod_brokerage + the COMPANY signer party.
CREATE OR REPLACE FUNCTION create_lease_engagement(
  p_client_contact_id uuid,
  p_deal_side         text    DEFAULT 'LEASE_IN',
  p_horse_id          uuid    DEFAULT NULL,
  p_counterparty_contact_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_client_id      uuid;
  v_eng_id         uuid;
  v_service        text;
  v_retained_by    text;
  v_client_role    text;   -- our client's party_role (valid engagement_parties CHECK value)
  v_counter_role   text;   -- the counterparty's party_role
  v_company_signer uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  PERFORM require_module('mod.brokerage');

  IF p_deal_side NOT IN ('LEASE_IN','LEASE_OUT') THEN
    RAISE EXCEPTION 'lease engagement deal_side must be LEASE_IN or LEASE_OUT, got %', p_deal_side;
  END IF;

  IF p_deal_side = 'LEASE_IN' THEN
    v_service      := 'HORSE_LEASE_IN_ASSISTANCE';
    v_retained_by  := 'lessee';
    v_client_role  := 'LESSEE';
    v_counter_role := 'LESSOR';
  ELSE
    v_service      := 'HORSE_LEASE_OUT_ASSISTANCE';
    v_retained_by  := 'lessor';
    v_client_role  := 'LESSOR';
    v_counter_role := 'LESSEE';
  END IF;

  SELECT id INTO v_client_id FROM clients WHERE contact_id = p_client_contact_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    INSERT INTO clients (contact_id) VALUES (p_client_contact_id) RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO engagements (client_id, service_type, primary_horse_id, start_date)
    VALUES (v_client_id, v_service, p_horse_id, now()::date)
    RETURNING id INTO v_eng_id;

  INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
    VALUES (v_eng_id, p_client_contact_id, v_client_role, true, 1);
  IF p_counterparty_contact_id IS NOT NULL THEN
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_eng_id, p_counterparty_contact_id, v_counter_role, true, 2);
  END IF;

  -- COMPANY is a real signing party when the tenant has designated a signatory
  -- (business_config.signatory_contact_id, resolved for the ENGAGEMENT's org).
  SELECT bc.signatory_contact_id INTO v_company_signer
    FROM business_config bc
    JOIN engagements e ON e.org_id = bc.org_id
    WHERE e.id = v_eng_id;
  IF v_company_signer IS NOT NULL THEN
    INSERT INTO engagement_parties (engagement_id, contact_id, party_role, is_signer, signer_order)
      VALUES (v_eng_id, v_company_signer, 'COMPANY', true, 99);
  END IF;

  INSERT INTO engagement_stages (engagement_id, stage, retained_by, deal_side, status)
    VALUES (v_eng_id, 'TRANSACTION_REP', v_retained_by, p_deal_side, 'OPEN');

  RETURN v_eng_id;
END;
$fn$;

-- ============================================================
-- 5. generate_document — resolver v5. CREATE OR REPLACE extending the U3 body
--    (20260630020000_value_registry.sql — every existing arm preserved verbatim):
--    + ORG/FHE typed arms ENTITY_FORMATION / REGISTERED_AGENT / CANCELLATION_FEE /
--      LATE_FEE / NO_SHOW_FEE
--    + GENERIC EAV FALLBACK (config_values ns ORG, keyed off v_eng.org_id) replacing
--      the arm's ELSE '' — ORG.LEGAL_IDENTITY and all future ORG.* keys are seed-only
--    + HORSE VET_NAME / VET_PHONE / FARRIER_NAME / FARRIER_PHONE
--    Party arm unchanged: any unrecognized namespace resolves as a party_role
--    (EMERGENCY_CONTACT.FULL_NAME/RELATIONSHIP/PHONE work for free).
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
  r         record;
  v_fn text; v_ph text; v_em text; v_ad text; v_ti text; v_re text;
  v_c_phone text; v_c_email text; v_c_url text;
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

  INSERT INTO documents (engagement_id, template_id, title, status)
    VALUES (p_engagement_id, v_tmpl.id, v_tmpl.title, 'DRAFT')
    RETURNING id, display_code INTO v_doc_id, v_doc_code;

  v_body := v_tmpl.body;
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
        ELSE '' END;

    ELSIF r.namespace IN ('ORG', 'FHE') THEN
      -- {{FHE.*}} is a literal alias of {{ORG.*}}: identical resolution from the
      -- SAME per-engagement v_cfg (typed) + config_values ns CONTACT for PHONE/
      -- EMAIL/URL (business_config has no such column) — section 6.2.
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
      -- GENERIC EAV FALLBACK (v5): any ORG.* field with no typed resolution reads
      -- config_values ns ORG for the ENGAGEMENT's org. Deliberately NOT config_value()
      -- — that seam is current_org()-scoped, which is the WRONG tenant for
      -- service_role/BYPASSRLS callers (value_registry.sql §config_value). This makes
      -- future ORG.* tokens (LEGAL_IDENTITY, INVOICE_DUE_DAYS, CANCELLATION_NOTICE_
      -- HOURS, TERMINATION_NOTICE_DAYS, …) seed-only: no resolver migration needed.
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
          ELSE '' END;
      ELSE
        v_val := '';  -- no transaction yet → blank
      END IF;

    ELSE
      v_fn := NULL; v_ph := NULL; v_em := NULL; v_ad := NULL; v_ti := NULL; v_re := NULL;
      SELECT c.full_name, c.phone, c.email, c.address_composed, ep.title, ep.relationship
        INTO v_fn, v_ph, v_em, v_ad, v_ti, v_re
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

COMMENT ON FUNCTION generate_document(uuid, text) IS
  'Phase 3 merge engine (resolver v5, Contracts Legal Pass): config read scoped to the ENGAGEMENT''s org (v_eng.org_id); {{FHE.*}} is a literal alias of {{ORG.*}}; ORG typed arms + GENERIC config_values ns ORG EAV fallback (seed-only ORG.* tokens, e.g. LEGAL_IDENTITY); HORSE vet/farrier fields; any other namespace resolves as a party_role (incl. EMERGENCY_CONTACT). {{SIG.*}} left for signing.';

-- ============================================================
-- 6. Documentation-only global dictionary rows (template_id NULL rows are never
--    merged by the per-template loop, §6) + config_keys whitelist rows (anti-typo
--    guard). All additive/idempotent; the global namespace SET is unchanged.
-- ============================================================
INSERT INTO template_tokens (namespace, field, token, kind, source_table, source_column, computed, required, party_scoped, notes) VALUES
  ('ORG','LEGAL_NAME',                '{{ORG.LEGAL_NAME}}',                'field', 'business_config','legal_entity_name', true, false, false, 'trade name; ORG twin of {{FHE.LEGAL_NAME}} — bodies use ORG.* as of the Contracts Legal Pass'),
  ('ORG','SIGNATORY_NAME',            '{{ORG.SIGNATORY_NAME}}',            'field', 'business_config','signatory_name',    true, false, false, 'ORG twin of {{FHE.SIGNATORY_NAME}}'),
  ('ORG','SIGNATORY_TITLE',           '{{ORG.SIGNATORY_TITLE}}',           'field', 'business_config','signatory_title',   true, false, false, 'ORG twin of {{FHE.SIGNATORY_TITLE}}'),
  ('ORG','ADDRESS',                   '{{ORG.ADDRESS}}',                   'field', 'business_config','business_address',  true, false, false, 'ORG twin of {{FHE.ADDRESS}}; blank until owner discloses'),
  ('ORG','LEGAL_IDENTITY',            '{{ORG.LEGAL_IDENTITY}}',            'field', 'config_values','value_text', true, false, false, 'full legal identity clause for party blocks — config_values ns ORG key LEGAL_IDENTITY (EAV, NOT a typed column); attorney wording pending'),
  ('ORG','ENTITY_FORMATION',          '{{ORG.ENTITY_FORMATION}}',          'field', 'business_config','entity_formation', true, false, false, 'e.g. Sole proprietorship (California)'),
  ('ORG','REGISTERED_AGENT',          '{{ORG.REGISTERED_AGENT}}',          'field', 'business_config','registered_agent', true, false, false, NULL),
  ('ORG','CANCELLATION_FEE',          '{{ORG.CANCELLATION_FEE}}',          'field', 'business_config','cancellation_fee', true, false, false, 'fmt_money; blank until owner supplies'),
  ('ORG','LATE_FEE',                  '{{ORG.LATE_FEE}}',                  'field', 'business_config','late_fee',         true, false, false, 'fmt_money; blank until owner supplies'),
  ('ORG','NO_SHOW_FEE',               '{{ORG.NO_SHOW_FEE}}',               'field', 'business_config','no_show_fee',      true, false, false, 'fmt_money; blank until owner supplies'),
  ('ORG','INVOICE_DUE_DAYS',          '{{ORG.INVOICE_DUE_DAYS}}',          'field', 'config_values','value_num', true, false, false, 'generic ORG EAV fallback; UNSEEDED — owner fills'),
  ('ORG','CANCELLATION_NOTICE_HOURS', '{{ORG.CANCELLATION_NOTICE_HOURS}}', 'field', 'config_values','value_num', true, false, false, 'generic ORG EAV fallback; UNSEEDED — owner fills'),
  ('ORG','TERMINATION_NOTICE_DAYS',   '{{ORG.TERMINATION_NOTICE_DAYS}}',   'field', 'config_values','value_num', true, false, false, 'generic ORG EAV fallback; UNSEEDED — owner fills'),
  ('HORSE','VET_NAME',                '{{HORSE.VET_NAME}}',                'field', 'horses','vet_name',      false, false, false, 'primary veterinarian (Contracts Legal Pass)'),
  ('HORSE','VET_PHONE',               '{{HORSE.VET_PHONE}}',               'field', 'horses','vet_phone',     false, false, false, NULL),
  ('HORSE','FARRIER_NAME',            '{{HORSE.FARRIER_NAME}}',            'field', 'horses','farrier_name',  false, false, false, NULL),
  ('HORSE','FARRIER_PHONE',           '{{HORSE.FARRIER_PHONE}}',           'field', 'horses','farrier_phone', false, false, false, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO config_keys (namespace, key, expected_type, required, description) VALUES
  ('ORG','LEGAL_IDENTITY',            'text', false, 'Full legal identity clause for contract party blocks (EAV: config_values ns ORG) — attorney wording pending'),
  ('ORG','ENTITY_FORMATION',          'text', false, 'Entity formation (typed: business_config.entity_formation)'),
  ('ORG','REGISTERED_AGENT',          'text', false, 'Registered agent (typed: business_config.registered_agent)'),
  ('ORG','INVOICE_DUE_DAYS',          'num',  false, 'Invoice due window in days (EAV; UNSEEDED — owner fills)'),
  ('ORG','CANCELLATION_NOTICE_HOURS', 'num',  false, 'Cancellation notice in hours (EAV; UNSEEDED — owner fills)'),
  ('ORG','TERMINATION_NOTICE_DAYS',   'num',  false, 'Termination written-notice window in days (EAV; UNSEEDED — owner fills)')
ON CONFLICT (namespace, key) DO NOTHING;
