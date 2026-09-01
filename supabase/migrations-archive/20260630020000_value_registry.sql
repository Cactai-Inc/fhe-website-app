/*
  # FHE Suite — Global Value Registry (U3, migration 29)  — module core.registry

  ADDITIVE. Adds the EAV long-tail beside the typed business_config (which STAYS a
  table, PLATFORM_ARCHITECTURE section 5.1). Nothing existing is rewritten.

    - config_values  : per-org EAV registry (the open-ended long tail — brand,
                       contact, per-module knobs, per-product add-on prices).
                       Carries seam 1 (org boundary, RESTRICTIVE) + seam 3 (access);
                       NEVER a module_gate (it is entitlement/registry substrate the
                       gate itself reads — section 2, section 4.1). Audited.
    - config_keys    : the GLOBAL whitelist of allowed (namespace, key) pairs and
                       their expected_type — the anti-typo guard (section 5.1). A
                       go-live completeness check flags required-but-unset keys.

    - config_value(ns,key)     : the single resolution seam (section 5.2). STABLE
                                 SECURITY DEFINER, search_path-pinned. Prefers the
                                 typed business_config column when (ns,key) maps to
                                 one, else reads config_values; always current_org()-
                                 scoped. Reads its substrate PAST RLS so it never
                                 recurses when called from a policy / SECURITY INVOKER
                                 RPC (exactly the current_org()/has_module() posture).
    - org_public_config(slug)  : the ANON public-exposure seam (section 5.2).
                                 Resolves slug -> org and returns ONLY brand + active
                                 public module list + public pricing for that
                                 addressed tenant. Financial/legal internals
                                 (commission, retention, e-sign, tax) NEVER cross to
                                 anon.
    - config_required_missing(org) : the go-live completeness check — required
                                 config_keys with no value set for a tenant.

  Also re-issues generate_document (CREATE OR REPLACE, extending the U1 body — every
  TXN money arm and the {{ORG.*}}/{{FHE.*}} alias preserved) to wire the
  {{ORG.PHONE/EMAIL/URL}} + {{FHE.PHONE/EMAIL/URL}} arms through config_values ns
  CONTACT (born here) — the deferred half of the U1 de-specification (section 6.2).
  The config read keys off the ENGAGEMENT's org (v_eng.org_id), not current_org()/
  LIMIT 1 (the isolation fix). No contract body is edited; unmerged global dictionary
  rows never reach the per-template merge loop, so this stays green (section 6.2, 6.3).

  Seeds config_keys (the whitelist) and FHE (tenant #1) BRAND / CONTACT rows from
  the src/lib/brand.ts values.
*/

-- ============================================================
-- config_keys — GLOBAL whitelist of allowed keys (anti-typo guard)
-- No org_id (a lookup/enum table; in the section-4.3 intended-global allow-list).
-- ============================================================
CREATE TABLE IF NOT EXISTS config_keys (
  namespace     text NOT NULL,
  key           text NOT NULL,
  expected_type text NOT NULL CHECK (expected_type IN ('text','num','json')),
  required      boolean NOT NULL DEFAULT false,
  description   text,
  PRIMARY KEY (namespace, key)
);

-- config_keys is a platform-owned lookup: world-readable, SUPER_ADMIN-write.
ALTER TABLE config_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS config_keys_read ON config_keys;
CREATE POLICY config_keys_read ON config_keys
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS config_keys_super_write ON config_keys;
CREATE POLICY config_keys_super_write ON config_keys
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- ============================================================
-- config_values — per-org EAV long-tail registry
-- ============================================================
CREATE TABLE IF NOT EXISTS config_values (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  namespace      text NOT NULL,
  key            text NOT NULL,
  value_text     text,
  value_num      numeric,
  value_json     jsonb,
  category       text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, namespace, key)
);

CREATE INDEX IF NOT EXISTS config_values_org_ns_key_idx ON config_values (org_id, namespace, key);
CREATE INDEX IF NOT EXISTS config_values_org_idx ON config_values (org_id);

DROP TRIGGER IF EXISTS config_values_set_updated_at ON config_values;
CREATE TRIGGER config_values_set_updated_at BEFORE UPDATE ON config_values
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Audit (config drives contracts/receipts/pages) — reuse the migration-13 trigger.
-- (U14 is the canonical audit-attachment site; this table needs it before U14 for
-- its own audit test, and DROP TRIGGER IF EXISTS makes a later re-attach a no-op.)
DROP TRIGGER IF EXISTS audit_config_values ON config_values;
CREATE TRIGGER audit_config_values AFTER INSERT OR UPDATE OR DELETE ON config_values
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ------------------------------------------------------------
-- RLS — seam 1 (org boundary, RESTRICTIVE) + seam 3 (access, PERMISSIVE).
-- NO module_gate (substrate rule, section 2 / section 4.1).
-- ------------------------------------------------------------
ALTER TABLE config_values ENABLE ROW LEVEL SECURITY;

