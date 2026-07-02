/*
  # FHE Suite — Entitlement substrate (U2, migration 28) — module core.tenancy

  The entitlement machinery per PLATFORM_ARCHITECTURE.md §3–§4. Entitlements are
  DATA: a per-tenant `org_modules` truth table read by `has_module()`, enforced in
  three layers (RLS gate, RPC guard, UI nav). This migration builds the substrate:

    modules        — global platform catalog (no org_id): the sellable feature keys.
    tiers          — global packaging: strata-mapped bundles with a monthly price.
    tier_modules   — global map: which module keys a tier grants.
    org_modules    — PER-TENANT entitlement, the enforcement source of truth.

  Seams (§2): the global catalog tables (modules/tiers/tier_modules) are
  GLOBAL — no org_id, no boundary — world-read-active, SUPER_ADMIN-write, so the
  pricing/tier UI can list them. `org_modules` carries the tenancy boundary
  (seam 1) + access (seam 3) but NEVER a module_gate (seam 2): it is the very
  substrate `has_module()` reads, so gating it would recurse (§2/§4.1). The §4.3
  CI meta-test (d) asserts none of these ever grows a `_module_gate`.

  has_module()/require_module() are STABLE SECURITY DEFINER search_path-pinned —
  shaped exactly like current_org()/is_admin() — so they read org_modules PAST its
  RLS and the module-gate on every OTHER table never recurses into this substrate.
  SUPER_ADMIN is deliberately NOT OR'd into has_module() (same decision the role
  model made for is_org_admin()): platform access is a separate path, never a
  blanket grant of every module to the platform owner on every tenant.

  Seed: the module catalog (core.* + mod.*), the five tiers, tier_modules per §3,
  and backfill tenant #1 (FHE) org_modules from tier.lesson_brokerage
  → {mod.lessons, mod.brokerage, mod.horserecords} enabled.
*/

-- ============================================================
-- modules — global platform catalog (NO org_id, no boundary)
-- ============================================================
CREATE TABLE IF NOT EXISTS modules (
  module_key  text PRIMARY KEY,
  name        text NOT NULL,
  description text,
  is_core     boolean NOT NULL DEFAULT false,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- tiers — global packaging (strata-mapped bundles)
-- ============================================================
CREATE TABLE IF NOT EXISTS tiers (
  tier_key      text PRIMARY KEY,
  name          text NOT NULL,
  monthly_price numeric(12,2),
  sort_order    int NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- tier_modules — global map: which module keys a tier grants
-- ============================================================
CREATE TABLE IF NOT EXISTS tier_modules (
  tier_key   text NOT NULL REFERENCES tiers(tier_key) ON DELETE CASCADE,
  module_key text NOT NULL REFERENCES modules(module_key) ON DELETE CASCADE,
  PRIMARY KEY (tier_key, module_key)
);

-- ============================================================
-- org_modules — PER-TENANT entitlement (the enforcement truth)
--   Boundary (seam 1) + access (seam 3). NO module_gate (seam 2) — substrate.
-- ============================================================
CREATE TABLE IF NOT EXISTS org_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  module_key  text NOT NULL REFERENCES modules(module_key),
  enabled     boolean NOT NULL DEFAULT true,
  source      text NOT NULL DEFAULT 'GRANT'
                CHECK (source IN ('TIER','ADDON','GRANT','SUBSCRIPTION')),
  enabled_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, module_key)
);

CREATE INDEX IF NOT EXISTS org_modules_org_module_idx ON org_modules (org_id, module_key);
CREATE INDEX IF NOT EXISTS org_modules_org_idx        ON org_modules (org_id);

