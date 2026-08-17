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

---

# RANK 3 — BLOCKED, OR OWED A DECISION FROM YOU

### 82. Whether Google sign-in linking is switched on is unknown
what:     Nobody knows whether the setting that lets an existing account add Google sign-in is switched on, and it has never been tested.
where:    Login and security
raised:   6 reports, earliest 2026-08-11 · sources: TASK-GOOGLEAUTH-REPORT.md, TASK-ACCOUNTSURFACE-REPORT.md
checked:  The setting lives in the hosting dashboard, not in the repo or the database; the control itself now reads the server's identity list correctly.
rank:     3
moot?:
if kept:  Two minutes signed in settles it.

### 83. Whether the password survives after adding Google is unruled
what:     Adding Google sign-in currently leaves the password working, and no control removes it — that was a guess, not a ruling.
where:    Login and security
raised:   1 report, 2026-08-11 · sources: TASK-GOOGLEAUTH-REPORT.md
checked:  The security card still keeps both; unchanged in substance.
rank:     3
moot?:
if kept:  Say yes and it is already built; say no and it needs a removal control.

### 84. Eight test files are blocked on a retired helper
what:     Eight test files cannot run because their setup uses a function that was retired, while the things they test are live.
where:    Tests
raised:   1 report, 2026-08-12 · sources: TASK-TESTDB-REPORT.md
checked:  Unchanged; the retired helper is still referenced by those fixtures.
rank:     3
moot?:
if kept:  Rewrite the fixtures onto the current spine, or lose that coverage deliberately.

### 85. Parallel threads in one folder keep losing work
what:     Several sessions working in the same folder have repeatedly overwritten or mis-attributed each other's work.
where:    Process
raised:   8 reports, earliest 2026-08-04 · sources: TASK-B-REPORT.md, TASK-A8B-REPORT.md, TASK-COUNTFIX-REPORT.md, TASK-CONTRACTORPHAN-REPORT.md, TASK-LEASEFIX-REPORT.md
checked:  A pre-commit hook now blocks code commits in the shared folder (.git/fhe-hooks/pre-commit, 2026-08-10) and it caught one thread this week — but a different thread still swept another's files into its commit on 2026-08-16.
rank:     3
moot?:
if kept:  Make the worktree rule the first line of every task doc, or block more than commits.

### 86. The dry-run wrapper does not always dry-run
what:     Four times, a migration's own transaction defeated the house dry-run and applied the change for real.
where:    Process — migrations
raised:   4 reports, earliest 2026-08-02 · sources: TASK-C-REPORT.md, TASK-R11-REPORT.md, TASK-SENDGUARD-REPORT.md, TASK-INVITEFLOW-REPORT.md
checked:  Nothing prevents it; the convention in CLAUDE.md does not mention the failure mode.
rank:     3
moot?:
if kept:  One sentence in the convention: a migration must not contain its own COMMIT.

### 87. The member directory is open to any account holder, not just members
what:     Anyone with an account can read the member directory, while the other community features require active membership.
where:    Community — directory
raised:   1 report, 2026-08-07 · sources: TASK-SECFIX2-REPORT.md
checked:  Prod: the function's only gates are "signed in" and "not suspended". Your access ruling says community access is by account, so this may be correct — the drift is with the other ten tables.
rank:     3
moot?:
if kept:  Decide which rule is right, then make all eleven agree.

### 88. There is no way for staff to see what a party sees
what:     Nobody can preview a document as the other party, which is why every party-visibility question stays open.
where:    Staff app — documents
raised:   1 report, 2026-08-04 · sources: TASK-A-PARTY-VERIFY-REPORT.md
checked:  No such capability exists in src/ (unchanged).
rank:     3
moot?:
if kept:  A staff-only "view as" lens — it would close several other items on this sheet.

### 89. You cannot create an instructor account
what:     The team screen can only invite administrators, so the instructor role the security work made real cannot be granted without a developer.
where:    Staff app — Team
raised:   1 report, 2026-08-12 · sources: TASK-GUARDREST-REPORT.md
checked:  Unchanged; the invite path still sends admin only.
rank:     3
moot?:
if kept:  A role picker on the invite form.

### 90. A horse's owner cannot read a file someone else uploaded
what:     A vet certificate uploaded by one member is not readable by the horse's owner.
where:    Files
raised:   1 report, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  No cross-member read policy exists (unchanged).
rank:     3
moot?:
if kept:  One policy arm plus a matching storage rule, before the horse-record file UI.

### 91. Members cannot attach a file to a record
what:     Only staff can put a file onto a horse or contract record; a member cannot.
where:    Files
raised:   1 report, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  Prod policy list: the link table has an owner-read and an owner-unlink policy, no member-create arm.
rank:     3
moot?:
if kept:  A per-subject permission check that does not exist yet.

### 92. Nine places that should show files show none
what:     Files exist but none of the nine records that should display them do (deal, contract, horse, stable, lessons, catalog, leads, directory, community).
where:    Files
raised:   1 report, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  Unchanged — the surfaces were deliberately not built; each has a listed layout and permission question.
rank:     3
moot?:
if kept:  Pick which two or three matter and build those.

### 93. Members cannot download a published company guide
what:     The community resources card has no download control, so a published guide cannot be opened.
where:    Community — resources
raised:   1 report, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  Unchanged; the reader exists, the control does not.
rank:     3
moot?:
if kept:  The smallest remaining piece of the company-files loop.

### 94. Removing an account leaves its files ownerless
what:     The removal routine knows nothing about files, so a departing member's files are left pointing at nobody.
where:    Files, accounts
raised:   1 report, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  Unchanged. Your later ruling says accounts are archived, not purged, which changes the question rather than answering it.
rank:     3
moot?:
if kept:  Say where a departing member's files go.

