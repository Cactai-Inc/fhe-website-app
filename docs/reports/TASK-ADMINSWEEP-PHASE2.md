# TASK-ADMINSWEEP — Phase 2: wire the two landing pages up for evaluation

**Status: delivered. One route added, one test added, nothing removed.**

Branch `task/adminsweep`, rebased onto `origin/main` at **f829eb7** (after PAGEFRAME,
TITLESWEEP, LEASESET and the Phase 1 merge). Code commit **457f5cc**. Prod DB
`lrstswfxfsezdmvkvukc`, queried 2026-08-11.

M-6 was reversed as directed: **nothing was retired, gated or deleted.** The removal
candidates X-1 … X-4 are untouched and remain unruled.

---

## What was delivered

| # | Asked for | Delivered |
|---|---|---|
| 1 | A way to see `InstructorHome` without inventing an account | `/app/ops/preview/instructor-home` — staff-gated, banner-framed, no role fake. Proven to mount by 4 tests. |
| 2 | An assessment of each page as a real landing surface | Below — including three defects that decide the answer |
| 3 | The nav entry, specified not applied | Exact diff below, ready for NAVMOTION to paste |

---

## 1. The preview route

**URL: `/app/ops/preview/instructor-home`** (type it; nothing links there).

`InstructorHome` renders only when `OpsHome` sees `isAdmin === false`. Production
`profiles.role` holds ADMIN (2), SUPER_ADMIN (1), USER (10) and **zero MANAGER or
EMPLOYEE rows**, so no account in existence renders it. The new route mounts the real
component, unmodified, behind a preview banner.

### How a reader can tell it apart from the real thing

Four ways, in descending order of how hard they are to miss:

1. **The banner.** Dashed gold border, uppercase eyebrow reading **"Preview — not a live
   page"**. Nothing else in the staff app uses that treatment — deliberately, so a reader
   landing mid-session cannot mistake it for shipped chrome.
2. **The tab title** is `PREVIEW · Instructor home`, not the page's own
   `Servicing · French Heritage`.
3. **It is not in the nav** and nothing links to it. The only way to arrive is to type
   the URL.
4. **The banner states the data limit** (below) in its own paragraph.

### What it is not

- **Not a role fake.** Nothing shadows `isAdmin`, nothing writes `profiles.role`. The
  owner ruled that out, and it would misrepresent access rather than preview a page.
- **Not a second entry point.** No nav entry, no inbound links. `TASK-LEADCLEAN` is
  consolidating staff landing surfaces onto `DashboardPanel`; a discoverable second home
  would recreate exactly the duplication it is removing. If the owner keeps the page, the
  **wrapper** is what gets deleted, not the page.

### The limit you must read the preview through

**Every query inside `InstructorHome` runs as the signed-in viewer.** An admin previewing
it sees admin-scoped rows; a real trainer's RLS scope may return a different set. So the
preview shows **layout and behaviour faithfully** and **data only approximately**. This
is on the banner, not just in this report.

### Proof it renders

No staff browser session exists in this environment, so
`test/ui/adminsweep_instructor_preview.test.tsx` stands in for clicking it — **4 tests,
all passing.** It renders the real wrapper with the page's three data seams mocked and
asserts the banner *and* `InstructorHome`'s own content (its "Your day" heading and all
four action tiles) are both present, so the test fails if the wrapper ever stops mounting
the real page. It also pins the banner's two load-bearing sentences, so a later "cleanup"
cannot quietly strip the preview framing.

**Browser render is still NOT VERIFIED** — see the checklist at the end.

---

## 2. Assessment — what each page would need to be a real landing surface

### `OpsDashboard` (`/app/ops`, admin)

**It already works, and it is smaller than its own documentation claims.**

| What renders | State |
|---|---|
| KPI tiles | **2**, not the 4 its header comment promises |
| → Intake to review | **12** — links to `/app/ops/intake` |
| → Documents awaiting signature | **13** — links to `/app/ops/documents` |
| Module tiles | 6 — Lessons and Records link; Brokerage renders "Enabled" (no hub); Boarding, Barn Ops, Employees render "Locked" |

**D-1 · The file's own docstring is stale.** It describes "Four RLS-scoped KPI tiles (open
engagements, intake to review, documents awaiting signature, open charges)". The code has
two. Engagements and charges were removed and the comment was not. The grid is still
`lg:grid-cols-4`, so the two survivors render across a four-column layout.

