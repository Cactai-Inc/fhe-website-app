/**
 * Presentational engagements table for OPS-ENG-LIST. Renders the engagement
 * rows via the KIT DataTable with a StatusBadge on `status`, a Money cell on
 * the (optional) deal amount, and a text filter over code/service/status.
 *
 * Zero data calls — the list is passed in and `onOpen(row)` is fired on row
 * click so the page owns navigation (proven wired by the page test firing a
 * row click and asserting the route param).
 */
import { useMemo, useState } from 'react';
import { DataTable, StatusBadge, Money } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import type { Engagement } from '../../../lib/ops/types';

/** Engagement plus the optional joined rollup the list read may surface. */
export type EngagementRow = Engagement & {
  /** Primary deal amount (from the joined primary transaction), if any. */
  amount?: number | null;
};

export interface EngagementTableProps {
  engagements: EngagementRow[];
  loading?: boolean;
  onOpen: (row: EngagementRow) => void;
}

function matches(row: EngagementRow, q: string): boolean {
  const hay = [row.display_code, row.service_type, row.status]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function EngagementTable({ engagements, loading, onOpen }: EngagementTableProps) {
  const [filter, setFilter] = useState('');

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return engagements;
    return engagements.filter((row) => matches(row, q));
  }, [engagements, filter]);

  const columns: Column<EngagementRow>[] = [
    {
      key: 'code',
      header: 'Engagement',
      render: (row) => (
        <span className="font-sans font-medium text-green-900">
          {row.display_code ?? row.id.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'service_type',
      header: 'Service',
      render: (row) => row.service_type,
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => <Money amount={row.amount ?? null} />,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div>
      <div className="mb-4">
        <label htmlFor="engagement-filter" className="sr-only">
          Filter engagements
        </label>
        <input
          id="engagement-filter"
          type="search"
          className="form-input max-w-xs"
          placeholder="Filter by code, service or status…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        onRowClick={onOpen}
        emptyTitle="No engagements"
        emptyMessage="Engagements you open with clients will appear here."
      />
    </div>
  );
}
