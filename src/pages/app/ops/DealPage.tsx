import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, PencilLine, Loader2, Printer, Download, Mail } from 'lucide-react';
import { PageLayout } from '../../../components/app/PageLayout';
import { useDocumentTitle } from '../../../lib/hooks';
import { Modal } from '../../../components/ops/kit/Modal';
import { toErrorMessage } from '../../../lib/ops/errors';
import {
  dealDetail, dealDocumentStatus, addDealDocument, dealRecordExport, dealActivity,
  updateDeal, voidDeal, dealLabel,
  DEAL_TYPE_LABEL, ROLE_LABEL,
  type DealDetail, type DealDocumentStatus, type DealActivityEntry,
} from '../../../lib/deals';
import { DealBadgePill } from './DealsPage';

/**
 * DEAL (/app/ops/deals/:dealId) — the container's own page.
 *
 * A deal holds documents; everything it reports is derived from them. The page
 * is therefore document-first: what is in the deal, and the button that adds
 * another. The deal record is a MODAL, not a card — it is something you produce
 * and send, not something you scroll past.
 */

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** The deal record: produced, not authored. Download / email / print live here. */
function DealRecordModal({ dealId, name, onClose }: {
  dealId: string; name: string; onClose: () => void;
}) {
  const [body, setBody] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    dealRecordExport(dealId).then(setBody)
      .catch((e) => setErr(toErrorMessage(e, 'Could not build the record.')));
  }, [dealId]);

  function download() {
    if (!body) return;
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${name.replace(/[^\w-]+/g, '_')}_deal_record.txt`;
    a.click(); URL.revokeObjectURL(url);
  }
  function print() {
    if (!body) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<pre style="font:13px/1.6 ui-sans-serif,system-ui;padding:2rem">${
      body.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] ?? c))}</pre>`);
    w.document.close(); w.print();
  }

  return (
    /* ⚠️ TASK-FIX4 §3 — converged. A generated record with nothing typed into it,
       so click-out still closes it. */
    <Modal open onClose={onClose} title="Deal record" size="lg" error={err}
      footer={
        <>
          <button type="button" className="btn-outline-gold text-xs" onClick={download} disabled={!body}>
            <Download size={13} /> Download
          </button>
          <a className="btn-outline-gold text-xs"
            href={`mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(body ?? '')}`}>
            <Mail size={13} /> Email
          </a>
          <button type="button" className="btn-outline-gold text-xs" onClick={print} disabled={!body}>
            <Printer size={13} /> Print
          </button>
        </>
      }>
        {body === null && !err && <p className="text-sm text-muted">Building the record…</p>}
        {body && (
          <pre className="whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-green-950">
            {body}
          </pre>
        )}
    </Modal>
  );
}

