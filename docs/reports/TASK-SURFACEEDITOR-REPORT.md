# TASK-SURFACEEDITOR — report

**Thread 3 of three.** Branch `task/surfaceeditor`, worktree
`~/Downloads/claude-code-repo/wt-surfaceeditor`, cut from `origin/main` at `55c89b76`.
**Two migrations, both applied to production.** Six commits, **unpushed**.

**Prerequisites confirmed before starting:** `TASK-VERSIONSPINE` is on `main` (merge `baabdc11`)
and `TASK-CONTRACTOPTIONS` is on `main` (`aeda9941` + report `e10624e0`).

---

## 0. THE ANSWER TO THE QUESTION THE BRIEF ASKS TWICE

**⚠️ UI PAGE COPY DID NOT LAND, AND IT IS NOT A SCOPE DECISION — IT IS BLOCKED.** §5 of the brief
said *"if pages will not land cleanly, LAND FORMS AND DOCUMENTS AND SAY SO."* Forms and documents
landed, **and so did emails**, which were not in the brief's landing set and turned out to be the
worst-off of the four. Pages are named in §7 below with the measurement that stops them.

**What a person can now change without a developer:** every question on all **28 forms** and the
choices each question offers · the wording of all **26 document templates**, clause by clause, and
the **212 contract option lists** in the place they appear · the subject and body of all **24 emails
the system sends** · the **5 shared vocabularies**. That is the whole of D13's list except page copy.

---

## 1. WHAT I BUILT

### 1.1 One entry page, and a surface is a row that opens

**`/app/ops/admin/editor`** — four tabs, every surface listed **by its name**, alphabetical, with a
search box. Choosing one **expands it in place**; nothing navigates. That is CR-74/CR-75's pattern —
*"dont take me to an editor page if im already looking at the thing i want to change"* — and building
it as the same pattern rather than a second one was the explicit instruction.

| Tab | What opens | Where the menus are |
|---|---|---|
| **Forms** (28) | the form's sections and questions, with required toggles, rename/retype/remove/add | **on the field**, behind its "2 choices" button |
| **Documents** (26) | sections › clauses, each clause's wording in a textarea with draft/publish and the token library | **under the clause that asks the question**, one block per field |
| **Emails** (24) | subject and body, draft/publish | — |
| **Shared lists** (5) | breed · colour · markings · registration organisation · passport country | this is the flat fallback, and it is the only one |

**⚠️ THE FLAT LIST SURVIVES ONLY WHERE THE BRIEF ALLOWS IT.** §4: *"a flat list stays useful only as
the fallback for a vocabulary with no single surface to render."* Exactly five qualify — they are
used by the horse record, the horse intake form **and** the contracts at once, so there is no one
surface to open them on. The other **119 form menus and 212 contract menus** are on their form or
their clause. `contract_field_defs.clause_key` is what made the contract half possible; all 114
fields on each live lease carry one.

### 1.2 The version list, one implementation, on every kind

`src/components/ops/editor/SurfaceVersions.tsx` — Thread 1 built the chip, the modal, the list row
and the preview inside `AdminFormsPage.tsx` and its report said they *"should move to a shared
component when the three editors collapse into one"*. They did. Forms, documents and emails now read
their history through the same modal: `v8 · from v4 · who · when`, open a version, **restore** (which
mints forward) or **edit from it**.

**Restore and supersede are still one call.** I added no second path, and nothing in this build
lowers a number or removes a row.

**`editFrom` is optional on the shared source, deliberately.** A form can apply an edit to an older
version — every form mutator carries `p_from_version`. A document's wording cannot yet, so the
document's modal offers restore and **does not offer a button that would lie**. Naming that gap is
the honest version; §7.4 says what closing it would take.

### 1.3 The fourth idiom ended: email templates joined the spine

Migration `20260826T2100`. `email_template_versions` with `parent_version` + the strictly-earlier
CHECK, the append-only trigger, SELECT-only RLS, backfilled 24 rows; `save_email_template_version`
as the one write path; `email_template_publish` now **delegates** to it instead of bumping `version`
itself; plus `email_template_version_list` / `_at` / `restore_email_template_version`.

**Editing is draft → publish, and publish mints the version** — the same rhythm as document wording,
because D12's own taxonomy says *"correspondence emails are documents with a delivery channel"*.

### 1.4 THE TELL: an executed document states the version it was signed against

