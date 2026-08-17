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

---

# RANK 1 — LIVE DEFECTS

### 1. A Sign button that always fails
what:     Staff are offered a Sign button for every unsigned party, but pressing it errors for anyone who is not the company.
where:    Staff app — document viewer
raised:   2 reports, earliest 2026-08-05 · sources: TASK-ONEAUTHOR-REPORT.md, TASK-COSIGN-REPORT.md
checked:  src/components/ops/documents/SigningPanel.tsx still renders a row per unsigned party; record_signature in prod still admits staff only for the org's own company contact. Unchanged since the report.
rank:     1
moot?:
if kept:  Either hide the button unless the caller may sign, or widen who may sign on a party's behalf.

### 2. Two documents will error the moment anyone signs them
what:     Two documents ready to sign point at a contract record that no longer exists, so signing either one fails outright.
where:    Staff app — Beaumont's horse documents
raised:   3 reports, earliest 2026-08-10 · sources: TASK-SUPERSEDE-REPORT.md, TASK-CONTRACTORPHAN-REPORT.md, TASK-GUARDREST-REPORT.md
checked:  Prod: `select count(*) from documents d where d.contract_id is not null and not exists (select 1 from contracts c where c.id=d.contract_id)` → **2**. Still armed.
rank:     1
moot?:
if kept:  Choose: clear the contract link on those two, or delete and regenerate them.

### 3. …and any other staff action on those two aborts too
what:     It is not only signing — archiving or editing those two documents fails the same way.
where:    Staff app — same two documents
raised:   1 report, 2026-08-11 · sources: TASK-CONTRACTORPHAN-REPORT.md
checked:  Same two rows as item 2; the foreign key is still validated, so the abort condition is unchanged.
rank:     1
moot?:
if kept:  Fixed by the same decision as item 2.

### 4. One member, two different document counts
what:     A member's paperwork count reads 13 on one page and 5 on another, both labelled the same to them.
where:    Member app — My Documents vs the acquisition home
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Both readers still exist and count different populations (my_documents vs my_contract_documents in prod); the void filter was added to the second but the population difference stands.
rank:     1
moot?:
if kept:  Decide which number a member should see, then have one reader serve both pages.

### 5. A blank insurance answer prints as a promise
what:     Leave an insurance status blank and the lease prints a sentence that reads as though the Lessee promised coverage.
where:    Lease document — insurance section
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod clause bodies and the composer are unchanged since the report; six fields behave this way.
rank:     1
moot?:
if kept:  Either refuse to compose a blank status or print an explicit "not stated".

### 6. Every lease ends a sentence mid-air
what:     A money sentence prints on every lease even when the value is optional, leaving "…fair market value of." with nothing after it.
where:    Lease document — limitation of liability
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Unchanged in prod clause defs; the clause is unconditional.
rank:     1
moot?:
if kept:  Gate the clause on the value being present, or make the value required.

### 7. An active template would print raw placeholders to a signer
what:     One live contract template has a full body and no field wiring at all — generating it would show a signer raw {{…}} text.
where:    Templates — Minor Rider
raised:   2 reports, earliest 2026-08-01 · sources: TASK-TOKENAUDIT-REPORT.md, PROMPT_A_STAGES_1-3.md
checked:  Prod: MINOR_RIDER `active = t`, body 5,481 bytes, **0** token rows. No document has ever been generated from it.
rank:     1
moot?:
if kept:  Deactivate it, or wire its 26 fields.

### 8. Two more active templates are completely empty
what:     Two templates staff can pick are marked active with no body text at all.
where:    Templates — Facility License, Independent Contractor
raised:   2 reports, earliest 2026-08-11 · sources: TASK-ONEAUTHOR-REPORT.md, TASK-TEXTEDIT-REPORT.md
checked:  Prod: both `active = t`, body length **0**.
rank:     1
moot?:
if kept:  Deactivate both, or write the bodies in the wording editor.

### 9. The retainer and representation agreements cannot be completed
what:     The money terms on two active agreements have nowhere to come from, so those documents can never be finished.
where:    Templates — Search Retainer, Transaction Representation
raised:   1 report, 2026-08-12 · sources: TASK-TOKENAUDIT-REPORT.md
checked:  Prod: the four fee tokens exist in active bodies with no field feeding them; unchanged.
rank:     1
moot?:
if kept:  Wire the four values, or take both templates out of the picker until they are.

