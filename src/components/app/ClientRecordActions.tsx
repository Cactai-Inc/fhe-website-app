import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  categoryDocumentDefaults, getContactRequiredDocuments, setContactRequiredDocuments,
  adminAttachOfferings, staffAssignableTemplates, staffAssignDocuments,
  type CategoryDocDefault, type AssignableTemplate, type AssignDocumentsResult,
} from '../../lib/admin';
import {
  contactHorseRecords, horseRecordCompleteness, requestHorseRecordCompletion,
  type HorseIntakeRecord,
} from '../../lib/horses';
import { fetchOfferings } from '../../lib/api';
import type { Offering } from '../../lib/types';

/** The small "+ add" button these panels share. */
function TabCreate({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-green-800 text-white text-xs font-medium hover:bg-green-700 focus-ring mb-3">
      <Plus size={13} /> {label}
    </button>
  );
}

/**
 * CLIENT-RECORD ACTIONS — the working parts of the old Clients page, extracted
 * so they can live on the contact dossier.
 *
 * These four were the reason the Clients page could not simply be deleted: they
 * existed NOWHERE else. Each was already keyed on `contactId` rather than a
 * user_id, which is what makes this a move rather than a rewrite — and it is why
 * they work unchanged for the 13 of 19 contacts who have no account.
 *
 * Exported from here and rendered by ContactDossierModal; Admin.tsx no longer
 * defines them.
 */

/** 3f: the assignment picker — CONTRACTS (the clause-engine path, unchanged)
 *  and DOCUMENTS (the flat sign-only family). Selected documents APPEND to the
 *  person's pending set; assignment never gates staff operations — the wall
 *  constrains only the person's own session. On-file never blocks selection. */
