import { useCallback, useEffect, useState } from 'react';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  listSupportRequests, setSupportStatus,
  type SupportRequest, type SupportStatus,
} from '../../../lib/support';

/**
 * OPS SUPPORT (Slice 5, /app/ops/support) — the admin support inbox. Members
 * submit from Account; admins triage here: open → in progress → resolved. Admin-only.
 */
const TABS: { id: SupportStatus | 'all'; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All' },
];

const STATUS_CLASS: Record<SupportStatus, string> = {
  open: 'bg-gold-50 text-gold-ink',
  in_progress: 'bg-green-800/10 text-green-800',
  resolved: 'bg-green-50 text-green-700',
};

export default function SupportPage() {
  useDocumentTitle('Support');
  const [tab, setTab] = useState<SupportStatus | 'all'>('open');
  const [rows, setRows] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (which: SupportStatus | 'all') => {
    setLoading(true);
    try {
      setRows(await listSupportRequests(which === 'all' ? undefined : which));
      setError(null);
    } catch {
      setError('Could not load support requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  async function move(r: SupportRequest, status: SupportStatus) {
    try {
      await setSupportStatus(r.id, status);
      await load(tab);
    } catch {
      setError('That action failed.');
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="font-serif text-2xl text-green-900 mb-1">Support</h1>
      <p className="text-sm text-green-800/70 mb-6">Member support requests — triage and resolve.</p>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-sans ${
              tab === t.id ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="form-error mb-4">{error}</p>}
      {loading && <p className="text-sm text-green-800/70">Loading…</p>}
      {!loading && rows.length === 0 && (
        <p className="text-sm text-green-800/70">Nothing here.</p>
      )}

      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.id} className="bg-white border border-green-800/10 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3 mb-1">
              <p className="text-sm font-sans font-medium text-green-900">{r.subject}</p>
              <span className={`text-xs font-sans px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_CLASS[r.status]}`}>
                {r.status.replace('_', ' ')}
              </span>
            </div>
            <p className="body-text text-sm text-green-900/90 whitespace-pre-line mb-2">{r.body}</p>
            <p className="text-xs text-muted mb-3">{new Date(r.created_at).toLocaleString()}</p>
            <div className="flex flex-wrap gap-2">
              {r.status !== 'in_progress' && r.status !== 'resolved' && (
                <button type="button" className="btn-secondary text-xs" onClick={() => move(r, 'in_progress')}>
                  Start
                </button>
              )}
              {r.status !== 'resolved' && (
                <button type="button" className="btn-primary text-xs" onClick={() => move(r, 'resolved')}>
                  Resolve
                </button>
              )}
              {r.status === 'resolved' && (
                <button type="button" className="btn-secondary text-xs" onClick={() => move(r, 'open')}>
                  Reopen
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
