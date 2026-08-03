import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Handshake, Loader2 } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  listDeals, createDeal, DEAL_TYPE_LABEL, DEAL_ROLES, ROLE_LABEL,
  type DealRow, type DealType,
} from '../../../lib/deals';
import { contractPartyOptions, type PartyOption } from '../../../lib/horses';

/**
 * DEALS (/app/ops/deals) — the deal is the top-level envelope a transaction
 * lives in; this is its own surface, not a view inside documents or contracts.
 *
 * Creating one follows the fixed order: TYPE first (it labels the two sides),
 * then a person on each side. Everything else — more members, consideration,
 * documents — happens on the deal page afterwards.
 *
 * Nothing is created here: people are SELECTED from existing contacts.
 */

const input = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 focus-ring bg-white';

function NewDealCard({ onCreated }: { onCreated: (id: string) => void }) {
  const [dealType, setDealType] = useState<DealType | ''>('');
  const [contacts, setContacts] = useState<PartyOption[]>([]);
  const [partyA, setPartyA] = useState('');
  const [partyB, setPartyB] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    contractPartyOptions().then(setContacts).catch(() => setContacts([]));
  }, []);
  // the type labels the sides, so changing it clears selections made under the old labels
  useEffect(() => { setPartyA(''); setPartyB(''); }, [dealType]);

  const roles = dealType ? DEAL_ROLES[dealType] : null;
  const ready = !!dealType && !!partyA && !!partyB;

  async function create() {
    if (!ready || !dealType) return;
    setBusy(true); setErr(null);
    try {
      const out = await createDeal(dealType, [partyA], [partyB]);
      onCreated(out.deal_id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the deal.');
    } finally { setBusy(false); }
  }

  const picker = (value: string, onChange: (v: string) => void, label: string) => (
    <select className={input} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">Choose…</option>
      {contacts.map((c) => (
        <option key={c.id} value={c.id}>{c.name || c.email || c.id}</option>
      ))}
    </select>
  );

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-5">
      <h2 className="font-serif text-green-800 text-base mb-1">New deal</h2>
      <p className="text-[12px] text-muted mb-3">
        Pick the kind of deal first — it decides what each side is called. Then choose
        one person per side; you can add more people, what each side is giving, and the
        documents on the next screen.
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <span className="form-label">Deal type</span>
          <select className={input} value={dealType} aria-label="Deal type"
            onChange={(e) => setDealType(e.target.value as DealType | '')}>
            <option value="">Choose…</option>
            {(Object.keys(DEAL_TYPE_LABEL) as DealType[]).map((t) => (
              <option key={t} value={t}>{DEAL_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="form-label">{roles ? ROLE_LABEL[roles[0]] : 'First party'}</span>
          {roles ? picker(partyA, setPartyA, ROLE_LABEL[roles[0]])
                 : <p className="text-[12px] text-muted pt-2">Choose a deal type first.</p>}
        </div>
        <div>
          <span className="form-label">{roles ? ROLE_LABEL[roles[1]] : 'Second party'}</span>
          {roles ? picker(partyB, setPartyB, ROLE_LABEL[roles[1]])
                 : <p className="text-[12px] text-muted pt-2">&nbsp;</p>}
        </div>
      </div>

      <p className="text-[11.5px] text-muted mt-2">
        Someone missing? People are added on their own record first —{' '}
        <Link to="/app/ops/accounts/new" className="underline">create the account</Link>, then come back.
      </p>

      {err && <p role="alert" className="form-error mt-2">{err}</p>}

      <button type="button" onClick={() => void create()} disabled={!ready || busy}
        className="mt-3 px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring inline-flex items-center gap-2 disabled:opacity-60">
        {busy && <Loader2 size={15} className="animate-spin" />}
        <Plus size={15} /> Start the deal
      </button>
    </section>
  );
}

export default function DealsPage() {
  useDocumentTitle('Deals');
  const navigate = useNavigate();
  const [rows, setRows] = useState<DealRow[] | null>(null);
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
      <h1 className="font-serif text-2xl text-green-900 mb-1">Deals</h1>
      <p className="text-sm text-green-800/70 mb-4">
        Every transaction lives in a deal: who is on each side, what each side is
        giving, and the documents that make it real.
      </p>

      <NewDealCard onCreated={(id) => navigate(`/app/ops/deals/${id}`)} />

      {err && <p role="alert" className="form-error mb-3">{err}</p>}

      {rows === null ? (
        <p className="body-text text-muted text-sm">Loading deals…</p>
      ) : rows.length === 0 ? (
        <div className="bg-cream-100/60 border border-green-800/10 rounded-xl p-8 text-center">
          <Handshake size={22} className="mx-auto text-green-700 mb-2" />
          <p className="text-sm text-green-900">No deals yet.</p>
          <p className="text-[12px] text-muted mt-1">Start one above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((d) => (
            <Link key={d.id} to={`/app/ops/deals/${d.id}`}
              className="flex items-center gap-3 bg-white border border-green-800/10 rounded-xl px-4 py-3 hover:border-green-800/25 focus-ring">
              <span className="w-9 h-9 rounded-lg bg-cream-100 text-green-700 grid place-items-center shrink-0">
                <Handshake size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-green-900 truncate">
                  {DEAL_TYPE_LABEL[d.deal_type]}
                  {d.horse_summary ? ` — ${d.horse_summary}` : ''}
                </span>
                <span className="block text-[11.5px] text-muted truncate">
                  {d.party_summary || 'No parties yet'}
                  {' · '}{d.document_count} document{d.document_count === 1 ? '' : 's'}
                </span>
              </span>
              <span className="text-[11px] text-muted shrink-0">{d.display_code}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${
                d.status === 'complete' ? 'bg-green-800/10 text-green-800'
                  : d.status === 'void' ? 'bg-red-50 text-red-700'
                    : 'bg-gold-50 text-gold-900'}`}>
                {d.status === 'pending' ? 'Pending' : d.status === 'complete' ? 'Complete' : 'Void'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
