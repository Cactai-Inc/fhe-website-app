# Horse availability & rider matching — autonomous booking

**Status:** specification + gap log. Nothing here is built.
**Authored** 2026-08-04 from the owner's description; the gap list is from a
live repo/database audit the same day.

---

## 1. The objective, in the owner's words

Riders book their own lessons without staff involvement. The system knows which
horses are available on which days, how much work each horse can take, and which
riders each horse suits — so a rider only ever sees times when a horse that
matches their skill level is genuinely free. Staff involvement reduces to a
day-of check that the assigned horse is fit to ride.

> "we will soon have enough horses in the system and their schedules and
> usability (rides per day, days per week, etc…) will be in the system along
> with their rider range so we can actually automate the scheduling so that
> riders with certain skill levels only see availability for days when there is
> a horse that matches their skill level available. this is the point where we
> can trust the system for all existing riders to just book their own schedules
> and we don't need to be involved, we just need to check the day of the lesson
> to make sure the assigned horse is fit for riding."

## 2. What the feature has to do

**Horse capacity is a real constraint, not a label.** Each horse carries limits —
rides per day, days per week, and whatever rest rules the owner sets. A horse at
its limit is not available, regardless of open calendar time.

**Rider skill gates the horse, not the slot.** A slot is bookable by a rider only
if at least one horse suitable for that rider's level is free at that time and
under its capacity limits. Two riders of different levels can see different
availability for the same hour.

**Lease terms bound the horse's availability.** A partial lease reserves days for
the lessor or lessee; the horse is not available to the lesson pool on days
another party has reserved. The lease is the source of truth, not a separate
calendar entry.

**Assignment happens at booking, verification happens on the day.** The system
picks (or proposes) the horse when the rider books, so capacity is committed.
Staff confirm fitness on the day — soundness, shoeing, behaviour — and can swap
the horse without the rider rebooking.

**Nothing is hidden from anyone.** Consistent with the standing owner ruling on
gating: a rider whose level matches nothing that day sees the day as unavailable,
not a hidden or filtered app surface.

## 3. Preconditions — what must be TRUE before implementation starts

This is deliberately a list of *states*, not a build plan. The implementation is
straightforward once every line here is true; attempting it earlier mixes
objectives.

| # | Precondition | Status 2026-08-04 |
|---|---|---|
| P1 | **Horses exist in the system as real records** — not test rows. Dependent on executed lease contracts, which create horse records through the execution-effects trigger. | **BLOCKED — pending.** The lease signing lifecycle is verified working end to end (2026-08-03), so this is expected within 24h of real leases being signed. |
| P2 | **Horse records carry capacity fields** — rides per day, days per week, rest/recovery rules. | **NOT BUILT.** No such columns on `horses`. |
| P3 | **Horse records carry a rider range** — the levels a horse suits. | **PARTIAL.** `horses.rider_level_min` / `rider_level_max` added 2026-08-04 (fields only, no vocabulary, no logic). |
| P4 | **Riders carry a skill level.** | **PARTIAL.** `contacts.rider_skill_level` added 2026-08-04 (field only, no vocabulary, not captured in any UI). |
| P5 | **A shared, ordered skill vocabulary exists** that both P3 and P4 resolve against, so "matches" is computable rather than a string comparison. | **NOT BUILT.** No lookup table; the two field sets above are free text pending this. |
| P6 | **Lease-reserved days are queryable per horse per date** — derived from executed lease terms, not hand-maintained. | **NOT BUILT.** Lease schedule is captured (`TXN.DAYS_USED`, week-grid, partial-lease gating) but stored as clause/field content, not as a queryable availability structure. |
| P7 | **Bookable open-slot inventory exists on a rolling horizon.** | **DONE.** `publish_open_slots` generates one-hour slots from `business_hours`; the hourly `/api/calendar-reminders` cron keeps a 4-week horizon. 283 slots standing. |
| P8 | **Booking debits a credit and claims a slot atomically.** | **DONE.** `book_open_slot` claims the slot and debits `lesson_credits`; verified live 2026-08-03. |
| P9 | **Slots can carry a horse assignment** and a booking can be reassigned to a different horse without the rider rebooking. | **PARTIAL.** `bookings.horse_id` exists and `attach_booking_horse` runs the care-eligibility gate; no reassignment flow, no capacity awareness. |
| P10 | **Horse fitness has a day-of state** staff can set (fit / not fit) that removes the horse from assignment without deleting bookings. | **NOT BUILT.** |

