# FLAGHARVEST batch6 — extraction output

## TASK-A-PARTY-VERIFY-REPORT.md

### ITEM
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: Party-controls bootstrap bug: start_lease_contract_v2 / start_sale_contract never insert into document_party_controls, so no invite UI ever renders for a freshly authored contract, blocking A2/A3/A4.
- quote: "start_lease_contract_v2 (and start_sale_contract, checked as a sibling — same gap) never inserts into document_party_controls. ... a freshly created contract has zero rows in that table, so the only UI that could ever create the first row never renders."
- kind: defect
- artifacts: start_lease_contract_v2, start_sale_contract, document_party_controls, ContractPage.tsx, contract_document_detail
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: Multi-party document visibility bug: documents_select RLS and my_documents() check only documents.contact_id, so a real signer whose contact_id differs cannot see their own signed docs; 5 executed prod documents affected.
- quote: "Five currently-EXECUTED production documents have at least one real signer whose contact_id differs from documents.contact_id — those signers likely cannot see their own signed documents in their account today."
- kind: data-integrity
- artifacts: my_documents(), documents_select, caller_owns_document, document_parties, caller_is_document_party
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: A18 (self-send copy) and A19 (download/print signed PDF) were never reachable, so EmailMeACopyButton and the download button are unverified, not confirmed working.
- quote: "EmailMeACopyButton and 'Download signed PDF' themselves were not exercised (never reachable), so their own correctness is unverified, not confirmed-broken."
- kind: not-verified
- artifacts: EmailMeACopyButton, my_documents()
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: LESSEE (a company party) is structurally unverifiable — no login can ever equal the company's contact_id, and hello@fhequestrian.com is also a staff/admin login that bypasses party gating.
- quote: "no individual login, fresh or existing, can ever satisfy document_parties.contact_id = profiles.contact_id for this party ... No 'view as party' mechanism exists"
- kind: blocked-on-owner
- artifacts: redeem_contract_invitation, document_parties, profiles.contact_id, contract_document_detail
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: Recommended new capability (owner-directed) — an admin-only "view-as"/impersonation lens to preview the true party-restricted UI; not built here.
- quote: "the owner proposed the correct direction: an admin-only 'view-as'/impersonation lens ... Not built here — it's a new capability spanning RLS/RPC/client, outside this task's fix policy."
- kind: blocked-on-owner
- artifacts: RLS, RPC, client (ContractPage.tsx)
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: Orders page in Account has a back button that routes to the Community feed instead of back to Account; not investigated or fixed.
- quote: "the Orders page in Account has a back button that routes to the Community feed instead of back to Account. Unrelated to this task's items; not investigated or fixed."
- kind: defect
- artifacts: Orders page, Account
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: Author's own first-pass error — looked in the wrong table (contracts, not documents) and incorrectly reported the reference document as missing; logged as a visible correction.
- quote: "My first pass looked in the wrong table (contracts, not documents) and incorrectly reported the document as missing — the owner corrected this; logged so the error is visible, not silently absorbed."
- kind: correctness
- artifacts: contracts, documents
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: A7/A17/A18/A19 for LESSEE were declared BLOCKED on code-level proof alone — no browser click was spent confirming empirically.
- quote: "No click was spent confirming this empirically for A17-19 once the code-level proof was clear for A7 ... so a browser attempt would fail for the identical, already-proven reason."
- kind: not-verified
- artifacts: ContractPage
- decision-mention: none

---

## TASK-ACCOUNTSURFACE-PHASE1.md

