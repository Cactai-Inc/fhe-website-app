// @vitest-environment jsdom
/**
 * OPS-REC-HUB UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL RecordsHubPage over a mocked api-records layer + mocked
 * useModules and proves the wiring:
 *   - listRecordHorses() drives the roster (real fetch → real render,
 *     including the vet/farrier columns),
 *   - every row carries REAL links into the two record surfaces
 *     (…/parties and …/health for that horse id) — no dead tiles,
 *   - a rejected load renders the inline error branch,
 *   - mod.horserecords OFF → ModuleGate lock, no data fetch.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen } from '../../../../test/render';
import type { HorseRecord } from '../../../../lib/ops/api-records';

const listRecordHorses = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-records', () => ({ listRecordHorses }));
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { RecordsHubPage } from './RecordsHubPage';

function horse(over: Partial<HorseRecord> = {}): HorseRecord {
  return {
    id: 'h-1',
    display_code: 'HOR-0001',
    registered_name: 'Comet Star',
    barn_name: 'Comet',
    breed: 'Hanoverian',
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
    vet_phone: null,
    farrier_name: 'Fern Farrier',
    farrier_phone: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useModulesMock.mockReturnValue({ 'mod.horserecords': true });
});

describe('OPS-REC-HUB — RecordsHubPage', () => {
  it('renders the roster from listRecordHorses() with per-horse record links', async () => {
    listRecordHorses.mockResolvedValue([
      horse({ id: 'h-1', barn_name: 'Comet' }),
      horse({ id: 'h-2', barn_name: 'Star', vet_name: null, farrier_name: null }),
    ]);

    renderWithRouter(<RecordsHubPage />);

    expect(await screen.findByText('Comet')).toBeInTheDocument();
    expect(screen.getByText('Star')).toBeInTheDocument();
    expect(screen.getByText('Dr. Vetta')).toBeInTheDocument();
    expect(screen.getByText('Fern Farrier')).toBeInTheDocument();
    expect(listRecordHorses).toHaveBeenCalledTimes(1);

    // Real navigation targets per horse — no dead links.
    const ownership = screen.getAllByRole('link', { name: 'Ownership' });
    const health = screen.getAllByRole('link', { name: 'Health' });
    expect(ownership[0]).toHaveAttribute('href', '/app/ops/records/horses/h-1/parties');
    expect(ownership[1]).toHaveAttribute('href', '/app/ops/records/horses/h-2/parties');
    expect(health[0]).toHaveAttribute('href', '/app/ops/records/horses/h-1/health');
    expect(health[1]).toHaveAttribute('href', '/app/ops/records/horses/h-2/health');
  });

  it('renders the inline error branch when listRecordHorses rejects', async () => {
    listRecordHorses.mockRejectedValue(new Error('boom'));

    renderWithRouter(<RecordsHubPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('boom');
  });

  it('locks behind ModuleGate when mod.horserecords is OFF (no fetch)', () => {
    useModulesMock.mockReturnValue({ 'mod.horserecords': false });

    renderWithRouter(<RecordsHubPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByText('No horses yet')).not.toBeInTheDocument();
    expect(listRecordHorses).not.toHaveBeenCalled();
  });
});
