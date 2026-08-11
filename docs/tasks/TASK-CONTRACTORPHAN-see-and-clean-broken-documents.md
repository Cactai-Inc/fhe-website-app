# TASK CONTRACTORPHAN — delete two broken documents, then make the breakage visible and self-serviceable

**Owner ruling, 2026-08-10, verbatim:**

> *"delete entirely and provide ui elements for me to be able to see this and the
> functionality to be able to cleanup the mess next time"*

Three parts, in order. **Part 1 is a data fix. Parts 2 and 3 are the actual deliverable** —
the owner does not want to be told about the next one of these by a thread.

---

# PART 1 — OWNER RULING 2026-08-10: **HELD. DO NOT APPLY.**

The migration is written, dry-run-proven and **deliberately unapplied**. Parts 2 and 3 shipped,
so the two documents are now visible in the integrity panel with working cleanup controls, and
**the owner will delete them from the UI himself.**

That is not a deferral — it exercises the cleanup tool on the exact case it was built for,
which is a better proof than any dry run. **No thread should apply
`20260811T1000_contractorphan_delete_orphaned_documents.sql`.** It stays in the journal as the
record of what was proven.

If the panel turns out not to be able to clean them, that is a defect in Part 3 and it comes
back as a new task — not as a reason to run the migration.

---

# PART 1 — DELETE THE TWO ORPHANED BEAUMONT DOCUMENTS

## What is wrong

Both documents carry `contract_id = ae4ffe95-4662-4813-a16c-e7b5b5f325a4`, **which does not
exist in `contracts`** — while `documents_contract_id_fkey` reports `convalidated = true`.

```
0360f829-4c31-4dc0-9b95-3489ee9a71cb   AWAITING_SIGNATURE / ready_to_sign   horse: Beau
fb6abc6c-ef34-4d80-b731-543eaa40ac71   AWAITING_SIGNATURE / ready_to_sign   horse: Beau
```

Verified by the orchestrator against production 2026-08-10: **exactly these two rows**, no
others, and **neither carries a signature.**

**This is armed.** Signing either one ERRORS. The signing flow updates the row more than once
in one transaction; Postgres skips the FK re-check only for row versions created by *other*
transactions, so the second same-transaction update re-runs the check against the orphan and
aborts the whole thing.

## What to do

**Delete both, entirely.** Not NULL the `contract_id`, not regenerate — the owner chose
deletion explicitly over both alternatives.

Use the repo's existing soft-delete convention (`documents.deleted_at`) unless you find that a
hard delete is required to clear the FK situation — **if you conclude a hard delete is needed,
stop and report before doing it.**

**Before deleting, confirm all four in one query and paste the raw output:**

1. `status = 'AWAITING_SIGNATURE'` on both
2. **zero** rows in `signatures` for either (any `deleted_at IS NULL`)
3. neither is `EXECUTED`, `VOID` or `TERMINATED`
4. the referenced contract is still absent

**If any of those four fails, STOP.** The state changed since this spec was written and the
ruling was made against the state described here.

## Then answer the question the deletion buries

**How did a `contracts` row disappear while its foreign key still reported valid?**

Do not turn this into an investigation project, but do spend the twenty minutes: check whether
the FK was added `NOT VALID`, whether anything hard-deletes from `contracts`, and whether other
tables referencing `contracts` hold orphans too. **Report what you find even if it is "no
answer".** A constraint that did not hold is a bigger problem than two documents, and deleting
the evidence is precisely what makes it unfindable later.

---

# PART 2 — A DOCUMENT INTEGRITY PANEL THE OWNER CAN READ

## Where it goes

**`src/pages/app/ops/OversightPage.tsx`.** It already is the staff oversight surface, already
renders a card grid off a single RPC, and already has a "Recent activity" section to sit
beside. **Do not create a new page or a new nav entry.**

## What it must show — these are REAL COUNTS, measured in production 2026-08-10

| check | live count | actionable? |
|---|---|---|
| documents whose `contract_id` has no `contracts` row | **2** | **yes** — Part 1 clears these |
| documents whose `horse_id` has no live `horses` row | 0 | yes |
| documents whose `contact_id` has no live `contacts` row | **6** | **NO — see the warning below** |
| documents `ready_to_sign` with **no** `document_parties` | 0 | yes |
| documents holding **fewer fields than their template defines** | **2 known** | yes |

