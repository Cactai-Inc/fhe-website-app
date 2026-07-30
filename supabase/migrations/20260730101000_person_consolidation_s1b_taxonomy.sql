-- ─────────────────────────────────────────────────────────────────────────────
-- PERSON CONSOLIDATION — S1b: the owner's taxonomy, corrected (2026-07-30)
--
-- S1 seeded contact_type with CLIENT | PROSPECT | EXTERNAL | COMPANY | TEAM.
-- The owner's actual model has four PAGES with a cleaner split, and one term
-- ("Directory") means something narrower than the generic EXTERNAL I used:
--
--   LEADS     — potential future clients. People we hold information about so we
--               can reach out or run a campaign to convert them. NOT directory
--               entries. Explicitly set, never derived from "nothing else matched".
--   CONTACTS  — internal people who are not part of the company: clients,
--               members, horse owners, contract counterparties, family. The
--               people the business SERVES.
--   TEAM      — the company itself: staff and internal accounts.
--   DIRECTORY — external people and BUSINESSES that provide something to the
--               company or its members: farriers, veterinarians, feed and supply
--               companies, service providers, event organizers. The rolodex.
--
-- The distinction that matters: DIRECTORY is a vendor/provider book, not a
-- catch-all for "not a client". Someone we serve but who has not bought yet is a
-- LEAD; someone who sells to us is DIRECTORY. Collapsing those (as a generic
-- EXTERNAL does) is what made the old pages ambiguous.
--
-- Mapping applied here: EXTERNAL → DIRECTORY, CLIENT → CONTACT, PROSPECT → LEAD.
-- COMPANY is folded into DIRECTORY where the row is a real vendor org, and kept
-- as its own marker only for the tenant's OWN company record (is_company + a
-- staff email), which belongs to TEAM.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_contact_type_check;

-- Re-label in place.
UPDATE contacts SET contact_type = 'CONTACT'   WHERE contact_type = 'CLIENT';
UPDATE contacts SET contact_type = 'LEAD'      WHERE contact_type = 'PROSPECT';
UPDATE contacts SET contact_type = 'DIRECTORY' WHERE contact_type = 'EXTERNAL';

-- The tenant's own company record is TEAM, not a vendor in its own rolodex.
UPDATE contacts c SET contact_type = 'TEAM'
 WHERE c.contact_type = 'COMPANY'
   AND lower(coalesce(c.email,'')) IN ('admin@fhequestrian.com','hello@fhequestrian.com');

-- Any remaining COMPANY row is a genuine external organisation → DIRECTORY.
UPDATE contacts SET contact_type = 'DIRECTORY' WHERE contact_type = 'COMPANY';

ALTER TABLE contacts
  ADD CONSTRAINT contacts_contact_type_check
  CHECK (contact_type IS NULL
         OR contact_type IN ('LEAD','CONTACT','TEAM','DIRECTORY'));

COMMENT ON COLUMN contacts.contact_type IS
  'The person-page discriminator — one row appears on exactly ONE page. '
  'LEAD: a potential future client we may reach out to or include in a campaign. '
  'CONTACT: an internal person the business serves (client, member, horse owner, '
  'counterparty) who is not part of the company. '
  'TEAM: the company itself — staff, internal accounts, and the tenant org record. '
  'DIRECTORY: external people and businesses that PROVIDE something — farriers, '
  'vets, suppliers, service providers, event organizers. '
  'Explicit and settable. NULL means unclassified and is surfaced for a human '
  'decision, never silently bucketed — the old "Lead" was assigned whenever '
  'nothing else matched, which is why it never formed a usable campaign list.';
