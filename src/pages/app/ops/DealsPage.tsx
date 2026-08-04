import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Handshake, Loader2, X } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  listDeals, createDeal, addDealDocument, dealLabel,
  DEAL_TYPE_LABEL, DEAL_ROLES, ROLE_LABEL,
  type DealRow, type DealType, type DealBadge,
} from '../../../lib/deals';
import { contractPartyOptions, contactHorseRecords, type PartyOption, type HorseIntakeRecord } from '../../../lib/horses';

/**
 * DEALS (/app/ops/deals) — every transaction the business is party to or
 * facilitating, and the way a new one starts.
 *
 * A deal is a blank named container. Creating one is a single modal that
 * captures only what the container needs — a name, the kind of deal, who is on
 * each side, the horse, and (for a sale) whether the bill of sale stands alone
 * or is accompanied by an agreement. Everything else lives in the documents,
 * which are added from the deal's own page.
 */

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
      onCreated(deal.deal_id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the deal.');
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4"
      role="dialog" aria-modal="true" aria-label="New deal"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full my-8">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-green-800/10">
          <h2 className="font-serif text-green-900 text-lg">New deal</h2>
          <button type="button" aria-label="Close" className="text-muted hover:text-green-800 focus-ring"
            onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
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

          {err && <p role="alert" className="form-error">{err}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-green-800/10">
          <button type="button" className="text-sm text-muted hover:text-green-800 focus-ring px-3 py-2"
            onClick={onClose}>
            Cancel
          </button>
          <button type="button" onClick={() => void create()} disabled={!ready || busy}
            className="px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center gap-2 disabled:opacity-60">
            {busy && <Loader2 size={15} className="animate-spin" />}
            Create deal
          </button>
        </div>
      </div>
    </div>
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
      setErr(e instanceof Error ? e.message : 'Could not load deals.');
      setRows([]);
    });
  }, []);
  useEffect(load, [load]);

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="font-serif text-2xl text-green-900 mb-1">Deals</h1>
          <p className="text-sm text-green-800/70">
            Every sale and lease, and the documents that make each one real.
          </p>
        </div>
        {rows && rows.length > 0 && (
          <button type="button" onClick={() => setCreating(true)}
            className="px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center gap-2 shrink-0">
            <Plus size={15} /> New deal
          </button>
        )}
      </div>

      {err && <p role="alert" className="form-error mb-3">{err}</p>}

      {rows === null ? (
        <p className="body-text text-muted text-sm">Loading deals…</p>
      ) : rows.length === 0 ? (
        <div className="border border-dashed border-green-800/20 rounded-xl py-16 text-center">
          <Handshake size={26} className="mx-auto text-green-700/70 mb-3" />
          <p className="text-sm text-green-900 mb-4">No deals yet.</p>
          <button type="button" onClick={() => setCreating(true)}
            className="px-5 py-2.5 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center gap-2">
            <Plus size={16} /> Create your first deal
          </button>
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

      {creating && (
        <CreateDealModal onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/app/ops/deals/${id}`)} />
      )}
    </div>
  );
}
