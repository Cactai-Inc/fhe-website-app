-- U2.6 — TOKEN-REGISTRY RECONCILIATION (safe subset only)
-- Owner instruction: two-phase. Produce the full disposition, then apply ONLY
-- the safe subset; anything that would REMOVE or ALTER BODY TEXT is
-- report-only for the owner. This migration is the safe subset.
--
-- FULL DISPOSITION (raw counts from the live reconciliation, 2026-08-01):
--   Body tokens with no template_tokens row ............ 97
--     ...of which resolve via contract_field_defs ...... 81   NO ACTION (V2's
--          real mechanism; HORSE_LEASE_V2 has ZERO template_tokens rows yet
--          renders correctly, so the registry is simply not V2's resolver)
--     ...of which resolve via party_namespaces ......... 16   NO ACTION
--          (LESSOR.*/LESSEE.* on HORSE_LEASE_V2 and GUARDIAN.*/
--          EMERGENCY_CONTACT.*/PARTICIPANT.* on MINOR_RIDER are role
--          expansions of the PARTY.* templates; contract_templates
--          .party_namespaces declares them, and the EXECUTED document
--          ecaecd42 contains no raw LESSOR.FULL_NAME, proving resolution)
--   Registry rows whose token is in no body ............ 34
--     ...PARTY.* still used via role expansion ......... 7    KEEP
--     ...DOC/FHE/ORG/ENG system+config namespaces ...... 21   KEEP
--     ...dead everywhere (bodies, pg_proc, src/, api/) . 6    REMOVED BELOW
--
-- The audit's "known offenders" are hereby CLEARED, not wired: GUARDIAN.*,
-- EMERGENCY_CONTACT.*, PARTICIPANT.PRINTED_NAME and PARTY.* all resolve
-- through party-namespace expansion. HORSE.PASSPORT_COUNTRY and
-- HORSE.REGISTRATION_ORG belong to HORSE_LEASE v1, which is INACTIVE with 0
-- documents.
--
-- REPORT-ONLY (owner decision required, NOTHING applied — each would remove or
-- alter body text):
--   * HORSE_LEASE (v1) is inactive with 0 documents but still holds 104 body
--     tokens and 98 registry rows. Retiring it is a body-deleting change.
--   * MINOR_RIDER is active with 0 documents; its GUARDIAN.*/
--     EMERGENCY_CONTACT.* tokens have never been exercised by a real render.
--   * HORSE.MARKINGS / PASSPORT_NUMBER / VET_ADDRESS / VET_BUSINESS appear in
--     both lease bodies and resolve via generate_document's HORSE branch, but
--     have no registry row in either mechanism — a third resolution path.

BEGIN;

-- The 6 dead registry rows. Verified live: zero occurrences in any clause or
-- template body, zero references in any pg_proc body, zero in src/ or api/.
-- PARTY.SIG_* are superseded by the live SIG.<ROLE>.<FIELD> mechanism
-- (SIG.LESSOR.NAME etc.), which is a different namespace.
DELETE FROM template_tokens tt
 WHERE tt.namespace||'.'||tt.field IN (
   'PARTY.SIG_NAME',
   'PARTY.SIG_DATE',
   'PARTY.SIG_IP',
   'PARTY.TITLE',
   'CLIENT.EUTHANASIA_INITIALS',
   'TXN.INSURANCE_REQUIREMENTS'
 );

COMMIT;
