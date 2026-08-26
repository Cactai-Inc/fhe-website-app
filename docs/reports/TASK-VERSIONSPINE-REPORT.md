# TASK-VERSIONSPINE — report

**Thread 1 of three.** Branch `task/versionspine`, cut from `origin/main` at `b615408c`.
Six migrations, all applied to production and verified. Four commits, unpushed.

---

## 1. WHAT I BUILT

**The versioned store and its lineage, on all three surfaces that have one, plus the version
history on the forms screen as the proving ground.**

| | |
|---|---|
| `parent_version` | on **all three** version tables, with a CHECK that keeps a parent strictly earlier than its child |
| append-only | a `BEFORE UPDATE OR DELETE` trigger on all three, so the list can only ever grow |
| `contract_template_versions` | new, backfilled for **all 26 templates** — none starts with an empty history |
| the save path | `save_form_definition_version` · `save_content_block_version` · `save_contract_template_version` |
| the list | `form_version_list` · `content_block_version_list` · `contract_template_version_list` |
| open one | `form_version_at` · `content_block_version_at` · `contract_template_version_at` |
| restore | `restore_form_definition_version` · `restore_content_block_version` · `restore_contract_template_version` — each a **call into save**, not a second path |
| the screen | `/app/ops/admin/forms` — a version chip, a History modal, restore, and edit-from-a-version |

**Restore mints forward.** Restoring v1 when v3 exists produces **v4 · from v1**. v2 and v3 stay in
the list and stay readable. Nothing in this build lowers a number or removes a row.

**Editing an old version is ONE act.** Every form mutator gained `p_from_version`: the change is
applied to *that* version's schema, and the version it mints records where it came from. Opening v1
and changing a field gives **v3 · from v1**, not v3 with a silent gap.

---

## 2. WHAT I DID NOT BUILD

Deliberately, per the brief:

- **No editor UI beyond the forms screen.** No entry page, no surface renderer, no page-copy store,
  no document editor. I did not extract a single string out of TSX.
- **No change to contract rendering.** `regenerate_contract_document`, `remerge_contract_from_clauses`
  and the document tables are untouched.
- **No option-list semantics** — that is Thread 2.
- **`email_templates` is still a fourth idiom** (`draft_subject`/`draft_body`, publish-a-draft, no
  history table). Out of this brief; Thread 3's handoff already names it and asks for a decision.

Built but **awaiting a caller** — say so rather than let them join `ORCHESTRATOR.md` §3b:

- `save_contract_template_version`, `contract_template_version_list`, `contract_template_version_at`,
  `restore_contract_template_version` — **no UI reaches these yet.** `template_editor_publish` calls
  the save path, so history is *written* from the shipped template editor today; nothing yet *reads*
  the list back. Thread 3 builds that surface.
- `content_block_version_list`, `content_block_version_at`, `restore_content_block_version` — same,
  and the store they read has zero rows.

---

## 3. VALIDATION — the seven items

**1. `parent_version` exists on every version table and is populated correctly by the save path.**
Three tables carry it: `content_block_versions`, `form_definition_versions`,
`contract_template_versions`. Verified on production; **0 orphan parents** across all three (every
non-null parent names a version that exists).

**2. `contract_template_versions` exists, same shape, backfilled.**
26 rows, 26 distinct templates, **0 templates without a history** — including the four retired ones,
which are kept under D16/D32 because a retired template is the definition of every document executed
under it.

**3. On a form: save mints v2 and the list shows v1 and v2 with who and when.**
Rehearsed on `INTAKE_HORSE_CLIPPING` against production inside `BEGIN … ROLLBACK`:

```
 version | parent_version | is_current | edited_by_name |          created_at
---------+----------------+------------+----------------+-------------------------------
       2 |                | t          | CJ             | 2026-08-26 11:34:13-07
       1 |                | f          |                | 2026-08-25 20:41:16-07
```

**4. Open v1, edit, save → v3, and the list reads `v3 · from v1`.** ✓ — `edit_form_field(…, p_from_version := 1)` returned `3`, and the row reads `3 | 1`.

**5. Restore v1 → `v4 · from v1`, and v3 still exists and is still readable.** ✓

```
 version | parent_version |   client_name_label
---------+----------------+-----------------------
       1 |                | Client Name
       2 |                | Client Name — v2
       3 |              1 | Client Name — from v1     <- still readable, via form_version_at(…, 3)
       4 |              1 | Client Name               <- the restore; live form is v4
```

**6. The list is append-only — and here is how I proved it.**
Three independent proofs, because "no RPC in my build does it" is a claim about today's code:

