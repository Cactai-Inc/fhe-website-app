\set ON_ERROR_STOP on
\pset pager off

-- ── identities ───────────────────────────────────────────────────────────────
\set ORG      '''e656f20b-ef43-4725-9029-19e7f0190d9c'''
\set UID_A    '''d226273d-b3a6-4fff-95aa-393160976c70'''  -- sarahrosengard@ (member A)
\set CID_A    '''b996dd2c-ad05-41d7-a5eb-3a5807ff0eb6'''
\set UID_B    '''d9f57a2f-d009-46dd-a77c-bcc2803c7e85'''  -- maeboon@ (member B)
\set CID_B    '''bce1bcf7-e0bc-4374-bb13-9f9cef5db204'''
\set UID_S    '''b45a5503-89bc-489a-b012-c7fbf5c09632'''  -- admin@fhequestrian (TENANT staff)
\set UID_P    '''3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'''  -- admin@cactai.io (PLATFORM owner, org NULL)

-- fixed ids so paths are predictable
\set F_A      '''aaaa0000-0000-4000-8000-000000000001'''
\set F_ORG    '''aaaa0000-0000-4000-8000-000000000002'''
\set F_ORGUN  '''aaaa0000-0000-4000-8000-000000000003'''

-- ── seed (superuser, RLS bypassed) ───────────────────────────────────────────
RESET ROLE;

INSERT INTO files (id, org_id, owner_kind, owner_contact_id, storage_path, filename, mime_type, byte_size, title)
VALUES
  (:F_A,     :ORG, 'contact', :CID_A,
   'e656f20b-ef43-4725-9029-19e7f0190d9c/contact/b996dd2c-ad05-41d7-a5eb-3a5807ff0eb6/aaaa0000-0000-4000-8000-000000000001-coggins.pdf',
   'coggins.pdf', 'application/pdf', 1024, 'Coggins'),
  (:F_ORG,   :ORG, 'org', NULL,
   'e656f20b-ef43-4725-9029-19e7f0190d9c/org/e656f20b-ef43-4725-9029-19e7f0190d9c/aaaa0000-0000-4000-8000-000000000002-guide.pdf',
   'guide.pdf', 'application/pdf', 2048, 'Boarding guide'),
  (:F_ORGUN, :ORG, 'org', NULL,
   'e656f20b-ef43-4725-9029-19e7f0190d9c/org/e656f20b-ef43-4725-9029-19e7f0190d9c/aaaa0000-0000-4000-8000-000000000003-draft.pdf',
   'draft.pdf', 'application/pdf', 512, 'Unpublished draft');

INSERT INTO content_resources (org_id, title, kind, storage_path, file_id, published)
SELECT :ORG, f.title, 'file', f.storage_path, f.id, (f.id = :F_ORG)
  FROM files f WHERE f.id IN (:F_ORG, :F_ORGUN);

-- member A's file surfaced on a horse record (a reference, not a copy)
INSERT INTO file_links (org_id, file_id, subject_type, subject_id)
VALUES (:ORG, :F_A, 'horse', '11111111-1111-4111-8111-111111111111');

-- the same three objects in storage
INSERT INTO storage.objects (bucket_id, name, owner)
SELECT 'facility-files', f.storage_path, NULL FROM files f
 WHERE f.id IN (:F_A, :F_ORG, :F_ORGUN);

\echo ''
\echo '════════ SEED ════════'
SELECT owner_kind, coalesce(owner_contact_id::text, '(org)') AS owner, filename FROM files ORDER BY filename;

-- ═════════════════════════════════════════════════════════════════════════════
-- PROOF 1 — files table visibility, per identity
-- ═════════════════════════════════════════════════════════════════════════════
\echo ''
\echo '════════ PROOF 1: SELECT on files ════════'

CREATE TEMP TABLE uploads_proof_p1(who text, sees text);
GRANT ALL ON uploads_proof_p1 TO authenticated, anon;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d226273d-b3a6-4fff-95aa-393160976c70","role":"authenticated"}', true);
INSERT INTO uploads_proof_p1 SELECT 'A (owner)', coalesce(string_agg(filename, ', ' ORDER BY filename), '(nothing)') FROM files;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d9f57a2f-d009-46dd-a77c-bcc2803c7e85","role":"authenticated"}', true);
INSERT INTO uploads_proof_p1 SELECT 'B (other member)', coalesce(string_agg(filename, ', ' ORDER BY filename), '(nothing)') FROM files;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"b45a5503-89bc-489a-b012-c7fbf5c09632","role":"authenticated"}', true);
INSERT INTO uploads_proof_p1 SELECT 'STAFF (tenant admin)', coalesce(string_agg(filename, ', ' ORDER BY filename), '(nothing)') FROM files;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5","role":"authenticated"}', true);
INSERT INTO uploads_proof_p1 SELECT 'PLATFORM OWNER (D1a)', coalesce(string_agg(filename, ', ' ORDER BY filename), '(nothing)') FROM files;
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '', true);
INSERT INTO uploads_proof_p1 SELECT 'anon', coalesce(string_agg(filename, ', ' ORDER BY filename), '(nothing)') FROM files;
RESET ROLE;

