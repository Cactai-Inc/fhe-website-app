// @vitest-environment jsdom
/**
 * OPS-SUPERADMIN-PROVISION UI-interaction test (Wiring & Verification Contract §15).
 *
 * Renders the REAL ProvisionTenantPage with the REAL api-superadmin fns mocked
 * and proves:
 *  - super-admin gate: with isSuperAdmin false the page shows the notice and
 *    NO catalog fn fires,
 *  - the full wizard walk calls provisionTenant with the exact payload (only
 *    the entered brand/legal/rate values, tier + explicit add-ons),
 *  - success renders the returned org id plus the required-missing follow-ups
 *    (blank legal fields, signatory contact + ORG.LEGAL_IDENTITY per
 *    ATTORNEY_FILLIN_CHECKLIST.md),
 *  - a rejected provision renders the inline error branch (wizard stays up).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';

const auth = vi.hoisted(() => ({ current: { isSuperAdmin: true } }));
vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => auth.current,
}));
vi.mock('../../../../lib/ops/api-superadmin', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../lib/ops/api-superadmin')>();
  return {
    ...real,
    listTiers: vi.fn(),
    listAddonModules: vi.fn(),
    listTierModules: vi.fn(),
    provisionTenant: vi.fn(),
  };
});

import { listTiers, listAddonModules, listTierModules, provisionTenant } from '../../../../lib/ops/api-superadmin';
import { ProvisionTenantPage } from './ProvisionTenantPage';

beforeEach(() => {
  vi.clearAllMocks();
  auth.current = { isSuperAdmin: true };
  vi.mocked(listTiers).mockResolvedValue([
    { tier_key: 'starter', name: 'Starter', monthly_price: 99, sort_order: 1 },
  ]);
  vi.mocked(listAddonModules).mockResolvedValue([
    { module_key: 'mod.brokerage', name: 'Brokerage', description: null, is_core: false },
    { module_key: 'mod.employees', name: 'Employees', description: null, is_core: false },
  ]);
  vi.mocked(listTierModules).mockResolvedValue([
    { tier_key: 'starter', module_key: 'mod.brokerage' },
  ]);
});

/** Walk steps 0–4 with a minimal-but-real set of values, landing on Review. */
async function walkToReview() {
  renderWithRouter(<ProvisionTenantPage />);

  // Step 0 — organization
  await userEvent.type(screen.getByLabelText(/organization name/i), 'Willow Creek');
  await userEvent.type(screen.getByLabelText(/^slug/i), 'willow-creek');
  await userEvent.type(screen.getByLabelText(/admin email/i), 'admin@willow.test');
  await userEvent.click(screen.getByRole('button', { name: /next/i }));

  // Step 1 — tier + add-ons. mod.brokerage is tier-granted (no checkbox);
  // mod.employees is an explicit add-on.
  await userEvent.selectOptions(await screen.findByLabelText(/tier/i), 'starter');
  expect(screen.getByText(/brokerage — included with the selected tier/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('checkbox', { name: /employees/i }));
  await userEvent.click(screen.getByRole('button', { name: /next/i }));

  // Step 2 — brand (only one value entered; blanks must not reach the payload)
  await userEvent.type(screen.getByLabelText(/display name/i), 'Willow Creek Equestrian');
  await userEvent.click(screen.getByRole('button', { name: /next/i }));

  // Step 3 — legal, with the post-provision seed note
  expect(screen.getByText(/ATTORNEY_FILLIN_CHECKLIST\.md/)).toBeInTheDocument();
  expect(screen.getByText(/ORG\.LEGAL_IDENTITY/)).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText(/legal entity name/i), 'Willow Creek LLC');
  await userEvent.click(screen.getByRole('button', { name: /next/i }));

  // Step 4 — rates
  await userEvent.type(screen.getByLabelText(/purchase rate/i), '0.10');
  await userEvent.click(screen.getByRole('button', { name: /next/i }));

  // Step 5 — review
  expect(screen.getByText(/step 6 of 6/i)).toBeInTheDocument();
}

describe('ProvisionTenantPage', () => {
  it('shows the super-admin notice and fetches nothing when not SUPER_ADMIN', () => {
    auth.current = { isSuperAdmin: false };
    renderWithRouter(<ProvisionTenantPage />);
    expect(screen.getByRole('alert')).toHaveTextContent(/super admin only/i);
    expect(listTiers).not.toHaveBeenCalled();
    expect(listAddonModules).not.toHaveBeenCalled();
    expect(listTierModules).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/organization name/i)).not.toBeInTheDocument();
  });

  it('validates step 1 before advancing', async () => {
    renderWithRouter(<ProvisionTenantPage />);
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/name, slug and admin email are required/i);
    expect(screen.getByText(/step 1 of 6/i)).toBeInTheDocument();
  });

  it('walks the wizard and provisions with the exact payload, then renders the org id + follow-ups', async () => {
    vi.mocked(provisionTenant).mockResolvedValue({ org_id: 'org-new-1' });
    await walkToReview();

    await userEvent.click(screen.getByRole('button', { name: /provision tenant/i }));

    await waitFor(() => expect(provisionTenant).toHaveBeenCalledWith({
      name: 'Willow Creek',
      slug: 'willow-creek',
      tierKey: 'starter',
      adminEmail: 'admin@willow.test',
      brand: { 'BRAND.DISPLAY_NAME': 'Willow Creek Equestrian' },
      legal: { LEGAL_NAME: 'Willow Creek LLC' },
      rates: { COMMISSION_PURCHASE_RATE: '0.10' },
      modules: ['mod.employees'],
    }));

    // Success screen: the returned org id + the required-missing follow-ups.
    expect(await screen.findByTestId('provisioned-org-id')).toHaveTextContent('org-new-1');
    expect(screen.getByText(/legal: signatory title/i)).toBeInTheDocument(); // left blank
    expect(screen.queryByText(/legal: legal entity name/i)).not.toBeInTheDocument(); // was provided
    expect(screen.getByText(/rate: late fee/i)).toBeInTheDocument(); // left blank
    expect(screen.getByText(/signatory contact/i)).toBeInTheDocument();
    expect(screen.getByText(/Seed config_values ORG\.LEGAL_IDENTITY/)).toBeInTheDocument();
  });

  it('a rejected provision renders the inline error and keeps the wizard up', async () => {
    vi.mocked(provisionTenant).mockRejectedValue(new Error('forbidden'));
    await walkToReview();

    await userEvent.click(screen.getByRole('button', { name: /provision tenant/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('forbidden'))).toBe(true);
    expect(screen.getByRole('button', { name: /provision tenant/i })).toBeInTheDocument();
    expect(screen.queryByTestId('provisioned-org-id')).not.toBeInTheDocument();
  });
});