- **The database refuses it outright.** `version_rows_are_append_only()` raises on UPDATE and DELETE
  on all three tables. Rehearsed: `update form_definition_versions set title='x'` and
  `delete from form_definition_versions` both raise `restrict_violation`.
- **A number cannot go backwards.** Every save computes
  `greatest(live_version, max(history_version)) + 1`, under a `SELECT … FOR UPDATE` on the live row,
  so two concurrent saves cannot claim the same number and no path can produce one already used. The
  CHECK constraint independently refuses a parent that is not strictly earlier — rehearsed with
  `parent = version` and `parent = version + 1`, both rejected.
- **There is nowhere else to write from.** Audited on production after applying:
  the only functions that INSERT into a version table are the three `save_*_version` functions plus
  `clone_contract_template` (creation, §5 below); the only function that writes `form_definitions`
  **at all** is `save_form_definition_version`. RLS on all three histories is now **SELECT only** —
  every write goes through a SECURITY DEFINER function.

**7. `npm run typecheck`, `npm run typecheck:api`, `npm run build` clean; lint at main's baseline.** ✓
Lint reports **0 errors, 48 warnings**, and **neither changed file produces a warning** — the count
is main's. (⚠️ `CLAUDE.md` says the baseline is "~26 pre-existing warnings". That number is stale;
it is 48 on `origin/main` today.)

**`npm run test:db`: no regression.** 51 failed / 27 passed on this branch — **byte-identical to
`origin/main`** (51/27, 193 failed / 608 passed tests), which I measured by checking out `origin/main`
in the same worktree and re-running. ⚠️ **The suite is 51 files red on main and was before I started.**
It defaults to `test/db/fixtures/schema_snapshot.sql`, which does not replay migrations, so **none of
this build is covered by it.** Everything above was proven directly against production.

---

## 4. WHAT WAS ALREADY LOST, AND CANNOT BE RECOVERED

`contract_templates` has been past v1 for a while: **5 templates at v2, 4 at v3**, and
`template_version_events` holds **12 bump rows** going back to 2026-07-27. Every one of those bumps
overwrote a body with a draft and kept nothing.

**So the backfilled histories START at the template's current number.** `HORSE_LEASE_V2` has a v3 and
no v1 or v2, and it never will — those bodies are gone. The table stops the loss from here forward;
it does not undo it. `template_version_events` still records that the bumps happened, which is the
only trace that survives.

**Forms lost nothing:** `max(version)` was 1 across all 28 and all 28 history rows were a
same-second backfill with `edited_by` NULL. **No v2 had ever been minted** — the versioning built on
`task/p1ship` had literally never run, so nothing depended on its behaviour when I changed it.

---

## 5. WHAT I FOUND THAT NOBODY ASKED ABOUT

### 5.1 ⚠️ The two "already agreeing" version tables agreed on columns and DISAGREED on meaning

The handoff says `content_block_versions` and `form_definition_versions` "already agree on their
shape". They agree on their **columns**. They implemented **opposite storage rules**:

- `upsert_content_block` inserts the **new** version into the history and bumps the pointer — the
  history holds **every** version, including the live one.
- `snapshot_form_definition` copied the **outgoing** row into the history and returned `version + 1`
  for the caller to stamp on the live row — the history held every version **except** the current one.

The owner's model needs the first: *"save mints v2, the version list shows v1 and v2"*. I settled
forms onto the content-blocks rule and **retired `snapshot_form_definition`**, because leaving it
would leave a second way to write a version that stamps no parent and hands the caller a number it is
trusted to apply — D18, in its quietest form. It had no TypeScript caller.

**This matters for Threads 2 and 3:** there is now exactly one storage rule, and it is "the history
holds every version".

### 5.2 ⚠️ A version row holding only `body` would have retained NOTHING for the templates the owner edits most

Four templates are clause-composed and their `contract_templates.body` is a **23-character
placeholder**: `HORSE_LEASE_V2` / `_SIMPLE` / `_FULL` (163 clauses each) and `HORSE_SALE_V2` (76),
plus `HORSE_BILL_OF_SALE` (36). Their real wording lives in `contract_clause_defs.body`, and that is
exactly what `template_editor_publish` overwrites.

So a version also retains the **composition** — sections, clauses and fields, captured whole via
`to_jsonb(row)` so a column added later is retained without a migration. Without it,
`contract_template_versions` would have looked finished and retained a placeholder.

**Restore writes wording back** onto all three def tables, and **refuses, naming what differs**, when
the structure has changed since that version. A half-restore that silently leaves a clause behind is
worse than a refusal, and adding or removing a clause is the authoring engine's job — Thread 3 gets
to lift that restriction.

