import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Handshake, Loader2 } from 'lucide-react';
import { PageLayout } from '../../../components/app/PageLayout';
import { useDocumentTitle } from '../../../lib/hooks';
import { toErrorMessage } from '../../../lib/ops/errors';
import { Modal } from '../../../components/ops/kit/Modal';
import { useFormDraft } from '../../../lib/formState';
import {
  listDeals, createDeal, addDealDocument, dealLabel,
  DEAL_TYPE_LABEL, DEAL_ROLES, ROLE_LABEL,
  type DealRow, type DealType, type DealBadge,
} from '../../../lib/deals';
import { contractPartyOptions, contactHorseRecords, type PartyOption, type HorseIntakeRecord } from '../../../lib/horses';

/**
 * DEALS (/app/ops/deals, and the Records "Deals" tab) — every transaction the
 * business is party to or facilitating.
 *
 * TASK DEALAUTO §4, owner 2026-08-22: "deals should auto generate now that i
 * think about it so that page should be self-populating not manually authored
 * as the first step before a contract nor after."
 *
 * THIS PAGE IS A READ SURFACE. A deal is opened by the database the moment its
 * contract row is inserted (contracts_ensure_deal_trg -> ensure_deal_for_contract),
 * whichever way that contract was started — New Contract, the lease flow, the
 * sale flow, the standalone bill of sale. Nothing here creates one.
 *
 * The New-deal modal below is RETIRED, NOT DELETED (D32). It is the only caller
 * `create_deal` has ever had, and `create_deal` itself is untouched and still
 * granted: it remains the escape hatch for a deal that needs a contract
 * envelope of its own with no governing document yet. Flip the boolean to bring
 * the modal back; nothing else has to change.
 */
export const DEALS_MANUAL_CREATION_RETIRED = true;

const field = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 focus-ring bg-white';

