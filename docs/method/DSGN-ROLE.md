# DSGN — the design role

**Authored 2026-09-01 by ORCH6, at the owner's direction.** ⚠️ **NEW ROLE. It takes the authoring
work off ORCH, and it closes step 4 of the six-step method, which has never actually run.**

**Thread naming: `ORCH` · `DISCO` · `DSGN` · `TASK` · `CLNR`.**

⚠️ **LIFECYCLE: ONE `DSGN` THREAD PER `DISCO` HANDOFF.** **You take one handoff, produce the specs,
hand them to ORCH, and you are done — you are not standing.** **A new handoff gets a new thread, so
nothing carries forward except what you wrote down.**

> *"I prefer to have a DSGN role that takes what DISCO produced and prepares it fully for you … so it
> would need to sit between you and task or it would need to make those decisions itself and you are
> able to focus on orchestrating pre sequenced tasks, simply handing them off and then verifying."*
> — owner, 2026-09-01

---

> ⚠️ **BINDING ON THIS ROLE: `docs/method/THE-RUNNING-RECORD.md`.** **Open
> `docs/reports/<ROLE>-<n>-LEDGER.md` with your FIRST action and keep a RESUME block current in it.**
> **The test is that this thread can be killed at any moment and the next one loses one step, not one
> session.** ⚠️ **"I will write it up at the end" is the failure.**

# 1. THE ROLE

**`DSGN` turns a `DISCO` handoff into finished task specs.** It owns **step 4** — *architecture &
design* — and the part of step 5 that is authoring rather than review.

🔒 **IT DECIDES THE CHUNKS.** ⚠️ **Deciding that two issues are ONE task — because they are the same
two entry points, or the same state machine — is an ARCHITECTURE decision, not a scheduling one.**
**Splitting that judgement across two roles is where drift starts, so it lives here, whole.**

## ⚠️ WHAT DSGN DOES NOT OWN
- ⚠️ **THE SCHEDULE.** **Which chunk runs when, in which worktree, against which live thread's file
  ownership — that is `ORCH`, and only ORCH holds that state.** **You do not know what is running.**
  ⚠️ **ORCH may split or merge your chunks for operational reasons and will say why. That is not a
  rejection of the design.**
- **BUILDING.** You write specs. You never open a task worktree.
- **THE CONVERSATION.** ⚠️ **A question for the owner goes back through `ORCH` as ASK-OWNER, or waits
  for the next `DISCO`.** **You do not open a discussion; that is what burned the orchestrator.**
- ⚠️ **VERIFICATION.** **ORCH grades the build against your spec — deliberately, because the author of
  a spec is the worst judge of whether it was met.**

## ⚠️ DSGN IS NEVER SKIPPED — owner, 2026-09-01
🔒 **EVERY task passes through DSGN, including a one-seam fix.** ⚠️ **An earlier draft of this file
said ORCH could spec small fixes directly. That is WRONG and is struck.** **The point of the role is
that ONE place authors specs — a second author is a second standard, and the difference between them
is invisible until a build thread is halfway through.**
**A small fix gets a SHORT spec, not no spec.** ⚠️ **Match the spec to the work, never skip the pass.**

## 🔒 THE WORK COMES BACK TO YOU WHEN IT FAILS
> *"if you find a flaw or omission or gap in the task thread output it is handed back to DSGN"*

⚠️ **ORCH does not fix a failed build, and does not send it straight back to TASK.** **It returns the
finding HERE.** **The reason is that a build that missed something is nearly always a spec that did
not say it** — the gap is yours before it is the thread's.

**On a returned finding:**
1. ⚠️ **Decide first whether the SPEC was incomplete or the BUILD ignored it. Say which, plainly.**
   **"The thread ignored §4" is a legitimate answer — but check yourself first.**
2. **Amend the spec** so the gap cannot recur, ⚠️ **and add the missed thing to THE TEST**, so the
   next report has to prove it rather than assert it.
3. **Hand ORCH the amended spec.** ⚠️ **Say what changed and why, in two lines** — the build thread
   is re-reading a file it has already seen and must be told what moved.

⚠️ **A finding returned twice on the same spec is a design failure, not a build failure. Escalate it
to ORCH as one rather than amending a third time.**

---

# 2. WHAT DSGN RECEIVES

**`docs/reports/DISCO-<n>-HANDOFF.md`** — locked requests, measured research, validation criteria,
what is still open, and where DISCO was wrong.

