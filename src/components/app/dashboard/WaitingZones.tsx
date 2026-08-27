import { Link } from 'react-router-dom';
import type { WaitingRow } from '../../../lib/ops/api-dashboard';
import {
  contactHref, dealHref, documentHref, purchaseHref,
} from '../../../lib/dashboard/registry';
import { ageLabel } from '../../../lib/dashboard/format';

/**
 * W1 · WAITING ON YOU and W2 · WAITING ON A CLIENT.
 *
 * Owner, 2026-08-26: *"I dont need a section dedicated to contracts and deals,
 * or anything specific like that, I need to just have visibility over what is
 * happening and what is waiting for a next action by me or a client. Then i
 * need kpi's. Thats it."*
 *
 * One component, two zones, because the only difference between them is which
 * side of `_waiting_items()` they read. Four department zones fold in here —
 * money, deals & contracts, catalog setup, onboarding pipeline.
 *
 * ⚠️ NO IDENTIFIERS ON A CARD. Same message, about the row this replaces:
 * *"shows an obscure string of characters that are undoubtedly an id number
 * that is completely fucking useless to me."* A row shows the act, the person,
 * and how long it has been sitting. `DOC-GCQ4RBNQUN` is not information.
 *
 * ⚠️ AND THE ROW MUST BE TRUE. The card this replaces said "Yours to sign" on
 * a document with `sent_at IS NULL` and zero signatures on it — a document that
 * had never been sent to anybody. The reader now separates "not sent yet"
 * (yours) from "sent, unsigned by us" (yours) from "sent, unsigned by them"
 * (theirs), so a row cannot claim a signature is owed on paper nobody has seen.
 */

/** The row's destination. Composed HERE and not in SQL, for the registry's own
 *  stated reason: the route table lives in the app, so a link built in the
 *  database goes stale silently the next time a page moves. */
function hrefFor(r: WaitingRow): string | undefined {
  switch (r.link_kind) {
    case 'document': return documentHref(r.link_id);
    case 'deal':     return dealHref(r.link_id);
    case 'contact':  return contactHref(r.link_id);
    case 'purchase': return purchaseHref();
    case 'catalog':  return '/app/ops/admin/products';
    default:         return undefined;
  }
}

const hoursSince = (iso: string) => Math.max(0, (Date.now() - new Date(iso).getTime()) / 36e5);

/** Rows that have gone quiet for too long read louder. A week is the line the
 *  money reader already uses for "no longer simply new". */
const STALE_HOURS = 24 * 7;

function WaitingList({ items, tone }: { items: WaitingRow[]; tone: 'you' | 'client' }) {
  return (
    <ul className="divide-y divide-green-900/8 overflow-hidden rounded-lg border border-green-900/10 bg-white/60">
      {items.map((r) => {
        const href = hrefFor(r);
        const hrs = hoursSince(r.since);
        const stale = hrs > STALE_HOURS;
        const body = (
          <>
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 text-[0.86rem] font-semibold text-green-900">
                {r.title}
              </span>
              <span className={`shrink-0 text-[0.7rem] ${
                stale && tone === 'you' ? 'font-semibold text-red-700' : 'text-green-800/45'
              }`}>
                {ageLabel(hrs)}
              </span>
            </div>
            {(r.who || r.detail) && (
              <p className="mt-1 text-[0.78rem] leading-snug text-green-800/60">
                {r.who}
                {r.who && r.detail ? ' · ' : ''}
                {r.detail}
              </p>
            )}
          </>
        );
        return (
          <li key={`${r.kind}-${r.id}`} className="transition-colors duration-320 ease-glide hover:bg-cream-100/60">
            {href
              ? <Link to={href} className="block px-3.5 py-2.5 focus-ring">{body}</Link>
              : <div className="px-3.5 py-2.5">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export function WaitingOnYouZone({ items }: { items: WaitingRow[] }) {
  return <WaitingList items={items} tone="you" />;
}

export function WaitingOnClientsZone({ items }: { items: WaitingRow[] }) {
  return <WaitingList items={items} tone="client" />;
}
