/**
 * THE ORDER, ON THE LEAD PAGE — CAREPATH §C6 (test 8) and §C5c (test 12e).
 *
 * Owner: "when we open the lead from the ops or lead page we see their
 * submission and order, we contact them and discuss their needs and order."
 *
 * This is a SECTION of the existing `LeadWorkDrawer`, not a second lead page.
 * The drawer already showed the personal details, the selections and the step-2
 * answers; until §C5 an inquiry had no order to show. It now shows both orders
 * after a split, and carries the three staff actions the owner's flow needs:
 *
 *   • SPLIT — move chosen lines into a second order on the same inquiry.
 *     ⚠️ A STAFF ACTION, NEVER AUTOMATIC. The inquiry arrives unified and may be
 *     ambiguous; no question on the form decides it. Staff learn the specifics
 *     on the call and choose. It works for ANY order for any reason — the
 *     acquisition-plus-care case is why it was built, not the limit of its use.
 *   • HOLD — park an order as a draft that owes nothing and schedules nothing.
 *     It wakes by itself when a horse appears for this client.
 *   • CANCEL A LINE — voided, never deleted; the total recomputes and the order
 *     voids when the last live line goes.
 *
 * ⚠️ WHAT IS NOT HERE: a price. `draft` + "Enquiry — awaiting call" means
 * NOTHING IS OWED (§C5b rule 4), and the panel says so rather than presenting a
 * balance staff might act on.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  listRequestOrders, splitRequestOrder, holdOrderForHorse, voidOrderItem,
  type RequestOrder, type RequestOrderItem,
} from '../../lib/ops/api-intake';
import { toErrorMessage } from '../../lib/ops/errors';
import { StatusBadge } from '../../lib/ops';

const money = (n: number | null): string => {
  if (n == null) return 'Price on inquiry';
  const v = Number(n);
  if (!Number.isFinite(v)) return 'Price on inquiry';
  return `$${v.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2,
  })}`;
};

/** What shape of schedule this line needs (§C7) — read from the CATALOG's
 *  `config_kind` / `weekly_frequency`, never parsed from the offering name.
 *  CAREPLANS: the frequency is no longer baked into the SKU. Staff choose the days
 *  of the week when they provision the plan and the quantity follows from them; the
 *  catalog number below is the starting point, not the answer. */
function scheduleShape(it: RequestOrderItem): string | null {
  if (it.config_kind === 'recurring') {
    const n = it.weekly_frequency ?? 1;
    return `Weekly — staff choose the days of the week (normally ${n}), plus how long it runs`;
  }
  if (it.config_kind === 'scheduled') return 'One session — staff pick a date';
  return null;
}

export function LeadOrderPanel({ requestId }: { requestId: string }) {
  const [orders, setOrders] = useState<RequestOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [splitting, setSplitting] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    listRequestOrders(requestId)
      .then((o) => { setOrders(o); setError(null); })
      .catch((e) => { setOrders([]); setError(toErrorMessage(e, 'Could not load this inquiry’s order.')); });
  }, [requestId]);
  useEffect(load, [load]);

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      load();
    } catch (e) {
      setError(toErrorMessage(e, fallback));
    } finally {
      setBusy(false);
    }
  }

  if (orders === null) {
    return (
      <section aria-label="Order">
        <h3 className="form-label mb-2">Order</h3>
        <p className="text-sm text-green-800/70">Loading the order…</p>
      </section>
    );
  }

  return (
    <section aria-label="Order" className="border-t border-green-800/10 pt-4">
      <h3 className="form-label mb-2">Order</h3>

      {error && <p role="alert" className="form-error mb-3">{error}</p>}

      {orders.length === 0 ? (
        <p className="text-sm text-green-800/70">
          No order on this inquiry — it carried no catalog selections.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map((o) => {
            const live = o.items.filter((i) => !i.voided_at);
            const voided = o.items.filter((i) => i.voided_at);
            const owes = o.status !== 'draft' && o.status !== 'void';
            return (
              <div key={o.id} className="border border-green-800/15 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      {o.display_code ?? 'Order'}
                    </p>
                    <p className="text-xs text-green-800/70">
                      {o.current_status_label ?? o.status}
                      {' · '}
                      {owes ? money(o.amount) : 'Nothing owed until this is confirmed'}
                    </p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                <ul className="flex flex-col gap-1.5 mb-3">
                  {live.map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3 text-sm">
                      <label className="flex items-start gap-2 min-w-0">
                        {splitting === o.id && (
                          <input
                            type="checkbox"
                            className="mt-1 accent-green-800"
                            checked={chosen[it.id] === true}
                            onChange={() => setChosen((c) => ({ ...c, [it.id]: !c[it.id] }))}
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block text-green-900">{it.label}</span>
                          {scheduleShape(it) && (
                            <span className="block text-xs text-green-800/60">{scheduleShape(it)}</span>
                          )}
                        </span>
                      </label>
                      <span className="flex items-center gap-3 shrink-0">
                        <span className="text-green-900">{money(it.price_amount)}</span>
                        <button
                          type="button"
                          className="text-xs text-red-700 underline underline-offset-2"
                          disabled={busy}
                          onClick={() => void run(
                            () => voidOrderItem(it.id, 'Cancelled by staff'),
                            'Could not cancel that line.')}
                        >
                          Cancel
                        </button>
                      </span>
                    </li>
                  ))}
                  {voided.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-3 text-sm text-muted">
                      <span className="line-through">{it.label}</span>
                      <span className="text-xs">
                        cancelled{it.void_reason ? ` — ${it.void_reason}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>

                {splitting === o.id ? (
                  <div className="flex flex-col gap-2">
                    <input
                      className="form-input text-sm"
                      placeholder="Why is this being split? (shown on both orders)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button" className="btn-primary text-sm"
                        disabled={busy || !Object.values(chosen).some(Boolean)}
                        onClick={() => void run(async () => {
                          await splitRequestOrder(
                            o.id,
                            Object.keys(chosen).filter((k) => chosen[k]),
                            reason.trim() || undefined);
                          setSplitting(null); setChosen({}); setReason('');
                        }, 'Could not split that order.')}
                      >
                        Move the ticked items to a second order
                      </button>
                      <button
                        type="button" className="btn-outline-gold text-sm" disabled={busy}
                        onClick={() => { setSplitting(null); setChosen({}); }}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {live.length > 1 && (
                      <button
                        type="button" className="btn-outline-gold text-sm" disabled={busy}
                        onClick={() => { setSplitting(o.id); setChosen({}); }}
                      >
                        Split this order
                      </button>
                    )}
                    {o.current_status !== 'awaiting_horse' && o.status !== 'paid' && o.status !== 'void' && (
                      <button
                        type="button" className="btn-outline-gold text-sm" disabled={busy}
                        onClick={() => void run(
                          () => holdOrderForHorse(o.id),
                          'Could not hold that order.')}
                      >
                        Hold — awaiting the horse
                      </button>
                    )}
                  </div>
                )}

                {o.current_status === 'awaiting_horse' && (
                  <p className="text-xs text-green-800/70 mt-2">
                    Held. Nothing is owed and nothing is scheduled. It wakes on its own the
                    moment a horse of theirs is on our records — not when a deal closes.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default LeadOrderPanel;
