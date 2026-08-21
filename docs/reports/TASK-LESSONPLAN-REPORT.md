# TASK-LESSONPLAN — report

**Owner ask (2026-08-21):** *"a full lesson plan building for claire to use to generate lesson
plans for each client and then the lesson schedule updates with the plan for that day and after
the lesson when the progress is recorded the plan updates and the next lesson gets its plans."*

**The loop is built and it closes.** A plan belongs to a rider · the day's Riding Lesson carries it ·
progress is recorded against it · the plan advances · **the next lesson shows the advanced plan.**
Proved end to end by `test/db/lessonplan_the_loop.test.ts` — 41 tests, all green, on the committed
snapshot.

---

## 1. THE INVENTORY FIRST — what already existed, and what I reused rather than rebuilt

The task said to open with this, and it changed the design. Measured from source and from the
migration journal before writing a line.

| Thing | What it already did | What I did with it |
|---|---|---|
| **`booking_forms`** (LESSONFORM, 4 migrations) | ONE instance per booking. Created by `trg_booking_form_lifecycle` when a booking gains a client; moves free on reschedule (the link is `booking_id`, which a reschedule never changes); retired with a cancelled booking if written in, deleted if blank; `UNIQUE (booking_id)`. | **REUSED as the lesson's half of the loop, and given ONE column** (`plan_id`). No parallel per-booking table. Progress still lands in `answers`, under a new key. |
| **`save_booking_form()`** | The ONE writer of a lesson's write-up, plus the `bookings.activity_log` / `bookings.notes` projections every rider surface already reads. `set_booking_log` and `set_lesson_progress_note` were re-pointed through it. | **`record_lesson_progress()` CALLS IT.** It does not write `answers` itself. There is still exactly one writer (D18). |
| **`activity_checklists`** (31 rows, 5 service types) | The per-service "what we did" list, resolved live by `activity_checklist()`. Not dead. | **Untouched.** It is the *activities* lane; a plan is the *objectives* lane. Conflating them would have made a rider's goals editable from a service-config screen. |
| **`SessionActivityForm`** | The instructor's per-lesson form, rendered from `form_definitions.ACTIVITY_SESSION`, with homes on the lessons board, in `CalendarItemPanel`, and in the forms backlog. | **EXTENDED, not replaced.** §3 says do not build a third recording surface; the plan and progress render inside it, so it inherits all three entrances. |
| **`SessionNotesView`** | The rider's read of one session (report, activities, notes thread). | **EXTENDED** with the plan and the photos. |
| **`booking_report()`** | Already split staff vs rider (`activity_log.text` withheld from a client). | **Widened** with the plan, using the same field-by-field construction. |
| **`status_events` + `_vocab`** | Append-only log, 5 entity kinds, one writer (`log_status_event`). D19: written and never read back. | **Widened by one entity kind** (`lesson_plan`) exactly as stage5 did for `fulfillment` — and given a **reader** (`client_lesson_plan().log`, rendered in the editor's history panel). No fifth ledger. |
| **`files` + `file_links`** (uploads spine) | `file_links.subject_type` already admitted `'booking'`. Staff could already attach. | **REUSED.** The only thing missing was the other half — a rider could not SEE an org file on their own lesson. Two narrow policies, no new file model. |
| **`evaluation_reports`** | The delivered-report machinery. | **Untouched** — §6 says this is not a report generator. |
| **`lesson_credits` / `lesson_packages`** | Money and entitlement. | **Untouched** — a plan is not an entitlement. |
| **`horse_page_detail` → HorsePage "Sessions & reports"** | Already lists what was done to a horse, with activities and the write-up. | **Left alone.** §5's horse half already exists; a second list beside it would be the D18 failure. See *flagged* below. |

### The one design call the task demanded I justify: why the plan is NOT a `booking_form`

`booking_forms` is **one row per booking**, `UNIQUE (booking_id)`, created and **retired with that
booking**. A plan is **per rider**, outlives every individual lesson, and its entire job is to
survive one lesson and reach the next one changed.

A plan stored as a `booking_form` would die with the booking it was written on (D11's retire path)
and would have to be copied forward by hand, lesson to lesson. That is exactly the *"plan that does
not roll forward"* the task calls a note.

**So the split is:** `lesson_plans` holds the plan (new — nothing in this system held a
forward-looking, client-scoped record); `booking_forms` keeps holding the per-lesson record and
gains **one column** pointing at the plan version that lesson was taught against. The convergence
the task asked for is real — the plan attaches to the instance that already exists — without
pretending a per-booking table can be a per-rider one.

---

## 2. THE MODEL

```
lesson_plans (org_id, client_id, version, status, supersedes_id,
              focus, objectives jsonb, coach_notes,
              advanced_from_booking_id, created_at, created_by, superseded_at)
  UNIQUE INDEX (client_id) WHERE status = 'current'      -- exactly one live plan per rider

booking_forms.plan_id → lesson_plans(id)                 -- the lesson's pin
```

**`objectives`** is an ordered array of `{id, label, state, note}`, `state ∈ planned | working |
achieved`. **Array order IS "what comes next"** — the first non-achieved objective is next up,
derived (`lesson_plan_next_up`) rather than stored, so reordering in the browser is the whole
interaction and there is no second field to keep in step. Every objective gets a **stable server-side
id**, so progress is recorded against the objective and not against its wording, which Claire
rewords.

**THE ONE RESOLUTION RULE**, implemented once in `_lesson_plan_for_booking()`:

> the plan for a lesson = the version **pinned** on its form if progress has been recorded;
> otherwise the rider's **current** version, live.

That single rule is what makes the loop work with **no scheduling machinery and nothing to keep in
step**: a lesson that has not happened has no pin, so the moment a plan advances every lesson still
ahead of it shows the new plan — including the next one. Pinning on record is what stops a past
lesson's write-up from silently re-reading as if it had been taught against a plan written
afterwards.

**Versions, not an editable row.** §4 says never silently overwrite; D27 says a record is never
locked but every change is logged. A version row **is** the retention, and superseding is the
supersession spine this codebase already runs on documents. `status_events` carries the log.
Nothing is destroyed to make a change and nothing is locked to prevent one.

**And no version-spam.** A save that changes nothing writes no version and no log entry
(`_lesson_plan_same`). Otherwise the history that exists to show what changed fills with rows where
nothing did, and the retention is worthless in the one moment it is needed.

---

## 3. WHAT SHIPPED

**Migrations** (4, additive, all `CREATE … IF NOT EXISTS` / `OR REPLACE`; replay proved by test):

| File | Contents |
|---|---|
| `20260821T1500_lessonplan_m1_a_plan_belongs_to_a_client.sql` | `lesson_plans` + RLS + `booking_forms.plan_id` + the `lesson_plan` vocab widening + `_lesson_plan_objectives` / `_current_lesson_plan` / `_lesson_plan_same` |
| `20260821T1510_lessonplan_m2_the_day_carries_the_plan.sql` | `_lesson_plan_for_booking` (the one resolver) · `lesson_plan_next_up` · `client_lesson_plan` · `lesson_plan_for_booking` · `lesson_plans_for_day` · `lesson_plan_roster` · `my_lesson_plan` · widened `booking_form()` and `booking_report()` |
| `20260821T1520_lessonplan_m3_progress_updates_the_plan.sql` | `_write_lesson_plan_version` (the one inserter) · `save_lesson_plan` · **`record_lesson_progress`** · `restore_lesson_plan_version` |
| `20260821T1530_lessonplan_m4_the_record_of_what_happened.sql` | `_file_is_on_my_booking` + two rider-visibility policies · `lesson_media` · `lesson_activity` · `scrub_lesson_content` |

**Frontend:**

- `src/lib/ops/api-lessonplan.ts` — the typed seam, with the loop stated once at the top.
- `src/components/app/LessonPlanEditor.tsx` — Claire authors a plan; ordered objectives with
  arrows; the history panel with **"Put this version back"**; the change log read back (D19).
- `src/components/app/LessonPlanProgress.tsx` — the plan + per-objective outcome + "what to work on
  next" + photos, rendered **inside** the existing activity form.
- `src/components/app/TodaysPlansPanel.tsx` — the day, with its plans, on the landing surface.
- `src/components/app/LessonActivityLog.tsx` — the activity log, one component, two audiences.
- `src/components/app/MyLessonPlanCard.tsx` — the rider's own plan.
- `src/pages/app/ops/lessons/LessonPlansPage.tsx` — the roster (`/app/ops/lessons/plans`).
- Extended: `SessionActivityForm`, `SessionNotesView`, `MyLessonsContent`, `SessionsPage`,
  `LessonsHubPage`, `InstructorHome`, `OpsDashboard`, `files.ts`, `api-lessons.ts` types,
  `pageRegistry.ts`, `App.tsx`.

---

## 4. THE REACH (task §6) — and whether each is the only way

**Author a plan**
1. **Records → Lessons → "Lesson plans" card → the roster → click a rider.** The primary way. The
   page has its **own nav row** (`lessons.plans` in `pageRegistry.ts`) and its own route in
   `App.tsx`. D17 exists because a routed page with no registry row is a page the owner concludes
   does not exist; this one has both.
2. **Riding Lessons board → the counts line → "Lesson plans".**
3. **Claire's dashboard → "Today's Riding Lessons" → "All lesson plans"**, and a per-row
   *"No plan yet — write one"* on any lesson whose rider has none.
4. **Her quick-actions tile** on the trainer home now points at Lesson plans.

**Not the only way, on purpose.** She plans ahead on the roster and adjusts in the moment inside a
lesson.

**See today's plan**
1. **`/app/ops` — the landing surface.** `TodaysPlansPanel` renders on **both** dashboards.
   *(Both owner accounts are admins, so `/app/ops` renders `OpsDashboard`, not `InstructorHome` —
   putting the day's plans only on the trainer home would have hidden them from the head trainer.
   That was checked, not assumed.)*
2. **Riding Lessons board** — every row's record carries it.
3. **The calendar** — `CalendarItemPanel` already embeds `SessionActivityForm`, so the plan arrived
   there with no calendar change (§6: not a calendar redesign).

**Record progress**
- **One surface, three entrances:** `SessionActivityForm`, reachable from the Riding Lessons board,
  the calendar's lesson panel, and the *"To write up"* backlog. **The only way**, deliberately —
  §3 says reuse, and a second recorder is how two records of one lesson start disagreeing.
- The primary button is **"Record progress & update the plan"**. Plain **Save** keeps the
  per-objective results with the form and leaves the plan alone.

---

## 5. THE TELL (task §7) — what the rider sees, and how a mistake is fixed

**After a lesson is recorded, the rider sees, without being told to look:**
- **"Your plan"** on their lessons page — the focus, every objective with its state, the note Claire
  left on each one, and *"Next Riding Lesson leads with: …"*.
- **"Every Riding Lesson"** — the activity log. Each entry opens to the write-up and **the photos
  from that lesson**.
- On any individual lesson (calendar or upcoming card), **"What we're working on"** plus the photos.

**What they never see:** `lesson_plans.coach_notes`. `my_lesson_plan()` does not select it, and
`booking_report()` passes `p_include_private = v_staff`. There is no strip-the-private-keys step
anywhere — that is the shape that leaks the first time somebody adds a column. Proved by the test
*"and NEVER the staff-private coach notes"*, which asserts the notes are really in the table and
really absent from the payload.

**Correcting a mistake — D27's "never locked, always logged".** Nothing here locks. Claire re-opens
any past lesson's record and saves again (proved by *"records stay editable forever"*); she edits
the plan and gets a new version with the old one kept; she can put any earlier version back, and
**the restore is itself a new version**, so nothing in between is lost either (D19's reversibility
without erasure).

**Scrubbing — D27's ONE exception, and nothing wider.** `scrub_lesson_content(kind, subject, reason,
key)` is the only thing in this feature that destroys anything:
- `media` — deletes the `files` and `file_links` rows and hands back the storage path, which the
  wrapper then removes from the bucket. Refuses a file published in the content catalogue.
- `answer` — removes one text field from the form **and its projection on `bookings`**, because
  leaving the projection is leaving the content in the system.
- `objective_note` — removes one objective's note from **every retained version**, because
  scrubbing only the current one leaves the text in the history this task works to retain. The
  objective survives; only the note is destroyed.

It **requires a reason**, stores the reason and never the content, and logs the scrub so an audit
sees that something was removed and why. In the browser it is a confirm that says what it will do
before it does it (D19). **It does not weaken D11, D15 or D16** — a lesson photo is not an executed
document, an account or a template, and this path is for content that should never have been
captured at all.

---

## 6. THE TEST (task §5)

`test/db/lessonplan_the_loop.test.ts` — **41 tests, all passing.** The acceptance case is
`§3 + §4 — THE LOOP`:

1. Claire authors a plan for a real client → version 1. ✔
2. A lesson **today** shows that plan on `lesson_plans_for_day()`, with the right *next up*. ✔
3. Progress is recorded on a held lesson — attendance, activities, the instructor log, the rider
   report, one objective achieved, one new objective discovered, a new focus. ✔
4. **The NEXT lesson shows the updated plan** — new version, new focus, the achieved objective
   marked and no longer next up, the discovered objective present. ✔ **This is the loop.**
5. The prior version is `superseded`, still says what it said when it was taught, is linked by
   `supersedes_id`, names the lesson it came out of — and the change is in the log, **read back**
   through `client_lesson_plan()`. ✔
6. The rider sees their own plan and their own activity; the coach notes and the instructor log are
   absent from every rider payload; another member sees nothing. ✔ **And a rider has no read on
   `lesson_plans` at all** — see the correction below. ✔
7. A photo on a lesson is visible to that rider and to nobody else; a scrub removes it from the
   system entirely and leaves the reason behind. ✔
8. Nothing on any surface this task touches says "booking" to a person. ✔ (see below)

**Checks**
- `npm run test:db` — **74 files / 849 tests · 46 files red · 203 tests failed · 539 passed.**
  Baseline captured on this branch before any change: **73 files / 808 tests · 46 red · 203 failed ·
  498 passed.** Diffed **file for file**: the set of red files and their per-file failure counts are
  **identical**. The only movement is +1 file and +41 passing tests, which are mine.
- `npm run typecheck` — **0 errors** (baseline 0).
- `npm run lint` — **0 errors, 46 warnings** — byte-identical to the pre-change baseline captured
  on this branch. *(CLAUDE.md still says "~26 pre-existing warnings"; the real number on `main`
  today is 46. Flagged below, not silently accepted.)*
- `npm run build:client` — clean.
- `npx vitest run test/ui/pagevis_registry.test.ts` — 12/12, so the new registry row resolves to a
  real route.

---

## 7. D25 — the naming pass on the surfaces this task touches

*"booking"* is internal taxonomy; a lesson is a **Riding Lesson**. Changed on every surface I
touched:

| Was | Now |
|---|---|
| `Lesson sessions` / *"Confirmed bookings — complete, cancel, no-show."* | `Riding Lessons` / *"Every scheduled Riding Lesson — complete, cancel, no-show, and write up what happened."* |
| *"Schedule a lesson"* | *"Schedule a Riding Lesson"* |
| Filter *"Forms to fill in"* · *"N forms to fill in"* | *"To write up"* · *"N to write up"* |
| *"No activity form on this booking"* · *"This booking was cancelled"* | *"No record on this session"* · *"This session was cancelled"* |
| Collapsed toggle *"Activity form · …"* | *"Plan & record · …"* (lesson) / *"Session record · …"* (care) |
| Hub card *"Sessions — Confirmed lesson bookings"* | *"Riding Lessons — Every scheduled Riding Lesson…"* |
| *"All sessions"* · *"No lessons scheduled today"* | *"All Riding Lessons"* · *"No Riding Lessons scheduled today"* |

Remaining `booking` occurrences in those files are **code comments, prop names and RPC parameters**
— the data concept, which D25 keeps.

---

## 8. FLAGGED — NOT FIXED

1. **⚠️ NOTHING WAS APPLIED TO PRODUCTION, AND NOTHING COULD BE.** The task's discipline is
   dry-run in `BEGIN … ROLLBACK` against prod, apply, verify. **`.env.db` is gitignored and is not
   present in this environment**, so there is no connection string and no `psql` target. The
   migrations are **written, applied and verified against a real Postgres** — the repo's PGlite
   harness, loading the committed schema snapshot, which is the same mechanism `lessonform`'s own
   test uses — and the replay case is explicitly tested. **They still need the owner's
   apply-and-verify pass against prod.** I am not reporting this as done when it is not.

2. **Baseline drift in CLAUDE.md.** It states *"lint 0 errors (~26 pre-existing warnings)"*. The
   measured baseline on this branch before any change was **46 warnings**. My diff adds none. The
   doc is stale, not the build.

3. **The horse's record is not given a second log.** §5's *"the horse's record carries what was done
   to it"* is **already true**: `HorsePage`'s History tab renders `horse_page_detail.sessions` with
   the activities and the write-up. `lesson_activity(p_horse_id => …)` exists as the seam if the
   owner wants **photos and the plan version** there too — but adding a second list beside the
   existing one is precisely the D18 failure, and folding photos into the existing one means
   changing `horse_page_detail`, which is outside this task. **Named, not done.**

4. **Care sessions get the record, not the plan.** `LessonPlanProgress` renders only when
   `kind = 'lesson'`, and `record_lesson_progress` refuses a session with no client. A horse-care
   session keeps the LESSONFORM record it already had. D25 rules that horse care is named and
   scheduled differently from lessons, so giving it a rider-shaped objectives plan would have been
   inventing a product. **If the owner wants a per-horse care plan, it is a separate shape.**

5. **`scrub_lesson_content('media')` needs the browser to finish the job.** The RPC removes the rows
   and returns the storage path; the wrapper removes the object. Supabase Storage has no SQL-side
   delete, and every other file path in this app does the same — but a scrub that fails **after**
   the RPC commits leaves an orphaned object with no row pointing at it. It is unreachable (no row,
   no signed URL) but it is still bytes. **A storage sweeper for orphaned objects does not exist in
   this codebase and is not built here.**

6. **`window.confirm` / `window.prompt` for the two D19 confirmations.** They state what will happen
   and capture a reason, which is what D19 requires, but they are browser dialogs rather than the
   app's own `Modal`. **Deliberate**: the alternative was a modal component per confirmation inside
   a form that is already three levels of nesting deep. **Worth replacing when the surface is next
   revisited.**

7. **The plan is not tenant-configurable in the D13/D21 sense, and I do not think it should be.**
   `planned | working | achieved` is a vocabulary, and D13 says a vocabulary needs an editor. It is
   hardcoded in `_lesson_plan_objectives`'s CHECK and in `OBJECTIVE_STATE_LABEL`. **I am flagging it
   rather than building an editor**: three states are the mechanic that makes `next_up` derivable,
   not tenant copy, and a tenant that renamed them to five would break the derivation. If the owner
   wants the *labels* editable that is a small config read; if he wants the *states* editable, that
   is a different feature and it should be specced.

8. **No notification when a plan advances.** The rider finds out by looking. D9 ended the email
   chain at setup and I did not reopen it. **If the owner wants "your plan was updated" to reach a
   rider, that is a decision, not an oversight.**

9. **`lesson_plans_for_day()` compares `starts_at::date` against `current_date`**, which reads the
   session timezone that `20260817T1600` set at role level (Pacific). Correct in production. In
   PGlite the role-level setting does not apply, so the test pins the day explicitly rather than
   asserting against a timezone the harness does not have.

10. **`CalendarItemPanel` still says "booking" in several places a person can read** (*"Save this
    booking once to assign the plan…"*, *"the booking records whoever saved it"*). The plan renders
    correctly inside it via `SessionActivityForm`, but I did not otherwise edit that file, and D25
    naming across the whole calendar is its own pass. **Listed so it is not lost.**

---

## 9. WHAT A REVIEWER SHOULD CHECK FIRST

- `_lesson_plan_for_booking()` in m2 — the whole loop rests on those twelve lines.
- The **pin ordering** in `record_lesson_progress` step 5: the form save must run first (it is what
  guarantees the instance exists), and the pin must be the version that was **taught against**, not
  the one the call produces.
- `_lesson_plan_json(p_include_private)` — every call site names its audience literally. If a future
  reader adds a caller that passes `true` on a client path, that is the leak.
- **`record_lesson_progress` advances from `v_base` (the CURRENT plan) but pins `v_taught` (the one
  the lesson carried).** They are the same row the first time and different every time after, and
  the difference is the whole reason a second "Record progress" click is a no-op instead of a fresh
  identical version. My own first draft advanced from `v_taught`; two regression tests now hold the
  line (*"re-saving a lesson that was ALREADY recorded … is a no-op"* and *"a hand edit made after
  the lesson is not clobbered"*).
- **The absent RLS policy on `lesson_plans` for riders.** My own first draft added
  `lesson_plans_own_read` ("the rider may read their own plan") with a comment claiming the
  private/public split was enforced at the RPC. It was not — the RPC was merely the only caller,
  which is a much weaker thing, and `supabase.from('lesson_plans').select('*')` would have handed a
  rider their instructor's private notes about them. The policy is gone; riders read only through
  `my_lesson_plan()`, and a test now asserts a direct read returns nothing.
- `_file_is_on_my_booking()` — one definition serving both the row policy and the storage policy, so
  the two cannot drift into disagreeing about what a rider may see.
