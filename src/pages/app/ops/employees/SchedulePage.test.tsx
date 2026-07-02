// @vitest-environment jsdom
/**
 * OPS-EMP-SCHED UI-interaction test (Wiring & Verification Contract §15).
 *
 * Renders the REAL SchedulePage with the REAL api-employees fns mocked and proves:
 *  - module gate: with mod.employees OFF nothing fetches,
 *  - listShifts is queried with EXACTLY the shared weekRange() bounds for the
 *    current week (the page and test compute the same instants),
 *  - "Next week →" re-queries with the following week's bounds,
 *  - the create-shift flow calls createShift with the exact payload,
 *  - row click loads the shift's time entries via listTimeEntriesForShift.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';

vi.mock('../../../../lib/ops/useModules', () => ({ useModules: vi.fn() }));
vi.mock('../../../../lib/ops/api-employees', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../lib/ops/api-employees')>();
  return {
    ...real, // keep the REAL weekRange — the bounds contract under test
    listShifts: vi.fn(),
    createShift: vi.fn(),
    listStaffProfiles: vi.fn(),
    listTimeEntriesForShift: vi.fn(),
    createTimeEntry: vi.fn(),
  };
});

import { useModules } from '../../../../lib/ops/useModules';
import {
  weekRange, listShifts, createShift, listStaffProfiles, listTimeEntriesForShift,
} from '../../../../lib/ops/api-employees';
import { SchedulePage } from './SchedulePage';

const SHIFT = {
  id: 'sh-1', org_id: 'org-1', staff_profile_id: 'sp-1',
  starts_at: new Date().toISOString(), ends_at: null, role: 'Barn duty',
  created_at: '', updated_at: '',
  staff: { id: 'sp-1', title: 'Head Trainer', profile: { user_id: 'u-1', first_name: 'Camille', last_name: 'Fournier' } },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useModules).mockReturnValue({ 'mod.employees': true } as never);
  vi.mocked(listShifts).mockResolvedValue([SHIFT] as never);
  vi.mocked(listStaffProfiles).mockResolvedValue([
    { id: 'sp-1', org_id: 'org-1', profile_user_id: 'u-1', contact_id: null, title: 'Head Trainer',
      pay_type: null, active: true, created_at: '', updated_at: '',
      profile: { user_id: 'u-1', first_name: 'Camille', last_name: 'Fournier', email: 'c@fhe.test' }, contact: null },
  ] as never);
  vi.mocked(listTimeEntriesForShift).mockResolvedValue([] as never);
});

describe('SchedulePage', () => {
  it('locks and fetches nothing with mod.employees off', () => {
    vi.mocked(useModules).mockReturnValue({ 'mod.employees': false } as never);
    renderWithRouter(<SchedulePage />);
    expect(listShifts).not.toHaveBeenCalled();
  });

  it('queries the current Monday-anchored week via the shared weekRange()', async () => {
    renderWithRouter(<SchedulePage />);
    const expected = weekRange(new Date());
    await waitFor(() =>
      expect(listShifts).toHaveBeenCalledWith(expected.startISO, expected.endISO));
    expect(await screen.findByText('Camille Fournier')).toBeInTheDocument();
  });

  it('Next week re-queries with the following week bounds', async () => {
    renderWithRouter(<SchedulePage />);
    await screen.findByText('Camille Fournier');
    const next = weekRange(new Date(Date.now() + 7 * 86400000));
    await userEvent.click(screen.getByRole('button', { name: /next week/i }));
    await waitFor(() =>
      expect(listShifts).toHaveBeenCalledWith(next.startISO, next.endISO));
  });

  it('creates a shift with the exact payload', async () => {
    vi.mocked(createShift).mockResolvedValue(SHIFT as never);
    renderWithRouter(<SchedulePage />);
    await screen.findByText('Camille Fournier');

    await userEvent.click(screen.getByRole('button', { name: /new shift/i }));
    await userEvent.selectOptions(screen.getByLabelText(/staff member/i), 'sp-1');
    const starts = screen.getByLabelText(/starts/i);
    await userEvent.type(starts, '2026-07-06T08:00');
    await userEvent.type(screen.getByLabelText(/role/i), 'Lessons');
    await userEvent.click(screen.getByRole('button', { name: /create shift/i }));

    await waitFor(() => expect(createShift).toHaveBeenCalledWith({
      staff_profile_id: 'sp-1',
      starts_at: new Date('2026-07-06T08:00').toISOString(),
      ends_at: null,
      role: 'Lessons',
    }));
  });

  it('row click opens the time entries via the real list fn', async () => {
    renderWithRouter(<SchedulePage />);
    await userEvent.click(await screen.findByText('Camille Fournier'));
    await waitFor(() => expect(listTimeEntriesForShift).toHaveBeenCalledWith('sh-1'));
    expect(await screen.findByTestId('time-entries')).toHaveTextContent('No entries yet');
  });
});
