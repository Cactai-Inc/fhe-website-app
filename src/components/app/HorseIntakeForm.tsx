import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldQuestion } from 'lucide-react';
import {
  createHorseRecord, setHorseLocations, setHorseMedications,
  getHorseIntakeRecord, updateHorseRecord, horsePageDetail, listHorseMedications,
  errorText,
  type HorseIntakePayload, type HorseRecordOutcome, type HorseLocationDetail, type HorseMedication,
  type KeepingSpot, type HorseVaccination, type NarrativeEntry, type InjuryEntry,
} from '../../lib/horses';
import { uploadMyFile, type FileRow } from '../../lib/files';
import {
  fetchLocations, fetchContactLocations,
  type CalendarLocation,
} from '../../lib/ops/api-calendar';
import { listHorseBreeds, listHorseColors, addLookupValue, listLookupOptions } from '../../lib/api';
import { adminClientAccounts, type ClientAccountRow } from '../../lib/admin';
import { useFieldNormalizer } from '../../lib/formState';
import type { NormalizeKind } from '../../lib/normalize';
import { useAuth } from '../../contexts/AuthContext';
import type { LookupCode } from '../../lib/ops/types';

/**
 * HORSE RECORD INTAKE — the standardized form, the matched pair to the record and
 * the source of every {{HORSE.*}} on the vet-auth / care-release / lease docs.
 *
 * Only a NICKNAME is required to create a record. Everything else is optional; a
 * field left empty, or marked "Add later", is supplied later and prints
 * "To be provided" in a contract that needs it. Care providers (vet, farrier,
 * trainer, groom, care giver, emergency contact) are managed on the record itself.
 */

const input = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white disabled:bg-cream-100 disabled:text-muted';
const NA = 'N/A';
const filled = (v?: string) => !!v && v.trim() !== '';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-gold-800 font-semibold mt-4 mb-2 first:mt-0">{title}</p>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

/** A field with an optional N/A escape and an optional "Add later" flag. N/A marks
 *  the field genuinely absent (stored as the sentinel); Add later marks it pending —
 *  present but not yet supplied. Both disable the control. */
function Field({
  label, value, onChange, type = 'text', placeholder, options, span, textarea, inputMode, onBlurFormat,
  na: naEnabled, addLater, pending, onPending,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  span?: boolean;
  textarea?: boolean;
  inputMode?: 'numeric' | 'tel' | 'email' | 'url' | 'text';
  onBlurFormat?: (v: string) => string;
  /** show an N/A checkbox */
  na?: boolean;
  /** show an "Add later" checkbox, tracked by `pending`/`onPending` */
  addLater?: boolean;
  pending?: boolean;
  onPending?: (on: boolean) => void;
}) {
  const na = value === NA;
  const disabled = na || !!pending;
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold">{label}</label>
        <div className="flex items-center gap-2">
          {addLater && (
            <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
              <input type="checkbox" checked={!!pending} onChange={(e) => { onPending?.(e.target.checked); if (e.target.checked && na) onChange(''); }} /> Add later
            </label>
          )}
          {naEnabled && (
            <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
              <input type="checkbox" checked={na} onChange={(e) => { onChange(e.target.checked ? NA : ''); if (e.target.checked) onPending?.(false); }} /> N/A
            </label>
          )}
        </div>
      </div>
      {options ? (
        <select className={input} disabled={disabled} value={na ? '' : (value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : textarea ? (
        <textarea rows={2} className={`${input} resize-y max-h-40`} disabled={disabled} value={na ? '' : (value ?? '')} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} inputMode={inputMode} className={input} disabled={disabled} value={na ? '' : (value ?? '')} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlurFormat ? (e) => { const out = onBlurFormat(e.target.value); if (out !== e.target.value) onChange(out); } : undefined} />
      )}
      {pending && <p className="text-[10px] text-gold-800 mt-1">Marked to add later — this prints “To be provided” until filled in.</p>}
    </div>
  );
}

const OTHER = '__other__';

function addOpt(prev: LookupCode[], o: { value: string; label: string }): LookupCode[] {
  if (prev.some((x) => x.code === o.value)) return prev;
  const next = [...prev, { code: o.value, display_name: o.label, active: true, sort_order: 900 }];
  return next.sort((a, b) => a.display_name.localeCompare(b.display_name));
}

function L({ children }: { children: React.ReactNode }) {
  return <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{children}</label>;
}

/** HEIGHT IN HANDS — a closed unit vocabulary, generated. A hand is four inches, so
 *  the only valid fractions are .0–.3 and the practical range is 8–19 hands. */
const HEIGHT_OPTIONS: { value: string; label: string }[] = (() => {
  const out: { value: string; label: string }[] = [];
  for (let h = 8; h <= 19; h += 1) for (let i = 0; i <= 3; i += 1) { const v = `${h}.${i} hh`; out.push({ value: v, label: v }); }
  return out;
})();

/** SELECT-OR-OTHER: a dropdown of known options plus an "Other" escape revealing a
 *  free-text box. Typing an "Other" value adds it to the vocabulary and keeps the
 *  code, so the record's foreign key accepts it and documents print it. */
