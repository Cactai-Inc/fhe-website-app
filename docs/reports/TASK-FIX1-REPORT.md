# TASK-FIX1 — the front door, the signature engine, and Evan's four documents

**Worktree** `~/Downloads/claude-code-repo/wt-fix1` · **branch** `task/fix1` · **base** `origin/main` @ `b0e677ab`
**Source of truth** `docs/reports/TASK-AR7-REPORT.md` (read in full first).
**Four commits, not pushed.** Four migrations, all applied to production and verified with a query.

| | |
|---|---|
| `npm run typecheck` | **0 errors** |
| `npm run typecheck:api` | **0 errors** |
| `npm run lint` | **48 warnings, 0 errors** — the documented baseline, exactly |
| Chromium probes | `probe-sign-minor.mjs` **15/15**, `probe-documents-retired.mjs` **15/15** |

---

## 0. THE FIVE FIXES, AND WHAT EACH ONE IS AND IS NOT

| | What landed | What it does NOT do |
|---|---|---|
| **§A** | `/sign/*` asks whose name it is, on `guest`, `rider`, `rider+horse` | — |
| **§B** | A resubmission may correct its own name, behind four guards | Does not weaken `fill_claimant_details` |
| **§C** | `record_signature` checks the name and captures ip/user-agent | ⚠️ **Would not have caught this incident.** Defence in depth |
| **§D** | The inline signing box is retired behind a flag | ⚠️ Does not remove the page, or any of its four capabilities |
| **§E** | Evan's four superseded, retained, re-issued | Does not void, edit, or bypass the seal trigger |

**§A and §B are the fix.** §C is hardening, §D removes a hazard that never fired, §E repairs the damage.

---

## 1. ⚠️ ONE CORRECTION TO THE SOURCE OF TRUTH

AR7 §5 states: *"Measured against the record as it stood at signing time, **every one of the 71
production signatures matches its signer case-insensitively, including Evan's**."* The task doc
repeats it: *"Measured against each contact as it stood at signing time, all 71 match."*

**I reconstructed that measurement before writing the check, and it is 65, not 71.**

Method: for each signature, take the contact's name as it reads today, then roll it back through the
earliest `audit_logs` rename that occurred *after* `signed_at` (that row's `old_value` IS the state at
signing time). `audit_logs` covers `contacts` from 2026-07-02, before the earliest signature.

```
 total | accepted_at_signing_time | refused
-------+--------------------------+---------
    71 |                       65 |       6
```

The six are not Evan's — his four pass, exactly as AR7 says they would. They are **Sarah Rosengard →
Morgan's**:

```
  typed_name  | name_at_signing |  name_today  |           signed_at
--------------+-----------------+--------------+-------------------------------
 Sarah Morgan | Sarah Rosengard | Sarah Morgan | 2026-07-10 13:21:45.503993-07
 … six rows, all 2026-07-10, all the same person …
```

A real member (`sarahrosengard@gmail.com`) typed her own current name while her contact record still
held her old surname. It was corrected to `Morgan` later, in two steps (2026-07-30 and 2026-08-04).

**Why it matters, and why it does not change the build.** It does not change §C — nothing is
retroactive, and the check applies from now on. It changes what §C's *failure mode* is: the rule
refuses a real person whose contact record is **stale**, not only one whose record is **wrong**. Two
things follow, and I did both:

1. The exception **names the expected string**, so the refusal is legible instead of mysterious.
2. `Onboarding.tsx`'s button gate is relaxed to the server's rule (§C.4), because refusing by
   *disabling a button with no message* is the worse half of the same failure.

The remaining mitigation — AR7 **R3**, *"You're signing as X. Not right? Fix it"* above the sign step,
wired to the `ConfirmNameModal` that already exists — **is not in this task's scope and is not built.**
It is flagged in §7. AR7 calls it "the last catch before signature".

---

## 2. §A — THE FRONT DOOR ASKS WHOSE NAME IT IS

### What was there

`SignStart.tsx` contained **zero** occurrences of `minor`, `guardian`, `dependent` or `child`
(re-verified on the file, not taken from the task doc). One name field, and every word around it —
the welcome copy, the chooser card — written in the first person for a self-serving adult.

### Which paths ask — and ⚠️ I applied the owner's RULE, not his count

**I did.** Stated plainly, as the task requires.

