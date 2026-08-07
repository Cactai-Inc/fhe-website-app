// @vitest-environment jsdom
/**
 * PLUSPASS — verifies the page-level "+" controls this task adds, without a
 * live authenticated browser session (no real Supabase credentials are
 * available in this environment — see docs/reports/TASK-PLUSPASS-REPORT.md).
 * Each surface's heavy data-fetching children/hooks are mocked so the test
 * targets only what this task changed: the button's presence, its gating,
 * and that it triggers the right existing flow. `vi.mock` calls are hoisted
 * to the top of the module by vitest regardless of where they're written, so
 * they live at top level here rather than nested in `describe` blocks.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PageCreateButton } from '../../src/components/app/PageCreateButton';
import { CreateModal } from '../../src/components/app/CreateModal';
import { CreateModalTriggerContext } from '../../src/contexts/CreateModalContext';
import Home from '../../src/pages/app/Home';
import MyPosts from '../../src/pages/app/MyPosts';
import AccountHub from '../../src/pages/app/AccountHub';
import Messages from '../../src/pages/app/Messages';

vi.mock('../../src/contexts/AuthContext', () => ({
  useAuth: () => ({ isStaff: false, isAdmin: false, isSuperAdmin: false }),
}));
vi.mock('../../src/components/feed/CommunityFeed', () => ({ CommunityFeed: () => null }));
vi.mock('../../src/lib/surfaces', () => ({
  useViewSurfaces: () => ({
    surfaces: { categories: [], surfaces: ['feed'], has_feed: true, has_community: true, is_operator: false },
    loading: false,
    refresh: () => {},
  }),
}));
vi.mock('../../src/lib/feed', () => ({
  feedMyPosts: () => new Promise(() => {}), // never resolves — page stays in its own "Loading…" state
}));

// No global test-framework hooks are configured for vitest here (no
// `globals: true`), so @testing-library/react's auto-cleanup never engages —
// without this, DOM from one test leaks into the next `screen` query.
afterEach(() => cleanup());

describe('PageCreateButton', () => {
  it('renders the label and fires onClick', () => {
    const onClick = vi.fn();
    render(<PageCreateButton label="Post" onClick={onClick} />);
    const btn = screen.getByRole('button', { name: /post/i });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders as a Link when `to` is given', () => {
    render(<PageCreateButton label="Horse" to="/app/account?section=stable" />, { wrapper: MemoryRouter });
    const link = screen.getByRole('link', { name: /horse/i });
    expect(link).toHaveAttribute('href', '/app/account?section=stable');
  });
});

describe('CreateModal initialStep', () => {
  it('defaults to the destination menu (unchanged header behavior)', () => {
    render(<MemoryRouter><CreateModal onClose={() => {}} /></MemoryRouter>);
    expect(screen.getByText('Create')).toBeInTheDocument();
    expect(screen.getByText('Community post')).toBeInTheDocument();
    expect(screen.queryByText('Discussion')).not.toBeInTheDocument();
  });

  it('initialStep="post_type" jumps straight past the destination menu', () => {
    render(<MemoryRouter><CreateModal onClose={() => {}} initialStep="post_type" /></MemoryRouter>);
    expect(screen.getByText('New community post')).toBeInTheDocument();
    expect(screen.getByText('Social')).toBeInTheDocument();
    expect(screen.getByText('Discussion')).toBeInTheDocument();
    expect(screen.queryByText('Community post')).not.toBeInTheDocument();
    expect(screen.queryByText('Book a lesson')).not.toBeInTheDocument();
  });
});

describe('Home "+ Post" wiring', () => {
  it('shows "+ Post" and opens the CreateModal at post_type when a create-modal trigger is present', () => {
    const openCreate = vi.fn();
    render(
      <MemoryRouter initialEntries={['/app']}>
        <CreateModalTriggerContext.Provider value={{ openCreate }}>
          <Home />
        </CreateModalTriggerContext.Provider>
      </MemoryRouter>,
    );
    const btn = screen.getByRole('button', { name: /post/i });
    fireEvent.click(btn);
    expect(openCreate).toHaveBeenCalledWith('post_type');
  });

  it('renders no "+ Post" button when there is no create-modal trigger in the tree (never a dead click)', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /post/i })).not.toBeInTheDocument();
  });
});

describe('MyPosts "+ Post" wiring', () => {
  it('shows "+ Post" and opens the CreateModal at post_type', () => {
    const openCreate = vi.fn();
    render(
      <MemoryRouter initialEntries={['/app/my-posts']}>
        <CreateModalTriggerContext.Provider value={{ openCreate }}>
          <MyPosts />
        </CreateModalTriggerContext.Provider>
      </MemoryRouter>,
    );
    const btn = screen.getByRole('button', { name: /post/i });
    fireEvent.click(btn);
    expect(openCreate).toHaveBeenCalledWith('post_type');
  });
});

describe('Calendar "+ Booking" wiring', () => {
  // Partial mock — override only fetchCalendar's role; every other export
  // (CalendarItemPanel's own fetchLocations/listLessonClients/etc.) stays
  // real. Real ones reject against the placeholder Supabase URL, which their
  // own `.catch()` handlers already absorb — same as every other test here.
  const mockApiCalendar = (role: 'client' | 'staff') => {
    vi.doMock('../../src/lib/ops/api-calendar', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../../src/lib/ops/api-calendar')>();
      return {
        ...actual,
        fetchCalendar: () => Promise.resolve({ from: '', to: '', role, hours: [], items: [] }),
        fetchRevenue: () => Promise.resolve({ total: 0 }),
        fetchCreditsRoster: () => Promise.resolve([]),
        fetchOpenChangeRequests: () => Promise.resolve([]),
      };
    });
  };

  it('for a client, opens the request-time flow', async () => {
    vi.resetModules();
    mockApiCalendar('client');
    const { default: CalendarPage } = await import('../../src/pages/app/CalendarPage');
    render(<MemoryRouter initialEntries={['/app/calendar']}><CalendarPage /></MemoryRouter>);
    const btn = screen.getByRole('button', { name: /booking/i });
    fireEvent.click(btn);
    // heading, not the submit button below it, which shares the same text
    expect(screen.getByRole('heading', { name: 'Request this time' })).toBeInTheDocument();
  });

  it('for staff, opens the full booking editor instead (same as an empty grid-cell click)', async () => {
    vi.resetModules();
    mockApiCalendar('staff');
    const { default: CalendarPage } = await import('../../src/pages/app/CalendarPage');
    render(<MemoryRouter initialEntries={['/app/calendar']}><CalendarPage /></MemoryRouter>);
    await screen.findByRole('button', { name: 'Calendar settings' }); // only staff gets this — confirms role='staff' loaded
    const btn = screen.getByRole('button', { name: /booking/i });
    fireEvent.click(btn);
    expect(screen.getByRole('heading', { name: 'New calendar item' })).toBeInTheDocument();
  });
});

describe('My Stable "+ Horse" wiring', () => {
  it('shows "+ Horse" next to the Horses section and opens the horse-intake modal', () => {
    render(<MemoryRouter initialEntries={['/app/account?section=stable']}><AccountHub /></MemoryRouter>);
    // exact match — the "My Stable" row button's own accessible name also
    // contains the substring "horse" ("...Your horses, gear, and supplies")
    const btn = screen.getByRole('button', { name: 'Horse' });
    fireEvent.click(btn);
    expect(screen.getByText('Add a horse')).toBeInTheDocument();
  });
});

describe('Messages "+ Message" wiring', () => {
  it('shows "+ Message" next to the title and opens the member picker', () => {
    render(<MemoryRouter initialEntries={['/app/messages']}><Messages /></MemoryRouter>);
    const btn = screen.getByRole('button', { name: /message/i });
    fireEvent.click(btn);
    expect(screen.getByPlaceholderText('Search members…')).toBeInTheDocument();
  });
});
