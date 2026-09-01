# THE BOARD — what has right of way, right now

⚠️ **THIS IS `ORCH`'s RUNNING RECORD** *(`docs/method/THE-RUNNING-RECORD.md`)*. **The light's state,
written down, so a fresh ORCH can take the junction without asking anyone what is moving.**
🔒 **UPDATED ON EVERY DISPATCH AND EVERY MERGE. If it disagrees with `git worktree list`, IT is wrong.**

**Last updated:** 2026-09-01 · **ORCH6**

## RESUME
- **DONE this session:** `FIX4` `a9ffcdcd` · `FIX5` `merge task/fix5` *(step 8 reversed)* ·
  `BACKDATE` `71b49d6b` · `CR85` `c171689e` · `MODAL2` `4c06685d` · `REAPER` `d476376f`.
  All pushed. Gates on `main`: typecheck 0 · typecheck:api 0 · lint 46 · build clean · test:api 7.
- **IN FLIGHT:** `DSGN-1` — chunking CR-90 + CR-97 from `DISCO-1-HANDOFF.md`.
- **RETURNED, NOT MERGED:** ⚠️ **`task/books1`** — applied to production, conflicts with BACKDATE in
  `api/orders-mark-paid.ts` and `PaymentReviewPage.tsx`. **Sent back to its own thread to rebase and
  resolve by union.** ⚠️ **Production already carries both changes; git does not.**
- **NEXT:** merge `books1` when it returns · route the two items below · `ORCH7` handoff.

## ⚠️ EXCLUSIVE OWNERSHIP WHILE A THREAD IS LIVE (D35)
**Declared BEFORE dispatch. A database object is owned across every running thread, not per file.**

| Object / file | Owner | State |
|---|---|---|
| `mark_purchase_paid` · `revenue_summary` · `purchases`/`purchase_items` columns | `task/books1` | ⚠️ **held until it merges** |
| `api/orders-mark-paid.ts` · `PaymentReviewPage.tsx` | ⚠️ **contended — BACKDATE (merged) vs books1** | resolve on rebase |
| `AppLayout.tsx` · `pageRegistry.ts` | — | free |
| `ops/kit/Modal.tsx` · `formState.ts` | — | free |
| `reap_expired_holds` | — | free |

## WORKTREES
| | Branch | State |
|---|---|---|
| `wt-1` `wt-2` `wt-3` | merged task branches | ⚠️ **recycle to the pool** — detach at `origin/main`, clean, keep `node_modules` + `.env` pair |
| `wt-cr85` | merged | ⚠️ **recycle or remove** |
| `wt-books1` | ⚠️ **LIVE — do not touch** | the returned thread is working in it |

## ROUTED, NOT FIXED — needs a spec, not a patch
1. ⚠️ **`reap_expired_holds` carries `anon=X`** — an unauthenticated caller can execute a function
   that WRITES. **Not probed; probing executes a write on production.**
2. ⚠️ **`isPageHidden` has ONE call site and the nav never reads `org_page_visibility`** — `CR-85`
   made this WIDER: the tenant can now toggle Catalog/Messages and nothing happens.

## WAITING ON THE OWNER
- **CR-97** — when a reschedule hold releases: notify the waitlister · first-refusal window · or
  auto-convert to `requested`.
- **CR-93** — `Escape`: currently removed on every dialog. **Not asked for; not restored.**
- **CR-88** — company expense categories, beyond marketing.
- **Owner checklists unrun:** `FIX1` §8 · `FIX2` §9 · `FIX4` §11 · `CR85` §8 · `MODAL2` · `BACKDATE` §8.
