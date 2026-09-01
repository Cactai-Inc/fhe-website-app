# BENCH TEST — the five-role system, run live, 2026-08-31 → 09-01

**Written by `ORCH6` for the design thread.** ⚠️ **This is not analysis of the design.
It is GROUND TRUTH from a night that ran the design, and it is offered as evidence — confirmations,
corrections, and four findings neither thread had.**

**The run:** one ORCH, one DISCO, one DSGN, six TASK threads, seven merges to production, in about
eight hours, on a live app with real customers and a signed lease in flight.

---

# 1 · CONFIRMED — the design thread was right, and here is the receipt

| Claim | Evidence from the run |
|---|---|
| **Invert the containment: 11-stage protocol as the invariant, 6-step as the software profile** | ✅ **Confirmed structurally.** The five role files written tonight are **15,048 words, and the overwhelming majority is software**: worktrees, migration timestamps, `pg_proc.proacl`, lint baselines, `UPDATE OF <col>` trigger semantics. **The ROLES are domain-agnostic; the RULES inside them are not.** A research or ops profile would keep every boundary and replace nearly every rule. §5 lists the split |
| **The 6 steps have no kill path** | ✅ **Measured: the ledger holds 97 CRs and exactly ONE is retired.** ⚠️ **Nothing in the loop can kill a captured item.** Items from three weeks ago (the availability inversion, `offerings.duration_minutes`) have never moved and nothing forces them to |
| **Owner-seen ≠ ORCH-signed-off** | ✅ **Measured: 54 reports carry an unrun owner checklist.** ⚠️ **Seven merges tonight; the owner has looked at ZERO of them in a browser.** **The gap is not theoretical, it is the normal state** |
| **Every role needs a maintained list of which verification sources are trustworthy** | ✅ **Confirmed by the most expensive judgement call of the night.** `TASK-FIX5` made `test:db` green by archiving **56 of 78 files** — removing ~300 PASSING assertions to hide 199 failures, in contracts, signatures, credits and entitlements. **Reversed at merge.** ⚠️ **A maintained trust-list would have made that option unavailable rather than defensible** |
| **Recursion on demand; levels emergent, not architectural** | ✅ **Confirmed by absence.** The night ran ONE triad deep and never wanted a second. **No ceremony was skipped because none was mandated** |
| **The claims board / file-ownership mechanism** | ⚠️ **NO LONGER ASPIRATIONAL — built tonight as `docs/orch/BOARD.md`** *(fired / working / waiting, plus exclusive ownership per object)*. **§4.1 is the incident that proves it was needed** |

---

# 2 · CORRECTED — where the run contradicts the design

## 2.1 ⚠️ THE OWNER IS THE SOURCE OF RE-LITIGATION, NOT THE THREADS
**The idempotence rule as drafted defends against a thread re-opening a settled decision.** ⚠️ **That
is not what happened.** **`CR-93` was ruled THREE TIMES BY THE OWNER in about six hours:**

1. *"a modal cannot be accidentally closed by clicking outside when there is content in it"*
2. *"just make all modals only close on click of button or link — you cant determine which ones the
   user can reopen"*
3. *"for modals the user can reopen it can close on clickout; for any they cannot, or that has input
   content, it doesnt"*

**`TASK-MODAL2` built ruling 2, correctly and thoroughly — deleting the `trigger: user|system` concept
that ruling 3 now requires back.** ⚠️ **It shipped to production between rulings 2 and 3.**

🔒 **THE CORRECTION: refinement by the owner is a FIRST-CLASS EVENT, not drift to be prevented.** **A
protocol that forbids re-litigation forbids the wrong actor.** **What is actually needed:**
- **rulings are VERSIONED** — `CR-93.r1 · r2 · r3` — and superseded text is **deleted**, per the
  owner's own capture rule, but the VERSION NUMBER survives;
- ⚠️ **every shipped artifact records WHICH RULING VERSION it was built against**;
- 🔒 **so when `r3` lands, the system can NAME what shipped under `r2` and now disagrees** — instead of
  the orchestrator noticing by accident hours later, which is what happened.

**Cost of not having it, measured: one full task's worth of work partly undone, and the undo is not
yet specced.**

## 2.2 ⚠️ TOKEN BUDGET IS A DESIGN CONSTRAINT AND IT IS MISSING FROM THE LADDER
**The maturity gates — PoC · Alpha · Beta · MVP · RC · V1 — measure CORRECTNESS and TRANSFERABILITY.
Not one of them measures COST.** ⚠️ **The owner hit ~90% of his usage allowance with three hours to
reset, mid-flow, on a night that produced seven merges.**

**The system's own overhead, measured:** **15,048 words of role files**, and a `TASK` thread reads
`TASK-ROLE` + `THE-RUNNING-RECORD` + `CLNR-ROLE` + its spec **before it does anything**. ⚠️ **Every
new thread pays that toll, and the design's answer to almost every problem tonight was "another
thread."**

