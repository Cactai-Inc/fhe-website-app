import { useCallback, useEffect, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { contractChangeLog, type ContractChange } from '../../lib/contracts';

/**
 * TRACK CHANGES — always-on history of what changed on a contract and who
 * changed it, read from contract_change_log. Every party sees the changes the
 * others made to the core prose and to the inputs they authored. Also serves as
 * the human-readable face of the retained audit trail.
 *
 * Presentational + self-loading: give it a documentId and a refreshKey (bump to
 * reload after an edit). Purely a reader — the log is written server-side.
 */

const KIND_LABEL: Record<string, string> = {
  field_value: 'Field edited',
  field_structured: 'Field edited',
  field_edit_accept: 'Suggested edit accepted',
  field_edit_reject: 'Suggested edit rejected',
  clause_accept: 'Clause accepted',
  clause_reject: 'Clause rejected',
  change_req_accept: 'Change request accepted',
  change_req_reject: 'Change request rejected',
  prose_recompose: 'Document text updated',
};

function actorName(c: ContractChange): string {
  if (c.actor_is_staff) return `${c.actor_label ?? 'Staff'} (staff)`;
  const role = c.actor_roles?.[0];
  return role ? `${c.actor_label ?? 'A party'} (${role.charAt(0) + role.slice(1).toLowerCase()})` : (c.actor_label ?? 'A party');
}

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch { return ''; }
}

export function TrackChangesPanel({
  documentId, refreshKey = 0, defaultOpen = false,
}: { documentId: string; refreshKey?: number; defaultOpen?: boolean }) {
  const [changes, setChanges] = useState<ContractChange[] | null>(null);
  const [open, setOpen] = useState(defaultOpen);

  const load = useCallback(() => {
    contractChangeLog(documentId).then(setChanges).catch(() => setChanges([]));
  }, [documentId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const count = changes?.length ?? 0;

  return (
    <section className="bg-white border border-green-800/10 rounded-xl p-5">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-left focus-ring rounded">
        <History size={16} className="text-gold-ink" aria-hidden="true" />
        <h2 className="font-serif text-green-800">Change history</h2>
        <span className="text-xs text-muted ml-1">{count > 0 ? `${count} change${count === 1 ? '' : 's'}` : 'no changes yet'}</span>
        <span className="ml-auto text-xs text-secondary underline">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-3">
          {changes === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : changes.length === 0 ? (
            <p className="text-sm text-muted">No changes recorded yet. Edits to fields and terms show here as they happen.</p>
          ) : (
            <ol className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {changes.map((c) => (
                <li key={c.id} className="border-l-2 border-gold-300 pl-3 py-1">
                  <p className="text-[11px] text-muted mb-0.5 flex items-center gap-1.5">
                    <RotateCcw size={11} aria-hidden="true" />
                    {KIND_LABEL[c.change_kind] ?? c.change_kind}
                    {c.field_label ? ` · ${c.field_label}` : c.field_key ? ` · ${c.field_key}` : ''}
                    {c.owner_role ? ` · ${c.owner_role.charAt(0) + c.owner_role.slice(1).toLowerCase()}` : ''}
                  </p>
                  {(c.old_value || c.new_value) && (
                    <p className="text-[13px] text-green-900 leading-snug">
                      {c.old_value ? <span className="line-through text-muted">{c.old_value}</span> : <span className="text-muted italic">empty</span>}
                      <span className="text-muted mx-1.5">→</span>
                      {c.new_value ? <span className="font-medium bg-gold-50 px-1 rounded">{c.new_value}</span> : <span className="text-muted italic">cleared</span>}
                    </p>
                  )}
                  <p className="text-[11px] text-muted mt-0.5">{actorName(c)} · {when(c.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

export default TrackChangesPanel;
