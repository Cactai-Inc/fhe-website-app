-- TASK-CONTRACTWALK — the walk. EVERYTHING inside BEGIN … ROLLBACK. NEVER COMMIT.
\set ON_ERROR_STOP off
\set ON_ERROR_ROLLBACK on
\pset pager off
\pset format aligned
\timing off

\echo '################ BASELINE (outside txn) ################'
SELECT 'contacts' t, count(*) n FROM contacts
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'auth.users', count(*) FROM auth.users
UNION ALL SELECT 'invitations', count(*) FROM invitations
UNION ALL SELECT 'documents', count(*) FROM documents
UNION ALL SELECT 'document_parties', count(*) FROM document_parties
UNION ALL SELECT 'signatures', count(*) FROM signatures
UNION ALL SELECT 'contract_fields', count(*) FROM contract_fields
UNION ALL SELECT 'contracts', count(*) FROM contracts
UNION ALL SELECT 'horses', count(*) FROM horses
UNION ALL SELECT 'horse_relationships', count(*) FROM horse_relationships
UNION ALL SELECT 'groups', count(*) FROM groups
UNION ALL SELECT 'members', count(*) FROM members
UNION ALL SELECT 'contact_required_documents', count(*) FROM contact_required_documents
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'net.http_request_queue', count(*) FROM net.http_request_queue
ORDER BY 1;

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- SETUP: synthetic identities. Nothing here reuses a real client.
-- ─────────────────────────────────────────────────────────────────────────────
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
       pg_temp.put('u_lessee','cccc0000-0000-4000-8000-00000000c001'),
       pg_temp.put('u_lessor','cccc0000-0000-4000-8000-00000000c002'),
       pg_temp.put('e_lessee','cw-lessee@example.invalid'),
       pg_temp.put('e_lessor','cw-lessor@example.invalid');

INSERT INTO auth.users (id, email, is_sso_user, is_anonymous)
SELECT pg_temp.u('u_lessee'), pg_temp.v('e_lessee'), false, false
UNION ALL SELECT pg_temp.u('u_lessor'), pg_temp.v('e_lessor'), false, false;

\echo ''
\echo '################ IMPERSONATION MECHANISM ################'
\echo 'set_config(request.jwt.claims, {"sub":<user>,"role":"authenticated"}, is_local=true)'
SELECT pg_temp.be(pg_temp.u('staff'));
SELECT auth.uid() AS auth_uid, auth.role() AS auth_role, has_staff_access() AS staff,
       current_org() AS org, current_contact_id() AS acting_contact;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '################ W1 — PROVISION A DEAL CLIENT ################'
\echo '--- W1a: EXACTLY what ProvisionClientForm sends for "Deal client" when the'
\echo '---      prefilled paperwork checkbox list is left UNTOUCHED (templateKeys omitted).'
\echo '---      CATEGORY_TOKEN["Deal client"] === "GUEST", so the RPC receives {GUEST}.'
SELECT pg_temp.be(pg_temp.u('staff'));
SELECT pg_temp.put('r1', provision_client_invitation(
         p_email      => pg_temp.v('e_lessee'),
         p_first_name => 'Walker',
         p_last_name  => 'Dealclient',
         p_categories => ARRAY['GUEST']
       )::text) IS NOT NULL AS provisioned;
SELECT jsonb_pretty((pg_temp.v('r1'))::jsonb) AS provision_result;
SELECT pg_temp.put('lessee_c', (pg_temp.v('r1'))::jsonb->>'contact_id'),
       pg_temp.put('tok1',     (pg_temp.v('r1'))::jsonb->>'token'),
       pg_temp.put('inv1',     (pg_temp.v('r1'))::jsonb->>'invitation_id');

\echo '--- the contact that was created:'
SELECT id, contact_type, first_name, last_name, email FROM contacts WHERE id = pg_temp.u('lessee_c');
\echo '--- clients row (the D8 CLIENT marker):'
SELECT contact_id, source, client_since IS NOT NULL AS client_marked, customer_since IS NOT NULL AS customer_marked
  FROM clients WHERE contact_id = pg_temp.u('lessee_c');

