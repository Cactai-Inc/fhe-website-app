import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PageLayout } from '../../../components/app/PageLayout';
import { useDocumentTitle } from '../../../lib/hooks';
import { startLeaseContract, startSaleContract, linkContractToPurchase, listLeaseTemplates } from '../../../lib/api';
import type { ContractTemplate } from '../../../lib/ops/types';
import { toErrorMessage } from '../../../lib/ops/errors';
import {
  claimDocumentOrigination, setPartyControls, assignHorseSection,
} from '../../../lib/contracts';
import { staffHorseRecords, contractPartyOptions, contactHorseRecords, type StaffHorseRecord, type PartyOption, type HorseIntakeRecord } from '../../../lib/horses';
import { AddHorseModal } from '../../../components/app/AddHorseModal';
import {
  PartyControlsCard, DEFAULT_PARTY_CONTROLS, roleLabel,
  type PartyControlValues,
} from '../../../components/app/PartyControlsCard';

/**
 * NEW CONTRACT (/app/ops/contracts/new) — company-originated, always.
 *   1. Type — lease or purchase & sale.
 *   2. BOTH parties are SELECTED from existing accounts/contacts — never
 *      created here. Add the person first (New client), then come back.
 *   3. Horse — from records (autofills HORSE.*), ADDED here through the real
 *      intake form in a modal, or ASSIGNED to one of the parties to fill in.
 *      Never "decide later".
 *
 * ⚠️ TASK-PAMELA §B — THE "RECORD IT NOW" GRID IS GONE, NOT REPAIRED.
 * This page used to offer a third horse mode that rendered eight bare text inputs
 * (registered name, "Barn name", breed, color, sex, height, microchip,
 * registration #). It was the surface the owner hit: free text where `horses.breed`
 * and `horses.color` are FOREIGN KEYS into the reference vocabularies (so a typed
 * value cannot be stored at all), no farrier and no vet anywhere, and a "Barn name"
 * label writing the `nickname` column — the exact word the owner has rejected twice.
 * It has been DELETED. "Add a new horse" opens `HorseIntakeForm` in a modal, which
 * is the same form every other horse-intake door already opens.
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
  { id: 'purchase', label: 'Horse sale', hint: 'Sale and purchase agreement — buyer & seller', roles: ['BUYER', 'SELLER'] },
];

type Controls = PartyControlValues;
const DEFAULT_CONTROLS = DEFAULT_PARTY_CONTROLS;

export default function NewContractPage() {
  useDocumentTitle('New contract');
  const [type, setType] = useState<ContractType>('lease');
  const [contacts, setContacts] = useState<PartyOption[]>([]);
  const [horses, setHorses] = useState<StaffHorseRecord[]>([]);
  // LEASEFORK: which lease VERSION to author. Defaults to HORSE_LEASE_V2, the
  // Standard (D10) — matches the RPC's own DEFAULT, so leaving it untouched is
  // behaviourally identical to the pre-picker caller. Only ever populated for a
  // lease. LEASESET: no more '' "Default" option — the owner rejected labelling
  // the Standard as "Default" ("We dont label the default as that we call it
  // Standard"), so the picker now names it explicitly instead.
  const [leaseTemplates, setLeaseTemplates] = useState<ContractTemplate[]>([]);
  const [leaseTemplateKey, setLeaseTemplateKey] = useState('HORSE_LEASE_V2');

  const [partyA, setPartyA] = useState('');   // lessee / buyer contact id
  const [partyB, setPartyB] = useState('');   // lessor / seller contact id
  const [horseMode, setHorseMode] = useState<'pick' | 'party'>('pick');
  const [horseId, setHorseId] = useState('');
  const [horseParty, setHorseParty] = useState<string>('');  // which party fills HORSE.*
  /* THE COUNTERPARTY HOLDS "can edit deal terms" BY DEFAULT (TASK-CONTRACTSEND
     §3, WALK3 F-3). `DEFAULT_CONTROLS` has it FALSE, and this page seeded BOTH
     cards from it — so the combination the page displayed as its own default was
     one `set_party_controls` refuses ("at least one party must be able to edit
     deal terms"). Creation therefore failed at the SECOND controls call, every
     time, for anyone who left the form alone. Party B is the counterparty (the
     lessor / seller — the side that is not us), which is the side the guard
     exists to keep in the conversation; staff can still switch it over. */
  const [controlsA, setControlsA] = useState<Controls>(DEFAULT_CONTROLS);
  const [controlsB, setControlsB] = useState<Controls>({ ...DEFAULT_CONTROLS, can_edit_deal: true });
  const [amount, setAmount] = useState('');
  const [deposit, setDeposit] = useState('');
  // Both types: the horse step is a dropdown of the horse-owning party's horses
  // + "Add a new horse" (the intake form, in a modal).
  const [sellerHorses, setSellerHorses] = useState<HorseIntakeRecord[]>([]);
  const [intakeOpen, setIntakeOpen] = useState(false);
  // (The "responsible for authoring the terms" party selector was removed — the
  // company is ALWAYS the author (H1 originator collapse); parties review.)

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
  //
  // TASK-DOCQUEUE: the documents picker's "Horse sale" card links here with
  // ?type=purchase to preselect the sale/purchase type — the picker groups by
  // contract_kind and this page owns which button that maps to.
  useEffect(() => {
    const legacyDoc = params.get('doc');
    if (legacyDoc) { navigate(`/app/contracts/${legacyDoc}`, { replace: true }); return; }
    if (params.get('type') === 'purchase') setType('purchase');
    // run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = TYPES.find((x) => x.id === type)!;
  const [roleA, roleB] = t.roles;

  useEffect(() => {
    contractPartyOptions().then(setContacts).catch(() => setContacts([]));
    staffHorseRecords().then(setHorses).catch(() => setHorses([]));
    // A failure here leaves the picker empty, which falls back to the RPC default
    // — starting a lease must never depend on this list loading.
    listLeaseTemplates().then(setLeaseTemplates).catch(() => setLeaseTemplates([]));
  }, []);
  useEffect(() => { setHorseParty(roleB); }, [roleB]);
  useEffect(() => {
    // The horse-owning party is partyB on both types (LESSOR / SELLER), so the
    // dropdown lists THEIR horses on both. Previously only the sale did this and
    // the lease offered every horse in the barn.
    if (partyB) {
      contactHorseRecords(partyB).then(setSellerHorses).catch(() => setSellerHorses([]));
    } else {
      setSellerHorses([]);
    }
    setHorseId('');
  }, [type, partyB]);

  /** The modal saved: adopt the horse, and — when the horse-owning party was not
   *  chosen yet — adopt the OWNER it was assigned to as that party (owner,
   *  2026-08-23: "when i do and i save the new record it should close the modal and
   *  the lessor field in the card above the horse card should show the lessor's
   *  name"). Both directions of the same rule: whichever of the two is known
   *  supplies the other, and nobody is asked twice. */
  function handleHorseSaved(newHorseId: string, ownerContactId?: string) {
    setIntakeOpen(false);
    setHorseId(newHorseId);
    const owner = ownerContactId || partyB;
    if (!partyB && ownerContactId) setPartyB(ownerContactId);
    if (owner) contactHorseRecords(owner).then(setSellerHorses).catch(() => {});
  }

  const ready = !!partyA && !!partyB && (type === 'purchase'
    ? !!horseId
    : horseMode === 'pick' ? !!horseId : !!horseParty);

  async function create() {
    setErr(null);
    if (!ready) { setErr('Select both parties and the horse source first.'); return; }
    /* REFUSE BEFORE WRITING, NOT AFTER. `set_party_controls` rejects a document
       where neither party may edit deal terms — but it can only do that once the
       document EXISTS, and this page used to discover it on the second of two
       calls made after `start_lease_contract_v2` had already written the
       contract, document and party rows. The result was a real, invisible,
       orphaned document plus the false message "Could not start the contract".
       Checking here means the combination is caught while nothing has been
       created, and the message names the control the author has to change. */
    if (!controlsA.can_edit_deal && !controlsB.can_edit_deal) {
      setErr('At least one party must be able to edit deal terms — otherwise every '
        + 'change has to go through staff. Turn “Can edit deal terms” on for one of the parties.');
      return;
    }
    setBusy(true);
    try {
      // The horse is either picked/added above (both write a real `horses` row
      // through the one intake path) or deliberately left to a party to fill in.
      const chosenHorse = (type === 'purchase' || horseMode === 'pick') ? horseId : undefined;
      const result = type === 'lease'
        ? await startLeaseContract(partyA, partyB, chosenHorse, leaseTemplateKey || undefined)
        : await startSaleContract(
            partyA, partyB, chosenHorse,
            amount ? Number(amount.replace(/[$,]/g, '')) : undefined,
            deposit ? Number(deposit.replace(/[$,]/g, '')) : undefined,
          );
      const docId = result.document_id;
      // Started from a purchase context (?purchase=<id>) → record the traceable
      // purchase↔contract link. Best-effort: never blocks contract creation.
      const originPurchase = params.get('purchase');
      if (originPurchase && result.contract_id) {
        try { await linkContractToPurchase(result.contract_id, originPurchase); }
        catch { /* the contract exists either way; staff can link it later */ }
      }
      /* EVERYTHING FROM HERE ON IS POST-CREATION SETUP, AND THE DOCUMENT ALREADY
         EXISTS. A throw in any of these steps used to fall to the outer catch,
         which reported "Could not start the contract" and left the author on this
         page — while a real contract, document and party rows sat in the database
         with nobody able to find them (WALK3 F-3: three such documents in
         production, and the likeliest reason production held zero contracts).
         So these steps report what did not get applied and then still open the
         document: an incompletely configured contract the author can see and
         finish beats an invisible one they cannot. */
      const setupFailures: string[] = [];
      const step = async (what: string, fn: () => Promise<unknown>) => {
        try { await fn(); } catch (e) {
          setupFailures.push(`${what}: ${toErrorMessage(e, 'failed')}`);
        }
      };
      // The company originates — never a party by assumption.
      await step('recording origination', () => claimDocumentOrigination(docId));
      // Per-party document controls, set at this stage.
      await step(`${roleA} controls`, () => setPartyControls(docId, roleA, controlsA));
      await step(`${roleB} controls`, () => setPartyControls(docId, roleB, controlsB));
      // Horse section: assigned to a party when not autofilled from a record.
      if (horseMode === 'party' && horseParty) {
        await step('horse section assignment', () => assignHorseSection(docId, horseParty));
      }
      if (setupFailures.length > 0) {
        navigate(`/app/contracts/${docId}`, {
          state: { setupNote: `The contract was created, but some settings were not applied — ${setupFailures.join('; ')}. Set them on this page.` },
        });
        return;
      }
      // Open the full standalone contract page. Navigating (rather than embedding
      // the contract inline under the config) gives the author the real contract
      // view: the top-of-page action deck, the document header, and the Parties &
      // Horse card showing the chosen parties' DATA — not the picker menus from
      // this config card. It also guarantees a fresh mount so nothing is stale.
      navigate(`/app/contracts/${docId}`);
      return;
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not start the contract.'));
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
    <PageLayout
      name="New contract"
      description="The company originates every contract. You can act on behalf of either party — or both — by filling their side and setting their controls below."
      width="wide"
    >
      <Link to="/app/ops/documents"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Documents
      </Link>

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

      {/* LEASEFORK: which lease VERSION to author. Staff-facing only — this whole
          route is <ProtectedRoute requireStaff>. Only shown when there is more
          than one version to choose between; with a single template the choice is
          not a choice, and leaving the value '' sends no template argument so the
          RPC's own default applies. */}
      {type === 'lease' && leaseTemplates.length > 1 && (
        <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
          <h2 className="font-serif text-green-800 text-base">Lease version</h2>
          <p className="text-[12px] text-muted mb-3">
            Which version of the lease to build this contract from. Leave it on the
            default unless you have a reason to use another.
          </p>
          <select className="form-input" value={leaseTemplateKey} aria-label="Lease version"
            onChange={(e) => setLeaseTemplateKey(e.target.value)}>
            {leaseTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.template_key}>{tpl.title}</option>
            ))}
          </select>
        </section>
      )}

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
        {/* (author/originator party dropdown removed — the company authors every
            contract; per-party abilities are set with the controls below.) */}
      </section>

      {type === 'purchase' && (
        <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
          <h2 className="font-serif text-green-800 text-base">Horse</h2>
          <p className="text-[12px] text-muted mb-3">
            {partyB
              ? 'The seller’s horses. Not on file yet? Add it — the intake opens right here.'
              : 'Pick the seller and their horses list here — or add the horse now and we’ll take the seller from it.'}
          </p>
          <div className="flex gap-2 items-start flex-wrap">
            <select className="form-input flex-1 min-w-52" value={horseId} disabled={!partyB}
              onChange={(e) => setHorseId(e.target.value)} aria-label="Horse">
              <option value="">
                {!partyB ? 'Select the seller first…'
                  : sellerHorses.length === 0 ? 'No horses on file for this seller'
                  : 'Choose a horse…'}
              </option>
              {sellerHorses.map((h) => (
                <option key={h.id} value={h.id}>
                  {[String(h.nickname ?? '') || String(h.registered_name ?? ''), String(h.breed ?? '')].filter(Boolean).join(' · ') || h.id}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setIntakeOpen(true)}
              className="px-3.5 py-2 rounded-lg text-xs font-sans bg-green-800/10 text-green-800 hover:bg-green-800/20 focus-ring">
              Add a new horse
            </button>
          </div>
        </section>
      )}

      {type === 'lease' && (
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
          <>
            <p className="text-[12px] text-muted mb-2">
              {partyB
                ? `The ${roleLabel(roleB).toLowerCase()}’s horses. Not on file yet? Add it — the intake opens right here.`
                : `Pick the ${roleLabel(roleB).toLowerCase()} and their horses list here — or add the horse now and we’ll take the ${roleLabel(roleB).toLowerCase()} from it.`}
            </p>
            <div className="flex gap-2 items-start flex-wrap">
              <select className="form-input flex-1 min-w-52" value={horseId}
                onChange={(e) => setHorseId(e.target.value)} aria-label="Horse">
                <option value="">
                  {partyB
                    ? (sellerHorses.length === 0 ? 'No horses on file for this party' : 'Choose a horse…')
                    : (horses.length === 0 ? 'No horse records yet' : 'Choose a horse…')}
                </option>
                {/* Scoped to the horse-owning party once one is chosen; every horse
                    record otherwise, so the picker is never empty before then. */}
                {(partyB ? sellerHorses.map((h) => ({
                  id: String(h.id),
                  label: [String(h.nickname ?? '') || String(h.registered_name ?? ''), String(h.breed ?? '')].filter(Boolean).join(' · ') || String(h.id),
                })) : horses.map((h) => ({
                  id: h.id,
                  label: [h.nickname || h.registered_name, h.breed, h.owner_name || h.owner_name_text].filter(Boolean).join(' · '),
                }))).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
              <button type="button" onClick={() => setIntakeOpen(true)}
                className="px-3.5 py-2 rounded-lg text-xs font-sans bg-green-800/10 text-green-800 hover:bg-green-800/20 focus-ring">
                Add a new horse
              </button>
            </div>
          </>
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
      )}

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

      {/* ONE modal for both contract types. When the horse-owning party is already
          chosen it is passed in and never asked for again; when it is not, the
          form's own account picker is the ask and its answer becomes that party. */}
      <AddHorseModal open={intakeOpen} onClose={() => setIntakeOpen(false)}
        ownerContactId={partyB || undefined} onSaved={handleHorseSaved} />
    </PageLayout>
  );
}
