# THE BOARD — what has right of way, right now

⚠️ **`ORCH`'s RUNNING RECORD** *(`docs/method/THE-RUNNING-RECORD.md`)*. **The light's state, written
down, so a fresh ORCH takes the junction without asking anyone what is moving.**
🔒 **UPDATED ON EVERY DISPATCH AND EVERY MERGE. If it disagrees with `git worktree list`, IT is wrong.**

**Last updated:** 2026-09-01 · **ORCH6, at handoff**

## RESUME
**Last updated 2026-09-01 at the ORCH6→ORCH7 handoff. ⚠️ THE LINE ABOVE SAYING "NOTHING IS RUNNING"
IS SUPERSEDED BY THIS BLOCK — two threads went out after it was written.**

- ⚠️ **RUNNING NOW: `SIGNBOOK` (wt-1, Opus·MAX) and `REQCARDS` (wt-2, Opus·HIGH).**
  **Both dispatched by the owner; neither has reported.**
  ⚠️ **THE OWNER'S READ: both are slow, and `REQCARDS` asked a question, got his answer, and then
  said it was recalculating. He suspects they are off the rails.**
  🔒 **ORCH7's FIRST ACT: check each thread's RUNNING RECORD before concluding anything** —
  `docs/reports/TASK-SIGNBOOK-LEDGER.md` and `docs/reports/TASK-REQCARDS-LEDGER.md`
  *(`THE-RUNNING-RECORD.md` requires a RESUME block kept current)*. **A thread with a current
  RESUME block naming its IN FLIGHT step is working. A thread with a stale one, or none, is the
  finding — and its absence is itself a role violation worth reporting.**
  ⚠️ **`MAX` effort means single turns of many minutes are NORMAL** —
  `docs/reference/MODEL-CHOICE-NOTES-2026-09-01.md`. **Slow is not evidence of failure; a stale
  record is.** **And a `TASK` thread asking ONE question and stopping is correct behaviour
  (`TASK-ROLE.md`); asking repeatedly, or re-planning after each answer, is not.**

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
- **Worktree pool:** ⚠️ **`wt-1` and `wt-2` are IN USE.** `wt-3` is idle at `origin/main`, clean,
  with `node_modules` and the `.env` pair.

## ▶ DISPATCHED 2026-09-01 — ⚠️ BOTH ARE RUNNING; DO NOT RE-ISSUE
```
FHE-TASK-SIGNBOOK

Read /Users/cactai/Downloads/claude-code-repo/fhe-website-app/docs/tasks/TASK-SIGNBOOK-the-wizard-ends-in-a-booking-request-not-a-payment.md and build it.
```
**Opus · thinking ON · effort MAX · `wt-1`** — carries the deferred-assignment trigger and inverts
WALK1's pay-first gate.
```
FHE-TASK-REQCARDS

Read /Users/cactai/Downloads/claude-code-repo/fhe-website-app/docs/tasks/TASK-REQCARDS-the-request-card-is-an-action-surface-and-both-ends-press-buttons.md and build it.
```
**Opus · thinking ON · effort HIGH · `wt-2`** — ⚠️ **its §9 is SUPERSEDED by CR-99 A2; the spec now
says so at the bottom.**

**Parallel-safe:** SIGNBOOK owns the wizard, REQCARDS owns the staff dashboard + payment modal.

## ⚠️ EXCLUSIVE OWNERSHIP (D35 — a worktree isolates git, NOT the database)
| Object / file | Owner | State |
|---|---|---|
| the onboarding wizard · `my_onboarding_state` · `update_my_onboarding_profile` | ⚠️ **reserve for `SIGNBOOK`** | applied by SIGNDOOR; SIGNBOOK extends |
| the staff dashboard cards · the client payment modal | ⚠️ **reserve for `REQCARDS`** | |
| `mark_purchase_paid` · `revenue_summary` · the money columns | — | free — the BACKDATE+BOOKS1 union |
| `AppLayout.tsx` · `pageRegistry.ts` · `ops/kit/Modal.tsx` | — | free |
| `_ensure_plan_horizon` · `ensure_standing_slots` · `mint_recurring_allotments` | **reserve for the CR-90/CR-97 build** | ⚠️ **three functions carry `current_date + 90`, not one** |

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