## 4. Already in place and correctly shaped

Worth keeping — these need no rework when the build starts.

- **Open-slot generation and the rolling horizon** (P7). Idempotent, collision-safe
  against existing appointments, org-local Pacific.
- **`book_open_slot`** (P8) — credit debit, slot claim, care-eligibility gate for
  horse services, `NO_CREDITS` and `HORSE_CARE_DOCS_REQUIRED` failure modes.
- **`calendar_free_busy`** — role-aware read; a client already sees flexible-open
  blocks as bookable and everyone else's time as opaque. The matching layer can
  filter what this returns rather than replacing it.
- **Care-document eligibility** (`assert_horse_care_eligible`) — auto-generates the
  per-horse release and vet authorisation, blocks fulfilment until executed.
- **`bookings.horse_id` + `attach_booking_horse`** — the assignment column and its
  document gate exist (P9's half that is done).
- **Horse record spine** — identity, ownership, location, vet/farrier, medications,
  and the contract-to-record sync that populates `lessee_contact_id`,
  `lease_start`, `lease_end` on execution.

## 5. Gaps — ordered by what unblocks what

1. **Skill vocabulary (P5)** — blocks P3 and P4 from being meaningful. Needs an
   ordered lookup (e.g. `lookup_options` with a `rider_level` key) so a range
   comparison is possible. Owner input required on the levels themselves.
2. **Rider level capture (P4)** — staff-facing field on the contact record; needs
   P5 first so it is a select, not free text (per the standing vocabulary rule:
   inputs bound to a vocabulary write codes, never labels).
3. **Horse rider-range capture (P3)** — same, on the horse record.
4. **Horse capacity model (P2)** — rides/day, days/week, rest rules. Needs an owner
   decision on the rules themselves before schema.
5. **Lease-derived availability (P6)** — the largest gap. Turning executed lease
   schedule content into a queryable per-horse per-date reservation.
6. **Matching query** — given a rider and a date range, which slots have a
   qualifying horse under capacity and unreserved. Composes 1–5.
7. **Assignment + reassignment (P9 remainder)** — commit a horse at booking; allow
   staff swap without disturbing the rider's booking.
8. **Day-of fitness state (P10)** — staff toggle that removes a horse from
   assignment and surfaces affected bookings for reassignment.

## 6. Open questions for the owner

- The **skill vocabulary**: what are the levels, and are they ordered strictly
  (a level-3 horse suits levels 1–3) or set-based (a horse suits an explicit list)?
- **Capacity rules**: rides per day and days per week per horse — plus whether
  rest is a hard rule (e.g. one day off after N consecutive) or advisory.
- **Assignment timing**: does the rider see which horse they are booked on at
  booking time, or only on the day?
- **Fallback**: when no qualifying horse is free, does the rider see nothing, or a
  request-a-time path that reaches staff?

---

# Part B — the rider's horse on a booking, and the lesson card

Added 2026-08-04 from the owner's description. Audit findings against live are
marked inline.

## 7. The promoted guest's document trail

A visitor who becomes a rider and then a horse owner accumulates, not replaces:

- **3 guest documents** — RELEASE_GENERAL, COMPANY_POLICIES, FACILITY_RULES
- **+2 rider documents** — RELEASE_PARTICIPANT, HUMAN_EMERGENCY_MEDICAL
  (COMPANY_POLICIES and FACILITY_RULES are already satisfied and are NOT re-signed)
- **+2 horse-owner documents** — RELEASE_HORSE_CARE, HORSE_EMERGENCY_VET
  (RELEASE_PARTICIPANT already satisfied)

**7 documents total**, one of which (RELEASE_GENERAL) is superseded in practical
terms by the participant release but is **archived, never deleted** — consistent
with the standing executed-documents rule. Requirement-set union on promotion is
built and verified (2026-08-04); the archive-not-delete behaviour on supersession
should be re-verified against this exact path when it is exercised.

## 8. The horse arrives AFTER the booking — auto-inheritance

The sequence the owner described: a rider with their own horse books and pays a
lesson, completes the horse-owner documents, creates the horse record — and the
horse record therefore **postdates the booking**.

**Question asked: can the lesson auto-inherit the horse once it is created?**
**Answer: yes, and most of the machinery exists.**

Already built:
- `bookings.horse_id` — the attachment column.
- `attach_booking_horse(booking, horse)` — verifies the caller owns the horse
  (direct ownership **or** an active `horse_relationships` party row), enforces
  the care-document gate, and attaches. A rider can therefore attach their own
  horse to their own future booking at any time after the fact.
- `assert_horse_care_eligible` — auto-generates the per-horse release and vet
  authorisation and blocks fulfilment until executed.

To build:
- **B1 — default lesson horse.** A rider with one horse gets it attached
  automatically; a rider with several sets a default ("the horse I ride in
  lessons"). Needs a flag on the horse or the relationship — a nullable
  `default_for_lessons` on `horse_relationships` is the natural home since the
  relationship is already the ownership/lease truth.
- **B2 — retroactive attach on horse creation.** When a horse record is created,
  attach it to that owner's **future, unassigned, own-horse lesson bookings**.
  Scope deliberately narrow: future only, empty `horse_id` only, and only where
  the booking's offering implies the rider supplies the horse. Idempotent.
- **B3 — the fallback the owner described.** If B2 does not fire, the rider sees
  an empty horse field on the lesson card and sets it themselves. **This is the
  safety net that makes B2 optional rather than load-bearing** — the manual path
  must work first.

With B1+B2 working, the owner's "take them to the calendar and tell them to
attach their horse" step becomes unnecessary. The calendar hand-off is the
**fallback UX**, not the primary path.

## 9. The lesson card — one record, two views

The owner's model: the **lesson** is the record; the calendar booking is a *view*
of it. The same fields appear in both places and are written by whoever owns them.

Fields on the card:
| Field | Written by | Visible to rider |
|---|---|---|
| Rider's notes / questions for the instructor | rider | always |
| Instructor's pre-lesson notes | instructor | per owner decision (see open questions) |
| Instructor's post-lesson notes | instructor | after the lesson |
| Horse — rider-supplied | rider/owner | always (their own horse) |
| Horse — barn-supplied | staff, at or after the lesson | **not until the lesson happens** |

**Horse visibility rule (owner):** a rider on a barn horse does not see the horse
assignment until the lesson occurs — assignment is recorded for usage and history
tracking. A rider on their **own** horse sees it always, because they set it.

Audit — already built and correctly shaped:
- `booking_notes` carries `phase` (`pre` / `post`) and `author_role`
  (`rider` / `instructor` / `staff` / `admin`) with a body — **this is exactly the
  structure this design needs.** No new notes table required.
- `bookings.notes` (free text) exists separately and is the older, unstructured
  field; the structured `booking_notes` rows are the right home.

To build:
- **B4 — the lesson card component**, rendered in both the calendar (right-side
  panel on booking click) and the lessons page, reading/writing the same
  `booking_notes` rows and `bookings.horse_id`.
- **B5 — per-role write gating** on each field, matching the table above.
- **B6 — horse-visibility rule** for barn-supplied horses (hidden until the lesson
  date passes, or until staff mark it visible).

## 10. Additional open questions

- Are the **instructor's pre-lesson notes** visible to the rider before the lesson,
  or staff-only until after?
- Should a rider be able to **change their attached horse** after booking, and up
  to when — any time before the lesson, or is there a cutoff?
- If a rider's default horse is **not care-eligible** (documents incomplete for
  that horse), does B2 attach it anyway and let the fulfilment gate catch it, or
  skip the attach? *(Recommendation: attach, so the gap is visible on the card
  rather than silently absent.)*