**D-2 · Its intake number disagrees with the Dashboard's.** `countPendingIntake` counts
`requests` in `new` **or** `contacted` → **12**. `useOpenLeads` — which feeds
`DashboardPanel` *and* `InstructorHome`, and which is deliberately aligned with the nav
badge — counts `new` only, plus unresolved support requests → **7**. Two staff landing
surfaces state the same concept as 12 and 7. Neither is wrong on its own terms; they were
never reconciled.

**What it would need to be the real landing surface:** the docstring corrected to what it
renders, the grid fixed to the tile count, and the intake definition reconciled with
`useOpenLeads`. It is otherwise honest — it has no dead links by construction (an enabled
module without a hub degrades to a non-navigating status tile), and its error branch
renders inline rather than blanking a tile.

**Note in its favour:** its "Intake to review" tile is a permanent link to
`/app/ops/intake`, which Phase 1 found is otherwise reachable only when the Dashboard
happens to have surplus lead tiles. Wiring `/app/ops` up incidentally fixes R-3.

### `InstructorHome` (currently unreachable; preview above)

**Three defects, two of which make it actively misleading.** All are in the page, not in
the preview wrapper.

**D-3 · The status chip always says "Scheduled", whatever the real status is.**
`lessonSessionFromBooking` uppercases status (`'SCHEDULED'`, `'AVAILABLE'`,
`LessonSessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'`), but
`STATUS_CHIP` in this page is keyed lowercase (`scheduled` / `completed` / `cancelled`).
The lookup therefore **never matches** and every row falls through to
`STATUS_CHIP.scheduled`. A cancelled lesson renders as "Scheduled". The chip is decorative.

**D-4 · Availability slots render as lessons.** `listLessonSessions()` selects every
`bookings` row with `kind='lesson'` and does not filter status. In prod that is **318 rows:
279 `available` (open slots nobody booked) + 39 `scheduled`**. Combined with D-3 they all
chip as "Scheduled". Concretely, today: the page's "Today" list would show **11 rows — 9
availability slots and 2 real lessons — all labelled Scheduled.** A trainer's home would
overstate their day by 5×.

**D-5 · Every row is named "Client".** `toRow` sets `who: 'Client'` as a literal, and it
has no alternative — `LESSON_BOOKING_COLS` selects `client_id` with no join, so the name is
not in the payload. Fixing this needs a join or a second lookup, not a one-line change.

**D-6 · Its "Clients" tile points at a retired route.** It links `/app/ops/contacts`,
which redirects to `/app/admin` (Phase 1 X-1). Works, but via a redirect.

**What it would need to be a real landing surface:** filter to `status='scheduled'` (or
render availability distinctly), key the chip map to the uppercase vocabulary, join the
client name, and repoint the Clients tile. D-4 is the one that matters — until it is
fixed, the page is not merely empty-looking, it is **wrong**, and wrong in the flattering
direction.

### Recommendation — stated, not implemented

**`OpsDashboard` should not replace `DashboardPanel`, and `InstructorHome` should not ship
as-is.** Evidence:

- `DashboardPanel` already carries the lead surface LEADCLEAN is consolidating onto, and
  its intake definition matches the nav badge. `OpsDashboard`'s does not (D-2).
- `OpsDashboard`'s distinct value is not its KPIs — it is the **module launcher**, which
  nothing else provides, and a permanent link to Intake. That is a *section*, not a home.
- `InstructorHome` needs D-3, D-4 and D-5 fixed before it can be judged on its merits at
  all; what the preview shows today is a page reporting 11 lessons where 2 exist.

**Not implemented, per the direction.** The call is the owner's and it is downstream of
LEADCLEAN landing.

---

## 3. The nav entry — exact diff, NOT applied

`AppLayout.tsx` is NAVMOTION's. This is the whole change; it applies cleanly to
`AppLayout.tsx` at f829eb7 (the file is unchanged in main since Phase 1).

```diff
@@ src/components/app/AppLayout.tsx:7-11 (lucide import)
   CalendarDays, Users, FileText, UserRound, ReceiptText, Shield, LogOut,
   GraduationCap, Home as HomeIcon, Boxes, Contact, LayoutDashboard,
   ChevronDown, ChevronUp, Plus, LifeBuoy, ShoppingBag, MessageSquare, BookOpen, ListChecks,
   PanelLeftClose, PanelLeftOpen, Activity, Compass, Handshake, Grid3x3, Bookmark,
-  Receipt, Eye, Library,
+  Receipt, Eye, Library, Gauge,
 } from 'lucide-react';

@@ src/components/app/AppLayout.tsx:299 (end of MANAGEMENT_GROUP)
   { to: '/app/ops/payments/review', label: 'Payment review', icon: Receipt },
+  /* ADMINSWEEP Phase 2 — EVALUATION ENTRY, not a settled destination.
+     /app/ops has been registered and unlinked since it shipped; the owner asked
+     to see it before ruling on it. Its lasting value is the module launcher,
+     which nothing else provides. REMOVE THIS LINE once he has ruled, or promote
+     it deliberately. See docs/reports/TASK-ADMINSWEEP-PHASE2.md. */
+  { to: '/app/ops', label: 'Operations', icon: Gauge },
 ];
```

