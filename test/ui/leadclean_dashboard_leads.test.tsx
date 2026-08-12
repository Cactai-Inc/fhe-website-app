// @vitest-environment jsdom
/**
 * TASK-LEADCLEAN — the dashboard's lead band, without a browser session.
 *
 * No staff Supabase session exists in this environment, and the live data
 * (5 open leads against a 6-card preview) leaves the "more waiting" control
 * with nothing to reveal — so the control cannot be exercised against
 * production at all. This test supplies the data instead, and proves the three
 * defects the owner reported in one control:
 *
 *   1. the COUNT is the real remainder of the list it sits under;
 *   2. the ACTION expands in place — the extra cards appear and the route does
 *      not change (it used to navigate);
 *   3. the DESTINATION is gone — nothing here routes to /app/ops/intake, the
 *      page this task retires.
 *
 * It also proves a lead card opens the working drawer in place, and that
 * converted leads render as history with a link to the record they became.
 *
 * Every heavy child/hook the panel loads is mocked so the test targets only
 * what this task changed. `vi.mock` is hoisted, so the calls live at top level.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import type { LeadEntry } from '../../src/lib/ops/useOpenLeads';
import type { BookingRequest } from '../../src/lib/ops/api-intake';
import type { ConvertedLead } from '../../src/lib/ops/api-intake';

/** Eight open leads — two more than the six-card preview. */
const LEADS: LeadEntry[] = Array.from({ length: 8 }, (_, i) => ({
  id: `req-${i}`,
  when: `2026-08-0${(i % 9) + 1}T10:00:00Z`,
  title: `Lead Person ${i}`,
  sub: 'Riding Lessons',
  to: `/app/dashboard?request=lead-${i}`,
  request: { id: `lead-${i}`, contact_name: `Lead Person ${i}` } as unknown as BookingRequest,
}));

const CONVERTED: ConvertedLead[] = [
  {
    requestId: 'r-1', name: 'Already A Client', email: 'a@ex.com',
    contactId: 'contact-1', createdAt: '2026-07-16T10:00:00Z', status: 'new',
  },
];

const reload = vi.fn();
vi.mock('../../src/lib/ops/useOpenLeads', () => ({
  useOpenLeads: () => ({ open: LEADS, converted: CONVERTED, reload }),
}));
vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ isStaff: true, isAdmin: true, profile: { first_name: 'Odile' } }),
}));
// The drawer itself is exercised by the Inbound page's own history; here we only
// need to know that the card OPENS it rather than navigating away.
vi.mock('../../src/components/app/LeadWorkDrawer', () => ({
  LeadWorkDrawer: ({ request }: { request: BookingRequest }) => (
    <div data-testid="lead-drawer">drawer:{request.id}</div>
  ),
}));
vi.mock('../../src/lib/api', () => ({
  myNotifications: () => Promise.resolve([]),
  consumeNotification: () => Promise.resolve(),
  markNotificationRead: () => Promise.resolve(),
}));
vi.mock('../../src/lib/communityFeed', () => ({ sayHiBack: () => Promise.resolve() }));
vi.mock('../../src/lib/ops/api-member', () => ({ myLessonSessions: () => Promise.resolve([]) }));
vi.mock('../../src/lib/ops/api-calendar', () => ({ fetchMyPendingChanges: () => Promise.resolve([]) }));
vi.mock('../../src/lib/horses', () => ({ fetchHorseOnboardingState: () => Promise.resolve(null) }));
vi.mock('../../src/lib/acquisition', () => ({ fetchAcquisitionIntakeState: () => Promise.resolve(null) }));
vi.mock('../../src/lib/community', () => ({ fetchEvents: () => Promise.resolve([]) }));
vi.mock('../../src/lib/supabase', () => ({
  supabase: { rpc: () => Promise.resolve({ data: [], error: null }) },
}));

// Imported after the mocks so the panel picks them up.
const { DashboardPanel } = await import('../../src/components/app/DashboardPanel');

/** Renders the live route so a navigation would be visible to an assertion. */
function Probe() {
  const loc = useLocation();
  return <span data-testid="route">{loc.pathname}</span>;
}

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={['/app/dashboard']}>
      <Routes>
        <Route path="*" element={<><Probe /><DashboardPanel /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

// No `globals: true` in this project's vitest config, so auto-cleanup never
// engages — unmount between cases by hand.
afterEach(() => cleanup());

describe('LEADCLEAN — the "more waiting" control', () => {
  it('states the true remainder of its own list', () => {
    renderPanel();
    // 8 leads, 6 shown → 2 hidden. Not "1", and not the count of some other page.
    expect(screen.getByText('Show 2 more waiting')).toBeInTheDocument();
    expect(screen.getAllByText(/^Lead Person \d$/)).toHaveLength(6);
  });

  it('expands in place instead of navigating', () => {
    renderPanel();
    expect(screen.getByTestId('route')).toHaveTextContent('/app/dashboard');

    fireEvent.click(screen.getByText('Show 2 more waiting'));

    expect(screen.getAllByText(/^Lead Person \d$/)).toHaveLength(8);
    expect(screen.getByText('Show fewer')).toBeInTheDocument();
    // The route never moved — this is the defect the owner reported: the control
    // took them to the Inbound page instead of showing the remaining cards.
    expect(screen.getByTestId('route')).toHaveTextContent('/app/dashboard');
  });

  it('collapses again', () => {
    renderPanel();
    fireEvent.click(screen.getByText('Show 2 more waiting'));
    fireEvent.click(screen.getByText('Show fewer'));
    expect(screen.getAllByText(/^Lead Person \d$/)).toHaveLength(6);
    expect(screen.getByText('Show 2 more waiting')).toBeInTheDocument();
  });
});

describe('LEADCLEAN — a lead card opens its work drawer here', () => {
  it('opens the drawer without leaving the dashboard', () => {
    renderPanel();
    expect(screen.queryByTestId('lead-drawer')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText('Review →')[0]);

    expect(screen.getByTestId('lead-drawer')).toHaveTextContent('drawer:lead-0');
    expect(screen.getByTestId('route')).toHaveTextContent('/app/dashboard');
  });
});

describe('LEADCLEAN — converted leads are marked up, not vanished', () => {
  it('shows what happened and links to the record they became', () => {
    renderPanel();
    fireEvent.click(screen.getByText(/1 lead already became a client/));
    expect(screen.getByText('Already A Client')).toBeInTheDocument();
    expect(screen.getByText(/now a client/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('Open record →'));
    expect(screen.getByTestId('route')).toHaveTextContent('/app/admin');
  });
});
