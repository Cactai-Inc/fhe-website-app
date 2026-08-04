# TASK B — Lead/inbound notifications: email to hello@, in-app, nav badge

Branch: `task/b-lead-notifications` (from current main).
Scope: exactly this document.

## Goal
Every public website form submission (booking request / contact / support —
anything that lands in the `requests` table or support tables) must produce:
1. An EMAIL to the org ops inbox (config `CONTACT/OPS_INBOX`, fallback
   hello@fhequestrian.com — resolve via existing config, never hardcode a new
   literal; `api/calendar-reminders.ts` shows the existing resolution pattern).
2. An IN-APP staff notification (`notify_staff(...)` — existing producer).
3. A persistent UNREAD-COUNT badge on the "Inbound" nav item in
   `src/components/app/AppLayout.tsx` (management group), mirroring how the
   Dashboard badge works there (`useUnreadCount` pattern; see QUICK array
   badge wiring). Badge counts OPEN inbound items (requests with status 'new'
   + open support), not notifications.

## Phase 1 — VERIFY FIRST (report findings before changing anything)
For each of the three outcomes, trace the live path and state built/missing:
- Which api route or RPC handles public form submission (`api/request-received.ts`
  exists — read it), what it currently sends, and to whom.
- Whether notify_staff fires on submission today (check the submission path in
  SQL: `psql "$(cat .env.db)"` — find the requests INSERT path / triggers).
- What the Inbound nav renders today (AppLayout.tsx MANAGEMENT_GROUP).
Put findings in the report. THEN build only what is missing. If all three
already work, prove it with evidence and build nothing.

## Build rules
- Reuse existing producers (`notify_staff`, the email identity resolver in
  `api/_lib/email.ts`). No new email templates beyond minimal subject/body if
  none exists: subject "New website inquiry — <name>", body with name, contact
  info, what they asked for, and a link to /app/ops/intake?request=<id>.
- Email send belongs server-side where the submission lands (api route or DB
  trigger via pg_net following the pattern in migration
  20260804050000_execution_email_state_machine.sql). Pick whichever layer the
  submission already flows through — do not add a second path.
- notifications.link is NOT NULL — always pass a link.
- Badge: poll on route change like useUnreadCount does; count from a small RPC
  (create `inbound_open_count()` returning int, staff-only) rather than
  client-side table scans.

## Done-checks (raw output in report)
- typecheck 0 errors, lint 0 errors.
- Insert a test request row via the real submission path (api handler function
  or RPC it uses) with a throwaway email; show: the notification row created,
  the email dispatch attempted (pg_net response row or api log path), and
  inbound_open_count() incremented. Then delete the test row(s) and show zero
  residue.
- Screenshot-level description of where the badge renders (file:line).

## Report
docs/reports/TASK-B-REPORT.md on your branch. Same rules: file:line per change,
raw outputs, retries/failures logged, deviations justified. Print only report
path + branch when finished.
