import { useEffect, useState } from 'react';
import { Loader2, Plus, Check } from 'lucide-react';
import { Modal } from '../ops/kit/Modal';
import { useFieldNormalizer, useFormDraft, type SaveStatus } from '../../lib/formState';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  addStableHorse, addStableItem, addVendor, listVendors,
  type StableItemKind, type StableItemOwnerKind, type StableOwnership, type Vendor,
} from '../../lib/stable';
import { fetchLocations, addMyLocation, type CalendarLocation } from '../../lib/ops/api-calendar';

/**
 * MY STABLE editors — purpose-built add forms that WRITE real rows.
 *   AddHorseModal  → addStableHorse
 *   AddItemModal   → addStableItem (gear|supply), with a VendorPicker that either
 *                    selects an existing shared vendor or adds a new one (addVendor)
 *                    with an optional "share to community Resources" toggle.
 * ⚠️ TASK-FIX4 §3 — CONVERGED ON THE SHARED `ops/kit/Modal`. `Shell` used to be a
 * hand-rolled overlay whose backdrop carried `onClick={onClose}`, so a click
 * beside the box threw away a half-filled horse record. That is CR-68a, the
 * incident the owner reported on 2026-08-25. It is now the shared dialog's rule
 * for every caller: **a dialog holding a field does not close on a backdrop
 * click**, and what was typed is in browser storage regardless.
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
    <Modal open onClose={onClose} title={title} variant="sheet" size="sm"
      onClear={onClear} saveStatus={saveStatus} panelClassName="bg-cream">
      {children}
    </Modal>
  );
}

const EMPTY_HORSE = {
  name: '', nickname: '', breed: '', sex: '', height_hh: '', age_or_foaling: '',
  color: '', discipline: '', markings: '', location: 'Carmel Creek Ranch',
};

export function AddHorseModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ ...EMPTY_HORSE });
  const [ownership, setOwnership] = useState<StableOwnership>('owned');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [locations, setLocations] = useState<CalendarLocation[]>([]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const normalize = useFieldNormalizer();

  /* TASK-FIX4 §6 — what was typed survives a reload, a browser-back and an
     accidental close. ⚠️ Persisting is not submitting: nothing reaches
     `addStableHorse` until `Save horse` is pressed. */
  const draft = useFormDraft('stable.add-horse', { ...f, ownership }, (d) => {
    setF((p) => ({ ...p, ...d }));
    if (d.ownership) setOwnership(d.ownership as StableOwnership);
  });

  function clearForm() {
    setF({ ...EMPTY_HORSE });
    setOwnership('owned');
    setErr(null);
    draft.clear();
  }

  const loadLocations = () => fetchLocations().then((locs) => { setLocations(locs); return locs; }).catch(() => [] as CalendarLocation[]);
  useEffect(() => {
    loadLocations().then((locs) => {
      const def = locs.find((l) => l.is_default);
      if (def) setF((p) => (p.location && p.location !== 'Carmel Creek Ranch') ? p : { ...p, location: def.name });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addLocation() {
    const name = window.prompt('New location name');
    if (!name?.trim()) return;
    const addr = window.prompt('Address (optional)') ?? undefined;
    try {
      await addMyLocation(name.trim(), addr?.trim() || undefined);
      await loadLocations();
      setF((p) => ({ ...p, location: name.trim() }));
    } catch { /* keep selection */ }
  }

  async function submit() {
    if (!f.name.trim()) { setErr('A name is required.'); return; }
    setBusy(true); setErr(null);
    try {
      await addStableHorse({ ...f, ownership });
      draft.clear();
      onDone(); onClose();
    } catch (e) { setErr(toErrorMessage(e, 'Could not save.')); }
    finally { setBusy(false); }
  }

  return (
    <Shell title="Add a horse" onClose={onClose} onClear={clearForm} saveStatus={draft.status}>
      <div className="flex flex-col gap-3">
        {/* TASK-FIX4 §4 — the name is normalised ON BLUR, in front of them, and
            a correction they then make is never re-normalised. */}
        <div><FieldLabel>Name</FieldLabel><input className={inputCls} value={f.name} onChange={set('name')}
          onBlur={normalize('horse.name', 'name', f.name, (v) => setF((p) => ({ ...p, name: v })))}
          placeholder="Registered or full name" /></div>
        <div><FieldLabel>Barn name</FieldLabel><input className={inputCls} value={f.nickname} onChange={set('nickname')}
          onBlur={normalize('horse.nickname', 'name', f.nickname, (v) => setF((p) => ({ ...p, nickname: v })))}
          placeholder="Everyday name" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><FieldLabel>Breed</FieldLabel><input className={inputCls} value={f.breed} onChange={set('breed')} placeholder="Warmblood" /></div>
          <div><FieldLabel>Sex</FieldLabel><input className={inputCls} value={f.sex} onChange={set('sex')} placeholder="Gelding" /></div>
          <div><FieldLabel>Height</FieldLabel><input className={inputCls} value={f.height_hh} onChange={set('height_hh')} placeholder="16.1hh" /></div>
          <div><FieldLabel>Age / foaling</FieldLabel><input className={inputCls} value={f.age_or_foaling} onChange={set('age_or_foaling')} placeholder="11 yrs / 2015" /></div>
          <div><FieldLabel>Color</FieldLabel><input className={inputCls} value={f.color} onChange={set('color')} placeholder="Bay" /></div>
          {/* Discipline removed 2026-07-30: there is no `discipline` column on
              horses, so this input collected text that was concatenated into
              medical_history and never read back. Reinstate it here only
              alongside a real column. */}
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
        <div>
          <FieldLabel>Location</FieldLabel>
          <select className={inputCls} value={f.location}
            onChange={(e) => { if (e.target.value === '__add') { void addLocation(); } else setF({ ...f, location: e.target.value }); }}>
            {!locations.some((l) => l.name === f.location) && f.location && <option value={f.location}>{f.location}</option>}
            {locations.map((l) => <option key={l.id} value={l.name}>{l.name}{l.is_mine ? ' (mine)' : ''}</option>)}
            <option value="__add">+ Add a location…</option>
          </select>
        </div>
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
