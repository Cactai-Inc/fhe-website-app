# TASK-PURPOSEFIX — Purpose of Agreement select actionability

**Status: already fixed by prior work. No `ContractPage.tsx`/`ClauseDocument.tsx` change made — none was needed, per rigorous re-verification below.**

## Summary

The task spec (`docs/tasks/TASK-PURPOSEFIX-deal-field-select.md`) describes a live defect
reported by the owner on 2026-08-05 (twice): the "Purpose of Agreement" select
(`TXN.LEASE_PURPOSE`) not actionable for staff or `can_edit_deal` parties. Root-causing
before writing any fix (as instructed) found that **both halves of the mechanism were
already corrected by prior, already-merged work**, on the same day the defect was
reported:

1. **Server-side seeding default** — `20260805170000_seedfix_can_edit_deal_default.sql`
   (already in `supabase/migrations/`, already applied to prod) changed the three contract
   starters to seed `document_party_controls.can_edit_deal = true` by default, plus ran the
   backfill for existing non-terminal documents. This is exactly TASK-PURPOSEFIX work item 3
   — it just predates this task by six days.
2. **Client-side gate-control rendering** — `ClauseDocument.tsx`'s "R1" gate-control
   mechanism (comment dated 2026-08-04) plus the ownership-affordance fix (dated
   2026-08-06, pinned by `test/ui/clause_ownership_affordance.test.tsx`) already render a
   DEAL-owned select as an interactive, non-muted control regardless of whether its
   governing clause is currently gated on or off.

I verified both of these are live and correct using real production data (not
assumptions), rather than trusting that the git history matched what's actually deployed.

## Root cause, precisely (as requested — separately for staff and party)

Field: `TXN.LEASE_PURPOSE` (select, 4 options, `owner_role=DEAL`, no gate of its own,
`clause_key='PURPOSE.RECREATION'`). Clause `PURPOSE.RECREATION_DEFAULT` is the placeholder
(gate `equals: [""]`); clause `PURPOSE.RECREATION` is the real sentence containing
`{{TXN.LEASE_PURPOSE}}`, gated on the field having one of the 4 real values.

**Mechanism while the field is unanswered** — `ClauseDocument.tsx`:
- `fieldIsMine()` (163–167) returns `true` unconditionally for any `owner_role='DEAL'`
  field, for both staff (`myRoles=[]`) and any party.
- `clausesToShow` (824–840) includes the gated-off `PURPOSE.RECREATION` clause as a preview
  for staff via `cb.authorView` (832), and for a party via `gateIsPendingForViewer` (839,
  fn at 369–383) — true because the trigger field is unanswered and `fieldIsMine` is true.
- Because `TXN.LEASE_PURPOSE`'s own `clause_key` **is** `PURPOSE.RECREATION` (the clause it
  gates) and its body contains the `{{TXN.LEASE_PURPOSE}}` token, the orphan-field
  computation (906–911) classifies it as a **gate control**: `gateControls` (911).
- The gate-control block (962–966) renders **before**, and outside, the
  `pointer-events-none` muted-preview wrapper (976–980) — this is precisely what "R1"
  (2026-08-04 comment on 955–961) was written to fix: "the QUESTION renders live and at
  full opacity, ABOVE the muted consequence."
- `renderOrphan` (916–948) passes `editable={cb.editable && fieldIsMine(f, cb)}` to
  `InlineFieldControl`, which computes `disabled = !editable || !f.can_edit`
  (`ContractCascade.tsx:1125`).

