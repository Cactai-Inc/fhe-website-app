# TASK-CONTRACTWALK — walking a lease from invitation to executed

**Run:** 2026-08-17 · Opus 5 · thinking ON · effort HIGH
**Database:** `db.lrstswfxfsezdmvkvukc.supabase.co` (production)
**Method:** one `BEGIN … ROLLBACK` transaction, two impersonated users, synthetic people and a
synthetic horse. **Nothing was committed. No email was sent. Nothing was fixed.**
**Script:** `docs/reports/TASK-CONTRACTWALK-walk.sql` · **Full output:** `docs/reports/TASK-CONTRACTWALK-output.txt`

---

# PART 1 — THE WALK, IN PLAIN LANGUAGE

This is what a Deal client actually experiences, screen by screen, as the code dictates today.

### 1. Admin creates them

Admin opens **New client** (or converts an inbound submission), types the email and name, and
ticks **Deal client**. The page immediately shows a "First-login paperwork" list containing
exactly one item: **General Visitor Liability Release**. Admin clicks *Create & send invitation*.

An invitation email goes out with a link to `https://…/activate?token=<64 hex chars>`. The link is
good for **7 days**. Any earlier link for that person stops working the instant this one is minted.

> ⚠️ **What actually got assigned is not what the screen showed.** The screen said one document.
> The database assigned **three** — Company Policies, Facility Rules, *and* the General Release.
> This is finding **B1** and it changes everything downstream: the client signs three documents
> instead of one, and the lease cannot be locked until all three are signed.

### 2. They click the link

They land on **Create Your Account**. The page tells them the email it was issued to. If the
address is a Gmail one they see *Continue with Google* only; if it is a known non-Google mailbox
they see a password form only; an unfamiliar domain gets both. This is deliberate — it stops
someone authenticating with a different Google identity than the one invited.

They set a password (or sign in with Google), and the account is created and linked in one step:
a `profiles` row, a `members` row (community access, per D8), the invitation flips to
`redeemed`, and the originating website enquiry — if there was one — flips to `converted`.

**If the link is dead**, they get a good screen, not an error: *"This link isn't valid anymore"*,
and if a newer invitation exists it names the masked address and date it went to, plus a
**Send it to me again** button. That is genuinely well handled.

### 3. The first screen after activation

Because paperwork is outstanding, they are routed straight to **`/app/onboarding`**, not the
dashboard. They see:

- a **profile form** — completion is gated on exactly four fields: **phone**, **date of birth**,
  **emergency contact 1 name**, **emergency contact 1 phone**. Address, second emergency contact
  and riding history are on the form but do **not** gate anything.
- a **document list** — three items, all `MISSING`. A **signing wall** is up
  (`my_wall_state → {"wall": true, "pending": 3}`), so service features are locked until they sign.
  Community is open.
- **No horse step.** `horse_needed = false` for a deal client, correctly.

If they supply none of the four profile fields, `profile_complete` stays `false` and the wall
stays up at 3 pending. Nothing tells them *which* of the four is missing — the predicate is
all-or-nothing.

They sign the three documents. The wall drops to `{"wall": false, "pending": 0}`. Admin gets a
notification for each one, to **both** `admin@` and `hello@`.

### 4. Admin builds the lease

Admin opens **New contract**, picks the lessee, the lessor and the horse. A
`Horse Lease Agreement — Standard` document is created with **121 fields, 31 of them required**,
in `workflow_state = editable`, `status = AWAITING_SIGNATURE`. Both parties are attached as
signers (LESSEE order 1, LESSOR order 2). The horse's name is pre-filled from its record; both
parties' identity fields are pre-filled from their contacts.

Admin fills the deal terms. The page shows a live blocker list. Two things must clear that admin
may not expect:

- **The horse section must be confirmed.** A gold button sits in the Horse section header:
  *"I reviewed the horse info — it's accurate"*. Only the **Lessor or staff** see it; everyone else
  sees *"Awaiting confirmation by the horse's owner"*. **This is reachable and clearly labelled** —
  the task brief's suspicion that gate 6 is a hidden RPC is wrong.
- **The other party's onboarding paperwork must already be executed.** Until it is, locking fails
  with `cannot lock: Onboarding documents must be completed first by: Walker Dealclient`. The
  message names the person, which is good, but it does not say *which* documents or link to them.

