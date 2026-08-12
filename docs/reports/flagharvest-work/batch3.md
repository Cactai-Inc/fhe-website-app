# FLAGHARVEST — batch 3 extraction

Assigned files: TASK-CHECKBOXTIP-REPORT.md, TASK-FRAMESCROLL-REPORT.md, TASK-I-REPORT.md, TASK-INBOUNDALERT-REPORT.md, TASK-LEASEMAP-REPORT.md, TASK-LOCFIX-REPORT.md, TASK-ONEMENU-PHASE1-PLAN.md, TASK-PAGETITLES-REPORT.md, TASK-RECORDS-REPORT.md, TASK-SIGREAD-REPORT.md, TASK-SUPERSEDE-REPORT.md, TASK-TIPTAP-REPORT.md, TASK-UIBUILD-LOG.md

---

## TASK-CHECKBOXTIP-REPORT.md

### ITEM
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: No real-browser click-through of the party (Lessee) view was done because the test document's LESSEE fixture has no login; jsdom rendering substituted, and someone with a Lessee login should still eyeball it.
- quote: "No real-browser click-through of the party view. The test document's LESSEE (`AVERIFY2 Tester`...) has **no login** — `profiles.user_id` is null"
- kind: not-verified
- artifacts: src/components/app/ClauseDocument.tsx
- decision-mention: none

### ITEM
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: Whether a browser actually delivers a hover tooltip on a disabled input could not be measured in jsdom; mitigated structurally via the title on an ancestor but unverified.
- quote: "**Hover-tooltip delivery on a disabled input** is browser behaviour I could not measure in jsdom."
- kind: not-verified
- artifacts: src/components/app/ClauseDocument.tsx (OwnedField)
- decision-mention: none

### ITEM
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: opacity-55 dimming was retained on not-mine fields despite the owner's stated preference for "tooltip over graying out"; dropping the dimming is a one-line change in OwnedField if the owner meant remove it.
- quote: "**`opacity-55` retained.** ... If the owner meant drop the dimming, it is now a one-line change in `OwnedField` affecting all three sites at once."
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx (OwnedField)
- decision-mention: none

### ITEM
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: A trailing period was added to the owner's quoted tooltip wording ("This item is set by the Lessor.") — trivial to revert if wrong.
- quote: "Owner wording was quoted as \"This item is set by the Lessor\" with no full stop. I shipped `This item is set by the Lessor.`"
- kind: cosmetic
- artifacts: otherPartyTip(), src/components/app/ClauseDocument.tsx
- decision-mention: none

### ITEM
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: SYSTEM and unknown owner roles fall back to the generic "the other party" tooltip phrasing on imported contact tokens — pre-existing, raised rather than fixed.
- quote: "**`SYSTEM` and unknown owner roles read as \"the other party.\"** Pre-existing in `otherPartyTip`'s fallback, and unchanged here. ... Out of scope; raising it rather than widening the diff."
- kind: cosmetic
- artifacts: otherPartyTip(), ImportedRecordToken, src/components/app/ClauseDocument.tsx
- decision-mention: none

### ITEM
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: test/ui/ is the first UI test suite in the repo and requires `npm run build:client` to have run first (it reads the emitted CSS) — a new operational dependency.
- quote: "**First UI test in the repo.** `test/ui/` is new (`test/db/` was the only suite). It needs `npm run build:client` to have run"
- kind: process
- artifacts: test/ui/clause_ownership_affordance.test.tsx
- decision-mention: none

### ITEM
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: The task's diagnosis omitted that threading `mine` alone would not fix the pointer cursor — certify's own label carries cursor-pointer, so the wrapper had a latent hole for every certify/reveal_text control; fixed with [&_*]:cursor-help, no change to ContractCascade.tsx.
- quote: "Threading `mine` alone would **not** have fixed the pointer cursor. ... the existing wrapper at line 413 had this latent hole too"
- kind: correctness
- artifacts: src/components/app/ClauseDocument.tsx, src/components/app/ContractCascade.tsx:812
- decision-mention: none

---

## TASK-FRAMESCROLL-REPORT.md

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: All rendered behavior is NOT VERIFIED — no browser session was available; a 7-step owner checklist for browser verification is included in §7.
- quote: "**All renders are NOT VERIFIED — no browser session was available.** ... Treat every \"yes\"/\"maybe\" verdict in §6 and every mechanism claim in §3 as **NOT VERIFIED in a browser**"
- kind: not-verified
- artifacts: src/components/ops/kit/DataTable.tsx, DocumentQueueTable, ContractSubheader
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: The `<main>` overflow-x-clip backstop was specified but NOT applied — AppLayout.tsx is untouched; the exact one-line diff is left for the orchestrator to apply at merge.
- quote: "Backstop specified, not applied — `AppLayout.tsx` is untouched. ... The exact one-line diff, for the orchestrator to apply at merge"
- kind: deferred
- artifacts: src/components/app/AppLayout.tsx:1470
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: The new DataTable scroll wrapper forces overflow-y:auto, so any future popover/menu added inside a DataTable cell will get clipped — a real component constraint marked only by a code comment.
- quote: "This is a real constraint on the *component*, though, not a non-issue in general — I added a one-line code comment (`FRAMESCROLL: ...`) at the wrapper so a future author adding a popover/menu inside a `DataTable` cell has a pointer to why it would get clipped."
- kind: caveat
- artifacts: src/components/ops/kit/DataTable.tsx
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: `npm run build` (full pipeline) fails at the SSR prerender step with "supabaseUrl is required" — pre-existing environment limitation (no .env in worktree), not a regression.
- quote: "`npm run build` (full pipeline, includes SSR prerender...) **fails at the prerender step** with `Error: supabaseUrl is required.` — **this is a pre-existing environment limitation, not a regression.**"
- kind: known issue
- artifacts: scripts/prerender.mjs
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 1, confirmed Yes, not fixed): Admin.tsx overview row can overflow the document — flex row's truncate lacks min-w-0 and binds unbounded p.email.
- quote: "`src/pages/app/Admin.tsx:163-164` ... **Yes** — row is `flex justify-between gap-3`, value span has `truncate` but no `min-w-0`"
- kind: defect
- artifacts: src/pages/app/Admin.tsx:163-164
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 1, confirmed Yes, not fixed): PostModal author row lacks the min-w-0 wrapper that CommunityFeed's identical pattern has.
- quote: "`src/components/feed/PostModal.tsx:330-337` ... renders `card.author` in a bare `<span>`, no `min-w-0` ... this is a miss of an established local pattern."
- kind: defect
- artifacts: src/components/feed/PostModal.tsx:330-337, src/components/feed/CommunityFeed.tsx:203
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 1, confirmed Yes, not fixed): TenantDetailPage account row renders unbounded "{a.email} · {role}" with no min-w-0.
- quote: "`src/pages/app/ops/superadmin/TenantDetailPage.tsx:175-179` ... second span always renders `{a.email} · {role}`, unbounded."
- kind: defect
- artifacts: src/pages/app/ops/superadmin/TenantDetailPage.tsx:175-179
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 2, confirmed Yes, not fixed): ContractCascade co-owner grid uses bare 1fr tracks (implicit auto minimum) so unguarded inputs floor the row width — the same file family already fixed this in ClauseDocument with minmax(0,1fr).
- quote: "`src/components/app/ContractCascade.tsx:546` ... Bare `1fr` tracks carry an implicit `auto` minimum in CSS Grid, so each of the 4 unguarded `<input>`s ... floors the row at its own intrinsic width."
- kind: defect
- artifacts: src/components/app/ContractCascade.tsx:546
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 2, not fixed, frozen file): ClauseDocument grid has a 272px hard column floor; fix needs owner sign-off since the file is out of scope (STOP-AND-PROPOSE).
- quote: "`src/components/app/ClauseDocument.tsx:606` ... `repeat(auto-fill,minmax(17rem,1fr))`, 272px hard floor per column. **STOP-AND-PROPOSE per task constraints — not touched, reported only**"
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx:606
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 4, confirmed Yes, not fixed): OrderPayment's CopyRow value span (Zelle payment_reference) lacks break-all, unlike Footer's equivalent guard.
- quote: "`src/components/order/OrderPayment.tsx:24-28,157-159` ... `CopyRow`'s value `<span>` (renders `order.payment_reference`, a Zelle memo code) has no `break-all`"
- kind: defect
- artifacts: src/components/order/OrderPayment.tsx:24-28
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 3, structural Yes, not fixed): RevealText pairs a whitespace-nowrap ~45-char label with a min-w-[8rem] input — combined minimum deterministically exceeds a 320px column.
- quote: "`src/components/app/ContractCascade.tsx:436-438` ... combined minimum exceeds a 320px column deterministically."
- kind: defect
- artifacts: src/components/app/ContractCascade.tsx:436-438
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 3, not fixed, frozen file): ClauseDocument matrix-cell label whitespace-nowrap with ~40-char labels inside the driver-2 grid — same STOP-AND-PROPOSE file, needs owner sign-off.
- quote: "`src/components/app/ClauseDocument.tsx:561` ... matrix-cell label `whitespace-nowrap`, labels can run ~40 chars ... **Same STOP-AND-PROPOSE file — reported only.**"
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx:561
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit findings (driver 1 "maybe" tier, none fixed): missing min-w-0/truncate guards at AdminRegistryPage.tsx:159-160, PaymentReviewPage.tsx:166-176 and 210-217, DealPage.tsx:281-287, ForgotPassword.tsx:41 (root AuthLayout.tsx:22-23), Register.tsx:269+, RegisterComplete.tsx:157+, TenantDetailPage.tsx:107-108, StableSection.tsx:101 and 119, ServiceSelector.tsx:93-94, PostModal.tsx:276, MemberProfile.tsx:85-88, SupportPage.tsx:80-84, DocumentViewerPage.tsx:156-159, Account.tsx:96-99.
- quote: "**28 findings: 19 driver-1 (flex missing `min-w-0`)... None of these are fixed in this branch**"
- kind: defect
- artifacts: src/pages/app/ops/admin/AdminRegistryPage.tsx, src/pages/app/ops/PaymentReviewPage.tsx, src/pages/app/ops/DealPage.tsx, src/pages/ForgotPassword.tsx, src/components/auth/AuthLayout.tsx, src/pages/Register.tsx, src/pages/RegisterComplete.tsx, src/pages/app/ops/superadmin/TenantDetailPage.tsx, src/components/app/StableSection.tsx, src/components/ServiceSelector.tsx, src/components/feed/PostModal.tsx, src/pages/app/MemberProfile.tsx, src/pages/app/ops/SupportPage.tsx, src/pages/app/ops/DocumentViewerPage.tsx, src/pages/app/Account.tsx
- decision-mention: none

