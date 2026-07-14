import { useEffect, useState } from 'react';
import { Users, LifeBuoy, Image, Flag } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import { adminOversight, type Oversight } from '../../../lib/support';

/**
 * OPS OVERSIGHT (Slice 5, /app/ops/oversight) — the admin's watch panel: usage
 * numbers + recent activity from the audit log (message/moderation/record events).
 * Admin-only (total control). Consolidates activity logs + usage + a moderation
 * pointer into one glanceable surface.
 */
const CARDS: { key: keyof Oversight['usage']; label: string; icon: typeof Users }[] = [
  { key: 'members', label: 'Members', icon: Users },
  { key: 'open_support', label: 'Open support', icon: LifeBuoy },
  { key: 'feed_posts', label: 'Live posts', icon: Image },
  { key: 'flagged_posts', label: 'Flagged', icon: Flag },
];

export default function OversightPage() {
  useDocumentTitle('Oversight');
  const [data, setData] = useState<Oversight | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminOversight()
      .then(setData)
      .catch(() => setError('Could not load oversight.'));
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Oversight</h1>
      <p className="text-sm text-green-800/70 mb-6">Usage at a glance and the latest activity.</p>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {!data && !error && <p className="text-sm text-green-800/70">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            {CARDS.map(({ key, label, icon: Icon }) => (
              <div key={key} className="bg-white border border-green-800/10 rounded-lg p-4">
                <Icon size={18} className="text-gold-ink mb-2" aria-hidden="true" />
                <p className="font-serif text-2xl text-green-800">{data.usage[key]}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>

          <h2 className="font-serif font-medium text-green-800 text-xl mb-3">Recent activity</h2>
          {data.activity.length === 0 ? (
            <p className="text-sm text-green-800/70">No activity logged.</p>
          ) : (
            <div className="bg-white border border-green-800/10 rounded-lg divide-y divide-green-800/10">
              {data.activity.map((a, i) => (
                <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                  <span className="font-sans text-green-900">
                    <span className="font-medium">{a.action}</span>
                    {a.table_name ? <span className="text-muted"> · {a.table_name}</span> : null}
                  </span>
                  <span className="text-xs text-muted whitespace-nowrap">
                    {new Date(a.occurred_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
