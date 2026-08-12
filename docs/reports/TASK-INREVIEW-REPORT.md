# TASK INREVIEW — report

Branch `task/inreview`, worktree `~/Downloads/claude-code-repo/wt-inreview`, off
`origin/main`. Committed, **not pushed**.

Migration: `supabase/migrations/20260812T2100_inreview_widen_authoring_rpcs.sql`.
Applied to prod (dry-run in `BEGIN;…ROLLBACK;` first, then applied for real — no
self-contained `COMMIT;`, no shared temp-table name with any other migration).

---

## THE CHANGE

Widened the `workflow_state` check in all five RPCs from
`NOT IN ('editable','editing')` to `NOT IN ('editable','editing','in_review')`:

```
add_contract_composition
remove_contract_composition
add_contract_element
propose_clause
set_field_included
```

**Method:** exact-substring rewrite of the live `pg_get_functiondef` body — the same
guard-only-edit pattern GUARDREST used earlier today
(`20260812T1200_guardrest_coalesce_bare_definer_guards.sql`). Each edit asserts the
old fragment appears exactly once before writing, then re-reads the catalog to prove
the new fragment landed and the old one is gone. This makes it structurally
impossible for the migration to have touched anything but the state list — it never
re-types a function body.

Confirmed by diffing the live function definitions from immediately before the
migration against immediately after: **exactly one line changed per function, byte-
for-byte identical otherwise.** (`propose_clause`'s exception message differs from
the other four — `'the document is not open for changes'` vs `'document is not
editable'` — that pre-existing difference is untouched.)

## THE TEST — all five items proven

**1. All five succeed against `in_review`.** Proven against
`704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` (Sarah Morgan's sample — also one of the two
live leases), impersonating Sarah (a real document party, not staff) inside
`BEGIN;…ROLLBACK;` so no test data was left on a document currently out for
signature:
- `set_field_included` → succeeded (no exception).
- `add_contract_element` → returned a new field (`CUSTOM.INREVIEW_TEST_FIELD_1`,
  section `INSURANCE_RISK`).
- `add_contract_composition` → created a new section + header + line
  (`INREVIEW_TEST_SECTION`, `CUSTOM.INREVIEW_TEST_HEADER_3`, `CUSTOM.LINE_4`).
- `propose_clause` → created an addendum (`item_number` 1).
- `remove_contract_composition` → removed the 3 rows just created (by the section's
  real minted `field_key`, resolved from `contract_fields`, not the label).

Also spot-checked `add_contract_element` against the *other* live lease,
`e1052bae-c20c-47e3-8703-7ef64f2bf852`, impersonating its own party — succeeded
identically, also rolled back.

**2. All five still refuse `executed` and `void`.** Proven against an executed
document (`152912dd-d6f0-42e3-ad7a-45e410934a93`) and a void document
(`b7233813-d56d-4410-8628-7612679653c1`), impersonating a staff account (bypasses
`caller_may_propose`/authorization so the state check is isolated) with `SAVEPOINT`
between calls. All five raised their pre-existing exception
(`document is not editable` / `the document is not open for changes`) in both
states, unchanged from before the migration.

**3. Add Item is usable on both live leases without unlocking them.** Both
`704c8d2d…` and `e1052bae…` are `in_review`; both now accept all five RPCs as shown
above. The owner's stated blocker is gone.

**4. No other behaviour changed.** Diff shown above — one line per function, the
in-transaction verification block re-reads the catalog after each write to prove it.

**5. The two findings below are reported, not fixed.**

---

## FINDING 1 — `propose_clause` should be renamed; not renamed here

