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
  listDocuments, templateReassignmentCandidates, requireDocumentFromAll,
  type ReassignmentCandidate,
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
 * WHO OWES THE CURRENT VERSION.
 *
 * When a document's wording changes, everyone who signed the old text has
 * consented to something different. Until now the only control was assigning
 * documents to one person at a time from their client page — there was no way to
 * see, let alone act on, "the wording changed, who needs to re-sign?".
 *
 * Requiring a document does NOT email anyone or interrupt them mid-task: it
 * becomes a gating obligation, so the next time they sign in they are routed
 * through the normal flow — intake pre-filled from what we hold, edit or
 * continue, sign, into the app.
 */
function ReassignmentPanel() {
  const [rows, setRows] = useState<ReassignmentCandidate[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, number>>({});
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    templateReassignmentCandidates()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  if (!rows || rows.length === 0) return null;

  async function requireAll(key: string) {
    setBusy(key); setErr(null);
    try {
      const n = await requireDocumentFromAll(key);
      setDone((d) => ({ ...d, [key]: n }));
      load();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not require that document.'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-8 rounded-xl border border-gold-600/40 bg-gold-50 p-4">
      <p className="text-sm font-medium text-gold-900 mb-1">Documents people still owe</p>
      <p className="text-[12.5px] text-gold-900/85 mb-3">
        These have people who signed an older version, or never signed at all.
        Requiring one gates those accounts until they re-sign — they are taken
        through the normal flow with their details already filled in.
      </p>
      {err && <p role="alert" className="form-error mb-2">{err}</p>}
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.template_key} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-green-900">{r.title}</span>
            <span className="text-[11.5px] text-muted">
              v{r.current_version}
              {r.people_out_of_date > 0 && ` · ${r.people_out_of_date} on an older version`}
              {r.people_never_signed > 0 && ` · ${r.people_never_signed} never signed`}
            </span>
            <span className="ml-auto">
              {done[r.template_key] !== undefined ? (
                <span className="text-[11.5px] text-green-800 font-medium">
                  Required from {done[r.template_key]}
                </span>
              ) : (
                <button type="button" disabled={busy === r.template_key}
                  onClick={() => void requireAll(r.template_key)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-green-800/25 text-green-800 hover:bg-green-800/10 focus-ring disabled:opacity-50">
                  {busy === r.template_key ? 'Requiring…' : 'Require from everyone'}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
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

      <ReassignmentPanel />

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
