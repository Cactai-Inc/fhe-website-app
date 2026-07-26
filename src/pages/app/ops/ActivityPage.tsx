import { useCallback, useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { useDocumentTitle } from '../../../lib/hooks';
import { StatusBadge } from '../../../lib/ops';
import {
  statusFeed, statusTone, type StatusFeedEntry, type StatusEntity,
} from '../../../lib/ops/api-status';

/**
 * ACTIVITY — the org-wide aggregate status feed (Phase 3). One place to see the
 * lifecycle of every account, document, order, and offering: the TRUE status of
 * each event shown as a prominent badge, sub-status/log entries shown adjacent
 * but visually distinct. Filter by entity type; toggle to true-status-only.
 * Per-item timelines live on each entity's own row (StatusLog) — this is the
 * cross-entity roll-up.
 */

const ENTITY_TABS: { key: StatusEntity | 'all'; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'account', label: 'Accounts' },
  { key: 'document', label: 'Documents' },
  { key: 'order', label: 'Orders' },
  { key: 'offering', label: 'Offerings' },
];

const ENTITY_LABEL: Record<StatusEntity, string> = {
  account: 'Account', document: 'Document', order: 'Order', offering: 'Offering',
};

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ActivityPage() {
  useDocumentTitle('Activity');
  const [tab, setTab] = useState<StatusEntity | 'all'>('all');
  const [trueOnly, setTrueOnly] = useState(false);
  const [rows, setRows] = useState<StatusFeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await statusFeed({ entityType: tab === 'all' ? null : tab, trueOnly, limit: 200 }));
      setError(null);
    } catch { setError('Could not load activity.'); }
    finally { setLoading(false); }
  }, [tab, trueOnly]);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 mb-1">
        <Activity size={20} className="text-green-700" aria-hidden="true" />
        <h1 className="font-serif text-2xl text-green-900">Activity</h1>
      </div>
      <p className="text-sm text-green-800/70 mb-5">
        Every status change across accounts, documents, orders, and offerings —
        newest first. The prominent badge is the true status; muted rows are
        sub-status and delivery/log events.
      </p>

      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {ENTITY_TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                tab === t.key ? 'bg-green-800 text-white' : 'bg-green-800/8 text-green-800 hover:bg-green-800/15'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-green-900">
          <input type="checkbox" checked={trueOnly} onChange={(e) => setTrueOnly(e.target.checked)} />
          True status only
        </label>
      </div>

      {error && <p className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded mb-3">{error}</p>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No activity in this view yet.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-green-800/8 border border-green-800/10 rounded-lg overflow-hidden">
          {rows.map((r, i) => (
            <li key={`${r.entity_id}-${r.created_at}-${i}`}
              className="flex items-start gap-3 px-4 py-2.5 bg-white">
              <span aria-hidden="true"
                className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${r.is_true_status ? 'bg-green-700' : 'bg-green-800/25'}`} />
              <span className="text-xs uppercase tracking-wide text-green-800/50 w-20 shrink-0 mt-1">
                {ENTITY_LABEL[r.entity_type]}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {r.is_true_status ? (
                    <StatusBadge status={r.display_name} tone={statusTone(r.status)} />
                  ) : (
                    <span className="text-sm text-green-900/70">{r.display_name}</span>
                  )}
                  <time className="text-xs text-muted" dateTime={r.created_at}>{when(r.created_at)}</time>
                </div>
                {r.detail && <p className="text-xs text-muted mt-0.5 break-words">{r.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
