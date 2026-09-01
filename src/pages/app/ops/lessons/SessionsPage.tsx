import { useCallback, useEffect, useMemo, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { Modal, ModuleGate, StatusBadge, useAsync, useToast } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { Link } from 'react-router-dom';
import {
  listLessonSessions,
  countOpenLessonSlots,
  listLessonClients,
  listScheduleHorses,
  scheduleLessonSession,
  completeLessonSession,
  cancelLessonSession,
  listLessonForms,
  type LessonSession,
  type LessonClientOption,
  type ScheduleHorseOption,
  type LessonFormRow,
} from '../../../../lib/ops/api-lessons';
import { formatTimeRange } from '../../../../lib/formatDateTime';
import { ScheduleSessionForm, type ScheduleSessionFormValues } from './ScheduleSessionForm';
import { SessionActivityForm } from './SessionActivityForm';

/**
 * OPS-LESSON-SESSIONS — the confirmed-booking board (module mod.lessons,
 * migration 20260703120000). Staff see every session day-grouped (Upcoming
 * default; Past / All filters), each row carrying the client name, time window
 * and status. A SCHEDULED row offers:
 *   Complete → complete_lesson_session (debits the client's oldest credit row;
 *              the toast reports 'Completed — N credits left' or
 *              'Completed — no credits to debit'),
 *   Cancel   → cancel_lesson_session (member notified),
 *   No-show  → cancel_lesson_session(no_show).
 * 'Schedule a lesson' opens the booking form (client picker + date + start time
 * + duration 30/45/60/90 + location + note) → schedule_lesson_session; the RPC
 * rejects overlapping SCHEDULED sessions server-side and the message surfaces
 * in the form.
 *
 * LESSONFORM adds a fourth filter — TO WRITE UP — which is the backlog the
 * owner asked for: every lesson that has ALREADY HAPPENED whose activity form
 * nobody has finished (lesson_forms('todo')), most recent first. It is a
 * different query from the session list, not a client-side slice of it, because
 * "has a form outstanding" is a fact about the form and not about the booking.
 *
 * LESSONPLAN renames what a person reads here (D25 — "booking" is internal
 * taxonomy, a lesson is a Riding Lesson) and links out to the plan roster, so
 * this board is not a dead end when Claire wants to plan rather than record.
 * The plan itself renders inside each row's own record, via SessionActivityForm.
 */
type SessionFilter = 'upcoming' | 'past' | 'all' | 'forms';

const FILTERS: { id: SessionFilter; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
  { id: 'forms', label: 'To write up' },
];

/** '2:00 – 3:00 PM EDT' for one session row (full time window with zone). */
function timeRange(s: LessonSession): string {
  return formatTimeRange(s.starts_at, s.ends_at);
}

export function SessionsPage() {
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;

  const [rows, setRows] = useState<LessonSession[]>([]);
  /** COUNTFIX 1.3: the open-slot count, stated beside the lesson count and never
   *  merged into it. `null` = not loaded / unavailable, so the line simply omits
   *  it rather than claiming zero. */
  const [openSlots, setOpenSlots] = useState<number | null>(null);
  const [clients, setClients] = useState<LessonClientOption[]>([]);
  const [horses, setHorses] = useState<ScheduleHorseOption[]>([]);
  /** LESSONFORM: the outstanding-form backlog. Its own query (lesson_forms), so
   *  the count is a fact about forms and is never inferred from the session list. */
  const [forms, setForms] = useState<LessonFormRow[]>([]);
  const [filter, setFilter] = useState<SessionFilter>('upcoming');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const toast = useToast();

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [sessions, clientRows, horseRows] = await Promise.all([
        listLessonSessions(),
        listLessonClients(),
        listScheduleHorses(),
      ]);
      setRows(sessions);
      setClients(clientRows);
      setHorses(horseRows);
      // Non-blocking: the board is about lessons, so a failed slot count leaves
      // the line off rather than failing the page.
      countOpenLessonSlots().then(setOpenSlots).catch(() => setOpenSlots(null));
      listLessonForms('todo').then(setForms).catch(() => setForms([]));
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load lesson sessions.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lessonsOn) return;
    void loadAll();
  }, [lessonsOn, loadAll]);

  const clientName = useCallback(
    (clientId: string) => clients.find((c) => c.id === clientId)?.name ?? clientId.slice(0, 8),
    [clients],
  );

  // Upcoming: hasn't ended yet, soonest first. Past: ended, most recent first.
  // 'forms' is served by its own query, not by slicing this list.
  const visible = useMemo(() => {
    const now = Date.now();
    if (filter === 'forms') return [];
    if (filter === 'upcoming') {
      return rows.filter((s) => new Date(s.ends_at).getTime() >= now);
    }
    if (filter === 'past') {
      return rows
        .filter((s) => new Date(s.ends_at).getTime() < now)
        .slice()
        .reverse();
    }
    return rows;
  }, [rows, filter]);

  // Simple day-grouped list (insertion order follows the visible sort).
  const groups = useMemo(() => {
    const byDay = new Map<string, LessonSession[]>();
    for (const s of visible) {
      const day = new Date(s.starts_at).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const list = byDay.get(day) ?? [];
      list.push(s);
      byDay.set(day, list);
    }
    return Array.from(byDay.entries());
  }, [visible]);

  const complete = useAsync(completeLessonSession);
  const handleComplete = async (session: LessonSession) => {
    try {
      const r = await complete.run(session.id);
      setRows((prev) =>
        prev.map((s) =>
          s.id === session.id ? { ...s, status: 'COMPLETED', credit_id: r.credit_id } : s,
        ),
      );
      toast.success(
        r.debited
          ? `Completed — ${r.credits_remaining} credit${r.credits_remaining === 1 ? '' : 's'} left`
          : 'Completed — no credits to debit',
      );
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not complete the lesson.'));
    }
  };

  const cancel = useAsync(cancelLessonSession);
  const handleCancel = async (session: LessonSession, noShow: boolean) => {
    try {
      const r = await cancel.run(session.id, noShow);
      setRows((prev) => prev.map((s) => (s.id === session.id ? { ...s, status: r.status } : s)));
      toast.success(noShow ? 'Marked as a no-show.' : 'Lesson cancelled — the member was notified.');
    } catch (err) {
      toast.error(toErrorMessage(err, 'Could not update the lesson.'));
    }
  };

  const schedule = useAsync(scheduleLessonSession);
  // BOOKWRITE: was a hand-copied structural duplicate of the form's value type,
  // which silently omitted every field added to the form. Named type now, so a
  // new field the form collects cannot be dropped on the way to the RPC.
  const handleSchedule = async (input: ScheduleSessionFormValues) => {
    setFormError(null);
    try {
      await schedule.run(input);
      toast.success('Lesson scheduled — the member was notified.');
      setFormOpen(false);
      await loadAll();
    } catch (err) {
      // Error branch (e.g. the server-side overlap rejection): keep the form open.
      setFormError(toErrorMessage(err, 'Could not schedule the lesson.'));
    }
  };

  const busy = complete.isPending || cancel.isPending;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          {/* D25 — a person reads "Riding Lesson", never the internal
              taxonomy the row is stored under. */}
          <h1 className="font-serif text-2xl text-green-900">Riding Lessons</h1>
          <p className="text-sm text-green-800/70">
            Every scheduled Riding Lesson — complete, cancel, no-show, and write up what
            happened.
          </p>
          {/* COUNTFIX 1.3: this board counts LESSONS. Open slots nobody has taken
              are a different thing and are stated separately, never folded in. */}
          <p className="text-xs text-green-800/60 mt-1">
            {rows.length} Riding Lesson{rows.length === 1 ? '' : 's'}
            {openSlots !== null && (
              <>
                {' · '}
                <Link to="/app/calendar" className="link-underline">
                  {openSlots} open slot{openSlots === 1 ? '' : 's'} on the calendar
                </Link>
              </>
            )}
            {/* LESSONPLAN — the second way to the plans, so this board is not a
                dead end when Claire wants to plan rather than record. */}
            {' · '}
            <Link to="/app/ops/lessons/plans" className="link-underline">
              Lesson plans
            </Link>
            {/* COUNTFIX discipline: a third distinct thing, counted by its own
                query and never folded into either of the other two. */}
            {forms.length > 0 && (
              <>
                {' · '}
                <button
                  type="button"
                  className="link-underline"
                  onClick={() => setFilter('forms')}
                >
                  {forms.length} to write up
                </button>
              </>
            )}
          </p>
        </div>
        {lessonsOn && (
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setFormError(null);
              setFormOpen(true);
            }}
          >
            Schedule a Riding Lesson
          </button>
        )}
      </div>

      <ModuleGate moduleKey="mod.lessons" modules={modules}>
        <div className="flex flex-wrap gap-2 mb-4" aria-label="Filter sessions">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-sans transition-colors focus-ring ${
                filter === f.id
                  ? 'bg-green-800 text-white'
                  : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {toast.toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`mb-4 rounded px-4 py-2 text-sm ${
              t.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-900'
            }`}
          >
            {t.message}
          </div>
        ))}

        {loadError && (
          <p role="alert" className="form-error mb-4">
            {loadError}
          </p>
        )}

        {filter === 'forms' ? (
          /* LESSONFORM — the backlog. Every lesson she has taught whose form is
             still open, most recent first. An unfilled form is not an error
             state: she can fill it in, or delete it, straight from this row. */
          forms.length === 0 ? (
            <p className="text-sm text-green-800/70" data-testid="forms-empty">
              Nothing waiting to be written up. A Riding Lesson appears here once it has
              happened and nobody has recorded what went on yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-testid="forms-list">
              {forms.map((f) => (
                <li
                  key={f.form_id}
                  className="bg-white border border-green-800/10 p-4 flex flex-wrap items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-sans font-medium text-green-900">
                      {f.client_name ?? clientName(f.client_id ?? '')}
                    </p>
                    <p className="text-xs text-green-800/70 mt-0.5">
                      {formatTimeRange(f.starts_at, f.ends_at)}
                      {f.service_type ? ` · ${f.service_type.replace(/_/g, ' ').toLowerCase()}` : ''}
                    </p>
                    <p className="text-xs text-green-800/60 mt-0.5">
                      {f.has_answers ? 'Started, not finished' : 'Not started'}
                    </p>
                    <div className="mt-1">
                      <SessionActivityForm
                        bookingId={f.booking_id}
                        onChanged={() => {
                          void listLessonForms('todo').then(setForms).catch(() => undefined);
                        }}
                      />
                    </div>
                  </div>
                  <StatusBadge status={f.booking_status} />
                </li>
              ))}
            </ul>
          )
        ) : loading && rows.length === 0 ? (
          <p className="text-sm text-green-800/70">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-green-800/70" data-testid="sessions-empty">
            No Riding Lessons {filter === 'upcoming' ? 'coming up' : 'in this view'}. Use
            “Schedule a Riding Lesson” to add one.
          </p>
        ) : (
          <div className="flex flex-col gap-6" data-testid="sessions-list">
            {groups.map(([day, sessions]) => (
              <section key={day} aria-label={day}>
                <h2 className="form-label mb-2">{day}</h2>
                <ul className="flex flex-col gap-2">
                  {sessions.map((s) => (
                    <li
                      key={s.id}
                      className="bg-white border border-green-800/10 p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-sans font-medium text-green-900">
                          {clientName(s.client_id)}
                        </p>
                        <p className="text-xs text-green-800/70 mt-0.5">
                          {timeRange(s)}
                          {s.location ? ` · ${s.location}` : ''}
                        </p>
                        {s.notes && (
                          <p className="text-xs text-green-900/80 mt-1 italic line-clamp-2">“{s.notes}”</p>
                        )}
                        <div className="mt-1">
                          <SessionActivityForm
                            bookingId={s.id}
                            onReportChange={(note) =>
                              setRows((prev) => prev.map((x) => (x.id === s.id ? { ...x, notes: note || null } : x)))
                            }
                            onChanged={() => {
                              void listLessonForms('todo').then(setForms).catch(() => undefined);
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={s.status} />
                        {s.status === 'SCHEDULED' && (
                          <>
                            <button
                              type="button"
                              className="btn-outline-gold text-sm"
                              disabled={busy}
                              onClick={() => void handleComplete(s)}
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              className="btn-secondary text-sm"
                              disabled={busy}
                              onClick={() => void handleCancel(s, false)}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn-secondary text-sm"
                              disabled={busy}
                              onClick={() => void handleCancel(s, true)}
                            >
                              No-show
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <Modal
          open={formOpen}
          onClose={() => setFormOpen(false)}
          title="Schedule a Riding Lesson"
        >
          {formOpen && (
            <ScheduleSessionForm
              clients={clients}
              horses={horses}
              onSubmit={handleSchedule}
              onCancel={() => setFormOpen(false)}
              submitting={schedule.isPending}
              error={formError}
            />
          )}
        </Modal>
      </ModuleGate>
    </div>
  );
}

export default SessionsPage;
