# TASK-REACHAUDIT — report

**Audited: main @ `60eab08` (2026-08-19), read-only. Worktree `wt-reachaudit`, branch
`task/reachaudit`. Two new files, zero code changes — see §6.**

THE REACH section is N/A per the task spec — this task is read-only and its deliverable *is* the
reach map (`docs/reference/SURFACE-INVENTORY.md`).

---

## 1. Method

Per the task's own rule — read each shared context once, then judge every row against those reads,
never re-open `App.tsx` per route:

1. Read `src/App.tsx` (480 lines), `src/lib/pageRegistry.ts` (258 lines) and
   `src/lib/reviewSection.ts` (326 lines) in full, once each.
2. Read `src/components/app/AppLayout.tsx`'s nav tables and render sites once — **not the whole
   2158-line file**; the task's own path (`src/components/AppLayout.tsx`) is stale, corrected here
   to `src/components/app/AppLayout.tsx`. Also read `src/components/layout/Header.tsx` and
   `Footer.tsx` in full for the public-marketing nav, which the task doc's method section doesn't
   name but §6 requires ("public marketing pages may be summarized").
3. One `grep -rn "to=|navigate(|href="` pass across `src/` → 197 hits → the link graph
   (`/tmp/all_link_refs.txt` during the audit, not committed).
4. One `grep -rn "\.from('"` pass, then a small Python script
   (`classify_writes.py`, scratch-only, not committed) that walks every exported function in the
   **19** general (`src/lib/*.ts`) and **17** ops (`src/lib/ops/api-*.ts`) data-access modules —
   36 files, ~7,700 lines combined, none re-opened per page — classifying each function as
   **ENGINE-RPC** (calls `.rpc(...)`), **RAW-TABLE-WRITE** (chains `.insert/.update/.delete/.upsert`
   directly off `.from('table')`), or **MIXED**. Output: 76 raw-write functions, 327 RPC-backed
   functions, each with the file:line of its call.
5. Every one of the 117 page files was then grepped (not re-opened) for calls to any function in
   those two lists, giving CRUD/write-class attribution with file:line for all 128 routes without
   re-reading each page's full body. Ambiguous or high-value rows (the calibration set, every
   contract/deal/lesson-credit mutation, anything the grep pass flagged as zero-reach) were opened
   directly to confirm.
6. D19 (states-itself-first / captures-reason / records-reference / undoable) was scored per page
   from actual evidence — `confirm(`/`window.confirm(` presence, reason/note field density, and
   paired undo-style function names (`void*`, `cancel*`, `withdraw*`, `reopen*`, `revert*`) — not
   assumed. Where no evidence was found, the flag is **N**, not blank, per the task's own rule
   ("none blank").
7. `src/lib/ops/` (17 `api-*.ts` files, 5,513 lines) is the module the task doc's method section
   calls "the `api-*.ts` module [a page] imports" — it exists at that path, not beside `src/lib/`
   flat. This was found empirically (`LessonCreditsPage.tsx` imports from `'../../../../lib/ops'`)
   after the flat `src/lib/api.ts` alone did not explain `consumeLessonCredit`. Recorded here so
   the next audit doesn't lose the same twenty minutes.

**No subagents were used (standing repo rule). No production DB access.**

---

## 2. Reconciliation — 128 / 27 / 117

Re-run live at `60eab08`, matching the task doc's own numbers from `ce47fa7` exactly — the counts
have not moved in the two commits since:

- **128** `path=` matches = every literal route string in `App.tsx`, plus the one `index` route
  (Home) that has no `path=` attribute of its own → **129 declared route entries**, of which
  **7 pairs** are two components sharing meaningfully-different `path=` strings but not real second
  surfaces (e.g. `/book/rider` + `/book/horse` + `/book/support` are three separate real pages, but
  `/register` vs `/activate` are declared-redirect + real-page pairs). After removing the 15 pure
  `<Navigate>`/`<RedirectWithQuery>` entries that mount no component (see inventory §5), **114
  distinct real components are routed**, several of them (e.g. `BookHorse`, `Checkout`, `Release`)
  reached by more than one path — which is why the 105-import count in §5 and the 114-rendered-
  route count don't collide.
- **27** registry rows cover only "every staff page with a nav row of its own" by the registry's
  own header (`pageRegistry.ts:114-128`) — deliberately excluding the 6 substrate modules, the 3
  platform rows, the 5 dead Review rows, and the entire member `/app/*` block. Not a gap; recorded
  in the registry's own comments.
