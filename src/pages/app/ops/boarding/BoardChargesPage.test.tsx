// @vitest-environment jsdom
/**
 * OPS-BOARD-CHARGES UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL BoardChargesPage over mocked api-boarding wrappers + a
 * mocked useModules and proves the wiring:
 *   - listBoardCharges() drives the table; a SETTLED charge links its invoice
 *     to /app/ops/transactions/:id, an OPEN one says 'Awaiting settlement',
 *     an UNBILLED one exposes the real 'Emit to billing' retry,
 *   - generate: agreement picked → amount PREFILLS from board_rate → submit
 *     calls createBoardCharge WITH EXACT ARGS (payer/horse derived from the
 *     agreement, current-month period),
 *   - 'Emit to billing' calls emitBoardCharge with the charge + payer + horse,
 *   - a rejected generate renders the error AND keeps the modal open,
 *   - mod.boarding OFF → ModuleGate lock, no data fns called.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';
import type { BoardAgreement, BoardCharge } from '../../../../lib/ops/api-boarding';

const listBoardCharges = vi.hoisted(() => vi.fn());
const createBoardCharge = vi.hoisted(() => vi.fn());
const emitBoardCharge = vi.hoisted(() => vi.fn());
const listBoardAgreements = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-boarding', () => ({
  listBoardCharges,
  createBoardCharge,
  emitBoardCharge,
  listBoardAgreements,
}));
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { BoardChargesPage } from './BoardChargesPage';

function agreement(over: Partial<BoardAgreement>): BoardAgreement {
  return {
    id: 'a-1',
    org_id: 'org-1',
    horse_id: 'h-1',
    stall_id: 's-1',
    boarder_contact_id: 'c-1',
    board_rate: 850,
    board_type: 'full',
    start_date: '2026-07-01',
    end_date: null,
    status: 'ACTIVE',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    horse: { id: 'h-1', barn_name: 'Comet', registered_name: null },
    boarder: { id: 'c-1', full_name: 'Ada Boarder' },
    stall: { id: 's-1', code: 'A1' },
    ...over,
  };
}

function charge(over: Partial<BoardCharge>): BoardCharge {
  return {
    id: 'ch-1',
    org_id: 'org-1',
    board_agreement_id: 'a-1',
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    amount: 850,
    billable_line_id: 'bl-1',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    agreement: {
      id: 'a-1',
      boarder_contact_id: 'c-1',
      horse_id: 'h-1',
      horse: { id: 'h-1', barn_name: 'Comet', registered_name: null },
      boarder: { id: 'c-1', full_name: 'Ada Boarder' },
    },
    billable_line: { id: 'bl-1', status: 'OPEN', transaction_id: null },
    ...over,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function currentMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}
function currentMonthEnd(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${pad(last.getMonth() + 1)}-${pad(last.getDate())}`;
}

function boardingOn() {
  useModulesMock.mockReturnValue({ 'mod.boarding': true });
}

beforeEach(() => {
  vi.clearAllMocks();
  listBoardCharges.mockResolvedValue([]);
  listBoardAgreements.mockResolvedValue([agreement({ id: 'a-1' })]);
});

describe('OPS-BOARD-CHARGES — BoardChargesPage', () => {
  it('renders charges with billing status + invoice link for a SETTLED line', async () => {
    boardingOn();
    listBoardCharges.mockResolvedValue([
      charge({
        id: 'ch-1',
        billable_line: { id: 'bl-1', status: 'SETTLED', transaction_id: 'txn-77' },
      }),
      charge({
        id: 'ch-2',
        period_start: '2026-07-01',
        period_end: '2026-07-31',
        billable_line: { id: 'bl-2', status: 'OPEN', transaction_id: null },
      }),
      charge({
        id: 'ch-3',
        period_start: '2026-05-01',
        period_end: '2026-05-31',
        billable_line_id: null,
        billable_line: null,
      }),
    ]);

    renderWithRouter(<BoardChargesPage />);

    expect(await screen.findByText('2026-06-01 → 2026-06-30')).toBeInTheDocument();
    // Settled → link to the settling INVOICE transaction detail.
    expect(screen.getByRole('link', { name: 'View invoice' })).toHaveAttribute(
      'href',
      '/app/ops/transactions/txn-77',
    );
    // Open → awaiting settlement (settles on the Transactions surface).
    expect(screen.getByText('Awaiting settlement')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Transactions' })).toHaveAttribute(
      'href',
      '/app/ops/transactions',
    );
    // Un-emitted → the retry action is a real button.
    expect(screen.getByText('UNBILLED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emit to billing' })).toBeInTheDocument();
    expect(listBoardCharges).toHaveBeenCalledTimes(1);
  });

  it('generate: agreement picked → amount prefills from board_rate → createBoardCharge with EXACT args', async () => {
    const user = userEvent.setup();
    boardingOn();
    createBoardCharge.mockResolvedValue(
      charge({ id: 'ch-9', period_start: currentMonthStart(), period_end: currentMonthEnd() }),
    );

    renderWithRouter(<BoardChargesPage />);
    await screen.findByText('No board charges yet');

    await user.click(screen.getByRole('button', { name: 'Generate charge' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Agreement/), 'a-1');
    // Deterministic rate × period: the amount prefilled from the agreement.
    expect(screen.getByLabelText(/Amount/)).toHaveValue(850);

    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(createBoardCharge).toHaveBeenCalledTimes(1);
    expect(createBoardCharge).toHaveBeenCalledWith({
      board_agreement_id: 'a-1',
      payer_contact_id: 'c-1',
      horse_id: 'h-1',
      period_start: currentMonthStart(),
      period_end: currentMonthEnd(),
      amount: 850,
    });

    expect(screen.getByRole('status')).toHaveTextContent('Charge generated and emitted to billing.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText(`${currentMonthStart()} → ${currentMonthEnd()}`)).toBeInTheDocument();
  });

  it("'Emit to billing' → emitBoardCharge(charge, payer, horse) + row updates", async () => {
    const user = userEvent.setup();
    boardingOn();
    const unbilled = charge({ id: 'ch-3', billable_line_id: null, billable_line: null });
    listBoardCharges.mockResolvedValue([unbilled]);
    emitBoardCharge.mockResolvedValue(
      charge({
        id: 'ch-3',
        billable_line_id: 'bl-3',
        billable_line: { id: 'bl-3', status: 'OPEN', transaction_id: null },
      }),
    );

    renderWithRouter(<BoardChargesPage />);
    await screen.findByText('UNBILLED');

    await user.click(screen.getByRole('button', { name: 'Emit to billing' }));

    expect(emitBoardCharge).toHaveBeenCalledTimes(1);
    expect(emitBoardCharge).toHaveBeenCalledWith(unbilled, 'c-1', 'h-1');

    expect(await screen.findByText('Awaiting settlement')).toBeInTheDocument();
    expect(screen.queryByText('UNBILLED')).toBeNull();
  });

  it('rejected generate → error renders and the modal STAYS open', async () => {
    const user = userEvent.setup();
    boardingOn();
    createBoardCharge.mockRejectedValue(new Error('rls denied'));

    renderWithRouter(<BoardChargesPage />);
    await screen.findByText('No board charges yet');

    await user.click(screen.getByRole('button', { name: 'Generate charge' }));
    await user.selectOptions(screen.getByLabelText(/Agreement/), 'a-1');
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(createBoardCharge).toHaveBeenCalledTimes(1);
  });

  it('mod.boarding OFF → ModuleGate lock, no data fns called', () => {
    useModulesMock.mockReturnValue({ 'mod.boarding': false });

    renderWithRouter(<BoardChargesPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate charge' })).toBeNull();
    expect(listBoardCharges).not.toHaveBeenCalled();
    expect(listBoardAgreements).not.toHaveBeenCalled();
  });
});
