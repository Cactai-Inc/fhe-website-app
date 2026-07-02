import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ModuleGate, useAsync } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { listEngagements, listEngagementStages } from '../../../../lib/api';
import { useDocumentTitle } from '../../../../lib/hooks';

/**
 * OPS-HUB-BROKERAGE — the mod.brokerage module hub (surface `ops`).
 *
 * Staff opens /app/ops/brokerage → the whole page is wrapped in
 * ModuleGate('mod.brokerage') (Layer C, §4.3): a tenant without the module
 * sees the lock and NO data fetch fires. Inside the gate:
 *  - KPI tiles: open engagements (status not terminal per engagement_status:
 *    COMPLETED/CANCELLED/ARCHIVED) split by CURRENT brokerage stage — for each
 *    open engagement `listEngagementStages(id)` returns stages ordered by
 *    effective_from, and the LAST row is the current stage (SEARCH /
 *    EVALUATION / TRANSACTION_REP; engagements with no stage rows yet bucket
 *    as "No stage").
 *  - Quick links to the brokerage working screens: engagements list, new
 *    engagement, documents queue, transactions.
 * Loading, error and success branches all render.
 */

/** engagement_status terminal codes (migration 20260629010000 seed). */
const TERMINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'ARCHIVED']);

export type StageKey = 'SEARCH' | 'EVALUATION' | 'TRANSACTION_REP' | 'NONE';

export interface BrokerageKpis {
  openTotal: number;
  byStage: Record<StageKey, number>;
}

/** Open engagements bucketed by their CURRENT stage (last stage row wins). */
export async function loadBrokerageKpis(): Promise<BrokerageKpis> {
  const engagements = await listEngagements();
  const open = engagements.filter((e) => !TERMINAL_STATUSES.has(e.status));

  const byStage: Record<StageKey, number> = {
    SEARCH: 0,
    EVALUATION: 0,
    TRANSACTION_REP: 0,
    NONE: 0,
  };

  const stageLists = await Promise.all(open.map((e) => listEngagementStages(e.id)));
  for (const stages of stageLists) {
    // listEngagementStages orders by effective_from ascending → last = current.
    const current = stages.length > 0 ? stages[stages.length - 1].stage : null;
    byStage[current ?? 'NONE'] += 1;
  }

  return { openTotal: open.length, byStage };
}

const KPI_TILES: { key: string; label: string; pick: (k: BrokerageKpis) => number }[] = [
  { key: 'open', label: 'Open engagements', pick: (k) => k.openTotal },
  { key: 'search', label: 'In search', pick: (k) => k.byStage.SEARCH },
  { key: 'evaluation', label: 'In evaluation', pick: (k) => k.byStage.EVALUATION },
  { key: 'transaction', label: 'In transaction rep', pick: (k) => k.byStage.TRANSACTION_REP },
  { key: 'nostage', label: 'No stage yet', pick: (k) => k.byStage.NONE },
];

const QUICK_LINKS: { label: string; to: string; description: string }[] = [
  { label: 'Engagements', to: '/app/ops/engagements', description: 'Browse and open every engagement.' },
  { label: 'New engagement', to: '/app/ops/engagements/new', description: 'Start a purchase, search or lease.' },
  { label: 'Documents', to: '/app/ops/documents', description: 'Contracts awaiting signature.' },
  { label: 'Transactions', to: '/app/ops/transactions', description: 'Billing lines and settlements.' },
];

export function BrokerageHubPage() {
  useDocumentTitle('Brokerage');
  const modules = useModules();
  const brokerageOn = modules['mod.brokerage'] === true;

  const load = useAsync(loadBrokerageKpis);
  const { run } = load;

  useEffect(() => {
    if (!brokerageOn) return;
    // Fire on mount; the rejection is captured on load.error and rendered below.
    run().catch(() => {});
  }, [brokerageOn, run]);

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <p className="eyebrow mb-2">Ops · Brokerage</p>
        <h1 className="heading-section text-green-800">Brokerage</h1>
      </header>

      <ModuleGate moduleKey="mod.brokerage" modules={modules}>
        {load.isError ? (
          <p role="alert" className="form-error text-sm">
            {load.error?.message ?? 'Could not load brokerage metrics.'}
          </p>
        ) : (
          <section aria-label="Open engagements by stage">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {KPI_TILES.map((tile) => (
                <div
                  key={tile.key}
                  data-testid={`brokerage-kpi-${tile.key}`}
                  className="flex flex-col rounded border border-green-800/15 bg-white px-5 py-4"
                >
                  <span className="text-sm text-green-800/70">{tile.label}</span>
                  <span
                    data-testid={`brokerage-kpi-${tile.key}-value`}
                    className="mt-2 font-serif text-3xl text-green-900"
                  >
                    {load.data ? tile.pick(load.data) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section aria-label="Quick links" className="mt-8">
          <h2 className="font-serif text-lg text-green-900">Quick links</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex flex-col rounded border border-green-800/15 bg-white px-5 py-4 hover:border-green-800/40 transition-colors"
              >
                <span className="font-serif text-green-900">{link.label}</span>
                <span className="mt-1 text-sm text-green-800/70">{link.description}</span>
              </Link>
            ))}
          </div>
        </section>
      </ModuleGate>
    </div>
  );
}

export default BrokerageHubPage;
