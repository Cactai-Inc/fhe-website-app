import { useEffect, useState } from 'react';
import { DataTable, StatusBadge, ModuleGate, useAsync } from '../../../lib/ops';
import type { Column, ModuleMap } from '../../../lib/ops';
import { useModules } from '../../../lib/ops/useModules';
import { listEngagementStages, createEngagementStage } from '../../../lib/api';
import type { EngagementStageInput } from '../../../lib/api';
import type { EngagementStage } from '../../../lib/ops/types';
import { AddStageForm } from './AddStageForm';

/**
 * OPS-ENG-STAGES — Engagement stages panel (brokerage-gated).
 *
 * Embedded on the engagement detail. Staff sees the engagement's stages
 * (stage / direction / status / fee key) loaded from
 * `listEngagementStages(engagementId)` → `supabase.from('engagement_stages')`,
 * and can add a SEARCH / EVALUATION / TRANSACTION_REP stage (directional:
 * retained_by + deal_side, optional fee_value_key) via `createEngagementStage`
 * → `.from('engagement_stages').insert(...)`. Each stage is independent — no
 * required predecessor (§7.1).
 *
 * GATING: the whole panel is wrapped in `ModuleGate('mod.brokerage')` (Layer C,
 * §4.3). Off-module, the panel is locked and the add form is not rendered — the
 * server `_module_gate('mod.brokerage')` is the authoritative fence.
 *
 * On success the created row is appended to the table and shows a StatusBadge.
 * On rejection the error renders inline and nothing is added.
 */
export interface StagesPanelProps {
  engagementId: string;
  /** Fee config keys selectable on a stage. */
  feeValueKeys?: string[];
  /** Injected module map (defaults to `useModules()`); enables no-data tests. */
  modules?: ModuleMap;
}

const STAGE_COLUMNS: Column<EngagementStage>[] = [
  { key: 'stage', header: 'Stage', render: (r) => r.stage },
  {
    key: 'direction',
    header: 'Direction',
    render: (r) => (
      <span className="text-green-900">
        {r.retained_by ?? '—'} / {r.deal_side ?? '—'}
      </span>
    ),
  },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  {
    key: 'fee_value_key',
    header: 'Fee key',
    render: (r) => <span className="font-mono text-xs">{r.fee_value_key ?? '—'}</span>,
  },
];

export function StagesPanel({ engagementId, feeValueKeys = [], modules }: StagesPanelProps) {
  const defaultModules = useModules();
  const moduleMap = modules ?? defaultModules;

  const [stages, setStages] = useState<EngagementStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const add = useAsync<EngagementStage, [EngagementStageInput]>(createEngagementStage);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listEngagementStages(engagementId)
      .then((rows) => {
        if (!cancelled) setStages(rows);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engagementId]);

  const handleAdd = async (input: EngagementStageInput) => {
    try {
      const row = await add.run(input);
      setStages((prev) => [...prev, row]);
    } catch {
      // Surfaced via add.error below; nothing is added on failure.
    }
  };

  return (
    <ModuleGate moduleKey="mod.brokerage" modules={moduleMap}>
      <section aria-label="Engagement stages" className="flex flex-col gap-6">
        <div>
          <h3 className="font-serif text-lg text-green-900 mb-1">Stages</h3>
          {loadError ? (
            <p role="alert" className="form-error">
              Could not load stages: {loadError.message}
            </p>
          ) : (
            <DataTable
              columns={STAGE_COLUMNS}
              rows={stages}
              loading={loading}
              rowKey={(r) => r.id}
              emptyTitle="No stages yet"
              emptyMessage="Add a search, evaluation, or transaction-rep stage."
            />
          )}
        </div>

        <div>
          <h4 className="font-sans text-sm font-medium text-green-800 mb-2">Add stage</h4>
          <AddStageForm
            engagementId={engagementId}
            feeValueKeys={feeValueKeys}
            onSubmit={handleAdd}
            submitting={add.isPending}
            error={add.isError && add.error ? add.error.message : null}
          />
        </div>
      </section>
    </ModuleGate>
  );
}

export default StagesPanel;
