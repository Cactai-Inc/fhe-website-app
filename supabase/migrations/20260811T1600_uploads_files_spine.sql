/*
  # TASK-UPLOADS — the Files spine

  Owner ruling 2026-08-11: *"Files are not ours, they belong to whoever uploads
  them. so they stay attached to that person. and in our case, the company."*

  A FILE IS NOT A DOCUMENT. `documents` are FHE's records — generated from tenant
  templates, signable, evidentiary, never rewritten. A file is the uploader's
  property; FHE stores it and surfaces it with permission. They never share a
  table. See docs/tasks/TASK-UPLOADS-files-live-on-a-record.md.

  ── What this adds ───────────────────────────────────────────────────────────

  `files`       one row per stored object. OWNERSHIP IS A COLUMN:
                owner_kind='contact' + owner_contact_id  → the member's property
                owner_kind='org'                          → the tenant's property
                `uploaded_by_user_id` is AUDIT ONLY. It never confers ownership —
                a staff member who scans a member's Coggins is the uploader, the
                member is the owner, and a staff member leaving takes nothing.

  `file_links`  polymorphic surfacing: (subject_type, subject_id), the shape
                `status_events` already uses. VISIBILITY IS A REFERENCE, NEVER A
                COPY — one `files` row, many `file_links` rows. Uploading a
                Coggins to a horse record and to a deal must not produce two
                files that can drift.

  `content_resources.file_id`
                the org's articles and guides keep their existing home (org-scoped
                catalogue, 0 rows, `published` flag) and now point AT a `files`
                row instead of carrying a bare `storage_path`. One store, one
                catalogue. No second table.

  ── Storage ──────────────────────────────────────────────────────────────────

  NO THIRTEENTH BUCKET. Twelve exist; this reuses the private, empty,
  generically-named `facility-files`. Path grammar, enforced by a table CHECK and
  parsed by the storage policies:

      {org_id}/{owner_kind}/{owner_id}/{file_id}-{safe_filename}

  where owner_id is the owning contact, or the org id when owner_kind='org'.
  Private bucket + short-lived signed URLs. Nothing here is ever made public.

  ── RLS ──────────────────────────────────────────────────────────────────────

  Member  reads/writes their OWN files (table + object).
  Staff   read/write tenant files (table + object), org-scoped.
  Member  reads ORG files only when a PUBLISHED content_resources row points at
          them — the existing `published` concept, respected rather than replaced.
  D1a     the platform owner (admin@cactai.io, org_id NULL) is DENIED everywhere:
          every policy compares against current_org(), which is NULL for it, and
          a RESTRICTIVE org boundary backs that up. Being denied is CORRECT.

  Also tightens the pre-existing `storage_admin_all` policy, which granted ALL on
  EVERY object in EVERY bucket on bare `is_admin()` with no org test — SUPER_ADMIN
  passes `is_admin()`, so the platform account could read every tenant file in the
  system. One added condition (`current_org() IS NOT NULL`) closes it; tenant
  admins are unaffected.

  No functions are created, so there is no CREATE FUNCTION / EXECUTE-to-PUBLIC
  grant to revoke.
*/

-- ============================================================
-- 1. files — the owned object
-- ============================================================
CREATE TABLE IF NOT EXISTS files (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),

  -- OWNERSHIP. Not an inference, not the uploader.
  owner_kind          text NOT NULL CHECK (owner_kind IN ('contact', 'org')),
  owner_contact_id    uuid REFERENCES contacts(id),

  bucket_id           text NOT NULL DEFAULT 'facility-files',
  storage_path        text NOT NULL UNIQUE,
  filename            text NOT NULL,
  mime_type           text,
  byte_size           bigint,

  title               text,
  description         text,

  -- AUDIT ONLY: who clicked upload. Confers no rights and no ownership.
  uploaded_by_user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,

  CONSTRAINT files_owner_shape CHECK (
    (owner_kind = 'contact' AND owner_contact_id IS NOT NULL)
    OR (owner_kind = 'org'  AND owner_contact_id IS NULL)
  ),
  -- The path IS the ownership claim; the storage policies parse it. Keeping the
  -- two in lockstep structurally means a row can never describe an object that
  -- lives under someone else's prefix.
  CONSTRAINT files_path_grammar CHECK (
    storage_path LIKE org_id::text || '/' || owner_kind || '/'
                   || coalesce(owner_contact_id, org_id)::text || '/%'
  )
);