### ITEM
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: DocumentsPanel is functionally behind Documents.tsx — no signing, no email-me-a-copy, no pending/assigned visibility, no supersede history; a member who only opens the Account page cannot sign or see docs awaiting generation.
- quote: "a member who only ever opens the Account page cannot sign anything and cannot see documents awaiting generation. It predates this task"
- kind: defect
- artifacts: DocumentsPanel, AccountPanels.tsx, Documents.tsx, SelfSignRow, EmailMeACopyButton, my_documents, listMySignableDocuments
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: Profile-label question presented but not decided — whether "Profile & preferences" becomes "My Profile & Preferences" or stays exempt.
- quote: "I'm not picking one — flagging it back per the task's own instruction ('Ask; do not decide')."
- kind: blocked-on-owner
- artifacts: AccountHub.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: Account page's "My lessons" row has no lessonsOn gate — it always renders even when the lessons module is off, promising a destination that only shows the lock screen.
- quote: "the Account page's 'My lessons' row (AccountHub.tsx:211) has no lessonsOn gate at all ... currently promises a destination that just shows the module's lock screen ... flagging it here since it's adjacent, not fixing it."
- kind: defect
- artifacts: AccountHub.tsx, AppLayout.tsx, MyLessons.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: MyLessons and Documents each need an explicit Phase 2 design decision before expanding inline (three network calls / reconciliation height); flagged rather than silently decided.
- quote: "I'd flag both as needing one explicit Phase 2 design call each ... rather than silently deciding it during the build."
- kind: blocked-on-owner
- artifacts: MyLessons.tsx, Documents.tsx, DocumentsPanel, SessionNotesView, ReportCard
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: Nav rail labels are internally inconsistent — Stable link labeled "Stable" in one surface and "My Stable" in another; lessons destination labeled "Lessons" with no "My" prefix, colliding with the public /lessons route.
- quote: "Two different labels for one destination, in two different nav surfaces, today ... The in-app rail calling the personal one just 'Lessons' is the exact collision pattern the 'My' rule exists to prevent"
- kind: cosmetic
- artifacts: AppLayout.tsx (PRESENCE_LINKS, ClientNavItems, RailLink), App.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: My Lessons document title and on-screen eyebrow disagree in casing ("My Lessons" vs lowercase "My lessons").
- quote: "Document title (useDocumentTitle('My Lessons')) and the page's own on-screen eyebrow ... already disagree in casing with each other too — another small pre-existing inconsistency"
- kind: cosmetic
- artifacts: MyLessons.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: Orders' list item navigates to /order/:id outside /app — noted so it isn't discovered as a surprise in Phase 2 (Orders won't be fully click-free even when expanded in place).
- quote: "'Orders expands in place' doesn't make the whole subject click-free — noting it so it isn't discovered as a surprise in Phase 2 review."
- kind: process
- artifacts: Orders.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: Task doc cites AppLayout.tsx line numbers :139/:504 but the actual call sites are :140/:505 — a one-line drift from unrelated edits.
- quote: "The task doc cites :139/:504 — a one-line drift from small unrelated edits since the doc was written; same two call sites, no third found"
- kind: correctness
- artifacts: AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: The runtime behavior of my_documents / listMySignableDocuments RPCs was assumed from client-side types, not traced end-to-end server-side; the extraction cost estimates are read-time judgments, not rehearsed.
- quote: "Assumed, not traced end-to-end: the actual runtime behavior of my_documents / listMySignableDocuments RPCs server-side (I read the client-side types/usage, not the SQL)"
- kind: not-verified
- artifacts: my_documents, listMySignableDocuments
- decision-mention: none

---

## TASK-ADDITEM-REPORT.md

### ITEM
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: Owner ruling needed — should structural authoring be allowed during in_review? As shipped the owner cannot use Add item on either live lease (both in_review) without reopening for editing; fix is widening five RPCs.
- quote: "Should structural authoring be allowed during in_review? — owner ruling needed. ... as shipped, the owner cannot exercise Add item on either of them"
- kind: blocked-on-owner
- artifacts: add_contract_composition, remove_contract_composition, add_contract_element, propose_clause, set_field_included, ContractPage.tsx
- decision-mention: D14

### ITEM
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: anon holds EXECUTE on add_contract_composition, remove_contract_composition and add_contract_element (last also grants PUBLIC); pre-existing, not exploitable, reported rather than changed as SECFIX territory.
- quote: "anon holds EXECUTE on add_contract_composition, remove_contract_composition and add_contract_element; the last also still grants PUBLIC. ... Reported rather than changed, because revoking grants is a security-surface decision"
- kind: security
- artifacts: add_contract_composition, remove_contract_composition, add_contract_element
- decision-mention: none

### ITEM
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: remove_contract_composition on an element leaves a dangling {{CUSTOM.…}} token in the prose; the UI deliberately does not offer element removal for this reason.
- quote: "Deleting an element row leaves {{CUSTOM.NAME_3}} in the prose of any line that placed it, which then composes as the literal token (or N/A after execution)."
- kind: defect
- artifacts: remove_contract_composition
- decision-mention: none

### ITEM
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: A line whose only token is unanswered composes as a bare sentence with a full stop ("Off-site transport is arranged by."); pre-existing behaviour of remerge_contract_from_clauses.
- quote: "A line whose only token is unanswered composes as a bare sentence with a full stop — 'Off-site transport is arranged by.'. Pre-existing behaviour of remerge_contract_from_clauses"
- kind: defect
- artifacts: remerge_contract_from_clauses
- decision-mention: none

### ITEM
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: The Add-item draft is per browser (localStorage keyed by document id), not per account — two staff on the same document keep independent drafts; a shared server-side draft is a separate spec.
- quote: "The draft is per browser, not per account. ... it is not a shared server-side draft, and if the owner wants one that is a separate spec."
- kind: blocked-on-owner
- artifacts: AddElementModal.tsx, localStorage
- decision-mention: none

### ITEM
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: One pre-existing UI test fails on origin/main and still fails — wallreturn_applayout "defaults to the destination menu"; not mine, not touched.
- quote: "One pre-existing UI test fails on origin/main and still fails — test/ui/wallreturn_applayout.test.tsx, 'defaults to the destination menu'. Not mine, not touched."
- kind: known-issue
- artifacts: test/ui/wallreturn_applayout.test.tsx
- decision-mention: none

### ITEM
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: NOT VERIFIED — every interaction/geometric claim; no staff browser session, jsdom has no layout engine, so all interaction claims rest on the style contract.
- quote: "NOT VERIFIED — every interaction claim. There is no staff browser session and I was not given one. jsdom has no layout engine, so anything geometric is asserted on the style contract"
- kind: not-verified
- artifacts: AddElementModal.tsx
- decision-mention: none

### ITEM
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: npm run test:db is nondeterministic on this machine (three runs gave 20, 25, 6 failures); pre-existing and unrelated.
- quote: "npm run test:db is nondeterministic on this machine: three consecutive runs of the identical tree gave 20, 25 and 6 failures. ... The suite's variance is pre-existing and unrelated."
- kind: known-issue
- artifacts: test:db
- decision-mention: none

### ITEM
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: Headline finding — no composition has ever landed in production; contract_fields holds zero author-added rows before and after.
- quote: "Not one authored item, of any kind, has ever been saved."
- kind: data-integrity
- artifacts: contract_fields, add_contract_composition
- decision-mention: none

### ITEM
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: lint baseline drifted — 39 warnings vs CLAUDE.md's "~26"; identical count before and after the diff.
- quote: "0 errors, 39 warnings, identical count before and after the diff (the repo's baseline has drifted from CLAUDE.md's '~26')."
- kind: process
- artifacts: eslint baseline
- decision-mention: none

---

## TASK-COSIGN-REPORT.md

### ITEM
- report: TASK-COSIGN-REPORT.md
- date: 2026-08-05 (approx; no explicit header date)
- item: The pre-existing "sign on a party's behalf" UI has silently offered a broken always-erroring button for individual parties since 2026-08-03; flagged in case any staff hit the error, no evidence found but no systematic log search performed.
- quote: "has silently offered a broken (always-erroring) button for individual parties since 2026-08-03 ... no evidence found that anyone did ... though no systematic log search was performed"
- kind: defect
- artifacts: ContractPage.tsx, record_signature, lock_and_sign_contract
- decision-mention: none

### ITEM
- report: TASK-COSIGN-REPORT.md
- date: 2026-08-05
- item: No browser click-through — nobody opened ContractPage as CJ against a locked company-party document and clicked "Sign as French Heritage Equestrian"; marked PARTIAL.
- quote: "No browser click-through. Every proof above is psql against production with a simulated session ... nobody has opened ContractPage in a real browser"
- kind: not-verified
- artifacts: ContractPage.tsx
- decision-mention: none

### ITEM
- report: TASK-COSIGN-REPORT.md
- date: 2026-08-05
- item: No production document currently sits in locked state, so there was no live already-locked document to visually confirm the box against; a throwaway rolled-back document was used.
- quote: "No production document currently sits in locked state ... so there was no live, already-locked document to visually confirm the box against"
- kind: not-verified
- artifacts: documents, workflow_state
- decision-mention: none

### ITEM
- report: TASK-COSIGN-REPORT.md
- date: 2026-08-05
- item: Sarah's real document cannot be advanced to locked as part of this task (read-only hard rule) — its trace is reasoned from live RPC output, not a rendered screenshot.
- quote: "Sarah's real document cannot be advanced to locked as part of this task (it's read-only by hard rule) — its trace above is reasoned from the live RPC output, not a rendered screenshot."
- kind: not-verified
- artifacts: document 704c8d2d, contract_document_detail
- decision-mention: none

---

## TASK-F3-REPORT.md

### ITEM
- report: TASK-F3-REPORT.md
- date: (no header date; status CODE-COMPLETE, BROWSER PENDING)
- item: Browser verification pending — a rider account has not clicked through the actual SessionNotesView UI; verified only by type/lint checks and a rolled-back RPC proof.
- quote: "Browser verification is pending — not done in this session (no browser available in this environment). ... a rider account has not yet clicked through the actual UI."
- kind: not-verified
- artifacts: SessionNotesView.tsx, CalendarPage.tsx, MyLessons.tsx
- decision-mention: none

### ITEM
- report: TASK-F3-REPORT.md
- date: (no header date)
- item: Optimistic append after submit mirrors ReportCard's pattern including its limitation of no invented id/created_at.
- quote: "Optimistic append after successful submit, mirroring ReportCard's pattern (including its limitation of no invented id/created_at)."
- kind: caveat
- artifacts: SessionNotesView.tsx, ReportCard
- decision-mention: none

### ITEM
- report: TASK-F3-REPORT.md
- date: (no header date)
- item: F4/F5 tracker rows' stale "no UI" framing corrected to cite the existing staff compose in LessonLogEditor.tsx:104; status left BUILT per instruction.
- quote: "F4/F5 rows' stale 'no UI' framing corrected to cite the existing staff compose in LessonLogEditor.tsx:104 ... only the factual note changed"
- kind: correctness
- artifacts: docs/BUILD_TRACKER.md, LessonLogEditor.tsx
- decision-mention: none

---

## TASK-FACILITYTERM-REPORT.md

### ITEM
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date; branch off origin/main)
- item: The barnops module family (route, files, nav item, mod.barnops module key) was deferred — not renamed this pass because AppLayout.tsx is owned by UIBUILD which is actively committing to it.
- quote: "DEFERRED — the barnops module family ... Not built this pass. AppLayout.tsx is owned by TASK-ONEHEADER's successor, UIBUILD, which is actively committing to it right now"
- kind: blocked-on-owner
- artifacts: AppLayout.tsx, App.tsx, BarnopsHubPage.tsx, api-barnops.ts, mod.barnops, org_modules
- decision-mention: none

