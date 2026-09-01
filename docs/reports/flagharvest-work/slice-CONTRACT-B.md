### ITEM [batch1.md#5]
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: No idempotent re-fire wrapper exists for apply_contract_execution_effects() — only the trigger function itself; leases executed before the trigger never get stamped without manual intervention.
- quote: "No idempotent re-fire wrapper exists for `apply_contract_execution_effects()` (only the trigger function itself; grepped `pg_proc` for anything else mentioning \"execution_effect\" — nothing)."
- kind: inventory
- artifacts: apply_contract_execution_effects
- decision-mention: none

### ITEM [batch1.md#6]
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: The stamped test data (lease effect on Beau) was deliberately left in production per the task's instruction, reflecting the real executed lease.
- quote: "**This test data STAYS** — it reflects the real executed lease `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3` and was not cleaned up, per the task's instruction."
- kind: process
- artifacts: horses, horse_relationships
- decision-mention: none

---

### ITEM [batch1.md#10]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Real defect found: my_contract_documents() has no void filter, so DealHome offered two VOIDED leases under "Agreements that need you" with Review & sign.
- quote: "`my_contract_documents()` has **no void filter**. For `cjzigs@icloud.com` its 5 rows include **two VOIDED leases** ... The page was asking a member to sign two dead documents."
- kind: defect
- artifacts: my_contract_documents, src/pages/app/DealHome.tsx
- decision-mention: none

### ITEM [batch1.md#11]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Correction to the census: ContractPage does not need my_contract_documents' open_change_requests / my_roles fields — it reads contract_document_detail(); DealHome was my_contract_documents' only consumer.
- quote: "**One correction to the census** while I was in there: it says `ContractPage` needs `my_contract_documents`'s `open_change_requests` / `my_roles` fields. It does not"
- kind: correction
- artifacts: src/pages/app/ContractPage.tsx, contract_document_detail, my_contract_documents
- decision-mention: none

### ITEM [batch1.md#12]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: No staff browser session exists, so every staff-side render is NOT VERIFIED (/app/ops/horse-records, /app/ops/lessons/sessions, /app/ops, /app/deal, /app/documents) — proven at data and type layer only.
- quote: "**No staff browser session exists**, so **every staff-side render is NOT VERIFIED** ... none has been looked at."
- kind: not-verified
- artifacts: /app/ops/horse-records, /app/ops/lessons/sessions, /app/ops, /app/deal, /app/documents
- decision-mention: none

### ITEM [batch1.md#19]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Flagged not fixed: my_contract_documents()'s staff branch returns every contract in the org under a function named "my" — a trap if it is ever revived (nothing reads it now).
- quote: "**`my_contract_documents()`'s staff branch returns every contract in the org**, under a function named \"my\" ... If it is ever revived, that is a trap."
- kind: defect
- artifacts: my_contract_documents
- decision-mention: none

### ITEM [batch1.md#26]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Not reached: ContractPage.tsx (2,293 lines) and ContractCascade.tsx (1,600 lines) were not audited internally for self-duplication — likely some exists; a task of its own.
- quote: "They were not audited internally for self-duplication; at that size there is likely some, and it is a task of its own."
- kind: inventory
- artifacts: src/pages/app/ContractPage.tsx, src/components/app/ContractCascade.tsx
- decision-mention: none

### ITEM [batch1.md#34]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 1.4: a member's document count reads 13 on /app/documents and 5 on /app/deal; three members would see an Acquisition home reading "no agreements" while their Documents page lists 4-6 — both labelled the same to the member.
- quote: "Three members would see an Acquisition home reading *\"no agreements\"* while their Documents page lists six, six and four."
- kind: defect
- artifacts: my_documents, my_contract_documents, src/pages/app/DealHome.tsx, src/components/app/DocumentsContent.tsx
- decision-mention: none

### ITEM [batch1.md#41]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: The Ownership and Health record-lane links (only reachable via RecordsHubPage) must survive any retirement of its redundant roster; per HORSEONE the lanes stay gated on mod.horserecords.
- quote: "the **Ownership and Health lane links must survive**, and per HORSEONE the lanes stay gated on `mod.horserecords` while the roster does not."
- kind: inventory
- artifacts: /app/ops/records/horses/:id/parties, /app/ops/records/horses/:id/health, RecordsHubPage.tsx
- decision-mention: none

### ITEM [batch1.md#54]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 2.7: Admin.tsx:518 and :248 send every document to /app/ops/documents/:id unconditionally (DocumentQueueTable routes correctly), so the 8 contract-backed documents open in different viewers depending on origin; three-line documentHref(row) helper fix.
- quote: "**`Admin.tsx:518` and `Admin.tsx:248` do not** — they send **every** document to `/app/ops/documents/:id` unconditionally."
- kind: defect
- artifacts: src/pages/app/Admin.tsx, src/components/ops/documents/DocumentQueueTable.tsx
- decision-mention: none

### ITEM [batch1.md#55]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 2.8: five signature-capture surfaces each re-implement typed-name input, name-match rule and consent checkbox; recommendation is one shared SignatureBlock, do not merge the two writers, and merge Release + DocsParticipantFlow (983 duplicated lines).
- quote: "**Build from:** **one shared `<SignatureBlock>`** ... Every one of the five already implements all four."
- kind: defect
- artifacts: ContractPage.tsx, DocumentsContent.tsx, Onboarding.tsx, Release.tsx, DocsParticipantFlow.tsx
- decision-mention: none

### ITEM [batch1.md#56]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: 60% of production signatures carry no signing account (37 KIOSK_TYPED rows have NULL signer_user_id); mostly correct-by-design for kiosk walk-ins, but only one of the two writers stamps it.
- quote: "it does mean **60% of signatures in production carry no signing account**, and only one of the two writers stamps it."
- kind: data-integrity
- artifacts: signatures, sign_release, record_signature
- decision-mention: none

### ITEM [batch1.md#61]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: /app/deal and /app/care are surfaces to decide about — give them a nav entry and fix the dead link, or fold into /app/dashboard; CareHome's horses list duplicates /app/stable.
- quote: "these are not duplicates to resolve so much as **surfaces to decide about**."
- kind: blocked-on-owner
- artifacts: src/pages/app/DealHome.tsx, src/pages/app/CareHome.tsx
- decision-mention: none

### ITEM [batch1.md#62]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.5: CalendarPage.tsx:618 links to /app/contracts (no :id) — no such route exists; it is a btn-primary labelled "Review & sign paperwork" that 404s. Route/link cross-check found exactly 2 unmatched targets app-wide (this and /horse-care).
- quote: "`CalendarPage.tsx:618` → **`/app/contracts`** (no `:id`). **No such route exists** ... It 404s."
- kind: defect
- artifacts: src/pages/app/CalendarPage.tsx, App.tsx
- decision-mention: none

### ITEM [batch1.md#68]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: For REVIEWNAV: the kiosk signing surface /release signs a real document and should be labelled destructive in any review section.
- quote: "**Signs a real document — REVIEWNAV should label this destructive**"
- kind: process
- artifacts: /release, src/pages/Release.tsx
- decision-mention: none

### ITEM [batch1.md#69]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: For REVIEWNAV: a staff reviewer cannot see the member "My Documents" nav row (useNavPresence(!isStaff)), so the Signing B review entry must be added explicitly or the owner cannot reach it.
- quote: "**A staff reviewer will not see this nav row** (`useNavPresence(!isStaff)`) — REVIEWNAV must add the Review entry explicitly or the owner cannot reach it"
- kind: process
- artifacts: AppLayout.tsx, useNavPresence, /app/documents
- decision-mention: none

### ITEM [batch1.md#75]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Whether manual identity linking is enabled in the Supabase Auth dashboard is unknown and not determinable without a session; /auth/v1/settings does not expose the flag; a two-minute signed-in procedure is given to settle it.
- quote: "**Is manual identity linking enabled in the Supabase Auth dashboard? Unknown. Not determinable without a session, and I am not going to assume it.**"
- kind: blocked-on-owner
- artifacts: Supabase Auth settings (Allow manual linking)
- decision-mention: none

### ITEM [batch1.md#79]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Not verified: sign out → sign in via Google → same user_id / contact_id / documents — the "nothing else proves the switch worked" test is unrun.
- quote: "**Sign out → sign in via Google → same `user_id` / `contact_id` / documents** ... is equally unrun."
- kind: not-verified
- artifacts: auth flow
- decision-mention: none

### ITEM [batch1.md#81]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Nothing was verified in a real browser — no authenticated session exists in the environment; component tests stand in for click-through and are not the same thing.
- quote: "**Anything in a real browser.** No authenticated session exists in this environment; the component tests stand in for click-through, and they are not the same thing."
- kind: not-verified
- artifacts: GoogleSignInRow, AccountHub.tsx
- decision-mention: none

### ITEM [batch1.md#84]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: HELD for owner sign-off: provision_client_invitation still supersedes on every call (live behaviour the owner ruled against) — a second self-onboarding submission kills the first link's /sign resume path; the fix is written and dry-run but deliberately not applied, kept in docs/proposed/ so no sweep picks it up.
- quote: "`provision_client_invitation` still supersedes on **every** call, which is the behaviour you ruled against. It is live right now"
- kind: blocked-on-owner
- artifacts: provision_client_invitation, docs/proposed/INVITEWORKS-provision-no-default-supersede.sql
- decision-mention: none

### ITEM [batch1.md#107]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Orchestrator audit correction stamped on the report: its deployment section is WRONG — everything is deployed; the thread tested SHA reachability instead of content (cherry-picks always get new hashes); third instance of the same mistake from this thread.
- quote: "**Everything in this report is deployed.** The thread concluded otherwise by testing whether its own cherry-picked SHAs are ancestors of `origin/main`."
- kind: correction
- artifacts: docs/reports/TASK-LEASEFIX-REPORT.md, git patch-id
- decision-mention: none

### ITEM [batch1.md#108]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Process lesson recorded by the audit: when asking "did this land?", test the CONTENT (git patch-id --stable, or grep the file on the target ref), never the SHA.
- quote: "**The habit to build: when asking \"did this land?\", test the CONTENT — `git patch-id --stable`, or grep the file on the target ref. Never the SHA.**"
- kind: process
- artifacts: git workflow
- decision-mention: none

### ITEM [batch1.md#109]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: The thread's earlier oneheader claim to the owner ("committed but not on main") was false — the header work is merged and deployed; acting on the warning would have duplicated already-merged work.
- quote: "**That is false.** Re-verified myself on 2026-08-10 ... The header work is merged and deployed."
- kind: correction
- artifacts: task/oneheader (eaab867), AppHeader.tsx
- decision-mention: none

### ITEM [batch1.md#114]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Alternative if the freeze holds: the defect can be addressed data-only (no deploy) by shortening the long dropdown option labels — four fields carry an option long enough to trigger it.
- quote: "**If the freeze holds**, the same defect can be addressed without this file by shortening the long dropdown option labels — data-only, no deploy."
- kind: process
- artifacts: TXN.OFFSITE_TRANSPORT, TXN.CCC_REQUIRED, GL elections
- decision-mention: none

