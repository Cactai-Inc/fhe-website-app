# OPEN QUESTIONS — waiting on the owner

⚠️ **He has been asked all of these. Do not re-ask what is already answered here; do not build past
what is not.**

---

## 1. 🔒 MESSAGING — ANSWERED, AND IT IS NOT "REMOVE IT"

The outgoing thread asked whether messaging should survive, having measured **all five tables empty**
— `direct_messages` 0 · `channel_messages` 0 · `threads` 0 · `thread_posts` 0 ·
`contract_note_messages` 0.

**He corrected the framing, 2026-08-26:**
> *"are you asking if we remove messaging as a feature? no one is in the app to use it so its not
> surprising it isnt being used, i doubt it will be used, but heres the thing, we implemented chat
> thread type notes panels in lessons, horse care service activity records, and contracts. So rather
> than go to find the specific item and navigate to the messages in the notes section, we can make
> the notes sections into proper message chat thread interfaces and then enumerate them in the user's
> messages page. Or, we can leave the messaging only on the action surfaces and kill the collective
> messages page. im impartial, i just want to give everyone what they will actually use."*

⚠️ **ZERO ROWS WAS NEVER EVIDENCE OF ANYTHING — NOBODY IS IN THE APP YET.** That correction applies to
every "built and undriven" finding in this repo: **pre-launch emptiness is the expected state**, and
`docs/ORCHESTRATOR.md` §4 already says so *("Empty is not a finding")*. The outgoing thread reported
it as a finding anyway.

**THE REAL QUESTION, and it is A or B:**
- **(A) The notes panels BECOME the messages.** Lesson notes, care-activity records and contract
  notes become proper chat threads, and the messages page **enumerates them** — one inbox, every
  conversation reachable without hunting for the record it hangs off.
- **(B) Messaging lives ONLY on the action surfaces**, and the collective messages page is retired.

**STILL HIS TO CHOOSE.** ⚠️ **The outgoing thread's recommendation, recorded so it is not lost: (A).**
The reason is his own stated goal — *"not needing to look at a specific place for a specific thing"* —
and (A) is the only option where a message can reach him without him first remembering **which lesson,
which horse, or which contract** it was attached to. (B) is cheaper and defensible, but it makes every
conversation invisible until you already know where it lives. **⚠️ (A) is also a REACH problem, not a
messaging problem: the threads already exist on those surfaces; what is missing is one page that
lists them.**

## 2. 🔒 "WHICH DASHBOARD VIEWS?" — ANSWERED BY THE ASKING

He asked what was meant. **It is the trainer / business toggle on `OwnerDashboard`** — two views over
largely the same facts, which is where the duplication he complained about comes from: `C3 "Money
waiting"` and `B1 "Money that has not landed"` are one fact under two names.

⚠️ **STILL UNANSWERED: do the two views go?** They were iterated with him twice in a previous session
(`HANDOFF-ORCH4`), so **they are a deliberate thing being undone, not an accident being cleaned up.
Do not delete them on your own read.**

## 3. ⚠️ THE DASHBOARD NUMBERS — HE HAS ROUTED THIS ELSEWHERE. DO NOT GUESS THEM.

> *"I cant tell you, but i know there is an answer to this and a smart ai chat thread will have a
> list. This is why i engaged with claude chat to get its input on the dashboard build. So lets do
> this. lets get a new spec document from that thread and then implement it to revise what was
> built."*

**So: a spec is coming from a separate Claude chat. Your job is to receive it, reconcile it against
`TASK-DASHFEED`, and implement the revision.** ⚠️ **Do not author the metric list yourself.**

**And he named the honest blocker himself:**
> *"The challenge we will have until i actually sit down and add every client, add all their
> purchases, mark all of them paid with the payment method recorded manually, will we be able to see
> the full impact of any numbers... And things like conversion rates, number of form submissions, $
> per website form submitted, $ per client, $ per conversion, are likely not ready to be calculated
> because the inputs are most likely not fully or properly implemented."*

⚠️ **THEREFORE: EVERY METRIC IN THE INCOMING SPEC NEEDS ITS INPUTS AUDITED BEFORE IT IS BUILT.**
A metric whose inputs are not captured renders as zero, and **a zero on an always-visible strip is
indistinguishable from a real zero.** That is worse than omitting it. **Say which metrics cannot yet
be computed and why, rather than shipping them empty.**

### ⚠️ 3b. A NEW REQUIREMENT INSIDE THAT MESSAGE — ATTRIBUTION, AND IT IS NOT BUILT
> *"I know want to see where people come from before they hit the website, and i need a way to add
> info to every client record to indicate (from a constrained list of options) where they
> originated/how they found us... we need to see real data about these things to know whats working,
> what we can invest in to get more out of, and what isnt firing or working so we can investigate
> it."*

**This is a prerequisite for half the metrics, not a nice-to-have.** It needs:
- a **constrained vocabulary** — ⚠️ **which belongs in `lookup_options`, the editable menu system, so
  he can change it without a thread (D13)**, not a hardcoded list;
- a field on the **contact / client record**, set at intake AND editable later;
- **backfill for existing clients**, which is manual and his to do — **the field must exist before he
  starts entering, or he will enter everything twice.**

⚠️ **BUILD THE ATTRIBUTION FIELD BEFORE THE METRICS SPEC ARRIVES.** It is on the critical path for
the data-entry session he describes, and it is cheap. **This is the single most schedule-sensitive
item in this handoff.**

## 4. THE CONTRACT-ORDER PASS

⚠️ **CR-30's three questions are the oldest thing waiting on him**, and must be re-read against CR-75
before being put to him again — the client surface changed after they were asked. See
`03-REMAINING-WORK.md` §2.
