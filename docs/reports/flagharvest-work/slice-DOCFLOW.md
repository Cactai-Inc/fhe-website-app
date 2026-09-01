### ITEM [batch1.md#1]
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: The AccountHub and HorsePage UI changes were never visually confirmed in a browser; BUILD_TRACKER marks A11 PARTIAL, not DONE.
- quote: "`AccountHub` and `HorsePage` UI changes are code-complete and typecheck clean but have not been visually confirmed in a browser."
- kind: not-verified
- artifacts: src/pages/app/AccountHub.tsx, src/pages/app/HorsePage.tsx, docs/archive/BUILD_TRACKER.md
- decision-mention: none

### ITEM [batch1.md#4]
- report: TASK-A11-REPORT.md
- date: 2026-08-04
- item: Horse a8e82033 (Beau) carries a duplicated pair of active LESSEE horse_relationships rows for a different contact referencing a source_document_id that no longer exists in documents — pre-existing data noise, deliberately not touched.
- quote: "an unrelated, duplicated pair of active `LESSEE` `horse_relationships` rows for a different contact (`d5088607-4b60-413e-b221-0524469a5083`) referencing a `source_document_id` (`378c1fe9-bba6-45e5-a6ce-efae0b4f8c01`) that no longer exists in `documents`"
- kind: data-integrity
- artifacts: horse_relationships, documents
- decision-mention: none

### ITEM [batch1.md#8]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Correction to the DUPECENSUS census: its horse-document figures for Secret (5) and Tiz (8) included soft-deleted rows; the person-visible numbers are 3 and 6.
- quote: "`TASK-DUPECENSUS` recorded Secret at 5 and Tiz at 8. Those figures **included soft-deleted rows**"
- kind: correction
- artifacts: staff_horse_records, documents
- decision-mention: none

### ITEM [batch1.md#14]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: test:db is broken (60 of 68 files failing) and was not cited as proof anywhere; it is TASK-TESTDB's subject.
- quote: "It is broken (60 of 68 files failing) and is `TASK-TESTDB`'s subject."
- kind: known issue → process
- artifacts: test/db
- decision-mention: none

### ITEM [batch1.md#18]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Flagged not fixed: a staff account has no nav route to its own documents (useNavPresence(!isStaff) in AppLayout.tsx).
- quote: "**A staff account has no nav route to its own documents** (`useNavPresence(!isStaff)`, `AppLayout.tsx`)."
- kind: defect
- artifacts: src/components/app/AppLayout.tsx, useNavPresence
- decision-mention: none

### ITEM [batch1.md#31]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 1.2: staff_horse_records().document_count counts relationship rows created by a document, not documents — wrong for every horse in production (0 shown where up to 8 exist); one-line SQL fix recommended.
- quote: "**Not one of the four agrees.** Three horses read \"0 attached\" next to a documents icon while holding 5, 6 and 8 documents."
- kind: defect
- artifacts: staff_horse_records, src/pages/app/ops/HorseRecordsPage.tsx
- decision-mention: none

### ITEM [batch1.md#70]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: The manifest and route/nav/retirement tables go stale fast — main moved twice during the census and closed three findings; anything downstream (REVIEWNAV especially) must re-derive against main at the moment it runs.
- quote: "Anything downstream of this report — **REVIEWNAV especially** — must re-derive route tables, nav groups and retirement constants against `main` **at the moment it runs**, not trust this document's snapshot."
- kind: process
- artifacts: docs/reports/TASK-DUPECENSUS-REPORT.md
- decision-mention: none

### ITEM [batch1.md#71]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Related shadow catalogs: FORMS-ARE-UNUSED documents the 23 form_definitions rows read only by AdminFormsPage (a third hardcoded shadow); serviceCatalog.ts is a fourth; both should be resolved, neither supersedes the other.
- quote: "That doc names a **third** hardcoded shadow (form definitions, read only by `AdminFormsPage`). Mine (`src/lib/serviceCatalog.ts`) is a **fourth, and a different one**"
- kind: inventory
- artifacts: form_definitions, AdminFormsPage, src/lib/serviceCatalog.ts
- decision-mention: none

### ITEM [batch1.md#85]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Apply-order caveat: the held supersede migration must apply after the frontend deploys, or "Regenerate link" would mint a new link without retiring the old one during the gap.
- quote: "**Apply it after the frontend deploys.** Between the migration landing and the deploy, \"Regenerate link\" would mint a new link *without* retiring the old one"
- kind: process
- artifacts: api/admin-send-invitation.ts, docs/proposed/INVITEWORKS-provision-no-default-supersede.sql
- decision-mention: none

### ITEM [batch1.md#90]
- report: TASK-INVITEWORKS-REPORT.md
- date: 2026-08-11
- item: Test rows created by this work left in production per D1 (purges are owner-run): two full accounts (cjzigs+inviteworks@ and cjzigs+inviteworks2@), each contact + client + 4 required documents + membership, both redeemed and active — say the word and they go through purge_account.
- quote: "**Test rows created by this work, left in place** (D1: purges are owner-run, never ad hoc)."
- kind: process
- artifacts: contacts 972d89a6, a92aace9, purge_account
- decision-mention: D1

### ITEM [batch1.md#139]
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: No badge data model exists anywhere (no table, no code references beyond icons/pills), so the spec's badge slot was omitted, not faked, per the task doc's own instruction.
- quote: "No badge data model exists anywhere ... the badge slot is **omitted**, not faked."
- kind: inventory
- artifacts: (badge model — absent)
- decision-mention: none

### ITEM [batch1.md#143]
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: Not done: an authenticated in-browser click-through — K1–K4 marked "code-complete, browser pending"; owner or orchestrator should do a visual pass on /app/account → Profile & preferences before shipping.
- quote: "**Not done: an authenticated in-browser click-through.** ... Recommend the owner or the orchestrator does a visual pass on `/app/account` → \"Profile & preferences\" before this ships."
- kind: not-verified
- artifacts: /app/account, ProfileAndPreferences.tsx, docs/archive/BUILD_TRACKER.md §K
- decision-mention: none

### ITEM [batch1.md#145]
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: The mobile_number-vs-contacts.mobile decision was the closest approach to the STOP-and-ask gate — resolved by evidence (reuse would leak new internal data to the whole community via member_directory) and documented rather than guessed or blocked.
- quote: "The `mobile_number`-vs-`contacts.mobile` call (§2) is the one place this task came closest to the STOP-and-ask gate"
- kind: process
- artifacts: contacts.mobile_number, member_directory
- decision-mention: none

---

### ITEM [batch1.md#146]
- report: TASK-REQTRIGGER-REPORT.md
- date: 2026-08-12
- item: Kylie Pinion's request (created after LEADCLEAN's backfill) is the predicted third unlinked row and is left NULL per the do-not-backfill instruction; whether she and future NULL rows get a LEADCLEAN-style backfill is explicitly out of scope.
- quote: "Kylie Pinion ... is the **third** unlinked row the task doc predicted. It is left NULL, per the \"do not backfill\" instruction"
- kind: process
- artifacts: requests (row 8f0dc795), requests.contact_id
- decision-mention: none

### ITEM [batch1.md#153]
- report: TASK-TITLESWEEP-REPORT.md
- date: 2026-08-05
- item: Orders was not explicitly named in the owner's spec table — the eyebrow/intro change was applied by pattern for consistency, flagged prominently, and is a 2-line diff to revert if vetoed.
- quote: "**Owner did not explicitly name Orders in the spec table — applied by pattern for consistency with the other list pages. Flagging prominently per the task doc's instruction; easy to revert (2-line diff) if vetoed.**"
- kind: blocked-on-owner
- artifacts: src/pages/app/Orders.tsx
- decision-mention: none

