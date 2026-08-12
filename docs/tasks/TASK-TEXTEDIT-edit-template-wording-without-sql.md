# TASK TEXTEDIT — the owner edits template wording in the UI, with draft and publish

**Owner, 2026-08-12:**

> *"lets build what we can and see how that goes, theres got to be a way to do what i want to do
> without coming here all the time. if not, i at least need to be able to edit the text."*

**This is the first slice of the Templates programme, and it is deliberately narrow: THE VISIBLE
TEXT.** Not the field structure, not the render layout, not the form builder. Prove the loop —
open, edit, draft, publish, version — on the thing that costs the owner the most today.

**Read `docs/reference/TEMPLATE-ENGINES-DELTA-2026-08-12.md` first.** It carries D12 (two
engines), D13 (no developer required), the one-archive ruling, and the hard constraint that
**the tool fits the architecture, not the reverse.**

---

# WHY THIS SLICE FIRST

**`CLAUDE.md` D13 is an acceptance criterion now: a feature is not done if changing it requires
SQL.** Measured against that, template wording is the worst offender in the codebase:

- **Sixteen `leasefix_*` migrations** have edited lease wording by hand-writing `UPDATE`
  statements against `contract_clause_defs`.
- `supabase/contract_templates/HORSE_LEASE.md` is a **pointer doc explaining which tables to
  UPDATE** — the documentation of a developer-only workflow.
- **14 flat templates** are markdown blobs in `contract_templates.body` with no authoring UI at
  all.

**Everything needed already exists except the editor.** The composition machinery, the merge
path, the token dictionary and the format registry all work and are exercised by 61 executed
documents. **The missing piece has only ever been a UI.**

---

# SCOPE — text only

## IN

1. **List the templates.** `contract_templates`, 20 active. The landing surface is a **list of
   what exists** — D13's editing-is-the-hot-path rule. Show which are clause-composed and which
   are flat.
2. **Edit the wording of a clause-composed template** — the body text of rows in
   `contract_clause_defs`. This is the lease and the two sale documents: 6 templates.
3. **Edit the body of a flat template** — `contract_templates.body`, one markdown blob. 14
   templates, including the two that are **active with an empty body**
   (`FACILITY_LICENSE`, `INDEPENDENT_CONTRACTOR`).
4. **Draft → publish → version.** See the model below.
5. **The token picker.** See below — the library exists, the picker does not.

## OUT — say so in the report, do not build

- Adding, removing or reordering **clauses, sections or fields**. Wording only.
- The **render/layout** half.
- The **Form** engine.
- **Archive and delete** controls. Draft and publish are the loop that matters first.
- **Email templates** — they are still hardcoded in `api/` and must be *extracted* before
  anything can edit them. Separate work.

---

# THE DRAFT MODEL — add a column, do not duplicate rows

**The constraint (owner): the tool fits the architecture.** So:

- **Add a draft text column alongside the live one** — on `contract_clause_defs` for the
  composed templates, and on `contract_templates` for the flat ones.
- **Editing writes the draft. It never touches the live text.**
- **Publish** copies draft → live for every changed row, **bumps `version` by 1**, and clears
  the drafts. New templates would be v1; every one of these already exists, so every publish
  here is an increment.
- **Discard** clears the drafts and changes nothing else.

**Do NOT duplicate clause rows per version.** 163 clauses × 4 lease keys is 652 rows already;
versioning by row-copy multiplies that on every edit and would fight `remerge_contract_from_clauses`.

**A template with any draft text is "has unpublished changes" — surface that in the list.** The
owner must be able to see at a glance what he left half-edited.

## What publish must NOT do

- **It must not rewrite any existing document.** **61 EXECUTED documents are evidence and are
  never rewritten.** `merged_body` on an existing document is a snapshot; publishing a template
  change affects what is generated *next*, never what is signed.
- **Prove this.** Show an executed document's `merged_body` and `signed_template_version`
  unchanged across a publish.

## ⚠️ The four lease keys move together

**D10:** `HORSE_LEASE_V2` (Standard) · `_SIMPLE` · `_FULL` (Detailed) are byte-identical **by
design** until the owner diverges them, and every content migration has written to all three in
lockstep. `HORSE_LEASE_STANDARD` is inactive and **must stop receiving updates**.

**Editing one of the three must either update all three or say loudly that it will not.**
Silently diverging them would break a settled owner decision. **State what you did.**

---

# THE TOKEN PICKER

**`template_tokens` holds 307 rows** — each with `namespace`, `field`, `token`, `kind`,
`source_table`, `source_column`, `computed`, `required`, `party_scoped`, `notes`.

**The library exists. Build the picker.**

- **Group by namespace**, insert at the cursor.
- **Show what each token resolves to** — `source_table.source_column` is right there. The owner
  should not have to guess what `{{PARTY.ADDRESS}}` produces.
- **Flag `party_scoped` tokens.** They mean nothing where no party context exists, and dropping
  one into a document without parties renders blank and looks broken.
- **`template_id` is nullable** — some tokens are global, some belong to one template. Show
  both, distinguish them.
- **Read the table, not `docs/TOKEN_DICTIONARY.md`.** That file is the behavioural contract;
  the table is the data.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-textedit`, branch `task/textedit`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **⚠️ DO NOT RESTRUCTURE ANYTHING.** No new unified templates table. No migrating clause rows.
  No reshaping `form_definitions`. `contract_section_defs` / `contract_clause_defs` /
  `contract_field_defs` / `remerge_contract_from_clauses` / `compose_field_prose` stay as they
  are. **You are adding an editor and a draft column, nothing else.**
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.** You should not need it — this edits the
  template, not the document renderer.
- **`AppLayout.tsx` is contended** (`TASK-REVIEWNAV`, `TASK-PAGEVIS`). **Report the nav entry as
  a diff; do not edit that file.**
- **THE SIGNING FREEZE IS IN FORCE.**
- **Sarah's `704c8d2d…` is a SAMPLE under review** — template changes are expected to reach it.
  Safe to exercise against. **Never test against an executed document.**
- **Delete nothing.**
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.** Dry-run in `BEGIN; … ROLLBACK;`, apply, verify with a query.
- **`test:db` is broken** (55 of 64 files failing) — **do not trust it as proof.** Verify against
  production with direct SQL and say so.
- No staff browser session exists and you will not be given one. Report the render as
  **NOT VERIFIED** with a numbered checklist.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. The owner can open a lease clause, change a word, save a draft, and **the live template is
   unchanged**.
2. Publish moves the draft to live, bumps `version` by exactly 1, and clears the draft.
3. A newly generated document picks up the new wording; **an executed document does not** —
   proven by showing `merged_body` and `signed_template_version` unchanged.
4. Editing one of the three live lease keys either updates all three or reports that it does not.
5. A flat template's body is editable, including the two that are currently empty.
6. The token picker inserts at the cursor, shows what each token resolves to, and marks the
   party-scoped ones.
7. **Nothing in the composition machinery was restructured** — `git diff` shows an editor, a
   draft column, and no changes to the merge path.

**And the one that matters most:** the owner changes lease wording end-to-end **without SQL,
without git, and without opening a thread.**

Report to `docs/reports/TASK-TEXTEDIT-REPORT.md`.
