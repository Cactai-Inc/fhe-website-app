# POST-RUN CLOSEOUT — H2/H3 completion, D15 fix, harness repair

**Run date:** 2026-08-02
**Branch:** `main` (direct, per instruction — no feature branch)
**Head at start:** `7a622e1` (confirmed identical to `origin/main`)
**Head at finish:** `305474b` (confirmed identical to `origin/main`)
**Host used for every curl matrix:** `https://frenchheritageequestrian.com` /
`https://www.frenchheritageequestrian.com` (the plain-domain form 307-redirects
to `www.`; `fhequestrian.com` is the separate Namecheap-parked redirect
domain, out of scope per instruction, not touched or tested this run).

Governing docs read in full before starting: `hardening-unit-spec.md`
(found in `~/Downloads`, not the repo — flagged and located per instruction),
`docs/reports/PROMPT_A_STAGES_4-5.md`.

---

## 1. STATUS TABLE

| Task | Status | Commits |
|---|---|---|
| 1 — H2 hardening | **DONE, verified end-to-end** | `42e2ded` `e6dbe95` `b3b628a` `973c360` `9c6052f` |
| 2 — H3/H2 curl matrices | **DONE** (one row inapplicable — see §4) | (no code changes; verification only) |
| 3 — D15 money re-render defect | **DONE, fixed and verified** | `ddae52e` |
| 4 — Test harness schema snapshot | **DONE** | `305474b` |

---

## 2. TASK 1 — H2 HARDENING

### H1 finding (confirmed, unchanged from the prior report)

The release kiosk flow (`/release`, `Release.tsx`) is sessionless by design —
a public walk-in visitor signs via `sign_release`, an anon-key RPC called
directly from the browser. There is no server-side hook in that path to
attach a session or auth check to.

### Mechanism chosen (per the pre-declared fallback, since H1 confirmed
sessionless)

Built `api/sign-release.ts` — a new endpoint that wraps the `sign_release`
RPC call server-side (same anon-key semantics, same validation) and then
invokes delivery **in-process** (`deliverExecutedDocument()`, a function
call, not a second HTTP request) before responding. `Release.tsx` now posts
to this endpoint instead of calling the RPC directly plus a separate
unauthenticated `fetch('/api/deliver-document', …)`.

`/api/deliver-document` itself now requires a session **and** staff
(401/403), matching H2's spec exactly. `DeliveryPanel.tsx` (the staff "email
all parties" button) was updated to attach its session bearer token, since
it previously sent none and would have broken under the new gate.

### DONE-CHECK — verified live, raw

```
$ curl -s -X POST https://www.frenchheritageequestrian.com/api/deliver-document \
    -H "Content-Type: application/json" -d '{"documentId":"..."}' -w "\nHTTP %{http_code}\n"
{"error":"unauthorized"}
HTTP 401

$ curl -s -X POST .../api/deliver-document \
    -H "Authorization: Bearer not-a-real-token" -d '{...}' -w "\nHTTP %{http_code}\n"
{"error":"unauthorized"}
HTTP 401

$ curl -s -X POST .../api/deliver-document \
    -H "Authorization: Bearer <real staff token>" -d '{...}' -w "\nHTTP %{http_code}\n"
{"delivered":[],"companyNotified":false,"status":"EXECUTED"}
HTTP 200
```

End-to-end: a real `RELEASE_GENERAL` signature via `POST /api/sign-release`
returns `status: EXECUTED`, and a `document_deliveries` row is recorded —
confirmed via direct query against production
(`lrstswfxfsezdmvkvukc.document_deliveries`).

### Defects found and fixed during verification (all in `api/_lib/delivery.ts`)

These surfaced from the owner reviewing a **real delivered email** — not
from a spec checklist — and each was root-caused before fixing, not
guessed at:

1. **`document_deliveries` insert always threw, after the email had already
   sent.** The table has no `org_id` column (confirmed: `deliver-documents.ts`
   already carried a comment documenting this same fact for its own insert);
   `deliverExecutedDocument`'s insert — copied verbatim from the
   pre-hardening handler — still passed `org_id`. This is why the first
   H2 verification pass showed a successful-looking email send with zero
   delivery row: the insert was throwing on every single call, silently,
   because the email send (which doesn't depend on the row) had already
   succeeded by the time the throw happened. **Not an env/provider issue** —
   confirmed by direct `INSERT` against the live table, reproducing the
   exact `column "org_id" of relation "document_deliveries" does not exist`
   error. Fixed by dropping `org_id` from the insert.
2. **Party copy inlined raw `merged_body` text instead of a PDF
   attachment**, and the subject line was a hardcoded generic string
   (`"Your contract is executed"`, never the real document title). Fixed by
   building `buildPartyCopyEmail()`/`renderPartyCopyPdfBytes()` — reused by
   both `deliverExecutedDocument` and `api/deliver-my-document.ts` (H3) so
   the fix landed once, not twice.
3. **`documents` has no `signed_at` column** (a regression I introduced
   myself, from an unverified column search that actually matched
   `signatures.signed_at`/`contracts.signed_at` — two different tables).
   Broke delivery entirely for one commit's worth of live traffic before
   being caught by re-verification and fixed with `documents.created_at`
   (the correct execution-moment field for kiosk releases, since
   `sign_release` creates and executes in one transaction).

### Email copy — final, owner-approved format

After three iterations (initial generic subject → a friendly
greeting/signature draft → the owner comparing it directly against the
existing company/staff-notification copy and preferring that plainer,
more "obviously a real business email" style), the signer's copy settled
on:

- Subject: `{Document Title} — signed and executed`
- Body: one line noting the PDF is attached
- Signature block: brand name, phone (as a `tel:` link), site URL — sized
  up and made clickable per owner request
- A short reference-code line (12-char excerpt of the execution hash) —
  kept per owner instruction ("friendlier... without losing the integrity
  information... not a security issue to share in plain text" — confirmed:
  the hash is a one-way document fingerprint, not a secret)
- PDF filename: signer-attributed, e.g.
  `General_Visitor_Liability_Release_cjz_08_02_26.pdf`

**Clarified, not a bug:** the owner's report of "double sending two
different styles" turned out to be two intentionally separate emails (the
signer's party copy, and a company/staff notification to the org's public
inbox) landing in one shared inbox because the owner's test address
aliases to the org's own contact address. Confirmed and explained before
any further changes were made on that basis.

---

## 3. TASK 2 — H3/H2 CURL MATRICES

### Session-minting method (owner-directed, after two declined alternatives)

A diagnostic endpoint and a raw service-role key were both offered and
explicitly declined. Instead: the anon key was extracted from the deployed
app's own JS bundle (public by design, embedded client-side already);
`invitations` rows were inserted directly via the DB connection already in
use; `POST /api/register-invited` (the real endpoint the app's invite-accept
page calls) created real, password-confirmed accounts; `redeem_invitation`
(the real RPC the client calls post-registration) was called under each
account's own real session to create real `profiles`/`contacts` rows. Two
member test accounts (one made a real party on the target documents, one
deliberately left off) plus one disposable staff (`ADMIN`) test account.

**Caveat, stated plainly:** this proves the endpoints' authorization logic
using real sessions and real backend RPCs — it does not exercise the
email-click-through UX (no email was actually sent/clicked for these test
accounts; the token was inserted directly and redeemed via API call). That
distinction was raised and acknowledged before proceeding.

### H3 matrix — `/api/deliver-my-document` — raw, against `www.frenchheritageequestrian.com`