### ITEM
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: Open owner question — confirm mod.barnops is renamed in production org_modules rows or kept as a stable internal key forever.
- quote: "barnops module rename: confirm the plan above once AppLayout.tsx is free, including whether mod.barnops gets renamed in production org_modules rows or kept as a stable internal key forever"
- kind: blocked-on-owner
- artifacts: mod.barnops, org_modules
- decision-mention: none

### ITEM
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: Open owner question — confirm FHE's term = ranch (used the owner's own sentence as source; flagged to confirm, not assume).
- quote: "Confirm FHE = ranch (used the owner's own sentence as the source; flagging per the task doc's request to confirm, not assume)."
- kind: blocked-on-owner
- artifacts: property_terms, config_values
- decision-mention: none

### ITEM
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: About.tsx's "The Facility" eyebrow label sits next to FHE's chosen word "ranch" — same collision risk the owner ruled on; left as-is, flagged for possible follow-up.
- quote: "About.tsx's 'The Facility' eyebrow ... doesn't contain the word 'barn' so it was outside the literal 160-mention scope, but it's the same collision risk ... Left as-is"
- kind: cosmetic
- artifacts: About.tsx
- decision-mention: none

### ITEM
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: seed.ts's FEED_VIEW_META.all.description already says "around the stables" — a pre-existing, unrelated inconsistency (not "barn," not in grep scope).
- quote: "seed.ts's FEED_VIEW_META.all.description already says 'around the stables' — a pre-existing, unrelated inconsistency"
- kind: cosmetic
- artifacts: seed.ts (FEED_VIEW_META)
- decision-mention: none

### ITEM
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: Comments-only "barn" mentions across several api/ and component files left untouched as low-value churn.
- quote: "Comments only, left untouched (not user-facing, low value to churn): api.ts, api-barnops.ts, api-lessons.ts, api-calendar.ts, ContractPage.tsx ..."
- kind: cosmetic
- artifacts: api.ts, api-barnops.ts, api-lessons.ts, api-calendar.ts, ContractPage.tsx, CalendarItemPanel.tsx, PublicIntakeForm.tsx
- decision-mention: none

### ITEM
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: test/db PGlite harness is independently broken today (snapshot fixture violates products_module_key_fkey; full replay hits a break at 20260728010000_release_family_signer_side.sql) — verified this migration by replaying up to the checkpoint instead.
- quote: "both the checked-in snapshot and a full fresh-migration replay are independently broken today for reasons unrelated to this task"
- kind: known-issue
- artifacts: test/db, schema_snapshot, 20260728010000_release_family_signer_side.sql
- decision-mention: none

---

