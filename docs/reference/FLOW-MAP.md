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
| F3 | Visit-day release kiosk + participant flow | visitor | `/release`, `/docs/release-participant` (§1, URL-ONLY) | executed release + delivery row (+ kiosk request, participant only) | **PARTIAL** — signing+delivery work (35 delivery rows); `/release` alerts nobody; guest set lives at `/sign/guest`, not here — see X9 |
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

---

## X9 — WITHDRAWN AND REPLACED: the guest flow IS built, at `/sign/guest` (2026-08-20)

⚠️ **The orchestrator's first version of this finding said the guest three-document flow did not
exist. That was WRONG and is withdrawn.** It was reasoned from production emptiness — no contact
holds the guest set — which is the exact error this project keeps making: **concluding a feature is
unbuilt because nothing has used it.** The owner's description of his intended design turned out to
describe machinery that already ships.

**What is actually built — the tenth instance of correct, unreachable code.**

`/sign` (`SignChoose.tsx`) offers five named paths, each with its own title and audience, and
`/sign/:path` (`SignStart.tsx`) collects the person's details and provisions them:

| URL | page title | categories → documents |
|---|---|---|
| `/sign/guest` | *"I'm coming to visit"* | GUEST → **COMPANY_POLICIES · FACILITY_RULES · RELEASE_GENERAL** |
| `/sign/rider` | *"I'm here to ride"* | RIDER → + HUMAN_EMERGENCY_MEDICAL · RELEASE_PARTICIPANT |
| `/sign/horse` | *"My horse needs care"* | HORSE_OWNER → + HORSE_EMERGENCY_VET · RELEASE_HORSE_CARE · RELEASE_PARTICIPANT |
| `/sign/rider+horse` | *"I'm here to ride, and I have my own horse"* | RIDER + HORSE_OWNER (union) |
| `/sign/deal` | *"I have a contract with you to sign"* | **claims** an existing contract by email match; provisions nothing |

**The guest set is exactly the owner's three documents**, configured as data in
`category_document_requirements` (prod, verified 2026-08-20) — not hardcoded, and therefore
D13-editable.

