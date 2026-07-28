# Backlog

Standing, editable work list. (`docs/STATUS_REPORT.md` is the immutable point-in-time
record; this file is what changes as work lands.)
Last updated: 2026-07-27 — restructured around the six pillars per
`REMEDIATION_PLAN.md` (Stage 0b/0c). Every prior item is preserved below; orphaned
items from the archived GAP-ANALYSIS roll-up were pulled back in with statuses
re-verified against the code today (file:line evidence inline).

**Settled by owner decisions D1–D7 (2026-07-27, see `REMEDIATION_PLAN.md` /
`/CLAUDE.md`)** — these were previously "blocked on the owner" and are blocked no
longer:

- ~~Ecosystem Stage 3 re-anchor of 6 stranded executed documents~~ → **settled by
  D1**: the stranded docs ride on the owner's test identities and exit with the
  final Part-5F purge — no re-anchoring, no per-stage cleanup.
- ~~Affiliation table name~~ → **settled by D2**: `groups`.
- ~~Purchaser wording~~ → **settled by D3**: neutral DB marker; "client" in
  staff/ops display, "customer" for gift/product-only contexts, and members always
  see "Member" — never "Client".

---

## 1. Contracts

- **Lease/contract template wording** — owned by the separate authoring thread via
  the DB clause model (`HORSE_LEASE_V2`). Out of scope for the remediation thread;
  read-path rewiring only if a stage forces it.
- **Purchase/sale contract template** (GAP P5) — still blocked on the owner's
  reference document. Unchanged.
- **Contract doc-roles** (Buyer/Lessee/Lessor/Seller) — to be split out of
  `category_document_requirements` into contract-engine ownership → remediation
  Stage 1h.

## 2. Identity

→ remediation Stage 1 (verify-first: dual-identity trace 1a, platform-separation
audit 1b, horse-table evidence 1c, wording inventory 1d, reader/writer enumeration 1e).

**D3 wording dispositions (owner, 2026-07-27; details in
`docs/WORDING_SURFACES.md` flags table):** Release.tsx:231 "client account" →
"account" rides with Stage 3; the "no client profile" exception strings in
`attach_booking_horse`/`book_open_slot`/`request_open_time` → "no member
profile", folded into whichever Stage 1/2 migration next touches each function
(else Stage 3); Admin.tsx:205 tier string fixed as part of Stage 1g's
`members.tier` drop; CalendarPage + HorseIntakeForm flags audience-checked
staff-only — no fix. Contract CLIENT term, public-site client language, and ops
vocabulary all stand.

- **Taxonomy rename** `contact_roles` → `groups` (affiliations only; CLIENT → neutral
  promotion marker; GUEST leaves the table; `contact_type` on the faceless side) →
  Stage 1f.
- **Drop `members.tier`** (vestigial, always `'community'`) with before/after proof
  on `is_active_member()` → Stage 1g.
- **Split `category_document_requirements`** (group-driven onboarding docs vs
  contract doc-roles) → Stage 1h.
- **`horse_parties` ↔ `horse_relationships` reconcile** — two tables, same idea;
  survivor picked from Stage 1c evidence, incl. re-pointing the
  CLIENT.HORSE_CAPACITY signing resolution → Stage 1i.
- **Merge `staff_profiles` (2 rows) into `profiles`** — touches the dual-identity
  substrate; behavior diffed against the 1a trace → Stage 1j.

## 3. Accounts

→ remediation Stage 3.

- **Documents panel real source** (GAP F19) — **verified still open 2026-07-27**:
  `fetchMyDocuments()` returns `[]` (`src/lib/api.ts:514-516`);
  `signOrderDocument` is a no-op. Replace with the account-anchored
  signed-documents source once Stage 2 lands → Stage 3a.
- **My posts manage view** (GAP F15/F16) — **DONE, verified 2026-07-27**: built in
  commit `4e9bc96` — `src/pages/app/MyPosts.tsx` with edit/delete via
  `feedPostUpdate`/`feedPostDelete`, routed at `/app/my-posts` (`src/App.tsx:224`),
  reachable from Account (`AccountHub.tsx:384`). Note: Stage 3b's premise ("the
  page doesn't exist") is stale — flagged to the owner in the Stage 0 report.
