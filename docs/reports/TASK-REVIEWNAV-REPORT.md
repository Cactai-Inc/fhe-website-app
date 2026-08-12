# TASK REVIEWNAV — the Review section, built

**Branch `task/reviewnav`, off `origin/main` at `226f6ec` (rebased mid-build; `main` moved twice
while this ran and both moves were docs-only).** Not pushed.

**Applied, not held.** typecheck 0 errors · lint 0 errors / 39 warnings (identical to `main`'s
39) · build passes · 18 new tests pass · the one failing test in `test/ui`
(`pluspass_create_controls`) **fails on `main` too** and is not mine.

---

# WHAT EXISTS NOW

A `Review` group at the foot of the desktop admin nav, admin-only, open by default, carrying one
line under its heading:

> *Temporary. A page stays here until you accept it — moving it out of Review means done.*

**31 rows**, one per distinct URL, covering **every implementation in DUPECENSUS's manifest**
across 11 comparison groups. The first row is `/app/ops/review` — an index page that lays the
whole thing out in order with what each slot is, which is the incumbent, and every caveat.

Five files, and that is the whole section:

| file | what it is |
|---|---|
| `src/lib/reviewSection.ts` | **the single source of truth** — every group, slot, label, URL, warning, and origin. The nav rows AND the index page derive from it. |
| `src/pages/app/ops/review/ReviewIndexPage.tsx` | the index at `/app/ops/review` |
| `src/pages/app/ops/review/ReviewBanner.tsx` | the dashed-gold banner, copied from `InstructorHomePreview`'s visual language |
| `src/pages/app/ops/review/ReviewMounts.tsx` | the four mounts for things that had no route |
| `test/ui/reviewnav_section.test.tsx` + `reviewnav_mounts.test.tsx` | the proofs |

Plus **two edited files**: 5 routes in `App.tsx`, and 4 blocks in `AppLayout.tsx` — all marked
`REVIEW SECTION`, plus 6 `REVIEW SECTION — MOVED OUT` comments each holding the exact line to put
back.

---

# ADDING ONE PAGE IS ONE ENTRY. THAT WAS THE ADDENDUM'S POINT.

The addendum reversed the priority: per-entry cheapness beats whole-block demolition, because
emptying out is what will actually happen. So:

- **Adding a page:** one object in `REVIEW_GROUPS`. Nothing else. Nav row, index row, origin
  record and walkthrough position all follow from it.
- **Accepting a page:** delete that object; if `origin.moved` is `true`, put its nav row back
  where `origin.where` names; if it has a `/app/ops/review/…` route, delete the route and the
  wrapper. Three steps, none of them a hunt.
- **No demolition date is written anywhere in the code.** The file says it empties out.

The procedure is in the header comment of `src/lib/reviewSection.ts` — where the next thread will
be when it needs it, rather than in this report where it will not look.

---

# THE ORIGIN MAP — A LIVING RECORD, NOT A CLOSED LIST

**This table lives in the code**, as the `origin` field on each entry, and is rendered on the
index page under every moved row. It is reproduced here for reading, but **the code is the copy
that is maintained** — a table in a report goes stale the first time somebody accepts something.

| link | came from | moved? |
|---|---|---|
| `/app/dashboard` | `MANAGEMENT_GROUP` — "Dashboard", icon `LayoutDashboard` | **YES** |
| `/app/ops/horse-records` | `MANAGEMENT_GROUP` — "Horses", icon `Boxes` | **YES** |
| `/app/ops/records` | `MODULES_GROUP` — "Records", icon `FileText`, `module: 'mod.horserecords'` | **YES** |
| `/app/admin` | `ACCOUNTS_GROUP` — "Clients", icon `Contact` | **YES** |
| `/app/ops/leads` | `ACCOUNTS_GROUP` — "Leads", icon `Users` | **YES** |
| `/app/ops/directory` | `ACCOUNTS_GROUP` — "Directory", icon `BookOpen` | **YES** |
| `/app/ops/team` | `SETTINGS_GROUP` — "Team", icon `UserRound`, **no `adminOnly`** | **YES** |
| `/app/account` | the `AccountNavLink` row at the foot of the staff rail + the mobile drawer | **YES** |
| `/app/calendar` | `StaffNavItems` — "Calendar", icon `CalendarDays` | **YES** |
| `/app/catalog` | `StaffNavItems` — "Catalog", icon `ShoppingBag` | **YES** |
| `/shop` | site footer — "Ways to Ride" **and** "Book a Lesson" (`Footer.tsx:37-38`) | no — public site |
| `/horse` | marketing header "Horse Care Services" + footer "Horse Care" | no — public site |
| `/acquisition` | marketing header "Find a Horse" + footer "Acquisition Support" | no — public site |

