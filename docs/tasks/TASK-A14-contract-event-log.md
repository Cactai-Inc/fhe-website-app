# TASK A14 — Contract-scoped event log, visible to admin

Tracker item: **A14** — "Contract-scoped EVENT LOG visible to admin (sent, opened, signed,
delivered)". Current status PARTIAL: the data exists (`contract_change_log`, `status_events`,
`document_deliveries`, `signatures`), there is no admin surface that shows it.

## Scope — build exactly this

One read RPC + one staff-only UI card on the contract page. Nothing else. Do NOT build any new
event *capture* (no tracking pixels, no new triggers, no new tables). This task surfaces what is
already recorded.

### 1. Characterize the sources first (read-only, in the DB)
`psql "$(cat .env.db)"` — describe each and note which columns carry: timestamp, actor, event
kind, document linkage:
- `status_events` (document status transitions)
- `document_deliveries` (sent/delivered rows; note `is_mirror`, `channel`, `recipient_contact_id`)
- `signatures` (`signed_at`, signer, role — signed events)
- `contract_change_log` (field edits — these will be summarized, not itemized)
Record the actual schemas in your report. If a table above does not exist under that exact name,
find the real name (`\dt *event*`, `\dt *deliver*`, `\dt *change*`) — do not invent one.

**"Opened" events:** only include them if an existing source records opens (look for anything
like `document_views`, `opened_at`, or open events in `status_events`). If no source exists —
expected — state that in the report as a known gap and move on. Do NOT build open tracking.

### 2. RPC: `contract_event_log(p_document_id uuid)`
New migration. SECURITY DEFINER, staff-gated with the same check other staff RPCs use (find one
existing staff-gated RPC and copy its guard verbatim — likely `has_staff_access()`; confirm by
reading, don't assume). Returns a unified, reverse-chronological set:
`(occurred_at timestamptz, kind text, actor text, detail text)` where kind is one of
`STATUS`, `SENT`, `DELIVERED`, `SIGNED`, `EDITS`, and:
- STATUS rows from `status_events` scoped to the document (actor = who, detail = from→to).
- SENT/DELIVERED from `document_deliveries` (detail = recipient name + channel; mark mirror
  copies as such in detail; use whatever status distinction the table actually has — if it only
  records the send, the kind is SENT, do not fabricate DELIVERED).
- SIGNED from `signatures` where `signed_at` is not null (actor = signer name, detail = role).
  Include superseded/archived signature events only if trivially available; otherwise current
  rows are enough.
- EDITS from `contract_change_log`: ONE summary row per calendar day per editor
  ("N field edits"), not one row per edit — the change log is high-volume and itemized display
  is a different feature.
Dry-run the migration in `BEGIN;...ROLLBACK;`, then apply live, then verify with
`SELECT * FROM contract_event_log('<a real executed doc id>');` — raw output in the report.

### 3. UI: staff-only "Activity" card on `src/pages/app/ContractPage.tsx`
- Placement: with the other staff-only cards (the executed-state "Manage" card is at
  `ContractPage.tsx:~1373`; put Activity adjacent, but visible at ANY status, gated `isStaff`).
- Collapsed by default (a count + latest event line), expands to the reverse-chron list.
- Each row: relative-or-short date, kind badge, actor, detail. Match the page's existing card
  styling exactly — read neighboring cards and mirror their classes; do not introduce new
  visual patterns.
- Client wrapper in `src/lib/contracts.ts` (or wherever the page's other RPC calls live —
  match the existing pattern).

### 4. Done-checks
- `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29 warnings, 0 errors).
- Live RPC call output for a real document showing at least SENT and SIGNED events.
- The RPC rejects a non-staff caller: demonstrate the guard exists by citing the guard line and
  its identical use in an existing staff RPC (a live negative test needs a party JWT — if you
  cannot mint one, the citation + identical-guard argument is the accepted evidence; say which
  you did).
- Update `docs/BUILD_TRACKER.md` A14 with honest status + date + one-line evidence.

## Rules
- Branch `task/a14-event-log` off `origin/main`, in your OWN worktree (`git worktree add`) —
  the shared checkout gets switched underneath running sessions.
- Copy this doc and `.env.db` from the shared checkout into your worktree (both are untracked).
- Production DB: the only writes allowed are the one migration and nothing else. List every
  statement executed in the report.
- Report: `docs/reports/TASK-A14-REPORT.md` committed + pushed on the branch. Raw outputs, every
  deviation with reason, retry log if any. Print ONLY the report path in chat when done.
- Honesty rule: nothing described as done that was not observed.