\echo '--- groups rows — task doc claims GUEST:'
SELECT contact_id, group_type FROM groups WHERE contact_id = pg_temp.u('lessee_c') ORDER BY group_type;

\echo '--- contact_required_documents — task doc claims RELEASE_GENERAL AND NOTHING ELSE:'
SELECT template_key FROM contact_required_documents WHERE contact_id = pg_temp.u('lessee_c') ORDER BY 1;

\echo '--- what the ADMIN SAW on screen for "Deal client" (category_document_defaults):'
SELECT category, template_key, title FROM category_document_defaults() WHERE category = 'Deal client';
\echo '--- what "GUEST" resolves to in category_document_requirements (what the RPC used):'
SELECT category, template_key FROM category_document_requirements
 WHERE upper(replace(btrim(category),' ','_')) = 'GUEST' ORDER BY template_key;

\echo '--- the invitation:'
SELECT id, email, status, expires_at, (expires_at::date - now()::date) AS days_valid,
       categories, template_keys, contact_id IS NOT NULL AS anchored, length(token) AS token_len
  FROM invitations WHERE id = pg_temp.u('inv1');
SELECT invitation_expiry_days(pg_temp.u('org')) AS org_expiry_days;

\echo ''
\echo '--- W1b: a RESEND — same person, this time the admin TOUCHED the checkbox list'
\echo '---      so templateKeys = {RELEASE_GENERAL} is sent explicitly.'
SELECT pg_temp.put('r2', provision_client_invitation(
         p_email => pg_temp.v('e_lessee'), p_first_name => 'Walker', p_last_name => 'Dealclient',
         p_categories => ARRAY['GUEST'], p_template_keys => ARRAY['RELEASE_GENERAL']
       )::text) IS NOT NULL AS provisioned2;
SELECT pg_temp.put('tok2', (pg_temp.v('r2'))::jsonb->>'token'),
       pg_temp.put('inv2', (pg_temp.v('r2'))::jsonb->>'invitation_id');
\echo '--- invitations for this person now (prior superseded?):'
SELECT id, status, expires_at, template_keys FROM invitations
 WHERE email = pg_temp.v('e_lessee') ORDER BY created_at;
\echo '--- contact_required_documents after the admin-touched path:'
SELECT template_key FROM contact_required_documents WHERE contact_id = pg_temp.u('lessee_c') ORDER BY 1;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '################ W2 — REDEEM, AND THE FAILURE MODES ################'
\echo '--- W2 fail A: EXPIRED token'
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SAVEPOINT s_exp;
UPDATE invitations SET expires_at = now() - interval '1 day' WHERE id = pg_temp.u('inv2');
SELECT redeem_invitation(pg_temp.v('tok2'));
ROLLBACK TO SAVEPOINT s_exp;

\echo ''
\echo '--- W2 fail B: SUPERSEDED token — the client clicks the link in the FIRST email'
SELECT redeem_invitation(pg_temp.v('tok1'));

\echo ''
\echo '--- W2 fail C: signed in with a DIFFERENT email than the invitation names'
SELECT pg_temp.be(pg_temp.u('u_lessor'));
SELECT redeem_invitation(pg_temp.v('tok2'));

\echo ''
\echo '--- W2 fail D: not signed in at all'
SELECT pg_temp.be(NULL);
SELECT redeem_invitation(pg_temp.v('tok2'));

\echo ''
\echo '--- W2 SUCCESS: live token, signed in as the invited email'
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT redeem_invitation(pg_temp.v('tok2')) AS redeemed;

\echo ''
\echo '--- W2 fail E: the SAME link clicked a second time'
SELECT redeem_invitation(pg_temp.v('tok2'));