Migration `20260826T2110` widens `contract_document_detail`'s `document` object with
`signed_template_version` and `template_version_now` (additive, two keys). `getDocument` embeds the
template's current version. One component, `SignedVersionNote`, states it on **the contract workspace
and the read-only document viewer**:

> Signed against **v1** of this template. The template has since moved to v3 — this copy keeps the
> exact wording it was signed with and does not change with it.

### 1.5 THE REACH, and it is the only way in

| | |
|---|---|
| nav | `SETTINGS_GROUP` → **Editor** (`NotebookPen`, adminOnly). **Forms, Menus and Templates rows removed.** |
| registry | `settings.editor`. **`settings.forms` and `settings.menus` removed** (`settings.templates` never existed — see §6.2). |
| route | `ops/admin/editor`, behind `requireAdmin`. |
| retired | `/app/ops/admin/forms`, `/menus`, `/templates`, `/templates/:templateKey` — **all four still resolve** and render a short page saying where the editor went, with a link to it (D32). |

**The grep, in full.** Every reference to the four retired paths that exists anywhere in `src/`,
`test/` or `api/` after this thread: the four `<Route>` lines, the four superseded pages' own header
comments, and one comment in `FormSurface.tsx` explaining what moved. **Two stale prose references
were found and fixed** — `SessionActivityForm.tsx` and `SignStart.tsx` both told a reader that a form
is edited at `/app/ops/admin/forms`. `src/lib/grants.ts` never listed any of them.

---

## 2. VALIDATION — the owner's own test, and the five others

### ⚠️ 2.1 THE OWNER'S TEST, rehearsed against production in `BEGIN … ROLLBACK`

> *"Change a menu option on the horse intake form by opening the horse intake form. Save. The form
> shows v2. Open the version list, open v1, edit it, save — the list reads `v3 · from v1`, the form
> now renders v3, and v2 is still there and still readable."*

On `INTAKE_HORSE_CLIPPING`, through the exact RPCs the editor calls:

```
1. set_form_field_options(…, 'requested_service', […,'SUNDANCE SPECIAL'])  ->  2
   form_definitions.version                                                ->  2      ✓ shows v2
2. form_version_list                       ->  2 | (null) | live | CJ
                                              1 | (null) |      |
3. edit_form_field(…, p_from_version := 1) ->  3
   form_version_list                       ->  3 | 1 | live         ✓ reads "v3 · from v1"
                                              2 | (null)
                                              1 | (null)
   form_definitions.version                ->  3                    ✓ the form renders v3
4. form_version_at(…, 2) options -> [… , "SUNDANCE SPECIAL"]         ✓ v2 still readable
   form_version_at(…, 3) options -> ["Full Body Clip", … "Custom Clip"]
```

⚠️ **The last line is the part that proves the model rather than the plumbing.** v3 came from v1, so
it **does not contain v2's unique addition**. That is the owner's whole reason for `parent_version`:
*"the information saying it was generated from version 4 will clarify that it doesnt contain things
that are unique to version 7."*

### 2.2 The entry page lists surfaces by name — no internal keys on screen (D25) ✓
Asserted in `test/ui/surfaceeditor_entry.test.tsx`: the rendered text of the page never contains
`INTAKE_HORSE_CLIPPING`. Titles only.

### ⚠️ 2.3 Editing a document template mints a version, and an executed document is unchanged ✓
Rehearsed on production, in `BEGIN … ROLLBACK`, on `FACILITY_RULES` — the template with 16 executed
documents behind it:

```
before:  version 1
save a flat draft, template_editor_publish  ->  {"new_versions": {"FACILITY_RULES": 2}}
contract_template_version_list              ->  2 | live | CJ
                                                1 |      |
all 67 executed documents, md5(merged_body): unchanged 67 · CHANGED 0
their signed_template_version: 1     the template: 2
```

**A newer template version makes an executed document more frozen, not less** — the guard in
`regenerate_contract_document` returns the stored body when the two differ. Measured, not assumed.

### 2.4 Every retired editor's route resolves and nothing links to it ✓
Four routes, four superseded pages, zero links — the full grep is in §1.5.

### ⚠️ 2.5 The editor mints no second version for a menu edit ✓
The handoff's item 1b.5 is true and I depended on it, so I measured it. `HORSE_LEASE_V2` at v3,
three acts through the seam the editor uses:

```
contract_menu_relabel   -> template_version 4
contract_menu_add_value -> template_version 5
contract_menu_set_active-> template_version 6
contract_menu_recode    -> REFUSED: "a value's code can never change…"
contract_template_versions for this key: 1 -> 4   (three acts, three versions)
```

