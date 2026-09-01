# TASK-CR85 — REPORT

**Built 2026-09-01 on `task/cr85`, worktree `~/Downloads/claude-code-repo/wt-cr85`, from `origin/main`
(`61ec7f4b`). Commits: `eca449db` + the comment correction below. NOT pushed.**

**Files changed — two, and only two:** `src/components/app/AppLayout.tsx`, `src/lib/pageRegistry.ts`
(plus `test/ui/cr85_three_nav_sections.test.ts`, new, and `test/ui/fix3_nav_sections.test.ts`,
three assertions restated where CR-85 supersedes FIX3). **No dashboards, forms, modals or money.**

---

## 1. WHAT WAS BUILT

The order on screen was already Community · Management · People · Admin. **The only change is People
dissolving**, and the mechanism it needed:

| | Before | After |
|---|---|---|
| **Community** | `APP_PAGES_GROUP` — a **pseudo-group** (`key: 'app-pages'`, `items: []`) whose content was hand-written JSX at each render site | a **REAL group** returned by `manageNavGroups()`, same key, `items` = Catalog · Messages · Contacts · Stable |
| **People** | `key: 'accounts'`, label `People`, two rows | **gone as a section.** `ACCOUNTS_GROUP` survives as the array those two rows are written in; nothing labels it |
| `StaffNavItems` | Catalog + Messages as `<RailLink>` JSX, rendered by 2 of the 3 surfaces | **DELETED.** Both are `NavItem`s in `COMMUNITY_PAGES_GROUP` with registry rows |
| Registry | Catalog and Messages had **no rows at all** | `app_pages.catalog`, `app_pages.messages`. `people.records` / `people.stable` keep their KEYS, only `group` moved |

**T1 obeyed.** The new section did **not** take `community` — that key is Admin's, and it is the
`group` field on registry rows whose stored `page_key`s are CHECK-constrained to the `community.`
grammar. The existing `app-pages` pseudo-group was promoted instead, under its own key, which is
already what `groupOpen`/`toggleGroup` use for collapse state. The registry spells the same section
`app_pages` (underscore) because the DB grammar `^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$` rejects a hyphen;
both spellings are documented at both ends.

**⚠️ Nothing was renamed and nothing was tidied out.** Catalog and Messages stayed — the VIEW is in
Community, the EDITOR (`Products`, `/app/ops/admin/products`) is in Admin, and there is now a test
asserting both sit where they sit. Contacts → `/app/records` and Stable → `/app/records/horses` keep
their labels, their `Contact2` / `Fence` icons and their routes.

---

## 2. §7 — THE REACH. ALL THREE SURFACES, IN RENDERED ORDER

