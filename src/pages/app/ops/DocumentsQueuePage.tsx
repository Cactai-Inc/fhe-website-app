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
import { Helmet } from 'react-helmet-async';
import { listDocuments } from '../../../lib/api';
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
        if (active) setError(err instanceof Error ? err.message : 'Could not load documents.');
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
      <h1 className="heading-section text-green-800 mb-8">Documents</h1>

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
