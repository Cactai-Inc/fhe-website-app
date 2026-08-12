### ITEM [batch1.md#3]
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: Pre-existing identity-duplication gap: no auth account is linked to the lessee contact 352c3898 ("French Heritage Equestrian"); the login sharing hello@fhequestrian.com is linked via profiles.contact_id to a different contact ("Claire Bourdon") — not touched, out of scope.
- quote: "a pre-existing identity-duplication gap unrelated to A11 — the login sharing `hello@fhequestrian.com`'s email is linked via `profiles.contact_id` to a *different* contact, \"Claire Bourdon\"; not touched here, out of scope"
- kind: data-integrity
- artifacts: profiles, contacts, auth.users
- decision-mention: none

### ITEM [batch1.md#24]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Not reached: email templates (api-side) were not compared against each other for duplication.
- quote: "**Email templates** (`api/`-side) were not compared against each other."
- kind: inventory
- artifacts: api/ email templates
- decision-mention: none

### ITEM [batch1.md#28]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 1.1 (still open at report time): the /app/ops KPI tile "Intake to review" says 12 where the badge and dashboard say 5 — OpsDashboard.countPendingIntake is the last holdout of the old definition and should call inbound_open_count().
- quote: "**`OpsDashboard.countPendingIntake` is the last holdout** and is the only reason this finding is still open."
- kind: defect
- artifacts: src/pages/app/ops/OpsDashboard.tsx, inbound_open_count, listIntake
- decision-mention: none

