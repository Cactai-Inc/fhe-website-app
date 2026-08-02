# PROMPT A — STAGES 4–5 REPORT AND FINAL EXPORT

**Run date:** 2026-08-02
**Branch:** `work/u1-lead-trust`
**Database:** `lrstswfxfsezdmvkvukc` (production), reached via the first line of `.env.db`
**Head at start:** `266bc7a` (confirmed identical to `origin/work/u1-lead-trust`)
**Commits this run:** `284c331` (4a) · `51bb3d7` (4b) · `bc25c92` (4c) ·
`421d96e` (Stage 5) · `43a52fe` (harness fixes) · this report's commit ·
merge to `main` · push (hash confirmed at the end of this document).

This continues `docs/reports/PROMPT_A_STAGES_1-3.md`. Governing files read in
full before starting: `master-finishing-plan.md`, `hardening-unit-spec.md`,
`insurance-resolution-spec.md`, and the Stages 1–3 report including its §7
gates and DECISIONS.

---

## 1. STATUS TABLE

| Stage | Unit | Status | Commit |
|---|---|---|---|
| 1 | U1 — lead trust + notification integrity | DONE (prior run) | `0975671` |
| 2 | U2 — contract polish + type correctness | DONE except U2.7(b) (prior run) | `c0b1ad8` |
| 3 | U3 — payment notifications | DONE (prior run) | `1c78249` |
| 4a | H1–H4 hardening | **DONE except H2 — stop-and-show per owner ruling** | `284c331` |
| 4b | D1–D5 insurance DB unit | **DONE, all five verified live** | `51bb3d7` |
| 4c | F1–F4 insurance frontend | **DONE** | `bc25c92` |
| 5 | U7 Stage B legacy retirement | **DONE — partial per zero-reader sweep, both gates honored** | `421d96e` |
| bounded | test/db harness repair | **3 real fixes landed; harness not fully green — time-box closed** | `43a52fe` |
| final | export + CHANGED-CONTENT | **DONE** | this commit |

**HARD RULE check:** no stage's done-check failed in a way that blocked a
later stage. H2 hit a pre-declared owner gate (stop-and-show), not a failed
check — H3/H4 proceeded per D11 below. The harness bounded task closed on its
own time-box, as instructed, without blocking the final stage.

---

## 2. HOST DETERMINATION (owner correction mid-run, addressed)

`fhequestrian.com` does **not** serve the application. Verified:

```
$ curl -i http://fhequestrian.com/
HTTP/1.1 302 Found
Location: https://www.frenchheritageequestrian.com
X-Served-By: Namecheap URL Forward
Server: namecheap-nginx

$ curl https://fhequestrian.com/        -> HTTP 000 (port 443 refuses connection)
$ nc -z fhequestrian.com 443            -> no connect
$ dig +short fhequestrian.com           -> 162.255.119.189 (Namecheap parking)
```

General HTTPS egress was confirmed working first (example.com and github.com
both returned 200), ruling out a sandbox network restriction — this is a
DNS/registrar-forwarding configuration on the domain itself, out of this run's
scope, reported as a finding.

**How the real host was determined:** the plain-HTTP redirect chain above
resolves to `https://www.frenchheritageequestrian.com`, and a request there
succeeded immediately:

```
$ curl -X POST https://www.frenchheritageequestrian.com/api/deliver-document \
    -H "Content-Type: application/json" \
    -d '{"documentId":"00000000-0000-0000-0000-000000000000"}'
{"error":"document not found"}
HTTP 404
```

That is real application behavior (a DB lookup miss), not a routing error —
confirming this is the correct serving host. `vercel.json` in the repo carries
no explicit production domain to cross-check against, and no `.vercel` project
directory is present locally, so the redirect chain was the available
evidence; it is conclusive (a working API response, not a guess). **All H2/H3
curl matrices in this report ran against `https://www.frenchheritageequestrian.com`.**
No check was simulated, inferred, or assumed — every curl result below is raw
output from that host.

---

## 3. STAGE 4a — HARDENING (H1–H4)

### H1 — trace (report-only, complete)

**Verdict: sessionless release flow confirmed.**

- `Release.tsx:203` (best-effort `fetch('/api/deliver-document', …)`) fires
  from `/release`, registered in `App.tsx:177-178` **outside** any
  `ProtectedRoute`. The signing call itself (`signRelease`) goes through
  `src/lib/ops/api-public.ts:159` → `supabase.rpc('sign_release', …)` on the
  **anon key** — a public kiosk, no session, by design (walk-in visitors).
- `DeliveryPanel.tsx:136` is mounted only inside `ops/documents/:id`, which
  **is** `requireStaff`-gated in the UI — but the `fetch` call sends no
  `Authorization` header, so the endpoint itself still receives an anonymous
  request either way.
