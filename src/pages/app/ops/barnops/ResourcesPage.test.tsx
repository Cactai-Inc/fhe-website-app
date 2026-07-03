// @vitest-environment jsdom
/**
 * BARNOPS-RESOURCES executable proof (§15 UI wiring).
 *
 * Renders the REAL ResourcesPage over a mocked api-barnops layer and proves:
 *   - the catalog renders from listResources/listResourceLots with stock
 *     levels COMPUTED FROM LOTS (sum of on_hand), vendors resolved by name,
 *   - "New resource" submit calls createResource WITH THE EXACT PAYLOAD,
 *   - row-click edit calls updateResource(id, patch),
 *   - the "Add lot" row action calls createResourceLot with the exact payload,
 *   - a rejected create renders the error inline and keeps the modal open,
 *   - mod.barnops OFF → ModuleGate lock and NO data fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';
import type { Resource, ResourceLot, ContactOption } from '../../../../lib/ops/api-barnops';

const listResources = vi.hoisted(() => vi.fn());
const createResource = vi.hoisted(() => vi.fn());
const updateResource = vi.hoisted(() => vi.fn());
const listResourceLots = vi.hoisted(() => vi.fn());
const createResourceLot = vi.hoisted(() => vi.fn());
const listContactOptions = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-barnops', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/ops/api-barnops')>(
    '../../../../lib/ops/api-barnops',
  );
  return {
    ...actual,
    listResources,
    createResource,
    updateResource,
    listResourceLots,
    createResourceLot,
    listContactOptions,
  };
});
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import ResourcesPage from './ResourcesPage';

const HAY: Resource = {
  id: 'res-1',
  org_id: 'org-1',
  resource_key: 'hay.timothy',
  name: 'Timothy Hay',
  category: 'feed',
  unit_of_measure: 'bale',
  is_consumable: true,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const LOTS: ResourceLot[] = [
  {
    id: 'lot-1',
    org_id: 'org-1',
    resource_id: 'res-1',
    vendor_contact_id: 'vendor-1',
    qty_purchased: 12,
    unit_cost: 18.5,
    on_hand: 12,
    purchased_at: '2026-06-02T00:00:00Z',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'lot-2',
    org_id: 'org-1',
    resource_id: 'res-1',
    vendor_contact_id: null,
    qty_purchased: 10,
    unit_cost: 20,
    on_hand: 8,
    purchased_at: '2026-06-10T00:00:00Z',
    created_at: '',
    updated_at: '',
  },
];

const VENDORS: ContactOption[] = [
  { id: 'vendor-1', display_code: 'C-1', first_name: 'Feed', last_name: 'Co' },
];

function barnopsOn() {
  useModulesMock.mockReturnValue({ 'mod.barnops': true });
}
function barnopsOff() {
  useModulesMock.mockReturnValue({ 'mod.barnops': false });
}

beforeEach(() => {
  vi.clearAllMocks();
  barnopsOn();
  listResources.mockResolvedValue([HAY]);
  listResourceLots.mockResolvedValue(LOTS);
  listContactOptions.mockResolvedValue(VENDORS);
});

describe('ResourcesPage', () => {
  it('renders the catalog with stock computed from lots and vendors resolved', async () => {
    renderWithRouter(<ResourcesPage />);

    expect((await screen.findAllByText('Timothy Hay')).length).toBeGreaterThan(0);
    expect(listResources).toHaveBeenCalledWith();
    expect(listResourceLots).toHaveBeenCalledWith();
    expect(listContactOptions).toHaveBeenCalledWith();

    // Stock level = 12 + 8 across the resource's lots — computed, not stored.
    expect(screen.getByTestId('on-hand-hay.timothy')).toHaveTextContent('20');
    // Lots table renders the vendor by name and the lot's unit cost.
    expect(screen.getByText('Feed Co')).toBeInTheDocument();
    expect(screen.getByText('$18.50')).toBeInTheDocument();
  });

  it('creates a resource with the exact payload and refreshes the list', async () => {
    const user = userEvent.setup();
    createResource.mockResolvedValue({ ...HAY, id: 'res-2', resource_key: 'shavings.pine', name: 'Pine Shavings' });

    renderWithRouter(<ResourcesPage />);
    await screen.findAllByText('Timothy Hay');

    await user.click(screen.getByRole('button', { name: 'New resource' }));
    await user.type(screen.getByLabelText(/Resource key/), 'shavings.pine');
    await user.type(screen.getByLabelText(/^Name/), 'Pine Shavings');
    await user.selectOptions(screen.getByLabelText(/Category/), 'bedding');
    const unitInput = screen.getByLabelText('Unit of measure') as HTMLInputElement;
    await user.clear(unitInput);
    await user.type(unitInput, 'bag');
    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    await waitFor(() => expect(createResource).toHaveBeenCalledTimes(1));
    expect(createResource).toHaveBeenCalledWith({
      resource_key: 'shavings.pine',
      name: 'Pine Shavings',
      category: 'bedding',
      unit_of_measure: 'bag',
      is_consumable: true,
    });
    // Success: list refreshed + toast rendered.
    expect(await screen.findByRole('status')).toHaveTextContent('Resource created.');
    expect(listResources).toHaveBeenCalledTimes(2);
  });

  it('row click opens edit and submits updateResource(id, patch)', async () => {
    const user = userEvent.setup();
    updateResource.mockResolvedValue({ ...HAY, name: 'Premium Timothy' });

    renderWithRouter(<ResourcesPage />);
    await user.click((await screen.findAllByText('Timothy Hay'))[0]); // catalog row (name also shows in the lots table)

    const nameInput = screen.getByLabelText(/^Name/) as HTMLInputElement;
    expect(nameInput.value).toBe('Timothy Hay');
    await user.clear(nameInput);
    await user.type(nameInput, 'Premium Timothy');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateResource).toHaveBeenCalledTimes(1));
    expect(updateResource).toHaveBeenCalledWith('res-1', {
      resource_key: 'hay.timothy',
      name: 'Premium Timothy',
      category: 'feed',
      unit_of_measure: 'bale',
      is_consumable: true,
    });
  });

  it('the Add lot row action records a lot with the exact payload', async () => {
    const user = userEvent.setup();
    createResourceLot.mockResolvedValue({ ...LOTS[0], id: 'lot-3' });

    renderWithRouter(<ResourcesPage />);
    await screen.findAllByText('Timothy Hay');

    await user.click(screen.getByRole('button', { name: 'Add lot' }));
    await user.selectOptions(screen.getByLabelText('Vendor'), 'vendor-1');
    await user.type(screen.getByLabelText(/Quantity purchased/), '10');
    await user.type(screen.getByLabelText(/Unit cost/), '25.5');
    // The modal's submit button (also labelled "Add lot").
    await user.click(screen.getByRole('dialog').querySelector('button[type="submit"]')! as HTMLElement);

    await waitFor(() => expect(createResourceLot).toHaveBeenCalledTimes(1));
    expect(createResourceLot).toHaveBeenCalledWith({
      resource_id: 'res-1',
      vendor_contact_id: 'vendor-1',
      qty_purchased: 10,
      unit_cost: 25.5,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Lot recorded.');
  });

  it('renders the error inline and keeps the modal open when createResource rejects', async () => {
    const user = userEvent.setup();
    createResource.mockRejectedValue(new Error('duplicate resource key'));

    renderWithRouter(<ResourcesPage />);
    await screen.findAllByText('Timothy Hay');

    await user.click(screen.getByRole('button', { name: 'New resource' }));
    await user.type(screen.getByLabelText(/Resource key/), 'hay.timothy');
    await user.type(screen.getByLabelText(/^Name/), 'Dup');
    await user.click(screen.getByRole('button', { name: 'Create resource' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('duplicate resource key');
    // Modal stayed open for correction.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('locks behind ModuleGate and fetches nothing when mod.barnops is off', async () => {
    barnopsOff();
    renderWithRouter(<ResourcesPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New resource' })).not.toBeInTheDocument();
    expect(listResources).not.toHaveBeenCalled();
  });
});
