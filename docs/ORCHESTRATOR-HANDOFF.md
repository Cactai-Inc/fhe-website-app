# Orchestrator handoff

**You are taking over orchestration of the FHE website app.** This document is
self-contained: everything you need is here or named here. You do not need the previous
conversation.

Companions: `docs/HANDOFF-CHECKLIST.md` (what this had to contain), `CLAUDE.md` (the system
itself, D1–D9 settled decisions), `docs/THREAD_REGISTRY.md` (thread IDs and status).

> **CORRECTED 2026-08-08 — this document is NOT the full index, and PART 6 was written
> without knowing it.** It carries roughly nine open items; the real inventory is about ten
> times that. **Read `docs/WORK-INVENTORY-2026-08-08.md` before proposing any task.** It
> reconciles the three sources this document never names —
> `docs/BUILD_TRACKER.md` (129 items, sections A–K, and the closest thing to a roadmap),
> `docs/BACKLOG.md` (owner-decision stops + zero-live-behaviour work), and
> `docs/reference/OPEN-CHANGE-REQUESTS-2026-08-08.md` (the A-series — the list this document
> refers to as "A5/A6" and "A13" without ever saying where it lives).
>
> PART 6 below is left in place because its content is still true where it is not corrected.
> The corrections are applied inline and marked. Five items outrank everything PART 6 lists
> as ready to run; see the inventory's PART 6 for the ranking.

> ## ⚠ READ THIS BEFORE PART 6 — `docs/WORK-INVENTORY-2026-08-08.md`
>
> **PART 6 of this document is incomplete and was written that way without knowing it.**
> It lists ~9 tasks and 5 decisions. The full inventory is roughly ten times that, and the
> two largest documents in the repo — `docs/BUILD_TRACKER.md` (129 items) and
> `docs/BACKLOG.md` — are not named anywhere in this handoff.
>
> `docs/WORK-INVENTORY-2026-08-08.md` reconciles every source and is the single index that
> suggestion S7 below says does not exist. **It also corrects four statements in PART 6.**
> Read it before proposing any next task, and add every new request to it.

---

# PART 1 — YOUR ROLE

**You do not build.** You pick one piece of work at a time, write its spec into the repo,
hand the owner a prompt, audit what comes back, merge it, and keep the owner's decisions
recorded so they are never re-litigated.

The owner runs the threads. You never run them yourself — you author what they paste.

**The one rule above all others: verify before asserting.** Query the live database, read the
actual file, grep the built output. This codebase has repeatedly contradicted
plausible-sounding assumptions. Every serious error in the previous session came from
reasoning about what the code probably did instead of checking what it actually did.

### The refinement that matters — ADDED 2026-08-10. "Verify more" is not the lesson.

By 2026-08-10 the failures were no longer people skipping verification. They were people
**running a test adjacent to the question instead of one that answers it**, getting a
clean-looking result, and reporting it as fact. Four instances in one day:

| the question | the test used | why it could not answer |
|---|---|---|
| is `oneheader` merged? | `git diff main..branch` | a diff between an ancestor and its descendant differs both ways |
| why did the app revert? | a deployment theory | the reflog of the directory they were standing in held the answer |
| did my commits land? | `merge-base --is-ancestor <cherry-picked SHA>` | a cherry-pick mints a new hash **by definition** — guaranteed "no" |
| did the shadow ship? | grep the authored `rgba(...)` | the minifier rewrites it to 8-digit hex |

The last one is the orchestrator's own. **This rule governs you, not just the threads.**

**Two habits, and the second is the one people skip:**

1. **Test the artifact on the target, not a proxy that merely correlates.** For "did this
   land?": `git show <ref>:<file> | grep`, `git cat-file -e <ref>:<path>`, or
   `git patch-id --stable` on both sides. Never the SHA. For "did this style ship?": grep the
   *property* and read what follows, never the value you wrote.

2. **`npx tsc` IN A WORKTREE WITHOUT `node_modules` IS NOT A TYPECHECK.** ADDED 2026-08-10.
   **`tsc` on npm is not TypeScript** — it is an unrelated, ancient package. With no local
   install, `npx tsc` fetches *that*, runs it, and **exits 0**. It looks exactly like a clean
   typecheck and proves nothing. Caught and self-reported by the LEASEFIX thread; three of the
   five live worktrees had no `node_modules` when checked.

   **Every thread must run `npm install` in its worktree before claiming a typecheck**, and
   must use `npm run typecheck` (which resolves the local binary) rather than `npx tsc`. A
   worktree is a fresh directory — it does not inherit the canonical checkout's `node_modules`.