function SelectOrOther({
  label, value, onChange, options, lookupKey, onOptionAdded, placeholder, span, invalid, hint,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  lookupKey?: string;
  onOptionAdded?: (o: { value: string; label: string }) => void;
  placeholder?: string;
  span?: boolean;
  invalid?: boolean;
  hint?: string;
}) {
  const isKnown = !!value && options.some((o) => o.value === value);
  const isOther = !!value && !isKnown;
  const [otherOpen, setOtherOpen] = useState(isOther);
  const cls = `${input}${invalid ? ' border-red-400' : ''}`;
  const selectValue = otherOpen || isOther ? OTHER : (isKnown ? value : '');
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <L>{label}</L>
      <select className={cls} value={selectValue}
        onChange={(e) => {
          if (e.target.value === OTHER) { setOtherOpen(true); onChange(''); }
          else { setOtherOpen(false); onChange(e.target.value); }
        }}>
        <option value="">Select…</option>
        <option value={OTHER}>Other (enter manually)…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {(otherOpen || isOther) && (
        <input className={`${cls} mt-1.5`} value={isKnown ? '' : (value ?? '')} placeholder={placeholder ?? 'Type the value'}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || !lookupKey) return;
            void addLookupValue(lookupKey, v)
              .then((r) => { onOptionAdded?.({ value: r.code, label: r.display_name }); onChange(r.code); setOtherOpen(false); })
              .catch(() => {});
          }} />
      )}
      {hint && <p className="text-[10px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

/** KEEPING-SPOTS — a repeatable term:value list; the chosen term becomes the label
 *  above an empty value input. */
const KEEPING_SPOT_TERMS = ['Barn', 'Stable', 'Field', 'Stall', 'Pen', 'Paddock', 'Corral', 'Building'];
function KeepingSpotsBlock({ spots, onChange }: { spots: KeepingSpot[]; onChange: (s: KeepingSpot[]) => void }) {
  const setSpot = (i: number, patch: Partial<KeepingSpot>) => onChange(spots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const removeSpot = (i: number) => onChange(spots.filter((_, j) => j !== i));
  const addSpot = () => onChange([...spots, { term: KEEPING_SPOT_TERMS[0], value: '' }]);
  return (
    <div className="sm:col-span-2">
      <L>Keeping spots</L>
      {spots.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          {spots.map((s, i) => (
            <div key={i} className="rounded-lg border border-green-800/15 p-2 min-w-0">
              <div className="flex items-center justify-between gap-1 mb-1">
                <select className="text-[10px] uppercase tracking-wide text-muted font-semibold bg-transparent focus-ring rounded px-0.5 -ml-0.5 max-w-full"
                  value={s.term} onChange={(e) => setSpot(i, { term: e.target.value })}>
                  {KEEPING_SPOT_TERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button type="button" onClick={() => removeSpot(i)} className="text-[10px] text-muted hover:text-red-700 underline shrink-0">Remove</button>
              </div>
              <input className={input} value={s.value ?? ''} placeholder={`e.g. ${s.term === 'Stall' || s.term === 'Pen' ? '16' : 'A'}`}
                onChange={(e) => setSpot(i, { value: e.target.value })} />
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={addSpot} className="self-start text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">＋ Add keeping spot</button>
    </div>
  );
}

/** LOCATION PICKER — on open shows only the selector. First option "Add new
 *  location" reveals empty fields; picking a known location fills them, editable.
 *  If the person edits a known location, a flag is raised so the save step can ask
 *  whether to update the saved location. */
function LocationPicker({
  v, onChange, nameOptions, onEditedKnown,
}: {
  v: HorseLocationDetail;
  onChange: (v: HorseLocationDetail) => void;
  nameOptions: { value: string; label: string; address?: string | null; city?: string | null; state?: string | null; postal?: string | null }[];
  /** called with true when a known location's address is edited */
  onEditedKnown: (edited: boolean) => void;
}) {
  const normalize = useFieldNormalizer();
  const ADD_NEW = '__add_new__';
  const known = nameOptions.filter((o) => o.value.trim());
  const isKnown = !!v.name && known.some((o) => o.value === v.name);
  const [mode, setMode] = useState<'picker' | 'fields'>(() => (filled(v.name) ? 'fields' : 'picker'));
  const set = (patch: Partial<HorseLocationDetail>) => onChange({ ...v, ...patch });
  const setAddr = (patch: Partial<HorseLocationDetail>) => { if (isKnown) onEditedKnown(true); set(patch); };
  const onBlurNorm = (k: keyof HorseLocationDetail, kind: NormalizeKind) =>
    normalize(`loc-${k}`, kind, (v[k] as string | undefined) ?? '', (val) => setAddr({ [k]: val }));
  return (
    <div className="rounded-lg border border-green-800/15 p-3">
      <L>Location</L>
      <select className={input}
        value={mode === 'picker' ? '' : (isKnown ? v.name! : ADD_NEW)}
        onChange={(e) => {
          if (e.target.value === '') { setMode('picker'); onChange({}); onEditedKnown(false); return; }
          if (e.target.value === ADD_NEW) { setMode('fields'); onChange({}); onEditedKnown(false); return; }
          const picked = known.find((o) => o.value === e.target.value);
          setMode('fields'); onEditedKnown(false);
          onChange({ name: e.target.value, address_line1: picked?.address ?? '', city: picked?.city ?? '', state: picked?.state ?? '', postal: picked?.postal ?? '' });
        }}>
        <option value="">Select a location…</option>
        <option value={ADD_NEW}>Add new location…</option>
        {known.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {mode === 'fields' && (
        <div className="grid sm:grid-cols-2 gap-2 mt-2">
          <div className="sm:col-span-2"><L>Location name</L>
            <input className={input} value={v.name ?? ''} placeholder="e.g. Carmel Creek Ranch" onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="sm:col-span-2"><L>Street address</L>
            <input className={input} value={v.address_line1 ?? ''} placeholder="123 Ranch Rd" onChange={(e) => setAddr({ address_line1: e.target.value })} onBlur={onBlurNorm('address_line1', 'street')} /></div>
          <div><L>City</L><input className={input} value={v.city ?? ''} placeholder="San Diego" onChange={(e) => setAddr({ city: e.target.value })} onBlur={onBlurNorm('city', 'city')} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><L>State</L><input className={input} value={v.state ?? ''} placeholder="CA" onChange={(e) => setAddr({ state: e.target.value })} onBlur={onBlurNorm('state', 'region')} /></div>
            <div><L>ZIP</L><input className={input} inputMode="numeric" value={v.postal ?? ''} placeholder="92109" onChange={(e) => setAddr({ postal: e.target.value })} onBlur={onBlurNorm('postal', 'postal')} /></div>
          </div>
          <KeepingSpotsBlock spots={v.keeping_spots ?? []} onChange={(keeping_spots) => set({ keeping_spots })} />
          <div className="sm:col-span-2"><L>Notes</L>
            <textarea rows={2} className={`${input} resize-y`} value={v.notes ?? ''} placeholder="information that would help in finding this location" onChange={(e) => set({ notes: e.target.value })} /></div>
        </div>
      )}
    </div>
  );
}

/** A medication/supplement block. */
function MedicationBlock({ v, kind, onChange, onRemove }: { v: HorseMedication; kind: 'MEDICATION' | 'SUPPLEMENT'; onChange: (v: HorseMedication) => void; onRemove: () => void }) {
  const set = (patch: Partial<HorseMedication>) => onChange({ ...v, ...patch });
  const noun = kind === 'SUPPLEMENT' ? 'supplement' : 'medication';
  return (
    <div className="rounded-lg border border-green-800/15 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] tracking-wide uppercase text-gold-800 font-semibold">{noun}</p>
        <button type="button" onClick={onRemove} className="text-[11px] text-muted hover:text-red-700 underline">Remove</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div><L>Name</L><input className={input} value={v.name ?? ''} placeholder={`${noun} name`} onChange={(e) => set({ name: e.target.value })} /></div>
        <div><L>Dosage</L><input className={input} value={v.dosage ?? ''} placeholder="e.g. 10 mg" onChange={(e) => set({ dosage: e.target.value })} /></div>
        <div className="sm:col-span-2"><L>Instructions</L><input className={input} value={v.instructions ?? ''} placeholder="e.g. one scoop AM/PM with feed" onChange={(e) => set({ instructions: e.target.value })} /></div>
        <div><L>Order quantity (units)</L><input className={input} value={v.order_units ?? ''} placeholder="e.g. 30 tablets" onChange={(e) => set({ order_units: e.target.value })} /></div>
        <div><L>Days supply</L><input className={input} inputMode="numeric" value={v.days_supply ?? ''} placeholder="e.g. 30" onChange={(e) => set({ days_supply: e.target.value })} /></div>
        <div><L>Cost (per order)</L>
          <input className={input} inputMode="numeric" value={v.cost ?? ''} placeholder="$0.00" onChange={(e) => set({ cost: e.target.value })}
            onBlur={(e) => { const n = Number(e.target.value.replace(/[$,\s]/g, '')); if (Number.isFinite(n) && e.target.value.trim()) set({ cost: n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) }); }} /></div>
        <div><L>Supplier website</L><input type="url" className={input} value={v.supplier_website ?? ''} placeholder="https://…" onChange={(e) => set({ supplier_website: e.target.value })} /></div>
        <div><L>Supplier phone</L><input type="tel" className={input} value={v.supplier_phone ?? ''} placeholder="(555) 555-5555" onChange={(e) => set({ supplier_phone: e.target.value })} /></div>
        {kind === 'MEDICATION' && (<div><L>Rx info</L><input className={input} value={v.rx_info ?? ''} placeholder="Rx #, prescriber" onChange={(e) => set({ rx_info: e.target.value })} /></div>)}
      </div>
    </div>
  );
}

function RepeatableMeds({ kind, items, onChange }: { kind: 'MEDICATION' | 'SUPPLEMENT'; items: HorseMedication[]; onChange: (i: HorseMedication[]) => void }) {
  const noun = kind === 'SUPPLEMENT' ? 'supplement' : 'medication';
  return (
    <div className="sm:col-span-2 flex flex-col gap-2">
      {items.map((it, i) => (<MedicationBlock key={i} v={it} kind={kind} onChange={(nv) => onChange(items.map((x, j) => (j === i ? nv : x)))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />))}
      <button type="button" onClick={() => onChange([...items, { kind }])} className="self-start text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">＋ Add {noun}</button>
    </div>
  );
}

function VaccinationBlock({ v, onChange, onRemove }: { v: HorseVaccination; onChange: (v: HorseVaccination) => void; onRemove: () => void }) {
  const set = (patch: Partial<HorseVaccination>) => onChange({ ...v, ...patch });
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true); setUploadErr(null);
    try { const row: FileRow = await uploadMyFile(file, `Vaccination record — ${v.name || file.name}`); set({ file_id: row.id, file_name: row.filename }); }
    catch (e) { setUploadErr(errorText(e, 'Could not upload the file.')); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  return (
    <div className="rounded-lg border border-green-800/15 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] tracking-wide uppercase text-gold-800 font-semibold">vaccination</p>
        <button type="button" onClick={onRemove} className="text-[11px] text-muted hover:text-red-700 underline">Remove</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div><L>Name</L><input className={input} value={v.name ?? ''} placeholder="e.g. Rabies, EEE/WEE" onChange={(e) => set({ name: e.target.value })} /></div>
        <div><L>Additional details</L><input className={input} value={v.details ?? ''} placeholder="e.g. lot #, manufacturer" onChange={(e) => set({ details: e.target.value })} /></div>
        <div><L>Date administered</L><input type="date" className={input} value={v.date_administered ?? ''} onChange={(e) => set({ date_administered: e.target.value })} /></div>
        <div><L>Good until</L><input type="date" className={input} value={v.good_until ?? ''} onChange={(e) => set({ good_until: e.target.value })} /></div>
        <div className="sm:col-span-2">
          <L>Records copy</L>
          {v.file_id ? (
            <div className="flex items-center gap-2 text-[13px] text-green-900">
              <span className="truncate">{v.file_name ?? 'Uploaded file'}</span>
              <button type="button" onClick={() => set({ file_id: undefined, file_name: undefined })} className="text-[11px] text-muted hover:text-red-700 underline shrink-0">Remove file</button>
            </div>
          ) : (
            <>
              <input ref={fileRef} type="file" disabled={uploading} className="block w-full text-[12px] text-muted file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gold-400 file:bg-gold-50 file:text-gold-800 file:text-xs file:cursor-pointer" onChange={(e) => void onPick(e.target.files?.[0])} />
              {uploading && <p className="text-[11px] text-muted mt-1">Uploading…</p>}
            </>
          )}
          {uploadErr && <p className="text-[11px] text-red-700 mt-1">{uploadErr}</p>}
        </div>
      </div>
    </div>
  );
}

function RepeatableVaccinations({ items, onChange }: { items: HorseVaccination[]; onChange: (i: HorseVaccination[]) => void }) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-2">
      {items.map((it, i) => (<VaccinationBlock key={i} v={it} onChange={(nv) => onChange(items.map((x, j) => (j === i ? nv : x)))} onRemove={() => onChange(items.filter((_, j) => j !== i))} />))}
      <button type="button" onClick={() => onChange([...items, {}])} className="self-start text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">＋ Add vaccination</button>
    </div>
  );
}

/** A repeatable single-text-field list (medical history, conditions, etc.) — the
 *  shared Add-button pattern. `field` is the object key each entry stores. */
function NarrativeList({ noun, field, placeholder, items, onChange }: {
  noun: string; field: string; placeholder: string; items: NarrativeEntry[]; onChange: (i: NarrativeEntry[]) => void;
}) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="flex gap-2 items-start">
          <textarea rows={2} className={`${input} resize-y`} value={it[field] ?? ''} placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [field]: e.target.value } : x)))} />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-[11px] text-muted hover:text-red-700 underline mt-2 shrink-0">Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { [field]: '' }])} className="self-start text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">＋ Add {noun}</button>
    </div>
  );
}

