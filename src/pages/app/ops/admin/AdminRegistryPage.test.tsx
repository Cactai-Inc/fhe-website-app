// @vitest-environment jsdom
/**
 * OPS-ADMIN-REGISTRY UI-interaction test (Wiring & Verification Contract §15).
 *
 * Renders the REAL AdminRegistryPage with the REAL wrappers mocked and proves:
 *  - config_keys drive the editor, grouped by namespace, showing current
 *    config_values (including unlisted MODULE.* rows),
 *  - the required-but-missing banner comes from configRequiredMissing(orgId),
 *  - Save upserts the exact payload (value_text for text, value_num for num)
 *    and refreshes values + the missing check,
 *  - a rejected save renders the inline error branch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';

vi.mock('../../../../lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../lib/api')>();
  return {
    ...real,
    listConfigValues: vi.fn(),
    upsertConfigValue: vi.fn(),
    configRequiredMissing: vi.fn(),
  };
});
vi.mock('../../../../lib/ops/api-admin', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../../lib/ops/api-admin')>();
  return { ...real, getMyOrgId: vi.fn(), listConfigKeys: vi.fn() };
});

import { listConfigValues, upsertConfigValue, configRequiredMissing } from '../../../../lib/api';
import { getMyOrgId, listConfigKeys } from '../../../../lib/ops/api-admin';
import { AdminRegistryPage } from './AdminRegistryPage';

const KEYS = [
  { namespace: 'BRAND', key: 'NAME', expected_type: 'text' as const, required: true, description: 'Full brand / trade name' },
  { namespace: 'CONTACT', key: 'EMAIL', expected_type: 'text' as const, required: true, description: 'Public contact email' },
  { namespace: 'ORG', key: 'LEGAL_IDENTITY', expected_type: 'text' as const, required: false, description: 'Party-block identity clause' },
  { namespace: 'ORG', key: 'INVOICE_DUE_DAYS', expected_type: 'num' as const, required: false, description: 'Invoice due window in days' },
  { namespace: 'ORG', key: 'CANCELLATION_NOTICE_HOURS', expected_type: 'num' as const, required: false, description: null },
  { namespace: 'ORG', key: 'TERMINATION_NOTICE_DAYS', expected_type: 'num' as const, required: false, description: null },
];
const VALUE_ROW = {
  id: 'cv-1', org_id: 'org-1', namespace: 'BRAND', key: 'NAME',
  value_text: 'French Heritage Equestrian', value_num: null, value_json: null,
  category: 'branding', effective_from: '', updated_by: null, created_at: '', updated_at: '',
};
// Stored but NOT whitelisted — the MODULE.* long tail must still render.
const MODULE_ROW = {
  ...VALUE_ROW, id: 'cv-2', namespace: 'MODULE.lessons', key: 'CANCEL_WINDOW',
  value_text: null, value_num: 24, category: 'module_config',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getMyOrgId).mockResolvedValue('org-1');
  vi.mocked(listConfigKeys).mockResolvedValue(KEYS as never);
  vi.mocked(listConfigValues).mockResolvedValue([VALUE_ROW, MODULE_ROW] as never);
  vi.mocked(configRequiredMissing).mockResolvedValue([
    { namespace: 'CONTACT', key: 'EMAIL' },
  ] as never);
});

describe('AdminRegistryPage', () => {
  it('groups keys by namespace with current values and the missing banner', async () => {
    renderWithRouter(<AdminRegistryPage />);
    // Namespace group headers.
    expect(await screen.findByRole('heading', { name: 'BRAND' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ORG' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'MODULE.lessons' })).toBeInTheDocument();
    // Current value shown in the editor input.
    expect(screen.getByLabelText(/^NAME/)).toHaveValue('French Heritage Equestrian');
    // The unlisted MODULE.* row renders its numeric value.
    expect(screen.getByLabelText(/CANCEL_WINDOW/)).toHaveValue(24);
    // The ORG policy keys are present.
    for (const k of ['LEGAL_IDENTITY', 'INVOICE_DUE_DAYS', 'CANCELLATION_NOTICE_HOURS', 'TERMINATION_NOTICE_DAYS']) {
      expect(screen.getByLabelText(new RegExp(k))).toBeInTheDocument();
    }
    // Required-but-missing banner from the RPC, scoped to the caller's org.
    expect(configRequiredMissing).toHaveBeenCalledWith('org-1');
    expect(screen.getByText('CONTACT.EMAIL')).toBeInTheDocument();
  });

  it('saves a text key with the exact payload and refreshes values + missing', async () => {
    vi.mocked(upsertConfigValue).mockResolvedValue(VALUE_ROW as never);
    renderWithRouter(<AdminRegistryPage />);
    const input = await screen.findByLabelText(/^EMAIL/);

    await userEvent.type(input, 'hello@fhe.test');
    await userEvent.click(screen.getByRole('button', { name: /^save EMAIL$/i }));

    await waitFor(() => expect(upsertConfigValue).toHaveBeenCalledWith({
      namespace: 'CONTACT', key: 'EMAIL', value_text: 'hello@fhe.test',
    }));
    expect(listConfigValues).toHaveBeenCalledTimes(2);        // initial + refresh
    expect(configRequiredMissing).toHaveBeenCalledTimes(2);   // initial + refresh
  });

  it('saves a num key as value_num and rejects non-numeric input inline', async () => {
    vi.mocked(upsertConfigValue).mockResolvedValue(VALUE_ROW as never);
    renderWithRouter(<AdminRegistryPage />);
    const input = await screen.findByLabelText(/INVOICE_DUE_DAYS/);

    await userEvent.type(input, '30');
    await userEvent.click(screen.getByRole('button', { name: /^save INVOICE_DUE_DAYS$/i }));
    await waitFor(() => expect(upsertConfigValue).toHaveBeenCalledWith({
      namespace: 'ORG', key: 'INVOICE_DUE_DAYS', value_num: 30,
    }));

    // An empty num input never reaches the wrapper — inline validation instead.
    // (CANCELLATION_NOTICE_HOURS has no stored value and no draft.)
    await userEvent.click(await screen.findByRole('button', { name: /^save CANCELLATION_NOTICE_HOURS$/i }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('expects a number'))).toBe(true);
    expect(upsertConfigValue).toHaveBeenCalledTimes(1);
  });

  it('a rejected save renders the inline error branch', async () => {
    vi.mocked(upsertConfigValue).mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<AdminRegistryPage />);
    const input = await screen.findByLabelText(/^NAME/);

    await userEvent.type(input, '!');
    await userEvent.click(screen.getByRole('button', { name: /^save NAME$/i }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('rls denied'))).toBe(true);
  });
});
