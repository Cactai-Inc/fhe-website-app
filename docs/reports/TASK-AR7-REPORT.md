# TASK-AR7 — ONE onboarding flow, three ways in

**Worktree** `~/Downloads/claude-code-repo/wt-ar7` · **branch** `task/ar7` · **base** `origin/main` @ `18eb6354`
**Method** read-only source + production `psql` (SELECT only, no transactions opened) + `git log`/`git blame`.
**Nothing was changed. No migration, no data write, no fix.**

---

## 0. ⚠️ URGENT

**None.** Nothing is actively corrupting data right now. The one live incident (§6) is explained,
contained to one family, and the mechanism that caused it is a *copy and field-labelling* defect at
the public front door, not a broken signing engine. It will recur the next time a parent signs their
child up, so it is P0 for the build pass — but it is not an emergency requiring a hot fix tonight.

Three claims in the task brief turned out to be **wrong**, and two of them change the plan
materially. They are corrected in place below and collected in §1.

---

## 1. ⚠️ THREE THINGS THE BRIEF ASSERTS THAT THE EVIDENCE CONTRADICTS

Per the standard's §5 (*"a state claim in a doc is a hypothesis"*), I re-verified §3 and §4 of the
brief before building on them. Three did not survive.

### 1.1 "The evidence that would settle it is missing" — IT IS NOT MISSING

The brief says Evan's signatures carry no IP and no user-agent, and *"that is itself a finding"*, and
that the incident may be undeterminable. The `signatures` columns are indeed null — but
**`audit_logs` carries `ip` and `user_agent` on every single INSERT and UPDATE**, including all four
of Evan's signature rows and every contact edit around them, with `actor_user_id` and a full
`old_value`/`new_value` JSON diff.

That table settled the incident completely and to the second (§6). The attribution is not lost; it is
one table over, and no one looked.

### 1.2 "Nothing in the system can approve a request" — IT CAN, AND THE PATH IS REACHABLE

The brief says *"today NOTHING in the system can approve a request. A request has ten stages and
every one ever created sits at the first. So initiation A cannot currently run at all."*

Every clause of that is inaccurate:

- `requests.status` has **five** values, not ten:
  `CHECK (status = ANY (ARRAY['new','contacted','invited','expired','converted']))`.
- Production is **11 `new` and 6 `contacted`** — so requests have already moved off the first stage
  six times.
- **`provision_client_invitation` IS the approval.** Its body ends with
  `UPDATE requests SET status = 'invited' WHERE id = p_request_id;` (line 361 of the live function),
  and before that it flips the request's draft purchase to `awaiting_payment`, logs an
  `order/submitted` status event, and resolves the request's inbound alert.