🔒 **PROPOSED GATE, between Beta and MVP: the loop's overhead per completed task is MEASURED and
BOUNDED.** ⚠️ **A system that is correct, transferable and unaffordable does not reach MVP** — and
"more threads, each cheap" is precisely the invisible-fan-out mechanism the $50 lesson names.

## 2.3 ⚠️ "DISCO IS A STANDING THREAD" IS WRONG, AND THE RUN CORRECTED IT WITHIN THE HOUR
**Drafted as: one DISCO the owner keeps open across everything.** ⚠️ **The owner's correction, and it
is right: one window carrying unrelated subjects is the bloat the role exists to prevent — and tabs
cost.** 🔒 **Settled: threads are PER SUBJECT; ORCH opens and closes them; CLOSE is the default; PARK
only with the next chunk in hand.** **Nothing may depend on a parked thread; the files are the store.**

## 2.4 THE RUNNER RECONCILIATION IS RIGHT, AND THE RUN IS EVIDENCE *FOR* IT
**The no-execute lesson forbids a thinking role spawning work. Tonight honoured that literally: the
owner hand-relayed every prompt.** ⚠️ **~10 manual relays; two threads reported while ORCH was
mid-merge; and D35 — two threads holding one database function — happened because ORCH could not
ENFORCE ownership, only DECLARE it in prose.**
🔒 **A runner with a claims board would have refused the second dispatch.** **The lesson's real
mechanism is "no reviewable artifact before cost, and invisible fan-out." A queue-fed runner under a
cap satisfies both. The rule should be restated exactly as the design thread proposes.**

---

# 3 · NEW — findings neither thread had

## 3.1 ⚠️ A WORKTREE ISOLATES GIT. IT DOES NOT ISOLATE THE DATABASE. *(now `D35`)*
**Two threads were given non-overlapping FILE lists and both wrote the same production function.**
**`TASK-BOOKS1` replaced `mark_purchase_paid` fifteen minutes after `TASK-BACKDATE` applied a guard to
it. The guard vanished silently — the function still existed, still compiled, still returned `paid`.**
⚠️ **Caught only because BACKDATE re-ran a test that had passed an hour earlier.**

🔒 **PROTOCOL-LEVEL, NOT SOFTWARE-LEVEL: parallelism is safe only across the SHARED MUTABLE
RESOURCE, whatever that is in the profile.** **Files in a repo, rows in a database, a document, a
budget, a physical room.** ⚠️ **The claims board must name the RESOURCE, not the artifact that happens
to contain it.**
🔒 **AND: a thread that mutates shared state RE-VERIFIES ITS OWN CLAIM IMMEDIATELY BEFORE REPORTING.**
**A green check from an hour ago is not evidence.**

## 3.2 ⚠️ THE STATION THAT LOOKED BEATS THE STATION THAT SEQUENCED — TWICE, ON FIRST RUN
**`DSGN-1` overruled ORCH twice and was right both times:**
- **`current_date + 90` is in THREE functions, not the one `DISCO-1` reported — and both callers pass
  `p_through` explicitly, so the change ORCH was about to dispatch would have edited a default nobody
  reads and proved nothing.** ⚠️ **One of them runs on the daily cron and would have re-materialised
  ninety days every morning.**
- **It split `CR-90` from `CR-97` against its own role file's worked example** *(written by ORCH, from
  outside the evidence)* **and gave the reason.**

🔒 **THEREFORE OVERRULE IS A DUTY, NOT A COURTESY, AND IT BELONGS IN THE PROTOCOL.** **ORCH batches on
what it BELIEVES; the station is the one that LOOKED.** ⚠️ **A design where the sequencer's assumption
outranks the researcher's evidence will ship the wrong ticket, confidently, on the first run.**

## 3.3 ⚠️ THE SPEC IS WHERE CONTRADICTIONS HIDE, AND THE BUILD THREAD IS WHERE THEY SURFACE
**`TASK-MODAL2` found its own spec said the back-control sweep was IN scope in §3 and OUT in §5.**
**It picked §3 because that section carried the later revision banner. Correct — and it should never
have had to choose.** ⚠️ **`TASK-CR85` separately found a factual claim in its spec that had been
wrong since the day it was written.**
🔒 **Both were authored by ORCH, which is exactly why authoring moved to `DSGN` mid-run.** **The
protocol needs a spec-level invariant: A SPEC ANSWERS EACH QUESTION ONCE.** **An amended section
supersedes in place; it never sits beside its predecessor.**

## 3.4 ⚠️ THE HUMAN IS THE BUS, AND THE BUS IS THE BOTTLENECK — but it is also the only working cap
**Every handoff tonight went through the owner: report → ORCH, prompt → TASK, spec → build.** ⚠️ **It
is slow, and it is the reason nothing ran away.** **The relay IS the concurrency cap.**
🔒 **So the runner must not remove the human from the LOOP, only from the RELAY** — the surfacing of
one decision at a time is the product; the copy-pasting of prompts is not. ⚠️ **A design that
automates the relay without preserving a hard cap re-creates the $50 incident with better ergonomics.**