### ITEM [batch1.md#116]
- report: TASK-LEASEFIX-REPORT.md
- date: 2026-08-10
- item: Migration 20260809T2000 is dead weight — it adds a field that 20260809T2100 deletes; left in place because the journal records what was actually run.
- quote: "**`20260809T2000` is dead weight** — it adds a field that `20260809T2100` deletes. Replaying the journal on a fresh database produces the right end state but does needless work."
- kind: process
- artifacts: supabase/migrations/20260809T2000_leasefix_gl_lessor_requires_lessee.sql
- decision-mention: none

### ITEM [batch1.md#125]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Residual risk flagged: the fill_party_fields_from_contacts guard's staff branch additionally requires d.org_id = current_org(), marginally tighter than the callers' bare has_staff_access() — inert with one organization, but a real difference under multi-tenancy.
- quote: "this is inert today — but it is a real difference and would matter under multi-tenancy."
- kind: correctness
- artifacts: fill_party_fields_from_contacts, caller_is_document_party_or_staff
- decision-mention: none

### ITEM [batch1.md#129]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Owner-accepted residual: the remaining in-database callers (start_bill_of_sale, start_sale_contract, start_lease_contract_v2, add_deal_document, reassign_document_party, set_document_co_buyer, and trigger-borne paths) were not each exercised end-to-end — each mutates real data; the mechanism is uniform and proven by two closed chains.
- quote: "**Owner-accepted at review as a residual, not closed.**"
- kind: not-verified
- artifacts: start_bill_of_sale, start_bill_of_sale_standalone, start_sale_contract, start_lease_contract_v2, add_deal_document, reassign_document_party
- decision-mention: none

### ITEM [batch1.md#132]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Snapshot staleness bit twice within three days: two Phase B targets (recompose_document_fields, sync_contract_fields_from_defs) were rewritten mid-task by the leasefix migrations; both were re-read from production rather than trusting the audit.
- quote: "This is NOGUARD1's caveat #9 (point-in-time snapshot) actually biting, twice, within three days."
- kind: process
- artifacts: recompose_document_fields, sync_contract_fields_from_defs
- decision-mention: none

### ITEM [batch1.md#137]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Caveat stated: the production database is not quiescent — contacts read 34→35→34 during reconnaissance and contract_fields moved 654→645 through a live PostgREST session; other threads work the same DB while tasks run.
- quote: "**Caveat, stated rather than glossed:** the production database is not quiescent."
- kind: process
- artifacts: production db lrstswfxfsezdmvkvukc
- decision-mention: none

### ITEM [batch1.md#151]
- report: TASK-SQLTRUTH-REPORT.md
- date: 2026-08-04
- item: Caveat: set_contract_field has no server-side before md5 — its proof is a local file diff/md5 of pg_get_functiondef dumps, a weaker proof than the server-side before/after hash pairs used for the other four functions.
- quote: "This is a weaker proof than the server-side before/after `md5()` pair used for the other four"
- kind: process
- artifacts: set_contract_field, 20260804130000_sql_truth_recapture.sql
- decision-mention: none

### ITEM [batch1.md#152]
- report: TASK-SQLTRUTH-REPORT.md
- date: 2026-08-04
- item: Drift found and recaptured: live set_contract_field calls assert_not_signature_locked where git still had void_signatures_on_edit, and the HORSE.% writeback block was removed live (Deal plan L10) but still present in git — the journal had diverged from production.
- quote: "(1) live calls `assert_not_signature_locked(p_document_id)` where git still has `void_signatures_on_edit(p_document_id)`; (2) live has removed the `HORSE.%` writeback block"
- kind: data-integrity
- artifacts: set_contract_field, contract_horse_field_writeback
- decision-mention: none

---

### ITEM [batch2.md#4]
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: Kiosk signers get a contacts row with no linked account, have no self-serve signup route, and until invited have no path to H3's self-send and never see their document in-app — traced and reported, by design, not fixed.
- quote: "Until invited, a kiosk signer has no path to H3's self-send and never sees their document in-app — by design, not a defect."
- kind: inventory
- artifacts: contacts, redeem_invitation, /register, /activate, App.tsx
- decision-mention: none

### ITEM [batch2.md#25]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: No PDF was regenerated for the final sample — no PDF pipeline available in the environment; the markdown export stands in as the substantive artifact.
- quote: "No PDF regenerated (no PDF pipeline available in this environment; the markdown is the substantive artifact)."
- kind: not-verified
- artifacts: docs/contract-exports/SAMPLE_FHE_LESSEE_2026-08-02.md
- decision-mention: none

### ITEM [batch2.md#39]
- report: TASK-C-REPORT.md
- date: 2026-08-04
- item: Judgment call flagged: the rate-limit window is tumbling (anchored at the first request per hash), not a true sliding log — matches "10 submissions per rolling hour" in spirit; flagged in case a stricter interpretation was intended.
- quote: "Matches \"10 submissions per rolling hour\" in spirit; flagging in case a stricter interpretation was intended."
- kind: process
- artifacts: sign_start_attempts, sign_start_register_attempt, supabase/migrations/20260804120000_sign_start_rate_limit.sql
- decision-mention: none

### ITEM [batch2.md#41]
- report: TASK-C-REPORT.md
- date: 2026-08-04
- item: Deviation: /sign/:path was nested inside the `<Layout>` public-chrome route group rather than standalone like /release, because the spec's styling references live inside Layout.
- quote: "**`/sign/:path` was nested inside the `<Layout>` route group** (site header/footer chrome), not standalone like `/release`"
- kind: process
- artifacts: src/App.tsx, src/pages/SignStart.tsx
- decision-mention: none

### ITEM [batch2.md#43]
- report: TASK-C-REPORT.md
- date: 2026-08-04
- item: The migration dry-run was not isolated — the file's own inner BEGIN/COMMIT persisted the change for real on the first run; recovered by relying on the migration's idempotency and re-running standalone as the apply step.
- quote: "wrapping it in an outer `BEGIN; -f file; ROLLBACK;` did not isolate it — the inner `COMMIT` persisted the change for real on the first run"
- kind: process
- artifacts: supabase/migrations/20260804120000_sign_start_rate_limit.sql
- decision-mention: none

---

### ITEM [batch2.md#61]
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: Flagged: with every module now entitled ON, AdminModulesPage (requireSuperAdmin) is the only place to turn a module off — the tenant owner cannot disable a module himself, by design, only hide its pages.
- quote: "**`org_modules` now shows every module on, so `AdminModulesPage` is the only place to turn one off** — and that page is `requireSuperAdmin`."
- kind: process
- artifacts: org_modules, AdminModulesPage
- decision-mention: none

### ITEM [batch2.md#62]
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: In-app hub-card links pointing at hidden pages were reported, not fixed (BoardingHubPage, BarnopsHubPage, EmployeesHubPage, HorseHealthPage/HorsePartiesPage back-links, InstructorHome) — hub cards are deliberately not filtered by visibility.
- quote: "hub cards are **not** filtered by visibility. A hub you kept still lists a child you put away."
- kind: process
- artifacts: BoardingHubPage.tsx, BarnopsHubPage.tsx, EmployeesHubPage.tsx, HorseHealthPage.tsx, HorsePartiesPage.tsx, InstructorHome.tsx
- decision-mention: none

### ITEM [batch2.md#79]
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: The A3 data-pass dry-run was not a dry run — the migration file's own inner BEGIN/COMMIT ended the outer transaction, so the data pass landed at dry-run time; no harm (guarded re-run was a no-op), but stated plainly.
- quote: "the dry-run was not a dry run, and stating otherwise would be false."
- kind: process
- artifacts: supabase/migrations/20260804110001_lease_heading_data_pass.sql
- decision-mention: none

### ITEM [batch2.md#83]
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: The add-item UI itself was never exercised in a browser — modal behaviour asserted from code, not a click-through; typecheck/lint/build pass.
- quote: "**Not run:** the UI itself was never exercised in a browser. ... the modal's behaviour is asserted from the code, not from a click-through."
- kind: not-verified
- artifacts: src/components/app/AddElementModal.tsx, ContractPage.tsx
- decision-mention: none

---

### ITEM [batch2.md#102]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Judgment call flagged: ring derivation for the bare 'contact' arm was uncovered by the exploration doc; closed by reading client_id presence as the gold signal and treating the bare arm as grey.
- quote: "I closed that gap by reading `client_id` presence as the gold signal directly off the RPC ... and treating the bare `'contact'` arm as grey"
- kind: process
- artifacts: RosterCard.tsx, admin_client_accounts, clients
- decision-mention: none

### ITEM [batch2.md#103]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Judgment call flagged: "Client" is rendered as a fixed word in the PAIR badge (per the owner's worked example), not conditionally gated on client_id — Gabriella, the one real dependent, has no clients row.
- quote: "Read \"Client\" as the owner's chosen fixed replacement word for \"Counterparty\" in this pairing context specifically ... not as a second, competing ring-style derivation."
- kind: process
- artifacts: RosterCard.tsx, contacts.guardian_contact_id
- decision-mention: none

### ITEM [batch2.md#106]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Known gap deferred to TASK-BOOKFLOW: bookings carries no audit trigger (29 tables write to audit_logs, bookings is not one), so a client whose only engagement is booked lessons shows no activity signal at all; neither a bookings union nor the missing trigger was added.
- quote: "`bookings` carries no audit trigger ... so a client whose only engagement is booked lessons reads with no activity signal at all rather than a false \"Active\" or a misleading \"Inactive.\""
- kind: process
- artifacts: bookings, audit_logs, RosterCard.tsx
- decision-mention: none

### ITEM [batch3.md#8]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: All rendered behavior is NOT VERIFIED — no browser session was available; a 7-step owner checklist for browser verification is included in §7.
- quote: "**All renders are NOT VERIFIED — no browser session was available.** ... Treat every \"yes\"/\"maybe\" verdict in §6 and every mechanism claim in §3 as **NOT VERIFIED in a browser**"
- kind: not-verified
- artifacts: src/components/ops/kit/DataTable.tsx, DocumentQueueTable, ContractSubheader
- decision-mention: none

### ITEM [batch3.md#18]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 3, structural Yes, not fixed): RevealText pairs a whitespace-nowrap ~45-char label with a min-w-[8rem] input — combined minimum deterministically exceeds a 320px column.
- quote: "`src/components/app/ContractCascade.tsx:436-438` ... combined minimum exceeds a 320px column deterministically."
- kind: defect
- artifacts: src/components/app/ContractCascade.tsx:436-438
- decision-mention: none

### ITEM [batch3.md#36]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F5 — most of contract_split_deductible_sync is dead (references seven nonexistent fields); FMV floor rule and teardown branches never fire, and mortality/medical split shares are never normalised while GL's are — two identical-looking controls behave differently.
- quote: "**F5 — most of the deductible trigger is dead.** `contract_split_deductible_sync` references seven fields that do not exist in `HORSE_LEASE_V2`"
- kind: defect
- artifacts: contract_split_deductible_sync
- decision-mention: none

### ITEM [batch3.md#39]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F8 — unconditional RISK_OF_LOSS ("Lessor assumes all risk") prints alongside MORT_LESSEE_RESP whenever the Lessee accepts mortality responsibility — the document says both things at once.
- quote: "**F8 — `RISK_OF_LOSS` versus any Lessee-carried mortality.** ... Both print together, four items apart"
- kind: defect
- artifacts: RISK_OF_LOSS, MORT_LESSEE_RESP, HORSE_LEASE_V2
- decision-mention: none

