// @vitest-environment jsdom
/**
 * OPS-INTAKE UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL IntakePage over the mocked lane api (api-intake), the
 * mocked brokerage RPC wrappers (lib/api) and the mocked invitation seam
 * (lib/admin) and proves the wiring of BOTH views:
 *
 * REQUEST INBOX (default view — BOOKING_FLOWS_PLAN §2 Flow A step 2):
 *   - listBookingRequests('new') drives the initial inbox (exact default arg),
 *   - the status tabs re-fetch with the chosen status (All → undefined),
 *   - a row click opens the drawer rendering the structured availability
 *     (week window, AM/PM prefs, day prefs, riding experience) + visitor notes,
 *   - Add note → appendRequestNote(id, text) and the returned timeline renders,
 *   - Mark contacted → markRequestContacted(id) + toast + refresh,
 *   - the LESSON FIT CHECKLIST persists each toggle via setRequestChecklist and
 *     gates "Send confirmation & invite" (disabled + explanatory title until
 *     every item is checked),
 *   - the provisioning form opens prefilled from the request (first/last split,
 *     email, notes) and submits adminSendInvitation with the EXACT payload
 *     including requestId → the sent state renders and the drawer's status
 *     flips to invited.
 *
 * FORM SUBMISSIONS (the pre-existing intake_submissions queue, unchanged):
 *   same assertions as before, reached through the "Form submissions" tab.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor, within } from '../../../test/render';
import type { IntakeSubmission, BookingRequest } from '../../../lib/ops/api-intake';

const listIntakeSubmissions = vi.hoisted(() => vi.fn());
const markSubmissionStatus = vi.hoisted(() => vi.fn());
const markSubmissionConverted = vi.hoisted(() => vi.fn());
const findOrCreateContactByEmail = vi.hoisted(() => vi.fn());
const findClientForRequest = vi.hoisted(() => vi.fn());
const listBookingRequests = vi.hoisted(() => vi.fn());
const markRequestContacted = vi.hoisted(() => vi.fn());
const appendRequestNote = vi.hoisted(() => vi.fn());
const setRequestChecklist = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/ops/api-intake', () => ({
  listIntakeSubmissions,
  markSubmissionStatus,
  markSubmissionConverted,
  findOrCreateContactByEmail,
  findClientForRequest,
  listBookingRequests,
  markRequestContacted,
  appendRequestNote,
  setRequestChecklist,
}));

const scheduleLessonSession = vi.hoisted(() => vi.fn());
const listLessonSessionsForRequest = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/ops/api-lessons', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../lib/ops/api-lessons')>();
  return {
    ...real, // keeps sessionWindow (the pure compose helper) real
    scheduleLessonSession,
    listLessonSessionsForRequest,
  };
});

const createPurchaseEngagement = vi.hoisted(() => vi.fn());
const createSearchEngagement = vi.hoisted(() => vi.fn());
const createLeaseEngagement = vi.hoisted(() => vi.fn());
const fetchOfferings = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/api', () => ({
  createPurchaseEngagement,
  createSearchEngagement,
  createLeaseEngagement,
  fetchOfferings,
}));

const adminSendInvitation = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/admin', () => ({
  adminSendInvitation,
}));

import { IntakePage, LESSON_FIT_CHECKLIST } from './IntakePage';
import { sessionWindow } from '../../../lib/ops/api-lessons';

const REQUEST_NOTES = [
  'Excited to start!',
  '',
  '— Availability & experience —',
  'Riding experience: 1–2 years',
  'Preferred times: Weekdays AM & PM · Weekends AM',
  'Days: Mon, Wed, Sat',
  'Weeks: Jul 5 – Jul 11, 2026',
].join('\n');

function request(over: Partial<BookingRequest>): BookingRequest {
  return {
    id: 'req-1',
    created_at: '2026-07-01T12:00:00Z',
    status: 'new',
    contact_name: 'Cara Novice',
    contact_email: 'cara@rider.test',
    contact_phone: '555-0107',
    contact_method: 'text',
    proposed_times: [
      {
        date: '2026-07-05',
        end: '2026-07-11',
        label: 'Jul 5 – Jul 11, 2026',
        time: 'Weekdays AM & PM · Weekends AM',
        days: 'Mon, Wed, Sat',
      },
    ],
    notes: REQUEST_NOTES,
    staff_notes: [],
    checklist: null,
    request_selections: [
      {
        id: 'sel-1',
        offering_id: null,
        offering_slug: 'riding-lesson',
        tier_id: null,
        label: 'Riding Lessons — 4-Lesson Punch Card',
      },
    ],
    ...over,
  };
}

function submission(over: Partial<IntakeSubmission>): IntakeSubmission {
  return {
    id: 'sub-1',
    form_key: 'INTAKE_HORSE_FINDER',
    payload: { full_legal_name: 'Ada Rider', target_budget: '25000' },
    contact_email: 'ada@barn.test',
    contact_name: 'Ada Rider',
    status: 'NEW',
    converted_engagement_id: null,
    created_at: '2026-06-30T12:00:00Z',
    reviewed_at: null,
    reviewed_by: null,
    ...over,
  };
}

/** The submissions queue lives behind its tab now — switch to it first. */
async function openSubmissionsView(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Form submissions' }));
}

