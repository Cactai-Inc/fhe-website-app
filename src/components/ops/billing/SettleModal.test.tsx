// @vitest-environment jsdom
/**
 * OPS-SETTLE UI-interaction test (PLATFORM_ARCHITECTURE.md §15).
 *
 * Renders the REAL SettleModal, mocks the REAL data fns
 * (listOpenBillableLines → [lines], settleBillableLines → [{transaction_id,
 * amount, lines_settled}]), and proves the wiring end-to-end:
 *   - the payer's OPEN lines render and the invoice total is DERIVED from the
 *     real line amounts (summed Money),
 *   - clicking "Create invoice" calls settleBillableLines(payerContactId,
 *     period) EXACTLY — the button is the real RPC, not a stub,
 *   - the success branch surfaces the returned transaction_id + amount +
 *     lines_settled (and hands the result to onSettled),
 *   - the idempotent no-op (RPC returns zero lines_settled) renders a
 *     "nothing to settle" message rather than an error,
 *   - the error branch renders on rejection and the modal STAYS OPEN.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';

// Mock the real api module — the fns the modal actually imports and calls.
vi.mock('../../../lib/api', () => ({
  listOpenBillableLines: vi.fn(),
  settleBillableLines: vi.fn(),
}));

import { listOpenBillableLines, settleBillableLines } from '../../../lib/api';
import { SettleModal } from './SettleModal';
import type { BillableLine, SettlementResult } from '../../../lib/ops/types';

const listMock = vi.mocked(listOpenBillableLines);
const settleMock = vi.mocked(settleBillableLines);

const PAYER_ID = 'contact-42';
const PERIOD = '[2026-06-01,2026-07-01)';

function line(overrides: Partial<BillableLine> = {}): BillableLine {
  return {
    id: 'bl-1',
    org_id: 'org-1',
    payer_contact_id: PAYER_ID,
    source_kind: 'board',
    source_id: null,
    horse_id: null,
    qty: 1,
    unit_amount: 100,
    amount: 100,
    status: 'OPEN',
    period: PERIOD,
    transaction_id: null,
    created_at: '2026-06-05T00:00:00Z',
    updated_at: '2026-06-05T00:00:00Z',
    ...overrides,
  };
}

const LINES: BillableLine[] = [
  line({ id: 'bl-1', source_kind: 'board', qty: 1, unit_amount: 100, amount: 100 }),
  line({ id: 'bl-2', source_kind: 'lesson', qty: 3, unit_amount: 150, amount: 450 }),
];
// Real summed total: 100 + 450 = 550.

const SETTLE_RESULT: SettlementResult = {
  transaction_id: 'txn-777',
  amount: 550,
  lines_settled: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue(LINES);
  settleMock.mockResolvedValue([SETTLE_RESULT]);
});

describe('SettleModal (OPS-SETTLE)', () => {
  it('lists the payer OPEN lines and shows the summed invoice total (derived from real amounts)', async () => {
    renderWithRouter(
      <SettleModal open onClose={vi.fn()} payerContactId={PAYER_ID} period={PERIOD} />,
    );

    // Lines rendered.
    expect(await screen.findByText('board')).toBeInTheDocument();
    expect(screen.getByText('lesson')).toBeInTheDocument();

    // Fetched for the given payer.
    expect(listMock).toHaveBeenCalledWith(PAYER_ID);

    // The invoice total is the SUM of the real line amounts (100 + 450 = 550).
    expect(await screen.findByText('$550.00')).toBeInTheDocument();
  });

  it('clicks Create invoice → settleBillableLines(payerContactId, period) EXACTLY, then surfaces the invoice', async () => {
    const user = userEvent.setup();
    const onSettled = vi.fn();
    renderWithRouter(
      <SettleModal
        open
        onClose={vi.fn()}
        payerContactId={PAYER_ID}
        period={PERIOD}
        onSettled={onSettled}
      />,
    );
    await screen.findByText('board');

    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    // The REAL rpc wrapper was called with the payer + period, exactly.
    expect(settleMock).toHaveBeenCalledTimes(1);
    expect(settleMock).toHaveBeenCalledWith(PAYER_ID, PERIOD);

    // Success branch surfaces the returned transaction_id, amount, lines_settled.
    expect(await screen.findByText('txn-777')).toBeInTheDocument();
    expect(screen.getByText(/2 lines settled for/)).toBeInTheDocument();
    expect(screen.getByText('$550.00')).toBeInTheDocument();
    expect(onSettled).toHaveBeenCalledWith(SETTLE_RESULT);
  });

  it('idempotent re-settle: RPC returns zero lines_settled → shows nothing-to-settle (no error)', async () => {
    const user = userEvent.setup();
    // The re-open of an already-settled period: the RPC finds nothing OPEN.
    settleMock.mockResolvedValue([]);
    const onSettled = vi.fn();

    renderWithRouter(
      <SettleModal
        open
        onClose={vi.fn()}
        payerContactId={PAYER_ID}
        period={PERIOD}
        onSettled={onSettled}
      />,
    );
    await screen.findByText('board');

    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    // The rpc still fired with the exact args...
    expect(settleMock).toHaveBeenCalledWith(PAYER_ID, PERIOD);
    // ...and the no-op is surfaced as an informational status, NOT an error.
    expect(await screen.findByRole('status')).toHaveTextContent(/Nothing to settle/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('renders the error branch on rejection and keeps the modal OPEN', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    settleMock.mockRejectedValueOnce(new Error('require_module: billing'));

    renderWithRouter(
      <SettleModal open onClose={onClose} payerContactId={PAYER_ID} period={PERIOD} />,
    );
    await screen.findByText('board');

    await user.click(screen.getByRole('button', { name: 'Create invoice' }));

    expect(settleMock).toHaveBeenCalledWith(PAYER_ID, PERIOD);

    // Error is not swallowed — it renders...
    expect(await screen.findByRole('alert')).toHaveTextContent('require_module: billing');
    // ...and the modal stays open (dialog + lines still present, onClose NOT called).
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(screen.getByText('board')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