### ITEM [batch1.md#155]
- report: TASK-TITLESWEEP-REPORT.md
- date: 2026-08-05
- item: Correction: the task doc's stated lint baseline (29 warnings) is stale — unmodified origin/main gives 36/0; verified by stashing and re-running.
- quote: "The task doc's stated baseline (29 warnings) is stale — verified by stashing this task's changes and re-running lint against unmodified `origin/main` (`800b352`): same 36/0."
- kind: correction
- artifacts: npm run lint
- decision-mention: none

### ITEM [batch1.md#156]
- report: TASK-TITLESWEEP-REPORT.md
- date: 2026-08-05
- item: All edits are code-complete but not visually verified in a running browser (no dev server session), consistent with prior UI-copy tasks; visual risk limited to intended copy changes.
- quote: "All edits are code-complete but not visually verified in a running browser (no dev server session run in this pass)"
- kind: not-verified
- artifacts: AccountHub.tsx, Support.tsx, Schedule.tsx, MyLessons.tsx, Gifts.tsx, CareHome.tsx, Documents.tsx, MyPosts.tsx, Orders.tsx
- decision-mention: none

---

### ITEM [batch2.md#2]
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: The full test/db suite now runs for the first time and shows 97 failing tests and 38 fully-failing suite files that were not investigated individually — a body of findings needing a dedicated triage pass.
- quote: "The 97 failures and 38 fully-failing suite files were not investigated individually — outside Task 4's stated scope ... but are now visible for the first time and worth a dedicated pass."
- kind: defect
- artifacts: test/db
- decision-mention: none

### ITEM [batch2.md#5]
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: docs/archive/BACKLOG.md's other pre-existing open items (Business admin suite, pending_fee_candidates p.mobile bug, dead nav route, placeholder media) were untouched this run, out of scope.
- quote: "`docs/archive/BACKLOG.md`'s other pre-existing open items (Business admin suite, `pending_fee_candidates` p.mobile bug, dead nav route, placeholder media) — untouched this run, out of scope."
- kind: inventory
- artifacts: docs/archive/BACKLOG.md, pending_fee_candidates
- decision-mention: none

### ITEM [batch2.md#8]
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: Test document c36449f7 remains flagged "void or dispose at cleanup" in BACKLOG.md; its test field values were deliberately left as-is per that existing disposition.
- quote: "`c36449f7` is already flagged \"void or dispose at cleanup\" in `BACKLOG.md` from the prior session, so its test values were left as-is per that existing disposition"
- kind: process
- artifacts: docs/archive/BACKLOG.md, documents (c36449f7)
- decision-mention: none

### ITEM [batch2.md#21]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: The plan's U7 text conflated an unrelated retirement — the "|| confirmed widenings and the types.ts:22 union member" is BACKLOG's purchases.status='confirmed' Stripe-vocabulary item, not a phone/contact column; left alone as report-only.
- quote: "The plan conflated two unrelated retirements; left alone as report-only, not applied here."
- kind: correctness
- artifacts: purchases.status, types.ts:22, docs/archive/BACKLOG.md
- decision-mention: none

### ITEM [batch2.md#24]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: Two documents created this run are on the pre-launch cleanup list: c36449f7 (the sample's proof draft) and 4051bd91 (superseded first attempt, voided via void_document).
- quote: "both documents are recorded in `docs/archive/BACKLOG.md`'s pre-launch cleanup list"
- kind: process
- artifacts: documents (c36449f7, 4051bd91), docs/archive/BACKLOG.md
- decision-mention: none

### ITEM [batch2.md#29]
- report: TASK-A8-REPORT.md
- date: 2026-08-05
- item: Deviation: the task doc's assumed config_values key/value schema was wrong — the table has (namespace, key, value_text, value_num, value_json); queries were corrected by reading the actual table and its readers.
- quote: "`config_values` does not have a `key`/`value` pair — it has `(namespace, key, value_text, value_num, value_json)`."
- kind: correctness
- artifacts: config_values
- decision-mention: none

### ITEM [batch2.md#52]
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: Third bug found only by dry-running: redeem_gift lacked redeem_invitation's profiles-insert guard, so every real redemption by a genuinely new recipient would have failed with "no profile for user"; fixed by mirroring the existing insert.
- quote: "Every real redemption by a genuinely new recipient would have failed with exactly this error."
- kind: correctness
- artifacts: redeem_gift, promote_contact_to_account, profiles
- decision-mention: none

### ITEM [batch2.md#55]
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: The nav filter was NOT applied — AppLayout.tsx belongs to unmerged (explicitly HELD) TASK-HORSEONE, so it is held as a proven patch; until applied, hiding a page changes the status tile but no nav row, and the settings page has no nav entry (reachable only by URL).
- quote: "until the patch is applied, hiding a page changes the status tile but changes no nav row, and the settings page has no nav entry (reach it at `/app/ops/admin/pages`)"
- kind: blocked-on-owner
- artifacts: docs/reports/PAGEVIS-navfilter.patch, src/components/app/AppLayout.tsx, /app/ops/admin/pages
- decision-mention: none

### ITEM [batch2.md#56]
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: If the held patch's eight child nav rows are ever rejected, the no-cascade hub-hiding rule must become cascade-with-warning — the two decisions are joined; hiding a hub without child rows would strand its children.
- quote: "**if those rows are ever rejected, this rule must become cascade-with-warning.**"
- kind: process
- artifacts: docs/reports/PAGEVIS-navfilter.patch, src/lib/pageRegistry.ts
- decision-mention: none

### ITEM [batch2.md#68]
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Correction: the task doc's file names don't match the repo — there is no StablePage.tsx, HorsePage.tsx is a single-horse detail view, and the doc's "(HorseIntakePage)" is a different, booking/purchase-context flow, not the generic add-to-my-stable flow.
- quote: "There is no `StablePage.tsx` and `HorsePage.tsx` is a single-horse detail view, not a list — the task doc's file names don't match the repo."
- kind: correctness
- artifacts: AccountHub.tsx, StableSection, HorseIntakeForm
- decision-mention: none

### ITEM [batch2.md#69]
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Correction: the task doc's "(createThread)" reference for Messages is inaccurate — createThread is the community discussion flow; DMs use sendDirectMessage.
- quote: "The task doc's \"(createThread)\" reference is inaccurate — `createThread` is the *community discussion* flow (used by CreateModal's `discussion` post type), not DMs"
- kind: correctness
- artifacts: Messages.tsx, sendDirectMessage, createThread
- decision-mention: none

### ITEM [batch2.md#72]
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Correction: CLAUDE.md's stated lint baseline (~26 warnings) is stale — the true measured clean-tree baseline is 29.
- quote: "the real baseline is **29** warnings, not the ~26 CLAUDE.md states (that doc is a bit stale)"
- kind: correctness
- artifacts: CLAUDE.md
- decision-mention: none

### ITEM [batch2.md#89]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: The user-visible "Ops" label (two page eyebrows) is carried forward, not fixed — page naming belongs to the owner's post-restructuring re-bucketing pass; the paragraph must survive into whatever task does the re-bucketing.
- quote: "**Not fixed here** — an eyebrow is part of a page's naming, which is what the re-bucketing pass decides ... **This paragraph is the carry-forward; it must survive into whatever task does the re-bucketing.**"
- kind: process
- artifacts: src/pages/app/ops/DocumentsQueuePage.tsx:337, src/pages/app/ops/PaymentReviewPage.tsx:106
- decision-mention: none

