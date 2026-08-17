# DECIDE — every flagged item that survived machine-closing

**This is your keep-or-remove sheet.** Go down it saying *keep* or *remove*. Nothing here has been
decided for you; nothing was removed except on evidence, and the evidence for each removal is in
`CLOSED.md` next door.

```
975 raw flags  →  609 families (deduped within and across all 8 slices)
                  ─  61 machine-closed (resolved / superseded, evidence in CLOSED.md)
                  ─  13 duplicate pointers folded into another family
                  =  535 awaiting your decision
                     shown as 438 blocks below — 37 of them group several
                     same-shape record-only families and say how many
```

**Rank split of the 438 blocks:** rank 1 live defect **21** · rank 2 security or data integrity **61**
· rank 3 blocked or owed a decision **123** · rank 4 unviewed inventory **37** ·
rank 5 correctness/consistency **113** · rank 6 cosmetic/cleanup/record-only **83**.
**14 are flagged `MOOT?` and sit at the top** — the screen they concern is being rewritten this week;
3 more items further down carry a `moot?:` note as well.

**Where the weight is:** items 198-201 (nothing has ever been looked at on a screen) sit under
**62 reports** between them, and items 21-34 (the database's default-open permissions) are one root
cause with thirteen symptoms. Deciding those two groups first collapses about a fifth of the sheet.

## Every rank-1 item, by title (block number in brackets)
- A Sign button in the document viewer that always fails for an individual party **[1]**
- Two documents point at a contract that no longer exists — signing either will error **[2]**
- …and any other staff action on those two aborts as well **[3]**
- A member's document count says 13 on one page and 5 on another **[4]**
- A blank insurance answer prints as if the Lessee promised coverage **[5]**
- Every lease prints "…fair market value of." with nothing after it **[6]**
- An active contract template would print raw {{placeholders}} to a signer **[7]**
- Two more active templates have completely empty bodies **[8]**
- The retainer and representation agreements cannot be completed **[9]**
- Money in a draft rendered as a bare number — fixed, unseen **[10]**
- New people land on the wrong list whatever tab you used **[11]**
- Every row of the instructor's day says "Client" **[12]**
- Editing one field of a booking silently wipes four of its links **[13]**
- Contact preferences save on every keystroke and hide failures **[14]**
- A failed dashboard read shows "you're all caught up" **[15]**
- The calendar's "Review & sign paperwork" button goes nowhere **[16]**
- A cancelled lesson still reads as Scheduled **[17]**
- The gift "Resend" button has never sent an email **[18]**
- Activating an account wipes the person's standing categories **[19]**
- Breed and colour cannot take a typed-in value **[20]**
- The horse-care page's main button goes nowhere **[M2, flagged moot]**

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

---

# RANK 4 — UNVIEWED INVENTORY (built, or half-built, and nobody has looked)

### 198. Nothing in the staff app has ever been seen on a screen
what:     Across sixty-plus reports, no staff screen has ever been opened in a browser — every claim about how anything looks or behaves is read from code.
where:    Whole staff app
raised:   62 reports, earliest 2026-08-04 · sources: 62 task reports incl. TASK-PAGEVIS, TASK-RECORDS, TASK-DOCCOLS, TASK-ONEAUTHOR, TASK-BOOKWRITE, TASK-UPLOADS, TASK-ADDITEM
checked:  Confirmed structurally: no worktree carries app credentials; every report since 2026-08-05 records the same wall. The accumulated checklists are still unrun.
rank:     4
moot?:
if kept:  One session with a real login and the accumulated checklists — the single highest-leverage item on this sheet.

### 199. Nothing on the member side has been seen either
what:     The member-side flows (gift redemption, community, session notes, the signing wall's return) have never been used by a real member account.
where:    Whole member app
raised:   6 reports, earliest 2026-08-06 · sources: verified-IDENTITY.md ID-57/62/94/95/96/98
checked:  All named surfaces still exist unchanged; a rider-group login is needed, not a staff one.
rank:     4
moot?:
if kept:  A second session as a member.

### 200. Nothing has been checked on a real phone
what:     The scroll behaviour, the landscape header and the tap behaviours have never been tried on a physical phone, and emulators lie about exactly these.
where:    Mobile
raised:   6 reports, earliest 2026-08-06 · sources: TASK-UIBUILD-LOG.md, TASK-NAVMOTION-REPORT.md, TASK-HEADER-REPORT.md, TASK-TIPTAP-REPORT.md, TASK-ONEMENU-REPORT.md
checked:  Unchanged; the landscape tier is deliberately keyed so a resized desktop window will never trigger it.
rank:     4
moot?:
if kept:  Ten minutes with a phone, rotated.

### 201. No working copy can run the app
what:     The working copies carry database credentials but no app credentials, so the app cannot be started, the build cannot finish, and no PDF can be produced.
where:    Environment
raised:   5 reports, earliest 2026-08-05 · sources: TASK-ACCOUNTSURFACE-REPORT.md, TASK-FRAMESCROLL-REPORT.md, TASK-I1B-REPORT.md, TASK-LEASEFORK-REPORT.md
checked:  Confirmed: this checkout has no .env; the build's prerender step is the reported failure and cannot be reproduced or refuted here.
rank:     4
moot?:
if kept:  Give one working copy real credentials — it unblocks items 198-200.

### 202. The database test suite proves nothing today
what:     The database test suite is red on the main branch, so it cannot be cited as evidence either way.
where:    Tests
raised:   17 reports, earliest 2026-08-02 · sources: POST_RUN_CLOSEOUT.md, TASK-TESTDB-REPORT.md and 15 others
checked:  Not re-run this pass (and never citable as proof); the causes are items 84, 203-206.
rank:     4
moot?:
if kept:  Fix the four named causes and the suite protects something again.

### 203. One broken migration makes a fresh database impossible
what:     One migration fails, so the schema cannot be rebuilt from scratch — which is why the tests load a snapshot instead.
where:    Tests, migrations
raised:   1 report, 2026-08-01 · sources: PROMPT_A_STAGES_1-3.md
checked:  Unchanged.
rank:     4
moot?:
if kept:  One migration fixed.

### 204. Two placeholder vocabularies exist side by side
what:     There are two separate lists of document placeholders — one of 360 rows and one of 667 — and the editor draws from both.
where:    Templates
raised:   1 report, 2026-08-12 · sources: TASK-TOKENAUDIT-REPORT.md
checked:  Prod, re-counted: 360 rows in the older list; the clause-engine list is the healthier one.
rank:     4
moot?:
if kept:  Decide which is authoritative before anyone edits either.

### 205. Nothing has ever been added to a contract by hand
what:     The add-an-item feature has never been used in production — no author-added content exists.
where:    Contracts — add item
raised:   1 report, 2026-08-12 · sources: TASK-ADDITEM-REPORT.md
checked:  Prod: 609 contract field rows, none author-added.
rank:     4
moot?:
if kept:  Add one item to a test document and see what happens.

### 206. Before the small contact form goes, three things must be carried
what:     If the small four-field contact form is retired, its validation, its field components and a create path that files people correctly must be rebuilt on the survivor.
where:    Staff app — Records
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Nothing is retired: both editors are still reachable.
rank:     4
moot?:
if kept:  A checklist on whichever task retires it.

### 207. Four invitation follow-ups were never started
what:     Four follow-ups from the invitation work were queued and never begun; two have since been overtaken.
where:    Identity — invitations
raised:   1 report, 2026-08-10 · sources: TASK-INVITEFLOW-REPORT.md
checked:  The filing control and the contact-edit mode now exist (the latter is item 208's duplicate problem); the booking calendar and invite-page fields have no record of completion.
rank:     4
moot?:
if kept:  Two of the four remain.

### 208. No client has ever bought a horse-care service
what:     Nothing in the system has ever recorded a horse-care service being consumed, so that whole side is untested against real data.
where:    Horse care
raised:   1 report, 2026-08-10 · sources: TASK-ROSTER-REPORT.md
checked:  Prod: bookings still carry almost no client or purchase links, so the join has nothing to attach to.
rank:     4
moot?:
if kept:  One real horse-care purchase would exercise it.

### 209. The gift customer branch has never run against real stock
what:     The rule that marks a gift buyer as a customer has only ever been tested with an invented product; there is no physical product in the catalogue.
where:    Gifts
raised:   1 report, 2026-08-11 · sources: TASK-GIFTCREDITS-REPORT.md
checked:  Prod: 26 active offerings, all services; the gifts table holds 0 rows.
rank:     4
moot?:
if kept:  Untestable until you sell a product.

### 210. There is no admin view of orders
what:     Staff have nowhere to see the business's orders — the orders page is the member's own and is hidden from staff.
where:    Staff app
raised:   1 report, 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE1.md
checked:  No such route or reader exists (grep → 0 hits). The payment-review page is the nearest thing and it is payment-only.
rank:     4
moot?:
if kept:  One page over data that already exists.

### 211. A whole financial back end exists that nothing ever ran
what:     A sales, profit-and-loss and expenses back end was written as a migration that was never applied and has no screens.
where:    Business admin
raised:   1 report, 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE1.md
checked:  Prod, re-run: none of the three functions exist, so the migration was never applied; nothing in src/ reads them.
rank:     4
moot?:
if kept:  Decide whether that back end is wanted before it is applied.

### 212. The horse-records section has no menu row
what:     The horse-records hub has no menu row, and the note says to restore it with its module key or it will show to tenants who do not have the module.
where:    Staff app — Records
raised:   1 report, 2026-08-12 · sources: TASK-REVIEWNAV-REPORT.md
checked:  The layout file still carries the commented-out row with the instruction; the module is on in production.
rank:     4
moot?:
if kept:  Restore one row, with its module key.

### 213. Saved Content can never contain anything
what:     The Saved Content section and its menu link exist, but there is no way to save anything and no place to store it.
where:    Member app — Saved Content
raised:   2 reports, earliest 2026-08-04 · sources: TASK-I-REPORT.md, TASK-ACCTEVAL-REPORT.md
checked:  Prod: the presence function still returns "saved: false" as a literal; no save control exists in src/.
rank:     4
moot?:
if kept:  Build bookmarking, or remove the section.

### 214. The legacy account page is dead and duplicates two things
what:     The old public account page bounces members away, and duplicates an order-status list and a money formatter that live elsewhere.
where:    Public site — /account
raised:   2 reports, earliest 2026-08-06 · sources: TASK-DUPECENSUS-REPORT.md, TASK-ACCTEVAL-REPORT.md
checked:  It has changed since the baseline but still holds both duplicates and is still where two-factor lives (item 44).
rank:     4
moot?:
if kept:  Retire it once two-factor has a home.

### 215. Three horse pages read the same list
what:     Three separate horse screens read the same roster; one of them is unreachable, and it is the only one that turns breed and colour codes into names.
where:    Staff app — horses
raised:   4 reports, earliest 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE1.md, TASK-DUPECENSUS-REPORT.md
checked:  The page-merge work retired the redundant roster; the unreachable page still has no menu row (grep → 0 hits).
rank:     4
moot?:
if kept:  Harvest the breed/colour lookup into the survivor before retiring the loser.

### 216. A module is switched on with nothing behind it
what:     The brokerage module is switched on for the tenant with no page and no menu row — its row was removed because it produced a 404.
where:    Staff app — modules
raised:   2 reports, earliest 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE1.md
checked:  Prod: the module is enabled; the layout file still records why the row was removed.
rank:     4
moot?:
if kept:  Build the page, or stop a module without a page from being switched on.

### 217. Horse-care services exist in the catalogue with no staff screen
what:     Twelve horse-care services exist in the catalogue with no page, no menu row and no module — and four were added after this was first raised, so someone is maintaining them through a screen that does not exist.
where:    Staff app — horse care
raised:   2 reports, earliest 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE1.md
checked:  Prod: 12 active horse-segment offerings; no staff surface names that segment (grep → 0 hits).
rank:     4
moot?:
if kept:  Worth asking where you are editing them today.

### 218. Six menu items must survive the menu merge or be lost
what:     Six items that lived in the avatar menu (account, catalog, messages, the tour, sign out, saved content) must land in the merged menu or disappear.
where:    App — navigation
raised:   1 report, 2026-08-07 · sources: TASK-ONEMENU-PHASE1-PLAN.md
checked:  Account and sign out are now in the menu; the tour, catalog, messages and saved content have not been reconciled.
rank:     4
moot?:
if kept:  A four-item checklist.

### 219. Seventy-one of eighty pages do not use the page frame
what:     Most in-app pages hand-write their own heading instead of using the shared page frame, and two routed pages have no title at all.
where:    Whole app
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Nine pages were converted since; the remainder is unchanged. The frame is young, so this is a backfill, not a discipline problem.
rank:     4
moot?:
if kept:  Mechanical, page by page.

### 220. The module launcher exists on one page nobody can reach
what:     The six module tiles exist only on a page reachable by typing its address, and there is no other launcher in the app.
where:    Staff app
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Unchanged; that page is item 174's orphan.
rank:     4
moot?:
if kept:  Carry the launcher before that page is retired.

### 221. The email templates were never compared for duplication
what:     Nineteen emails across sixteen files were never compared against each other for duplicated wording or structure.
where:    Email
raised:   2 reports, earliest 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md, TASK-EMAILEXTRACT-REPORT.md
checked:  The wording is now in the database, which makes the comparison easy and still not done.
rank:     4
moot?:
if kept:  One pass over the template rows.

### 222. Nobody has booked against a gifted credit
what:     Whether a gift recipient's booking actually consumes the gifted credit has never been tested end to end.
where:    Gifts, bookings
raised:   1 report, 2026-08-11 · sources: TASK-GIFTCREDITS-REPORT.md
checked:  Prod: 0 gifts, 3 credits. The credit work since has changed how credits are minted and spent, so this is worth testing on the new spine.
rank:     4
moot?:
if kept:  One test gift.

### 223. Marketing does not exist at all
what:     There is no campaign, audience, schedule or performance data anywhere — marketing is absent at the foundation.
where:    Business admin
raised:   1 report, 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE1.md
checked:  Prod: no such tables. Unchanged.
rank:     4
moot?:
if kept:  A product decision, not a fix.

### 224. There is no view of what the lessons business is carrying
what:     Neither the lessons hub nor the sessions board shows outstanding obligations — what has been sold and not yet delivered.
where:    Staff app — Lessons
raised:   1 report, 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE1.md
checked:  The credit work has since built the ledger this view would read, so the data now exists.
rank:     4
moot?:
if kept:  One page over the new ledger.

### 225. Four areas were never examined for duplication
what:     The duplication census never reached the server endpoints, the migrations, the platform pages or the styling.
where:    Codebase
raised:   3 reports, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Unchanged.
rank:     4
moot?:
if kept:  Four smaller passes.

### 226. The two biggest files were never examined internally
what:     The two largest files in the app (128KB and 130KB) were never checked for duplication inside themselves.
where:    Codebase
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Measured today: both still that size.
rank:     4
moot?:
if kept:  A task of its own, with a merge freeze.

### 227. Badges are promised by a design and do not exist
what:     A design asked for badges and there is no badge data anywhere, so the slot was left out rather than faked.
where:    Member app
raised:   1 report, 2026-08-05 · sources: TASK-PROFILE-REPORT.md
checked:  Unchanged.
rank:     4
moot?:
if kept:  Decide whether badges are a real product.

### 228. The older backlog items were never picked up
what:     The pre-existing backlog (business admin suite, a broken view, a dead route, placeholder images) was untouched by all of this work.
where:    Backlog
raised:   2 reports, earliest 2026-08-02 · sources: POST_RUN_CLOSEOUT.md
checked:  One of the four (the broken view) is now gone; the others are unchanged.
rank:     4
moot?:
if kept:  Re-read the backlog against this sheet before anything else.

### 229. The PDF version of a document cannot be reviewed
what:     The third way a document gets rendered — as a PDF — has no page, so it cannot be compared against the two on-screen versions.
where:    Documents
raised:   1 report, 2026-08-12 · sources: TASK-REVIEWNAV-REPORT.md
checked:  Unchanged; the suggestion was to email a signed copy and compare that.
rank:     4
moot?:
if kept:  Email one signed copy to yourself.

### 230. Emailing yourself a copy and downloading a signed PDF were never reachable
what:     Two member actions — email me a copy, and download the signed document — were never reachable, so neither is confirmed to work.
where:    Member app — documents
raised:   3 reports, earliest 2026-08-04 · sources: TASK-A-PARTY-VERIFY-REPORT.md, TASK-DOCVIS-REPORT.md
checked:  Both controls still exist; the party-read policies added since should now make them reachable, which has never been confirmed.
rank:     4
moot?:
if kept:  Two clicks in the member session of item 199.

---

# RANK 5 — CORRECTNESS AND CONSISTENCY

### 231. The admin gate was only ever tested by pretending
what:     The check that decides who is an administrator has only been tested by simulating a login, never by observing one.
where:    Security
raised:   2 reports, earliest 2026-08-10 · sources: TASK-ROSTER-REPORT.md, TASK-ONEMENU-REPORT.md
checked:  Same wall as item 198; a database connection has no signed-in user.
rank:     5
moot?:
if kept:  Fold into item 198.

### 232. The security audits are code readings, not demonstrations
what:     "No guard" means the code has no check, not that anyone proved the call succeeds — so the counts may overstate the real exposure.
where:    Security
raised:   14 reports, earliest 2026-08-07 · sources: TASK-NOGUARD1/2/3, TASK-NULLUID-REPORT.md
checked:  Confirmed: nothing was executed, by instruction. Some counts already proved high.
rank:     5
moot?:
if kept:  Nothing — this is the honest caveat on items 21-34.

### 233. A hand-maintained test list silently breaks suites
what:     The test setup copies a hand-written list of tables; anything missing from it fails a suite silently.
where:    Tests
raised:   2 reports, earliest 2026-08-07 · sources: TASK-TESTDB-REPORT.md, TASK-WALLRETURN-REPORT.md
checked:  Unchanged; seven were found by chasing failures and there is no guard for the eighth.
rank:     5
moot?:
if kept:  Derive the list instead of writing it.

### 234. Sixteen tests can never pass
what:     Sixteen tests assert that permissions were removed, and the test setup grants everything, so they cannot pass however correct production is.
where:    Tests
raised:   1 report, 2026-08-12 · sources: TASK-TESTDB-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Either carry grants into the fixture or delete the assertions.

### 235. Two test files reference things that no longer exist
what:     Two test files call a method and import a module that do not exist.
where:    Tests
raised:   2 reports, earliest 2026-08-02 · sources: POST_RUN_CLOSEOUT.md, PROMPT_A_STAGES_4-5.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Two small fixes.

### 236. Tests assume modules are off that are all on
what:     A group of tests assume this tenant has modules switched off; production has all six on.
where:    Tests
raised:   1 report, 2026-08-12 · sources: TASK-TESTDB-REPORT.md
checked:  Prod: all six modules enabled. The mechanism is fine; the tests need a second tenant as the "off" case.
rank:     5
moot?:
if kept:  Add a rival tenant to the fixture.

### 237. Thirty-one migrations cannot be replayed
what:     About thirty-one migrations rewrite existing functions in place, so they do nothing on a fresh database — a known property, not a bug.
where:    Migrations
raised:   2 reports, earliest 2026-08-02 · sources: PROMPT_A_STAGES_4-5.md, TASK-WALLSYNC-REPORT.md
checked:  Recorded in CLAUDE.md; unchanged.
rank:     5
moot?:
if kept:  Nothing, unless a from-scratch rebuild is ever wanted.

### 238. One interface test fails on a clean tree
what:     One interface test has failed on the main branch for days, unrelated to any task.
where:    Tests
raised:   6 reports, earliest 2026-08-11 · sources: TASK-GOOGLEAUTH-REPORT.md, TASK-PAGEVIS-REPORT.md, TASK-RECORDS-REPORT.md, TASK-INBOUNDALERT-REPORT.md
checked:  Half of this is resolved: the second failing file was deleted since the baseline. The first still exists and its subject (the create menu's default) has since changed.
rank:     5
moot?:
if kept:  Run it once; a real failure would mean the create menu regressed.

### 239. The one test that caught a real bug was thrown away
what:     A throwaway test caught a permanently-broken tooltip that every committed check passed; it was deleted rather than kept.
where:    Tests
raised:   2 reports, earliest 2026-08-06 · sources: TASK-TIPTAP-REPORT.md, TASK-CHECKBOXTIP-REPORT.md
checked:  Unchanged; that class of bug is still invisible to the committed checks.
rank:     5
moot?:
if kept:  Reconstruct it and commit it.

### 240. The database moves while tasks read it
what:     Several threads work against the same live database at once, so counts change mid-task and snapshots go stale.
where:    Process
raised:   3 reports, earliest 2026-08-10 · sources: TASK-NOGUARD2-REPORT.md, TASK-NOGUARD3-REPORT.md
checked:  Confirmed again this pass: several counts differ from the reports by a few rows.
rank:     5
moot?:
if kept:  Nothing — but every count on this sheet is a point in time.

### 241. Copied facts go stale within hours
what:     Task documents and lists of retired pages go stale within hours, and anything that copies them is wrong soon after.
where:    Process
raised:   2 reports, earliest 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Proven again this pass: one copied sentence on the Review page contradicts the code (item 267).
rank:     5
moot?:
if kept:  Derive, never copy — worth writing into CLAUDE.md.

### 242. Dynamic SQL is invisible to every audit
what:     Two functions build their SQL at run time, so no audit method used can see what they do.
where:    Security
raised:   1 report, 2026-08-07 · sources: TASK-NOGUARD1-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Read those two by hand.

### 243. Why some contacts' details are hidden is unrecoverable
what:     Thirteen people have their contact details hidden and the correlation is exact, but no migration set them and the reason cannot be recovered.
where:    Community — directory
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: the correlation still holds exactly; no migration writes those flags.
rank:     5
moot?:
if kept:  Decide the intended default and set it deliberately.

### 244. A new account column will not be writable until someone remembers
what:     Account fields are granted one by one now, so a new field will silently fail to save until it is added to the list.
where:    Identity
raised:   1 report, 2026-08-07 · sources: TASK-SECFIX-REPORT.md
checked:  Prod: authenticated holds no table-level UPDATE, confirming the column list is in force.
rank:     5
moot?:
if kept:  It fails visibly on write — accepted maintenance cost.

### 245. Instructors see an empty invitations panel instead of a message
what:     The invitations panel is restricted to administrators, so an instructor sees nothing rather than "not for you".
where:    Staff app — invitations
raised:   1 report, 2026-08-11 · sources: TASK-INVITEWORKS-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  One policy widened, or a message.

### 246. Signature visibility uses a narrower rule than everything else
what:     Staff visibility of signatures is gated to administrators while the rest of the app treats instructors as staff.
where:    Documents — signatures
raised:   1 report, 2026-08-06 · sources: TASK-SIGREAD-REPORT.md
checked:  Prod: the policy list confirms it, alongside the new self-read policy.
rank:     5
moot?:
if kept:  One policy aligned with the other three.

### 247. Support requests require a login although the goal was a public form
what:     Support requests are built as a member feature although the stated goal was a public website form.
where:    Support
raised:   1 report, 2026-08-04 · sources: TASK-B-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Decide which it is.

### 248. Two staff screens duplicate each other the moment a module is on
what:     The team screen and the staff screen overlap: one owns roles and invitations, the other owns title and pay.
where:    Staff app — team
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Prod: the employees module is on, so the overlap is live now, not hypothetical.
rank:     5
moot?:
if kept:  Merge the two.

### 249. One email policy arm cannot be tested
what:     The instructor arm of the email-template permissions is proven only by reading the rule, because no instructor account exists.
where:    Email — templates
raised:   1 report, 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md
checked:  Unchanged; item 89 is the reason.
rank:     5
moot?:
if kept:  Closes itself once an instructor account exists.

### 250. The document-integrity check only looks one way
what:     The check that finds documents missing fields does not flag documents holding fields their template no longer has.
where:    Documents
raised:   1 report, 2026-08-11 · sources: TASK-CONTRACTORPHAN-REPORT.md
checked:  Unchanged; two documents hold 26-27 stale fields.
rank:     5
moot?:
if kept:  A second check.

### 251. Two signed documents contain unfilled placeholders
what:     Two documents signed in July contain literal placeholder text, because they were generated before the fields existed.
where:    Documents
raised:   2 reports, earliest 2026-08-10 · sources: TASK-TOKENAUDIT-REPORT.md, TASK-HORSEDOCS-REPORT.md
checked:  Prod: unchanged, and signed documents are never rewritten.
rank:     5
moot?:
if kept:  A disposition, not a fix.

### 252. A function called "my documents" returns everyone's
what:     One reader named for the current person returns every contract in the business when staff call it — a trap if it is ever reused.
where:    Documents
raised:   1 report, 2026-08-12 · sources: TASK-COUNTFIX-REPORT.md
checked:  Prod: unchanged. Nothing reads it now, since its one consumer was fixed.
rank:     5
moot?:
if kept:  Rename it or split it.

### 253. Staff cannot reach their own documents
what:     A staff account has no menu route to its own paperwork.
where:    Staff app
raised:   2 reports, earliest 2026-08-12 · sources: TASK-COUNTFIX-REPORT.md, TASK-DUPECENSUS-REPORT.md
checked:  Unchanged: the member document rows are switched off for staff.
rank:     5
moot?:
if kept:  One row, or accept it.

### 254. Three different renderers draw a document body
what:     Three separate pieces of code draw a document's text, and one of them claims in a comment to be the only one.
where:    Documents
raised:   2 reports, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  All three still exist; the false comment is still there (ContractCascade.tsx:241).
rank:     5
moot?:
if kept:  Fix the comment now; consolidate later.

### 255. The same document looks different on two screens
what:     One document shows a tidy mark on one screen and raw bracket codes on another.
where:    Documents
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Both renderers unchanged in that respect.
rank:     5
moot?:
if kept:  Follows from item 254.

### 256. Three copies of one pattern, one already different
what:     The rule that finds a signature line is written three times and the PDF's copy already behaves differently from the other two.
where:    Documents
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Confirmed today: three definitions, and the PDF one tolerates leading spaces where the other two do not.
rank:     5
moot?:
if kept:  One shared constant — this is how the screen and the PDF drift apart.

### 257. Party columns order roles that have never been used
what:     The order in which parties are listed is a best guess over roles with no real data.
where:    Staff app — documents
raised:   1 report, 2026-08-11 · sources: TASK-DOCCOLS-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Confirm the order before it matters.

### 258. Only two parties are ever shown
what:     A document with three or more parties silently shows only two.
where:    Staff app — documents
raised:   1 report, 2026-08-11 · sources: TASK-DOCCOLS-REPORT.md
checked:  Unchanged; no live document has three.
rank:     5
moot?:
if kept:  One decision about the third.

### 259. A person-record link check was never re-verified
what:     Which person records staff can open was checked by reading the rules, not by using them.
where:    Staff app — records
raised:   1 report, 2026-08-11 · sources: TASK-DOCCOLS-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Fold into item 198.

### 260. Thirty-seven undelivered documents are excluded from alerts by design
what:     Thirty-seven signed documents were never emailed and are deliberately left out of the delivery-failure alerts.
where:    Email — delivery
raised:   1 report, 2026-08-05 · sources: TASK-A15-REPORT.md
checked:  Unchanged; they predate the stamping that alerts rely on.
rank:     5
moot?:
if kept:  Decide whether they get sent or written off.

### 261. Real bounces are invisible
what:     If a mail server accepts a message and then bounces it, nothing tells us — so the delivery-failure sweep cannot act on it.
where:    Email — delivery
raised:   1 report, 2026-08-04 · sources: TASK-A15-REPORT.md
checked:  Unchanged; the provider gives no bounce signal.
rank:     5
moot?:
if kept:  A different mail provider, or accept it.

### 262. Two lease clauses print labels with nothing after them
what:     Where the Lessor arranges farrier or vet care, the document prints "Farrier:" and "Veterinarian:" with nothing after them.
where:    Lease document — care
raised:   1 report, 2026-08 · sources: TASK-LEASESIMPLE-REPORT.md
checked:  Prod clause bodies unchanged.
rank:     5
moot?:
if kept:  Gate the labels with the fields.

### 263. A term used in four clauses is defined nowhere
what:     "FHE Approved Trainer" is used in four clauses of the lease and defined nowhere in it.
where:    Lease document
raised:   1 report, 2026-08 · sources: TASK-LEASESIMPLE-REPORT.md
checked:  Prod clause bodies unchanged.
rank:     5
moot?:
if kept:  One definition.

### 264. A payment-date field can never appear
what:     "First monthly payment date" is gated on a field that does not exist, so it can never show — in all three leases.
where:    Lease document — fees
raised:   2 reports, earliest 2026-08-07 · sources: TASK-LEASEFORK-REPORT.md, TASK-LEASESIMPLE-REPORT.md
checked:  Prod field defs unchanged.
rank:     5
moot?:
if kept:  Point the gate at a field that exists.

### 265. Two sections' lead-in text sits under the wrong heading
what:     A section's introduction and one of its clauses print under a heading neither belongs to.
where:    Lease document — care
raised:   1 report, 2026-08-04 · sources: TASK-R11-REPORT.md
checked:  Prod clause defs unchanged.
rank:     5
moot?:
if kept:  A content decision: give the intro a heading or move the clauses.

### 266. Placeholder clauses in the sale documents have no headings
what:     The "pending" clauses in the sale and bill-of-sale documents show no number and no title, so items appear to materialise from nowhere.
where:    Sale documents
raised:   1 report, 2026-08-04 · sources: TASK-R11-REPORT.md
checked:  Prod: the same one-line fix that was applied to the lease was never applied to these.
rank:     5
moot?:
if kept:  The same one-line fix, twice.

### 267. The Review page states something the code contradicts
what:     The Review page tells you two footer links point at the same page; they were fixed and the sentence was not.
where:    Staff app — Review
raised:   1 report, 2026-08-12 · sources: TASK-REVIEWNAV-REPORT.md
checked:  Footer.tsx now points them at different pages; src/lib/reviewSection.ts:224 still asserts the old state.
rank:     5
moot?:
if kept:  One sentence.

### 268. Deleting a composed element leaves its placeholder behind
what:     Removing an added element leaves its placeholder in the text, which is why the screen does not offer removal.
where:    Contracts — add item
raised:   1 report, 2026-08-12 · sources: TASK-ADDITEM-REPORT.md
checked:  Prod: unchanged.
rank:     5
moot?:
if kept:  Clear the placeholder on removal, then offer the control.

### 269. An unanswered line composes as a stub sentence
what:     A line whose only answer is missing prints as a sentence ending in a full stop with nothing before it.
where:    Contracts — composition
raised:   1 report, 2026-08-12 · sources: TASK-ADDITEM-REPORT.md
checked:  Prod: unchanged; the same family as items 5, 6 and 271.
rank:     5
moot?:
if kept:  One rule for empty answers, applied once.

### 270. A blank deductible prints a bare colon
what:     Leaving a deductible unselected prints "…borne by:" with nothing after it.
where:    Lease document — insurance
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod: unchanged, and documented in the composer as intended.
rank:     5
moot?:
if kept:  Same rule as item 269.

### 271. Blank split shares print an empty allocation
what:     If the split percentages are blank the document prints "paid by Lessor and paid by Lessee" with no numbers.
where:    Lease document — insurance
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod: unchanged.
rank:     5
moot?:
if kept:  Same rule as item 269.

### 272. The mortality and medical splits are not checked, the general one is
what:     The general-liability split is silently corrected to add up; the mortality and medical splits are not, so two identical-looking controls behave differently.
where:    Lease document — insurance
raised:   2 reports, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod: unchanged.
rank:     5
moot?:
if kept:  Apply the same normalisation to all three.

### 273. Choosing "Other" on a deductible leads nowhere
what:     Choosing "Other" prints the bare word "Other" and there is no field for what it means.
where:    Lease document — insurance
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod: the clearing branch still targets a field this template does not have.
rank:     5
moot?:
if kept:  Add the field, or remove the option.

### 274. A dead rule still tests three fields that do not exist
what:     One rule has no effect on this lease and still tests three fields the lease does not have.
where:    Lease document
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod: unchanged.
rank:     5
moot?:
if kept:  Delete the dead branch.

### 275. The one executed lease holds thirteen fields from a retired vocabulary
what:     The only executed lease carries thirteen insurance fields in a vocabulary the template no longer uses.
where:    Documents
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod: unchanged; the definition sync no longer touches executed documents.
rank:     5
moot?:
if kept:  Leave as evidence, or annotate.

### 276. A minor's status is read by no insurance rule
what:     Whether a rider is a minor is not read by any insurance field or clause.
where:    Lease document — insurance
raised:   1 report, 2026-08-07 · sources: TASK-LEASEMAP-REPORT.md
checked:  Prod: unchanged.
rank:     5
moot?:
if kept:  Decide whether it should be.

### 277. A gate-driving field renders twice
what:     A field that controls whether a clause appears renders twice: once as a control and once as inert text.
where:    Contracts — editor
raised:   1 report, 2026-08-06 · sources: TASK-A-PARTY-VERIFY-2-REPORT.md
checked:  Unchanged; flagged for the renderer rebuild.
rank:     5
moot?:
if kept:  Part of any renderer work.

### 278. The lease-availability feature parses the wrong shape
what:     The feature that turns lease days into calendar availability expects a comma list and the lease holds a sentence, so the days come out wrong — and it has never run.
where:    Lease, calendar
raised:   2 reports, 2026-08-12 · sources: TASK-BOOKWRITE-REPORT.md
checked:  Prod: unchanged; it was pointed at the archived template until recently.
rank:     5
moot?:
if kept:  Decide whether the feature is wanted before fixing the parsing.

### 279. Two contact editors on one page
what:     A person can be edited through a thirty-field dossier or a four-field form, and which you get depends on where you clicked.
where:    Staff app — Records
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Both still exist and are both reachable.
rank:     5
moot?:
if kept:  Pick one; item 206 is the carry-across list.

### 280. Nothing audited what reads the newly-filled enquiry link
what:     When enquiries started being linked to people, nobody checked what else reads that link with the old assumption.
where:    Leads
raised:   1 report, 2026-08-12 · sources: TASK-REQTRIGGER-REPORT.md
checked:  One consumer was checked and is consistent; the deliberate pass was never done.
rank:     5
moot?:
if kept:  One grep, honestly done.

### 281. A correction about the enquiry trigger, recorded
what:     A brief described a branch of the enquiry trigger that does not exist; the correction was recorded and nothing needed doing.
where:    Leads
raised:   1 report, 2026-08-12 · sources: TASK-REQTRIGGER-REPORT.md
checked:  Prod: confirmed again — the function has no such branch.
rank:     5
moot?:
if kept:  Nothing to do — this is a record.

### 282. A narrowing that will matter when gifts are finished
what:     A safety fix narrowed who can act on a gift with no buyer from any account holder to staff only — harmless now, real later.
where:    Gifts
raised:   1 report, 2026-08-10 · sources: TASK-NOGUARD2-REPORT.md
checked:  Prod: the narrowed guard is live and the gifts table holds 0 rows.
rank:     5
moot?:
if kept:  Note it in the gift work.

### 283. Three functions taking whole rows are untested
what:     Three functions that take an entire record as input were ranked low-risk by reasoning, never tested.
where:    Database
raised:   1 report, 2026-08-07 · sources: TASK-NOGUARD1-REPORT.md
checked:  No test exercises any of the three.
rank:     5
moot?:
if kept:  Three tests.

### 284. The booking gate's success path was never proven
what:     The rule that lets someone book a lesson was only proven to refuse, never to allow.
where:    Bookings
raised:   1 report, 2026-08-04 · sources: TASK-A13-REPORT.md
checked:  Prod: credits now exist where they did not, so the blocker has eased; no proof was ever run.
rank:     5
moot?:
if kept:  One test now that credits exist.

### 285. A required proof cannot be constructed
what:     A test that was asked for cannot be run, because a database rule makes the situation it tests impossible.
where:    Identity — company contact
raised:   2 reports, earliest 2026-08-05 · sources: TASK-COMPANYFIX-REPORT.md
checked:  Prod: the unique rule still makes a second company contact unrepresentable.
rank:     5
moot?:
if kept:  Re-scope the proof to two tenants, or accept it as unnecessary.

### 286. The account page's lessons row ignores whether lessons are on
what:     The Lessons row on the account page shows even when the module is off, promising a page that only shows a lock.
where:    Member app — Account
raised:   1 report, 2026-08-07 · sources: TASK-ACCOUNTSURFACE-PHASE1.md
checked:  Unchanged; latent for you because lessons are on.
rank:     5
moot?:
if kept:  One condition.

### 287. Emergency contacts are described as unchangeable and are not
what:     A card says emergency contacts cannot be edited; staff, onboarding and the member's own API session can all change them.
where:    Member app — Account
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: both writers still exist.
rank:     5
moot?:
if kept:  Change the wording, or make it true.

### 288. A link with a section in it may not switch the section
what:     Following a link that names a section while already on that page may not switch what is shown.
where:    Member app — Account
raised:   1 report, 2026-08-04 · sources: TASK-I-REPORT.md
checked:  Unchanged; nothing syncs the panel to the address.
rank:     5
moot?:
if kept:  One effect.

### 289. The Schedule page mislabels the staff view and forces a type
what:     The Schedule page heads the staff view "Your lessons" while listing the whole property's, and forces one data type into another.
where:    Staff app — Schedule
raised:   1 report, 2026-08-12 · sources: TASK-COUNTFIX-REPORT.md
checked:  The file has changed since the baseline; both issues are still described in it.
rank:     5
moot?:
if kept:  A heading and a type.

### 290. A phone number creates four contact channels, two of them WhatsApp
what:     Saving a phone number silently creates four community contact channels including two WhatsApp ones, with no check that WhatsApp exists.
where:    Community — directory
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Prod: the trigger is unchanged.
rank:     5
moot?:
if kept:  Ask before assuming WhatsApp.

### 291. Six fields a member fills are read by nothing
what:     Six fields on the account screen are consumed by no email, receipt or document — but the screen presents them as used.
where:    Member app — Account
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Wire them or stop asking.

### 292. A blanket safety fix would lock the platform account out
what:     Applying the obvious safety fix across all the guard functions would lock out the platform account, which is why it was done two at a time.
where:    Security
raised:   1 report, 2026-08-11 · sources: TASK-NOGUARD3-REPORT.md
checked:  Your ruling since says being denied is correct for that account, which makes the sweep safe.
rank:     5
moot?:
if kept:  The sweep is now unblocked by your own ruling.

### 293. The platform account's inbound count is always zero
what:     The platform account always sees zero waiting enquiries, because it belongs to no tenant.
where:    Staff app — dashboard
raised:   1 report, 2026-08-11 · sources: TASK-LEADCLEAN-REPORT.md
checked:  Prod: unchanged, and correct by your ruling that the platform account is not a tenant.
rank:     5
moot?:
if kept:  Nothing — this is expected.

### 294. Three accounts look like seed data and were never confirmed
what:     Three accounts look like test rows from their identifiers but nobody confirmed they are not real people.
where:    Identity
raised:   1 report, 2026-08-07 · sources: TASK-SECFIX2-REPORT.md
checked:  Prod: the same three rows are the ones failing their foreign keys in item 51.
rank:     5
moot?:
if kept:  Confirm and remove with item 51.

### 295. One post view lacks the guard its sibling has
what:     The author line in the post view can push the page sideways because it lacks the guard the identical pattern next door has.
where:    Community — post view
raised:   1 report, 2026-08-11 · sources: TASK-FRAMESCROLL-REPORT.md
checked:  File untouched since the baseline; the guard is still absent (grep → 0 hits).
rank:     5
moot?:
if kept:  One wrapper.

### 296. One menu row does not announce itself as current
what:     One of six menu components relies on the library to announce "you are here" instead of saying so; the other five say it explicitly.
where:    App — navigation
raised:   1 report, 2026-08-07 · sources: TASK-ONEMENU-PHASE1-PLAN.md
checked:  Unchanged — still the lone exception.
rank:     5
moot?:
if kept:  One attribute, for consistency.

### 297. The menu's shadow may be invisible
what:     The shadow added to the side menu projects on exactly the axis that menu clips, so it may not be visible at all.
where:    App — navigation
raised:   1 report, 2026-08-10 · sources: TASK-UIBUILD-LOG.md
checked:  The exact combination is still on both menus.
rank:     5
moot?:
if kept:  One screenshot settles it.

### 298. Under the platform header the menus start twenty pixels low
what:     The platform-owner header is shorter than the tenant one, but the menus position themselves for the tenant height.
where:    Platform app
raised:   1 report, 2026-08-08 · sources: TASK-ONEHEADER-REPORT.md
checked:  Unchanged; the variable that would fix it already exists.
rank:     5
moot?:
if kept:  One scoped override.

### 299. A newly added note carries no timestamp
what:     A note added to a session appears immediately with an empty timestamp, which will render as an invalid date the moment anything formats it.
where:    Lessons — session notes
raised:   1 report, 2026-08 · sources: TASK-F3-REPORT.md
checked:  Unchanged (SessionNotesView.tsx:45).
rank:     5
moot?:
if kept:  Refetch after saving, or omit the field.

### 300. The selected-menu underline is below the contrast floor
what:     The gold underline that marks the selected menu row measures below the accessibility floor for non-text marks.
where:    App — navigation
raised:   2 reports, earliest 2026-08-10 · sources: TASK-NAVMOTION-REPORT.md, TASK-UIBUILD-LOG.md
checked:  Unchanged; a darker gold that clears the floor is a one-token change and is recorded in the file.
rank:     5
moot?:
if kept:  One token, three places.

### 301. In the narrow menu, "you are here" is a shade of icon
what:     When the menu is collapsed there is no text to underline, so the only mark of the current page is a slightly darker icon.
where:    App — navigation
raised:   1 report, 2026-08-11 · sources: TASK-NAVMOTION-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  An edge marker or a dot in the collapsed state.

### 302. The platform menu dims to the tenant's brand colour
what:     The dimming behind the mobile menu became a tenant brand colour, including on the platform-owner's screens, on the strength of an argument that it was not branding.
where:    Platform app
raised:   1 report, 2026-08-07 · sources: TASK-ONEMENU-REPORT.md
checked:  Unchanged; the drawer body itself is correctly branched.
rank:     5
moot?:
if kept:  Scope the colour to tenants.

### 303. Administrators and instructors get different avatar menus
what:     Instructors see calendar, catalog and messages in the avatar menu and administrators do not, which reads as drift rather than design.
where:    App — navigation
raised:   1 report, 2026-08-07 · sources: TASK-ONEMENU-PHASE1-PLAN.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Confirm both should converge.

### 304. Hub cards still link to hidden pages
what:     Cards on the section hubs still link to pages that have been hidden, because hub cards are deliberately not filtered.
where:    Staff app — hubs
raised:   2 reports, earliest 2026-08-12 · sources: TASK-PAGEVIS-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Filter the cards, or accept it.

### 305. The document subheader has the same flicker defect
what:     The document page's subheader copied a hover style that flickers.
where:    Contracts — subheader
raised:   1 report, 2026-08-11 · sources: TASK-NAVMOTION-REPORT.md
checked:  Unchanged; one-token fix.
rank:     5
moot?:
if kept:  One token.

### 306. Three typography questions were left for a later pass
what:     The heading font ships in only two weights, runs larger than the old one, and is being thinned by a global setting.
where:    Design — typography
raised:   3 reports, 2026-08-06 · sources: TASK-HEADER-REPORT.md
checked:  Unchanged; the comments justifying the old font are still in the stylesheet.
rank:     5
moot?:
if kept:  One typography pass.

### 307. The dashboard shows three alerts and hides the rest silently
what:     The attention band shows three tiles with no "and N more", so up to fourteen items are hidden with no sign.
where:    Member app — Dashboard
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  The file has changed since the baseline; the expand control the leads band has is still absent here.
rank:     5
moot?:
if kept:  Copy the leads band's control.

### 308. The leads "more waiting" control cannot be tested with today's data
what:     There are fewer open leads than the preview shows, so the expand control never appears and cannot be checked.
where:    Staff app — Dashboard
raised:   1 report, 2026-08-11 · sources: TASK-LEADCLEAN-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Proven by test only until there are more leads.

### 309. Any menu placed inside a table will be clipped
what:     The table wrapper forces its own scrolling, so any future menu or popover inside a table cell will be cut off.
where:    Staff app — tables
raised:   1 report, 2026-08-11 · sources: TASK-FRAMESCROLL-REPORT.md
checked:  Unchanged; marked only by a comment.
rank:     5
moot?:
if kept:  A note in the component's docs, or a different wrapper.

### 310. The document table gets worse the more columns you show
what:     The document table already scrolls sideways and it gets worse with more columns switched on, because no page-level scroll container exists.
where:    Staff app — Documents
raised:   1 report, 2026-08-11 · sources: TASK-DOCCOLS-REPORT.md
checked:  A scroll wrapper was added to the table component since; the page-level behaviour is unverified.
rank:     5
moot?:
if kept:  Confirm in item 198's pass.

### 311. Three confirmed places where long text pushes the page sideways
what:     Three specific rows can push the page sideways on a narrow screen because a long email or reference has no wrapping guard.
where:    Staff app, platform app, order page
raised:   3 reports, 2026-08-11 · sources: TASK-FRAMESCROLL-REPORT.md
checked:  Two of the three files are unchanged since the baseline; the order page has changed for other reasons.
rank:     5
moot?:
if kept:  Three one-line guards.

### 312. Nineteen more places might do the same
what:     Nineteen further places were identified as possible but unconfirmed sideways-scroll risks.
where:    Whole app
raised:   2 reports, 2026-08-11 · sources: TASK-FRAMESCROLL-REPORT.md
checked:  Unconfirmed by construction — they need a narrow screen.
rank:     5
moot?:
if kept:  Fold into item 200's phone pass.

### 313. The co-owner grid can be squeezed flat
what:     The co-owner grid uses column widths with no lower limit, so long inputs can squash the row.
where:    Contracts — editor
raised:   1 report, 2026-08-11 · sources: TASK-FRAMESCROLL-REPORT.md
checked:  Unchanged (ContractCascade.tsx:546) — and the sibling file already fixed exactly this.
rank:     5
moot?:
if kept:  Copy the sibling's fix.

### 314. One label-and-field pair cannot fit a phone
what:     One label-and-input pair has a combined minimum wider than a small phone, deterministically.
where:    Contracts — editor
raised:   1 report, 2026-08-11 · sources: TASK-FRAMESCROLL-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  One class.

### 315. One tooltip variant was left with the same defect
what:     One tooltip variant shares the overflow and no-outside-tap-to-close problems that were fixed elsewhere.
where:    Contracts — editor
raised:   1 report, 2026-08-07 · sources: TASK-TIPTAP-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Apply the same fix.

### 316. The orders back button goes to the community feed
what:     The back button on the orders page inside the account goes to the community feed instead of back to the account.
where:    Member app — Orders
raised:   1 report, 2026-08-04 · sources: TASK-A-PARTY-VERIFY-REPORT.md
checked:  Never investigated; the file has changed since for other reasons.
rank:     5
moot?:
if kept:  One route.

### 317. Two dashboard tiles link to a page nobody can reach
what:     The two "coming up" tiles link to a page that has no menu row.
where:    Member app — Dashboard
raised:   1 report, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Point them wherever the time surfaces consolidate.

### 318. Alerts pack their details into the title
what:     Staff alerts have no body field, so every failure alert packs its details into the title.
where:    Notifications
raised:   1 report, 2026-08-11 · sources: TASK-GIFTCREDITS-REPORT.md
checked:  Prod, checked today: the function still takes only org, kind, title and link.
rank:     5
moot?:
if kept:  One parameter.

### 319. Email wording is shared across tenants
what:     Email wording has no tenant column, so a second tenant would get this tenant's words.
where:    Email — templates
raised:   1 report, 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md
checked:  Prod, checked today: no tenant column exists.
rank:     5
moot?:
if kept:  Correct now, revisit at the second tenant.

### 320. Every email is HTML only
what:     There is no plain-text alternative in any email, and the sending layer has no field for one.
where:    Email
raised:   1 report, 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Transport work first.

### 321. Three lists of labels are the last wording left in code
what:     Three lists that turn codes into words are the last email wording still in the code rather than editable.
where:    Email — enquiry alert
raised:   1 report, 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Move them with the rest.

### 322. The email renderer exists twice
what:     The email renderer is duplicated in a build script because that script cannot import the real one.
where:    Email
raised:   1 report, 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md
checked:  Unchanged; guarded by an assertion.
rank:     5
moot?:
if kept:  Accept the guard, or convert the script.

### 323. Two emails escape their text differently
what:     Two emails handle special characters differently, preserved exactly as found, and now visible as paired placeholders.
where:    Email
raised:   1 report, 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  One escaping policy — it changes output, so it needs your sign-off.

### 324. The from-address cannot be read from anywhere but the host
what:     Which address emails come from depends on a hosting setting nobody can read from the repo or the database.
where:    Email
raised:   1 report, 2026-08-05 · sources: TASK-A8-REPORT.md
checked:  Prod: the configuration key is unset, so the hosting variable is the only source.
rank:     5
moot?:
if kept:  Set it in configuration so it is visible.

### 325. One minor-protection branch has never been exercised
what:     The branch that protects a minor's evaluation report could not be tested because no report belongs to a minor.
where:    Email — evaluations
raised:   1 report, 2026-08-04 · sources: TASK-C10-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Untestable until real data exists.

### 326. A link that names an enquiry does not open it
what:     A link that carries an enquiry's identifier does not open that enquiry — the page ignores it.
where:    Staff app — enquiries
raised:   1 report, 2026-08-01 · sources: PROMPT_A_STAGES_1-3.md
checked:  That page is now retired behind a flag, so the link's target has moved.
rank:     5
moot?:
if kept:  Re-point or drop the link.

### 327. One credit-creating function exists twice
what:     The function that creates a lesson credit is written twice, so a change to one will be missed in the other.
where:    Lessons — credits
raised:   1 report, 2026-08-12 · sources: TASK-BOOKWRITE-REPORT.md
checked:  Both files have changed since (the credit work) — worth re-checking whether both copies survived.
rank:     5
moot?:
if kept:  One definition.

### 328. Creating a deal is two steps with no safety net
what:     Creating a deal makes the deal and then adds its documents; if the second step fails an empty deal is left behind.
where:    Deals
raised:   1 report, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  One transaction.

### 329. The deal statuses are only words on a screen
what:     The deal status names are display-only; the database still stores the old vocabulary, and a real rename would touch dozens of places.
where:    Deals
raised:   1 report, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Leave the display layer, or commit to the rename.

### 330. Bookings write no history
what:     Bookings are the one part of the business that writes no history, so a client whose only activity is booked lessons shows no activity at all.
where:    Bookings
raised:   1 report, 2026-08-11 · sources: TASK-ROSTERCARD-REPORT.md
checked:  Unchanged; twenty-nine other tables do write history.
rank:     5
moot?:
if kept:  One trigger.

### 331. The outstanding-documents flag catches only half the cases
what:     The flag that says a client owes paperwork catches "started and not finished" but not "required and never generated".
where:    Staff app — Clients
raised:   1 report, 2026-08-11 · sources: TASK-ROSTERCARD-REPORT.md
checked:  Prod: the assignment table still has row security with no policies, which is why.
rank:     5
moot?:
if kept:  One policy or one function; it also fixes what the client sees.

### 332. One count trusts the table rules rather than naming the business
what:     A new count relies on the table's own rules to scope it to this business rather than saying so.
where:    Lessons
raised:   1 report, 2026-08-12 · sources: TASK-COUNTFIX-REPORT.md
checked:  Consistent with its neighbour; noted, not changed.
rank:     5
moot?:
if kept:  Nothing — record only.

### 333. Two documents hold fewer fields than their template defines
what:     Two documents are missing fields their template says they should have; both gaps predate the work that found them.
where:    Documents
raised:   1 report, 2026-08-10 · sources: TASK-NOGUARD2-REPORT.md
checked:  Prod: 609 field rows overall; the two documents are the ones item 250 also names.
rank:     5
moot?:
if kept:  Regenerate the two, or accept.

### 334. The staff-assigned horse path was never tested
what:     Only the client's own path through horse intake was tested; the staff-assigned path was assumed to be covered.
where:    Horses
raised:   1 report, 2026-08 · sources: TASK-HORSEINTAKE-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  One test.

### 335. The code and the database had drifted apart
what:     Two live database functions differed from what the repository said they were, and were re-captured.
where:    Migrations
raised:   2 reports, 2026-08-04 · sources: TASK-SQLTRUTH-REPORT.md
checked:  The drift was closed by the task that found it; the practice that caused it is item 86.
rank:     5
moot?:
if kept:  Nothing — record only.

### 336. A regenerate path needs a value the record does not hold
what:     Regenerating a document's text needs a service type the document does not record, so a future caller must remember to pass the same one.
where:    Documents
raised:   1 report, 2026-08-10 · sources: TASK-SENDGUARD-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  Record it on the document.

### 337. Two tabs entering onboarding at once is not modelled
what:     Two browser tabs starting onboarding at the same time is not modelled and there is no lock.
where:    Onboarding
raised:   1 report, 2026-08-10 · sources: TASK-SENDGUARD-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  One lock, or accept the rarity.

### 338. The staff side of horse-document generation was never exercised
what:     What a staff caller sees when horse documents are generated was never checked.
where:    Documents — horse paperwork
raised:   1 report, 2026-08-10 · sources: TASK-HORSEDOCS-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  One run.

### 339. One refusal was proven by analogy
what:     That the event log refuses a non-staff caller was proven by pointing at an identical guard elsewhere, not by testing it.
where:    Contracts — event log
raised:   1 report, 2026-08-04 · sources: TASK-A14-REPORT.md
checked:  Unchanged.
rank:     5
moot?:
if kept:  One test.

### 340. Seventy-eight places check the wrong error shape
what:     Seventy-eight places in the code test errors in a way that misses the shape the database actually returns, so real messages are lost.
where:    Codebase
raised:   1 report, 2026-08 · sources: TASK-HORSEINTAKE-REPORT.md
checked:  Three files were fixed; the rest are unchanged. The helper to adopt already exists.
rank:     5
moot?:
if kept:  Mechanical, and it makes every error message better.

### 341. One guard is fractionally stricter than its callers
what:     One safety check also requires the document to belong to this business, which is slightly stricter than the callers around it.
where:    Contracts
raised:   1 report, 2026-08-10 · sources: TASK-NOGUARD2-REPORT.md
checked:  Inert with one tenant; a real difference with two.
rank:     5
moot?:
if kept:  Align it when multi-tenancy is real.

### 342. Two of your own commits were never verified as applied
what:     Two commits you made outside a session added migrations whose applied state nobody ever confirmed.
where:    Migrations
raised:   1 report, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Not re-derived this pass; the two migration files are in the journal.
rank:     5
moot?:
if kept:  Two queries would settle it.

---

# RANK 6 — COSMETIC, CLEANUP, AND RECORD-ONLY

Most of these are records of a decision or an incident rather than work. They are here because the
rule was that nothing gets dropped without evidence — not because they need doing.

### 343. Small wording and label leftovers (one family, seven places)
what:     Seven small wording leftovers: a marketing page still says "The Facility", seed copy says "around the stables", one page's title and its heading disagree in capitals, the greeting has no word for late night while another surface says "night", an eyebrow says "Ops", and a lucide icon replaced a literal plus.
where:    Public site, member app
raised:   8 reports, earliest 2026-08-05 · sources: TASK-FACILITYTERM-REPORT.md, TASK-ACCOUNTSURFACE-PHASE1.md, TASK-PAGETITLES-REPORT.md, TASK-REVIEWNAV-REPORT.md, TASK-ADDNEW-REPORT.md
checked:  All still present today (About.tsx:120, seed.ts:35, formatDateTime.ts:26 vs DashboardHome.tsx:17).
rank:     6
moot?:
if kept:  A single wording sweep.

### 344. A dead theme colour and a dead read path
what:     A colour defined in the styling config has no user, and one data-reading function has no caller.
where:    Codebase
raised:   2 reports, earliest 2026-08-08 · sources: TASK-ONEHEADER-REPORT.md, TASK-ONEAUTHOR-REPORT.md
checked:  Both still present; the colour's only trace is a comment explaining why it existed.
rank:     6
moot?:
if kept:  Delete both, keep the comment.

### 345. Four visual judgement calls awaiting a glance
what:     Four small visual choices were made by reasoning: the hover fill percentage, the press animation, the divider colour, and the home-screen icon's font.
where:    App — header and navigation
raised:   4 reports, 2026-08-10 · sources: TASK-UIBUILD-LOG.md
checked:  All four unchanged; two divider weights coexist next to a constant that exists to prevent that.
rank:     6
moot?:
if kept:  One look at a screen answers all four.

### 346. Two menu-styling leftovers
what:     The avatar menu still uses the old hover fill in eight places, and one menu item has no room for a badge.
where:    App — navigation
raised:   2 reports, earliest 2026-08-04 · sources: TASK-UIBUILD-LOG.md, TASK-B-REPORT.md
checked:  Both unchanged; two hover languages coexist.
rank:     6
moot?:
if kept:  Sweep the eight.

### 347. A page name may wrap on the narrowest phone
what:     "Horse records" may wrap onto two lines at 320px, which would look wrong rather than break anything.
where:    Staff app — horse records
raised:   1 report, 2026-08-12 · sources: TASK-ADDNEW-REPORT.md
checked:  The exact arrangement is unchanged; unfalsifiable without a screen.
rank:     6
moot?:
if kept:  Fold into item 200.

### 348. Four navigation records that need no action
what:     Four recorded facts: the dormant availability redirect, the divider added to only one menu, an unchanged comment, and the animation deliberately not built.
where:    App — navigation
raised:   4 reports, earliest 2026-08-10 · sources: TASK-ADMINSWEEP-PHASE1.md, TASK-UIBUILD-LOG.md, TASK-NAVMOTION-REPORT.md
checked:  All four confirmed unchanged.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 349. Menu state does not survive a reload
what:     Which menu groups are open is forgotten on reload, unlike two other menu preferences.
where:    App — navigation
raised:   1 report, 2026-08-10 · sources: TASK-UIBUILD-LOG.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  One stored preference.

### 350. The one-time menu tip is per-device
what:     The "click for menu" tip is remembered per browser, not per account, so clearing a browser shows it again.
where:    App — header
raised:   1 report, 2026-08-11 · sources: TASK-NAVMOTION-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  One column, if it matters.

### 351. Seven menu rows share one icon
what:     The whole settings group carries the same shield icon, and one module row carries the clients icon.
where:    App — navigation
raised:   4 reports, earliest 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE1.md, TASK-TEXTEDIT-REPORT.md, TASK-MOBILEPASS-REPORT.md
checked:  Confirmed today: seven rows still share the shield. The earlier duplicate pair was fixed.
rank:     6
moot?:
if kept:  Blocked on the menu restructure it was deferred behind — or just pick seven icons.

### 352. Most icon assignments could not be applied
what:     Most of a planned icon exercise could not be applied because it depended on page merges that do not exist.
where:    App — navigation
raised:   1 report, 2026-08-08 · sources: TASK-ONEHEADER-REPORT.md
checked:  Five were applied; the rest wait on the merges.
rank:     6
moot?:
if kept:  Re-derive after any page merge.

### 353. A menu diff that was specified and never applied
what:     A one-row menu change was written out and never applied because it duplicated what another thread was removing.
where:    Staff app — navigation
raised:   1 report, 2026-08-11 · sources: TASK-ADMINSWEEP-PHASE2.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Re-derive against today's menu.

### 354. The dropdown's height still assumes the old header
what:     The account dropdown's maximum height was calculated for a shorter header, so it can overflow by about twelve pixels.
where:    App — header
raised:   1 report, 2026-08-06 · sources: TASK-HEADER-REPORT.md
checked:  Unchanged; it scrolls internally, so it is cosmetic.
rank:     6
moot?:
if kept:  One number.

### 355. The menu appears instantly while its tab slides
what:     The mobile menu appears instantly while the tab that opens it slides, so the pair does not read as one motion.
where:    App — mobile menu
raised:   1 report, 2026-08-06 · sources: TASK-HEADER-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  One transition.

### 356. The checked-in header mockup is broken
what:     The reference mockup for the header does not work — its script runs before the page exists.
where:    Reference files
raised:   1 report, 2026-08-06 · sources: TASK-HEADER-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Fix or delete the reference.

### 357. The moved menu costs thumb reach, knowingly
what:     Moving the menu to the left made the top links a longer reach on a large phone; you took that trade explicitly.
where:    App — mobile menu
raised:   1 report, 2026-08-11 · sources: TASK-NAVMOTION-REPORT.md
checked:  Unchanged and recorded in the code.
rank:     6
moot?:
if kept:  Nothing — confirm on a phone, revert one class if you change your mind.

### 358. Two page-width judgements flagged for veto
what:     Four pages had their maximum width rounded up to the nearest available size, and three create controls arguably should read "Add New".
where:    Whole app
raised:   2 reports, earliest 2026-08-11 · sources: TASK-PAGEFRAME-REPORT.md, TASK-ADDNEW-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Veto or accept.

### 359. Two temporary menu states, recorded
what:     The team row is temporarily restricted more tightly than its page, and two retirement switches were deliberately left on.
where:    Staff app — navigation
raised:   2 reports, 2026-08-12 · sources: TASK-REVIEWNAV-REPORT.md
checked:  Both unchanged; neither hides anything from anyone today.
rank:     6
moot?:
if kept:  Restore on acceptance — records.

### 360. Two menu rows highlight at once on the dashboard
what:     On the dashboard two menu rows both look selected, because one of them is the same page with a suffix.
where:    Staff app — Review
raised:   1 report, 2026-08-12 · sources: TASK-REVIEWNAV-REPORT.md
checked:  Unchanged; recorded rather than worked around.
rank:     6
moot?:
if kept:  Self-resolves when Review empties.

### 361. Two more records about a shelved design
what:     Twelve findings against the shelved header are closed with it, and its stylesheet was left in place rather than deleted line by line.
where:    Design — shelved header
raised:   5 reports, earliest 2026-08-06 · sources: TASK-HEADER-REPORT.md, TASK-BP410-REPORT.md, TASK-ONEMENU-PHASE1-PLAN.md, TASK-ONEHEADER-REPORT.md
checked:  The files are deleted and the source is preserved under docs/reference/.
rank:     6
moot?:
if kept:  Attach the twelve to that reference folder so they are not rediscovered.

### 362. The header names a font directly
what:     The header names its font directly rather than using the app's font setting, so it will not pick up a nicer face on a Mac.
where:    App — header
raised:   1 report, 2026-08-06 · sources: TASK-HEADER-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  One decision.

### 363. Three tooltip wording records
what:     A trailing full stop was added to your quoted tooltip, unknown roles fall back to generic wording, and five delete controls were deliberately left as plain tooltips.
where:    Contracts — editor
raised:   3 reports, earliest 2026-08-06 · sources: TASK-CHECKBOXTIP-REPORT.md, TASK-TIPTAP-REPORT.md
checked:  All three unchanged.
rank:     6
moot?:
if kept:  Trivial either way.

### 364. Eight process records about how work landed
what:     Eight records: a stale branch point, a misleading branch name, a dead migration kept in the journal, a spec found outside the repo, grants applied in two passes, sequence numbers burned by rolled-back proofs, a review loop the orchestrator never closed, and a branch deliberately not pushed.
where:    Process
raised:   9 reports, earliest 2026-08-02 · sources: POST_RUN_CLOSEOUT.md, TASK-C10-REPORT.md, TASK-LEASEFIX-REPORT.md, TASK-NAVMOTION-REPORT.md, TASK-BOOKWRITE-REPORT.md, TASK-LEASESET-REPORT.md, TASK-NOGUARD3-REPORT.md
checked:  All confirmed as recorded; none is actionable now.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 365. "Test the content, not the commit" — a lesson worth keeping
what:     A thread twice told you work had not landed when it had, because it checked commit identifiers instead of file contents.
where:    Process
raised:   3 reports, 2026-08-10 · sources: TASK-LEASEFIX-REPORT.md
checked:  Confirmed; the lesson is in no standing document.
rank:     6
moot?:
if kept:  One line in CLAUDE.md.

### 366. The lint warning count in CLAUDE.md is wrong
what:     The documented count of code warnings is stale — it says about twenty-six and the real number is thirty-six to thirty-nine.
where:    Documentation
raised:   12 reports, earliest 2026-08-05 · sources: TASK-TITLESWEEP-REPORT.md, TASK-PLUSPASS-REPORT.md, TASK-UIBUILD-LOG.md, TASK-A8B-REPORT.md, TASK-MOBILEPASS-REPORT.md, TASK-PAGEFRAME-REPORT.md, TASK-UPLOADS-REPORT.md, TASK-NAVMOTION-REPORT.md, TASK-ADDITEM-REPORT.md, TASK-PURPOSEFIX-REPORT.md, TASK-DOCCOLS-REPORT.md
checked:  Twelve separate threads have re-measured and reported this. The number in CLAUDE.md is still ~26.
rank:     6
moot?:
if kept:  One number — and it stops a twelfth thread reporting it.

### 367. Twenty-eight corrections to task-document premises
what:     Twenty-eight separate corrections where a task document's stated facts were wrong and the thread corrected them in its report: wrong file names, wrong counts, wrong causes, wrong line numbers, a column that does not exist, a contradiction in a brief.
where:    Process — task documents
raised:   28 reports, earliest 2026-08-01 · sources: 28 task reports (see FAMILIES.md F654 for the list)
checked:  Each was verified by the thread that raised it; none needs action now. Their value is the pattern: task documents go stale within hours.
rank:     6
moot?:
if kept:  Nothing to do — this is the strongest argument for "derive, never copy".

### 368. A settled decision recorded twice about the platform account
what:     Two records confirm the platform account was correctly left without a business, exactly as ruled.
where:    Identity
raised:   2 reports, earliest 2026-08-11 · sources: TASK-GOOGLEAUTH-REPORT.md
checked:  Prod: still no business attached, which is correct.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 369. Historic invitation records were left as they are
what:     Older stacked invitation records were not rewritten, because rewriting their history would be inventing it.
where:    Identity — invitations
raised:   1 report, 2026-08-11 · sources: TASK-INVITEWORKS-REPORT.md
checked:  Prod: unchanged.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 370. A correction that keeps being re-alarmed about
what:     An alarming "thirteen invitations never redeemed" figure was twelve test sends plus one real address, and it keeps being rediscovered.
where:    Identity — invitations
raised:   1 report, 2026-08-11 · sources: TASK-INVITEWORKS-REPORT.md
checked:  Prod: the shape is unchanged; six of the seven expired are test identities.
rank:     6
moot?:
if kept:  Nothing to do — but item 58 is the real one underneath it.

### 371. Two email-wording leftovers from a settled decision
what:     The wording for the welcome and overdue emails still exists in the renderer even though both were deliberately deleted, and that renderer is now entirely unused.
where:    Email
raised:   2 reports, 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md
checked:  Unchanged; deliberately kept rather than reversing your decision.
rank:     6
moot?:
if kept:  Delete both when convenient.

### 372. Three email-extraction records
what:     Three records: a new placeholder namespace created against instruction, fallback wording moved into the templates, and a corrected count of how many emails exist.
where:    Email
raised:   3 reports, 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md
checked:  All three as recorded.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 373. Two email-path records
what:     The deliverability panel resolves the inbox on the client rather than the server, and a minor-rejection branch in the invite endpoint cannot be reached.
where:    Email
raised:   2 reports, earliest 2026-08-04 · sources: TASK-C-REPORT.md, TASK-C10-REPORT.md
checked:  Both unchanged.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 374. Reminder senders that were deliberately not touched
what:     The reminder emails were left alone, and a minor with no account is already incidentally unreachable there.
where:    Email — reminders
raised:   1 report, 2026-08-04 · sources: TASK-C10-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 375. Two stale references to the retired enquiry page
what:     A dashboard tile and a staff email both still say "open the request inbox", pointing at a page that has been retired (both still work via a redirect).
where:    Staff app, email
raised:   1 report, 2026-08-11 · sources: TASK-LEADCLEAN-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Two strings.

### 376. A guard with no data to exercise it
what:     A safety check in a backfill has never met the situation it guards against, so it is proven only by a test.
where:    Leads
raised:   1 report, 2026-08-11 · sources: TASK-LEADCLEAN-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 377. Two horse-record cosmetics
what:     The horse-records page builds its own dialog beside the app's shared one, and the records hub tells staff to go to a screen the app does not link to.
where:    Staff app — horse records
raised:   2 reports, 2026-08-12 · sources: TASK-DUPECENSUS-REPORT.md
checked:  The hub page has changed since; the message and the hand-rolled dialog are still as described.
rank:     6
moot?:
if kept:  Two small changes.

### 378. Two record-page navigation asymmetries
what:     A horse link on a person's record leaves the page while a person link on a horse's record opens in place, and the dossier shows the same horse information twice.
where:    Staff app — Records
raised:   2 reports, 2026-08-12 · sources: TASK-RECORDS-REPORT.md
checked:  Both unchanged.
rank:     6
moot?:
if kept:  Two small changes.

### 379. Two roster cosmetics
what:     Credits are shown as one total rather than itemised, and the old "active first" sort order was lost in a page port.
where:    Staff app — Clients
raised:   2 reports, earliest 2026-08-10 · sources: TASK-ROSTERCARD-REPORT.md, TASK-ROSTER-REPORT.md
checked:  The itemised data is still carried; the sort still has two keys and no active-first.
rank:     6
moot?:
if kept:  Two small changes.

### 380. Three roster judgement calls, recorded
what:     Three judgement calls on the client cards: how the status ring is derived, showing "Client" as a fixed word on a pair badge, and how far the service columns scale.
where:    Staff app — Clients
raised:   3 reports, earliest 2026-08-10 · sources: TASK-ROSTERCARD-REPORT.md, TASK-ROSTER-REPORT.md
checked:  All three unchanged.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 381. The gifts heading covers both directions
what:     The gifts page heading covers both received and given; splitting them needs a structural change because the component is shared.
where:    Member app — Gifts
raised:   1 report, 2026-08-05 · sources: TASK-TITLESWEEP-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  One structural change for one heading.

### 382. An account row's icon was changed
what:     One account row's icon was deliberately changed and never acknowledged.
where:    Member app — Account
raised:   1 report, 2026-08-05 · sources: TASK-ACCOUNTSURFACE-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 383. An order opens outside the app shell
what:     Opening an order from the account leaves the app shell for a public-site page.
where:    Member app — Orders
raised:   1 report, 2026-08-07 · sources: TASK-ACCOUNTSURFACE-PHASE1.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  One route.

### 384. Two account deep links have no links to them
what:     Two links that open a specific account section exist and nothing anywhere uses them.
where:    Member app — Account
raised:   1 report, 2026-08-06 · sources: TASK-ACCTEVAL-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Use them or drop them.

### 385. One inert review mount, by design
what:     One page in the review section has a deliberately dead submit button, because its real save path has the filing defect in item 11.
where:    Staff app — Review
raised:   1 report, 2026-08-12 · sources: TASK-REVIEWNAV-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Self-resolves with item 11.

### 386. A retired function still names two retired templates
what:     One database function still tests two retired template names in a branch that can never match.
where:    Database
raised:   1 report, 2026-08-06 · sources: TASK-SVCPURGE-REPORT.md
checked:  Prod, checked today: both retired names are still in the body.
rank:     6
moot?:
if kept:  Cosmetic; needs a function rewrite, which is why it was skipped.

### 387. A function that queries a deleted table
what:     One old function still queries a table that was removed; nothing calls it, so it is cleanup rather than breakage.
where:    Database
raised:   2 reports, 2026-08-12 · sources: TASK-TESTDB-REPORT.md
checked:  Prod, checked today: the function still exists and is still granted to both public roles.
rank:     6
moot?:
if kept:  Drop it.

### 388. A vestigial column left by a deleted table
what:     A gift record still carries a reference column whose relationship was removed with an old table.
where:    Gifts
raised:   1 report, 2026-08-11 · sources: TASK-GIFTCREDITS-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Drop the column.

### 389. A deal function nothing calls
what:     A function that reopens a deal exists in the database and nothing in the app calls it.
where:    Deals
raised:   1 report, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Wire it or drop it.

### 390. The deal activity list is assembled on demand
what:     The deal activity list is composed from other tables when read, so anything not already recorded elsewhere never appears.
where:    Deals
raised:   1 report, 2026-08-04 · sources: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  A real activity table, if the log matters.

### 391. Four contract-composition records
what:     Four records from the authoring work: a new function unnamed in the spec, a combined call instead of many, two new columns, and a punctuation rule scoped to added clauses only.
where:    Contracts — authoring
raised:   4 reports, 2026-08-04 · sources: TASK-R11-REPORT.md
checked:  All four as recorded.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 392. The bill of sale's numbering changed visibly
what:     The bill of sale now numbers its sections differently — acceptable for a short document but a visible change.
where:    Sale documents
raised:   1 report, 2026-08-04 · sources: TASK-R11-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Look at one and accept or revert.

### 393. Four template-inventory records
what:     Four records: two inactive templates with empty bodies, two body-less retired templates still present, an inline preview retired behind a switch rather than deleted, and a lease version bumped twice by a proof.
where:    Templates
raised:   4 reports, earliest 2026-08-06 · sources: TASK-TEXTEDIT-REPORT.md, TASK-SVCPURGE-REPORT.md, TASK-ONEAUTHOR-REPORT.md
checked:  Prod, checked today: all four confirmed exactly as recorded.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 394. Four template-purge records
what:     Four records from deleting six unused contract templates: an extra deletion beyond the list (contents preserved in a comment), a slightly wrong premise in the task, the deletes reporting zero as expected, and the business intent taken on trust.
where:    Templates
raised:   4 reports, 2026-08-06 · sources: TASK-SVCPURGE-REPORT.md
checked:  All four as recorded.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 395. Three placeholder-inventory records
what:     Three records: the retired fee placeholders that could be hidden from the picker, the re-pointing recommendations left undone, and one lease template that renders correctly with no placeholder rows at all.
where:    Templates — placeholders
raised:   3 reports, earliest 2026-08-01 · sources: TASK-TOKENAUDIT-REPORT.md, PROMPT_A_STAGES_1-3.md
checked:  Prod, checked today: 360 placeholder rows; the lease templates still have none of their own.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 396. Two clone-scope records
what:     Two records: the four tables copied when a template is cloned are enough today but not in general, and a seventh related table was missing from an inventory.
where:    Templates
raised:   2 reports, 2026-08-07 · sources: TASK-LEASEFORK-REPORT.md
checked:  Both as recorded.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 397. Three document-queue records
what:     Three records: the default view changed from all documents to the five awaiting signature, the "by person" preset filters in place rather than opening a dossier, and the contract column shows a raw identifier you asked to replace with parties.
where:    Staff app — Documents
raised:   3 reports, earliest 2026-08-06 · sources: TASK-DOCQUEUE-REPORT.md, TASK-A-PARTY-VERIFY-2-REPORT.md
checked:  The parties column now exists; the raw contract column and the two behaviours are unchanged.
rank:     6
moot?:
if kept:  One column can go.

### 398. Four document-queue corrections, recorded
what:     Four corrections: two arithmetic fixes, a company marker that has no rows, and the reason a status was unreachable.
where:    Staff app — Documents
raised:   4 reports, 2026-08-11 · sources: TASK-DOCCOLS-REPORT.md, TASK-DOCQUEUE-REPORT.md
checked:  All four as recorded.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 399. The company contact shows as plain text
what:     The company shows as unlinked text in the parties column because it has no record page of its own.
where:    Staff app — Documents
raised:   1 report, 2026-08-11 · sources: TASK-DOCCOLS-REPORT.md
checked:  Unchanged; deliberate rather than emitting a dead link.
rank:     6
moot?:
if kept:  Give the company a record page, or accept.

### 400. Column choices stored per browser
what:     Which document columns you show is remembered per browser rather than on your account, as a display preference.
where:    Staff app — Documents
raised:   1 report, 2026-08-11 · sources: TASK-DOCCOLS-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 401. Two delivery records
what:     Two records: the company mirror is skipped for targeted sends, and the send panel was left out of the document menu because it lives on another route.
where:    Documents — delivery
raised:   3 reports, 2026-08-04 · sources: TASK-A8B-REPORT.md
checked:  Both unchanged.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 402. A one-line revert is available on a notification change
what:     A staff broadcast was folded into the new party-signed alert; a one-line revert restores the old two-notification behaviour.
where:    Notifications
raised:   3 reports, 2026-08-04 · sources: TASK-A16-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Confirm the fold or revert it.

### 403. The 6-hour guard is in a different place than a task assumed
what:     A duplicate-send guard was described as protecting invitations; it protects signed-document delivery instead.
where:    Email
raised:   1 report, 2026-08-12 · sources: TASK-EMAILEXTRACT-REPORT.md
checked:  As recorded.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 404. Two lease-effect records
what:     Two records: the stamping of a lease's effects deliberately skipped generating the horse paperwork, and there is no way to re-run those effects for a lease executed before the mechanism existed.
where:    Documents — lease effects
raised:   2 reports, 2026-08-04 · sources: TASK-A11-REPORT.md
checked:  Prod: unchanged.
rank:     6
moot?:
if kept:  One wrapper function, if an old lease ever needs it.

### 405. Two contact-count records
what:     Two records: a count in a task document disagreed with production, and the earlier horse-document counts included deleted rows.
where:    Records
raised:   2 reports, 2026-08-12 · sources: TASK-RECORDS-REPORT.md, TASK-COUNTFIX-REPORT.md
checked:  Prod today: 19 contacts, 3 leads, 4 team.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 406. Two self-corrections about categories
what:     Two claims were withdrawn: one person's categories healed themselves after 45 minutes, and nine riders were never at risk.
where:    Identity
raised:   1 report, 2026-08-10 · sources: TASK-INVITEFLOW-REPORT.md
checked:  As recorded.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 407. The premature send on a real lease is accepted
what:     A document was sent to both parties earlier than intended on a real client's lease, and you accepted it as a live negotiation.
where:    Documents
raised:   1 report, 2026-08-06 · sources: TASK-A-PARTY-VERIFY-2-REPORT.md
checked:  As ruled; the document is untouched.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 408. A booking status filing choice, recorded
what:     Bookings are filed in the status history under a different type name, deliberately, so nobody "fixes" it into a regression.
where:    Bookings
raised:   1 report, 2026-08-12 · sources: TASK-BOOKWRITE-REPORT.md
checked:  Prod: unchanged.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 409. A cascade that was disarmed, recorded
what:     A booking's link to its purchase was changed so that deleting a purchase no longer destroys the booking history.
where:    Bookings
raised:   1 report, 2026-08-12 · sources: TASK-BOOKWRITE-REPORT.md
checked:  Prod: as recorded.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 410. The intentionally-public functions were confirmed untouched
what:     The functions that are meant to be reachable without signing in (gift redemption, the public catalogue) were confirmed untouched.
where:    Security
raised:   1 report, 2026-08-10 · sources: TASK-NOGUARD2-REPORT.md
checked:  Prod: still reachable, as intended.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 411. Corrections to the security audits' own numbers
what:     Five corrections to counts inside the security audits — seven not nine, nineteen not fifteen, and three revised totals.
where:    Security
raised:   5 reports, earliest 2026-08-08 · sources: TASK-NOGUARD2-REPORT.md, TASK-GUARDREST-REPORT.md, TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
checked:  All as recorded.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 412. Two dead-code cleanups already identified
what:     Two functions were confirmed dead: one gift helper nothing calls at all, and one whose public grant is harmless for a different reason than stated.
where:    Security
raised:   3 reports, 2026-08-07 · sources: TASK-SECFIX-REPORT.md, TASK-SECFIX2-REPORT.md
checked:  Prod: the gift helper is closed; the other is unchanged and harmless.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 413. A false alarm, chased down and disproved
what:     One security check looked like it had locked someone out; the cause was the test query itself.
where:    Security
raised:   1 report, 2026-08-07 · sources: TASK-SECFIX-REPORT.md
checked:  As recorded.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 414. Two storage cleanups
what:     Two cleanups: one file record now carries the same path twice, and staff have no personal files area.
where:    Files
raised:   2 reports, 2026-08-11 · sources: TASK-UPLOADS-REPORT.md
checked:  Both unchanged.
rank:     6
moot?:
if kept:  One column can collapse; the staff area is a decision.

### 415. Sign-start behaviour records
what:     Three records: the rate limit is a tumbling window rather than a rolling one, the signing route sits inside the public chrome, and a genuine database failure returns a server error rather than a bland success.
where:    Kiosk — sign start
raised:   3 reports, 2026-08-04 · sources: TASK-C-REPORT.md
checked:  All three unchanged.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 416. Party-control default records
what:     Two records: party permissions were defaulted uniformly rather than per role, and one backfill included documents beyond the intended scope.
where:    Contracts — party controls
raised:   2 reports, 2026-08-04 · sources: TASK-PARTYCTRL-REPORT.md
checked:  Both as recorded.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 417. Three tracker-status records
what:     Three tracker entries were left marked partial or not-verified because they belong to work that never got its browser pass.
where:    Documentation — build tracker
raised:   3 reports, earliest 2026-08-04 · sources: TASK-PARTYCTRL-REPORT.md, TASK-DOCVIS-REPORT.md, TASK-F3-REPORT.md
checked:  Unchanged; they resolve with item 198.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 418. One lease line left in place beside its replacement
what:     A line inside one card was left alongside a newer card that partly repeats it, deliberately.
where:    Member app — horse page
raised:   1 report, 2026-08-04 · sources: TASK-A12-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  One look.

### 419. Three event-log vocabulary deviations
what:     Three parts of the document event log differ from its specification because the data to support them does not exist.
where:    Contracts — event log
raised:   3 reports, 2026-08-04 · sources: TASK-A14-REPORT.md
checked:  All three as recorded.
rank:     6
moot?:
if kept:  Nothing to do — records.

### 420. The Simple lease's protective classifications are hand judgements
what:     The classification of which lease clauses are protective was read by hand, not computed — and a clause wrongly classified is the damaging case.
where:    Templates — simple lease
raised:   1 report, 2026-08 · sources: TASK-LEASESIMPLE-REPORT.md
checked:  Unchanged; explicitly not legal advice.
rank:     6
moot?:
if kept:  Have Claire read the column before it is used.

### 421. A worktree redirect judgement, recorded
what:     The old directory address redirects to Vendors rather than Partners, by judgement about what the old page contained.
where:    Staff app — Records
raised:   1 report, 2026-08-12 · sources: TASK-RECORDS-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 422. Comments-only mentions of the old facility word
what:     Several code comments still use the old word for the property; changing them is churn with no user-visible effect.
where:    Codebase
raised:   1 report, 2026-08 · sources: TASK-FACILITYTERM-REPORT.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Nothing to do — record.

### 423. The mobile menu's collapsible sections were deferred by you
what:     Making the staff menu sections collapsible on mobile was deferred by you until after the menu restructure.
where:    Staff app — mobile menu
raised:   1 report, 2026-08-08 · sources: TASK-MOBILEPASS-REPORT.md
checked:  Unchanged, as deferred.
rank:     6
moot?:
if kept:  After the restructure.

### 424. The account panel version of documents is behind the full page
what:     The documents panel inside the account page cannot sign, cannot email a copy and does not show pending paperwork, unlike the full page.
where:    Member app — Account
raised:   1 report, 2026-08-07 · sources: TASK-ACCOUNTSURFACE-PHASE1.md
checked:  Unchanged.
rank:     6
moot?:
if kept:  Either bring it up to the page, or link out to the page.
