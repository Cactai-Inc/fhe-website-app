// @vitest-environment jsdom
/**
 * OPS-EMP-HUB UI-interaction test (Wiring & Verification Contract §15).
 *
 * Proves the Employees hub: module gate blocks render + fetch when
 * mod.employees is off; when on, the real getEmployeesKpis drives the three
 * KPI cards which deep-link to the staff and schedule pages; the error branch
 * renders inline on rejection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen } from '../../../../test/render';

vi.mock('../../../../lib/ops/useModules', () => ({ useModules: vi.fn() }));
vi.mock('../../../../lib/ops/api-employees', () => ({ getEmployeesKpis: vi.fn() }));

import { useModules } from '../../../../lib/ops/useModules';
import { getEmployeesKpis } from '../../../../lib/ops/api-employees';
import { EmployeesHubPage } from './EmployeesHubPage';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useModules).mockReturnValue({ 'mod.employees': true } as never);
  vi.mocked(getEmployeesKpis).mockResolvedValue({ activeStaff: 4, shiftsThisWeek: 11, openAssignments: 3 } as never);
});

describe('EmployeesHubPage', () => {
  it('locks and never fetches with mod.employees off', () => {
    vi.mocked(useModules).mockReturnValue({ 'mod.employees': false } as never);
    renderWithRouter(<EmployeesHubPage />);
    expect(getEmployeesKpis).not.toHaveBeenCalled();
  });

  it('renders the KPI cards with real values and deep links', async () => {
    renderWithRouter(<EmployeesHubPage />);
    expect(await screen.findByTestId('kpi-active-staff')).toHaveTextContent('4');
    expect(screen.getByTestId('kpi-shifts-week')).toHaveTextContent('11');
    expect(screen.getByTestId('kpi-open-assignments')).toHaveTextContent('3');
    expect(screen.getByTestId('kpi-active-staff')).toHaveAttribute('href', '/app/ops/employees/staff');
    expect(screen.getByTestId('kpi-shifts-week')).toHaveAttribute('href', '/app/ops/employees/schedule');
  });

  it('renders the error branch on a rejected load', async () => {
    vi.mocked(getEmployeesKpis).mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<EmployeesHubPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
  });
});