### 10. Draft money renders as a bare number — FIXED, verify wording
what:     Editing a draft re-composed money amounts as plain numbers instead of currency.
where:    Any clause-built document while editing
raised:   1 report, 2026-08-02 · sources: PROMPT_A_STAGES_4-5.md
checked:  Prod: the re-compose function now calls the money formatter (`prosrc ~ 'fmt_money'` → true). The defect as reported is gone; nobody has looked at the rendered output.
rank:     1
moot?:
if kept:  One screenshot of a draft with money in it.

### 11. New people land on the wrong list
what:     Add someone from the Leads, Vendors or Partners tab and they are filed as a plain contact, so they appear on the Clients list instead.
where:    Staff app — Records (all people tabs)
raised:   4 reports, earliest 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md, TASK-REVIEWNAV-REPORT.md, TASK-RECORDS-REPORT.md
checked:  src/components/ops/contacts/ContactForm.tsx still sends no type (grep for contact_type → 0 hits) and src/lib/api.ts:1028 is a bare insert; the column default is 'CONTACT'. Unchanged.
rank:     1
moot?:
if kept:  Pass the tab's type into the create call — one line plus the form's prop.

### 12. Every row of the instructor's day says "Client"
what:     The instructor's list of today's lessons shows "Client" as the person on every single row.
where:    Staff app — instructor home
raised:   1 report, 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE2.md
checked:  src/pages/app/InstructorHome.tsx:45 still returns `who: 'Client'` literally.
rank:     1
moot?:
if kept:  Join the person's name into that reader; the sibling mapper already does it.

### 13. Editing a booking wipes its links
what:     Editing part of a calendar booking silently clears its client, purchase, offering and horse.
where:    Staff app — Calendar
raised:   1 report, 2026-08-12 · sources: TASK-BOOKWRITE-REPORT.md
checked:  Prod: save_calendar_item's update still assigns all four keys flat, with no coalesce (`client_id = coalesce` → false).
rank:     1
moot?:
if kept:  Only overwrite a key the caller actually sent.

### 14. Contact preferences save on every keystroke and hide failures
what:     Typing in a contact-preference field saves on every character, and a failed save is discarded silently while the screen keeps the new value.
where:    Member app — Profile & preferences
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  src/components/app/profile/ProfileCard.tsx:130 still swallows the error; the fields still write on change, not on blur.
rank:     1
moot?:
if kept:  Save on blur, and show the failure.

### 15. A failed read reads as "you're all caught up"
what:     If the dashboard cannot load something, it shows the reassuring empty state instead of an error.
where:    Member app — Dashboard
raised:   2 reports, earliest 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md, TASK-COUNTFIX-REPORT.md
checked:  src/components/app/DashboardPanel.tsx still has 10 `.catch(() => …)` reads and no loading or error state.
rank:     1
moot?:
if kept:  One loading flag and one error branch, copied from the ops dashboard.

### 16. "Review & sign paperwork" goes nowhere
what:     A primary button on the calendar goes to a page that does not exist.
where:    Member app — Calendar
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  src/pages/app/CalendarPage.tsx:732 links to /app/contracts; src/App.tsx registers only `contracts/:id`. Still a 404.
rank:     1
moot?:
if kept:  Point it at My Documents.

### 17. A cancelled lesson still reads as Scheduled
what:     Lesson status labels never match, so a cancelled lesson shows as Scheduled on the instructor's page.
where:    Staff app — instructor home
raised:   1 report, 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE2.md
checked:  src/pages/app/InstructorHome.tsx:36 keys the chip map in lower case and :84 looks up the raw status; statuses are stored upper case.
rank:     1
moot?:
if kept:  Normalise the case at the lookup.

### 18. The gift "Resend" button has never sent an email
what:     Pressing Resend on a gift stamps a date and sends nothing, because no gift email exists anywhere.
where:    Staff app — Gifts
raised:   1 report, 2026-08-11 · sources: TASK-GIFTCREDITS-REPORT.md
checked:  No gift email path exists in api/ or src/ (unchanged); prod gifts table still holds 0 rows so nobody has been affected yet.
rank:     1
moot?:
if kept:  Build the gift email, or remove the button until it exists.

### 19. Activating an account wipes the person's standing categories
what:     When a person's account is activated, their rider/owner categories are deleted and re-derived — anyone whose categories were not derivable loses them.
where:    Identity — account activation
raised:   1 report, 2026-08 · sources: TASK-HORSEINTAKE-REPORT.md
checked:  Prod: 12 of the 18 people holding category rows have no account yet, and the sole writer (apply_affiliations) deletes before re-deriving. Same exposure as reported.
rank:     1
moot?:
if kept:  Make the re-derivation additive, or prove every category is derivable before activation.

