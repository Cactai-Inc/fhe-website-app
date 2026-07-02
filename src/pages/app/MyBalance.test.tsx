// @vitest-environment jsdom
/**
 * LANE-2 UI-interaction test (Wiring & Verification Contract §15) — /app/balance.
 *
 * Renders the REAL MyBalance page with the REAL api-balance fns mocked and proves:
 *  - all four client-scoped reads fire and the page groups charges by engagement
 *    (horse-tied open line under the engagement; un-tied line + NULL-engagement
 *    invoice in the General bucket),
 *  - the open-balance total is the SUM of open billable_lines only,
 *  - a payment row links to /order/:id,
 *  - the true empty state renders (no fabricated rows),
 *  - a rejected fetch surfaces the error branch (role=alert), not a blank page.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen } from '../../test/render';

vi.mock('../../lib/ops/api-balance', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../lib/ops/api-balance')>();
  return {
    ...real,
    listMyOpenBillableLines: vi.fn(),
    listMyEngagements: vi.fn(),
    listMyTransactions: vi.fn(),
    listMyPayments: vi.fn(),
  };
});

import {
  listMyOpenBillableLines, listMyEngagements, listMyTransactions, listMyPayments,
} from '../../lib/ops/api-balance';
import MyBalance from './MyBalance';

const ENG = {
  id: 'eng-1', display_code: 'ENG-2026-000001', service_type: 'HORSE_BOARDING',
  status: 'ACTIVE', primary_horse_id: 'h-1', created_at: '2026-06-01T00:00:00Z',
};
const LINE_BOARD = { // horse-tied → groups under ENG
  id: 'bl-1', payer_contact_id: 'c-1', source_kind: 'board' as const, source_id: null,
  horse_id: 'h-1', qty: 1, unit_amount: 120, amount: 120, status: 'OPEN' as const,
  period: null, transaction_id: null, created_at: '2026-06-20T00:00:00Z',
};
const LINE_FEE = { // no horse → General bucket
  id: 'bl-2', payer_contact_id: 'c-1', source_kind: 'fee' as const, source_id: null,
  horse_id: null, qty: 1, unit_amount: 30.5, amount: 30.5, status: 'OPEN' as const,
  period: null, transaction_id: null, created_at: '2026-06-21T00:00:00Z',
};
const INVOICE = { // settlement invoice with NO engagement → General bucket
  id: 'txn-1', display_code: 'TXN-000007', engagement_id: null,
  txn_type: 'INVOICE' as const, amount: 500, status: 'POSTED', created_at: '2026-06-10T00:00:00Z',
};
const PAYMENT = {
  id: 'pay-1', order_id: 'ord-1', method: 'zelle' as const, amount: 150,
  reference_code: 'FHE-1234', status: 'confirmed' as const, created_at: '2026-06-11T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listMyOpenBillableLines).mockResolvedValue([LINE_BOARD, LINE_FEE]);
  vi.mocked(listMyEngagements).mockResolvedValue([ENG]);
  vi.mocked(listMyTransactions).mockResolvedValue([INVOICE]);
  vi.mocked(listMyPayments).mockResolvedValue([PAYMENT]);
});

describe('MyBalance', () => {
  it('fetches via the real wrappers and groups charges by engagement', async () => {
    renderWithRouter(<MyBalance />);

    // engagement group: title derived from display_code + service_type
    const engGroup = await screen.findByRole('region', { name: /ENG-2026-000001 · Horse Boarding/ });
    expect(engGroup).toHaveTextContent('Board');
    expect(engGroup).toHaveTextContent('$120.00');

    // General bucket holds the un-tied fee line AND the NULL-engagement invoice
    const general = screen.getByRole('region', { name: 'General account' });
    expect(general).toHaveTextContent('Fee');
    expect(general).toHaveTextContent('$30.50');
    expect(general).toHaveTextContent('Invoice · TXN-000007');
    expect(general).toHaveTextContent('$500.00');
    expect(general).toHaveTextContent('POSTED');

    expect(listMyOpenBillableLines).toHaveBeenCalledWith();
    expect(listMyEngagements).toHaveBeenCalledWith();
    expect(listMyTransactions).toHaveBeenCalledWith();
    expect(listMyPayments).toHaveBeenCalledWith();
  });

  it('the open balance is the sum of OPEN billable_lines only (not invoices/payments)', async () => {
    renderWithRouter(<MyBalance />);
    await screen.findByText('Open balance');
    expect(screen.getByText('$150.50')).toBeInTheDocument(); // 120 + 30.50
  });

  it('a payment row links back to its order at /order/:id', async () => {
    renderWithRouter(<MyBalance />);
    const paymentSection = await screen.findByRole('region', { name: 'Payment history' });
    expect(paymentSection).toHaveTextContent('Zelle · FHE-1234');
    expect(paymentSection).toHaveTextContent('$150.00');
    const link = screen.getByRole('link', { name: /view order/i });
    expect(link).toHaveAttribute('href', '/order/ord-1');
  });

  it('renders the honest empty state when the account has no activity', async () => {
    vi.mocked(listMyOpenBillableLines).mockResolvedValue([]);
    vi.mocked(listMyEngagements).mockResolvedValue([]);
    vi.mocked(listMyTransactions).mockResolvedValue([]);
    vi.mocked(listMyPayments).mockResolvedValue([]);
    renderWithRouter(<MyBalance />);

    expect(await screen.findByText('No charges yet')).toBeInTheDocument();
    expect(screen.queryByText('Open balance')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('money')).toHaveLength(0); // nothing fabricated
  });

  it('a rejected fetch surfaces the error branch, never a silent blank page', async () => {
    vi.mocked(listMyOpenBillableLines).mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<MyBalance />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('rls denied');
    expect(screen.queryByText('Open balance')).not.toBeInTheDocument();
  });
});