### ITEM [batch3.md#40]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F9 — MED_TAIL (Lessor assumes all uncovered risks/costs) prints inside the same numbered item as Lessee-carried medical statements that say the opposite.
- quote: "**F9 — `MED_TAIL` versus any Lessee-carried medical.** ... They print inside the same numbered item."
- kind: defect
- artifacts: MED_TAIL, MED_LESSEE_RESP, HORSE_LEASE_V2
- decision-mention: none

### ITEM [batch3.md#50]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F19 — mortality and medical split shares are neither normalised nor cross-checked (60/70 both stored and printed verbatim) while GL on the same screen silently rewrites the second share.
- quote: "**F19 — mortality and medical split shares are neither normalised nor cross-checked.**"
- kind: defect
- artifacts: contract_split_deductible_sync
- decision-mention: none

### ITEM [batch3.md#52]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: The Lessor (and FHE staff) can write the Lessee's three first-person insurance-status undertakings — all three *_LESSEE_STATUS fields are owner_role=LESSOR, while the equivalent checkbox elections are party-exclusive; same undertaking, opposite rules.
- quote: "**The Lessor writes the Lessee's insurance status.** All three `*_LESSEE_STATUS` fields are `owner_role = LESSOR`."
- kind: defect
- artifacts: TXN.GL_LESSEE_STATUS, TXN.MORT_LESSEE_STATUS, TXN.MED_LESSEE_STATUS, set_contract_field
- decision-mention: none

### ITEM [batch3.md#56]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: The status vocabulary carries no notion of capability or demand ("required to", "cannot lawfully obtain"), so scenario 4 (partial lease, cover the Lessee cannot get) has only four bad moves: state something untrue, undertake the impossible, leave unsignable, or drop the requirement.
- quote: "**The vocabulary carries no notion of capability or demand.** ... Scenario 4 is the direct consequence"
- kind: defect
- artifacts: docs/reference/lease-map/SCENARIOS.md, *_STATUS fields
- decision-mention: none

### ITEM [batch3.md#57]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: The insurance section has never been filled in end to end by any real transaction — all 22 insurance fields are empty on all three current documents; the one executed lease predates the model.
- quote: "**The insurance section has never been filled in.** ... Nothing in this section has been exercised end to end by a real transaction."
- kind: inventory
- artifacts: HORSE_LEASE_V2 INSURANCE_RISK, contract_fields
- decision-mention: none

### ITEM [batch3.md#58]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: Inferred not observed: the deductible-trigger's GL-vs-mortality/medical behavior difference and the assembled text of scenarios 1/3/4/5 were read from code, never seen running.
- quote: "**Inferred — read from code, not observed running:** the deductible-split trigger's different behaviour for GL versus mortality and medical."
- kind: not-verified
- artifacts: contract_split_deductible_sync, docs/reference/lease-map/SCENARIOS.md
- decision-mention: none

### ITEM [batch3.md#59]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: lock_and_sign_contract's gate-blind required-field branch is unreachable through the app UI but reachable by direct RPC call — read from the Sign control's render condition, not tested.
- quote: "that `lock_and_sign_contract`'s gate-blind required-field branch is unreachable through the application. It is reachable by direct RPC call."
- kind: caveat
- artifacts: lock_and_sign_contract
- decision-mention: none

---

### ITEM [batch3.md#66]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Sign out is reachable only via the avatar menu for every role (mobile and desktop) — the merged drawer must carry it, and desktop cannot lose the dropdown until a desktop replacement exists (Q4's hard constraint; desktop consolidation is real follow-on work).
- quote: "**Sign out** ... **NET-NEW — the only path** ... **the avatar dropdown cannot be removed on desktop without a replacement**, because desktop currently has no other path to sign out at all."
- kind: defect
- artifacts: handleSignOut, ClientRail, src/components/app/AppLayout.tsx, CardstockHeader
- decision-mention: none

### ITEM [batch3.md#67]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Admin vs instructor avatar-menu asymmetry (instructors get Calendar/Catalog/Messages, admins do not) reads as branch drift, not design — reported rather than equalized; owner should confirm both converging on the same net-new set is acceptable.
- quote: "Admins and instructors get different avatar-menu content today even though both are `isStaff` ... I'm reporting it rather than quietly equalizing it."
- kind: blocked-on-owner
- artifacts: src/components/app/AppLayout.tsx:733-813
- decision-mention: none

### ITEM [batch3.md#68]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Q1 (sign-out placement), Q3 (superadmin untouched) and Q4 (scope dropdown removal to <lg only) are answered as recommendations, not commitments — explicit sign-off needed before Phase 2 builds against them.
- quote: "**Q1/Q4/Q3 answers above** — presented as recommendations, not commitments; need explicit sign-off"
- kind: blocked-on-owner
- artifacts: src/components/app/AppLayout.tsx, CardstockHeader.tsx
- decision-mention: none

### ITEM [batch3.md#75]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Net-new avatar-menu items that must land somewhere in the merged drawer or be lost: Account (staff), Catalog (admins and instructors), Messages (instructors), App tour (all roles), Sign out (all roles), Saved Content (members).
- quote: "**NET-NEW** (only reachable via the avatar menu today — must land somewhere in the merged drawer or it's lost)"
- kind: inventory
- artifacts: src/components/app/AppLayout.tsx:733-813 (avatar dropdown)
- decision-mention: none

---

### ITEM [batch3.md#87]
- report: TASK-SIGREAD-REPORT.md
- date: 2026-08-06
- item: The pixel-level render of the Documents page showing the signed flag was not click-tested — no browser session; the signed:true computation was traced by hand from the live query.
- quote: "Assumed, not verified: the actual pixel-level render of the Documents page (no browser session available in this environment)"
- kind: not-verified
- artifacts: src/pages/app/Documents.tsx:214, listMySignableDocuments(), src/lib/ops/api-client.ts:70-116
- decision-mention: none

### ITEM [batch3.md#89]
- report: TASK-SUPERSEDE-REPORT.md
- date: 2026-08-10
- item: FOUND NOT FIXED and armed: CJ's two ready_to_sign Beaumont documents (fb6abc6c, 0360f829) reference contract_id ae4ffe95 which does not exist in contracts (despite the FK reporting convalidated=true); signing either in production will ERROR. Owner must choose: NULL the contract_ids or delete-and-regenerate via ensure_horse_documents.
- quote: "Both Beaumont documents ... carry `contract_id = ae4ffe95-...`, **which does not exist in `contracts`** ... **This is itself armed:** signing either document in production will ERROR."
- kind: data-integrity
- artifacts: documents fb6abc6c, documents 0360f829, contracts, documents_contract_id_fkey, ensure_horse_documents
- decision-mention: none

### ITEM [batch3.md#90]
- report: TASK-SUPERSEDE-REPORT.md
- date: 2026-08-10
- item: Assumptions not verified: that jsonb_populate_record clones are faithful stand-ins for app-generated documents, and that no code path other than the watched status transition executes documents.
- quote: "**Assumed:** that `jsonb_populate_record` clones used in proofs 2–3 are faithful stand-ins for app-generated documents ... that no other code path executes documents except the status transition the trigger watches."
- kind: not-verified
- artifacts: apply_document_supersession, documents_apply_supersession trigger
- decision-mention: none

### ITEM [batch3.md#92]
- report: TASK-SUPERSEDE-REPORT.md
- date: 2026-08-10
- item: No typecheck claim made — npm install was not run and nothing TypeScript was touched; no historical supersession markings revisited per task constraint.
- quote: "**Not done:** no frontend change, so no typecheck claim is made (`npm install` was not run...). No historical supersession markings revisited, per the task constraint."
- kind: process
- artifacts: supabase/migrations/20260810T1700_supersede_horse_scoped.sql
- decision-mention: none

---

### ITEM [batch3.md#93]
- report: TASK-TIPTAP-REPORT.md
- date: 2026-08-07
- item: InfoDot shares this task's core defect (390px overflow exposure, no viewport clamp, no outside-tap close) but is outside the stated scope and was left untouched — surfaced for a follow-up decision.
- quote: "it has the same 390px overflow exposure `ExplainTip` was built to fix (`absolute left-0 top-6 w-64`, no viewport clamping) and no outside-tap-to-close. Left untouched"
- kind: deferred
- artifacts: InfoDot, src/components/app/ContractCascade.tsx (~L214)
- decision-mention: none

### ITEM [batch3.md#94]
- report: TASK-TIPTAP-REPORT.md
- date: 2026-08-07
- item: Five title="Remove"/"Delete…" sites in ContractCascade.tsx were deliberately left as plain title= (converting would break one-tap removal into two taps) — flagged judgment call.
- quote: "**Five `title=\"Remove\"`/`\"Delete…\"` sites in `ContractCascade.tsx`** (lines 441, 519, 558, 707, 1374) ... these stay as plain `title=`"
- kind: caveat
- artifacts: src/components/app/ContractCascade.tsx:441,519,558,707,1374
- decision-mention: none

### ITEM [batch3.md#98]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: Blanket: every UIO order's rendered result is browser-pending — all verification was typecheck/lint/build plus grepping compiled CSS/JS (with a few headless-Chrome mockup screenshots); nothing was clicked or eyeballed in the real app at any breakpoint.
- quote: "The header's line, the rail shadow (if visible), and the subheader shadow have not been looked at by eye in any browser or device size. Nothing here proves a render."
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx, src/components/app/app-header.css, src/components/app/ContractSubheader.tsx, src/components/app/ContractPage.tsx
- decision-mention: none

### ITEM [batch3.md#104]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-004 correction: the order said "35 sites across 21 files"; the actual cherry-picked commit is 27 files / 35 insertions, and the built JS shows 37 occurrences (2 pre-existing sites) — discrepancies traced, not a bug.
- quote: "**File-count discrepancy:** the order says \"35 sites across 21 files\"; the actual commit's diffstat is 27 files, 35 single-line insertions."
- kind: correction
- artifacts: overscroll-contain sites, ContractDrawer.tsx:224, ContractSubheader.tsx:275
- decision-mention: none

### ITEM [batch3.md#109]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-009: the order's premise that the subheader lacks a bottom line is false — border-green-800/15 was already present and predates UIBUILD; reported as "already satisfied, nothing to add" and flagged in case the owner meant some other line.
- quote: "I'm reporting this as \"already satisfied, nothing to add\" rather than \"done,\" since the order's own premise (that this line doesn't currently exist) doesn't match what's in the file"
- kind: correction
- artifacts: src/components/app/ContractSubheader.tsx:171
- decision-mention: none

### ITEM [batch3.md#117]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-015 correction: the order quoted a stale SUBHEADER_BTN (text-sm, md: overrides) — the file had already moved to clamp()-based fluid sizing; the literal instruction was proven a no-op before the clamp ceilings were lowered instead.
- quote: "**the order's quoted \"current state\" of `SUBHEADER_BTN` (lines 72-75) was stale.** ... the order simply described a file that no longer existed by the time I reached it."
- kind: correction
- artifacts: SUBHEADER_BTN, src/components/app/ContractSubheader.tsx
- decision-mention: none

