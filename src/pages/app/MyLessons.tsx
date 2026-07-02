import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { ModuleGate, useAsync } from '../../lib/ops';
import { useModules } from '../../lib/ops/useModules';
import { myLessonsOverview } from '../../lib/ops/api-member';
import { useDocumentTitle } from '../../lib/hooks';

/**
 * CP-LESSONS — the member's Lessons page (module mod.lessons), the /app/lessons
 * nav target. Gated by ModuleGate('mod.lessons'): a lessons-OFF tenant sees the
 * lock and myLessonsOverview() never fires. Inside the gate: the member's
 * remaining-credit balance (their own lesson_credits rows via the client-scoped
 * RLS policy), the purchase ledger, and the tenant's active packages linking to
 * the public /lessons funnel to buy more.
 */
export default function MyLessons() {
  useDocumentTitle('My Lessons');
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;

  const load = useAsync(myLessonsOverview);

  useEffect(() => {
    if (!lessonsOn) return;
    load.run().catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonsOn]);

  const overview = load.data;

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
