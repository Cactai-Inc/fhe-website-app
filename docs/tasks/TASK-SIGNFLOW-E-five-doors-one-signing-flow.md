# TASK-SIGNFLOW-E — five doors, one signing flow. Prove it, then close the gaps.

**Spec by `FHE-DSNR-SIGNFLOW`, 2026-09-01. Owner directive, same day — see §1.**
**Thread name: `FHE-TASK-SIGNFLOW-E`.**
**Independent of `A`, `B`, `C` and `D` — no file overlap until §7, and §7 only runs on what §5 finds.**

🔒 **THIS IS A WALK, NOT A BUILD. Its deliverable is EVIDENCE, and the repair is whatever the evidence
demands — which may be nothing.** ⚠️ **Everything in §1 already appears to be BUILT.** **The repo's
worst habit is concluding a feature is missing because production is empty**
(`docs/reference/FLOW-MAP.md:159`, finding X9, withdrawn for exactly that error). **Do not repeat it.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` · `docs/method/CLNR-ROLE.md` §3 · `docs/method/THE-RUNNING-RECORD.md`
>   (open `docs/reports/FHE-TASK-SIGNFLOW-E-LEDGER.md` FIRST).
> - `CLAUDE.md` **D17** (`:365`) — reachable and correctly named. 🔒 **This task IS D17.**
> - `CLAUDE.md` **D18** (`:376`) — never a second path beside a correct one. ⚠️ **The owner is asking
>   for exactly D18 applied to signing ENTRY.**
> - `CLAUDE.md` **D31** (`:731`) — tags enable, they do not obligate; obligation is COMPUTED from what
>   was purchased.
> - 🔒 `supabase/migrations/20260901T1120_the_sign_path_survives_to_the_first_page_after_auth.sql` —
>   **read it in full.** It is yesterday's work on this exact seam, it names where the path lives
>   (`invitations.categories`, **not** `groups`), and it records a production probe.
> - `supabase/migrations/20260824T1300_offeringdocs_disposition_moves_onto_the_assignment.sql` —
>   **`disposition` is the mechanism.** `:13` says it plainly: *"AT_LOGIN — must be signed before they
>   get into the app (the wall)"*.
> - `supabase/migrations/20260824T1600_offeringdocs_documents_arrive_when_the_order_opens.sql`.
> - `docs/reference/FLOW-MAP.md` · `docs/reference/SURFACE-INVENTORY.md`.

---

## 1. THE OWNER'S WORDS — this is the whole specification

> *"the ways to get to a signable doc are the self driven account activation via website order
> submission, /sign/* url, and manual account creation with docs required, and then the manual
> provisioning of the docs being required is another way and then if an account places an initial
> order for something that requires docs to be signed and they dont have them signed and linked to
> their account the system generates the flow for them to sign them on the next app login. **all of
> those should result in the user being taken to the same flow that a person clicking the email link
> that comes from using the /sign/* flow.** the others can be removed. we dont have a situation where
> a person without an account signs documents on an ipad or any other way."*
> — owner, 2026-09-01

🔒 **FIVE DOORS. ONE DESTINATION. THE `/sign/*` EMAIL LINK'S DESTINATION IS THE CANON.**

| # | The door, in his words | Where DSNR traced it, 2026-09-01 |
|---|---|---|
| 1 | self-driven account activation via **website order submission** | `src/lib/api.ts:143` `submitRequest` → `POST /api/request-activation` → `provision_client_invitation` (`api/request-activation.ts:119`). ⚠️ Its own header (`:1`) says *"a website order submission gets the SAME"* |
| 2 | **`/sign/*` URL** | `POST /api/sign-start` → `provision_client_invitation` (`api/sign-start.ts:357`) → `${origin}/activate?token=…` (`:410`) |
| 3 | **manual account creation with docs required** | `src/components/app/ProvisionClientForm.tsx` → `POST /api/admin-send-invitation` → the same RPC (`:310`) → `/activate?token=` (`:367`, `:470`) |
| 4 | **manual provisioning of the docs being required** | `src/components/app/ClientRecordActions.tsx:718` → `POST /api/documents-requested` → ⚠️ its email link is **`${origin}/app/onboarding`** (`api/documents-requested.ts:116`) — a DIFFERENT URL from doors 1–3 |
| 5 | an **initial order requiring docs** → *"the system generates the flow for them to sign them on the next app login"* | **the SIGNING WALL.** `myWallState()` → `src/components/app/AppLayout.tsx:1548-1568`, `:1693`. Fed by `contract_role_documents.disposition = 'AT_LOGIN'`, the column **default** (`20260824T1300…sql:19`) |

## 2. 🔒 WHAT THE CANON ACTUALLY IS — one rule, and a LEGACY path beside it

⚠️ **AN EARLIER DRAFT OF THIS SPEC SAID `Register.tsx` "picks four destinations" and called that a
divergence. THAT WAS WRONG and is struck.** **Read the code, not the earlier claim.**

**`src/pages/Register.tsx:33-42` states the rule in its own words:**
> *"⚠️ P1 ITEM 1 — THE INVITATION SAYS WHERE TO GO, NOT THE URL. … document_id present → the contract,
> via ITEM 2's gate; no document_id → the existing landing rule. The gate at `/app/contracts/:id/start`
> decides for itself whether anything is actually missing and forwards straight to the document when
> nothing is, so a complete record never sees an interstitial."*

🔒 **That is ONE rule with branches, not four destinations.** And the branch that sends someone to a
contract instead of the wizard is **the owner's own ruling**, recorded at
`src/pages/app/Onboarding.tsx:898-907` (P1 ITEM 2, owner 2026-08-25): *"a counterparty claims her
account and 'on activation she sees the contract'."* ⚠️ **It fires only when `!s.needed`** — when there
is **no** onboarding paperwork. **So paperwork and a waiting contract do not compete; the flow divides
by what is actually outstanding.** **That is correct behaviour and is NOT in scope to change.**

### 🔒 2a. THE ONE REAL FINDING — `?kind=contract`, a SECOND live path the code itself calls OLD
**`src/pages/Register.tsx:35-36`, verbatim:**
> *"`?kind=contract` is the OLD two-email path (a counterparty who already has an account). The unified
> send issues an ACCOUNT invitation carrying `document_id`, so after the claim we route on what the
> invitation carries."*

⚠️ **BUT IT IS STILL BEING SENT, BY TWO ENDPOINTS:**
- `api/contract-invite.ts:191` — `${origin}/activate?token=${token}&kind=contract`
- 🔒 **`api/sign-start.ts:278` — the `/sign/deal` branch. A door the owner named as canonical is
  emitting the path its own successor calls OLD.**

**And the same file knows better twenty lines earlier** — `api/contract-invite.ts:136`:
> *"NO `&kind=contract`: this is the ACCOUNT claim, and the document it…"*

🔒 **SO `contract-invite.ts` CONTAINS BOTH THE OLD PATH AND ITS REPLACEMENT, AND CHOOSES BETWEEN
THEM.** ⚠️ **That is D18 — a second path beside a correct one — and it is what the owner meant by
*"the others can be removed."*** **It reaches `redeemContractInvitation` instead of
`redeemInvitation` + the carried `document_id`, so the two paths redeem differently and land
differently.**

**This is the substantive work in this task. §7 owns it.**

## 3. THE INCUMBENT, NAMED (D18) — everything below already exists

🔒 **DO NOT BUILD A ROUTER, A DISPATCHER, A "SIGNING ENTRY SERVICE", OR A SECOND WALL.**
**Four pieces already do this job, and your task is to prove they cover all five doors:**

1. **`provision_client_invitation`** — the one spine RPC. **Doors 1, 2 and 3 all call it**
   (`api/request-activation.ts:119`, `api/sign-start.ts:357`, `api/admin-send-invitation.ts:310`).
   ⚠️ **Three endpoints, one RPC. That convergence is already built; confirm it, do not rebuild it.**
2. **`/activate?token=` → `Register` / `RegisterComplete`** — the one post-email landing.
3. **`contract_role_documents.disposition`** — `AT_LOGIN` | `WITH_CONTRACT` | `WHEN_READY`
   (`src/lib/admin.ts:799`), **defaulting to `AT_LOGIN`** (`20260824T1300…sql:19`).
   `AT_LOGIN` is defined in that migration as *"must be signed before they get into the app (the wall)"*.
4. **The signing wall** — `myWallState()`, `AppLayout.tsx:1544-1568` and `:1693`.
   ⚠️ **It FAILS CLOSED by design** (`:1550-1554`): `myWallState()` throws rather than returning a
   permissive default, *"so a transient failure can no longer silently drop the wall."* **Do not
   weaken that.**

## 4. THE TRAPS
- 🔒 **T1 — EMPTY IS NOT A FINDING** (`docs/method/TASK-ROLE.md` §3). ⚠️ **`FLOW-MAP.md:159` records
  this exact error being made and withdrawn:** the guest flow was declared unbuilt *"reasoned from
  production emptiness — no contact holds the guest set."* **It existed.** 🔒 **A door with zero
  production rows is NOT a broken door. Walk it; do not count it.**
- 🔒 **T2 — THE PATH DOES NOT LIVE IN `groups`.** Yesterday's migration proves it on production in a
  rolled-back transaction: a brand-new self-service signup has **no** `groups` rows, because
  `apply_affiliations()` derives them from executed documents, purchases and horses — none of which a
  new signup has. ⚠️ **`my_standing_categories()` reads `groups` and will be EMPTY for exactly the
  people this task is about.** **The path lives in `invitations.categories` and
  `invitations.document_id`.** **Gating anything on categories reintroduces the AR7/FIX1 incident.**
- **T3 — door 4's no-account case IS handled. Do not "fix" it.** ⚠️ **An earlier draft of this spec
  claimed a person with no account gets a bare `/app/onboarding` link and hits a login wall. FALSE.**
  `api/documents-requested.ts:98-101`:
  > *"// No login yet → nothing to send. They meet the documents when they activate."*
  > `if (!out.has_account || !out.email) return res.status(200).json({ …, emailSkipped: 'no account yet' });`
  **No email is sent at all.** 🔒 **The requirement and the in-app notification are still written
  first, by the RPC, in one transaction** (`api/documents-requested.ts:16-21`) — **so the documents are
  waiting when they activate.** **Confirm this; do not repair it.**
- **T4 — door 5's chain is NAMED END TO END. Your job is to prove it FIRES, not to find it.**
  ⚠️ **An earlier draft called it "schema-level evidence" and named the wrong table. Struck.**
  **The real chain, `20260824T1600_offeringdocs_documents_arrive_when_the_order_opens.sql`:**
  `trg_documents_when_order_opens()` (`:95`) → trigger **`purchases_assign_documents`** on `purchases`
  (`:150-151`), on the **draft → open** transition **staff perform when they approve an order** —
  *"the same transition credits mint on (D23), so 'what you owe' and 'what you got' appear together
  and cannot disagree about when the order became real"* → `apply_offering_documents()` (`:58`) →
  🔒 **`INSERT INTO contact_required_documents (contact_id, template_key, org_id, disposition)`
  (`:73`)** → `my_wall_state()` → `AppLayout.tsx:1704-1707`, a hard
  `<Navigate to="/app/onboarding" replace />`.
  ⚠️ **THE TABLE IS `contact_required_documents`, NOT `contract_role_documents`.** **Confirm which one
  `my_wall_state()` actually reads** — `20260824T1310_offeringdocs_wall_state_carries_the_asked_for_set.sql`
  — **because a mismatch there is the one thing that would break this door silently.**
  🔒 **Prove the TRIGGER FIRES on production, not that the code is correct.**
- **T5 — do not weaken the wall to make a walk pass.** If the wall blocks you, that is the wall
  working. **Clear the documents; do not disable it.**
- **T6 — `/release` and `/docs/release-participant` are NOT doors.** `TASK-SIGNFLOW-D` is retiring
  them. ⚠️ **They are "the others" in his sentence. Do not test them, do not count them, and do not
  edit their files — `D` owns them and you will collide.**
- **T7 — do not report the tangential** (CR-94). **One line under "flagged, not fixed."**

## 5. 🔒 PHASE 1 — WALK ALL FIVE DOORS. This is the deliverable.

**For EACH of the five doors in §1, produce, with `file:line` and observed behaviour:**
1. **What a person clicks**, from where, as which identity.
2. **What is written** — the invitation, its `categories`, its `template_keys`, the
   `contract_role_documents` rows and their `disposition`.
3. **What is emailed**, and **the exact URL in the link**.
4. 🔒 **WHERE THEY LAND**, following the link through to a rendered page.
5. **Whether that is the same place door 2 lands.** ⚠️ **If not: is it a defect, or a legitimate
   second ending (§2)?** **State which and why.**

**Then answer, in one table:**
- 🔒 **Do all five converge? YES / NO, per door.**
- **For every NO: is it a MISSING LINK, a WRONG DESTINATION, or a DIFFERENT-BY-DESIGN ending?**
- ⚠️ **Which doors did you walk against a real environment, and which did you only READ?**
  **Say so honestly per door.** **A read is evidence; it is just weaker evidence, and mislabelling it
  is how a wrong premise reaches the next thread wearing a proof's authority.**

## 6. THE QUESTIONS THAT GO UP — do not answer them yourself
**Put them at the TOP of your report.** ⚠️ **`docs/method/TASK-ROLE.md`: a task thread emits a question
or a report.**
⚠️ **THE "DEAL ENDING" QUESTION AN EARLIER DRAFT ASKED HERE IS STRUCK — §2 answers it from the code
and from the owner's own P1 ITEM 2 ruling. Do not re-ask it.**
- **Q1 — only if §7 finds that `?kind=contract` cannot be removed cleanly.** State exactly what still
  depends on it and the smallest change that would retire it. ⚠️ **Do not leave it in place silently
  and do not remove it if something real still needs it — ASK.**
- **Q2 — only if §5 finds a door that lands nowhere usable.** State the door, what happens today, and
  the smallest change that would fix it. ⚠️ **Do not build it without an answer.**

## 7. 🔒 PHASE 2 — RETIRE `?kind=contract`, and repair only what else Phase 1 proved broken

**This half is NOT conditional. §2a is a measured finding, not a hypothesis, and it is the owner's
*"the others can be removed"* applied where it actually bites.**

1. **Prove what still depends on it.** `grep -rn "kind=contract\|isContractInvite\|redeemContractInvitation" src api`
   — DSNR counted **two senders** (`api/contract-invite.ts:191`, `api/sign-start.ts:278`) and the
   consumer branches in `Register.tsx` (`:27`, `:44`, `:110`, `:158`, `:293`, `:303`, `:389`) and
   `RegisterComplete.tsx:91`. ⚠️ **Re-run it; there may be more.**
2. **Establish whether the unified send covers every case the old one did.** `contract-invite.ts:136`
   says the ACCOUNT claim carries the document instead. 🔒 **The old path exists for "a counterparty
   who ALREADY HAS AN ACCOUNT" — prove the unified path handles that person**, including the
   already-signed case `Register.tsx:104-116` currently rescues.
   ⚠️ **If it does not, STOP and ask (Q1). Removing a rescue path for someone whose signature is
   already on file would be worse than the duplication.**
3. **If it does: stop SENDING it first** — both senders switch to the account invitation carrying
   `document_id`. **That alone ends the divergence**, and it is separately revertable.
4. **Then remove the consumer branches**, leaving `redeemContractInvitation` itself in place if
   anything server-side still calls it. ⚠️ **Check before deleting.**
5. ⚠️ **`redeem_contract_invitation` is a DB function. Do not drop it** (D32). **Code only.**

**And, for anything ELSE Phase 1 proved broken:**
🔒 **NO SPECULATIVE FIXES. Doors 1–5 are traced by name (§1, §3, T3, T4) and are expected to be
sound.** ⚠️ **"All five converge, here is the proof, and the legacy path is gone" is the expected
complete result.**

**If a door IS broken, the repair is bounded by:**
- 🔒 **Use the incumbents in §3.** ⚠️ **A new door must call `provision_client_invitation` and land on
  `/activate?token=`, or set `disposition` and let the wall do it.** **Never a sixth mechanism.**
- **The smallest change that makes the existing machinery reach.** **A missing call site, a wrong URL
  in an email template, an unset `disposition` — those are the shapes this defect takes here.**
- ⚠️ **Any DB change is additive** (D32). **No column drops, no row deletion.**
- 🔒 **Do NOT touch the wall's fail-closed behaviour** (`AppLayout.tsx:1550-1554`).

## 8. OUT OF SCOPE
- 🔒 **REMOVING ANY ENTRY PATH OTHER THAN `?kind=contract`.** ⚠️ **`/release` and
  `/docs/release-participant` belong to `TASK-SIGNFLOW-D`.** **If your walk finds yet another way to
  reach a signable document, REPORT IT — one line — and remove nothing.** **What looks like a stray
  path is usually one of the five wearing a different name.**
- **`/release`, `/docs/release-participant`, `api/sign-release.ts`** — `D`'s files.
- **Colour** — `C`'s. **The token resolver** — `A`'s. **The normalize spine** — `B`'s.
- **Redesigning `/app/onboarding`.** ⚠️ **You are proving people REACH it, not changing it.**
- **The offering→document rules.** Settled: *docs come from the offering, not the tag*
  (`20260824T1220_offeringdocs_the_last_edge_from_tag_to_document.sql`). **Not reopened here.**

## 9. THE REACH AND THE TELL (D19)
**THE REACH is the entire subject of this task** — §5 answers it door by door.
**THE TELL:** ⚠️ **the person who needs the tell here is the one who signed up and was shown nothing to
sign.** **They see no error; they land on `/app` and everything looks fine.** 🔒 **That silence is
exactly why this must be walked rather than reasoned about.**
**UNDO:** any Phase 2 repair is one revert; nothing here deletes data.

## 10. THE TEST THIS MUST PASS
⚠️ **Renders are NOT verified by you** (`docs/method/TASK-ROLE.md` §3). **Items 6–10 are the numbered
checklist you hand the owner, and it must name the phone.**

1. 🔒 **The five-door table from §5 is in your report**, each row carrying `file:line`, the emailed
   URL, the landing page, and **WALKED or READ**.
2. **The §6 questions are at the TOP**, with evidence.
3. **Every door's write is proven from the DATABASE** — the invitation row, its `categories`, the
   `contract_role_documents` rows and their `disposition`. ⚠️ **Not from the code that should have
   written them.**
4. 🔒 **DOOR 5 IS PROVEN LINK BY LINK** (T4): staff approve an order (draft → open) → the
   `purchases_assign_documents` trigger fires → `contact_required_documents` rows exist → `my_wall_state()`
   returns them → `AppLayout.tsx:1704` redirects. **Five separate proofs, from the DATABASE.**
   ⚠️ **And state which table `my_wall_state()` reads.**
5. **Door 4's no-account case CONFIRMED, not repaired** (T3): `emailSkipped: 'no account yet'`, and the
   requirement + notification still written.
5b. 🔒 **`?kind=contract` no longer sent by either endpoint**, and a counterparty who already has an
   account still lands on their document — **including the already-signed case**.
6. **Door 2 walked end to end, logged out**: `/sign/guest` → email → `/activate?token=` → account →
   **the signing flow, with documents actually listed**.
7. **Door 1 walked**: a website order submission → the same landing.
8. **Doors 3 and 4 walked as staff**: provision a client with documents required, and request
   documents from an existing client. **Both people land in the same flow.**
9. **Door 5 walked**: an account with an unpaid/unsigned initial order logs in and **meets the wall**.
10. **If Phase 2 ran:** `npx tsc --noEmit` clean, `npm run build` succeeds, and the repaired door is
    re-walked. ⚠️ **`npm run test:db` is red at baseline and proves nothing.**
11. **If nothing was broken, say so plainly and ship the walk.** 🔒 **"All five converge, here is the
    proof" is a complete result and is what this task most likely returns.**

## 11. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-E-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-E-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies your claims itself. **You do not push.**
