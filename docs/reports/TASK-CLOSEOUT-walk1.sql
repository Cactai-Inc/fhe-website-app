-- TASK-CLOSEOUT §1.1/§1.2 — dry-run + proof walk. EVERYTHING inside BEGIN … ROLLBACK.
-- Proves, in order:
--   (0) the A3/A2 defects still exist TODAY (verify before fixing),
--   (1) the migration applies,
--   (2) A3 closed: a clean screen and the sign gate AGREE on a document with conditionals,
--   (3) A2 closed: a LOCKED document altered after locking refuses to sign,
--   (4) executed documents refuse further signatures,
--   (5) the ROLLBACK restores the old function body (rollback proven).
\set ON_ERROR_STOP off
\set ON_ERROR_ROLLBACK on
\pset pager off
\timing off

\echo '################ BASELINE (outside txn) ################'
SELECT 'documents' t, count(*) n FROM documents
UNION ALL SELECT 'signatures', count(*) FROM signatures
UNION ALL SELECT 'net.http_request_queue', count(*) FROM net.http_request_queue
ORDER BY 1;
\echo '--- the OLD gate body still carries the naive count (finding verified live):'
SELECT position('v_missing' in pg_get_functiondef(oid)) > 0 AS has_naive_count,
       position('contract_lock_blockers' in pg_get_functiondef(oid)) > 0 AS delegates_to_blockers
  FROM pg_proc WHERE proname='lock_and_sign_contract';

BEGIN;

CREATE TEMP TABLE w (k text PRIMARY KEY, v text) ON COMMIT DROP;
CREATE OR REPLACE FUNCTION pg_temp.put(text, text) RETURNS text LANGUAGE sql AS
  $$ INSERT INTO w VALUES ($1,$2) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v RETURNING v $$;
CREATE OR REPLACE FUNCTION pg_temp.v(text) RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT v FROM w WHERE k=$1 $$;
CREATE OR REPLACE FUNCTION pg_temp.u(text) RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT v::uuid FROM w WHERE k=$1 $$;
CREATE OR REPLACE FUNCTION pg_temp.be(p uuid) RETURNS text LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
    CASE WHEN p IS NULL THEN ''
         ELSE json_build_object('sub', p::text, 'role', 'authenticated')::text END, true) $$;

SELECT pg_temp.put('org',    'e656f20b-ef43-4725-9029-19e7f0190d9c'),
       pg_temp.put('staff',  'b45a5503-89bc-489a-b012-c7fbf5c09632'),
       pg_temp.put('u_lessee','cccc0000-0000-4000-8000-00000000d001'),
       pg_temp.put('u_lessor','cccc0000-0000-4000-8000-00000000d002'),
       pg_temp.put('e_lessee','co-lessee@example.invalid'),
       pg_temp.put('e_lessor','co-lessor@example.invalid');

INSERT INTO auth.users (id, email, is_sso_user, is_anonymous)
SELECT pg_temp.u('u_lessee'), pg_temp.v('e_lessee'), false, false
UNION ALL SELECT pg_temp.u('u_lessor'), pg_temp.v('e_lessor'), false, false;

-- ═══════════ SETUP: provision + redeem the lessee, build the lessor, the horse, the lease
SELECT pg_temp.be(pg_temp.u('staff'));
SELECT pg_temp.put('r1', provision_client_invitation(
         p_email => pg_temp.v('e_lessee'), p_first_name => 'Closeout', p_last_name => 'Lessee',
         p_categories => ARRAY['GUEST'])::text) IS NOT NULL AS provisioned;
SELECT pg_temp.put('lessee_c', (pg_temp.v('r1'))::jsonb->>'contact_id'),
       pg_temp.put('tok1',     (pg_temp.v('r1'))::jsonb->>'token');

SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT redeem_invitation(pg_temp.v('tok1')) AS redeemed;
UPDATE contacts SET phone='+1 555 0100', date_of_birth='1990-01-01',
       emergency_contact_1_name='Pat Kin', emergency_contact_1_phone='+1 555 0199'
 WHERE id = pg_temp.u('lessee_c');

