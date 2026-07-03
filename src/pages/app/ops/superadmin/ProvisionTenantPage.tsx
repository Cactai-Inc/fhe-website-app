import { useEffect, useMemo, useState } from 'react';
import { toErrorMessage } from '../../../../lib/ops/errors';
import { FormField, AsyncButton, useAsync, useToast } from '../../../../lib/ops';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  listTiers, listAddonModules, listTierModules, provisionTenant,
  type ProvisionTenantInput,
} from '../../../../lib/ops/api-superadmin';

/**
 * OPS-SUPERADMIN-PROVISION — the push-button tenant wizard (§9).
 *
 * SUPER_ADMIN only: gated on isSuperAdmin from AuthContext (the route already
 * requires ADMIN; SUPER_ADMIN is the stricter platform-operator path, never
 * folded into has_module()). With the gate off nothing fetches.
 *
 * Steps: org name/slug/admin email → tier + module add-ons → brand values →
 * legal identity → rates → review + provision. Provisioning goes through the
 * single blessed path, POST /api/admin-provision-tenant with the caller's
 * bearer token (provisionTenant wrapper), which runs the atomic
 * provision_tenant() RPC. On success we render the new org id plus the
 * required-missing follow-ups (blank legal/rate values, and the always-manual
 * post-provision seeds — signatory contact + ORG.LEGAL_IDENTITY — per
 * ATTORNEY_FILLIN_CHECKLIST.md).
 */

const STEPS = ['Organization', 'Tier & modules', 'Brand', 'Legal identity', 'Rates', 'Review'] as const;

/** business_config legal columns (provision_tenant p_legal keys). */
const LEGAL_FIELDS: ReadonlyArray<{ key: string; label: string; hint?: string }> = [
  { key: 'LEGAL_NAME', label: 'Legal entity name' },
  { key: 'ENTITY_FORMATION', label: 'Entity formation', hint: 'e.g. sole proprietorship, LLC (state)' },
  { key: 'REGISTERED_AGENT', label: 'Registered agent' },
  { key: 'SIGNATORY_NAME', label: 'Signatory name' },
  { key: 'SIGNATORY_TITLE', label: 'Signatory title' },
  { key: 'ADDRESS', label: 'Business address' },
  { key: 'PROTECTION_PERIOD', label: 'Protection period', hint: 'e.g. 12 months' },
  { key: 'DOCUMENT_RETENTION', label: 'Document retention', hint: 'e.g. 7 years' },
  { key: 'ESIGN_PROVIDER', label: 'E-signature provider' },
];

/** business_config rate columns (provision_tenant p_rates keys). */
const RATE_FIELDS: ReadonlyArray<{ key: string; label: string; hint?: string }> = [
  { key: 'COMMISSION_PURCHASE_RATE', label: 'Commission — purchase rate', hint: 'decimal, e.g. 0.10' },
  { key: 'COMMISSION_SALE_RATE', label: 'Commission — sale rate', hint: 'decimal, e.g. 0.10' },
  { key: 'COMMISSION_LEASE_RATE', label: 'Commission — lease rate', hint: 'decimal, e.g. 0.10' },
  { key: 'COMMISSION_MIN', label: 'Commission minimum ($)' },
  { key: 'CANCELLATION_FEE', label: 'Cancellation fee ($)' },
  { key: 'LATE_FEE', label: 'Late fee ($)' },
  { key: 'NO_SHOW_FEE', label: 'No-show fee ($)' },
  { key: 'SALES_TAX_RATE', label: 'Sales tax rate', hint: 'decimal, e.g. 0.0625' },
];

/** config_values seeds — keys route by prefix inside provision_tenant(). */
const BRAND_FIELDS: ReadonlyArray<{ key: string; label: string; hint?: string }> = [
  { key: 'BRAND.DISPLAY_NAME', label: 'Display name' },
  { key: 'BRAND.TAGLINE', label: 'Tagline' },
  { key: 'BRAND.PRIMARY_COLOR', label: 'Primary color', hint: 'e.g. #14532d' },
  { key: 'CONTACT.EMAIL', label: 'Public contact email' },
  { key: 'CONTACT.PHONE', label: 'Public contact phone' },
];

/** Drop blank values so the payload carries only what the operator entered. */
function prune(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v.trim() !== '') out[k] = v.trim();
  }
  return out;
}

