# FLOWS — STAFF OPS (records · horses · self-service · team · notifications)

**Traced at main `c56559e` (2026-08-20), prod read-only.**
Areas touched: **Management** (Records, Support, Payment review) · **Modules** (Boarding,
Barn Ops, Employees, Lessons) · **Settings** (Team, Branding, Products, Forms, Templates) ·
**Member app** (Account hub) · mail edge (`support-received`, `email-change-*`,
`hard-delete-client`).
Incumbents absorbed: SURFACE-INVENTORY §§2–4 (CRUD + D19 columns cited, not re-derived),
DUAL_IDENTITY_TRACE, ROSTER/RECORDS/ADMINSWEEP/PROFILE task records.

---

## F16 — Lead → client conversion and the Records lanes

TRIGGER      An inbound request (booking.md F4) or a walk-up staff create.
ACTORS       staff · the person becoming a client.
SEQUENCE
1. Every intake lands as a `requests` row; `requests_capture_contact_trg` files the
   contact/lead (booking.md F4 step 3). `contacts_file_on_insert_trg` +
   `contacts_convert_lead_on_client_trg` (trigger map) keep the lead→client ladder: a
   `clients` insert converts the lead automatically.
2. Staff work everything from **one page**: `/app/records/:tab`
   (Clients/Leads/Partners/Vendors/Horses/Lessons/Documents/Deals — RECORDS d7b9f49
   superseded the scattered pages; the old `/app/ops/contacts|horses|documents|deals|
   lessons` routes are retirement-flag redirects, SURFACE-INVENTORY §3).
3. Conversion is provisioning (onboarding F1) — confirm + promote + invite are one act
   (CAREPATH C5b standing rule).
4. Identity model: lead → account → contact (owner taxonomy 2026-08-02);
   `promote_contact_to_account` is the promotion seam; company identity only ever by
   `is_company` (DUAL_IDENTITY_TRACE standing rule).
TERMINAL     request `converted`; contact carries the client row; Party1/Party2 document
             columns reconcile on the dossier (DOCCOLS).
BREAKS
1. **Inherited (SURFACE-INVENTORY findings, not re-walked)** — the retired-flag routes
   still carry live CRUD components behind their flags; `/app/ops/review/contact-dossier`
   mounts a REAL production contact with REAL saves from a comparison page.
2. **UNPROVEN** — renders (Records tabs never browser-verified this cycle).

## F17 — Horse intake and records

TRIGGER      Member: `/app/horse-intake` (post-onboarding or from CareHome) · staff:
             Records → Horses tab (HorseRecordsPage).
SEQUENCE
1. Member intake: `create_horse_record` → `ensure_horse_documents` (horse-linked releases
   assigned; the HORSEDOCS guard makes it idempotent) → affiliations re-derive
   (`trg_apply_affiliations_on_horse`).
2. Staff side: `staffUpdateHorse` / `staffArchiveHorse` / `staffAssignHorseParty`
   (ENGINE-RPC — SURFACE-INVENTORY row), parties and health sub-pages
   (`createHorseParty`/`archiveHorseParty` RPC; health events are RAW writes).
3. Lease/sale execution moves the horse automatically (contracts.md F7 step 6);
   `horses_sync_contract_fields` pushes horse edits into live documents' fields;
   `trg_wake_held_orders_on_horse` wakes orders held on a horse's arrival.
WHAT EACH PARTY SEES  member: My Stable card (`my_stable_horses`, owner vs lessee) ·
             staff: Records Horses row with lease line.
TERMINAL     Horse row with owner/lessee relationships current.
BREAKS
1. **BROKEN (CLOSEOUT F-NEW-2)** — terminated leases never release the horse (also filed
   under contracts.md F7).
2. **Inherited** — `CareHome.tsx:70` links to `/horse-care`, a route that does not exist —
   every click 404s (SURFACE-INVENTORY §2 finding, unfixed at `c56559e`).