- It is reachable through the UI today:
  `/app/dashboard` → [DashboardHome.tsx:56](src/pages/app/DashboardHome.tsx#L56) →
  [DashboardPanel.tsx:212](src/components/app/DashboardPanel.tsx#L212) leads band → "Review" →
  [DashboardPanel.tsx:546](src/components/app/DashboardPanel.tsx#L546) `LeadWorkDrawer` →
  [LeadWorkDrawer.tsx:600](src/components/app/LeadWorkDrawer.tsx#L600) `ProvisionClientForm
  source="submission" requestId={selected.id}` → `adminSendInvitation` →
  `/api/admin-send-invitation` ([api/admin-send-invitation.ts:320](api/admin-send-invitation.ts#L320)
  `p_request_id: requestId`) → `provision_client_invitation`.

**Initiation A can run today.** What is true is that **nobody has ever run it to completion** — zero
requests are at `invited` or `converted`. That is an adoption/verification gap, not a missing
capability, and it changes the plan from "build the approval" to "walk it once and fix what breaks".

The one genuinely dead status is **`expired`** — nothing in the database or the codebase ever writes
it (`invitation_expires_at` exists on `requests` but no sweep reads it).

### 1.3 §3's capability table is wrong in two cells

| §3 claim | Reality |
|---|---|
| `Onboarding.tsx` — "shows the expected name: **no**" | **It does.** [Onboarding.tsx:1412](src/pages/app/Onboarding.tsx#L1412) renders `Type your name exactly as printed — <b>{expectedName}</b> — to sign` whenever `expectedName` is non-empty. This matters enormously: Evan was shown a name, and it was the wrong one. |
| "contract deep-link to `/app/contracts/:id` — **only in `DocumentsContent`**" | Onboarding has one too, at [Onboarding.tsx:890](src/pages/app/Onboarding.tsx#L890) and [:586](src/pages/app/Onboarding.tsx#L586) — it routes to `/app/contracts/:id/**start**`, the gate that asks for missing party fields first. That is the *better* of the two links. |

§3 is right about everything else, and right about the thing that matters most: `record_signature`
checks only that the typed name is non-empty.

---

## 2. WHAT THIS AREA IS FOR

Somebody decides they want to ride here, or board a horse here, or they are the other side of a
contract we have drawn up. Between that decision and their first lesson there is a fixed amount of
business we have to get through: we need to know who they are and how to reach them; they need to
read and sign the paperwork that lets them on the property; they need to see what they are getting
and say whether it is right; and they need to pay for it.

There are three different ways that conversation starts — they filled in a form on the website and we
said yes; we set them up ourselves after a phone call; or they found the sign-up link and did it
themselves. **The owner's requirement is that all three lead into the same corridor.** Once someone
clicks the link in their email, nothing about how they arrived should change what they see next.

---

## 3. THE STATE MATRIX

⚠️ **The wall is the single fact that governs reachability in this area**, and it is not obvious. It
is a **client-side redirect only** — [AppLayout.tsx:1550](src/components/app/AppLayout.tsx#L1550):

```
if (wall?.wall && location.pathname !== '/app/onboarding') → <Navigate to="/app/onboarding" replace/>
```

`wall.wall` is `my_wall_state()` → `contact_document_wall_state()` → the count of
`contact_required_documents` rows with `disposition = 'AT_LOGIN'`, not skipped, not satisfied, joined
to the *max active version* of their template. **Every one of the 49 `contact_required_documents`
rows in production is `AT_LOGIN`** (the column default), so for every member who owes paperwork, the
wall is up and `/app/onboarding` is **the only reachable route in the whole app.**

| Person's state | `/app/onboarding` | `/app/documents` + `/app/account` panel | `/app/contracts/:id` | `/release`, `/docs/release-participant` | `/sign/*` |
|---|---|---|---|---|---|
| **Anonymous, no account** | ProtectedRoute → `/login` | → `/login` | → `/login` | ✅ **fully usable, no session** | ✅ **fully usable, no session** |
| **Contact, no account** (invited, never activated) | → `/login` | → `/login` | → `/login` | ✅ usable | ✅ usable — a repeat email is the *resume* path |
| **Signed in, gating docs outstanding** (Evan at 20:41) | ✅ the corridor | ❌ **bounced** — every nav hits the wall | ❌ bounced | ✅ still reachable (public, outside `/app`) | ✅ still reachable |
| **Signed in, all docs satisfied** | renders `done`/`slots`/`shop` | ✅ reachable; `My Documents` rail link is presence-gated on `presence.documents` ([AppLayout.tsx:1090](src/components/app/AppLayout.tsx#L1090)) | ✅ reachable | ✅ | ✅ |
| **Signed in, a `WHEN_READY` doc outstanding** | ✅ reachable (`required_templates_for_contact` excludes only `WITH_CONTRACT`) | ✅ **and this is where `DocumentsContent`'s unchecked name box becomes live** | ✅ | ✅ | ✅ |
| **Staff** | reachable; **never walled** — `my_wall_state` returns `staff_banner` instead ([AppLayout.tsx:1738](src/components/app/AppLayout.tsx#L1738)) | ✅ | ✅ + the staff `SigningPanel` at `/app/ops/documents/:id` | ✅ | ✅ |
| **Archived** | `deleted_at` excludes them from `wall_onboarding_invariant_violations` and from most reads; not separately tested — see §8 |  |  |  |  |
| **Mobile** | the corridor is a single narrow column and reads fine at 375px; no horizontal scroll in any step | `DocumentsContent` rows wrap (`flex-wrap`) | — | — | — |

**Two consequences that are not obvious and that reshape the whole task:**

1. **`DocumentsContent` is NOT a second onboarding corridor. It is the *post-wall* surface.** While
   anyone owes an `AT_LOGIN` document they physically cannot reach it. It only becomes a signing
   surface for documents that do *not* raise the wall: `WHEN_READY` assignments, and documents where
   the member is a signer party with **no `contact_required_documents` row at all**.
2. **Today it has nothing to act on.** The only unsigned signer party in production is Pamela Godde's
   `HORSE_LEASE_V2`, and that is a contract document (`contract_id` set), so
   [DocumentsContent.tsx:283](src/components/app/DocumentsContent.tsx#L283) renders the deep-link,
   not the name box. **The unchecked box in `DocumentsContent` has never signed anything, and did not
   sign Evan's documents.** It is a live hazard for the first `WHEN_READY` assignment, not the cause
   of the incident.

---

## 4. FINDINGS

### F1 — ⚠️ ROOT CAUSE OF THE INCIDENT. `/sign/*` asks for "First name" and the person filling it in is often not the rider.

**What.** [SignStart.tsx:522](src/pages/SignStart.tsx#L522) and [:533](src/pages/SignStart.tsx#L533)
render bare `First name *` / `Last name *` with no statement of *whose* name. The page's own welcome
copy is [SignStart.tsx:70](src/pages/SignStart.tsx#L70) — *"let's get **you** set up to start taking
riding lessons"* — and the chooser card that leads to it is
[SignChoose.tsx:49-53](src/pages/SignChoose.tsx#L49-L53): *"**I'm here to ride** — Lessons and riding
time on our horses. Pick this if **you'll** ride, and the horse is ours."*

The entire front door is written in the first person for a self-serving adult. **There is no minor
question anywhere on `/sign/*`.** A parent enrolling a child has exactly one name field and every
word on the page tells them it is the rider's.

**Evidence.** Both of Evan LaBuzetta's `/sign/rider` submissions are in `signup_attempts`:

| `created_at` | `first_name` | `last_name` | `email` | `path` |
|---|---|---|---|---|
| 2026-08-28 20:37:5x | **Aubrey** | LaBuzetta | evanlabuzetta@gmail.com | rider |
| 2026-08-28 20:39:52.925476-07 | **Evan** | LaBuzetta | evanlabuzetta@gmail.com | rider |

He submitted his **daughter's** name first, realised two minutes later, and submitted again with his
own. `audit_logs` shows the contact created at `20:37:59.649991` with
`first_name → "Aubrey"`, and the second submission did **not** correct it — because
`fill_claimant_details` writes **blanks only** by design (*"so a public form never overwrites what
staff hold"*, [api/sign-start.ts:145-147](api/sign-start.ts#L145-L147)). The record was no longer
blank.

**Why it matters.** Everything downstream is correct given the input. The account, the profile, the
merged contract body and the printed signature line all faithfully carried the name typed at the
front door. **The corridor did not fail. It was fed a wrong fact and propagated it perfectly.**

**Conditions.** True for every `/sign/*` path, for any adult enrolling anyone other than themselves,
on desktop and mobile, from the moment `/sign/*` began provisioning. `/sign/horse` is equally exposed
(a parent who owns the horse but whose child rides it) and `/sign/rider+horse` doubly so.

---

### F2 — ⚠️ THE CORRECTION IS SILENTLY REFUSED, AND THE PERSON IS TOLD IT SUCCEEDED

**What.** Evan noticed his own mistake and did the right thing — he resubmitted with the correct
name. `/api/sign-start` returned `status: 'sent'`, `signup_attempts.email_ok = true`, and the send
state screen told him the email went out. **The name was discarded in silence.**

**Evidence.** `fill_claimant_details` is blanks-only (F1). `audit_logs` on his contact for
`2026-08-28 20:39:50.147171` and `20:39:50.515105` shows the diff as *`updated_at` only* — no
`first_name` change. The name stayed `Aubrey` until `20:45:41.219249`.

**Why it matters.** The blanks-only rule is correct *against staff-maintained data*. It is wrong
**against the visitor's own prior submission from the same door with the same email**, where there is
no staff edit to protect and the second submission is unambiguously a correction. A person who spots
their own error and fixes it should not be told it worked when it did not.

**Conditions.** Every repeat `/sign/*` submission on an email that already has a contact, for every
field the first submission filled.

---

### F3 — ⚠️ THE NAME RULE IS IMPLEMENTED SIX TIMES, FOUR OF THEM DO NOTHING, AND THE SERVER ENFORCES NOTHING

**What.** Six signing surfaces, six different rules.

| # | Surface | Route(s) | Rule | Compared against | Shows expected name |
|---|---|---|---|---|---|
| 1 | [Onboarding.tsx:775](src/pages/app/Onboarding.tsx#L775) | `/app/onboarding` | **EXACT, case-sensitive** | the signer's own `profiles` row | ✅ **yes** ([:1412](src/pages/app/Onboarding.tsx#L1412)) |
| 2 | [Release.tsx:176](src/pages/Release.tsx#L176) | `/release`, `/release/:releaseKey` (**anon**) | case-insensitive | *the name typed on the same form seconds earlier* | ✅ |
| 3 | [DocsParticipantFlow.tsx:156](src/pages/DocsParticipantFlow.tsx#L156) | `/docs/release-participant` (**anon**) | case-insensitive | *the name typed on the same form seconds earlier* | ✅ |
| 4 | [DocumentsContent.tsx:303](src/components/app/DocumentsContent.tsx#L303) | `/app/documents`, `/app/account` | **NONE** — `disabled={!trimmed}` | — | ❌ label is only "Type your full legal name to sign" |
| 5 | [ContractPage.tsx:2298](src/pages/app/ContractPage.tsx#L2298) | `/app/contracts/:id` | **NONE** — `disabled={!signName.trim()}` | — | ❌ placeholder "Full legal name" |
| 6 | [SignPartyRow.tsx:66](src/components/ops/documents/SignPartyRow.tsx#L66) | `/app/ops/documents/:id` (staff) | **NONE** — `disabled={!trimmed}` | — | ❌ shows the party_role only |

⚠️ **Even the two "case-insensitive" checks are weaker than they read.** They compare the typed
signature against the name the same person typed into the same form moments before — a **typo
catcher, not an identity check**. Evan's exact mistake would sail straight through both: he would
have typed "Aubrey LaBuzetta" in the name field and "Aubrey LaBuzetta" in the signature field, and
they match.

**And the server enforces nothing.** The live `record_signature(uuid,text,text,text,text,boolean)`:

```
IF nullif(btrim(coalesce(p_typed_name, '')), '') IS NULL THEN
  RAISE EXCEPTION 'a typed name is required to sign';
END IF;
```

That is the whole check. There is no comparison to `signer_contact_id`, to the party row, or to
anything else.

**Three code comments assert a server guarantee that does not exist:**

- [Onboarding.tsx:773](src/pages/app/Onboarding.tsx#L773) — *"record_signature enforces it
  server-side; we gate the button the same way"*. **False.**
- [ConfirmNameModal.tsx:15](src/components/app/ConfirmNameModal.tsx#L15) — *"The authoritative gate is
  server-side in record_signature(), so this is the friendly half, not the fence."* **False — there
  is no fence.**
- [ContractPage.tsx:2240](src/pages/app/ContractPage.tsx#L2240) — *"the authoritative gate is
  server-side in record_signature(), so a deep link here changes nothing."* **False for the name**
  (true for the *party* check, which does exist).

A fourth is false about a different thing:
[ops/api-client.ts:125](src/lib/ops/api-client.ts#L125) — *"ip/user-agent are captured server-side
from the request headers."* **`record_signature` does not read request headers at all.**

**Why it matters.** Four surfaces let anyone type any string as a legally-binding signature, and
three comments have been telling every reader for two months that a server check has their back.
That is how a fifth surface gets written with no check — the author reads the comment.

---

### F4 — ⚠️ THE FIX ALREADY EXISTS IN THIS DATABASE, TWICE, AND `record_signature` USES NEITHER

Both halves of what `record_signature` is missing are already written, live, and proven in production
— in `sign_release`, the public kiosk RPC:

**The name check** (`sign_release`, line 60):
```
IF v_typed = '' OR lower(v_typed) <> lower(v_name) THEN
  RAISE EXCEPTION 'typed signature must match the full name exactly';
END IF;
```
Case-insensitive, server-side, unbypassable. 40 of the 71 production signatures went through it.

**The attribution** (`sign_release`, line 106):
```
SELECT a.ip, a.user_agent INTO v_ip, v_ua FROM http_request_attribution() a;
```
`http_request_attribution()` is a live `STABLE` function that reads
`current_setting('request.headers')` and extracts the first `x-forwarded-for` hop and the
`user-agent`. **`record_signature` accepts `p_ip`/`p_user_agent` as parameters and every caller
passes `NULL`** — [api.ts:1448](src/lib/api.ts#L1448) `p_ip: ip ?? null` (no caller supplies `ip`),
[ops/api-client.ts:138](src/lib/ops/api-client.ts#L138) `p_ip: null`, and `lock_and_sign_contract`
line 77 `record_signature(..., NULL, NULL, ...)`.

**Evidence of the resulting split:**

| `method` | rows | with IP | first | last |
|---|---|---|---|---|
| `KIOSK_TYPED` (`sign_release`) | 40 | **40** | 2026-07-13 | 2026-08-15 |
| `TYPED` (`record_signature`) | 31 | 10 | 2026-07-10 | 2026-08-28 |

Every `record_signature` signature since 2026-08-04 carries no IP and no user-agent. **21 of 71
production signatures have no attribution on the row.**

---

### F5 — TWO DOCUMENT-LIST ORDERINGS DISAGREE, AND ONE OF THEM IS NON-DETERMINISTIC

**What.** `my_onboarding_state()` orders the signing set by
`coalesce(contract_templates.onboarding_order, 99), template_key` — a deliberate, stable sequence.
`listMySignableDocuments()` ([ops/api-client.ts:92](src/lib/ops/api-client.ts#L92)) orders by
`generated_at DESC`.

**Evidence.** All four of Evan's documents share `generated_at = 2026-08-28 20:41:09.804811-07` to the
microsecond — they were generated in one statement. With every key equal, PostgREST's order is
arbitrary; the rows came back `HUMAN_EMERGENCY_MEDICAL, COMPANY_POLICIES, FACILITY_RULES,
RELEASE_PARTICIPANT`, i.e. the *last* document first. The `onboarding_order` sequence is
`COMPANY_POLICIES(1) → FACILITY_RULES(2) → RELEASE_PARTICIPANT(3) → HUMAN_EMERGENCY_MEDICAL(7)`.

**Why it matters.** Two surfaces present the same set in different, and in one case unpredictable,
orders. Company Policies is `onboarding_order = 1` for a reason; a member on `/app/documents` is
offered the emergency medical authorisation first. It also made the incident harder to diagnose —
Evan's signing sequence exactly matched `onboarding_order`, which is what first located him in
`Onboarding.tsx` rather than `DocumentsContent`.

---

### F6 — `DocumentsContent` PASSES E-SIGN CONSENT AS A LITERAL

[DocumentsContent.tsx:358](src/components/app/DocumentsContent.tsx#L358):
`await signMyDocument(item.document.id, item.party_role, typedName, true)` — the fourth argument is
the ESIGN consent flag, hardcoded `true`, with the comment *"E-sign consent is passed true — same
contract as the onboarding flow."*

It is **not** the same contract. Onboarding renders an actual checkbox
([Onboarding.tsx:1386-1396](src/pages/app/Onboarding.tsx#L1386-L1396)) and refuses to sign without it
(`if (!currentDoc || !nameMatches || !esignConsent || signing) return;`). `DocumentsContent` writes
an `esign_consents` row asserting the member affirmed something they were never shown. Under
ESIGN/UETA that row is the record of consent; manufacturing it is worse than not having it.

Same for `ContractPage`'s manual path and the staff `SigningPanel`.

---

### F7 — THE WALL IS A CLIENT-SIDE REDIRECT WITH NO SERVER COUNTERPART

`my_wall_state()` is a *read*. Nothing in `record_signature`, `lock_and_sign_contract` or
`signMyDocument` consults it. The wall exists only as a React `<Navigate>` in `AppLayout`, and
`wall` initialises to `null`, so `wall?.wall` is falsy for the duration of the `my_wall_state()`
round-trip — a cold load of `/app/documents` mounts `DocumentsContent`, fires both of its reads, and
can paint rows before the redirect lands.

This did **not** cause the incident (§6 proves Evan signed inside the corridor), and the window is
too short to type a name into. But "the wall holds" is currently a statement about a component's
render order, not about the database, and §3's `WHEN_READY` case means the surface behind it is
reachable by design in states we will hit.

---

### F8 — `expired` IS A DEAD REQUEST STATUS

`requests_status_check` permits `expired`. Nothing writes it — not in any of the 40+ functions whose
bodies mention `requests`, not in the API routes, not in the UI. `requests.invitation_expires_at` is
populated but no sweep reads it. `converted` is written by `redeem_invitation`, `create_gift` and
`schedule_lesson_session`; `contacted` is written only by a direct table UPDATE from
`LeadWorkDrawer`; `invited` only by `provision_client_invitation`.

Minor, but it is exactly the "a column nothing reads" class the standard asks for, and a lead that
was never followed up sits at `new` forever with no way to age out.

---

### F9 — AN EXECUTED DOCUMENT'S FROZEN BODY AND ITS LIVE PARTY ROW NOW DISAGREE

Evan's `RELEASE_PARTICIPANT` (`478c2e56-db82-4335-a261-69a64cab4863`):

- `document_parties` joined live to `contacts` reads **CLIENT = Evan LaBuzetta**, PARTICIPANT =
  Aubrey LaBuzetta. Structurally correct — this is D22 propagation working.
- The frozen `merged_body` reads:
  ```
  Printed Name: Aubrey LaBuzetta
  Signature:    Aubrey LaBuzetta
  Email:        evanlabuzetta@gmail.com
  Minor's Name: Aubrey LaBuzetta
  ```

**Evan's name appears nowhere on the document he signed.** The client and the minor are the same
name. Any staff screen that reads the *party rows* will show this as a normal guardian/minor
document; only opening the body reveals it. This is a general property of D22 — a contact rename
after execution silently desynchronises every executed body — and it is worth stating explicitly
because it is what makes this class of error invisible in a list view.

---

## 5. ⚠️ THE BLAST RADIUS — COUNTED

**Query** (run against production, read-only):

```sql
SELECT s.typed_name,
       c.first_name || ' ' || c.last_name AS signer_contact,
       s.party_role, s.signed_at::date,
       lower(btrim(s.typed_name))
         = lower(btrim(coalesce(c.first_name,'')||' '||coalesce(c.last_name,''))) AS ci_match
  FROM signatures s JOIN contacts c ON c.id = s.signer_contact_id
 ORDER BY ci_match, s.signed_at;
```

**Result: 71 signatures. 67 match case-insensitively. 4 do not — and all four are Evan's.**

```
     typed_name      |   signer_contact    | party_role |     d      | ci_match
---------------------+---------------------+------------+------------+----------
 Aubrey LaBuzetta    | Evan LaBuzetta      | CLIENT     | 2026-08-28 | f
 Aubrey LaBuzetta    | Evan LaBuzetta      | CLIENT     | 2026-08-28 | f
 Aubrey LaBuzetta    | Evan LaBuzetta      | CLIENT     | 2026-08-28 | f
 Aubrey LaBuzetta    | Evan LaBuzetta      | CLIENT     | 2026-08-28 | f
                     ... 67 rows with ci_match = t ...
```

**⚠️ AND THE NUMBER IS REALLY ZERO.** The naive query measures the typed name against the contact
record *as it reads today*. At the moment each of those four signatures was written,
`contacts.first_name` was **"Aubrey"** (§6). Measured against the record as it stood at signing time,
**every one of the 71 production signatures matches its signer case-insensitively, including Evan's.**

**Two consequences for the remediation:**

1. **This is one family, not a general repair.** There is no fleet of mis-signed documents to hunt.
2. **A strict server-side name check, applied retroactively, would not have caught this** — it would
   have *passed*, because the contact said Aubrey. The name check is still worth having (§9), but it
   is not the fix for this incident. **F1 and F2 are the fix.**

**Two case variants the rule must tolerate**, both already executed and both correct people:
`"Brian olenik"` (signer *Brian Olenik*) and three of `"Elisheva fiszer"` (signer *Elisheva Fiszer*).
**A case-sensitive rule would refuse both.** This is settled by copying `sign_release`'s existing
`lower(...) <> lower(...)` comparison.

**Attribution coverage**, same population: **21 of 71 signatures carry no `ip_address` and no
`user_agent`** — 1 from 2026-08-04, 16 from 2026-08-24, and Evan's 4. All 21 came through
`record_signature`; all 50 with attribution came through `sign_release` or the pre-2026-08-04 callers
(F4).

---

## 6. ⚠️ THE INCIDENT — SOLVED, TO THE SECOND

The brief poses two candidate explanations and asks which. **Neither is correct.** The third
possibility — that the wall held, the name check held, and both were fed a wrong name — is what
happened, and `audit_logs` proves it.

### The reconstruction

`audit_logs` carries `ip`, `user_agent`, `actor_user_id` and a full `old_value`/`new_value` diff for
every write. Every row below is Evan's own account
(`a1c2305c-d9eb-4598-89b7-6d4e5795da0a`) from **107.222.122.105**,
`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) … Chrome/152.0.0.0` — one desktop Chrome session
throughout, except where marked `node` (our own Vercel functions).

| Time (PDT) | What | Evidence |
|---|---|---|
| 20:37:59.649991 | `/sign/rider` #1. Contact + `clients` row created. **`first_name → "Aubrey"`** | `audit_logs` INSERT `contacts`, `ip 54.159.54.86 / node`; `signup_attempts` row `first_name = Aubrey` |
| 20:38:29.246593 | He activates the account from the email link | `audit_logs` UPDATE `contacts` + `clients`, his own browser IP. `profiles` created 20:38:29.246593 |
| 20:39:50 – 20:39:52.925 | **`/sign/rider` #2, with the correct name "Evan LaBuzetta"** | `signup_attempts` row `first_name = Evan`, `created_at 20:39:52.925476` |
| — | **The correction is discarded.** `fill_claimant_details` writes blanks only | `audit_logs` diff for 20:39:50.147171 and 20:39:50.515105 = **`updated_at` only** |
| 20:41:09.197248 | Onboarding step 1 saved: DOB, emergency contacts, and the **minor Aubrey created** | `audit_logs` UPDATE `contacts` (9 fields) + INSERT `contacts` `62d8b5f0…` at the same instant |
| 20:41:09.804811 | `generate_my_onboarding_documents` writes the 4 documents, merging **"Aubrey LaBuzetta"** into the CLIENT slot | 4× INSERT+UPDATE `documents`, same microsecond |
| 20:42:15 · 20:43:35 · 20:44:22 · 20:45:09 | Four signatures, **in `onboarding_order` 1→2→3→7**, 47–80 s apart | INSERT `signatures` ×4 |
| 20:45:17 – 20:45:23 | The combined executed-set email goes out | 12× INSERT `document_deliveries`, `ip 3.215.79.182 / node` |
| **20:45:41.219249** | **`first_name: Aubrey → Evan`** — 32 seconds after the last signature | `audit_logs` diff: `first_name: Aubrey -> Evan`, `family_sort_key: aubrey labuzetta -> evan labuzetta`, `actor_user_id` = Evan |

### Why this explains everything

`Onboarding.tsx`'s expected name comes from `getMyProfile()` → the `profiles` table
([api.ts:529-539](src/lib/api.ts#L529-L539)). `profiles.first_name` follows `contacts.first_name`
through a live trigger:

```
CREATE TRIGGER sync_profile_name_from_contact_trg
  AFTER UPDATE OF first_name, last_name ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION sync_profile_name_from_contact()
```

and `profiles.updated_at` for Evan is **`20:45:41.219249`** — the same microsecond as the contact's
`Aubrey → Evan` flip. So `profiles.first_name` was `"Aubrey"` from activation until 32 seconds after
he finished signing.

**Therefore, at the moment of each signature, `Onboarding.tsx:1412` rendered:**

> Type your name exactly as printed — **Aubrey LaBuzetta** — to sign

and `Onboarding.tsx:775`'s exact, case-sensitive gate **required that exact string**. He typed it. It
matched. He signed. The merged body he was reading said "Aubrey LaBuzetta" on the signature line, so
nothing looked wrong.

### Answering the brief's two candidates, explicitly

1. **"The wall was bypassed or not yet applied."** ❌ **No.** `apply_sign_path_documents` inserts
   `contact_required_documents` with the column default `'AT_LOGIN'`, and `/sign/rider`'s requirement
   set is exactly `COMPANY_POLICIES, FACILITY_RULES, HUMAN_EMERGENCY_MEDICAL, RELEASE_PARTICIPANT` —
   his four. `required_templates_for_contact` reads that same table, so the rows must have existed at
   20:41:09 or no documents would have been generated. Four unsatisfied `AT_LOGIN` rows ⇒
   `wall = true` ⇒ every route except `/app/onboarding` redirected. **The wall was up and it held.**
2. **"The documents were not `AT_LOGIN` at signing time and became so later."** ❌ **No, and it is
   also unfalsifiable from the row** — the brief is right that `contact_required_documents` has no
   timestamps (`contact_id, template_key, org_id, skipped_at, skipped_by, skip_reason, disposition`)
   and I confirmed **it carries no audit trigger** either. But it does not matter: `AT_LOGIN` is the
   column default, `apply_sign_path_documents` supplies no disposition, all 49 rows in production are
   `AT_LOGIN`, and nothing ever wrote a different value.
3. **The actual answer:** he signed **inside `/app/onboarding`**, through `signCurrent`, and the exact
   name gate **passed** because the printed name was his daughter's. Corroborated independently by
   the signing sequence — his four signatures follow `onboarding_order` (1, 2, 3, 7), which is
   `my_onboarding_state()`'s ordering and *not* `listMySignableDocuments()`'s (F5) — and by the two
   `update_my_onboarding_profile` calls at 20:41:09 and 20:45:41 that bracket the signing window.

### What instrumentation would have answered it faster

The attribution was never lost — `audit_logs` had it all along. What is missing is (a) the same
`ip`/`user_agent` **on the `signatures` row itself**, which `http_request_attribution()` supplies for
free (F4); (b) **any timestamp on `contact_required_documents`**, which is why candidate 2 can only
be excluded by inference rather than read directly; and (c) nothing distinguishes *which surface*
called `record_signature`, which cost most of the investigation. A `p_source` argument written to a
`signatures.source` column would have answered "which surface" in one query.

### ⚠️ Recommendation on Evan's four documents — RECOMMEND ONLY, NOTHING TOUCHED

**Supersede, do not void.** Under D32 supersession retains and voiding does not, and these four
documents are the only evidence that a guardian was walked through this flow and what he was shown.
They are also not *wrong about the facts they record*: Evan did consent, on that date, to those four
agreements, on behalf of that minor. What is wrong is the name printed in the CLIENT slot.

- **Supersede** — regenerate the four with the corrected contact and have him re-sign. The originals
  stay readable as the record of what happened; the current set names the right adult. Cost: he is
  asked to sign four documents again, which needs a sentence of explanation.
- **Void** — cleaner-looking, but destroys the only artefact of the defect and leaves a period where
  he was on the property with no executed release at all.

**This is the owner's ruling and it remains open.** Neither has been performed.

---

## 7. EVERY WAY INTO A SIGNATURE

Four functions write to `signatures`: `record_signature`, `sign_release`, `advance_document_workflow`
(status only) and `remove_my_signature` (withdrawal). Every user-facing path resolves to one of the
first two.

| # | Entry | Route | Auth | RPC | Method | Attribution | Name rule |
|---|---|---|---|---|---|---|---|
| 1 | `Onboarding.tsx` | `/app/onboarding` | member | `signMyDocument` → `record_signature` | `TYPED` | ❌ none | exact, case-sensitive, vs `profiles` |
| 2 | `DocumentsContent.tsx` | `/app/documents` **and** `/app/account` (`AccountHub.tsx:187`) | member | `signMyDocument` → `record_signature` | `TYPED` | ❌ none | **none** |
| 3 | `ContractPage.tsx` | `/app/contracts/:id` | member/staff | `lock_and_sign_contract` → `record_signature` | `TYPED` | ❌ none | **none** |
| 4 | `SigningPanel` / `SignPartyRow` | `/app/ops/documents/:id` (`DocumentViewerPage`) | **staff** | `recordSignature` → `record_signature` | `TYPED` | ❌ none | **none** |
| 5 | `Release.tsx` | `/release`, `/release/:releaseKey` | ⚠️ **anonymous** | `/api/sign-release` → `sign_release` | `KIOSK_TYPED` | ✅ via `http_request_attribution()` | case-insensitive, **server-enforced** |
| 6 | `DocsParticipantFlow.tsx` | `/docs/release-participant` | ⚠️ **anonymous** | `/api/sign-release` ×4 → `sign_release` | `KIOSK_TYPED` | ✅ | case-insensitive, **server-enforced** |

**Reachable unauthenticated:** entries 5 and 6, plus the RPCs `sign_release` and
`sign_general_release`, both granted to `anon` — that is the designed kiosk behaviour, and both
enforce the name check server-side.

⚠️ **`record_signature` and `remove_my_signature` are also granted to `anon`** and should not be.
Both begin with `v_signer := current_contact_id()` (`SELECT p.contact_id FROM profiles WHERE
p.user_id = auth.uid()`), which is `NULL` for `anon`, so both raise `'no contact for the signing
account'` and are not exploitable. But an anonymous EXECUTE grant on the function that seals
signatures is one policy change away from mattering, and this was already flagged once by
`TASK-CLOSEOUT` (2026-08-19) and never actioned.

**Not a signing entry:** `/sign/*` and `/sign` create accounts and send email; they never sign.
`ConfirmNameModal` writes `contacts` only. `/redeem`, `/activate`, `/activate/complete` never sign.

---

## 8. THE CORRIDOR, AND WHAT EACH FRONT DOOR DOES DIFFERENTLY

### The flow map, in prose

**Initiation A — public request, approved by staff.** A visitor completes a form on the website
(`/contact`, `/lessons`, `/questions`, the booking pages) → `submit_public_request` writes a
`requests` row at `new` and fires the inbound staff alert. Staff open `/app/dashboard`, see the lead
in the leads band, click **Review**, and `LeadWorkDrawer` opens over the dashboard. There they take
call notes, mark contacted, agree a lesson time, and press the one button that does everything:
`ProvisionClientForm(source="submission", requestId)` → `/api/admin-send-invitation` →
`provision_client_invitation(p_request_id)`. **That single RPC is the approval**: it creates or finds
the contact, creates the `clients` row and the standing categories, converts the request's draft
purchase to `awaiting_payment`, logs an `order/submitted` event, assigns the onboarding documents,
mints the invitation, flips `requests.status → 'invited'` and resolves the inbound alert. The
`INVITATION` email goes out via the shared `sendInvitationEmail` helper with
`registerUrl = {origin}/activate?token={token}`, and its copy expands to carry the agreed lesson
time, the offering label and a checklist. Click → `/activate` → `Register.tsx` → `redeem_invitation`
→ lands `/app?welcome=1` → **the wall redirects to `/app/onboarding`.**

**Initiation B — the company creates the account.** Identical from `ProvisionClientForm` onward. The
only differences are upstream: the form is reached from `/app/ops/accounts/new` (`AccountInvitePage`,
`source="new"`), from a contact's dossier (`ContactDossierModal`, `source="contact"`) or from
`Admin.tsx`, and there is no `requestId`, so nothing flips a request. Same RPC, same email template,
same link shape, same landing, same wall. **The code already makes no other distinction — this half
of the owner's requirement is met.**

**Initiation C — the client self-serves.** `/sign` presents five cards; each leads to
`/sign/{path}`. The form collects first name, last name, mobile and email (+ confirm), with the full
address optional except on `/sign/deal` where it is required and a partial address is refused
everywhere — **D22 §0, respected exactly, and not touched by this report.** POST →
`/api/sign-start` → rate-limit on `sha256(ip|user-agent)` → **the same `provision_client_invitation`**
→ `fill_claimant_details` → `apply_sign_path_documents(path)` → **the same `sendInvitationEmail`**
with the same `/activate?token=` link. The `deal` path instead calls `find_claimable_contract` and
`invite_contract_counterparty`, and sends `CONTRACT_INVITE`. Click → `/activate` → same landing →
**same wall → `/app/onboarding`.**

**The corridor itself**, once anyone clicks: `AppLayout` pins them to `/app/onboarding`, and
`Onboarding.tsx` runs a single step machine —
`order → details → horse → shop → sign → payment → slots → done` — driven by `my_onboarding_state()`.
`order` appears when there is a purchase; `horse` when `horse_needed`; `shop` when signing finished
with nothing bought; `slots` when a `recurring` line has an unchosen standing time. A waiting
contract outranks the wizard entirely and forwards to `/app/contracts/:id/start`.

### Where the three actually diverge

**Everything after the click is already identical.** Same provisioning RPC, same email template, same
link, same landing, same wall, same wizard. Four real differences remain, and only one is a defect:

| Difference | A (approved request) | B (company creates) | C (`/sign/*`) | Verdict |
|---|---|---|---|---|
| Email copy tokens | agreed time + offering label + checklist + contract title | offering label + checklist | **none of them — the bare "Welcome" body** | ✅ **allowed** — the owner said only the copy changes. But C's email is thinner than it needs to be; it could carry the checklist for free. |
| What assigns the paperwork | `provision_client_invitation(p_template_keys)`, staff-chosen, defaulted from the cart via `request_onboarding_categories` | same | **`apply_sign_path_documents(path)`** from `sign_path_document_requirements` | ✅ **correct and deliberate** — OFFERINGDOCS 2026-08-24. Both are owner-editable tables. Not a divergence in the corridor. |
| A request is flipped to `invited` | ✅ | n/a | ❌ — a self-serve signup never touches `requests` | ✅ correct; there is no request. |
| **Whose name is captured** | staff type the *client's* name, from a phone call | staff type the *client's* name | ⚠️ **the visitor types a name with no indication whose it should be** | ❌ **F1 — the only real divergence, and it is the whole incident.** |

**So the owner's model is already 90% built.** The corridor is one corridor. What is not true yet is
that the three doors collect the same *quality* of fact: two of them have a human on the phone
disambiguating who the account holder is, and the third has a text box.

---

## 9. THE MERGE — WHAT SURVIVES AND WHAT MUST TRAVEL

**`Onboarding.tsx` is the incumbent and survives.** It is the wall's only destination, the only
sequenced flow, the only one with the minor step, the only one with real e-sign consent capture, and
the only one that shows the signer a name to match.

**`DocumentsContent` is NOT retired.** §3's premise that these are two corridors is wrong (§3 of this
report): `DocumentsContent` is unreachable while the wall is up, so it is not a competing corridor —
it is **the member's document library**, which also happens to have a signing box bolted on. Retiring
the page would throw away the library. **Retire the box, keep the page.**

| Capability | Today | After |
|---|---|---|
| Paginated in-app reader (`PaperViewer`) | `DocumentsContent` only | **stays** on `DocumentsContent`; **add** to Onboarding's sign step (it currently renders the body in a `max-h-[28rem]` scroller — a 30-page release in a 448px window on a phone) |
| **Download signed PDF** | `DocumentsContent` only | **stays**; **add** to Onboarding's `done` step |
| **Email me a copy** (with `executed_email_sent_at`) | `DocumentsContent` only | **stays**; not needed in Onboarding (the combined set email already fires) |
| Contract deep-link | both — `DocumentsContent` → `/app/contracts/:id`, Onboarding → `/app/contracts/:id/**start**` | **converge on `/start`** — the gate asks for missing party fields first, which is strictly better and already Onboarding's behaviour |
| E-sign consent capture | Onboarding only (real checkbox) | **required on every surface** — F6 |
| Name match | Onboarding only | **moves to the server** — §10 |
| Minor / guardian step | Onboarding only | **stays**, and gains a partner at the front door (§10 R1) |
| Wall-return destination | Onboarding only | stays |
| One combined executed-set email | Onboarding (DB trigger holds the set) | stays |
| The inline **name box + Sign button** | `DocumentsContent`, `ContractPage`, `SignPartyRow` | ⚠️ **D32 — behind a flag, never deleted.** `DocumentsContent`'s box goes behind `MEMBER_INLINE_SIGN_ENABLED = false`, and every unsigned row deep-links into the corridor instead. `ContractPage` and `SignPartyRow` keep theirs — they are the *only* way to sign a contract and the *only* way staff sign for the company — but both gain the server name check and real consent capture. |

**Nothing in §3's table is lost.** Two things move *into* Onboarding (the reader, the PDF download),
one converges on the better of two implementations (the deep-link), and one control is flagged off
rather than removed.

---

## 10. THE NAME RULE

### Where it belongs: the server. It already exists there.

**R-NAME.** Add to `record_signature`, immediately after the existing party check and before the
`INSERT`, exactly what `sign_release` line 60 already does:

- Resolve the expected name from the **signer's own contact record**
  (`contacts.first_name || ' ' || contacts.last_name` for `v_signer`).
- Compare **case-insensitively**, on trimmed, whitespace-collapsed strings.
- Raise on mismatch, with a message that names the expected string so the UI can show it.
- **The company-signer branch is exempt** — when `v_is_company_signer` is true the human types *their
  own* name on the company's behalf, deliberately, and `v_signer` has been reassigned to the faceless
  company contact. Comparing there would break every company signature.

### How tolerant

**Case-insensitive, whitespace-normalised, and nothing more.** Specifically:

- `lower(regexp_replace(btrim(x), '\s+', ' ', 'g'))` on both sides.
- ✅ Accepts `"Brian olenik"` for *Brian Olenik* and `"Elisheva fiszer"` for *Elisheva Fiszer* — **the
  four already-executed signatures the brief requires the rule to account for.** Verified against the
  live rows: all four pass a case-insensitive comparison and all four fail a case-sensitive one.
- ✅ Accepts `"Melanie O'Mea-Smith"` with the curly apostrophe already in the data — punctuation is
  compared, not stripped, and the stored contact carries the same character.
- ❌ No accent folding, no punctuation stripping, no nickname or initial matching. Each of those
  would let a *different* person's name pass, which is the failure this rule exists to prevent.
- ⚠️ **Do NOT make it case-sensitive.** `Onboarding.tsx`'s current exact comparison is the strictest
  rule in the codebase and it is the one to *relax*, not the one to copy — it would have refused two
  existing, legitimate, executed signatures.

### What it does about `"Brian olenik"`

**Nothing. It accepts it, and that is the correct outcome.** Brian Olenik typed his own name with a
lowercase O. A rule that refuses a real person their own signature over letter case is a worse
failure than the one being fixed, and it would have blocked 4 of the 71 signatures in production —
5.6% of everything ever signed here. **Nothing is done to the existing rows.**

### ⚠️ And the rule would not have caught Evan

Stated plainly because it decides the build order: at signing time his contact **was** "Aubrey
LaBuzetta", so the server check would have passed. **R-NAME is worth doing — it closes four
unchecked surfaces and makes the three false comments true — but it is a hardening measure, not the
fix for this incident.** The fix is R1 and R2.

---

## 11. ORDER CONFIRMATION AND PAYMENT

### What the screens contain today

**The order screen** — `ActivationOrderPanel`, rendered at
[Onboarding.tsx:912](src/pages/app/Onboarding.tsx#L912) when `step === 'order'`:
the order's `display_code`; every `order_item` with its label and price; a **"Scheduled"** section
listing each booking via `listOrderBookings(purchaseId)`; a **Continue** button; and a **"Notify
staff this isn't correct"** button that calls `report_order_incorrect`, reports **how many humans it
actually reached**, and — correctly — never blocks the client either way.

**The payment screen** — `OrderPayment` at
[Onboarding.tsx:1577](src/pages/app/Onboarding.tsx#L1577): the amount, the two live methods (Zelle
with tap-to-copy rows and a QR code, and cash), "I've sent it" with an optional confirmation number,
and an "I'll pay later — finish" bypass. **No order line items and no booking information** — only a
prose sentence and a link to `/app/calendar`.

### ⚠️ The no-booking-yet case is already handled, and handled well

[ActivationOrderPanel.tsx:118-121](src/components/app/ActivationOrderPanel.tsx#L118-L121):

```
{bookings.length === 0 ? (
  <p>Nothing is on the calendar yet — we will confirm the timing with you.</p>
) : ( … )}
```

and per-booking, `whenText()` returns **"Time to be confirmed"** when `starts_at` is null. The file's
own header states the rule: *"⚠️ NO BOOKING IS INVENTED. … An empty booking list says the timing will
be confirmed — it never implies a held date."* **This requirement is met. Do not rebuild it.**

### Recommended placement

**Keep it on the order screen, and add a compact repeat to the payment screen.** The owner said
either is acceptable; both is better here for one specific reason — the order step and the payment
step are separated by the entire signing sequence, which for a four-document set is several minutes
of reading. By the time someone reaches payment they have not seen their booking for a while, and
payment is the moment they most want to confirm what they are paying for.

The repeat should be **the same component, read-only**: order lines, then the same "Scheduled" block
with the same empty state, above the Zelle/cash panel. Reuse `ActivationOrderPanel`'s booking section
rather than writing a second renderer (D18) — a second implementation of "what is on the calendar for
this order" is exactly how this repo grows a third one.

### One ordering divergence to put to the owner

The owner's Initiation A sentence is *"onboarding.tsx is surfaced for doc signing, **then**
confirmation of order contents, adjustments on their end if desired, and **then** payment."* The
code's order is **confirmation first, then details/horse/signing, then payment** — which follows
CAREPATH §C9, also his: *"'order' is the FIRST screen after sign-in."*

Both are his words, from different sessions. **I have not changed the sequence.** Adding the summary
to the payment screen satisfies the spirit of the later sentence without reordering a step machine
that three other tasks depend on — but ORCH6 should get an explicit ruling.

---

## 12. THE PLAN

Ordered. **Independence is marked because ORCH6 schedules from this.**

### Phase 1 — the incident's actual cause. Independent of everything else.

**R1 — Ask whose name it is, at the front door.** ⟂ independent
`SignStart.tsx` gains, above the name fields, the question the flow has always needed and never
asked: *"Who will be riding?"* → **Me** / **My child** (and on `/sign/horse`: *"Whose horse is it?"*).
Choosing "my child" splits the form into **Your details** (the account holder — the person we email,
invoice and hold to the agreement) and **The rider's details** (first name, last name, date of birth).
`/api/sign-start` passes the minor through to `provision_client_invitation`, which attaches the minor
exactly as `update_my_onboarding_profile` does today. The chooser cards
([SignChoose.tsx:38-70](src/pages/SignChoose.tsx#L38-L70)) are re-worded away from the pure first
person — *"I'm here to ride"* → *"Riding lessons"*, with the body copy carrying "for you or your
child".
**⚠️ This is not a D22 §0 violation.** The recorded refusal is about backing the per-path field set
with `form_definitions` and turning it into a question-and-answer engine. This adds **one radio and
two name fields to a hardcoded constant in the page**, which is precisely the shape D22 §0 protects.

**R2 — A repeat submission from the same door may correct itself.** ⟂ independent, but lands with R1
`/api/sign-start` gains a narrow, explicit exception to blanks-only: when a `signup_attempts` row
already exists for this email **and** the contact has never been edited by staff (no
`audit_logs` row with a staff `actor_user_id`), a differing name **updates** the contact, and the
send-state screen says so — *"We've updated your name to X."* Staff-maintained records keep their
current absolute protection.

**R3 — Onboarding shows the account holder their own name and offers to fix it.** ⟂ independent
Above the sign step, one line: *"You're signing as **Evan LaBuzetta**. Not right? Fix it"* → the
existing `ConfirmNameModal`, which already writes `contacts` via `confirm_my_legal_name` and already
propagates to `profiles` through `sync_profile_name_from_contact_trg`. **The component exists, the
RPC exists, the trigger exists.** This is a mount and a link. It is the last catch before signature
and would have stopped the incident on its own.

### Phase 2 — harden the engine. All three touch `record_signature`; **they must land together.**

**R4 — The name check moves to the server.** 🔗 with R5, R6
Per §10. One migration, `CREATE OR REPLACE record_signature`, copying `sign_release`'s comparison.
⚠️ **`DROP + CREATE` resets function ACLs — use `CREATE OR REPLACE`** (TASK-ORIGIN, 2026-08-27), and
while in there, **revoke EXECUTE from `anon`** on `record_signature` and `remove_my_signature` (F3/§7).

**R5 — Attribution is captured server-side.** 🔗 with R4
`SELECT a.ip, a.user_agent INTO v_ip, v_ua FROM http_request_attribution() a;` as the fallback when
`p_ip`/`p_user_agent` are null — the same line `sign_release` line 106 already runs. Every future
signature carries its own IP and user-agent.

**R6 — E-sign consent stops being a literal.** 🔗 with R4
`DocumentsContent`, `ContractPage` and `SignPartyRow` gain a real checkbox; `record_signature` refuses
`p_esign_consent = false` for a member self-signing (staff-facilitated and company-side signing keep
today's behaviour). ⚠️ Do this in the **same** deployment as R4 or the new server check will start
rejecting signatures from surfaces that have not yet been updated.

**R7 — Delete the three false comments.** ⟂ independent, do it with R4
`Onboarding.tsx:773`, `ConfirmNameModal.tsx:15`, `ContractPage.tsx:2240`, plus
`ops/api-client.ts:125`. After R4/R5 three of them become *true* and should be rewritten to say what
is actually enforced; the fourth is simply wrong.

### Phase 3 — the corridor's remaining seams

**R8 — One signing order.** ⟂ independent
`listMySignableDocuments` orders by `coalesce(onboarding_order, 99), template_key` to match
`my_onboarding_state`, with a deterministic tiebreak (`generated_at DESC, id`) so an equal-timestamp
batch never returns in arbitrary order (F5).

**R9 — Retire the inline member sign box behind a flag.** ⟂ independent, after R8
`MEMBER_INLINE_SIGN_ENABLED = false` in `DocumentsContent`; unsigned non-contract rows deep-link to
`/app/onboarding`, unsigned contract rows to `/app/contracts/:id/start`. **D32 — flagged, never
deleted.**

**R10 — Carry the reader and the PDF download into the corridor.** ⟂ independent
Per §9.

**R11 — The order summary and the booking repeat on the payment screen.** ⟂ independent
Per §11, reusing `ActivationOrderPanel`'s booking section.

**R12 — Walk Initiation A once, end to end.** ⟂ independent — **do this first, before any build**
Six requests sit at `contacted`. The approval path exists (§1.2) and has never been completed. One
walk from a real `requests` row through `LeadWorkDrawer` to an activated account will find whatever
is actually broken in A, which no amount of reading will.

### Phase 4 — deferred, needs a ruling

**R13 — The wall gains a server-side counterpart.** Blocked on a ruling: whether
`record_signature` should refuse an out-of-corridor signature while `AT_LOGIN` documents are
outstanding, or whether the wall stays advisory. My recommendation is **advisory** — R9 removes the
surface that made it matter, and a server wall would make it impossible for staff to help a member
who is stuck. Flagging it rather than deciding it.

---

## 13. TEST CRITERIA

Numbered, provable, per fix. **Nothing here may be proven by the absence of an error.**

1. **R1** — In the shimmed browser harness, load `/sign/rider`, choose "My child", submit with account
   holder *Test Parent* and rider *Test Child (DOB 2015-01-01)*. **Prove:** `contacts` has a row
   `first_name='Test'/last_name='Parent'` with the submitted email, and a **second** row
   `Test Child` with `guardian_contact_id` pointing at the parent and `date_of_birth = 2015-01-01`.
   Paste both rows.
2. **R1** — Same run, load `/sign/rider` with "Me". **Prove:** exactly one `contacts` row is created
   and no `guardian_contact_id` is set anywhere. (Regression: the split must not fire for a
   self-serving adult.)
3. **R2** — Submit `/sign/rider` twice with the same email and different first names, no staff edit
   between. **Prove:** `contacts.first_name` equals the **second** submission, and `audit_logs` shows
   an UPDATE whose diff contains `first_name: <first> -> <second>`.
4. **R2** — Repeat, but staff-edit the contact between the two submissions. **Prove:** the staff value
   survives and the `audit_logs` diff for the second submission contains **only** `updated_at`.
5. **R3** — In the harness, reach `/app/onboarding` `step === 'sign'` as a member whose contact name
   differs from a document's printed name. **Prove:** the "You're signing as X — not right? Fix it"
   line renders (assert on the emitted node, not on the component's props), the modal opens, and
   after confirming, `contacts` **and** `profiles` both carry the new name — proving
   `sync_profile_name_from_contact_trg` fired.
6. **R4** — Against a PGlite copy of the schema, `SELECT record_signature(<doc>, 'CLIENT', 'Wrong
   Person', …)` as a member whose contact reads *Test Client*. **Prove:** it raises, and paste the
   exception text.
7. **R4** — Same call with `'test client'` (lowercase). **Prove:** it **succeeds** and the row is
   sealed. This is the `"Brian olenik"` case and it must pass.
8. **R4** — Replay all 71 production `(typed_name, signer_contact_name)` pairs **as they stood at
   signing time** through the new comparison. **Prove: 71 of 71 accepted.** Paste the count.
9. **R4** — `SELECT r.rolname FROM … aclexplode(proacl) …` for `record_signature` and
   `remove_my_signature`. **Prove:** `anon` is absent, `authenticated` is present.
10. **R5** — Sign one document through the harness. **Prove:** the new `signatures` row has non-null
    `ip_address` **and** `user_agent`, and the user-agent matches the harness's Chromium string.
11. **R6** — Attempt a member self-sign with `p_esign_consent = false`. **Prove:** it raises. Then
    with `true`. **Prove:** an `esign_consents` row exists for that `(contact, document)`.
12. **R8** — For a contact with four documents generated in one statement (identical `generated_at`),
    call `listMySignableDocuments` ten times. **Prove:** the same order every time, and that it equals
    `my_onboarding_state()`'s order. Paste both sequences.
13. **R9** — With the flag `false`, render `/app/documents` for a member with an unsigned
    non-contract document. **Prove:** no `input` with the sign label is in the emitted DOM, and a link
    to `/app/onboarding` is.
14. **R11** — Render the payment step for an order **with** a booking and **without** one. **Prove:**
    the first shows the formatted date; the second shows *"Nothing is on the calendar yet"* and **no**
    invented date string.
15. **R12** — Take one of the six `contacted` requests through `LeadWorkDrawer`. **Prove:**
    `requests.status = 'invited'`, the purchase moved to `awaiting_payment`, a `status_events` row
    `order/submitted` exists, an `invitations` row was minted, and `signup`/`invitation` delivery was
    recorded. Paste all five.

---

## 14. SUCCESS, AT TWO LEVELS

**Per fix** — each of the 15 criteria above passes, with its row, its exception text or its emitted
node pasted into the build report. No fix is done because it compiled.

**For the area as a whole** — three things become true that are not true today:

1. **A parent can sign their child up for lessons and end with their own name on the agreement and
   their child's name in the participant slot.** Today the only way to get that outcome is to notice
   the mistake yourself, mid-flow, and know to go back and edit your details — which Evan did, 32
   seconds too late.
2. **There is one place a member signs.** Every other name box is either flagged off, or is the sole
   route to something the corridor does not cover (a contract, a company signature, a walk-in kiosk),
   and every one of them enforces the same rule because the rule lives in the database.
3. **Every signature carries who signed it, from where, on what, having consented.** The 21 rows with
   no attribution become the last 21, and the next incident is answerable from the `signatures` table
   instead of by reconstructing it from `audit_logs`.

---

## 15. FLAGGED, NOT FIXED

| # | Item | Route to |
|---|---|---|
| 1 | ⚠️ **Evan's four executed documents — supersede vs void.** Recommendation and trade-off in §6. **Owner's ruling, still open. Nothing touched.** | **OWNER** |
| 2 | ⚠️ **The order-confirmation vs signing sequence** — two owner statements disagree (§11). Code follows CAREPATH §C9. | **OWNER** |
| 3 | ⚠️ **R13 — should the wall be enforced server-side?** My recommendation is no; it needs a decision. | **OWNER** |
| 4 | `requests.status = 'expired'` is never written and `invitation_expires_at` is never read (F8). Requests are `Admin.tsx`/records territory. | **TASK-AR2** |
| 5 | `LeadWorkDrawer` and `ProvisionClientForm` need edits for R1's minor payload to reach `provision_client_invitation` from the staff side too. Both are AR2's surfaces. | **TASK-AR2** |
| 6 | `/app/ops/intake` is still `INTAKE_PAGE_RETIRED = true`; the lead workflow lives only in the dashboard band. Noted, not a defect. | **TASK-AR2** |
| 7 | D22 propagation desynchronises executed `merged_body` from live party rows on any contact rename (F9). Affects every executed document, not just this corridor. | **ORCH6** — needs its own thread |
| 8 | `Onboarding.tsx` is 1,651 lines with an eight-state machine, and every fix in this report touches it. Decomposition is not in my scope but is the reason this file keeps colliding. | **ORCH6** |
| 9 | `contact_required_documents` has no timestamps and no audit trigger — which is why §6's candidate 2 can only be excluded by inference. Adding `assigned_at`/`disposition_changed_at` would close it permanently. | **ORCH6** |
| 10 | `record_signature` has no way to record **which surface** called it. A `p_source` argument + `signatures.source` column would have answered §6 in one query. | **ORCH6** |

---

## 16. CONTENDED FILES

Everything a build from this report would need to edit. **⚠️ = shared with a named neighbour.**

| File | Fixes | Contention |
|---|---|---|
| [src/pages/SignStart.tsx](src/pages/SignStart.tsx) | R1 | mine alone |
| [src/pages/SignChoose.tsx](src/pages/SignChoose.tsx) | R1 | mine alone |
| [api/sign-start.ts](api/sign-start.ts) | R1, R2 | mine alone |
| [src/pages/app/Onboarding.tsx](src/pages/app/Onboarding.tsx) | R3, R7, R10, R11 | ⚠️ large, single-file, four fixes — **serialise these four**, do not parallelise |
| [src/components/app/ConfirmNameModal.tsx](src/components/app/ConfirmNameModal.tsx) | R3, R7 | mine alone |
| [src/components/app/DocumentsContent.tsx](src/components/app/DocumentsContent.tsx) | R6, R9, R10 | ⚠️ also rendered by `AccountHub.tsx` — **TASK-AR5** owns the account page |
| [src/pages/app/AccountHub.tsx](src/pages/app/AccountHub.tsx) | R9 (mount only) | ⚠️ **TASK-AR5** |
| [src/pages/app/ContractPage.tsx](src/pages/app/ContractPage.tsx) | R6, R7, R9 | ⚠️ 2,500 lines; likely touched by the deal/contract threads |
| [src/components/ops/documents/SignPartyRow.tsx](src/components/ops/documents/SignPartyRow.tsx) | R6 | mine alone |
| [src/components/ops/documents/SigningPanel.tsx](src/components/ops/documents/SigningPanel.tsx) | R6 | mine alone |
| [src/lib/ops/api-client.ts](src/lib/ops/api-client.ts) | R6, R7, R8 | ⚠️ broadly imported |
| [src/lib/api.ts](src/lib/api.ts) | R7 (comment) | ⚠️ broadly imported — **every AR thread** |
| [src/components/app/ActivationOrderPanel.tsx](src/components/app/ActivationOrderPanel.tsx) | R11 (extract the booking section) | mine alone |
| [src/components/order/OrderPayment.tsx](src/components/order/OrderPayment.tsx) | R11 | ⚠️ also used outside onboarding |
| [src/components/app/LeadWorkDrawer.tsx](src/components/app/LeadWorkDrawer.tsx) | R1 staff side, R12 | ⚠️ **TASK-AR2** |
| [src/components/app/ProvisionClientForm.tsx](src/components/app/ProvisionClientForm.tsx) | R1 staff side | ⚠️ **TASK-AR2** |
| **new migration** — `record_signature` v7 | R4, R5, R6, + `anon` revokes | ⚠️ **one migration, all four** — `CREATE OR REPLACE`, never `DROP` |
| **new migration** — `provision_client_invitation` minor passthrough | R1 | ⚠️ canonical spine, used by three callers |

**Parallel-safe:** R1+R2 (`/sign/*` + its API) can run entirely alongside R4–R7 (the engine). They
share no file.
**Must serialise:** R3, R7, R10, R11 all edit `Onboarding.tsx`.
**Must land together:** R4, R5, R6 — one migration and the three surfaces it will start rejecting.

---

## 17. TEARDOWN

No dev server, watcher or long-lived `psql` session was started. Every database read was a
single-shot `psql -c`, SELECT only. **No `BEGIN`/`ROLLBACK` was needed — no mutation was tested.**
Pamela Godde's live lease (`7adcd08f-fd5d-40f9-b726-634074266d7c`) was read once in an aggregate over
`document_parties` and not otherwise touched.

**Process census after the work:**

```
$ pgrep -fl 'psql|vite|node .*dev|chromium' ; echo "exit=$?"
exit=1        # no matches — nothing left running
```

**Worktree** `/Users/cactai/Downloads/claude-code-repo/wt-ar7` · **branch** `task/ar7` ·
**committed:** this report only · **not pushed.**