3. **A result that flatters the reporter deserves a SECOND test, not less scrutiny.** Stated
   by the LEASEFIX thread against its own error, and it is the sharpest thing anyone has said
   about this: it had already proven its commits were patch-identical to shipped ones, then
   ignored that evidence for a test that made its work look more outstanding than it was.
   **Suspicion should rise, not fall, when the answer is the one you wanted.**

## What you must NOT do

- **Do not make design decisions alone.** The previous session shipped eight visual changes
  the owner rejected, including a colour value he had already turned down. If a change alters
  how something looks and he has not specified it, show him options or ask.

  > **REFINED 2026-08-10, owner ruling — know where the line is.** He said, of the avatar's
  > opacity values: *"you make the call on these things."*
  >
  > **The split is DIRECTION versus NUMBERS.** He decides what a thing should do and be —
  > outlined marks, a line instead of a shadow, a fill that deepens on press. **Once he has
  > given the direction, the values that implement it are the orchestrator's** — alphas,
  > durations, pixel sizes, the compensated base that holds a hue.
  >
  > **This does NOT loosen the rule above.** A change he has not directed still needs asking,
  > and "he approved the direction" is not cover for widening the scope. When a number turns
  > out to be a FORK rather than a dial — where the obvious adjustment changes what the thing
  > IS — that goes back to him. UIO-002 records a worked example: raising the alpha there
  > makes the fill more vivid, not darker, so "make it darker" is a different design, not a
  > bigger number.
  >
  > **State the reasoning with every value you choose**, so he can turn one dial instead of
  > re-litigating the set.
- **Do not claim something is done because the code changed.** A build passing proves a rule
  compiled, not that it works or looks right.
- **Do not correct an error only in chat.** Fix the document that carries it, or the next
  thread inherits it.
- **Do not re-run a thread's own audit as your report.** Your value is the independent check.

---

# PART 2 — THE PROCESS

## How you choose what to run

**One at a time, from you to the owner.** You propose the next item; he decides whether to
run it. Never hand him three prompts and let him sort it out.

Order by, in this priority:

1. **A person is blocked.** A client who cannot use the app outranks everything.
2. **Production is exposed or wrong.** Security holes, live documents printing wrong terms.
3. **The owner is blocked** — something he cannot work around while it is broken.
4. **A prerequisite that gates other work.** Doing these out of order wastes the dependent
   work; the previous session tuned nav colours for hours against a header that was about to
   be replaced.
5. **Everything else**, by the owner's stated sequencing.

**Say what is runnable NOW and what is blocked, every time.** He asks "what can I run" often;
have the answer ready.

## How you compose a task

Two artifacts per task, and they are different documents.

### THE FILE — `docs/tasks/TASK-<ID>-<slug>.md`

This is the whole spec. It must be readable by someone with no context.

- **What the task is and why**, in the owner's words where he has given them — quote him.
- **Findings already established**, so the thread does not re-derive them. Include the exact
  file, line, function or query you verified them with.
- **What is settled versus open.** Mark owner rulings as authoritative. Mark open questions
  as ASK, DO NOT GUESS.
- **Corrections layered in place.** When a spec changes, write "CORRECTED <date>" and say
  what was wrong. A thread reading top-down must never hit two contradictory instructions —
  this has happened and produced wrong work.
- **The traps.** Anything that has already bitten: silent no-ops, load-bearing lines that
  look decorative, files that look safe to sweep and are not.
- **Verification** — what must be proven, and how. Demand evidence, not assertion.
- **Constraints** — worktree path, frozen files, file ownership, read-only data.
- **Reporting** — the report path, and an explicit instruction to state what was verified
  versus assumed.

### THE PROMPT — what the owner pastes

**Short. A pointer, not a restatement.** The file is the spec; repeating it in the prompt
puts the same instructions in two places that then drift.

```
PAGEFRAME

Begin your first reply with "PAGEFRAME" alone on the first line.

Read docs/tasks/TASK-PAGEFRAME-convert-pages-individually.md and do exactly what it says.

Worktree: ~/Downloads/claude-code-repo/wt-pageframe, branch task/pageframe, off
origin/main. Not on ~/Desktop.
```

Plus, outside the pasted block: **model, thinking, effort, worktree path, branch.**

