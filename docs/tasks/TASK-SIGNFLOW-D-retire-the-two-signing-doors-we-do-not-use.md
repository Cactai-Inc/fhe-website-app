# TASK-SIGNFLOW-D — retire `/release` and `/docs/release-participant`, and close the anonymous signing grant

**Spec by `FHE-DSNR-SIGNFLOW`, 2026-09-01. Owner directive, same day — see §1.**
**Thread name: `FHE-TASK-SIGNFLOW-D`.**
**Independent of `A`, `B` and `C` — no file overlap. It can run at any time.**

🔒 **TWO PHASES IN ONE THREAD. PHASE 1 MEASURES AND DELETES NOTHING. PHASE 2 REMOVES, AND ONLY IF
PHASE 1 COMES BACK CLEAN.** ⚠️ **The STOP conditions in §6 are the whole safety design of this task.
If one fires, you write the report and you stop — that is a SUCCESSFUL outcome, not a failure.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` · `docs/method/CLNR-ROLE.md` §3 · `docs/method/THE-RUNNING-RECORD.md`
>   (open `docs/reports/FHE-TASK-SIGNFLOW-D-LEDGER.md` FIRST).
> - `CLAUDE.md` **D32** (`:780`) — 🔒 **NOTHING IS EVER REMOVED FROM THE DATABASE.** **This task
>   removes ROUTES AND CODE. It removes no row, no table, no column and no document, ever.**
> - `CLAUDE.md` **D15** (`:341`) — a linked file is never removed from the system.
> - `CLAUDE.md` **D17** (`:365`) — a feature is not done until it is reachable and correctly named.
> - `docs/reference/FLOW-MAP.md` — flow **F3** is these two surfaces; **X9** (`:159`) is the withdrawn
>   finding that `/sign/guest` did not exist. **It does exist. That matters here.**
> - `docs/reference/SURFACE-INVENTORY.md:80-81` — both surfaces, classified `URL-ONLY`.
> - `supabase/migrations/20260831T1200_signing_rpcs_are_not_anonymous.sql` — ⚠️ **read it in full. It
>   deliberately spared the two functions this task can finally close.**

---

## 1. THE OWNER'S WORDS

> *"we dont use docs/release-participant nor /release, those urls if they are still operational should
> be traced and most likely anything associated with them should be decommissioned and the /sign/ flow
> should be the single pathway we use and just have different ways of getting there to accommodate the
> various scenarios/places/events a client would be served with the link to it."*
> — owner, 2026-09-01

**AND THE RULING THAT SETTLED IT, same day, after this spec's first draft asked:**
> *"we dont have a situation where a person without an account signs documents on an ipad or any other
> way."* — owner, 2026-09-01

🔒 **THAT IS THE ANSWER TO THE ONLY QUESTION THAT COULD HAVE STOPPED THIS TASK.** ⚠️ **An earlier
draft held Phase 2 pending "is there a printed QR code" and "does visit-day need a replacement." Both
are answered: there is no no-account signing scenario at all.** **Phase 2 runs. Do not re-ask either
question.**
**Phase 1 still runs first — he asked to have it *traced* — but it now measures for the record and to
protect the removal order, not to decide whether to remove.**

## 2. WHAT WAS MEASURED — by DSNR on 2026-09-01, from the code. ⚠️ Re-run all of it.

| Fact | Query | Result |
|---|---|---|
| Both routes are live and unguarded | `grep -n "release" src/App.tsx` | `:237` `/release` · `:238` `/release/:releaseKey` · `:240` `/docs/release-participant`. **No auth wrapper on any of the three.** |
| 🔒 **Nothing in the running app links to either** | `grep -rn "'/release\|\"/release\|release-participant" src api supabase scripts` | **Exactly one non-route hit in shipped code:** `src/lib/reviewSection.ts:283` — the admin **Review** page's diagnostic slot *"Signing D · public kiosk ⚠"*, already labelled `DESTRUCTIVE. This signs a REAL document.` Everything else is `App.tsx` itself, migration comments, and docs |
| 🔒 **No email template, seed or migration contains either URL** | `grep -rn "release-participant\|/release" supabase/` (excluding `migrations-archive`) | **zero hits** |
| `/sign/guest` already covers the guest case | `docs/reference/FLOW-MAP.md:159` (X9, 2026-08-20), `src/pages/SignChoose.tsx:40` | **The withdrawn finding says so explicitly:** the guest three-document flow *"IS built, at `/sign/guest`"* |
| `/release` alerts nobody | `docs/reference/FLOW-MAP.md:24` (F3) | *"signing+delivery work (35 delivery rows); `/release` alerts nobody"* ⚠️ **inherited from a document, NOT re-measured — see §5 Q1** |

### 🔒 2a. THE FINDING THAT MAKES THIS MORE THAN TIDYING
**`api/sign-release.ts` calls the signing RPC with the ANONYMOUS key, not service_role.**
`api/sign-release.ts:41-47` builds `anonClient()`; `:133` calls `anon.rpc('sign_release', …)`.
**So `sign_release` must still hold an `anon` EXECUTE grant**, and it does.

⚠️ **Yesterday's hardening migration spared it ON PURPOSE, and said why**
(`supabase/migrations/20260831T1200_signing_rpcs_are_not_anonymous.sql:21-23`, verbatim):
> *"the public kiosk paths sign through `sign_release` / `sign_general_release`, which are untouched
> here."*

🔒 **These two pages are the ONLY reason an unauthenticated caller can still write a contact, an
engagement and an EXECUTED document.** **Retiring them is what finally lets that grant close.**
**That is the real prize in this task, and it is worth more than the deleted lines.**

## 3. THE INCUMBENT, NAMED (D18) — `/sign/` is it, and it does NOT do the same thing

⚠️ **THE ONE HONEST GAP, AND YOU MUST NOT PAPER OVER IT.**

| | `/release` + `/docs/release-participant` | `/sign/:path` |
|---|---|---|
| what it does | ⚠️ **SIGNS documents, immediately, with no account** — `signRelease` → `POST /api/sign-release` → `sign_release` RPC | **CAPTURES a request** — `POST /api/sign-start` (`SignStart.tsx:449`), which sends an invitation |
| where the signature happens | **on the page, in the moment** | **later, in the person's own account**, at `/app/onboarding` |
| identity | created server-side from the typed email | a real account the person activates |

🔒 **THEREFORE RETIRING THE KIOSK IS NOT A REDIRECT. It removes same-moment, no-account signing.**
A walk-in at the barn goes from *"sign here on the iPad"* to *"give us your email, open it on your
phone, make an account, then sign."*

**The owner has already spoken to this** — *"just have different ways of getting there to accommodate
the various scenarios/places/events a client would be served with the link to it"* — **so the entry
points are the answer, not the mechanics.** ⚠️ **But §5 Q2 is the question that decides whether this
task is "delete four routes" or "delete four routes AFTER something replaces visit-day."**
**You do not answer it. You report it.**

## 4. 🔒 PHASE 1 — TRACE AND PROVE. YOU DELETE NOTHING IN THIS PHASE.

**Produce all of the following as evidence in your report, each with the query that produced it:**

1. **Are the routes reachable in production, right now?** Fetch each of `/release`,
   `/release/general`, `/docs/release-participant` against the live site and report the HTTP status
   and whether a form renders. ⚠️ **Do not submit any form. `reviewSection.ts:283` already warns
   `DESTRUCTIVE — this signs a REAL document`.**
2. 🔒 **HAS ANYTHING EVER BEEN SIGNED THROUGH THEM, IN PRODUCTION?** ⚠️ **DSNR could not run this — the
   repo's `.env` carries only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, so the counts below are
   NOT measured and must not be treated as if they were.** **Count, against production:**
   - `documents` rows whose creation path was `sign_release` / `sign_general_release` — by
     `template_key IN ('RELEASE_GENERAL','RELEASE_PARTICIPANT','FACILITY_RULES','COMPANY_POLICIES','HUMAN_EMERGENCY_MEDICAL')`
     **AND** created without an authenticated actor. ⚠️ **Those template keys are ALSO signed through
     `/app/onboarding`, so the key alone does not identify the kiosk — find the column that does
     (`origin`, `channel`, the actor stamp, or the engagement's shape) and say which you used and why
     it is sound.** **A count you cannot attribute is not evidence.**
   - the **35 delivery rows** F3 claims (`FLOW-MAP.md:24`). **Re-count them.** 🔒 **That number came
     from a document and is a hypothesis** (`docs/method/DSNR-ROLE.md`, *write from the database, not
     from documents*).
   - the **most recent** such row's timestamp. ⚠️ **"Used once in July" and "used last week" are
     different answers to the owner's "we dont use."**
3. **What breaks if the pages go?** Trace and list every module reachable only from them:
   `src/pages/Release.tsx` (incl. its exported `RELEASE_OPTIONS`) · `src/pages/DocsParticipantFlow.tsx`
   · `src/lib/ops/api-public.ts` (`fetchReleasePreview`, `signRelease`, `SignReleaseInput`,
   `ReleaseTemplateKey`) · `api/sign-release.ts` · the `hold_set` path through
   `api/deliver-documents` · the `sign_release` / `sign_general_release` RPCs and any
   `open_document_delivery_hold` call that exists only for them.
   ⚠️ **For EACH, state whether anything else uses it.** **`api/deliver-documents` is also used by
   `SendCopiesMenu.tsx:39` and by `/app/onboarding` — it STAYS. Prove that rather than assuming it.**
4. **Does `/sign/` cover every scenario these two served?** For each of the five document keys above,
   name the `/sign/` funnel that produces it and the file:line that proves it. ⚠️ **A key nothing in
   `/sign/` produces is a GAP and goes straight into §5 as a question for the owner.**
5. **Is a link to either in the wild?** Report what the repo can prove — **nothing links to them
   (§2)** — and state plainly that **a printed QR code, a laminated sign at the barn, or a link pasted
   into a past email cannot be seen from here.** **That is §5 Q3 and only the owner can answer it.**

## 5. 🔒 THE QUESTIONS ARE ANSWERED — do not re-ask them
**An earlier draft sent three questions up. The owner answered all three on 2026-09-01 before this
spec was dispatched:**
- **Usage** — irrelevant to the decision. **Measure it for the record (§4.2), then proceed.**
- **Visit-day** — *"we dont have a situation where a person without an account signs documents on an
  ipad or any other way."* **There is nothing to replace.**
- **Links in the wild** — same ruling. **A retired URL 404s.**

⚠️ **You still emit a question the moment something blocks you** (`docs/method/TASK-ROLE.md` §1).
**But not these three.**

## 6. 🔒 THE STOP CONDITIONS — reduced to ONE by the owner's ruling
⚠️ **Stopping is still a SUCCESSFUL outcome. But only one condition survives, and it is technical:**

1. 🔒 **Any module in §4.3 that turns out to have a second, still-live consumer you cannot cleanly
   separate.** ⚠️ **`api/deliver-documents` is the likeliest** — it is shared with
   `SendCopiesMenu.tsx:39` and the onboarding set-delivery. **It STAYS. If separating the `hold_set`
   path from it is not clean, stop and report rather than surgery-by-guess.**

**THE THREE CONDITIONS THAT WERE HERE AND ARE NOW STRUCK, so you do not reinstate them:**
- ~~production usage in the last 90 days~~ — ⚠️ **he ruled regardless of usage.** **Still MEASURE it
  (§4.2) — you must know what exists so you do not delete it (D32) — but it does not gate the removal.**
- ~~a document key `/sign/` cannot produce~~ — **still measure and report it (§4.4); it is a finding
  for `TASK-SIGNFLOW-E`, not a stop here.**
- ~~a printed QR code in the wild~~ — 🔒 **answered: *"we dont have a situation where a person without
  an account signs documents on an ipad or any other way."*** ⚠️ **A stranger with an old link is now
  a 404 by design, and §9 covers what to recommend about it.**

## 7. PHASE 2 — THE REMOVAL, only on a clean Phase 1 and only in this order
🔒 **NOT A DELETION SPREE. Each step is separately provable and separately revertable.**

1. **The routes go first** — `src/App.tsx:237`, `:238`, `:240`, and their imports at `:31-32`.
   **This alone makes both surfaces unreachable**, and it is the whole of the owner's ask.
2. **`src/lib/reviewSection.ts:283`** — the Review page's slot D. ⚠️ **It points at a route that no
   longer exists; leaving it is a dead diagnostic link.** Remove the entry; **do not renumber the
   other slots** unless the file's own idiom requires it.
3. 🔒 **CLOSE THE ANONYMOUS GRANT — the point of the whole task.** A migration that
   `REVOKE EXECUTE … FROM anon, PUBLIC` on `sign_release` and `sign_general_release`, and re-`GRANT`s
   to the roles that must keep it. ⚠️ **THREE TRAPS, ALL PREVIOUSLY LIVE IN THIS REPO:**
   - **`REVOKE … FROM PUBLIC` alone is not enough** — a direct grant to `anon` survives it.
     **Name both roles explicitly**, exactly as
     `20260831T1200_signing_rpcs_are_not_anonymous.sql:29-33` does.
   - **`DROP` + `CREATE` resets an ACL to the schema default.** **Do not drop these functions. Revoke
     only.**
   - 🔒 **PROVE THE RESULT FROM `pg_proc.proacl`, not from the absence of an error.** Paste the
     before-and-after ACL for both functions.
   ⚠️ **The functions THEMSELVES are NOT dropped** — D32, and their executed documents reference the
   path that made them. **Revoke the grant; leave the code.**
4. **`api/sign-release.ts`** — delete it **only after** proving nothing else posts to it
   (`grep -rn "sign-release" src api`). ⚠️ **`api/deliver-documents` STAYS** — `SendCopiesMenu.tsx:39`
   and the onboarding set-delivery both use it.
5. **The two page files and their now-orphaned exports** — `Release.tsx`, `DocsParticipantFlow.tsx`,
   and whichever of `fetchReleasePreview` / `signRelease` / `SignReleaseInput` / `ReleaseTemplateKey`
   in `src/lib/ops/api-public.ts` have no remaining caller. ⚠️ **Check each one; some are re-exported
   through `src/lib/ops/types.ts`.**
6. **The documentation** — `docs/reference/SURFACE-INVENTORY.md:80-81` and
   `docs/reference/FLOW-MAP.md:24` (**F3**). ⚠️ **Do not delete the rows. Mark them RETIRED with the
   date and the owner's words**, so the next FLOW-MAP reader does not re-discover a flow that was
   deliberately removed. **`docs/reference/flows/onboarding.md:157`, `:174` too.**

## 8. OUT OF SCOPE — do not touch
- 🔒 **ANY DATABASE ROW, TABLE OR COLUMN** (D32). **Documents signed through these flows are legal
  records and stay forever.** ⚠️ **This task's only migration is a `REVOKE`/`GRANT`.**
- **`/sign/` itself.** ⚠️ **Building a new entry point into it, or a visit-day replacement, is NOT this
  task** — it is what Q2 decides. **Do not start it.**
- `api/deliver-documents`, `api/sign-start`, `/app/onboarding`, the contract engine.
- **Colour.** `TASK-SIGNFLOW-C` owns that and does not touch your files.
- **The `sign_release` / `sign_general_release` function bodies.** Grants only.

## 9. THE REACH AND THE TELL (D19)
**THE REACH:** after Phase 2, `/release`, `/release/:releaseKey` and `/docs/release-participant` return
the app's 404. **`/sign` and its four funnels are the only public signing door.**
**THE TELL:** ⚠️ **the person this is visible to is a STRANGER with an old link, and they get a 404
with no explanation.** 🔒 **Say so in your report and recommend whether the owner wants a redirect to
`/sign` instead of a 404** — *do not build it; a redirect from a retired signing URL is a product
decision and belongs with Q2.*
**UNDO:** every step is one revert; the migration is undone by re-granting. **Nothing is destroyed.**

## 10. THE TEST THIS MUST PASS
⚠️ **Renders are NOT verified by you. Items 7–9 are the numbered checklist you hand the owner, and it
must name the phone.**

**Phase 1, always:**
1. **All five §4 measurements are in your report, each with its query and its output.** ⚠️ **§4.2's
   attribution reasoning matters more than its number** — say how you separated kiosk-signed documents
   from the identical template keys signed through `/app/onboarding`.
2. **§4.4's answer** — which `/sign/` funnel produces each of the five document keys, with `file:line`.
   ⚠️ **Any key nothing produces is a finding for `TASK-SIGNFLOW-E`. Report it in one line; do not fix it.**
3. **If the one STOP condition fired:** say which module and why, and `git diff --stat` is empty.

**Phase 2 — expected to run:**
4. `grep -rn "release-participant\|Release.tsx\|DocsParticipantFlow" src api` returns **only** what
   §7.6's documentation edits leave behind. **List every remaining hit and why it is fine.**
5. 🔒 **`pg_proc.proacl` for `sign_release` and `sign_general_release` shows NO `anon`**, pasted before
   and after. ⚠️ **And `/app/onboarding` still signs successfully afterwards** — **prove it end to end
   on a real document**, because that path shares the delivery machinery.
6. `npx tsc --noEmit` clean; `npm run build` succeeds — ⚠️ **the build is the real test that no import
   was orphaned.** **`npm run test:db` is red at baseline and proves nothing.**
7. `/release`, `/release/general` and `/docs/release-participant` all 404 in production.
8. **`/sign`, `/sign/guest`, `/sign/rider`, `/sign/horse`, `/sign/rider+horse` and the deal branch all
   still work, logged out**, and a submission still produces its invitation.
9. **`/app/onboarding` signs a document and the executed copy still arrives by email.** ⚠️ **This is
   the item that catches a shared-delivery regression, and it is the one most likely to be skipped.**
10. **The Review page has no dead slot D.**

## 11. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-D-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-D-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies your claims itself. **You do not push.**
