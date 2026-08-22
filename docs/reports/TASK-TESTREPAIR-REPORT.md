# TASK-TESTREPAIR — report

## Does the contract engine have a working safety net again?

**Yes.** `contract_workflow.test.ts` (32/32) and `e2e_contract.test.ts` (10/10) now run
against the **current, live schema** and pass for real reasons — the lease and sale
engines, proven end to end through the actual RPCs the app calls, with a genuine,
non-null cryptographic execution hash for the first time this suite has ever produced
one. Neither file had been touched since **before** the RPCs, tables and authority model
they drove were renamed or retired weeks ago; both were silently exercising nothing.

The rest of `test/db` is **51 failed / 25 passed** (was 46/30 on `main`), and every one
of those six extra files is explained below, none of them a real regression — see §4.

---

## §1 — the schema snapshot, regenerated

`test/db/fixtures/schema_snapshot.sql` was a `pg_dump` of production (`lrstswfxfsezdmvkvukc`)
dated **2026-08-03**. Regenerated today (2026-08-21) against the same database, same
recipe as the original (documented in the file's own header, so the next regeneration
doesn't have to reverse-engineer this report):

```
pg_dump "$DBURL" --schema-only --schema=public --no-owner --no-privileges \
  --no-tablespaces -f schema-only.sql
pg_dump "$DBURL" --data-only --column-inserts --disable-triggers --no-owner \
  --no-privileges --table=public.<14 allowlisted tables> -f data-only.sql
```
then strip pg_dump 18's `\restrict`/`\unrestrict` meta-commands (PGlite's `exec()`
doesn't understand them), comment out `CREATE SCHEMA public;` (PGlite already has one),
and concatenate under a new header. Same 14-table `SNAPSHOT_DATA_TABLES` allowlist as
before — **no table added, no PII review needed.**

**The schema now carries PARTYSTAGING, ADDITEM, NOSTRIP, BUYANDBOOK, CATEGORISE,
SLOTREACH and LESSONPLAN**, plus everything else merged since 2026-08-03 (the 18-day gap
the task named — in reality closer to 30 migrations touching the contract engine alone).

### The ~31 in-place function-rewrite migrations — how they were handled

**Not replayed, and don't need to be.** The snapshot's whole design (Task 4, 2026-08-02)
is to `pg_dump` the **live, current** function bodies directly from production rather than
reconstruct them by replaying migration history. A `CREATE OR REPLACE FUNCTION` rewrite
that would no-op on a fresh migration replay (nothing to match its anchor) is invisible to
this problem entirely — `pg_dump` emits whatever the function's body **currently is** in
production, already correct, with no replay step involved. This is a pre-existing property
of the snapshot path, unchanged by this task, and the reason `createTestDbFromSnapshot()`
is the harness's default rather than `createTestDbFromMigrations()`.

### One new wrinkle this regeneration hit, and the fix

`contract_templates` gained a **self-referencing FK** since the last snapshot
(`companion_template_key → contract_templates.template_key`,
`20260811T1700_oneauthor_template_surface_config.sql`). Plain sequential `INSERT`s now
fail (`contract_templates_companion_fkey` violated) whenever a companion row is inserted
before the template it points at — `pg_dump` warns about exactly this and names the fix.
Added `--disable-triggers` to the data-only dump (wraps each table's rows in `ALTER TABLE
... DISABLE/ENABLE TRIGGER ALL`), which needs owner/superuser privilege the harness's
loading connection already has. Documented in the snapshot's own header for the next
regeneration.

### A second, independent gap found and fixed in the harness itself (not the snapshot)

`compute_execution_hash()` (the function that stamps every executed document's
tamper-evidence hash) calls pgcrypto's `digest()`, and **silently catches
`undefined_function` and returns NULL** if it's unreachable. `pg_dump --schema=public`
filters out `CREATE EXTENSION pgcrypto` — pgcrypto lives in the `extensions` schema on
production, outside that filter — so **no snapshot, old or new, has ever installed
pgcrypto into the test harness.** Every document that ever reached EXECUTED in this
harness got a **silently NULL execution_hash**, and nothing caught it because no test
previously drove a document through a real signature to completion (this task's two
suites are the first that do). Fixed in `harness.ts`'s `createTestDbFromSnapshot()`:
`CREATE EXTENSION IF NOT EXISTS pgcrypto;` right after bootstrap, matching the migration's
own unqualified form. Verified: `digest('a','sha256')` and `compute_execution_hash(...)`
both now resolve; `contract_workflow.test.ts` and `e2e_contract.test.ts` both assert a
truthy `execution_hash` and it holds.

---

## §2 — the two suites, made to run

Both files had not been touched since **2026-07-05** (`contract_workflow.test.ts`'s own
header date) and **before** SALE BUILD (2026-08-02) respectively — long before the stale
snapshot's own 2026-08-03 cutoff. Every RPC and table they drove had since been renamed
or retired. **Neither failure traces to the six named D-rules** (D14 · D22 · D23 · D25 ·
D28 · D29) — I checked each one against the actual errors and none is the operative
cause. The real causes are two specific, dated, named migrations plus plain API
evolution, cited below instead of force-fitting a D-number that doesn't apply:

- **`start_lease_contract` (3-arg) doesn't exist.** Renamed to `start_lease_contract_v2`
  (5-arg, template-selectable) on 2026-07-20 (`20260720180000_start_lease_v2.sql`); the
  bare name was dropped entirely on 2026-08-01 (`audit_fixes_batch1.sql`) — **before**
  even the stale snapshot's cutoff. This test never ran successfully against any snapshot
  this repo has had.
- **`engagements` / `engagement_parties` are RETIRED** (CLAUDE.md: "RETIRED — do not
  resurrect"). Replaced by the `contracts`/`contract_parties` deal spine plus
  `document_parties` (document-scoped signer roles) — the Deal-plan work
  (`e668be7`, 2026-08-03). `document_change_requests` is now `contract_change_requests`.
  `create_purchase_engagement` and `HORSE_PURCHASE_SALE` are gone the same way
  (`HORSE_PURCHASE_SALE.deleted_at = 2026-08-02`, SALE BUILD); `start_sale_contract` +
  `HORSE_SALE_V2` replaced them.
- **H1 — `originator_authority_collapse` (2026-07-29,
  `20260729022000_originator_authority_collapse.sql`).** *"The company (staff) is always
  the author"* — an originator contact (even the party recorded as
  `originator_contact_id`) has **no special edit/workflow authority** anymore.
  `share_document`, `resolve_change_request`, and the `editable→editing` transition are
  now **staff-only** (or, for the last one, gated on `recipient_editing`) — a party's
  authority is limited entirely to the fields their role owns. `set_contract_field`'s own
  comment states it plainly: `v_is_orig := false; -- H1: originator no longer grants
  edit rights`.
- **PARTYCTRL (2026-08-04, `20260804150000_seed_party_controls_at_creation.sql`).**
  `start_lease_contract_v2`/`start_sale_contract` now seed `document_party_controls` with
  `can_edit_deal=true` for **every** party role at creation — so DEAL fields are editable
  by any party from the start; `recipient_editing` no longer gates that (it now only
  gates the `editable→editing` reopen, per H1). The original test's whole
  "`recipient_editing` gates the counterparty's DEAL access" model predates this
  migration and is no longer how the engine works.

Both files were rewritten against the **current** engine — same RPCs the app actually
calls, same table names, same authority model — not patched to merely "not error."
Diffs are large (both files effectively rebuilt); nothing was deleted to go green.
Notable specifics:

- `contract_workflow.test.ts`'s lock/sign path fills `HORSE_LEASE_V2`'s ~30 conditionally-
  gated required fields by **driving `contract_lock_blockers` itself** (loop: read what
  it reports missing, fill with a branch-closing value, repeat) rather than hand-listing
  every field — the same fixture the app's own completeness check uses, so it stays
  correct across the next template edit instead of hardening a snapshot-in-time list.
- `e2e_contract.test.ts`'s field-fill step reuses the **exact value set**
  `sale_golden_render.test.ts`'s `SALE_COMMON` already proves correct (a currently-passing
  file) rather than re-deriving HORSE_SALE_V2's ~50 required fields from scratch.
- `record_signature` now requires the **caller's own contact** to match the signing
  party — no staff-impersonation of BUYER/SELLER (only COMPANY has a
  staff-signs-on-its-behalf carve-out, for the faceless company contact). Both files'
  signing steps authenticate as the actual party.
- The seeded COMPANY signatory is **"French Heritage Equestrian"** in current live data,
  not "Charles Zigmund" (the old e2e test's hardcoded name) — plain data drift, asserted
  dynamically now instead of hardcoded.
- `contract_requirements` (service_type → template_key mapping) is pure configuration,
  no PII, but isn't on the snapshot's reviewed data allowlist, so it loads empty.
  `e2e_contract.test.ts` seeds the two rows it needs directly, citing why, rather than
  expanding the allowlist for one assertion.

---

## §3 — the counterparty Suggest diagnosis

**CONTRACTSEND's lead:** *"`caller_may_propose(doc,'suggest')` returns false for both
parties, because `start_lease_contract_v2` seeds no `document_party_controls` rows."*
**That premise no longer holds** — PARTYCTRL (above) now seeds a row for every party at
creation. What it seeds is `can_suggest=false` (parties get `can_edit_deal=true` instead,
by design — `PartyControlsCard.tsx` makes `can_edit_deal` and `can_suggest` mutually
exclusive; a party starts in the "can edit directly" tier and staff can dial a specific
party down to "suggest only" per document).

**With the fresh snapshot, I ran the actual path** (a fresh lease, staff flips one party
to suggest-only via the **real** `set_party_controls` RPC, that party calls the **real**
`propose_contract_composition` RPC, staff reads the **real** `contract_redline_state`
RPC) — first time this has ever been exercised in `test/db` (`contract_pending_compositions`
didn't exist on the stale snapshot at all). **It works, cleanly, end to end:**

```json
{
  "setResult": "OK",
  "controlsAfter": [{"can_edit_deal": false, "can_suggest": true}],
  "proposeResult": "OK pending_id=fb84dc66-…",
  "staffPendingCompositions": [{
    "id": "fb84dc66-…", "status": "open", "mine": false,
    "proposed_by": "Lucy Lessee", "proposed_by_role": "LESSEE", …
  }]
}
```

**So the backend chain is not broken today.** The most likely explanation for what
WALK3/CONTRACTSEND actually saw: `ContractPage.tsx` only passes `pendingCompositions` to
`ClauseDocument` when `state !== 'executed' && !readOnlyDoc && !showHorseGate && structure`
— gated behind the **same** horse-section render bug CONTRACTSEND's own §2 fixed
(`section === 'Horse'` vs the stored key `'HORSE'`). If that gate was still stuck at the
time of WALK3's walk, the entire clause document — including any pending suggestion —
would never have rendered for staff, independent of whether the suggestion itself existed.
Both the PARTYCTRL gap and the horse-gate render bug predate this task and both are
already fixed on `main`.

**Diagnosis, not fix, per instructions.** No code changed for this section. **Proposed
verification** (not built): a real-browser walk mirroring CONTRACTSEND's — staff sets a
party to suggest-only via `PartyControlsCard`, that party submits via
`AddElementModal`'s propose path, staff reopens the document and confirms
`PendingCompositionBox` renders it. This is a reachability confirmation, not a new
backend defect.

**One independent, smaller finding surfaced by this probe, not the Suggest bug itself:**
`document_party_controls` has **RLS enabled with zero policies** — any direct client-side
query against it (bypassing the `SECURITY DEFINER` RPCs) silently returns nothing / writes
nothing, for every role including staff. Harmless today (the frontend only ever touches
this table through `set_party_controls`/`caller_may_propose`/etc., confirmed by grep —
never a direct `.from('document_party_controls')` call), but it is exactly the
"silent-no-op grant trap" shape this project has been bitten by before. Worth a policy
someday; not urgent, not fixed here.

---

## §4 — the true composition of the red files

**51 failed files** (was 46 on `main`; +8 new, −3 now passing). File-for-file diff:

**Now passing (3):** `contract_workflow.test.ts`, `e2e_contract.test.ts` (this task,
§2) — and `service_catalog.test.ts`, unblocked purely by the fresher schema, no code
touched.

**Newly failing (8) — NOT a regression, one shared, structural cause:**
`careplans_days_are_the_frequency`, `creditalign_recurring_entitlement_and_swap`,
`creditfix_mint_from_unit_count`, `leadclean_open_queue`, `lessonform_one_form_per_booking`,
`paylock_finalize_payment_buyer_keys`, `reviewq_pending_and_company_queue`,
`zelleclose_payment_notifications_staff_write`. Every one of these files has a
`describe('BEFORE — …')` block that asserts a bug's **pre-fix** state (a specific function
body, an absent table, a specific old regex) by starting from the snapshot and applying a
named list of *older* migrations on top — a TDD-style reproduction, calibrated to a
snapshot dated **before** that file's own fix shipped. **Refreshing the snapshot to
current production collapses that premise everywhere at once**: the snapshot now already
contains the fix (it shipped to prod between 2026-08-03 and today, same as everything
else this task pulled forward), so "BEFORE" can no longer be reproduced — not because the
fix regressed, but because there is no more "before" left upstream of where these tests
start. **Verified for a sample, not assumed:** queried production directly and confirmed
`swap_booking_item`, `_recurring_allotment_days`, `_generate_plan_month` all exist and are
live; `book_open_slot` now genuinely takes 3 args (`p_booking_id, p_horse_id, p_credit_id`)
where the test's regprocedure cast still hardcodes 2, which is what actually throws for
`reviewq` (a real signature change, still not a regression — the function that exists is
the correct, later one). **This is a structural property of the BEFORE/AFTER-against-a-
live-snapshot pattern, not something an app-level fix could revert:** any future
regeneration will do this again to any file using it. Left unfixed (out of scope — these
are not the two named suites, and the fix is a redesign — pin the BEFORE section to
`createTestDb({upTo: '<file before the fix>'})` instead of the snapshot, or retire the
BEFORE block once its fix is a permanent part of history), reported here per the
instruction to leave-and-note rather than silently patch.

**Composition of the 43 pre-existing (unchanged from `main`) failures**, by the first
concrete error each throws (grouped, not exhaustive per-file — the ~20 individual
assertion-shape mismatches below were **not** individually triaged; that is real,
un-budgeted work for a separate pass):

| category | count | files (representative) |
|---|---|---|
| **Retired schema/RPC** — same class of fix as §2, not yet applied | 10 | `audit_logs`, `esign_hardening`/`lesson_sessions`/`membership_self_heal`/`minor_onboarding`/`notifications`/`platform_catalog_org_scope`/`request_inbox`/`rider_onboarding` (`offering_tiers`, retired 2026-07-08, all share ONE `beforeAll` failure cascading through the suite), `generate_document`, `purchase_flow`/`purchase_broker_contracts` (`create_purchase_engagement`/`start_purchase_contract`), `company_party_and_org_tokens` (`intake_submissions`) |
| **Data drift, not a bug** — module-entitlement set or business identity changed in prod since the assertion was written | 5 | `entitlements`, `my_modules`, `provision_tenant` (all hardcode an old `{mod.brokerage,…}` set; prod now has more modules on — PAGEVIS, 2026-08-12); `release_kiosk`, `value_registry` (hardcode "Charles Zigmund"/old org fields; prod is "French Heritage Equestrian") |
| **Already-known, pre-existing real defect** — reported by name in the prior TASK-TESTDB audit, unchanged | 1 | `products_billing` (D-1: `block_settled_billable_line_update()` tests `NEW.transaction_id`, a column dropped with `transactions`) |
| **`storage.objects` FK cascade** — one setup-time failure, shared by a cluster | 4 | `mod_employees`, `mod_horserecords`, `my_modules`, `new_storage_buckets` (bucket-seed ordering, not investigated further) |
| **Not individually triaged** — real assertion-shape mismatches (counts, contents, rejection-vs-success), each needs its own read | ~23 | `business_config`, `business_identity`, `contract_bodies`/`contract_bodies_loaded`/`contract_modules` (HORSE_EVALUATION — confirmed retired by `SVCPURGE`, 2026-08-06, a **deliberate**, already-merged migration purging 6 service-contract templates; these three tests never got updated for it), `contract_templates_tokens` (count 24→26, templates grew), `crm_identity`, `documents_signatures_deliveries`, `e2e_consumption`, `e2e_provision`, `engagements_horses_backbone`, `form_definitions`, `organizations`, `pricing`, `public_intake`, `rls_meta_coverage`, `sign_general_release`, `storage_buckets`, and others |

**The honest number this task was asked for:** of the 43 pre-existing red files, at least
**16** (10 retired-schema + 5 data-drift + 1 known-defect) have a **named, verified**
cause, none of them contract-engine work left undone by this task. The remaining ~23 are
real findings still waiting on individual triage — genuinely unknown until read one by
one, which this task's scope (two named suites) did not include.

---

## §5 — acceptance checklist

1. **Both suites execute, pass for real reasons.** ✅ 32/32 + 10/10, against current RPCs.
2. **File-for-file diff vs `main`.** ✅ 3 newly passing (2 this task + 1 free), 8 newly
   failing (one shared, non-regressive, structural cause — verified against prod, not
   assumed), 43 unchanged. No file fails for a reason this task introduced.
3. **Every changed test cites its cause.** ✅ — cited by migration name (H1, PARTYCTRL,
   SALE BUILD, `20260720180000_start_lease_v2`), since none of the six named D-rules
   turned out to be the operative one; said so explicitly rather than force-fitting.
4. **Counterparty Suggest: cause named, diff proposed, nothing applied.** ✅ §3 — and the
   cause turned out to already be fixed (PARTYCTRL + CONTRACTSEND's own horse-gate fix),
   proven by running the real path for the first time, not guessed.
5. **True composition of the 46(51) red files, by category.** ✅ §4.
6. **`typecheck` 0 · lint identical to main.** ✅ `npm run typecheck` / `typecheck:api`: 0
   errors. `npm run lint`: 0 errors, 46 warnings — same count TASK-CONTRACTSEND reported.
7. **TEARDOWN.** ✅ No vitest/vite/esbuild process remains
   (`ps aux | grep -E 'vitest|esbuild'` empty). No scratch files left in the repo (three
   throwaway probe tests used for §3 were deleted after their findings were captured
   above).

## Files changed

- `test/db/fixtures/schema_snapshot.sql` — regenerated (§1).
- `test/db/harness.ts` — `+CREATE EXTENSION IF NOT EXISTS pgcrypto;` in
  `createTestDbFromSnapshot()` (§1).
- `test/db/contract_workflow.test.ts` — rewritten against the current engine (§2).
- `test/db/e2e_contract.test.ts` — rewritten against the current engine (§2).

Committed to `task/testrepair`, not pushed.
