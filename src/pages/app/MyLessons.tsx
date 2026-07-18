import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, GraduationCap, MapPin, NotebookPen } from 'lucide-react';
import { ModuleGate, useAsync } from '../../lib/ops';
import { useModules } from '../../lib/ops/useModules';
import {
  myLessonsOverview, myLessonSessions, myLessonReports, addMyLessonNote,
  type MemberLessonSession, type MemberLessonReport,
} from '../../lib/ops/api-member';
import { formatSessionWhen } from '../../lib/formatDateTime';
import { toErrorMessage } from '../../lib/ops/errors';
import { useDocumentTitle } from '../../lib/hooks';

/**
 * CP-LESSONS — the member's Lessons page (module mod.lessons), the /app/lessons
 * nav target. Gated by ModuleGate('mod.lessons'): a lessons-OFF tenant sees the
 * lock and myLessonsOverview() never fires. Inside the gate: the member's
 * upcoming confirmed sessions (my_lesson_sessions RPC), the remaining-credit
 * balance (their own lesson_credits rows via the client-scoped RLS policy),
 * the purchase ledger, and the tenant's active packages linking to the in-app
 * catalog (/app/catalog) to buy more.
 */
/** One lesson report for the rider: logged activities, the instructor write-up,
 *  the pre-lesson/notes thread (authorship-labeled, uneditable), and a box to
 *  add their own note for the instructor. */
