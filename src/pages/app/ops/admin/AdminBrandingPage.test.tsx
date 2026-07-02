// @vitest-environment jsdom
/**
 * ADMIN-BRANDING UI-interaction test (Wiring & Verification Contract §15).
 *
 * Renders the REAL AdminBrandingPage over the mocked lib/api layer and proves:
 *  - listBrandingValues() drives the editor (values land in the inputs, the
 *    color swatch previews the hex value),
 *  - saving after editing ONE field calls upsertConfigValue with the exact
 *    payload for that key only (no shotgun writes), then re-fetches,
 *  - the logo flow calls uploadBrandingAsset(orgId, file) with the org id
 *    derived from the loaded rows and persists BRAND.LOGO_PATH,
 *  - a rejected save renders the inline error branch (not swallowed).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithRouter, screen, userEvent, waitFor } from '../../../../test/render';

const listBrandingValues = vi.hoisted(() => vi.fn());
const upsertConfigValue = vi.hoisted(() => vi.fn());
const uploadBrandingAsset = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/api', () => ({ listBrandingValues, upsertConfigValue, uploadBrandingAsset }));

import { AdminBrandingPage } from './AdminBrandingPage';

function row(key: string, value_text: string, namespace = 'BRAND') {
  return {
    id: `cv-${namespace}-${key}`, org_id: 'org-1', namespace, key,
    value_text, value_num: null, value_json: null, category: 'branding',
    effective_from: '2026-01-01T00:00:00Z', updated_by: null, created_at: '', updated_at: '',
  };
}

const ROWS = [
  row('NAME', 'French Heritage Equestrian'),
  row('SHORT_NAME', 'FHE'),
  row('TAGLINE', 'Classical European horsemanship.'),
  row('PRIMARY_COLOR', '#14532d'),
  row('SECONDARY_COLOR', '#b45309'),
  row('LOCATION', 'Carmel Creek Ranch'),
  row('LOGO_PATH', 'org-1/logo-old.png'),
  row('EMAIL', 'hello@fhe.test', 'CONTACT'), // present in the fetch, NOT a BRAND field
];

beforeEach(() => {
  vi.clearAllMocks();
  listBrandingValues.mockResolvedValue(ROWS);
});

describe('AdminBrandingPage', () => {
  it('renders the BRAND values into the editor with color swatch previews', async () => {
    renderWithRouter(<AdminBrandingPage />);
    expect(await screen.findByLabelText(/brand name/i)).toHaveValue('French Heritage Equestrian');
    expect(screen.getByLabelText(/short name/i)).toHaveValue('FHE');
    expect(screen.getByLabelText(/location/i)).toHaveValue('Carmel Creek Ranch');
    expect(screen.getByTestId('swatch-PRIMARY_COLOR')).toHaveStyle({ backgroundColor: '#14532d' });
    expect(screen.getByText('org-1/logo-old.png')).toBeInTheDocument();
    expect(listBrandingValues).toHaveBeenCalledWith();
  });

  it('saves ONLY the edited key with the exact upsert payload, then re-fetches', async () => {
    upsertConfigValue.mockResolvedValue(row('TAGLINE', 'New tagline'));
    renderWithRouter(<AdminBrandingPage />);
    const tagline = await screen.findByLabelText(/tagline/i);

    await userEvent.clear(tagline);
    await userEvent.type(tagline, 'New tagline');
    await userEvent.click(screen.getByRole('button', { name: /save branding/i }));

    await waitFor(() => expect(upsertConfigValue).toHaveBeenCalledWith({
      namespace: 'BRAND', key: 'TAGLINE', value_text: 'New tagline', category: 'branding',
    }));
    expect(upsertConfigValue).toHaveBeenCalledTimes(1); // untouched keys are not rewritten
    await waitFor(() => expect(listBrandingValues).toHaveBeenCalledTimes(2)); // initial + refresh
  });

  it('uploads the logo with the org id from the loaded rows and persists LOGO_PATH', async () => {
    uploadBrandingAsset.mockResolvedValue('org-1/logo.png');
    upsertConfigValue.mockResolvedValue(row('LOGO_PATH', 'org-1/logo.png'));
    renderWithRouter(<AdminBrandingPage />);
    await screen.findByLabelText(/brand name/i);

    const file = new File(['png-bytes'], 'logo.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText(/logo file/i), file);
    await userEvent.click(screen.getByRole('button', { name: /upload logo/i }));

    await waitFor(() => expect(uploadBrandingAsset).toHaveBeenCalledWith('org-1', file));
    await waitFor(() => expect(upsertConfigValue).toHaveBeenCalledWith({
      namespace: 'BRAND', key: 'LOGO_PATH', value_text: 'org-1/logo.png', category: 'branding',
    }));
  });

  it('a rejected save renders the inline error branch', async () => {
    upsertConfigValue.mockRejectedValue(new Error('rls denied'));
    renderWithRouter(<AdminBrandingPage />);
    const name = await screen.findByLabelText(/brand name/i);

    await userEvent.clear(name);
    await userEvent.type(name, 'Rogue Barn');
    await userEvent.click(screen.getByRole('button', { name: /save branding/i }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('rls denied'))).toBe(true);
  });
});