/** The derived badge, one colour per state. */
export function DealBadgePill({ badge }: { badge: DealBadge }) {
  const tone = badge.code === 'complete' ? 'bg-green-800 text-white'
    : badge.code === 'signed' ? 'bg-gold-100 text-gold-900'
      : badge.code === 'void' ? 'bg-red-50 text-red-700'
        : badge.code === 'editable' ? 'bg-green-800/10 text-green-800'
          : 'bg-cream-100 text-green-800/80';
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${tone}`}>
      {badge.label}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The one creation surface: everything a container needs, nothing more. */
function CreateDealModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (dealId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [dealType, setDealType] = useState<DealType | ''>('');
  const [contacts, setContacts] = useState<PartyOption[]>([]);
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [horses, setHorses] = useState<HorseIntakeRecord[]>([]);
  const [horseId, setHorseId] = useState('');
  /** Sale only: does the bill of sale stand alone, or come with an agreement? */
  const [withAgreement, setWithAgreement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    contractPartyOptions().then(setContacts).catch(() => setContacts([]));
  }, []);
  // the horse list follows the owning side (seller / lessor)
  useEffect(() => {
    if (!partyA) { setHorses([]); setHorseId(''); return; }
    contactHorseRecords(partyA).then(setHorses).catch(() => setHorses([]));
  }, [partyA]);
  useEffect(() => { setPartyA(''); setPartyB(''); setHorseId(''); }, [dealType]);

  const roles = dealType ? DEAL_ROLES[dealType] : null;
  const ready = !!dealType && !!partyA && !!partyB;

  /* TASK-FIX4 §6 — a half-built deal survives a reload. ⚠️ It is a DRAFT, not a
     deal: nothing reaches `createDeal` until `Create deal` is pressed. */
  const draft = useFormDraft(
    'ops.new-deal',
    { title, dealType, partyA, partyB, horseId, withAgreement },
    (d) => {
      if (typeof d.title === 'string') setTitle(d.title);
      if (d.dealType) setDealType(d.dealType as DealType);
      if (typeof d.partyA === 'string') setPartyA(d.partyA);
      if (typeof d.partyB === 'string') setPartyB(d.partyB);
      if (typeof d.horseId === 'string') setHorseId(d.horseId);
      if (typeof d.withAgreement === 'boolean') setWithAgreement(d.withAgreement);
    },
  );

  function clearForm() {
    setTitle(''); setPartyA(''); setPartyB(''); setHorseId('');
    setWithAgreement(false); setErr(null);
    draft.clear();
  }

  async function create() {
    if (!ready || !dealType) return;
    setBusy(true); setErr(null);
    try {
      const deal = await createDeal({
        dealType, title: title.trim() || undefined,
        partyA: [partyA], partyB: [partyB],
        horseId: horseId || undefined,
      });
      // the deal's documents are prepared immediately, so the container is never
      // empty on arrival: the governing instrument, plus the agreement if chosen
      if (dealType === 'SALE') {
        await addDealDocument(deal.deal_id, 'HORSE_BILL_OF_SALE', withAgreement ? 'YES' : 'NO');
        if (withAgreement) await addDealDocument(deal.deal_id, 'HORSE_SALE_V2');
      } else {
        await addDealDocument(deal.deal_id, 'HORSE_LEASE_V2');
      }
      draft.clear();
      onCreated(deal.deal_id);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not create the deal.'));
      setBusy(false);
    }
  }

  const picker = (value: string, onChange: (v: string) => void, label: string) => (
    <select className={field} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">Choose…</option>
      {contacts.filter((c) => c.id !== (value === partyA ? partyB : partyA)).map((c) => (
        <option key={c.id} value={c.id}>{c.name || c.email || c.id}</option>
      ))}
    </select>
  );

  return (
    /* ⚠️ TASK-FIX4 §3 — converged. `Create deal` is the affirmative action and the
       only thing that writes; the backdrop no longer closes over a filled form. */
    <Modal open onClose={onClose} title="New deal" size="md"
      onClear={clearForm} saveStatus={draft.status} error={err}
      footer={
        <button type="button" onClick={() => void create()} disabled={!ready || busy}
          className="px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center gap-2 disabled:opacity-60">
          {busy && <Loader2 size={15} className="animate-spin" />}
          Create deal
        </button>
      }>
        <div className="flex flex-col gap-4">
          <div>
            <span className="form-label">What is this deal called?</span>
            <input className={field} value={title} aria-label="Deal name"
              placeholder="e.g. Sale of Beau to the Robertsons"
              onChange={(e) => setTitle(e.target.value)} />
            <p className="text-[11.5px] text-muted mt-1">Optional — you can rename it later.</p>
          </div>

          <div>
            <span className="form-label">Kind of deal</span>
            <div className="flex gap-1.5">
              {(Object.keys(DEAL_TYPE_LABEL) as DealType[]).map((t) => (
                <button key={t} type="button" onClick={() => setDealType(t)}
                  className={`px-4 py-2 rounded-full text-sm font-sans focus-ring ${
                    dealType === t ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
                  }`}>
                  {DEAL_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          {roles && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <span className="form-label">{ROLE_LABEL[roles[0]]}</span>
                  {picker(partyA, setPartyA, ROLE_LABEL[roles[0]])}
                </div>
                <div>
                  <span className="form-label">{ROLE_LABEL[roles[1]]}</span>
                  {picker(partyB, setPartyB, ROLE_LABEL[roles[1]])}
                </div>
              </div>

              <div>
                <span className="form-label">Horse</span>
                <select className={field} value={horseId} disabled={!partyA} aria-label="Horse"
                  onChange={(e) => setHorseId(e.target.value)}>
                  <option value="">
                    {!partyA ? `Choose the ${ROLE_LABEL[roles[0]].toLowerCase()} first…`
                      : horses.length === 0 ? 'No horses on file for them' : 'Choose a horse…'}
                  </option>
                  {horses.map((h) => (
                    <option key={h.id} value={h.id}>
                      {String(h.nickname ?? '') || String(h.registered_name ?? '') || h.id}
                    </option>
                  ))}
                </select>
              </div>

              {dealType === 'SALE' && (
                <div>
                  <span className="form-label">Paperwork</span>
                  <label className="flex items-start gap-2.5 text-sm text-green-900">
                    <input type="checkbox" className="mt-0.5" checked={withAgreement}
                      onChange={(e) => setWithAgreement(e.target.checked)} />
                    <span>
                      Add a purchase and sale agreement
                      <span className="block text-[11.5px] text-muted">
                        The bill of sale alone transfers ownership and carries its own
                        disclosures and warranties. Add an agreement when the parties
                        need commitments settled before the transfer happens.
                      </span>
                    </span>
                  </label>
                </div>
              )}
            </>
          )}

        </div>
    </Modal>
  );
}

export default function DealsPage() {
  useDocumentTitle('Deals');
  const navigate = useNavigate();
  const [rows, setRows] = useState<DealRow[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    listDeals().then(setRows).catch((e) => {
      setErr(toErrorMessage(e, 'Could not load deals.'));
      setRows([]);
    });
  }, []);
  useEffect(load, [load]);

  return (
    <PageLayout
      name="Deals"
      description="Every sale and lease, opened automatically with its contract, and the documents that make each one real."
      width="wide"
      onAdd={DEALS_MANUAL_CREATION_RETIRED || !rows || rows.length === 0
        ? undefined : () => setCreating(true)}
      addLabel="deal"
    >
      {err && <p role="alert" className="form-error mb-3">{err}</p>}

      {rows === null ? (
        <p className="body-text text-muted text-sm">Loading deals…</p>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-green-800/20 rounded-xl py-16 text-center">
          <Handshake size={26} className="mx-auto text-green-700/70 mb-3" />
          {DEALS_MANUAL_CREATION_RETIRED ? (
            <>
              <p className="text-sm text-green-900 mb-1">No deals yet.</p>
              <p className="text-[12.5px] text-muted max-w-sm mx-auto">
                A deal opens by itself the moment a lease, sale or bill of sale is
                started. Start one from New Contract and it will appear here.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-green-900 mb-4">No deals yet.</p>
              <button type="button" onClick={() => setCreating(true)}
                className="px-5 py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center gap-2">
                <Plus size={16} /> Create your first deal
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((d) => (
            <Link key={d.id} to={`/app/ops/deals/${d.id}`}
              className="flex items-center gap-4 bg-white border border-green-800/10 rounded-xl px-4 py-3 hover:border-green-800/25 focus-ring">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-green-900 truncate">
                  {dealLabel(d)}
                </span>
                <span className="block text-[11.5px] text-muted truncate">
                  {d.party_summary || 'No parties'}
                  {d.horse_summary ? ` · ${d.horse_summary}` : ''}
                  {` · ${d.document_count} document${d.document_count === 1 ? '' : 's'}`}
                </span>
              </span>
              <span className="hidden sm:block text-[11px] text-muted whitespace-nowrap">
                {DEAL_TYPE_LABEL[d.deal_type]}
              </span>
              <span className="hidden md:block text-[11px] text-muted whitespace-nowrap">
                {fmtDate(d.created_at)}
                {d.completed_at ? ` → ${fmtDate(d.completed_at)}` : ''}
              </span>
              <DealBadgePill badge={d.badge} />
              <span className="text-[11px] text-muted whitespace-nowrap">{d.display_code}</span>
            </Link>
          ))}
        </div>
      )}

      {creating && !DEALS_MANUAL_CREATION_RETIRED && (
        <CreateDealModal onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/app/ops/deals/${id}`)} />
      )}
    </PageLayout>
  );
}

/** RETIRED as a standalone route behind a boolean, never deleted (standing
 *  rule from 86a2c33). Owner, 2026-08-15: "deals… should be added to the
 *  records page." This component is unchanged and is now the Records
 *  "Deals" tab directly (RecordsPage.tsx). /app/ops/deals redirects there;
 *  /app/ops/deals/:dealId (the individual deal's own page) is untouched. */
export const DEALS_STANDALONE_RETIRED = true;
