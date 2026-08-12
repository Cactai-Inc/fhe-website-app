# FLAGHARVEST batch 1 — extracted items

Assigned files: TASK-A11, TASK-COUNTFIX, TASK-DUPECENSUS, TASK-GOOGLEAUTH, TASK-INVITEWORKS,
TASK-LEADCLEAN, TASK-LEASEFIX, TASK-NOGUARD2, TASK-PROFILE, TASK-REQTRIGGER, TASK-SQLTRUTH,
TASK-TITLESWEEP, TASK-TOKENAUDIT (all read in full).

---

## TASK-A11-REPORT.md

### ITEM
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: The AccountHub and HorsePage UI changes were never visually confirmed in a browser; BUILD_TRACKER marks A11 PARTIAL, not DONE.
- quote: "`AccountHub` and `HorsePage` UI changes are code-complete and typecheck clean but have not been visually confirmed in a browser."
- kind: not-verified
- artifacts: src/pages/app/AccountHub.tsx, src/pages/app/HorsePage.tsx, docs/BUILD_TRACKER.md
- decision-mention: none

### ITEM
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: The lease-effect stamping deliberately omitted the trigger's ensure_horse_documents side effect (auto-generated HORSE_EMERGENCY_VET / RELEASE_HORSE_CARE paperwork), leaving a known gap from the full trigger body.
- quote: "Not run; logged here as a known, deliberate gap from the full trigger body."
- kind: process
- artifacts: ensure_horse_documents, apply_contract_execution_effects
- decision-mention: none

### ITEM
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: Pre-existing identity-duplication gap: no auth account is linked to the lessee contact 352c3898 ("French Heritage Equestrian"); the login sharing hello@fhequestrian.com is linked via profiles.contact_id to a different contact ("Claire Bourdon") — not touched, out of scope.
- quote: "a pre-existing identity-duplication gap unrelated to A11 — the login sharing `hello@fhequestrian.com`'s email is linked via `profiles.contact_id` to a *different* contact, \"Claire Bourdon\"; not touched here, out of scope"
- kind: data-integrity
- artifacts: profiles, contacts, auth.users
- decision-mention: none

### ITEM
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: Horse a8e82033 (Beau) carries a duplicated pair of active LESSEE horse_relationships rows for a different contact referencing a source_document_id that no longer exists in documents — pre-existing data noise, deliberately not touched.
- quote: "an unrelated, duplicated pair of active `LESSEE` `horse_relationships` rows for a different contact (`d5088607-4b60-413e-b221-0524469a5083`) referencing a `source_document_id` (`378c1fe9-bba6-45e5-a6ce-efae0b4f8c01`) that no longer exists in `documents`"
- kind: data-integrity
- artifacts: horse_relationships, documents
- decision-mention: none

### ITEM
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: No idempotent re-fire wrapper exists for apply_contract_execution_effects() — only the trigger function itself; leases executed before the trigger never get stamped without manual intervention.
- quote: "No idempotent re-fire wrapper exists for `apply_contract_execution_effects()` (only the trigger function itself; grepped `pg_proc` for anything else mentioning \"execution_effect\" — nothing)."
- kind: inventory
- artifacts: apply_contract_execution_effects
- decision-mention: none

### ITEM
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: The stamped test data (lease effect on Beau) was deliberately left in production per the task's instruction, reflecting the real executed lease.
- quote: "**This test data STAYS** — it reflects the real executed lease `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3` and was not cleaned up, per the task's instruction."
- kind: process
- artifacts: horses, horse_relationships
- decision-mention: none

---

## TASK-COUNTFIX-REPORT.md

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Correction to the task spec: the three acquisition offerings are not config_kind='inquire' (they are document_transaction / intake_evaluation / intake_finder); the price_amount != null clause alone emptied /acquisition.
- quote: "**One correction to the spec's wording:** the task says the three offerings are `config_kind = 'inquire'`. They are not ... **It is the `price_amount != null` clause alone that emptied the page.**"
- kind: correction
- artifacts: src/lib/publicCatalog.ts, public_offerings
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Correction to the DUPECENSUS census: its horse-document figures for Secret (5) and Tiz (8) included soft-deleted rows; the person-visible numbers are 3 and 6.
- quote: "`TASK-DUPECENSUS` recorded Secret at 5 and Tiz at 8. Those figures **included soft-deleted rows**"
- kind: correction
- artifacts: staff_horse_records, documents
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: The spec's hypothesis for member document counts was wrong: my_documents() has never listed a document the member cannot open (it is a strict subset of documents_select RLS), so the wider count was correct all along.
- quote: "The task expected the **wider** count to be the bad one ... **Checked against the RLS: false.**"
- kind: correction
- artifacts: my_documents, documents_select
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Real defect found: my_contract_documents() has no void filter, so DealHome offered two VOIDED leases under "Agreements that need you" with Review & sign.
- quote: "`my_contract_documents()` has **no void filter**. For `cjzigs@icloud.com` its 5 rows include **two VOIDED leases** ... The page was asking a member to sign two dead documents."
- kind: defect
- artifacts: my_contract_documents, src/pages/app/DealHome.tsx
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Correction to the census: ContractPage does not need my_contract_documents' open_change_requests / my_roles fields — it reads contract_document_detail(); DealHome was my_contract_documents' only consumer.
- quote: "**One correction to the census** while I was in there: it says `ContractPage` needs `my_contract_documents`'s `open_change_requests` / `my_roles` fields. It does not"
- kind: correction
- artifacts: src/pages/app/ContractPage.tsx, contract_document_detail, my_contract_documents
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: No staff browser session exists, so every staff-side render is NOT VERIFIED (/app/ops/horse-records, /app/ops/lessons/sessions, /app/ops, /app/deal, /app/documents) — proven at data and type layer only.
- quote: "**No staff browser session exists**, so **every staff-side render is NOT VERIFIED** ... none has been looked at."
- kind: not-verified
- artifacts: /app/ops/horse-records, /app/ops/lessons/sessions, /app/ops, /app/deal, /app/documents
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: /acquisition and /shop are public pages left for the owner to confirm visually; the three cards are proven in SQL but nobody has seen the page.
- quote: "**`/acquisition` and `/shop` are public and are the owner's to confirm** ... nobody has seen the page."
- kind: blocked-on-owner
- artifacts: /acquisition, /shop
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: test:db is broken (60 of 68 files failing) and was not cited as proof anywhere; it is TASK-TESTDB's subject.
- quote: "It is broken (60 of 68 files failing) and is `TASK-TESTDB`'s subject."
- kind: known issue → process
- artifacts: test/db
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: The mixed-cart render (one priced item plus one "Price on enquiry" item, per-cadence subtotal covering only priced ones) has not been seen on screen.
- quote: "That is correct and the group's own comment says so, but it has not been seen on screen."
- kind: not-verified
- artifacts: src/lib/cart.ts, src/pages/Checkout.tsx
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Flagged not fixed: Schedule.tsx still casts listLessonSessions to MemberLessonSession[] via `as unknown as` and still heads the staff view "Your lessons" while listing the whole property's; census 2.5 owns the consolidation.
- quote: "**`Schedule.tsx` still casts one type to another to compile** ... and still heads the staff view **\"Your lessons\"** while listing the whole property's."
- kind: defect
- artifacts: src/pages/app/Schedule.tsx
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Flagged not fixed: DashboardPanel has no loading and no error branch — every fetch is `.catch(() => …)`, so a failed read renders "you're all caught up"; the census recommendation to port OpsDashboard's per-tile error branch stands.
- quote: "**`DashboardPanel` has no loading and no error branch** — every fetch is `.catch(() => …)`, so a failed read renders \"you're all caught up\"."
- kind: defect
- artifacts: src/components/app/DashboardPanel.tsx, src/pages/app/ops/OpsDashboard.tsx
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Flagged not fixed: a staff account has no nav route to its own documents (useNavPresence(!isStaff) in AppLayout.tsx).
- quote: "**A staff account has no nav route to its own documents** (`useNavPresence(!isStaff)`, `AppLayout.tsx`)."
- kind: defect
- artifacts: src/components/app/AppLayout.tsx, useNavPresence
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Flagged not fixed: my_contract_documents()'s staff branch returns every contract in the org under a function named "my" — a trap if it is ever revived (nothing reads it now).
- quote: "**`my_contract_documents()`'s staff branch returns every contract in the org**, under a function named \"my\" ... If it is ever revived, that is a trap."
- kind: defect
- artifacts: my_contract_documents
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Flagged: countOpenLessonSlots() is org-scoped by RLS only, trusting the bookings policies rather than naming an org — consistent with its neighbour, noted because it is a new reader.
- quote: "**`countOpenLessonSlots()` is org-scoped by RLS only** — like `listLessonSessions()`, it trusts the `bookings` policies rather than naming an org."
- kind: correctness
- artifacts: countOpenLessonSlots, bookings
- decision-mention: none

### ITEM
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Process note: the worktree was deleted and recreated by another process mid-session, losing the first pass of uncommitted edits; everything was redone and committed immediately.
- quote: "The worktree was **deleted and recreated by another process mid-session**, taking the first pass of the uncommitted edits with it."
- kind: process
- artifacts: wt-countfix
- decision-mention: none

### INVENTORY
- report: TASK-COUNTFIX-REPORT.md
- what: myContractDocuments() is retained and annotated but no longer read by anything in the codebase (DealHome, its only consumer, now reads my_documents()).
- where: src/lib/contracts.ts (myContractDocuments), my_contract_documents RPC
- quote: "**`myContractDocuments()` is retained, annotated, and no longer read by anything.** It is **not** deleted, per the standing rule."

---

