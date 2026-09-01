# TASK-AR7 — ONE onboarding flow, three ways in

⚠️ **READ `docs/method/ADMIN-REVIEW-ANALYSIS-STANDARD.md` FIRST.** ⚠️ **§2's state matrix is the heart
of this task** — the whole defect is that identical people get different flows depending on how they
arrived. **You are writing a report. You are fixing nothing.**

⚠️ **THIS RUNS BEFORE THE 12 ZONE SWEEPS AND BEFORE ORCH6 STARTS ITS BUILD PASS**, at the owner's
direction, so that ORCH6 *"inherits a working repo not one that has this gaping issue."*

---

## 1. THE REQUIREMENT, IN THE OWNER'S WORDS

> *"we need to make it so one onboarding flow exists, with multiple ways it is initiated but not
> accessed."*

⚠️ **"INITIATED BUT NOT ACCESSED" IS THE WHOLE DESIGN IN FOUR WORDS.** Many front doors. **One
corridor.** Today there are at least four corridors — see §3 — and they disagree about whether a
signature needs the signer's name.

### Initiation A — public order request, approved by staff
> *"the user completes a website order request and we approve it and then trigger an email with the
> approval notice and link to onboarding for their initial login and the onboarding.tsx is surfaced
> for doc signing, then confirmation of order contents, adjustments on their end if desired, and then
> payment."*

⚠️ **Approval creating the order is CR-27, LOCKED, with ten validation criteria — and today NOTHING
in the system can approve a request.** A request has ten stages and every one ever created sits at
the first. **So initiation A cannot currently run at all. Say so plainly and scope what it needs.**

**The order-confirmation step must show the calendar assignment when one was made:**
> *"for that sequence we should have selected the calendar assignment for the order and if so we show
> that in the order confirmation shown to the client before we show the payment page or on the
> payment page, not sure what we are showing and what it contains but either are acceptable and must
> play nice with a scenario where the calendar booking hasnt happened yet."*

⚠️ **Either placement is acceptable — he said so. What is NOT optional is the no-booking-yet case.**
**Report what the confirmation and payment screens currently contain**, then recommend a placement.

### Initiation B — the company creates the account
> *"the company creates the account, optionally adds an order to it and sends the invitation email to
> the client, same things plays out from the time they click the link, only the email copy will change
> if there is no order to a generic account activation notification vs combined order approval with
> account activation as in the previous initiation sequence."*

⚠️ **The ONLY difference between A and B is the email copy.** Everything after the click is identical.
**If the code makes any other distinction, that is a finding.**

### Initiation C — the client self-serves through `/sign/*`
> *"the client uses the url /sign/* link to create their account, trigger the email to themself and
> retrieve the link, click it, and from there the onboarding flow needs to follow the same path as the
> others."*

## 2. ⚠️ HIS SUSPECT — AND THE EVIDENCE POINTS ELSEWHERE. TEST IT, DO NOT INHERIT IT.

> *"this last flow is what likely broke the system, it is the most recent update and likely where the
> duplicate flow as created. Either way, whether im right or wrong is inconsequential."*

⚠️ **CREATION DATES ARE THE WRONG MEASURE, AND THE OWNER CORRECTED ME ON IT:** *"yes the intial
links were made before the updates that made them usable."* **A path becomes a suspect when it starts
working, not when its file appears.**

| Surface | Created | ⚠️ Made usable |
|---|---|---|
| `Release.tsx` | 2026-07-02 | — |
| `DocsParticipantFlow.tsx` | 2026-07-07 | — |
| **`SignStart.tsx` + `api/sign-start.ts`** | 2026-08-04, *"additive"* | ⚠️ **2026-08-11 · 08-15 · 08-20 · 08-24** — five substantive rounds, incl. `2c8687a6` *"/sign/\* assigned no documents on production"* and `37d4c4cf` *"/sign becomes a chooser… shows the real send state"* |
| **`DocumentsContent.tsx`** | 2026-08-07, by ⚠️ **`TASK-ACCOUNTSURFACE` Phase 2 — a LAYOUT task, "all account rows expand in place"** | — |

**So both candidates are live and neither is excluded:**
- ⚠️ **`DocumentsContent` was split out of `AccountPanels.tsx` by a task about layout, and the name
  rule did not travel with it.** A signing surface created as collateral from a layout change.
