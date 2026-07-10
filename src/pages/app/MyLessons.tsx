import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, GraduationCap, MapPin, NotebookPen } from 'lucide-react';
import { ModuleGate, useAsync } from '../../lib/ops';
import { useModules } from '../../lib/ops/useModules';
import {
  myLessonsOverview, myLessonSessions, myLessonProgress,
  type MemberLessonSession, type MyLessonProgress,
} from '../../lib/ops/api-member';
import { useDocumentTitle } from '../../lib/hooks';

/**
 * CP-LESSONS — the member's Lessons page (module mod.lessons), the /app/lessons
 * nav target. Gated by ModuleGate('mod.lessons'): a lessons-OFF tenant sees the
 * lock and myLessonsOverview() never fires. Inside the gate: the member's
 * upcoming confirmed sessions (my_lesson_sessions RPC), the remaining-credit
 * balance (their own lesson_credits rows via the client-scoped RLS policy),
 * the purchase ledger, and the tenant's active packages linking to the public
 * /lessons funnel to buy more.
 */
export default function MyLessons() {
  useDocumentTitle('My Lessons');
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;

  const load = useAsync(myLessonsOverview);
  const [sessions, setSessions] = useState<MemberLessonSession[]>([]);
  const [progress, setProgress] = useState<MyLessonProgress[]>([]);

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
    myLessonProgress()
      .then(setProgress)
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
                        {new Date(s.starts_at).toLocaleString(undefined, {
                          weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
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

        {/* Progress — the aggregated notes your trainer left across your lessons
            (the second view of per-lesson notes; the first is each session card). */}
        {progress.length > 0 && (
          <section aria-label="Your progress" className="mb-8" data-testid="lesson-progress">
            <h2 className="font-serif font-medium text-green-800 text-xl mb-4 inline-flex items-center gap-2">
              <NotebookPen size={18} className="text-gold-ink" aria-hidden="true" /> Your progress
            </h2>
            <div className="flex flex-col gap-3">
              {progress.map((p) => (
                <div key={p.session_id} className="bg-white border border-green-800/10 p-5">
                  <p className="text-xs text-muted mb-1">
                    {new Date(p.starts_at).toLocaleDateString(undefined, {
                      weekday: 'long', month: 'long', day: 'numeric',
                    })}
                    {p.location ? ` · ${p.location}` : ''}
                  </p>
                  <p className="body-text text-sm text-green-900 whitespace-pre-line">{p.note}</p>
                </div>
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

            {/* Buy more — the public lessons funnel is the purchase path */}
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
              <Link to="/lessons" className="btn-outline-gold">
                Purchase a package <ArrowRight size={16} />
              </Link>
            </div>
          </>
        )}
      </ModuleGate>
    </div>
  );
}
