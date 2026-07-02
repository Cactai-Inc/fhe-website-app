// @vitest-environment jsdom
/**
 * OPS-HORSES executable proof (PLATFORM_ARCHITECTURE.md §15).
 *
 * Renders the REAL HorsesPage over a mocked api layer and asserts:
 *   - the breed/color selects render options sourced from the lookup fns,
 *   - "New horse" -> HorseForm submit calls createHorse WITH THE CORRECT ARGS,
 *   - on success the returned row is rendered into the roster (no dropped data),
 *   - the create rejection path renders the error branch (errors not swallowed),
 *   - a row click opens edit mode and submit calls updateHorse(id, patch).
 *
 * Static dead-end audit: createHorse/updateHorse are actually invoked with the
 * assembled input; the selects are wired (chosen values land in the call args).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor, within } from '../../../test/render';
import type { Horse, LookupCode, Contact } from '../../../lib/ops/types';

// ── Mock the api layer the real page drives ──────────────────────────────────
const listHorses = vi.hoisted(() => vi.fn());
const createHorse = vi.hoisted(() => vi.fn());
const updateHorse = vi.hoisted(() => vi.fn());
const listHorseBreeds = vi.hoisted(() => vi.fn());
const listHorseColors = vi.hoisted(() => vi.fn());
const listContacts = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/api', () => ({
  listHorses,
  createHorse,
  updateHorse,
  listHorseBreeds,
  listHorseColors,
  listContacts,
}));

import HorsesPage from './HorsesPage';

const BREEDS: LookupCode[] = [
  { code: 'WARMBLOOD', display_name: 'Warmblood', active: true, sort_order: 1 },
  { code: 'THOROUGHBRED', display_name: 'Thoroughbred', active: true, sort_order: 2 },
];
const COLORS: LookupCode[] = [
  { code: 'BAY', display_name: 'Bay', active: true, sort_order: 1 },
  { code: 'CHESTNUT', display_name: 'Chestnut', active: true, sort_order: 2 },
];
const OWNERS: Contact[] = [
  {
    id: 'contact-1', display_code: 'C-1', full_name: 'Jane Rider', first_name: 'Jane',
    last_name: 'Rider', email: null, phone: null, address_line1: null, address_line2: null,
    city: null, state: null, postal_code: null, country: null, address_composed: null,
    date_of_birth: null, tags: [], notes: null, created_at: '', updated_at: '',
  },
];

function horse(overrides: Partial<Horse>): Horse {
  return {
    id: 'horse-1', display_code: 'H-1', registered_name: null, barn_name: 'Existing',
    breed: 'WARMBLOOD', color: 'BAY', sex: null, date_of_birth: null, height: null,
    registration_number: null, microchip_id: null, current_location: null,
    current_owner_contact_id: null, notes: null, created_at: '', updated_at: '',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listHorses.mockResolvedValue([]);
  listHorseBreeds.mockResolvedValue(BREEDS);
  listHorseColors.mockResolvedValue(COLORS);
  listContacts.mockResolvedValue(OWNERS);
});

describe('HorsesPage', () => {
  it('renders breed/color select options from the lookup fns and creates a horse with correct args', async () => {
    const user = userEvent.setup();
    createHorse.mockResolvedValue(
      horse({ id: 'horse-new', barn_name: 'Comet', breed: 'THOROUGHBRED', color: 'CHESTNUT' }),
    );

    renderWithRouter(<HorsesPage />);

    // roster loaded (empty state), lookups fetched
    await waitFor(() => expect(listHorseBreeds).toHaveBeenCalledTimes(1));
    expect(listHorseColors).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'New horse' }));

    // Selects render options sourced from the lookups.
    const breedSelect = screen.getByLabelText('Breed') as HTMLSelectElement;
    const colorSelect = screen.getByLabelText('Color') as HTMLSelectElement;
    expect(within(breedSelect).getByRole('option', { name: 'Warmblood' })).toBeInTheDocument();
    expect(within(breedSelect).getByRole('option', { name: 'Thoroughbred' })).toBeInTheDocument();
    expect(within(colorSelect).getByRole('option', { name: 'Bay' })).toBeInTheDocument();
    expect(within(colorSelect).getByRole('option', { name: 'Chestnut' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Barn name'), 'Comet');
    await user.selectOptions(breedSelect, 'THOROUGHBRED');
    await user.selectOptions(colorSelect, 'CHESTNUT');
    await user.selectOptions(screen.getByLabelText('Primary owner'), 'contact-1');
    await user.click(screen.getByRole('button', { name: 'Create horse' }));

    // The submit is wired: the real data fn ran with the assembled input.
    await waitFor(() => expect(createHorse).toHaveBeenCalledTimes(1));
    expect(createHorse).toHaveBeenCalledWith({
      barn_name: 'Comet',
      registered_name: null,
      breed: 'THOROUGHBRED',
      color: 'CHESTNUT',
      sex: null,
      current_owner_contact_id: 'contact-1',
    });

    // Success branch: the returned row is rendered into the roster.
    expect(await screen.findByText('Comet')).toBeInTheDocument();
    expect(screen.getByText('Thoroughbred')).toBeInTheDocument();
  });

  it('renders the error branch when createHorse rejects (errors not swallowed)', async () => {
    const user = userEvent.setup();
    createHorse.mockRejectedValue(new Error('duplicate horse'));

    renderWithRouter(<HorsesPage />);
    await waitFor(() => expect(listHorseBreeds).toHaveBeenCalled());

    await user.click(screen.getByRole('button', { name: 'New horse' }));
    await user.type(screen.getByLabelText('Barn name'), 'Comet');
    await user.click(screen.getByRole('button', { name: 'Create horse' }));

    await waitFor(() => expect(createHorse).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('duplicate horse');
  });

  it('opens edit mode on row click and submits updateHorse(id, patch)', async () => {
    const user = userEvent.setup();
    listHorses.mockResolvedValue([horse({ id: 'horse-1', barn_name: 'Existing' })]);
    updateHorse.mockResolvedValue(horse({ id: 'horse-1', barn_name: 'Renamed' }));

    renderWithRouter(<HorsesPage />);

    const row = await screen.findByText('Existing');
    await user.click(row);

    // Edit form pre-fills the barn name; change it and save.
    const barnInput = screen.getByLabelText('Barn name') as HTMLInputElement;
    expect(barnInput.value).toBe('Existing');
    await user.clear(barnInput);
    await user.type(barnInput, 'Renamed');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(updateHorse).toHaveBeenCalledTimes(1));
    expect(updateHorse).toHaveBeenCalledWith(
      'horse-1',
      expect.objectContaining({ barn_name: 'Renamed' }),
    );
    expect(await screen.findByText('Renamed')).toBeInTheDocument();
  });
});
