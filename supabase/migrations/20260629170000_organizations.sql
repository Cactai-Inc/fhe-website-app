/*
  # FHE CRM → Multi-tenant Suite — Organizations foundation (migration 24)

  Turns the single-tenant CRM into the foundation for a multi-tenant white-label
  product. This first step adds the tenancy primitives without yet re-scoping
  every data table (that follows, table by table, so each step stays green):

  - organizations — one row per tenant business (the white-label "ORG").
  - profiles.org_id — a user's tenant membership.
  - current_org() — the caller's tenant, the anchor for org-scoped RLS.
  - a seeded default organization, with all existing profiles + data treated as
    tenant #1 (the operator's own business — the first customer).

  Subsequent migrations add org_id + org-scoped RLS to contacts/clients/horses/
  engagements/transactions/documents/signatures, make business_config per-org, and
  de-specify the contract content into {{ORG.*}} tokens.
*/

-- ============================================================
-- organizations — the tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_code text UNIQUE,
  name         text NOT NULL,
  slug         text UNIQUE,                         -- tenant key (subdomain / routing)
  status       text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','ARCHIVED')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz,
  deleted_by   uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE SEQUENCE IF NOT EXISTS org_code_seq;
DROP TRIGGER IF EXISTS organizations_set_code ON organizations;
CREATE TRIGGER organizations_set_code BEFORE INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION assign_display_code('ORG-', 'org_code_seq');

DROP TRIGGER IF EXISTS organizations_set_updated_at ON organizations;
CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS audit_organizations ON organizations;
CREATE TRIGGER audit_organizations AFTER INSERT OR UPDATE OR DELETE ON organizations
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

-- ============================================================
-- membership — a user belongs to one tenant
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS profiles_org_idx ON profiles (org_id);

-- current_org() — the caller's tenant (anchor for org-scoped RLS). SECURITY DEFINER
-- so it reads profiles regardless of the caller's own RLS, like is_admin().
CREATE OR REPLACE FUNCTION current_org()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT org_id FROM profiles WHERE user_id = auth.uid()
$$;

-- ============================================================
-- seed tenant #1 — the operator's own business; adopt existing data
-- ============================================================
INSERT INTO organizations (name, slug)
  SELECT 'French Heritage Equestrian', 'fhe'
  WHERE NOT EXISTS (SELECT 1 FROM organizations);

-- every existing user joins tenant #1
UPDATE profiles SET org_id = (SELECT id FROM organizations ORDER BY created_at LIMIT 1)
  WHERE org_id IS NULL;

-- ============================================================
-- RLS — members read their org; admins manage
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_read ON organizations;
CREATE POLICY organizations_read ON organizations
  FOR SELECT TO authenticated
  USING (is_admin() OR id = current_org());

DROP POLICY IF EXISTS organizations_admin_write ON organizations;
CREATE POLICY organizations_admin_write ON organizations
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

REVOKE DELETE ON organizations FROM anon, authenticated;
