# Go-Live Runbook & Findings — 2026-07-02

Build state: `feat/platform-backbone` @ `c34dab5` — 1049 tests (115 files), app+api
typechecks clean, build + prerender green. Branch merged to `dev` → `preview`.

## Owner actions before production (`main`)

1. **Vercel env** (Production + Preview):
   - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — real project values
   - `SUPABASE_SERVICE_ROLE_KEY` (api functions), `SUPABASE_URL`
   - `GMAIL_SMTP_USER` / `GMAIL_SMTP_PASS` / `TRANSACTIONAL_FROM_EMAIL` — see GOOGLE_SMTP_SETUP.md
   - `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (webhook endpoint: `/api/stripe-webhook`)
   - `ZELLE_INGEST_SECRET` (same value in the Apps Script poller)
2. **Supabase**: apply migrations in order (50 files); point Auth SMTP at the
   Workspace account (GOOGLE_SMTP_SETUP.md §3); create the `brand-assets` bucket
   contents as needed.
3. **Registry values** (now editable in-app at `/app/ops/admin/registry`):
   confirm BRAND.*, CONTACT.*, and fill the flagged ORG policy values
   (INVOICE_DUE_DAYS, CANCELLATION_NOTICE_HOURS, TERMINATION_NOTICE_DAYS) +
   business_config fees (travel, cancellation/late/no-show, protection period,
   sales tax, retention, e-sign provider). `config_required_missing()` lists gaps.
4. **Attorney**: review `ATTORNEY_FILLIN_CHECKLIST.md` (§1–18). All legal wording
   is config/token-swappable — no code changes needed for final language.
5. **Live $1 Zelle test**: after SMTP + webhook inbox exist — buy any item, choose
   Zelle, send $1 + memo code from a personal account; the poller → `/api/zelle-reconcile`
   should auto-match (underpayment routes to `/app/ops/payments/review` — expected
   for a $1 test against a larger order; use a $0-adjacent test order or verify the
   review queue path).
6. **OAuth/Apple**: finish Google console + Sign in with Apple; wire providers in
   Supabase Auth.

## Engineering findings register (open, non-blocking)

- **Cart items don't carry tier_id** — checkout builds items from the client
  catalog with `offering_slug` only, so `finalize_order_payment` enforces
  server prices only on tier-linked rows. Fix: carts pass `tier_id`; then server
  pricing is total. (Medium effort; touches Checkout + funnels + CartContext.)
- **Public marketing pages read hardcoded catalog.ts/services.ts/brand.ts** —
  correct for FHE-as-tenant-#1; per-tenant public sites (BrandProvider-driven,
  DB-priced) are platform work for tenant #2 readiness. Drift-guard test pins
  lesson prices catalog↔DB meanwhile.
- **Zelle $-test caveat**: reconciler treats underpayment as review, by design.
- **Membership subscriptions**: purchase flow is request-to-join + manual billing;
  recurring Stripe subscriptions remain deferred (existing decision).
- **Orphan branch** `feat/phase-2-contract-layer`: archived as tag
  `archive/phase-2-contract-layer` and deleted (unmergeable disconnected history;
  content long since carried into the baseline).

## Release path

`feat/platform-backbone` → `dev` → `preview` (Vercel auto-deploys preview) →
owner verification on the preview URL → merge `preview` → `main` (production).
