import { useEffect, useState } from 'react';
import { toErrorMessage } from '../../../lib/ops/errors';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getTransaction } from '../../../lib/api';
import { useDocumentTitle } from '../../../lib/hooks';
import { Money, StatusBadge, EmptyState } from '../../../lib/ops';
import { formatMoney } from '../../../lib/ops';
import { SettleModal } from '../../../components/ops/billing/SettleModal';
import { contactName } from '../../../lib/ops/types';
import type { Transaction, BillableLine, Contact } from '../../../lib/ops/types';

/**
 * OPS-TXN — Transaction detail / reconcile view (surface `ops`, module `core`).
 *
 * Reads /app/ops/transactions/:id → `getTransaction(id)` (INT-API-CORE; RLS
 * org-scoped; INVOICE rows arrive with their composing `billable_lines` and the
 * `payer` contact joined, deal txns arrive with their engagement link). This is
 * the reconcile surface:
 *   - INVOICE  → the rolled-up billable_lines that composed the invoice, each
 *                with its Money amount, summing to the invoice amount, plus a
 *                "Settle open charges" action that opens the shared OPS-SETTLE
 *                modal for this payer (any still-OPEN lines → a fresh INVOICE;
 *                on success we navigate to the new invoice's detail).
 *   - deal txn → the engagement link + deposit / balance breakdown.
 * Loading, not-found, error and success branches all render.
 */

/** getTransaction() detail shape: the transaction row plus the joined children
 *  the reconcile view renders. The INVOICE roll-up columns (payer_contact_id,
 *  period) and joined records are optional so a bare deal txn is valid too. */
export interface TransactionDetail extends Omit<Transaction, 'txn_type'> {
  /** Superset per U17 settlement roll-up: adds 'INVOICE' to the deal-txn types. */
  txn_type: 'PURCHASE' | 'SALE' | 'LEASE' | 'INVOICE';
  payer_contact_id?: string | null;
  period?: string | null;
  /** Composing lines for an INVOICE (empty/absent for a deal txn). */
  billable_lines?: BillableLine[];
  /** The payer contact an INVOICE settled for. */
  payer?: Pick<Contact, 'id' | 'display_code' | 'first_name' | 'last_name'> | null;
}

export default function TransactionDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  useDocumentTitle('Transaction');
  const navigate = useNavigate();
  const [txn, setTxn] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getTransaction(id)
      .then((row) => {
        if (active) setTxn((row as unknown as TransactionDetail | null) ?? null);
      })
      .catch((err: unknown) => {
        if (active) setError(toErrorMessage(err, 'Could not load transaction.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const isInvoice = txn?.txn_type === 'INVOICE';
  const lines = txn?.billable_lines ?? [];
  const linesTotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const balance =
    txn && txn.amount !== null && txn.deposit_amount !== null
      ? txn.amount - txn.deposit_amount
      : null;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Link to="/app/ops/transactions" className="link-underline text-sm">
        ← All transactions
      </Link>

      <div className="mt-6">
        {loading ? (
          <p className="body-text text-muted" data-testid="detail-loading">
            Loading…
          </p>
        ) : error ? (
          <p role="alert" className="form-error text-sm">
            {error}
          </p>
        ) : !txn ? (
          <EmptyState
            title="Transaction not found"
            message="This transaction may have been removed or is outside your organization."
          />
        ) : (
          <>
            {/* Header: reference, type, status, amount */}
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="font-serif text-2xl text-green-900">
                  {txn.display_code ?? txn.id.slice(0, 8)}
                </h1>
                <p className="mt-1 text-sm text-green-800/70">{txn.txn_type}</p>
              </div>
              <div className="text-right">
                <Money amount={txn.amount} className="font-serif text-2xl text-green-900" />
                <div className="mt-1">
                  <StatusBadge status={txn.status} />
                </div>
              </div>
            </div>

            {isInvoice ? (
              /* INVOICE → composing billable_lines summing to the amount */
              <section aria-labelledby="lines-heading">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <h2 id="lines-heading" className="font-serif text-lg text-green-900">
                    Composing charges
                  </h2>
                  <div className="flex items-center gap-4">
                    {txn.payer && (
                      <span className="text-sm text-green-800/70" data-testid="invoice-payer">
                        Payer: {contactName(txn.payer)}
                      </span>
                    )}
                    {txn.payer_contact_id && (
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        onClick={() => setSettleOpen(true)}
                      >
                        Settle open charges
                      </button>
                    )}
                  </div>
                </div>

                {lines.length === 0 ? (
                  <EmptyState
                    title="No composing charges"
                    message="This invoice has no billable lines attached."
                  />
                ) : (
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-green-800/15">
                        <th scope="col" className="py-2.5 px-3 text-xs font-sans font-medium tracking-wide uppercase text-green-800/[0.85]">
                          Source
                        </th>
                        <th scope="col" className="py-2.5 px-3 text-xs font-sans font-medium tracking-wide uppercase text-green-800/[0.85] text-right">
                          Qty
                        </th>
                        <th scope="col" className="py-2.5 px-3 text-xs font-sans font-medium tracking-wide uppercase text-green-800/[0.85] text-right">
                          Amount
                        </th>
                        <th scope="col" className="py-2.5 px-3 text-xs font-sans font-medium tracking-wide uppercase text-green-800/[0.85]">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.id} className="border-b border-green-800/10">
                          <td className="py-3 px-3 text-green-900">{line.source_kind}</td>
                          <td className="py-3 px-3 text-green-900 text-right">{line.qty}</td>
                          <td className="py-3 px-3 text-green-900 text-right">
                            <Money amount={line.amount} />
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={line.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-green-800/20 font-medium">
                        <td className="py-3 px-3 text-green-900" colSpan={2}>
                          Total
                        </td>
                        <td className="py-3 px-3 text-green-900 text-right" data-testid="lines-total">
                          {formatMoney(linesTotal) ?? '—'}
                        </td>
                        <td className="py-3 px-3" />
                      </tr>
                    </tfoot>
                  </table>
                )}

                {/* OPS-SETTLE: roll this payer's still-OPEN lines into a fresh
                    INVOICE; on success, jump to the new invoice's detail (the
                    id change re-runs getTransaction — data refreshed). */}
                {txn.payer_contact_id && (
                  <SettleModal
                    open={settleOpen}
                    onClose={() => setSettleOpen(false)}
                    payerContactId={txn.payer_contact_id}
                    payerLabel={txn.payer ? contactName(txn.payer) : undefined}
                    onSettled={(result) => {
                      setSettleOpen(false);
                      navigate(`/app/ops/transactions/${result.transaction_id}`);
                    }}
                  />
                )}
              </section>
            ) : (
              /* deal txn → engagement link + deposit / balance breakdown */
              <section aria-labelledby="deal-heading">
                <h2 id="deal-heading" className="font-serif text-lg text-green-900 mb-3">
                  Deal
                </h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <dt className="form-label mb-0">Engagement</dt>
                  <dd className="text-green-900">
                    {txn.engagement_id ? (
                      <Link
                        to={`/app/ops/engagements/${txn.engagement_id}`}
                        className="link-underline"
                      >
                        View engagement
                      </Link>
                    ) : (
                      '—'
                    )}
                  </dd>

                  <dt className="form-label mb-0">Deposit</dt>
                  <dd className="text-green-900">
                    <Money amount={txn.deposit_amount} />
                  </dd>

                  <dt className="form-label mb-0">Balance due</dt>
                  <dd className="text-green-900" data-testid="deal-balance">
                    <Money amount={balance} />
                  </dd>
                </dl>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
