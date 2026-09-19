import { useEffect, useState } from 'react';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../../lib/hooks';
import {
  atnHistory, restoreTask, hardDeleteTask, type HistoryItem,
} from '../../../lib/ops/api-atn';
import { toErrorMessage } from '../../../lib/ops/errors';

/**
 * ATN HISTORY (/app/ops/history) — everything that has left the dashboard:
 * completed and cancelled tasks, dismissed alerts, seen/dismissed notifications.
 * Nothing is lost (D32). Reached from an out-of-the-way link, not a nav row
 * (owner). A task can be restored to the board or hard-deleted (the D32 scrub
 * exception, staff-confirmed).
 */
const KIND_LABEL: Record<HistoryItem['kind'], string> = {
  task: 'Task', alert: 'Alert', notification: 'Notification',
};

export default function AtnHistoryPage() {
  useDocumentTitle('History');
  const navigate = useNavigate();
  const [rows, setRows] = useState<HistoryItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | HistoryItem['kind']>('all');

  const load = () => {
    atnHistory().then(setRows).catch((e) => setErr(toErrorMessage(e, 'Could not load history.')));
  };
  useEffect(load, []);

  const shown = (rows ?? []).filter((r) => filter === 'all' || r.kind === filter);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-0 py-2">
      <div className="mb-3 mt-2">
        <button type="button" onClick={() => navigate('/app/dashboard')}
          className="inline-flex items-center gap-1.5 text-sm text-green-800 hover:text-green-900 focus-ring rounded">
          <ArrowLeft size={16} /> Back to the dashboard
        </button>
      </div>
      <h1 className="font-serif text-2xl text-green-900 mb-1">History</h1>
      <p className="text-sm text-muted mb-4">
        Completed tasks, and every alert and notification that has left the dashboard.
        Nothing is ever lost — restore a task to the board, or remove it for good.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {(['all', 'task', 'alert', 'notification'] as const).map((k) => (
          <button key={k} type="button" aria-pressed={filter === k}
            className={`rounded-full px-3.5 py-1.5 text-sm border transition-colors ${
              filter === k ? 'border-green-800 bg-green-800 text-white'
                : 'border-green-800/20 bg-white text-green-900 hover:border-green-800/40'}`}
            onClick={() => setFilter(k)}>
            {k === 'all' ? 'All' : `${KIND_LABEL[k]}s`}
          </button>
        ))}
      </div>

      {err && <p role="alert" className="form-error mb-3">{err}</p>}
      {!rows ? <p className="text-sm text-muted">Loading…</p>
        : shown.length === 0 ? <p className="text-sm text-muted">Nothing here.</p>
        : (
          <ol className="flex flex-col gap-1.5">
            {shown.map((h) => (
              <li key={`${h.kind}:${h.id}`}
                className="rounded-lg border border-green-800/10 bg-white px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-green-900 truncate">{h.title}</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {KIND_LABEL[h.kind]}{h.detail ? ` · ${h.detail}` : ''}
                    {h.at ? ` · ${new Date(h.at).toLocaleString()}` : ''}
                  </p>
                </div>
                {h.kind === 'task' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" title="Restore to the board"
                      onClick={() => void restoreTask(h.id).then(load).catch((e) => setErr(toErrorMessage(e, 'Could not restore.')))}
                      className="p-1.5 text-green-800 hover:bg-green-50 rounded focus-ring">
                      <RotateCcw size={15} />
                    </button>
                    <button type="button" title="Delete permanently"
                      onClick={() => {
                        if (!window.confirm('Permanently delete this task? This cannot be undone.')) return;
                        void hardDeleteTask(h.id).then(load).catch((e) => setErr(toErrorMessage(e, 'Could not delete.')));
                      }}
                      className="p-1.5 text-red-700 hover:bg-red-50 rounded focus-ring">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
    </div>
  );
}