\echo ''
\echo '--- proof of redemption:'
SELECT user_id, email, org_id IS NOT NULL AS has_org, contact_id, role FROM profiles WHERE user_id = pg_temp.u('u_lessee');
SELECT user_id, status FROM members WHERE user_id = pg_temp.u('u_lessee');
SELECT id, status, redeemed_at IS NOT NULL AS redeemed FROM invitations WHERE email = pg_temp.v('e_lessee') ORDER BY created_at;
SELECT contact_id, group_type FROM groups WHERE contact_id = pg_temp.u('lessee_c');

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '################ W3 — THE FIRST SCREEN AFTER ACTIVATION ################'
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT jsonb_pretty(my_onboarding_state() - 'prefill') AS onboarding_state;
SELECT jsonb_pretty(my_wall_state()) AS wall_state;

\echo '--- the four profile fields that gate completion:'
SELECT contact_profile_complete(pg_temp.u('lessee_c')) AS profile_complete_before;
UPDATE contacts SET phone='+1 555 0100', date_of_birth='1990-01-01',
       emergency_contact_1_name='Pat Kin', emergency_contact_1_phone='+1 555 0199'
 WHERE id = pg_temp.u('lessee_c');
SELECT contact_profile_complete(pg_temp.u('lessee_c')) AS profile_complete_after;
SELECT (my_onboarding_state()->>'needed')::boolean AS docs_still_needed,
       (my_onboarding_state()->>'horse_needed')::boolean AS horse_needed,
       (my_onboarding_state()->>'profile_complete')::boolean AS profile_complete;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '################ W4 — CREATE THE LEASE AND ATTACH PARTIES ################'
SELECT pg_temp.be(pg_temp.u('staff'));

INSERT INTO contacts (org_id, first_name, last_name, email, contact_type)
SELECT pg_temp.u('org'), 'Olive', 'Lessor', pg_temp.v('e_lessor'), 'CONTACT';
SELECT pg_temp.put('lessor_c', (SELECT id::text FROM contacts WHERE email = pg_temp.v('e_lessor')));
INSERT INTO profiles (user_id, org_id, email, contact_id, first_name, last_name)
SELECT pg_temp.u('u_lessor'), pg_temp.u('org'), pg_temp.v('e_lessor'), pg_temp.u('lessor_c'), 'Olive', 'Lessor';
INSERT INTO members (user_id, status, org_id) SELECT pg_temp.u('u_lessor'), 'active', pg_temp.u('org');

INSERT INTO horses (org_id, registered_name, nickname, breed, color, sex, microchip_id,
                    current_owner_contact_id, created_by_contact_id)
SELECT pg_temp.u('org'), 'Contractwalk Probe', 'Probe', 'HANOVERIAN', 'BAY', 'GELDING',
       'CW-PROBE-0001', pg_temp.u('lessor_c'), pg_temp.u('lessor_c');
SELECT pg_temp.put('horse', (SELECT id::text FROM horses WHERE microchip_id='CW-PROBE-0001'));

SELECT pg_temp.put('r4', start_lease_contract_v2(
         p_lessee_contact_id => pg_temp.u('lessee_c'),
         p_lessor_contact_id => pg_temp.u('lessor_c'),
         p_horse_id          => pg_temp.u('horse'))::text) IS NOT NULL AS lease_started;
SELECT jsonb_pretty((pg_temp.v('r4'))::jsonb) AS start_lease_result;
SELECT pg_temp.put('doc',  (pg_temp.v('r4'))::jsonb->>'document_id'),
       pg_temp.put('ctr',  (pg_temp.v('r4'))::jsonb->>'contract_id');

\echo '--- the document:'
SELECT d.display_code, d.title, d.status, d.workflow_state, d.horse_id IS NOT NULL AS horse_attached,
       t.template_key, d.contact_id = pg_temp.u('lessee_c') AS anchored_on_lessee
  FROM documents d JOIN contract_templates t ON t.id = d.template_id WHERE d.id = pg_temp.u('doc');
\echo '--- its parties:'
SELECT dp.party_role, dp.is_signer, dp.signer_order,
       btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,'')) AS who, c.is_company
  FROM document_parties dp JOIN contacts c ON c.id = dp.contact_id
 WHERE dp.document_id = pg_temp.u('doc') ORDER BY dp.signer_order NULLS LAST;