**Three acts, three versions.** The editor calls the RPC and re-reads; it never calls
`save_contract_template_version` itself. Rolled back — the live lease trio is untouched at v3.

### 2.6 Typecheck, api-typecheck, build clean; lint at main's baseline ✓
`npm run typecheck` clean · `npm run typecheck:api` clean · `npm run build` clean ·
**lint 0 errors, 48 warnings — exactly `origin/main`'s 48**, and no changed file produces one.
(⚠️ `CLAUDE.md` still says the baseline is "~26"; it is 48, as TASK-VERSIONSPINE also reported.)

**`npx vitest run test/ui`: 11 failed / 143 passed.** `origin/main` measured in the same worktree:
**11 failed / 138 passed.** The five new passes are this thread's; **the eleven failures are main's
and are unchanged.** One test needed a one-word update and it is named in §5.

**`npm run test:db` was not run** — it defaults to `test/db/fixtures/schema_snapshot.sql`, which does
not replay migrations, so neither migration here is covered by it. Everything above was proven
directly against production.

---

## 3. THE FOUR IDIOM DECISIONS THE BRIEF ASKED FOR, EACH ANSWERED

### 3.1 `email_templates` — **MIGRATED**, and it was the worst-off store in the app
⚠️ **IT HAS NEVER HAD A USER INTERFACE.** Six RPCs exist — `email_template_list`, `_get`,
`_save_draft`, `_publish`, `_discard_draft`, `_set_active` — and **zero TypeScript callers**:
measured on `origin/main`, nothing in `src/` so much as names the table. 24 templates, `version` up
to 4. **So the owner cannot change a single word the system emails**, which is D13's definition of
unfinished, and it is a ninth instance of the shape `docs/ORCHESTRATOR.md` §3b lists.

That made the §4 decision easy in both directions: there was no shipped editor to disturb by putting
it on the spine, and building the surface was the only way the migration would ever be reached.

### 3.2 `lesson_plans` — **EXEMPT**, and the reason is what it IS, not how big it is
The brief calls it a fifth versioning idiom. It is, but **it is not a surface** — it is a **client
record**: `client_id`, `objectives`, `coach_notes`, one `status='current'` per client enforced by a
partial unique index, superseded by `supersedes_id`. That is the shape D27 already governs
(*"evaluations and activity records are records on a rider or horse — not documents"*), not the shape
of a thing the tenant configures. Putting a client's training plan in the configuration editor would
be a category error the owner would have to undo.

Two facts that make the exemption safe rather than convenient:
- **It holds ZERO ROWS.** Nothing depends on its current behaviour.
- **Its restore already re-writes forward** (`restore_lesson_plan_version` → `_write_lesson_plan_version`),
  which is the owner's model in spirit. What it lacks is `parent_version` and the append-only guard —
  and ⚠️ **the append-only trigger could not be added to it as it stands anyway**, because superseding
  a plan UPDATEs the outgoing row's `status` to `'superseded'`. The trigger would refuse the engine's
  own write. That is a real design difference, not an oversight to sweep in.

**Recommendation, not done here:** if lesson plans ever need lineage, give them `parent_version` and
leave the status flip alone. Do not put them in this editor.

### 3.3 `content_blocks` — **ON THE SPINE ALREADY, STILL UNDRIVEN.** See §7.

### 3.4 `COST_OPTS` / `DUTY_OPTS` — ⚠️ **THE DIAGNOSIS IS RETRACTED**, and there were four not two
TASK-CONTRACTOPTIONS §7.5 called them *"a second source of vocabulary outside the option-list system
entirely"*, and this thread's handoff carried it forward as *"your editor will show fields whose
options it does not govern."*

**Measured on production: it is not true today.**

```
contract_field_defs where input_kind='responsibility' or format_type='party'  ->  0 rows
contract_fields     (the per-document instances), same test                   ->  0 rows
```

**Nothing reaches those constants.** They are the fallback for a field kind nobody creates — the code
comment beside their caller already says *"legacy responsibility (kept for any field still on
input_kind)"*, and there is none. So **the editor governs all 212 live option lists after all.**

Two corrections to the correction: there are **four** such constants, not two (`FINANCIAL_PARTY_OPTS`
and `CARE_PARTY_OPTS` are the same shape and the same zero), and they are **left in place** — if a
template author ever creates such a field they should get sensible options rather than an empty
picker, and **the fix then is to give that field real options, not to edit that file.** The
retraction is written where the constants are, so the next person reads it in place.

