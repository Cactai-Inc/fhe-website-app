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

# WAVE 1 — the visitor's path ✅ **COMPLETE 2026-08-17**

| # | task | state |
|---|---|---|
| 1 | **`ASKRIGHT`** — what is asked, of whom, on which page | ✅ **MERGED** `bf45d1b` |
| 2 | **`CAREPATH`** — horse-care inquiry → order → provisioning → activation | ✅ **MERGED** `1de6599`, 7 migrations applied to prod |
| 3 | **`LESSONREQUEST`** — inquiry → agreed time → activation → payment → app | ✅ **BUILT** on `task/lessonrequest`, 4 migrations applied to prod — awaiting merge |
| 4 | **`GIFTPATH`** — gifts stay a conversation | ✅ **MERGED** `8b11182` — found gift enquiries never alerted anyone |
| 5 | **`SESSIONBOOK`** — `/lessons` becomes a purchase flow for members | ✅ **MERGED** `5b9a184` |

**Cancelled / retired by wave 1:** `RIDERQUALIFY` (rider questions already on the form),
`THREEFORMS` (fully superseded), `FUNNELDOORS` (superseded earlier).

✅ **`HARVESTCLOSE` done** — 975 flags → 535 items on `DECIDE.md`, awaiting the owner's keep/remove pass.

---

# WAVE 2 — what wave 1 shook loose *(specced or recorded, not scheduled)*

These are the misalignments the owner predicted: the flow is right, but **how we sell, present or
provision does not match it yet.**

| what | where it lives | blocked on |
|---|---|---|
| **Care plans: à la carte or weekly, staff pick the days, quantity follows** — retires the 1x/2x SKUs, moves frequency out of the catalog | `TASK-CAREPLANS` | **structural half is UNBLOCKED** (rate is per-session, two tiers, no volume discount; change no numbers yet). Still open: **are lessons in scope**, and **who raises the monthly charge** |
| **Staff-built monthly plan** — several care items, one fixed monthly price that is NOT the line sum, recurring until cancelled, paid monthly. No `plans`/`bundles` table exists | `TASK-CAREPLANS` §P5 (report, not build) | likely **one piece of work with per-order-line pricing** |
| **Monthly billing with a human in the loop** — bills in advance on the last day of the prior month; staff get an ops notification the day before, review a checklist, uncheck to skip an invoice, or remove a client from billing entirely. ⚠️ **No scheduler of any kind exists in the DB** | `docs/design/MONTHLY-BILLING-REVIEW.md` | **owner: the exact review day; whether invoices send if nobody reviews** |
| **Acquisition carries no pricing** | `TASK-CAREPLANS` §P1 | ready |
| **Per-order-line pricing** — staff record what a client was quoted; today price can only be set catalog-wide, so quoted orders sit at 0 | `docs/design/ACQUISITION-PRICING-AND-FULFILMENT.md` §3 | nothing — **needs no algorithm; ready to spec** |
| **The two pricing algorithms** — finder (fee ↔ duration ↔ volume) and assistance (fixed fee from budget band) | same design record §4 | **owner: not yet designed** |
| **Deal-client provisioning + fulfilment forms** — what staff fill in for a search or an evaluation | same design record §4 | owner |
| **Contract flow walked end to end** — author → send → sign → execute → deliver on real data | same design record §5 | needs its own task |
| ~~Lease is not own~~ **WITHDRAWN 2026-08-17 — the finding was wrong.** `horses` already carries `lessee_contact_id`, `lease_start`, `lease_end`; `horse_relationships` and `my_stable_horses` carry a lessee; the intake already asks OWNER/LESSEE. **No task needed.** | `ASKRIGHT` §A3e | — |
| **`INTAKE_HORSE_*` forms have no surface** — five paper-form imports nothing can reach | `ASKRIGHT` §A7 (reported) | owner: are they the fulfilment forms? |
| **Horse-owner vs deal-client** — resolved in `CAREPATH` §C10a: the grant is a DOCUMENT TRIGGER and documents follow the ORDER, not a horse record | merged | — |
| ⚠️ **A weekly ×2 item can still only take ONE weekday** — `CAREPATH` test 10 deliberately unmet; the writer beneath is the credit arithmetic CREDITALIGN reverted three times | `CAREPATH` report; shape of fix recorded | **overlaps `TASK-CAREPLANS` — do them together** |
| 🔴 **THERE IS NO TENANT TIMEZONE, AND CLIENTS ARE BEING TOLD THE WRONG TIMES.** No table in the database carries one, so every server-side `to_char()` over a timestamptz renders **UTC**: `confirm_booking` tells a client their 4pm lesson *"on Aug 26, 11:00 PM is confirmed"*. **12 live functions** do it — `confirm_booking`, `schedule_lesson_session`, `decide_booking_change`, `cancel_lesson_session`, `book_open_slot`, `request_open_time`, `request_booking_change`, `swap_booking_item`, `withdraw_my_pending_booking`, `appointment_notify`, `calendar_reminder_sweep`, `request_horse_intake`. Several are client-facing notifications. **Pre-existing, live, not caused by any wave-1 task.** The honest fix is a tenant timezone setting **with an editor** (D13), not a hardcoded constant | `LESSONREQUEST` report §5, F1 | **nothing — ready to spec.** Needs its own task; LESSONREQUEST worked around it by formatting the agreed slot in the staff member's browser |

---

# WEBSITE WORK — independent of the flow program, no collisions

| what | where | blocked on |
|---|---|---|
| **Footer: map beside Find Us, sign-in into the nav, credit line left / copyright centred** | `TASK-FOOTER` | the Cactai URL (later); two small owner questions. **Buildable now without them** |
| Footer nav still says "Our Story" | folded into `TASK-FOOTER` §F5 | — |
| `/about` still reachable from the footer, needs rebuild | not specced | owner |

# ⚠️ WAVE 1 IS BUILT BUT NOT WALKED

**Not one wave-1 screen has been opened in a browser.** Three live checklists are stacked and all
turn on the same unproven thing — **that emails actually send**:
- `TASK-LESSONREQUEST-REPORT.md` §6 — 9 steps; **item 5 proves the invitation carries the agreed
  time**, which is also the first real test of the timezone fix.
- `TASK-GIFTPATH-REPORT.md` — 4 items; a gift enquiry has never alerted anyone, so this is the first
  time it should.
- `TASK-CAREPATH-REPORT.md` §7 — 18 steps; item 10 is the live email.

**Build environment cannot do this**: no non-placeholder Supabase credentials, and the mail endpoints
are Vercel functions unreachable from psql. **It needs the owner, in a browser, on the deployed site.**

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
