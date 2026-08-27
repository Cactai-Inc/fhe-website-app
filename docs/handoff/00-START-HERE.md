# START HERE — taking over the FHE orchestration workload

**Written 2026-08-26 by the outgoing orchestrator thread, at the owner's request, because that thread
is approaching compaction.** ⚠️ **This file instructs. It is not a status report.** If you finish it
and still have to ask the owner how to operate or what to do first, it failed — fix it rather than
asking him.

---

## WHERE YOU ARE

```
repo        /Users/cactai/Downloads/claude-code-repo/fhe-website-app
branch      main — pushed and clean
database    Supabase lrstswfxfsezdmvkvukc — connection string is LINE 1 of .env.db (gitignored)
worktrees   wt-contractoptions (task/contractoptions — ⚠️ ONE COMMIT DELIBERATELY UNMERGED, see 04)
            wt-paysign         (task/paysign — the orchestrator's own scratch branch)
            wt-dealparty       (task/pagefit — merged long ago, safe to remove)
platform    macOS. Every path above is absolute and real.
```

⚠️ **`cd` into the repo before anything.** A fresh session starts in `/Users/Cactai` or `~/Downloads`.

## READ THESE, IN THIS ORDER

1. **`docs/ORCHESTRATOR.md`** — ⚠️ **THE ROLE. READ IT FIRST AND ACTUALLY READ IT.** The outgoing
   thread performed this role for a full session **without having read this file**, and the owner
   caught it: *"you are still shooting from the hip rather than working from tested and verified
   instructions."* Four documented requirements were missing from work already handed out — the
   mandatory `cd` in a spawn prompt, THE REACH, THE TELL, and TEARDOWN. **Do not repeat that.**
2. **`docs/handoff/02-THE-SIX-STEP-METHOD.md`** *(a copy of `docs/METHOD-change-orders.md`, which
   stays canonical)* — how the owner works, in his own words. **The capture rules are the ones most
   often broken.**
3. **`docs/handoff/03-REMAINING-WORK.md`** — everything outstanding.
4. **`docs/handoff/04-OPEN-QUESTIONS.md`** — what is waiting on HIM. **Do not re-derive these; he has
   been asked.**
5. **`CLAUDE.md`** — the settled decisions D1–D33. **D33 is new today.**

## THE THREE THINGS THAT WILL BITE YOU FASTEST

1. ⚠️ **Code commits are blocked in the canonical checkout.** Work in a worktree at
   `~/Downloads/claude-code-repo/wt-<id>`. As the orchestrator MERGING a branch, `FHE_ALLOW_CODE=1
   git commit …` is the sanctioned exception.
2. ⚠️ **Worktrees need `.env.db` AND `.env` copied in explicitly** — both gitignored, neither
   propagates, and `npm run build` dies without `.env`.
3. ⚠️ **NEVER trust a self-reported "done."** Every claim in this session that was checked was worth
   checking. Two examples, both from today: a thread reported an intake gate as `complete=true` when
   it was still false for a different and correct reason; and a handoff of mine asserted two tables
   "already agree on their shape" when they agreed on columns and implemented **opposite** storage
   rules. **Diff against the MERGE-BASE, verify the headline claim in production with your own query,
   and check the reach in the source.**

## HOW THE OWNER WORKS — the part that is not in any rules file

- **He is the only person who runs threads.** You author the spec, hand him a two-line prompt, he
  runs it, you audit and merge. **You never run one.**
- ⚠️ **He asks a build thread to read its handoff back to him before starting.** That is deliberate
  and he likes it — *"i like having its understanding of what you authored read back to you so you
  can validate its going in the right direction before starting."* **It is a check on YOUR authoring,
  not on the thread's comprehension.** It has already caught two incomplete specs.
- **Give a recommendation, not a survey.** He asks "which is better" and expects an answer.
- **When he corrects you, say so plainly once and move on.** No re-litigating, no apology paragraphs.
- **He thinks out loud.** A long message listing ten things is not ten assignments.
- ⚠️ **He is right more often than not when he pushes back on architecture.** The clearest instance
  today: he rejected a trigger that kept two copies of a fact in sync — *"every ref should always read
  source everytime something is viewed"* — and the root fix turned out to be five readers, not the
  fourteen that had been claimed.

## THE ONE LIVE THING

⚠️ **Pamela Godde's lease is real, in production, and about to be sent.** `HORSE_LEASE_V2`,
document `7adcd08f-fd5d-40f9-b726-634074266d7c`, she is the **LESSOR**, FHE is the LESSEE.
**Rehearse anything destructive against it inside `BEGIN; … ROLLBACK;` first.** She has no auth
identity yet, so the intake gate cannot be exercised as her in a browser.
**What still blocks her:** her own mailing address, which the intake form exists to collect. Nothing
else — that was verified end to end today.
