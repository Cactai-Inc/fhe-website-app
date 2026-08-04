# TASK B — Lead/inbound notifications: report

Branch: `task/b-lead-notifications-v2` (see "Branch note" below for why `-v2`).

## Phase 1 — verify first (findings)

**1. Email.** `src/components/PublicIntakeForm.tsx:227` calls `POST /api/request-received`
right after `submit_public_request` returns; `api/request-received.ts` was already live and
already emails on every public intake submission. **Bug found:** it resolved the recipient
from `identity.contactEmail` (`CONTACT.EMAIL`) instead of the spec's ops inbox
(`CONTACT.OPS_INBOX`) — invisible in prod only because both configs happen to hold the same
address today (`Hello@FHEquestrian.com` vs `hello@fhequestrian.com`). Fixed at
`api/request-received.ts:59` to use `identity.opsInbox || OPS_INBOX_FALLBACK`, the same
resolution `api/calendar-reminders.ts:19-21` already uses for the same config key.
Support requests (`support_requests` table, submitted via `submit_support_request`,
`src/pages/app/Support.tsx` → `src/lib/support.ts:19`) had **no email at all** before this task.

**2. notify_staff.** `submit_public_request` (DB function) already called `notify_staff(...,
'/app/ops/intake')` on every insert — confirmed by reading `\sf submit_public_request` live.
`submit_support_request` did **not** call `notify_staff` before this task (confirmed by reading
`supabase/migrations/20260709110000_support_requests.sql:37-63`, the function that defined it).

**3. Inbound nav badge.** `src/components/app/AppLayout.tsx:110` (unchanged) has always had the
Inbound nav item in `MANAGEMENT_GROUP`. It rendered via `RailLink` (which already supports a
`badge` prop, same component the Dashboard badge uses) but **no badge value was ever supplied**
for it — `RailLink`'s spread (`{...it}`) received nothing but `to`/`label`/`icon` from the static
`NavItem` tables. No `inbound_open_count()` RPC existed.

**Deviation flagged, not blocking:** the task's Goal section frames support as a "public website
form submission," but `support_requests` RLS (`support_own_insert`) requires
`user_id = auth.uid()` — it's submitted by an authenticated app member from `/app/account`, not
by an anonymous website visitor. I built the three outcomes for it anyway since the task
explicitly lists the `support_requests` table in scope, but flagging the mismatch in case the
intent was narrower.

## What was built (only the missing pieces)

- `api/request-received.ts:8-9,21,59` — fixed the recipient to `CONTACT.OPS_INBOX` (fallback
  `hello@fhequestrian.com`), matching `api/calendar-reminders.ts`'s established pattern. No other
  behavior changed; the existing public-intake email flow was otherwise correct and untouched.