### 20. Breed and colour cannot take a typed-in value
what:     "Other (enter manually)" for a horse's breed or colour can only fail — the columns only accept values from a list.
where:    Member app — horse intake
raised:   1 report, 2026-08 · sources: TASK-HORSEINTAKE-REPORT.md
checked:  Prod: both columns are still foreign keys into the lookup tables.
rank:     1
moot?:    The flow program rewrites /horse — but the database change stands either way.
if kept:  Allow a free-text value alongside the lookup, in the database.

---

# RANK 2 — SECURITY AND DATA INTEGRITY

### 21. Every new database function is public by default
what:     The database is configured so that every new function is automatically callable by anyone on the internet, which is the root cause of most of the security findings below.
where:    Database-wide
raised:   3 reports, earliest 2026-08-04 · sources: TASK-NOGUARD1-REPORT.md, TASK-C10-REPORT.md, TASK-NULLUID-REPORT.md
checked:  No migration since the reports changes the default (`grep pg_default_acl supabase/migrations` → newest is 20260807180000). Unchanged.
rank:     2
moot?:
if kept:  One migration changes the default; every function written afterwards is closed unless opened.

### 22. A revoke that names only one role does nothing
what:     Closing a function to the public silently fails unless all three roles are named — and this trap has caught four separate tasks.
where:    Database-wide (method)
raised:   5 reports, earliest 2026-08-07 · sources: TASK-NOGUARD1-REPORT.md, TASK-SECFIX-REPORT.md, TASK-INVITEWORKS-REPORT.md, TASK-INBOUNDALERT-REPORT.md
checked:  Confirmed still true in prod grants; the practice is written in four reports but nowhere enforced.
rank:     2
moot?:
if kept:  Put the three-role rule in CLAUDE.md and a check in the migration review.

### 23. About forty-eight functions were closed with the ineffective revoke
what:     Roughly forty-eight functions were "closed" using the method that does not work, and nobody has gone back to check them.
where:    Database-wide
raised:   2 reports, earliest 2026-08-07 · sources: TASK-NULLUID-REPORT.md, TASK-LEASEFORK-REPORT.md
checked:  Spot-checked 39 functions this pass: many are now genuinely closed (see CLOSED.md), but the full sweep has never been run and no migration since 2026-08-13 does it.
rank:     2
moot?:
if kept:  One query lists every function anon can still execute; the list is the work.

### 24. Seventy-six functions enforce no access rule at all
what:     An audit found seventy-six publicly reachable functions with no permission check, thirty-eight of which change data.
where:    Database-wide
raised:   1 report, 2026-08-07 · sources: TASK-NOGUARD1-REPORT.md
checked:  Partially reduced since: 14 of the named functions are now closed to both public roles (this pass). The audit's own list was never re-run.
rank:     2
moot?:
if kept:  Re-run the audit query, then fix by group rather than one at a time.

### 25. Forty-five functions were deliberately left open with reasons
what:     Forty-five functions were knowingly left without a permission check, grouped by reason, as work for a later phase.
where:    Database-wide
raised:   1 report, 2026-08-10 · sources: TASK-NOGUARD2-REPORT.md
checked:  The receipt-writer group is now closed (migration 20260816T2000); the document/deal/horse reader groups are unchanged (no migration since 2026-08-13 names them).
rank:     2
moot?:
if kept:  That third phase, scoped to the reader groups.

### 26. Nobody has measured what a free signup can reach
what:     Everything above is about anonymous callers; nobody has measured what any signed-up account can call, which is a bigger surface.
where:    Database-wide
raised:   4 reports, earliest 2026-08-07 · sources: TASK-NOGUARD1-REPORT.md, TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md, TASK-NOGUARD2-REPORT.md, TASK-NULLUID-REPORT.md
checked:  Confirmed this pass: functions like the contact dossier and person-record writer are still executable by any authenticated caller.
rank:     2
moot?:
if kept:  The same audit method, run against the authenticated role.

### 27. The co-buyer remover still asserts the lock too late
what:     A function deletes contract parties first and checks the signature lock afterwards, so an error handler could keep the deletions.
where:    Contracts — co-buyer
raised:   1 report, 2026-08-10 · sources: TASK-NOGUARD2-REPORT.md
checked:  Prod: the function is now closed to both public roles (anon and authenticated EXECUTE = false), so it is unreachable from a browser; the ordering inside it is unchanged.
rank:     2
moot?:
if kept:  Reorder two statements when that function is next touched.

