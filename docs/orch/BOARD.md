# THE BOARD — what has right of way, right now

⚠️ **THIS IS `ORCH`'s RUNNING RECORD** *(`docs/method/THE-RUNNING-RECORD.md`)*. **The light's state,
written down, so a fresh ORCH can take the junction without asking anyone what is moving.**
🔒 **UPDATED ON EVERY DISPATCH AND EVERY MERGE. If it disagrees with `git worktree list`, IT is wrong.**

**Last updated:** 2026-09-01 · **ORCH6**

## RESUME
**Last updated 2026-09-01 · ORCH6.**
- **MERGED AND PUSHED this session:** `FIX4` · `FIX5` *(step 8 reversed)* · `BACKDATE` · `CR85` ·
  `MODAL2` · `REAPER` · `BOOKS1` *(after a rebase — the D35 collision, ORCH's fault, now closed)*.
  **Gates on `main`: typecheck 0 · typecheck:api 0 · lint 46 · build clean · `test:api` 7/7.**
- **IN FLIGHT:** ⚠️ **NOTHING IS RUNNING.** Every task branch is merged; five pool worktrees idle at
  `origin/main`, clean, with `node_modules` and the `.env` pair.
- **SPECCED, NOT DISPATCHED:** `TASK-LIFECYCLE` and `TASK-MONTHEND` *(DSGN-1)*. ⚠️ **LIFECYCLE §6
  needs the OWNER'S EYES first — new user-visible states and a sixth colour on a five-row legend.**
- **NEXT:** the owner's four answers below · dispatch LIFECYCLE + MONTHEND · a spec for the two
  ROUTED items · `ORCH7` handoff.

## ⚠️ EXCLUSIVE OWNERSHIP WHILE A THREAD IS LIVE (D35)
**Declared BEFORE dispatch. A database object is owned across every running thread, not per file.**

| Object / file | Owner | State |
|---|---|---|
| `mark_purchase_paid` · `revenue_summary` · the money columns | — | **free — merged as the union of BACKDATE + BOOKS1** |
| `api/orders-mark-paid.ts` · `PaymentReviewPage.tsx` | — | **free** |
| ⚠️ `_ensure_plan_horizon` · `ensure_standing_slots` · `mint_recurring_allotments` | **reserve for `TASK-LIFECYCLE`** | ⚠️ **three functions carry `current_date + 90`, not one — DSGN-1's correction to DISCO-1** |
| `AppLayout.tsx` · `pageRegistry.ts` | — | free |
| `ops/kit/Modal.tsx` · `formState.ts` | — | free |
| `reap_expired_holds` | — | free |

## WORKTREES
| | Branch | State |
|---|---|---|
| `wt-1` … `wt-5` | detached at `origin/main` | ✅ **idle pool, clean, `node_modules` + `.env` pair in place. Take one; do not create a new one.** |

## ROUTED, NOT FIXED — needs a spec, not a patch
1. ⚠️ **`reap_expired_holds` carries `anon=X`** — an unauthenticated caller can execute a function
   that WRITES. **Not probed; probing executes a write on production.**
2. ⚠️ **`isPageHidden` has ONE call site and the nav never reads `org_page_visibility`** — `CR-85`
   made this WIDER: the tenant can now toggle Catalog/Messages and nothing happens.

## WAITING ON THE OWNER — ⚠️ four, and two block a dispatch
- **CR-97** — when a reschedule hold releases: notify the waitlister · first-refusal window · or
  auto-convert to `requested`.
- **CR-93** — `Escape`: currently removed on every dialog. **Not asked for; not restored.**
- **CR-88** — company expense categories, beyond marketing.
- ⚠️ **The 43 sessions already scheduled beyond 30+30** *(Madeline's November among them)*. **DSGN-1
  ruled they are NOT retro-deleted under D32 — the owner chooses.** **Blocks `TASK-LIFECYCLE`.**
- ⚠️ **Confirm the reading of "availability is the absence of a block"** — DSGN-1 read it as governing
  what `cancelled` and a released `moved` BECOME, **not as authority to delete the 594 `Open` chips**,
  since that is the CR-03/CR-06 inversion already recorded as blocked. **Blocks `TASK-LIFECYCLE`.**
- ⚠️ **`TASK-LIFECYCLE` §6 needs his eyes before a build thread starts** — new user-visible states and
  a sixth colour on a five-row legend.
- **Owner checklists unrun:** `FIX1` §8 · `FIX2` §9 · `FIX4` §11 · `CR85` §8 · `MODAL2` · `BACKDATE` §8.