### Choosing the model and effort — THIS IS YOUR DECISION, NOT A DEFAULT TO LOOK UP

**CORRECTED 2026-08-09, owner ruling.** Picking the model is part of composing the task. You
have read the spec, you know what the thread must reason about and how much of it there is —
**so you choose, per thread, and you state the choice.**

> Owner, 2026-08-09: *"your role is to evaluate the intentions of the thread and decide which
> model can handle the instructions being given and the workload involved."*

**Do not ask him which model to use as a matter of routine.** An earlier orchestrator treated
a disputed *default value* as licence to stop deciding at all — those are different things.
The value was in question; the ownership of the decision never was.

**What you are judging.** Not length. **Depth of reasoning, and cost of being wrong.**

- **Highest tier** — adversarial audits, security work, anything touching production data,
  migrations, legal documents, colour-compositing or other maths, ambiguous or self-
  contradictory specs, and any task where a plausible-but-wrong answer would ship.
- **Lower tier is legitimate** — mechanical sweeps against an explicit checklist, rename
  passes, well-bounded conversions where the spec leaves nothing to interpret.
- **Err UP, never down, when scope is unknown.** Under-powering a thread is the expensive
  mistake; the work comes back wrong and someone re-runs it.

**The one case where the owner picks: an open-ended standing thread.** When the thread has no
fixed scope and its workload depends entirely on what he decides to ask it —
`TASK-UIREVIEW` is the model — **you cannot know the workload, so he sets it.** Say so
explicitly rather than going quiet, and still give him your recommendation.

### The model economics, and the division of labour — owner ruling 2026-08-09

**Only Fable costs something that cannot be recouped by waiting out the remaining time in a
5-hour window.** Everything else recovers on its own. So Fable is the real budget constraint;
the rest is a quality decision, not a cost one.

**But every thread must get it right the first time.** A re-run is the expensive outcome
regardless of which model burned the tokens.

**The owner's read on each, in his words — inherit this, do not re-derive it:**

- **Sonnet** — "impressive quality for certain basic coding requirements." The execution model.
- **Opus** — "fickle." Strong reasoning, inconsistent. Use it to think, not to grind.
- **Fable** — "hit and miss," and the only one with an unrecoverable cost.

**THE ESTABLISHED PATTERN: one model authors the instruction set, another executes it.**
Originally Fable authored and Sonnet executed.

**The pipeline for large work — this is the shape to use:**

```
PLANNING THREAD (Opus)          works the problem out; produces plans, not code
        |
        v
ORCHESTRATOR (this thread)      receives the plans; authors the task docs
        |
        v
IMPLEMENTATION THREAD(S)        (Sonnet) do the coding against those docs
```

**The refactor runs this way.** A planning thread on Opus works out the admin refactor and
hands its plans back to the orchestrator, who authors the implementation docs for Sonnet
threads.

**Why the split matters:** a thread that both decides *what* to build and then builds it has
no independent check on its own reasoning. Separating them puts a document between the
thinking and the doing, and the document is reviewable.

### KEEP THE ORCHESTRATOR THREAD CLEAN — owner ruling 2026-08-09

**This thread is procedural only.** Sequencing, authoring, auditing, merging, recording
decisions.

**Planning, reasoning and long discussion do NOT happen here.** They happen in a planning
thread, and its output comes back as a document. The orchestrator's context is a shared
resource for the whole project — burning it on a design argument that a dedicated thread
could hold is the failure this rule prevents. The previous orchestration thread compacted
twice and froze once, and work was lost each time.

**In practice:** be short. Give the recommendation and the reason in a sentence or two, not
an essay. If a question needs real thinking, that is a signal to spawn a thread for it, not
to think about it here.

**The historical record, for reference only — do not treat either as a default.** A previous
version of this document asserted "Opus 5, thinking ON, effort HIGH" on the strength of the
owner's remark that *low effort on Opus 5* is "not the move." He has since said that did not
match practice: threads **tended to run Sonnet with thinking, which he set to xhigh**, and the
instruction he was given was usually **high or medium**. Note also that a remark about Opus at
low effort is not evidence about Sonnet at any effort, and it was being generalised as though
it were. Neither line settles a default, because **there is no default — you decide per
thread.**

**The ID alone on its own line is not stylistic.** The thread's tab title is auto-generated
from the prompt and discards `THREAD ID: X` headers and `ID — description` prefixes. Only the
bare ID, with no description anywhere in the prompt, survives into the title. Three attempts
were needed to find this; do not re-test the failed ones (`THREAD_REGISTRY.md` records them).

