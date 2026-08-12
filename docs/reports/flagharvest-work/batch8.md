# FLAGHARVEST batch 8

Files: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md, TASK-A13-REPORT.md, TASK-A16-REPORT.md, TASK-DASHLEADS-REPORT.md, TASK-LEASEGATE-PHASE1.md, TASK-LEASESET-REPORT.md, TASK-NAVMOTION-REPORT.md, TASK-ONEMENU-REPORT.md, TASK-PAGEFRAME-REPORT.md, TASK-PARTYRLS-REPORT.md, TASK-UPLOADS-REPORT.md, TASK-WALLRETURN-REPORT.md

---

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: REQ-25 (documents-page management functions — filters, sorting, multi-select/delete, "send" wording, void status filter) was never started.
- quote: "REQ-25 (documents page) — no filters, no sorting, no multi-select/delete, 'create' still used where 'send' is meant, `void` missing from the status filter. Untouched."
- kind: blocked-on-owner
- artifacts: Documents page
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: REQ-26 (the deal-workflow inventory document the external UI-spec thread is blocked on) was requested twice and never produced — flagged as the largest outstanding item.
- quote: "REQ-26 (inventory document) — never produced, despite being requested twice and being the artifact the external UI-spec thread is blocked on. **This is the largest outstanding item.**"
- kind: blocked-on-owner
- artifacts: (inventory document, not created)
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: REQ-21 partial — the deal-record button exists only on the deal page, not on deals-list tiles or on party/horse records with contextual text.
- quote: "deal-record button is only on the deal page. Not on deals-list tiles, not on party accounts ('Sale of Beau on [date]'), not on horse records ('Ownership Transfer of Beau on [date]')."
- kind: blocked-on-owner
- artifacts: src/pages/app/ops/DealsPage.tsx, src/pages/app/ops/DealPage.tsx, HorsePage.tsx
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: The sworn affidavit (which absorbed the notary requirement) has no content, no template, and no home for the notary block; deferred by owner.
- quote: "Sworn affidavit: no content, no template, notary block has nowhere to live yet."
- kind: blocked-on-owner
- artifacts: (affidavit template, not created)
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: The checked-out branch is named `work/ui-design` but tracks and pushes to `origin/main`, so the next session inherits a misleading branch name.
- quote: "**Branch is `work/ui-design`, not `main`.** It tracks `origin/main` and all pushes went there, so `main` is correct — but the next session inherits a branch whose name implies otherwise."
- kind: process
- artifacts: branch work/ui-design
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Two owner out-of-band commits (1fd6339, d1bbcb9) touch ClauseDocument.tsx and add two migrations whose applied state the assistant never verified.
- quote: "Two owner commits (`1fd6339`, `d1bbcb9`) touch `ClauseDocument.tsx` and add 2 migrations never verified as applied"
- kind: not-verified
- artifacts: src/components/app/ClauseDocument.tsx, 20260803010000_fold_location_into_horse.sql, 20260803010001_horse_location_multiline.sql
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: One live lease document (215bac09, DOC-VWRU4KUN93) was created after the last cleanup and is only presumed to be owner testing.
- quote: "**One live lease document exists** (`215bac09-9f66-43ce-8655-85fd05fea1e2`, DOC-VWRU4KUN93, created 02:11 Aug 4, `hello@fhequestrian.com`) — created after the last cleanup, presumed owner testing."
- kind: data-integrity
- artifacts: documents (215bac09-9f66-43ce-8655-85fd05fea1e2)
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: One audit_logs row of test residue from Stage-4 signature-withdrawal testing was left uncleaned in production.
- quote: "**Residue: 1 `audit_logs` row** from Stage-4 signature-withdrawal testing (`old_value->>'reason' = 'signature_withdrawn_by_party'`). Harmless but not real history."
- kind: data-integrity
- artifacts: audit_logs
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: The new deal status vocabulary is display-layer only; the DB still stores EXECUTED, and a real rename would touch ~38 DB functions and ~20 frontend files.
- quote: "**Status vocabulary is display-only.** DB still stores `EXECUTED`; the badge derives Created/Editable/Signed/Complete. A future real rename touches ~38 DB functions and ~20 frontend files."
- kind: inventory
- artifacts: documents.status, deal_status
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: deal_activity is composed at read time from other tables with no dedicated activity table, so anything not already logged elsewhere never appears in the log.
- quote: "**`deal_activity` is composed at read time** from documents, signatures and `contract_change_log` — no dedicated activity table. Anything not already logged does not appear."
- kind: caveat
- artifacts: deal_activity, contract_change_log
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: reopen_deal still exists in the DB but nothing in the UI calls it — dead API surface.
- quote: "**`reopen_deal` still exists in the DB** but nothing in the UI calls it (replaced by Edit routing). Dead-ish API surface."
- kind: inventory
- artifacts: reopen_deal
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: start_bill_of_sale_standalone has no UI caller and its distinct standalone behavior was never exercised end to end.
- quote: "**`start_bill_of_sale_standalone` has no UI caller** and its distinct behavior (`BOS_HAS_SALE_AGREEMENT=NO`, standalone ownership transfer) was never exercised end to end."
- kind: not-verified
- artifacts: start_bill_of_sale_standalone
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Deal creation auto-adds documents in the modal with no transaction spanning both calls — if addDealDocument fails after createDeal succeeds, an empty deal is left behind.
- quote: "If `addDealDocument` fails after `createDeal` succeeds, an empty deal is left behind — no transaction spans both."
- kind: defect
- artifacts: createDeal, addDealDocument, src/pages/app/ops/DealsPage.tsx
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: The .document-paper shared render class was applied to 5 surfaces but only two were checked, only via code, never in a browser.
- quote: "**The `.document-paper` class** was applied to 5 surfaces; only the ops viewer and contract page were checked, and only via code, never in a browser."
- kind: not-verified
- artifacts: src/index.css (.document-paper), DocumentViewerPage.tsx, ContractPage.tsx, ClauseDocument.tsx
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: PGlite suites cover only 13 tests; the other ~54 test/db test files remain unrun (pre-existing condition).
- quote: "**PGlite suites cover 13 tests**; the other ~54 `test/db/*.test.ts` files remain unrun (pre-existing condition)."
- kind: known issue
- artifacts: test/db/*.test.ts
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Decision made without explicit sign-off — removing the co-buyer hand-entry path, deleting a capability explicitly requested in REQ-3.
- quote: "Removing the co-buyer hand-entry path (justified by L2a, but it deletes a capability explicitly requested in REQ-3)."
- kind: process
- artifacts: ContractPage.tsx co-buyer picker
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Decision made without explicit sign-off — auto-generating documents inside the deal-creation modal, inferred rather than stated.
- quote: "Auto-generating documents inside the creation modal (inferred from 'the container is never empty', not stated)."
- kind: process
- artifacts: DealsPage.tsx creation modal
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Decision made without explicit sign-off — dealLabel() fallback naming for untitled deals.
- quote: "`dealLabel()` fallback naming when a deal is untitled (`\"Sale — Beau\"`)."
- kind: process
- artifacts: src/lib/deals.ts (dealLabel)
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Decision made without explicit sign-off — voided documents are excluded from the deal record export.
- quote: "Excluding voided documents from the deal record export."
- kind: process
- artifacts: 20260803130001_deal_record_export.sql
- decision-mention: none

### ITEM
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Decision made without explicit sign-off — HORSE_SALE_V2 kept live rather than retired after the BOS became the primary instrument.
- quote: "Keeping `HORSE_SALE_V2` live rather than retiring it after the BOS became the primary instrument."
- kind: blocked-on-owner
- artifacts: contract_templates (HORSE_SALE_V2)
- decision-mention: none

### ITEM
- report: TASK-A13-REPORT.md
- date: 2026-08-04
- item: The CalendarPage lesson-horse picker is code-complete but never visually confirmed in a browser; tracker marked PARTIAL, not DONE.
- quote: "The `CalendarPage.tsx` picker change is code-complete and typecheck-clean but has not been visually confirmed in a browser. `docs/BUILD_TRACKER.md` A13 is marked **PARTIAL — server-verified, browser pending**"
- kind: not-verified
- artifacts: src/pages/app/CalendarPage.tsx, docs/BUILD_TRACKER.md
- decision-mention: none

### ITEM
- report: TASK-A13-REPORT.md
- date: 2026-08-04
- item: Pre-existing data noise on Beau — duplicate LESSEE horse_relationships rows for contact d5088607 with a dangling source_document_id — was deliberately left uncleaned, and that contact would incorrectly pass caller_may_use_horse.
- quote: "that one *does* carry an active `LESSEE` `horse_relationships` row on Beau and would incorrectly pass — deliberately avoided as the negative case"
- kind: data-integrity
- artifacts: horse_relationships, caller_may_use_horse, contact d5088607
- decision-mention: none

### ITEM
- report: TASK-A13-REPORT.md
- date: 2026-08-04
- item: No positive-path proof was run for book_open_slot's new lesson-branch gate because the lessee contact has no lesson_credits row; skipped rather than manufacturing a credit row.
- quote: "A positive case for `book_open_slot` wasn't run: the lessee contact has no `lesson_credits` row, so it would only prove the horse-gate passes before failing later on `NO_CREDITS`"
- kind: not-verified
- artifacts: book_open_slot, lesson_credits
- decision-mention: none

### ITEM
- report: TASK-A16-REPORT.md
- date: 2026-08-04
- item: Judgment call flagged for the orchestrator — the pre-existing staff-only document_executed broadcast was removed and folded into the new party_signed call; a one-line revert restores two-rows-on-completion behavior if preferred.
- quote: "If the orchestrator would rather the old call be left untouched (accepting two staff rows on completion), that's a one-line revert — flagging here rather than assuming."
- kind: process
- artifacts: record_signature, notify_staff, 20260805030000_party_signed_notifications.sql
- decision-mention: none

### ITEM
- report: TASK-A16-REPORT.md
- date: 2026-08-04
- item: Open question, not built — kiosk releases (sign_release) raise no staff notification of any kind today; whether they should get a party_signed-style alert is left for the orchestrator.
- quote: "Open question: should a kiosk release/waiver signing raise the same `party_signed`-style staff alert? It currently raises none at all"
- kind: blocked-on-owner
- artifacts: sign_release, api/sign-release.ts
- decision-mention: none

### ITEM
- report: TASK-A16-REPORT.md
- date: 2026-08-04
- item: Characterization correction — record_signature already contained an undocumented completing-only staff broadcast the task doc's "Known context" did not mention; the A16 gap was real but narrower than a blank slate.
- quote: "This is a genuine, previously undocumented finding — the task doc's 'Known context' only mentions the execution *email* as separate/done and doesn't mention this in-app staff broadcast."
- kind: correction
- artifacts: record_signature, notify_staff
- decision-mention: none

### ITEM
- report: TASK-DASHLEADS-REPORT.md
- date: 2026-08-11
- item: Open question for the owner — should the unreachable /app/ops surface (InstructorHome/OpsDashboard) be retired ("hidden, not deleted") or reconnected as what staff see at /app/dashboard; the routing decision was deliberately not made.
- quote: "**Open question for the owner/orchestrator:** is `InstructorHome`/`OpsDashboard` (the `/app/ops` surface) meant to be retired ... or reconnected as what a trainer/admin sees at `/app/dashboard` ... I did not make it unasked."
- kind: blocked-on-owner
- artifacts: src/pages/app/InstructorHome.tsx, OpsDashboard, OpsHome, /app/ops, DashboardHome.tsx
- decision-mention: none

### ITEM
- report: TASK-DASHLEADS-REPORT.md
- date: 2026-08-11
- item: Browser render of the new dashboard leads band was not verified — no staff session available; correctness checked by reading only.
- quote: "**Browser render: NOT VERIFIED.** No staff session available in this worktree, per the task's own constraint."
- kind: not-verified
- artifacts: src/components/app/DashboardPanel.tsx, src/lib/ops/useOpenLeads.ts, src/pages/app/InstructorHome.tsx
- decision-mention: none

### ITEM
- report: TASK-DASHLEADS-REPORT.md
- date: 2026-08-11
- item: Correction to the task doc — the page it names as "Dashboard" (InstructorHome.tsx) is dead code from the owner's perspective; the load-bearing fix had to go in DashboardPanel.tsx instead.
- quote: "So the page the task doc names is currently dead code from the owner's perspective — he cannot click to it. Building leads into it alone would not have satisfied 'the owner opens the dashboard and sees leads.'"
- kind: correction
- artifacts: src/pages/app/InstructorHome.tsx, src/components/app/DashboardPanel.tsx
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: R3 already exists — the D3 branch of contract_lock_blockers enforces it today across all three insurance sections; the real question for the owner is whether it should be stricter.
- quote: "R3 is not new construction; the question is whether the owner wants it *stricter* than it already is."
- kind: blocked-on-owner
- artifacts: contract_lock_blockers
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: R4 as written makes the owner's live no-insurance client arrangement unexecutable and deletes the three risk-acceptance clauses; flagged as the rule to stop on before building anything.
- quote: "**Configurations that become unreachable after R4:** the no-insurance arrangement, in full. ... **yes, the owner's live client configuration stops being expressible.** Not degraded — unexecutable."
- kind: blocked-on-owner
- artifacts: TXN.GL_NOT_REQUIRED, TXN.MORT_NOT_REQUIRED, TXN.MED_NOT_REQUIRED, GL_NONE, MORT_NONE, MED_NONE
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: R1 and R2 self-contradict — forcing the Lessee's mortality/medical status to NONE opens the *_LESSEE_RESPONSIBLE checkboxes offering the exact undertaking R1/R2 declare ineligible, verified against the live gate evaluator.
- quote: "**R1 and R2 open the door they are meant to close.** ... offered a checkbox whose clause reads *'Lessee shall obtain and maintain, at Lessee's sole cost, mortality insurance on the Horse'* — the exact undertaking R1 declares them ineligible to make."
- kind: correctness
- artifacts: TXN.MORT_LESSEE_RESPONSIBLE, TXN.MED_LESSEE_RESPONSIBLE, clause_condition_met
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Phase 2's gates would land on HORSE_LEASE_STANDARD, but no document is on that template and start_lease_contract_v2 still defaults to HORSE_LEASE_V2 — the cutover is out of scope and unassumed, so gates would appear on no newly created lease.
- quote: "**So Phase 2's gates will not appear on any lease anyone creates until that default is flipped.** That cutover is not in this task's scope and I have not assumed it happened."
- kind: caveat
- artifacts: start_lease_contract_v2, HORSE_LEASE_STANDARD, HORSE_LEASE_V2
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: The D3 execution-blocker predicate is duplicated verbatim in contract_lock_blockers and insurance_resolution_sync; any change must land in both or the blocker and the notification disagree.
- quote: "**Two predicates, not one.** The D3 logic is duplicated verbatim in `contract_lock_blockers` and `insurance_resolution_sync`. Any change to it must land in both"
- kind: landmine
- artifacts: contract_lock_blockers, insurance_resolution_sync
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Silent-drop landmine — sync_contract_fields_from_defs enumerates columns explicitly on INSERT and UPDATE, so a new column (e.g. ineligible_when) not added there is silently dropped with no error; seed_cascade_fields and start_lease_contract_v2 need the same treatment.
- quote: "`sync_contract_fields_from_defs` **enumerates columns explicitly** on both its `INSERT` and its `UPDATE` — a new column not added there is silently dropped, with no error."
- kind: landmine
- artifacts: sync_contract_fields_from_defs, seed_cascade_fields, start_lease_contract_v2, contract_fields, contract_field_defs
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Nothing in the sketched mechanism forces the ineligible value — set_contract_field has no gate awareness and an empty ineligible required field blocks the lock; where the forced value is stored from is an unsettled Phase 2 design decision.
- quote: "**Nothing forces the value.** `set_contract_field` has no gate awareness at all ... The value must actually be stored. Where from — the UI on load, a trigger, or the starter — is a Phase 2 design decision the task does not settle."
- kind: blocked-on-owner
- artifacts: set_contract_field, contract_lock_blockers
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: The ClauseDocument.tsx renderToken diff for the "Not Eligible" affordance was reported, not applied — the file is frozen; the diff was never compiled or run.
- quote: "## `ClauseDocument.tsx` — the render does need it. Diff reported, not applied."
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx, src/lib/contracts.ts, ExplainTip
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: ContractCascade.tsx would need the same ineligible-field treatment for form-side parity, and that design was not done.
- quote: "`ContractCascade.tsx` (the form-side view, also not frozen) has its own insurance awareness at `insuranceUnresolved` and would need the same treatment for parity; I have not designed that"
- kind: deferred
- artifacts: ContractCascade.tsx
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Open question Q1 — what replaces the waiver: "both parties NONE" does not reproduce today's behavior; the *_NONE clauses are load-bearing and are lost under R4-as-written; needs owner resolution before R1/R2 are built.
- quote: "**'Both parties select NONE' does not reproduce today's behaviour, and the checkbox is not redundant.** ... under R4-as-written they are lost."
- kind: blocked-on-owner
- artifacts: TXN.*_NOT_REQUIRED fields, contract_lock_blockers, insurance_resolution_sync
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Open question Q2 — whether R4 applies to all three sections or only GL cannot be inferred and needs the owner before anything is removed.
- quote: "**Cannot be inferred — needs the owner.** ... an asymmetry someone should choose deliberately rather than inherit. **Confirm before removing anything.**"
- kind: blocked-on-owner
- artifacts: TXN.GL_NOT_REQUIRED, TXN.MORT_NOT_REQUIRED, TXN.MED_NOT_REQUIRED
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Open question Q3 — three options for enforcing R3 laid out (leave the D3 blocker, ineligible_when on the Lessor's field, drop NONE from options) with trade-offs; no pick made; today's blocker is clearable by a promise (GL_LESSEE_RESPONSIBLE=YES) rather than a policy.
- quote: "Also clearable by a *promise* (`GL_LESSEE_RESPONSIBLE`), not a policy"
- kind: blocked-on-owner
- artifacts: contract_lock_blockers, TXN.GL_LESSOR_STATUS, TXN.GL_LESSEE_RESPONSIBLE
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Open question Q4 — a forced NONE prints as a choice the Lessee made ("Does not have and will not obtain"); the vocabulary has no word for "cannot", and whether that document text is acceptable is an owner call.
- quote: "'Not Eligible' is a **form** affordance; the **document** will still read as a choice the Lessee made. Whether that is acceptable is an owner call — the vocabulary genuinely has no word for 'cannot'"
- kind: blocked-on-owner
- artifacts: token_display_value, TXN.MORT_LESSEE_STATUS, TXN.MED_LESSEE_STATUS
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: On a partial lease with an uncovered Lessor, forcing NONE silently drops the deductible sentence and triggers an execution block plus an "Insurance responsibility unresolved" notification to both parties.
- quote: "On a partial lease with an uncovered Lessor, R1 causes an execution block and an 'Insurance responsibility unresolved' notification to both parties."
- kind: correctness
- artifacts: MORT_DEDR_SIMPLE, MED_DEDR_SIMPLE, insurance_resolution_sync
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Assumed, not checked — that the owner's live client on the no-insurance arrangement is on a paper or pre-V2 lease; no document in the database matches the S4 configuration.
- quote: "that the owner's 'live client on exactly that arrangement' is on a **paper or pre-V2** lease. No document in the database is in the S4 configuration"
- kind: not-verified
- artifacts: documents (ecaecd42)
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Inferred rather than observed — the forced-NONE render, the sufficiency of the reported diff, and the silent column-drop behavior were read from code, never run.
- quote: "no lease has ever had a current-generation insurance field filled, so I have not seen it render."
- kind: not-verified
- artifacts: token_display_value, ClauseDocument.tsx, sync_contract_fields_from_defs
- decision-mention: none

### ITEM
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Work deliberately stopped for owner review — Q1, Q2 and Q3 gate Phase 2; R1/R2 cannot be built safely until Q1 is answered.
- quote: "**Stopping here for owner review**, as the task requires. ... R1 and R2 cannot be built safely until Q1 is answered, because their failure mode on an uncovered Lessor is currently absorbed by the waiver R4 removes."
- kind: blocked-on-owner
- artifacts: HORSE_LEASE_STANDARD
- decision-mention: none

### ITEM
- report: TASK-LEASESET-REPORT.md
- date: 2026-08-11
- item: The NewContractPage lease-version picker change (Default option removed, HORSE_LEASE_V2 pre-selected) was not verified in a browser — no staff session available.
- quote: "per the task's own instruction I have **not** verified it in a browser (no staff session available) — reported as **NOT VERIFIED** below, exactly as instructed."
- kind: not-verified
- artifacts: src/pages/app/ops/NewContractPage.tsx, listLeaseTemplates
- decision-mention: none

### ITEM
- report: TASK-LEASESET-REPORT.md
- date: 2026-08-11
- item: HORSE_LEASE_SIMPLE and HORSE_LEASE_FULL were deliberately left active as byte-identical copies per explicit owner ruling.
- quote: "**Did not deactivate `HORSE_LEASE_SIMPLE` or `HORSE_LEASE_FULL`.** The owner explicitly ruled three byte-identical active copies is the correct state until he modifies one."
- kind: blocked-on-owner
- artifacts: contract_templates (HORSE_LEASE_SIMPLE, HORSE_LEASE_FULL)
- decision-mention: D10

### ITEM
- report: TASK-LEASESET-REPORT.md
- date: 2026-08-11
- item: Branch task/leaseset (one migration commit plus report) is local only, deliberately not pushed.
- quote: "**Did not push.** Branch `task/leaseset` has one migration commit plus this report, local only."
- kind: process
- artifacts: branch task/leaseset, 20260811T1800_leaseset_standard_simple_detailed_archive.sql
- decision-mention: D10

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: ContractSubheader.tsx:261 carries the same underline-flicker defect (copied from NAV_ROW_IDLE) — found in the sweep but not fixed, outside this task's file ownership; one-token fix.
- quote: "**`ContractSubheader.tsx:261`** carries the §A flicker — it copied `NAV_ROW_IDLE`'s declaration and inherited the bug. Outside this task's file ownership. One-token fix."
- kind: defect
- artifacts: src/components/app/ContractSubheader.tsx
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: The gold underline rule measures 2.66:1 against the panel, under the 3:1 non-text contrast floor — pre-existing from UIO-013's hover and now also the selected indicator; decoration-gold-800 (5.58:1) is the one-token alternative, deliberately not taken.
- quote: "**The gold rule measures 2.66:1** against the panel — pre-existing from UIO-013's hover, now also the selected indicator. `decoration-gold-800` (5.58:1) is the one-token alternative; not taken"
- kind: cosmetic
- artifacts: src/components/app/AppLayout.tsx (NAV_ROW_ACTIVE)
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: In the collapsed 56px staff rail the selected state is icon tone alone — the underline has no text to sit under; flagged as the one surface where the removed fill was doing irreplaceable work.
- quote: "**The collapsed 56px rail's selected state is icon tone only** — the underline has no text to sit under there."
- kind: cosmetic
- artifacts: src/components/app/AppLayout.tsx (collapsed staff rail)
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: UIO-006's open-state fill question remains open — the caret rotates but the avatar fill ramp was left untouched for the owner to see rendered.
- quote: "**UIO-006's open-state question is still open.** The caret rotates; the fill ramp is untouched, exactly as that file asks."
- kind: blocked-on-owner
- artifacts: docs/ui-orders/UIO-006, src/components/app/AppHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: Everything visual is NOT VERIFIED — no staff browser session existed, no animation was watched; a 13-item owner checklist covers what must be confirmed on screen.
- quote: "No staff browser session exists and none was used. **No animation was watched.** ... **These are not:** how any of it looks or moves on a real screen."
- kind: not-verified
- artifacts: AppLayout.tsx, AppHeader.tsx, app-header.css
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: The optional growing-underline animation (§A) was not built — it requires background-image gradients on every nav label span across nine row components; reported per the order's instruction.
- quote: "**Not built, and reported per the order's instruction.** It cannot be done with `text-decoration`; it needs a `background-image` linear-gradient with a `background-size` transition"
- kind: deferred
- artifacts: AppLayout.tsx nav row components
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: Deviation — the order's named branch point 3d6663b was five commits stale (one later commit was the task's own amendments); branched off current origin/main instead. Not pushed.
- quote: "Branching at the named SHA would have built the superseded bounce. Branched off current `origin/main` instead. Not pushed."
- kind: deviation
- artifacts: branch task/navmotion
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: Correction — CLAUDE.md's stated "~26" lint-warning baseline is stale; the measured baseline on origin/main is 36.
- quote: "36 warnings, 0 errors — **identical to the count on `origin/main`, measured, so this change adds none** (CLAUDE.md's '~26' is stale)"
- kind: correction
- artifacts: CLAUDE.md
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: The landscape header tier is the tightest clearance (7px above the 42px marks); if it reads cramped the sanctioned fix is raising that tier's height, not shrinking the mark.
- quote: "**The landscape tier is the tight one and the order named it.** ... **If it reads cramped, the sanctioned fix is to raise that one tier's height, not to shrink the mark back.**"
- kind: caveat
- artifacts: app-header.css (--cs-hdr-h landscape tier)
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: The one-time "Click for menu" tip uses localStorage (per-device) rather than a server column; if it should survive a cleared browser the swap is markTourSeen's shape plus one column — a DB change outside this task.
- quote: "**If you want it to survive a cleared browser, the swap is `markTourSeen`'s shape and one column.**"
- kind: caveat
- artifacts: src/components/app/AppHeader.tsx, localStorage navMenuTip.seen, profiles.tour_seen_mobile_at
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: UIO-016 is superseded on exactly two points (row px-3 and mobile-drawer prohibitions overridden) — recorded so a later thread does not revert the asymmetric inset citing that order.
- quote: "**Recorded here so a later thread does not revert this citing that order:**"
- kind: process
- artifacts: docs/ui-orders/UIO-016-nav-row-indent.md, AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: Accepted cost recorded — with the drawer moved left, top-left links become a longer thumb reach from the avatar on a large phone; the mechanism to revert is one class.
- quote: "**The accepted cost, recorded in the code so it is not rediscovered as a surprise:** on a large phone the links are a reach across from the avatar."
- kind: caveat
- artifacts: AppLayout.tsx mobile drawer
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Nothing was verified on a real device or in the real running app with real authentication — no Supabase credentials in any worktree; verification was via a throwaway Vite harness with mocked data.
- quote: "**Nothing was verified on a real device or in the real running app with real authentication** — this environment has no Supabase credentials"
- kind: not-verified
- artifacts: AppLayout.tsx, CardstockHeader.tsx, header-cardstock.css
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Sign out's iOS safe-area handling (the owner's explicit ask) still needs a real notched phone; the code-level mitigation is in place but unproven.
- quote: "**Sign out's iOS safe-area handling** (owner's explicit ask). ... exactly the kind of thing that can look right in every harness and still be wrong on an actual notched phone."
- kind: not-verified
- artifacts: NavFooter (AppLayout.tsx)
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: The drawer layered over real page content at 390px unscrolled was never screenshotted — named as the one item most wanting a real screenshot before calling this done.
- quote: "not screenshotted inside the real app ... it's the one item I'd most want a real screenshot of before calling this fully done."
- kind: not-verified
- artifacts: AppLayout.tsx mobile drawer, cs-drawer-tab
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Superadmin's live chrome was not re-verified — the isSuperAdmin conditionals restoring original drawer behavior were checked by code trace only, no superadmin credentials.
- quote: "**Superadmin's live chrome**, to confirm the `isSuperAdmin` conditionals actually produce byte-identical behavior to before, not just correct-looking code."
- kind: not-verified
- artifacts: AppLayout.tsx (isSuperAdmin branches), accountMenu
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Drawer-tab touch-target size (B1 hit-slop, ≥44px) was reasoned by box math, never measured with an actual touch simulator or touchscreen.
- quote: "Not tested with an actual touch simulator, but the box math clears the 44×44 guideline on the previously-short width axis."
- kind: not-verified
- artifacts: header-cardstock.css (.cs-drawer-tab::before)
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Follow-up owed — ClientNavItems' Stable link still points at /app/account?section=stable; ACCOUNTSURFACE must ping this thread once /app/stable ships so the one-line repoint can be made.
- quote: "**ACCOUNTSURFACE needs to ping this thread once `/app/stable` ships** — repointing is a one-line change at that point ... but it wasn't safe to do blind."
- kind: follow-up
- artifacts: AppLayout.tsx (ClientNavItems PresenceLink), /app/stable
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Judgment call flagged — B4's neutral scrim color (bg-black/40) and B5's mobile top padding were applied unconditionally including superadmin's surfaces, reasoned as shared-component fixes rather than tenant branding.
- quote: "Applied unconditionally, including superadmin's drawer ... flagged as a judgment call, not silently assumed"
- kind: process
- artifacts: AppLayout.tsx (scrim, <main> padding)
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Sign out was verified by code trace only, not a live click.
- quote: "Verified by code trace, not a live click — see 'Not verified' below. ⚠️"
- kind: not-verified
- artifacts: NavFooter, handleSignOut
- decision-mention: none

### ITEM
- report: TASK-PAGEFRAME-REPORT.md
- date: 2026-08-11
- item: Correction — the task table's "current cap" and "+ controls" columns were wrong for most of the 9 pages (numbers grepped from nested modals/sub-components, not page wrappers); every page was re-verified against actual JSX before conversion.
- quote: "**the task's 'current cap' and '+ controls' columns were wrong for most of the 9 pages.** Not close — wrong page-level facts."
- kind: correction
- artifacts: DealsPage.tsx, Admin.tsx, NewContractPage.tsx, ContractPage.tsx, DealPage.tsx, LookupReviewPage.tsx
- decision-mention: none

### ITEM
- report: TASK-PAGEFRAME-REPORT.md
- date: 2026-08-11
- item: Width judgment flagged for owner veto — four pages' real max-w-5xl caps were rounded up to `wide` (6xl) since PageLayout has no exact bucket.
- quote: "flagging it here for the owner to veto if `wide` reads as too roomy on any of the four once seen live."
- kind: blocked-on-owner
- artifacts: DealsPage.tsx, ContactsPage.tsx, NewContractPage.tsx, DealPage.tsx, PageLayout
- decision-mention: none

### ITEM
- report: TASK-PAGEFRAME-REPORT.md
- date: 2026-08-11
- item: ContractPage.tsx was deliberately left unconverted — forcing PageLayout on it would reintroduce a previously-fixed width bug and its per-document header doesn't fit PageHeader's contract; unifying it is a real design call for the owner.
- quote: "If the owner wants this page unified with the other eight regardless, that's a real design call — what would the gold eyebrow even say for a per-document page? — worth its own short conversation rather than a guess baked into this pass."
- kind: blocked-on-owner
- artifacts: src/pages/app/ContractPage.tsx, ContractSubheader, PageLayout, PageHeader
- decision-mention: none

### ITEM
- report: TASK-PAGEFRAME-REPORT.md
- date: 2026-08-11
- item: No authenticated browser click-through or cross-page screenshot was done — the task's verification ask (screenshot all nine, confirm rendered aria-labels) is unmet; no browser automation or credentials available.
- quote: "**No authenticated browser click-through, and no cross-page screenshot.** The task's verification section asks to screenshot all nine together and confirm every `+`'s rendered `aria-label`."
- kind: not-verified
- artifacts: 8 converted pages, PageHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-PAGEFRAME-REPORT.md
- date: 2026-08-11
- item: Correction — the task's stated lint baseline of 30 was stale; a clean origin/main worktree already shows 36 warnings (drift from ONEAUTHOR/DOCQUEUE/UPLOADS merges).
- quote: "The task's stated baseline was 30; I built a throwaway worktree of clean `origin/main` (pre-pageframe) to check, and 36 is already the baseline there"
- kind: correction
- artifacts: lint baseline
- decision-mention: none

### ITEM
- report: TASK-PARTYRLS-REPORT.md
- date: 2026-08-06
- item: Found and NOT fixed — signatures_select gates on caller_owns_document (strict document ownership), so a signer party who isn't the document owner cannot see their own signature row; listMySignableDocuments' signed flag reads false for that party (structural for every lease's LESSOR); needs its own scoped task because the helper also backs a write path.
- quote: "**`signatures_select` / `caller_owns_document`** — §4 above. A signer party who isn't `documents.contact_id`'s owner can't see their own signature row ... it needs its own scoped task."
- kind: defect
- artifacts: signatures_select, caller_owns_document, signatures_insert_self, listMySignableDocuments
- decision-mention: none

### ITEM
- report: TASK-PARTYRLS-REPORT.md
- date: 2026-08-06
- item: Correction — the task's diagnosis that document_deliveries had "the same class of gap" was wrong; it has carried a party-read OR-arm since the original migration and no change was made.
- quote: "**`document_deliveries` got no migration.** The task's diagnosis assumed it had 'the same class of gap.' Live verification ... shows it does not"
- kind: correction
- artifacts: document_deliveries, document_deliveries_select
- decision-mention: none

### ITEM
- report: TASK-PARTYRLS-REPORT.md
- date: 2026-08-06
- item: The browser click-through/PDF/download visual check remains for the owner — no browser session could be opened.
- quote: "**The browser click-through/PDF/download visual check itself remains for the owner.**"
- kind: not-verified
- artifacts: listMySignableDocuments, Documents page
- decision-mention: none

### ITEM
- report: TASK-PARTYRLS-REPORT.md
- date: 2026-08-06
- item: Assumed, not verified — that the frontend renders signed:false rather than throwing when a document has no matching signatures row for the caller; read but not click-tested.
- quote: "Assumed, not verified: that the frontend renders `signed: false` rather than throwing when a document has no matching `signatures` row for the caller"
- kind: not-verified
- artifacts: AccountPanels.tsx, Documents.tsx
- decision-mention: none

### ITEM
- report: TASK-PARTYRLS-REPORT.md
- date: 2026-08-06
- item: A second live party session for the shared lease could not be tested end-to-end — the LESSEE contact has no profiles row (no login); cross-contact isolation stood in for it.
- quote: "The LESSEE contact has no `profiles` row (no login), so a second live party session for that specific document wasn't available to test end-to-end"
- kind: not-verified
- artifacts: document_parties_self_read, contact 352c3898
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: purge_account does not know about files, so purging a member leaves their files with a dangling owner_contact_id — needs an owner ruling on where a departing member's files go.
- quote: "`purge_account` does not know about `files`, so purging a member today leaves their files with a dangling `owner_contact_id`. **Needs a ruling**"
- kind: blocked-on-owner
- artifacts: purge_account, files
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: removeMyFile() hard-deletes the storage bytes and tombstones the row; if the owner wants recoverable removal instead it is a one-line change plus a retention policy — flagged as an open ruling.
- quote: "**Member 'remove' deletes the bytes, tombstones the row.** ... If the owner wants recoverable removal instead, it is a one-line change (drop the `storage.remove` call) plus a retention policy."
- kind: blocked-on-owner
- artifacts: removeMyFile (src/lib/files.ts), files
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Cross-member reads are not built — a Coggins on a horse is not readable by the horse's owner if a different member uploaded it; needs a files SELECT policy arm using client_can_read_horse plus a matching storage arm, before the horse-record UI.
- quote: "**Cross-member reads are not built.** A file is readable by its owner and by staff. The horse-record case above is the first surface that needs more"
- kind: not-built
- artifacts: files SELECT policies, client_can_read_horse, storage.objects policies
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Members cannot create file_links — only staff can surface a file on another record; member-initiated surfacing needs a per-subject permission check that does not exist yet.
- quote: "**Members cannot create `file_links`.** Only staff can surface a file on another record ... Member-initiated surfacing needs a per-subject permission check that does not exist yet."
- kind: not-built
- artifacts: file_links, file_links_owner_unlink
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: storage_admin_all is now org-gated but still not path-scoped — a second tenant's admin could read tenant #1's objects in buckets whose path grammar does not start with an org id; not live single-tenant, but the next fix in that file and larger than one condition.
- quote: "**`storage_admin_all` is now org-gated but still not path-scoped.** A second tenant's admin could read tenant #1's objects in buckets whose path grammar does not start with an org id (`contracts`, `generated-documents`, `reports`, `profile-images`, `temporary-uploads`)."
- kind: security
- artifacts: storage_admin_all, storage.objects
- decision-mention: D1a

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Staff have no personal Files surface — My Files sits inside the !isStaff block per the 2026-08-08 owner ruling; flagged in case it reads as a gap.
- quote: "**Staff have no personal Files surface.** ... That matches the ruling; flagging in case it reads as a gap."
- kind: caveat
- artifacts: src/components/app/FilesContent.tsx, Account page
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: content_resources.storage_path is now redundant with file_id — both are written and the storage policy still reads storage_path; collapsing to file_id alone is a later cleanup.
- quote: "**`content_resources.storage_path` is now redundant with `file_id`.** Both are written, and the storage policy reads `storage_path`. Nothing was deleted."
- kind: follow-up
- artifacts: content_resources.storage_path, content_resources.file_id
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: The browser upload path is NOT VERIFIED — no staff browser session; the supabase-js round trip (multipart PUT, MIME sniffing, signed-URL fetch) is unproven; owner checklist provided.
- quote: "**The browser upload path is NOT VERIFIED.** ... What is unproven is the round trip through `supabase-js` — the multipart PUT, the MIME sniffing, and the signed-URL fetch."
- kind: not-verified
- artifacts: src/lib/files.ts, FilesContent.tsx, ContentStorePage
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Correction — two task-doc claims were inaccurate: ContentStorePage IS in the nav (AppLayout.tsx:324), and it is the content_blocks editor, not the content_resources editor.
- quote: "**'`ContentStorePage` … is not in the nav.'** It is — [AppLayout.tsx:324] ... **`ContentStorePage` is not the `content_resources` editor.** It edits `content_blocks`"
- kind: correction
- artifacts: ContentStorePage, AppLayout.tsx, content_blocks, content_resources
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: None of the nine consuming surfaces (deal, contract, horse, stable, lessons, offerings, leads, directory, community resources) were built, per the task's instruction to report rather than half-wire; each has a listed layout/permission question.
- quote: "Everything below is a `file_links` row and a list component; **none of it was built**, per the task's instruction to report rather than half-wire six surfaces."
- kind: not-built
- artifacts: DealPage.tsx, ContractPage.tsx, HorsePage.tsx, Stable.tsx, MyLessons.tsx, CatalogPage.tsx, ContactsPage.tsx, communityFeed.ts
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: The lessons surface's subject grain (package vs session vs credit) is genuinely unclear and must be picked before any file_links rows are written — repointing later is a data migration.
- quote: "The subject grain is genuinely unclear: a lesson *package*, a *session*, or a *credit*. Pick one before writing rows — repointing them later is a data migration."
- kind: blocked-on-owner
- artifacts: file_links (subject_type lesson), lesson_credits, fulfillment_units
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: File ownership for leads needs an owner ruling — a lead is a contacts row with no account, so a file owned by that contact is readable by nobody as "theirs".
- quote: "Owner is either the org or the contact-without-account — **needs an owner ruling**; the schema allows `owner_contact_id` on a contact with no profile, but nobody can then read it as 'theirs'."
- kind: blocked-on-owner
- artifacts: file_links (subject_type lead), contacts, files.owner_contact_id
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Directory-card files are almost certainly org-owned (e.g. a farrier's insurance certificate the stable holds) — confirm before building.
- quote: "Files here are almost certainly org-owned (a farrier's insurance certificate the *stable* holds). Confirm before building."
- kind: blocked-on-owner
- artifacts: vendors, DirectoryPage
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: The Community → Resources card has no download control, so members still cannot open a published company guide from the UI — the smallest remaining item and the one completing the company-files loop.
- quote: "the card has **no download control**. Members cannot yet open a published company guide from the UI. Smallest item on this list and the one that completes the company-files loop."
- kind: not-built
- artifacts: src/lib/communityFeed.ts:211, resourceDownloadUrl, content_resources
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: The rest of npm run test:db fails identically on origin/main — the PGlite snapshot references the retired engagements table and a service-catalog label drifted; pre-existing and untouched.
- quote: "The rest of `npm run test:db` fails **identically on `origin/main`** — the snapshot references the retired `engagements` table and a service-catalog label has drifted. Pre-existing, unrelated, and not touched here."
- kind: known issue
- artifacts: test/db, test/db/fixtures/schema_snapshot.sql, engagements
- decision-mention: none

### ITEM
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Correction — CLAUDE.md's "~26 pre-existing warnings" note is stale; origin/main's actual lint baseline is 36.
- quote: "lint **0 errors, 36 warnings — identical to `origin/main`'s 36**, so this branch adds none (CLAUDE.md's '~26 pre-existing warnings' is stale)"
- kind: correction
- artifacts: CLAUDE.md
- decision-mention: none

### ITEM
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Pixel-level rendering in a real browser was assumed, not verified — jsdom/React Testing Library only, no browser session in the environment.
- quote: "**Assumed, not verified:** pixel-level rendering in a real browser — no browser session is available in this environment"
- kind: not-verified
- artifacts: AppLayout.tsx, Onboarding.tsx, wallReturn.ts
- decision-mention: none

### ITEM
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Assumed by reading, not fuzzing — that enterApp() is the only place onboarding ever navigates the member away.
- quote: "Also assumed: that `enterApp()` is genuinely the *only* place onboarding ever navigates the member away without going through it — checked by reading every `navigate(` call site ... not by exhaustively fuzzing every UI path."
- kind: not-verified
- artifacts: src/pages/app/Onboarding.tsx (enterApp)
- decision-mention: none

### ITEM
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Judgment call flagged — the return fires on enterApp() (all onboarding requirements done) rather than the instant the wall clears, deliberately trading literal wording for not yanking a member away mid-flow.
- quote: "Flagging this trade-off explicitly since it's a judgment call, not a re-derivation of the task's wording."
- kind: process
- artifacts: enterApp, my_wall_state, consumeWallReturnDestination
- decision-mention: none

### ITEM
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Aside, not fixed — 60 of 64 test/db files already fail on unmodified origin/main, dominated by fixtures still provisioning through provision_lesson_invitation which queries the removed offering_tiers table.
- quote: "found 60 of 64 files already failing on unmodified `origin/main`, independent of this task — the dominant cause is `offering_tiers` no longer existing"
- kind: known issue
- artifacts: test/db, provision_lesson_invitation, offering_tiers, rider_onboarding.test.ts, minor_onboarding.test.ts, esign_hardening.test.ts
- decision-mention: none

### ITEM
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Aside, not fixed — the PGlite snapshot's SNAPSHOT_DATA_TABLES allowlist doesn't seed status_events_vocab or document_status, so any fresh test creating a documents row hits two FK violations; worked around locally, not fixed at the shared-fixture source.
- quote: "the PGlite snapshot's data allowlist (`SNAPSHOT_DATA_TABLES` in `harness.ts`) doesn't seed `status_events_vocab` or `document_status` ... worked around inside `wallreturn_wall_state.test.ts`'s own `beforeAll`, not touched at the shared-fixture source."
- kind: known issue
- artifacts: test/db/harness.ts (SNAPSHOT_DATA_TABLES), status_events_vocab, document_status
- decision-mention: none

### ITEM
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Two related out-of-scope defects named by the task doc — contracts has no party-read policy and document_party_controls has RLS enabled with zero policies — were not touched; re-reported with nothing new to add.
- quote: "The two related-but-out-of-scope defects the task doc names (`contracts` has no party-read policy; `document_party_controls` has RLS with zero policies) were not touched"
- kind: defect
- artifacts: contracts RLS, document_party_controls RLS
- decision-mention: none

### ITEM
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: One pre-existing skipped UI test file (clause_ownership_affordance.test.tsx requires npm run build:client first) was not attempted — unrelated to this task.
- quote: "5 skipped (one file, `clause_ownership_affordance.test.tsx`, requires `npm run build:client` to have run first; pre-existing, unrelated to this task, not attempted)"
- kind: known issue
- artifacts: test/ui/clause_ownership_affordance.test.tsx
- decision-mention: none

---

## Unviewed inventory

### INVENTORY
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- what: reopen_deal RPC exists in the live DB with no UI caller (replaced by Edit routing).
- where: public.reopen_deal
- quote: "**`reopen_deal` still exists in the DB** but nothing in the UI calls it (replaced by Edit routing). Dead-ish API surface."

### INVENTORY
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- what: start_bill_of_sale_standalone RPC has no UI caller and its distinct behavior has never been exercised.
- where: public.start_bill_of_sale_standalone
- quote: "**`start_bill_of_sale_standalone` has no UI caller** and its distinct behavior (`BOS_HAS_SALE_AGREEMENT=NO`, standalone ownership transfer) was never exercised end to end."

### INVENTORY
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- what: Two flat sale templates retired — inactive and soft-deleted.
- where: contract_templates rows HORSE_PURCHASE_SALE, HORSE_SALE_TRANSFER
- quote: "HORSE_PURCHASE_SALE inactive + soft-deleted / HORSE_SALE_TRANSFER inactive + soft-deleted"

### INVENTORY
- report: TASK-DASHLEADS-REPORT.md
- what: OpsHome, InstructorHome and OpsDashboard at /app/ops are unreachable from any in-app control — no link, Navigate, or navigate() call targets /app/ops.
- where: src/pages/app/InstructorHome.tsx, OpsDashboard, OpsHome, route /app/ops (App.tsx)
- quote: "`OpsHome`, `InstructorHome`, and `OpsDashboard` are not reachable from any in-app control today."

### INVENTORY
- report: TASK-DASHLEADS-REPORT.md
- what: IntakePage's nav entry was already removed (commit cefaad7); the /app/ops/intake route still builds and is reachable only via links from the new dashboard entries.
- where: src/pages/app/ops/IntakePage.tsx, route /app/ops/intake
- quote: "Its nav entry was already removed (commit `cefaad7`, UIBUILD); the route still builds and is exactly where the new dashboard entries link out to"

### INVENTORY
- report: TASK-LEASEGATE-PHASE1.md
- what: HORSE_LEASE_STANDARD carries zero documents — all four lease documents sit on HORSE_LEASE_V2; the template is a byte-identical unused fork.
- where: contract_templates row HORSE_LEASE_STANDARD
- quote: "**No document is on STANDARD.** All four lease documents sit on `HORSE_LEASE_V2`"

### INVENTORY
- report: TASK-LEASESET-REPORT.md
- what: HORSE_LEASE_STANDARD deactivated with its 163 clause rows retained intact; must not receive content updates.
- where: contract_templates row HORSE_LEASE_STANDARD
- quote: "`HORSE_LEASE_STANDARD` is deactivated (163 clause rows intact)"

### INVENTORY
- report: TASK-LEASESET-REPORT.md
- what: HORSE_LEASE retained as a never-activate historical reference (18,253-char flat body), recorded in the migration comment and HORSE_LEASE.md.
- where: contract_templates row HORSE_LEASE, supabase/contract_templates/HORSE_LEASE.md
- quote: "`HORSE_LEASE` is retained as historical reference / resurrectable wording and is never to be activated or used to generate a document."

### INVENTORY
- report: TASK-ONEMENU-REPORT.md
- what: PRESENCE_LINKS, MenuLink and the accountMenu are dead-for-tenant — read only by the preserved avatar dropdown that solely superadmin's header still renders, and the presence branch never actually renders even for superadmin (presence always empty for staff).
- where: src/components/app/AppLayout.tsx (PRESENCE_LINKS, MenuLink, accountMenu, menuOpen, menuRef)
- quote: "`PRESENCE_LINKS` and `MenuLink` are untouched (old labels, old styling) — they're now exclusively read by the preserved `accountMenu`, which only superadmin's header still renders. Left as dead-for-tenant"

### INVENTORY
- report: TASK-PAGEFRAME-REPORT.md
- what: The retired ContactsPage export is a dead route that still compiles, backed by the same ContactDirectory component as the live DirectoryPage/LeadsPage.
- where: src/pages/app/ops/ContactsPage.tsx (ContactsPage export)
- quote: "the retired `ContactsPage` export (dead route, still compiles)"

### INVENTORY
- report: TASK-PARTYRLS-REPORT.md
- what: The document_deliveries party-read policy arm is currently unexercised — no party-facing caller of document_deliveries exists in src/ yet (reserved for the planned stamp-trail feature).
- where: src/lib/api.ts:1132 (listDeliveries), document_deliveries_select
- quote: "No party-facing caller of `document_deliveries` exists in `src/` yet (it's for the planned stamp-trail feature per the task doc) — so the fact that the policy already supports it is currently unexercised, not moot."

### INVENTORY
- report: TASK-UPLOADS-REPORT.md
- what: file_links subject_type values `purchase` and `booking` exist in the CHECK but were not requested and have no consuming surface.
- where: file_links.subject_type CHECK (purchase, booking)
- quote: "Not requested by the owner; the `subject_type` values exist so a receipt or a coggins-for-a-booking has somewhere to go without a migration."

### INVENTORY
- report: TASK-UPLOADS-REPORT.md
- what: The Community → Resources card lists content_resources and now has a working resourceDownloadUrl(), but exposes no download control — the published-guide download path is unreachable from the UI.
- where: src/lib/communityFeed.ts:211, src/lib/community.ts (resourceDownloadUrl)
- quote: "the card has **no download control**. Members cannot yet open a published company guide from the UI."
