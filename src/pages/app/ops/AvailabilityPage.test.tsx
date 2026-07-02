// @vitest-environment jsdom
/**
 * OPS-AVAILABILITY UI-interaction test (Wiring & Verification Contract §15).
 *
 * Renders the REAL AvailabilityPage with the REAL api-slots fns mocked and proves:
 *  - listSlots is queried with EXACTLY the shared weekRange() bounds for the
 *    current week (the page and test compute the same instants),
 *  - "Next week →" re-queries with the following week's bounds,
 *  - the create-slot flow calls createSlot with the exact payload,
 *  - the REAL generateRecurringSlotRows expands a Tue+Thu 16–17h × 4-week range
 *    into the right row count/dates, and the modal passes createRecurringSlots
 *    the exact recurrence input,
 *  - deleting a booked slot surfaces the wrapper's clear error (toast),
 *  - Block/Reopen calls updateSlotStatus(id, 'blocked') on an open slot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';

vi.mock('../../../lib/ops/api-slots', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../lib/ops/api-slots')>();
  return {
    ...real, // keep the REAL generateRecurringSlotRows — the expansion contract under test
    listSlots: vi.fn(),
    createSlot: vi.fn(),
    createRecurringSlots: vi.fn(),
    updateSlotStatus: vi.fn(),
    deleteSlot: vi.fn(),
  };
});

import { weekRange } from '../../../lib/ops/api-employees';
import {
  listSlots, createSlot, createRecurringSlots, updateSlotStatus, deleteSlot,
  generateRecurringSlotRows,
} from '../../../lib/ops/api-slots';
import { AvailabilityPage } from './AvailabilityPage';

const OPEN_SLOT = {
  id: 'slot-1',
  start_at: new Date().toISOString(),
  end_at: new Date(Date.now() + 3600000).toISOString(),
  slot_type: 'lesson' as const,
  capacity: 1,
  location_mode: 'onsite' as const,
  status: 'open' as const,
  created_by: null,
  created_at: '',
  bookings: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listSlots).mockResolvedValue([OPEN_SLOT]);
});

describe('AvailabilityPage', () => {
  it('queries the current Monday-anchored week via the shared weekRange()', async () => {
    renderWithRouter(<AvailabilityPage />);
    const expected = weekRange(new Date());
    await waitFor(() =>
      expect(listSlots).toHaveBeenCalledWith(expected.startISO, expected.endISO));
    expect(await screen.findByText('lesson')).toBeInTheDocument();
  });

  it('Next week re-queries with the following week bounds', async () => {
    renderWithRouter(<AvailabilityPage />);
    await screen.findByText('lesson');
    const next = weekRange(new Date(Date.now() + 7 * 86400000));
    await userEvent.click(screen.getByRole('button', { name: /next week/i }));
    await waitFor(() =>
      expect(listSlots).toHaveBeenCalledWith(next.startISO, next.endISO));
  });

  it('creates a slot with the exact payload', async () => {
    vi.mocked(createSlot).mockResolvedValue(OPEN_SLOT);
    renderWithRouter(<AvailabilityPage />);
    await screen.findByText('lesson');

    await userEvent.click(screen.getByRole('button', { name: /new slot/i }));
    await userEvent.type(screen.getByLabelText(/starts/i), '2026-07-07T16:00');
    await userEvent.type(screen.getByLabelText(/ends/i), '2026-07-07T17:00');
    await userEvent.selectOptions(screen.getByLabelText(/^type/i), 'lesson');
    await userEvent.selectOptions(screen.getByLabelText(/location mode/i), 'mobile');
    await userEvent.click(screen.getByRole('button', { name: /create slot/i }));

    await waitFor(() => expect(createSlot).toHaveBeenCalledWith({
      start_at: new Date('2026-07-07T16:00').toISOString(),
      end_at: new Date('2026-07-07T17:00').toISOString(),
      slot_type: 'lesson',
      location_mode: 'mobile',
      capacity: 1,
    }));
  });

  it('REAL generateRecurringSlotRows expands Tue+Thu 16-17h over 4 weeks into 8 dated rows', () => {
    const rows = generateRecurringSlotRows({
      weekdays: [2, 4], // Tue + Thu
      startTime: '16:00',
      endTime: '17:00',
      fromDate: '2026-07-06', // Mon
      toDate: '2026-08-02',   // Sun, 4 full weeks
      slot_type: 'lesson',
      location_mode: 'onsite',
    });
    expect(rows).toHaveLength(8);
    expect(rows[0].start_at).toBe(new Date('2026-07-07T16:00').toISOString());
    expect(rows[0].end_at).toBe(new Date('2026-07-07T17:00').toISOString());
    expect(rows[1].start_at).toBe(new Date('2026-07-09T16:00').toISOString());
    expect(rows[7].start_at).toBe(new Date('2026-07-30T16:00').toISOString());
    expect(rows.every((r) => r.status === 'open' && r.slot_type === 'lesson' && r.capacity === 1)).toBe(true);
    // every generated row lands on a Tuesday or Thursday
    expect(rows.every((r) => [2, 4].includes(new Date(r.start_at).getDay()))).toBe(true);
  });

  it('recurring modal passes createRecurringSlots the exact recurrence input', async () => {
    vi.mocked(createRecurringSlots).mockResolvedValue([OPEN_SLOT, OPEN_SLOT]);
    renderWithRouter(<AvailabilityPage />);
    await screen.findByText('lesson');

    await userEvent.click(screen.getByRole('button', { name: /recurring slots/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tue' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Thu' }));
    await userEvent.type(screen.getByLabelText(/start time/i), '16:00');
    await userEvent.type(screen.getByLabelText(/end time/i), '17:00');
    await userEvent.type(screen.getByLabelText(/from date/i), '2026-07-06');
    await userEvent.type(screen.getByLabelText(/to date/i), '2026-08-02');
    await userEvent.click(screen.getByRole('button', { name: /create slots/i }));

    await waitFor(() => expect(createRecurringSlots).toHaveBeenCalledWith({
      weekdays: [2, 4],
      startTime: '16:00',
      endTime: '17:00',
      fromDate: '2026-07-06',
      toDate: '2026-08-02',
      slot_type: 'consultation',
      location_mode: 'onsite',
      capacity: 1,
    }));
    expect(await screen.findByText('2 slots created')).toBeInTheDocument();
  });

  it('surfaces the clear error when deleting a slot a booking references', async () => {
    vi.mocked(deleteSlot).mockRejectedValue(
      new Error('This slot is referenced by a booking and cannot be deleted. Block it instead.'));
    renderWithRouter(<AvailabilityPage />);
    await screen.findByText('lesson');

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(await screen.findByText(/referenced by a booking and cannot be deleted/i)).toBeInTheDocument();
    expect(deleteSlot).toHaveBeenCalledWith('slot-1');
  });

  it('Block/Reopen transitions an open slot via updateSlotStatus(id, blocked)', async () => {
    vi.mocked(updateSlotStatus).mockResolvedValue({ ...OPEN_SLOT, status: 'blocked' });
    renderWithRouter(<AvailabilityPage />);
    await screen.findByText('lesson');

    await userEvent.click(screen.getByRole('button', { name: /block\/reopen/i }));
    await waitFor(() => expect(updateSlotStatus).toHaveBeenCalledWith('slot-1', 'blocked'));
    expect(await screen.findByText('Slot blocked')).toBeInTheDocument();
  });

  it('refuses to Block/Reopen a booked slot without calling the API', async () => {
    vi.mocked(listSlots).mockResolvedValue([
      { ...OPEN_SLOT, status: 'booked', bookings: [{ id: 'b-1', order_id: 'ord-12345678', user_id: 'u-1', status: 'confirmed' }] },
    ]);
    renderWithRouter(<AvailabilityPage />);
    await screen.findByText('lesson');
    expect(screen.getByText(/Order ord-1234 \(confirmed\)/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /block\/reopen/i }));
    expect(await screen.findByText(/held or booked/i)).toBeInTheDocument();
    expect(updateSlotStatus).not.toHaveBeenCalled();
  });
});