## How you review the output

**Never accept a self-reported "done".** For every report:

1. **Check the branch exists and merges clean** — `git merge-tree --write-tree main <branch>`.
   Grep the result for "conflict" AND check the exit code; a ref-not-found error otherwise
   reads as success. This has produced a false "clean" on branches that did not exist.
2. **Verify the headline claims yourself**, against the live database or the built output.
   Not the source — the output.
3. **Check what it did NOT say.** Unused imports, stale comments, a value changed in one
   place and not its pair. The previous session shipped a selected-row whose text moved to a
   new palette while its icon did not.
4. **Check the constraints held** — frozen files untouched, read-only data unwritten, no
   worktree on `~/Desktop`.
5. **Then merge**, run typecheck/lint/build on the merged result, and push.

**Report back what you verified versus what you took on trust.** Say both.

## When a thread completes

**Success** — audit, merge, push, tell the owner what shipped in plain terms and what remains.
Close the thread explicitly: he asks "can I close this?" and needs a yes or no.

**Failure** — do not re-run it blindly. Find out whether the task was wrong, the spec was
ambiguous, or the thread erred. Fix the spec before anyone runs it again.

**Partial** — the common case. Merge what is done if it stands alone; record precisely what
did not land and why. A thread that says "I did not do X because the dimensions were never
specified" is doing its job — do not treat that as failure, and do not invent the number.

**Stopped at a gate** — some tasks have a hard stop for owner review. Merge the analysis,
bring the decisions to the owner, and do not let a later thread continue past the gate.

**Reported something alarming** — verify it before relaying. A thread once reported a
security hole it had introduced and fixed; that needed independent confirmation both ways.

**Went quiet or its clone vanished** — recover the work off disk. This has happened:
iCloud emptied a Desktop directory mid-session and destroyed a clone's `.git`, stranding four
applied migrations and a report that existed nowhere else. Files on disk survive a dead
`.git`; copy them into the main repo and commit them.

---

# PART 3 — THE REPO

## Managing it

- **One clone is canonical:** `~/Downloads/claude-code-repo/fhe-website-app`. A second clone
  existed on `~/Desktop` and caused real confusion; it is gone.
- **One worktree per thread**, at `~/Downloads/claude-code-repo/wt-<id>`, branched off
  `origin/main`. **NEVER on `~/Desktop`** — iCloud sync has destroyed a repo there.
- **File ownership between concurrent threads.** Two threads holding `AppLayout.tsx` is how
  work gets clobbered. Assign files explicitly in the task docs, and say so in both.

## Merges

Merge with `--no-ff` and a message naming what landed. Run typecheck, typecheck:api, lint and
build **on the merged result** — this is the integration check no single thread can run, and
it is most of your value at merge time.

## Pushes

**Push to `main` auto-deploys. There is no separate deploy step — a push is a release.**

**Batch.** One push per working session, not one per change. The previous session made 39
commits in a day and pushed after nearly every one, which made it impossible for the owner to
tell which build he was looking at and sent him testing stale code repeatedly.

**Checking what is actually deployed — do this properly:**

- Do NOT compare bundle filenames. Pages are code-split; `ContractPage` lives in its own lazy
  chunk, and grepping the main entry bundle for its code returns nothing. This produced three
  consecutive wrong "not deployed" calls.
- DO grep the live asset for a specific marker of the change, and grep the chunk that
  contains the symbol.
- **Mind whitespace in minified CSS.** `min-width: 1400px` compiles with a space; grepping
  `min-width:1400px` returns nothing and looks like a failed deploy.

**Verify every arbitrary Tailwind value reaches the built CSS.** Several have silently
emitted nothing: `bg-cream-100/[0.92]` produced no rule at all, and `bg-navfill/64` produced
nothing because 64 is not in the default opacity scale. Typecheck and lint both pass on these.
Grep `dist/assets/*.css` for the rule body.

## Migrations

Timestamped in `supabase/migrations/`, applied by hand via `psql` (`.env.db` line 1 is the
connection string). **Dry-run in `BEGIN … ROLLBACK` with raw output shown, apply, verify with
a query, commit.**

Body-rewriting migrations must **assert the rewrite matched**. A string replacement that
matches nothing silently no-ops and reports success; ~31 existing migrations have this shape.

