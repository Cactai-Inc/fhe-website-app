# TASK A8 — Execution email: make the completing-signature email actually fire, then prove it

Tracker items: **A8** (email fires on completing signature, both parties, PDF attached,
signatures visible) and **A9** (from-name, subject, body, branding correct).
This is the single largest go-live risk on `docs/BUILD_TRACKER.md`.

## What is already known (do not re-derive; verify only where told to)

The pathway is fully built. The trace, with citations:

1. `record_signature` (latest body: `supabase/migrations/20260803020000_company_side_signing.sql:7-144`)
   substitutes signer name/date into `documents.merged_body` (lines 89-93) on EVERY signature,
   then on the completing signature flips `documents.status` to `EXECUTED` (lines 110-112).
2. That UPDATE fires trigger `documents_send_executed_email_trg`
   (`supabase/migrations/20260804050000_execution_email_state_machine.sql:124-127`), whose function
   (lines 106-122) calls `send_executed_document_email(NEW.id)` and swallows any error into
   `documents.executed_email_error` — failures are silent by design.
3. `send_executed_document_email` (same file, lines 32-80) re-checks all signatures present,
   checks `executed_email_sent_at IS NULL`, resolves `APP_BASE_URL` from `config_values`, then calls:
   `net.http_post(url := v_base || '/api/deliver-documents', body := jsonb_build_object('documentIds', ...))`
   (lines 68-72), and stamps `executed_email_sent_at`.
4. `/api/deliver-documents` (`api/deliver-documents.ts`) renders the PDF from the live
   `merged_body` (lines 150-152 → `api/_lib/documentPdf.ts:73-146`; signature lines render the
   typed name in italic script styling, `documentPdf.ts:112-124`), emails every party with the
   PDF attached (lines 227-243), and writes `document_deliveries` rows (lines 249-268).
5. Transport: `api/_lib/email.ts:142-152` — Gmail Workspace SMTP when
   `GMAIL_SMTP_USER`/`GMAIL_SMTP_PASS` are set (the launch transport); Resend is dormant fallback.
   From-name/from-email: `email.ts:57-89` — `BRAND.NAME` → `legal_entity_name` → 'Notifications';
   `CONTACT.FROM_EMAIL` → `TRANSACTIONAL_FROM_EMAIL` env → **empty string, which hard-rejects the
   send at `email.ts:149`**.

## Current state (verified live 2026-08-04 by the orchestrator)

`pg_net` **IS installed** on production (`SELECT extname FROM pg_extension` shows it), despite no
migration in the repo installing it — it was added out-of-band after the 2026-08-02 check that
found it absent (`docs/reports/PROMPT_A_STAGES_4-5.md:118-123`). All 5 most-recent EXECUTED
documents have `executed_email_sent_at` NULL **and `executed_email_error` NULL** — consistent
with them having executed BEFORE the 2026-08-04 trigger migration, not with a failing trigger.
So the pathway is plausibly whole but has never once fired on a real execution. The unknowns are
now: APP_BASE_URL config, sender identity config, endpoint auth compatibility, and one real
end-to-end proof.

DB access: `psql "$(cat .env.db)"` from the repo root. The correct project is
`lrstswfxfsezdmvkvukc` — verify the host in `.env.db` matches before writing anything.

## Work items — in this order

### 1. Confirm the diagnosis (read-only)
```sql
SELECT extname FROM pg_extension ORDER BY 1;
SELECT id, status, executed_email_sent_at, executed_email_error
  FROM documents WHERE status = 'EXECUTED' ORDER BY updated_at DESC LIMIT 10;
SELECT key, value FROM config_values WHERE key IN ('APP_BASE_URL','BRAND.NAME','CONTACT.FROM_EMAIL');
```
Record raw output in your report. Expected: `pg_net` present, recent EXECUTED docs show stamp
NULL + error NULL (they predate the trigger). If instead `executed_email_error` is POPULATED on
any doc, diagnose that error first — it changes the plan; pause and ask the owner if the fix is
not obvious config.

### 2. Pin pg_net into migration history (no live install needed)
`pg_net` is already installed live but NO migration records it — history and prod have diverged.
Write `supabase/migrations/<timestamp>_install_pg_net.sql`:
```sql
create extension if not exists pg_net;
```
Apply it live (it is a no-op against prod, which is the point — idempotent alignment), then
verify `SELECT extname FROM pg_extension WHERE extname='pg_net';` still shows it.

### 3. Verify APP_BASE_URL and endpoint compatibility
- `APP_BASE_URL` must exist in `config_values` and be the real deployed origin (https, no
  trailing slash — check how `v_base` is concatenated at migration `20260804050000` line 68-72
  and match). If missing or wrong, set it with a plain UPDATE/INSERT and record the value used.
- Read `api/deliver-documents.ts` start-to-end once. Confirm the endpoint does not require an
  Authorization header that the `net.http_post` call (which sends only Content-Type) would fail.
  If it does require auth, report that finding and pause — do not invent an auth scheme.
- Confirm `net.http_post` async semantics: it queues the request and returns an id; the trigger's
  success-stamp does NOT depend on the HTTP response. Note this in your report (it means
  `executed_email_sent_at` can be stamped even if the HTTP call later fails — check
  `net._http_response` for the actual response after firing).

