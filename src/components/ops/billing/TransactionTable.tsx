import { DataTable, Money, StatusBadge } from '../../../lib/ops';
import type { Column } from '../../../lib/ops';
import type { Transaction } from '../../../lib/ops/types';

/**
 * OPS-TXN — presentational transactions table (surface `ops`, module `core`).
 *
 * Wraps the kit DataTable with the transaction columns for the reconcile list:
 * display code, type (PURCHASE/SALE/LEASE/INVOICE), Money amount, StatusBadge.
 * No data call here — TransactionsPage fetches (listTransactions) and passes
 * `rows`; a row click navigates to the detail page (handler owned by the page).
 */
export interface TransactionTableProps {
  rows: Transaction[];
  loading?: boolean;
  /** Open the detail/reconcile view for the clicked transaction. */
  onRowClick: (txn: Transaction) => void;
}

const columns: Column<Transaction>[] = [
  {
    key: 'display_code',
    header: 'Reference',
    render: (t) => (
      <span className="font-sans font-medium text-green-900">
        {t.display_code ?? t.id.slice(0, 8)}
      </span>
    ),
  },
  { key: 'txn_type', header: 'Type', render: (t) => t.txn_type },
  {
    key: 'amount',
    header: 'Amount',
    className: 'text-right',
    render: (t) => <Money amount={t.amount} />,
  },
  {
    key: 'status',
    header: 'Status',
    render: (t) => <StatusBadge status={t.status} />,
  },
];

export function TransactionTable({ rows, loading, onRowClick }: TransactionTableProps) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      loading={loading}
      rowKey={(t) => t.id}
      onRowClick={onRowClick}
      emptyTitle="No transactions yet"
      emptyMessage="Deal transactions and settled invoices will appear here."
    />
  );
}

export default TransactionTable;