### ITEM
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit findings (driver 2/4 "maybe" tier, none fixed): AdminBrandingPage.tsx:215 logoPath `<code>` lacks break-all; SignStart.tsx:74-76 brand email `<p>` lacks break-words; InvitationHistoryPanel.tsx:155 min-w-[16rem] floor on activation-link code near 320px viewports; DeliveryPanel.tsx:298-300 raw UUID relies on implicit hyphen-wrap.
- quote: "**3 driver-2 (fixed widths), 2 driver-3 (bad `whitespace-nowrap`), 4 driver-4 (unbroken strings), 0 driver-5 (escaping elements).**"
- kind: defect
- artifacts: src/pages/app/ops/admin/AdminBrandingPage.tsx:215, src/pages/SignStart.tsx:74-76, src/components/app/InvitationHistoryPanel.tsx:155, src/components/ops/documents/DeliveryPanel.tsx:298-300
- decision-mention: none

---

## TASK-I-REPORT.md

### ITEM
- report: TASK-I-REPORT.md
- date: 2026-08-04
- item: "Saved Content" has no backing data model anywhere — saved=false is hardcoded permanently in my_nav_presence() until a real saved/bookmark feature is built as its own tracker item (orchestrator ruling).
- quote: "**`saved=false` is permanent until a real feature is built** — this task deliberately does not create a saved/bookmark table. The Saved Content nav link will never appear until that's built as its own item."
- kind: deferred
- artifacts: my_nav_presence(), SavedPanel, src/components/app/AccountPanels.tsx
- decision-mention: none

### ITEM
- report: TASK-I-REPORT.md
- date: 2026-08-04
- item: Pre-existing SPA quirk in A11's ?section= pattern: AccountHub reads ?section= only in its useState initializer, so a query-string-only navigation while already on /app/account may not switch the visible panel — noted, not fixed.
- quote: "`AccountHub` reads `?section=` only in its `useState` initializer, which doesn't re-run on a query-string-only navigation ... noted for visibility, not fixed."
- kind: defect
- artifacts: AccountHub, /app/account?section=, src/pages/app/CalendarPage.tsx
- decision-mention: none

### ITEM
- report: TASK-I-REPORT.md
- date: 2026-08-04
- item: The I4 gold-ring vs fill-only active-state call was made from hex values, not a rendered screenshot — needs eyes in a browser; the revert is one line.
- quote: "**The gold-ring vs. fill-only call for I4** ... is a visual judgment from hex values, not a rendered screenshot — worth a look once the branch is viewable in a browser"
- kind: not-verified
- artifacts: RailLink, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-I-REPORT.md
- date: 2026-08-04
- item: No browser was opened this session — all I1–I5 UI work is code-complete, browser pending.
- quote: "No browser was opened this session (SQL + TypeScript only...). Everything above is \"code-complete, browser pending\""
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx, src/components/app/AccountPanels.tsx
- decision-mention: none

---

## TASK-INBOUNDALERT-REPORT.md

### ITEM
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: CONTACT.OPS_INBOX (the single address every lead alert is sent to) has no owner-facing editor — nothing in src/ references it and AdminBrandingPage discards CONTACT.* keys; changing the alert recipient requires a thread and SQL. Named as a D13 violation follow-up.
- quote: "**`CONTACT.OPS_INBOX` has no owner-facing editor — a D13 violation.** ... the ops inbox needs a field on the branding page."
- kind: blocked-on-owner
- artifacts: config_values (CONTACT.OPS_INBOX), AdminBrandingPage, src/lib/api.ts:2016
- decision-mention: D13