### 4. Verify sender identity (A9)
- In the DB: `BRAND.NAME` and `CONTACT.FROM_EMAIL` config values for the org. If
  `CONTACT.FROM_EMAIL` is unset, the send depends on the `TRANSACTIONAL_FROM_EMAIL` env var on
  the Vercel deployment — you cannot read Vercel env from here. If the config value is unset,
  say so in the report; if the live-fire test in step 5 then fails with "no from address
  resolved" in `net._http_response`, that is the cause.
- Expected email: subject `Your signed documents — <BRAND.NAME>`, greeting `Hi <first name>,`,
  bulleted document titles, "Please keep these for your records.", footer with legal entity +
  contact info (`api/deliver-documents.ts:227-243`, `api/_lib/email.ts:57-89`).

### 5. Live fire test (the actual A8 proof)
Test document: `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3` (EXECUTED, stamp NULL, 2 parties:
LESSOR `d99f1472-...`, LESSEE `352c3898-...`).
- **First**: `SELECT c.id, c.first_name, c.last_name, c.email FROM document_parties dp JOIN
  contacts c ON c.id=dp.contact_id WHERE dp.document_id='ecaecd42-0d82-428b-b72f-b73b0cc3f9f3';`
  If any party email is NOT obviously a test/owner-controlled address, **STOP and ask the owner
  before sending anything**. Real customers must not receive test emails.
- Fire: `SELECT send_executed_document_email('ecaecd42-0d82-428b-b72f-b73b0cc3f9f3');`
- Verify, raw output in report:
  ```sql
  SELECT executed_email_sent_at, executed_email_error FROM documents
   WHERE id='ecaecd42-0d82-428b-b72f-b73b0cc3f9f3';
  SELECT id, status_code, content::text, error_msg FROM net._http_response
   ORDER BY id DESC LIMIT 3;  -- wait ~10s after firing; pg_net is async
  SELECT document_id, recipient_contact_id, channel, is_mirror, created_at
    FROM document_deliveries WHERE document_id='ecaecd42-0d82-428b-b72f-b73b0cc3f9f3'
    ORDER BY created_at DESC;
  ```
  Success = stamp non-null, error null, HTTP 200 in `net._http_response`, one new delivery row
  per party dated now. Then ask the owner to confirm the emails arrived with a PDF attachment
  showing both signature names — you cannot check an inbox; the owner can. Print exactly what
  the owner should look for (from-name, subject, attachment, both signature names visible in
  the PDF) and wait for their confirmation before writing the report's final status.
- If the HTTP response is an error: read the body, diagnose, fix (config, not code, unless the
  code is provably wrong), re-fire ONCE via `resend_executed_document_email(...)`, and log both
  attempts in the report. If the retry also fails, log the failure and stop per protocol.

### 6. Trigger-path proof (automatic firing, not just manual)
The live fire in step 5 proves the dispatch function; it does not prove the trigger fires on a
real completing signature. Prove it cheaply without inventing a fake contract:
```sql
BEGIN;
UPDATE documents SET status='DRAFT' WHERE id='<pick a SECOND executed test doc, NOT the step-5 doc>';
UPDATE documents SET status='EXECUTED' WHERE id='<same>';
SELECT executed_email_sent_at, executed_email_error FROM documents WHERE id='<same>';
ROLLBACK;  -- pg_net queues the HTTP call transactionally? NO — net.http_post survives via the
           -- queue table only on COMMIT; a rollback cancels it. So run this WITHOUT rollback
           -- ONLY IF that second doc's parties are also test addresses, else use rollback and
           -- accept that the in-transaction stamp check alone proves the trigger wiring.
```
If no second safe test document exists, the ROLLBACK variant is acceptable proof of trigger
wiring (stamp visible inside the transaction = trigger + function ran); say which variant you
used. Do not manufacture new signed documents for this.

### 7. Update the tracker
In `docs/BUILD_TRACKER.md`: set A8 and A9 statuses to what you actually proved, with the date
and one-line evidence. Do not mark DONE unless the owner confirmed inbox receipt (A8) and
content correctness (A9). Owner-confirmed = DONE; everything else = the honest lesser status.

## Rules
- Branch: `task/a8-execution-email` off `origin/main`. Work ONLY in your own worktree (this
  shared checkout has had branches switched underneath running sessions before — see
  `docs/reports/TASK-A8B-REPORT.md` branch-name note). `git worktree add` is the safe pattern.
- The DB is production. Every write you make must be listed in the report. No schema changes
  beyond the pg_net migration. No deletes.
- Done-checks before commit: `npm run typecheck`, `npm run typecheck:api`, `npm run lint`
  (baseline: 29 pre-existing warnings, 0 errors) — required even though this task is mostly
  SQL, because the report and migration file are part of the branch.
- Report: `docs/reports/TASK-A8-REPORT.md`, committed on the branch, pushed. Include: raw psql
  outputs for every check above, every DB write made, deviations with reasons, retry log if any.
  Print ONLY the report path in chat when finished.
- Honesty rule: nothing may be described as done that was not observed. "The owner confirmed
  receipt" may only appear if the owner actually confirmed in your chat.
