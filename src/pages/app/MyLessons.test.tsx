// @vitest-environment jsdom
/**
 * CP-LESSONS UI-interaction test (StaffPage.test.tsx pattern).
 *
 * Renders the REAL MyLessons page with the REAL api-member fn mocked and proves:
 *  - module gate: with mod.lessons OFF the page locks and NO data fn fires,
 *  - the balance, ledger and packages render from myLessonsOverview,
 *  - the purchase link targets the public /lessons funnel,
 *  - a rejected load renders the inline error branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen } from '../../test/render';

vi.mock('../../lib/ops/useModules', () => ({ useModules: vi.fn() }));
vi.mock('../../lib/ops/api-member', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/ops/api-member')>();
  return { ...real, myLessonsOverview: vi.fn() };
});

import { useModules } from '../../lib/ops/useModules';
import { myLessonsOverview } from '../../lib/ops/api-member';
import MyLessons from './MyLessons';

const OVERVIEW = {
  credits: [
    {
      id: 'lc-1',
      package_key: 'PKG_10',
      credits_total: 10,
      credits_remaining: 7,
      purchased_at: '2026-06-01T00:00:00.000Z',
    },
  ],
  packages: [{ id: 'lp-1', package_key: 'PKG_10', name: '10-Lesson Package', credits: 10 }],
  creditsRemaining: 7,
};

function modulesOn(on: boolean) {
  vi.mocked(useModules).mockReturnValue({ 'mod.lessons': on } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  modulesOn(true);
  vi.mocked(myLessonsOverview).mockResolvedValue(OVERVIEW as never);
});

describe('MyLessons', () => {
  it('locks and fetches nothing with mod.lessons off', () => {
    modulesOn(false);
    renderWithRouter(<MyLessons />);
    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(myLessonsOverview).not.toHaveBeenCalled();
    expect(screen.queryByTestId('credits-balance')).not.toBeInTheDocument();
  });

  it('renders the balance, ledger and packages from the real overview fn', async () => {
    renderWithRouter(<MyLessons />);
    expect(await screen.findByTestId('credits-balance')).toHaveTextContent('7');
    expect(screen.getByText('7 of 10 left')).toBeInTheDocument();
    expect(screen.getByText(/10-Lesson Package · 10 credits/)).toBeInTheDocument();
    expect(myLessonsOverview).toHaveBeenCalledWith();
  });

  it('links the purchase path to the public /lessons funnel', async () => {
    renderWithRouter(<MyLessons />);
    const link = await screen.findByRole('link', { name: /purchase a package/i });
    expect(link).toHaveAttribute('href', '/lessons');
  });

  it('a rejected load renders the inline error branch', async () => {
    vi.mocked(myLessonsOverview).mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<MyLessons />);
    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(screen.queryByTestId('credits-balance')).not.toBeInTheDocument();
  });
});