beforeEach(() => {
  vi.clearAllMocks();
  listIntakeSubmissions.mockResolvedValue([]);
  listBookingRequests.mockResolvedValue([]);
  setRequestChecklist.mockResolvedValue(undefined);
  findClientForRequest.mockResolvedValue(null);
  listLessonSessionsForRequest.mockResolvedValue([]);
  fetchOfferings.mockResolvedValue([
    {
      id: 'off-1',
      slug: 'riding-lesson',
      tiers: [{ id: 'tier-1', offering_id: 'off-1', label: '4-Lesson Punch Card', price_amount: 500 }],
    },
  ]);
});

describe('OPS-INTAKE — Request Inbox (default view)', () => {
  it("loads the 'new' inbox by default and renders the request rows", async () => {
    listBookingRequests.mockResolvedValue([request({})]);
    renderWithRouter(<IntakePage />);

    expect(await screen.findByText('Cara Novice')).toBeInTheDocument();
    expect(listBookingRequests).toHaveBeenCalledTimes(1);
    expect(listBookingRequests).toHaveBeenCalledWith('new');
    // contact + preferred-method badge + requested summary
    expect(screen.getByText(/cara@rider\.test/)).toBeInTheDocument();
    expect(screen.getByText('Text')).toBeInTheDocument();
    expect(screen.getByText('Riding Lessons — 4-Lesson Punch Card')).toBeInTheDocument();
  });

  it('re-fetches when the status tabs change (contacted, invited, then All → undefined)', async () => {
    const user = userEvent.setup();
    renderWithRouter(<IntakePage />);
    await screen.findByText('No requests');

    await user.click(screen.getByRole('button', { name: 'Contacted' }));
    await waitFor(() => expect(listBookingRequests).toHaveBeenCalledWith('contacted'));

    await user.click(screen.getByRole('button', { name: 'Invited' }));
    await waitFor(() => expect(listBookingRequests).toHaveBeenCalledWith('invited'));

    await user.click(screen.getByRole('button', { name: 'All' }));
    await waitFor(() => expect(listBookingRequests).toHaveBeenCalledWith(undefined));
  });

  it('renders the error branch when the inbox rejects', async () => {
    listBookingRequests.mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<IntakePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
  });

  it('row click opens the drawer with the structured availability rendered readably', async () => {
    const user = userEvent.setup();
    listBookingRequests.mockResolvedValue([request({})]);
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    // week window, AM/PM prefs, day prefs, riding experience — all readable
    expect(screen.getByText('Jul 5 – Jul 11, 2026')).toBeInTheDocument();
    expect(screen.getByText('Weekdays AM & PM · Weekends AM')).toBeInTheDocument();
    expect(screen.getByText('Mon, Wed, Sat')).toBeInTheDocument();
    expect(screen.getByText('1–2 years')).toBeInTheDocument();
    // the visitor's own words, WITHOUT the appended availability block
    expect(screen.getByText('Excited to start!')).toBeInTheDocument();
    expect(screen.queryByText(/— Availability & experience —/)).toBeNull();
    // empty timeline state
    expect(screen.getByText('No notes yet.')).toBeInTheDocument();
  });

  it('legacy {date,time} proposed_times entries still render', async () => {
    const user = userEvent.setup();
    listBookingRequests.mockResolvedValue([
      request({ proposed_times: [{ date: '2026-07-09', time: 'morning' }], notes: null }),
    ]);
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('2026-07-09 (morning)')).toBeInTheDocument();
    expect(screen.getByText('Not provided')).toBeInTheDocument(); // no experience in notes
  });

  it('Add note → appendRequestNote(id, text) and the returned timeline renders', async () => {
    const user = userEvent.setup();
    listBookingRequests.mockResolvedValue([request({})]);
    appendRequestNote.mockResolvedValue([
      { at: '2026-07-03T10:00:00Z', by_name: 'Odile', note: 'Called — Saturday works.' },
    ]);
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    await user.type(await screen.findByLabelText('Add a note'), 'Called — Saturday works.');
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    expect(appendRequestNote).toHaveBeenCalledTimes(1);
    expect(appendRequestNote).toHaveBeenCalledWith('req-1', 'Called — Saturday works.');
    expect(await screen.findByText('Called — Saturday works.')).toBeInTheDocument();
    expect(screen.getByText(/Odile/)).toBeInTheDocument();
    // the compose box cleared
    expect(screen.getByLabelText('Add a note')).toHaveValue('');
  });

  it('Mark contacted → markRequestContacted(id), toast + refresh, drawer stays open on the request', async () => {
    const user = userEvent.setup();
    listBookingRequests
      .mockResolvedValueOnce([request({})])
      .mockResolvedValueOnce([]);
    markRequestContacted.mockResolvedValue(request({ status: 'contacted' }));
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    await user.click(await screen.findByRole('button', { name: 'Mark contacted' }));

    expect(markRequestContacted).toHaveBeenCalledTimes(1);
    expect(markRequestContacted).toHaveBeenCalledWith('req-1');
    expect(await screen.findByRole('status')).toHaveTextContent('Request marked contacted.');
    expect(listBookingRequests).toHaveBeenCalledTimes(2);
    // the drawer stays open (staff keep working the request) with the new status
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('contacted')).toBeInTheDocument();
  });

  it('checklist gates the send button: disabled + title until every item is checked, each toggle persisted', async () => {
    const user = userEvent.setup();
    listBookingRequests.mockResolvedValue([request({})]);
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    const sendBtn = await screen.findByRole('button', { name: 'Send confirmation & invite' });
    expect(sendBtn).toBeDisabled();
    expect(sendBtn).toHaveAttribute('title', 'Complete the lesson fit checklist to enable sending');

    for (const item of LESSON_FIT_CHECKLIST) {
      await user.click(screen.getByLabelText(item.label));
    }

    // every toggle persisted the WHOLE object; the last call carries all-true
    expect(setRequestChecklist).toHaveBeenCalledTimes(LESSON_FIT_CHECKLIST.length);
    expect(setRequestChecklist).toHaveBeenLastCalledWith(
      'req-1',
      Object.fromEntries(LESSON_FIT_CHECKLIST.map((i) => [i.key, true])),
    );
    expect(sendBtn).toBeEnabled();
  });

  it('send flow: prefilled provisioning form → adminSendInvitation EXACT payload with requestId → sent state + invited', async () => {
    const user = userEvent.setup();
    const complete = Object.fromEntries(LESSON_FIT_CHECKLIST.map((i) => [i.key, true]));
    listBookingRequests
      .mockResolvedValueOnce([request({ checklist: complete })])
      .mockResolvedValueOnce([]);
    adminSendInvitation.mockResolvedValue({
      registerUrl: 'https://app.fhe.test/register?token=tok-9',
      emailed: true,
      tierLabel: '4-Lesson Punch Card',
    });
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    const sendBtn = await screen.findByRole('button', { name: 'Send confirmation & invite' });
    expect(sendBtn).toBeEnabled();
    await user.click(sendBtn);

    // prefilled from the request: first/last split from contact_name, email, notes
    expect(await screen.findByLabelText(/First name/)).toHaveValue('Cara');
    expect(screen.getByLabelText(/Last name/)).toHaveValue('Novice');
    expect(screen.getByLabelText(/Email/)).toHaveValue('cara@rider.test');
    expect(screen.getByLabelText(/Notes \(optional\)/)).toHaveValue(REQUEST_NOTES);

    // the submit stays gated until a tier is chosen
    expect(screen.getByRole('button', { name: 'Send invitation' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText(/What did they buy/), 'tier-1');
    await user.click(screen.getByLabelText('Already paid'));
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(adminSendInvitation).toHaveBeenCalledTimes(1);
    expect(adminSendInvitation).toHaveBeenCalledWith({
      email: 'cara@rider.test',
      requestId: 'req-1',
      firstName: 'Cara',
      lastName: 'Novice',
      tierId: 'tier-1',
      markPaid: true,
      paymentMethod: 'Zelle',
      notes: REQUEST_NOTES,
    });

    // sent state + the drawer's request flips to invited; the inbox refreshed
    expect(
      await screen.findByText(/4-Lesson Punch Card provisioned — invitation created/),
    ).toBeInTheDocument();
    expect(screen.getByText('https://app.fhe.test/register?token=tok-9')).toBeInTheDocument();
    expect(screen.getByText('invited')).toBeInTheDocument();
    expect(listBookingRequests).toHaveBeenCalledTimes(2);
    // the action row is replaced by the sent state
    expect(screen.queryByRole('button', { name: 'Send confirmation & invite' })).toBeNull();
  });

  it('a rejected send surfaces in the drawer and nothing flips', async () => {
    const user = userEvent.setup();
    const complete = Object.fromEntries(LESSON_FIT_CHECKLIST.map((i) => [i.key, true]));
    listBookingRequests.mockResolvedValue([request({ checklist: complete })]);
    adminSendInvitation.mockRejectedValue(new Error('could not create invitation'));
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    await user.click(await screen.findByRole('button', { name: 'Send confirmation & invite' }));
    await user.selectOptions(screen.getByLabelText(/What did they buy/), 'tier-1');
    await user.click(screen.getByRole('button', { name: 'Send invitation' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('could not create invitation');
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('new')).toBeInTheDocument(); // status untouched
    expect(listBookingRequests).toHaveBeenCalledTimes(1); // no refresh on failure
  });

  it('an invited request offers no send button (already through the gate)', async () => {
    const user = userEvent.setup();
    listBookingRequests.mockResolvedValue([request({ status: 'invited' })]);
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send confirmation & invite' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark contacted' })).toBeNull();
  });
});