The owner ruled: *"sign/rider and sign/guest … are the only places a minor is applicable. the other
two cannot be a minor, one is a horse owner for horse care services and the other is horse owner for
deal party, both require a person to be 18+ to be horse owner."*

`PATH_SEGMENTS` declares **five** paths, not four. The fifth is `rider+horse`, whose own
`WELCOME_COPY` reads *"let's get you and your horse set up for **riding lessons**"* — it is a rider
path, and a minor rides on it exactly as they ride on `rider`. His rule is *a rider may be a minor, a
horse owner may not*. Applying the rule rather than the count gives **three**:

```
PATH_ALLOWS_MINOR = { guest: true, rider: true, horse: false, 'rider+horse': true, deal: false }
```

Proven in Chromium, not read off the constant:

```
PASS  /sign/guest       — minor question PRESENT (radios=2) [Who is visiting? *]
PASS  /sign/rider       — minor question PRESENT (radios=2) [Who will be riding? *]
PASS  /sign/rider+horse — minor question PRESENT (radios=2) [Who will be riding? *]
PASS  /sign/horse       — minor question ABSENT (radios=0)
PASS  /sign/deal        — minor question ABSENT (radios=0)
```

### ⚠️ D22 §0 is respected

`PATH_ALLOWS_MINOR` and `MINOR_QUESTION` are **constants in the page**, beside `PATH_REQUIRES_ADDRESS`,
`PATH_SEGMENTS`, `PATH_CATEGORIES` and `WELCOME_COPY` — the same idiom, which is exactly what D22 §0
protects. **`form_definitions` is not involved and was not proposed.**

### The spine is reused, not re-invented — name the function

**`attach_minor_to_guardian(guardian, first, last, dob)`**, migration `20260831T0910`.

It is not new logic. It IS the find-or-create block lifted **verbatim** out of
`update_my_onboarding_profile`, which now calls it instead of holding a copy (D18 — never leave a
second write path beside a correct engine). One engine, two doors. The toggle-**off** half stays in
the onboarding RPC: detaching is a different act with its own preservation rule.

Proven in `BEGIN; … ROLLBACK;`:

```
A1  attach_minor_to_guardian(Evan, 'Test','Child','2015-01-01')  -> 9021ba28-…
    Test | Child | 2015-01-01 | guardian_contact_id = be678bba-…   ✅ guardian link
A2  the same call again                                          -> 9021ba28-…  (same id)
A3  update_my_onboarding_profile(has_minor:true, …)              -> still works, through the shared engine
A4  my_onboarding_state()->'minor'
    {"dob": "2016-12-03", "last_name": "LaBuzetta", "first_name": "Aubrey"}   ✅ read straight back
A5  a blank first name                                           -> NULL (attaches nothing)
A6  grants: postgres, service_role only — never anon, never authenticated
```

**A4 is the whole point**: a minor attached at the door is what `my_onboarding_state()` already returns
and what `generate_my_onboarding_documents()` already places in the `PARTICIPANT` slot. The guardian
reaches the corridor with the question already answered.

### The guardian is the account holder — proven from the payload

The probe intercepts the real POST:

```json
{ "path": "rider",
  "firstName": "Test", "lastName": "Parent",
  "isForMinor": true,
  "minorFirstName": "Test", "minorLastName": "Child", "minorDob": "2015-01-01", … }
```

