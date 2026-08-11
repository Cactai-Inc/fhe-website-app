# TASK ROSTERCARD — the one people page, as cards

**This finishes work that is already half-landed. Read this section before anything else.**

`TASK-ROSTER` delivered a positional **row** layout. The owner then replaced that presentation
with a **card** model. The orchestrator therefore merged **only the data layer** and held the
row frontend back rather than shipping a UI the owner had already redirected away from.

**So the state you are inheriting is deliberately split:**

| what | where | status |
|---|---|---|
| `admin_client_accounts()` — 20 columns, no-arg | **production + `main`** | **LIVE, use it** |
| `roster_service_slots()` | **production + `main`** | **LIVE, use it** |
| the positional-row frontend | branch `task/roster` only | **superseded — read it, do not merge it** |

**Do not re-do the database work.** It is applied in production and reconciled: 15 CONTACT +
6 LEAD + 4 TEAM = 25 live contacts, exact. Read `docs/reports/TASK-ROSTER-REPORT.md` for what
each column means, and the *"consumed"* definition it had to invent.

`task/roster` is worth reading for its aggregate handling and its `ContactsPage` retirement
mechanics. **Its row presentation is dead. Do not port it.**

---

# WHAT THIS PAGE IS FOR

Owner, verbatim:

> *"the things that matter most right now are who is active and who isnt, inactive then makes
> me wonder if they were invited or not, if the invite expired, if they docs are done… i
> should be able to glance at the grid of cards and spot the problem children and the
> standouts that are engaging the most."*

**It is a triage view, not a directory.** Every decision below serves spotting the stuck and
the most-engaged at a glance. If a piece of information does not help do that, it does not
earn its place on the card.

---

# THE SETTLED MODEL — all of this is owner-ruled, none of it is open

```
RING      grey lead · gold client/customer · green guest     ONE source per state
BADGES    rider · horse owner · deal-only party              DERIVED ONLY, never tags
NAMES     horses owned, horses leased
COUNTS    orders · credits · lessons
ACTIVITY  last-active timestamp · green dot < 1hr            ACTIONS, not sessions
FLAGS     only where he can act TODAY
PAIR      parent <-> dependent, both cards, both names
EXCLUDED  TEAM, LEAD
FORMAT    ContactsPage CARDS
```

## 1. The avatar ring replaces the avatar fill

Owner: *"maybe instead of the card doing the work for the category indication, we can use the
avatar ring and stop with the green fill, we can use a gold ring for a client or customer and
a green ring for a guest, and a grey ring for a lead."*

`ContactsPage.tsx:347` currently renders `w-11 h-11 rounded-full bg-green-100 text-green-800`
— **a green fill on every avatar regardless of who the person is.** That fill goes. The ring
carries the state instead, and it is the **only** thing that carries it: no card border tint,
no second colour cue. One source per state.

**Two-letter initials stay** (`initials()`, line 134). Owner ruling, already settled:
two letters internally for admin surfaces, one letter for the user-facing avatar. **Do not
"fix" this into consistency** — Claire compared both and picked the single letter for the
user-facing case; these are deliberately different.

## 2. Badges are DERIVED. Tags are not badges.

Owner: *"the card shows whats derived so we know the system is accurate."*

`groups` (RIDER / HORSE_OWNER / PARENT_GUARDIAN) is written **solely** by `apply_affiliations`
from executed documents and horse ownership. **That is the badge source.** A card showing a
derived badge is showing you that the system computed correctly — which is the point.

`contacts.tags` is free text a human typed. `ContactsPage.tsx:106` currently blends the two
into one visual row, so **a claim and a verification render identically.** That is the bug
underneath the owner's question *"why some cards show a badge with 'Rider' and others
'RIDER'"* — different sources, different casing, same-looking chip.

**Derived badges and free-text tags must be visually distinguishable at a glance.** Casing is
not the fix; casing is the symptom. Pick one casing for derived badges and apply it uniformly.

## 3. COUNTERPARTY on a dependent is wrong

Owner: *"the use of the COUNTERPARTY badge on a dependant when they are the RIDER is weird…
we should just label them as CLIENT and also as DEPENDENT with their Parent's name listed"*
and *"the Parent should list their Dependent's name. the title Parent and Dependent should be
included."*

```
child's card    CLIENT · DEPENDENT      Parent: Sarah Morgan
parent's card   CLIENT · PARENT         Dependent: Emma Morgan
```

**Both words appear. Both names appear. Both directions.** `CHIP_TONE` at
`ContactsPage.tsx:85-90` carries a gold `Counterparty` chip — that is the one being replaced
in this case.

## 4. Horses by name, not by count

Owner: *"their horse's name for owner and for leasing"* and *"if they are leasing a horse"*.
Owned and leased are **different relationships** and must not be merged into one list.

## 5. Activity means actions, not sessions

Owner: *"active now indicator with green dot (not auth session, but actually did something in
the app within the last 1 hr)"* plus *"the last active date maybe even timestamp"*.

**⚠️ `bookings` has NO audit trigger.** A client who booked a lesson this morning reads as
inactive. Use what audit coverage exists, and **state plainly in your report which actions
your last-active figure can and cannot see.** Do not add the missing trigger here — it is
folded into BOOKFLOW.

## 6. Flags only where he can act TODAY

Owner: *"no need for a negative indicator, unless its to show they havent completed signup or
their invite wasnt claimed. etc..."*

Unclaimed invite · expired invite · incomplete signup · outstanding documents · unpaid.
**Nothing else.** A flag he cannot act on is noise, and noise is what makes a triage view stop
working.

## 7. TEAM and LEAD are excluded

Owner: *"team doesnt need to be listed in a clients menu"*, *"team is team. its internal its
part of the business not the people"*, *"its only me and claire for now and that isnt likely
to change any time soon."*

The RPC already implements this exclusion correctly (4 TEAM, 6 LEAD). **Do not widen it.**
Leads stay on the Leads page until worked.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-rostercard`, branch `task/rostercard`, off
  `origin/main`. **NEVER any clone under `~/Desktop`.**
- **No database work.** Both RPCs are live and reconciled. If you believe you need a column
  that does not exist, **stop and report** — do not add one.
- **Do not merge `task/roster`.** Read it; its presentation is superseded.
- **Do not push.** The orchestrator merges and pushes; a push to `main` is a release.
- **`ContactsPage` retirement** is already designed on `task/roster` behind
  `CONTACTS_PAGE_RETIRED` with a redirect and a hidden nav item. Port that mechanism — the
  card components are what you are building on, so **retire the page, keep the components.**
- **You have no staff browser session and will not be given one** (owner ruling 2026-08-10).
  Prove the RPC output and the built CSS; report the render as **NOT VERIFIED**. A psql
  snapshot fed through real components is a harness, not a render — say so if you build one.
- **UIBUILD owns `AppLayout.tsx` and is actively working in it.** If you need a nav change,
  **report it** rather than editing — it becomes a UI order.

# REPORT

`docs/reports/TASK-ROSTERCARD-REPORT.md`. Reconcile at least three card shapes against direct
SQL (a rider, a horse owner, a parent/dependent pair), and split verified from assumed.
