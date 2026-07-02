// @vitest-environment jsdom
/**
 * OPS-SUPERADMIN-ORGS UI-interaction test (Wiring & Verification Contract §15).
 *
 * Renders the REAL OrganizationsPage with the REAL api-superadmin fns mocked
 * and proves:
 *  - super-admin gate: with isSuperAdmin false the page shows the notice and
 *    listOrganizations never fires,
 *  - the table renders name/slug/status/created from listOrganizations,
 *  - a rejected load renders the inline error branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen } from '../../../../test/render';

const auth = vi.hoisted(() => ({ current: { isSuperAdmin: true } }));
vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => auth.current,
}));
vi.mock('../../../../lib/ops/api-superadmin', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../lib/ops/api-superadmin')>();
  return { ...real, listOrganizations: vi.fn() };
});

import { listOrganizations } from '../../../../lib/ops/api-superadmin';
import { OrganizationsPage } from './OrganizationsPage';

const ORGS = [
  {
    id: 'org-1', display_code: 'ORG-0001', name: 'French Heritage Equestrian',
    slug: 'fhe', status: 'ACTIVE', created_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 'org-2', display_code: 'ORG-0002', name: 'Willow Creek',
    slug: 'willow-creek', status: 'SUSPENDED', created_at: '2026-06-30T12:00:00Z',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = { isSuperAdmin: true };
  vi.mocked(listOrganizations).mockResolvedValue(ORGS);
});

describe('OrganizationsPage', () => {
  it('shows the super-admin notice and fetches nothing when not SUPER_ADMIN', () => {
    auth.current = { isSuperAdmin: false };
    renderWithRouter(<OrganizationsPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/super admin only/i);
    expect(listOrganizations).not.toHaveBeenCalled();
    expect(screen.queryByText('French Heritage Equestrian')).not.toBeInTheDocument();
  });

  it('renders the organizations from the real list fn', async () => {
    renderWithRouter(<OrganizationsPage />);
    expect(await screen.findByText('French Heritage Equestrian')).toBeInTheDocument();
    expect(screen.getByText('fhe')).toBeInTheDocument();
    expect(screen.getByText('Willow Creek')).toBeInTheDocument();
    expect(screen.getByText('willow-creek')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('SUSPENDED')).toBeInTheDocument();
    expect(listOrganizations).toHaveBeenCalledWith();
  });

  it('a rejected load renders the inline error branch', async () => {
    vi.mocked(listOrganizations).mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<OrganizationsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('rls denied');
  });
});