### ITEM [batch3.md#119]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-017: the signatures section has never been observed rendering WITH content (signing freeze — no live document has signatures or signable state); the by-construction argument substitutes for observation — worth a specific check once the freeze lifts.
- quote: "I have not seen this section render WITH content, before or after this fix, since the signing freeze means no live document has any signatures or signable state to show right now."
- kind: not-verified
- artifacts: #contract-signatures, hasSignatureCardContent, src/components/app/ContractPage.tsx
- decision-mention: none

### ITEM [batch3.md#120]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-018: the subheader uses width-based md:hover while the nav uses capability-based [@media(hover:hover)] — deliberately different mechanisms; whether the distinction matters needs a real narrow-desktop-window test.
- quote: "these are deliberately different mechanisms for two different components, and only a real narrow-desktop-window test would show whether that distinction matters in practice."
- kind: not-verified
- artifacts: src/components/app/ContractSubheader.tsx, src/components/app/AppLayout.tsx
- decision-mention: none

---

# INVENTORY (unviewed / dead / unreachable / preview-only)

### ITEM [batch4.md#3]
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: Deviation from the literal spec — the admin menu was placed in the executed-only "Manage" card rather than the named ContractSubheader, because that subheader is unmounted for executed documents.
- quote: "Deviation from the literal spec text, with reason: the spec says the surface is 'ContractPage.tsx subheader.' `ContractSubheader` ... is only rendered when `showDeck && id && !isExecuted` ... it is unmounted precisely when this button needs to exist."
- kind: correctness
- artifacts: ContractPage.tsx, ContractSubheader.tsx, SendCopiesMenu.tsx
- decision-mention: none

### ITEM [batch4.md#13]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: U3 exploitability not proven end-to-end — no member-reachable read that discloses another person's contacts.id was found, but not exhaustively checked.
- quote: "I did **not** find a member-reachable read that discloses another person's `contacts.id` ... I did not attempt the write, and I did not exhaustively enumerate every table for a `contacts.id` disclosure. The structural gap is proven; end-to-end exploitability is not."
- kind: not-verified
- artifacts: contacts.id, document_parties_self_read, member_directory
- decision-mention: none

### ITEM [batch4.md#16]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: first_name/last_name has one-way contacts→profiles sync only, so the two copies diverge when profiles-only write paths (Account.tsx, admin/team pages) run — community and legal document print different names.
- quote: "There is no trigger in the other direction. ... After any of those, the two copies hold different values. ... The community and the legal document would then print different names for the same person."
- kind: data-integrity
- artifacts: contacts, profiles, sync_profile_name_from_contact_trg, member_directory, {{PARTY.FULL_NAME}}
- decision-mention: none

### ITEM [batch4.md#20]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Two onboarding write paths (sign_release, update_my_onboarding_profile) use opposite precedence for the same fields — corrections saved through onboarding are silently discarded through release.
- quote: "Two write paths for the same onboarding fields, with opposite precedence ... The same person entering the same corrected emergency-contact phone gets it saved through `/app/onboarding` and silently discarded through `/release`."
- kind: data-integrity
- artifacts: sign_release, update_my_onboarding_profile, contacts
- decision-mention: none

### ITEM [batch4.md#42]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: None of the IDENTITY_MODEL_DESIGN phased build (P1–P5) exists yet — is_tenant absent, contact_affiliations absent, and the index the design marks DROPPED still present.
- quote: "State of the phased build — none of P1–P5 exists yet. ... `is_tenant` is absent, `contact_affiliations` is absent, and the `one_company_contact_per_org` index the design marks as DROPPED is still present."
- kind: inventory
- artifacts: is_tenant, contact_affiliations, one_company_contact_per_org
- decision-mention: none

### ITEM [batch4.md#44]
- report: TASK-ADDNEW-REPORT.md
- date: 2026-08-12
- item: PageCreateButton question left to the owner — three page-level controls (Messages, Home, MyPosts) arguably should read "Add New" but none use PageHeader/PageLayout; not acted on.
- quote: "PageCreateButton — reported, not changed ... I did not act on any of these — the task is explicit that this is the owner's call, not mine ... Flagging the design question rather than picking one."
- kind: blocked-on-owner
- artifacts: PageCreateButton.tsx, StableSection.tsx, CalendarPage.tsx, Messages.tsx, Home.tsx, MyPosts.tsx
- decision-mention: none

### ITEM [batch4.md#66]
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: Correction to the task's diagnosis — VOID unreachability was caused by the missing filter option, not by api-client.ts's .neq('status','VOID') (which is a different function on a different page); api-client.ts left untouched.
- quote: "One correction to the task's diagnosis ... That line is real, but it's in `listMySignableDocuments()` — a different function, on a different data seam ... I left `api-client.ts` untouched"
- kind: correctness
- artifacts: api-client.ts, listMySignableDocuments, listDocuments, DocumentQueueTable.tsx
- decision-mention: none

### ITEM [batch4.md#68]
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: The default view changed from all 74 documents to the 5 awaiting signature (Needs attention preset default) — a real behavior change, flagged explicitly.
- quote: "**This changes the page's default view** from showing all 74 documents to showing the 5 awaiting signature — flagging this explicitly since it's a real behavior change, not just a rendering fix."
- kind: correctness
- artifacts: DocumentsQueuePage.tsx
- decision-mention: none

### ITEM [batch4.md#74]
- report: TASK-DOCVIS-REPORT.md
- date: 2026-08-04
- item: caller_owns_document was deliberately NOT widened because a write path (signatures_insert_self) depends on it; only documents_select got a new OR-arm.
- quote: "`signatures_insert_self` is a **WRITE** path gated by `caller_owns_document`. ... because a write path depends on the helper, **the helper itself is not widened** — only `documents_select` gets a new OR-arm."
- kind: correctness
- artifacts: caller_owns_document, signatures_insert_self, documents_select, document_deliveries_select, signatures_select
- decision-mention: none

### ITEM [batch4.md#76]
- report: TASK-DOCVIS-REPORT.md
- date: 2026-08-04
- item: BUILD_TRACKER A17/A18/A19 set to PARTIAL — server-side fix verified, browser render of the Documents page not confirmed (re-verify pass's call); LESSEE company-party side remains BLOCKED.
- quote: "A17 changed from **FAIL** to **PARTIAL — server-side fix verified, browser pending** ... LESSEE side (company party) remains **BLOCKED** on both, unrelated to this task — see A7."
- kind: not-verified
- artifacts: BUILD_TRACKER.md, my_documents(), documents_select
- decision-mention: none

### ITEM [batch4.md#93]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: Correction to NOGUARD1 — it lists ContractPage.tsx as a caller of document_changes_frozen, but that is a comment, not a call.
- quote: "**Correction to NOGUARD1:** it lists `src/pages/app/ContractPage.tsx` as a caller of `document_changes_frozen`. That is a comment, not a call."
- kind: correctness
- artifacts: document_changes_frozen, ContractPage.tsx
- decision-mention: none

### ITEM [batch4.md#110]
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Most of the nav-icon assignment can't be applied until page merges exist (which aren't implemented); only 5 icons applied, the rest (Lessons, Horse care, People→Contact2, merged pages, Gifts) not applied.
- quote: "**'most of this assignment cannot be applied until [the merges] exist'** — and the merges are not implemented ... So the applied subset is only pages that survive the merges under their own name"
- kind: correctness
- artifacts: AppLayout.tsx, nav-icon-exercise.md
- decision-mention: none

