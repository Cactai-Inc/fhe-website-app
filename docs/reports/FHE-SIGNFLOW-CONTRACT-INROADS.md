# CONTRACT INROADS — what we actually have, and what we do not yet understand

**Written by `FHE-DSNR-SIGNFLOW`, 2026-09-01, at the owner's direction, after it got this wrong three
times.** 🔒 **THIS FILE AUTHORISES NO CHANGE. It exists so the next thread starts from measured
ground instead of from my guesses.**
**Read alongside:** `docs/reports/FHE-DSNR-SIGNFLOW-HANDOFF.md` · `docs/reports/FHE-DSNR-SIGNFLOW-LEDGER.md`.

---

# 1. 🔒 THE OWNER'S CONCERNS — verbatim, and they are the brief

> *"this needs more research because there is a set of inroads to contracts that accommodate both when
> there is an account and when the signer doesnt have their account activated with auth yet. dont want
> to bungle the whole thing and multiple entry points to the same document doesnt make sense the way
> youve said they exist, so we need to fully understand what we are looking at before taking action."*
> — owner, 2026-09-01

**And the two rulings this sits inside, both his, both still in force:**

> *"the ways to get to a signable doc are the self driven account activation via website order
> submission, /sign/* url, and manual account creation with docs required, and then the manual
> provisioning of the docs being required is another way and then if an account places an initial
> order for something that requires docs to be signed and they dont have them signed and linked to
> their account the system generates the flow for them to sign them on the next app login. all of
> those should result in the user being taken to the same flow that a person clicking the email link
> that comes from using the /sign/* flow. the others can be removed. we dont have a situation where a
> person without an account signs documents on an ipad or any other way."* — 2026-09-01

> *"we dont use docs/release-participant nor /release, those urls if they are still operational should
> be traced and most likely anything associated with them should be decommissioned and the /sign/ flow
> should be the single pathway we use and just have different ways of getting there to accommodate the
> various scenarios/places/events a client would be served with the link to it."* — 2026-09-01

## ⚠️ WHAT THE CONCERN IS, RESTATED SO IT CANNOT BE LOST
🔒 **The apparent "multiple entry points to one document" are most likely NOT duplication. They are
most likely ONE design that branches on the signer's AUTH STATE** — has an account · has a contact but
no account · has an account but has never activated auth. **Every removal proposal so far has failed
to distinguish those, and each time the owner caught it.**
⚠️ **THEREFORE: nothing about contract inroads is removed, merged or "converged" until the matrix in
§4 is filled in from the database.**

---

# 2. ⚠️ WHAT I GOT WRONG — retracted in full, so nobody builds on it

**Four claims went into a spec and a handoff. All four were wrong. Each was a code READ reported as a
finding, and in each case the answer was in a comment I had not read.**

| # | I claimed | What is actually true |
|---|---|---|
| 1 | `Register.tsx` "picks four destinations", so `/sign/*` has two endings — a divergence | **ONE rule.** `src/pages/Register.tsx:33-42`: *"⚠️ P1 ITEM 1 — THE INVITATION SAYS WHERE TO GO, NOT THE URL."* The branches implement it |
| 2 | the two endings "converge one step later" via `Onboarding.tsx:907` | **Backwards.** `src/pages/app/Onboarding.tsx:898-907` forwards to the contract **only when `!s.needed`** — only when there is NO paperwork. They **divide** by what is outstanding. It is the owner's own P1 ITEM 2 ruling, 2026-08-25: *"on activation she sees the contract"* |
| 3 | door 4 may email a bare `/app/onboarding` to someone with no account → a login wall | **Handled explicitly.** `api/documents-requested.ts:98-101` sends **nothing**: *"No login yet → nothing to send. They meet the documents when they activate."* The requirement and the in-app notification are still written first, in one transaction |
| 4 | 🔒 **`?kind=contract` is "the OLD two-email path", a legacy duplicate to retire** | ⚠️ **WRONG, AND THIS IS THE ONE THE OWNER CALLED OUT.** It is the **has-an-account branch of a deliberate two-branch design.** `api/contract-invite.ts:17-25`, verbatim: *"HAS AN ACCOUNT → invite_contract_counterparty + CONTRACT_INVITE, unchanged. **This is a real case and that path serves it well.** HAS NO ACCOUNT → invite_contract_party_account … **Neither `redeem_contract_invitation` nor the CONTRACT kind is removed;** they simply stop being used for people who have no account."* |

⚠️ **On #4 I quoted `Register.tsx:35` — *"the OLD two-email path"* — and read "OLD" as "deprecated."
It means "the path that used to require TWO emails."** **The sentence continues into what replaced it
*for people with no account*, not into a deprecation.** **`api/contract-invite.ts` is the file that
decides between them, and it keeps both on purpose.**

🔒 **Lesson recorded, and it governs the next thread too: read the comment block above the code before
reporting anything about the code. This repo documents its own rulings inline.**

---

# 3. WHAT IS ESTABLISHED — measured from the code, 2026-09-01. ⚠️ Re-verify; none of it is walked.

## 3a. 🔒 THE STRUCTURAL FACT THAT EXPLAINS THE WHOLE DESIGN
**`redeem_contract_invitation` REFUSES AN ANONYMOUS CALLER.**
`supabase/migrations/20260820T0940_partyemail_p4b_regenerate_on_open_and_redemption.sql:172`:
```
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in before redeeming an invitation'; END IF;
```
**Same guard in `20260810T1200_sendguard_no_invite_after_signature.sql:114` and
`20260817T1800_partyrole_the_counterparty_signs_and_nothing_else.sql:78`.**

⚠️ **THEREFORE A `&kind=contract` LINK PRESUPPOSES THAT AN ACCOUNT CAN BE SIGNED INTO.** **That single
fact is why there are two branches, and it is the axis the whole matrix in §4 turns on.**
`api/contract-invite.ts:11-14` says exactly this: *"The reason there were two is structural, not
cosmetic: `redeem_contract_invitation` requires an already signed-in user whose email matches, so the
CONTRACT link assumes the account exists."*

## 3b. THE STAFF SENDER BRANCHES ON ACCOUNT STATE — correctly, and two ways
**`api/contract-invite.ts:112-118`** — *"`profiles` IS the account … Two ways to be linked to one: the
contact is the profile's contact, or the address itself already signs in. **Both are checked because a
counterparty contact created for a contract may not be linked yet even though the person has been a
member for a year.**"*
- `hasAccount` **true** → `invite_contract_counterparty` → `/activate?token=…&kind=contract` (`:191`)
- `hasAccount` **false** → `invite_contract_party_account` → `/activate?token=…` **with no `kind`**
  (`:136-138`), the document read **off the invitation row, never off the URL**

## 3c. A THIRD RULE, ADDED BY THE OWNER ON 2026-09-01, ON THE PUBLIC DOOR
**`api/sign-start.ts:319-334`**, carrying his words after his own test was rejected at the password step:
> *"the input of the email address should trigger an email to them that says click here to sign into
> your account. and the link takes them to the login page since they already have an active account
> with auth set up."*

**So `/sign/*` has its own account-state branch:** `accountStateForEmail(email).state === 'active'` →
**a SIGN-IN email, no invitation, no activation link.** *"Minting a claim token for somebody who
already holds the credential is precisely what produced that rejection."*

## 3d. THE POST-LINK LANDING IS ONE RULE
`src/pages/Register.tsx:33-53` and `src/pages/RegisterComplete.tsx:86-106`:
**the invitation says where to go** — `document_id` present → the contract via the
`/app/contracts/:id/start` gate; otherwise paperwork → `/app/onboarding`; otherwise `/app`.
**`?kind=contract` redeems through `redeem_contract_invitation` instead, which links the party contact
without granting community membership** (`Register.tsx:25-26`, Update A / spec G).
**`Register.tsx:104-116` additionally rescues an already-signed party clicking a dead link.**

---

# 4. 🔒 WHAT IS NOT UNDERSTOOD — THE MATRIX. This is the research.

**Every row must be filled from the DATABASE and a WALK, not from reading.**

| Inroad | Sender | Branches on auth state? | Link emitted | Redeem path |
|---|---|---|---|---|
| staff → contract page → invite counterparty | `api/contract-invite.ts` | ✅ **yes**, `hasAccount`, checked two ways (`:112-118`) | `&kind=contract` **or** plain `/activate` | `redeem_contract_invitation` **or** `redeem_invitation` + carried `document_id` |
| `/sign/deal` (**public**) | `api/sign-start.ts:232-278` | ⚠️ **NOT ESTABLISHED — see §4a** | **always `&kind=contract`** (`:278`) | `redeem_contract_invitation` |
| `/sign/guest\|rider\|horse\|rider+horse` | `api/sign-start.ts:319+` | ✅ yes — active account → sign-in email; else provision | sign-in link **or** plain `/activate` | `redeem_invitation` |
| website order submission | `api/request-activation.ts:119` | ❓ not examined | plain `/activate` | `redeem_invitation` |
| staff provisioning | `api/admin-send-invitation.ts:310` | ❓ not examined | plain `/activate` | `redeem_invitation` |
| staff → request documents | `api/documents-requested.ts` | ✅ yes — `has_account` false → **sends nothing** (`:98-101`) | `/app/onboarding` | n/a |
| order approved → wall | trigger `purchases_assign_documents` | n/a — they are already in the app | n/a | n/a |

## 4a. ⚠️ THE ONE THING THAT LOOKS INCONSISTENT — AND IT IS A HYPOTHESIS, NOT A FINDING

**`api/sign-start.ts`'s branch order is:**
```
if (allowed && isDeal)                                  → find_claimable_contract → &kind=contract
else if (allowed && orgId && account is 'active')        → sign-in email
else if (allowed && orgId)                               → provision_client_invitation
```
🔒 **The `isDeal` branch is evaluated FIRST and never consults `accountStateForEmail`.** **So a deal
claimant receives `&kind=contract` regardless of whether they have an account** — while
`contract-invite.ts`, which mints **the same invitation**, branches on exactly that.

**And `api/sign-start.ts:263-266` asserts something §3a puts in question:**
> *"Activation redeems it through `redeem_contract_invitation`, which promotes the contact to an
> account and lands them on the document."*

⚠️ **`redeem_contract_invitation` raises `'sign in before redeeming an invitation'` when `auth.uid()`
IS NULL (§3a). It does not create an account.**

🔒 **BUT THAT DOES NOT MEAN IT IS BROKEN, AND I AM NOT CLAIMING IT IS.** **At least three things could
make it correct, and NONE has been checked:**
1. **`find_claimable_contract` may only ever match a contact that already has an account.** ⚠️ **Read
   the function. This is the first thing to check and it may end the question.**
2. **`/activate` renders the REGISTRATION FORM first.** A person could create the account on that
   page, and `redeemByKind` (`Register.tsx:44`) runs only after auth — so the sequence may simply
   work, with the comment loosely worded rather than wrong.
3. **The deal door may be reachable only by someone staff already provisioned**, making the no-account
   case unreachable in practice.

⚠️ **THE TEST THAT SETTLES IT — and it is one walk:** *take an email with **no** account, that
`find_claimable_contract` matches, submit `/sign/deal`, and follow the emailed link to the end.*
**Either they land on the document, or they do not. Everything above is speculation until that runs.**

## 4b. THE OTHER QUESTIONS, IN ORDER
1. **What are ALL the auth states?** ⚠️ **The owner named one I have not modelled: *"has their account
   activated with auth"* — an account that EXISTS but has never completed auth.** **`profiles` vs
   `auth.users` vs a redeemed invitation are not the same fact.** 🔒 **Enumerate the real states from
   the schema before classifying any inroad.**
2. **What does `accountStateForEmail` actually return, and how many states?** It is used in
   `sign-start.ts` and returns `.state === 'active'` — **what are the others, and does anything else
   use it?**
3. **`invite_contract_party_account` vs `invite_contract_counterparty`** — what does each write, and
   how does `redeem_invitation` land on the document when the invitation carries `document_id`?
4. **Is there any inroad to a contract not in §4's table?** ⚠️ **`document_parties` +
   `document_party_controls` may admit a party who was never invited at all.**
5. **Only after 1–4:** is anything genuinely duplicated? 🔒 **The answer may be NO — that is the most
   likely outcome and it must be an acceptable one.**

---

# 5. 🔒 WHAT MUST NOT HAPPEN
- ⚠️ **NO REMOVAL, MERGE OR "CONVERGENCE" OF ANY CONTRACT INROAD** until §4 is filled from the database
  and a walk. **The owner has stopped this three times.**
- ⚠️ **`?kind=contract` IS NOT RETIRED.** **It is a live, deliberate branch** (§2 #4).
- ⚠️ **Do not treat §4a as a defect.** **It is a hypothesis with a named test. Run the test.**
- ⚠️ **Do not reason from production emptiness.** `docs/reference/FLOW-MAP.md:159` records that exact
  error being made and withdrawn on this same subject.
- 🔒 **The owner's *"the others can be removed"* refers to `/release` and `/docs/release-participant`
  — `TASK-SIGNFLOW-D`, which touches none of the files here.**

# 6. RECOMMENDATION TO `ORCH` — and it is a recommendation, not a decision
🔒 **THIS IS `DISCO` WORK, NOT `TASK` WORK.** The owner said *"we need to fully understand what we are
looking at before taking action"* — **understanding is step 1-2 of the six-step method, which is
`DISCO`'s.** ⚠️ **A build thread handed this will produce a change, because that is what build threads
do.** **Suggested: `FHE-DISCO-INROADS`, taking this file as its starting point, emitting
`docs/reports/FHE-DISCO-INROADS-HANDOFF.md`, and changing no code.**
**`TASK-SIGNFLOW-A`, `-B`, `-C` and `-D` are unaffected and remain dispatchable** — none of them
touches a file in §4's table.