### 28. Four functions are protected only by a NOT NULL column
what:     Four functions have no permission check and are stopped only by a column that cannot be empty — relax that column and they open.
where:    Community features
raised:   1 report, 2026-08-07 · sources: TASK-NOGUARD1-REPORT.md
checked:  No migration since the report names any of the four (grep of supabase/migrations; newest mention is 2026-07-28). Unchanged.
rank:     2
moot?:
if kept:  Four one-line guards.

### 29. Document, deal, horse and member readers leak by id
what:     Anyone who has a document, deal, horse or member id can read details they should not, through functions with no owner check.
where:    Contracts, deals, horses, community
raised:   2 reports, earliest 2026-08-10 · sources: TASK-NOGUARD2-REPORT.md, TASK-NOGUARD3-REPORT.md
checked:  No migration since the reports names any of them (grep; newest mentions are 2026-07-30 to 2026-08-07). Unchanged.
rank:     2
moot?:
if kept:  The deferred "phase C": one party-or-staff predicate applied per function.

### 30. A document-creating function is callable by anyone
what:     A function that creates documents is granted to the public, and it is not a definer function, so it was left alone as too big a decision for a migration.
where:    Documents
raised:   1 report, 2026-08-11 · sources: TASK-NOGUARD3-REPORT.md
checked:  Prod: generate_document still has EXECUTE for anon and authenticated.
rank:     2
moot?:
if kept:  Decide who may create a document, then grant accordingly.

### 31. A trigger's "no user" branch is a latent hazard
what:     The guard that protects roles and org membership returns success when there is no signed-in user — safe today only because it is a trigger.
where:    Identity — profiles
raised:   1 report, 2026-08 · sources: TASK-NULLUID-REPORT.md
checked:  No migration since the report touches it (newest mention 2026-08-07). Unchanged.
rank:     2
moot?:
if kept:  Invert the branch so absence of a user denies.

### 32. Predicates that take an id were never checked for the same trap
what:     Three permission helpers that take an id were never tested for the "no user" trap the others had.
where:    Documents, horses, platform
raised:   1 report, 2026-08 · sources: TASK-NULLUID-REPORT.md
checked:  No migration since 2026-08-11 names them. Unchanged.
rank:     2
moot?:
if kept:  Three short checks.

### 33. Row-security policies were never audited for the same trap
what:     The audit looked at functions, never at the row-security policies themselves.
where:    Database-wide
raised:   3 reports, earliest 2026-08-07 · sources: TASK-NOGUARD1-REPORT.md, TASK-NULLUID-REPORT.md, TASK-GUARDREST-REPORT.md
checked:  Unchanged; no migration since 2026-08-13 rewrites a policy predicate for this reason.
rank:     2
moot?:
if kept:  One pass over the policy list.

### 34. An admin document reader is still callable by anyone
what:     The function behind the staff document packet is executable by the public.
where:    Staff app — client documents
raised:   1 report, 2026-08-11 · sources: TASK-DOCPACKET-REPORT.md
checked:  Prod: admin_client_documents still has EXECUTE for anon and authenticated.
rank:     2
moot?:
if kept:  One revoke plus a caller check.

### 35. The member directory still publishes legacy phone and email columns
what:     The member directory still exposes older phone/email columns, hidden only by flags that no screen can set.
where:    Community — member directory
raised:   3 reports, earliest 2026-08-02 · sources: TASK-PROFILE-REPORT.md, TASK-ACCTEVAL-REPORT.md, PROMPT_A_STAGES_4-5.md
checked:  Prod: the view still selects them and no function writes the hide flags; the planned column drop was blocked by live readers and never happened.
rank:     2
moot?:
if kept:  Either give the flags a control, or finish the column retirement.

### 36. The directory view still runs with full database rights
what:     The member directory is a view that bypasses row-level security for whoever can reach it; only the anonymous grant was removed.
where:    Community — member directory
raised:   1 report, 2026-08-07 · sources: TASK-SECFIX-REPORT.md
checked:  Prod: neither public role now holds SELECT on the view (that half is fixed); the view still executes with owner rights. The design question is unanswered.
rank:     2
moot?:
if kept:  Either add directory-scoped read policies, or convert it to a function.

### 37. A member could point their account at someone else's record
what:     A member could re-point their own account at another person's contact record and gain read/write on it.
where:    Identity — profiles
raised:   2 reports, earliest 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md, TASK-SECFIX-REPORT.md
checked:  Prod: authenticated no longer holds table-level UPDATE/INSERT on profiles (the column-grant fix landed), so the described route is closed. What remains is that the anonymous role still holds INSERT and UPDATE on profiles (see item 39).
rank:     2
moot?:
if kept:  Nothing further on this specific route; item 39 is the remainder.

