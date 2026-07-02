// @vitest-environment jsdom
/**
 * OPS-ADMIN-MODULES UI-interaction test (Wiring & Verification Contract §15).
 *
 * Renders the REAL AdminModulesPage with the REAL wrappers mocked and proves:
 *  - the catalog table joins modules × org_modules (on/off + source shown),
 *  - core modules render ALWAYS ON with no toggle,
 *  - Turn on calls setOrgModule(orgId, key, true, 'ADDON') and refreshes,
 *  - Turn off preserves the recorded source (TIER),
 *  - the server-side SUPER_ADMIN rejection surfaces as a clean inline notice,
 *  - a failed load renders the inline error branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';

vi.mock('../../../../lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../lib/api')>();
  return { ...real, listModuleCatalog: vi.fn(), setOrgModule: vi.fn() };
});
vi.mock('../../../../lib/ops/api-admin', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../lib/ops/api-admin')>();
  return { ...real, getMyOrgId: vi.fn(), listOrgModules: vi.fn() };
});

import { listModuleCatalog, setOrgModule } from '../../../../lib/api';
import { getMyOrgId, listOrgModules } from '../../../../lib/ops/api-admin';
import { AdminModulesPage } from './AdminModulesPage';

const CATALOG = [
  { module_key: 'core.registry', name: 'Global Value Registry', description: null, is_core: true, active: true, created_at: '' },
  { module_key: 'mod.boarding', name: 'Boarding & Facility', description: null, is_core: false, active: true, created_at: '' },
  { module_key: 'mod.lessons', name: 'Lessons & Membership', description: null, is_core: false, active: true, created_at: '' },
];
const ENTITLEMENTS = [
  { id: 'om-1', org_id: 'org-1', module_key: 'mod.lessons', enabled: true, source: 'TIER' as const,
    enabled_at: '', expires_at: null, created_at: '', updated_at: '' },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMyOrgId).mockResolvedValue('org-1');
  vi.mocked(listModuleCatalog).mockResolvedValue(CATALOG as never);
  vi.mocked(listOrgModules).mockResolvedValue(ENTITLEMENTS as never);
});

describe('AdminModulesPage', () => {
  it('renders the catalog joined with entitlement status + source', async () => {
    renderWithRouter(<AdminModulesPage />);
    expect(await screen.findByText('Lessons & Membership')).toBeInTheDocument();
    expect(screen.getByText('ENABLED')).toBeInTheDocument();   // mod.lessons on
    expect(screen.getByText('TIER')).toBeInTheDocument();      // its source
    expect(screen.getByText('DISABLED')).toBeInTheDocument();  // mod.boarding off
    expect(screen.getByText('ALWAYS ON')).toBeInTheDocument(); // core.registry
    // Core module gets no toggle: one Turn on (boarding) + one Turn off (lessons).
    expect(screen.getAllByRole('button', { name: /^turn on$/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^turn off$/i })).toHaveLength(1);
  });

  it('Turn on calls setOrgModule(org, key, true, ADDON) and refreshes', async () => {
    vi.mocked(setOrgModule).mockResolvedValue(undefined as never);
    renderWithRouter(<AdminModulesPage />);
    await screen.findByText('Boarding & Facility');

    await userEvent.click(screen.getByRole('button', { name: /^turn on$/i }));
    await waitFor(() =>
      expect(setOrgModule).toHaveBeenCalledWith('org-1', 'mod.boarding', true, 'ADDON'));
    expect(listOrgModules).toHaveBeenCalledTimes(2); // initial + refresh
  });

  it('Turn off preserves the recorded TIER source', async () => {
    vi.mocked(setOrgModule).mockResolvedValue(undefined as never);
    renderWithRouter(<AdminModulesPage />);
    await screen.findByText('Lessons & Membership');

    await userEvent.click(screen.getByRole('button', { name: /^turn off$/i }));
    await waitFor(() =>
      expect(setOrgModule).toHaveBeenCalledWith('org-1', 'mod.lessons', false, 'TIER'));
  });

  it('surfaces the server-side SUPER_ADMIN rejection as a clean notice', async () => {
    vi.mocked(setOrgModule).mockRejectedValue(
      new Error('set_org_module is restricted to SUPER_ADMIN / the billing service'));
    renderWithRouter(<AdminModulesPage />);
    await screen.findByText('Boarding & Facility');

    await userEvent.click(screen.getByRole('button', { name: /^turn on$/i }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) =>
      a.textContent?.includes('managed by the platform'))).toBe(true);
    // No refresh happened on failure.
    expect(listOrgModules).toHaveBeenCalledTimes(1);
  });

  it('renders the inline error branch when the catalog load fails', async () => {
    vi.mocked(listModuleCatalog).mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<AdminModulesPage />);
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('rls denied'))).toBe(true);
  });
});
