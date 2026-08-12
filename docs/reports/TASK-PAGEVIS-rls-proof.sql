-- TASK-PAGEVIS behavioural proofs. Run inside BEGIN … ROLLBACK.
-- Expected-failure cases are wrapped in SAVEPOINTs so one refusal does not
-- abort the rest of the run.
--
-- Identities:
--   FHE ADMIN      b45a5503-89bc-489a-b012-c7fbf5c09632  admin@fhequestrian.com
--   FHE USER       d226273d-b3a6-4fff-95aa-393160976c70  sarahrosengard@gmail.com
--   PLATFORM owner 3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5  admin@cactai.io (org NULL, D1a)

\set ON_ERROR_STOP 0
\set FHE_ADMIN '''b45a5503-89bc-489a-b012-c7fbf5c09632'''
\set FHE_USER  '''d226273d-b3a6-4fff-95aa-393160976c70'''
\set PLATFORM  '''3c5d6af1-ce10-45c0-afbb-1ddbdfc77bd5'''
\set TENANT_B  '''00000000-0000-4000-8000-0000000000b2'''
\set B_ADMIN   '''d4a30809-8fe7-4db8-8f13-de69df7847d7'''

\echo ''
\echo '=== P1 — FHE admin hides ONE page; org_modules is untouched ==='
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :FHE_ADMIN, true) \gset ignore_
SELECT set_page_hidden('boarding.facilities', true) AS hidden;
SELECT page_key, hidden_by_user_id IS NOT NULL AS stamped FROM org_page_visibility ORDER BY page_key;
SELECT * FROM my_hidden_pages();
RESET ROLE;
SELECT module_key, enabled FROM org_modules WHERE module_key LIKE 'mod.%' ORDER BY module_key;

\echo ''
\echo '=== P2 — the SIBLINGS in that same module stay visible ==='
SELECT 'boarding.hub'        AS sibling, EXISTS(SELECT 1 FROM org_page_visibility WHERE page_key='boarding.hub')        AS hidden
UNION ALL SELECT 'boarding.agreements', EXISTS(SELECT 1 FROM org_page_visibility WHERE page_key='boarding.agreements')
UNION ALL SELECT 'boarding.charges',    EXISTS(SELECT 1 FROM org_page_visibility WHERE page_key='boarding.charges');

\echo ''
\echo '=== P3 — unhide is a DELETE; the row goes ==='
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :FHE_ADMIN, true) \gset ignore_
SELECT set_page_hidden('boarding.facilities', false) AS hidden;
SELECT count(*) AS rows_left FROM org_page_visibility;
RESET ROLE;

\echo ''
\echo '=== P4 — the settings page can NEVER be hidden (refused in the DB) ==='
SAVEPOINT s4;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :FHE_ADMIN, true) \gset ignore_
SELECT set_page_hidden('settings.page_visibility', true);
ROLLBACK TO SAVEPOINT s4;
SELECT count(*) AS rows_after_protected_attempt FROM org_page_visibility;

\echo ''
\echo '=== P5 — a ROUTE PATH is not a page key (the rename trap, refused) ==='
SAVEPOINT s5;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :FHE_ADMIN, true) \gset ignore_
SELECT set_page_hidden('/app/ops/boarding/facilities', true);
ROLLBACK TO SAVEPOINT s5;

\echo ''
\echo '=== P6 — a plain member cannot hide anything ==='
SAVEPOINT s6;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :FHE_USER, true) \gset ignore_
SELECT set_page_hidden('community.activity', true);
ROLLBACK TO SAVEPOINT s6;

\echo ''
\echo '=== P7 — D1a: the PLATFORM owner (org_id NULL) is denied. CORRECT, not a bug ==='
SAVEPOINT s7;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :PLATFORM, true) \gset ignore_
SELECT set_page_hidden('community.activity', true);
ROLLBACK TO SAVEPOINT s7;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :PLATFORM, true) \gset ignore_
SELECT count(*) AS platform_reads FROM my_hidden_pages();
RESET ROLE;

\echo ''
\echo '=== P8 — CROSS-TENANT, against a throwaway second tenant ==='
INSERT INTO organizations (id, name, slug)
VALUES (:TENANT_B, 'Proof Tenant B', 'proof-tenant-b');
UPDATE profiles SET org_id = :TENANT_B, role='ADMIN' WHERE user_id = :B_ADMIN;

\echo '-- tenant B hides one of ITS pages:'
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :B_ADMIN, true) \gset ignore_
SELECT set_page_hidden('community.moderation', true) AS b_hid;
SELECT count(*) AS b_sees FROM my_hidden_pages();
RESET ROLE;

\echo '-- FHE admin READ across the boundary — must be 0 by RPC AND by table:'
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :FHE_ADMIN, true) \gset ignore_
SELECT count(*) AS fhe_sees_via_rpc   FROM my_hidden_pages();
SELECT count(*) AS fhe_sees_via_table FROM org_page_visibility;

\echo '-- FHE admin hiding the SAME key makes its OWN row, never touching B''s:'
SELECT set_page_hidden('community.moderation', true);
RESET ROLE;
SELECT o.slug, v.page_key FROM org_page_visibility v JOIN organizations o ON o.id = v.org_id ORDER BY o.slug;

\echo '-- FHE admin UNHIDE deletes only its own row; tenant B''s survives:'
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :FHE_ADMIN, true) \gset ignore_
SELECT set_page_hidden('community.moderation', false);
RESET ROLE;
SELECT o.slug, v.page_key FROM org_page_visibility v JOIN organizations o ON o.id = v.org_id ORDER BY o.slug;

\echo '-- direct table writes across the boundary — UPDATE/DELETE match 0 rows:'
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :FHE_ADMIN, true) \gset ignore_
WITH x AS (UPDATE org_page_visibility SET page_key='mgmt.deals' WHERE org_id = :TENANT_B RETURNING 1)
SELECT count(*) AS fhe_updated_b_rows FROM x;
WITH x AS (DELETE FROM org_page_visibility WHERE org_id = :TENANT_B RETURNING 1)
SELECT count(*) AS fhe_deleted_b_rows FROM x;

\echo '-- and INSERT into tenant B is refused outright:'
SAVEPOINT s8;
INSERT INTO org_page_visibility (org_id, page_key) VALUES (:TENANT_B, 'mgmt.support');
ROLLBACK TO SAVEPOINT s8;
RESET ROLE;

\echo '-- tenant B still holds exactly its one row:'
SELECT o.slug, v.page_key FROM org_page_visibility v JOIN organizations o ON o.id = v.org_id ORDER BY o.slug;
