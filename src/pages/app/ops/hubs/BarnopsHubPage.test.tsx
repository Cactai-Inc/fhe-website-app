// @vitest-environment jsdom
/**
 * BARNOPS-HUB executable proof (§15 UI wiring).
 *
 * Renders the REAL BarnopsHubPage over a mocked api-barnops layer and proves:
 *   - live counts render from the three list fns (no fake numbers),
 *   - the three cards are REAL <Link>s with the correct hrefs (no dead tiles),
 *   - a count-fetch failure renders an inline error,
 *   - mod.barnops OFF → ModuleGate lock and NO data fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, waitFor } from '../../../../test/render';

const listResources = vi.hoisted(() => vi.fn());
const listConsumptionEvents = vi.hoisted(() => vi.fn());
const listCostAllocationRules = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-barnops', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/ops/api-barnops')>(
    '../../../../lib/ops/api-barnops',
  );
  return {
    ...actual,
    listResources,
    listConsumptionEvents,
    listCostAllocationRules,
  };
});
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import BarnopsHubPage from './BarnopsHubPage';

beforeEach(() => {
  vi.clearAllMocks();
  useModulesMock.mockReturnValue({ 'mod.barnops': true });
  listResources.mockResolvedValue([{ id: 'res-1' }, { id: 'res-2' }]);
  listConsumptionEvents.mockResolvedValue([{ id: 'ev-1' }, { id: 'ev-2' }, { id: 'ev-3' }]);
  listCostAllocationRules.mockResolvedValue([{ id: 'rule-1' }]);
});

describe('BarnopsHubPage', () => {
  it('renders live counts and real links to the three barnops screens', async () => {
    renderWithRouter(<BarnopsHubPage />);

    await waitFor(() =>
      expect(screen.getByTestId('hub-count-resources')).toHaveTextContent('2 resources'),
    );
    expect(listResources).toHaveBeenCalledWith();
    expect(listConsumptionEvents).toHaveBeenCalledWith();
    expect(listCostAllocationRules).toHaveBeenCalledWith();
    expect(screen.getByTestId('hub-count-events')).toHaveTextContent('3 recent events');
    expect(screen.getByTestId('hub-count-rules')).toHaveTextContent('1 rules');

    // Real navigation, not dead tiles.
    expect(screen.getByRole('link', { name: /Resources & lots/ })).toHaveAttribute(
      'href',
      '/app/ops/barnops/resources',
    );
    expect(screen.getByRole('link', { name: /Consumption log/ })).toHaveAttribute(
      'href',
      '/app/ops/barnops/consumption',
    );
    expect(screen.getByRole('link', { name: /Allocation & billing/ })).toHaveAttribute(
      'href',
      '/app/ops/barnops/allocation-rules',
    );
  });

  it('renders an inline error when a count fetch rejects (never a blank hub)', async () => {
    listConsumptionEvents.mockRejectedValue(new Error('rls denied'));

    renderWithRouter(<BarnopsHubPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    // The links still render — the hub degrades, it does not disappear.
    expect(screen.getByRole('link', { name: /Resources & lots/ })).toBeInTheDocument();
  });

  it('locks behind ModuleGate and fetches nothing when mod.barnops is off', () => {
    useModulesMock.mockReturnValue({ 'mod.barnops': false });
    renderWithRouter(<BarnopsHubPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(listResources).not.toHaveBeenCalled();
  });
});
