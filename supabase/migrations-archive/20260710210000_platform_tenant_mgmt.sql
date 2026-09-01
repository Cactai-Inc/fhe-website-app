-- PLATFORM TENANT MANAGEMENT (super-admin). The Organizations list becomes the
-- access point: click a tenant -> one management surface with identity, plan &
-- modules (registry names + descriptions, toggleable), admin accounts, usage,
-- and lifecycle (suspend/reactivate). SUPER_ADMIN only — the platform operator
-- manages tenants from outside them.

CREATE OR REPLACE FUNCTION platform_tenant_detail(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v jsonb;
BEGIN
  IF app_role() <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'platform operator only';
  END IF;

  SELECT jsonb_build_object(
    'org', (SELECT jsonb_build_object(
        'id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status,
        'display_code', o.display_code, 'created_at', o.created_at)
      FROM organizations o WHERE o.id = p_org_id),
    'modules', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'module_key', m.module_key, 'name', m.name, 'description', m.description,
        'is_core', m.is_core,
        'enabled', coalesce(om.enabled, m.is_core),
        'source', om.source) ORDER BY m.is_core DESC, m.module_key), '[]'::jsonb)
      FROM modules m
      LEFT JOIN org_modules om ON om.module_key = m.module_key AND om.org_id = p_org_id
      WHERE m.active),
    'admins', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'email', p.email,
        'name', trim(concat_ws(' ', p.first_name, p.last_name)),
        'role', p.role) ORDER BY p.role, p.email), '[]'::jsonb)
      FROM profiles p
      WHERE p.org_id = p_org_id AND p.role IN ('ADMIN','MANAGER','EMPLOYEE')),
    'usage', jsonb_build_object(
      'members',     (SELECT count(*) FROM profiles WHERE org_id = p_org_id),
      'contacts',    (SELECT count(*) FROM contacts WHERE org_id = p_org_id),
      'engagements', (SELECT count(*) FROM engagements WHERE org_id = p_org_id AND deleted_at IS NULL),
      'horses',      (SELECT count(*) FROM horses WHERE org_id = p_org_id AND deleted_at IS NULL),
      'documents',   (SELECT count(*) FROM documents WHERE org_id = p_org_id AND deleted_at IS NULL))
  ) INTO v;
  RETURN v;
END;
$fn$;

CREATE OR REPLACE FUNCTION platform_set_tenant_module(
  p_org_id uuid, p_module_key text, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF app_role() <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'platform operator only';
  END IF;
  INSERT INTO org_modules (org_id, module_key, enabled, source)
  VALUES (p_org_id, p_module_key, p_enabled, 'GRANT')
  ON CONFLICT (org_id, module_key) DO UPDATE
    SET enabled = p_enabled, updated_at = now();
END;
$fn$;

CREATE OR REPLACE FUNCTION platform_set_tenant_status(p_org_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
BEGIN
  IF app_role() <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'platform operator only';
  END IF;
  IF p_status NOT IN ('ACTIVE','SUSPENDED','ARCHIVED') THEN
    RAISE EXCEPTION 'status must be ACTIVE, SUSPENDED, or ARCHIVED';
  END IF;
  UPDATE organizations SET status = p_status, updated_at = now()
   WHERE id = p_org_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown organization';
  END IF;
END;
$fn$;

GRANT EXECUTE ON FUNCTION platform_tenant_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_set_tenant_module(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION platform_set_tenant_status(uuid, text) TO authenticated;
