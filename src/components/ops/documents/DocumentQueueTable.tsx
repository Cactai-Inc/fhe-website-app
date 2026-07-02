/**
 * OPS-DOCS-QUEUE — presentational documents work-queue table.
 *
 * Renders the in-tenant documents (DRAFT / SENT / EXECUTED / …) via the KIT
 * DataTable with a StatusBadge on `status`, sorted by `generated_at` (newest
 * first). Each row's title is a real <Link> into the OPS-DOC-VIEW viewer at
 * `/app/ops/documents/:id`, so a click opens the viewer/signing surface.
 *
 * Zero data calls — the rows + current status filter are passed in and
 * `onStatusChange(status)` is fired when the operator changes the filter, so
 * the page owns the fetch/filter (proven wired by the page test firing the
 * select change and asserting the data fn + the narrowed rows).
 */
import { Link } from 'react-router-dom';
import { DataTable, StatusBadge } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import type { DocumentRow } from '../../../lib/ops/types';

/** The status values the queue lets the operator narrow to. `ALL` = no filter. */
export const QUEUE_STATUS_FILTERS = ['ALL', 'DRAFT', 'SENT', 'EXECUTED'] as const;
export type QueueStatusFilter = (typeof QUEUE_STATUS_FILTERS)[number];

export interface DocumentQueueTableProps {
  documents: DocumentRow[];
  loading?: boolean;
  statusFilter: QueueStatusFilter;
  onStatusChange: (status: QueueStatusFilter) => void;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
}

/** Newest-generated first (spec: "sort by generated_at"). */
function byGeneratedAtDesc(a: DocumentRow, b: DocumentRow): number {
  return (b.generated_at ?? '').localeCompare(a.generated_at ?? '');
}

const COLUMNS: Column<DocumentRow>[] = [
  {
    key: 'title',
    header: 'Document',
    render: (row) => (
      <Link
        to={`/app/ops/documents/${row.id}`}
        className="link-underline font-sans font-medium text-green-900"
        data-testid={`doc-link-${row.id}`}
      >
        {row.title ?? row.display_code ?? row.id.slice(0, 8)}
      </Link>
    ),
  },
  {
    key: 'engagement',
    header: 'Engagement',
    render: (row) => (
      <span className="text-green-800/80">{row.engagement_id.slice(0, 8)}</span>
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
        emptyTitle="No documents"
        emptyMessage="Documents generated across engagements will appear here."
      />
    </div>
  );
}