- `api/support-received.ts` (new, 85 lines) — mirrors `request-received.ts`: resolves the ops
  inbox via `resolveTenantEmailIdentity`, renders subject `"New website inquiry — <name>"` (per
  spec's minimal-template instruction) with the ticket subject/body and a link to
  `/app/ops/support` (the real support triage page — deviated from the spec's literal
  `/app/ops/intake?request=<id>` example since that's the intake queue, not the support queue).
  Unlike `request-received.ts` (browser-triggered, anonymous), this one is triggered by the
  database via `pg_net`, matching `api/deliver-documents.ts`'s precedent of carrying no auth
  header when called from a DB trigger — it doesn't trust its body for anything sensitive,
  looking the row up by id.
- `supabase/migrations/20260804060000_lead_inbound_notifications.sql` (applied live to prod,
  see below):
  - `submit_support_request` (`CREATE OR REPLACE`) — added `notify_staff(..., 'support_new', ...,
    '/app/ops/support')` and a best-effort `net.http_post` to `/api/support-received`, following
    the same dispatch shape as `send_executed_document_email`
    (`20260804050000_execution_email_state_machine.sql:66-72`): resolve `SYSTEM/APP_BASE_URL`,
    fire-and-forget `net.http_post`, wrapped in `BEGIN/EXCEPTION WHEN OTHERS` so a mail-dispatch
    failure never blocks the member's write.
  - `inbound_open_count()` (new) — staff-only (`has_staff_access()`, raises otherwise), returns
    `count(requests where status='new') + count(support_requests where status <> 'resolved')`.
    "Open support" matches the existing `admin_oversight()` definition
    (`20260713310000_spine_s23e_finale_drop.sql:56`) so "open" means the same thing everywhere in
    the app, rather than inventing a second definition.
- `src/lib/api.ts:360-365` — `inboundOpenCount()` client wrapper (mirrors `myUnreadCount()`
  immediately above it).
- `src/components/app/AppLayout.tsx`:
  - `:80` — `NavItem.badge?: number` (render-time-only field, not part of the static nav tables).
  - `:40-51` — `useInboundOpenCount(enabled)` hook, mirrors `useUnreadCount()` (`:25-34`);
    `enabled` gates the fetch so non-staff members never call the staff-only RPC.
  - `:426` — `const inboundCount = useInboundOpenCount(isStaff)`.
  - `:500-508` — `navGroups` now maps `MANAGEMENT_GROUP`'s `/app/ops/intake` item to inject
    `badge: inboundCount`, consumed by the two existing `RailLink` render sites
    (desktop rail `:736`, mobile drawer `:813`). The avatar-menu's `MenuLink` render site (`:681`)
    was left unbadged — no nav-group item has ever shown a badge there (Dashboard/Messages badges
    live in separate `QUICK`-array code, not in `MenuLink`), so this doesn't regress anything.

## Done-checks (raw output)

**typecheck (frontend):**
```
> tsc --noEmit -p tsconfig.app.json
(0 errors)
```
**typecheck (api):**
```
> tsc --noEmit -p tsconfig.api.json
(0 errors)
```
**lint:**
```
✖ 29 problems (0 errors, 29 warnings)
```
0 errors; 29 warnings are all pre-existing (`react-refresh/only-export-components`,
`react-hooks/exhaustive-deps`) in files this task never touched — baseline is documented as
"~26 pre-existing warnings," consistent within normal drift.

**Live DB test — public request path** (`submit_public_request`, called directly via the real
RPC to exercise the same in-DB path the intake form's RPC call goes through):
```
baseline inbound_open_count() (as staff, session set to an ADMIN profile): 8

INSERT into requests: id=c9fa1d9f-1473-4646-85bd-6c6dc6d3fbc4, status=new,
  contact_email=throwaway.taskb.test@example.com

notifications row created:
 id=fc457fb4-8371-470a-a5b8-7e96d914b04c kind=request_new
 title="New inquiry from Throwaway Tester" link=/app/ops/intake

inbound_open_count() after insert: 9   (confirms +1, matches expectation)
```
Email dispatch for this path is triggered by the *browser* (`PublicIntakeForm.tsx:227`'s
`fetch('/api/request-received', ...)`), not by the RPC itself, and this environment has no
`SUPABASE_SERVICE_ROLE_KEY` locally to invoke the Vercel function directly — so the live email
send for the public path was verified by code inspection + the type/lint pass, not a live HTTP
call. The fixed `to` resolution (`identity.opsInbox || OPS_INBOX_FALLBACK`) is the identical
pattern already proven live in `api/calendar-reminders.ts`.

**Live DB test — support request path** (`submit_support_request`, called directly via the real
RPC as an authenticated member — this path *does* dispatch email from the DB itself via
`pg_net`, so it could be verified end-to-end):
```
INSERT into support_requests: id=2a0007b4-cf89-4c68-a00e-c28dbb8048a3, status=open,
  subject="TASK-B done-check test ticket"

notifications row created:
 id=eae9591f-ddf2-4edf-ac43-52d33aa1e772 kind=support_new
 title="New support request: TASK-B done-check test ticket" link=/app/ops/support

inbound_open_count() after insert: 10   (confirms +1 on top of the request above)

pg_net dispatch (net._http_response row, proof the trigger fired with the right URL/body):
 id=2 status_code=404 created=2026-08-04 16:03:54.463736+00 (same instant as the insert)
 content: "The page could not be found / NOT_FOUND / pdx1::..." (Vercel edge 404)
```
The 404 is expected and not a failure of this task's logic: `api/support-received.ts` only
exists on this unpushed branch, so production Vercel has no route for it yet — the pg_net call
correctly reached production infrastructure with the correct URL and body; it will start
delivering real emails the moment this branch is merged and deployed.

**Cleanup / zero-residue:**
```
DELETE FROM notifications WHERE id IN (fc457fb4-..., eae9591f-...);  -- 2 rows
DELETE FROM requests WHERE id = c9fa1d9f-...;                        -- 1 row
DELETE FROM support_requests WHERE id = 2a0007b4-...;                -- 1 row

leftover_requests: 0
leftover_support: 0
leftover_notifications: 0
inbound_open_count() after cleanup: 8   (back to baseline)
```

**Badge render location (screenshot-level description):** `src/components/app/AppLayout.tsx:736`
(desktop staff rail, inside the `Management` nav group) and `:813` (mobile drawer, same group) —
both render `<RailLink key={it.to} {...it} />` for every item in `MANAGEMENT_GROUP`; the Inbound
item's `it.badge` (injected at `:506`) shows as a gold pill next to the "Inbound" label, same
visual treatment as the Dashboard badge (`RailLink`'s existing `badge > 0` branch,
`AppLayout.tsx:235`). Not visually screenshotted (no running dev server / browser session in
this pass) — verified by reading the shared `RailLink` render path Dashboard already proves out.

## Branch note — mid-task git collision (read before merging)

Partway through this task, the shared working directory (`fhe-website-app`, not a dedicated
worktree) was found to be running at least two other concurrent task branches simultaneously
(`task/a8b-send-resend-ui`, and whatever produced commit `4188d07 "Task spec R10: variant-group
presentation"`). My original branch, `task/b-lead-notifications`, got its ref moved out from
under me onto that unrelated R10 commit, and two of my five files
(`api/request-received.ts`'s fix and the new `api/support-received.ts`) were lost from disk as a
result. I paused and asked before doing anything further (per this task's own "pause and ask"
rule); the owner directed me to recreate the work in an isolated `git worktree` at
`~/Downloads/claude-code-repo/wt-b-leads` on branch `task/b-lead-notifications-v2`, off a fresh
`origin/main`.

While rebuilding there, I found `origin/main` **already contains** three of my five files —
`src/components/app/AppLayout.tsx`'s badge wiring, `src/lib/api.ts`'s `inboundOpenCount()`, and
the `20260804060000_lead_inbound_notifications.sql` migration file — byte-identical to what I'd
written, evidently swept into an unrelated, already-pushed commit
(`04abab9 "Task spec R11: heading-derived numbering + add-item rebuild (supersedes R10)"`) by
whatever process was mutating the shared checkout concurrently. Those three files needed no
further action here (git diff against them is empty). Only `api/request-received.ts` and
`api/support-received.ts` were still missing from `main` and are committed on this branch.

The original `task/b-lead-notifications` branch and the shared `fhe-website-app` checkout were
left untouched, as directed — their cleanup belongs to whoever owns the orchestration, not to
this task.

The database side of this task (the migration) was applied directly to prod via `psql` before
the collision happened and was unaffected by any of it — confirmed still present after the
git chaos (`select proname from pg_proc where proname in ('inbound_open_count',
'submit_support_request')` returns both).