DROP TRIGGER IF EXISTS org_modules_set_updated_at ON org_modules;
CREATE TRIGGER org_modules_set_updated_at BEFORE UPDATE ON org_modules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Audit entitlement changes (they alter the paid surface) — reuse the mig-13 trigger.
DROP TRIGGER IF EXISTS audit_org_modules ON org_modules;
CREATE TRIGGER audit_org_modules AFTER INSERT OR UPDATE OR DELETE ON org_modules
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ============================================================
-- Helpers — the RLS vocabulary (§4.2). Shaped exactly like current_org()/is_admin():
-- STABLE SECURITY DEFINER, search_path-pinned. Read the substrate PAST RLS so the
-- module-gate on every OTHER table never recurses into org_modules.
-- ============================================================
CREATE OR REPLACE FUNCTION has_module(p_key text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_modules
    WHERE org_id = current_org()
      AND module_key = p_key
      AND enabled
      AND (expires_at IS NULL OR expires_at > now())
  )
$$;

-- The RPC guard: raise cleanly if the caller's tenant lacks the module.
CREATE OR REPLACE FUNCTION require_module(p_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_module(p_key) THEN
    RAISE EXCEPTION 'module % is not enabled for this organization', p_key
      USING errcode = 'insufficient_privilege';
  END IF;
END;
$$;

-- ============================================================
-- RLS
--   Global catalog (modules/tiers/tier_modules): world-read-active, SUPER_ADMIN-write.
--   org_modules: RESTRICTIVE tenancy boundary + PERMISSIVE access (admin write,
--   staff read). NO module_gate (substrate — would recurse).
-- ============================================================
ALTER TABLE modules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_modules  ENABLE ROW LEVEL SECURITY;

-- modules: world-readable so the pricing/tier UI can list them; SUPER_ADMIN write.
DROP POLICY IF EXISTS modules_read ON modules;
CREATE POLICY modules_read ON modules
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS modules_super_admin_write ON modules;
CREATE POLICY modules_super_admin_write ON modules
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- tiers: world-readable (public pricing page); SUPER_ADMIN write.
DROP POLICY IF EXISTS tiers_read ON tiers;
CREATE POLICY tiers_read ON tiers
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS tiers_super_admin_write ON tiers;
CREATE POLICY tiers_super_admin_write ON tiers
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- tier_modules: world-readable; SUPER_ADMIN write.
DROP POLICY IF EXISTS tier_modules_read ON tier_modules;
CREATE POLICY tier_modules_read ON tier_modules
  FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS tier_modules_super_admin_write ON tier_modules;
CREATE POLICY tier_modules_super_admin_write ON tier_modules
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

-- org_modules — seam 1: RESTRICTIVE tenancy boundary (ANDs with access below).
DROP POLICY IF EXISTS org_modules_org_boundary ON org_modules;
CREATE POLICY org_modules_org_boundary ON org_modules AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- org_modules — seam 3: access. Staff of the tenant read their entitlements
-- (so nav gating can resolve); writes are ADMIN-only (provision_tenant /
-- set_org_module run SECURITY DEFINER / service_role past RLS anyway).
DROP POLICY IF EXISTS org_modules_staff_read ON org_modules;
CREATE POLICY org_modules_staff_read ON org_modules
  FOR SELECT TO authenticated USING (has_staff_access());
DROP POLICY IF EXISTS org_modules_admin_write ON org_modules;
CREATE POLICY org_modules_admin_write ON org_modules
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- Seed the module catalog (core.* always-on; mod.* entitlement-gated) — §3
-- ============================================================
INSERT INTO modules (module_key, name, description, is_core, active) VALUES
  ('core.tenancy',   'Tenancy & Identity',            'organizations, profiles.org_id, current_org(), org_modules, has_module(). The isolation + entitlement substrate.', true, true),
  ('core.roles',     'Roles & Access',                'SUPER_ADMIN/ADMIN/MANAGER/EMPLOYEE/USER model, app_role()/is_admin()/has_staff_access() and ownership predicates.', true, true),
  ('core.registry',  'Global Value Registry',         'business_config + config_values + config_value(). The define-once home for prices, rates, legal identity, branding, copy, contact info.', true, true),
  ('core.branding',  'Branding & Public Site',        'Per-tenant brand rows driving the branded public site + member app.', true, true),
  ('core.contracts', 'Contracts, Documents & E-Sign', 'contract_templates, template_tokens, documents, signatures, generate_document, record_signature.', true, true),
  ('core.payments',  'Payments, Billing & Audit',     'transactions, billable_lines, Stripe/Zelle reconcile, audit_logs.', true, true),
  ('mod.brokerage',    'Brokerage & Contracts',   'Search/evaluation/transaction-representation, engagement_stages, brokerage engagement RPCs.', false, true),
  ('mod.lessons',      'Lessons & Membership',    'lesson_packages, lesson_credits, lesson_bookings, membership plans.', false, true),
  ('mod.boarding',     'Boarding & Facility',     'facilities, stalls, board_agreements, board_charges.', false, true),
  ('mod.barnops',      'Barn Ops & Inventory',    'resources, resource_lots, consumption_events, cost_allocation_rules, resolve_consumption_billing().', false, true),
  ('mod.horserecords', 'Horse Records & Health',  'horse_parties (ownership/rights), horse_health_events.', false, true),
  ('mod.employees',    'Employees & Scheduling',  'staff_profiles, shifts, time_entries, service_assignments.', false, true)
ON CONFLICT (module_key) DO NOTHING;

-- ============================================================
-- Seed the five tiers (strata-mapped packaging) — §3
-- ============================================================
INSERT INTO tiers (tier_key, name, monthly_price, sort_order, active) VALUES
  ('tier.lesson_barn',       'Lesson Barn',                 99.00,  1, true),
  ('tier.brokerage',         'Brokerage',                   149.00, 2, true),
  ('tier.lesson_brokerage',  'Lesson + Brokerage',          199.00, 3, true),
  ('tier.boarding',          'Boarding Barn',               199.00, 4, true),
  ('tier.full_barn',         'Full Barn',                   349.00, 5, true)
ON CONFLICT (tier_key) DO NOTHING;

-- ============================================================
-- Seed tier_modules (which modules each tier grants BEYOND core) — §3
--   tier.lesson_barn      → mod.lessons
--   tier.brokerage        → mod.brokerage, mod.horserecords
--   tier.lesson_brokerage → mod.lessons, mod.brokerage, mod.horserecords   (FHE)
--   tier.boarding         → mod.boarding, mod.horserecords, mod.barnops
--   tier.full_barn        → all six modules
-- ============================================================
INSERT INTO tier_modules (tier_key, module_key) VALUES
  ('tier.lesson_barn',      'mod.lessons'),
  ('tier.brokerage',        'mod.brokerage'),
  ('tier.brokerage',        'mod.horserecords'),
  ('tier.lesson_brokerage', 'mod.lessons'),
  ('tier.lesson_brokerage', 'mod.brokerage'),
  ('tier.lesson_brokerage', 'mod.horserecords'),
  ('tier.boarding',         'mod.boarding'),
  ('tier.boarding',         'mod.horserecords'),
  ('tier.boarding',         'mod.barnops'),
  ('tier.full_barn',        'mod.brokerage'),
  ('tier.full_barn',        'mod.lessons'),
  ('tier.full_barn',        'mod.boarding'),
  ('tier.full_barn',        'mod.barnops'),
  ('tier.full_barn',        'mod.horserecords'),
  ('tier.full_barn',        'mod.employees')
ON CONFLICT (tier_key, module_key) DO NOTHING;

-- ============================================================
-- Backfill tenant #1 (FHE) from tier.lesson_brokerage — §3 launch entitlement.
--   FHE enables {mod.lessons, mod.brokerage, mod.horserecords} (source TIER).
--   Idempotent: a re-run adds nothing (UNIQUE(org_id, module_key)).
-- ============================================================
INSERT INTO org_modules (org_id, module_key, enabled, source)
SELECT o.id, tm.module_key, true, 'TIER'
FROM organizations o
CROSS JOIN tier_modules tm
WHERE o.id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
  AND tm.tier_key = 'tier.lesson_brokerage'
ON CONFLICT (org_id, module_key) DO NOTHING;
