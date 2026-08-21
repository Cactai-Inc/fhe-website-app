# TASK-LESSONPLAN — lesson plans, progress, and the record of what happened

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** The only genuinely NEW construction in this
programme. **APPLY YOUR WORK. Do not hold.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-lessonplan`, branch `task/lessonplan`
(**copy `.env.db` and `.env.test` in — gitignored files do NOT propagate**) · report to
`docs/reports/TASK-LESSONPLAN-REPORT.md` · commit, **do not push** · no subagents · migrations
dry-run in `BEGIN … ROLLBACK` with the rollback proven, then applied and verified.

---

# 1. WHAT THE OWNER ASKED FOR

> **Owner, 2026-08-21:** *"i need to start using the calendar and lesson scheduling and the activity
> logs to generate reports and capture what happens in the lessons, we also need a full lesson plan
> building for claire to use to generate lesson plans for each client and then the lesson schedule
> updates with the plan for that day and after the lesson when the progress is recorded the plan
> updates and the next lesson gets its plans."*

**The loop, stated once:**
**a plan per client → the day's lesson shows that plan → after the lesson progress is recorded →
the plan updates → the next lesson carries the updated plan.**

**It is a loop, not a form.** A plan that does not roll forward is a note.

---

# 2. WHAT ALREADY EXISTS — converge, do not duplicate (D18)

**Measured, prod + source, 2026-08-21:**
- **`booking_forms`** — the per-booking instance layer built by `TASK-LESSONFORM`. **This is very
  likely where a plan and its progress attach.** Read it before designing anything.
- **`activity_checklists`** — read it; it may already be the activity-log shape.
- `SessionNotesView.tsx` · `SessionActivityForm` · `SessionsPage` (the central lessons list) ·
  `CalendarItemPanel` (the per-booking staff panel).
- `evaluation_reports` (+ `_shares`, `_access`) — the existing delivered-report machinery.
- `lesson_packages`, `lesson_credits`.

⚠️ **Start with a written inventory of what these already do.** If a plan can be a `booking_form`
instance, it should be. **A new parallel table beside `booking_forms` is the failure this project is
built out of.**

---

# 3. THE RULES THAT SHAPE THIS — D27, and it is already ruled

**Evaluations and activity records are RECORDS on a rider or horse — not documents, deals or money.**
The taxonomy, all living on the rider or horse record:
1. **Evaluations** — rider and horse. The initial entry, referenced downstream.
2. **Riding / exercise logs.** Riding applies to riders and horses; exercise to horses only. **Claire
   rides as Trainer, with a ride type of Training or Exercise.**
3. **Reports** — Riding Lesson Report · Horse Training Report.
4. **Horse Exercise Notes** — turnout and riding.
5. **Photos and video** — lessons, training, exercise. **Clipping needs a log, a note and
   before/after photos, and the app must PROMPT for them.**

⚠️ **NEVER LOCKED, ALWAYS LOGGED.** Records stay editable forever, **and every change is logged** so
nothing changes invisibly under an audit. Real deletion happens only at the database level.
⚠️ **The one scrub exception:** accidentally captured sensitive content (a wrong photo, a pasted
note) **can be fully destroyed, for liability.** Narrow — it is not a general delete and does not
weaken D11, D15 or executed-document evidence.
⚠️ **D25 naming:** never say "booking" to a human. A lesson is a **Riding Lesson**.

---

# 4. THE WORK

## §1 — a plan belongs to a client and rolls forward
A plan is **per client**, authored by Claire, and has an ordered notion of what comes next. **State
your model and justify it against `booking_forms` before building.**

## §2 — the day's lesson shows its plan
Wherever Claire sees the day — the calendar, the lessons list, her dashboard — **the scheduled Riding
Lesson carries the plan for that day.** ⚠️ **D26: Claire's dashboard is her working surface and the
landing screen on login.** The plan for today belongs there, not only on a detail page.

## §3 — progress is recorded after the lesson
Capture what actually happened: what was worked on, how it went, notes, photos/video. **Reuse the
session-notes/activity surfaces; do not build a third.**

## §4 — recording progress updates the plan, and the next lesson inherits it
**The loop closes here and this is the acceptance test.** Recording progress must change what the
next lesson shows. ⚠️ **Never silently overwrite** — the prior plan state is retained and the change
logged.

## §5 — everyone sees what makes sense for them
**An activity log is the minimum; clicking an entry opens the content.** The rider sees their own
lessons and progress; Claire sees hers; the horse's record carries what was done to it.
⚠️ **Client-visible content must not leak staff-private notes** — if a distinction is needed, state
it plainly and make the surface obvious about which is which.

## §6 — what this is NOT
Not a report *generator* producing PDFs (that is `evaluation_reports`' job) · not horse-care
scheduling (D25 owns that) · not a redesign of the calendar.

---

# 5. THE TEST THIS MUST PASS
1. **Claire authors a plan for a real client**, through the browser.
2. **A scheduled Riding Lesson for that client shows that plan**, on the day, on her landing surface.
3. **Progress is recorded against that lesson** — text and at least one photo.
4. **The NEXT lesson for that client shows an updated plan** that reflects what was recorded. **This
   is the loop and nothing ships without it.**
5. **The prior plan state is retained and the change is logged**, shown by query.
6. **The rider can see their own progress**, and no staff-private content leaks.
7. **Nothing says "booking" to a human** on any surface this task touches.
8. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file (46 red baseline).

# 6. THE REACH
What Claire clicks to author a plan, to see today's plan, and to record progress. **State whether
each is the only way.**

# 7. THE TELL
What the rider sees after a lesson is recorded, and how a mistaken entry is corrected or scrubbed.

# 8. REPORT
`docs/reports/TASK-LESSONPLAN-REPORT.md`, with **flagged-not-fixed**. **Open with the inventory of
what already existed** and what you reused rather than rebuilt.