### 95. Who owns a lead's file
what:     A lead has no account, so a file "owned" by that lead is readable by nobody as theirs.
where:    Files — leads
raised:   1 report, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  One ruling: org-owned, or staff-only.

### 96. Whether directory files belong to the business
what:     A farrier's insurance certificate that the stable holds is probably the business's file, not the farrier's — unconfirmed.
where:    Files — directory
raised:   1 report, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  One ruling before the directory file UI is built.

### 97. What a lesson file attaches to
what:     Whether a lesson file belongs to the package, the session or the credit must be decided before any are stored.
where:    Files — lessons
raised:   1 report, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  Unchanged; re-pointing later is a data migration.
rank:     3
moot?:
if kept:  One ruling.

### 98. The signed-document card's history trail was never built
what:     The specified trail on a signed document (created, sent, signed, sent to you) was never built.
where:    Member app — documents
raised:   1 report, 2026-08-06 · sources: TASK-A-PARTY-VERIFY-2-REPORT.md
checked:  Unchanged; the delivery table now has a party-read arm, so the data is reachable.
rank:     3
moot?:
if kept:  A card change plus one extra column on the member's reader.

### 99. Your own invite link landed on a page that did not work
what:     You reported your own contract invite link landing on a page that did nothing, and it was never reproduced or explained.
where:    Contract invitations
raised:   1 report, 2026-08-06 · sources: TASK-A-PARTY-VERIFY-2-REPORT.md
checked:  No reproduction exists; nothing in the tree records a cause.
rank:     3
moot?:
if kept:  Needs you to click it again with the browser console open.

### 100. Direct navigation to an app URL failed in your browser
what:     Typing or pasting an app address failed in your Chrome session but worked in Safari, and the cause was never found.
where:    App — startup
raised:   1 report, 2026-08-06 · sources: TASK-A-PARTY-VERIFY-2-REPORT.md
checked:  Suspected auth-bootstrap hang; unproven, and nothing since has re-tested it.
rank:     3
moot?:
if kept:  One live reproduction with devtools open — if it still happens, it is the most user-visible item on this sheet.

### 101. The company as a signing party cannot be verified at all
what:     When the company is a party to a document, no login can ever be that party, so that side can never be checked.
where:    Contracts — company party
raised:   2 reports, earliest 2026-08-04 · sources: TASK-A-PARTY-VERIFY-REPORT.md, TASK-PARTYRLS-REPORT.md
checked:  Structural and unchanged: no account can equal the company contact, and the shared staff login bypasses party gating.
rank:     3
moot?:
if kept:  This is what the "view as" lens in item 88 would solve.

### 102. Kiosk signers have no route to their own document
what:     Someone who signs at the kiosk gets a contact record with no login and no way to reach the document they signed.
where:    Kiosk — /release
raised:   2 reports, earliest 2026-08-02 · sources: POST_RUN_CLOSEOUT.md
checked:  Unchanged; the promotion path and short URLs were deferred by you to a separate task that was never written.
rank:     3
moot?:
if kept:  The deferred kiosk-to-account task.

### 103. Kiosk signatures raise no staff alert
what:     When someone signs at the kiosk, no notification of any kind is raised.
where:    Kiosk — /release
raised:   1 report, 2026-08-04 · sources: TASK-A16-REPORT.md
checked:  Prod: the kiosk signing function still raises no notification; the party-signed alert covers only the in-app path.
rank:     3
moot?:
if kept:  One call, copied from the in-app path.

### 104. The sessionless release flow stopped at your gate
what:     Hardening the release flow hit your stop-and-show gate; three options were written and nothing was applied.
where:    Kiosk — /release
raised:   1 report, 2026-08-02 · sources: PROMPT_A_STAGES_4-5.md
checked:  api/sign-release.ts has changed since (other work) but the authorization question is unanswered.
rank:     3
moot?:
if kept:  Pick one of the three options.

### 105. The horse-scoped supersession still has to answer the blank-horse case
what:     Superseding a horse document now respects the horse, but what happens when the old document names no horse is unanswered.
where:    Documents — horse paperwork
raised:   1 report, 2026-08-10 · sources: TASK-HORSEDOCS-REPORT.md
checked:  Prod: the function is now horse-scoped (see CLOSED.md); the blank-horse case means one person keeps two live documents per template.
rank:     3
moot?:
if kept:  One rule for the blank case.

### 106. The cleanup of the two broken documents is written and unapplied
what:     The migration that removes the two broken documents exists, dry-run, and was deliberately not applied because you were going to remove them yourself.
where:    Documents
raised:   2 reports, earliest 2026-08-11 · sources: TASK-CONTRACTORPHAN-REPORT.md
checked:  Prod: the two documents are still there (item 2). Removing them will regenerate two fresh replacements on the next horse-document run.
rank:     3
moot?:
if kept:  Apply it, or do it yourself — but items 2 and 3 stay live until one of those happens.

### 107. The kiosk page should be labelled destructive in the review list
what:     The kiosk signing page signs a real document, and the review list does not warn about that.
where:    Staff app — Review
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  src/lib/reviewSection.ts has changed since the baseline; the warning is still absent for that slot.
rank:     3
moot?:
if kept:  One sentence in the review list.

### 108. The documents page's management functions were never started
what:     Filters, sorting, multi-select, delete and the "send" wording on the documents page were never built.
where:    Staff app — Documents
raised:   1 report, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Partly overtaken: the queue now has presets and column control. Multi-select and delete arrived on the Records tabs, not here.
rank:     3
moot?:
if kept:  Re-specify against what the queue has become.