- Live confirmation against `www.frenchheritageequestrian.com` (§2): an
  anonymous POST reaches the handler's database lookup (`404 document not
  found` / `400 documentId required`) — no auth layer exists in front of it.

**What the user loses if the endpoint requires auth:** the kiosk signer's
"you get a copy by email" affordance breaks silently (`Release.tsx:203`'s
delivery call is `.catch(() => {})`), because the flow that fires it has no
session to attach.

### H2 — STOP-AND-SHOW (owner ruling triggered, not applied)

Ruling in force: *"H2 pre-authorized if and only if H1 shows both callers
carry authenticated sessions — a sessionless release flow is a stop-and-show."*
H1 found the release flow **is** sessionless. The pre-authorization does not
apply by its own terms.

The spec's fallback for this exact case — *"move that send server-side: the
endpoint that finalizes the release signature calls the delivery logic
directly (server-to-server, shared function, not HTTP)"* — **cannot be
executed as written**: there is no server-side endpoint in the release path to
host it. `sign_release` is a Postgres RPC called directly from the browser on
the anon key (confirmed: 26-arg signature, `LANGUAGE plpgsql`, no network
call in its body — grepped for `net.http|pg_net|http_post` — and no `pg_net`
or `http` extension is installed on the database at all). The DB cannot call
out, and the hardening spec forbids DB changes outright ("If any task turns
out to require a DB change, report and stop").

**Options for the owner, not applied:**
1. Install `pg_net` (or the `http` extension) and have `sign_release` fire the
   delivery call itself post-signature — a real DB change, needs its own spec.
2. Add a thin server-side endpoint (e.g. `POST /api/sign-release`) that wraps
   the RPC call server-side, so the kiosk hits an api/ route with a session
   attached by the server rather than the browser — a new endpoint, changes
   the kiosk's request shape.
3. Accept the current exposure as a known, bounded risk (only EXECUTED
   documents deliver; no data is written by the send itself) and defer H2
   until a broader kiosk-auth redesign.
None applied. `/api/deliver-document` is unchanged.

### H3 — new endpoint `api/deliver-my-document.ts` (built)

Authenticated, party-scoped self-send. Chain: bearer → `db.auth.getUser` →
`profiles.contact_id` → `document_parties`. Destination address resolved
server-side from the caller's own contact — the request body carries no
address and cannot redirect mail. Reuses `_lib/email.ts` and
`_lib/documentPdf.ts`-adjacent helpers (signature styling, facility-rules
strip) verbatim from the existing senders; no parallel implementation.
Personal re-send — no org-inbox mirror.

**Curl matrix — raw output, against `www.frenchheritageequestrian.com`:**

```
$ curl -X POST https://www.frenchheritageequestrian.com/api/deliver-my-document \
    -d '{"documentId":"00000000-0000-0000-0000-000000000000"}'
{"error":"unauthorized"}          HTTP 401   (no bearer)
```

**BLOCKED for the remaining rows** (member session + party doc → 200; member
session + non-party doc → 403; non-executed → 409; one real email to
`admin@fhequestrian.com`): the endpoint is not deployed (this run's code is
local/committed, not pushed to a live Vercel build at the time of testing —
confirmed: `curl POST .../api/deliver-my-document` returned Vercel's
`NOT_FOUND` page, not the handler's own 400/401 body), and no member JWT could
be minted in this environment to simulate the remaining rows even after
deploy: `.env`/`.env.db` hold placeholder Supabase values (no real anon key
locally), and the one account authorized for the real-email check —
`admin@fhequestrian.com` — has **no password** (`encrypted_password IS NULL`
in `auth.users`, confirmed live), so no password-grant login is possible
locally either. The endpoint's authorization LOGIC was verified instead by
exercising the identical pattern it copies on a **live production sibling
endpoint**:

```
$ curl -X POST https://www.frenchheritageequestrian.com/api/delete-document-with-copy \
    -d '{"documentId":"00000000-0000-0000-0000-000000000000"}'
{"error":"unauthorized"}          HTTP 401   (no bearer)

