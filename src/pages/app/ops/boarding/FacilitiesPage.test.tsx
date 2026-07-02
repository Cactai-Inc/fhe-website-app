// @vitest-environment jsdom
/**
 * OPS-BOARD-FACILITIES UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL FacilitiesPage over the mocked api-boarding wrappers + a
 * mocked useModules and proves the wiring:
 *   - listFacilities()/listStalls() drive both tables (real fetch → render),
 *   - 'New facility' submit calls createFacility WITH EXACT ARGS; success →
 *     row appears + toast,
 *   - 'New stall' submit calls createStall WITH EXACT ARGS,
 *   - a rejected createFacility renders the error AND keeps the modal open,
 *   - mod.boarding OFF → ModuleGate lock, no data fns called.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';
import type { Facility, Stall } from '../../../../lib/ops/api-boarding';

const listFacilities = vi.hoisted(() => vi.fn());
const createFacility = vi.hoisted(() => vi.fn());
const updateFacility = vi.hoisted(() => vi.fn());
const listStalls = vi.hoisted(() => vi.fn());
const createStall = vi.hoisted(() => vi.fn());
const updateStall = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-boarding', () => ({
  listFacilities,
  createFacility,
  updateFacility,
  listStalls,
  createStall,
  updateStall,
}));
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { FacilitiesPage } from './FacilitiesPage';

function facility(over: Partial<Facility>): Facility {
  return {
    id: 'f-1',
    org_id: 'org-1',
    name: 'Main Barn',
    address_value_key: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function stall(over: Partial<Stall>): Stall {
  return {
    id: 's-1',
    org_id: 'org-1',
    facility_id: 'f-1',
    code: 'A1',
    stall_type: null,
    active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    facility: { id: 'f-1', name: 'Main Barn' },
    ...over,
  };
}

function boardingOn() {
  useModulesMock.mockReturnValue({ 'mod.boarding': true });
}

beforeEach(() => {
  vi.clearAllMocks();
  listFacilities.mockResolvedValue([]);
  listStalls.mockResolvedValue([]);
});

describe('OPS-BOARD-FACILITIES — FacilitiesPage', () => {
  it('renders facilities and stalls returned by the list fns', async () => {
    boardingOn();
    listFacilities.mockResolvedValue([
      facility({ id: 'f-1', name: 'Main Barn' }),
      facility({ id: 'f-2', name: 'North Paddocks' }),
    ]);
    listStalls.mockResolvedValue([stall({ id: 's-1', code: 'A1', stall_type: '12x12' })]);

    renderWithRouter(<FacilitiesPage />);

    expect(await screen.findByText('North Paddocks')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('12x12')).toBeInTheDocument();
    expect(listFacilities).toHaveBeenCalledTimes(1);
    expect(listStalls).toHaveBeenCalledTimes(1);
  });

  it('create facility → createFacility with EXACT args + row appears + toast', async () => {
    const user = userEvent.setup();
    boardingOn();
    createFacility.mockResolvedValue(facility({ id: 'f-9', name: 'South Barn' }));

    renderWithRouter(<FacilitiesPage />);
    expect(await screen.findByText('No facilities yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New facility' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^Name/), 'South Barn');
    await user.type(screen.getByLabelText(/Address registry key/), 'CONTACT/ADDRESS.SOUTH');
    await user.click(screen.getByRole('button', { name: 'Create facility' }));

    expect(createFacility).toHaveBeenCalledTimes(1);
    expect(createFacility).toHaveBeenCalledWith({
      name: 'South Barn',
      address_value_key: 'CONTACT/ADDRESS.SOUTH',
    });

    expect(await screen.findByText('South Barn')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Facility created.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('create stall → createStall with EXACT args (facility_id from the picker)', async () => {
    const user = userEvent.setup();
    boardingOn();
    listFacilities.mockResolvedValue([facility({ id: 'f-1', name: 'Main Barn' })]);
    createStall.mockResolvedValue(stall({ id: 's-9', code: 'B4' }));

    renderWithRouter(<FacilitiesPage />);
    expect(await screen.findByText('Main Barn')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New stall' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Facility/), 'f-1');
    await user.type(screen.getByLabelText(/Code/), 'B4');
    await user.click(screen.getByRole('button', { name: 'Create stall' }));

    expect(createStall).toHaveBeenCalledTimes(1);
    expect(createStall).toHaveBeenCalledWith({
      facility_id: 'f-1',
      code: 'B4',
      stall_type: null,
      active: true,
    });
    expect(await screen.findByText('B4')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Stall created.');
  });

  it('rejected createFacility → error renders and the modal STAYS open', async () => {
    const user = userEvent.setup();
    boardingOn();
    createFacility.mockRejectedValue(new Error('rls denied'));

    renderWithRouter(<FacilitiesPage />);
    await screen.findByText('No facilities yet');

    await user.click(screen.getByRole('button', { name: 'New facility' }));
    await user.type(screen.getByLabelText(/^Name/), 'South Barn');
    await user.click(screen.getByRole('button', { name: 'Create facility' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(createFacility).toHaveBeenCalledTimes(1);
  });

  it('mod.boarding OFF → ModuleGate lock, no data fns called', () => {
    useModulesMock.mockReturnValue({ 'mod.boarding': false });

    renderWithRouter(<FacilitiesPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New facility' })).toBeNull();
    expect(listFacilities).not.toHaveBeenCalled();
    expect(listStalls).not.toHaveBeenCalled();
  });
});