describe('OPS-INTAKE — Schedule lesson section (invited/converted requests)', () => {
  it('a NEW request has no schedule section and resolves no client', async () => {
    const user = userEvent.setup();
    listBookingRequests.mockResolvedValue([request({})]);
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText('Schedule lesson')).toBeNull();
    expect(findClientForRequest).not.toHaveBeenCalled();
    expect(listLessonSessionsForRequest).not.toHaveBeenCalled();
  });

  it('an invited request books via scheduleLessonSession with the EXACT payload (requestId included)', async () => {
    const user = userEvent.setup();
    listBookingRequests
      .mockResolvedValueOnce([request({ status: 'invited' })])
      .mockResolvedValueOnce([]);
    findClientForRequest.mockResolvedValue('client-9');
    scheduleLessonSession.mockResolvedValue({ session_id: 'ls-1', status: 'SCHEDULED' });
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    expect(findClientForRequest).toHaveBeenCalledWith('req-1');

    // the client is known, so the booking form renders (no client picker)
    const form = await screen.findByRole('form', { name: 'Schedule a lesson' });
    expect(within(form).queryByLabelText(/Client/)).toBeNull();
    await user.type(within(form).getByLabelText(/Date/), '2026-07-11');
    await user.type(within(form).getByLabelText(/Start time/), '10:00');
    await user.selectOptions(within(form).getByLabelText(/Duration/), '45');
    await user.type(within(form).getByLabelText(/Lesson note/), 'Evaluation first');
    await user.click(within(form).getByRole('button', { name: 'Schedule lesson' }));

    const window = sessionWindow('2026-07-11', '10:00', 45);
    expect(scheduleLessonSession).toHaveBeenCalledTimes(1);
    expect(scheduleLessonSession).toHaveBeenCalledWith({
      client_id: 'client-9',
      starts_at: window.starts_at,
      ends_at: window.ends_at,
      location: null,
      notes: 'Evaluation first',
      request_id: 'req-1',
    });

    // toast + the drawer's status flips (the RPC converted it server-side) + refetches
    expect(await screen.findByRole('status')).toHaveTextContent('Lesson scheduled');
    expect(screen.getByText('converted')).toBeInTheDocument();
    expect(listLessonSessionsForRequest).toHaveBeenCalledTimes(2);
    expect(listBookingRequests).toHaveBeenCalledTimes(2);
  });

  it('sessions already booked from the request render inline with their status', async () => {
    const user = userEvent.setup();
    listBookingRequests.mockResolvedValue([request({ status: 'converted' })]);
    findClientForRequest.mockResolvedValue('client-9');
    listLessonSessionsForRequest.mockResolvedValue([
      {
        id: 'ls-1', org_id: 'org-1', client_id: 'client-9', engagement_id: null,
        request_id: 'req-1', starts_at: '2026-07-11T17:00:00Z', ends_at: '2026-07-11T18:00:00Z',
        status: 'SCHEDULED', location: 'Main arena', notes: null, credit_id: null,
        created_at: '2026-07-03T12:00:00Z',
      },
    ]);
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    const list = await screen.findByTestId('request-sessions');
    expect(listLessonSessionsForRequest).toHaveBeenCalledWith('req-1');
    expect(within(list).getByText(/Main arena/)).toBeInTheDocument();
    expect(within(list).getByText('SCHEDULED')).toBeInTheDocument();
  });

  it('an invited request with no provisioned client explains itself instead of a form', async () => {
    const user = userEvent.setup();
    listBookingRequests.mockResolvedValue([request({ status: 'invited' })]);
    findClientForRequest.mockResolvedValue(null);
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    expect(await screen.findByText(/No provisioned client found/)).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Schedule a lesson' })).toBeNull();
  });

  it('a rejected schedule (overlap) surfaces in the drawer, nothing flips', async () => {
    const user = userEvent.setup();
    listBookingRequests.mockResolvedValue([request({ status: 'invited' })]);
    findClientForRequest.mockResolvedValue('client-9');
    scheduleLessonSession.mockRejectedValue(
      new Error('this client already has a lesson scheduled that overlaps'),
    );
    renderWithRouter(<IntakePage />);

    await user.click(await screen.findByText('Cara Novice'));
    const form = await screen.findByRole('form', { name: 'Schedule a lesson' });
    await user.type(within(form).getByLabelText(/Date/), '2026-07-11');
    await user.type(within(form).getByLabelText(/Start time/), '10:00');
    await user.click(within(form).getByRole('button', { name: 'Schedule lesson' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/already has a lesson scheduled/);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('invited')).toBeInTheDocument(); // status untouched
    expect(listBookingRequests).toHaveBeenCalledTimes(1); // no refresh on failure
  });
});

