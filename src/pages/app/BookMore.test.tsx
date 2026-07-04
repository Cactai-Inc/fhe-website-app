// @vitest-environment jsdom
/**
 * BookMore — Flow D entry (BOOKING_FLOWS_PLAN §2 Flow D). Renders the REAL
 * page with auth/api mocked and proves:
 *  - the current plan renders and the tier select defaults to the member's
 *    current tier when it matches a live riding-lesson tier,
 *  - submit inserts the EXACT requests payload: contact fields from the
 *    profile, contact_method 'email' by default, the same structured
 *    proposed_times JSON Checkout writes, and the notes prefixed
 *    "RETURNING MEMBER — <tier label> requested",
 *  - success flips to the confirmation state with the /app link,
 *  - a member with NO purchase history still gets a working page (generic
 *    copy, no plan card, first tier preselected).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, within, userEvent, waitFor } from '../../test/render';
import { weekOptions } from '../../lib/availability';
import type { OnboardingState } from '../../lib/api';
import type { Offering } from '../../lib/types';

const auth = vi.hoisted(() => ({
  value: {
    profile: {
      first_name: 'Madeline',
      last_name: 'Rider',
      display_name: 'Madeline',
      email: 'madeline@rider.test',
      phone: '858-555-1234',
    },
    user: { email: 'madeline@rider.test' },
  },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth.value }));

vi.mock('../../lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...real,
    myOnboardingState: vi.fn(),
    fetchOfferings: vi.fn(),
    submitRequest: vi.fn(),
  };
});

import { myOnboardingState, fetchOfferings, submitRequest } from '../../lib/api';
import BookMore from './BookMore';

const LESSON_OFFERING: Offering = {
  id: 'off-1',
  segment: 'rider',
  name: 'Riding Lessons',
  tagline: null,
  description: null,
  slug: 'riding-lesson',
  active: true,
  sort_order: 1,
  tiers: [
    {
      id: 't-1', offering_id: 'off-1', label: 'Single Lesson', description: null,
      price_amount: 125, price_unit: 'session', price_min: null, note: null,
      is_popular: false, sort_order: 1,
    },
    {
      id: 't-2', offering_id: 'off-1', label: '5-Lesson Pack', description: null,
      price_amount: 575, price_unit: 'flat', price_min: null, note: null,
      is_popular: true, sort_order: 2,
    },
    {
      id: 't-3', offering_id: 'off-1', label: '10-Lesson Pack', description: null,
      price_amount: 1100, price_unit: 'flat', price_min: null, note: null,
      is_popular: false, sort_order: 3,
    },
  ],
};

function state(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    needed: false,
    profile_complete: true,
    documents: [],
    purchase: {
      tier_label: '5-Lesson Pack', amount: 575, lessons_included: 5,
      cadence: null, paid: true, payment_method: 'Zelle',
    },
    minor: null,
    ...overrides,
  };
}

// Expected weeks, computed with the same (separately unit-tested) helpers the
// picker uses — the assertions stay valid on any real "today".
const PAGE0 = weekOptions(new Date(), 0, 4);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(myOnboardingState).mockResolvedValue(state());
  vi.mocked(fetchOfferings).mockResolvedValue([LESSON_OFFERING]);
  vi.mocked(submitRequest).mockResolvedValue({ requestId: 'req-1' });
});

describe('BookMore (Flow D)', () => {
  it('renders the current plan and defaults the tier select to it', async () => {
    renderWithRouter(<BookMore />);
    expect(screen.getByRole('heading', { name: /book more time in the saddle/i })).toBeInTheDocument();

    const plan = await screen.findByTestId('current-plan-card');
    expect(plan).toHaveTextContent('5-Lesson Pack');
    expect(plan).toHaveTextContent('5 lessons');
    expect(plan).toHaveTextContent('PAID');

    // Their current tier is preselected — near-zero friction.
    await waitFor(() =>
      expect(screen.getByLabelText(/what would you like to book/i)).toHaveDisplayValue('5-Lesson Pack'),
    );
    // The shared availability picker is present (weeks / days / AM-PM).
    expect(screen.getByRole('checkbox', { name: PAGE0[0].label })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /open to any day of the week/i })).toBeInTheDocument();
  });

  it('submits the exact requests payload and shows the confirmation state', async () => {
    renderWithRouter(<BookMore />);
    await screen.findByTestId('current-plan-card');
    await waitFor(() =>
      expect(screen.getByLabelText(/what would you like to book/i)).toHaveDisplayValue('5-Lesson Pack'),
    );

    const weekdays = screen.getByRole('group', { name: 'Weekdays' });
    await userEvent.click(within(weekdays).getByRole('checkbox', { name: 'AM' }));
    await userEvent.click(screen.getByRole('checkbox', { name: PAGE0[0].label }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Monday' }));
    await userEvent.type(
      screen.getByLabelText(/anything you would like us to know/i),
      'Saturdays after 10 also work',
    );

    await userEvent.click(screen.getByRole('button', { name: /send booking request/i }));

    await waitFor(() => expect(submitRequest).toHaveBeenCalledTimes(1));
    const [request, selections] = vi.mocked(submitRequest).mock.calls[0];
    expect(request).toEqual({
      contact_name: 'Madeline Rider',
      contact_email: 'madeline@rider.test',
      contact_phone: '858-555-1234',
      contact_method: 'email',
      // The same structured JSON Checkout writes to the proposed_times jsonb.
      proposed_times: [
        {
          date: PAGE0[0].startISO,
          end: PAGE0[0].endISO,
          label: PAGE0[0].label,
          time: 'Weekdays AM',
          days: 'Mon',
        },
      ],
      notes: 'RETURNING MEMBER — 5-Lesson Pack requested\nSaturdays after 10 also work',
    });
    expect(selections).toEqual([
      {
        offering_id: 'off-1',
        offering_slug: 'riding-lesson',
        tier_id: 't-2',
        label: 'Riding Lessons — 5-Lesson Pack',
      },
    ]);

    // Confirmation state — request sent, link back to the dashboard.
    const confirmation = await screen.findByTestId('book-more-confirmation');
    expect(confirmation).toHaveTextContent(/request sent — we.ll confirm your times shortly/i);
    expect(within(confirmation).getByRole('link', { name: /back to your dashboard/i }))
      .toHaveAttribute('href', '/app');
  });

  it('a different tier drives the note prefix; an empty note leaves no dangling newline', async () => {
    renderWithRouter(<BookMore />);
    await screen.findByTestId('current-plan-card');
    const select = screen.getByLabelText(/what would you like to book/i);
    await waitFor(() => expect(select).toHaveDisplayValue('5-Lesson Pack'));

    await userEvent.selectOptions(select, 'Single Lesson');
    await userEvent.click(screen.getByRole('button', { name: /send booking request/i }));

    await waitFor(() => expect(submitRequest).toHaveBeenCalledTimes(1));
    const [request, selections] = vi.mocked(submitRequest).mock.calls[0];
    expect(request.notes).toBe('RETURNING MEMBER — Single Lesson requested');
    expect(request.proposed_times).toEqual([]); // nothing picked — staff will ask
    expect(selections).toEqual([
      {
        offering_id: 'off-1',
        offering_slug: 'riding-lesson',
        tier_id: 't-1',
        label: 'Riding Lessons — Single Lesson',
      },
    ]);
  });

  it('still works for a member with no purchase history (generic copy, no plan card)', async () => {
    vi.mocked(myOnboardingState).mockResolvedValue(state({ purchase: null }));
    renderWithRouter(<BookMore />);

    const select = screen.getByLabelText(/what would you like to book/i);
    // First live tier preselected; no plan card anywhere.
    await waitFor(() => expect(select).toHaveDisplayValue('Single Lesson'));
    expect(screen.queryByTestId('current-plan-card')).not.toBeInTheDocument();
    expect(screen.getByText(/pick a lesson option and when works/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /send booking request/i }));
    await waitFor(() => expect(submitRequest).toHaveBeenCalledTimes(1));
    const [request] = vi.mocked(submitRequest).mock.calls[0];
    expect(request.notes).toBe('RETURNING MEMBER — Single Lesson requested');
    expect(await screen.findByTestId('book-more-confirmation')).toBeInTheDocument();
  });
});
