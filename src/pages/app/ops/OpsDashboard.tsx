import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  countEngagements,
  countOpenDocuments,
  countOpenBillableLines,
  listIntake,
} from '../../../lib/api';
import { ModuleGate, useAsync } from '../../../lib/ops';
import { useModules } from '../../../lib/ops/useModules';

/**
 * OPS-DASH — Ops home dashboard (surface `ops`, module `core`).
 *
 * Entitlement-aware landing page for staff at `/app/ops`:
 *  - Four RLS-scoped KPI tiles (open engagements, intake to review, documents
 *    awaiting signature, open charges). A tile with a registered screen is a
 *    real <Link>; a tile whose screen has not shipped yet renders the SAME
 *    count as a non-navigating status tile (dead links are forbidden). Every
 *    tile renders its resolved count on mount and shows an INLINE error
 *    (never a blank tile) when its count fn rejects.
 *  - A module launcher whose per-module tiles are wrapped in <ModuleGate>:
 *    an enabled module with a registered hub route (MODULE_HUB_ROUTES) renders
 *    as a navigating <Link>; an enabled module WITHOUT a live hub renders as a
 *    non-navigating "Enabled" status tile; modules the tenant lacks render a
 *    locked (non-linking) fallback.
 *
 * Count fns are injected (prop, default = the real INT-API-CORE wrappers) so the
 * data seam is testable per §15 without reaching for the network. All four count
 * wrappers are RLS-scoped to current_org().
 */

/** Count-of-pending-intake derived from the real `listIntake` wrapper: the
 *  requests still awaiting staff action ('new'/'contacted'). */
export async function countPendingIntake(): Promise<number> {
  const rows = await listIntake();
  return rows.filter((r) => r.status === 'new' || r.status === 'contacted').length;
}

export interface KpiSpec {
  key: string;
  label: string;
  /** Target screen. OMITTED while the screen has not shipped — the tile then
   *  renders non-navigating (dead links are forbidden). */
  to?: string;
  load: () => Promise<number>;
}

export interface OpsDashboardProps {
  /** Injected count fns (default = real INT-API-CORE wrappers). */
  counts?: {
    openEngagements: () => Promise<number>;
    pendingIntake: () => Promise<number>;
    draftDocuments: () => Promise<number>;
    openBillableLines: () => Promise<number>;
  };
  /** Injected module-hub route map (default = MODULE_HUB_ROUTES). */
  hubRoutes?: Record<string, string>;
}

const DEFAULT_COUNTS = {
  openEngagements: countEngagements,
  pendingIntake: countPendingIntake,
  draftDocuments: countOpenDocuments,
  openBillableLines: countOpenBillableLines,
};

/**
 * Wave-7 re-link seam: moduleKey → the module's hub route, listing ONLY routes
 * that are actually registered in App.tsx. A module tile navigates only when
 * its hub route appears here; an enabled module without an entry renders as a
 * non-navigating "Enabled" status tile (dead links are forbidden). When a hub
 * page ships, add its route to App.tsx AND one entry here, e.g.
 *   'mod.brokerage': '/app/ops/brokerage',
 */
export const MODULE_HUB_ROUTES: Record<string, string> = {};

/** The module launcher catalog: key + label. Every tile is entitlement-gated;
 *  navigation comes solely from MODULE_HUB_ROUTES. */
const MODULE_TILES: { moduleKey: string; label: string }[] = [
  { moduleKey: 'mod.brokerage', label: 'Brokerage' },
  { moduleKey: 'mod.lessons', label: 'Lessons' },
  { moduleKey: 'mod.boarding', label: 'Boarding' },
  { moduleKey: 'mod.barnops', label: 'Barn Ops' },
  { moduleKey: 'mod.horserecords', label: 'Records' },
  { moduleKey: 'mod.employees', label: 'Employees' },
];

/** A single KPI tile: a <Link> to its screen (when one exists) showing the
 *  resolved count, or an inline error (not a blank tile) when the count fn
 *  rejects. Specs without a live screen render the same tile without a link. */
