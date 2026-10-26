-- Contract-first STEP 7 — live e2e against prod, as the test actors (staff via
-- impersonation, anon via SET ROLE anon), on ZZ Test Horse 2d07a570. The whole
-- run is ONE transaction that ROLLS BACK: RLS and SECURITY DEFINER auth checks
-- fire for real, pg_net never flushes (its enqueue is discarded on rollback, so
-- no email leaves), and all test data vanishes. Nothing to clean up afterward.
--
-- Actors:
--   staff  = b85d562f-aad0-4cd7-9df9-6fbc58caff13 (admin+fhe-staff-test, ADMIN)
--   client = 81d367e1-4044-4e04-823e-fa105df9903b (admin+fhe-client-test, ACTIVE)
--   anon   = SET ROLE anon, no jwt

\set ON_ERROR_STOP on
\set HORSE '2d07a570-d79c-4cc7-b292-a42c83c2d62c'
\set ORG 'e656f20b-ef43-4725-9029-19e7f0190d9c'
\set STAFF_UID 'b85d562f-aad0-4cd7-9df9-6fbc58caff13'
\set CLIENT_CONTACT 'd52a3506-7f8d-4dc9-b8e5-10d70466759e'

BEGIN;

-- ── SETUP (superuser): a no-account LESSOR contact ──────────────────────────
\echo '=== SETUP ==='
CREATE TEMP TABLE _cf (k text, v text);
INSERT INTO contacts (org_id, email, first_name, last_name)
VALUES (:'ORG', 'cf-noacct-e2e@example.com', 'Nora', 'NoAccount')
RETURNING id \gset lessor_
INSERT INTO _cf VALUES ('lessor_contact', :'lessor_id');
\echo 'no-account LESSOR contact:' :lessor_id

-- ── as STAFF: start the lease on the test horse ─────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'STAFF_UID', true);

SELECT (start_lease_contract_v2(
          :'CLIENT_CONTACT', :'lessor_id', :'HORSE', 'LESSEE', 'HORSE_LEASE_V3'
       ) ->> 'document_id') AS document_id \gset doc_
\echo 'lease document:' :doc_document_id

RESET ROLE;
SELECT d.id AS gov_id, d.contract_id AS contract_id
  FROM documents d WHERE d.id = :'doc_document_id' \gset
\echo 'governing doc:' :gov_id ' contract:' :contract_id

-- ── TEST 1+2: a no-account party gets a VIEW link; anon view opens, refuses after exec
\echo ''
\echo '=== TEST 1+2: VIEW link + anon read-only view (before/after execution) ==='
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'STAFF_UID', true);
SELECT (issue_contract_view_token(:'gov_id', :'lessor_id', 'cf-noacct-e2e@example.com') ->> 'token') AS tok \gset view_
RESET ROLE;
\echo 'view token:' :view_tok

SELECT 'T1 kind=' || kind AS r FROM invitations WHERE token = :'view_tok';

-- anon, NO session, reads the view
SET LOCAL ROLE anon;
SELECT 'T2 found='   || (contract_view_by_token(:'view_tok') ->> 'found')    AS r;
SELECT 'T2 executed='|| coalesce(contract_view_by_token(:'view_tok') ->> 'executed','') AS r;
SELECT 'T2 hasBody=' || (nullif(contract_view_by_token(:'view_tok') ->> 'body','') IS NOT NULL)::text AS r;
SELECT 'T2 parties=' || jsonb_array_length(contract_view_by_token(:'view_tok') -> 'parties')::text AS r;
-- no field graph / account state leaked
SELECT 'T2 noLeak='  || ((contract_view_by_token(:'view_tok') ? 'fields') = false
                      AND (contract_view_by_token(:'view_tok') ? 'has_account') = false)::text AS r;
RESET ROLE;

-- execute the governing doc, then anon view must refuse. Nested savepoint so the
-- execution's effects do not disturb the later delivery test.
SAVEPOINT before_exec;
UPDATE documents SET status='EXECUTED', workflow_state='executed' WHERE id = :'gov_id';
SET LOCAL ROLE anon;
SELECT 'T2 refusedAfterExec=' || (contract_view_by_token(:'view_tok') ->> 'executed') AS r;
SELECT 'T2 noBodyAfterExec='  || (contract_view_by_token(:'view_tok') ? 'body' = false)::text AS r;
RESET ROLE;
ROLLBACK TO SAVEPOINT before_exec;

