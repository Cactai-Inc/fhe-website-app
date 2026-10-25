import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldQuestion } from 'lucide-react';
import {
  createHorseRecord, setHorseLocations, setHorseMedications,
  getHorseIntakeRecord, updateHorseRecord, horsePageDetail, listHorseMedications,
  addHorseProvider, addHorseEmergencyContact, matchAccountByEmail, peopleWithDesignation,
  errorText,
  type HorseIntakePayload, type HorseRecordOutcome, type HorseLocationDetail, type HorseMedication,
  type KeepingSpot, type HorseVaccination, type NarrativeEntry,
  type HorseProvider, type Designation,
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
      {/* Imported to the contract: Name, Purpose, Dose, Frequency, Cost per dose,
          Rx required. These are what print on a lease or sale. */}
      <div className="grid sm:grid-cols-2 gap-2">
        <div><L>Name</L><input className={input} value={v.name ?? ''} placeholder={`${noun} name`} onChange={(e) => set({ name: e.target.value })} /></div>
        <div><L>Purpose</L><input className={input} value={v.purpose ?? ''} placeholder="why it's given" onChange={(e) => set({ purpose: e.target.value })} /></div>
        <div><L>Dose</L><input className={input} value={v.dosage ?? ''} placeholder="e.g. 10 mg" onChange={(e) => set({ dosage: e.target.value })} /></div>
        <div><L>Frequency</L><input className={input} value={v.frequency ?? ''} placeholder="e.g. twice daily" onChange={(e) => set({ frequency: e.target.value })} /></div>
        <div><L>Cost per dose</L>
          <input className={input} inputMode="numeric" value={v.cost_per_dose ?? ''} placeholder="$0.00" onChange={(e) => set({ cost_per_dose: e.target.value })}
            onBlur={(e) => { const n = Number(e.target.value.replace(/[$,\s]/g, '')); if (Number.isFinite(n) && e.target.value.trim()) set({ cost_per_dose: n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) }); }} /></div>
        <div><L>Rx required</L>
          <div className="flex gap-1.5 mt-1">
            {([['true', 'Yes'], ['false', 'No']] as const).map(([rv, rl]) => (
              <button key={rv} type="button" onClick={() => set({ rx_required: rv === 'true' })}
                className={`text-sm rounded-lg px-4 py-1 border focus-ring ${
                  (v.rx_required === (rv === 'true')) ? 'bg-green-800 text-white border-green-800' : 'border-green-800/15 text-secondary hover:bg-green-50'}`}>
                {rl}
              </button>
            ))}
          </div></div>
      </div>
      {/* Record-only — care and purchasing detail, not printed on a contract. */}
      <p className="text-[10px] uppercase tracking-wide text-muted mt-3 mb-1">Care &amp; purchasing (record only)</p>
      <div className="grid sm:grid-cols-2 gap-2">
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

/** A field spec for StructuredList. `description` is always first and required-in-
 *  spirit (the entry's spine); every other field is optional. */
type SLField = { k: string; label: string; kind: 'text' | 'date' | 'textarea' | 'select' | 'bool' | 'occurrence'; options?: { value: string; label: string }[]; placeholder?: string };

const SECTION_NAMES = ['Known conditions', 'Medical history', 'Behavior', 'Medications', 'Supplements', 'Injuries to the horse', 'Injuries to humans'];
const crossRefHelp = (self: string) =>
  `If this relates to anything in the other sections (${SECTION_NAMES.filter((s) => s !== self).join(', ')}), mention it in the description — e.g. a medication the horse takes because of this.`;

/** A repeatable structured list: a card per entry, a required description plus the
 *  section's optional fields. One shared shape across all disclosure sections. */
