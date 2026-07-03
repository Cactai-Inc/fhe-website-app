// @vitest-environment jsdom
/**
 * Public booking-request page (Checkout) — UI wiring for the funnel rework.
 *
 * Renders the REAL Checkout with cart/auth/api mocked and proves:
 *  - the page reads as a booking request ("Submit a Booking Request" + schedule
 *    subtitle) and the chatty inquiry copy is gone,
 *  - the week picker starts at the CURRENT week (Sunday start), pages forward
 *    only (‹ disabled on page 0), and selections persist across paging,
 *  - "I'm open to any day of the week" disables the specific-day checkboxes,
 *  - submit sends the structured availability (proposed_times JSON + readable
 *    notes block, riding experience included) through submitRequest, and prices
 *    render "/ lesson" for riding lessons.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, within, userEvent, waitFor } from '../test/render';
import { weekOptions } from '../lib/availability';
import type { CartItem } from '../lib/cart';

const LESSON_ITEM: CartItem = {
  serviceId: 'riding-lesson',
  serviceName: 'Riding Lessons',
  tierId: 'single',
  tierLabel: 'Single Lesson',
  price: 150,
  unit: 'lesson',
};

const cartFns = vi.hoisted(() => ({
  removeItem: vi.fn(),
  clearCart: vi.fn(),
  toSelectedServices: vi.fn(() => []),
}));

vi.mock('../contexts/CartContext', () => ({
  useCart: () => ({
    state: { items: [LESSON_ITEM], funnel: 'rider', qualifierAnswers: {} },
    subtotal: 150,
    inquirySummary: [
      { unit: 'lesson', label: 'Per lesson', items: [LESSON_ITEM], total: 150, isEstimate: false },
    ],
    ...cartFns,
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('../lib/api', () => ({
  submitRequest: vi.fn(),
  createDraftOrder: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  submitBooking: vi.fn(),
}));

import { submitRequest } from '../lib/api';
import { submitBooking } from '../lib/supabase';
import Checkout from './Checkout';

// Expected weeks, computed with the same (separately unit-tested) helpers the
// page uses — the assertions stay valid on any real "today".
const PAGE0 = weekOptions(new Date(), 0, 4);
const PAGE1 = weekOptions(new Date(), 1, 4);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(submitRequest).mockResolvedValue({ requestId: 'req-1' });
  vi.mocked(submitBooking).mockResolvedValue({ id: 'bk-1' });
});

describe('Checkout (booking request)', () => {
  it('reads as a booking request and drops the inquiry copy', () => {
    renderWithRouter(<Checkout />);
    expect(screen.getByRole('heading', { name: /submit a booking request/i })).toBeInTheDocument();
    expect(
      screen.getByText(/send us this form and we will contact you to schedule your request\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your request/i })).toBeInTheDocument();
    // Deleted blocks stay deleted.
    expect(screen.queryByText(/this is just hello, not a booking/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pricing is shown for orientation only/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/when are you usually free/i)).not.toBeInTheDocument();
    // Riding lessons price per lesson, never per session.
    expect(screen.getByText('$150 / lesson')).toBeInTheDocument();
  });

  it('week list starts at the current Sunday-start week and cannot page backwards past it', async () => {
    renderWithRouter(<Checkout />);
    for (const week of PAGE0) {
      expect(screen.getByRole('checkbox', { name: week.label })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: /earlier weeks/i })).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /later weeks/i }));
    expect(screen.getByRole('checkbox', { name: PAGE1[0].label })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: PAGE0[0].label })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /earlier weeks/i })).toBeEnabled();
  });

  it('week selections persist across paging', async () => {
    renderWithRouter(<Checkout />);
    await userEvent.click(screen.getByRole('checkbox', { name: PAGE0[1].label }));
    await userEvent.click(screen.getByRole('button', { name: /later weeks/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: PAGE1[0].label }));
    await userEvent.click(screen.getByRole('button', { name: /earlier weeks/i }));
    expect(screen.getByRole('checkbox', { name: PAGE0[1].label })).toBeChecked();
    expect(screen.getByText(/2 weeks selected/i)).toBeInTheDocument();
  });

  it('"open to any day" disables the specific-day checkboxes (and re-enables on untoggle)', async () => {
    renderWithRouter(<Checkout />);
    const anyDay = screen.getByRole('checkbox', { name: /open to any day of the week/i });
    const monday = screen.getByRole('checkbox', { name: 'Monday' });
    expect(monday).toBeEnabled();

    await userEvent.click(anyDay);
    for (const day of ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']) {
      expect(screen.getByRole('checkbox', { name: day })).toBeDisabled();
    }

    await userEvent.click(anyDay);
    expect(screen.getByRole('checkbox', { name: 'Monday' })).toBeEnabled();
  });

  it('submits the structured availability with the request', async () => {
    renderWithRouter(<Checkout />);
    await userEvent.type(screen.getByLabelText(/first name/i), 'Rae');
    await userEvent.type(screen.getByLabelText(/email address/i), 'rae@rider.test');
    await userEvent.type(screen.getByLabelText(/phone number/i), '858-555-0000');

    await userEvent.click(screen.getByRole('radio', { name: '1–2' }));
    const weekdays = screen.getByRole('group', { name: 'Weekdays' });
    await userEvent.click(within(weekdays).getByRole('checkbox', { name: 'AM' }));
    await userEvent.click(screen.getByRole('checkbox', { name: PAGE0[0].label }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Monday' }));

    await userEvent.click(screen.getByRole('button', { name: /submit booking request/i }));

    await waitFor(() => expect(submitRequest).toHaveBeenCalledTimes(1));
    const [request, selections] = vi.mocked(submitRequest).mock.calls[0];
    expect(request.contact_name).toBe('Rae');
    expect(request.contact_email).toBe('rae@rider.test');
    // Structured JSON for the proposed_times jsonb column.
    expect(request.proposed_times).toEqual([
      {
        date: PAGE0[0].startISO,
        end: PAGE0[0].endISO,
        label: PAGE0[0].label,
        time: 'Weekdays AM',
        days: 'Mon',
      },
    ]);
    // Human-readable twin in the notes.
    expect(request.notes).toContain('— Availability & experience —');
    expect(request.notes).toContain('Riding experience: 1–2 years');
    expect(request.notes).toContain('Preferred times: Weekdays AM');
    expect(request.notes).toContain('Days: Mon');
    expect(request.notes).toContain(`Weeks: ${PAGE0[0].label}`);
    expect(selections).toEqual([
      { offering_slug: 'riding-lesson', label: 'Riding Lessons — Single Lesson' },
    ]);

    // Legacy bookings row keeps the availability + experience too.
    await waitFor(() => expect(submitBooking).toHaveBeenCalledTimes(1));
    const legacy = vi.mocked(submitBooking).mock.calls[0][0];
    expect(legacy.preferred_times).toContain('Riding experience: 1–2 years');
    expect(legacy.qualifier_answers).toMatchObject({ riding_experience_years: '1-2' });

    await waitFor(() => expect(cartFns.clearCart).toHaveBeenCalled());
  });
});
