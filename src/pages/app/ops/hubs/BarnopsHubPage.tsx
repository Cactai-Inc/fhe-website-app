import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { ModuleGate } from '../../../../lib/ops';
import { useModules } from '../../../../lib/ops/useModules';
import {
  listResources,
  listConsumptionEvents,
  listCostAllocationRules,
} from '../../../../lib/ops/api-barnops';

/**
 * BARNOPS-HUB — the mod.barnops module hub (Wave-7 launcher target).
 *
 * Gated by ModuleGate('mod.barnops'). Renders live counts (resources,
 * recent consumption events, allocation rules) and REAL <Link> cards into the
 * three barnops screens — no dead tiles. A count fetch failure renders an
 * inline error, never a blank hub.
 */

const CARDS = [
  {
    to: '/app/ops/barnops/resources',
    title: 'Resources & lots',
    description: 'Consumables catalog with stock levels computed from purchased lots.',
    countKey: 'resources' as const,
    countLabel: 'resources',
  },
  {
    to: '/app/ops/barnops/consumption',
    title: 'Consumption log',
    description: 'Append-only usage ledger — dumb, cheap facts priced later at resolution.',
    countKey: 'events' as const,
    countLabel: 'recent events',
  },
  {
    to: '/app/ops/barnops/allocation-rules',
    title: 'Allocation & billing',
    description: 'Cost attribution overrides + the deterministic billing resolver.',
    countKey: 'rules' as const,
    countLabel: 'rules',
  },
];

interface Counts {
  resources: number;
  events: number;
  rules: number;
}

export default function BarnopsHubPage() {
  const modules = useModules();
  const barnopsOn = modules['mod.barnops'] === true;

  const [counts, setCounts] = useState<Counts | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [resources, events, rules] = await Promise.all([
        listResources(),
        listConsumptionEvents(),
        listCostAllocationRules(),
      ]);
      setCounts({ resources: resources.length, events: events.length, rules: rules.length });
    } catch (err) {
      setLoadError(toErrorMessage(err, 'Could not load barn ops counts.'));
    }
  }, []);

  useEffect(() => {
    if (!barnopsOn) return;
    void load();
  }, [barnopsOn, load]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Helmet>
        <title>Barn Ops · Ops</title>
      </Helmet>

      <ModuleGate moduleKey="mod.barnops" modules={modules}>
        <div className="mb-6">
          <h1 className="font-serif text-2xl text-green-900">Barn Ops</h1>
          <p className="text-sm text-green-800/70">
            Inventory, consumption, and cost attribution for the barn.
          </p>
        </div>

        {loadError && (
          <p role="alert" className="form-error mb-4">
            {loadError}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {CARDS.map((card) => (
            <Link
              key={card.to}
              to={card.to}
              className="block rounded border border-green-800/15 bg-white px-5 py-4 hover:bg-green-800/5"
            >
              <span className="font-serif text-lg text-green-900">{card.title}</span>
              <p className="mt-1 text-sm text-green-800/70">{card.description}</p>
              <p className="mt-3 text-sm text-green-900" data-testid={`hub-count-${card.countKey}`}>
                {counts ? `${counts[card.countKey]} ${card.countLabel}` : '…'}
              </p>
            </Link>
          ))}
        </div>
      </ModuleGate>
    </div>
  );
}