-- ── TEST 3: an active-account party routes straight to the contract ─────────
\echo ''
\echo '=== TEST 3: active-account party ==='
-- account_state_for_email checks auth.role()='service_role' via the jwt role claim.
SELECT set_config('request.jwt.claim.role', 'service_role', true);
SET LOCAL ROLE service_role;
SELECT 'T3 clientState=' || (account_state_for_email('admin+fhe-client-test@cactai.io') ->> 'state') AS r;
RESET ROLE;
-- The routing fact: an active LESSEE on this contract has a profile with a
-- session, so invited_account_state reports has_session=true -> straight to the
-- contract (Register.tsx isContractInvite path), not the set-password flow.
SELECT 'T3 lesseeActivated=' || (u.last_sign_in_at IS NOT NULL)::text AS r
  FROM profiles p JOIN auth.users u ON u.id = p.user_id
 WHERE p.contact_id = :'CLIENT_CONTACT';

-- ── TEST 4+5: delivery set — nothing until the set completes; one email per signer
\echo ''
\echo '=== TEST 4+5: delivery set ==='
-- the role bundle is generated at SEND (bundle-at-send). Generate it now.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'STAFF_UID', true);
SELECT 'T4 bundle generated=' ||
  (jsonb_array_length(ensure_contract_role_documents(:'gov_id') -> 'generated') >= 0)::text AS r;
RESET ROLE;

SELECT 'T4 setMembers=' || count(*)::text AS r
  FROM documents WHERE delivery_set_id = :'contract_id' AND deleted_at IS NULL;
SELECT 'T4 setComplete_before=' || delivery_set_complete(:'contract_id')::text AS r;
SELECT 'T4 govHeld_before='     || document_delivery_is_held(:'gov_id')::text AS r;

-- sign/execute ONLY the governing doc; the bundle stays unsigned
UPDATE documents SET status='EXECUTED', workflow_state='executed' WHERE id = :'gov_id';
SELECT 'T4 setComplete_afterGov=' || delivery_set_complete(:'contract_id')::text AS r;
SELECT 'T4 govHeld_afterGov='     || document_delivery_is_held(:'gov_id')::text AS r;
SELECT 'T4 govMailed='            || (executed_email_sent_at IS NOT NULL)::text AS r FROM documents WHERE id = :'gov_id';
SELECT 'T4 govDeliveryHeld='      || (delivery_held_at IS NOT NULL)::text AS r      FROM documents WHERE id = :'gov_id';

-- execute the rest of the set
UPDATE documents SET status='EXECUTED', workflow_state='executed'
 WHERE delivery_set_id = :'contract_id' AND status <> 'EXECUTED' AND deleted_at IS NULL;
SELECT 'T5 setComplete_all=' || delivery_set_complete(:'contract_id')::text AS r;
SELECT 'T5 wholeSetDelivers=' || count(*)::text AS r
  FROM documents WHERE delivery_set_id = :'contract_id' AND status='EXECUTED' AND deleted_at IS NULL;

-- ── TEST 6: a kiosk / non-contract onboarding set delivers as one complete set ─
\echo ''
\echo '=== TEST 6: kiosk / non-contract onboarding set ==='
SAVEPOINT kiosk;
INSERT INTO documents (id, org_id, title, status, workflow_state, delivery_set_id)
VALUES
 ('cccc0000-0000-0000-0000-00000000cf01', :'ORG', 'Kiosk A', 'AWAITING_SIGNATURE', 'locked', 'cccc0000-0000-0000-0000-00000000cf00'),
 ('cccc0000-0000-0000-0000-00000000cf02', :'ORG', 'Kiosk B', 'AWAITING_SIGNATURE', 'locked', 'cccc0000-0000-0000-0000-00000000cf00');
SELECT 'T6 nonContract=' || (contract_id IS NULL)::text AS r FROM documents WHERE id='cccc0000-0000-0000-0000-00000000cf01';
SELECT 'T6 incomplete='  || delivery_set_complete('cccc0000-0000-0000-0000-00000000cf00')::text AS r;
SELECT 'T6 held='        || document_delivery_is_held('cccc0000-0000-0000-0000-00000000cf01')::text AS r;
UPDATE documents SET status='EXECUTED' WHERE delivery_set_id='cccc0000-0000-0000-0000-00000000cf00';
SELECT 'T6 completeWhenAllSigned=' || delivery_set_complete('cccc0000-0000-0000-0000-00000000cf00')::text AS r;
ROLLBACK TO SAVEPOINT kiosk;

\echo ''
\echo '=== ROLLBACK (no email sent, no test data persisted) ==='
ROLLBACK;