## TASK-HORSEINTAKE-REPORT.md

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date; off origin/main 7cfeb6)
- item: Codebase-wide error-shape defect — 78 call sites test e instanceof Error against errors that may be raw PostgREST objects; DbError/errorText exported for adoption but only three owned files were changed.
- quote: "This defect is codebase-wide, not ours alone. 78 call sites test e instanceof Error against errors that may be raw PostgREST objects."
- kind: defect
- artifacts: src/lib/horses.ts, DbError, errorText, postgrest-js
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Defect A (reported, not fixed) — a microchip of "N/A" hijacks the next owner's horse via server-side text match in create_horse_record; latent today but the N/A-save fix makes it reachable.
- quote: "a microchip of 'N/A' hijacks the next owner's horse. Proven. ... the fix above is what lets people save an N/A microchip in the first place, so this moves from latent to reachable. The client cannot fix it; the match is server-side."
- kind: data-integrity
- artifacts: create_horse_record, horse_reconciliation
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Defect B (reported, not fixed) — breed and colour cannot hold a typed-in value at all (FKs into horse_breeds/horse_colors); "Other (enter manually)" can only fail; owner call, DB change.
- quote: "breed and colour cannot hold a typed-in value at all ... The 'Other (enter manually)…' escape ... writes the typed text straight into the column, which can only ever fail. ... Owner call, DB change, outside this task."
- kind: defect
- artifacts: horses.breed, horses.color, horse_breeds, horse_colors, SelectOrOther, horse_field_token_value
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Consequence for the owner to see — on the six N/A-able columns 'N/A' is stored as NULL, so {{HORSE.*}} tokens (now incl. breed/colour) render blank on the vet authorization; clean fix is in the DB.
- quote: "On those six columns 'N/A' is stored as NULL, so the corresponding {{HORSE.*}} token renders blank on the vet authorization rather than 'N/A'."
- kind: data-integrity
- artifacts: HORSE_SENTINEL_UNSAFE_KEYS, {{HORSE.*}} tokens
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Step 3 N/A field colour BLOCKED — author did not pick a replacement for the tan (cream-100) disabled background; four verified options presented, awaiting owner choice.
- quote: "Step 3 — the N/A treatment (F4). BLOCKED, nothing changed. ... I did not pick a replacement. ... Say which and I will apply it — it is one class."
- kind: blocked-on-owner
- artifacts: HorseIntakeForm.tsx, disabled:bg-cream-100
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Euthanasia change (Step 5 gate) not made — the shape decision (stamp B silently vs fixed clause, and what happens to CLIENT.EUTHANASIA_INITIALS) is behind the gate awaiting owner.
- quote: "Stopped at the Step 5 gate — no euthanasia change was made. ... The euthanasia shape — (a) stamp B silently and drop the section, or (b) drop the field and state it as a fixed clause"
- kind: blocked-on-owner
- artifacts: euthanasia_authorization, CLIENT.EUTHANASIA_INITIALS
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: F7's second bug (reported, not fixed) — standing categories (groups) wiped at account activation; Claire is the only real person hit so far but nine more contacts hold a RIDER row with no account and would lose it on activation.
- quote: "F7's second bug — standing categories wiped at activation. Reported, not fixed. ... Nine contacts hold a RIDER row today with no account yet ... Each one loses it the moment they activate ... unless their documents are executed first."
- kind: data-integrity
- artifacts: groups, derive_affiliations, apply_affiliations, audit_logs
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Which of the six save failures Claire actually hit is unknown and not knowable from the database (failed INSERT leaves no row/audit); all six were fixed rather than guessed.
- quote: "Which one did Claire actually hit? Unknown, and not knowable from the database — a failed INSERT leaves no row and no audit entry"
- kind: not-verified
- artifacts: create_horse_record
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Nothing is browser-verified — the form was not rendered; every UI claim is about code and compiled CSS, not the screen.
- quote: "Nothing is browser-verified. I did not render this form. Every UI claim is a claim about the code and the compiled CSS, not about what the screen looks like."
- kind: not-verified
- artifacts: HorseIntakeForm.tsx
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: The staff-assigned path (owner_contact_id) was not tested against production, only the client path Claire used; the same scrub is claimed to cover both.
- quote: "I did not test the staff-assigned path (owner_contact_id) against production, only the client path Claire used; the same scrub covers both."
- kind: not-verified
- artifacts: staffUpdateHorse, create_horse_record
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Open owner question — new records only or existing too for the euthanasia change (all 3 horses on file already B, so nothing needs migrating either way, but confirm).
- quote: "New records only, or existing too? All 3 horses on file are already B, so nothing needs migrating either way — but confirm"
- kind: blocked-on-owner
- artifacts: euthanasia_authorization, horses
- decision-mention: none

### ITEM
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Did not change border-red-400 — F5 suggests it may be too quiet, but that is a colour decision belonging with the owner's question 2.
- quote: "I did not change border-red-400 — F5 suggests it may be too quiet, but that is a colour decision and belongs with question 2."
- kind: blocked-on-owner
- artifacts: HorseIntakeForm.tsx, border-red-400
- decision-mention: none

---

## TASK-LEASEFORK-REPORT.md

### ITEM
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Pre-existing dead gate in HORSE_LEASE_V2 (found and NOT fixed) — TXN.MONTHLY_START is gated on TXN.LEASE_FEE_TYPE which doesn't exist, so "First monthly payment date" can never appear; faithfully dead in all three forks.
- quote: "the field TXN.MONTHLY_START ('First monthly payment date') is gated on TXN.LEASE_FEE_TYPE, which does not exist in the template. ... This is a content defect and content is out of scope, so I did not touch it"
- kind: defect
- artifacts: HORSE_LEASE_V2, TXN.MONTHLY_START, TXN.LEASE_FEE_TYPE, contract_field_defs, clause_condition_met, clauseConditionMet
- decision-mention: none

### ITEM
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Security defect the author INTRODUCED in Phase 1 and later fixed — clone_contract_template was executable by unauthenticated (anon) callers via pg_default_acl and a NULL-auth.uid guard; live in prod for the task duration; unauthenticated caller could mint contract templates.
- quote: "a defect I introduced in Phase 1: clone_contract_template was executable by unauthenticated (anon) callers. ... An unauthenticated caller could mint contract templates. ... it was live in prod from the Phase 1 apply until this fix."
- kind: security
- artifacts: clone_contract_template, pg_default_acl
- decision-mention: none

### ITEM
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: The same REVOKE-FROM-public + auth.uid()-IS-NULL-trusted pattern is used elsewhere in the repo; any other SECURITY DEFINER function created that way has the same hole — NOT audited, flagged for a dedicated pass.
- quote: "Any other SECURITY DEFINER function created with a auth.uid() IS NULL ⇒ trusted guard has the same hole. I did not audit the rest of the database for that pattern"
- kind: security
- artifacts: SECURITY DEFINER functions (repo-wide)
- decision-mention: none

### ITEM
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Correction to ground truth — a seventh satellite table (template_tokens, keyed on template_id) exists that the task's six-table list omitted; zero rows for HORSE_LEASE_V2 so the fork's four-table scope still holds.
- quote: "Correction to the ground truth — a seventh satellite table exists. ... template_tokens, which keys on template_id (not template_key) and so would not surface in a template_key sweep"
- kind: correctness
- artifacts: template_tokens
- decision-mention: none

