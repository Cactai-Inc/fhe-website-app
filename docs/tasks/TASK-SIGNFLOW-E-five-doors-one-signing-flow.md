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

## 2. 🔒 WHAT THE CANON ACTUALLY IS — and it is NOT one destination today

**Follow door 2 to its end.** `/activate?token=` → `ActivateShell` → `Register.tsx` / `RegisterComplete.tsx`.
**The destination is chosen at `src/pages/Register.tsx:40-55` and again at
`src/pages/RegisterComplete.tsx:86-106`, and there are FOUR outcomes:**

| Condition | Destination |
|---|---|
| the invitation carries a `documentId` (**the `deal` door**) | `/app/contracts/{documentId}` |
| a carried document id | `/app/contracts/{id}/start` |
| `state?.needed` | **`/app/onboarding`** |
| otherwise | `/app` |

⚠️ **THEREFORE `/sign/*` ITSELF ALREADY HAS TWO ENDINGS:** `/sign/guest|rider|horse|rider+horse` land
on **`/app/onboarding`**; `/sign/deal` lands on **`/app/contracts/:id`**.

🔒 **THAT IS THE FIRST THING YOU MUST RESOLVE, AND IT IS A QUESTION, NOT A DECISION.**
**Ask it as Q1 (§6):** *is `/app/onboarding` the one flow, with the deal counterparty joining it — or
is the deal contract page a legitimate second ending because a counterparty signs one named document
rather than an onboarding set?*
⚠️ **DSNR's read, offered so you are not starting from nothing and NOT to be treated as the answer:
the deal ending is probably legitimate and the two are not really two flows — `/app/onboarding` itself
navigates to `/app/contracts/{id}/start` when a contract is what is outstanding
(`src/pages/app/Onboarding.tsx:907`). If that is true, they already converge one step later, and the
finding is that nothing SAYS so.** **Prove it or disprove it — do not assume it.**

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
- **T3 — door 4 sends a different URL.** `api/documents-requested.ts:116` emails
  `${origin}/app/onboarding` directly, while doors 1–3 email `/activate?token=`. ⚠️ **That may be
  correct — door 4 is for someone who ALREADY HAS AN ACCOUNT, so there is nothing to activate.**
  **Check `has_account` (`api/documents-requested.ts:35`) and report whether the no-account case is
  handled.** 🔒 **If a person with no account is emailed a bare `/app/onboarding` link, they hit a
  login wall with no way through — that is a real defect and it is IN scope.**
- **T4 — door 5 is the one most likely to be dead.** ⚠️ **`AT_LOGIN` is the column DEFAULT, so it
  looks correct from the schema alone.** 🔒 **Prove the wall actually FIRES**: that an order for an
  offering with required documents writes `contract_role_documents` rows, that `myWallState()` then
  returns them, and that `AppLayout` redirects. **Prove each link, not the chain's plausibility.**
  ⚠️ **This repo's dominant failure is "code that works and nothing reaches it"**
  (`docs/method/TASK-ROLE.md` §2b).
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
- **Q1 — the deal ending.** §2. *"`/sign/deal` lands on `/app/contracts/:id`, not `/app/onboarding`. One
  flow with two endings, or a divergence to close?"* **Bring the evidence from §5, including whether
  `/app/onboarding` already forwards to the contract page (`Onboarding.tsx:907`).**
- **Q2 — only if §5 finds a door that lands nowhere usable.** State the door, what happens today, and
  the smallest change that would fix it. ⚠️ **Do not build it without an answer.**

## 7. PHASE 2 — REPAIR, and only what Phase 1 proved broken
🔒 **NO SPECULATIVE FIXES. If §5 shows all five converge, this task's output is the walk report and
that is a COMPLETE, SUCCESSFUL result.** ⚠️ **Finding nothing broken is the most likely outcome and
you must be willing to report it.**

**If a door IS broken, the repair is bounded by:**
- 🔒 **Use the incumbents in §3.** ⚠️ **A new door must call `provision_client_invitation` and land on
  `/activate?token=`, or set `disposition` and let the wall do it.** **Never a sixth mechanism.**
- **The smallest change that makes the existing machinery reach.** **A missing call site, a wrong URL
  in an email template, an unset `disposition` — those are the shapes this defect takes here.**
- ⚠️ **Any DB change is additive** (D32). **No column drops, no row deletion.**
- 🔒 **Do NOT touch the wall's fail-closed behaviour** (`AppLayout.tsx:1550-1554`).

## 8. OUT OF SCOPE
- 🔒 **REMOVING ANY OTHER ENTRY PATH.** ⚠️ **His *"the others can be removed"* refers to `/release` and
  `/docs/release-participant`, which `TASK-SIGNFLOW-D` owns.** **If your walk finds a SIXTH way to
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
4. 🔒 **DOOR 5 IS PROVEN LINK BY LINK** (T4): order → `contract_role_documents` written →
   `myWallState()` returns them → `AppLayout` redirects → the person lands in the flow. **Four
   separate proofs. A green function call is not a shipped feature.**
5. **Door 4's no-account case is answered** (T3): what happens when `has_account` is false.
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