-- seam 1: the tenant boundary — RESTRICTIVE, ANDs with everything below.
DROP POLICY IF EXISTS config_values_org_boundary ON config_values;
CREATE POLICY config_values_org_boundary ON config_values AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- seam 3: within the tenant, staff manage config; all members may read their org's
-- config (brand/contact are non-sensitive; the sensitive financial/legal values
-- live in business_config, which stays admin-only).
DROP POLICY IF EXISTS config_values_read ON config_values;
CREATE POLICY config_values_read ON config_values
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS config_values_staff_write ON config_values;
CREATE POLICY config_values_staff_write ON config_values
  FOR ALL TO authenticated
  USING (has_staff_access()) WITH CHECK (has_staff_access());

-- ============================================================
-- config_value(ns, key) — the single resolution seam (section 5.2)
-- Prefers the typed business_config column when the (ns,key) maps to one; else the
-- config_values row; always scoped to current_org(). SECURITY DEFINER + STABLE +
-- search_path-pinned: reads substrate past RLS, so a call from a policy / SECURITY
-- INVOKER RPC never recurses.
-- ============================================================
CREATE OR REPLACE FUNCTION config_value(p_ns text, p_key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_org uuid := current_org();
  v_cfg business_config%ROWTYPE;
  v_val text;
BEGIN
  IF v_org IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1) Typed business_config takes precedence for the settled financial/legal
  --    identity fields (single source of truth — do not duplicate into EAV).
  SELECT * INTO v_cfg FROM business_config WHERE org_id = v_org;
  IF FOUND AND p_ns = 'ORG' THEN
    v_val := CASE p_key
      WHEN 'LEGAL_NAME'       THEN v_cfg.legal_entity_name
      WHEN 'SIGNATORY_NAME'   THEN v_cfg.signatory_name
      WHEN 'SIGNATORY_TITLE'  THEN v_cfg.signatory_title
      WHEN 'ENTITY_FORMATION' THEN v_cfg.entity_formation
      WHEN 'REGISTERED_AGENT' THEN v_cfg.registered_agent
      WHEN 'ADDRESS'          THEN v_cfg.business_address
      ELSE NULL END;
    IF v_val IS NOT NULL THEN
      RETURN v_val;
    END IF;
  END IF;

  -- 2) Else the EAV config_values row for this tenant. Coalesce the typed value
  --    columns in text/num/json order.
  SELECT COALESCE(
           cv.value_text,
           CASE WHEN cv.value_num IS NOT NULL THEN cv.value_num::text END,
           CASE WHEN cv.value_json IS NOT NULL THEN cv.value_json #>> '{}' END
         )
    INTO v_val
    FROM config_values cv
    WHERE cv.org_id = v_org AND cv.namespace = p_ns AND cv.key = p_key;

  RETURN v_val;  -- NULL when unset (the go-live check flags required-but-unset)
END;
$$;

-- ============================================================
-- org_public_config(slug) — the ANON public-exposure seam (section 5.2)
-- Resolves slug -> org and returns ONLY brand + active public modules + public
-- pricing for that ADDRESSED tenant. No current_org() (anon has none). NEVER
-- exposes commission/retention/e-sign/tax or any business_config internal.
-- ============================================================
CREATE OR REPLACE FUNCTION org_public_config(p_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_org     uuid;
  v_brand   jsonb;
  v_contact jsonb;
  v_modules jsonb := '[]'::jsonb;
  v_pricing jsonb := '[]'::jsonb;
BEGIN
  SELECT id INTO v_org FROM organizations
    WHERE slug = p_slug AND status = 'ACTIVE' AND deleted_at IS NULL;
  IF v_org IS NULL THEN
    RETURN NULL;  -- unknown / inactive tenant
  END IF;

  -- Brand: the config_values ns 'BRAND' rows for this tenant, as a flat object.
  SELECT COALESCE(
           jsonb_object_agg(cv.key, COALESCE(
             cv.value_text,
             CASE WHEN cv.value_num IS NOT NULL THEN cv.value_num::text END,
             CASE WHEN cv.value_json IS NOT NULL THEN cv.value_json #>> '{}' END)),
           '{}'::jsonb)
    INTO v_brand
    FROM config_values cv
    WHERE cv.org_id = v_org AND cv.namespace = 'BRAND';

  -- Contact (public-safe: phone/email/url only), keyed CONTACT_<KEY>.
  SELECT COALESCE(
           jsonb_object_agg('CONTACT_' || cv.key, cv.value_text),
           '{}'::jsonb)
    INTO v_contact
    FROM config_values cv
    WHERE cv.org_id = v_org AND cv.namespace = 'CONTACT'
      AND cv.key IN ('PHONE','EMAIL','URL');

  v_brand := v_brand || v_contact;

  -- Active PUBLIC module list — only when the entitlement substrate exists (U2).
  -- Guarded so U3 applies and tests green whether or not U2 has shipped yet.
  IF to_regclass('public.org_modules') IS NOT NULL
     AND to_regclass('public.modules') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COALESCE(jsonb_agg(om.module_key ORDER BY om.module_key), '[]'::jsonb)
        FROM org_modules om
        JOIN modules m ON m.module_key = om.module_key
        WHERE om.org_id = $1
          AND om.enabled
          AND (om.expires_at IS NULL OR om.expires_at > now())
          AND COALESCE(m.active, true)
    $q$ INTO v_modules USING v_org;
  END IF;

  -- Public pricing — only when the per-org products/product_prices exist (U5).
  -- Guarded so U3 applies and tests green whether or not U5 has shipped yet. Only
  -- active products at the current effective price; NO commission/retention/e-sign.
  IF to_regclass('public.products') IS NOT NULL
     AND to_regclass('public.product_prices') IS NOT NULL THEN
    EXECUTE $q$
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'product_key', p.product_key,
               'name', p.name,
               'amount', pp.amount) ORDER BY p.product_key), '[]'::jsonb)
        FROM products p
        JOIN LATERAL (
          SELECT amount FROM product_prices
            WHERE product_id = p.id
              AND effective_from <= now()
              AND (effective_to IS NULL OR effective_to > now())
            ORDER BY effective_from DESC LIMIT 1
        ) pp ON true
        WHERE p.org_id = $1 AND p.active
    $q$ INTO v_pricing USING v_org;
  END IF;

  RETURN jsonb_build_object(
    'org_id',   v_org,
    'slug',     p_slug,
    'brand',    v_brand,
    'modules',  v_modules,
    'pricing',  v_pricing
  );