### ITEM
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Related observation, untouched — the retired HORSE_LEASE template still holds 98 orphan contract_field_defs rows with no sections and no clauses.
- quote: "the retired HORSE_LEASE template (§4a) still holds 98 orphan contract_field_defs rows with no sections and no clauses."
- kind: data-integrity
- artifacts: HORSE_LEASE, contract_field_defs
- decision-mention: none

### ITEM
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Open labelling question, deliberately not resolved — HORSE_LEASE_V2 and the retired HORSE_LEASE share the title "Horse Lease Agreement"; a picker listing by title is ambiguous, and renaming V2 is forbidden by the task.
- quote: "Open labelling question, deliberately not resolved. ... renaming it is explicitly forbidden by this task, so I left both paths visible rather than invent a convention."
- kind: blocked-on-owner
- artifacts: HORSE_LEASE_V2, HORSE_LEASE, NewContractPage.tsx picker
- decision-mention: none

### ITEM
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: The lease-version picker was not browser-clicked — data path, RPC and RLS read proven separately but nobody rendered the page.
- quote: "Not browser-clicked. ... I did not run the app and click through the picker. Calling that verified would be overclaiming."
- kind: not-verified
- artifacts: NewContractPage.tsx, listLeaseTemplates
- decision-mention: none

### ITEM
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: npm run build was NOT run for this task.
- quote: "npm run build was not run."
- kind: not-verified
- artifacts: build
- decision-mention: none

### ITEM
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Did not audit every DB function for the literal HORSE_LEASE_V2 — only start_lease_contract_v2, its single UI caller, and confirmed no other DB function calls that RPC.
- quote: "That no other code path keys off the literal HORSE_LEASE_V2 in a way the forks would need to satisfy. ... I did not audit every function in the database for the literal."
- kind: not-verified
- artifacts: start_lease_contract_v2
- decision-mention: none

### ITEM
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: The four cloned tables are verified sufficient for these forks today but not in general — a future source template carrying satellite rows would need more.
- quote: "That the four cloned tables are sufficient in general. Verified sufficient for these forks today ... A future source template carrying satellite rows would need more."
- kind: caveat
- artifacts: clone_contract_template
- decision-mention: none

---

## TASK-LEASESIMPLE-REPORT.md

### ITEM
- report: TASK-LEASESIMPLE-REPORT.md
- date: (no explicit header date; branch off origin/main 0635acb)
- item: No content decision made — the Keep/Cut column is blank on all 144 rows; the owner and Claire decide what a simple lease contains.
- quote: "No content decision has been made. The Keep / Cut column is blank on all 144 rows. ... The owner and Claire decide what a simple lease contains."
- kind: blocked-on-owner
- artifacts: WORKSHEET.md, HORSE_LEASE_SIMPLE
- decision-mention: none

### ITEM
- report: TASK-LEASESIMPLE-REPORT.md
- date: (no explicit header date)
- item: Found while reading (inherited from V2) — TXN.MONTHLY_START ("First monthly payment date") is already orphaned, attached to clause_key LEASE_FEE.PAYMENTS which does not exist in either template.
- quote: "TXN.MONTHLY_START ('First monthly payment date') is already orphaned. It is attached to clause_key = 'LEASE_FEE.PAYMENTS', a clause that does not exist in either template."
- kind: data-integrity
- artifacts: TXN.MONTHLY_START, LEASE_FEE.PAYMENTS, contract_field_defs
- decision-mention: none

### ITEM
- report: TASK-LEASESIMPLE-REPORT.md
- date: (no explicit header date)
- item: Found while reading (inherited from V2) — "FHE Approved Trainer" and "Approved Instructor" terms are used in §11.2/11.4/11.6/12.2 but never defined anywhere in the lease.
- quote: "'French Heritage Equestrian Approved Trainer' and 'Approved Instructor' are used but never defined. ... No clause anywhere in the lease says what approval means or who grants it."
- kind: correctness
- artifacts: HORSE_LEASE_SIMPLE clause bodies §11.2/11.4/11.6/12.2
- decision-mention: none

### ITEM
- report: TASK-LEASESIMPLE-REPORT.md
- date: (no explicit header date)
- item: Found while reading — where the Lessor arranges farrier/vet care, §12.5/§12.6 print "Farrier:"/"Veterinarian:"/"Practice:"/"Address:" labels with nothing after them (body tokens ungated while fields are gated).
- quote: "§12.5 and §12.6 print 'Farrier:', 'Veterinarian:', 'Practice:' and 'Address:' with nothing after them — those fields are gated to TXN.FARRIER_ARRANGE = LESSEE / TXN.VET_ARRANGE = LESSEE while the tokens in the body are ungated."
- kind: defect
- artifacts: HORSE_LEASE_SIMPLE §12.5/§12.6, TXN.FARRIER_ARRANGE, TXN.VET_ARRANGE
- decision-mention: none

### ITEM
- report: TASK-LEASESIMPLE-REPORT.md
- date: (no explicit header date)
- item: The protective/standalone classifications are hand-read judgments, not computed, and explicitly not legal advice; a clause wrongly marked standalone is the damaging failure mode.
- quote: "A clause wrongly marked standalone is the failure mode that causes real damage, because it will be cut on that basis. ... This is a flag to take to counsel, not legal advice. I am not a lawyer"
- kind: caveat
- artifacts: WORKSHEET.md protective/standalone columns
- decision-mention: none

---

## TASK-MOBILEPASS-REPORT.md

### ITEM
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08 (task doc date; report is later)
- item: B4 (admin nav sections collapsible on mobile) owner-deferred, do not build — deferred until after the admin page-structure/menu-contents refactor (TASK-ADMINSWEEP).
- quote: "Owner-deferred, do not build. ... 'DEFERRED until after the admin page-structure and menu-contents refactor' (TASK-ADMINSWEEP)."
- kind: blocked-on-owner
- artifacts: AppLayout.tsx, admin nav
- decision-mention: none

### ITEM
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08
- item: C2 (three material languages) not implemented, correctly — owner said LAST, everything else first; the premise partly changed since ONEHEADER; left for the owner.
- quote: "Not implemented, correctly. ... 'LAST. Everything else first.' ... Left for the owner; not attempted."
- kind: blocked-on-owner
- artifacts: header, nav, buttons
- decision-mention: none

