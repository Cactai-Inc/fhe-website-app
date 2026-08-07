# TASK PLUSPASS — contextual "+" create controls on every add-capable page — REPORT

Branch `task/pluspass`, built in its own git worktree off `origin/main` (98f541d).
Typecheck clean (0 errors), lint clean (0 errors; 30 warnings, up from a true
29-warning baseline by exactly the 1 expected `react-refresh/only-export-components`
warning on the new context file — see "How I verified"), production `vite build`
succeeds.

---

## What shipped

| File | Change |
|---|---|
| `src/components/app/PageCreateButton.tsx` | new — the one shared "+" control (icon + label), quiet styling, not cardstock/leather |
| `src/contexts/CreateModalContext.tsx` | new — lets a page's own "+" open the ONE existing `CreateModal` at a specific step |
| `src/components/app/CreateModal.tsx` | `initialStep` prop added (default `'destination'`, unchanged); `Step` type exported as `CreateModalStep` |
| `src/components/app/AppLayout.tsx` | wraps `<Outlet/>` in the new context provider; passes `initialStep` through to the one `CreateModal` instance. **Header markup, `CardstockHeader.tsx`, `header-cardstock.css`, and the `showCreateTab={isStaff}` line are untouched** |
| `src/pages/app/Home.tsx` | `+ Post` next to the title, gated on `surfaces.has_feed`, opens `CreateModal` at `post_type` |
| `src/pages/app/MyPosts.tsx` | same `+ Post`, same gate |
| `src/pages/app/CalendarPage.tsx` | `+ Booking` next to the title; staff → the existing full booking editor (`CalendarItemPanel`, same as an empty grid-cell click); member → the existing "request this open time" panel |
| `src/pages/app/AccountHub.tsx` | `+ Horse` next to the "Horses" sub-heading inside My Stable, replacing the old plain-text "+ Add a horse" link with the shared component (same modal, same flow) |
| `src/pages/app/Messages.tsx` | swapped the page's existing ad hoc "New message" button for the shared component (same handler) |
| `test/ui/pluspass_create_controls.test.tsx` | new — 16 tests, see below |

**Catalog got no button** — see "CatalogPage" below.

---

## How I verified

**I could not sign into the running app.** I looked for real Supabase
credentials on this machine: the committed `.env` in the main checkout has
`VITE_SUPABASE_URL=https://placeholder.supabase.co` and a placeholder anon
key — the real anon key is only injected at Vercel deploy time, not present
in any file I could find locally. `.env.db` has a real Postgres connection
string, but that's for `psql`/migrations, not a browser session. So there was
no way to drive a real authenticated browser click-through in this
environment, as either a member or an admin. I'm stating this plainly rather
than fudging it.

What I did instead, in order of strength:

1. **`npm run typecheck` / `npm run lint` / `npm run build:client`** — all
   clean. Build succeeding proves every new import resolves and the bundle
   compiles for real, beyond what `tsc --noEmit` alone checks.
2. **A true before/after lint-warning diff.** `git stash -u` (stashing the
   new untracked files too — my first attempt without `-u` gave a false
   "no new warnings" reading) showed the real baseline is **29** warnings,
   not the ~26 CLAUDE.md states (that doc is a bit stale). After my changes:
   **30** — exactly +1, the expected `react-refresh/only-export-components`
   warning on `CreateModalContext.tsx`, the same warning every other
   standalone context file in this repo already carries (`AuthContext.tsx`,
   `BrandProvider.tsx`, `CartContext.tsx`). Not a regression.
