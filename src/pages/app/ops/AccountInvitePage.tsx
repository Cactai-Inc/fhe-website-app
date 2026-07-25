import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  adminSendInvitation, categoryDocumentDefaults,
  CLIENT_CATEGORIES, CATEGORY_TOKEN, type CategoryDocDefault,
} from '../../../lib/admin';
import { fetchOfferings } from '../../../lib/api';
import type { Offering, Segment } from '../../../lib/types';

/**
 * NEW CLIENT / INVITE CONFIG (/app/ops/accounts/new). One action: configure the
 * account and SEND the invitation. Inputs (owner spec 2026-07-25):
 *   - email only (name is captured at the invitee's first-login intake),
 *   - account category (Guest / Rider / Horse Owner — stackable),
 *   - documents to assign (prefilled by category, adjustable),
 *   - offering(s) — gated by the chosen category's segments,
 *   - payment status paid / partial / unpaid (partial reduces the balance shown
 *     to the invitee).
 * Send runs the canonical spine (provision_client_invitation) and shows the
 * persistent invitation link, which stays until a fresh invite is generated.
 * Staff account creation lives on Team & access — not here.
 */

// Category → offering segments it may purchase (union when stacked).
const CATEGORY_SEGMENTS: Record<string, Segment[]> = {
  Guest: ['acquisition'],
  Rider: ['rider', 'acquisition'],
  'Horse owner': ['horse', 'acquisition'],
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <span className="form-label">{label}</span>
      {children}
    </div>
  );
}

function money(n: number): string {
  return `$${Number(n).toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2,
  })}`;
}

