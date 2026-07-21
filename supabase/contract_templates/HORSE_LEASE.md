# HORSE_LEASE — retired flat template (content moved to the database)

**This file no longer holds the lease contract text.** It is kept only as a pointer.

As of 2026-07-20 the horse lease is built by the **clause authoring engine**, not from
a flat markdown body. New leases use template_key **`HORSE_LEASE_V2`**, whose content
lives entirely in the database as structured Section › Clause › Field data. The legacy
flat `HORSE_LEASE` template + `start_lease_contract` remain only for pre-existing flat
documents (there are currently none); all new leases are created via
`start_lease_contract_v2`.

> NOTE for `scripts/build-template-load-migration.mjs`: this key is excluded from the
> generator (see the `RETIRED` set there) so it is never re-loaded from this file.

## Where the lease content lives now — edit here, in the database

Composed at document-generation / field-edit time from three tables, all keyed by
`template_key = 'HORSE_LEASE_V2'`:

| Table | Holds | Edit to change… |
|---|---|---|
| `contract_section_defs` | Numbered top-level sections (`section_key`, `heading`, `sort_order`) | Section titles, order |
| `contract_clause_defs` | Clauses within sections (`clause_key`, `heading`, `body`, `clause_type`, `sort_order`, `conditional_on`, `guidance`) | Clause **prose** (`body`), decimal ordering, conditional gating, ⓘ hint text |
| `contract_field_defs` | Input fields inside clauses (`field_key`, `label`, `format_type`, `options`, `responsibility_kind`, `conditional_on`, `guidance`, `clause_key`) | Field labels, dropdown/checkbox **options**, type, gating, hints |

**Edit a clause's wording:**
```sql
UPDATE contract_clause_defs
   SET body = '…new prose…'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'INSURANCE_RISK.SAFETY_ATTIRE';
```
Apply with `PGCLIENTENCODING=UTF8` to avoid mangling em-dashes / curly quotes.

**Change a field's options:** update `contract_field_defs.options` (a JSON array of
`{value, label}`) for the target `field_key`.

**Composition:** `remerge_contract_from_clauses(document_id)` (dispatched via
`remerge_contract_body`) auto-numbers sections/clauses, drops gated/optional clauses,
fills `{{TOKENS}}`, and writes `documents.merged_body`. Editing a field on a live
document recomposes the body automatically.

## Seed migrations that populated HORSE_LEASE_V2 (reference)

- `20260720160000_authoring_clause_model.sql` — section/clause tables + columns
- `20260720161000` / `162000` / `163000` — clause composition, gating (`contains`),
  empty-section suppression
- `20260720170000`–`174000` — the clause/field seed (parts 1–5)
- `20260720180000_start_lease_v2.sql` — `start_lease_contract_v2` + the template row
- `20260720190000`–`195000` — party-picker "Other", corrections, held-liability
  decisions, restored authored attire clause, and the three added review clauses

There is no markdown source to edit — the database is the source of truth.