**Mechanism once the field is answered** (e.g. Sarah's document, value `INSTRUCTIONAL`):
`PURPOSE.RECREATION`'s own gate is now met (`gatedOff=false`), so it renders unmuted via
its normal body, and `renderToken` (423–445) renders the inline `{{TXN.LEASE_PURPOSE}}`
token with `editable={cb.editable && selfGateMet && mine}` — `selfGateMet=true` since the
field carries no `conditional_on` of its own, `mine=true` (DEAL). Same `disabled` formula.

**In both cases**, `cb.editable` traces to `ContractPage.tsx:1713`'s
`editable: editablePhase` (`state==='editable'||'editing'||'in_review'`), true for both
staff and party in the reported scenarios, and `f.can_edit` is server-computed by
`contract_document_detail`'s `can_edit` CASE (verified below) as `v_staff OR
(owner_role='DEAL' AND v_can_deal) OR (...)`.

**Conclusion**: for both staff and a `can_edit_deal` party, nothing in the current,
frozen `ClauseDocument.tsx` or in `ContractPage.tsx`'s prop wiring makes the control inert.
The one thing that *could* make it inert — `can_edit_deal=false` at the DB row — was fixed
by SEEDFIX on 2026-08-05, the same day it was reported.

### How I verified this instead of trusting the code trace

Static tracing alone can be wrong, so I backed every claim with real data:

- **SQL**: pulled the live `pg_get_functiondef` of `contract_document_detail`,
  `set_contract_field`, and all three starter functions directly from prod (not from the
  migrations directory) and confirmed their logic matches the spec.
- **Simulated RPC calls** (read-only, `BEGIN…ROLLBACK`, `SET LOCAL request.jwt.claims`) as
  a genuine staff account (`b45a5503…`, ADMIN, org-matched), as the LESSOR party on a live
  test document, and as Sarah on her own real document — `contract_document_detail` returns
  `can_edit: true` for `TXN.LEASE_PURPOSE` in every case.
- **Actual React render**: wrote a throwaway test using the project's existing
  `test/ui` harness (`@testing-library/react` + jsdom) and the real fixture data already
  checked into `test/ui/fixtures/{lease-structure,averify2-fields}.json` (dumped from the
  live AVERIFY2 document). Rendered `<ClauseDocument>` for `myRoles=[]` (staff), `['LESSEE']`,
  and `['LESSOR']`, both with the field empty and with a fixture-mutated value of
  `INSTRUCTIONAL`. In all six combinations the rendered `<select>` for
  `TXN.LEASE_PURPOSE` has `disabled === false`. This file was investigation-only and was
  **not** committed (removed after use); the technique and its result are recorded here for
  reproducibility.

## Fix

None applied. Per the constraints, `ClauseDocument.tsx` is frozen and would only be touched
if the true fix required it — it does not, because the mechanism it already contains is
correct. No `ContractPage.tsx` change was needed either. This is a genuine "already done"
finding, not a decision to skip work.

## Migration / seeding (work item 3)

Already shipped: `supabase/migrations/20260805170000_seedfix_can_edit_deal_default.sql`
(committed 2026-08-05, i.e. before this task existed). It:
- `CREATE OR REPLACE`s `start_lease_contract_v2`, `start_sale_contract`, and
  `add_deal_document` so each seeds `document_party_controls.can_edit_deal = true` (was
  `false`) for every non-FHE/COMPANY party role at creation.
- Backfills existing rows: `UPDATE document_party_controls SET can_edit_deal = true …
  WHERE d.status <> 'EXECUTED' AND c.can_edit_deal = false`.

I confirmed this is **live in prod today**, not just in git:
- `start_sale_contract` and `add_deal_document`'s live `prosrc` are byte-identical
  (whitespace-normalized) to this migration file.
- `start_lease_contract_v2`'s live `prosrc` differs textually (later LEASEFORK/LEASEFIX
  migrations added a `p_template_key` parameter and `default_value` seeding), but the
  `can_edit_deal` literal it seeds is still `true` — the SEEDFIX change survived those
  later edits.
- **Backfill gap check** (informational, not a write): querying
  `document_party_controls` joined to `documents` for `can_edit_deal=false AND status <>
  'EXECUTED' AND workflow_state NOT IN ('terminated','void')` returns **0 rows**. Full
  breakdown of every `can_edit_deal=false` row in prod:

  | workflow_state | status | count |
  |---|---|---|
  | executed | EXECUTED | 1 |

  That one row is on a terminal, executed document — correctly excluded per the spec
  ("Signed/executed documents are excluded — do not touch them"). No further backfill
  needed or performed.

I did **not** write a new migration, since one that does exactly this already exists and
is already applied — a duplicate would be redundant and against the repo's own migration
hygiene.

## Live proof (work item 4)

The task's named test document, `9a56b738-36f7-4a55-a813-cdd17fe4d753` (AVERIFY2 test
lease), turned out to already be **VOID** — voided 2026-08-06 by a prior cleanup task
(`TASK-A-PARTY-VERIFY-2`, `void_reason: "TASK-A-PARTY-VERIFY-2 cleanup: unsigned
VERIFY-TEST lease, never executed"`). A void document's `set_contract_field` call would
fail on the workflow-state gate regardless of `can_edit_deal`, which would not prove
anything about this defect. I searched for a live document pairing the same two
test identities (AVERIFY2 Tester / CJ Z) and found none — only documents pairing CJ Z with
the org's own company contact, both referencing a horse (Beaumont) that memory flags as
carrying a separate, unrelated armed defect (`TASK-SUPERSEDE`, "Beaumont docs reference
vanished contract, signing errors") — so I avoided those rather than risk conflating two
issues.

Instead I created one small, disposable, clearly-labeled test document — same pattern as
the original AVERIFY2 doc, same two test identities, no horse attached — ran the exact
proof cycle the task specifies, and voided it afterward with a reason note, mirroring the
established cleanup convention:

1. **Create** (staff session, `start_lease_contract_v2`): document
   `b7233813-d56d-4410-8628-7612679653c1` — LESSEE = AVERIFY2 Tester
   (`85fa1abe-346e-49fa-bf90-bbbebe7105ea`), LESSOR = CJ Z
   (`d99f1472-48b4-466e-aaa7-f76396745c17`), state `editable`. Confirmed
   `document_party_controls` seeded `can_edit_deal=true` for both roles automatically
   (proves SEEDFIX is live for new documents). `TXN.LEASE_PURPOSE` starts `''`.
2. **Write, as the party** (simulated LESSOR session — `auth.uid='0a7fc801-…'`,
   `has_staff_access()=false`):
   `set_contract_field('b7233813-…','TXN.LEASE_PURPOSE','RECREATIONAL')` →
   **succeeded**, returned `value: "RECREATIONAL"`.
3. **Revert, as the party, logged**:
   `set_contract_field('b7233813-…','TXN.LEASE_PURPOSE','')` → succeeded, value back to
   `''` (original state restored).
4. **Audit trail** (`contract_change_log`) shows both entries, actor = CJ Z, role LESSOR,
   `actor_is_staff=false`:

   | field_key | old_value | new_value | actor | roles | staff |
   |---|---|---|---|---|---|
   | TXN.LEASE_PURPOSE | *(empty)* | RECREATIONAL | CJ Z | {LESSOR} | false |
   | TXN.LEASE_PURPOSE | RECREATIONAL | *(empty)* | CJ Z | {LESSOR} | false |

5. **Cleanup**: voided the test document (`void_document`) with a note identifying it as
   a TASK-PURPOSEFIX proof artifact and why it exists. Note: this triggered the standard
   void-notification to the document's 2 parties (CJ Z and AVERIFY2 Tester) — both are
   established test identities used repeatedly for exactly this kind of exercise in prior
   sessions, so this is expected noise, not an unintended notification to a real
   counterparty.

This proves the server path works end to end for a non-staff `can_edit_deal` party,
exactly as the spec requires.

## UI proof (work item 4, browser-pending as always)

No browser access. Stated precisely from the fixed (verified-already-correct) code, per
the mechanism section above: `ClauseDocument.tsx` renders the interactive `<select>` for
`TXN.LEASE_PURPOSE`
- as a **gate control** (lines 962–966, via `renderOrphan`/`InlineFieldControl`) while the
  field is unanswered, for both staff (`authorView=true`) and any party for whom
  `gateIsPendingForViewer` holds (true for any DEAL-owned field, since `fieldIsMine`
  short-circuits on `owner_role==='DEAL'`);
- as an **inline body token** (lines 423–445, same components) once the field is answered,
  because the field's own `conditional_on` is `null` so `selfGateMet` is always true and
  the clause's gate is now met so the muted wrapper is absent;
- in both cases gated only by `cb.editable` (`ContractPage.tsx:1713`, true whenever
  `workflow_state` is `editable`/`editing`/`in_review`) and the server-computed
  `f.can_edit` (true for staff or a `can_edit_deal` party per `contract_document_detail`).

This is not a claim of visual verification — it is a reproducible, code-cited claim backed
by an actual DOM render (see "How I verified this" above) using real production data, which
is the strongest evidence available without a browser.

## Sarah's document — read-only confirmation

`704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` (LESSOR = Sarah Morgan, LESSEE = French Heritage
Equestrian, state `in_review`). Confirmed via read-only queries only (no writes issued):
- `document_party_controls`: `LESSOR` and `LESSEE` both `can_edit_deal=true`.
- `TXN.LEASE_PURPOSE` currently `INSTRUCTIONAL` (already answered).
- Simulated her own session (read-only, `BEGIN…ROLLBACK`) confirms `contract_document_detail`
  returns `can_edit: true` for `TXN.LEASE_PURPOSE`.
- Per the mechanism above (already-answered branch), her select would render actionable —
  reasoned from the fixed code, not visually verified.
- Post-task check: her document's `TXN.LEASE_PURPOSE` value is still `INSTRUCTIONAL` and
  `contract_change_log` still shows exactly 1 entry for that field (the original) —
  confirming zero writes landed on her document during this task.

## Files touched

- `docs/archive/BUILD_TRACKER.md` — new row A22.
- `docs/reports/TASK-PURPOSEFIX-REPORT.md` — this report.

No `src/` files were changed (`git diff` is empty against the branch point).

## Done-checks

- `npm run typecheck` — clean, 0 errors.
- `npm run typecheck:api` — clean, 0 errors.
- `npm run lint` — **0 errors, 35 warnings.** The task doc states a 29-warning baseline;
  I made zero changes to any file under `src/` (confirmed via a clean `git diff` before
  running lint), so all 35 warnings are pre-existing at this branch point — the 29 figure
  appears to be stale relative to `origin/main`'s current state, not something this task
  introduced. Flagging the discrepancy rather than silently reporting "matches baseline."

## Commits

Two commits on `task/purposefix`:
1. Docs only: `docs/archive/BUILD_TRACKER.md` (new A22 row) + this report.

No migration commit — the migration this task would have shipped already exists
(`20260805170000_seedfix_can_edit_deal_default.sql`) and is already applied; nothing new
to add to `supabase/migrations/`.

Per explicit session override, this branch was **not pushed** — committed locally on
`task/purposefix` only.
