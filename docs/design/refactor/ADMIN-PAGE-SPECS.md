# ADMIN-PAGE-SPECS — what each surviving surface is, holds, and does

Companion to ADMIN-IA.md. Tokens: the real ones only — green-800/green-900 ink, gold-600
accent, cream background scale, Libre Caslon Text for the serif voice; tailwind.config.js and
src/index.css are the authority. Layout: every page renders the shared shell — PageHeader
(back target, title, actions), content region built from the shared primitives (section, form
grid, table/list shell, detail drawer, action bar). No page hand-rolls spacing or breakpoints;
fluid spacing, content-driven wrapping. Every value-moving action uses the Commit primitive
(states itself, records itself, undoable — D19) and calls engine RPCs only (D18). Every zone
and list self-hides when empty with the quiet line pattern the dashboard already uses.

## Dashboard (/app/dashboard)
Landing for both accounts. Two views per D26, toggle + default mechanism as built. Zones render
from the zone registry, self-hiding, ordered time → money → people waiting → record hygiene →
stable → documents → FYI. No per-user editor (owner-ruled). Each zone header links to the
owning surface; each row resolves to a real route (the reach helpers). Refactor work here is
verification and link repair after the route changes — not redesign. The seven unbuilt zones
stay unbuilt except where PROGRESSION-PLAN.md gives Notes/Plans real data; their rail positions
are not reserved in the nav (they were dashboard zones, not pages).

## Calendar (/app/calendar) — REBUILD, substantially rewritten 2026-08-24

Per ADMIN-IA.md §8: this is Claire's primary working surface, not a peer Work-zone entry. Owner
ruling, verbatim where it matters, verified against the live component before any of it was
written down as spec.

### View modes
Week (default — "she likes a zoomed out weekly view"), Day, and Month, all useful, all kept.
Scope control as a view toggle on one page, not separate routes.

### The standing-open-slots removal (the big change)
> "The big change we need to see on the calendar is removing all the standing open spots as if
> they are something that needs to be shown and just have a blank calendar with the ability for
> anyone to put in a request for something at a time that doesnt have something already there."

Today `itemLabel()` (`CalendarPage.tsx:126`) returns `'Open'` for every `status === 'available'`
row, rendering the grid full of visible "open slot" chips. **Remove these as visible items
entirely.** The calendar shows only what's actually scheduled; everywhere else is simply blank
and requestable. Availability becomes a background rule (business hours / staff schedule), never
an individual item on the grid — this was already the direction of the prior thread's
"Availability & hours... not 275 green pseudo-bookings on the grid" finding; this ruling confirms
and finishes it.

### The two creation paths

**Client-side (request):** a client may request anything in the catalog, at any open time. If
they don't hold a credit for it, **the payment screen appears when Claire approves the
request** — not at request time. Request → staff approval → (if needed) client sees the
Zelle/cash screen.

**Staff-side (direct create), the fuller path:**
1. Claire picks the offering, the person it's for, and the horse (when relevant).
2. She adds a lesson plan and notes **at creation**, not necessarily after (the Lesson Plan
   surface below is where this actually happens — see that section).
3. On save, the client is notified of their scheduled activity.
4. If payment is owed (credits system, unchanged), the client sees the Zelle/cash screen; when
   they click "I paid," **the calendar item stays PENDING** until staff (Claire or the owner)
   confirm payment.
5. Once confirmed, the item flips to booked/scheduled, and — this is the label fix — **its
   displayed name changes to the real thing**: category-level for lessons ("Riding Lesson with
   Melissa", D25's existing high-naming rule), specific-offering-level for horse care ("Turnout —
   [Horse]", D25's existing low-naming rule).

**Horse care, day-only:** when the exact time doesn't matter (D25 already rules horse-care
clients pick month/week/day, never a timeslot), Claire can create the item with just a day, no
time. **New:** she can also choose to suppress the notification entirely for this item — no
email, no dashboard push — for routine care that doesn't need the owner's awareness or a payment
trigger.

### The label fix (verified bug, not a request to take on faith)

`itemLabel()` in `CalendarPage.tsx` deliberately returns an opaque label ("Reserved") for any
item where `!item.is_mine` — correct for a CLIENT viewer (so one client can't read another's
private calendar), **wrongly applied to staff too**. `isStaff` already exists as a local variable
in this component (`const isStaff = data?.role === 'staff'`) and gates several other UI elements,
but is never passed into `itemLabel()`. Fix: staff always see the real D25-correct name; the
opacity rule stays exactly as-is for client viewers looking at someone else's item.

### Panel → modal

> "why are we using a panel on a desktop it should be a full modal so we have room to work"

`CalendarItemPanel.tsx` renders at `w-full sm:max-w-md h-full` — a narrow, fixed-width side panel
even on desktop. **On desktop, this becomes a full modal.** The three existing top-of-panel
category tabs (`offering` / `appointment` / `unavailable`, labeled "Session" / "Appointment" /
"Unavailable" in the current code) are the right structure and are kept — the complaint is the
container's size, not its content organization. Mobile keeps the current full-height sliding
panel (already effectively full-width there).

