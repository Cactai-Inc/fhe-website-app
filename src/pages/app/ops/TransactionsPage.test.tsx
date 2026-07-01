// @vitest-environment jsdom
/**
 * OPS-TXN executable proof (PLATFORM_ARCHITECTURE.md §15).
 *
 * Renders the REAL TransactionsPage + TransactionDetailPage, mocks the REAL data
 * fns `listTransactions` / `getTransaction`, and asserts:
 *   - the list calls listTransactions and renders PURCHASE/SALE/LEASE/INVOICE rows
 *     with Money-formatted amounts + StatusBadge,
 *   - clicking a row NAVIGATES to the detail route and getTransaction is called
 *     WITH THE URL id (real route param),
 *   - an INVOICE detail renders the composing billable_lines, its payer, and a
 *     total that SUMS to the invoice amount,
 *   - a deal (PURCHASE) txn renders a REAL link to its engagement + balance,
 *   - the list error branch renders when listTransactions rejects (not swallowed),
 *   - the detail error branch renders when getTransaction rejects.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { render, renderWithRouter, screen, userEvent } from '../../../test/render';

const listTransactions = vi.fn();
const getTransaction = vi.fn();
vi.mock('../../../lib/api', () => ({
  listTransactions: (...args: unknown[]) => listTransactions(...args),
  getTransaction: (...args: unknown[]) => getTransaction(...args),
}));

import TransactionsPage from './TransactionsPage';
import TransactionDetailPage from './TransactionDetailPage';

const PURCHASE = {
  id: 'txn-deal',
  display_code: 'TXN-0001',
  engagement_id: 'eng-9',
  txn_type: 'PURCHASE',
  amount: 25000,
  deposit_amount: 5000,
  status: 'PENDING',
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const INVOICE = {
  id: 'txn-inv',
  display_code: 'INV-0007',
  engagement_id: null,
  txn_type: 'INVOICE',
  amount: 450,
  deposit_amount: null,
  status: 'POSTED',
  payer_contact_id: 'contact-1',
  period: null,
  created_at: '2026-02-01',
  updated_at: '2026-02-01',
};

const INVOICE_DETAIL = {
  ...INVOICE,
  payer: { id: 'contact-1', display_code: 'CT-1', full_name: 'Jane Boarder' },
  billable_lines: [
    {
      id: 'bl-1',
      org_id: 'org-1',
      payer_contact_id: 'contact-1',
      source_kind: 'board',
      source_id: 'ba-1',
      horse_id: 'horse-1',
      qty: 1,
      unit_amount: 300,
      amount: 300,
      status: 'SETTLED',
      period: null,
      transaction_id: 'txn-inv',
      created_at: '2026-02-01',
      updated_at: '2026-02-01',
    },
    {
      id: 'bl-2',
      org_id: 'org-1',
      payer_contact_id: 'contact-1',
      source_kind: 'lesson',
      source_id: 'lc-1',
      horse_id: null,
      qty: 3,
      unit_amount: 50,
      amount: 150,
      status: 'SETTLED',
      period: null,
      transaction_id: 'txn-inv',
      created_at: '2026-02-01',
      updated_at: '2026-02-01',
    },
  ],
};

/** Mount both routes so a list-row click really navigates + mounts the detail. */
function renderApp(route = '/app/ops/transactions') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/app/ops/transactions" element={<TransactionsPage />} />
          <Route path="/app/ops/transactions/:id" element={<TransactionDetailPage />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('TransactionsPage (OPS-TXN list)', () => {
  beforeEach(() => {
    listTransactions.mockReset();
    getTransaction.mockReset();
  });

  it('calls listTransactions and renders deal + INVOICE rows with Money + status', async () => {
    listTransactions.mockResolvedValue([PURCHASE, INVOICE]);
    renderApp();

    expect(await screen.findByText('TXN-0001')).toBeInTheDocument();
    expect(listTransactions).toHaveBeenCalledTimes(1);

    // Deal + invoice types both present.
    expect(screen.getByText('PURCHASE')).toBeInTheDocument();
    expect(screen.getByText('INVOICE')).toBeInTheDocument();
    expect(screen.getByText('INV-0007')).toBeInTheDocument();

    // Money-formatted amounts.
    expect(screen.getByText('$25,000.00')).toBeInTheDocument();
    expect(screen.getByText('$450.00')).toBeInTheDocument();

    // StatusBadge text.
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    expect(screen.getByText('POSTED')).toBeInTheDocument();
  });

  it('renders the error branch when listTransactions rejects', async () => {
    listTransactions.mockRejectedValue(new Error('rls denied'));
    renderApp();

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
  });

  it('navigates to the detail route on row click and calls getTransaction with the id', async () => {
    listTransactions.mockResolvedValue([INVOICE]);
    getTransaction.mockResolvedValue(INVOICE_DETAIL);
    const user = userEvent.setup();
    renderApp();

    await user.click(await screen.findByText('INV-0007'));

    // Detail mounted → getTransaction called with the REAL route param.
    expect(await screen.findByText('Composing charges')).toBeInTheDocument();
    expect(getTransaction).toHaveBeenCalledTimes(1);
    expect(getTransaction).toHaveBeenCalledWith('txn-inv');
  });
});

describe('TransactionDetailPage (OPS-TXN detail)', () => {
  beforeEach(() => {
    listTransactions.mockReset();
    getTransaction.mockReset();
  });

  function renderDetail(id: string) {
    return renderWithRouter(<TransactionDetailPage />, {
      route: `/app/ops/transactions/${id}`,
      path: '/app/ops/transactions/:id',
    });
  }

  it('renders the composing billable_lines summing to the invoice amount, plus payer', async () => {
    getTransaction.mockResolvedValue(INVOICE_DETAIL);
    renderDetail('txn-inv');

    expect(await screen.findByText('Composing charges')).toBeInTheDocument();
    expect(getTransaction).toHaveBeenCalledWith('txn-inv');

    // Payer surfaced.
    expect(screen.getByTestId('invoice-payer')).toHaveTextContent('Jane Boarder');

    // Each composing line renders (source kind + its Money amount).
    expect(screen.getByText('board')).toBeInTheDocument();
    expect(screen.getByText('lesson')).toBeInTheDocument();
    expect(screen.getByText('$300.00')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();

    // Lines total sums to the invoice amount (300 + 150 = 450).
    expect(screen.getByTestId('lines-total')).toHaveTextContent('$450.00');
  });

  it('renders a deal txn with a real engagement link + balance', async () => {
    getTransaction.mockResolvedValue(PURCHASE);
    renderDetail('txn-deal');

    // Reference header for the deal.
    expect(await screen.findByText('TXN-0001')).toBeInTheDocument();

    // Real link to the engagement.
    const engLink = screen.getByRole('link', { name: 'View engagement' });
    expect(engLink).toHaveAttribute('href', '/app/ops/engagements/eng-9');

    // Balance = amount - deposit (25000 - 5000 = 20000).
    expect(screen.getByTestId('deal-balance')).toHaveTextContent('$20,000.00');
  });

  it('renders the not-found state when getTransaction returns null', async () => {
    getTransaction.mockResolvedValue(null);
    renderDetail('missing');

    expect(await screen.findByText('Transaction not found')).toBeInTheDocument();
  });

  it('renders the error branch when getTransaction rejects', async () => {
    getTransaction.mockRejectedValue(new Error('rls denied'));
    renderDetail('txn-inv');

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
  });
});