- ⚠️ **`/sign/*` was still being made to work through 24 August** — after `DocumentsContent` existed —
  so anything it changed about account activation, document assignment or where a first login lands
  could have reshaped the corridor around it.

⚠️ **DO NOT INHERIT EITHER STORY. The owner is explicit that attribution is inconsequential** —
*"Either way, whether im right or wrong is inconsequential"* — **and the sweep is what settles it.**
⚠️ **`git log` on a FILE is not evidence of when a PATH started working. Read the commits, and check
what each round changed about activation, assignment and landing.**

## 3. WHAT IS ALREADY KNOWN — verified 2026-08-29/30. Re-verify, then go further.

**FOUR signing surfaces exist, and they disagree:**

| Surface | Name check | Shows the expected name |
|---|---|---|
| `Onboarding.tsx:775` | ⚠️ **EXACT** — `typedName.trim() === expectedName`, from the signer's own `profiles` row | no |
| `Release.tsx:176` | case-insensitive | ✅ yes |
| `DocsParticipantFlow.tsx:156` | case-insensitive | ✅ yes |
| ⚠️ **`DocumentsContent.tsx`** | ⚠️ **NONE** | ⚠️ **no — the label is only "Type your full legal name to sign"** |

⚠️ **AND THE SERVER ENFORCES NOTHING.** `record_signature` checks only that the string is non-empty:
`IF nullif(btrim(coalesce(p_typed_name,'')),'') IS NULL THEN RAISE EXCEPTION 'a typed name is
required to sign'`. **There is no comparison to the signer or the party.**
⚠️ **`Onboarding.tsx:773` claims otherwise in a comment — *"record_signature enforces it server-side;
we gate the button the same way"* — and that is FALSE.** Four client-side implementations of one rule,
one of them missing, and a comment asserting a server guarantee that does not exist.

**NEITHER MAJOR SURFACE IS A SUPERSET OF THE OTHER.** ⚠️ **This is a MERGE, not a deletion:**

| Only in `Onboarding.tsx` | Only in `DocumentsContent.tsx` |
|---|---|
| e-sign consent capture | a paginated in-app reader |
| the name match | **Download signed PDF** |
| the minor / guardian step — *"a minor never signs"* | **Email me a copy** (with sent-at) |
| the wall-return destination | ⚠️ **contract deep-link to `/app/contracts/:id`** — *"one signing entry point per contract (audit M-7)"* |
| ONE combined email delivering every executed doc | |

⚠️ **`DocumentsContent` passes `true` for e-sign consent as a LITERAL rather than capturing it.**
⚠️ **The contract deep-link is a real design decision that exists only in the surface that should not
exist. Retiring it outright would throw it away.**

**THE WALL.** `AppLayout.tsx:1550` redirects any member with gating documents to `/app/onboarding`.
`contact_document_wall_state` counts `crd.disposition = 'AT_LOGIN'` — ⚠️ **note the header comment:
it WAS `ct.wall_gating`, a template property, and is now the assignment's disposition.**

## 4. ⚠️ THE LIVE INCIDENT THIS TASK EXISTS TO EXPLAIN

**Evan LaBuzetta** (`be678bba-9b03-473a-b53c-ea313fbccf7e`) is guardian to **Aubrey**
(`62d8b5f0-d35e-4d1e-93bd-bc79cc92b5be`, DOB 2016-12-03, no email, no login). **The guardian link is
correctly set.** Four documents — `COMPANY_POLICIES`, `FACILITY_RULES`, `RELEASE_PARTICIPANT`,
`HUMAN_EMERGENCY_MEDICAL` — are EXECUTED, each with **two parties**: Aubrey as `PARTICIPANT`, Evan as
`CLIENT`. **Structurally correct.**

⚠️ **All four signatures read `typed_name = "Aubrey LaBuzetta"`, signed by Evan's account in the
`CLIENT` role.** He was shown an unlabelled name box beside a document naming Aubrey throughout.

⚠️ **AND THE CONTRADICTION YOU MUST RESOLVE:** all four assignments are `disposition = 'AT_LOGIN'`,
so **the wall should have held him in `Onboarding.tsx`** — which derives the expected name from his
own profile and **would have refused "Aubrey LaBuzetta".** **He signed somewhere else anyway.**

