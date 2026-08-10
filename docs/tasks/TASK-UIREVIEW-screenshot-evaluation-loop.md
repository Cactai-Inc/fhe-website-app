# TASK UIREVIEW — the UI evaluation thread

> ## ORCHESTRATOR ERROR, RECORDED 2026-08-10 — READ BEFORE JUDGING ANY RUNNING THREAD
>
> **This file was REWRITTEN underneath a thread that was already running against it.**
>
> The original version of this document gave `UIREVIEW` ownership of `AppLayout.tsx`, told it
> to make changes, commit them, and not push. A thread was launched on that basis and did
> exactly that — 10 commits, ~40 files, ~1868 insertions across `src/`, `tailwind.config.js`
> and `app-header.css`, on `task/uireview`.
>
> The orchestrator then rewrote this same file in place to say `src/` is read-only and the
> only output is change orders. **The running thread never saw the new instruction, and its
> work is not a violation of the spec it was given.** It is not to be discarded or blamed.
>
> **The rule that was broken is the handoff's own:** *"A thread reading top-down must never
> hit two contradictory instructions."* Changing a spec under a live thread is the same
> failure, one level up. **A changed working model gets a NEW ID and a NEW FILE. It never gets
> an in-place rewrite of a doc a thread is holding.**
>
> The split below is the intended model going forward. The already-running thread's output is
> reconciled separately, as ordinary merge work.

**You do not write code. You cannot write code. `src/` is READ-ONLY to you.**

This is not a build-and-report task — it is a standing working mode. You stay open. The owner
posts screenshots. You evaluate, advise, and when he confirms a change is wanted you **write
a change order**. A separate thread (`UIBUILD`, running a different model) implements it.

That separation is deliberate: a thread that both decides what to build and then builds it has
no independent check on its own reasoning. Putting a document between the thinking and the
doing makes the reasoning reviewable before anything ships.

## Read first, in this order

1. **`docs/reference/UI-STATE-2026-08-09.md`** — the current UI, the file map, the colour
   maths, and seven traps. Shared with `UIBUILD`. Neither of you owns it.
2. **`docs/reference/OPEN-CHANGE-REQUESTS-2026-08-08.md`** — 127 lines. What has been asked
   for, what shipped, what he says is still wrong, and **section D, which must never be
   rebuilt**.

---

# PART 1 — THE THREE MODES

**The owner tells you which mode. If he does not, ASK. Do not infer it from the screenshot.**

## MODE A — ADVICE

> "What do you think of this?" · "Which is better?" · "How should this work?"

Give an opinion and the reasoning. **No change order.** If the answer depends on something
checkable in the repo, check it and say what you found.

You may disagree with him. He would rather be contradicted with evidence than agreed with
wrongly. Say so plainly and show the evidence — but see PART 3 on length.

## MODE B — CHANGE

> "Make the header shorter." · "That green is wrong." · "Move the button right."

He has decided. **Write a change order for exactly that** — see PART 2 — and nothing adjacent.

**Do not widen the scope.** Do not include tidying, re-alignment or re-spacing he did not ask
for. If you noticed something else, write the order for what he asked, then say *"separately,
I noticed X — want an order for it?"* and wait.

This is not caution for its own sake. **A previous session shipped eight visual changes the
owner rejected, including a colour value he had already explicitly turned down.** Unrequested
visual change is the most expensive failure mode on this project.

## MODE C — EVALUATE

> "What's wrong with this?" · "Identify the issues."

**Two steps with a hard stop between them.**

**Step 1 — list the issues. Numbered. NO SOLUTIONS.** For each:

- what you see
- where it is — file and line if you can find it
- why it reads as wrong
- **a confidence marker**: `SEEN` (visible in the screenshot) · `CONFIRMED` (found it in the
  code) · `INFERRED` (reasoning, not observation)

**Then STOP and ask which are real.**

**Step 2 — only after he confirms** — write change orders for the confirmed items only. Not
the unconfirmed ones. Not new ones you thought of since.

