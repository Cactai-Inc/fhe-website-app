# RECONCILED — every open item, checked against `main` today, in ONE list

**Written by `FHE-TASK-RECONCILE` (DISCO profile, read-only), 2026-09-03, in `wt-6` on `task/reconcile`
from `main` = `d45edb72`.** Production was read with `psql` under `default_transaction_read_only=on`;
no write, no migration, no branch beyond this file. **For ORCH to bundle. Nothing here is a spec.**

## RESUME (running record)
- **Inputs read in full:** `BOARD.md` · ledger CR-98…CR-115 (+ CR-86/88/89/90/93/94/97 entries the
  board cites) · `HANDOFF-SIGNBOOK-THREAD-2026-09-01.md` §2–3 · the Casey backlog · `RUN-QUEUE.md` ·
  `ORCH7-BRIEF.md` §3 · `docs/method/03-REMAINING-WORK.md` §3/§5 · `04-OPEN-QUESTIONS.md` §3–4 ·
  headers of all 211 files in `docs/tasks/` · full headers of the 33 with no `-REPORT.md`.
- **Verdicts:** KEEP = still true, still open · REVISE = open but the framing/scope/gate has moved ·
  REMOVE = done, withdrawn, superseded, or moot. Evidence column says what was measured, where.
- **Status:** COMPLETE. Sections: §1 board · §2 SIGNBOOK lane · §3 Casey · §4 ROUTED + RUN-QUEUE ·
  §5 open CRs · §6 unbuilt task files · §7 new findings · §8 bundles for ORCH · §9 out of scope.

---

# 1 · THE BOARD — RUN ORDER, RESUME, queues, HOLDS

