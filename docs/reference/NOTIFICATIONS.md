# Notifications — email nudge

The in-app notifications spine (migration `20260703090000_notifications.sql`,
BOOKING_FLOWS_PLAN §1 Messaging decision) gets an off-app safety net: members
with **unread** in-app notifications receive one tenant-branded digest email so
nothing is missed when they aren't in the app.

## What the nudge does

`api/notifications-nudge.ts` runs daily (Vercel cron, see below) and:

1. Selects notifications with `read_at IS NULL AND emailed_at IS NULL AND
   created_at < now() - 30 minutes`. The 30-minute grace means someone reading
   in-app right now isn't emailed about what they just saw.
2. Groups per user (max 10 titles per digest, newest first — the rest roll into
   the next run) and sends **one** email per user, branded from the user's org
   via the value registry (`resolveTenantEmailIdentity` — from-name, legal
   footer; never hardcoded).
   - Subject: `You have N updates at {brand}` (`You have 1 update at {brand}`
     when singular).
   - Body: the notification titles as a list + one CTA link to the app root
     (`{origin}/app`).
3. Stamps `emailed_at` on the digested rows **only after a successful send**
   (a failed send retries on the next run; each user is fenced in their own
   try/catch so one failure never blocks the rest).

A notification is nudged **at most once** — `emailed_at` (migration
`20260703130000_notification_nudge.sql`) takes it out of the pending set.

## Schedule

`vercel.json` crons: `0 16 * * *` — daily at 16:00 UTC ≈ 9am Pacific, so the
digest lands at the start of the member's day, and anything produced overnight
has long cleared the 30-minute grace window.

## Auth + environment

- **Vercel cron path**: needs nothing. Vercel stamps the `x-vercel-cron` header
  on its invocations; the endpoint admits requests carrying it.
- **Manual runs**: set `CRON_SECRET` in Vercel (any long random string). The
  endpoint then also accepts `Authorization: Bearer $CRON_SECRET`. Without the
  env var set, the bearer path is disabled entirely.
- Everything else is rejected 401.

## Trigger manually

