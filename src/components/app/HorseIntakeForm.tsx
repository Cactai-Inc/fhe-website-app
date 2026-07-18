import { useEffect, useState } from 'react';
import { Loader2, ShieldQuestion } from 'lucide-react';
import {
  createHorseRecord, setHorseLocations, setHorseMedications,
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
 *  and the value becomes the sentinel "N/A" (a conscious answer, not a blank). */
function Field({
  label, value, onChange, type = 'text', placeholder, options, span, textarea, showError, inputMode, onBlurFormat,
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
        <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold">{label}</label>
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
  label, value, onChange, options, lookupKey, placeholder, span, showError, hint,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  lookupKey: string;
  placeholder?: string;
  span?: boolean;
  showError?: boolean;
  hint?: string;
}) {
  const na = value === NA;
  const isKnown = !!value && value !== NA && options.some((o) => o.value === value);
  const isOther = !na && !!value && value !== NA && !isKnown;
  const [otherOpen, setOtherOpen] = useState(isOther);
  const answered = na || filled(value);
  const cls = `${input}${showError && !answered ? ' border-red-400' : ''}`;

  const selectValue = na ? '' : otherOpen || isOther ? OTHER : (isKnown ? value : '');
  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold">{label}</label>
        <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
          <input type="checkbox" checked={na} onChange={(e) => { setOtherOpen(false); onChange(e.target.checked ? NA : ''); }} /> N/A
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
  name: { label: string; value?: string; onChange: (v: string) => void; placeholder?: string };
  second: { label: string; kind: 'tel' | 'email'; value?: string; onChange: (v: string) => void; placeholder?: string };
  showError?: boolean;
  span?: boolean;
}) {
  // N/A applies to the whole block: both parts become the sentinel together.
  const na = name.value === NA && second.value === NA;
  const answered = na || filled(name.value);
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
          <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{name.label}</label>
          <input className={cls(!answered)} disabled={na} value={na ? '' : (name.value ?? '')} placeholder={name.placeholder}
            onChange={(e) => name.onChange(e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{second.label}</label>
          <input type={second.kind} inputMode={second.kind} className={cls(false)} disabled={na}
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
        <div><L>Veterinarian name</L>
          <input className={cls(!answered)} disabled={na} value={val('vet_name')} placeholder="Dr. name" onChange={(e) => set('vet_name')(e.target.value)} /></div>
        <div><L>Business / practice name</L>
          <input className={cls(false)} disabled={na} value={val('vet_business_name')} placeholder="Practice name" onChange={(e) => set('vet_business_name')(e.target.value)} /></div>
        <div><L>Phone</L>
          <input type="tel" inputMode="tel" className={cls(false)} disabled={na} value={val('vet_phone')} placeholder="(555) 555-5555" onChange={(e) => set('vet_phone')(e.target.value)} /></div>
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
function PrefixInput({
  prefixes, value, onChange, placeholder,
}: {
  prefixes: string[];
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  // parse an existing "<prefix> <rest>" back into its two parts
  const parts = (value ?? '').trim().split(/\s+/);
  const curPrefix = parts.length && prefixes.includes(parts[0]) ? parts[0] : prefixes[0];
  const curRest = parts.length && prefixes.includes(parts[0]) ? parts.slice(1).join(' ') : (value ?? '');
  const compose = (p: string, rest: string) => (rest.trim() ? `${p} ${rest.trim()}` : '');
  return (
    <div className="flex gap-1.5">
      <select className={`${input} w-24 shrink-0`} value={curPrefix}
        onChange={(e) => onChange(compose(e.target.value, curRest))}>
        {prefixes.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      {/* flex-1 min-w-0 so the typed value takes the remaining space instead of the
          shared w-full class forcing it to overflow the cell */}
      <input className={`${input} flex-1 min-w-0`} value={curRest} placeholder={placeholder}
        onChange={(e) => onChange(compose(curPrefix, e.target.value))} />
    </div>
  );
}

/** LOCATION ENTRY — a fully findable location: name + structured address (on the
 *  shared place), plus THIS horse's barn/stall, findability notes, and on-site people
 *  (trainer / care giver / groom / other). A bare name like "Carmel Creek Ranch" isn't
 *  enough to find a horse; the address + barn/stall are what make it locatable. */
function LocationEntry({
  title, heading, v, onChange, showError, nameOptions,
}: {
  title: string;
  heading: string;
  v: HorseLocationDetail;
  onChange: (v: HorseLocationDetail) => void;
  showError?: boolean;
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
      <p className="text-[11px] tracking-wide uppercase text-gold-800 font-semibold mb-0.5">{title}</p>
      <p className="text-[10px] text-muted mb-2.5">{heading}</p>
      <div className="grid sm:grid-cols-2 gap-2">
        <div className="sm:col-span-2"><L>Location name</L>
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
        <div><L>Barn <span className="text-muted normal-case">(blank if outdoor)</span></L>
          <PrefixInput prefixes={['Barn', 'Stable']} value={v.barn} placeholder="e.g. A" onChange={(barn) => set({ barn })} /></div>
        <div><L>Stall</L>
          <PrefixInput prefixes={['Stall', 'Pen']} value={v.stall} placeholder="e.g. 16" onChange={(stall) => set({ stall })} /></div>
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

export function HorseIntakeForm({
  onDone, submitLabel = 'Add horse', ownerContactId,
}: {
  /** Fires on created OR match_found (both attach an id); pending-review shows in-form. */
  onDone: (horseId: string) => void;
  submitLabel?: string;
  /** Optional PRESET of the owning account (e.g. a staff page that already knows the
   *  client). Staff can still change it via the in-form account picker; ignored for
   *  non-staff callers (the record always binds to them). */
  ownerContactId?: string;
}) {
  const { isStaff } = useAuth();
  const [f, setF] = useState<HorseIntakePayload>({ is_leased: 'no' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showError, setShowError] = useState(false);
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
  // Lease: whether the leased state came from an executed contract (read-only), and
  // the optional lease-duration location.
  const [leaseLocationDiffers, setLeaseLocationDiffers] = useState(false);
  const [leaseLoc, setLeaseLoc] = useState<HorseLocationDetail>({});
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

  const toOpts = (rows: LookupCode[]) => rows.map((r) => ({ value: r.code, label: r.display_name }));
  const breedOpts = toOpts(breeds);
  const colorOpts = toOpts(colors);
  const accountLabel = (a: ClientAccountRow) =>
    a.display_name || [a.first_name, a.last_name].filter(Boolean).join(' ') || a.email || 'Account';
  const locationNameOpts = locations.map((l) => ({ value: l.name, label: l.name }));

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
  const alwaysKeys: (keyof HorseIntakePayload)[] = [
    'microchip_id', 'breed', 'registration_number', 'registration_org',
    'passport_number', 'passport_country', 'color', 'markings', 'sex',
    'date_of_birth', 'height', 'fair_market_value',
    'vet_name', 'farrier_name',
    'medical_history', 'behavioral_history',
    'known_conditions', 'training_history', 'competition_history',
  ];
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
  // person-block secondaries: vet/farrier phone, lessee email
  const secondariesOk = secondaryOk(f.vet_name, f.vet_phone)
    && secondaryOk(f.farrier_name, f.farrier_phone)
    && (!leased || secondaryOk(f.lessee_name_text, f.lessee_email));
  // Staff must assign the record to an account before it can be created.
  const accountChosen = !isStaff || !!assignTo;
  // Home location must be named; if current differs it too must be named.
  const locationsOk = filled(homeLoc.name) && (!currentDiffers || filled(currentLoc.name));
  const complete = hasRealName && nameAnswered && euthanasiaAnswered && secondariesOk && accountChosen && locationsOk
    && alwaysKeys.every((k) => answered(f[k] as string | undefined))
    && condKeys.every((k) => answered(f[k] as string | undefined));

  async function submit() {
    setErr(null);
    if (isStaff && !assignTo) {
      setShowError(true);
      setErr('Choose the account this horse belongs to.');
      return;
    }
    if (!hasRealName) {
      setShowError(true);
      setErr('Give the horse at least a registered or barn name (N/A can’t apply to both).');
      return;
    }
    if (!euthanasiaAnswered) {
      setShowError(true);
      setErr('Please choose an emergency euthanasia authorization (Option A or B).');
      return;
    }
    if (!complete) {
      setShowError(true);
      setErr('Please answer every field — fill it in or mark it N/A.');
      return;
    }
    setBusy(true);
    try {
      // Persist the rich home/current locations once the record exists. The horse's
      // CURRENT location is: the lease location when it's leased-and-moved, else the
      // "current differs" entry, else home.
      const linkLocations = async (horseId: string) => {
        if (!filled(homeLoc.name)) return;
        const current = (leased && leaseLocationDiffers && filled(leaseLoc.name)) ? leaseLoc
          : currentDiffers ? currentLoc : null;
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
      // ONE path. Staff assigning to a client passes owner_contact_id; the backend
      // honors it only for staff. A client caller never sets it — the horse binds to them.
      const payload: HorseIntakePayload = isStaff && assignTo
        ? { ...f, owner_contact_id: assignTo }
        : f;
      const out: HorseRecordOutcome = await createHorseRecord(payload);
      if (out.outcome === 'match_pending_review') setPending(true);
      else { await linkLocations(out.horse_id); await linkMeds(out.horse_id); onDone(out.horse_id); }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the horse record.');
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

  return (
    <div className="flex flex-col gap-1">
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
        Every field is required. If something doesn’t apply to your horse, mark it <strong>N/A</strong>.
      </p>

      <Section title="Location">
        <div className="sm:col-span-2 flex flex-col gap-3">
          <LocationEntry title="Home location" heading="Where the horse normally resides for boarding."
            v={homeLoc} onChange={setHomeLoc} showError={showError} nameOptions={locationNameOpts} />
          <label className="flex items-center gap-2 text-[13px] text-green-900 cursor-pointer select-none">
            <input type="checkbox" checked={currentDiffers} onChange={(e) => setCurrentDiffers(e.target.checked)} />
            The horse is currently at a different location
          </label>
          {currentDiffers && (
            <LocationEntry title="Current location" heading="Where the horse actually is right now."
              v={currentLoc} onChange={setCurrentLoc} showError={showError} nameOptions={locationNameOpts} />
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
                name={{ label: 'Lessee name', value: f.lessee_name_text, onChange: set('lessee_name_text'), placeholder: 'Full name' }}
                second={{ label: 'Lessee email', kind: 'email', value: f.lessee_email, onChange: set('lessee_email'), placeholder: 'name@example.com' }} />
              <div className="grid grid-cols-2 gap-2 self-start">
                <Field label="Lease start" type="date" value={f.lease_start} onChange={set('lease_start')} showError={showError} />
                <Field label="Lease end" type="date" value={f.lease_end} onChange={set('lease_end')} showError={showError} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-green-900 cursor-pointer select-none">
              <input type="checkbox" checked={leaseLocationDiffers} onChange={(e) => setLeaseLocationDiffers(e.target.checked)} />
              The horse moves to a different location for the lease
            </label>
            {leaseLocationDiffers && (
              <LocationEntry title="Lease location" heading="Where the horse resides during the lease term."
                v={leaseLoc} onChange={setLeaseLoc} showError={showError} nameOptions={locationNameOpts} />
            )}
          </div>
        )}
      </Section>

      <Section title="Horse identity">
        <Field label="Nickname" value={f.nickname} onChange={set('nickname')} showError={showError} placeholder="Everyday name (e.g. Beau)" />
        <Field label="Registered name" value={f.registered_name} onChange={set('registered_name')} showError={showError} />
        <Field label="Registration number" value={f.registration_number} onChange={set('registration_number')} showError={showError} />
        <SelectOrOther label="Registration organization" value={f.registration_org} onChange={set('registration_org')} showError={showError} options={toOpts(regOrgOpts)} lookupKey="horse_registration_org" placeholder="Registry name" />
        <Field span label="Microchip number (checked first)" value={f.microchip_id} onChange={set('microchip_id')} placeholder="e.g. 985 112233445566" showError={showError} />
        <Field label="Current fair market value" type="text" inputMode="numeric" value={f.fair_market_value}
          onChange={set('fair_market_value')} placeholder="$0.00" showError={showError}
          onBlurFormat={(v) => {
            const n = Number(v.replace(/[$,\s]/g, ''));
            return Number.isFinite(n) && v.trim() !== '' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : v;
          }} />
        <Field label="Passport number" value={f.passport_number} onChange={set('passport_number')} showError={showError} />
        <SelectOrOther label="Passport country" value={f.passport_country} onChange={set('passport_country')} showError={showError} options={toOpts(passportCountryOpts)} lookupKey="horse_passport_country" placeholder="Country" />
      </Section>

      <Section title="Description">
        <SelectOrOther label="Breed" value={f.breed} onChange={set('breed')} showError={showError} options={breedOpts} lookupKey="horse_breeds" placeholder="Breed name" />
        <SelectOrOther label="Color" value={f.color} onChange={set('color')} showError={showError} options={colorOpts} lookupKey="horse_colors" placeholder="Color" />
        <SelectOrOther label="Markings" value={f.markings} onChange={set('markings')} showError={showError} options={toOpts(markingOpts)} lookupKey="horse_markings" placeholder="Describe the markings" />
        <Field label="Sex" value={f.sex} onChange={set('sex')} showError={showError}
          options={[
            { value: 'MARE', label: 'Mare' }, { value: 'GELDING', label: 'Gelding' },
            { value: 'STALLION', label: 'Stallion' }, { value: 'FILLY', label: 'Filly' },
            { value: 'COLT', label: 'Colt' },
          ]} />
        <Field label="Date of birth" type="date" value={f.date_of_birth} onChange={set('date_of_birth')} showError={showError} />
        <Field label="Height" value={f.height} onChange={set('height')} placeholder="e.g. 16.2 hh" showError={showError} />
      </Section>

      <Section title="History">
        <Field label="Training history" value={f.training_history} onChange={set('training_history')} showError={showError} />
        <Field label="Competition history" value={f.competition_history} onChange={set('competition_history')} showError={showError} />
      </Section>

      {/* Health & history — the three narrative fields grouped together (they were
          previously split by the medication fields). Each is distinct:
          medical history = past surgeries/treatments; behavior = temperament/handling
          concerns; conditions = current or recurring issues. */}
      <Section title="Health &amp; history">
        <Field span label="Medical history (past surgeries, injuries, treatments)" textarea
          value={f.medical_history} onChange={set('medical_history')} showError={showError}
          placeholder="e.g. colic surgery 2022; suspensory injury, fully recovered" />
        <Field span label="Behavioral concerns (temperament, handling)" textarea
          value={f.behavioral_history} onChange={set('behavioral_history')} showError={showError}
          placeholder="e.g. cross-ties well; spooky in wind" />
        <Field span label="Known conditions (current or recurring)" textarea
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
          name={{ label: 'Farrier name', value: f.farrier_name, onChange: set('farrier_name'), placeholder: 'Farrier name' }}
          second={{ label: 'Phone', kind: 'tel', value: f.farrier_phone, onChange: set('farrier_phone'), placeholder: '(555) 555-5555' }} />
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
      <button type="button" onClick={submit} disabled={busy}
        className="w-full mt-3 py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}