### 3.5 Undo is not symmetrical, and the editor says so
Item 1b.3. Retiring a contract option says, in the surface, in words:

> Retired. 2 draft document(s) had it selected — those answers were cleared and logged, and those
> contracts are no longer ready to sign. **Bringing the value back offers it again; it does not put
> the answers back.**

---

## 4. WHAT I DID NOT BUILD

- **UI page copy.** §7.
- **Adding or removing a clause from a document template.** Thread 1's report offers this thread the
  chance to lift the structural refusal in `_restore_contract_template_composition`. I did not: the
  refusal is what makes a restore honest, and lifting it means building clause add/remove in the
  authoring engine, which is a task of its own and not one to attach to a surface thread.
- **`email_template_set_active`** has a surface for reading (`off` badge) but no toggle. Turning off a
  transactional email is a different kind of act from editing its words and deserves its own
  confirmation; it stays where it was.
- **Nothing was changed about how a form or document RENDERS to a client.** The consumers read the
  live pointer exactly as before.

---

## 5. THE ONE TEST I CHANGED, AND WHY

`test/ui/pagevis_settings.test.tsx` — *"leaves the other Settings pages hideable"* listed
`settings.forms` as one of four examples. That registry row is gone, so the case now names
`settings.editor`. **The assertion is unchanged**; only the example moved with the page.

---

## 6. ⚠️ WHERE THE PRIOR THREADS' REPORTS ARE WRONG ON `main`

§5 of the handoff asks for this explicitly. Both threads were substantially right; these three are
the exceptions, all verified against `origin/main` rather than inherited.

### 6.1 ⚠️ "`/app/ops/content` is routed with no `pageRegistry` row, so it is a D17 orphan"
**TASK-VERSIONSPINE-REPORT §5.5. Not true.** On `origin/main`:

```
src/lib/pageRegistry.ts:159   { key: 'community.content', path: '/app/ops/content', … }
src/components/app/AppLayout.tsx:548   { to: '/app/ops/content', label: 'Content store', … }
```

It has a registry row **and** a nav row, under Community. The content-block store is undriven for a
different reason — nothing reads a block onto a page (§7) — and it matters that the two are told
apart, because "add a nav row" would have fixed nothing.

### 6.2 "The three editors keep their routes" — one of them never had a registry row
The handoff treats Forms, Menus and Templates symmetrically. **Templates had a nav row and no
`pageRegistry` entry**, so it was already outside page-visibility: an admin who put every Settings
page away still saw Templates. Not a defect I introduced or fixed; the Editor's single row now has
both, which closes it as a side effect.

### 6.3 The second option vocabulary
§3.4 above. Both the prior report and the handfoff's item 1b.2 assert a live gap that measures zero.

---

## 7. ⚠️ UI PAGES: THE NAMED GAP, AND THE MEASUREMENT THAT STOPS IT

**Page copy did not land. Here is exactly what is in the way, in the order it has to be dealt with.**

### 7.1 The store exists, is on the spine, and has no consumer
`content_blocks` + `content_block_versions`: **zero rows in both**, still, and Thread 1 put
`save_content_block_version` / `_list` / `_at` / `restore_` on them. The gap is not the store.
**Nothing in the application reads a content block onto a page.** `getContentBlock()` in
`src/lib/contentStore.ts` has **no caller anywhere in `src/`** — the only reader is the admin editor's
own raw fetch of its own rows. So the store has an editor and no audience.

### 7.2 ⚠️ AND THE COPY THE OWNER MOST WANTS TO EDIT CANNOT BE SERVED FROM IT AT ALL
This is the finding that decided the scope, and it was not in any brief.

`get_content_block` resolves the tenant through `current_org()`, which for an anonymous visitor reads
`current_setting('app.current_org')` — a session GUC **the browser client cannot set**. Measured on
production:

```sql
set local role anon;  select get_content_block('x') is null;   ->  t
```

**So the home page, the services pages, the FAQ — the public marketing copy — would read NULL for
every block.** Bringing pages into this editor is therefore not "extract the strings"; it is
**a change to the read path first** (an anon-safe, org-resolving read, which is a security decision
about what an unauthenticated caller may fetch), and only then extraction.

### 7.3 And extraction itself is a pass, not a step
**124 page components** under `src/pages`. Half-extracting them is the exact defect class the brief
names — the app reading its words from two places. I did not extract one string.