Measured from `manageNavGroups()` for an **admin, all six modules on** (FHE's live state), then read
off each render site in the source. Rows in render order, top to bottom.

### SURFACE 1 — the desktop staff rail (`lg:` and up, `AppLayout.tsx:2084-2140`)

```
  [Add New]  ── separator ──
  COMMUNITY                       (heading button + chevron; collapsed rail → separator, aria-label "Community")
    Community Feed                (CommunityNav — a component, not a row)
      Social · Discussions · For Sale · Events · Articles · Resources · Members
    Catalog                       /app/catalog
    Messages          [badge]     /app/messages
    Contacts                      /app/records
    Stable                        /app/records/horses
  MANAGEMENT
    Dashboard         [badge]     /app/dashboard
    Calendar                      /app/calendar
    Support                       /app/ops/support
    Payment review                /app/ops/payments/review
    Evaluations                   /app/ops/evaluations
  ADMIN
    Moderation · Field options · Content store · Team
    Branding · Products · Editor · Page visibility          (the four adminOnly rows)
  ── Account · [collapse] · App tour · Sign out ──
```

### SURFACE 2 — the mobile drawer (below `lg:`, `AppLayout.tsx:2330-2350`) — **THE PHONE**

**Identical three sections, identical rows, identical order**, because it maps the same `railGroups`
array through the same loop and takes the same `g.key === COMMUNITY_KEY && <CommunityNav …/>`
injection. The only differences are the ones that were already there: no collapse chevrons (every
section is open), and the rows are full-width.

```
  COMMUNITY     Community Feed (+ its 7 filter views) · Catalog · Messages [badge] · Contacts · Stable
  MANAGEMENT    Dashboard [badge] · Calendar · Support · Payment review · Evaluations
  ADMIN         Moderation · Field options · Content store · Team · Branding · Products · Editor · Page visibility
  ── Account · App tour · Sign out ──
```

### SURFACE 3 — the avatar drop-down (`AppLayout.tsx:1848-1858`)

Its section block is `lg:hidden`, so **the sections appear on phone/tablet widths only** — that was
true before this task and is unchanged.

```
  <name>
  Account
  COMPANY            Pending agreements                       (admin only)
  QUICK ACCESS       Community Feed (+ its 7 filter views)
                     Dashboard [badge] · Catalog              (admin branch)
                     — or, for an instructor: Dashboard [badge] · Calendar · Catalog · Messages [badge]
  ── the sections, lg:hidden ──
  COMMUNITY          Catalog · Messages [badge] · Contacts · Stable
  MANAGEMENT         Dashboard [badge] · Calendar · Support · Payment review · Evaluations
  ADMIN              Moderation · Field options · Content store · Team · Branding · Products · Editor · Page visibility
  App tour · Sign out
```

**⚠️ Two deliberate differences on this surface, both stated rather than silently shipped:**

1. **`CommunityNav` is NOT injected into its Community section here.** This menu already renders the
   feed unconditionally for every non-superadmin, in the *Quick access* block above. A second copy
   under the Community heading would be the feed twice in one menu.
2. **Its *Quick access* block now repeats rows the Community section also carries** — Catalog for an
   admin; Catalog and Messages for an instructor. **Flagged, not fixed** — see §7 below. This is the
   same duplicate class FIX3 already created here for Dashboard and Calendar, it belongs to this
   menu's shape rather than to the section, and the block is shared with the MEMBER branch, which
   §4 puts out of scope.

**No row exists in a table and renders on one surface only.** That was possible before because
`StaffNavItems` was hand-written JSX rendered by the rail and the drawer and by nothing in the
drop-down; it is deleted, and `test/ui/cr85_three_nav_sections.test.ts` asserts against the source
that all three sites map `railGroups`, that nothing maps the unfiltered `navGroups`, and that the
feed injection appears exactly twice (rail + drawer).

---

## 3. §8 — THE TEST, ITEM BY ITEM

**1. Three sections, in this order — pasted above for all three surfaces.** ✅
Machine-readable, from `manageNavGroups()`:

```
  app-pages    Community    [Catalog, Messages, Contacts, Stable]
  management   Management   [Dashboard, Calendar, Support, Payment review, Evaluations]
  community    Admin        [Moderation, Field options, Content store, Team, Branding, Products, Editor, Page visibility]

  instructor (not admin, no grants):
  app-pages    Community    [Catalog, Messages, Contacts, Stable]
  management   Management   [Dashboard, Calendar, Support, Payment review, Evaluations]
  community    Admin        [Moderation, Field options, Content store, Team]
```

**2. No "People" heading anywhere, and no empty heading left behind.** ✅
`manageNavGroups()` returns no group keyed `accounts` and no group labelled `People`, for either role
— **confirmed** that its `groups.filter((g) => g.items.length > 0)` drops an emptied group, and
asserted directly (`every(g => g.items.length > 0)`). The label also had a **second** rendering site,
which FIX3's own notes flag and TASK-AR4 proved live: `GROUP_LABEL` in `pageRegistry.ts`, which heads
the sections on `/app/ops/admin/pages`. `pageSections()` now returns `['Community','Management','Admin']`
for its non-module sections — no People heading there either, and no empty one, because a group with
no rows is skipped.

**3. `Contacts` and `Stable` are under Community, same labels, icons and routes.** ✅ Asserted by
label→route pair and by icon identity (`Contact2`, `Fence`). Both routes are untouched, so both still
open their pages — `people.records` → `/app/records`, `people.stable` → `/app/records/horses`, and
`test/ui/pagevis_registry.test.ts` (unchanged, passing) proves both are routes `App.tsx` registers.

**4. `Catalog` and `Messages` are still under Community, and Messages still carries its unread
badge.** ✅ The badge is injected by route in `navGroups`, exactly as Dashboard's is, so every surface
that maps the array gets it. On the rail and the drawer `RailLink` renders it as before. **On the
avatar drop-down it renders for the first time**: `MenuLink` had no `badge` prop at all and had been
dropping Dashboard's silently since UIO-012. That is a three-line repair using the markup its two
sibling blocks in the same menu already use — recorded here because it is a visible change to a row
this task did not otherwise touch.

**5. Admin's group key is still `community`, and the rows that carry it are unchanged.** ✅

```
  { key: 'community.moderation', path: '/app/ops/moderation', label: 'Moderation', group: 'community' },
  { key: 'community.lookups',    path: '/app/ops/lookups',    label: 'Field options', group: 'community' },
  { key: 'community.content',    path: '/app/ops/content',    label: 'Content store', group: 'community' },
```

⚠️ **CORRECTION — the task says "the six registry rows that carry it", and there are not six.** That
number comes from a comment in `AppLayout.tsx` written by FIX3, and **it was already wrong in the
commit that wrote it**: six was the count *before* the same commit retired `community.activity` and
`community.oversight` and moved `community.evaluations` to Management. Measured today: **three rows
carry `group: 'community'`** (above, byte-for-byte unchanged by this task), and **four keys begin
`community.`** — `community.evaluations` being the fourth, filed under `group: 'management'`, which is
this registry's own rule that a key never follows its page. **The comment is corrected in place.**
The argument it was making is untouched and is exactly why CR-85 did not reuse the key.

**6. Registry drift, measured before and after.** ✅ **It did not increase.** See §5.

**7. The member rail is unaffected.** ✅ See §4.

**8. Gates.** ✅ `typecheck` **0** · `typecheck:api` **0** · `lint` **46 problems (0 errors, 46
warnings)** — the baseline exactly, not one more · `npm run build` **succeeded**. Built-CSS grep in §6.

**9. Renders NOT VERIFIED by me** — the owner's checklist is §8.

**Tests.** `test/ui` — **11 failed / 197 passed across 25 files**, against a `origin/main` baseline of
**11 failed / 178 passed across 24 files** measured in the canonical checkout at the same commit.
**The same 11 failures, in the same 4 files** (`dealauto_delivery_recipient_scope`,
`pluspass_create_controls`, `wallreturn_onboarding`, `adminsweep_instructor_preview`) — all
pre-existing, none in nav code. **19 net-new passing tests are this task's.**
`test:db` red is baseline and was not used as a signal.

---

## 4. §4 — THE MEMBER RAIL: WHAT I CHECKED

**Explicitly: I did not move a member's rail.**

- **`QUICK`, `PRESENCE_LINKS`, `ClientNavItems`, `ClientRail`, `AccountNavLink`, `NavFooter` — not
  edited.** Verified with `git diff` on the commit: the only hunks in this file are the two nav
  tables, `manageNavGroups()`, the badge injection, the deletion of `StaffNavItems` and
  `APP_PAGES_GROUP`, `MenuLink`'s badge, and the three render sites.
- **The desktop member rail (`ClientRail`) is untouched** — it never rendered `railGroups` at all;
  members get `navGroups === []` because `showRail` is false.
- **The mobile drawer's member block** was the one place a member and staff shared a branch. It was
  `{!isSuperAdmin && (<>{showRail && <heading/>} <CommunityNav/> + (member ? ClientNavItems :
  StaffNavItems)</>)}`. It is now `{!isSuperAdmin && !showRail && (<CommunityNav/> +
  <ClientNavItems/>)}` — **same component, same props, same order, and still no heading**, because
  the heading only ever rendered when `showRail` was true, i.e. never for a member. Staff simply no
  longer pass through this branch. A test slices the block out of the source and asserts no heading
  class appears inside it.
- **A superadmin still sees only `Platform`** and gets no Community section — asserted.

---

## 5. §T3 — REGISTRY DRIFT, MEASURED

**Definition, used identically before and after:** a registry row *drifts* when it has **no row on the
staff rail at all**, or when its row **renders in a section other than the one its `group` names**
(with FIX3's `settings` → Admin fold applied; `modules` names no rail section).

| | Registry rows | Drifted |
|---|---|---|
| **BEFORE** (`origin/main`, `61ec7f4b`) | 30 | **15** |
| **AFTER** | 32 | **15** |

**The 15 are the same 15 rows in both runs**, and not one of them is a row this task touched:
`lessons.hub` · `lessons.plans` · `lessons.credits` (no nav row anywhere) · the eight
boarding/barnops/employees **children** (no nav row anywhere) · the three module **hubs**
(`boarding.hub`, `barnops.hub`, `employees.hub` — reachable only as AccountHub cards since FIX3 filtered
the Modules section out of the rail) · `records.hub` (dead).

**The four rows this task moved or created all measure `ok`:**

```
  app_pages.catalog   /app/catalog          ok (app-pages)
  app_pages.messages  /app/messages         ok (app-pages)
  people.records      /app/records          ok (app-pages)
  people.stable       /app/records/horses   ok (app-pages)
```

**⚠️ The probe's "rail rows with no registry row: 0" reads 0 in BOTH runs, and that zero is honest
only after this task.** The probe can only see `NavItem` tables. Before, Catalog and Messages were a
rail row apiece with **no registry row** — invisible to the measure precisely because they were
hand-written JSX, which is the shape T3 is about. **The true before-count of registry-less staff rail
rows is 2; after, it is 0.** The community feed and its seven filter views are not counted either way:
they are one page (`/app`) under one component, not rows.

**Converging `AppLayout.tsx` and `pageRegistry.ts` is still its own thread and was not attempted.**
`AppLayout.tsx` still does not import `pageRegistry.ts`. This task added the registry rows its own
moves required and nothing else.

---

## 6. §T1 (constraints) — THE BUILT-CSS GREP

One new class list was introduced: `MenuLink`'s badge. Two of its classes carry bracketed values.
Grepped out of `dist/assets/index-C0yL2QP6.css` after `npm run build`:

```
.min-w-\[1\.25rem\]{min-width:1.25rem}
.text-\[11px\]{font-size:11px}
.h-5{height:1.25rem}
.px-1\.5{padding-left:.375rem;padding-right:.375rem}
.leading-5{line-height:1.25rem}
.rounded-full{border-radius:9999px}
.ml-auto{margin-left:auto}
.bg-gold-600\/70{background-color:#ba9935b3}
.text-white{--tw-text-opacity: 1;color:rgb(255 255 255 / var(--tw-text-opacity, 1))}
```

**All nine emit.** No other class in this change is new — every nav row, heading, separator and inset
reuses the constants already in the file.

---

## 7. FLAGGED, NOT FIXED

### F1 · ⚠️ T4 — PAGE VISIBILITY IS STILL WIRED TO NOTHING, AND THIS TASK MADE THE LIE WIDER

**What happens if someone hides Catalog or Messages: nothing. The rows stay, on all three surfaces.**

**Measured, not assumed.** `isPageHidden` (`AuthContext.tsx:220`) has **exactly one call site in the
whole app** — `OpsDashboard.tsx:233`, the module tiles. `manageNavGroups()`'s `visible()` filter reads
`module` and `adminOnly` and nothing else; the nav never reads `org_page_visibility`. So the toggle on
`/app/ops/admin/pages` writes a real row via `set_page_hidden()`, the write succeeds, and **no nav row
disappears** — for Catalog, for Messages, for Contacts, for Stable, or for any of the other 28 rows.

**⚠️ This task made the exposure larger, and that is worth saying plainly.** Before CR-85, Catalog and
Messages had no registry rows, so `/app/ops/admin/pages` did not offer them and the tenant could not
try. They are offered now. **Two more switches that do nothing** — and, from the same page, Contacts
and Stable have moved out from under a *People* heading into a *Community* one, so the page's
description of the menu changed too (it is accurate: the menu changed the same way).

**Not fixed, per §5 — its own thread.** `pageRegistry.ts`'s header already says the feature is wired to
nothing; that paragraph is left standing and extended to the new rows. **`OpsDashboard.tsx:219-227`
still claims otherwise** — *"you can bring its menu entry back under Admin → Page visibility"* — and I
did not touch it: it is not my file this session, and the honest fix is wiring the filter, not editing
the sentence.

### F2 · the avatar drop-down repeats rows between *Quick access* and the sections
Described in §2. Pre-existing class (Dashboard and Calendar have duplicated there since FIX3); CR-85
adds Catalog, and Messages for instructors. Not fixed because the *Quick access* branch that carries
them is shared with the MEMBER path, which §4 puts out of scope. **The clean fix is to cut
Quick-access down to what the sections do not already carry, on the staff branches only.**

### F3 · `AppLayout.tsx` ↔ `pageRegistry.ts` are still two tables of one fact
Unchanged and out of scope (T3). Recorded so the count in §5 is not read as progress on it.

### F4 · a spacing difference on the desktop rail, small and deliberate
The Community block used to sit **outside** the group loop in its own `<div className="mb-1">`; it is
now the loop's first child, so the gap above Management comes from the loop's `gap-1` rather than that
`mb-1`. Both are 4px. **I expect no visible change** and did not verify by eye — item 1 of the
checklist below is exactly this.

---

## 8. §9 — THE CHECKLIST THE OWNER RUNS. ⚠️ RUN IT ON THE PHONE FIRST

**No render below was verified by me.** The last nav change (FIX3) was proven on the desktop rail and
shipped a phone that had not changed at all (TASK-AR4). **Item order here is deliberate: the phone is
first.**

**ON THE PHONE, signed in as an admin (hello@):**

1. Open the **drawer** (the tab on the left edge). ⚠️ **Three headings, in this order: COMMUNITY,
   MANAGEMENT, ADMIN.** There must be **no People heading**, and no heading with nothing under it.
2. Under **COMMUNITY**: *Community Feed* first (tap its chevron — the seven filter views open under
   it), then **Catalog, Messages, Contacts, Stable**.
3. **Messages shows its unread badge** in the drawer if you have unread DMs. (Send yourself one from a
   second account if you need to see it.)
4. Tap **Contacts** → the Records page opens. Back, tap **Stable** → the Horses tab opens.
5. Tap **Catalog** → the shop opens (the community's view — not the editor).
6. Open the **avatar menu** on the phone. Same three sections, same rows. ⚠️ **Expect Catalog to
   appear twice** — once under *Quick access*, once under *Community*. That is F2 above, reported and
   not fixed; tell me if it bothers you and it is a small follow-up.

**ON THE DESKTOP, same account:**

7. The left rail: **COMMUNITY, MANAGEMENT, ADMIN**, same rows as the phone. **No People.**
8. Click the **COMMUNITY** heading — the whole section collapses, feed included, and clicking again
   restores it. Do the same to Management and Admin.
9. **Collapse the rail** (the toggle at its foot). The headings become separators; every icon still
   sits on one centre line; hovering an icon shows its label after a beat; **Messages' badge shows as
   a dot on its icon**.
10. Compare the gap above **MANAGEMENT** with the gap above **ADMIN** — they should look the same.
    (F4: that spacing changed mechanism, not value.)

**AS AN INSTRUCTOR (not an admin):**

11. Same three sections. **Admin holds four rows** — Moderation, Field options, Content store, Team —
    and not Branding / Products / Editor / Page visibility.

**AS A MEMBER (a client login):**

12. ⚠️ **Nothing about their menu may have changed.** Desktop rail: Community Feed, then My Orders /
    My Payments / My Documents / My Stable / My Posts / My Saved Items, then Account. Phone drawer:
    the same list, **with no heading above it**. If a "COMMUNITY" heading has appeared over a member's
    personal links, that is a defect and I want to know.

---

## 9. TEARDOWN

**Nothing was left running by this task** — no dev server, no watcher, no PGlite, no build in the
background. Every command run here (`npm install`, `typecheck`, `typecheck:api`, `lint`, `vitest run`,
`npm run build`) is one-shot and exited. The temporary drift probe
(`test/ui/_cr85_drift_probe.test.ts`) was deleted after each of its two runs and is not in the commit.

Census, filtered to anything this project could have started:

```
$ ps -eo pid,etime,command | grep -Ei "vite|vitest|npm run|supabase|pglite|postgres|esbuild"
  (no vite, no vitest, no npm, no esbuild, no PGlite)

  77532  00:01  psql postgresql://…@db.lrstswfxfsezdmvkvukc.supabase.co:5432/postgres -X
                -f /private/tmp/claude-504/…/e58c174e-…/scratchpad/t12.sql
```

⚠️ **That `psql` is NOT mine and I did not touch it.** Its scratchpad path is a different session's
(`e58c174e-…`; mine is `050a0d60-…`), it is one second old, and it is a live query against **prod**.
**Another thread is working in the production database right now** — flagging it because CR-85's own
constraint says nothing may run beside me in `AppLayout.tsx` / `pageRegistry.ts`, and whoever that is
should confirm they are not also in those files.

Everything else in the full census is Visual Studio Code's own helpers (language servers, tsserver),
running for days and unrelated.
