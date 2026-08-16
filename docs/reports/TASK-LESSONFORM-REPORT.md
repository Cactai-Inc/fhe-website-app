# TASK LESSONFORM — report

**Branch** `task/lessonform` · **worktree** `wt-lessonform` · **not pushed** (orchestrator merges).
**Migrations m1–m4 applied to prod** (`lrstswfxfsezdmvkvukc`), dry-run first, rollback proven.
Rollback script committed at `docs/reports/TASK-LESSONFORM-rollback.sql`.

Every DB claim below is query output. Render claims are marked **NOT VERIFIED** with an owner
checklist at the end.

---

## What was actually there (measured before building, 2026-08-16)

The task doc's measurements were mostly right. **Two were wrong**, and they changed the design:

| the doc said | what prod says |
|---|---|
| `booking_notes` — "no client code references it" | **False.** `add_booking_note()` is called from `src/lib/ops/api-member.ts:191` and `src/lib/ops/api-lessons.ts:445`, and `booking_report()` reads the thread back into `SessionNotesView` and the staff editor. It has 0 rows because no lesson has ended with anyone typing in it — built and wired, never used |
| `SessionNotesView.tsx` — "not connected to `booking_notes`" | **False.** It calls `addBookingNote` at line 42 and renders the thread at lines 92–117 |
| `form_definitions` — 27 rows | Confirmed: 15 `INTAKE_*` (audience CLIENT) + 12 `ENGAGEMENT_*` (audience COMPANY) |
| a response/submission/instance table | Confirmed: **did not exist**. This was the real gap |
| `activity_checklists` — 31 rows, per-service template list | Confirmed. 5 service types (RIDING_LESSON 8, JUMPER_TRAINING 6, HORSE_TRAINING 6, HORSE_EXERCISE 6, HORSEMANSHIP_TRAINING 5) |
| `bookings.status` already permits `completed`/`no_show` | Confirmed — no constraint migration needed |

What the doc did not mention, and what mattered most: **a form-shaped editor already existed**
(`LessonLogEditor.tsx` → `set_booking_log` / `set_lesson_progress_note`), writing straight into
`bookings.activity_log` and `bookings.notes`. So the work was not "build a form". It was: **put a
real instance behind the form that already existed**, and make the lifecycle real.

---

## L1 — the link

**No definition among the 27 fits, and I did not bend one into shape.** An intake form is answered
once per client before the service starts; an engagement form is answered once when the engagement
is created. Neither can be a per-session record. I seeded **exactly one** new definition —
`ACTIVITY_SESSION` ("Session Activity Form", audience `COMPANY`, which is what
`form_definitions_audience_check` permits; no constraint was widened).

Its four fields: `attendance` (radio) · `activities` (checklist) · `log_text` (staff record) ·
`report` (the rider sees this). The checklist field carries `"source": "activity_checklists"`
rather than a baked options list, so the 31 checklist rows stay the live source — see L4.

**Selection is per-service by construction.** `booking_form_key(service_type)` returns
`ACTIVITY_<SERVICE_TYPE>` when such a definition exists and falls back to `ACTIVITY_SESSION`.
Today only the generic exists; the owner can add a bespoke riding-lesson form later and it takes
over with no code change.

**The instance** is `booking_forms` — one row per booking, `UNIQUE (booking_id)`,
`ON DELETE CASCADE`, `answers jsonb`, `status open|submitted|retired`.

```
 form_id                              | booking_id                           | form_key         | service_type  | status | answers
 6df34368-d098-4eeb-9b75-bae861c1ce3e | f4ddf553-d038-4dae-8e39-b3264cde4937 | ACTIVITY_SESSION | RIDING_LESSON | open   | {}
 instances: 1
```

**Backfill:** 40 rows, one per serviced booking already on the books (the 277 `available` slots
correctly got none). 20 of the 40 came in **already carrying answers**, lifted from the
`activity_log` / `notes` those bookings already had — without that carry-in an already-logged
lesson would have presented as blank and been silently deleted on cancel.

