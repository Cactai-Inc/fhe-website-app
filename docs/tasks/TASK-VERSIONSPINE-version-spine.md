# HANDOFF — TASK-VERSIONSPINE

**You are a build thread. This file is your whole assignment.** Everything you need is here or in
the files it names. Nothing was said to you in the prompt.

---

## 0. READ THESE FIRST, IN THIS ORDER

1. **`CLAUDE.md`** — how this repo works. ⚠️ Note especially: **no subagent delegation** (do the work
   yourself, in this thread), the **migration convention**, and the **settled owner decisions D1–D32**.
2. **`docs/tasks/TASK-ONEEDITOR-one-editor-and-a-version-lineage.md`** — the owner's model, verbatim,
   and the fact-find behind it. **§1 is the rules, §2 is what already exists, §4 is the rule you must
   not break.**
3. **`docs/method/METHOD-change-orders.md`** — how the owner works, and what he wants in a report.

## 1. WHAT YOU ARE BUILDING

**The versioned store and its lineage — and NOTHING that renders a surface.** You are Thread 1 of
three. Threads 2 and 3 build on what you land, so your job is to make the model correct and prove it
on the smallest surface in the system.

⚠️ **YOU ARE NOT BUILDING THE EDITOR UI.** Not the entry page, not the surface renderer, not
documents, not pages. If you find yourself extracting copy out of TSX, you have left your brief.

### §1 — ONE VERSION SHAPE, AND `parent_version`
Two version-history tables already exist and already agree on their shape:
`content_block_versions` and `form_definition_versions`. **Adopt that shape; do not invent a third.**

Add to it, everywhere it is used:
- **`parent_version int NULL`** — the version this one was edited FROM. **NULL means "the immediately
  preceding version"**, so the ordinary case stays clean.

⚠️ **THIS COLUMN GOES IN BEFORE ANY EDITOR MINTS ANYTHING.** It is the only part of the owner's model
that cannot be reconstructed after the fact: once a v8 is saved without recording that it came from
v4, that fact is gone permanently.

### §2 — `contract_templates` GETS THE HISTORY TABLE IT NEVER HAD
It carries a `version` integer and **no history table at all**, so bumping the version today
**discards the previous body**. Build `contract_template_versions` on the same shape. **Backfill the
current state as the current version number** so no template starts with an empty history.

### §3 — THE RPCs, AND THEY ARE THE ONLY WAY TO WRITE A VERSION
- `save_<thing>_version(...)` — mints v(max+1), stamping `parent_version` when the caller was editing
  something other than the latest.
- `<thing>_versions(...)` — the list: version, parent, who, when.
- `restore_<thing>_version(key, version)` — ⚠️ **MINTS A NEW VERSION FROM THAT ONE. It does not move
  a pointer backwards.** Owner, 2026-08-26, confirmed: *"this is the right move."* Restore and
  supersede are **the same act with a different amount of editing** — implement restore as a call
  into the save path with no changes, **not as a second code path.**

⚠️ **NOTHING IN THIS DESIGN EVER DECREASES A VERSION NUMBER OR DELETES A ROW FROM THE LIST.** The
list is append-only. That is what makes the lineage trustworthy: every version's parent still exists
and can still be read. **If you write code that can violate that, you have built the wrong thing.**

### §4 — DRIVE IT WITH FORMS, AND ONLY FORMS
`form_definitions` + `form_definition_versions` already exist, and ⚠️ **`max(version)` is 1 across all
28 forms — no v2 has ever been minted, so the versioning built there has never actually run.** Wire
the existing forms admin screen (`src/pages/app/ops/admin/AdminFormsPage.tsx`) to the RPCs above:
save mints a version, a modal lists them, opening one shows it, restore mints a new one.

**Forms are the lowest-risk surface in the system. That is why they are the proving ground.**

## 2. ⚠️ THE RULE YOU MUST NOT BREAK

**A live surface is derived. A signed document is frozen.**

