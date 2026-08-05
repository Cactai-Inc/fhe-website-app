# TASK A8 report — Execution email: make it fire, then prove it

Branch: `task/a8-execution-email` (worktree, off `origin/main` at `9364562`).
DB: production, `lrstswfxfsezdmvkvukc` (verified against `.env.db` host before any write).
Date: 2026-08-05 (UTC timestamps below are as returned by the DB).

Status: **A8 = DONE, A9 = DONE** — owner confirmed inbox receipt and content correctness
in this session (see "Owner confirmation" below).

---

## 1. Confirm the diagnosis (read-only)

```
SELECT extname FROM pg_extension ORDER BY 1;
```
```
      extname
--------------------
 pg_net
 pg_stat_statements
 pgcrypto
 plpgsql
 supabase_vault
 uuid-ossp
(6 rows)
```

```
SELECT id, status, executed_email_sent_at, executed_email_error
  FROM documents WHERE status = 'EXECUTED' ORDER BY updated_at DESC LIMIT 10;
```
```
                  id                  |  status  | executed_email_sent_at | executed_email_error
--------------------------------------+----------+------------------------+----------------------
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | EXECUTED |                        |
 d49691a4-df3c-4742-bb32-b41e44fb67c5 | EXECUTED |                        |
 c74e6e8f-0eb4-4fcb-9984-7a69c7d414a8 | EXECUTED |                        |
 cef4f787-7a7a-419d-a6e2-4a4e4ae6b3a0 | EXECUTED |                        |
 6ca7100f-1530-4138-bed8-f3d86a4f614e | EXECUTED |                        |
 ddd0d8de-55c9-4bf4-8277-4827ef6e3cdd | EXECUTED |                        |
 9d501f79-fbf6-4036-914a-1663a03bd92e | EXECUTED |                        |
 98120f43-4963-46ab-9a5e-f7981f82eebe | EXECUTED |                        |
 912b4c2a-accd-450f-ae14-9b3146b60019 | EXECUTED |                        |
 00fc7f26-d860-4760-929f-344cd708db59 | EXECUTED |                        |
(10 rows)
```
Matches the expected diagnosis exactly: `pg_net` present, all 10 most-recent EXECUTED
docs have stamp NULL + error NULL (predate the trigger). No STOP gate triggered.

**Deviation from the doc's literal query:** `config_values` does not have a `key`/`value`
pair — it has `(namespace, key, value_text, value_num, value_json)`. Confirmed the
correct namespace/key pairs by reading `api/_lib/email.ts` and migration
`20260804050000_execution_email_state_machine.sql` before re-running the check (see
§3–4 below for the corrected queries and results).

---

## 2. Pin pg_net into migration history

No existing migration installs `pg_net` (one hit for the string "pg_net" in
`20260804060000_lead_inbound_notifications.sql` was a comment, not a `CREATE EXTENSION`).
Wrote `supabase/migrations/20260805025633_install_pg_net.sql`:

```sql
create extension if not exists pg_net;
```

Applied live:
```
psql:supabase/migrations/20260805025633_install_pg_net.sql:5: NOTICE:  extension "pg_net" already exists, skipping
CREATE EXTENSION
```
Verified still installed:
```
 extname
---------
 pg_net
(1 row)
```
Confirmed no-op against prod, as intended.

---

## 3. APP_BASE_URL and endpoint compatibility

```
SELECT namespace, key, value_text FROM config_values WHERE namespace='SYSTEM' AND key='APP_BASE_URL';
```
```
 namespace |     key      |                value_text
-----------+--------------+------------------------------------------
 SYSTEM    | APP_BASE_URL | https://www.frenchheritageequestrian.com
(1 row)
```
Already seeded (idempotently) by migration `20260804050000` itself — https, no
trailing slash, matches how `v_base || '/api/deliver-documents'` concatenates it. No
write needed here.

