# TASK-ONEEDITOR — one editor for forms, documents and pages, with a version lineage

**Owner spec, 2026-08-26.** Verbatim, because the model is the requirement:

> *"we only need one editor for forms, docs, and ui pages, with all of the editable items listed with
> their name and when clicked open an editable version of that item, this means i can change copy, add
> or remove sections, add, edit, remove menu items, etc... then save and its vx+1 with the older
> version stored in a version list that i can click to see from the page im editing the thing on, when
> i open the list, shown as a modal, it opens that prior version in the editor and i can restore it, or
> create a superseding version from it by editing it and saving it. whatever the latest saved version
> contains is the version shown where that thing is used and all others are considered non functional
> fully retained copies as prior version numbers, and when an older version is used to create a newer
> version we should track which version number was edited to create the new version. this keeps the
> list going in n+1 order but maintains tracability for when i go back 3 versions and edit it and
> generate the new version we'll call it version 8, the information saying it was generated from
> version 4 will clarify that it doesnt contain things that are unique to version 7 and werent in
> version 4."*

⚠️ **This supersedes the flat-menu-inventory approach in
`TASK-CONTRACTMENUS-the-option-lists-join-the-editor.md`.** That document's FACTS (212 option lists,
208 conditions, the safety rules) still stand and are still required; its §4 build shape does not.

---

## 1. THE MODEL, RESTATED AS RULES

1. **ONE editor.** Forms, documents and UI pages are the same job: a named surface with editable
   parts. Three editors is three idioms to keep in step.
