import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import { startLeaseContract, startPurchaseContract } from '../../../lib/api';
import {
  claimDocumentOrigination, setPartyControls, assignHorseSection,
} from '../../../lib/contracts';
import { staffHorseRecords, staffContactOptions, type StaffHorseRecord, type ContactOption } from '../../../lib/horses';

/**
 * NEW CONTRACT (/app/ops/contracts/new) — company-originated, always.
 *   1. Type — lease or purchase & sale.
 *   2. BOTH parties are SELECTED from existing accounts/contacts — never
 *      created here. Add the person first (New client), then come back.
 *   3. Horse — from records (autofills HORSE.*) or ASSIGNED to one of the
 *      parties to fill in. Never "decide later".
 *   4. Document controls PER PARTY, set now: add their own information, edit
 *      deal terms, suggest changes. Acting on behalf of a party = fill their
 *      fields yourself and switch their controls off; the invitation language
 *      derives from these choices.
 * Creates the instance and opens it for filling; the document itself is
 * generated at lock — this step never emails anyone.
 */

type ContractType = 'lease' | 'purchase';

const TYPES: { id: ContractType; label: string; hint: string; roles: [string, string] }[] = [
  { id: 'lease', label: 'Horse lease', hint: 'Lease agreement — lessee & lessor', roles: ['LESSEE', 'LESSOR'] },
  { id: 'purchase', label: 'Purchase & sale', hint: 'Purchase agreement — buyer & seller', roles: ['BUYER', 'SELLER'] },
];

interface Controls { can_fill: boolean; can_edit_deal: boolean; can_suggest: boolean }
const DEFAULT_CONTROLS: Controls = { can_fill: true, can_edit_deal: false, can_suggest: false };

function roleLabel(r: string): string {
  return r.charAt(0) + r.slice(1).toLowerCase();
}

function ControlsCard({
  role, value, onChange,
}: { role: string; value: Controls; onChange: (v: Controls) => void }) {
  const rows: { key: keyof Controls; label: string; hint: string }[] = [
    { key: 'can_fill', label: 'Can add their information', hint: 'They complete the fields their side owns. Off = you fill everything acting on their behalf.' },
    { key: 'can_edit_deal', label: 'Can edit deal terms', hint: 'Direct changes to the negotiated terms. Usually off — the terms are the deal.' },
    { key: 'can_suggest', label: 'Can suggest changes', hint: 'They may propose changes for you to accept or reject. Off = take-it-or-leave-it.' },
  ];
  return (
    <div className="border border-green-800/10 rounded-lg p-3.5">
      <p className="text-sm font-medium text-green-900 mb-2">{roleLabel(role)}</p>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <label key={r.key} className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[13px] text-green-900">{r.label}</span>
              <span className="block text-[11px] text-muted">{r.hint}</span>
            </span>
            <input type="checkbox" className="accent-green-700 w-4 h-4 mt-0.5 shrink-0"
              checked={value[r.key]}
              onChange={(e) => onChange({ ...value, [r.key]: e.target.checked })} />
          </label>
        ))}
      </div>
    </div>
  );
}

