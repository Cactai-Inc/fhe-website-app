import { DataTable, Money } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import type { BillableLine } from '../../../lib/ops/types';

/**
 * OPS-SETTLE — presentational table of a payer's OPEN billable lines plus the
 * summed total. The total is DERIVED from the real `line.amount` values (not a
 * separate/stubbed number), so the "$X to settle" figure the operator confirms
 * is exactly what `settle_billable_lines` will roll into the INVOICE.
 *
 * Pure presentational: no data call. The SettleModal owns the fetch and passes
 * the lines down.
 */
export interface OpenLinesTableProps {
  lines: BillableLine[];
  loading?: boolean;
}

/** Sum the line amounts — the invoice total the operator is about to create. */
export function sumLineAmounts(lines: BillableLine[]): number {
  return lines.reduce((total, line) => total + (Number(line.amount) || 0), 0);
}

const COLUMNS: Column<BillableLine>[] = [
  {
    key: 'source',
    header: 'Source',
    render: (line) => <span className="capitalize">{line.source_kind}</span>,
  },
  {
    key: 'period',
    header: 'Period',
    render: (line) => line.period ?? '—',
  },
  {
    key: 'qty',
    header: 'Qty',
    render: (line) => line.qty,
    className: 'text-right',
  },
  {
    key: 'unit',
    header: 'Unit',
    render: (line) => <Money amount={line.unit_amount} />,
    className: 'text-right',
  },
  {
    key: 'amount',
    header: 'Amount',
    render: (line) => <Money amount={line.amount} />,
    className: 'text-right',
  },
];

export function OpenLinesTable({ lines, loading }: OpenLinesTableProps) {
  const total = sumLineAmounts(lines);

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        columns={COLUMNS}
        rows={lines}
        loading={loading}
        rowKey={(line) => line.id}
        emptyTitle="Nothing to settle"
        emptyMessage="This payer has no open billable lines for the selected period."
      />
      {!loading && lines.length > 0 && (
        <div className="flex items-center justify-between border-t border-green-800/15 pt-3">
          <span className="form-label mb-0">Invoice total</span>
          <Money
            amount={total}
            className="font-serif text-lg text-green-900"
          />
        </div>
      )}
    </div>
  );
}
