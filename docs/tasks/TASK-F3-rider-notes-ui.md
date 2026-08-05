# TASK F3 — Rider notes / questions field (UI)

Tracker item **F3 only**. Server side is DONE and untouchable: `booking_notes` table,
`add_booking_note` (derives author_role server-side; rider = booking's own client),
`booking_report`, RLS. All client wrappers exist (`addBookingNote`, `getBookingReport`,
`addMyLessonNote` — already accept `'pre' | 'post'`). This task is PURE REACT — no migrations,
no RPC changes, no DB writes beyond notes created during proof.

## Verified current state (orchestrator discovery 2026-08-04 — trust this)

- `CalendarPage.tsx:463-526` `ClientReportView` — collapsed behind "View session report"
  (:483), lazy-loads `getBookingReport(bookingId)`, renders the notes thread READ-ONLY (no
  textarea, no `addBookingNote` import). Mounted at :629 for `isMine && (lesson|care)` items.
  `booking_report` works fine on an upcoming booking with zero notes (unlike
  `my_lesson_reports()`, which filters note-less bookings out — do NOT drive upcoming UI off
  that feed and do NOT relax its filter).
- `MyLessons.tsx:161-185` "Upcoming lessons" cards render time/location/status only — no notes
  affordance. The "Your progress" `ReportCard` (:26) already writes notes but hardcodes
  `'post'` (:39) — that is correct for its post-lesson context; leave it alone.
- `item.is_mine` is a trustworthy ownership proxy (server-derived); `add_booking_note`
  re-derives ownership server-side, so client gating is UX-only.
- Tracker's "F4/F5 no UI" is stale: staff `LessonLogEditor.tsx` already has a phase-selectable
  compose (:104).

## Locked design (do not revisit)

1. Extract `ClientReportView` out of `CalendarPage.tsx` into
   `src/components/app/SessionNotesView.tsx` (same props, same lazy-load), and make it
   read+write:
   - Compose box (textarea + submit, matching the app's existing compose patterns — see
     `ReportCard` in MyLessons for the house style), calling
     `addBookingNote(bookingId, phase, body)`.
   - Phase is DERIVED, not chosen: `'pre'` when now < the booking's `starts_at`, else
     `'post'`. Pass `startsAt` as a prop from both hosts.
   - Render the thread grouped: "Before the lesson" (pre) then "After the lesson" (post),
     each chronological; author name + role label per note (data already in `BookingNote`).
   - Reword the report-centric copy: toggle label "Notes & questions"; empty state
     "No notes yet — ask a question or leave a note for your instructor."
   - Optimistic append after successful submit (mirror ReportCard's pattern, including its
     limitations — no invented ids).
2. `CalendarPage.tsx`: replace the inline `ClientReportView` with the import; the :629 mount
   gains `startsAt={item.starts_at}` (confirm the item field name from `api-calendar.ts`
   types). No other CalendarPage changes.
3. `MyLessons.tsx`: each "Upcoming lessons" card gets a collapsed `SessionNotesView`
   (bookingId + startsAt from the row), so a rider can ask a question before the lesson from
   the lessons page too. "Your progress" section untouched.
4. Tracker correction: update F3 status honestly; also correct F4/F5's stale "no UI" note to
   record that staff compose exists in `LessonLogEditor.tsx` (cite it) — do not change their
   status beyond that factual note.

## Proof
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors).
- Live write proof via the REAL RPC path in psql (the UI can't be browser-verified here):
  using the A11/A13 simulation technique (repoint test profile inside one transaction,
  `SET LOCAL request.jwt.claims`, ROLLBACK; confirm restoration), call
  `add_booking_note(<a real or throwaway booking of that client>, 'pre', 'F3 proof note')` and
  show `booking_report` returning it, then ROLLBACK — zero residue, confirmed by count.
- State plainly that browser verification is pending ("code-complete, browser pending" in the
  tracker if true).

## Rules
- Branch `task/f3-rider-notes` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-f3 -b task/f3-rider-notes origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- NO migrations, NO RPC edits, NO committed DB writes (rolled-back proof only).
- `ClauseDocument.tsx` FROZEN (not implicated anyway). Do not touch `LessonLogEditor.tsx`,
  `my_lesson_reports`, or ReportCard's post-hardcode.
- Report: `docs/reports/TASK-F3-REPORT.md`, committed + pushed. Print ONLY the report path.
