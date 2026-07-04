// @vitest-environment jsdom
/**
 * OPS-LESSON-SESSIONS UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL SessionsPage over the mocked api-lessons layer + a mocked
 * useModules and proves the wiring:
 *   - listLessonSessions()/listLessonClients() drive the day-grouped list
 *     (client NAMES resolved; Upcoming default hides ended sessions),
 *   - Complete → completeLessonSession(id) and the debit outcome lands in the
 *     toast: 'Completed — 3 credits left' / 'Completed — no credits to debit',
 *   - Cancel / No-show → cancelLessonSession(id, false/true),
 *   - 'Schedule a lesson' → client + date + start time + duration → submit →
 *     scheduleLessonSession with the EXACT composed payload; a rejected
 *     schedule (server overlap) keeps the form open with the message,
 *   - mod.lessons OFF → ModuleGate lock, no fetch fires.
 * Real-path DB behavior lives in test/db/lesson_sessions.test.ts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';
import type { LessonSession, LessonClientOption } from '../../../../lib/ops/api-lessons';

const listLessonSessions = vi.hoisted(() => vi.fn());
const listLessonClients = vi.hoisted(() => vi.fn());
const scheduleLessonSession = vi.hoisted(() => vi.fn());
const completeLessonSession = vi.hoisted(() => vi.fn());
const cancelLessonSession = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-lessons', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../lib/ops/api-lessons')>();
  return {
    ...real, // keeps sessionWindow (the pure compose helper) real
    listLessonSessions,
    listLessonClients,
    scheduleLessonSession,
    completeLessonSession,
    cancelLessonSession,
  };
});
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { SessionsPage } from './SessionsPage';
import { sessionWindow } from '../../../../lib/ops/api-lessons';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function session(over: Partial<LessonSession>): LessonSession {
  const starts = Date.now() + DAY;
  return {
    id: 'ls-1',
    org_id: 'org-1',
    client_id: 'cl-1',
    engagement_id: null,
    request_id: null,
    starts_at: new Date(starts).toISOString(),
    ends_at: new Date(starts + HOUR).toISOString(),
    status: 'SCHEDULED',
    location: null,
    notes: null,
    credit_id: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

const CLIENTS: LessonClientOption[] = [
  { id: 'cl-1', display_code: 'CLI-0001', name: 'Ada Rider', email: 'ada@barn.test' },
  { id: 'cl-2', display_code: 'CLI-0002', name: 'Ben Jumper', email: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  useModulesMock.mockReturnValue({ 'mod.lessons': true });
  listLessonSessions.mockResolvedValue([]);
  listLessonClients.mockResolvedValue(CLIENTS);
});

describe('SessionsPage — module gate + list', () => {
  it('locks and fetches nothing with mod.lessons off', () => {
    useModulesMock.mockReturnValue({ 'mod.lessons': false });
    renderWithRouter(<SessionsPage />);
    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(listLessonSessions).not.toHaveBeenCalled();
    expect(listLessonClients).not.toHaveBeenCalled();
  });

  it('renders the day-grouped upcoming list with client names resolved', async () => {
    listLessonSessions.mockResolvedValue([
      session({ id: 'ls-1', client_id: 'cl-1', location: 'Main arena' }),
      session({
        id: 'ls-past',
        client_id: 'cl-2',
        starts_at: new Date(Date.now() - 2 * DAY).toISOString(),
        ends_at: new Date(Date.now() - 2 * DAY + HOUR).toISOString(),
        status: 'COMPLETED',
      }),
    ]);
    renderWithRouter(<SessionsPage />);

    expect(await screen.findByTestId('sessions-list')).toBeInTheDocument();
    expect(screen.getByText('Ada Rider')).toBeInTheDocument();
    expect(screen.getByText(/Main arena/)).toBeInTheDocument();
    // the ended session is hidden behind the default Upcoming filter
    expect(screen.queryByText('Ben Jumper')).not.toBeInTheDocument();
  });

  it('Past shows ended sessions; All shows everything', async () => {
    const user = userEvent.setup();
    listLessonSessions.mockResolvedValue([
      session({ id: 'ls-1', client_id: 'cl-1' }),
      session({
        id: 'ls-past',
        client_id: 'cl-2',
        starts_at: new Date(Date.now() - 2 * DAY).toISOString(),
        ends_at: new Date(Date.now() - 2 * DAY + HOUR).toISOString(),
        status: 'COMPLETED',
      }),
    ]);
    renderWithRouter(<SessionsPage />);
    await screen.findByText('Ada Rider');

    await user.click(screen.getByRole('button', { name: 'Past' }));
    expect(screen.getByText('Ben Jumper')).toBeInTheDocument();
    expect(screen.queryByText('Ada Rider')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Ada Rider')).toBeInTheDocument();
    expect(screen.getByText('Ben Jumper')).toBeInTheDocument();
  });

  it('renders the error branch when the list rejects', async () => {
    listLessonSessions.mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<SessionsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
  });
});

describe('SessionsPage — complete / cancel / no-show actions', () => {
  it('Complete → completeLessonSession(id); the debit result lands in the toast', async () => {
    const user = userEvent.setup();
    listLessonSessions.mockResolvedValue([session({ id: 'ls-7' })]);
    completeLessonSession.mockResolvedValue({
      session_id: 'ls-7', status: 'COMPLETED', debited: true, credit_id: 'cr-1', credits_remaining: 3,
    });
    renderWithRouter(<SessionsPage />);

    await user.click(await screen.findByRole('button', { name: 'Complete' }));

    expect(completeLessonSession).toHaveBeenCalledTimes(1);
    expect(completeLessonSession).toHaveBeenCalledWith('ls-7');
    expect(await screen.findByRole('status')).toHaveTextContent('Completed — 3 credits left');
    // the row's actions disappear with the status flip
    expect(screen.queryByRole('button', { name: 'Complete' })).not.toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
  });

  it('a no-credit completion reports it plainly', async () => {
    const user = userEvent.setup();
    listLessonSessions.mockResolvedValue([session({ id: 'ls-8' })]);
    completeLessonSession.mockResolvedValue({
      session_id: 'ls-8', status: 'COMPLETED', debited: false, credit_id: null, credits_remaining: 0,
    });
    renderWithRouter(<SessionsPage />);

    await user.click(await screen.findByRole('button', { name: 'Complete' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Completed — no credits to debit');
  });

  it('Cancel → cancelLessonSession(id, false); No-show → (id, true)', async () => {
    const user = userEvent.setup();
    listLessonSessions.mockResolvedValue([
      session({ id: 'ls-c', client_id: 'cl-1' }),
      session({
        id: 'ls-n',
        client_id: 'cl-2',
        starts_at: new Date(Date.now() + 3 * DAY).toISOString(),
        ends_at: new Date(Date.now() + 3 * DAY + HOUR).toISOString(),
      }),
    ]);
    cancelLessonSession
      .mockResolvedValueOnce({ session_id: 'ls-c', status: 'CANCELLED' })
      .mockResolvedValueOnce({ session_id: 'ls-n', status: 'NO_SHOW' });
    renderWithRouter(<SessionsPage />);

    const cancelButtons = await screen.findAllByRole('button', { name: 'Cancel' });
    await user.click(cancelButtons[0]);
    expect(cancelLessonSession).toHaveBeenCalledWith('ls-c', false);
    expect(await screen.findByText('CANCELLED')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'No-show' }));
    expect(cancelLessonSession).toHaveBeenLastCalledWith('ls-n', true);
    expect(await screen.findByText('NO_SHOW')).toBeInTheDocument();
  });

  it('a failed complete surfaces as an error toast, nothing flips', async () => {
    const user = userEvent.setup();
    listLessonSessions.mockResolvedValue([session({ id: 'ls-9' })]);
    completeLessonSession.mockRejectedValue(new Error('only a SCHEDULED lesson can be completed'));
    renderWithRouter(<SessionsPage />);

    await user.click(await screen.findByRole('button', { name: 'Complete' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/only a SCHEDULED lesson/);
    expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
  });
});

describe('SessionsPage — schedule a lesson', () => {
  it('submits scheduleLessonSession with the EXACT composed payload', async () => {
    const user = userEvent.setup();
    scheduleLessonSession.mockResolvedValue({ session_id: 'ls-new', status: 'SCHEDULED' });
    renderWithRouter(<SessionsPage />);
    await screen.findByTestId('sessions-empty');

    await user.click(screen.getByRole('button', { name: 'Schedule a lesson' }));
    await user.selectOptions(await screen.findByLabelText(/Client/), 'cl-2');
    await user.type(screen.getByLabelText(/Date/), '2026-07-10');
    await user.type(screen.getByLabelText(/Start time/), '09:00');
    await user.selectOptions(screen.getByLabelText(/Duration/), '90');
    await user.type(screen.getByLabelText(/Location/), 'Trail head');
    await user.type(screen.getByLabelText(/Lesson note/), 'First trail ride');
    await user.click(screen.getByRole('button', { name: 'Schedule lesson' }));

    const window = sessionWindow('2026-07-10', '09:00', 90);
    expect(scheduleLessonSession).toHaveBeenCalledTimes(1);
    expect(scheduleLessonSession).toHaveBeenCalledWith({
      client_id: 'cl-2',
      starts_at: window.starts_at,
      ends_at: window.ends_at,
      location: 'Trail head',
      notes: 'First trail ride',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Lesson scheduled');
    // the board refreshed
    expect(listLessonSessions).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('a rejected schedule (overlap) keeps the form open with the message', async () => {
    const user = userEvent.setup();
    scheduleLessonSession.mockRejectedValue(
      new Error('this client already has a lesson scheduled that overlaps'),
    );
    renderWithRouter(<SessionsPage />);
    await screen.findByTestId('sessions-empty');

    await user.click(screen.getByRole('button', { name: 'Schedule a lesson' }));
    await user.selectOptions(await screen.findByLabelText(/Client/), 'cl-1');
    await user.type(screen.getByLabelText(/Date/), '2026-07-10');
    await user.type(screen.getByLabelText(/Start time/), '09:00');
    await user.click(screen.getByRole('button', { name: 'Schedule lesson' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already has a lesson scheduled/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(listLessonSessions).toHaveBeenCalledTimes(1); // no refresh on failure
  });

  it('client + date + time are required before the RPC fires', async () => {
    const user = userEvent.setup();
    renderWithRouter(<SessionsPage />);
    await screen.findByTestId('sessions-empty');

    await user.click(screen.getByRole('button', { name: 'Schedule a lesson' }));
    await user.click(await screen.findByRole('button', { name: 'Schedule lesson' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pick a client.');

    await user.selectOptions(screen.getByLabelText(/Client/), 'cl-1');
    await user.click(screen.getByRole('button', { name: 'Schedule lesson' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Pick a date and a start time.');
    expect(scheduleLessonSession).not.toHaveBeenCalled();
  });
});