**Ten links MOVED. A test counts every `href` the nav renders and fails if any of the ten appears
more than once** — that is the "move it, don't copy it" rule, enforced rather than asserted.

**Three did not move, and the reason is not laziness:** they are links on the **public marketing
site**, not in the admin app nav. Removing them would change what a visitor sees, and §5 of the
task says nothing about the live app changes except which nav group a link is in. Their Review
rows were ADDED; the marketing links stay. (The **two footer links to one page** — "Ways to Ride"
and "Book a Lesson", both `/shop` — is recorded as a defect and **not fixed**.)

### Two consequences of the moves that the next thread must not read as breakage

1. **The "People" heading is gone from the rail.** All three of its rows (Leads / Clients /
   Directory) were People slots A, C and D, so the group emptied and `manageNavGroups`'s
   `items.length > 0` filter drops it. Expected. `TASK-ONEPEOPLE` replaces all three with one
   tabbed page anyway — which is the decision this review feeds.
2. **The "Modules" heading is gone too.** Records was the only module row FHE could see
   (`mod.horserecords` is the one enabled module with a nav entry; boarding / barnops / employees
   are all off). Restore Records **with its `module` key** — the Review row deliberately has no
   module gate, because the owner has to be able to reach every implementation.

---

# DECISIONS THE TASK ASKED ME TO STATE

### The mobile drawer shows it too

The drawer renders the same `navGroups` array, so this was show-it or filter-it-out. **It shows.**
Ten live rows moved into this group — hiding it on mobile would take Dashboard, Clients, Leads,
Calendar and Account off the phone entirely, and a drawer that disagrees with the rail about what
exists is a second source of truth, which is the thing this section exists to kill.

### Admin-only, via the existing mechanism

Every Review entry carries `adminOnly: true` — the same gate `SETTINGS_GROUP`'s three admin pages
use. `visible()` empties the group for anyone else and the existing length filter drops it. No new
gate was invented. The review-only **routes** are `requireAdmin`, matching.

**One honest conflict, recorded because it contradicts a comment already in the file.** The Team
row's comment says it is deliberately NOT `adminOnly`, because `ops/team` is a `requireStaff`
route and *"gating the nav entry tighter than the route would … lie about what you have."* While
Team sits in Review it **is** gated tighter than its route. That is a temporary cost of the review
being admin-only, and **it currently hides the row from nobody**: production `profiles.role` holds
2 ADMIN, 1 SUPER_ADMIN and 10 USER — **there is not one MANAGER or EMPLOYEE account in existence**
(verified against the live DB). Restore Team without `adminOnly` on acceptance; the comment says so
at the call site.

### Open by default

Ten live rows moved in, Dashboard among them. `openGroups` is per-mount state and does not
persist, so a collapsed Review would hide the staff dashboard behind a chevron on **every page
load**. It sits last in the rail so it does not push the day-to-day nav down.

### It looks temporary — following ADMINSWEEP, not inventing a second language

Dashed gold border, gold-50 fill, uppercase eyebrow: exactly `InstructorHomePreview`'s banner,
because that page already established what "not a live page" looks like here. It appears on the
index page, on all four mounts, and as a one-line gold note under the nav heading. **The nav note
matters most:** the owner's rule is that nav position IS the status, so the sentence explaining
what the position means belongs beside the position, not only on the pages.

---

# ⚠ NO RETIREMENT CONSTANT WAS FLIPPED

Re-derived against `main` at build time rather than copied from DUPECENSUS (which warns its own
list goes stale weekly). **Seven module-level booleans in `src/`; exactly two hide a page**, and
both are untouched at `true`:

| constant | file | still `true`? | how it was handled |
|---|---|---|---|
| `CONTACTS_PAGE_RETIRED` | `src/pages/app/ops/ContactsPage.tsx:523` | **yes** | component **mounted** at `/app/ops/review/contacts` |
| `INTAKE_PAGE_RETIRED` | `src/pages/app/ops/IntakePage.tsx:447` | **yes** | component **mounted** at `/app/ops/review/intake` |

