# Backlog

Standing, editable work list. (`docs/STATUS_REPORT.md` is the immutable point-in-time
record; this file is what changes as work lands.)
Last updated: 2026-07-27.

---

## Blocked on the owner

| Item | What's needed |
|---|---|
| **Ecosystem Stage 3** — re-anchor 6 stranded executed documents | A canonical-identity decision. The stranded docs sit on the owner's own multi-role test identities (CJ Z across 3 emails/accounts) + the company contact. Moving *signed* documents is destructive, so it needs an explicit call: re-anchor by email match, skip as test data, or review a full per-person map first. |
| **Two naming decisions** (block Stage 4) | (a) Affiliation table name: `groups` (recommended) vs `member_groups` vs `client_groups`. (b) Purchaser wording: `client` for all / `client`+`customer` split / `guest`+`customer`. |

---

## Ready to build

### Ecosystem stages 4–6 (`docs/ECOSYSTEM_PLAN.md`)
- **Stage 4** — taxonomy rename: `contact_roles` → `groups` (affiliations only);
  guest = account-with-no-group; drop `members.tier`; split
  `category_document_requirements` (groups vs contract doc-roles).
- **Stage 5** — table reconcile: `horse_parties` ↔ `horse_relationships` (two tables,
  same idea — pick one after confirming live-flow usage); merge `staff_profiles`
  (2 rows) into `profiles`.
- **Stage 6** — FE sweep + the invite → sign → promote → community E2E, which is the
  acceptance test for the whole refactor.

### Business admin suite
- `supabase/migrations/20260726090000_biz_expenses_and_financials.sql` is written but
  **deliberately unapplied**. Before applying: **drop the MRR calculation** (it sums
  `amount` over all recurring purchases with no time window or per-month
  normalisation — a lifetime total mislabelled "monthly", for a product that doesn't
  exist yet) and **fix the member KPI** (it counts activated accounts incl. staff, not
  paying members).
- Then build: sales tracker, expense tracker, growth tracker, KPI dashboard, a PDF
  business-report generator, and a CSV financial-export generator. All must read live
  data (`purchases.amount/amount_paid/paid_at`, `board_charges`, `contacts`,
  `expenses`) and degrade gracefully on empty periods — `purchases` currently has
  0 rows.
- Building blocks that already exist: the `KpiSpec`/`KpiTile` framework in
  `OpsDashboard.tsx:39-46,95`, the reduce-sum pattern in `api-boarding.ts:376-383`,
  and the `<Money>` formatter.

---

## Known defects (verified, with locations)

### Legal / financial risk
- **Order documents render placeholder legal bodies** — `src/components/order/OrderDocuments.tsx:6,50`
  ("Placeholder document body — real content is a later pass"). Real text must ship
  before anything is signed against them.
- **Payment receipts have no logging and no idempotency** — `api/_lib/receipt.ts:41`.
  A receipt cannot be proven sent, and the Zelle path (`api/zelle-reconcile.ts:49`)
  can re-send. No DB row, no audit, no console on success.

### Email
- **The "6-hour email guard" does not exist.** Searched all code + Postgres functions.
  Treat as a regression. (The guards that do exist: a 30-minute grace in
  `notifications-nudge.ts:31`, a 3-day contract-reminder window, and 1h/2h one-shot
  `reminder_*_sent_at` stamps.)
- **Two dead templates** — `signup` (welcome) and `dunning` (overdue balance) are
  defined in `api/_lib/email.ts:227,242` with **no caller anywhere**. No welcome email
  and no payment reminder is ever sent.
- **Hardcoded single-tenant values** in an otherwise multi-tenant layer —
  `OPS_INBOX='hello@fhequestrian.com'` (`api/calendar-reminders.ts:19`) and a
  `fhequestrian.com` link (`api/request-received.ts:74`).
- Company/ops-inbox mirror copies are never logged (party copies are, via
  `document_deliveries`).

### UI
- **`o.tiers` bug survives** — `src/pages/app/Admin.tsx:130,155,158`
  (`AttachOfferingPanel`). Same dead-tier reference that was fixed in
  `ProvisionClientForm`; this panel is still broken (the tier layer was removed
  2026-07-08).
- **Gift redemption is a dead button** — `src/pages/app/Gifts.tsx:97-98`
  ("Use this gift (coming soon)", disabled). A client cannot redeem owned value in-app.
- **Landing's only CTA goes to `/story`, not the booking funnel** —
  `src/pages/Landing.tsx:104-105`.
- **Dead nav route** — `src/components/app/AppLayout.tsx:133` links "Brokerage" to
  `/app/ops/brokerage`, which is not defined in `App.tsx`.
- Public `Lessons.tsx` has no loading/error state (`src/pages/Lessons.tsx:36-40`);
  on fetch failure it silently renders an empty grid.
- Placeholder media: hero (`src/pages/Landing.tsx:24`), Story "SWAP" bands
  (`Story.tsx:104,164,183,250`), offering-card `CoverPlaceholder`
  (`OfferingCatalog.tsx:39,46`).
- `docs/archive/` FAQ note: `src/pages/Faq.tsx:6-7` is explicitly placeholder copy.

---

## Not started (owner asks)

- **Chat-with-us** — SMS/WhatsApp deep-link with preformatted messages, recording the
  click and capturing the visitor as a contact.
- **SEO** — full strategy. (Technical SEO is implementable now; keyword/content
  strategy needs owner input. Note `src/lib/seo.ts:18` has a TODO for the real street
  address, and `Contact.tsx:21` is `noindex` — confirm that's intended.)
- **Hero image + page content refresh.**
- **Payment / Zelle receipt-validation testing** — audit-only was agreed; live
  execution needs real credentials.

---

## Housekeeping

- `docs/TOKEN_DICTIONARY.md` — the `ORD.*` namespace points at the retired `orders`
  spine; re-map to `purchases`/`purchase_items`.
- **Migrations are not rebuild-safe** — ~31 of them rewrite existing function bodies
  in place via `pg_get_functiondef` + string-replace, which silently no-ops on a fresh
  database. Pre-existing property; worth a strategy if a clean rebuild is ever needed.
- There is no `supabase_migrations.schema_migrations` table — migrations are a
  hand-maintained journal applied via `psql`.

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
