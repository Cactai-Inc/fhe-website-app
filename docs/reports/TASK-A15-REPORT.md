# TASK A15 — delivery failures surfaced to admin

Status: **DONE**, applied to production. Branch `task/a15-delivery-failures`, own worktree.

## What shipped

1. **Migration 1 — truthful monitoring** (`supabase/migrations/20260805030000_a15_delivery_timeout_fix.sql`)
   `CREATE OR REPLACE send_executed_document_email`, live body carried forward
   unchanged except `net.http_post(..., timeout_milliseconds := 15000)`.
   pg_net's default is 5000ms; `/api/deliver-documents` legitimately takes
   6-8s (PDF render + SMTP), so `net._http_response` was recording false
   timeouts on real successes. This had to land first — any failure detector
   built on the old timeout would false-alarm on every normal send.

2. **Migration 2 — the sweep** (`supabase/migrations/20260805031000_a15_sweep_undelivered_executed_documents.sql`)
   `sweep_undelivered_executed_documents(p_limit integer DEFAULT 500)`,
   SECURITY DEFINER, service_role-only. For each executed, non-deleted
   document where `executed_email_sent_at < now() - interval '10 minutes'`
   and at least one non-mirror party recipient has no `document_deliveries`
   row: raises one `notify_staff` (kind `delivery_failure`, title naming the
   document + missing recipients by name/role, link to
   `/app/ops/documents/<id>`), then writes
   `executed_email_error = 'ALERT RAISED <timestamp>: no delivery for <names>'`
   so the alert never repeats (the sweep skips any doc where that column is
   already non-null). Docs with `executed_email_sent_at IS NULL` (stamped
   before this system existed) are correctly excluded — a NULL stamp means
   the email was never queued at all, a different, already-known condition,
   not a delivery failure.

3. **Cron** (`api/delivery-sweep.ts` + `vercel.json`)
   Thin endpoint that calls the sweep RPC via the admin client, hourly
   (`0 * * * *`), same slot as `expire-holds`/`calendar-reminders`. Auth
   posture copied exactly: Vercel cron (`x-vercel-cron` header) or
   `Bearer CRON_SECRET` for manual runs.

4. **Backstop the past** — the live sweep was run once against production
   after applying (see Proof below): 0 alerts, because all 37 currently
   undelivered executed documents have `executed_email_sent_at IS NULL`
   (they predate the stamping trigger) — exactly the outcome the task doc
   predicted as correct.

## Reuse decision: `undelivered_executed_documents()`

**Reused as-is**, unmodified, as the sweep's candidate generator — its shape
(document_id + missing_recipients count, built on the exact
party/delivery/contact join with the `contacts.email` non-empty filter) was
close enough to use directly, called with `p_grace_minutes := 0` so its own
`updated_at`-based grace can never exclude a real candidate. The sweep then
applies its own, more precise gate on top (`executed_email_sent_at`, the
actual send-attempt timestamp, per the locked design) plus its own
idempotency check (`executed_email_error IS NULL`) and a second targeted
query to build the human-readable missing-recipient names for the alert
title — details the finder's shape doesn't carry and that only the sweep
needs. No changes to the finder's function signature or behavior; nothing
else in the codebase calls it, so this was a low-risk seam either way, but
extending/replacing it wasn't necessary.

## Minor exclusion — method

The C10 guard trigger (`contacts_minor_no_email_guard`,
`20260804150000_minor_delivery_guard.sql`) makes it a hard DB invariant that
a minor contact never carries a direct email. `undelivered_executed_documents()`
joins `document_parties` to `contacts` requiring
`coalesce(btrim(c.email), '') <> ''` — this filter transitively excludes
**every** minor party from the missing-recipient set:
- guardian-addressed minors: delivered under the minor's own
  `recipient_contact_id` per C10 (`api/_lib/delivery.ts`'s
  `resolveMinorRecipient`), so they were never "missing" anyway;
- no-guardian-skipped minors: never delivered, but already alerted once via
  `notify_minor_delivery_skipped` at send time — counting them here would
  double-alert.

No extra minor-specific filtering was written; it falls out of the
email-non-empty join already present in the reused finder. Stated per the
task doc's "simply exclude minor parties with no guardian email — state your
method" option.

## Proof

