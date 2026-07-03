// @vitest-environment jsdom
/**
 * Notifications bell wiring (BOOKING_FLOWS_PLAN §1 messaging spine) — renders the
 * REAL AppLayout with the api layer mocked and proves:
 *  - the unread badge shows my_unread_count() on mount,
 *  - opening the bell lists my_notifications(),
 *  - clicking an unread item marks it read (RPC + local decrement) and navigates
 *    to its link,
 *  - no badge is fabricated when the count is 0.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen, userEvent, waitFor, within } from '../../test/render';

const auth = vi.hoisted(() => ({
  profile: { display_name: 'Camille' },
  isAdmin: false,
  isSuperAdmin: false,
  modules: [] as string[],
  hasModule: () => false,
  signOut: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => auth }));

vi.mock('../../lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/api')>();
  return {
    ...real,
    myUnreadCount: vi.fn(),
    myNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
  };
});

import { myUnreadCount, myNotifications, markNotificationRead, type AppNotification } from '../../lib/api';
import AppLayout from './AppLayout';

const N_UNREAD: AppNotification = {
  id: 'n-1', kind: 'document_executed', title: 'Facility Rules is signed',
  body: null, link: '/app/documents', read_at: null, created_at: '2026-07-03T10:00:00Z',
};
const N_READ: AppNotification = {
  id: 'n-2', kind: 'document_executed', title: 'Company Policies is signed',
  body: null, link: '/app/documents', read_at: '2026-07-02T09:00:00Z',
  created_at: '2026-07-02T08:00:00Z',
};

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<div>HOME OUTLET</div>} />
          {/* inside the layout route, so AppLayout stays mounted across the navigation */}
          <Route path="documents" element={<div>DOCUMENTS PAGE</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

/** The bell renders in both breakpoint-exclusive header spots; use the first. */
function bellButton() {
  return screen.getAllByRole('button', { name: /Notifications/ })[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(myUnreadCount).mockResolvedValue(1);
  vi.mocked(myNotifications).mockResolvedValue([N_UNREAD, N_READ]);
  vi.mocked(markNotificationRead).mockResolvedValue(undefined);
});

describe('AppLayout notifications bell', () => {
  it('shows the unread badge from my_unread_count() on mount', async () => {
    renderLayout();
    const badges = await screen.findAllByTestId('unread-badge');
    expect(badges[0]).toHaveTextContent('1');
    expect(myUnreadCount).toHaveBeenCalled();
  });

  it('renders no badge when everything is read', async () => {
    vi.mocked(myUnreadCount).mockResolvedValue(0);
    renderLayout();
    await screen.findByText('HOME OUTLET');
    await Promise.resolve(); // let the count promise settle
    expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
  });

  it('opens the panel listing my_notifications()', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(bellButton());
    const panel = (await screen.findAllByRole('region', { name: 'Notifications panel' }))[0];
    expect(within(panel).getByText('Facility Rules is signed')).toBeInTheDocument();
    expect(within(panel).getByText('Company Policies is signed')).toBeInTheDocument();
    expect(myNotifications).toHaveBeenCalled();
  });

  it('clicking an unread item marks it read, clears the badge, and navigates to its link', async () => {
    const user = userEvent.setup();
    renderLayout();
    await screen.findAllByTestId('unread-badge');
    await user.click(bellButton());
    const panel = (await screen.findAllByRole('region', { name: 'Notifications panel' }))[0];

    // after the mark-read, the server would report 0 (the route-change re-poll)
    vi.mocked(myUnreadCount).mockResolvedValue(0);
    await user.click(within(panel).getByRole('button', { name: /Facility Rules is signed/ }));

    expect(markNotificationRead).toHaveBeenCalledWith('n-1');
    expect(await screen.findByText('DOCUMENTS PAGE')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Notifications panel' })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument());
  });

  it('clicking an already-read item does not fire the RPC again', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(bellButton());
    const panel = (await screen.findAllByRole('region', { name: 'Notifications panel' }))[0];
    await user.click(within(panel).getByRole('button', { name: /Company Policies is signed/ }));
    expect(markNotificationRead).not.toHaveBeenCalled();
    expect(await screen.findByText('DOCUMENTS PAGE')).toBeInTheDocument();
  });
});