### 38. Creating a profile row is unguarded
what:     The protection on roles and org membership only runs on updates, so the first insert of a profile can set anything.
where:    Identity — profiles
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: the guard trigger is still BEFORE UPDATE only, and anon still holds INSERT on profiles.
rank:     2
moot?:
if kept:  Extend the guard to inserts.

### 39. The anonymous role can still write to profiles
what:     The not-signed-in role still holds insert, update and delete grants on the accounts table — dormant only because row security blocks it.
where:    Identity — profiles
raised:   2 reports, earliest 2026-08-07 · sources: TASK-SECFIX-REPORT.md
checked:  Prod: anon holds DELETE, INSERT, SELECT, UPDATE on profiles; authenticated holds DELETE.
rank:     2
moot?:
if kept:  One revoke, defence in depth.

### 40. A member can edit fields about themselves that no screen shows
what:     Through the API a member can change their own notes, tags, type, date of birth, guardian and emergency contacts.
where:    Identity — contacts
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: the self-update policy still has no column limit.
rank:     2
moot?:
if kept:  A column list on that policy, the same shape as the profiles fix.

### 41. The admin email field is free text and the email-change proof trusts it
what:     Staff can type any email into an account, and the email-change confirmation authenticates against that typed value.
where:    Staff app — team, and the email-change endpoint
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  api/email-change-complete.ts and the admin update path are unchanged since the baseline (not in the changed-file list).
rank:     2
moot?:
if kept:  Authenticate against the login record, not the editable copy.

### 42. The dossier returns the entire person record
what:     Opening a person's dossier sends the whole database row to the browser, including fields on no screen.
where:    Staff app — contact dossier
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: contact_dossier still returns the row as JSON and is still executable by anon and authenticated.
rank:     2
moot?:
if kept:  Return a named field list.

### 43. Two person-record functions give instructors what the tables deny them
what:     Two functions grant manager/employee access to person records that the table rules refuse — dormant only because no such account exists.
where:    Staff app — person records
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: both functions unchanged and still granted to both public roles; still no manager/employee account exists.
rank:     2
moot?:
if kept:  Decide the instructor's real reach, then align the two.

### 44. Two-factor authentication cannot be reached by any member
what:     Two-factor is enforced at sign-in but there is no screen where a member can set it up or turn it off.
where:    Member app — login and security
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  The settings component is still only mounted on the legacy /account page, which redirects members away; the security card contains no two-factor code.
rank:     2
moot?:
if kept:  Move the control onto the live security card.

### 45. Nothing creates an account record at signup
what:     A new signup has no account record until something else makes one, so two real accounts exist with no record at all.
where:    Identity — signup
raised:   3 reports, earliest 2026-08-11 · sources: TASK-NOGUARD3-REPORT.md, TASK-GUARDREST-REPORT.md, TASK-A-PARTY-VERIFY-2-REPORT.md
checked:  Prod: 13 account rows against 12 login records, and three rows fail their foreign keys (see item 51). No signup trigger exists.
rank:     2
moot?:
if kept:  A trigger at signup — flagged as needing your ruling because it changes who gets an org.

### 46. Contracts and party-controls tables have security on and no rules
what:     Two tables have row security switched on with no policies at all, so nobody but staff can read them.
where:    Contracts
raised:   2 reports, earliest 2026-08-07 · sources: TASK-WALLRETURN-REPORT.md, TASK-A-PARTY-VERIFY-2-REPORT.md
checked:  Prod policy list: contracts has only an org-boundary and a staff policy; document_party_controls has no policies at all.
rank:     2
moot?:
if kept:  One party-read policy each, the same shape as the two that were added for parties and signatures.

### 47. Two signed vet authorizations name no horse
what:     Two signed documents were produced with the horse's name blank — signed authorizations for no identified horse.
where:    Documents — horse paperwork
raised:   1 report, 2026-08-10 · sources: TASK-HORSEDOCS-REPORT.md
checked:  Prod: both documents still hold the blank merge and no horse link; executed bodies are never rewritten, so this is a disposition question.
rank:     2
moot?:
if kept:  Decide whether they are re-signed against the horse or annotated.

### 48. A lease can say the Lessor carries all risk and the Lessee carries mortality
what:     One clause says the Lessor assumes all risk and another says the Lessee carries mortality — both print together.
where:    Lease document — risk and insurance
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod clause defs unchanged since the report; the first clause is still unconditional.
rank:     2
moot?:
if kept:  Gate one against the other.