export function ProvisionTenantPage() {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();

  const tiers = useAsync(listTiers);
  const addons = useAsync(listAddonModules);
  const tierModules = useAsync(listTierModules);

  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [tierKey, setTierKey] = useState('');
  const [addonKeys, setAddonKeys] = useState<string[]>([]);
  const [brand, setBrand] = useState<Record<string, string>>({});
  const [legal, setLegal] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ orgId: string; missing: string[] } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    for (const l of [tiers, addons, tierModules]) {
      l.run().catch(() => { /* inline error branches */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  /** Module keys the chosen tier already grants (shown as included, not add-ons). */
  const tierGranted = useMemo(
    () => new Set((tierModules.data ?? []).filter((tm) => tm.tier_key === tierKey).map((tm) => tm.module_key)),
    [tierModules.data, tierKey],
  );

  if (!isSuperAdmin) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <p role="alert" className="form-error">Super admin only. This page is restricted to the platform operator.</p>
      </div>
    );
  }

  function next() {
    setStepError(null);
    if (step === 0) {
      if (!name.trim() || !slug.trim() || !adminEmail.trim()) {
        setStepError('Name, slug and admin email are required.');
        return;
      }
    }
    if (step === 1 && !tierKey) {
      setStepError('Choose a tier.');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function toggleAddon(key: string, checked: boolean) {
    setAddonKeys((keys) => (checked ? [...keys.filter((k) => k !== key), key] : keys.filter((k) => k !== key)));
  }

  async function submit() {
    setSubmitError(null);
    const payload: ProvisionTenantInput = {
      name: name.trim(),
      slug: slug.trim(),
      tierKey,
      adminEmail: adminEmail.trim(),
      brand: prune(brand),
      legal: prune(legal),
      rates: prune(rates),
      modules: addonKeys,
    };
    try {
      const { org_id } = await provisionTenant(payload);
      // Required-missing follow-ups: every legal/rate value left blank, plus the
      // always-manual post-provision seeds per ATTORNEY_FILLIN_CHECKLIST.md.
      const missing = [
        ...LEGAL_FIELDS.filter((f) => !payload.legal[f.key]).map((f) => `Legal: ${f.label} (business_config)`),
        ...RATE_FIELDS.filter((f) => !payload.rates[f.key]).map((f) => `Rate: ${f.label} (business_config)`),
        'Create the signatory contact and set business_config.signatory_contact_id (ATTORNEY_FILLIN_CHECKLIST.md)',
        'Seed config_values ORG.LEGAL_IDENTITY — the party-block legal identity clause (ATTORNEY_FILLIN_CHECKLIST.md)',
      ];
      setResult({ orgId: org_id, missing });
      toast.success('Tenant provisioned');
    } catch (err) {
      setSubmitError(toErrorMessage(err, 'Could not provision the tenant.'));
      throw err;
    }
  }

  if (result) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <h1 className="font-serif text-2xl text-green-900 mb-2">Tenant provisioned</h1>
        <p className="text-sm text-green-800/80 mb-6">
          Organization id: <code data-testid="provisioned-org-id" className="font-mono">{result.orgId}</code>
        </p>
        <h2 className="font-serif text-lg text-green-900 mb-2">Required follow-ups</h2>
        <ul className="list-disc pl-5 text-sm text-green-800/80 space-y-1">
          {result.missing.map((m) => <li key={m}>{m}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-green-900">Provision tenant</h1>
        <p className="text-sm text-green-800/70">
          Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
      </div>

      {(tiers.isError || addons.isError || tierModules.isError) && (
        <p role="alert" className="form-error mb-4">
          {tiers.error?.message ?? addons.error?.message ?? tierModules.error?.message ?? 'Could not load the packaging catalog.'}
        </p>
      )}
      {stepError && <p role="alert" className="form-error mb-4">{stepError}</p>}

      {step === 0 && (
        <div>
          <FormField label="Organization name" required>
            {({ id, errorClass }) => (
              <input id={id} className={`form-input ${errorClass}`} value={name}
                onChange={(e) => setName(e.target.value)} />
            )}
          </FormField>
          <FormField label="Slug" required hint="Unique, URL-safe, e.g. willow-creek">
            {({ id, errorClass }) => (
              <input id={id} className={`form-input ${errorClass}`} value={slug}
                onChange={(e) => setSlug(e.target.value)} />
            )}
          </FormField>
          <FormField label="Admin email" required hint="The tenant's first ADMIN — the auth user is found or created by email.">
            {({ id, errorClass }) => (
              <input id={id} type="email" className={`form-input ${errorClass}`} value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)} />
            )}
          </FormField>
        </div>
      )}

      {step === 1 && (
        <div>
          <FormField label="Tier" required>
            {({ id, errorClass }) => (
              <select id={id} className={`form-input ${errorClass}`} value={tierKey}
                onChange={(e) => { setTierKey(e.target.value); setAddonKeys([]); }}>
                <option value="">Select a tier…</option>
                {(tiers.data ?? []).map((t) => (
                  <option key={t.tier_key} value={t.tier_key}>
                    {t.name}{t.monthly_price != null ? ` — $${t.monthly_price}/mo` : ''}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <fieldset className="mt-4">
            <legend className="form-label">Module add-ons</legend>
            {(addons.data ?? []).length === 0 && (
              <p className="text-sm text-green-800/60">No add-on modules in the catalog.</p>
            )}
            {(addons.data ?? []).map((m) =>
              tierGranted.has(m.module_key) ? (
                <p key={m.module_key} className="text-sm text-green-800/60">
                  {m.name} — included with the selected tier
                </p>
              ) : (
                <label key={m.module_key} className="flex items-start gap-2 text-sm text-green-900 py-1">
                  <input
                    type="checkbox"
                    checked={addonKeys.includes(m.module_key)}
                    onChange={(e) => toggleAddon(m.module_key, e.target.checked)}
                  />
                  <span>
                    {m.name}
                    {m.description ? <span className="text-green-800/60"> — {m.description}</span> : null}
                  </span>
                </label>
              ),
            )}
          </fieldset>
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-sm text-green-800/70 mb-4">
            Brand and contact seeds land in the tenant's config_values registry. Everything is optional and editable later.
          </p>
          {BRAND_FIELDS.map((f) => (
            <FormField key={f.key} label={f.label} hint={f.hint}>
              {({ id, errorClass }) => (
                <input id={id} className={`form-input ${errorClass}`} value={brand[f.key] ?? ''}
                  onChange={(e) => setBrand((b) => ({ ...b, [f.key]: e.target.value }))} />
              )}
            </FormField>
          ))}
        </div>
      )}

      {step === 3 && (
        <div>
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-3 mb-4">
            Note: the signatory contact (business_config.signatory_contact_id) and the
            ORG.LEGAL_IDENTITY party-block clause are seeded post-provision, per
            ATTORNEY_FILLIN_CHECKLIST.md — they are deliberately not part of this wizard.
          </p>
          {LEGAL_FIELDS.map((f) => (
            <FormField key={f.key} label={f.label} hint={f.hint}>
              {({ id, errorClass }) => (
                <input id={id} className={`form-input ${errorClass}`} value={legal[f.key] ?? ''}
                  onChange={(e) => setLegal((l) => ({ ...l, [f.key]: e.target.value }))} />
              )}
            </FormField>
          ))}
        </div>
      )}

      {step === 4 && (
        <div>
          <p className="text-sm text-green-800/70 mb-4">
            Commission and fee defaults for business_config. Blank values stay null (overridable later).
          </p>
          {RATE_FIELDS.map((f) => (
            <FormField key={f.key} label={f.label} hint={f.hint}>
              {({ id, errorClass }) => (
                <input id={id} inputMode="decimal" className={`form-input ${errorClass}`} value={rates[f.key] ?? ''}
                  onChange={(e) => setRates((r) => ({ ...r, [f.key]: e.target.value }))} />
              )}
            </FormField>
          ))}
        </div>
      )}

      {step === 5 && (
        <div className="text-sm text-green-900">
          {submitError && <p role="alert" className="form-error mb-4">{submitError}</p>}
          <dl className="space-y-1 mb-4">
            <div><dt className="inline font-semibold">Name: </dt><dd className="inline">{name}</dd></div>
            <div><dt className="inline font-semibold">Slug: </dt><dd className="inline">{slug}</dd></div>
            <div><dt className="inline font-semibold">Admin email: </dt><dd className="inline">{adminEmail}</dd></div>
            <div>
              <dt className="inline font-semibold">Tier: </dt>
              <dd className="inline">{(tiers.data ?? []).find((t) => t.tier_key === tierKey)?.name ?? tierKey}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">Add-ons: </dt>
              <dd className="inline">{addonKeys.length ? addonKeys.join(', ') : 'none'}</dd>
            </div>
            <div><dt className="inline font-semibold">Brand values: </dt><dd className="inline">{Object.keys(prune(brand)).length}</dd></div>
            <div><dt className="inline font-semibold">Legal values: </dt><dd className="inline">{Object.keys(prune(legal)).length} of {LEGAL_FIELDS.length}</dd></div>
            <div><dt className="inline font-semibold">Rate values: </dt><dd className="inline">{Object.keys(prune(rates)).length} of {RATE_FIELDS.length}</dd></div>
          </dl>
          <p className="text-green-800/70 mb-4">
            Provisioning is atomic: the org, registry seeds, entitlements, cloned catalog and
            first ADMIN either all land or none do.
          </p>
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <button type="button" className="btn-outline-gold" onClick={back} disabled={step === 0}>
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn-primary" onClick={next}>Next</button>
        ) : (
          <AsyncButton className="btn-primary" onClick={submit} pendingLabel="Provisioning…">
            Provision tenant
          </AsyncButton>
        )}
      </div>
    </div>
  );
}

export default ProvisionTenantPage;
