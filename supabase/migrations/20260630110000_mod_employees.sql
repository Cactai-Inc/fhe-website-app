/*
  # FHE Suite — Employees & Scheduling (U12, migration 20260630110000) — module mod.employees

  Per PLATFORM_ARCHITECTURE.md section 7.9. The staff/scheduling surface that ties
  consumption_events.administered_by and engagement assignment to real staff. Ships
  day one; FHE (tenant #1, tier.lesson_brokerage) leaves it DISABLED — so a
  module-off tenant sees/writes NOTHING here (Layer A, the module_gate).

  Tables (all boundary + module_gate('mod.employees') + access; audit + soft-delete):
    staff_profiles     — employment record on a profiles(user_id) row (+ optional contact).
    shifts             — scheduled work windows for a staff_profile.
    time_entries       — clock in/out + minutes; payroll / service-time costing.
    service_assignments— assigns staff to an engagement/service occurrence.

  Seams (section 2):
    1. TENANCY BOUNDARY — org_id NOT NULL DEFAULT current_org(); RESTRICTIVE
       <t>_org_boundary USING/WITH CHECK (org_id = current_org()).
    2. MODULE GATE      — RESTRICTIVE <t>_module_gate USING/WITH CHECK
       (has_module('mod.employees')). A disabled module's rows are invisible AND
       unwritable even to that org's own ADMIN. RESTRICTIVE policies AND together,
       so boundary AND gate AND (permissive access) must all pass.
    3. ACCESS (PERMISSIVE) — org-admin RCUD (is_admin()); an employee reads OWN
       staff_profile (profile_user_id = auth.uid()) and OWN shifts/time_entries
       (their staff_profile). Resolution via the SECURITY DEFINER helper
       caller_staff_profile_ids() so the employee-read predicate on shifts/
       time_entries does not recurse into staff_profiles' own RLS.

  Audit-trigger note: section 8.3 makes U14 the canonical audit-attachment site, but
  (as value_registry / entitlements already do) these tables need the audit trigger
  before U14 for THIS unit's own audit-coverage assertion; DROP TRIGGER IF EXISTS
  makes a later U14 re-attach a harmless no-op.

  Depends on U2 (entitlements: modules/org_modules/has_module()). References the
  pre-existing profiles(user_id), contacts(id), engagements(id), service_types(code).
*/

-- ============================================================
-- staff_profiles — employment record on a profile (+ optional contact)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  profile_user_id uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  contact_id      uuid REFERENCES contacts(id) ON DELETE SET NULL,
  title           text,
  pay_type        text,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz,
  deleted_by      uuid REFERENCES profiles(user_id) ON DELETE SET NULL,
  UNIQUE (org_id, profile_user_id)
);

CREATE INDEX IF NOT EXISTS staff_profiles_org_idx           ON staff_profiles (org_id);
CREATE INDEX IF NOT EXISTS staff_profiles_profile_user_idx  ON staff_profiles (profile_user_id);

DROP TRIGGER IF EXISTS staff_profiles_set_updated_at ON staff_profiles;
CREATE TRIGGER staff_profiles_set_updated_at BEFORE UPDATE ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- caller_staff_profile_ids() — the staff_profile ids the caller owns.
--   SECURITY DEFINER search_path-pinned + STABLE, shaped exactly like
--   current_org()/is_admin(): reads staff_profiles PAST its RLS so the
--   employee-read policies on shifts/time_entries never recurse into
--   staff_profiles' own policies. Defined AFTER staff_profiles so the SQL
--   body's table reference resolves at creation time. Scoped to current_org()
--   so a caller who is staff in two tenants only resolves ids in the active one.
-- ============================================================
CREATE OR REPLACE FUNCTION caller_staff_profile_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT sp.id
  FROM staff_profiles sp
  WHERE sp.profile_user_id = auth.uid()
    AND sp.org_id = current_org()
    AND sp.deleted_at IS NULL
$$;

-- ============================================================
-- shifts — scheduled work windows for a staff_profile
-- ============================================================
CREATE TABLE IF NOT EXISTS shifts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  staff_profile_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz,
  role             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS shifts_org_idx   ON shifts (org_id);
CREATE INDEX IF NOT EXISTS shifts_staff_idx ON shifts (staff_profile_id);

DROP TRIGGER IF EXISTS shifts_set_updated_at ON shifts;
CREATE TRIGGER shifts_set_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- time_entries — clock in/out + minutes (payroll / service-time costing)
-- ============================================================
CREATE TABLE IF NOT EXISTS time_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  staff_profile_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  clock_in         timestamptz NOT NULL,
  clock_out        timestamptz,
  minutes          integer,
  source_kind      text,
  source_id        uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS time_entries_org_idx   ON time_entries (org_id);
CREATE INDEX IF NOT EXISTS time_entries_staff_idx ON time_entries (staff_profile_id);

