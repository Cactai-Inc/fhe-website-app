// @vitest-environment jsdom
/**
 * BARNOPS-CONSUMPTION executable proof (§15 UI wiring).
 *
 * Renders the REAL ConsumptionLogPage over a mocked api-barnops layer and proves:
 *   - the recent log renders from listConsumptionEvents with resource/horse
 *     names resolved,
 *   - the capture form calls createConsumptionEvent WITH THE EXACT PAYLOAD
 *     (resource, drawn lot, horse, qty, notes) and prepends the new event,
 *   - APPEND-ONLY by design: no edit/delete affordance exists on logged rows
 *     and the immutability copy renders,
 *   - a rejected create renders the error inline (not swallowed),
 *   - mod.barnops OFF → ModuleGate lock and NO data fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';
import type {
  ConsumptionEvent,
  Resource,
  ResourceLot,
  HorseOption,
} from '../../../../lib/ops/api-barnops';

const listConsumptionEvents = vi.hoisted(() => vi.fn());
const createConsumptionEvent = vi.hoisted(() => vi.fn());
const listResources = vi.hoisted(() => vi.fn());
const listResourceLots = vi.hoisted(() => vi.fn());
const listHorseOptions = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-barnops', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/ops/api-barnops')>(
    '../../../../lib/ops/api-barnops',
  );
  return {
    ...actual,
    listConsumptionEvents,
    createConsumptionEvent,
    listResources,
    listResourceLots,
    listHorseOptions,
  };
});
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import ConsumptionLogPage from './ConsumptionLogPage';

const HAY: Resource = {
  id: 'res-1',
  org_id: 'org-1',
  resource_key: 'hay.timothy',
  name: 'Timothy Hay',
  category: 'feed',
  unit_of_measure: 'bale',
  is_consumable: true,
  created_at: '',
  updated_at: '',
};

const LOT: ResourceLot = {
  id: 'lot-1',
  org_id: 'org-1',
  resource_id: 'res-1',
  vendor_contact_id: null,
  qty_purchased: 12,
  unit_cost: 18.5,
  on_hand: 12,
  purchased_at: '2026-06-02T00:00:00Z',
  created_at: '',
  updated_at: '',
};

const HORSES: HorseOption[] = [
  { id: 'horse-1', display_code: 'H-1', barn_name: 'Comet', registered_name: null },
];

const EXISTING: ConsumptionEvent = {
  id: 'ev-1',
  org_id: 'org-1',
  resource_id: 'res-1',
  resource_lot_id: null,
  horse_id: 'horse-1',
  qty: 1,
  administered_by: null,
  occurred_at: '2026-06-20T08:00:00Z',
  notes: 'morning feed',
  created_at: '',
};

function barnopsOn() {
  useModulesMock.mockReturnValue({ 'mod.barnops': true });
}

beforeEach(() => {
  vi.clearAllMocks();
  barnopsOn();
  listConsumptionEvents.mockResolvedValue([EXISTING]);
  listResources.mockResolvedValue([HAY]);
  listResourceLots.mockResolvedValue([LOT]);
  listHorseOptions.mockResolvedValue(HORSES);
});

describe('ConsumptionLogPage', () => {
  it('renders the recent log with resource + horse names resolved', async () => {
    renderWithRouter(<ConsumptionLogPage />);

    expect(await screen.findByText('morning feed')).toBeInTheDocument();
    expect(listConsumptionEvents).toHaveBeenCalledWith();
    // Names resolved from the joined catalogs (the log row, not just selects).
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('Timothy Hay');
    expect(table).toHaveTextContent('Comet');
  });

  it('logs an event with the exact payload and prepends it to the log', async () => {
    const user = userEvent.setup();
    createConsumptionEvent.mockResolvedValue({
      ...EXISTING,
      id: 'ev-new',
      resource_lot_id: 'lot-1',
      qty: 2,
      notes: 'evening feed',
    });

    renderWithRouter(<ConsumptionLogPage />);
    await screen.findByText('morning feed');

    await user.selectOptions(screen.getByLabelText(/Resource/), 'res-1');
    await user.selectOptions(screen.getByLabelText('Lot'), 'lot-1');
    await user.selectOptions(screen.getByLabelText('Horse'), 'horse-1');
    const qtyInput = screen.getByLabelText(/Quantity/) as HTMLInputElement;
    await user.clear(qtyInput);
    await user.type(qtyInput, '2');
    await user.type(screen.getByLabelText('Notes'), 'evening feed');
    await user.click(screen.getByRole('button', { name: 'Log event' }));

    await waitFor(() => expect(createConsumptionEvent).toHaveBeenCalledTimes(1));
    expect(createConsumptionEvent).toHaveBeenCalledWith({
      resource_id: 'res-1',
      resource_lot_id: 'lot-1',
      horse_id: 'horse-1',
      qty: 2,
      notes: 'evening feed',
    });

    // The created event is prepended to the log (no refetch dropped it).
    expect(await screen.findByText('evening feed')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('Consumption logged.');
  });

  it('offers NO edit/delete affordance on logged events (append-only by design)', async () => {
    renderWithRouter(<ConsumptionLogPage />);
    await screen.findByText('morning feed');

    // The only button on the page is the capture submit — nothing row-level.
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent('Log event');
    expect(screen.queryByRole('button', { name: /edit|delete|remove/i })).not.toBeInTheDocument();
    // The immutability contract is stated in the UI.
    expect(
      screen.getByText(/logged events cannot be edited or deleted/i),
    ).toBeInTheDocument();
  });

  it('renders the error branch when createConsumptionEvent rejects', async () => {
    const user = userEvent.setup();
    createConsumptionEvent.mockRejectedValue(new Error('insufficient stock'));

    renderWithRouter(<ConsumptionLogPage />);
    await screen.findByText('morning feed');

    await user.selectOptions(screen.getByLabelText(/Resource/), 'res-1');
    await user.click(screen.getByRole('button', { name: 'Log event' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('insufficient stock');
  });

  it('locks behind ModuleGate and fetches nothing when mod.barnops is off', () => {
    useModulesMock.mockReturnValue({ 'mod.barnops': false });
    renderWithRouter(<ConsumptionLogPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log event' })).not.toBeInTheDocument();
    expect(listConsumptionEvents).not.toHaveBeenCalled();
  });
});
