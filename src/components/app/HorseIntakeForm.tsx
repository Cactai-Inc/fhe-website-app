import { useEffect, useState } from 'react';
import { Loader2, ShieldQuestion } from 'lucide-react';
import {
  createHorseRecord, staffCreateHorseForContact, setHorseLocations,
  type HorseIntakePayload, type HorseRecordOutcome,
} from '../../lib/horses';
import {
  fetchLocations, addMyLocation, fetchContactLocations, addContactLocation,
  type CalendarLocation,
} from '../../lib/ops/api-calendar';

/**
 * HORSE RECORD INTAKE — the standardized form, the matched pair to the record and
 * the source of every {{HORSE.*}} on the vet-auth / care-release / lease docs.
 *
 * Owner rule: EVERY field must be answered — either filled in or explicitly
 * marked "N/A" (a horse genuinely may have no microchip, registration, meds…),
 * so a legal document never renders a silently-blank field. Each field carries an
 * N/A toggle; submit is blocked until all applicable fields are answered.
 *
 * Submits through create_horse_record (client) / staff_create_horse_for_contact.
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
  label, value, onChange, type = 'text', placeholder, options, span, textarea, showError,
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
        <input type={type} className={cls} disabled={na} value={na ? '' : (value ?? '')} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/** Location picker: barn + the member's own personal locations, with a "+ Add"
 *  path (a personal location, visible only to them). Stores the location NAME
 *  (current_location is text). Keeps the same N/A escape as Field. */
