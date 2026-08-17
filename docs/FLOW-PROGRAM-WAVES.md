# THE FLOW PROGRAM — waves

**Owner's method, 2026-08-16:**

> *"there are a lot of things to clean up and there is stacking between these elements, so the flow
> needed to be ironed out in the order the visitor experiences it, and then the pieces that are out
> of alignment with how we sell or how we present or how we provision will fall out on their own for
> us to address as we go along. its going to have to happen in multiple passes (waves) until its all
> fully functional, accurate, and tested on your side and mine."*

**How to read this file:** work proceeds **in the order a visitor meets it**. When a wave exposes
something misaligned with how the business sells, presents or provisions, that thing **falls out
into a later wave** rather than derailing the current one. **Fallout is the method working.** This
file is where fallout is parked so it is not lost and not built early.

**Nothing is "done" until it is tested on both sides** — the orchestrator's audit against real
repo/DB state, and the owner's own use.

---

# WAVE 1 — the visitor's path, in the order they walk it *(in flight)*

| # | task | state |
|---|---|---|
| 1 | **`ASKRIGHT`** — what is asked, of whom, on which page | **ready; all owner questions answered** |
| 2 | **`CAREPATH`** — horse-care inquiry → order → provisioning → activation | ready; **holds until ASKRIGHT merges** |
| 3 | **`LESSONREQUEST`** — inquiry → agreed time → activation → payment → app | ready; after CAREPATH |
| 4 | **`GIFTPATH`** — gifts stay a conversation | ready; anytime after CAREPATH |
| 5 | **`SESSIONBOOK`** — `/lessons` becomes a purchase flow for members | ready; **last** |

**Cancelled / retired by wave 1:** `RIDERQUALIFY` (rider questions already on the form),
`THREEFORMS` (fully superseded), `FUNNELDOORS` (superseded earlier).

**Running alongside, no code overlap:** `HARVESTCLOSE` — reconcile the 975 flagged items into a
keep/remove sheet.

---

# WAVE 2 — what wave 1 shook loose *(specced or recorded, not scheduled)*

These are the misalignments the owner predicted: the flow is right, but **how we sell, present or
provision does not match it yet.**

| what | where it lives | blocked on |
|---|---|---|
| **Care plans: à la carte or weekly, staff pick the days, quantity follows** — retires the 1x/2x SKUs, moves frequency out of the catalog | `TASK-CAREPLANS` | **owner: the care prices, and what a weekly price attaches to; whether lessons are in scope; how indefinite plans bill** |
| **Acquisition carries no pricing** | `TASK-CAREPLANS` §P1 | ready |
| **Per-order-line pricing** — staff record what a client was quoted; today price can only be set catalog-wide, so quoted orders sit at 0 | `docs/design/ACQUISITION-PRICING-AND-FULFILMENT.md` §3 | nothing — **needs no algorithm; ready to spec** |
| **The two pricing algorithms** — finder (fee ↔ duration ↔ volume) and assistance (fixed fee from budget band) | same design record §4 | **owner: not yet designed** |
| **Deal-client provisioning + fulfilment forms** — what staff fill in for a search or an evaluation | same design record §4 | owner |
| **Contract flow walked end to end** — author → send → sign → execute → deliver on real data | same design record §5 | needs its own task |
| **Lease is not own** — `horses` has one owner FK and no lease relationship, so a lessee is either falsely an owner or absent from their own stable | `ASKRIGHT` §A3e (reported, not built) | needs its own task |
| **`INTAKE_HORSE_*` forms have no surface** — five paper-form imports nothing can reach | `ASKRIGHT` §A7 (reported) | owner: are they the fulfilment forms? |
| **Horse-owner vs deal-client has no home** — `contact_type` lacks both; `deals` needs a `contract_id` | `CAREPATH` §C10a (thread reports its approach) | decide after CAREPATH reports |

---

# WAVE 3+ — known, not yet in a wave

- **`DEPENDENT`** — guardian buys, dependent rides. **Blocked on four owner answers.** Gabriella
  Olenik is a real 13-year-old currently recorded as the buyer of her own lessons.
- **`RECORDSELECT`** — row + bulk archive on Records tabs.
- **Whatever `HARVESTCLOSE` surfaces** — the owner's keep list becomes the queue.
- **Browser verification of everything shipped on 2026-08-15/16** — none of it has been walked in a
  browser.

---

# STANDING RULES THAT SURVIVE EVERY WAVE

- **The catalog is the source of truth for every number.** Nothing parses offering names — names
  changed 2026-08-15 and name-parsing broke credit minting three times.
- **Everything is an order** (`CAREPATH` §C5b). Selections write nothing until submit. Confirm +
  promote + invite are one act. Cancelling voids the line; the last line voids the order.
- **The act word is *inquire***; **book** is reserved for something on the calendar.
- **Ask, never assume** — which horse, whose horse, same horse.
- **Only what the owner keeps becomes a to-do.**
- **Never trust a thread's self-report.** Audit against real repo and DB state before merging.
