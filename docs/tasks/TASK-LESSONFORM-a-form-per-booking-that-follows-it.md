# TASK LESSONFORM — every lesson carries its own activity form, and the form follows the booking

**Owner, 2026-08-16, verbatim — this is the spec:**

> *"the way this matches with the form used during/after the lesson matters the most. we need to
> make sure the lesson activity form is surfaced to claire for each lesson and she has the option
> to mark the participant as a no show or she doesnt use it because the lesson gets rescheduled
> and the form moves with it. this means each booking is assigned a form with an actual link
> between them. this makes it possible for claire to find the forms to fill out for the past
> lessons, delete them if she doesnt want to fill it in, or they move automatically when a
> booking is rescheduled and they automatically self delete when the booking is cancelled and is
> regenerated when a new booking is added as a replacement for the cancelled one."*

**Why this is the linchpin:** the no-show fee ($75, Company Policies §6) and the staff-applied
late-start fees (`TASK-FEECHOICE`) all depend on someone recording what actually happened at the
lesson. Today nothing does. **The form is where a no-show becomes a fact the fee can rest on.**

# WHAT WAS MEASURED (prod, 2026-08-16 — verify, then build)

**The pieces exist and none of them are connected:**

| thing | state |
|---|---|
| `form_definitions` | **27 rows** — the D12 form builder's definitions |
| a response / submission / instance table | **DOES NOT EXIST.** A form can be defined and never filled in. This is the central gap |
| `activity_checklists` | 31 rows, keyed by `service_type` — a per-service **template list**, no per-booking instance |
| `booking_notes` | correct shape (`booking_id`, `phase`, `author_role`, `body`) but **0 rows, ever**, and **no client code references it** — built, never wired |
| `SessionNotesView.tsx` | exists in the UI; not connected to `booking_notes` |
| `bookings.status` | **already permits `completed` and `no_show`** — no constraint migration needed |
| `fulfillment_units` | already keys on `booking_id`; a unit is consumed on `completed` |

**So: do not design a new form engine.** `form_definitions` is the definition layer (D12). What is
missing is (1) an instance-per-booking, (2) responses, and (3) the lifecycle rules below.

# THE BUILD

## L1 — a real link: one form instance per booking
- Assigning a lesson booking creates **its own form instance**, linked to that `booking_id`, from
  the appropriate `form_definitions` row for the service. Not a template lookup at render time —
  **an actual row**, so it can be found, filled, moved, and deleted independently.
- Choose the definition by the booking's service/offering. Where no definition fits, say so in the
  report rather than inventing one.

## L2 — Claire's surface: find, fill, or discard
- **Every lesson she has taught shows its form**, including past ones. The owner's words: *"find
  the forms to fill out for the past lessons"* — this is a backlog view, not just today's.
- **Marking the participant a no-show is an option on the form**, setting `bookings.status =
  'no_show'` (already legal). That status is what `TASK-FEECHOICE`'s $75 fee hangs off — the two
  must agree; state the seam in your report.
- **She can delete a form she does not want to fill in.** Owner's words. It must not nag forever.
- An unfilled form is not an error state — many lessons will never get one.

## L3 — the lifecycle, exactly as specified
- **Reschedule → the form MOVES with the booking.** Same instance, same partial answers, new
  date/time. It is not deleted and recreated; a half-written note survives the move.
- **Cancel → the form self-deletes.** Owner's words. ⚠️ **Read D11 before implementing**: nothing
  in this system is purged, retirement is a boolean. **A form with ANSWERS is evidence** — what
  happened at a lesson is a record. Implement "self-delete" as a retire for any form that has been
  written in, and a true delete only for an untouched blank. **State exactly which you did and
  why.** If the owner wants blanks truly gone, that is fine — a blank form records nothing.
- **A replacement booking regenerates a form.** When a cancelled booking is replaced, the new
  booking gets its own instance.

## L4 — the wiring nobody did
- `booking_notes` has the right shape and zero rows because nothing calls it. **Either use it as
  the response store or say plainly why a new table is better** — do not leave a third unused
  table behind. `SessionNotesView.tsx` is the UI that was built for this; connect it or retire it.
- Same for `activity_checklists`: it is a per-service template list. **Say whether the form
  instance draws its items from there**, or whether those 31 rows are now dead.

# TRAPS
- **Do not build a second form engine.** `form_definitions` is D12's, and D12 explicitly warns
  against building the version/publish machinery twice.
- **`category_document_requirements` has no editor** and the owner has ruled its editor belongs
  inside the template editor. If this task adds form-definition management, coordinate — do not
  build a rival admin surface.
- **REVIEWQ owns booking status transitions** (`decide_booking_change`) and **its delete path
  retires rather than destroys** rows carrying a client, purchase, credit, or request. A form
  instance is another such signal — **make sure retire/delete agrees with `delete_calendar_item`'s
  existing logic** rather than contradicting it.
- **CREDITALIGN is changing how monthly bookings are generated.** A monthly rider's pre-scheduled
  lessons will each need a form. Coordinate on when generation happens.
- **Do not re-apply migrations that are already live.** Check `pg_proc` first.
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run and **prove the rollback**.
- **`REVOKE … FROM PUBLIC` does not remove a direct grant** — prove with `has_function_privilege()`;
  `anon` false on everything new.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths.**
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes before reporting).

# THE TEST THIS MUST PASS
1. Creating a lesson booking creates exactly one linked form instance — prove the row and the link.
2. Claire sees forms for past lessons, not only upcoming ones.
3. Marking no-show on the form sets `bookings.status = 'no_show'`; prove `TASK-FEECHOICE` can read
   that fact to justify the $75 fee (or state the seam if FEECHOICE has not run).
4. Rescheduling moves the SAME instance with its partial answers intact — prove the id is unchanged
   and the answers survived.
5. Cancelling removes a blank form; a form with answers is retained (retired), per D11 — prove both.
6. A replacement booking gets a fresh instance.
7. Deleting a form Claire does not want leaves the booking intact.
8. `booking_notes` and `activity_checklists` are either used or explicitly declared dead, with
   reasons. No third unused table is left behind.
9. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

Report to `docs/reports/TASK-LESSONFORM-REPORT.md`. Do not push; the orchestrator merges.
