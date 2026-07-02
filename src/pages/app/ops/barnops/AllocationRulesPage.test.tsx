// @vitest-environment jsdom
/**
 * BARNOPS-ALLOCATION executable proof (§15 UI wiring).
 *
 * Renders the REAL AllocationRulesPage over a mocked api-barnops layer and proves:
 *   - the rules list renders from listCostAllocationRules with payer/horse
 *     names resolved,
 *   - "New rule" submit calls createCostAllocationRule WITH THE EXACT PAYLOAD,
 *   - "Remove" soft-deletes via deleteCostAllocationRule(id),
 *   - "Resolve billing" calls the REAL resolve_consumption_billing wrapper with
 *     the month's EXACT tstzrange (via the real monthToPeriod), then fetches
 *     and renders the billable_lines the run produced,
 *   - a rejected create renders the error inline,
 *   - mod.barnops OFF → ModuleGate lock and NO data fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';
import type { BillableLine } from '../../../../lib/ops/types';
import type {
  CostAllocationRule,
  ContactOption,
  HorseOption,
} from '../../../../lib/ops/api-barnops';

const listCostAllocationRules = vi.hoisted(() => vi.fn());
const createCostAllocationRule = vi.hoisted(() => vi.fn());
const updateCostAllocationRule = vi.hoisted(() => vi.fn());
const deleteCostAllocationRule = vi.hoisted(() => vi.fn());
const resolveConsumptionBilling = vi.hoisted(() => vi.fn());
const listConsumptionBillableLines = vi.hoisted(() => vi.fn());
const listContactOptions = vi.hoisted(() => vi.fn());
const listHorseOptions = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-barnops', async () => {
  // Keep the REAL monthToPeriod/ALLOCATION_SCOPES; mock only the data fns.
  const actual = await vi.importActual<typeof import('../../../../lib/ops/api-barnops')>(
    '../../../../lib/ops/api-barnops',
  );
  return {
    ...actual,
    listCostAllocationRules,
    createCostAllocationRule,
    updateCostAllocationRule,
    deleteCostAllocationRule,
    resolveConsumptionBilling,
    listConsumptionBillableLines,
    listContactOptions,
    listHorseOptions,
  };
});
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import AllocationRulesPage from './AllocationRulesPage';

const CONTACTS: ContactOption[] = [
  { id: 'contact-1', display_code: 'C-1', full_name: 'Jane Owner' },
  { id: 'contact-2', display_code: 'C-2', full_name: 'Barn LLC' },
];
const HORSES: HorseOption[] = [
  { id: 'horse-1', display_code: 'H-1', barn_name: 'Comet', registered_name: null },
];

const DEFAULT_RULE: CostAllocationRule = {
  id: 'rule-1',
  org_id: 'org-1',
  scope: 'default',
  scope_id: null,
  payer_contact_id: 'contact-2',
  share_pct: 100,
  effective_from: null,
  effective_to: null,
  created_at: '',
  updated_at: '',
};

const PERIOD = '[2026-06-01 00:00:00+00,2026-07-01 00:00:00+00)';

const LINES: BillableLine[] = [
  {
    id: 'line-1',
    org_id: 'org-1',
    payer_contact_id: 'contact-1',
    source_kind: 'consumption',
    source_id: 'ev-1',
    horse_id: 'horse-1',
    qty: 2,
    unit_amount: 18.5,
    amount: 37,
    status: 'OPEN',
    period: PERIOD,
    transaction_id: null,
    created_at: '',
    updated_at: '',
  },
  {
    id: 'line-2',
    org_id: 'org-1',
    payer_contact_id: 'contact-2',
    source_kind: 'consumption',
    source_id: 'ev-2',
    horse_id: null,
    qty: 1,
    unit_amount: 20,
    amount: 20,
    status: 'OPEN',
    period: PERIOD,
    transaction_id: null,
    created_at: '',
    updated_at: '',
  },
];

function barnopsOn() {
  useModulesMock.mockReturnValue({ 'mod.barnops': true });
}

beforeEach(() => {
  vi.clearAllMocks();
  barnopsOn();
  listCostAllocationRules.mockResolvedValue([DEFAULT_RULE]);
  listContactOptions.mockResolvedValue(CONTACTS);
  listHorseOptions.mockResolvedValue(HORSES);
});

describe('AllocationRulesPage', () => {
  it('renders the rules list with the payer resolved by name', async () => {
    renderWithRouter(<AllocationRulesPage />);

    expect(await screen.findByText('Barn default')).toBeInTheDocument();
    expect(listCostAllocationRules).toHaveBeenCalledWith();
    expect(screen.getByText('Barn LLC')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('creates a horse-scoped rule with the exact payload', async () => {
    const user = userEvent.setup();
    createCostAllocationRule.mockResolvedValue({
      ...DEFAULT_RULE,
      id: 'rule-2',
      scope: 'horse',
      scope_id: 'horse-1',
      payer_contact_id: 'contact-1',
      share_pct: 50,
    });

    renderWithRouter(<AllocationRulesPage />);
    await screen.findByText('Barn default');

    await user.click(screen.getByRole('button', { name: 'New rule' }));
    await user.selectOptions(screen.getByLabelText(/Scope/), 'horse');
    await user.selectOptions(screen.getByLabelText(/Horse/), 'horse-1');
    await user.selectOptions(screen.getByLabelText(/Payer/), 'contact-1');
    const share = screen.getByLabelText(/Share %/) as HTMLInputElement;
    await user.clear(share);
    await user.type(share, '50');
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    await waitFor(() => expect(createCostAllocationRule).toHaveBeenCalledTimes(1));
    expect(createCostAllocationRule).toHaveBeenCalledWith({
      scope: 'horse',
      scope_id: 'horse-1',
      payer_contact_id: 'contact-1',
      share_pct: 50,
      effective_from: null,
      effective_to: null,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Rule created.');
  });

  it('Remove soft-deletes the rule via deleteCostAllocationRule(id)', async () => {
    const user = userEvent.setup();
    deleteCostAllocationRule.mockResolvedValue(undefined);

    renderWithRouter(<AllocationRulesPage />);
    await screen.findByText('Barn default');

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(deleteCostAllocationRule).toHaveBeenCalledWith('rule-1'));
    await waitFor(() => expect(screen.queryByText('Barn default')).not.toBeInTheDocument());
  });

  it('Resolve billing calls the RPC wrapper with the exact tstzrange and renders the produced lines', async () => {
    const user = userEvent.setup();
    resolveConsumptionBilling.mockResolvedValue(2);
    listConsumptionBillableLines.mockResolvedValue(LINES);

    renderWithRouter(<AllocationRulesPage />);
    await screen.findByText('Barn default');

    // Pick June 2026 explicitly (month input), then resolve.
    fireEvent.change(screen.getByLabelText(/Period/), { target: { value: '2026-06' } });
    await user.click(screen.getByRole('button', { name: 'Resolve billing' }));

    await waitFor(() => expect(resolveConsumptionBilling).toHaveBeenCalledTimes(1));
    expect(resolveConsumptionBilling).toHaveBeenCalledWith(PERIOD);
    expect(listConsumptionBillableLines).toHaveBeenCalledWith(PERIOD);

    // The produced billable_lines render: payers, amounts, the barn line for a
    // horseless event, and the emitted-count summary.
    expect(await screen.findByTestId('resolve-summary')).toHaveTextContent(
      `Resolver emitted 2 lines for ${PERIOD}`,
    );
    expect(screen.getByText('Jane Owner')).toBeInTheDocument();
    expect(screen.getByText('$37.00')).toBeInTheDocument();
    expect(screen.getByText('Barn')).toBeInTheDocument();
    // line-2: unit $20.00 × 1 → amount $20.00 (renders in both columns).
    expect(screen.getAllByText('$20.00')).toHaveLength(2);
  });

  it('renders the resolver rejection inline (AsyncButton error branch)', async () => {
    const user = userEvent.setup();
    resolveConsumptionBilling.mockRejectedValue(
      new Error('no default/barn payer is configured'),
    );

    renderWithRouter(<AllocationRulesPage />);
    await screen.findByText('Barn default');

    await user.click(screen.getByRole('button', { name: 'Resolve billing' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'no default/barn payer is configured',
    );
    expect(listConsumptionBillableLines).not.toHaveBeenCalled();
  });

  it('renders the error inline and keeps the modal open when create rejects', async () => {
    const user = userEvent.setup();
    createCostAllocationRule.mockRejectedValue(new Error('share_pct out of range'));

    renderWithRouter(<AllocationRulesPage />);
    await screen.findByText('Barn default');

    await user.click(screen.getByRole('button', { name: 'New rule' }));
    await user.selectOptions(screen.getByLabelText(/Horse/), 'horse-1');
    await user.selectOptions(screen.getByLabelText(/Payer/), 'contact-1');
    await user.click(screen.getByRole('button', { name: 'Create rule' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('share_pct out of range');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('locks behind ModuleGate and fetches nothing when mod.barnops is off', () => {
    useModulesMock.mockReturnValue({ 'mod.barnops': false });
    renderWithRouter(<AllocationRulesPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolve billing' })).not.toBeInTheDocument();
    expect(listCostAllocationRules).not.toHaveBeenCalled();
  });
});
