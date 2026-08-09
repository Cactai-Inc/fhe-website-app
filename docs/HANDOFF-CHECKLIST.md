# Orchestrator handoff — requirements checklist

**WRITTEN 2026-08-08 — `docs/ORCHESTRATOR-HANDOFF.md`.** Every required line below is validated present. This file exists to (a) preserve the owner's instruction
verbatim, (b) list every required element as a checkable line, and (c) hold suggested
additions for the owner to approve or remove.

**Trigger: write the handoff when A15 ships.**

---

## The owner's instruction, verbatim — 2026-08-08

> We need to handoff the this thread to a new session. Your job is to make that happend
> cleanly, we are finishing A1-15 here then shipping the handoff which needs to explain your
> role and the process workflow we are running. This includes, how you choose what to run
> (one at a time from you to me), how you compose what you write for each task thread and
> what the file contains and what the prompt contains, and how you review the output, how you
> handle the scenarios that come up when a thread is completed (success or failed and
> everything in between), and how you manage the repo, the merges, the pushes, and the
> communication we have for planning, organizing, changes, errors, and new requests. Do not
> author this handoff file now. keep this message and make a companion file with a checklist
> placing each of the requirements from this message on its own line on that list. When the
> time comes, you will use this list to write the handoff, you will use the list for
> validation that everything required has been included. You will also produce a list of
> suggestions for things that are missing from my request. I will review the this list and
> approve or remove each suggestion.
>
> Proceed with A1-15. Save this message content to review when A15 ships.

---

## REQUIRED — from the owner's message. Every line must be in the handoff.

- [x] 1. Explain the orchestrator's **role**
- [x] 2. Explain the **process workflow** we are running
- [x] 3. **How you choose what to run** — one at a time, from orchestrator to owner
- [x] 4. **How you compose what you write** for each task thread
- [x] 5. **What the task FILE contains**
- [x] 6. **What the PROMPT contains**
- [x] 7. **How you review the output**
- [x] 8. Handling a completed thread — **success**
- [x] 9. Handling a completed thread — **failure**
- [x] 10. Handling a completed thread — **everything in between**
- [x] 11. **How you manage the repo**
- [x] 12. **Merges**
- [x] 13. **Pushes**
- [x] 14. Communication — **planning**
- [x] 15. Communication — **organizing**
- [x] 16. Communication — **changes**
- [x] 17. Communication — **errors**
- [x] 18. Communication — **new requests**

---

## SUGGESTED ADDITIONS — owner approves or removes each

Not requested. Each is something this session learned the hard way and a new orchestrator
would otherwise rediscover at the owner's expense.

- [x] **S1. Thread naming.** The tab title is auto-generated and drops a `THREAD ID:` header
      or an `ID — description` prefix. Only the ID **alone on its own line, with no
      description**, survives. Three attempts, one worked. Without this a new orchestrator
      repeats all three.
- [x] **S2. Worktree rules.** One worktree per thread, off `origin/main`, at
      `~/Downloads/claude-code-repo/wt-<id>`. **Never `~/Desktop`** — iCloud emptied that
      directory mid-session and destroyed a clone's `.git`, stranding a completed thread's
      migrations that had to be recovered by hand off the disk.
- [x] **S3. Verify before asserting.** The single rule that has caught the most. Includes:
      query the live DB rather than infer; re-check `has_*_privilege()` after every revoke
      (three revokes silently no-opped); **grep the built CSS for every arbitrary Tailwind
      value** (two produced no rule at all and were shipped as working).
- [x] **S4. Standing constraints that outlive any one task.** Sarah's document
      `704c8d2d-…` is a live negotiation, read-only. `ClauseDocument.tsx` is FROZEN.
      Executed documents are never swept. `signed_template_version` is evidence and is never
      rewritten to make a symptom disappear.
- [x] **S5. File ownership between concurrent threads.** Two threads holding `AppLayout.tsx`
      is how work gets clobbered. How ownership is assigned, published and released.
- [x] **S6. Migration discipline.** Dry-run in `BEGIN…ROLLBACK` with raw output, apply,
      verify with a query, commit. Plus: body-rewriting migrations must **assert the rewrite
      matched**, because a non-matching replacement silently no-ops and reports success.
- [x] **S7. Where the settled decisions live** and that they are not re-litigated —
      `CLAUDE.md` D1–D9, the owner rulings inside task docs.
- [x] **S8. What the orchestrator must NOT do.** Chief among them: **do not make design
      decisions alone.** This session shipped a rejected colour value, tuned a surface that
      never rendered, and made eight visual commits the owner rejected — every one was the
      orchestrator choosing without the owner seeing it.
- [x] **S9. Correct the artifact, not just the chat.** When the owner corrects something, the
      fix goes into the doc that carries the error, or the next thread inherits it.
- [x] **S10. The index problem.** Workstreams live in separate unindexed documents — the
      owner has already flagged that a major workstream looked absent because of it. Whatever
      replaces this must be named in the handoff.
- [x] **S11. Deploy model.** Push to `main` auto-deploys. There is no separate deploy step,
      so a push is a release and an unverified visual change reaches the owner immediately.
- [x] **S12. Task sizing and splitting.** When a task is too large or trips a model safeguard,
      how it gets split — and that reframing is only legitimate when it **narrows the actual
      request**, not when it repackages the same ask until something passes.
- [x] **S13. Model, effort and thinking settings** per task, and the basis for choosing them.
- [x] **S14. Recovering stranded work.** What to do when a thread's branch is unpushed and its
      clone is gone — the NULLUID case, recovered by hand from disk.
- [x] **S15. Owner communication style.** Wants status, not narrative: what is finalised, what
      remains, what he must decide, what can be done right now. Long prose reads as confusing.
      Vertical lists over wide tables.

---

## Validation, when the handoff is written

1. Every REQUIRED line 1–18 appears in the handoff, and can be pointed at.
2. Every APPROVED suggestion appears. Every REMOVED one does not.
3. The handoff is self-contained — a fresh session needs no part of this conversation.
