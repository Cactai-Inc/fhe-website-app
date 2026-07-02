// @vitest-environment jsdom
/**
 * OPS-REC-PARTIES UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL HorsePartiesPage over a mocked api-records layer + mocked
 * useModules and proves the wiring:
 *   - listHorseParties(':horseId') drives the table (exact-arg fetch → render,
 *     contact names resolved via listRecordContacts),
 *   - the ≠100% share-total warning renders (and is absent at exactly 100%),
 *   - 'Add party' → PartyForm submit calls createHorseParty WITH EXACT payload,
 *     refreshes the list and closes the modal,
 *   - a row click → edit mode calls updateHorseParty(id, exact patch),
 *   - the row 'Archive' action calls archiveHorseParty(id) (soft delete),
 *   - a rejected create renders the error AND keeps the modal open,
 *   - mod.horserecords OFF → ModuleGate lock, no data fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';
import type { Contact } from '../../../../lib/ops/types';
import type { HorseParty, HorseRecord } from '../../../../lib/ops/api-records';

const listHorseParties = vi.hoisted(() => vi.fn());
const createHorseParty = vi.hoisted(() => vi.fn());
const updateHorseParty = vi.hoisted(() => vi.fn());
const archiveHorseParty = vi.hoisted(() => vi.fn());
const getRecordHorse = vi.hoisted(() => vi.fn());
const listRecordContacts = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-records', () => ({
  listHorseParties,
  createHorseParty,
  updateHorseParty,
  archiveHorseParty,
  getRecordHorse,
  listRecordContacts,
  HORSE_PARTY_ROLES: ['owner', 'lessee', 'trainer', 'caretaker', 'boarder'],
}));

vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { HorsePartiesPage } from './HorsePartiesPage';

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
    vet_name: null,
    vet_phone: null,
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
    full_name: 'Ada Rider',
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

function party(over: Partial<HorseParty>): HorseParty {
  return {
    id: 'p-1',
    org_id: 'org-1',
    horse_id: 'h-1',
    contact_id: 'c-1',
    role: 'owner',
    share_pct: null,
    effective_from: null,
    effective_to: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...over,
  };
}

function renderPage() {
  return renderWithRouter(<HorsePartiesPage />, {
    route: '/app/ops/records/horses/h-1/parties',
    path: '/app/ops/records/horses/:horseId/parties',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  useModulesMock.mockReturnValue(RECORDS_ON);
  getRecordHorse.mockResolvedValue(horse());
  listRecordContacts.mockResolvedValue([
    contact({ id: 'c-1', full_name: 'Ada Rider' }),
    contact({ id: 'c-2', full_name: 'Ben Trainer' }),
  ]);
});

describe('OPS-REC-PARTIES — HorsePartiesPage', () => {
  it('fetches the parties for :horseId and renders them with resolved contact names', async () => {
    listHorseParties.mockResolvedValue([
      party({ id: 'p-1', contact_id: 'c-1', role: 'owner', share_pct: 100 }),
      party({ id: 'p-2', contact_id: 'c-2', role: 'trainer' }),
    ]);

    renderPage();

    expect(await screen.findByText('Ada Rider')).toBeInTheDocument();
    expect(screen.getByText('Ben Trainer')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(listHorseParties).toHaveBeenCalledWith('h-1');
    expect(getRecordHorse).toHaveBeenCalledWith('h-1');
    // Shares sum to exactly 100 → NO sanity warning.
    expect(screen.queryByTestId('share-warning-owner')).not.toBeInTheDocument();
  });

  it('surfaces the share-total sanity warning when current owner shares ≠ 100%', async () => {
    listHorseParties.mockResolvedValue([
      party({ id: 'p-1', contact_id: 'c-1', role: 'owner', share_pct: 60 }),
    ]);

    renderPage();

    const warning = await screen.findByTestId('share-warning-owner');
    expect(warning).toHaveTextContent('owner shares total 60% — expected 100%.');
  });

  it("'Add party' → submit calls createHorseParty with the EXACT payload, refreshes, closes", async () => {
    const user = userEvent.setup();
    listHorseParties
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        party({ id: 'p-9', contact_id: 'c-2', role: 'lessee', share_pct: 50 }),
      ]);
    createHorseParty.mockResolvedValue(party({ id: 'p-9' }));

    renderPage();
    expect(await screen.findByText('No parties yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add party' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Contact/), 'c-2');
    await user.selectOptions(screen.getByLabelText(/Role/), 'lessee');
    await user.type(screen.getByLabelText(/Share %/), '50');
    await user.click(screen.getByRole('button', { name: 'Create party' }));

    expect(createHorseParty).toHaveBeenCalledTimes(1);
    expect(createHorseParty).toHaveBeenCalledWith({
      horse_id: 'h-1',
      contact_id: 'c-2',
      role: 'lessee',
      share_pct: 50,
      effective_from: null,
      effective_to: null,
      notes: null,
    });

    // Success: refresh (second listHorseParties), new row rendered, modal closed.
    expect(await screen.findByText('Ben Trainer')).toBeInTheDocument();
    expect(listHorseParties).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('status')).toHaveTextContent('Party added.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('row click → edit mode calls updateHorseParty(id, patch)', async () => {
    const user = userEvent.setup();
    const existing = party({ id: 'p-1', contact_id: 'c-1', role: 'owner', share_pct: 100 });
    listHorseParties.mockResolvedValue([existing]);
    updateHorseParty.mockResolvedValue({ ...existing, role: 'boarder' });

    renderPage();

    await user.click(await screen.findByText('Ada Rider'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Role/), 'boarder');
    await user.click(screen.getByRole('button', { name: 'Save party' }));

    expect(updateHorseParty).toHaveBeenCalledTimes(1);
    expect(updateHorseParty).toHaveBeenCalledWith('p-1', {
      horse_id: 'h-1',
      contact_id: 'c-1',
      role: 'boarder',
      share_pct: 100,
      effective_from: null,
      effective_to: null,
      notes: null,
    });
    expect(createHorseParty).not.toHaveBeenCalled();
  });

  it("the row 'Archive' action soft-deletes via archiveHorseParty(id)", async () => {
    const user = userEvent.setup();
    listHorseParties
      .mockResolvedValueOnce([party({ id: 'p-1', contact_id: 'c-1' })])
      .mockResolvedValueOnce([]);
    archiveHorseParty.mockResolvedValue(party({ id: 'p-1', deleted_at: '2026-07-01T00:00:00Z' }));

    renderPage();
    await screen.findByText('Ada Rider');

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    expect(archiveHorseParty).toHaveBeenCalledWith('p-1');
    expect(await screen.findByText('No parties yet')).toBeInTheDocument();
  });

  it('renders the error branch and KEEPS the modal open when createHorseParty rejects', async () => {
    const user = userEvent.setup();
    listHorseParties.mockResolvedValue([]);
    createHorseParty.mockRejectedValue(new Error('share exceeds 100'));

    renderPage();
    await screen.findByText('No parties yet');

    await user.click(screen.getByRole('button', { name: 'Add party' }));
    await user.selectOptions(screen.getByLabelText(/Contact/), 'c-1');
    await user.click(screen.getByRole('button', { name: 'Create party' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('share exceeds 100');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(createHorseParty).toHaveBeenCalledTimes(1);
  });

  it('locks behind ModuleGate when mod.horserecords is OFF (no fetch)', async () => {
    useModulesMock.mockReturnValue(RECORDS_OFF);

    renderPage();

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add party' })).not.toBeInTheDocument();
    expect(listHorseParties).not.toHaveBeenCalled();
    expect(getRecordHorse).not.toHaveBeenCalled();
  });
});
