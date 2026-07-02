// @vitest-environment jsdom
/**
 * Zelle payment-instructions UI-interaction test (PLATFORM_ARCHITECTURE.md §15).
 *
 * Renders the REAL OrderPayment for an order awaiting Zelle payment and proves:
 *   - the client sees everything needed to execute the payment: the send-to
 *     address, the EXACT unique-cents amount (never the plain total), and the
 *     memo reference code,
 *   - each field is tap-to-copy: the memo copy button writes the raw reference
 *     to the clipboard and flips to the copied state; the amount copies as a
 *     plain decimal (bank-app paste-able, no currency symbol),
 *   - before Zelle is chosen, the "Pay with Zelle" action calls
 *     markAwaitingPayment(order.id, 'zelle') exactly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent } from '../../test/render';

vi.mock('../../lib/api', () => ({
  markAwaitingPayment: vi.fn(),
}));
vi.mock('../../lib/payments', () => ({
  startStripeCheckout: vi.fn(),
}));

import { markAwaitingPayment } from '../../lib/api';
import OrderPayment from './OrderPayment';
import type { Order, OrderItem, Payment } from '../../lib/types';

const baseOrder = {
  id: 'order-1',
  status: 'awaiting_payment',
  payment_method: 'zelle',
  total: 150,
  unique_amount: 150.37,
  payment_reference: 'FHE-A1B2',
  items: [] as OrderItem[],
} as unknown as Order & { items: OrderItem[] };

let clipboard: string[];

beforeEach(() => {
  vi.clearAllMocks();
  clipboard = [];
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn(async (v: string) => { clipboard.push(v); }) },
  });
});

describe('OrderPayment — Zelle instructions', () => {
  it('surfaces send-to, exact unique amount, and memo reference', () => {
    renderWithRouter(<OrderPayment order={baseOrder} payment={null} onChange={() => {}} />);
    expect(screen.getByText('Send to')).toBeInTheDocument();
    expect(screen.getByText(/@FHEquestrian\.com/i)).toBeInTheDocument();
    expect(screen.getByText('$150.37')).toBeInTheDocument(); // unique cents, not $150.00
    expect(screen.getByText('FHE-A1B2')).toBeInTheDocument();
  });

  it('copies the raw memo reference and the plain-decimal amount', async () => {
    renderWithRouter(<OrderPayment order={baseOrder} payment={null} onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /copy memo/i }));
    expect(clipboard).toContain('FHE-A1B2');
    expect(await screen.findByRole('button', { name: /memo.*copied/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /copy amount/i }));
    expect(clipboard).toContain('150.37'); // paste-able in a bank app
  });

  it('choosing Zelle marks the order awaiting payment', async () => {
    const notYet = { ...baseOrder, status: 'draft' } as typeof baseOrder;
    vi.mocked(markAwaitingPayment).mockResolvedValue(undefined as never);
    const onChange = vi.fn();
    renderWithRouter(<OrderPayment order={notYet} payment={null} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /pay with zelle/i }));
    expect(markAwaitingPayment).toHaveBeenCalledWith('order-1', 'zelle');
    expect(onChange).toHaveBeenCalled();
  });

  it('shows the manual-review notice when a payment is in review', () => {
    const payment = { status: 'review' } as unknown as Payment;
    renderWithRouter(<OrderPayment order={baseOrder} payment={payment} onChange={() => {}} />);
    expect(screen.getByText(/needs a quick manual check/i)).toBeInTheDocument();
  });
});
