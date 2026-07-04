import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ModuleGate, useAsync } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { lessonsSummary } from '../../../../lib/ops/api-lessons';

/**
 * OPS-LESSONS-HUB — the Lessons module landing page (module mod.lessons).
 *
 * Gated by ModuleGate('mod.lessons'): a lessons-OFF tenant sees the lock and
 * lessonsSummary() never fires. Inside the gate the hub renders the
 * credits-outstanding KPI (sum of credits_remaining across the ledger) plus
 * active-packages / clients-with-credits counts, each card deep-linking to the
 * packages catalog and the credits ledger. A failed summary load renders the
 * error branch inline.
 */
export function LessonsHubPage() {
  const modules = useModules();
  const lessonsOn = modules['mod.lessons'] === true;

  const load = useAsync(lessonsSummary);

  useEffect(() => {
    if (!lessonsOn) return;
    load.run().catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonsOn]);

  const summary = load.data;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-green-900">Lessons</h1>
        <p className="text-sm text-green-800/70">Packages, credits and balances.</p>
      </div>

      <ModuleGate moduleKey="mod.lessons" modules={modules}>
        {load.isError && (
          <p role="alert" className="form-error mb-4">
            {load.error?.message ?? 'Could not load the lessons summary.'}
          </p>
        )}

        {load.isPending && !summary && (
          <p className="text-sm text-green-800/70" data-testid="hub-loading">
            Loading…
          </p>
        )}

        {summary && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div
              className="rounded border border-green-800/15 p-5 sm:col-span-3"
              data-testid="card-sessions"
            >
              <p className="form-label mb-1">Sessions</p>
              <p className="text-sm text-green-800/70 mb-2">
                Confirmed lesson bookings — schedule, complete, cancel.
              </p>
              <Link to="/app/ops/lessons/sessions" className="link-underline text-sm inline-block">
                Open the sessions board
              </Link>
            </div>

            <div
              className="rounded border border-green-800/15 bg-green-800/5 p-5"
              data-testid="kpi-credits-outstanding"
            >
              <p className="form-label mb-1">Credits outstanding</p>
              <p className="font-serif text-3xl text-green-900">{summary.creditsOutstanding}</p>
              <Link to="/app/ops/lessons/credits" className="link-underline text-sm mt-2 inline-block">
                Open credits ledger
              </Link>
            </div>

            <div
              className="rounded border border-green-800/15 p-5"
              data-testid="kpi-active-packages"
            >
              <p className="form-label mb-1">Active packages</p>
              <p className="font-serif text-3xl text-green-900">{summary.activePackages}</p>
              <Link to="/app/ops/lessons/packages" className="link-underline text-sm mt-2 inline-block">
                Manage packages
              </Link>
            </div>

            <div
              className="rounded border border-green-800/15 p-5"
              data-testid="kpi-clients-with-credits"
            >
              <p className="form-label mb-1">Clients with credits</p>
              <p className="font-serif text-3xl text-green-900">{summary.clientsWithCredits}</p>
              <Link to="/app/ops/lessons/credits" className="link-underline text-sm mt-2 inline-block">
                View balances
              </Link>
            </div>
          </div>
        )}
      </ModuleGate>
    </div>
  );
}

export default LessonsHubPage;
