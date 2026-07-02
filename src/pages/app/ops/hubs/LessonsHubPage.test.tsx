// @vitest-environment jsdom
/**
 * OPS-LESSONS-HUB UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL LessonsHubPage over the mocked api-lessons layer + a mocked
 * useModules and proves the wiring:
 *   - lessonsSummary() drives the credits-outstanding KPI + the two counts,
 *     with deep links into the packages catalog and credits ledger,
 *   - a rejected summary load renders the error branch,
 *   - mod.lessons OFF → ModuleGate lock and NO fetch fires.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, within } from '../../../../test/render';

const lessonsSummary = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-lessons', () => ({ lessonsSummary }));
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { LessonsHubPage } from './LessonsHubPage';

function lessonsOn() {
  useModulesMock.mockReturnValue({ 'mod.lessons': true });
}
function lessonsOff() {
  useModulesMock.mockReturnValue({ 'mod.lessons': false });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OPS-LESSONS-HUB — LessonsHubPage', () => {
  it('renders the credits-outstanding KPI + counts from lessonsSummary() with deep links', async () => {
    lessonsOn();
    lessonsSummary.mockResolvedValue({
      activePackages: 3,
      creditsOutstanding: 42,
      clientsWithCredits: 5,
    });

    renderWithRouter(<LessonsHubPage />);

    const kpi = await screen.findByTestId('kpi-credits-outstanding');
    expect(kpi).toHaveTextContent('42');
    expect(within(kpi).getByRole('link', { name: 'Open credits ledger' })).toHaveAttribute(
      'href',
      '/app/ops/lessons/credits',
    );

    const pkgs = screen.getByTestId('kpi-active-packages');
    expect(pkgs).toHaveTextContent('3');
    expect(within(pkgs).getByRole('link', { name: 'Manage packages' })).toHaveAttribute(
      'href',
      '/app/ops/lessons/packages',
    );

    expect(screen.getByTestId('kpi-clients-with-credits')).toHaveTextContent('5');
    expect(lessonsSummary).toHaveBeenCalledTimes(1);
  });

  it('renders the error branch when lessonsSummary rejects', async () => {
    lessonsOn();
    lessonsSummary.mockRejectedValue(new Error('rls denied'));

    renderWithRouter(<LessonsHubPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(screen.queryByTestId('kpi-credits-outstanding')).toBeNull();
  });

  it('mod.lessons OFF → ModuleGate lock, no KPI, no fetch', async () => {
    lessonsOff();

    renderWithRouter(<LessonsHubPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-credits-outstanding')).toBeNull();
    expect(lessonsSummary).not.toHaveBeenCalled();
  });
});
