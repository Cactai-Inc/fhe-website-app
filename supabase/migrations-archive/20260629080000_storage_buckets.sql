/*
  # FHE CRM — Storage Buckets & Policies (migration 15)

  Implements DATABASE_SECURITY_AND_PERMISSION_MODEL §6. Additive.

  Eight private buckets, default-deny, with path-prefix ownership policies. Object
  paths embed the owning id as the FIRST folder, e.g.
    contracts/{engagement_id}/{document_uuid}.pdf
    horse-photos/{horse_id}/photo.jpg
    profile-images/{user_id}/avatar.png
  so a policy can match split_part(name,'/',1) against the caller's owned ids.

  Launch scope is ADMIN + CLIENT (TRAINER deferred per handoff; its RW-own policies
  slot in later without schema change, mirroring the table RLS). Ownership reuses
  the SECURITY DEFINER helpers caller_owns_engagement() and client_can_read_horse()
  so storage RLS resolves the same way as table RLS.

  try_cast_uuid() makes the first-folder→uuid conversion total: a malformed path
  yields NULL (→ ownership false) instead of raising inside a policy predicate.
*/

-- Safe uuid coercion for path segments (NULL instead of raising on bad input).
CREATE OR REPLACE FUNCTION try_cast_uuid(s text)
RETURNS uuid LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN s::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

-- ============================================================
-- Buckets (all private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('contracts',          'contracts',          false),
  ('generated-documents','generated-documents',false),
  ('reports',            'reports',            false),
  ('horse-photos',       'horse-photos',       false),
  ('horse-documents',    'horse-documents',    false),
  ('profile-images',     'profile-images',     false),
  ('facility-files',     'facility-files',     false),
  ('temporary-uploads',  'temporary-uploads',  false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Policies on storage.objects (multiple permissive policies OR together)
-- ============================================================

-- ADMIN: full read/write on every bucket.
DROP POLICY IF EXISTS storage_admin_all ON storage.objects;
CREATE POLICY storage_admin_all ON storage.objects
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- CLIENT read: engagement-scoped buckets (first folder = engagement_id).
DROP POLICY IF EXISTS storage_client_read_engagement ON storage.objects;
CREATE POLICY storage_client_read_engagement ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('contracts','generated-documents','reports')
    AND caller_owns_engagement(try_cast_uuid(split_part(name, '/', 1)))
  );

-- CLIENT read: horse-scoped buckets (first folder = horse_id).
DROP POLICY IF EXISTS storage_client_read_horse ON storage.objects;
CREATE POLICY storage_client_read_horse ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('horse-photos','horse-documents')
    AND client_can_read_horse(try_cast_uuid(split_part(name, '/', 1)))
  );

-- CLIENT read/write own: profile images and temporary uploads (first folder = user_id).
DROP POLICY IF EXISTS storage_client_rw_self ON storage.objects;
CREATE POLICY storage_client_rw_self ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id IN ('profile-images','temporary-uploads')
    AND split_part(name, '/', 1) = auth.uid()::text
  )
  WITH CHECK (
    bucket_id IN ('profile-images','temporary-uploads')
    AND split_part(name, '/', 1) = auth.uid()::text
  );
