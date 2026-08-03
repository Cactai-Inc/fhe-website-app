import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X, FileText, PencilLine } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  dealDetail, addDealMember, removeDealMember, addDealConsideration,
  removeDealConsideration, voidDeal, dealIsConfigured,
  dealDocumentStatus, addDealDocument, dealRecordExport,
  dealCompletionState, completeDeal, reopenDeal,
  DEAL_TYPE_LABEL, ROLE_LABEL, CONSIDERATION_LABEL,
  type DealDetail, type ConsiderationKind, type DealDocumentStatus,
  type DealCompletionState,
} from '../../../lib/deals';
import { contractPartyOptions, staffHorseRecords, type PartyOption, type StaffHorseRecord } from '../../../lib/horses';

/**
 * DEAL (/app/ops/deals/:dealId) — the envelope's own page.
 *
 * The three configuration categories sit at the top, each editable in place:
 * the two sides' members, and what each side is giving. Documents attach below.
 *
 * Nothing is created here (deal plan L2a): people and horses are SELECTED from
 * what is already in the system.
 */

const input = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 focus-ring bg-white';
const KINDS: ConsiderationKind[] = ['PAYMENT', 'GOODS', 'SERVICES', 'HORSE'];

function money(n: number | null): string {
  if (n === null || n === undefined) return '';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

/** One side: its members and what it gives. */
function PartyColumn({
  deal, role, contacts, horses, editing, onChanged, onError,
}: {
  deal: DealDetail; role: string; contacts: PartyOption[]; horses: StaffHorseRecord[];
  editing: boolean; onChanged: () => void; onError: (m: string) => void;
}) {
  const [addingMember, setAddingMember] = useState('');
  const [kind, setKind] = useState<ConsiderationKind>('PAYMENT');
  const [horseId, setHorseId] = useState('');
  const [amount, setAmount] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  const members = deal.parties.filter((p) => p.party_role === role);
  const gives = deal.consideration.filter((c) => c.party_role === role);
  const taken = new Set(deal.parties.map((p) => p.contact_id));

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try { await fn(); onChanged(); }
    catch (e) { onError(e instanceof Error ? e.message : 'That did not work.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="bg-white border border-green-800/10 rounded-xl p-4">
      <h3 className="font-serif text-green-800 text-base mb-2">{ROLE_LABEL[role] ?? role}</h3>

      {/* members */}
      <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-1">Who</p>
      {members.length === 0 && <p className="text-[12px] text-muted mb-1.5">Nobody yet.</p>}
      <ul className="flex flex-col gap-1 mb-2">
        {members.map((m) => (
          <li key={m.contact_id} className="flex items-center gap-2 text-sm text-green-900">
            <span className="flex-1 truncate">{m.name || m.email || m.contact_id}</span>
            {editing && (
              <button type="button" aria-label={`Remove ${m.name ?? 'member'}`} disabled={busy}
                className="text-muted hover:text-red-700 focus-ring"
                onClick={() => void act(() => removeDealMember(deal.id, role, m.contact_id))}>
                <X size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <div className="flex gap-2 mb-3">
          <select className={input} value={addingMember} aria-label={`Add a ${ROLE_LABEL[role] ?? role}`}
            onChange={(e) => setAddingMember(e.target.value)}>
            <option value="">Add someone…</option>
            {contacts.filter((c) => !taken.has(c.id)).map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.email || c.id}</option>
            ))}
          </select>
          <button type="button" className="btn-outline-gold text-xs shrink-0"
            disabled={!addingMember || busy}
            onClick={() => void act(async () => {
              await addDealMember(deal.id, role, addingMember); setAddingMember('');
            })}>
            <Plus size={13} /> Add
          </button>
        </div>
      )}

      {/* consideration */}
      <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-1">Gives</p>
      {gives.length === 0 && <p className="text-[12px] text-muted mb-1.5">Nothing listed yet.</p>}
      <ul className="flex flex-col gap-1 mb-2">
        {gives.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-sm text-green-900">
            <span className="flex-1">
              <span className="text-[11px] text-muted uppercase tracking-wide">{CONSIDERATION_LABEL[c.kind]}</span>
              {' · '}
              {c.kind === 'HORSE'
                ? (c.horse_name ?? 'Horse')
                : [c.amount !== null ? money(c.amount) : null, c.detail].filter(Boolean).join(' — ')}
            </span>
            {editing && (
              <button type="button" aria-label="Remove this entry" disabled={busy}
                className="text-muted hover:text-red-700 focus-ring mt-0.5"
                onClick={() => void act(() => removeDealConsideration(c.id))}>
                <X size={13} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <div className="flex flex-col gap-2">
          <select className={input} value={kind} aria-label="What kind"
            onChange={(e) => setKind(e.target.value as ConsiderationKind)}>
            {KINDS.map((k) => <option key={k} value={k}>{CONSIDERATION_LABEL[k]}</option>)}
          </select>
          {kind === 'HORSE' ? (
            <select className={input} value={horseId} aria-label="Which horse"
              onChange={(e) => setHorseId(e.target.value)}>
              <option value="">Choose a horse…</option>
              {horses.map((h) => (
                <option key={h.id} value={h.id}>{h.nickname || h.registered_name}</option>
              ))}
            </select>
          ) : (
            <>
              {kind === 'PAYMENT' && (
                <input className={input} value={amount} placeholder="Amount"
                  aria-label="Amount" onChange={(e) => setAmount(e.target.value)} />
              )}
              <input className={input} value={detail} aria-label="Description"
                placeholder={kind === 'PAYMENT' ? 'How and when (optional)' : 'Describe what is given'}
                onChange={(e) => setDetail(e.target.value)} />
            </>
          )}
          <button type="button" className="btn-outline-gold text-xs self-start" disabled={busy
            || (kind === 'HORSE' ? !horseId : !(amount.trim() || detail.trim()))}
            onClick={() => void act(async () => {
              await addDealConsideration(deal.id, role, kind, {
                horseId: kind === 'HORSE' ? horseId : undefined,
                amount: kind === 'PAYMENT' && amount.trim()
                  ? Number(amount.replace(/[$,]/g, '')) : undefined,
                detail: detail.trim() || undefined,
              });
              setHorseId(''); setAmount(''); setDetail('');
            })}>
            <Plus size={13} /> Add
          </button>
        </div>
      )}
    </div>
  );
}

export default function DealPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [docStatus, setDocStatus] = useState<DealDocumentStatus[]>([]);
  const [contacts, setContacts] = useState<PartyOption[]>([]);
  const [horses, setHorses] = useState<StaffHorseRecord[]>([]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [record, setRecord] = useState<string | null>(null);
  const [completion, setCompletion] = useState<DealCompletionState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useDocumentTitle(deal ? `${DEAL_TYPE_LABEL[deal.deal_type]} deal` : 'Deal');

  const load = useCallback(() => {
    if (!dealId) return;
    dealDetail(dealId).then(setDeal)
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not load this deal.'));
    dealDocumentStatus(dealId).then(setDocStatus).catch(() => setDocStatus([]));
    dealCompletionState(dealId).then(setCompletion).catch(() => setCompletion(null));
  }, [dealId]);

  /** Prepare a document on this deal, then open it for filling. */
  const addDoc = useCallback(async (templateKey: string, posture?: 'YES' | 'NO') => {
    if (!dealId) return;
    setAdding(true); setErr(null);
    try {
      const out = await addDealDocument(dealId, templateKey, posture);
      navigate(`/app/contracts/${out.document_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not prepare that document.');
      setAdding(false);
    }
  }, [dealId, navigate]);
  useEffect(load, [load]);
  useEffect(() => {
    contractPartyOptions().then(setContacts).catch(() => setContacts([]));
    staffHorseRecords().then(setHorses).catch(() => setHorses([]));
  }, []);

  if (err && !deal) return <p role="alert" className="form-error">{err}</p>;
  if (!deal) return <p className="body-text text-muted text-sm">Loading the deal…</p>;

  const [roleA, roleB] = deal.roles;
  const configured = dealIsConfigured(deal);
  const isPending = deal.status === 'pending';

  return (
    <div className="max-w-5xl">
      <Link to="/app/ops/deals"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Deals
      </Link>

      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="font-serif text-2xl text-green-900">
          {DEAL_TYPE_LABEL[deal.deal_type]} deal
        </h1>
        <span className="text-[11px] text-muted mt-2">{deal.display_code}</span>
      </div>
      <p className="text-sm text-green-800/70 mb-4">
        {deal.status === 'pending' ? 'Pending — still being put together.'
          : deal.status === 'complete' ? 'Complete.' : 'Void.'}
      </p>

      {err && <p role="alert" className="form-error mb-3">{err}</p>}

      {/* the three configuration categories, editable in place */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif text-green-800 text-base">Who and what</h2>
        {isPending && (
          <button type="button" className="btn-outline-gold text-xs"
            onClick={() => setEditing((v) => !v)}>
            <PencilLine size={13} /> {editing ? 'Done editing' : 'Edit'}
          </button>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mb-5">
        <PartyColumn deal={deal} role={roleA} contacts={contacts} horses={horses}
          editing={editing && isPending} onChanged={load} onError={setErr} />
        <PartyColumn deal={deal} role={roleB} contacts={contacts} horses={horses}
          editing={editing && isPending} onChanged={load} onError={setErr} />
      </div>

      {/* documents */}
      <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
        <h2 className="font-serif text-green-800 text-base mb-1">Documents</h2>
        {!configured && (
          <p className="text-[12px] text-gold-900 bg-gold-50 border border-gold-600/40 rounded-lg px-3 py-2 mb-3">
            Add at least one person and one thing given on each side before
            documents can be prepared.
          </p>
        )}

        {deal.documents.length === 0 ? (
          <p className="text-[12px] text-muted mb-3">No documents yet.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 mb-3">
            {deal.documents.map((d) => (
              <li key={d.document_id}>
                <Link to={`/app/contracts/${d.document_id}`}
                  className="flex items-center gap-2.5 text-sm text-green-900 hover:text-green-700 focus-ring">
                  <FileText size={14} className="text-green-700 shrink-0" />
                  <span className="flex-1 truncate">{d.title ?? d.template_key}</span>
                  <span className="text-[11px] text-muted">{d.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* what this deal type needs, and what it has */}
        {docStatus.length > 0 && (
          <ul className="flex flex-col gap-1 mb-3">
            {docStatus.map((s) => (
              <li key={s.template_key} className="text-[11.5px] text-muted">
                <span className={s.present ? 'text-green-800' : ''}>
                  {s.present ? '✓' : '○'} {s.title}
                </span>
                {' — '}{s.required ? 'required' : 'optional'}
                {s.executed ? ' · signed' : ''}
              </li>
            ))}
          </ul>
        )}

        {isPending && configured && (
          <div className="flex flex-wrap gap-2 items-center border-t border-green-800/10 pt-3">
            {docStatus.filter((s) => !s.present).map((s) => (
              s.template_key === 'HORSE_BILL_OF_SALE' ? (
                /* the two postures (L17): the bill of sale alone IS the contract,
                   or it accompanies the sale agreement and defers to it. */
                <span key={s.template_key} className="flex flex-wrap gap-2">
                  <button type="button" className="btn-outline-gold text-xs" disabled={adding}
                    onClick={() => void addDoc(s.template_key, 'NO')}>
                    <Plus size={13} /> Bill of sale (stands alone)
                  </button>
                  <button type="button" className="btn-outline-gold text-xs" disabled={adding}
                    onClick={() => void addDoc(s.template_key, 'YES')}>
                    <Plus size={13} /> Bill of sale + sale agreement
                  </button>
                </span>
              ) : (
                <button key={s.template_key} type="button" className="btn-outline-gold text-xs"
                  disabled={adding} onClick={() => void addDoc(s.template_key)}>
                  <Plus size={13} /> {s.title}
                </button>
              )
            ))}
            {docStatus.every((s) => s.present) && (
              <p className="text-[12px] text-muted">Every document this deal needs has been prepared.</p>
            )}
          </div>
        )}
      </section>

      {/* completion — PENDING until the requirements are met, then COMPLETE.
          It settles itself when the last required document is signed; this card
          shows what is outstanding and offers the manual path. */}
      <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-green-800 text-base">
              {deal.status === 'complete' ? 'Complete' : deal.status === 'void' ? 'Void' : 'Still to do'}
            </h2>
            {deal.status === 'complete' ? (
              <p className="text-[12px] text-muted">
                Finished{deal.completed_at ? ` on ${new Date(deal.completed_at).toLocaleDateString()}` : ''}.
                Nothing on a complete deal can be changed.
              </p>
            ) : completion && completion.outstanding.length === 0 ? (
              <p className="text-[12px] text-muted">Everything is done — this deal can be completed.</p>
            ) : (
              <ul className="text-[12px] text-muted mt-1 flex flex-col gap-0.5">
                {(completion?.outstanding ?? []).map((o) => <li key={o}>• {o}</li>)}
              </ul>
            )}
          </div>
          {isPending && completion?.can_complete && (
            <button type="button" className="btn-primary text-xs shrink-0" disabled={adding}
              onClick={() => void completeDeal(deal.id).then(() => load())
                .catch((e) => setErr(e instanceof Error ? e.message : 'Could not complete the deal.'))}>
              Complete this deal
            </button>
          )}
          {deal.status === 'complete' && (
            <button type="button" className="btn-outline-gold text-xs shrink-0"
              onClick={() => {
                if (!window.confirm('Reopen this deal so it can be changed?')) return;
                void reopenDeal(deal.id).then((r) => { if (r.message) setErr(r.message); load(); })
                  .catch((e) => setErr(e instanceof Error ? e.message : 'Could not reopen the deal.'));
              }}>
              Reopen
            </button>
          )}
        </div>
      </section>

      {/* the deal record — generated, never authored (L7) */}
      <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-green-800 text-base">Deal record</h2>
            <p className="text-[12px] text-muted">
              A summary of this deal, produced from what it holds — nobody fills it in.
            </p>
          </div>
          <button type="button" className="btn-outline-gold text-xs shrink-0"
            onClick={() => void dealRecordExport(deal.id).then(setRecord)
              .catch((e) => setErr(e instanceof Error ? e.message : 'Could not build the record.'))}>
            <FileText size={13} /> {record ? 'Refresh' : 'Show'}
          </button>
        </div>
        {record && (
          <pre className="mt-3 whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-green-950 bg-cream-100/50 border border-green-800/10 rounded p-3">
            {record}
          </pre>
        )}
      </section>

      {isPending && (
        <button type="button" className="text-xs text-red-700 hover:underline focus-ring"
          onClick={() => {
            if (!window.confirm('Void this deal? Any signed documents in it are kept.')) return;
            void voidDeal(deal.id).then(load)
              .catch((e) => setErr(e instanceof Error ? e.message : 'Could not void the deal.'));
          }}>
          Void this deal
        </button>
      )}
    </div>
  );
}