SELECT pg_temp.be(pg_temp.u('staff'));
INSERT INTO contacts (org_id, first_name, last_name, email, contact_type)
SELECT pg_temp.u('org'), 'Closeout', 'Lessor', pg_temp.v('e_lessor'), 'CONTACT';
SELECT pg_temp.put('lessor_c', (SELECT id::text FROM contacts WHERE email = pg_temp.v('e_lessor')));
INSERT INTO profiles (user_id, org_id, email, contact_id, first_name, last_name)
SELECT pg_temp.u('u_lessor'), pg_temp.u('org'), pg_temp.v('e_lessor'), pg_temp.u('lessor_c'), 'Closeout', 'Lessor';
INSERT INTO members (user_id, status, org_id) SELECT pg_temp.u('u_lessor'), 'active', pg_temp.u('org');

INSERT INTO horses (org_id, registered_name, nickname, breed, color, sex, microchip_id,
                    current_owner_contact_id, created_by_contact_id)
SELECT pg_temp.u('org'), 'Closeout Probe', 'Probe', 'HANOVERIAN', 'BAY', 'GELDING',
       'CO-PROBE-0001', pg_temp.u('lessor_c'), pg_temp.u('lessor_c');
SELECT pg_temp.put('horse', (SELECT id::text FROM horses WHERE microchip_id='CO-PROBE-0001'));

SELECT pg_temp.put('r4', start_lease_contract_v2(
         p_lessee_contact_id => pg_temp.u('lessee_c'),
         p_lessor_contact_id => pg_temp.u('lessor_c'),
         p_horse_id          => pg_temp.u('horse'))::text) IS NOT NULL AS lease_started;
SELECT pg_temp.put('doc', (pg_temp.v('r4'))::jsonb->>'document_id'),
       pg_temp.put('ctr', (pg_temp.v('r4'))::jsonb->>'contract_id');

