/**
 * StatusLog — the append-only status timeline for one entity (Phase 3).
 *
 * The TRUE status is shown prominently by the caller (a StatusBadge). This
 * component renders the LOG: every event newest-first, with true-status events
 * marked distinctly from sub-status / log entries (delivered, viewed, resent,
 * failed…), so the two axes stay legible but separate — never conflated.
 *
 * Presentational: pass the entries (fetch via entityStatusLog). A compact prop
 * renders a tight inline list; otherwise a spaced timeline.
 */
import { StatusBadge } from './StatusBadge';
import { statusTone, type StatusLogEntry } from '../../../lib/ops/api-status';

export interface StatusLogProps {
  entries: StatusLogEntry[];
  compact?: boolean;
  emptyLabel?: string;
  className?: string;
}

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function StatusLog({ entries, compact, emptyLabel = 'No activity yet.', className }: StatusLogProps) {
  if (!entries.length) {
    return <p className={`text-xs text-muted ${className ?? ''}`}>{emptyLabel}</p>;
  }
  return (
    <ol className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-3'} ${className ?? ''}`}>
      {entries.map((e, i) => (
        <li key={`${e.status}-${e.created_at}-${i}`} className="flex items-start gap-2.5 text-sm">
          <span aria-hidden="true"
            className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${e.is_true_status ? 'bg-green-700' : 'bg-green-800/25'}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {e.is_true_status ? (
                <StatusBadge status={e.display_name} tone={statusTone(e.status)} />
              ) : (
                <span className="text-green-900/70">{e.display_name}</span>
              )}
              <time className="text-xs text-muted" dateTime={e.created_at}>{when(e.created_at)}</time>
            </div>
            {e.detail && <p className="text-xs text-muted mt-0.5 break-words">{e.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
