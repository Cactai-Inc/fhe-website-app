# Identity model v1 — people, companies, tenant, directory (owner-ratified 2026-08-05)

Supersedes the implicit "is_company = the tenant" model. Companion to
`DOCUMENT_LIBRARY_DESIGN.md` (files/documents) and tracker J5 (deal/contract party
divergence).

## Core principle
People and companies are both contacts. Neither is ever structurally "the root" — the
relationship between them is an EDGE, and each feature points at whichever contact is the
correct actor in its context. Root-vs-branch is contextual, never baked into the rows.

## The three markers
1. **`is_tenant`** (new) — exactly one contact per org (partial unique index), set on French
   Heritage Equestrian. Everything meaning "the org's own company" (mirror deliveries, staff
   stable scope, company-side signing default, `organizations.company_contact_id` pointer)
   resolves through this. The old `one_company_contact_per_org` unique index on `is_company`
   is DROPPED.
2. **`is_company`** (freed) — ordinary attribute: "this contact is a legal entity, not a
   natural person." Unlimited per org. Drives entity-vs-individual logic only (party-type
   checks, no DOB/minor logic, etc.).
3. **Directory-listed** (curated capability) — a deliberate staff act, never a consequence.
   The directory is the curated vendor/supplier/service-provider list (farrier, vet, feed
   supply…): it exists so members have a known list to pick from, so horse records attach
   providers cleanly, and so FHE has a B2B roster. Every listing is a company, but no company
   auto-lists. Existing `contact_type='DIRECTORY'` rows migrate to real contacts with
   `is_company=true` + the directory-listed marker; a listing may carry a contact person via
   an edge, or a plain listed-person text when that person isn't a system contact.

## Capabilities never block each other
Horse owner, deal/contract party, rider, directory-listed, company — all independently
assignable/derivable on any contact. Company+rider is odd but not invalid; nothing bars it.

## The edge: `contact_affiliations`
`(company_contact_id → contacts, person_contact_id → contacts, role, is_primary)`
- Roles: `CONNECTED` (owner-ratified collapse: a connected person is presumed owner/signer
  for that company) and `CONTACT_OF_RECORD` (directory contact person; implies nothing about
  signing). Stricter roles (employee-non-signer etc.) are future row values, not schema
  changes.
- A person may hold edges to multiple companies (allowed; nothing custom built for it until
  a real case arrives).
- **Creation is staff/admin-only** — members may request, never self-grant (a self-declared
  signing link is a fraud vector). Ratified 2026-08-05.
- Tenant-company special case: admin privilege = signer for the tenant company; staff
  privilege ≠ signer (future: owner-grantable). External companies: any CONNECTED person is
  presumed signer (best-effort at current scale).

## Context resolution (no reconfiguration, ever)
- Lesson/booking → the person contact.
- Horse legal ownership, deal party, contract party → the legal actor (person OR their
  company), chosen at data-entry; divergence (deal with company, horse titled to person)
  stays representable and VISIBLE (J5 display: "Deal party: Acme LLC · signs as: J. Smith").
- Signing → party is the company; a person signs on behalf via their edge. This generalizes
  COSIGN's tenant-only rule to any company: "anyone with a signing edge to a company party
  may sign for it."
- Directory → the company contact + its contact person via edge (or listed text).
- Member profile → the person, with affiliated companies shown as linked business cards
  (the company's directory listing acts as its profile page).

## Phased build (each phase = one thread task)
- **P1** — `is_tenant` column + partial unique index + set FHE + drop
  `one_company_contact_per_org` + repoint every "the company" resolution through
  tenant marker (audit callers of `company_contact_id()` and `is_company` uses; C10 minor
  logic, party-type checks stay per-contact). Behavior-neutral by proof.
- **P2** — `contact_affiliations` table + RLS + staff-only writes + dossier/UI display of
  connections.
- **P3** — directory migration: DIRECTORY rows → is_company contacts + directory-listed
  marker + listing read-through (contact person via edge or text) + business profile card.
- **P4** — generalized signing: extend the COSIGN affordance + `record_signature` company
  branch from "tenant company, staff signs" to "any company party, connected person signs";
  tenant path unchanged.
- **P5** — profile link-through (person profile shows company cards) + horse-record provider
  attachment picking from the directory.

Ordering constraint: P1 before all; P4 after P2; P3/P5 independent after P2.

## Q3 ruling detail (owner, 2026-08-05)
Edge creation is staff/admin-only today. Members cannot self-declare a company association
(self-declared signing power is the abuse vector). FUTURE (not built now): peer-validation —
when a company already has a CONNECTED person, a new association request routes to them;
their approval grants it, inaction blocks it. Primary near-term use cases: owner-operators
(rider whose business is directory-listed) and LLCs held for horse-ownership legal purposes.