```
ROW 1 — no session:
$ curl -s -X POST .../api/deliver-my-document -d '{"documentId":"..."}'
{"error":"unauthorized"}
HTTP 401

ROW 2 — member session, PARTY on an executed RELEASE doc:
before: document_deliveries count = 0
$ curl -s -X POST .../api/deliver-my-document -H "Authorization: Bearer <party>" -d '{...}'
{"delivered":true,"email":"h3matrix-party@gmail.com","logged":true}
HTTP 200
after: 1 row recorded (document_id, recipient_contact_id, channel=EMAIL)

ROW 3 — member session, NON-PARTY on the same RELEASE doc:
before: 0 rows for this contact
$ curl -s -X POST .../api/deliver-my-document -H "Authorization: Bearer <nonparty>" -d '{...}'
{"error":"forbidden"}
HTTP 403
after: 0 rows (unchanged)

ROW 4 — member session, PARTY on an executed LEASE doc (a different template family):
before: 0 rows
$ curl -s -X POST .../api/deliver-my-document -H "Authorization: Bearer <party>" -d '{...}'
{"delivered":true,"email":"h3matrix-party@gmail.com","logged":true}
HTTP 200
after: 1 row recorded

ROW 5 — member session, PARTY on a NON-EXECUTED doc (AWAITING_SIGNATURE):
before: 0 rows
$ curl -s -X POST .../api/deliver-my-document -H "Authorization: Bearer <party>" -d '{...}'
{"error":"document not EXECUTED (status=AWAITING_SIGNATURE)"}
HTTP 409
after: 0 rows (unchanged)
```

All five rows pass exactly per H3's spec (§ Task H3 DONE-CHECK).

**Real-email-to-`admin@fhequestrian.com` row: N/A, not blocked.** That
account authenticates via Google OAuth (`auth.identities.provider =
'google'`, confirmed) — there is no password-grant equivalent to exercise
via curl. This was initially misdiagnosed as "no password set, blocked" —
corrected on the owner's instruction to check the access type before
concluding blocked, and re-verified directly against `auth.identities`.

### H2 matrix — `/api/deliver-document` (staff-only gate) — raw

```
no session:      {"error":"unauthorized"}  HTTP 401
member session:   {"error":"forbidden"}     HTTP 403
staff session:     {"delivered":[],"companyNotified":false,"status":"EXECUTED"}  HTTP 200
                    (idempotent-correct — both parties on this doc were already delivered)
```

### Cleanup — verified, zero residue

All test accounts, contacts, `document_parties` rows, and
`document_deliveries` rows created for this matrix were deleted after the
run. Confirmed via direct query: `auth.users`/`contacts`/`invitations`
matching the test-account emails → 0 rows; the one real production document
touched (`ecaecd42`, an existing lease, used only to add/remove a test
party row) confirmed back to its original party count.

### Incidental finding, traced and reported (not fixed — out of scope)

Owner asked where kiosk-flow signers go if never invited. Traced: kiosk
signers get a `contacts` row with no linked account; there is no self-serve
signup route in the app (`/register` redirects to the invite-token-gated
`/activate` flow; `App.tsx` has no other account-creation route). If later
invited using the same email, `redeem_invitation`'s by-email contact
resolution correctly finds and links the existing kiosk contact rather than
creating a duplicate (confirmed by reading its live body). Until invited,
a kiosk signer has no path to H3's self-send and never sees their document
in-app — by design, not a defect. The owner separately raised a related
feature idea (auto-promoting kiosk signers by document type, new `/sign/*`
short URLs) — explicitly deferred to a separate task per the owner's own
instruction ("I will have the orchestrator author the update for this").

---

## 4. TASK 3 — D15 MONEY RE-RENDER DEFECT

### Verification (before any fix, per instruction)

Reference draft `c36449f7` (a real document from the prior session's own
verification work): `HORSE.FAIR_MARKET_VALUE` rendered as `52500.00` (no
`$`, no thousands separator). One field changed through the normal write
path (`set_contract_field('HORSE.CURRENT_LOCATION', ...)`, the same RPC the
real editing UI calls), triggering a real re-merge
(`remerge_contract_body` → `remerge_contract_from_clauses`). Fee line
checked again: still `52500.00`. **Defect confirmed reproducible, not
assumed.**

