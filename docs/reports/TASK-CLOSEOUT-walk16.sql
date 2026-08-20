-- TASK-CLOSEOUT §1.6 — dry-run + proof: the Lessor's documents are removable at
-- provisioning and skippable afterwards; a skip clears the WALL and the LOCK
-- GATE without ever reading as signed. EVERYTHING inside BEGIN … ROLLBACK.
\set ON_ERROR_STOP off
\set ON_ERROR_ROLLBACK on
\pset pager off
\timing off

\echo '--- before: no skip column live:'
SELECT count(*) AS skip_columns FROM information_schema.columns
 WHERE table_name='contact_required_documents' AND column_name='skipped_at';

BEGIN;

\i supabase/migrations/20260819T0130_closeout_16_skip_a_required_document.sql

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
       pg_temp.put('u_lessee','cccc0000-0000-4000-8000-000000001601'),
       pg_temp.put('u_lessor','cccc0000-0000-4000-8000-000000001602'),
       pg_temp.put('e_lessee','co16-lessee@example.invalid'),
       pg_temp.put('e_lessor','co16-lessor@example.invalid'),
       pg_temp.put('e_removed','co16-removed@example.invalid');

INSERT INTO auth.users (id, email, is_sso_user, is_anonymous)
SELECT pg_temp.u('u_lessee'), pg_temp.v('e_lessee'), false, false
UNION ALL SELECT pg_temp.u('u_lessor'), pg_temp.v('e_lessor'), false, false;

-- ═══════════ ESCAPE 1 — REMOVE AT PROVISIONING: the requirement is never created
\echo ''
\echo '################ E1 — REMOVE AT PROVISIONING ################'
SELECT pg_temp.be(pg_temp.u('staff'));
\echo '--- the Horse owner category default (what the admin sees suggested):'
SELECT template_key FROM category_document_requirements
 WHERE upper(replace(btrim(category),' ','_')) = 'HORSE_OWNER' ORDER BY 1;
