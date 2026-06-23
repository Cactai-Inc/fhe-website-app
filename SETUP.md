# French Heritage Equestrian — Setup & Operations Guide

Everything in the app is built. This document covers the external wiring that must
be done in your accounts (Supabase, Stripe, Vercel, Google Workspace) to take it
live, plus the open decisions still owed from the reviews.

The code is organized so that **nothing here requires touching application code** —
it's all configuration, migrations, and dashboard steps.

---

## 0. Prerequisites

- Node 20+ and npm
- A Supabase project (one is already referenced in `.env`: `zglovoqvkfptlkdvlkig`)
- A Vercel account (for hosting + serverless functions)
- A Stripe account (card fallback)
- A Google Workspace inbox dedicated to Zelle notifications

Local dev:

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # app
npm run typecheck:api # serverless functions
npm run build
```

---

## 1. Supabase — database

### 1a. Run the migrations

Migrations live in `supabase/migrations/` and are ordered by timestamp:

1. `…_create_bookings_and_inquiries.sql` — legacy inquiry tables (already applied)
2. `…_add_contact_method.sql` — adds contact method + preferred times to bookings
3. `…_platform_data_model.sql` — the full platform schema + RLS + helper functions
4. `…_seed_offerings.sql` — seeds the offerings/tiers catalog (idempotent)
5. `…_booking_functions.sql` — slot-hold + booking transition functions

Apply them with the Supabase CLI:

```bash
supabase link --project-ref zglovoqvkfptlkdvlkig
supabase db push
```

…or paste each file's contents into the Supabase SQL editor in order.

### 1b. Make yourself an admin

Admin-only reads (requests, payment notifications, the review queue) are gated by
`profiles.is_admin`. After you've created your account through the app (or via the
Supabase Auth dashboard), flip the flag:

```sql
update profiles set is_admin = true where email = 'admin@cactai.io';
```

(If no profile row exists yet, sign in once so the app creates it, then run the update.)

### 1c. Environment variables (client)

`.env` already contains:

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_ANON_KEY=…
```

These are safe to expose (anon key + RLS). Keep them in Vercel's env too.

---

## 2. Vercel — hosting + serverless functions

The `/api` directory holds Node serverless functions; `vercel.json` configures the
SPA rewrite so client routes like `/order/:id` resolve.

### 2a. Server-only environment variables (set in Vercel → Project → Settings → Environment Variables)

| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | all functions | same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | all functions | **secret** — service role, bypasses RLS. Never expose client-side. |
| `STRIPE_SECRET_KEY` | stripe functions | from Stripe dashboard |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook | from the webhook endpoint you create (step 3) |
| `ZELLE_INGEST_SECRET` | zelle-reconcile | a long random string you generate; also set in Apps Script (step 4) |

### 2b. Deploy

```bash
vercel            # preview
vercel --prod     # production
```

---

## 3. Stripe — card fallback

1. In Stripe, create a **webhook endpoint** pointing at
   `https://YOUR_DOMAIN/api/stripe-webhook`, subscribed to
   `checkout.session.completed` (and optionally `payment_intent.succeeded`).
2. Copy its **signing secret** into Vercel as `STRIPE_WEBHOOK_SECRET`.
3. Put your **secret key** into Vercel as `STRIPE_SECRET_KEY`.
4. The card convenience fee is `3%`, defined in two places that must stay in sync:
   - `api/stripe-create-session.ts` → `STRIPE_FEE_RATE`
   - `src/components/order/OrderPayment.tsx` → `STRIPE_FEE_RATE`
   - **OPEN ITEM:** confirm California card-surcharge rules + Stripe's surcharge
     requirements before enabling the pass-through fee. If not permitted, set the
     rate to `0`.

Flow: member chooses Card → `/api/stripe-create-session` (verifies ownership, moves
order to `awaiting_payment`, opens Stripe Checkout) → on success Stripe calls
`/api/stripe-webhook` → order marked `paid`+`confirmed`, booking confirmed. Fully
automated; no email ingestion on this path.

---

## 4. Zelle — primary payment + Google Workspace ingestion

Zelle is the default: instant, no chargebacks, no card entry.

### How matching works (already implemented in `api/_lib/reconcile.ts`)

- Each pending order gets a **unique-cents amount** (e.g. `350.07`) and a short
  **reference code** (e.g. `FH-7K2Q`). The unique amount is the deterministic key;
  the reference corroborates.