### 109. The templates tab from the design was never built
what:     The full version-control workflow for templates was never attempted.
where:    Staff app — Documents/Templates
raised:   1 report, 2026-08-11 · sources: TASK-DOCQUEUE-REPORT.md
checked:  A wording editor now exists under Review; the version-control workflow does not.
rank:     3
moot?:
if kept:  A separate, much larger spec.

### 110. Where flat documents should open is your call
what:     Simple documents open in one editor only by typed URL; routing them all there would lose the send/mail panel the other viewer has.
where:    Staff app — documents
raised:   1 report, 2026-08-11 · sources: TASK-ONEAUTHOR-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  One decision, then a one-line routing change.

### 111. No real transaction has ever filled in the insurance section
what:     The whole insurance section has never been completed by a real lease — all twenty-two fields are empty on every current document.
where:    Lease documents
raised:   2 reports, earliest 2026-08-02 · sources: TASK-LEASEMAP-REPORT.md, PROMPT_A_STAGES_4-5.md
checked:  Prod: the one executed lease predates the model and the live drafts are empty.
rank:     3
moot?:
if kept:  Fill one in on a test document — it would settle a dozen items below.

### 112. Nothing records whether proof of insurance was ever provided
what:     Four clauses say proof of coverage will be provided on request, and there is no field, upload, date or status anywhere to record it.
where:    Lease documents
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  One field and one upload slot.

### 113. Full versus partial lease never reaches the insurance section
what:     Whether a lease is full or partial — the distinction you were worried about — is invisible to every rule in the insurance section.
where:    Lease documents
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Wire the lease type into those gates.

### 114. The vocabulary has no word for "cannot get cover"
what:     A Lessee who cannot lawfully obtain a cover has only bad options: say something untrue, promise the impossible, leave the document unsignable, or drop the requirement.
where:    Lease documents
raised:   2 reports, earliest 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md, TASK-LEASEGATE-PHASE1.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Add the missing status word, then decide what it prints.

### 115. The insurance rules as written would break your live arrangement
what:     The proposed insurance rules would make your existing no-insurance client arrangement impossible to execute.
where:    Lease documents
raised:   1 report, 2026-08-07 · sources: TASK-LEASEGATE-PHASE1.md
checked:  Unchanged and unbuilt — the thread stopped here deliberately.
rank:     3
moot?:
if kept:  Answer what replaces the waiver, then the rules can be built.

### 116. Two of the proposed rules contradict each other
what:     Two of the proposed insurance rules cancel each other out when tested against the live rule engine.
where:    Lease documents
raised:   1 report, 2026-08-07 · sources: TASK-LEASEGATE-PHASE1.md
checked:  Verified against the live evaluator at the time; unchanged.
rank:     3
moot?:
if kept:  Same answer as item 115.

### 117. The proposed rules would land on a template no document uses
what:     The planned rules were aimed at a template no document is on, so no new lease would get them.
where:    Lease templates
raised:   1 report, 2026-08-07 · sources: TASK-LEASEGATE-PHASE1.md
checked:  Prod: that template is now inactive; new leases still start from the live one.
rank:     3
moot?:
if kept:  Aim the work at the live template.

### 118. Whether the signing block should be stricter
what:     The rule that blocks signing on unresolved insurance already exists; the question is whether a promise should be enough to clear it.
where:    Lease documents
raised:   2 reports, earliest 2026-08-07 · sources: TASK-LEASEGATE-PHASE1.md
checked:  Prod: the blocker still clears on a promise rather than a policy.
rank:     3
moot?:
if kept:  One decision.

### 119. Nothing forces the value the rules would require
what:     Even with the rules built, nothing sets the required value, and an empty required field blocks signing.
where:    Lease documents
raised:   2 reports, earliest 2026-08-07 · sources: TASK-LEASEGATE-PHASE1.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Part of the same design.

### 120. The form side of the same design was never done
what:     The editing form would need the same "not eligible" treatment as the document, and that design does not exist.
where:    Contracts — editor
raised:   2 reports, earliest 2026-08-07 · sources: TASK-LEASEGATE-PHASE1.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Part of the same design.

### 121. The "not eligible" control was written against a frozen file
what:     The change that would show a field as not eligible was written but never compiled, because the file was frozen at the time.
where:    Contracts — editor
raised:   1 report, 2026-08-07 · sources: TASK-LEASEGATE-PHASE1.md
checked:  That file has since been edited by other work, so the freeze no longer applies.
rank:     3
moot?:
if kept:  Re-derive the change against today's file.

### 122. Whether the Lessor's own coverage should gate anything
what:     The Lessor's own-coverage answer currently affects nothing, deliberately.
where:    Lease documents
raised:   1 report, 2026-08-10 · sources: TASK-LEASEFIX-REPORT.md
checked:  Prod: still gates nothing.
rank:     3
moot?:
if kept:  One decision.

### 123. Three insurance clauses still say "pending legal review"
what:     Three insurance clauses carry placeholder text instead of real language.
where:    Lease documents
raised:   1 report, 2026-08-02 · sources: PROMPT_A_STAGES_4-5.md
checked:  Prod clause bodies unchanged; the signing block is what stops a placeholder reaching a signed document.
rank:     3
moot?:
if kept:  Real wording from you or Claire.

### 124. A staged rule change is waiting on a coherence ruling
what:     A set of deductible rules is written and staged, and must not be applied until the insurance section is coherent.
where:    Lease documents
raised:   3 reports, earliest 2026-08-01 · sources: PROMPT_A_STAGES_1-3.md, PROMPT_A_STAGES_4-5.md
checked:  Unchanged and unapplied.
rank:     3
moot?:
if kept:  Apply after items 111-120 are answered, not before.

### 125. The "not required" checkbox assumes you are always the Lessor
what:     A carve-out that lets staff tick "not required" assumes the stable is the Lessor, which is not true for a lease in the other direction.
where:    Lease documents
raised:   1 report, 2026-08-06 · sources: TASK-A-PARTY-VERIFY-2-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Decide whether staff may ever fill the other party's exclusive fields.