export function AssignDocumentsModal({ contactId, onClose, onAssigned }: {
  contactId: string; onClose: () => void; onAssigned: () => void;
}) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<AssignableTemplate[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Explicit confirmation: the modal stays open after a successful assign and
  // states exactly what happened (incl. which signed docs were superseded for
  // re-signature) — no more silent close-and-nothing-changed.
  const [result, setResult] = useState<AssignDocumentsResult | null>(null);

  useEffect(() => {
    staffAssignableTemplates(contactId).then(setTemplates).catch((e) =>
      setErr(e instanceof Error ? e.message : 'Could not load templates.'));
  }, [contactId]);

  const toggle = (k: string) =>
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  async function assign() {
    if (picked.length === 0) return;
    setBusy(true); setErr(null);
    try {
      const r = await staffAssignDocuments(contactId, picked);
      setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not assign.');
    } finally { setBusy(false); }
  }

  if (result) {
    const titleFor = (k: string) => templates.find((t) => t.template_key === k)?.title ?? k;
    return (
      <div className="fixed inset-0 z-[80] bg-green-950/40 flex items-center justify-center p-4" onClick={onAssigned}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="font-serif text-xl text-green-900 mb-2">Documents assigned</h2>
          <p className="text-sm text-green-900 mb-3">
            {result.assigned.length} document{result.assigned.length === 1 ? '' : 's'} now
            awaiting their signature — they'll be walled to sign at their next sign-in,
            and the list below shows as “Awaiting signature” on this page.
          </p>
          <ul className="text-sm text-green-900 mb-3 flex flex-col gap-1">
            {result.assigned.map((k) => (
              <li key={k} className="flex items-baseline justify-between gap-3 border border-green-800/10 rounded-lg px-3 py-1.5">
                <span>{titleFor(k)}</span>
                {result.resign.includes(k) && (
                  <span className="text-[11px] text-gold-800 whitespace-nowrap">replaces signed copy</span>
                )}
              </li>
            ))}
          </ul>
          {result.resign.length > 0 && (
            <p className="text-xs text-muted mb-4">
              Their previously signed {result.resign.length === 1 ? 'copy is' : 'copies are'} kept
              on file as superseded evidence.
            </p>
          )}
          <div className="flex justify-end">
            <button type="button" className="btn-primary" onClick={onAssigned}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  const onFile = (t: AssignableTemplate) =>
    t.on_file_status === 'none' ? 'None on file'
    : t.on_file_status === 'superseded' ? 'Superseded on file'
    : `Executed v${t.on_file_version ?? t.version}${t.on_file_date ? ` on ${new Date(t.on_file_date).toLocaleDateString()}` : ''}`;

  return (
    <div className="fixed inset-0 z-[80] bg-green-950/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto overscroll-contain" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-serif text-xl text-green-900 mb-3">Assign documents</h2>

        <p className="text-[11px] uppercase tracking-wide text-secondary/70 mb-1.5">Contracts</p>
        <button type="button" className="btn-outline-gold w-full justify-center mb-4"
          onClick={() => navigate('/app/ops/contracts/new')}>
          New contract (lease / purchase) →
        </button>

        <p className="text-[11px] uppercase tracking-wide text-secondary/70 mb-1.5">Documents</p>
        <div className="flex flex-col gap-1.5 mb-4">
          {templates.map((t) => (
            <label key={t.template_key}
              className="flex items-start gap-2.5 border border-green-800/10 rounded-lg px-3 py-2 cursor-pointer hover:border-green-800/25">
              <input type="checkbox" className="accent-green-700 mt-0.5"
                checked={picked.includes(t.template_key)} onChange={() => toggle(t.template_key)} />
              <span className="min-w-0">
                <span className="block text-sm text-green-900">{t.title}</span>
                <span className="block text-xs text-muted">
                  {onFile(t)}{t.wall_gating ? ' · gates sign-in' : ''}
                </span>
              </span>
            </label>
          ))}
          {templates.length === 0 && !err && <p className="text-sm text-muted">Loading…</p>}
        </div>

        {err && <p role="alert" className="text-sm text-red-700 mb-3">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline-gold" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" disabled={picked.length === 0 || busy} onClick={assign}>
            {busy ? 'Assigning…' : `Assign ${picked.length || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}

/** DOCUMENTS-TAB HORSE CARD — the client's horse records beside their document
 *  list: per horse, a link to the record, its completeness against the
 *  doc-required field set (not started / partially complete / complete, with
 *  what's missing), an admin-editable intake view (staff may contribute), and
 *  a "send task" action that notifies the member to finish the required fields
 *  (existing notifications machinery → their dashboard). */
export function ClientHorseRecordsCard({ contactId }: { contactId: string }) {
  const [horses, setHorses] = useState<HorseIntakeRecord[] | null>(null);
  const [taskSent, setTaskSent] = useState<Record<string, 'sending' | 'sent' | 'error'>>({});

  useEffect(() => {
    let active = true;
    contactHorseRecords(contactId)
      .then((h) => active && setHorses(h))
      .catch(() => active && setHorses([]));
    return () => { active = false; };
  }, [contactId]);

  async function sendTask(horseId: string) {
    setTaskSent((p) => ({ ...p, [horseId]: 'sending' }));
    try {
      await requestHorseRecordCompletion(horseId);
      setTaskSent((p) => ({ ...p, [horseId]: 'sent' }));
    } catch {
      setTaskSent((p) => ({ ...p, [horseId]: 'error' }));
    }
  }

  if (horses === null || horses.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-green-800/10 bg-white p-4">
      <p className="text-[11px] tracking-wide uppercase text-secondary/70 mb-2">Horse records</p>
      <div className="flex flex-col gap-2">
        {horses.map((h) => {
          const c = horseRecordCompleteness(h);
          const name = String(h.nickname || h.registered_name || 'Horse');
          const badge = c.state === 'complete' ? 'Complete'
            : c.state === 'partial' ? `Partially complete (${c.answered}/${c.total})`
            : 'Not started';
          const badgeCls = c.state === 'complete' ? 'bg-green-800 text-white'
            : c.state === 'partial' ? 'bg-gold-600 text-white' : 'bg-cream-100 text-secondary';
          const task = taskSent[h.id];
          return (
            <div key={h.id} className="border border-green-800/10 rounded-lg px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Link to={`/app/horses/${h.id}`} className="text-sm font-medium text-green-900 underline underline-offset-2">
                  {name}
                </Link>
                <span className={`text-[10.5px] uppercase tracking-wide px-2 py-0.5 rounded-full ${badgeCls}`}>{badge}</span>
                <span className="flex-1" />
                <Link to={`/app/horse-intake?horse=${h.id}`}
                  className="text-xs text-gold-800 underline underline-offset-2">Open intake form</Link>
                {c.state !== 'complete' && (
                  <button type="button" onClick={() => void sendTask(h.id)}
                    disabled={task === 'sending' || task === 'sent'}
                    className="text-xs text-green-800 border border-green-800/20 rounded-lg px-2.5 py-1 hover:bg-green-50 focus-ring disabled:opacity-60">
                    {task === 'sending' ? 'Sending…' : task === 'sent' ? 'Task sent' : 'Ask them to finish it'}
                  </button>
                )}
              </div>
              {c.state !== 'complete' && c.missing.length > 0 && (
                <p className="text-[11.5px] text-muted mt-1.5">Missing: {c.missing.join(', ')}</p>
              )}
              {task === 'error' && <p className="text-[11.5px] text-red-700 mt-1">Could not send the task.</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Orders tab action: attach offering(s) to this existing client account via the
 *  canonical spine (attach_offerings_to_client → _provision_purchase_for_offerings). */
export function AttachOfferingPanel({ contactId, onAttached }: { contactId: string; onAttached: () => void }) {
  const [open, setOpen] = useState(false);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [payStatus, setPayStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid');
  const [partial, setPartial] = useState('');
  const [method, setMethod] = useState('Zelle');
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (open) fetchOfferings().then(setOfferings).catch(() => setOfferings([])); }, [open]);

  // 4a: flat SKUs — an offering IS the purchasable item (the tier layer was
  // removed 2026-07-08). Same fix pattern as ProvisionClientForm.
  const purchasable = offerings.filter(
    (o) => o.config_kind !== 'inquire' && o.price_amount != null);
  const total = purchasable
    .filter((o) => picked.includes(o.id))
    .reduce((s, o) => s + (o.price_amount ?? 0), 0);
  const toggle = (id: string) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  async function submit() {
    if (picked.length === 0) return;
    setWorking(true); setErr(null);
    try {
      await adminAttachOfferings(contactId, picked, {
        markPaid: payStatus === 'paid',
        ...(payStatus !== 'unpaid' ? { paymentMethod: method } : {}),
        ...(payStatus === 'partial' ? { partialAmount: Number(partial) || 0 } : {}),
      });
      setOpen(false); setPicked([]); setPayStatus('unpaid'); setPartial('');
      onAttached();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not attach offering.');
    } finally { setWorking(false); }
  }

  if (!open) return <TabCreate label="Attach offering" onClick={() => setOpen(true)} />;
  return (
    <div className="border border-green-800/15 rounded-lg p-4 mb-3">
      <p className="text-sm font-medium text-green-900 mb-2">Attach offering(s)</p>
      <div className="space-y-2 max-h-56 overflow-y-auto overscroll-contain mb-3">
        {purchasable.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm text-secondary py-0.5">
            <input type="checkbox" className="accent-green-800" checked={picked.includes(o.id)} onChange={() => toggle(o.id)} />
            <span className="flex-1">{o.name}</span>
            <span>${Number(o.price_amount ?? 0).toFixed(2)}</span>
          </label>
        ))}
      </div>
      {picked.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
          <span className="text-muted">Total ${total.toFixed(2)} ·</span>
          {(['unpaid', 'partial', 'paid'] as const).map((s) => (
            <button type="button" key={s} onClick={() => setPayStatus(s)}
              className={`px-2.5 py-1 rounded border capitalize text-xs ${payStatus === s ? 'border-green-700 bg-green-50 text-green-900' : 'border-green-800/20 text-secondary'}`}>{s}</button>
          ))}
          {payStatus === 'partial' && (
            <input type="number" min={0} max={total} step="0.01" value={partial} onChange={(e) => setPartial(e.target.value)}
              placeholder="paid" className="form-input w-24 py-1 text-sm" />
          )}
          {payStatus !== 'unpaid' && (
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="form-input w-28 py-1 text-sm">
              {['Zelle', 'Cash', 'Check', 'Card', 'Other'].map((m) => <option key={m}>{m}</option>)}
            </select>
          )}
        </div>
      )}
      {err && <p className="form-error text-xs mb-2">{err}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={working || picked.length === 0} onClick={submit} className="btn-primary text-xs py-1.5 px-3">
          {working ? 'Attaching…' : 'Attach'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted px-2">Cancel</button>
      </div>
    </div>
  );
}

export function PaperworkEditor({ contactId }: { contactId: string }) {
  const [defaults, setDefaults] = useState<CategoryDocDefault[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    categoryDocumentDefaults().then(setDefaults).catch(() => setDefaults([]));
    getContactRequiredDocuments(contactId).then((keys) => setChecked(new Set(keys))).catch(() => {});
  }, [contactId]);

  const templates = (() => {
    const m = new Map<string, { title: string; categories: string[] }>();
    for (const d of defaults) {
      const t = m.get(d.template_key) ?? { title: d.title, categories: [] };
      t.categories.push(d.category);
      m.set(d.template_key, t);
    }
    return Array.from(m.entries()).map(([key, v]) => ({ key, ...v }));
  })();

  async function toggle(key: string) {
    const next = new Set(checked);
    if (next.has(key)) next.delete(key); else next.add(key);
    setChecked(next); setSaved(false);
    try {
      await setContactRequiredDocuments(contactId, Array.from(next));
      setSaved(true);
    } catch { /* row stays visibly unsaved */ }
  }

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5 mt-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-serif text-green-800 text-lg">First-login paperwork</h3>
        <span className={`text-xs ${saved ? 'text-green-700' : 'text-gold-800'}`}>{saved ? 'Saved' : 'Saving…'}</span>
      </div>
      <p className="text-sm text-muted mb-3">
        What they'll be asked to review and sign when they activate. The invitation email lists exactly this.
      </p>
      <div className="grid sm:grid-cols-2 gap-2.5">
        {templates.map((t) => (
          <label key={t.key}
            className={`flex items-start gap-2.5 px-4 py-3 rounded-lg border cursor-pointer ${
              checked.has(t.key) ? 'border-green-700 bg-green-50' : 'border-green-800/15 hover:bg-green-50/50'
            }`}>
            <input type="checkbox" className="accent-green-700 w-[18px] h-[18px] mt-0.5"
              checked={checked.has(t.key)} onChange={() => void toggle(t.key)} />
            <span className="min-w-0">
              <span className={`block text-[14px] leading-snug ${checked.has(t.key) ? 'text-green-900 font-medium' : 'text-secondary'}`}>{t.title}</span>
              <span className="block text-[11.5px] text-muted mt-0.5">Suggested for {t.categories.join(', ')}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
