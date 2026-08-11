import { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldQuestion } from 'lucide-react';
import {
  createHorseRecord, setHorseLocations, setHorseMedications,
  getHorseIntakeRecord, updateHorseRecord, horsePageDetail, listHorseMedications,
  HORSE_DOC_REQUIRED_KEYS, HORSE_DOC_REQUIRED_LABELS, HORSE_SENTINEL_UNSAFE_KEYS, errorText,
  type HorseIntakePayload, type HorseRecordOutcome, type HorseLocationDetail, type HorseMedication,
} from '../../lib/horses';
import {
  fetchLocations, fetchContactLocations,
  type CalendarLocation,
} from '../../lib/ops/api-calendar';
import { listHorseBreeds, listHorseColors, listLookupOptions, recordLookupSuggestion } from '../../lib/api';
import { adminClientAccounts, type ClientAccountRow } from '../../lib/admin';
import { useAuth } from '../../contexts/AuthContext';
import type { LookupCode } from '../../lib/ops/types';

/**
 * HORSE RECORD INTAKE — the standardized form, the matched pair to the record and
 * the source of every {{HORSE.*}} on the vet-auth / care-release / lease docs.
 *
 * Owner rule: EVERY field must be answered — either filled in or explicitly
 * marked "N/A" (a horse genuinely may have no microchip, registration, meds…),
 * so a legal document never renders a silently-blank field. Each field carries an
 * N/A toggle; submit is blocked until all applicable fields are answered.
 *
 * ONE creation path: create_horse_record. A client's record binds to their own
 * account; STAFF pick the owning client via the in-form "Assign to account" picker
 * (create_horse_record honors owner_contact_id for staff only).
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

/** A required field with an N/A escape. When N/A is checked the control disables
 *  and the value becomes the sentinel "N/A" (a conscious answer, not a blank).
 *  `required` marks the label with the trailing asterisk this form already uses
 *  on the staff account picker — the owner asked for required to be visible
 *  BEFORE a failed save, not only after it. */
function Field({
  label, value, onChange, type = 'text', placeholder, options, span, textarea, showError, required, inputMode, onBlurFormat,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  span?: boolean;
  textarea?: boolean;
  showError?: boolean;
  required?: boolean;
  inputMode?: 'numeric' | 'tel' | 'email' | 'url' | 'text';
  /** normalize the value on blur (e.g. currency) — returns the display string. */
  onBlurFormat?: (v: string) => string;
}) {
  const na = value === NA;
  const answered = na || filled(value);
  const cls = `${input}${showError && !answered ? ' border-red-400' : ''}`;
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold">{label}{required ? ' *' : ''}</label>
        <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
          <input type="checkbox" checked={na} onChange={(e) => onChange(e.target.checked ? NA : '')} /> N/A
        </label>
      </div>
      {options ? (
        <select className={cls} disabled={na} value={na ? '' : (value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : textarea ? (
        <textarea rows={2} className={`${cls} resize-y max-h-40`} disabled={na} value={na ? '' : (value ?? '')} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} inputMode={inputMode} className={cls} disabled={na} value={na ? '' : (value ?? '')} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlurFormat ? (e) => { const out = onBlurFormat(e.target.value); if (out !== e.target.value) onChange(out); } : undefined} />
      )}
    </div>
  );
}

const OTHER = '__other__';

/** SELECT-OR-OTHER: a dropdown of known options plus an "Other" escape that reveals
 *  a free-text box. When the user types an "Other" value it's stored as the value AND
 *  captured (record_lookup_suggestion) so the barn can promote frequent entries into
 *  the official list later. A stored value that isn't a known option code is treated
 *  as a prior "Other" entry and shown in the text box. Keeps the N/A escape. */
