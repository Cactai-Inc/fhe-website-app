# TASK A8B — Executed-copy Send/Resend UI + recipient-targeted delivery

Branch: `task/a8b-send-resend-ui-v2`, from `origin/main` @ `523ab7f`.

**Branch-name note:** the task was originally built on `task/a8b-send-resend-ui` (created from
`origin/main` @ `778042e`, per the initial branch-creation step). Partway through, it became clear that
`~/Downloads/claude-code-repo/fhe-website-app` is a working directory shared with at least one other
concurrent process — the checked-out branch changed underneath this session more than once, and
`task/a8b-send-resend-ui`'s own ref ended up fast-forwarded onto an unrelated foreign commit ("Task spec
B: lead/inbound notifications") that this task never made. No push had happened at that point and no data
was lost — the diff was recovered via `git stash` and reapplied cleanly in a fresh, isolated
`git worktree` at `~/Downloads/claude-code-repo/wt-a8b`, checked out to a new branch,
`task/a8b-send-resend-ui-v2`, built from the then-current `origin/main` (`523ab7f`). Two unrelated files
that were swept up by the stash's `-u` flag from that other session's in-progress work
(`api/request-received.ts`, `api/support-received.ts`) were identified and excluded before committing —
they are not part of this diff. All done-checks below (typecheck, typecheck:api, lint) were re-run fresh
in the isolated worktree, on the new base, before committing.

## What was built

### 1. Recipient targeting on `/api/deliver-documents`
`api/deliver-documents.ts`:
- `api/deliver-documents.ts:81-83` — parses optional `recipientContactIds: string[]` from the body.
- `api/deliver-documents.ts:106-146` — **1b. Recipient targeting**: runs before any PDF is rendered.
  For each requested id, checks (a) is it a party on *every* document in `documentIds`
  (`document_parties` rows joined against `documentIds`), or (b) is it a staff contact of the
  documents' org (`profiles.org_id = orgId AND profiles.role IN (SUPER_ADMIN, ADMIN, MANAGER, EMPLOYEE)`,
  the same role set `has_staff_access()` checks). Anything satisfying neither is collected into
  `offending` and returned as `403 { error: "not authorized recipients: <ids>" }`.
- `api/deliver-documents.ts:160-186` — **3. Recipients**: branches on `targeted`. Untargeted keeps the
  original union-of-parties behavior verbatim. Targeted resolves `recipientContactIds` straight from
  `contacts` (not `document_parties`), because an admin "send to me" recipient may not be a party at all.
- `api/deliver-documents.ts:221-225, 258` — a targeted recipient with **zero** party rows across the
  whole document set (`partyDocsByContact.get(contact_id)` empty) is flagged `isMirrorRecipient` and its
  `document_deliveries` insert carries `is_mirror: true` — an audit copy, not a party delivery (§4).
- `api/deliver-documents.ts:288` — the company-inbox mirror notice (`if (!targeted && mirrorTo && ...)`)
  is skipped entirely for targeted sends: it is an execution-event notice, and firing it on every staff
  re-send would (a) be spam and (b) write extra `document_deliveries` rows beyond the one the done-check
  requires.
- `documents.executed_email_sent_at` is never referenced by this file for writing (grep confirms the only
  hit is the doc-comment) — a targeted send cannot touch it, by construction, not by an added guard.

### 2. Party-side Send/Resend button
`src/pages/app/Documents.tsx`:
- `Documents.tsx:11-34` (`EmailMeACopyButton`) — now takes a `sentAt` prop and computes
  `label = sentAt ? 'Resend me a copy' : 'Send me a copy'` (line 26). The label reflects
  `documents.executed_email_sent_at` — the DB-driven all-parties stamp — not this button's own click
  history, matching the spec's Send/Resend rule exactly.
- `Documents.tsx:138-141` — the self-sign row's copy passes `doc.executed_email_sent_at`.
- `Documents.tsx:277` — the executed-documents list passes `r.executed_email_sent_at`.
- Action unchanged: POSTs to `/api/deliver-my-document` (pre-existing, already self-targeting and
  already the H3/H4 endpoint the spec names). Success sets `Sent to <email>.`; failure renders
  `role="alert"` with the real error — no silent catch (unchanged from H4, verified still true).

Read-model plumbing (the column had to be surfaced before Documents.tsx could read it):
- `supabase/migrations/20260804110000_expose_executed_email_sent_at.sql` — adds
  `executed_email_sent_at` to `my_documents()`'s `RETURNS TABLE` (dropped + recreated: adding a table
  column changes the function's return type, which `CREATE OR REPLACE` cannot do) and to
  `contract_document_detail()`'s `document` jsonb object (`CREATE OR REPLACE`, return type unchanged —
  jsonb). Dry-run inside `BEGIN;...ROLLBACK;`, then applied for real; verified via
  `pg_get_function_result` (see Done-checks).
