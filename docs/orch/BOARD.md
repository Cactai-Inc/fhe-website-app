# THE BOARD — what has right of way, right now

⚠️ **`ORCH`'s RUNNING RECORD** *(`docs/method/THE-RUNNING-RECORD.md`)*. **The light's state, written
down, so a fresh ORCH takes the junction without asking anyone what is moving.**
🔒 **UPDATED ON EVERY DISPATCH AND EVERY MERGE. If it disagrees with `git worktree list`, IT is wrong.**

**Last updated:** 2026-09-01 · **ORCH7, on takeover — both running records checked, both threads ON
the rails, ⚠️ one worktree collision found and separation orders issued (below)**

## RESUME
- ⚠️ **RUNNING NOW — two threads, and BOTH ARE IN `wt-1`. That is the collision.**
  1. **`SIGNBOOK`** (Opus·MAX) — ledger current at 14:20, migration drafted, three commits of real
     work. **On the rails.** Its §4 blocker finding (the shop step is unreachable for a self-serve
     visitor) is the task's own ground.
  2. **`LIFECYCLE`** — ⚠️ **this is the thread dispatched as `REQCARDS`.** It measured, found
     REQCARDS unbuildable (no `requested`/`approved`/`moved` in `bookings_status_check`, LIFECYCLE
     unbuilt), asked ONE question, took the owner's ruling — **build LIFECYCLE first** — and stood
     down onto `TASK-LIFECYCLE`. **That is correct TASK behaviour, not going off the rails.** Its
     ledger is current; design locked; migrations are its next step.
- 🔴 **THE COLLISION (reflog-proven):** at 14:19:39 the LIFECYCLE thread ran
  `checkout task/lifecycle` **inside `wt-1`, under SIGNBOOK mid-flight.** SIGNBOOK's branch
  `task/signbook` is stranded at its first commit; SIGNBOOK's later commits (`237d150f`,
  `65803545`, `2685c05d`) and LIFECYCLE's ledger commit (`654e1ed5`) are interleaved on
  `task/lifecycle`. **Separation ordered 2026-09-01 by ORCH7:** LIFECYCLE relocates to `wt-2` on
  `task/lifecycle-b` (cherry-picks `654e1ed5`); SIGNBOOK stays in `wt-1` and takes
  `git branch -f task/signbook HEAD && git checkout task/signbook`; the mixed `task/lifecycle`
  branch is deleted once both confirm. **Safe in either order — each acts by SHA, not branch name.**
- **`REQCARDS` returns to the queue:** blocked on LIFECYCLE's merge, on DSNR folding the owner's
  three answers (in `TASK-REQCARDS-LEDGER.md`, bottom) into the spec, and on the modal
  full-option-set conversation the owner offered — that conversation is `DISCO`'s, before re-spec.

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
- **Worktree pool:** `wt-1` = SIGNBOOK · `wt-2` = LIFECYCLE (after relocation) · `wt-3` idle at
  `origin/main`, clean, with `node_modules` and the `.env` pair.

## ▶ RUNNING 2026-09-01 — DO NOT RE-ISSUE EITHER
- **`SIGNBOOK`** — Opus·MAX · `wt-1` · branch `task/signbook` (after separation). Spec:
  `docs/tasks/TASK-SIGNBOOK-the-wizard-ends-in-a-booking-request-not-a-payment.md`.
- **`LIFECYCLE`** — the ex-REQCARDS thread (Opus·HIGH) · `wt-2` · branch `task/lifecycle-b`
  (after separation). Spec: `docs/tasks/TASK-LIFECYCLE-six-states-and-the-thirty-day-horizon.md`.
- **Queued behind LIFECYCLE:** `REQCARDS` (see RESUME) · then the held `CLNR-REPO-STATE` and
  `DSNR-SITE-PUBLIC`.

## ⚠️ EXCLUSIVE OWNERSHIP (D35 — a worktree isolates git, NOT the database)
| Object / file | Owner | State |
|---|---|---|
| the onboarding wizard (`Onboarding.tsx`) · `my_onboarding_state` · `update_my_onboarding_profile` | **`SIGNBOOK`** | applied by SIGNDOOR; SIGNBOOK extends |
| `open_document_delivery_hold` · `hold_my_document_delivery` · `deliver_executed_document_set` · `submit_my_booking_request` (new) | **`SIGNBOOK`** | per its drafted migration |
| `bookings_status_check` · `bookings` default · `booking_status_code` · `calendar_free_busy` · `request_open_time` · `request_booking_change` · `decide_booking_change` · `confirm_booking_for_purchase` · the payment-confirmation trigger on `purchases` | ⚠️ **`LIFECYCLE`** | 🔒 **SIGNBOOK CALLS `request_open_time` and may not edit it** — its migration header already says so |
| `_ensure_plan_horizon` · `ensure_standing_slots` · `mint_recurring_allotments` | **`LIFECYCLE`** | the three `current_date + 90` sites — was reserved for CR-90/97; LIFECYCLE is that build's first machine |
| the staff dashboard cards · the client payment modal | **reserve for `REQCARDS`** | queued |
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

## OWNER CHECKLISTS UNRUN — the half no thread can prove
`FIX1` §8 · `FIX2` §9 · **`FIX4` §11 (13 items, the biggest visual change)** · `CR85` §8 ·
`MODAL2` · `BACKDATE` §8 · `BOOKS1` §14 · **`SIGNDOOR` — ⚠️ load `/sign/rider` and count the boxes;
"exactly two" is the whole task and only its own probe has tested it.**
