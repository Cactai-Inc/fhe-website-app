# FLAGHARVEST batch 5

Assigned files: PROMPT_A_STAGES_1-3.md, TASK-A-PARTY-VERIFY-2-REPORT.md, TASK-CONTRACTORPHAN-REPORT.md, TASK-DOCCOLS-REPORT.md, TASK-DOCPACKET-REPORT.md, TASK-HEADER-REPORT.md, TASK-HORSEDOCS-REPORT.md, TASK-INVITEFLOW-REPORT.md, TASK-PURPOSEFIX-REPORT.md, TASK-SECFIX-REPORT.md, TASK-SECFIX2-REPORT.md, TASK-TEXTEDIT-REPORT.md, TASK-UIPOLISH-REPORT.md

---

## PROMPT_A_STAGES_1-3.md

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: Stages 4 and 5 (U4/U5 hardening + insurance, U7 legacy retirement) were deliberately not started, with conditional owner gates that still stand (Stage 5 drops only if the zero-reader sweep is zero; H2 only if both callers carry authenticated sessions, else stop).
- quote: "Ended at: owner instruction — Stages 4 and 5 deliberately NOT started."
- kind: blocked-on-owner
- artifacts: docs/reports/PROMPT_A_STAGES_1-3.md
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: U2.7(b) golden-render suite is blocked because the PGlite test harness cannot build a database — one broken migration (20260709160000_enforce_launch_modules.sql) fails on an org_modules FK, making every test/db/*.test.ts file unrunnable.
- quote: "U2.7(b) is blocked ... The PGlite harness cannot build a database ... The blocker is one broken migration. Repairing it is its own unit with its own verification, deliberately not improvised here."
- kind: blocked
- artifacts: supabase/migrations/20260709160000_enforce_launch_modules.sql, test/db/harness.ts, test/db/*.test.ts
- decision-mention: D8 (report's internal decision numbering)

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: Correction — BACKLOG's stated cause for the unrunnable DB test suites ("needs a dedicated test database") is wrong; the harness is in-process PGlite and needs no external database.
- quote: "BACKLOG says the suites need \"a dedicated test database\" — **that is wrong**: the harness uses in-process PGlite and needs no external database."
- kind: correction
- artifacts: docs/archive/BACKLOG.md, test/db/harness.ts
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: U2.8 insurance-deductible gating changes are staged as JSON only and must not be applied without the contract review thread's coherence ruling; sequencing is after U5's D1 field defs land.
- quote: "**`docs/staged/U2_8_deductible_gating.json` must not be applied** without the review thread's coherence ruling."
- kind: blocked-on-owner
- artifacts: docs/staged/U2_8_deductible_gating.json, INSURANCE_RISK.GL_DED_SIMPLE, INSURANCE_RISK.MORT_DEDR_SIMPLE, INSURANCE_RISK.MED_DEDR_SIMPLE, HORSE_LEASE_V2
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: Open question for the review thread — the clause-gate engine may not support `not_equals`/`any`; if not, the staged U2.8 gates must use the positive fallback form.
- quote: "the live gates use only `equals` and `all`. If the engine has no `not_equals`/`any`, use the positive form in the JSON's `fallback_form_if_not_equals_unsupported`"
- kind: open question
- artifacts: docs/staged/U2_8_deductible_gating.json
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: U1.5e (NULL notification links) had no live anchor (0 rows), so it was made report-only with a BACKLOG entry for prophylactic hardening of notify_staff/notify_user/mirror_admin_notification.
- quote: "**Owner ruling:** report-only plus a BACKLOG entry for prophylactic hardening."
- kind: deferred
- artifacts: notify_staff, notify_user, mirror_admin_notification, notifications
- decision-mention: D2 (report's internal decision numbering)

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: The intake deep-link is inert — IntakePage.tsx reads no query params, so `?request=<id>` renders but does not deep-link; wiring it is a recorded follow-up in BACKLOG.
- quote: "`IntakePage.tsx` reads no query params, so `?request=<id>` renders fine but does not deep-link ... the deep-link is a recorded follow-up."
- kind: defect
- artifacts: src/pages IntakePage.tsx, docs/archive/BACKLOG.md
- decision-mention: D3 (report's internal decision numbering)

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: U1.6 hostname sweep found two out-of-scope strings reported, not changed: comment hostnames in api/request-received.ts:9 and api/calendar-reminders.ts:8, plus OPS_INBOX_FALLBACK (an email address) at api/calendar-reminders.ts:21.
- quote: "Out of scope, reported: api/request-received.ts:9 (comment), api/calendar-reminders.ts:8 (comment), :21 (OPS_INBOX_FALLBACK, an email address, not a hostname)"
- kind: inventory
- artifacts: api/request-received.ts, api/calendar-reminders.ts
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: The Charles Zigmund duplicate contact pair (07ab7dbf/d268330c) is explicitly NOT merged (d268330c is the live lessor on the reference draft) and two "Unnamed Contact" artifacts (bb57e418, 6ecceaf0) await the pre-launch purge — all recorded in BACKLOG.
- quote: "the Zigmund pair (**explicitly NOT merged** — `d268330c` is the live lessor on the reference sample draft) and the two `Unnamed Contact` artifacts."
- kind: data-integrity
- artifacts: contacts (07ab7dbf, d268330c, bb57e418, 6ecceaf0), docs/archive/BACKLOG.md
- decision-mention: D1 (report's internal decision numbering)

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: R1 — HORSE_LEASE v1 is inactive with 0 documents but still holds 104 body tokens and 98 registry rows; retiring it deletes body text and needs an explicit owner decision.
- quote: "`HORSE_LEASE` v1 is **inactive, 0 documents**, but still holds 104 body tokens and 98 registry rows | retiring it deletes body text"
- kind: blocked-on-owner
- artifacts: HORSE_LEASE (template v1), template_tokens
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: R2 — MINOR_RIDER is active with 0 documents; its GUARDIAN.*/EMERGENCY_CONTACT.* tokens have never been exercised by a real render, and confirming them needs a render, not a table edit.
- quote: "`MINOR_RIDER` is **active, 0 documents**; its `GUARDIAN.*` / `EMERGENCY_CONTACT.*` tokens have never been exercised by a real render | needs a render to confirm"
- kind: not-verified
- artifacts: MINOR_RIDER template, GUARDIAN.* tokens, EMERGENCY_CONTACT.* tokens
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: R3 — HORSE.MARKINGS, HORSE.PASSPORT_NUMBER, HORSE.VET_ADDRESS, HORSE.VET_BUSINESS resolve through a third, code-only resolution path (generate_document's HORSE branch) with no row in either registry mechanism; registering them is an ownership judgement not made.
- quote: "have **no row in either registry mechanism** — a third, code-only resolution path | registering them is a judgement about which mechanism owns them"
- kind: inventory
- artifacts: generate_document, template_tokens, contract_field_defs
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: R4 — HORSE.PASSPORT_COUNTRY and HORSE.REGISTRATION_ORG (audit "offenders") exist only in the dead HORSE_LEASE v1; the finding resolves itself only if R1's retirement proceeds.
- quote: "`HORSE.PASSPORT_COUNTRY`, `HORSE.REGISTRATION_ORG` — audit \"offenders\", but only in dead v1 | resolves itself if R1 proceeds"
- kind: deferred
- artifacts: HORSE_LEASE (template v1)
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: R5 — HORSE_LEASE_V2 has zero template_tokens rows yet renders correctly via contract_field_defs; registering it would be a new convention, not a fix, so nothing was done.
- quote: "`HORSE_LEASE_V2` has **zero** `template_tokens` rows | working as designed via `contract_field_defs`; registering V2 would be a new convention, not a fix"
- kind: inventory
- artifacts: HORSE_LEASE_V2, template_tokens, contract_field_defs
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: HORSE_LEASE v1's HORSE.AGE_DOB label ("Age / Date of Birth") was deliberately left alone when V2's was changed to "Foaling date" — inactive template, never the spec's target.
- quote: "`HORSE_LEASE` v1's `HORSE.AGE_DOB` label (`Age / Date of Birth`) was **deliberately left alone** — inactive template, 0 documents"
- kind: inventory
- artifacts: HORSE_LEASE (template v1), HORSE.AGE_DOB
- decision-mention: none

---

## TASK-A-PARTY-VERIFY-2-REPORT.md

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: `document_parties` has no permissive non-staff read policy, so a genuine party silently gets zero rows from a direct read — blocking the "Contracts you've signed" richer view/download UI; diagnosed, not fixed (needs a dedicated RLS policy migration).
- quote: "**Not fixed here** — this is an RLS/migration change (new permissive SELECT policy needed on `document_parties` for `contact_id = current_contact_id()`), out of scope for in-line patching"
- kind: security
- artifacts: document_parties, document_parties_org_boundary, document_parties_staff_all, listMySignableDocuments
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: A brand-new party cannot redeem a contract invite — redeem_contract_invitation requires an existing profiles row, register-invited.ts creates auth.users directly, and there is no trigger on auth.users to auto-create profiles; owner scoped a deal-only-party account-creation pathway to a separate thread, not built here.
- quote: "**there is no trigger on `auth.users`** to auto-create a matching `profiles` row (confirmed: zero triggers). ... **Owner ruling (scoped to a separate thread, not built here)**"
- kind: defect
- artifacts: redeem_contract_invitation, api/register-invited.ts, profiles, auth.users, redeem_invitation
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: Register.tsx's catch block masks the real activation error behind a generic message because it only reads err.message off JS Error instances, not Postgres/PostgREST error objects.
- quote: "`Register.tsx`'s catch block also masks the real error behind a generic \"We could not finish activating your account\""
- kind: defect
- artifacts: src/pages/Register.tsx
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: CJ's own invite link (existing account) was reported by the owner as landing on a non-functional/"unwired" page — not independently reproduced or root-caused; logged as an open item needing live browser console/network evidence.
- quote: "reported by the owner as landing on a non-functional/\"unwired\" page — not independently reproduced or root-caused; logged as an open item needing live browser evidence"
- kind: not-verified
- artifacts: contract invite redemption page
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: Verification items A3 (party fields mutually inert) and A4 (fully preconfigured, nothing demands review) were blocked by the invite-redemption blocker and never attempted.
- quote: "Depends on a working non-staff party session on the fresh contract, which A2's blocker prevented. Not attempted."
- kind: blocked
- artifacts: none
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: Cold/direct navigation to any /app/... URL fails in the owner's Chrome session (reproduced across fresh tab and restart, not in Safari); suspected auth-bootstrap hang in AuthContext.tsx is plausible but unproven — needs a live repro with devtools open.
- quote: "plausible but unproven without live browser console/network evidence, which wasn't available. ... **Needs live repro with devtools open** to root-cause properly."
- kind: not-verified
- artifacts: src/contexts/AuthContext.tsx, /app/* routes
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: The insurance "not required" checkbox carve-out is working as designed, but the code comment's assumption ("FHE is itself the Lessor") does not hold for a reverse-direction lease; whether staff should ever fill a counterparty's exclusive fields is a product decision left unmade.
- quote: "whether staff should ever fill a counterparty's exclusive fields on their behalf (mirroring the existing barn-office wet-signing precedent) is a product decision, not made here."
- kind: blocked-on-owner
- artifacts: contract_document_detail, TXN.GL_NOT_REQUIRED, TXN.MED_NOT_REQUIRED, TXN.MORT_NOT_REQUIRED
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: The gate chicken-and-egg fix carries an accepted tradeoff — while unanswered, a gate-driving body-inlined field renders twice (live control above, inert placeholder inline); flagged for the upcoming renderer rebuild.
- quote: "**Flagged for the upcoming renderer rebuild**: a gate-driving field should always have exactly one live rendering regardless of where its token lives."
- kind: known issue
- artifacts: src/components/.../ClauseDocument.tsx
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: The document-card status stamp trail ("Complete" badge + chronological Created/Sent/Signed/Sent-to-you stamps, plus a my_resends column on my_documents()) is spec'd only, not built — deferred to a separate build; document_deliveries also lacks a party-facing RLS policy (same gap class as document_parties).
- quote: "Owner request, deferred to a separate build alongside the RLS/invite-provisioning fixes above."
- kind: deferred
- artifacts: my_documents(), document_deliveries, executed-document card
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: UI feedback logged for backlog, not built — the staff Documents queue's "Contract" column (raw contract-id prefix) is wasted space; the owner wants a parties column instead.
- quote: "the \"Contract\" column (raw contract-id prefix) is wasted space; owner wants a parties column instead."
- kind: cosmetic
- artifacts: src/components/ops/documents/DocumentQueueTable.tsx
- decision-mention: none

### ITEM
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: Incident disposition — the premature "Send to both parties" that landed on Sarah Rosengard's real lease (invitation already redeemed) is accepted as a live negotiation going forward; the document is left alone entirely by ruling.
- quote: "left alone entirely. The premature send is accepted as a live, real negotiation going forward; her field permissions were separately unlocked at the orchestrator level."
- kind: process
- artifacts: documents (704c8d2d), src/pages ContractPage.tsx
- decision-mention: none

---

## TASK-CONTRACTORPHAN-REPORT.md

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Part 1 (soft-delete of the two orphaned Beaumont documents) is written and dry-run but deliberately NOT applied — the owner is removing the two documents himself via the panel; the migration remains as the record.
- quote: "**Part 1 stays unapplied by owner ruling 2026-08-11 — the owner is removing those two documents from the panel himself.**"
- kind: blocked-on-owner
- artifacts: supabase/migrations/20260811T1000_contractorphan_delete_orphaned_documents.sql, documents (0360f829, fb6abc6c)
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Side effect to expect before applying Part 1 — once the two orphaned docs are removed, the next ensure_horse_documents call for Beau will regenerate two fresh replacement documents, not leave a permanent absence.
- quote: "it means the owner should expect two fresh documents to appear, not a permanent absence."
- kind: caveat
- artifacts: ensure_horse_documents, RELEASE_HORSE_CARE, HORSE_EMERGENCY_VET
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The session_replication_role=replica data-cleanup practice (which orphaned the contract by disabling RI triggers) is the standing hazard; the recommendation to stop using it on tables with SET NULL/CASCADE children and to anti-join-recheck FKs afterwards is NOT implemented.
- quote: "### Recommendation (not applied — out of this task's scope) `session_replication_role = replica` should not be used for data cleanup on tables with `SET NULL`/`CASCADE` children."
- kind: process
- artifacts: contracts, documents_contract_id_fkey, docs/reports/HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Honest limit stated — it cannot be proven that this specific contract row was deleted in the documented 2026-08-04 replica-mode session (no commit timestamps, no surviving status_events); the causal link is assumed on mechanism + date.
- quote: "**Honest limit:** I cannot prove that this specific contract row was deleted in that specific session."
- kind: not-verified
- artifacts: contracts (ae4ffe95)
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Related live hazard noted — hard_delete_contract is the one routine non-superuser path that removes a contracts row; any future work running it under session_replication_role=replica reproduces the exact orphaning failure.
- quote: "any future work that runs it under `session_replication_role = replica` reproduces this exact failure."
- kind: known issue
- artifacts: hard_delete_contract
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The armed FK hazard is not specific to signing — any staff action producing a second same-transaction update on the orphaned documents aborts (observed live on archive_contract during a tier-1 dry run).
- quote: "the archive was the **second same-transaction update** — the exact mechanism Part 1 describes, now observed on a real code path rather than reasoned about."
- kind: defect
- artifacts: documents_contract_id_fkey, archive_contract, set_recipient_editing
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The document-integrity panel's render was never seen — no staff browser session; only RPC output, component source, and bundle strings were checked.
- quote: "**The render.** I have no staff browser session and was not given one. I have not seen this panel draw."
- kind: not-verified
- artifacts: src/components/ops/DocumentIntegrityPanel.tsx, src/pages/app/ops/OversightPage.tsx, document_integrity()
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The signing flow succeeding after cleanup was not observed — the signing freeze is in force, so the reasoning (path not reached rather than fixed) is explicit but untested; nothing in the task lifts the freeze.
- quote: "**The signing flow succeeding after cleanup.** The signing freeze is in force, so I could not observe a signature. ... **Nothing here lifts the freeze.**"
- kind: not-verified
- artifacts: cleanup_document, signing flow
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: profiles.contact_id on admin@cactai.io (contact 8795c065) is still present — the remaining open D1 violation, confirmed and deliberately left for its own task because it touches identity plumbing.
- quote: "**`profiles.contact_id` on `admin@cactai.io`.** ... Confirmed still present. Left alone."
- kind: blocked-on-owner
- artifacts: profiles, contacts (8795c065), admin@cactai.io
- decision-mention: D1a

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The bare NULL-guard idiom regenerates (can_cleanup_document itself was written into the class during NOGUARD3's session; census drifted 48→63); a lint/CI check on `has_staff_access() AND … = current_org()` outside a coalesce is proposed, not done.
- quote: "Nothing in this task stops the next one being written the same way. A lint or a CI check ... would; that is a proposal, not something done here."
- kind: process
- artifacts: has_staff_access(), current_org(), CI
- decision-mention: D1a

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The missing-fields check (now key-based) fires only on absent keys; the stale-keys-held side (26–27 stale fields on the two flagged docs) is surfaced in the message but is arguably a second defect worth its own check.
- quote: "It would also surface the stale-key side, which is arguably a second defect worth its own check."
- kind: open question
- artifacts: document_integrity(), contract_field_defs, DOC-RXW6U9M3BF, DOC-U4PZP54FP5
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Assumption stated — contract_field_defs keyed by template_key as the definition of "fields the template defines" reproduces NOGUARD2's numbers but the intent itself was not verified.
- quote: "It reproduces the NOGUARD2 numbers exactly (22 and 3), which is strong corroboration but is not the same as having verified the intent."
- kind: not-verified
- artifacts: contract_field_defs, document_integrity()
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Worktree incident — mid-task the worktree was swept of all untracked/ignored files including two uncommitted migration files (one already applied to prod); the file was rewritten and proven byte-identical, and migrations are now committed immediately after applying.
- quote: "Mid-task the worktree was swept of all untracked and ignored files: `.env`, `.env.db`, `node_modules` and two uncommitted migration files, one of which (`…T1250…`) had already been applied to production."
- kind: process
- artifacts: supabase/migrations/20260811T1250_contractorphan_missing_fields_by_key.sql
- decision-mention: none

### ITEM
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Self-correction on the record — the earlier claim that the has_staff_access gate was uniformly correct was wrong; can_cleanup_document returned NULL for the platform owner and cleanup_document's RAISE fell through, a live D1-violating hole (fixed with coalesce in §NULL).
- quote: "Stating the gate as uniformly correct was wrong. Fixed and proven below."
- kind: correction
- artifacts: can_cleanup_document, cleanup_document
- decision-mention: D1a

---

## TASK-DOCCOLS-REPORT.md

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: Correction to the task doc's arithmetic — its "37" same-contact pairs is really 29 in the queue, because 8 pairs belong to soft-deleted documents the queue's deleted_at filter already excludes; flagged explicitly rather than silently proving a different number.
- quote: "The number the report proves below is **29**, the one actually reachable in this queue; I'm flagging the arithmetic explicitly"
- kind: correction
- artifacts: document_parties, documents, listDocuments()
- decision-mention: none

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: Correction — the task names party_role='FHE' as the company marker, but FHE has 0 rows; keying on it would miss all 4 real company-as-LESSEE occurrences, so contacts.is_company is used instead.
- quote: "keying \"render as company\" off `party_role = 'FHE'` would silently miss all 4 real occurrences today."
- kind: correction
- artifacts: document_parties, contacts.is_company, src/lib/ops/partyDisplay.ts
- decision-mention: none

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: The role-rank ordering beyond LESSOR/LESSEE and the CLIENT/PARTICIPANT special case is a best-effort total order over roles with zero production rows (SELLER/BUYER, RIDER, OWNER, CONTRACTOR, FACILITY_CONTACT, EMERGENCY_CONTACT, PARENT, GUARDIAN) — declared unexercised, worth an owner look before load-bearing.
- quote: "If any of these starts appearing paired with another role, the generic rank-order branch decides party 1/2 — untested against real data, and worth a second look from the owner before it's load-bearing."
- kind: not-verified
- artifacts: src/lib/ops/partyDisplay.ts, document_parties
- decision-mention: none

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: deriveDocumentParties keeps only the two highest-ranked contacts and silently drops any beyond two — a limitation with no live data to prove or disprove the branch.
- quote: "keeps the two highest-ranked contacts and drops any beyond that if it ever happens ... Flagged as a limitation, not a proven behavior."
- kind: caveat
- artifacts: src/lib/ops/partyDisplay.ts
- decision-mention: none

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: The company contact renders as plain text with no link because it has no reachable record page (contact_type='TEAM' fails admin_client_accounts arm 3's type check on purpose) — reported rather than emitting a dead link.
- quote: "the one person-shaped party with no reachable record page (the company) is reported here rather than emitting a dead link"
- kind: inventory
- artifacts: admin_client_accounts(), contacts (company contact), PartyCell
- decision-mention: none

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: The is_admin() gate on admin_client_accounts was not re-verified end-to-end — no staff JWT exists in the environment; only the structural WHERE conditions of each arm were checked against the 17 party contacts.
- quote: "**The `is_admin()` gate itself I did not touch or re-verify end-to-end** — that's a render-level check this environment can't perform"
- kind: not-verified
- artifacts: admin_client_accounts(), is_admin()
- decision-mention: none

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: The default-on date column choice (Date Signed, with Date Sent/Voided defaulting off) is an interpretive call on an under-specified spec point, flagged for owner veto.
- quote: "This is an interpretive call on an under-specified point, not a literal instruction; flagging it so the owner can veto if Sent/Voided were meant to default on too."
- kind: blocked-on-owner
- artifacts: src/components/ops/documents/DocumentQueueTable.tsx
- decision-mention: none

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: The horizontal-overflow bug is expected to be visibly worse with more columns toggled on — no scroll container exists at any level; that is TASK-FRAMESCROLL's fix and was deliberately not built here.
- quote: "**Expect the horizontal-overflow bug to be visibly worse than before** ... This is `TASK-FRAMESCROLL`'s fix; not built here per the task's explicit instruction."
- kind: known issue
- artifacts: src/components/ops/kit/DataTable.tsx, DocumentQueueTable.tsx
- decision-mention: none

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: Column-visibility persistence went to localStorage keyed per user (a display preference, no DB table) — a call the task allowed the implementer to make; recorded.
- quote: "This is a display preference, not tenant data — per the task's own explicit allowance to make this call and say so if I disagreed."
- kind: process
- artifacts: DocumentQueueTable.tsx, localStorage docQueue.columns.${user_id}
- decision-mention: none

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: One new react-refresh/only-export-components lint warning on DocumentQueueTable.tsx — same class already present on ~15 other files for the same reason.
- quote: "one new `react-refresh/only-export-components` warning on `DocumentQueueTable.tsx`, same class already present on ~15 other files"
- kind: cosmetic
- artifacts: src/components/ops/documents/DocumentQueueTable.tsx
- decision-mention: none

### ITEM
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: Render NOT VERIFIED — no staff browser session; a 10-point owner click-through checklist is provided (party columns, links, parent/dependent labels, column menu, version-drift note, etc.).
- quote: "**Render: NOT VERIFIED.** No staff browser session exists in this environment. Checklist above."
- kind: not-verified
- artifacts: /app/ops/documents, DocumentQueueTable.tsx
- decision-mention: none

---

## TASK-DOCPACKET-REPORT.md

### ITEM
- report: TASK-DOCPACKET-REPORT.md
- date: 2026-08-11
- item: Pre-existing defect found, not fixed — Admin.tsx's Documents tab calls docDisplayLabel without currentStatus, so a superseded document displays as plain "Signed" and the packet's "X of Y signed" count can overstate by one for anyone mid-re-sign (CJ Z's live case).
- quote: "it means the count can currently overstate \"signed\" by one for anyone mid-re-sign ... Worth its own follow-up task; out of scope here"
- kind: defect
- artifacts: src/pages/app/Admin.tsx, docDisplayLabel, src/lib/documentStatus.ts
- decision-mention: none

### ITEM
- report: TASK-DOCPACKET-REPORT.md
- date: 2026-08-11
- item: Authenticated browser click-through not done — worktree .env holds placeholder Supabase creds, no way to load /app/admin as staff; a visual pass by someone with a real staff session is recommended before considering this closed.
- quote: "Recommend an owner or thread with a real staff session give the Documents tab one visual pass before this is considered fully closed."
- kind: not-verified
- artifacts: src/pages/app/Admin.tsx, admin_client_documents
- decision-mention: none

### ITEM
- report: TASK-DOCPACKET-REPORT.md
- date: 2026-08-11
- item: Open owner item — pick the packet display name ("Onboarding Packet" current default vs "Onboarding Documents" or other); one string constant DOCUMENT_PACKET_NAME in Admin.tsx.
- quote: "**Packet name.** Pick between \"Onboarding Packet\" (current default) and \"Onboarding Documents,\" or supply different wording"
- kind: blocked-on-owner
- artifacts: src/pages/app/Admin.tsx (DOCUMENT_PACKET_NAME)
- decision-mention: none

### ITEM
- report: TASK-DOCPACKET-REPORT.md
- date: 2026-08-11
- item: admin_client_documents keeps its pre-existing PUBLIC EXECUTE grant — grants were restored byte-for-byte and no REVOKE was added; tightening its access posture is flagged as a separate decision not made here.
- quote: "**No REVOKE was added** — tightening that function's access posture is a separate, unrelated decision and wasn't made here."
- kind: security
- artifacts: admin_client_documents(uuid), supabase/migrations/20260811T1300_docpacket_admin_documents_wall_gating.sql
- decision-mention: none

---

## TASK-HEADER-REPORT.md

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The cardstock header was never seen inside the running app (no Supabase credentials) — dropdown MenuLink targets, admin/staff/superadmin branches against real useAuth, and the header above real content rest on code reading; click-through wanted before merge.
- quote: "**I never saw this inside the running app.** No Supabase credentials, so I could not sign in. ... **Worth a click-through before merge.**"
- kind: not-verified
- artifacts: src/components/app/CardstockHeader.tsx, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: No real-device verification — iOS tap-highlight suppression, -webkit-touch-callout, safe-area insets beside a notch, touchcancel/drag-off release, and iOS feGaussianBlur behaviour are all unverified (code is the reference's verbatim).
- quote: "Not verified on real hardware: iOS tap-highlight suppression, `-webkit-touch-callout`, `env(safe-area-inset-*)` behaviour beside a notch"
- kind: not-verified
- artifacts: src/components/app/header-cardstock.css, CardstockHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The @supports-not backdrop-filter fallback path was never exercised (Chrome always rendered the glass branch).
- quote: "**The `backdrop-filter` fallback path** (`@supports not …`) was not exercised — Chrome supports `backdrop-filter`, so only the glass branch rendered."
- kind: not-verified
- artifacts: header-cardstock.css, NAV_GLASS
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Sub-perceptual pixel residue below 1024px (≤4/255 on ~0.25% of pixels, bottom-left corner) attributed to rasterisation; cause not isolated further.
- quote: "I did not isolate the cause further; at 2/255 it is not visible."
- kind: cosmetic
- artifacts: CardstockHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Flagged for TYPEPASS, not fixed — Libre Caslon Text ships only 400 and 700; the app's font-medium (500) on .heading-display/.heading-section/.heading-card will synthesise or snap to 400, and those rules' Cormorant-justifying comments are dead; weights need re-picking.
- quote: "**Libre Caslon Text ships 400 and 700 only — there is no 500.** ... that rationale is dead and the weights need re-picking."
- kind: known issue
- artifacts: src/index.css, tailwind.config.js
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Flagged for TYPEPASS — Libre Caslon runs larger/heavier than Cormorant at the same px, so headings across the app will read bigger than before.
- quote: "Libre Caslon runs larger and heavier than Cormorant at the same px, so headings across the app will read bigger than before."
- kind: known issue
- artifacts: src/index.css, tailwind.config.js
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Flagged for TYPEPASS — the app-wide `-webkit-font-smoothing: antialiased` on <html> is measurably thinning display type and is worth revisiting.
- quote: "`-webkit-font-smoothing: antialiased` on `<html>` is worth revisiting app-wide now that it is measurably thinning display type."
- kind: known issue
- artifacts: src/index.css
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The account dropdown's max-h-[calc(100dvh-5rem)] still assumes the old 3.5rem header and can overflow by ~12px under the 88px phone header — left alone (scrolls internally), trivially retunable with --cs-hdr-h.
- quote: "With an 88px header on a phone it can overflow by ~12px. Left alone (it scrolls internally); trivial to retune with `--cs-hdr-h`."
- kind: cosmetic
- artifacts: AppLayout.tsx (account dropdown)
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Flagged for PLUSPASS — a regular member now has no create affordance in the header at all (old + button gone, Create tab admin/staff-only, hidden on mobile even for staff); a live gap until page-level + controls land.
- quote: "a regular member now has **no create affordance in the header at all** ... until then it is a live gap."
- kind: known issue
- artifacts: CardstockHeader.tsx, CreateModal
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: At ≤404px the header content overflows the viewport (~2.6px avatar clip at 390px) — faithfully reproduced from the mockup, not "improved"; flagged for the owner's judgement since it is real on the most common phone width.
- quote: "At **≤404px the header content overflows the viewport.** ... **The mockup does exactly the same thing** — I reproduced it faithfully rather than \"improving\" it"
- kind: blocked-on-owner
- artifacts: CardstockHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The cardstock sheet runs edge-to-edge with no max-w-[120rem] cap unlike the old header — the wordmark centres across the full viewport on ultrawide; flagged as a visible change per the mockup.
- quote: "The cardstock sheet runs edge-to-edge with no `max-w-[120rem]` cap, unlike the old header. ... flagging since it is a visible change."
- kind: cosmetic
- artifacts: CardstockHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The drawer pops in instantly while its tab slides over .28s (drawer conditionally mounted, no transition) — not touched per the doc; a drawer transition would make the pair read as one motion.
- quote: "The mockup's drawer pops in instantly while the tab slides out over .28s ... I did not touch the drawer, per the doc."
- kind: cosmetic
- artifacts: AppLayout.tsx (drawer), CardstockHeader.tsx (drawer tab)
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The header drop shadow shipped as-is, deferred for owner judgement against real scrolling content.
- quote: "Header drop shadow shipped as-is (`0 6px 18px rgba(24,38,32,.14)`), deferred for judgement against real scrolling content."
- kind: blocked-on-owner
- artifacts: header-cardstock.css
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The reference mockup file itself is defective — its inline script runs before the DOM nodes exist, throws, and none of the drawer or modal behaviour works in the checked-in reference; not edited, flagged for fixing in the mockup.
- quote: "it throws `Cannot read properties of null` and **none of the drawer or modal behaviour works in the reference as checked in**. Only the avatar press physics run."
- kind: defect
- artifacts: docs/reference/header-mockup.html
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Deviation flagged for owner eyes — the mockup's Create-tab background never renders (scaleY(-1) maps the layer outside the clip); a translateY(-100%) was added ahead of the flip, the one behavioural change to a mockup value.
- quote: "This is the one behavioural change to a mockup value, and it is the item most worth your eyes."
- kind: deviation
- artifacts: header-cardstock.css (.tab::after), CardstockHeader.tsx
- decision-mention: none

### ITEM
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Design call left open — the header marks name 'Libre Caslon Text' directly rather than the app's font-display token (Big Caslon first); whether the header should pick up Big Caslon on macOS is flagged as a design decision, not a porting one.
- quote: "**Flagging in case you want the header to pick up Big Caslon on macOS too — that is a design call, not a porting one.**"
- kind: blocked-on-owner
- artifacts: header-cardstock.css (.cs-wordmark/.cs-fh/.cs-av), tailwind.config.js
- decision-mention: none

---

## TASK-HORSEDOCS-REPORT.md

### ITEM
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: Reported, not fixed (owner-instructed) — apply_document_supersession matches on contact_id + template_key with no horse_id comparison; now that horse documents are horse-bound, executing a vet authorization for one horse will mark the executed authorization for a different horse owned by the same contact superseded. CJ Z's second horse-bound execution is the trigger. Needs its own spec.
- quote: "The predicate is **contact_id + template_key with no `horse_id` comparison**. ... It stops being harmless the moment they are — which is the state this fix now produces."
- kind: defect
- artifacts: apply_document_supersession, documents, HORSE_EMERGENCY_VET, RELEASE_HORSE_CARE
- decision-mention: none

### ITEM
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: The horse_id-comparison spec must answer the NULL case — a naive horse_id predicate would mean Sarah's retained horse-blank documents are never superseded by their horse-bound replacements, leaving her two live documents per template indefinitely; IS NOT DISTINCT FROM answers neither direction correctly.
- quote: "with `horse_id` added naively, Sarah's retained horse-blank documents would **never** be superseded by the horse-bound replacements ... That is the case to design for."
- kind: open question
- artifacts: apply_document_supersession, documents (152912dd, a8623897)
- decision-mention: none

### ITEM
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: No browser click-through — the Documents page showing one retained signed document plus its pending replacement side by side is the visible face of the skip-and-supersede decision and is untested.
- quote: "**Browser click-through** of the Documents page with one retained signed document plus one pending replacement for the same template. Untested; it is the visible face of this decision."
- kind: not-verified
- artifacts: Documents page, ensure_horse_documents
- decision-mention: none

### ITEM
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: The staff-caller branch of ensure_horse_documents was not exercised — what a staff caller sees differently was not verified.
- quote: "I did not verify what a **staff** caller sees differently; the authorization branch was not exercised for `has_staff_access() = t`."
- kind: not-verified
- artifacts: ensure_horse_documents
- decision-mention: none

### ITEM
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: Leftover unmerged tokens ({{HORSE.MICROCHIP}}, {{HORSE.FARRIER_NAME}}, {{CLIENT.EMERGENCY_CONTACT_2_NAME}}, …) sit in the two retained signed bodies — a separate pre-existing merge gap, observed only; the executed documents must not be rewritten to fix it.
- quote: "**Leftover merge tokens** in the two retained bodies ... a separate merge gap, observed only. Those two documents are executed evidence and must not be rewritten to fix it."
- kind: defect
- artifacts: documents (152912dd, a8623897), generate_document merge path
- decision-mention: none

### ITEM
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: Data-integrity observation behind the supersede decision — both retained signed documents merged with an EMPTY Horse Name (token substituted with empty string, horse_id NULL, zero document_horses rows): signed vet authorizations for no identified horse.
- quote: "They are signed authorizations for **emergency veterinary care of no identified horse**."
- kind: data-integrity
- artifacts: documents (152912dd, a8623897), HORSE.REGISTERED_NAME
- decision-mention: none

---

## TASK-INVITEFLOW-REPORT.md

### ITEM
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: Process failure recorded — the migration carried its own BEGIN/COMMIT, so the house dry-run wrapper's ROLLBACK hit no transaction and the "dry" run applied to production for real, before verification; psql warned twice and the warnings were missed.
- quote: "the \"dry\" run applied for real, and the `ROLLBACK` hit no transaction. psql said so twice ... and I should have stopped on the first warning."
- kind: process
- artifacts: supabase/migrations/20260810T1730_inviteflow_category_is_evidence.sql
- decision-mention: none

### ITEM
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: Six test contacts/clients/invitations (cjzigs+r/+h/+rh/+ro/+ho/+rho@icloud.com) and purchases PUR-000063/64/65 were deliberately left in production, awaiting the owner's word to purge.
- quote: "Created deliberately for these runs; **no email was sent** ... Say the word and I'll purge them."
- kind: blocked-on-owner
- artifacts: contacts, clients, invitations, purchases (PUR-000063, PUR-000064, PUR-000065)
- decision-mention: none

### ITEM
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: The email delivery leg of the invite flow is untested — SMTP and service-role credentials live in Vercel, not locally; one invite sent from the UI would prove it end to end.
- quote: "**The email leg** — one invite sent from the UI would prove it end to end."
- kind: not-verified
- artifacts: api/admin-send-invitation.ts
- decision-mention: none

### ITEM
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: api/admin-send-invitation.ts:229 catches everything and returns a flat "could not create invitation" — the same error-discarding pattern the horse form had; worth the same fix.
- quote: "`api/admin-send-invitation.ts:229` catches everything and returns a flat `\"could not create invitation\"`. Same discard the horse form had; worth the same fix."
- kind: defect
- artifacts: api/admin-send-invitation.ts
- decision-mention: none

### ITEM
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: Queued, not started — the invite page fields, the booking calendar, the contact-record edit mode, and the "File Under" row.
- quote: "The invite page fields, the booking calendar, the contact-record edit mode, and the \"File Under\" row — queued, not started."
- kind: deferred
- artifacts: invite page, booking calendar, contact-record edit mode
- decision-mention: none

### ITEM
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: Two self-corrections on the record — Claire Bourdon self-healed (category-less ~45 minutes, not permanently) and the nine riders were never at risk (RIDER derives from 4 executed documents each); earlier claims were wrong.
- quote: "**The nine riders were never at risk.** ... I said they would lose it at activation; that was wrong."
- kind: correction
- artifacts: derive_affiliations, groups
- decision-mention: none

---

## TASK-PURPOSEFIX-REPORT.md

### ITEM
- report: TASK-PURPOSEFIX-REPORT.md
- date: 2026-08-11
- item: Correction to the task premise — the Purpose-of-Agreement defect was already fixed by prior merged work (SEEDFIX migration 2026-08-05 + ClauseDocument R1/ownership fixes); no code change was made because none was needed, a genuine "already done" finding.
- quote: "**both halves of the mechanism were already corrected by prior, already-merged work**, on the same day the defect was reported"
- kind: correction
- artifacts: supabase/migrations/20260805170000_seedfix_can_edit_deal_default.sql, ClauseDocument.tsx, ContractPage.tsx, TXN.LEASE_PURPOSE
- decision-mention: none

### ITEM
- report: TASK-PURPOSEFIX-REPORT.md
- date: 2026-08-11
- item: The task's named test document (9a56b738, AVERIFY2 lease) was already VOID from a prior cleanup, so the live proof used a fresh disposable test document instead; Beaumont-referencing documents were deliberately avoided due to the separate TASK-SUPERSEDE armed defect.
- quote: "The task's named test document ... turned out to already be **VOID** — voided 2026-08-06 by a prior cleanup task"
- kind: correction
- artifacts: documents (9a56b738, b7233813), start_lease_contract_v2
- decision-mention: none

### ITEM
- report: TASK-PURPOSEFIX-REPORT.md
- date: 2026-08-11
- item: Lint baseline discrepancy — task doc states 29 warnings, the branch point measures 35 with zero src changes; the 29 figure appears stale, flagged rather than silently reporting "matches baseline".
- quote: "the 29 figure appears to be stale relative to `origin/main`'s current state ... Flagging the discrepancy rather than silently reporting \"matches baseline.\""
- kind: correction
- artifacts: eslint baseline
- decision-mention: none

### ITEM
- report: TASK-PURPOSEFIX-REPORT.md
- date: 2026-08-11
- item: No browser access — the UI proof is a code-cited claim backed by a jsdom DOM render of ClauseDocument against production fixture data (six combinations, select never disabled), not a visual verification; Sarah's document actionability is reasoned from code, not seen.
- quote: "This is not a claim of visual verification — it is a reproducible, code-cited claim backed by an actual DOM render"
- kind: not-verified
- artifacts: ClauseDocument.tsx, TXN.LEASE_PURPOSE, documents (704c8d2d)
- decision-mention: none

---

## TASK-SECFIX-REPORT.md

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Open item needing a decision — member_directory could not take security_invoker (directory collapses 6→1 for ordinary members because base-table RLS is self-only); anon SELECT was revoked instead, but the view still executes with postgres rights and bypasses RLS for any caller that can reach it. Options: directory-scoped SELECT policies then invoker on, or convert to a SECURITY DEFINER RPC.
- quote: "`member_directory` still executes with `postgres`'s rights and still bypasses RLS for any caller that can reach it. **Decision needed**"
- kind: security
- artifacts: member_directory, profiles, contacts, src/lib/community.ts
- decision-mention: none

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: The task doc's literal S2 fix (REVOKE UPDATE (contact_id) ... FROM authenticated) is a silent no-op against a table-level grant — PostgreSQL reports success while the takeover still works; the real fix drops the table-level grant and re-grants 28 columns.
- quote: "Because the grant is **table-level**, a column-scoped REVOKE does nothing — and PostgreSQL reports success"
- kind: correction
- artifacts: profiles, supabase/migrations/20260807120000_secfix_s2_profiles_contact_id_grant.sql
- decision-mention: none

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: The task doc's literal S3 fix is also a silent no-op — revoking EXECUTE from anon alone leaves the PUBLIC grant on _ensure_client_account; PUBLIC must be revoked too.
- quote: "So `REVOKE … FROM anon` would have committed cleanly and left `anon` able to execute. PUBLIC must go too."
- kind: correction
- artifacts: _ensure_client_account, supabase/migrations/20260807140000_secfix_s3_ensure_client_account_execute.sql
- decision-mention: none

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Reported, not fixed — anon still holds the same table-level INSERT/UPDATE grant on profiles (dormant, blocked by RLS since anon has no auth.uid()); recommended as defence-in-depth revoke, deliberately outside S2's revert unit.
- quote: "**`anon` holds the same table-level INSERT/UPDATE grant on `profiles`.** Dormant today: RLS refuses both ... My read is that it should be revoked as defence in depth; it is not urgent."
- kind: security
- artifacts: profiles (anon grants)
- decision-mention: none

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Reported, not examined — anon also holds table-level DELETE/INSERT/UPDATE on profiles more broadly, and authenticated holds DELETE; out of S2's scope.
- quote: "**`anon` also holds table-level DELETE/INSERT/UPDATE on `profiles`** more broadly, and `authenticated` holds DELETE. Same reasoning as above — out of S2's scope, unexamined."
- kind: security
- artifacts: profiles (DELETE grants)
- decision-mention: none

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Noticed while checking callers, not examined — redeem_gift and ensure_gift_buyer_account are PUBLIC-executable (=X/postgres in their ACLs), the same shape as S3 and worth a look. (ensure_gift_buyer_account was subsequently closed by SECFIX2 G1.)
- quote: "**`redeem_gift` and `ensure_gift_buyer_account` are PUBLIC-executable** ... the same shape as S3 and worth a look."
- kind: security
- artifacts: redeem_gift, ensure_gift_buyer_account
- decision-mention: none

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Everything the task doc lists under "Also found by ACCTEVAL — NOT in this task" remains untouched.
- quote: "Everything under \"Also found by ACCTEVAL — NOT in this task\" remains untouched."
- kind: deferred
- artifacts: ACCTEVAL findings list
- decision-mention: none

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Correction narrowing the task doc — inbound_queue's staff_notes column is exposed to anon, but every row's value is an empty JSON array today, so no note text is actually readable; emails and phone numbers are real and readable.
- quote: "The `staff_notes` *column* is exposed, but every row's value is an empty JSON array (`[]`) today, so no note text is actually readable right now."
- kind: correction
- artifacts: inbound_queue
- decision-mention: none

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Accepted maintenance consequence of S2 — the profiles grant is now an explicit 28-column list, so a column added to profiles later will not be writable by authenticated until it is added to the grant; fails visibly on write.
- quote: "a column added to `profiles` later will not be writable by `authenticated` until it is added there. That fails visibly on write rather than silently reopening the hole."
- kind: caveat
- artifacts: profiles, 20260807120000_secfix_s2_profiles_contact_id_grant.sql
- decision-mention: none

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Scope deviations stated plainly — S2 also revoked INSERT of contact_id (second verb of the same hole, made live by the missing auth.users→profiles trigger), and S3 also revoked authenticated's EXECUTE; both flagged rather than done quietly.
- quote: "I did that, and **also** revoked INSERT of the same column from the same role, because it is the same hole reached through a second verb"
- kind: deviation
- artifacts: profiles, _ensure_client_account
- decision-mention: none

### ITEM
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: A false alarm chased down and put on record — the first P7 check showed contact_linked=f and looked like a caused lockout; the real cause was the test SQL's own RLS-filtered subquery, proven by a pre-migration control run.
- quote: "Reporting it because \"verify before asserting\" is the standing rule here and the first reading was wrong."
- kind: process
- artifacts: ensure_contact_for_profile, profiles_link_contact
- decision-mention: none

---

## TASK-SECFIX2-REPORT.md

### ITEM
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: Correction to the task brief — nothing calls ensure_gift_buyer_account at all (not even other DB functions, verified four ways); it is dead code in production, so the revoke cannot break a gift flow.
- quote: "**1. Nothing calls this function at all.** The brief said \"only other database functions do\". None do. ... The function is dead code in production"
- kind: correction
- artifacts: ensure_gift_buyer_account, redeem_gift, _ensure_client_account
- decision-mention: none

### ITEM
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: Nuance recorded, not acted on — redeem_gift's anon grant is harmless because of its own in-body auth.uid() guard, not because anon needs it; the brief's stated justification for keeping the grant is not the real one. Not revoked per instruction.
- quote: "the grant is harmless, but it is harmless because of the guard, not because anon needs it."
- kind: correction
- artifacts: redeem_gift, src/pages/Redeem.tsx, src/lib/gifts.ts
- decision-mention: none

### ITEM
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: Decision deliberately not made — member_directory_list gates on authenticated, not membership, so a non-member account holder can still read the directory; there is a pre-existing drift between D8 (community = account-gated) and is_active_member() gating the other community tables; one-line change offered if the owner rules members-only.
- quote: "There is a genuine drift here between D8 (community = account-gated) and the implementation (`is_active_member()` gates the other community tables). ... resolving it is an owner call."
- kind: blocked-on-owner
- artifacts: member_directory_list(uuid), is_active_member()
- decision-mention: D8

### ITEM
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: No browser click-through — /app/community and member profile pages were not loaded; the React layer having nothing new to handle is reasoning, not observation.
- quote: "**No browser click-through.** ... but that is reasoning, not observation."
- kind: not-verified
- artifacts: /app/community, src/lib/community.ts, MemberProfile.tsx
- decision-mention: none

### ITEM
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: PostgREST schema-cache reload not verified — if member_directory_list 404s from the client immediately after deploy, `NOTIFY pgrst, 'reload schema'` is the fix; PostgREST was not restarted or poked.
- quote: "If `member_directory_list` 404s from the client immediately after deploy, `NOTIFY pgrst, 'reload schema';` is the fix. I did not restart or poke PostgREST."
- kind: not-verified
- artifacts: member_directory_list(uuid), PostgREST
- decision-mention: none

### ITEM
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: The 3 non-member accounts (aaaa1111-…0001/2/3) look like seed rows from their uuids but were not confirmed to be test data rather than real people.
- quote: "**The 3 non-member accounts** ... look like seed rows from their uuids. I did not confirm they are test data rather than real people."
- kind: not-verified
- artifacts: profiles (aaaa1111-0000-4000-8000-000000000001/2/3)
- decision-mention: none

---

## TASK-TEXTEDIT-REPORT.md

### ITEM
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Browser render NOT VERIFIED — no staff session; a 10-point owner checklist covers the templates list, trio banner, draft chips, publish modal, token picker insertion/badges, flat editor, discard, and the non-admin bounce.
- quote: "## NOT VERIFIED — browser render (no staff session exists)"
- kind: not-verified
- artifacts: /app/ops/admin/templates, AdminTemplatesPage.tsx, AdminTemplateEditorPage.tsx, TokenPicker.tsx
- decision-mention: none

### ITEM
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: The nav diff was NOT applied because AppLayout.tsx is contended — the page sits under the Review section via REVIEW_GROUPS; on acceptance, move it with a one-line SETTINGS_GROUP addition (diff supplied).
- quote: "## The nav diff — NOT applied (AppLayout.tsx is contended)"
- kind: deferred
- artifacts: src/components/app/AppLayout.tsx, src/lib/reviewSection.ts
- decision-mention: none

### ITEM
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Noted for the next reader, not a bug — resolve_version_decision returns 0 rows-affected on NONE resolutions because its return counts re-sign obligations created, rightly zero.
- quote: "the return counts *re-sign obligations created*, which for `NONE` is rightly zero. Not a bug; noting so the next reader doesn't chase it."
- kind: caveat
- artifacts: resolve_version_decision
- decision-mention: none

### ITEM
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: The token picker surfaces TOKENAUDIT's data as-is — the 59 source-retired tokens and the {{ORD.UUID}}→documents.id mislabel remain in template_tokens; they are TOKENAUDIT's open recommendations, deliberately not deleted here.
- quote: "59 `source retired` tokens and the `{{ORD.UUID}}`→`documents.id` mislabel remain in `template_tokens` — display is honest, the underlying rows are TOKENAUDIT's open recommendations, deliberately not deleted here."
- kind: deferred
- artifacts: template_tokens, ORD.UUID, TokenPicker.tsx
- decision-mention: none

### ITEM
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: HORSE_REPRESENTATION and MEDIA_RELEASE are inactive flat templates with empty bodies (beyond the two active empties the task names) — editable in the tool like any other flat; surfaced, no action taken.
- quote: "`HORSE_REPRESENTATION` and `MEDIA_RELEASE` are inactive flats with empty bodies (beyond the two active empties the task names)"
- kind: inventory
- artifacts: HORSE_REPRESENTATION, MEDIA_RELEASE, contract_templates
- decision-mention: none

### ITEM
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: FACILITY_LICENSE and INDEPENDENT_CONTRACTOR are ACTIVE templates with empty live bodies — flagged in the editor list with a red "empty body" badge; the bodies themselves remain empty.
- quote: "red \"empty body\" on the two empty actives"
- kind: data-integrity
- artifacts: FACILITY_LICENSE, INDEPENDENT_CONTRACTOR, contract_templates
- decision-mention: none

### ITEM
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Out of scope, said and not built — email templates are still hardcoded in api/ and must be extracted before they can be edited; also out: clause/section/field add-remove-reorder, render/layout, the Form engine, archive/delete controls, and clause headings.
- quote: "email templates (still hardcoded in `api/`, must be extracted first)"
- kind: deferred
- artifacts: api/ email templates, contract_clause_defs headings
- decision-mention: D12

### ITEM
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Honest prod side-effect of the proof — the lease trio's version is now 3 (two bumps for a byte-identical publish+revert cycle) and six template_version_events rows exist, all resolved NONE; a true audit trail of the proof, not drift.
- quote: "The lease trio's `version` is now **3** (was 1): +1 for the proof publish, +1 for the byte-exact revert."
- kind: process
- artifacts: contract_templates (HORSE_LEASE_V2, HORSE_LEASE_SIMPLE, HORSE_LEASE_FULL), template_version_events
- decision-mention: D10

### ITEM
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Known standing blocker restated — test/db is not proof: 55 of 64 test files fail, so the DB half was proven with direct SQL against prod instead.
- quote: "per the task's instruction that `test:db` (55/64 files failing) is not proof."
- kind: known issue
- artifacts: test/db
- decision-mention: none

### ITEM
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Cosmetic nav note relayed — OPEN-CHANGE-REQUESTS note A9 flags eight identical Shield glyphs in the settings nav; a distinct icon (e.g. FileText) would serve better when the rename-to-Configuration lands.
- quote: "Note A9 in OPEN-CHANGE-REQUESTS flags the eight identical `Shield` glyphs — a distinct icon, e.g. `FileText`, would serve better"
- kind: cosmetic
- artifacts: AppLayout.tsx SETTINGS_GROUP
- decision-mention: none

---

## TASK-UIPOLISH-REPORT.md

### ITEM
- report: TASK-UIPOLISH-REPORT.md
- date: 2026-08-05
- item: Browser verification pending for all five UI items (I6–I10) — the task disallowed DB access so there was no way to sign in; specifically needs owner eyes on the glass tint strength, the debossed wordmark legibility (one-line text-cream-200 fallback offered), and the new Account rail entry/reordered nav at real viewports.
- quote: "**Browser verification, all five UI items (I6–I10).** ... This is a hard constraint of the task as scoped, not an oversight — flagged clearly rather than claiming a visual check that didn't happen."
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx, AppOverviewModal.tsx, Home.tsx, NAV_GLASS
- decision-mention: none

### ITEM
- report: TASK-UIPOLISH-REPORT.md
- date: 2026-08-05
- item: Lessons nav inclusion (I6) is built in and module-gated but awaits the owner's go/no-go; removal is a one-line drop in ClientNavItems plus a small block in AppOverviewModal.tsx.
- quote: "**Lessons inclusion (I6, item 1's footnote)** — built in, module-gated, awaiting the owner's go/no-go"
- kind: blocked-on-owner
- artifacts: AppLayout.tsx (ClientNavItems), AppOverviewModal.tsx
- decision-mention: none

### ITEM
- report: TASK-UIPOLISH-REPORT.md
- date: 2026-08-05
- item: npm run build:client fails at the copy step with ENOSPC — the host disk is at 99% capacity (134Mi free), unrelated to the change and not fixed (all 2084 modules transform successfully first).
- quote: "The step then fails copying `public/ffmpeg/ffmpeg-core.wasm` into `dist/` with `ENOSPC` — this environment's disk is at 99% capacity"
- kind: known issue
- artifacts: build environment, public/ffmpeg/ffmpeg-core.wasm
- decision-mention: none

---

# INVENTORY

### INVENTORY
- report: PROMPT_A_STAGES_1-3.md
- what: HORSE_LEASE v1 template — inactive with 0 documents but still carrying 104 body tokens and 98 registry rows; a legacy-retirement candidate requiring an owner decision because retiring it deletes body text.
- where: contract_templates key HORSE_LEASE (v1), template_tokens
- quote: "`HORSE_LEASE` v1 is inactive with 0 documents but still carries 98 registry rows and 104 body tokens."

### INVENTORY
- report: PROMPT_A_STAGES_1-3.md
- what: MINOR_RIDER template — active but has produced 0 documents; its GUARDIAN.*/EMERGENCY_CONTACT.* tokens have never been exercised by a real render.
- where: contract_templates key MINOR_RIDER
- quote: "`MINOR_RIDER` is **active, 0 documents**; its `GUARDIAN.*` / `EMERGENCY_CONTACT.*` tokens have never been exercised by a real render"

### INVENTORY
- report: TASK-SECFIX-REPORT.md
- what: clients_overview view — zero references anywhere in src/ or api/ (checked before revoking anon SELECT).
- where: public.clients_overview
- quote: "`clients_overview` — 0 references in `src/` or `api/`"

### INVENTORY
- report: TASK-SECFIX-REPORT.md
- what: service_credits view — zero references in the codebase (and 0 rows at verification time).
- where: public.service_credits
- quote: "`service_credits` — 0 references"

### INVENTORY
- report: TASK-SECFIX-REPORT.md
- what: memberships view — zero real code references; the only two grep hits are prose comments in api/hard-delete-client.ts about the members table cascade, not view reads.
- where: public.memberships, api/hard-delete-client.ts:12,48
- quote: "`memberships` — 0 real references; the only two hits (`api/hard-delete-client.ts:12,48`) are prose comments about the `members` **table** cascade, not view reads"

### INVENTORY
- report: TASK-SECFIX2-REPORT.md
- what: ensure_gift_buyer_account(uuid) — dead code in production: zero callers by grep, pg_proc prosrc scan (with positive control), and pg_depend; gift redemption runs through redeem_gift, which never calls it.
- where: public.ensure_gift_buyer_account(uuid)
- quote: "The function is dead code in production, so this revoke cannot break a gift flow — there is no flow to break."

### INVENTORY
- report: TASK-SECFIX2-REPORT.md
- what: member_directory view — now unreadable by every web role and security_invoker=true; its definition is retained purely as documentation of the shape, with nothing depending on it.
- where: public.member_directory
- quote: "The definition is retained as documentation of the shape. Nothing depends on it — 0 dependent views/rules ... 0 function bodies referencing it"

### INVENTORY
- report: TASK-DOCCOLS-REPORT.md
- what: ContactsPage / the /app/ops/contacts route — retired per TASK-ROSTER; person links go to /app/admin?open= (the Clients page) instead.
- where: src/pages ContactsPage, route /app/ops/contacts
- quote: "`ContactsPage`/`/app/ops/contacts` is retired per `TASK-ROSTER`"

### INVENTORY
- report: TASK-DOCCOLS-REPORT.md
- what: The org company contact has no reachable record page (contact_type='TEAM' fails admin_client_accounts arm 3's type check by design) — it renders as plain text, not a link.
- where: contacts (French Heritage Equestrian, is_company=true), admin_client_accounts()
- quote: "the company contact — contact_type = 'TEAM', fails arm 3's type check on purpose"

### INVENTORY
- report: TASK-TEXTEDIT-REPORT.md
- what: 59 template_tokens rows whose source_table points at tables that no longer exist — dead source wiring surfaced in the picker with a "source retired" badge, rows deliberately not deleted.
- where: template_tokens (59 rows with source_live=false)
- quote: "59 tokens point at tables that no longer exist — TOKENAUDIT's finding — and the picker must not present dead wiring as live"

### INVENTORY
- report: TASK-TEXTEDIT-REPORT.md
- what: HORSE_REPRESENTATION and MEDIA_RELEASE — inactive flat templates with empty bodies.
- where: contract_templates keys HORSE_REPRESENTATION, MEDIA_RELEASE
- quote: "`HORSE_REPRESENTATION` and `MEDIA_RELEASE` are inactive flats with empty bodies"

### INVENTORY
- report: TASK-TEXTEDIT-REPORT.md
- what: FACILITY_LICENSE and INDEPENDENT_CONTRACTOR — active flat templates whose live bodies are empty (red "empty body" badge in the editor list; drafts exercised then discarded, bodies still empty).
- where: contract_templates keys FACILITY_LICENSE, INDEPENDENT_CONTRACTOR
- quote: "Drafted into `FACILITY_LICENSE` and `INDEPENDENT_CONTRACTOR` → list shows `has_flat_draft t, body_empty t` (live body untouched) → discarded → clean."

### INVENTORY
- report: TASK-TEXTEDIT-REPORT.md
- what: HORSE_LEASE_STANDARD — locked in the editor with a D10 locked_reason (the deactivated redundant lease clone); 0 drafts, version and body md5 unmoved, draft/publish attempts refused.
- where: contract_templates key HORSE_LEASE_STANDARD
- quote: "`HORSE_LEASE_STANDARD`: **0 drafts, version stayed 1, body md5 unmoved** through the whole exercise, and direct attempts to draft/publish it are refused with the D10 message."

### INVENTORY
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- what: The page CJ's contract-invite link landed on was reported by the owner as non-functional/"unwired" — unconfirmed, needs live browser evidence.
- where: contract invite redemption landing page (route not identified in the report)
- quote: "CJ's own invite link (existing account) was reported by the owner as landing on a non-functional/\"unwired\" page"

### INVENTORY
- report: TASK-HEADER-REPORT.md
- what: The checked-in header mockup's drawer and modal behaviour is entirely non-functional — its inline script throws before the DOM nodes exist; only the avatar press physics run in the reference.
- where: docs/reference/header-mockup.html
- quote: "**none of the drawer or modal behaviour works in the reference as checked in**. Only the avatar press physics run."
