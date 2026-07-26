import { useEffect, useMemo, useState } from 'react';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  adminSendInvitation, categoryDocumentDefaults, suggestedCategoryForContact,
  CLIENT_CATEGORIES, CATEGORY_TOKEN, type CategoryDocDefault,
  type AdminInviteResult,
} from '../../lib/admin';
import { fetchOfferings } from '../../lib/api';
import type { Offering, Segment } from '../../lib/types';

/**
 * PROVISION CLIENT — the ONE shared "upgrade a contact to an account" form.
 * Every admin account-creation surface renders this so the field set never
 * drifts and there is a single call site to the provisioning spine:
 *   - source='new'        blank (New client page)
 *   - source='contact'    an existing captured contact (client-detail)
 *   - source='submission' a website/kiosk submission (Inbound convert)
 *
 * When launched on a contact that already signed documents (kiosk walk-in), the
 * category is preselected from those signed docs and the paperwork already on
 * file is shown as complete (not re-requested).
 */

// Category (display) → offering segments it may purchase (union when stacked).
const CATEGORY_SEGMENTS: Record<string, Segment[]> = {
  Guest: ['acquisition'],
  Rider: ['rider', 'acquisition'],
  'Horse owner': ['horse', 'acquisition'],
};
// Standing token → display label (reverse of CATEGORY_TOKEN) for preselection.
const TOKEN_TO_DISPLAY: Record<string, string> = {
  GUEST: 'Guest', RIDER: 'Rider', HORSE_OWNER: 'Horse owner',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-4"><span className="form-label">{label}</span>{children}</div>;
}
function money(n: number): string {
  return `$${Number(n).toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export interface ProvisionClientFormProps {
  source: 'new' | 'contact' | 'submission';
  /** Pre-fill: existing contact to upgrade (contact/submission sources). */
  contactId?: string;
  /** Pre-fill: originating submission (submission source) — linked + flipped to invited. */
  requestId?: string;
  /** Pre-fill: known email (locked when provided). */
  email?: string;
  /** Pre-fill: known name from a submission (carried onto the account). */
  firstName?: string;
  lastName?: string;
  /** Called after a successful provision with the invite result. */
  onProvisioned?: (result: AdminInviteResult) => void;
  /** Hide the built-in result panel (host shows its own, e.g. the client page link). */
  hideResult?: boolean;
}

export function ProvisionClientForm({
  source, contactId, requestId, email: emailProp,
  firstName, lastName, onProvisioned, hideResult,
}: ProvisionClientFormProps) {
  const emailLocked = Boolean(emailProp);
  const [email, setEmail] = useState(emailProp ?? '');
  const [categories, setCategories] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<CategoryDocDefault[]>([]);
  const [docChecked, setDocChecked] = useState<Set<string> | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [offeringIds, setOfferingIds] = useState<string[]>([]);
  const [payStatus, setPayStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [partialAmount, setPartialAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Zelle');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<{ url: string; emailed: boolean; email: string } | null>(null);
  // Already-signed templates (kiosk walk-in) — shown as complete, not re-requested.
  const [signedTemplates, setSignedTemplates] = useState<string[]>([]);

  useEffect(() => {
    categoryDocumentDefaults().then(setDefaults).catch(() => setDefaults([]));
    fetchOfferings().then(setOfferings).catch(() => setOfferings([]));
  }, []);

  // Signed-contact detection: preselect category from what they've already signed.
  useEffect(() => {
    if (!contactId) return;
    suggestedCategoryForContact(contactId)
      .then((r) => {
        setSignedTemplates(r.executed_templates ?? []);
        const display = TOKEN_TO_DISPLAY[r.suggested];
        if (display) setCategories((prev) => (prev.length ? prev : [display]));
      })
      .catch(() => {});
  }, [contactId]);

  const derivedDocKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const d of defaults) if (categories.includes(d.category)) keys.add(d.template_key);
    return keys;
  }, [defaults, categories]);
  const titleFor = (key: string) => defaults.find((d) => d.template_key === key)?.title ?? key;
  const effectiveDocs = docChecked ?? derivedDocKeys;
  const shownDocKeys = useMemo(() => {
    const s = new Set(derivedDocKeys);
    if (docChecked) docChecked.forEach((k) => s.add(k));
    return Array.from(s);
  }, [derivedDocKeys, docChecked]);

  const allowedSegments = useMemo(() => {
    const s = new Set<Segment>();
    for (const c of categories) (CATEGORY_SEGMENTS[c] ?? []).forEach((seg) => s.add(seg));
    return s;
  }, [categories]);
  // Flat SKUs: a purchasable offering is one in the allowed segment that isn't an
  // inquire-only / parent grouping row (config_kind='inquire' or no price). The
  // tier layer was removed 2026-07-08 — each offering IS the purchasable item.
  const visibleOfferings = offerings.filter(
    (o) => allowedSegments.has(o.segment)
      && o.config_kind !== 'inquire'
      && o.price_amount != null);

  const offeringTotal = useMemo(() => {
    let t = 0;
    for (const o of offerings)
      if (offeringIds.includes(o.id)) t += o.price_amount ?? 0;
    return t;
  }, [offerings, offeringIds]);

  function toggleCategory(c: string) {
    setCategories((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      setDocChecked(null);
      const segs = new Set<Segment>();
      for (const cat of next) (CATEGORY_SEGMENTS[cat] ?? []).forEach((s) => segs.add(s));
      setOfferingIds((ids) => ids.filter((id) => {
        const seg = offerings.find((o) => o.id === id)?.segment;
        return seg ? segs.has(seg) : false;
      }));
      return next;
    });
  }
  function toggleDoc(key: string) {
    setDocChecked((prev) => {
      const base = prev ?? new Set(derivedDocKeys);
      const s = new Set(base);
      if (s.has(key)) s.delete(key); else s.add(key);
      return s;
    });
  }
  function toggleOffering(id: string) {
    setOfferingIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true); setError(null); setResult(null);
    try {
      const tokens = categories.map((c) => CATEGORY_TOKEN[c]).filter(Boolean);
      const finalDocs = docChecked ? Array.from(effectiveDocs) : undefined;
      const r = await adminSendInvitation({
        email: email.trim(),
        ...(requestId ? { requestId } : {}),
        ...(firstName?.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName?.trim() ? { lastName: lastName.trim() } : {}),
        categories: tokens,
        ...(offeringIds.length ? { offeringIds } : {}),
        ...(finalDocs ? { templateKeys: finalDocs } : {}),
        paymentStatus: payStatus,
        ...(payStatus === 'partial' ? { partialAmount: Number(partialAmount) || 0 } : {}),
        ...(payStatus !== 'unpaid' ? { paymentMethod } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setResult({ url: r.registerUrl, emailed: r.emailed, email: email.trim() });
      onProvisioned?.(r);
      if (source === 'new') {
        setEmail(''); setCategories([]); setDocChecked(null); setOfferingIds([]);
        setPayStatus('unpaid'); setPartialAmount(''); setNotes('');
      }
    } catch (err) {
      setError(toErrorMessage(err, 'Could not create the invitation.'));
    } finally {
      setWorking(false);
    }
  }

  const primaryLabel = source === 'submission' ? 'Convert & send invitation'
    : source === 'contact' ? 'Provision & send invitation'
    : 'Create & send invitation';

  return (
    <>
      <form onSubmit={submit}>
        <Field label="Email">
          <input type="email" required className="form-input" value={email}
            disabled={emailLocked}
            onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" />
        </Field>

        <div className="mb-6">
          <span className="form-label">Account category</span>
          <p className="text-sm text-muted mb-2.5">What kind of client — check everything that applies.</p>
          <div className="flex flex-wrap gap-3">
            {CLIENT_CATEGORIES.map((c) => (
              <label key={c}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border cursor-pointer text-[15px] ${
                  categories.includes(c) ? 'border-green-700 bg-green-50 text-green-900 font-medium'
                    : 'border-green-800/15 text-secondary hover:bg-green-50/50'}`}>
                <input type="checkbox" className="accent-green-700 w-[18px] h-[18px]"
                  checked={categories.includes(c)} onChange={() => toggleCategory(c)} />
                {c}
              </label>
            ))}
          </div>
        </div>

        {categories.length > 0 && (
          <>
            <div className="mb-6">
              <span className="form-label">First-login paperwork</span>
              <p className="text-sm text-muted mb-2.5">
                What they'll review and sign when they activate. Category picks prefill
                this — adjust as needed; the invitation email lists it.
              </p>
              {shownDocKeys.length === 0 ? (
                <p className="text-sm text-muted">No documents for this category yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {shownDocKeys.map((key) => {
                    const alreadySigned = signedTemplates.includes(key);
                    return (
                      <label key={key}
                        className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border ${
                          alreadySigned ? 'border-green-800/20 bg-cream-100/60 cursor-default'
                          : effectiveDocs.has(key) ? 'border-green-700 bg-green-50 cursor-pointer'
                          : 'border-green-800/15 hover:bg-green-50/50 cursor-pointer'}`}>
                        <input type="checkbox" className="accent-green-700 w-[18px] h-[18px] mt-0.5"
                          checked={alreadySigned || effectiveDocs.has(key)}
                          disabled={alreadySigned}
                          onChange={() => toggleDoc(key)} />
                        <span className="min-w-0">
                          <span className="block text-[14px] leading-snug text-green-900">{titleFor(key)}</span>
                          {alreadySigned && <span className="block text-[11.5px] text-green-700 mt-0.5">Already signed</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mb-6">
              <span className="form-label">Offerings (optional)</span>
              <p className="text-sm text-muted mb-2.5">
                What they're purchasing — their first order. Each is its own item; the
                mechanics (single, pack, or recurring) are shown per line.
              </p>
              {visibleOfferings.length === 0 ? (
                <p className="text-sm text-muted">
                  {categories.length === 0
                    ? 'Choose a category above to see its offerings.'
                    : 'No purchasable offerings for this category.'}
                </p>
              ) : (
                <div className="space-y-4 max-h-72 overflow-y-auto border border-green-800/15 rounded-lg p-4">
                  {Object.entries(
                    visibleOfferings.reduce<Record<string, Offering[]>>((acc, o) => {
                      const k = o.service_type ?? 'Other';
                      (acc[k] ??= []).push(o); return acc;
                    }, {}),
                  ).map(([svc, items]) => (
                    <div key={svc}>
                      <p className="text-xs uppercase tracking-wide text-secondary/70 mb-1.5">
                        {svc.replace(/_/g, ' ').toLowerCase()}
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {items.map((o) => (
                          <label key={o.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                              offeringIds.includes(o.id) ? 'border-green-700 bg-green-50 text-green-900'
                                : 'border-green-800/15 text-secondary hover:bg-green-50/50'}`}>
                            <input type="checkbox" className="accent-green-700 w-[17px] h-[17px]"
                              checked={offeringIds.includes(o.id)} onChange={() => toggleOffering(o.id)} />
                            <span className="min-w-0 flex-1">
                              {o.name}
                              {o.config_kind === 'recurring' && o.weekly_frequency
                                ? <span className="text-xs text-muted"> · {o.weekly_frequency}×/wk monthly</span>
                                : o.config_kind === 'scheduled' && (o.unit_count ?? 1) > 1
                                  ? <span className="text-xs text-muted"> · {o.unit_count} sessions</span>
                                  : null}
                            </span>
                            <span className="text-green-900 whitespace-nowrap">{money(o.price_amount ?? 0)}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {offeringIds.length > 0 && (
              <div className="mb-6">
                <span className="form-label">Payment</span>
                <p className="text-sm text-muted mb-2.5">Total {money(offeringTotal)}. Mark how much they've paid so far.</p>
                <div className="flex flex-wrap gap-3 mb-3">
                  {(['unpaid', 'partial', 'paid'] as const).map((s) => (
                    <label key={s}
                      className={`px-4 py-2 rounded-lg border cursor-pointer text-sm capitalize ${
                        payStatus === s ? 'border-green-700 bg-green-50 text-green-900 font-medium'
                          : 'border-green-800/15 text-secondary hover:bg-green-50/50'}`}>
                      <input type="radio" name="paystatus" className="hidden"
                        checked={payStatus === s} onChange={() => setPayStatus(s)} />
                      {s}
                    </label>
                  ))}
                </div>
                {payStatus === 'partial' && (
                  <Field label="Amount already paid">
                    <input type="number" min={0} max={offeringTotal} step="0.01" className="form-input w-40"
                      value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)} placeholder="0.00" />
                    <p className="text-xs text-muted mt-1">
                      Balance shown to them: {money(Math.max(offeringTotal - (Number(partialAmount) || 0), 0))}
                    </p>
                  </Field>
                )}
                {payStatus !== 'unpaid' && (
                  <Field label="Payment method">
                    <select className="form-input w-48" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                      {['Zelle', 'Cash', 'Check', 'Card', 'Other'].map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                )}
              </div>
            )}

            <Field label="Notes (optional)">
              <textarea rows={2} className="form-input resize-none" value={notes}
                onChange={(e) => setNotes(e.target.value)} placeholder="Internal note about this invite" />
            </Field>
          </>
        )}

        <button type="submit" disabled={working || !email.trim() || categories.length === 0}
          className="btn-primary">
          {working ? 'Sending…' : primaryLabel}
        </button>
        {error && <p className="form-error mt-4" role="alert">{error}</p>}
      </form>

      {!hideResult && result && (
        <div className="bg-green-50 border border-green-200 p-5 mt-6 text-sm rounded-lg">
          <p className="text-green-800 mb-2">
            Invitation sent to <strong>{result.email}</strong>
            {result.emailed ? '.' : '. (Email provider not configured — copy the link below.)'}
          </p>
          <p className="text-green-900/70 text-xs mb-1">
            This is the link in their email. It stays here until you send a new invitation.
          </p>
          <code className="block break-all text-xs text-green-900 bg-white border border-green-200 p-2 rounded">
            {result.url}
          </code>
        </div>
      )}
    </>
  );
}
