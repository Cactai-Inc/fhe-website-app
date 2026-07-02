// @vitest-environment jsdom
/**
 * CP-BROKERAGE UI-interaction test (StaffPage.test.tsx pattern).
 *
 * Renders the REAL MyBrokerage page with the REAL api-member fn mocked and proves:
 *  - module gate: with mod.brokerage OFF the page locks and NO data fn fires,
 *  - the open-count summary + engagement rows render from myBrokerageOverview,
 *  - the details link targets the MyEngagements area (/app/engagements),
 *  - the empty state offers the acquisition funnel,
 *  - a rejected load renders the inline error branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen } from '../../test/render';

vi.mock('../../lib/ops/useModules', () => ({ useModules: vi.fn() }));
vi.mock('../../lib/ops/api-member', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/ops/api-member')>();
  return { ...real, myBrokerageOverview: vi.fn() };
});

import { useModules } from '../../lib/ops/useModules';
import { myBrokerageOverview } from '../../lib/ops/api-member';
import MyBrokerage from './MyBrokerage';

const ENGAGEMENT = {
  id: 'eng-1',
  display_code: 'ENG-1042',
  service_type: 'HORSE_FINDER',
  status: 'ACTIVE',
  start_date: '2026-06-15',
  created_at: '2026-06-15T14:03:00.000Z',
  service: { display_name: 'Horse Finder', segment: 'support' },
  status_row: { display_name: 'Active', is_terminal: false },
};
const OVERVIEW = { engagements: [ENGAGEMENT], openCount: 1 };

function modulesOn(on: boolean) {
  vi.mocked(useModules).mockReturnValue({ 'mod.brokerage': on } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  modulesOn(true);
  vi.mocked(myBrokerageOverview).mockResolvedValue(OVERVIEW as never);
});

describe('MyBrokerage', () => {
  it('locks and fetches nothing with mod.brokerage off', () => {
    modulesOn(false);
    renderWithRouter(<MyBrokerage />);
    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(myBrokerageOverview).not.toHaveBeenCalled();
    expect(screen.queryByTestId('brokerage-summary')).not.toBeInTheDocument();
  });

  it('renders the summary and engagement rows from the real overview fn', async () => {
    renderWithRouter(<MyBrokerage />);
    expect(await screen.findByTestId('brokerage-summary')).toHaveTextContent('1');
    expect(screen.getByText('Horse Finder · ENG-1042')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(myBrokerageOverview).toHaveBeenCalledWith();
  });

  it('links through to the MyEngagements detail area', async () => {
    renderWithRouter(<MyBrokerage />);
    const link = await screen.findByRole('link', { name: /view engagement details/i });
    expect(link).toHaveAttribute('href', '/app/engagements');
  });

  it('the empty state offers the acquisition funnel', async () => {
    vi.mocked(myBrokerageOverview).mockResolvedValue({ engagements: [], openCount: 0 } as never);
    renderWithRouter(<MyBrokerage />);
    const link = await screen.findByRole('link', { name: /acquisition support/i });
    expect(link).toHaveAttribute('href', '/acquisition');
  });

  it('a rejected load renders the inline error branch', async () => {
    vi.mocked(myBrokerageOverview).mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<MyBrokerage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(screen.queryByTestId('brokerage-summary')).not.toBeInTheDocument();
  });
});
