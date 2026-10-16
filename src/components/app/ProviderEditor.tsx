import { useEffect, useState } from 'react';
import {
  addHorseProvider, addHorseEmergencyContact, matchAccountByEmail,
  peopleWithDesignation, type HorseProvider, type Designation,
} from '../../lib/horses';
import { toErrorMessage } from '../../lib/ops/errors';

const inputCls = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white';
const label = 'block text-[10px] uppercase tracking-wide text-muted mb-1';

type ProviderType = HorseProvider['type'];
const TYPES: { value: ProviderType; label: string }[] = [
  { value: 'VET', label: 'Veterinarian' }, { value: 'FARRIER', label: 'Farrier' },
  { value: 'TRAINER', label: 'Trainer' }, { value: 'GROOM', label: 'Groom' },
  { value: 'CARE_GIVER', label: 'Care giver' }, { value: 'EMERGENCY_CONTACT', label: 'Emergency contact' },
  { value: 'OTHER', label: 'Other' },
];
/** Types whose person is chosen from a designation-filtered picker (staff). */
const DESIGNATION_FOR: Partial<Record<ProviderType, Designation>> = {
  TRAINER: 'trainer', GROOM: 'groom', CARE_GIVER: 'care_giver',
};

/**
 * ADD A CARE PROVIDER (staff) — the one place a vet, farrier, trainer, groom, care
 * giver, emergency contact or "other" is added to a horse. Trainer/groom/care giver
 * pick from people carrying the matching designation (plus manual entry). Emergency
 * contacts use the account-match flow: ask whether the person has an account, and if
 * so match by the email they use — never a directory search.
 */