SELECT who AS "identity", sees AS "files it can read" FROM uploads_proof_p1;

-- ═════════════════════════════════════════════════════════════════════════════
-- PROOF 2 — storage.objects visibility (signed URLs need SELECT here)
-- ═════════════════════════════════════════════════════════════════════════════
\echo ''
\echo '════════ PROOF 2: SELECT on storage.objects (facility-files) ════════'

CREATE TEMP TABLE uploads_proof_p2(who text, sees text);
GRANT ALL ON uploads_proof_p2 TO authenticated, anon;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d226273d-b3a6-4fff-95aa-393160976c70","role":"authenticated"}', true);
INSERT INTO uploads_proof_p2 SELECT 'A (owner)', coalesce(string_agg(split_part(name,'/',4), ', ' ORDER BY name), '(nothing)')
  FROM storage.objects WHERE bucket_id='facility-files';
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d9f57a2f-d009-46dd-a77c-bcc2803c7e85","role":"authenticated"}', true);
INSERT INTO uploads_proof_p2 SELECT 'B (other member)', coalesce(string_agg(split_part(name,'/',4), ', ' ORDER BY name), '(nothing)')
  FROM storage.objects WHERE bucket_id='facility-files';
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"b45a5503-89bc-489a-b012-c7fbf5c09632","role":"authenticated"}', true);
INSERT INTO uploads_proof_p2 SELECT 'STAFF (tenant admin)', coalesce(string_agg(split_part(name,'/',4), ', ' ORDER BY name), '(nothing)')
  FROM storage.objects WHERE bucket_id='facility-files';
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5","role":"authenticated"}', true);
INSERT INTO uploads_proof_p2 SELECT 'PLATFORM OWNER (D1a)', coalesce(string_agg(split_part(name,'/',4), ', ' ORDER BY name), '(nothing)')
  FROM storage.objects WHERE bucket_id='facility-files';
RESET ROLE;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '', true);
INSERT INTO uploads_proof_p2 SELECT 'anon', coalesce(string_agg(split_part(name,'/',4), ', ' ORDER BY name), '(nothing)')
  FROM storage.objects WHERE bucket_id='facility-files';
RESET ROLE;

SELECT who AS "identity", sees AS "objects it can read" FROM uploads_proof_p2;

-- ═════════════════════════════════════════════════════════════════════════════
-- PROOF 3 — D1a on EVERY bucket: the platform owner before/after storage_admin_all
-- ═════════════════════════════════════════════════════════════════════════════
\echo ''
\echo '════════ PROOF 3: platform owner across all 12 buckets ════════'
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5","role":"authenticated"}', true);
SELECT count(*) AS "objects the platform owner can read, all buckets" FROM storage.objects;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"b45a5503-89bc-489a-b012-c7fbf5c09632","role":"authenticated"}', true);
SELECT count(*) AS "objects the TENANT admin can read, all buckets" FROM storage.objects;
RESET ROLE;

-- ═════════════════════════════════════════════════════════════════════════════
-- PROOF 4 — writes: who may claim ownership of what
-- ═════════════════════════════════════════════════════════════════════════════
\echo ''
\echo '════════ PROOF 4: INSERT attempts ════════'

CREATE TEMP TABLE uploads_proof_p4(scenario text, outcome text);
GRANT ALL ON uploads_proof_p4 TO authenticated, anon;

-- 4a. member A uploads their own file  → ALLOWED
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d226273d-b3a6-4fff-95aa-393160976c70","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO files (owner_kind, owner_contact_id, storage_path, filename)
  VALUES ('contact', current_contact_id(),
          current_org()::text || '/contact/' || current_contact_id()::text || '/x1-mine.pdf', 'mine.pdf');
  INSERT INTO uploads_proof_p4 VALUES ('A uploads a file it owns', 'ALLOWED  ← correct');
