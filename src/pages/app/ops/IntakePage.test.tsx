// @vitest-environment jsdom
/**
 * OPS-INTAKE UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL IntakePage over the mocked lane api (api-intake) + the
 * mocked brokerage RPC wrappers (lib/api) and proves the wiring:
 *   - listIntakeSubmissions('NEW') drives the initial queue (exact default arg),
 *   - the status filter re-fetches with the chosen status (and ALL → undefined),
 *   - a row click opens the drawer rendering the submission's payload fields,
 *   - Mark reviewed → markSubmissionStatus(id,'REVIEWED') + toast + refresh,
 *   - CONVERT (INTAKE_HORSE_FINDER) → findOrCreateContactByEmail(name,email) →
 *     createSearchEngagement({clientContactId,retainedBy:'buyer',dealSide:'BUY'})
 *     → markSubmissionConverted(id, engagementId), EXACT args at every seam,
 *   - CONVERT (INTAKE_HORSE_PURCHASE) → createPurchaseEngagement({buyerContactId}),
 *   - the error branch renders and the drawer STAYS OPEN on rejection.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';
import type { IntakeSubmission } from '../../../lib/ops/api-intake';

const listIntakeSubmissions = vi.hoisted(() => vi.fn());
const markSubmissionStatus = vi.hoisted(() => vi.fn());
const markSubmissionConverted = vi.hoisted(() => vi.fn());
const findOrCreateContactByEmail = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/ops/api-intake', () => ({
  listIntakeSubmissions,
  markSubmissionStatus,
  markSubmissionConverted,
  findOrCreateContactByEmail,
}));

const createPurchaseEngagement = vi.hoisted(() => vi.fn());
const createSearchEngagement = vi.hoisted(() => vi.fn());
const createLeaseEngagement = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/api', () => ({
  createPurchaseEngagement,
  createSearchEngagement,
  createLeaseEngagement,
}));

import { IntakePage } from './IntakePage';

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

beforeEach(() => {
  vi.clearAllMocks();
  listIntakeSubmissions.mockResolvedValue([]);
});

describe('OPS-INTAKE — IntakePage', () => {
  it('loads the NEW queue by default and renders the rows', async () => {
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

    expect(await screen.findByText('Ada Rider')).toBeInTheDocument();
    expect(screen.getByText('Ben Buyer')).toBeInTheDocument();
    // Default filter is NEW — the exact arg lands at the seam.
    expect(listIntakeSubmissions).toHaveBeenCalledTimes(1);
    expect(listIntakeSubmissions).toHaveBeenCalledWith('NEW');
  });

  it('re-fetches when the status filter changes (DISMISSED, then ALL → undefined)', async () => {
    const user = userEvent.setup();
    renderWithRouter(<IntakePage />);
    await screen.findByText('No submissions');

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'DISMISSED');
    await waitFor(() => expect(listIntakeSubmissions).toHaveBeenCalledWith('DISMISSED'));

    await user.selectOptions(screen.getByLabelText('Filter by status'), 'ALL');
    await waitFor(() => expect(listIntakeSubmissions).toHaveBeenCalledWith(undefined));
  });

  it('renders the error branch when the list rejects', async () => {
    listIntakeSubmissions.mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<IntakePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
  });

  it('row click opens the drawer with the payload fields rendered', async () => {
    const user = userEvent.setup();
    listIntakeSubmissions.mockResolvedValue([submission({})]);
    renderWithRouter(<IntakePage />);

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
    await user.click(await screen.findByText('ada@barn.test'));
    await user.click(await screen.findByRole('button', { name: 'Convert to engagement' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('require_module: mod.brokerage');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(markSubmissionConverted).not.toHaveBeenCalled();
    // No refresh happened beyond the initial load.
    expect(listIntakeSubmissions).toHaveBeenCalledTimes(1);
  });
});