CREATE INDEX IF NOT EXISTS files_org_idx   ON files (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS files_owner_idx ON files (owner_contact_id) WHERE deleted_at IS NULL;

-- ============================================================
-- 1b. content_resources points at a file (articles + guides keep their home).
--     Ordered here, ahead of the policies, because files_org_published_read
--     reads content_resources.file_id.
-- ============================================================
ALTER TABLE content_resources ADD COLUMN IF NOT EXISTS file_id uuid REFERENCES files(id);
CREATE INDEX IF NOT EXISTS content_resources_file_idx ON content_resources (file_id);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Org boundary (codebase convention; also the D1a backstop — NULL never equals).
DROP POLICY IF EXISTS files_org_boundary ON files;
CREATE POLICY files_org_boundary ON files AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

-- A member reads and writes their own files.
DROP POLICY IF EXISTS files_owner_rw ON files;
CREATE POLICY files_owner_rw ON files FOR ALL TO authenticated
  USING (owner_kind = 'contact' AND owner_contact_id = current_contact_id())
  WITH CHECK (owner_kind = 'contact' AND owner_contact_id = current_contact_id());

-- Staff read and write tenant files (uploading on a member's behalf keeps the
-- MEMBER as owner — that is the owner_contact_id column, not this policy).
DROP POLICY IF EXISTS files_staff_rw ON files;
CREATE POLICY files_staff_rw ON files FOR ALL TO authenticated
  USING (has_staff_access() AND org_id = current_org())
  WITH CHECK (has_staff_access() AND org_id = current_org());

-- Members read ORG-owned files only through a PUBLISHED catalogue entry.
DROP POLICY IF EXISTS files_org_published_read ON files;
CREATE POLICY files_org_published_read ON files FOR SELECT TO authenticated
  USING (
    owner_kind = 'org'
    AND deleted_at IS NULL
    AND is_active_member()
    AND EXISTS (
      SELECT 1 FROM public.content_resources cr
       WHERE cr.file_id = files.id AND cr.published
    )
  );

-- ============================================================
-- 2. file_links — surfacing, by reference
-- ============================================================
CREATE TABLE IF NOT EXISTS file_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL DEFAULT current_org() REFERENCES organizations(id),
  file_id            uuid NOT NULL REFERENCES files(id),

  -- The open-ended surface list, as (type, id) — the status_events shape. A new
  -- consuming surface is one line added to this CHECK, not a new column and not
  -- a new table.
  subject_type       text NOT NULL CHECK (subject_type IN (
                       'contact', 'account', 'deal', 'contract', 'document',
                       'horse', 'stable', 'lesson', 'offering', 'purchase',
                       'booking', 'lead', 'directory_listing', 'org'
                     )),
  subject_id         uuid NOT NULL,

  created_by_user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  deleted_at         timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS file_links_unique_live_idx
  ON file_links (file_id, subject_type, subject_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS file_links_subject_idx
  ON file_links (subject_type, subject_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS file_links_file_idx ON file_links (file_id);

ALTER TABLE file_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS file_links_org_boundary ON file_links;
CREATE POLICY file_links_org_boundary ON file_links AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = current_org()) WITH CHECK (org_id = current_org());

DROP POLICY IF EXISTS file_links_staff_rw ON file_links;
CREATE POLICY file_links_staff_rw ON file_links FOR ALL TO authenticated
  USING (has_staff_access() AND org_id = current_org())
  WITH CHECK (has_staff_access() AND org_id = current_org());

-- An owner sees where their own file has been surfaced. The EXISTS is evaluated
-- under the caller's own RLS on `files`, so it resolves to exactly "a file I can
-- see" without restating the ownership test.
DROP POLICY IF EXISTS file_links_owner_read ON file_links;
CREATE POLICY file_links_owner_read ON file_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.files f WHERE f.id = file_links.file_id));

-- …and can withdraw it. Surfacing is permission, so the owner can revoke it;
-- soft-delete only, and never a hard DELETE of the link history.
DROP POLICY IF EXISTS file_links_owner_unlink ON file_links;
CREATE POLICY file_links_owner_unlink ON file_links FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.files f
     WHERE f.id = file_links.file_id
       AND f.owner_kind = 'contact'
       AND f.owner_contact_id = current_contact_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.files f
     WHERE f.id = file_links.file_id
       AND f.owner_kind = 'contact'
       AND f.owner_contact_id = current_contact_id()
  ));

-- ============================================================
-- 4. storage.objects — the `facility-files` policies
--    Path: {org_id}/{owner_kind}/{owner_id}/{file_id}-{filename}
-- ============================================================

-- Member: their own prefix, read and write.
DROP POLICY IF EXISTS files_owner_object_rw ON storage.objects;
CREATE POLICY files_owner_object_rw ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'facility-files'
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
    AND split_part(name, '/', 2) = 'contact'
    AND try_cast_uuid(split_part(name, '/', 3)) = current_contact_id()
  )
  WITH CHECK (
    bucket_id = 'facility-files'
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
    AND split_part(name, '/', 2) = 'contact'
    AND try_cast_uuid(split_part(name, '/', 3)) = current_contact_id()
  );

-- Staff: the tenant's prefix, read and write.
DROP POLICY IF EXISTS files_staff_object_rw ON storage.objects;
CREATE POLICY files_staff_object_rw ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'facility-files'
    AND has_staff_access()
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
  )
  WITH CHECK (
    bucket_id = 'facility-files'
    AND has_staff_access()
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
  );

-- Member: org-owned objects, read only, and only when PUBLISHED.
DROP POLICY IF EXISTS files_org_published_object_read ON storage.objects;
CREATE POLICY files_org_published_object_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'facility-files'
    AND split_part(name, '/', 2) = 'org'
    AND try_cast_uuid(split_part(name, '/', 1)) = current_org()
    AND is_active_member()
    AND EXISTS (
      SELECT 1 FROM public.content_resources cr
       WHERE cr.storage_path = storage.objects.name AND cr.published
    )
  );

-- ============================================================
-- 5. D1a — close the bare-is_admin() storage hole
--    `storage_admin_all` granted ALL on every object in every bucket to anyone
--    passing is_admin(), which includes SUPER_ADMIN — i.e. the PLATFORM account,
--    which holds no tenant rows by design and must hold no tenant files either.
--    current_org() is NULL for it, so one added condition denies it while every
--    tenant admin keeps exactly what they had.
-- ============================================================
DROP POLICY IF EXISTS storage_admin_all ON storage.objects;
CREATE POLICY storage_admin_all ON storage.objects FOR ALL TO authenticated
  USING (is_admin() AND current_org() IS NOT NULL)
  WITH CHECK (is_admin() AND current_org() IS NOT NULL);