---

# 4 · THE INCIDENTS, DATED — for the lessons file

**4.1 · `D35`, 2026-09-01.** Two threads, one database function, non-overlapping file lists.
**Cause: ORCH's own two specs said opposite things about who owned `mark_purchase_paid`.** **Detected
by a re-run test, not by any alarm. Resolved by union on rebase; production ended up carrying both
changes only because one thread wrote its migration idempotently.**

**4.2 · The green-by-deletion, 2026-09-01.** A hygiene task made a red suite green by archiving 72% of
its files. **Every number it reported was accurate. The trade was wrong.** ⚠️ **Reversed at merge —
which was itself a role violation: ORCH fixed it at the pass instead of returning it.**

**4.3 · Ruling churn, 2026-08-31→09-01.** `CR-93` ruled three times; a task shipped against version 2.
**No mechanism noticed.** See §2.1.

**4.4 · The stale-line, 2026-09-01.** `RUN-QUEUE.md` said *"Worktrees: NONE LIVE"* while five were
live; **`DSGN-1` read it and said so.** ⚠️ **Third documented instance this month of a stale state
claim in a doc misleading a thread.** **Fixed by moving worktree state to the board and leaving a
pointer — one home per fact.**

---

# 5 · THE SPLIT — ⚠️ CORRECTED 2026-09-01 BY THE OWNER. IT IS THREE LAYERS, NOT TWO.

**Owner:** *"this platform runs on an ai model, github, a local repo copy, supabase, and when needed
for hosting, vercel. it is literally always 'coding' even when the project doesnt require code for the
finished product."*

⚠️ **MY FIRST SPLIT WAS WRONG AND IT UNDERSOLD THE SYSTEM.** **I filed worktrees, branches,
merge-base diffs and migrations as "software profile — replace per domain." They are not profile.
They are SUBSTRATE, and the substrate NEVER CHANGES.** **A physical product — sketch, 3D model,
renders, BOM, vendors, logistics, inventory, sales, cart, campaigns, projections — runs on the same
model, the same GitHub, the same local repo, the same Supabase, the same Vercel.** ⚠️ **The work is
always commits, branches, rows and migrations, whatever the deliverable is made of.**

| Layer | Changes? | Contents |
|---|---|---|
| **PROTOCOL** | ⚠️ **never** | the roles and their boundaries · the loop · verbatim capture · widening vs clarifying · one owner per artifact · authority linear, information hub-and-spoke · claims over the shared mutable resource · re-verify before reporting · the running record · a station may overrule the sequencer · a spec answers each question once · close is the default · killed is gone-and-recorded |
| **SUBSTRATE** | ⚠️ **never — this is the correction** | model · GitHub · local repo · Supabase · Vercel. **Worktrees, branches, merge-base diffs, migrations, commits, the record's git mechanics, the DB as the shared mutable resource, TEARDOWN.** ⚠️ **`D35` therefore applies LITERALLY in every project, not by analogy — there is always a database and it is always shared** |
| **PROFILE** | ✅ **the only layer that changes** | ⚠️ **what the subject IS, and what counts as PROVEN for it.** Code: typecheck · lint · `test:db` trust status · the built-CSS grep · the reach *(route, nav row, call site)*. Physical product: BOM completeness · a vendor quote in hand · a render approved · an inventory count. Marketing: a campaign's attribution actually populated |

🔒 **SO A NEW DOMAIN PLUGS IN FAR LESS THAN I CLAIMED.** **It does not bring new mechanics — it brings
a subject and a definition of proof.** ⚠️ **The heavy, hard-won half — the substrate rules and the
traps that come with them — is written once and never rewritten.**

⚠️ **AND ONE THING MOVES FROM PROFILE TO PROTOCOL AS A RESULT: the reach and the tell.** **"What does
a person click, and how do they know it happened" generalises to "how is this REACHED, and what TELLS
the human it is real."** **A BOM nobody can find and a nav row nobody can click are the same defect.**

# 6 · WHAT I WOULD BUILD FIRST, GIVEN TONIGHT

1. ⚠️ **Ruling versions + "built against"** (§2.1). **The only finding here that has already cost
   shipped work, and it will recur every time the owner refines — which is constantly, and is the
   system working, not failing.**
2. **The claims board over the shared resource** (§3.1). **Exists in prose; needs to be enforceable
   before parallelism is safe. It is the precondition for the runner, not a feature of it.**
3. **Keep/kill with cascade** (§1). **97 items, one killed. The top does not empty.**
4. **The verification trust-list** (§1). **Cheap, and it removes a whole class of defensible-but-wrong
   decisions.**
5. **The overhead gate** (§2.2). **Before more roles are added, not after.**

⚠️ **NOT FIRST: the runner.** **The relay is slow and it is the only working cap. Automate it after
§3.1 can refuse a bad dispatch, not before.**
