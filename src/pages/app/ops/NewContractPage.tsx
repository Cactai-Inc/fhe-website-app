import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { PageLayout } from '../../../components/app/PageLayout';
import { useDocumentTitle } from '../../../lib/hooks';
import { startLeaseContract, startSaleContract, startBillOfSaleStandalone, linkContractToPurchase, listLeaseTemplates } from '../../../lib/api';
import type { ContractTemplate } from '../../../lib/ops/types';
import { toErrorMessage } from '../../../lib/ops/errors';
import {
  claimDocumentOrigination, setPartyControls, assignHorseSection,
} from '../../../lib/contracts';
import { staffHorseRecords, contractPartyOptions, horsePendingContractFields, type StaffHorseRecord, type PartyOption } from '../../../lib/horses';
import { AddHorseModal } from '../../../components/app/AddHorseModal';
import {
  PartyControlsCard, DEFAULT_PARTY_CONTROLS, roleLabel,
  type PartyControlValues,
} from '../../../components/app/PartyControlsCard';
import { BackControl } from '../../../components/app/BackControl';

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

type ContractType = 'lease' | 'purchase' | 'bill_of_sale';

const TYPES: { id: ContractType; label: string; hint: string; roles: [string, string] }[] = [
  { id: 'lease', label: 'Horse lease', hint: 'Lease agreement — lessee & lessor', roles: ['LESSEE', 'LESSOR'] },
  { id: 'purchase', label: 'Horse sale', hint: 'Sale and purchase agreement — buyer & seller', roles: ['BUYER', 'SELLER'] },
  /* A standalone Bill of Sale is its own signable ownership record — no Sale
     Agreement required. (A completed sale can also generate a companion BOS from
     the sale document; this is the direct path.) */
  { id: 'bill_of_sale', label: 'Bill of sale', hint: 'Ownership record — buyer & seller, signable on its own', roles: ['BUYER', 'SELLER'] },
];

type Controls = PartyControlValues;
const DEFAULT_CONTROLS = DEFAULT_PARTY_CONTROLS;

/** A horse's display name for the picker — nickname, else registered name, else id.
 *  Used for alphabetical ordering and the auto-selected first horse (CR-126). */
function horseName(h: { nickname?: unknown; registered_name?: unknown; id?: unknown }): string {
  return String(h.nickname ?? '') || String(h.registered_name ?? '') || String(h.id ?? '');
}

/** The horse <option> label: name · breed, and — only when NO seller is chosen yet,
 *  so the list spans every owner — the owner's name, so an all-horses list is legible
 *  and a pick unambiguously names whose record it carries. */