function StructuredList({ noun, selfSection, fields, items, onChange }: {
  noun: string; selfSection: string; fields: SLField[];
  items: NarrativeEntry[]; onChange: (i: NarrativeEntry[]) => void;
}) {
  const set = (i: number, k: string, v: string | boolean) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const setMany = (i: number, patch: NarrativeEntry) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const val = (it: NarrativeEntry, k: string) => (it[k] == null ? '' : String(it[k]));
  return (
    <div className="sm:col-span-2 flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-green-800/15 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] tracking-wide uppercase text-gold-800 font-semibold">{noun}</p>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-[11px] text-muted hover:text-red-700 underline">Remove</button>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="sm:col-span-2"><L>Description</L>
              <textarea rows={2} className={`${input} resize-y`} value={val(it, 'description')} placeholder="Describe it" onChange={(e) => set(i, 'description', e.target.value)} />
              <p className="text-[10px] text-muted mt-1">{crossRefHelp(selfSection)}</p>
            </div>
            {fields.map((fd) => (
              <div key={fd.k} className={fd.kind === 'textarea' ? 'sm:col-span-2' : ''}><L>{fd.label}</L>
                {fd.kind === 'select' ? (
                  <select className={input} value={val(it, fd.k)} onChange={(e) => set(i, fd.k, e.target.value)}>
                    <option value="">Select…</option>
                    {(fd.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : fd.kind === 'bool' ? (
                  <label className="flex items-center gap-2 text-[13px] text-green-900 mt-1"><input type="checkbox" checked={it[fd.k] === true} onChange={(e) => set(i, fd.k, e.target.checked)} /> Yes</label>
                ) : fd.kind === 'occurrence' ? (
                  /* A "Current" checkbox that, when checked, hides the date. Stores
                     current=true (date cleared) or a `${fd.k}` date. */
                  <div className="mt-1 flex items-center gap-3">
                    <label className="flex items-center gap-2 text-[13px] text-green-900">
                      <input type="checkbox" checked={it.current === true}
                        onChange={(e) => setMany(i, e.target.checked ? { current: true, [fd.k]: '' } : { current: false })} /> Current
                    </label>
                    {it.current !== true && (
                      <input type="date" className={input} value={val(it, fd.k)} onChange={(e) => set(i, fd.k, e.target.value)} />
                    )}
                  </div>
                ) : fd.kind === 'textarea' ? (
                  <textarea rows={2} className={`${input} resize-y`} value={val(it, fd.k)} placeholder={fd.placeholder} onChange={(e) => set(i, fd.k, e.target.value)} />
                ) : (
                  <input type={fd.kind === 'date' ? 'date' : 'text'} className={input} value={val(it, fd.k)} placeholder={fd.placeholder} onChange={(e) => set(i, fd.k, e.target.value)} />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, {}])} className="self-start text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">＋ Add {noun}</button>
    </div>
  );
}

const STATUS_MED = [{ value: 'completed', label: 'Completed' }, { value: 'ongoing', label: 'Ongoing' }];
const STATUS_INJH = [{ value: 'ongoing', label: 'Ongoing' }, { value: 'resolved', label: 'Resolved' }];
const MEDICAL_TYPE = [{ value: 'surgery', label: 'Surgery' }, { value: 'treatment', label: 'Treatment' }, { value: 'monitoring', label: 'Monitoring' }];

/** An initial care provider captured on the intake form, persisted after the horse
 *  is created. For an emergency contact, `emailMatched` records that the typed email
 *  resolved to an account, so it links server-side rather than creating a contact. */
interface ProviderDraft {
  type: HorseProvider['type'];
  role?: string;
  role_label?: string;
  contact_id?: string;   // staff designation pick
  name?: string;
  business_name?: string;
  phone?: string;
  email?: string;
  emailMatched?: boolean;
}

const PROVIDER_TYPES: { value: HorseProvider['type']; label: string }[] = [
  { value: 'VET', label: 'Veterinarian' }, { value: 'FARRIER', label: 'Farrier' },
  { value: 'TRAINER', label: 'Trainer' }, { value: 'GROOM', label: 'Groom' },
  { value: 'CARE_GIVER', label: 'Care giver' }, { value: 'EMERGENCY_CONTACT', label: 'Emergency contact' },
  { value: 'OTHER', label: 'Other' },
];
const DESIGNATION_FOR: Partial<Record<HorseProvider['type'], Designation>> = { TRAINER: 'trainer', GROOM: 'groom', CARE_GIVER: 'care_giver' };

/** One provider draft row. Staff see a designation-filtered picker for the care-team
 *  roles; clients type manually. Emergency contacts use the account-email match flow. */
function ProviderDraftRow({ v, isStaff, onChange, onRemove }: {
  v: ProviderDraft; isStaff: boolean; onChange: (v: ProviderDraft) => void; onRemove: () => void;
}) {
  const set = (patch: Partial<ProviderDraft>) => onChange({ ...v, ...patch });
  const desig = DESIGNATION_FOR[v.type];
  const [people, setPeople] = useState<{ contact_id: string; display_name: string }[]>([]);
  const [manual, setManual] = useState(!v.contact_id);
  const [matchState, setMatchState] = useState<'idle' | 'checking' | 'matched' | 'nomatch' | 'limited'>('idle');
  const [matchedName, setMatchedName] = useState('');
  const [hasAccount, setHasAccount] = useState<'' | 'yes' | 'no' | 'unsure'>('');
  useEffect(() => {
    if (isStaff && desig) peopleWithDesignation(desig).then(setPeople).catch(() => setPeople([]));
    else setPeople([]);
  }, [isStaff, desig]);
  async function checkEmail() {
    if (!v.email?.trim()) return;
    setMatchState('checking');
    try {
      const r = await matchAccountByEmail(v.email.trim());
      if (r.rate_limited) { setMatchState('limited'); set({ emailMatched: false }); }
      else if (r.matched) { setMatchState('matched'); setMatchedName(r.display_name ?? ''); set({ emailMatched: true, name: r.display_name ?? v.name }); }
      else { setMatchState('nomatch'); set({ emailMatched: false }); }
    } catch { setMatchState('idle'); }
  }
  return (
    <div className="rounded-lg border border-green-800/15 p-3">
      <div className="flex items-center justify-between mb-2">
        <select className="text-[11px] uppercase tracking-wide text-gold-800 font-semibold bg-transparent focus-ring rounded px-0.5"
          value={v.type} onChange={(e) => onChange({ type: e.target.value as HorseProvider['type'] })}>
          {PROVIDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="button" onClick={onRemove} className="text-[11px] text-muted hover:text-red-700 underline">Remove</button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {v.type === 'OTHER' && (
          <div className="sm:col-span-2"><L>Role label</L><input className={input} value={v.role_label ?? ''} placeholder="e.g. ranch hand" onChange={(e) => set({ role_label: e.target.value })} /></div>
        )}
        {/* Emergency contact: Yes/No/Unsure + account email match */}
        {v.type === 'EMERGENCY_CONTACT' ? (
          <>
            <div className="sm:col-span-2"><L>Does this person have an account with us?</L>
              <div className="flex gap-2">
                {(['yes', 'no', 'unsure'] as const).map((o) => (
                  <button key={o} type="button" onClick={() => { setHasAccount(o); setMatchState('idle'); }}
                    className={`flex-1 py-1.5 rounded-lg border text-xs capitalize ${hasAccount === o ? 'bg-green-50 border-green-300 text-green-800 font-medium' : 'border-green-800/15 text-secondary hover:bg-green-50'}`}>{o}</button>
                ))}
              </div>
            </div>
            {hasAccount === 'yes' && (
              <div className="sm:col-span-2"><L>The email this person uses for their account with us</L>
                <div className="flex gap-2">
                  <input type="email" className={input} value={v.email ?? ''} onChange={(e) => { set({ email: e.target.value, emailMatched: false }); setMatchState('idle'); }} placeholder="name@example.com" />
                  <button type="button" className="btn-outline-gold text-xs whitespace-nowrap" disabled={matchState === 'checking'} onClick={() => void checkEmail()}>Check</button>
                </div>
                {matchState === 'matched' && <p className="text-[11px] text-green-800 mt-1">Matched: {matchedName}</p>}
                {matchState === 'nomatch' && <p className="text-[11px] text-muted mt-1">No account matches — enter the person’s name and phone below.</p>}
                {matchState === 'limited' && <p className="text-[11px] text-red-700 mt-1">Too many lookups — try again shortly.</p>}
              </div>
            )}
            {(hasAccount === 'no' || hasAccount === 'unsure' || matchState === 'nomatch') && (
              <>
                <div><L>Name</L><input className={input} value={v.name ?? ''} placeholder="Full name" onChange={(e) => set({ name: e.target.value })} /></div>
                <div><L>Phone</L><input type="tel" className={input} value={v.phone ?? ''} placeholder="(555) 555-5555" onChange={(e) => set({ phone: e.target.value })} /></div>
              </>
            )}
          </>
        ) : (isStaff && desig) ? (
          <>
            <div className="sm:col-span-2"><L>Person</L>
              <select className={input} value={manual ? '__manual__' : (v.contact_id ?? '')}
                onChange={(e) => { if (e.target.value === '__manual__') { setManual(true); set({ contact_id: undefined }); } else { setManual(false); set({ contact_id: e.target.value, name: people.find((p) => p.contact_id === e.target.value)?.display_name }); } }}>
                <option value="">Select a person…</option>
                <option value="__manual__">Enter manually…</option>
                {people.map((p) => <option key={p.contact_id} value={p.contact_id}>{p.display_name}</option>)}
              </select>
              {people.length === 0 && <p className="text-[10px] text-muted mt-1">No one carries this designation yet — set it on the Team page, or enter manually.</p>}
            </div>
            {manual && <div className="sm:col-span-2"><L>Name</L><input className={input} value={v.name ?? ''} placeholder="Person’s name" onChange={(e) => set({ name: e.target.value })} /></div>}
            <div><L>Phone</L><input type="tel" className={input} value={v.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} placeholder="(555) 555-5555" /></div>
            <div><L>Email</L><input type="email" className={input} value={v.email ?? ''} onChange={(e) => set({ email: e.target.value })} placeholder="name@example.com" /></div>
          </>
        ) : (
          <>
            <div><L>Name</L><input className={input} value={v.name ?? ''} placeholder="Name" onChange={(e) => set({ name: e.target.value })} /></div>
            {v.type === 'VET' && <div><L>Practice / business</L><input className={input} value={v.business_name ?? ''} placeholder="Practice name" onChange={(e) => set({ business_name: e.target.value })} /></div>}
            <div><L>Phone</L><input type="tel" className={input} value={v.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} placeholder="(555) 555-5555" /></div>
            <div><L>Email</L><input type="email" className={input} value={v.email ?? ''} onChange={(e) => set({ email: e.target.value })} placeholder="name@example.com" /></div>
          </>
        )}
      </div>
    </div>
  );
}

function ProviderDraftList({ isStaff, items, onChange }: { isStaff: boolean; items: ProviderDraft[]; onChange: (i: ProviderDraft[]) => void }) {
  return (
    <div className="sm:col-span-2 flex flex-col gap-2">
      {items.map((it, i) => (
        <ProviderDraftRow key={i} v={it} isStaff={isStaff}
          onChange={(nv) => onChange(items.map((x, j) => (j === i ? nv : x)))}
          onRemove={() => onChange(items.filter((_, j) => j !== i))} />
      ))}
      <button type="button" onClick={() => onChange([...items, { type: 'VET' }])} className="self-start text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">＋ Add provider</button>
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
  'training_history_list', 'competition_history_list', 'injuries_to_horse',
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
  // Initial care providers captured here, persisted after the horse is created.
  const [providers, setProviders] = useState<ProviderDraft[]>([]);
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
          sire: s(raw.sire), dam: s(raw.dam),
          fair_market_value: raw.fair_market_value == null ? '' : Number(raw.fair_market_value).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
          euthanasia_authorization: (raw.euthanasia_authorization === 'A' || raw.euthanasia_authorization === 'B') ? raw.euthanasia_authorization : undefined,
          pending_fields: arr<string>(raw.pending_fields),
          medical_history_list: arr<NarrativeEntry>(raw.medical_history_list),
          behavioral_history_list: arr<NarrativeEntry>(raw.behavioral_history_list),
          known_conditions_list: arr<NarrativeEntry>(raw.known_conditions_list),
          training_history_list: arr<NarrativeEntry>(raw.training_history_list),
          competition_history_list: arr<NarrativeEntry>(raw.competition_history_list),
          injuries_to_humans: s(raw.injuries_to_humans),
          injuries_to_horse: arr<NarrativeEntry>(raw.injuries_to_horse),
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
      } catch (e) { if (active) setErr(errorText(e, 'Could not load the horse record.')); }
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

  /** Persist the initial providers after the horse exists. Best-effort per row — a
   *  failed provider never blocks the record. Emergency contacts with a matched
   *  account email link server-side; others create from name/phone. */
  async function persistProviders(hid: string) {
    for (const p of providers) {
      const hasContent = p.contact_id || filled(p.name) || filled(p.email) || filled(p.phone);
      if (!hasContent) continue;
      try {
        if (p.type === 'EMERGENCY_CONTACT') {
          if (p.emailMatched && filled(p.email)) await addHorseEmergencyContact({ horse_id: hid, email: p.email!.trim() });
          else await addHorseEmergencyContact({ horse_id: hid, name: p.name?.trim(), phone: p.phone?.trim() });
        } else {
          await addHorseProvider({
            horse_id: hid, relationship: p.type,
            provider_role: p.role || 'primary',
            role_label: p.type === 'OTHER' ? (p.role_label?.trim() || undefined) : undefined,
            party_contact_id: p.contact_id || undefined,
            party_name_text: p.name?.trim() || undefined,
            business_name: p.type === 'VET' ? (p.business_name?.trim() || undefined) : undefined,
            phone: p.phone?.trim() || undefined,
            email: p.email?.trim() || undefined,
          });
        }
      } catch { /* record saved; a provider is best-effort */ }
    }
  }

  function reject(message: string) { setShowError(true); setErr(message); setErrorPulse((n) => n + 1); }

  async function submit() {
    setErr(null);
    if (isStaff && !assignTo) { reject('Choose the account this horse belongs to.'); return; }
    if (!hasRealName) { reject('Give the horse a name.'); return; }
    if (breedOpts.length && !isKnownCode(f.breed, breedOpts)) { reject('Breed has to be chosen from the list — pick the closest match or "Other".'); return; }
    if (colorOpts.length && !isKnownCode(f.color, colorOpts)) { reject('Color has to be chosen from the list — pick the closest match or "Other".'); return; }
    setBusy(true);
    try {
      // If a known location's address was edited, ask whether to also update the
      // saved location everywhere (not just this horse's own copy).
      const updateKnown = locEditedKnown && filled(loc.name)
        && window.confirm('You changed the address of a saved location. Also update the saved location for everyone, or keep this change on this horse only?\n\nOK = update the saved location.  Cancel = this horse only.');
      const linkExtras = async (hid: string) => {
        const cleanVacc = vaccinations.filter((v) => filled(v.name) || filled(v.details) || v.file_id);
        if (filled(loc.name) || cleanVacc.length) {
          try { await setHorseLocations(hid, loc, cleanVacc, updateKnown); lastSavedLocRef.current = JSON.stringify(loc); lastSavedVaccRef.current = JSON.stringify(cleanVacc); } catch { /* record saved */ }
        }
        const items = [...meds, ...supplements].filter((m) => filled(m.name));
        if (items.length) { try { await setHorseMedications(hid, items); } catch { /* record saved */ } }
        await persistProviders(hid);
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
  if (horseId && err && !f.nickname) return <p className="form-error text-sm text-red-700 py-4" role="alert">{err}</p>;

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
        Only a <strong>name</strong> is required. Everything else is optional — you can fill it in now or later.
        A field you leave empty, or mark <strong>Add later</strong>, prints “To be provided” on a contract that needs it.
      </p>

      <Section title="Horse identity">
        <Field label="Name" value={f.nickname} onChange={set('nickname')} placeholder="The horse's name (e.g. Beau)" />
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

      <Section title="Registration">
        <p className="text-[11px] text-muted sm:col-span-2 -mb-1">Only for a registered horse. Leave blank if the horse is not registered.</p>
        <Field label="Registered name" value={f.registered_name} onChange={set('registered_name')} placeholder="As written on the registration certificate" />
        <SelectOrOther label="Registration organization" value={f.registration_org} onChange={set('registration_org')} options={toOpts(regOrgOpts)} lookupKey="horse_registration_org" onOptionAdded={(o) => setRegOrgOpts((prev) => addOpt(prev, o))} placeholder="Registry name" />
        <Field label="Registration number" value={f.registration_number} onChange={set('registration_number')}
          addLater pending={pendingSet.has('registration_number')} onPending={(on) => setPendingField('registration_number', on)} />
        <Field label="Date of birth" type="date" value={f.date_of_birth} onChange={set('date_of_birth')} addLater pending={pendingSet.has('date_of_birth')} onPending={(on) => setPendingField('date_of_birth', on)} />
        <Field label="Sire" value={f.sire} onChange={set('sire')} placeholder="Sire's name" />
        <Field label="Dam" value={f.dam} onChange={set('dam')} placeholder="Dam's name" />
      </Section>

      <Section title="Description">
        <SelectOrOther label="Breed" value={f.breed} onChange={set('breed')} invalid={showError && !isKnownCode(f.breed, breedOpts)} options={breedOpts} lookupKey="horse_breeds" onOptionAdded={(o) => setBreeds((prev) => addOpt(prev, o))} placeholder="Breed name" hint="Not listed? Choose “Other (enter manually)” and type it — it joins the list." />
        <SelectOrOther label="Color" value={f.color} onChange={set('color')} invalid={showError && !isKnownCode(f.color, colorOpts)} options={colorOpts} lookupKey="horse_colors" onOptionAdded={(o) => setColors((prev) => addOpt(prev, o))} placeholder="Color" hint="Not listed? Choose “Other (enter manually)” and type it — it joins the list." />
        <Field span label="Markings" textarea value={f.markings} onChange={set('markings')} addLater pending={pendingSet.has('markings')} onPending={(on) => setPendingField('markings', on)}
          placeholder="Describe the markings exactly as written on the registration certificate (e.g. Star pointed at bottom; left hind coronet white, lower on inside…)" />
        <Field label="Sex" value={f.sex} onChange={set('sex')} options={[
          { value: 'MARE', label: 'Mare' }, { value: 'GELDING', label: 'Gelding' }, { value: 'STALLION', label: 'Stallion' }, { value: 'FILLY', label: 'Filly' }, { value: 'COLT', label: 'Colt' },
        ]} />
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
        <div><L>Training history</L><StructuredList noun="training entry" selfSection="" fields={[{ k: 'entry', label: 'Detail', kind: 'text', placeholder: 'e.g. started under saddle 2021; schooling 1.10m' }]} items={f.training_history_list ?? []} onChange={setList('training_history_list')} /></div>
        <div><L>Competition history</L><StructuredList noun="competition entry" selfSection="" fields={[{ k: 'entry', label: 'Detail', kind: 'text', placeholder: 'e.g. 2023 regional championship, 2nd' }]} items={f.competition_history_list ?? []} onChange={setList('competition_history_list')} /></div>
      </div></Section>

      <Section title="Health &amp; disclosures"><div className="sm:col-span-2 grid gap-4">
        <div><L>Known conditions (ongoing or episodic health/soundness, not behavioral)</L>
          <p className="text-[10px] text-muted mb-1">e.g. allergies, certain feed not tolerated, prone to colic from temperature changes.</p>
          <StructuredList noun="condition" selfSection="Known conditions" items={f.known_conditions_list ?? []} onChange={setList('known_conditions_list')} fields={[
            { k: 'trigger', label: 'Trigger', kind: 'text', placeholder: 'e.g. cold, hard ground' },
            { k: 'last_occurrence', label: 'Current or Date of last occurrence', kind: 'occurrence' },
            { k: 'accommodations', label: 'Accommodations', kind: 'textarea', placeholder: 'e.g. special feed blend; turnout routine' },
          ]} /></div>
        <div><L>Medical history (treatments, past and ongoing)</L>
          <p className="text-[10px] text-muted mb-1">e.g. colic surgery, vision impairment, monitoring for tendon damage.</p>
          <StructuredList noun="entry" selfSection="Medical history" items={f.medical_history_list ?? []} onChange={setList('medical_history_list')} fields={[
            { k: 'date', label: 'Date', kind: 'date' },
            { k: 'type', label: 'Type', kind: 'select', options: MEDICAL_TYPE },
            { k: 'status', label: 'Status', kind: 'select', options: STATUS_MED },
          ]} /></div>
        <div><L>Known behaviors</L>
          <p className="text-[10px] text-muted mb-1">e.g. afraid of dogs, randomly bucks or tries to throw riders.</p>
          <StructuredList noun="behavior" selfSection="Behavior" items={f.behavioral_history_list ?? []} onChange={setList('behavioral_history_list')} fields={[
            { k: 'trigger', label: 'Trigger', kind: 'text', placeholder: 'e.g. wind, clippers' },
            { k: 'last_occurrence', label: 'Current or Date of last occurrence', kind: 'occurrence' },
          ]} /></div>
        <div><L>Injuries to the horse (dated events)</L>
          <p className="text-[10px] text-muted mb-1">e.g. ruptured tendon.</p>
          <StructuredList noun="injury to the horse" selfSection="Injuries to the horse" items={f.injuries_to_horse ?? []} onChange={setList('injuries_to_horse')} fields={[
            { k: 'date', label: 'Date or date range', kind: 'text', placeholder: 'e.g. May 2024' },
            { k: 'outcome', label: 'Outcome', kind: 'text' },
            { k: 'status', label: 'Status', kind: 'select', options: STATUS_INJH },
          ]} />
          <p className="text-[10px] text-muted mt-1">An injury with lasting effects should also get a Known conditions entry.</p></div>
        <div><L>Injuries caused to humans</L>
          <p className="text-[10px] text-muted mb-1">Has this horse ever caused a serious injury to a person? Broken bone is serious; a light bruise is insignificant. Prints on sale and lease contracts.</p>
          <div className="flex gap-1.5">
            {([['YES', 'Yes'], ['NO', 'No'], ['UNKNOWN', 'Unknown']] as const).map(([v, lbl]) => (
              <button key={v} type="button"
                onClick={() => setF((p) => ({ ...p, injuries_to_humans: v }))}
                className={`text-sm rounded-lg px-4 py-1.5 border focus-ring ${
                  f.injuries_to_humans === v ? 'bg-green-800 text-white border-green-800' : 'border-green-800/15 text-secondary hover:bg-green-50'}`}>
                {lbl}
              </button>
            ))}
          </div></div>
      </div></Section>

      <Section title="Care providers">
        <p className="sm:col-span-2 text-[11px] text-muted -mt-1">
          Vet, farrier, trainer, groom, care giver, an emergency backup contact, or anyone else.
          {recordIdRef.current ? ' More can be added, changed, or ended on the horse’s record.' : ''}
        </p>
        {recordIdRef.current ? (
          <p className="sm:col-span-2 text-[11px] text-muted">Providers already on this record are managed from the record’s Current providers section.</p>
        ) : (
          <ProviderDraftList isStaff={isStaff} items={providers} onChange={setProviders} />
        )}
      </Section>

      <Section title="Medications"><RepeatableMeds kind="MEDICATION" items={meds} onChange={setMeds} /></Section>
      <Section title="Supplements"><RepeatableMeds kind="SUPPLEMENT" items={supplements} onChange={setSupplements} /></Section>
      <Section title="Vaccinations"><RepeatableVaccinations items={vaccinations} onChange={setVaccinations} /></Section>

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