EXCEPTION WHEN others THEN
  INSERT INTO uploads_proof_p4 VALUES ('A uploads a file it owns', 'DENIED (' || SQLERRM || ')  ← WRONG');
END $$;
RESET ROLE;

-- 4b. member A claims a file owned by member B  → DENIED
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d226273d-b3a6-4fff-95aa-393160976c70","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO files (owner_kind, owner_contact_id, storage_path, filename)
  VALUES ('contact', 'bce1bcf7-e0bc-4374-bb13-9f9cef5db204',
          current_org()::text || '/contact/bce1bcf7-e0bc-4374-bb13-9f9cef5db204/x2-theirs.pdf', 'theirs.pdf');
  INSERT INTO uploads_proof_p4 VALUES ('A writes a row owned by B', 'ALLOWED  ← WRONG');
EXCEPTION WHEN others THEN
  INSERT INTO uploads_proof_p4 VALUES ('A writes a row owned by B', 'DENIED  ← correct');
END $$;
RESET ROLE;

-- 4c. member A claims ORG ownership  → DENIED
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d226273d-b3a6-4fff-95aa-393160976c70","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO files (owner_kind, owner_contact_id, storage_path, filename)
  VALUES ('org', NULL, current_org()::text || '/org/' || current_org()::text || '/x3-company.pdf', 'company.pdf');
  INSERT INTO uploads_proof_p4 VALUES ('A claims ORG ownership', 'ALLOWED  ← WRONG');
EXCEPTION WHEN others THEN
  INSERT INTO uploads_proof_p4 VALUES ('A claims ORG ownership', 'DENIED  ← correct');
END $$;
RESET ROLE;

-- 4d. staff uploads ON BEHALF OF member B — B stays the owner  → ALLOWED
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"b45a5503-89bc-489a-b012-c7fbf5c09632","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO files (owner_kind, owner_contact_id, storage_path, filename)
  VALUES ('contact', 'bce1bcf7-e0bc-4374-bb13-9f9cef5db204',
          current_org()::text || '/contact/bce1bcf7-e0bc-4374-bb13-9f9cef5db204/x4-scanned.pdf', 'scanned.pdf');
  INSERT INTO uploads_proof_p4 VALUES ('STAFF scans a file FOR B (B owns it)', 'ALLOWED  ← correct');
EXCEPTION WHEN others THEN
  INSERT INTO uploads_proof_p4 VALUES ('STAFF scans a file FOR B (B owns it)', 'DENIED (' || SQLERRM || ')  ← WRONG');
END $$;
RESET ROLE;

-- 4e. platform owner writes a tenant file  → DENIED (D1a)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO files (org_id, owner_kind, owner_contact_id, storage_path, filename)
  VALUES ('e656f20b-ef43-4725-9029-19e7f0190d9c', 'org', NULL,
          'e656f20b-ef43-4725-9029-19e7f0190d9c/org/e656f20b-ef43-4725-9029-19e7f0190d9c/x5-platform.pdf', 'platform.pdf');
  INSERT INTO uploads_proof_p4 VALUES ('PLATFORM OWNER writes a tenant file', 'ALLOWED  ← WRONG');
EXCEPTION WHEN others THEN
  INSERT INTO uploads_proof_p4 VALUES ('PLATFORM OWNER writes a tenant file', 'DENIED  ← correct');
END $$;
RESET ROLE;

-- 4f. member A uploads an OBJECT under member B's prefix  → DENIED
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d226273d-b3a6-4fff-95aa-393160976c70","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('facility-files',
          'e656f20b-ef43-4725-9029-19e7f0190d9c/contact/bce1bcf7-e0bc-4374-bb13-9f9cef5db204/x6-intruder.pdf');
  INSERT INTO uploads_proof_p4 VALUES ('A writes an OBJECT under B''s prefix', 'ALLOWED  ← WRONG');
EXCEPTION WHEN others THEN
  INSERT INTO uploads_proof_p4 VALUES ('A writes an OBJECT under B''s prefix', 'DENIED  ← correct');
END $$;
RESET ROLE;

-- 4g. member A uploads an OBJECT under its own prefix  → ALLOWED
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d226273d-b3a6-4fff-95aa-393160976c70","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO storage.objects (bucket_id, name)
  VALUES ('facility-files',
          'e656f20b-ef43-4725-9029-19e7f0190d9c/contact/b996dd2c-ad05-41d7-a5eb-3a5807ff0eb6/x7-ok.pdf');
  INSERT INTO uploads_proof_p4 VALUES ('A writes an OBJECT under its own prefix', 'ALLOWED  ← correct');
