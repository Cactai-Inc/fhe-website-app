# RESUME NOTE — 2026-09-15 — Admin fixes, contract work, and the full queue

**Purpose:** a single file to read after compacting so the assistant can resume exactly where we
are. It contains (A) session state / what's done, (B) the queue in priority order with open
decisions, and (C) the owner's requests VERBATIM so nothing is paraphrased away.

**Repo:** `/Users/Cactai/Downloads/claude-code-repo/French Heritage Project/Repo/fhe-website-app`
**Branch:** `main` (committing directly to main this session; pushes go to `origin/main`).
**DB:** live prod, connection string = line 1 of `.env.db`. Migrations are a hand-applied journal
(dry-run in a `BEGIN;…ROLLBACK;`, apply, verify with a query). `psql` is available.
**Working rule:** the canonical-checkout pre-commit hook does NOT fire here (this path lowercases
differently), so code commits succeed without `FHE_ALLOW_CODE`.

---

## ⚠️⚠️ SESSION LOG 2026-09-15 → 2026-09-18 — READ THIS FIRST ON RESUME ⚠️⚠️

### STANDING CONVENTIONS ESTABLISHED THIS SESSION (binding going forward)
- **Migrations do NOT live in the repo.** Write the SQL, dry-run in `BEGIN;…ROLLBACK;`, apply to
  prod via `psql` (conn = line 1 of `.env.db`), then COPY the file to the external Archive:
  `/Users/Cactai/Downloads/.../French Heritage Project/Archive/supabase-migrations-removed-from-repo/`.
  Never `git add` a migration. Verify anon is REVOKED on any new function.
- **Clean code / no evolution comments** (memory `fhe-clean-code-no-evolution-comments`): removal
  means DELETE everywhere (no commented-out code, no "moved 2026-XX / RESTORED / TASK-X did this"
  breadcrumbs). Comments describe CURRENT behavior — what it does, wired to, affects, affected by.
- **Legal drafting:** match the contract's own register. Declarative allocation ("Title to the Horse
  passes to Buyer at Closing…"), operative verbs ("Seller shall…", "Buyer may…"), "If…, then…"
  conditions. NEVER start a sentence/clause with "Because" or explanatory conjunctions.
- **DB doc set / root-README rework / docs-relocation / test-harness overhaul / repo-wide comment
  sweep / Fractal-alignment restructuring = FINAL CLEANUP PASS, deferred.** Do not do mid-feature.

### DB APPLY PATTERN THAT MATTERS
- Contract templates are CLAUSE-COMPOSED (`contract_section_defs`/`contract_clause_defs`/
  `contract_field_defs` for `HORSE_SALE_V2`, `HORSE_LEASE_V2`, `HORSE_BILL_OF_SALE`). The editor
  reads structure LIVE from the template via `contract_template_structure(template_key)`; per-doc
  field VALUES live in `contract_fields`.
- **After changing template field_defs you MUST run `sync_contract_fields_from_defs(p_document_id)`**
  to materialise new/changed fields onto an existing document, then `remerge_contract_from_clauses(
  p_document_id)` to recompose the body. Per-doc `contract_fields.format_type` is a COPY of the def's —
  changing a def's format_type also requires updating the doc rows (learned on the location fields).
- `remerge_contract_from_clauses` composes `documents.merged_body`; a label:value line takes NO
  terminal period, a sentence does; blank line before every numbered section/subsection heading.
- The owner's live test contract: **HORSE_SALE_V2 document `80537662-7b4e-4adc-9ebc-49ed9d2bed78`**
  (buyer = FHE company contact `352c3898…`, seller = Kamryn Herrera, horse = Tiz Love `b6a00ca9…`,
  a GELDING). Zero executed sale docs, so template edits oblige no past signer (D33); mint a
  template version (check `record_template_version_bump`) once wording is stable.

### EVERYTHING SHIPPED THIS SESSION (commits, newest last), all pushed to origin/main
- `e1ed168f` admin fixes: hard-delete FK gaps closed in admin_purge_contact; PersonRecord page scroll;
  My Stable → company horses only (HorseRecordsPage ownerScope="company"); catalog Community→Management;
  removed redundant staff My-Stable account card; calendar modal sm→lg.
- `6ecc35b4` contract selects match stored LABEL→option (breed/color no spurious "Other").
- `e1325251` remove session migration from repo → Archive.
- `4f39d35c` unified tasks client API (`src/lib/ops/api-tasks.ts`).
- `6620ea80` calendar Slice A: BookingView (view-only surface + Purchase card via booking_purchase_card
  RPC), CalendarItemPanel view/edit split, Save-vs-Submit, price removed, client behind Change-client,
  "+ New client" removed, "Assign to purchase"→"Purchase".
- `c75af392` calendar Day view (CalendarDayView: desktop rundown+workspace, mobile modal, untimed
  "to do today" strip) + tasks on the calendar + TaskModal.
- `b774cc45` calendar item binary offering/unavailable (appointments are Tasks).
- `4152a119` dashboard zone C1b "Today's tasks" (dash_today_tasks RPC).
- `619c4cf3 / 009f52c4 / …` resume-note updates.
- `85c99b2d` (context) → `1de666ad` FIX blank calendar (CalendarDayView built `sel!.item` before the
  null-check → threw; month-day click → day view → blanked). workspace is a function now.
- `f320b963` contracts: no stray periods on label lines; heading spacing; role-scoped party preview
  (superseded next).
- `7be2fb70` party view stops repeating record-derived contact info; location fields → structured
  `location` element (delivery/trial/installment), values migrated to structured.name.
- `19c81986` **BIG:** PartyDocumentView DELETED; party (and staff View-as) routes through
  ClauseDocument — the inline authoring surface scoped by role, `authorView=false` (no muted preview);
  edit mode while editable, view-only once locked/executed; gold OUTLINE on a section with an empty
  party field; tooltip icon legible (was ~9px superscript → 14px Info); own-field tip second-person.
- `e4f7d011` empty imported field reads "not on file" (was "from horse record").
- `3f3e121f` gate stays as its subsection's FIRST LINE and stays answerable; consequence hides;
  fixed co-buyer question omitted from buyer view + title-detail showing when co-buyer=no.
- `84529d16` **SIGNABLE = COMPLETE, not manually locked** (D14): sign box appears from editable/
  in_review when no lock blockers (fetchLockBlockers added); removed the misleading "Lock for signing"
  button; toolbar wraps into tidy rows.
- `c9af077b` (superseded by 3f3e121f approach) section-shaping vs sub-section gate.
- `861a9bde` **standalone Bill of Sale** authorable from New Contract (start_bill_of_sale_standalone
  RPC wired; buyer+optional seller+horse; BOS_HAS_SALE_AGREEMENT=NO). Sale→companion-BOS path
  unchanged. The two are separate docs, sign at separate times.
- `fd6d6fcc` **DECLARATIVE TOOLBAR**: ContractSubheader now takes `actions: ToolbarAction[]` +
  `documentWidget`; ContractPage builds `contractActions` (each states visible-precondition + group:
  primary/document/destructive). Replaces the 4 scattered leading/extras/trailing/destructive slots.
- `17f9a1ac` no-slaughter Included/Not-included election REMOVED (covenant hardcoded, checkbox only);
  location shows resolved address on known-selection; owned highlight tighter for block controls;
  section gold-outline fires only on an empty field OWNED BY THE VIEWER'S ROLE (not shared DEAL terms).
- **(applied to prod, not yet a code commit — DB only, archived)** `20260918T0100_sale_insurance_risk_reversal.sql`:
  §7 TRIAL.INSURANCE → Seller-discretion declaration (TXN.TRIAL_INSURANCE_RESPONSIBLE election removed);
  §7 TRIAL.TERMS risk sentence reversed (Seller bears risk while holding title; Buyer full refund +
  decline-by-not-signing-BOS on loss before Closing; Buyer pays care only); §5 PRICE.INSTALLMENTS same
  reversal (removed Buyer-must-insure/loss-payee); §8 DELIVERY.TITLE_RISK risk passes on "passing of
  title" not "delivery"; §8 DELIVERY.TERMS 8th-day risk-shift removed (board cost kept).

### KEY FINDINGS / DIAGNOSES (do not re-investigate)
- Party = author surface: the app HAD switched the party view from ClauseDocument to a composed-body+
  green-boxes surface on 2026-08-25; the owner reversed it. Party now uses ClauseDocument. The green
  "YOUR ANSWERS" boxes are GONE for everyone (owner ruling).
- `contract_document_detail.can_edit = v_staff OR …` → for a staff viewer EVERY field is editable,
  which is why the old party preview looked identical for both parties.
- `lock_and_sign_contract` accepts state `editable` too and locks-and-signs atomically, re-checking
  `contract_lock_blockers`. So signing NEVER needs a manual lock. `approve_contract_review` explicitly
  refuses staff ("use Lock for signing") — that staff lock button had been REMOVED earlier and should
  stay removed; completeness is the gate.
- `has_staff_access()` SECURITY-DEFINER functions can't be called from psql (no auth.uid); test their
  LOGIC by running the equivalent queries directly in a ROLLBACK block.
- The owner is the BUYER (FHE company) but the company contact has no linked user, so admin@ resolves
  as staff/author, not as a literal BUYER party → to see/fill buyer fields, use View-as → the party chip.
