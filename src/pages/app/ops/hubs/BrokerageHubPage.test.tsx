// @vitest-environment jsdom
/**
 * OPS-HUB-BROKERAGE UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL BrokerageHubPage over mocked api wrappers + a mocked
 * useModules and proves the wiring:
 *  - brokerage ON → listEngagements() drives the KPI tiles; ONLY the open
 *    (non-terminal) engagements are staged via listEngagementStages(id) WITH
 *    EXACT id args (terminal ones are never fetched), and the LAST stage row
 *    (current stage) drives each bucket count.
 *  - the quick links render with the exact target hrefs.
 *  - a rejected listEngagements renders the error branch (no blank tiles).
 *  - brokerage OFF → ModuleGate lock, and NO data fetch fires.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, waitFor } from '../../../../test/render';
import type { Engagement, EngagementStage } from '../../../../lib/ops/types';

const listEngagements = vi.hoisted(() => vi.fn());
const listEngagementStages = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/api', () => ({ listEngagements, listEngagementStages }));
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { BrokerageHubPage } from './BrokerageHubPage';

function engagement(over: Partial<Engagement>): Engagement {
  return {
    id: 'e-1',
    display_code: 'ENG-0001',
    client_id: 'cl-1',
    assigned_staff_id: null,
    service_type: 'PURCHASE',
    status: 'ACTIVE',
    primary_horse_id: null,
    start_date: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function stage(over: Partial<EngagementStage>): EngagementStage {
  return {
    id: 's-1',
    engagement_id: 'e-1',
    stage: 'SEARCH',
    retained_by: null,
    deal_side: 'BUY',
    status: 'ACTIVE',
    fee_value_key: null,
    effective_from: '2026-01-01',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

const ALL_ON = { 'mod.brokerage': true };
const BROKERAGE_OFF = { 'mod.brokerage': false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OPS-HUB-BROKERAGE — BrokerageHubPage', () => {
  it('counts OPEN engagements by their CURRENT stage (exact per-id stage fetches; terminal skipped)', async () => {
    useModulesMock.mockReturnValue(ALL_ON);
    listEngagements.mockResolvedValue([
      engagement({ id: 'e-search', status: 'ACTIVE' }),
      engagement({ id: 'e-txn', status: 'CONTRACT_PENDING' }),
      engagement({ id: 'e-lead', status: 'LEAD' }),
      engagement({ id: 'e-done', status: 'COMPLETED' }), // terminal → excluded
    ]);
    listEngagementStages.mockImplementation(async (id: string) => {
      if (id === 'e-search') return [stage({ id: 's-1', engagement_id: id, stage: 'SEARCH' })];
      if (id === 'e-txn')
        // Two stage rows (effective_from ascending) → the LAST one is current.
        return [
          stage({ id: 's-2', engagement_id: id, stage: 'EVALUATION', effective_from: '2026-01-01' }),
          stage({ id: 's-3', engagement_id: id, stage: 'TRANSACTION_REP', effective_from: '2026-02-01' }),
        ];
      return []; // e-lead: no stage rows yet
    });

    renderWithRouter(<BrokerageHubPage />);

    await waitFor(() =>
      expect(screen.getByTestId('brokerage-kpi-open-value')).toHaveTextContent('3'),
    );
    expect(screen.getByTestId('brokerage-kpi-search-value')).toHaveTextContent('1');
    expect(screen.getByTestId('brokerage-kpi-evaluation-value')).toHaveTextContent('0');
    expect(screen.getByTestId('brokerage-kpi-transaction-value')).toHaveTextContent('1');
    expect(screen.getByTestId('brokerage-kpi-nostage-value')).toHaveTextContent('1');

    // Stage lookups fired ONLY for the open engagements, with exact ids.
    expect(listEngagements).toHaveBeenCalledTimes(1);
    expect(listEngagementStages).toHaveBeenCalledTimes(3);
    expect(listEngagementStages).toHaveBeenCalledWith('e-search');
    expect(listEngagementStages).toHaveBeenCalledWith('e-txn');
    expect(listEngagementStages).toHaveBeenCalledWith('e-lead');
    expect(listEngagementStages).not.toHaveBeenCalledWith('e-done');
  });

  it('renders the quick links with the exact target routes', async () => {
    useModulesMock.mockReturnValue(ALL_ON);
    listEngagements.mockResolvedValue([]);

    renderWithRouter(<BrokerageHubPage />);
    await waitFor(() =>
      expect(screen.getByTestId('brokerage-kpi-open-value')).toHaveTextContent('0'),
    );

    expect(screen.getByRole('link', { name: /Engagements/ })).toHaveAttribute(
      'href',
      '/app/ops/engagements',
    );
    expect(screen.getByRole('link', { name: /New engagement/ })).toHaveAttribute(
      'href',
      '/app/ops/engagements/new',
    );
    expect(screen.getByRole('link', { name: /Documents/ })).toHaveAttribute(
      'href',
      '/app/ops/documents',
    );
    expect(screen.getByRole('link', { name: /Transactions/ })).toHaveAttribute(
      'href',
      '/app/ops/transactions',
    );
  });

  it('renders the error branch when listEngagements rejects', async () => {
    useModulesMock.mockReturnValue(ALL_ON);
    listEngagements.mockRejectedValue(new Error('rls denied'));

    renderWithRouter(<BrokerageHubPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(screen.queryByTestId('brokerage-kpi-open')).not.toBeInTheDocument();
  });

  it('locks behind ModuleGate when mod.brokerage is off — and fetches NOTHING', async () => {
    useModulesMock.mockReturnValue(BROKERAGE_OFF);

    renderWithRouter(<BrokerageHubPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByTestId('brokerage-kpi-open')).not.toBeInTheDocument();
    expect(listEngagements).not.toHaveBeenCalled();
    expect(listEngagementStages).not.toHaveBeenCalled();
  });
});