export function ProviderEditor({ horseId, onAdded, onClose }: { horseId: string; onAdded: () => void; onClose: () => void }) {
  const [type, setType] = useState<ProviderType>('VET');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // common fields
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [roleLabel, setRoleLabel] = useState('');

  // designation picker
  const [people, setPeople] = useState<{ contact_id: string; display_name: string }[]>([]);
  const [pickedContact, setPickedContact] = useState('');
  const [manual, setManual] = useState(false);

  // emergency-contact account-match flow
  const [hasAccount, setHasAccount] = useState<'' | 'yes' | 'no' | 'unsure'>('');
  const [matchState, setMatchState] = useState<'idle' | 'checking' | 'matched' | 'nomatch' | 'limited'>('idle');
  const [matchedName, setMatchedName] = useState('');

  const desig = DESIGNATION_FOR[type];
  useEffect(() => {
    setPickedContact(''); setManual(false); setPeople([]);
    if (desig) peopleWithDesignation(desig).then(setPeople).catch(() => setPeople([]));
  }, [type, desig]);

  async function checkEmail() {
    if (!email.trim()) return;
    setMatchState('checking'); setErr(null);
    try {
      const r = await matchAccountByEmail(email.trim());
      if (r.rate_limited) { setMatchState('limited'); return; }
      if (r.matched) { setMatchState('matched'); setMatchedName(r.display_name ?? ''); }
      else { setMatchState('nomatch'); }
    } catch (e) { setErr(toErrorMessage(e, 'Could not check that email.')); setMatchState('idle'); }
  }

  async function submit() {
    setBusy(true); setErr(null);
    try {
      if (type === 'EMERGENCY_CONTACT') {
        // Yes + matched → link by email server-side. Otherwise create from name + phone.
        if (hasAccount === 'yes' && matchState === 'matched') {
          await addHorseEmergencyContact({ horse_id: horseId, email: email.trim() });
        } else {
          if (!name.trim()) { setErr('Enter the person’s name.'); setBusy(false); return; }
          await addHorseEmergencyContact({ horse_id: horseId, name: name.trim(), phone: phone.trim() || undefined });
        }
      } else {
        const id = await addHorseProvider({
          horse_id: horseId, relationship: type,
          provider_role: role || undefined,
          role_label: type === 'OTHER' ? (roleLabel.trim() || undefined) : undefined,
          party_contact_id: (desig && !manual && pickedContact) ? pickedContact : undefined,
          party_name_text: (desig && !manual && pickedContact)
            ? (people.find((p) => p.contact_id === pickedContact)?.display_name)
            : (name.trim() || undefined),
          business_name: type === 'VET' ? (business.trim() || undefined) : undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        });
        void id;
      }
      onAdded(); onClose();
    } catch (e) { setErr(toErrorMessage(e, 'Could not add the provider.')); setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-gold-400/50 p-3 flex flex-col gap-2.5 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] tracking-wide uppercase text-gold-800 font-semibold">Add a provider</p>
        <button type="button" onClick={onClose} className="text-[11px] text-muted hover:text-red-700 underline">Cancel</button>
      </div>

      <div><span className={label}>Type</span>
        <select className={inputCls} value={type} onChange={(e) => { setType(e.target.value as ProviderType); setErr(null); setMatchState('idle'); setHasAccount(''); }}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {type === 'OTHER' && (
        <div><span className={label}>Role label</span>
          <input className={inputCls} value={roleLabel} onChange={(e) => setRoleLabel(e.target.value)} placeholder="e.g. ranch hand, transport handler" /></div>
      )}

      {/* VET / FARRIER / OTHER: free-text details */}
      {(type === 'VET' || type === 'FARRIER' || type === 'OTHER') && (
        <>
          <div><span className={label}>Name</span><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Person’s name" /></div>
          {type === 'VET' && <div><span className={label}>Practice / business</span><input className={inputCls} value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="Practice name" /></div>}
          <div className="grid grid-cols-2 gap-2">
            <div><span className={label}>Phone</span><input type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" /></div>
            <div><span className={label}>Email</span><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
          </div>
          <div><span className={label}>Role</span>
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">(none)</option><option value="primary">Primary</option><option value="alternate">Alternate</option><option value="specialist">Specialist</option><option value="current">Current</option>
            </select></div>
        </>
      )}

      {/* TRAINER / GROOM / CARE GIVER: designation-filtered picker + manual entry */}
      {desig && (
        <>
          <div><span className={label}>Person</span>
            <select className={inputCls} value={manual ? '__manual__' : pickedContact}
              onChange={(e) => { if (e.target.value === '__manual__') { setManual(true); setPickedContact(''); } else { setManual(false); setPickedContact(e.target.value); } }}>
              <option value="">Select a person…</option>
              <option value="__manual__">Enter manually…</option>
              {people.map((p) => <option key={p.contact_id} value={p.contact_id}>{p.display_name}</option>)}
            </select>
            {people.length === 0 && !manual && <p className="text-[10px] text-muted mt-1">No one carries this designation yet — set it on the Team page, or enter manually.</p>}
          </div>
          {manual && (<div><span className={label}>Name</span><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Person’s name" /></div>)}
          <div className="grid grid-cols-2 gap-2">
            <div><span className={label}>Phone</span><input type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" /></div>
            <div><span className={label}>Email</span><input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
          </div>
        </>
      )}

      {/* EMERGENCY CONTACT: Yes / No / Unsure account match */}
      {type === 'EMERGENCY_CONTACT' && (
        <>
          <div><span className={label}>Does this person have an account with us?</span>
            <div className="flex gap-2">
              {(['yes', 'no', 'unsure'] as const).map((o) => (
                <button key={o} type="button" onClick={() => { setHasAccount(o); setMatchState('idle'); }}
                  className={`flex-1 py-2 rounded-lg border text-sm capitalize ${hasAccount === o ? 'bg-green-50 border-green-300 text-green-800 font-medium' : 'border-green-800/15 text-secondary hover:bg-green-50'}`}>{o}</button>
              ))}
            </div>
          </div>
          {hasAccount === 'yes' && (
            <div>
              <span className={label}>The email this person uses for their account with us</span>
              <div className="flex gap-2">
                <input type="email" className={inputCls} value={email} onChange={(e) => { setEmail(e.target.value); setMatchState('idle'); }} placeholder="name@example.com" />
                <button type="button" className="btn-outline-gold text-xs whitespace-nowrap" disabled={matchState === 'checking'} onClick={() => void checkEmail()}>Check</button>
              </div>
              {matchState === 'matched' && <p className="text-[11px] text-green-800 mt-1">Matched: {matchedName}</p>}
              {matchState === 'nomatch' && <p className="text-[11px] text-muted mt-1">No account matches that email — enter the person’s name and phone below instead.</p>}
              {matchState === 'limited' && <p className="text-[11px] text-red-700 mt-1">Too many lookups just now — try again in a few minutes.</p>}
            </div>
          )}
          {(hasAccount === 'no' || hasAccount === 'unsure' || matchState === 'nomatch') && (
            <div className="grid grid-cols-2 gap-2">
              <div><span className={label}>Name</span><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
              <div><span className={label}>Phone</span><input type="tel" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" /></div>
            </div>
          )}
        </>
      )}

      {err && <p className="text-xs text-red-700">{err}</p>}
      <button type="button" onClick={() => void submit()} disabled={busy}
        className="self-start btn-primary text-sm">{busy ? 'Adding…' : 'Add provider'}</button>
    </div>
  );
}

