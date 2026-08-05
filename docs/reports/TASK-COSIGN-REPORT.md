# TASK COSIGN — company-as-party signing in the UI (owner priority #1)

## Scope delivered

The UI rule is now enforced with a clear, labeled affordance: **staff may sign
a party role only when that role belongs to the org's own company contact**;
individual parties are never offered a doomed "sign for them" button. Server
authority (`record_signature`) was already correct (proven live in
`TASK-A16`) — the entire gap was client-side. Fixed in
`src/pages/app/ContractPage.tsx` + one read-model RPC extension
(`contract_document_detail`). `ClauseDocument.tsx` was not touched. Sarah's
document (`704c8d2d-…`) received zero writes throughout — read-only queries
only.

## 1. Characterize first (read-only, done before writing anything)

**How `my_roles` is computed.** `contract_document_detail(p_document_id)`
sets `my_roles := caller_party_roles(p_document_id)`, and that function
matches rows in `document_parties` where `contact_id = current_contact_id()`
— i.e. the CALLER's own contact. A staff caller whose own contact isn't
itself a party on the document (the normal case — FHE staff are TEAM
contacts, not the company contact) always gets `my_roles = []`. **Staff never
receive the company's roles through `my_roles`.** Confirmed live (simulated
CJ/admin session against Sarah's real document, read-only):
```
my_roles = []
```

**Where the sign CTA renders (`ContractPage.tsx`).** Two independent boxes,
both gated on `state === 'locked'` (signing is only ever offered once a
document is locked — true for individual self-signing too, not specific to
company parties):
- A party's own self-sign box (`myRoles.length > 0`) — irrelevant to staff,
  whose `myRoles` is always `[]`.
- **A pre-existing "Sign on a party's behalf" box** (`isOwnerSide && state
  === 'locked' && pendingSignerRoles.filter(r => !myRoles.includes(r)).length
  > 0`), added 2026-07-22 (`bab01ec2`). This iterated **every** pending role
  not in the staff caller's own roles — with no distinction between the
  company's role and an individual party's role — and called `lockAndSign()`
  → `lock_and_sign_contract` → `record_signature` for whichever role was
  clicked.

**The exact blocking mechanism, and why it isn't what it first looks like.**
Git history shows this is a *regression*, not a gap that was never built:
- `20260702000000_record_signature_party_check.sql` (the original
  authorization fix) let **any staff of the tenant facilitate any party's
  signature** — "TENANT STAFF may facilitate any party's signature (the
  assisted-signing flow, OPS-DOC-SIGN)". The 2026-07-22 "sign on a party's
  behalf" UI was built against this permissive model — it offered a box for
  every pending role because, at the time, staff really could sign for any of
  them.
- `20260803020000_company_side_signing.sql` **tightened** this: staff may now
  only sign on behalf of a role whose signer contact is `is_company`; signing
  for an individual party now raises `not a signer on this document in role
  %`. This is the owner's stated, endorsed model ("Non-party staff signing
  anything else stays impossible (unchanged)" in the task doc) — but the
  07-22 UI was never updated to match, so it has, since 08-03, silently
  offered a button for individual parties that **always fails** with a raw
  Postgres error, while working correctly but genetically-labeled ("Sign as
  Lessee", not "Sign as French Heritage Equestrian") for the company.

So: the defect is not "staff can't sign the company's role" — that already
worked once a document reached `locked`. The defect is (a) no clearly
labeled, company-specific affordance, and (b) the UI offers an identical,
always-failing affordance for individual parties it can never actually sign
for, which is itself a violation of "nobody may sign a role they aren't a
party to" at the UI level (the server already refuses it, but the UI
shouldn't dangle the option). `contract_document_detail` had no field to let
the frontend tell company roles apart from individual ones — that's the
concrete gap this task closes.

## 2. RPC — `supabase/migrations/20260805150000_cosign_company_roles_in_detail.sql`

`CREATE OR REPLACE FUNCTION contract_document_detail`, full live body carried
forward unchanged, plus two new keys in the returned JSON, computed with the
**exact same join `record_signature`'s company branch uses** (mirrored, not
invented):
- `company_signable_roles: text[]` — party roles on the document whose
  `is_signer` contact is the org's `is_company` contact.