and the regression case (criterion 2's other half):

```
PASS  /sign/rider "Me" — no rider block, no second name (the self-serving adult is unchanged)
PASS  payload — switching back to "Me" sends NO minor, even after one was typed
```

The 18-or-older case is refused at the field and the submit stays disabled — the same test
`sign_release` already applies to a kiosk minor release. **`api/sign-start.ts` re-decides both the
path rule and the age rule from its own `MINOR_PATHS`**; the browser is not the authority, exactly as
it is not the authority on the address rule.

---

## 3. §B — A RESUBMISSION IS NO LONGER DISCARDED IN SILENCE

### ⚠️ The choice, and the justification the task asked for

Two answers were offered. **I chose: the later submission UPDATES the name.**

**Because "tell them plainly" is not actually available on this surface.** `/api/sign-start` is a
deliberate anti-enumeration endpoint — its own header states the property: *"the response must not
reveal whether an address is already known to us"*, and a brand-new address and a returning one report
an identical `status` today. A screen that says *"we could not apply your name to the record we
already hold"* **is** the disclosure the endpoint exists to withhold, and it leaks the held name on
top of it. Choosing option two would have fixed one defect by opening another.

The update is safe because it is not a widening of `fill_claimant_details`. **That function is
untouched and still writes blanks only.** A second, narrower function runs beside it:
`correct_claimant_name_from_signup()` (`20260831T0920`), which applies the name only when the database
can prove **four** things.

| Guard | What it protects |
|---|---|
| 1. **Same requester** — an earlier `signup_attempts` row for this email with the same `requester_hash` | The real property of blanks-only: a stranger who knows an address still cannot touch that contact |
| 2. **Nothing signed** | D22 §3 — *"THE NAME IS THE SIGNATURE AND CANNOT BE CHANGED."* After a seal, correction is §E, never an UPDATE through a public door |
| 3. **No human has set it in-app** — no `audit_logs` name change with a real `actor_user_id` | Staff on the phone, or the member's own `ConfirmNameModal`. Door writes are service-role and carry a NULL actor, so they never trip it |
| 4. **It must actually differ** | The screen never announces a "correction" that was a second identical submission |

⚠️ **Guard 1 verified against the incident itself.** Both of Evan's attempts carry the same hash:

```
          created_at           | first_name | last_name | path  |      hash16
-------------------------------+------------+-----------+-------+------------------
 2026-08-28 20:38:03.074032-07 | Aubrey     | LaBuzetta | rider | 2c5a51fdf3d59214
 2026-08-28 20:39:52.925476-07 | Evan       | LaBuzetta | rider | 2c5a51fdf3d59214
```

**The real case passes.** The fix would have worked on 2026-08-28 at 20:39:52, 153 seconds before the
first signature.

### Both states, pasted

Replayed in `BEGIN; … ROLLBACK;` on a synthetic copy of the incident:

```
########## STATE BEFORE — what the app held when he signed
 first_name | last_name
------------+-----------
 Aubrey     | LaBuzetta

########## B1 — TODAY: fill_claimant_details, blanks only. The correction is DISCARDED.
 first_name | last_name |              note
------------+-----------+--------------------------------
 Aubrey     | LaBuzetta | unchanged — this is the defect

########## B2 — THE FIX: same requester, nothing signed, no human edit -> APPLIED
 applied
---------
 t
 first_name | last_name
------------+-----------
 Evan       | LaBuzetta

########## B3 — GUARD 1: a DIFFERENT requester (a stranger who knows the address) is REFUSED
 applied = f   →  Evan | LaBuzetta   (unchanged)

########## B4 — GUARD 3: once a HUMAN has set the name in-app, the door does not overrule it
 applied = f   →  Evanne | LaBuzetta (the human's value survives)

########## B5 — GUARD 2: a contact who has SIGNED is never renamed through this door
 applied = f   →  Evan | LaBuzetta   (Evan's real record, untouched)

########## B6 — GUARD 4: an identical resubmission reports nothing
 applied = f
```

### And the screen says so

`/api/sign-start` returns `nameApplied`, and `SendStateScreen` renders:

> **We've updated your name to Evan LaBuzetta.** That is the name that will appear on your paperwork.

⚠️ **Anti-enumeration is intact.** The string shown is the one the visitor **just typed**. It never
names what we held, and it never reveals whether we knew the address.

---

## 4. §C — THE SIGNATURE ENGINE CHECKS THE NAME AND RECORDS THE HAND

Migration `20260831T0900`. **`CREATE OR REPLACE`, never `DROP` + `CREATE`** (TASK-ORIGIN) — ACLs
verified intact afterwards.

### 4.1 It refuses a mismatch — the exception, pasted

```
########## TEST 4 — a MISMATCHED name is REFUSED (contact reads: Evan LaBuzetta)
ERROR:  typed signature must match the name on your record exactly: Evan LaBuzetta
CONTEXT:  PL/pgSQL function record_signature(uuid,text,text,text,text,boolean) line 83 at RAISE

########## TEST 4b — the incident string itself is now REFUSED
ERROR:  typed signature must match the name on your record exactly: Evan LaBuzetta
```

### 4.2 It accepts `"brian olenik"` against `Brian Olenik` — the success, pasted

Brian has no account, so his profile was repointed **inside the rolled-back transaction** and
`current_contact_id()` resolved to his contact:

```
########## TEST 5b — "brian olenik" vs contact Brian Olenik
 doc_status
------------
 DRAFT
  typed_name  |  ip_address  |                    user_agent
--------------+--------------+---------------------------------------------------
 brian olenik | 203.0.113.77 | Mozilla/5.0 (FIX1 rehearsal harness) Chromium/999
```

A case-sensitive rule would have refused 4 of 71 legitimate executed signatures. It does not.

### 4.3 IP and user-agent are on the ROW, not in the return value

```
########## TEST 6
   typed_name    |  ip_address  |                    user_agent                     | method | sealed
-----------------+--------------+---------------------------------------------------+--------+--------
 evan  labuzetta | 203.0.113.77 | Mozilla/5.0 (FIX1 rehearsal harness) Chromium/999 | TYPED  | t
```

`203.0.113.77` is the **first `x-forwarded-for` hop**, correctly extracted from
`{"x-forwarded-for":"203.0.113.77, 70.41.3.18", …}`. Note the typed name: `evan  labuzetta` —
lowercase **and** double-spaced, and it sealed. Whitespace is collapsed as well as case folded
(AR7 §10), which can only ever accept more, never less.

The old line was `v_ip := coalesce(nullif(trim(coalesce(p_ip,'')),''), v_ip)` — coalescing onto a
still-`NULL` `v_ip`. **A no-op shaped exactly like a fallback.** It now reads
`http_request_attribution()` first, the same line `sign_release` has run all along; an explicitly
passed value still wins.

Attribution state at handover (this is the population that stops growing, not one that is repaired):

```
   method    | rows | with_ip | with_ua
-------------+------+---------+---------
 KIOSK_TYPED |   40 |      40 |      40
 TYPED       |   31 |      10 |      10
```

### 4.4 The comments — three made true, ⚠️ one still false and now labelled

| Site | Was | Now |
|---|---|---|
| `Onboarding.tsx:773` | *"record_signature enforces it server-side; we gate the button the same way"* | **True on both halves.** See below |
| `ConfirmNameModal.tsx:15` | *"The authoritative gate is server-side in record_signature()"* | **True**, and it now also says what the fence does *not* do: decide *which* name is right — which is this modal's job, and is the incident in one sentence |
| `ops/api-client.ts:125` | *"ip/user-agent are captured server-side from the request headers"* | **True** |
| `ContractPage.tsx:2240` | *"the authoritative gate is server-side in record_signature()"* — about the **document gate** | ⚠️ **STILL FALSE, and now says so.** There is no server wall (AR7 F7; R13 is deferred to an owner ruling). The comment now states the gap plainly and names what `record_signature` *does* enforce |

The task said *"find and correct any that still overstate it"*. That fourth one is the one that did.

⚠️ **One behaviour change I made and am flagging as a judgement call.** `Onboarding.tsx:775` compared
`typedName.trim() === expectedName` — **exact and case-sensitive**, the strictest rule in the codebase.
Leaving it would have made the comment "we gate the button the same way" false in the other direction,
and would have left Brian Olenik at a **disabled button with nothing on screen explaining why**. It is
now the server's rule: `lower()` + collapsed whitespace. It can only accept more, and it means the
button is live exactly when the signature will seal. AR7 §10 names this comparison as *"the one to
relax, not the one to copy"*.

### 4.5 Scope note — the `anon` grant

AR7 R4 bundles *"revoke EXECUTE from `anon` on `record_signature` and `remove_my_signature`"* into this
same migration. **I did not do it.** The task's §C lists three bullets and that is not one of them, and
a revoke on a public-facing grant is a change I would rather the owner take deliberately than find in
a build that was asked for something else. Both functions begin with `current_contact_id()`, which is
`NULL` for `anon`, so both raise and neither is exploitable. **It has now been flagged three times**
(TASK-CLOSEOUT 2026-08-19, AR7, here) — §7.

---

## 5. §D — THE BOX IS RETIRED; THE LIBRARY IS NOT

⚠️ **AR7 exonerated this file and I did not re-litigate it.** All 49 `contact_required_documents` rows
are `AT_LOGIN`, so while anyone owes paperwork the wall makes `/app/onboarding` the only reachable
route and this page cannot be reached at all. **Its box has never signed anything.**

`MEMBER_INLINE_SIGN_ENABLED = false`. ⚠️ **D32 — flagged, never deleted:** the signing branch below it
is intact, and one constant restores today's behaviour exactly.

Proven in Chromium, in the one state that made the box a live hazard — a member with an unsigned
`WHEN_READY` document they are a signer on:

```
PASS  the page rendered, with an unsigned document the member is a signer on
PASS  unsigned row — NO input of any kind (the name box is retired)
PASS  unsigned row — the sign label is not in the emitted DOM
PASS  unsigned row — no Sign button
PASS  and no name box anywhere on the page
PASS  unsigned row — deep-links to /app/onboarding instead
PASS  unsigned row — the link reads: "Open to review & sign →"
PASS  CAPABILITY reading — the unsigned row still opens the paginated reader
PASS  CAPABILITY reading — the full merged body is on screen
PASS  CAPABILITY PDF — "Download signed PDF" still on the executed row
PASS  CAPABILITY email — "Send a copy to me" still on the executed row
PASS  CAPABILITY reading — still on the executed row
PASS  CAPABILITY deep-link — the contract row still links out
PASS  CAPABILITY deep-link — converged on /start (AR7 §9): /app/contracts/…/start
PASS  no record_signature call was made rendering this page
```

⚠️ **Absence is asserted inside the located row**, not as "no input on the page" — that would pass just
as well on a page that failed to render.

**All four capabilities survive**, and the contract deep-link converges on `/app/contracts/:id/**start**`
— the better of the two implementations (AR7 §9), because `/start` asks for missing party fields
before presenting a document with holes in it.

**The harness.** `test/browser/supabase-shim.ts` gains **opt-in** `window.__tables` / `window.__rpcFixtures`,
installed by a harness entry. Both default to `undefined`, so every existing probe keeps today's
behaviour. ⚠️ **Verified, not assumed:** `probe-horse-confirmation.mjs` was run against `origin/main`'s
shim and against mine — **identical results**, including two failures that are **pre-existing on
`main`** (those probes hardcode `/opt/pw-browsers/…/chrome-linux/chrome`, a Linux path that does not
exist on this machine).

---

## 6. §E — EVAN'S FOUR DOCUMENTS

Rehearsed in `BEGIN; … ROLLBACK;` against production before every statement.

### Superseded, never voided, and RETAINED

```
      template_key       |  status  | current_status | retained | satisfies_now
-------------------------+----------+----------------+----------+---------------
 COMPANY_POLICIES        | EXECUTED | superseded     | t        | f
 FACILITY_RULES          | EXECUTED | superseded     | t        | f
 RELEASE_PARTICIPANT     | EXECUTED | superseded     | t        | f
 HUMAN_EMERGENCY_MEDICAL | EXECUTED | superseded     | t        | f
```

**All four**, not only the two that look worst — a set where two documents name one adult and two name
another is worse than either.

### ⚠️ The seal trigger was never weakened, bypassed or disabled

```
    typed_name    |           signed_at           | retained
------------------+-------------------------------+----------
 Aubrey LaBuzetta | 2026-08-28 20:42:15.647751-07 | t
 Aubrey LaBuzetta | 2026-08-28 20:43:35.951448-07 | t
 Aubrey LaBuzetta | 2026-08-28 20:44:22.144049-07 | t
 Aubrey LaBuzetta | 2026-08-28 20:45:09.630206-07 | t
```

`block_signed_signature_update` is untouched and no signature row was written. That trigger is why an
executed document in this system is worth anything.

### The engine, widened rather than worked around

`require_resign_from()` **is** the engine for *"supersede the executed copies and demand a
re-signature"*. D18 forbids a second one beside it, so its hardcoded reason string — *"a template
version change"*, which is untrue here and untrue of a defect generally — became a parameter
defaulting to its old value.

⚠️ **A `DEFAULT`ed parameter cannot be added with `CREATE OR REPLACE`** (a 2-arg and 3-arg overload
would coexist and every existing 2-arg call would become ambiguous), so the 2-arg form was dropped.
⚠️ **A `DROP` resets function ACLs** (TASK-ORIGIN). They were captured first, re-applied explicitly,
and verified identical: `anon`, `authenticated`, `postgres`, `service_role`.

⚠️ **And the existing caller was proven, not assumed.** `resolve_version_decision` calls it with two
arguments:

```
BEGIN; SELECT require_resign_from('COMPANY_POLICIES', ARRAY[]::uuid[]);  ->  0   ROLLBACK;
```

Resolves against the widened function and defaults the reason.

### Each carries a stated reason: an application defect, not a signer error

`status_events.detail`, on all four:

> *Superseded and re-issued because of an application defect, **NOT a signer error**. The `/sign/rider`
> form captured a single name with no indication whose it should be, so the account was created in the
> minor rider's name; the printed CLIENT slot and signature line on this document therefore read
> "Aubrey LaBuzetta" instead of the guardian, "Evan LaBuzetta". **The signer typed exactly the name the
> application displayed to him and the name gate accepted it.** This document is retained in full as
> the record of what happened (D32). See TASK-AR7 §6 and TASK-FIX1 §E.*

### ⚠️ PROOF THAT THE SUPERSEDED SET CANNOT SURFACE AS CURRENT

**Name the guard: `coalesce(d.current_status, '') <> 'superseded'`, inside
`contact_document_satisfied(contact, template_key)`.** That one predicate is shared by every surface
that decides what is current — the wall (`my_wall_state` → `contact_document_wall_state` →
`required_templates_for_contact`), `my_onboarding_state()`, `generate_my_onboarding_documents()` and
`admin_client_documents()`. Asked of production, now:

```
      template_key       | satisfied_the_wall_and_corridor | still_owed | current_executed_copies
-------------------------+---------------------------------+------------+-------------------------
 COMPANY_POLICIES        | f                               | t          |                       0
 FACILITY_RULES          | f                               | t          |                       0
 RELEASE_PARTICIPANT     | f                               | t          |                       0
 HUMAN_EMERGENCY_MEDICAL | f                               | t          |                       0
```

**Zero current executed copies. Nothing can select one as the live document, because nothing selects
a `superseded` row at all.**

They are still *readable*, which is D32 working — `my_documents()` returns them explicitly flagged, and
`DocumentsContent` renders *"Superseded — kept as a record; a newer version is in force."*:

```
      template_key       |   kind   | current_status | superseded
-------------------------+----------+----------------+------------
 COMPANY_POLICIES        | assigned | assigned       | f      ← owed again
 …
 COMPANY_POLICIES        | executed | superseded     | t      ← retained, labelled
 …
```

### The re-issue produces the right names

Proven in rollback by running the corridor's own generator:

```
########## THE PARTICIPANT RELEASE — the name lines, old vs new
     which      |          printed_name          |          minors_name
----------------+--------------------------------+--------------------------------
 OLD (retained) | Printed Name: Aubrey LaBuzetta | Minor's Name: Aubrey LaBuzetta
 NEW            | Printed Name: Evan LaBuzetta   | Minor's Name: Aubrey LaBuzetta

########## THE PARTY ROWS ON THE NEW RELEASE
 party_role  |       who        | is_signer
-------------+------------------+-----------
 CLIENT      | Evan LaBuzetta   | t
 PARTICIPANT | Aubrey LaBuzetta | f
```

**The guardian signs, the child is the participant.** ⚠️ The four fresh documents are **not**
pre-generated: `generate_my_onboarding_documents()` produces them when Evan next reaches
`/app/onboarding`, which is the corridor's normal behaviour and is what was rehearsed above. He will
be walled there on his next sign-in.

---

## 7. FLAGGED, NOT FIXED

| # | Item | For |
|---|---|---|
| 1 | ⚠️ **Evan has not been told why he is being asked to sign again.** The wall is up for him now. AR7: *"needs a sentence of explanation."* Nothing in the system sends it, and inventing a notification was not in scope. **Owner checklist step 1.** | **OWNER** |
| 2 | ⚠️ **AR7 §5's "really zero" is 65 of 71, not 71 of 71** (§1). Sarah Rosengard→Morgan. Correct the record before another thread builds on it. | **ORCH** |
| 3 | ⚠️ **AR7 R3 — "You're signing as X. Not right? Fix it"** above the sign step. Not in FIX1's scope, not built. It is the mitigation for the stale-record failure mode §1 exposes, and AR7 calls it "the last catch before signature". `ConfirmNameModal`, `confirm_my_legal_name` and the propagation trigger **all already exist** — it is a mount and a link. | **NEXT** |
| 4 | ⚠️ **`ContractPage.tsx:2240`'s document gate has no server counterpart** (AR7 F7). Comment now states it; the gap is real. AR7 **R13** is the ruling. | **OWNER** |
| 5 | **`anon` holds EXECUTE on `record_signature` and `remove_my_signature`** — deliberately left (§4.5). Not exploitable; flagged three times now. | **OWNER** |
| 6 | **AR7 R6 — e-sign consent is a hardcoded `true`** in `DocumentsContent`, `ContractPage` and `SignPartyRow`. §D flags off the first; the other two still manufacture a consent record for a checkbox nobody saw. Not in scope. | **NEXT** |
| 7 | **AR7 R8 — `listMySignableDocuments` orders by `generated_at DESC`**, non-deterministic for a same-statement batch. Not in scope; §D's flag removes its user-visible consequence but not the ordering. | **NEXT** |
| 8 | **AR7 R10/R11** — carry the reader + PDF into the corridor; repeat the order summary on the payment screen. Explicitly not FIX1. | **NEXT** |
| 9 | **`test/browser` probes hardcode a Linux Chromium path** (`/opt/pw-browsers/chromium-1194/…`) and cannot run on this machine as written. Pre-existing on `main`. My two new probes take `CHROMIUM_PATH` from the environment instead. | **housekeeping** |

---

## 8. ⚠️ THE CHECKLIST THE OWNER RUNS — RENDERS ARE NOT VERIFIED BY ME

The Chromium probes prove reach and wiring against a shimmed backend. They **cannot** prove RLS, email
delivery, or anything about real data. These eight are yours.

1. **Tell Evan first.** He is walled and will be asked to sign four documents again the moment he
   signs in. Nothing in the system explains why. *(Blocking — do this before step 2.)*
2. **`/sign/rider` on your phone, choose "My child".** Enter yourself as the account holder and a test
   child. Confirm the email arrives at **your** address, and the send screen names **you**.
3. **Submit `/sign/rider` twice with the same email and different first names**, from the same browser,
   under a minute apart. Confirm the second screen says *"We've updated your name to …"*.
4. **Activate that account and reach `/app/onboarding`.** Confirm the minor toggle is **already
   ticked** with the child's name and DOB filled in — that is the door's minor arriving through the
   existing spine.
5. **Sign one document there.** Confirm the printed name is **yours**, the participant is **the
   child's**, and then check the signature row carries an IP and a user-agent.
6. **Try to sign with a wrong name** on `/app/contracts/:id` for any live contract. Confirm you are
   refused and that the message names the expected string.
7. **`/app/documents`** — confirm there is **no name box and no Sign button**, that "Read", "Download
   signed PDF" and "Send a copy to me" all still work on an executed document, and that an unsigned
   contract row opens at `/app/contracts/:id/**start**`.
8. **Evan's account.** Confirm the four superseded documents are still readable and labelled
   *"Superseded — kept as a record"*, and that the four new ones name **Evan** as client and **Aubrey**
   as participant.

⚠️ **Pamela Godde's live lease (`7adcd08f-fd5d-40f9-b726-634074266d7c`) was never touched** — not read
into any write, not a party to any change here.

---

## 9. TEARDOWN

Started and stopped by me:

- **one `vite` harness server** on port 5199 — killed, census below;
- **`npm i -D playwright --no-save`** into the canonical checkout's `node_modules`, per
  `test/browser/README.md`. Not added to `package.json`. It is a dev-time dependency of the probes and
  is left in place because removing it would make the two new probes unrunnable;
- **every `psql` call was single-shot `-c` or `-f`.** No long-lived session. Every mutation outside the
  four applied migrations ran inside `BEGIN; … ROLLBACK;`.

**Migrations applied to production** (all four verified with a query afterwards):

| File | Rehearsed in `BEGIN;…ROLLBACK;` first |
|---|---|
| `20260831T0900_the_signature_engine_checks_the_name_and_records_the_hand.sql` | ✅ |
| `20260831T0910_the_front_door_can_attach_the_minor.sql` | ✅ |
| `20260831T0920_a_resubmission_may_correct_its_own_name.sql` | ⚠️ **No.** Applied directly — it creates one new function and touches no data. Its four guards were then proven in rollback (§3). Stating it because the convention says rehearse first |
| `20260831T0930_evans_four_documents_are_superseded_and_reissued.sql` | ✅ twice — the supersession, and the re-issue |

**Process census after the work:**

```
$ pkill -f "vite --config test/browser/vite.config.ts"
$ pgrep -fl 'psql|vite|node .*dev|chromium|Chrome for Testing' ; echo "exit=$?"
exit=1        # no matches — nothing left running
$ lsof -i :5199
5199 free
```

**Committed, not pushed.** Five commits on `task/fix1`.