DROP TRIGGER IF EXISTS time_entries_set_updated_at ON time_entries;
CREATE TRIGGER time_entries_set_updated_at BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- service_assignments — assigns staff to an engagement/service occurrence
-- ============================================================
CREATE TABLE IF NOT EXISTS service_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  engagement_id    uuid REFERENCES engagements(id) ON DELETE SET NULL,
  staff_profile_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  service_type     text REFERENCES service_types(code),
  scheduled_at     timestamptz,
  status           text NOT NULL DEFAULT 'SCHEDULED',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz,
  deleted_by       uuid REFERENCES profiles(user_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS service_assignments_org_idx        ON service_assignments (org_id);
CREATE INDEX IF NOT EXISTS service_assignments_staff_idx      ON service_assignments (staff_profile_id);
CREATE INDEX IF NOT EXISTS service_assignments_engagement_idx ON service_assignments (engagement_id);

DROP TRIGGER IF EXISTS service_assignments_set_updated_at ON service_assignments;
CREATE TRIGGER service_assignments_set_updated_at BEFORE UPDATE ON service_assignments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Boundary (seam 1) + index + enable RLS — the section 8.1 DO-loop, by name.
--   New tables are born empty, so no backfill; DEFAULT + NOT NULL suffice.
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff_profiles','shifts','time_entries','service_assignments'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_org_boundary', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (org_id = current_org()) WITH CHECK (org_id = current_org())',
      t||'_org_boundary', t);
    -- seam 2: the module gate — RESTRICTIVE, ANDs with the boundary above.
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_module_gate', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (has_module(''mod.employees'')) WITH CHECK (has_module(''mod.employees''))',
      t||'_module_gate', t);
  END LOOP;
END $$;

-- ============================================================
-- Access (seam 3, PERMISSIVE — OR within the RESTRICTIVE envelope).
--   Org-admin RCUD across all four tables; an employee reads OWN records.
-- ============================================================

-- staff_profiles: admin RCUD; employee reads own row.
DROP POLICY IF EXISTS staff_profiles_admin_write ON staff_profiles;
CREATE POLICY staff_profiles_admin_write ON staff_profiles
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS staff_profiles_self_read ON staff_profiles;
CREATE POLICY staff_profiles_self_read ON staff_profiles
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND profile_user_id = auth.uid());

-- shifts: admin RCUD; employee reads own (via caller_staff_profile_ids()).
DROP POLICY IF EXISTS shifts_admin_write ON shifts;
CREATE POLICY shifts_admin_write ON shifts
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS shifts_self_read ON shifts;
CREATE POLICY shifts_self_read ON shifts
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND staff_profile_id IN (SELECT caller_staff_profile_ids()));

-- time_entries: admin RCUD; employee reads own.
DROP POLICY IF EXISTS time_entries_admin_write ON time_entries;
CREATE POLICY time_entries_admin_write ON time_entries
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS time_entries_self_read ON time_entries;
CREATE POLICY time_entries_self_read ON time_entries
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND staff_profile_id IN (SELECT caller_staff_profile_ids()));

-- service_assignments: admin RCUD; employee reads own assignments.
DROP POLICY IF EXISTS service_assignments_admin_write ON service_assignments;
CREATE POLICY service_assignments_admin_write ON service_assignments
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS service_assignments_self_read ON service_assignments;
CREATE POLICY service_assignments_self_read ON service_assignments
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND staff_profile_id IN (SELECT caller_staff_profile_ids()));

-- ============================================================
-- Soft-delete: archival via deleted_at is the only removal mechanism
-- (mirrors engagements/horses). REVOKE hard DELETE.
-- ============================================================
REVOKE DELETE ON staff_profiles      FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON shifts              FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON time_entries        FROM PUBLIC, anon, authenticated;
REVOKE DELETE ON service_assignments FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Audit — reuse the migration-13 trigger. U14 is the canonical attachment site;
-- these are needed before U14 for this unit's own audit-coverage assertion, and
-- DROP TRIGGER IF EXISTS makes a later U14 re-attach a no-op (same pattern as
-- entitlements / value_registry).
-- ============================================================
DROP TRIGGER IF EXISTS audit_staff_profiles ON staff_profiles;
CREATE TRIGGER audit_staff_profiles AFTER INSERT OR UPDATE OR DELETE ON staff_profiles
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_shifts ON shifts;
CREATE TRIGGER audit_shifts AFTER INSERT OR UPDATE OR DELETE ON shifts
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_time_entries ON time_entries;
CREATE TRIGGER audit_time_entries AFTER INSERT OR UPDATE OR DELETE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();

DROP TRIGGER IF EXISTS audit_service_assignments ON service_assignments;
CREATE TRIGGER audit_service_assignments AFTER INSERT OR UPDATE OR DELETE ON service_assignments
  FOR EACH ROW EXECUTE FUNCTION audit_row_change();
