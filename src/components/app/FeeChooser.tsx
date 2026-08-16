/**
 * TASK FEECHOICE — staff choose the fee on a booking: apply the computed
 * reschedule amount, apply a different fee from the signed policy (no-show,
 * late-start) or a custom amount, or waive it outright. One component, two
 * call sites (F1: REVIEWQ's decision surface, on a reschedule/cancel/defer
 * request; F3: a standalone charge on a booking with no request at all, e.g.
 * a genuine no-show) — "reuse the same chooser," not a second one.
 *
 * `computedAmount` is only present at a reschedule decision (F1); omitting it
 * (F3) hides the "apply the computed fee" option, since there is nothing
 * computed outside a reschedule ask. Every other option requires a reason —
 * the waiver and the override are both discretionary acts against a signed
 * contract, and the record has to say who decided and why.
 */
import { useState } from 'react';
import { applyBookingFee, type ApplyBookingFeeResult, type FeeKind } from '../../lib/ops/api-calendar';
import { toErrorMessage } from '../../lib/ops/errors';

const NAMED_FEES: { kind: FeeKind; amount: number; label: string }[] = [
  { kind: 'no_show', amount: 75, label: 'No-show — client did not attend or contact us (§6)' },
  { kind: 'late_start_before', amount: 30, label: 'Late start — contacted before start time, no later slot (§7)' },
  { kind: 'late_start_after', amount: 40, label: 'Late start — contacted after start time, could not accommodate (§7)' },
];

export function FeeChooser({
  bookingId,
  changeId = null,
  computedAmount = null,
  computedLabel = null,
  onApplied,
  onCancel,
}: {
  bookingId: string;
  changeId?: string | null;
  /** Present only at a reschedule decision point (F1). */
  computedAmount?: number | null;
  computedLabel?: string | null;
  onApplied: (result: ApplyBookingFeeResult) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<FeeKind>(computedAmount !== null ? 'computed' : 'no_show');
  const [customAmount, setCustomAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonRequired = kind !== 'computed';
  const canSubmit = kind !== 'custom' || (customAmount.trim() !== '' && Number(customAmount) >= 0);

  async function submit() {
    if (reasonRequired && !reason.trim()) {
      setError('A reason is required for anything other than the computed fee.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await applyBookingFee({
        bookingId,
        changeId,
        feeKind: kind,
        amount: kind === 'custom' ? Number(customAmount) : null,
        reason: reason.trim() || null,
      });
      onApplied(result);
    } catch (e) {
      setError(toErrorMessage(e, 'Could not apply that fee.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-green-800/15 rounded p-3 text-sm flex flex-col gap-2">
      <p className="form-label">Choose the fee</p>
      <div className="flex flex-col gap-1.5">
        {computedAmount !== null && (
          <label className="flex items-start gap-2">
            <input type="radio" name={`fee-kind-${bookingId}`} className="mt-1" checked={kind === 'computed'} onChange={() => setKind('computed')} />
            <span>
              Apply the computed fee — <strong>${computedAmount.toFixed(2)}</strong>
              {computedLabel ? <span className="text-green-800/70"> · {computedLabel}</span> : null}
            </span>
          </label>
        )}
        {NAMED_FEES.map((f) => (
          <label key={f.kind} className="flex items-start gap-2">
            <input type="radio" name={`fee-kind-${bookingId}`} className="mt-1" checked={kind === f.kind} onChange={() => setKind(f.kind)} />
            <span>
              {f.label} — <strong>${f.amount.toFixed(2)}</strong>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-2">
          <input type="radio" name={`fee-kind-${bookingId}`} className="mt-1" checked={kind === 'custom'} onChange={() => setKind('custom')} />
          <span className="flex items-center gap-2">
            Custom amount
            {kind === 'custom' && (
              <input
                type="number" min="0" step="0.01" className="form-input w-28 py-1"
                value={customAmount} onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0.00"
              />
            )}
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="radio" name={`fee-kind-${bookingId}`} className="mt-1" checked={kind === 'waived'} onChange={() => setKind('waived')} />
          <span>No fee — waive it</span>
        </label>
      </div>

      {reasonRequired && (
        <label className="text-sm">
          <span className="form-label">Reason (required)</span>
          <textarea rows={2} className="form-input resize-none" value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
      )}

      {error && <p role="alert" className="form-error">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button" className="btn-primary text-xs px-3 py-1.5"
          disabled={busy || !canSubmit || (reasonRequired && !reason.trim())}
          onClick={() => void submit()}
        >
          {busy ? 'Applying…' : 'Apply'}
        </button>
        <button type="button" className="btn-secondary text-xs px-3 py-1.5" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
