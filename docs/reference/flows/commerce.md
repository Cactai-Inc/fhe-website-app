# FLOWS — COMMERCE (purchase & payment · evaluations · gifts)

**Traced at main `c56559e` (2026-08-20), prod read-only.**
Areas touched: **Public site** (checkout, `/gift`, `/redeem`) · **Member app** (Catalog,
My Orders, order detail/payment) · **Management** (Payment review) · **Community group**
(Evaluations) · mail edge + Stripe + the Zelle poller + `expire-holds` cron.
Incumbents absorbed: FLOWTRACE §§3–5/11, CASHCONFIRM/ZELLECLOSE/FEECHOICE/BOOKLINK task
records, SURFACE-INVENTORY rows.

---

## F10 — Purchase and payment (cart → order → paid → receipt)

TRIGGER      Member books/buys from `/app/catalog` → `/app/checkout` (CatalogPage.tsx:21),
             or staff provision an order (onboarding F1), or a booking's debit-or-create
             mints one (BOOKLINK).
ACTORS       member/client · staff (Payment review) · system: Stripe, the Zelle Apps
             Script poller (out of repo), `api/zelle-reconcile.ts`, `api/orders-mark-paid.ts`,
             `api/send-order-receipt.ts`, `expire-holds` cron.
PRECONDITION An account (public checkout files an INQUIRY, not an order — booking.md F4;
             "everything is an order" governs the shape, CAREPATH C5b).

SEQUENCE
1. Order created: `createDraftOrder` (RAW-TABLE-WRITE per SURFACE-INVENTORY `/checkout`
   row) or the provisioning RPC → `purchases` (+`PUR-…` display code via
   `assign_display_code`) + `purchase_items` → the fulfilment mint fires
   (fulfilment.md F13). Order opens → credits mint.
2. The buyer meets `/order/:id` (OrderDetail) and its payment card (OrderPayment):
   - **Zelle** (preferred): no memo yet → the Pay-with-Zelle button (PAYLOCK re-keyed the
     branch on `payment_reference` itself, not status — `OrderPayment.tsx:203-212`, the
     FLOWTRACE §5 lock 1 is FIXED) → `finalize_purchase_payment` — now matching
     `buyer_user_id = auth.uid() OR buyer_contact_id = v_contact` (prod body; lock 2
     FIXED) → memo + unique-cents amount stamped; instructions render.
   - **Card**: `startStripeCheckout` (`src/lib/payments.ts:17` →
     `/api/stripe-create-session`, fee disclosed — FEECHOICE) → Stripe hosted checkout →
     `/api/stripe-webhook` marks paid+confirmed and confirms the booking.
   - **"I paid" claim** (CASHCONFIRM): the buyer reports a zelle/cash payment; staff see
     it in the Client-claims bucket on `/app/ops/payments/review`.
3. Inbound Zelle: Google Apps Script poller (outside version control —
   `workspace/zelle-poller.gs` is a reference copy) → POST `/api/zelle-reconcile`
   (shared secret) → `_lib/reconcile.ts`: match on unique_amount → payment_reference →
   else the **review queue, which now alerts staff** (ZELLECLOSE closed FLOWTRACE
   item 14b — reconcile.ts:63-66). Raw notification recorded first
   (`payment_notifications`).
4. Settlement is ONE spine whatever the door: `mark_purchase_paid` (staff-gated) —
   called directly by `/api/orders-mark-paid`, wrapped by `confirm_payment_claim` when a
   client claim is pending (the orphaned-claim collision found and fixed in ZELLECLOSE/
   CASHCONFIRM), or by the webhook/reconciler.
   → *Buyer sees the order flip paid + a receipt email; staff see the review row clear.*
5. Receipt: `sendOrderReceipt` (`_lib/receipt.ts`) from every settling door; every attempt
   writes `receipt_sends`.
6. Paid unlocks: recurring month-roll (booking.md F6), Stripe-confirmed bookings,
   `confirm_booking_for_purchase` for held bookings; `expire-holds` (hourly cron) lapses
   48h-old holds, releases slots, emails the client (06:00–21:00 PT window).

NOTIFIES     staff payment-review notifications (in-app + mirror) · buyer receipt email ·
             hold-lapsed email (cron).
TERMINAL     `purchases.payment_status='paid'` + a `receipt_sends` row.
             **Prod: 4 purchases, all `unpaid`; 0 receipt_sends; 0 payment_reference /
             unique_amount values ever** (query, this trace).