- **117** page files: **105** imported directly by `App.tsx`; **10** are real sub-components of a
  routed page (confirmed by grep for their exact import site — `CalendarItemPanel`,
  `CalendarSettingsPanel`, `InstructorHome`, `BookingFieldsSettings`, `FilesRecordsPage`,
  `OpsDashboard`, `ScheduleSessionForm`, `SessionActivityForm`, `ReviewBanner`, `ReviewMounts`);
  **2** are genuinely dead (`Shop.tsx`, by design; `app/Admin.tsx`, not by design — see §5).

Full row-by-row detail: `docs/reference/SURFACE-INVENTORY.md` §5-§7.

---

## 3. Calibration — the eight §0 instances from `OWNER-WALKTHROUGH-2026-08-18.md`

Read in full before starting, per the task's own instruction. The walkthrough's headline table
names eight instances of "correct code nothing routes to, links to, or calls" — but four of the
eight live in RPC/trigger call-graphs, not in the routed-surface layer this task audits (the task's
own §6 places `api/` serverless functions and production SQL **out of scope**). Splitting them
honestly, rather than declaring 8/8 on a method that can't see half of them:

**The four surface-layer instances — rediscovered here, from the method alone, with citations:**

| # | walkthrough's instance | this audit's row |
|---|---|---|
| 5 | `/book/rider`'s qualification questions — orphaned, no link in | `/book/rider` — **ORPHAN**, zero incoming links found in the full 197-hit link graph; only self-references are its own `<Route>` and a code comment (SURFACE-INVENTORY.md §1) |
| 6 | the ops dashboard + instructor home — no nav row for `/app/ops` | `/app/ops` — **URL-ONLY**, zero incoming `to="/app/ops"` anywhere in `src/` (SURFACE-INVENTORY.md §3) |
| 7 | the Review section itself — nav group deleted, pages still live | all 5 `/app/ops/review*` routes — **URL-ONLY**, `REVIEW_NAV_ITEMS` is exported by `reviewSection.ts` but imported nowhere else in `src/` (SURFACE-INVENTORY.md §0, §7) |
| 8 | the credit engine — the credits page reaches around it | `LessonCreditsPage` → `consumeLessonCredit` — **RAW-TABLE-WRITE**, `src/lib/ops/api-lessons.ts:275-290`, `.from('lesson_credits').update(...)`, zero D19 flags (SURFACE-INVENTORY.md §3) |

**Method holds: all four are rediscoverable from route/nav/link-graph grepping alone, matching the
task's own worked examples verbatim.**

**The four RPC/trigger-wiring instances — outside this task's own scope, checked against history
instead:**

| # | walkthrough's instance | status at `60eab08` |
|---|---|---|
| 1 | the inbound lead notifier — zero call sites | fixed 2026-08-12, `INBOUNDALERT`, merged `9a8d711` |
| 2 | the gift request path — bypassed `submit_public_request` | fixed 2026-08-17, `GIFTPATH`, `a9ef588`+`dc2501a` |
| 3 | `schedule_lesson_session`'s credit debit — never called | fixed 2026-08-15, `BOOKLINK`, main `450ac04` |
| 4 | `deal_autocomplete_on_execution` — trapped in a dead branch | **not independently reverified here** — `CONTRACTWALK` (2026-08-17) only walked and documented it (commit `6324301`, unpushed); this is a trigger-branch defect, which requires reading the RPC/trigger body against production execution paths — exactly the SQL analysis this task's §6 rules out. Recommend it as an open item for the flow-map task (the owner's plan step 2), which does cover RPC/trigger wiring. |

None of the three "fixed" ones were re-verified against source in this pass (that would mean
re-opening every page per historical task, which the method rule forbids) — they're reported as
"fixed" on the strength of their own merge commits, cited so the claim is checkable, not asserted
from memory.

---

## 4. Findings, ranked by severity

**F1 — `CareHome.tsx:70` links to `/horse-care`, which is not a route.** The real route is
`/horse`. Every client on the horse-care dashboard who clicks the page's own primary CTA
(`<Link to="/horse-care" className="btn-primary" ...>`) hits the branded 404. This is a **new**
defect, not one of the calibration set — found by grepping the full link graph against the route
table and catching a link string with no matching `path=`. Highest severity here: it is a **primary
button on a client-facing page**, not a secondary or edge-case link.

**F2 — `/app/gifts` is an orphan.** Zero incoming links anywhere in `src/`. Its own content
component, `GiftsContent`, is rendered a second time — and is the only way a member actually reaches
it — inline inside `/app/account`'s "My Gifts" row (`AccountHub.tsx:203-204`). A ninth instance of
the walkthrough's own defect class, found by the same method that found the calibration four.
Lower severity than F1 (nothing 404s; the content is reachable, just not at its own route).