### ITEM [batch2.md#91]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Honest conflict recorded: the Team nav row is temporarily gated adminOnly while in Review, tighter than its requireStaff route, contradicting the comment at its call site — currently hides the row from nobody (no MANAGER/EMPLOYEE accounts exist); restore Team without adminOnly on acceptance.
- quote: "While Team sits in Review it **is** gated tighter than its route. ... Restore Team without `adminOnly` on acceptance; the comment says so at the call site."
- kind: process
- artifacts: /app/ops/team, AppLayout.tsx, profiles.role
- decision-mention: none

### ITEM [batch2.md#94]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Deviation: DUPECENSUS's manifest instruction to flip both retirement booleans was deliberately not followed — flipping would put a retired page back into the live app for every user; both constants stay true and a test enforces it.
- quote: "**DUPECENSUS's manifest says to flip both booleans.** That instruction was **not followed** — the task doc overrides it"
- kind: process
- artifacts: CONTACTS_PAGE_RETIRED, INTAKE_PAGE_RETIRED, ContactsPage.tsx:523, IntakePage.tsx:447
- decision-mention: none

### ITEM [batch2.md#108]
- report: TASK-ROSTERCARD-REPORT.md
- date: 2026-08-11
- item: Data-quality find, not fixed: horse_relationships carries two orphaned active LESSEE rows for Beaumont de Cactai referencing a contact_id that no longer exists in contacts and a source_document_id that doesn't exist in documents — likely leftover synthetic demo data; the lessee_contact_id stamp was used instead.
- quote: "**two for a contact_id that no longer exists in `contacts` at all**, referencing a `source_document_id` that doesn't exist in `documents` either — orphaned rows"
- kind: data-integrity
- artifacts: horse_relationships, horses.lessee_contact_id, contacts, documents
- decision-mention: none

### ITEM [batch3.md#20]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit findings (driver 1 "maybe" tier, none fixed): missing min-w-0/truncate guards at AdminRegistryPage.tsx:159-160, PaymentReviewPage.tsx:166-176 and 210-217, DealPage.tsx:281-287, ForgotPassword.tsx:41 (root AuthLayout.tsx:22-23), Register.tsx:269+, RegisterComplete.tsx:157+, TenantDetailPage.tsx:107-108, StableSection.tsx:101 and 119, ServiceSelector.tsx:93-94, PostModal.tsx:276, MemberProfile.tsx:85-88, SupportPage.tsx:80-84, DocumentViewerPage.tsx:156-159, Account.tsx:96-99.
- quote: "**28 findings: 19 driver-1 (flex missing `min-w-0`)... None of these are fixed in this branch**"
- kind: defect
- artifacts: src/pages/app/ops/admin/AdminRegistryPage.tsx, src/pages/app/ops/PaymentReviewPage.tsx, src/pages/app/ops/DealPage.tsx, src/pages/ForgotPassword.tsx, src/components/auth/AuthLayout.tsx, src/pages/Register.tsx, src/pages/RegisterComplete.tsx, src/pages/app/ops/superadmin/TenantDetailPage.tsx, src/components/app/StableSection.tsx, src/components/ServiceSelector.tsx, src/components/feed/PostModal.tsx, src/pages/app/MemberProfile.tsx, src/pages/app/ops/SupportPage.tsx, src/pages/app/ops/DocumentViewerPage.tsx, src/pages/app/Account.tsx
- decision-mention: none

### ITEM [batch3.md#62]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Q2 unresolved contradiction: the task doc frames the avatar as a live choice (inert vs link to /app/account) while commit bd1b820's message rules it inert — the two readings produce different components; needs explicit owner reconciliation before Phase 2.
- quote: "is the avatar inert, or a link to `/app/account`? The doc and the commit history disagree with each other right now."
- kind: blocked-on-owner
- artifacts: CardstockHeader.tsx, onAvatarClick, header-cardstock.css:200
- decision-mention: none

### ITEM [batch3.md#74]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: Correction to the task doc: B6's "other six pages using the title model" is actually twelve (plus two ops instances) — the doc's inventory was stale; action unchanged (leave everything as-is).
- quote: "The actual count, searched fresh rather than trusted from the doc, is **twelve** other pages, not six"
- kind: correction
- artifacts: src/pages/app/ (title-model pages)
- decision-mention: none

### ITEM [batch3.md#76]
- report: TASK-PAGETITLES-REPORT.md
- date: 2026-08-05
- item: Eleven other pages (Account, My Posts, Documents, Orders, Schedule, Support, My Lessons, Gifts, Onboarding, CareHome, DealHome) still carry a large dark-green title as their default — none touched; owner must rule whether the new default-title rule extends to them.
- quote: "None of these were touched — flagging per the task doc's instruction to note which other pages still carry a large title so the owner can rule on them."
- kind: blocked-on-owner
- artifacts: AccountHub.tsx, MyPosts.tsx, Documents.tsx, Orders.tsx, Schedule.tsx, Support.tsx, MyLessons.tsx, Gifts.tsx, Onboarding.tsx, CareHome.tsx, DealHome.tsx
- decision-mention: none

### ITEM [batch3.md#81]
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: Discrepancy: the task doc recorded CONTACT 20 but production reads CONTACT 17 (three rows fewer) — measured fresh, not investigated further.
- quote: "**One discrepancy, stated plainly: the task doc recorded `CONTACT 20`; production now reads `CONTACT 17`**, three rows fewer"
- kind: correction
- artifacts: contacts table
- decision-mention: none

### ITEM [batch3.md#100]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-001 correction: the state doc's lint baseline of 26 warnings is wrong — the actual pre-existing baseline on the branch is 30 (later 35 after a main merge).
- quote: "confirmed this is the pre-existing baseline on this branch, not 26 as the state doc says"
- kind: correction
- artifacts: npm run lint baseline
- decision-mention: none

### ITEM [batch3.md#105]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-004: overscroll chaining itself is untested on any device — a runtime scroll-physics behavior invisible to static checks; explicitly unverified, not "probably fine".
- quote: "Overscroll chaining itself. ... I have not tested it on a device, iOS or otherwise. Confirming this is unverified, not \"probably fine.\""
- kind: not-verified
- artifacts: overscroll-behavior:contain sites (27 files)
- decision-mention: none

### ITEM [batch3.md#107]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-006 gap 1 NOT shipped: the avatar's open state is still identical to pressed; a three-option rendered comparison page was built and the gap remains in the shipped avatar until the owner picks.
- quote: "`app-header.css` still pairs `:active` and `[aria-expanded='true']` unchanged — this is a real gap in the shipped avatar, not resolved by this commit, until the owner picks from that page."
- kind: blocked-on-owner
- artifacts: docs/reference/uio-006-open-state-options.html, src/components/app/app-header.css
- decision-mention: none

