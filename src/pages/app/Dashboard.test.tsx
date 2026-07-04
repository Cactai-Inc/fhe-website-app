// @vitest-environment jsdom
/**
 * Dashboard state machine (BOOKING_FLOWS_PLAN §6) — renders the REAL Dashboard
 * with the api layer mocked and proves:
 *  - docs all EXECUTED + paid → the "what to expect at your first visit" card,
 *  - dismiss hides it and persists (localStorage) across re-renders,
 *  - the card does NOT show while onboarding is still needed (the finish-setup
 *    nudge shows instead) or while the purchase is unpaid,
 *  - community rail card is soft-hidden from non-admin members (progressive
 *    disclosure) and stays for admins.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, within } from '../../test/render';
import type { OnboardingState } from '../../lib/api';

const auth = vi.hoisted(() => ({
  value: {
    profile: { display_name: 'Madeline', first_name: 'Madeline' },
    isAdmin: false,
  },
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth.value }));

vi.mock('../../lib/community', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/community')>();
  return {
    ...real,
    fetchAnnouncements: vi.fn().mockResolvedValue([]),
    fetchEvents: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../../lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/api')>();
  return { ...real, myOnboardingState: vi.fn() };
});

import { myOnboardingState } from '../../lib/api';
import Dashboard from './Dashboard';

const EXECUTED_DOCS = [
  { document_id: 'd-1', template_key: 'COMPANY_POLICIES', title: 'Company Policies', status: 'EXECUTED' },
  { document_id: 'd-2', template_key: 'FACILITY_RULES', title: 'Facility Rules', status: 'EXECUTED' },
];

function state(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    needed: false,
    profile_complete: true,
    documents: EXECUTED_DOCS,
    purchase: {
      tier_label: '4-Lesson Punch Card', amount: 500, lessons_included: 4,
      cadence: null, paid: true, payment_method: 'Zelle',
    },
    minor: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  // keep the once-per-session onboarding redirect out of these renders
  window.sessionStorage.setItem('fhe-onboarding-redirected', '1');
  vi.mocked(myOnboardingState).mockResolvedValue(state());
});

describe('Dashboard — the all-set first-visit card', () => {
  it('shows once every doc is EXECUTED and the purchase is paid', async () => {
    renderWithRouter(<Dashboard />);
    const card = await screen.findByTestId('first-visit-card');
    expect(card).toHaveTextContent(/what to expect at your first visit/i);
    expect(card).toHaveTextContent(/15 minutes early/);
    expect(card).toHaveTextContent(/long pants and closed-toe boots with a heel/i);
    expect(card).toHaveTextContent(/ASTM\/SEI-certified riding helmet/);
    // the finish-setup nudge is NOT also showing
    expect(screen.queryByTestId('onboarding-nudge')).not.toBeInTheDocument();
  });

  it('dismiss hides the card and persists across re-renders (localStorage)', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithRouter(<Dashboard />);
    await screen.findByTestId('first-visit-card');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('first-visit-card')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('fhe-first-visit-card-dismissed')).toBe('1');

    unmount();
    renderWithRouter(<Dashboard />);
    await screen.findByTestId('plan-card'); // page settled
    expect(screen.queryByTestId('first-visit-card')).not.toBeInTheDocument();
  });

  it('does not show while onboarding is still needed — the finish-setup nudge shows instead', async () => {
    vi.mocked(myOnboardingState).mockResolvedValue(state({
      needed: true,
      documents: [{ ...EXECUTED_DOCS[0], status: 'DRAFT' }, EXECUTED_DOCS[1]],
    }));
    renderWithRouter(<Dashboard />);
    expect(await screen.findByTestId('onboarding-nudge')).toBeInTheDocument();
    expect(screen.queryByTestId('first-visit-card')).not.toBeInTheDocument();
  });

  it('does not show while the purchase is unpaid', async () => {
    vi.mocked(myOnboardingState).mockResolvedValue(state({
      purchase: {
        tier_label: '4-Lesson Punch Card', amount: 500, lessons_included: 4,
        cadence: null, paid: false, payment_method: null,
      },
    }));
    renderWithRouter(<Dashboard />);
    await screen.findByTestId('plan-card');
    expect(screen.queryByTestId('first-visit-card')).not.toBeInTheDocument();
  });

  it('does not show for a member with no onboarding documents at all', async () => {
    vi.mocked(myOnboardingState).mockResolvedValue(state({ documents: [] }));
    renderWithRouter(<Dashboard />);
    await screen.findByTestId('plan-card');
    expect(screen.queryByTestId('first-visit-card')).not.toBeInTheDocument();
  });
});

describe('Dashboard — Flow D entry on the plan card', () => {
  it('offers "Book another lesson" → /app/book for lesson-pack plans', async () => {
    renderWithRouter(<Dashboard />);
    const card = await screen.findByTestId('plan-card');
    const link = within(card).getByTestId('book-more-link');
    expect(link).toHaveTextContent('Book another lesson');
    expect(link).toHaveAttribute('href', '/app/book');
    // the rest of the card is untouched
    expect(card).toHaveTextContent('4-Lesson Punch Card');
    expect(card).toHaveTextContent('PAID');
  });

  it('adapts the label to "Add to your plan" when the purchase has no lesson count', async () => {
    vi.mocked(myOnboardingState).mockResolvedValue(state({
      purchase: {
        tier_label: '2x / Week Monthly', amount: 875, lessons_included: null,
        cadence: '2 lessons/week', paid: true, payment_method: 'Zelle',
      },
    }));
    renderWithRouter(<Dashboard />);
    const card = await screen.findByTestId('plan-card');
    expect(within(card).getByTestId('book-more-link')).toHaveTextContent('Add to your plan');
  });
});

describe('Dashboard — community soft-hide (progressive disclosure)', () => {
  it('hides the chat/members rail card from non-admin members', async () => {
    renderWithRouter(<Dashboard />);
    await screen.findByTestId('plan-card');
    expect(screen.queryByRole('link', { name: /Open the chat board/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /See who's here/ })).not.toBeInTheDocument();
  });

  it('keeps the rail card for admins', async () => {
    auth.value = { ...auth.value, isAdmin: true };
    renderWithRouter(<Dashboard />);
    expect(await screen.findByRole('link', { name: /Open the chat board/ })).toBeInTheDocument();
    auth.value = { ...auth.value, isAdmin: false };
  });
});