- `src/lib/api.ts:620-622` — `MyDocumentRow.executed_email_sent_at`.
- `src/lib/ops/types.ts:179-180` — `DocumentRow.executed_email_sent_at` (the `listMySignableDocuments`
  path already does `select('*')` on `documents`, so no query change was needed there — only the type).
- `src/lib/contracts.ts:171-172` — `ContractDetail.document.executed_email_sent_at`.

### 3. Admin 4-option menu
New component `src/components/app/SendCopiesMenu.tsx` (178 lines), wired into
`src/pages/app/ContractPage.tsx:1378-1387` inside the existing `isExecuted` "Manage" card
(`ContractPage.tsx:1373`), gated `isStaff && id`.

**Deviation from the literal spec text, with reason:** the spec says the surface is "ContractPage.tsx
subheader." `ContractSubheader` (`src/components/app/ContractSubheader.tsx`) is only rendered when
`showDeck && id && !isExecuted` (`ContractPage.tsx:961`) — its own doc-comment says so explicitly:
"a fully executed contract gets none, and the subheader is not rendered at all." Since this feature is
scoped to EXECUTED documents by definition, the literal subheader component cannot host it — it is
unmounted precisely when this button needs to exist. I used the next card down that *is* staff-visible
and EXECUTED-only: the "Manage" card (`isExecuted &&` at `ContractPage.tsx:1373`, which already holds
the Terminate control). Functionally this satisfies "doc EXECUTED, staff only, near the top of the
executed-document view" — the spirit of the requirement — without inventing a second unmounting
condition or fighting the subheader's own design contract.

`DeliveryPanel.tsx` — checked; it is not rendered inside `ContractPage.tsx` at all (it lives on the
separate ops route `/app/ops/documents/:id` via `DocumentViewerPage.tsx`). The spec's own wording,
"...and DeliveryPanel.tsx **if present there**," is conditional on it being part of ContractPage's
surface; it is not, so per the spec's own phrasing no change was made to `DeliveryPanel.tsx`.

Menu contents (`SendCopiesMenu.tsx:143-176`):
1. **Send to me** (`:97-101`) — resolves `myContactId()` (`src/lib/ops/api-client.ts:40`, the exact
   helper the spec names), POSTs `/api/deliver-documents` with `recipientContactIds: [myId]`.
2. **Send to `<Lessor label>`** (`:151-156`) — parties filtered to `party_role IN (LESSOR, SELLER)`
   with an email on file.
3. **Send to `<Lessee label>`** (`:157-162`) — parties filtered to `party_role IN (LESSEE, BUYER)`
   with an email on file. (The co-buyer is not a distinct `party_role` — `fill_party_fields_from_contacts`
   stores the co-buyer as a second `BUYER` party row and only namespaces it `COBUYER.*` for token
   purposes — so filtering on `BUYER` already includes them; confirmed by reading
   `fill_party_fields_from_contacts` and `ContractPage.tsx:793-797`, which do the same thing.)
4. **Send to all parties** (`:113-120`) — calls the `resend_executed_document_email(doc_id)` RPC, not
   the endpoint directly, per spec — this is the official all-parties resend and re-stamps
   `executed_email_sent_at`.
- Role labels (`SendCopiesMenu.tsx:23-29`, `roleLabel()`) render "Lessor"/"Seller"/"Lessee"/"Buyer" —
  never person names.
- Options 2/3 render only `lessorParties.length > 0`/`lesseeParties.length > 0` (`:151, 157`) — hidden
  when that side has no party with an email, per spec.
- Button label: `sentAt ? 'Resend copies' : 'Send copies'` (`SendCopiesMenu.tsx:129`).

### 4. Admin "send to me" recipient class
Covered under §1 above (`api/deliver-documents.ts:221-225, 258`) — `is_mirror = true` is set exactly
when a targeted recipient has no party rows on the document set at all.

## Done-checks

### `npm run typecheck` — 0 errors (raw output)
```
> vite-react-typescript-starter@0.0.0 typecheck
> tsc --noEmit -p tsconfig.app.json
```
(no output after the command line = 0 errors)

### `npm run typecheck:api` — 0 errors (raw output)
```
> vite-react-typescript-starter@0.0.0 typecheck:api
> tsc --noEmit -p tsconfig.api.json
```
(no output after the command line = 0 errors)

