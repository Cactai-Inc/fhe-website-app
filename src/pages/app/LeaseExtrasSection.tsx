import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../lib/ops/errors';
import { staffContactOptions, type ContactOption } from '../../lib/horses';
import {
  fetchLeaseParticipants,
  addLeaseParticipant,
  removeLeaseParticipant,
  fetchLeasePaymentOptions,
  addLeasePaymentOption,
  removeLeasePaymentOption,
  type LeaseParticipant,
  type LeasePaymentOptionRow,
} from '../../lib/ops/api-lease';

/*
 * Lease realign S5 — the partial-lease participants + payment options section,
 * shown on the lease contract. Any party or staff may add a participant (a
 * co-lessee with optional days / hours / usage % / payment %) or a payment
 * option ($ + free-text sub-terms) while the lease is not yet executed.
 */
export function LeaseExtrasSection({ documentId, editable }: { documentId: string; editable: boolean }) {
  const [participants, setParticipants] = useState<LeaseParticipant[]>([]);
  const [options, setOptions] = useState<LeasePaymentOptionRow[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // add-participant form
  const [pc, setPc] = useState('');
  const [pDays, setPDays] = useState('');
  const [pHours, setPHours] = useState('');
  const [pUsage, setPUsage] = useState('');
  const [pPay, setPPay] = useState('');
  // add-payment-option form
  const [oAmt, setOAmt] = useState('');
  const [oDesc, setODesc] = useState('');

  const load = useCallback(() => {
    fetchLeaseParticipants(documentId).then(setParticipants).catch(() => {});
    fetchLeasePaymentOptions(documentId).then(setOptions).catch(() => {});
  }, [documentId]);
  useEffect(() => {
    load();
    staffContactOptions().then(setContacts).catch(() => setContacts([]));
  }, [load]);

  async function addParticipant() {
    if (!pc) return;
    setBusy(true); setError(null);
    try {
      await addLeaseParticipant({
        documentId, contactId: pc,
        days: pDays || null, hours: pHours || null,
        usagePct: pUsage ? Number(pUsage) : null, paymentPct: pPay ? Number(pPay) : null,
      });
      setPc(''); setPDays(''); setPHours(''); setPUsage(''); setPPay('');
      load();
    } catch (e) { setError(toErrorMessage(e, 'Could not add participant.')); } finally { setBusy(false); }
  }
  async function addOption() {
    if (!oAmt && !oDesc.trim()) return;
    setBusy(true); setError(null);
    try {
      await addLeasePaymentOption(documentId, oAmt ? Number(oAmt) : null, oDesc);
      setOAmt(''); setODesc('');
      load();
    } catch (e) { setError(toErrorMessage(e, 'Could not add payment option.')); } finally { setBusy(false); }
  }

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-6 mb-5">
      <h2 className="font-serif text-green-800 mb-3">Partial-lease participants &amp; payment options</h2>

      {/* Payment options */}
      <p className="form-label mb-1">Payment options</p>
      {options.length === 0 && <p className="text-sm text-muted mb-2">None yet.</p>}
      <ul className="flex flex-col gap-1 mb-2">
        {options.map((o) => (
          <li key={o.id} className="flex items-center justify-between text-sm">
            <span className="text-green-900">{o.amount != null ? `$${o.amount}` : ''}{o.describe ? ` — ${o.describe}` : ''}</span>
            {editable && (
              <button type="button" className="text-red-700 text-xs" onClick={() => void removeLeasePaymentOption(o.id).then(load)}>Remove</button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="flex gap-2 mb-5">
          <input type="number" step="0.01" className="form-input w-28" placeholder="$" value={oAmt} onChange={(e) => setOAmt(e.target.value)} />
          <input className="form-input flex-1" placeholder="Sub-terms for this amount" value={oDesc} onChange={(e) => setODesc(e.target.value)} />
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void addOption()}>Add</button>
        </div>
      )}

      {/* Participants */}
      <p className="form-label mb-1">Participants (co-lessees)</p>
      {participants.length === 0 && <p className="text-sm text-muted mb-2">Just the primary lessee.</p>}
      <ul className="flex flex-col gap-1 mb-2">
        {participants.map((p) => (
          <li key={p.contact_id} className="flex items-center justify-between text-sm">
            <span className="text-green-900">
              {p.name || 'Participant'}
              {p.days_used ? ` · ${p.days_used}` : ''}{p.hours ? ` · ${p.hours}` : ''}
              {p.usage_pct != null ? ` · ${p.usage_pct}% use` : ''}{p.payment_pct != null ? ` · pays ${p.payment_pct}%` : ''}
            </span>
            {editable && (
              <button type="button" className="text-red-700 text-xs" onClick={() => void removeLeaseParticipant(documentId, p.contact_id).then(load)}>Remove</button>
            )}
          </li>
        ))}
      </ul>
      {editable && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
          <label className="text-xs col-span-2">
            <span className="text-muted">Contact</span>
            <select className="form-input" value={pc} onChange={(e) => setPc(e.target.value)}>
              <option value="">Select…</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <input className="form-input" placeholder="Days" value={pDays} onChange={(e) => setPDays(e.target.value)} />
          <input className="form-input" placeholder="Hours" value={pHours} onChange={(e) => setPHours(e.target.value)} />
          <input type="number" className="form-input" placeholder="Use %" value={pUsage} onChange={(e) => setPUsage(e.target.value)} />
          <input type="number" className="form-input" placeholder="Pay %" value={pPay} onChange={(e) => setPPay(e.target.value)} />
          <button type="button" className="btn-secondary col-span-2 sm:col-span-1" disabled={busy || !pc} onClick={() => void addParticipant()}>Add</button>
        </div>
      )}
      <p className="form-hint mt-2">All fields optional — a blank usage % is worked out from everyone’s chosen days and times.</p>
      {error && <p role="alert" className="form-error mt-2">{error}</p>}
    </section>
  );
}

export default LeaseExtrasSection;