```
 instances_backfilled: 40   |   with_answers: 20   |   all on status='scheduled' bookings
```

### Why a new table and not `booking_notes`

`booking_notes` is the **authored conversation** — append-only, one row per utterance, `phase`
pre/post, no field keys, no revision. Storing `activities = [Warm-up, Canter work]` as a note body
would make the answers unreadable and unrevisable, and would destroy a thread that is already
wired to two live surfaces. It stays alive and unchanged. **It is not the response store, and it is
not dead** — see L4.

### Why not a generic `form_responses`

The only subject with a lifecycle spec is a booking. A polymorphic response table would be
two-thirds unused — the exact trap the task named. **Intake-form responses remain unstored**; that
is a real, separate gap and is listed under *Not built* below.

---

## L2 — find, fill, discard

- **`lesson_forms(scope)`** — the backlog. `'todo'` = a lesson that has already started whose form
  is still open; also `past` / `upcoming` / `retired` / `all`.
- **`booking_form(booking_id)`** — one instance + its definition + the **live** checklist.
- **`save_booking_form(booking_id, answers, submit)`** — shallow-merges, so a partial save never
  wipes a field it did not mention.
- **`discard_booking_form(booking_id)`** — Claire's delete.

Proven on prod (Claire's session, rolled back):

```
 past_in_todo | future_in_todo | future_in_upcoming
            1 |              0 |                  1
```

**No-show is an option on the form**, and it does not write `bookings.status` itself — it calls
`cancel_lesson_session(p_no_show => true)`, which already owns that transition (and correctly does
not notify the member for a no-show, unlike a cancellation).

```
 form_status | booking_status
 open        | no_show
```

**An unfilled form is not an error state.** A blank instance is simply `open`; nothing nags.

---

## L3 — the lifecycle

### Reschedule → **no code at all**, and that is the finding

Every function in the database that moves a booking in time does it as an **in-place UPDATE** and
never changes `bookings.id`. Enumerated, not assumed:

```sql
select proname from pg_proc where pronamespace='public'::regnamespace
  and pg_get_functiondef(oid) ~* 'update bookings[^;]*starts_at';
--  decide_booking_change | save_calendar_item | update_my_pending_booking
```

Because the link is `booking_id`, the instance and every partial answer follow the booking for
free. Building a "move the form" step would only have created a way for it to get out of step.
Proven on prod through **both** live reschedule paths:

```
 (a) save_calendar_item   → same_instance_id: t | answers_survived: t   | new_time 2026-08-25
 (b) decide_booking_change→ still_same_instance: t | answers_still_intact: t | moved_to 2026-08-27
```

### Cancel → retire if written in, delete if blank

The owner said "self delete". D11 says nothing is purged. **I implemented: a form that has been
written in is RETIRED (kept, out of the working views); an untouched blank is genuinely DELETED.**

This is not an invention — it is exactly the rule `delete_calendar_item()` already applies to
bookings themselves (a booking carrying a client / purchase / credit / change request is
soft-deleted; one carrying none is `DELETE FROM bookings`). The form now **agrees with its own
booking** instead of contradicting it, which is what the task asked me to check.

```
 blank_form_before: 1  → cancelled → blank_form_after_cancel: 0        (deleted)
 answered form     → cancelled → status: retired | retired_at: set | answers intact
```

**If the owner wants written-in forms gone too, that is one line in
`trg_booking_form_lifecycle()` and nothing else changes.**

Also: a retired form refuses further edits, and if staff put a cancelled booking back on the
calendar the form comes back in the state it was in. A form Claire **deleted** does not come back —
the create branch fires only on a transition into a live state, which a discard is not (proven).

### Replacement → no replacement-detection

A replacement is a new `bookings` row, and the create branch fires on any serviced booking that
gains a client. There is no need to know it replaced anything, and no way to be wrong about it.

```
 new_form_id ≠ cancelled form_id : t | status open | answers {}
```

**CREDITALIGN coordination:** `generate_monthly_lessons` inserts with `client_id` and
`status='scheduled'`, so each pre-scheduled monthly lesson gets its own form on insert. No change
needed there, and no ordering constraint between the two tasks.

**REVIEWQ agreement:** `delete_calendar_item`'s hard-DELETE branch takes the form with it via
`ON DELETE CASCADE` (proven); its soft-delete branch sets `deleted_at` + `status='cancelled'`,
which the lifecycle trigger reads as "no longer live" and retires/deletes accordingly. Nothing
contradicts it.

---

## L4 — the wiring, and what is alive

**`booking_notes` — ALIVE, unchanged, and now visibly so.** Two call sites, read back by
`booking_report()`, rendered in `SessionNotesView` (rider) and the staff form (instructor). The
task's premise that nothing referenced it was wrong; the table is zero-row because no lesson has
ended with anyone typing in it, which is a usage fact, not a wiring fact. The test proves a note
lands and that the form's answers do **not** go there.

**`activity_checklists` — ALIVE, and now load-bearing.** The form's "What we did" field resolves
its items from `activity_checklist(service_type)` **at read time**, per the booking's own service.
Editing a checklist row therefore edits the form. It was previously read only by the ad-hoc log
editor; it is now the declared source for a definition-driven field.

**`SessionNotesView.tsx` — connected, kept.** It is the rider's read of a session. It was already
connected; nothing needed retiring.

**One writer.** `save_booking_form()` is the only thing that writes a form's answers, and it also
writes the two projections the rider surfaces already read — `bookings.activity_log` and
`bookings.notes`. The two RPCs that used to write those columns directly (`set_booking_log`,
`set_lesson_progress_note`) are **re-pointed through it**, same signatures, so there is no rival
writer left behind:

```
 legacy set_booking_log → form answers {"log_text":"via the legacy RPC","activities":["Canter work"]}
                        → bookings.activity_log {"text":"via the legacy RPC","activities":["Canter work"]}
```

This is the house pattern (`current_status` denormalized on documents/purchases/bookings), not a
second store.

---

## Fixed along the way (pre-existing, found because this task named the field)

**`booking_report()` returned `activity_log` wholesale to the booking's client, including `text` —
the instructor's own working record.** The staff editor labels that field "Log (instructor record)"
against "Instructor notes (the rider sees this)", so the intent was never that the rider sees it.
`SessionNotesView` only ever rendered `activities`, so nothing on screen changes — but the field
was on the wire. It is now nulled for non-staff callers. Proven:

```
 staff  : activity_log.text = 'staff only'  | form: present
 client : activity_log.text = null          | form: null   (activities still ['Flatwork'])
```

---

## Security

`anon` is **false on everything new** (`has_function_privilege`), and holds **no privilege at all**
on `booking_forms`:

```
 booking_form(uuid)                    anon f | authenticated t
 save_booking_form(uuid,jsonb,boolean) anon f | authenticated t
 discard_booking_form(uuid)            anon f | authenticated t
 lesson_forms(text)                    anon f | authenticated t
 _ensure_booking_form(bookings)        anon f | authenticated f
 trg_booking_form_lifecycle()          anon f | authenticated f
 booking_forms grants: authenticated = REFERENCES,SELECT,TRIGGER   (anon: none)
```

**m4 exists because `REVOKE … FROM PUBLIC` did not remove the direct grant.** This project sets
`ALTER DEFAULT PRIVILEGES … GRANT EXECUTE ON FUNCTIONS TO authenticated`, so the two internal
writers came out `authenticated = true` after m1–m3's revokes silently no-opped — the exact
SECFIX trap. m4 revokes them by name and the trigger still fires (proven under a real `SET ROLE
authenticated` session, not as superuser).

A non-staff member: sees **0 rows** in `booking_forms`, gets **0 rows** from `lesson_forms`, and is
refused by all three RPCs (`operator access required`). Direct table INSERT: `permission denied`.
D1a respected — the staff RLS predicate is `coalesce(org_id = current_org() AND has_staff_access(),
false)`, so the platform account comes out FALSE rather than NULL.

---

## The FEECHOICE seam — stated, because FEECHOICE has not run

`TASK-FEECHOICE` is **specified but not built** on `main` (commit `63e9518` is its spec; the only
fee work that shipped is `20260816T2100_change_fee_bands_from_policy.sql`, which loads the three
**reschedule** bands and deliberately loads **no** no-show fee).

What LESSONFORM hands it is the fact, not the fee:

- `bookings.status = 'no_show'` is now writable **from the form**, through the one function that
  owns the transition (`cancel_lesson_session`).
- Reading it is a plain query — no new API is needed:
  `select id, status, starts_at from bookings where status = 'no_show'`.
- Proven live: `no_show | 2026-08-13 | reschedule_bands_loaded: 3`.

**The $75 (Company Policies §6) is not loaded anywhere, by design** —
`booking_change_fees_hours_before_check` requires `hours_before > 0` and a no-show is not a
reschedule request at all. FEECHOICE owns where that number lives. **The two must agree on one
thing:** FEECHOICE must read `bookings.status='no_show'` as its trigger, not invent a second
marker. If it wants "who recorded it and when", that is `booking_forms.answers->>'attendance'` plus
`updated_at`/`submitted_by` on the same booking — already stored, no schema change needed.

---

## Files

| file | what |
|---|---|
| `supabase/migrations/20260816T2200_lessonform_m1_one_form_instance_per_booking.sql` | `ACTIVITY_SESSION` definition, `booking_forms` + RLS, three helpers |
| `supabase/migrations/20260816T2300_lessonform_m2_the_lifecycle.sql` | `_ensure_booking_form`, the lifecycle trigger, the 40-row backfill |
| `supabase/migrations/20260816T2330_lessonform_m3_find_fill_discard.sql` | `booking_form` / `save_booking_form` / `discard_booking_form` / `lesson_forms`; the two legacy writers re-pointed; `booking_report` extended + leak closed |
| `supabase/migrations/20260816T2350_lessonform_m4_close_the_default_grant.sql` | the two direct grants the defaults left open |
| `src/lib/ops/api-lessons.ts` | typed seams: `getBookingForm`, `saveBookingForm`, `discardBookingForm`, `listLessonForms` |
| `src/pages/app/ops/lessons/SessionActivityForm.tsx` | **replaces** `LessonLogEditor.tsx` — renders the definition, not hardcoded fields; save / mark done / discard |
| `src/pages/app/ops/lessons/SessionsPage.tsx` | new **"Forms to fill in"** filter (own query) + a count beside the lesson/slot counts |
| `src/pages/app/CalendarItemPanel.tsx` | points at the new component |
| `src/pages/app/ops/admin/AdminFormsPage.tsx` | labels the `COMPANY` audience it was already rendering raw |
| `test/db/lessonform_one_form_per_booking.test.ts` | **26 tests, all passing** |
| `docs/reports/TASK-LESSONFORM-rollback.sql` | proven rollback |

**One migration was corrected after being applied and then re-applied** (`m3`): the retired-form
guard sat *after* the ensure, so editing a form on a cancelled booking reported "this booking has no
activity form" — true of the booking, wrong about the form. Caught by the test of the same name, not
by reading. `m3` is pure `CREATE OR REPLACE` + grants, so re-running it is idempotent; prod carries
the corrected body (verified by `pg_get_functiondef`).

---

## Verification

- **Prod:** dry-run in `BEGIN … ROLLBACK` → applied → verified by query → rollback proven in a
  separate `BEGIN … ROLLBACK` (table gone, 9 functions gone, trigger gone, definition gone,
  `booking_report` back to its prior shape).
- **`test/db`:** `lessonform_one_form_per_booking.test.ts` — **26/26 pass**. It proves the gap on
  the pre-LESSONFORM snapshot first, then applies m1–m4, replays them to prove idempotence, then
  runs the lifecycle.
- **Suite baseline:** `test/db` on `main` is **not green** (46 of 69 files red per the CREDITALIGN
  measurement). My branch's failing file set is unchanged from main's — see the note at the end.
- `npm run typecheck` **0 errors** · `npm run typecheck:api` **0 errors** · `npm run lint`
  **0 new errors** (the single error, `test/db/creditfix_mint_from_unit_count.test.ts:261`, is
  pre-existing from `ef3fa71` and untouched by this branch; my files produce no lint output at all).

---

## NOT VERIFIED — render claims, for the owner to click through

Nothing below was seen in a browser. Numbered so a failure can be reported precisely.

1. `/app/ops/lessons` shows a fourth filter, **"Forms to fill in"**, and — when any are
   outstanding — an "N forms to fill in" link in the header line beside the lesson and open-slot
   counts.
2. That filter lists **past** lessons with an open form, most recent first, each labelled
   "Not started" or "Started, not finished".
3. Expanding **"Activity form"** on a row shows four sections: Attendance · What we did ·
   Instructor record · Notes for the rider.
4. "What we did" shows the eight RIDING_LESSON checklist items (Warm-up … Cool-down).
5. Pressing **No-show** then **Save** flips the row's badge to NO_SHOW and drops it out of the
   SCHEDULED action set.
6. On a lesson that is no longer SCHEDULED, the No-show option is visibly disabled with the line
   "A no-show can only be recorded while the lesson is still SCHEDULED."
7. **"Delete this form"** appears on an untouched form; once anything is typed the same control
   reads **"Close and keep as a record"**.
8. After deleting, the collapsed label reads "Activity form · discarded" and the lesson is still
   on the board.
9. A cancelled lesson's written-in form opens read-only with the amber line about being kept as a
   record.
10. The rider's own view (`/app/schedule` → "Notes & questions") still shows the activity chips and
    the instructor's rider-facing note, and **not** the instructor's log text.
11. `/app/ops/admin/forms` now shows a section headed **"Internal — staff fill these in"**
    containing "Session Activity Form", with a required checkbox per field.
12. Ticking a field required there and reloading the session form marks it with `*` and blocks
    **Mark done** until it is filled.

---

## Not built — named, not silently skipped

1. **A care no-show.** `cancel_lesson_session` is `kind='lesson'` only and its notification text
   says "Your lesson on …". Recording a no-show on a **care** session raises a clear error rather
   than being written around with a second status writer. Widening it is a small change but it
   changes a member-facing message, so it is the owner's call.
2. **Intake-form responses are still unstored.** `form_definitions` holds 15 CLIENT intake forms
   and there is still nowhere to put an answer to one. Out of this task's scope (its subject is a
   booking), but it is the other half of the gap the task doc identified and it is still open.