### 5. Admin locks it

Admin clicks **Lock**. `advance_document_workflow(…, 'locked')` runs the blocker check, seeds a
pending signature row for each signer, recomposes the document body, and — because this is a lease
with a horse — **silently creates two more documents**: `HORSE_EMERGENCY_VET` and
`RELEASE_HORSE_CARE`, both `AWAITING_SIGNATURE`, attached to the same deal. Nobody is notified
about those two (finding **B5**).

**Both parties** get a bell notification: *"Horse Lease Agreement — Standard is ready to sign"*,
linking to `/app/contracts/<id>`. Staff get nothing — they did the locking, so they know.

### 6. The lessee signs

The signature block only appears once the document is locked. They type their name, tick the
e-signature consent, and sign. The signature row seals with their account id; the document stays
`AWAITING_SIGNATURE` / `locked`.

Admin gets: *"Horse Lease Agreement — Standard — signed by Walker Dealclient (LESSEE)"*, linking
to `/app/ops/documents/<id>`. Both staff addresses get a copy.

### 7. The lessor signs — and it executes

The moment the second signature lands:

- `status = EXECUTED`, `workflow_state = executed`, `effective_date = today`
- an `execution_hash` is computed and stored
- the template version is **frozen** at 3 on the document
- the "ready to sign" alerts for **both** parties are **deleted** from their bells
- the **lessee** — the party who did *not* just act — gets *"Horse Lease Agreement — Standard is
  signed"*. **The lessor is not told about their own click.** Correct.
- admin gets *"— fully executed; signed by Olive Lessor (LESSOR)"*

### 8. The horse moves

Automatically, in the same instant:

- `horses.lessee_contact_id` = the lessee
- `horses.lease_start` = the lease start date
- `horses.current_owner_contact_id` = unchanged (already the lessor)
- a `horse_relationships` row `LESSEE` is inserted, carrying the term
- **the horse now appears in the lessee's stable** (`my_stable_horses`, `is_owner = false`), and
  still in the lessor's (`is_owner = true`)

> ⚠️ `lease_end` came through **NULL**. `TXN.LEASE_END` is **not a required field**, so a lease can
> execute with a start date and no end date, and `my_stable_horses` treats a NULL term as
> permanent. Finding **B3**.

The lessee's document list now shows 4 documents. Their affiliation group is still `GUEST` —
leasing a horse grants no new group, which is correct (they are not the owner) but means a deal
client who now has a horse still reads as a guest everywhere.

---

# PART 2 — FINDINGS, RANKED BY WHETHER THEY STOP A REAL CLIENT

## A — Would stop or badly confuse a real client

### A1. A Deal client is assigned three documents, not one — and the admin cannot narrow it

**Proven.** Provisioning with the exact payload the UI sends:

```
--- what the ADMIN SAW on screen for "Deal client":
  category   |  template_key   |               title
-------------+-----------------+-----------------------------------
 Deal client | RELEASE_GENERAL | General Visitor Liability Release

--- contact_required_documents ACTUALLY written:
   template_key
------------------
 COMPANY_POLICIES
 FACILITY_RULES
 RELEASE_GENERAL
```

**Why.** `CATEGORY_TOKEN` in `src/lib/admin.ts:528` maps display `'Deal client' → 'GUEST'`. The
form sends the **token**. `provision_client_invitation` passes that token straight to
`apply_category_documents`, which canonicalises and matches it against
`category_document_requirements.category` — where `'Guest'` carries **three** templates. The
comment above `CATEGORY_TOKEN` asserts *"paperwork … is keyed on the DISPLAY category"*. It is
not. Nothing carries the display category past the browser.

**And the checkbox list cannot fix it.** Passing `p_template_keys => {RELEASE_GENERAL}` explicitly
— the admin-touched path — still leaves all three:

```
--- contact_required_documents after the admin-touched path:
 COMPANY_POLICIES
 FACILITY_RULES
 RELEASE_GENERAL
```

Two reasons compound. (1) In `provision_client_invitation`, the `p_template_keys` branch only runs
inside `IF p_request_id IS NOT NULL` — the linked-request path; a plain New-client invite never
reaches it. (2) That branch is `INSERT … ON CONFLICT DO NOTHING` — purely additive. The paperwork
checkboxes on screen can **add** but can never **remove**. This is a **D13** violation: the control
exists, and it does not control the thing.