### `npm run lint` — 0 errors (raw output, tail)
```
✖ 29 problems (0 errors, 29 warnings)
  0 errors and 2 warnings potentially fixable with the `--fix` option.
```
All 29 warnings are pre-existing `react-refresh/only-export-components` /
`react-hooks/exhaustive-deps` warnings in files this task did not touch (verified by name — none are
`SendCopiesMenu.tsx`, `Documents.tsx`, `ContractPage.tsx`, `deliver-documents.ts`, or the migration).
CLAUDE.md's stated baseline is "~26 pre-existing warnings"; 29 is close enough that I re-ran lint on a
clean `origin/main` checkout in a scratch dir to confirm the baseline itself, rather than assume: **29
pre-existing warnings on main**, unchanged by this branch.

### Endpoint recipient-filter verification: reasoned line-by-line (not exercised against a preview)
**Method used, stated per spec's own fallback clause:** no deployed preview exists for this branch — it
has not been pushed yet at the time of this report (pushing is the task's final step, after the report).
`getSupabaseAdmin()` (`api/_lib/supabaseAdmin.ts`) requires `SUPABASE_SERVICE_ROLE_KEY`, which is not
present in this checkout's `.env` (only `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` — client-side-only,
correctly not carrying the service key). So a local invocation of the handler (even via direct import,
bypassing HTTP) is not possible either — the spec's "local invocation is not possible" holds for exactly
this reason. I reasoned through the code path instead:

- **Untargeted call (`recipientContactIds` absent/empty):** `recipientContactIds.length > 0` is false
  (`:114`) → `targeted` stays `false` → §1b's whole block is skipped → §3 takes the `else` branch
  (`:177-185`), which is the original `document_parties` union query, byte-for-byte unchanged except for
  re-indentation. §7's company-copy `if` gains `!targeted &&` (`:288`) which is always-true here, so
  behavior is provably identical to pre-change for every existing caller
  (`DocsParticipantFlow.tsx:212`, `Onboarding.tsx:528`, `send_executed_document_email` via
  `net.http_post`).
- **Targeted call, authorized id (party on every doc):** `document_parties` query (`:117-120`) returns a
  row for that `(doc, contact)` pair for every `documentId` → `partyDocsByContact.get(cid).size ===
  documentIds.length` → `documentIds.every(...)` is `true` → `isPartyOnAll` true → excluded from
  `offending` → 403 not raised. In §6, `isMirrorRecipient = targeted && !partyDocsByContact.get(cid)?.size`
  — size is non-zero, so `isMirrorRecipient` is `false` → the delivery row omits `is_mirror` (defaults to
  its column default, which the schema shows as unspecified/false-equivalent — this is a genuine party
  delivery).
- **Targeted call, authorized id (staff, not a party):** `partyDocsByContact.get(cid)` is `undefined`
  (no `document_parties` rows) → `isPartyOnAll` false, but `staffContactIds.has(cid)` true (matched by
  the `profiles` query on `org_id` + `role`) → excluded from `offending`. In §6,
  `partyDocsByContact.get(cid)?.size` is `undefined` → `!undefined` is `true` → `isMirrorRecipient` is
  `true` → the delivery row carries `is_mirror: true`. This is the exact §4 requirement.
- **Targeted call, unauthorized id:** neither condition holds → included in `offending` → function
  returns before docs are ever rendered to PDF or any email is sent, `403`.
- **`executed_email_sent_at` is never touched in a targeted call:** confirmed by grep — the file's only
  reference to that column name is in the doc-comment; there is no `.update()` on `documents` anywhere in
  `api/deliver-documents.ts`. The stamp is only ever written by `send_executed_document_email` /
  `resend_executed_document_email` (`supabase/migrations/20260804050000_execution_email_state_machine.sql`),
  which the "Send to all parties" menu option calls via RPC — exactly the path the spec designates as
  "official."

### psql: targeted delivery → exactly one `document_deliveries` row, `executed_email_sent_at` untouched
**Read-only baseline was run** (against the document named in the spec,
`ecaecd42-0d82-428b-b72f-b73b0cc3f9f3`, via `psql "$(cat .env.db)"`), raw output:
```
                  id                  |  status  |                org_id                | executed_email_sent_at
--------------------------------------+----------+--------------------------------------+------------------------
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | EXECUTED | e656f20b-ef43-4725-9029-19e7f0190d9c |

             document_id              |         recipient_contact_id         | channel | is_mirror |          created_at
--------------------------------------+--------------------------------------+---------+-----------+-------------------------------
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | 352c3898-65d0-4a90-ad59-29107b7e03fe | EMAIL   | f         | 2026-07-29 12:32:26.910679+00
 ecaecd42-0d82-428b-b72f-b73b0cc3f9f3 | d99f1472-48b4-466e-aaa7-f76396745c17 | EMAIL   | f         | 2026-07-29 12:32:28.523374+00

              contact_id              | party_role
--------------------------------------+------------
 d99f1472-48b4-466e-aaa7-f76396745c17 | LESSOR
 352c3898-65d0-4a90-ad59-29107b7e03fe | LESSEE
```
Baseline: `executed_email_sent_at` is `NULL`; 2 pre-existing delivery rows (both real parties, both
`is_mirror = f`), from before this task.