| # | Item (board section) | Verdict | Evidence, measured today | Bundle |
|---|---|---|---|---|
| 1.1 | RESUME says `main = 0e9ebaf0` | REVISE | `main` is `d45edb72`, five docs-only commits later (`c00736be`…`d45edb72`). Nothing of batch 2 has merged. | ORCH board write |
| 1.2 | "Owed by ORCH: SITESEO post-deploy curls" | REMOVE | Closed by `ad6eca12` — 308 redirects live, `/services` serves its own HTML (`TASK-SITESEO-VERIFICATION.md`). | — |
| 1.3 | Batch 2 pool assignment: SIGNFLOW-G in wt-3, BANNEDWORDS in wt-1 | REVISE | `wt-1` is on `task/signflow-g` at `40c08335` ("ledger + report"); `wt-3`, `wt-5`, `wt-6` were untouched at `0e9ebaf0`. **SIGNFLOW-G ran in wt-1, not wt-3; BANNEDWORDS has no tree showing work.** Same D36 deviation as batch 1, third time. | ORCH board write |
| 1.4 | CR-106 raised to the FRONT; owner inputs asked directly | KEEP | `@vercel/analytics` mounted in `src/main.tsx:6` (page-level only); no events pipeline, no admin analytics page. Inputs list is in the ORCH thread. | **B4 SITE** |
| 1.5 | MGMT files exist, not in force; first spawn when RECONCILE returns | KEEP | This file is the return. | ORCH |
| 1.6 | Docs task `ONERAIL` (rebase the stale spec) | REVISE | File exists (96 lines, adversarial read-only verify). Its question is still orphaned: `PERFORM apply_category_documents(v_contact, v_cats)` stands at `20260822T0120_stabilize_2…sql:158`; whether `v_cats` can be non-empty since `ProvisionClientForm` stopped ticking categories has still never been read. It is a VRFY/DISCO-profile read, not a DSNR spec. | **B3 INROADS** (runs first) |
| 1.7 | Docs task `FUNNELDEBT` (no file yet) | KEEP | The lane's seven items are all still open (§2). Fable-tier per `MODEL-CHOICE-NOTES` §2026-09-03. | **B2 FUNNELDEBT** |
| 1.8 | Docs task `SITEPOLICY` (no file yet) | KEEP | POLICIESANDFAQ research; `/visit` and `/contact` `indexable:false` (`seo.ts:127-140`) now joins it (CR-115). | **B4 SITE** |
| 1.9 | Docs task `INROADS` (no file yet) | KEEP | `deal` still deliberately unchanged in `SignStart.tsx:26,344-347` (SIGNDOOR §5.4). The three-state door covers guest/rider/horse/rider+horse only. | **B3 INROADS** |
| 1.10 | Wave-2: `RANCHWORD` build after TACKROOM | REMOVE | Withdrawn by CR-111 ("program" banned); BANNEDWORDS audit replaces it. | — |
| 1.11 | Wave-2: `TACKROOM` research | REMOVE as a task; its §5 residue KEEPs | Handoff written. CR-112 + A1 answered §5 items 1, 2, 3, 5 (two tenancies; cost AND price; dated usage entries; FHE is a boarder, not a provider). **Still open: §5.4 which Horses incumbent · §5.6 the module name ("Barn" is now a banned word; My Stable is the ruled door) · §5.7 `horse_medications` · §5.8 three vendor notions · the durable-goods door name (CR-112 A1 #14).** Tables still empty: `resources` 0 · `consumption_events` 0 · `resource_lots` 0. | **B5 SUPPLIES** |
| 1.12 | Wave-2: cursive-period defect | REMOVE | Ruled (CR-101 A1), specced (SIGNFLOW-H), running in batch 2. | in flight |
| 1.13 | Stale-comment batch: `Onboarding.tsx` payment step claimed live | KEEP, confirmed | `src/pages/app/Onboarding.tsx` — `'payment'` appears only in the `Step` union (`:111`) and one render branch (`:2230`); **nothing sets the step**, yet comments at `:97` and `:621` say the provisioned door "still ends at payment". Stale on both doors. | **B1 GRANTS+STALE** |
| 1.14 | Stale-comment batch: D's three | KEEP, confirmed | Still present verbatim: `MergedBodyView.tsx:28` (Release.tsx), `src/lib/contact.ts:184` (DocsParticipantFlow / sign-release.ts), `api/deliver-document.ts:10` (api/sign-release.ts). Exact replacements are in `TASK-SIGNFLOW-D-REPORT.md` §4. | **B1** |
| 1.15 | Spec corrections for DSNR: SITECOPY-B's zero-consumers premise · SIGNFLOW-A §7 · LANDINGSIGNIN §8.4 | KEEP | Docs-only corrections; none applied. | **B1** (docs half) |
| 1.16 | Wave-1: `SIGNFLOW-F` | REMOVE | Delivered specs G + H (`a9cc8b24`); both running. | in flight |
| 1.17 | Wave-1: caller-less `authenticated` grant on the two retired sign functions | KEEP, confirmed | Production `has_function_privilege`: `sign_release` anon=f authenticated=**t** · `sign_general_release` anon=f authenticated=**t**. | **B1** |
| 1.18 | Wave-1 OWNER: redirect-vs-404 on the two retired URLs · render checklists for three merges | KEEP | Owner's; nothing on `main` decides it. SIGNFLOW-D §9 recommendation stands. | **B12 OWNER** |
| 1.19 | 10 pre-D41 reports with no VALIDATION block | REVISE | Measured by grep today: **5 still lack one — SIGNSTRIP, AR4, BOOKS1, ZELLECLOSE, WALLSYNC.** SIGNDOOR, REAPER, MODAL2, CR85, BACKDATE now carry the word (ORCH's after-the-fact blocks). | **B1** |
| 1.20 | CR-110 modules access-point refactor | KEEP, confirmed | `AccountHub.tsx:234-235` — a single `NavRow` "Barn Ops" gated on `mod.barnops`; Modules-section comment at `:216`; no other module hub has a row. Rail filter `CARD_PAGE_ONLY` still in `AppLayout.tsx`. | **B5 SUPPLIES** (it is the same door) |
| 1.21 | HOLD: contract entry points (`/sign/deal` alignment, door widening) | KEEP held | See 1.9. | **B3** |
| 1.22 | HOLD: `CLNR-REPO-STATE` | KEEP held | Still "when no build is mid-flight"; G and H are mid-flight. `RUN-QUEUE.md` retirement (§4) joins its list. | last |
| 1.23 | HOLD: owner diagnostics A1 Vercel top pages · A2 GSC verify · B1 Business Profile + socials | KEEP | B1 is now asked directly (CR-115). No `google-site-verification` tag exists (grep). | **B12 OWNER** → feeds **B4** |
| 1.24 | REQCARDS "option-set conversation happens HERE, then DSNR fold" | REVISE | CR-99 A2 already ruled: no new card, one inbox of all new requests, **"dsgn isnt needed."** §9 of the spec is superseded; the conversation is over. LIFECYCLE and SIGNBOOK (its two gates) are both merged. **Dispatchable after a §9 strike-through.** No dashboard action surface exists today: `decideBookingChange` is called only from `CalendarPage.tsx` and `CalendarItemPanel.tsx`. | **B6 REQUESTS** |

# 2 · THE SIGNBOOK-FALLOUT LANE (handoff §2–3)

| # | Item | Verdict | Evidence | Bundle |
|---|---|---|---|---|
| F1 | An order submission sends TWO emails | KEEP | `src/lib/api.ts:142` still posts `/api/inquiry-confirmation`; `api/request-activation.ts` sends the activation link on the same act (its own header comment cites the other). Owner's call inside spec work (subtractive vs CAREPATH §C6). | **B2** |
| F2 | `flush_held_executed_document_emails` 30-min backstop splits the one email | KEEP | `api/delivery-sweep.ts:39` → `p_hold_minutes: 30`, hourly from GitHub Actions. Tuning call is the owner's. | **B2** |
| F3 | Booking events filed under `entity_type='offering'` | KEEP — **UPGRADED AGAIN** | Production today: **829 rows** (`759` when ORCH verified), **781 booking-shaped** (entity_id is a `bookings.id`), latest **2026-09-03 03:18** — still being written. `entity_type='booking'` rows: **0**. ⚠️ **The CHECK constraint forbids the right value**: `20260821T1500_lessonplan_m1…sql:171,174` allows only `account, document, order, offering, fulfillment, lesson_plan`. The fix is writer + constraint + a relabel of 781 rows, and it is D32-sensitive. | **B2** |
| F4 | A member with no `clients` row cannot submit a booking request | KEEP (trap) | `RAISE EXCEPTION 'no member profile'` at `20260901T1640…sql:118` (`request_open_time`) and `:179` (`book_open_slot`). Nothing heals it. | **B2** |
| F5 | DISPLAYNAME's unbuilt half | REVISE | `task/displayname` **is merged** (`759098e8`) — the repo/DB disagreement the handoff warned of is gone. Production: **0 of 16 profiles blank**. Still absent: `set_my_display_name` (not in `pg_proc`, not in the repo) and any control — `AccountHub.tsx:97` only reads it. Only the "member can change it" half remains. | **B2** (or **B10** as a one-RPC build) |
| F6 | GUARDIAN lost at provisioning | KEEP | `FINDING-the-guardian-declared-at-the-door-is-lost-at-provisioning.md` stands; no `guardian` read in `provision_client_invitation` / `redeem_invitation` (grep of migrations). `TASK-DEPENDENT` (§6) is the commerce half of the same spine. | **B2** |
| F7 | `trg_seed_display_name` carries anon EXECUTE | KEEP, confirmed | Production: anon=**t**, authenticated=t. Inert (trigger fn) but the false "anon absent" claim stands. One REVOKE. | **B1** |
| 3.2a | Confirmation copy (behind SITECOPY-B) | REVISE — gate open, HALF built | SITECOPY-B merged. `Confirmation.tsx:167-190` now says the email carries an activation link (owner's 2026-09-01 words, order-gated). **Missing:** the rules/policies/waiver-after-activation line, and `SendStateScreen`'s spam / add-us-to-contacts / contact-us lines (`SignStart.tsx:169-170`) — none of those words appear in `Confirmation.tsx`. | **B2** |
| 3.2b | Deal/guest doors aligned with the rider flow (behind SIGNFLOW-B) | REVISE — gate open, HALF built | SIGNFLOW-B merged. `guest` IS email-only and three-state (SIGNDOOR/CR-103). `deal` is the deliberate exception (`SignStart.tsx:26`). Remaining half = `deal`, and it is HELD for INROADS (1.9). | **B3** |
| 3.5 | Visit when-pickers · Charlotte Caddell | KEEP as DO-NOT-ACTION | Owner cut / owner handling. | — |
| §4 | Deliverability: `email_sent` = provider-accepted, never delivered | KEEP, unowned | No bounce webhook, no delivery-event provider. Natural home is the notification design (CR-113). | **B11 NOTIFY** |

# 3 · THE CASEY CADDELL BACKLOG (11 items, owner-paced)

| # | Item | Verdict | Evidence | Bundle |
|---|---|---|---|---|
| 4.1 | Onboarding forms configured on two pages of the contact record | KEEP | Not re-walked (UI). Same surface as 4.2/4.6. | **B9 RECORD PAGE** |
| 4.2 | The contact record is a MODAL, should be a PAGE | KEEP, confirmed | The record is `src/components/app/ContactDossierModal.tsx`. CR-30 ("every record is a page") and CR-75 (expanding row) are the standing rulings — they disagree and the owner has not been re-asked (04-OPEN §4). | **B9** |
| 4.3 / 4.4 / 4.5 | Attribution "saved" persists nothing · "where they came from" neither populates nor saves · card badge disagrees with record | KEEP — needs the trace | `TASK-ORIGIN` shipped `set_contact_origin` (`20260827T0900`) and three writers (`ContactDossierModal`, `ContactsPage`, `Admin.tsx`). The owner saw the failure on 2026-09-01, AFTER that merge. Not reproduced here (needs a staff session). `TASK-ROLE` §2a shape: a save that reports success and writes nothing. | **B9** (trace first) |
| 4.6 | "File under" / "where they came from" belong on the ACCOUNT page only | KEEP | Placement ruling; unbuilt. | **B9** |
| 4.7 | "No display name" | REVISE | Seeding half done and merged (F5). | **B2** |
| 4.8 | An order on her Orders page cannot be opened | KEEP | Dossier Orders tab settles through the union `markOrderPaid` (`ContactDossierModal.tsx:318`, BOOKS1 report §172) but there is no open-order surface (schedule the offerings, set status, adjust date). Overlaps REQCARDS's `OrderPayment` modal home and CR-94 pass 2. | **B6** |
| 4.9 | Bookings tab has no count badge | KEEP, confirmed | `ContactDossierModal.tsx:362` — `['bookings', 'Bookings', null]`; the third slot is the count and it is `null`. One-line. | **B6** (or **B10**) |
| 4.10 | A booking is not clickable | KEEP, confirmed | Bookings-tab rows (`:570-600`) carry no `onClick`/`Link`; the only handlers there are assign and `/app/ops/contracts/new`. Incumbent lesson page: SESSIONBOOK/LESSONFORM. | **B6** |
| 4.11 | Activity page shows useless DB rows; wants login / viewed / signed / web + app interaction capture | REVISE — the page is gone, the requirement moved | `pageRegistry.ts:261` — `community.activity` and oversight **RETIRED 2026-08-31**. His §4.11 spec is click-level, device, location capture = **CR-106's analytics half, word for word.** Fold; do not spec twice (D18). | **B4 SITE** |
| §5.1 | The mail domain | REMOVE | Handoff §4: the domain is fine; the unredeemed invite went to a mistyped address; owner closed it. | — |

# 4 · ROUTED (board) + `RUN-QUEUE.md` OPEN list + old method lists

| # | Item | Verdict | Evidence | Bundle |
|---|---|---|---|---|
| R1 | `reap_expired_holds` carries `anon=X` | KEEP, confirmed | Production: anon=**t**. Body (read from `pg_proc`): one bounded `UPDATE request_selections SET state='lapsed' WHERE …hold_expires_at < now()`. Idempotent, but an unauthenticated write. No GRANT/REVOKE for it exists in any migration — it holds Supabase's default. | **B1** |
| R2 | `isPageHidden` has one call site; nav never reads `org_page_visibility` | KEEP | Only `OpsDashboard.tsx:176,233` calls it; `AppLayout.tsx` mentions the registry only in comments. **Live impact today: none — 0 rows have `hidden_at` set.** Same fact as RUN-QUEUE #8. | **B10 SMALL** |
| R3 | Dossier Orders tab has no discount/comp affordance | REVISE | BOOKS1 report §172: the tab settles via the union `markOrderPaid` and "giving that control a discount/comp affordance remains the one additive edit". Still true; it is CR-94 pass 2. | **B6** |
| R4 | The four other scheduled endpoints never audited | KEEP | `vercel.json` lists 5; `.github/workflows/scheduled-jobs.yml` fires all 5 (hourly / 16:00 / 08:20 UTC). REAPER fixed `expire-holds`; `calendar-reminders`, `delivery-sweep`, `notifications-nudge`, `mint-monthly-allotments` have no audit report. | **B10** |
| R5 | `test/db` per-file triage, decision named per file | KEEP | 78 test files; last measured **56 red** (FIX5, 2026-08-31). Not re-run today. TESTREPAIR revived the contract suites since. | **B12 OWNER** (decisions) then CLNR |
| R6 | (LIFECYCLE) 1-hour reminder fires for an UNAPPROVED session | KEEP | Product question; unchanged. | **B6** (owner line) |
| R7 | (LIFECYCLE) client accepts staff counter-time on an unpaid order → `scheduled`, no payment request | KEEP | `20260901T1640…sql:484-488` comments: the ask-for-money path is staff-only because `request_purchase_payment` is. Not re-proven. | **B6** |
| Q2 | RUN-QUEUE: where an offering status row links to (AR6) | REMOVE | Moot — the activity surfaces were retired (4.11). | — |
| Q3 | RUN-QUEUE: Madeline Do's standing weekly time | REMOVE — DONE | Production: her `clients` row holds **28 future bookings** after 2026-08-31. The duplicate `PUR-000230` was not re-checked (the column name differs from the note). | — |
| Q5 | RUN-QUEUE: every other account's backdated orders / revenue / links | KEEP | Owner's data pass; BOOKS1 (its precondition) merged. | **B12** |
| Q7 | RUN-QUEUE: `AppLayout.tsx` vs `pageRegistry.ts` drift (14 of 25) | KEEP | AppLayout still does not import the registry (comments only, `:511,566,604,618`). CR85 reported the count and was forbidden to deepen it. Its own thread. | **B10** |
| Q9 | RUN-QUEUE: availability inversion blocked because the request path books for free | REVISE | `20260901T1640…sql:215-229` — `book_open_slot` now debits a credit. Whether `request_open_time` → `confirm_booking` debits is not re-traced. Re-measure before citing. | **B6** |
| Q10 | RUN-QUEUE: `offerings.duration_minutes` + D21 editor | KEEP | Read in `ClientRecordActions.tsx` and `StandingSlotPicker.tsx`; **no page under `src/pages` writes it.** | **B10** |
| Q11a | FIX4 leftover: Escape closes input dialogs | REMOVE | MODAL2 shipped and proved "no dialog closes on Escape" (report §1). | — |
| Q11b | FIX4 leftover: `van der Berg` → `Van Der Berg` | KEEP | Show the owner; the rule working as written. | **B12** |
| Q11c | FIX4 leftover: back-control sweep (~18 hand-rolled) | REVISE | Only 1 `navigate(-1)`/`history.back` in `src/` today; the "18" was affordances, not calls. Needs a fresh count before anyone builds. | **B10** (count first) |
| Q11d | FIX4 leftover: `TeamPage` `run()` closes the panel so "Saved." never shows | KEEP, confirmed | `TeamPage.tsx:176-182` comment says exactly this, "beyond this task"; `run()` at `:195` still ends in `onChanged()`. | **B10** |
| M1 | 03-REMAINING §5: `COST_OPTS`/`DUTY_OPTS` hardcoded (`ContractCascade.tsx:1449`) · `lesson_plans` fifth versioning idiom | KEEP | Both in "T3's brief" = ONEEDITOR. | **B8 EDITOR** |
| M2 | 04-OPEN §3: dashboard metric list from the owner's chat thread; inputs audited first | KEEP | Nothing received; CR-107 now frames the same revisit. | **B7 DASHBOARDS** |
| M3 | 04-OPEN §3b: attribution field | REMOVE | Built (TASK-ORIGIN, `client_origin` / `contact_channel`). | — |
| M4 | 04-OPEN §4: CR-30's three questions vs CR-75 | KEEP | Oldest owner question; now the 4.2 decision. | **B9** → **B12** |
| M5 | 03-REMAINING §4: `b9bc9edc` WaitingZones deliberately unmerged; `_waiting_items()` is the right spine | KEEP | `dash_waiting_on_you` / `dash_waiting_on_clients` still live in production (2 rows in `pg_proc`), zero callers. | **B7** |
| M6 | `RUN-QUEUE.md` itself | REMOVE (retire the file) | Its ▶1/▶2/▶4 (CR85, BOOKS1, FIX5) are merged; ▶3 FIX6 is absorbed (§6); ▶5 zone sweeps parked; ▶6 ORCH7 happened. The file now misleads (it misled DSGN-1 once already). | CLNR |

# 5 · OPEN CHANGE ORDERS

| CR | Verdict | Evidence | Bundle |
|---|---|---|---|
| CR-98 | REVISE — steps 1–10 built, 11–14 open | Door: SIGNSTRIP · SIGNDOOR · SIGNBOOK · CR-103 (all merged, verified). **Steps 11–14** (approve → client payment modal → cash/Zelle → mark paid ON the notification) are REQCARDS, unbuilt. A1 answered. `deal` door → INROADS. | **B6** |
| CR-99 | KEEP — unblocked | Spec exists; §9 superseded by A2 (no new card, one inbox, DSNR not needed). Gates merged. | **B6** |
| CR-100 | REMOVE (in flight) | A/B merged; G running. | — |
| CR-101 (+A1) | REMOVE (in flight) | A merged; H running. | — |
| CR-102 | REMOVE | C merged and verified; `SignChoose.tsx` carries `flow-green` (2 hits) — the "SignChoose missed" note is closed. | — |
| CR-103 · CR-104 · CR-105 | REMOVE | Built / promoted, filed by ORCH8. One observation on CR-104 for the next real submission: **0 of 18 `requests` rows carry `interests`**; only 2 rows are from the last 7 days and both may predate the field. Not a finding; a D39 watch. | — |
| CR-106 | KEEP — FRONT | See 1.4. Absorbs Casey 4.11 (interaction capture), CR-115's audit half and input list, SITEPOLICY's `/visit` `/contact` indexability, CR-88's measurement side (attribution exists — D18). Consent (CA) is a ruling to prepare. Fable · DSNR profile. | **B4** |
| CR-107 | KEEP | `DashboardView = 'trainer' \| 'business'` (`registry.ts:35`); no accessibility selector; `DASHBOARDS-GROUND-UP-PLAN.md` exists; FIX6 never ran. Absorbs FIX6, DASHFEED, HOMESHAPES, M2, M5. Fable · DSNR profile. | **B7** |
| CR-108 | REVISE | `usePropertyTerm` renders "ranch". The copy sweep is now the BANNEDWORDS audit's output, not RANCHWORD-A. | via BANNEDWORDS |
| CR-109 + CR-112 (+A1) | KEEP | Owner's full design answers are in the ledger (CR-112 A1). Machinery empty (1.11). CR-86 gap 3 (monthly cost sheet) is **redefined** by A1 #14: boarding fee on the horse record, tackroom rent and fixed costs auto-injected on the 1st — no separate "sheet" task. Zone sweep A12's "per-event cost ledger ruled out" is superseded by A1's dated usage entries. Fable · DSNR profile. | **B5** |
| CR-110 | KEEP | 1.20. | **B5** |
| CR-111 (+A1) | KEEP the follow-on | BANNEDWORDS audit running (tree unknown, 1.3). After it: the owner's ruling pass, then a Sonnet sweep. "My Stable" approved. | after audit |
| CR-113 | KEEP | `ProfileAndPreferences.tsx` has no email/digest/reminder preference (grep: zero hits for email, digest, notif). Scheduler exists (GitHub Actions hourly). Pairs with the deliverability gap (§2 §4). | **B11 NOTIFY** |
| CR-114 | KEEP | DISCO-profile audit of every main→sub-page navigation; unstarted. Cheap; Sonnet/Opus. | **B10** |
| CR-115 | KEEP, split | Verified: `/about` is linked only from `Confirmation.tsx:214`; `Faq.tsx:6` and `Story.tsx:17-20,130,226` self-describe as placeholder; `/visit` + `/contact` `indexable:false`. (a) routes-in-service + About on the revisit list → **B4**; (b) inputs ASAP → owner, **B12**. | **B4** / **B12** |
| CR-86 gap 1 | KEEP | Owner's data pass (services delivered, never recorded). | **B12** |
| CR-86 gap 3 | REVISE | Folded into SUPPLIES (see CR-109 row). No `monthly_cost`/`cost_sheet` table exists (grep). | **B5** |
| CR-88 | KEEP, blocked | Campaign budget + expense-category answers still owed. Measurement side exists (ORIGIN). | **B12** → later |
| CR-90 | KEEP — MONTHEND dispatchable | LIFECYCLE merged (its gate). MONTHEND spec exists (208 lines, unbuilt). ⚠️ **Precondition finding (§7.3): production holds ZERO bookings in `pending`** although LIFECYCLE's report §3 shows a run creating 4. Establish why before MONTHEND's "flip the pending month" has anything to flip. | **B6** |
| CR-94 passes | REVISE | 1 BOOKS1 ✅ · 2 settle-from-dossier: partly (R3 open) · 3 rolling schedule: LIFECYCLE ✅ (but §7.3) · 4 month-end: MONTHEND open · 5 backfill surfaces: BACKDATE ✅ · 6 calendar triage (CR-02/04/07 + the widened DO list): open, unspecced. | **B6** (2, 4, 6) |
| CR-97 · CR-89 · CR-93 · CR-39/40 | REMOVE | LIFECYCLE · BOOKS1 · MODAL2 · BOOKS1 (disposition). Ledger headers not updated — see §9. | — |
| CR-30 (three questions) · CR-75 | KEEP | M4. | **B9** |

# 6 · UNBUILT FILES IN `docs/tasks/` (33 with no `-REPORT.md`, plus the ones the board names)

| File | Verdict | Evidence | Bundle |
|---|---|---|---|
| ADMINSWEEP | REMOVE as a task | `TASK-ADMINSWEEP-PHASE1.md` / `-PHASE2.md` reports exist; merged 2026-08-11. Its "full admin refactor" goal lives in `docs/design/refactor/*` and CR-110. | **B5** carries the refactor seam |
| ATTRIB | REMOVE | Merged into ORIGIN (built). | — |
| BOOKFLOW-PENDING | REMOVE (archive) | Placeholder, detail never sent; the area was walked by WALK1–4 and rebuilt by LIFECYCLE. | — |
| CONTRACTMENUS | KEEP, revise | `contract_field_defs` appears in no `src/pages` file; `AdminMenusPage.tsx` does not carry it. 03-REMAINING: rules stand, §4 shape superseded. | **B8** |
| DASHBOARDS (plan) | REVISE | Phase 1 built (DASHBOARDBUILD); the multi-dashboard half is CR-107. | **B7** |
| DASHFEED | KEEP, fold | Blocked on the three owner questions (04-OPEN); same revisit as CR-107. | **B7** |
| DAYSHEET | REVISE — mostly built | `api/calendar-reminders.ts` sends the 07:00 Pacific day sheet to the ops inbox; dispositions `completed/cancelled/expired/no_show` live (`20260901T1720…sql:41,131`); `TrainerZones.tsx:64` carries "next up". Residual, if any, is Claire's static advancing day view. 1,327 lines of stale working notes — archive after a residual check. | **B7** (residual) |
| DEPENDENT | KEEP | `purchases`/`bookings` still have no payer/guardian column (grep). First real minor is on production. | **B2** |
| FIX6 | REVISE — absorbed | Its Ops/Sales toggle text is CR-107's requirement; do not run it as written. | **B7** |
| FLAGHARVEST | REMOVE (archive) | HARVESTCLOSE closed it (975 → 535 on DECIDE). | — |
| FUNNELDOORS | REVISE | `/release` retired (SIGNFLOW-D). `/sign` → `SignChoose` exists, but **no file outside `SignStart.tsx` links to `/sign`** — the public site still has no door to it. | **B3** / **B4** |
| HOMESHAPES | KEEP as design input | Member home is `AppOverviewModal` only; no zones by account shape. | **B7** |
| HORSEONE | REMOVE | `App.tsx:375-382` — both old horse routes redirect to `/app/records/horses`. | — |
| INVITELINK | REMOVE | `api/contract-invite.ts:110-138` now checks for an account by contact and by email and issues an account claim vs a contract link (P1 item 1). | — |
| LEASEGATE + LEASEGATE-Q1 | REVISE, hold | Phase 1 report exists; Q1 answered; Phase 2 never built; R4 would break the live no-insurance arrangement; the signing freeze + live Pamela lease stand. Re-spec against the lease trio v3 only when the owner reopens it. | **B12** (decision) |
| MONTHEND | KEEP — dispatchable | See CR-90. Opus build. | **B6** |
| NAVHOVER | REMOVE | Stood down 2026-08-10; fixed on `task/uireview` (UIO-003). | — |
| OFFERINGDOCS | REVISE | Handoff/ruling doc; ONERAIL is its verification. | **B3** |
| ONEEDITOR | KEEP | `contract_template_versions.parent_version` exists (`20260826T1910`); forms/pages have no lineage. T3. | **B8** |
| ONEPEOPLE · THREEFORMS · RIDERQUALIFY · RANCHWORD-A | REMOVE | Retired / superseded / "nothing to be built" / withdrawn (CR-111). | — |
| ONERAIL | KEEP | 1.6. | **B3** first |
| ONETEAM | KEEP | Both `ops/TeamPage.tsx` and `ops/employees/StaffPage.tsx` still exist; AR5 left D20 Staff/Team unresolved. Sonnet, bounded. | **B10** |
| P1SHIP | REMOVE | `P1-CONTRACT-SHIP-REPORT.md`; all three blockers resolved 2026-08-25. | — |
| PARTYJOURNEY | REVISE | PARTYEMAIL, INVITELINK (built), COSIGN cover most of it; re-spec only from INROADS gaps. | **B3** |
| RECORDSELECT | KEEP, confirmed | `DataTable.tsx` still has no `selectable` / `selectedIds` / `onSelectionChange`. Documents tab remains the only pattern. | **B10** |
| REQCARDS | KEEP | 1.24. | **B6** |
| UIBUILD · UIREVIEW · `docs/ui-orders/` (15 READY, 1 CLOSED, 1 SHIPPED, all 2026-08-10) | REVISE → close-out | The working mode died with the UIREVIEW rewrite incident; ONEHEADER, FIX3, CR85, MODAL2, FRAMESCROLL have since rebuilt the header, nav and modals. One CLNR pass closes each UIO with evidence, then archive. | CLNR |
| ZONE-SWEEPS A1–A12 | REVISE, parked | Drafted before FIX1–4; A12's premise is superseded by CR-112 A1. Re-scope after SUPPLIES; not a batch. | parked |

# 7 · NEW FINDINGS FROM THIS PASS (not on any list before today)

1. ⚠️ **`request_purchase_payment` is anon-executable in production** — `has_function_privilege('anon')` = **t**, although `20260823T0140_creditgrant_5…sql:123-124` did `REVOKE … FROM PUBLIC; GRANT … TO authenticated`. The body opens with `IF NOT has_staff_access() THEN RAISE`, so the guard holds, but the ACL contradicts its own migration — the DROP+CREATE / default-privilege re-grant trap (`docs` memory: "REVOKE FROM PUBLIC is not enough"). Joins R1 and F7 in **B1**; the same query should sweep every SECURITY DEFINER writer, not these three.
2. ⚠️ **F3's fix is constrained out:** the `status_events.entity_type` CHECK does not allow `'booking'` (§2 F3). Any writer fix without the constraint change raises on the first booking.
3. ⚠️ **Zero `pending` bookings exist in production** (all rows, `deleted_at IS NULL`: `available` 626 · `scheduled` 118 · `completed` 1; future rows also include `cancelled` 3). LIFECYCLE's report §3 shows `{"months": 2, "created": 9, "pending": 4}`. Either those rows were flipped/removed afterwards or the proof ran in a rolled-back rehearsal. **LIFECYCLE checklist §8 item 6 ("next month renders pending/orange") cannot pass today, and MONTHEND has nothing to flip.** Measure before dispatching **B6**.
4. **Batch-2 tree deviation** (1.3): SIGNFLOW-G worked in `wt-1`, the tree the board gave BANNEDWORDS.
5. `BOARD.md` RESUME is five commits stale and still lists the SITESEO curls as owed (1.1, 1.2).
6. `D42` is not in `CLAUDE.md` (D41 → D43); it is cited in the SIGNFLOW-D ledger/report. Either a numbering gap or a rule that never got promoted — CLNR to settle.

# 8 · BUNDLES BY SHARED CONTEXT — for ORCH (disjoint bundles can go to MGMT copies)

| Bundle | Contents (by row id above) | Shared context | Tier (per `MODEL-CHOICE-NOTES` §2026-09-03) |
|---|---|---|---|
| **B1 GRANTS + STALE** | R1 · F7 · §7.1 · 1.17 · 1.13 · 1.14 · 1.19 · 1.15 · §7.6 · ledger-status headers (§9) | one `pg_proc` ACL sweep + prose edits; no feature files | Sonnet · MEDIUM (one migration, explicit roles, no DROP) |
| **B2 FUNNELDEBT** | F1 · F2 · F3 (+§7.2) · F4 · F5 · F6 · 3.2a · 4.7 · DEPENDENT | the request→activation→booking spine and the minor/guardian spine | **Fable · HIGH** (DSNR profile) |
| **B3 INROADS** | 1.6 ONERAIL (runs first, VRFY/DISCO) · 1.9 · 1.21 · 3.2b (`deal`) · FUNNELDOORS door · OFFERINGDOCS · PARTYJOURNEY residue | `SignStart.tsx` `deal`, `provision_client_invitation`, `apply_category_documents` | **Fable · HIGH** (research, no removal) |
| **B4 SITE (FRONT)** | 1.4 CR-106 · 4.11 · CR-115(a) · 1.8 SITEPOLICY · `/visit` `/contact` indexability · FUNNELDOORS' public door | public routes, `seo.ts`, analytics architecture, consent | **Fable · HIGH** (architecture) → Opus builds |
| **B5 SUPPLIES** | CR-109 · CR-112 (+A1) · 1.11 residue · 1.20 CR-110 · CR-86 gap 3 · A12 conflict · module/door naming (banned "Barn") | My Stable / Account access point / barnops machinery / horse record | **Fable · HIGH** (DSNR profile) |
| **B6 REQUESTS + MONTH** | 1.24 REQCARDS (§9 struck) · CR-98 11–14 · CR-99 · MONTHEND (CR-90) · §7.3 pending check · 4.8 · 4.9 · 4.10 · R3 · R6 · R7 · Q9 · CR-94 passes 2/4/6 | the six-state machine, `request_purchase_payment`, dossier Orders/Bookings tabs, dashboard inbox | Opus · HIGH · thinking ON (shape is ruled) — after §7.3 is measured |
| **B7 DASHBOARDS** | CR-107 · FIX6 · DASHFEED · HOMESHAPES · DAYSHEET residual · M2 · M5 (`_waiting_items` spine) · DASHBOARDS plan | `src/lib/dashboard/registry.ts`, zones, the two live DB waiting functions | **Fable · HIGH** (revisit) |
| **B8 EDITOR** | ONEEDITOR · CONTRACTMENUS · M1 (`COST_OPTS`, `lesson_plans` idiom) · lookup_options allowlists | version spine, menus editor | Opus · HIGH — after B5/B6; contract freeze applies |
| **B9 RECORD PAGE** | 4.1 · 4.2 · 4.6 · 4.3–4.5 (trace first) · M4 (CR-30 vs CR-75) | `ContactDossierModal.tsx`, the account page, `set_contact_origin` | owner decision (M4) → Opus build |
| **B10 SMALL, UNCONTENDED** | R2 + Q7 (nav ⇄ registry) · R4 (4 endpoints audit) · Q10 (`duration_minutes` editor) · Q11c count · Q11d TeamPage · RECORDSELECT · ONETEAM · CR-114 audit · F5's one RPC if not in B2 | each is one file or one audit; none shares a file with B1–B9 except `AppLayout.tsx` (R2/Q7 — keep those two together) | Sonnet/Opus · MEDIUM, one thread each |
| **B11 NOTIFY** | CR-113 · deliverability webhook | preferences + transport | design (Opus) → build |
| **B12 OWNER** | checklists (FIX1 §8 · FIX2 §9 · FIX4 §11 · CR85 §8 · MODAL2 · BACKDATE §8 · BOOKS1 §14 · LIFECYCLE §8 (see §7.3) · SIGNDOOR box count) · 1.18 · 1.23 · CR-115(b) inputs · CR-88 answers · CR-86 gap 1 + Q5 data pass · Q11b · R5 decisions · LEASEGATE reopen? · M4 | none blocks a thread; all block a verdict | — |
| **Held** | CLNR-REPO-STATE (+ M6 `RUN-QUEUE.md` retirement, UI-orders close-out, §7.6) · ZONE-SWEEPS · test/db triage | moves files / needs no build mid-flight | CLNR |

**Sequencing notes for ORCH:** B1 and B10 are disjoint from every design bundle and can run now
beside G/H. B6 waits only on the §7.3 measurement (one query). B3's ONERAIL read should precede the
rest of B3. B4 is the owner's stated priority and needs his input list to finish, not to start.
B5 and B7 share nothing with each other; B5 and B8 both touch editors only at the far end.

# 9 · OUT OF SCOPE HERE, SAID PLAINLY

- **CR-01…CR-85 status headers** were not re-derived one by one. Their `captured/researched/locked`
  headers were never updated after builds (CR-85, CR-89, CR-93, CR-97 all read as open at the header
  and are built). A CLNR ledger-status pass, header-only, belongs in **B1**'s docs half.
- **Task files WITH a report** were not re-audited for partial delivery (DOCQUEUE, CONTRACTORPHAN's
  unapplied migration, etc.); the flag harvest already carries those on DECIDE.
- **No UI was walked** (no staff/member session in this tree, by rule). Casey 4.1, 4.3–4.5 and the
  owner checklists therefore stay "reported, not reproduced".
- **`test:db` was not run.** The 56/78 figure is FIX5's from 2026-08-31.