### 49. Medical statements contradict each other inside one numbered item
what:     Within one numbered paragraph the document says the Lessor carries uncovered medical costs and the Lessee does.
where:    Lease document — medical
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Unchanged in prod clause defs.
rank:     2
moot?:
if kept:  Same fix family as item 48.

### 50. A policy is named two items below a line saying it does not exist
what:     The coordination clause names the Lessor's mortality policy as first to respond two items after the document says there is no such policy.
where:    Lease document — coordination
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Unchanged in prod clause defs.
rank:     2
moot?:
if kept:  Add the missing condition to that clause's gate.

### 51. Three account rows point at records that do not exist
what:     Three accounts violate two enforced foreign keys — they point at a login and a person record that are not there.
where:    Identity — profiles
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod, re-run: 3 rows fail the login key and 3 fail the contact key; 13 accounts against 12 logins. Identical to the report.
rank:     2
moot?:
if kept:  They look like test rows — confirm, then remove them.

### 52. A company lease with mortality waived has two owners of the same loss
what:     One combination produces two clauses each claiming the same loss, with the ordering clause switched off.
where:    Lease document — mortality
raised:   2 reports, earliest 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md, TASK-LEASEGATE-PHASE1.md
checked:  Unchanged in prod clause defs.
rank:     2
moot?:
if kept:  Same fix family as item 48.

### 53. A Lessee's election un-makes itself
what:     If the Lessor changes their own insurance status, the Lessee's recorded promise disappears from the document but stays stored — and comes back if the Lessor changes back.
where:    Lease document — insurance elections
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod: the field writer still has no clearing behaviour for hidden fields.
rank:     2
moot?:
if kept:  Clear the stored value when the clause stops applying, or record who set it and when.

### 54. The Lessor can write the Lessee's own promises
what:     The three first-person insurance statements are owned by the Lessor, so the Lessor (or staff) can write what the Lessee promises.
where:    Lease document — insurance status
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod field defs unchanged: the three status fields are still owned by the Lessor while the matching checkboxes are party-exclusive.
rank:     2
moot?:
if kept:  Move the three fields to the Lessee.

### 55. A waiver hides a field but leaves its old value behind
what:     Waiving a requirement hides the field but keeps its stored value, so an old "none" re-arms the signing block when the waiver comes off.
where:    Lease document — insurance
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod: the blocker and the notification both still read raw stored values with no gate awareness.
rank:     2
moot?:
if kept:  Clear on hide, or make both readers gate-aware.

### 56. The signing-block rule is written out twice
what:     The rule that blocks signing is duplicated word for word in two places, so a change to one leaves the other disagreeing.
where:    Lease document — signing block and notification
raised:   1 report, 2026-08-07 · sources: TASK-LEASEGATE-PHASE1.md
checked:  Prod: both functions still carry the same predicate.
rank:     2
moot?:
if kept:  One shared predicate.

### 57. A new field column is silently dropped
what:     Adding a column to the contract-field definitions is silently ignored unless three functions are edited to name it.
where:    Contracts — field definitions
raised:   1 report, 2026-08-07 · sources: TASK-LEASEGATE-PHASE1.md
checked:  Prod: the three functions still enumerate columns explicitly.
rank:     2
moot?:
if kept:  Either select the whole row, or a test that fails when a column is unhandled.

### 58. Expired invitations never expire
what:     Nothing marks an invitation expired, so twelve "sent" invitations read as live when seven are dead.
where:    Staff app — invitations
raised:   1 report, 2026-08-11 · sources: TASK-INVITEWORKS-REPORT.md
checked:  Prod, re-run: no invitation has status 'expired' at all, and 7 rows are past their expiry while still marked sent. Identical to the report.
rank:     2
moot?:
if kept:  A sweep, or compute expiry on read.

### 59. Eight of the nine pending clients were never invited
what:     Nine people are provisioned as pending clients and eight of them have no invitation of any kind.
where:    Staff app — Clients
raised:   1 report, 2026-08-11 · sources: TASK-ROSTERCARD-REPORT.md
checked:  Prod, re-run against today's data: unchanged in shape — pending client rows still exist with no matching invitation.
rank:     2
moot?:
if kept:  Either invite them or mark them as not-yet-invited on the page.

