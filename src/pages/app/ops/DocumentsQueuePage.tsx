/**
 * OPS-DOCS-QUEUE — Documents work-queue (surface `ops`, module `core`).
 *
 * Staff opens /app/ops/documents-queue → every in-tenant document across all
 * engagements, filterable by status (DRAFT / SENT / EXECUTED / …) and sorted by
 * generated_at. Each row links into the OPS-DOC-VIEW viewer/signing surface at
 * /app/ops/documents/:id. Backs OPS-DASH's documents tile.
 *
 * Real data path: `listDocuments()` (INT-API-CORE → supabase.from('documents'),
 * RLS org-scoped — staff sees all in-tenant documents; a client would see only
 * their own). The status filter narrows the fetched set; changing it re-runs
 * the load so the observable query re-fires. Loading / empty / error / success
 * branches all render — errors are surfaced, never swallowed.
 */
import { useCallback, useEffect, useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import {
  listDocuments,
  pendingVersionDecisions, resolveVersionDecision, templatePastSigners,
  type PendingVersionDecision, type PastSigner,
} from '../../../lib/api';
import type { DocumentRow } from '../../../lib/ops/types';
import { EmptyState } from '../../../lib/ops';
import {
  DocumentQueueTable,
  type QueueStatusFilter,
} from '../../../components/ops/documents/DocumentQueueTable';

/** Narrow the in-tenant document set to the selected status (`ALL` = no filter). */
function filterByStatus(documents: DocumentRow[], status: QueueStatusFilter): DocumentRow[] {
  if (status === 'ALL') return documents;
  return documents.filter((doc) => doc.status === status);
}

/**
 * VERSION-BUMP DECISION.
 *
 * When a template's version changes, the people who already signed consented to
 * DIFFERENT wording. A trigger records each bump as an unresolved event, and this
 * is where it gets answered — the owner's three choices:
 *
 *   Everyone      every past signer must re-sign
 *   Choose who    pick the subset (e.g. exclude someone mid-onboarding)
 *   No one        recorded, not merely dismissed — deciding nobody re-signs is a
 *                 real decision and should be auditable
 *
 * Requiring does not email or interrupt anyone. It adds a gating obligation, so
 * at their next sign-in they are routed through the normal flow: intake
 * pre-filled from what we hold, edit or continue, sign, into the app.
 */
function VersionDecisions() {
  const [rows, setRows] = useState<PendingVersionDecision[] | null>(null);
  const [picking, setPicking] = useState<PendingVersionDecision | null>(null);
  const [signers, setSigners] = useState<PastSigner[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    pendingVersionDecisions().then(setRows).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  async function answer(ev: PendingVersionDecision, res: 'ALL' | 'NONE') {
    setBusy(true); setErr(null);
    try {
      await resolveVersionDecision(ev.id, res);
      setPicking(null);
      load();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not record that decision.'));
    } finally { setBusy(false); }
  }

  async function openPicker(ev: PendingVersionDecision) {
    setPicking(ev); setSigners(null); setErr(null);
    try {
      const list = await templatePastSigners(ev.template_key);
      setSigners(list);
      // Default to everyone selected: the common case is "all but one".
      setChosen(new Set(list.map((s) => s.contact_id)));
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not load past signers.'));
      setSigners([]);
    }
  }

  async function confirmSelected() {
    if (!picking) return;
    setBusy(true); setErr(null);
    try {
      await resolveVersionDecision(picking.id, 'SELECTED', Array.from(chosen));
      setPicking(null);
      load();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not record that decision.'));
    } finally { setBusy(false); }
  }

  if (!rows || rows.length === 0) return null;

  return (
    <div className="mb-8 rounded-xl border border-gold-600/40 bg-gold-50 p-4">
      <p className="text-sm font-medium text-gold-900 mb-1">
        {rows.length} document {rows.length === 1 ? 'version needs' : 'versions need'} a decision
      </p>
      <p className="text-[12.5px] text-gold-900/85 mb-3">
        The wording changed. Anyone who signed the previous version agreed to
        different text — choose who should sign again.
      </p>
      {err && <p role="alert" className="form-error mb-2">{err}</p>}

      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.id} className="bg-white/70 rounded-lg px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-green-900 font-medium">{r.title}</span>
              <span className="text-[11.5px] text-muted">
                v{r.from_version ?? 0} → v{r.to_version}
                {` · ${r.past_signers} signed the older version`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button type="button" disabled={busy || r.past_signers === 0}
                onClick={() => void answer(r, 'ALL')}
                className="text-[11px] px-2.5 py-1 rounded-full bg-green-800 text-white hover:bg-green-700 focus-ring disabled:opacity-40">
                Everyone re-signs
              </button>
              <button type="button" disabled={busy || r.past_signers === 0}
                onClick={() => void openPicker(r)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-green-800/25 text-green-800 hover:bg-green-800/10 focus-ring disabled:opacity-40">
                Choose who
              </button>
              <button type="button" disabled={busy}
                onClick={() => void answer(r, 'NONE')}
                className="text-[11px] px-2.5 py-1 rounded-full border border-green-800/20 text-muted hover:bg-green-800/5 focus-ring disabled:opacity-40">
                No one
              </button>
            </div>
          </div>
        ))}
      </div>

      {picking && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-green-950/40 px-4"
          role="dialog" aria-modal="true" aria-labelledby="vd-heading">
          <div className="bg-white rounded-2xl border border-green-800/10 p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <h2 id="vd-heading" className="font-serif text-lg text-green-800 mb-1">
              Who should re-sign {picking.title}?
            </h2>
            <p className="text-[12.5px] text-muted mb-4">
              Everyone below signed v{picking.from_version ?? 0} or earlier. Unticking
              someone leaves their existing signature in place.
            </p>
            {signers === null ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : signers.length === 0 ? (
              <p className="text-sm text-muted">Nobody has signed an older version.</p>
            ) : (
              <div className="flex flex-col gap-1.5 mb-4">
                {signers.map((s) => (
                  <label key={s.contact_id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-green-800/12 cursor-pointer hover:bg-green-50/50">
                    <input type="checkbox" className="accent-green-700 w-[17px] h-[17px]"
                      checked={chosen.has(s.contact_id)}
                      onChange={() => setChosen((prev) => {
                        const n = new Set(prev);
                        if (n.has(s.contact_id)) n.delete(s.contact_id); else n.add(s.contact_id);
                        return n;
                      })} />
                    <span className="min-w-0">
                      <span className="block text-sm text-green-900">{s.name}</span>
                      <span className="block text-[11px] text-muted">
                        signed v{s.signed_version ?? 0}
                        {s.already_required && ' · already required'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary text-sm" disabled={busy}
                onClick={() => setPicking(null)}>Cancel</button>
              <button type="button" className="btn-primary text-sm"
                disabled={busy || chosen.size === 0}
                onClick={() => void confirmSelected()}>
                {busy ? 'Saving…' : `Require from ${chosen.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DocumentsQueuePage() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Re-fetch the in-tenant documents. Keyed off statusFilter so a filter
   *  change re-fires the query; the status then narrows the rendered rows. */
  const load = useCallback((status: QueueStatusFilter) => {
    let active = true;
    setLoading(true);
    setError(null);
    listDocuments()
      .then((rows) => {
        if (active) setDocuments(filterByStatus(rows, status));
      })
      .catch((err: unknown) => {
        if (active) setError(toErrorMessage(err, 'Could not load documents.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => load(statusFilter), [load, statusFilter]);

  return (
    <div className="max-w-5xl">
      <Helmet>
        <title>Documents — Work queue</title>
      </Helmet>
      <p className="eyebrow mb-2">Ops</p>
      <div className="flex items-center justify-between mb-8">
        <h1 className="heading-section text-green-800">Documents</h1>
        <Link to="/app/ops/contracts/new"
          className="px-4 py-2 rounded-lg bg-green-800 text-white text-sm font-medium hover:bg-green-700 focus-ring">
          + New contract
        </Link>
      </div>

      <VersionDecisions />

      {error ? (
        <div role="alert" className="py-8">
          <EmptyState title="Could not load documents" message={error} />
        </div>
      ) : (
        <DocumentQueueTable
          documents={documents}
          loading={loading}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
        />
      )}
    </div>
  );
}
