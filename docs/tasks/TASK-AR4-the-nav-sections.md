# TASK-AR4 — the nav sections: renames, moves, and the death of Settings

⚠️ **READ `docs/method/ADMIN-REVIEW-ANALYSIS-STANDARD.md` FIRST.** **You are writing a report. You are
fixing nothing.**

**Owner, 2026-08-29 — three items, one taxonomy:**
> *"5) Move the Calendar link from app pages to management section. Retitle App Pages section to
> Community."*
> *"6) Retitle the Community section (the one with "Activity, Evaluations. Moderation, Field options,
> Content store, Oversight) to Admin and move evaluations to the management section."*
> *"8) Move the pages from the settings section into the newly renamed Admin section and remove the
> settings section."*

⚠️ **These are one task because they are one rename chain over one file.** Done separately they
collide, and the order matters: **Community must become Admin BEFORE App pages becomes Community**,
or there are two sections called Community.

---

## 1. WHAT EXISTS TODAY — verified 2026-08-28, and the first trap is here

**The nav groups are string literals in `src/components/app/AppLayout.tsx`, lines 633-649:**

```
{ key: 'management', label: 'Management', items: visible(MANAGEMENT_GROUP), defaultOpen: true }
{ key: 'accounts',   label: 'People',     items: visible(ACCOUNTS_GROUP),   defaultOpen: true }
{ key: 'community',  label: 'Community',  items: visible(COMMUNITY_GROUP) }
{ key: 'settings',   label: 'Settings',   items: visible(SETTINGS_GROUP) }
{ key: 'modules',    label: 'Modules',    items: visible(MODULES_GROUP) }
```

⚠️ **AND `GROUP_LABEL` IN `pageRegistry.ts:106` DEFINES THE SAME FIVE LABELS AND IS READ BY
NOTHING.** Verified: zero readers outside its own file. **Two definitions of one fact, one of them
dead.** Renaming the dead one changes nothing on screen — **this is exactly the silent no-op class in
`ORCHESTRATOR.md` §3, and it is sitting directly in your path.** Report which is authoritative and
whether the dead one should be deleted or wired.

**The App-pages group is different again — hand-written, not from the registry:**
`AppLayout.tsx:1488` — `const APP_PAGES_GROUP: NavGroup = { key: 'app-pages', label: 'App pages',
items: [], defaultOpen: true };` — and `pageRegistry.ts:125` explains why: *"it is hand-written JSX,
not a NavItem table, so it has no row to filter."* ⚠️ **So moving Calendar out of App pages and into
Management is moving it from hand-written JSX into a registry-driven group** — a different kind of
change from a label swap, and it is the fix for the calendar's missing registry row (D17's original
instance).

**Current membership, from `pageRegistry.ts`:**
- **community** (→ becomes **Admin**): Activity · Evaluations · Moderation · Field options ·
  Content store · Oversight
- **settings** (→ dissolves into Admin): Branding · Editor · Products · Team
- **management** (→ receives Calendar and Evaluations): Dashboard · Support · Payment review ·
  Lessons · Lesson plans · Lesson credits

## 2. THE QUESTIONS YOUR REPORT MUST ANSWER

1. ⚠️ **Which definition of the group labels actually renders?** Prove it. Then say what happens to
   the other one.
2. **What is the exact, ordered sequence of renames and moves** that never leaves two sections
   sharing a name at any intermediate step?
3. **Where does Calendar's registry row go**, and what does it take to move it out of the
   hand-written block? ⚠️ **Does Catalog have the same problem?** It is in that block too.
4. **After Settings dissolves, is "Admin" coherent?** It would hold Activity, Moderation, Field
   options, Content store, Oversight, Branding, Editor, Products, Team. ⚠️ **Team is people, not
   admin config, and D20 ruled Team is the one roster of who works here. Does it belong in Admin?
   Report the tension; do not decide it.**
5. ⚠️ **Both nav surfaces, every time.** Desktop rail and mobile drawer both live in `AppLayout.tsx`.
   **A change that lands on one and not the other is the defect this task exists to prevent** — and
   the owner's working device is a phone. **Name the line numbers for both.**
6. **What is `visible()` doing?** Every group is filtered through it. **Establish what it gates on —
   module flags, role, page visibility — and whether a moved page keeps its visibility rule.**
   ⚠️ **A page that moves section and silently becomes invisible is the worst outcome here.**

## 3. THE TRAPS

⚠️ **`AppLayout.tsx` IS 2,217 LINES AND CONTAINS ALL THREE NAV SURFACES** — member rail, staff rail,
mobile drawer. **It is the single most contended file in this whole review.** AR3 and AR5 both want
it. **Your contended-files list is how ORCH6 sequences the builds; be exact.**

⚠️ **`mod.*` module flags gate some rows** (`module: 'mod.lessons'`, `'mod.boarding'` …). **D20's
lesson is that a stale claim about a module being off cost a task real work.** **Query `org_modules`;
do not read a comment about it.**

⚠️ **The Review section is deliberate.** `pageRegistry.ts:122` — *"the Review rows themselves — nav
position IS their status, and hiding one would falsify the acceptance signal."* **Do not propose
folding Review into Admin without saying what happens to that signal.**

⚠️ **D13: the owner must be able to change things without a developer.** There is a page-visibility
admin surface. **Ask whether section membership should be data rather than string literals** — and
note D13's recorded exception (a self-arranging surface needs no editor) before proposing one.

⚠️ **Item 7 — merging Activity and Oversight — is `TASK-AR6`.** Both are in the section you are
renaming. **Report the dependency; do not evaluate the merge.**

## 4. OUT OF SCOPE

Building anything · the Activity/Oversight merge (AR6) · module pages moving to the account page
(AR5) · Contacts and My Stable as new rows (AR3) · what the calendar page itself does (AR1).

## 5. REPORT

`docs/reports/TASK-AR4-REPORT.md`, standard §4 shape. Worktree `wt-ar4`, branch `task/ar4`.
**Commit the report only. Do not push.**