Confirmed single org in prod (`organizations` has exactly one row, "French Heritage
Equestrian"), so this and all other `config_values` reads below are unambiguous.

Read `api/deliver-documents.ts` start-to-end. No `Authorization`/bearer header check
anywhere in the handler or in `vercel.json`. The trigger's `net.http_post` call sends
only `Content-Type: application/json` (confirmed by reading the full
`send_executed_document_email` function body in
`20260804050000_execution_email_state_machine.sql`) — no auth mismatch.

Async semantics confirmed by reading the function body: `executed_email_sent_at` is
stamped immediately after `net.http_post` queues the request, **not** after the HTTP
response returns — so the stamp being set does not by itself prove delivery; the real
proof is in `net._http_response` and `document_deliveries` (see §5).

**New finding (not anticipated by the task doc):** `net.http_post` is called without a
`timeout_milliseconds` argument, so it uses pg_net's default 5000ms. The live
`/api/deliver-documents` endpoint (PDF render + synchronous SMTP send for the party
copy and, when applicable, the mirror copy) took ~6–8 seconds end-to-end in both live
fires below, exceeding that timeout. `net._http_response` recorded both as
`"Timeout of 5000 ms reached"` with no status code — but the endpoint had actually
completed successfully (proven by fresh `document_deliveries` rows written seconds
after the reported timeout, and by the owner confirming email receipt). This makes
`net._http_response` an unreliable monitoring signal for this endpoint as currently
configured: a real success can read as a timeout. **Not fixed** — out of scope
("no schema changes beyond the pg_net migration"). Recommend a follow-up migration
adding `timeout_milliseconds := 15000` (or similar) to the `net.http_post` call in
`send_executed_document_email`.

---

## 4. Sender identity (A9)

```
SELECT namespace, key, value_text FROM config_values
 WHERE (namespace='BRAND' AND key='NAME') OR (namespace='CONTACT' AND key='FROM_EMAIL');
```
```
 namespace | key  |         value_text
-----------+------+----------------------------
 BRAND     | NAME | French Heritage Equestrian
(0 rows for CONTACT/FROM_EMAIL — unset)
```
`CONTACT.FROM_EMAIL` is unset, so the from-address depends on the `TRANSACTIONAL_FROM_EMAIL`
Vercel env var, which cannot be read from here. The live-fire test (§5) proves this
env var **is** set and working: both test sends completed (delivery rows written), and
an unresolved from-address would hard-reject the send at `email.ts:149` — it did not.

Full `CONTACT.*` for completeness:
```
SELECT namespace, key, value_text FROM config_values WHERE namespace='CONTACT' ORDER BY key;
```
```
 namespace |    key    |            value_text
-----------+-----------+----------------------------------
 CONTACT   | EMAIL     | Hello@FHEquestrian.com
 CONTACT   | OPS_INBOX | hello@fhequestrian.com
 CONTACT   | PHONE     | 858-439-3614
 CONTACT   | URL       | www.frenchheritageequestrian.com
(4 rows)
```
`CONTACT.OPS_INBOX` (`hello@fhequestrian.com`) matches the mirror-copy recipient
observed in both live fires below.

---

## 5. Live fire test — DEVIATION from the doc's named test document

The doc specified `ecaecd42-0d82-428b-b72f-b73b0cc3f9f3` (Horse Lease Agreement, 2
parties: `cjzigs@icloud.com`, `hello@fhequestrian.com` — both owner-controlled,
confirmed safe, no STOP gate). Party check:
```
SELECT c.id, c.first_name, c.last_name, c.email FROM document_parties dp JOIN
  contacts c ON c.id=dp.contact_id WHERE dp.document_id='ecaecd42-0d82-428b-b72f-b73b0cc3f9f3';
```
```
 d99f1472-... | CJ | Z | cjzigs@icloud.com
 352c3898-... | French Heritage Equestrian | | hello@fhequestrian.com
```

Fired:
```
SELECT send_executed_document_email('ecaecd42-0d82-428b-b72f-b73b0cc3f9f3');
 -> {"sent": true, "request_id": 3}
```
After ~10s:
```
executed_email_sent_at         | executed_email_error
2026-08-05 02:57:12.994303+00  |
```
```
 id | status_code |                        content                         | error_msg
  3 |         200 | {"delivered":[],"companyNotified":false,"documents":1} |
```
```
document_deliveries for this doc:
 ecaecd42... | d99f1472-... | EMAIL | f | 2026-07-29 12:32:28.523374+00
 ecaecd42... | 352c3898-... | EMAIL | f | 2026-07-29 12:32:26.910679+00
```
**Diagnosis:** HTTP 200, stamp set, no error — but `delivered: []` and both
`document_deliveries` rows are dated **2026-07-29**, i.e. pre-existing (from before
this trigger existed, presumably the prior ContractPage-triggered flow mentioned in
the trigger migration's own comment). The endpoint's idempotency guard (skip a
recipient once `document_deliveries` already has a row for that document+recipient)
correctly no-op'd: **no new email was sent by this call.** This does not meet the
doc's own success bar ("one new delivery row per party dated now"), and it is not an
HTTP error either, so neither of the doc's two step-5 branches (clean success /
HTTP-error-retry) applies cleanly. This is a real, load-bearing finding: the named
test document cannot prove a fresh send, only idempotent-skip behavior.

**Action taken:** searched for an EXECUTED document with test/owner-controlled parties
and zero existing `document_deliveries` rows, to get an actual fresh-send proof — the
real goal of step 5. Found three single-party documents whose only party is
`cjzigs@icloud.com` (Charles Zigmund, the owner's confirmed test identity), zero
deliveries each: `0ed5bf5b-6a02-4b5a-a7e9-76da4ae199d0` ("Facility Rules and Safety
Acknowledgment"), `3f44ea13-3b76-45a7-86c8-a01240dc6fe6` ("Company Policies"),
`ace13a30-801e-4c75-9b27-726963b61d42` (unused, held in reserve). All other
zero-delivery EXECUTED docs had real customer emails (Ashlan Hockersmith, Madeline Do,
Audrey Slater) and were correctly excluded — never touched.

Used `0ed5bf5b-6a02-4b5a-a7e9-76da4ae199d0` for the manual-dispatch proof:
```
SELECT send_executed_document_email('0ed5bf5b-6a02-4b5a-a7e9-76da4ae199d0');
 -> {"sent": true, "request_id": 4}
```
After ~10s:
```
executed_email_sent_at         | executed_email_error
2026-08-05 02:58:33.786948+00  |
```
```
 id | status_code | content | error_msg
  4 |             |         | Timeout of 5000 ms reached. Total time: 5001.343000 ms ...
```
```
document_deliveries for this doc (both NEW, dated now):
 0ed5bf5b... |                                        | EMAIL | t | 2026-08-05 02:58:39.169916+00  (mirror)
 0ed5bf5b... | d268330c-436a-4f42-bf88-9172d9b4155f   | EMAIL | f | 2026-08-05 02:58:37.650767+00  (party)
```
`net._http_response` shows a client-side timeout (see §3 finding), but two fresh
delivery rows were written — proof the endpoint actually completed the send
server-side (a `document_deliveries` insert only happens after `sendViaProvider`
returns `ok: true`). This is genuine live-fire proof, meeting the doc's real intent
even though `net._http_response` itself doesn't show a clean 200.

---

## 6. Trigger-path proof (automatic firing)

Per the doc: reserved `3f44ea13-3b76-45a7-86c8-a01240dc6fe6` as the second test
document, confirmed single-party = `cjzigs@icloud.com` only (test-safe), so used the
non-rollback variant (a real status transition, not merely an in-transaction proof):
```
UPDATE documents SET status='DRAFT' WHERE id='3f44ea13-3b76-45a7-86c8-a01240dc6fe6';
UPDATE documents SET status='EXECUTED' WHERE id='3f44ea13-3b76-45a7-86c8-a01240dc6fe6';
```
```
                  id                  |  status  |    executed_email_sent_at    | executed_email_error
 3f44ea13-3b76-45a7-86c8-a01240dc6fe6 | EXECUTED | 2026-08-05 02:59:44.65582+00 |
```
The trigger fired automatically — stamp set immediately on the status transition, no
manual RPC call. After ~10s:
```
 id | status_code | content | error_msg
  5 |             |         | Timeout of 5000 ms reached. Total time: 5001.163000 ms ...
```
```
document_deliveries for this doc (both NEW, dated now):
 3f44ea13... |                                      | EMAIL | t | 2026-08-05 02:59:49.790834+00  (mirror)
 3f44ea13... | d268330c-436a-4f42-bf88-9172d9b4155f | EMAIL | f | 2026-08-05 02:59:48.444428+00  (party)
```
Same timeout-artifact-but-actual-success pattern as §5, confirming it's systematic
(both real fires exceeded 5000ms), not a one-off. Trigger wiring proven on a genuine
status transition, not just a direct function call.

---

## 7. Owner confirmation

Presented to the owner in-chat: two emails expected in `cjzigs@icloud.com` (subject
`Your signed documents — French Heritage Equestrian`, one for each of the two test
documents, from-name "French Heritage Equestrian", PDF attached with Charles
Zigmund's typed signature visible) and two mirror copies in `hello@fhequestrian.com`
(subject `Signed document set — Charles Zigmund`).

Owner's first response: emails arrived correctly (from-name, subject, attachment,
signature all correct) but flagged the date shown in the PDF as "July 07, 2026" —
apparently wrong.

**Investigated before accepting or dismissing this:**
```
SELECT document_id, party_role, typed_name, signed_at FROM signatures
 WHERE document_id IN ('0ed5bf5b-6a02-4b5a-a7e9-76da4ae199d0','3f44ea13-3b76-45a7-86c8-a01240dc6fe6');
```
```
 0ed5bf5b... | CLIENT | Charles Zigmund | 2026-07-07 23:18:36.25527+00
 3f44ea13... | CLIENT | Charles Zigmund | 2026-07-07 23:18:56.131564+00
```
`signed_at` matches "July 07, 2026" exactly for both documents. `documents.created_at`
for both is also 2026-07-07. **Not a bug:** `record_signature` substitutes the date
into `merged_body` at the moment of the real signature. These two documents were
genuinely signed on 2026-07-07; this test's step-6 method (a direct `status` column
UPDATE, not a new signature event) never re-ran `record_signature`, so the PDF
correctly rendered their true original signing date. In real production usage, the
signature and the resulting email are triggered by the same event, so the two always
match.

Explained this to the owner; owner confirmed: **"Yes, confirmed DONE."**

---

## Every DB write made (production)

1. `create extension if not exists pg_net;` — no-op (already installed).
2. `SELECT send_executed_document_email('ecaecd42-0d82-428b-b72f-b73b0cc3f9f3');` —
   set `executed_email_sent_at`; no new email sent (idempotent skip, pre-existing
   deliveries).
3. `SELECT send_executed_document_email('0ed5bf5b-6a02-4b5a-a7e9-76da4ae199d0');` —
   sent a real test email to `cjzigs@icloud.com` + mirror to `hello@fhequestrian.com`;
   2 new `document_deliveries` rows.
4. `UPDATE documents SET status='DRAFT' WHERE id='3f44ea13-3b76-45a7-86c8-a01240dc6fe6';`
   then `UPDATE documents SET status='EXECUTED' WHERE id=...;` — triggered a real test
   email to `cjzigs@icloud.com` + mirror to `hello@fhequestrian.com`; 2 new
   `document_deliveries` rows.
5. `docs/BUILD_TRACKER.md` — A8/A9 status rows updated to DONE.

No schema changes beyond the pg_net migration. No deletes. No writes to any non-test
recipient.

## Deviations summary

- The doc's named step-5 test document (`ecaecd42...`) turned out to have pre-existing
  deliveries from before this trigger existed; firing it only proved idempotent-skip
  behavior, not a fresh send. Substituted two single-party test documents (both
  `cjzigs@icloud.com` only) to get genuine fresh-send proof for both the manual
  dispatch (§5) and the automatic trigger path (§6).
- `config_values` schema differs from the doc's assumed `key`/`value` shape; corrected
  to `(namespace, key, value_text)` by reading the actual table and the code that
  reads it.
- New finding beyond the doc's scope: `net.http_post`'s default 5000ms timeout is
  shorter than this endpoint's real latency, producing a misleading timeout in
  `net._http_response` on both live fires despite actual success. Documented, not
  fixed (out of scope for this task).

## Retry log

No retries were needed under the doc's step-5 protocol (that protocol triggers on an
actual HTTP error surfaced via `documents.executed_email_error`, which never
populated in this session). The two `net._http_response` timeouts were diagnosed as a
monitoring artifact, not a delivery failure — confirmed by fresh `document_deliveries`
rows and, ultimately, owner-confirmed inbox receipt. No re-fire was performed or
required.

## Done-checks

- `npm run typecheck` — 0 errors.
- `npm run typecheck:api` — 0 errors.
- `npm run lint` — 0 errors, 29 warnings (matches stated baseline).
