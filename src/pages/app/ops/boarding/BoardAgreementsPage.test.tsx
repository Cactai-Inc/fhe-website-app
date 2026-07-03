// @vitest-environment jsdom
/**
 * OPS-BOARD-AGREEMENTS UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL BoardAgreementsPage over mocked api-boarding + lib/api
 * wrappers + a mocked useModules and proves the wiring:
 *   - listBoardAgreements() drives the table (horse, boarder, rate, status),
 *   - create: horse + boarder picked, rate LEFT BLANK → createBoardAgreement
 *     WITH EXACT ARGS incl. board_rate: null (so the wrapper OMITS the column
 *     and the registry default resolves),
 *   - status transition: 'Suspend' on an ACTIVE row → updateBoardAgreementStatus
 *     (id, 'SUSPENDED') and the row re-renders with the returned status,
 *   - a rejected create renders the error AND keeps the modal open,
 *   - mod.boarding OFF → ModuleGate lock, no data fns called.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';
import type { BoardAgreement, Stall } from '../../../../lib/ops/api-boarding';
import type { Contact, Horse } from '../../../../lib/ops/types';

const listBoardAgreements = vi.hoisted(() => vi.fn());
const createBoardAgreement = vi.hoisted(() => vi.fn());
const updateBoardAgreementStatus = vi.hoisted(() => vi.fn());
const listStalls = vi.hoisted(() => vi.fn());
const listContacts = vi.hoisted(() => vi.fn());
const listHorses = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-boarding', () => ({
  listBoardAgreements,
  createBoardAgreement,
  updateBoardAgreementStatus,
  listStalls,
}));
vi.mock('../../../../lib/api', () => ({ listContacts, listHorses }));
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { BoardAgreementsPage } from './BoardAgreementsPage';

function horse(over: Partial<Horse>): Horse {
  return {
    id: 'h-1',
    display_code: 'HOR-0001',
    registered_name: null,
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
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function contact(over: Partial<Contact>): Contact {
  return {
    id: 'c-1',
    display_code: 'CON-0001',
    first_name: 'Ada',
    last_name: 'Boarder',
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
    boarder: { id: 'c-1', first_name: 'Ada', last_name: 'Boarder' },
    stall: { id: 's-1', code: 'A1' },
    ...over,
  };
}

function boardingOn() {
  useModulesMock.mockReturnValue({ 'mod.boarding': true });
}

beforeEach(() => {
  vi.clearAllMocks();
  listBoardAgreements.mockResolvedValue([]);
  listHorses.mockResolvedValue([horse({ id: 'h-1', barn_name: 'Comet' })]);
  listContacts.mockResolvedValue([contact({ id: 'c-1', first_name: 'Ada', last_name: 'Boarder' })]);
  listStalls.mockResolvedValue([stall({ id: 's-1', code: 'A1' })]);
});

describe('OPS-BOARD-AGREEMENTS — BoardAgreementsPage', () => {
  it('renders agreements returned by listBoardAgreements()', async () => {
    boardingOn();
    listBoardAgreements.mockResolvedValue([
      agreement({ id: 'a-1', board_rate: 850 }),
      agreement({
        id: 'a-2',
        status: 'SUSPENDED',
        board_rate: 725,
        horse: { id: 'h-2', barn_name: 'Blaze', registered_name: null },
        boarder: { id: 'c-2', first_name: 'Ben', last_name: 'Payer' },
      }),
    ]);

    renderWithRouter(<BoardAgreementsPage />);

    expect(await screen.findByText('Comet')).toBeInTheDocument();
    expect(screen.getByText('Blaze')).toBeInTheDocument();
    expect(screen.getByText('Ada Boarder')).toBeInTheDocument();
    expect(screen.getByText('$850.00')).toBeInTheDocument();
    expect(screen.getByText('SUSPENDED')).toBeInTheDocument();
    expect(listBoardAgreements).toHaveBeenCalledTimes(1);
  });

  it('create with BLANK rate → createBoardAgreement with EXACT args (board_rate: null → registry default)', async () => {
    const user = userEvent.setup();
    boardingOn();
    createBoardAgreement.mockResolvedValue(agreement({ id: 'a-9', board_rate: 900 }));

    renderWithRouter(<BoardAgreementsPage />);
    await screen.findByText('No board agreements yet');

    await user.click(screen.getByRole('button', { name: 'New agreement' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/Horse/), 'h-1');
    await user.selectOptions(screen.getByLabelText(/Boarder/), 'c-1');
    await user.selectOptions(screen.getByLabelText(/Stall/), 's-1');
    await user.click(screen.getByRole('button', { name: 'Create agreement' }));

    expect(createBoardAgreement).toHaveBeenCalledTimes(1);
    expect(createBoardAgreement).toHaveBeenCalledWith({
      horse_id: 'h-1',
      boarder_contact_id: 'c-1',
      stall_id: 's-1',
      board_rate: null,
      board_type: null,
      start_date: null,
      end_date: null,
    });

    // Success: the created row (with the DB-resolved default rate) renders + toast.
    expect(await screen.findByText('$900.00')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Board agreement created.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("'Suspend' on an ACTIVE row → updateBoardAgreementStatus(id, 'SUSPENDED') + row re-renders", async () => {
    const user = userEvent.setup();
    boardingOn();
    listBoardAgreements.mockResolvedValue([agreement({ id: 'a-1', status: 'ACTIVE' })]);
    updateBoardAgreementStatus.mockResolvedValue(agreement({ id: 'a-1', status: 'SUSPENDED' }));

    renderWithRouter(<BoardAgreementsPage />);
    await screen.findByText('Comet');

    await user.click(screen.getByRole('button', { name: 'Suspend' }));

    expect(updateBoardAgreementStatus).toHaveBeenCalledTimes(1);
    expect(updateBoardAgreementStatus).toHaveBeenCalledWith('a-1', 'SUSPENDED');

    expect(await screen.findByText('SUSPENDED')).toBeInTheDocument();
    // A suspended agreement can reactivate; a fresh 'Suspend' is gone.
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend' })).toBeNull();
  });

  it('rejected create → error renders and the modal STAYS open', async () => {
    const user = userEvent.setup();
    boardingOn();
    createBoardAgreement.mockRejectedValue(new Error('rls denied'));

    renderWithRouter(<BoardAgreementsPage />);
    await screen.findByText('No board agreements yet');

    await user.click(screen.getByRole('button', { name: 'New agreement' }));
    await user.selectOptions(screen.getByLabelText(/Horse/), 'h-1');
    await user.selectOptions(screen.getByLabelText(/Boarder/), 'c-1');
    await user.click(screen.getByRole('button', { name: 'Create agreement' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(createBoardAgreement).toHaveBeenCalledTimes(1);
  });

  it('mod.boarding OFF → ModuleGate lock, no data fns called', () => {
    useModulesMock.mockReturnValue({ 'mod.boarding': false });

    renderWithRouter(<BoardAgreementsPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New agreement' })).toBeNull();
    expect(listBoardAgreements).not.toHaveBeenCalled();
    expect(listHorses).not.toHaveBeenCalled();
    expect(listContacts).not.toHaveBeenCalled();
    expect(listStalls).not.toHaveBeenCalled();
  });
});