function ReportCard({ report: r }: { report: MemberLessonReport }) {
  const [notes, setNotes] = useState(r.notes);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activities = r.activity_log?.activities ?? [];

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await addMyLessonNote(r.booking_id, 'post', text.trim());
      setNotes((prev) => [
        ...prev,
        { author_role: 'rider', author_name: 'You', phase: 'post', body: text.trim(), created_at: '' },
      ]);
      setText('');
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not add your note.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-green-800/10 p-5">
      <p className="text-xs text-muted mb-2">{formatSessionWhen(r.starts_at, r.ends_at, r.location)}</p>

      {activities.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {activities.map((a) => (
            <span
              key={a}
              className="text-xs px-2 py-0.5 rounded-full bg-green-800/10 text-green-800"
            >
              {a}
            </span>
          ))}
        </div>
      )}

      {r.report && (
        <p className="body-text text-sm text-green-900 whitespace-pre-line mb-2">{r.report}</p>
      )}

      {notes.length > 0 && (
        <ul className="flex flex-col gap-1.5 mb-2 border-t border-green-800/10 pt-2">
          {notes.map((n, i) => (
            <li key={i} className="text-xs text-green-900/90">
              <span className="font-medium text-green-800">
                {n.phase === 'pre' ? 'Pre-lesson' : 'Note'} ·{' '}
                {n.author_name || (n.author_role === 'rider' ? 'You' : 'Instructor')}:
              </span>{' '}
              <span className="whitespace-pre-line">{n.body}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={1}
          placeholder="Add a note for your instructor…"
          className="form-input text-sm flex-1"
        />
        <button
          type="button"
          className="btn-secondary text-xs"
          disabled={busy || !text.trim()}
          onClick={() => void add()}
        >
          Add
        </button>
      </div>
      {err && <p className="form-error text-xs mt-1">{err}</p>}
    </div>
  );
}

export default function MyLessons() {
  useDocumentTitle('My Lessons');
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;

  const load = useAsync(myLessonsOverview);
  const [sessions, setSessions] = useState<MemberLessonSession[]>([]);
  const [reports, setReports] = useState<MemberLessonReport[]>([]);

  useEffect(() => {
    if (!lessonsOn) return;
    load.run().catch(() => {
      /* surfaced via load.isError */
    });
    myLessonSessions()
      .then(setSessions)
      .catch(() => {
        /* the credits ledger still renders */
      });
    myLessonReports()
      .then(setReports)
      .catch(() => {
        /* the progress section just stays empty */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonsOn]);

  const overview = load.data;
  const now = Date.now();
  const upcoming = sessions.filter(
    (s) => s.status === 'SCHEDULED' && new Date(s.ends_at).getTime() >= now,
  );

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">My lessons</p>
      <h1 className="heading-section text-green-800 mb-8">Your lesson credits.</h1>

      <ModuleGate moduleKey="mod.lessons" modules={modules}>
        {load.isError && (
          <p role="alert" className="form-error mb-4">
            {load.error?.message ?? 'Could not load your lesson credits.'}
          </p>
        )}

        {load.isPending && !overview && <p className="body-text text-muted">Loading…</p>}

        {/* Upcoming sessions — above the credits ledger. */}
        {upcoming.length > 0 && (
          <section aria-label="Upcoming lessons" className="mb-8" data-testid="upcoming-sessions">
            <h2 className="font-serif font-medium text-green-800 text-xl mb-4">Upcoming lessons</h2>
            <div className="flex flex-col gap-3">
              {upcoming.map((s) => (
                <div
                  key={s.id}
                  className="bg-white border border-green-800/10 p-5 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <CalendarClock size={18} className="text-gold-ink flex-shrink-0" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-sans font-medium text-green-900">
                        {formatSessionWhen(s.starts_at, s.ends_at)}
                      </p>
                      {s.location && (
                        <p className="text-xs text-muted mt-0.5 inline-flex items-center gap-1.5">
                          <MapPin size={12} aria-hidden="true" /> {s.location}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="bg-green-800 text-white text-xs font-sans px-2 py-0.5 tracking-wide whitespace-nowrap">
                    SCHEDULED
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Progress — your instructor's report for each lesson: what you worked
            on (logged activities), the write-up, and the notes thread you can
            add to for your instructor. */}
        {reports.length > 0 && (
          <section aria-label="Your progress" className="mb-8" data-testid="lesson-progress">
            <h2 className="font-serif font-medium text-green-800 text-xl mb-4 inline-flex items-center gap-2">
              <NotebookPen size={18} className="text-gold-ink" aria-hidden="true" /> Your progress
            </h2>
            <div className="flex flex-col gap-3">
              {reports.map((r) => (
                <ReportCard key={r.booking_id} report={r} />
              ))}
            </div>
          </section>
        )}

        {overview && (
          <>
            {/* Balance */}
            <div
              className="bg-white border border-green-800/10 p-6 mb-8 flex items-center justify-between"
              data-testid="credits-balance"
            >
              <div className="flex items-center gap-3">
                <GraduationCap size={20} className="text-gold-ink" aria-hidden="true" />
                <p className="text-sm font-sans font-medium text-green-900">Credits remaining</p>
              </div>
              <p className="font-serif text-3xl text-green-800">{overview.creditsRemaining}</p>
            </div>

            {/* Purchase ledger */}
            {overview.credits.length === 0 ? (
              <p className="body-text text-muted text-sm mb-8">
                No lesson credits yet. Purchase a package below to get started.
              </p>
            ) : (
              <div className="flex flex-col gap-3 mb-8">
                {overview.credits.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white border border-green-800/10 p-5 flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="text-sm font-sans font-medium text-green-900">
                        {c.package_key ?? 'Lesson credits'}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        Purchased {new Date(c.purchased_at).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm font-serif text-green-800 whitespace-nowrap">
                      {c.credits_remaining} of {c.credits_total} left
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Buy more — the in-app catalog is the authenticated purchase path */}
            <div className="bg-white border border-green-800/10 p-8">
              <p className="text-sm font-sans font-medium text-green-900 mb-1">Need more lessons?</p>
              {overview.packages.length > 0 && (
                <ul className="text-sm text-muted mb-4 list-none">
                  {overview.packages.map((p) => (
                    <li key={p.id} className="mt-1">
                      {p.name} · {p.credits} credits
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/app/catalog" className="btn-outline-gold">
                Shop the catalog <ArrowRight size={16} />
              </Link>
            </div>
          </>
        )}
      </ModuleGate>
    </div>
  );
}