## TASK-DUPECENSUS-REPORT.md

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Global caveat: no browser was used; every appearance claim is NOT VERIFIED and every judgement is derived from code markers.
- quote: "**I have not seen these pages.** No browser was used. Every appearance claim is marked **NOT VERIFIED**"
- kind: not-verified
- artifacts: (all surfaces in the census)
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Not reached: api/ (serverless) and supabase/migrations/ were not swept for duplication — only src/ and the DB functions those surfaces call.
- quote: "**`api/` (serverless) and `supabase/migrations/`** were not swept for duplication."
- kind: inventory
- artifacts: api/, supabase/migrations/
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Not reached: email templates (api-side) were not compared against each other for duplication.
- quote: "**Email templates** (`api/`-side) were not compared against each other."
- kind: inventory
- artifacts: api/ email templates
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Not reached: the three superadmin pages were inventoried but not quality-scored (platform-owner surfaces, out of tenant UI scope).
- quote: "**The three superadmin pages** (`/app/ops/superadmin/*`) were inventoried but not quality-scored"
- kind: inventory
- artifacts: /app/ops/superadmin/*
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Not reached: ContractPage.tsx (2,293 lines) and ContractCascade.tsx (1,600 lines) were not audited internally for self-duplication — likely some exists; a task of its own.
- quote: "They were not audited internally for self-duplication; at that size there is likely some, and it is a task of its own."
- kind: inventory
- artifacts: src/pages/app/ContractPage.tsx, src/components/app/ContractCascade.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Not reached: CSS/token duplication beyond counting arbitrary Tailwind values per file.
- quote: "**CSS/token duplication** beyond counting arbitrary Tailwind values per file."
- kind: inventory
- artifacts: (Tailwind/CSS tokens)
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 1.1 (still open at report time): the /app/ops KPI tile "Intake to review" says 12 where the badge and dashboard say 5 — OpsDashboard.countPendingIntake is the last holdout of the old definition and should call inbound_open_count().
- quote: "**`OpsDashboard.countPendingIntake` is the last holdout** and is the only reason this finding is still open."
- kind: defect
- artifacts: src/pages/app/ops/OpsDashboard.tsx, inbound_open_count, listIntake
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: DashboardPanel still has no loading branch and no error branch — every fetch swallows errors, so a failed read renders "you're all caught up"; it also carries 15 arbitrary Tailwind values, most in its group.
- quote: "**the panel itself still has no loading branch and no error branch** — every fetch is `.catch(() => …)`, so a failed read renders as \"you're all caught up.\""
- kind: defect
- artifacts: src/components/app/DashboardPanel.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Process finding: a code comment (useOpenLeads.ts:38 at 33525cd) asserted a guarantee the code did not provide for a month and nothing caught it — the clearest example of the false-comment failure mode.
- quote: "**a comment asserted a guarantee the code did not provide, for a month, and nothing caught it.**"
- kind: process
- artifacts: src/lib/ops/useOpenLeads.ts
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 1.2: staff_horse_records().document_count counts relationship rows created by a document, not documents — wrong for every horse in production (0 shown where up to 8 exist); one-line SQL fix recommended.
- quote: "**Not one of the four agrees.** Three horses read \"0 attached\" next to a documents icon while holding 5, 6 and 8 documents."
- kind: defect
- artifacts: staff_horse_records, src/pages/app/ops/HorseRecordsPage.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 1.3: listLessonSessions() has no status filter, serving 318 rows where 39 lessons exist; the 279 available-slot rows carry a status (AVAILABLE) with no key in the label map, so no code path can label them — NOT VERIFIED visually.
- quote: "`listLessonSessions` upper-cases the booking status ... producing `AVAILABLE`, which is **not a key in that map** ... **NOT VERIFIED visually** — but there is no code path that produces a label for those 279 rows."
- kind: defect
- artifacts: src/lib/ops/api-lessons.ts, src/pages/app/Schedule.tsx, src/pages/app/ops/lessons/SessionsPage.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Before Schedule.tsx is retired, its community-events + RSVP section must be carried across — it is the only place in the app a member can RSVP and it would be lost.
- quote: "the **community-events + RSVP section** ... that is the only place in the app a member can RSVP, and it would be lost."
- kind: inventory
- artifacts: src/pages/app/Schedule.tsx, fetchEvents, fetchMyRsvps, setRsvp
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 1.4: a member's document count reads 13 on /app/documents and 5 on /app/deal; three members would see an Acquisition home reading "no agreements" while their Documents page lists 4-6 — both labelled the same to the member.
- quote: "Three members would see an Acquisition home reading *\"no agreements\"* while their Documents page lists six, six and four."
- kind: defect
- artifacts: my_documents, my_contract_documents, src/pages/app/DealHome.tsx, src/components/app/DocumentsContent.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 1.5: /acquisition (in the marketing site's primary nav as "Find a Horse") renders 0 of 3 services because fetchPublicCatalog filters price_amount != null and all three acquisition SKUs are unpriced; there is no empty branch so the funnel cannot be completed and does not say why — NOT VERIFIED visually.
- quote: "**A page in the marketing site's primary nav is a funnel that cannot be completed and does not say why.** **NOT VERIFIED visually; derived from the code paths and the data.**"
- kind: defect
- artifacts: src/lib/publicCatalog.ts, src/pages/BookSupport.tsx, src/pages/BookHorse.tsx, /acquisition
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: The site footer carries two adjacent labels pointing at one destination — "Ways to Ride" and "Book a Lesson" both link to /shop (Footer.tsx:37-38); one-line fix.
- quote: "the footer's Navigation list contains **`{ label: 'Ways to Ride', href: '/shop' }` and `{ label: 'Book a Lesson', href: '/shop' }` as adjacent entries**"
- kind: defect
- artifacts: src/components/layout/Footer.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: If ServiceSelector is retired, its radiogroup accessibility semantics and its mechanics() hint line must be carried across before retirement — OfferingCatalog lacks both.
- quote: "**Carry across from `ServiceSelector` before retiring it:** the **radiogroup semantics** (`role`, `aria-checked`, labelled group) and the **`mechanics()` hint line**"
- kind: inventory
- artifacts: src/components/ServiceSelector.tsx, src/components/OfferingCatalog.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: TASK-HORSEONE is HELD pending this review; the census agrees with its conclusion but adds that breed/colour lookup resolution (listHorseBreeds/listHorseColors) must be carried across from HorsesPage before it is retired — the one feature only the losing page has.
- quote: "**Carry across before B is retired:** **breed/colour lookup resolution** ... This is the single feature that would be silently lost."
- kind: blocked-on-owner
- artifacts: src/pages/app/ops/HorsesPage.tsx, listHorseBreeds, listHorseColors, src/pages/app/ops/HorseRecordsPage.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: HorseRecordsPage hand-rolls its own modal (fixed inset-0 ... z-[60]) beside the app's own Modal component — should be replaced on the way through any consolidation.
- quote: "a **hand-rolled modal** (`fixed inset-0 … z-[60]`, `HorseRecordsPage.tsx:257-269`) sitting beside the app's own `Modal`"
- kind: defect
- artifacts: src/pages/app/ops/HorseRecordsPage.tsx, Modal
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: RecordsHubPage's empty message directs the reader to "the Horses screen" — a page with no nav entry that nothing in the app links to; a staff member following the instruction has nowhere to go.
- quote: "prose directing the reader to a page that **has no nav entry and that nothing in the app links to.** A staff member following that instruction has nowhere to go."
- kind: defect
- artifacts: src/pages/app/ops/hubs/RecordsHubPage.tsx, /app/ops/horses
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: The Ownership and Health record-lane links (only reachable via RecordsHubPage) must survive any retirement of its redundant roster; per HORSEONE the lanes stay gated on mod.horserecords.
- quote: "the **Ownership and Health lane links must survive**, and per HORSEONE the lanes stay gated on `mod.horserecords` while the roster does not."
- kind: inventory
- artifacts: /app/ops/records/horses/:id/parties, /app/ops/records/horses/:id/health, RecordsHubPage.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: The module launcher (six entitlement-gated tiles) exists only on OpsDashboard (/app/ops, URL-only) — it must be carried across before B is retired; there is no other module launcher in the app.
- quote: "the **module launcher** — six entitlement-gated tiles ... There is no other module launcher in the app."
- kind: inventory
- artifacts: src/pages/app/ops/OpsDashboard.tsx, MODULE_TILES, MODULE_HUB_ROUTES, ModuleGate
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: InstructorHome is unjudgeable from code (never rendered for a real account — no non-admin staff exists in production); the owner must open /app/ops/preview/instructor-home and look before it is judged; do not retire the preview route yet.
- quote: "**This is the one place in this report where I will not give you a final verdict from code** ... **Open `/app/ops/preview/instructor-home` and look at it.**"
- kind: blocked-on-owner
- artifacts: src/pages/app/InstructorHome.tsx, src/pages/app/ops/InstructorHomePreview.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Defect: "New lead" on /app/ops/leads creates a CONTACT-typed row (ContactInput has no contact_type; column default is 'CONTACT'), so the new person is not in the list and appears on /app/admin instead; same for "New directory entry" — NOT VERIFIED in a browser.
- quote: "pressing **\"New lead\"** on `/app/ops/leads` creates a `CONTACT`-typed row ... the new person **is not in the list**."
- kind: defect
- artifacts: src/pages/app/ops/ContactsPage.tsx, src/components/ops/contacts/ContactForm.tsx, createContact, src/lib/ops/types.ts
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: The 4 TEAM-typed contacts (CJ Z, Claire Bourdon, French Heritage Equestrian, CACTAI INC.) appear on no people page — ContactDirectory has no TEAM mode and admin_client_accounts excludes them; owner must decide whether they appear on any tab.
- quote: "The **4 `TEAM`-typed contacts** ... appear on **no people page** — `ContactDirectory` has no `TEAM` mode and `admin_client_accounts` excludes them."
- kind: defect
- artifacts: contacts, ContactDirectory, admin_client_accounts, TeamPage
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Answer to ONEPEOPLE §5: the "Unfiled" section and file(id, type) filing control in ContactsPage is the only place in the app that can set contact_type — it must be carried into the composed page or a NULL-typed contact is unfilable forever.
- quote: "This is **the only place in the app that can set `contact_type`**. `Admin.tsx` has no equivalent."
- kind: inventory
- artifacts: src/pages/app/ops/ContactsPage.tsx, setContactType
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Warning for ONEPEOPLE: fixing tab-following on the create control without fixing the ContactForm writer (which does not set contact_type) ships the same bug with better chrome.
- quote: "**Fixing the tab-following without fixing the writer ships the same bug with better chrome.**"
- kind: defect
- artifacts: ContactForm.tsx, createContact
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 2.4: two contact editors on the same pages — ContactDossierModal (30 fields, RPC writes) and ContactForm (4 fields, direct table writes); which one you get depends on where you clicked — NOT VERIFIED visually.
- quote: "**So on `/app/ops/leads` a person can be edited two ways, in two modals, with two field sets (4 vs 30) and two write paths (table vs RPC).**"
- kind: defect
- artifacts: src/components/app/ContactDossierModal.tsx, src/components/ops/contacts/ContactForm.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Before ContactForm is retired its FormField usage and pre-submit validation pattern must be carried across, and the create path must be rebuilt on the RPC with contact_type passed.
- quote: "**Carry across before B is retired:** **`FormField` usage and the pre-submit validation pattern** ... **the create path must be rebuilt on the RPC with `contact_type` passed**"
- kind: inventory
- artifacts: FormField, ContactForm.tsx, update_contact_record
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: DashboardPanel's two "Coming up" tiles link to /app/schedule (a URL-only page); they should link to wherever the time-surface consolidation lands.
- quote: "**Also fix:** `DashboardPanel`'s two \"Coming up\" tiles link to `/app/schedule`; they should link to wherever this lands."
- kind: defect
- artifacts: src/components/app/DashboardPanel.tsx, /app/schedule
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 2.6: three document-body renderers exist; ContractCascade's comment "This is the single body renderer used across the app (m-5)" is false (third false comment found).
- quote: "**Its own comment (line 241) claims:** *\"This is the single body renderer used across the app (m-5).\"* **It is not.** Third false comment found."
- kind: correctness
- artifacts: src/components/app/ContractCascade.tsx, src/components/ops/documents/MergedBodyView.tsx, src/lib/documentPdf.ts
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Document DOC-J7NXZDHD5F (the one document with a NEEDS: mark) shows a styled mark at /app/contracts/:id but raw ⟦NEEDS:…⟧ delimiters at /app/ops/documents/:id — same document, two screens, two appearances.
- quote: "Opened at `/app/contracts/<id>` it shows a styled \"Needs:\" mark; opened at `/app/ops/documents/<id>` it shows the raw `⟦NEEDS:…⟧` delimiters."
- kind: defect
- artifacts: MergedBodyView.tsx, ContractCascade.tsx, DOC-J7NXZDHD5F
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Three copies of the signature-line regex exist and one (the PDF renderer's) already tolerates leading whitespace where the others do not — latent screen/PDF divergence; extract to one exported constant regardless of consolidation.
- quote: "**extract the signature-line regex to one exported constant** and have all three import it. Three copies of one pattern, one of which already differs, is how the screen and the PDF drift apart."
- kind: defect
- artifacts: ContractCascade.tsx:245, MergedBodyView.tsx:24, documentPdf.ts:28
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 2.7: Admin.tsx:518 and :248 send every document to /app/ops/documents/:id unconditionally (DocumentQueueTable routes correctly), so the 8 contract-backed documents open in different viewers depending on origin; three-line documentHref(row) helper fix.
- quote: "**`Admin.tsx:518` and `Admin.tsx:248` do not** — they send **every** document to `/app/ops/documents/:id` unconditionally."
- kind: defect
- artifacts: src/pages/app/Admin.tsx, src/components/ops/documents/DocumentQueueTable.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 2.8: five signature-capture surfaces each re-implement typed-name input, name-match rule and consent checkbox; recommendation is one shared SignatureBlock, do not merge the two writers, and merge Release + DocsParticipantFlow (983 duplicated lines).
- quote: "**Build from:** **one shared `<SignatureBlock>`** ... Every one of the five already implements all four."
- kind: defect
- artifacts: ContractPage.tsx, DocumentsContent.tsx, Onboarding.tsx, Release.tsx, DocsParticipantFlow.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: 60% of production signatures carry no signing account (37 KIOSK_TYPED rows have NULL signer_user_id); mostly correct-by-design for kiosk walk-ins, but only one of the two writers stamps it.
- quote: "it does mean **60% of signatures in production carry no signing account**, and only one of the two writers stamps it."
- kind: data-integrity
- artifacts: signatures, sign_release, record_signature
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 2.9: every account's Dashboard badge is larger than what its dashboard shows — the attention band renders only 3 notification tiles with no "and N more" affordance (up to 14 hidden silently); give it the leads band's expand control.
- quote: "**Every account with notifications has a badge larger than what its dashboard will show**, and the shortfall is invisible."
- kind: defect
- artifacts: src/components/app/DashboardPanel.tsx, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.1: /account (Account.tsx) is a dead page (URL-only, production audience 3 synthetic accounts) carrying a verbatim copy of OrdersContent's order-status label map and its own usd() formatter; verify TwoFactorSettings is reachable in MyLoginContent, then retire behind a boolean.
- quote: "`Account.tsx` also carries a **verbatim copy** of the order-status label map that `OrdersContent.tsx:18` has"
- kind: defect
- artifacts: src/pages/Account.tsx, src/components/app/OrdersContent.tsx, TwoFactorSettings, MyLoginContent
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.2: serviceCatalog.ts claims "Every UI that names a service reads from here" but has zero importers in src/ (fourth false comment); it also says 13 services where both it and the DB hold 14; delete it or wire serviceLabel() in.
- quote: "**Reality:** the only file in the repo that imports it is `test/db/service_catalog.test.ts` ... **No UI reads it.** Fourth false comment found."
- kind: correctness
- artifacts: src/lib/serviceCatalog.ts, test/db/service_catalog.test.ts
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.4: CareHome's primary CTA ("Request a service") links to /horse-care, a route that does not exist in App.tsx — it falls through to the branded 404.
- quote: "**`CareHome` contains a dead link:** `CareHome.tsx:70` → `/horse-care`. **That route does not exist in `App.tsx`** — it falls through to the branded 404. It is the page's primary CTA"
- kind: defect
- artifacts: src/pages/app/CareHome.tsx, App.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: /app/deal and /app/care are surfaces to decide about — give them a nav entry and fix the dead link, or fold into /app/dashboard; CareHome's horses list duplicates /app/stable.
- quote: "these are not duplicates to resolve so much as **surfaces to decide about**."
- kind: blocked-on-owner
- artifacts: src/pages/app/DealHome.tsx, src/pages/app/CareHome.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.5: CalendarPage.tsx:618 links to /app/contracts (no :id) — no such route exists; it is a btn-primary labelled "Review & sign paperwork" that 404s. Route/link cross-check found exactly 2 unmatched targets app-wide (this and /horse-care).
- quote: "`CalendarPage.tsx:618` → **`/app/contracts`** (no `:id`). **No such route exists** ... It 404s."
- kind: defect
- artifacts: src/pages/app/CalendarPage.tsx, App.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.6: if mod.employees is ever enabled, TeamPage vs StaffPage becomes a Tier 2 duplicate — TeamPage owns roles/suspension/invitations/instructor grants; StaffPage owns title and pay type.
- quote: "**If `mod.employees` is ever enabled, this becomes a Tier 2 duplicate.**"
- kind: inventory
- artifacts: src/pages/app/ops/TeamPage.tsx, StaffPage
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.7: retirement-by-boolean is now the house pattern and the list of hidden pages changes weekly — anything consuming the retirement-constant list must re-derive it, not copy it (INTAKE_PAGE_RETIRED landed mid-census).
- quote: "retirement-by-boolean is now the house pattern, and the list of what is hidden changes weekly. Anything that consumes this list must re-derive it, not copy it."
- kind: process
- artifacts: CONTACTS_PAGE_RETIRED, INTAKE_PAGE_RETIRED, INLINE_BODY_PREVIEW_RETIRED, STRIPE_ENABLED, SEED_ENABLED
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Separate report: 71 of 80 in-app pages do not use PageLayout/PageHeader (63 hand-roll an h1, 2 routed pages have no title at all); the frame is four days old, so this is a backfill need, not a discipline problem — measured, not fixed.
- quote: "**71 of 80 pages predate the shared frame** — this is not 71 pages ignoring a convention, it is a convention that arrived after the pages ... it is a **backfill**, not a discipline problem."
- kind: inventory
- artifacts: src/components/PageLayout.tsx, src/components/PageHeader.tsx, src/pages/app/**
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Four code comments asserted false things; two are still false at report time: ContractCascade.tsx:240-241 ("the single body renderer") and serviceCatalog.ts:3 ("Every UI that names a service reads from here").
- quote: "**Four code comments asserted things that were false**, each in a file a thread trusted"
- kind: correctness
- artifacts: ContractCascade.tsx, serviceCatalog.ts, useOpenLeads.ts, ContactsPage.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: For REVIEWNAV: two components (ContactDossierModal, ContactForm) have no route and cannot be reviewed side-by-side without one being mounted; both take props not URL params.
- quote: "**Two components have no route and cannot be reviewed side-by-side without one being mounted:** `ContactDossierModal` and `ContactForm`."
- kind: process
- artifacts: ContactDossierModal.tsx, ContactForm.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: For REVIEWNAV: the kiosk signing surface /release signs a real document and should be labelled destructive in any review section.
- quote: "**Signs a real document — REVIEWNAV should label this destructive**"
- kind: process
- artifacts: /release, src/pages/Release.tsx
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: For REVIEWNAV: a staff reviewer cannot see the member "My Documents" nav row (useNavPresence(!isStaff)), so the Signing B review entry must be added explicitly or the owner cannot reach it.
- quote: "**A staff reviewer will not see this nav row** (`useNavPresence(!isStaff)`) — REVIEWNAV must add the Review entry explicitly or the owner cannot reach it"
- kind: process
- artifacts: AppLayout.tsx, useNavPresence, /app/documents
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: The manifest and route/nav/retirement tables go stale fast — main moved twice during the census and closed three findings; anything downstream (REVIEWNAV especially) must re-derive against main at the moment it runs.
- quote: "Anything downstream of this report — **REVIEWNAV especially** — must re-derive route tables, nav groups and retirement constants against `main` **at the moment it runs**, not trust this document's snapshot."
- kind: process
- artifacts: docs/reports/TASK-DUPECENSUS-REPORT.md
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Related shadow catalogs: FORMS-ARE-UNUSED documents the 23 form_definitions rows read only by AdminFormsPage (a third hardcoded shadow); serviceCatalog.ts is a fourth; both should be resolved, neither supersedes the other.
- quote: "That doc names a **third** hardcoded shadow (form definitions, read only by `AdminFormsPage`). Mine (`src/lib/serviceCatalog.ts`) is a **fourth, and a different one**"
- kind: inventory
- artifacts: form_definitions, AdminFormsPage, src/lib/serviceCatalog.ts
- decision-mention: none

### ITEM
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: TASK-LEASESET / D10 (Standard/Simple/Detailed lease templates + archived original) listed as resolved; template duplication was deliberately not re-examined by this census.
- quote: "**`TASK-LEASESET` / D10** | Standard / Simple / Detailed + archived original | **resolved** | **No.** Template duplication was not re-examined."
- kind: inventory
- artifacts: contract_templates
- decision-mention: D10

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: HorsesPage — the original horse roster, routed but with zero references; nothing links to it.
- where: src/pages/app/ops/HorsesPage.tsx, route /app/ops/horses (App.tsx:279)
- quote: "**URL-only.** Grep of `src/` finds the string `/app/ops/horses` **once**, in `App.tsx:279` — the route registration itself. Nothing links to it."

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: OpsHome/OpsDashboard staff landing at /app/ops — routed, no nav entry, reached only if typed.
- where: src/pages/app/OpsHome.tsx, src/pages/app/ops/OpsDashboard.tsx, route /app/ops (App.tsx:258)
- quote: "**URL-only.** No nav entry. Reached only if typed."

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: InstructorHome renders only for isStaff && !isAdmin, and no such account exists in production — otherwise unviewable except via the preview route.
- where: src/pages/app/InstructorHome.tsx, src/pages/app/ops/InstructorHomePreview.tsx, /app/ops/preview/instructor-home
- quote: "`InstructorHome` renders only for `isStaff && !isAdmin`, and **no such account exists in production**"

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: ContactsPage retired behind CONTACTS_PAGE_RETIRED; route redirects to /app/admin; nav row removed by ADMINSWEEP X-1 — now URL-only, redirecting.
- where: src/pages/app/ops/ContactsPage.tsx:523, route /app/ops/contacts
- quote: "**`CONTACTS_PAGE_RETIRED = true` at `src/pages/app/ops/ContactsPage.tsx:523`** ... While true, the route renders `<Navigate to=\"/app/admin\" replace />`."

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: IntakePage retired behind INTAKE_PAGE_RETIRED (new mid-census); /app/ops/intake renders IntakeRetiredRedirect while true; RequestInbox still present at line 95 behind it.
- where: src/pages/app/ops/IntakePage.tsx:447, App.tsx:91,289
- quote: "**`INTAKE_PAGE_RETIRED = true` at `src/pages/app/ops/IntakePage.tsx:447`** (exported; `App.tsx:91,289` renders `IntakeRetiredRedirect` while true)."

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: Schedule.tsx (/app/schedule) is URL-only — in no nav table; only reached from two DashboardPanel "Coming up" tiles; holds the app's only RSVP surface.
- where: src/pages/app/Schedule.tsx, route /app/schedule (App.tsx:207)
- quote: "**URL-only.** Not in any nav table. The only links to it are two `DashboardPanel` \"Coming up\" tiles"

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: Account.tsx (/account) is URL-only, redirects members to /app, and its production audience is 3 synthetic test accounts.
- where: src/pages/Account.tsx, route /account (App.tsx:177)
- quote: "**URL-only**, and redirects members to `/app` ... **production audience** ... **3 — all synthetic** (`zz-test-buyer`, `zz-test-cobuyer`, `zz-test-seller` @example.invalid)"

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: serviceCatalog.ts — a hardcoded "single source of truth" catalog constant with zero importers in src/; only its drift-guard test reads it.
- where: src/lib/serviceCatalog.ts, test/db/service_catalog.test.ts
- quote: "the only file in the repo that imports it is `test/db/service_catalog.test.ts` — the test that guards it against drift. **No UI reads it.**"

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: Three dead dashboard count helpers with zero consumers: countContacts, countHorses, countOpenBillableLines (the tail of a KPI grid that lost two tiles).
- where: src/lib/api.ts:1307, :1316, :1335
- quote: "Three dead readers of three tables, sitting next to a live one. They are the tail of a KPI grid that lost two tiles."

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: DealHome (/app/deal) and CareHome (/app/care) — purpose-built homes reached by no production account (redirect condition !surfaces.has_feed is never true for anyone).
- where: src/pages/app/DealHome.tsx, src/pages/app/CareHome.tsx
- quote: "**Neither page is reached by any production account today.**"

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: StaffPage (/app/ops/employees/staff) — route registered but gated on mod.employees, which is disabled for FHE; renders the locked fallback; uses eight shared kit components against TeamPage's zero.
- where: src/pages/app/ops/StaffPage.tsx (184 lines), App.tsx:327
- quote: "route registered, but gated on `mod.employees`, which is **disabled** for FHE. Renders the locked fallback."

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: The Directory people page (/app/ops/directory) is a live nav entry to an empty page — contact_type='DIRECTORY' has 0 rows in production.
- where: /app/ops/directory, src/pages/app/ops/ContactsPage.tsx (mode='directory')
- quote: "Same file, `mode='directory'` → `contact_type = 'DIRECTORY'`. **Production: 0.** ... A nav entry to an empty page."

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: An inline body-preview block in ContractPage.tsx hidden behind INLINE_BODY_PREVIEW_RETIRED = true (not a page; no route).
- where: src/pages/app/ContractPage.tsx:86 (guards a block at line 2004)
- quote: "`const INLINE_BODY_PREVIEW_RETIRED = true`, guarding a block at line 2004."

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: Dark module pages rendering locked for FHE: /app/ops/boarding/* (3 pages + hub), /app/ops/barnops/* (3 + hub), /app/ops/employees/* (2 + hub) — modules disabled in org_modules.
- where: /app/ops/boarding/*, /app/ops/barnops/*, /app/ops/employees/*
- quote: "`mod.boarding`, `mod.barnops`, `mod.employees` are **disabled** for FHE (verified in `org_modules`), so ... render locked."

### INVENTORY
- report: TASK-DUPECENSUS-REPORT.md
- what: The PDF body renderer has no route and cannot be mounted as a page — REVIEWNAV must compare it by emailing a signed copy, or skip the slot.
- where: src/lib/documentPdf.ts
- quote: "`src/lib/documentPdf.ts` is a non-React PDF writer. REVIEWNAV cannot mount it as a page"

---

## TASK-GOOGLEAUTH-REPORT.md

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: The task's central Step 1 proof — cross-email Google identity linking on a throwaway account — was NOT RUN; no route to an authenticated session existed in the environment.
- quote: "**The task's Step 1 was to prove cross-email linking on a throwaway account and report the raw result. I could not run it, and I have not pretended otherwise anywhere below.**"
- kind: not-verified
- artifacts: linkIdentity, auth.identities
- decision-mention: none

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Correction: admin@cactai.io holding both email and google identities is not evidence that manual linking is enabled — its timing (+15s, matching addresses) is the signature of GoTrue's automatic same-email linking; decision 2 stays genuinely open.
- quote: "**that pair is not evidence that manual linking is on**, and it should not be leaned on when answering open decision 2"
- kind: correction
- artifacts: auth.identities, lib/auth.ts
- decision-mention: none

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Whether manual identity linking is enabled in the Supabase Auth dashboard is unknown and not determinable without a session; /auth/v1/settings does not expose the flag; a two-minute signed-in procedure is given to settle it.
- quote: "**Is manual identity linking enabled in the Supabase Auth dashboard? Unknown. Not determinable without a session, and I am not going to assume it.**"
- kind: blocked-on-owner
- artifacts: Supabase Auth settings (Allow manual linking)
- decision-mention: none

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Whether linking tolerates a different email is unproven for this project — Supabase documentation says yes, but that is documentation, not this project's evidence.
- quote: "per Supabase it does, but that is documentation, not this project's evidence. **Treat it as unproven.**"
- kind: not-verified
- artifacts: linkIdentity
- decision-mention: none

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Open decision 1 (does the password survive after Google linking) was implemented as "yes, it survives", but explicitly flagged as still the owner's call; no removal control was built.
- quote: "**Flagging rather than deciding: this is still the owner's call, and nothing here forecloses it.**"
- kind: blocked-on-owner
- artifacts: src/components/app/profile/LoginSecurityCard.tsx
- decision-mention: none

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Finding: the pre-existing @gmail.com domain gate hid the Google-activation control from every eligible member (all four password-only accounts are @icloud.com) — 0 of 4 could see it, so the redirect path has never been exercised in production.
- quote: "in production it was not a partial restriction — **it hid the control from every single member it was for.**"
- kind: defect
- artifacts: src/components/app/profile/LoginSecurityCard.tsx
- decision-mention: none

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Not verified: sign out → sign in via Google → same user_id / contact_id / documents — the "nothing else proves the switch worked" test is unrun.
- quote: "**Sign out → sign in via Google → same `user_id` / `contact_id` / documents** ... is equally unrun."
- kind: not-verified
- artifacts: auth flow
- decision-mention: none

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Not verified: whether the Supabase redirect allow-list contains /app/account — nobody has ever completed this redirect in production; if only the site root is allowed, the member lands on the home page and the outcome is reported nowhere (the quiet failure).
- quote: "**The redirect allow-list contains `/app/account`.** Nobody has ever completed this redirect in production ... The flag itself is the loud failure; this one is the quiet one."
- kind: not-verified
- artifacts: Supabase Authentication URL Configuration, redirectTo
- decision-mention: none

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Nothing was verified in a real browser — no authenticated session exists in the environment; component tests stand in for click-through and are not the same thing.
- quote: "**Anything in a real browser.** No authenticated session exists in this environment; the component tests stand in for click-through, and they are not the same thing."
- kind: not-verified
- artifacts: GoogleSignInRow, AccountHub.tsx
- decision-mention: none

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Two pre-existing test/ui failures confirmed on a clean tree and not fixed: clause_ownership_affordance (needs a dist/assets CSS artifact) and pluspass_create_controls (expects a CreateModal label that drifted).
- quote: "`clause_ownership_affordance` needs a `dist/assets` CSS artifact, and `pluspass_create_controls` expects a `CreateModal` label that has since drifted. **Neither is mine and neither is fixed here.**"
- kind: process
- artifacts: test/ui/clause_ownership_affordance, test/ui/pluspass_create_controls, CreateModal
- decision-mention: none

### ITEM
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: D1a honoured and noted: admin@cactai.io keeps org_id NULL by design; nothing in the change gives it an org or touches a tenant surface.
- quote: "**D1a honoured.** `admin@cactai.io` is the platform owner, holds `org_id NULL` by design, and is not a tenant member."
- kind: process
- artifacts: admin@cactai.io, profiles
- decision-mention: D1a

---

## TASK-INVITEWORKS-REPORT.md

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: HELD for owner sign-off: provision_client_invitation still supersedes on every call (live behaviour the owner ruled against) — a second self-onboarding submission kills the first link's /sign resume path; the fix is written and dry-run but deliberately not applied, kept in docs/proposed/ so no sweep picks it up.
- quote: "`provision_client_invitation` still supersedes on **every** call, which is the behaviour you ruled against. It is live right now"
- kind: blocked-on-owner
- artifacts: provision_client_invitation, docs/proposed/INVITEWORKS-provision-no-default-supersede.sql
- decision-mention: none

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Apply-order caveat: the held supersede migration must apply after the frontend deploys, or "Regenerate link" would mint a new link without retiring the old one during the gap.
- quote: "**Apply it after the frontend deploys.** Between the migration landing and the deploy, \"Regenerate link\" would mint a new link *without* retiring the old one"
- kind: process
- artifacts: api/admin-send-invitation.ts, docs/proposed/INVITEWORKS-provision-no-default-supersede.sql
- decision-mention: none

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Not verified: the staff send leg (§A resend/regenerate and §C links panel UI) — no worktree gets a staff login per the 2026-08-10 VERIFICATION POLICY; a 10-step post-deploy checklist is provided.
- quote: "**Not verified: the staff send leg.** Per the VERIFICATION POLICY ruling of 2026-08-10 no worktree gets a staff login."
- kind: not-verified
- artifacts: api/admin-resend-invitation.ts, InvitationHistoryPanel.tsx, InviteResultPanel.tsx, Admin.tsx, TeamPage.tsx
- decision-mention: none

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Flagged, not widened: invitations RLS is is_admin() (not has_staff_access()), so an instructor (MANAGER/EMPLOYEE) sees an empty invitation-links panel rather than a permission error — pre-existing, unchanged.
- quote: "that RLS pair is `is_admin()`, not `has_staff_access()` — so an instructor (MANAGER/EMPLOYEE) sees an empty panel rather than a permission error. Pre-existing, unchanged, flagged rather than widened."
- kind: defect
- artifacts: invitations RLS, InvitationHistoryPanel.tsx
- decision-mention: none

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Broken but out of scope: fhequestrian.com does not serve the app (Namecheap parking, times out) and BRAND.SITE_URL in config_values points at the dead host, so any email linking to the site sends people nowhere; invitation links are unaffected (built from request origin).
- quote: "**`fhequestrian.com` does not serve the app.** ... `BRAND.SITE_URL` in `config_values` points at the dead host, so any email linking to the site sends people nowhere."
- kind: defect
- artifacts: config_values (BRAND.SITE_URL), fhequestrian.com
- decision-mention: none

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Broken but out of scope: expired invitations never flip to status 'expired' — nothing sweeps them, so "13 sent" reads as thirteen live invitations when several are dead; the new panel derives Expired from the date, but the underlying rows stay wrong.
- quote: "**Expired invitations never flip to `expired`.** `maeboon@gmail.com` has been `status='sent'` since it expired Aug 4. Nothing sweeps them"
- kind: defect
- artifacts: invitations
- decision-mention: none

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Test rows created by this work left in production per D1 (purges are owner-run): two full accounts (cjzigs+inviteworks@ and cjzigs+inviteworks2@), each contact + client + 4 required documents + membership, both redeemed and active — say the word and they go through purge_account.
- quote: "**Test rows created by this work, left in place** (D1: purges are owner-run, never ad hoc)."
- kind: process
- artifacts: contacts 972d89a6, a92aace9, purge_account
- decision-mention: D1

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Broken but out of scope: sendViaProvider has no timeout — a hung SMTP connection hangs the function until Vercel kills it, with the invitation already committed, so the operator sees a request that never returns.
- quote: "**`sendViaProvider` has no timeout.** A hung SMTP connection hangs the function until Vercel kills it"
- kind: defect
- artifacts: api/_lib/delivery.ts (sendViaProvider)
- decision-mention: none

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Security trap found: Supabase default privileges grant EXECUTE to anon at CREATE time, so REVOKE FROM PUBLIC does not close a function; caught on first apply of 20260811170000; the other ~48 SECURITY DEFINER functions relying on a PUBLIC revoke alone are worth checking — reachable by anon today.
- quote: "**Worth checking the other ~48 SECURITY DEFINER functions** — anything relying on a PUBLIC revoke alone is reachable by `anon` today."
- kind: security
- artifacts: SECURITY DEFINER functions, supabase/migrations/20260811170000_inviteworks_resend_support.sql, record_invitation_delivery
- decision-mention: none

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Historic stacked live-token rows (hello@ 6, cjzigs@ 3, cjzigs+averify2@ 2) were not back-filled — rewriting their lifecycle would be inventing history.
- quote: "Historic rows were not back-filled — those 6/3/2 are pre-existing test sends and rewriting their lifecycle would be inventing history."
- kind: process
- artifacts: invitations
- decision-mention: none

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Owner check requested: did the three real invitation emails sent through the live production path arrive (cjzigs+inviteworks@ 15:40 UTC, cjzigs+inviteworks2@ ×2 15:48 UTC)? If so, delivery is confirmed end to end; indirect evidence says yes.
- quote: "If those landed, invitation email delivery is confirmed end to end."
- kind: not-verified
- artifacts: api/_lib/invitationEmail.ts, document_deliveries
- decision-mention: none

### ITEM
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Clarification of the "13 sent, never redeemed" figure: twelve of thirteen are earlier threads' test sends; the one real address is maeboon@gmail.com (expired Aug 4) — it is not thirteen failures.
- quote: "**It is not thirteen failures.** A genuine redemption ran 2026-08-10 ... and produced a complete account."
- kind: correction
- artifacts: invitations
- decision-mention: none

### INVENTORY
- report: TASK-INVITEWORKS-REPORT.md
- what: The proposed no-default-supersede migration is shelved in docs/proposed/ (deliberately outside supabase/migrations/ so no sweep applies it) awaiting owner sign-off.
- where: docs/proposed/INVITEWORKS-provision-no-default-supersede.sql
- quote: "**not applied**, and deliberately not in `supabase/migrations/` so no sweep can pick it up."

---

## TASK-LEADCLEAN-REPORT.md

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: Render NOT VERIFIED — no staff browser session existed; every count proven by SQL and interactions by 8 jsdom UI tests, but nobody has looked at the actual page.
- quote: "**Render status: NOT VERIFIED.** No staff browser session exists and none was given ... Nobody has looked at the actual page."
- kind: not-verified
- artifacts: src/components/app/DashboardPanel.tsx, src/components/app/LeadWorkDrawer.tsx
- decision-mention: none

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: Vetoable decision (a): the open-lead list now includes 'contacted' (and 'invited'), not just 'new' — the badge counts 5 rather than 1; if the owner wants "untouched since it arrived" it is a one-line change in the migration and listLeadQueue.
- quote: "**(a) The open list now includes `contacted`, not just `new`.** This is the one judgement call with teeth ... If you want the band to mean \"untouched since it arrived\", say so and it becomes a one-line change"
- kind: blocked-on-owner
- artifacts: 20260811T1900_leadclean_open_queue.sql, listLeadQueue, inbound_open_count
- decision-mention: none

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: F1 flagged, not fixed: requests_capture_contact has never actually linked a request — it assigns to NEW in an AFTER trigger, which does nothing; every request created since 2026-08-02 has NULL contact_id and there will be more; lowest-risk UPDATE fix stated but not applied (changes what every public submission writes — owner's call).
- quote: "**F1 — `requests_capture_contact` has never actually linked a request. This is why the NULLs exist, and there will be more.**"
- kind: defect
- artifacts: requests_capture_contact, requests.contact_id, 20260802000000_lead_trust_notifications.sql
- decision-mention: none

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: F2 reported, not decided: should the schedule-lesson path also write status='converted'? It is the only writer of that status and has never run (production holds only 'new' and 'contacted').
- quote: "**F2 — should the schedule-lesson path also write `status='converted'`?** The addendum says report, do not decide."
- kind: blocked-on-owner
- artifacts: requests.status, schedule_lesson_session
- decision-mention: none

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: F3 left alone deliberately: OpsDashboard.tsx:148 still links to /app/ops/intake ("Intake to review") — ADMINSWEEP owns that strand; and the staff email in api/request-received.ts:163 still reads "Open the Request Inbox" (link redirects correctly).
- quote: "**F3 — `OpsDashboard.tsx:148` still links to `/app/ops/intake`** (\"Intake to review\"). Left alone deliberately"
- kind: defect
- artifacts: src/pages/app/ops/OpsDashboard.tsx:148, api/request-received.ts:163
- decision-mention: none

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: F4 noted: the platform owner (SUPER_ADMIN, org_id NULL) gets inbound_open_count() = 0 because org_id = current_org() is never true when current_org() is NULL — pre-existing and unchanged.
- quote: "**F4 — the platform owner (SUPER_ADMIN, `org_id` NULL) gets `inbound_open_count() = 0`.** ... **Pre-existing and unchanged**"
- kind: correctness
- artifacts: inbound_open_count
- decision-mention: none

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: F5: the "more waiting" expand control cannot be exercised against live data (five open leads against a six-card preview = zero remainder, so it never renders today) — proven by UI test only.
- quote: "**F5 — the \"more waiting\" control cannot be exercised against live data.** ... the control does not render at all today."
- kind: not-verified
- artifacts: DashboardPanel.tsx (LEAD_PREVIEW)
- decision-mention: none

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: The backfill's ambiguous-email guard (HAVING count(*) = 1) is untested by production data — no ambiguous rows existed — so the DB test builds the ambiguous case explicitly and proves the refusal.
- quote: "The guard is therefore untested by production data, so the DB test builds the ambiguous case explicitly (two contacts on one email) and proves the refusal."
- kind: process
- artifacts: 20260811T1900_leadclean_open_queue.sql, test/db/leadclean_open_queue.test.ts
- decision-mention: none

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: Known issue: most test/db suites fail at setup on both trees — the snapshot postdates the offering_tiers removal ("relation offering_tiers does not exist"); organizations and service_catalog fail assertions identically on main.
- quote: "Most suites fail at setup on both trees (`relation \"offering_tiers\" does not exist` — the snapshot postdates the tiers removal)"
- kind: process
- artifacts: test/db
- decision-mention: none

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: Cross-thread collision found and fixed: ADMINSWEEP P2's test mocked useOpenLeads as a bare array; this task changed the hook's return shape, breaking InstructorHome under the mock — caught by rebasing, fixed in a22b03e.
- quote: "This task changes that hook's return to `{ open, converted, reload }` and `InstructorHome` destructures `.open`, so the bare-array mock made the component read `.length` of `undefined`."
- kind: process
- artifacts: test/ui/adminsweep_instructor_preview.test.tsx, useOpenLeads, InstructorHome
- decision-mention: none

### ITEM
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: A real migration bug the harness caught: Postgres has no min(uuid) aggregate — the first draft would have rolled back the whole migration; replaced with (array_agg(c.id ORDER BY c.created_at))[1].
- quote: "**Postgres has no `min()` aggregate for `uuid`** — confirmed against production directly, not just PGlite"
- kind: process
- artifacts: 20260811T1900_leadclean_open_queue.sql
- decision-mention: none

### INVENTORY
- report: TASK-LEADCLEAN-REPORT.md
- what: IntakePage retired behind INTAKE_PAGE_RETIRED — nothing deleted, the page still compiles and flipping the boolean restores it whole; the route redirects to /app/dashboard carrying ?request= through because five DB functions and one staff email still write notification links pointing there.
- where: src/pages/app/ops/IntakePage.tsx (INTAKE_PAGE_RETIRED), submit_public_request, create_gift, redeem_gift, provision_client_invitation, sign_start_register_attempt, api/request-received.ts
- quote: "`INTAKE_PAGE_RETIRED = true` in `IntakePage.tsx` ... **Nothing is deleted** — the page still compiles and flipping the boolean restores it whole."

---

## TASK-LEASEFIX-REPORT.md

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Orchestrator audit correction stamped on the report: its deployment section is WRONG — everything is deployed; the thread tested SHA reachability instead of content (cherry-picks always get new hashes); third instance of the same mistake from this thread.
- quote: "**Everything in this report is deployed.** The thread concluded otherwise by testing whether its own cherry-picked SHAs are ancestors of `origin/main`."
- kind: correction
- artifacts: docs/reports/TASK-LEASEFIX-REPORT.md, git patch-id
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Process lesson recorded by the audit: when asking "did this land?", test the CONTENT (git patch-id --stable, or grep the file on the target ref), never the SHA.
- quote: "**The habit to build: when asking \"did this land?\", test the CONTENT — `git patch-id --stable`, or grep the file on the target ref. Never the SHA.**"
- kind: process
- artifacts: git workflow
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: The thread's earlier oneheader claim to the owner ("committed but not on main") was false — the header work is merged and deployed; acting on the warning would have duplicated already-merged work.
- quote: "**That is false.** Re-verified myself on 2026-08-10 ... The header work is merged and deployed."
- kind: correction
- artifacts: task/oneheader (eaab867), AppHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Frozen-file violation awaiting the owner's ruling: ClauseDocument.tsx was edited (16 insertions, 2 deletions — flex-wrap/shrink-0 label-squeeze fix) without knowing it was frozen; not reverted per directive, no further edits.
- quote: "I edited a file I was not permitted to edit. I did not know it was frozen — that is an explanation, not a defence"
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx (commit 2be3faa/41d9b37)
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: The ClauseDocument change's visual harmlessness elsewhere is assessed, not measured — renderOrphan renders every clause-level orphan control across all clause-engine templates (certify checkboxes, gate controls, Sale/BOS); a regression would show as a control dropping to its own line on narrow viewports.
- quote: "**Assessed risk, not measured:** ... **I have not proved that** — I typechecked and built, which catches neither."
- kind: not-verified
- artifacts: ClauseDocument.tsx (renderOrphan), HORSE_SALE_V2, HORSE_BILL_OF_SALE
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Whether the fix actually cures the owner's screenshot was never rendered in a browser — the worktree has placeholder Supabase keys so the frontend cannot run against real data.
- quote: "**That the fix actually cures the owner's screenshot.** Never rendered in a browser — this worktree has placeholder Supabase keys"
- kind: not-verified
- artifacts: ClauseDocument.tsx, InlineSelect
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: TXN.OFFSITE_TRANSPORT (clause 11.8, 120-char option) may have the same label squeeze — inferred, renders through a different path (inline prose), not confirmed.
- quote: "**That `TXN.OFFSITE_TRANSPORT` (11.8) has the same squeeze.** Inferred from its 120-character option ... I did not confirm it."
- kind: not-verified
- artifacts: TXN.OFFSITE_TRANSPORT
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Alternative if the freeze holds: the defect can be addressed data-only (no deploy) by shortening the long dropdown option labels — four fields carry an option long enough to trigger it.
- quote: "**If the freeze holds**, the same defect can be addressed without this file by shortening the long dropdown option labels — data-only, no deploy."
- kind: process
- artifacts: TXN.OFFSITE_TRANSPORT, TXN.CCC_REQUIRED, GL elections
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Open: the four cherry-picked commits exist in two places (task/leasefix and local main beneath 9 orchestrator commits); someone with authority over main must decide whether they get dropped or land on merge — not touched.
- quote: "**Someone with authority over `main` needs to decide** whether those four get dropped from it or simply land there when `task/leasefix` merges."
- kind: blocked-on-owner
- artifacts: local main, task/leasefix
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Migration 20260809T2000 is dead weight — it adds a field that 20260809T2100 deletes; left in place because the journal records what was actually run.
- quote: "**`20260809T2000` is dead weight** — it adds a field that `20260809T2100` deletes. Replaying the journal on a fresh database produces the right end state but does needless work."
- kind: process
- artifacts: supabase/migrations/20260809T2000_leasefix_gl_lessor_requires_lessee.sql
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Correction: the lease templates hold 131 fields, not the 130 reported to the owner — that number predated TXN.GL_LESSOR_COVERAGE.
- quote: "Note **131 fields, not the 130 I reported to the owner** — that number predated `TXN.GL_LESSOR_COVERAGE`."
- kind: correction
- artifacts: contract_field_defs, TXN.GL_LESSOR_COVERAGE
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: The reversion diagnosis given to the owner was wrong — the actual mechanism was a git checkout left on a task branch in the canonical checkout for ~3 hours; two false alarms in one session, both from inferring instead of checking.
- quote: "**The reversion diagnosis was mine and it was wrong.** ... **Two false alarms in one session, both from inferring instead of checking**"
- kind: correction
- artifacts: canonical checkout, task/leasefix-2026-08-09
- decision-mention: none

### ITEM
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Still open: whether the Lessor's own-coverage election (TXN.GL_LESSOR_COVERAGE) should gate anything — it currently gates nothing, which is deliberate (CCC rides on the Lessee's policy).
- quote: "Whether the Lessor's own-coverage election should gate anything. It currently gates nothing, which is deliberate"
- kind: blocked-on-owner
- artifacts: TXN.GL_LESSOR_COVERAGE, 20260809T2200_leasefix_gl_lessor_own_coverage.sql
- decision-mention: none

---

## TASK-NOGUARD2-REPORT.md

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Self-correction: the Phase B review summary's counts (23/24/28/48) were stale — correct figures are 26 lose authenticated / 27 closed by B / 31 total / 45 remaining; the set of functions was never wrong.
- quote: "The correct figures are **26 / 27 / 31 / 45**. The *set* of functions was never wrong"
- kind: correction
- artifacts: Phase B migrations 20260810T0300–T0700
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Correction to input docs: the "nine anon-reachable contract_fields writers" are seven — contract_split_deductible_sync and sync_horse_fields_to_documents are RETURNS trigger and cannot be called directly.
- quote: "Two of the nine are an artifact of that dropped filter."
- kind: correction
- artifacts: contract_split_deductible_sync, sync_horse_fields_to_documents
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Correction to the audit: remove_document_co_buyer IS anon-reachable with no identity check at all (deletes BUYER rows and clears COBUYER.* values given only a document id), and set_field_structured is a fourth lock-caller the audit omits.
- quote: "**`remove_document_co_buyer` carries no identity check at all** — it deletes `BUYER` rows from `document_parties` and `contract_parties` and clears every `COBUYER.*` value, given only a document id."
- kind: security
- artifacts: remove_document_co_buyer, set_field_structured, set_document_co_buyer
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Flagged, not fixed: remove_document_co_buyer calls assert_not_signature_locked AFTER its DELETEs and UPDATE, not before — not currently exploitable, but a caller wrapping it in an EXCEPTION handler would keep the deletes and swallow the lock, and this codebase has exactly such a handler; reordering belongs in its own reviewed change.
- quote: "any caller wrapping it in an `EXCEPTION` handler would keep the deletes and swallow the lock, and this codebase has exactly such a handler (`sync_horse_fields_to_documents` does `EXCEPTION WHEN OTHERS THEN NULL`). Reordering is a body rewrite and belongs in its own reviewed change"
- kind: defect
- artifacts: remove_document_co_buyer, assert_not_signature_locked
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Correction to the task doc: "revoking breaks the in-database caller" is false here — SECURITY DEFINER callers execute as postgres, which keeps EXECUTE; revoking closes the HTTP surface and leaves the internal call graph untouched; this changed the strategy from seven guards to revoke-six-guard-one.
- quote: "**Revoking closes the HTTP surface and leaves the internal call graph untouched.**"
- kind: correction
- artifacts: apply_field_formats, noguard2_probe_wrapper
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Residual risk flagged: the fill_party_fields_from_contacts guard's staff branch additionally requires d.org_id = current_org(), marginally tighter than the callers' bare has_staff_access() — inert with one organization, but a real difference under multi-tenancy.
- quote: "this is inert today — but it is a real difference and would matter under multi-tenancy."
- kind: correctness
- artifacts: fill_party_fields_from_contacts, caller_is_document_party_or_staff
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: A distinct failure shape found while sweeping: guards that explicitly exempt the unidentified caller (IF auth.uid() IS NOT NULL AND NOT …) in remerge_contract_from_fields and invite_contract_counterparty — not an anon hole (neither is anon-executable) but an authenticated exposure belonging to NOGUARD3; a class worth grepping for.
- quote: "Two functions carry a guard that **explicitly exempts the unidentified caller** — the inverse of the NULL-propagation bug"
- kind: security
- artifacts: remerge_contract_from_fields, invite_contract_counterparty
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: 45 functions remain DOES-NOT-ENFORCE, deliberately left with reasons per group: 7 safe by construction; 4 config reads; 4 api-called log writers (receipt/idempotency seam — log_receipt_send burning an idempotency key can suppress a real receipt); 14 document/deal readers leaking by document id (need per-function party guards — a coherent third phase); 8 horse/member readers (animal medical data, name/address lookups); 8 writers needing designed guards (complete_deal, assert_horse_care_eligible which creates documents despite the name, etc.).
- quote: "Deliberately left, grouped by reason. Nothing here is left for lack of time; each has a reason it should not be changed by this task."
- kind: security
- artifacts: log_receipt_send, contract_notes_for_document, document_signature_state, party_user_ids, horse_medications_prose, member_horses, complete_deal, assert_horse_care_eligible, supersede_invitations, ensure_staff_profile
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Data observation flagged, not caused here: two documents show a negative contract_fields delta against their template defs (ecaecd42 −22, 9a56b738 −3); both gaps pre-date this task.
- quote: "Two documents show a negative field delta against their template defs (`ecaecd42…` −22, `9a56b738…` −3) ... **Flagged, not caused here.**"
- kind: data-integrity
- artifacts: contract_fields, documents ecaecd42, 9a56b738
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Owner-accepted residual: the remaining in-database callers (start_bill_of_sale, start_sale_contract, start_lease_contract_v2, add_deal_document, reassign_document_party, set_document_co_buyer, and trigger-borne paths) were not each exercised end-to-end — each mutates real data; the mechanism is uniform and proven by two closed chains.
- quote: "**Owner-accepted at review as a residual, not closed.**"
- kind: not-verified
- artifacts: start_bill_of_sale, start_bill_of_sale_standalone, start_sale_contract, start_lease_contract_v2, add_deal_document, reassign_document_party
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Out of scope but named: NOGUARD3's real question is untouched — 370 definer functions are still callable by any free signup, most with browser callers needing predicates, not grant changes; on consequence this still outranks what this task closed.
- quote: "**370** definer functions are still callable by any free signup, and most of them *do* have browser callers, so they cannot be fixed by a grant"
- kind: security
- artifacts: (370 SECURITY DEFINER functions)
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: A new SECURITY DEFINER function landed mid-task: compose_insurance_allocation (leasefix thread, 2026-08-09) — anon/PUBLIC revoked (good pattern to copy) but authenticated-reachable, which is NOGUARD3's surface.
- quote: "one was added since the audit: `compose_insurance_allocation(uuid)`, from the leasefix thread on 2026-08-09 ... It is `authenticated`-reachable, which is NOGUARD3's surface."
- kind: security
- artifacts: compose_insurance_allocation
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Snapshot staleness bit twice within three days: two Phase B targets (recompose_document_fields, sync_contract_fields_from_defs) were rewritten mid-task by the leasefix migrations; both were re-read from production rather than trusting the audit.
- quote: "This is NOGUARD1's caveat #9 (point-in-time snapshot) actually biting, twice, within three days."
- kind: process
- artifacts: recompose_document_fields, sync_contract_fields_from_defs
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Assumed, not proven: the 45 remainder are still unguarded — NOGUARD1's classification carried forward without re-reading all 45 bodies; a BEFORE trigger, CHECK or NOT NULL outside the body may already stop some, so 76 may be an over-count.
- quote: "**The 45 remainder are still unguarded.** I did not re-read all 45 bodies; I carried NOGUARD1's classification forward."
- kind: not-verified
- artifacts: (45 remaining functions)
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: The PostgREST HTTP layer was not probed (no real anon key available); all anon behaviour was demonstrated at the database layer with the role and JWT claim PostgREST sets.
- quote: "**The PostgREST HTTP layer.** Not probed, for want of a real anon key."
- kind: not-verified
- artifacts: PostgREST, .env
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: The three retained service_role paths (confirm_booking_for_purchase, lease_expiry_nudge, publish_open_slots_all) were privilege-checked but deliberately not executed — running them would notify every lessee / write availability across every tenant.
- quote: "**The `service_role` sweeps were not executed**, only privilege-checked."
- kind: not-verified
- artifacts: confirm_booking_for_purchase, lease_expiry_nudge, publish_open_slots_all
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Behaviour change worth naming: a future guest-checkout gift with NULL buyer_user_id was actionable by any account holder before the coalesce fix and is now staff-only — a correction, moot at 0 gift rows, but it will matter when the gift subsystem is finished.
- quote: "a future guest-checkout gift would be actionable today by any account holder, and afterwards by staff only ... it is currently moot at 0 gift rows."
- kind: correctness
- artifacts: gift_claim_link, gift_mark_sent, gift_reschedule, gifts
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Caveat stated: the production database is not quiescent — contacts read 34→35→34 during reconnaissance and contract_fields moved 654→645 through a live PostgREST session; other threads work the same DB while tasks run.
- quote: "**Caveat, stated rather than glossed:** the production database is not quiescent."
- kind: process
- artifacts: production db lrstswfxfsezdmvkvukc
- decision-mention: none

### ITEM
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Deliberately left alone on instruction: the intentionally-public set — redeem_gift (self-enforcing), open_gift (the gift code is the credential), and the public catalog read path — confirmed untouched.
- quote: "**Separately, left alone on instruction** ... Confirmed untouched."
- kind: process
- artifacts: redeem_gift, open_gift
- decision-mention: none

### INVENTORY
- report: TASK-NOGUARD2-REPORT.md
- what: void_signatures_on_edit(uuid) had never fired (0 documents with signatures_voided_at) and had zero callers by four methods — dropped in Phase A.
- where: void_signatures_on_edit (dropped; body recoverable from six historical migrations)
- quote: "**It had never fired** ... This is the strongest evidence available that nothing depended on it"

### INVENTORY
- report: TASK-NOGUARD2-REPORT.md
- what: The gifts subsystem holds 0 rows and no INSERT path into gifts exists in pg_proc, src/ or api/ — the guarded gift functions have no live data to act on.
- where: gifts table, gift_claim_link, gift_mark_sent, gift_reschedule
- quote: "`gifts` holds **0 rows** and no INSERT path into it exists in `pg_proc`, `src/` or `api/`"

---

## TASK-PROFILE-REPORT.md

### ITEM
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: No badge data model exists anywhere (no table, no code references beyond icons/pills), so the spec's badge slot was omitted, not faked, per the task doc's own instruction.
- quote: "No badge data model exists anywhere ... the badge slot is **omitted**, not faked."
- kind: inventory
- artifacts: (badge model — absent)
- decision-mention: none

### ITEM
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: Defect found: the prior "Notifications" block was three defaultChecked checkboxes with zero read/write wiring — toggling them did nothing, on every account, forever; Preferences now renders informational rows saying "coming soon"; building real per-category preferences is out of scope and flagged for the owner.
- quote: "The prior \"Notifications\" block in `ProfileSection` was three `defaultChecked` checkboxes with zero read/write wiring — toggling them did nothing, on every account, forever."
- kind: defect
- artifacts: src/components/app/profile/PreferencesCard.tsx, AccountHub.tsx (old ProfileSection)
- decision-mention: none

### ITEM
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: Real undocumented leak found: member_directory still exposes the legacy contacts.mobile/.whatsapp/.email columns gated only by hide flags that have no UI to set them — known deferred cleanup ("Stage B drops the columns"), which drove the decision to add a new mobile_number column rather than reuse contacts.mobile.
- quote: "**A real, undocumented leak found while mapping the community read path**: `member_directory` still exposes the *legacy* `contacts.mobile`, `.whatsapp`, `.email` columns ... gated only by ... flags with **no UI to set them**"
- kind: security
- artifacts: member_directory, contacts.mobile, contacts.whatsapp, contacts.email
- decision-mention: none

### ITEM
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: Correction to the task doc: emergency-contact data does not live in contract_fields as the doc hedged — the merge tokens bind straight to contacts.emergency_contact_* columns.
- quote: "The \"contract_fields\" pointer in the task doc for emergency contact turned out not to be literally where the data lives"
- kind: correction
- artifacts: contacts.emergency_contact_1_name, token_dictionary_sync
- decision-mention: none

### ITEM
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: Not done: an authenticated in-browser click-through — K1–K4 marked "code-complete, browser pending"; owner or orchestrator should do a visual pass on /app/account → Profile & preferences before shipping.
- quote: "**Not done: an authenticated in-browser click-through.** ... Recommend the owner or the orchestrator does a visual pass on `/app/account` → \"Profile & preferences\" before this ships."
- kind: not-verified
- artifacts: /app/account, ProfileAndPreferences.tsx, docs/BUILD_TRACKER.md §K
- decision-mention: none

### ITEM
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: Disk-space incident disclosed: volume at 99%; deleted only node_modules of 19 already-merged worktrees (8GB reclaimed); flagged for whoever owns worktree hygiene — it will hit the same wall again soon.
- quote: "Flagging this for whoever owns worktree hygiene — it will hit the same wall again soon."
- kind: process
- artifacts: claude-code-repo worktrees
- decision-mention: none

### ITEM
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: The mobile_number-vs-contacts.mobile decision was the closest approach to the STOP-and-ask gate — resolved by evidence (reuse would leak new internal data to the whole community via member_directory) and documented rather than guessed or blocked.
- quote: "The `mobile_number`-vs-`contacts.mobile` call (§2) is the one place this task came closest to the STOP-and-ask gate"
- kind: process
- artifacts: contacts.mobile_number, member_directory
- decision-mention: none

---

## TASK-REQTRIGGER-REPORT.md

### ITEM
- report: TASK-REQTRIGGER-REPORT.md
- date: 2026-08-12
- item: Kylie Pinion's request (created after LEADCLEAN's backfill) is the predicted third unlinked row and is left NULL per the do-not-backfill instruction; whether she and future NULL rows get a LEADCLEAN-style backfill is explicitly out of scope.
- quote: "Kylie Pinion ... is the **third** unlinked row the task doc predicted. It is left NULL, per the \"do not backfill\" instruction"
- kind: process
- artifacts: requests (row 8f0dc795), requests.contact_id
- decision-mention: none

### ITEM
- report: TASK-REQTRIGGER-REPORT.md
- date: 2026-08-12
- item: Correction to the brief: requests_capture_contact has no branch producing NULL for an ambiguous match — it picks the oldest-created matching contact or creates one; "absent" is unreachable via a valid insert; pre-existing matching behaviour left unchanged, the gap between wording and code flagged rather than an ambiguity branch invented.
- quote: "**`requests_capture_contact` has no branch that produces `NULL` for an ambiguous match** — it was never in scope of this fix and I did not add one."
- kind: correction
- artifacts: requests_capture_contact
- decision-mention: none

### ITEM
- report: TASK-REQTRIGGER-REPORT.md
- date: 2026-08-12
- item: Assumed, not verified: that no application code path reads requests.contact_id expecting the old (broken, never-populated) semantics — frontend/API consumers were not audited.
- quote: "No application code path reads `requests.contact_id` expecting the old (broken) semantics — I did not grep the frontend/API for consumers."
- kind: not-verified
- artifacts: requests.contact_id
- decision-mention: none

### ITEM
- report: TASK-REQTRIGGER-REPORT.md
- date: 2026-08-12
- item: Methodology note worth keeping: RETURNING on an INSERT reflects the row before an AFTER trigger's separate UPDATE lands — a first proof attempt looked like failure; a second independent SELECT is required to observe AFTER-trigger side effects.
- quote: "`RETURNING` on the `INSERT` statement reflects the row as of that statement, before the `AFTER` trigger's separate `UPDATE` lands."
- kind: process
- artifacts: requests_capture_contact_trg
- decision-mention: none

---

## TASK-SQLTRUTH-REPORT.md

### ITEM
- report: TASK-SQLTRUTH-REPORT.md
- date: 2026-08-04
- item: Correction to the task brief: it was stale — 20260804120000_add_item_composition.sql already carried three of the four claimed-missing features; only the CUSTOM.% terminal-punctuation block was actually missing from git; real drift smaller than described.
- quote: "That is stale. ... only **one** of the four claimed-missing features was actually missing from git: the CUSTOM.% terminal-punctuation block."
- kind: correction
- artifacts: remerge_contract_from_clauses, 20260804120000_add_item_composition.sql
- decision-mention: none

### ITEM
- report: TASK-SQLTRUTH-REPORT.md
- date: 2026-08-04
- item: Caveat: set_contract_field has no server-side before md5 — its proof is a local file diff/md5 of pg_get_functiondef dumps, a weaker proof than the server-side before/after hash pairs used for the other four functions.
- quote: "This is a weaker proof than the server-side before/after `md5()` pair used for the other four"
- kind: process
- artifacts: set_contract_field, 20260804130000_sql_truth_recapture.sql
- decision-mention: none

### ITEM
- report: TASK-SQLTRUTH-REPORT.md
- date: 2026-08-04
- item: Drift found and recaptured: live set_contract_field calls assert_not_signature_locked where git still had void_signatures_on_edit, and the HORSE.% writeback block was removed live (Deal plan L10) but still present in git — the journal had diverged from production.
- quote: "(1) live calls `assert_not_signature_locked(p_document_id)` where git still has `void_signatures_on_edit(p_document_id)`; (2) live has removed the `HORSE.%` writeback block"
- kind: data-integrity
- artifacts: set_contract_field, contract_horse_field_writeback
- decision-mention: none

---

## TASK-TITLESWEEP-REPORT.md

### ITEM
- report: TASK-TITLESWEEP-REPORT.md
- date: 2026-08-05
- item: Orders was not explicitly named in the owner's spec table — the eyebrow/intro change was applied by pattern for consistency, flagged prominently, and is a 2-line diff to revert if vetoed.
- quote: "**Owner did not explicitly name Orders in the spec table — applied by pattern for consistency with the other list pages. Flagging prominently per the task doc's instruction; easy to revert (2-line diff) if vetoed.**"
- kind: blocked-on-owner
- artifacts: src/pages/app/Orders.tsx
- decision-mention: none

### ITEM
- report: TASK-TITLESWEEP-REPORT.md
- date: 2026-08-05
- item: Flag for owner/future task: a single-direction Gifts header ("received" vs "given") requires lifting gift data up to Gifts.tsx or a callback from GiftsContent — a structural change out of this copy pass — and GiftsContent is also reused on the Account page, so any fix must target the shared component.
- quote: "**Flag for owner/future task:** if a single-direction header is wanted, it requires either lifting the gift-direction data up to `Gifts.tsx` or passing a callback down from `GiftsContent`"
- kind: process
- artifacts: src/pages/app/Gifts.tsx, src/components/app/GiftsContent.tsx
- decision-mention: none

### ITEM
- report: TASK-TITLESWEEP-REPORT.md
- date: 2026-08-05
- item: Correction: the task doc's stated lint baseline (29 warnings) is stale — unmodified origin/main gives 36/0; verified by stashing and re-running.
- quote: "The task doc's stated baseline (29 warnings) is stale — verified by stashing this task's changes and re-running lint against unmodified `origin/main` (`800b352`): same 36/0."
- kind: correction
- artifacts: npm run lint
- decision-mention: none

### ITEM
- report: TASK-TITLESWEEP-REPORT.md
- date: 2026-08-05
- item: All edits are code-complete but not visually verified in a running browser (no dev server session), consistent with prior UI-copy tasks; visual risk limited to intended copy changes.
- quote: "All edits are code-complete but not visually verified in a running browser (no dev server session run in this pass)"
- kind: not-verified
- artifacts: AccountHub.tsx, Support.tsx, Schedule.tsx, MyLessons.tsx, Gifts.tsx, CareHome.tsx, Documents.tsx, MyPosts.tsx, Orders.tsx
- decision-mention: none

---

## TASK-TOKENAUDIT-REPORT.md

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: Answer to Question 1: template_tokens.source_table/source_column are documentation, not the resolution mechanism — no code path reads them at merge time or ever; the 59 dead-source tokens are stale provenance notes, not live broken renders.
- quote: "**`source_table` / `source_column` are documentation, not the resolution mechanism. No code path reads them — at merge time or ever.**"
- kind: correctness
- artifacts: template_tokens.source_table, template_tokens.source_column, generate_document
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The one live landmine: MINOR_RIDER is ACTIVE with a 5,481-byte body and ZERO scoped token rows — generating from it would render every one of its 26 tokens as literal {{…}} text; no document has ever been generated from it, the doc says it was retired, the table disagrees; deactivation recommended (owner call).
- quote: "**The one live landmine: `MINOR_RIDER` is ACTIVE with a 5,481-byte body and ZERO scoped token rows.** If anyone generates from it, **every one of its 26 tokens renders as literal `{{…}}` text**"
- kind: defect
- artifacts: contract_templates (MINOR_RIDER), template_tokens, docs/TOKEN_DICTIONARY.md
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: FLAGGED LOUDLY: DOC.UUID and ORD.UUID both map to documents.id — either the ORD.UUID name is wrong (a DOC token wearing an ORD name) or the mapping is (should print the purchase id/PUR-code, which currently has no token at all); unused today so nothing breaks, but owner ruling requested.
- quote: "**`{{DOC.UUID}}` vs `{{ORD.UUID}}` → both `documents.id` — FLAGGED LOUDLY.**"
- kind: blocked-on-owner
- artifacts: template_tokens (ORD.UUID, DOC.UUID), documents.id, purchases
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: Two EXECUTED documents from 2026-07-10 carry literal unfilled tokens ({{CLIENT.EMERGENCY_CONTACT_2_*}}, {{HORSE.MICROCHIP}}, {{HORSE.FARRIER_*}}) — generated before scoped rows existed; report-only under the SIGNING FREEZE, executed bodies stay as they are.
- quote: "**Two frozen artifacts (report-only, SIGNING FREEZE):** two EXECUTED docs from **2026-07-10** carry literal `{{CLIENT.EMERGENCY_CONTACT_2_*}}` / `{{HORSE.MICROCHIP}}` / `{{HORSE.FARRIER_*}}` etc."
- kind: data-integrity
- artifacts: documents (HORSE_EMERGENCY_VET, RELEASE_HORSE_CARE executed 2026-07-10)
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The 17 intake.* tokens (ENG intake ×13 + REQ ×4) always render blank — the capture was never built; BUILD-OR-RETIRE is the owner's call; notes already say "do not place".
- quote: "**Always render blank** — the capture was never built | **BUILD-OR-RETIRE (owner)**"
- kind: blocked-on-owner
- artifacts: template_tokens (ENG.*, REQ.* intake group)
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The retainer/representation money tokens (RETAINER_FEE, SUCCESS_FEE, REPRESENTATION_FEE, PAYMENT_TERMS) sit in ACTIVE bodies but render blank — no working-copy field feeds those flat templates, so the two templates cannot produce a complete agreement today; WIRE BEFORE USE.
- quote: "these two templates cannot produce a complete agreement today | **WIRE BEFORE USE**"
- kind: defect
- artifacts: template_tokens (TXN.RETAINER_FEE, TXN.SUCCESS_FEE, TXN.REPRESENTATION_FEE, TXN.PAYMENT_TERMS), retainer/representation contract_templates
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The 9 retired order-form fee tokens are retire-candidates (hide from picker) — blank and unused; owner rules; none deleted.
- quote: "**RETIRE-CANDIDATE** (hide from picker), owner rules"
- kind: blocked-on-owner
- artifacts: template_tokens (TXN.PACKAGE_FEE, SERVICE_FEE, PAYMENT_SCHEDULE, SESSION_FEE, MONTHLY_FEE, OTHER_FEES, EVALUATION_FEE, ADDITIONAL_SERVICES, JUMPER_TRAINING_FEE)
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: Dead columns found while validating: horses.owner_name does not exist (HORSE.OWNER_NAME renders blank) and horses.barn_name's real column is nickname (token resolves fine because the code reads nickname) — report-only.
- quote: "`horses.owner_name` (HORSE.OWNER_NAME — column does not exist, token renders blank), `horses.barn_name` (HORSE.BARN_NAME — real column is `nickname` ...). Report-only."
- kind: correctness
- artifacts: template_tokens (HORSE.OWNER_NAME, HORSE.BARN_NAME), horses
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: Duplicate wiring for owner rulings, none resolved: PARTY.FULL_NAME vs PARTY.PRINTED_NAME (identical output), TXN.PACKAGE_FEE vs TXN.SERVICE_FEE (pure legacy twins), and FHE.* vs ORG.* (7 pairs, same CASE arm — retiring FHE.* from the picker is the obvious move but is a ruling).
- quote: "**Duplicate wiring — for the owner to rule on, not resolved**"
- kind: blocked-on-owner
- artifacts: template_tokens (PARTY.*, FHE.*, ORG.*, TXN.PACKAGE_FEE, TXN.SERVICE_FEE)
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: TOKEN_DICTIONARY.md disagrees with the table in several places (MINOR_RIDER retirement, ORD.UUID source, CLIENT.* autofill path, retired TXN sections, missing clause-engine field_keys) and CLIENT.EUTHANASIA_INITIALS is a doc-only ghost with no row and no body use; the doc needs a rewrite after owner rulings — not attempted here.
- quote: "The doc needs a rewrite **after** the owner rules on §5/§6 — not attempted here."
- kind: correction
- artifacts: docs/TOKEN_DICTIONARY.md, template_tokens, CLIENT.EUTHANASIA_INITIALS
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: D13 note: token descriptions now live in template_tokens.notes but the only editor is SQL; TEXTEDIT's picker READS them; no admin surface that EDITS them is specified anywhere — the dictionary is developer-maintained until one ships, flagged rather than called finished.
- quote: "an admin surface that EDITS them is not yet specified anywhere. Until one ships ... this dictionary is developer-maintained — flagged per D13"
- kind: blocked-on-owner
- artifacts: template_tokens.notes
- decision-mention: D13

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The stale source_table/source_column re-pointing recommendations (per-group in §5) are documentation-only writes deliberately left outside this task's write scope — none done.
- quote: "The stale `source_table`/`source_column` re-pointing (§5) — documentation-only writes, deliberately outside this task's write scope."
- kind: process
- artifacts: template_tokens.source_table, template_tokens.source_column
- decision-mention: none

### ITEM
- report: TASK-TOKENAUDIT-REPORT.md
- date: 2026-08-12
- item: The picker has TWO vocabularies to draw from: template_tokens (307 rows) and contract_field_defs' 667 dotted field_keys (a parallel, healthier dictionary that IS the clause-body token set) — 213 of the 272 "used-but-undefined" tokens are simply clause-engine field-keys.
- quote: "**it means the picker has TWO vocabularies to draw from**"
- kind: inventory
- artifacts: template_tokens, contract_field_defs
- decision-mention: none

### INVENTORY
- report: TASK-TOKENAUDIT-REPORT.md
- what: The 190 dictionary rows of template_tokens (template_id IS NULL) are read by nothing today — generate_document loops only template-scoped rows; they exist purely for the not-yet-built picker.
- where: template_tokens WHERE template_id IS NULL (190 rows)
- quote: "The **190 dictionary rows (`template_id IS NULL`) are read by nothing today** — they exist purely for the picker."

### INVENTORY
- report: TASK-TOKENAUDIT-REPORT.md
- what: 46 DEFINED-BUT-UNUSED tokens no body references (PARTY.* ×7, FHE.* ×7, REQ.* ×4 + 8 ENG intake, 7 order-form fee tokens, and assorted DOC/ORD/ENG/HORSE/CLIENT/ORG singles) — none deleted; picker exit is the owner's call.
- where: template_tokens (46 rows; full list in report §3)
- quote: "None deleted; all have honest notes. Which ones exit the picker is the owner's call."

### INVENTORY
- report: TASK-TOKENAUDIT-REPORT.md
- what: 24 tokens appear only in INACTIVE flat template bodies (HORSE_LEASE / HORSE_PURCHASE_SALE / HORSE_SALE_TRANSFER / RELEASE_HORSE_EXERCISE leftovers) — harmless while those templates stay off.
- where: contract_templates (inactive bodies), template_tokens
- quote: "HORSE_LEASE / HORSE_PURCHASE_SALE / HORSE_SALE_TRANSFER / RELEASE_HORSE_EXERCISE leftovers. Harmless while those templates stay off."

### INVENTORY
- report: TASK-TOKENAUDIT-REPORT.md
- what: MINOR_RIDER — an active flat template body (5,481 bytes) from which no document has ever been generated, with zero scoped token rows; the dictionary doc says it was retired.
- where: contract_templates (template_key MINOR_RIDER), docs/TOKEN_DICTIONARY.md line 192
- quote: "No document has ever been generated from it ... and `docs/TOKEN_DICTIONARY.md` line 192 says it was **retired** — the table disagrees with the doc."

---

# Totals

- ITEM entries: 124
- INVENTORY entries: 24