function LocationField({
  label, hint, value, onChange, locations, onAdded, showError, span, ownerContactId,
}: {
  label: string;
  hint?: string;
  value?: string;
  onChange: (v: string) => void;
  locations: CalendarLocation[];
  onAdded: () => void;
  showError?: boolean;
  span?: boolean;
  /** staff-on-behalf: the client the location belongs to */
  ownerContactId?: string;
}) {
  const na = value === NA;
  const answered = na || filled(value);
  const cls = `${input}${showError && !answered ? ' border-red-400' : ''}`;

  async function add() {
    const name = window.prompt('New location name');
    if (!name?.trim()) return;
    const addr = window.prompt('Address (optional)') ?? undefined;
    try {
      if (ownerContactId) await addContactLocation(ownerContactId, name.trim(), addr?.trim() || undefined);
      else await addMyLocation(name.trim(), addr?.trim() || undefined);
      onAdded();
      onChange(name.trim()); // select the newly added location
    } catch { /* leave selection as-is on failure */ }
  }

  return (
    <div className={span ? 'sm:col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold">{label}</label>
        <label className="flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
          <input type="checkbox" checked={na} onChange={(e) => onChange(e.target.checked ? NA : '')} /> N/A
        </label>
      </div>
      <select className={cls} disabled={na} value={na ? '' : (value ?? '')}
        onChange={(e) => { if (e.target.value === '__add') { void add(); } else onChange(e.target.value); }}>
        <option value="">Select…</option>
        {locations.map((l) => (
          <option key={l.id} value={l.name}>{l.name}{l.is_mine ? ' (mine)' : ''}</option>
        ))}
        <option value="__add">+ Add a location…</option>
      </select>
      {hint && <p className="text-[10px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

export function HorseIntakeForm({
  onDone, submitLabel = 'Add horse', ownerContactId,
}: {
  /** Fires on created OR match_found (both attach an id); pending-review shows in-form. */
  onDone: (horseId: string) => void;
  submitLabel?: string;
  /** Staff context: create the record OWNED BY this contact, not the caller. */
  ownerContactId?: string;
}) {
  const [f, setF] = useState<HorseIntakePayload>({ my_relationship: 'OWNER', is_leased: 'no' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showError, setShowError] = useState(false);
  const [locations, setLocations] = useState<CalendarLocation[]>([]);

  // Staff creating for a client → that CLIENT's locations; otherwise the caller's.
  const loadLocations = () =>
    (ownerContactId ? fetchContactLocations(ownerContactId) : fetchLocations())
      .then((locs) => { setLocations(locs); return locs; })
      .catch(() => { setLocations([]); return [] as CalendarLocation[]; });
  useEffect(() => {
    loadLocations().then((locs) => {
      // pre-select the barn default for both Home + Current when still empty
      const def = locs.find((l) => l.is_default);
      if (def) setF((p) => ({
        ...p,
        home_location: p.home_location || def.name,
        current_location: p.current_location || def.name,
      }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof HorseIntakePayload) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const leased = f.is_leased === 'yes';
  const lessee = f.my_relationship === 'LESSEE';

  // Every applicable field must be answered (filled or N/A). Names are special:
  // at least one of registered/barn must be a REAL name (not N/A).
  const answered = (v?: string) => v === NA || filled(v);
  const alwaysKeys: (keyof HorseIntakePayload)[] = [
    'microchip_id', 'breed', 'registration_number', 'registration_org',
    'passport_number', 'passport_country', 'color', 'markings', 'sex',
    'date_of_birth', 'height', 'fair_market_value', 'home_location', 'current_location',
    'vet_name', 'vet_phone', 'farrier_name', 'farrier_phone',
    'medical_history', 'behavioral_history',
    'medication_name', 'medication_dosage', 'medication_instructions', 'medication_additional',
    'known_conditions', 'training_history', 'competition_history',
  ];
  const condKeys: (keyof HorseIntakePayload)[] = [
    ...(lessee ? (['owner_name_text', 'owner_email'] as (keyof HorseIntakePayload)[]) : []),
    ...(leased && !lessee ? (['lessee_name_text', 'lessee_email'] as (keyof HorseIntakePayload)[]) : []),
    ...(leased ? (['lease_start', 'lease_end'] as (keyof HorseIntakePayload)[]) : []),
  ];
  const hasRealName = filled(f.registered_name) || filled(f.barn_name);
  const nameAnswered = answered(f.registered_name) && answered(f.barn_name);
  // The euthanasia authorization is the OWNER's to make; required when the person
  // filling the form owns the horse (a lessee leaves it for the owner).
  const owns = f.my_relationship === 'OWNER';
  const euthanasiaAnswered = !owns || f.euthanasia_authorization === 'A' || f.euthanasia_authorization === 'B';
  const complete = hasRealName && nameAnswered && euthanasiaAnswered
    && alwaysKeys.every((k) => answered(f[k] as string | undefined))
    && condKeys.every((k) => answered(f[k] as string | undefined));

  async function submit() {
    setErr(null);
    if (!hasRealName) {
      setShowError(true);
      setErr('Give the horse at least a registered or barn name (N/A can’t apply to both).');
      return;
    }
    if (owns && !euthanasiaAnswered) {
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
      // Resolve Home + Current to real location rows once the record exists.
      const linkLocations = async (horseId: string) => {
        const home = f.home_location && f.home_location !== NA ? f.home_location : null;
        const curr = f.current_location && f.current_location !== NA ? f.current_location : null;
        if (home || curr) { try { await setHorseLocations(horseId, home, curr); } catch { /* record saved; locations best-effort */ } }
      };
      if (ownerContactId) {
        const out = await staffCreateHorseForContact(ownerContactId, f as Record<string, string>);
        await linkLocations(out.horse_id);
        onDone(out.horse_id);
      } else {
        const out: HorseRecordOutcome = await createHorseRecord(f);
        if (out.outcome === 'match_pending_review') setPending(true);
        else { await linkLocations(out.horse_id); onDone(out.horse_id); }
      }
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
      <p className="text-xs text-muted mb-1">
        Every field is required. If something doesn’t apply to your horse, mark it <strong>N/A</strong>.
      </p>

      <Section title="Horse identity">
        <Field span label="Microchip number (checked first)" value={f.microchip_id} onChange={set('microchip_id')} placeholder="e.g. 985 112233445566" showError={showError} />
        <Field label="Registered name" value={f.registered_name} onChange={set('registered_name')} showError={showError} />
        <Field label="Barn name" value={f.barn_name} onChange={set('barn_name')} showError={showError} />
        <Field label="Breed" value={f.breed} onChange={set('breed')} showError={showError} />
        <Field label="Registration number" value={f.registration_number} onChange={set('registration_number')} showError={showError} />
        <Field label="Registration organization" value={f.registration_org} onChange={set('registration_org')} showError={showError} />
        <Field label="Passport number" value={f.passport_number} onChange={set('passport_number')} showError={showError} />
        <Field label="Passport country" value={f.passport_country} onChange={set('passport_country')} showError={showError} />
      </Section>

      <Section title="Description">
        <Field label="Color" value={f.color} onChange={set('color')} showError={showError} />
        <Field label="Markings" value={f.markings} onChange={set('markings')} showError={showError} />
        <Field label="Sex" value={f.sex} onChange={set('sex')} showError={showError}
          options={[
            { value: 'MARE', label: 'Mare' }, { value: 'GELDING', label: 'Gelding' },
            { value: 'STALLION', label: 'Stallion' }, { value: 'FILLY', label: 'Filly' },
            { value: 'COLT', label: 'Colt' },
          ]} />
        <Field label="Date of birth" type="date" value={f.date_of_birth} onChange={set('date_of_birth')} showError={showError} />
        <Field label="Height" value={f.height} onChange={set('height')} placeholder="e.g. 16.2 hh" showError={showError} />
        <Field label="Current fair market value" value={f.fair_market_value} onChange={set('fair_market_value')} placeholder="$" showError={showError} />
        <LocationField label="Home Location" hint="Where the horse normally resides for boarding."
          value={f.home_location} onChange={set('home_location')}
          locations={locations} onAdded={loadLocations} showError={showError} ownerContactId={ownerContactId} />
        <LocationField label="Current Location" hint="Where the horse actually is right now."
          value={f.current_location} onChange={set('current_location')}
          locations={locations} onAdded={loadLocations} showError={showError} ownerContactId={ownerContactId} />
      </Section>

      <Section title="Ownership">
        <div>
          <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold mb-1">Your relationship to this horse</label>
          <select className={input} value={f.my_relationship}
            onChange={(e) => setF((p) => ({ ...p, my_relationship: e.target.value as 'OWNER' | 'LESSEE' }))}>
            <option value="OWNER">I own this horse</option>
            <option value="LESSEE">I lease this horse</option>
          </select>
        </div>
        {lessee && (
          <>
            <Field label="Owner name" value={f.owner_name_text} onChange={set('owner_name_text')} showError={showError} />
            <Field label="Owner email" type="email" value={f.owner_email} onChange={set('owner_email')} showError={showError} />
          </>
        )}
      </Section>

      <Section title="Lease (if applicable)">
        <div>
          <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold mb-1">Horse is leased</label>
          <select className={input} value={f.is_leased}
            onChange={(e) => setF((p) => ({ ...p, is_leased: e.target.value as 'yes' | 'no' }))}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        {leased && (
          <>
            {f.my_relationship === 'OWNER' && (
              <>
                <Field label="Lessee name" value={f.lessee_name_text} onChange={set('lessee_name_text')} showError={showError} />
                <Field label="Lessee email" type="email" value={f.lessee_email} onChange={set('lessee_email')} showError={showError} />
              </>
            )}
            <Field label="Lease start" type="date" value={f.lease_start} onChange={set('lease_start')} showError={showError} />
            <Field label="Lease end" type="date" value={f.lease_end} onChange={set('lease_end')} showError={showError} />
          </>
        )}
      </Section>

      <Section title="Veterinary and farrier">
        <Field label="Preferred veterinarian" value={f.vet_name} onChange={set('vet_name')} showError={showError} />
        <Field label="Veterinarian phone" value={f.vet_phone} onChange={set('vet_phone')} showError={showError} />
        <Field label="Preferred farrier" value={f.farrier_name} onChange={set('farrier_name')} showError={showError} />
        <Field label="Farrier phone" value={f.farrier_phone} onChange={set('farrier_phone')} showError={showError} />
      </Section>

      <Section title="Health and care">
        <Field span label="Known medical history" textarea value={f.medical_history} onChange={set('medical_history')} showError={showError} />
        <Field span label="Known behavioral concerns" textarea value={f.behavioral_history} onChange={set('behavioral_history')} showError={showError} />
        <Field label="Current medication — name" value={f.medication_name} onChange={set('medication_name')} showError={showError} />
        <Field label="Medication — dosage" value={f.medication_dosage} onChange={set('medication_dosage')} showError={showError} />
        <Field label="Medication — instructions" value={f.medication_instructions} onChange={set('medication_instructions')} showError={showError} />
        <Field label="Medication — additional notes" value={f.medication_additional} onChange={set('medication_additional')} showError={showError} />
        <Field span label="Known conditions" value={f.known_conditions} onChange={set('known_conditions')} showError={showError} />
      </Section>

      {owns && (
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
      )}

      <Section title="History">
        <Field label="Training history" value={f.training_history} onChange={set('training_history')} showError={showError} />
        <Field label="Competition history" value={f.competition_history} onChange={set('competition_history')} showError={showError} />
      </Section>

      {err && <p className="form-error text-sm text-red-700 mt-2">{err}</p>}
      <button type="button" onClick={submit} disabled={busy}
        className="w-full mt-3 py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        {submitLabel}
      </button>
    </div>
  );
}
