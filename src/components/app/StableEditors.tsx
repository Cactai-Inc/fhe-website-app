import { useEffect, useState } from 'react';
import { X, Loader2, Plus, Check } from 'lucide-react';
import {
  addStableHorse, addStableItem, addVendor, listVendors,
  type StableItemKind, type StableOwnership, type Vendor,
} from '../../lib/stable';

/**
 * MY STABLE editors — purpose-built add forms that WRITE real rows.
 *   AddHorseModal  → addStableHorse
 *   AddItemModal   → addStableItem (gear|supply), with a VendorPicker that either
 *                    selects an existing shared vendor or adds a new one (addVendor)
 *                    with an optional "share to community Resources" toggle.
 * Overlay modals, full-sheet on mobile. onDone() refetches the caller's lists.
 */

const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring';
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold mb-1.5">{children}</label>;
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-cream w-full sm:max-w-md sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-green-800/10 sticky top-0 bg-cream">
          <h2 className="font-serif text-green-800 text-lg">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-secondary hover:text-green-800"><X size={20} /></button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function AddHorseModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    name: '', barn_name: '', breed: '', sex: '', height_hh: '', age_or_foaling: '',
    color: '', discipline: '', markings: '', location: 'Carmel Creek Ranch',
  });
  const [ownership, setOwnership] = useState<StableOwnership>('owned');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit() {
    if (!f.name.trim()) { setErr('A name is required.'); return; }
    setBusy(true); setErr(null);
    try {
      await addStableHorse({ ...f, ownership });
      onDone(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }

  return (
    <Shell title="Add a horse" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div><FieldLabel>Name</FieldLabel><input className={inputCls} value={f.name} onChange={set('name')} placeholder="Registered or full name" /></div>
        <div><FieldLabel>Barn name</FieldLabel><input className={inputCls} value={f.barn_name} onChange={set('barn_name')} placeholder="Everyday name" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>Breed</FieldLabel><input className={inputCls} value={f.breed} onChange={set('breed')} placeholder="Warmblood" /></div>
          <div><FieldLabel>Sex</FieldLabel><input className={inputCls} value={f.sex} onChange={set('sex')} placeholder="Gelding" /></div>
          <div><FieldLabel>Height</FieldLabel><input className={inputCls} value={f.height_hh} onChange={set('height_hh')} placeholder="16.1hh" /></div>
          <div><FieldLabel>Age / foaling</FieldLabel><input className={inputCls} value={f.age_or_foaling} onChange={set('age_or_foaling')} placeholder="11 yrs / 2015" /></div>
          <div><FieldLabel>Color</FieldLabel><input className={inputCls} value={f.color} onChange={set('color')} placeholder="Bay" /></div>
          <div><FieldLabel>Discipline</FieldLabel><input className={inputCls} value={f.discipline} onChange={set('discipline')} placeholder="Hunter" /></div>
        </div>
        <div>
          <FieldLabel>Ownership</FieldLabel>
          <div className="flex gap-2">
            {(['owned', 'leased'] as const).map((o) => (
              <button key={o} type="button" onClick={() => setOwnership(o)}
                className={`flex-1 py-2 rounded-lg border text-sm capitalize ${ownership === o ? 'bg-green-50 border-green-300 text-green-800 font-medium' : 'border-green-800/15 text-secondary hover:bg-green-50'}`}>{o}</button>
            ))}
          </div>
        </div>
        <div><FieldLabel>Location</FieldLabel><input className={inputCls} value={f.location} onChange={set('location')} placeholder="Carmel Creek Ranch" /></div>
        <div><FieldLabel>Markings / notes</FieldLabel><input className={inputCls} value={f.markings} onChange={set('markings')} placeholder="Optional" /></div>
        {err && <p className="text-sm text-red-700">{err}</p>}
        <button type="button" onClick={submit} disabled={busy}
          className="w-full py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} Save horse
        </button>
      </div>
    </Shell>
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

export function AddItemModal({ kind, onClose, onDone }: { kind: StableItemKind; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) { setErr('A name is required.'); return; }
    setBusy(true); setErr(null);
    try {
      await addStableItem(kind, { name: name.trim(), detail: detail || null, vendor_id: vendorId });
      onDone(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }

  return (
    <Shell title={kind === 'gear' ? 'Add gear' : 'Add a supply'} onClose={onClose}>
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
