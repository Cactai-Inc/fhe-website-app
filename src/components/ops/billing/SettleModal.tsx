import { useCallback, useEffect, useState } from 'react';
import { Modal, Money, useAsync } from '../../../lib/ops';
import { listOpenBillableLines, settleBillableLines } from '../../../lib/api';
import type { BillableLine, SettlementResult } from '../../../lib/ops/types';
import { OpenLinesTable } from './OpenLinesTable';

/**
 * OPS-SETTLE — shared settlement modal, reused by boarding / lessons / barnops.
 *
 * Given a payer + period it lists that payer's OPEN `billable_lines`
 * (`listOpenBillableLines` → `.from('billable_lines')` where status='OPEN'),
 * sums them into the invoice total, and on "Create invoice" calls
 * `settleBillableLines(payerContactId, period)` → `rpc('settle_billable_lines',
 * { p_payer_contact_id, p_period })`, which rolls the OPEN lines into ONE
 * `transactions` INVOICE and stamps them SETTLED.
 *
 * The RPC is idempotent: a re-settle with zero open lines returns no rows, which
 * we surface as a "nothing to settle" message rather than an error. On success
 * we show the returned { transaction_id, amount, lines_settled } and hand it to
 * `onSettled` so the caller can refresh its charge list / route to the invoice.
 */
export interface SettleModalProps {
  open: boolean;
  onClose: () => void;
  /** The contact being billed. */
  payerContactId: string;
  /** tstzrange string bounding the lines to settle (or null for all OPEN). */
  period?: string | null;
  /** Optional label for the payer, shown in the header. */
  payerLabel?: string;
  /** Called with the settlement result after a successful INVOICE. */
  onSettled?: (result: SettlementResult) => void;
}

export function SettleModal({
  open,
  onClose,
  payerContactId,
  period = null,
  payerLabel,
  onSettled,
}: SettleModalProps) {
  const [lines, setLines] = useState<BillableLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [nothingToSettle, setNothingToSettle] = useState(false);
  const settle = useAsync<SettlementResult[], [string, string | null]>(settleBillableLines);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listOpenBillableLines(payerContactId)
      .then((rows) => {
        if (!cancelled) setLines(rows);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [payerContactId]);

  // Load the payer's OPEN lines whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    return load();
  }, [open, load]);

  // Reset transient state when the modal closes. Depends on the STABLE
  // `settle.reset` callback (not the per-render `settle` object) so a host
  // page can keep the modal mounted while closed without an update loop.
  const resetSettle = settle.reset;
  useEffect(() => {
    if (open) return;
    setLines([]);
    setLoadError(null);
    setNothingToSettle(false);
    resetSettle();
  }, [open, resetSettle]);

  const handleSettle = async () => {
    setNothingToSettle(false);
    try {
      const rows = await settle.run(payerContactId, period);
      const result = rows[0];
      if (!result || result.lines_settled === 0) {
        // Idempotent no-op: nothing OPEN to roll into an invoice.
        setNothingToSettle(true);
        setLines([]);
        return;
      }
      onSettled?.(result);
    } catch {
      // Error surfaced via settle.error below; modal stays open for retry.
    }
  };

  const result = settle.data?.[0];
  const settled = !!result && result.lines_settled > 0;
  const hasOpenLines = lines.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={payerLabel ? `Settle — ${payerLabel}` : 'Settle billable lines'}
      disableBackdropClose={settle.isPending}
      footer={
        settled ? (
          <button type="button" className="btn-primary" onClick={onClose}>
            Close
          </button>
        ) : (
          <>
            <button
              type="button"
              className="px-4 py-2 text-green-800 hover:text-green-900"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!hasOpenLines || settle.isPending}
              aria-busy={settle.isPending}
              onClick={handleSettle}
            >
              {settle.isPending ? 'Creating invoice…' : 'Create invoice'}
            </button>
          </>
        )
      }
    >
      {loadError && (
        <p role="alert" className="form-error">
          Could not load billable lines: {loadError.message}
        </p>
      )}

      {settled ? (
        <div className="flex flex-col gap-2">
          <p className="text-green-900">Invoice created.</p>
          <p className="text-sm text-green-800/70">
            Transaction <span className="font-mono">{result!.transaction_id}</span>
          </p>
          <p className="text-sm text-green-800/70">
            {result!.lines_settled} line{result!.lines_settled === 1 ? '' : 's'} settled for{' '}
            <Money amount={result!.amount} className="font-semibold text-green-900" />
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {!loadError && (
            <OpenLinesTable lines={lines} loading={loading} />
          )}

          {nothingToSettle && (
            <p role="status" className="text-sm text-green-800/70">
              Nothing to settle — no open billable lines for this payer.
            </p>
          )}

          {settle.isError && settle.error && (
            <p role="alert" className="form-error">
              {settle.error.message}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