**Client impact.** They activate expecting one release and are walled behind three. Admin cannot
correct it from the invite form. It also cascades: A2 below.

### A2. `contract_lock_blockers` and `lock_and_sign_contract` disagree about completeness

**Proven.** With every required field the UI actually shows filled in — a screen with no
outstanding-field blocker:

```
--- WHAT THE SCREEN SAYS (contract_lock_blockers):
[ { "code": "horse_unconfirmed", … },
  { "code": "onboarding_documents", … } ]        ← NO required_fields blocker

--- WHAT THE SIGN GATE COUNTS:
 naive_required_empty
----------------------
                   17

ERROR:  cannot sign: 17 required field(s) still empty
```

All 17 are **conditional** fields whose gate is not met — `LESSEE.ENTITY_SIGNER_NAME` (only for a
company lessee), `TXN.MED_COST_RESP` (only when mortality insurance was elected), and so on. The UI
hides them; there is no way to fill them.

`contract_lock_blockers` respects `included`, `is_na`, and both clause-level and field-level
`conditional_on`. Gate 4 inside `lock_and_sign_contract` respects none of them:

```sql
SELECT count(*) INTO v_missing FROM contract_fields
  WHERE document_id = p_document_id AND required
    AND nullif(trim(coalesce(value, '')), '') IS NULL;
```

**Does this stop a real client today? No — because of A3.** The UI only offers the sign button on a
**locked** document, and gates 3–6 are inside an `IF v_state IN ('editable')` branch that a locked
document never enters. So today the naive count is unreachable from the browser. It is a loaded
gun, not a live wound: any surface that lets a party sign from `editable` (which D14 explicitly
contemplates — *"signability is gated by COMPLETENESS, not by workflow state"*) deadlocks
immediately and permanently, with a message naming fields the signer cannot see or fill.

### A3. `lock_and_sign_contract` locks nothing, and skips its own gates whenever it matters

**Proven.** On a locked document, with a required field blanked and the horse confirmation removed:

```
 required_empty_while_locked
-----------------------------
                          18

 signed_anyway
--------------------
 AWAITING_SIGNATURE      ← it signed
```

The function never sets `workflow_state = 'locked'`. It reads state and dispatches to
`record_signature`. Gates 3 (open change requests), 4 (required fields), 5 (party-type match) and
6 (horse confirmed) live inside `IF v_state IN ('editable')`. Since the UI renders the sign button
only when `state === 'locked'` (`ContractPage.tsx:2084`, `:2109`, `:2127`), **those four gates never
execute in production.** Every real enforcement happens earlier, at
`advance_document_workflow(…, 'locked') → contract_lock_blockers`.

Consequences worth the owner's attention:

- The two check-lists have drifted in **both** directions. `contract_lock_blockers` has an
  `onboarding_documents` blocker that the sign gate lacks; the sign gate has a naive required-field
  count that the blockers list does not. Neither is a subset of the other.
- Gate 2's message — *"document is not ready to sign (workflow_state=editing); lock it first"* — is
  the only one a real client can hit, and it is accurate.
- The function's name promises a lock it does not perform. Anyone reading the code, or writing the
  next caller, will assume otherwise.

### A4. Three different dead ends produce one identical message

```
--- expired token:            ERROR: invitation is not valid or has expired
--- superseded token:         ERROR: invitation is not valid or has expired
--- already-redeemed token:   ERROR: invitation is not valid or has expired
```

`redeem_invitation` matches on `status = 'sent' AND expires_at > now()` and raises one message for
every miss. **Mitigated in the browser:** `/activate` calls `validate_invitation` on page load, and
when it returns nothing the page shows *"This link isn't valid anymore"* plus, if a newer
invitation exists, the masked address it went to and a resend button. So a client clicking a
superseded link gets a good screen.

**Not mitigated:** the client who has **already activated** and clicks their old email again. No
newer invitation exists, so `invitation_replacement_notice` returns NULL and they get the generic
*"This invitation may have expired or been replaced by a newer one — check your inbox…"* — advice
to hunt for an email when the truth is *you already have an account, just sign in*. The sentence
does end with "If you've already created your account, just sign in", so it is survivable, but the
system knows exactly which case this is and does not say so.

