import { useCallback, useEffect, useState } from 'react';
import { History, ChevronDown, ChevronUp } from 'lucide-react';
import { contractEventLog, type ContractEventLogRow } from '../../lib/contracts';

/**
 * A14 — staff-only unified activity feed for a document: status changes, sends,
 * signatures, opens, and per-day edit summaries, sourced read-only from existing
 * tables (no new capture). Collapsed by default (count + latest event); expands
 * to the full reverse-chronological list.
 */

const KIND_LABEL: Record<ContractEventLogRow['kind'], string> = {
  STATUS: 'Status',
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  SIGNED: 'Signed',
  EDITS: 'Edited',
  OPENED: 'Opened',
};

const KIND_CLASS: Record<ContractEventLogRow['kind'], string> = {
  STATUS: 'bg-cream-100 text-secondary border-green-800/20',
  SENT: 'bg-gold-50 text-gold-900 border-gold-400/50',
  DELIVERED: 'bg-gold-50 text-gold-900 border-gold-400/50',
  SIGNED: 'bg-green-50 text-green-900 border-green-700/30',
  EDITS: 'bg-cream-100 text-secondary border-green-800/20',
  OPENED: 'bg-cream-100 text-secondary border-green-800/20',
};

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

export function ContractActivityCard({ documentId }: { documentId: string }) {
  const [rows, setRows] = useState<ContractEventLogRow[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await contractEventLog(documentId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity');
    }
  }, [documentId]);

  useEffect(() => { void load(); }, [load]);

  if (error) return null;
  if (!rows) return null;

  const latest = rows[0];

  return (
    <div className="bg-white border border-green-800/10 rounded-xl p-5 sm:p-6 mb-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between gap-3 text-left focus-ring rounded-lg"
      >
        <span className="inline-flex items-center gap-2">
          <History size={15} className="text-secondary" aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-wide text-muted">Activity</span>
          <span className="text-[12px] text-secondary">
            {rows.length} event{rows.length === 1 ? '' : 's'}
            {latest ? ` · latest: ${KIND_LABEL[latest.kind]} by ${latest.actor}` : ''}
          </span>
        </span>
        {expanded
          ? <ChevronUp size={16} className="shrink-0 text-secondary" aria-hidden="true" />
          : <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="mt-4 flex flex-col gap-1.5">
          {rows.length === 0 && (
            <p className="text-[13px] text-muted">No activity recorded yet.</p>
          )}
          {rows.map((r, i) => (
            <div key={`${r.kind}-${r.occurred_at}-${i}`} className="flex items-start gap-2.5 py-1.5 border-t border-green-800/8 first:border-t-0 first:pt-0">
              <span className="shrink-0 mt-0.5 text-[11px] text-muted tabular-nums w-[108px]">{when(r.occurred_at)}</span>
              <span className={`shrink-0 mt-0.5 text-[11px] font-medium rounded border px-1.5 py-0.5 ${KIND_CLASS[r.kind]}`}>
                {KIND_LABEL[r.kind]}
              </span>
              <span className="min-w-0 flex-1 text-[13px] text-green-950 leading-snug">
                <span className="font-medium">{r.actor}</span>
                {r.detail ? <span className="text-secondary"> — {r.detail}</span> : null}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ContractActivityCard;
