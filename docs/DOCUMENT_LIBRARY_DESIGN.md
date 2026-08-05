# Document Library design spec (J1/J2) — DRAFT for owner review, 2026-08-05

Synthesis of two research passes (industry/web + codebase/DB grounding). Owner approval
required before build. J3 (deal adoption) is specced separately.

## What the research established

Retention reality for this business splits documents into three classes:
1. **Effectively permanent** — signed releases (minors' releases: retain until age of
   majority + limitations period, i.e. potentially 15+ years), sale contracts, bills of
   sale. Matches the existing "signed docs are never swept" rule.
2. **Fixed-window** — financial/tax (IRS: 3–7 years depending on case; employment tax 4).
3. **Expiring/renewable** — Coggins (12-month clock), vaccination proof, insurance
   certificates (CGL + Care/Custody/Control), instructor certifications, permits. These
   need validity dates and a "needs attention" surface.

At this volume (~65 docs, low hundreds of contacts): preset filtered views beat folder
trees; expiry tracking is the single highest-value feature; OCR, workflow engines, and
version trees are enterprise noise. Durable storage + retrievability beat every workflow
feature for waivers.

## Current-state facts (verified)

- Admin page = `/app/ops/documents-queue`: flat list, columns title/contract-uuid/status/
  date only, fetches `select('*')` including full `merged_body` for every row, and its
  status filter offers `SENT` — a value that doesn't exist in the live vocabulary
  (`AWAITING_SIGNATURE/DRAFT/EXECUTED/VOID`), so two real statuses are unfilterable and one
  filter is dead. Person/horse/type columns don't exist despite the data being on the row.
- **The system cannot hold an external document at all.** Every documents row is generated
  text (`merged_body`); no file column, no attachments table, no document storage bucket.
  A scanned Coggins, a boarder's insurance certificate, a registry paper, or a
  counterparty's paper contract has nowhere to live. This is the largest gap.
- `horse_health_events` already has `next_due` (indexed) + optional `document_id` — expiry
  plumbing half-exists for health items; nothing surfaces it.
- 29 template keys exist (19 active); live docs cluster into releases / policies /
  emergency authorizations / contracts.

## Proposed design — J1 (the library)

**One flat library, six preset tabs** (filters in real schema terms):
1. **Needs attention** (default) — awaiting-signature docs + assigned-but-never-generated
   obligations + the existing version-decision widget + (once uploads exist) items with
   `expires_on` within 60 days or past due, incl. `horse_health_events.next_due`.
2. **Signed library** — EXECUTED, non-archived; grouped by template category; superseded
   toggle.
3. **By person** — contact picker; deep-links into the existing dossier Documents tab
   rather than duplicating it.
4. **By horse** — horse picker; includes health-doc due dates from `horse_health_events`.
5. **Contracts & deals** — rows with `contract_id`, with counterparty + deal columns.
6. **Drafts, voids & archive** — DRAFT/VOID/archived/terminated; keeps clutter out of the
   library without deleting anything.

**Supporting changes:** fix the status filter to the real vocabulary; stop fetching
`merged_body` in the list query; add person/horse/type columns; add `category` to
`contract_templates` (release / policy / authorization / contract / services /
staff-vendor) so grouping is data-driven, not 29 raw keys.

**External uploads (the big build):** new `document-files` storage bucket + `documents`
rows with `source='UPLOADED'`, `file_path`, `expires_on date NULL`, template_id NULL,
category picked at upload. Uploads flow through the same RLS/visibility model as generated
docs. Coggins/COI/cert uploads get `expires_on`; the Needs-attention tab reads it. Signed
originals and uploads marked permanent are excluded from any future bulk operations by the
same never-sweep rule.

**Should-haves (build after the above):** bulk download/print pack per contact or per
contract; client-side text search over title/party once merged_body is out of the list
query.

**Explicitly skipped:** OCR/auto-classification, folder trees, workflow engine, version
trees beyond the existing supersession model, retention automation (policy, not software),
per-document ACL editing.

## Proposed design — J2 (the + button)

Current + inventory: Community post (all), Announcement (admin), New deal / New contract /
New client (staff), Book a lesson / Shop / New message (non-admin).

Add for staff: **Assign documents to a person** (exists today only deep inside the contact
dossier), **Upload a document** (new, with the uploads build), **New evaluation report**,
**Horse intake**, **New contact (without invite)** (the dossier's provision path — invite
optional). Remove: the documents page's own duplicate "+ New contract" header button once
the + carries everything.

## Build sequencing (if approved)
1. **J1a** — library page rebuild on existing data: tabs 1–6 minus expiry, status-filter
   fix, columns, template categories, query slimming. No schema risk, immediate usability.
2. **J1b** — external uploads + `expires_on` + Needs-attention expiry surface (storage
   bucket + migration + upload UI).
3. **J2** — + button expansion (rides with J1b's upload action; the rest can land in J1a).
4. Bulk download / print pack as a follow-up once J1b exists.

## Open questions for the owner
1. Approve the six tabs as named, or amend?
2. Uploads model: single `documents` table with `source='UPLOADED'` (recommended — one
   library, one visibility model) vs a separate attachments table?
3. Template categories list ok? (release / policy / authorization / contract / services /
   staff-vendor)
4. + button final list ok? Anything else you want quick-create for?
