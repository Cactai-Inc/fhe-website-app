# ORCH6 → the design thread — everything from the bench test forward

**Assembled 2026-09-01 for review.** These are `ORCH6`'s responses from a live run of the five-role
system on a production repo *(FHE website app: React/TS, Supabase, Vercel, real customers, a signed
lease in flight)*. **One ORCH, one DISCO, one DSNR, six TASK threads, seven merges, ~8 hours.**

**Companion file, referenced throughout:** `docs/method/BENCH-TEST-2026-09-01.md` — the full evidence
table. **Role files live in `docs/method/`:** `ORCHESTRATOR.md` *(ORCH)* · `DISCO-ROLE.md` ·
`DSNR-ROLE.md` · `TASK-ROLE.md` · `CODR-PROFILE.md` · `CLNR-ROLE.md` · `RNR-ROLE.md` ·
`THE-RUNNING-RECORD.md`. **Board:** `docs/orch/BOARD.md`.

---

# PART 1 — THE BENCH TEST

## 1.1 Where the design thread was right, with receipts

**The containment inversion is confirmed structurally.** The five role files are **15,048 words**; the
*roles* are domain-agnostic and nearly every *rule* inside them is software. **The missing kill path
is measured: 97 CRs in the ledger, exactly one retired.** **Owner-seen vs ORCH-signed-off is measured:
54 reports carry an unrun owner checklist, and the owner has looked at zero of the night's seven
merges in a browser.** **The verification trust-list would have prevented the night's most expensive
judgement call.** **Recursion on demand is confirmed by absence** — the night ran one triad deep and
never wanted a second. **The claims board is no longer aspirational** — built as `docs/orch/BOARD.md`.

## 1.2 Four findings the design thread did not have

**(a) The owner is the source of re-litigation, not the threads.** `CR-93` was ruled three times in
about six hours *(modals: content-only → all modals → reopenability)*. `TASK-MODAL2` built ruling 2
correctly and thoroughly — deleting the `trigger: user|system` concept ruling 3 now requires back —
and shipped to production between rulings 2 and 3. ⚠️ **An idempotence rule that forbids
re-litigation forbids the wrong actor.** What is needed instead: **rulings are versioned; every
shipped artifact records which ruling version it was built against; when `r3` lands the system names
what shipped under `r2` and now disagrees.** Cost of not having it: one task's work partly undone.

**(b) Token budget is missing from the maturity ladder.** PoC → V1 measures correctness and
transferability; **not one gate measures cost.** The owner hit ~90% of his allowance mid-flow. The
system's own overhead: **15,048 words of role files**, and a TASK thread reads three of them plus its
spec before doing anything. ⚠️ **The design's answer to most problems is "another thread" — which is
the invisible-fan-out mechanism the $50 lesson names, wearing better clothes.** **Proposed gate
between Beta and MVP: overhead per completed task is measured and bounded.**

**(c) A worktree isolates git, not the database.** Two threads with non-overlapping *file* lists both
wrote one production function; the guard from the first vanished silently when the second replaced it
— still existed, still compiled, still returned `paid` — and was caught only because a test that had
passed an hour earlier was re-run. **Generalised: parallelism is safe only across the SHARED MUTABLE
RESOURCE, whatever that is in the profile.** The claims board must name the *resource*, not the
artifact containing it. **And a thread that mutates shared state re-verifies immediately before
reporting — a green check from an hour ago is not evidence.**

**(d) The human relay is the bottleneck and the only working cap.** ~10 hand-offs; nothing ran away
*because* a person had to paste it. **So a runner must remove the human from the relay, never from the
loop** — and only after the claims board can refuse a bad dispatch.

## 1.3 The three-layer split — corrected by the owner, and it undersold the system

**First attempt said worktrees, branches, merge-base diffs and migrations were "software profile,
replace per domain." Wrong.** The owner's correction: *"this platform runs on an ai model, github, a
local repo copy, supabase, and when needed for hosting, vercel. it is literally always 'coding' even
when the project doesnt require code for the finished product."*

| Layer | Changes? | Contents |
|---|---|---|
| **PROTOCOL** | never | roles and boundaries · the loop · verbatim capture · widening vs clarifying · one owner per artifact · authority linear / information hub-and-spoke · claims over the shared mutable resource · re-verify before reporting · the running record · a station may overrule the sequencer · a spec answers each question once · close is the default · killed is gone-and-recorded |
| **SUBSTRATE** | **never — this is the correction** | model · GitHub · local repo · Supabase · Vercel. Worktrees, branches, merge-base diffs, migrations, commits, the record's git mechanics, the DB as shared mutable resource, teardown. **So the DB-collision rule applies literally in every project, not by analogy** |
| **PROFILE** | **the only layer that changes** | **what the subject IS and what counts as PROVEN.** Code: typecheck · lint · test-suite trust status · built-CSS grep · the reach. Physical product: BOM completeness · a vendor quote in hand · a render approved. Marketing: attribution actually populated |

