import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsync } from '../../../lib/ops';
import { listTransactions } from '../../../lib/api';
import { useDocumentTitle } from '../../../lib/hooks';
import type { Transaction } from '../../../lib/ops/types';
import { TransactionTable } from '../../../components/ops/billing/TransactionTable';

/**
 * OPS-TXN — Transactions / invoices list (surface `ops`, module `core`).
 *
 * Staff opens /app/ops/transactions → a reconcile list of every in-tenant
 * transaction (listTransactions, RLS org-scoped, newest first): deal txns
 * (PURCHASE/SALE/LEASE) and settled INVOICE rows, each with a Money amount and
 * StatusBadge. A row click navigates to the read-only detail/reconcile view.
 * Loading, empty, success and error branches all render (error is not swallowed).
 */
export function TransactionsPage() {
  useDocumentTitle('Transactions');
  const navigate = useNavigate();
  const [rows, setRows] = useState<Transaction[]>([]);

  const load = useAsync(listTransactions);

  const refresh = useCallback(async () => {
    const data = await load.run();
    setRows(data);
  }, [load]);

  useEffect(() => {
    refresh().catch(() => {
      /* surfaced via load.isError */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = (txn: Transaction) => {
    navigate(`/app/ops/transactions/${txn.id}`);
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl text-green-900">Transactions</h1>
      </div>

      {load.isError && (
        <p role="alert" className="form-error mb-4">
          {load.error?.message ?? 'Could not load transactions.'}
        </p>
      )}

      <TransactionTable
        rows={rows}
        loading={load.isPending && rows.length === 0}
        onRowClick={openDetail}
      />
    </div>
  );
}

export default TransactionsPage;