\echo '--- fields seeded:'
SELECT count(*) AS total, count(*) FILTER (WHERE required) AS required,
       count(*) FILTER (WHERE required AND nullif(trim(coalesce(value,'')),'') IS NULL) AS required_empty
  FROM contract_fields WHERE document_id = pg_temp.u('doc');
\echo '--- THE REQUIRED FIELD LIST, BY NAME:'
SELECT owner_role, field_key, label, coalesce(value,'(empty)') AS seeded,
       CASE WHEN conditional_on IS NULL THEN 'always' ELSE 'conditional' END AS gate
  FROM contract_fields WHERE document_id = pg_temp.u('doc') AND required
 ORDER BY sort_order, field_key;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '################ W5 — SIX ATTEMPTS TO SIGN TOO EARLY ################'

\echo ''
\echo '===== GATE 1 — no auth.uid()'
SELECT pg_temp.be(NULL);
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Walker Dealclient', true);

\echo ''
\echo '===== GATE 2 — workflow_state the signer may not act on'
SELECT pg_temp.be(pg_temp.u('staff'));
SAVEPOINT s_g2;
SELECT advance_document_workflow(pg_temp.u('doc'), 'editing') AS moved_to;
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Walker Dealclient', true);
ROLLBACK TO SAVEPOINT s_g2;
SELECT workflow_state AS state_restored FROM documents WHERE id = pg_temp.u('doc');

\echo ''
\echo '===== GATE 3 — an open change request'
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SAVEPOINT s_g3;
SELECT upsert_change_request(pg_temp.u('doc'), 'Term', 'Can we start a week later?') IS NOT NULL AS raised;
SELECT submit_change_requests(pg_temp.u('doc')) AS submitted;
SELECT count(*) AS open_change_requests FROM contract_change_requests
 WHERE document_id = pg_temp.u('doc') AND parent_request_id IS NULL
   AND submitted_at IS NOT NULL AND resolved_at IS NULL;
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Walker Dealclient', true);
ROLLBACK TO SAVEPOINT s_g3;

\echo ''
\echo '===== GATE 4 — required fields still empty (nothing filled yet)'
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Walker Dealclient', true);