describe('OPS-INTAKE — form submissions view (unchanged behavior)', () => {
  it('loads the NEW queue on tab switch and renders the rows', async () => {
    const user = userEvent.setup();
    listIntakeSubmissions.mockResolvedValue([
      submission({ id: 'sub-1', contact_name: 'Ada Rider' }),
      submission({
        id: 'sub-2',
        form_key: 'INTAKE_HORSE_PURCHASE',
        contact_name: 'Ben Buyer',
        contact_email: 'ben@barn.test',
      }),
    ]);

    renderWithRouter(<IntakePage />);
    await openSubmissionsView(user);

    expect(await screen.findByText('Ada Rider')).toBeInTheDocument();
    expect(screen.getByText('Ben Buyer')).toBeInTheDocument();
    // Default filter is NEW — the exact arg lands at the seam.
    expect(listIntakeSubmissions).toHaveBeenCalledTimes(1);
    expect(listIntakeSubmissions).toHaveBeenCalledWith('NEW');
  });

  it('re-fetches when the status filter changes (DISMISSED, then ALL → undefined)', async () => {
    const user = userEvent.setup();
    renderWithRouter(<IntakePage />);
    await openSubmissionsView(user);
    await screen.findByText('No submissions');

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'DISMISSED');
    await waitFor(() => expect(listIntakeSubmissions).toHaveBeenCalledWith('DISMISSED'));

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'ALL');
    await waitFor(() => expect(listIntakeSubmissions).toHaveBeenCalledWith(undefined));
  });

  it('renders the error branch when the list rejects', async () => {
    const user = userEvent.setup();
    listIntakeSubmissions.mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<IntakePage />);
    await openSubmissionsView(user);
    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
  });

  it('row click opens the drawer with the payload fields rendered', async () => {
    const user = userEvent.setup();
    listIntakeSubmissions.mockResolvedValue([submission({})]);
    renderWithRouter(<IntakePage />);
    await openSubmissionsView(user);

    await user.click(await screen.findByText('ada@barn.test'));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    // Payload keys + values render.
    expect(screen.getByText('target_budget')).toBeInTheDocument();
    expect(screen.getByText('25000')).toBeInTheDocument();
    expect(screen.getByText('full_legal_name')).toBeInTheDocument();
  });

  it('Mark reviewed → markSubmissionStatus(id, REVIEWED), toast + refresh, drawer closes', async () => {
    const user = userEvent.setup();
    listIntakeSubmissions
      .mockResolvedValueOnce([submission({ id: 'sub-9' })])
      .mockResolvedValueOnce([]);
    markSubmissionStatus.mockResolvedValue(submission({ id: 'sub-9', status: 'REVIEWED' }));

    renderWithRouter(<IntakePage />);
    await openSubmissionsView(user);
    await user.click(await screen.findByText('ada@barn.test'));
    await user.click(await screen.findByRole('button', { name: 'Mark reviewed' }));

    expect(markSubmissionStatus).toHaveBeenCalledTimes(1);
    expect(markSubmissionStatus).toHaveBeenCalledWith('sub-9', 'REVIEWED');
    expect(await screen.findByRole('status')).toHaveTextContent('Submission marked reviewed.');
    expect(listIntakeSubmissions).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Dismiss → markSubmissionStatus(id, DISMISSED)', async () => {
    const user = userEvent.setup();
    listIntakeSubmissions
      .mockResolvedValueOnce([submission({ id: 'sub-3' })])
      .mockResolvedValueOnce([]);
    markSubmissionStatus.mockResolvedValue(submission({ id: 'sub-3', status: 'DISMISSED' }));

    renderWithRouter(<IntakePage />);
    await openSubmissionsView(user);
    await user.click(await screen.findByText('ada@barn.test'));
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));

    expect(markSubmissionStatus).toHaveBeenCalledWith('sub-3', 'DISMISSED');
    expect(await screen.findByRole('status')).toHaveTextContent('Submission dismissed.');
  });

  it('CONVERT (HORSE_FINDER): contact resolved → createSearchEngagement EXACT args → CONVERTED stamped', async () => {
    const user = userEvent.setup();
    listIntakeSubmissions
      .mockResolvedValueOnce([submission({ id: 'sub-7' })])
      .mockResolvedValueOnce([]);
    findOrCreateContactByEmail.mockResolvedValue('contact-1');
    createSearchEngagement.mockResolvedValue('eng-1');
    markSubmissionConverted.mockResolvedValue(
      submission({ id: 'sub-7', status: 'CONVERTED', converted_engagement_id: 'eng-1' }),
    );

    renderWithRouter(<IntakePage />);
    await openSubmissionsView(user);
    await user.click(await screen.findByText('ada@barn.test'));
    await user.click(await screen.findByRole('button', { name: 'Convert to engagement' }));

    // The full conversion chain, exact args at every seam.
    expect(findOrCreateContactByEmail).toHaveBeenCalledTimes(1);
    expect(findOrCreateContactByEmail).toHaveBeenCalledWith('Ada Rider', 'ada@barn.test');
    expect(createSearchEngagement).toHaveBeenCalledTimes(1);
    expect(createSearchEngagement).toHaveBeenCalledWith({
      clientContactId: 'contact-1',
      retainedBy: 'buyer',
      dealSide: 'BUY',
    });
    expect(markSubmissionConverted).toHaveBeenCalledTimes(1);
    expect(markSubmissionConverted).toHaveBeenCalledWith('sub-7', 'eng-1');
    // Other engagement wrappers never fire for this form.
    expect(createPurchaseEngagement).not.toHaveBeenCalled();
    expect(createLeaseEngagement).not.toHaveBeenCalled();

    expect(await screen.findByRole('status')).toHaveTextContent('Converted to engagement');
    expect(listIntakeSubmissions).toHaveBeenCalledTimes(2);
  });

  it('CONVERT (HORSE_PURCHASE): routes through createPurchaseEngagement({buyerContactId})', async () => {
    const user = userEvent.setup();
    listIntakeSubmissions
      .mockResolvedValueOnce([
        submission({
          id: 'sub-8',
          form_key: 'INTAKE_HORSE_PURCHASE',
          contact_name: 'Ben Buyer',
          contact_email: 'ben@barn.test',
        }),
      ])
      .mockResolvedValueOnce([]);
    findOrCreateContactByEmail.mockResolvedValue('contact-2');
    createPurchaseEngagement.mockResolvedValue('eng-2');
    markSubmissionConverted.mockResolvedValue(
      submission({ id: 'sub-8', status: 'CONVERTED', converted_engagement_id: 'eng-2' }),
    );

    renderWithRouter(<IntakePage />);
    await openSubmissionsView(user);
    await user.click(await screen.findByText('ben@barn.test'));
    await user.click(await screen.findByRole('button', { name: 'Convert to engagement' }));

    expect(findOrCreateContactByEmail).toHaveBeenCalledWith('Ben Buyer', 'ben@barn.test');
    expect(createPurchaseEngagement).toHaveBeenCalledWith({ buyerContactId: 'contact-2' });
    expect(markSubmissionConverted).toHaveBeenCalledWith('sub-8', 'eng-2');
  });

  it('non-brokerage form_key: no Convert button (no conversion path faked)', async () => {
    const user = userEvent.setup();
    listIntakeSubmissions.mockResolvedValue([
      submission({ id: 'sub-5', form_key: 'INTAKE_HORSE_CLIPPING' }),
    ]);
    renderWithRouter(<IntakePage />);
    await openSubmissionsView(user);

    await user.click(await screen.findByText('ada@barn.test'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Convert to engagement' })).toBeNull();
    // Review/dismiss still available.
    expect(screen.getByRole('button', { name: 'Mark reviewed' })).toBeInTheDocument();
  });

  it('rejected convert: error renders in the drawer, drawer STAYS OPEN, nothing stamped', async () => {
    const user = userEvent.setup();
    listIntakeSubmissions.mockResolvedValue([submission({ id: 'sub-6' })]);
    findOrCreateContactByEmail.mockResolvedValue('contact-1');
    createSearchEngagement.mockRejectedValue(new Error('require_module: mod.brokerage'));

    renderWithRouter(<IntakePage />);
    await openSubmissionsView(user);
    await user.click(await screen.findByText('ada@barn.test'));
    await user.click(await screen.findByRole('button', { name: 'Convert to engagement' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('require_module: mod.brokerage');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(markSubmissionConverted).not.toHaveBeenCalled();
    // No refresh happened beyond the initial load.
    expect(listIntakeSubmissions).toHaveBeenCalledTimes(1);
  });
});