The wrong-email case is handled well and distinctly:
`ERROR: this invitation was issued to a different email address`.

### A5. A lease can execute with no end date

`TXN.LEASE_END` is **not** in the 31 required fields. The walk executed a lease with
`TXN.LEASE_START` set and `TXN.LEASE_END` blank, producing `horses.lease_end = NULL` and
`horse_relationships.term_end = NULL`. `my_stable_horses` admits a relationship when
`term_end IS NULL OR term_end >= current_date` — so a lease with no end date never expires and the
horse stays in the lessee's stable permanently. `TXN.LEASE_TERM_TYPE` is required, so the document
can say "Fixed term" while carrying no end date.

## B — Structural / operational findings

### B1. The lease cannot be locked until the counterparty's onboarding is done

```
ERROR:  cannot lock: Onboarding documents must be completed first by: Walker Dealclient
```

This is deliberate (`contract_lock_blockers`, the `onboarding_documents` blocker, skipped for
`wall_gating` templates). It is correct policy. But combined with **A1**, a deal client owes three
documents instead of one before any lease can move, and the message names neither the documents nor
a link to chase them.

### B2. Locking a lease silently creates two more unsigned documents

`advance_document_workflow` calls `ensure_horse_documents(horse, contract, true)` at lock. After
execution:

```
    template_key     |       status       | workflow_state
---------------------+--------------------+----------------
 HORSE_EMERGENCY_VET | AWAITING_SIGNATURE | editable
 HORSE_LEASE_V2      | EXECUTED           | executed
 RELEASE_HORSE_CARE  | AWAITING_SIGNATURE | editable
```

Two documents appear on the deal that nobody asked for and nobody was notified about. The lease
reads as fully complete while two attached documents sit unsigned. Whether these should be signed
by the lessor before or after execution is an owner question, not a code question — but the silence
is a defect either way.

### B3. `deal_autocomplete_on_execution` fires and does nothing — for every lease

```
--- the contracts row after EXECUTION:
 status |   segment   | horse_linked |           terms
--------+-------------+--------------+---------------------------
 draft  | acquisition | t            | {"deal_side": "LEASE_IN"}
```

The trigger looks for a `deals` row with `contract_id = NEW.contract_id AND status = 'pending'`.
`start_lease_contract_v2` — the only thing **New contract** calls — never creates one. `deals` rows
come exclusively from `create_deal`, which is only called from `DealsPage.tsx:79`. **Production
holds zero `deals` rows.** So for every lease started the normal way, the trigger returns early,
`deals` is never settled, and `contracts.status` stays `'draft'` forever beside an `EXECUTED`
document. Two disagreeing statuses on one deal.

This is exactly the `INBOUNDALERT` / `GIFTPATH` shape the brief warned about: a wired trigger with
no reachable producer on the primary path.

### B4. `apply_document_supersession` ran and correctly did nothing

Zero prior executed leases for these contacts, so zero superseded. The horse-scoped logic
(`d.horse_id IS NULL OR d.horse_id = NEW.horse_id`) is present and matches the `SUPERSEDE` fix.
Not exercised for real; see the owner checklist item 4.

### B5. Notification resolution is a DELETE, not a resolve

`resolve_notifications_for_link` writes an `audit_logs` row and then `DELETE`s. After execution,
`SELECT count(*) … WHERE link = '/app/contracts/<id>'` returns **0** — both parties' "ready to
sign" alerts are gone from their bells. The trail survives in `audit_logs`, so nothing is lost, but
"resolved" in this codebase means "removed", and a party looking for the notification that brought
them there will not find it.

## C — Claims in the task brief that are wrong