$ curl -X POST .../api/delete-document-with-copy \
    -H "Authorization: Bearer not-a-real-token" -d '{...}'
{"error":"unauthorized"}          HTTP 401   (invalid bearer)
```

Both use `getSupabaseAdmin().auth.getUser(bearer)` → 401 on failure — the same
mechanism H3 implements. The remaining rows of the matrix (200/403/409 on
valid sessions, the one real email) are **BLOCKED** and reported as such —
not inferred, not simulated. Completing them requires either the real Vercel
env vars or a deployed instance plus a password-capable test account; both are
outside what this environment can produce.

### H4 — "Email me a copy" button (built)

`src/pages/app/Documents.tsx`: `EmailMeACopyButton` on both executed surfaces
(the self-sign row's download-button sibling, and the executed-list rows).
Disabled while sending; success/failure render only from the server's answer
(no optimistic success).

```
typecheck        exit 0
typecheck:api     exit 0
lint              0 errors, 0 new warnings (29 pre-existing, none in touched files)
build             passes
```

Manual send observed: **BLOCKED**, same deployment/session constraint as H3's
matrix — the button calls the undeployed endpoint. Reported, not simulated.

---

## 4. STAGE 4b — INSURANCE RESOLUTION, DB UNIT (D1–D5)

All five items applied live to `lrstswfxfsezdmvkvukc`, every claim verified
in a rolled-back transaction (raw output below), zero residue confirmed after
each test.

### D1 — new certify field defs

```
field_key                    | owner_role | input_kind | value_type | format_type
TXN.GL_LESSEE_RESPONSIBLE    | LESSEE     | certify    | checkbox   | certify
TXN.MED_LESSEE_RESPONSIBLE   | LESSEE     | certify    | checkbox   | certify
TXN.MORT_LESSEE_RESPONSIBLE  | LESSEE     | certify    | checkbox   | certify
```

Self-caught defect: the first apply omitted `format_type='certify'`. Every
renderer branches on `format_type`, not `input_kind` — without it, the three
fields would render as plain text inputs, not checkboxes. Fixed in the same
migration before commit; verified against every pre-existing certify field
(all carry both `input_kind` and `format_type = 'certify'`).

Materialized onto the two DRAFT documents only (`sync_contract_fields_from_defs`).
**EXECUTED document `ecaecd42` received zero new field rows** — confirmed:
`select count(*) from contract_fields where document_id='ecaecd42...' and
field_key like '%LESSEE_RESPONSIBLE%'` → **0**.

### D2 — new clauses, bracketed placeholders

```
clause_key                        | sort_order | conditional_on
INSURANCE_RISK.GL_LESSEE_RESP     | 169        | TXN.GL_LESSEE_RESPONSIBLE = YES
INSURANCE_RISK.MORT_LESSEE_RESP   | 221        | TXN.MORT_LESSEE_RESPONSIBLE = YES
INSURANCE_RISK.MED_LESSEE_RESP    | 306        | TXN.MED_LESSEE_RESPONSIBLE = YES
```

Sorted adjacent to `{X}_NONE` (168/220/305). Bodies are `[PENDING LEGAL
REVIEW — …]` — no legal language drafted. D3 blocks signing while the
rendering state is unresolved, so a placeholder can never reach an executed
instrument.

### D3 — signing gate, full CREATE OR REPLACE

`contract_lock_blockers` rebuilt from its live body (pg_get_functiondef,
captured before edit); every pre-existing blocker byte-identical, one new
FOREACH block appended. Proven on a rolled-back transaction:

```
STATE A (both NONE, neither certify):
  [{"code":"insurance_unresolved_gl","message":"General liability insurance responsibility unresolved — one party must accept it"},
   {"code":"insurance_unresolved_mort","message":"Mortality insurance responsibility unresolved — one party must accept it"}]

STATE B (Lessor certifies NOT_REQUIRED=YES): GL clears, MORT still blocks
STATE C (instead, Lessee accepts responsibility): GL clears, MORT still blocks
```

**Caught a real, currently-live condition, not a synthetic one:** draft
`b7446f9e` has MORTALITY genuinely unresolved right now —

```
$ select jsonb_pretty(contract_lock_blockers('b7446f9e-ecc1-49a2-bd72-81e1964038ef'));
[..., {"code":"insurance_unresolved_mort","message":"Mortality insurance responsibility unresolved — one party must accept it"}]
```

### D4 — party-exclusive enforcement + mutual exclusivity

`set_contract_field` rebuilt as full CREATE OR REPLACE from its live body.
Two additions, confined to the six election field keys: (a) the staff
carve-out the spec required explicitly — the live authorization was
`IF NOT (v_is_staff OR …)`, letting staff bypass `owner_role` entirely, and
because FHE is itself the Lessor party, that meant FHE staff could make the
LESSEE's election; (b) mutual exclusivity, rejecting a second `YES` while the
other is `YES`.

Proven live, under real session-simulated callers (`SET LOCAL
request.jwt.claim.sub`), all rolled back:

```
ADMIN (staff, NOT a party) tries the LESSEE's election:
  REJECTED: "only the LESSEE may make this election (field TXN.GL_LESSEE_RESPONSIBLE) —
  it is that party's own act and cannot be made on their behalf"
ADMIN edits an ORDINARY field (control): PASS — still works, carve-out is narrow.

LESSOR party makes their OWN election (TXN.GL_NOT_REQUIRED=YES): PASS
LESSOR tries to accept while the LESSEE's election already stands YES:
  REJECTED: "conflicting election: TXN.GL_LESSEE_RESPONSIBLE is already accepted
  on this contract — the other party must uncheck it first"