### ITEM
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: claim_receipt_send / log_receipt_send are still executable by anon and authenticated — anyone with the public anon key can forge receipt-send evidence or claim a key to suppress a real send. Not touched (not this task's table).
- quote: "**`claim_receipt_send` / `log_receipt_send` are executable by `anon` and `authenticated`.** Anyone with the public anon key can write `receipt_sends` rows claiming a receipt was sent, or claim one to suppress a real send."
- kind: security
- artifacts: claim_receipt_send, log_receipt_send, receipt_sends
- decision-mention: none

### ITEM
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: A dismissed in-app notification leaves no trace in any surface the owner reads — evidence survives only in audit_logs, which nothing in the app reads; this is what made "Kit was never notified" look true for three days. Notification-lifecycle gap, not changed.
- quote: "**A dismissed notification leaves no trace in any surface the owner reads.** The evidence survives in `audit_logs` and nothing in the app reads it."
- kind: defect
- artifacts: notifications, consume_notification, audit_logs
- decision-mention: none

### ITEM
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: Kit and Kylie deliberately report alert_state='unknown' (they predate the attempt record); both leads were missed and not backfilled or re-notified — the owner's to act on.
- quote: "**Kit and Kylie report `alert_state = 'unknown'`, deliberately.** ... **They were both missed, and that is the owner's to act on.**"
- kind: blocked-on-owner
- artifacts: inbound_queue, request_alert_sends
- decision-mention: none

### ITEM
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: Grant trap caught by verifying: REVOKE FROM PUBLIC was a silent no-op because ALTER DEFAULT PRIVILEGES grants anon/authenticated explicitly; the migration now names every role. (Recurring project-wide trap.)
- quote: "`REVOKE … FROM PUBLIC` was a **silent no-op** — this project's `ALTER DEFAULT PRIVILEGES` grants `anon`/`authenticated` explicitly, so a PUBLIC-only revoke left them untouched."
- kind: process
- artifacts: 20260812T2000_inboundalert_request_alert_attempts.sql, claim_request_alert_send, log_request_alert_send
- decision-mention: none

### ITEM
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: Two pre-existing test/ui failures (reviewnav_section, pluspass_create_controls) confirmed failing on a clean tree at the same commit.
- quote: "npx vitest run test/ui   15 passed, 2 failed  ← both pre-existing"
- kind: known issue
- artifacts: test/ui/reviewnav_section, test/ui/pluspass_create_controls
- decision-mention: none

---

## TASK-LEASEMAP-REPORT.md

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F1 — ARENA_SOLO ("Solo Arena Riding") gates nothing anywhere in the template; selecting it only changes the printed word list.
- quote: "**F1 — `ARENA_SOLO` gates nothing, anywhere.** ... It appears in no `conditional_on` in the entire template."
- kind: defect
- artifacts: HORSE_LEASE_V2, TXN.PERMITTED_ACTIVITIES, PERMITTED_USE.MAIN
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F2 — choosing OTHER on the three deductible selects prints the bare word "Other" and leads nowhere; the trigger's clear-branch targets a `<base>_RESP_OTHER` field that does not exist in this template.
- quote: "**F2 — `OTHER` on the three deductible selects leads nowhere.** Choosing it prints the bare word *\"Other\"* into the sentence"
- kind: defect
- artifacts: HORSE_LEASE_V2, contract_split_deductible_sync
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F3 — the deductible sentence is dead exactly when the Lessee has just accepted financial responsibility (both statuses NONE is the precondition for the box), so an undertaken cover never gets a deductible allocation.
- quote: "**F3 — the deductible sentence is dead exactly when responsibility has just been accepted.**"
- kind: defect
- artifacts: *_DEDR_SIMPLE clauses, HORSE_LEASE_V2
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F4 — clause_cut_kept has no effect on this lease (cut_name null everywhere) and still tests three fields that do not exist in HORSE_LEASE_V2.
- quote: "**F4 — `clause_cut_kept` has no effect on this lease.** `cut_name` is null on every section and every clause"
- kind: defect
- artifacts: clause_cut_kept, TXN.MORTALITY_INSURANCE_PARTY, TXN.MAJOR_MEDICAL_INSURANCE_PARTY, TXN.LOSS_OF_USE_INSURANCE_PARTY
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F5 — most of contract_split_deductible_sync is dead (references seven nonexistent fields); FMV floor rule and teardown branches never fire, and mortality/medical split shares are never normalised while GL's are — two identical-looking controls behave differently.
- quote: "**F5 — most of the deductible trigger is dead.** `contract_split_deductible_sync` references seven fields that do not exist in `HORSE_LEASE_V2`"
- kind: defect
- artifacts: contract_split_deductible_sync
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F6 — three of the seven permitted activities (LESSONS, ARENA_SOLO, TRAINING) produce no risk acknowledgement clause in the insurance section; the other four do.
- quote: "**F6 — no risk clause exists for three of the seven activities.**"
- kind: defect
- artifacts: HORSE_LEASE_V2 INSURANCE_RISK, TXN.PERMITTED_ACTIVITIES
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F7 — the only executed lease (ecaecd42) carries thirteen orphaned insurance field rows (plus four non-insurance orphans) in a vocabulary the template no longer has; the definition sync no longer touches executed documents.
- quote: "**F7 — the one executed lease carries thirteen orphaned insurance field rows.** ... its insurance terms are expressed in a vocabulary the template no longer has."
- kind: data-integrity
- artifacts: documents ecaecd42, contract_fields
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F8 — unconditional RISK_OF_LOSS ("Lessor assumes all risk") prints alongside MORT_LESSEE_RESP whenever the Lessee accepts mortality responsibility — the document says both things at once.
- quote: "**F8 — `RISK_OF_LOSS` versus any Lessee-carried mortality.** ... Both print together, four items apart"
- kind: defect
- artifacts: RISK_OF_LOSS, MORT_LESSEE_RESP, HORSE_LEASE_V2
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F9 — MED_TAIL (Lessor assumes all uncovered risks/costs) prints inside the same numbered item as Lessee-carried medical statements that say the opposite.
- quote: "**F9 — `MED_TAIL` versus any Lessee-carried medical.** ... They print inside the same numbered item."
- kind: defect
- artifacts: MED_TAIL, MED_LESSEE_RESP, HORSE_LEASE_V2
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F10 — COORDINATION's gate does not test the Lessor's mortality status, so the document can name the Lessor's mortality policy as first-claimed two items below a line saying no such policy exists.
- quote: "**F10 — `COORDINATION` names a policy the document may say does not exist.**"
- kind: defect
- artifacts: COORDINATION clause, HORSE_LEASE_V2
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F11 — entity lessee with mortality waived produces two owners of the same loss (MORT_NONE and CCC) with the ordering clause switched off; nothing states which policy responds or who keeps proceeds.
- quote: "**F11 — entity lessee with mortality waived produces two owners of the same loss.**"
- kind: defect
- artifacts: MORT_NONE, CCC, COORDINATION, HORSE_LEASE_V2
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F12 — the Lessee-responsibility clause always prints alongside a contradicting "Does not have and will not obtain" status line by construction; in the medical block the sort order additionally lands the status under the wrong heading.
- quote: "**F12 — the Lessee-responsibility clause and the Lessee's status line contradict each other by construction.**"
- kind: defect
- artifacts: MED_LESSEE_RESP, MED_STATUS, HORSE_LEASE_V2
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F13 — the deductible sentence misdescribes whose policy it is, printing identically whether the policy is Lessor's or Lessee's.
- quote: "**F13 — the deductible sentence misdescribes whose policy it is.**"
- kind: defect
- artifacts: *_DEDR_SIMPLE clauses, HORSE_LEASE_V2
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F14 — a blank insurance status prints its sentence with a gap that reads as an affirmative undertaking with a typo; live right now in draft 215bac09, six fields behave this way.
- quote: "**F14 — a blank status prints its sentence with a gap.** Live in `215bac09`: *\"Lessor:  general liability insurance covering the Horse...\"*"
- kind: defect
- artifacts: documents 215bac09, remerge_contract_from_clauses, *_STATUS fields
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F15 — a blank deductible selection prints a bare colon ("...borne by:"); documented in the composer as intended, which makes it silent rather than broken.
- quote: "**F15 — a blank deductible selection prints a bare colon.**"
- kind: defect
- artifacts: remerge_contract_from_clauses
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F16 — blank split shares print an empty allocation ("paid by Lessor and paid by Lessee" with no numbers).
- quote: "**F16 — blank split shares print an empty allocation.**"
- kind: defect
- artifacts: HORSE_LEASE_V2 deductible split clauses
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F17 — HORSE.FAIR_MARKET_VALUE is optional yet two money clauses print it, one (LIMITATION) unconditionally on every lease — "shall not exceed the Horse's current fair market value of." with nothing after "of".
- quote: "**F17 — `HORSE.FAIR_MARKET_VALUE` is not required, and two money clauses print it.**"
- kind: defect
- artifacts: HORSE.FAIR_MARKET_VALUE, CCC, LIMITATION
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F18 — hiding a field via a waiver does not clear its stored value; the signing blocker and unresolved-insurance notification read raw stored values without gates, so stale NONEs re-arm the block when a waiver comes off.
- quote: "**F18 — hiding a field does not clear it.** ... a pair of stale `NONE`s reactivates the block the moment the waiver comes off."
- kind: defect
- artifacts: contract_lock_blockers, insurance_resolution_sync, set_contract_field
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F19 — mortality and medical split shares are neither normalised nor cross-checked (60/70 both stored and printed verbatim) while GL on the same screen silently rewrites the second share.
- quote: "**F19 — mortality and medical split shares are neither normalised nor cross-checked.**"
- kind: defect
- artifacts: contract_split_deductible_sync
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: TXN.LEASE_TYPE (full vs partial) does not reach the insurance section at all — the distinction the owner is worried about is invisible to every gate in the section.
- quote: "**`TXN.LEASE_TYPE` does not reach the insurance section at all.** Not one insurance clause and not one insurance field is gated on whether the lease is full or partial."
- kind: defect
- artifacts: TXN.LEASE_TYPE, HORSE_LEASE_V2 INSURANCE_RISK
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: The Lessor (and FHE staff) can write the Lessee's three first-person insurance-status undertakings — all three *_LESSEE_STATUS fields are owner_role=LESSOR, while the equivalent checkbox elections are party-exclusive; same undertaking, opposite rules.
- quote: "**The Lessor writes the Lessee's insurance status.** All three `*_LESSEE_STATUS` fields are `owner_role = LESSOR`."
- kind: defect
- artifacts: TXN.GL_LESSEE_STATUS, TXN.MORT_LESSEE_STATUS, TXN.MED_LESSEE_STATUS, set_contract_field
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: A Lessee's election does not stay made — the Lessor changing their own status hides the election's clause while the stored YES survives, and restoring the status restores the printed undertaking without the Lessee acting again.
- quote: "**A declaration that does not stay made.** ... Restoring the status restores the printed undertaking without the Lessee acting again."
- kind: defect
- artifacts: TXN.*_LESSEE_RESPONSIBLE fields, set_contract_field
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: No field, upload, date, or status anywhere records whether proof of insurance coverage was given or a policy actually exists, despite four clauses saying "shall provide proof of coverage upon request".
- quote: "A policy is actually in force | nowhere | ... There is no field, upload, date or status anywhere that records whether proof was given or a policy exists."
- kind: defect
- artifacts: CCC, GL_LESSEE_RESP, MORT_LESSEE_RESP, MED_LESSEE_RESP
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: contacts.is_minor_contact is read by no insurance field or clause.
- quote: "The Lessee is a minor | `contacts.is_minor_contact` | No insurance field or clause reads it."
- kind: defect
- artifacts: contacts.is_minor_contact, HORSE_LEASE_V2 INSURANCE_RISK
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: The status vocabulary carries no notion of capability or demand ("required to", "cannot lawfully obtain"), so scenario 4 (partial lease, cover the Lessee cannot get) has only four bad moves: state something untrue, undertake the impossible, leave unsignable, or drop the requirement.
- quote: "**The vocabulary carries no notion of capability or demand.** ... Scenario 4 is the direct consequence"
- kind: defect
- artifacts: docs/reference/lease-map/SCENARIOS.md, *_STATUS fields
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: The insurance section has never been filled in end to end by any real transaction — all 22 insurance fields are empty on all three current documents; the one executed lease predates the model.
- quote: "**The insurance section has never been filled in.** ... Nothing in this section has been exercised end to end by a real transaction."
- kind: inventory
- artifacts: HORSE_LEASE_V2 INSURANCE_RISK, contract_fields
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: Inferred not observed: the deductible-trigger's GL-vs-mortality/medical behavior difference and the assembled text of scenarios 1/3/4/5 were read from code, never seen running.
- quote: "**Inferred — read from code, not observed running:** the deductible-split trigger's different behaviour for GL versus mortality and medical."
- kind: not-verified
- artifacts: contract_split_deductible_sync, docs/reference/lease-map/SCENARIOS.md
- decision-mention: none

### ITEM
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: lock_and_sign_contract's gate-blind required-field branch is unreachable through the app UI but reachable by direct RPC call — read from the Sign control's render condition, not tested.
- quote: "that `lock_and_sign_contract`'s gate-blind required-field branch is unreachable through the application. It is reachable by direct RPC call."
- kind: caveat
- artifacts: lock_and_sign_contract
- decision-mention: none

---

## TASK-LOCFIX-REPORT.md

### ITEM
- report: TASK-LOCFIX-REPORT.md
- date: 2026-08-05
- item: HORSE_SALE_V2's HORSE.IDENTITY grid has the same long-location "runs onto the label's line" exposure; deliberately not touched (would reflow 10 other fields) — flagged as a follow-up for separate sign-off.
- quote: "the same \"runs onto the label's line\" symptom as defect 2 would reproduce there. I did **not** touch it ... flagging as a follow-up for separate sign-off rather than building it here."
- kind: deferred
- artifacts: HORSE_SALE_V2 HORSE.IDENTITY, HORSE.CURRENT_LOCATION, src/components/app/ClauseDocument.tsx
- decision-mention: none

### ITEM
- report: TASK-LOCFIX-REPORT.md
- date: 2026-08-05
- item: The Location-section fixes have not been visually confirmed — no browser available; the lease editor was never loaded.
- quote: "**UI is browser-pending** — this environment has no browser available; the fix has not been visually confirmed by loading the lease editor."
- kind: not-verified
- artifacts: src/components/app/ClauseDocument.tsx, LOCATION.MAIN, LOCATION.NEW
- decision-mention: none

---

## TASK-ONEMENU-PHASE1-PLAN.md

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Q2 unresolved contradiction: the task doc frames the avatar as a live choice (inert vs link to /app/account) while commit bd1b820's message rules it inert — the two readings produce different components; needs explicit owner reconciliation before Phase 2.
- quote: "is the avatar inert, or a link to `/app/account`? The doc and the commit history disagree with each other right now."
- kind: blocked-on-owner
- artifacts: CardstockHeader.tsx, onAvatarClick, header-cardstock.css:200
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Saved Content becomes unreachable from mobile nav entirely once the avatar menu is removed (I6 deliberately excluded it from the drawer on the premise the avatar menu still listed it) — owner must decide: add to drawer (breaking I6) or accept the loss.
- quote: "Once it's gone, that sentence's premise is gone too: Saved Content becomes unreachable from mobile nav entirely ... This needs an explicit call"
- kind: blocked-on-owner
- artifacts: src/components/app/AppLayout.tsx (I6 comment 475-490), /app/account?section=saved
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: B3's literal scope (RailLink only) would leave two different active-state styles side by side in one drawer list — PresenceLink, AccountNavLink and CommunityNav's nested links hand-copy the same cream-fill convention; owner should decide all-four vs RailLink-only.
- quote: "If only `RailLink` changes, a member's own drawer will show **two different active-state styles side by side in one list**"
- kind: blocked-on-owner
- artifacts: RailLink, PresenceLink, AccountNavLink, CommunityNav, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Staff have no personal Account link in the mobile drawer today at all — removing the avatar dropdown without adding one strands instructors and admins from their account page on mobile; placement is net-new with no existing position to preserve.
- quote: "**Staff have no personal Account link in the mobile drawer today, at all.** ... Removing the avatar dropdown without adding one strands instructors and admins"
- kind: defect
- artifacts: src/components/app/AppLayout.tsx (showRail branch), /app/account
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Sign out is reachable only via the avatar menu for every role (mobile and desktop) — the merged drawer must carry it, and desktop cannot lose the dropdown until a desktop replacement exists (Q4's hard constraint; desktop consolidation is real follow-on work).
- quote: "**Sign out** ... **NET-NEW — the only path** ... **the avatar dropdown cannot be removed on desktop without a replacement**, because desktop currently has no other path to sign out at all."
- kind: defect
- artifacts: handleSignOut, ClientRail, src/components/app/AppLayout.tsx, CardstockHeader
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Admin vs instructor avatar-menu asymmetry (instructors get Calendar/Catalog/Messages, admins do not) reads as branch drift, not design — reported rather than equalized; owner should confirm both converging on the same net-new set is acceptable.
- quote: "Admins and instructors get different avatar-menu content today even though both are `isStaff` ... I'm reporting it rather than quietly equalizing it."
- kind: blocked-on-owner
- artifacts: src/components/app/AppLayout.tsx:733-813
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Q1 (sign-out placement), Q3 (superadmin untouched) and Q4 (scope dropdown removal to <lg only) are answered as recommendations, not commitments — explicit sign-off needed before Phase 2 builds against them.
- quote: "**Q1/Q4/Q3 answers above** — presented as recommendations, not commitments; need explicit sign-off"
- kind: blocked-on-owner
- artifacts: src/components/app/AppLayout.tsx, CardstockHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: The closed drawer-tab chevron's pointing direction was not hand-verified from the CSS geometry — Phase 2 must screenshot the closed state and confirm it reads left-pointing before relying on "no change needed".
- quote: "I did not hand-verify which way the un-rotated chevron actually points from the CSS alone ... Phase 2 should screenshot the closed state and confirm it reads as **left**-pointing"
- kind: not-verified
- artifacts: header-cardstock.css:374-384 (.cs-arrow)
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: B0 trap: the generic `.cs-mark svg { inset:0; width/height:100% }` rule will stretch the avatar's 50×50 SVG if its wrapper grows to 56px — reintroducing the resampling defect BP410 fixed; Phase 2 must land a scoped override alongside the width change.
- quote: "this rule will stretch the avatar's still-50×50 (still-42×42) SVG to fill the new wrapper — which is exactly the resampling defect BP410 already fixed once"
- kind: caveat
- artifacts: header-cardstock.css:98 (.cs-mark svg), .cs-avatar
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: B0 second cross-effect: the desktop Create tab's position (--cs-tab-right) is derived from the avatar's 50px width; growing the avatar 6px without recalculating drifts the tab out of visual center.
- quote: "Growing the avatar wrapper by 6px (50→56) without recalculating `--cs-tab-right` will drift the Create tab ~6px out of its intended visual center."
- kind: caveat
- artifacts: header-cardstock.css:258-264 (.cs-tab, --cs-tab-right)
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: B2 leaves a layout cleanup: after removing the Close button the drawer header row is single-child under justify-between and will look off-balance — a Phase 2 styling call.
- quote: "The only real work in B2 is the layout cleanup of the now-single-child header row (`justify-between` with one child left will look off-balance...)"
- kind: cosmetic
- artifacts: src/components/app/AppLayout.tsx:1031-1037
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: RailLink sets no explicit aria-current; the assumption that React Router's NavLink covers it implicitly is flagged, not tested at runtime.
- quote: "I'd rather flag the assumption than assert it against a library internal I didn't test at runtime."
- kind: not-verified
- artifacts: RailLink, src/components/app/AppLayout.tsx:284-314
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Correction to the task doc: B6's "other six pages using the title model" is actually twelve (plus two ops instances) — the doc's inventory was stale; action unchanged (leave everything as-is).
- quote: "The actual count, searched fresh rather than trusted from the doc, is **twelve** other pages, not six"
- kind: correction
- artifacts: src/pages/app/ (title-model pages)
- decision-mention: none

### ITEM
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Net-new avatar-menu items that must land somewhere in the merged drawer or be lost: Account (staff), Catalog (admins and instructors), Messages (instructors), App tour (all roles), Sign out (all roles), Saved Content (members).
- quote: "**NET-NEW** (only reachable via the avatar menu today — must land somewhere in the merged drawer or it's lost)"
- kind: inventory
- artifacts: src/components/app/AppLayout.tsx:733-813 (avatar dropdown)
- decision-mention: none

---

## TASK-PAGETITLES-REPORT.md

### ITEM
- report: TASK-PAGETITLES-REPORT.md
- date: 2026-08-05
- item: Eleven other pages (Account, My Posts, Documents, Orders, Schedule, Support, My Lessons, Gifts, Onboarding, CareHome, DealHome) still carry a large dark-green title as their default — none touched; owner must rule whether the new default-title rule extends to them.
- quote: "None of these were touched — flagging per the task doc's instruction to note which other pages still carry a large title so the owner can rule on them."
- kind: blocked-on-owner
- artifacts: AccountHub.tsx, MyPosts.tsx, Documents.tsx, Orders.tsx, Schedule.tsx, Support.tsx, MyLessons.tsx, Gifts.tsx, Onboarding.tsx, CareHome.tsx, DealHome.tsx
- decision-mention: none

### ITEM
- report: TASK-PAGETITLES-REPORT.md
- date: 2026-08-05
- item: All four page changes are code-complete but not visually verified in a running browser.
- quote: "All four page changes are code-complete but not visually verified in a running browser (no dev server session run in this pass)"
- kind: not-verified
- artifacts: Home.tsx, DashboardHome.tsx, CatalogPage.tsx, OfferingCatalog.tsx
- decision-mention: none

### ITEM
- report: TASK-PAGETITLES-REPORT.md
- date: 2026-08-05
- item: Deviation from spec: timeOfDayWord()'s fourth 'night' bucket (21:00–03:59) was mapped to "Evening" for the Dashboard greeting since the spec only covers Morning/Afternoon/Evening.
- quote: "`timeOfDayWord()` has a fourth `'night'` bucket (21:00–03:59) the task's Morning/Afternoon/Evening spec doesn't cover; mapped `night → \"Evening\"`"
- kind: deviation
- artifacts: src/lib/formatDateTime.ts (timeOfDayWord), DashboardHome.tsx
- decision-mention: none

---

## TASK-RECORDS-REPORT.md

### ITEM
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: The whole Records page has never been looked at rendered — no staff browser session; a 10-step manual walkthrough is specified for the owner.
- quote: "**NOT VERIFIED — no staff browser session exists in this environment.** Nobody has looked at this rendered. Walk this by hand:"
- kind: not-verified
- artifacts: RecordsPage.tsx, /app/records, ContactDirectory, HorseRecordsPage
- decision-mention: none

### ITEM
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: Pre-existing defect flagged again, not fixed: ContactForm's create path does not set contact_type on any tab, so a contact created from any tab (All included) lands Unfiled regardless.
- quote: "`ContactForm`'s create path does not set `contact_type` on any tab today (a pre-existing defect, first named in the DUPECENSUS/REVIEWNAV reports) ... Not fixed here; flagged again below."
- kind: defect
- artifacts: ContactForm, ContactsPage.tsx
- decision-mention: none

### ITEM
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: Discrepancy: the task doc recorded CONTACT 20 but production reads CONTACT 17 (three rows fewer) — measured fresh, not investigated further.
- quote: "**One discrepancy, stated plainly: the task doc recorded `CONTACT 20`; production now reads `CONTACT 17`**, three rows fewer"
- kind: correction
- artifacts: contacts table
- decision-mention: none

### ITEM
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: Caveat: person→horse links navigate away to /app/horses/:id (route change), not a same-page expansion like the new horse→person modal — recorded rather than smoothed over.
- quote: "those links navigate to the member-facing horse page, a route change, not a same-page expansion the way the new horse→person link is. Recorded rather than smoothed over."
- kind: caveat
- artifacts: ClientHorseRecordsCard, /app/horses/:id
- decision-mention: none

### ITEM
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: A second, inert "Horses" section renders in the dossier duplicating ClientHorseRecordsCard's information as plain text — pre-existing quirk, not touched.
- quote: "A second, INERT \"Horses\" section (`Section title=\"Horses\"` / `Row`) also renders in the same dossier — pre-existing, plain text, not a link, and not touched"
- kind: cosmetic
- artifacts: ContactDossierModal
- decision-mention: none

### ITEM
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: Judgment call stated as such: /app/ops/directory redirects to the Vendors tab (not Partners) because the old Directory blurb (farriers, vets, suppliers) reads as Vendor.
- quote: "**Vendor chosen over Partner** because most of the old Directory blurb ... reads as Vendor ... stated here as a judgment call, not a neutral fact"
- kind: deviation
- artifacts: /app/ops/directory, /app/records/vendors
- decision-mention: none

### ITEM
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: Two pre-existing test/ui failures unchanged: pluspass_create_controls, and reviewnav_section's `templates` group missing an incumbent (a TEXTEDIT-task gap, not touched here).
- quote: "same two pre-existing failures as `main` (`pluspass_create_controls`, and `reviewnav_section`'s `templates` group missing an incumbent — a TEXTEDIT-task gap, not touched here)"
- kind: known issue
- artifacts: test/ui/pluspass_create_controls, test/ui/reviewnav_section, src/lib/reviewSection.ts
- decision-mention: none

### ITEM
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: test:db is broken independent of this task, per the standing note, and was not cited.
- quote: "`test:db` not cited, per the standing note that it is broken independent of this task."
- kind: known issue
- artifacts: test/db
- decision-mention: none

---

## TASK-SIGREAD-REPORT.md

### ITEM
- report: TASK-SIGREAD-REPORT.md
- date: 2026-08-06
- item: The pixel-level render of the Documents page showing the signed flag was not click-tested — no browser session; the signed:true computation was traced by hand from the live query.
- quote: "Assumed, not verified: the actual pixel-level render of the Documents page (no browser session available in this environment)"
- kind: not-verified
- artifacts: src/pages/app/Documents.tsx:214, listMySignableDocuments(), src/lib/ops/api-client.ts:70-116
- decision-mention: none

### ITEM
- report: TASK-SIGREAD-REPORT.md
- date: 2026-08-06
- item: signatures_select gates staff visibility on is_admin() rather than the broader has_staff_access() used elsewhere — pre-existing, flagged, not touched.
- quote: "(`signatures_select` gates on `is_admin()`, not the broader `has_staff_access()` used elsewhere — pre-existing, not something this task touches.)"
- kind: caveat
- artifacts: signatures_select policy, signatures table
- decision-mention: none

---

## TASK-SUPERSEDE-REPORT.md

### ITEM
- report: TASK-SUPERSEDE-REPORT.md
- date: 2026-08-10
- item: FOUND NOT FIXED and armed: CJ's two ready_to_sign Beaumont documents (fb6abc6c, 0360f829) reference contract_id ae4ffe95 which does not exist in contracts (despite the FK reporting convalidated=true); signing either in production will ERROR. Owner must choose: NULL the contract_ids or delete-and-regenerate via ensure_horse_documents.
- quote: "Both Beaumont documents ... carry `contract_id = ae4ffe95-...`, **which does not exist in `contracts`** ... **This is itself armed:** signing either document in production will ERROR."
- kind: data-integrity
- artifacts: documents fb6abc6c, documents 0360f829, contracts, documents_contract_id_fkey, ensure_horse_documents
- decision-mention: none

### ITEM
- report: TASK-SUPERSEDE-REPORT.md
- date: 2026-08-10
- item: Assumptions not verified: that jsonb_populate_record clones are faithful stand-ins for app-generated documents, and that no code path other than the watched status transition executes documents.
- quote: "**Assumed:** that `jsonb_populate_record` clones used in proofs 2–3 are faithful stand-ins for app-generated documents ... that no other code path executes documents except the status transition the trigger watches."
- kind: not-verified
- artifacts: apply_document_supersession, documents_apply_supersession trigger
- decision-mention: none

### ITEM
- report: TASK-SUPERSEDE-REPORT.md
- date: 2026-08-10
- item: Mary Richardson holds two blank-horse DRAFTs of the same templates — the blank→bound supersession ruling will govern her path too; noted as a live consequence.
- quote: "plus Mary Richardson holding two blank-horse DRAFTs of the same templates — the blank→bound ruling will govern her path too"
- kind: caveat
- artifacts: documents (Mary Richardson blank-horse DRAFTs), apply_document_supersession
- decision-mention: none

### ITEM
- report: TASK-SUPERSEDE-REPORT.md
- date: 2026-08-10
- item: No typecheck claim made — npm install was not run and nothing TypeScript was touched; no historical supersession markings revisited per task constraint.
- quote: "**Not done:** no frontend change, so no typecheck claim is made (`npm install` was not run...). No historical supersession markings revisited, per the task constraint."
- kind: process
- artifacts: supabase/migrations/20260810T1700_supersede_horse_scoped.sql
- decision-mention: none

---

## TASK-TIPTAP-REPORT.md

### ITEM
- report: TASK-TIPTAP-REPORT.md
- date: 2026-08-07
- item: InfoDot shares this task's core defect (390px overflow exposure, no viewport clamp, no outside-tap close) but is outside the stated scope and was left untouched — surfaced for a follow-up decision.
- quote: "it has the same 390px overflow exposure `ExplainTip` was built to fix (`absolute left-0 top-6 w-64`, no viewport clamping) and no outside-tap-to-close. Left untouched"
- kind: deferred
- artifacts: InfoDot, src/components/app/ContractCascade.tsx (~L214)
- decision-mention: none

### ITEM
- report: TASK-TIPTAP-REPORT.md
- date: 2026-08-07
- item: Five title="Remove"/"Delete…" sites in ContractCascade.tsx were deliberately left as plain title= (converting would break one-tap removal into two taps) — flagged judgment call.
- quote: "**Five `title=\"Remove\"`/`\"Delete…\"` sites in `ContractCascade.tsx`** (lines 441, 519, 558, 707, 1374) ... these stay as plain `title=`"
- kind: caveat
- artifacts: src/components/app/ContractCascade.tsx:441,519,558,707,1374
- decision-mention: none

### ITEM
- report: TASK-TIPTAP-REPORT.md
- date: 2026-08-07
- item: OwnedField's ExplainTip ships with the default dotted underline on (drawn under the label only, not the disabled control) — a flagged judgment call; underline={false} is the one-line change if it renders wrong.
- quote: "it was a genuine judgment call, not an oversight, and it's a one-line change (`underline={false}` on the `ExplainTip` call in `OwnedField`) if the rendered result looks wrong in a real browser"
- kind: not-verified
- artifacts: OwnedField, src/components/app/ExplainTip.tsx, src/components/app/ClauseDocument.tsx
- decision-mention: none

### ITEM
- report: TASK-TIPTAP-REPORT.md
- date: 2026-08-07
- item: No real device or browser was available: iPhone tap behavior, desktop hover, the 390px clamp's rendered result, converted-site text rendering, and screen-reader output are all verified only via jsdom/diff/reasoning, not on hardware.
- quote: "**Could not verify — no real device or browser available in this environment**"
- kind: not-verified
- artifacts: src/components/app/ExplainTip.tsx, src/components/app/ClauseDocument.tsx, src/components/app/ContractCascade.tsx
- decision-mention: none

### ITEM
- report: TASK-TIPTAP-REPORT.md
- date: 2026-08-07
- item: The throwaway interaction test that caught the mount-deadlock bug (a permanently-broken tooltip that typecheck/lint/build all passed cleanly on) was deleted, not committed — reconstructable on request; the bug class is invisible to every committed check.
- quote: "Nothing in typecheck, lint, or the production build would have caught it — all three passed cleanly on the broken version too."
- kind: process
- artifacts: src/components/app/ExplainTip.tsx
- decision-mention: none

---

## TASK-UIBUILD-LOG.md

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: Blanket: every UIO order's rendered result is browser-pending — all verification was typecheck/lint/build plus grepping compiled CSS/JS (with a few headless-Chrome mockup screenshots); nothing was clicked or eyeballed in the real app at any breakpoint.
- quote: "The header's line, the rail shadow (if visible), and the subheader shadow have not been looked at by eye in any browser or device size. Nothing here proves a render."
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx, src/components/app/app-header.css, src/components/app/ContractSubheader.tsx, src/components/app/ContractPage.tsx
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-001: the new X-axis rail box-shadow sits on the same `<nav>` that carries overflow-x-hidden, which commonly clips an element's own shadow — conflicts with the guidance received when asked; if invisible in a browser the fix is structural and should go back through UIREVIEW as its own order.
- quote: "**Whether the rail shadow is actually visible, or clipped.** ... my new shadow projects exactly on the X axis that `overflow-x-hidden` clips."
- kind: defect
- artifacts: .oh-rail-shadow, src/components/app/AppLayout.tsx (`<nav>` rails)
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-001 correction: the state doc's lint baseline of 26 warnings is wrong — the actual pre-existing baseline on the branch is 30 (later 35 after a main merge).
- quote: "confirmed this is the pre-existing baseline on this branch, not 26 as the state doc says"
- kind: correction
- artifacts: npm run lint baseline
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-002 correction: the order's stated desktop contrast (13.4:1 for #0d2118 on #f5f0e8) doesn't match the shipped colours — independently computed 14.83:1; the order appears to have reused an unrelated figure. Not a safety regression; flagged for UIREVIEW to correct.
- quote: "**Desktop, `#0d2118` on the header `#f5f0e8`: I compute 14.83:1, not the 13.4 the order's table states.**"
- kind: correction
- artifacts: .oh-avatar, src/components/app/app-header.css
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-002: whether the :active gradient-alpha transition reads as smooth is inference from CSS interpolation rules, not something seen rendering.
- quote: "Whether the `:active` transition reads as smooth. `transition: background` is animating a `linear-gradient`'s alpha ... this is inference from the CSS, not something I've seen render."
- kind: not-verified
- artifacts: button.oh-avatar, src/components/app/app-header.css
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-003/UIO-013 scope guess flagged: the hover sweep was applied to the nav-rail family only; MenuLink and the account-menu-dropdown block (~lines 1132-1268) still carry the old hover:bg-navfill/64 fill — unverified against what the owner was actually looking at.
- quote: "the account-menu-dropdown-shaped block (`MenuLink` and the block around what's now lines 1132-1268) still carries the old `hover:bg-navfill/64` fill untouched. ... Flagging in case that scope guess was too narrow."
- kind: caveat
- artifacts: MenuLink, src/components/app/AppLayout.tsx:1132-1268
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-004 correction: the order said "35 sites across 21 files"; the actual cherry-picked commit is 27 files / 35 insertions, and the built JS shows 37 occurrences (2 pre-existing sites) — discrepancies traced, not a bug.
- quote: "**File-count discrepancy:** the order says \"35 sites across 21 files\"; the actual commit's diffstat is 27 files, 35 single-line insertions."
- kind: correction
- artifacts: overscroll-contain sites, ContractDrawer.tsx:224, ContractSubheader.tsx:275
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-004: overscroll chaining itself is untested on any device — a runtime scroll-physics behavior invisible to static checks; explicitly unverified, not "probably fine".
- quote: "Overscroll chaining itself. ... I have not tested it on a device, iOS or otherwise. Confirming this is unverified, not \"probably fine.\""
- kind: not-verified
- artifacts: overscroll-behavior:contain sites (27 files)
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-007: whether overscroll-behavior actually contains the drawer's scroll chaining on iOS Safari — the entire reason the removed body-lock existed — is unconfirmed in either direction; the order says STOP and report rather than reinstate the lock if it fails on a real device.
- quote: "**The iOS-specific caveat, which is the entire reason the old lock existed:** whether `overscroll-behavior` actually contains the drawer's scroll chaining on iOS Safari ... this is unconfirmed in either direction, not passing."
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx (app-nav-drawer, body-lock effect removed)
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-006 gap 1 NOT shipped: the avatar's open state is still identical to pressed; a three-option rendered comparison page was built and the gap remains in the shipped avatar until the owner picks.
- quote: "`app-header.css` still pairs `:active` and `[aria-expanded='true']` unchanged — this is a real gap in the shipped avatar, not resolved by this commit, until the owner picks from that page."
- kind: blocked-on-owner
- artifacts: docs/reference/uio-006-open-state-options.html, src/components/app/app-header.css
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-006: shipping 7% as the hover fill (arithmetic midpoint of the 14%/0% ramp) was an interpretation of an unspecified value — flagged in case the read was wrong; one number to change.
- quote: "treated 7% (the exact arithmetic midpoint...) as a principled interpolation of a fully-specified mechanism, not a new invented value, and shipped it. Flagging the reasoning explicitly in case that read was wrong"
- kind: deviation
- artifacts: button.oh-avatar:hover, src/components/app/app-header.css
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-009: the order's premise that the subheader lacks a bottom line is false — border-green-800/15 was already present and predates UIBUILD; reported as "already satisfied, nothing to add" and flagged in case the owner meant some other line.
- quote: "I'm reporting this as \"already satisfied, nothing to add\" rather than \"done,\" since the order's own premise (that this line doesn't currently exist) doesn't match what's in the file"
- kind: correction
- artifacts: src/components/app/ContractSubheader.tsx:171
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-012: no nav group's open/collapsed state persists across a page reload (openGroups is plain useState, no localStorage) — unlike staffRailPinned and communityNav.expanded; flagged in case "same persistence" was assumed to mean "persists".
- quote: "`openGroups` is plain `useState({})` with no `localStorage` read/write anywhere I could find ... flagging in case that's news"
- kind: caveat
- artifacts: openGroups, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-012 item 2 content half unbuilt: only the nav change shipped (Dashboard into Management, Inbound removed from nav); the content merge (Inbound dissolving into Leads as contact records) is explicitly out of scope and unbuilt.
- quote: "The content-merge decision itself (Inbound dissolving into Leads as contact records, per the order's latest correction) is explicitly out of scope for this commit and unbuilt."
- kind: deferred
- artifacts: IntakePage.tsx, DashboardPanel.tsx, MANAGEMENT_GROUP
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-012 scope flag: the order said the Add New divider "applies to both rails" but the client rail has no create control at all — divider added only to the staff rail rather than inventing a control.
- quote: "Checked `ClientRail`'s render and found no create control above its list at all ... Added the divider only where a create control actually exists"
- kind: deviation
- artifacts: ClientRail, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-005 correction: the order's Files section lists two files but the named cherry-pick touches three — tailwind.config.js is a hard dependency (the 66% opacity step) and was included.
- quote: "It touches three files, not the two the order's own \"Files\" section lists (`tailwind.config.js` is the third)"
- kind: correction
- artifacts: tailwind.config.js
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-005: the apple-touch-icon PNG was rendered by this machine's Chrome — cannot confirm which font in the Big Caslon stack actually resolved, or how it renders for end users.
- quote: "the apple-touch-icon PNG was rendered by this machine's Chrome, which may or may not have resolved `Big Caslon` the same way an end user's browser/OS will"
- kind: not-verified
- artifacts: public/favicon.svg, apple-touch-icon.png
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-013 selected-fill NOT shipped: cream-25 label on a light-gold fill maxes out at 2.66:1 contrast at any alpha — structurally incompatible, not a tuning problem; NAV_ROW_ACTIVE unchanged, finding documented in a code comment; the coupled badge-on-selected-row change also held pending owner resolution.
- quote: "best case is 2.66:1 at 100% opacity (no blend at all) — the fill and the label color are structurally incompatible, not a tuning problem. `NAV_ROW_ACTIVE` is byte-for-byte unchanged"
- kind: blocked-on-owner
- artifacts: NAV_ROW_ACTIVE, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-014 side effect needs eyes: six NAV_DIVIDER sites went from rendering currentColor (silent T1 failure of border-green-900/12) to the declared faint wash — whether the declared colour reads right at all six sites is unchecked.
- quote: "I only confirmed they went from \"wrong colour\" to \"the declared colour,\" not that the declared colour is definitely right everywhere it's used. Worth a specific look at all six"
- kind: not-verified
- artifacts: NAV_DIVIDER, src/components/app/AppLayout.tsx:827,873,1362,1387,1417,1542, tailwind.config.js (opacity 8/12)
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-015 correction: the order quoted a stale SUBHEADER_BTN (text-sm, md: overrides) — the file had already moved to clamp()-based fluid sizing; the literal instruction was proven a no-op before the clamp ceilings were lowered instead.
- quote: "**the order's quoted \"current state\" of `SUBHEADER_BTN` (lines 72-75) was stale.** ... the order simply described a file that no longer existed by the time I reached it."
- kind: correction
- artifacts: SUBHEADER_BTN, src/components/app/ContractSubheader.tsx
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-016 correction: the order's premise about the "p-3 plus px-3" comment being wrong doesn't hold — the comment describes the staff-rail icon strip and was already correct; left untouched with reasons rather than edited because the order said to.
- quote: "**The order's premise about the flagged comment doesn't hold, and I didn't edit it.** ... the comment was already correct for the code path it actually describes"
- kind: correction
- artifacts: src/components/app/AppLayout.tsx (I1B staff rail icon strip comment), ClientRail
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-017: the signatures section has never been observed rendering WITH content (signing freeze — no live document has signatures or signable state); the by-construction argument substitutes for observation — worth a specific check once the freeze lifts.
- quote: "I have not seen this section render WITH content, before or after this fix, since the signing freeze means no live document has any signatures or signable state to show right now."
- kind: not-verified
- artifacts: #contract-signatures, hasSignatureCardContent, src/components/app/ContractPage.tsx
- decision-mention: none

### ITEM
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-018: the subheader uses width-based md:hover while the nav uses capability-based [@media(hover:hover)] — deliberately different mechanisms; whether the distinction matters needs a real narrow-desktop-window test.
- quote: "these are deliberately different mechanisms for two different components, and only a real narrow-desktop-window test would show whether that distinction matters in practice."
- kind: not-verified
- artifacts: src/components/app/ContractSubheader.tsx, src/components/app/AppLayout.tsx
- decision-mention: none

---

# INVENTORY (unviewed / dead / unreachable / preview-only)

### INVENTORY
- report: TASK-I-REPORT.md
- what: SavedPanel's four hardcoded fake "Saved" items (SEED_SAVED) are now gated behind SEED_ENABLED=false, so the section renders its empty state for all real users; no saved/bookmark table exists anywhere.
- where: src/components/app/AccountPanels.tsx (SavedPanel, SEED_SAVED, SEED_ENABLED)
- quote: "`SavedPanel` now computes `const items = SEED_ENABLED ? SEED_SAVED : []` ... since `SEED_ENABLED = false`, the section now correctly renders its empty state for real users."

### INVENTORY
- report: TASK-PAGETITLES-REPORT.md
- what: seed.ts's FEED_VIEW_META.all.description tagline is now dead for the all-view render path (new copy inlined in Home.tsx; seed.ts is documented as temporary preview-only data marked for deletion).
- where: src/lib/seed.ts (FEED_VIEW_META.all.description), src/pages/app/Home.tsx
- quote: "Old tagline (shipped by TASK-UIPOLISH, `FEED_VIEW_META.all.description` in `seed.ts`) is now dead for the `all` view's render path"

### INVENTORY
- report: TASK-PAGETITLES-REPORT.md
- what: SERVICE_TYPES lookup in serviceCatalog.ts has no consumers anywhere in src/ — dead code; its label string was updated anyway to avoid a contradicting copy.
- where: src/lib/serviceCatalog.ts (SERVICE_TYPES, code HORSE_PURCHASE_ASSISTANCE)
- quote: "Grepped for all consumers of that table/lookup — none exist anywhere in `src/`, so this is dead code"

### INVENTORY
- report: TASK-RECORDS-REPORT.md
- what: DirectoryPage and ContactsPage's 'directory' mode survive with no live route pointing at them, and the deprecated DIRECTORY contact_type is still accepted (zero rows).
- where: src/pages/app/ops/ContactsPage.tsx (DirectoryPage, 'directory' mode), contacts_contact_type_check (DIRECTORY)
- quote: "`DirectoryPage`/`'directory'` mode still exist in `ContactsPage.tsx` (no live route points at them any more, per the split, but the mode and the still-accepted `DIRECTORY` type both survive)."

### INVENTORY
- report: TASK-UIBUILD-LOG.md
- what: UIO-006 avatar open-state options page — a preview-only rendered comparison (three options) awaiting an owner pick; not app code.
- where: docs/reference/uio-006-open-state-options.html
- quote: "Built `docs/reference/uio-006-open-state-options.html` — three options ... until the owner picks from that page."

### INVENTORY
- report: TASK-UIBUILD-LOG.md
- what: UIO-011 hover-and-green evaluation mockup page — preview-only, nothing in src/ touched; explicitly forbids a decision being made from it by the builder.
- where: docs/reference/uio-011-hover-and-green-evaluation.html
- quote: "**Nothing in `src/` touched** ... Built `docs/reference/uio-011-hover-and-green-evaluation.html`, self-contained"

### INVENTORY
- report: TASK-LEASEMAP-REPORT.md
- what: ARENA_SOLO ("Solo Arena Riding") is a dead option — appears in no conditional_on anywhere in HORSE_LEASE_V2; selecting it only changes printed words.
- where: HORSE_LEASE_V2, TXN.PERMITTED_ACTIVITIES option ARENA_SOLO
- quote: "**F1 — `ARENA_SOLO` gates nothing, anywhere.**"

### INVENTORY
- report: TASK-LEASEMAP-REPORT.md
- what: The deductible trigger's OTHER branch clears an explanation field (`<base>_RESP_OTHER`) that does not exist in this template — a dead branch.
- where: contract_split_deductible_sync (`<base>_RESP_OTHER` branch)
- quote: "The deductible trigger contains a branch that clears an explanation field named `<base>_RESP_OTHER` when the selection moves away from `OTHER`; no such field exists in this template."

### INVENTORY
- report: TASK-LEASEMAP-REPORT.md
- what: clause_cut_kept is inert on HORSE_LEASE_V2 (cut_name null on every section/clause) and still tests three fields that do not exist here.
- where: clause_cut_kept; TXN.MORTALITY_INSURANCE_PARTY, TXN.MAJOR_MEDICAL_INSURANCE_PARTY, TXN.LOSS_OF_USE_INSURANCE_PARTY
- quote: "**F4 — `clause_cut_kept` has no effect on this lease.**"

### INVENTORY
- report: TASK-LEASEMAP-REPORT.md
- what: Most of contract_split_deductible_sync is dead code on this template — it references seven fields that do not exist in HORSE_LEASE_V2.
- where: contract_split_deductible_sync; TXN.MORT_ELECTED, TXN.MED_COVERAGE, TXN.MORT_LIMIT, TXN.MORT_DEDUCTIBLE, TXN.MED_DEDUCTIBLE, `<base>_RESP_MODE`, `<base>_RESP_OTHER`
- quote: "**F5 — most of the deductible trigger is dead.** `contract_split_deductible_sync` references seven fields that do not exist in `HORSE_LEASE_V2`"