| brief said | actually |
|---|---|
| "Paperwork is keyed on the DISPLAY category: **Deal client ⇒ `RELEASE_GENERAL` only**" | **False.** The token `GUEST` reaches the RPC and yields three documents. Finding A1. |
| "Gate 2: **document is `locked`** — else refuse" | **False.** `editable` and `executed` are also accepted. The refusal fires for `editing` / `in_review` / `draft`. |
| Gates 3–6 apply generally | **False.** They only run when `workflow_state = 'editable'`, which the UI never reaches with a sign button. Finding A3. |
| "⚠️ Gate 6 is the owner's most likely real-world stall … the message names a step admin may not know they owe" | **Wrong suspect.** Gate 6 has **two** clearly-labelled UI affordances (`ContractPage.tsx:1778` and `:1936`): a gold button *"I reviewed the horse info — it's accurate"* for the Lessor or staff, and *"Awaiting confirmation by the horse's owner"* for everyone else. `confirm_horse_section` correctly refuses the lessee: *"only the Lessor (or staff) may confirm the horse information"*. The real stall is **A1 → B1** (onboarding paperwork), not the horse. |
| "`groups.group_type` has no fifth value" | **True** — the CHECK constraint allows only `GUEST / RIDER / HORSE_OWNER / PARENT_GUARDIAN`, and the provisioned deal client got exactly one `GUEST` row. |
| "prior invitations superseded so one live token exists" | **True and proven.** |
| "`expires_at` from `invitation_expiry_days(org)`" | **True** — 7 days. |
| "`horse_needed` = FALSE for a deal client" | **True and proven.** |
| "profile gate = phone + date_of_birth + emergency_contact_1_name + emergency_contact_1_phone" | **True and proven.** |
| "when signatures ≥ signers: `status='EXECUTED'`, `workflow_state`, `effective_date`, `execution_hash`, template version frozen" | **True and proven — all five.** |

---

# PART 3 — THE REQUIRED FIELD LIST FOR `HORSE_LEASE_V2`

31 of 121 seeded fields are `required`. **15 are always active; 16 are conditional** (shown only
when their gate is met). Two are pre-filled at creation; one is filled from the horse record.

### Always required (15)

| owner | field_key | label | seeded at creation |
|---|---|---|---|
| LESSOR | `LESSOR.PARTY_TYPE` | Lessor is an | `INDIVIDUAL` |
| LESSEE | `LESSEE.PARTY_TYPE` | Lessee is an | `INDIVIDUAL` |
| DEAL | `TXN.LEASE_PURPOSE` | Purpose of the lease | — |
| LESSOR | `HORSE.REGISTERED_NAME` | Registered name | from the horse record |
| LESSOR | `TXN.INJURY_HISTORY` | Has anyone been seriously injured by the Horse's direct actions? | — |
| DEAL | `TXN.LEASE_TERM_TYPE` | Term type | — |
| LESSOR | `TXN.LEASE_TYPE` | Lease type | `PARTIAL` |
| DEAL | `TXN.PERMITTED_ACTIVITIES` | Permitted activities | — |
| DEAL | `TXN.LEASE_START` | Lease start date | — |
| LESSOR | `TXN.RIDER_AIDS_PROHIBITED` | Lessor prohibits the use of rider aids | — |
| LESSOR | `TXN.GL_LESSOR_COVERAGE` | Lessor (general liability) | — |
| LESSOR | `TXN.GL_LESSOR_REQUIRES` | Lessor requires of Lessee | — |
| LESSOR | `TXN.GL_LESSEE_STATUS` | Lessee (general liability) | — |
| LESSOR | `TXN.MORT_ELECTION` | Mortality insurance | — |
| LESSOR | `TXN.MED_INCLUDED` | Medical coverage is included on the mortality policy | — |

### Conditionally required (16) — the ones gate 4 miscounts

| owner | field_key | shown only when |
|---|---|---|
| LESSEE | `LESSEE.ENTITY_SIGNER_NAME` | `LESSEE.PARTY_TYPE = ENTITY` |
| LESSEE | `LESSEE.ENTITY_SIGNER_TITLE` | `LESSEE.PARTY_TYPE = ENTITY` |
| LESSOR | `LESSOR.ENTITY_SIGNER_NAME` | `LESSOR.PARTY_TYPE = ENTITY` |
| LESSOR | `LESSOR.ENTITY_SIGNER_TITLE` | `LESSOR.PARTY_TYPE = ENTITY` |
| LESSOR | `TXN.INJURY_HISTORY_DETAILS` | `TXN.INJURY_HISTORY = YES` |
| LESSOR | `TXN.OTHERS_ALLOWED_OTHER` | `TXN.OTHERS_ALLOWED` contains `OTHER` |
| LESSOR | `TXN.PROTECTIVE_EQUIPMENT_OTHER` | protective equipment required **and** contains `OTHER` |
| DEAL | `TXN.RIDER_AIDS` | `TXN.RIDER_AIDS_PROHIBITED = YES` |
| LESSOR | `TXN.RIDER_AIDS_OTHER` | rider aids prohibited **and** contains `OTHER` |
| LESSOR | `TXN.GL_NO_REQ_ALLOCATION` | `TXN.GL_LESSOR_REQUIRES = NEITHER` |
| LESSOR | `TXN.CCC_REQUIRED` | lessee is an ENTITY **and** GL status agrees/other |
| LESSOR | `TXN.CCC_LESSEE_STATUS` | lessee is an ENTITY **and** GL status agrees/other |
| LESSOR | `TXN.MORT_COST_RESP` | mortality carried or will be obtained |
| LESSOR | `TXN.MORT_DED_RESP` | mortality carried **and** cost split/other |
| LESSOR | `TXN.MED_COST_RESP` | mortality carried **and** medical included |
| LESSOR | `TXN.MED_DED_RESP` | mortality carried, medical included **and** cost split/other |