**`\df net.http_post` signature** (verified live before writing the fix):
```
net | http_post | bigint | url text, body jsonb DEFAULT '{}'::jsonb, params jsonb DEFAULT '{}'::jsonb,
      headers jsonb DEFAULT '{"Content-Type": "application/json"}'::jsonb, timeout_milliseconds integer DEFAULT 5000
```
Named-argument syntax `timeout_milliseconds := 15000` matches exactly.

**Migration diff — only the timeout addition** in `send_executed_document_email`:
```sql
   SELECT net.http_post(
            url     := v_base || '/api/deliver-documents',
            body    := jsonb_build_object('documentIds', jsonb_build_array(p_document_id::text)),
-           headers := '{"Content-Type": "application/json"}'::jsonb
+           headers := '{"Content-Type": "application/json"}'::jsonb,
+           timeout_milliseconds := 15000
          ) INTO v_req;
```
Everything else in the function body is byte-for-byte unchanged from the
live version pulled via `pg_get_functiondef` before editing.

**Rolled-back simulation** (`BEGIN; ... ROLLBACK;`, never deleting anything):
Baseline counts before: `documents=65, notifications=27, document_parties=95, document_deliveries=30`.
Inserted a synthetic EXECUTED document (id `00000000-0000-4000-8000-000000000a15`,
title "A15 SYNTHETIC TEST DOC") stamped 20 minutes in the past, with one
party (a real contact, Audrey Slater) and deliberately **no**
`document_deliveries` row for her.
- `undelivered_executed_documents(500, 0)` correctly listed it as a candidate
  (`missing_recipients = 1`).
- `sweep_undelivered_executed_documents(500)` alerted:
  `document_id=...a15, org_id=e656f20b-..., missing_count=1, notified=true`.
- Notification row created: `kind=delivery_failure`,
  `title="A15 SYNTHETIC TEST DOC (TEST-A15) — delivery failed for: Audrey Slater (CLIENT)"`,
  `link=/app/ops/documents/00000000-0000-4000-8000-000000000a15` (2 rows —
  one per staff profile, `notify_staff`'s existing fan-out behavior, not new
  here).
- `documents.executed_email_error` was written:
  `"ALERT RAISED 2026-08-05 04:00:20...: no delivery for Audrey Slater (CLIENT)"`.
- Second call to the sweep in the same transaction returned **0 rows** —
  confirms the already-alerted doc is never re-alerted.
- `ROLLBACK`. Counts after: `documents=65, notifications=27, document_parties=95,
  document_deliveries=30` — identical to baseline. Zero residue.

**Live: real sweep fired once** (item 4, backstop the past):
```
SELECT * FROM sweep_undelivered_executed_documents(500);
 document_id | org_id | missing_count | notified
-------------+--------+---------------+----------
(0 rows)
```
`notifications` count unchanged (27 before and after). Confirmed why: all 37
current candidates from the reused finder have `executed_email_sent_at IS
NULL` (`with_stamp = 0` of 37) — they predate the stamping trigger, so per
the locked design they correctly do NOT alert. Only genuinely
stamped-but-undelivered documents will alert going forward.

**Done-checks:**
- `npm run typecheck` — 0 errors.
- `npm run typecheck:api` — 0 errors.
- `npm run lint` — 0 errors, 29 warnings (matches stated baseline; no new
  warnings from `api/delivery-sweep.ts` or the migrations).

## Known limitation (recorded per the task doc, nothing built for it)

True mailbox-level bounces (SMTP accepts the message, then bounces later)
are **out of scope**. Gmail SMTP gives no bounce webhook to observe them —
there is no signal this system can act on. What this task *does* catch is
every failure that happens before or during the send attempt (timeout,
HTTP error, endpoint crash, provider rejection) — anything that prevents a
`document_deliveries` row from ever being written.

## Files changed

- `supabase/migrations/20260805030000_a15_delivery_timeout_fix.sql` (new)
- `supabase/migrations/20260805031000_a15_sweep_undelivered_executed_documents.sql` (new)
- `api/delivery-sweep.ts` (new)
- `vercel.json` (added the `/api/delivery-sweep` hourly cron entry)
- `docs/BUILD_TRACKER.md` (A15 row updated)
- `docs/tasks/TASK-A15-delivery-failures.md` (copied into the worktree per the task instructions)
