// @vitest-environment jsdom
/**
 * Member Schedule page — renders the REAL Schedule with the community api and
 * my_lesson_sessions seam mocked and proves:
 *  - the "Your lessons" section renders FIRST from myLessonSessions()
 *    (date/time/location/status badges),
 *  - the empty state ('No lessons booked yet' + /app/book link) shows when the
 *    member has no sessions,
 *  - the community events section is KEPT below under 'Barn events' with its
 *    RSVP wiring intact.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, within } from '../../test/render';
import type { MemberLessonSession } from '../../lib/ops/api-member';
import type { CommunityEvent } from '../../lib/community-types';

vi.mock('../../lib/community', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/community')>();
  return {
    ...real,
    fetchEvents: vi.fn(),
    fetchMyRsvps: vi.fn(),
    setRsvp: vi.fn(),
  };
});
vi.mock('../../lib/ops/api-member', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/ops/api-member')>();
  return { ...real, myLessonSessions: vi.fn() };
});

import { fetchEvents, fetchMyRsvps, setRsvp } from '../../lib/community';
import { myLessonSessions } from '../../lib/ops/api-member';
import Schedule from './Schedule';

const EVENT: CommunityEvent = {
  id: 'ev-1',
  title: 'Summer Barn Social',
  description: 'Potluck at the barn.',
  starts_at: '2026-07-18T22:00:00Z',
  ends_at: null,
  location: 'Main barn',
  capacity: null,
  published: true,
};

const SESSIONS: MemberLessonSession[] = [
  {
    id: 'ls-1',
    starts_at: '2026-07-10T16:00:00Z',
    ends_at: '2026-07-10T17:00:00Z',
    status: 'SCHEDULED',
    location: 'Main arena',
    notes: null,
  },
  {
    id: 'ls-2',
    starts_at: '2026-06-20T16:00:00Z',
    ends_at: '2026-06-20T17:00:00Z',
    status: 'COMPLETED',
    location: null,
    notes: null,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchEvents).mockResolvedValue([EVENT]);
  vi.mocked(fetchMyRsvps).mockResolvedValue([]);
  vi.mocked(setRsvp).mockResolvedValue(undefined as never);
  vi.mocked(myLessonSessions).mockResolvedValue(SESSIONS);
});

describe('Schedule — Your lessons section (first)', () => {
  it('renders the member sessions with time, location and status badges', async () => {
    renderWithRouter(<Schedule />);
    const section = await screen.findByTestId('my-lessons-section');
    expect(myLessonSessions).toHaveBeenCalledTimes(1);
    expect(within(section).getByText(/Main arena/)).toBeInTheDocument();
    expect(within(section).getByText('Scheduled')).toBeInTheDocument();
    expect(within(section).getByText('Completed')).toBeInTheDocument();
    // the lessons section precedes the events section in the document
    const events = screen.getByRole('region', { name: 'Barn events' });
    expect(section.compareDocumentPosition(events) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the empty state with the /app/book link when no lessons are booked', async () => {
    vi.mocked(myLessonSessions).mockResolvedValue([]);
    renderWithRouter(<Schedule />);
    const section = await screen.findByTestId('my-lessons-section');
    expect(within(section).getByText(/No lessons booked yet/)).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /Book a lesson/ })).toHaveAttribute(
      'href',
      '/app/book',
    );
  });

  it('a failed sessions load leaves the events section intact (empty lessons state)', async () => {
    vi.mocked(myLessonSessions).mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<Schedule />);
    expect(await screen.findByText('Summer Barn Social')).toBeInTheDocument();
    expect(screen.getByText(/No lessons booked yet/)).toBeInTheDocument();
  });
});

describe('Schedule — Barn events kept below', () => {
  it('renders the community events with their RSVP controls', async () => {
    const user = userEvent.setup();
    renderWithRouter(<Schedule />);
    expect(await screen.findByText('Summer Barn Social')).toBeInTheDocument();
    expect(screen.getByText('Barn events')).toBeInTheDocument();

    const group = screen.getByRole('radiogroup', { name: 'RSVP for Summer Barn Social' });
    await user.click(within(group).getByRole('radio', { name: 'Going' }));
    expect(setRsvp).toHaveBeenCalledWith('ev-1', 'going');
  });

  it('shows the calendar empty state when there are no events', async () => {
    vi.mocked(fetchEvents).mockResolvedValue([]);
    renderWithRouter(<Schedule />);
    expect(await screen.findByText(/Nothing on the calendar yet/)).toBeInTheDocument();
  });
});
