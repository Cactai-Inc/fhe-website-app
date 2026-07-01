/*
  # FHE Platform — New Storage Buckets with Org-Prefix Isolation (U13)

  Follows PLATFORM_ARCHITECTURE.md §8.4. STRICTLY ADDITIVE — only touches the
  storage schema; independent of the module/domain units.

  Three new PRIVATE buckets:
    inventory-docs   — inventory / cost-attribution supporting documents
    horse-health     — vet/farrier/health event attachments
    brand-assets     — per-tenant branding assets (logos, etc.)

  Object paths embed the OWNING ORG as the FIRST folder, so storage isolation
  matches TABLE isolation:
    brand-assets/{org_id}/logo.png
    inventory-docs/{org_id}/invoice.pdf
    horse-health/{org_id}/{horse_id}/coggins.pdf

  Every policy ANDs
      try_cast_uuid(split_part(name, '/', 1)) = current_org()
  so an object under org A's prefix is invisible/unwritable to an org B caller,
  exactly like the RESTRICTIVE org_id = current_org() table boundary. Staff/owner
  access layers ON TOP of that org boundary:
    - has_staff_access(): read/write within their own org, all three buckets
    - brand-assets writes are additionally admin-only (is_admin())
    - horse-health owner reads: a client who owns the horse in the SECOND path
      segment (client_can_read_horse) may read within their own org

  Reuses the existing try_cast_uuid() (migration 15): a malformed first segment
  coerces to NULL, so the org comparison is false and access is denied — never a
  raise inside a policy predicate.

  Note: storage_admin_all (migration 15, FOR ALL is_admin()) already grants a
  tenant ADMIN full read/write on EVERY bucket including these three; the policies
  below add the org-scoped STAFF and horse-owner paths on top (permissive policies
  OR together). is_admin() is a tenant ADMIN (or platform SUPER_ADMIN), so admin
  reach here is still tenant-scoped in practice: admins only ever hold rows in
  their own org's prefix.
*/

-- ============================================================
-- Buckets (all private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('inventory-docs', 'inventory-docs', false),
  ('horse-health',   'horse-health',   false),
  ('brand-assets',   'brand-assets',   false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Policies on storage.objects (permissive; OR together with migration 15's).
-- Every predicate ANDs the org-prefix boundary so isolation matches tables.
-- ============================================================

-- STAFF read: any staff member reads objects under their own org prefix in the
-- three new buckets.
DROP POLICY IF EXISTS storage_staff_read_org ON storage.objects;
CREATE POLICY storage_staff_read_org ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('inventory-docs', 'horse-health', 'brand-assets')
    AND has_staff_access()
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
  );

-- STAFF write: staff write inventory-docs and horse-health under their own org
-- prefix. (brand-assets writes are admin-only — see below.)
DROP POLICY IF EXISTS storage_staff_write_org ON storage.objects;
CREATE POLICY storage_staff_write_org ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('inventory-docs', 'horse-health')
    AND has_staff_access()
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
  )
  WITH CHECK (
    bucket_id IN ('inventory-docs', 'horse-health')
    AND has_staff_access()
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
  );

-- brand-assets ADMIN write: only a tenant ADMIN may write branding assets, and
-- only under their own org prefix.
DROP POLICY IF EXISTS storage_brand_admin_write_org ON storage.objects;
CREATE POLICY storage_brand_admin_write_org ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND is_admin()
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
  )
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND is_admin()
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
  );

-- horse-health OWNER read: a client who owns the horse (second path segment)
-- may read its health attachments — but only within their own org prefix, so a
-- cross-tenant path can never be reached. Path: horse-health/{org_id}/{horse_id}/...
DROP POLICY IF EXISTS storage_horsehealth_owner_read ON storage.objects;
CREATE POLICY storage_horsehealth_owner_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'horse-health'
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
    AND client_can_read_horse(try_cast_uuid(split_part(name, '/', 2)))
  );