**The write test (POST to the endpoint against a throwaway contact) was NOT run.** Per the spec's own
fallback ("add it as is_mirror recipient via the endpoint path only if a deployed preview exists,
otherwise document the manual test plan precisely") and the honesty rule, I did not fabricate this
result. No preview exists yet — the branch is unpushed as of this report, and no service-role key is
available locally to invoke the handler directly. **Manual test plan, to run once a preview URL exists:**

```bash
# 1. Create a throwaway contact in the same org as the test document, with a real-but-unused email
#    (e.g. a mailtrap/test address), and capture its id as $THROWAWAY_ID.
psql "$(cat .env.db)" -c "
  INSERT INTO contacts (org_id, first_name, last_name, email)
  VALUES ('e656f20b-ef43-4725-9029-19e7f0190d9c', 'A8B', 'Throwaway', 'a8b-throwaway@example.invalid')
  RETURNING id;"

# 2. Grant it staff so it passes the OR-authorization branch (or instead add it as a genuine
#    document_parties row on the test document, to exercise the non-mirror branch):
psql "$(cat .env.db)" -c "
  UPDATE profiles SET role = 'EMPLOYEE'
   WHERE contact_id = '<THROWAWAY_ID>';"
  -- (only if the throwaway contact has a profiles row; otherwise this step is N/A and the id
  --  will 403 as expected, proving the authorization branch instead)

# 3. Call the deployed preview:
curl -sS -X POST https://<preview-host>/api/deliver-documents \
  -H 'Content-Type: application/json' \
  -d '{"documentIds":["ecaecd42-0d82-428b-b72f-b73b0cc3f9f3"],"recipientContactIds":["<THROWAWAY_ID>"]}'

# 4. Verify exactly one new row, is_mirror = true, executed_email_sent_at untouched:
psql "$(cat .env.db)" -c "
  SELECT document_id, recipient_contact_id, channel, is_mirror
    FROM document_deliveries
   WHERE document_id = 'ecaecd42-0d82-428b-b72f-b73b0cc3f9f3'
     AND recipient_contact_id = '<THROWAWAY_ID>';"
psql "$(cat .env.db)" -c "
  SELECT executed_email_sent_at FROM documents
   WHERE id = 'ecaecd42-0d82-428b-b72f-b73b0cc3f9f3';"
  -- expect: still NULL (matches baseline above)

# 5. Clean up the throwaway contact/profile row afterward.
```

## Retries
None needed — no done-check failed on first attempt.

## Deviations from spec, with justification
1. **§3 surface** — used the executed-only "Manage" card in `ContractPage.tsx` instead of the literal
   `ContractSubheader` component, because that component is conditionally unmounted for exactly the
   EXECUTED state this feature targets. See full reasoning under §3 above.
2. **Company-copy notice skipped on targeted sends** (`api/deliver-documents.ts:288`) — not explicitly
   stated in the spec, but required both for correctness (a targeted staff re-send should not also
   trigger an "documents were executed" company-inbox notice) and to satisfy the done-check's "writes
   exactly one `document_deliveries` row" requirement, which a second mirror-copy row would violate.
3. **Write-side psql done-check not executed** — per the spec's own conditional fallback and the
   no-fabrication rule; a precise manual test plan is provided above instead.

## Files changed
- `api/deliver-documents.ts` — recipient targeting, authorization, `is_mirror`, company-copy gating.
- `supabase/migrations/20260804110000_expose_executed_email_sent_at.sql` — new migration, applied to
  prod (dry-run in `BEGIN;...ROLLBACK;` first, then applied; verified via `pg_get_function_result`).
- `src/lib/api.ts`, `src/lib/ops/types.ts`, `src/lib/contracts.ts` — type additions for
  `executed_email_sent_at`.
- `src/pages/app/Documents.tsx` — Send/Resend label on the existing self-send button.
- `src/components/app/SendCopiesMenu.tsx` — new, the admin 4-option menu.
- `src/pages/app/ContractPage.tsx` — wires `SendCopiesMenu` into the executed-doc Manage card.

Note: `api/request-received.ts` shows as modified in `git status` but was not touched by this task — it
was already modified, uncommitted, in the working tree before this session started (confirmed: `git pull`
fast-forwarded cleanly with no merge activity, so this diff predates the task). It is left untouched and
excluded from this branch's commit.
