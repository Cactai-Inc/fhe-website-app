# FLAGHARVEST batch 2 — extraction

Files: POST_RUN_CLOSEOUT.md, PROMPT_A_STAGES_4-5.md, TASK-A15-REPORT.md, TASK-A8-REPORT.md,
TASK-B-REPORT.md, TASK-C-REPORT.md, TASK-GIFTCREDITS-REPORT.md, TASK-INQUIRYMAIL-REPORT.md,
TASK-PAGEVIS-REPORT.md, TASK-PLUSPASS-REPORT.md, TASK-R11-REPORT.md, TASK-REVIEWNAV-REPORT.md,
TASK-ROSTERCARD-REPORT.md

---

## POST_RUN_CLOSEOUT.md

### ITEM
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: golden_render.test.ts calls a nonexistent `.sql()` method on the test harness (should be `.q()`) at all three call sites; reported and deliberately not fixed as out of Task 4's scope.
- quote: "Only `golden_render.test.ts` calls a nonexistent `.sql()` method, at all three of its call sites."
- kind: defect
- artifacts: test/db/golden_render.test.ts, test/db/harness.ts
- decision-mention: D21

### ITEM
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: The full test/db suite now runs for the first time and shows 97 failing tests and 38 fully-failing suite files that were not investigated individually — a body of findings needing a dedicated triage pass.
- quote: "The 97 failures and 38 fully-failing suite files were not investigated individually — outside Task 4's stated scope ... but are now visible for the first time and worth a dedicated pass."
- kind: defect
- artifacts: test/db
- decision-mention: none

### ITEM
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: Kiosk-to-account auto-promotion and new `/sign/guest|rider|horse|rider+horse` short URLs were explicitly deferred by the owner to a separate orchestrator-authored task.
- quote: "Kiosk-to-account auto-promotion + new `/sign/guest|rider|horse|rider+horse` short URLs — explicitly deferred by the owner to a separate, orchestrator-authored task."
- kind: blocked-on-owner
- artifacts: /release, Release.tsx, sign_release
- decision-mention: none

### ITEM
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: Kiosk signers get a contacts row with no linked account, have no self-serve signup route, and until invited have no path to H3's self-send and never see their document in-app — traced and reported, by design, not fixed.
- quote: "Until invited, a kiosk signer has no path to H3's self-send and never sees their document in-app — by design, not a defect."
- kind: inventory
- artifacts: contacts, redeem_invitation, /register, /activate, App.tsx
- decision-mention: none

### ITEM
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: docs/BACKLOG.md's other pre-existing open items (Business admin suite, pending_fee_candidates p.mobile bug, dead nav route, placeholder media) were untouched this run, out of scope.
- quote: "`docs/BACKLOG.md`'s other pre-existing open items (Business admin suite, `pending_fee_candidates` p.mobile bug, dead nav route, placeholder media) — untouched this run, out of scope."
- kind: inventory
- artifacts: docs/BACKLOG.md, pending_fee_candidates
- decision-mention: none

### ITEM
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: The H3/H2 curl matrix proved authorization logic with real sessions but did not exercise the email-click-through UX (tokens were inserted directly and redeemed via API, no email sent/clicked).
- quote: "this proves the endpoints' authorization logic using real sessions and real backend RPCs — it does not exercise the email-click-through UX"
- kind: not-verified
- artifacts: /api/deliver-my-document, /api/deliver-document, /api/register-invited, redeem_invitation
- decision-mention: none

### ITEM
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: The real-email H3 check against admin@fhequestrian.com is not applicable — the account is Google-OAuth-only with no password-grant equivalent for scripted testing; reported as N/A rather than blocked.
- quote: "That account authenticates via Google OAuth ... — there is no password-grant equivalent to exercise via curl."
- kind: not-verified
- artifacts: /api/deliver-my-document, auth.identities
- decision-mention: D22

### ITEM
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: Test document c36449f7 remains flagged "void or dispose at cleanup" in BACKLOG.md; its test field values were deliberately left as-is per that existing disposition.
- quote: "`c36449f7` is already flagged \"void or dispose at cleanup\" in `BACKLOG.md` from the prior session, so its test values were left as-is per that existing disposition"
- kind: process
- artifacts: docs/BACKLOG.md, documents (c36449f7)
- decision-mention: none

### ITEM
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: The governing spec hardening-unit-spec.md was found in ~/Downloads rather than the repo — flagged and located per instruction.
- quote: "`hardening-unit-spec.md` (found in `~/Downloads`, not the repo — flagged and located per instruction)"
- kind: process
- artifacts: hardening-unit-spec.md
- decision-mention: none

### ITEM
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: fhequestrian.com is a separate Namecheap-parked redirect domain, out of scope per instruction, not touched or tested this run.
- quote: "`fhequestrian.com` is the separate Namecheap-parked redirect domain, out of scope per instruction, not touched or tested this run"
- kind: inventory
- artifacts: fhequestrian.com
- decision-mention: none

### INVENTORY
- report: POST_RUN_CLOSEOUT.md
- what: A dead nav route and placeholder media are recorded as pre-existing open BACKLOG items, untouched.
- where: docs/BACKLOG.md
- quote: "Business admin suite, `pending_fee_candidates` p.mobile bug, dead nav route, placeholder media) — untouched this run, out of scope."

---