### ITEM
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08
- item: F1/F2 (eight nav items share Shield icon) blocked upstream on the admin page refactor — proposed icon merges aren't implemented; nothing to build without unilaterally doing the admin refactor.
- quote: "Icon reassignment: blocked upstream, not a MOBILEPASS decision. ... most of the assignment 'cannot land until they exist.' Nothing to build here"
- kind: blocked-on-owner
- artifacts: nav icons, docs/reference/nav-icon-exercise.md
- decision-mention: none

### ITEM
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08
- item: F5 sign-out glyph-choice part blocked with A9/A10 — same admin-refactor sequencing as F1; not attempted.
- quote: "Glyph-choice part: blocked with A9/A10 per OPEN-CHANGE-REQUESTS, same admin-refactor sequencing as F1. Not attempted."
- kind: blocked-on-owner
- artifacts: sign-out glyph
- decision-mention: none

### ITEM
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08
- item: Could NOT verify the in-app header, nav rail, mobile drawer, hover states and scrim — all behind Supabase auth with no credentials in this worktree; "already shipped" claims rest on source/CSS/reconciliation-doc reads.
- quote: "What I could NOT verify, and did not claim to: the actual in-app header, nav rail, mobile drawer, hover states, and scrim ... not on a live click-through of the authenticated app, and not on a real phone."
- kind: not-verified
- artifacts: AppLayout.tsx, app-header.css
- decision-mention: none

### ITEM
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08
- item: lint warnings drifted to 36 (beyond UI-STATE's ~26 baseline) — none in edited/deleted files; two AppLayout.tsx warnings at :346/:353 are pre-existing.
- quote: "0 errors, 36 warnings (pre-existing drift beyond UI-STATE's 2026-08-09 baseline of ~26 — none of the 38 warning lines are in AppLayout.tsx's edited region"
- kind: process
- artifacts: eslint baseline, AppLayout.tsx
- decision-mention: none

---

## TASK-NULLUID-REPORT.md

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date; worktree off origin/main 8facc04)
- item: The single biggest remaining gap — anon-callable SECURITY DEFINER functions with NO identity check at all were NOT audited here; a different, probably larger bug family (TASK-SECFIX S3 was this).
- quote: "Anon-callable definers with no identity check at all. A different bug family, and probably the larger one ... Not audited here. This is the single biggest remaining gap."
- kind: security
- artifacts: SECURITY DEFINER functions (repo-wide)
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: NULL-propagating predicates taking arguments (caller_is_document_party(uuid), caller_owns_horse(uuid), is_platform_profile) were not evaluated for anon — same NOT-trap could apply.
- quote: "Predicates taking arguments (caller_is_document_party(uuid), caller_owns_horse(uuid), is_platform_profile(text,uuid)) were not evaluated ... If any returns NULL for anon, the same NOT … trap applies."
- kind: security
- artifacts: caller_is_document_party, caller_owns_horse, is_platform_profile
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: profiles_role_guard's auth.uid() IS NULL → RETURN NEW is the dangerous shape but a trigger not directly callable; left as-is and flagged as a latent hazard deserving its own task.
- quote: "profiles_role_guard's auth.uid() IS NULL → RETURN NEW — latent, deserves its own task. ... it is a latent hazard, not a live one, and changing a trigger on profiles deserves its own task."
- kind: security
- artifacts: profiles_role_guard, profiles
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: record_invitation_failure has no caller check at all and a NULL-uid lookup branch; low risk (token is the credential) but a token holder can burn an invitation and raise a staff notification; unchanged.
- quote: "It has no caller check at all, but it is reached from the unauthenticated invite flow by design and the token is the credential. ... worth knowing, not a NULL-uid hole. Unchanged."
- kind: security
- artifacts: record_invitation_failure
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: clone_contract_template uses the bare session_user IN (…) form and has the same PGlite property — not exploitable in prod but worth the same tightening (recommended follow-up for LEASEFORK).
- quote: "Note for TASK-LEASEFORK: clone_contract_template uses the bare session_user IN (…) form and has the same PGlite property — not exploitable in prod ... but worth the same tightening."
- kind: security
- artifacts: clone_contract_template
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Multi-line guards may have slipped through — line-level extraction; mitigated with whole-body regexes but did not read all 326 function bodies.
- quote: "Multi-line guards. Line-level extraction; a guard split across lines such that no single line holds both the predicate and the negation could slip through. I mitigated with whole-body regexes but did not read all 326 bodies."
- kind: not-verified
- artifacts: pg_proc function bodies
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Guards living in RLS policies were not fully audited for NULL logic — checked policies for negated use of the three predicates (none) but did not audit all 70 policies.
- quote: "Guards in RLS policies rather than function bodies. I checked policies for negated use of the three predicates (none) but did not audit all 70 for NULL logic."
- kind: not-verified
- artifacts: RLS policies
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: The authenticated threat model ("one signup away") was not addressed — several functions remain callable by any signed-up account fenced only by the guard; a separate worthwhile task.
- quote: "authenticated as the threat model. Everything here is about anon. Several of these functions remain callable by any signed-up account, fenced only by the guard. A pass with 'one signup away' as the attacker is a separate and worthwhile task."
- kind: security
- artifacts: SECURITY DEFINER functions
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: pg_default_acl still grants EXECUTE on every new public function to anon — until changed, this bug class regenerates itself with each new function; not changed (project-wide decision).
- quote: "pg_default_acl still grants EXECUTE on every new public function to anon. Until that default changes, this class regenerates itself with each new function. I did not change it — it is a project-wide decision"
- kind: security
- artifacts: pg_default_acl
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Proven live exploit (before fix) — platform_tenant_detail returned to an unauthenticated caller the full tenant record, per-table row counts, and every staff account's name, email and user id.
- quote: "An unauthenticated reader obtained the tenant record, per-table row counts, and every staff account's name, email address and user id."
- kind: security
- artifacts: platform_tenant_detail, platform_set_tenant_module, platform_set_tenant_status, inbound_open_count
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: test:db suite broken on main before this change — 55 of 64 files fail in beforeAll setup (duplicate key, products_module_key_fkey); pre-existing and means the suite protects nothing.
- quote: "npm run test:db is broken on main before this change — 55 of 64 files fail in beforeAll setup ... That is pre-existing and unrelated."
- kind: known-issue
- artifacts: test:db
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Deviation — author synced seven changed function bodies into test/db/fixtures/schema_snapshot.sql (repo convention is batch regeneration, not per-migration); made deliberately to exercise the real guard against the PGlite hazard.
- quote: "I also synced the seven changed bodies into test/db/fixtures/schema_snapshot.sql ... The repo's convention is batch regeneration, not per-migration, so this is a small deviation"
- kind: process
- artifacts: test/db/fixtures/schema_snapshot.sql
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Unrelated incident — six worktrees (main repo + five siblings) were moved to Trash at ~17:09 (likely iCloud sync); restored and verified, but the trigger is unexplained and may recur.
- quote: "the Desktop directory was emptied into ~/Library/Mobile Documents/.Trash ... no command in this session touched those paths. ... the trigger is unexplained and may recur."
- kind: process
- artifacts: worktrees (accountsurface, bp410, onemenu, secfix, tiptap)
- decision-mention: none