**`TXN.LEASE_END` is not on either list.** See finding A5.

---

# PART 4 — ALL SIX GATES, REFUSING, WITH EXACT TEXT

Reached by calling `lock_and_sign_contract` from `workflow_state = 'editable'`, one gate unmet per
attempt. **Judged as a client would read them.**

### Gate 1 — no signed-in user
```
ERROR:  authentication required
```
**Jargon.** A client never sees this — the browser holds a session — but if it ever surfaced it
reads as a system fault, not "please sign in again".

### Gate 2 — wrong workflow state
```
ERROR:  document is not ready to sign (workflow_state=editing); lock it first
```
**Half actionable.** "Lock it first" is an instruction the client cannot follow — only staff (or a
party with recipient-editing) can lock. The parenthetical `workflow_state=editing` is internal
vocabulary. For staff it is perfectly clear; for a client it is a dead end with no next step.

### Gate 3 — an open change request
```
ERROR:  cannot sign: 1 open change request(s) remain; resolve or lock first
```
**Actionable for staff, confusing for the client** — usually the client *raised* the request, so
"resolve it" is not theirs to do. It does not say who must act. The `(s)` pluralisation is a tell
that it was written for a log, not a person.

### Gate 4 — required fields empty
```
ERROR:  cannot sign: 27 required field(s) still empty
```
and after filling everything the screen shows:
```
ERROR:  cannot sign: 17 required field(s) still empty
```
**Not actionable at all.** It names no field. `contract_lock_blockers` produces the same fact as
*"Required field(s) still empty: Purpose of the lease, Term type, …"* — with labels. The sign gate
throws away that work and reports a bare count. And per **A2**, the 17 it counts cannot be filled
by anyone.

### Gate 5 — party type contradicts the record
```
ERROR:  cannot sign: LESSEE.PARTY_TYPE contradicts the Lessee party record (person vs company) — correct the field or the contact record
```
**Actionable for staff, jargon for a client.** It leads with a raw field key. The
`(person vs company)` gloss and the "correct the field or the contact record" instruction do rescue
it — this is the best-written of the six for someone who knows the system.

### Gate 6 — the horse section is unconfirmed
```
ERROR:  cannot sign: the horse information has not been confirmed by the Lessor
```
**Fully actionable and correctly targeted.** It names the person who owes the step, in plain
English, with no internal identifiers. And the step is one visible button away for that person.
When the lessee tried to do it themselves:
```
ERROR:  only the Lessor (or staff) may confirm the horse information
```
Equally clear.

### And the one a real client actually hits

```
ERROR:  cannot lock: Onboarding documents must be completed first by: Walker Dealclient
```
**Actionable but incomplete** — names the person, not the documents, and offers no link.

---

# PART 5 — WHAT ADMIN SEES, AT EACH OF THE THREE MOMENTS

### Moment 1 — the contract is complete and ready to sign

| | |
|---|---|
| **Surface** | `/app/contracts/<id>` — the state chip flips to `locked`, the header offers *"Unlock to edit"*, and the signature block appears |
| **Ops list** | `/app/ops/documents` — `status = AWAITING_SIGNATURE`, `current_status = ready_to_sign` |
| **Timeline** | a `status_events` row: `ready_to_sign` |
| **Notification** | **none to staff.** Admin performed the lock, so `advance_document_workflow` excludes `auth.uid()`. Both **parties** get `contract_locked` — *"Horse Lease Agreement — Standard is ready to sign"* → `/app/contracts/<id>` |