/** Injuries the horse caused to a person — a structured disclosure list. */
function InjuryList({ items, onChange }: { items: InjuryEntry[]; onChange: (i: InjuryEntry[]) => void }) {
  const set = (i: number, patch: Partial<InjuryEntry>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="sm:col-span-2 flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-green-800/15 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] tracking-wide uppercase text-gold-800 font-semibold">injury disclosure</p>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-[11px] text-muted hover:text-red-700 underline">Remove</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div><L>Date</L><input type="date" className={input} value={it.date ?? ''} onChange={(e) => set(i, { date: e.target.value })} /></div>
            <div><L>Person</L>
              <select className={input} value={it.person_type ?? ''} onChange={(e) => set(i, { person_type: e.target.value as InjuryEntry['person_type'] })}>
                <option value="">Select…</option><option value="rider">Rider</option><option value="non-rider">Non-rider</option>
              </select></div>
            <div className="sm:col-span-2"><L>Description</L><textarea rows={2} className={`${input} resize-y`} value={it.description ?? ''} placeholder="What happened" onChange={(e) => set(i, { description: e.target.value })} /></div>
            <div className="sm:col-span-2"><L>Outcome</L><input className={input} value={it.outcome ?? ''} placeholder="e.g. treated on site; no lasting injury" onChange={(e) => set(i, { outcome: e.target.value })} /></div>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, {}])} className="self-start text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">＋ Add injury disclosure</button>
    </div>
  );
}