### The activity report is a separate surface, not a tab on the booking/edit panel

> "For all things on her calendar the activity report is a separate surface from the booking or
> editing of a booking surface. it should be a full page or a full size modal that she uses."

Two distinct surfaces per calendar item, never combined:
1. **Booking/edit** — the modal above: offering, person, horse, time, notification setting.
2. **Activity report** — a full page or full-size modal, separate, for recording what actually
   happened (see PROGRESSION-PLAN.md's Session Write-Up, substantially expanded 2026-08-24).

### Deep links, unchanged
`?on=YYYY-MM-DD` and `?item=<id>` (the dashboard's reach mechanism into the calendar) are kept
as-is; they open the correct week/item once the rebuilt grid loads.

## Lesson Plan — full page, not a field on the booking panel

> "the lesson plan is a full page of it for selecting what will be the focus, adding notes for
> before the lesson so the rider can read them, and the rider has space to write notes too for
> claire to read ahead of a lesson."

A dedicated full-page surface, reachable from a calendar item once it's created:
- **Focus selection** — drawn from the progression curriculum's rider frontier
  (PROGRESSION-PLAN.md), Claire adjusts.
- **Pre-lesson notes, Claire → rider** — visible to the rider ahead of the lesson.
- **Pre-lesson notes, rider → Claire** — the rider has their own space to write notes Claire
  reads before the lesson starts. Bidirectional, both sides write, both sides read the other's
  side ahead of time.

This is the same surface PROGRESSION-PLAN.md's "LESSON PLAN" entity describes; this page spec is
the UI for it. See that file for the milestone/proficiency model that the post-lesson half of
this flow feeds.

## People (/app/people)
Tabs: Clients, Leads, Partners, Vendors, Archived. One list shell, per-tab columns and filters;
?open= resolves a person into the detail drawer (existing Admin.tsx behavior carried over — see
ADMIN-IA.md's correction: Admin.tsx is live, not dead, and this replaces its role rather than
deleting an already-retired file). Detail drawer tabs: profile, engagement (purchases, credits,
sessions), documents, evaluations (D27), timeline. Actions: create person (email-minimum),
invite to activate (AccountInvitePage flow), promote per D5/D8 markers, archive per D11 (never
purge). Fix the Clients 400 in this wave. Leads tab holds the reply-waiting queue the dashboard's
C4 links to.

## Horses (/app/horses)
One list of every horse (the All view is genuinely all). Detail (HorsePage) tabs: profile,
health (HorseHealthPage content), parties/relationships (HorsePartiesPage content), documents,
evaluations (D27), workload/rest state. Create horse from list and Create sheet. Microchip dedup on create.

## Documents (/app/documents)
The staff document desk: queue (needs attention: unsigned, pending countersign, holds) and
library (all documents, filterable by person, horse, template, status). Viewer stays the detail
route. Contract creation stays NewContractPage; contract detail stays ContractPage with its
Commit-pattern actions. Templates are edited in Admin > Templates, never here (D12 split).

## Deals (/app/deals)
DealsPage list + DealPage detail as built (they are the D19 reference pattern). Acquisition
intake becomes a creation flow here. Party add is inline; a party needs no pre-existing
designation beyond what the current model requires (full identity fix is the rebuild's).

## Lessons (/app/lessons)
Tabs: Sessions, Plans, Credits, Packages.
- Sessions: the day/period list, complete + write-up flow (SessionActivityForm), schedule
  (ScheduleSessionForm).
- Plans: composed from the progression curriculum (PROGRESSION-PLAN.md) — select rider(s),
  system proposes the next skills from each rider's frontier, trainer adjusts, saves. Free-text
  note optional, never required. **Note the full-page Lesson Plan spec above supersedes the
  brief description this bullet used to carry — see that section.**
- Credits: the ledger plus grant/comp/bill/undo via Commit (TASK-CREDITGRANT behavior kept).
- Packages: as built.

## Money (/app/money)
Payments review (declared vs verified, confirm/reject with Commit), board charges, links into
the credits ledger and orders. Every figure traceable to ledger rows; verified-only sums
labeled as such (declared amounts shown separately, never summed in).

## Boarding, Barn Ops, Employees
Each one surface with tabs (Agreements/Charges/Facilities; Resources/Consumption/Allocation
rules; Staff/Schedule). Content as currently built, restyled onto the shared shell; hub cards
gone; registry keys carried onto the merged surfaces.

## Community: Activity, Compose, Moderation, Messages
- Activity: the read of what the app has been doing (B6's target), member activity feed
  oversight.
- Compose: block editor for articles/guides/posts (title, cover, body blocks, attachments),
  draft/preview/publish into content_posts; library view lists drafts, published, archived.
- Moderation: as built, author join fixed.
- Messages: staff messaging as built, registry row added.

## Admin zone: Templates, Forms, Products, Branding, Team, Modules, Field options, Page
## visibility, Oversight
As built, restyled onto the shell, each with a registry row. Team's save-confirmation fixed.
Field options (lookups) is the D13/D21 editor home — vocabulary-backed inputs write codes from
these menus, never free text. Registry page's scope verified before placement.