VARIANTS     partial payment at provisioning (`p_partial_amount`) · cash vs zelle method ·
             swap of a booked item (`swap_booking_item`).
BREAKS
1. **BROKEN by disuse, not code (sharpened from FLOWTRACE §5)** — both locks on the Zelle
   path are fixed, but **no buyer has ever clicked through**: all 4 purchases still carry
   NULL matching keys, so the reconciler still can never match a live payment. The first
   real payment is the proof; until then the whole tail (receipts, month-roll,
   paid-gates) is data-dead.
2. **UNPROVEN** — Stripe end-to-end (no live session observed), the poller (outside the
   repo), every receipt send (0 rows), `expire-holds` (never observed; no holds exist).
3. **Inherited (FLOWTRACE item 1, unfixed)** — the member Orders LIST card still renders
   date/status/total only; `PUR-…` codes and item labels appear nowhere in the client UI
   until OrderDetail.

---

## F11 — Evaluation report delivery and sharing

TRIGGER      Staff: `/app/ops/evaluations` (COMMUNITY_GROUP nav) — create/save a report
             against an evaluation purchase; deliver when ready.
ACTORS       staff · buyer (member) · share recipients · system:
             `api/deliver-evaluation-report.ts`.
PRECONDITION An evaluation offering purchased (unit minted — fulfilment.md F13).

SEQUENCE
1. `createEvaluationReport` / `saveEvaluationReport` (EvaluationReportsPage —
   SURFACE-INVENTORY §3 row).
2. `deliverEvaluationReport` → report status delivered → `trg_evaluation_unit_link`
   consumes the fulfilment unit (trigger map).
3. Buyer reads it on `/app/evaluations` (LINK-ONLY from the purchased-evaluation
   notification — SURFACE-INVENTORY §2); self-serve "email me a copy" and share:
   `shareEvaluationReport` → `/api/deliver-evaluation-report` (action email|share, PDF
   render, per-tenant identity); `logReportViewed` writes access events.

NOTIFIES     delivery notification to the buyer (in-app; email via nudge) · the share email.
TERMINAL     Report `delivered`, unit consumed, access events accruing.
             **Prod: 0 evaluation_reports ever** — flow entirely unexercised.
BREAKS
1. **UNPROVEN end to end** (0 rows; render + email unobserved). Empty is expected
   pre-launch; recorded because the consumption seam (unit link) has therefore also never
   fired.

---

## F12 — Gift purchase and redemption

TRIGGER      `/gift` (footer + funnel links; `?item=` variants) — a visitor gifts a
             service. Since GIFTPATH, a gift ENQUIRY is a conversation first:
             `src/lib/gifts.ts:145` routes through `submitRequest` (booking.md F4 spine,
             alerts fire).
ACTORS       buyer (visitor) · recipient · staff · system: `api/register-gift.ts`.
PRECONDITION None for enquiry; a minted gift (staff-side `createGift`) for redemption.

SEQUENCE
1. Gift enquiry → F4 spine (request + both alert emails). Staff convert on the phone;
   `createGift` (`gifts.ts:87`, RPC) mints the `gifts` row (code, item, amount,
   deliver_on).
2. Recipient opens `/redeem` (URL-ONLY, reached from the gift-code email —
   SURFACE-INVENTORY §1): `openGift` (deliberately unguarded — the CODE is the
   credential) → reveal; `redeemGift` attaches it.
3. No account: `/api/register-gift` creates the auth user server-side (gift code as
   proof, `email_confirm:true` — endpoint header; D8's auto-account), then redemption
   proceeds; the SECFIX2 anon-path revocation (1008477) closed the raw anon door.
4. Redemption mints the purchase/credits shape via the same order spine (gift → purchase
   → F13 mint), and the recipient lands in the member app.

NOTIFIES     staff+buyer enquiry emails (F4) · the gift-code email to the recipient
             (deliver_on scheduling, `last_sent_at`/`send_count` on the row).
TERMINAL     `gifts.status` redeemed + `redeemed_user_id`. **Prod: 0 gifts rows.**
BREAKS
1. **UNPROVEN** — no gift has ever been minted or redeemed in prod; the gift-code email
   send has never been observed (RETEST step 2 covers the enquiry pair only).
2. **Wiring note (inherited from SURFACE-INVENTORY)** — `/app/gifts` is an ORPHAN route;
   the member-facing gift list renders only inside AccountHub's accordion.
