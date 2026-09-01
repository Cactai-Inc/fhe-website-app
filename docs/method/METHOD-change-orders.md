# SOP — THE SIX-STEP CHANGE PROCESS

**Owner-defined, 2026-08-25.** The process every change request runs through, from a sentence to
validated code. Named by him; the detail under each step is the working agreement built up over this
thread.

| # | Step | Produces |
|---|---|---|
| **1** | **Identify issues & author change requests** | the **ledger** — every request captured verbatim, grouped, with questions authored for steps 2 and 3 |
| **2** | **Research** | **findings** — the truth about the code and the database, in plain language |
| **3** | **Discussion & Lock** | a **locked change request** + **success criteria** |
| **4** | **Author the handoff set for Architecture & Design** | everything the design thread needs, and nothing it has to ask for |
| **5** | **Review Architecture & Design deliverables** + **author the handoff set for Build** | approved design, then everything the build thread needs |
| **6** | **Review build deliverables** + **user validation testing** | shipped, verified by the owner |

⚠️ **The steps are sequential per ITEM, not per project.** Different change requests may sit at
different steps; what must never happen is one item skipping a step.

---

# STEP 1 — IDENTIFY ISSUES & AUTHOR CHANGE REQUESTS

**The owner is scanning for problems. My job is to hold the pen, not to talk.**

## What step 1 produces
**The ledger, in a shape that lets steps 2 and 3 run without failure:**
- the request recorded **verbatim** — his words are the requirement; a paraphrase is an
  interpretation
- **A/B recorded when he offers an alternative mid-message** — both, neither chosen
- ⚠️ **an OVERRIDDEN statement is DELETED, not archived** — *"when i changed my mind about
  something, ignore the overridden statement and proceed as if it was never mentioned."* An
  alternative he **offered and has not chosen** is not an override and stays live
- **related items GROUPED**, so step 2 reads a page or a table once instead of six times
- **questions authored in two lists**: `ASK-REPO` for step 2, `ASK-OWNER` for step 3

## The three hard rules for what I say out loud
> *"no questions, no research, no information sharing in step 1, only provoking me to look around
> relative to the request i just made, one thing at a time even if i send you 10 you respond one at a
> time. and then take all this shit you just fed me and focus on printing it into the document you
> should be keeping as a ledger so this thread is disposable"*

1. **NOTHING BUT THE PROVOCATION.** No findings, no recommendation, no evidence, no status.
2. **ONE AT A TIME**, even when he sends ten.
3. ⚠️ **EVEN WHEN HE ASKS A DIRECT QUESTION**, the answer goes in the **ledger** and surfaces in
   step 3. *"This thread is disposable"* — **anything that exists only in a reply is lost.**

## The only two things worth saying
- **"What else?"**
- **a specific provocation based on what I know about the area he is discussing** — *"you've been
  through the client record, open a horse record"*. **Point him at something to LOOK at.**

## ⚠️ WIDENING vs CLARIFYING — the distinction that matters most

> *"you are breaking the rules with these questions and ill tell you why … these dont pertain to
> digging deeper into the ui or considering the impact on other surfaces im currently looking at,
> these are clarifying questions, they take me down the rabbit hole in the wrong way, they ruin my
> focus and my flow state so now im not thinking about finding problems and coming up with
> solutions, im articulating specs and details, its hard to climb back out of this mental space to
> the leve above it where im scanning for issues to resolve and chaining together the solutions so
> they deliver unification and standardization."*

**The test is not "is this a good question." It is WHICH ALTITUDE the question puts him at.**

| | Asks him to | Effect |
|---|---|---|
| ✅ **WIDENING** | look **across** — other surfaces, sibling controls, whether the pattern repeats | keeps him scanning for problems and chaining solutions toward unification |
| ❌ **CLARIFYING** | look **down** — specify a detail, define a state, decide an edge case | drops him into spec-writing; **the climb back up is expensive** |

**Examples of what I asked that were wrong**, all three clarifying:
*"Is promote silent?"* · *"Does a rejected lead get an outcome?"* · *"What does the cover page show
with no submission?"* — each is a spec detail he would have reached on his own, and asking pulled
him out of the altitude where he finds problems.

⚠️ **A clarifying question is not saved by being important.** Those three were answered and the
answers were substantial — that is not the point. **They cost him the flow state, and flow state is
what produces the change orders in the first place.** Detail questions belong in **step 3**, where
he has already chosen to be in specification mode.

**When a detail is genuinely missing: go and find it (step 2), or write it down as ASK-OWNER and
raise it in review.** Never mid-capture.



---

# STEP 2 — RESEARCH

