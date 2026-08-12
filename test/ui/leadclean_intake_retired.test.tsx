// @vitest-environment jsdom
/**
 * TASK-LEADCLEAN — the Inbound retirement keeps its deep links alive.
 *
 * /app/ops/intake is retired behind INTAKE_PAGE_RETIRED, but five database
 * functions still write notification links pointing at it, some with
 * `?request=<id>` (submit_public_request, create_gift, redeem_gift,
 * provision_client_invitation, sign_start_register_attempt). A retirement that
 * 404s those links would break notifications that already exist in the live
 * `notifications` table, so the route redirects and CARRIES THE PARAM — the
 * dashboard opens that lead's drawer from it.
 */
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

vi.mock('../../src/lib/supabase', () => ({
  supabase: { rpc: () => Promise.resolve({ data: [], error: null }) },
}));

const { INTAKE_PAGE_RETIRED, IntakeRetiredRedirect } =
  await import('../../src/pages/app/ops/IntakePage');

function Landing() {
  const loc = useLocation();
  return <span data-testid="landed">{loc.pathname}{loc.search}</span>;
}

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/app/ops/intake" element={<IntakeRetiredRedirect />} />
        <Route path="/app/dashboard" element={<Landing />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => cleanup());

describe('LEADCLEAN — /app/ops/intake is retired', () => {
  it('is retired behind a boolean, not deleted', () => {
    expect(INTAKE_PAGE_RETIRED).toBe(true);
  });

  it('sends a bare link to the dashboard', () => {
    renderAt('/app/ops/intake');
    expect(screen.getByTestId('landed')).toHaveTextContent('/app/dashboard');
  });

  it('carries ?request= through so the lead still opens', () => {
    renderAt('/app/ops/intake?request=abc-123');
    expect(screen.getByTestId('landed').textContent)
      .toBe('/app/dashboard?request=abc-123');
  });
});
