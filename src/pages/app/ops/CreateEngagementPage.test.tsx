// @vitest-environment jsdom
/**
 * OPS-ENG-CREATE UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL CreateEngagementPage over mocked api wrappers + a mocked
 * useModules and proves the wiring:
 *   (a) brokerage ON → pick a type, fill the form, submit → the correct rpc
 *       wrapper is called WITH EXACT p-shaped-input args, and a success
 *       navigates to /app/ops/engagements/<returned id>. Repeated for search +
 *       lease, asserting each form is wired to ITS OWN wrapper (no cross-wiring).
 *   (b) a rejected create renders the error inline and does NOT navigate.
 *   (c) brokerage OFF → ModuleGate lock, forms absent.
 *
 * Static dead-end audit is discharged by these assertions: each form's submit
 * really calls its own data fn with the assembled input, the returned id really
 * drives navigation, and the reject path really renders — no dead handler.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../test/render';
import type { Contact, Horse } from '../../../lib/ops/types';

const listContacts = vi.hoisted(() => vi.fn());
const listHorses = vi.hoisted(() => vi.fn());
const createPurchaseEngagement = vi.hoisted(() => vi.fn());
const createSearchEngagement = vi.hoisted(() => vi.fn());
const createLeaseEngagement = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/api', () => ({
  listContacts,
  listHorses,
  createPurchaseEngagement,
  createSearchEngagement,
  createLeaseEngagement,
}));

vi.mock('../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import { CreateEngagementPage } from './CreateEngagementPage';

function contact(over: Partial<Contact>): Contact {
  return {
    id: 'c-1',
    display_code: 'CON-0001',
    full_name: 'Ada Rider',
    first_name: 'Ada',
    last_name: 'Rider',
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

const CONTACTS = [
  contact({ id: 'buyer-1', full_name: 'Ada Buyer' }),
  contact({ id: 'seller-1', full_name: 'Ben Seller' }),
  contact({ id: 'client-1', full_name: 'Cara Client' }),
  contact({ id: 'cpty-1', full_name: 'Dana Counterparty' }),
];
const HORSES = [horse({ id: 'horse-1', barn_name: 'Comet' })];

function brokerageOn() {
  useModulesMock.mockReturnValue({ 'mod.brokerage': true, 'mod.lessons': true });
}
function brokerageOff() {
  useModulesMock.mockReturnValue({ 'mod.brokerage': false, 'mod.lessons': true });
}

beforeEach(() => {
  vi.clearAllMocks();
  listContacts.mockResolvedValue(CONTACTS);
  listHorses.mockResolvedValue(HORSES);
});

describe('OPS-ENG-CREATE — CreateEngagementPage', () => {
  it('(a) purchase: fills the form, submits → createPurchaseEngagement with EXACT args + navigates to the new id', async () => {
    const user = userEvent.setup();
    brokerageOn();
    createPurchaseEngagement.mockResolvedValue('eng-purchase-99');

    renderWithRouter(<CreateEngagementPage />, { route: '/app/ops/engagements/new' });

    // Contact/horse pickers reuse listContacts/listHorses.
    await waitFor(() => expect(listContacts).toHaveBeenCalledTimes(1));
    expect(listHorses).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTestId('eng-type-purchase'));

    await user.selectOptions(screen.getByLabelText(/Buyer/), 'buyer-1');
    await user.selectOptions(screen.getByLabelText(/Seller/), 'seller-1');
    await user.selectOptions(screen.getByLabelText(/Horse/), 'horse-1');
    await user.type(screen.getByLabelText(/Amount/), '50000');
    await user.type(screen.getByLabelText(/Deposit/), '5000');

    await user.click(screen.getByRole('button', { name: 'Create purchase engagement' }));

    expect(createPurchaseEngagement).toHaveBeenCalledTimes(1);
    expect(createPurchaseEngagement).toHaveBeenCalledWith({
      buyerContactId: 'buyer-1',
      sellerContactId: 'seller-1',
      horseId: 'horse-1',
      amount: 50000,
      deposit: 5000,
    });
    // No cross-wiring.
    expect(createSearchEngagement).not.toHaveBeenCalled();
    expect(createLeaseEngagement).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/app/ops/engagements/eng-purchase-99'),
    );
  });

  it('(a) search: minimal args → createSearchEngagement with EXACT args + navigates', async () => {
    const user = userEvent.setup();
    brokerageOn();
    createSearchEngagement.mockResolvedValue('eng-search-42');

    renderWithRouter(<CreateEngagementPage />, { route: '/app/ops/engagements/new' });
    await waitFor(() => expect(listContacts).toHaveBeenCalled());

    await user.click(screen.getByTestId('eng-type-search'));

    await user.selectOptions(screen.getByLabelText(/Client/), 'client-1');
    await user.selectOptions(screen.getByLabelText(/Deal side/), 'SELL');
    await user.selectOptions(screen.getByLabelText(/Retained by/), 'seller');

    await user.click(screen.getByRole('button', { name: 'Create search engagement' }));

    expect(createSearchEngagement).toHaveBeenCalledTimes(1);
    expect(createSearchEngagement).toHaveBeenCalledWith({
      clientContactId: 'client-1',
      retainedBy: 'seller',
      dealSide: 'SELL',
      horseId: null,
    });
    expect(createPurchaseEngagement).not.toHaveBeenCalled();
    expect(createLeaseEngagement).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/app/ops/engagements/eng-search-42'),
    );
  });

  it('(a) lease: minimal args → createLeaseEngagement with EXACT args + navigates', async () => {
    const user = userEvent.setup();
    brokerageOn();
    createLeaseEngagement.mockResolvedValue('eng-lease-7');

    renderWithRouter(<CreateEngagementPage />, { route: '/app/ops/engagements/new' });
    await waitFor(() => expect(listContacts).toHaveBeenCalled());

    await user.click(screen.getByTestId('eng-type-lease'));

    await user.selectOptions(screen.getByLabelText(/Client/), 'client-1');
    await user.selectOptions(screen.getByLabelText(/Deal side/), 'LEASE_OUT');
    await user.selectOptions(screen.getByLabelText(/Counterparty/), 'cpty-1');

    await user.click(screen.getByRole('button', { name: 'Create lease engagement' }));

    expect(createLeaseEngagement).toHaveBeenCalledTimes(1);
    expect(createLeaseEngagement).toHaveBeenCalledWith({
      clientContactId: 'client-1',
      dealSide: 'LEASE_OUT',
      counterpartyContactId: 'cpty-1',
      horseId: null,
    });
    expect(createPurchaseEngagement).not.toHaveBeenCalled();
    expect(createSearchEngagement).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/app/ops/engagements/eng-lease-7'),
    );
  });

  it('(b) rejected create → error branch renders inline and does NOT navigate', async () => {
    const user = userEvent.setup();
    brokerageOn();
    createPurchaseEngagement.mockRejectedValue(new Error('rls denied'));

    renderWithRouter(<CreateEngagementPage />, { route: '/app/ops/engagements/new' });
    await waitFor(() => expect(listContacts).toHaveBeenCalled());

    await user.click(screen.getByTestId('eng-type-purchase'));
    await user.selectOptions(screen.getByLabelText(/Buyer/), 'buyer-1');
    await user.click(screen.getByRole('button', { name: 'Create purchase engagement' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(navigateMock).not.toHaveBeenCalled();
    expect(createPurchaseEngagement).toHaveBeenCalledTimes(1);
  });

  it('(c) brokerage OFF → ModuleGate lock, no forms, no data fns called', async () => {
    brokerageOff();

    renderWithRouter(<CreateEngagementPage />, { route: '/app/ops/engagements/new' });

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    // Type picker + forms are all absent behind the lock.
    expect(screen.queryByTestId('eng-type-purchase')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Create purchase engagement' })).toBeNull();
    // Gated: no contact/horse fetch, no engagement rpc.
    expect(listContacts).not.toHaveBeenCalled();
    expect(listHorses).not.toHaveBeenCalled();
    expect(createPurchaseEngagement).not.toHaveBeenCalled();
  });
});
