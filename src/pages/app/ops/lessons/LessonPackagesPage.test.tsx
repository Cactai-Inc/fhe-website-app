// @vitest-environment jsdom
/**
 * OPS-LESSON-PACKAGES UI-interaction test (PLATFORM_ARCHITECTURE.md §15.2).
 *
 * Renders the REAL LessonPackagesPage over the mocked api-lessons layer + a
 * mocked useModules and proves the wiring:
 *   - listLessonPackages() drives the table rows,
 *   - 'New package' → fill the form → createLessonPackage with EXACT args
 *     ({ package_key, name, price_value_key, credits }) + toast + new row,
 *   - a row click opens edit → updateLessonPackage(id, patch incl. active),
 *   - the error branch (create rejects) renders inline AND keeps the modal open,
 *   - mod.lessons OFF → ModuleGate lock, no fetch fires.
 * Real-path DB behavior lives in test/db/mod_lessons.test.ts — this is UI
 * wiring proof only.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';
import type { LessonPackage } from '../../../../lib/ops/api-lessons';

const listLessonPackages = vi.hoisted(() => vi.fn());
const createLessonPackage = vi.hoisted(() => vi.fn());
const updateLessonPackage = vi.hoisted(() => vi.fn());
const useModulesMock = vi.hoisted(() => vi.fn());

vi.mock('../../../../lib/ops/api-lessons', () => ({
  listLessonPackages,
  createLessonPackage,
  updateLessonPackage,
}));
vi.mock('../../../../lib/ops/useModules', () => ({ useModules: useModulesMock }));

import { LessonPackagesPage } from './LessonPackagesPage';

function pkg(over: Partial<LessonPackage>): LessonPackage {
  return {
    id: 'pkg-1',
    org_id: 'org-1',
    package_key: 'pkg.10',
    name: '10-Lesson Pack',
    price_value_key: 'PKG_10_PRICE',
    credits: 10,
    active: true,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    ...over,
  };
}

function lessonsOn() {
  useModulesMock.mockReturnValue({ 'mod.lessons': true, 'mod.brokerage': true });
}
function lessonsOff() {
  useModulesMock.mockReturnValue({ 'mod.lessons': false, 'mod.brokerage': true });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OPS-LESSON-PACKAGES — LessonPackagesPage', () => {
  it('renders the packages returned by listLessonPackages()', async () => {
    lessonsOn();
    listLessonPackages.mockResolvedValue([
      pkg({ id: 'pkg-1', name: '10-Lesson Pack' }),
      pkg({ id: 'pkg-2', package_key: 'pkg.5', name: '5-Lesson Pack', credits: 5, active: false }),
    ]);

    renderWithRouter(<LessonPackagesPage />);

    expect(await screen.findByText('10-Lesson Pack')).toBeInTheDocument();
    expect(screen.getByText('5-Lesson Pack')).toBeInTheDocument();
    expect(screen.getByText('INACTIVE')).toBeInTheDocument();
    expect(listLessonPackages).toHaveBeenCalledTimes(1);
  });

  it('creates: fills the form, submits → createLessonPackage with EXACT args + toast + new row', async () => {
    const user = userEvent.setup();
    lessonsOn();
    listLessonPackages.mockResolvedValue([]);
    createLessonPackage.mockResolvedValue(
      pkg({ id: 'pkg-9', package_key: 'pkg.20', name: '20-Lesson Pack', credits: 20 }),
    );

    renderWithRouter(<LessonPackagesPage />);
    expect(await screen.findByText('No lesson packages yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New package' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/Package key/), 'pkg.20');
    await user.type(screen.getByLabelText(/^Name/), '20-Lesson Pack');
    await user.type(screen.getByLabelText(/Price registry key/), 'PKG_20_PRICE');
    await user.type(screen.getByLabelText(/Credits/), '20');

    await user.click(screen.getByRole('button', { name: 'Create package' }));

    expect(createLessonPackage).toHaveBeenCalledTimes(1);
    expect(createLessonPackage).toHaveBeenCalledWith({
      package_key: 'pkg.20',
      name: '20-Lesson Pack',
      price_value_key: 'PKG_20_PRICE',
      credits: 20,
    });
    expect(updateLessonPackage).not.toHaveBeenCalled();

    // Success: the created row renders, toast shows, modal closes.
    expect(await screen.findByText('20-Lesson Pack')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Package created.');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('edits: row click → change credits + active → updateLessonPackage(id, patch)', async () => {
    const user = userEvent.setup();
    lessonsOn();
    listLessonPackages.mockResolvedValue([pkg({ id: 'pkg-1' })]);
    updateLessonPackage.mockResolvedValue(pkg({ id: 'pkg-1', credits: 12, active: false }));

    renderWithRouter(<LessonPackagesPage />);
    await user.click(await screen.findByText('10-Lesson Pack'));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const creditsInput = screen.getByLabelText(/Credits/);
    await user.clear(creditsInput);
    await user.type(creditsInput, '12');
    await user.click(screen.getByLabelText(/Active/));

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(updateLessonPackage).toHaveBeenCalledTimes(1);
    expect(updateLessonPackage).toHaveBeenCalledWith('pkg-1', {
      name: '10-Lesson Pack',
      price_value_key: 'PKG_10_PRICE',
      credits: 12,
      active: false,
    });
    expect(createLessonPackage).not.toHaveBeenCalled();
    expect(await screen.findByRole('status')).toHaveTextContent('Package updated.');
  });

  it('renders the error branch and KEEPS the modal open when createLessonPackage rejects', async () => {
    const user = userEvent.setup();
    lessonsOn();
    listLessonPackages.mockResolvedValue([]);
    createLessonPackage.mockRejectedValue(new Error('duplicate package_key'));

    renderWithRouter(<LessonPackagesPage />);
    await screen.findByText('No lesson packages yet');

    await user.click(screen.getByRole('button', { name: 'New package' }));
    await user.type(screen.getByLabelText(/Package key/), 'pkg.10');
    await user.type(screen.getByLabelText(/^Name/), 'Dup Pack');
    await user.type(screen.getByLabelText(/Credits/), '10');
    await user.click(screen.getByRole('button', { name: 'Create package' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('duplicate package_key');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(createLessonPackage).toHaveBeenCalledTimes(1);
  });

  it('mod.lessons OFF → ModuleGate lock, no table, no fetch', async () => {
    lessonsOff();

    renderWithRouter(<LessonPackagesPage />);

    expect(screen.getByTestId('module-locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New package' })).toBeNull();
    expect(listLessonPackages).not.toHaveBeenCalled();
    expect(createLessonPackage).not.toHaveBeenCalled();
  });
});
