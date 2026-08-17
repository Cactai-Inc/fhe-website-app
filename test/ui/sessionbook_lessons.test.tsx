// @vitest-environment jsdom
/**
 * SESSIONBOOK — verifies /lessons' session-aware branch without a live
 * authenticated browser session (no real Supabase credentials are available
 * in this environment — same constraint documented in
 * test/ui/pluspass_create_controls.test.tsx). `fetchPublicCatalog` and
 * `listStableHorses` are mocked with the live-measured RIDING_LESSON split
 * (6 horse_included=true, 3 horse_included=false — verified against prod
 * 2026-08-17); `useAuth` is mocked per test via `vi.doMock` + a fresh dynamic
 * import, since the signed-in/out branch is decided by its return value.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { Offering } from '../../src/lib/types';
import type { ServiceGroup } from '../../src/lib/publicCatalog';

const OUR_HORSE_NAMES = [
  '1x Weekly Lesson', '4-Lesson Punch Card', '8-Lesson Punch Card',
  '2x Weekly Lessons', 'Evaluation Lesson', 'Single Lesson',
];
const OWN_HORSE_NAMES = [
  '1x Weekly Lesson (With your horse)', '2x Weekly Lessons (With your horse)',
  'Single Lesson (With your horse)',
];

function makeOffering(name: string, horseIncluded: boolean): Offering {
  return {
    id: `off-${name}`, segment: 'rider', name, tagline: null, description: null,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), active: true, sort_order: 0,
    service_type: 'RIDING_LESSON', price_amount: 100, price_unit: 'flat', price_min: null,
    purchase_type: null, horse_included: horseIncluded, is_popular: false, note: null,
    price_model: null, config_kind: 'scheduled', unit_count: 1, weekly_frequency: null,
    badge_label: null,
  };
}

const RIDING_LESSON_GROUP: ServiceGroup = {
  code: 'RIDING_LESSON', name: 'Riding Lessons', tagline: null, requiresHorse: false,
  offerings: [
    ...OUR_HORSE_NAMES.map((n) => makeOffering(n, true)),
    ...OWN_HORSE_NAMES.map((n) => makeOffering(n, false)),
  ],
};

vi.mock('../../src/lib/publicCatalog', () => ({
  fetchPublicCatalog: async () => [RIDING_LESSON_GROUP],
}));

const listStableHorsesMock = vi.fn();
vi.mock('../../src/lib/stable', () => ({
  listStableHorses: (...args: unknown[]) => listStableHorsesMock(...args),
}));

afterEach(() => cleanup());
beforeEach(() => { listStableHorsesMock.mockReset(); });

async function renderLessons(user: { id: string } | null, opts?: { withCheckoutRoute?: boolean }) {
  vi.resetModules();
  vi.doMock('../../src/contexts/AuthContext', () => ({ useAuth: () => ({ user }) }));
  // All three must come from the SAME freshly-reset module graph as Lessons —
  // a statically-imported CartProvider/HelmetProvider carries a different
  // context object than the one Lessons (and its <Seo>) re-import after
  // vi.resetModules().
  const { default: Lessons } = await import('../../src/pages/Lessons');
  const { CartProvider } = await import('../../src/contexts/CartContext');
  const { HelmetProvider } = await import('react-helmet-async');
  const routed = opts?.withCheckoutRoute ? (
    <Routes>
      <Route path="/lessons" element={<Lessons />} />
      <Route path="/checkout" element={<p>CHECKOUT ROUTE REACHED</p>} />
    </Routes>
  ) : <Lessons />;
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/lessons']}>
        <CartProvider>{routed}</CartProvider>
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('SESSIONBOOK — signed out (test 1: marketing page unchanged)', () => {
  it('renders the existing marketing hero, unaware of session', async () => {
    await renderLessons(null);
    expect(await screen.findByText('Start Riding With Us')).toBeInTheDocument();
    expect(screen.getByText('Choose your lessons')).toBeInTheDocument();
    // The signed-in eyebrow/heading must NOT appear for a signed-out visitor.
    expect(screen.queryByText('Choose Your Lessons')).not.toBeInTheDocument();
  });
});

describe('SESSIONBOOK — signed in, no horse (test 2)', () => {
  it('shows the purchase-flow layout and hides all 3 horse_included=false cards', async () => {
    listStableHorsesMock.mockResolvedValue([]);
    await renderLessons({ id: 'member-no-horse' });
    expect(await screen.findByText('Choose Your Lessons')).toBeInTheDocument();
    // No hero / marketing copy in the signed-in branch.
    expect(screen.queryByText('Start Riding With Us')).not.toBeInTheDocument();
    await waitFor(() => {
      for (const name of OUR_HORSE_NAMES) expect(screen.getByText(name)).toBeInTheDocument();
    });
    for (const name of OWN_HORSE_NAMES) expect(screen.queryByText(name)).not.toBeInTheDocument();
  });
});

describe('SESSIONBOOK — signed in, owns/leases a horse (test 3)', () => {
  it('shows all 9 cards — the on-our-horse set is not hidden from an owner', async () => {
    // A lessee row (is_owner: false in the DB) still counts — listStableHorses'
    // wrapper only exposes the mapped array, so a non-empty result is enough.
    listStableHorsesMock.mockResolvedValue([{ id: 'h1', ownership: 'leased' }]);
    await renderLessons({ id: 'member-with-horse' });
    await waitFor(() => {
      for (const name of [...OUR_HORSE_NAMES, ...OWN_HORSE_NAMES]) {
        expect(screen.getByText(name)).toBeInTheDocument();
      }
    });
  });
});

describe('SESSIONBOOK — test 6: no offering name is parsed', () => {
  it('renders the raw DB name for a "(With your horse)" card unmodified, signed in', async () => {
    listStableHorsesMock.mockResolvedValue([{ id: 'h1', ownership: 'owned' }]);
    await renderLessons({ id: 'member-with-horse' });
    // ServiceSelector renders o.name as-is (no displayName() suffix-strip) —
    // proves the signed-in branch does not run any name-based logic on it.
    expect(await screen.findByText('Single Lesson (With your horse)')).toBeInTheDocument();
  });
});

describe('SESSIONBOOK — fail-open on a listStableHorses error', () => {
  it('shows every lesson rather than hiding the own-horse set on a failed read', async () => {
    listStableHorsesMock.mockRejectedValue(new Error('network'));
    await renderLessons({ id: 'member-error-case' });
    await waitFor(() => {
      for (const name of [...OUR_HORSE_NAMES, ...OWN_HORSE_NAMES]) {
        expect(screen.getByText(name)).toBeInTheDocument();
      }
    });
  });
});

describe('SESSIONBOOK — test 4: one purchase spine, not a second one', () => {
  it('Continue, signed in, still routes through the existing /checkout path (no new purchase path added)', async () => {
    listStableHorsesMock.mockResolvedValue([]);
    await renderLessons({ id: 'member-no-horse' }, { withCheckoutRoute: true });
    const card = await screen.findByText(OUR_HORSE_NAMES[0]);
    fireEvent.click(card.closest('button')!);
    // Two "Continue" buttons render once something is selected — the page's
    // own and the floating SelectionBar's, both calling the same handler.
    const [continueBtn] = screen.getAllByRole('button', { name: /continue/i });
    fireEvent.click(continueBtn);
    expect(await screen.findByText('CHECKOUT ROUTE REACHED')).toBeInTheDocument();
  });
});
