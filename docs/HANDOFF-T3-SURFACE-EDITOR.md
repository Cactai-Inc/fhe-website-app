# HANDOFF — TASK-SURFACEEDITOR

**You are a build thread. This file is your whole assignment.** Everything you need is here or in
the files it names. Nothing was said to you in the prompt.

⚠️ **DO NOT START UNTIL TASK-VERSIONSPINE AND TASK-CONTRACTOPTIONS ARE MERGED TO `main`.** You are
the surface over their store and their semantics. If either is missing, stop and say so.

---

## 0. READ THESE FIRST, IN THIS ORDER

1. **`CLAUDE.md`** — ⚠️ **no subagent delegation**, and D1–D32. **D13 is the reason this task exists:
   the owner must be able to change things without a developer.**
2. **`docs/tasks/TASK-ONEEDITOR-one-editor-and-a-version-lineage.md`** — the owner's model verbatim.
   **§1 the rules, §6-equivalent shape, §4 the live-vs-frozen rule, §5 the flags.**
3. **`docs/tasks/TASK-CONTRACTMENUS-the-option-lists-join-the-editor.md` §6** — *"the editor is the
   surface, not a list of menus"*, in the owner's words.
4. **`docs/reports/TASK-VERSIONSPINE-REPORT.md`** and **`docs/reports/TASK-CONTRACTOPTIONS-REPORT.md`**
   — what actually landed, which may differ from what was asked for.
5. **`docs/CHANGE-ORDER-LEDGER.md` CR-74 and CR-75** — the surface rule and the expanding-row pattern.
   ⚠️ **This editor is the SAME pattern arrived at from a different direction. Build it as one, not
   two, or the globalization pass inherits a third editing idiom.**

## 1. WHAT YOU ARE BUILDING

**Owner, 2026-08-26:**
> *"we only need one editor for forms, docs, and ui pages, with all of the editable items listed with
> their name and when clicked open an editable version of that item… it would be most effective to
> just render the entire thing that the thing im editing lives on, so if its a menu option on the
> horse intake form, clicking on the horse intake form from the entry page opens the horse intake form
> and then i can edit anything on the form, including the menu items."*

### §1 — THE ENTRY PAGE IS A LIST OF SURFACES, NOT OF MENUS
Documents, forms, pages — **by name**, the name the owner would use. ⚠️ **A flat inventory of menus
is the thing this replaces.** A menu means nothing away from the thing it appears on: *"Front boots /
wraps"* is only meaningful while looking at the equipment question on a lease.

### §2 — CHOOSING ONE RENDERS THAT SURFACE, AS IT APPEARS, EDITABLE IN PLACE
Copy, sections (add and remove), menu items (add, edit, deactivate). ⚠️ **Do not move someone to a
different screen to edit something they are already looking at** — CR-74, and the same reason a client
record is a row that opens rather than a page you travel to.

### §3 — THE VERSION MODAL, REACHED FROM THE SURFACE
List: **`v8 · from v4 · who · when`**. Open a version → it opens **in the editor**. From there:
**restore**, or **edit and save** to supersede.
⚠️ **RESTORE MINTS A NEW VERSION** (`v9 · from v4`). It never moves a pointer backwards, and it is the
**same call** as save with no edits — Thread 1 built it that way; do not add a second path.

### §4 — THE THREE EXISTING EDITORS COLLAPSE INTO THIS ONE
Template wording, forms, and the menus screen from `task/p1ship` become **one surface with an edit
mode**. ⚠️ **The p1ship menus editor is a STAGING POST, not the destination** — keep its write spine,
retire its flat list as the primary way in. **A flat list stays useful only as the fallback for a
vocabulary with no single surface to render.**
⚠️ **`email_templates` uses a THIRD idiom** (`draft_subject`/`draft_body`, publish-a-draft). **Migrate
it onto the version model, or exempt it explicitly and say why in your report. Leaving it as a fourth
idiom is the outcome to avoid.**

### §5 — UI PAGE COPY, AND THIS IS THE LARGEST UNKNOWN
⚠️ **There is NO STORE for page copy — it lives in TSX.** Bringing pages into this editor means
extracting their text out of code first. **`content_blocks` + `content_block_versions` already exist,
already carry `current_version`, and have ZERO rows** — that is the store, built and never driven.

⚠️ **SCOPE HONESTLY. If pages will not land cleanly, LAND FORMS AND DOCUMENTS AND SAY SO.** Do not
half-extract page copy and leave the app reading from two places — that is the exact defect class this
repo keeps producing. **A named gap is a result; a silent partial migration is a bug.**

## 2. ⚠️ THE RULE YOU MUST NOT BREAK

**A live surface is derived. A signed document is frozen.**
- Forms, pages, unsigned templates: **the latest version is what renders.**
- ⚠️ **AN EXECUTED DOCUMENT RENDERS THE VERSION IT WAS SIGNED AGAINST — FOREVER.**
  `documents.signed_template_version` exists; the drift guard in `regenerate_contract_document`
  reads it. **Nothing you build may let "latest wins" reach signed paper.**
- **A DRAFT takes the new version**, per Thread 2's semantics.

## 3. HOW TO WORK

- **Worktree, never the canonical checkout:**
  `git worktree add ~/Downloads/claude-code-repo/wt-surfaceeditor -b task/surfaceeditor origin/main`
- **Migrations**: connection string is the **first line of `.env.db`**. Dry-run in
  `BEGIN; … ROLLBACK;`, apply, verify, commit. ⚠️ **Never apply a migration that depends on unshipped
  code.**
- ⚠️ **Removing something in this codebase is a GREP, not an edit.** Three defects in one day were all
  the same shape: a thing changed in one place, and a second place that read it was missed. **When you
  retire an editor, find every route, nav row and link to it.**
- ⚠️ **A LIVE LEASE WITH A REAL CLIENT IS IN PRODUCTION.** Rehearse anything destructive in
  `BEGIN; … ROLLBACK;` first.
- **COMMIT AS YOU GO. DO NOT PUSH.**
- **Report to `docs/reports/TASK-SURFACEEDITOR-REPORT.md`** and commit it.

## 4. VALIDATION — what "done" means

**The owner's own test, from the spec:**
> Change a menu option on the horse intake form **by opening the horse intake form**. Save. The form
> shows **v2**. Open the version list, open **v1**, edit it, save — the list reads **`v3 · from v1`**,
> the form now renders **v3**, and **v2 is still there and still readable.**

Plus:
1. The entry page lists surfaces by the name the owner would use — no internal keys on screen (D25).
2. Editing a document template mints a version, and **an executed document is unchanged by it.**
3. Every retired editor's route still resolves (D32) but nothing links to it.
4. ⚠️ **Say explicitly whether UI pages landed.** If not, name what is left.
5. Typecheck, api-typecheck, build clean; lint at main's baseline.

## 5. IN YOUR REPORT

What you built, what you did not, and what you found nobody asked about. ⚠️ **If the two prior
threads' reports claim something that is not true on `main`, say so** — do not build on a claim you
have not checked.
