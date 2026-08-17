# DECIDE — every flagged item that survived machine-closing

**This is your keep-or-remove sheet.** Go down it saying *keep* or *remove*. Nothing here has been
decided for you; nothing was removed except on evidence, and the evidence for each removal is in
`CLOSED.md` next door.

```
975 raw flags  →  609 families (deduped within and across all 8 slices)
                  ─ 61 machine-closed (resolved / superseded, evidence in CLOSED.md)
                  ─ 13 duplicate pointers folded into another family
                  = 535 awaiting your decision
```

**Rank split of the 535:** rank 1 live defect **19** · rank 2 security or data integrity **72** ·
rank 3 blocked or owed a decision **147** · rank 4 unviewed inventory **41** ·
rank 5 correctness/consistency **131** · rank 6 cosmetic/cleanup/record-only **125**.
**14 are flagged `MOOT?`** — the screen they concern is being rewritten this week.

## Every rank-1 item, by title
1. The ops document viewer offers a Sign button that always errors for an individual party
2. Two documents point at a contract that no longer exists — signing either one will error
3. …and any second staff action on those two documents aborts as well
4. A member's document count says 13 on one page and 5 on another
5. A blank insurance status prints as if the Lessee promised coverage
6. Every lease prints "shall not exceed the Horse's current fair market value of." with nothing after it
7. An active contract template would print raw {{placeholders}} to a signer
8. Two more active templates have completely empty bodies
9. The retainer and representation agreements cannot produce a complete document
10. Money in a draft renders as a bare number every time it is re-composed
11. Creating a person files them on the wrong list whatever tab you used
12. Every row of the instructor's day is named "Client"
13. Editing one field of a calendar booking silently wipes four of its links
14. Contact preferences save on every keystroke and swallow the failure
15. The member dashboard shows "you're all caught up" when a read fails
16. The horse-care page's main button goes to a page that does not exist
17. The calendar's "Review & sign paperwork" button goes to a page that does not exist
18. A cancelled lesson still shows as Scheduled on the instructor's page
19. The staff "Resend" button on a gift has never sent an email

## Every rank-2 item, by title
Grants/exposure: the schema still grants every new database function to the public · a revoke that
does not name all three roles silently does nothing · ~48 functions were never audited · 76 of 285
functions enforce no rule · 45 left unenforced by design · the authenticated surface never measured
· the guard idiom keeps being re-written · the co-buyer remover deletes parties with no check and
asserts the lock too late · the field-mutator family can rewrite any contract · four functions are
protected only by a NOT NULL column · document/deal/horse readers leak by id · a document creator is
granted to the public · one function's NULL-uid branch is a latent hazard · argument-taking
predicates never checked · one admin document reader is still public.
Data access: the directory still publishes legacy phone/email columns behind flags nothing can set ·
the directory view still bypasses row security · a member could repoint their profile at another
person's record · profile insert is unguarded · the public role still holds write grants on profiles
· contact self-update has no column limit · the admin email field is free text and the email-change
proof trusts it · the dossier returns the whole row · staff-role mismatch on person records ·
two-factor is unreachable · nothing creates a profile at signup.
Documents: a real signer's own documents were invisible · contracts and party-controls tables have
row security with zero policies · two signed vet authorizations name no horse.
Lease text: a document that says the Lessor carries all risk and the Lessee carries mortality ·
medical statements that contradict each other in one numbered item · a policy named two items below
a line saying it does not exist · two owners of the same loss · a Lessee election that un-makes
itself · the Lessor can write the Lessee's own promises · a waiver that leaves stale values behind ·
one predicate duplicated in two places · a new column silently dropped.
People/data: expired invitations never expire · eight of nine pending clients were never invited ·
the account spine has no test coverage · a microchip of "N/A" hijacks the next horse · the platform
owner holds a tenant record · three profile rows violate two foreign keys · email lives in three
places unreconciled · names diverge between the two copies · two onboarding paths overwrite each
other · standing categories are wiped at account activation · a trigger references a dropped column
· the brand site URL points at a dead domain · the mail send has no timeout · a dismissed alert
leaves no trace · three promised notifications have no producer · two API routes hardcode the
tenant's name · files are still hard-deleted on "remove" · storage is org-gated but not path-scoped
· half the fulfilment ledger is orphaned · the replica-mode cleanup practice is still the standing
hazard · the invitation spine still supersedes on every call.

---

# ⚠ FLAGGED MOOT? — the surface is being rewritten this week

These are technically open and practically overtaken. Clearing them first shrinks everything below.
**The judgement is yours** — the in-flight task that overtakes each one is named.

### M1. Nobody has looked at the public acquisition page
what:     Nobody has ever looked at the Find-a-Horse page or the shop on a screen.
where:    Public site — /acquisition, /shop
raised:   1 report, 2026-08-12 · sources: TASK-COUNTFIX-REPORT.md
checked:  The reason it was empty is fixed (src/lib/publicCatalog.ts:22-29); the page itself is still unseen.
rank:     3
moot?:    ASKRIGHT rewrites the questions/submission pages behind this funnel — look at the new one.
if kept:  Open both pages once after the rewrite lands.

### M2. The care page's main button goes nowhere
what:     "Request a service" on the horse-care home goes to a page that does not exist.
where:    Member app — Horse care home
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  src/pages/app/CareHome.tsx:70 links to /horse-care; grep of src/App.tsx finds no such route. Still broken.
rank:     1
moot?:    CAREPATH rewrites the horse-care enquiry path end to end.
if kept:  One line, but CAREPATH will replace the page — worth confirming it fixes it.