**Before any question is asked and before any code is written**, go and look. Trace:
- **the UI as it stands** — the actual component, the actual classes, the actual copy on screen
- **the page code relative to its neighbours** — what else does this, or nearly this
- **the DB interactions in both directions** — what feeds this surface, and what it feeds

## The four kinds of finding
| Finding | Why it matters |
|---|---|
| **a duplicate surface** | we are about to fix one of two things doing the same job |
| **a reusable element** | it exists — use it, and **globalize it as part of this change** |
| **a layout or format we already like** | same — adopt it, then globalize it |
| **wiring** | something never connected, upstream/downstream impact, and **DB standardisation to do alongside** |

## The four standing questions — asked of EVERY item
1. **Is there a global solution already in place?**
2. **Is this request already implemented anywhere else?**
3. **What is the right way to deliver this** — UI, UX, architecture, design?
4. ⚠️ **Am I fixing something attached to something that needs replacing or reimagining entirely?**

## Rules
- ⚠️ **Answer the gaps; do not report them.** *"dont come to me with a list of gaps asking if you
  should dig deeper."* If an `ASK-REPO` is not fully answered, **dig deeper.**
- ⚠️ **Check whether research has already answered an `ASK-OWNER`.** If it has, it is not a question
  any more. **Go looking for the answers in the code and the DB before handing him a list.**
- **Findings are written in plain language.** No function names in the summary, no schema jargon —
  *"the rule already exists and is enforced when the booking is saved; only the screen ignores it."*

---

# STEP 3 — DISCUSSION & LOCK

**One item at a time, in an order where the answers cascade.** Most-blocking first, so that
decisions upstream settle questions downstream before they are asked.

## The presentation order, per item — his specification
1. **The statement I captured**, as a change request
2. **What is true about the database relative to it** — ⚠️ **short. Not the place to elaborate or
   introduce detail.**
3. **The questions I had for the repo, and the answers research found**
4. **The questions I had for him, and the answers research found**
5. **Any remaining unanswered questions**
6. **Any A/B he offered — plus alternatives I came up with after seeing the research**

⚠️ **This process is only painful if I** — his words — *"spit out more than one thing at a time"*,
*"fail to properly order things so you are asking me questions or giving me information without first
providing the context needed"*, or *"shortcut the process, skip steps, dont go deep enough, dont ask
rigorous enough questions, or ask the wrong questions."*

## What step 3 produces
- **a LOCKED change request**
- **everything the task thread needs to carry out the work**
- ⚠️ **a strict set of VALIDATION CRITERIA — what success looks like for that task**, agreed together

---

# STEP 4 — AUTHOR THE HANDOFF SET FOR ARCHITECTURE & DESIGN

**Design and architecture are split off and run FIRST**, before any build.

The handoff set carries: the locked request, the success criteria, the step 2 findings that bear on
it, the constraints and rulings it must honour, the surfaces and tables it touches, and the
globalization items it is expected to carry.

⚠️ **The test: the design thread should not have to ask anything.** Every question it would ask is a
thing step 1, 2 or 3 should have produced.

---

# STEP 5 — REVIEW DESIGN, THEN AUTHOR THE BUILD HANDOFF

1. **Review the architecture & design deliverables** against the locked request and the success
   criteria.
2. **Then author the build handoff set** — the approved design plus the instructions and information
   the build thread needs.

⚠️ **Build never receives an unreviewed design.**

---

# STEP 6 — REVIEW BUILD DELIVERABLES + USER VALIDATION TESTING

1. **Review what the build thread produced** against the success criteria locked in step 3.
2. **The owner validates it himself.**

⚠️ **Success criteria were agreed in step 3 precisely so this step is a check, not a negotiation.**

---

# WHY THE PROCESS EXISTS

Without step 2, a change order is answered from the shape of the **request** rather than the shape of
the **system**, which produces three failures this repo has hit repeatedly:

1. **Building a second thing that already exists** — two surfaces for one job.
2. **Asking the owner a question the code already answers.**
3. **Fixing a symptom whose cause is upstream.**

⚠️ **And the opposite error: assuming something is missing because it is not visible.** Across this
thread's research: comping was already built, complete with loss reporting; "My Orders" was already
in the nav; two of three horse-owner controls existed; `completed` and `no_show` were already in the
schema. **Fact-finding is as often "this exists" as "this is absent".**

---

# THE ARTEFACTS

| Document | Step | Holds |
|---|---|---|
| `docs/reference/CHANGE-ORDER-LEDGER.md` | 1 | every change request, grouped, with its questions |
| `docs/reference/STEP2-FINDINGS.md` | 2 | what is actually true |
| *(this file)* | — | the process itself |

⚠️ **The thread is disposable. The documents are not.**
