/*
  # TASK-FACILITYTERM — the tenant's word for their own operation (U16)

  Internal term settled as `property` (never rendered) — `facility` was the task's
  own suggestion but collides with the EXISTING `Facility`/`facilities` boarding
  entity (a physical structure with stalls, U11 mod.boarding), and `site` collides
  with "the public marketing website" elsewhere in the codebase. `property` has
  neither collision and is not one of the tenant-facing word choices below.

  ADDITIVE, mirrors the U3 value-registry seam exactly (PLATFORM_ARCHITECTURE §5):
    - property_terms   : GLOBAL lookup of the picker's word list — the grammar
                          shape per word (term/article/plural/preposition), not
                          just a bare noun (a single noun substitution breaks on
                          plural-form words like "stables"/"grounds" — see the
                          task doc's grammar table). World-readable, SUPER_ADMIN-
                          write, so extending the list later ("possibly others" —
                          the owner's own words) is a data change (INSERT a row),
                          never a code change or a redeploy.
    - config_values ns 'PROPERTY' key 'TERM_KEY' : the org's selection, an EAV row
                          exactly like BRAND/CONTACT keys — set at provisioning,
                          editable after in the branding settings surface, via the
                          SAME upsertConfigValue() seam already live for BRAND.
    - resolve_property_term(org) : the single resolution seam (mirrors
                          config_value()) — org's TERM_KEY -> property_terms row,
                          falling back to FACILITY (neutral, never wrong, just
                          bland) when unset or the key doesn't match a live row.
    - my_property_term() : the authenticated-member seam (mirrors my_modules()) —
                          BrandProvider today only refreshes per-tenant config for
                          the anon/public slug path (org_public_config); the
                          signed-in app has never had a per-tenant config fetch of
                          its own, always rendering the hardcoded FHE constant.
                          Verification item 3 ("switching an org's term changes
                          every surface with no code change and no redeploy")
                          requires the authenticated app to resolve it too, so this
                          RPC closes that gap the same way my_modules() closed it
                          for module gating.
    - org_public_config(slug) reissued (CREATE OR REPLACE, U3's own pattern) to add
                          a `property` key alongside `brand`/`modules`/`pricing`,
                          for the anon/public marketing-site path.

  Seeds the picker with exactly the 5 words the owner named (barn, ranch, stables,
  grounds, facility) — nothing invented — and sets FHE's own org to RANCH per the
  owner's sentence ("FHE is a stable at a ranch, not a barn"). FHE is the only org
  predating this feature, so it needs its term SET, not left to inherit the
  generic FACILITY fallback.
*/

-- ============================================================
-- property_terms — GLOBAL picker word list + grammar shape (data-driven; adding
-- a word later is an INSERT, never a code change).
-- ============================================================
CREATE TABLE IF NOT EXISTS property_terms (
  key         text PRIMARY KEY,
  term        text NOT NULL,
  article     text NOT NULL DEFAULT 'the',
  plural      boolean NOT NULL DEFAULT false,
  preposition text NOT NULL DEFAULT 'at',
  active      boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0
);

ALTER TABLE property_terms ENABLE ROW LEVEL SECURITY;

-- Picker list is platform-owned: world-readable (the picker itself is client-
-- rendered on the provisioning wizard + settings surface), SUPER_ADMIN-write —
-- same posture as config_keys.
DROP POLICY IF EXISTS property_terms_read ON property_terms;
CREATE POLICY property_terms_read ON property_terms
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS property_terms_super_write ON property_terms;
CREATE POLICY property_terms_super_write ON property_terms
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

INSERT INTO property_terms (key, term, article, plural, preposition, sort_order) VALUES
  ('BARN',     'barn',     'the', false, 'at', 1),
  ('RANCH',    'ranch',    'the', false, 'at', 2),
  ('STABLES',  'stables',  'the', true,  'at', 3),
  ('GROUNDS',  'grounds',  'the', true,  'on', 4),
  ('FACILITY', 'facility', 'the', false, 'at', 5)
ON CONFLICT (key) DO NOTHING;