END;
$$;

-- org_public_config is the anon public entry point.
GRANT EXECUTE ON FUNCTION org_public_config(text) TO anon, authenticated, service_role;

-- ============================================================
-- config_required_missing(org) — the go-live completeness check (section 5.1 / 13.3)
-- Returns the required config_keys that have NO value set for the tenant (either a
-- typed business_config column that resolves NULL, or a missing config_values row).
-- A required key that is unset is thereby DETECTABLE before go-live.
-- ============================================================
CREATE OR REPLACE FUNCTION config_required_missing(p_org uuid)
RETURNS TABLE (namespace text, key text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT ck.namespace, ck.key
    FROM config_keys ck
    WHERE ck.required
      AND NOT EXISTS (
        SELECT 1 FROM config_values cv
        WHERE cv.org_id = p_org AND cv.namespace = ck.namespace AND cv.key = ck.key
          AND (cv.value_text IS NOT NULL OR cv.value_num IS NOT NULL OR cv.value_json IS NOT NULL)
      )
      -- typed business_config-backed ORG.* keys count as set when the column is filled
      AND NOT (
        ck.namespace = 'ORG'
        AND EXISTS (
          SELECT 1 FROM business_config bc WHERE bc.org_id = p_org AND (
            (ck.key = 'LEGAL_NAME'      AND bc.legal_entity_name IS NOT NULL) OR
            (ck.key = 'SIGNATORY_NAME'  AND bc.signatory_name    IS NOT NULL) OR
            (ck.key = 'SIGNATORY_TITLE' AND bc.signatory_title   IS NOT NULL) OR
            (ck.key = 'ADDRESS'         AND bc.business_address   IS NOT NULL)
          )
        )
      );
END;
$$;

-- ============================================================
-- Seed config_keys — the allowed-key whitelist (section 5.3)
-- ============================================================
INSERT INTO config_keys (namespace, key, expected_type, required, description) VALUES
  ('BRAND',   'NAME',            'text', true,  'Full brand / trade name'),
  ('BRAND',   'SHORT_NAME',      'text', false, 'Short brand name / abbreviation'),
  ('BRAND',   'TAGLINE',         'text', false, 'One-line brand tagline'),
  ('BRAND',   'PRIMARY_COLOR',   'text', false, 'Primary brand color (hex)'),
  ('BRAND',   'SECONDARY_COLOR', 'text', false, 'Secondary brand color (hex)'),
  ('BRAND',   'LOGO_PATH',       'text', false, 'Storage path to the brand logo'),
  ('BRAND',   'LOCATION',        'text', false, 'Public location line'),
  ('CONTACT', 'EMAIL',           'text', true,  'Public contact email'),
  ('CONTACT', 'PHONE',           'text', true,  'Public contact phone'),
  ('CONTACT', 'URL',             'text', false, 'Public website URL'),
  ('ORG',     'LEGAL_NAME',      'text', true,  'Legal entity name (typed: business_config)'),
  ('ORG',     'SIGNATORY_NAME',  'text', false, 'Contract signatory name (typed: business_config)'),
  ('ORG',     'SIGNATORY_TITLE', 'text', false, 'Contract signatory title (typed: business_config)'),
  ('ORG',     'ADDRESS',         'text', false, 'Business mailing address (typed: business_config)')
ON CONFLICT (namespace, key) DO NOTHING;

-- ============================================================
-- Seed FHE (tenant #1) BRAND / CONTACT rows from src/lib/brand.ts.
-- Idempotent; scoped to the first org (the operator's own business). Seeded as
-- superuser (auth.uid() IS NULL), so org_id is set explicitly here rather than via
-- current_org() (which reads the GUC in that context).
-- ============================================================
DO $$
DECLARE v_org uuid;
BEGIN
  SELECT id INTO v_org FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RETURN;  -- no tenant seeded yet (shouldn't happen; migration 24 seeds one)
  END IF;

  INSERT INTO config_values (org_id, namespace, key, value_text, category) VALUES
    (v_org, 'BRAND',   'NAME',       'French Heritage Equestrian', 'branding'),
    (v_org, 'BRAND',   'SHORT_NAME', 'FHE',                        'branding'),
    (v_org, 'BRAND',   'TAGLINE',    'A family-run hunter/jumper barn and community, rooted in classical European horsemanship.', 'branding'),
    (v_org, 'BRAND',   'LOCATION',   'Carmel Creek Ranch · Coastal San Diego', 'branding'),
    (v_org, 'CONTACT', 'EMAIL',      'Hello@FHEquestrian.com',     'contact'),
    (v_org, 'CONTACT', 'PHONE',      '858-439-3614',               'contact'),
    (v_org, 'CONTACT', 'URL',        'www.frenchheritageequestrian.com', 'contact')
  ON CONFLICT (org_id, namespace, key) DO NOTHING;
END $$;

-- ============================================================
-- {{ORG.PHONE/EMAIL/URL}} + {{FHE.*}} alias global dictionary rows.
-- Documentation-only (template_id NULL global rows are never merged by the
-- per-template loop, section 6); ON CONFLICT DO NOTHING coexists with U1's rows.
-- ============================================================
INSERT INTO template_tokens (namespace, field, token, kind, source_table, source_column, computed, required, party_scoped, notes) VALUES
  ('ORG','PHONE','{{ORG.PHONE}}','field', 'config_values','value_text', true, false, false, 'public phone — config_values ns CONTACT key PHONE (U3)'),
  ('ORG','EMAIL','{{ORG.EMAIL}}','field', 'config_values','value_text', true, false, false, 'public email — config_values ns CONTACT key EMAIL (U3)'),
  ('ORG','URL','{{ORG.URL}}','field',     'config_values','value_text', true, false, false, 'public url — config_values ns CONTACT key URL (U3)'),
  ('FHE','PHONE','{{FHE.PHONE}}','field', 'config_values','value_text', true, false, false, 'alias of {{ORG.PHONE}} (U3)'),
  ('FHE','EMAIL','{{FHE.EMAIL}}','field', 'config_values','value_text', true, false, false, 'alias of {{ORG.EMAIL}} (U3)'),
  ('FHE','URL','{{FHE.URL}}','field',     'config_values','value_text', true, false, false, 'alias of {{ORG.URL}} (U3)')
ON CONFLICT DO NOTHING;

-- ============================================================
-- generate_document — CREATE OR REPLACE extending the U1 body: every existing arm
-- (HORSE / ENG / DOC / ORG+FHE / TXN / party) preserved; this wires the ORG/FHE
-- PHONE/EMAIL/URL arms to config_values ns CONTACT (born above). Config read keys
-- off the ENGAGEMENT's org (v_eng.org_id) — the isolation fix (section 6.1).
-- Self-contained: applies whether or not U1 shipped (identical read semantics on a
-- single-tenant harness, so generate_document.test.ts stays green).
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
        WHEN 'LEGAL_NAME'      THEN v_cfg.legal_entity_name
        WHEN 'SIGNATORY_NAME'  THEN v_cfg.signatory_name
        WHEN 'SIGNATORY_TITLE' THEN v_cfg.signatory_title
        WHEN 'ADDRESS'         THEN v_cfg.business_address
        WHEN 'BRAND_NAME'      THEN v_cfg.legal_entity_name
        WHEN 'PHONE'           THEN v_c_phone
        WHEN 'EMAIL'           THEN v_c_email
        WHEN 'URL'             THEN v_c_url
        ELSE '' END;
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
  'Phase 3 merge engine (Suite U3): config read scoped to the ENGAGEMENT''s org (v_eng.org_id); {{FHE.*}} is a literal alias of {{ORG.*}}; PHONE/EMAIL/URL resolve from config_values ns CONTACT. {{SIG.*}} left for signing.';