### 126. Four lease templates are identical copies
what:     The Standard, Simple and Detailed leases are byte-identical, so every wording change is written four times.
where:    Templates — leases
raised:   4 reports, earliest 2026-08-11 · sources: TASK-ONEAUTHOR-REPORT.md, TASK-LEASESET-REPORT.md, TASK-DUPECENSUS-REPORT.md
checked:  Prod: the three active leases are still identical; the fourth clone is now inactive. This is your ruled state (D10) — it stays until you modify one.
rank:     3
moot?:
if kept:  Nothing, unless you want the Simple lease to actually differ — which is item 127's worksheet.

### 127. The simple lease's content decision is blank
what:     The worksheet that decides what a simple lease contains has an empty keep-or-cut column on all 144 rows.
where:    Templates — simple lease
raised:   1 report, 2026-08 · sources: TASK-LEASESIMPLE-REPORT.md
checked:  Unchanged; you and Claire are the only people who can fill it.
rank:     3
moot?:
if kept:  144 keep/cut decisions, or a shorter starting list.

### 128. Retiring the original lease deletes body text
what:     The original lease is inactive but still holds its full body and 98 orphan field rows; retiring it properly deletes wording that might be wanted back.
where:    Templates — original lease
raised:   4 reports, earliest 2026-08-01 · sources: PROMPT_A_STAGES_1-3.md, TASK-LEASEFORK-REPORT.md
checked:  Prod: still inactive with an 18,253-byte body and 0 documents.
rank:     3
moot?:
if kept:  Your ruling already says keep it as reference — this item is asking whether the orphan field rows go.

### 129. Twelve simple documents were never converted to the clause engine
what:     Twelve documents are still flat text rather than built from clauses, so they cannot be edited the way the leases can.
where:    Templates
raised:   1 report, 2026-08-11 · sources: TASK-ONEAUTHOR-REPORT.md
checked:  Unchanged; the four negotiated commercial agreements were recommended first.
rank:     3
moot?:
if kept:  Three to five sessions, sequenced by value.

### 130. The bill of sale cannot be started on its own
what:     There is no way to author a bill of sale by itself — it has no card and no entry point.
where:    Staff app — new document
raised:   2 reports, earliest 2026-08-04 · sources: TASK-DOCQUEUE-REPORT.md, HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Prod: the standalone starter function exists and has no caller anywhere in src/.
rank:     3
moot?:
if kept:  One card wired to the function that already exists.

### 131. The sale agreement was kept live without a decision
what:     After the bill of sale became the main instrument, the older sale agreement was kept live anyway, without sign-off.
where:    Templates — sale
raised:   1 report, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Prod: still active.
rank:     3
moot?:
if kept:  Keep or retire — one flag.

### 132. The sworn affidavit does not exist
what:     The affidavit that absorbed the notary requirement has no content, no template and nowhere for the notary block.
where:    Templates — sale
raised:   1 report, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Prod: no such template exists.
rank:     3
moot?:
if kept:  Wording first, then a template.

### 133. Two placeholders both mean "the document id"
what:     Two differently-named placeholders both print the document id; one of the two names is wrong.
where:    Templates — placeholders
raised:   2 reports, earliest 2026-08-12 · sources: TASK-TOKENAUDIT-REPORT.md, TASK-TEXTEDIT-REPORT.md
checked:  Prod, re-checked today: both rows still map to the same column. Unused, so nothing breaks yet.
rank:     3
moot?:
if kept:  Rename one, or repoint it at the order number.

### 134. Seventeen placeholders always print blank
what:     Seventeen placeholders about an enquiry always print blank, because the questions they read were never built.
where:    Templates — placeholders
raised:   1 report, 2026-08-12 · sources: TASK-TOKENAUDIT-REPORT.md
checked:  Prod: unchanged; their notes already say "do not place".
rank:     3
moot?:    ASKRIGHT builds the questions these would read.
if kept:  Build or retire once ASKRIGHT lands.

### 135. Several placeholders are duplicates of each other
what:     Three sets of placeholders print identical output under different names, which is how a document ends up inconsistent.
where:    Templates — placeholders
raised:   1 report, 2026-08-12 · sources: TASK-TOKENAUDIT-REPORT.md
checked:  Prod: all still present (360 rows today, up from 307).
rank:     3
moot?:
if kept:  Hide the duplicates from the picker; keep the rows.

### 136. Placeholder descriptions can only be edited in the database
what:     The descriptions that explain each placeholder are stored in the database with no screen to edit them.
where:    Templates — placeholders
raised:   1 report, 2026-08-12 · sources: TASK-TOKENAUDIT-REPORT.md
checked:  Unchanged; the picker reads them, nothing writes them.
rank:     3
moot?:
if kept:  A small editor — this is the pattern your no-developer rule exists to stop.

### 137. Half of one authoring change was not built
what:     The "collapse a switched-off clause to its title" half of an authoring change was deliberately not built.
where:    Contracts — editor
raised:   1 report, 2026-08-04 · sources: TASK-R11-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Confirm that is what you meant, then it is a small change.

### 138. Four people appear on no list
what:     You, Claire, the company and the platform company are filed as "team" and no screen lists them.
where:    Staff app — Records
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Prod: still 4 team-typed contacts; the Records "all" tab still excludes them and the Team screen reads accounts, not contacts.
rank:     3
moot?:
if kept:  Either a Team tab that reads contacts, or accept that they live in configuration.