### ITEM
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Recommended follow-up — fix the test:db setup breakage on main (55/64 files failing means the suite is currently not protecting anything).
- quote: "Fix the test:db setup breakage on main — 55/64 files failing means this suite is currently not protecting anything."
- kind: process
- artifacts: test:db
- decision-mention: none

---

## TASK-ROSTER-REPORT.md

### ITEM
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: No live contact has consumed a horse-care service yet — the horse-owner row in the positional screenshot is a clearly-labeled synthetic demo row; no prod data fabricated.
- quote: "No live contact has consumed a horse-care service yet ... The horse-owner row in the positional screenshot is therefore a clearly-labeled synthetic demo row"
- kind: not-verified
- artifacts: RosterRow, roster_service_slots, bookings
- decision-mention: none

### ITEM
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: Screenshot produced through a temporary local harness (no staff credentials in this environment, same wall ACCOUNTSURFACE hit); an in-browser authenticated click-through is still owed.
- quote: "no staff credentials exist in this environment (same wall the ACCOUNTSURFACE thread hit). Harness deleted before commit; an in-browser authenticated click-through is still owed when the owner is logged in."
- kind: not-verified
- artifacts: Admin.tsx, admin_client_accounts, roster_service_slots
- decision-mention: none

### ITEM
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: is_admin() behavior verified by simulating the admin JWT in psql, not via a browser session.
- quote: "is_admin() behavior was verified by simulating the admin JWT (request.jwt.claims) in psql, not via a browser session."
- kind: not-verified
- artifacts: is_admin()
- decision-mention: none

### ITEM
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: Lead lifecycle context noted, not built — whatever converts a worked lead should set contact_type='CONTACT' or create the clients row/account through the provisioning spine; roster picks it up automatically.
- quote: "Lead lifecycle (context noted, not built) ... whatever flow does the conversion should set contact_type = 'CONTACT' ... no roster-side change is needed."
- kind: process
- artifacts: contact_type, clients, LeadsPage
- decision-mention: none

### ITEM
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: Slot-count scaling caveat — if the service-band slot count passes ~12 the band needs a design pass, not more columns; a service type with consumed history but no slot grows a trailing "Other" column.
- quote: "If the slot count ever passes ~12 the band needs a design pass, not more columns (noted in code)."
- kind: caveat
- artifacts: RosterRow, roster_service_slots
- decision-mention: none

### ITEM
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: The old Active-first sort key was dropped when porting sort verbatim from ContactsPage.
- quote: "The old Active-first sort key is gone with the port."
- kind: correctness
- artifacts: Admin.tsx, ContactsPage
- decision-mention: none

---

## TASK-SVCPURGE-REPORT.md

### ITEM
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: Follow-up (not actioned) — suggested_category_for_contact(uuid) still lists RIDER_LESSON / RIDER_LESSON_JUMPER in a now-dead IN branch; cosmetic, behavior unchanged, needs a live function-body rewrite so wants its own task.
- quote: "suggested_category_for_contact(uuid) still lists RIDER_LESSON / RIDER_LESSON_JUMPER in a dead IN branch. Cosmetic; behavior is unchanged. Requires a live function-body rewrite, so it wants its own task. Left in place."
- kind: correctness
- artifacts: suggested_category_for_contact, src/lib/admin.ts
- decision-mention: none

### ITEM
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: test/db/fixtures/schema_snapshot.sql has drifted from production (still holds the six deleted templates) and test:db is red on main independently of this work; not regenerated (out of scope).
- quote: "test/db/fixtures/schema_snapshot.sql has drifted from production (still holds the six templates), and test:db is red on main independently of this work."
- kind: known-issue
- artifacts: test/db/fixtures/schema_snapshot.sql, test:db
- decision-mention: none

### ITEM
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: MINOR_RIDER and HORSE_REPRESENTATION are body-less, retired-in-practice template rows still present in contract_templates; out of scope, noted since the inventory surfaced them.
- quote: "MINOR_RIDER and HORSE_REPRESENTATION are body-less, retired-in-practice template rows still present in contract_templates. Out of scope here — noting them"
- kind: inventory
- artifacts: MINOR_RIDER, HORSE_REPRESENTATION, contract_templates
- decision-mention: none

### ITEM
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: Judgment call / scope extension called out — deleted six template_variants rows keyed HORSE_EVALUATION (beyond the literal delete list); their contents preserved verbatim in a migration comment in case the call was wrong.
- quote: "This is the one place I went beyond the literal delete list ... Their exact contents are preserved verbatim in a comment block in the migration, so restoring them is a copy-paste if this call was wrong."
- kind: process
- artifacts: template_variants, generate_document
- decision-mention: none

### ITEM
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: The def-tables premise in the task doc was slightly off — the six are flat-body templates holding zero section/clause/field defs; the DELETEs reported DELETE 0 as expected.
- quote: "The def tables were already empty — the task doc's premise was slightly off. ... they reported DELETE 0, as expected. Nothing was missed — the rows simply never existed."
- kind: correctness
- artifacts: contract_section_defs, contract_clause_defs, contract_field_defs
- decision-mention: none

### ITEM
- report: TASK-SVCPURGE-REPORT.md
- date: 2026-08-06
- item: Assumed (not verified) — the owner's business ruling that the six contracts are not in use and will not be; verified the data consequence (zero documents) but not the business intent.
- quote: "The owner's ruling that these six contracts are not in use and will not be. I verified the data consequence of that ruling (zero documents ever generated); I did not and cannot verify the business intent behind it."
- kind: not-verified
- artifacts: contract_templates
- decision-mention: none

---

## INVENTORY

