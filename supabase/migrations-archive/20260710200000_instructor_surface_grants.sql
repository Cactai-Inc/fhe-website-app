-- ROLE ARCHITECTURE (owner revision) — instructor view grants. Admin controls
-- what instructors see beyond the servicing baseline: a grant row adds one nav
-- surface, either org-wide (user_id NULL = every instructor) or for one
-- instructor account. The app shell reads these to extend the instructor rail.
CREATE TABLE IF NOT EXISTS instructor_surface_grants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id),
  user_id    uuid REFERENCES auth.users(id),   -- NULL = all instructors in the org
  nav_key    text NOT NULL,                    -- the rail item key (route path)
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, nav_key)
);

ALTER TABLE instructor_surface_grants ENABLE ROW LEVEL SECURITY;

-- staff read the grants that apply to them (global or their own); admins manage all
DROP POLICY IF EXISTS isg_read ON instructor_surface_grants;
CREATE POLICY isg_read ON instructor_surface_grants
  FOR SELECT USING (
    org_id = current_org()
    AND (is_admin() OR user_id IS NULL OR user_id = auth.uid())
  );
DROP POLICY IF EXISTS isg_admin ON instructor_surface_grants;
CREATE POLICY isg_admin ON instructor_surface_grants
  FOR ALL USING (org_id = current_org() AND is_admin())
  WITH CHECK (org_id = current_org() AND is_admin());

GRANT SELECT, INSERT, DELETE ON instructor_surface_grants TO authenticated;
