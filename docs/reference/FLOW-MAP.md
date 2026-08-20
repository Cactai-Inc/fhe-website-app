# FLOW-MAP — every flow the app facilitates, and where each one stops

**Traced at main `c56559e` (2026-08-20) against production `lrstswfxfsezdmvkvukc`
(read-only). Owner's ask: HANDOFF-ORCH3 §3 step 2.** The surface layer is
`SURFACE-INVENTORY.md` (where a person can GO); this map is what must HAPPEN, in
sequence, and where the sequence stops. Sequences live in `docs/reference/flows/*.md`
(identical record format); this file is the register, the actors, the area crossings,
and the cross-flow findings.

**Status key** — `WORKS`: every step has a proven call site and the terminal state has
been reached (by a real user or a committed/rolled-back walk). `PARTIAL`: some steps
proven, at least one broken. `BREAKS`: a proven stop. `UNPROVEN`: the chain is wired in
code but its effect has never been demonstrated (almost always: a real email send, a
cron run, or a browser render).

---

## 1. The flow register

| ID | flow | initiating actor | entry surface (inventory row) | terminal state (as data) | status |
|---|---|---|---|---|---|
| F1 | Admin-provisioned client onboarding | staff | Records→Clients / lead drawer / dossier / `/app/ops/accounts/new` (§3) | invitation redeemed · wall {false,0} · categories derived | **PARTIAL** — spine works (walk16 e2e); payment card still single-SKU; emails unproven |
| F2 | Self-onboarding funnel (kiosk gen-2) | visitor | `/sign`, `/sign/:path` (§1, URL-ONLY) | same as F1 + signup_attempts row | **BREAKS** — zero inbound links; zero staff visibility on success; 0 uses ever |
| F3 | Visit-day release kiosk + participant flow | visitor | `/release`, `/docs/release-participant` (§1, URL-ONLY) | executed release + delivery row (+ kiosk request, participant only) | **PARTIAL** — signing+delivery work (35 delivery rows); `/release` alerts nobody |
| F4 | Public booking request (funnels) | visitor | `/lessons` `/horse` `/acquisition` `/contact` `/gift` (§1, Header/Footer NAV) | request `converted` with stamped invitation | **PARTIAL** — spine works; 2 proven sends ever; mixed-cart filing open |
| F5 | Authenticated session booking | member | `/app/calendar` (§2, NAV) | booking `completed` + credit + unit consumed | **PARTIAL** — pending→confirm works; **0 completions ever**; refusal = silent DELETE |
| F6 | Recurring plans (care plans) | member/staff | CalendarItemPanel (via `/app/calendar`) | monthly credits minted · bookings on chosen days | **PARTIAL** — generator proven (walk21); month-roll dead while every order is unpaid |
| F7 | Lease contract | staff | `/app/ops/contracts/new` (§3, LINK-ONLY) | document EXECUTED + envelope executed + horse moved | **PARTIAL** — server-proven e2e (walk16); anon `record_signature` door; termination never frees the horse; 0 real leases |
| F8 | Sale / deal envelope | staff | DealsPage / Records Deals tab (§3) | deal `complete` | **UNPROVEN** — 0 deals ever; wiring walk-proven |
| F9 | Counterparty invitation | staff or visitor | contract page / `/sign/deal` | counterparty signs from their own account | **UNPROVEN** — server halves proven; render/email not |
| F10 | Purchase & payment | member/staff | `/app/catalog`→`/app/checkout` (§2); `/order/:id` | purchase `paid` + receipt_sends row | **BREAKS (by disuse)** — all four doors wired, one spine; 4 purchases all unpaid, 0 keys, 0 receipts ever |
| F11 | Evaluation report delivery | staff | `/app/ops/evaluations` (§3, NAV) | report delivered · unit consumed | **UNPROVEN** — 0 reports ever |
| F12 | Gift purchase & redemption | visitor | `/gift`, `/redeem` (§1) | gift redeemed + auto-account | **UNPROVEN** — 0 gifts ever |
| F13 | Fulfilment mint | system | (trigger-only; no surface) | units + credits minted | **WORKS** — proven by prod rows + walks |
| F14 | Fulfilment consumption | staff/system | SessionsPage / evaluations / execution | unit `consumed` + status event | **BREAKS** — 0 consumed ever; ledger invisible to every human; sign_release path skips execution triggers |
| F15 | Document delivery & re-delivery | system/staff/member | pg_net / DeliveryPanel / My Documents | document_deliveries row per party | **PARTIAL** — kiosk path proven (35 rows); contract-engine path + sweep unproven |
| F16 | Lead→client conversion & Records | staff | `/app/records/:tab` (§2, NAV) | contact promoted, request converted | **WORKS** (server-proven; renders unverified) |
| F17 | Horse intake & records | member/staff | `/app/horse-intake`; Records Horses | horse row with current relationships | **PARTIAL** — works; terminated leases never release the horse; `/horse-care` dead link |
| F18 | Account & profile self-service | member | `/app/account` (§2, NAV) | profile current; support request worked | **UNPROVEN** on email halves; rest works |
| F19 | Team & staff management | admin | Settings→Team (§3 via cards) | staff account + grants | **WORKS** (raw-write lane, D19-poor) |
| F20 | Notifications & alerts | system | (bell / digest / reminder crons) | notification_log outcome rows | **BREAKS** — 46 live rows, 0 ever emailed; no cron effect ever observed |