### Root cause

`remerge_contract_from_clauses` already special-cases `certify` and
`percent` `format_type` fields but has no `currency` branch — such tokens
fell through to `token_display_value`, which also has no money handling.
`generate_document` (document creation) already calls `fmt_money` for the
same fields, so the two paths had silently diverged.

### Fix (`supabase/migrations/20260802050000_d15_money_rerender_fix.sql`)

One new branch in `remerge_contract_from_clauses`, calling `fmt_money` —
the same function `generate_document` already uses, not a second
implementation. Full `CREATE OR REPLACE` rebuilt from the live function
body (`pg_get_functiondef`), only that one branch added.

**Scope, verified exactly:** only two live fields carry
`format_type='currency'` — `HORSE_LEASE_V2.HORSE.FAIR_MARKET_VALUE` and
`HORSE_LEASE_V2.TXN.EVAL_FIXED_FEE`.

### Verification after fix — two independent real documents

```
c36449f7, before:  "Current fair market value: 52500.00"
c36449f7, after:   "Current fair market value: $52,500.00"
  (full-body diff: exactly 3 lines changed — the 2 fee-format lines plus the
   one location field intentionally edited to trigger the re-merge; nothing
   else in the 246-line document changed)

c36449f7, TXN.EVAL_FIXED_FEE (250) set + gating fields satisfied, re-rendered:
  "The evaluation period fee is $250.00, is earned upon commencement..."

5dbce25f (a second, previously-untouched real draft), re-rendered after an
unrelated field edit:
  "The evaluation period fee is $100.00, ..."  (was bare "100" before the fix)
```

### Second suspected instance — investigated, found NOT to need a fix

`TXN.LEASE_FEE` (`format_type='fee_schedule'`) was named in the prior
report's BACKLOG note as rendering raw JSON
(`{"initial_due":"850"}`) after a re-render. Traced fully:
`remerge_contract_from_clauses` calls `recompose_document_fields` first
(line 21 of the live function, unchanged), which already runs
`compose_field_prose('fee_schedule', ...)` — itself already calling
`fmt_money` (tagged `-- U2.1` in its own source) — and writes the composed
prose directly into `contract_fields.value` *before* the token-substitution
pass ever runs. Confirmed correct on two real documents (`5dbce25f`,
`ecaecd42`): `TXN.LEASE_FEE` renders as `Initial payment due: $0.00.` after
a real re-render.

The original BACKLOG reproduction (`{"initial_due":"850"}` as a raw JSON
string) turned out to have been written through `set_contract_field`
directly into the field's plain-text `.value` column — bypassing the
`.structured` jsonb column `recompose_document_fields` actually reads from.
That shape is one no real UI write path produces. **No fix applied here —
`docs/archive/BACKLOG.md` updated to record the investigation and its conclusion**,
so this doesn't get re-flagged as unfixed in a future pass.

All test-only field edits made during this investigation on both documents
were reverted to their pre-test values (`c36449f7` is already flagged
"void or dispose at cleanup" in `BACKLOG.md` from the prior session, so its
test values were left as-is per that existing disposition;
`5dbce25f`'s location and `EVAL_PERIOD_TYPE` fields were explicitly reset
and re-verified back to their original rendered state).

---

## 5. TASK 4 — TEST HARNESS SCHEMA SNAPSHOT

### What changed

`test/db/harness.ts`'s `createTestDb()` now defaults to loading a committed
schema snapshot (`test/db/fixtures/schema_snapshot.sql`, generated via
`pg_dump` against the live production database) instead of replaying all
~590 migration files. The migration-replay path is preserved unchanged and
still used automatically whenever `upTo` is passed (three existing test
files depend on this for testing intermediate schema states — confirmed
all still pass, 25/25, after this change).