### ITEM [batch3.md#110]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-012: no nav group's open/collapsed state persists across a page reload (openGroups is plain useState, no localStorage) — unlike staffRailPinned and communityNav.expanded; flagged in case "same persistence" was assumed to mean "persists".
- quote: "`openGroups` is plain `useState({})` with no `localStorage` read/write anywhere I could find ... flagging in case that's news"
- kind: caveat
- artifacts: openGroups, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM [batch3.md#113]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-005 correction: the order's Files section lists two files but the named cherry-pick touches three — tailwind.config.js is a hard dependency (the 66% opacity step) and was included.
- quote: "It touches three files, not the two the order's own \"Files\" section lists (`tailwind.config.js` is the third)"
- kind: correction
- artifacts: tailwind.config.js
- decision-mention: none

### ITEM [batch3.md#115]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-013 selected-fill NOT shipped: cream-25 label on a light-gold fill maxes out at 2.66:1 contrast at any alpha — structurally incompatible, not a tuning problem; NAV_ROW_ACTIVE unchanged, finding documented in a code comment; the coupled badge-on-selected-row change also held pending owner resolution.
- quote: "best case is 2.66:1 at 100% opacity (no blend at all) — the fill and the label color are structurally incompatible, not a tuning problem. `NAV_ROW_ACTIVE` is byte-for-byte unchanged"
- kind: blocked-on-owner
- artifacts: NAV_ROW_ACTIVE, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM [batch4.md#2]
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: Two unrelated files from another session's in-progress work were swept up by the stash -u flag and had to be identified and excluded from the commit.
- quote: "Two unrelated files that were swept up by the stash's `-u` flag from that other session's in-progress work (`api/request-received.ts`, `api/support-received.ts`) were identified and excluded before committing"
- kind: process
- artifacts: api/request-received.ts, api/support-received.ts
- decision-mention: none

### ITEM [batch4.md#6]
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: Endpoint recipient-filter verification was reasoned line-by-line only, not exercised against a deployed preview (no preview exists, no service-role key locally).
- quote: "Endpoint recipient-filter verification: reasoned line-by-line (not exercised against a preview) ... no deployed preview exists for this branch ... So a local invocation of the handler ... is not possible either"
- kind: not-verified
- artifacts: api/deliver-documents.ts, api/_lib/supabaseAdmin.ts
- decision-mention: none

### ITEM [batch4.md#28]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: ?section=profile and ?section=documents deep links have no link anywhere in the codebase.
- quote: "`?section=profile` deep link has no link ... Nothing in the codebase links to `?section=profile` or `?section=documents`."
- kind: correctness
- artifacts: AccountHub, PRESENCE_LINKS
- decision-mention: none

### ITEM [batch4.md#36]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: 9.1 — Three profiles rows (zz-test seller/buyer/cobuyer) violate two validated, enabled foreign keys; auth.users has 9 rows but profiles has 10. Cause could not be determined.
- quote: "Three `profiles` rows violate two validated foreign keys ... Both constraints exist, are validated, and their RI triggers are enabled ... I could not determine how the rows came to violate the constraints; the state is verified, the cause is not."
- kind: data-integrity
- artifacts: profiles, profiles_contact_id_fkey, profiles_user_id_fkey, auth.users
- decision-mention: none

### ITEM [batch4.md#38]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: CLAUDE.md D9 describes profiles.payment_reminders as vestigial, but the column does not exist.
- quote: "`profiles.payment_reminders` — described in `CLAUDE.md` D9 as 'a vestigial column with no reader' — **does not exist**"
- kind: correctness
- artifacts: profiles
- decision-mention: D9

### ITEM [batch4.md#43]
- report: TASK-ADDNEW-REPORT.md
- date: 2026-08-12
- item: Substituted the lucide Plus glyph for DocumentsQueuePage's literal "+" text character; flagged in case the owner meant the literal glyph specifically.
- quote: "I did **not** copy `DocumentsQueuePage.tsx:345`'s exact markup (a literal `+` text character, no SVG). I kept the `lucide-react` `Plus` glyph ... **Flagging this substitution explicitly** in case the owner meant the literal glyph specifically."
- kind: cosmetic
- artifacts: PageHeader.tsx, DocumentsQueuePage.tsx
- decision-mention: A6 (supersedes)

### ITEM [batch4.md#46]
- report: TASK-ADDNEW-REPORT.md
- date: 2026-08-12
- item: No browser verification — no Supabase creds in worktree; all six affected pages proven only by diff/typecheck/lint/CSS, someone with a browser should check aria-labels and widths.
- quote: "NOT VERIFIED — no browser session available ... The following is proven by diff, typecheck, lint, and built-CSS inspection only. **Someone with a browser should look at:**"
- kind: not-verified
- artifacts: CareHome.tsx, Admin.tsx, DealsPage.tsx, HorseRecordsPage.tsx, ContactsPage.tsx, DocumentsQueuePage.tsx
- decision-mention: none

### ITEM [batch4.md#61]
- report: TASK-BP410-REPORT.md
- date: 2026-08-07
- item: The exact half-pixel rounding for .cs-fh (16.5px) was assumed from the task doc's worked example, not eyeballed against a mockup (no mockup exists for the compact marks).
- quote: "Assumed: the exact half-pixel rounding for `.cs-fh` (16.5px) follows the task doc's own worked example ... rather than a fresh eyeball pass against a mockup — there is no mockup for the compact marks to eyeball against"
- kind: not-verified
- artifacts: header-cardstock.css .cs-fh
- decision-mention: none

### ITEM [batch4.md#64]
- report: TASK-COMPANYFIX-REPORT.md
- date: 2026-08-05
- item: The task doc's stated threat model doesn't hold — the old LIMIT 1 was never at risk of binding to the wrong company within one org; the change is legitimate hardening but does not fix a live bug.
- quote: "So: `company_contact_id()`'s old `LIMIT 1` was never actually at risk of binding to the wrong company within one org ... this task's schema/backfill/function change is a legitimate hardening ... but it does not fix a live bug, and the specified adversarial proof cannot be performed against the current schema."
- kind: correctness
- artifacts: company_contact_id()
- decision-mention: none

### ITEM [batch4.md#69]
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: "By person" preset deviates from v1's deep-link-into-dossier spec — filters the same list in place instead; flagged for the owner to veto if the deep-link was load-bearing.
- quote: "Deviates from v1's literal 'deep-links into the existing dossier Documents tab ...' I filter the SAME list in place instead ... Flagging the deviation for the owner to veto if the deep-link was actually load-bearing."
- kind: blocked-on-owner
- artifacts: DocumentsQueuePage.tsx, ContactDossierModal, Admin.tsx
- decision-mention: none

### ITEM [batch4.md#73]
- report: TASK-DOCQUEUE-REPORT.md
- date: 2026-08-11
- item: Render NOT VERIFIED — no staff browser session; everything proved at query/type level only.
- quote: "**Render: NOT VERIFIED.** No staff browser session exists in this environment. Everything above is proved at the query/type level, not by clicking through the UI."
- kind: not-verified
- artifacts: DocumentsQueuePage.tsx, DocumentQueueTable.tsx
- decision-mention: none

### ITEM [batch4.md#105]
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: .cs-tab and .cs-drawer-tab CSS were not deleted line-by-line as the task asked — the cardstock stylesheet is unimported so they're dead by a stronger mechanism (shelved intact for restore).
- quote: "This is why `.cs-tab` and `.cs-drawer-tab` were not deleted line-by-line as the task doc asked. They are dead by a stronger mechanism than deletion: the stylesheet that declares them is not imported"
- kind: inventory
- artifacts: CardstockHeader.tsx, header-cardstock.css, .cs-tab, .cs-drawer-tab, public/header-stock.jpg
- decision-mention: none

### ITEM [batch4.md#106]
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Open question 1 — should the app header minify on scroll? Built fixed-height as the safer default; recommend keeping fixed, but it's the owner's call.
- quote: "**Should the app header minify on scroll?** The task doc asks this and names a fixed height as the safer default; that is what is built ... Recommend keeping it fixed."
- kind: blocked-on-owner
- artifacts: AppHeader.tsx, --cs-hdr-h
- decision-mention: none

### ITEM [batch4.md#108]
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Open question 3 — the third header item (H3 in the task doc) was cut off mid-sentence; still unknown, the doc says "Ask."
- quote: "**The third header item, cut off mid-sentence (H3 in the task doc).** Still unknown — the doc says 'Ask.' Asking."
- kind: blocked-on-owner
- artifacts: AppHeader.tsx
- decision-mention: none

### ITEM [batch4.md#114]
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: §2 (stop the churn refactor) is built and dry-run but deliberately NOT applied — waits on the review the APPLY MODE section calls for.
- quote: "**§2 is built, dry-run, and NOT applied** — it waits on the review the APPLY MODE section calls for."
- kind: blocked-on-owner
- artifacts: 20260810T1400_sendguard_reuse_pending_onboarding_document.sql, compose_document_body, regenerate_document_body, generate_document
- decision-mention: none

### ITEM [batch4.md#118]
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: Known limitation stated — regenerate_document_body takes service type as a parameter (row doesn't record it); a future caller regenerating a document generated with a service type (ensure_horse_documents passes 'horse') must pass the same value or cut-blocks compose differently.
- quote: "**Known limitation, stated rather than hidden:** `regenerate_document_body` takes the service type as a parameter because the row does not record it. ... A future caller ... must pass the same value or the `JUMPER_*` cut-blocks would compose differently."
- kind: correctness
- artifacts: regenerate_document_body, generate_my_onboarding_documents, ensure_horse_documents
- decision-mention: none

### ITEM [batch4.md#121]
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: §2's behaviour under a concurrent second session (two tabs entering onboarding at once) is not modelled — reuse path is SELECT...LIMIT 1 with no lock; not a regression but not tested.
- quote: "**§2's behaviour under a *concurrent* second session** ... is not modelled. The reuse path is `SELECT … ORDER BY created_at DESC LIMIT 1` with no lock. ... I did not test it."
- kind: not-verified
- artifacts: generate_my_onboarding_documents
- decision-mention: none

### ITEM [batch4.md#122]
- report: TASK-SENDGUARD-REPORT.md
- date: 2026-08-10
- item: Did not re-derive the task's account of Sarah's three documents — took F1/F2 as given, verified only F3.
- quote: "I did not re-derive the task doc's account of Sarah's three documents; I took F1/F2 as given and verified only F3, the claim §3 depends on."
- kind: not-verified
- artifacts: none
- decision-mention: F1, F2, F3

### ITEM [batch4.md#124]
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: Base commit differs from the brief — brief said 267fc97 but origin/main had moved one docs-only commit ahead to 38c2b05; branched off current main. Flagged.
- quote: "The brief said `267fc97`; `origin/main` had moved one commit ahead to `38c2b05` ... Flagging it because it differs from the brief."
- kind: process
- artifacts: none
- decision-mention: none

### ITEM [batch4.md#130]
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: The latent-case count measured 8 people / 18 documents vs the brief's 10/20 (brief count predates the Bug A backfill); did not simulate each of the other 7 logins.
- quote: "The 8 latent cases: I measured **8 people / 18 documents** ... the brief says 10/20 — that count predates the Bug A backfill ... I did not simulate each of their logins."
- kind: not-verified
- artifacts: none
- decision-mention: none

### ITEM [batch5.md#1]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: Stages 4 and 5 (U4/U5 hardening + insurance, U7 legacy retirement) were deliberately not started, with conditional owner gates that still stand (Stage 5 drops only if the zero-reader sweep is zero; H2 only if both callers carry authenticated sessions, else stop).
- quote: "Ended at: owner instruction — Stages 4 and 5 deliberately NOT started."
- kind: blocked-on-owner
- artifacts: docs/reports/PROMPT_A_STAGES_1-3.md
- decision-mention: none

### ITEM [batch5.md#3]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: Correction — BACKLOG's stated cause for the unrunnable DB test suites ("needs a dedicated test database") is wrong; the harness is in-process PGlite and needs no external database.
- quote: "BACKLOG says the suites need \"a dedicated test database\" — **that is wrong**: the harness uses in-process PGlite and needs no external database."
- kind: correction
- artifacts: docs/archive/BACKLOG.md, test/db/harness.ts
- decision-mention: none

### ITEM [batch5.md#7]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: The intake deep-link is inert — IntakePage.tsx reads no query params, so `?request=<id>` renders but does not deep-link; wiring it is a recorded follow-up in BACKLOG.
- quote: "`IntakePage.tsx` reads no query params, so `?request=<id>` renders fine but does not deep-link ... the deep-link is a recorded follow-up."
- kind: defect
- artifacts: src/pages IntakePage.tsx, docs/archive/BACKLOG.md
- decision-mention: D3 (report's internal decision numbering)

### ITEM [batch5.md#9]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: The Charles Zigmund duplicate contact pair (07ab7dbf/d268330c) is explicitly NOT merged (d268330c is the live lessor on the reference draft) and two "Unnamed Contact" artifacts (bb57e418, 6ecceaf0) await the pre-launch purge — all recorded in BACKLOG.
- quote: "the Zigmund pair (**explicitly NOT merged** — `d268330c` is the live lessor on the reference sample draft) and the two `Unnamed Contact` artifacts."
- kind: data-integrity
- artifacts: contacts (07ab7dbf, d268330c, bb57e418, 6ecceaf0), docs/archive/BACKLOG.md
- decision-mention: D1 (report's internal decision numbering)

### ITEM [batch5.md#48]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: The horizontal-overflow bug is expected to be visibly worse with more columns toggled on — no scroll container exists at any level; that is TASK-FRAMESCROLL's fix and was deliberately not built here.
- quote: "**Expect the horizontal-overflow bug to be visibly worse than before** ... This is `TASK-FRAMESCROLL`'s fix; not built here per the task's explicit instruction."
- kind: known issue
- artifacts: src/components/ops/kit/DataTable.tsx, DocumentQueueTable.tsx
- decision-mention: none

### ITEM [batch5.md#49]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: Column-visibility persistence went to localStorage keyed per user (a display preference, no DB table) — a call the task allowed the implementer to make; recorded.
- quote: "This is a display preference, not tenant data — per the task's own explicit allowance to make this call and say so if I disagreed."
- kind: process
- artifacts: DocumentQueueTable.tsx, localStorage docQueue.columns.${user_id}
- decision-mention: none

### ITEM [batch5.md#50]
- report: TASK-DOCCOLS-REPORT.md
- date: 2026-08-11
- item: One new react-refresh/only-export-components lint warning on DocumentQueueTable.tsx — same class already present on ~15 other files for the same reason.
- quote: "one new `react-refresh/only-export-components` warning on `DocumentQueueTable.tsx`, same class already present on ~15 other files"
- kind: cosmetic
- artifacts: src/components/ops/documents/DocumentQueueTable.tsx
- decision-mention: none

### ITEM [batch5.md#53]
- report: TASK-DOCPACKET-REPORT.md
- date: 2026-08-11
- item: Authenticated browser click-through not done — worktree .env holds placeholder Supabase creds, no way to load /app/admin as staff; a visual pass by someone with a real staff session is recommended before considering this closed.
- quote: "Recommend an owner or thread with a real staff session give the Documents tab one visual pass before this is considered fully closed."
- kind: not-verified
- artifacts: src/pages/app/Admin.tsx, admin_client_documents
- decision-mention: none

### ITEM [batch5.md#54]
- report: TASK-DOCPACKET-REPORT.md
- date: 2026-08-11
- item: Open owner item — pick the packet display name ("Onboarding Packet" current default vs "Onboarding Documents" or other); one string constant DOCUMENT_PACKET_NAME in Admin.tsx.
- quote: "**Packet name.** Pick between \"Onboarding Packet\" (current default) and \"Onboarding Documents,\" or supply different wording"
- kind: blocked-on-owner
- artifacts: src/pages/app/Admin.tsx (DOCUMENT_PACKET_NAME)
- decision-mention: none

### ITEM [batch5.md#67]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The drawer pops in instantly while its tab slides over .28s (drawer conditionally mounted, no transition) — not touched per the doc; a drawer transition would make the pair read as one motion.
- quote: "The mockup's drawer pops in instantly while the tab slides out over .28s ... I did not touch the drawer, per the doc."
- kind: cosmetic
- artifacts: AppLayout.tsx (drawer), CardstockHeader.tsx (drawer tab)
- decision-mention: none

### ITEM [batch5.md#69]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The reference mockup file itself is defective — its inline script runs before the DOM nodes exist, throws, and none of the drawer or modal behaviour works in the checked-in reference; not edited, flagged for fixing in the mockup.
- quote: "it throws `Cannot read properties of null` and **none of the drawer or modal behaviour works in the reference as checked in**. Only the avatar press physics run."
- kind: defect
- artifacts: docs/reference/header-mockup.html
- decision-mention: none

### ITEM [batch5.md#75]
- report: TASK-HORSEDOCS-REPORT.md
- date: 2026-08-10
- item: The staff-caller branch of ensure_horse_documents was not exercised — what a staff caller sees differently was not verified.
- quote: "I did not verify what a **staff** caller sees differently; the authorization branch was not exercised for `has_staff_access() = t`."
- kind: not-verified
- artifacts: ensure_horse_documents
- decision-mention: none

### ITEM [batch5.md#83]
- report: TASK-INVITEFLOW-REPORT.md
- date: 2026-08-10
- item: Two self-corrections on the record — Claire Bourdon self-healed (category-less ~45 minutes, not permanently) and the nine riders were never at risk (RIDER derives from 4 executed documents each); earlier claims were wrong.
- quote: "**The nine riders were never at risk.** ... I said they would lose it at activation; that was wrong."
- kind: correction
- artifacts: derive_affiliations, groups
- decision-mention: none

---

### ITEM [batch5.md#86]
- report: TASK-PURPOSEFIX-REPORT.md
- date: 2026-08-11
- item: Lint baseline discrepancy — task doc states 29 warnings, the branch point measures 35 with zero src changes; the 29 figure appears stale, flagged rather than silently reporting "matches baseline".
- quote: "the 29 figure appears to be stale relative to `origin/main`'s current state ... Flagging the discrepancy rather than silently reporting \"matches baseline.\""
- kind: correction
- artifacts: eslint baseline
- decision-mention: none

### ITEM [batch5.md#94]
- report: TASK-SECFIX-REPORT.md
- date: 2026-08-07
- item: Everything the task doc lists under "Also found by ACCTEVAL — NOT in this task" remains untouched.
- quote: "Everything under \"Also found by ACCTEVAL — NOT in this task\" remains untouched."
- kind: deferred
- artifacts: ACCTEVAL findings list
- decision-mention: none

### ITEM [batch5.md#104]
- report: TASK-SECFIX2-REPORT.md
- date: 2026-08-07
- item: The 3 non-member accounts (aaaa1111-…0001/2/3) look like seed rows from their uuids but were not confirmed to be test data rather than real people.
- quote: "**The 3 non-member accounts** ... look like seed rows from their uuids. I did not confirm they are test data rather than real people."
- kind: not-verified
- artifacts: profiles (aaaa1111-0000-4000-8000-000000000001/2/3)
- decision-mention: none

---

### ITEM [batch5.md#113]
- report: TASK-TEXTEDIT-REPORT.md
- date: 2026-08-12
- item: Known standing blocker restated — test/db is not proof: 55 of 64 test files fail, so the DB half was proven with direct SQL against prod instead.
- quote: "per the task's instruction that `test:db` (55/64 files failing) is not proof."
- kind: known issue
- artifacts: test/db
- decision-mention: none

### ITEM [batch6.md#14]
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: My Lessons document title and on-screen eyebrow disagree in casing ("My Lessons" vs lowercase "My lessons").
- quote: "Document title (useDocumentTitle('My Lessons')) and the page's own on-screen eyebrow ... already disagree in casing with each other too — another small pre-existing inconsistency"
- kind: cosmetic
- artifacts: MyLessons.tsx
- decision-mention: none

### ITEM [batch6.md#16]
- report: TASK-ACCOUNTSURFACE-PHASE1.md
- date: 2026-08-07
- item: Task doc cites AppLayout.tsx line numbers :139/:504 but the actual call sites are :140/:505 — a one-line drift from unrelated edits.
- quote: "The task doc cites :139/:504 — a one-line drift from small unrelated edits since the doc was written; same two call sites, no third found"
- kind: correctness
- artifacts: AppLayout.tsx
- decision-mention: none

### ITEM [batch6.md#22]
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: The Add-item draft is per browser (localStorage keyed by document id), not per account — two staff on the same document keep independent drafts; a shared server-side draft is a separate spec.
- quote: "The draft is per browser, not per account. ... it is not a shared server-side draft, and if the owner wants one that is a separate spec."
- kind: blocked-on-owner
- artifacts: AddElementModal.tsx, localStorage
- decision-mention: none

### ITEM [batch6.md#34]
- report: TASK-F3-REPORT.md
- date: (no header date)
- item: F4/F5 tracker rows' stale "no UI" framing corrected to cite the existing staff compose in LessonLogEditor.tsx:104; status left BUILT per instruction.
- quote: "F4/F5 rows' stale 'no UI' framing corrected to cite the existing staff compose in LessonLogEditor.tsx:104 ... only the factual note changed"
- kind: correctness
- artifacts: docs/archive/BUILD_TRACKER.md, LessonLogEditor.tsx
- decision-mention: none

---

### ITEM [batch6.md#35]
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date; branch off origin/main)
- item: The barnops module family (route, files, nav item, mod.barnops module key) was deferred — not renamed this pass because AppLayout.tsx is owned by UIBUILD which is actively committing to it.
- quote: "DEFERRED — the barnops module family ... Not built this pass. AppLayout.tsx is owned by TASK-ONEHEADER's successor, UIBUILD, which is actively committing to it right now"
- kind: blocked-on-owner
- artifacts: AppLayout.tsx, App.tsx, BarnopsHubPage.tsx, api-barnops.ts, mod.barnops, org_modules
- decision-mention: none

### ITEM [batch6.md#37]
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: Open owner question — confirm FHE's term = ranch (used the owner's own sentence as source; flagged to confirm, not assume).
- quote: "Confirm FHE = ranch (used the owner's own sentence as the source; flagging per the task doc's request to confirm, not assume)."
- kind: blocked-on-owner
- artifacts: property_terms, config_values
- decision-mention: none

### ITEM [batch6.md#42]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date; off origin/main 7cfeb6)
- item: Codebase-wide error-shape defect — 78 call sites test e instanceof Error against errors that may be raw PostgREST objects; DbError/errorText exported for adoption but only three owned files were changed.
- quote: "This defect is codebase-wide, not ours alone. 78 call sites test e instanceof Error against errors that may be raw PostgREST objects."
- kind: defect
- artifacts: src/lib/horses.ts, DbError, errorText, postgrest-js
- decision-mention: none

### ITEM [batch6.md#48]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: F7's second bug (reported, not fixed) — standing categories (groups) wiped at account activation; Claire is the only real person hit so far but nine more contacts hold a RIDER row with no account and would lose it on activation.
- quote: "F7's second bug — standing categories wiped at activation. Reported, not fixed. ... Nine contacts hold a RIDER row today with no account yet ... Each one loses it the moment they activate ... unless their documents are executed first."
- kind: data-integrity
- artifacts: groups, derive_affiliations, apply_affiliations, audit_logs
- decision-mention: none

### ITEM [batch6.md#69]
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08 (task doc date; report is later)
- item: B4 (admin nav sections collapsible on mobile) owner-deferred, do not build — deferred until after the admin page-structure/menu-contents refactor (TASK-ADMINSWEEP).
- quote: "Owner-deferred, do not build. ... 'DEFERRED until after the admin page-structure and menu-contents refactor' (TASK-ADMINSWEEP)."
- kind: blocked-on-owner
- artifacts: AppLayout.tsx, admin nav
- decision-mention: none

### ITEM [batch6.md#73]
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08
- item: Could NOT verify the in-app header, nav rail, mobile drawer, hover states and scrim — all behind Supabase auth with no credentials in this worktree; "already shipped" claims rest on source/CSS/reconciliation-doc reads.
- quote: "What I could NOT verify, and did not claim to: the actual in-app header, nav rail, mobile drawer, hover states, and scrim ... not on a live click-through of the authenticated app, and not on a real phone."
- kind: not-verified
- artifacts: AppLayout.tsx, app-header.css
- decision-mention: none

### ITEM [batch6.md#74]
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08
- item: lint warnings drifted to 36 (beyond UI-STATE's ~26 baseline) — none in edited/deleted files; two AppLayout.tsx warnings at :346/:353 are pre-existing.
- quote: "0 errors, 36 warnings (pre-existing drift beyond UI-STATE's 2026-08-09 baseline of ~26 — none of the 38 warning lines are in AppLayout.tsx's edited region"
- kind: process
- artifacts: eslint baseline, AppLayout.tsx
- decision-mention: none

---

### ITEM [batch6.md#85]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: test:db suite broken on main before this change — 55 of 64 files fail in beforeAll setup (duplicate key, products_module_key_fkey); pre-existing and means the suite protects nothing.
- quote: "npm run test:db is broken on main before this change — 55 of 64 files fail in beforeAll setup ... That is pre-existing and unrelated."
- kind: known-issue
- artifacts: test:db
- decision-mention: none

### ITEM [batch6.md#87]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Unrelated incident — six worktrees (main repo + five siblings) were moved to Trash at ~17:09 (likely iCloud sync); restored and verified, but the trigger is unexplained and may recur.
- quote: "the Desktop directory was emptied into ~/Library/Mobile Documents/.Trash ... no command in this session touched those paths. ... the trigger is unexplained and may recur."
- kind: process
- artifacts: worktrees (accountsurface, bp410, onemenu, secfix, tiptap)
- decision-mention: none

### ITEM [batch6.md#88]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Recommended follow-up — fix the test:db setup breakage on main (55/64 files failing means the suite is currently not protecting anything).
- quote: "Fix the test:db setup breakage on main — 55/64 files failing means this suite is currently not protecting anything."
- kind: process
- artifacts: test:db
- decision-mention: none

---

### ITEM [batch7.md#12]
- report: TASK-ACCOUNTSURFACE-REPORT.md
- date: 2026-08-05
- item: Nav-page eyebrow/document-title copy on all five subject pages was changed to match the label table, a scope-reading the author flagged in case it is wrong.
- quote: "Nav-page eyebrow/document-title copy on all five subject pages ... now matches the §4 table exactly ... flagging the reasoning in case that reading is wrong"
- kind: correctness
- artifacts: My Documents/My Lessons/My Posts/My Orders/My Gifts/My Stable pages
- decision-mention: none

### ITEM [batch7.md#42]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #5 — status_events files bookings under entity_type='offering'; checked and deliberate, recorded so a future thread does not "fix" it into a regression.
- quote: "`status_events` files bookings under `entity_type = 'offering'`. Checked, and it is deliberate ... Recorded so a future thread does not "fix" it into a regression."
- kind: correctness
- artifacts: status_events, booking_status_code()
- decision-mention: none

### ITEM [batch7.md#46]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: test:db is broken (60 of 68 files failing) and is not cited as evidence anywhere in the report.
- quote: "`test:db` is broken (60 of 68 files failing) and is not cited as evidence anywhere in this report."
- kind: process
- artifacts: test:db
- decision-mention: none

### ITEM [batch7.md#82]
- report: TASK-I1B-REPORT.md
- date: 2026-08-05
- item: Browser verification pending — visual pinned↔collapsed transition, hover-peek, tooltip readability, and mobile header button spacing not confirmed.
- quote: "Browser verification (visual pinned↔collapsed transition, hover-peek, tooltip readability, mobile header button spacing) — flagged per the task doc's own "browser pending" framing."
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM [batch7.md#114]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Correction — the task doc's stated cause (migration growth exceeding the 10s beforeAll timeout) is wrong; createTestDb loads a snapshot and does not replay migrations. Real cause is PGlite contention on a memory-starved box.
- quote: "The task doc's stated cause is wrong ... It does not replay migrations at all ... The actual cause is contention."
- kind: correctness
- artifacts: createTestDb(), vitest.config.ts, test/db/fixtures/schema_snapshot.sql
- decision-mention: none

### ITEM [batch7.md#115]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: The snapshot fixture contains zero setval statements, so display-code sequences load at start value while seeded rows already hold consumed codes; 21 files died on organizations_display_code_key. Fixed via alignDisplayCodeSequences.
- quote: "The snapshot contains zero `setval` statements ... 21 files dying on `duplicate key value violates unique constraint "organizations_display_code_key"`."
- kind: defect
- artifacts: schema_snapshot.sql, harness.ts, alignDisplayCodeSequences()
- decision-mention: none

### ITEM [batch7.md#121]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Blocked — 8 files still die in beforeAll on a retired setup helper (provision_lesson_invitation / engagements) while their subjects are live; not deletable without losing coverage, not mechanically fixable, needs a decision.
- quote: "8 files still die in `beforeAll` on a retired setup helper while their actual subject is live ... Why I stopped rather than rewriting them"
- kind: blocked-on-owner
- artifacts: provision_lesson_invitation, provision_client_invitation, engagements, create_purchase_engagement
- decision-mention: none

### ITEM [batch8.md#1]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: REQ-25 (documents-page management functions — filters, sorting, multi-select/delete, "send" wording, void status filter) was never started.
- quote: "REQ-25 (documents page) — no filters, no sorting, no multi-select/delete, 'create' still used where 'send' is meant, `void` missing from the status filter. Untouched."
- kind: blocked-on-owner
- artifacts: Documents page
- decision-mention: none

### ITEM [batch8.md#15]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: PGlite suites cover only 13 tests; the other ~54 test/db test files remain unrun (pre-existing condition).
- quote: "**PGlite suites cover 13 tests**; the other ~54 `test/db/*.test.ts` files remain unrun (pre-existing condition)."
- kind: known issue
- artifacts: test/db/*.test.ts
- decision-mention: none

### ITEM [batch8.md#21]
- report: TASK-A13-REPORT.md
- date: 2026-08-04
- item: The CalendarPage lesson-horse picker is code-complete but never visually confirmed in a browser; tracker marked PARTIAL, not DONE.
- quote: "The `CalendarPage.tsx` picker change is code-complete and typecheck-clean but has not been visually confirmed in a browser. `docs/archive/BUILD_TRACKER.md` A13 is marked **PARTIAL — server-verified, browser pending**"
- kind: not-verified
- artifacts: src/pages/app/CalendarPage.tsx, docs/archive/BUILD_TRACKER.md
- decision-mention: none

### ITEM [batch8.md#22]
- report: TASK-A13-REPORT.md
- date: 2026-08-04
- item: Pre-existing data noise on Beau — duplicate LESSEE horse_relationships rows for contact d5088607 with a dangling source_document_id — was deliberately left uncleaned, and that contact would incorrectly pass caller_may_use_horse.
- quote: "that one *does* carry an active `LESSEE` `horse_relationships` row on Beau and would incorrectly pass — deliberately avoided as the negative case"
- kind: data-integrity
- artifacts: horse_relationships, caller_may_use_horse, contact d5088607
- decision-mention: none

### ITEM [batch8.md#29]
- report: TASK-DASHLEADS-REPORT.md
- date: 2026-08-11
- item: Correction to the task doc — the page it names as "Dashboard" (InstructorHome.tsx) is dead code from the owner's perspective; the load-bearing fix had to go in DashboardPanel.tsx instead.
- quote: "So the page the task doc names is currently dead code from the owner's perspective — he cannot click to it. Building leads into it alone would not have satisfied 'the owner opens the dashboard and sees leads.'"
- kind: correction
- artifacts: src/pages/app/InstructorHome.tsx, src/components/app/DashboardPanel.tsx
- decision-mention: none

### ITEM [batch8.md#53]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: UIO-006's open-state fill question remains open — the caret rotates but the avatar fill ramp was left untouched for the owner to see rendered.
- quote: "**UIO-006's open-state question is still open.** The caret rotates; the fill ramp is untouched, exactly as that file asks."
- kind: blocked-on-owner
- artifacts: docs/ui-orders/UIO-006, src/components/app/AppHeader.tsx
- decision-mention: none

### ITEM [batch8.md#59]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: The one-time "Click for menu" tip uses localStorage (per-device) rather than a server column; if it should survive a cleared browser the swap is markTourSeen's shape plus one column — a DB change outside this task.
- quote: "**If you want it to survive a cleared browser, the swap is `markTourSeen`'s shape and one column.**"
- kind: caveat
- artifacts: src/components/app/AppHeader.tsx, localStorage navMenuTip.seen, profiles.tour_seen_mobile_at
- decision-mention: none

### ITEM [batch8.md#60]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: UIO-016 is superseded on exactly two points (row px-3 and mobile-drawer prohibitions overridden) — recorded so a later thread does not revert the asymmetric inset citing that order.
- quote: "**Recorded here so a later thread does not revert this citing that order:**"
- kind: process
- artifacts: docs/ui-orders/UIO-016-nav-row-indent.md, AppLayout.tsx
- decision-mention: none

### ITEM [batch8.md#74]
- report: TASK-PAGEFRAME-REPORT.md
- date: 2026-08-11
- item: Correction — the task's stated lint baseline of 30 was stale; a clean origin/main worktree already shows 36 warnings (drift from ONEAUTHOR/DOCQUEUE/UPLOADS merges).
- quote: "The task's stated baseline was 30; I built a throwaway worktree of clean `origin/main` (pre-pageframe) to check, and 36 is already the baseline there"
- kind: correction
- artifacts: lint baseline
- decision-mention: none

### ITEM [batch8.md#80]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: purge_account does not know about files, so purging a member leaves their files with a dangling owner_contact_id — needs an owner ruling on where a departing member's files go.
- quote: "`purge_account` does not know about `files`, so purging a member today leaves their files with a dangling `owner_contact_id`. **Needs a ruling**"
- kind: blocked-on-owner
- artifacts: purge_account, files
- decision-mention: none

### ITEM [batch8.md#85]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Staff have no personal Files surface — My Files sits inside the !isStaff block per the 2026-08-08 owner ruling; flagged in case it reads as a gap.
- quote: "**Staff have no personal Files surface.** ... That matches the ruling; flagging in case it reads as a gap."
- kind: caveat
- artifacts: src/components/app/FilesContent.tsx, Account page
- decision-mention: none

### ITEM [batch8.md#88]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Correction — two task-doc claims were inaccurate: ContentStorePage IS in the nav (AppLayout.tsx:324), and it is the content_blocks editor, not the content_resources editor.
- quote: "**'`ContentStorePage` … is not in the nav.'** It is — [AppLayout.tsx:324] ... **`ContentStorePage` is not the `content_resources` editor.** It edits `content_blocks`"
- kind: correction
- artifacts: ContentStorePage, AppLayout.tsx, content_blocks, content_resources
- decision-mention: none

### ITEM [batch8.md#90]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: The lessons surface's subject grain (package vs session vs credit) is genuinely unclear and must be picked before any file_links rows are written — repointing later is a data migration.
- quote: "The subject grain is genuinely unclear: a lesson *package*, a *session*, or a *credit*. Pick one before writing rows — repointing them later is a data migration."
- kind: blocked-on-owner
- artifacts: file_links (subject_type lesson), lesson_credits, fulfillment_units
- decision-mention: none

### ITEM [batch8.md#91]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: File ownership for leads needs an owner ruling — a lead is a contacts row with no account, so a file owned by that contact is readable by nobody as "theirs".
- quote: "Owner is either the org or the contact-without-account — **needs an owner ruling**; the schema allows `owner_contact_id` on a contact with no profile, but nobody can then read it as 'theirs'."
- kind: blocked-on-owner
- artifacts: file_links (subject_type lead), contacts, files.owner_contact_id
- decision-mention: none

### ITEM [batch8.md#92]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Directory-card files are almost certainly org-owned (e.g. a farrier's insurance certificate the stable holds) — confirm before building.
- quote: "Files here are almost certainly org-owned (a farrier's insurance certificate the *stable* holds). Confirm before building."
- kind: blocked-on-owner
- artifacts: vendors, DirectoryPage
- decision-mention: none

### ITEM [batch8.md#93]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: The Community → Resources card has no download control, so members still cannot open a published company guide from the UI — the smallest remaining item and the one completing the company-files loop.
- quote: "the card has **no download control**. Members cannot yet open a published company guide from the UI. Smallest item on this list and the one that completes the company-files loop."
- kind: not-built
- artifacts: src/lib/communityFeed.ts:211, resourceDownloadUrl, content_resources
- decision-mention: none

### ITEM [batch8.md#94]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: The rest of npm run test:db fails identically on origin/main — the PGlite snapshot references the retired engagements table and a service-catalog label drifted; pre-existing and untouched.
- quote: "The rest of `npm run test:db` fails **identically on `origin/main`** — the snapshot references the retired `engagements` table and a service-catalog label has drifted. Pre-existing, unrelated, and not touched here."
- kind: known issue
- artifacts: test/db, test/db/fixtures/schema_snapshot.sql, engagements
- decision-mention: none

### ITEM [batch8.md#95]
- report: TASK-UPLOADS-REPORT.md
- date: 2026-08-11
- item: Correction — CLAUDE.md's "~26 pre-existing warnings" note is stale; origin/main's actual lint baseline is 36.
- quote: "lint **0 errors, 36 warnings — identical to `origin/main`'s 36**, so this branch adds none (CLAUDE.md's '~26 pre-existing warnings' is stale)"
- kind: correction
- artifacts: CLAUDE.md
- decision-mention: none

### ITEM [batch8.md#100]
- report: TASK-WALLRETURN-REPORT.md
- date: 2026-08-07
- item: Aside, not fixed — the PGlite snapshot's SNAPSHOT_DATA_TABLES allowlist doesn't seed status_events_vocab or document_status, so any fresh test creating a documents row hits two FK violations; worked around locally, not fixed at the shared-fixture source.
- quote: "the PGlite snapshot's data allowlist (`SNAPSHOT_DATA_TABLES` in `harness.ts`) doesn't seed `status_events_vocab` or `document_status` ... worked around inside `wallreturn_wall_state.test.ts`'s own `beforeAll`, not touched at the shared-fixture source."
- kind: known issue
- artifacts: test/db/harness.ts (SNAPSHOT_DATA_TABLES), status_events_vocab, document_status
- decision-mention: none