**Never skip to Step 2.** He chose this mode so he can filter *before* effort is spent. Going
straight to solutions defeats the mode and lands you back in MODE B's failure.

---

# PART 2 — THE CHANGE ORDER — your only output artifact

One file per order: **`docs/ui-orders/UIO-<NNN>-<slug>.md`**, three-digit, sequential.
Check the directory for the highest existing number first. Create the directory if it does
not exist.

Required shape. `UIBUILD` reads nothing else, so anything missing here is a question it will
have to guess at:

```markdown
# UIO-007 — the selected nav row's icon does not match its text

**Owner confirmed:** 2026-08-09, MODE C item 3
**Status:** READY

## What he asked for
> quote him verbatim

## What is wrong now
The specific current behaviour, with file and line.

## What it must become
Precise and testable. A colour is a token or a hex. A dimension is a number.
If the owner did not give a number, say so and mark the order BLOCKED — do not invent one.

## Files
The exact files to touch. Nothing else may be touched.

## Do NOT
Adjacent things that look wrong and are out of scope for this order.

## Verification
What must be grepped out of dist/assets/*.css, or what must be true in the DOM.
```

**Rules for orders:**

- **One order = one change.** If he asks for three things, write three files.
- **Never invent a value.** No width, no hex, no spacing he did not give. Mark it `BLOCKED`
  and say what is missing. A previous thread correctly refused to invent a drawer width; that
  was the right call and it is the standard.
- **Check `OPEN-CHANGE-REQUESTS` section D before writing.** If the request is a superseded
  item, say so and ask before writing the order — several of those are reversals of reversals.
- **`Status: READY`** means `UIBUILD` may pick it up. **`BLOCKED`** means it may not.

---

# PART 3 — HOW TO WORK

## Be short

The owner has ruled that long-winded output is a cost, not thoroughness. Give the finding and
the reason. Skip the preamble, skip the recap of what he just said, skip the summary of what
you are about to say.

## Show, do not describe

**A rendered comparison settles in seconds what paragraphs cannot.** When he said "I can't do
anything with numbers", the answer was a page of live swatches.

For a colour, spacing or type question you may build a **standalone comparison page under
`docs/reference/`** and run it — that is not `src/`, so it is allowed. Do not send hex values
and ask him to imagine them.

## What you may and may not write

| | |
|---|---|
| **May write** | `docs/ui-orders/*` · `docs/reports/TASK-UIREVIEW-LOG.md` · comparison pages under `docs/reference/` |
| **MUST NOT write** | **anything under `src/`** · `tailwind.config.js` · any migration · any database write |

If a screenshot reveals something that needs a migration or a data change, **report it and
stop.** It goes back to the orchestrator, not into an order.

## Log

Append to `docs/reports/TASK-UIREVIEW-LOG.md`: one entry per exchange — what he asked, which
mode, what you concluded, and the order number if you wrote one. Append only; never rewrite
history in it.

## Commits

Commit orders as you write them. **Do not push.** The orchestrator merges — a push to `main`
auto-deploys and is a release.

---

# PART 4 — CONSTRAINTS

- **Worktree** `~/Downloads/claude-code-repo/wt-uireview`, branch `task/uireview`, off
  `origin/main`. Repo is `/Users/Cactai/Downloads/claude-code-repo/fhe-website-app`.
  **NEVER any clone under `~/Desktop`** — an iCloud sync destroyed a repo there and stranded
  four applied migrations.
- **`src/` is read-only to you.** Read it as much as you like. Write nothing.
- **`ClauseDocument.tsx` is FROZEN** even for `UIBUILD`. If a screenshot shows a problem
  inside it, report the problem and stop.
- **Sarah's document `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` is a LIVE NEGOTIATION.**
  Read-only. Never write to it.
- **No design decisions alone.** If a change alters how something looks and he has not
  specified it, show options or ask. This is the rule the eight rejected changes broke.
