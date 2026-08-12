import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  countOpenDocuments,
  listIntake,
} from '../../../lib/api';
import { ModuleGate, useAsync } from '../../../lib/ops';
import { useModules } from '../../../lib/ops/useModules';
import { useAuth } from '../../../contexts/AuthContext';
import { MODULE_HUB_PAGE_KEY, pageByKey } from '../../../lib/pageRegistry';

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
 * TASK-PAGEVIS added the FOURTH condition, and the reason it is a separate
 * state rather than a variant of "Locked" is that the two mean opposite things:
 *
 *    Locked   you do not have this. The PLATFORM owner decides, under Feature
 *             flags. Nothing you can click changes it.
 *    Hidden   you have this and chose to put it away. YOU decided, under
 *             Settings -> Page visibility, and you can undo it there.
 *
 * A Hidden tile therefore stays a real <Link>: hiding removes the nav entry, not
 * the route, and this tile is the way back. Collapsing it into "Locked" would
 * tell the owner he had lost something he had merely tidied.
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
    pendingIntake: () => Promise<number>;
    draftDocuments: () => Promise<number>;
  };
  /** Injected module-hub route map (default = MODULE_HUB_ROUTES). */
  hubRoutes?: Record<string, string>;
}

const DEFAULT_COUNTS = {
  pendingIntake: countPendingIntake,
  draftDocuments: countOpenDocuments,
};

/**
 * Wave-7 re-link seam: moduleKey → the module's hub route, listing ONLY routes
 * that are actually registered in App.tsx. A module tile navigates only when
 * its hub route appears here; an enabled module without an entry renders as a
 * non-navigating "Enabled" status tile (dead links are forbidden). When a hub
 * page ships, add its route to App.tsx AND one entry here, e.g.
 *   'mod.brokerage': '/app/ops/brokerage',
 */
export const MODULE_HUB_ROUTES: Record<string, string> = Object.fromEntries(
  Object.entries(MODULE_HUB_PAGE_KEY)
    .map(([moduleKey, pageKey]) => [moduleKey, pageByKey(pageKey)?.path])
    .filter((pair): pair is [string, string] => typeof pair[1] === 'string'),
);
// mod.brokerage has no hub page, so the registry yields no entry for it and its
// tile renders as the non-navigating "Enabled" status tile (dead links are
// forbidden). That is the same behaviour as the hand-written map this replaced.

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
  const { isPageHidden } = useAuth();

  const kpis: KpiSpec[] = [
    { key: 'intake', label: 'Intake to review', to: '/app/ops/intake', load: counts.pendingIntake },
    { key: 'documents', label: 'Documents awaiting signature', to: '/app/ops/documents', load: counts.draftDocuments },
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
        <p className="mt-1 text-sm text-green-800/70">
          <span className="uppercase tracking-wide text-xs">Locked</span> means your plan does not
          include it. <span className="uppercase tracking-wide text-xs">Hidden</span> means you
          have it and put it away — it still opens, and you can bring its menu entry back under{' '}
          <Link to="/app/ops/admin/pages" className="underline">Settings &rarr; Page visibility</Link>.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_TILES.map((tile) => {
            const hubRoute = hubRoutes[tile.moduleKey];
            const hubPageKey = MODULE_HUB_PAGE_KEY[tile.moduleKey];
            const hidden = !!hubPageKey && isPageHidden(hubPageKey);
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
                {hubRoute && hidden ? (
                  /* Entitled, built, and put away by this tenant. Still a link —
                     the route resolves and this is the way back. */
                  <Link
                    to={hubRoute}
                    data-testid={`module-${tile.moduleKey}-hidden`}
                    className="flex items-center justify-between rounded border border-dashed border-green-800/25 bg-cream-100/60 px-5 py-4 hover:border-green-800/50 transition-colors"
                  >
                    <span className="font-serif text-green-800/70">{tile.label}</span>
                    <span className="text-xs uppercase tracking-wide text-green-800/50">
                      Hidden
                    </span>
                  </Link>
                ) : hubRoute ? (
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