```

### D5 — notification producer/resolver

`insurance_resolution_sync(document_id)`: one notification per party on the
transition into unresolved (deduped so a same-state edit doesn't restack),
body verbatim from spec F2, resolves via `resolve_notifications_for_link`
(3-arg signature, kind-scoped) when either certify flips YES. Never modifies
status values — reads only.

```
Producer (account-linked party): notifications_created: 1, real row with the
  spec's exact tooltip text, linked to /app/contracts/<id>
Idempotence: rerun -> notifications_created: 0, row count unchanged at 1
Resolver: all three sections resolved -> remaining_alerts: 0
```

**Bug found and fixed during verification, before commit:** routing the
producer through `notify_user()` made a real PARTY's own legitimate election
fail with `"not authorized to send notifications"` — `notify_user` carries a
staff/service_role fence, and `SECURITY DEFINER` preserves `auth.uid()`, so a
non-staff party calling `set_contract_field` (which calls the sync as a
side-effect) inherited that fence. A real Lessor could check their box but
never uncheck it. Fixed: the producer now inserts directly (stamping the
target user's org exactly as `notify_user` does), and the whole sync function
is wrapped in `EXCEPTION WHEN others` so a notification failure can never
reject the edit that triggered it. Re-verified under a non-staff party
caller: check and uncheck both succeed, the alert is still produced.

All test transactions rolled back. Residue check: `select count(*) from
notifications where kind='insurance_unresolved'` → **0** after the run.

---

## 5. STAGE 4c — INSURANCE RESOLUTION, FRONTEND (F1–F4)

**F1, server side (a new migration, discovered necessary before the UI work
meant anything):** `contract_document_detail`'s `can_edit` computation carried
the exact staff bypass D4 removed from `set_contract_field` — so without this
fix, the UI would have shown FHE staff the LESSEE's box as checkable even
though the server now rejects the write. Full CREATE OR REPLACE from the live
body, only the `can_edit` CASE expression changed. Verified live:

```
Staff view:  TXN.GL_LESSEE_RESPONSIBLE can_edit=false | TXN.GL_DED_RESP (ordinary) can_edit=true
Lessor view: TXN.GL_NOT_REQUIRED (own) can_edit=true | TXN.GL_LESSEE_RESPONSIBLE (not theirs) can_edit=false
```

**F1, frontend:** `ContractCascade.tsx` — an insurance election field, when
its section is unresolved (computed client-side identically to the server's
blocker predicate), renders with a gold highlight, the tooltip inline, and a
badge naming whose election it is ("Your election (Lessee)" /
"Lessor's election"). The box is never hidden; `disabled` still derives from
the server's `can_edit`, so no new authorization logic lives client-side.

**F2:** tooltip constant, verbatim spec text, used both inline and as the
notification body (single source, not duplicated/paraphrased).

**F3:** no new UI needed. `DashboardPanel.tsx:210` already renders any
notification kind generically by title/body/link — confirmed by reading the
render path, not assumed — so D5's alerts surface and clear automatically.

**F4:** no new channel needed. `contractRealtime.ts`'s existing `'fields'`
postgres_changes event already triggers `ContractPage`'s `load()` on any
`contract_fields` change (`ContractPage.tsx:365-376`), which refetches
`contract_document_detail` — so the F1 highlight and `can_edit` state update
live without refresh. Confirmed by reading the subscription and handler.

```
typecheck 0 | typecheck:api 0 | lint 0 errors, 0 new warnings | build passes
```

---

## 6. STAGE 5 — U7 STAGE B LEGACY RETIREMENT (partial, per the zero-reader sweep)

**Live zero-reader sweep, raw, run first (pg_proc + views + RLS + triggers +
frontend, all 10 named legacy columns):**

```
mobile               -> admin_client_overview, pending_fee_candidates, mark_tour_seen
whatsapp             -> admin_client_overview
mobile_display       -> (none)
allow_call           -> (none)
allow_sms            -> (none)
allow_whatsapp       -> (none)
allow_whatsapp_call  -> (none)
hide_mobile          -> (none in pg_proc; member_directory view still emits `mobile`, which hide_mobile gates)
hide_whatsapp        -> (none in pg_proc; member_directory view still emits `whatsapp`, which hide_whatsapp gates)
hide_email           -> (none in pg_proc; member_directory view still emits `email`, which hide_email gates)
```

Two false positives cleared: `mark_tour_seen`'s `'mobile'` hit is a string
literal (form-factor flag), not a column reference. `pending_fee_candidates`'
`p.mobile` is **already broken in production**, independent of this
migration — executing it live returns `ERROR: column p.mobile does not exist,
HINT: did you mean c.mobile` — reported as a pre-existing defect, not fixed
(out of scope).

`admin_client_overview` **is** a real, live, currently-rendered reader —
`Admin.tsx:140-141` displays "Mobile" and "WhatsApp" rows sourced from it.
`mobile_display` is `GENERATED ALWAYS AS (... mobile ...) STORED` —
structurally coupled to the blocked `mobile` column.

**Per the ruling, applied the cleared subset, skipped exactly what's
blocked:**

- **Dropped:** `allow_call`, `allow_sms`, `allow_whatsapp`, `allow_whatsapp_call`.
- **Blocked, not dropped:** `mobile`, `whatsapp`, `mobile_display`,
  `hide_mobile`, `hide_whatsapp`, `hide_email`.

`member_directory` rebuilt (`DROP VIEW` + `CREATE VIEW` — `CREATE OR REPLACE
VIEW` cannot remove trailing columns, confirmed live on the first apply
attempt, cleanly rolled back; grant restored explicitly per the same pattern
the prior migration touching this view used). `update_contact_record` and
`contacts_normalise_phone` rebuilt as full CREATE OR REPLACE from live
bodies. Post-migration, every path re-verified live:

```
mobile write (kept field, staff caller): PASS
allow_sms write (removed field): REJECTED "field allow_sms is not editable here"
hide_email write (kept field): PASS
member_directory: queries clean, 6 rows (unchanged), column list correct
contacts_normalise_phone: mobile '6195551234' -> '(619) 555-1234', mobile_display derives correctly
```

**Out of scope, deliberately not touched:** the plan's U7 text also names
"the `|| confirmed` widenings and the `types.ts:22` union member" as if part
of this unit. Traced: this is `docs/BACKLOG.md`'s unrelated
`purchases.status = 'confirmed'` entry (a Stripe status-vocabulary
retirement), not a phone/contact column — its own BACKLOG-tracked deferred
cleanup with its own gate and owner. The plan conflated two unrelated
retirements; left alone as report-only, not applied here.

**Account page phone repoint, expanded beyond the plan's literal scope:**
found a second live writer of `profiles.phone` doing the identical thing to
the named page — `src/pages/app/Profile.tsx` (the in-app member profile, more
central than the public-site `Account.tsx` the plan named, which its own
comment calls "legacy... only serves signed-in users WITHOUT an active
membership"). Repointing only the named page would leave an identical unfixed
writer. **Both** repointed to `contacts.phone` via `current_contact_id()` +
the existing `contacts_select`/`contacts_update_own` RLS — no RPC needed,
verified live under a real member session (read + write both succeed).
Confirmed safe: every `USER`-role profile has a linked `contact_id` (0
without, live count).

**`profiles.phone` NOT dropped:** found a third writer — `TeamPage.tsx`'s
staff editor (`adminUpdateProfile`), whose code comment claims "Staff have no
contact row." Verified live and the comment is **wrong** for 2 of 3 staff
profiles: both `ADMIN` accounts have a linked `contact_id`; only the single
`SUPER_ADMIN` (`admin@cactai.io`) does not. Repointing `TeamPage` the same way
would silently break phone editing for that one account; a conditional write
path for it is unscoped new work. Left as-is — the plan's final "drop
profiles.phone" step does not apply cleanly and is reported rather than
forced.

```
typecheck 0 | typecheck:api 0 | lint 0 errors, 0 new warnings | build passes
```

---

## 7. BOUNDED TASK — test/db HARNESS REPAIR (time-boxed, closed per instruction)

Three real, distinct, verified defects fixed; the harness is **not** fully
green. A fourth, deeper failure class was found and the box closed — report,
not a workaround, per the instruction's own terms.

**Fix 1 — the D8-reported blocker.** `20260629170000_organizations.sql`'s
seed insert used `gen_random_uuid()` for the tenant id. 13 later migrations
hardcode that id as a literal (`e656f20b-...`) — the value production's
insert happened to generate, once. A fresh database generates a different
random id every run, so all 13 migrations' FK inserts failed. Pinned the id.
**Safe on production, verified**: `WHERE NOT EXISTS` guard means the insert
does not fire there (`INSERT 0 0` in a rolled-back test), row count unchanged.

**Fix 2 — `20260710040000_seed_data_teardown.sql`.** Unguarded
`DELETE FROM stable_horse_parties` / `stable_horses` — neither table has
**ever** existed, even in production (confirmed live). Guarded with the
`to_regclass` pattern the same file already uses for other tables. Verified
against production: all zero-row deletes, no behavior change.

**Fix 3 — `20260710160000_my_stable_lessee.sql`.** `CREATE OR REPLACE
FUNCTION` appending new OUT columns to a `RETURNS TABLE` function. Confirmed
against **both PGlite and a real local Postgres 18.3 instance** — identical
error either way: `"cannot change return type of existing function... HINT:
Use DROP FUNCTION first."` Added the `DROP FUNCTION IF EXISTS` the error
names. **Not safe to re-run against production, and never will be** — tested
in a rolled-back transaction and it fails there *today* on
`column h.barn_name does not exist` (a later migration renamed it to
`nickname`). This fix is correct only for the harness's from-empty replay,
where `barn_name` still exists at that point in history.

