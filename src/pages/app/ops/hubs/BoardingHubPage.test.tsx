// @vitest-environment jsdom
/**
 * OPS-BOARD-HUB UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL BoardingHubPage over a mocked getBoardingKpis + a mocked
 * useModules and proves the wiring:
 *   - getBoardingKpis() drives the three KPI tiles (occupancy X/Y + %, active
 *     agreements, open charges count + Money total),
 *   - the section cards link to the module's three working surfaces,
 *   - a rejected KPI fetch renders the error branch,
 *   - mod.boarding OFF → ModuleGate lock and getBoardingKpis is NOT called.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen } from '../../../../test/render';

const getBoardingKpis = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-boarding', () => ({ getBoardingKpis }));
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { BoardingHubPage } from './BoardingHubPage';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OPS-BOARD-HUB — BoardingHubPage', () => {
  it('renders occupancy / agreements / open-charge KPIs from getBoardingKpis()', async () => {
    useModulesMock.mockReturnValue({ 'mod.boarding': true });
    getBoardingKpis.mockResolvedValue({
      totalStalls: 12,
      occupiedStalls: 9,
      activeAgreements: 9,
      openChargeCount: 4,
      openChargeTotal: 3400,
    });

    renderWithRouter(<BoardingHubPage />);

    expect(await screen.findByTestId('kpi-occupancy')).toHaveTextContent('9 / 12');
    expect(screen.getByTestId('kpi-occupancy')).toHaveTextContent('(75%)');
    expect(screen.getByTestId('kpi-agreements')).toHaveTextContent('9');
    expect(screen.getByTestId('kpi-open-charges')).toHaveTextContent('4');
    expect(screen.getByTestId('kpi-open-charges')).toHaveTextContent('$3,400.00');
    expect(getBoardingKpis).toHaveBeenCalledTimes(1);
  });

  it('links into the three boarding surfaces', async () => {
    useModulesMock.mockReturnValue({ 'mod.boarding': true });
    getBoardingKpis.mockResolvedValue({
      totalStalls: 0,
      occupiedStalls: 0,
      activeAgreements: 0,
      openChargeCount: 0,
      openChargeTotal: 0,
    });

    renderWithRouter(<BoardingHubPage />);
    await screen.findByTestId('kpi-occupancy');

    expect(screen.getByRole('link', { name: /Facilities & stalls/ })).toHaveAttribute(
      'href',
      '/app/ops/boarding/facilities',
    );
    expect(screen.getByRole('link', { name: /Board agreements/ })).toHaveAttribute(
      'href',
      '/app/ops/boarding/agreements',
    );
    expect(screen.getByRole('link', { name: /Board charges/ })).toHaveAttribute(
      'href',
      '/app/ops/boarding/charges',
    );
  });

  it('renders the error branch when the KPI fetch rejects', async () => {
    useModulesMock.mockReturnValue({ 'mod.boarding': true });
    getBoardingKpis.mockRejectedValue(new Error('rls denied'));

    renderWithRouter(<BoardingHubPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(screen.queryByTestId('kpi-occupancy')).toBeNull();
  });

  it('mod.boarding OFF → ModuleGate lock, no KPI fetch', () => {
    useModulesMock.mockReturnValue({ 'mod.boarding': false });

    renderWithRouter(<BoardingHubPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-occupancy')).toBeNull();
    expect(getBoardingKpis).not.toHaveBeenCalled();
  });
});