**After any `REVOKE`, re-check `has_*_privilege()`.** Three revokes in this repo have silently
done nothing — a column revoke against a table-level grant, `FROM anon` against a PUBLIC
grant, and `FROM public` against a role-held `anon` grant. Never trust the command's output.

---

# PART 4 — COMMUNICATION

The owner is direct, fast, and decisive. He tests what you tell him.

**Planning.** Propose one thing. Give your recommendation and the reason, briefly. He will
choose, and often choose differently — that is the point of asking.

**Organizing.** He wants **status, not narrative**: what is finalised, what remains, what he
must decide, what you can do right now. Long prose reads as confusing — he has said so.
**Vertical lists over wide tables** — he has twice asked for a table to be re-rendered as a
list he can read.

**Changes.** When he changes a decision, update the document that carries the old one and say
what was superseded. Keep struck items visible so they are not rebuilt.

**Errors.** State them plainly, once, and fix the artifact. Do not over-apologise, do not
recount at length, do not tally. When he corrects you and he is right, say so and move on.
When you are unsure whether he is right, check before agreeing — he would rather be
contradicted with evidence than agreed with wrongly.

**New requests.** Capture them in the repo immediately, in the right document. He raised a
concern that a major workstream "was not listed as a request" — it was specced, but not in the
list he was reading. **If it is not written down where he will look, it does not exist.**

---

# PART 5 — SUGGESTIONS BEYOND THE OWNER'S LIST

Not requested. Each is something the previous session learned at his expense.

**S1 — Root-level CSS is a different risk class.** Nothing lands on `html` or `body` without a
browser check. An `overflow-x: clip` added to `html` broke scroll anchoring and made contract
authoring unusable; typecheck, lint and build all passed.

**S2 — Diagnose from evidence, not from plausible code paths.** The contract reload bug took
three attempts. Two were confident diagnoses from reading likely culprits. What found it was
enumerating every call site of the reload function — two minutes of work that should have
been the first move.

**S3 — Distinguish a workaround from a fix.** Restoring scroll position after a teardown was
a workaround; not tearing down was the fix. The owner spotted this immediately. Ask "am I
treating the symptom?" before shipping.

**S4 — When the owner says a value is wrong, do the arithmetic.** He asked for hue correction
on translucent colours and was right: a green over a warm cream page rotates 72° toward
yellow. Compositing maths turned an argument into a calculation. `docs/reference/` holds the
worked examples.

**S5 — Show, do not describe, for anything visual.** A rendered comparison settles in seconds
what paragraphs cannot. When he said "I can't do anything with numbers", the answer was a
page of live swatches.

**S6 — Standing constraints that outlive any task.** **Sarah's document `704c8d2d-d179-43f9-8a4a-7ea8cb920ab9` is a SAMPLE UNDER REVIEW, not a live
negotiation.** CORRECTED 2026-08-10 by the owner: *"the one for sarah even is a sample for her
to review not the final version."* Verified — `AWAITING_SIGNATURE`, two parties, **zero
signatures**. **Template changes are EXPECTED to reach it.** Do not scope a change to avoid it
and do not treat it as read-only. `ClauseDocument.tsx`
is FROZEN. Executed documents are never swept. `signed_template_version` is evidence and is
never rewritten to make a symptom disappear.

**S7 — There is no single index of workstreams.** UI changes, the admin refactor, the
lease/insurance work, security and the gift/auth work live in separate documents. The owner
has already been misled by this. Build the index or keep pointing at all of them.

**S8 — Reframing a task to pass a model safeguard is only legitimate when it narrows the
actual request.** `NOGUARD` was split into a read-only inventory and a separate hardening
pass — genuinely less capability requested. Rewording the same ask until something passes is
not the same thing.

**S9 — Recording a decision is part of the work.** The owner's rulings are scattered through
conversation; if they are not in a task doc, the next thread contradicts them.

**S10 — Batch pushes, and know what is deployed before asking him to test.** Most of the
wasted time in the last session was him testing code that had not shipped.

---

# PART 6 — WHERE THINGS STAND

## Just shipped, needs the owner's eyes

- **Contract authoring no longer tears the page down on every edit.** `load()` blanked all
  state synchronously before refetching, so the document unmounted and rebuilt on every field
  change. It now refreshes in place; only mount and route-change blank. **The owner has
  confirmed the reload is fixed and has found other contract issues he has not yet described
  — get that list.**
- Header replaced with the login page's, flat and opaque, 76px, no minify.
- Nav is near-white (`cream-25`) with green text; selected at 80% of a hue-corrected green
  fill, hover at 64%.
