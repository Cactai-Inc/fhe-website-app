import { useState } from 'react';
import { Loader2, ShieldQuestion } from 'lucide-react';
import {
  createHorseRecord, type HorseIntakePayload, type HorseRecordOutcome,
} from '../../lib/horses';

/**
 * HORSE RECORD INTAKE (spec H.2) — the standardized form, the matched pair to the
 * record: microchip FIRST (dedup runs server-side at submit), then identity,
 * description, ownership, lease, vet/farrier, health, history. Every field maps
 * to a record column; anything not needed for a signed document may stay blank.
 * Shared by: onboarding append (H.7), Account add-a-horse (H.3 path 2), staff
 * add-a-horse (H.3 path 4). Submits through create_horse_record — the ONE path.
 */

const input = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white';

function L({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] tracking-wide uppercase text-muted font-semibold mb-1">{children}</label>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-gold-800 font-semibold mt-4 mb-2 first:mt-0">{title}</p>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export function HorseIntakeForm({
  onDone, submitLabel = 'Add horse',
}: {
  /** Fires on created OR match_found (both attach an id); pending-review shows in-form. */
  onDone: (horseId: string) => void;
  submitLabel?: string;
}) {
  const [f, setF] = useState<HorseIntakePayload>({ my_relationship: 'OWNER', is_leased: 'no' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const set = (k: keyof HorseIntakePayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    setErr(null);
    if (!f.registered_name?.trim() && !f.barn_name?.trim()) {
      setErr('Give the horse at least a registered or barn name.');
      return;
    }
    setBusy(true);
    try {
      const out: HorseRecordOutcome = await createHorseRecord(f);
      if (out.outcome === 'match_pending_review') {
        setPending(true);
      } else {
        onDone(out.horse_id);
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
      <Section title="Horse identity">
        <div className="sm:col-span-2">
          <L>Microchip number (checked first — leave blank if none)</L>
          <input className={input} value={f.microchip_id ?? ''} onChange={set('microchip_id')} placeholder="e.g. 985 112233445566" />
        </div>
        <div><L>Registered name</L><input className={input} value={f.registered_name ?? ''} onChange={set('registered_name')} /></div>
        <div><L>Barn name</L><input className={input} value={f.barn_name ?? ''} onChange={set('barn_name')} /></div>
        <div><L>Breed</L><input className={input} value={f.breed ?? ''} onChange={set('breed')} /></div>
        <div><L>Registration number</L><input className={input} value={f.registration_number ?? ''} onChange={set('registration_number')} /></div>
        <div><L>Registration organization</L><input className={input} value={f.registration_org ?? ''} onChange={set('registration_org')} /></div>
        <div><L>Passport number</L><input className={input} value={f.passport_number ?? ''} onChange={set('passport_number')} /></div>
        <div><L>Passport country</L><input className={input} value={f.passport_country ?? ''} onChange={set('passport_country')} /></div>
      </Section>

      <Section title="Description">
        <div><L>Color</L><input className={input} value={f.color ?? ''} onChange={set('color')} /></div>
        <div><L>Markings</L><input className={input} value={f.markings ?? ''} onChange={set('markings')} /></div>
        <div>
          <L>Sex</L>
          <select className={input} value={f.sex ?? ''} onChange={set('sex')}>
            <option value="">Select…</option>
            <option value="mare">Mare</option>
            <option value="gelding">Gelding</option>
            <option value="stallion">Stallion</option>
          </select>
        </div>
        <div><L>Date of birth</L><input type="date" className={input} value={f.date_of_birth ?? ''} onChange={set('date_of_birth')} /></div>
        <div><L>Height</L><input className={input} value={f.height ?? ''} onChange={set('height')} placeholder='e.g. 16.2 hh' /></div>
        <div><L>Current fair market value</L><input className={input} value={f.fair_market_value ?? ''} onChange={set('fair_market_value')} placeholder="$" /></div>
        <div className="sm:col-span-2"><L>Current location</L><input className={input} value={f.current_location ?? ''} onChange={set('current_location')} placeholder="Carmel Creek Ranch" /></div>
      </Section>

      <Section title="Ownership">
        <div>
          <L>Your relationship to this horse</L>
          <select className={input} value={f.my_relationship}
            onChange={(e) => setF((p) => ({ ...p, my_relationship: e.target.value as 'OWNER' | 'LESSEE' }))}>
            <option value="OWNER">I own this horse</option>
            <option value="LESSEE">I lease this horse</option>
          </select>
        </div>
        {f.my_relationship === 'LESSEE' && (
          <>
            <div><L>Owner name</L><input className={input} value={f.owner_name_text ?? ''} onChange={set('owner_name_text')} /></div>
            <div><L>Owner email</L><input type="email" className={input} value={f.owner_email ?? ''} onChange={set('owner_email')} /></div>
          </>
        )}
      </Section>

      <Section title="Lease (if applicable)">
        <div>
          <L>Horse is leased</L>
          <select className={input} value={f.is_leased}
            onChange={(e) => setF((p) => ({ ...p, is_leased: e.target.value as 'yes' | 'no' }))}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>
        {f.is_leased === 'yes' && (
          <>
            {f.my_relationship === 'OWNER' && (
              <>
                <div><L>Lessee name</L><input className={input} value={f.lessee_name_text ?? ''} onChange={set('lessee_name_text')} /></div>
                <div><L>Lessee email</L><input type="email" className={input} value={f.lessee_email ?? ''} onChange={set('lessee_email')} /></div>
              </>
            )}
            <div><L>Lease start</L><input type="date" className={input} value={f.lease_start ?? ''} onChange={set('lease_start')} /></div>
            <div><L>Lease end</L><input type="date" className={input} value={f.lease_end ?? ''} onChange={set('lease_end')} /></div>
            <div>
              <L>Subleasing allowed</L>
              <select className={input} value={f.sublease_allowed ?? 'no'}
                onChange={(e) => setF((p) => ({ ...p, sublease_allowed: e.target.value as 'yes' | 'no' }))}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </>
        )}
      </Section>

      <Section title="Veterinary and farrier">
        <div><L>Preferred veterinarian</L><input className={input} value={f.vet_name ?? ''} onChange={set('vet_name')} /></div>
        <div><L>Veterinarian phone</L><input className={input} value={f.vet_phone ?? ''} onChange={set('vet_phone')} /></div>
        <div><L>Preferred farrier</L><input className={input} value={f.farrier_name ?? ''} onChange={set('farrier_name')} /></div>
        <div><L>Farrier phone</L><input className={input} value={f.farrier_phone ?? ''} onChange={set('farrier_phone')} /></div>
      </Section>

      <Section title="Health and care">
        <div className="sm:col-span-2"><L>Known medical history</L><textarea rows={2} className={`${input} resize-y max-h-40`} value={f.medical_history ?? ''} onChange={set('medical_history')} /></div>
        <div className="sm:col-span-2"><L>Known behavioral concerns</L><textarea rows={2} className={`${input} resize-y max-h-40`} value={f.behavioral_history ?? ''} onChange={set('behavioral_history')} /></div>
        <div><L>Current medications / supplements</L><input className={input} value={f.medication_current ?? ''} onChange={set('medication_current')} /></div>
        <div><L>Known conditions</L><input className={input} value={f.known_conditions ?? ''} onChange={set('known_conditions')} /></div>
      </Section>

      <Section title="History (optional)">
        <div><L>Training history</L><input className={input} value={f.training_history ?? ''} onChange={set('training_history')} /></div>
        <div><L>Competition history</L><input className={input} value={f.competition_history ?? ''} onChange={set('competition_history')} /></div>
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