🔒 **A new domain brings no new mechanics — only a subject and a definition of proof.** **And one item
promotes into protocol as a result: THE REACH AND THE TELL.** *"How is this reached, and what tells
the human it is real"* — **a BOM nobody can find and a nav row nobody can click are the same defect.**

---

# PART 2 — THE ROLE MODEL AS IT NOW STANDS

## 2.1 Roles are verbs, not subjects

**DISCO discovers · DSNR designs · TASK executes · ORCH sequences and verifies · CLNR keeps the
workspace true · RNR transports.** A marketing campaign needs all the same verbs. ⚠️ **Forking the
role set by subject — WRTR, MRKTR, SLR — gives every subject its own discovery, design and
verification rules and N sets to keep in sync.**

🔒 **One execution role, many profiles.** **`CODR` is `TASK` with the CODE profile bound.** `WRTR`
would be `TASK` with the copy profile bound — same boundaries, same record, same emissions, different
definition of *proven*. **The four-letter name exists for the tab title, so the owner sees which kind
of proof a thread owes.** ⚠️ **No MRKTR, no SLR — marketing and sales are subjects, not verbs.**

**And: a marketing plan is a DELIVERABLE** *(the output of a DSNR pass on the marketing subject,
executed as tasks)*; **ORCH's planning is SEQUENCING WORK.** One is content, the other is traffic.
Conflating them is how a planning artifact starts scheduling threads, or an orchestrator starts
authoring strategy.

## 2.2 The 10 stages map onto the roles with no gaps and no orphans

| Stage | Role |
|---|---|
| 1 Ideation · 2 Investigation · 3 Evaluation | **DISCO** |
| **4 Decision — keep/kill** | ⚠️ **the owner. No role owns it** |
| 5 Plan | **DSNR** |
| 6 Execute · 7 Validate · 8 Report | **TASK** *(CODR / WRTR / …)* |
| 9 Review | **ORCH** |
| 10 Revise | back to **DSNR** |
| 11 Repeat | **DISCO** reads report + verification |

🔒 **The 1:1 fit is the strongest evidence the role set is right — and it exposes the real hole:
stage 4 has no owner but the human.** **Which is why the ledger holds 97 CRs and one kill.**

## 2.3 The hole is the product, not a gap

**Owner:** *"that hole exists because the product is human in the loop and the human's role is decision
making and engaging with the AI for exploration prior to that."*
⚠️ **The system exists to bring him to a decision and make it cheap, informed and final. It does not
exist to make the decision. Do not "fix" the hole by having a role decide.**

## 2.4 The six questions

| | Answered by | From |
|---|---|---|
| **WHAT · WHY** | **the owner** | DISCO and DSNR draw them out; he rules |
| **WHEN** | ORCH | the pipeline and contention |
| **WHO** *(role, thread, model, effort)* | ORCH | **derived from the WHAT** |
| **HOW IT RUNS** | ORCH | **derived from the WHAT and the WHY** |
| **HOW IT IS BUILT** | **DSNR — never ORCH** | the locked request |
| **WHERE** | substrate and profile | which repo, which surface |

⚠️ **Two different HOWs. ORCH answers how the WORK runs; DSNR answers how the THING is built. The
moment ORCH answers the second it is authoring.**

## 2.5 Every role owns a HOW, and must know which kind it has

**Owner:** *"each of the roles has to answer a HOW, sometimes they are given the answer, sometimes
they need to find and lock the answer with me."*

**DISCO:** how do we find out. **DSNR:** how is the thing built. **ORCH:** how does the work run.
**TASK:** how is it implemented, here, today. **CLNR:** how is the workspace kept true. **RNR:** how
is it delivered — ⚠️ **and RNR is the one role that never finds a HOW; a missing one goes back to
ORCH.**

🔒 **The test asked of every decision: was this HOW handed to me, or do I owe a lock on it?**
**Given → execute; if it is wrong, say so and STOP rather than improving it silently.**
**Missing → find it and lock it with the owner; never invent it and carry on.**
⚠️ **"Nobody said, so I chose" is the answer that produces work that has to be undone** — and it is
three of the night's incidents: the modal ruling, the 56 archived test files, the 90-day horizon.