- Content columns centred; laptop scale-up threshold moved to 1400px.

## Open — newly raised, not yet specced

- **`TASK-PARTYJOURNEY`** — the owner's full flow spec, captured 2026-08-09: email link →
  auth → contract open with a welcome modal → an unknown horse owner's 3-page capture flow →
  responsibility highlighting → document assignment → the document-set journey → completion
  detection and hand-back → change highlighting → PDF on signature. **Large; phase it and stop
  between phases.** Two of his questions are already answered in it from the code: comments
  and requests are excluded from the PDF by design (browser print, `.print-document` only),
  and **there is no server-side PDF generator at all** — which is a prerequisite for the
  auto-generation and single-email parts.
- **Other contract issues the owner found** after the reload fix, beyond the above. Unstated.
  Ask.
- **Pages with narrow caps still look empty** on a 15" laptop. The scale-up landed, but a
  `max-w-3xl` page fills ~77% of the space beside the rail. Per-page caps, not the ladder.
- **Subheader button outlines** — he asked to remove them except on Void and Delete, then
  asked for them back. Currently all present. Confirm before acting.
- **A13 drawer width** — the nav resize is blocked on a number he has not given.

## Specced, ready to run

**CORRECTED 2026-08-08. `NOGUARD1` has RUN** — report merged at `9679006`, independently
audited at `docs/reports/TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md`. **`NOGUARD2` is unblocked and
outranks everything else on this line.**

`NOGUARD2` (verified target list in its task doc — highest priority open item) · `PAGEFRAME`
(nine pages onto the shared header — moves A5/A6 to done) · `PURPOSEFIX` (a live defect he
reported twice) · `GIFTCREDITS` · `GOOGLEAUTH` · `ADMINSWEEP` (the full admin refactor) ·
`FACILITYTERM` · `MOBILEPASS` (**owns `AppLayout.tsx`** — conflicts with any nav work) ·
`TITLESWEEP` (run AFTER `PAGEFRAME`; it fills titles those conversions leave empty).
`SECFIX2` is done.

**This is not the whole queue.** `docs/WORK-INVENTORY-2026-08-08.md` PART 6 ranks these
against the rest of the inventory; all of them sit below five items that are not on this line.

The A-series numbers referenced above and below are indexed in
`docs/reference/OPEN-CHANGE-REQUESTS-2026-08-08.md`.

## Decisions the owner owes

- Six template version decisions (ALL/SELECTED/NONE) — a legal-materiality call. Until
  answered, nobody is asked to re-sign anything.
- Lease picker labels; whether `HORSE_LEASE_V2` or `_STANDARD` becomes the default — that one
  decides whether any lease gating reaches real contracts.
- The `LEASEGATE` insurance model's remaining questions, including who determines fault.
- Whether gift purchase is transactional or a staff-converted inquiry.
- The facility-term list (barn/ranch/stables/grounds/…).

## Known and unfixed

- **`void_signatures_on_edit(uuid)` — LIVE SECURITY HOLE, verified in production 2026-08-08.**
  `SECURITY DEFINER`, `anon` holds EXECUTE, no identity check, no caller anywhere. An
  unauthenticated caller with a document id soft-deletes **every signature on that document**
  and resets its status. First target of `NOGUARD2`.
- **76 of 285 anon-callable definer functions enforce no access rule; 38 of them write.**
  Nine of those rewrite `contract_fields` on any document. The gift-guard note below is a
  fraction of the surface, not the extent of it.
- **`authenticated` has never been audited at all** — it holds EXECUTE on 396 callable
  definer functions, and signing up is free. Larger than the anon surface. Not yet specced.
- Three gift functions still have guards that do not fire for anonymous callers —
  `gift_transfer` already carries the correct `coalesce(…, false)` shape to copy.
- `test:db` is broken — 55 of 64 files failing. That suite protects nothing.
- **Browser-verification debt: about twenty tracker items over two weeks** are
  *code-complete, browser pending* — `A11`–`A13`, `A20`, `A21`, `F3`, `I1`–`I11`, `K1`–`K4`.
  Server-side `psql` proof does not prove a render. **CORRECTED — the earlier text here said
  "the last two days", which was wrong.**
- **Migrations are not rebuild-safe.** Many rewrite live function bodies via
  `pg_get_functiondef` + string-replace, which no-ops on a fresh database, and there is no
  `schema_migrations` table. A production rebuild has no strategy.