## PROMPT_A_STAGES_4-5.md

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: H2 hardening hit the owner's pre-declared stop-and-show gate (the release flow is sessionless); three options were laid out for the owner and nothing was applied — /api/deliver-document left unchanged.
- quote: "**Options for the owner, not applied:** ... None applied. `/api/deliver-document` is unchanged."
- kind: blocked-on-owner
- artifacts: /api/deliver-document, sign_release, Release.tsx, DeliveryPanel.tsx
- decision-mention: D10

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: H3's remaining curl-matrix rows (200/403/409 with valid sessions, one real email) and H4's manual send were BLOCKED — endpoint not deployed, no real Supabase env vars locally, and the one authorized real-email account has no password.
- quote: "The remaining rows of the matrix (200/403/409 on valid sessions, the one real email) are **BLOCKED** and reported as such — not inferred, not simulated."
- kind: blocked-on-owner
- artifacts: api/deliver-my-document.ts, src/pages/app/Documents.tsx
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: New systemic defect D15: remerge_contract_from_clauses (the re-render path run on every draft edit) has none of U2.1's money-rendering logic — currency fields render as bare numbers; reported to BACKLOG, not fixed.
- quote: "`remerge_contract_body` → `remerge_contract_from_clauses` ... has **none** of Stage 2's U2.1 money-rendering logic (`fmt_money`, `fee_schedule` JSON parsing)."
- kind: defect
- artifacts: remerge_contract_from_clauses, remerge_contract_body, fmt_money, docs/BACKLOG.md
- decision-mention: D15

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: pending_fee_candidates is already broken in production — `p.mobile` should be `c.mobile` (executing it live errors); pre-existing defect found during the Stage 5 sweep, reported not fixed.
- quote: "`pending_fee_candidates`' `p.mobile` is **already broken in production** ... `ERROR: column p.mobile does not exist, HINT: did you mean c.mobile`"
- kind: defect
- artifacts: pending_fee_candidates
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: profiles.phone was retained, not dropped — TeamPage.tsx's staff editor is a load-bearing third writer for the one SUPER_ADMIN account with no contact row; needs a conditional write path or an owner decision to provision a contact row for admin@cactai.io. The TeamPage code comment "Staff have no contact row" was verified wrong for 2 of 3 staff.
- quote: "**`profiles.phone` NOT dropped:** found a third writer — `TeamPage.tsx`'s staff editor (`adminUpdateProfile`), whose code comment claims \"Staff have no contact row.\" Verified live and the comment is **wrong** for 2 of 3 staff profiles"
- kind: blocked-on-owner
- artifacts: profiles.phone, TeamPage.tsx, adminUpdateProfile
- decision-mention: D14

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: U2.8 deductible gating remains staged only, not applied; its JSON should be updated to the any/equals positive form (the engine has no not_equals) before it is ever applied.
- quote: "**U2.8 deductible gating** — staged only, per the Stage 1–3 report; U2.8's JSON should be updated to the `any`/`equals` positive form per D12 before it is ever applied."
- kind: process
- artifacts: U2.8 gating JSON
- decision-mention: D12

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: The test/db harness is not fully green — the HORSE_EMERGENCY_VET template-body drift blocker (a self-verifying migration whose search string no longer matches on fresh replay) and a stale service_catalog.test.ts import of nonexistent src/lib/services are separate, unbounded follow-ups.
- quote: "`20260728010000_release_family_signer_side.sql` raises `\"signer-side binding missing in HORSE_EMERGENCY_VET\"` ... tracing which earlier migration left the body in an unexpected shape is unbounded work, a new unit."
- kind: defect
- artifacts: supabase/migrations/20260728010000_release_family_signer_side.sql, test/db/service_catalog.test.ts, src/lib/services
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: Harness Fix 3 (DROP FUNCTION in 20260710160000_my_stable_lessee.sql) is not safe to re-run against production and never will be — it fails there today on `column h.barn_name does not exist` (renamed to nickname by a later migration); correct only for from-empty replay.
- quote: "**Not safe to re-run against production, and never will be** — tested in a rolled-back transaction and it fails there *today* on `column h.barn_name does not exist`"
- kind: process
- artifacts: supabase/migrations/20260710160000_my_stable_lessee.sql
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: fhequestrian.com does not serve the application — it is Namecheap-parked with port 443 refusing connections; a DNS/registrar configuration issue reported as a finding, out of scope.
- quote: "**DOM/domain**: `fhequestrian.com` is Namecheap-parked, not serving the app — a DNS/registrar issue, reported, out of scope."
- kind: defect
- artifacts: fhequestrian.com
- decision-mention: D9

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: Six legacy contact columns were blocked from being dropped in U7 Stage B because live readers remain: admin_client_overview (rendered by Admin.tsx) reads mobile/whatsapp, mobile_display is a generated column on mobile, and member_directory still emits fields gated by hide_mobile/hide_whatsapp/hide_email.
- quote: "**Blocked, not dropped:** `mobile`, `whatsapp`, `mobile_display`, `hide_mobile`, `hide_whatsapp`, `hide_email`."
- kind: blocked-on-owner
- artifacts: contacts.mobile, contacts.whatsapp, contacts.mobile_display, admin_client_overview, member_directory, Admin.tsx
- decision-mention: D13

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: The plan's U7 text conflated an unrelated retirement — the "|| confirmed widenings and the types.ts:22 union member" is BACKLOG's purchases.status='confirmed' Stripe-vocabulary item, not a phone/contact column; left alone as report-only.
- quote: "The plan conflated two unrelated retirements; left alone as report-only, not applied here."
- kind: correctness
- artifacts: purchases.status, types.ts:22, docs/BACKLOG.md
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: The three new D2 insurance clauses carry bracketed `[PENDING LEGAL REVIEW]` placeholder bodies — no legal language drafted; body text awaits the contract review thread's C1 pass, with D3's signing gate preventing a placeholder reaching an executed instrument.
- quote: "Bodies are `[PENDING LEGAL REVIEW — …]` — no legal language drafted."
- kind: blocked-on-owner
- artifacts: INSURANCE_RISK.GL_LESSEE_RESP, INSURANCE_RISK.MORT_LESSEE_RESP, INSURANCE_RISK.MED_LESSEE_RESP, contract_clause_defs
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: Live draft b7446f9e has its MORTALITY insurance section genuinely unresolved right now — a real currently-live blocking condition discovered during D3 verification, not a synthetic scenario.
- quote: "draft `b7446f9e` has MORTALITY genuinely unresolved right now"
- kind: data-integrity
- artifacts: documents (b7446f9e), contract_lock_blockers
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: Two documents created this run are on the pre-launch cleanup list: c36449f7 (the sample's proof draft) and 4051bd91 (superseded first attempt, voided via void_document).
- quote: "both documents are recorded in `docs/BACKLOG.md`'s pre-launch cleanup list"
- kind: process
- artifacts: documents (c36449f7, 4051bd91), docs/BACKLOG.md
- decision-mention: none

### ITEM
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: No PDF was regenerated for the final sample — no PDF pipeline available in the environment; the markdown export stands in as the substantive artifact.
- quote: "No PDF regenerated (no PDF pipeline available in this environment; the markdown is the substantive artifact)."
- kind: not-verified
- artifacts: docs/contract-exports/SAMPLE_FHE_LESSEE_2026-08-02.md
- decision-mention: none

### INVENTORY
- report: PROMPT_A_STAGES_4-5.md
- what: The public-site Account page is described by its own code comment as legacy, serving only signed-in users without an active membership.
- where: src/pages (Account.tsx, per report: "the public-site `Account.tsx`")
- quote: "the public-site `Account.tsx` the plan named, which its own comment calls \"legacy... only serves signed-in users WITHOUT an active membership\""

---

## TASK-A15-REPORT.md

### ITEM
- report: TASK-A15-REPORT.md
- date: 2026-08-04
- item: True mailbox-level bounces (SMTP accepts then bounces later) are out of scope — Gmail SMTP gives no bounce webhook, so there is no signal the delivery-failure sweep can act on; nothing was built for it.
- quote: "True mailbox-level bounces (SMTP accepts the message, then bounces later) are **out of scope**. Gmail SMTP gives no bounce webhook to observe them"
- kind: process
- artifacts: sweep_undelivered_executed_documents, api/delivery-sweep.ts
- decision-mention: none

### ITEM
- report: TASK-A15-REPORT.md
- date: 2026-08-04
- item: All 37 currently undelivered executed documents have executed_email_sent_at IS NULL (they predate the stamping trigger) and are deliberately excluded from delivery-failure alerts — a different, already-known condition, left un-alerted by design.
- quote: "all 37 currently undelivered executed documents have `executed_email_sent_at IS NULL` (they predate the stamping trigger) — exactly the outcome the task doc predicted as correct."
- kind: inventory
- artifacts: documents.executed_email_sent_at, undelivered_executed_documents, document_deliveries
- decision-mention: none

---

## TASK-A8-REPORT.md

### ITEM
- report: TASK-A8-REPORT.md
- date: 2026-08-05
- item: New finding beyond the task doc: net.http_post is called without timeout_milliseconds, so pg_net's 5000ms default fires while /api/deliver-documents legitimately takes 6–8s — real successes read as timeouts in net._http_response; not fixed (out of scope), follow-up migration recommended.
- quote: "a real success can read as a timeout. **Not fixed** — out of scope ... Recommend a follow-up migration adding `timeout_milliseconds := 15000`"
- kind: defect
- artifacts: send_executed_document_email, net.http_post, net._http_response, api/deliver-documents.ts
- decision-mention: none

### ITEM
- report: TASK-A8-REPORT.md
- date: 2026-08-05
- item: Deviation: the task doc's assumed config_values key/value schema was wrong — the table has (namespace, key, value_text, value_num, value_json); queries were corrected by reading the actual table and its readers.
- quote: "`config_values` does not have a `key`/`value` pair — it has `(namespace, key, value_text, value_num, value_json)`."
- kind: correctness
- artifacts: config_values
- decision-mention: none

### ITEM
- report: TASK-A8-REPORT.md
- date: 2026-08-05
- item: Deviation: the doc's named test document ecaecd42 had pre-existing document_deliveries rows, so firing it only proved idempotent-skip behavior, not a fresh send; two substitute single-party owner-test documents were used for genuine fresh-send proof.
- quote: "the named test document cannot prove a fresh send, only idempotent-skip behavior."
- kind: correctness
- artifacts: documents (ecaecd42, 0ed5bf5b, 3f44ea13), send_executed_document_email, document_deliveries
- decision-mention: none

### ITEM
- report: TASK-A8-REPORT.md
- date: 2026-08-05
- item: Owner-flagged wrong-looking PDF date ("July 07, 2026") was investigated and confirmed not a bug — the test docs were genuinely signed 2026-07-07 and the direct status UPDATE test method never re-ran record_signature; in real usage signature and email trigger from the same event.
- quote: "**Not a bug:** `record_signature` substitutes the date into `merged_body` at the moment of the real signature."
- kind: correctness
- artifacts: record_signature, signatures.signed_at, merged_body
- decision-mention: none

### ITEM
- report: TASK-A8-REPORT.md
- date: 2026-08-05
- item: CONTACT.FROM_EMAIL is unset in config_values, so the from-address depends entirely on the TRANSACTIONAL_FROM_EMAIL Vercel env var, which cannot be read from this environment (proven set only indirectly by the live sends succeeding).
- quote: "`CONTACT.FROM_EMAIL` is unset, so the from-address depends on the `TRANSACTIONAL_FROM_EMAIL` Vercel env var, which cannot be read from here."
- kind: inventory
- artifacts: config_values (CONTACT.FROM_EMAIL), TRANSACTIONAL_FROM_EMAIL, api/_lib/email.ts
- decision-mention: none

---

## TASK-B-REPORT.md

### ITEM
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: Deviation flagged: the task's Goal frames support requests as a public website form, but support_requests RLS requires an authenticated member — the three outcomes were built anyway since the table is explicitly in scope, but the mismatch is flagged in case the intent was narrower.
- quote: "`support_requests` RLS (`support_own_insert`) requires `user_id = auth.uid()` — it's submitted by an authenticated app member from `/app/account`, not by an anonymous website visitor."
- kind: correctness
- artifacts: support_requests, submit_support_request, src/pages/app/Support.tsx
- decision-mention: none

### ITEM
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: The support-email pg_net dispatch currently 404s in production because api/support-received.ts exists only on this unpushed branch — it will only deliver real emails once the branch merges and deploys.
- quote: "`api/support-received.ts` only exists on this unpushed branch, so production Vercel has no route for it yet"
- kind: blocked-on-owner
- artifacts: api/support-received.ts, submit_support_request, net._http_response
- decision-mention: none

### ITEM
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: The public-intake email path fix was verified by code inspection and type/lint only — no live HTTP call possible (no SUPABASE_SERVICE_ROLE_KEY locally to invoke the Vercel function).
- quote: "the live email send for the public path was verified by code inspection + the type/lint pass, not a live HTTP call."
- kind: not-verified
- artifacts: api/request-received.ts, PublicIntakeForm.tsx
- decision-mention: none

### ITEM
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: The Inbound nav badge was not visually screenshotted — no running dev server/browser session; verified only by reading the shared RailLink render path the Dashboard badge already proves out.
- quote: "Not visually screenshotted (no running dev server / browser session in this pass) — verified by reading the shared `RailLink` render path"
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx, RailLink, inbound_open_count
- decision-mention: none

### ITEM
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: The avatar-menu's MenuLink render site was deliberately left unbadged — no nav-group item has ever shown a badge there, so this doesn't regress anything.
- quote: "The avatar-menu's `MenuLink` render site (`:681`) was left unbadged — no nav-group item has ever shown a badge there"
- kind: cosmetic
- artifacts: src/components/app/AppLayout.tsx (MenuLink)
- decision-mention: none

### ITEM
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: Mid-task git collision: the shared checkout was running multiple concurrent task branches, the original task/b-lead-notifications branch ref was moved onto an unrelated commit and two files were lost from disk; three of five files turned up byte-identical on origin/main swept into an unrelated pushed commit (04abab9); cleanup of the original branch and shared checkout is left to the orchestration owner.
- quote: "My original branch, `task/b-lead-notifications`, got its ref moved out from under me onto that unrelated R10 commit, and two of my five files ... were lost from disk"
- kind: process
- artifacts: task/b-lead-notifications, fhe-website-app checkout, api/request-received.ts, api/support-received.ts
- decision-mention: none

### INVENTORY
- report: TASK-B-REPORT.md
- what: The original task/b-lead-notifications branch sits abandoned pointing at an unrelated R10 commit; its cleanup was left to whoever owns orchestration.
- where: git branch task/b-lead-notifications, shared checkout fhe-website-app
- quote: "The original `task/b-lead-notifications` branch and the shared `fhe-website-app` checkout were left untouched, as directed — their cleanup belongs to whoever owns the orchestration"

---

## TASK-C-REPORT.md

### ITEM
- report: TASK-C-REPORT.md
- date: 2026-08-04
- item: Judgment call flagged: the rate-limit window is tumbling (anchored at the first request per hash), not a true sliding log — matches "10 submissions per rolling hour" in spirit; flagged in case a stricter interpretation was intended.
- quote: "Matches \"10 submissions per rolling hour\" in spirit; flagging in case a stricter interpretation was intended."
- kind: process
- artifacts: sign_start_attempts, sign_start_register_attempt, supabase/migrations/20260804120000_sign_start_rate_limit.sql
- decision-mention: none

### ITEM
- report: TASK-C-REPORT.md
- date: 2026-08-04
- item: Judgment call flagged: a genuine RPC/DB exception in /api/sign-start returns 500 rather than the spec's "same `{ ok: true }` body in every non-400 case" — matching admin-send-invitation's precedent for hard provisioning failure.
- quote: "**Unexpected-error response is a 500, not `{ ok: true }`.**"
- kind: process
- artifacts: api/sign-start.ts
- decision-mention: none

### ITEM
- report: TASK-C-REPORT.md
- date: 2026-08-04
- item: Deviation: /sign/:path was nested inside the `<Layout>` public-chrome route group rather than standalone like /release, because the spec's styling references live inside Layout.
- quote: "**`/sign/:path` was nested inside the `<Layout>` route group** (site header/footer chrome), not standalone like `/release`"
- kind: process
- artifacts: src/App.tsx, src/pages/SignStart.tsx
- decision-mention: none

### ITEM
- report: TASK-C-REPORT.md
- date: 2026-08-04
- item: Deviation: the deliverability panel uses client-side useBrand() instead of the spec's named server-side calendar-reminders OPS_INBOX resolution pattern — same registry, no new endpoint.
- quote: "**`useBrand()` (client-side) instead of a server round-trip** for the deliverability panel's org contact info."
- kind: process
- artifacts: src/pages/SignStart.tsx, useBrand, org_public_config
- decision-mention: none

### ITEM
- report: TASK-C-REPORT.md
- date: 2026-08-04
- item: The migration dry-run was not isolated — the file's own inner BEGIN/COMMIT persisted the change for real on the first run; recovered by relying on the migration's idempotency and re-running standalone as the apply step.
- quote: "wrapping it in an outer `BEGIN; -f file; ROLLBACK;` did not isolate it — the inner `COMMIT` persisted the change for real on the first run"
- kind: process
- artifacts: supabase/migrations/20260804120000_sign_start_rate_limit.sql
- decision-mention: none

---

## TASK-GIFTCREDITS-REPORT.md

### ITEM
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: notify_staff has no body parameter — every "record the failure" call packs diagnostics into the unbounded title; if the pattern spreads, notify_staff deserves a p_body parameter. Not touched, out of scope.
- quote: "`notify_staff(uuid,text,text,text)` — the only staff-notification primitive that exists — has **no body parameter**, only `org, kind, title, link`."
- kind: defect
- artifacts: notify_staff
- decision-mention: none

### ITEM
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: gifts.order_id is a vestigial, unconstrained uuid column — its FK to orders(id) was removed by the CASCADE drop of the orders table; not touched, not read or written by anything added.
- quote: "`gifts.order_id` is a vestigial, unconstrained `uuid` column — its FK to `orders(id)` survived a `CASCADE` drop of the `orders` table itself"
- kind: data-integrity
- artifacts: gifts.order_id
- decision-mention: none

### ITEM
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: The staff "Copy claim link" / "Resend" actions on a gift have never actually sent an email — "Resend" only stamps last_sent_at/send_count and no gift email-sending code path exists anywhere in api/ or src/; not fixed, flagged in case recipient-email was assumed.
- quote: "\"the recipient gets an email\" is not actually wired for gifts, in case that was assumed."
- kind: defect
- artifacts: GiftsContent.tsx, gifts.last_sent_at, gifts.send_count
- decision-mention: none

### ITEM
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: The CUSTOMER-marker branch (D2) may never fire against real inventory — no actual physical-good offering exists in the live catalog; the branch was tested only with a synthetic test-only offering.
- quote: "I could not find any *actual* physical-good offering in the live catalog — every priced, active offering is a service ... it may never fire against real inventory unless the catalog grows a goods SKU."
- kind: not-verified
- artifacts: offerings, redeem_gift, clients.customer_since
- decision-mention: D2

### ITEM
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: Browser click-through of the public /gift → staff-conversion → /redeem → new-account → schedule path was not done (no browser in the environment); everything provable at the SQL layer was proven, the UI path is flagged not claimed.
- quote: "**Not verified — flagged, not claimed:** browser click-through of the public `/gift` → staff-conversion → `/redeem` → new-account → schedule path."
- kind: not-verified
- artifacts: src/pages/Redeem.tsx, api/register-gift.ts, GiftCreateForm.tsx, IntakePage.tsx
- decision-mention: none

### ITEM
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: Verification item 2 (recipient books against the gifted credit and the booking consumes it) was not re-verified end-to-end in the browser — relies on lesson_credits being the same table book_open_slot already debits.
- quote: "Not re-verified end-to-end in the browser this session (no browser access in this environment)"
- kind: not-verified
- artifacts: lesson_credits, book_open_slot
- decision-mention: none

### ITEM
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: Correction: the task doc's "already works" claim that /register?redeem= survives registration is false — Register.tsx reads only params.get('token'), so a new gift recipient hit a dead end ("this link isn't valid anymore"); fixed via a new /api/register-gift + inline signup.
- quote: "\"Claim → `/register?redeem=<code>` when there is no session; the code survives registration\" — false."
- kind: correctness
- artifacts: Register.tsx, api/register-gift.ts, src/pages/Redeem.tsx
- decision-mention: none

### ITEM
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: Correction: the task doc's "already works" claim that gift redemption assigns documents is false — redeem_gift passed an empty (non-NULL) template_keys array, so every gift redemption silently assigned zero onboarding documents; fixed and proved by counting rows.
- quote: "Net effect: every gift redemption assigned **zero** onboarding documents, silently. No error, nothing in a log"
- kind: correctness
- artifacts: redeem_gift, _ensure_client_account
- decision-mention: none

### ITEM
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: Third bug found only by dry-running: redeem_gift lacked redeem_invitation's profiles-insert guard, so every real redemption by a genuinely new recipient would have failed with "no profile for user"; fixed by mirroring the existing insert.
- quote: "Every real redemption by a genuinely new recipient would have failed with exactly this error."
- kind: correctness
- artifacts: redeem_gift, promote_contact_to_account, profiles
- decision-mention: none

### INVENTORY
- report: TASK-GIFTCREDITS-REPORT.md
- what: ensure_gift_buyer_account was written in Stage 4 (2026-07-28) for the gift-creation call site and had been dead code ever since, because nothing ever created a gift to call it on — revived by this task's create_gift.
- where: ensure_gift_buyer_account (DB function)
- quote: "It also revives `ensure_gift_buyer_account` — written in Stage 4 (2026-07-28) for exactly this call site, dead ever since because nothing ever created a gift to call it on."

### INVENTORY
- report: TASK-GIFTCREDITS-REPORT.md
- what: gifts.order_id is a vestigial unconstrained uuid column read or written by nothing.
- where: gifts.order_id
- quote: "Not touched; not read or written by anything I added."

---

## TASK-INQUIRYMAIL-REPORT.md

### ITEM
- report: TASK-INQUIRYMAIL-REPORT.md
- date: 2026-08-11
- item: No email was actually sent and verified — the worktree has no .env at all (no service-role key, SMTP creds, or Supabase URL), so the rewritten inquiry email was verified only by code inspection plus type/lint/build; a one-step post-deploy proof is described.
- quote: "**No email was actually sent and verified in this pass.** This worktree has no `.env` at all"
- kind: not-verified
- artifacts: api/request-received.ts, api/_lib/email.ts, src/components/PublicIntakeForm.tsx
- decision-mention: none

### ITEM
- report: TASK-INQUIRYMAIL-REPORT.md
- date: 2026-08-11
- item: Correction of the task doc's framing: the gap was not "the only email path is the daily digest" — an immediate send already existed (from TASK B); the real gap was incomplete content, no Reply-To, and content sourced from the client rather than the row.
- quote: "**So the real gap wasn't \"no email\" — it was an incomplete one, with no way to reply.**"
- kind: correctness
- artifacts: api/request-received.ts, PublicIntakeForm.tsx, sendViaProvider
- decision-mention: none

---

## TASK-PAGEVIS-REPORT.md

### ITEM
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: The nav filter was NOT applied — AppLayout.tsx belongs to unmerged (explicitly HELD) TASK-HORSEONE, so it is held as a proven patch; until applied, hiding a page changes the status tile but no nav row, and the settings page has no nav entry (reachable only by URL).
- quote: "until the patch is applied, hiding a page changes the status tile but changes no nav row, and the settings page has no nav entry (reach it at `/app/ops/admin/pages`)"
- kind: blocked-on-owner
- artifacts: docs/reports/PAGEVIS-navfilter.patch, src/components/app/AppLayout.tsx, /app/ops/admin/pages
- decision-mention: none

### ITEM
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: If the held patch's eight child nav rows are ever rejected, the no-cascade hub-hiding rule must become cascade-with-warning — the two decisions are joined; hiding a hub without child rows would strand its children.
- quote: "**if those rows are ever rejected, this rule must become cascade-with-warning.**"
- kind: process
- artifacts: docs/reports/PAGEVIS-navfilter.patch, src/lib/pageRegistry.ts
- decision-mention: none

### ITEM
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: Flagged for owner: the App-pages block (Messages, and Calendar/Catalog while in Review) is not hideable — hand-written JSX in StaffNavItems, not a NavItem[] table, so the filter has no row to remove; making them hideable requires restructuring that block.
- quote: "**The App-pages block is not hideable.** Messages (and Calendar/Catalog while they sit in Review) are hand-written JSX in `StaffNavItems`, not a `NavItem[]` table"
- kind: blocked-on-owner
- artifacts: src/components/app/AppLayout.tsx (StaffNavItems)
- decision-mention: none

### ITEM
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: Flagged: Review rows are deliberately excluded from the page registry because nav position is their acceptance status; the real pages behind them are registered under their permanent homes marked PARKED_IN_REVIEW.
- quote: "**Review rows are deliberately excluded from the registry.** Nav position IS their status"
- kind: process
- artifacts: src/lib/pageRegistry.ts
- decision-mention: none

### ITEM
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: Flagged: Lessons' three child pages (packages, credits, sessions) and the two parameterised Records routes have no nav rows and are therefore not in the registry — they need rows first if the owner wants them in the nav.
- quote: "**Lessons' three child pages** (`packages`, `credits`, `sessions`) and the two parameterised Records routes have **no nav rows and are therefore not in the registry.**"
- kind: blocked-on-owner
- artifacts: src/lib/pageRegistry.ts, /app/ops/lessons
- decision-mention: none

### ITEM
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: Flagged: 11 rows in one Modules nav group may itself read as clutter — the mandated default-visible shape; the fix is two clicks on the new settings page, but the owner's original complaint was about volume.
- quote: "**11 rows in one Modules group is a lot of nav** and that may itself read as clutter."
- kind: cosmetic
- artifacts: src/components/app/AppLayout.tsx, org_page_visibility
- decision-mention: none

### ITEM
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: Flagged: with every module now entitled ON, AdminModulesPage (requireSuperAdmin) is the only place to turn a module off — the tenant owner cannot disable a module himself, by design, only hide its pages.
- quote: "**`org_modules` now shows every module on, so `AdminModulesPage` is the only place to turn one off** — and that page is `requireSuperAdmin`."
- kind: process
- artifacts: org_modules, AdminModulesPage
- decision-mention: none

### ITEM
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: In-app hub-card links pointing at hidden pages were reported, not fixed (BoardingHubPage, BarnopsHubPage, EmployeesHubPage, HorseHealthPage/HorsePartiesPage back-links, InstructorHome) — hub cards are deliberately not filtered by visibility.
- quote: "hub cards are **not** filtered by visibility. A hub you kept still lists a child you put away."
- kind: process
- artifacts: BoardingHubPage.tsx, BarnopsHubPage.tsx, EmployeesHubPage.tsx, HorseHealthPage.tsx, HorsePartiesPage.tsx, InstructorHome.tsx
- decision-mention: none

### ITEM
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: The render is NOT VERIFIED — no staff browser session exists in the environment; a 9-step browser checklist is provided for the owner.
- quote: "No staff browser session exists in this environment. Everything above is proved by SQL against prod or by tests. **The render is NOT VERIFIED.**"
- kind: not-verified
- artifacts: /app/ops/admin/pages, AdminPageVisibilityPage.tsx, OpsDashboard.tsx
- decision-mention: none

### ITEM
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: One pre-existing failing test in test/ui (pluspass_create_controls.test.tsx:63) fails identically on a clean tree — not touched, not fixed here.
- quote: "**1 failed** — `pluspass_create_controls.test.tsx:63`. **Pre-existing**: `git stash -u` and re-run gives the same single failure on a clean tree."
- kind: defect
- artifacts: test/ui/pluspass_create_controls.test.tsx
- decision-mention: none

### INVENTORY
- report: TASK-PAGEVIS-REPORT.md
- what: The held nav-filter patch (NavItem page keys, 8 module child rows, Page-visibility settings row, the filter clause, and its 10-test file) exists only as an unapplied patch file awaiting HORSEONE's merge.
- where: docs/reports/PAGEVIS-navfilter.patch, test/ui/pagevis_nav_filter.test.ts
- quote: "**`docs/reports/PAGEVIS-navfilter.patch`** — `git apply` it after HORSEONE merges."

### INVENTORY
- report: TASK-PAGEVIS-REPORT.md
- what: The page-visibility settings page has no nav entry until the patch lands — reachable only by typing its URL.
- where: /app/ops/admin/pages (AdminPageVisibilityPage.tsx)
- quote: "the settings page has no nav entry (reach it at `/app/ops/admin/pages`)"

### INVENTORY
- report: TASK-PAGEVIS-REPORT.md
- what: mod.brokerage is entitled but its hub is not built — the status tile renders it "Enabled, hub not built", white and not a link.
- where: org_modules (mod.brokerage), src/pages/app/ops/OpsDashboard.tsx
- quote: "**Enabled** | entitled, hub not built (`mod.brokerage`) | — | white, not a link"

---

## TASK-PLUSPASS-REPORT.md

### ITEM
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: No live browser session was possible (only placeholder Supabase credentials locally) — everything is code reading, a clean build, and 16 component tests; RLS enforcement, visual placement/responsive wrapping at real breakpoints, and the real AppLayout shell are all NOT verified.
- quote: "**I could not sign into the running app.** ... So there was no way to drive a real authenticated browser click-through in this environment, as either a member or an admin."
- kind: not-verified
- artifacts: PageCreateButton.tsx, CreateModalContext.tsx, Home.tsx, MyPosts.tsx, CalendarPage.tsx, AccountHub.tsx, Messages.tsx
- decision-mention: none

### ITEM
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Judgment call flagged: Calendar's "+ Booking" had no existing blank-slate flow to reuse, so nextBookableSlot() was written to interpolate a default start time and route into the two existing flows — the one surface where interpolation was needed rather than an existing control.
- quote: "**This is a judgment call**, not a literal reading of the task's \"the existing booking flow\" — flagging it as the one surface where I had to interpolate"
- kind: process
- artifacts: src/pages/app/CalendarPage.tsx, nextBookableSlot, CalendarItemPanel, RequestTimePanel
- decision-mention: none

### ITEM
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: The exact business-hours computation against live calendar_free_busy data was not exercised — tests used empty hours, the page's own not-yet-loaded fallback.
- quote: "**Assumed**: exact business-hours computation against live `calendar_free_busy` data (not exercised ...)"
- kind: not-verified
- artifacts: CalendarPage.tsx, calendar_free_busy
- decision-mention: none

### ITEM
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Correction: the task doc's file names don't match the repo — there is no StablePage.tsx, HorsePage.tsx is a single-horse detail view, and the doc's "(HorseIntakePage)" is a different, booking/purchase-context flow, not the generic add-to-my-stable flow.
- quote: "There is no `StablePage.tsx` and `HorsePage.tsx` is a single-horse detail view, not a list — the task doc's file names don't match the repo."
- kind: correctness
- artifacts: AccountHub.tsx, StableSection, HorseIntakeForm
- decision-mention: none

### ITEM
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Correction: the task doc's "(createThread)" reference for Messages is inaccurate — createThread is the community discussion flow; DMs use sendDirectMessage.
- quote: "The task doc's \"(createThread)\" reference is inaccurate — `createThread` is the *community discussion* flow (used by CreateModal's `discussion` post type), not DMs"
- kind: correctness
- artifacts: Messages.tsx, sendDirectMessage, createThread
- decision-mention: none

### ITEM
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: The admin-surface inventory (every staff create page already has its own visible control; no admin follow-up looks necessary) is a single read-only research pass, not a click-through — flagged for the owner to sanity-check, not a closed conclusion.
- quote: "**No admin-facing follow-up task looks necessary** — flagging this as a finding for you to sanity-check rather than a closed conclusion, since it wasn't hands-verified."
- kind: not-verified
- artifacts: /app/ops/* staff pages, CreateModal
- decision-mention: none

### ITEM
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Catalog deliberately got no "+" button, per the task's own instruction — the page is a pure browse grid where every item carries its own inline action; a page-level "+" would duplicate or be meaningless.
- quote: "**No button added, per the task's own instruction to say so instead of forcing one.**"
- kind: process
- artifacts: CatalogPage.tsx, OfferingCatalog
- decision-mention: none

### ITEM
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Correction: CLAUDE.md's stated lint baseline (~26 warnings) is stale — the true measured clean-tree baseline is 29.
- quote: "the real baseline is **29** warnings, not the ~26 CLAUDE.md states (that doc is a bit stale)"
- kind: correctness
- artifacts: CLAUDE.md
- decision-mention: none

### ITEM
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: test/db (the repo's DB-level suite) was not run — no backend changes were made, but this branch has not re-confirmed that suite.
- quote: "**`test/db/*`** (the repo's DB-level suite) was not run — this task made no backend/migration changes, so it's out of scope, but it also means I have not re-confirmed that against this branch."
- kind: not-verified
- artifacts: test/db
- decision-mention: none

### ITEM
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Deviation disclosed: CreateModal gained an initialStep prop and a CreateModalContext beyond the literal surface list — plumbing, not a new flow; header behavior confirmed untouched.
- quote: "**`CreateModal` gained an `initialStep` prop and `CreateModalContext`.** The task said \"build buttons, not flows\" — this isn't a new flow, it's plumbing"
- kind: process
- artifacts: CreateModal.tsx, CreateModalContext.tsx, AppLayout.tsx
- decision-mention: none

---

## TASK-R11-REPORT.md

### ITEM
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Flagged, not fixed: HORSE_LEASE_V2's CARE.INTRO (the section's general lead-in) and CARE.SUPPLEMENTS attach under the "3rd Party Exercise" header, where neither belongs — fixing it is a content decision (give CARE.INTRO a heading or move the SCHEDULE.* clauses), outside this spec.
- quote: "CARE.INTRO is the general care-and-expenses lead-in for the whole section and CARE.SUPPLEMENTS is the medications builder; neither belongs under a third-party-exercise header."
- kind: defect
- artifacts: HORSE_LEASE_V2, CARE.INTRO, CARE.SUPPLEMENTS, SCHEDULE.TRAINER_CARE, contract_clause_defs
- decision-mention: none

### ITEM
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Flagged, not fixed: HORSE_SALE_V2 and HORSE_BILL_OF_SALE [Pending] placeholder clauses are still headingless (A3 covered only the lease), so while the driving question is unanswered those groups show no number and no title — items appear to materialise on selection; the same one-line fix A3 applied would resolve each.
- quote: "**[Pending] placeholders are still headingless** ... Consequence: while the driving question is unanswered, those groups show **no number and no title**"
- kind: defect
- artifacts: HORSE_SALE_V2, HORSE_BILL_OF_SALE, HORSE.INJURY_HISTORY_PENDING, PPE.PENDING, PRICE.INSTALLMENTS_PENDING, TRIAL.PENDING, PARTIES.CO_BUYER_PENDING, DEFINITIONS.SELLER_PENDING, DEFINITIONS.BUYER_PENDING
- decision-mention: none

### ITEM
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Recorded visible change: HORSE_BILL_OF_SALE now composes most sections as "N. TITLE" plus unnumbered preamble with no sub-numbers at all — reads acceptably for a short instrument but is a visible change from the previous numbering.
- quote: "now compose as **\"N. TITLE\" plus unnumbered preamble**, with no sub-numbers at all ... recorded here as such."
- kind: cosmetic
- artifacts: HORSE_BILL_OF_SALE, remerge_contract_from_clauses
- decision-mention: none

### ITEM
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Deviation: the spec's literal "muted previews render title-only + gold caption" was not implemented (it would hide headingless gated clauses and their self-enabling toggles entirely); only the numbering half was built — if the owner did mean collapse-to-title, that separate small change has not been made.
- quote: "If the owner did mean \"collapse muted previews to their title\", that is a separate, small change and I have not made it."
- kind: blocked-on-owner
- artifacts: src/components/app/ClauseDocument.tsx, gateControls
- decision-mention: none

### ITEM
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: The A3 data-pass dry-run was not a dry run — the migration file's own inner BEGIN/COMMIT ended the outer transaction, so the data pass landed at dry-run time; no harm (guarded re-run was a no-op), but stated plainly.
- quote: "the dry-run was not a dry run, and stating otherwise would be false."
- kind: process
- artifacts: supabase/migrations/20260804110001_lease_heading_data_pass.sql
- decision-mention: none

### ITEM
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Pre-existing quirk found tracing the add surface: ContractPage passed section HEADINGS while customBySection matched section_keys, so a legacy custom field could never land inside a template section — not fixed beyond being superseded by the new key-passing path.
- quote: "a legacy custom field could never land inside a template section — it always became a trailing custom section. Not fixed beyond being superseded by the new path, which passes keys."
- kind: defect
- artifacts: ContractPage.tsx, AddElementModal.tsx, ClauseDocument.tsx (customBySection)
- decision-mention: none

### ITEM
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Spec contradiction found live: the R5 terminal-punctuation rule only punctuates token-bearing lines, not token-free authored lines — corrected by a follow-up migration scoped to CUSTOM clause keys only.
- quote: "**The spec says \"the composer already appends terminal punctuation (R5 rule)\". Live contradicted it.**"
- kind: correctness
- artifacts: supabase/migrations/20260804120001_authored_line_punctuation.sql, remerge_contract_from_clauses
- decision-mention: none

### ITEM
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: Deviations disclosed: remove_contract_composition is new and unnamed in the spec (deletion was required by the done-check); a composite add_contract_composition RPC was built instead of N client calls; and two new columns (body, custom_kind) were added to contract_fields.
- quote: "**`remove_contract_composition` is new and not named in the spec.** ... **Two new columns on `contract_fields`.** `body` and `custom_kind`."
- kind: process
- artifacts: add_contract_composition, remove_contract_composition, contract_fields.body, contract_fields.custom_kind
- decision-mention: none

### ITEM
- report: TASK-R11-REPORT.md
- date: 2026-08-04
- item: The add-item UI itself was never exercised in a browser — modal behaviour asserted from code, not a click-through; typecheck/lint/build pass.
- quote: "**Not run:** the UI itself was never exercised in a browser. ... the modal's behaviour is asserted from the code, not from a click-through."
- kind: not-verified
- artifacts: src/components/app/AddElementModal.tsx, ContractPage.tsx
- decision-mention: none

---

## TASK-REVIEWNAV-REPORT.md

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Defect written down, not fixed: ContactForm's create path does not set contact_type, so anything created through it lands on /app/admin rather than the page it was created from; TASK-ONEPEOPLE's tab-following requirement would re-ship it. The review-route mount's submit is inert for exactly this reason.
- quote: "**`ContactForm`'s create path does not set `contact_type`** — anything created through it lands on `/app/admin` rather than the page it was created from."
- kind: defect
- artifacts: ContactForm, contacts.contact_type, /app/ops/review/contact-form
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Defect written down, not fixed: two footer links ("Ways to Ride" and "Book a Lesson") both point at /shop.
- quote: "**Two footer links point at one page** — \"Ways to Ride\" and \"Book a Lesson\", both `/shop`, `Footer.tsx:37-38`. One line."
- kind: defect
- artifacts: Footer.tsx:37-38, /shop
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Defect written down, not fixed: /acquisition renders zero offerings — all three acquisition SKUs have price_amount = NULL and the reader filters them out; a primary-nav marketing page that cannot be completed.
- quote: "**`/acquisition` renders zero offerings** — all three acquisition SKUs have `price_amount = NULL` and the reader filters them out."
- kind: defect
- artifacts: /acquisition, offerings.price_amount
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Defect written down, not fixed: /account bounces any member to /app before it renders, so slot B of the Account comparison cannot be looked at by a member.
- quote: "**`/account` bounces any member to `/app`** before it renders, so slot B of the Account comparison cannot be looked at by a member."
- kind: defect
- artifacts: /account
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Defect written down, not fixed: /app/ops/directory has zero rows in production — a live nav entry on an empty page.
- quote: "**`/app/ops/directory` has zero rows in production** — a live nav entry on an empty page."
- kind: defect
- artifacts: /app/ops/directory, DirectoryPage
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: The user-visible "Ops" label (two page eyebrows) is carried forward, not fixed — page naming belongs to the owner's post-restructuring re-bucketing pass; the paragraph must survive into whatever task does the re-bucketing.
- quote: "**Not fixed here** — an eyebrow is part of a page's naming, which is what the re-bucketing pass decides ... **This paragraph is the carry-forward; it must survive into whatever task does the re-bucketing.**"
- kind: process
- artifacts: src/pages/app/ops/DocumentsQueuePage.tsx:337, src/pages/app/ops/PaymentReviewPage.tsx:106
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: D13 conflict stated plainly: accepting a page out of Review requires a code change (a thread), not a button — no editor is proposed since the acceptance action is inherently the re-bucketing work, but the owner should know and can name a real follow-up if unacceptable.
- quote: "the owner should know that \"move it out of Review\" is a request he has to make, not a button he can press. If that is unacceptable, the follow-up is a real one and should be named."
- kind: blocked-on-owner
- artifacts: src/lib/reviewSection.ts, AppLayout.tsx
- decision-mention: D13

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Honest conflict recorded: the Team nav row is temporarily gated adminOnly while in Review, tighter than its requireStaff route, contradicting the comment at its call site — currently hides the row from nobody (no MANAGER/EMPLOYEE accounts exist); restore Team without adminOnly on acceptance.
- quote: "While Team sits in Review it **is** gated tighter than its route. ... Restore Team without `adminOnly` on acceptance; the comment says so at the call site."
- kind: process
- artifacts: /app/ops/team, AppLayout.tsx, profiles.role
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Known cosmetic consequence: Inbound C is /app/dashboard?request=<id>, which NavLink matches on pathname, so both it and Staff home A highlight as active on the dashboard — recorded on the index page rather than worked around.
- quote: "**One known cosmetic consequence:** `Inbound C` is `/app/dashboard?request=<id>`, which `NavLink` matches on pathname — so while you are on the dashboard, both it and `Staff home A` highlight as active."
- kind: cosmetic
- artifacts: /app/dashboard, NavLink, reviewSection.ts
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: The render is NOT VERIFIED — nobody has looked at this in a browser; what the 18 tests do not cover: how it looks, whether 31 rows is usable in the rail, whether the collapsed 56px strip is legible with 31 identical icons, and whether each live page loads against real data.
- quote: "**No staff browser session exists in this environment, so the render is NOT VERIFIED.** Nobody has looked at this in a browser."
- kind: not-verified
- artifacts: AppLayout.tsx, ReviewIndexPage.tsx, /app/ops/review
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Deviation: DUPECENSUS's manifest instruction to flip both retirement booleans was deliberately not followed — flipping would put a retired page back into the live app for every user; both constants stay true and a test enforces it.
- quote: "**DUPECENSUS's manifest says to flip both booleans.** That instruction was **not followed** — the task doc overrides it"
- kind: process
- artifacts: CONTACTS_PAGE_RETIRED, INTAKE_PAGE_RETIRED, ContactsPage.tsx:523, IntakePage.tsx:447
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Two consequences of the moves the next thread must not read as breakage: the "People" nav heading is gone (its three rows all moved into Review) and the "Modules" heading is gone (Records was the only visible module row); restore Records WITH its module key on acceptance.
- quote: "**The \"People\" heading is gone from the rail.** ... **The \"Modules\" heading is gone too.** ... Restore Records **with its `module` key**"
- kind: process
- artifacts: AppLayout.tsx, manageNavGroups, mod.horserecords
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: The PDF renderer (body-renderer slot C) could not be mounted — a non-React PDF writer with no component or route; listed on the index page with the suggestion to compare it by emailing a signed copy, nothing invented to give it a page.
- quote: "**Body renderer slot C — the PDF renderer** (`src/lib/documentPdf.ts`). A non-React PDF writer: no component, no route, nothing to mount."
- kind: inventory
- artifacts: src/lib/documentPdf.ts
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Staff roster slot B (/app/ops/employees/staff) renders ModuleGate's locked fallback because mod.employees is disabled in org_modules — deliberately left off rather than changing the live app for every staff user.
- quote: "**the module was not enabled**, because that would change the live app for every staff user."
- kind: inventory
- artifacts: /app/ops/employees/staff, ModuleGate, org_modules (mod.employees)
- decision-mention: none

### ITEM
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: The one review mount not byte-identical to production: ContactForm's submit is inert on its review route (its real create path would ship the contact_type defect from a new surface); validation, layout, and cancel remain real.
- quote: "`ContactForm`'s **submit is inert** on its review route. ... Wiring a real create from a review page would have shipped that defect from a new surface."
- kind: process
- artifacts: /app/ops/review/contact-form, ContactForm, ReviewMounts.tsx
- decision-mention: none

### INVENTORY
- report: TASK-REVIEWNAV-REPORT.md
- what: ContactsPage is retired behind CONTACTS_PAGE_RETIRED = true (its live route redirects to /app/admin); mounted for review only at /app/ops/review/contacts.
- where: src/pages/app/ops/ContactsPage.tsx:523, /app/ops/contacts, /app/ops/review/contacts
- quote: "`CONTACTS_PAGE_RETIRED` | `src/pages/app/ops/ContactsPage.tsx:523` | **yes** | component **mounted** at `/app/ops/review/contacts`"

### INVENTORY
- report: TASK-REVIEWNAV-REPORT.md
- what: IntakePage is retired behind INTAKE_PAGE_RETIRED = true (its live route redirects to the dashboard carrying its ?request= param); mounted for review only at /app/ops/review/intake.
- where: src/pages/app/ops/IntakePage.tsx:447, /app/ops/intake, /app/ops/review/intake
- quote: "`INTAKE_PAGE_RETIRED` | `src/pages/app/ops/IntakePage.tsx:447` | **yes** | component **mounted** at `/app/ops/review/intake`"

### INVENTORY
- report: TASK-REVIEWNAV-REPORT.md
- what: ContactDossierModal had no route at all (takes a contactId prop); given a review-only mount.
- where: /app/ops/review/contact-dossier (ContactDossierModal)
- quote: "`/app/ops/review/contact-dossier` | `ContactDossierModal` | takes a `contactId` prop, has no route"

### INVENTORY
- report: TASK-REVIEWNAV-REPORT.md
- what: ContactForm is a presentational component with no route of its own; given a review-only mount with an inert submit.
- where: /app/ops/review/contact-form (ContactForm)
- quote: "`/app/ops/review/contact-form` | `ContactForm` | presentational, takes props, has no route"

### INVENTORY
- report: TASK-REVIEWNAV-REPORT.md
- what: /app/ops/horses is the 07-01 original horse roster, and the only implementation that resolves breed/colour lookups to names — that feature dies with it if slot A wins.
- where: /app/ops/horses
- quote: "**B** `/app/ops/horses` — the 07-01 original. **The only one that resolves breed/colour lookups to names** — that feature dies with it if A wins."

### INVENTORY
- report: TASK-REVIEWNAV-REPORT.md
- what: /app/ops/preview/instructor-home is the trainer-home preview; no account exists that can render it with a trainer's own data.
- where: /app/ops/preview/instructor-home
- quote: "**Its data is yours, not a trainer's**; no account exists that can render it any other way."

### INVENTORY
- report: TASK-REVIEWNAV-REPORT.md
- what: /app/schedule is the 06-23 original member time surface, superseded in use by /app/calendar.
- where: /app/schedule
- quote: "**A** `/app/calendar` — **in use.** · **B** `/app/schedule` — the 06-23 original."

### INVENTORY
- report: TASK-REVIEWNAV-REPORT.md
- what: The member self-sign Documents row is hidden for staff in the normal nav — the Review section is the only way in for staff.
- where: /app/documents
- quote: "**B** `/app/documents` — member self-sign. **This row is hidden for staff in the normal nav** — Review is your only way in."

### INVENTORY
- report: TASK-REVIEWNAV-REPORT.md
- what: /app/ops/directory is a live nav entry rendering an empty page — zero rows in production.
- where: /app/ops/directory
- quote: "**D** `/app/ops/directory` — **D has zero rows.**"

### INVENTORY
- report: TASK-REVIEWNAV-REPORT.md
- what: /app/ops/employees/staff renders only the module-locked fallback because mod.employees is off.
- where: /app/ops/employees/staff
- quote: "**B** `/app/ops/employees/staff` — **renders locked; `mod.employees` is off and was left off.**"

---

## TASK-ROSTERCARD-REPORT.md

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: The one-line nav guard the ContactsPage retirement needs in AppLayout.tsx was reported rather than edited (UIBUILD owns the file); until it lands, the Contacts nav item is a live link that bounces to /app/admin — harmless, one extra hop.
- quote: "**Reporting this rather than editing it, per the task's own instruction.** Until it lands, the nav item is a live link to a page that immediately bounces to `/app/admin`"
- kind: blocked-on-owner
- artifacts: AppLayout.tsx:288, CONTACTS_PAGE_RETIRED, ContactsPage.tsx
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: The render itself is NOT VERIFIED — no staff browser session (owner ruling 2026-08-10); everything is RPC output, direct-query results, and built CSS proven via psql and the production bundle, not a screenshot or click-through.
- quote: "## NOT VERIFIED — no staff browser session (owner ruling 2026-08-10) / The render itself."
- kind: not-verified
- artifacts: src/components/app/RosterCard.tsx, Admin.tsx
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: The embedded-resource query (document_parties with embedded documents) could not be exercised without a real session — FK and precedent verified, but not independently exercised this session.
- quote: "**The embedded-resource query** ... can't be exercised without a real session (the `.env` in this worktree is a placeholder — no anon key). ... Not independently exercised this session."
- kind: not-verified
- artifacts: document_parties, src/lib/ops/api-documents.ts
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Judgment call flagged: ring derivation for the bare 'contact' arm was uncovered by the exploration doc; closed by reading client_id presence as the gold signal and treating the bare arm as grey.
- quote: "I closed that gap by reading `client_id` presence as the gold signal directly off the RPC ... and treating the bare `'contact'` arm as grey"
- kind: process
- artifacts: RosterCard.tsx, admin_client_accounts, clients
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Judgment call flagged: "Client" is rendered as a fixed word in the PAIR badge (per the owner's worked example), not conditionally gated on client_id — Gabriella, the one real dependent, has no clients row.
- quote: "Read \"Client\" as the owner's chosen fixed replacement word for \"Counterparty\" in this pairing context specifically ... not as a second, competing ring-style derivation."
- kind: process
- artifacts: RosterCard.tsx, contacts.guardian_contact_id
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Judgment call flagged: credits are shown as a single summed count, not itemized by name — the itemized data is already on m.credits and trivial to swap in if a single count isn't wanted.
- quote: "**Credits shown as a summed count** (total remaining units across all open credit lines), not itemized by name the way the row build showed them."
- kind: process
- artifacts: RosterCard.tsx, admin_client_accounts (credits)
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Known limitation stated plainly: the outstanding-documents flag is a partial signal — contact_required_documents has RLS enabled with zero policies (deny-all for authenticated), contact_checklist is service_role-only, and admin_client_documents covers only account-kind rows; the flag catches "started but not finished," not "required but never generated." No grant or bulk RPC was added per the no-database-work constraint.
- quote: "`contact_required_documents` ... has RLS enabled with **zero policies** — deny-all for the `authenticated` role, confirmed live. The one RPC that computes real per-document completion, `contact_checklist(contact_id)`, is granted to `service_role` only"
- kind: defect
- artifacts: contact_required_documents, contact_checklist, admin_client_documents, RosterCard.tsx
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Known gap deferred to TASK-BOOKFLOW: bookings carries no audit trigger (29 tables write to audit_logs, bookings is not one), so a client whose only engagement is booked lessons shows no activity signal at all; neither a bookings union nor the missing trigger was added.
- quote: "`bookings` carries no audit trigger ... so a client whose only engagement is booked lessons reads with no activity signal at all rather than a false \"Active\" or a misleading \"Inactive.\""
- kind: process
- artifacts: bookings, audit_logs, RosterCard.tsx
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Open question flagged as a judgment call: "Not yet invited" is scoped to kind='pending' only — the bare 'contact' arm (Gabriella) gets no equivalent flag even though nobody has reached out to her either; left unflagged because the settled model's flag list names no bare-contact equivalent.
- quote: "Flagging this as a judgment call rather than silently deciding it either way."
- kind: blocked-on-owner
- artifacts: RosterCard.tsx, invitations
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Data-quality find, not fixed: horse_relationships carries two orphaned active LESSEE rows for Beaumont de Cactai referencing a contact_id that no longer exists in contacts and a source_document_id that doesn't exist in documents — likely leftover synthetic demo data; the lessee_contact_id stamp was used instead.
- quote: "**two for a contact_id that no longer exists in `contacts` at all**, referencing a `source_document_id` that doesn't exist in `documents` either — orphaned rows"
- kind: data-integrity
- artifacts: horse_relationships, horses.lessee_contact_id, contacts, documents
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Largest real finding on the roster: 8 of the 9 pending-kind rows have never had a matching invitations row at all (only Anita Tackette has one, long expired) — most provisioned clients were never actually invited.
- quote: "This is the single largest real finding on the roster right now: most provisioned clients were never actually invited."
- kind: data-integrity
- artifacts: invitations, clients, admin_client_accounts
- decision-mention: none

### ITEM
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Frontend-type drift found and corrected: main's ClientAccountRow was still the pre-ROSTER 15-column shape even though admin_client_accounts() had already shipped 20 columns in production.
- quote: "**This file had drifted**: `main`'s frontend type was still the pre-`ROSTER` 15-column shape even though the RPC itself had already shipped 20 columns"
- kind: correctness
- artifacts: src/lib/admin.ts, admin_client_accounts
- decision-mention: none

### INVENTORY
- report: TASK-ROSTERCARD-REPORT.md
- what: ContactsPage, DirectoryPage, and LeadsPage remain exported but ContactsPage is retired behind CONTACTS_PAGE_RETIRED = true with its route redirecting to /app/admin — nothing deleted per the standing rule.
- where: src/pages/app/ops/ContactsPage.tsx (CONTACTS_PAGE_RETIRED), /app/ops/contacts → /app/admin redirect in App.tsx
- quote: "`ContactsPage`/`DirectoryPage`/`LeadsPage` all still exported — nothing deleted, per the standing `86a2c33` rule."

### INVENTORY
- report: TASK-ROSTERCARD-REPORT.md
- what: task/roster's positional-row presentation (RosterRow/RosterHeader) sits on an unmerged branch, held back and superseded per the owner's 2026-08-10 reversal — not ported, not merged.
- where: git branch task/roster (RosterRow, RosterHeader)
- quote: "Its `RosterRow`/`RosterHeader` positional-row presentation was **not** ported and **not** merged; `task/roster` itself is untouched."