### 139. Whether working a lead should mark it converted
what:     Scheduling a lesson for a lead is the only thing that would mark the enquiry converted, and it has never happened.
where:    Staff app — Leads
raised:   1 report, 2026-08-11 · sources: TASK-LEADCLEAN-REPORT.md
checked:  Prod, re-run: statuses are contacted 6, expired 1, new 9 — still no converted row.
rank:     3
moot?:    LESSONREQUEST owns request-to-first-lesson and will decide this by building it.
if kept:  One line, or let LESSONREQUEST answer it.

### 140. Nothing that converts a lead files them correctly
what:     Whatever turns a worked lead into a client does not set their type or go through the account spine.
where:    Staff app — Leads
raised:   1 report, 2026-08-10 · sources: TASK-ROSTER-REPORT.md
checked:  Prod: no automated path writes the type; the manual filing control is still the only writer. Same root as item 11.
rank:     3
moot?:
if kept:  Fix with item 11 — one change serves both.

### 141. Bare contacts are not flagged as un-contacted
what:     A person with no client record gets no "not yet invited" flag even though nobody has reached out to them either.
where:    Staff app — Clients
raised:   1 report, 2026-08-11 · sources: TASK-ROSTERCARD-REPORT.md
checked:  src/lib/admin.ts has changed since the baseline but still defines the three kinds with no bare-contact flag.
rank:     3
moot?:
if kept:  One flag, same shape as the pending one.

### 142. What a staff-created booking should carry
what:     279 of 319 bookings have no client and 318 have no purchase — the ledger records almost no links, and what a staff-created booking should carry is unruled.
where:    Bookings
raised:   4 reports, earliest 2026-08-11 · sources: TASK-GUARDREST-REPORT.md, TASK-BOOKWRITE-REPORT.md, TASK-ADMINSWEEP-PHASE1.md
checked:  Prod, re-run: 319 bookings, 279 with no client (was 294 — the lesson bookings were linked and the constraint validated by the booking work), 318 with no purchase.
rank:     3
moot?:
if kept:  Decide what a NULL client means; the backfill of the rest was recommended against.

### 143. The wording editor lives under a temporary menu
what:     The screen that edits document wording sits under the temporary Review section instead of Settings.
where:    Staff app — Templates
raised:   1 report, 2026-08-12 · sources: TASK-TEXTEDIT-REPORT.md
checked:  src/lib/reviewSection.ts still owns its nav entry; no Settings row exists.
rank:     3
moot?:
if kept:  One line, once you accept the page.

### 144. Whether the staff menu was meant to go green
what:     The staff menu was made green as an interpretation, and reverting it now means forking the shared styling.
where:    Staff app — navigation
raised:   1 report, 2026-08-08 · sources: TASK-ONEHEADER-REPORT.md
checked:  Unchanged; the constants are shared by five components.
rank:     3
moot?:
if kept:  One look at a screen and a yes or no.

### 145. Members have no way to create anything from the chrome
what:     A regular member has no create button anywhere in the header or menu.
where:    Member app
raised:   2 reports, earliest 2026-08-06 · sources: TASK-HEADER-REPORT.md, TASK-UPLOADS-REPORT.md
checked:  Unchanged; the create control is staff-side only.
rank:     3
moot?:
if kept:  Decide what a member can create, then one button.

### 146. Whether members should see a Lessons menu row
what:     The member Lessons row is built and switched on, awaiting a yes or no.
where:    Member app — navigation
raised:   1 report, 2026-08-05 · sources: TASK-UIPOLISH-REPORT.md
checked:  Prod: the lessons module is on, so every member sees it today.
rank:     3
moot?:
if kept:  One line either way.

### 147. The account page's section order was never chosen
what:     The ten rows on the account page are in the order they happened to be in, not an order you picked.
where:    Member app — Account
raised:   1 report, 2026-08-05 · sources: TASK-ACCOUNTSURFACE-REPORT.md
checked:  Unchanged; no ordering decision is recorded anywhere.
rank:     3
moot?:
if kept:  Ten rows, one ranking.

### 148. My Posts has no create control inside the account page
what:     The inline version of My Posts has no "new post" control; only the full page does.
where:    Member app — Account
raised:   1 report, 2026-08-05 · sources: TASK-ACCOUNTSURFACE-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  One button.

### 149. The identity design's phased build does not exist
what:     None of the five phases of the identity design were built.
where:    Identity
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: the named columns and tables are still absent, and the index the design marks removed is still there.
rank:     3
moot?:
if kept:  Decide whether that design is still the plan before anything cites it again.

### 150. Review menu rows cannot be hidden, on purpose
what:     The temporary Review rows are deliberately absent from the page-visibility list, because their position is their status.
where:    Staff app — Review
raised:   1 report, 2026-08-12 · sources: TASK-PAGEVIS-REPORT.md
checked:  src/lib/pageRegistry.ts still records the deliberate exclusion.
rank:     3
moot?:
if kept:  Confirm you are content not to be able to hide one; it self-resolves when Review empties.

### 151. The route table belongs to nobody
what:     The file that lists every page in the app has no owner and no merge rule, and it is where parallel work collides.
where:    Codebase — App.tsx
raised:   1 report, 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE2.md
checked:  It has changed since the baseline and still carries no ownership note; the layout file has one.
rank:     3
moot?:
if kept:  A header comment naming it shared, and the merge rule.

### 152. One 130KB file holds fifteen open items
what:     The main layout file is 130KB and fifteen items on this sheet point into it, so every one of them is a merge risk.
where:    Codebase — AppLayout.tsx
raised:   1 report, 2026-08-08 · sources: TASK-ONEHEADER-REPORT.md
checked:  Measured today: 130,405 bytes. Still one file.
rank:     3
moot?:
if kept:  A scheduled split with a merge freeze — never alongside other work.

