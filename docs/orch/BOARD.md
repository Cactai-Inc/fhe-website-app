# THE BOARD — what has right of way, right now

⚠️ **`ORCH`'s RUNNING RECORD** *(`docs/method/THE-RUNNING-RECORD.md`)*. **The light's state, written
down, so a fresh ORCH takes the junction without asking anyone what is moving.**
🔒 **UPDATED ON EVERY DISPATCH AND EVERY MERGE. If it disagrees with `git worktree list`, IT is wrong.**

**Last updated:** 2026-09-01 · **ORCH7 — public-site lane sequenced from FHE-DSNR-SITE-PUBLIC-HANDOFF**

## RESUME
- ✅ **`TASK-LIFECYCLE` — VERIFIED, MERGED, PUSHED** (merge `5b9fed67`, docs `b9aa8b82`).
  Six booking states live in production, 30+30 horizon, viewer-scoped calendar read, transitions
  on the buttons that already exist. **All migrations were applied to prod by the thread and
  re-verified by ORCH7 at merge time.** `docs/reports/TASK-LIFECYCLE-VERIFICATION.md` beside the
  report. Branch deleted; tag `archive/lifecycle-2026-09-01`; `wt-2` back in the pool, idle+clean.
  ⚠️ **The 2026-09-01 wt-1 collision is fully resolved** — separation completed, the mixed
  `task/lifecycle` branch is gone, the three stray migrations in `wt-1` are gone. D36 exists
  because of it.
- ✅ **`TASK-SIGNBOOK` — VERIFIED AFTER THE FACT** (merge `2fa1f7b9`). ⚠️ **The thread merged and
  PUSHED its own branch before ORCH validation** — the work holds (all post-release checks green,
  `TASK-SIGNBOOK-VERIFICATION.md`), the sequence was a violation, recorded with two more
  deviations: **unspecced DOOR scope shipped in the same merge** (verified to the same bar), and
  **`task/flowalign` self-created in `wt-1`, undispatched, zero commits — NOT a licensed task.**
  Awaiting owner: close the thread; `wt-1` returns to the pool once `task/flowalign` is resolved.
- 🔒 **NOTHING IS DISPATCHED-AND-RUNNING as of SIGNBOOK's close.**
- 🔒 **Every prompt now states MODEL TIER · EFFORT · THINKING on/off when not Fable · worktree
  (owner ruling + D36).**