\echo ''
\echo '--- Now fill only the required fields the UI actually SHOWS (gate-aware),'
\echo '--- i.e. what an admin who cleared every on-screen blocker would have.'
SELECT pg_temp.be(pg_temp.u('staff'));
UPDATE contract_fields SET value='INDIVIDUAL' WHERE document_id=pg_temp.u('doc') AND field_key IN ('LESSOR.PARTY_TYPE','LESSEE.PARTY_TYPE');
UPDATE contract_fields SET value='PARTIAL'    WHERE document_id=pg_temp.u('doc') AND field_key='TXN.LEASE_TYPE';
UPDATE contract_fields SET value='NO'         WHERE document_id=pg_temp.u('doc') AND field_key IN ('TXN.INJURY_HISTORY','TXN.RIDER_AIDS_PROHIBITED');
UPDATE contract_fields SET value=to_char(now()::date,'YYYY-MM-DD') WHERE document_id=pg_temp.u('doc') AND field_key='TXN.LEASE_START';
UPDATE contract_fields SET value='Contractwalk Probe' WHERE document_id=pg_temp.u('doc') AND field_key='HORSE.REGISTERED_NAME';
-- every remaining ALWAYS-ON required field: first legal option, else free text
UPDATE contract_fields cf SET value = coalesce(
    (SELECT coalesce(o->>'value', o->>'key', o#>>'{}') FROM jsonb_array_elements(cf.options) o
      WHERE jsonb_typeof(cf.options)='array' LIMIT 1), 'Flatwork only')
 WHERE cf.document_id=pg_temp.u('doc') AND cf.required AND cf.conditional_on IS NULL
   AND nullif(trim(coalesce(cf.value,'')),'') IS NULL;

\echo '--- WHAT THE SCREEN SAYS (contract_lock_blockers — the gate-aware check the UI renders):'
SELECT jsonb_pretty(contract_lock_blockers(pg_temp.u('doc'))) AS on_screen_blockers;
\echo '--- WHAT THE SIGN GATE COUNTS (the naive check inside lock_and_sign_contract):'
SELECT count(*) AS naive_required_empty FROM contract_fields
 WHERE document_id=pg_temp.u('doc') AND required AND nullif(trim(coalesce(value,'')),'') IS NULL;
SELECT field_key, label, conditional_on IS NOT NULL AS is_conditional
  FROM contract_fields WHERE document_id=pg_temp.u('doc') AND required
   AND nullif(trim(coalesce(value,'')),'') IS NULL ORDER BY field_key;
\echo '--- the sign attempt with a clean screen:'
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Walker Dealclient', true);

\echo ''
\echo '--- To REACH gates 5 and 6 at all, gate 4 must first be cleared, which means'
\echo '--- filling the 17 fields the UI hides. Done inside a savepoint and undone after,'
\echo '--- so the rest of the walk runs from the realistic (UI-complete) state.'
SAVEPOINT s_deep;
SELECT pg_temp.be(pg_temp.u('staff'));
UPDATE contract_fields SET value='n/a'
 WHERE document_id=pg_temp.u('doc') AND required AND nullif(trim(coalesce(value,'')),'') IS NULL;
SELECT count(*) AS naive_required_empty_now FROM contract_fields
 WHERE document_id=pg_temp.u('doc') AND required AND nullif(trim(coalesce(value,'')),'') IS NULL;

\echo ''
\echo '===== GATE 5 — LESSEE.PARTY_TYPE contradicts the party record'
SAVEPOINT s_g5;
UPDATE contract_fields SET value='ENTITY' WHERE document_id=pg_temp.u('doc') AND field_key='LESSEE.PARTY_TYPE';
SELECT coalesce(c.is_company,false) AS lessee_contact_is_company FROM contract_parties cp
  JOIN contacts c ON c.id=cp.contact_id WHERE cp.contract_id=pg_temp.u('ctr') AND cp.party_role='LESSEE';
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Walker Dealclient', true);
ROLLBACK TO SAVEPOINT s_g5;

\echo ''
\echo '===== GATE 6 — the horse section is not confirmed by the Lessor'
SELECT horse_section_confirmed_at FROM documents WHERE id=pg_temp.u('doc');
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Walker Dealclient', true);

\echo ''
\echo '--- WHO satisfies gate 6? the LESSEE tries:'
SELECT confirm_horse_section(pg_temp.u('doc'));

\echo ''
\echo '--- undo the artificial fill; back to the realistic UI-complete state:'
ROLLBACK TO SAVEPOINT s_deep;
SELECT count(*) AS naive_required_empty_restored FROM contract_fields
 WHERE document_id=pg_temp.u('doc') AND required AND nullif(trim(coalesce(value,'')),'') IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '################ W6 — THE REAL PRODUCTION PATH TO A SIGNATURE ################'
\echo '--- The UI renders the sign button ONLY when workflow_state = locked'
\echo '--- (ContractPage.tsx: state === "locked" && myRoles.length > 0 && !iSigned).'
\echo '--- So the live gate is advance_document_workflow(...,"locked") -> contract_lock_blockers.'
\echo ''
\echo '--- step 1: the LESSOR confirms the horse section'
SELECT pg_temp.be(pg_temp.u('u_lessor'));
SELECT jsonb_pretty(confirm_horse_section(pg_temp.u('doc'))) AS confirmed;
\echo '--- blockers now:'
SELECT jsonb_pretty(contract_lock_blockers(pg_temp.u('doc'))) AS blockers_after_horse_confirm;

\echo ''
\echo '--- step 2: try to LOCK with the deal client still owing onboarding paperwork'
SELECT pg_temp.be(pg_temp.u('staff'));
SELECT advance_document_workflow(pg_temp.u('doc'), 'locked');

\echo ''
\echo '--- step 3: the deal client does their onboarding paperwork (the wall)'
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT jsonb_pretty(my_wall_state()) AS wall_before;
SELECT jsonb_pretty(generate_my_onboarding_documents()) AS generated;
\echo '--- the generated onboarding documents and the role this member signs in:'
SELECT t.template_key, d.status, d.workflow_state,
       (SELECT string_agg(dp.party_role,',') FROM document_parties dp
         WHERE dp.document_id=d.id AND dp.contact_id=pg_temp.u('lessee_c')) AS my_roles
  FROM documents d JOIN contract_templates t ON t.id=d.template_id
 WHERE d.contact_id=pg_temp.u('lessee_c') AND d.id <> pg_temp.u('doc') ORDER BY t.template_key;
\echo '--- sign each of them (record_signature — the onboarding wall''s own door):'
UPDATE documents SET executed_email_sent_at = now()
 WHERE contact_id=pg_temp.u('lessee_c') AND id <> pg_temp.u('doc') AND status <> 'EXECUTED';
SELECT t.template_key,
       record_signature(d.id,
         (SELECT dp.party_role FROM document_parties dp
           WHERE dp.document_id=d.id AND dp.contact_id=pg_temp.u('lessee_c') AND dp.is_signer LIMIT 1),
         'Walker Dealclient', NULL, NULL, true) AS status
  FROM documents d JOIN contract_templates t ON t.id=d.template_id
 WHERE d.contact_id=pg_temp.u('lessee_c') AND d.id <> pg_temp.u('doc')
 ORDER BY t.template_key;
SELECT jsonb_pretty(my_wall_state()) AS wall_after;

\echo ''
\echo '--- step 4: NOW the lease can be locked'
SELECT pg_temp.be(pg_temp.u('staff'));
SELECT jsonb_pretty(contract_lock_blockers(pg_temp.u('doc'))) AS blockers_now;
SELECT pg_temp.put('t0', now()::text);
SELECT advance_document_workflow(pg_temp.u('doc'), 'locked') AS locked;
\echo '--- who was told the contract is ready to sign:'
SELECT n.kind, n.title, n.link, coalesce(p.email,'(no profile)') AS to_whom
  FROM notifications n LEFT JOIN profiles p ON p.user_id=n.user_id
 WHERE n.created_at >= (pg_temp.v('t0'))::timestamptz ORDER BY n.created_at;
\echo '--- pending signature rows seeded at lock:'
SELECT party_role, signed_at IS NULL AS pending FROM signatures
 WHERE document_id=pg_temp.u('doc') ORDER BY party_role;

\echo ''
\echo '--- PROOF that a LOCKED document skips gates 3-6 entirely: blank a required'
\echo '--- field, then sign anyway. (savepointed, undone immediately)'
SAVEPOINT s_skip;
UPDATE contract_fields SET value=NULL
 WHERE document_id=pg_temp.u('doc') AND field_key='TXN.LEASE_START';
UPDATE documents SET horse_section_confirmed_at=NULL WHERE id=pg_temp.u('doc');
SELECT count(*) AS required_empty_while_locked FROM contract_fields
 WHERE document_id=pg_temp.u('doc') AND required AND nullif(trim(coalesce(value,'')),'') IS NULL;
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Walker Dealclient', true) AS signed_anyway;
ROLLBACK TO SAVEPOINT s_skip;

\echo ''
\echo '--- step 5: THE LESSEE SIGNS (for real)'
SELECT pg_temp.put('t0', now()::text);
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Walker Dealclient', true) AS status_after_lessee;
\echo '--- signature rows:'
SELECT party_role, typed_name, signed_at IS NOT NULL AS sealed, signer_user_id IS NOT NULL AS has_account, method
  FROM signatures WHERE document_id=pg_temp.u('doc') ORDER BY party_role;
\echo '--- document state — must NOT be executed yet:'
SELECT status, workflow_state, effective_date, execution_hash IS NOT NULL AS has_hash
  FROM documents WHERE id=pg_temp.u('doc');
\echo '--- the admin party_signed notification:'
SELECT n.kind, n.title, n.link, coalesce(p.email,'(no profile)') AS to_whom
  FROM notifications n LEFT JOIN profiles p ON p.user_id=n.user_id
 WHERE n.created_at >= (pg_temp.v('t0'))::timestamptz ORDER BY n.created_at;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '################ W7 — THE LESSOR SIGNS (EXECUTION) ################'
\echo '--- EMAIL BOUNDARY: pre-stamp executed_email_sent_at so documents_send_executed_email'
\echo '--- takes its no-op branch and NOTHING is queued to pg_net at all.'
SELECT pg_temp.be(pg_temp.u('staff'));
UPDATE documents SET executed_email_sent_at = now() WHERE id=pg_temp.u('doc');
SELECT count(*) AS pg_net_queue_before FROM net.http_request_queue;
SELECT pg_temp.put('t1', now()::text);

SELECT pg_temp.be(pg_temp.u('u_lessor'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSOR', 'Olive Lessor', true) AS status_after_lessor;

SELECT count(*) AS pg_net_queue_after FROM net.http_request_queue;
\echo '--- execution proof:'
SELECT status, workflow_state, effective_date, left(execution_hash,20)||'…' AS execution_hash,
       signed_template_version, coalesce(executed_email_error,'(none)') AS mail_error
  FROM documents WHERE id=pg_temp.u('doc');
\echo '--- template version frozen against the live template version:'
SELECT d.signed_template_version, t.version AS template_version_now, t.template_key
  FROM documents d JOIN contract_templates t ON t.id=d.template_id WHERE d.id=pg_temp.u('doc');
\echo '--- signatures:'
SELECT party_role, typed_name, signed_at IS NOT NULL AS sealed FROM signatures
 WHERE document_id=pg_temp.u('doc') ORDER BY party_role;
\echo '--- notifications from the execution act (who got told what):'
SELECT n.kind, n.title, n.link, coalesce(p.email,'(no profile)') AS to_whom FROM notifications n LEFT JOIN profiles p ON p.user_id=n.user_id
 WHERE n.created_at >= (pg_temp.v('t1'))::timestamptz ORDER BY n.created_at;
\echo '--- were the earlier per-party ready-to-sign alerts resolved? (resolution = DELETE)'
SELECT count(*) AS contract_link_alerts_remaining FROM notifications
 WHERE link = '/app/contracts/'||pg_temp.v('doc');
SELECT a.action, a.new_value->>'event' AS event, count(*) AS n
  FROM audit_logs a WHERE a.table_name='notifications'
   AND a.occurred_at >= (pg_temp.v('t1'))::timestamptz GROUP BY 1,2;

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '################ W8 — THE LEASE EFFECTS ################'
SELECT registered_name, nickname,
       current_owner_contact_id = pg_temp.u('lessor_c') AS owner_is_lessor,
       lessee_contact_id        = pg_temp.u('lessee_c') AS lessee_is_lessee,
       lease_start, lease_end
  FROM horses WHERE id=pg_temp.u('horse');
\echo '--- horse_relationships:'
SELECT relationship,
       CASE party_contact_id WHEN pg_temp.u('lessee_c') THEN 'LESSEE contact'
                             WHEN pg_temp.u('lessor_c') THEN 'LESSOR contact' ELSE 'other' END AS party,
       term_start, term_end, active, source_document_id = pg_temp.u('doc') AS from_this_lease
  FROM horse_relationships WHERE horse_id=pg_temp.u('horse') ORDER BY created_at;
\echo '--- THE LESSEE''S STABLE:'
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT registered_name, nickname, is_owner, lease_start, lease_end FROM my_stable_horses(false);
\echo '--- THE LESSOR''S STABLE:'
SELECT pg_temp.be(pg_temp.u('u_lessor'));
SELECT registered_name, nickname, is_owner FROM my_stable_horses(false);
\echo '--- horse documents the lease bundled (ensure_horse_documents at lock):'
SELECT pg_temp.be(pg_temp.u('staff'));
SELECT t.template_key, d.status, d.workflow_state, d.contract_id = pg_temp.u('ctr') AS on_this_deal
  FROM documents d JOIN contract_templates t ON t.id=d.template_id
 WHERE d.horse_id=pg_temp.u('horse') ORDER BY t.template_key;
\echo '--- deal_autocomplete_on_execution — the contracts row:'
SELECT status, segment, horse_id = pg_temp.u('horse') AS horse_linked, terms FROM contracts WHERE id=pg_temp.u('ctr');
\echo '--- apply_document_supersession — anything marked superseded?'
SELECT count(*) AS superseded_docs FROM documents
 WHERE contact_id IN (pg_temp.u('lessee_c'), pg_temp.u('lessor_c')) AND current_status='superseded';
\echo '--- groups after execution (derive_affiliations via the doc trigger):'
SELECT CASE contact_id WHEN pg_temp.u('lessee_c') THEN 'lessee' ELSE 'lessor' END AS who, group_type
  FROM groups WHERE contact_id IN (pg_temp.u('lessee_c'), pg_temp.u('lessor_c')) ORDER BY 1,2;
\echo '--- the lessee''s document list (my_documents) — does the lease show?'
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT count(*) AS my_documents_rows FROM my_documents();

\echo '--- lease_end / term_end are NULL — is TXN.LEASE_END even required?'
SELECT field_key, required, coalesce(value,'(empty)') AS value FROM contract_fields
 WHERE document_id=pg_temp.u('doc') AND field_key IN ('TXN.LEASE_START','TXN.LEASE_END','TXN.LEASE_TERM_TYPE');

-- ═══════════════════════════════════════════════════════════════════════════
\echo ''
\echo '################ W9 — WHAT ADMIN SEES, STAGE BY STAGE ################'
SELECT pg_temp.be(pg_temp.u('staff'));
\echo '--- the document timeline admin reads (status_events):'
SELECT se.status, se.detail, se.created_at FROM status_events se
 WHERE se.entity_type='document' AND se.entity_id=pg_temp.u('doc') ORDER BY se.created_at;
\echo '--- every notification this whole walk produced, by kind and recipient:'
SELECT n.kind, coalesce(p.email,'(no profile)') AS to_whom, count(*) AS n
  FROM notifications n LEFT JOIN profiles p ON p.user_id=n.user_id
 WHERE n.created_at >= (pg_temp.v('t0'))::timestamptz - interval '10 minutes'
 GROUP BY 1,2 ORDER BY 1,2;
\echo '--- the lease document as the ops list sees it:'
SELECT d.display_code, d.title, d.status, d.workflow_state, d.current_status,
       (SELECT count(*) FROM signatures s WHERE s.document_id=d.id AND s.signed_at IS NOT NULL) AS signed,
       (SELECT count(*) FROM document_parties dp WHERE dp.document_id=d.id AND dp.is_signer) AS signers
  FROM documents d WHERE d.id=pg_temp.u('doc');

\echo ''
\echo '################ END OF WALK — ROLLING BACK ################'
ROLLBACK;

\echo ''
\echo '################ POST-ROLLBACK CENSUS (must equal baseline) ################'
SELECT 'contacts' t, count(*) n FROM contacts
UNION ALL SELECT 'profiles', count(*) FROM profiles
UNION ALL SELECT 'auth.users', count(*) FROM auth.users
UNION ALL SELECT 'invitations', count(*) FROM invitations
UNION ALL SELECT 'documents', count(*) FROM documents
UNION ALL SELECT 'document_parties', count(*) FROM document_parties
UNION ALL SELECT 'signatures', count(*) FROM signatures
UNION ALL SELECT 'contract_fields', count(*) FROM contract_fields
UNION ALL SELECT 'contracts', count(*) FROM contracts
UNION ALL SELECT 'horses', count(*) FROM horses
UNION ALL SELECT 'horse_relationships', count(*) FROM horse_relationships
UNION ALL SELECT 'groups', count(*) FROM groups
UNION ALL SELECT 'members', count(*) FROM members
UNION ALL SELECT 'contact_required_documents', count(*) FROM contact_required_documents
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'net.http_request_queue', count(*) FROM net.http_request_queue
ORDER BY 1;
