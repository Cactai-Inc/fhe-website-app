// @vitest-environment jsdom
/**
 * OPS-REC-HEALTH UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL HorseHealthPage over a mocked api-records layer + mocked
 * useModules and proves the wiring:
 *   - getRecordHorse/listHealthEvents(':horseId') drive the care-team section
 *     and the health-log table (exact-arg fetch → real render),
 *   - 'Edit care team' → submit calls updateHorseCareTeam(horseId, EXACT
 *     4-column patch) and re-renders the returned row,
 *   - 'Log event' → submit calls createHealthEvent WITH EXACT payload and
 *     refreshes the log,
 *   - a rejected createHealthEvent renders the error AND keeps the modal open,
 *   - mod.horserecords OFF → ModuleGate lock, no data fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';
import type { Contact } from '../../../../lib/ops/types';
import type { HorseHealthEvent, HorseRecord } from '../../../../lib/ops/api-records';

const getRecordHorse = vi.hoisted(() => vi.fn());
const listHealthEvents = vi.hoisted(() => vi.fn());
const createHealthEvent = vi.hoisted(() => vi.fn());
const updateHorseCareTeam = vi.hoisted(() => vi.fn());
const listRecordContacts = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-records', () => ({
  getRecordHorse,
  listHealthEvents,
  createHealthEvent,
  updateHorseCareTeam,
  listRecordContacts,
}));

vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { HorseHealthPage } from './HorseHealthPage';

const RECORDS_ON = { 'mod.horserecords': true };
const RECORDS_OFF = { 'mod.horserecords': false };

function horse(over: Partial<HorseRecord> = {}): HorseRecord {
  return {
    id: 'h-1',
    display_code: 'HOR-0001',
    registered_name: 'Comet Star',
    barn_name: 'Comet',
    breed: null,
    color: null,
    sex: null,
    date_of_birth: null,
    height: null,
    registration_number: null,
    microchip_id: null,
    current_location: null,
    current_owner_contact_id: null,
    notes: null,
    vet_name: 'Dr. Vetta',
    vet_phone: '555-0101',
    farrier_name: null,
    farrier_phone: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function contact(over: Partial<Contact>): Contact {
  return {
    id: 'c-1',
    display_code: 'CON-0001',
    full_name: 'Dr. Vetta',
    first_name: null,
    last_name: null,
    email: null,
    phone: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    country: null,
    address_composed: null,
    date_of_birth: null,
    tags: [],
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function event(over: Partial<HorseHealthEvent>): HorseHealthEvent {
  return {
    id: 'ev-1',
    org_id: 'org-1',
    horse_id: 'h-1',
    event_type: 'vet_visit',
    occurred_at: '2026-06-15T00:00:00Z',
    provider_contact_id: null,
    next_due: null,
    notes: null,
    document_id: null,
    created_at: '2026-06-15T00:00:00Z',
    updated_at: '2026-06-15T00:00:00Z',
    deleted_at: null,
    ...over,
  };
}

function renderPage() {
  return renderWithRouter(<HorseHealthPage />, {
    route: '/app/ops/records/horses/h-1/health',
    path: '/app/ops/records/horses/:horseId/health',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useModulesMock.mockReturnValue(RECORDS_ON);
  getRecordHorse.mockResolvedValue(horse());
  listHealthEvents.mockResolvedValue([]);
  listRecordContacts.mockResolvedValue([contact({ id: 'c-1', full_name: 'Dr. Vetta' })]);
});

describe('OPS-REC-HEALTH — HorseHealthPage', () => {
  it('fetches the horse + events for :horseId and renders care team + log', async () => {
    listHealthEvents.mockResolvedValue([
      event({ id: 'ev-1', event_type: 'vaccination', occurred_at: '2026-06-15T00:00:00Z', next_due: '2026-12-15' }),
      event({ id: 'ev-2', event_type: 'farrier', provider_contact_id: 'c-1' }),
    ]);

    renderPage();

    // Care team from the horses vet/farrier columns.
    expect(await screen.findByTestId('care-vet')).toHaveTextContent('Dr. Vetta · 555-0101');
    expect(screen.getByTestId('care-farrier')).toHaveTextContent('—');

    // Health log rows with the provider name resolved.
    expect(screen.getByText('vaccination')).toBeInTheDocument();
    expect(screen.getByText('2026-12-15')).toBeInTheDocument();
    expect(screen.getByText('farrier')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Dr. Vetta' })).toBeInTheDocument();

    expect(getRecordHorse).toHaveBeenCalledWith('h-1');
    expect(listHealthEvents).toHaveBeenCalledWith('h-1');
  });

  it("'Edit care team' → submit calls updateHorseCareTeam with the EXACT 4-column patch and re-renders", async () => {
    const user = userEvent.setup();
    updateHorseCareTeam.mockResolvedValue(
      horse({ vet_name: 'Dr. New', vet_phone: '555-0202', farrier_name: 'Fern Farrier', farrier_phone: null }),
    );

    renderPage();
    await screen.findByTestId('care-vet');

    await user.click(screen.getByRole('button', { name: 'Edit care team' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    const vetName = screen.getByLabelText('Vet name');
    await user.clear(vetName);
    await user.type(vetName, 'Dr. New');
    const vetPhone = screen.getByLabelText('Vet phone');
    await user.clear(vetPhone);
    await user.type(vetPhone, '555-0202');
    await user.type(screen.getByLabelText('Farrier name'), 'Fern Farrier');

    await user.click(screen.getByRole('button', { name: 'Save care team' }));

    expect(updateHorseCareTeam).toHaveBeenCalledTimes(1);
    expect(updateHorseCareTeam).toHaveBeenCalledWith('h-1', {
      vet_name: 'Dr. New',
      vet_phone: '555-0202',
      farrier_name: 'Fern Farrier',
      farrier_phone: null,
    });

    // The returned row re-renders the section; toast + modal close.
    expect(await screen.findByTestId('care-vet')).toHaveTextContent('Dr. New · 555-0202');
    expect(screen.getByTestId('care-farrier')).toHaveTextContent('Fern Farrier');
    expect(screen.getByRole('status')).toHaveTextContent('Care team updated.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("'Log event' → submit calls createHealthEvent with the EXACT payload and refreshes the log", async () => {
    const user = userEvent.setup();
    listHealthEvents
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([event({ id: 'ev-9', event_type: 'deworming' })]);
    createHealthEvent.mockResolvedValue(event({ id: 'ev-9', event_type: 'deworming' }));

    renderPage();
    expect(await screen.findByText('No health events yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log event' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Event type/), 'deworming');
    await user.selectOptions(screen.getByLabelText(/Provider/), 'c-1');
    await user.type(screen.getByLabelText('Notes'), 'Spring rotation');

    await user.click(screen.getByRole('button', { name: 'Save event' }));

    const todayIso = new Date().toISOString().slice(0, 10);
    expect(createHealthEvent).toHaveBeenCalledTimes(1);
    expect(createHealthEvent).toHaveBeenCalledWith({
      horse_id: 'h-1',
      event_type: 'deworming',
      occurred_at: new Date(`${todayIso}T00:00:00Z`).toISOString(),
      provider_contact_id: 'c-1',
      next_due: null,
      notes: 'Spring rotation',
    });

    // Success: refresh (second listHealthEvents), new row rendered, modal closed.
    expect(await screen.findByText('deworming')).toBeInTheDocument();
    expect(listHealthEvents).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('Health event logged.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('renders the error branch and KEEPS the modal open when createHealthEvent rejects', async () => {
    const user = userEvent.setup();
    createHealthEvent.mockRejectedValue(new Error('module disabled'));

    renderPage();
    await screen.findByText('No health events yet');

    await user.click(screen.getByRole('button', { name: 'Log event' }));
    await user.click(screen.getByRole('button', { name: 'Save event' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('module disabled');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(createHealthEvent).toHaveBeenCalledTimes(1);
  });

  it('locks behind ModuleGate when mod.horserecords is OFF (no fetch)', async () => {
    useModulesMock.mockReturnValue(RECORDS_OFF);

    renderPage();

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Log event' })).not.toBeInTheDocument();
    expect(getRecordHorse).not.toHaveBeenCalled();
    expect(listHealthEvents).not.toHaveBeenCalled();
  });
});
