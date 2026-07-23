import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import { startLeaseContract, startPurchaseContract } from '../../../lib/api';
import {
  claimDocumentOrigination, setPartyControls, assignHorseSection,
} from '../../../lib/contracts';
import { staffHorseRecords, contractPartyOptions, createHorseRecord, type StaffHorseRecord, type PartyOption } from '../../../lib/horses';
import {
  PartyControlsCard, DEFAULT_PARTY_CONTROLS, roleLabel,
  type PartyControlValues,
} from '../../../components/app/PartyControlsCard';

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

type Controls = PartyControlValues;
const DEFAULT_CONTROLS = DEFAULT_PARTY_CONTROLS;

export default function NewContractPage() {
  useDocumentTitle('New contract');
  const [type, setType] = useState<ContractType>('lease');
  const [contacts, setContacts] = useState<PartyOption[]>([]);
  const [horses, setHorses] = useState<StaffHorseRecord[]>([]);

  const [partyA, setPartyA] = useState('');   // lessee / buyer contact id
  const [partyB, setPartyB] = useState('');   // lessor / seller contact id
  const [horseMode, setHorseMode] = useState<'pick' | 'record' | 'party'>('pick');
  // inline record: owned by the horse-owning party (lessor in a lease)
  const [newHorse, setNewHorse] = useState<Record<string, string>>({});
  const [horseId, setHorseId] = useState('');
  const [horseParty, setHorseParty] = useState<string>('');  // which party fills HORSE.*
  const [controlsA, setControlsA] = useState<Controls>(DEFAULT_CONTROLS);
  const [controlsB, setControlsB] = useState<Controls>(DEFAULT_CONTROLS);
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  // Lease only: which party is responsible for authoring the deal terms.
  const [responsibleRole, setResponsibleRole] = useState<'LESSEE' | 'LESSOR'>('LESSEE');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Once created, the full contract renders INLINE below the config on THIS page
  // (no navigation) — the config block stays at the top. The created doc id is
  // mirrored into the URL (?doc=…) so a REFRESH re-opens the same contract inline
  // instead of losing it: the document is already persisted server-side; only the
  // "which doc am I showing" state needs to survive the reload. We read it back
  // on mount and write it with replace (no history entry, no navigation).
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Legacy support: an older version revealed the contract inline via ?doc=. Now
  // creation opens the standalone contract page instead, so if we land here with a
  // ?doc= (an old link, a back-nav), redirect to that contract page.
  useEffect(() => {
    const legacyDoc = params.get('doc');
    if (legacyDoc) navigate(`/app/contracts/${legacyDoc}`, { replace: true });
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = TYPES.find((x) => x.id === type)!;
  const [roleA, roleB] = t.roles;

  useEffect(() => {
    contractPartyOptions().then(setContacts).catch(() => setContacts([]));
    staffHorseRecords().then(setHorses).catch(() => setHorses([]));
  }, []);
  useEffect(() => { setHorseParty(roleB); }, [roleB]);

  const ready = !!partyA && !!partyB && (horseMode === 'pick' ? !!horseId : horseMode === 'record' ? !!(newHorse.registered_name || newHorse.nickname) : !!horseParty);

  async function create() {
    setErr(null);
    if (!ready) { setErr('Select both parties and the horse source first.'); return; }
    setBusy(true);
    try {
      let chosenHorse = horseMode === 'pick' ? horseId : undefined;
      if (horseMode === 'record') {
        // the horse's owner is the horse-owning party: lessor / seller = partyB.
        // Single intake path: create_horse_record honors owner_contact_id for staff.
        const out = await createHorseRecord({ ...newHorse, owner_contact_id: partyB });
        if (out.outcome === 'match_pending_review') {
          setErr('That horse may already be on file — a review was opened. Pick it from records instead.');
          setBusy(false); return;
        }
        chosenHorse = out.horse_id;
      }
      const result = type === 'lease'
        ? await startLeaseContract(partyA, partyB, chosenHorse, responsibleRole)
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
      // Open the full standalone contract page. Navigating (rather than embedding
      // the contract inline under the config) gives the author the real contract
      // view: the top-of-page action deck, the document header, and the Parties &
      // Horse card showing the chosen parties' DATA — not the picker menus from
      // this config card. It also guarantees a fresh mount so nothing is stale.
      navigate(`/app/contracts/${docId}`);
      return;
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
    <div className="max-w-5xl">
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
        {/* Owner side first (Lessor / Seller = roleB / partyB), then the
            counterparty (Lessee / Buyer = roleA / partyA) — matching the Parties &
            Horse card order. The partyA/partyB variable meanings are unchanged; only
            the display order is swapped. */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <span className="form-label">{roleLabel(roleB)}</span>
            {partySelect(partyB, setPartyB, roleLabel(roleB))}
          </div>
          <div>
            <span className="form-label">{roleLabel(roleA)}</span>
            {partySelect(partyA, setPartyA, roleLabel(roleA))}
          </div>
        </div>
        {type === 'lease' && (
          <div className="mt-4 max-w-xs">
            <span className="form-label">Responsible for authoring the terms</span>
            <select className="form-input" value={responsibleRole} onChange={(e) => setResponsibleRole(e.target.value as 'LESSEE' | 'LESSOR')}>
              <option value="LESSEE">Lessee</option>
              <option value="LESSOR">Lessor (owner)</option>
            </select>
            <p className="form-hint mt-1">This party owns the deal terms; the owner always controls horse info, subleasing, and sharing.</p>
          </div>
        )}
      </section>

      <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
        <h2 className="font-serif text-green-800 text-base">Horse</h2>
        <p className="text-[12px] text-muted mb-3">
          From records autofills the horse section; otherwise assign that section
          to one of the parties to fill in.
        </p>
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {([['pick', 'From records'], ['record', 'Record it now'], ['party', 'A party fills it in']] as ['pick' | 'record' | 'party', string][]).map(([m, l]) => (
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
                {[h.nickname || h.registered_name, h.breed, h.owner_name || h.owner_name_text].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        )}
        {horseMode === 'record' && (
          <div className="grid sm:grid-cols-2 gap-3">
            <p className="text-[12px] text-muted sm:col-span-2">
              Creates the record now, owned by the {roleLabel(roleB).toLowerCase()} ({roleB === 'LESSOR' ? 'the horse\u2019s owner' : 'seller'}). It autofills the contract and lives in your horse records.
            </p>
            {([['registered_name','Registered name'],['nickname','Barn name'],['breed','Breed'],['color','Color'],['sex','Sex'],['height','Height'],['microchip_id','Microchip'],['registration_number','Registration #']] as [string,string][]).map(([k,label]) => (
              <div key={k}>
                <span className="form-label">{label}{k==='registered_name' ? ' *' : ''}</span>
                <input className="form-input" value={newHorse[k] ?? ''}
                  onChange={(e) => setNewHorse((h) => ({ ...h, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
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
          <PartyControlsCard role={roleA} value={controlsA} onChange={setControlsA} />
          <PartyControlsCard role={roleB} value={controlsB} onChange={setControlsB} />
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

      {/* Get started (enabled once parties + horse are set). Creating the contract
          opens the full standalone contract page. */}
      <button type="button" onClick={() => void create()} disabled={busy || !ready}
        className="w-full py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        Get started
      </button>
      <p className="text-[11px] text-muted mt-2">
        Add the parties and the horse above, then Get started — the full contract
        opens for you to fill.
      </p>
    </div>
  );
}
