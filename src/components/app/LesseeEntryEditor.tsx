import { useState } from 'react';
import { addLesseeEntry, matchAccountByEmail, type LesseeEntry } from '../../lib/horses';
import { toErrorMessage } from '../../lib/ops/errors';

const inputCls = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white';
const label = 'block text-[10px] uppercase tracking-wide text-muted mb-1';

const KINDS: { value: LesseeEntry['kind']; label: string; textKey: string; textLabel: string }[] = [
  { value: 'note', label: 'Note', textKey: 'text', textLabel: 'Note' },
  { value: 'medical_history', label: 'Medical history', textKey: 'summary', textLabel: 'Entry' },
  { value: 'behavioral', label: 'Behavioral concern', textKey: 'concern', textLabel: 'Concern' },
  { value: 'known_condition', label: 'Known condition', textKey: 'condition', textLabel: 'Condition' },
  { value: 'training', label: 'Training', textKey: 'entry', textLabel: 'Entry' },
  { value: 'competition', label: 'Competition', textKey: 'entry', textLabel: 'Entry' },
  { value: 'location_note', label: 'Location note', textKey: 'text', textLabel: 'Note' },
  { value: 'injury', label: 'Injury', textKey: 'description', textLabel: 'Description' },
  { value: 'provider', label: 'Provider', textKey: 'name', textLabel: 'Name' },
];

/**
 * ADD MY OWN ENTRY (the current lessee) — writes to the lessee's isolated layer on the
 * horse. Never touches the owner's record. A provider entry references a contact via
 * the same match/create-by-email flow the owner's add uses.
 */
export function LesseeEntryEditor({ horseId, onAdded, onClose }: { horseId: string; onAdded: () => void; onClose: () => void }) {
  const [kind, setKind] = useState<LesseeEntry['kind']>('note');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // provider fields
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pType, setPType] = useState('VET');
  const [matchState, setMatchState] = useState<'idle' | 'checking' | 'matched' | 'nomatch' | 'limited'>('idle');
  const [matchedName, setMatchedName] = useState('');
  // injury fields
  const [iDate, setIDate] = useState('');
  const [iPerson, setIPerson] = useState('');
  const [iOutcome, setIOutcome] = useState('');

  const meta = KINDS.find((k) => k.value === kind)!;

  async function checkEmail() {
    if (!pEmail.trim()) return;
    setMatchState('checking');
    try {
      const r = await matchAccountByEmail(pEmail.trim());
      if (r.rate_limited) setMatchState('limited');
      else if (r.matched) { setMatchState('matched'); setMatchedName(r.display_name ?? ''); }
      else setMatchState('nomatch');
    } catch { setMatchState('idle'); }
  }

  async function submit() {
    setBusy(true); setErr(null);
    try {
      let data: Record<string, unknown>;
      if (kind === 'provider') data = { provider_type: pType, name: pName.trim(), phone: pPhone.trim(), email: pEmail.trim() };
      else if (kind === 'injury') data = { date: iDate, person_type: iPerson, description: text.trim(), outcome: iOutcome.trim() };
      else data = { [meta.textKey]: text.trim() };
      await addLesseeEntry({ horse_id: horseId, kind, data });
      onAdded(); onClose();
    } catch (e) { setErr(toErrorMessage(e, 'Could not add your entry.')); setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-gold-400/50 p-3 flex flex-col gap-2.5 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] tracking-wide uppercase text-gold-800 font-semibold">Add my own entry</p>
        <button type="button" onClick={onClose} className="text-[11px] text-muted hover:text-red-700 underline">Cancel</button>
      </div>
      <p className="text-[11px] text-muted">This is your own record for the horse. It doesn’t change the owner’s record; they’ll see it marked as yours.</p>
      <div><span className={label}>Kind</span>
        <select className={inputCls} value={kind} onChange={(e) => { setKind(e.target.value as LesseeEntry['kind']); setMatchState('idle'); }}>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
      </div>

      {kind === 'provider' ? (
        <>
          <div><span className={label}>Provider type</span>
            <select className={inputCls} value={pType} onChange={(e) => setPType(e.target.value)}>
              {['VET','FARRIER','TRAINER','GROOM','CARE_GIVER','EMERGENCY_CONTACT','OTHER'].map((t) => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
            </select></div>
          <div><span className={label}>Account email (to link an existing person)</span>
            <div className="flex gap-2">
              <input type="email" className={inputCls} value={pEmail} onChange={(e) => { setPEmail(e.target.value); setMatchState('idle'); }} placeholder="name@example.com" />
              <button type="button" className="btn-outline-gold text-xs whitespace-nowrap" disabled={matchState === 'checking'} onClick={() => void checkEmail()}>Check</button>
            </div>
            {matchState === 'matched' && <p className="text-[11px] text-green-800 mt-1">Matched: {matchedName}</p>}
            {matchState === 'nomatch' && <p className="text-[11px] text-muted mt-1">No account matches — enter the name and phone below to create the contact.</p>}
            {matchState === 'limited' && <p className="text-[11px] text-red-700 mt-1">Too many lookups — try again shortly.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><span className={label}>Name</span><input className={inputCls} value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Name" /></div>
            <div><span className={label}>Phone</span><input type="tel" className={inputCls} value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="(555) 555-5555" /></div>
          </div>
        </>
      ) : kind === 'injury' ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div><span className={label}>Date</span><input type="date" className={inputCls} value={iDate} onChange={(e) => setIDate(e.target.value)} /></div>
            <div><span className={label}>Person</span>
              <select className={inputCls} value={iPerson} onChange={(e) => setIPerson(e.target.value)}>
                <option value="">Select…</option><option value="rider">Rider</option><option value="non-rider">Non-rider</option>
              </select></div>
          </div>
          <div><span className={label}>Description</span><textarea rows={2} className={`${inputCls} resize-y`} value={text} onChange={(e) => setText(e.target.value)} placeholder="What happened" /></div>
          <div><span className={label}>Outcome</span><input className={inputCls} value={iOutcome} onChange={(e) => setIOutcome(e.target.value)} placeholder="e.g. treated on site" /></div>
        </>
      ) : (
        <div><span className={label}>{meta.textLabel}</span><textarea rows={2} className={`${inputCls} resize-y`} value={text} onChange={(e) => setText(e.target.value)} /></div>
      )}

      {err && <p className="text-xs text-red-700">{err}</p>}
      <button type="button" onClick={() => void submit()} disabled={busy} className="self-start btn-primary text-sm">{busy ? 'Adding…' : 'Add entry'}</button>
    </div>
  );
}