- A form, a page, an unsigned template: **the latest version wins.**
- ⚠️ **AN EXECUTED DOCUMENT KEEPS THE VERSION IT WAS SIGNED AGAINST, FOREVER.**
  `documents.signed_template_version` exists and the drift guard inside
  `regenerate_contract_document` already reads it. **Do not let "latest wins" become a rule that can
  reach signed paper.** You are not changing contract rendering in this thread — but if your store
  makes it *possible* for a later thread to, say so in your report.

## 3. HOW TO WORK

- **Work in a worktree**, never the canonical checkout — a pre-commit hook blocks code commits there:
  `git worktree add ~/Downloads/claude-code-repo/wt-versionspine -b task/versionspine origin/main`
- ⚠️ **COPY `.env.db` AND `.env.test` INTO THE WORKTREE EXPLICITLY.** They are gitignored and do
  **NOT** propagate from the main checkout: `cp ../fhe-website-app/.env.db ../fhe-website-app/.env .`
  ⚠️ **`npm run build` also needs `.env`** — the prerender step instantiates a Supabase client and
  dies with `supabaseUrl is required` without it.
- **Migrations**: timestamped files in `supabase/migrations/`. The connection string is the **first
  line of `.env.db`** (gitignored, in the canonical checkout). Discipline: **dry-run inside
  `BEGIN; … ROLLBACK;` against production, apply, verify with a query, commit.**
- ⚠️ **Never apply a migration that depends on unshipped code.** Production builds from `main`, and
  this repo has already had a 4-hour outage from exactly that.
- ⚠️ **`CREATE OR REPLACE` with a NEW DEFAULTED ARGUMENT OVERLOADS — it does not replace.** This repo
  has been bitten three times. `DROP FUNCTION` the old signature explicitly.
- **Verify before asserting.** Read the live database; claim only what you have measured. If a doc
  and the database disagree, **the database is right and the doc is stale** — say so in your report.
- **COMMIT AS YOU GO. DO NOT PUSH.** The orchestrator merges.
- **Report to `docs/reports/TASK-VERSIONSPINE-REPORT.md`** and commit it.

## 4. THE REACH

**What does a person click, from which page, to use this — and is that the only way?**

`/app/ops/admin/forms` (`AdminFormsPage.tsx`), the screen that already exists. **Save** mints a
version; a **Versions** control on that same screen opens the list; opening a row shows it; **Restore**
mints a new one. ⚠️ **No new route and no new nav row** — this thread adds behaviour to a surface the
owner can already reach. **If a person cannot get to it from the admin nav in the browser, it is not
done**, however green the RPC is.

## 5. THE TELL

**What does the person SEE that confirms what happened, and how is it undone?**

After a save, the screen states the version it is now on. The list reads **`v8 · from v4 · who ·
when`** — ⚠️ **the parent is shown, not just stored; a lineage nobody can see is not traceability.**
Undo is **Restore**, which mints forward and never removes anything.

## 6. TEARDOWN

Kill any dev server, watcher or `psql` session you started. Leave no background process running.
Report the worktree path and branch so the orchestrator can archive and remove it.

## 7. VALIDATION — what "done" means

1. `parent_version` exists on **every** version table, and is populated correctly by the save path.
2. `contract_template_versions` exists, has the same shape, and is **backfilled** — no template has
   an empty history.
3. On a form: **save mints v2**, the version list shows v1 and v2 with who and when.
4. **Open v1, edit, save → v3, and the list reads `v3 · from v1`.**
5. **Restore v1 → v4 · from v1**, and **v3 still exists and is still readable.**
6. ⚠️ **Prove the list is append-only**: no RPC in your build can lower a version number or remove a
   row. Say how you proved it.
7. `npm run typecheck`, `npm run typecheck:api`, `npm run build` clean; lint at main's baseline.

## 5. IN YOUR REPORT

Say plainly **what you built, what you did not, and what you found that nobody asked about.** If any
fact in `TASK-ONEEDITOR` §2 turns out to be stale, **name it** — those numbers were measured on
2026-08-26 and this repo moves fast.