**Gap:** if a *party* locks the document (permitted when recipient editing is on), staff are told
nothing at all. There is no `contract_locked` notification for staff in any path.

### Moment 2 — the other party has signed

| | |
|---|---|
| **Notification** | `party_signed` → *"Horse Lease Agreement — Standard — signed by Walker Dealclient (LESSEE)"* → `/app/ops/documents/<id>` — **to both `admin@` and `hello@`** |
| **Surface** | the contract page's signature block shows one sealed, one pending |
| **Ops list** | still `AWAITING_SIGNATURE`; `current_status = signed` |
| **Timeline** | a `signed` status event |

This fires on **every** non-company party signature, so a two-human lease produces two of these,
and each onboarding document produces one — 5 `party_signed` rows per staff mailbox across this
whole walk. On a busy day that is noise.

### Moment 3 — both have signed

| | |
|---|---|
| **Notification** | `party_signed` → *"— fully executed; signed by Olive Lessor (LESSOR)"* → `/app/ops/documents/<id>`. The word **"fully executed"** in the title is the only thing distinguishing this from moment 2 |
| **The other party** | `document_executed` → *"Horse Lease Agreement — Standard is signed"* → `/app/documents`. **The signer gets nothing** — correct |
| **Cleared** | both parties' `contract_locked` alerts are deleted |
| **Ops list** | `status = EXECUTED`, `workflow_state = executed`, `current_status = signed`, effective date and execution hash set |
| **Not updated** | `contracts.status` stays `'draft'` (finding B3) |

Full notification tally for the walk:

```
       kind        |          to_whom          | n
-------------------+---------------------------+---
 document_executed | cw-lessee@example.invalid | 1
 party_signed      | admin@fhequestrian.com    | 5
 party_signed      | hello@fhequestrian.com    | 5
```

---

# PART 6 — SAFETY: HOW THIS WAS DONE, AND THE EMAIL BOUNDARY

### Impersonation

```sql
set_config('request.jwt.claims',
  json_build_object('sub', <user_id>, 'role', 'authenticated')::text,
  true)   -- is_local = true: dies with the transaction
```

`auth.uid()` and `auth.role()` read exactly these settings, so every `SECURITY DEFINER` function
behaved as if called by that account. Verified live:

```
               auth_uid               |   auth_role   | staff |                 org
--------------------------------------+---------------+-------+--------------------------------------
 b45a5503-89bc-489a-b012-c7fbf5c09632 | authenticated | t     | e656f20b-ef43-4725-9029-19e7f0190d9c
```

Three identities were impersonated in turn: `admin@fhequestrian.com` (staff), a synthetic lessee,
and a synthetic lessor. Two synthetic `auth.users` rows, two synthetic contacts, one synthetic
horse — all created inside the transaction, none reusing a real client.

**Caveat.** The psql connection runs as `postgres`, which bypasses RLS. Function-level
authorisation (`has_staff_access`, `caller_is_document_party`, the gates) was exercised faithfully;
**row-level visibility was not**. See owner checklist item 1.

### The email boundary — no mail was sent, and here is why

Two independent guarantees.

**1. Structural.** Before the executing signature, `executed_email_sent_at` was stamped on the
document, so `documents_send_executed_email` fails its `NEW.executed_email_sent_at IS NULL` guard
and takes the no-op branch. The same was done for the three onboarding documents. Queue depth
confirmed unchanged across execution:

```
 pg_net_queue_before        pg_net_queue_after
---------------------      --------------------
                   0                         0
```

**2. Transactional — the boundary itself.** `send_executed_document_email` and
`deliver_executed_document_set` dispatch via `net.http_post` (pg_net 0.20.3), whose entire body is
`INSERT INTO net.http_request_queue … ; PERFORM net.wake()`. That INSERT is an ordinary write inside
the caller's transaction; the pg_net background worker runs on its own connection and can only see
**committed** rows. Proven empirically against a dead local port, never FHE's endpoint:

```
queue before (fresh connection):     0
inside txn, net.http_post(...):      request_id 29, queued rows 1
ROLLBACK
after rollback (same connection):    0
second connection:                   queue_rows 0, responses in last 2 min 0
```