- `company_contact_name: text | null` — that contact's display name, for the
  UI label.

### Dry-run, then apply
```
BEGIN; \i …migration…
SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = '{"sub":"<CJ>"}';
SELECT contract_document_detail('704c8d2d-…') -> 'company_signable_roles' → ["LESSEE"]
SELECT contract_document_detail('704c8d2d-…') -> 'company_contact_name'   → "French Heritage Equestrian"
ROLLBACK;
```
Identical result post-apply. Applied for real: `CREATE FUNCTION` — no errors.
Confirmed live: `prosrc LIKE '%company_signable_roles%' AND prosrc LIKE
'%company_contact_name%'` → `true`. Grants unchanged (same function, same
signature, same callers).

## 3. UI fix — `src/pages/app/ContractPage.tsx` + `src/lib/contracts.ts`

- `ContractDetail` interface gained `company_signable_roles: string[]` and
  `company_contact_name: string | null`.
- New derived values: `companySignableRoles` (a `Set` from the new field),
  `companyContactName`, and `companyPendingRoles` = `pendingSignerRoles`
  filtered to roles that are both not-mine and in `companySignableRoles`.
- The "sign on a party's behalf" box now renders only when
  `companyPendingRoles.length > 0` (was: any pending non-mine role). Header
  changed to "Sign on behalf of the company"; hint text now names the
  company and explains why staff completes its signature (it has no
  individual signer); the name input defaults to `companyContactName`
  (still editable); the button reads "Sign as &lt;name&gt;" instead of the
  generic "Sign as &lt;Role&gt;". Same `lockAndSign()` call, same
  `record_signature` path — no server change to the signing call itself was
  needed.
- An individual party's pending role (e.g. Sarah's LESSOR seat) no longer
  renders any staff-facing button — the UI no longer offers an action the
  server will refuse.
- `ClauseDocument.tsx`: **not touched.** The fix lives entirely in
  `ContractPage.tsx` and the RPC, as the task doc anticipated.

## 4. Live proofs (raw psql against production, simulated staff session, all rolled back)

Technique: `SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims =
'{"sub":"<user_id>"}'` inside `BEGIN;…ROLLBACK;` (same as `TASK-A16`/
`TASK-DOCVIS`). Staff session = CJ (`ADMIN`, `b45a5503-…`). Throwaway lease
created via `start_lease_contract_v2(p_lessee_contact_id => <company
352c3898-…>, p_lessor_contact_id => <throwaway individual>)`, mirroring
Sarah's real doc shape (LESSEE = company, LESSOR = individual). Moved
straight to `workflow_state = 'locked'` by direct `UPDATE` (bypassing
`lock_and_sign_contract`'s field-completeness gate — that gate isn't what's
under test, same shortcut `TASK-A16` used for `record_signature`).

**Before any signature**, `contract_document_detail` as staff:
```
my_roles               = []
company_signable_roles = ["LESSEE"]
company_contact_name   = "French Heritage Equestrian"
workflow_state          = "locked"
```

**Positive** — `lock_and_sign_contract(doc, 'LESSEE', 'French Heritage
Equestrian', true)` (the exact RPC `lockAndSign()` calls from the fixed UI):
```
company_sign_result = AWAITING_SIGNATURE   -- 2nd party still pending, correct
```
```
signer_contact_id = 352c3898-… (company contact)
party_role        = LESSEE
typed_name         = French Heritage Equestrian
signer_user_id     = b45a5503-… (CJ — the acting staff account)
sealed              = true
```

**Negative** — `lock_and_sign_contract(doc, 'LESSOR', 'Some Fake Name',
true)` for the individual party, staff not a party:
```
ERROR: not a signer on this document in role LESSOR
  (record_signature, line 37; called from lock_and_sign_contract)
```