EXCEPTION WHEN others THEN
  INSERT INTO uploads_proof_p4 VALUES ('A writes an OBJECT under its own prefix', 'DENIED (' || SQLERRM || ')  ← WRONG');
END $$;
RESET ROLE;

-- 4h. the path grammar CHECK: a row that lies about where its bytes live
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d226273d-b3a6-4fff-95aa-393160976c70","role":"authenticated"}', true);
DO $$
BEGIN
  INSERT INTO files (owner_kind, owner_contact_id, storage_path, filename)
  VALUES ('contact', current_contact_id(),
          current_org()::text || '/contact/bce1bcf7-e0bc-4374-bb13-9f9cef5db204/x8-lie.pdf', 'lie.pdf');
  INSERT INTO uploads_proof_p4 VALUES ('A''s row points at B''s path', 'ALLOWED  ← WRONG');
EXCEPTION WHEN others THEN
  INSERT INTO uploads_proof_p4 VALUES ('A''s row points at B''s path', 'DENIED  ← correct');
END $$;
RESET ROLE;

SELECT scenario, outcome FROM uploads_proof_p4;

-- ═════════════════════════════════════════════════════════════════════════════
-- PROOF 5 — published gates org material
-- ═════════════════════════════════════════════════════════════════════════════
\echo ''
\echo '════════ PROOF 5: published gates the org catalogue ════════'
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d9f57a2f-d009-46dd-a77c-bcc2803c7e85","role":"authenticated"}', true);
SELECT 'member B, org-owned files' AS check,
       coalesce(string_agg(filename, ', ' ORDER BY filename), '(nothing)') AS visible
  FROM files WHERE owner_kind = 'org';
RESET ROLE;

-- flip the published flag and re-read
RESET ROLE;
UPDATE content_resources SET published = false WHERE file_id = 'aaaa0000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d9f57a2f-d009-46dd-a77c-bcc2803c7e85","role":"authenticated"}', true);
SELECT 'same member, after unpublishing the guide' AS check,
       coalesce(string_agg(filename, ', ' ORDER BY filename), '(nothing)') AS visible
  FROM files WHERE owner_kind = 'org';
RESET ROLE;
UPDATE content_resources SET published = true WHERE file_id = 'aaaa0000-0000-4000-8000-000000000002';

-- ═════════════════════════════════════════════════════════════════════════════
-- PROOF 6 — file_links: one file, surfaced by reference
-- ═════════════════════════════════════════════════════════════════════════════
\echo ''
\echo '════════ PROOF 6: file_links ════════'
CREATE TEMP TABLE uploads_proof_p6(who text, links text);
GRANT ALL ON uploads_proof_p6 TO authenticated, anon;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d226273d-b3a6-4fff-95aa-393160976c70","role":"authenticated"}', true);
INSERT INTO uploads_proof_p6 SELECT 'A (owner of the file)',
  coalesce(string_agg(subject_type, ', '), '(nothing)') FROM file_links;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"d9f57a2f-d009-46dd-a77c-bcc2803c7e85","role":"authenticated"}', true);
INSERT INTO uploads_proof_p6 SELECT 'B (other member)',
  coalesce(string_agg(subject_type, ', '), '(nothing)') FROM file_links;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"b45a5503-89bc-489a-b012-c7fbf5c09632","role":"authenticated"}', true);
INSERT INTO uploads_proof_p6 SELECT 'STAFF',
  coalesce(string_agg(subject_type, ', '), '(nothing)') FROM file_links;
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5","role":"authenticated"}', true);
INSERT INTO uploads_proof_p6 SELECT 'PLATFORM OWNER (D1a)',
  coalesce(string_agg(subject_type, ', '), '(nothing)') FROM file_links;
RESET ROLE;

SELECT who AS "identity", links AS "surfacings it can see" FROM uploads_proof_p6;

SELECT count(*) AS "files rows for the surfaced Coggins (must be 1, not 2)"
  FROM files WHERE filename = 'coggins.pdf';

-- ═════════════════════════════════════════════════════════════════════════════
-- PROOF 7 — grants. No functions were created; prove that, then show the
--           privilege state of every function the new policies call.
-- ═════════════════════════════════════════════════════════════════════════════
\echo ''
\echo '════════ PROOF 7: grants (raw) ════════'
SELECT p.proname AS function,
       has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated,
       has_function_privilege('public',        p.oid, 'EXECUTE') AS "PUBLIC"
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('current_org','current_contact_id','has_staff_access','is_active_member','is_admin','try_cast_uuid')
 ORDER BY 1;