**Additive only, confirmed:** `git diff --stat supabase/migrations/` shows
zero changes to any migration file.

### Seed data scope (owner-directed: minimal allowlist + drift guard)

Seven tables carry rows in the snapshot, each individually reviewed for PII
before inclusion:

- `organizations` (1 row — the tenant: name/slug/status only)
- `service_types` (pure catalog lookup — added after the first load attempt
  failed on `contract_templates_service_type_fkey`, a real dependency)
- `contract_templates`, `contract_section_defs`, `contract_clause_defs`,
  `contract_field_defs`, `template_tokens`

**`business_config` was explicitly excluded** after inspection: despite
sitting in a table that reads as "configuration," its live row carries a
real person's name (`signatory_name = "Charles Zigmund"`) and a live FK
into `contacts` (`signatory_contact_id`) — genuine PII, exactly the kind of
thing the owner flagged as a specific risk in this neighborhood of code.

A drift guard (`SNAPSHOT_DATA_TABLES` + `snapshotDataTargets()` in
`harness.ts`) parses every `INSERT`/`COPY` statement in the snapshot file
at load time and throws before ever executing it if any target table falls
outside this reviewed list — so a future regeneration of the snapshot with
a wider `--table` list fails loudly instead of silently absorbing whatever
that table contains.

### Two real bugs found and fixed while wiring this up

1. `pg_dump`'s own header sets `search_path` to `''` (empty, session-scoped,
   not transaction-local) so its own fully-qualified `public.x` statements
   resolve safely regardless. That setting **outlives the dump** and broke
   every unqualified query written afterward — `select ... from
   organizations` failed with `relation "organizations" does not exist`
   even though `pg_class`/`information_schema` confirmed the table existed.
   This took a real debugging pass to isolate (traced via a sequence of
   minimal reproduction probes, cleaned up after) since the harness's own
   pre-existing `try { ... } catch { /* stale comment */ }` around exactly
   this query was silently swallowing the failure. Fixed both in the
   snapshot file (`SET search_path TO public;` replacing the empty-set
   line, both occurrences) and defensively in `harness.ts` itself, so the
   fix doesn't depend solely on the generated file's content.
2. The comment on that pre-existing catch block was stale/misleading
   ("organizations table not created yet") — it's accurate for the
   `upTo`-truncated migration-replay path but was masking a real failure on
   the snapshot path. Corrected to say so explicitly.

### Golden-render suite — raw output, run once as instructed

```
$ npx vitest run test/db/golden_render.test.ts --reporter=verbose

 × golden render — every active template > renders every active template with no unresolved non-SIG tokens 4ms
   → h.sql is not a function
 × golden render — every active template > has no ⟦NEEDS:…⟧ residue baked into a stored template body 0ms
   → h.sql is not a function
 × golden render — every active template > money fields store canonical values (U2.1) 0ms
   → h.sql is not a function

TypeError: h.sql is not a function
 ❯ test/db/golden_render.test.ts:60:31
     60|     const templates = await h.sql<{ template_key: string; body: string…

 Test Files  1 failed (1)
      Tests  3 failed (3)
```

**This is a genuine finding, reported per instruction — not fixed, not
worked around.** `TestDb` (the harness interface) exposes `.q()`; every
other `test/db/*.test.ts` file uses it correctly (61 call sites). Only
`golden_render.test.ts` calls a nonexistent `.sql()` method, at all three
of its call sites. Confirmed by grep across the whole suite before
concluding this is isolated to this one file, not a harness gap.

