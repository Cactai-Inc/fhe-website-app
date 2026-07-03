import { useEffect, useRef, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { FormField, AsyncButton, useAsync, useToast } from '../../../../lib/ops';
import {
  listBrandingValues, upsertConfigValue, uploadBrandingAsset,
  type ConfigValueRow,
} from '../../../../lib/api';

/**
 * ADMIN-BRANDING — the BRAND.* registry editor (admin-only route; the router
 * wraps this in requireAdmin, RLS enforces staff-write on config_values).
 *
 * Reads the live BRAND rows via listBrandingValues(), lets the admin edit the
 * whitelisted keys (name / short name / tagline / colors / location) with a
 * live swatch preview for the two hex colors, and saves ONLY the changed keys
 * through upsertConfigValue. Logo upload goes to the brand-assets bucket via
 * uploadBrandingAsset(orgId, file) and then persists BRAND.LOGO_PATH.
 */

const BRAND_FIELDS: Array<{ key: string; label: string; hint?: string; color?: boolean }> = [
  { key: 'NAME', label: 'Brand name' },
  { key: 'SHORT_NAME', label: 'Short name', hint: 'Abbreviation used in references, e.g. FHE' },
  { key: 'TAGLINE', label: 'Tagline' },
  { key: 'PRIMARY_COLOR', label: 'Primary color', hint: 'Hex, e.g. #14532d', color: true },
  { key: 'SECONDARY_COLOR', label: 'Secondary color', hint: 'Hex, e.g. #b45309', color: true },
  { key: 'LOCATION', label: 'Location', hint: 'Public location line' },
];

function brandMap(rows: ConfigValueRow[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of rows) {
    if (r.namespace === 'BRAND') map[r.key] = r.value_text ?? '';
  }
  return map;
}

export function AdminBrandingPage() {
  const toast = useToast();
  const branding = useAsync(listBrandingValues);

  const [form, setForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    branding.run().then((rows) => setForm(brandMap(rows))).catch(() => { /* inline error branch */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saved = brandMap(branding.data ?? []);
  // config_values rows are org-scoped by RLS, so any loaded row carries the tenant's org id.
  const orgId = branding.data?.[0]?.org_id ?? null;
  const logoPath = saved['LOGO_PATH'] ?? '';
  const dirtyKeys = BRAND_FIELDS.map((f) => f.key).filter((k) => (form[k] ?? '') !== (saved[k] ?? ''));

  async function saveValues() {
    setSaveError(null);
    try {
      for (const key of dirtyKeys) {
        await upsertConfigValue({
          namespace: 'BRAND',
          key,
          value_text: form[key] || null,
          category: 'branding',
        });
      }
      toast.success('Branding saved');
      const rows = await branding.run();
      setForm(brandMap(rows));
    } catch (err) {
      setSaveError(toErrorMessage(err, 'Could not save branding.'));
      throw err;
    }
  }

  async function uploadLogo() {
    setLogoError(null);
    if (!logoFile) {
      setLogoError('Choose a logo file first.');
      return;
    }
    if (!orgId) {
      setLogoError('Branding values are still loading — try again in a moment.');
      return;
    }
    try {
      const path = await uploadBrandingAsset(orgId, logoFile);
      await upsertConfigValue({ namespace: 'BRAND', key: 'LOGO_PATH', value_text: path, category: 'branding' });
      toast.success('Logo uploaded');
      setLogoFile(null);
      if (fileRef.current) fileRef.current.value = '';
      const rows = await branding.run();
      setForm(brandMap(rows));
    } catch (err) {
      setLogoError(toErrorMessage(err, 'Could not upload the logo.'));
      throw err;
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-green-900">Branding</h1>
        <p className="text-sm text-green-800/70">Your brand identity — names, tagline, colors, location, and logo.</p>
      </div>

      {branding.isError && (
        <p role="alert" className="form-error mb-4">{branding.error?.message ?? 'Could not load branding values.'}</p>
      )}
      {branding.isPending && <p className="text-sm text-green-800/70">Loading branding…</p>}

      {branding.isSuccess && (
        <>
          <section className="mb-10">
            {saveError && <p role="alert" className="form-error mb-3">{saveError}</p>}
            {BRAND_FIELDS.map((f) => (
              <FormField key={f.key} label={f.label} hint={f.hint}>
                {({ id, errorClass }) => (
                  <span className="flex items-center gap-3">
                    <input
                      id={id}
                      className={`form-input flex-1 ${errorClass}`}
                      value={form[f.key] ?? ''}
                      onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    />
                    {f.color && (
                      <span
                        data-testid={`swatch-${f.key}`}
                        aria-label={`${f.label} preview`}
                        className="inline-block h-8 w-8 rounded border border-green-900/20"
                        style={{ backgroundColor: form[f.key] || 'transparent' }}
                      />
                    )}
                  </span>
                )}
              </FormField>
            ))}
            <div className="mt-4 flex justify-end">
              <AsyncButton className="btn-primary" onClick={saveValues} disabled={dirtyKeys.length === 0} pendingLabel="Saving…">
                Save branding
              </AsyncButton>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-xl text-green-900 mb-2">Logo</h2>
            <p className="text-sm text-green-800/70 mb-3">
              {logoPath ? <>Current logo: <code className="text-xs">{logoPath}</code></> : 'No logo uploaded yet.'}
            </p>
            {logoError && <p role="alert" className="form-error mb-3">{logoError}</p>}
            <FormField label="Logo file" hint="PNG or SVG works best">
              {({ id, errorClass }) => (
                <input
                  id={id}
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className={`form-input ${errorClass}`}
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
              )}
            </FormField>
            <div className="mt-2 flex justify-end">
              <AsyncButton className="btn-outline-gold" onClick={uploadLogo} pendingLabel="Uploading…">
                Upload logo
              </AsyncButton>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default AdminBrandingPage;