**Conclusion: a rolled-back transaction cannot send mail through this path.** The structural guard
was applied anyway as belt-and-braces. `APP_BASE_URL` **is** configured on this org
(`https://www.frenchheritageequestrian.com`), so a *committed* run of these steps would have hit
the live `/api/deliver-documents` endpoint and sent real PDFs. That is the boundary; it was not
crossed.

The **invitation** email was never in play — `provision_client_invitation` only mints the token; the
send happens in `/api/admin-send-invitation` (Node), which this walk never called.

### Production is unchanged

Baseline (before `BEGIN`) and post-`ROLLBACK` census, identical in all 16 tables:

| table | before | after |
|---|---|---|
| auth.users | 12 | 12 |
| contacts | 24 | 24 |
| profiles | 9 | 9 |
| members | 12 | 12 |
| groups | 15 | 15 |
| invitations | 15 | 15 |
| contact_required_documents | 25 | 25 |
| documents | 57 | 57 |
| document_parties | 78 | 78 |
| signatures | 51 | 51 |
| contracts | 0 | 0 |
| contract_fields | 0 | 0 |
| horses | 1 | 1 |
| horse_relationships | 1 | 1 |
| notifications | 44 | 44 |
| net.http_request_queue | 0 | 0 |

`ROLLBACK` was the only terminator. `COMMIT` appears nowhere in the script.

---

# PART 7 — WHAT COULD NOT BE PROVEN SERVER-SIDE

A numbered checklist for the owner, in a browser, on production. Items 1–3 are the ones that could
change a finding.

1. **RLS visibility for both parties.** The walk ran as `postgres` (RLS bypassed). Sign in as a
   lessee-role member and confirm they can actually **see** the lease at `/app/contracts/<id>`, see
   the other party's name, and see their own signature row. `my_documents()` returned 4 rows for
   the lessee here, but that was without RLS enforcement.

2. **That the "Deal client" bug reproduces in the browser.** Create a throwaway invite (a spare
   address you control), tick **Deal client only**, do **not** touch the paperwork checkboxes, send.
   Then open that contact's record and count assigned documents. Expect **three**. Then repeat, but
   this time untick Company Policies and Facility Rules before sending — expect **three again**.
   This confirms A1 end to end and shows the checkbox is decorative.

3. **The horse-confirm button's render conditions.** Server-side, gate 6 arms whenever the document
   has any LESSOR-owned `HORSE.*` field — which is always, since they seed from the template. The
   page's header affordance additionally requires `doc.horse_id` to be set
   (`ContractPage.tsx:1762`). **Start a lease with no horse attached and confirm the Lessor still
   has a way to confirm the horse section** (the Horse-section header button at `:1936` should still
   render). If it does not, gate 6 becomes exactly the unreachable stall the brief feared, for
   horseless leases only.

4. **Supersession of a real prior lease.** Execute a second lease for the same lessee and the same
   horse and confirm the first flips to `superseded` and stays visible as evidence. Zero leases
   existed to supersede here.

5. **The invitation email itself.** Whether it renders, what it lists as the paperwork, and whether
   the `/activate` link works from a real mail client — the send path is Node, not SQL, and was
   deliberately not called.

6. **The `/app/onboarding` screens.** The wall state and document list were proven as data; the
   actual signing screens, the profile form's per-field validation messages, and what a client sees
   when they supply none of the four gating fields were not rendered.

7. **The two documents that appear at lock** (B2). Confirm whether `HORSE_EMERGENCY_VET` and
   `RELEASE_HORSE_CARE` are visible to the Lessor on the deal, and decide whether they should be.

8. **PDF generation and the executed-copy email.** Deliberately not exercised. Whether the
   executed lease renders correctly as a PDF, and what the delivered email contains, is unknown from
   here.

---

# APPENDIX — the artefacts

- `docs/reports/TASK-CONTRACTWALK-walk.sql` — the complete transaction, runnable as-is. It ends in
  `ROLLBACK` and contains no `COMMIT`.
- `docs/reports/TASK-CONTRACTWALK-output.txt` — full psql output, W1 through W9, including every
  error message quoted above in its original context and both row censuses.

**Nothing in this walk was fixed.** Every item above is reported for the owner to sequence.