-- fill only what the UI SHOWS (gate-aware): every always-on required field
UPDATE contract_fields SET value='INDIVIDUAL' WHERE document_id=pg_temp.u('doc') AND field_key IN ('LESSOR.PARTY_TYPE','LESSEE.PARTY_TYPE');
UPDATE contract_fields SET value='PARTIAL'    WHERE document_id=pg_temp.u('doc') AND field_key='TXN.LEASE_TYPE';
UPDATE contract_fields SET value='NO'         WHERE document_id=pg_temp.u('doc') AND field_key IN ('TXN.INJURY_HISTORY','TXN.RIDER_AIDS_PROHIBITED');
UPDATE contract_fields SET value=to_char(now()::date,'YYYY-MM-DD') WHERE document_id=pg_temp.u('doc') AND field_key='TXN.LEASE_START';
UPDATE contract_fields SET value='Closeout Probe' WHERE document_id=pg_temp.u('doc') AND field_key='HORSE.REGISTERED_NAME';
UPDATE contract_fields cf SET value = coalesce(
    (SELECT coalesce(o->>'value', o->>'key', o#>>'{}') FROM jsonb_array_elements(cf.options) o
      WHERE jsonb_typeof(cf.options)='array' LIMIT 1), 'Flatwork only')
 WHERE cf.document_id=pg_temp.u('doc') AND cf.required AND cf.conditional_on IS NULL
   AND nullif(trim(coalesce(cf.value,'')),'') IS NULL;

-- the lessor confirms the horse; the lessee clears the wall
SELECT pg_temp.be(pg_temp.u('u_lessor'));
SELECT (confirm_horse_section(pg_temp.u('doc'))) IS NOT NULL AS horse_confirmed;
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT (generate_my_onboarding_documents()) IS NOT NULL AS wall_docs_generated;
UPDATE documents SET executed_email_sent_at = now()
 WHERE contact_id=pg_temp.u('lessee_c') AND id <> pg_temp.u('doc') AND status <> 'EXECUTED';
SELECT t.template_key,
       record_signature(d.id,
         (SELECT dp.party_role FROM document_parties dp
           WHERE dp.document_id=d.id AND dp.contact_id=pg_temp.u('lessee_c') AND dp.is_signer LIMIT 1),
         'Closeout Lessee', NULL, NULL, true) AS status
  FROM documents d JOIN contract_templates t ON t.id=d.template_id
 WHERE d.contact_id=pg_temp.u('lessee_c') AND d.id <> pg_temp.u('doc')
 ORDER BY t.template_key;

-- ═══════════ THE DISAGREEMENT, LIVE (this is the A3 finding, verified today)
\echo ''
\echo '################ P0 — THE SCREEN AND THE OLD GATE DISAGREE ################'
\echo '--- WHAT THE SCREEN SAYS (contract_lock_blockers):'
SELECT jsonb_pretty(contract_lock_blockers(pg_temp.u('doc'))) AS on_screen_blockers;
\echo '--- WHAT THE OLD GATE COUNTS (naive, condition-blind):'
SELECT count(*) AS naive_required_empty,
       count(*) FILTER (WHERE conditional_on IS NOT NULL) AS of_which_conditional
  FROM contract_fields
 WHERE document_id=pg_temp.u('doc') AND required AND nullif(trim(coalesce(value,'')),'') IS NULL;
\echo '--- OLD GATE: the sign attempt with a CLEAN SCREEN (must refuse — the defect):'
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Closeout Lessee', true);

-- ═══════════ APPLY THE MIGRATION (dry-run: inside this txn)
\echo ''
\echo '################ P1 — APPLY 20260819T0100 (in-txn dry-run) ################'
\i supabase/migrations/20260819T0100_closeout_11_one_gate_before_every_signature.sql

-- ═══════════ A3 CLOSED: clean screen and gate agree, on a document WITH conditionals
\echo ''
\echo '################ P2 — A3 CLOSED: SCREEN AND GATE AGREE ################'
SAVEPOINT p_a3;
\echo '--- same document, same clean screen, same 17 naive-empty conditionals — NEW gate:'
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Closeout Lessee', true) AS signed_from_editable;
ROLLBACK TO SAVEPOINT p_a3;

-- ═══════════ lock it, then A2 CLOSED: altered-after-lock refuses
\echo ''
\echo '################ P3 — A2 CLOSED: A LOCKED DOCUMENT CANNOT BE ALTERED AND SIGNED ################'
SELECT pg_temp.be(pg_temp.u('staff'));
SELECT advance_document_workflow(pg_temp.u('doc'), 'locked') AS locked;
SAVEPOINT p_a2;
UPDATE contract_fields SET value=NULL
 WHERE document_id=pg_temp.u('doc') AND field_key='TXN.LEASE_START';
UPDATE documents SET horse_section_confirmed_at=NULL WHERE id=pg_temp.u('doc');
SELECT count(*) AS required_empty_while_locked FROM contract_fields
 WHERE document_id=pg_temp.u('doc') AND required AND conditional_on IS NULL
   AND nullif(trim(coalesce(value,'')),'') IS NULL;
SELECT pg_temp.be(pg_temp.u('u_lessee'));
\echo '--- the CONTRACTWALK attack, replayed against the new gate (must refuse):'
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Closeout Lessee', true) AS signed_anyway;
ROLLBACK TO SAVEPOINT p_a2;

-- ═══════════ the real signatures, to execution
\echo ''
\echo '################ P4 — THE REAL PATH STILL WORKS ################'
SELECT pg_temp.be(pg_temp.u('staff'));
UPDATE documents SET executed_email_sent_at = now() WHERE id=pg_temp.u('doc');
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Closeout Lessee', true) AS after_lessee;
SELECT pg_temp.be(pg_temp.u('u_lessor'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSOR', 'Closeout Lessor', true) AS after_lessor;
SELECT status, workflow_state, execution_hash IS NOT NULL AS has_hash
  FROM documents WHERE id=pg_temp.u('doc');

-- ═══════════ executed refuses a further signature
\echo ''
\echo '################ P5 — EXECUTED TAKES NO FURTHER SIGNATURE ################'
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Closeout Lessee', true);

\echo ''
\echo '--- pg_net queue inside txn (must be unchanged by the walk):'
SELECT count(*) AS pg_net_queue_in_txn FROM net.http_request_queue;

ROLLBACK;

\echo ''
\echo '################ P6 — ROLLBACK PROVEN ################'
\echo '--- the live function body is the OLD one again (naive count back, no delegation):'
SELECT position('v_missing' in pg_get_functiondef(oid)) > 0 AS has_naive_count,
       position('contract_lock_blockers' in pg_get_functiondef(oid)) > 0 AS delegates_to_blockers
  FROM pg_proc WHERE proname='lock_and_sign_contract';
SELECT 'documents' t, count(*) n FROM documents
UNION ALL SELECT 'signatures', count(*) FROM signatures
UNION ALL SELECT 'net.http_request_queue', count(*) FROM net.http_request_queue
ORDER BY 1;
