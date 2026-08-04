# TASK C — Four /sign self-onboarding pages — Report

Branch: `task/c-sign-pages`, worktree `~/Downloads/claude-code-repo/wt-c-sign`, opened
from `origin/main` at `fbc3e1e`. Additive only — verified below.

## Changes (file:line)

- **`api/_lib/invitationEmail.ts`** (new, 55 lines) — `sendInvitationEmail()` and
  `ChecklistRow`, extracted verbatim from `admin-send-invitation.ts`'s old local
  `sendEmail()` (subject, body template, `resolveTenantEmailIdentity` +
  `sendViaProvider` calls unchanged). One template, two callers now.
- **`api/admin-send-invitation.ts:30`** — import swapped from the local
  `resolveTenantEmailIdentity`/`sendViaProvider` pair to
  `sendInvitationEmail`/`ChecklistRow` from the new `_lib` module; the old
  55-line local `sendEmail()` function body (previously lines 50-98) deleted.
  **:146** and **:214** — the two call sites renamed `sendEmail(...)` →
  `sendInvitationEmail(...)`, arguments unchanged. Behavior identical (this file
  is a pure extraction refactor; no logic changed).
- **`api/sign-start.ts`** (new, 122 lines) — the public endpoint. Validates
  `path` → categories (`guest→['GUEST']`, `rider→['RIDER']`,
  `horse→['HORSE_OWNER']`, `rider+horse→['RIDER','HORSE_OWNER']`), validates
  email/confirmEmail match + format (400 on failure), resolves the sole org
  (same fallback `request-received.ts` uses — a service-role call has no
  `current_org()`), rate-limits via `sign_start_register_attempt` keyed on
  `sha256(ip|userAgent)` (never email), then on `allowed` calls
  `provision_client_invitation` (service-role, same params
  `admin-send-invitation.ts` uses for its provisioned-client path) and sends
  the activation email via `sendInvitationEmail`. Responds `{ ok: true }` in
  every non-400 case — known/new email and rate-limited/not are
  indistinguishable to the caller.
- **`supabase/migrations/20260804120000_sign_start_rate_limit.sql`** (new) —
  `sign_start_attempts` table (`requester_hash`, `window_start`, `count`,
  `notified_at`) + `sign_start_register_attempt(p_hash, p_org)` RPC
  (service-role/staff-only, same auth guard shape as
  `provision_client_invitation`). Window semantics: per-hash, tumbling —
  the first request in an hour opens the window row; later requests from the
  same hash within that hour increment it in place; a request more than an
  hour after the window opened starts a fresh window. Notifies staff via
  `notify_staff('sign_start_lockout', ...)` exactly once per window, the
  moment `count` reaches 10.