`/app/ops/contacts` still redirects to `/app/admin` and `/app/ops/intake` still redirects to the
dashboard carrying its `?request=` param — for every user, exactly as before. **A test asserts
both constants are still `true`**, so a later thread cannot quietly flip one to "make Review
work". The other five booleans (`INLINE_BODY_PREVIEW_RETIRED`, `STRIPE_ENABLED`, `SEED_ENABLED`,
`PASSWORD_AUTH_ENABLED`, `SCRIM_ENTERS_AS_FADE`) hide a body preview, card payment, seed data, an
auth method and an animation. None is a page.

**DUPECENSUS's manifest says to flip both booleans.** That instruction was **not followed** — the
task doc overrides it, and it is right to: flipping puts a retired page back into the live app for
every user.

---

# WHAT WAS WIRED, AND WHAT WAS NOT

**Four routes were added** — the only implementations that could not be reached at all:

| route | what it mounts | why it needed one |
|---|---|---|
| `/app/ops/review/contacts` | `ContactsPage` | retired behind a boolean |
| `/app/ops/review/intake` | `IntakePage` | retired behind a boolean |
| `/app/ops/review/contact-dossier` | `ContactDossierModal` | takes a `contactId` prop, has no route |
| `/app/ops/review/contact-form` | `ContactForm` | presentational, takes props, has no route |

Everything else is `url-only` and just got a Review row. **No dead URL was resurrected** and no
component was given a permanent-looking home — all four live under `/app/ops/review/`.

### Two things I could not mount, and did not fake

- **Body renderer slot C — the PDF renderer** (`src/lib/documentPdf.ts`). A non-React PDF writer:
  no component, no route, nothing to mount. It is listed on the index page with its reason and
  the suggestion to compare it by emailing a signed copy. **Nothing was invented to give it a
  page.**
- **Staff roster slot B** (`/app/ops/employees/staff`) renders `ModuleGate`'s locked fallback,
  because `mod.employees` is **disabled** in `org_modules` (verified live). The row is there and
  labelled; **the module was not enabled**, because that would change the live app for every
  staff user.

### The one place a review mount is not byte-identical to production

`ContactForm`'s **submit is inert** on its review route. The component itself is unmodified — the
review page passes it a handler that refuses through the component's own `error` prop, which is
exactly the contract `ContactsPage` uses. The reason is on the banner: its real create path does
not set `contact_type`, so anything created through it files itself on the wrong page. Wiring a
real create from a review page would have shipped that defect from a new surface. **Validation,
layout and cancel are all real** — an empty first name still blocks inline, and a test proves it.

**Everything else is the page as it actually is.** No class, no label, no fix.

---

# FOUR NAV ROWS THE MANIFEST WANTED THAT WOULD HAVE BEEN AMBIGUOUS