**A case-mismatch trap that is NOT a bug:** `api/sign-start.ts` passes `GUEST`/`RIDER`/`HORSE_OWNER`
while the table stores `Guest`/`Rider`/`Horse owner`. `apply_category_documents` normalises **both
sides** (`upper(replace(btrim(...), ' ', '_'))`, its own comment "1c: one canonical form on BOTH
sides"). Checked because a silent no-op here would assign zero documents — it does not.

**So the real defect is unchanged and is the one that matters: nobody can find it.**
Zero inbound links anywhere in `src/`, **zero `signup_attempts` rows ever**, and no staff alert on
completion. It works and has never once been used.

**What `/release` is, for the avoidance of the confusion that produced the wrong finding:** a
**single-document** walk-in kiosk (`Release.tsx:110`, defaults to `RELEASE_GENERAL`) that shows the
rules as an acknowledgment checkbox rather than executing them, and alerts nobody. It is not the
guest flow and should not be made into one.

---

## F9-TARGET — THE EMAIL-ONLY CONTRACT PARTY (owner-articulated, 2026-08-20)

> **Owner:** *"we can assign a party an email address and then text them the link… after they fill
> in the form with the information about themselves that a contract requires and their email
> address, they get an email with an activation link and they click that to set their login and
> upon completion they enter into an authenticated session with the contract being the first thing
> they see."*

**This is the target state for F9. Four of its six steps already ship.** Verified against prod and
source at `48b5e21`, 2026-08-20.

| # | the owner's step | state | evidence |
|---|---|---|---|
| 1 | **assign a party an email address** | ⚠️ **GAP** | `document_parties.contact_id` is **NOT NULL** and the table has **no email column**; `invite_contract_counterparty(doc, contact_id, email)` **refuses** unless that contact is already a party (*"contact % is not a party on this contract"*). There is no add-a-party-by-email path. |
| 2 | text them the link | ✅ | `/sign/deal` (`SignChoose.tsx:74`) matches the visitor's email against parties with no account. **44 such parties exist in prod.** |
| 3 | they fill in the form with what the contract requires about them | ✅ **BY DESIGN — not a gap** | `SignStart.tsx:275-279` collects first · last · phone · email · confirm-email, and **that is the complete requirement.** See the owner ruling below. |
| 4 | they get an activation email | ✅ | `invite_contract_counterparty` mints a `CONTRACT` invitation, 14-day expiry, carrying `document_id`. |
| 5 | they click it and set their login | ✅ | `/activate` → `Register` (`App.tsx:155`). |
| 6 | **they land in an authenticated session with the contract first** | ✅ **already built** | `RegisterComplete.tsx:83-87` — `if (stash.kind === 'contract')` → `redeemContractInvitation(token)` → `dest = /app/contracts/${documentId}`, commented *"land ON the contract"*. |

### The architecture, as the owner states it (2026-08-20)

> *"the contract template only supplies the email address, everything else is derived from the
> contact record, which the onboarding flow enters the data into. when a person already in the
> contact records system is selected, all of the information is pulled from the record into the
> contract fields for the party."*

**The contact record is the single source of truth for party data; the contract holds only the
email and derives the rest.** The derivation engine already exists and is correct:
`fill_party_fields_from_contacts(p_document_id)` → `remerge_contract_from_clauses(p_document_id)`,
and `captureContactInfo()` (`src/lib/contracts.ts:680-698`) already runs the full
update-contact → fill → remerge sequence.

### The two gaps, precisely

**GAP 1 — an email-only party is not representable, but nothing structural forbids it.**
`contacts` requires **no name** (`first_name` is nullable and the table already carries a
`name_needs_confirmation` flag built for exactly this shape). So the missing piece is not schema —
it is **a stub-contact-from-email step** plus the surface that invokes it. Today: 0 contacts have an
email and no name, so the shape has never been used.

**NOT A GAP — the minimum IS the design (owner, 2026-08-20).** The orchestrator first recorded the
four-field form as a defect, reasoning from the kiosk's richer `sign_release` field list. **Withdrawn.**

> **Owner:** *"those are the only things we need to collect for the deal flow. thats the point of
> using a deal flow and the point of using a generative onboarding flow is that we can expand it
> without penalty, and since its being authored to only require the minimum which you just listed."*

**The division of labour is deliberate and it is the architecture:**
- **The form's only job is to produce an account.** Name, phone, email. Nothing else.
- **The contract is where contract fields are filled**, by the party, inside the authenticated
  session — F9 step 6 lands them there precisely so this can happen.
- **Deal templates are AUTHORED to require only that minimum**, which is what makes the deal flow a
  distinct flow rather than a heavier onboarding.
- **The onboarding flow is generative, so it expands without penalty** — adding a field later costs
  nothing, which is why starting minimal is correct rather than merely cheap.

⚠️ **Do not "fix" this form by adding fields.** Anything a specific contract needs belongs in the
contract's own field set, not in the front door that every deal party passes through.

### Traps for whoever builds this

- **Do not add an `email` column to `document_parties`.** The contact IS the party identity, and
  ~34 tables key on `contact_id`. An email column creates a second identity anchor — the exact
  duplication this project keeps paying for.
- **`promote_contact_to_account` is the SOLE writer of `profiles.contact_id`.** The stub contact
  must flow through it, not around it, or the party's documents will not re-anchor.
- **Step 6 already works — do not rebuild it.** It is the ninth thing in this app that exists and
  would have been built twice.

**GAP 2 — ⚠️ THE DERIVATION NEVER RE-RUNS AFTER ONBOARDING. This is the hole in the architecture.**

*(This is not the withdrawn form-fields finding above. That one was wrong. This is a different and
real defect, found by tracing the owner's stated design through the call graph.)*

`fill_party_fields_from_contacts` has **no trigger on `contacts`** — verified against
`pg_trigger` in prod. It runs **only** at contract-start or party-change:
`start_lease_contract_v2` · `start_sale_contract` · `start_bill_of_sale` ·
`start_bill_of_sale_standalone` · `add_deal_document` · `reassign_document_party` ·
`set_document_co_buyer` · `sync_contract_fields_from_defs`.

**So in the owner's flow the order is exactly wrong:**

1. Party is attached as an email-only stub → fill runs → **contact is empty, so the fields fill with nothing.**
2. The person onboards and populates their contact record.
3. **Nothing re-runs the fill.** `redeem_contract_invitation` calls `promote_contact_to_account`
   (correctly — it is the sole writer of the contact↔account link) and re-anchors
   documents/parties/signatures, but it **never calls `fill_party_fields_from_contacts` or
   `remerge_contract_from_clauses`.**
4. **The party opens the contract and their own details are blank**, with nothing to explain why.

**OWNER RULING, 2026-08-20 — propagation is required, and it is broader than redemption.**
*"yes it needs to refill otherwise we end up with a contract that is locked to only using the email
address… if the contract record changes, email, name, phone, address, they need to be pushed to the
contract fields."* **Recorded as D22.** Any change to the contact record propagates to that
contact's contract party fields — not merely a one-off re-fill when they activate.

**The engine is not the work — the hook is.** `fill_party_fields_from_contacts` → 
`remerge_contract_from_clauses` already does the job correctly and `captureContactInfo()` already
runs the pair. What is missing is anything that invokes it when a contact changes outside a
contract screen.

⚠️ **Two boundaries the implementation must respect, both already settled — do not re-litigate:**
- **EXECUTED documents are never re-filled.** They are evidence and record what was actually
  signed. A party moving house does not rewrite their executed contract. This rules OUT a naive
  `AFTER UPDATE ON contacts` trigger that re-merges everything.
- **On a signable-but-unsigned document, a propagated change is a change, and D14 governs it** —
  surfaced to the other party, seen-is-approved. A machine-made edit does not bypass review.