### 153. The menu's dimensions are recorded nowhere
what:     The mobile menu's size was to be changed "per the owner" and no number exists anywhere, so it was not built.
where:    Member app — mobile menu
raised:   1 report, 2026-08-08 · sources: TASK-ONEHEADER-REPORT.md
checked:  Still at the original width; no dimension recorded in any document.
rank:     3
moot?:
if kept:  One number, or close it as "current width accepted".

### 154. The euthanasia change: new records only or all
what:     Whether the euthanasia-authorization change applies to existing horses or only new ones was never answered, and the form change waits behind it.
where:    Horses
raised:   2 reports, 2026-08 · sources: TASK-HORSEINTAKE-REPORT.md
checked:  Prod, re-run: all 4 horses are option B, so nothing needs migrating today — it becomes a migration the first time someone records an A.
rank:     3
moot?:
if kept:  Free to answer now; costs a migration later.

### 155. The three material languages were correctly not built
what:     Giving the header, menu and buttons three distinct materials was not built, and its premise changed when the header was replaced.
where:    Design
raised:   1 report, 2026-08-08 · sources: TASK-MOBILEPASS-REPORT.md
checked:  Not built (grep → 0 hits in src/); the header it described is shelved.
rank:     3
moot?:
if kept:  Re-specify before building — the current doc describes a header that is gone.

### 156. Sign out is only in the avatar menu
what:     Sign out is reachable only through the avatar menu, for every role, on every device.
where:    App — navigation
raised:   1 report, 2026-08-07 · sources: TASK-ONEMENU-PHASE1-PLAN.md
checked:  The mobile menu now carries a footer with sign out; the desktop dropdown is still the only desktop route.
rank:     3
moot?:
if kept:  A desktop replacement, if you want the dropdown gone.

### 157. Three menu recommendations were never confirmed
what:     Three decisions about the menu were answered as recommendations, and the next phase was to build against them.
where:    App — navigation
raised:   1 report, 2026-08-07 · sources: TASK-ONEMENU-PHASE1-PLAN.md
checked:  No sign-off is recorded; the work continued anyway.
rank:     3
moot?:
if kept:  Confirm or overrule the three.

### 158. Is the avatar a button or a decoration
what:     One place treats the avatar as a live control and a commit message rules it inert; the two readings produce different components.
where:    App — header
raised:   1 report, 2026-08-07 · sources: TASK-ONEMENU-PHASE1-PLAN.md
checked:  Today the tenant avatar is an inert monogram; the contradiction was never reconciled in writing.
rank:     3
moot?:
if kept:  One sentence settles it.

### 159. Should the header shrink on scroll
what:     The header was built at a fixed height as the safer default; whether it should shrink as you scroll is your call.
where:    App — header
raised:   1 report, 2026-08-08 · sources: TASK-ONEHEADER-REPORT.md
checked:  Still fixed height.
rank:     3
moot?:
if kept:  One decision.

### 160. The third header question was never asked
what:     A third question about the header was cut off mid-sentence in the task doc and nobody ever asked you what it was.
where:    App — header
raised:   1 report, 2026-08-08 · sources: TASK-ONEHEADER-REPORT.md
checked:  Still unknown.
rank:     3
moot?:
if kept:  Say what it was, or drop it.

### 161. Hiding a page still does not hide its menu row
what:     The page-visibility screen changes a status tile but not the menu, because the change to the menu was held.
where:    Staff app — page visibility
raised:   2 reports, earliest 2026-08-12 · sources: TASK-PAGEVIS-REPORT.md
checked:  The layout file has changed since for other reasons; the held patch is still not applied, so hiding a page still does not remove its row.
rank:     3
moot?:
if kept:  Apply the proven patch, then item 162's rule follows.

### 162. If those child rows are rejected, the hiding rule must change
what:     Hiding a section without child menu rows would strand its child pages, so the two decisions are joined.
where:    Staff app — page visibility
raised:   1 report, 2026-08-12 · sources: TASK-PAGEVIS-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Decide with item 161.

### 163. Three app pages cannot be hidden at all
what:     Messages, Calendar and Catalog are written directly into the menu rather than listed, so the visibility screen has no row to remove.
where:    Staff app — page visibility
raised:   1 report, 2026-08-12 · sources: TASK-PAGEVIS-REPORT.md
checked:  Unchanged in the layout file.
rank:     3
moot?:
if kept:  Restructure that block into a list.

### 164. Accepting a page out of Review needs a developer
what:     Moving a page out of the Review section is a code change, not a button — which conflicts with your no-developer rule.
where:    Staff app — Review
raised:   1 report, 2026-08-12 · sources: TASK-REVIEWNAV-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Accept it (the acceptance work is the re-bucketing itself), or name a real follow-up.

### 165. You cannot switch a module off yourself
what:     Every module is on, and only the platform screen can switch one off — you can only hide its pages.
where:    Staff app — modules
raised:   1 report, 2026-08-12 · sources: TASK-PAGEVIS-REPORT.md
checked:  Prod: all six modules enabled; the module screen still requires the platform account.
rank:     3
moot?:
if kept:  A tenant-side module switch, if you want one.

### 166. Eleven pages still use the old big title
what:     Eleven member pages still carry the old large green title instead of the new page frame.
where:    Member app
raised:   1 report, 2026-08-05 · sources: TASK-PAGETITLES-REPORT.md
checked:  Unchanged for those pages.
rank:     3
moot?:
if kept:  Rule whether the new default extends to them, then it is mechanical.

### 167. The contract page was left out of the page frame
what:     The document page was deliberately not converted to the shared page frame, because forcing it would reintroduce an old width bug.
where:    Staff app — document page
raised:   1 report, 2026-08-11 · sources: TASK-PAGEFRAME-REPORT.md
checked:  Unchanged; the page is 128KB with its own header.
rank:     3
moot?:
if kept:  A real design call about that page's header.