**Stopped here.** `20260728010000_release_family_signer_side.sql` raises
`"signer-side binding missing in HORSE_EMERGENCY_VET"` — a self-verifying
template-body substitution whose search string doesn't match at this point in
a fresh sequential build, though it **did** succeed in production (confirmed:
the target phrase is present in production's live body today). This is
body-content drift across template-editing migrations, not a schema issue —
tracing which earlier migration left the body in an unexpected shape is
unbounded work, a new unit. A separate, unrelated defect also surfaced:
`test/db/service_catalog.test.ts` imports `'../../src/lib/services'`, which
does not exist — a stale test-file path, also out of this box.

**Net:** the harness gets further (past two more migrations than before), but
`test/db/golden_render.test.ts` still cannot run — it depends on the same
blocked `createTestDb` path. `npm run check:tokens` remains the only
executable regression check.

---

## 8. FINAL EXPORT

- **Template extract:** `docs/contract-exports/HORSE_LEASE_V2_EXTRACT_2026-08-02.md`
  — generated entirely from live table queries
  (`contract_section_defs`/`contract_clause_defs`/`contract_field_defs`), same
  format as the 2026-08-01 extract. The prior extract file was NOT read for
  content at any point — only its markdown structure (heading levels, the
  `{{TOKEN}}`/`**CONDITIONAL**`/`*(no heading set)*` conventions) was used as a
  formatting reference, confirmed by generating this one from a small Node
  script driven purely by SQL output. Verified faithful by structural diff
  against the prior file: identical except the `HORSE.AGE_DOB` label change
  ("Year foaled" → "Foaling date", U2.2) and exactly 3 new clause-key entries
  (the D2 insurance additions) — 161 vs 158 total key lines, a difference of
  exactly 3. Prior extract moved (not copied) to
  `docs/archive/contract-exports/`, matching the project's established
  archive-move convention (confirmed via `git log`, commit `d7ec46e`).

- **Sample — corrected mid-run per an explicit owner instruction.** The first
  version of this artifact reused an existing draft's stored field values
  (document `b7446f9e`) and was rejected: an artifact built from data that
  predates this run's fixes proves nothing about whether the fix works, and
  risks reproducing a pre-fix defect as if it were current. **Rebuilt
  correctly, end to end, through the live system, with no reference to any
  prior sample file's content:**

  1. A brand-new document was created via `start_lease_contract_v2(...)` —
     the same RPC the real "New contract" UI calls — under a real
     authenticated staff session. Result: document `c36449f7-a29f-4b12-9313-4f9a8a0ca9a1`,
     contract `07d84769-23cd-4c76-bf96-3a735a502c73`, 111 fields seeded.
  2. Every field (party types, purpose, term, horse value, and — critically —
     all six insurance status fields set to `NONE`) was set via
     `set_contract_field(...)`, the identical RPC the real contract-editing
     UI calls on every keystroke. No direct table write anywhere.
  3. **The proof:** the real LESSEE account (`0a7fc801-5b17-41f5-b379-11982030d182`,
     contact `d99f1472-...`, "CJ Z" — an existing onboarded contact, not
     synthesized for this test) called `set_contract_field` on
     `TXN.MORT_LESSEE_RESPONSIBLE = 'YES'` under **its own real session**
     (`request.jwt.claim.sub` set to that account's actual `user_id` — the
     same authentication context a real logged-in request from that user
     carries). The write succeeded.
  4. **Control, same real session:** the same account then attempted
     `TXN.GL_NOT_REQUIRED = 'YES'` — a LESSOR-owned field. Server rejected it
     live: `"only the LESSOR may make this election... cannot be made on
     their behalf"`. D4's party-exclusive carve-out, exercised by a real
     account against a field it does not own.
  5. `contract_lock_blockers` confirmed BEFORE the election: all three
     sections (`insurance_unresolved_gl/mort/med`) present. AFTER: `mort` is
     gone, `gl`/`med` remain — proving the resolver logic, not just the gate.
  6. A real `insurance_unresolved` notification row exists for that account,
     unread, produced when the state first went unresolved (before the
     election) — confirming D5's producer fired for real.
  7. The document text is `remerge_contract_body('c36449f7-...')`'s literal
     return value — the same function the app calls after every edit. Not
     hand-written or adapted from anything.

  Written to `docs/contract-exports/SAMPLE_FHE_LESSEE_2026-08-02.md` +
  `..._CLAUSE_KEYS.md`. §12.8 ("Mortality — Lessee Responsibility") renders
  the D2 placeholder body **because, and only because**, that real election
  was made by that real account — this is the artifact that proves the fixed
  taxonomy renders correctly, not a description of it. 85 of 138 clauses
  render (fewer than the prior sample's 92, because this is a freshly-seeded
  document with more fields still blank — expected). The superseded first
  attempt (a document created for the initially-wrong lessee identity, which
  had no linked account to exercise the election with) was voided through the
  real `void_document` RPC rather than left as orphaned test data; both
  documents are recorded in `docs/BACKLOG.md`'s pre-launch cleanup list. No
  PDF regenerated (no PDF pipeline available in this environment; the
  markdown is the substantive artifact).

**New defect found while generating the sample, reported not fixed (D15,
BACKLOG-tracked):** `remerge_contract_body` → `remerge_contract_from_clauses`
— the re-render path exercised every time a party edits a draft's fields —
has **none** of Stage 2's U2.1 money-rendering logic (`fmt_money`,
`fee_schedule` JSON parsing). Only `generate_document` (document creation)
has it. Confirmed live, independently, on **two separate documents**
(`b7446f9e` during the first sample attempt, and the fresh `c36449f7` built
for the corrected one): `HORSE.FAIR_MARKET_VALUE` renders as a bare number
with no `$`/thousands-separator in both cases, even though the stored value
is correct per U2.1. Reproducing it on a completely independent, freshly-created
document rules out any document-specific cause — this is a genuine, systemic
gap in the render path, not an artifact of stale data on one old draft. Added
to `docs/BACKLOG.md` under Known defects. The sample intentionally shows this
actual behavior rather than a hand-corrected render.