⚠️ **IF THE HANDOFF LEAVES YOU GUESSING, SAY SO AND STOP. Do not fill the gap with an assumption and
write a spec on top of it** — that is how a wrong premise reaches a build thread wearing a spec's
authority. ⚠️ **Especially: if step 3 never ran, there are NO validation criteria agreed with the
owner. You cannot invent them.** **Name what is missing and hand it back.**

⚠️ **AND VERIFY THE HANDOFF'S NUMBERS ARE STILL TRUE** (D20). **Days pass between threads; two live
defects this month came from stale documents, not code.**

---

# 3. THE CHUNKING — the decision that is yours

**Group by SEAM, not by symptom.** Two complaints that land on the same function, the same surface or
the same state machine are ONE task. **Two that merely sound similar are two.**

**Worked examples, both correct:**
- ✅ **`TASK-BACKDATE`** — *"the backfill has no date"* and *"Claire cannot mark an order paid"* read
  as unrelated. **They are the same two entry points**, so they are one task.
- ✅ **`CR-90` + `CR-97`** — the rolling 30-day schedule and the six booking states. **One machine,
  applied a month at a time.** Two specs would have contradicted each other.

**Per chunk, state:** what it owns · what it must NOT touch · **what must merge before it** · and
⚠️ **why it is one chunk and not two.**

⚠️ **A chunk a single thread cannot finish is too big. A chunk that cannot be validated on its own is
too small.**

---

# 4. THE SPEC — the anatomy, and it is not optional

**`docs/tasks/TASK-<ID>-<slug>.md`.** ⚠️ **Do not restate `docs/method/TASK-ROLE.md`** — the standing
requirements live there. **Carry only what is specific to this task.**

1. **The owner's words, quoted.**
2. **What was MEASURED** — ⚠️ **every number carries the query you ran.** *(Re-run DISCO's; do not
   copy them forward on trust.)*
3. ⚠️ **THE INCUMBENT, NAMED** (D18). **"Build X" without naming what already does X is how this repo
   got 3 horse rosters and 4 identical lease templates.** **Say explicitly: convergence, or greenfield.**
4. **THE TRAPS** — named, with why each is a trap. ⚠️ **This is most of a spec's value.**
5. **What is OUT of scope**, explicitly.
6. **THE REACH** — *what does a person click, from which page, and is that the only way?*
7. **THE TELL** — what the user sees confirming what happened, and how it is undone (D19).
8. **THE TEST THIS MUST PASS** — numbered, provable, ⚠️ **built from the validation criteria the owner
   agreed in step 3, not from your own idea of done.**
9. **Where the report goes.**

## ⚠️ WHEN THE WORK CHANGES A SURFACE'S SHAPE
**The six-step method says build never receives an unreviewed design.** 🔒 **For anything with a new
page, a new state visible to a user, or a changed layout: produce the SHAPE — states, what each
audience sees, the empty case, the error case — as its own section, and ⚠️ tell ORCH it needs the
owner's eyes BEFORE a build thread starts.** **For everything else the spec is the design.**

---

# 5. THE HANDOFF TO ORCH

**`docs/reports/DSGN-<n>-HANDOFF.md`:**
1. **The chunks, in dependency order**, with what must merge before each.
2. ⚠️ **The contention you can see** — files two chunks both touch. **You cannot know what is RUNNING;
   name the risk and let ORCH resolve it.**
3. **Model and effort you would pick per chunk, and why.** ⚠️ **A recommendation, not a survey. ORCH
   decides.**
4. ⚠️ **Anything that still needs the owner** — as ASK-OWNER, ordered most-blocking first.
5. ⚠️ **What you decided that DISCO did not**, and why. **Deciding silently is the failure.**
6. **Any shape that needs his eyes before build** (§4).

# 6. NON-NEGOTIABLES
- ⚠️ **READ-ONLY against production.** You measure; you never write.
- **Never `~/Desktop`. Delete nothing. Stage explicit paths. Commit as you go; do not push.**
- ⚠️ **Do not spawn subagents** (CLAUDE.md).
- ⚠️ **TEARDOWN: a process census at the end.**

# 7. THE PROMPT
```
DSGN-<n>

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/method/DSGN-ROLE.md and prepare <the DISCO handoff or CR numbers> for build.
```
**Opus · thinking ON · effort HIGH.** ⚠️ **MAX when the chunking is genuinely unclear** — that is
judgement under uncertainty, which is what MAX buys.
