import { useEffect, useState } from 'react';
import { Loader2, Plus, Check } from 'lucide-react';
import { Modal } from '../ops/kit/Modal';
import { useFormDraft, type SaveStatus } from '../../lib/formState';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  addStableItem, addVendor, listVendors,
  type StableItemKind, type StableItemOwnerKind, type Vendor,
} from '../../lib/stable';

/**
 * MY STABLE editors — the add forms for gear and supplies.
 *   AddItemModal → addStableItem (gear|supply), with a VendorPicker that either
 *                  selects an existing shared vendor or adds a new one (addVendor)
 *                  with an optional "share to community Resources" toggle.
 * Both close only by a control — never the backdrop, never Escape — and what was
 * typed lives in browser storage so an accidental close loses nothing.
 */

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring';
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold mb-1.5">{children}</label>;
}

function Shell({ title, onClose, onClear, saveStatus, children }: {
  title: string;
  onClose: () => void;
  onClear?: () => void;
  saveStatus?: SaveStatus;
  children: React.ReactNode;
}) {
  return (
    <Modal open onClose={onClose} title={title} size="window"
      onClear={onClear} saveStatus={saveStatus} panelClassName="bg-cream">
      {children}
    </Modal>
  );
}

function VendorPicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [adding, setAdding] = useState(false);
  const [nv, setNv] = useState({ name: '', category: '', url: '' });
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);

  const reload = () => { listVendors().then(setVendors).catch(() => setVendors([])); };
  useEffect(reload, []);

  async function saveNew() {
    if (!nv.name.trim()) return;
    setBusy(true);
    try {
      const id = await addVendor({ name: nv.name.trim(), category: nv.category || null, url: nv.url || null, share });
      reload(); onChange(id); setAdding(false); setNv({ name: '', category: '', url: '' }); setShare(false);
    } catch { /* surfaced by caller if needed */ }
    finally { setBusy(false); }
  }

  return (
    <div>
      <FieldLabel>Vendor (where you reorder)</FieldLabel>
      {!adding ? (
        <div className="flex gap-2">
          <select className={inputCls + ' flex-1'} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">None</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}{v.category ? ` · ${v.category}` : ''}</option>)}
          </select>
          <button type="button" onClick={() => setAdding(true)}
            className="px-3 rounded-lg border border-green-800/15 text-secondary hover:bg-green-50 inline-flex items-center gap-1 text-sm">
            <Plus size={15} /> New
          </button>
        </div>
      ) : (
        <div className="border border-green-800/10 rounded-xl p-3 bg-white flex flex-col gap-2.5">
          <input className={inputCls} value={nv.name} onChange={(e) => setNv({ ...nv, name: e.target.value })} placeholder="Vendor name" />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} value={nv.category} onChange={(e) => setNv({ ...nv, category: e.target.value })} placeholder="Category (e.g. Suppliers)" />
            <input className={inputCls} value={nv.url} onChange={(e) => setNv({ ...nv, url: e.target.value })} placeholder="Reorder URL" />
          </div>
          <button type="button" onClick={() => setShare((v) => !v)}
            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[11.5px] font-medium self-start ${share ? 'bg-green-50 border-green-300 text-green-800' : 'border-green-800/15 text-secondary'}`}>
            <span className={`w-3.5 h-3.5 rounded grid place-items-center border ${share ? 'bg-green-700 border-green-700 text-white' : 'border-green-800/30'}`}>{share && <Check size={10} />}</span>
            Add to community Resources
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={saveNew} disabled={busy}
              className="flex-1 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 inline-flex items-center justify-center gap-2 disabled:opacity-60">
              {busy && <Loader2 size={15} className="animate-spin" />} Save vendor
            </button>
            <button type="button" onClick={() => setAdding(false)} className="px-3 py-2 rounded-lg border border-green-800/15 text-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AddItemModal({
  kind, onClose, onDone, ownerKind = 'contact',
}: {
  kind: StableItemKind; onClose: () => void; onDone: () => void;
  /** 'org' when adding to the business's stable while acting as the company
   *  (D7) — otherwise the signed-in member's own gear/supply, unchanged. */
  ownerKind?: StableItemOwnerKind;
}) {
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const draft = useFormDraft(`stable.add-item.${kind}`, { name, detail, vendorId }, (d) => {
    if (typeof d.name === 'string') setName(d.name);
    if (typeof d.detail === 'string') setDetail(d.detail);
    if (typeof d.vendorId === 'string') setVendorId(d.vendorId);
  });

  function clearForm() {
    setName(''); setDetail(''); setVendorId(null); setErr(null);
    draft.clear();
  }

  async function submit() {
    if (!name.trim()) { setErr('A name is required.'); return; }
    setBusy(true); setErr(null);
    try {
      await addStableItem(kind, { name: name.trim(), detail: detail || null, vendor_id: vendorId }, ownerKind);
      draft.clear();
      onDone(); onClose();
    } catch (e) { setErr(toErrorMessage(e, 'Could not save.')); }
    finally { setBusy(false); }
  }

  return (
    <Shell title={kind === 'gear' ? 'Add gear' : 'Add a supply'} onClose={onClose}
      onClear={clearForm} saveStatus={draft.status}>
      <div className="flex flex-col gap-3">
        <div><FieldLabel>Name</FieldLabel><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={kind === 'gear' ? 'e.g. Antares saddle' : 'e.g. Joint supplement'} /></div>
        <div><FieldLabel>Detail</FieldLabel><input className={inputCls} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={kind === 'gear' ? '17.5" · medium tree' : 'Monthly · 1 scoop AM'} /></div>
        <VendorPicker value={vendorId} onChange={setVendorId} />
        {err && <p className="text-sm text-red-700">{err}</p>}
        <button type="button" onClick={submit} disabled={busy}
          className="w-full py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} Save
        </button>
      </div>
    </Shell>
  );
}
