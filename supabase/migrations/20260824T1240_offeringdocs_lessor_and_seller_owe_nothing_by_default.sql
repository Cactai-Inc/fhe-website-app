-- TASK-OFFERINGDOCS §7 — a contract counterparty owes nothing by default.
--
-- Owner, 2026-08-24, asked whether the LESSOR/SELLER bundles should stand:
-- "they only get those documents if i want them to get them, not by default. by
-- default they require no docs."
--
-- `contract_role_documents` had LESSOR carrying four (Company Policies, Horse
-- Emergency Vet, General Release, Horse-Care Release) and SELLER two, generated
-- automatically by `deal_autocomplete_on_execution` the moment the governing
-- document executed. Retired the same way LESSEE's two were on 2026-08-22 —
-- `active = false` with the reason on the row, never deleted (D32).
--
-- Staff can still ask for any of them by name: PaperworkEditor lists every
-- onboarding template for any contact, counterparties included (PARTYROLE §4c).
UPDATE contract_role_documents
   SET active = false,
       retired_reason = 'OFFERINGDOCS 2026-08-24 (owner): "they only get those documents if i '
         || 'want them to get them, not by default. by default they require no docs." A lessor '
         || 'or seller becomes a horse owner when the deal goes through, not before, and a '
         || 'seller who never visits owes no visitor paperwork. Ask for these by name from the '
         || 'paperwork editor when a particular deal needs them.'
 WHERE doc_role IN ('LESSOR', 'SELLER')
   AND active;