`Gauge` is a new import — `Compass` is taken (App tour) and `LayoutDashboard` is Dashboard's.
It is exported by the installed `lucide-react`, checked rather than assumed.

**This diff was applied, typechecked (0 errors) and reverted** before being written down,
so it is known to apply cleanly and compile — not merely to look right. `AppLayout.tsx` is
byte-identical to `origin/main` in this branch; `git diff` against it is empty.

**⚠️ Sequencing, for whoever applies it.** This adds a second dashboard-ish entry to
**Management**, the same group where LEADCLEAN is consolidating to *"one nav entry under
management"*. Applying it before LEADCLEAN lands puts **Dashboard** and **Operations**
side by side — which is precisely the comparison the owner asked for, and precisely the
duplication LEADCLEAN is removing. Both readings are defensible, so this is flagged rather
than decided: **apply it for the evaluation window, and expect to remove it in the same
motion that resolves LEADCLEAN.**

If you would rather not touch the nav at all, `/app/ops` is reachable by URL today — the
owner can evaluate `OpsDashboard` without this diff. It is offered because it was asked
for, not because the evaluation depends on it.

---

## Constraint compliance

| Constraint | Status |
|---|---|
| Rebase onto `origin/main` first | Done — f829eb7 |
| Do not edit `AppLayout.tsx` (NAVMOTION) | Not touched — diff specified above |
| Do not edit `DataTable.tsx` (FRAMESCROLL) | Not touched |
| Do not edit documents queue table/page (DOCCOLS) | Not touched |
| Do not edit `DashboardPanel.tsx` / `ops/IntakePage.tsx` (LEADCLEAN) | Not touched |
| Delete nothing | Nothing deleted; X-1 … X-4 untouched and unruled |
| Do not build on F-1 / F-2 | No obligations surface built |
| Do not apply the biz financials migration | Not applied |
| Do not make `OpsDashboard` a competing landing page | No nav entry applied; preview is URL-only |

**Files changed:** `src/pages/app/ops/InstructorHomePreview.tsx` (new),
`src/App.tsx` (+1 import, +1 route), `test/ui/adminsweep_instructor_preview.test.tsx` (new).

`App.tsx` is not claimed by any live branch — no worktree branch (`doccols`, `framescroll`,
`leadclean`, `navmotion`) has a commit touching it, and its last change in main is
`7011e9c` (ROSTERCARD). Flagged here anyway since route registration is a shared file.

---

## Verification

| Check | Result |
|---|---|
| Typecheck | **Pass** — `tsc --noEmit -p tsconfig.app.json`, 0 errors |
| Lint | **Pass** — 0 errors. 36 warnings, all pre-existing (identical count on clean `origin/main`); neither new file nor `App.tsx` produces any |
| Preview renders | **Proven by test** — 4/4 passing |
| Browser render | **NOT VERIFIED** — no staff session available |

The pre-existing failure in `test/ui/pluspass_create_controls.test.tsx` (1 failed / 10
passed) reproduces identically on clean `origin/main` and is unrelated to this work.

### Owner checklist — sign in as an admin, then

1. **`/app/ops/preview/instructor-home`** — the trainer's home. Expect the dashed gold
   PREVIEW banner, then "Your day". **Read the "Today" list against D-4:** if it shows
   ~11 entries all chipped "Scheduled", that is the defect, not your schedule. Only 2 are
   real lessons.
2. **`/app/ops`** — the admin Operations dashboard. Expect two KPI tiles (Intake to
   review **12**, Documents awaiting signature **13**) spread across a four-column grid
   (D-1), then six module tiles: Lessons and Records clickable, Brokerage "Enabled",
   Boarding / Barn Ops / Employees "Locked".
3. **`/app/dashboard`** — the incumbent, for comparison. Note its lead list counts **7**
   where Operations says **12** (D-2). Same concept, two definitions.
4. Then rule on: does `OpsDashboard` earn a nav entry, does its module launcher belong
   somewhere else, and is `InstructorHome` worth the D-3/D-4/D-5 repairs or should it be
   retired behind a boolean?

Nothing in this phase presumes any of those answers.
