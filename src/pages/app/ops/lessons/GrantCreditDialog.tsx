import { useMemo, useState } from 'react';
import { Modal, AsyncButton, StatusBadge, formatMoney } from '../../../../lib/ops';
import { toErrorMessage } from '../../../../lib/ops/errors';
import {
  grantLessonCredit,
  requestGrantPayment,
  type GrantableOffering,
  type GrantCreditResult,
  type LessonClientOption,
} from '../../../../lib/ops/api-lessons';

/**
 * TASK-CREDITGRANT — the origination form. Three clearly labelled modes, never a
 * checkbox on one button (task §4).
 *
 * D19 IS THE SHAPE OF THIS DIALOG, not a note on it:
 *   1. STATE IT FIRST — the form never submits. "Review" moves to a confirmation
 *      step that names the client, the quantity, the mode and the dollar figure,
 *      and only that step can grant.
 *   2. A REASON IS MANDATORY — "Review" is disabled without one, and the RPC
 *      refuses one anyway, so a future caller cannot skip it either.
 *   3. WHAT IT WAS FOR — the service is a required picker, so no credit is ever
 *      minted bare (TASK-AUTHORITY's voided orphan was exactly that).
 *   4. UNDO — lives on the ledger row, not here, because undo happens later.
 *
 * The picker offers only `grantable_offerings()`: scheduled SKUs with credit units.
 * A weekly plan is a standing slot, not a credit balance (D23) — the RPC refuses it
 * and this never presents it.
 */

export type GrantMode = 'handwrite' | 'comp' | 'bill';

const MODES: { key: GrantMode; label: string; blurb: string }[] = [
  { key: 'handwrite', label: 'Hand-write',
    blurb: 'The money is already in hand. Recorded as a paid order at the normal price.' },
  { key: 'comp', label: 'Comp (give it away)',
    blurb: 'Free to the client. The normal price is recorded as a loss so it can be reported.' },
  { key: 'bill', label: 'Bill (balance owed)',
    blurb: 'Credits go on now and the order owes money. Asking for it is a separate step.' },
];

export interface GrantCreditDialogProps {
  open: boolean;
  onClose: () => void;
  clients: LessonClientOption[];
  offerings: GrantableOffering[];
  /** Called after a grant lands (and after any payment request), so the ledger reloads. */
  onGranted: () => void | Promise<void>;
}