### 7.4 What "done" would look like, in order
1. An anon-safe read for a public block (the security decision, first).
2. `content_block_versions` widened to carry `title`/`kind` — Thread 1 named this: restoring a version
   today restores its **body** and leaves the live title, because the version row never held one.
3. A `useContentBlock(slug)` reader with **one** precedence rule, and pages converted **whole**.
4. A `Pages` tab here, listing them by name. The editor is built to take a fifth kind without change.

### 7.5 What the owner will see in the meantime
The Editor says it, at the bottom of the page, in his terms rather than mine:

> The wording on the app's own pages — the home page, the services pages, the sign-up screens — is
> not editable here yet. That text is still written into the app itself, and changing it is still a
> job for a developer.

Saying nothing would have left him to conclude the whole editor was missing half its job.

---

## 8. WHAT I FOUND THAT NOBODY ASKED ABOUT

1. ⚠️ **`email_templates` had no UI at all** (§3.1) — the single largest finding here. 24 emails the
   business sends, editable only by a developer, with six finished RPCs waiting for a caller.
2. ⚠️ **The freeze rule was invisible on the surface where a lease is read** (§1.4). The fact was
   enforced and correct; the ops documents *queue* displayed it; the contract workspace and the
   document viewer did not. The person about to edit a lease template is looking at the lease, not
   the queue.
3. **Four hardcoded option constants are dead, not rival** (§3.4).
4. **Four contract fields offer a menu and have no options** — `TXN.LEASE_TYPE`,
   `TXN.EVENTS_AUTHORIZED`, `TXN.SUBLEASE_ALLOWED`, `TXN.SHARED_LEASE_ALLOWED`. All four are on
   `HORSE_LEASE`, **the archived original** (D10), so nothing live renders an empty picker. Recorded
   because the editor will show them and someone will otherwise report it as a bug.
5. **`clause_ownership_affordance.test.tsx` fails as a whole suite unless `dist/assets` exists** — it
   reads built CSS. Deleting `dist` to keep lint clean makes it look like a new failure. It is not
   flaky and it is not anyone's regression; run `npm run build` first.
6. **Linting after a build reports 4 errors from `dist-ssr/entry-server.js`.** `dist-ssr` is
   gitignored but not eslint-ignored, so `npm run build && npm run lint` looks broken on any branch.
   One line in `eslint.config.js` would end it; out of this brief.

---

## 9. FILES

**Migrations** — both dry-run in `BEGIN … ROLLBACK` first, then applied to production and verified:

| | |
|---|---|
| `20260826T2100_the_email_template_joins_the_version_spine.sql` | the history table, the append-only guard, the 24-row backfill, one save path, publish delegating to it, list/at/restore |
| `20260826T2110_an_executed_document_states_the_version_it_was_signed_against.sql` | `contract_document_detail` + `signed_template_version`, `template_version_now` |

**New code**
`src/lib/surfaceEditor.ts` (Thread 2's five rules, the template-version reads, the email spine) ·
`src/pages/app/ops/admin/AdminEditorPage.tsx` ·
`src/components/ops/editor/{SurfaceVersions,FormSurface,DocumentSurface,EmailSurface,SharedListSurface,SupersededEditor}.tsx` ·
`src/components/ops/documents/SignedVersionNote.tsx` · `test/ui/surfaceeditor_entry.test.tsx`

**Changed**
`src/App.tsx` · `src/lib/pageRegistry.ts` · `src/components/app/AppLayout.tsx` · `src/lib/api.ts` ·
`src/lib/ops/types.ts` · `src/lib/contracts.ts` · `src/pages/app/ContractPage.tsx` ·
`src/pages/app/ops/DocumentViewerPage.tsx` · `src/components/app/ContractCascade.tsx` (the
retraction) · `src/pages/SignStart.tsx` · `src/pages/app/ops/lessons/SessionActivityForm.tsx` ·
`test/ui/pagevis_settings.test.tsx`

**Retired to a route that still resolves**
`AdminFormsPage.tsx` · `AdminMenusPage.tsx` · `AdminTemplatesPage.tsx` · `AdminTemplateEditorPage.tsx`

**Commits** — `beaf2cdf`, `ea843347`, `9d7d10b0`, `6f80711a`, `1c9c798f`, `192aa233`, plus this
report. **Not pushed.**

**Worktree** `~/Downloads/claude-code-repo/wt-surfaceeditor`, branch `task/surfaceeditor` — ready to
archive and remove. No dev server, watcher or `psql` session left running.
