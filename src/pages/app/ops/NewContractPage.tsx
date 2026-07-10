import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import { startLeaseContract, startPurchaseContract } from '../../../lib/api';
import { staffHorseRecords, staffContactOptions, type StaffHorseRecord, type ContactOption } from '../../../lib/horses';
import { findOrCreateContactByEmail } from '../../../lib/ops/api-intake';
import { HorseIntakeForm } from '../../../components/app/HorseIntakeForm';

/**
 * NEW CONTRACT (/app/ops/contracts/new) — admin/staff contract initiation.
 *   1. Type — lease or purchase & sale (each provisions from its template).
 *   2. Client party (lessee/buyer) — pick a client, or enter a non-account
 *      party (name + email creates the CRM contact; they're invited to the
 *      contract from its page).
 *   3. Other party (lessor/seller) — same choice, or leave open and invite later.
 *   4. Horse — pick from records (the engine autofills HORSE.* from the record)
 *      or run the horse intake form, which CREATES the record first (the one
 *      creation path, microchip-dedup enforced server-side).
 * On create → the contract page, where fields, invites, and signing live.
 */

type ContractType = 'lease' | 'purchase';
type PartyMode = 'pick' | 'create';

const TYPES: { id: ContractType; label: string; hint: string }[] = [
  { id: 'lease', label: 'Horse lease', hint: 'Lease agreement — lessee & lessor' },
  { id: 'purchase', label: 'Purchase & sale', hint: 'Purchase agreement — buyer & seller' },
];

function PartyPicker({
  label, hint, contacts, mode, setMode, contactId, setContactId,
  name, setName, email, setEmail, required,
}: {
  label: string; hint: string; contacts: ContactOption[];
  mode: PartyMode; setMode: (m: PartyMode) => void;
  contactId: string; setContactId: (v: string) => void;
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  required?: boolean;
}) {
  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
      <h2 className="font-serif text-green-800 text-base">{label}{required ? '' : ' (optional now)'}</h2>
      <p className="text-[12px] text-muted mb-3">{hint}</p>
      <div className="flex gap-1.5 mb-3">
        {([['pick', 'Existing client / contact'], ['create', 'New person']] as [PartyMode, string][]).map(([m, l]) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-sans focus-ring ${
              mode === m ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}>
            {l}
          </button>
        ))}
      </div>
      {mode === 'pick' ? (
        <select className="form-input" value={contactId} onChange={(e) => setContactId(e.target.value)} aria-label={label}>
          <option value="">{required ? 'Choose…' : 'Leave open — invite later from the contract'}</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>{c.name || c.email || c.id}{c.email && c.name ? ` — ${c.email}` : ''}</option>
          ))}
        </select>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <input className="form-input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="email" className="form-input" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="text-[11px] text-muted sm:col-span-2">
            Creates their contact record now; send the contract invitation from the contract page.
          </p>
        </div>
      )}
    </section>
  );
}