⚠️ **The evidence that would settle it is missing: his signatures carry NO user-agent and NO IP**,
though `record_signature` accepts both and the calling surface passes `null`. **That is itself a
finding.**

**Two candidate explanations. Determine which, with evidence:**
1. The wall was bypassed or not yet applied when he signed.
2. The documents were **not** `AT_LOGIN` at signing time and became so later —
   ⚠️ **`contact_required_documents` has NO timestamps, so this is not recoverable from the row.
   Say so if you cannot prove it rather than guessing.**

⚠️ **The shimmed browser harness (`test/browser/README.md`) is the honest way to test the wall** —
real page, real Chromium, PGlite behind it. **Do NOT use the production-login probe.**

**COMPARISON CASE:** Brian / Gabriella Olenik are the same guardian-minor shape, same four documents,
signed `"Brian Olenik"` — and one reads **`"Brian olenik"`, lowercase**, which a strict server check
would refuse. ⚠️ **Any name rule you propose must account for that already-executed signature.**

## 5. WHAT YOUR REPORT MUST PRODUCE

1. ⚠️ **THE COMPLETE FLOW MAP** — for each of A, B and C: what creates the account · what sends the
   email and with what copy · what the link contains · what the first login hits · every stage after
   it (signing → order confirmation → adjustment → payment) · and **where the three diverge.**
   **In prose. This is the deliverable the owner asked for.**
2. **EVERY WAY INTO A SIGNATURE** — surfaces, routes, RPCs, and public links. **The four in §3 are a
   starting point, not the answer.** Include anything reachable unauthenticated.
3. **THE CORRIDOR** — what the single flow is, and **what each front door does differently** (per the
   owner: only the email copy).
4. **THE MERGE** — which surface survives, and **every capability that must be carried across** so
   nothing in §3's table is lost. ⚠️ **Name anything you would retire and what retires it (D32:
   behind a flag, never deleted).**
5. **THE NAME RULE** — where it belongs (⚠️ **the server, so no surface can skip it**), how tolerant,
   and what it does about `"Brian olenik"`.
6. **THE INCIDENT** — how Evan reached an unchecked surface, or an honest statement that it cannot be
   determined and what instrumentation would have answered it.
7. ⚠️ **THE BLAST RADIUS — COUNT IT.** How many production signatures carry a `typed_name` that does
   not match their signer's contact record? **This number decides whether the remediation is one
   family or a general repair. Run the query and paste it.**
8. **ORDER CONFIRMATION AND PAYMENT** — what those screens contain today, where the calendar
   assignment should appear, and ⚠️ **how it behaves when no booking has been made.**

## 6. TRAPS

⚠️ **CR-27 IS LOCKED AND INITIATION A DEPENDS ON IT.** Approving a request IS creating the order.
**Nothing can approve one today.** Do not design around that — **name it as the blocker it is.**

⚠️ **D22 §0 IS A RECORDED REFUSAL.** `/sign/*`'s per-path field set is a deliberate constant in the
page: *"i did not intend to invite this type of question and answer set into my life."* **Do not
propose backing it with `form_definitions`.** Name + email + phone are the minimum on every path; the
full address is required on `/sign/deal` only; **a partial address is refused everywhere.**

⚠️ **A MINOR NEVER SIGNS** (`Onboarding.tsx:71`), and **D8** governs which documents attach to whom.

⚠️ **EXECUTED DOCUMENTS ARE EVIDENCE.** ⚠️ **Recommend, do not perform.** Whether Evan's four are
superseded or voided is **the owner's ruling and it is still open.** Under D32 supersession retains;
voiding does not. **Give a recommendation with the trade-off; touch nothing.**

⚠️ **`TASK-AR2` IS RUNNING NOW** and owns `Admin.tsx` and the client-record surfaces; **`TASK-AR3`**
owns the Records decomposition. **You own the onboarding corridor and the signing surfaces.** Where
you need something in their territory, **report the diff and name the task.**

## 7. OUT OF SCOPE

Building anything · fixing Evan's documents · the nav sections (AR4/AR5) · the calendar's own defects
(AR1) — ⚠️ **but the calendar ASSIGNMENT shown at order confirmation IS yours.**

## 8. REPORT

`docs/reports/TASK-AR7-REPORT.md`, standard §4 shape, plus §5's eight items above.
Worktree `wt-ar7`, branch `task/ar7`. **Commit the report only. Do not push.**