3. **16 executed component tests** (`npx vitest run test/ui`, all passing),
   following the one existing UI-test convention in this repo
   (`test/ui/clause_ownership_affordance.test.tsx`: `@vitest-environment
   jsdom` + `@testing-library/react`, no live network). Each mocks only the
   surface's *unrelated* data dependencies (`CommunityFeed`, `feedMyPosts`,
   `useViewSurfaces`, `api-calendar`) and renders the **real** page
   component, the **real** `PageCreateButton`, and — for Home/MyPosts — the
   **real** `CreateModal` through the **real** context, then clicks the
   button and asserts on what actually appears:
   - `PageCreateButton` renders its label and fires `onClick`; renders as a
     real `<Link>` with the right `href` when given `to`.
   - `CreateModal` still opens on the **destination** menu by default
     (proves the header's existing behavior is unchanged) — proves
     `initialStep="post_type"` correctly **skips straight to** post-type
     selection instead.
   - **Home**: `+ Post` present when `has_feed` is true, clicking it calls
     `openCreate('post_type')` on the trigger from context. A second test
     proves the button **does not render at all** when no
     `CreateModalTriggerContext` is in the tree — i.e. it can never be a
     dead click.
   - **MyPosts**: same `+ Post` behavior.
   - **Calendar**: `+ Booking` as a **client** opens the real "Request this
     time" panel; as **staff** (mocked `fetchCalendar` role) it opens the
     real `CalendarItemPanel` ("New calendar item") — proving both branches
     of `onCreateBooking`, not just one.
   - **My Stable**: `+ Horse` next to "Horses" opens the real
     `HorseIntakeForm` modal ("Add a horse").
   - **Messages**: `+ Message` opens the real member picker ("Search
     members…").

This is genuine, executed proof that the wiring works — not just that the
code reads correctly. It is **not** equivalent to a live browser session: it
doesn't prove Supabase RLS lets the right people through, doesn't prove
visual layout/CSS at real breakpoints, and doesn't exercise the real
`AppLayout` shell (nav, wall gating, etc.) around these pages. Say so plainly
where relevant below.

---

## Per surface

### Community feed — `Home.tsx` + `MyPosts.tsx`
**Verified** (tests): `+ Post` renders next to the title, gated on
`surfaces.has_feed` (the same signal `Home.tsx` already used to decide
whether to render the feed at all, and the same field the nav's own
`useViewSurfaces` hook exposes) — a deal/care-only member without feed
access won't get a dead post button. Opens `CreateModal` at the `post_type`
step directly, skipping the generic "Create" destination menu (which for a
member also lists Book a lesson / Shop for sale / New message — irrelevant
noise on a page-specific button).
**Assumed, not verified**: real RLS/`feedPostCreate` behavior once a form is
actually submitted — untouched by this task, already covered by the modal's
existing code path.

### Calendar — `CalendarPage.tsx`
There's no "blank-slate create a booking" flow independent of the calendar
grid today — a member either clicks a green "available" slot (books it
directly) or clicks an empty cell (`RequestTimePanel`, "request this open
time" — a suggestion staff confirm), and staff click any cell to open the
full editor. Neither has a start time without a grid click, and `+ Booking`
has no cell to anchor on. I wrote `nextBookableSlot(openHour, closeHour)`
(next on-the-hour slot inside business hours, rolling to tomorrow's open if
past close) and reused it for **both** existing flows exactly as
`onEmptyClick` already routes them — staff get `CalendarItemPanel`, members
get `RequestTimePanel`. No new flow, no new RPC; the default time is a
starting point the person can still change inside the panel (member) or the
editor (staff). **This is a judgment call**, not a literal reading of the
task's "the existing booking flow" — flagging it as the one surface where I
had to interpolate rather than find a control that already existed.
**Verified** (tests): both branches actually open the right existing panel.
**Assumed**: exact business-hours computation against live `calendar_free_busy`
data (not exercised — tests use empty `hours`, which is the same fallback
the page's own `useMemo` already had for a not-yet-loaded calendar).

### My Stable — inside `AccountHub.tsx`, not a standalone page
There is no `StablePage.tsx` and `HorsePage.tsx` is a single-horse detail
view, not a list — the task doc's file names don't match the repo. "My
Stable" is a collapsible section inside `/app/account` (`StableSection`),
reached by every account holder unconditionally (not gated behind the nav's
presence check, which only gates the *shortcut link*, not the section
itself). It already had a working, if easy-to-miss, plain-text "+ Add a
horse" link at the bottom of the horse list. I moved that control to the
shared component, placed next to the "Horses" sub-heading (closest analog to
"near the page title" for a subsection), and left it wired to the exact same
`setModal('horse')` → `HorseIntakeForm` it already used. **The task doc's
parenthetical "(HorseIntakePage)" is a different, more specific flow** (used
from a booking/purchase context, attaches horse ↔ booking/document) — not
the generic add-to-my-stable flow, which never used that route. Read-first
caught this before I wired the wrong thing.
**Verified** (tests): button renders next to "Horses", opens the real
"Add a horse" modal.

### Messages — `Messages.tsx`
This one **already had** a fully working, visible "New message" button next
to the title (`PenSquare` icon + label, `setPicking(true)` → the real member
picker → `sendDirectMessage`) — it was not part of the regression the task
describes. I did not build anything here; I swapped its bespoke button for
the shared `PageCreateButton` purely for the "one shared component decides
placement/size/styling once" goal the task states, keeping the exact same
handler. The task doc's "(createThread)" reference is inaccurate —
`createThread` is the *community discussion* flow (used by CreateModal's
`discussion` post type), not DMs; Messages uses `sendDirectMessage`. Another
read-first catch.
**Verified** (tests): button opens the real picker.

### Catalog — `CatalogPage.tsx`
**No button added, per the task's own instruction to say so instead of
forcing one.** The page is a pure browse grid (`OfferingCatalog`); every
item already carries its own inline action ("Book it") that starts a
purchase for that specific offering. There is no singular "thing" a
page-level "+" would create — a generic "+Catalog" button would either
duplicate an item's own action or be meaningless. Confirmed by reading the
component; no capability check applies since there's nothing to gate.

---

## Admin-only surfaces — inventory only, not built

Per the task, this is lower priority and out of scope to build. I delegated
a read-only pass over every `requireStaff`-gated route under `/app/ops/*`
(and `/app/admin`) to check whether staff pages that create something (a
contact, contract, horse, deal, product, invitation, etc.) have their own
visible create control, or rely only on the header's admin `CreateModal`
shortcuts. **I did not click through these myself** — this is a code-reading
inventory, one level less verified than the member-facing work above.

Finding: every staff page that creates a record already has its own visible
control (e.g. ContactsPage "New contact", HorsesPage "New horse",
DocumentsQueuePage "+ New contract", TeamPage "Invite an admin", DealsPage
"New deal", EvaluationReportsPage "New", ContentStorePage "New block",
boarding/barnops/lessons pages each with their own "New X" — full list
available in this session's research transcript, omitted here for length).
The three header `CreateModal` staff shortcuts (New deal / New contract /
New client) all point at pages that also have their own entry points, so
nothing depends solely on the header tab. **No admin-facing follow-up task
looks necessary** — flagging this as a finding for you to sanity-check
rather than a closed conclusion, since it wasn't hands-verified.

---

## Things I changed beyond the literal surface list

**`CreateModal` gained an `initialStep` prop and `CreateModalContext`.** The
task said "build buttons, not flows" — this isn't a new flow, it's plumbing
so a page-level button can reach the *existing* modal at a useful step
instead of either (a) duplicating the whole modal per page, or (b) always
landing on the generic destination menu. The header's own behavior
(`onCreate={() => setCreateOpen(true)}`) is untouched — `createStep`
defaults to, and resets to, `'destination'`, so the admin/staff "+" tab
opens exactly as it did before this task. I did not touch
`CardstockHeader.tsx`, `header-cardstock.css`, or the
`showCreateTab={isStaff}` line — confirmed by `git diff` containing zero
references to any of the three.

---

## Not verified — stated plainly

- **No live browser session, member or admin** — no real Supabase
  credentials available locally (see "How I verified"). Everything above
  the "not verified" line is code reading, a clean build, and 16 passing
  component-level tests against real components with only unrelated data
  dependencies mocked.
- **RLS / actual capability enforcement** on the server side for any of the
  five flows — untouched by this task, each flow's own existing code path is
  unchanged.
- **Visual placement at real breakpoints / responsive wrapping** of the new
  button next to each title — the tests assert the button renders in the
  DOM and is clickable, not its on-screen position or wrapping behavior on
  narrow phones. Worth a look before merge.
- **The admin-surface inventory** above is a single read-only research pass,
  not a click-through — treat it as a starting point, not a guarantee.
- **`test/db/*`** (the repo's DB-level suite) was not run — this task made
  no backend/migration changes, so it's out of scope, but it also means I
  have not re-confirmed that against this branch.
