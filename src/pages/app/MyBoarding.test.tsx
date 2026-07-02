// @vitest-environment jsdom
/**
 * CP-BOARDING UI-interaction test (StaffPage.test.tsx pattern).
 *
 * Renders the REAL MyBoarding page with the REAL api-member fn mocked and proves:
 *  - module gate: with mod.boarding OFF the page locks and NO data fn fires,
 *  - the member's agreements render with horse name, rate and period charges,
 *  - the charges total renders,
 *  - a rejected load renders the inline error branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen } from '../../test/render';

vi.mock('../../lib/ops/useModules', () => ({ useModules: vi.fn() }));
vi.mock('../../lib/ops/api-member', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/ops/api-member')>();
  return { ...real, myBoardingOverview: vi.fn() };
});

import { useModules } from '../../lib/ops/useModules';
import { myBoardingOverview } from '../../lib/ops/api-member';
import MyBoarding from './MyBoarding';

const AGREEMENT = {
  id: 'ba-1',
  board_rate: 1200,
  board_type: 'FULL',
  start_date: '2026-01-01',
  end_date: null,
  status: 'ACTIVE',
  horse: { barn_name: 'Biscuit', registered_name: 'Heritage Biscuit' },
  charges: [
    { id: 'bc-1', period_start: '2026-06-01', period_end: '2026-07-01', amount: 1200 },
  ],
};
const OVERVIEW = { agreements: [AGREEMENT], chargesTotal: 1200 };

function modulesOn(on: boolean) {
  vi.mocked(useModules).mockReturnValue({ 'mod.boarding': on } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  modulesOn(true);
  vi.mocked(myBoardingOverview).mockResolvedValue(OVERVIEW as never);
});

describe('MyBoarding', () => {
  it('locks and fetches nothing with mod.boarding off', () => {
    modulesOn(false);
    renderWithRouter(<MyBoarding />);
    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(myBoardingOverview).not.toHaveBeenCalled();
    expect(screen.queryByText('Biscuit · FULL')).not.toBeInTheDocument();
  });

  it('renders the agreement with horse, rate and charges from the real overview fn', async () => {
    renderWithRouter(<MyBoarding />);
    expect(await screen.findByText('Biscuit · FULL')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    // board_rate + one charge + the total all format through Money.
    const money = screen.getAllByTestId('money').map((el) => el.textContent);
    expect(money.filter((t) => t === '$1,200.00').length).toBeGreaterThanOrEqual(3);
    expect(myBoardingOverview).toHaveBeenCalledWith();
  });

  it('renders the charges total block', async () => {
    renderWithRouter(<MyBoarding />);
    expect(await screen.findByTestId('boarding-total')).toHaveTextContent('$1,200.00');
  });

  it('a rejected load renders the inline error branch', async () => {
    vi.mocked(myBoardingOverview).mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<MyBoarding />);
    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(screen.queryByTestId('boarding-total')).not.toBeInTheDocument();
  });
});
