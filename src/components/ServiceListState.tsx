import { Link } from 'react-router-dom';
import { BRAND } from '../lib/brand';

/**
 * The loading / error / empty notice for a public booking funnel's service list.
 *
 * COUNTFIX 1.5: all three funnels (`/book/rider`, `/horse`, `/acquisition`)
 * rendered `{groups.map(...)}` with no branch for "nothing came back" and a
 * `.catch(() => setGroups([]))` that turned a failed fetch into the same blank
 * area. `/acquisition` — one of four entries in the marketing site's primary
 * navigation — therefore rendered a heading, a step indicator and nothing else,
 * with "Continue" disabled and no explanation. One notice, three funnels, so the
 * three cannot drift into three different silences.
 */
export default function ServiceListState({
  state,
  emptyLead = 'These services are arranged personally rather than booked online.',
}: {
  state: 'loading' | 'error' | 'empty';
  /** What the page should say when the segment genuinely has nothing bookable. */
  emptyLead?: string;
}) {
  if (state === 'loading') {
    return <p className="body-text text-muted text-sm">Loading our services…</p>;
  }

  const lead =
    state === 'error'
      ? 'We could not load our services just now. Please try again in a moment — or simply reach out and we will take it from there.'
      : emptyLead;

  return (
    <div
      {...(state === 'error' ? { role: 'alert' as const } : {})}
      className="border border-green-800/10 bg-white p-6 sm:p-8"
    >
      <p className="body-text mb-4">{lead}</p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <a href={BRAND.emailHref} className="link-underline">
          {BRAND.email}
        </a>
        <span className="hidden sm:inline text-green-800/25" aria-hidden="true">
          ·
        </span>
        <a href={BRAND.phoneHref} className="link-underline">
          {BRAND.phoneDisplay}
        </a>
        <span className="hidden sm:inline text-green-800/25" aria-hidden="true">
          ·
        </span>
        {/* Was /shop (now hidden, owner 2026-08-16) — the rider funnel is the
            closest honest destination for "what else do you offer". */}
        <Link to="/lessons" className="link-underline">
          See our riding lessons
        </Link>
      </div>
    </div>
  );
}