### 168. The avatar's open state looks the same as pressed
what:     When the avatar menu is open the avatar looks identical to being pressed; three rendered options were prepared for you to pick from.
where:    App — header
raised:   2 reports, earliest 2026-08-10 · sources: TASK-UIBUILD-LOG.md, TASK-NAVMOTION-REPORT.md
checked:  Unchanged; the options file still exists in docs/reference/.
rank:     3
moot?:
if kept:  Look at three pictures and pick one.

### 169. One overflow fix is still unmade in the document editor
what:     A label that never wraps sits inside a narrow grid cell in the document editor, which can push the page sideways on a phone.
where:    Contracts — editor
raised:   2 reports, earliest 2026-08-11 · sources: TASK-FRAMESCROLL-REPORT.md
checked:  Half is fixed: the grid now has a zero minimum. The never-wrap label is still there (ClauseDocument.tsx:563).
rank:     3
moot?:
if kept:  One class.

### 170. A frozen file was edited before anyone knew it was frozen
what:     A file that was off limits was edited without knowing, and the edit was left in place pending your ruling.
where:    Contracts — editor
raised:   1 report, 2026-08-10 · sources: TASK-LEASEFIX-REPORT.md
checked:  That file has since been edited by other work, so the freeze is no longer in force.
rank:     3
moot?:
if kept:  Nothing to do — the freeze lapsed.

### 171. Fields you cannot edit are greyed out as well as explained
what:     Fields belonging to the other party are both dimmed and explained by a tooltip; you said you preferred the tooltip instead of greying out.
where:    Contracts — editor
raised:   1 report, 2026-08-06 · sources: TASK-CHECKBOXTIP-REPORT.md
checked:  Dimming is still applied.
rank:     3
moot?:
if kept:  One line to remove the dimming.

### 172. Two account sections need a design decision before expanding
what:     My Lessons and Documents cannot be expanded inline on the account page without a decision about their network calls and height.
where:    Member app — Account
raised:   1 report, 2026-08-07 · sources: TASK-ACCOUNTSURFACE-PHASE1.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  One decision each.

### 173. An unfinished added item is saved per browser
what:     A half-written added clause is kept in the browser, not the account, so two staff on one document keep separate drafts.
where:    Contracts — add item
raised:   1 report, 2026-08-12 · sources: TASK-ADDITEM-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  A server-side draft is a separate spec.

### 174. Staff have no landing page
what:     Two staff landing pages exist and neither is reachable, so an instructor lands nowhere.
where:    Staff app
raised:   6 reports, earliest 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE1.md, TASK-ADMINSWEEP-PHASE2.md, TASK-DASHLEADS-REPORT.md, TASK-DUPECENSUS-REPORT.md
checked:  Both pages still exist; the instructor preview route is still the only way to see one, and no menu row points at either.
rank:     3
moot?:
if kept:  Pick one, wire it, retire the other. Your earlier word was "wire up, don't retire".

### 175. The lead-alert address can only be changed in the database
what:     Every lead alert goes to one address that has no editing screen — changing it needs a developer.
where:    Notifications
raised:   1 report, 2026-08-12 · sources: TASK-INBOUNDALERT-REPORT.md
checked:  Prod: the value is still in configuration with no screen reading or writing it.
rank:     3
moot?:
if kept:  One field on the branding screen.

### 176. Two missed leads were never followed up
what:     Two enquiries were missed before alerts existed, and nobody went back to them.
where:    Leads
raised:   1 report, 2026-08-12 · sources: TASK-INBOUNDALERT-REPORT.md
checked:  Prod: both still sit in the queue with no alert record.
rank:     3
moot?:
if kept:  Yours to act on, not a code change.

### 177. The support email cannot arrive until a branch merges
what:     The support-request email points at an endpoint that only exists on an unmerged branch.
where:    Email — support
raised:   1 report, 2026-08-04 · sources: TASK-B-REPORT.md
checked:  The endpoint file exists on main today, so this may be resolved — but no send has ever been confirmed (see item 32 group).
rank:     3
moot?:
if kept:  Send one support request and check it arrives.

### 178. Email wording still cannot be edited without a developer
what:     The email wording is out of the code and into the database, but there is still no screen to edit it.
where:    Email — templates
raised:   2 reports, earliest 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md, TASK-TEXTEDIT-REPORT.md
checked:  Prod: the editing functions exist; no page calls them for emails.
rank:     3
moot?:
if kept:  An Emails tab on the templates screen — named as the follow-up when this was built.

### 179. Whether "contacted" leads count as open
what:     The open-lead count now includes leads someone has already contacted, which is a one-line change if you wanted "untouched only".
where:    Staff app — Leads
raised:   1 report, 2026-08-11 · sources: TASK-LEADCLEAN-REPORT.md
checked:  Prod: the counting rule is unchanged.
rank:     3
moot?:
if kept:  One line either way.

### 180. Two enquiries are still not linked to a person
what:     Two enquiries have no person attached, left that way deliberately; whether they and future ones get linked is unanswered.
where:    Leads
raised:   2 reports, earliest 2026-08-12 · sources: TASK-REQTRIGGER-REPORT.md, TASK-LEADCLEAN-REPORT.md
checked:  Prod, re-run: 2 of 16 enquiries have no person — down from every row, since the trigger now works.
rank:     3
moot?:
if kept:  A two-row backfill.

### 181. A held migration must be applied in the right order
what:     A parked invitation migration must be applied only after the front end deploys, or regenerating a link would leave two live links.
where:    Identity — invitations
raised:   1 report, 2026-08-11 · sources: TASK-INVITEWORKS-REPORT.md
checked:  Still parked (see item 76).
rank:     3
moot?:
if kept:  Sequence it with item 76.

