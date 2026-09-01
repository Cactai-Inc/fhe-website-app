/**
 * THE DATE AN ACT IS RECORDED AGAINST — TASK-BACKDATE.
 *
 * The owner is backfilling a year of trading. Before this, every backfilled
 * order and payment was stamped with the day it was typed: a year of revenue
 * collapsed onto one date, every prior month read zero, and `revenue_summary`
 * (which recognises at `paid_at`) reported it confidently. The fix is that the
 * two acts that move money — creating an order and settling one — can each say
 * WHEN they really happened.
 *
 * ONE DEFINITION OF "TODAY", AND IT IS THE BARN'S. The database was set to
 * America/Los_Angeles in 20260817T1600 (`ALTER ROLE authenticated SET timezone`),
 * so a bare `YYYY-MM-DD` handed to a `timestamptz` parameter over PostgREST is
 * cast to the START OF THAT DAY AT THE BARN. Everything here works in that same
 * calendar, so what staff pick and what Postgres stores can never disagree by a
 * timezone.
 *
 * ⚠️ THE VALUE IS ONLY EVER SENT WHEN IT IS IN THE PAST. `todaysDate()` picking
 * today means "no date argument" — the RPCs keep their `now()` default and a
 * same-day sale or payment behaves EXACTLY as it does today, receipt included.
 * That is what makes "a backdated settlement sends no email" provable rather
 * than approximate: the argument's presence IS the backdating.
 *
 * ⚠️ THE SERVER STILL DECIDES. `attach_offerings_to_client` and
 * `mark_purchase_paid` are EXECUTE-able by `authenticated` straight over
 * PostgREST, so the future-date refusal lives in THEM. `max` below is a
 * courtesy, not the guard.
 *
 * ⚠️ There is a twin of `barnToday()` inside `api/orders-mark-paid.ts`. It is not
 * a second implementation by choice — `tsconfig.api.json` includes only `api/`,
 * so a serverless function cannot import this file. Change one, change both.
 */

const BARN_TZ = 'America/Los_Angeles';

/** Today at the barn as `YYYY-MM-DD` (`en-CA` renders ISO order natively). */
export function barnToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BARN_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** True when `ymd` names a day before today at the barn — i.e. this act is a
 *  backfill, and the surfaces that announce things must stay quiet. */
export function isBackdated(ymd: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && ymd < barnToday();
}

/** What to hand an RPC's date parameter: the date itself when it is in the
 *  past, and `undefined` — meaning "leave `now()` alone" — when it is today.
 *  A future date returns `undefined` too; the server refuses it either way, and
 *  the caller has already been told (see `recordedDateNote`). */
export function asRecordedDate(ymd: string): string | undefined {
  return isBackdated(ymd) ? ymd : undefined;
}

/** D19's TELL, in one sentence: what date is this about to be recorded against,
 *  and what will and will not happen as a result. Shown BEFORE the act. */
export function recordedDateNote(ymd: string, kind: 'order' | 'payment'): string {
  const noun = kind === 'order' ? 'order' : 'payment';
  if (ymd > barnToday()) {
    return `${ymd} is in the future — a ${noun} cannot be dated forward, and this will be refused.`;
  }
  if (!isBackdated(ymd)) {
    return kind === 'order'
      ? 'Recorded as of today.'
      : 'Recorded as of today — the client gets their receipt as usual.';
  }
  const pretty = new Date(`${ymd}T12:00:00`).toLocaleDateString(undefined, {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  return kind === 'order'
    ? `Recorded as of ${pretty} — this order will count in that month, not this one.`
    : `Recorded as of ${pretty} — it counts in that month's revenue, and NO receipt or `
      + 'notice is sent, because the money arrived months ago.';
}
