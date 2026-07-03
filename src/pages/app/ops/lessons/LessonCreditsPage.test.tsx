// @vitest-environment jsdom
/**
 * OPS-LESSON-CREDITS UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL LessonCreditsPage over the mocked api-lessons layer + a
 * mocked useModules and proves the wiring:
 *   - listLessonCredits()/listLessonClients()/listLessonPackages() drive the
 *     ledger (client NAMES resolved) + the outstanding-balance sum,
 *   - the client filter re-queries listLessonCredits WITH the exact client_id,
 *   - 'Grant credits' → pick client + package (credits pre-fill) → submit →
 *     createLessonCredit with the EXACT insert shape,
 *   - 'Use 1 credit' row action → consumeLessonCredit(row.id) and the updated
 *     remaining renders,
 *   - the error branch (grant rejects) renders inline AND keeps the modal open,
 *   - mod.lessons OFF → ModuleGate lock, no fetch fires.
 * Real-path DB behavior lives in test/db/mod_lessons.test.ts — this is UI
 * wiring proof only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor, within } from '../../../../test/render';
import type { LessonCredit, LessonClientOption, LessonPackage } from '../../../../lib/ops/api-lessons';

const listLessonCredits = vi.hoisted(() => vi.fn());
const createLessonCredit = vi.hoisted(() => vi.fn());
const consumeLessonCredit = vi.hoisted(() => vi.fn());
const listLessonClients = vi.hoisted(() => vi.fn());
const listLessonPackages = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-lessons', () => ({
  listLessonCredits,
  createLessonCredit,
  consumeLessonCredit,
  listLessonClients,
  listLessonPackages,
}));
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { LessonCreditsPage } from './LessonCreditsPage';

function credit(over: Partial<LessonCredit>): LessonCredit {
  return {
    id: 'cr-1',
    org_id: 'org-1',
    client_id: 'cl-1',
    package_key: 'pkg.10',
    credits_total: 10,
    credits_remaining: 7,
    purchased_at: '2026-06-10T00:00:00Z',
    created_at: '2026-06-10T00:00:00Z',
    updated_at: '2026-06-10T00:00:00Z',
    ...over,
  };
}

const CLIENTS: LessonClientOption[] = [
  { id: 'cl-1', display_code: 'CLI-0001', name: 'Ada Rider', email: 'ada@barn.test' },
  { id: 'cl-2', display_code: 'CLI-0002', name: 'Ben Jumper', email: null },
];

const PACKAGES: LessonPackage[] = [
  {
    id: 'pkg-1',
    org_id: 'org-1',
    package_key: 'pkg.10',
    name: '10-Lesson Pack',
    price_value_key: 'PKG_10_PRICE',
    credits: 10,
    active: true,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  },
];

function lessonsOn() {
  useModulesMock.mockReturnValue({ 'mod.lessons': true });
}
function lessonsOff() {
  useModulesMock.mockReturnValue({ 'mod.lessons': false });
}

beforeEach(() => {
  vi.clearAllMocks();
  listLessonClients.mockResolvedValue(CLIENTS);
  listLessonPackages.mockResolvedValue(PACKAGES);
});

describe('OPS-LESSON-CREDITS — LessonCreditsPage', () => {
  it('renders the ledger with client names + the outstanding sum', async () => {
    lessonsOn();
    listLessonCredits.mockResolvedValue([
      credit({ id: 'cr-1', client_id: 'cl-1', credits_remaining: 7 }),
      credit({ id: 'cr-2', client_id: 'cl-2', credits_remaining: 3, package_key: null }),
    ]);

    renderWithRouter(<LessonCreditsPage />);

    // Names resolved in the LEDGER cells (the filter options also carry names,
    // so scope to the table).
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Ada Rider')).toBeInTheDocument();
    expect(within(table).getByText('Ben Jumper')).toBeInTheDocument();
    // Outstanding = 7 + 3.
    expect(screen.getByTestId('credits-outstanding')).toHaveTextContent('10');
    // Initial ledger query is unscoped.
    expect(listLessonCredits).toHaveBeenCalledTimes(1);
    expect(listLessonCredits).toHaveBeenCalledWith();
  });

  it('client filter re-queries listLessonCredits WITH the exact client_id', async () => {
    const user = userEvent.setup();
    lessonsOn();
    listLessonCredits
      .mockResolvedValueOnce([
        credit({ id: 'cr-1', client_id: 'cl-1', credits_remaining: 7 }),
        credit({ id: 'cr-2', client_id: 'cl-2', credits_remaining: 3 }),
      ])
      .mockResolvedValueOnce([credit({ id: 'cr-2', client_id: 'cl-2', credits_remaining: 3 })]);

    renderWithRouter(<LessonCreditsPage />);
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Ada Rider')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Client'), 'cl-2');

    await waitFor(() => expect(listLessonCredits).toHaveBeenCalledTimes(2));
    expect(listLessonCredits).toHaveBeenLastCalledWith('cl-2');
    // The filtered ledger renders (Ada's row gone) and outstanding re-sums.
    await waitFor(() =>
      expect(within(screen.getByRole('table')).queryByText('Ada Rider')).toBeNull(),
    );
    expect(within(screen.getByRole('table')).getByText('Ben Jumper')).toBeInTheDocument();
    expect(screen.getByTestId('credits-outstanding')).toHaveTextContent('3');
  });

  it('grants: pick client + package (credits pre-fill) → createLessonCredit with EXACT insert shape', async () => {
    const user = userEvent.setup();
    lessonsOn();
    listLessonCredits.mockResolvedValue([]);
    createLessonCredit.mockResolvedValue(
      credit({ id: 'cr-9', client_id: 'cl-2', credits_total: 10, credits_remaining: 10 }),
    );

    renderWithRouter(<LessonCreditsPage />);
    expect(await screen.findByText('No lesson credits yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Grant credits' }));
    const dialog = await screen.findByRole('dialog');

    await user.selectOptions(within(dialog).getByLabelText(/Client/), 'cl-2');
    await user.selectOptions(within(dialog).getByLabelText(/Package/), 'pkg.10');
    // Picking the pack pre-filled its credit count.
    expect(within(dialog).getByLabelText(/Credits/)).toHaveValue(10);

    await user.click(within(dialog).getByRole('button', { name: 'Grant credits' }));

    expect(createLessonCredit).toHaveBeenCalledTimes(1);
    expect(createLessonCredit).toHaveBeenCalledWith({
      client_id: 'cl-2',
      package_key: 'pkg.10',
      credits_total: 10,
    });

    // Success: the grant lands on the ledger, toast shows, modal closes.
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Ben Jumper')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Credits granted.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it("'Use 1 credit' → consumeLessonCredit(row.id) and the updated remaining renders", async () => {
    const user = userEvent.setup();
    lessonsOn();
    listLessonCredits.mockResolvedValue([credit({ id: 'cr-1', credits_remaining: 7 })]);
    consumeLessonCredit.mockResolvedValue(credit({ id: 'cr-1', credits_remaining: 6 }));

    renderWithRouter(<LessonCreditsPage />);
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Use 1 credit' }));

    expect(consumeLessonCredit).toHaveBeenCalledTimes(1);
    expect(consumeLessonCredit).toHaveBeenCalledWith('cr-1');
    expect(await screen.findByRole('status')).toHaveTextContent('1 credit used — 6 remaining.');
    expect(screen.getByTestId('credits-outstanding')).toHaveTextContent('6');
  });

  it('renders the error branch and KEEPS the modal open when createLessonCredit rejects', async () => {
    const user = userEvent.setup();
    lessonsOn();
    listLessonCredits.mockResolvedValue([]);
    createLessonCredit.mockRejectedValue(new Error('rls denied'));

    renderWithRouter(<LessonCreditsPage />);
    await screen.findByText('No lesson credits yet');

    await user.click(screen.getByRole('button', { name: 'Grant credits' }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(within(dialog).getByLabelText(/Client/), 'cl-1');
    await user.type(within(dialog).getByLabelText(/Credits/), '5');
    await user.click(within(dialog).getByRole('button', { name: 'Grant credits' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(createLessonCredit).toHaveBeenCalledTimes(1);
  });

  it('mod.lessons OFF → ModuleGate lock, no ledger, no fetch', async () => {
    lessonsOff();

    renderWithRouter(<LessonCreditsPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Grant credits' })).toBeNull();
    expect(listLessonCredits).not.toHaveBeenCalled();
    expect(listLessonClients).not.toHaveBeenCalled();
    expect(listLessonPackages).not.toHaveBeenCalled();
  });
});