- **`REQCARDS` — queued, three preconditions:** ~~LIFECYCLE merged~~ ✅ · the modal
  full-option-set conversation the owner offered (**`DISCO`'s, next**) · `DSNR` folds the owner's
  three answers (`TASK-REQCARDS-LEDGER.md`, bottom) plus the option-set lock into the spec.
  **Then dispatch, with a worktree named per D36.**

- 🔒 **HOLD, AND THIS IS ORCH6's RULING — do not release until BOTH builds merge:**
  **`CLNR-REPO-STATE`** and **`DSNR-SITE-PUBLIC`**, both queued and ready in the owner's input.
  ⚠️ **`CLNR` MOVES FILES, and `DSNR-SITE-PUBLIC` WRITES INTO `docs/tasks/` — which CLNR moves.**
  **"Never move a file under a running thread" is the rule, and ORCH6 broke it once this session
  by committing docs while `FIX5` was reorganising them.** **The owner asked whether he needed a
  green light: the answer is yes, and it is NO for now.**

- **Merged this session:** `FIX4` · `FIX5` *(step 8 reversed)* · `BACKDATE` · `CR85` · `MODAL2` ·
  `REAPER` · `BOOKS1` · `SIGNSTRIP` · `SIGNDOOR` · `ANALYTICS`. **`main` pushed and clean.**
- **Gates on `main`:** typecheck **0** · typecheck:api **0** · lint **46** · build **clean** ·
  `test:api` **7/7** · ⚠️ **`test:db` red at baseline and proof of nothing.**
- **Worktree pool:** `wt-1` = SIGNBOOK (running) · `wt-2` idle · `wt-3` idle — both detached at
  `origin/main`, clean, with `node_modules` and the `.env` pair. 🔒 **D36: ORCH assigns; a thread
  never self-selects.**

## ▶ DISPATCHED 2026-09-01 — the public-site lane (FHE-DSNR-SITE-PUBLIC-HANDOFF)
| Thread | Model/effort/thinking | Worktree | State |
|---|---|---|---|
| `FHE-TASK-SITECOPY-A` | Sonnet · HIGH · thinking OFF | `wt-2` | prompt handed |
| `FHE-TASK-SITECOPY-B` | Opus · HIGH · thinking ON | `wt-3` | prompt handed |
| `FHE-TASK-LANDINGSIGNIN` | Opus · HIGH · thinking ON | `wt-1` | prompt handed — shape gate CLOSED by owner ruling `967d983d` (cart glyph + Sign In) |
| `FHE-DSNR-ONERAIL` | Opus · HIGH · thinking ON | — (docs only) | prompt handed — rebase pass, both its gate merges landed today |
| `FHE-TASK-SITESEO` | Opus · HIGH · thinking ON | after SITECOPY-A merges | 🔒 GATED on ASK-OWNER 2 (301 vs 404) |
| `FHE-TASK-POLICIESANDFAQ` | — | — | ⛔ BLOCKED: draft + COMPLIANCE-FINDINGS not in repo (ASK-OWNER 1) |

**Sequence:** A ‖ B ‖ LANDINGSIGNIN parallel (file-disjoint per handoff §2) · SITESEO after A
(shares `src/lib/seo.ts`) · POLICIESANDFAQ after the owner stages the drafts and DSNR specs it.
⚠️ **`VISITMENU` merged `c45ee5ea` without ORCH validation — validation owed, queued.**
✅ **wt-1 stray RESOLVED:** it was the unshipped half of the owner's leasing correction —
applied and merged (`61b75a42`); wt-1 back in the pool.

## ▶ DISPATCHED 2026-09-01 — the SIGNFLOW lane (FHE-DSNR-SIGNFLOW-HANDOFF · CR-100/101/102)
| Thread | Model/effort/thinking | Worktree | State |
|---|---|---|---|
| `FHE-TASK-SIGNFLOW-A` | Opus · HIGH · thinking ON | ⚠️ **`wt-4` — CREATE IT** (pool full; TASK-ROLE §5 fallback, copy `.env`+`.env.db`) | prompt handed |
| `FHE-TASK-SIGNFLOW-B` | Opus · HIGH · thinking ON | ⚠️ **`wt-5` — CREATE IT** (same) | prompt handed |
| `FHE-TASK-SIGNFLOW-C` | Opus · HIGH · thinking ON | assigned at dispatch | 🔒 **GATED: dispatches only after A AND B merge** — 3 shared files, re-greps line numbers per its §7 T3. ⚠️ Amended `f139c3b6`: the two retiring doors left its list |
| `FHE-TASK-SIGNFLOW-D` | Opus · HIGH · thinking ON | ⚠️ **`wt-6` — CREATE IT** (pool full) | prompt handed — two-phase: Phase 1 measures, its §5 questions go to the owner BEFORE Phase 2 removes |

**Cross-lane check run by ORCH7:** SIGNFLOW-C's 15-file list contains NONE of SITECOPY-B's three
files and not `Header.tsx` — the two lanes are file-disjoint. The one shared file across lanes is
`Onboarding.tsx`: SIGNFLOW-B edits it; SITECOPY-B is forbidden from opening it by its own §5.
**D35 does not apply to this batch — none of the three touches the database** (handoff §2).
D/E/F are void — the owner narrowed CR-102; archived with his ruling on line one.

## QUEUE BEHIND THE LANE
`REQCARDS` (after DISCO option-set lock + DSNR fold) · `CLNR-REPO-STATE` (hold RELEASED — both
builds merged; dispatch when no build is mid-flight, it moves files).

## ⚠️ EXCLUSIVE OWNERSHIP (D35 — a worktree isolates git, NOT the database)
| Object / file | Owner | State |
|---|---|---|
| the onboarding wizard · the delivery-hold/submit RPCs · the door (`account_state_for_email`, `api/register-invited.ts`) | — | **free — SIGNBOOK merged `2fa1f7b9`** |
| the whole booking state machine (`bookings_status_check` · `booking_status_code` · `calendar_free_busy` · `request_open_time` · `request_booking_change` · `decide_booking_change` · `confirm_booking` · `confirm_booking_for_purchase` · `purchases_confirm_bookings` trigger · `_ensure_plan_horizon` · `ensure_standing_slots` · `mint_recurring_allotments` · `plan_horizon_through`) | — | **free — LIFECYCLE merged.** 🔒 SIGNBOOK still may not edit `request_open_time`; it calls it |
| the staff dashboard cards · the client payment modal | **reserve for `REQCARDS`** | queued |
| `index.html` · `src/lib/seo.ts` (copy values) · `Services.tsx` · `About.tsx` | **`SITECOPY-A`** | running |
| `Confirmation.tsx` · `OrderPayment.tsx` · `ActivationOrderPanel.tsx` · `usePropertyTerm` adoption | **`SITECOPY-B`** | running |
| `src/components/layout/Header.tsx` | **`LANDINGSIGNIN`** | held on wt-1 |
| `scripts/prerender.mjs` · `scripts/seo-files.mjs` · `seo.ts` route list · `App.tsx` redirects | **reserve for `SITESEO`** | gated |
| `src/lib/documentBody.ts` (new) · `MergedBodyView.tsx` · `ContractCascade.tsx` · `DocumentsContent.tsx` · `DocsParticipantFlow.tsx` · `PaperViewer` | **`SIGNFLOW-A`** | running |
| `src/lib/normalize.ts` · `SignStart.tsx` · `Onboarding.tsx` (inputs) | **`SIGNFLOW-B`** | running |
| the 15-file green list + `src/index.css` `.flow-green` | **reserve for `SIGNFLOW-C`** | gated on A+B |
| `Release.tsx` · `DocsParticipantFlow.tsx` · `api/sign-release.ts` · `/release`+`/docs/release-participant` routes in `App.tsx` · 🔒 DB: `sign_release` + `sign_general_release` (the anon-grant close) | **`SIGNFLOW-D`** | running — ⚠️ `App.tsx` also wanted by gated SITESEO: **D merges before SITESEO dispatches** |
| `mark_purchase_paid` · `revenue_summary` · the money columns | — | free — the BACKDATE+BOOKS1 union |
| `AppLayout.tsx` · `pageRegistry.ts` · `ops/kit/Modal.tsx` | — | free |

## ⚠️ WAITING ON THE OWNER — four, and two block a dispatch
1. ⚠️ **The reschedule waitlist shape (CR-97):** notify · first-refusal window · or auto-convert
   to `requested`. **Blocks the CR-90/CR-97 build.** ⚠️ **No waitlist exists today** — measured.
2. ⚠️ **The 43 sessions already scheduled beyond 30+30** *(Madeline's November among them)*.
   **DSNR ruled they are NOT retro-deleted under D32 — his call. Blocks the same build.**
3. **Confirm DSNR's reading of "availability is the absence of a block"** — that it governs what
   `cancelled` and a released `moved` BECOME, **not** authority to delete the 594 `Open` chips.
4. **CR-88:** does a campaign need a budget figure, and **which company-level expense categories**
   — ⚠️ *"dont put labels on anything"* means **do not invent a chart of accounts;** the question
   is only whether he wants any beyond marketing.
5. ⚠️ **`TASK-SIGNDOOR` A3, non-blocking:** does email-only cover `/sign/deal`? **Left untouched.**

## ROUTED, NEEDS A SPEC — not fixed at the pass
1. ⚠️ **`reap_expired_holds` carries `anon=X`** — an unauthenticated caller can execute a function
   that WRITES. **Not probed; probing executes a write on production.**
2. **`isPageHidden` has ONE call site and the nav never reads `org_page_visibility`** — ⚠️ **CR-85
   made this WIDER:** the tenant can now toggle Catalog/Messages and nothing happens.
3. **The dossier Orders tab settles through the union seam but offers no discount/comp
   affordance** — one additive edit, uncontended.
4. ⚠️ **`/api/expire-holds` was fixed; the four other scheduled endpoints have never been audited.**
5. **The `test/db` per-file triage** — 56 red files, each needing fix-or-retire **with the decision
   named** *(`ORCHESTRATOR.md`: a test is deleted only for a deliberately retired feature)*.
6. **(LIFECYCLE) a 1-hour reminder fires for an UNAPPROVED session** — pre-existing behaviour under
   a new name; product question.
7. **(LIFECYCLE) a client accepting a staff counter-time on an unpaid order lands `scheduled` with
   no payment request** — `request_purchase_payment` is staff-only.

## OWNER CHECKLISTS UNRUN — the half no thread can prove
`FIX1` §8 · `FIX2` §9 · **`FIX4` §11 (13 items, the biggest visual change)** · `CR85` §8 ·
`MODAL2` · `BACKDATE` §8 · `BOOKS1` §14 · **`LIFECYCLE` §8 (7 items — item 6 is the visible change: next month renders pending/orange)** · **`SIGNDOOR` — ⚠️ load `/sign/rider` and count the boxes;
"exactly two" is the whole task and only its own probe has tested it.**