function horseOption(h: StaffHorseRecord, showOwner: boolean): string {
  const owner = showOwner ? (h.owner_name || h.owner_name_text || '') : '';
  return [horseName(h), h.breed ?? '', owner].filter(Boolean).join(' · ') || h.id;
}

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
  const [leaseTemplateKey, setLeaseTemplateKey] = useState('HORSE_LEASE_V3');

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
  // Lock model default: both parties have full access until restricted.
  const [controlsA, setControlsA] = useState<Controls>(DEFAULT_CONTROLS);
  const [controlsB, setControlsB] = useState<Controls>(DEFAULT_CONTROLS);
  // Both types: the horse step is a dropdown of horses — all of them until a seller
  // is chosen, then narrowed to that seller's — plus "Add a new horse" (the intake
  // form, in a modal). Driven directly off the master `horses` list, which carries
  // owner_contact_id for the bidirectional owner↔horse match.
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

  // CR-126 verbatim: the seller/lessor (partyB) list shows ONLY people who own a
  // horse in the system — a contact with no horse record is never offered as a
  // seller/lessor. Derived from the loaded horse records (no new RPC). The company is
  // included only when it actually owns one, by the same rule. contractPartyOptions is
  // already alphabetical (company first, then last/first name), so the filtered list
  // stays ordered. The buyer/lessee (partyA) list is unchanged — a buyer needn't own
  // one. A seller whose horse isn't on file yet is handled by "Add a new horse", which
  // captures the owner and sets them as this party.
  const horseOwnerIds = new Set(
    horses.map((h) => h.owner_contact_id).filter((x): x is string => !!x));
  const sellerPartyOptions = contacts.filter((c) => horseOwnerIds.has(c.id));

  // CR-126 verbatim (owner): it is fine to show ALL horses until a side is chosen —
  // what must never show is an UNMATCHED pair. So the horse picker lists every horse
  // (alphabetical, labelled with its owner) when no seller is chosen, and narrows to
  // the chosen seller's horses once one is. And the match is BIDIRECTIONAL: picking a
  // horse selects its owner as the seller; picking the seller narrows + auto-selects.
  const horsesSorted = [...horses].sort((a, b) => horseName(a).localeCompare(horseName(b)));
  const visibleHorses = partyB
    ? horsesSorted.filter((h) => h.owner_contact_id === partyB)
    : horsesSorted;

  useEffect(() => {
    contractPartyOptions().then(setContacts).catch(() => setContacts([]));
    staffHorseRecords().then(setHorses).catch(() => setHorses([]));
    // A failure here leaves the picker empty, which falls back to the RPC default
    // — starting a lease must never depend on this list loading.
    listLeaseTemplates().then(setLeaseTemplates).catch(() => setLeaseTemplates([]));
  }, []);
  useEffect(() => { setHorseParty(roleB); }, [roleB]);
  // The seller/lessor list is always horse-owners, so drop a chosen seller who owns
  // no horse — a restricted <select> has no option for them and would render blank.
  // Guarded on the horse list having loaded so a valid seller is never cleared before
  // the data is in (e.g. right after "Add a new horse" sets this party, the refreshed
  // horses list arrives a tick later and the new owner is in it).
  useEffect(() => {
    if (partyB && horses.length > 0 && !horseOwnerIds.has(partyB)) {
      setPartyB('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyB, horses]);
  // NO UNMATCHED PAIRS (CR-126, owner): keep the horse and the seller consistent.
  // When a seller is chosen, the horse must be one of theirs — if the current pick
  // isn't, snap to the first of theirs (owner: "default to selecting the first on the
  // list"). When no seller is chosen the horse is left as-is (all horses are offered).
  // Picking a horse the other way sets its owner as the seller — see chooseHorse.
  useEffect(() => {
    // Clearing the seller clears the horse too — the two are never left half-matched.
    if (!partyB) { setHorseId(''); return; }
    const theirs = horsesSorted.filter((h) => h.owner_contact_id === partyB);
    setHorseId((prev) => {
      if (prev && theirs.some((h) => h.id === prev)) return prev;  // already one of theirs
      return theirs.length > 0 ? theirs[0].id : '';
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyB, horses]);

  /** Picking a horse selects its owner as the seller/lessor — the reverse of picking
   *  the seller first. Guarantees the pair is always matched whichever side is chosen
   *  first (owner: "I should be able to select either the owner or the horse and see
   *  the associated record auto selected"). */
  function chooseHorse(id: string) {
    setHorseId(id);
    const owner = horses.find((h) => h.id === id)?.owner_contact_id;
    if (owner && owner !== partyB) setPartyB(owner);
  }

  /** The modal saved: adopt the horse, and — when the horse-owning party was not
   *  chosen yet — adopt the OWNER it was assigned to as that party (owner,
   *  2026-08-23: "when i do and i save the new record it should close the modal and
   *  the lessor field in the card above the horse card should show the lessor's
   *  name"). Both directions of the same rule: whichever of the two is known
   *  supplies the other, and nobody is asked twice. */
  function handleHorseSaved(newHorseId: string, ownerContactId?: string) {
    setIntakeOpen(false);
    const owner = ownerContactId || partyB;
    // Seed the new horse+owner into the master list SYNCHRONOUSLY, before setting
    // partyB — otherwise the "drop a non-owner seller" guard (and the match effect)
    // would fire on the stale horses list and clear the just-added pairing before the
    // async refresh lands. The refresh below replaces this stub with the full row.
    if (owner) {
      setHorses((prev) => prev.some((h) => h.id === newHorseId)
        ? prev
        : [...prev, { id: newHorseId, owner_contact_id: owner } as StaffHorseRecord]);
    }
    setHorseId(newHorseId);
    if (!partyB && ownerContactId) setPartyB(ownerContactId);
    // Refresh the master horse list so it reflects the server (full names, breed, etc.).
    staffHorseRecords().then(setHorses).catch(() => {});
  }

  /* STAGING (fix round 3, item 4). A contract can be created with the counterparty
     seat empty and with no horse — nothing but the primary party is needed for the
     document to exist. Staff attach the counterparty and the horse on the contract
     page afterward, and the horse is a SIGNING blocker, not a creation blocker. So
     the only requirement to Get started is the primary party (the lessee / buyer);
     partyB and the horse are optional here. */
  const ready = !!partyA;

  async function create() {
    setErr(null);
    if (!ready) { setErr(`Choose the ${roleLabel(roleA).toLowerCase()} to get started — the ${roleLabel(roleB).toLowerCase()} and horse can be added later.`); return; }
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
    // The horse is either picked/added above (both write a real `horses` row
    // through the one intake path) or deliberately left to a party to fill in.
    const chosenHorse = (type === 'purchase' || type === 'bill_of_sale' || horseMode === 'pick') ? horseId : undefined;

    // Before generating, warn about identity fields this contract will print as
    // "To be provided" — empty or marked add-later. The author may proceed.
    if (chosenHorse) {
      const pendingFields = await horsePendingContractFields(chosenHorse).catch(() => [] as string[]);
      if (pendingFields.length > 0) {
        const ok = window.confirm(
          `This horse has information not yet filled in. The contract will print “To be provided” for:\n\n`
          + pendingFields.map((f) => `• ${f}`).join('\n')
          + `\n\nGenerate the contract anyway?`);
        if (!ok) return;
      }
    }
    setBusy(true);
    try {
      const result = type === 'lease'
        ? await startLeaseContract(partyA, partyB, chosenHorse, leaseTemplateKey || undefined)
        : type === 'bill_of_sale'
          // partyA = Buyer, partyB = Seller (roles order in TYPES).
          ? await startBillOfSaleStandalone({ buyerContactId: partyA, sellerContactId: partyB || null, horseId: chosenHorse || null })
          // CR-126 B2: price + deposit are filled in the contract body, not here.
          : await startSaleContract(partyA, partyB, chosenHorse);
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

  const partySelect = (
    value: string, onChange: (v: string) => void, label: string,
    options: PartyOption[] = contacts, emptyLabel = 'Choose…',
  ) => (
    <select className="form-input" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">{options.length === 0 ? emptyLabel : 'Choose…'}</option>
      {options.map((c) => (
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
      {/* ⚠️ TASK-MODAL2 D5 — the most field-dense authoring surface in ops. */}
      <BackControl to="/app/ops/documents" label="Documents" className="mb-4" />

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
            {/* Always the horse-owners only — so the horse picker below can never
                offer a horse that isn't theirs. A seller with no horse on file yet
                is added through "Add a new horse", which sets them as this party. */}
            {partySelect(partyB, setPartyB, roleLabel(roleB), sellerPartyOptions,
              `No horse owners on file yet — add the ${roleLabel(roleB).toLowerCase()}’s horse first`)}
            <p className="text-[11px] text-muted mt-1">Only people who own a horse in the system.</p>
          </div>
          <div>
            <span className="form-label">{roleLabel(roleA)}</span>
            {partySelect(partyA, setPartyA, roleLabel(roleA))}
          </div>
        </div>
        {/* (author/originator party dropdown removed — the company authors every
            contract; per-party abilities are set with the controls below.) */}
      </section>

      {(type === 'purchase' || type === 'bill_of_sale') && (
        <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
          <h2 className="font-serif text-green-800 text-base">Horse</h2>
          <p className="text-[12px] text-muted mb-3">
            {partyB
              ? 'The seller’s horses. Not on file yet? Add it — the intake opens right here.'
              : 'Pick a horse (its owner becomes the seller) or pick the seller first. Not on file? Add it.'}
          </p>
          <div className="flex gap-2 items-start flex-wrap">
            {/* All horses until a seller is chosen, then only the seller's. Picking a
                horse sets its owner as the seller — the pair is always matched. */}
            <select className="form-input flex-1 min-w-52" value={horseId}
              onChange={(e) => chooseHorse(e.target.value)} aria-label="Horse">
              <option value="">
                {visibleHorses.length === 0
                  ? (partyB ? 'No horses on file for this seller' : 'No horse records yet')
                  : 'Choose a horse…'}
              </option>
              {visibleHorses.map((h) => (
                <option key={h.id} value={h.id}>{horseOption(h, !partyB)}</option>
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
                : `Pick a horse (its owner becomes the ${roleLabel(roleB).toLowerCase()}) or pick the ${roleLabel(roleB).toLowerCase()} first. Not on file? Add it.`}
            </p>
            <div className="flex gap-2 items-start flex-wrap">
              {/* All horses until the lessor/seller is chosen, then only theirs. The
                  pair is kept matched both ways: picking a horse sets its owner as the
                  lessor; picking the lessor narrows + auto-selects. The one thing never
                  shown is an UNMATCHED pair. */}
              <select className="form-input flex-1 min-w-52" value={horseId}
                onChange={(e) => chooseHorse(e.target.value)} aria-label="Horse">
                <option value="">
                  {visibleHorses.length === 0
                    ? (partyB ? 'No horses on file for this party' : 'No horse records yet')
                    : 'Choose a horse…'}
                </option>
                {visibleHorses.map((h) => (
                  <option key={h.id} value={h.id}>{horseOption(h, !partyB)}</option>
                ))}
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

      {/* CR-126 B2: price + deposit are NOT captured here. They are ordinary PRICE-
          section terms filled in the contract body with everything else — capturing
          them at creation put money on the first step before the parties or the
          horse were even settled. The create step is just parties + horse; the
          document's Price section is where the amounts are entered. */}

      {err && <p role="alert" className="form-error mb-3">{err}</p>}

      {/* Get started (enabled once parties + horse are set). Creating the contract
          opens the full standalone contract page. */}
      <button type="button" onClick={() => void create()} disabled={busy || !ready}
        className="w-full py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center justify-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />}
        Get started
      </button>
      <p className="text-[11px] text-muted mt-2">
        Choose the {roleLabel(roleA).toLowerCase()}, then Get started — the full
        contract opens for you to fill. The {roleLabel(roleB).toLowerCase()} and the
        horse can be attached later on the contract page; the horse is only needed
        before signing.
      </p>

      {/* ONE modal for both contract types. When the horse-owning party is already
          chosen it is passed in and never asked for again; when it is not, the
          form's own account picker is the ask and its answer becomes that party. */}
      <AddHorseModal open={intakeOpen} onClose={() => setIntakeOpen(false)}
        ownerContactId={partyB || undefined} onSaved={handleHorseSaved} />
    </PageLayout>
  );
}