### INVENTORY
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- what: There is no shared PageHeader component anywhere in the codebase — every page hand-rolls its own eyebrow/h1 markup.
- where: (codebase-wide) — "the app's page header model" is a styling convention, not a component
- quote: "There is no shared PageHeader component anywhere in the codebase — every page hand-rolls its own eyebrow/h1 markup."

### INVENTORY
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- what: No /app/stable route exists yet — this task adds My Stable, which today has only an Account panel (StableSection) and no nav page.
- where: App.tsx route table; StableSection inline in AccountHub.tsx (lines 64-181)
- quote: "My Stable ... (none yet — this task adds it) ... App.tsx's route table showing no /app/stable route exists yet"

### INVENTORY
- report: TASK-MOBILEPASS-REPORT.md
- what: CardstockHeader.tsx and header-cardstock.css deleted — verified zero real imports, byte-identical to shelved backups; restore is two file copies away.
- where: src/components/.../CardstockHeader.tsx, header-cardstock.css; backups at docs/reference/shelved-cardstock-header/*.txt
- quote: "Deleted CardstockHeader.tsx and header-cardstock.css. Verified zero real imports ... Both files are byte-identical to the backups already at docs/reference/shelved-cardstock-header/*.txt"

### INVENTORY
- report: TASK-MOBILEPASS-REPORT.md
- what: The floating drawer tab no longer exists (deleted by ONEHEADER/A15); the header's avatar button is the only mobile nav control now.
- where: AppLayout.tsx:1490 ("THE DRAWER TAB IS GONE"); AppHeader.tsx
- quote: "The drawer tab doesn't exist — deleted entirely by ONEHEADER/A15 ('THE DRAWER TAB IS GONE,' comment at AppLayout.tsx:1490)."

### INVENTORY
- report: TASK-MOBILEPASS-REPORT.md
- what: No standalone "notification surface" component and no bell — notifications live on the Dashboard and surface only as a count badge on the nav link.
- where: AppLayout.tsx (NAV_BADGE); Dashboard page
- quote: "There is no standalone 'notification surface' component ... 'the notifications themselves live on the dashboard now — there is no bell'"

### INVENTORY
- report: TASK-ROSTER-REPORT.md
- what: ContactsPage retired behind CONTACTS_PAGE_RETIRED = true — nothing deleted; /app/ops/contacts redirects to /app/admin and the nav item is hidden. DirectoryPage and LeadsPage from the same file are NOT retired.
- where: ContactsPage.tsx (CONTACTS_PAGE_RETIRED flag), AppLayout.tsx nav, /app/ops/contacts route
- quote: "ContactsPage retired behind CONTACTS_PAGE_RETIRED = true ... nothing deleted; DirectoryPage and LeadsPage from the same file are NOT retired ... /app/ops/contacts redirects to /app/admin"

### INVENTORY
- report: TASK-SVCPURGE-REPORT.md
- what: Six service contract templates deleted from contract_templates (HORSE_TRAINING, HORSE_EXERCISE, HORSEMANSHIP_TRAINING, HORSE_EVALUATION, RIDER_LESSON, RIDER_LESSON_JUMPER) plus 87 template_tokens and 6 template_variants; the six .md files deleted from the repo.
- where: contract_templates; supabase/contract_templates/{HORSEMANSHIP_TRAINING,HORSE_EVALUATION,HORSE_EXERCISE,HORSE_TRAINING,RIDER_LESSON,RIDER_LESSON_JUMPER}.md
- quote: "Removed: HORSE_TRAINING, HORSE_EXERCISE, HORSEMANSHIP_TRAINING, HORSE_EVALUATION, RIDER_LESSON, RIDER_LESSON_JUMPER."

### INVENTORY
- report: TASK-SVCPURGE-REPORT.md
- what: MINOR_RIDER and HORSE_REPRESENTATION — body-less, retired-in-practice template rows still present (unused) in contract_templates.
- where: contract_templates rows MINOR_RIDER, HORSE_REPRESENTATION
- quote: "MINOR_RIDER and HORSE_REPRESENTATION are body-less, retired-in-practice template rows still present in contract_templates."

### INVENTORY
- report: TASK-LEASEFORK-REPORT.md
- what: HORSE_LEASE_STANDARD — a fork created with zero documents; later ruled a redundant fourth clone and deactivated per D10 (clause rows retained). Also HORSE_LEASE_FULL/HORSE_LEASE_SIMPLE forks exist byte-identical, unused by any document.
- where: contract_templates HORSE_LEASE_STANDARD / HORSE_LEASE_FULL / HORSE_LEASE_SIMPLE
- quote: "Documents pointing at any fork: 0."

### INVENTORY
- report: TASK-LEASEFORK-REPORT.md
- what: The retired flat HORSE_LEASE template (active=false, soft-deleted 2026-08-02) holds 98 orphan contract_field_defs rows with zero sections and zero clauses.
- where: contract_templates HORSE_LEASE; contract_field_defs
- quote: "the retired HORSE_LEASE template ... still holds 98 orphan contract_field_defs rows with no sections and no clauses."

### INVENTORY
- report: TASK-SVCPURGE-REPORT.md
- what: scripts/build-template-load-migration.mjs had one dead entry (POST_SEED_TEMPLATES.RIDER_LESSON) that would re-seed the purged row on a fresh DB — removed.
- where: scripts/build-template-load-migration.mjs
- quote: "POST_SEED_TEMPLATES.RIDER_LESSON emitted an INSERT INTO contract_templates ... leaving it would have re-seeded the purged row on any fresh database ... Removed"

### INVENTORY
- report: TASK-FACILITYTERM-REPORT.md
- what: seed.ts is otherwise dead in production (SEED_ENABLED = false; file marked "DELETE THIS FILE once the backing RPCs return real rows"); only FEED_VIEW_META renders unconditionally.
- where: src/.../seed.ts
- quote: "seed.ts is otherwise dead in production (SEED_ENABLED = false, file marked 'DELETE THIS FILE once the backing RPCs return real rows' in its own header)"

### INVENTORY
- report: TASK-A-PARTY-VERIFY-REPORT.md
- what: caller_is_document_party RPC already exists and is used correctly elsewhere (document_shares_party_read) but is NOT wired into documents_select / my_documents() — the fix would OR it in.
- where: caller_is_document_party, document_shares_party_read, documents_select, my_documents()
- quote: "add a document_parties-based OR-clause ... caller_is_document_party, which already exists and is used correctly elsewhere"