```sh
curl -X POST https://<your-deployment-host>/api/notifications-nudge \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response: `{ "users_nudged": <n>, "notifications_marked": <n> }`.

# Zelle payment ingestion — the arrival path

TASK ZELLECLOSE (2026-08-16), answering FLOWTRACE item 14's open question — "what
actually ingests a Zelle notification?" — with the real, measured answer instead
of folklore.

## What exists, in three pieces

1. **The generator** — `finalize_purchase_payment` (PAYLOCK, `2026-08-13`)
   assigns a purchase its matching keys — `unique_amount` (the balance owed,
   the primary key) and `payment_reference` (a brand-prefixed code, e.g.
   `FRENCHHERITAGEEQUESTRIAN-973960` for this org's `config_values`
   `BRAND/SHORT_NAME` — **not** a short "FH-" code; there is no length cap on
   the brand prefix). Runs when a buyer reaches the Pay-with-Zelle screen.
2. **The matcher** — `POST /api/zelle-reconcile` → `reconcileNotification()`
   (`api/_lib/reconcile.ts`), fully built and in this repo. Given a parsed
   notification `{ sender, amount, reference, memo, confirmation, ... }`, it:
   - Writes an audit row to `payment_notifications` first, always.
   - Matches an `awaiting_payment` purchase by `unique_amount` (exact), then
     falls back to `payment_reference`.
   - No match → tries a **reschedule fee** by identity (payer email/phone/name
     appearing anywhere in the notification text), amount as a tiebreaker only.
   - Still nothing, or more than one candidate, or the amount underpays →
     **review** (a human must look at it) — and, as of ZELLECLOSE, this now
     **alerts staff** (see below); it used to only flip a status column.
   - A clean match → `mark_purchase_paid` + `confirm_booking_for_purchase`,
     then a receipt email (`sendOrderReceipt`, best-effort, itself
     provable — see `receipt_sends` below).
3. **The trigger** — the thing that actually calls `/api/zelle-reconcile` when
   a real Zelle email lands. **This is the piece that does not operate today.**

## The trigger, measured, not assumed

`workspace/zelle-poller.gs` is a **reference copy** of a Google Apps Script
meant to be pasted into `script.google.com` (signed in as the inbox owner),
polling a Gmail label (`ZelleIncoming`) once a minute and POSTing each parsed
notification to `/api/zelle-reconcile` with the `x-fhe-secret` header. It is
**not version-controlled Apps Script** — nothing in this repo deploys it, and
there is no `supabase/functions/`, no `pg_cron` job (`cron.job` does not exist
in prod — the extension isn't installed), and no Vercel cron pointed at
`/api/zelle-reconcile` (`vercel.json`'s only crons are the nudge, expire-holds,
calendar-reminders, and delivery-sweep, above).

**Proof it has never fired**: `select count(*) from payment_notifications` —
**0**, in prod, ever (checked 2026-08-16 — that table has existed since
`20260802020000_u3_payment_notifications.sql`, two weeks). Whether the script
was never pasted into Apps Script at all, or was pasted but never given a
time-driven trigger, or the trigger exists but points at the wrong URL/secret,
is not distinguishable from the database side — but the operational answer is
the same either way: **nothing has ever ingested a Zelle notification.** Every
payment received to date has been reconciled by nobody, because nothing told
the matcher a payment arrived.

**To make it live** (a Google Workspace admin action, out of this repo's
reach): follow the setup comment at the top of `workspace/zelle-poller.gs` —
create the two Gmail labels, paste the script, set `RECONCILE_URL` /
`INGEST_SECRET` script properties (matching Vercel's `ZELLE_INGEST_SECRET`),
add a 1-minute time-driven trigger on `pollZelle`. ZELLECLOSE also fixed a bug
in the reference-code regex that would have silently broken the fallback match
key even once deployed — it looked for `FH-XXXXXX`, but the real generated
code carries the full brand short name (see §1) — the regex now matches the
general `<PREFIX>-<6 hex>` shape instead of a hardcoded prefix.

## The review alert (ZELLECLOSE)

A payment that cannot be auto-matched now raises a `payment_review`
notification (`notify_staff`) to every staff profile, landing in the same
places every other payment event does — the Dashboard needs-attention band and
`/app/ops/payments/review` (already in nav). Previously the `review` branch
only updated `payment_notifications.status`; nothing read that column
proactively, so an unmatched payment was invisible until someone happened to
open the review queue (LESSONS.md: fire-and-forget is how two real leads were
already lost this way once).

`payment_notifications.org_id` is also now set on write (previously always
`NULL`) — resolved as the single org this deployment has, the same fallback
`test/db`'s harness setup uses. This is required for the alert to route at
all (`notify_staff` needs a real org).

Separately, and NOT caused by the `org_id` gap: staff `UPDATE` (Dismiss) was
structurally blocked regardless of `org_id`. Measured live
(`BEGIN…ROLLBACK`, a real staff user, `org_id` correctly matching
`current_org()`) — the `UPDATE` still touched 0 rows. Cause: `payment_
notifications_org_boundary` is a **RESTRICTIVE** policy
(`polpermissive = false`), and the only **PERMISSIVE** policy on the table
(`payment_notifications_admin_read`) is `SELECT`-only. Postgres RLS denies a
command outright when no permissive policy applies to it, independent of
whether restrictive policies would pass — so `UPDATE` (and `INSERT`/`DELETE`)
were unreachable for `authenticated` no matter what `org_id` held.
`dismissNotification` in `src/lib/ops/api-payments.ts`'s own comment already
flagged the symptom ("KNOWN SERVER GAP … staff access is read-only until an
admin-write policy ships") without diagnosing the restrictive-vs-permissive
cause. `payment_notifications_staff_write` (new, `FOR UPDATE`, permissive,
`has_staff_access()`) is that missing policy — proven live, same
`BEGIN…ROLLBACK`, `UPDATE 1`.

## The provable trail once a payment lands

- **`status_events`** — automatic, via the `status_purchases` trigger
  (`trg_status_purchases`, BEFORE INSERT OR UPDATE OF `status`,
  `payment_status` on `purchases`): every writer that touches those two
  columns gets a row for free, so `mark_purchase_paid` (automatic match or
  staff manual mark-paid) and `_provision_purchase_for_offerings` (a booking
  created already-paid) both log identically — there is one spine, not two.
- **`receipt_sends`** — `sendOrderReceipt` (`api/_lib/receipt.ts`) logs every
  attempt, success or failure, and `claim_receipt_send` refuses a second send
  once one has succeeded. Called after an automatic match
  (`api/zelle-reconcile.ts`) and after a staff manual mark-paid
  (`api/orders-mark-paid.ts`).
- **`notify_staff('payment_received', ...)`** — as of ZELLECLOSE, fired by a
  shared internal helper (`_notify_purchase_paid`) from both writers above, so
  a booking marked "already paid" at creation notifies staff exactly like an
  automatic match does (previously it did not — flagged and fixed this task).
