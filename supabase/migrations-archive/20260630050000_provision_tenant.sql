/*
  # FHE Suite — provision_tenant() + set_org_module() (U6, migration 30)
  Module: core.tenancy.  Depends on U2 (org_modules/tier_modules/has_module),
  U3 (config_values/business_config seed + config_value), U5 (products to clone).

  Per PLATFORM_ARCHITECTURE.md §9: the single blessed push-button path to a new
  tenant. ONE SECURITY-DEFINER RPC, SUPER_ADMIN-only, running in ONE transaction so
  a tenant is either fully born or not at all (mirroring how create_purchase_engagement
  is the only path to a purchase). Personalization is entirely seeded registry rows;
  the code is identical across tenants.

  provision_tenant(p_name, p_slug, p_tier_key, p_admin_email,
                   p_brand jsonb, p_legal jsonb, p_rates jsonb, p_modules text[])
    RETURNS uuid  -- the new org_id

  Steps (all inside the function's implicit txn — any RAISE rolls the whole thing
  back, so there is never a partial tenant):
    1. INSERT organizations -> v_org, then SET LOCAL app.current_org = v_org so every
       DEFAULT current_org() / boundary check resolves to the new tenant BEFORE any
       user exists (the seed/service seam migration 26 built: current_org() falls back
       to the GUC when auth.uid() IS NULL).
    2. Seed the value registry: the per-org business_config typed row from p_legal +
       p_rates; config_values BRAND.* / CONTACT.* + module knobs from p_brand.
    3. Expand p_tier_key (via tier_modules) + p_modules into org_modules rows.
    4. Clone the tier's default products/product_prices into v_org (from the template
       org, tenant #1, filtered to the granted module set). A barnops-starter
       default/barn cost_allocation_rules fallback is seeded ONLY when that mod.barnops
       table already exists AND the tenant has barnops (conditional/deferred per §9
       step 4 — NEVER a per-horse "100% owner" override).
    5. First ADMIN: INSERT profiles(user_id, email, role='ADMIN', org_id=v_org) for a
       passed-in auth user id (the /api layer find-or-creates the auth user). The
       existing profiles->contact trigger binds identity.
    6. Audit PROVISION_TENANT + RETURN v_org.

  set_org_module(org, key, enabled, source) — the add-on / billing seam (§4.1): a
  SUPER_ADMIN / service_role upsert of a single org_modules entitlement row.
*/

-- ============================================================
-- provision_tenant() — the single blessed push-button provisioning path
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

  -- Brand + contact + module knobs from p_brand. Keys prefixed BRAND./CONTACT./
  -- MODULE.<mod>. route to the matching namespace; a bare key defaults to BRAND.
  FOR r IN SELECT key, value FROM jsonb_each_text(COALESCE(p_brand, '{}'::jsonb)) LOOP
    INSERT INTO config_values (org_id, namespace, key, value_text, category)
    VALUES (
      v_org,
      CASE
        WHEN r.key LIKE 'CONTACT.%' THEN 'CONTACT'
        WHEN r.key LIKE 'BRAND.%'   THEN 'BRAND'
        WHEN r.key LIKE 'MODULE.%'  THEN split_part(r.key, '.', 2)
        ELSE 'BRAND'
      END,
      CASE
        WHEN r.key LIKE 'CONTACT.%' THEN substr(r.key, length('CONTACT.') + 1)
        WHEN r.key LIKE 'BRAND.%'   THEN substr(r.key, length('BRAND.') + 1)
        WHEN r.key LIKE 'MODULE.%'  THEN substr(r.key, length('MODULE.') + length(split_part(r.key,'.',2)) + 2)
        ELSE r.key
      END,
      r.value,
      CASE
        WHEN r.key LIKE 'CONTACT.%' THEN 'contact'
        WHEN r.key LIKE 'MODULE.%'  THEN 'module_config'
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
  'U6: the single blessed SUPER_ADMIN-only push-button tenant provisioning path (org + registry + entitlements + cloned catalog + first ADMIN), one atomic transaction. §9.';

-- provision_tenant is SUPER_ADMIN-gated inside the function; only real callers are
-- the /api layer (service_role) and a platform SUPER_ADMIN. Keep the default grants
-- (harness/service) but the is_super_admin() guard is the real fence.
GRANT EXECUTE ON FUNCTION provision_tenant(text, text, text, text, uuid, jsonb, jsonb, jsonb, text[])
  TO authenticated, service_role;

-- ============================================================
-- set_org_module(org, key, enabled, source) — the add-on / billing seam (§4.1)
-- A SUPER_ADMIN / service_role upsert of one org_modules entitlement row. This is the
-- path an add-on purchase or a Stripe-webhook billing event uses to flip a module on
-- or off for a tenant, independent of the tier it was provisioned with.
-- ============================================================
CREATE OR REPLACE FUNCTION set_org_module(
  p_org     uuid,
  p_key     text,
  p_enabled boolean DEFAULT true,
  p_source  text    DEFAULT 'ADDON'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  -- Platform / billing path only. service_role (BYPASSRLS) has auth.uid() NULL and is
  -- not a SUPER_ADMIN profile, so allow it explicitly as the billing webhook caller.
  IF NOT is_super_admin() AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'set_org_module is restricted to SUPER_ADMIN / the billing service'
      USING errcode = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org) THEN
    RAISE EXCEPTION 'unknown organization: %', p_org;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM modules WHERE module_key = p_key) THEN
    RAISE EXCEPTION 'unknown module: %', p_key;
  END IF;
  IF p_source NOT IN ('TIER','ADDON','GRANT','SUBSCRIPTION') THEN
    RAISE EXCEPTION 'invalid source: %', p_source;
  END IF;

  INSERT INTO org_modules (org_id, module_key, enabled, source)
  VALUES (p_org, p_key, p_enabled, p_source)
  ON CONFLICT (org_id, module_key)
    DO UPDATE SET enabled = EXCLUDED.enabled, source = EXCLUDED.source, updated_at = now();
END;
$fn$;

COMMENT ON FUNCTION set_org_module(uuid, text, boolean, text) IS
  'U6: SUPER_ADMIN / billing-service upsert of a single org_modules entitlement (add-on / subscription seam). §4.1.';

GRANT EXECUTE ON FUNCTION set_org_module(uuid, text, boolean, text)
  TO authenticated, service_role;