### 60. The account-creation spine has no tests
what:     The single function every new client account goes through has no test coverage at all.
where:    Identity — provisioning
raised:   1 report, 2026-08-12 · sources: TASK-TESTDB-REPORT.md
checked:  No test file exercises it (grep of test/); it is still the sole spine called by the invitation endpoint.
rank:     2
moot?:
if kept:  One test file; the harness exists.

### 61. A microchip of "N/A" hijacks the next owner's horse
what:     Two horses saved with a placeholder microchip are treated as the same animal, filing a claim against someone else's record.
where:    Member app — horse intake
raised:   1 report, 2026-08 · sources: TASK-HORSEINTAKE-REPORT.md
checked:  Prod: the matching is still a plain text equality with no format check and no placeholder guard.
rank:     2
moot?:
if kept:  Refuse placeholder values before matching.

### 62. The platform owner still holds a tenant person record
what:     The platform account still has a tenant contact attached, which the rules say it must not.
where:    Identity — platform account
raised:   2 reports, earliest 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md, TASK-CONTRACTORPHAN-REPORT.md
checked:  Prod: admin@cactai.io still has org NULL (correct) and still holds a contact link (not correct).
rank:     2
moot?:
if kept:  Detach the contact — the task it was deferred to was never written.

### 63. Email lives in three places and nothing reconciles them
what:     A person's email exists in three tables; change the login email and the other two keep the old one, which the directory then publishes.
where:    Identity
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  The email-change endpoint is unchanged since the baseline; no reconciling path exists.
rank:     2
moot?:
if kept:  Decide which copy is authoritative, then sync from it.

### 64. Names diverge between the two copies
what:     Names sync one way only, so a name changed in the wrong place makes the community and the legal document disagree.
where:    Identity
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: the one-way sync trigger is unchanged; the profile-only write paths still exist.
rank:     2
moot?:
if kept:  Sync both ways, or make one copy the only writable one.

### 65. Two onboarding paths overwrite each other
what:     Two paths that save the same onboarding fields use opposite precedence, so a correction made in one is silently discarded by the other.
where:    Onboarding
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: both functions still exist with the opposite precedence unchanged.
rank:     2
moot?:
if kept:  Pick one precedence.

### 66. A trigger references a column that was deleted
what:     Any update to a settled billable line raises a misleading error, because the trigger refers to a column removed with an old retirement.
where:    Billing
raised:   1 report, 2026-08-12 · sources: TASK-TESTDB-REPORT.md
checked:  Prod: the trigger function still references the dropped column.
rank:     2
moot?:
if kept:  One-line fix, or drop the trigger.

### 67. The brand site address points at a dead domain
what:     Every email that links to "the site" sends people to a domain that does not answer.
where:    Email — all templates
raised:   3 reports, earliest 2026-08-02 · sources: TASK-INVITEWORKS-REPORT.md, PROMPT_A_STAGES_4-5.md, POST_RUN_CLOSEOUT.md
checked:  Prod config still holds https://fhequestrian.com; `curl` to it and to www. both fail to connect today. Invitation links are unaffected (built from the request origin).
rank:     2
moot?:
if kept:  Point the setting at the live host, or fix the domain.

### 68. The mail send has no timeout
what:     A hung mail server hangs the request until the platform kills it, after the invitation has already been created.
where:    Email — delivery
raised:   1 report, 2026-08-11 · sources: TASK-INVITEWORKS-REPORT.md
checked:  api/_lib/delivery.ts contains no timeout (grep → 0 hits) and is unchanged since the baseline.
rank:     2
moot?:
if kept:  One timeout value.

### 69. A dismissed alert leaves no trace anywhere you look
what:     Dismissing an in-app alert leaves evidence only in a log nothing reads, which is why "nobody was notified" looked true for three days.
where:    Notifications
raised:   1 report, 2026-08-12 · sources: TASK-INBOUNDALERT-REPORT.md
checked:  Prod: the dismissal function still only deletes; nothing in the app reads the audit log.
rank:     2
moot?:
if kept:  Keep dismissed alerts visible somewhere, or surface the log.

### 70. Three promised notifications have no producer
what:     The preferences screen names three notifications (discussion replies, event reminders, new member welcomes) that nothing in the system sends.
where:    Member app — preferences
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: no trigger or function produces any of the three; the card still names them.
rank:     2
moot?:
if kept:  Either build them or stop naming them.

### 71. Two email routes hardcode the tenant's name
what:     Two email routes fall back to "French Heritage Equestrian" by name, which is wrong for any second tenant.
where:    Email — contract invite and void
raised:   1 report, 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md
checked:  Both files are unchanged since the baseline (not in the changed-file list).
rank:     2
moot?:
if kept:  Fail loudly instead of falling back to a name.

