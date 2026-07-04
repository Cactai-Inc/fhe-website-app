import { useCallback, useEffect, useMemo, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { Modal, ModuleGate, StatusBadge, useAsync, useToast } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import {
  listLessonSessions,
  listLessonClients,
  scheduleLessonSession,
  completeLessonSession,
  cancelLessonSession,
  type LessonSession,
  type LessonClientOption,
} from '../../../../lib/ops/api-lessons';
import { ScheduleSessionForm } from './ScheduleSessionForm';

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
 */
type SessionFilter = 'upcoming' | 'past' | 'all';

const FILTERS: { id: SessionFilter; label: string }[] = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
  { id: 'all', label: 'All' },
];

/** '2:00 PM – 3:00 PM' for one session row. */
function timeRange(s: LessonSession): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${new Date(s.starts_at).toLocaleTimeString(undefined, opts)} – ${new Date(
    s.ends_at,
  ).toLocaleTimeString(undefined, opts)}`;
}

export function SessionsPage() {
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;

  const [rows, setRows] = useState<LessonSession[]>([]);
  const [clients, setClients] = useState<LessonClientOption[]>([]);
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
      const [sessions, clientRows] = await Promise.all([listLessonSessions(), listLessonClients()]);
      setRows(sessions);
      setClients(clientRows);
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
  const visible = useMemo(() => {
    const now = Date.now();
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
  const handleSchedule = async (input: {
    client_id: string;
    starts_at: string;
    ends_at: string;
    location: string | null;
    notes: string | null;
  }) => {
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
          <h1 className="font-serif text-2xl text-green-900">Lesson sessions</h1>
          <p className="text-sm text-green-800/70">Confirmed bookings — complete, cancel, no-show.</p>
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
            Schedule a lesson
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

        {loading && rows.length === 0 ? (
          <p className="text-sm text-green-800/70">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-green-800/70" data-testid="sessions-empty">
            No lessons {filter === 'upcoming' ? 'coming up' : 'in this view'}. Use “Schedule a
            lesson” to book one.
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
                      <div>
                        <p className="text-sm font-sans font-medium text-green-900">
                          {clientName(s.client_id)}
                        </p>
                        <p className="text-xs text-green-800/70 mt-0.5">
                          {timeRange(s)}
                          {s.location ? ` · ${s.location}` : ''}
                        </p>
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
          title="Schedule a lesson"
          disableBackdropClose={schedule.isPending}
        >
          {formOpen && (
            <ScheduleSessionForm
              clients={clients}
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
