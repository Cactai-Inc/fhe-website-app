/*
  # SUPER_ADMIN passes staff gates (owner-reported: branding save RLS-rejected)

  has_staff_access() enumerated ADMIN/MANAGER/EMPLOYEE and omitted SUPER_ADMIN,
  so the platform's top role failed every staff-write policy (config_values,
  and any table gated on has_staff_access). A super admin is a strict superset
  of staff. Tenant isolation is unaffected — the RESTRICTIVE org boundary
  (org_id = current_org()) still applies to every role.
*/
CREATE OR REPLACE FUNCTION has_staff_access()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT app_role() IN ('SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE')
$$;
