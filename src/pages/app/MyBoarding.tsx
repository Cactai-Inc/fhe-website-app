import { useEffect } from 'react';
import { Home } from 'lucide-react';
import { ModuleGate, useAsync, Money } from '../../lib/ops';
import { useModules } from '../../lib/ops/useModules';
import { myBoardingOverview, horseName } from '../../lib/ops/api-member';
import { useDocumentTitle } from '../../lib/hooks';

/**
 * CP-BOARDING — the member's Boarding page (module mod.boarding), the
 * /app/boarding nav target. Gated by ModuleGate('mod.boarding'): a boarding-OFF
 * tenant sees the lock and myBoardingOverview() never fires. Inside the gate:
 * the member's own board agreements (board_agreements RLS returns only rows
 * where they are the boarder) with each agreement's period charges.
 */
export default function MyBoarding() {
  useDocumentTitle('My Boarding');
  const modules = useModules();
  const boardingOn = modules['mod.boarding'] === true;

  const load = useAsync(myBoardingOverview);

  useEffect(() => {
    if (!boardingOn) return;
    load.run().catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardingOn]);

  const overview = load.data;

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">My boarding</p>
      <h1 className="heading-section text-green-800 mb-8">Your horse's board.</h1>

      <ModuleGate moduleKey="mod.boarding" modules={modules}>
        {load.isError && (
          <p role="alert" className="form-error mb-4">
            {load.error?.message ?? 'Could not load your board agreements.'}
          </p>
        )}

        {load.isPending && !overview && <p className="body-text text-muted">Loading…</p>}

        {overview &&
          (overview.agreements.length === 0 ? (
            <p className="body-text text-muted text-sm">
              No board agreements yet. When your horse boards with us, the agreement and its
              charges will appear here.
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {overview.agreements.map((a) => (
                <section
                  key={a.id}
                  className="bg-white border border-green-800/10 p-6"
                  aria-label={`Board agreement for ${horseName(a.horse)}`}
                >
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <Home size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-sans font-medium text-green-900">
                          {horseName(a.horse)}
                          {a.board_type ? ` · ${a.board_type}` : ''}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {a.start_date ? `Since ${new Date(a.start_date).toLocaleDateString()}` : 'Start date TBD'}
                          {a.end_date ? ` · ends ${new Date(a.end_date).toLocaleDateString()}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-sans text-green-700">{a.status}</span>
                      <p className="text-sm font-serif text-green-800 mt-1">
                        <Money amount={a.board_rate} /> / month
                      </p>
                    </div>
                  </div>

                  {a.charges.length === 0 ? (
                    <p className="text-xs text-muted">No charges posted yet.</p>
                  ) : (
                    <ul className="divide-y divide-green-800/10 list-none">
                      {a.charges.map((c) => (
                        <li key={c.id} className="py-2 flex items-center justify-between text-sm">
                          <span className="text-muted">
                            {new Date(c.period_start).toLocaleDateString()} –{' '}
                            {new Date(c.period_end).toLocaleDateString()}
                          </span>
                          <Money amount={c.amount} className="font-serif text-green-800" />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}

              <div
                className="bg-white border border-green-800/10 p-5 flex items-center justify-between"
                data-testid="boarding-total"
              >
                <p className="text-sm font-sans font-medium text-green-900">Total board charges</p>
                <Money amount={overview.chargesTotal} className="font-serif text-lg text-green-800" />
              </div>
            </div>
          ))}
      </ModuleGate>
    </div>
  );
}
