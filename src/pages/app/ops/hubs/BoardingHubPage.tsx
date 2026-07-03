import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { Link } from 'react-router-dom';
import { ModuleGate, Money } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import { useDocumentTitle } from '../../../../lib/hooks';
import { getBoardingKpis, type BoardingKpis } from '../../../../lib/ops/api-boarding';

/**
 * OPS-BOARD-HUB — Boarding module hub (module mod.boarding, gated by
 * ModuleGate; RLS `_module_gate` underneath).
 *
 * One glance at the boarding operation: stall occupancy (occupied / active
 * stalls from ACTIVE agreements), active agreement count, and the open board
 * charges awaiting settlement (count + total), all from getBoardingKpis().
 * Cards link into the module's three working surfaces (facilities, agreements,
 * charges). Loading and error branches render; when the module is off the
 * whole hub is the ModuleGate lock and NO data is fetched.
 */

const LINKS = [
  {
    to: '/app/ops/boarding/facilities',
    title: 'Facilities & stalls',
    description: 'Manage properties and the stalls within them.',
  },
  {
    to: '/app/ops/boarding/agreements',
    title: 'Board agreements',
    description: 'Per-horse contracts: boarder, stall, monthly rate, status.',
  },
  {
    to: '/app/ops/boarding/charges',
    title: 'Board charges',
    description: 'Generate period charges and follow them to settlement.',
  },
] as const;

export function BoardingHubPage() {
  useDocumentTitle('Boarding · Ops');
  const modules = useModules();
  const boardingOn = modules['mod.boarding'] === true;

  const [kpis, setKpis] = useState<BoardingKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!boardingOn) return;
    let active = true;
    setLoading(true);
    setError(null);
    getBoardingKpis()
      .then((k) => {
        if (active) setKpis(k);
      })
      .catch((err: unknown) => {
        if (active) setError(toErrorMessage(err, 'Could not load boarding KPIs.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [boardingOn]);

  const occupancyPct =
    kpis && kpis.totalStalls > 0
      ? Math.round((kpis.occupiedStalls / kpis.totalStalls) * 100)
      : null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <ModuleGate moduleKey="mod.boarding" modules={modules}>
        <header className="mb-6">
          <h1 className="font-serif text-2xl text-green-900">Boarding</h1>
          <p className="text-sm text-green-800/70">
            Facilities, stalls, agreements and board billing.
          </p>
        </header>

        {loading ? (
          <p className="text-sm text-green-800/70" data-testid="hub-loading">
            Loading…
          </p>
        ) : error ? (
          <p role="alert" className="form-error mb-4">
            {error}
          </p>
        ) : kpis ? (
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="border border-green-800/15 rounded p-4">
              <dt className="form-label mb-0">Stall occupancy</dt>
              <dd className="font-serif text-2xl text-green-900" data-testid="kpi-occupancy">
                {kpis.occupiedStalls} / {kpis.totalStalls}
                {occupancyPct !== null && (
                  <span className="ml-2 text-sm text-green-800/70">({occupancyPct}%)</span>
                )}
              </dd>
            </div>
            <div className="border border-green-800/15 rounded p-4">
              <dt className="form-label mb-0">Active agreements</dt>
              <dd className="font-serif text-2xl text-green-900" data-testid="kpi-agreements">
                {kpis.activeAgreements}
              </dd>
            </div>
            <div className="border border-green-800/15 rounded p-4">
              <dt className="form-label mb-0">Open board charges</dt>
              <dd className="font-serif text-2xl text-green-900" data-testid="kpi-open-charges">
                {kpis.openChargeCount}
                <span className="ml-2 text-sm text-green-800/70">
                  (<Money amount={kpis.openChargeTotal} />)
                </span>
              </dd>
            </div>
          </dl>
        ) : null}

        <nav aria-label="Boarding sections" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="block border border-green-800/15 rounded p-4 hover:bg-green-800/5"
            >
              <span className="font-serif text-lg text-green-900">{link.title}</span>
              <span className="mt-1 block text-sm text-green-800/70">{link.description}</span>
            </Link>
          ))}
        </nav>
      </ModuleGate>
    </div>
  );
}

export default BoardingHubPage;