## 2.6 The roles have different shapes, and that is not a defect

| | Chat | Output | Success measured in |
|---|---|---|---|
| **DISCO · DSNR** | **heavy** | light | **decisions reached** — not documents produced |
| **ORCH** | **light** | heavy | tickets fired correctly, claims verified, nothing lost |
| **TASK** | **none** — a question or a report | heavy | the thing works and is proven |

🔒 **Conversation with ORCH is: what is next · what is in the pipeline · what is blocked · what a
report actually proved.** ⚠️ **Not how to build something, not exploring an idea, not weighing
options — those belong to DISCO and DSNR, which are heavy on discussion by design.**

## 2.7 Topology, lifecycle and naming

🔒 **ORCH is the centre of a node; DISCO, DSNR, TASK and CLNR are the sprawl.** They talk to ORCH and
to RNR, and reach each other only through RNR. **RNR also moves work between the ORCHs of different
altitudes; nothing else crosses a node boundary.**

**Lifecycle:** DISCO and DSNR are **per subject** — ORCH opens and closes them; a thread lives as long
as its subject and asks for a fresh one when the next subject shares no files, tables or functions
with the last. **TASK is disposable, closed for good once verified.** **CLNR has no thread — it runs
as the first act inside each TASK.** ⚠️ **CLOSE is the default; PARK only with the next chunk in hand;
"reopen for its context" is not a thing — closing is the act that discards it.**

**Naming is retrieval:** `<ROLE>-<AREA>-<ITEM>`, no spaces, area abbreviated — `DISCO-CAL-FIX4`,
`CODR-SIGN-STRIP`. ⚠️ **A serial is unfindable in a week.** **Files carry the same slug, so thread
name → file name in both directions.**

**Batching:** connected areas → **one thread**, worked for a while, returning work in the chunks ORCH
asked for. Unconnected areas → **one fresh thread each, in parallel**. ⚠️ **ORCH chunks INQUIRY;
DSNR chunks WORK. Two different chunkings.**

**A station may overrule ORCH and must say so.** ORCH batches on what it believes; the station is the
one that looked. ⚠️ **DSNR-1 overruled ORCH twice on its first run and was right both times.**

## 2.8 RNR — the runner, specified and not yet running

**RNR is transport, not a thinking role.** It carries, configures and sends; **it never edits a prompt
or decides what happens next.** ORCH's dispatch output stops being "a prompt to paste" and becomes a
**ticket**: `id · to · prompt verbatim · model · effort · thinking · worktree · from · cap_class`.

🔒 **RNR CAN REFUSE, AND THAT IS THE POINT:** an id collision, a **resource another live ticket holds**,
a dirty or unmerged worktree, or the cap. ⚠️ **On the night of the run, ORCH could DECLARE ownership in
prose and could not ENFORCE it, and two threads overwrote one production function. RNR's refusal is
what makes parallel dispatch safe — the precondition for automating dispatch at all, not a later
feature.**

**The no-execute lesson is reconciled, not repealed.** Its stated mechanism is (1) collapsing the
document between deciding and doing, and (2) invisible fan-out. **RNR spawns only from a ticket that
already exists, under a hard cap, on a visible queue — both safeguards survive.** ⚠️ **Written into
the file explicitly, or the first thread that reads the lessons file will correctly refuse to build
it.**

⚠️ **STATUS: RNR CANNOT RUN FROM INSIDE THE EDITOR.** An interactive session cannot spawn, configure
or feed a sibling interactive session; **RNR needs a host process outside it** — watching the queue,
launching a session per ticket with its model/effort/worktree, enforcing the cap, writing outcomes to
the board. 🔒 **Until then the OWNER IS RNR**, which makes the role file simultaneously **the
specification for the thing that replaces him.** ⚠️ **And the cap is currently his hands — the day the
relay is automated is the day the cap must already exist in code.**

---

# PART 3 — WHAT ORCH6 WOULD BUILD FIRST

1. ⚠️ **Ruling versions + "built against"** — the only finding that has already cost shipped work, and
   it recurs every time the owner refines, which is constantly and is the system working.
2. **The claims board over the shared resource** — exists in prose, needs to be enforceable before
   parallelism is safe. **Precondition for RNR, not a feature of it.**
3. **Keep/kill with cascade** — 97 items, one killed; the top does not empty.
4. **The verification trust-list** — cheap, and removes a whole class of defensible-but-wrong
   decisions.
5. **The overhead gate** — before more roles are added, not after.

⚠️ **NOT FIRST: the runner.** The relay is slow and it is the only working cap.
