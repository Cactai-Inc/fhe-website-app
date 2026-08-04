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