Before this run, this suite could not reach this failure at all — `beforeAll`
died on the migration-chain break before a single test body ever executed
(its own header comment documents this: "This suite has NEVER been
executed"). The schema-snapshot fix genuinely unblocked setup; what's
surfaced now is a pre-existing bug in the test file's own method call,
one commit closer to actually running than it has ever been.

### Broader signal (context, not a Task 4 deliverable)

`npx vitest run test/db` (the full suite, not just golden-render): **143
tests now pass, 97 fail with real findings, 428 skipped — up from 0 passing
before this run** (every file previously died in `beforeAll`). The 97
failures and 38 fully-failing suite files were not investigated
individually — outside Task 4's stated scope (schema snapshot + harness
wiring + golden-render only) — but are now visible for the first time and
worth a dedicated pass.

---

## 6. DECISIONS (recorded during the run, most protective option chosen
where no explicit instruction existed)

- **D16** — H2's mechanism: since H1 confirmed the release flow is
  sessionless and the literal spec fallback text assumes a server-side
  endpoint that doesn't exist in that path, built one (`api/sign-release.ts`)
  rather than accepting the exposure or making a DB change (forbidden by
  spec). Matches option 2 of the three the prior report left open for the
  owner.
- **D17** — Delivery-email defects (org_id insert bug, PDF-vs-raw-text,
  subject/greeting/signature) were fixed as part of Task 1's own
  verification loop, not deferred, since they were discovered via the
  DONE-CHECK's own "verify end-to-end" requirement and directly blocked
  confirming H2 actually works.
- **D18** — Party-copy email copy went through three real iterations based
  on direct owner review of actual delivered emails, ending in a
  deliberately plain/professional style matching the existing
  company-notification tone, per explicit owner preference stated after
  comparing both side by side.
- **D19** — D15's `fee_schedule` instance: investigated fully rather than
  assumed-fixed-by-similarity to the `currency` fix; found already correct
  through a different code path (`recompose_document_fields` /
  `compose_field_prose`), so no fix applied there — avoided a redundant or
  wrong change.
- **D20** — Harness seed-data scope: exactly the six tables the tests
  provably need plus one (`service_types`) added after a real FK failure
  proved it necessary — never widened speculatively. `business_config`
  excluded after PII review found a real name and a live contact FK.
- **D21** — `golden_render.test.ts`'s `.sql` vs `.q` bug reported, not
  fixed — outside Task 4's stated scope (harness setup path + running the
  suite once), and per the explicit instruction that harness failures are
  findings to report.
- **D22** — `admin@fhequestrian.com`'s real-email H3 check: initially
  mischaracterized as blocked (no password); corrected per owner
  instruction to check `auth.identities` before concluding — the account
  is Google-OAuth-only, which has no password-grant equivalent for
  scripted testing. Reported as not-applicable rather than blocked, since
  "blocked" implies a fixable gap and this doesn't have one.

---

## 7. WHAT REMAINS OPEN

1. `golden_render.test.ts`'s `h.sql` → should be `h.q` — a one-line test-file
   fix, deliberately not made (out of Task 4's stated scope).
2. The broader `test/db` suite's 97 individual failures and 38
   fully-failing suite files, now visible for the first time — a real body
   of findings worth a dedicated triage pass, not attempted this run.
3. Kiosk-to-account auto-promotion + new `/sign/guest|rider|horse|rider+horse`
   short URLs — explicitly deferred by the owner to a separate,
   orchestrator-authored task.
4. `docs/archive/BACKLOG.md`'s other pre-existing open items (Business admin suite,
   `pending_fee_candidates` p.mobile bug, dead nav route, placeholder
   media) — untouched this run, out of scope.

---

## 8. FINAL COMMIT / PUSH / HASH CONFIRMATION

- Seven commits this run, in order: `42e2ded` `e6dbe95` `b3b628a` `973c360`
  `9c6052f` `ddae52e` `305474b`
- All pushed to `origin/main` individually as they landed (no batching).
- **Final confirmed hash, `git fetch origin main` immediately before writing
  this section:** local `HEAD` and `origin/main` both
  `305474b6720cf07af973522708d89875682efa97` — byte-identical.
- `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (0
  errors/29 pre-existing warnings), `npm run build` all clean after every
  code-bearing commit in this run.