### M3. Two surfaces duplicate the member's horses and orders
what:     The acquisition home and care home are half-wired pages that duplicate other screens.
where:    Member app — /app/deal, /app/care
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Both still routed and still unlinked from the nav; CareHome's horses list still duplicates My Stable.
rank:     3
moot?:    CAREPATH and the flow program rewrite both of these surfaces.
if kept:  Decide after the rewrite whether either page survives.

### M4. The one-price-and-one-enquiry cart has never been seen
what:     A basket holding one priced item and one "price on enquiry" item has never been looked at.
where:    Public checkout
raised:   1 report, 2026-08-12 · sources: verified-IDENTITY.md ID-60
checked:  src/lib/cart.ts:16-17 and src/pages/Checkout.tsx:570 unchanged; no test, no screenshot.
rank:     4
moot?:    The checkout is inside the flow program's rewrite.
if kept:  One screenshot of the new checkout.

### M5. The older service picker carries accessibility the newer one lacks
what:     If the older service picker is retired, its screen-reader behaviour and per-item hint must be carried across first.
where:    Public funnels — Book Rider, Book Support
raised:   1 report, 2026-08-12 · sources: verified-IDENTITY.md ID-17
checked:  src/components/ServiceSelector.tsx is still live at src/pages/BookHorse.tsx:119 and BookSupport.tsx:132; the newer renderer still has none of those attributes.
rank:     4
moot?:    ASKRIGHT/CAREPATH replace these funnels — carry the behaviour into the replacement.
if kept:  A checklist item on whichever task retires it.

### M6. The catalog page has no add control, deliberately
what:     The catalog browse grid deliberately has no page-level "add" button.
where:    Member app — Catalog
raised:   1 report, 2026-08-06 · sources: TASK-PLUSPASS-REPORT.md
checked:  Still true and still deliberate; the page is a browse grid with per-item actions.
rank:     6
moot?:    SESSIONBOOK/ASKRIGHT change what the catalog is for.
if kept:  Nothing to do — this is a record.

### M7. The lessons page's three child screens have no nav rows
what:     Three lesson screens exist as URLs with no menu row, so they cannot be shown or hidden.
where:    Staff app — Lessons
raised:   1 report, 2026-08-12 · sources: TASK-PAGEVIS-REPORT.md
checked:  grep of AppLayout.tsx and pageRegistry.ts for the three routes → zero hits. Unchanged.
rank:     3
moot?:    LESSONREQUEST/SESSIONBOOK rework the lesson surfaces.
if kept:  Decide whether the three are real pages after the rework.

### M8. The instructor's calendar default start time was invented
what:     "+ Booking" guesses a start time because no blank booking flow existed to reuse.
where:    Staff app — Calendar
raised:   1 report, 2026-08-06 · sources: TASK-PLUSPASS-REPORT.md
checked:  src/pages/app/CalendarPage.tsx still defines and calls nextBookableSlot(); no ruling recorded.
rank:     3
moot?:    SESSIONBOOK builds the real booking entry point.
if kept:  One function either way.

### M9. The booking hours arithmetic was never run against real hours
what:     The business-hours maths behind that default was only tested with empty hours.
where:    Staff app — Calendar
raised:   1 report, 2026-08-06 · sources: TASK-PLUSPASS-REPORT.md
checked:  The read path (src/lib/ops/api-calendar.ts) is unchanged; not exercisable from a database connection.
rank:     4
moot?:    Same rewrite as M8.
if kept:  Fold into the browser pass.

### M10. The horse intake form's disabled-field colour is unresolved
what:     The greyed-out "N/A" fields on the horse form use a colour nobody approved.
where:    Member app — horse intake form
raised:   1 report, 2026-08 · sources: TASK-HORSEINTAKE-REPORT.md
checked:  src/components/app/HorseIntakeForm.tsx:34 still uses the shared disabled tan; the file is untouched since the baseline.
rank:     3
moot?:    The flow program rewrites /horse and its intake.
if kept:  One class, four options already prepared.

### M11. The horse form's error outline may be too quiet
what:     The red outline shown on an invalid field may be too faint to notice.
where:    Member app — horse intake form
raised:   1 report, 2026-08 · sources: TASK-HORSEINTAKE-REPORT.md
checked:  Four sites in HorseIntakeForm.tsx still share border-red-400; file untouched since the baseline.
rank:     3
moot?:    Same rewrite as M10.
if kept:  One token, four sites.

### M12. Twenty-eight built form definitions are read by one admin page
what:     Twenty-eight stored form definitions are read by a single admin screen and nothing else.
where:    Staff app — Forms admin
raised:   2 reports, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Prod: 28 rows in form_definitions; a per-booking form instance table now exists (booking_forms) from the LESSONFORM work.
rank:     4
moot?:    ASKRIGHT owns questions-per-offering; THREEFORMS was retired.
if kept:  Decide which of the two form systems survives.

### M13. The lead inbox content merge was never built
what:     The plan to dissolve the Inbound list into Leads as contact records was never built.
where:    Staff app — Leads / Inbound
raised:   1 report, 2026-08-10 · sources: TASK-UIBUILD-LOG.md
checked:  The nav half shipped; the content merge has no implementation in src/.
rank:     3
moot?:    LESSONREQUEST reworks request-to-first-lesson, which is the same queue.
if kept:  Re-specify against whatever LESSONREQUEST leaves behind.

### M14. Three permitted riding activities gate nothing
what:     Choosing lessons, solo arena riding or training changes only a printed word list.
where:    Lease document — permitted use / insurance
raised:   2 reports, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod clause defs unchanged since the report; the three activities still produce no risk clause.
rank:     5
moot?:    The permitted-use reorganisation already specified for the lease supersedes this wording.
if kept:  Fold into that reorganisation rather than doing it alone.