## 2. The actor register

**Humans** (identity taxonomy: lead → account → contact; client/customer/visitor —
owner-authoritative 2026-08-02):

| actor | participates in |
|---|---|
| visitor (anonymous) | F2 F3 F4 F12 (+F9 via `/sign/deal`) |
| lead | F4 → F16 → F1 |
| guest (kiosk category) | F2 F3 |
| customer/client/member | F1 F5 F6 F10 F11 F12 F15 F17 F18 |
| parent/guardian | F1 variant (minor: no-email guard, guardian-addressed delivery) |
| party/counterparty | F7 F8 F9 F15 |
| vendor | F16 (Records Vendors tab only — no flow of its own; a finding of absence) |
| instructor (non-admin staff) | F5 F14 (InstructorHome — URL-ONLY, inventory calibration #1) |
| staff/admin | initiates F1 F7 F8 F11 F16–F19; confirms F5; settles F10 |
| platform owner (superadmin) | tenant provisioning (`admin-provision-tenant` — outside these 20, single-run) |

**System actors:**

| actor | called by | calls back / effect | on failure | effect ever demonstrated? |
|---|---|---|---|---|
| Supabase auth | F1 F2 F9 F12 F18 | account create/link (server-side `email_confirm:true` endpoints) | endpoint 4xx, invitation survives | YES (real accounts exist) |
| Stripe | F10 (`stripe-create-session`) | `stripe-webhook` → paid+confirmed | webhook absent → order stays unpaid | **NO** |
| Zelle poller (Apps Script, out of repo) | inbound mail | `zelle-reconcile` → match or review+alert | review alerts staff (ZELLECLOSE) | **NO** — and cannot match: 0 keys ever |
| mail edge (`_lib/email.ts`, 20+ endpoints) | F1–F4, F7, F9–F12, F15, F18, F20 | provider send + a send-log row per attempt | best-effort 200s; logged since INBOUNDALERT | **TWICE** (2 `request_alert_sends`, both staff-kind) — the only proven sends in history |
| cron `/api/notifications-nudge` (daily 16:00 UTC) | Vercel | digest email, `emailed_at` stamp | silent | **NO** — 46 unread, 0 stamped, ever |
| cron `/api/expire-holds` (hourly) | Vercel | lapse holds, release slots, email client | silent | **NO** — no holds have existed |
| cron `/api/calendar-reminders` (hourly) | Vercel | 1h/2h reminders + booking emails | silent | **NO** — no reminder rows found |
| cron `/api/delivery-sweep` (hourly) | Vercel | re-raise silent delivery failures | silent | **NO** — nothing to sweep yet |
| cron `/api/mint-monthly-allotments` (daily 08:20 UTC) | Vercel | month-roll mint (paid-gated) | idempotent self-heal | **NO** — structurally impossible while 0 orders are paid |
| Google Maps | footer/contact embeds | render only | render gap | n/a (visual) |
| pg_net (DB→HTTP) | F7 execution, F18 support | `deliver-documents` / `support-received` | sweep catches doc failures; support silent | **NO** for contracts; support: 0 requests ever |

**Every one of the 5 crons appears in at least one flow above (F20, F10, F5, F15, F6
respectively) — and not one of the five has an observed effect in production.** That is
finding X1, not a config note.

## 3. The areas each flow crosses (the seams the refactor thread needs)

Area taxonomy as it exists (AppLayout nav groups + pageRegistry; not invented):
**PUB** public site · **MEM** member app (ClientNavItems + App-pages) · **MGMT**
Management (Dashboard/Records/Support/Payment review) · **COMM** Community group ·
**MOD** Modules (Boarding/Barn Ops/Employees/Lessons) · **SET** Settings ·
**PLAT** platform · **EDGE** `api/` (no nav; an area in fact if not in name).

| flow | areas | the seam, named |
|---|---|---|
| F1 | MGMT → EDGE → PUB(`/activate`) → MEM(onboarding/documents/horse-intake) | **4 areas.** The provisioning act lives in MGMT but its consequence surface is MEM; the handoff artifact is one emailed token. The seam is `provision_client_invitation` — everything before it is MGMT, everything after is MEM. Clean seam, correctly placed. |
| F2/F3 | PUB → EDGE → (MEM) | Kiosk is PUB-only by design; the seam to MGMT **does not exist** (no alert, no request) — that missing seam IS the defect. |
| F4 | PUB → EDGE → MGMT(Leads) | The seam is the `requests` row. Clean. |
| F5 | MEM(Calendar) ↔ MGMT/MOD(SessionsPage, same calendar) | **The booking queue has no area of its own** — staff confirm inside the member-shaped calendar, and the lessons module double-mounts the same bookings as "Sessions". Two presentations of one table, no seam: this is the flow telling us the Booking area is missing, not that the flow is wrong. |
| F6 | MEM purchase → MOD(CalendarItemPanel staff controls) → EDGE(cron) | Seam = `purchase_items.config` (the plan's days). Fine. |
| F7–F9 | MGMT(compose) → MEM(`/app/contracts/:id` dual-view) → EDGE(delivery) | The contract page is deliberately BOTH areas at once (dual view, two hats) — the one place area-crossing is a designed feature, per DUAL_IDENTITY_TRACE. Leave it. |
| F10 | MEM(catalog/checkout/order) → EDGE(4 payment doors) → MGMT(payment review) | Seam = `mark_purchase_paid`, and it holds — every door converges. The AREA that's missing is a buyer-visible payment state; today it's split across OrderDetail/OrderPayment/Onboarding's card. |
| F11 | COMM(staff) → MEM(evaluations) → EDGE | Evaluations sit in the *Community* nav group but are a fulfilment/commerce flow — **wrong area by taxonomy**, worth the refactor thread's attention. |
| F12 | PUB → EDGE → MEM | Clean, mirrors F1. |
| F13–F14 | (no area) | **The fulfilment spine crosses zero areas because it surfaces in none.** The refactor's area spec must give the obligations ledger a home (MGMT is the natural one) — this is the largest structural absence in the map. |
| F15 | EDGE ↔ MGMT(DeliveryPanel) ↔ MEM(My Documents) | Fine. |
| F16–F17 | MGMT (+MEM intake) | The Records consolidation already did this seam's work. |
| F18 | MEM → EDGE | Fine. |
| F19 | SET → EDGE | Fine. |
| F20 | every area | Notifications are the one true cross-cutting layer; the missing piece is a read-back surface (only ActivityPage and the contract card read any log). |

## 4. Cross-flow findings (the expensive ones)

- **X1 — No cron has ever demonstrably run.** Five schedules, five flows depending on
  them (F5 F6 F10 F15 F20), zero observed effects: 0 `emailed_at`, 0 reminders, 0
  sweeps, 0 month-rolls, 0 hold-lapses. Every flow's email/monthly tail is therefore
  UNPROVEN *at best*. One Vercel cron log check would settle all five at once — it needs
  the owner's dashboard, not a browser.
- **X2 — The unpaid-everything deadlock.** All 4 purchases in history are unpaid with
  NULL payment keys. Paid-gates then freeze: month-roll mints nothing (F6), Zelle
  matching can match nothing (F10), receipts never fire, `confirm_booking_for_purchase`
  never runs. The payment tail is the single highest-leverage unproven chain in the app.
- **X3 — Write-only ledgers (D19 corollary, owner's sharpest complaint).** Five send/audit
  logs exist (`request_alert_sends`, `receipt_sends`, `signup_alert_sends`,
  `notification_log`, `document_deliveries`) plus `fulfillment_units` and
  `status_events`; **exactly one surface reads any of them back** (ActivityPage; plus the
  contract Activity card since CLOSEOUT §1.8). "What is she seeing, what emails is she
  getting" has a table answering it and no screen asking.
- **X4 — Two execution paths, one armed.** All execution side-effects hang on
  `AFTER UPDATE OF workflow_state`; `record_signature` names the column (triggers fire),
  `sign_release` does not (they silently skip — no audit snapshot for any kiosk-signed
  document, and a latent trap for any future status-only executor). Detail:
  fulfilment.md F14-BREAKS-2.
- **X5 — Silent refusal.** The only refusal mechanism for a member booking is
  `delete_calendar_item` — an unnotified hard DELETE (with credit refund). Every other
  flow that says no (locks, gates, claims) says so out loud; bookings alone vanish.
- **X6 — No tenant timezone** (LESSONREQUEST F1, standing): 12 live functions render UTC
  into human-facing text across F5/F6/F7 notifications.
- **X7 — The unreachable front doors.** Three fully-built entrances have no inbound
  link: `/sign/*` (F2), `/app/ops` (staff home), `/app/gifts` (member gifts). Same
  defect class as REACHAUDIT's orphans, confirmed at the flow level: correct code
  nothing reaches.
- **X8 — Status vocabulary drift** on `invitations` (`accepted` in prod vs `redeemed` in
  writers' vocabulary — onboarding.md F1-BREAKS-6); same class as the booking
  `entity_type='offering'` mislabel (F5-BREAKS-3). Auditability rots quietly where
  writers and readers disagree on words.

## 5. Where this map disagrees with an incumbent

- **FLOWTRACE items 5, 7, 10, 12 are FIXED since** (PAYLOCK re-key, credit picker,
  `status='pending'`, unit_count mint) — proven from prod function bodies this trace;
  do not re-cite them as live defects.
- **CONTRACTWALK A1/A2/A3 are CLOSED by CLOSEOUT §1.1/§1.6** (one gate; checkbox truth) —
  its "deal_autocomplete trapped" claim is superseded by `20260819T0140` (see
  fulfilment.md F14 step 3).
- **RETEST-CHECKLIST remains the ordering authority** — no disagreement found between its
  40-step order and these sequences.
- **SURFACE-INVENTORY** — one extension, not a contradiction: its `/release` D19 row
  says `records-reference:Y`; at the FLOW level the reference reaches no staff surface
  (F3-BREAKS-1).