3. **`activity_checklists` has no editor — D13 is only half met here.** The owner can mark fields
   required on `/app/ops/admin/forms`, but **changing the checklist items themselves (adding
   "Pole work", renaming "Cool-down") still needs SQL.** That gap pre-dates this task — the table
   has never had a UI — but this task makes it matter more, because those rows are now the form's
   content. **Recommend a small settings panel** beside the calendar settings; it is a
   four-column CRUD over one table.
4. **The form does not complete the lesson.** Marking attendance "Attended" records the fact; it
   does **not** call `complete_lesson_session`, because that debits a credit and money actions
   should not ride on a note being saved. If the owner wants one button, say so and it is a
   one-line addition to `save_booking_form`.
5. **A defect found and not fixed (out of scope, CREDITALIGN's ground).** Booking a lesson against
   an offering whose `price_amount` is NULL crashes:
   `null value in column "price_amount" of relation "purchase_items" violates not-null constraint`
   — raised from `_provision_purchase_for_offerings` via `_debit_or_create_for_booking` via
   `save_calendar_item`. **13 of 43 offerings have a NULL price**, including
   `Horseback Riding Lessons`. Hit while writing the proof script, reproducible on prod. It has
   nothing to do with forms, so I did not touch it — but staff booking against any of those 13
   SKUs cannot create the booking at all today.