The manifest lists implementations; the nav lists URLs, and four pairs share one. Two nav rows on
one URL is precisely the ambiguity this section exists to remove ("he would not know whether he
was looking at A or at the copy"), so they were **merged into one row each and shown as separate
slots on the index page**:

| manifest slots | one URL | how the label reads |
|---|---|---|
| Staff home A **+** Inbound A | `/app/dashboard` | *Staff home A · in use* |
| Staff home B **+** Inbound D | `/app/ops` | *Staff home B · OpsDashboard* |
| Doc viewer A **+** Body A | `/app/contracts/704c8d2d…` | *Document A · authoring (in use)* |
| Doc viewer B **+** Body B | `/app/ops/documents/704c8d2d…` | *Document B · read-only view* |

Every one of these is a full row on `/app/ops/review` with its own slot letter and description, so
nothing in the manifest lost its entry — only its duplicate nav row. A test asserts no two Review
rows share a URL.

**One known cosmetic consequence:** `Inbound C` is `/app/dashboard?request=<id>`, which `NavLink`
matches on pathname — so while you are on the dashboard, both it and `Staff home A` highlight as
active. Recorded on the index page rather than worked around.

---

# THE "OPS" LABEL — CARRIED FORWARD, NOT FIXED

Owner: *"the use of the term Ops, is meaningless … And we will be rebucketing all the nav links
after the restructuring and revisions."*

**Re-verified at `226f6ec`. `Ops` is user-visible in exactly two places, both unchanged:**

```
src/pages/app/ops/DocumentsQueuePage.tsx:337   <p className="eyebrow mb-2">Ops</p>
src/pages/app/ops/PaymentReviewPage.tsx:106    <p className="eyebrow mb-2">Ops · Payments</p>
```

Every other `OPS-` in the tree is an internal surface identifier in a code comment
(`OPS-DOCS-QUEUE`, `OPS-DASH`) and is not on screen. **Not fixed here** — an eyebrow is part of a
page's naming, which is what the re-bucketing pass decides, and the owner has said that comes
after the restructuring. **This paragraph is the carry-forward; it must survive into whatever task
does the re-bucketing.**

---

# DEFECTS SEEN WHILE WIRING — WRITTEN DOWN, NOT FIXED

1. **`ContactForm`'s create path does not set `contact_type`** — anything created through it lands
   on `/app/admin` rather than the page it was created from. (DUPECENSUS 2.4; `TASK-ONEPEOPLE`'s
   tab-following requirement would re-ship it.)
2. **Two footer links point at one page** — "Ways to Ride" and "Book a Lesson", both `/shop`,
   `Footer.tsx:37-38`. One line.
3. **`/acquisition` renders zero offerings** — all three acquisition SKUs have
   `price_amount = NULL` and the reader filters them out. A page in the marketing site's primary
   navigation that cannot be completed.
4. **`/account` bounces any member to `/app`** before it renders, so slot B of the Account
   comparison cannot be looked at by a member. That is the finding; nothing was changed to stop it.
5. **`/app/ops/directory` has zero rows in production** — a live nav entry on an empty page.

Each of these is on the index page next to the row it belongs to, so the owner meets it where it
matters rather than in a list.

---

# D13 — SAY IT PLAINLY

`D13` landed on `main` **while this was being built**: a feature is not done if changing it
requires the owner to open a thread. **Accepting a page out of Review requires a thread.** The
mechanism is as cheap as it can be made in code (delete one object, restore one nav line), but it
is code, not a screen.

I am **not** proposing an editor for it: this is scaffolding whose acceptance action is inherently
a code change — putting a nav row back in its real group is exactly the re-bucketing work. But the
owner should know that "move it out of Review" is a request he has to make, not a button he can
press. If that is unacceptable, the follow-up is a real one and should be named.

---

# WHAT IS PROVED, AND WHAT IS NOT

**No staff browser session exists in this environment, so the render is NOT VERIFIED.** Nobody has
looked at this in a browser. 18 tests stand in for what they can:

`test/ui/reviewnav_section.test.tsx` (13) — renders the **real `AppLayout`** as an admin and
asserts: the Review group renders; the note renders and says leaving means done; a **non-admin
staff account gets no Review group at all**; every manifest entry with a URL has a row; every
incumbent label says "in use"; **each of the ten moved links appears exactly once in the entire
nav** and that one appearance is the Review row; **every Review destination resolves against the
route table parsed out of `App.tsx`'s own source** (route params included); no two rows share a
URL; and both retirement constants are still `true`.

`test/ui/reviewnav_mounts.test.tsx` (5) — mounts all four review-only pages and asserts each
renders its banner and its real content, that the dossier opens as a dialog, and that
`ContactForm`'s own validation still fires.

**What that does not cover:** how any of it LOOKS, whether 31 rows is usable in the rail, whether
the collapsed 56px strip is legible with 31 identical icons, and whether each live page loads
against real data. All of that needs a browser.

**T1 (arbitrary Tailwind values):** every utility this task added was grepped out of the built CSS
with a non-empty rule body — `text-gold-800`, `text-[11px]`, `leading-snug`, `border-gold-400`,
`bg-gold-50`, `border-gold-200`, `text-gold-900`, `bg-green-50`, `border-dashed`. Nothing silently
emitted nothing.

**Live data re-verified before use:** both document ids (`DOC-J7NXZDHD5F`, `DOC-EP8HFFEV74` — both
still `AWAITING_SIGNATURE`), Marissa Robertson's request id, the six `org_modules` rows, the
`profiles.role` distribution, and the contact chosen for the dossier mount.

**Files I was told not to touch, and did not:** `DashboardPanel.tsx`, `ops/IntakePage.tsx`,
`DataTable.tsx`, `ClauseDocument.tsx`. Review rows point at their routes; not one of them was
edited.

---

# THE WALKTHROUGH — the actual deliverable

**Everything below is on `/app/ops/review` too**, laid out with the same order and the same
warnings. Work down it. The nav rows sit in this order.

### 1 · Horse roster — *which one is the horse page?*
- **A** `/app/ops/horse-records` — **in use.** PageLayout, filters, record drawer.
- **B** `/app/ops/horses` — the 07-01 original. **The only one that resolves breed/colour lookups
  to names** — that feature dies with it if A wins.
- **C** `/app/ops/records` — the module hub: a third roster plus parties/health lanes. Live today.

### 2 · Staff landing page — *where should staff land?*
- **A** `/app/dashboard` — **in use.**
- **B** `/app/ops` — the 07-01 OpsDashboard. Per-tile error branches, no arbitrary values.
- **C** `/app/ops/preview/instructor-home` — the trainer's home. **Its data is yours, not a
  trainer's**; no account exists that can render it any other way.

### 3 · Inbound work — *5 vs 12; which is the queue?*
- **A** the dashboard's leads band + drawer (same URL as 2A).
- **B** `/app/ops/review/intake` — the retired flat queue. **Still retired everywhere else.**
- **C** `/app/dashboard?request=9e6ec09c…` — one lead's drawer, the deep workflow.
- **D** the Ops KPI tile (same URL as 2B) — **the surface still saying 12.**

### 4 · People roster — *five lists, three of them one file*
- **A** `/app/admin` — **in use** (Clients).
- **B** `/app/ops/review/contacts` — the retired 07-01 directory. **Reviewing B reviews C and D's
  implementation** — same file, three modes.
- **C** `/app/ops/leads` · **D** `/app/ops/directory` — **D has zero rows.**
- ⚠ `TASK-ONEPEOPLE` will collapse A/C/D into one tabbed page. It had **not** landed when this was
  built (checked at `226f6ec`).

### 5 · Contact editor — *two editors, same page, different write paths*
- **A** `/app/ops/review/contact-dossier` — the 30-field dossier. **Its saves are real.**
- **B** `/app/ops/review/contact-form` — the 4-field original. **Submit is inert here** (see above).

### 6 · Account surface
- **A** `/app/account` — **in use.**
- **B** `/account` — **it will bounce you to `/app`.** That is the finding.

### 7 · Member time surface
- **A** `/app/calendar` — **in use.** · **B** `/app/schedule` — the 06-23 original.

### 8 · Catalog — *27 vs 24 vs 0*
- **A** `/app/catalog` — **in use**, in-app. · **B** `/shop` — same renderer, public.
- **C** `/horse` — the 07-01 ServiceSelector. · **D** `/acquisition` — **renders zero. Not broken;
  that is the bug.**

### 9 · Document viewer + body renderer — *same document, both times*
- **A** `/app/contracts/704c8d2d…` — authoring view, `ContractBody`. **DOC-J7NXZDHD5F is the one
  document with a `NEEDS:` mark**, so A and B differ where it counts.
- **B** `/app/ops/documents/704c8d2d…` — read-only view, `MergedBodyView`.
- **C** the PDF renderer — **no route; compare by emailing a signed copy.**

### 10 · Signature capture — *five surfaces, three writers*
- **A** `/app/contracts/e1052bae…` — **in use**, an AWAITING_SIGNATURE lease.
- **B** `/app/documents` — member self-sign. **This row is hidden for staff in the normal nav** —
  Review is your only way in.
- **C** `/app/onboarding` — renders its signing step only for an account with pending documents.
- **D** `/release` — ⚠ **the public kiosk SIGNS A REAL DOCUMENT. Look; do not complete it.**

### 11 · Staff roster
- **A** `/app/ops/team` — **in use.** · **B** `/app/ops/employees/staff` — **renders locked;
  `mod.employees` is off and was left off.**

---

# THE TEST THIS HAD TO PASS

| # | requirement | status |
|---|---|---|
| 1 | `REVIEW` group in the desktop admin nav, visibly temporary, admin-only | **done** — proved by test, render NOT VERIFIED |
| 2 | every manifest implementation has an entry, labelled with slot + incumbent | **done** — 4 slot-pairs share a URL and share a row; all appear as slots on the index |
| 3 | each one loads when clicked | **the 4 new routes are proved to mount by test**; the rest point at live routes. Browser NOT VERIFIED |
| 4 | the live page's entry MOVED, not copied | **done** — 10 links, counted by test |
| 5 | every moved entry's origin recorded | **done** — in code, on the index page, and in the table above |
| 6 | no retirement constant flipped, no page changed, no route deleted | **done** — asserted by test |
| 7 | removing the whole thing is one clearly-marked block | **done** — 5 files + 2 marked edits |
| 8 | a new page can be added in one line, written down where the next thread will find it | **done** — `reviewSection.ts` header |
| 9 | the copy says leaving Review means accepted | **done** — nav note, index banner, all four mounts |
| 10 | the origin map is a living record | **done** — it is a code field rendered on the page, not a list in this report |
