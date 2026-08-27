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

### 🔒 DECIDED — HE PROPOSED THE RIGHT MODEL AND ASKED FOR A RULING. THE RULING IS: BUILD IT.

> *"the idea of having the messages on a single collected surface page is that you can then one click
> to the original surface. and, when we surface the message from one user to another on their
> dashboard and they respond from the notification directly all of this is running through a message
> that lives on the messages page, so the messaging threads that are shown on specific surfaces like
> in a contract or on a lesson are actually just showing the message thread from the messages page, i
> think this is globalized since the messages are centrally located and just piped into other
> locations...maybe im wrong and this is a massive over complication. you decide."*

⚠️ **HE IS NOT WRONG, AND IT IS NOT OVER-COMPLICATION. IT IS THE SIMPLER MODEL, AND IT REDUCES
IMPLEMENTATIONS RATHER THAN ADDING ONE.**

**ONE STORE. THREE VIEWS.** A message thread has a SUBJECT (a contract, a lesson, a care activity, or
nobody). The messages page lists **every** thread; a surface renders **the thread whose subject it
is**; a dashboard item renders **that same thread inline**, and replying there writes to the same
place. **Nothing is piped or copied — they are three reads of one table.**

**WHY THIS IS CONVERGENCE, NOT NEW CONSTRUCTION.** There are already **four** stores doing pieces of
this — `contract_notes` + `contract_note_messages`, `booking_notes` + `booking_note_seen`,
`direct_messages`, `channel_messages`. ⚠️ **Centralising REPLACES four with one.** `ORCHESTRATOR.md`
§4 — *"improve what exists, never build a second implementation alongside it"* — makes this the
required direction, not the ambitious one.

**And it is the ruling the ledger already carries:** CR-30 ruling 6, **ONE RESOURCE, TWO VIEWS** —
*"the client edits their fields on their own surfaces; staff see the same record. Not a copy, not a
sync."* **This is that rule applied to conversations.**

⚠️ **HIS OWN CAVEAT IS THE THING TO CHECK FIRST:** *"I may have overstated how thoroughly these
message threads exist on the surfaces."* **He did.** `contract_note_messages` is a real thread store;
`booking_notes` is a flat note list with a seen-marker, **not a thread**. **Audit each surface before
promising parity** — some are conversions, some are builds.

⚠️ **DO NOT START THIS BEFORE T3.** It is a globalization of four stores into one and it touches the
contract surface T3 is rebuilding. **Sequence it after.**

## 2. 🔒 THE TWO DASHBOARD VIEWS STAY — AND THE OUTGOING THREAD WAS WRONG ABOUT THEM

It reported the trainer/business toggle as the source of the duplication and proposed retiring it.
**The owner answered flatly, 2026-08-26:**

> *"no, they are wildly different, hers are all about the lessons, the requests, the schedule, and the
> clients. the money is the only overlap we share. mine is all about the kpis like the giant list i
> shared. and then we both need to see different notifications. I need to see support messages, she
> needs to see client messages about their purchases and up coming appointments. we might both want to
> see when a client claims an invite or when a contract is signed, and she is the one that is supposed
> to be using the app to record her activity with respect to leads and payments, im the one that is
> supposed to create contracts and assist with their completion."*

⚠️ **THEY ARE TWO ROLES, NOT TWO VIEWS OF ONE DATASET. DO NOT MERGE THEM.**

| | Claire *(trainer)* | CJ *(business)* |
|---|---|---|
| **owns** | lessons · requests · the schedule · clients | the KPIs |
| **records** | her activity on **leads and payments** | — |
| **creates** | — | **contracts**, and assists their completion |
| **notifications** | **client** messages — purchases, upcoming appointments | **support** messages |
| **shared** | ⚠️ **money**, a client claiming an invite, a contract being signed | |

⚠️ **THE DUPLICATION IS REAL BUT IT IS IN THE ZONE LIST, NOT IN HAVING TWO BOARDS.** `C3 "Money
waiting"` and `B1 "Money that has not landed"` are one fact written twice. **The fix is ONE zone
rendered on BOTH boards — not one board.** Money is the declared overlap; so are invite-claimed and
contract-signed. **Everything else belongs to exactly one of them.**

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