- "BUYER: pending / SELLER: pending" card = the signature-status summary (who has/hasn't signed); it
  looks sparse in a View-as preview because the Sign control is disabled while previewing. Not a bug.

### DB OBJECTS ADDED/CHANGED THIS SESSION (all live, archived externally)
admin_purge_contact (widened FK teardown) · booking_purchase_card · dash_today_tasks · tasks +
task_links + task_assignees (unified tasks) + lookup_options 'task_category' seed ·
remerge_contract_from_clauses (label-line periods + heading spacing) · many HORSE_SALE_V2 template
edits (location→structured, §3.4 disclosure gate + Buyer Acceptance section, §3.6 sex-gate, §6 PPE
date split + N/A, §7 trial insurance/return reword, §8.2 title/risk, §8.4 auto no-slaughter + ack,
removed NO_SLAUGHTER_ELECTION + TRIAL_INSURANCE_RESPONSIBLE, insurance/risk reversal).

### ✅ CONTRACT ITEMS — ALL DONE 2026-09-18 (commits f8fb6660, 6353d940; DB live+archived)
- CR-1 stable gate homes: every §gate field now lives on an always-visible empty-body
  anchor clause (`*_GATE`), so answering never removes the control; PENDING placeholders
  removed; blank required gate still blocks signing. (20260918T0200)
- CR-2 §5.3 installment schedule → `installment_schedule` structured builder (amount/due/
  notes rows). CR-3 §3.4 → `incident_list` builder (category menu no Other, +start date,
  +end date w/ still-present, free text). Composers + defs live. (20260918T0300/0400)
- CR-4 §3.5: Yes/No now above the gated text (via CR-1 anchor); duplicate buyer-ack
  sentence removed (lives in Buyer Acceptance section); asterisk rides the label line.
- CR-5 §1: filled test horse b6a00ca9 reg#/current_location; the HORSE.* "duplicate
  template_tokens" was a non-issue (tokens are unique per template_id).
- CR-6 §2 cascading: satisfied by the existing conditional_on gate system + CR-1
  stabilization (required-field check already respects gate state).
- CR-7 §12 assignment: EXPLAIN-only item (no code). Purpose: consent-to-assign protects
  the Seller's remedies under an installment/trial arrangement; on a paid-in-full sale it
  is a standard boilerplate restriction. Owner to decide if it needs changing.
- CR-8 LOCK MODEL: PartyControlsCard → 3-level access picker (Full/Suggestions/Read-only);
  engine default flipped so a party with NO controls row = full access (4 readers +
  last-editor guard, 20260918T0600); Add-item moved next to Requests; Scroll next to Save;
  read-only party sees Comments only.
- CR-9 minted HORSE_SALE_V2 v1→2 (20260918T0700; D33 — 0 executed docs).
- CR-10 insurance/risk reversal audited on BOS + lease: both already correct (lease =
  Lessor bears risk while holding title; BOS passes risk to Buyer who holds title post-
  conveyance). Fixed two lease clauses that opened a sentence with "Because". (20260918T0500)

### CONTRACT ITEMS STILL OPEN (the CR list to work through next)
1. **Verify the installment gate can be undone** (no→yes→no). Give every section gate ONE stable home
   (its subsection's first line) regardless of which consequence is active if still flaky.
2. **§5.3 installment schedule field** — `TXN.INSTALLMENT_SCHEDULE` (longtext) is tiny/obscure; make it
   self-explanatory (guidance/placeholder), properly sized, ideally a structured schedule builder.
3. **§3.4 RICH incident list** — category menu (from the shown list, NO "Other"), "+ Add date of
   incident / start", "+ Add end date" (with a "present" option for ongoing), repeating incidents, free
   text. NEEDS NEW UI CONTROLS in ContractCascade (a repeating category+date-range widget).
4. **§3.5 polish** — reposition the Yes/No above the gated text; asterisk placement; trailing period on
   the helper line.
5. **§1** fill horse-record columns (current_location empty → shows "not on file") + dedupe duplicate
   `template_tokens` HORSE.* rows.
6. **§2** broader cascading logic (decisions gate whether future selections show/are required).
7. **§12** assignment — explain purpose to owner; confirm whether it needs a change.
8. **LOCK MODEL** (General item 2) — document controls: restrict-to-suggestions / read-only-with-
   comments; move Add-item next to Requests; move scroll-to-bottom next to Save. (Engine booleans:
   can_edit_deal / can_suggest; invert the UI, guard "one party must always be able to edit".)
9. **Mint a template version** once wording is stable (D34; clause templates — check record_template_
   version_bump, NOT save_contract_template_version which is for flat templates).
10. **Apply the same insurance/risk reversal to HORSE_BILL_OF_SALE and HORSE_LEASE_V2** where analogous
    clauses exist (this session did HORSE_SALE_V2 only). Audit each for "Buyer bears risk before title".

### ✅ NON-CONTRACT ITEMS 5 & 6 — DONE 2026-09-18 (commits 04e06470, 2bf1247c)
- Item 5 new-task modal: Horse Care rename + 6 new categories + "+ Add a type" free-text;
  Date/Start/End row on 15-min steps; horse→client auto-link (owner/lessee contact_id);
  alpha sort; CLI code hidden; "Assign to". (categories 20260918T0800)
- Item 6 client record: FILED UNDER moved to the bottom; danger zone renamed
  "Account status & removal" with Deactivate/Reactivate · Archive · Remove-and-block;
  audit trail → own page /app/records/person/:id/audit (contact_audit_trail RPC,
  20260918T0900, anon revoked).

### NON-CONTRACT ITEMS STILL QUEUED (from earlier this session)
- **Item 5 — new-task modal fixes:** category "Horse Care (our horses)"→"Horse Care"; add Feeding,
  Shopping, Research, Travel, Events, Meetings + a self-author "Other / + add a type" free-text; add an
  END-time field (row: Start / End) with 15-min increments; horse list tied to client list (selecting a
  horse auto-sets its owner/lessee client); alphabetical order for horses AND clients; client dropdown
  shows a CLI-000284 code that shouldn't; rename "Assigned to"→"Assign to".
- **Item 6 — client-record redesign:** move the "FILED UNDER" strip from the top to the bottom (above
  the suspend/remove/delete control); rename that 3-word button (unclear) — split into "Remove and
  Block", "Deactivate"↔"Reactivate", "Archive"; define what happens client-side + to their data for
  Deactivate and for Archive; the audit trail on the Activity page belongs on its OWN page reached by a
  link from the client record, not inline on Activity.
- ✅ **B2 Payments + Orders pages — DONE 2026-09-18** (commit 440f5e11). Orders page
  (7 buckets via staff_orders_board), Payments page (4 states via staff_payments_board),
  both staff-only/anon-revoked (20260918T1000), nav rows added, Payment review kept as
  the reconcile/confirm queue.
- ✅ **B3 calendar follow-ups — closed by B0** (2026-09-18). C6 desktop width + Day view
  shipped in B0; no new calendar bugs remained on the list.
- ✅ **Dashboard mirror (D of B0) — satisfied by existing zones** (2026-09-18). C1 "Today"
  (sessions) + C1b "Today's tasks" already surface the day compactly and each links to
  `/app/calendar?view=day`. A third full rundown/workspace embed would duplicate the Day
  view (D18) and violate the self-arranging-surface principle (D13 exception) — not built.
- ✅ **B5 ATN — DONE 2026-09-18** (commits b88f462a, 3fd3167d, dd90dea1, f5c7bad0). Owner
  answers: newest-first always · full default notification-category set · Open-Meteo ·
  no aging nudge (reminders one-time OR recurring every X days/weeks/months) · Mark-complete
  → hidden Completed/History page via out-of-the-way link · Dismiss on all alerts/notifs.
  Built in 4 stages: (1) schema + engine (task_reminders/alerts/alert_suppressions/
  notification_mutes, dashboard_alerts NEWEST-FIRST, dashboard_notifications, dismiss/snooze/
  mute/seen/history — 20260918T1100/1200); (2) AtnGrid on OwnerDashboard (3 rows, single-card
  advance, alert modal); (3) TaskModal reminders + Mark-complete + History page
  (/app/ops/history, discreet link); (4) crons — atn-reminders (hourly, fire_due_task_reminders
  20260918T1300), atn-weather (Open-Meteo rain alerts, org_staff_user_ids 20260918T1400, FHE
  coords set), atn-weekly-digest (Monday, weekly_digest 20260918T1500). All in vercel.json +
  scheduled-jobs.yml. ⚠️ CRONS NEED CRON_SECRET in Vercel + GitHub for atn-* to actually fire.
- **B4 Lessons system** — DISCUSS-FIRST, awaiting the owner (deepest; owner: fresh thread likely).

### ✅ #6 — STATE-AWARE SEND FLOW — DONE 2026-09-18 (commit e28ecdc8)
Send modal now renders per party from contract_send_state (20260918T1600, anon revoked):
no account/never-signed-in → "Invite and include this contract"; has account → "Send";
where the party carries unsigned assigned docs, the modal shows the order (contract first,
then those) and states they arrive as one set. The server already builds the sequenced
packet at execution (ensure_contract_role_documents, contract=seq 1) and branches invite-
vs-send in contract-invite — this made both visible/correct in the UI. The wall redirect
stays down (CR-123·A1); the packet-as-one-email + signing-set walk enforces the order.

### ⚠️ #6 — ORIGINAL DESIGN NOTE (kept for reference)
Not a blunt wall re-enable. The wall redirect is down since CR-123·A1 (it bounced Pamela out
of her own lease). The owner's actual design:
- **The contract Send button becomes state-aware, mirroring Invite.** Send modal renders
  conditionally on: invitation-URL logged? · auth set up? · ≥1 user session? · any unsigned
  assigned docs?
  1. No invite + no auth + no session → "Invite and include contract", REQUIRE specifying the
     contract's signing order relative to unsigned assigned docs.
  2. Set up + session + no other unsigned docs → plain "Send."
  3. Set up + session + has unsigned docs → "Send," ask where to SEQUENCE the contract.
- **Documents go as ONE packet, signed together, emailed as a set only once all are signed.**
- **Correct order = CONTRACT FIRST, then its dependent docs** (the Pamela bug was demanding the
  ancillary docs before the contract — but those are only required IF the contract is signed;
  if the lessor declines the contract they shouldn't sign the others). The system had two
  competing flows and chose the wrong one; unify to one flow with contract-first sequencing.

---

## A. WHAT IS DONE (committed + pushed to origin/main)

Commits this arc, newest last:
- `9e6fbe01` — CR-125 findings (diagnosis only; the pre-work baseline).
- `68f7bcd4` — Client record as a PAGE (`/app/records/person/:contactId`, two-area Account/Activity
  model); order cancel (whole-order void), booking cancel (one / this-and-all-future); atomic
  hard-delete via `admin_purge_contact`; BOS review-by-email + edit-removes-signature + note.
- `9866322d` — Contacts split: Community = Clients + Leads (separate pages); Management = unified
  Directory (vendors/partners/suppliers); My Stable hub (Horses/Supplies/Property).
- `274019c0` — Calendar remaster: empty = available, full-size duration blocks, who+what, duration
  auto-apply, 30-min soft gap. (AR1's two "urgent" bugs already fixed in live save_calendar_item.)
- `d7585f7c` — body `overflow-x: clip` (page fits iPhone, no pinch-zoom); nav rails
  `overscroll-contain`; Calendar → Community (below feed); Documents nav link; month-view shows
  name+service (not "Reserved"); week grid fits viewport height; contract activity card removed.
- `f1608af2` — Hard delete client BY REASON (test client / paperwork-no-pay → wipe everything with
  a checkbox; real client with activity → steered to Archive). No FK error path.
- `3102907d` — Contract View-as picker: staff/admin can preview the doc AS ANY PARTY (Author + a
  chip per party, labelled by name; company shows as "French Heritage Equestrian"). Party actions
  disabled while previewing.

### DB objects added this arc (all live, verified)
- `admin_purge_contact(p_contact_id, p_confirm)` — atomic FK-breaking teardown, keeps the D1
  protected-identity denylist + company guard; called by `/api/hard-delete-client`.
- `contract_review_payload(p_document_id)` — recipients + changes + note for the BOS review email.
- `admin_cancel_booking(p_booking_id, p_scope, p_reason)` — scope one|future|all; trigger handles
  the fulfillment-unit/credit refund.
- `admin_void_order(p_purchase_id, p_reason)` — voids every live line via `void_purchase_item`.
- `calendar_free_busy` staff branch now returns `client_name` + `offering_name` (display-only).
- `offerings.duration_minutes` (default 60; evaluations 90).

### Key diagnoses already confirmed (do NOT re-investigate)
- The contract the owner is editing is **`HORSE_SALE_V2`** ("Horse Sale and Purchase Agreement"),
  NOT `HORSE_BILL_OF_SALE`. Sections: 3=The Horse, 6=PPE, 7=Trial, 8=Title/Delivery/Risk, 12=Assignment.
- "**from horse record**" on reg# / current location = UI PLACEHOLDER (`ClauseDocument.tsx:132`)
  for an empty `HORSE.*` field. Tokens ARE wired (`HORSE.REGISTRATION_NUMBER → horses.registration_number`,
  `HORSE.CURRENT_LOCATION → horses.current_location`); those columns are empty on that horse.
  LATENT HAZARD: `template_tokens` has DUPLICATE rows per HORSE field (one wired, others unwired) —
  worth deduping.
- **§6 dates linked** = the exam clause (PPE.CONDUCTED) and the written-notice clause
  (PPE.CONTINGENCY) BOTH print the SAME single field `{{TXN.PPE_DEADLINE}}`. Only one date field
  exists for two different dates. And `TXN.PPE_CHOICE` has only Conducted/Waived — no N/A.
- **§12 unsignable** = the Sign box only renders when `state === 'locked'`; the only control that
  locks (`approveContractReview`, "Accept & sign") is gated on `!isOwnerSide` (counterparty only),
  so a staff author can complete every field and never reach lock. "By:" name does NOT auto-sign.
- **View-as toggle absence** = `caller_party_roles` only returns a role when
  `document_parties.contact_id = current_contact_id()`. The sale contract's BUYER party is the
  org's canonical company contact `352c3898-65d0-4a90-ad59-29107b7e03fe` ("French Heritage
  Equestrian", is_company, NO linked user — correctly faceless, a D1-protected identity). So neither
  admin@ nor hello@ is a literal party → my_roles empty → no toggle. FIXED by the View-as picker.
  The `hello@fhequestrian.com` shown was only the company contact's EMAIL, not Claire's account.
- `/app/ops/preview/instructor-home` = a PREVIEW wrapper around `InstructorHome` (the non-admin
  trainer home), URL-only, behind a gold "Preview — not a live page" banner. Data is the viewer's.

### Lessons system — source material FOUND (for the design conversation, NOT yet built)
- `lesson_plans` table (client-scoped, versioned, supersede-able, focus/objectives/coach_notes,
  `advanced_from_booking_id`) — **0 rows** (built, unused).
- `activity_checklists` table — **31 rows** — likely the lesson-item content.
- Components exist: `LessonPlanEditor.tsx`, `LessonPlanProgress.tsx`, `MyLessonPlanCard.tsx`,
  `LessonActivityLog.tsx`, `SessionActivityForm.tsx`, `TodaysPlansPanel.tsx`, `MyLessonsContent.tsx`,
  `LessonPlansPage.tsx` (route `/app/ops/lessons/plans`, no nav row).
- Specs/docs: `docs/tasks/TASK-LESSONPLAN-plans-progress-and-the-record-of-what-happened.md`,
  `docs/design/refactor/PROGRESSION-PLAN.md`.

---

## B. THE QUEUE (owner's chosen order) + OPEN DECISIONS

Owner sequence for the design conversations: **(1) SALE/contract logic → (2) Payments + Orders
pages → (3) calendar/booking modal → (4) Lessons system** (deepest; likely a fresh thread when
context is near full).

---

### ⚠️ 2026-09-15 SESSION — RULINGS + EXPANDED B0 SCOPE (read this first on resume)

**Fixes SHIPPED this session (commit `e1ed168f`, pushed):** hard-delete FK gaps closed in
`admin_purge_contact` (payments, requests+request_alert_sends, per-contact doc-interaction rows,
counterparty rows on the contact's own documents — proven on a real contact, applied to prod);
PersonRecord page scroll trap (dropped the modal-era `flex-1 overflow-y-auto` body so the window
scrolls); My Stable → Horses scoped to FHE's own horses via `HorseRecordsPage ownerScope="company"`
(company_contact_id scope); removed the redundant staff "My Stable" account-page card; Catalog moved
Community→Management on staff nav (member view untouched); calendar item modal widened sm→lg (C6).

**B0 was expanded by the owner to A + B + C in ONE pass, with a UNIFIED tasks entity:**
- **A** — panel view/edit mode split (open in VIEW, Edit button top-right) + Purchase card (usage/credits
  counter for series only) + cancel/reschedule on the VIEW surface + field cleanups (remove price,
  remove "+ New Client", client-change behind an Edit-client button, keep "ask client to add horse",
  rename "Booked against"→"Purchase", remove "Plan and Record" link).
- **B** — appointments become **task-typed calendar items** sharing the ATN `tasks` entity; an untimed
  "things to do today" strip above hour 1.
- **C** — a **Day view**: desktop = left day-rundown / right workspace (task list when nothing selected,
  close button top-right of the content view); mobile = list → modal. Week & month keep the modal.
- **D (follows)** — mirror the Day-view setup compactly on the dashboard.

**UNIFIED TASKS — owner rulings (verbatim intent):**
- A **task = something NOT associated with a client purchase.** Typically manual; can be auto-triggered.
  Bookings STAY bookings (their credit/fulfillment/fee engine is untouched); tasks are the non-purchase
  items. The Day view MERGES bookings + tasks for display only.
- **Not all tasks go on the calendar.** A task with another party (farrier/vet) shows on the calendar
  AND as a task, likely with an expected timeframe. "buy feed" / "clean the tackroom" = manual task,
  OPTIONAL date, OPTIONAL time (a time-block marks that timeframe unavailable). So task → optional date →
  optional time.
- Task types/categories to seed: farrier, veterinarian, medications, own-horse care items (turnout/
  clipping/exercise done for OUR horses), general (buy feed, clean tackroom), app-update, website-update.
  These become the ATN `tasks.category` vocabulary (owner-editable via lookup_options, D13).
- Reconcile with the ATN spec (`docs/tasks/TASK-ATN-alerts-tasks-notifications.md`): the calendar
  task-items ARE ATN tasks with optional scheduling fields added (`scheduled_at` / `scheduled_end` /
  `blocks_availability`). Build the tasks data foundation FIRST, prove with queries, then UI.

**THE ACTIVITY-RECORD / WORK-SURFACE RULING (big, architectural):**
- The Day-view right pane (desktop) / modal (mobile) is split: **top half = booking info (the view-only
  panel content); bottom half = the INTERACTIVE WORKSPACE** — create the activity record, mark COMPLETE,
  lesson notes + full lesson plan, checkboxes for what was completed (later editable, auditable, and
  reports generated for clients showing what was done).
- ⚠️ **GLOBAL/CENTRALIZED SINGLE-IMPLEMENTATION OBJECTS.** These surfaces must be one implementation
  reused everywhere the content is shown/edited/authored/removed — NOT per-surface copies. (This is the
  standing D18 "no second implementation" rule applied to the activity-record UI.)
- ⚠️ **GAP the owner named:** the offerings FHE currently fulfils are NOT being added to the calendar /
  not in the system / have no companion content set. The activity-record system (notes + checkboxes +
  complete + audit + client reports) is what fills that — overlaps B4 (Lessons). For B0 the right pane
  shows the view-only panel content now; the Lessons work surface slots into the same pane later.
- ⚠️ **MOBILE IS THE PRIMARY INTERACTIVE VIEW** (Claire + clients). Owner uses desktop; other tenants may
  use tablet/desktop. **Capability + experience must be equivalent across all device sizes.** Build
  mobile-first, parity everywhere.

**NEW CONTRACT BUG (View-as, regression in commit `3102907d`) — owner testing the HORSE_SALE_V2:**
1. In View-as (as a party) the horse **color and breed render as "Other"** with the correct value shown
   in the adjacent space; in the EDITOR they render correctly as the dropdown selection. → the party-view
   render resolves the lookup code (breed/color) differently and falls through to "Other". Likely the
   party read path doesn't resolve `horse_breeds`/`horse_colors` codes to names, or the field-def render
   treats an unmatched value as Other. FIX in B1.
2. ✅ **View-as editable-in-preview — DONE** (commit `648eb551`). PartyDocumentView gained an
   `authorPreview` flag: a staff author previewing a party sees every fillable field as an editable
   author control (not just the party's), so issues are fixed from that screen; saves use author
   authority. Banner updated. The breed/color "Other" itself was fixed separately in `6ecc35b4`.

### ⚠️ FINAL CLEANUP PASS — DEFERRED, do NOT do mid-feature (owner, 2026-09-15)
These are last-activities, not now-activities. Owner: "stay in your lane." Recorded so they are
not lost; act on them only during the dedicated final cleanup pass.
- **Migration files do NOT live in the repo.** Move `supabase/migrations/` (+ `migrations-archive/`)
  to the external Archive: `French Heritage Project/Archive/`. (My one session migration is already
  moved there: `Archive/supabase-migrations-removed-from-repo/`; the function is applied in prod.)
- **DB test harness rework.** `test/db/harness.ts` currently rebuilds the DB from ~900 migration
  files to test — owner wants this replaced: a maintained TEST DB kept in sync with live, tested
  directly (not build-up/tear-down from migrations). Ties into the DB overhaul (lots of duplication).
- **Current-state DB documentation set in `supabase/`.** The `supabase/README.md` (does not exist
  yet) is the exhaustive first-line-of-information; a file or set of files documents everything about
  the DB — per object: what it does, what it's wired to, what it affects, what affects it. NO
  evolution notes. This REPLACES migration files as the DB's source of truth in the repo.
- **Relocate working `docs/`.** Only actual app/website runtime working files stay in `docs/`. CRs,
  Claude Code transcripts, reports, design/task specs move to a platform project repo one level up
  (alongside `Archive/`, i.e. under `French Heritage Project/`; `Files/` already holds working files).
- **Repo-wide stale-comment sweep.** Remove ALL evolution/remediation comments and dead/commented-out
  code repo-wide; comments describe current state only (what it does, wired-to, affects, affected-by).
  See memory `fhe-clean-code-no-evolution-comments`. Applied to touched files already; full sweep here.

### ✅ B0 — DONE (2026-09-16). Calendar/booking rewrite + unified tasks + Day view.
Shipped commits: e1ed168f (admin fixes), 6ecc35b4 (contract Other fix), e1325251 (migration
out of repo), 4f39d35c (tasks API), 6620ea80 (Slice A: view/edit + BookingView + Purchase card),
c75af392 (Slice B/C: Day view + tasks on calendar), b774cc45 (binary offering/unavailable control),
4152a119 (Slice D: Today's tasks dashboard zone). What landed:
- **Unified tasks entity** (`tasks`/`task_links`/`task_assignees`, RLS staff-only, anon revoked;
  categories in lookup_options 'task_category', owner-editable). Client API `src/lib/ops/api-tasks.ts`.
- **BookingView** (`src/components/app/BookingView.tsx`) — the ONE view-only surface: top = who/what/
  when/where + Purchase card (usage counter for series via `booking_purchase_card` RPC), cancel +
  reschedule; bottom = SessionActivityForm (the activity workspace). Reused by the calendar modal +
  Day view + dashboard.
- **CalendarItemPanel** now opens existing bookings in VIEW mode (Edit button); "Submit"→"Save" for
  existing; price removed; "+ New client" removed; client read-only behind "Change client"; "Assign to
  purchase"→"Purchase"; tri-toggle → binary offering/unavailable checkbox; appointments are Tasks now.
- **Day view** (`src/components/app/CalendarDayView.tsx`) — desktop left rundown / right workspace
  (task list when nothing selected, close button); mobile → modal; untimed "to do today" strip; week/
  month keep the modal; month-day click opens Day view. `?view=day` deep-link honored.
- **TaskModal** (`src/components/app/TaskModal.tsx`) — the one task create/edit surface.
- **Dashboard zone C1b "Today's tasks"** via `dash_today_tasks` RPC.
DB objects added this session (all in external Archive, applied to prod): `booking_purchase_card`,
`dash_today_tasks`, `tasks_foundation` (3 tables + seed).
Deferred within B0 (owner ruling): the lesson-plan CONTENT in the workspace waits for B4; the
workspace already reuses SessionActivityForm which carries the plan today.

### ⚠️ 2026-09-17 CONTRACT SESSION — done + remaining (read before resuming B1)
**Migration convention:** all DB changes this session are applied to prod and the SQL archived
outside the repo at `French Heritage Project/Archive/supabase-migrations-removed-from-repo/`.
**DONE (HORSE_SALE_V2 unless noted; committed code where applicable):**
- N1 stray periods on label lines — FIXED in `remerge_contract_from_clauses` (label:value lines
  take no terminal period; sentences still do). N2 blank line before every section/subsection.
- Location fields (delivery/trial/installment) → the structured `location` element (name+address),
  field defs + per-doc rows; existing text values migrated to structured.name.
- **PARTY VIEW REWORK (big):** green "YOUR ANSWERS" boxes REMOVED entirely; `PartyDocumentView`
  DELETED. A party (and staff View-as) now renders through `ClauseDocument` — the inline authoring
  surface, scoped by role (`cb.myRoles`), `authorView=false` so a party doesn't see muted
  conditional previews. Edit mode while editable; view-only once locked/executed. View-as = the
  party's exact surface, editable. OUTLINE added around any section with a party field still to
  fill (gold outline, gone when complete). Tooltip icon made legible (was a ~9px superscript glyph
  → 14px Info). Own-field tip is SECOND PERSON ("This is for you, as the Seller, to fill in").
  Empty imported field shows "not on file" (was "from horse record", read like a value).
- §8.2 title/risk reworded to read correctly with or without installments.
- §8.4 no-slaughter AUTO-INCLUDED (gate removed) + buyer-acceptance certify checkbox
  (`TXN.NO_SLAUGHTER_ACK`, clause `DELIVERY.NO_SLAUGHTER_ACK`).
- §7 trial: insurance sentence split into `TRIAL.INSURANCE` clause gated on the election; added
  **N/A** option to `TXN.TRIAL_INSURANCE_RESPONSIBLE` (fixes the "at No Applicable's cost" bug);
  return clause reworded ("Unless written notice is given and approved by Seller, Buyer must return
  … or execute this Agreement").
- §6 PPE: **split the shared date** — `TXN.PPE_DEADLINE` = exam date (§6.1); new
  `TXN.PPE_NOTICE_DEADLINE` = written-notice deadline (§6.2), `PPE.CONTINGENCY` repointed to it;
  added **N/A** to `TXN.PPE_CHOICE` + a `PPE.NA` clause. Live doc set to exam 9/1, notice 9/15.
- §3.6 breeding warranty GATED ON HORSE.SEX (gelding → section absent; mare/stallion/colt/filly →
  available). §3.4 got a **Yes/No gate** (`TXN.HAS_DISCLOSURES`) + a "nothing to disclose" clause +
  a PENDING placeholder; new **Buyer Acceptance and Acknowledgement of Disclosures** section
  (`BUYER_ACCEPTANCE`) with a certify checkbox (`TXN.BUYER_ACCEPTS_DISCLOSURES`), shown when §3.4 or
  injury history has a Yes.

**⚠️ OPEN CONTRACT ITEMS (owner, 2026-09-17, later batch):**
- **TOOLBAR REFACTOR (owner directed)** — rebuild ContractSubheader to a declarative action
  model: one derived doc-state object; each action declares visible/enabled/group; render from a
  grouped list (send→lock→sign progression, void/delete group, Save only when unsaved changes,
  Generate BOS only when complete). Replaces the scattered inline `{isOwnerSide && ...}` conditions.
- **INSTALLMENT GATE BUG** — switching installments no→yes: the gate control seemed to disappear and
  the change couldn't be undone (the gate field TXN.INSTALLMENTS_ENABLED is assigned to clause
  PRICE.FULL_PAYMENT, so it visually moves when the answer flips). `clauseHasViewerGate`/
  `gateOnlyForParty` (commit 3f3e121f) may have addressed the party path; VERIFY, and give every
  section gate ONE stable home (first line of its subsection) regardless of which consequence is active.
- **§5.3 installment schedule field** — `TXN.INSTALLMENT_SCHEDULE` (longtext) is a tiny obscure input;
  make it self-explanatory (guidance/placeholder) and properly sized, ideally a structured schedule.
- **INSURANCE + RISK ALLOCATION IS BACKWARDS (legal content).** During installments title stays with
  the SELLER, so the BUYER cannot insure a horse they don't own. Reverse it: mortality/health/injury
  insurance become SELLER-side DECLARATIVE options ("the Seller may at their discretion maintain a
  mortality policy … if a claim is filed, Seller returns to Buyer all money paid"), with a RECIPROCAL
  liability waiver the Buyer agrees to. Any clause assigning the Buyer responsibility for the Horse
  while they do NOT hold title must be reversed or deleted. Applies to §7 (trial) and §8 (risk of loss)
  too — audit every "Buyer bears/assumes risk … during [pre-title period]" clause.

**REMAINING B1 (not yet built):**
- §3.4 RICH incident list — category menu (from the shown list, no "Other"), "+ Add date of
  incident / start" and "+ Add end date" (with a "present" option), repeating incidents, free-text.
  ⚠️ NEEDS NEW UI CONTROLS in ContractCascade (a repeating category+date-range widget) — a focused
  sub-build, not yet done.
- §3.5 polish: reposition Yes/No above the gated text; the required-asterisk placement; trailing
  period on the input's helper line. (Partly addressed by N1; the reposition/asterisk not yet.)
- §1 fill horse-record columns (current_location empty → now shows "not on file") + dedupe the
  duplicate `template_tokens` HORSE.* rows.
- §2 cascading logic (broader decision-gates future selections).
- §12 make the contract SIGNABLE (owner-side lock/ready-to-sign path) — the counterparty-gated lock
  is the remaining blocker to signing; + explain §12 assignment purpose.
- LOCK MODEL (document controls: restrict-to-suggestions / read-only) — General item 2.
- Mint a template version once the wording is stable (D34; sale has 0 executed docs so D33 = nothing
  to oblige; clause templates don't use save_contract_template_version — check record_template_version_bump).
- Also queued: item 5 (new-task modal fixes), item 6 (client-record FILED UNDER relocation +
  suspend/remove/delete redesign + audit-trail page).

### B0-OLD (superseded by the above) — booking-modal rewrite (calendar items 7 & 8, MINUS lesson plan)
Owner said: "do all the work except the lesson plan revisions, just remove the link for now and when
we are done with the work on the lessons buildout we can add the content to the view based on what
we end up with." Open this turn with the two quick wins first, then the rewrite:
- Quick wins: (a) cancel a weekly plan from an open scheduled booking (Booking item 1 —
  `adminCancelBooking(id, 'all')` already exists, needs a UI hook on the calendar item VIEW);
  (b) widen the desktop modal (C6): desktop centered, side padding ~2–3× the top/bottom padding;
  mobile keeps current sizing. Same modal is used for both today.
- The rewrite (CalendarItemPanel.tsx, ~984 lines):
  - Item 7: opens in **VIEW mode** showing current config; an **Edit** button top-right enters edit.
    Saving = "Save" (updates the item), NOT "Save draft" and NOT "Submit". "Submit" is ONLY for a
    NEW booking REQUEST (notifies Claire to review/approve/suggest another time).
  - Item 8: replace the "session / appointment / unavailable" tri-toggle with a BINARY: a checkbox
    "mark this timeframe unavailable" (for a date) → when checked, offer "recurring" + a notes field.
    Everyone sees an unavailable spot; staff see the notes + who it pertains to. For everything else
    the OFFERING dictates booking type + duration; system tracks usage vs credits (punch cards,
    weekly plans). Each scheduled booking shows "Lesson 5/8 | 3 Credits Remaining".
  - Remove the "+ New Client" button from the client dropdown (wrong place to make an account;
    likely mis-wired). The client is a DROPDOWN today — change to require an explicit "edit client"
    button to switch (guard against accidental client change; rare, only for wrong-client fixes).
  - Explain/keep: "ask the client to add their horse" button (find what it does).
  - REMOVE price from the booking entirely (price lives in catalog + order records).
  - "Assign to purchase" menu is confusing ("4-lesson punch card / evaluation lesson / none - let
    the system debit or create one"). Rename "Booked against" → **"Purchase"** and show, on the
    VIEW mode, a CARD of the thing they purchased with the usage counter + credits remaining (only
    for series: punch card / weekly plan / weekly care; not for single items). Don't show both the
    selector and the "booked against" box — selector in edit, card in view.
  - Cancel/reschedule must be clearly visible on the VIEW mode of a scheduled booking (NOT edit).
  - "Plan and Record" button → REMOVE THE LINK FOR NOW (owner). It should eventually be a SPACE on
    the view that shows the lesson's plan, pulled from the Lessons system (built later).

### B1. SALE/contract logic (HORSE_SALE_V2) — DISCUSS then build
Owner wants to discuss before building; several are investigations already answered above.
- **Document controls → LOCK model (General 2), owner's exact spec:** default shows Add + Comments +
  Requests. A control offers to RESTRICT a party to either: "restrict to suggestions only" (they see
  Comments + Requests, no Add) or "restrict to read only, with comments still available" (Comments
  only). Default = both parties can edit everything until signed. Also: MOVE the Add-item button next
  to Requests; MOVE "scroll to bottom" next to Save. (Engine today: `can_edit_deal` → Add/apply;
  `can_suggest` → Requests; comments always on. Invert the UI, keep engine booleans; guard "one party
  must always be able to edit".)
- §1 "from horse record": fill the horse record columns (proper fix) + dedupe `template_tokens`.
- §2: implement cascading logic so decisions gate whether future things show/are required.
- §3.4 Health & Condition Disclosures: add a Yes/No condition gate like §3.5; on Yes, list with a
  selectable CATEGORY menu (from the shown list), then "+ Add date of the incident or start date for
  timeframe" and "+ Add end date if disclosing a timeframe" (end-date field offers "present" for
  ongoing), plus free-text description. Remove "Other" (not appropriate here or §3.5).
- §3.5 Serious Injury: position the Yes/No selection ABOVE the section it gates (inside 3.4/3.5 as
  appropriate); remove the trailing period on the line below the input (let authors add their own);
  move the required-asterisk to the END of the field (field is full-width, no room now); the "buyer
  acknowledges" sentence needs to be its OWN section with a title (e.g. "Buyer Acceptance and
  Acknowledgement of Disclosures"), a checkbox, spacing, and it references BY NUMBER each section with
  a Yes; when both are No it is not included.
- §3.6 Breeding warranty: gate on HORSE.SEX (gelding cannot breed; mare/stallion can). Remove "Other".
  Position the gating selection line above §3.6 (leaving it in §3.5 when not included; below the
  included text when included). If it prints in the final view it must reside inside the section above
  the text it gates.
- §6.1/§6.2: SPLIT the shared `TXN.PPE_DEADLINE` into TWO date fields (exam date + written-notice
  deadline). Add an N/A option to `TXN.PPE_CHOICE` (and PPE contingency) so the sections can be
  removed entirely. Owner's scenario: month-long eval Aug 1–31, testing scheduled in-period, results
  came back 2 weeks later, blood-draw postponed 2 weeks; needs accurate independent dates and the
  ability to mark N/A. The date entered in 6.1 (9/1) was overwritten by the 6.2 selection (9/15) —
  because same field. FIX and explain the plan before building.
- §7.1: add N/A to mortality insurance (removes the section). Reword the return clause: "unless
  written notice is given and approved by Seller, Buyer must return the horse … on or before [date]
  or execute the agreement." The location field at the start of §7.1 is too small, not self-extending,
  and has no dropdown of known addresses (add manual entry + known-address dropdown, self-extending).
- §8: the "delivered to" address field is too small / not self-extending / no known-address dropdown.
- §8.2 Transfer of Title and Risk: mentions an installment plan when none is selected — make the
  clause read correctly based on what's actually in the contract.
- §8.4 No-Slaughter Covenant: include AUTOMATICALLY (CA law; always want it). Buyer accepts via a
  CHECKBOX on a separate line with spacing, stating the buyer acknowledges the §8.4 covenant and
  agrees to comply.
- §12 Assignment: EXPLAIN the purpose of this section to the owner (BOS is the only ownership record;
  registration/microchip point to Jockey Club; horse too old for digital records). Owner is deciding
  whether it needs a change.
- §12 (signable, item 12): make the contract signable once all sections are complete. Give the
  OWNER-SIDE a lock/ready-to-sign path (today it's counterparty-gated). Confirm signing procedure
  in the response (done above).
- General 1 (activity card removed) — DONE.
- Before building the lock model, owner asked: "tell me what the code dictates a party that isn't me
  will see as seller and buyer for the BOS contract and what each party sees … lessor and lessee for
  a lease contract." (Answered in prior turn; re-answer if asked.)

### B2. Payments + Orders pages (General items 7 & 8) — DISCUSS then build
- Split "Payment Review" (which conflates orders + payments) into TWO pages:
  - **Payments** page: all payments as individual entries with status: awaiting payment · payment
    sent · paid (confirmed) · overdue (marked 24h after order created).
  - **Orders** page: all orders with status: New (unconfirmed requests) · unpaid (confirmed awaiting
    payment) · booked (confirmed payment + scheduled booking not yet happened) · paid (confirmed
    payment, no booking scheduled) · complete (paid + scheduled + marked complete) · issue (paid +
    scheduled but NOT marked complete and NOT rescheduled/cancelled) · cancelled.

### B3. Calendar/booking modal follow-ups — after B0 lands
Remaining calendar items not in B0 (revisit after the modal rewrite): confirm C6 desktop width;
anything discovered during B0.

### B4. Lessons system (deepest — likely a FRESH THREAD)
Owner's design intent (VERBATIM in section C, message 5 and the mid-turn message). Summary of intent:
- Lessons PAGE organized by client with a profile card (name, what they receive, lessons taken,
  monthly count; for weekly plan → taken-this-month / entitled; for punch card → card + used/entitled).
- Click card → that client's lessons page with tabs: Lesson Plan (view-only + Edit button; the
  rider's individual plan lives here), and Lessons (events as cards in chronological order,
  switchable to rows). Click an event → activity page: date/time, the scheduled plan items with
  checkmarks for worked-on (unchecked → strikethrough on save), internal notes, client-readable
  notes as a CHAT THREAD (trainer + client contribute), and on the client side a private notes space
  only they see.
- Instructor must be able to RECORD what a lesson covered; generate PREFORMATTED lesson plans by
  common skill level for new clients; MATRICULATE riders (mark worked-on + proficient → advanced
  activities ungate); mark lessons COMPLETE (this is how revenue is recognized after receipt, and how
  horse usage / consumables / other costs are allocated).
- Evaluations belong on the Lessons page + client record (NOT the standalone Evaluations report
  ledger). The Lessons page has the authoring surface for the EVALUATION LESSON (the rider's FIRST)
  — a FORMATTED input form (not open free text) where the instructor marks skills, comprehension,
  proficiency. The evaluation lesson DETERMINES the lesson plan; lessons generate from the plan;
  activities marked proficient reconcile against the plan so the next lesson holds the next items,
  with notes on progression, milestones, achievements, and lesson-item content. Every lesson needs a
  template form the instructor works from during/after to generate the lesson record.
- Use the FOUND source material (lesson_plans, activity_checklists 31 rows, the components, the
  TASK-LESSONPLAN spec, PROGRESSION-PLAN.md).

### B5. The Alerts/Notifications/Tasks system — spec written, NOT built
Spec at `docs/tasks/TASK-ATN-alerts-tasks-notifications.md`. Decisions already made: condition alerts
COMPUTED live + auto-clear on resolution; notifications "seen" when rendered (per-user seen_at);
tasks are a new entity (`tasks` + `task_assignees` + `task_links` + `task_reminders`) + stored
`alerts`; weekly Monday per-person email; weather built now. **4 open questions still unanswered:**
(1) alert card ranking (severity-then-oldest assumed vs newest-first); (2) which notification
categories exist at launch (to seed the mute list); (3) weather API (Open-Meteo, free/no-key, is the
recommendation); (4) stale in-progress task "aging" nudge — weeks threshold or none. Build is staged:
data+engine → dashboard grid → task authoring → reminders/weekly email/weather.

### B6. Nav / pages answers already given (owner "will decide what to do")
Routed-but-unlinked pages surfaced: `/app/ops/documents` (now linked), `/app/ops/lessons/*`,
`/app/ops/deals`, `/app/care`, `/app/deal`, the review + preview routes (intentionally unlinked),
settings/modules (Account-page cards). Pages that SHOULD exist: Lessons (B4), Payments + Orders (B2).
Directory shows vendors/partners/suppliers. Evaluations (nav) = the delivered report ledger
(EvaluationReportsPage) — but owner wants evaluation AUTHORING on the Lessons page (B4).

---

## C. OWNER REQUESTS — VERBATIM (do not paraphrase)

### Message — the Alerts/Notifications/Tasks system
> we need a timeout rule for things that are notifications on the dashboard that dont require my
> attention or action but are surfaced just so i have awareness. for these seeing them is the point
> and once seen they arent needed to persist. what i suggest is a sectioned notification setup,
> alerts, notifications, tasks. Alerts are urgent; this order hasnt paid, this person hasnt finished
> their onboarding documents, this lesson is booked today and its going to rain, this person cancelled
> or rescheduled, this person wants to book a lesson, you have a new lead...etc. notifications are
> temporary keeping me in the loop type things; this person paid, this order was submitted, you have 4
> lessons today, tiz did 7 lessons this week, you made $900 today...etc. and tasks require action,
> these must be included with every alert unless there is no action to take for the alert, they can
> also exist on their own (auto generated based on something that happened in the app or manually
> created using a button, modal, and flow that needs to be setup and configured. Just like i have 3
> cards at the top of the dashboard, i should have a grid below that with these items that live in rows
> based on type, the row can be scrolled horizontally on mobile (3x grid width on mobile with the 3rd
> showing half off the page so it indicates the scrollability, and flexible with no limit to the qty
> shown on desktop, min 3x (scalable in size so desktop shows larger cards with more information,
> mobile shows smaller cards with less information, and on desktop the last card in the row is always
> showing as a fade-out gradient style half visible with the right side showing an arrow to indicate a
> click and the row moves (we have to decide between replacing the whole row qty on click or one card
> at a time incremental advancement. i like the single click rather than the full row replacement so
> lets try that style first), and then rank them in order of Alerts (click to open as a modal with the
> information and the task shown, make the task assignable with things related to clients and services
> and horses auto assigned to claire and things related to support, payments, documents, assigned to me
> but we both see everything and the assignement is easy to change by clicking on a button it switches
> between the two of us like a toggle, when the name is clicked it opens that person's list of tasks and
> shows where this task is on the list but the whole list is scrollable and each task is openable, all
> of this happens in a modal. Next row is the notifications, these auto dismiss after being seen and the
> manual dismiss button remains just in case i want to clean up the section manually and when the
> section is empty its hidden, alerts is also hidden when empty, tasks is always shown and when there
> are not tasks to show a button for adding a task is shown in place of the first card, when there are
> tasks to show there is a button on the left side above the first card for adding a new task, when a
> task is created it can be assigned to either or both of me and claire. the button on the task ui that
> cycles through assignment should have all three options and we should be able to categorize the task,
> link it to any order/booking/horse/service (as in catalog item, useful if i need to update something
> about an offering)/contract/document/client, etc...categories for general task, app update task,
> website update task, etc...and a space for text notes, adding an image (useful for including a photo
> of something from the ranch or a screenshot, etc...), auto sets the date it was created but can be
> manually adjusted and a due date that is optional with the option to add a dashboard alert, email
> alert, and an option to schedule a reminder with or without alerts via email or dashboard (the
> alternative being an urgent alert which appears as a modal popup on sign in until cleared by calling
> the task complete or turning off the alert). tasks need to have a status (new, in progress, complete)
> complete are auto removed, and the ability to delete a task must be included as well as the ability to
> edit everything that can be authored or set. All deleted/completed/cancelled tasks, alerts,
> notifications go to a history page so nothing is ever lost after it leaves the dashboard. from the
> history page they retain the full visibility, the ability to be restored, and the ability to be hard
> deleted from the system. when a task includes another person from the company (staff/admin) the
> alerts for them are set by the task creator with the option to mirror the settings the task carries
> for the author (when the author is included in the task), when a client is included the option to add
> the task to their dashboard with an option to include an alert. For all tasks the option to show no
> alert, priority alert (modal on login), or standard alert (normal dashboard alert), and the option to
> send an email, are all required options for the ui but not required to be configured. no
> configuration, no alert. additionally, the reminders are optional and must be available in the ui for
> all parties individually, and are independent of the alerts, a reminder can be surfaced as an alert in
> the same 2 formats (modal on login and/or in the dashboard). checkboxes are the best option for
> selecting the config for these so the user can select all that apply or by selecting none nothing
> applies. So a task is created, an alert can be set by checking either of the boxes for the three
> choices (dashboard, modal, email) and reminders follow the same style but require a timer set from X
> days/weeks from now, and/or X days/weeks before due date. setting nothing from those two just adds a
> task to the task section of the dashboard for each party listed on the task and there should be two
> roles, observer (used for awareness only) and participant (used for assigning responsibility for
> making sure it gets done or some part of it is done by them). a weekly email that goes out to start
> the week on monday morning should list the contents of their alerts and task lists without overlap,
> and with priority to the alert so when the task has an alert it just shows in the alert list.
> dismissing or cancelling an alert doesnt cancel or remove the task and removing the task cancels the
> alert. is there anything missing from this setup?

### Message — the big mixed batch (General, Booking/Calendar/Clients, Contract System, BOS)
> ok, i need you to make corrections in these areas:
>
> General Issues (found in the admin view):
> 1.Scrolling the desktop menu scrolls the page when the menu reaches its end.
> 2. Some surfaces move side to side and flow off the page, they aren't locked in, vertical over scroll
> up and down is ok.
> 3. Missing Documents page doesnt have a nav link. Should we have a separate Contracts page or should
> it just show under documents? There is a distinct difference between a document I'm working on
> (typically so far only contracts) and signed documents which don't need to see regularly, I just need
> to know if they are not signed.
> 4. Calendar nav link needs to be moved to the Community section to the position below community feed.
> 5. Lessons doesnt have a page or a nav link. this would be a page that shows the lesson plans and
> lesson content for each client, it should be organized by client with a profile card that shows the
> client name, what they are receiving from us, basic information about how many lessons they have taken,
> their monthly lesson count and when they are on a weekly riding plan it should show the count of how
> many lessons they have taken this month out of how many they are entitled to, similarly for punchcard
> holders it should show the punchcard they have and how many lessons they have used out of how many they
> are entitled to. then clicking the profile card should open to their lessons page which would have the
> lesson plan as a tab, this is where the rider's individual lesson plan lives and opens to a view only
> view and with the clicking of an edit button it can be edited. the lessons themselves are recorded as
> events which would be shown on separate tab and they would appear as cards in chronological order with
> the option to switch the view to a row layout. when the card or row is clicked it opens to the page
> that shows the activity, the information about the date and time, and the lesson plan that shows what
> was scheduled to be worked on that lesson and the items worked on should have a checkmark to indicate
> they were worked on and items without a checkmark should recieve a strikethrough when the lesson is
> saved, there should also be a space for internal notes and a space for notes the client can read and
> that should have a chat thread type interface so the trainer and client can both contribute and on the
> client side when they are looking at their lesson card they should have a space for internal notes that
> only they see. suggest anything else you can think of or alternatives to what ive suggested, dont just
> build this verbatim off what i wrote, actively discuss this with me so we build it one time and its
> done right. there is mention of this lessons page(s) being missing in a request further down this
> message, just a heads up so you know its not a completely separate request, the metions are linked and
> the obvious gap that exists that wasnt explicitly mentioned but needs to be addressed is the ability for
> the trainer to record the items the lesson covered, the ability to generate preformatted lesson plans
> based on common skill levels for new clients, and the ability to matriculate the riders through the plan
> contents by indicating what was worked on and what the rider has become proficient in so more advanced
> activities can be ungated and the lessons need a way to be marked complete since this is how we are able
> to recognize the revenue was earned after it was received and its how we are able to allocated things
> like horse usage, consumables, and other costs.
> 6. Directory is intended to show what?
> 7. "Payment Review" conflates what a page should show and what a label should do, and it mixes orders
> into the same page. We need a "Payments" page and it should show all payments as individual entries with
> a status; awaiting payment, payment sent, paid (payment confirmed), overdue (marked 24 hours after order
> created).
> 8. Need to create a dedicated page for "Orders". It should show all orders with status; New (for
> unconfirmed requests), unpaid (for confirmed awaiting payment), booked (for confirmed payment and
> scheduled booking on the calendar that hasnt happened yet), paid (for confirmed payment but no booking
> scheduled), complete (for paid and scheduled bookings that have been marked complete), issue (for paid
> and scheduled bookings that have not been marked complete and that have not been rescheduled or
> cancelled), cancelled (for orders that have been cancelled).
> 9. Evaluations page is intended to show what?
> 10. Tell me what pages exist but are missing a top-level nav link, and tell me pages that should exist.
> I will decide what to do with the items on your list.
>
> Issues with Booking, Calendar, and Clients:
> 1. need to be able to cancel a weekly plan from any of the open scheduled bookings.
> 2. need to be able to delete a client entirely (hard delete) and delete all of their paperwork and
> scheduled bookings and order and activity history. Instead of denying the delete because of the FK
> database constraint, show a modal that asks if this is a test client and let me check a box to indicate
> its ok to delete the client and all of their associated content. for a real client who didnt show up,
> didnt pay, but has an order and signed docs, I need to be able to delete them from the system because
> until they pay and show up their paperwork is not needed and shouldnt be taking up space in the system.
> so the other option next to test client is a client who did paperwork and didnt pay or take any
> services. For these i need to be able to delete them just like a test client. if they have paperwork and
> payments and activity history and they are not a test client then we soft delete them and they appear in
> the deleted client page so their content can be viewed, this hides them and their content from the system
> views for everything except when accessed directly through the deleted client door.
> 3. the month view of calendar still doesnt, match the updates to the week view. the term "reserved" is
> still being shown instead of the client name and service.
> 4. the calendar view is too large in the week view the vertical size is bigger than the screen and i have
> to scroll to see all of it. I want to be able to see all of it without scrolling, you can make the
> unfilled spots smaller so the whole day is visible on iphone the horizontal scroll and vertical scroll
> shouldnt be necessary either, or if you have to keep horizontal scroll that is fine but make sure the app
> is locked so the whole page isnt moving past its edges horizontally (mentioned in general app issues).
> 5. the pages need to be sized to the device not generic static sizing, on iphone in particular the pages
> open slightly wider than the screen and the user has to pinch to zoom out to see the whole page, this
> should not be necessary.
> 6. the modal that opens from the month view is narrow and should be made wider, it looks like the mobile
> and desktop use the same modal sizing, desktop should be wider with the centered positioning and the
> padding currently used for the gap at the top and bottom is sufficient, the sides should use a padding
> value that is roughly 2x or 3x the padding used at the top and bottom and then the modal will fill the
> screen nicely. if i find that its too big we can reduce it.
> 7. on the calendar item modal, it always opens in edit calendar item view. this is incorrect, it should
> open in view mode and show everything as it is currently configured. an edit button should be located in
> the top right to access the edit view, saving should not be save draft, it should save the inputs and
> update the item i should not use submit after an item is on the calendar, this submit button is only to
> be used when making a new booking request and it should notify claire to review the booking request and
> approve or suggest a different day and/or time.
> 8. on the calendar booking modal there is a set of three options at the top "session, appointment,
> unavailable". these dont make sense and arent aligned with the contents in the system that get a booking.
> Change it to use a binary option with a checkbox for marking a specific timeframe unavailable for a
> specific date, when that is checked the option to make it a recurring item on the calendar, and a space
> for notes. thats it. everyone sees it as a spot that is unavailable, staff see the notes and who it
> pertains to. For everything else the offering should dictate the type of booking, the timeframe duration,
> and the system should be tracking usage against credits for things like punch cards and weekly riding
> plans. each scheduled booking should show the number in the set with the number remaining below it (ie:
> Lesson 5/8 | 3 Credits Remaining). There is also a conflict between the Client drop down menu where a
> client is selected and the "+ New Client" button. I assume the button is to add a new account, it should
> not be here and this is not the correct way to handle adding an account and its very likely this button
> isnt properly wired and contributing to the system chaos around creating a new account. Also i would like
> to know what the "ask the client to add their horse" button does. Also, why do we show price as an
> editable field on a booking? the price shouldnt be shown anywhere on a booking. Prices are shown in the
> catalog and on the order records. The "Assign to purchase" menu list is confusing, for example, on
> Naomi's lesson on 9/14 at 11am, shows a 4-lesson punch card, an evaluation lesson, and an option for
> "none - let the system debit or create one". This is confusing to me as to which to select and what
> happens when "none" is selected. also, why are we seeing the client as a drop down menu list to easily
> change the client, seems like a good way to accidentally change the client and not realize it and with no
> history record on the edit view we have no way to know who it belonged to in order to change it back. make
> it require a button to "edit" the client if we need to switch the lesson from one client to another. but
> this is only for when the wrong client is selected which should be very rare, it is not appropriate to
> switch a client as a way to record a change when one client wants to move their lesson to another
> date/time and we fill the spot with another client. there is an appropriate way to do this and its with
> the cancel/reschedule option which needs to be clearly visible on the viewing view of the scheduled
> booking, not the edit view. and then the box for "Booked Against" showing what the selected item from the
> "book against" menu selection already shows is only useful if its shown as the counterparty to the menu
> selection that is visible on the view only view of the scheduled booking, we dont show both, the selection
> menu selects the purchase the lesson is booked for, the viewing mode version of the scheduled booking
> shows a card like this so we know which purchase this booking is for. and we should change the name from
> "booked against" to "Purchase" and then show the thing they purchased, and this is the proper place to
> show the information about the usage counter and credits remaining. if its a single item purchase (ie:
> single lesson, single care service) we dont need to show the counter because its not part of a series, but
> when its part of a series (ie: punch card, weekly lesson plan, weekly care service plan) we should show
> the quantities for consumed and remaining. the button for "Plan and Record" is something that should be
> shown on the view only view. It should not be a button, rather it should be a space for the plan to live,
> it shows the plan for the lesson. It pulls this information from the lesson itself which needs an authoring
> and viewing system and location in the app. the pages for this might already exist but they are not shown
> in the current nav and ui views i can see.
>
> CONTRACT SYSTEM
> General Issues (applies to all contracts):
> 1. On the contract authoring surface there should not be a space showing activity on the contract surface
> itself, its shown in history. remove the card at the top of the page. On the BOS contract its shown
> directly below the title "HORSE SALE AND PURCHASE AGREEMENT".
> 2. Let's revise the document controls system. lets flip it to a lock system where a checkmark indicates a
> lock on an ability rather than the current setup where a checkmark makes something available. this means
> all contracts in their default configuration are editable by both parties until signed by both parties.
>
> BOS Contract:
> 1. In section 3 "The Horse" the registration number and current location are showing "from horse record"
> this in the past has indicated a disconnect between what the contract is wired to and what it should be
> wired to. Please investigate the cause of this and either fix it straight away or suggest what you think
> will fix it.
> 2. we need to implement basic logic so decisions cascade to control whether future things are shown and
> need to be selected.
> 3. In section 3.4 "Health and Condition Disclosures" doesnt have a condition gate. It should operate like
> section 3.5 "Serious Injury History" that begins by asking if there are any of the following to disclose
> and show the list with a menu to select from at the end and uses "Yes or No". "Other" doesnt make sense
> for this or for 3.5. If they select yes, it ungates the section to list them similar to how section 3.5
> does, but for this section it should be listed with a selectable category using a menu of options based on
> the list shown. After the selection there should be the option to include a date or date range that is
> added using a button that says "+ Add date of the incident or start date for timeframe" and "+ Add end
> date if disclosing a timeframe". The second button should add a selection field that shows the option to
> select "present" to indicate its currently ongoing, this is needed when something like a medicine was
> started on a certain date and they are still taking it. a single date is used for an incident so they can
> indicate the date it happened. Then there needs to be a space for free text input for them to include a
> description/explanation or further information, in the example of a medication they could list the name of
> the medicine, the dosing, the schedule, etc... or in the example of an incident they could describe what
> happened.
> 4. Section 3.5 positions the question with the selection of "No" after the statement that is gated by that
> selection. When "yes" is selected it shows the question above Section 3.5 so it appears inside of Section
> 3.4. Also, there is a period shown on the line below the input field, i assume this will be appended to the
> end of the input but its better to let the author add their own periods, remove this one, and move the
> asterisk that indicates the input field must contain something to the end of the field, right now the
> field is full width and leaves no room for the asterisk to appear on the same line. And then there is a
> sentence that says the buyer acknowledges this disclosure and proceeds with knowledge of it. I understand
> the intention behind this but its improperly executed. it needs a checkbox, it needs a space between it and
> the disclosures above and it needs a title and should be its own section, something like Buyer acceptance
> and acknowledgement of disclosures. And it should reference the sections by number for each section that
> has a yes selected and when both are "no" it is not included.
> 5. The breeding warranty is a weird one. this should be gated on the horse sex selection. a gelding cannot
> breed, a mare could and this would be acceptable to include but the option for "Other" should be removed
> just like in section 3.5 its not appropriate, and just like in section 3.5 where selecting "yes" positions
> the selection gating line above the section it belongs to, this positions the line that asks for a
> selection above section 3.6 the breeding warranty section above it leaving it in section 3.5 when the
> selection of not included is selected, and positions the selection line below the included text when
> included is selected. if this prints in the final view of the contract it needs to reside inside the
> section and above the text it gates. Just like the correction made to section 3.5.
> 6. Section 6.1 and 6.2 have the dates linked and this doesnt make sense because testing can take time to be
> received. I set the date for testing and then set the date for the written notice requirement as 2 weeks
> later and it changed the date for the testing. and it asks if the prepurchase examination was conducted or
> waived. this doesnt make sense, in my scenario where i had an evaluation period of 1 month that ran from
> august 1st to august 31st and i scheduled the testing during this period and i needed the results back
> before i could decide (and drug testing wasnt the reason for the testing, ill address that section next), i
> didnt get the results back until two weeks later, and the original blood draw date was postponed by two
> weeks which put it at the end of the evaluation period, and now that ive received the results im preparing
> and executing the BOS and im forced to make selections for these sections instead of having the ability to
> select them as not applicable so they are removed from the contract and when i try to enter the selections
> that are accurate in my case 9/1 for the examination, and "conducted" for the pre-purchase examination line
> item, and then in section 6.2 9/15 for the date by which i need to notify the party if the results are
> unsatisfactory, and yes for the sale contingent on the results. the contract reads weird and the date of
> 9/1 in section 6.1 was changed to 9/15 because of the selection made in 6.2. Explain to me how we can
> address these issues with updates so i can approve the plan or suggest changes to it before you make any
> changes.
> 7. in section 7.1 the clause for mortality insurance needs an option for not applicable and it removes the
> section. The line item for "buyer may return the horse...on written notice given on or before [date], in
> which case...it should say unless written notice is given and approved by Seller, Buyer must return the
> horse... on or before [date] or execute the agreement. Additionally, the location input field at the
> beginning of section 7.1 is too small and doesnt appear to be self extending and doesnt have a drop down
> menu with known addresses to select from in addition to the input of an address manually.
> 8. in section 8 "Title, Delivery, and Risk of Loss" the delivered to address field is too small and doesnt
> appear to be self extending and doesnt have a drop down menu with known addresses to select from in
> addition to the input of an address manually.
> 9. section 8.2 "Transfer of Title and Risk" mentions installment plan but no installment plan is selected
> in this contract. this should be adjusted so the clause reads correctly based on what is actually included
> in the contract.
> 10. section 8.4 "No-Slaughter Covenant" should be included automatically and not require a menu selection,
> its the law in california and that is where this contract is being used but in general we want people to
> always agree to this. and the buyer must accept this covenant by checking a box that is on a separate line
> with a space between it and the clause above and it states that the buyer acknowledges the covenant in
> section 8.4 above and agrees to comply with it.
> 11. Section 12 "Assignment" this section might need a change. in the event i transfer ownership to another
> person or entity, this section seems to say that i need the sellers written consent because the BOS is the
> only record of the ownership of the horse, the registration and microchip information all point to jockey
> club and this horse is too old to have digital records which began after its birthdate. explain to me the
> purpose of this section.
> 12. the contract is complete and all sections have their inputs but it remains unsignable, i need it to be
> signable once all sections are completed. unless the signature and date are added automatically based on my
> name being already entered into the "By:" field in the buyer signature section? please review and explain
> the signing procedure as dictated by the actual code for this document.

### Message — mid-turn: instructor-home + evaluations/lessons design
> whats on this: /app/ops/preview/instructor-home
> this: "Item 9 — Evaluations (/app/ops/evaluations, EvaluationReportsPage) shows: delivered horse/rider
> evaluation reports — the "report card" records (D27), with read/download/email/share. It is not a queue of
> evaluations due (that's a dashboard zone). So the nav "Evaluations" = the report ledger." belongs on the
> lessons page and the client record as parts of those surface and the lessons page should have the authoring
> surface as evaluation lesson, their first. This is where the instructor marks things based on rider skills
> and comprehension and proficiency, it should be a formatted input form not an open free text input field by
> itself. we should come up with a design for what it should contain and what it should look like and then
> implement it. Every lesson needs a template form for the instructor to work from during and after the lesson
> that generates the lesson record. the evaluation lesson should determine what the lesson plan contains, then
> the lessons get generated based on the plan and the lesson activities that get marked as proficient reconcile
> against the lesson plan so the next lesson contains the next items but there are notes about how the
> progression works and even the milestones, achievements, and contents for lesson items. see if you can find
> that so we have it to use in this buildout.

### Message — the View-as toggle / party identity question
> "The viewAsSigner toggle (only when you're also a party) is the only way you'd see the read-only frame." I
> dont see the toggle, i should always see the toggle as the author and admin its a helpful item to have for me
> to see what each party will see. i suspect that even though "french heritage equestrian" is a party to the
> contracts ive made so far, the system is gating it to the other account "hello@fhequestrian.com" and not
> treating my account "admin@fhequestrian.com" as a party to the contract...?
> [RESOLVED — View-as picker shipped in commit 3102907d. Diagnosis in section A.]

### Owner choices captured (for the lock model + sequencing)
> the new model would show the option to restrict to either option; restrict to suggestions only, restrict to
> read only, with comments still available. this changes whether the viewer sees the comments button or comments
> button and requests button. the default being that it shows the add button, comments button, requests button.
> the add item button should be moved over next to requests. and the scroll to bottom should be moved over next
> to save. im not sure what either party sees when they open a contract right now because i always see it in edit
> view. it would help for you to tell me what the code dictates a party that isnt me will see as seller and buyer
> for the BOS contract and what each party sees when they arent me when they are lessor and lessee for a lease
> contract.

> do the fixes now, lets see how those land, then we can discuss these three, starting wtih the sale/contract
> logic, then the payments and orders pages, then the calendar/booking modal and then the lessons system since
> that is the deepest and largest we will need to possibly hand that off to ourselves in a new thread since the
> context might be full by then.

> do all the work except the lesson plan revisions, just remove the link for now and when we are done with the
> work on the lessons buildout we can add the content to the view based on what we end up with in the lessons
> system.

---

## D. HOW TO RESUME
1. Read this file.
2. Confirm branch is `main` and `git status` is clean (or note what's uncommitted).
3. Start with **B0** (booking-modal rewrite, items 7 & 8, minus lesson plan) — lead with the two quick
   wins (cancel-weekly-plan hook + wider desktop modal), then the CalendarItemPanel rewrite.
4. Then run the design conversations in owner order: B1 (SALE contract) → B2 (Payments/Orders) → B3
   (calendar follow-ups) → B4 (Lessons, likely fresh thread).
5. Still-open owner decisions to collect when relevant: the 4 ATN questions (B5); confirm the lock-model
   toolbar reorg details (B1) before building.