### 182. Four decisions in the deal build were never signed off
what:     Four decisions were made without sign-off: removing hand-entry of a co-buyer, auto-generating documents on deal creation, a fallback deal name, and excluding voided documents from the export.
where:    Deals
raised:   4 reports, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  All four are still in the code as described.
rank:     3
moot?:
if kept:  Confirm or reverse each; the first one deletes a capability you asked for.

### 183. The deal-workflow inventory was requested twice and never produced
what:     The document another thread was blocked on was asked for twice and never written.
where:    Deals
raised:   1 report, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  No such document exists in docs/.
rank:     3
moot?:
if kept:  Decide whether it is still needed.

### 184. The deal-record button exists in only one place
what:     The button that produces a deal record is only on the deal page, not on the list or on a person's or horse's record.
where:    Deals
raised:   1 report, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Three more placements.

### 185. Test accounts, contacts and documents are still in production
what:     Several test accounts, contacts, purchases and documents were deliberately left in production waiting for your word.
where:    Production data
raised:   7 reports, earliest 2026-08-02 · sources: TASK-INVITEWORKS-REPORT.md, TASK-INVITEFLOW-REPORT.md, POST_RUN_CLOSEOUT.md, HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Prod: the test identities and their rows are still present, per your standing rule that the purge is owner-run.
rank:     3
moot?:
if kept:  One purge run, when you say.

### 186. Two duplicate contacts are deliberately not merged
what:     A duplicate pair of contacts for the same person is left unmerged because one of them is a live party on a draft.
where:    Identity
raised:   1 report, 2026-08-01 · sources: PROMPT_A_STAGES_1-3.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Merge after that draft is resolved.

### 187. One person holds two blank-horse drafts
what:     One client holds two drafts that name no horse, and the supersession rule you settle will govern what happens to them.
where:    Documents
raised:   1 report, 2026-08-10 · sources: TASK-SUPERSEDE-REPORT.md
checked:  Prod: the supersession is now horse-scoped, which makes item 105's blank-horse question the deciding one.
rank:     3
moot?:
if kept:  Answer item 105 and this follows.

### 188. Two whole phases of the hardening plan were never started
what:     The last two phases of an earlier hardening plan (insurance and legacy retirement) were never begun, and their gates still stand.
where:    Database
raised:   1 report, 2026-08-01 · sources: PROMPT_A_STAGES_1-3.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  Re-scope against what has landed since — much of it has been overtaken.

### 189. Everything one audit found outside the fix's scope is untouched
what:     An audit's findings that were outside the fix task's scope were never picked up by anything.
where:    Security
raised:   1 report, 2026-08-07 · sources: TASK-SECFIX-REPORT.md
checked:  Those findings are items 35-44 on this sheet — this family is the pointer, not new work.
rank:     3
moot?:
if kept:  Nothing extra — it is covered above.

### 190. A written refactor is dry-run and unapplied
what:     A refactor that stops duplicate document generation is written and proven and was deliberately not applied.
where:    Documents — onboarding
raised:   1 report, 2026-08-10 · sources: TASK-SENDGUARD-REPORT.md
checked:  Prod: the migration file exists in the journal; the reuse path it describes is not in the live function.
rank:     3
moot?:
if kept:  Review and apply, or discard it.

### 191. Whether staff may override a refusal to send
what:     When the system refuses to send a document for signing, whether staff may override is unanswered — the recommendation was "ask for a re-signature" rather than a "send anyway" button.
where:    Contracts
raised:   1 report, 2026-08-10 · sources: TASK-SENDGUARD-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  One decision; a "send anyway" button would silently answer six other questions.

### 192. What happens to a child's records if the guardian is removed
what:     If a guardian is deleted or merged, what happens to the minor's records was left out of scope.
where:    Identity — minors
raised:   1 report, 2026-08-04 · sources: TASK-C10-REPORT.md
checked:  Unchanged.
rank:     3
moot?:
if kept:  One rule.

### 193. The kiosk does not check age before a release is signed
what:     The kiosk does not detect that the signer is a minor before they sign a release.
where:    Kiosk
raised:   1 report, 2026-08-04 · sources: TASK-C10-REPORT.md
checked:  Unchanged; the form's date-of-birth check was not touched.
rank:     3
moot?:
if kept:  One check at the kiosk.

### 194. The barn-ops module rename was deferred
what:     Renaming the barn-ops module family to your chosen word was deferred because the file was contended.
where:    Staff app — barn ops
raised:   2 reports, 2026-08 · sources: TASK-FACILITYTERM-REPORT.md
checked:  Prod: the module key is unchanged; the internal-key-forever question is unanswered.
rank:     3
moot?:
if kept:  Confirm the key stays internal, then the visible words are already data.

### 195. Confirm the word for the property
what:     The system was set up using "ranch" as your word for the property, taken from a sentence you wrote rather than a confirmation.
where:    Tenant settings
raised:   1 report, 2026-08 · sources: TASK-FACILITYTERM-REPORT.md
checked:  Prod: the term is stored as configured.
rank:     3
moot?:
if kept:  One word.

### 196. The onboarding packet's name is an open pick
what:     The name shown for the onboarding packet is a default nobody chose.
where:    Staff app — client documents
raised:   1 report, 2026-08-11 · sources: TASK-DOCPACKET-REPORT.md
checked:  Unchanged — one string.
rank:     3
moot?:
if kept:  Pick a name.

### 197. One account's phone number has a third writer
what:     A staff editor writes a phone number directly onto an account, which is why an old column could not be retired.
where:    Identity
raised:   1 report, 2026-08-02 · sources: PROMPT_A_STAGES_4-5.md
checked:  Unchanged; the platform account still has no contact-side path.
rank:     3
moot?:
if kept:  Either give that account a contact row or accept the third writer.
