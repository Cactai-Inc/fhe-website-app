/*
  # FHE CRM → Suite — Role model (migration 25)

  Replaces the single-tenant `profiles.is_admin` boolean with a proper SaaS role,
  the source of truth for every access decision:

    SUPER_ADMIN  platform owner (cross-tenant; operates via a separate platform
                 path, deliberately NOT woven into tenant RLS)
    ADMIN        tenant owner — full control of their org + the personalization panel
    MANAGER      elevated tenant staff
    EMPLOYEE     tenant staff
    USER         the tenant's customer (rider / horse owner)

  `role` becomes authoritative; the legacy is_admin column is left deprecated and
  no longer read (is_admin() + is_active_member() are redefined against `role`), so
  there is no drift to maintain. Helpers: app_role(), is_super_admin(),
  is_org_admin(), has_staff_access() — the vocabulary the org-scoped RLS will use.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'USER'
  CHECK (role IN ('SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE','USER'));

-- adopt existing admins into the new model
UPDATE profiles SET role = 'ADMIN' WHERE is_admin AND role = 'USER';

-- ============================================================
-- role helpers (the RLS vocabulary)
-- ============================================================
CREATE OR REPLACE FUNCTION app_role()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT role FROM profiles WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT app_role() = 'SUPER_ADMIN'
$$;

-- tenant administrator (the personalization panel). Super admin is intentionally
-- excluded — platform-level access is a separate path, not an RLS OR on every table.
CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT app_role() = 'ADMIN'
$$;

-- any staff member of the tenant (admin / manager / employee)
CREATE OR REPLACE FUNCTION has_staff_access()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT app_role() IN ('ADMIN','MANAGER','EMPLOYEE')
$$;

-- ============================================================
-- retire the legacy is_admin COLUMN as a source of truth
-- (redefine the two functions that read it to use `role`)
-- ============================================================
-- legacy operator check for the pre-existing platform tables (bookings/orders/
-- community): the operator is a tenant ADMIN or the platform SUPER_ADMIN.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT COALESCE(app_role() IN ('ADMIN','SUPER_ADMIN'), false)
$$;

CREATE OR REPLACE FUNCTION is_active_member()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN false
      WHEN COALESCE((SELECT p.is_suspended FROM profiles p WHERE p.user_id = auth.uid()), false) THEN false
      WHEN is_admin() THEN true
      ELSE EXISTS (
        SELECT 1 FROM memberships m
        WHERE m.user_id = auth.uid() AND m.status = 'active'
      )
    END;
$$;