The field-count check comes from a NOGUARD2 finding: `ecaecd42…` sits **22 fields** below its
template defs and `9a56b738…` sits **3 below**. Neither is in any recently-touched set. A
document quietly missing fields renders an incomplete contract, so it belongs on this panel.

Zero-count checks still render, showing `0`. **A check that disappears when it passes is a
check the owner cannot trust** — he needs to see that it ran.

## ⚠️ THE SIX CONTACT-ORPHANS ARE NOT A BUG AND MUST NOT BE OFFERED FOR CLEANUP

Verified in production: **5 are `EXECUTED` and carry signatures. 1 is `VOID`.**

These are D1's **known stranded executed documents** — they ride on the owner's test
identities (`cjzigs@` / `charlesjzigmund@`) and leave with the **owner-run post-Stage-5 purge,
via the 5g routine, never ad hoc.** CLAUDE.md is explicit: *"no re-anchoring."*

**They must render in a clearly separate group labelled as known and expected, with no action
control of any kind.** If this panel ever offers the owner a button that deletes five signed
executed documents, the panel is worse than not having built it.

---

# PART 3 — THE CLEANUP CONTROLS

The owner's words are *"the functionality to be able to cleanup the mess next time"*. That
means he acts, from the UI, without a thread.

## Reuse the existing safety model. Do not invent one.

`can_void_document(uuid)` already encodes exactly the right refusal shape, and you should read
it before writing anything:

- returns false if `auth.uid()` is NULL
- returns false for `executed`, `void`, `terminated`, or any `voided_at` / `terminated_at`
- requires `has_staff_access() AND org_id = current_org()`, or party status

**Write `can_cleanup_document(uuid)` in that image**, and make it *stricter*: it must also
return false if the document carries **any** live signature, regardless of status.

## The hard rules

- **A document with a signature is never deletable from this UI. Ever.** 61 executed documents
  are evidence. There is no override, no confirm-twice, no staff bypass.
- **Staff only.** Not party. Cleanup is an ops action, not a party action.
- **Every cleanup writes a `status_events` row** naming what was removed and why. A cleanup
  tool with no trail is how the next mystery gets made — and note that `status_events` already
  proved its worth here: supersession has **never** fired in production, and that was only
  knowable because the events table was empty.
- **Confirm destructively.** Name the document and its horse in the confirmation, not "this
  item".
- **Never bulk-delete.** One document at a time, each individually confirmed. A "clean all"
  button on a list that includes signed documents is one mis-click from destroying evidence.

## Grants

`CREATE FUNCTION` grants EXECUTE to PUBLIC by default. **Explicitly
`REVOKE … FROM PUBLIC, anon`** on every new function, then print `has_function_privilege()`
for `anon`, `authenticated` and PUBLIC and put the raw output in your report. Three separate
times in this repo a `REVOKE` reported success and changed nothing. **Never trust the
command's own output** — re-read the privilege.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-contractorphan`, branch `task/contractorphan`, off
  `origin/main`. **NEVER any clone under `~/Desktop`** — an iCloud sync destroyed a repo there.
- **Do not push.** The orchestrator merges and pushes; a push to `main` auto-deploys.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.** Minimal diff plus orchestrator approval.
- **THE SIGNING FREEZE IS IN FORCE.** Nothing here lifts it. It also means you cannot observe
  a signing flow succeed — reason about it explicitly and say so rather than claiming it.
- **A migration must not contain its own `COMMIT;`.** It ends your dry-run wrapper and applies
  for real while you believe you are testing. This has already happened twice here.
- **Dry-run in `BEGIN … ROLLBACK` with raw output, then STOP for review before applying.**
  Part 1 destroys data; it does not get applied on a thread's own judgement.
- **You have no staff browser session, and you will not be given one** (owner ruling
  2026-08-10). Prove what you can prove — the RPC's output, the built CSS, the DB state — and
  report the render as **NOT VERIFIED**. Do not build a harness and describe its output as a
  render.

# REPORT

`docs/reports/TASK-CONTRACTORPHAN-REPORT.md`. Raw before/after for the two deletions, the
integrity counts your panel produces cross-checked against direct SQL, the grant output, and
an explicit split of what you verified yourself versus what you assumed.