export default function NewContractPage() {
  useDocumentTitle('New contract');
  const navigate = useNavigate();
  const [type, setType] = useState<ContractType>('lease');
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [horses, setHorses] = useState<StaffHorseRecord[]>([]);

  const [partyA, setPartyA] = useState('');   // lessee / buyer contact id
  const [partyB, setPartyB] = useState('');   // lessor / seller contact id
  const [horseMode, setHorseMode] = useState<'pick' | 'party'>('pick');
  const [horseId, setHorseId] = useState('');
  const [horseParty, setHorseParty] = useState<string>('');  // which party fills HORSE.*
  const [controlsA, setControlsA] = useState<Controls>(DEFAULT_CONTROLS);
  const [controlsB, setControlsB] = useState<Controls>(DEFAULT_CONTROLS);
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const t = TYPES.find((x) => x.id === type)!;
  const [roleA, roleB] = t.roles;

  useEffect(() => {
    staffContactOptions().then(setContacts).catch(() => setContacts([]));
    staffHorseRecords().then(setHorses).catch(() => setHorses([]));
  }, []);
  useEffect(() => { setHorseParty(roleB); }, [roleB]);

  const ready = !!partyA && !!partyB && (horseMode === 'pick' ? !!horseId : !!horseParty);

  async function create() {
    setErr(null);
    if (!ready) { setErr('Select both parties and the horse source first.'); return; }
    setBusy(true);
    try {
      const chosenHorse = horseMode === 'pick' ? horseId : undefined;
      const result = type === 'lease'
        ? await startLeaseContract(partyA, partyB, chosenHorse)
        : await startPurchaseContract(
            partyA, partyB, chosenHorse,
            amount ? Number(amount.replace(/[$,]/g, '')) : undefined,
            deposit ? Number(deposit.replace(/[$,]/g, '')) : undefined,
          );
      const docId = result.document_id;
      // The company originates — never a party by assumption.
      await claimDocumentOrigination(docId);
      // Per-party document controls, set at this stage.
      await setPartyControls(docId, roleA, controlsA);
      await setPartyControls(docId, roleB, controlsB);
      // Horse section: assigned to a party when not autofilled from a record.
      if (horseMode === 'party' && horseParty) {
        await assignHorseSection(docId, horseParty);
      }
      navigate(`/app/contracts/${docId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start the contract.');
    } finally {
      setBusy(false);
    }
  }

  const partySelect = (value: string, onChange: (v: string) => void, label: string) => (
    <select className="form-input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">Choose…</option>
      {contacts.map((c) => (
        <option key={c.id} value={c.id}>{c.name || c.email || c.id}{c.email && c.name ? ` — ${c.email}` : ''}</option>
      ))}
    </select>
  );

  return (
    <div className="max-w-2xl">
      <Link to="/app/ops/documents"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Documents
      </Link>
      <h1 className="font-serif text-2xl text-green-900 mb-1">New contract</h1>
      <p className="text-sm text-green-800/70 mb-4">
        The company originates every contract. You can act on behalf of either
        party — or both — by filling their side and setting their controls below.
      </p>

      {/* both parties must exist as accounts/contacts first */}
      <div className="bg-gold-50 border border-gold-600/40 rounded-lg px-4 py-3 mb-5 flex items-start gap-2.5">
        <UserPlus size={15} className="text-gold-800 mt-0.5 shrink-0" />
        <p className="text-[12.5px] text-gold-900">
          Both parties are <strong>selected</strong>, never created here. If someone isn't in the
          list yet, <Link to="/app/ops/accounts/new" className="underline font-medium">add them as an account first</Link>,
          then come back and pick them.
        </p>
      </div>

      {/* contract type — buttons desktop, dropdown mobile */}
      <div className="hidden sm:flex gap-1.5 mb-2">
        {TYPES.map((x) => (
          <button key={x.id} type="button" onClick={() => setType(x.id)}
            className={`px-4 py-2 rounded-full text-sm font-sans focus-ring ${
              type === x.id ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}>
            {x.label}
          </button>
        ))}
      </div>
      <select className="form-input sm:hidden mb-2" value={type} aria-label="Contract type"
        onChange={(e) => setType(e.target.value as ContractType)}>
        {TYPES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
      <p className="text-xs text-muted mb-6">{t.hint}</p>

      <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
        <h2 className="font-serif text-green-800 text-base mb-3">Parties</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <span className="form-label">{roleLabel(roleA)}</span>
            {partySelect(partyA, setPartyA, roleLabel(roleA))}
          </div>
          <div>
            <span className="form-label">{roleLabel(roleB)}</span>
            {partySelect(partyB, setPartyB, roleLabel(roleB))}
          </div>
        </div>
      </section>

      <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
        <h2 className="font-serif text-green-800 text-base">Horse</h2>
        <p className="text-[12px] text-muted mb-3">
          From records autofills the horse section; otherwise assign that section
          to one of the parties to fill in.
        </p>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {([['pick', 'From records'], ['party', 'A party fills it in']] as ['pick' | 'party', string][]).map(([m, l]) => (
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
        {horseMode === 'party' && (
          <div className="flex gap-1.5">
            {t.roles.map((r) => (
              <button key={r} type="button" onClick={() => setHorseParty(r)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-sans focus-ring ${
                  horseParty === r ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
                }`}>
                {roleLabel(r)} fills it in
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
        <h2 className="font-serif text-green-800 text-base">Document controls</h2>
        <p className="text-[12px] text-muted mb-3">
          What each party may do. Acting on behalf of a party? Fill their side
          yourself and switch their controls off — the deal is set on your terms
          and the invitation will say review &amp; sign, nothing more.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <ControlsCard role={roleA} value={controlsA} onChange={setControlsA} />
          <ControlsCard role={roleB} value={controlsB} onChange={setControlsB} />
        </div>
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
      <button type="button" onClick={() => void create()} disabled={busy || !ready}
        className="w-full py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        Create &amp; start filling
      </button>
      <p className="text-[11px] text-muted mt-2">
        Nothing is emailed yet. Fill the fields (acting for a party where needed),
        lock it, then send ONE invitation from the person's account page — it
        lists everything assigned to them, worded by the controls you set above.
      </p>
    </div>
  );
}
