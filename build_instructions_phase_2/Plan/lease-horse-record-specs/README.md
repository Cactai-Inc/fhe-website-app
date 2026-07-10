# FHE — Standardized Negotiated Lease + Horse Record System (implementation bundle)

For: Claude Code. This bundle updates the FHE web app repo. It is a reconciliation against an EXISTING contract-workflow engine plus a new horse-record system — NOT a greenfield build. Read `specs/00-RECONCILIATION-SPEC.md` first, then `HANDOFF.md`, then the numbered/lettered specs.

IMPORTANT CONTEXT: the reference repo originally provided was ~93 commits behind main (work had landed on main, not preview). Treat main as ground truth. Where a spec's assumption conflicts with current main, match main and flag the discrepancy rather than silently choosing.

## Read order
1. `specs/00-RECONCILIATION-SPEC.md` — what exists (the engine), which owner decisions it already satisfies, the full gap list.
2. `HANDOFF.md` — build order, obsolete-file disposition, wiring + test checklists, done-criteria, settled decisions (incl. the arbitration-clause guard), and the cross-update flag for the OTHER update that runs first.
3. Specs, in build order:
   - `spec-B-horse-columns.md` — additive `horses` columns.
   - `spec-A-templates.md` — load the new lease body; regenerate the loader; forward re-assert migration. (Uses the CURRENT short arbitration clause; do NOT reintroduce the old JAMS/AAA language.)
   - `spec-C-remerge-and-strip.md` — CORE: re-merge merged_body from contract_fields at lock + data-driven CUT + strip-unfilled.
   - `spec-E-field-seed.md` — full-granularity lease field seed (horse fields are LESSOR-owned and birth the record).
   - `spec-F-horse-sublock.md` — Lessor horse-section sub-lock.
   - `spec-G-counterparty-onboarding.md` — invite → Google/password auth → minimal contract-only surface.
   - `spec-H-horse-records.md` — horse record system: intake/record matched pair, four creation paths, microchip dedup, execution effects (lease attaches lessee-for-term; sale transfers ownership; both keep history), staff horse-records page, marketplace wiring, onboarding field append. Build AFTER A–G.

## Artifacts (drop-in / reference)
- `artifacts/contract_templates/HORSE_LEASE.md` — the standardized lease template. Replaces `supabase/contract_templates/HORSE_LEASE.md`. 84 distinct tokens, balanced CUT markers, ORG removed, short arbitration clause.
- `artifacts/horse_record/horse_record_schema.sql` — schema REFERENCE for the horse record (extend `horses`; add `horse_relationships`, `horse_reconciliation`). Not a drop-in migration; reconcile against the existing `horses` table.
- `artifacts/horse_record/horse_intake_form.md` — the standardized horse intake (matched pair to the record; parses through the build-form-definitions script).
- `artifacts/intake_forms_OBSOLETE/` — the two placeholder lease intake forms, OBSOLETE. Included only as a field-inventory reference; do not add them to the app. Discard after the field seed is in place.

## The one gap that matters most
`generate_document` merges once at creation from tables and hardcodes CUT to MINOR/JUMPER. Negotiated values live in `contract_fields` but never re-merge, and the lease's optional sections have no keep/strip rule. `spec-C` fixes both: re-merge from fields at lock, evaluate CUT from the data, strip unfilled — producing the signed document. Everything else hangs off this.

## Not to be started without an external input
The equine SALE agreement's full-parity rebuild is blocked on an owner-provided same-source reference document. Do not author an equine sale agreement from scratch. See HANDOFF §6.
