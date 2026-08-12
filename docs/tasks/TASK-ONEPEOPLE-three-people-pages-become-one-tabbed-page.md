# TASK ONEPEOPLE — Leads, Clients and Directory become tabs on one Contacts page

**Owner, 2026-08-12:**

> *"this means we can rollup people into one page called contacts that holds the three remaining
> people pages as 'Tabs'; Leads, Clients, Directory."*

Follows the same day's nav cleanup: the `Contacts` entry was removed because it already
redirected to Clients, and Team moved to the configuration group. **Three people entries remain
and they become one.**

---

# MEASURED 2026-08-12 — most of this is already built

## Two of the three are ALREADY one component

`src/pages/app/ops/ContactsPage.tsx` — `ContactDirectory({ mode })`, parameterised by a
`DirectoryMode`, with all copy in one `MODE_COPY` map (`:45`). The "three pages" are three
one-line wrappers:

```
:526  DirectoryPage()  ->  <ContactDirectory mode="directory" />
:531  ContactsPage()   ->  <ContactDirectory mode="contacts" />    RETIRED
:535  LeadsPage()      ->  <ContactDirectory mode="leads" />
```

`CONTACTS_PAGE_RETIRED = true` (`:523`) retires only the **`contacts` mode** — ROSTER
superseded it with `Admin.tsx`. **`DirectoryPage` and `LeadsPage` are explicitly NOT retired**
(the file says so).

**So Leads and Directory are already the same page with different copy.** Making them tabs is a
routing and chrome change, not a merge.

## Clients is a different, much richer component

`src/pages/app/Admin.tsx` — **1005 lines**, at `/app/admin`. Roster cards with derived badges
and relationship rings (ROSTERCARD), search and sort, and an **isolate** interaction.

## ⚠️ THE TRAP: `Admin.tsx` ALREADY HAS TABS, AND THEY ARE A DIFFERENT LAYER

```js
// Admin.tsx:72-86
type TabId = 'overview' | 'bookings' | 'documents' | 'orders' | 'payments'
           | 'activity' | 'posts' | 'messages' | 'login';
```

Its own docstring: *"ISOLATED — the other cards disappear; the profile renders below the
selected card; **account-scoped TABS** appear."*

**Those nine tabs belong to ONE SELECTED PERSON.** They are not list tabs.

**DO NOT ADD `Leads` AND `Directory` TO `TABS`.** That array is "what do I want to see about
*this person*". The owner is asking for "which *list of people* am I looking at". Putting them
in the same strip would produce a tab bar where `Directory` sits beside `Billing` and means
something categorically different.

**This page has TWO tab layers, and they must read as two:**

```
Contacts
├── [ Leads ] [ Clients ] [ Directory ]        <- NEW: which population
│
└── (in Clients) roster cards -> isolate a person
    └── [ Overview ][ Bookings ][ Documents ]…  <- EXISTING: about that person
```

**Make them visually distinct**, so nobody mistakes one for the other. Say what you did.

---

# WHAT TO BUILD

## 1. One page, three population tabs

- **Leads** — `ContactDirectory mode="leads"`
- **Clients** — `Admin.tsx`'s roster, unchanged in behaviour
- **Directory** — `ContactDirectory mode="directory"`

**Do not rewrite any of the three.** Compose them. `MODE_COPY` already supplies each mode's
title, blurb and create label — **the tab strip should read from it, not restate it.**

## 2. The URL — `/app/ops/contacts`

Three candidates and they are not equal:

| route | today | as the rollup's home |
|---|---|---|
| `/app/admin` | Clients | **bad** — "admin" does not mean "people" |
| `/app/ops/leads`, `/app/ops/directory` | one population each | **bad** — names one tab |
| **`/app/ops/contacts`** | redirects to `/app/admin` | **the right name, and free** |

**Use `/app/ops/contacts`.** Same principle as `TASK-HORSEONE`: the best URL and the best code
can come from different places.

**⚠️ It comes back with a NEW MEANING, and that must be explicit.** `CONTACTS_PAGE_RETIRED`
retired the *`contacts` mode of `ContactDirectory`* — the old "people we serve" rolodex that
`Admin.tsx` replaced. **Reviving the URL must not revive that mode.** Leave the constant `true`,
leave the mode retired, and **write a comment at the route saying the path is reused for the
rollup and does not resurrect the retired page** — or the next reader will flip the boolean.

## 3. Deep links must land on the right TAB, not just the page

`/app/ops/leads` and `/app/ops/directory` are linked from elsewhere in the app and from the
owner's habits. **Find every linker** — including `InstructorHome.tsx:145`, which points at
`/app/ops/contacts` labelled "Clients" — and make each old route redirect to its **specific
tab**, not to the page's default.

**Each tab needs its own addressable URL.** A tab you cannot link to cannot be redirected to,
and the owner will want to bookmark one. Pick a form (`?tab=` or a path segment), say which and
why, and be consistent.

## 4. The nav becomes one entry

`AppLayout.tsx` `MANAGEMENT_GROUP` currently carries `Leads` (`icon: Users`) and `Directory`
(`icon: BookOpen`), and `Clients` (`icon: Contact`) — **all three collapse to one `Contacts`
entry.**

**Pick its icon from what the three were using and say why.** `Contact` is the obvious
inheritance. **Do not introduce a fourth glyph**, and **do not reuse `UserRound`** — Team took
it the same day, for the same anti-collision reason.

## 5. Preserve every capability

Each of the three has a create action with its own label (`New lead` / `New directory entry` /
the Clients roster's own). **The create control must follow the active tab** — creating a lead
while looking at Directory is a defect.

**Diff the three pages' capabilities and state the result.** If something only one of them can
do would be lost by composing them, **say so and stop.**

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-onepeople`, branch `task/onepeople`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **You own `AppLayout.tsx`** unless `TASK-REVIEWNAV` or `TASK-PAGEVIS` has merged first —
  **rebase and check before you touch it.**
- **`TASK-DUPECENSUS` is running and will report these three as a duplicate group.** It changes
  no code, so there is no conflict — but **the owner has already ruled**, so its finding
  confirms rather than decides. Do not wait for it.
- **`DashboardPanel.tsx` is LEADCLEAN's**, freshly merged. **Leads on the dashboard are a
  different thing from the Leads tab here**: the dashboard shows *open inbound leads as cards*;
  this tab is the *LEAD-typed contact list*. **Do not merge those two concepts** — check the
  distinction holds and say so.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.**
- **Delete nothing.** `Admin.tsx` and `ContactsPage.tsx` both survive as components.
- **Do not change what any of the three lists display.** This is composition and routing.
- **T1 — arbitrary Tailwind values have silently emitted nothing here twice.** Grep anything you
  add out of the built CSS.
- No staff browser session exists and you will not be given one. Report the render as
  **NOT VERIFIED** with a numbered checklist.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. `/app/ops/contacts` renders one page with **Leads / Clients / Directory** population tabs.
2. Each tab is addressable by URL, and `/app/ops/leads` and `/app/ops/directory` redirect to
   their own tab — not to the page default.
3. The Clients tab keeps its roster cards, isolate interaction and **all nine per-person tabs**,
   and those read as a different layer from the population tabs.
4. The create control follows the active tab and keeps each one's own label.
5. The nav shows **one** Contacts entry; Leads and Directory entries are gone.
6. `CONTACTS_PAGE_RETIRED` is still `true` and the retired `contacts` mode is still unreachable.
7. No capability from any of the three is lost.

Report to `docs/reports/TASK-ONEPEOPLE-REPORT.md`.