export default function AccountInvitePage() {
  useDocumentTitle('New client');
  const [email, setEmail] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<CategoryDocDefault[]>([]);
  // docChecked === null means "follow category defaults"; a Set means the admin
  // has taken explicit control of the document set.
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

  useEffect(() => {
    categoryDocumentDefaults().then(setDefaults).catch(() => setDefaults([]));
    fetchOfferings().then(setOfferings).catch(() => setOfferings([]));
  }, []);

  // Documents the chosen categories imply (union), used as the default set.
  const derivedDocKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const d of defaults) if (categories.includes(d.category)) keys.add(d.template_key);
    return keys;
  }, [defaults, categories]);
  const titleFor = (key: string) => defaults.find((d) => d.template_key === key)?.title ?? key;
  // The doc set actually sent: explicit picks if the admin took control, else derived.
  const effectiveDocs = docChecked ?? derivedDocKeys;
  // Rows shown for toggling = union of derived + explicit (so a removed default can be re-added).
  const shownDocKeys = useMemo(() => {
    const s = new Set(derivedDocKeys);
    if (docChecked) docChecked.forEach((k) => s.add(k));
    return Array.from(s);
  }, [derivedDocKeys, docChecked]);

  // Offerings visible for the chosen categories (segment-gated), grouped by parent.
  const allowedSegments = useMemo(() => {
    const s = new Set<Segment>();
    for (const c of categories) (CATEGORY_SEGMENTS[c] ?? []).forEach((seg) => s.add(seg));
    return s;
  }, [categories]);
  const visibleOfferings = offerings.filter(
    (o) => allowedSegments.has(o.segment) && (o.tiers?.length ?? 0) > 0);

  const offeringTotal = useMemo(() => {
    let t = 0;
    for (const o of offerings) for (const tier of o.tiers ?? [])
      if (offeringIds.includes(tier.id)) t += tier.price_amount;
    return t;
  }, [offerings, offeringIds]);

  function toggleCategory(c: string) {
    setCategories((prev) => {
      const next = prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c];
      // Category change re-derives docs (drop explicit control) and prunes
      // offerings no longer in an allowed segment.
      setDocChecked(null);
      const segs = new Set<Segment>();
      for (const cat of next) (CATEGORY_SEGMENTS[cat] ?? []).forEach((s) => segs.add(s));
      setOfferingIds((ids) => ids.filter((id) => {
        const seg = offerings.find((o) => o.tiers?.some((t) => t.id === id))?.segment;
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
      // Send an explicit doc set only if the admin diverged from the category default.
      const finalDocs = docChecked ? Array.from(effectiveDocs) : undefined;
      const r = await adminSendInvitation({
        email: email.trim(),
        categories: tokens,
        ...(offeringIds.length ? { offeringIds } : {}),
        ...(finalDocs ? { templateKeys: finalDocs } : {}),
        paymentStatus: payStatus,
        ...(payStatus === 'partial' ? { partialAmount: Number(partialAmount) || 0 } : {}),
        ...(payStatus !== 'unpaid' ? { paymentMethod } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setResult({ url: r.registerUrl, emailed: r.emailed, email: email.trim() });
      // Reset the form for the next invite; the link stays visible below.
      setEmail(''); setCategories([]); setDocChecked(null); setOfferingIds([]);
      setPayStatus('unpaid'); setPartialAmount(''); setNotes('');
    } catch (err) {
      setError(toErrorMessage(err, 'Could not create the invitation.'));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <Link to="/app/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Clients
      </Link>
      <h1 className="font-serif text-2xl text-green-900 mb-1">New client</h1>
      <p className="text-sm text-green-800/70 mb-6">
        Configure the account and send the invitation. We only need their email —
        they'll add their name and details when they activate the account.
      </p>

      <form onSubmit={submit}>
        <Field label="Email">
          <input type="email" required className="form-input" value={email}
            onChange={(e) => setEmail(e.target.value)} placeholder="their@email.com" />
        </Field>

        <div className="mb-6">
          <span className="form-label">Account category</span>
          <p className="text-sm text-muted mb-2.5">What kind of client — check everything that applies.</p>
          <div className="flex flex-wrap gap-3">
            {CLIENT_CATEGORIES.map((c) => (
              <label key={c}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border cursor-pointer text-[15px] ${
                  categories.includes(c)
                    ? 'border-green-700 bg-green-50 text-green-900 font-medium'
                    : 'border-green-800/15 text-secondary hover:bg-green-50/50'
                }`}>
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
                  {shownDocKeys.map((key) => (
                    <label key={key}
                      className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border cursor-pointer ${
                        effectiveDocs.has(key) ? 'border-green-700 bg-green-50' : 'border-green-800/15 hover:bg-green-50/50'
                      }`}>
                      <input type="checkbox" className="accent-green-700 w-[18px] h-[18px] mt-0.5"
                        checked={effectiveDocs.has(key)} onChange={() => toggleDoc(key)} />
                      <span className="block text-[14px] leading-snug text-green-900">{titleFor(key)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6">
              <span className="form-label">Offerings (optional)</span>
              <p className="text-sm text-muted mb-2.5">What they're purchasing — shown for the chosen category.</p>
              {visibleOfferings.length === 0 ? (
                <p className="text-sm text-muted">No purchasable offerings for this category.</p>
              ) : (
                <div className="space-y-4 max-h-72 overflow-y-auto border border-green-800/15 rounded-lg p-4">
                  {visibleOfferings.map((o) => (
                    <div key={o.id}>
                      <p className="text-xs uppercase tracking-wide text-secondary/70 mb-1.5">{o.name}</p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {(o.tiers ?? []).map((t) => (
                          <label key={t.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                              offeringIds.includes(t.id) ? 'border-green-700 bg-green-50 text-green-900' : 'border-green-800/15 text-secondary hover:bg-green-50/50'
                            }`}>
                            <input type="checkbox" className="accent-green-700 w-[17px] h-[17px]"
                              checked={offeringIds.includes(t.id)} onChange={() => toggleOffering(t.id)} />
                            <span className="min-w-0 flex-1">{t.label}</span>
                            <span className="text-green-900 whitespace-nowrap">{money(t.price_amount)}</span>
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
                        payStatus === s ? 'border-green-700 bg-green-50 text-green-900 font-medium' : 'border-green-800/15 text-secondary hover:bg-green-50/50'
                      }`}>
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
          {working ? 'Sending…' : 'Create & send invitation'}
        </button>
        {error && <p className="form-error mt-4" role="alert">{error}</p>}
      </form>

      {result && (
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
    </div>
  );
}