- **Standalone change-password + switch-to-Google** (GAP F12/F14) — **verified
  still open 2026-07-27**: the Password row has no `onClick`
  (`src/pages/app/AccountHub.tsx:223`); `startPasswordChange`/`startGoogleChange`
  exist only as seams inside `EmailChangeModal` → Stage 3c.
- **Horse-record account visibility** — parties on the record drive visibility and
  listing rights, reading the Stage-1 survivor table → Stage 3d.
- **Email-change live round-trip test** (GAP G/F13, backend built, never
  end-to-end tested) → Stage 3 exit criterion.

## 4. Account creation

→ remediation Stage 2.

- **Promotion pathway** `promote_contact_to_account` per D5 (`_ensure_client_account`
  spine → re-anchor documents/parties/signatures → `apply_affiliations` → dissolve
  the faceless contact; structural denylist for D1's protected set) → Stage 2a.
- **Route ALL account-creation entry points through the spine** (redeem_invitation,
  gift redeem, kiosk conversion, self-signup, admin provision) — the five-writers
  problem must not regrow → Stage 2b.
- **Account linkage recorded at signing time** → Stage 2c; **backfill** existing
  signed docs (excluding the 6 stranded test-identity docs per D1) → Stage 2d.

## 5. Ordering

→ remediation Stage 4.

- **`o.tiers` bug in `AttachOfferingPanel`** — **verified still present 2026-07-27**:
  `src/pages/app/Admin.tsx:130,155,158` (tier layer removed 2026-07-08; same fix
  pattern as `ProvisionClientForm`) → Stage 4a.
- **Gift redemption dead button** — **verified still present 2026-07-27**:
  `src/pages/app/Gifts.tsx:95-98` ("Use this gift (coming soon)", disabled).
  Backend redemption endpoint + wire → Stage 4b.
- **Gifts panel backends** (GAP H8–H11: resend / reschedule / transfer /
  claim-link) — **verified still open 2026-07-27**, with a caveat: the "• WIRE" UI
  seams the plan references were **not found** in the current gifts UI (repo-wide,
  `⇢ WIRE` seams exist only in the email-change components); today's `Gifts.tsx`
  is a plain list + the dead redeem button. Flagged in the Stage 0 report; the
  Stage-4 build may need to add the UI actions, not just the endpoints → Stage 4c.
- **Payment-method update + payment-responsibility transfer** (GAP H6/H7) —
  **verified still open 2026-07-27**: no such endpoints under `api/`, and no
  Account rows reference them → Stage 4d.
- **Strip tier-implying membership copy** (monthly/annual) per D4; billing
  schedules + implicit pay-as-you-go remain the displayed reality → Stage 4e.
- **Business admin suite** — ready to build, not part of a remediation stage.
  `supabase/migrations/20260726090000_biz_expenses_and_financials.sql` is written
  but **deliberately unapplied**. Before applying: **drop the MRR calculation**
  (lifetime sum mislabelled "monthly", for a product that doesn't exist) and **fix
  the member KPI** (counts activated accounts incl. staff). Then build: sales
  tracker, expense tracker, growth tracker, KPI dashboard, PDF business-report
  generator, CSV financial-export generator — all reading live data
  (`purchases.amount/amount_paid/paid_at`, `board_charges`, `contacts`,
  `expenses`), degrading gracefully on empty periods (`purchases` has 0 rows).
  Existing building blocks: `KpiSpec`/`KpiTile` (`OpsDashboard.tsx:39-46,95`), the
  reduce-sum pattern (`api-boarding.ts:376-383`), `<Money>`.

## 6. Fulfillment

→ remediation Stage 5.

- **The deliverable spine** per D6 — fulfillment units from `purchase_items` by
  `config_kind`; `status_events` drives unit state; bookings/lesson_credits/
  evaluation delivery connect to units → Stage 5a.
- **Payment receipts: no logging, no idempotency** — `api/_lib/receipt.ts:41`; the
  Zelle path (`api/zelle-reconcile.ts:49`) can re-send. A receipt must be provable
  and single → Stage 5b.
- **Dead email templates** — `signup` (welcome) and `dunning` (overdue) defined at
  `api/_lib/email.ts:227,242` with no caller (**re-verified 2026-07-27**: only
  comment-level mentions elsewhere). Wire dunning to the existing 3-day
  payment-reminder preference; welcome fires on account activation → Stage 5c.
- **Ops-inbox mirror copies never logged** + **hardcoded single-tenant values**
  (`OPS_INBOX='hello@fhequestrian.com'` at `api/calendar-reminders.ts:19`; a
  `fhequestrian.com` link at `api/request-received.ts:74`) → Stage 5d.
- **Calendar real sources** — payments/billing due from billing schedules
  (partially wired); member-readable expiration/confirmation sources once the
  spine exists → Stage 5e.
- **Order documents render placeholder legal bodies** —
  `src/components/order/OrderDocuments.tsx:6,50` (**re-verified 2026-07-27**).
  Source real content from the contract system's executed template set; never
  draft legal prose → Stage 5f.
- **The purge routine** — allowlist-guarded account removal (test identities
  only), proven on a synthetic account → Stage 5g.
- **The "6-hour email guard" does not exist** — searched all code + Postgres
  functions; treat as a regression. (Guards that do exist: 30-min grace in
  `notifications-nudge.ts:31`, 3-day contract-reminder window, 1h/2h one-shot
  `reminder_*_sent_at` stamps.) *Not covered by a remediation stage — standing
  defect.*

## 7. Deferred (UI-lane and owner-input items — NOT in the remediation stages)

- **Linked accounts: schedule sharing** (D8.5, recorded 2026-07-27) —
  rider-permission-gated schedule visibility between linked accounts (separate
  logins). Deferred; the record-sharing half (shared horse record via
  add-by-email on `horse_relationships`) folds into Stage 3d's horse-visibility
  item instead.

- **Calendar LARGE modal + week/day/list switcher** (GAP E1/E3/E4) — **partially
  superseded, verified 2026-07-27**: a week/month switcher now exists
  (`src/pages/app/CalendarPage.tsx:41,204`) with a tap-day panel; the item panel
  is still compact (`CalendarItemPanel.tsx:256`, `sm:max-w-md`) and day/list modes
  are still absent. UI-lane / deferred.
- **Stable item form fields** (GAP J9–J15) — **verified still open 2026-07-27**:
  `AddItemModal` is name + detail + vendor only
  (`src/components/app/StableEditors.tsx:179`); category list / conditional size /
  where-bought / price-paid / notes not built. UI-lane / deferred.
- **Mobile device pass** (GAP L1–L8) — needs real-device testing; not verifiable
  by code inspection. UI-lane / deferred.
- **Membership tier model** (GAP H2/H3) — **SETTLED-DEFERRED per D4**: tiers are
  deferred as a product; `tier` stays a reserved word; strip tier-implying copy
  (Stage 4e); billing schedules + PAYG describe current reality.
- **Landing's only CTA goes to `/story`, not the booking funnel** —
  `src/pages/Landing.tsx:104-105`.
- **Dead nav route** — `src/components/app/AppLayout.tsx:133` links "Brokerage" to
  `/app/ops/brokerage`, undefined in `App.tsx`.
- Public `Lessons.tsx` has no loading/error state (`src/pages/Lessons.tsx:36-40`);
  silent empty grid on fetch failure.
- Placeholder media: hero (`src/pages/Landing.tsx:24`), Story "SWAP" bands
  (`Story.tsx:104,164,183,250`), offering-card `CoverPlaceholder`
  (`OfferingCatalog.tsx:39,46`); `src/pages/Faq.tsx:6-7` is placeholder copy.
- **Chat-with-us** — SMS/WhatsApp deep-link with preformatted messages, recording
  the click and capturing the visitor as a contact. (Owner ask.)
- **SEO** — full strategy; technical SEO implementable now, keyword/content needs
  owner input. `src/lib/seo.ts:18` TODO for the real street address;
  `Contact.tsx:21` is `noindex` — confirm intended. (Owner ask.)
- **Hero image + page content refresh.** (Owner ask.)
- **Payment / Zelle receipt-validation live testing** — audit-only was agreed;
  live execution needs real credentials. (Owner ask.)

---

## Housekeeping / standing notes

- ~~`docs/TOKEN_DICTIONARY.md` — the `ORD.*` namespace points at the retired
  `orders` spine; re-map to `purchases`/`purchase_items`.~~ **Done 2026-07-27**
  (Stage 0d).
- **Migrations are not rebuild-safe** — ~31 rewrite existing function bodies in
  place via `pg_get_functiondef` + string-replace, silently no-op on a fresh
  database. Pre-existing; worth a strategy if a clean rebuild is ever needed.
- There is no `supabase_migrations.schema_migrations` table — migrations are a
  hand-maintained journal applied via `psql`.

## Done 2026-07-27 (remediation Stage 1 — identity taxonomy, all live on prod)

- **Platform separation purge** — admin@cactai.io's FHE rows removed (doc chain
  first, then groups/members/clients/contact; profiles.contact_id severed, login
  kept; audit_logs + moderation_actions kept as history). Post-purge sweep: zero
  FHE identity rows.
- **1f** `contact_roles` → `groups` (RIDER/HORSE_OWNER/PARENT_GUARDIAN only,
  CHECK-enforced; apply_affiliations sole writer; clients row = the promotion
  marker; guest = active client with no group via `my_standing_categories()`;
  `contacts.contact_type` added; GUEST-default trigger retired).
- **1g** `members.tier` dropped (gate def byte-identical; memberships view
  recreated; Admin.tsx:205 tier string fixed per F5).
- **1h** `category_document_requirements` split → `contract_role_documents`
  (BUYER/LESSEE/LESSOR/SELLER, contract-engine ownership); onboarding table
  CHECK-locked to Guest/Rider/Horse owner.
- **1i** `horse_parties` dropped; `horse_relationships` survivor (share_pct +
  notes + ledger roles ported; billing precedence-2, stable/booking gates,
  ledger RPC path, audit trigger, REVOKE DELETE; CLIENT.HORSE_CAPACITY token
  source corrected; attach_booking_horse F2 wording fixed).
- **1j** `staff_profiles` merged into `profiles` (title/pay_type/staff_active;
  shifts/time_entries re-keyed to staff_user_id; employment fields made
  admin-only via the role guard; D7 lanes proven byte-identical by md5).

## Done 2026-07-27

- **Lease hardening applied** — the owner's 8-change list
  (`docs/contract-exports/HORSE_LEASE_V2_HARDENING_CHANGES.md`) is live on prod via
  `supabase/migrations/20260727120000_lease_v2_hardening.sql` (`de0122c`); exports
  regenerated. Both limitation branches render-verified.
- **Insurance election redesign live** — GL / Mortality / Major Medical each now a
  4-way Lessor election (has / will purchase / Lessee must obtain / not required)
  rendered as prose; Lessee-obtain mortality minimum auto-imports the horse's FMV
  (mismatch eliminated); liability cap follows the election (Lessor policy limit vs
  FMV); loss-of-use acknowledgment + Lessee elective termination added. Migration
  `20260727150000_lease_v2_insurance_elections.sql`. FHE $25k CCC-limit warning is
  authoring-side guidance on the mortality election field; a hard UI flag is a
  possible later enhancement.
- **Lease Batch 2 applied + pushed** — full insurance rebuild (GL open format /
  Lessor-held mortality with ≥FMV validation / Medical / entity-only CCC /
  Coordination of Coverage), entity/individual representations pair driven by
  derived `LESSEE.PARTY_TYPE`, authorized-rider release precondition, single
  FMV Limitation, termination hardening + Survival, purpose + evaluation-fee
  restructure. Lock gates: unset elections and party-type/contact contradictions
  cannot lock or execute. Migrations `20260727235000` + `20260728000500`;
  verification renders + lock-gate proof in `docs/contract-exports/BATCH2_*`.