**F3 — the D19 gap is systemic, not confined to the credits page.** Of the ~50 pages this audit
found performing a real mutation, the overwhelming majority score **N on all four D19 flags**:
no confirmation dialog, no reason/note capture, no reference recorded, no undo path. Concretely: all
raw-table-write mutations in Boarding (`FacilitiesPage`), Barn Ops (`ResourcesPage`,
`ConsumptionLogPage`), Employees (`StaffPage`, `SchedulePage`), and most of Admin/Settings
(`AdminBrandingPage`, `AdminProductsPage`) carry zero of the four. The two genuine exceptions in the
whole app are `ContractPage` (34 distinct withdraw/reopen/decline functions, 59 reason/note hits, 5
confirm sites — this is what "the surface actually does D19" looks like) and `DealPage`
(`voidDeal` is a real, named undo). This was the calibration set's own point about instance #8, but
the credits page turns out to be the median case, not an outlier.

**F4 — `src/pages/app/Admin.tsx` is fully dead code.** Zero imports anywhere in `src/`. Its
functionality was absorbed into `RecordsPage.tsx`/`ContactsPage.tsx` by TASK-RECORDS
(2026-08-12). Listed per the task's rule (never propose deletion), but this is the one file in the
"no route" set that isn't dead *by design* — `Shop.tsx` has an explicit keep-it comment
(App.tsx:21-22); `Admin.tsx` has no such comment and nothing calls it.

**F5 — `/app/ops/review/contact-dossier` mounts a live-production-write editor behind a route with
no nav protection beyond `requireAdmin`.** Already flagged in the file's own source
(`reviewSection.ts:181`, "Mounted on a REAL production contact and its saves are REAL") — surfaced
again here because it's reachable by URL by any admin, not only from `ReviewIndexPage`'s own card,
and the reach map makes that concrete rather than a comment aside.

**F6 — nav-table drift confirmed harmless.** `pageRegistry.ts`'s own header says the App-pages block
(Calendar/Catalog/Messages, hand-written JSX) has no registry row "recorded as a follow-up... rather
than half-done." Confirmed still true and still deliberate — not a new finding, just verified rather
than re-announced.

---

## 5. Flagged, not fixed

- **`BoardChargesPage.tsx`** reads only; `emitBoardCharge` (the function its own hub name implies it
  should call) lives in `api-boarding.ts` but this audit's per-page grep found no call site for it
  on this page. Could mean the charge-emission path runs elsewhere (a cron/serverless trigger, out
  of this task's scope) or could mean the page is read-only by omission. Not verified either way —
  flagged for whoever owns Boarding next.
- **`AllocationRulesPage.tsx`**'s `deleteCostAllocationRule` has no confirmation dialog and no
  restore path found — the one raw delete in the app with zero D19 coverage on all four flags
  simultaneously, worth a look before F3's broader fix.
- **`TenantDetailPage.tsx`**'s `platform_set_tenant_module`/`platform_set_tenant_status` calls carry
  no `confirm()` despite tenant-wide blast radius (enabling/disabling a module or suspending a whole
  tenant) — flagged, not fixed; this is a superadmin-only surface so the severity call is the
  owner's, not this audit's.
- **The retirement-flag routes** (`ops/contacts`, `ops/horses`, `ops/horse-records`, `ops/documents`,
  `ops/deals`, `ops/lessons`, `ops/records`) each still mount a fully-functional component with real
  CRUD behind a boolean that is `true` today. Not a defect — this is the documented mechanism for
  flipping a retirement back on — but every one of those components' CRUD is real and live the
  moment the flag flips, so they're inventoried at full depth rather than skipped as "retired."

---

## 6. Diff and teardown

```
$ git diff --stat
 docs/reference/SURFACE-INVENTORY.md    | (new file)
 docs/reports/TASK-REACHAUDIT-REPORT.md | (new file)
 2 files changed, 0 deletions(-)
```

Two added docs files, zero code changes — confirmed before commit.

**TEARDOWN — process census, no dev server or test runner started this session:**
```
$ ps aux | grep -E "vite|vitest|node" | grep -v grep
```
returned only pre-existing VS Code / TypeScript-server helper processes (PIDs 883-9068, all
`Code Helper` / `tsserver.js` / `typingsInstaller.js`), none of them `vite`, `vitest`, or a project
dev server. Nothing was started by this audit; nothing needs to be stopped.
