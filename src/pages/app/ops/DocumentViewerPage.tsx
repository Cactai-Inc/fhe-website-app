import { useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { getDocument, listSignatures } from '../../../lib/api';
import type { DocumentRow, Signature } from '../../../lib/ops/types';
import { DataTable, EmptyState, StatusBadge, useAsync } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import { MergedBodyView } from '../../../components/ops/documents/MergedBodyView';
import { SigningPanel } from '../../../components/ops/documents/SigningPanel';
import { DeliveryPanel } from '../../../components/ops/documents/DeliveryPanel';

/** getDocument(id) + listSignatures(id): the read-only viewer's data path.
 *  Both reads are RLS org-scoped (staff sees all in-tenant; a client sees only
 *  documents they own via caller_owns_document). Fetched together so the roster
 *  and body land in one render. */
async function loadDocumentView(
  id: string,
): Promise<{ document: DocumentRow | null; signatures: Signature[] }> {
  const [document, signatures] = await Promise.all([
    getDocument(id),
    listSignatures(id),
  ]);
  return { document, signatures };
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

const SIGNATURE_COLUMNS: Column<Signature>[] = [
  {
    key: 'party_role',
    header: 'Party',
    render: (s) => <span className="font-medium text-green-900">{s.party_role}</span>,
  },
  {
    key: 'typed_name',
    header: 'Signed by',
    render: (s) => <span>{s.typed_name ?? '—'}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    render: (s) =>
      s.signed_at ? (
        <StatusBadge status="Signed" tone="success" />
      ) : (
        <StatusBadge status="Pending" tone="warning" />
      ),
  },
  {
    key: 'signed_at',
    header: 'Signed on',
    render: (s) => <span>{formatDate(s.signed_at)}</span>,
  },
];

const EXECUTED_STATUS = 'EXECUTED';

/**
 * OPS-DOC-VIEW — Merged-contract viewer + lifecycle host. Staff opens
 * `/app/ops/documents/:id` and sees the read-only merged body, title, status
 * and effective date, plus the document's lifecycle sections on the SAME page
 * (no separate routes):
 *   - while the document is NOT yet EXECUTED, the assisted-signing panel
 *     (OPS-DOC-SIGN) is embedded; when the last party signs, `onExecuted`
 *     re-runs the document load so the fresh EXECUTED status renders,
 *   - once EXECUTED, the roster renders read-only and the delivery panel
 *     (OPS-DOC-DELIVER) appears so staff can record/send copies.
 *
 * The merged body itself stays read-only — mutations happen only through the
 * embedded panels' real RPC seams (record_signature / document_deliveries).
 */
export default function DocumentViewerPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isPending, isError, run } = useAsync(loadDocumentView);

  const load = useCallback(() => {
    if (id) void run(id).catch(() => {});
  }, [id, run]);

  useEffect(() => {
    load();
  }, [load]);

  if (isPending || (!data && !isError)) {
    return (
      <div className="py-16 text-center text-sm text-green-800/70" data-testid="viewer-loading">
        Loading document…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-16" data-testid="viewer-error">
        <EmptyState
          title="Could not load document"
          message={error?.message ?? 'This document is unavailable or you do not have access.'}
        />
      </div>
    );
  }

  const document = data?.document ?? null;
  const signatures = data?.signatures ?? [];
  const isExecuted =
    (document?.status ?? '').trim().toUpperCase() === EXECUTED_STATUS;

  if (!document) {
    return (
      <div className="py-16" data-testid="viewer-not-found">
        <EmptyState
          title="Document not found"
          message="No document matches this link, or it is outside your tenant."
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Helmet>
        <title>{document.title ?? 'Document'} — Viewer</title>
      </Helmet>

      <header className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-serif text-2xl text-green-900">
            {document.title ?? 'Untitled document'}
          </h1>
          <StatusBadge status={document.status} />
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-green-800/80">
          <div className="flex gap-2">
            <dt className="form-label mb-0">Effective date</dt>
            <dd>{formatDate(document.effective_date)}</dd>
          </div>
          {document.display_code && (
            <div className="flex gap-2">
              <dt className="form-label mb-0">Reference</dt>
              <dd>{document.display_code}</dd>
            </div>
          )}
        </dl>
      </header>

      <section aria-labelledby="body-heading" className="space-y-3">
        <h2 id="body-heading" className="font-serif text-lg text-green-900">
          Contract
        </h2>
        <MergedBodyView body={document.merged_body} />
      </section>

      {isExecuted ? (
        /* Executed: the roster is sealed — render it read-only. */
        <section aria-labelledby="roster-heading" className="space-y-3">
          <h2 id="roster-heading" className="font-serif text-lg text-green-900">
            Signatures
          </h2>
          {signatures.length === 0 ? (
            <EmptyState
              title="No signature parties yet"
              message="This document has no signer roster."
            />
          ) : (
            <DataTable
              columns={SIGNATURE_COLUMNS}
              rows={signatures}
              rowKey={(s) => s.id}
            />
          )}
        </section>
      ) : (
        /* Unsigned / partially signed: embedded OPS-DOC-SIGN. When the last
           party signs, reload the document so the EXECUTED status renders. */
        <SigningPanel documentId={document.id} onExecuted={load} />
      )}

      {/* OPS-DOC-DELIVER tail: only reachable once the document is EXECUTED. */}
      {isExecuted && <DeliveryPanel documentId={document.id} status={document.status} />}
    </div>
  );
}