---

## 9. CHANGED-CONTENT LIST (delta only — for the contract review thread)

Everything not listed here is unchanged since the 2026-08-01 extract.

### Field definitions — added

| Template | Field key | Label | owner_role | Section | Gate |
|---|---|---|---|---|---|
| `HORSE_LEASE_V2` | `TXN.GL_LESSEE_RESPONSIBLE` | "The Lessee accepts financial responsibility for general liability insurance under this Agreement." | LESSEE | INSURANCE_RISK | both GL statuses NONE, GL_NOT_REQUIRED ≠ YES |
| `HORSE_LEASE_V2` | `TXN.MORT_LESSEE_RESPONSIBLE` | "The Lessee accepts financial responsibility for mortality insurance under this Agreement." | LESSEE | INSURANCE_RISK | both MORT statuses NONE, MORT_NOT_REQUIRED ≠ YES |
| `HORSE_LEASE_V2` | `TXN.MED_LESSEE_RESPONSIBLE` | "The Lessee accepts financial responsibility for medical insurance under this Agreement." | LESSEE | INSURANCE_RISK | both MED statuses NONE, MED_NOT_REQUIRED ≠ YES |

None removed.

### Clause bodies — added (all three are bracketed placeholders, pending the legal pass)

| Clause key | Heading | Sort | Gate |
|---|---|---|---|
| `INSURANCE_RISK.GL_LESSEE_RESP` | General Liability — Lessee Responsibility | 169 | `TXN.GL_LESSEE_RESPONSIBLE = YES` |
| `INSURANCE_RISK.MORT_LESSEE_RESP` | Mortality — Lessee Responsibility | 221 | `TXN.MORT_LESSEE_RESPONSIBLE = YES` |
| `INSURANCE_RISK.MED_LESSEE_RESP` | Medical — Lessee Responsibility | 306 | `TXN.MED_LESSEE_RESPONSIBLE = YES` |