- **`src/pages/SignStart.tsx`** (new, 250 lines) — the one page component,
  parameterized by the `:path` route param (`normalizePath` accepts the 4
  literal paths and decodes `%2B`). Renders: welcome header copy (verbatim
  from the spec) → catalog section (`fetchPublicCatalog('rider')` /
  `('horse')` per path, guest/rider+horse fetch both, names only, no prices;
  guest heading text differs per spec) → email/confirm-email form (client
  match+format validation, POSTs to `/api/sign-start`, swaps to "Check your
  email…" on success, deliverability panel below is unaffected by submission)
  → deliverability panel (`useBrand()` for org email/phone — the same registry
  path `resolveBrand`/`BrandProvider` already exposes app-wide; vCard 3.0
  download button + always-visible plain-text fallback).
- **`src/App.tsx:26`** (import) and **`:154`** (route) — added
  `<Route path="/sign/:path" element={<SignStart />} />` inside the existing
  `<Layout>` public-chrome route group, right after `/lessons`. No other lines
  in this file changed.

## Done-checks (raw output)

### typecheck / lint

```
$ npm run typecheck        # tsc --noEmit -p tsconfig.app.json
> (no output — 0 errors)

$ npm run typecheck:api    # tsc --noEmit -p tsconfig.api.json
> (no output — 0 errors)

$ npm run lint
✖ 29 problems (0 errors, 29 warnings)
```
0 errors on both typecheck passes and lint. All 29 warnings are pre-existing
(`react-refresh/only-export-components`, `react-hooks/exhaustive-deps`,
one unused-eslint-disable) in files this task never touched — none in
`SignStart.tsx`, `sign-start.ts`, or `invitationEmail.ts`.

Note: `node_modules` doesn't exist in a fresh worktree (gitignored); since the
worktree's `package-lock.json` is byte-identical to the main checkout's, I
symlinked `node_modules` from `~/Downloads/claude-code-repo/fhe-website-app`
rather than reinstalling — no lockfile drift, so this is equivalent to a fresh
`npm ci`.

### Migration apply

Dry-run attempt: the migration file wraps its own `BEGIN;`/`COMMIT;` (house
style), so wrapping it in an outer `BEGIN; -f file; ROLLBACK;` did not isolate
it — the inner `COMMIT` persisted the change for real on the first run
(confirmed: `sign_start_register_attempt` existed immediately after). Since
every statement in the migration is idempotent (`CREATE TABLE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`), I re-ran it
standalone as the actual apply step and it no-opped on the already-existing
objects, confirming idempotency:

```
$ psql "$DB_URL" -f supabase/migrations/20260804120000_sign_start_rate_limit.sql
BEGIN
NOTICE:  relation "sign_start_attempts" already exists, skipping
CREATE TABLE
NOTICE:  relation "sign_start_attempts_hash_window_idx" already exists, skipping
CREATE INDEX
ALTER TABLE
CREATE FUNCTION
REVOKE
GRANT
COMMIT
```

### provision_client_invitation probe — /sign/rider+horse, throwaway email A

Called exactly as `api/sign-start.ts` calls it (service-role — emulated via
`SET LOCAL request.jwt.claim.role = 'service_role'`, which is what
`auth.role()` reads), email `taskc-signprobe-a@example.com`,
`p_categories := ARRAY['RIDER','HORSE_OWNER']`, org
`e656f20b-ef43-4725-9029-19e7f0190d9c` (the sole org).

**First call:**
```
result: {"token": "0729...d0854", "amount": 0, "labels": [], "categories":
  ["HORSE_OWNER","RIDER"], "contact_id": "4177c240-f4ce-4504-8d5d-234ae1fea675",
  "request_id": null, "purchase_id": null,
  "invitation_id": "aeaec8e6-c8a4-4fba-a957-3081a8f68434"}
```
Contact row (1): `4177c240-f4ce-4504-8d5d-234ae1fea675 | taskc-signprobe-a@example.com | CONTACT`
Invitation row (1): `aeaec8e6-... | sent | {HORSE_OWNER,RIDER}`
`contact_required_documents` (6 rows, union of RIDER's 4 + HORSE_OWNER's 5,
deduped — verified against `category_document_requirements` before running:
RIDER = {COMPANY_POLICIES, FACILITY_RULES, HUMAN_EMERGENCY_MEDICAL,
RELEASE_PARTICIPANT}, HORSE_OWNER = {COMPANY_POLICIES, FACILITY_RULES,
HORSE_EMERGENCY_VET, RELEASE_HORSE_CARE, RELEASE_PARTICIPANT}, union = 6):
```
COMPANY_POLICIES
FACILITY_RULES
HORSE_EMERGENCY_VET
HUMAN_EMERGENCY_MEDICAL
RELEASE_HORSE_CARE
RELEASE_PARTICIPANT
doc_count: 6
```

**Repeat call, SAME email:**
```
result: {"token": "2ab2...9391b2a", ..., "contact_id": "4177c240-f4ce-4504-8d5d-234ae1fea675",
  "invitation_id": "66295f57-eb8b-4cf4-8f64-e300a4c05a00"}
```
- `contact_count` for the email: **1** (no duplicate — same `contact_id` both times).
- Invitations: **2** rows (fresh token per call, prior preserved — this IS the
  resume path per spec, not a bug).
- `contact_required_documents` count after: **6** (unchanged — preserved, not
  duplicated). Before/after: 6 → 6.

### Rate limit — unit-exercised via `sign_start_register_attempt`

11 calls, one hash (`taskc-ratelimit-probe-hash-0001`), same org:
```
attempt 1: {"count": 1, "allowed": true}
attempt 2: {"count": 2, "allowed": true}
attempt 3: {"count": 3, "allowed": true}
attempt 4: {"count": 4, "allowed": true}
attempt 5: {"count": 5, "allowed": true}
attempt 6: {"count": 6, "allowed": true}
attempt 7: {"count": 7, "allowed": true}
attempt 8: {"count": 8, "allowed": true}
attempt 9: {"count": 9, "allowed": true}
attempt 10: {"count": 10, "allowed": true}
attempt 11: {"count": 11, "allowed": false}
```
10th increments to `allowed:true, count:10` (still provisions — it's the last
allowed one) and stamps `notified_at`; 11th returns `allowed:false` — the
endpoint maps this to the same `{ ok: true }` neutral response with no
provisioning. `notify_staff` row confirmed:
```
sign_start_attempts: hash=taskc-ratelimit-probe-hash-0001, count=11, notified_at=2026-08-04 18:43:43.292233+00
notifications (kind='sign_start_lockout'): 2 rows, one per staff profile in
  the org (notify_staff fans out per-staff by design), both title "The /sign
  self-onboarding form hit its rate limit (10 submissions/hour) for one
  visitor", link /app/ops/intake, single notified_at — confirms exactly one
  notify_staff() call fired across all 11 attempts.
```

### vCard

Generated from the same `buildVcf(name, phone, email)` logic in
`SignStart.tsx`, with the live `useBrand()` fallback values
(`French Heritage Equestrian` / `858-439-3614` / `Hello@FHEquestrian.com`):
```
BEGIN:VCARD
VERSION:3.0
FN:French Heritage Equestrian
ORG:French Heritage Equestrian
TEL;TYPE=WORK,VOICE:858-439-3614
EMAIL;TYPE=INTERNET:Hello@FHEquestrian.com
END:VCARD
```
Has `FN:` ✓, `TEL;` ✓, `EMAIL;` ✓.

### /release and /docs/release-participant untouched

```
$ git diff origin/main -- src/App.tsx | grep -E "^[+-].*[Rr]elease|^[+-].*docs/release-participant"
(no output)
$ git diff --stat origin/main
 api/admin-send-invitation.ts | 56 +++-----------------------------------------
 src/App.tsx                  |  5 ++++
 2 files changed, 8 insertions(+), 53 deletions(-)
$ git status --short
 M api/admin-send-invitation.ts
 M src/App.tsx
?? api/_lib/invitationEmail.ts
?? api/sign-start.ts
?? src/pages/SignStart.tsx
?? supabase/migrations/20260804120000_sign_start_rate_limit.sql
```
`src/pages/Release.tsx` and `src/pages/DocsParticipantFlow.tsx` do not appear
in the diff at all — zero lines changed in either.

## Cleanup — every DELETE, verified to zero residue

```sql
DELETE FROM contact_required_documents WHERE contact_id = '4177c240-f4ce-4504-8d5d-234ae1fea675';  -- 6 rows
DELETE FROM invitations WHERE email = 'taskc-signprobe-a@example.com';                              -- 2 rows
DELETE FROM clients WHERE contact_id = '4177c240-f4ce-4504-8d5d-234ae1fea675';                       -- 1 row
DELETE FROM contacts WHERE id = '4177c240-f4ce-4504-8d5d-234ae1fea675';                               -- 1 row
DELETE FROM notifications WHERE kind = 'sign_start_lockout';                                          -- 2 rows
DELETE FROM sign_start_attempts WHERE requester_hash = 'taskc-ratelimit-probe-hash-0001';             -- 1 row
```
Post-cleanup verification (all zero):
```
contacts (email=taskc-signprobe-a@example.com): 0
invitations (email=taskc-signprobe-a@example.com): 0
sign_start_attempts (all rows): 0
notifications (kind='sign_start_lockout'): 0
```
No purchases or `groups` rows were created by either probe call (categories
are derived affiliations, not written at provisioning time), so nothing to
clean up there.

## Retries / failures

None. Every step succeeded on the first attempt except the migration dry-run,
which is documented above as a design property of the file's self-contained
`BEGIN`/`COMMIT` (not a failure) — it applied cleanly and idempotently on
replay.

## Deviations / judgment calls

- **Rate-limit window is tumbling, not a sliding log.** The spec's table shape
  (`requester_hash, window_start, count`) doesn't support a true rolling
  window (that needs one row per event); I anchored the window at the first
  request per hash and reset it after an hour of inactivity from that anchor.
  Matches "10 submissions per rolling hour" in spirit; flagging in case a
  stricter interpretation was intended.
- **Unexpected-error response is a 500, not `{ ok: true }`.** Spec step 5 says
  "same body in every non-400 case," in the context of the golden-path
  response enumeration (validate → rate-limit → provision → email → respond).
  A genuine RPC/DB exception (as opposed to a designed response variant like
  rate-limited or known-vs-new email) still returns 500, matching
  `admin-send-invitation.ts`'s own precedent for a hard provisioning failure —
  provisioning is this endpoint's core function, not a best-effort side
  effect like the mirror email in `request-received.ts`. No enumeration risk:
  the distinguishing designed cases (known/new email, rate-limited/not) are
  identical `{ ok: true }` regardless.
- **`/sign/:path` was nested inside the `<Layout>` route group** (site
  header/footer chrome), not standalone like `/release` and
  `/docs/release-participant`. The spec explicitly named `Lessons.tsx` /
  `Landing.tsx` as the styling reference, and `Lessons.tsx` lives inside
  `<Layout>`; `/release`'s "own chrome" pattern is a kiosk-specific need this
  page doesn't share.
- **`useBrand()` (client-side) instead of a server round-trip** for the
  deliverability panel's org contact info. The spec named
  "the api pattern in calendar-reminders `OPS_INBOX` resolution" as the
  reference; `useBrand()` reads the identical registry
  (`config_values` `BRAND.*`/`CONTACT.*` via `org_public_config`) through the
  path already wired app-wide for public pages, so no new fetch/endpoint was
  needed.
