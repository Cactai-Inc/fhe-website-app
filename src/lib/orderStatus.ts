/**
 * THE ORDER'S STATE, IN ONE PLACE.
 *
 * `purchases` has TWO status axes and they are not the same fact. `status` is the
 * five-value lifecycle column (draft / sent / awaiting_payment / paid / void).
 * `current_status` is the TRUE status code from `status_events_vocab`, denormalised
 * onto the row by `trg_status_purchases` — and it is strictly richer, because it can
 * say things the five values cannot.
 *
 * The one that matters here: when a client DECLARES how they are paying, the order
 * moves to `payment_pending_zelle` or `payment_pending_cash` (owner, 2026-08-21:
 * *"the order should show a state of pending for payment type"*). Read off `status`
 * alone, that order is indistinguishable from one nobody has said a word about —
 * both are `awaiting_payment`.
 *
 * So every surface reads `current_status` first and falls back to `status` for rows
 * written before the trigger existed. The labels live here rather than in each page,
 * because the client's account list, the order page and the staff queue were three
 * separate maps that could disagree, and this is exactly the fact they must not
 * disagree about.
 */

/** Vocab code (or raw `status`) → the short label a list row shows. */
const LABEL: Record<string, string> = {
  // status_events_vocab codes
  pending: 'In progress',
  enquiry: 'Awaiting our call',
  awaiting_horse: 'Awaiting the horse',
  submitted: 'Awaiting payment',
  payment_pending_zelle: 'Payment pending — Zelle',
  payment_pending_cash: 'Payment pending — Cash',
  paid: 'Paid',
  complete: 'Complete',
  void: 'Cancelled',
  // raw `purchases.status` fallbacks
  draft: 'In progress',
  sent: 'Awaiting payment',
  awaiting_payment: 'Awaiting payment',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  expired: 'Expired',
};

/** The heading + sentence the order page opens with. */
const COPY: Record<string, { title: string; body: string }> = {
  draft: {
    title: 'Let’s finish setting this up',
    body: 'Review the details below, agree to the documents, and choose how you’d like to pay.',
  },
  pending: {
    title: 'Let’s finish setting this up',
    body: 'Review the details below, agree to the documents, and choose how you’d like to pay.',
  },
  submitted: {
    title: 'Awaiting your payment',
    body: 'Send your payment using the details below. We’ll confirm as soon as it arrives — usually within the hour.',
  },
  awaiting_payment: {
    title: 'Awaiting your payment',
    body: 'Send your payment using the details below. We’ll confirm as soon as it arrives — usually within the hour.',
  },
  // D23 — both halves in the heading itself: we know how you are paying, we have not
  // confirmed it yet, and NOTHING is waiting on that confirmation.
  payment_pending_zelle: {
    title: 'Payment pending — Zelle',
    body: 'You’ve told us the Zelle payment is on its way, and we’ll confirm it as soon as it lands on our side. Nothing is waiting on that — your sessions are already yours.',
  },
  payment_pending_cash: {
    title: 'Payment pending — cash',
    body: 'You’ve told us you’re paying cash, and we’ll settle it with you at the ranch. Nothing is waiting on that — your sessions are already yours.',
  },
  paid: { title: 'Payment received', body: 'Thank you. We’re finalizing your confirmation now.' },
  complete: { title: 'You’re all set', body: 'Everything is confirmed. We can’t wait to ride with you.' },
  confirmed: { title: 'You’re all set', body: 'Everything is confirmed. We can’t wait to ride with you.' },
  void: { title: 'This order was cancelled', body: 'If that wasn’t intended, reach out and we’ll sort it.' },
  cancelled: { title: 'This order was cancelled', body: 'If that wasn’t intended, reach out and we’ll sort it.' },
  expired: { title: 'This order expired', body: 'No problem — reach out and we’ll start fresh.' },
};

/** The code to show for an order: the true status, else the lifecycle column. */
export function orderStatusCode(order: { current_status?: string | null; status: string }): string {
  return order.current_status ?? order.status;
}

export function orderStatusLabel(order: { current_status?: string | null; status: string }): string {
  const code = orderStatusCode(order);
  return LABEL[code] ?? code;
}

export function orderStatusCopy(order: { current_status?: string | null; status: string }): {
  title: string; body: string;
} {
  const code = orderStatusCode(order);
  return COPY[code] ?? COPY.draft;
}