export default function NewContractPage() {
  useDocumentTitle('New contract');
  const navigate = useNavigate();
  const [type, setType] = useState<ContractType>('lease');
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [horses, setHorses] = useState<StaffHorseRecord[]>([]);

  // client party (lessee / buyer)
  const [cMode, setCMode] = useState<PartyMode>('pick');
  const [cId, setCId] = useState('');
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  // other party (lessor / seller)
  const [oMode, setOMode] = useState<PartyMode>('pick');
  const [oId, setOId] = useState('');
  const [oName, setOName] = useState('');
  const [oEmail, setOEmail] = useState('');
  // horse
  const [horseMode, setHorseMode] = useState<'pick' | 'intake' | 'none'>('pick');
  const [horseId, setHorseId] = useState('');
  // purchase terms
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    staffContactOptions().then(setContacts).catch(() => setContacts([]));
    staffHorseRecords().then(setHorses).catch(() => setHorses([]));
  }, []);

  const clientReady = cMode === 'pick' ? !!cId : (!!cName.trim() && !!cEmail.trim());

  async function create() {
    setErr(null);
    if (!clientReady) { setErr(`Choose or enter the ${type === 'lease' ? 'lessee' : 'buyer'} first.`); return; }
    setBusy(true);
    try {
      // resolve/create the parties' CRM contacts
      const clientContactId = cMode === 'pick'
        ? cId
        : await findOrCreateContactByEmail(cName.trim(), cEmail.trim());
      let otherContactId: string | undefined;
      if (oMode === 'pick' && oId) otherContactId = oId;
      if (oMode === 'create' && oName.trim() && oEmail.trim()) {
        otherContactId = await findOrCreateContactByEmail(oName.trim(), oEmail.trim());
      }
      const chosenHorse = horseMode === 'pick' && horseId ? horseId : undefined;

      const result = type === 'lease'
        ? await startLeaseContract(clientContactId, otherContactId, chosenHorse)
        : await startPurchaseContract(
            clientContactId, otherContactId, chosenHorse,
            amount ? Number(amount.replace(/[$,]/g, '')) : undefined,
            deposit ? Number(deposit.replace(/[$,]/g, '')) : undefined,
          );
      navigate(`/app/contracts/${result.document_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the contract.');
    } finally {
      setBusy(false);
    }
  }

  const clientLabel = type === 'lease' ? 'Lessee' : 'Buyer';
  const otherLabel = type === 'lease' ? 'Lessor' : 'Seller';

  return (
    <div className="max-w-2xl">
      <Link to="/app/ops/documents"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Documents
      </Link>
      <h1 className="font-serif text-2xl text-green-900 mb-1">New contract</h1>
      <p className="text-sm text-green-800/70 mb-5">
        Provisions the agreement from its template with the parties and horse filled in.
      </p>

      {/* contract type — buttons desktop, dropdown mobile */}
      <div className="hidden sm:flex gap-1.5 mb-2">
        {TYPES.map((t) => (
          <button key={t.id} type="button" onClick={() => setType(t.id)}
            className={`px-4 py-2 rounded-full text-sm font-sans focus-ring ${
              type === t.id ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      <select className="form-input sm:hidden mb-2" value={type} aria-label="Contract type"
        onChange={(e) => setType(e.target.value as ContractType)}>
        {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
      </select>
      <p className="text-xs text-muted mb-6">{TYPES.find((t) => t.id === type)?.hint}</p>

      <PartyPicker label={clientLabel} required
        hint={`The ${clientLabel.toLowerCase()} — usually your client.`}
        contacts={contacts} mode={cMode} setMode={setCMode}
        contactId={cId} setContactId={setCId}
        name={cName} setName={setCName} email={cEmail} setEmail={setCEmail} />

      <PartyPicker label={otherLabel}
        hint={`The ${otherLabel.toLowerCase()}. Leave open to invite them from the contract page.`}
        contacts={contacts} mode={oMode} setMode={setOMode}
        contactId={oId} setContactId={setOId}
        name={oName} setName={setOName} email={oEmail} setEmail={setOEmail} />

      <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
        <h2 className="font-serif text-green-800 text-base">Horse</h2>
        <p className="text-[12px] text-muted mb-3">
          Pick from records to autofill the contract's horse section, or run the
          intake form — it creates the record first.
        </p>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {([['pick', 'From records'], ['intake', 'Horse intake form'], ['none', 'Decide later']] as ['pick' | 'intake' | 'none', string][]).map(([m, l]) => (
            <button key={m} type="button" onClick={() => setHorseMode(m)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-sans focus-ring ${
                horseMode === m ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
              }`}>
              {l}
            </button>
          ))}
        </div>
        {horseMode === 'pick' && (
          <select className="form-input" value={horseId} onChange={(e) => setHorseId(e.target.value)} aria-label="Horse">
            <option value="">{horses.length === 0 ? 'No horse records yet' : 'Choose a horse…'}</option>
            {horses.map((h) => (
              <option key={h.id} value={h.id}>
                {[h.barn_name || h.registered_name, h.breed, h.owner_name || h.owner_name_text].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        )}
        {horseMode === 'intake' && (
          <HorseIntakeForm submitLabel="Create record & use this horse"
            onDone={(id) => { setHorseId(id); setHorseMode('pick'); staffHorseRecords().then(setHorses).catch(() => {}); }} />
        )}
      </section>

      {type === 'purchase' && (
        <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
          <h2 className="font-serif text-green-800 text-base mb-3">Terms (optional)</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <span className="form-label">Purchase price</span>
              <input className="form-input" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="$" />
            </div>
            <div>
              <span className="form-label">Deposit</span>
              <input className="form-input" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="$" />
            </div>
          </div>
        </section>
      )}

      {err && <p role="alert" className="form-error mb-3">{err}</p>}
      <button type="button" onClick={() => void create()} disabled={busy || !clientReady}
        className="w-full py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        Create contract
      </button>
      <p className="text-[11px] text-muted mt-2">
        You'll land on the contract to fill fields, invite the {otherLabel.toLowerCase()}, and collect signatures.
      </p>
    </div>
  );
}