2. **THE ENTRY PAGE LISTS SURFACES BY NAME.** Click one, it opens **as it appears**, editable in
   place — copy, sections, menu items, all of it. *(Owner, same day: "it would be most effective to
   just render the entire thing that the thing im editing lives on.")*
3. **SAVE MINTS v(x+1).** Never an in-place edit.
4. **THE LATEST VERSION IS THE LIVE ONE.** Everything else is *"non functional fully retained copies"*
   — kept in full, used nowhere.
5. **THE VERSION LIST IS REACHED FROM THE THING** — a modal on the surface you are editing, not a
   separate admin area.
6. **OPENING AN OLD VERSION OPENS IT IN THE EDITOR**, from which you can **restore** it, or **edit and
   save** to mint a new one on top.
7. ⚠️ **NUMBERING IS ALWAYS n+1, AND LINEAGE IS RECORDED SEPARATELY.** Editing v4 when v7 exists
   produces **v8, stamped "from v4"** — so a reader knows it does not contain what was unique to v5–v7.
   **The number says WHEN; the parent says WHAT IT CAME FROM.** Both are needed and neither substitutes.

## 2. WHAT ALREADY EXISTS — ⚠️ RE-MEASURED 2026-08-26 AFTER THREAD 1 LANDED

⚠️ **THE ORIGINAL VERSION OF THIS SECTION WAS WRITTEN BEFORE TASK-VERSIONSPINE RAN AND IS NOW WRONG
IN FIVE PLACES.** Thread 1 changed the ground it described, and re-deriving it also caught two things
that were never true. Everything below is measured, not inherited.

| Store | Shape | State, now |
|---|---|---|
| `content_blocks` + `content_block_versions` | pointer + history, `parent_version` ✅ | ⚠️ **STILL ZERO ROWS, both tables.** It was the one honest instance of the owner's model and it is still undriven. **UI page copy has nowhere to come from yet — see §5 of the build.** |
| `form_definitions` + `form_definition_versions` | pointer + history, `parent_version` ✅ | **28 history rows, `max(version)` still 1.** ⚠️ Those 28 are a same-second BACKFILL with `edited_by` NULL — **no v2 has ever been minted by a human.** The save path is live but unexercised. |
| `contract_templates` + **`contract_template_versions`** | ⚠️ **THE HISTORY TABLE NOW EXISTS** — 26 rows, one per template | Built by Thread 1. **A version retains the CLAUSE COMPOSITION, not just `body`** — the four clause-composed templates hold a 23-character placeholder in `body`, so a body-only version would have retained nothing for the templates edited most. |
| `template_version_events` | **12 rows, back to 2026-07-27** | ⚠️ **MISSING FROM THE ORIGINAL TABLE ENTIRELY.** It records that a bump happened; it never kept the body. |
| `email_templates` | `version` + `draft_subject`/`draft_body` | Unchanged. ⚠️ **Still a separate idiom** — decide in §4 of the build. |
| `lesson_plans` | `version` + `restore_lesson_plan_version` | ⚠️ **A FIFTH IDIOM, FOUND DURING THE THREAD-1 AUDIT AND IN NOBODY'S BRIEF.** It restores by re-writing forward — correct in spirit — but has **no `parent_version` and no append-only guard.** **Fold it in or exempt it explicitly.** |
| UI page copy | — | ⚠️ **STILL NO STORE.** Page text is in TSX. |

### ⚠️ THE FIVE CORRECTIONS, NAMED

1. **"NOT ONE OF THEM RECORDS LINEAGE"** — **no longer true.** `parent_version` is now on **all
   three** version tables, with a CHECK (`parent_version < version`) so following parents always
   walks backwards. **Thread 3 consumes it; it does not add it.**
2. **"`contract_templates` has no history table"** — **no longer true.** It has one, backfilled.
3. **"`contract_templates`… `draft_body`/`draft_subject`"** — ⚠️ **`draft_subject` was NEVER on
   `contract_templates`.** That column is on `email_templates`. **This was wrong when written.**
4. **"the two already agree on their shape"** — ⚠️ **They agreed on COLUMNS and implemented OPPOSITE
   STORAGE RULES.** `upsert_content_block` wrote the NEW version to history; `snapshot_form_definition`
   wrote the OUTGOING one, so form history held every version **except** the current. **Thread 1
   settled both onto the content-blocks rule and retired `snapshot_form_definition`.** ⚠️ **Never
   assert that two stores agree because their columns match.**
5. **The table missed `template_version_events`** and, as of the Thread-1 audit, `lesson_plans`.
   **Five stores were listed; there are seven.**

### ⚠️ WHAT WAS ALREADY LOST, AND CANNOT BE RECOVERED
**9 templates are past v1** and `template_version_events` holds **12 bumps back to 2026-07-27** —
**every one overwrote a body and kept nothing.** So the backfilled histories **start at each
template's CURRENT number**: `HORSE_LEASE_V2` has a v3 and **no v1 or v2, and never will.** The table
stops the loss from here forward; **it does not undo it.** ⚠️ **Do not build a UI that implies older
versions can be recovered for contract templates. They cannot.**

### ⚠️ AND ONE LIVE INCONSISTENCY THREAD 3 WILL MEET
The four lease templates sit **one clause ahead of their retained v3** — `LEASE_FEE.NO_FEE_CONSIDERATION`,
applied 2026-08-26 by a migration that did not call `save_contract_template_version`. **The owner
declined to mint v4 for it (D33).** So **restore-to-v3 refuses on those templates until the next
publish mints v4. That is correct behaviour, not a defect to fix** — and the version UI must say so
in words rather than failing silently or looking broken.

## 3. THE BUILD

**§1 — One versioned store, one shape.** Adopt the `*_versions` pattern that `content_block_versions`
and `form_definition_versions` already share, and add to it:
- `parent_version int NULL` — the version this one was edited from. **NULL means "from the
  immediately preceding version"**, which keeps the ordinary case free of noise.
- `edited_by`, `created_at` — both already present in the two existing tables.

⚠️ **`contract_templates` NEEDS ITS HISTORY TABLE BUILT** — it is the only one of the three with a
version number and nowhere to keep the versions. Bumping it today loses the previous body.

**§2 — The surface renderer.** The entry list, and one component per surface KIND that renders it as
it appears with an edit affordance on each part. This is the large half of the build and it is where
the three editors collapse into one.

**§3 — The version modal**, reachable from the surface: list, open, restore, or supersede. Each row
shows `v8 · from v4 · edited by · when`.

**§4 — The consumers read the CURRENT version.** Everything that renders a form, a document body or a
page reads the live pointer. ⚠️ **Except a signed document, which reads the version it was signed
against** — see §4 below.

## 4. ⚠️ THE RULE THAT MUST NOT BE BROKEN BY THIS

**A live surface is derived. A signed document is frozen.** *(The same boundary settled on the horse
column, 2026-08-26.)*

- A form, a page, an unsigned template: **always the latest version.**
- ⚠️ **An EXECUTED document keeps the version it was signed against, forever.** `documents.
  signed_template_version` already exists and the drift guard in `regenerate_contract_document`
  already reads it. **This build must not turn "latest version wins" into a rule that rewrites signed
  paper.**
- **A DRAFT document takes the new version** and a selection no longer offered is cleared — owner,
  2026-08-26 — which **re-opens `contract_lock_blockers`** and **must be logged** via
  `log_contract_change`, or the author sees a blank where their answer was and calls it a bug.

## 5. ⚠️ FLAGGED BEFORE STARTING

- 🔒 **RESTORE IS ALSO A NEW VERSION — CONFIRMED BY THE OWNER, 2026-08-26** *("this is the right
  move")*. **"Restore v4" mints v9-from-v4.** It does NOT move the pointer backwards.
  ⚠️ **So RESTORE and SUPERSEDE are the same act with a different amount of editing** — restore is
  supersede with no changes made. There is no second code path, and there is no operation anywhere in
  this design that decreases the version number or removes a row from the list.
  **The list is append-only, which is what makes the lineage trustworthy:** every version's parent is
  a version that still exists and can still be read.
- **DELETION INSIDE A VERSION IS SAFE; DELETION OF A VALUE IS NOT.** Removing a section from a
  document mints a new version and the old one still has it. Removing a MENU VALUE still has to obey
  `TASK-CONTRACTMENUS` rule 1: **deactivate, never re-code**, because 208 conditions name option
  values as bare strings and a rename falsifies them silently.
- **THREE IDIOMS BECOME ONE**, so `email_templates`' draft/publish model is either migrated or
  explicitly exempted. **Leaving it as a fourth is the outcome to avoid.**
- **UI PAGE COPY HAS NO STORE.** Bringing pages into the same editor means extracting their text out
  of TSX first. That is its own pass and it is the largest single unknown here.

## THE REACH
One admin entry page listing every editable surface. No separate wording editor, forms editor or
menus editor — those become one screen with an edit mode.

## THE TELL
Change a menu option on the horse intake form by opening the horse intake form. Save. The form shows
v2. Open the version list, open v1, edit it, save — the list reads **v3 · from v1**, the form now
renders v3, and v2 is still there and still readable.