### 5.3 ⚠️ ANOTHER THREAD WROTE CONTRACT CONTENT TO PRODUCTION MID-BUILD, WITHOUT A VERSION BUMP

At **2026-08-26 11:38:47** — six minutes after my backfill, while I was rehearsing — a clause
`LEASE_FEE.NO_FEE_CONSIDERATION` appeared on all four lease keys. It came from the thread that merged
as `f1273a97` *("no-fee text is conditional")*; `origin/main` moved from `b615408c` to `f1273a97`
during this session.

**It changed the wording and did not bump the version.** The consequence is live and visible:

```
     template_key     | live_version | live_clauses | retained_clauses
----------------------+--------------+--------------+------------------
 HORSE_LEASE_FULL     |            3 |          164 |              163
 HORSE_LEASE_SIMPLE   |            3 |          164 |              163
 HORSE_LEASE_V2       |            3 |          164 |              163
```

**My structural guard caught it on its first run** — `restore_contract_template_version('HORSE_LEASE_V2', 3)`
refuses with *"clauses only on the live template: LEASE_FEE.NO_FEE_CONSIDERATION"*. That is the guard
working, not a defect in it.

**Two things follow, and both are for the orchestrator:**

1. **The lease trio's restore will refuse until their next publish**, which will mint v4 through the
   save path and capture live truth. From v4 onward restore works. I did **not** mint that version
   myself: bumping a template version opens a *"must past signers re-sign?"* decision in
   `template_version_events`, and that is not a side effect a build thread should cause unasked.
2. ⚠️ **A migration can still write `contract_clause_defs` directly and falsify a retained version.**
   The spine makes the *application* honest; it cannot stop a hand-written migration. **Any migration
   that changes template wording must now call `save_contract_template_version` afterwards**, or the
   retained "current version" quietly stops describing the live template. This is worth a line in
   `CLAUDE.md`'s migration convention.

### 5.4 The freeze rule is safe, and I measured it rather than assuming

**Bumping a template version PROTECTS signed paper rather than threatening it.**
`regenerate_contract_document` compares `documents.signed_template_version` against the template's
current version and, when they differ on an executed document, **returns the stored `merged_body`
without writing**. A newer template version therefore makes an executed document *more* frozen, not
less.

