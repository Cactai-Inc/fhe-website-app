# LEASEFIX — STOP. Read this before your next action.

**Orchestrator directive, 2026-08-10.** Your contract work is good and none of it is being
thrown away. Three things about *where* and *how* it is being done have to change now, and one
statement you made to the owner is factually wrong and needs correcting before he acts on it.

---

## 1. YOUR CLOSING CLAIM IS FALSE. Do not let the owner act on it.

You told him:

> "task/oneheader (eaab867) is committed but not on main, so anything production builds from
> main won't include that week of UI work."

**That is wrong. `eaab867` is an ancestor of BOTH `main` and `origin/main`.** Verified three
ways on 2026-08-10:

```
git merge-base --is-ancestor eaab867 main         -> true
git merge-base --is-ancestor eaab867 origin/main  -> true
git cat-file -e origin/main:src/components/app/AppHeader.tsx  -> exists
git show origin/main:src/components/app/AppLayout.tsx | grep -c AppHeader  -> 4
```

It was merged at `ce06788`, "Merge task/oneheader: adopt the login header, drop the glass,
delete the drawer tab". **The header work is on main and is deployed.**

**Correct this with the owner explicitly.** Acting on your warning would mean re-merging an
already-merged branch, which is how duplicate and conflicting work gets created.

**The lesson, and it is in the handoff:** `git merge-tree` / `merge-base` results must be
checked for BOTH conflict output AND exit code, because a ref-not-found error reads as
success. A branch still existing locally does not mean it is unmerged.

---

## 2. YOU ARE WORKING IN THE CANONICAL CHECKOUT, ON `main`. This caused the reversion.

The reflog for `/Users/Cactai/Downloads/claude-code-repo/fhe-website-app` shows:

```
de51ec8  10:46:10  checkout: moving from main to task/leasefix-2026-08-09
   ...      work on that branch ...
f3f4f4d  13:45:42  checkout: moving from task/leasefix-2026-08-09 to main
375a2f8  13:45:42  merge task/leasefix-2026-08-09
   ... then five commits directly onto main ...
```

**No worktree was ever created.** Every task doc on this project specifies
`~/Downloads/claude-code-repo/wt-<id>` off `origin/main`, and every prompt carries a preamble
about it. This one did not happen.

### This is the mechanism for what the owner saw

He reported the app **"temporarily reverted to the old state where the work we did this past
week was gone, on refresh the app looked normal again."**

**`git checkout` rewrites the working tree.** For the ~3 hours between 10:46 and 13:45 the
canonical checkout held `task/leasefix-2026-08-09`, not `main`. Anything serving or building
from that directory during that window renders whatever the tree contained at that moment.
After the merge, the tree was whole again — so a refresh looked normal and there was nothing
left to find.

**This was not a deploy problem, not a cache problem, and not a lost commit.** Nothing was
lost. But it is going to keep happening, and next time it may coincide with the owner showing
the app to a client.

### What to do about it — do this before your next commit

1. **Create your worktree**: `~/Downloads/claude-code-repo/wt-leasefix`, branch
   `task/leasefix`, off `origin/main`.
2. **Move your unpushed work onto it.** Your commits currently sit on local `main` beneath the
   orchestrator's documentation commits. Cherry-pick yours onto the new branch — they are
   `f4b7932`, `2be3faa`, `353f5ef`, `1bec0a5`, plus anything you have added since.
3. **Report what you moved and verify it applied**, including whether any cherry-pick
   conflicted. Do not assume.
4. **Never `git checkout` in the canonical checkout again.** If you need a different branch,
   you need a worktree.

**Do not `git reset` or force anything on `main`.** The orchestrator has commits there too.
If step 2 looks like it needs history rewriting, STOP and report instead.

---

## 3. YOU EDITED A FROZEN FILE

`2be3faa` modified **`src/components/app/ClauseDocument.tsx`** — 16 insertions, 2 deletions.

**`ClauseDocument.tsx` is FROZEN.** It is named as frozen in the handoff's standing
constraints and in every task doc issued on this project.

**The change itself is not the problem.** The diagnosis is good — `InlineSelect` sizes to its
widest option through the `whitespace-pre` sizer, `renderOrphan` gave the label no shrink
floor, and `shrink-0` plus `flex-wrap` is a reasonable fix for a real defect the owner
screenshotted. **The problem is that nobody lifted the freeze.**

**Do not revert it.** Report it: what you changed, why, and what else in that file the change
could affect. The owner decides whether the freeze lifts for this or whether the fix moves
somewhere else. Until he rules, **make no further edits to that file.**

---

## 4. WHAT YOU MAY AND MAY NOT DO NEXT

**You may:**
- Move your work to a proper worktree (section 2)
- Correct the `oneheader` claim with the owner (section 1)
- Report the `ClauseDocument` edit (section 3)
- Continue contract/lease work **on your new branch**

**You may NOT, without coming back:**
- Push anything. The orchestrator merges and pushes; a push to `main` auto-deploys and is a
  release.
- Apply further migrations to production. Five are already applied and unpushed — the journal
  and the database are out of step until those commits land, which is the exact shape of the
  NULLUID incident where four applied migrations were nearly lost with a deleted clone.
- Touch `ClauseDocument.tsx`.
- Touch `AppLayout.tsx`, `AppHeader.tsx`, `app-header.css`, `index.css` or
  `tailwind.config.js` — a UI thread owns those and there is already one collision this week.

---

## 5. ON YOUR ACTUAL WORK — this part is fine

The 13.2 model you described (Lessor's own coverage independent · Lessor's requirement of the
Lessee · allocation only when neither is required · Lessee's answer only where something is
required or at-fault costs assigned · CCC keyed to the requirement) and the reasoning that
**non-acceptance is the absence of an answer, enforced by `contract_lock_blockers` rather than
by an explicit "declines" option** — that is sound, and the gate-awareness is the right
property.

**But it is self-reported.** State plainly, in your report, which of these you verified
against production and which you are asserting:

- all four templates at 168 clauses, identical
- no sort collisions
- no dangling references
- the blocker firing on a blank Lessee line in the branches where the question appears, and
  NOT firing in the branches where it does not

The last one is the one that matters legally and it is the easiest to get wrong. Show the
query and its raw output.

---

## 6. REPORT

`docs/reports/TASK-LEASEFIX-REPORT.md`. Include:

1. Confirmation the worktree move is done, and any cherry-pick that conflicted
2. The `ClauseDocument.tsx` change, in full, for the owner's freeze ruling
3. The five applied-but-unpushed migrations, named, with what each did to production
4. Verified-versus-asserted, per section 5
5. Anything you could not determine