- **OPEN ITEM:** confirm whether **Bank of America's** received-payment notification
  includes the sender's memo line. If it does *not*, the unique-cents amount carries
  reconciliation on its own (which is why it's the primary key).
- Under/over/duplicate/no-match/ambiguous payments route to a **review queue**
  (`payment_notifications.status = 'review'`) rather than auto-confirming.

> NOTE: assigning the unique-cents amount + reference to an order when it moves to
> `awaiting_payment` is the one server step still to wire to your preference (a tiny
> function that sets `orders.unique_amount` and `orders.payment_reference`). The
> reconciliation logic already reads both. Until then the Zelle screen shows the
> plain total. See `OrderPayment.tsx` and `reconcile.ts`.

### Google Workspace setup (Apps Script polling — recommended start)

The script is at `workspace/zelle-poller.gs`.

1. In Gmail, create a filter matching your bank's Zelle "received money" emails and
   apply the label **`ZelleIncoming`**. Create a **`ZelleProcessed`** label too.
2. Go to script.google.com (signed in as the inbox owner) and paste in
   `workspace/zelle-poller.gs`.
3. In Project Settings → Script properties, add:
   - `RECONCILE_URL` = `https://YOUR_DOMAIN/api/zelle-reconcile`
   - `INGEST_SECRET` = the same value as Vercel's `ZELLE_INGEST_SECRET`
4. Add a **time-driven trigger** on `pollZelle` to run every minute.
5. Adjust the regexes in `parseZelle_()` to match your bank's exact email wording.

This polls every minute and POSTs parsed notifications to `/api/zelle-reconcile`,
which matches them to orders. (Approach B — Gmail API + Pub/Sub push for sub-minute
latency — is documented in `architecture-flow-spec.md` if you ever want it.)

---

## 5. Availability slots (admin)

The booking step shows open slots from `availability_slots`. Create them in the
Supabase dashboard (or build a small admin UI later). Minimum columns:

```sql
insert into availability_slots (start_at, end_at, slot_type, location_mode, status)
values ('2026-07-01T16:00:00Z', '2026-07-01T17:00:00Z', 'lesson', 'onsite', 'open');
```

`hold_slot()` / `confirm_booking_for_order()` / `release_expired_holds()` manage the
lifecycle. Consider a scheduled job (Supabase cron / Vercel Cron) calling
`release_expired_holds()` periodically to free abandoned holds.

---

## 6. Invitations (the bridge)

The request → invitation → account flow is manual by design:

1. A visitor submits a request (writes to `requests` + `request_selections`).
2. You contact them, then create an `invitations` row with a unique `token` and an
   `expires_at`. (Admin UI for this is a future enhancement; for now insert via SQL.)
3. Email them `https://YOUR_DOMAIN/register?token=THE_TOKEN`.
4. They register; the app validates the token via the `validate_invitation` RPC,
   creates the account, and seeds the profile from the request.

```sql
insert into invitations (request_id, email, token, expires_at)
values ('<request-uuid>', 'her@email.com', 'tok_' || gen_random_uuid(), now() + interval '7 days');
```

---

## 7. Email sending (confirmation emails)

The confirmation **page** and the `.ics` / add-to-calendar links are built in-app.
Sending the confirmation **email** with copies + the `.ics` attachment is the one
piece that needs an email provider (Resend, Postmark, SendGrid, etc.). Add a small
function under `/api` that fires after `confirm_booking_for_order`, using
`src/lib/calendar.ts`'s `buildIcs()` for the attachment.

---

## 8. Open decisions still owed (from the reviews)

- [ ] Confirm Bank of America's Zelle notification includes the sender memo (§4).
- [ ] Confirm CA card-surcharge compliance before enabling the Stripe fee (§3).
- [ ] Photography: the hero/community use the two AI reference images. For final
      launch, source or shoot the warm morning rider set per `photography-brief.md`.

---

## 9. What's built vs. what's configuration

**Built (code, in this repo):** full UI redesign + copy, design system, auth +
member area, request flow, purchase flow, booking with holds, document signing,
Zelle reconciliation logic + review-queue rules, Stripe session + webhook, calendar,
Apps Script poller, full Supabase schema + RLS + functions.

**Configuration (this guide):** running migrations, setting env vars/secrets,
creating the Stripe webhook, the Workspace filter + trigger, seeding availability
slots, issuing invitations, and (optionally) wiring an email provider.