### ITEM [batch4.md#112]
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Not verified — signed-in app on a real device, the mobile drawer open on a phone, and whether the avatar reads as "menu" to an untold user (a discoverability failure that can't be tested from here). No Supabase creds; screenshots from a throwaway harness.
- quote: "**Not verified, and someone should:** The signed-in app on a real device ... The mobile drawer *open*, on a phone. ... **Whether the avatar reads as 'menu'** ... I cannot test discoverability from here."
- kind: not-verified
- artifacts: AppHeader.tsx, AppLayout.tsx
- decision-mention: none

### ITEM [batch4.md#116]
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: SEPARATE FINDING not fixed — ensure_horse_documents sweeps documents with no status filter and has two EXECUTED signed documents in its blast radius right now; either is soft-deleted (signature and all) next run. Deliberately not fixed (needs a supersede decision).
- quote: "a signature-destroying sweep this task did not scope ... `ensure_horse_documents` sweeps with **no status filter at all** ... Two EXECUTED, signed documents are in its blast radius right now ... **I did not fix it, deliberately.**"
- kind: data-integrity
- artifacts: ensure_horse_documents, documents 152912dd (HORSE_EMERGENCY_VET), a8623897 (RELEASE_HORSE_CARE)
- decision-mention: none

### ITEM [batch4.md#117]
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: §3 kept the status <> 'EXECUTED' test rather than replacing it (task said key on "no live signature") — a judgment call: literal reading would let the sweep reach an EXECUTED document with no signature row, which the traps forbid.
- quote: "**I kept the `status <> 'EXECUTED'` test rather than replacing it.** ... taken literally, that would let the sweep reach an EXECUTED document that happens to carry no signature row, which the traps forbid outright."
- kind: correctness
- artifacts: 20260810T1300_sendguard_sweep_is_signature_aware.sql
- decision-mention: none

### ITEM [batch4.md#119]
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: No browser click-through — Register.tsx, ContractPage.tsx and contracts.ts changes verified by typecheck/lint/build and reading only; the "already-signed party lands on their document" claim proven at the RPC boundary, not by driving the UI.
- quote: "**No browser click-through.** The `Register.tsx`, `ContractPage.tsx` and `contracts.ts` changes are verified by typecheck, lint and build, and by reading the code paths — not by driving the UI."
- kind: not-verified
- artifacts: Register.tsx, ContractPage.tsx, contracts.ts
- decision-mention: none

### ITEM [batch4.md#120]
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: sendForReview refusal copy is exercised by no test — the shape is typechecked, the sentence is not proven against a real send.
- quote: "**`sendForReview` refusal copy** is exercised by no test. The shape is typechecked; the sentence is not proven against a real send."
- kind: not-verified
- artifacts: sendForReview, contracts.ts
- decision-mention: none

### ITEM [batch4.md#123]
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: Process note — the first §1 dry-run was not a dry-run; sourcing the migration with \i executed its own COMMIT and committed fixture rows, which were then deleted and all counts confirmed restored.
- quote: "The first §1 dry-run was not a dry-run. Sourcing the migration with `\i` inside an outer transaction executed the migration's own `COMMIT;`, which closed that transaction and committed the fixture rows ... I found it immediately, deleted every one"
- kind: process
- artifacts: 20260810T1200_sendguard_no_invite_after_signature.sql
- decision-mention: none

### ITEM [batch4.md#129]
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: No browser click-through — did not log in as Sarah or Madeline and navigate to /app/documents or the feed; verification is at the RPC layer only; RESIGN_REQUIRED renders actionable by code reading, not observation.
- quote: "**No browser click-through.** I did not log in as Sarah or Madeline and click to `/app/documents` ... Verification item 2 is satisfied at the RPC layer only ... I did not watch it not fire."
- kind: not-verified
- artifacts: AppLayout.tsx, my_wall_state(), Onboarding.tsx
- decision-mention: none

### ITEM [batch5.md#4]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: U2.8 insurance-deductible gating changes are staged as JSON only and must not be applied without the contract review thread's coherence ruling; sequencing is after U5's D1 field defs land.
- quote: "**`docs/staged/U2_8_deductible_gating.json` must not be applied** without the review thread's coherence ruling."
- kind: blocked-on-owner
- artifacts: docs/staged/U2_8_deductible_gating.json, INSURANCE_RISK.GL_DED_SIMPLE, INSURANCE_RISK.MORT_DEDR_SIMPLE, INSURANCE_RISK.MED_DEDR_SIMPLE, HORSE_LEASE_V2
- decision-mention: none

### ITEM [batch5.md#17]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: A brand-new party cannot redeem a contract invite — redeem_contract_invitation requires an existing profiles row, register-invited.ts creates auth.users directly, and there is no trigger on auth.users to auto-create profiles; owner scoped a deal-only-party account-creation pathway to a separate thread, not built here.
- quote: "**there is no trigger on `auth.users`** to auto-create a matching `profiles` row (confirmed: zero triggers). ... **Owner ruling (scoped to a separate thread, not built here)**"
- kind: defect
- artifacts: redeem_contract_invitation, api/register-invited.ts, profiles, auth.users, redeem_invitation
- decision-mention: none

### ITEM [batch5.md#18]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: Register.tsx's catch block masks the real activation error behind a generic message because it only reads err.message off JS Error instances, not Postgres/PostgREST error objects.
- quote: "`Register.tsx`'s catch block also masks the real error behind a generic \"We could not finish activating your account\""
- kind: defect
- artifacts: src/pages/Register.tsx
- decision-mention: none

### ITEM [batch5.md#19]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: CJ's own invite link (existing account) was reported by the owner as landing on a non-functional/"unwired" page — not independently reproduced or root-caused; logged as an open item needing live browser console/network evidence.
- quote: "reported by the owner as landing on a non-functional/\"unwired\" page — not independently reproduced or root-caused; logged as an open item needing live browser evidence"
- kind: not-verified
- artifacts: contract invite redemption page
- decision-mention: none

### ITEM [batch5.md#20]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: Verification items A3 (party fields mutually inert) and A4 (fully preconfigured, nothing demands review) were blocked by the invite-redemption blocker and never attempted.
- quote: "Depends on a working non-staff party session on the fresh contract, which A2's blocker prevented. Not attempted."
- kind: blocked
- artifacts: none
- decision-mention: none

### ITEM [batch5.md#21]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: Cold/direct navigation to any /app/... URL fails in the owner's Chrome session (reproduced across fresh tab and restart, not in Safari); suspected auth-bootstrap hang in AuthContext.tsx is plausible but unproven — needs a live repro with devtools open.
- quote: "plausible but unproven without live browser console/network evidence, which wasn't available. ... **Needs live repro with devtools open** to root-cause properly."
- kind: not-verified
- artifacts: src/contexts/AuthContext.tsx, /app/* routes
- decision-mention: none

### ITEM [batch5.md#22]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: The insurance "not required" checkbox carve-out is working as designed, but the code comment's assumption ("FHE is itself the Lessor") does not hold for a reverse-direction lease; whether staff should ever fill a counterparty's exclusive fields is a product decision left unmade.
- quote: "whether staff should ever fill a counterparty's exclusive fields on their behalf (mirroring the existing barn-office wet-signing precedent) is a product decision, not made here."
- kind: blocked-on-owner
- artifacts: contract_document_detail, TXN.GL_NOT_REQUIRED, TXN.MED_NOT_REQUIRED, TXN.MORT_NOT_REQUIRED
- decision-mention: none

### ITEM [batch5.md#25]
- report: TASK-A-PARTY-VERIFY-2-REPORT.md
- date: 2026-08-06
- item: UI feedback logged for backlog, not built — the staff Documents queue's "Contract" column (raw contract-id prefix) is wasted space; the owner wants a parties column instead.
- quote: "the \"Contract\" column (raw contract-id prefix) is wasted space; owner wants a parties column instead."
- kind: cosmetic
- artifacts: src/components/ops/documents/DocumentQueueTable.tsx
- decision-mention: none

### ITEM [batch5.md#27]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Part 1 (soft-delete of the two orphaned Beaumont documents) is written and dry-run but deliberately NOT applied — the owner is removing the two documents himself via the panel; the migration remains as the record.
- quote: "**Part 1 stays unapplied by owner ruling 2026-08-11 — the owner is removing those two documents from the panel himself.**"
- kind: blocked-on-owner
- artifacts: supabase/migrations/20260811T1000_contractorphan_delete_orphaned_documents.sql, documents (0360f829, fb6abc6c)
- decision-mention: none

### ITEM [batch5.md#28]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Side effect to expect before applying Part 1 — once the two orphaned docs are removed, the next ensure_horse_documents call for Beau will regenerate two fresh replacement documents, not leave a permanent absence.
- quote: "it means the owner should expect two fresh documents to appear, not a permanent absence."
- kind: caveat
- artifacts: ensure_horse_documents, RELEASE_HORSE_CARE, HORSE_EMERGENCY_VET
- decision-mention: none

### ITEM [batch5.md#29]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The session_replication_role=replica data-cleanup practice (which orphaned the contract by disabling RI triggers) is the standing hazard; the recommendation to stop using it on tables with SET NULL/CASCADE children and to anti-join-recheck FKs afterwards is NOT implemented.
- quote: "### Recommendation (not applied — out of this task's scope) `session_replication_role = replica` should not be used for data cleanup on tables with `SET NULL`/`CASCADE` children."
- kind: process
- artifacts: contracts, documents_contract_id_fkey, docs/reports/HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- decision-mention: none

### ITEM [batch5.md#30]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Honest limit stated — it cannot be proven that this specific contract row was deleted in the documented 2026-08-04 replica-mode session (no commit timestamps, no surviving status_events); the causal link is assumed on mechanism + date.
- quote: "**Honest limit:** I cannot prove that this specific contract row was deleted in that specific session."
- kind: not-verified
- artifacts: contracts (ae4ffe95)
- decision-mention: none

### ITEM [batch5.md#31]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Related live hazard noted — hard_delete_contract is the one routine non-superuser path that removes a contracts row; any future work running it under session_replication_role=replica reproduces the exact orphaning failure.
- quote: "any future work that runs it under `session_replication_role = replica` reproduces this exact failure."
- kind: known issue
- artifacts: hard_delete_contract
- decision-mention: none

### ITEM [batch5.md#32]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The armed FK hazard is not specific to signing — any staff action producing a second same-transaction update on the orphaned documents aborts (observed live on archive_contract during a tier-1 dry run).
- quote: "the archive was the **second same-transaction update** — the exact mechanism Part 1 describes, now observed on a real code path rather than reasoned about."
- kind: defect
- artifacts: documents_contract_id_fkey, archive_contract, set_recipient_editing
- decision-mention: none

### ITEM [batch5.md#33]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The document-integrity panel's render was never seen — no staff browser session; only RPC output, component source, and bundle strings were checked.
- quote: "**The render.** I have no staff browser session and was not given one. I have not seen this panel draw."
- kind: not-verified
- artifacts: src/components/ops/DocumentIntegrityPanel.tsx, src/pages/app/ops/OversightPage.tsx, document_integrity()
- decision-mention: none

### ITEM [batch5.md#34]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The signing flow succeeding after cleanup was not observed — the signing freeze is in force, so the reasoning (path not reached rather than fixed) is explicit but untested; nothing in the task lifts the freeze.
- quote: "**The signing flow succeeding after cleanup.** The signing freeze is in force, so I could not observe a signature. ... **Nothing here lifts the freeze.**"
- kind: not-verified
- artifacts: cleanup_document, signing flow
- decision-mention: none

### ITEM [batch5.md#36]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The bare NULL-guard idiom regenerates (can_cleanup_document itself was written into the class during NOGUARD3's session; census drifted 48→63); a lint/CI check on `has_staff_access() AND … = current_org()` outside a coalesce is proposed, not done.
- quote: "Nothing in this task stops the next one being written the same way. A lint or a CI check ... would; that is a proposal, not something done here."
- kind: process
- artifacts: has_staff_access(), current_org(), CI
- decision-mention: D1a

### ITEM [batch5.md#37]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: The missing-fields check (now key-based) fires only on absent keys; the stale-keys-held side (26–27 stale fields on the two flagged docs) is surfaced in the message but is arguably a second defect worth its own check.
- quote: "It would also surface the stale-key side, which is arguably a second defect worth its own check."
- kind: open question
- artifacts: document_integrity(), contract_field_defs, DOC-RXW6U9M3BF, DOC-U4PZP54FP5
- decision-mention: none

### ITEM [batch5.md#39]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Worktree incident — mid-task the worktree was swept of all untracked/ignored files including two uncommitted migration files (one already applied to prod); the file was rewritten and proven byte-identical, and migrations are now committed immediately after applying.
- quote: "Mid-task the worktree was swept of all untracked and ignored files: `.env`, `.env.db`, `node_modules` and two uncommitted migration files, one of which (`…T1250…`) had already been applied to production."
- kind: process
- artifacts: supabase/migrations/20260811T1250_contractorphan_missing_fields_by_key.sql
- decision-mention: none

### ITEM [batch5.md#40]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: Self-correction on the record — the earlier claim that the has_staff_access gate was uniformly correct was wrong; can_cleanup_document returned NULL for the platform owner and cleanup_document's RAISE fell through, a live D1-violating hole (fixed with coalesce in §NULL).
- quote: "Stating the gate as uniformly correct was wrong. Fixed and proven below."
- kind: correction
- artifacts: can_cleanup_document, cleanup_document
- decision-mention: D1a

---

### ITEM [batch5.md#41]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: Correction to the task doc's arithmetic — its "37" same-contact pairs is really 29 in the queue, because 8 pairs belong to soft-deleted documents the queue's deleted_at filter already excludes; flagged explicitly rather than silently proving a different number.
- quote: "The number the report proves below is **29**, the one actually reachable in this queue; I'm flagging the arithmetic explicitly"
- kind: correction
- artifacts: document_parties, documents, listDocuments()
- decision-mention: none

### ITEM [batch5.md#42]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: Correction — the task names party_role='FHE' as the company marker, but FHE has 0 rows; keying on it would miss all 4 real company-as-LESSEE occurrences, so contacts.is_company is used instead.
- quote: "keying \"render as company\" off `party_role = 'FHE'` would silently miss all 4 real occurrences today."
- kind: correction
- artifacts: document_parties, contacts.is_company, src/lib/ops/partyDisplay.ts
- decision-mention: none

### ITEM [batch5.md#43]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: The role-rank ordering beyond LESSOR/LESSEE and the CLIENT/PARTICIPANT special case is a best-effort total order over roles with zero production rows (SELLER/BUYER, RIDER, OWNER, CONTRACTOR, FACILITY_CONTACT, EMERGENCY_CONTACT, PARENT, GUARDIAN) — declared unexercised, worth an owner look before load-bearing.
- quote: "If any of these starts appearing paired with another role, the generic rank-order branch decides party 1/2 — untested against real data, and worth a second look from the owner before it's load-bearing."
- kind: not-verified
- artifacts: src/lib/ops/partyDisplay.ts, document_parties
- decision-mention: none

### ITEM [batch5.md#44]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: deriveDocumentParties keeps only the two highest-ranked contacts and silently drops any beyond two — a limitation with no live data to prove or disprove the branch.
- quote: "keeps the two highest-ranked contacts and drops any beyond that if it ever happens ... Flagged as a limitation, not a proven behavior."
- kind: caveat
- artifacts: src/lib/ops/partyDisplay.ts
- decision-mention: none

### ITEM [batch5.md#45]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: The company contact renders as plain text with no link because it has no reachable record page (contact_type='TEAM' fails admin_client_accounts arm 3's type check on purpose) — reported rather than emitting a dead link.
- quote: "the one person-shaped party with no reachable record page (the company) is reported here rather than emitting a dead link"
- kind: inventory
- artifacts: admin_client_accounts(), contacts (company contact), PartyCell
- decision-mention: none

### ITEM [batch5.md#46]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: The is_admin() gate on admin_client_accounts was not re-verified end-to-end — no staff JWT exists in the environment; only the structural WHERE conditions of each arm were checked against the 17 party contacts.
- quote: "**The `is_admin()` gate itself I did not touch or re-verify end-to-end** — that's a render-level check this environment can't perform"
- kind: not-verified
- artifacts: admin_client_accounts(), is_admin()
- decision-mention: none

### ITEM [batch5.md#47]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: The default-on date column choice (Date Signed, with Date Sent/Voided defaulting off) is an interpretive call on an under-specified spec point, flagged for owner veto.
- quote: "This is an interpretive call on an under-specified point, not a literal instruction; flagging it so the owner can veto if Sent/Voided were meant to default on too."
- kind: blocked-on-owner
- artifacts: src/components/ops/documents/DocumentQueueTable.tsx
- decision-mention: none

### ITEM [batch5.md#52]
- report: TASK-DOCPACKET-REPORT.md
- date: 2026-08-11
- item: Pre-existing defect found, not fixed — Admin.tsx's Documents tab calls docDisplayLabel without currentStatus, so a superseded document displays as plain "Signed" and the packet's "X of Y signed" count can overstate by one for anyone mid-re-sign (CJ Z's live case).
- quote: "it means the count can currently overstate \"signed\" by one for anyone mid-re-sign ... Worth its own follow-up task; out of scope here"
- kind: defect
- artifacts: src/pages/app/Admin.tsx, docDisplayLabel, src/lib/documentStatus.ts
- decision-mention: none

### ITEM [batch5.md#56]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The cardstock header was never seen inside the running app (no Supabase credentials) — dropdown MenuLink targets, admin/staff/superadmin branches against real useAuth, and the header above real content rest on code reading; click-through wanted before merge.
- quote: "**I never saw this inside the running app.** No Supabase credentials, so I could not sign in. ... **Worth a click-through before merge.**"
- kind: not-verified
- artifacts: src/components/app/CardstockHeader.tsx, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM [batch5.md#57]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: No real-device verification — iOS tap-highlight suppression, -webkit-touch-callout, safe-area insets beside a notch, touchcancel/drag-off release, and iOS feGaussianBlur behaviour are all unverified (code is the reference's verbatim).
- quote: "Not verified on real hardware: iOS tap-highlight suppression, `-webkit-touch-callout`, `env(safe-area-inset-*)` behaviour beside a notch"
- kind: not-verified
- artifacts: src/components/app/header-cardstock.css, CardstockHeader.tsx
- decision-mention: none

### ITEM [batch5.md#85]
- report: TASK-PURPOSEFIX-REPORT.md
- date: 2026-08-11
- item: The task's named test document (9a56b738, AVERIFY2 lease) was already VOID from a prior cleanup, so the live proof used a fresh disposable test document instead; Beaumont-referencing documents were deliberately avoided due to the separate TASK-SUPERSEDE armed defect.
- quote: "The task's named test document ... turned out to already be **VOID** — voided 2026-08-06 by a prior cleanup task"
- kind: correction
- artifacts: documents (9a56b738, b7233813), start_lease_contract_v2
- decision-mention: none

### ITEM [batch5.md#115]
- report: TASK-UIPOLISH-REPORT.md
- date: 2026-08-05
- item: Browser verification pending for all five UI items (I6–I10) — the task disallowed DB access so there was no way to sign in; specifically needs owner eyes on the glass tint strength, the debossed wordmark legibility (one-line text-cream-200 fallback offered), and the new Account rail entry/reordered nav at real viewports.
- quote: "**Browser verification, all five UI items (I6–I10).** ... This is a hard constraint of the task as scoped, not an oversight — flagged clearly rather than claiming a visual check that didn't happen."
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx, AppOverviewModal.tsx, Home.tsx, NAV_GLASS
- decision-mention: none

### ITEM [batch6.md#6]
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: Orders page in Account has a back button that routes to the Community feed instead of back to Account; not investigated or fixed.
- quote: "the Orders page in Account has a back button that routes to the Community feed instead of back to Account. Unrelated to this task's items; not investigated or fixed."
- kind: defect
- artifacts: Orders page, Account
- decision-mention: none

### ITEM [batch6.md#8]
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: A7/A17/A18/A19 for LESSEE were declared BLOCKED on code-level proof alone — no browser click was spent confirming empirically.
- quote: "No click was spent confirming this empirically for A17-19 once the code-level proof was clear for A7 ... so a browser attempt would fail for the identical, already-proven reason."
- kind: not-verified
- artifacts: ContractPage
- decision-mention: none

---

### ITEM [batch6.md#12]
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: MyLessons and Documents each need an explicit Phase 2 design decision before expanding inline (three network calls / reconciliation height); flagged rather than silently decided.
- quote: "I'd flag both as needing one explicit Phase 2 design call each ... rather than silently deciding it during the build."
- kind: blocked-on-owner
- artifacts: MyLessons.tsx, Documents.tsx, DocumentsPanel, SessionNotesView, ReportCard
- decision-mention: none

### ITEM [batch6.md#17]
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: The runtime behavior of my_documents / listMySignableDocuments RPCs was assumed from client-side types, not traced end-to-end server-side; the extraction cost estimates are read-time judgments, not rehearsed.
- quote: "Assumed, not traced end-to-end: the actual runtime behavior of my_documents / listMySignableDocuments RPCs server-side (I read the client-side types/usage, not the SQL)"
- kind: not-verified
- artifacts: my_documents, listMySignableDocuments
- decision-mention: none

---

### ITEM [batch6.md#24]
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: NOT VERIFIED — every interaction/geometric claim; no staff browser session, jsdom has no layout engine, so all interaction claims rest on the style contract.
- quote: "NOT VERIFIED — every interaction claim. There is no staff browser session and I was not given one. jsdom has no layout engine, so anything geometric is asserted on the style contract"
- kind: not-verified
- artifacts: AddElementModal.tsx
- decision-mention: none

### ITEM [batch6.md#28]
- report: TASK-COSIGN-REPORT.md
- date: 2026-08-05 (approx; no explicit header date)
- item: The pre-existing "sign on a party's behalf" UI has silently offered a broken always-erroring button for individual parties since 2026-08-03; flagged in case any staff hit the error, no evidence found but no systematic log search performed.
- quote: "has silently offered a broken (always-erroring) button for individual parties since 2026-08-03 ... no evidence found that anyone did ... though no systematic log search was performed"
- kind: defect
- artifacts: ContractPage.tsx, record_signature, lock_and_sign_contract
- decision-mention: none

### ITEM [batch6.md#30]
- report: TASK-COSIGN-REPORT.md
- date: 2026-08-05
- item: No production document currently sits in locked state, so there was no live already-locked document to visually confirm the box against; a throwaway rolled-back document was used.
- quote: "No production document currently sits in locked state ... so there was no live, already-locked document to visually confirm the box against"
- kind: not-verified
- artifacts: documents, workflow_state
- decision-mention: none

### ITEM [batch6.md#31]
- report: TASK-COSIGN-REPORT.md
- date: 2026-08-05
- item: Sarah's real document cannot be advanced to locked as part of this task (read-only hard rule) — its trace is reasoned from live RPC output, not a rendered screenshot.
- quote: "Sarah's real document cannot be advanced to locked as part of this task (it's read-only by hard rule) — its trace above is reasoned from the live RPC output, not a rendered screenshot."
- kind: not-verified
- artifacts: document 704c8d2d, contract_document_detail
- decision-mention: none

---

### ITEM [batch6.md#40]
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: Comments-only "barn" mentions across several api/ and component files left untouched as low-value churn.
- quote: "Comments only, left untouched (not user-facing, low value to churn): api.ts, api-barnops.ts, api-lessons.ts, api-calendar.ts, ContractPage.tsx ..."
- kind: cosmetic
- artifacts: api.ts, api-barnops.ts, api-lessons.ts, api-calendar.ts, ContractPage.tsx, CalendarItemPanel.tsx, PublicIntakeForm.tsx
- decision-mention: none

### ITEM [batch6.md#41]
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: test/db PGlite harness is independently broken today (snapshot fixture violates products_module_key_fkey; full replay hits a break at 20260728010000_release_family_signer_side.sql) — verified this migration by replaying up to the checkpoint instead.
- quote: "both the checked-in snapshot and a full fresh-migration replay are independently broken today for reasons unrelated to this task"
- kind: known-issue
- artifacts: test/db, schema_snapshot, 20260728010000_release_family_signer_side.sql
- decision-mention: none

---

### ITEM [batch6.md#51]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: The staff-assigned path (owner_contact_id) was not tested against production, only the client path Claire used; the same scrub is claimed to cover both.
- quote: "I did not test the staff-assigned path (owner_contact_id) against production, only the client path Claire used; the same scrub covers both."
- kind: not-verified
- artifacts: staffUpdateHorse, create_horse_record
- decision-mention: none

### ITEM [batch6.md#59]
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Open labelling question, deliberately not resolved — HORSE_LEASE_V2 and the retired HORSE_LEASE share the title "Horse Lease Agreement"; a picker listing by title is ambiguous, and renaming V2 is forbidden by the task.
- quote: "Open labelling question, deliberately not resolved. ... renaming it is explicitly forbidden by this task, so I left both paths visible rather than invent a convention."
- kind: blocked-on-owner
- artifacts: HORSE_LEASE_V2, HORSE_LEASE, NewContractPage.tsx picker
- decision-mention: none

### ITEM [batch6.md#61]
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: npm run build was NOT run for this task.
- quote: "npm run build was not run."
- kind: not-verified
- artifacts: build
- decision-mention: none

### ITEM [batch6.md#62]
- report: TASK-LEASEFORK-REPORT.md
- date: 2026-08-07
- item: Did not audit every DB function for the literal HORSE_LEASE_V2 — only start_lease_contract_v2, its single UI caller, and confirmed no other DB function calls that RPC.
- quote: "That no other code path keys off the literal HORSE_LEASE_V2 in a way the forks would need to satisfy. ... I did not audit every function in the database for the literal."
- kind: not-verified
- artifacts: start_lease_contract_v2
- decision-mention: none

### ITEM [batch6.md#64]
- report: TASK-LEASESIMPLE-REPORT.md
- date: (no explicit header date; branch off origin/main 0635acb)
- item: No content decision made — the Keep/Cut column is blank on all 144 rows; the owner and Claire decide what a simple lease contains.
- quote: "No content decision has been made. The Keep / Cut column is blank on all 144 rows. ... The owner and Claire decide what a simple lease contains."
- kind: blocked-on-owner
- artifacts: WORKSHEET.md, HORSE_LEASE_SIMPLE
- decision-mention: none

### ITEM [batch6.md#71]
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08
- item: F1/F2 (eight nav items share Shield icon) blocked upstream on the admin page refactor — proposed icon merges aren't implemented; nothing to build without unilaterally doing the admin refactor.
- quote: "Icon reassignment: blocked upstream, not a MOBILEPASS decision. ... most of the assignment 'cannot land until they exist.' Nothing to build here"
- kind: blocked-on-owner
- artifacts: nav icons, docs/reference/nav-icon-exercise.md
- decision-mention: none

### ITEM [batch6.md#72]
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08
- item: F5 sign-out glyph-choice part blocked with A9/A10 — same admin-refactor sequencing as F1; not attempted.
- quote: "Glyph-choice part: blocked with A9/A10 per OPEN-CHANGE-REQUESTS, same admin-refactor sequencing as F1. Not attempted."
- kind: blocked-on-owner
- artifacts: sign-out glyph
- decision-mention: none

### ITEM [batch6.md#93]
- report: TASK-ROSTER-REPORT.md
- date: 2026-08-10
- item: Slot-count scaling caveat — if the service-band slot count passes ~12 the band needs a design pass, not more columns; a service type with consumed history but no slot grows a trailing "Other" column.
- quote: "If the slot count ever passes ~12 the band needs a design pass, not more columns (noted in code)."
- kind: caveat
- artifacts: RosterRow, roster_service_slots
- decision-mention: none

### ITEM [batch7.md#1]
- report: TASK-A12-REPORT.md
- date: 2026-08-04
- item: The A11 "Leased to"/"Your lease" line inside the Location card was left untouched, out of scope, and is not simply redundant with the new Lease card.
- quote: "The pre-existing "Leased to"/"Your lease" line inside the "Location" card (A11) was left untouched — out of this task's scope"
- kind: correctness
- artifacts: src/pages/app/HorsePage.tsx
- decision-mention: none

### ITEM [batch7.md#2]
- report: TASK-A12-REPORT.md
- date: 2026-08-04
- item: No browser step ran; the UI (Lease card, HorsePageDetail type) is code-complete and typecheck-clean but not visually confirmed. Tracker marked PARTIAL.
- quote: "No browser step ran in this task — the UI ... is code-complete and typecheck-clean but has not been visually confirmed in a browser."
- kind: not-verified
- artifacts: src/pages/app/HorsePage.tsx, src/lib/horses.ts, docs/archive/BUILD_TRACKER.md
- decision-mention: none

### ITEM [batch7.md#3]
- report: TASK-A14-REPORT.md
- date: 2026-08-04
- item: STATUS detail renders the raw status label, not a from→to string, because status_events has no "from" column — a deviation from the doc.
- quote: "STATUS `detail` is the raw status label, not a from→to string — `status_events` has no "from" column; fabricating one would violate the doc's own "do not invent" instruction"
- kind: correctness
- artifacts: status_events, contract_event_log
- decision-mention: none

### ITEM [batch7.md#4]
- report: TASK-A14-REPORT.md
- date: 2026-08-04
- item: The DELIVERED kind is declared in the doc's vocabulary but never emitted because document_deliveries has no send/delivered distinction.
- quote: "`DELIVERED` kind is declared but never produced (see above) — data has no send/deliver distinction"
- kind: correctness
- artifacts: document_deliveries, contract_event_log
- decision-mention: none

### ITEM [batch7.md#5]
- report: TASK-A14-REPORT.md
- date: 2026-08-04
- item: OPENED kind was added beyond the doc's four required kinds, from a real document_opened table the doc did not anticipate existing.
- quote: "`OPENED` kind was added beyond the doc's four required kinds — a real source (`document_opened`) exists"
- kind: correctness
- artifacts: document_opened, contract_event_log
- decision-mention: none

### ITEM [batch7.md#15]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: R-1 — the admin's own dashboard /app/ops has no nav entry; OpsDashboard and InstructorHome are both dark, so a trainer has no landing surface at all.
- quote: "`/app/ops` — the admin's own dashboard cannot be opened ... A trainer signing in has no landing surface at all."
- kind: defect
- artifacts: /app/ops, OpsHome, OpsDashboard.tsx, InstructorHome
- decision-mention: none

### ITEM [batch7.md#21]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: X-4 — three horse surfaces (Horses / Records / unreachable Horses) all read the same roster; which two to remove is a Phase 2 design call.
- quote: "Two of the three horse surfaces | Horses / Records / (unreachable) Horses all read the same roster | Which two is a Phase 2 design call"
- kind: blocked-on-owner
- artifacts: /app/ops/horse-records, /app/ops/records, /app/ops/horses
- decision-mention: none

### ITEM [batch7.md#30]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: F-2 — the consumption side has never been exercised: 0 of 319 bookings carry purchase/credit/contract links and no unit carries a booking_id, so an obligations view would show only open units.
- quote: "The consumption side has never been exercised. Not one booking of any status carries a `purchase_id`, `credit_id` or `contract_id` — 0 of 319"
- kind: data-integrity
- artifacts: bookings, fulfillment_units
- decision-mention: none

### ITEM [batch7.md#52]
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: Out of scope (per locked design) — purge-routine guardian orphaning (what happens to a minor's records if the guardian is deleted/merged) not addressed.
- quote: "Purge-routine guardian orphaning (what happens to a minor's records if their guardian contact is deleted/merged) — not addressed."
- kind: out-of-scope
- artifacts: purge_account
- decision-mention: none

### ITEM [batch7.md#53]
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: Out of scope — sign-start self-serve age screening (kiosk-side minor detection before a release is signed) not addressed; sign_release's form-DOB validator untouched.
- quote: "Sign-start self-serve age screening ... not addressed; `sign_release`'s existing form-DOB validator is untouched"
- kind: out-of-scope
- artifacts: sign_release
- decision-mention: none

### ITEM [batch7.md#78]
- report: TASK-GUARDREST-REPORT.md
- date: 2026-08-12
- item: Flagged #1 — a document points at a contract that does not exist; any attach_horse_to_document on it dies on documents_contract_id_fkey. The armed defect TASK-SUPERSEDE recorded. Out of scope.
- quote: "A document points at a contract that does not exist ... This is the armed defect TASK-SUPERSEDE recorded ... Out of scope — guard-only."
- kind: data-integrity
- artifacts: documents.contract_id, contracts, attach_horse_to_document
- decision-mention: none

### ITEM [batch7.md#92]
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: Open question — drop void_signatures_on_edit or guard it (owner decides). It has no caller; guarding preserves dead code, dropping is cleaner and reversible.
- quote: "Drop `void_signatures_on_edit`, or guard it? It has no caller anywhere. Guarding preserves dead code"
- kind: blocked-on-owner
- artifacts: void_signatures_on_edit
- decision-mention: none

### ITEM [batch7.md#107]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — overloads not checked; keyed on proname in several places, so two same-named functions with different signatures would be conflated (one guarded overload could mask an unguarded one).
- quote: "Overloads. I keyed on `proname` in several places ... one guarded overload could mask an unguarded one. I did not check for overloads"
- kind: not-verified
- artifacts: pg_proc
- decision-mention: none

### ITEM [batch7.md#111]
- report: TASK-PARTYCTRL-REPORT.md
- date: 2026-08-04
- item: Default-values deviation — used the uniform UI-panel default (can_fill true, rest false) for all party roles rather than the reference doc's role-asymmetric rows, since that asymmetry doesn't generalize to BUYER/SELLER; per the task spec's own instruction.
- quote: "used `ContractPage.tsx`'s panel instead ... All three starters (and the backfill) seed every non-FHE/COMPANY party role with this same uniform default."
- kind: correctness
- artifacts: document_party_controls, ContractPage.tsx, set_party_controls
- decision-mention: none

### ITEM [batch7.md#113]
- report: TASK-PARTYCTRL-REPORT.md
- date: 2026-08-04
- item: A2's tracker status left as NOT VERIFIED — send-to-parties itself is still unverified live and is the party-verify thread's item, not this task's.
- quote: "A2's status left as `NOT VERIFIED` unchanged — send-to-parties itself is still unverified live and is the party-verify thread's item"
- kind: not-verified
- artifacts: docs/archive/BUILD_TRACKER.md
- decision-mention: none

### ITEM [batch8.md#2]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: REQ-26 (the deal-workflow inventory document the external UI-spec thread is blocked on) was requested twice and never produced — flagged as the largest outstanding item.
- quote: "REQ-26 (inventory document) — never produced, despite being requested twice and being the artifact the external UI-spec thread is blocked on. **This is the largest outstanding item.**"
- kind: blocked-on-owner
- artifacts: (inventory document, not created)
- decision-mention: none

### ITEM [batch8.md#3]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: REQ-21 partial — the deal-record button exists only on the deal page, not on deals-list tiles or on party/horse records with contextual text.
- quote: "deal-record button is only on the deal page. Not on deals-list tiles, not on party accounts ('Sale of Beau on [date]'), not on horse records ('Ownership Transfer of Beau on [date]')."
- kind: blocked-on-owner
- artifacts: src/pages/app/ops/DealsPage.tsx, src/pages/app/ops/DealPage.tsx, HorsePage.tsx
- decision-mention: none

### ITEM [batch8.md#5]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: The checked-out branch is named `work/ui-design` but tracks and pushes to `origin/main`, so the next session inherits a misleading branch name.
- quote: "**Branch is `work/ui-design`, not `main`.** It tracks `origin/main` and all pushes went there, so `main` is correct — but the next session inherits a branch whose name implies otherwise."
- kind: process
- artifacts: branch work/ui-design
- decision-mention: none

### ITEM [batch8.md#8]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: One audit_logs row of test residue from Stage-4 signature-withdrawal testing was left uncleaned in production.
- quote: "**Residue: 1 `audit_logs` row** from Stage-4 signature-withdrawal testing (`old_value->>'reason' = 'signature_withdrawn_by_party'`). Harmless but not real history."
- kind: data-integrity
- artifacts: audit_logs
- decision-mention: none

### ITEM [batch8.md#9]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: The new deal status vocabulary is display-layer only; the DB still stores EXECUTED, and a real rename would touch ~38 DB functions and ~20 frontend files.
- quote: "**Status vocabulary is display-only.** DB still stores `EXECUTED`; the badge derives Created/Editable/Signed/Complete. A future real rename touches ~38 DB functions and ~20 frontend files."
- kind: inventory
- artifacts: documents.status, deal_status
- decision-mention: none

### ITEM [batch8.md#10]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: deal_activity is composed at read time from other tables with no dedicated activity table, so anything not already logged elsewhere never appears in the log.
- quote: "**`deal_activity` is composed at read time** from documents, signatures and `contract_change_log` — no dedicated activity table. Anything not already logged does not appear."
- kind: caveat
- artifacts: deal_activity, contract_change_log
- decision-mention: none

### ITEM [batch8.md#11]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: reopen_deal still exists in the DB but nothing in the UI calls it — dead API surface.
- quote: "**`reopen_deal` still exists in the DB** but nothing in the UI calls it (replaced by Edit routing). Dead-ish API surface."
- kind: inventory
- artifacts: reopen_deal
- decision-mention: none

### ITEM [batch8.md#13]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Deal creation auto-adds documents in the modal with no transaction spanning both calls — if addDealDocument fails after createDeal succeeds, an empty deal is left behind.
- quote: "If `addDealDocument` fails after `createDeal` succeeds, an empty deal is left behind — no transaction spans both."
- kind: defect
- artifacts: createDeal, addDealDocument, src/pages/app/ops/DealsPage.tsx
- decision-mention: none

### ITEM [batch8.md#16]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Decision made without explicit sign-off — removing the co-buyer hand-entry path, deleting a capability explicitly requested in REQ-3.
- quote: "Removing the co-buyer hand-entry path (justified by L2a, but it deletes a capability explicitly requested in REQ-3)."
- kind: process
- artifacts: ContractPage.tsx co-buyer picker
- decision-mention: none

### ITEM [batch8.md#17]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Decision made without explicit sign-off — auto-generating documents inside the deal-creation modal, inferred rather than stated.
- quote: "Auto-generating documents inside the creation modal (inferred from 'the container is never empty', not stated)."
- kind: process
- artifacts: DealsPage.tsx creation modal
- decision-mention: none

### ITEM [batch8.md#18]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Decision made without explicit sign-off — dealLabel() fallback naming for untitled deals.
- quote: "`dealLabel()` fallback naming when a deal is untitled (`\"Sale — Beau\"`)."
- kind: process
- artifacts: src/lib/deals.ts (dealLabel)
- decision-mention: none

### ITEM [batch8.md#19]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: Decision made without explicit sign-off — voided documents are excluded from the deal record export.
- quote: "Excluding voided documents from the deal record export."
- kind: process
- artifacts: 20260803130001_deal_record_export.sql
- decision-mention: none

### ITEM [batch8.md#30]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: R3 already exists — the D3 branch of contract_lock_blockers enforces it today across all three insurance sections; the real question for the owner is whether it should be stricter.
- quote: "R3 is not new construction; the question is whether the owner wants it *stricter* than it already is."
- kind: blocked-on-owner
- artifacts: contract_lock_blockers
- decision-mention: none

### ITEM [batch8.md#35]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Silent-drop landmine — sync_contract_fields_from_defs enumerates columns explicitly on INSERT and UPDATE, so a new column (e.g. ineligible_when) not added there is silently dropped with no error; seed_cascade_fields and start_lease_contract_v2 need the same treatment.
- quote: "`sync_contract_fields_from_defs` **enumerates columns explicitly** on both its `INSERT` and its `UPDATE` — a new column not added there is silently dropped, with no error."
- kind: landmine
- artifacts: sync_contract_fields_from_defs, seed_cascade_fields, start_lease_contract_v2, contract_fields, contract_field_defs
- decision-mention: none

### ITEM [batch8.md#36]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Nothing in the sketched mechanism forces the ineligible value — set_contract_field has no gate awareness and an empty ineligible required field blocks the lock; where the forced value is stored from is an unsettled Phase 2 design decision.
- quote: "**Nothing forces the value.** `set_contract_field` has no gate awareness at all ... The value must actually be stored. Where from — the UI on load, a trigger, or the starter — is a Phase 2 design decision the task does not settle."
- kind: blocked-on-owner
- artifacts: set_contract_field, contract_lock_blockers
- decision-mention: none

### ITEM [batch8.md#38]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: ContractCascade.tsx would need the same ineligible-field treatment for form-side parity, and that design was not done.
- quote: "`ContractCascade.tsx` (the form-side view, also not frozen) has its own insurance awareness at `insuranceUnresolved` and would need the same treatment for parity; I have not designed that"
- kind: deferred
- artifacts: ContractCascade.tsx
- decision-mention: none

### ITEM [batch8.md#40]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Open question Q2 — whether R4 applies to all three sections or only GL cannot be inferred and needs the owner before anything is removed.
- quote: "**Cannot be inferred — needs the owner.** ... an asymmetry someone should choose deliberately rather than inherit. **Confirm before removing anything.**"
- kind: blocked-on-owner
- artifacts: TXN.GL_NOT_REQUIRED, TXN.MORT_NOT_REQUIRED, TXN.MED_NOT_REQUIRED
- decision-mention: none

### ITEM [batch8.md#44]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Assumed, not checked — that the owner's live client on the no-insurance arrangement is on a paper or pre-V2 lease; no document in the database matches the S4 configuration.
- quote: "that the owner's 'live client on exactly that arrangement' is on a **paper or pre-V2** lease. No document in the database is in the S4 configuration"
- kind: not-verified
- artifacts: documents (ecaecd42)
- decision-mention: none

### ITEM [batch8.md#46]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: Work deliberately stopped for owner review — Q1, Q2 and Q3 gate Phase 2; R1/R2 cannot be built safely until Q1 is answered.
- quote: "**Stopping here for owner review**, as the task requires. ... R1 and R2 cannot be built safely until Q1 is answered, because their failure mode on an uncovered Lessor is currently absorbed by the waiver R4 removes."
- kind: blocked-on-owner
- artifacts: HORSE_LEASE_STANDARD
- decision-mention: none

### ITEM [batch8.md#49]
- report: TASK-LEASESET-REPORT.md
- date: 2026-08-11
- item: Branch task/leaseset (one migration commit plus report) is local only, deliberately not pushed.
- quote: "**Did not push.** Branch `task/leaseset` has one migration commit plus this report, local only."
- kind: process
- artifacts: branch task/leaseset, 20260811T1800_leaseset_standard_simple_detailed_archive.sql
- decision-mention: D10

### ITEM [batch8.md#63]
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Sign out's iOS safe-area handling (the owner's explicit ask) still needs a real notched phone; the code-level mitigation is in place but unproven.
- quote: "**Sign out's iOS safe-area handling** (owner's explicit ask). ... exactly the kind of thing that can look right in every harness and still be wrong on an actual notched phone."
- kind: not-verified
- artifacts: NavFooter (AppLayout.tsx)
- decision-mention: none

### ITEM [batch8.md#69]
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Sign out was verified by code trace only, not a live click.
- quote: "Verified by code trace, not a live click — see 'Not verified' below. ⚠️"
- kind: not-verified
- artifacts: NavFooter, handleSignOut
- decision-mention: none

### ITEM [batch8.md#71]
- report: TASK-PAGEFRAME-REPORT.md
- date: 2026-08-11
- item: Width judgment flagged for owner veto — four pages' real max-w-5xl caps were rounded up to `wide` (6xl) since PageLayout has no exact bucket.
- quote: "flagging it here for the owner to veto if `wide` reads as too roomy on any of the four once seen live."
- kind: blocked-on-owner
- artifacts: DealsPage.tsx, ContactsPage.tsx, NewContractPage.tsx, DealPage.tsx, PageLayout
- decision-mention: none

### ITEM [batch8.md#72]
- report: TASK-PAGEFRAME-REPORT.md
- date: 2026-08-11
- item: ContractPage.tsx was deliberately left unconverted — forcing PageLayout on it would reintroduce a previously-fixed width bug and its per-document header doesn't fit PageHeader's contract; unifying it is a real design call for the owner.
- quote: "If the owner wants this page unified with the other eight regardless, that's a real design call — what would the gold eyebrow even say for a per-document page? — worth its own short conversation rather than a guess baked into this pass."
- kind: blocked-on-owner
- artifacts: src/pages/app/ContractPage.tsx, ContractSubheader, PageLayout, PageHeader
- decision-mention: none

### ITEM [batch8.md#75]
- report: TASK-PARTYRLS-REPORT.md
- date: 2026-08-06
- item: Found and NOT fixed — signatures_select gates on caller_owns_document (strict document ownership), so a signer party who isn't the document owner cannot see their own signature row; listMySignableDocuments' signed flag reads false for that party (structural for every lease's LESSOR); needs its own scoped task because the helper also backs a write path.
- quote: "**`signatures_select` / `caller_owns_document`** — §4 above. A signer party who isn't `documents.contact_id`'s owner can't see their own signature row ... it needs its own scoped task."
- kind: defect
- artifacts: signatures_select, caller_owns_document, signatures_insert_self, listMySignableDocuments
- decision-mention: none

### ITEM [batch8.md#76]
- report: TASK-PARTYRLS-REPORT.md
- date: 2026-08-06
- item: Correction — the task's diagnosis that document_deliveries had "the same class of gap" was wrong; it has carried a party-read OR-arm since the original migration and no change was made.
- quote: "**`document_deliveries` got no migration.** The task's diagnosis assumed it had 'the same class of gap.' Live verification ... shows it does not"
- kind: correction
- artifacts: document_deliveries, document_deliveries_select
- decision-mention: none

### ITEM [batch8.md#77]
- report: TASK-PARTYRLS-REPORT.md
- date: 2026-08-06
- item: The browser click-through/PDF/download visual check remains for the owner — no browser session could be opened.
- quote: "**The browser click-through/PDF/download visual check itself remains for the owner.**"
- kind: not-verified
- artifacts: listMySignableDocuments, Documents page
- decision-mention: none

### ITEM [batch8.md#78]
- report: TASK-PARTYRLS-REPORT.md
- date: 2026-08-06
- item: Assumed, not verified — that the frontend renders signed:false rather than throwing when a document has no matching signatures row for the caller; read but not click-tested.
- quote: "Assumed, not verified: that the frontend renders `signed: false` rather than throwing when a document has no matching `signatures` row for the caller"
- kind: not-verified
- artifacts: AccountPanels.tsx, Documents.tsx
- decision-mention: none

### ITEM [batch8.md#79]
- report: TASK-PARTYRLS-REPORT.md
- date: 2026-08-06
- item: A second live party session for the shared lease could not be tested end-to-end — the LESSEE contact has no profiles row (no login); cross-contact isolation stood in for it.
- quote: "The LESSEE contact has no `profiles` row (no login), so a second live party session for that specific document wasn't available to test end-to-end"
- kind: not-verified
- artifacts: document_parties_self_read, contact 352c3898
- decision-mention: none

### ITEM [batch8.md#87]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: The browser upload path is NOT VERIFIED — no staff browser session; the supabase-js round trip (multipart PUT, MIME sniffing, signed-URL fetch) is unproven; owner checklist provided.
- quote: "**The browser upload path is NOT VERIFIED.** ... What is unproven is the round trip through `supabase-js` — the multipart PUT, the MIME sniffing, and the signed-URL fetch."
- kind: not-verified
- artifacts: src/lib/files.ts, FilesContent.tsx, ContentStorePage
- decision-mention: none

### ITEM [batch8.md#99]
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Aside, not fixed — 60 of 64 test/db files already fail on unmodified origin/main, dominated by fixtures still provisioning through provision_lesson_invitation which queries the removed offering_tiers table.
- quote: "found 60 of 64 files already failing on unmodified `origin/main`, independent of this task — the dominant cause is `offering_tiers` no longer existing"
- kind: known issue
- artifacts: test/db, provision_lesson_invitation, offering_tiers, rider_onboarding.test.ts, minor_onboarding.test.ts, esign_hardening.test.ts
- decision-mention: none

