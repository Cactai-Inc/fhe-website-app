/*
  # FHE Suite — Lessons & Membership (U8, migration 20260630070000) — module mod.lessons

  ADDITIVE. Per PLATFORM_ARCHITECTURE.md §3, §7.10. Two entitlement-gated tables:

    lesson_packages — the purchasable lesson packs a tenant sells: (org_id,
                      package_key, name, price_value_key, credits, active). Priced
                      from the registry — price_value_key is a config_value() key
                      (e.g. ns 'PRICING'), NEVER a literal, honoring
                      GLOBAL-VALUE-CHANGES-RULE-THE-DAY (§5).
    lesson_credits  — per-client balances: (org_id, client_id REFERENCES clients(id),
                      package_key, credits_total, credits_remaining, purchased_at).

  Seams (§2), both tables:
    1. TENANCY BOUNDARY — org_id NOT NULL DEFAULT current_org(), RESTRICTIVE
       <t>_org_boundary USING/WITH CHECK (org_id = current_org()).
    2. MODULE GATE      — RESTRICTIVE <t>_module_gate USING/WITH CHECK
       (has_module('mod.lessons')). A mod.lessons-OFF tenant sees zero rows and
       cannot insert even as its own ADMIN.
    3. ACCESS           — staff RCUD (is_admin()/has_staff_access()); a client reads
       OWN lesson_credits via client_id = current_client_id() (§7.10).

  Soft-delete columns (deleted_at/deleted_by) present; the audit trigger is attached
  here with DROP TRIGGER IF EXISTS so U14 (the canonical audit-attachment site, §8.3)
  re-attach is a harmless no-op. Depends on U2 (entitlements: modules/org_modules/
  has_module) and the CRM backbone (clients, current_client_id).
*/

-- ============================================================
-- lesson_packages — purchasable lesson packs (priced from the registry)
-- ============================================================
CREATE TABLE IF NOT EXISTS lesson_packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  package_key     text NOT NULL,
  name            text NOT NULL,
  price_value_key text,                       -- a config_value() registry key (§5), never a literal
  credits         integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  deleted_by      uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  UNIQUE (org_id, package_key)
);

CREATE INDEX IF NOT EXISTS lesson_packages_org_idx ON lesson_packages (org_id);

DROP TRIGGER IF EXISTS lesson_packages_set_updated_at ON lesson_packages;
CREATE TRIGGER lesson_packages_set_updated_at BEFORE UPDATE ON lesson_packages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_lesson_packages ON lesson_packages;
CREATE TRIGGER audit_lesson_packages AFTER INSERT OR UPDATE OR DELETE ON lesson_packages
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ============================================================
-- lesson_credits — per-client credit balances
-- ============================================================
CREATE TABLE IF NOT EXISTS lesson_credits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  client_id         uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  package_key       text,
  credits_total     integer NOT NULL DEFAULT 0 CHECK (credits_total >= 0),
  credits_remaining integer NOT NULL DEFAULT 0 CHECK (credits_remaining >= 0),
  purchased_at      timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  deleted_by        uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS lesson_credits_org_idx       ON lesson_credits (org_id);
CREATE INDEX IF NOT EXISTS lesson_credits_client_idx    ON lesson_credits (client_id);

DROP TRIGGER IF EXISTS lesson_credits_set_updated_at ON lesson_credits;
CREATE TRIGGER lesson_credits_set_updated_at BEFORE UPDATE ON lesson_credits
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_lesson_credits ON lesson_credits;
CREATE TRIGGER audit_lesson_credits AFTER INSERT OR UPDATE OR DELETE ON lesson_credits
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ============================================================
-- RLS — seam 1 (boundary) + seam 2 (module gate) + seam 3 (access)
-- ============================================================
ALTER TABLE lesson_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_credits  ENABLE ROW LEVEL SECURITY;

-- ---- lesson_packages ----------------------------------------------------------
-- seam 1: tenancy boundary (RESTRICTIVE).
DROP POLICY IF EXISTS lesson_packages_org_boundary ON lesson_packages;
CREATE POLICY lesson_packages_org_boundary ON lesson_packages AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- seam 2: module gate (RESTRICTIVE) — invisible + unwritable when mod.lessons is off.
DROP POLICY IF EXISTS lesson_packages_module_gate ON lesson_packages;
CREATE POLICY lesson_packages_module_gate ON lesson_packages AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_module('mod.lessons')) WITH CHECK (has_module('mod.lessons'));

-- seam 3: access. Staff RCUD; any member of the tenant may read the (public-facing)
-- package catalog so a client can see what's purchasable.
DROP POLICY IF EXISTS lesson_packages_read ON lesson_packages;
CREATE POLICY lesson_packages_read ON lesson_packages
  FOR SELECT TO authenticated USING (deleted_at IS NULL OR is_admin());

DROP POLICY IF EXISTS lesson_packages_staff_write ON lesson_packages;
CREATE POLICY lesson_packages_staff_write ON lesson_packages
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());

-- ---- lesson_credits -----------------------------------------------------------
-- seam 1: tenancy boundary (RESTRICTIVE).
DROP POLICY IF EXISTS lesson_credits_org_boundary ON lesson_credits;
CREATE POLICY lesson_credits_org_boundary ON lesson_credits AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- seam 2: module gate (RESTRICTIVE).
DROP POLICY IF EXISTS lesson_credits_module_gate ON lesson_credits;
CREATE POLICY lesson_credits_module_gate ON lesson_credits AS RESTRICTIVE FOR ALL TO authenticated
  USING (has_module('mod.lessons')) WITH CHECK (has_module('mod.lessons'));

-- seam 3: access. Staff RCUD; a client reads ONLY their own credits (§7.10).
DROP POLICY IF EXISTS lesson_credits_staff_write ON lesson_credits;
CREATE POLICY lesson_credits_staff_write ON lesson_credits
  FOR ALL TO authenticated USING (has_staff_access()) WITH CHECK (has_staff_access());

DROP POLICY IF EXISTS lesson_credits_client_read_own ON lesson_credits;
CREATE POLICY lesson_credits_client_read_own ON lesson_credits
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND client_id = current_client_id());
