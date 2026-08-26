# HANDOFF — TASK-CONTRACTOPTIONS

**You are a build thread. This file is your whole assignment.** Everything you need is here or in
the files it names. Nothing was said to you in the prompt.

⚠️ **DO NOT START UNTIL TASK-VERSIONSPINE IS MERGED TO `main`.** You build on its version store. If
`contract_template_versions` does not exist on `main`, stop and say so.

---

## 0. READ THESE FIRST, IN THIS ORDER

1. **`CLAUDE.md`** — ⚠️ **no subagent delegation**, the migration convention, and D1–D32.
2. **`docs/tasks/TASK-CONTRACTMENUS-the-option-lists-join-the-editor.md`** — **§1 the measured facts,
   §2 what protects old documents and what does not, §3 THE FIVE RULES, §5 and §6 the owner's
   rulings.** ⚠️ **§4's build shape is superseded** by TASK-ONEEDITOR; its RULES are not.
3. **`docs/tasks/TASK-ONEEDITOR-one-editor-and-a-version-lineage.md`** — §4, the live-vs-frozen rule.
4. **`docs/reports/TASK-VERSIONSPINE-REPORT.md`** — what Thread 1 actually landed, which may differ
   from what it was asked for.

## 1. WHAT YOU ARE BUILDING

**The contract option lists become editable, safely.** Not the editor UI — the **semantics** that make
editing them survivable, plus the reads an editor needs to warn before someone breaks something.

**The measured ground, verified 2026-08-26** *(re-verify; this repo moves)*:

| | |
|---|---|
| option lists in `contract_field_defs.options` | **212**, across 6 templates (171 `select`, 41 `buttons`) |
| ⚠️ conditions naming option values as bare strings | **208** |
| per-document option snapshots in `contract_fields.options` | **42** |
| `contract_field_defs` active/version column | ❌ **neither — only `closed`** |

A condition looks like `{"equals": ["LESSEE"], "field_key": "TXN.VET_ARRANGE"}`. ⚠️ **So a value's
CODE is a contract in its own right. Renaming it does not error — the clause silently stops
appearing.**

### §1 — A VALUE IS DEACTIVATED, NEVER DELETED, NEVER RE-CODED
There is no `active` column and the list is JSON, so each option entry gains **`"active": true|false`**.
- **The LABEL may be edited. The CODE may not.** Ever.
- ⚠️ **EVERY READER THAT RENDERS OPTIONS MUST THEN FILTER ON `active`.** Find them all. **A reader you
  miss shows retired values, and that sweep is part of this build, not a follow-up.**
- ⚠️ **A retired value must still RESOLVE for display**, so a historic selection renders as its label
  and not as a raw code.

### §2 — THE DEPENDENTS READ
`contract_menu_dependents(p_template_key, p_field_key, p_code)` → what breaks if this value goes:
- every `conditional_on` across the template that names the code,
- every `contract_fields` row that has it selected, split by document state.

**The editor uses this to say "3 clauses and 1 draft depend on this" BEFORE anything is pressed.**

### §3 — WHAT HAPPENS ON A CHANGE, BY DOCUMENT STATE
🔒 **Owner ruling, 2026-08-26:** *"a draft document gets the new options so a selected old option is
cleared."*

| | |
|---|---|
| **template** | new version, via Thread 1's store |
| **draft / editable / in_review document** | ⚠️ **takes the new options; a selection no longer offered is CLEARED** |
| **executed or signed document** | ⚠️ **UNTOUCHED. Options, values and version all stand.** |

⚠️ **CLEARING OBLIGES TWO THINGS BEYOND THE DELETE, AND BOTH ARE REQUIRED:**
1. **LOG IT** via `log_contract_change` (it already records before/after). **A value vanishing with no
   trace is indistinguishable from a bug, and the author will swear they answered it.**
2. **THE FIELD RE-ENTERS `contract_lock_blockers` if required** — correct, but it means **retiring an
   option can un-ready a contract that was ready to sign.** The RPC must **return which documents it
   just re-opened** so the editor can tell the person.