\echo '--- provision a Lessor with the two horse documents UNCHECKED:'
SELECT (provision_client_invitation(
         p_email => pg_temp.v('e_removed'), p_first_name => 'Rem', p_last_name => 'Oved',
         p_categories => ARRAY['HORSE_OWNER'],
         p_template_keys => ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT'])
       ) ->> 'contact_id' AS removed_contact;
\echo '--- their requirement rows (horse docs must be ABSENT — never created):'
SELECT crd.template_key FROM contact_required_documents crd
  JOIN contacts c ON c.id = crd.contact_id
 WHERE c.email = pg_temp.v('e_removed') ORDER BY 1;

-- ═══════════ SETUP for ESCAPE 2 — a Lessor provisioned with the FULL default
\echo ''
\echo '################ E2 SETUP — LESSOR WITH THE FULL HORSE-OWNER SET ################'
SELECT pg_temp.put('r1', provision_client_invitation(
         p_email => pg_temp.v('e_lessee'), p_first_name => 'Sixteen', p_last_name => 'Lessee',
         p_categories => ARRAY['GUEST'])::text) IS NOT NULL AS lessee_provisioned;
SELECT pg_temp.put('lessee_c', (pg_temp.v('r1'))::jsonb->>'contact_id'),
       pg_temp.put('tok1',     (pg_temp.v('r1'))::jsonb->>'token');
SELECT pg_temp.put('r2', provision_client_invitation(
         p_email => pg_temp.v('e_lessor'), p_first_name => 'Sixteen', p_last_name => 'Lessor',
         p_categories => ARRAY['HORSE_OWNER'])::text) IS NOT NULL AS lessor_provisioned;
SELECT pg_temp.put('lessor_c', (pg_temp.v('r2'))::jsonb->>'contact_id'),
       pg_temp.put('tok2',     (pg_temp.v('r2'))::jsonb->>'token');
\echo '--- the Lessor owes the full default:'
SELECT template_key, skipped_at IS NOT NULL AS skipped
  FROM contact_required_documents WHERE contact_id = pg_temp.u('lessor_c') ORDER BY 1;

SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT redeem_invitation(pg_temp.v('tok1')) AS lessee_redeemed;
UPDATE contacts SET phone='+1 555 0100', date_of_birth='1990-01-01',
       emergency_contact_1_name='Pat Kin', emergency_contact_1_phone='+1 555 0199'
 WHERE id = pg_temp.u('lessee_c');
SELECT pg_temp.be(pg_temp.u('u_lessor'));
SELECT redeem_invitation(pg_temp.v('tok2')) AS lessor_redeemed;

SELECT pg_temp.be(pg_temp.u('staff'));
INSERT INTO horses (org_id, registered_name, nickname, breed, color, sex, microchip_id,
                    current_owner_contact_id, created_by_contact_id)
SELECT pg_temp.u('org'), 'Sixteen Probe', 'Probe16', 'HANOVERIAN', 'BAY', 'GELDING',
       'CO16-PROBE-0001', pg_temp.u('lessor_c'), pg_temp.u('lessor_c');
SELECT pg_temp.put('horse', (SELECT id::text FROM horses WHERE microchip_id='CO16-PROBE-0001'));
SELECT pg_temp.put('r4', start_lease_contract_v2(
         p_lessee_contact_id => pg_temp.u('lessee_c'),
         p_lessor_contact_id => pg_temp.u('lessor_c'),
         p_horse_id          => pg_temp.u('horse'))::text) IS NOT NULL AS lease_started;
SELECT pg_temp.put('doc', (pg_temp.v('r4'))::jsonb->>'document_id');

UPDATE contract_fields SET value='INDIVIDUAL' WHERE document_id=pg_temp.u('doc') AND field_key IN ('LESSOR.PARTY_TYPE','LESSEE.PARTY_TYPE');
UPDATE contract_fields SET value='PARTIAL'    WHERE document_id=pg_temp.u('doc') AND field_key='TXN.LEASE_TYPE';
UPDATE contract_fields SET value='NO'         WHERE document_id=pg_temp.u('doc') AND field_key IN ('TXN.INJURY_HISTORY','TXN.RIDER_AIDS_PROHIBITED');
UPDATE contract_fields SET value=to_char(now()::date,'YYYY-MM-DD') WHERE document_id=pg_temp.u('doc') AND field_key='TXN.LEASE_START';
UPDATE contract_fields SET value='Sixteen Probe' WHERE document_id=pg_temp.u('doc') AND field_key='HORSE.REGISTERED_NAME';
UPDATE contract_fields cf SET value = coalesce(
    (SELECT coalesce(o->>'value', o->>'key', o#>>'{}') FROM jsonb_array_elements(cf.options) o
      WHERE jsonb_typeof(cf.options)='array' LIMIT 1), 'Flatwork only')
 WHERE cf.document_id=pg_temp.u('doc') AND cf.required AND cf.conditional_on IS NULL
   AND nullif(trim(coalesce(cf.value,'')),'') IS NULL;

SELECT pg_temp.be(pg_temp.u('u_lessor'));
SELECT (confirm_horse_section(pg_temp.u('doc'))) IS NOT NULL AS horse_confirmed;
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT (generate_my_onboarding_documents()) IS NOT NULL AS lessee_wall_generated;
UPDATE documents SET executed_email_sent_at = now()
 WHERE contact_id=pg_temp.u('lessee_c') AND id <> pg_temp.u('doc') AND status <> 'EXECUTED';
SELECT count(*) AS lessee_wall_signed FROM (
  SELECT record_signature(d.id,
         (SELECT dp.party_role FROM document_parties dp
           WHERE dp.document_id=d.id AND dp.contact_id=pg_temp.u('lessee_c') AND dp.is_signer LIMIT 1),
         'Sixteen Lessee', NULL, NULL, true)
  FROM documents d
 WHERE d.contact_id=pg_temp.u('lessee_c') AND d.id <> pg_temp.u('doc')) x;

-- ═══════════ THE WALL BLOCKS THE LEASE — then SKIP clears it
\echo ''
\echo '################ E2 — THE LOCK GATE NAMES THE OVER-ASSIGNED LESSOR ################'
SELECT jsonb_pretty(contact_document_wall_state(pg_temp.u('lessor_c'))) AS lessor_wall_before;
SELECT pg_temp.be(pg_temp.u('staff'));
\echo '--- the lock attempt (must refuse, naming the Lessor):'
SELECT advance_document_workflow(pg_temp.u('doc'), 'locked');

\echo ''
\echo '################ E2 — SKIP: THE FALLBACK WHEN REMOVAL WAS OVERLOOKED ################'
SELECT template_key,
       (skip_required_document(pg_temp.u('lessor_c'), template_key,
          'over-assigned at provisioning — lease counterparty, not a service client')->>'skipped')::boolean AS skipped
  FROM contact_required_documents WHERE contact_id = pg_temp.u('lessor_c') ORDER BY template_key;
\echo '--- the wall is CLEAR:'
SELECT jsonb_pretty(contact_document_wall_state(pg_temp.u('lessor_c'))) AS lessor_wall_after_skip;
\echo '--- the LOCK GATE is clear (blockers on the lease):'
SELECT jsonb_pretty(contract_lock_blockers(pg_temp.u('doc'))) AS lease_blockers_after_skip;
\echo '--- lock now succeeds:'
SELECT advance_document_workflow(pg_temp.u('doc'), 'locked') AS locked;

\echo ''
\echo '################ E2 — A SKIP NEVER READS AS SIGNED ################'
\echo '--- satisfied stays FALSE for every skipped key:'
SELECT template_key, contact_document_satisfied(pg_temp.u('lessor_c'), template_key) AS satisfied,
       skipped_at IS NOT NULL AS skipped, skip_reason IS NOT NULL AS has_reason
  FROM contact_required_documents WHERE contact_id = pg_temp.u('lessor_c') ORDER BY 1;
\echo '--- no document rows were created or executed by skipping:'
SELECT count(*) AS lessor_docs FROM documents d
 WHERE d.contact_id = pg_temp.u('lessor_c') AND d.deleted_at IS NULL;
\echo '--- the member-side ask is empty (my_onboarding_state as the Lessor):'
SELECT pg_temp.be(pg_temp.u('u_lessor'));
SELECT (my_onboarding_state()->>'needed')::boolean AS docs_needed,
       jsonb_array_length(my_onboarding_state()->'documents') AS documents_listed;
\echo '--- generate_my_onboarding_documents generates NOTHING for skipped reqs:'
SELECT jsonb_pretty(generate_my_onboarding_documents()) AS generated;
\echo '--- the audit trail (who skipped, when, why):'
SELECT count(*) AS skip_audit_rows,
       min(new_value->>'reason') AS reason,
       bool_and((new_value->>'skipped_by')::uuid = pg_temp.u('staff')) AS by_staff
  FROM audit_logs
 WHERE table_name='contact_required_documents' AND record_id = pg_temp.u('lessor_c')
   AND new_value->>'event' = 'requirement_skipped';

\echo ''
\echo '################ E2 — THE LEASE EXECUTES ################'
SELECT pg_temp.be(pg_temp.u('staff'));
UPDATE documents SET executed_email_sent_at = now() WHERE id=pg_temp.u('doc');
SELECT pg_temp.be(pg_temp.u('u_lessee'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSEE', 'Sixteen Lessee', true) AS after_lessee;
SELECT pg_temp.be(pg_temp.u('u_lessor'));
SELECT lock_and_sign_contract(pg_temp.u('doc'), 'LESSOR', 'Sixteen Lessor', true) AS after_lessor;

\echo ''
\echo '################ GUARDS AND RESTORES ################'
\echo '--- an EXECUTED requirement can never be skipped (lessee signed RELEASE_GENERAL):'
SELECT pg_temp.be(pg_temp.u('staff'));
SELECT skip_required_document(pg_temp.u('lessee_c'), 'RELEASE_GENERAL', 'should refuse');
\echo '--- restore one (unskip) — the wall comes back:'
SELECT unskip_required_document(pg_temp.u('lessor_c'), 'COMPANY_POLICIES') AS restored;
SELECT (contact_document_wall_state(pg_temp.u('lessor_c'))->>'gating')::int AS gating_after_restore;
\echo '--- a deliberate staff re-assign CLEARS the skip:'
SELECT staff_assign_documents(pg_temp.u('lessor_c'), ARRAY['FACILITY_RULES']) IS NOT NULL AS reassigned;
SELECT template_key, skipped_at IS NOT NULL AS still_skipped
  FROM contact_required_documents WHERE contact_id = pg_temp.u('lessor_c') ORDER BY 1;
\echo '--- the editor save PRESERVES surviving skip marks (same set re-saved):'
SELECT set_contact_required_documents(pg_temp.u('lessor_c'),
  ARRAY['COMPANY_POLICIES','FACILITY_RULES','RELEASE_PARTICIPANT','HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE']) AS row_count;
SELECT count(*) FILTER (WHERE skipped_at IS NOT NULL) AS skips_preserved,
       count(*) AS total_rows
  FROM contact_required_documents WHERE contact_id = pg_temp.u('lessor_c');
\echo '--- what the editor renders (contact_required_documents_state):'
SELECT template_key, skipped_at IS NOT NULL AS skipped, skipped_by_name, skip_reason IS NOT NULL AS has_reason, satisfied
  FROM contact_required_documents_state(pg_temp.u('lessor_c'));

ROLLBACK;

\echo ''
\echo '################ ROLLBACK PROVEN ################'
SELECT count(*) AS skip_columns FROM information_schema.columns
 WHERE table_name='contact_required_documents' AND column_name='skipped_at';
SELECT count(*) AS skip_rpc FROM pg_proc WHERE proname='skip_required_document';