/** Patch keys update_horse_record accepts (identity columns + list/pending keys). */
const PATCHABLE_KEYS: (keyof HorseIntakePayload)[] = [
  'registered_name', 'nickname', 'breed', 'color', 'markings', 'sex',
  'date_of_birth', 'height', 'registration_number', 'registration_org',
  'microchip_id', 'passport_number', 'passport_country', 'fair_market_value',
  'euthanasia_authorization',
];
const LIST_KEYS: (keyof HorseIntakePayload)[] = [
  'pending_fields', 'medical_history_list', 'behavioral_history_list', 'known_conditions_list',
  'training_history_list', 'competition_history_list', 'injuries_to_humans',
];
// Columns that cannot hold the 'N/A' sentinel.
const TYPED_KEYS = new Set<keyof HorseIntakePayload>(['date_of_birth', 'fair_market_value', 'sex', 'euthanasia_authorization', 'breed', 'color']);

export function HorseIntakeForm({
  onDone, submitLabel = 'Add horse', ownerContactId, horseId, prefill,
}: {
  onDone: (horseId: string, ownerContactId?: string) => void;
  submitLabel?: string;
  ownerContactId?: string;
  horseId?: string;
  prefill?: Partial<HorseIntakePayload>;
  /** Accepted for call-site compatibility; the form always creates on a nickname. */
  createEarly?: boolean;
}) {
  const { isStaff } = useAuth();
  const [f, setF] = useState<HorseIntakePayload>(() => (horseId ? { is_leased: 'no' } : { is_leased: 'no', ...(prefill ?? {}) }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorPulse, setErrorPulse] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);
  const recordIdRef = useRef<string | null>(horseId ?? null);
  const lastSavedRef = useRef<HorseIntakePayload>({});
  const lastSavedLocRef = useRef<string>(JSON.stringify({}));
  const lastSavedVaccRef = useRef<string>(JSON.stringify([]));
  const savingRef = useRef(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [locations, setLocations] = useState<CalendarLocation[]>([]);
  const [accounts, setAccounts] = useState<ClientAccountRow[]>([]);
  const [assignTo, setAssignTo] = useState<string>(ownerContactId ?? '');
  const [loc, setLoc] = useState<HorseLocationDetail>({});
  const [locEditedKnown, setLocEditedKnown] = useState(false);
  const [meds, setMeds] = useState<HorseMedication[]>([]);
  const [supplements, setSupplements] = useState<HorseMedication[]>([]);
  const [vaccinations, setVaccinations] = useState<HorseVaccination[]>([]);
  const [showPassport, setShowPassport] = useState(false);
  const [breeds, setBreeds] = useState<LookupCode[]>([]);
  const [colors, setColors] = useState<LookupCode[]>([]);
  const [regOrgOpts, setRegOrgOpts] = useState<LookupCode[]>([]);
  const [passportCountryOpts, setPassportCountryOpts] = useState<LookupCode[]>([]);

  const pendingSet = new Set(f.pending_fields ?? []);
  const setPendingField = (key: string, on: boolean) => {
    const next = new Set(f.pending_fields ?? []);
    if (on) next.add(key); else next.delete(key);
    setF((p) => ({ ...p, pending_fields: Array.from(next) }));
  };

  const loadLocations = () =>
    (assignTo ? fetchContactLocations(assignTo) : fetchLocations())
      .then((locs) => { setLocations(locs); return locs; })
      .catch(() => { setLocations([]); return [] as CalendarLocation[]; });
  useEffect(() => {
    loadLocations();
    if (isStaff) adminClientAccounts().then(setAccounts).catch(() => setAccounts([]));
    listHorseBreeds().then(setBreeds).catch(() => setBreeds([]));
    listHorseColors().then(setColors).catch(() => setColors([]));
    listLookupOptions('horse_registration_org').then(setRegOrgOpts).catch(() => setRegOrgOpts([]));
    listLookupOptions('horse_passport_country').then(setPassportCountryOpts).catch(() => setPassportCountryOpts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (isStaff) loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignTo]);

  const [loadingRecord, setLoadingRecord] = useState(Boolean(horseId));
  useEffect(() => {
    if (!horseId) return;
    let active = true;
    (async () => {
      try {
        const [raw, detail, medRows] = await Promise.all([
          getHorseIntakeRecord(horseId),
          horsePageDetail(horseId).catch(() => null),
          listHorseMedications(horseId).catch(() => [] as HorseMedication[]),
        ]);
        if (!active || !raw) return;
        const s = (v: unknown) => (v == null ? '' : String(v));
        const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
        const next: HorseIntakePayload = {
          is_leased: raw.lessee_name_text ? 'yes' : 'no',
          nickname: s(raw.nickname), registered_name: s(raw.registered_name),
          registration_number: s(raw.registration_number), registration_org: s(raw.registration_org),
          microchip_id: s(raw.microchip_id), passport_number: s(raw.passport_number),
          passport_country: s(raw.passport_country), breed: s(raw.breed), color: s(raw.color),
          markings: s(raw.markings), sex: s(raw.sex),
          date_of_birth: s(raw.date_of_birth).slice(0, 10), height: s(raw.height),
          fair_market_value: raw.fair_market_value == null ? '' : Number(raw.fair_market_value).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
          euthanasia_authorization: (raw.euthanasia_authorization === 'A' || raw.euthanasia_authorization === 'B') ? raw.euthanasia_authorization : undefined,
          pending_fields: arr<string>(raw.pending_fields),
          medical_history_list: arr<NarrativeEntry>(raw.medical_history_list),
          behavioral_history_list: arr<NarrativeEntry>(raw.behavioral_history_list),
          known_conditions_list: arr<NarrativeEntry>(raw.known_conditions_list),
          training_history_list: arr<NarrativeEntry>(raw.training_history_list),
          competition_history_list: arr<NarrativeEntry>(raw.competition_history_list),
          injuries_to_humans: arr<InjuryEntry>(raw.injuries_to_humans),
          lessee_name_text: s(raw.lessee_name_text),
          lease_start: s(raw.lease_start).slice(0, 10), lease_end: s(raw.lease_end).slice(0, 10),
        };
        setF(next);
        lastSavedRef.current = { ...next };
        recordIdRef.current = horseId;
        if (s(raw.passport_number) || s(raw.passport_country)) setShowPassport(true);
        const cur = detail?.record?.current_location;
        if (cur?.name) {
          const lv: HorseLocationDetail = {
            name: cur.name, address_line1: cur.address_line1 ?? '', city: cur.city ?? '',
            state: cur.state ?? '', postal: cur.postal ?? '', keeping_spots: cur.keeping_spots ?? [], notes: cur.notes ?? '',
          };
          setLoc(lv);
          lastSavedLocRef.current = JSON.stringify(lv);
        }
        if (medRows.length) { setMeds(medRows.filter((m) => m.kind !== 'SUPPLEMENT')); setSupplements(medRows.filter((m) => m.kind === 'SUPPLEMENT')); }
        if (Array.isArray(raw.vaccinations)) { const vacc = (raw.vaccinations as HorseVaccination[]).filter((x) => x && typeof x === 'object'); setVaccinations(vacc); lastSavedVaccRef.current = JSON.stringify(vacc); }
      } catch { /* form stays blank */ }
      finally { if (active) setLoadingRecord(false); }
    })();
    return () => { active = false; };
  }, [horseId]);

  async function autosave() {
    const id = recordIdRef.current;
    if (!id || savingRef.current) return;
    const patch: Record<string, unknown> = {};
    for (const k of PATCHABLE_KEYS) {
      const cur = (f[k] as string | undefined) ?? '';
      const prev = (lastSavedRef.current[k] as string | undefined) ?? '';
      if (cur !== prev) patch[k] = (TYPED_KEYS.has(k) && cur === NA) ? '' : cur;
    }
    for (const k of LIST_KEYS) {
      const cur = JSON.stringify(f[k] ?? []);
      const prev = JSON.stringify(lastSavedRef.current[k] ?? []);
      if (cur !== prev) patch[k] = f[k] ?? [];
    }
    const locSnapshot = JSON.stringify(loc);
    const cleanVacc = vaccinations.filter((v) => filled(v.name) || filled(v.details) || v.file_id);
    const vaccSnapshot = JSON.stringify(cleanVacc);
    const vaccChanged = vaccSnapshot !== lastSavedVaccRef.current;
    const locChanged = locSnapshot !== lastSavedLocRef.current && filled(loc.name);
    if (Object.keys(patch).length === 0 && !locChanged && !vaccChanged) return;
    savingRef.current = true; setSaveState('saving');
    try {
      if (Object.keys(patch).length) await updateHorseRecord(id, patch);
      if (locChanged || vaccChanged) {
        await setHorseLocations(id, loc, vaccChanged ? cleanVacc : undefined);
        lastSavedLocRef.current = locSnapshot;
        if (vaccChanged) lastSavedVaccRef.current = vaccSnapshot;
      }
      lastSavedRef.current = { ...f };
      setSaveErr(null); setSaveState('saved');
    } catch (e) { setSaveErr(errorText(e, 'Could not save your last change.')); setSaveState('error'); }
    finally { savingRef.current = false; }
  }

  useEffect(() => {
    if (!errorPulse) return;
    const root = formRef.current;
    const target = root?.querySelector('.border-red-400') ?? root?.querySelector('.form-error');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [errorPulse]);

  const toOpts = (rows: LookupCode[]) => rows.map((r) => ({ value: r.code, label: r.display_name }));
  const breedOpts = toOpts(breeds);
  const colorOpts = toOpts(colors);
  const accountLabel = (a: ClientAccountRow) => a.display_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Account';
  const locationNameOpts = locations.map((l) => ({ value: l.name, label: l.name, address: l.address }));

  const set = (k: keyof HorseIntakePayload) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const setList = (k: keyof HorseIntakePayload) => (v: unknown[]) => setF((p) => ({ ...p, [k]: v }));

  const isKnownCode = (v: string | undefined, opts: { value: string }[]) => !v || v === NA || opts.some((o) => o.value === v);
  const hasRealName = filled(f.nickname) || filled(f.registered_name);

  function reject(message: string) { setShowError(true); setErr(message); setErrorPulse((n) => n + 1); }

  async function submit() {
    setErr(null);
    if (isStaff && !assignTo) { reject('Choose the account this horse belongs to.'); return; }
    if (!hasRealName) { reject('Give the horse a nickname.'); return; }
    if (breedOpts.length && !isKnownCode(f.breed, breedOpts)) { reject('Breed has to be chosen from the list — pick the closest match or "Other".'); return; }
    if (colorOpts.length && !isKnownCode(f.color, colorOpts)) { reject('Color has to be chosen from the list — pick the closest match or "Other".'); return; }
    setBusy(true);
    try {
      const linkExtras = async (hid: string) => {
        const cleanVacc = vaccinations.filter((v) => filled(v.name) || filled(v.details) || v.file_id);
        if (filled(loc.name) || cleanVacc.length) {
          try { await setHorseLocations(hid, loc, cleanVacc); lastSavedLocRef.current = JSON.stringify(loc); lastSavedVaccRef.current = JSON.stringify(cleanVacc); } catch { /* record saved */ }
        }
        const items = [...meds, ...supplements].filter((m) => filled(m.name));
        if (items.length) { try { await setHorseMedications(hid, items); } catch { /* record saved */ } }
      };
      const editingId = recordIdRef.current;
      if (editingId) {
        const patch: Record<string, unknown> = {};
        for (const k of PATCHABLE_KEYS) {
          const cur = (f[k] as string | undefined) ?? '';
          const prev = (lastSavedRef.current[k] as string | undefined) ?? '';
          if (cur !== prev) patch[k] = (TYPED_KEYS.has(k) && cur === NA) ? '' : cur;
        }
        for (const k of LIST_KEYS) patch[k] = f[k] ?? [];
        if (Object.keys(patch).length) await updateHorseRecord(editingId, patch);
        lastSavedRef.current = { ...f };
        await linkExtras(editingId);
        onDone(editingId, assignTo || ownerContactId || undefined);
        return;
      }
      const payload: HorseIntakePayload = isStaff && assignTo ? { ...f, owner_contact_id: assignTo } : f;
      const out: HorseRecordOutcome = await createHorseRecord(payload);
      if (out.outcome === 'match_pending_review') setPending(true);
      else { recordIdRef.current = out.horse_id; lastSavedRef.current = { ...f }; await linkExtras(out.horse_id); onDone(out.horse_id, assignTo || ownerContactId || undefined); }
    } catch (e) { setErr(errorText(e, 'Could not save the horse record.')); setErrorPulse((n) => n + 1); }
    finally { setBusy(false); }
  }

  if (pending) {
    return (
      <div className="text-center py-8 px-4">
        <ShieldQuestion size={32} className="text-gold-800 mx-auto mb-3" />
        <p className="font-serif text-green-800 text-lg mb-1.5">This horse may already be on file.</p>
        <p className="text-sm text-muted max-w-md mx-auto">We've opened a review. Upload your lease or ownership paperwork from your Documents and we'll link the record to your account once verified.</p>
      </div>
    );
  }
  if (loadingRecord) return <p className="text-sm text-muted py-4">Loading the horse record…</p>;

  const leased = f.is_leased === 'yes';

  return (
    <div ref={formRef} className="flex flex-col gap-1" onBlur={() => void autosave()}>
      {isStaff && (
        <div className="rounded-lg border border-gold-500/40 bg-gold-50 p-3 mb-2">
          <label className="block text-[11px] tracking-wide uppercase text-gold-900 font-semibold mb-1">Assign this horse to an account *</label>
          <select className={`${input} bg-white${showError && !assignTo ? ' border-red-400' : ''}`} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Select the client account…</option>
            {accounts.filter((a) => a.contact_id).map((a) => <option key={a.contact_id!} value={a.contact_id!}>{accountLabel(a)}{a.email ? ` — ${a.email}` : ''}</option>)}
          </select>
          <p className="text-[10px] text-gold-900/80 mt-1">The record will be owned by the selected client.</p>
        </div>
      )}

      <p className="text-xs text-muted mb-1">
        Only a <strong>nickname</strong> is required. Everything else is optional — you can fill it in now or later.
        A field you leave empty, or mark <strong>Add later</strong>, prints “To be provided” on a contract that needs it.
      </p>

      <Section title="Horse identity">
        <Field label="Name on Registration Certificate" value={f.registered_name} onChange={set('registered_name')}
          addLater pending={pendingSet.has('registered_name')} onPending={(on) => setPendingField('registered_name', on)} />
        <Field label="Nickname" value={f.nickname} onChange={set('nickname')} placeholder="Everyday name (e.g. Beau)" />
        <SelectOrOther label="Registration organization" value={f.registration_org} onChange={set('registration_org')} options={toOpts(regOrgOpts)} lookupKey="horse_registration_org" onOptionAdded={(o) => setRegOrgOpts((prev) => addOpt(prev, o))} placeholder="Registry name" />
        <Field label="Registration number" value={f.registration_number} onChange={set('registration_number')}
          addLater pending={pendingSet.has('registration_number')} onPending={(on) => setPendingField('registration_number', on)} />
        <Field label="Microchip number" value={f.microchip_id} onChange={set('microchip_id')} placeholder="e.g. 985 112233445566" na
          addLater pending={pendingSet.has('microchip_id')} onPending={(on) => setPendingField('microchip_id', on)} />
        <Field label="Fair market value" type="text" inputMode="numeric" value={f.fair_market_value} onChange={set('fair_market_value')} placeholder="$0.00"
          addLater pending={pendingSet.has('fair_market_value')} onPending={(on) => setPendingField('fair_market_value', on)}
          onBlurFormat={(v) => { const n = Number(v.replace(/[$,\s]/g, '')); return Number.isFinite(n) && v.trim() !== '' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : v; }} />
        {showPassport ? (
          <>
            <Field label="Passport number" value={f.passport_number} onChange={set('passport_number')}
              addLater pending={pendingSet.has('passport_number')} onPending={(on) => setPendingField('passport_number', on)} />
            <SelectOrOther label="Passport country" value={f.passport_country} onChange={set('passport_country')} options={toOpts(passportCountryOpts)} lookupKey="horse_passport_country" onOptionAdded={(o) => setPassportCountryOpts((prev) => addOpt(prev, o))} placeholder="Country" />
          </>
        ) : (
          <div className="sm:col-span-2">
            <button type="button" onClick={() => setShowPassport(true)} className="text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">＋ Add passport</button>
          </div>
        )}
      </Section>

      <Section title="Description">
        <SelectOrOther label="Breed" value={f.breed} onChange={set('breed')} invalid={showError && !isKnownCode(f.breed, breedOpts)} options={breedOpts} lookupKey="horse_breeds" onOptionAdded={(o) => setBreeds((prev) => addOpt(prev, o))} placeholder="Breed name" hint="Not listed? Choose “Other (enter manually)” and type it — it joins the list." />
        <SelectOrOther label="Color" value={f.color} onChange={set('color')} invalid={showError && !isKnownCode(f.color, colorOpts)} options={colorOpts} lookupKey="horse_colors" onOptionAdded={(o) => setColors((prev) => addOpt(prev, o))} placeholder="Color" hint="Not listed? Choose “Other (enter manually)” and type it — it joins the list." />
        <Field span label="Markings" textarea value={f.markings} onChange={set('markings')} addLater pending={pendingSet.has('markings')} onPending={(on) => setPendingField('markings', on)}
          placeholder="Describe the markings exactly as written on the registration certificate (e.g. Star pointed at bottom; left hind coronet white, lower on inside…)" />
        <Field label="Sex" value={f.sex} onChange={set('sex')} options={[
          { value: 'MARE', label: 'Mare' }, { value: 'GELDING', label: 'Gelding' }, { value: 'STALLION', label: 'Stallion' }, { value: 'FILLY', label: 'Filly' }, { value: 'COLT', label: 'Colt' },
        ]} />
        <Field label="Date of birth" type="date" value={f.date_of_birth} onChange={set('date_of_birth')} addLater pending={pendingSet.has('date_of_birth')} onPending={(on) => setPendingField('date_of_birth', on)} />
        <SelectOrOther label="Height" value={f.height} onChange={set('height')} options={HEIGHT_OPTIONS} placeholder="e.g. 16.2 hh" hint="Hands and inches — pick from the list, or enter it your own way." />
      </Section>

      <Section title="Location">
        <div className="sm:col-span-2">
          <LocationPicker v={loc} onChange={setLoc} nameOptions={locationNameOpts} onEditedKnown={setLocEditedKnown} />
          {locEditedKnown && <p className="text-[10px] text-gold-800 mt-1">You edited a saved location — on save you’ll be asked whether to update it everywhere.</p>}
        </div>
      </Section>

      <Section title="Lease">
        <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-green-900 cursor-pointer select-none">
          <input type="checkbox" checked={leased} onChange={(e) => setF((p) => ({ ...p, is_leased: e.target.checked ? 'yes' : 'no' }))} />
          This horse is currently leased
        </label>
        {leased && (
          <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3">
            <div><L>Lessee name</L><input className={input} value={f.lessee_name_text ?? ''} placeholder="Full name" onChange={(e) => set('lessee_name_text')(e.target.value)} /></div>
            <div><L>Lessee email</L><input type="email" className={input} value={f.lessee_email ?? ''} placeholder="name@example.com" onChange={(e) => set('lessee_email')(e.target.value)} /></div>
            <div><L>Lease start</L><input type="date" className={input} value={f.lease_start ?? ''} onChange={(e) => set('lease_start')(e.target.value)} /></div>
            <div><L>Lease end (empty = evergreen)</L><input type="date" className={input} value={f.lease_end ?? ''} onChange={(e) => set('lease_end')(e.target.value)} /></div>
          </div>
        )}
      </Section>

      <Section title="History"><div className="sm:col-span-2 grid gap-3">
        <div><L>Training history</L><NarrativeList noun="training entry" field="entry" placeholder="e.g. started under saddle 2021; schooling 1.10m" items={f.training_history_list ?? []} onChange={setList('training_history_list')} /></div>
        <div><L>Competition history</L><NarrativeList noun="competition entry" field="entry" placeholder="e.g. 2023 regional championship, 2nd" items={f.competition_history_list ?? []} onChange={setList('competition_history_list')} /></div>
      </div></Section>

      <Section title="Health &amp; history"><div className="sm:col-span-2 grid gap-3">
        <div><L>Medical history (past surgeries, injuries, treatments)</L><NarrativeList noun="entry" field="summary" placeholder="e.g. colic surgery 2022; suspensory injury, fully recovered" items={f.medical_history_list ?? []} onChange={setList('medical_history_list')} /></div>
        <div><L>Behavioral concerns (temperament, handling)</L><NarrativeList noun="concern" field="concern" placeholder="e.g. cross-ties well; spooky in wind" items={f.behavioral_history_list ?? []} onChange={setList('behavioral_history_list')} /></div>
        <div><L>Known conditions (current or recurring)</L><NarrativeList noun="condition" field="condition" placeholder="e.g. allergic to cedar bedding" items={f.known_conditions_list ?? []} onChange={setList('known_conditions_list')} /></div>
        <div><L>Injuries caused to humans (riders and non-riders)</L>
          <p className="text-[10px] text-muted mb-1">Must be disclosed before a horse is leased, sold, used in lessons, or cared for by staff. Prints on sale and lease contracts.</p>
          <InjuryList items={f.injuries_to_humans ?? []} onChange={setList('injuries_to_humans')} /></div>
      </div></Section>

      <Section title="Medications"><RepeatableMeds kind="MEDICATION" items={meds} onChange={setMeds} /></Section>
      <Section title="Supplements"><RepeatableMeds kind="SUPPLEMENT" items={supplements} onChange={setSupplements} /></Section>
      <Section title="Vaccinations"><RepeatableVaccinations items={vaccinations} onChange={setVaccinations} /></Section>

      <p className="text-[11px] text-muted mt-2">Care providers — vet, farrier, trainer, groom, care giver, emergency contact — are added on the horse’s record after it’s created.</p>

      {err && <p className="form-error text-sm text-red-700 mt-2">{err}</p>}
      {saveState !== 'idle' && (
        <p className={`text-[11px] mt-1 ${saveState === 'error' ? 'text-red-700' : 'text-muted'}`} aria-live="polite">
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Progress saved.' : `${saveErr ?? 'Could not save your last change.'} It will retry when you leave the next field.`}
        </p>
      )}
      <button type="button" onClick={submit} disabled={busy} className="w-full mt-3 py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />} {submitLabel}
      </button>
    </div>
  );
}