### §4 — ADDING
Safe by construction — nothing can depend on a value that did not exist. ⚠️ **But write it to BOTH
stores**: `contract_field_defs.options` AND the per-document `contract_fields.options` of every
**non-executed** document. **This is the Bell Boots lesson (2026-08-26): updating only the template
adds the option to future documents and leaves the live one without it.**

## 2. HOW TO WORK

- **Worktree, never the canonical checkout** (a pre-commit hook blocks it):
  `git worktree add ~/Downloads/claude-code-repo/wt-contractoptions -b task/contractoptions origin/main`
- ⚠️ **COPY `.env.db` AND `.env.test` INTO THE WORKTREE EXPLICITLY.** They are gitignored and do
  **NOT** propagate from the main checkout: `cp ../fhe-website-app/.env.db ../fhe-website-app/.env .`
  ⚠️ **`npm run build` also needs `.env`** — the prerender step instantiates a Supabase client and
  dies with `supabaseUrl is required` without it.
- **Migrations**: connection string is the **first line of `.env.db`**. **Dry-run in
  `BEGIN; … ROLLBACK;` against production, apply, verify with a query, commit.**
- ⚠️ **`CREATE OR REPLACE` with a new defaulted argument OVERLOADS.** `DROP FUNCTION` explicitly.
- ⚠️ **Never apply a migration that depends on unshipped code.**
- ⚠️ **THERE IS A LIVE LEASE IN PRODUCTION WITH A REAL CLIENT ON IT** (Pamela Godde, `HORSE_LEASE_V2`).
  **Rehearse every destructive statement inside `BEGIN; … ROLLBACK;` against that row before applying
  anything.** Do not experiment on it.
- **COMMIT AS YOU GO. DO NOT PUSH.**
- **Report to `docs/reports/TASK-CONTRACTOPTIONS-REPORT.md`** and commit it.

## 3. THE REACH

**What does a person click, from which page, to use this — and is that the only way?**

⚠️ **NOTHING, IN THIS THREAD — AND THAT IS THE POINT, SO SAY IT PLAINLY IN YOUR REPORT.** You are
building the semantics and the reads; **Thread 3 builds the surface that reaches them.** So this
thread ends with **no new route and no new button**, and its RPCs are provably callable but not yet
clicked. ⚠️ **List them explicitly in your report as awaiting a caller**, or they join the eight
entries in `docs/ORCHESTRATOR.md` §3b — correct code nothing reaches.

## 4. THE TELL

**What does the person SEE, and how is it undone?**

- Deactivating a value that has dependents: the **dependents are named before it is applied** —
  "3 clauses and 1 draft depend on this."
- A draft whose selection was cleared: ⚠️ **a `log_contract_change` row exists for it**, and the RPC
  **returns which documents it re-opened**. **A value vanishing with no trace is indistinguishable
  from a bug.**
- Undo: **reactivate the value.** ⚠️ **It never lost its code, which is precisely why undo is possible
  — that is the whole reason deactivation replaces deletion.**

## 5. TEARDOWN

Kill any dev server, watcher or `psql` session you started. Leave no background process running.
Report the worktree path and branch so the orchestrator can archive and remove it.

## 6. VALIDATION — what "done" means

1. Adding a value appears on a **new** document AND on an existing **draft**, and **not** on an
   executed one.
2. Deactivating a value: it disappears from the picker, **a historic selection still renders as its
   label**, and every condition naming it still evaluates as before.
3. `contract_menu_dependents` returns the right clauses and documents for a value that has them, and
   an empty result for one that does not.
4. A draft with a cleared selection: the field is **unanswered**, `log_contract_change` has a row for
   it, and the RPC **reported that document** as re-opened.
5. ⚠️ **Re-coding a value is REFUSED**, with the dependents named.
6. ⚠️ **Prove no reader shows a retired value.** List every reader you found and how you checked.
7. Typecheck, api-typecheck, build clean; lint at main's baseline.

## 4. IN YOUR REPORT

Say plainly what you built, what you did not, and what you found nobody asked about. ⚠️ **Re-measure
the four numbers in §1 and say whether they still hold** — they were taken on 2026-08-26.