`ROLLBACK` — zero residue: `SELECT count(*) FROM contacts WHERE first_name =
'ZZZTEST'` → `0`.

**Sarah's document (read-only, zero writes throughout):**
```sql
SELECT id, workflow_state, status FROM documents WHERE id::text LIKE '704c8d2d%';
 → in_review, AWAITING_SIGNATURE
SELECT dp.party_role, c.first_name, c.is_company FROM document_parties dp JOIN contacts c ...;
 → LESSEE: French Heritage Equestrian (is_company=true)
   LESSOR: Sarah Morgan (is_company=false)
SELECT count(*) FROM signatures WHERE document_id = '704c8d2d-…';  → 0
```
Reasoned trace with the fix live: for this session, `my_roles = []`,
`company_signable_roles = ["LESSEE"]`, `company_contact_name = "French
Heritage Equestrian"`. Once this document is advanced from `in_review` to
`locked` through the normal review workflow (unaffected by this fix —
`approve_contract_review` already excludes company parties from gating
approval, per the task doc's verified facts), the fixed UI will render
exactly one box, labeled "Sign on behalf of the company" / "Sign as French
Heritage Equestrian", for the LESSEE seat. No box renders for the LESSOR
(Sarah) seat — she is not in `company_signable_roles`, and the old
generic-for-everyone behalf box no longer exists.

## 5. `docs/BUILD_TRACKER.md`

Added `A20` under section A with an honest status: **PARTIAL — RPC + UI fix
verified live (rolled back), browser click-through not done.** Cross-
referenced against `A7` (LESSEE-side note there is about read-only rendering
of a locked/executed document, a different concern from signing ability;
left unchanged).

## 6. Done-checks

- `npm run typecheck` — 0 errors.
- `npm run typecheck:api` — 0 errors.
- `npm run lint` — 0 errors, 29 warnings (baseline; none new, none in touched
  files).
- Fresh worktree had no `node_modules` (not tracked by git); ran `npm ci`
  first (581 packages, matches `package-lock.json`, no lockfile changes).

## 7. Production writes (everything logged)

- One migration applied: `20260805150000_cosign_company_roles_in_detail.sql`
  (`CREATE OR REPLACE FUNCTION contract_document_detail` — read-model only,
  same signature, same grants).
- All proof-phase writes (throwaway contacts, contracts, documents,
  signatures) were inside `BEGIN;…ROLLBACK;` — zero residue, verified by
  count query after each run.
- Sarah's document (`704c8d2d-…`): zero writes — `SELECT` only.
- `ClauseDocument.tsx`: zero changes.
- No signed document was deleted or modified.

## Honesty notes / what's NOT done

- **No browser click-through.** Every proof above is `psql` against
  production with a simulated session, per the task's own "simulated
  sessions per prior reports" instruction — nobody has opened `ContractPage`
  in a real browser as CJ against a locked, company-party document and
  clicked "Sign as French Heritage Equestrian." Marked `PARTIAL` in the
  tracker for that reason, matching the existing convention for A11–A13,
  A17–A19.
- **No production document currently sits in `locked` state** (`SELECT
  count(*) FROM documents WHERE workflow_state = 'locked'` → `0` at the time
  of this task), so there was no live, already-locked document to visually
  confirm the box against without advancing something real — the throwaway
  rolled-back document was used instead, deliberately, to avoid touching any
  real contract's workflow state.
- Sarah's real document cannot be advanced to `locked` as part of this task
  (it's read-only by hard rule) — its trace above is reasoned from the live
  RPC output, not a rendered screenshot.
- The pre-existing "sign on a party's behalf" UI, as it stood before this
  fix, has silently offered a broken (always-erroring) button for individual
  parties since 2026-08-03 — two days before this task, unrelated to a fix
  in progress at the time. Flagging in case any staff member hit that error
  in the interim; no evidence found that anyone did (no matching failed
  `record_signature` calls surfaced during this session's read-only
  investigation, though no systematic log search was performed).
