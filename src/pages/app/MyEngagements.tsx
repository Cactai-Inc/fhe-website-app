import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Briefcase } from 'lucide-react';
import { listMyEngagements } from '../../lib/ops/api-client';
import { useDocumentTitle } from '../../lib/hooks';
import type { Engagement } from '../../lib/ops/types';

/** Humanize a SERVICE_TYPE / STATUS code: HORSE_PURCHASE_ASSISTANCE → "Horse Purchase Assistance".
 *  NULL-safe: non-service engagements (e.g. a visitor-release kiosk engagement)
 *  carry service_type NULL and label as "General". */
export const labelFor = (code: string | null | undefined) =>
  code
    ? code.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : 'General';

/**
 * MEMBER-ENG-LIST — the member's own engagements (RLS: engagements_select
 * scopes rows to the caller's client, 20260629030000).
 */
export default function MyEngagements() {
  useDocumentTitle('Your Engagements');
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listMyEngagements()
      .then((rows) => active && setEngagements(rows))
      .catch(() => active && setEngagements([]))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="max-w-3xl">
      <p className="eyebrow mb-2">Your engagements</p>
      <h1 className="heading-section text-green-800 mb-8">The work we're doing together.</h1>

      {loading ? (
        <p className="body-text text-muted">Loading…</p>
      ) : engagements.length === 0 ? (
        <div className="bg-white border border-green-800/10 p-8 text-center">
          <p className="body-text text-sm">No engagements yet. When we open one together, it'll appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {engagements.map((e) => (
            <Link
              key={e.id}
              to={`/app/engagements/${e.id}`}
              className="bg-white border border-green-800/10 p-5 flex items-center justify-between hover:shadow-md transition-shadow focus-ring"
            >
              <div className="flex items-start gap-3">
                <Briefcase size={18} className="text-gold-ink flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-sans font-medium text-green-900">
                    {labelFor(e.service_type)}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {e.display_code ? `${e.display_code} · ` : ''}
                    {labelFor(e.status)}
                    {e.start_date ? ` · started ${new Date(e.start_date).toLocaleDateString()}` : ''}
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-green-800/40" aria-hidden="true" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