export default function DealPage() {
  const { dealId } = useParams<{ dealId: string }>();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [docStatus, setDocStatus] = useState<DealDocumentStatus[]>([]);
  const [activity, setActivity] = useState<DealActivityEntry[]>([]);
  const [recordOpen, setRecordOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useDocumentTitle(deal ? dealLabel(deal) : 'Deal');

  const load = useCallback(() => {
    if (!dealId) return;
    dealDetail(dealId).then((d) => { setDeal(d); setTitleDraft(d.title ?? ''); })
      .catch((e) => setErr(toErrorMessage(e, 'Could not load this deal.')));
    dealDocumentStatus(dealId).then(setDocStatus).catch(() => setDocStatus([]));
    dealActivity(dealId).then(setActivity).catch(() => setActivity([]));
  }, [dealId]);
  useEffect(load, [load]);

  const addDoc = useCallback(async (templateKey: string, posture?: 'YES' | 'NO') => {
    if (!dealId) return;
    setAdding(true); setErr(null);
    try {
      const out = await addDealDocument(dealId, templateKey, posture);
      navigate(`/app/contracts/${out.document_id}`);
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not add that document.'));
      setAdding(false);
    }
  }, [dealId, navigate]);

  const rename = useCallback(() => {
    if (!deal) return;
    void updateDeal(deal.id, { title: titleDraft })
      .then(() => { setRenaming(false); load(); })
      .catch((x) => setErr(toErrorMessage(x, 'Could not rename this deal.')));
  }, [deal, titleDraft, load]);

  if (err && !deal) return <p role="alert" className="form-error">{err}</p>;
  if (!deal) return <p className="body-text text-muted text-sm">Loading the deal…</p>;

  const name = dealLabel(deal);
  const canAdd = deal.status === 'pending';
  const addable = docStatus.filter((s) => !s.present);

  return (
    <PageLayout name="Deal" width="wide">
      <Link to="/app/records/deals"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-green-800 mb-4">
        <ArrowLeft size={14} /> Deals
      </Link>

      {/* the deal's own identity: its name, badges, and the record. This is
          CONTENT, not the page header — a deal's name is data, not a page
          title, and the rename control has to be a real element, which
          PageHeader's title slot (string-only) cannot carry. */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input className="px-3 py-1.5 rounded-lg border border-green-800/15 text-lg text-green-900 focus-ring bg-white"
                value={titleDraft} autoFocus aria-label="Deal name"
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') rename();
                  if (e.key === 'Escape') { setTitleDraft(deal.title ?? ''); setRenaming(false); }
                }} />
              <button type="button" className="btn-outline-gold text-xs" onClick={rename}>Save</button>
            </div>
          ) : (
            <h1 className="font-serif text-2xl text-green-900 truncate flex items-center gap-2">
              {name}
              <button type="button" aria-label="Rename this deal"
                className="text-muted hover:text-green-800 focus-ring"
                onClick={() => setRenaming(true)}>
                <PencilLine size={14} />
              </button>
            </h1>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-800/10 text-green-800">
              {DEAL_TYPE_LABEL[deal.deal_type]}
            </span>
            <DealBadgePill badge={deal.badge} />
            <span className="text-[11.5px] text-muted">
              Created {fmtDate(deal.created_at)}
              {deal.completed_at ? ` · Completed ${fmtDate(deal.completed_at)}` : ''}
            </span>
            <span className="text-[11px] text-muted">{deal.display_code}</span>
          </div>
        </div>
        <button type="button" className="btn-outline-gold text-xs shrink-0"
          onClick={() => setRecordOpen(true)}>
          <FileText size={13} /> Deal record
        </button>
      </div>

      {err && <p role="alert" className="form-error my-3">{err}</p>}

      {/* who is in it */}
      <section className="mt-5 mb-4">
        <div className="grid sm:grid-cols-2 gap-3">
          {deal.roles.map((role) => (
            <div key={role} className="bg-white border border-green-800/10 rounded-xl px-4 py-3">
              <p className="text-[10.5px] tracking-wide uppercase text-muted font-semibold mb-1">
                {ROLE_LABEL[role] ?? role}
              </p>
              {deal.parties.filter((p) => p.party_role === role).length === 0 ? (
                <p className="text-[12px] text-muted">Nobody named.</p>
              ) : deal.parties.filter((p) => p.party_role === role).map((p) => (
                <p key={p.contact_id} className="text-sm text-green-900 truncate">
                  {p.name || p.email || p.contact_id}
                </p>
              ))}
            </div>
          ))}
        </div>
        {deal.horse && (
          <p className="text-[12px] text-muted mt-2">
            Horse:{' '}
            <Link to={`/app/horses/${deal.horse.id}`} className="underline hover:text-green-800">
              {deal.horse.name}
            </Link>
          </p>
        )}
      </section>

      {/* the documents — the substance of the deal */}
      <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="font-serif text-green-800 text-base">Deal documents</h2>
          {canAdd && addable.length > 0 && (
            <div className="flex gap-1.5 flex-wrap justify-end">
              {addable.map((s) => (
                <button key={s.template_key} type="button" className="btn-outline-gold text-xs"
                  disabled={adding}
                  onClick={() => void addDoc(s.template_key,
                    s.template_key === 'HORSE_BILL_OF_SALE' ? 'NO' : undefined)}>
                  {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  {' '}{s.title}
                </button>
              ))}
            </div>
          )}
        </div>

        {deal.documents.length === 0 ? (
          <p className="text-[12px] text-muted">No documents yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-green-800/10">
            {deal.documents.map((d) => (
              <li key={d.document_id}>
                <Link to={`/app/contracts/${d.document_id}`}
                  className="flex items-center gap-3 py-2.5 hover:bg-cream-100/40 focus-ring rounded">
                  <FileText size={15} className="text-green-700 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-green-900 truncate">
                      {d.title ?? d.template_key}
                      {d.governing && (
                        <span className="text-[10.5px] text-muted ml-2">decides the deal</span>
                      )}
                    </span>
                    <span className="block text-[11px] text-muted">
                      {d.display_code} · {fmtDate(d.created_at)}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted whitespace-nowrap">
                    {d.status === 'EXECUTED' ? 'Complete'
                      : d.signed > 0 ? `Signed ${d.signed}/${d.signers}` : 'Editable'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* activity — who did what, when */}
      {activity.length > 0 && (
        <section className="bg-white border border-green-800/10 rounded-xl p-4 mb-4">
          <h2 className="font-serif text-green-800 text-base mb-2">Activity</h2>
          <ul className="flex flex-col gap-1.5">
            {activity.map((a, i) => (
              <li key={`${a.at}-${i}`} className="text-[12.5px] text-green-900 flex gap-2">
                <span className="text-muted whitespace-nowrap">{fmtWhen(a.at)}</span>
                <span className="flex-1">
                  <span className="font-medium">{a.who}</span> — {a.what}
                  {a.detail ? <span className="text-muted"> · {a.detail}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {deal.status === 'pending' && (
        <button type="button" className="text-xs text-red-700 hover:underline focus-ring"
          onClick={() => {
            if (!window.confirm('Void this deal? Signed documents inside it are kept.')) return;
            void voidDeal(deal.id).then(load)
              .catch((e) => setErr(toErrorMessage(e, 'Could not void the deal.')));
          }}>
          Void this deal
        </button>
      )}

      {recordOpen && (
        <DealRecordModal dealId={deal.id} name={name} onClose={() => setRecordOpen(false)} />
      )}
    </PageLayout>
  );
}