export function GrantCreditDialog({
  open, onClose, clients, offerings, onGranted,
}: GrantCreditDialogProps) {
  const [clientId, setClientId] = useState('');
  const [offeringId, setOfferingId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [mode, setMode] = useState<GrantMode>('handwrite');
  const [reason, setReason] = useState('');
  const [method, setMethod] = useState('cash');
  // TASK-ORIGIN §4.3 — "a backfilled purchase entered today with today's
  // timestamp is worse than no record." Defaults to today, so an ordinary
  // (non-backfilled) grant is unaffected unless staff changes it.
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<GrantCreditResult | null>(null);
  const [requestNote, setRequestNote] = useState('');
  const [sendState, setSendState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const offering = offerings.find((o) => o.id === offeringId) ?? null;

  // What the confirmation step promises, computed from the SAME numbers the RPC uses
  // (unit_count x quantity, price_amount x quantity) so the two cannot disagree.
  const preview = useMemo(() => {
    if (!offering) return null;
    const credits = (offering.unit_count || 0) * quantity;
    const list = (offering.price_amount || 0) * quantity;
    return { credits, list, charge: mode === 'comp' ? 0 : list };
  }, [offering, quantity, mode]);

  const ready = Boolean(clientId && offeringId && quantity >= 1 && reason.trim());

  const reset = () => {
    setClientId(''); setOfferingId(''); setQuantity(1); setMode('handwrite');
    setReason(''); setMethod('cash'); setPaidAt(new Date().toISOString().slice(0, 10));
    setConfirming(false); setDone(null);
    setRequestNote(''); setSendState(null); setError(null);
  };

  const close = () => { reset(); onClose(); };

  const submit = async () => {
    setError(null);
    try {
      const result = await grantLessonCredit({
        clientId, offeringId, quantity, mode, reason: reason.trim(),
        paymentMethod: mode === 'handwrite' ? method : null,
        // Bill has no paid_at until it is settled — the date field only
        // means something for the two modes that stamp paid_at immediately.
        paidAt: mode !== 'bill' ? paidAt : null,
      });
      setDone(result);
      setConfirming(false);
      await onGranted();
    } catch (err) {
      setError(toErrorMessage(err, 'Could not grant the credit.'));
    }
  };

  const askForPayment = async () => {
    if (!done) return;
    setError(null);
    try {
      const out = await requestGrantPayment(done.purchase_id, requestNote.trim() || null);
      setSendState(
        out.sent
          ? `Asked for ${formatMoney(out.amountDue)} — the email went out and the client has been notified in the app.`
          : `Recorded the request for ${formatMoney(out.amountDue)} and notified the client in the app, but the email did not send${out.reason ? `: ${out.reason}` : '.'}`,
      );
      await onGranted();
    } catch (err) {
      setError(toErrorMessage(err, 'Could not request payment.'));
    }
  };

  // ── Step 3: what happened ────────────────────────────────────────────────
  if (done) {
    return (
      <Modal open={open} onClose={close} title="Credit granted"
             footer={<button type="button" className="btn-secondary" onClick={close}>Done</button>}>
        <p className="text-sm text-green-900" data-testid="grant-outcome">
          <strong>{done.credits}</strong> × {done.offering_name} added for{' '}
          <strong>{client?.name ?? 'the client'}</strong> on order{' '}
          <span className="font-mono">{done.display_code ?? done.purchase_id.slice(0, 8)}</span>.
        </p>
        <p className="mt-2 text-sm text-green-800/80">
          {done.mode === 'comp' && (
            <>Comped — {formatMoney(done.comp_value)} recorded as a loss.</>
          )}
          {done.mode === 'handwrite' && (
            <>{formatMoney(done.amount)} recorded as already received.</>
          )}
          {done.mode === 'bill' && <>{formatMoney(done.amount)} is owed on this order.</>}
        </p>

        {done.mode === 'bill' && (
          <div className="mt-6 rounded border border-green-800/15 p-4">
            <p className="form-label mb-1">Request payment</p>
            <p className="text-sm text-green-800/70 mb-3">
              Sends the client one message about this balance — in the app and by email.
              Nothing repeats it; there are no automatic reminders.
            </p>
            <label htmlFor="grant-request-note" className="form-label">Note (optional)</label>
            <textarea id="grant-request-note" className="form-input" rows={2}
                      value={requestNote} onChange={(e) => setRequestNote(e.target.value)}
                      placeholder="Bank transfer is easiest for us." />
            <div className="mt-3">
              <AsyncButton onClick={askForPayment} pendingLabel="Sending…"
                           onError={(e) => setError(e.message)}>
                Request {formatMoney(done.amount)}
              </AsyncButton>
            </div>
            {sendState && (
              <p className="mt-3 text-sm text-green-900" data-testid="grant-send-state">{sendState}</p>
            )}
          </div>
        )}
        {error && <p role="alert" className="form-error mt-4">{error}</p>}
      </Modal>
    );
  }

  // ── Step 2: state it before doing it (D19.1) ─────────────────────────────
  if (confirming && preview) {
    return (
      <Modal open={open} onClose={close} title="Confirm this grant"
             footer={
               <>
                 <button type="button" className="btn-secondary" onClick={() => setConfirming(false)}>
                   Back
                 </button>
                 <AsyncButton onClick={submit} pendingLabel="Granting…"
                              onError={(e) => setError(e.message)}>
                   {mode === 'comp' ? 'Comp it' : mode === 'bill' ? 'Bill it' : 'Hand-write it'}
                 </AsyncButton>
               </>
             }>
        <div className="text-sm text-green-900 space-y-3" data-testid="grant-confirm">
          <p>
            <strong>{preview.credits}</strong> × {offering?.name} for{' '}
            <strong>{client?.name}</strong>.
          </p>
          <p>
            {mode === 'handwrite' && (
              <>
                Recorded as <strong>{formatMoney(preview.charge)}</strong> already received
                ({method}). The client sees a paid order.
              </>
            )}
            {mode === 'comp' && (
              <>
                Free to the client. <strong>{formatMoney(preview.list)}</strong> of list value
                is recorded as a loss and will show in the comped total.
              </>
            )}
            {mode === 'bill' && (
              <>
                The client owes <strong>{formatMoney(preview.charge)}</strong>. The credits go on
                straight away — asking for the money is the next, separate step.
              </>
            )}
          </p>
          {mode !== 'bill' && paidAt !== new Date().toISOString().slice(0, 10) && (
            <p className="text-gold-800">
              Backdated — recorded as happening on{' '}
              <strong>{new Date(`${paidAt}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</strong>,
              not today.
            </p>
          )}
          <p className="text-green-800/80">Reason recorded: “{reason.trim()}”</p>
          <p className="text-green-800/60">
            This can be undone from the ledger until a credit is used.
          </p>
        </div>
        {error && <p role="alert" className="form-error mt-4">{error}</p>}
      </Modal>
    );
  }

  // ── Step 1: the form ─────────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={close} title="Grant a credit"
           footer={
             <>
               <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
               <button type="button" className="btn-primary" disabled={!ready}
                       onClick={() => { setError(null); setConfirming(true); }}>
                 Review
               </button>
             </>
           }>
      <div className="space-y-4">
        <div>
          <label htmlFor="grant-client" className="form-label">Client</label>
          <select id="grant-client" className="form-input" value={clientId}
                  onChange={(e) => setClientId(e.target.value)}>
            <option value="">Choose a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
          <div>
            <label htmlFor="grant-offering" className="form-label">What it is for</label>
            <select id="grant-offering" className="form-input" value={offeringId}
                    onChange={(e) => setOfferingId(e.target.value)}>
              <option value="">Choose a service…</option>
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} — {formatMoney(o.price_amount)} · {o.unit_count} credit
                  {o.unit_count === 1 ? '' : 's'}{o.active ? '' : ' (retired)'}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-green-800/60">
              Weekly plans are not here: a weekly plan is a standing slot, not a credit balance.
            </p>
          </div>
          <div>
            <label htmlFor="grant-quantity" className="form-label">Quantity</label>
            <input id="grant-quantity" type="number" min={1} className="form-input"
                   value={quantity}
                   onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
          </div>
        </div>

        <fieldset>
          <legend className="form-label">Mode</legend>
          <div className="space-y-2">
            {MODES.map((m) => (
              <label key={m.key}
                     className={`flex gap-3 rounded border p-3 cursor-pointer ${
                       mode === m.key ? 'border-green-800/40 bg-green-800/5' : 'border-green-800/15'}`}>
                <input type="radio" name="grant-mode" value={m.key} className="mt-1"
                       checked={mode === m.key} onChange={() => setMode(m.key)} />
                <span>
                  <span className="block text-sm font-medium text-green-900">{m.label}</span>
                  <span className="block text-xs text-green-800/70">{m.blurb}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === 'handwrite' && (
          <div>
            <label htmlFor="grant-method" className="form-label">How it was paid</label>
            <select id="grant-method" className="form-input" value={method}
                    onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="zelle">Zelle</option>
              <option value="check">Check</option>
              <option value="offline">Other / offline</option>
            </select>
          </div>
        )}

        {mode !== 'bill' && (
          <div>
            <label htmlFor="grant-paid-at" className="form-label">When it happened</label>
            <input id="grant-paid-at" type="date" className="form-input" value={paidAt}
                   max={new Date().toISOString().slice(0, 10)}
                   onChange={(e) => setPaidAt(e.target.value)} />
            <p className="mt-1 text-xs text-green-800/60">
              Defaults to today. Backdate this for a sale you are entering after the
              fact — the monthly totals read this date, not the day it was typed in.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="grant-reason" className="form-label">Reason (required)</label>
          <textarea id="grant-reason" className="form-input" rows={2} value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Why this credit is being granted." />
          <p className="mt-1 text-xs text-green-800/60">
            Recorded on the order and shown in the ledger. No reason, no grant.
          </p>
        </div>

        {preview && (
          <p className="text-sm text-green-900" data-testid="grant-preview">
            <StatusBadge status={mode === 'comp' ? 'COMP' : mode === 'bill' ? 'BILLED' : 'HAND-WRITTEN'}
                         tone={mode === 'comp' ? 'info' : mode === 'bill' ? 'warning' : 'success'} />{' '}
            {preview.credits} credit{preview.credits === 1 ? '' : 's'} ·{' '}
            {mode === 'comp'
              ? `${formatMoney(preview.list)} written off`
              : `${formatMoney(preview.charge)} ${mode === 'bill' ? 'owed' : 'received'}`}
          </p>
        )}
        {error && <p role="alert" className="form-error">{error}</p>}
      </div>
    </Modal>
  );
}

export default GrantCreditDialog;