## F18 — Account & profile self-service (member)

TRIGGER      Member: `/app/account` (AccountNavLink).
SEQUENCE
1. AccountHub's four consolidated sections (PROFILE 15e4ed3): profile fields
   (`updateMyOnboardingProfile` / `myContactPhone`), My Gifts accordion, settings links.
2. Email change: `/api/email-change-start` (password vs google path decided
   server-side by MX authority) → verification → `/api/email-change-complete` (ordered
   promotion, idempotent by token — endpoint headers). Password reset:
   `/forgot-password` → Supabase auth email → `/reset-password` (URL-ONLY by design).
3. Support: `/app/support` → `submit_support_request` → in-app staff notification +
   pg_net → `/api/support-received` → ops-inbox email.
TERMINAL     Profile current; support request worked by staff (`setSupportStatus`).
BREAKS
1. **UNPROVEN** — support email (0 support_requests ever), email-change round trip.

## F19 — Team & staff management

TRIGGER      Admin: Settings → Team (`/app/ops/team`, via the settings cards —
             SURFACE-INVENTORY §0 nav mechanism).
SEQUENCE
1. Staff invite: `/api/admin-send-invitation` PLAIN path (role USER/MANAGER/ADMIN,
   optional title) → activation (onboarding F1 steps 5–6) →
   `profiles_sync_staff_profile` / `contacts_file_team_on_link` triggers create the
   employment substrate (`staff_profiles` — DUAL_IDENTITY_TRACE §0's 1j reader set).
2. Grants/suspension/role: TeamPage raw writes (`addGrant`/`removeGrant` reversible pair,
   `adminSetRole` guarded by `profiles_role_guard_trg`, `adminSetSuspended`).
3. Employees module: shifts/time entries (RAW writes, no D19 — inventory rows).
4. Deletion is the nuclear option: `/api/hard-delete-client` — FK-blocked when signed
   documents exist ("a signed agreement is not silently shredded" — endpoint header).
TERMINAL     Working staff account with grants; instructors get InstructorHome at
             `/app/ops` (a URL-ONLY page — inventory calibration #1, still unfixed).
BREAKS
1. **Inherited (SURFACE-INVENTORY)** — the whole Team/Employees lane is RAW-TABLE-WRITE
   with D19 `N·N·N·N` except the grant pair; no reason capture anywhere.

## F20 — Notifications and alerts (the read-back spine)

TRIGGER      Every flow above writes `notifications`; this flow is how a human ever sees
             one.
ACTORS       members · staff · system: `notifications-nudge` (daily), `calendar-reminders`
             (hourly), `delivery-sweep` (hourly).
SEQUENCE
1. Writers stamp provenance + category + author (`notifications_capture_provenance`,
   CLOSEOUT §1.8); admin-audience rows fan to both co-owner inboxes
   (`mirror_admin_notification`).
2. In-app: the bell; dashboard cards. Read/consume deletes — but every delete now logs to
   `notification_log` first (CLOSEOUT §1.8; contract view reads it back).
3. Email: the daily nudge digests unread rows >30 min old, one branded digest per user,
   `emailed_at` stamped only after a real send; calendar kinds are emailed hourly by the
   reminders cron instead (window-gated).
TERMINAL     `notification_log` rows with outcome; `notifications` drained.
             **Prod: 46 live notifications, 0 ever emailed** (`emailed_at` NULL on all —
             query, this trace).
BREAKS
1. **BROKEN-or-UNPROVEN (the sharpest cron fact)** — 46 unread notifications and not one
   `emailed_at` in history: either the nudge cron has never run, or it has never
   succeeded. Same tell as OPEN-ITEMS §4; what would prove it is one stamped row or one
   Vercel cron log line.
2. **Inherited (D19 corollary)** — outside the contract Activity card, no surface reads
   any send-log back (request_alert_sends, receipt_sends, signup_alert_sends,
   notification_log all write-only to humans).