-- Register the selection key in the anti-typo whitelist alongside BRAND/CONTACT/ORG.
INSERT INTO config_keys (namespace, key, expected_type, required, description) VALUES
  ('PROPERTY', 'TERM_KEY', 'text', false, 'Selected property_terms.key — the tenant''s own word for their facility (fallback: FACILITY)')
ON CONFLICT (namespace, key) DO NOTHING;

-- ============================================================
-- resolve_property_term(org) — the single resolution seam (mirrors config_value()).
-- Always returns a complete shape: unset / unknown key both fall back to FACILITY,
-- so a caller never has to null-check article/plural/preposition.
-- ============================================================
CREATE OR REPLACE FUNCTION resolve_property_term(p_org uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_key text;
  v_row property_terms%ROWTYPE;
BEGIN
  SELECT cv.value_text INTO v_key
    FROM config_values cv
    WHERE cv.org_id = p_org AND cv.namespace = 'PROPERTY' AND cv.key = 'TERM_KEY';

  SELECT * INTO v_row FROM property_terms WHERE key = COALESCE(v_key, 'FACILITY') AND active;
  IF NOT FOUND THEN
    SELECT * INTO v_row FROM property_terms WHERE key = 'FACILITY';
  END IF;

  RETURN jsonb_build_object(
    'key',         v_row.key,
    'term',        v_row.term,
    'article',     v_row.article,
    'plural',      v_row.plural,
    'preposition', v_row.preposition
  );
END;
$$;

-- ============================================================
-- my_property_term() — the authenticated-member seam (mirrors my_modules()).
-- Closes the gap: BrandProvider's per-tenant fetch today only reaches the anon
-- public slug path, never the signed-in app.
-- ============================================================
CREATE OR REPLACE FUNCTION my_property_term()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT resolve_property_term(current_org());
$$;

COMMENT ON FUNCTION my_property_term() IS
  'U16 seam: the CURRENT caller''s own tenant''s property-term shape (term/article/plural/preposition), read past config_values RLS so a plain USER member can resolve it for UI copy. current_org()-scoped; never crosses tenants.';

GRANT EXECUTE ON FUNCTION my_property_term() TO authenticated, service_role;

-- ============================================================
-- org_public_config(slug) reissued — adds `property` alongside brand/modules/
-- pricing for the anon/public marketing-site path. Everything else unchanged.
-- ============================================================
CREATE OR REPLACE FUNCTION org_public_config(p_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE
  v_org      uuid;
  v_brand    jsonb;
  v_contact  jsonb;
  v_property jsonb;
  v_modules  jsonb := '[]'::jsonb;
  v_pricing  jsonb := '[]'::jsonb;
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

  -- Property term: always a complete shape (resolve_property_term falls back to
  -- FACILITY), so the public site never renders a bare/undefined noun.
  v_property := resolve_property_term(v_org);

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
    'property', v_property,
    'modules',  v_modules,
    'pricing',  v_pricing
  );
END;
$$;

-- org_public_config is the anon public entry point.
GRANT EXECUTE ON FUNCTION org_public_config(text) TO anon, authenticated, service_role;

-- ============================================================
-- provision_tenant() reissued — extends the p_brand key-prefix router (§9) with a
-- PROPERTY. prefix, so the provisioning wizard's term picker lands in config_values
-- ns 'PROPERTY' exactly like BRAND./CONTACT./MODULE.<mod>. do today. Everything
-- else in the function is byte-for-byte unchanged from the U6 original
-- (20260630050000_provision_tenant.sql).
-- ============================================================
CREATE OR REPLACE FUNCTION provision_tenant(
  p_name        text,
  p_slug        text,
  p_tier_key    text,
  p_admin_email text,
  p_admin_user_id uuid DEFAULT NULL,   -- the /api layer's find-or-created auth user
  p_brand       jsonb   DEFAULT '{}'::jsonb,
  p_legal       jsonb   DEFAULT '{}'::jsonb,
  p_rates       jsonb   DEFAULT '{}'::jsonb,
  p_modules     text[]  DEFAULT NULL   -- explicit add-ons beyond the tier
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_org       uuid;
  v_template  uuid;   -- the operator/template org (tenant #1) whose catalog we clone
  v_barn_payer uuid;
  r           record;
BEGIN
  -- SUPER_ADMIN only — platform provisioning is a platform-owner path (§9).
  -- `IS NOT TRUE` (not `NOT …`) so anon/outsider (is_super_admin() → NULL) is denied,
  -- not silently admitted by NULL propagation.
  IF is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'provision_tenant is restricted to SUPER_ADMIN'
      USING errcode = 'insufficient_privilege';
  END IF;

  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'provision_tenant requires a non-empty slug';
  END IF;
  IF p_tier_key IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM tiers WHERE tier_key = p_tier_key) THEN
    RAISE EXCEPTION 'unknown tier: %', p_tier_key;
  END IF;

  -- ------------------------------------------------------------
  -- 1. Create org. slug is UNIQUE (mig 24); a duplicate raises here and the WHOLE
  --    function rolls back — atomic, no partial tenant. The ORG- display code is set
  --    by the existing organizations_set_code trigger.
  -- ------------------------------------------------------------
  INSERT INTO organizations (name, slug, status)
    VALUES (p_name, p_slug, 'ACTIVE')
    RETURNING id INTO v_org;

  -- Resolve to the new tenant BEFORE any user exists: every DEFAULT current_org() and
  -- boundary check below now stamps v_org (auth.uid() IS NULL in this DEFINER context
  -- for the seed/service caller → current_org() reads the app.current_org GUC).
  PERFORM set_config('app.current_org', v_org::text, true);  -- SET LOCAL (txn-scoped)

  -- The template org whose default catalog we clone (the operator's own, tenant #1).
  SELECT id INTO v_template FROM organizations
    WHERE id <> v_org ORDER BY created_at LIMIT 1;

  -- ------------------------------------------------------------
  -- 2. Seed the value registry.
  --    business_config typed row (legal + rates); config_values BRAND/CONTACT + knobs.
  --    Every value nullable/overridable, so an unfinished tenant still boots.
  -- ------------------------------------------------------------
  INSERT INTO business_config (
    org_id,
    legal_entity_name, entity_formation, registered_agent,
    signatory_name, signatory_title, business_address,
    commission_purchase_rate, commission_sale_rate, commission_lease_rate, commission_min,
    cancellation_fee, late_fee, no_show_fee,
    protection_period, sales_tax_rate, document_retention, esignature_provider
  ) VALUES (
    v_org,
    NULLIF(p_legal->>'LEGAL_NAME',''),
    NULLIF(p_legal->>'ENTITY_FORMATION',''),
    NULLIF(p_legal->>'REGISTERED_AGENT',''),
    NULLIF(p_legal->>'SIGNATORY_NAME',''),
    NULLIF(p_legal->>'SIGNATORY_TITLE',''),
    NULLIF(p_legal->>'ADDRESS',''),
    (p_rates->>'COMMISSION_PURCHASE_RATE')::numeric,
    (p_rates->>'COMMISSION_SALE_RATE')::numeric,
    (p_rates->>'COMMISSION_LEASE_RATE')::numeric,
    (p_rates->>'COMMISSION_MIN')::numeric,
    (p_rates->>'CANCELLATION_FEE')::numeric,
    (p_rates->>'LATE_FEE')::numeric,
    (p_rates->>'NO_SHOW_FEE')::numeric,
    NULLIF(p_legal->>'PROTECTION_PERIOD',''),
    (p_rates->>'SALES_TAX_RATE')::numeric,
    NULLIF(p_legal->>'DOCUMENT_RETENTION',''),
    NULLIF(p_legal->>'ESIGN_PROVIDER','')
  );

  -- Brand + contact + property + module knobs from p_brand. Keys prefixed
  -- BRAND./CONTACT./PROPERTY./MODULE.<mod>. route to the matching namespace; a
  -- bare key defaults to BRAND.
  FOR r IN SELECT key, value FROM jsonb_each_text(COALESCE(p_brand, '{}'::jsonb)) LOOP
    INSERT INTO config_values (org_id, namespace, key, value_text, category)
    VALUES (
      v_org,
      CASE
        WHEN r.key LIKE 'CONTACT.%'  THEN 'CONTACT'
        WHEN r.key LIKE 'BRAND.%'    THEN 'BRAND'
        WHEN r.key LIKE 'PROPERTY.%' THEN 'PROPERTY'
        WHEN r.key LIKE 'MODULE.%'   THEN split_part(r.key, '.', 2)
        ELSE 'BRAND'
      END,
      CASE
        WHEN r.key LIKE 'CONTACT.%'  THEN substr(r.key, length('CONTACT.') + 1)
        WHEN r.key LIKE 'BRAND.%'    THEN substr(r.key, length('BRAND.') + 1)
        WHEN r.key LIKE 'PROPERTY.%' THEN substr(r.key, length('PROPERTY.') + 1)
        WHEN r.key LIKE 'MODULE.%'   THEN substr(r.key, length('MODULE.') + length(split_part(r.key,'.',2)) + 2)
        ELSE r.key
      END,
      r.value,
      CASE
        WHEN r.key LIKE 'CONTACT.%'  THEN 'contact'
        WHEN r.key LIKE 'PROPERTY.%' THEN 'property'
        WHEN r.key LIKE 'MODULE.%'   THEN 'module_config'
        ELSE 'branding'
      END
    )
    ON CONFLICT (org_id, namespace, key) DO UPDATE SET value_text = EXCLUDED.value_text;
  END LOOP;

  -- ------------------------------------------------------------
  -- 3. Seed entitlements: expand the tier (via tier_modules) + explicit add-ons into
  --    org_modules so has_module() lights up exactly the paid surfaces.
  -- ------------------------------------------------------------
  IF p_tier_key IS NOT NULL THEN
    INSERT INTO org_modules (org_id, module_key, enabled, source)
    SELECT v_org, tm.module_key, true, 'TIER'
      FROM tier_modules tm
      WHERE tm.tier_key = p_tier_key
    ON CONFLICT (org_id, module_key) DO NOTHING;
  END IF;

  IF p_modules IS NOT NULL THEN
    INSERT INTO org_modules (org_id, module_key, enabled, source)
    SELECT v_org, m.module_key, true, 'ADDON'
      FROM unnest(p_modules) AS m(module_key)
      WHERE EXISTS (SELECT 1 FROM modules mm WHERE mm.module_key = m.module_key)
    ON CONFLICT (org_id, module_key) DO NOTHING;
  END IF;

  -- ------------------------------------------------------------
  -- 4. Clone the tier's default catalog: copy the template org's active products
  --    (+ their current price rows) whose module_key is core (NULL) or in the new
  --    tenant's granted module set, into v_org. A no-op when the template has no
  --    seeded catalog; wires the real path so a seeded default catalog flows through.
  -- ------------------------------------------------------------
  IF v_template IS NOT NULL THEN
    FOR r IN
      SELECT p.id, p.product_key, p.name, p.service_type, p.module_key, p.price_value_key, p.active
        FROM products p
        WHERE p.org_id = v_template
          AND p.deleted_at IS NULL
          AND (
            p.module_key IS NULL
            OR EXISTS (SELECT 1 FROM org_modules om
                        WHERE om.org_id = v_org AND om.module_key = p.module_key AND om.enabled)
          )
    LOOP
      WITH new_prod AS (
        INSERT INTO products (org_id, product_key, name, service_type, module_key, price_value_key, active)
        VALUES (v_org, r.product_key, r.name, r.service_type, r.module_key, r.price_value_key, r.active)
        ON CONFLICT (org_id, product_key) DO NOTHING
        RETURNING id
      )
      INSERT INTO product_prices (org_id, product_id, amount, effective_from, effective_to)
      SELECT v_org, np.id, pp.amount, now(), NULL
        FROM new_prod np
        JOIN LATERAL (
          SELECT amount FROM product_prices
            WHERE product_id = r.id AND deleted_at IS NULL
              AND effective_from <= now()
              AND (effective_to IS NULL OR effective_to > now())
            ORDER BY effective_from DESC LIMIT 1
        ) pp ON true;
    END LOOP;
  END IF;

  -- ------------------------------------------------------------
  -- 5. First ADMIN. The /api layer find-or-creates the auth user (idempotent by
  --    email); here we bind the tenant ADMIN profile. The profiles->contact trigger
  --    binds identity. Skipped when no auth user id is supplied (assisted onboarding
  --    can attach the admin later); the tenant still boots. Done BEFORE the barnops
  --    starter so the admin's contact can serve as the barn/default payer.
  -- ------------------------------------------------------------
  IF p_admin_user_id IS NOT NULL THEN
    INSERT INTO profiles (user_id, email, role, org_id)
    VALUES (p_admin_user_id, p_admin_email, 'ADMIN', v_org)
    ON CONFLICT (user_id) DO UPDATE SET role = 'ADMIN', org_id = v_org;
    -- the profiles->contact trigger bound a contact; resolve it as the barn payer.
    SELECT contact_id INTO v_barn_payer FROM profiles WHERE user_id = p_admin_user_id;
  END IF;

  -- Barn-ops starter: a SINGLE default/barn-scoped cost_allocation_rules fallback (NOT
  -- a per-horse "100% owner" override — the split derives from horse_parties, §7.7).
  -- Deferred/conditional: only when the mod.barnops table already exists (U11 shipped)
  -- AND the tenant has barnops AND a barn payer contact is resolvable (the column is
  -- NOT NULL). This lets U6 apply and green BEFORE U11 exists, and skips cleanly when
  -- no admin contact anchors the barn payer (the resolver still routes uncovered
  -- remainder to an explicit default line at billing time — §7.7).
  IF v_barn_payer IS NOT NULL
     AND to_regclass('public.cost_allocation_rules') IS NOT NULL
     AND EXISTS (SELECT 1 FROM org_modules om
                  WHERE om.org_id = v_org AND om.module_key = 'mod.barnops' AND om.enabled) THEN
    EXECUTE
      'INSERT INTO cost_allocation_rules (org_id, scope, scope_id, payer_contact_id, share_pct, effective_from) '
      'VALUES ($1, ''default'', NULL, $2, 100, now())'
      USING v_org, v_barn_payer;
  END IF;

  -- ------------------------------------------------------------
  -- 6. Audit PROVISION_TENANT + return. The organizations INSERT already emits an
  --    audit row (action INSERT, table organizations); this explicit marker records
  --    the provisioning action itself (SECURITY DEFINER writes past audit_logs RLS).
  --    action stays within the mig-6 CHECK (INSERT); table_name carries the semantic.
  -- ------------------------------------------------------------
  INSERT INTO audit_logs (actor_user_id, action, table_name, record_id, new_value)
  VALUES (
    auth.uid(), 'INSERT', 'provision_tenant', v_org,
    jsonb_build_object('event', 'PROVISION_TENANT', 'org_id', v_org,
                       'slug', p_slug, 'tier_key', p_tier_key,
                       'modules', COALESCE(p_modules, ARRAY[]::text[]))
  );

  RETURN v_org;
END;
$fn$;

COMMENT ON FUNCTION provision_tenant(text, text, text, text, uuid, jsonb, jsonb, jsonb, text[]) IS
  'U6: the single blessed SUPER_ADMIN-only push-button tenant provisioning path (org + registry + entitlements + cloned catalog + first ADMIN), one atomic transaction. §9. Extended U16: p_brand PROPERTY. prefix routes to config_values ns PROPERTY.';

-- provision_tenant is SUPER_ADMIN-gated inside the function; only real callers are
-- the /api layer (service_role) and a platform SUPER_ADMIN. Keep the default grants
-- (harness/service) but the is_super_admin() guard is the real fence.
GRANT EXECUTE ON FUNCTION provision_tenant(text, text, text, text, uuid, jsonb, jsonb, jsonb, text[])
  TO authenticated, service_role;

-- ============================================================
-- Set FHE's own org to RANCH — the only org predating this feature, and the
-- owner's own word ("FHE is a stable at a ranch, not a barn"). Idempotent;
-- scoped to the first org exactly like the U3 BRAND/CONTACT seed above.
-- ============================================================
DO $$
DECLARE v_org uuid;
BEGIN
  SELECT id INTO v_org FROM organizations ORDER BY created_at LIMIT 1;
  IF v_org IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO config_values (org_id, namespace, key, value_text, category) VALUES
    (v_org, 'PROPERTY', 'TERM_KEY', 'RANCH', 'property')
  ON CONFLICT (org_id, namespace, key) DO UPDATE SET value_text = EXCLUDED.value_text;
END $$;
