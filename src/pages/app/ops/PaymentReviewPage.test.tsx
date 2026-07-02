// @vitest-environment jsdom
/**
 * OPS-PAY-REVIEW UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL PaymentReviewPage over the mocked api-payments wrappers and
 * proves the wiring:
 *  - listPaymentNotifications('review') drives the table (real fetch → real
 *    render), and the bucket tabs re-query WITH EXACT status args,
 *  - clicking a row calls findCandidateOrders WITH the row's EXACT
 *    parsed_amount + parsed_reference and renders each candidate order with a
 *    real /order/<id> link,
 *  - 'Dismiss' calls dismissNotification(id), shows the success toast and
 *    refreshes the bucket,
 *  - a rejected dismiss surfaces the error toast (not swallowed),
 *  - a rejected list renders the error branch.
 * (No module gate: payment review is core payments; the route enforces admin.)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';
import type { CandidateOrder, PaymentNotification } from '../../../lib/ops/api-payments';

const listPaymentNotifications = vi.hoisted(() => vi.fn());
const findCandidateOrders = vi.hoisted(() => vi.fn());
const dismissNotification = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/ops/api-payments', () => ({
  listPaymentNotifications,
  findCandidateOrders,
  dismissNotification,
}));

import { PaymentReviewPage } from './PaymentReviewPage';

function notification(over: Partial<PaymentNotification>): PaymentNotification {
  return {
    id: 'n-1',
    received_at: '2026-06-30T15:00:00Z',
    source_inbox: 'payments@fhe.test',
    raw_subject: 'You received $1,500.37 from ADA RIDER',
    raw_body: 'Zelle payment received.',
    parsed_sender: 'ADA RIDER',
    parsed_amount: 1500.37,
    parsed_reference: 'FHE-2214',
    matched_payment_id: null,
    status: 'review',
    ...over,
  };
}

function order(over: Partial<CandidateOrder>): CandidateOrder {
  return {
    id: 'o-1',
    status: 'awaiting_payment',
    total: 1500,
    unique_amount: 1500.37,
    payment_reference: 'FHE-2214',
    created_at: '2026-06-29T12:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OPS-PAY-REVIEW — PaymentReviewPage', () => {
  it("loads the 'review' bucket on mount and renders the notifications", async () => {
    listPaymentNotifications.mockResolvedValue([
      notification({ id: 'n-1', parsed_sender: 'ADA RIDER' }),
      notification({ id: 'n-2', parsed_sender: 'BEN TRAINER', parsed_reference: 'FHE-9001' }),
    ]);

    renderWithRouter(<PaymentReviewPage />);

    expect(await screen.findByText('ADA RIDER')).toBeInTheDocument();
    expect(screen.getByText('BEN TRAINER')).toBeInTheDocument();
    expect(screen.getByText('FHE-9001')).toBeInTheDocument();
    expect(listPaymentNotifications).toHaveBeenCalledTimes(1);
    expect(listPaymentNotifications).toHaveBeenCalledWith('review');
  });

  it("switching buckets re-queries with the EXACT status arg ('unmatched')", async () => {
    const user = userEvent.setup();
    listPaymentNotifications
      .mockResolvedValueOnce([]) // initial 'review' bucket
      .mockResolvedValueOnce([
        notification({ id: 'n-3', parsed_sender: 'CARA GROOM', status: 'unmatched' }),
      ]);

    renderWithRouter(<PaymentReviewPage />);
    await screen.findByText('Queue is clear');

    await user.click(screen.getByRole('button', { name: 'Unmatched' }));

    expect(await screen.findByText('CARA GROOM')).toBeInTheDocument();
    expect(listPaymentNotifications).toHaveBeenLastCalledWith('unmatched');
  });

  it('clicking a row finds candidate orders with EXACT (amount, reference) and links to the order page', async () => {
    const user = userEvent.setup();
    listPaymentNotifications.mockResolvedValue([
      notification({ id: 'n-1', parsed_amount: 1500.37, parsed_reference: 'FHE-2214' }),
    ]);
    findCandidateOrders.mockResolvedValue([order({ id: 'o-77' })]);

    renderWithRouter(<PaymentReviewPage />);
    await user.click(await screen.findByText('ADA RIDER'));

    expect(findCandidateOrders).toHaveBeenCalledTimes(1);
    expect(findCandidateOrders).toHaveBeenCalledWith(1500.37, 'FHE-2214');

    expect(await screen.findByTestId('match-panel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open order' })).toHaveAttribute(
      'href',
      '/order/o-77',
    );
  });

  it('renders the empty-candidates branch when nothing matches', async () => {
    const user = userEvent.setup();
    listPaymentNotifications.mockResolvedValue([notification({ id: 'n-1' })]);
    findCandidateOrders.mockResolvedValue([]);

    renderWithRouter(<PaymentReviewPage />);
    await user.click(await screen.findByText('ADA RIDER'));

    expect(await screen.findByTestId('candidates-empty')).toBeInTheDocument();
  });

  it('Dismiss calls dismissNotification(id), toasts success and refreshes the bucket', async () => {
    const user = userEvent.setup();
    listPaymentNotifications
      .mockResolvedValueOnce([notification({ id: 'n-1' })]) // initial load
      .mockResolvedValueOnce([]); // refresh after dismiss
    findCandidateOrders.mockResolvedValue([]);
    dismissNotification.mockResolvedValue(notification({ id: 'n-1', status: 'matched' }));

    renderWithRouter(<PaymentReviewPage />);
    await user.click(await screen.findByText('ADA RIDER'));
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));

    expect(dismissNotification).toHaveBeenCalledTimes(1);
    expect(dismissNotification).toHaveBeenCalledWith('n-1');

    expect(await screen.findByRole('status')).toHaveTextContent('Notification dismissed.');
    // Refresh happened: the bucket re-queried and the queue is now clear.
    await waitFor(() => expect(listPaymentNotifications).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Queue is clear')).toBeInTheDocument();
    expect(screen.queryByTestId('match-panel')).not.toBeInTheDocument();
  });

  it('a rejected dismiss surfaces an error toast and keeps the row', async () => {
    const user = userEvent.setup();
    listPaymentNotifications.mockResolvedValue([notification({ id: 'n-1' })]);
    findCandidateOrders.mockResolvedValue([]);
    dismissNotification.mockRejectedValue(
      new Error('Dismiss was blocked: payment notifications are server-managed'),
    );

    renderWithRouter(<PaymentReviewPage />);
    await user.click(await screen.findByText('ADA RIDER'));
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Dismiss was blocked: payment notifications are server-managed',
    );
    // No refresh on failure — the initial load is the only list call.
    expect(listPaymentNotifications).toHaveBeenCalledTimes(1);
    expect(screen.getByText('ADA RIDER')).toBeInTheDocument();
  });

  it('renders the error branch when the list rejects', async () => {
    listPaymentNotifications.mockRejectedValue(new Error('admin read denied'));

    renderWithRouter(<PaymentReviewPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('admin read denied');
  });
});