`propose_clause` is called from exactly one place in the frontend:
`AddElementModal.tsx:763`, the Add Item modal's `mode === 'clause'` branch — self-
authoring, per D14/this task's ruling, not a request awaiting agreement. `lib/
contracts.ts:580` is the only wrapper.

**The name actively misleads, and it isn't only the identifier — the UI copy repeats
it.** `AddElementModal.tsx` says *"Write the clause to propose"* / *"Clause
proposed"*; `propose_clause` inserts into `contract_addenda` with `status = 'open'`,
which then surfaces in `ContractPage.tsx`'s "clauses (open = highlighted pending;
accepted = agreed)" panel — the **same visual pattern and copy** ("Proposed edits and
new clauses are highlighted here until the owner accepts or rejects them") used for
genuine field-edit proposals via `resolve_field_edit`/`withdraw_field_edit`. A reader
has every reason to assume `propose_clause` is a request-for-agreement mechanism; it
took the owner ruling in D14 to settle that it is authoring that happens to route
through an addendum row instead of a direct `contract_fields` write. **This is the
"cost three exchanges to disambiguate" problem the task names, and the addenda-backed
Accept/Reject surface is exactly why it recurs.**

**Recommendation:** rename `propose_clause` → `add_clause`, matching the `add_*`
naming of the other four widened RPCs, and pairing naturally with the existing
`resolve_clause` / `withdraw_clause` RPCs it already sits beside. **Not renamed here**
per the task's instruction — it's called from `AddElementModal.tsx` and `lib/
contracts.ts`, and bundling a rename with this widening would muddy both diffs.

## FINDING 2 — `ContractNotes` vs `ContractChangeRequests`: deliberate, not a leftover

Both are live, both render as separate drawers in `ContractPage.tsx` (lines
1172–1193 and again 2216/2221), each independently gated by its own template flag
(`contract_templates.show_comments`, `.show_change_requests` — tenant-configurable,
not hardcoded).

**They are two different things by design, confirmed by both components' own
documentation and copy:**

- `ContractNotes.tsx` (drawer label **"Comments"**): its header comment says *"A
  comment is a titled conversation, not a proposed edit: no resolution lifecycle,
  nothing about the contract text changes."* Its own in-UI copy says: *"Comments are
  a great way to chat about this contract... Use as many as you need and label them
  anything you want. You can use Requests to chat about specific contract sections,
  its layout mirrors the exact contract layout you see below."* — i.e. it names
  `ContractChangeRequests` as the other surface and explains the difference, in the
  product copy itself.
- `ContractChangeRequests.tsx` (drawer label **"Requests"**): its header comment says
  *"THE MENU is the live section tree: every section AND subsection by its REAL
  number and title, derived from the contract itself... so it always matches the
  composed document."* It has a structured lifecycle: autosave, seen-tracking (a
  request stays editable until the other party expands it), resolve/reopen.

The header comment's phrase *"comments and change requests merged into one threaded
model backed by `contract_change_requests`"* refers to consolidating what used to be
two separate structured-request concepts (comments-on-a-section and change-requests-
on-a-section) into one model **within the structured, section-mirrored surface** — it
does not claim `ContractNotes` was folded into it. `ContractNotes` was never
section-anchored; it's the general free-form chat the owner described.

**Conclusion, matching the owner's own framing exactly:** deliberate — Requests
geolocates to document structure for negotiating specific sections; Comments is a
simpler general-conversation surface. Not a leftover second surface. No change made.

---

## Out of scope, not touched

- Signature rules (D14 §3/§4 — signed-party edit / co-removal-of-signatures) — not
  built.
- The review-flow delta (trigger moved to signature-click + login check,
  Accept/Reject → seen-is-approved on `ReviewChangesModal.tsx`) — not built, per the
  task's explicit "report the delta, build none of it." Delta, as specified in D14
  and this task doc: `ReviewChangesModal.tsx` currently triggers on "since this
  party's signature came off" with explicit Accept/Reject buttons; it needs (a) its
  trigger moved to the signature-section click plus a login check for documents that
  changed since last view, and (b) its approval model changed from explicit
  Accept/Reject to seen-is-approved (viewing each change in the `review > next >
  next` sequence counts as approval, no button).
- No frontend/API code was touched by this task — `npm run typecheck` / `npm run
  lint` don't apply to this diff (SQL migration only). `node_modules` isn't installed
  in this worktree; not needed since nothing TS-side changed.
