import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { useToast } from '../../../lib/ops';
import { listContacts } from '../../../lib/api';
import { contactName, type Contact } from '../../../lib/ops/types';
import {
  fetchLeaseTerms,
  saveLeaseTerms,
  generateLeaseAvailability,
  type LeaseTerms,
  type LeasePaymentOption,
} from '../../../lib/ops/api-lease';

/*
 * Phase 8 — structured lease terms for one horse + a button to generate the
 * leased horse's availability onto the calendar. Payment options, days
 * used/unavailable, lessons-per-day by riding level, exclusivity rules,
 * events authorization, notes.
 */
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const EMPTY: LeaseTerms = {
  horse_id: '',
  lessee_contact_id: null,
  payment_options: [],
  days_used: [],
  days_unavailable: [],
  lessons_per_day: {},
  exclusivity_rules: [],
  events_authorized: false,
  shared_with_contact_id: null,
  notes: null,
};

export function LeaseTermsPanel({ horseId, horseName, onClose }: { horseId: string; horseName: string; onClose: () => void }) {
  const [t, setT] = useState<LeaseTerms>({ ...EMPTY, horse_id: horseId });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [weeks, setWeeks] = useState('4');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    fetchLeaseTerms(horseId).then((r) => { if (r) setT({ ...EMPTY, ...r, horse_id: horseId }); }).catch(() => {});
    listContacts().then(setContacts).catch(() => setContacts([]));
  }, [horseId]);

  const toggle = (key: 'days_used' | 'days_unavailable', d: string) =>
    setT((p) => ({ ...p, [key]: p[key].includes(d) ? p[key].filter((x) => x !== d) : [...p[key], d] }));
  const setLevel = (lvl: 'beginner' | 'intermediate' | 'advanced', v: string) =>
    setT((p) => ({ ...p, lessons_per_day: { ...p.lessons_per_day, [lvl]: v === '' ? undefined : Number(v) } }));
  const setPay = (i: number, patch: Partial<LeasePaymentOption>) =>
    setT((p) => ({ ...p, payment_options: p.payment_options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));

  async function save() {
    setBusy(true); setError(null); setMsg(null);
    try { await saveLeaseTerms(t); setMsg('Lease terms saved.'); } catch (e) { setError(toErrorMessage(e, 'Could not save.')); } finally { setBusy(false); }
  }
  async function generate() {
    setBusy(true); setError(null); setMsg(null);
    try {
      await saveLeaseTerms(t);
      const n = await generateLeaseAvailability(horseId, Number(weeks) || 4);
      toast.success(`Generated ${n} availability block${n === 1 ? '' : 's'} on the calendar.`);
      setMsg(`Generated ${n} availability blocks.`);
    } catch (e) { setError(toErrorMessage(e, 'Could not generate availability.')); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-green-800/70">Lease terms for <strong>{horseName}</strong>.</p>

      <div className="grid grid-cols-1 gap-3">
        <label className="text-sm">
          <span className="form-label">Lessee</span>
          <select className="form-input" value={t.lessee_contact_id ?? ''} onChange={(e) => setT((p) => ({ ...p, lessee_contact_id: e.target.value || null }))}>
            <option value="">Select…</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{contactName(c)}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="form-label">Shared with another rider (optional)</span>
          <select className="form-input" value={t.shared_with_contact_id ?? ''} onChange={(e) => setT((p) => ({ ...p, shared_with_contact_id: e.target.value || null }))}>
            <option value="">Not shared</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{contactName(c)}</option>)}
          </select>
        </label>
      </div>

      {/* payment options */}
      <div>
        <p className="form-label mb-1">Payment options</p>
        {t.payment_options.map((o, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <input type="number" className="form-input w-28" placeholder="$" value={o.amount ?? ''} onChange={(e) => setPay(i, { amount: e.target.value === '' ? null : Number(e.target.value) })} />
            <input className="form-input flex-1" placeholder="Describe" value={o.describe} onChange={(e) => setPay(i, { describe: e.target.value })} />
            <button type="button" className="text-muted px-2" onClick={() => setT((p) => ({ ...p, payment_options: p.payment_options.filter((_, j) => j !== i) }))}>×</button>
          </div>
        ))}
        <button type="button" className="text-xs text-green-800 underline" onClick={() => setT((p) => ({ ...p, payment_options: [...p.payment_options, { amount: null, describe: '' }] }))}>+ Add payment option</button>
      </div>

      {/* days */}
      <div>
        <p className="form-label mb-1">Days used by the lessee</p>
        <div className="flex flex-wrap gap-1.5">
          {DOW.map((d) => (
            <button key={d} type="button" aria-pressed={t.days_used.includes(d)} onClick={() => toggle('days_used', d)}
              className={`text-xs px-2 py-1 rounded-full border ${t.days_used.includes(d) ? 'bg-green-800 text-white border-green-800' : 'bg-white text-green-800 border-green-800/30'}`}>{d}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="form-label mb-1">Days unavailable</p>
        <div className="flex flex-wrap gap-1.5">
          {DOW.map((d) => (
            <button key={d} type="button" aria-pressed={t.days_unavailable.includes(d)} onClick={() => toggle('days_unavailable', d)}
              className={`text-xs px-2 py-1 rounded-full border ${t.days_unavailable.includes(d) ? 'bg-red-700 text-white border-red-700' : 'bg-white text-red-700 border-red-700/30'}`}>{d}</button>
          ))}
        </div>
      </div>

      {/* lessons per day by level */}
      <div>
        <p className="form-label mb-1">Lessons per day by rider level</p>
        <div className="grid grid-cols-3 gap-2">
          {(['beginner', 'intermediate', 'advanced'] as const).map((lvl) => (
            <label key={lvl} className="text-xs">
              <span className="capitalize block text-muted mb-0.5">{lvl}</span>
              <input type="number" min="0" className="form-input" value={t.lessons_per_day[lvl] ?? ''} onChange={(e) => setLevel(lvl, e.target.value)} />
            </label>
          ))}
        </div>
      </div>

      {/* exclusivity rules */}
      <label className="text-sm">
        <span className="form-label">Exclusivity rules (one per line)</span>
        <textarea rows={3} className="form-input resize-none" value={t.exclusivity_rules.join('\n')}
          onChange={(e) => setT((p) => ({ ...p, exclusivity_rules: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) }))}
          placeholder="e.g. 3 beginner OK; any advanced → none else that day" />
      </label>

      <label className="inline-flex items-center gap-2 text-sm text-green-900">
        <input type="checkbox" checked={t.events_authorized} onChange={(e) => setT((p) => ({ ...p, events_authorized: e.target.checked }))} />
        Events / competition authorized
      </label>

      <label className="text-sm">
        <span className="form-label">Notes</span>
        <textarea rows={2} className="form-input resize-none" value={t.notes ?? ''} onChange={(e) => setT((p) => ({ ...p, notes: e.target.value || null }))} />
      </label>

      {msg && <p className="text-green-800 text-sm">{msg}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}

      <div className="flex items-center gap-2 border-t border-green-800/10 pt-3">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => void save()}>Save terms</button>
        <span className="flex items-center gap-1 text-sm ml-auto">
          <select className="form-input py-1 w-20" value={weeks} onChange={(e) => setWeeks(e.target.value)}>
            {['2', '4', '8', '12'].map((w) => <option key={w} value={w}>{w} wks</option>)}
          </select>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => void generate()}>Generate availability</button>
        </span>
      </div>
      <button type="button" className="text-sm text-green-800/70 underline self-start" onClick={onClose}>Close</button>
    </div>
  );
}

export default LeaseTermsPanel;
