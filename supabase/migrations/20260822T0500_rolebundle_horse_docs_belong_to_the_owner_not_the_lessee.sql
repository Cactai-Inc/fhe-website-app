-- ROLEBUNDLE follow-up, 2026-08-22 — the horse owner owes the vet/liability
-- release, never the lessee.
--
-- Owner: "the lessee never has authority or power to release us of liability
-- for the things that can happen to the horse under our care, the whole
-- point we are involved in every lease is because owners want a trainer to
-- own the responsibility for the horse and that includes vet handling or
-- contacting the owner and our insurance for the ccc requires liability
-- release from the horse owner."
--
-- ensure_horse_documents() already generates and correctly addresses
-- HORSE_EMERGENCY_VET and RELEASE_HORSE_CARE to the horse's actual owner
-- (v_horse.current_owner_contact_id), execution-triggered — an independent,
-- already-correct mechanism (D18: do not build a second write path). These
-- two rows in contract_role_documents wrongly claimed the LESSEE owed them;
-- removed, not reassigned — the horse-owner path already exists elsewhere
-- and needs no representation in this table.
--
-- contract_role_document_requirements(document_id)'s LESSEE bundle is now
-- COMPANY_POLICIES + FACILITY_RULES only.

DELETE FROM contract_role_documents
 WHERE doc_role = 'LESSEE'
   AND template_key IN ('HORSE_EMERGENCY_VET', 'RELEASE_HORSE_CARE');