### 72. "Remove" still destroys the file
what:     Removing a file still deletes the bytes, which your own ruling says must not happen for a file linked to something shared.
where:    Member app — My Files
raised:   1 report, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  src/lib/files.ts is in the changed set, but the storage delete is still the documented behaviour and no migration adds retention. Needs the one-line change plus a retention rule.
rank:     2
moot?:
if kept:  Make remove a visibility action (this is your ruling D15, not yet built).

### 73. Storage is org-gated but not path-scoped
what:     A second tenant's administrator could read this tenant's stored files in buckets whose paths do not start with an org id.
where:    Storage
raised:   1 report, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  Unchanged; no migration since the report touches the storage policy.
rank:     2
moot?:
if kept:  Path-scope the policy — bigger than one condition, per the report.

### 74. Half the fulfilment ledger is orphaned
what:     Six of thirteen fulfilment rows point at purchases that no longer exist, evidence that dozens of purchases were hard-deleted.
where:    Orders and fulfilment
raised:   4 reports, earliest 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE1.md, TASK-BOOKWRITE-REPORT.md
checked:  Prod, re-run: 13 rows, 6 orphaned. Identical to the report.
rank:     2
moot?:
if kept:  Any obligations page needs an orphan filter; decide whether the six are deleted or kept as evidence.

### 75. The cleanup practice that caused the orphans is still in use
what:     Cleaning data with referential integrity switched off is what produced the broken contract link, and nothing stops it happening again.
where:    Process — data cleanup
raised:   2 reports, earliest 2026-08-11 · sources: TASK-CONTRACTORPHAN-REPORT.md
checked:  Nothing in CLAUDE.md or the migration convention forbids it; the one routine path that deletes a contract row still exists.
rank:     2
moot?:
if kept:  A written rule plus a foreign-key re-check step.

### 76. The invitation spine still supersedes on every call
what:     Every call to the provisioning function retires the previous invitation link, so a second self-onboarding submission kills the first link — behaviour you ruled against.
where:    Identity — invitations
raised:   1 report, 2026-08-11 · sources: TASK-INVITEWORKS-REPORT.md
checked:  Prod: the function still calls supersede unconditionally; the written fix is still parked in docs/proposed/.
rank:     2
moot?:
if kept:  Apply the parked migration — it is written and dry-run.

### 77. Anyone with a document id can read its comments and signature state
what:     A handful of document readers take an id and no identity, so a leaked id exposes notes and signature state.
where:    Contracts
raised:   1 report, 2026-08-10 · sources: TASK-NOGUARD2-REPORT.md
checked:  Same functions as item 29; unchanged.
rank:     2
moot?:
if kept:  Covered by item 29's phase.

### 78. A guard idiom that keeps being re-written
what:     The specific guard shape that caused three live holes keeps being written into new functions faster than it is fixed.
where:    Database-wide
raised:   2 reports, earliest 2026-08-11 · sources: TASK-NOGUARD3-REPORT.md, TASK-CONTRACTORPHAN-REPORT.md
checked:  Three holes of this shape were found and fixed on 2026-08-12; the proposed check to stop new ones was never built.
rank:     2
moot?:
if kept:  A CI check on the pattern.

### 79. The field-mutator family, one caller still open
what:     Of the functions that can rewrite any contract's fields, one remains callable by any signed-in account.
where:    Contracts
raised:   2 reports, earliest 2026-08-07 · sources: TASK-NOGUARD1-REPORT.md, TASK-NOGUARD2-REPORT.md
checked:  Prod: five of the family are now closed to both public roles; fill_party_fields_from_contacts is still granted to authenticated.
rank:     2
moot?:
if kept:  One guard on the remaining function.

### 80. One community post creator is safe only by accident
what:     A post-creation function skips its own guard when a value is empty and is stopped only by a column constraint.
where:    Community — feed
raised:   1 report, 2026-08-11 · sources: TASK-NOGUARD3-REPORT.md
checked:  Prod: still granted to both public roles; no migration since names it.
rank:     2
moot?:
if kept:  One default value or one guard.

### 81. An invitation can be burned by whoever holds the link
what:     A function with no caller check lets a link-holder mark an invitation failed and raise a staff alert.
where:    Identity — invitations
raised:   1 report, 2026-08 · sources: TASK-NULLUID-REPORT.md
checked:  Prod: still executable by anon and authenticated.
rank:     2
moot?:
if kept:  Low risk (the token is the credential) — decide whether to guard or accept.