**Measured on production:** all **67** executed documents carry a non-null `signed_template_version`.
None falls through the guard — including any kiosk-executed document that missed the
`snapshot_execution_audit` trigger (D22's X4), because a NULL frozen version is `IS DISTINCT FROM`
anything and lands on the protected branch.

**Rehearsed:** publishing twice on the live lease trio and then restoring left the in-review lease
document `7adcd08f`'s `merged_body` **hash byte-identical**, before and after.

**Does my store make it POSSIBLE for a later thread to break this?** One way, and it is narrow:
`restore_contract_template_version` writes `contract_clause_defs.body`, which is what a **draft**
document re-merges from. That is correct and intended (§4 of TASK-ONEEDITOR: a draft takes the new
version). It reaches an **executed** document only through `regenerate_contract_document`, which is
guarded. **A future thread that adds a second regeneration path without that comparison would break
it** — the guard lives in one function, not in the store.

### 5.5 Smaller findings

- **`template_version_events` is a fifth version-shaped store that `TASK-ONEEDITOR` §2 does not
  list.** It is a *bump ledger* (`from_version`, `to_version`, and an unresolved re-sign decision),
  not a history — it holds no content. It is untouched and still fires, because
  `save_contract_template_version` bumps `version` on `contract_templates` exactly as publish did.
- **`clone_contract_template` created a template with a version number and no version to read.**
  Fixed: it now retains its v1. This is the one place a version row is written outside the save path,
  and it is a *creation* — routing it through save would mint v2 for a template nobody has edited.
- **`content_block_versions` was directly writable from the client.** An `ALL` policy for admins meant
  an admin session could INSERT a version row through PostgREST with no parent, no pointer update and
  a number the save path never agreed to. Closed. All three histories are now SELECT-only under RLS.
- **`/app/ops/content` is routed with no `pageRegistry` row** (`App.tsx:394`), so the content-block
  editor is a D17 orphan. Not fixed — out of brief, and Thread 3 is the thread that decides whether
  page copy lives there at all.
- **`admin_form_definitions()` did not return the version**, so no surface could have shown one. It
  does now.

---

## 6. STALE FACTS IN `TASK-ONEEDITOR` §2

Measured 2026-08-26; the doc says do not re-derive them, so here is what re-deriving found:

| §2 says | Actually |
|---|---|
| `content_blocks` + versions: *"Exactly the owner's model, built and undriven"* | ✅ **True, and it was the only one that was.** Zero rows confirmed. |
| `form_definitions` + versions: *"same shape"* | ⚠️ **Same columns, opposite storage rule** — see §5.1. `max(version) = 1` across all 28 is confirmed. |
| `contract_templates`: *"a bare `version` integer, `draft_body`/`draft_subject`"* | ⚠️ **There is no `draft_subject` on `contract_templates`** — that column is on `email_templates`. The rest is right, including "no history table". |
| *"NOT ONE OF THEM RECORDS LINEAGE… no `parent_version` anywhere"* | ✅ **True.** It is now on all three. |
| §2's table of five stores | ⚠️ **Misses `template_version_events`** — see §5.5. |

---

## 7. THE REACH, AND THE TELL

**THE REACH.** `/app/ops/admin/forms` — reachable: `pageRegistry.ts:201` (`settings.forms`, group
`settings`) and routed at `App.tsx:450` behind `requireAdmin`. **Every form card carries a version
chip and a History button**; that button is the only way in, and it is on the thing being edited,
which is the point (*"a version list that i can click to see from the page im editing the thing on"*).

**THE TELL.** Open **Forms**, expand a form, change a field label. The chip goes **v1 → v2**. Open
**History**: two rows, `v2` marked **Live** with your name and today's date, and `v1` beneath it.
Click `v1` — it opens as the form it was. Press **Edit from this version**: the card reloads onto v1's
shape with a gold banner saying the next save mints `v3 · from v1`. Change a label and it does; the
history now reads `v3 · from v1`, and `v2` is still there and still opens. Press **Restore this
version** on `v1` instead and the screen tells you it minted `v4 · from v1` and that everything above
it is still in the list.

**How it is undone:** it is not, and that is the design. There is no delete and no rollback — you
restore an earlier version, which mints a new one. The database refuses UPDATE and DELETE on the
history, so even the screen's own author cannot take a row out of it.

---

## 8. FOR THREAD 2 AND THREAD 3

**Thread 2 (`TASK-CONTRACTOPTIONS`)**
- `contract_template_versions` exists on this branch, with `composition` carrying
  `fields` — so `contract_field_defs.options` **is** retained per version, including whatever
  `"active"` flag you add inside it. The capture is whole-row; you do not need to widen it.
- ⚠️ **When you change an option list, call `save_contract_template_version(key)` afterwards.** The
  template's "new version, via Thread 1's store" is that call. If you change the defs without it, the
  live template stops matching its own current version — exactly what §5.3 documents happening.
- If you widen `contract_field_defs`, `_restore_contract_template_composition` will **raise by name**
  on the first restore rather than silently not writing your column. Widen it in the same change.

**Thread 3 (`TASK-SURFACEEDITOR`)**
- The version modal on the forms screen is the pattern, deliberately small: list → open → restore or
  edit-from. `versionLabel()`, `VersionListRow`, `VersionPreview` and `VersionsModal` live in
  `AdminFormsPage.tsx` and should move to a shared component when the three editors collapse into one.
- **Restore and supersede are already one call.** Do not add a second path.
- The structural refusal in `_restore_contract_template_composition` is the one place a restore can
  fail. **You are the thread that can lift it**, because you are the one that can add and remove
  clauses.
- `content_block_version_at` returns the body but **not** a per-version title or kind —
  `content_block_versions` never carried them. If page copy lands there, widen the table.

---

## 9. FILES

**Migrations** (all applied to production, each dry-run in `BEGIN … ROLLBACK` first):

| | |
|---|---|
| `20260826T1900_a_version_records_what_it_came_from.sql` | `parent_version` + CHECK + append-only triggers |
| `20260826T1910_the_contract_template_gets_its_history_table.sql` | the table, the composition capture, the 26-row backfill |
| `20260826T1920_one_save_path_for_a_form_version.sql` | save/list/open/restore, the five mutators rewired, `snapshot_form_definition` retired |
| `20260826T1930_one_save_path_for_a_content_block.sql` | same spine for content blocks |
| `20260826T1940_one_save_path_for_a_contract_template.sql` | same spine for templates; `template_editor_publish` now retains what it replaces |
| `20260826T1950_a_new_template_starts_with_a_history.sql` | `clone_contract_template` retains v1; the content-block history stops being client-writable |

**Code**: `src/lib/admin.ts` (version reads, `fromVersion` on the five mutators, `version` on
`AdminFormDefinition`) · `src/pages/app/ops/admin/AdminFormsPage.tsx` (the chip, the modal,
edit-from-a-version).

**Commits** — `732f117c`, `0301f555`, `fa264e7f`, `6e81303c`, plus this report. **Not pushed.**
⚠️ Branched from `b615408c`; `origin/main` has since moved to `f1273a97`.