function SelectOrOther({
  label, value, onChange, options, lookupKey, placeholder, span, showError, required, invalid, hint,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  lookupKey: string;
  placeholder?: string;
  span?: boolean;
  showError?: boolean;
  required?: boolean;
  /** Answered, but with a value this field cannot store (a typed-in code that
   *  isn't in the vocabulary) — marked like an unanswered required field. */
  invalid?: boolean;
  hint?: string;
}) {
  // Vocabularies that define a NONE code (passport country, registration org,
  // markings) get the code, not the 'N/A' sentinel — the backend resolves NONE
  // to its display text ("No passport", "Not registered") while a raw 'N/A'
  // can only ever render as the literal sentinel.
  const hasNone = options.some((o) => o.value === 'NONE');
  const naStored = hasNone ? 'NONE' : NA;
  const na = value === NA || (hasNone && value === 'NONE');
  const isKnown = !!value && value !== NA && options.some((o) => o.value === value);
  const isOther = !na && !!value && value !== NA && !isKnown;
  const [otherOpen, setOtherOpen] = useState(isOther);
  const answered = na || filled(value);
  const cls = `${input}${(showError && !answered) || invalid ? ' border-red-400' : ''}`;

  const selectValue = na ? '' : otherOpen || isOther ? OTHER : (isKnown ? value : '');
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold">{label}{required ? ' *' : ''}</label>
        <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
          <input type="checkbox" checked={na} onChange={(e) => { setOtherOpen(false); onChange(e.target.checked ? naStored : ''); }} /> N/A
        </label>
      </div>
      <select className={cls} disabled={na} value={selectValue}
        onChange={(e) => {
          if (e.target.value === OTHER) { setOtherOpen(true); onChange(''); }
          else { setOtherOpen(false); onChange(e.target.value); }
        }}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        <option value={OTHER}>Other (enter manually)…</option>
      </select>
      {(otherOpen || isOther) && !na && (
        <input className={`${cls} mt-1.5`} disabled={na} value={isKnown ? '' : (value ?? '')} placeholder={placeholder ?? 'Type the value'}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => { const v = e.target.value.trim(); if (v) recordLookupSuggestion(lookupKey, v).catch(() => {}); }} />
      )}
      {hint && <p className="text-[10px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

/** PERSON BLOCK: a contact grouped as one structured unit — a name plus a second
 *  typed part (phone or email) — instead of two loose fields. Writes each part to its
 *  own underlying field (the columns stay separate); the grouping is what makes it read
 *  and behave as a single reusable contact. Shared N/A marks the whole contact absent. */
function PersonBlock({
  title, name, second, showError, span = true,
}: {
  title: string;
  name: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string; required?: boolean };
  /** `required` — the second part is its own required answer (the farrier's phone
   *  is a document-merged token). Without it the field could never turn red, so a
   *  failed save named a problem with nothing on screen to point at. */
  second: { label: string; kind: 'tel' | 'email'; value?: string; onChange: (v: string) => void; placeholder?: string; required?: boolean };
  showError?: boolean;
  span?: boolean;
}) {
  // N/A applies to the whole block: both parts become the sentinel together.
  const na = name.value === NA && second.value === NA;
  const answered = na || filled(name.value);
  const secondAnswered = na || second.value === NA || filled(second.value);
  const setNa = (on: boolean) => { name.onChange(on ? NA : ''); second.onChange(on ? NA : ''); };
  const cls = (bad: boolean) => `${input}${showError && bad ? ' border-red-400' : ''}`;
  return (
    <div className={`${span ? 'sm:col-span-2' : ''} rounded-lg border border-green-800/10 p-3`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] tracking-wide uppercase text-muted font-semibold">{title}</p>
        <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
          <input type="checkbox" checked={na} onChange={(e) => setNa(e.target.checked)} /> N/A
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{name.label}{name.required ? ' *' : ''}</label>
          <input className={cls(!answered)} disabled={na} value={na ? '' : (name.value ?? '')} placeholder={name.placeholder}
            onChange={(e) => name.onChange(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{second.label}{second.required ? ' *' : ''}</label>
          <input type={second.kind} inputMode={second.kind} className={cls(!!second.required && !secondAnswered)} disabled={na}
            value={na ? '' : (second.value ?? '')} placeholder={second.placeholder}
            onChange={(e) => second.onChange(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

/** VET BLOCK: the veterinarian as a fuller contact — vet/practice name, business
 *  name, phone, and a structured address (street / city / state / ZIP). Each part
 *  writes to its own horses column; the block groups them and shares one N/A. Only
 *  the vet name is required to complete the block. */
function VetBlock({
  f, set, showError,
}: {
  f: HorseIntakePayload;
  set: (k: keyof HorseIntakePayload) => (v: string) => void;
  showError?: boolean;
}) {
  const parts: (keyof HorseIntakePayload)[] = ['vet_name', 'vet_phone', 'vet_business_name', 'vet_address_line1', 'vet_city', 'vet_state', 'vet_postal'];
  const na = parts.every((k) => f[k] === NA);
  const answered = na || filled(f.vet_name as string | undefined);
  // The vet's PHONE is a document-merged token, so it is required too — and it
  // had no error state at all, which is how a failed save could highlight nothing.
  const phoneAnswered = na || f.vet_phone === NA || filled(f.vet_phone as string | undefined);
  const setNa = (on: boolean) => parts.forEach((k) => set(k)(on ? NA : ''));
  const val = (k: keyof HorseIntakePayload) => (na ? '' : ((f[k] as string | undefined) ?? ''));
  const cls = (bad: boolean) => `${input}${showError && bad ? ' border-red-400' : ''}`;
  const L = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{children}</label>
  );
  return (
    <div className="sm:col-span-2 rounded-lg border border-green-800/10 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] tracking-wide uppercase text-muted font-semibold">Current Veterinarian</p>
        <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
          <input type="checkbox" checked={na} onChange={(e) => setNa(e.target.checked)} /> N/A
        </label>
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        <div><L>Veterinarian name *</L>
          <input className={cls(!answered)} disabled={na} value={val('vet_name')} placeholder="Dr. name" onChange={(e) => set('vet_name')(e.target.value)} /></div>
        <div><L>Business / practice name</L>
          <input className={cls(false)} disabled={na} value={val('vet_business_name')} placeholder="Practice name" onChange={(e) => set('vet_business_name')(e.target.value)} /></div>
        <div><L>Phone *</L>
          <input type="tel" inputMode="tel" className={cls(!phoneAnswered)} disabled={na} value={val('vet_phone')} placeholder="(555) 555-5555" onChange={(e) => set('vet_phone')(e.target.value)} /></div>
        <div><L>Street address</L>
          <input className={cls(false)} disabled={na} value={val('vet_address_line1')} placeholder="123 Barn Rd" onChange={(e) => set('vet_address_line1')(e.target.value)} /></div>
        <div><L>City</L>
          <input className={cls(false)} disabled={na} value={val('vet_city')} placeholder="San Diego" onChange={(e) => set('vet_city')(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><L>State</L>
            <input className={cls(false)} disabled={na} value={val('vet_state')} placeholder="CA" onChange={(e) => set('vet_state')(e.target.value)} /></div>
          <div><L>ZIP</L>
            <input className={cls(false)} inputMode="numeric" disabled={na} value={val('vet_postal')} placeholder="92109" onChange={(e) => set('vet_postal')(e.target.value)} /></div>
        </div>
      </div>
    </div>
  );
}

/** PREFIX INPUT — a standardized composite: a small dropdown that picks the label
 *  (e.g. Barn / Stable) + a typed value, producing one string like "Barn A". Reduces
 *  variance and speeds entry. The value is stored/read as "<prefix> <value>". */
// Parse/compose a composite "<prefix> <value>" (e.g. "Barn A"). Split into two
// standalone controls (PrefixSelect + PrefixValue) so they can sit as separate items
// in a row rather than a nested composite.
function parsePrefix(value: string | undefined, prefixes: string[]) {
  const parts = (value ?? '').trim().split(/\s+/);
  const prefix = parts.length && prefixes.includes(parts[0]) ? parts[0] : prefixes[0];
  const rest = parts.length && prefixes.includes(parts[0]) ? parts.slice(1).join(' ') : (value ?? '');
  return { prefix, rest };
}
const composePrefix = (p: string, rest: string) => (rest.trim() ? `${p} ${rest.trim()}` : '');

function PrefixSelect({ prefixes, value, onChange }: { prefixes: string[]; value?: string; onChange: (v: string) => void }) {
  const { prefix, rest } = parsePrefix(value, prefixes);
  return (
    <select className={input} value={prefix} onChange={(e) => onChange(composePrefix(e.target.value, rest))}>
      {prefixes.map((p) => <option key={p} value={p}>{p}</option>)}
    </select>
  );
}
function PrefixValue({ prefixes, value, onChange, placeholder }: { prefixes: string[]; value?: string; onChange: (v: string) => void; placeholder?: string }) {
  const { prefix, rest } = parsePrefix(value, prefixes);
  return (
    <input className={input} value={rest} placeholder={placeholder}
      onChange={(e) => onChange(composePrefix(prefix, e.target.value))} />
  );
}


/** LOCATION ENTRY — a fully findable location: name + structured address (on the
 *  shared place), plus THIS horse's barn/stall, findability notes, and on-site people
 *  (trainer / care giver / groom / other). A bare name like "Carmel Creek Ranch" isn't
 *  enough to find a horse; the address + barn/stall are what make it locatable. */
function LocationEntry({
  title, heading, v, onChange, showError, required, nameOptions,
}: {
  title: string;
  heading: string;
  v: HorseLocationDetail;
  onChange: (v: HorseLocationDetail) => void;
  showError?: boolean;
  required?: boolean;
  nameOptions: { value: string; label: string }[];
}) {
  const set = (patch: Partial<HorseLocationDetail>) => onChange({ ...v, ...patch });
  const listId = `loc-names-${title.replace(/\s+/g, '-')}`;
  const bad = showError && !filled(v.name);
  const L = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{children}</label>
  );
  return (
    <div className="rounded-lg border border-green-800/15 p-3">
      {title && <p className="text-[11px] tracking-wide uppercase text-gold-800 font-semibold mb-0.5">{title}</p>}
      {heading && <p className="text-[10px] text-muted mb-2.5">{heading}</p>}
      <div className="grid sm:grid-cols-2 gap-2">
        <div className="sm:col-span-2"><L>Location name{required ? ' *' : ''}</L>
          <input list={listId} className={`${input}${bad ? ' border-red-400' : ''}`} value={v.name ?? ''}
            placeholder="e.g. Carmel Creek Ranch" onChange={(e) => set({ name: e.target.value })} />
          <datalist id={listId}>{nameOptions.map((o) => <option key={o.value} value={o.value} />)}</datalist>
        </div>
        <div className="sm:col-span-2"><L>Street address</L>
          <input className={input} value={v.address_line1 ?? ''} placeholder="123 Ranch Rd" onChange={(e) => set({ address_line1: e.target.value })} /></div>
        <div><L>City</L>
          <input className={input} value={v.city ?? ''} placeholder="San Diego" onChange={(e) => set({ city: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><L>State</L><input className={input} value={v.state ?? ''} placeholder="CA" onChange={(e) => set({ state: e.target.value })} /></div>
          <div><L>ZIP</L><input className={input} inputMode="numeric" value={v.postal ?? ''} placeholder="92109" onChange={(e) => set({ postal: e.target.value })} /></div>
        </div>
        {/* Barn + Stall as four items in one row: prefix select + typed value for each. */}
        <div className="sm:col-span-2 grid grid-cols-4 gap-2 items-end">
          <div className="min-w-0"><L>Barn <span className="text-muted normal-case">(blank if outdoor)</span></L>
            <PrefixSelect prefixes={['Barn', 'Stable']} value={v.barn} onChange={(barn) => set({ barn })} /></div>
          <div className="min-w-0"><L>&nbsp;</L>
            <PrefixValue value={v.barn} prefixes={['Barn', 'Stable']} placeholder="e.g. A" onChange={(barn) => set({ barn })} /></div>
          <div className="min-w-0"><L>Stall</L>
            <PrefixSelect prefixes={['Stall', 'Pen']} value={v.stall} onChange={(stall) => set({ stall })} /></div>
          <div className="min-w-0"><L>&nbsp;</L>
            <PrefixValue value={v.stall} prefixes={['Stall', 'Pen']} placeholder="e.g. 16" onChange={(stall) => set({ stall })} /></div>
        </div>
        <div className="sm:col-span-2"><L>Notes</L>
          <textarea rows={2} className={`${input} resize-y`} value={v.notes ?? ''}
            placeholder="information that would be helpful in finding this location"
            onChange={(e) => set({ notes: e.target.value })} /></div>
        <div><L>Trainer</L>
          <input className={input} value={v.trainer ?? ''} placeholder="Name (optional)" onChange={(e) => set({ trainer: e.target.value })} /></div>
        <div><L>Care giver</L>
          <input className={input} value={v.care_giver ?? ''} placeholder="Name (optional)" onChange={(e) => set({ care_giver: e.target.value })} /></div>
        <div><L>Groom</L>
          <input className={input} value={v.groom ?? ''} placeholder="Name (optional)" onChange={(e) => set({ groom: e.target.value })} /></div>
        <div><L>Other</L>
          <input className={input} value={v.other ?? ''} placeholder="Role — name (optional)" onChange={(e) => set({ other: e.target.value })} /></div>
      </div>
    </div>
  );
}

/** A single medication/supplement block: name, dosage, instructions, cost, structured
 *  supplier (website/phone[/Rx]), and order quantity (units + days supply). rx_info is
 *  shown for medications only. */
function MedicationBlock({
  v, kind, onChange, onRemove,
}: {
  v: HorseMedication;
  kind: 'MEDICATION' | 'SUPPLEMENT';
  onChange: (v: HorseMedication) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<HorseMedication>) => onChange({ ...v, ...patch });
  const L = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{children}</label>
  );
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
        <div className="sm:col-span-2"><L>Instructions</L>
          <input className={input} value={v.instructions ?? ''} placeholder="e.g. one scoop AM/PM with feed" onChange={(e) => set({ instructions: e.target.value })} /></div>
        <div><L>Order quantity (units)</L><input className={input} value={v.order_units ?? ''} placeholder="e.g. 30 tablets" onChange={(e) => set({ order_units: e.target.value })} /></div>
        <div><L>Days supply</L><input className={input} inputMode="numeric" value={v.days_supply ?? ''} placeholder="e.g. 30" onChange={(e) => set({ days_supply: e.target.value })} /></div>
        <div><L>Cost (per order)</L>
          <input className={input} inputMode="numeric" value={v.cost ?? ''} placeholder="$0.00"
            onChange={(e) => set({ cost: e.target.value })}
            onBlur={(e) => { const n = Number(e.target.value.replace(/[$,\s]/g, '')); if (Number.isFinite(n) && e.target.value.trim()) set({ cost: n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) }); }} /></div>
        <div><L>Supplier website</L><input type="url" className={input} value={v.supplier_website ?? ''} placeholder="https://…" onChange={(e) => set({ supplier_website: e.target.value })} /></div>
        <div><L>Supplier phone</L><input type="tel" className={input} value={v.supplier_phone ?? ''} placeholder="(555) 555-5555" onChange={(e) => set({ supplier_phone: e.target.value })} /></div>
        {kind === 'MEDICATION' && (
          <div><L>Rx info</L><input className={input} value={v.rx_info ?? ''} placeholder="Rx #, prescriber" onChange={(e) => set({ rx_info: e.target.value })} /></div>
        )}
      </div>
    </div>
  );
}

/** A repeatable list of medication or supplement blocks, with an "add" button. */
function RepeatableMeds({
  kind, items, onChange,
}: {
  kind: 'MEDICATION' | 'SUPPLEMENT';
  items: HorseMedication[];
  onChange: (items: HorseMedication[]) => void;
}) {
  const noun = kind === 'SUPPLEMENT' ? 'supplement' : 'medication';
  return (
    <div className="sm:col-span-2 flex flex-col gap-2">
      {items.map((it, i) => (
        <MedicationBlock key={i} v={it} kind={kind}
          onChange={(nv) => onChange(items.map((x, j) => (j === i ? nv : x)))}
          onRemove={() => onChange(items.filter((_, j) => j !== i))} />
      ))}
      <button type="button" onClick={() => onChange([...items, { kind }])}
        className="self-start text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">
        ＋ Add {noun}
      </button>
    </div>
  );
}

/** Columns update_horse_record accepts as a sparse patch (autosave allowlist). */
const PATCHABLE_KEYS: (keyof HorseIntakePayload)[] = [
  'registered_name', 'nickname', 'breed', 'color', 'markings', 'sex',
  'date_of_birth', 'height', 'registration_number', 'registration_org',
  'microchip_id', 'passport_number', 'passport_country', 'fair_market_value',
  'vet_name', 'vet_phone', 'vet_business_name', 'vet_address_line1', 'vet_city',
  'vet_state', 'vet_postal', 'farrier_name', 'farrier_phone',
  'medical_history', 'behavioral_history', 'known_conditions',
  'euthanasia_authorization', 'training_history', 'competition_history',
];
// Columns that can't hold the 'N/A' sentinel (typed, CHECK-constrained, or a
// foreign key into the breed/color vocabularies) — persist those as cleared.
// The set lives in lib/horses.ts so the create path and the patch path can't
// drift: it was the create path missing this that blocked a real owner.
const TYPED_KEYS = new Set<keyof HorseIntakePayload>(HORSE_SENTINEL_UNSAFE_KEYS);

export function HorseIntakeForm({
  onDone, submitLabel = 'Add horse', ownerContactId, horseId,
}: {
  /** Fires on created OR match_found (both attach an id); pending-review shows in-form. */
  onDone: (horseId: string) => void;
  submitLabel?: string;
  /** Optional PRESET of the owning account (e.g. a staff page that already knows the
   *  client). Staff can still change it via the in-form account picker; ignored for
   *  non-staff callers (the record always binds to them). */
  ownerContactId?: string;
  /** EDIT/REVIEW mode: load this existing record prefilled — the member reviews
   *  what's on file, completes the required fields, and every field autosaves
   *  on blur (partial progress survives a skip). */
  horseId?: string;
}) {
  const { isStaff } = useAuth();
  const [f, setF] = useState<HorseIntakePayload>({ is_leased: 'no' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showError, setShowError] = useState(false);
  // Bumped on every REJECTED submit so the scroll-to-the-first-problem effect
  // re-fires even when the error state was already on. On a form this long the
  // first red border is routinely far off-screen, so the message alone read as
  // "it tells me nothing is wrong but won't save".
  const [errorPulse, setErrorPulse] = useState(0);
  const formRef = useRef<HTMLDivElement>(null);
  // AUTOSAVE-ON-BLUR: once a record exists (edit mode, or right after the first
  // successful create), leaving any field persists the changed columns via the
  // update_horse_record sparse patch (it RAISES rather than silently no-ops, so
  // a blocked write surfaces). lastSavedRef tracks what the server has.
  const recordIdRef = useRef<string | null>(horseId ?? null);
  const lastSavedRef = useRef<HorseIntakePayload>({});
  const savingRef = useRef(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // What the database actually said when an autosave failed (was discarded).
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [locations, setLocations] = useState<CalendarLocation[]>([]);
  // Staff-only: the account this record is assigned to. The record binds to the
  // creating account UNLESS staff assigns it to another client here. For a client
  // caller this stays empty and the backend binds the horse to them.
  const [accounts, setAccounts] = useState<ClientAccountRow[]>([]);
  const [assignTo, setAssignTo] = useState<string>(ownerContactId ?? '');
  // Rich location model: home always; current only when it differs from home.
  const [homeLoc, setHomeLoc] = useState<HorseLocationDetail>({});
  const [currentLoc, setCurrentLoc] = useState<HorseLocationDetail>({});
  const [currentDiffers, setCurrentDiffers] = useState(false);
  // Repeatable medications + supplements (each a block).
  const [meds, setMeds] = useState<HorseMedication[]>([]);
  const [supplements, setSupplements] = useState<HorseMedication[]>([]);
  // Lease: whether the leased state came from an executed contract (read-only), the
  // lease location (= current location during the term), and an optional temporary
  // current location (a >48h stay elsewhere during the lease).
  const [leaseLoc, setLeaseLoc] = useState<HorseLocationDetail>({});
  const [tempLocOpen, setTempLocOpen] = useState(false);
  const [tempLoc, setTempLoc] = useState<HorseLocationDetail>({});
  // On a NEW horse there's no contract yet, so the checkbox is always manual here.
  // (The contract-driven read-only state applies when viewing an existing leased horse.)
  const leaseFromContract = false;
  // Reference lookups — breed & color are CODES the backend resolves to display
  // names for {{HORSE.BREED}}/{{HORSE.COLOR}}. A free-text value never matches a
  // code, so these MUST be selects from the reference tables.
  const [breeds, setBreeds] = useState<LookupCode[]>([]);
  const [colors, setColors] = useState<LookupCode[]>([]);
  const [markingOpts, setMarkingOpts] = useState<LookupCode[]>([]);
  const [regOrgOpts, setRegOrgOpts] = useState<LookupCode[]>([]);
  const [passportCountryOpts, setPassportCountryOpts] = useState<LookupCode[]>([]);

  // Staff assigning to a client → that CLIENT's locations; otherwise the caller's.
  const loadLocations = () =>
    (assignTo ? fetchContactLocations(assignTo) : fetchLocations())
      .then((locs) => { setLocations(locs); return locs; })
      .catch(() => { setLocations([]); return [] as CalendarLocation[]; });
  useEffect(() => {
    loadLocations();   // populates the location-name suggestions; no auto-pre-fill
    // Staff get the client-account list for the assign-to picker.
    if (isStaff) adminClientAccounts().then(setAccounts).catch(() => setAccounts([]));
    listHorseBreeds().then(setBreeds).catch(() => setBreeds([]));
    listHorseColors().then(setColors).catch(() => setColors([]));
    listLookupOptions('horse_markings').then(setMarkingOpts).catch(() => setMarkingOpts([]));
    listLookupOptions('horse_registration_org').then(setRegOrgOpts).catch(() => setRegOrgOpts([]));
    listLookupOptions('horse_passport_country').then(setPassportCountryOpts).catch(() => setPassportCountryOpts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Staff changed the assigned account → reload that client's locations.
  useEffect(() => {
    if (!isStaff) return;
    loadLocations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignTo]);

  // EDIT/REVIEW mode: prefill from the existing record (raw codes for the
  // selects), its locations (display detail), and its medication list.
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
        const next: HorseIntakePayload = {
          is_leased: raw.lessee_name_text ? 'yes' : 'no',
          nickname: s(raw.nickname), registered_name: s(raw.registered_name),
          registration_number: s(raw.registration_number), registration_org: s(raw.registration_org),
          microchip_id: s(raw.microchip_id), passport_number: s(raw.passport_number),
          passport_country: s(raw.passport_country), breed: s(raw.breed), color: s(raw.color),
          markings: s(raw.markings), sex: s(raw.sex),
          date_of_birth: s(raw.date_of_birth).slice(0, 10), height: s(raw.height),
          fair_market_value: raw.fair_market_value == null ? ''
            : Number(raw.fair_market_value).toLocaleString('en-US', { style: 'currency', currency: 'USD' }),
          vet_name: s(raw.vet_name), vet_phone: s(raw.vet_phone),
          vet_business_name: s(raw.vet_business_name), vet_address_line1: s(raw.vet_address_line1),
          vet_city: s(raw.vet_city), vet_state: s(raw.vet_state), vet_postal: s(raw.vet_postal),
          farrier_name: s(raw.farrier_name), farrier_phone: s(raw.farrier_phone),
          medical_history: s(raw.medical_history), behavioral_history: s(raw.behavioral_history),
          known_conditions: s(raw.known_conditions),
          euthanasia_authorization: (raw.euthanasia_authorization === 'A' || raw.euthanasia_authorization === 'B')
            ? raw.euthanasia_authorization : undefined,
          training_history: s(raw.training_history), competition_history: s(raw.competition_history),
          lessee_name_text: s(raw.lessee_name_text),
          lease_start: s(raw.lease_start).slice(0, 10), lease_end: s(raw.lease_end).slice(0, 10),
        };
        setF(next);
        lastSavedRef.current = { ...next };
        recordIdRef.current = horseId;
        const rec = detail?.record;
        if (rec) {
          if (rec.home_location?.name || rec.home_barn || rec.home_stall) {
            setHomeLoc({
              name: rec.home_location?.name ?? '', address_line1: rec.home_location?.address_line1 ?? '',
              city: rec.home_location?.city ?? '', state: rec.home_location?.state ?? '',
              postal: rec.home_location?.postal ?? '',
              barn: rec.home_barn ?? '', stall: rec.home_stall ?? '', notes: rec.home_notes ?? '',
              trainer: rec.home_trainer ?? '', care_giver: rec.home_care_giver ?? '',
              groom: rec.home_groom ?? '', other: rec.home_other ?? '',
            });
          }
          if (rec.current_location?.name && rec.current_location.name !== rec.home_location?.name) {
            setCurrentDiffers(true);
            setCurrentLoc({
              name: rec.current_location.name, address_line1: rec.current_location.address_line1 ?? '',
              city: rec.current_location.city ?? '', state: rec.current_location.state ?? '',
              postal: rec.current_location.postal ?? '',
              barn: rec.current_barn ?? '', stall: rec.current_stall ?? '',
            });
          }
        }
        if (medRows.length) {
          setMeds(medRows.filter((m) => m.kind !== 'SUPPLEMENT'));
          setSupplements(medRows.filter((m) => m.kind === 'SUPPLEMENT'));
        }
      } catch { /* form stays blank; the record may not be readable */ }
      finally { if (active) setLoadingRecord(false); }
    })();
    return () => { active = false; };
  }, [horseId]);

  /** AUTOSAVE (fires on every blur inside the form): sparse-patch only the
   *  changed columns. 'N/A' on a typed column persists as cleared. */
  async function autosave() {
    const id = recordIdRef.current;
    if (!id || savingRef.current) return;
    const patch: Record<string, string> = {};
    for (const k of PATCHABLE_KEYS) {
      const cur = (f[k] as string | undefined) ?? '';
      const prev = (lastSavedRef.current[k] as string | undefined) ?? '';
      if (cur !== prev) patch[k] = (TYPED_KEYS.has(k) && cur === NA) ? '' : cur;
    }
    if (Object.keys(patch).length === 0) return;
    savingRef.current = true;
    setSaveState('saving');
    try {
      await updateHorseRecord(id, patch);   // raises on a blocked write — never silent
      lastSavedRef.current = { ...f };
      setSaveErr(null);
      setSaveState('saved');
    } catch (e) {
      setSaveErr(errorText(e, 'Could not save your last change.'));
      setSaveState('error');
    } finally {
      savingRef.current = false;
    }
  }

  // Take the member TO the first thing that needs them. Runs on every rejected
  // submit, preferring the first flagged field and falling back to the message
  // itself when the rejection came from the server rather than a field.
  useEffect(() => {
    if (!errorPulse) return;
    const root = formRef.current;
    const target = root?.querySelector('.border-red-400') ?? root?.querySelector('.form-error');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [errorPulse]);

  const toOpts = (rows: LookupCode[]) => rows.map((r) => ({ value: r.code, label: r.display_name }));
  const breedOpts = toOpts(breeds);
  const colorOpts = toOpts(colors);
  const accountLabel = (a: ClientAccountRow) =>
    a.display_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Account';
  const locationNameOpts = locations.map((l) => ({ value: l.name, label: l.name }));
  // Known locations for the temporary-location picker: the horse's own entries (home,
  // lease) + any location records from the system, MINUS the current lease location
  // (offering the current location as a "temporary" choice is meaningless). Each carries
  // its full detail so picking one fills the temporary block.
  const knownLocations: HorseLocationDetail[] = [
    homeLoc,
    ...locations.map((l) => ({ name: l.name, address_line1: l.address ?? undefined })),
  ].filter((k) => filled(k.name) && k.name !== leaseLoc.name);
  const knownLocationOpts = knownLocations
    .filter((k, i, a) => a.findIndex((x) => x.name === k.name) === i)   // de-dup by name
    .map((k) => ({ value: k.name!, label: k.name! }));

  const set = (k: keyof HorseIntakePayload) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const leased = f.is_leased === 'yes';
  // This record is always the OWNER's (creator or staff-assigned client) — there is no
  // lessee-creator path.

  // Every applicable field must be answered (filled or N/A). Names are special:
  // at least one of registered/barn must be a REAL name (not N/A).
  const answered = (v?: string) => v === NA || filled(v);
  // A person block's secondary part (phone/email) is satisfied once its name partner
  // is answered — a named contact needn't also carry a phone to complete the form.
  const secondaryOk = (name?: string, second?: string) => answered(second) || answered(name);
  // REQUIRED = exactly the fields the two horse onboarding documents merge
  // (HORSE_EMERGENCY_VET + RELEASE_HORSE_CARE tokens — HORSE_DOC_REQUIRED_KEYS)
  // plus the name/euthanasia/location structural requirements below. Everything
  // else (registration org, passport, markings, histories) is optional.
  const alwaysKeys: (keyof HorseIntakePayload)[] = HORSE_DOC_REQUIRED_KEYS;
  // Medications & supplements are repeatable and OPTIONAL (a horse may have none);
  // they're not part of the answer-or-N/A completeness gate.
  // When leased (off-system), the lessee name + lease dates are required.
  const condKeys: (keyof HorseIntakePayload)[] = [
    ...(leased ? (['lessee_name_text', 'lease_start', 'lease_end'] as (keyof HorseIntakePayload)[]) : []),
  ];
  const hasRealName = filled(f.registered_name) || filled(f.nickname);
  const nameAnswered = answered(f.registered_name) && answered(f.nickname);
  // The owner (who owns this record) always makes the emergency euthanasia authorization.
  const euthanasiaAnswered = f.euthanasia_authorization === 'A' || f.euthanasia_authorization === 'B';
  // Vet/farrier phones are doc-merged tokens → required (covered by alwaysKeys);
  // only the lessee's email keeps the name-satisfies-the-pair relaxation.
  const secondariesOk = !leased || secondaryOk(f.lessee_name_text, f.lessee_email);
  // Staff must assign the record to an account before it can be created.
  const accountChosen = !isStaff || !!assignTo;
  // Home must be named. When NOT leased and "different location" is on, the alternate
  // must be named. When leased off-system, the lease location (= current) must be named
  // (a contract-driven lease supplies it, so no manual requirement there).
  const locationsOk = filled(homeLoc.name)
    && (leased || !currentDiffers || filled(currentLoc.name))
    && (!leased || leaseFromContract || filled(leaseLoc.name));
  const complete = hasRealName && nameAnswered && euthanasiaAnswered && secondariesOk && accountChosen && locationsOk
    && alwaysKeys.every((k) => answered(f[k] as string | undefined))
    && condKeys.every((k) => answered(f[k] as string | undefined));

  // The still-unanswered required fields, BY NAME. The message used to say only
  // that something was missing, which on a form this long is not findable.
  const CONDITIONAL_LABELS: Record<string, string> = {
    lessee_name_text: 'Lessee name', lease_start: 'Lease start', lease_end: 'Lease end',
  };
  const missingRequired = (): string[] => {
    const out: string[] = [];
    if (!hasRealName || !nameAnswered) out.push('Name (registered or barn)');
    for (const k of [...alwaysKeys, ...condKeys]) {
      if (!answered(f[k] as string | undefined)) {
        out.push(HORSE_DOC_REQUIRED_LABELS[k as string] ?? CONDITIONAL_LABELS[k as string] ?? String(k));
      }
    }
    if (!euthanasiaAnswered) out.push('Emergency euthanasia authorization');
    if (!filled(homeLoc.name)) out.push('Home location name');
    if (!leased && currentDiffers && !filled(currentLoc.name)) out.push('Current location name');
    if (leased && !leaseFromContract && !filled(leaseLoc.name)) out.push('Lease location name');
    if (leased && !secondariesOk) out.push('Lessee name or email');
    return out;
  };

  // BREED and COLOR are FOREIGN KEYS into the reference vocabularies, so a value
  // typed into "Other (enter manually)" cannot be stored — the INSERT fails with
  // horses_breed_fkey / horses_color_fkey and the member only ever saw "Could not
  // save the horse record." Caught here, at the field, with the list option named.
  const isKnownCode = (v: string | undefined, opts: { value: string }[]) =>
    !v || v === NA || opts.some((o) => o.value === v);
  const unlistedVocab = (): string | null => {
    if (breedOpts.length && !isKnownCode(f.breed, breedOpts)) return 'Breed';
    if (colorOpts.length && !isKnownCode(f.color, colorOpts)) return 'Color';
    return null;
  };

  /** Reject this submit: mark the fields, say why, and take them to the first one. */
  function reject(message: string) {
    setShowError(true);
    setErr(message);
    setErrorPulse((n) => n + 1);
  }

  async function submit() {
    setErr(null);
    if (isStaff && !assignTo) {
      reject('Choose the account this horse belongs to.');
      return;
    }
    if (!hasRealName) {
      reject('Give the horse at least a registered or barn name (N/A can’t apply to both).');
      return;
    }
    if (!euthanasiaAnswered) {
      reject('Please choose an emergency euthanasia authorization (Option A or B).');
      return;
    }
    if (!complete) {
      const missing = missingRequired();
      reject('Please answer every required field — fill it in or mark it N/A.'
        + (missing.length ? ` Still needed: ${missing.join(', ')}.` : ''));
      return;
    }
    const unlisted = unlistedVocab();
    if (unlisted) {
      reject(`${unlisted} has to be chosen from the list — a typed-in value can’t be saved. `
        + 'Pick the closest match, or "Other", and we’ll pass your entry to the barn.');
      return;
    }
    setBusy(true);
    try {
      // Persist home + the resolved CURRENT location once the record exists. Precedence:
      //   temporary current (a >48h stay during the lease)
      //   → lease location (when leased)
      //   → the general "different location" alternate (when NOT leased)
      //   → home (current === home when nothing else applies).
      const linkLocations = async (horseId: string) => {
        if (!filled(homeLoc.name)) return;
        const current =
          (leased && tempLocOpen && filled(tempLoc.name)) ? tempLoc :
          (leased && filled(leaseLoc.name)) ? leaseLoc :
          (!leased && currentDiffers) ? currentLoc :
          null;
        try { await setHorseLocations(horseId, homeLoc, current); }
        catch { /* record saved; locations best-effort */ }
      };
      // Persist the repeatable medications + supplements (blank blocks are dropped
      // server-side). Best-effort — the record is already saved.
      const linkMeds = async (horseId: string) => {
        const items = [...meds, ...supplements].filter((m) => filled(m.name));
        if (!items.length) return;
        try { await setHorseMedications(horseId, items); } catch { /* record saved */ }
      };
      // EDIT/REVIEW mode: the record exists — flush every changed column (the
      // same sparse patch autosave uses, but awaited and surfaced), then the
      // locations + medications, and hand the id back.
      const editingId = recordIdRef.current;
      if (editingId) {
        const patch: Record<string, string> = {};
        for (const k of PATCHABLE_KEYS) {
          const cur = (f[k] as string | undefined) ?? '';
          const prev = (lastSavedRef.current[k] as string | undefined) ?? '';
          if (cur !== prev) patch[k] = (TYPED_KEYS.has(k) && cur === NA) ? '' : cur;
        }
        if (Object.keys(patch).length) await updateHorseRecord(editingId, patch);
        lastSavedRef.current = { ...f };
        await linkLocations(editingId);
        await linkMeds(editingId);
        onDone(editingId);
        return;
      }
      // ONE path. Staff assigning to a client passes owner_contact_id; the backend
      // honors it only for staff. A client caller never sets it — the horse binds to them.
      const payload: HorseIntakePayload = isStaff && assignTo
        ? { ...f, owner_contact_id: assignTo }
        : f;
      const out: HorseRecordOutcome = await createHorseRecord(payload);
      if (out.outcome === 'match_pending_review') setPending(true);
      else {
        recordIdRef.current = out.horse_id;
        lastSavedRef.current = { ...f };
        await linkLocations(out.horse_id); await linkMeds(out.horse_id); onDone(out.horse_id);
      }
    } catch (e) {
      // The database's own message — see DbError in lib/horses.ts. Before that
      // this branch printed a generic sentence and threw the diagnosis away.
      setErr(errorText(e, 'Could not save the horse record.'));
      setErrorPulse((n) => n + 1);
    } finally {
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="text-center py-8 px-4">
        <ShieldQuestion size={32} className="text-gold-800 mx-auto mb-3" />
        <p className="font-serif text-green-800 text-lg mb-1.5">This horse may already be on file.</p>
        <p className="text-sm text-muted max-w-md mx-auto">
          We've opened a review with the barn. Upload your lease or ownership paperwork
          from your Documents and we'll link the record to your account once verified.
        </p>
      </div>
    );
  }

  if (loadingRecord) {
    return <p className="text-sm text-muted py-4">Loading the horse record…</p>;
  }

  return (
    // AUTOSAVE: focus leaving ANY field inside the form persists the changed
    // columns (blur bubbles as focusout). Diff-based — no-op when unchanged.
    <div ref={formRef} className="flex flex-col gap-1" onBlur={() => void autosave()}>
      {/* Account-type-first: STAFF must pick the account this record belongs to; a
          CLIENT's record binds to their own account automatically (no picker). */}
      {isStaff && (
        <div className="rounded-lg border border-gold-500/40 bg-gold-50 p-3 mb-2">
          <label className="block text-[11px] tracking-wide uppercase text-gold-900 font-semibold mb-1">
            Assign this horse to an account *
          </label>
          <select
            className={`${input} bg-white${showError && !assignTo ? ' border-red-400' : ''}`}
            value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Select the client account…</option>
            {accounts
              .filter((a) => a.contact_id)
              .map((a) => <option key={a.contact_id!} value={a.contact_id!}>{accountLabel(a)}{a.email ? ` — ${a.email}` : ''}</option>)}
          </select>
          <p className="text-[10px] text-gold-900/80 mt-1">The record will be owned by the selected client.</p>
        </div>
      )}

      <p className="text-xs text-muted mb-1">
        Fields marked <strong>*</strong> feed your horse’s legal documents and are
        required — fill them in or mark them <strong>N/A</strong>. Everything else is
        optional but welcome. Your progress saves as you go — you can leave and pick
        this up later.
      </p>

      <Section title="Location">
        <div className="sm:col-span-2 flex flex-col gap-3">
          <LocationEntry title="Home location" heading="Where the horse normally resides for boarding."
            v={homeLoc} onChange={setHomeLoc} showError={showError} required nameOptions={locationNameOpts} />
          {/* The general "different location" alternate applies ONLY when the horse is
              NOT leased. When leased, the lease location (below) IS the current location,
              so this is hidden — showing it too would be redundant or contradictory. */}
          {!leased && (
            <>
              <label className="flex items-center gap-2 text-[13px] text-green-900 cursor-pointer select-none">
                <input type="checkbox" checked={currentDiffers} onChange={(e) => setCurrentDiffers(e.target.checked)} />
                The horse is currently at a different location
              </label>
              {currentDiffers && (
                <LocationEntry title="Current location" heading="Where the horse actually is right now."
                  v={currentLoc} onChange={setCurrentLoc} showError={showError} required nameOptions={locationNameOpts} />
              )}
            </>
          )}
          {leased && (
            <p className="text-[11px] text-muted">
              This horse is leased — its current location is set under <strong>Lease</strong> below.
            </p>
          )}
        </div>
      </Section>

      {/* Lease — this record belongs to the horse's OWNER (the creating account or the
          staff-assigned client), so there's no "owner vs lessee" choice. A checkbox
          marks the horse as currently leased: it reveals the lessee + term + lease
          location for an OFF-SYSTEM lease. When an executed lease contract exists for
          the horse, this state is set from the contract (and reverts at term end). */}
      <Section title="Lease">
        <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-green-900 cursor-pointer select-none">
          <input type="checkbox" checked={leased} disabled={leaseFromContract}
            onChange={(e) => setF((p) => ({ ...p, is_leased: e.target.checked ? 'yes' : 'no' }))} />
          This horse is currently leased
          {leaseFromContract && <span className="text-[11px] text-muted">(from an executed lease contract)</span>}
        </label>
        {leased && (
          <div className="sm:col-span-2 flex flex-col gap-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <PersonBlock title="Lessee" showError={showError} span={false}
                name={{ label: 'Lessee name', value: f.lessee_name_text, onChange: set('lessee_name_text'), placeholder: 'Full name', required: true }}
                second={{ label: 'Lessee email', kind: 'email', value: f.lessee_email, onChange: set('lessee_email'), placeholder: 'name@example.com' }} />
              <div className="grid grid-cols-2 gap-2 self-start">
                <Field label="Lease start" type="date" value={f.lease_start} onChange={set('lease_start')} showError={showError} required />
                <Field label="Lease end" type="date" value={f.lease_end} onChange={set('lease_end')} showError={showError} required />
              </div>
            </div>
            {/* The lease location IS the horse's current location during the term. From
                the contract (read-only) when one exists; entered here for off-system leases. */}
            {leaseFromContract ? (
              <div className="rounded-lg border border-green-800/15 bg-cream-100/40 p-3">
                <p className="text-[11px] tracking-wide uppercase text-muted font-semibold mb-1">Lease location (current)</p>
                <p className="text-sm text-green-900">{leaseLoc.name || 'From the lease contract'}</p>
                <p className="text-[10px] text-muted mt-0.5">Set by the executed lease contract.</p>
              </div>
            ) : (
              <LocationEntry title="Lease location (current)" heading="Where the horse resides during the lease term — this is its current location."
                v={leaseLoc} onChange={setLeaseLoc} showError={showError} required nameOptions={locationNameOpts} />
            )}

            {/* Temporary current location: an explicit override for a >48h stay during
                the lease (show, vet, another boarding property). Pick from the horse's
                known locations (excluding the current lease location) or add a new one. */}
            {!tempLocOpen ? (
              <button type="button" onClick={() => setTempLocOpen(true)}
                className="self-start text-xs text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">
                ＋ Add temporary current location
              </button>
            ) : (
              <div className="rounded-lg border border-gold-400/50 p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] tracking-wide uppercase text-gold-800 font-semibold">Temporary current location</p>
                  <button type="button" onClick={() => { setTempLocOpen(false); setTempLoc({}); }} className="text-[11px] text-muted hover:text-red-700 underline">Remove</button>
                </div>
                <p className="text-[10px] text-muted">A stay of more than 48 hours away from the lease location (show, vet, another barn).</p>
                {knownLocationOpts.length > 0 && (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">Pick a known location, or enter one below</label>
                    <select className={input}
                      value={knownLocationOpts.some((o) => o.value === tempLoc.name) ? tempLoc.name : ''}
                      onChange={(e) => {
                        const picked = knownLocations.find((k) => k.name === e.target.value);
                        setTempLoc(picked ?? {});
                      }}>
                      <option value="">— choose or enter below —</option>
                      {knownLocationOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                <LocationEntry title="" heading="" v={tempLoc} onChange={setTempLoc} showError={false} nameOptions={locationNameOpts} />
              </div>
            )}
          </div>
        )}
      </Section>

      <Section title="Horse identity">
        <Field label="Nickname" value={f.nickname} onChange={set('nickname')} showError={showError} required placeholder="Everyday name (e.g. Beau)" />
        <Field label="Registered name" value={f.registered_name} onChange={set('registered_name')} showError={showError} required />
        <Field label="Registration number" value={f.registration_number} onChange={set('registration_number')} showError={showError} required />
        <SelectOrOther label="Registration organization" value={f.registration_org} onChange={set('registration_org')} showError={false} options={toOpts(regOrgOpts)} lookupKey="horse_registration_org" placeholder="Registry name" />
        <Field span label="Microchip number (checked first)" value={f.microchip_id} onChange={set('microchip_id')} placeholder="e.g. 985 112233445566" showError={showError} required />
        <Field label="Passport number" value={f.passport_number} onChange={set('passport_number')} showError={false} />
        <SelectOrOther label="Passport country" value={f.passport_country} onChange={set('passport_country')} showError={false} options={toOpts(passportCountryOpts)} lookupKey="horse_passport_country" placeholder="Country" />
        <Field label="Current fair market value" type="text" inputMode="numeric" value={f.fair_market_value}
          onChange={set('fair_market_value')} placeholder="$0.00" showError={showError} required
          onBlurFormat={(v) => {
            const n = Number(v.replace(/[$,\s]/g, ''));
            return Number.isFinite(n) && v.trim() !== '' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : v;
          }} />
      </Section>

      <Section title="Description">
        <SelectOrOther label="Breed" value={f.breed} onChange={set('breed')} showError={showError} required
          invalid={showError && !isKnownCode(f.breed, breedOpts)}
          options={breedOpts} lookupKey="horse_breeds" placeholder="Breed name"
          hint="Choose from the list — a typed-in breed can’t be stored on the record." />
        <SelectOrOther label="Color" value={f.color} onChange={set('color')} showError={showError} required
          invalid={showError && !isKnownCode(f.color, colorOpts)}
          options={colorOpts} lookupKey="horse_colors" placeholder="Color"
          hint="Choose from the list — a typed-in color can’t be stored on the record." />
        <SelectOrOther label="Markings" value={f.markings} onChange={set('markings')} showError={false} options={toOpts(markingOpts)} lookupKey="horse_markings" placeholder="Describe the markings" />
        <Field label="Sex" value={f.sex} onChange={set('sex')} showError={showError} required
          options={[
            { value: 'MARE', label: 'Mare' }, { value: 'GELDING', label: 'Gelding' },
            { value: 'STALLION', label: 'Stallion' }, { value: 'FILLY', label: 'Filly' },
            { value: 'COLT', label: 'Colt' },
          ]} />
        <Field label="Date of birth" type="date" value={f.date_of_birth} onChange={set('date_of_birth')} showError={showError} required />
        <Field label="Height" value={f.height} onChange={set('height')} placeholder="e.g. 16.2 hh" showError={showError} required />
      </Section>

      <Section title="History">
        <Field label="Training history" value={f.training_history} onChange={set('training_history')} showError={false} />
        <Field label="Competition history" value={f.competition_history} onChange={set('competition_history')} showError={false} />
      </Section>

      {/* Health & history — the three narrative fields grouped together (they were
          previously split by the medication fields). Each is distinct:
          medical history = past surgeries/treatments; behavior = temperament/handling
          concerns; conditions = current or recurring issues. */}
      <Section title="Health &amp; history">
        <Field span label="Medical history (past surgeries, injuries, treatments)" textarea
          value={f.medical_history} onChange={set('medical_history')} showError={false}
          placeholder="e.g. colic surgery 2022; suspensory injury, fully recovered" />
        <Field span label="Behavioral concerns (temperament, handling)" textarea
          value={f.behavioral_history} onChange={set('behavioral_history')} showError={false}
          placeholder="e.g. cross-ties well; spooky in wind" />
        <Field span label="Known conditions (current or recurring)" textarea required
          value={f.known_conditions} onChange={set('known_conditions')} showError={showError}
          placeholder="e.g. allergic to cedar bedding; prone to right-front bruising when jumping" />
      </Section>

      <Section title="Medications">
        <RepeatableMeds kind="MEDICATION" items={meds} onChange={setMeds} />
      </Section>

      <Section title="Supplements">
        <RepeatableMeds kind="SUPPLEMENT" items={supplements} onChange={setSupplements} />
      </Section>

      <Section title="Veterinary and Farrier">
        <VetBlock f={f} set={set} showError={showError} />
        <PersonBlock title="Current Farrier" showError={showError}
          name={{ label: 'Farrier name', value: f.farrier_name, onChange: set('farrier_name'), placeholder: 'Farrier name', required: true }}
          second={{ label: 'Phone', kind: 'tel', value: f.farrier_phone, onChange: set('farrier_phone'), placeholder: '(555) 555-5555', required: true }} />
      </Section>

      <div>
        <p className="text-[10px] tracking-widest uppercase text-gold-800 font-semibold mt-4 mb-2">Emergency euthanasia authorization (required)</p>
          <p className="text-xs text-muted mb-2">
            As the owner, choose one. This is included in your horse’s Emergency Vet Authorization.
          </p>
          <div className="flex flex-col gap-2">
            {([
              ['A', 'I AUTHORIZE the attending veterinarian to perform humane euthanasia if, in the vet’s professional judgment, it’s necessary to relieve the horse’s suffering and I can’t be reached in time.'],
              ['B', 'I DO NOT AUTHORIZE euthanasia without my express consent. Every reasonable effort must be made to reach me (or my emergency contact) before any such decision, except where required by law.'],
            ] as const).map(([opt, text]) => {
              const on = f.euthanasia_authorization === opt;
              return (
                <button key={opt} type="button"
                  onClick={() => setF((p) => ({ ...p, euthanasia_authorization: opt }))}
                  className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left focus-ring transition-colors ${
                    on ? 'border-green-700 bg-green-50' : `bg-white hover:border-green-800/30 ${showError && !euthanasiaAnswered ? 'border-red-400' : 'border-green-800/15'}`
                  }`}>
                  <span className={`mt-0.5 w-4 h-4 rounded-full border grid place-items-center shrink-0 ${on ? 'border-green-700' : 'border-green-800/30'}`}>
                    {on && <span className="w-2 h-2 rounded-full bg-green-700" />}
                  </span>
                  <span className="text-sm text-green-900"><strong>Option {opt}</strong> — {text}</span>
                </button>
              );
            })}
          </div>
      </div>

      {err && <p className="form-error text-sm text-red-700 mt-2">{err}</p>}
      {saveState !== 'idle' && (
        <p className={`text-[11px] mt-1 ${saveState === 'error' ? 'text-red-700' : 'text-muted'}`} aria-live="polite">
          {saveState === 'saving' ? 'Saving…'
            : saveState === 'saved' ? 'Progress saved.'
            : `${saveErr ?? 'Could not save your last change.'} It will retry when you leave the next field.`}
        </p>
      )}
      <button type="button" onClick={submit} disabled={busy}
        className="w-full mt-3 py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}
