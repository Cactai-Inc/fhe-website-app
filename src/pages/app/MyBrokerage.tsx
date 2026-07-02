import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Handshake } from 'lucide-react';
import { ModuleGate, useAsync } from '../../lib/ops';
import { useModules } from '../../lib/ops/useModules';
import { myBrokerageOverview } from '../../lib/ops/api-member';
import { useDocumentTitle } from '../../lib/hooks';

/**
 * CP-BROKERAGE — the member's Brokerage page (module mod.brokerage), the
 * /app/brokerage nav target. Gated by ModuleGate('mod.brokerage'): a
 * brokerage-OFF tenant sees the lock and myBrokerageOverview() never fires.
 * Inside the gate: a summary of the member's own search/purchase engagements
 * (engagements RLS returns only the caller's rows), each linking through to the
 * MyEngagements detail area (/app/engagements).
 */
export default function MyBrokerage() {
  useDocumentTitle('My Brokerage');
  const modules = useModules();
  const brokerageOn = modules['mod.brokerage'] === true;

  const load = useAsync(myBrokerageOverview);

  useEffect(() => {
    if (!brokerageOn) return;
    load.run().catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerageOn]);

  const overview = load.data;

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">My brokerage</p>
      <h1 className="heading-section text-green-800 mb-8">Your horse search &amp; purchase.</h1>

      <ModuleGate moduleKey="mod.brokerage" modules={modules}>
        {load.isError && (
          <p role="alert" className="form-error mb-4">
            {load.error?.message ?? 'Could not load your engagements.'}
          </p>
        )}

        {load.isPending && !overview && <p className="body-text text-muted">Loading…</p>}

        {overview && (
          <>
            {/* Summary */}
            <div
              className="bg-white border border-green-800/10 p-6 mb-8 flex items-center justify-between"
              data-testid="brokerage-summary"
            >
              <div className="flex items-center gap-3">
                <Handshake size={20} className="text-gold-ink" aria-hidden="true" />
                <p className="text-sm font-sans font-medium text-green-900">Open engagements</p>
              </div>
              <p className="font-serif text-3xl text-green-800">{overview.openCount}</p>
            </div>

            {overview.engagements.length === 0 ? (
              <div className="bg-white border border-green-800/10 p-8 text-center">
                <p className="body-text text-sm mb-6">
                  No search or purchase engagements yet. Start one from Acquisition Support.
                </p>
                <Link to="/acquisition" className="btn-outline-gold">
                  Acquisition Support <ArrowRight size={16} />
                </Link>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3 mb-8">
                  {overview.engagements.map((e) => (
                    <div
                      key={e.id}
                      className="bg-white border border-green-800/10 p-5 flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm font-sans font-medium text-green-900">
                          {e.service?.display_name ?? e.service_type}
                          {e.display_code ? ` · ${e.display_code}` : ''}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          Started {new Date(e.start_date ?? e.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs font-sans text-green-700 whitespace-nowrap">
                        {e.status_row?.display_name ?? e.status}
                      </span>
                    </div>
                  ))}
                </div>
                <Link to="/app/engagements" className="link-underline">
                  View engagement details
                </Link>
              </>
            )}
          </>
        )}
      </ModuleGate>
    </div>
  );
}