### ITEM [batch1.md#57]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 2.9: every account's Dashboard badge is larger than what its dashboard shows — the attention band renders only 3 notification tiles with no "and N more" affordance (up to 14 hidden silently); give it the leads band's expand control.
- quote: "**Every account with notifications has a badge larger than what its dashboard will show**, and the shortfall is invisible."
- kind: defect
- artifacts: src/components/app/DashboardPanel.tsx, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM [batch1.md#73]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: The task's central Step 1 proof — cross-email Google identity linking on a throwaway account — was NOT RUN; no route to an authenticated session existed in the environment.
- quote: "**The task's Step 1 was to prove cross-email linking on a throwaway account and report the raw result. I could not run it, and I have not pretended otherwise anywhere below.**"
- kind: not-verified
- artifacts: linkIdentity, auth.identities
- decision-mention: none

### ITEM [batch1.md#74]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Correction: admin@cactai.io holding both email and google identities is not evidence that manual linking is enabled — its timing (+15s, matching addresses) is the signature of GoTrue's automatic same-email linking; decision 2 stays genuinely open.
- quote: "**that pair is not evidence that manual linking is on**, and it should not be leaned on when answering open decision 2"
- kind: correction
- artifacts: auth.identities, lib/auth.ts
- decision-mention: none

### ITEM [batch1.md#76]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: Whether linking tolerates a different email is unproven for this project — Supabase documentation says yes, but that is documentation, not this project's evidence.
- quote: "per Supabase it does, but that is documentation, not this project's evidence. **Treat it as unproven.**"
- kind: not-verified
- artifacts: linkIdentity
- decision-mention: none

### ITEM [batch1.md#83]
- report: TASK-GOOGLEAUTH-REPORT.md
- date: 2026-08-11
- item: D1a honoured and noted: admin@cactai.io keeps org_id NULL by design; nothing in the change gives it an org or touches a tenant surface.
- quote: "**D1a honoured.** `admin@cactai.io` is the platform owner, holds `org_id NULL` by design, and is not a tenant member."
- kind: process
- artifacts: admin@cactai.io, profiles
- decision-mention: D1a

---

### ITEM [batch1.md#88]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Broken but out of scope: fhequestrian.com does not serve the app (Namecheap parking, times out) and BRAND.SITE_URL in config_values points at the dead host, so any email linking to the site sends people nowhere; invitation links are unaffected (built from request origin).
- quote: "**`fhequestrian.com` does not serve the app.** ... `BRAND.SITE_URL` in `config_values` points at the dead host, so any email linking to the site sends people nowhere."
- kind: defect
- artifacts: config_values (BRAND.SITE_URL), fhequestrian.com
- decision-mention: none

### ITEM [batch1.md#91]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Broken but out of scope: sendViaProvider has no timeout — a hung SMTP connection hangs the function until Vercel kills it, with the invitation already committed, so the operator sees a request that never returns.
- quote: "**`sendViaProvider` has no timeout.** A hung SMTP connection hangs the function until Vercel kills it"
- kind: defect
- artifacts: api/_lib/delivery.ts (sendViaProvider)
- decision-mention: none

### ITEM [batch1.md#93]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Historic stacked live-token rows (hello@ 6, cjzigs@ 3, cjzigs+averify2@ 2) were not back-filled — rewriting their lifecycle would be inventing history.
- quote: "Historic rows were not back-filled — those 6/3/2 are pre-existing test sends and rewriting their lifecycle would be inventing history."
- kind: process
- artifacts: invitations
- decision-mention: none

### ITEM [batch1.md#94]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Owner check requested: did the three real invitation emails sent through the live production path arrive (cjzigs+inviteworks@ 15:40 UTC, cjzigs+inviteworks2@ ×2 15:48 UTC)? If so, delivery is confirmed end to end; indirect evidence says yes.
- quote: "If those landed, invitation email delivery is confirmed end to end."
- kind: not-verified
- artifacts: api/_lib/invitationEmail.ts, document_deliveries
- decision-mention: none

### ITEM [batch1.md#97]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: Vetoable decision (a): the open-lead list now includes 'contacted' (and 'invited'), not just 'new' — the badge counts 5 rather than 1; if the owner wants "untouched since it arrived" it is a one-line change in the migration and listLeadQueue.
- quote: "**(a) The open list now includes `contacted`, not just `new`.** This is the one judgement call with teeth ... If you want the band to mean \"untouched since it arrived\", say so and it becomes a one-line change"
- kind: blocked-on-owner
- artifacts: 20260811T1900_leadclean_open_queue.sql, listLeadQueue, inbound_open_count
- decision-mention: none

### ITEM [batch1.md#98]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: F1 flagged, not fixed: requests_capture_contact has never actually linked a request — it assigns to NEW in an AFTER trigger, which does nothing; every request created since 2026-08-02 has NULL contact_id and there will be more; lowest-risk UPDATE fix stated but not applied (changes what every public submission writes — owner's call).
- quote: "**F1 — `requests_capture_contact` has never actually linked a request. This is why the NULLs exist, and there will be more.**"
- kind: defect
- artifacts: requests_capture_contact, requests.contact_id, 20260802000000_lead_trust_notifications.sql
- decision-mention: none

### ITEM [batch1.md#100]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: F3 left alone deliberately: OpsDashboard.tsx:148 still links to /app/ops/intake ("Intake to review") — ADMINSWEEP owns that strand; and the staff email in api/request-received.ts:163 still reads "Open the Request Inbox" (link redirects correctly).
- quote: "**F3 — `OpsDashboard.tsx:148` still links to `/app/ops/intake`** (\"Intake to review\"). Left alone deliberately"
- kind: defect
- artifacts: src/pages/app/ops/OpsDashboard.tsx:148, api/request-received.ts:163
- decision-mention: none

### ITEM [batch1.md#101]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: F4 noted: the platform owner (SUPER_ADMIN, org_id NULL) gets inbound_open_count() = 0 because org_id = current_org() is never true when current_org() is NULL — pre-existing and unchanged.
- quote: "**F4 — the platform owner (SUPER_ADMIN, `org_id` NULL) gets `inbound_open_count() = 0`.** ... **Pre-existing and unchanged**"
- kind: correctness
- artifacts: inbound_open_count
- decision-mention: none

### ITEM [batch1.md#103]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: The backfill's ambiguous-email guard (HAVING count(*) = 1) is untested by production data — no ambiguous rows existed — so the DB test builds the ambiguous case explicitly and proves the refusal.
- quote: "The guard is therefore untested by production data, so the DB test builds the ambiguous case explicitly (two contacts on one email) and proves the refusal."
- kind: process
- artifacts: 20260811T1900_leadclean_open_queue.sql, test/db/leadclean_open_queue.test.ts
- decision-mention: none

### ITEM [batch1.md#140]
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: Defect found: the prior "Notifications" block was three defaultChecked checkboxes with zero read/write wiring — toggling them did nothing, on every account, forever; Preferences now renders informational rows saying "coming soon"; building real per-category preferences is out of scope and flagged for the owner.
- quote: "The prior \"Notifications\" block in `ProfileSection` was three `defaultChecked` checkboxes with zero read/write wiring — toggling them did nothing, on every account, forever."
- kind: defect
- artifacts: src/components/app/profile/PreferencesCard.tsx, AccountHub.tsx (old ProfileSection)
- decision-mention: none

### ITEM [batch2.md#6]
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: The H3/H2 curl matrix proved authorization logic with real sessions but did not exercise the email-click-through UX (tokens were inserted directly and redeemed via API, no email sent/clicked).
- quote: "this proves the endpoints' authorization logic using real sessions and real backend RPCs — it does not exercise the email-click-through UX"
- kind: not-verified
- artifacts: /api/deliver-my-document, /api/deliver-document, /api/register-invited, redeem_invitation
- decision-mention: none

### ITEM [batch2.md#11]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: H2 hardening hit the owner's pre-declared stop-and-show gate (the release flow is sessionless); three options were laid out for the owner and nothing was applied — /api/deliver-document left unchanged.
- quote: "**Options for the owner, not applied:** ... None applied. `/api/deliver-document` is unchanged."
- kind: blocked-on-owner
- artifacts: /api/deliver-document, sign_release, Release.tsx, DeliveryPanel.tsx
- decision-mention: D10

### ITEM [batch2.md#12]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: H3's remaining curl-matrix rows (200/403/409 with valid sessions, one real email) and H4's manual send were BLOCKED — endpoint not deployed, no real Supabase env vars locally, and the one authorized real-email account has no password.
- quote: "The remaining rows of the matrix (200/403/409 on valid sessions, the one real email) are **BLOCKED** and reported as such — not inferred, not simulated."
- kind: blocked-on-owner
- artifacts: api/deliver-my-document.ts, src/pages/app/Documents.tsx
- decision-mention: none

### ITEM [batch2.md#15]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: profiles.phone was retained, not dropped — TeamPage.tsx's staff editor is a load-bearing third writer for the one SUPER_ADMIN account with no contact row; needs a conditional write path or an owner decision to provision a contact row for admin@cactai.io. The TeamPage code comment "Staff have no contact row" was verified wrong for 2 of 3 staff.
- quote: "**`profiles.phone` NOT dropped:** found a third writer — `TeamPage.tsx`'s staff editor (`adminUpdateProfile`), whose code comment claims \"Staff have no contact row.\" Verified live and the comment is **wrong** for 2 of 3 staff profiles"
- kind: blocked-on-owner
- artifacts: profiles.phone, TeamPage.tsx, adminUpdateProfile
- decision-mention: D14

### ITEM [batch2.md#20]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: Six legacy contact columns were blocked from being dropped in U7 Stage B because live readers remain: admin_client_overview (rendered by Admin.tsx) reads mobile/whatsapp, mobile_display is a generated column on mobile, and member_directory still emits fields gated by hide_mobile/hide_whatsapp/hide_email.
- quote: "**Blocked, not dropped:** `mobile`, `whatsapp`, `mobile_display`, `hide_mobile`, `hide_whatsapp`, `hide_email`."
- kind: blocked-on-owner
- artifacts: contacts.mobile, contacts.whatsapp, contacts.mobile_display, admin_client_overview, member_directory, Admin.tsx
- decision-mention: D13

### ITEM [batch2.md#26]
- report: TASK-A15-REPORT.md
- date: 2026-08-04
- item: True mailbox-level bounces (SMTP accepts then bounces later) are out of scope — Gmail SMTP gives no bounce webhook, so there is no signal the delivery-failure sweep can act on; nothing was built for it.
- quote: "True mailbox-level bounces (SMTP accepts the message, then bounces later) are **out of scope**. Gmail SMTP gives no bounce webhook to observe them"
- kind: process
- artifacts: sweep_undelivered_executed_documents, api/delivery-sweep.ts
- decision-mention: none

### ITEM [batch2.md#27]
- report: TASK-A15-REPORT.md
- date: 2026-08-04
- item: All 37 currently undelivered executed documents have executed_email_sent_at IS NULL (they predate the stamping trigger) and are deliberately excluded from delivery-failure alerts — a different, already-known condition, left un-alerted by design.
- quote: "all 37 currently undelivered executed documents have `executed_email_sent_at IS NULL` (they predate the stamping trigger) — exactly the outcome the task doc predicted as correct."
- kind: inventory
- artifacts: documents.executed_email_sent_at, undelivered_executed_documents, document_deliveries
- decision-mention: none

---

### ITEM [batch2.md#28]
- report: TASK-A8-REPORT.md
- date: 2026-08-05
- item: New finding beyond the task doc: net.http_post is called without timeout_milliseconds, so pg_net's 5000ms default fires while /api/deliver-documents legitimately takes 6–8s — real successes read as timeouts in net._http_response; not fixed (out of scope), follow-up migration recommended.
- quote: "a real success can read as a timeout. **Not fixed** — out of scope ... Recommend a follow-up migration adding `timeout_milliseconds := 15000`"
- kind: defect
- artifacts: send_executed_document_email, net.http_post, net._http_response, api/deliver-documents.ts
- decision-mention: none

### ITEM [batch2.md#30]
- report: TASK-A8-REPORT.md
- date: 2026-08-05
- item: Deviation: the doc's named test document ecaecd42 had pre-existing document_deliveries rows, so firing it only proved idempotent-skip behavior, not a fresh send; two substitute single-party owner-test documents were used for genuine fresh-send proof.
- quote: "the named test document cannot prove a fresh send, only idempotent-skip behavior."
- kind: correctness
- artifacts: documents (ecaecd42, 0ed5bf5b, 3f44ea13), send_executed_document_email, document_deliveries
- decision-mention: none

### ITEM [batch2.md#31]
- report: TASK-A8-REPORT.md
- date: 2026-08-05
- item: Owner-flagged wrong-looking PDF date ("July 07, 2026") was investigated and confirmed not a bug — the test docs were genuinely signed 2026-07-07 and the direct status UPDATE test method never re-ran record_signature; in real usage signature and email trigger from the same event.
- quote: "**Not a bug:** `record_signature` substitutes the date into `merged_body` at the moment of the real signature."
- kind: correctness
- artifacts: record_signature, signatures.signed_at, merged_body
- decision-mention: none

### ITEM [batch2.md#32]
- report: TASK-A8-REPORT.md
- date: 2026-08-05
- item: CONTACT.FROM_EMAIL is unset in config_values, so the from-address depends entirely on the TRANSACTIONAL_FROM_EMAIL Vercel env var, which cannot be read from this environment (proven set only indirectly by the live sends succeeding).
- quote: "`CONTACT.FROM_EMAIL` is unset, so the from-address depends on the `TRANSACTIONAL_FROM_EMAIL` Vercel env var, which cannot be read from here."
- kind: inventory
- artifacts: config_values (CONTACT.FROM_EMAIL), TRANSACTIONAL_FROM_EMAIL, api/_lib/email.ts
- decision-mention: none

---

### ITEM [batch2.md#34]
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: The support-email pg_net dispatch currently 404s in production because api/support-received.ts exists only on this unpushed branch — it will only deliver real emails once the branch merges and deploys.
- quote: "`api/support-received.ts` only exists on this unpushed branch, so production Vercel has no route for it yet"
- kind: blocked-on-owner
- artifacts: api/support-received.ts, submit_support_request, net._http_response
- decision-mention: none

### ITEM [batch2.md#36]
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: The Inbound nav badge was not visually screenshotted — no running dev server/browser session; verified only by reading the shared RailLink render path the Dashboard badge already proves out.
- quote: "Not visually screenshotted (no running dev server / browser session in this pass) — verified by reading the shared `RailLink` render path"
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx, RailLink, inbound_open_count
- decision-mention: none

### ITEM [batch2.md#38]
- report: TASK-B-REPORT.md
- date: 2026-08-04
- item: Mid-task git collision: the shared checkout was running multiple concurrent task branches, the original task/b-lead-notifications branch ref was moved onto an unrelated commit and two files were lost from disk; three of five files turned up byte-identical on origin/main swept into an unrelated pushed commit (04abab9); cleanup of the original branch and shared checkout is left to the orchestration owner.
- quote: "My original branch, `task/b-lead-notifications`, got its ref moved out from under me onto that unrelated R10 commit, and two of my five files ... were lost from disk"
- kind: process
- artifacts: task/b-lead-notifications, fhe-website-app checkout, api/request-received.ts, api/support-received.ts
- decision-mention: none

### ITEM [batch2.md#42]
- report: TASK-C-REPORT.md
- date: 2026-08-04
- item: Deviation: the deliverability panel uses client-side useBrand() instead of the spec's named server-side calendar-reminders OPS_INBOX resolution pattern — same registry, no new endpoint.
- quote: "**`useBrand()` (client-side) instead of a server round-trip** for the deliverability panel's org contact info."
- kind: process
- artifacts: src/pages/SignStart.tsx, useBrand, org_public_config
- decision-mention: none

### ITEM [batch2.md#44]
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: notify_staff has no body parameter — every "record the failure" call packs diagnostics into the unbounded title; if the pattern spreads, notify_staff deserves a p_body parameter. Not touched, out of scope.
- quote: "`notify_staff(uuid,text,text,text)` — the only staff-notification primitive that exists — has **no body parameter**, only `org, kind, title, link`."
- kind: defect
- artifacts: notify_staff
- decision-mention: none

### ITEM [batch2.md#46]
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: The staff "Copy claim link" / "Resend" actions on a gift have never actually sent an email — "Resend" only stamps last_sent_at/send_count and no gift email-sending code path exists anywhere in api/ or src/; not fixed, flagged in case recipient-email was assumed.
- quote: "\"the recipient gets an email\" is not actually wired for gifts, in case that was assumed."
- kind: defect
- artifacts: GiftsContent.tsx, gifts.last_sent_at, gifts.send_count
- decision-mention: none

### ITEM [batch2.md#53]
- report: TASK-INQUIRYMAIL-REPORT.md
- date: 2026-08-11
- item: No email was actually sent and verified — the worktree has no .env at all (no service-role key, SMTP creds, or Supabase URL), so the rewritten inquiry email was verified only by code inspection plus type/lint/build; a one-step post-deploy proof is described.
- quote: "**No email was actually sent and verified in this pass.** This worktree has no `.env` at all"
- kind: not-verified
- artifacts: api/request-received.ts, api/_lib/email.ts, src/components/PublicIntakeForm.tsx
- decision-mention: none

### ITEM [batch2.md#54]
- report: TASK-INQUIRYMAIL-REPORT.md
- date: 2026-08-11
- item: Correction of the task doc's framing: the gap was not "the only email path is the daily digest" — an immediate send already existed (from TASK B); the real gap was incomplete content, no Reply-To, and content sourced from the client rather than the row.
- quote: "**So the real gap wasn't \"no email\" — it was an incomplete one, with no way to reply.**"
- kind: correctness
- artifacts: api/request-received.ts, PublicIntakeForm.tsx, sendViaProvider
- decision-mention: none

---

### ITEM [batch2.md#92]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Known cosmetic consequence: Inbound C is /app/dashboard?request=<id>, which NavLink matches on pathname, so both it and Staff home A highlight as active on the dashboard — recorded on the index page rather than worked around.
- quote: "**One known cosmetic consequence:** `Inbound C` is `/app/dashboard?request=<id>`, which `NavLink` matches on pathname — so while you are on the dashboard, both it and `Staff home A` highlight as active."
- kind: cosmetic
- artifacts: /app/dashboard, NavLink, reviewSection.ts
- decision-mention: none

### ITEM [batch2.md#96]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: The PDF renderer (body-renderer slot C) could not be mounted — a non-React PDF writer with no component or route; listed on the index page with the suggestion to compare it by emailing a signed copy, nothing invented to give it a page.
- quote: "**Body renderer slot C — the PDF renderer** (`src/lib/documentPdf.ts`). A non-React PDF writer: no component, no route, nothing to mount."
- kind: inventory
- artifacts: src/lib/documentPdf.ts
- decision-mention: none

### ITEM [batch3.md#2]
- report: TASK-CHECKBOXTIP-REPORT.md
- date: 2026-08-06
- item: Whether a browser actually delivers a hover tooltip on a disabled input could not be measured in jsdom; mitigated structurally via the title on an ancestor but unverified.
- quote: "**Hover-tooltip delivery on a disabled input** is browser behaviour I could not measure in jsdom."
- kind: not-verified
- artifacts: src/components/app/ClauseDocument.tsx (OwnedField)
- decision-mention: none

### ITEM [batch3.md#12]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 1, confirmed Yes, not fixed): Admin.tsx overview row can overflow the document — flex row's truncate lacks min-w-0 and binds unbounded p.email.
- quote: "`src/pages/app/Admin.tsx:163-164` ... **Yes** — row is `flex justify-between gap-3`, value span has `truncate` but no `min-w-0`"
- kind: defect
- artifacts: src/pages/app/Admin.tsx:163-164
- decision-mention: none

### ITEM [batch3.md#14]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 1, confirmed Yes, not fixed): TenantDetailPage account row renders unbounded "{a.email} · {role}" with no min-w-0.
- quote: "`src/pages/app/ops/superadmin/TenantDetailPage.tsx:175-179` ... second span always renders `{a.email} · {role}`, unbounded."
- kind: defect
- artifacts: src/pages/app/ops/superadmin/TenantDetailPage.tsx:175-179
- decision-mention: none

### ITEM [batch3.md#21]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit findings (driver 2/4 "maybe" tier, none fixed): AdminBrandingPage.tsx:215 logoPath `<code>` lacks break-all; SignStart.tsx:74-76 brand email `<p>` lacks break-words; InvitationHistoryPanel.tsx:155 min-w-[16rem] floor on activation-link code near 320px viewports; DeliveryPanel.tsx:298-300 raw UUID relies on implicit hyphen-wrap.
- quote: "**3 driver-2 (fixed widths), 2 driver-3 (bad `whitespace-nowrap`), 4 driver-4 (unbroken strings), 0 driver-5 (escaping elements).**"
- kind: defect
- artifacts: src/pages/app/ops/admin/AdminBrandingPage.tsx:215, src/pages/SignStart.tsx:74-76, src/components/app/InvitationHistoryPanel.tsx:155, src/components/ops/documents/DeliveryPanel.tsx:298-300
- decision-mention: none

---

### ITEM [batch3.md#26]
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: CONTACT.OPS_INBOX (the single address every lead alert is sent to) has no owner-facing editor — nothing in src/ references it and AdminBrandingPage discards CONTACT.* keys; changing the alert recipient requires a thread and SQL. Named as a D13 violation follow-up.
- quote: "**`CONTACT.OPS_INBOX` has no owner-facing editor — a D13 violation.** ... the ops inbox needs a field on the branding page."
- kind: blocked-on-owner
- artifacts: config_values (CONTACT.OPS_INBOX), AdminBrandingPage, src/lib/api.ts:2016
- decision-mention: D13

### ITEM [batch3.md#28]
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: A dismissed in-app notification leaves no trace in any surface the owner reads — evidence survives only in audit_logs, which nothing in the app reads; this is what made "Kit was never notified" look true for three days. Notification-lifecycle gap, not changed.
- quote: "**A dismissed notification leaves no trace in any surface the owner reads.** The evidence survives in `audit_logs` and nothing in the app reads it."
- kind: defect
- artifacts: notifications, consume_notification, audit_logs
- decision-mention: none

### ITEM [batch3.md#29]
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: Kit and Kylie deliberately report alert_state='unknown' (they predate the attempt record); both leads were missed and not backfilled or re-notified — the owner's to act on.
- quote: "**Kit and Kylie report `alert_state = 'unknown'`, deliberately.** ... **They were both missed, and that is the owner's to act on.**"
- kind: blocked-on-owner
- artifacts: inbound_queue, request_alert_sends
- decision-mention: none

### ITEM [batch3.md#31]
- report: TASK-INBOUNDALERT-REPORT.md
- date: 2026-08-12
- item: Two pre-existing test/ui failures (reviewnav_section, pluspass_create_controls) confirmed failing on a clean tree at the same commit.
- quote: "npx vitest run test/ui   15 passed, 2 failed  ← both pre-existing"
- kind: known issue
- artifacts: test/ui/reviewnav_section, test/ui/pluspass_create_controls
- decision-mention: none

---

### ITEM [batch3.md#49]
- report: TASK-LEASEMAP-REPORT.md
- date: 2026-08-07
- item: F18 — hiding a field via a waiver does not clear its stored value; the signing blocker and unresolved-insurance notification read raw stored values without gates, so stale NONEs re-arm the block when a waiver comes off.
- quote: "**F18 — hiding a field does not clear it.** ... a pair of stale `NONE`s reactivates the block the moment the waiver comes off."
- kind: defect
- artifacts: contract_lock_blockers, insurance_resolution_sync, set_contract_field
- decision-mention: none

### ITEM [batch3.md#111]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-012 item 2 content half unbuilt: only the nav change shipped (Dashboard into Management, Inbound removed from nav); the content merge (Inbound dissolving into Leads as contact records) is explicitly out of scope and unbuilt.
- quote: "The content-merge decision itself (Inbound dissolving into Leads as contact records, per the order's latest correction) is explicitly out of scope for this commit and unbuilt."
- kind: deferred
- artifacts: IntakePage.tsx, DashboardPanel.tsx, MANAGEMENT_GROUP
- decision-mention: none

### ITEM [batch4.md#1]
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: The shared working directory changed the checked-out branch underneath the session more than once, and the original branch ref got fast-forwarded onto an unrelated foreign commit; recovered via stash into an isolated worktree.
- quote: "the checked-out branch changed underneath this session more than once, and `task/a8b-send-resend-ui`'s own ref ended up fast-forwarded onto an unrelated foreign commit ... No push had happened at that point and no data was lost"
- kind: process
- artifacts: task/a8b-send-resend-ui, ~/Downloads/claude-code-repo/fhe-website-app, git worktree
- decision-mention: none

### ITEM [batch4.md#4]
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: DeliveryPanel.tsx was left unchanged because it is not part of ContractPage's surface (lives on a separate ops route), per the spec's conditional wording.
- quote: "`DeliveryPanel.tsx` — checked; it is not rendered inside `ContractPage.tsx` at all ... so per the spec's own phrasing no change was made to `DeliveryPanel.tsx`."
- kind: correctness
- artifacts: DeliveryPanel.tsx, DocumentViewerPage.tsx
- decision-mention: none

### ITEM [batch4.md#5]
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: Company-inbox mirror notice deliberately skipped for targeted sends (not explicitly in spec) to avoid spam and extra delivery rows.
- quote: "the company-inbox mirror notice ... is skipped entirely for targeted sends: it is an execution-event notice, and firing it on every staff re-send would (a) be spam and (b) write extra `document_deliveries` rows"
- kind: correctness
- artifacts: api/deliver-documents.ts
- decision-mention: none

### ITEM [batch4.md#7]
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: The write-side psql test (POST to endpoint to prove is_mirror row and untouched stamp) was NOT run; a manual test plan is documented instead.
- quote: "The write test (POST to the endpoint against a throwaway contact) was NOT run. ... I did not fabricate this result. No preview exists yet"
- kind: not-verified
- artifacts: api/deliver-documents.ts, document_deliveries, documents.executed_email_sent_at
- decision-mention: none

### ITEM [batch4.md#17]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: email exists in three places (auth.users, profiles, contacts) and no path reconciles all three; after a login-email change contacts.email and community_email keep the old address and member_directory publishes them.
- quote: "`email` exists in three places and no path reconciles all three ... After a login-email change, `contacts.email` and `contacts.community_email` still hold the previous address, and `member_directory` publishes both of them."
- kind: data-integrity
- artifacts: auth.users.email, profiles.email, contacts.email, api/email-change-complete.ts, member_directory
- decision-mention: none

### ITEM [batch4.md#19]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: contacts.phone write seeds four community channels (mobile_call/text, whatsapp_call/text) plus community_email via trigger; two are WhatsApp channels from an ordinary phone with no WhatsApp check — and they are published by member_directory though phone itself is not.
- quote: "one write, five copies ... Two of these five channels are WhatsApp channels seeded from an ordinary phone number, with no check that the number is on WhatsApp. ... `contacts.phone` itself is indeed absent from `member_directory`; the four values the same write creates are not."
- kind: data-integrity
- artifacts: contacts_a_seed_community_channels, member_directory, AccountInfoCard.tsx
- decision-mention: none

### ITEM [batch4.md#21]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: PreferencesCard states three notification behaviors (discussion replies, event reminders, new member welcomes) for which no producer exists — no trigger/function fires them.
- quote: "`PreferencesCard` states three things that no producer exists for ... It replaced three non-functional controls with three sentences asserting behaviour that does not occur."
- kind: correctness
- artifacts: PreferencesCard.tsx, thread_posts, events, members_post_join_event, calendar_reminder_sweep
- decision-mention: none

### ITEM [batch4.md#33]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Fields the member fills that nothing consumes — staff_preferred_contact, zelle_phone, zelle_email, correspondence_email, mobile_number, texts_phone are read by no email sender, receipt, reconciliation, or token, yet the card presents them as consumed.
- quote: "Fields the member fills in that nothing consumes ... No email sender, receipt, payment-reconciliation path or document token reads them. `api/zelle-reconcile.ts` does not reference `zelle_phone` or `zelle_email`"
- kind: correctness
- artifacts: AccountInfoCard.tsx, lib/contact.ts, api/zelle-reconcile.ts
- decision-mention: none

### ITEM [batch4.md#37]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: 9.2 — The platform-owner row admin@cactai.io holds a tenant contact (CACTAI INC.) despite ensure_contact_for_profile explicitly denying that user id, so the link predates or bypasses the guard; org_id NULL means org boundary matches nothing.
- quote: "The platform-owner row holds a tenant contact ... so the link predates or bypasses that guard. Because `org_id` is NULL, `current_org()` returns NULL for this account and `contacts_org_boundary` ... matches nothing."
- kind: data-integrity
- artifacts: admin@cactai.io, ensure_contact_for_profile, contacts_org_boundary
- decision-mention: none

### ITEM [batch4.md#79]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The central negative result — a blind coalesce sweep across the 48 house-guard functions would lock out the org-less platform-operator account (admin@cactai.io); that is why Phase A is two functions, not fifty.
- quote: "**The NULL propagation is not an accident in most places — it is what makes the org-less SUPER_ADMIN account work.** A blind `coalesce(…, false)` sweep across the 48 functions ... would have locked `admin@cactai.io` out of the entire contract surface."
- kind: correctness
- artifacts: admin@cactai.io, current_org(), has_staff_access()
- decision-mention: none

### ITEM [batch4.md#80]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: NOGUARD2's applied caller_is_document_party_or_staff guard is already denying the platform operator today (not "inert" as previously judged) on every document they're not a party to.
- quote: "So NOGUARD2's applied guard **denies the platform operator today** ... NOGUARD2 flagged this as residual risk ... and judged it 'inert today' ... **It is not inert; it is live.**"
- kind: defect
- artifacts: caller_is_document_party_or_staff, fill_party_fields_from_contacts, admin@cactai.io
- decision-mention: none

### ITEM [batch4.md#99]
- report: TASK-ONEAUTHOR-REPORT.md
- date: 2026-08-11
- item: Routing deliberately left alone — flat documents reach the one authoring page only by direct URL; flipping DocumentQueueTable.tsx:50 would route the whole estate but the ops viewer carries DeliveryPanel (MAIL/PORTAL/DOWNLOAD channels) that ContractPage lacks. Owner's call.
- quote: "**Routing was deliberately left alone — the one line that finishes the convergence is the owner's call.** ... **I did not flip it**, because the ops viewer carries one capability `ContractPage` does not: `DeliveryPanel`"
- kind: blocked-on-owner
- artifacts: DocumentQueueTable.tsx, DocumentViewerPage, DeliveryPanel, ContractPage
- decision-mention: none

### ITEM [batch5.md#6]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: U1.5e (NULL notification links) had no live anchor (0 rows), so it was made report-only with a BACKLOG entry for prophylactic hardening of notify_staff/notify_user/mirror_admin_notification.
- quote: "**Owner ruling:** report-only plus a BACKLOG entry for prophylactic hardening."
- kind: deferred
- artifacts: notify_staff, notify_user, mirror_admin_notification, notifications
- decision-mention: D2 (report's internal decision numbering)

### ITEM [batch5.md#8]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: U1.6 hostname sweep found two out-of-scope strings reported, not changed: comment hostnames in api/request-received.ts:9 and api/calendar-reminders.ts:8, plus OPS_INBOX_FALLBACK (an email address) at api/calendar-reminders.ts:21.
- quote: "Out of scope, reported: api/request-received.ts:9 (comment), api/calendar-reminders.ts:8 (comment), :21 (OPS_INBOX_FALLBACK, an email address, not a hostname)"
- kind: inventory
- artifacts: api/request-received.ts, api/calendar-reminders.ts
- decision-mention: none

### ITEM [batch5.md#35]
- report: TASK-CONTRACTORPHAN-REPORT.md
- date: 2026-08-11
- item: profiles.contact_id on admin@cactai.io (contact 8795c065) is still present — the remaining open D1 violation, confirmed and deliberately left for its own task because it touches identity plumbing.
- quote: "**`profiles.contact_id` on `admin@cactai.io`.** ... Confirmed still present. Left alone."
- kind: blocked-on-owner
- artifacts: profiles, contacts (8795c065), admin@cactai.io
- decision-mention: D1a

### ITEM [batch5.md#79]
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: Six test contacts/clients/invitations (cjzigs+r/+h/+rh/+ro/+ho/+rho@icloud.com) and purchases PUR-000063/64/65 were deliberately left in production, awaiting the owner's word to purge.
- quote: "Created deliberately for these runs; **no email was sent** ... Say the word and I'll purge them."
- kind: blocked-on-owner
- artifacts: contacts, clients, invitations, purchases (PUR-000063, PUR-000064, PUR-000065)
- decision-mention: none

### ITEM [batch5.md#80]
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: The email delivery leg of the invite flow is untested — SMTP and service-role credentials live in Vercel, not locally; one invite sent from the UI would prove it end to end.
- quote: "**The email leg** — one invite sent from the UI would prove it end to end."
- kind: not-verified
- artifacts: api/admin-send-invitation.ts
- decision-mention: none

### ITEM [batch5.md#111]
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Out of scope, said and not built — email templates are still hardcoded in api/ and must be extracted before they can be edited; also out: clause/section/field add-remove-reorder, render/layout, the Form engine, archive/delete controls, and clause headings.
- quote: "email templates (still hardcoded in `api/`, must be extracted first)"
- kind: deferred
- artifacts: api/ email templates, contract_clause_defs headings
- decision-mention: D12

### ITEM [batch6.md#3]
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: A18 (self-send copy) and A19 (download/print signed PDF) were never reachable, so EmailMeACopyButton and the download button are unverified, not confirmed working.
- quote: "EmailMeACopyButton and 'Download signed PDF' themselves were not exercised (never reachable), so their own correctness is unverified, not confirmed-broken."
- kind: not-verified
- artifacts: EmailMeACopyButton, my_documents()
- decision-mention: none

### ITEM [batch6.md#4]
- report: TASK-A-PARTY-VERIFY-REPORT.md
- date: 2026-08-04
- item: LESSEE (a company party) is structurally unverifiable — no login can ever equal the company's contact_id, and hello@fhequestrian.com is also a staff/admin login that bypasses party gating.
- quote: "no individual login, fresh or existing, can ever satisfy document_parties.contact_id = profiles.contact_id for this party ... No 'view as party' mechanism exists"
- kind: blocked-on-owner
- artifacts: redeem_contract_invitation, document_parties, profiles.contact_id, contract_document_detail
- decision-mention: none

### ITEM [batch6.md#9]
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: DocumentsPanel is functionally behind Documents.tsx — no signing, no email-me-a-copy, no pending/assigned visibility, no supersede history; a member who only opens the Account page cannot sign or see docs awaiting generation.
- quote: "a member who only ever opens the Account page cannot sign anything and cannot see documents awaiting generation. It predates this task"
- kind: defect
- artifacts: DocumentsPanel, AccountPanels.tsx, Documents.tsx, SelfSignRow, EmailMeACopyButton, my_documents, listMySignableDocuments
- decision-mention: none

### ITEM [batch7.md#51]
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: admin-send-invitation.ts's minor-reject branch is structurally unreachable against live data (the new trigger guarantees no minor carries an email); kept as defense-in-depth but not exercised via live HTTP.
- quote: "the guard's true-branch is, by construction, currently unreachable against live data ... Not exercised via a live HTTP call"
- kind: not-verified
- artifacts: api/admin-send-invitation.ts, is_minor_contact
- decision-mention: none

### ITEM [batch7.md#54]
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: Out of scope — profiles-based reminder senders (calendar-reminders, notifications-nudge) not touched; a minor without an account is already incidentally unreachable there.
- quote: "Profiles-based reminder senders ... these resolve recipients via `profiles`, and a minor without an account is already incidentally unreachable there. Not touched."
- kind: out-of-scope
- artifacts: calendar-reminders, notifications-nudge
- decision-mention: none

### ITEM [batch7.md#55]
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: No live email was sent by this task; all delivery-path reasoning in §3 is a traced read of the code against live rows, labeled "not executed".
- quote: "No live email was sent by this task. All delivery-path reasoning in §3 is a traced read of the code ... explicitly labeled "not executed""
- kind: not-verified
- artifacts: api/_lib/delivery.ts, api/deliver-document.ts, api/deliver-documents.ts
- decision-mention: none

### ITEM [batch7.md#56]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: D9 finding — the welcome and dunning email WORDING still exists in renderTemplate (api/_lib/email.ts) though the producers were deleted; deliberately not restored and not extracted, to avoid reversing a settled decision.
- quote: "the welcome and dunning WORDING still exists in `renderTemplate` ... No producer, no caller. Not restored, not extracted."
- kind: correctness
- artifacts: api/_lib/email.ts, renderTemplate
- decision-mention: D9

### ITEM [batch7.md#57]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: renderTemplate is now entirely dead (its last caller moved to the table); kept, not deleted — deleting it is a separate deliberate act.
- quote: "`renderTemplate` is now entirely dead — deleting it is a separate, deliberate act."
- kind: inventory
- artifacts: api/_lib/email.ts, renderTemplate
- decision-mention: none

### ITEM [batch7.md#58]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: Deviation — created an email-specific token namespace MSG.* (18 rows) despite the task saying not to, because those values are properties of the message; stated rather than slipped in.
- quote: "The task said "Do NOT create an email-specific token namespace." I created one: `MSG.*`, 18 rows."
- kind: correctness
- artifacts: template_tokens, MSG.*
- decision-mention: none

### ITEM [batch7.md#61]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: email_templates has no org_id — bodies are global; correct now but flagged to revisit when a second tenant wants different wording.
- quote: "`email_templates` has no `org_id` — bodies are global ... Correct now; revisit when a second tenant wants different wording."
- kind: correctness
- artifacts: email_templates
- decision-mention: none

### ITEM [batch7.md#62]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: No plain-text alternative exists and could not be added here — SendProviderInput has no text field; a text/plain alternative is transport work first, deliberately not added speculatively.
- quote: "No plain-text alternative exists, and could not be added here. `SendProviderInput` has no text field ... The column was deliberately not added speculatively."
- kind: out-of-scope
- artifacts: SendProviderInput
- decision-mention: none

### ITEM [batch7.md#63]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: request-received's three enum→label maps (CATEGORY_LABEL, CHANNEL_LABEL, CONTACT_METHOD_LABEL) are the last email-adjacent vocabulary left in code.
- quote: "`request-received`'s three enum→label maps are the last email-adjacent vocabulary in code"
- kind: correctness
- artifacts: request-received.ts, CATEGORY_LABEL, CHANNEL_LABEL, CONTACT_METHOD_LABEL
- decision-mention: none

### ITEM [batch7.md#64]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: The renderer is duplicated across api/_lib/emailTemplates.ts and the copy inside diff.mjs (a .mjs script cannot import .ts); the duplication is guarded by an assertion but remains.
- quote: "The renderer is duplicated — `api/_lib/emailTemplates.ts` ... and the copy inside `diff.mjs`"
- kind: correctness
- artifacts: api/_lib/emailTemplates.ts, scripts/emailextract/diff.mjs
- decision-mention: none

### ITEM [batch7.md#65]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: D13 is not fully satisfied — there is no UI; the owner can only change email wording via save_draft + publish RPCs (a thread or DB client). The Templates > Emails list is TASK-TEXTEDIT's surface, named as a follow-up.
- quote: "D13 IS NOT FULLY SATISFIED ... There is no UI ... this is `TASK-TEXTEDIT`'s surface, extended to a second list."
- kind: not-verified
- artifacts: email_template_list, email_template_save_draft, email_template_publish, src/lib/templateEditor.ts
- decision-mention: D13

### ITEM [batch7.md#67]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: test:db was not cited as proof — it is broken (60 of 68 files fail); proofs are the render harness and production transactions.
- quote: "`test:db` was not cited as proof of anything — it is broken (60 of 68 files fail)"
- kind: process
- artifacts: test:db
- decision-mention: none

### ITEM [batch7.md#68]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: Behavior change — fallback WORDS moved from code into templates; rendered output unchanged (proven) but the words are now owner-editable. The one behavior change, stated.
- quote: "The one behaviour change I made, and it is not in the output. Fallback WORDS moved from code into the templates"
- kind: correctness
- artifacts: email_templates, DOC.HAS_TITLE
- decision-mention: none

### ITEM [batch7.md#69]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: Correction — the measured "19 files that compose an email" was three high (3 compose nothing) and three low (3 composers not on the list); the real count is 19 distinct emails across 16 files.
- quote: "The measured "19 files" was three high and three low."
- kind: correctness
- artifacts: email-change-complete.ts, delivery-sweep.ts, admin-provision-tenant.ts, expire-holds.ts, contract-working-copy.ts, receipt.ts
- decision-mention: none

### ITEM [batch7.md#70]
- report: TASK-EMAILEXTRACT-REPORT.md
- date: 2026-08-12
- item: Correction — the 6-hour guard is in the executed-document delivery path, not the invitation path as the task described; invitation protections are different mechanisms.
- quote: "Correction to the task: the guard is in the executed-document delivery path, not the invitation path."
- kind: correctness
- artifacts: document_deliveries_doc_recipient_channel_uidx, supersede_invitations, invitation_request_resend
- decision-mention: none

### ITEM [batch8.md#7]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: One live lease document (215bac09, DOC-VWRU4KUN93) was created after the last cleanup and is only presumed to be owner testing.
- quote: "**One live lease document exists** (`215bac09-9f66-43ce-8655-85fd05fea1e2`, DOC-VWRU4KUN93, created 02:11 Aug 4, `hello@fhequestrian.com`) — created after the last cleanup, presumed owner testing."
- kind: data-integrity
- artifacts: documents (215bac09-9f66-43ce-8655-85fd05fea1e2)
- decision-mention: none

### ITEM [batch8.md#24]
- report: TASK-A16-REPORT.md
- date: 2026-08-04
- item: Judgment call flagged for the orchestrator — the pre-existing staff-only document_executed broadcast was removed and folded into the new party_signed call; a one-line revert restores two-rows-on-completion behavior if preferred.
- quote: "If the orchestrator would rather the old call be left untouched (accepting two staff rows on completion), that's a one-line revert — flagging here rather than assuming."
- kind: process
- artifacts: record_signature, notify_staff, 20260805030000_party_signed_notifications.sql
- decision-mention: none

### ITEM [batch8.md#25]
- report: TASK-A16-REPORT.md
- date: 2026-08-04
- item: Open question, not built — kiosk releases (sign_release) raise no staff notification of any kind today; whether they should get a party_signed-style alert is left for the orchestrator.
- quote: "Open question: should a kiosk release/waiver signing raise the same `party_signed`-style staff alert? It currently raises none at all"
- kind: blocked-on-owner
- artifacts: sign_release, api/sign-release.ts
- decision-mention: none

### ITEM [batch8.md#26]
- report: TASK-A16-REPORT.md
- date: 2026-08-04
- item: Characterization correction — record_signature already contained an undocumented completing-only staff broadcast the task doc's "Known context" did not mention; the A16 gap was real but narrower than a blank slate.
- quote: "This is a genuine, previously undocumented finding — the task doc's 'Known context' only mentions the execution *email* as separate/done and doesn't mention this in-app staff broadcast."
- kind: correction
- artifacts: record_signature, notify_staff
- decision-mention: none

### ITEM [batch8.md#34]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: The D3 execution-blocker predicate is duplicated verbatim in contract_lock_blockers and insurance_resolution_sync; any change must land in both or the blocker and the notification disagree.
- quote: "**Two predicates, not one.** The D3 logic is duplicated verbatim in `contract_lock_blockers` and `insurance_resolution_sync`. Any change to it must land in both"
- kind: landmine
- artifacts: contract_lock_blockers, insurance_resolution_sync
- decision-mention: none

### ITEM [batch8.md#43]
- report: TASK-LEASEGATE-PHASE1.md
- date: 2026-08-07
- item: On a partial lease with an uncovered Lessor, forcing NONE silently drops the deductible sentence and triggers an execution block plus an "Insurance responsibility unresolved" notification to both parties.
- quote: "On a partial lease with an uncovered Lessor, R1 causes an execution block and an 'Insurance responsibility unresolved' notification to both parties."
- kind: correctness
- artifacts: MORT_DEDR_SIMPLE, MED_DEDR_SIMPLE, insurance_resolution_sync
- decision-mention: none