function KpiTile({ spec }: { spec: KpiSpec }) {
  const { data, error, isPending, run } = useAsync(spec.load);

  useEffect(() => {
    // Fire on mount; swallow the re-thrown rejection here — the error branch is
    // already captured on `error` and rendered below (never a blank tile).
    run().catch(() => {});
  }, [run]);

  const body = (
    <>
      <span className="text-sm text-green-800/70">{spec.label}</span>
      {error ? (
        <span data-testid={`kpi-${spec.key}-error`} role="alert" className="mt-2 text-sm text-red-700">
          Couldn&rsquo;t load
        </span>
      ) : (
        <span data-testid={`kpi-${spec.key}-value`} className="mt-2 font-serif text-3xl text-green-900">
          {isPending || data === null ? '—' : data}
        </span>
      )}
    </>
  );

  if (!spec.to) {
    return (
      <div
        data-testid={`kpi-${spec.key}`}
        className="flex flex-col rounded border border-green-800/15 bg-white px-5 py-4"
      >
        {body}
      </div>
    );
  }

  return (
    <Link
      to={spec.to}
      data-testid={`kpi-${spec.key}`}
      className="flex flex-col rounded border border-green-800/15 bg-white px-5 py-4 hover:border-green-800/40 transition-colors"
    >
      {body}
    </Link>
  );
}

export default function OpsDashboard({
  counts = DEFAULT_COUNTS,
  hubRoutes = MODULE_HUB_ROUTES,
}: OpsDashboardProps) {
  const modules = useModules();

  const kpis: KpiSpec[] = [
    { key: 'engagements', label: 'Open engagements', to: '/app/ops/engagements', load: counts.openEngagements },
    // No intake-review screen exists yet — no `to` until that route ships.
    { key: 'intake', label: 'Intake to review', load: counts.pendingIntake },
    { key: 'documents', label: 'Documents awaiting signature', to: '/app/ops/documents', load: counts.draftDocuments },
    // Open charges surface (and settle) on the transactions reconcile screen.
    { key: 'billing', label: 'Open charges', to: '/app/ops/transactions', load: counts.openBillableLines },
  ];

  return (
    <div className="space-y-8">
      <Helmet>
        <title>Operations</title>
      </Helmet>

      <header>
        <h1 className="font-serif text-2xl text-green-900">Operations</h1>
        <p className="mt-1 text-sm text-green-800/70">Your tenant at a glance.</p>
      </header>

      <section aria-label="Key metrics">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((spec) => (
            <KpiTile key={spec.key} spec={spec} />
          ))}
        </div>
      </section>

      <section aria-label="Modules">
        <h2 className="font-serif text-lg text-green-900">Modules</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_TILES.map((tile) => {
            const hubRoute = hubRoutes[tile.moduleKey];
            return (
              <ModuleGate
                key={tile.moduleKey}
                moduleKey={tile.moduleKey}
                modules={modules}
                fallback={
                  <div
                    data-testid={`module-${tile.moduleKey}-locked`}
                    role="note"
                    className="flex items-center justify-between rounded border border-green-800/10 bg-green-800/5 px-5 py-4 text-green-800/50"
                  >
                    <span className="font-serif">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide">Locked</span>
                  </div>
                }
              >
                {hubRoute ? (
                  <Link
                    to={hubRoute}
                    data-testid={`module-${tile.moduleKey}-tile`}
                    className="flex items-center justify-between rounded border border-green-800/15 bg-white px-5 py-4 hover:border-green-800/40 transition-colors"
                  >
                    <span className="font-serif text-green-900">{tile.label}</span>
                    <span aria-hidden className="text-green-800/40">&rarr;</span>
                  </Link>
                ) : (
                  /* Enabled module, hub not shipped: status tile, never a dead link. */
                  <div
                    data-testid={`module-${tile.moduleKey}-enabled`}
                    role="note"
                    className="flex items-center justify-between rounded border border-green-800/15 bg-white px-5 py-4"
                  >
                    <span className="font-serif text-green-900">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide text-green-800/50">
                      Enabled
                    </span>
                  </div>
                )}
              </ModuleGate>
            );
          })}
        </div>
      </section>
    </div>
  );
}
