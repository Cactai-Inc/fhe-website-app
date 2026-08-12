/**
 * OPS-DOCS-QUEUE — presentational documents work-queue table.
 *
 * Renders the in-tenant documents (DRAFT / AWAITING_SIGNATURE / EXECUTED /
 * VOID) via the KIT DataTable with a StatusBadge on `status`, sorted by
 * `generated_at` (newest first). Each row's title is a real <Link> into the
 * OPS-DOC-VIEW viewer at `/app/ops/documents/:id`, so a click opens the
 * viewer/signing surface.
 *
 * Zero data calls — the rows + current status filter are passed in and
 * `onStatusChange(status)` is fired when the operator changes the filter, so
 * the page owns the fetch/filter (proven wired by the page test firing the
 * select change and asserting the data fn + the narrowed rows).
 */
import { Link } from 'react-router-dom';
import { fromHere } from '../../../lib/linkOrigin';
import { DataTable, StatusBadge } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import { contactName } from '../../../lib/ops/types';
import type { DocumentQueueRow } from '../../../lib/ops/types';

/** The real status vocabulary (document_status.code) the queue lets the
 *  operator narrow to. `ALL` = no filter. `SENT` never existed as a status —
 *  it matched zero rows — and `VOID` was previously unreachable here only
 *  because it had no option, not because the query excluded it. */
export const QUEUE_STATUS_FILTERS = ['ALL', 'DRAFT', 'AWAITING_SIGNATURE', 'EXECUTED', 'VOID'] as const;
export type QueueStatusFilter = (typeof QUEUE_STATUS_FILTERS)[number];

export interface DocumentQueueTableProps {
  documents: DocumentQueueRow[];
  loading?: boolean;
  statusFilter: QueueStatusFilter;
  onStatusChange: (status: QueueStatusFilter) => void;
  /** Override the empty state — e.g. a preset view that's waiting on a
   *  person/horse pick has nothing to show yet for a different reason than
   *  "no documents exist." */
  emptyTitle?: string;
  emptyMessage?: string;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

/** Newest-generated first (spec: "sort by generated_at"). */
function byGeneratedAtDesc(a: DocumentQueueRow, b: DocumentQueueRow): number {
  return (b.generated_at ?? '').localeCompare(a.generated_at ?? '');
}

function horseName(h: DocumentQueueRow['horse']): string {
  if (!h) return '—';
  return h.nickname || h.registered_name || '—';
}

const COLUMNS: Column<DocumentQueueRow>[] = [
  {
    key: 'title',
    header: 'Document',
    render: (row) => (
      <Link
        // Contract/deal docs open the full contract workspace (fill, send, sign,
        // archive, delete); other docs open the read-only viewer.
        to={row.contract_id ? `/app/contracts/${row.id}` : `/app/ops/documents/${row.id}`}
        /* RETURN-TO-ORIGIN: back to the ops documents queue, not the member
           documents list. COLUMNS is module-level so there is no hook here —
           this surface has one fixed home, so naming it is exact, not a guess. */
        state={fromHere('/app/ops/documents')}
        className="link-underline font-sans font-medium text-green-900"
        data-testid={`doc-link-${row.id}`}
      >
        {row.title ?? row.display_code ?? row.id.slice(0, 8)}
      </Link>
    ),
  },
  {
    key: 'person',
    header: 'Person',
    render: (row) => <span>{row.contact ? contactName(row.contact) || '—' : '—'}</span>,
  },
  {
    key: 'horse',
    header: 'Horse',
    render: (row) => <span>{horseName(row.horse)}</span>,
  },
  {
    key: 'type',
    header: 'Type',
    render: (row) => <span className="text-green-800/80">{row.template?.title ?? '—'}</span>,
  },
  {
    key: 'contract',
    header: 'Contract',
    render: (row) => (
      <span className="text-green-800/80">{row.contract_id ? row.contract_id.slice(0, 8) : '—'}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <StatusBadge status={row.status} />,
  },
  {
    key: 'generated_at',
    header: 'Generated',
    render: (row) => <span>{formatDate(row.generated_at)}</span>,
  },
];

export function DocumentQueueTable({
  documents,
  loading,
  statusFilter,
  onStatusChange,
  emptyTitle = 'No documents',
  emptyMessage = 'Documents generated across engagements will appear here.',
}: DocumentQueueTableProps) {
  const rows = [...documents].sort(byGeneratedAtDesc);

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="doc-queue-status" className="form-label">
          Status
        </label>
        <select
          id="doc-queue-status"
          className="form-input max-w-xs"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as QueueStatusFilter)}
        >
          {QUEUE_STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === 'ALL' ? 'All statuses' : status}
            </option>
          ))}
        </select>
      </div>
      <DataTable
        columns={COLUMNS}
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle={emptyTitle}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
