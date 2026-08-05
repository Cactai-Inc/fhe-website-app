# TASK A15 — delivery failures surfaced to admin

Tracker item **A15 only**. Context: A8/A9 are DONE — execution email fires and is proven live.
What's missing is the failure side: today a send that fails does so silently.

## Verified current state (orchestrator, 2026-08-04/05 — trust this)

- `send_executed_document_email` dispatches via `net.http_post` with NO
  `timeout_milliseconds`, so pg_net's 5000ms default applies — and the endpoint legitimately
  takes 6–8s (PDF + SMTP), so `net._http_response` records FALSE timeouts on real successes
  (proven twice on 2026-08-05, requests 4 and 5; both sends actually succeeded). Any
  failure-detection built on `net._http_response` without fixing this will false-alarm on
  every normal send.
- `documents.executed_email_error` is set only by the TRIGGER's exception handler (sync
  failures before/at queue time). Async failures (HTTP error, endpoint crash, SMTP reject)
  never reach it — the stamp gets set at queue time regardless of what happens after.
- The real, durable success signal is `document_deliveries`: the endpoint inserts a row per
  recipient ONLY after `sendViaProvider` returns ok. Stamp set + missing delivery rows =
  something failed downstream.
- `undelivered_executed_documents()` already exists
  (`supabase/migrations/20260804040000_undelivered_executed_documents.sql`) as a finder for
  executed docs with no delivery — but NOTHING schedules it. Read it first; reuse/extend it
  rather than building a parallel finder.
- Cron precedent: check `vercel.json` for existing cron entries (`calendar-reminders`,
  `expire-holds` were built as crons) and copy that exact wiring pattern.
- `notify_staff(org, kind, title, link)` is the alert primitive; C10's
  `notify_minor_delivery_skipped` shows the definer-wrapper pattern if the API layer needs to
  call it.
- True mailbox-level bounces (SMTP accepted, bounced later) are OUT OF SCOPE — Gmail SMTP
  gives no webhook; record this as a known limitation in the report and tracker, build
  nothing for it.

## Locked design

1. **Migration 1 — truthful monitoring**: `CREATE OR REPLACE send_executed_document_email`,
   live body carried forward unchanged except `net.http_post(..., timeout_milliseconds :=
   15000)`. (Verify the exact named-argument syntax against the installed pg_net version —
   check `net.http_post`'s function signature in the `net` schema first.)
2. **Sweep, DB-side** (same or second migration): `sweep_undelivered_executed_documents()`
   SECURITY DEFINER — for each executed, non-deleted document where `executed_email_sent_at
   < now() - interval '10 minutes'` AND at least one NON-mirror party recipient has no
   `document_deliveries` row: raise ONE `notify_staff` per document (kind
   `delivery_failure`, title naming the document + the missing recipients, link to the
   document's ops page), then mark the document so the alert never repeats — write
   `executed_email_error = 'ALERT RAISED <timestamp>: no delivery for <roles/names>'`
   (the column is free precisely because async failures never populate it; the sweep skips
   any doc where it's already non-null). Reuse `undelivered_executed_documents()` internally
   if its shape fits; extend it if close; replace it ONLY if unusable, and say which you did.
   Minors are NOT missing recipients when their delivery went guardian-addressed (the
   delivery row carries the minor as recipient_contact_id per C10) — but a minor SKIPPED for
   no-guardian already alerted via C10's path; exclude those from this sweep's alert to
   avoid double-alerting (detect via the C10 notification or simply exclude minor parties
   with no guardian email — state your method).
3. **Cron**: a thin `/api/delivery-sweep` endpoint that calls the sweep RPC via the admin
   client, wired into `vercel.json` on the same schedule pattern as the existing crons
   (hourly is fine). Copy auth posture from the existing cron endpoints exactly.
4. **Backstop the past**: run the sweep once manually after applying — any EXISTING executed
   docs with stamp-but-no-delivery get their one-time alert now (expected: the docs stamped
   before the trigger existed have stamp NULL, so they will NOT alert — that's correct;
   only genuinely-stamped-but-undelivered docs alert). Record what it found.

## Proof
- `\df net.http_post` signature + the migration diff showing only the timeout addition.
- Rolled-back simulation: pick a stamped test doc, delete... NO — never delete delivery
  rows. Instead: `BEGIN;` create a synthetic state (INSERT a throwaway EXECUTED-shaped
  document row + party + stamp inside the transaction), run the sweep, show the
  notification row + the error-marker write, `ROLLBACK;` zero residue (prove by counts).
- Live: fire the real sweep once (item 4); show its output and any notifications created.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors). Update tracker A15 honestly (include the bounce limitation note).

## Rules
- Branch `task/a15-delivery-failures` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-a15 -b task/a15-delivery-failures origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB writes: the migration(s) + the one live sweep run + rolled-back proofs.
  Everything logged. REVOKE default grants on new functions from public/anon/authenticated
  (C10's gotcha); the sweep RPC is service_role-only.
- `ClauseDocument.tsx` FROZEN. Signed documents never deleted; delivery rows never deleted.
- Report: `docs/reports/TASK-A15-REPORT.md`, committed + pushed. Print ONLY the report path.