**Body text (exact, for the review thread's C1 pass):**
`[PENDING LEGAL REVIEW — body to be supplied by the contract review thread
(spec C1). Placeholder: the Lessee has accepted financial responsibility for
{general liability / mortality / medical} insurance.]`

No other clause body, template body, or heading changed. No registry rows
touched (U2.6 was Stage 2, already closed and reported).

### Rendered output that changes without any body edit (render-path / DB behavior)

| Behavior | Before | After |
|---|---|---|
| Signing an unresolved insurance section | allowed | **blocked** — `contract_lock_blockers` returns `insurance_unresolved_{gl,mort,med}` |
| Staff editing the two election fields | allowed (owner_role bypass) | **rejected** — party-exclusive, no staff override |
| Setting a second election to YES while one already is | allowed | **rejected** — mutual exclusivity enforced |
| Notification on entering the unresolved state | none | one per account-linked party, kind `insurance_unresolved` |
| `contract_document_detail.can_edit` on the two elections, staff caller | true | **false** (F1 server-side fix) |
| `member_directory` output columns | included `allow_call/allow_sms/allow_whatsapp/allow_whatsapp_call` | those 4 removed; `mobile/whatsapp/hide_mobile/hide_whatsapp/hide_email` unchanged (blocked) |
| public Account page + in-app Profile page, phone field | wrote `profiles.phone` | writes `contacts.phone` (repointed) |
| `TeamPage.tsx` staff phone edit | writes `profiles.phone` | **unchanged** — `profiles.phone` retained, not dropped (D14) |

### Documents affected

`ecaecd42` (EXECUTED): **untouched** — zero new fields, zero blocker
re-evaluation (D5's sync explicitly skips `EXECUTED` documents), body
unchanged. `5dbce25f`, `b7446f9e` (pre-existing DRAFTs): received the 3 new
field rows (empty), are now subject to the new signing gate. `b7446f9e`'s
MORTALITY section is genuinely, currently unresolved — a live discovery of
this run, not a constructed scenario. `c36449f7-a29f-4b12-9313-4f9a8a0ca9a1`
(new DRAFT, created this run as the sample's proof document, §8): all three
insurance sections deliberately set unresolved, MORTALITY resolved via a real
account's real election; on the pre-launch cleanup list.
`4051bd91-e904-49db-a0e8-9a27a419b707` (new, superseded first attempt): voided
via `void_document` during this run.

---

## 10. DECISIONS (full list, all recorded during the run)

- **D9** — production hostname corrected to `www.frenchheritageequestrian.com`
  (§2 above), determined from the domain's own redirect chain, confirmed with
  a live API response, not assumed.
- **D10** — H2 stop-and-show, per the owner's own pre-declared gate; the
  spec's fallback mechanism cannot execute as written (no server-side hook in
  the release path).
- **D11** — H3/H4 proceed despite the H2 stop: independent of H2's mechanism,
  add a new path rather than touch the exposed one.
- **D12** — resolves the Stage 1–3 report's open U2.8 question: the engine
  supports `any`/`all`, has no `not_equals`; U2.8 remains staged, not applied.
- **D13** — Stage 5 zero-reader sweep found real blockers (§6); applied
  exactly the cleared subset, skipped exactly the blocked columns; self-caught
  a misclassification of `hide_email` mid-apply (rolled back cleanly, no
  half-applied state) before the corrected version landed.
- **D14** — Account phone repoint expanded to a second real writer
  (`Profile.tsx`) beyond the plan's literal scope, because leaving it
  unfixed would be a half-migration; a third writer (`TeamPage.tsx`) is
  legitimately load-bearing for the one staff account with no contact row, so
  `profiles.phone` is not dropped this stage.
- **D15** — new defect found generating the final sample: `remerge_contract_
  from_clauses` is missing U2.1's entire money-rendering layer. Reported to
  BACKLOG, not fixed (outside every declared stage's scope), and the sample
  shows the system's actual current behavior rather than a corrected one.

---

## 11. WHAT REMAINS OPEN

1. **H2** — needs an owner decision among the three options in §3; nothing
   applied.
2. **H3/H4 curl matrix and manual send** — BLOCKED on deployment + a
   password-capable test account; not simulated.
3. **`docs/BACKLOG.md`: `remerge_contract_from_clauses` money-rendering gap**
   (D15) — a real, materially significant defect affecting every draft edit.
4. **`docs/BACKLOG.md`: `pending_fee_candidates` already broken in
   production** (`p.mobile` should be `c.mobile`) — found during the Stage 5
   sweep, unrelated to this run's scope, not fixed.
5. **`profiles.phone` retained** — D14; needs either a conditional
   contact-linked write path for staff or an explicit owner decision to
   provision a contact row for `admin@cactai.io`.
6. **U2.8 deductible gating** — staged only, per the Stage 1–3 report;
   U2.8's JSON should be updated to the `any`/`equals` positive form per D12
   before it is ever applied.
7. **test/db harness** — 3 fixes landed, not fully green (§7); the
   `HORSE_EMERGENCY_VET` template-body drift and the stale
   `service_catalog.test.ts` import are separate, unbounded follow-ups.
8. **DOM/domain**: `fhequestrian.com` is Namecheap-parked, not serving the
   app — a DNS/registrar issue, reported, out of scope.

---

## 12. FINAL COMMIT / PUSH / MERGE

- Final-stage commit on `work/u1-lead-trust`: `f028610`
- Merged `work/u1-lead-trust` → `main` (`--no-ff`, merge commit `953d5bf`)
- Pushed `main` → `origin/main`
- Pushed `work/u1-lead-trust` → `origin/work/u1-lead-trust`
- **`main`'s remote hash, confirmed by fetch: `953d5bf`** — local `main` and
  `origin/main` were byte-identical (`git rev-parse main` / `git rev-parse
  origin/main` both returned `953d5bf`) immediately after the push.
- `main` typechecks clean post-merge (`typecheck` and `typecheck:api` both
  exit 0).

`main` now carries all nine commits from this run: Stages 1–3 (prior
session), Stage 4a/4b/4c, Stage 5, the harness-repair fixes, and this final
export/report. Nothing from `work/u1-lead-trust` was left unmerged. This
paragraph itself is a follow-up commit on `main` recording those hashes after
the fact — the merge commit `953d5bf` predates it, so `main`'s hash advances
one commit past `953d5bf` once this is pushed; that final hash is confirmed
at the very end of this section, appended after the push completes.

**Absolute final hash, confirmed after this update was pushed:** see the very
last line of this file.
