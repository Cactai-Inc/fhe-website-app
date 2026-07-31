import { useCallback, useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { contractChangeLog, type ContractChange } from '../../lib/contracts';
import { ContractDrawer, DrawerRow } from './ContractDrawer';

/**
 * CHANGE HISTORY — the same look and interaction model as the change-request
 * panel, with a GREEN accent (vs the requests panel's gold) so a reader can tell
 * them apart instantly: gold = an open conversation, green = a settled record.
 *
 * Sourced from the existing change-log machinery (`contract_change_log` via
 * `contract_change_log_list`) — not duplicated. 178 rows live there today.
 *
 * SECTION ATTRIBUTION IS SERVER-SIDE. `contract_change_log_list` resolves every
 * row to its owning section and stamps the LIVE number + title from
 * `contract_section_tree`, so the numbers always match the composed document.
 * This component does NOT parse field keys — the previous version split
 * field_key on '.' and looked up the leading token, which failed for all 178
 * rows because every key begins with `TXN.`, not a section key.
 *
 * BUNDLING (owner offered either option; this is the choice): changes are
 * GROUPED UNDER THEIR SECTION, with the section number shown ONCE as a group
 * header. Repeating "13." down a column of 20 rows was noise; one header plus
 * nested rows is what makes the change readable in context. Each row still
 * carries its own subsection number ("13.4") where it resolves that far, so
 * bundling costs no precision.
 *
 * Each row is ONE BIG BUTTON (no "show" link): chevron-down closed, chevron-up
 * open. Opening it reveals what changed, rendered as a diff — text changes show
 * the old value struck through with an arrow to the new one; selection changes
 * render simply, e.g. [Yes] → [No].
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
  document_voided: 'Document voided',
};

/** A short value looks like a selection ("Yes", "ENTITY") rather than prose. */
function isSelection(v: string | null): boolean {
  if (!v) return false;
  const t = v.trim();
  return t.length > 0 && t.length <= 24 && !/\s{2,}/.test(t) && t.split(/\s+/).length <= 3;
}

function actorName(c: ContractChange): string {
  if (c.actor_is_staff) return `${c.actor_label ?? 'Staff'} (staff)`;
  const role = c.actor_roles?.[0];
  return role
    ? `${c.actor_label ?? 'A party'} (${role.charAt(0) + role.slice(1).toLowerCase()})`
    : (c.actor_label ?? 'A party');
}

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch { return ''; }
}

/** The diff body: selections render as chips, text renders struck-through → new. */
function Diff({ oldValue, newValue }: { oldValue: string | null; newValue: string | null }) {
  const selection = isSelection(oldValue) && isSelection(newValue);

  if (selection) {
    return (
      <p className="text-[13px] flex items-center gap-2 flex-wrap">
        <span className="rounded border border-green-800/20 bg-cream-100 px-1.5 py-0.5 text-secondary">
          {oldValue}
        </span>
        <span className="text-muted" aria-label="changed to">→</span>
        <span className="rounded border border-green-700/40 bg-green-50 px-1.5 py-0.5 text-green-900 font-medium">
          {newValue}
        </span>
      </p>
    );
  }

  return (
    <p className="text-[13px] text-green-900 leading-snug">
      {oldValue
        ? <span className="line-through text-muted">{oldValue}</span>
        : <span className="text-muted italic">empty</span>}
      <span className="text-muted mx-1.5" aria-label="changed to">→</span>
      {newValue
        ? <span className="font-medium bg-green-50 px-1 rounded">{newValue}</span>
        : <span className="text-muted italic">cleared</span>}
    </p>
  );
}

export function ContractChangeHistory({
  documentId, refreshKey = 0, inDrawer = false,
}: {
  documentId: string;
  refreshKey?: number;
  /** Rendered inside the contract subheader's drawer, which already scrolls.
   *  Passes through so the row list does not open a second scroll box. */
  inDrawer?: boolean;
}) {
  const [changes, setChanges] = useState<ContractChange[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    contractChangeLog(documentId).then(setChanges).catch(() => setChanges([]));
  }, [documentId]);
  useEffect(() => { load(); }, [load, refreshKey]);

  // Sequential change numbers, oldest = 1 (the log arrives newest-first), then
  // BUNDLED by section in the order the sections appear in the document.
  const groups = useMemo(() => {
    const list = changes ?? [];
    const total = list.length;
    const numbered = list.map((c, i) => ({ c, n: total - i }));

    const byKey = new Map<string, { key: string; number: string | null; title: string; rows: typeof numbered }>();
    for (const item of numbered) {
      // the server already resolved this; unattributed is the genuine leftover
      const key = item.c.section_key ?? '__none__';
      const g = byKey.get(key) ?? {
        key,
        number: item.c.section_number ?? null,
        title: item.c.section_title ?? 'Not tied to a numbered section',
        rows: [] as typeof numbered,
      };
      g.rows.push(item);
      byKey.set(key, g);
    }

    // document order: by section number ascending; unnumbered last
    return [...byKey.values()].sort((a, b) => {
      const an = a.number ? parseInt(a.number, 10) : Number.MAX_SAFE_INTEGER;
      const bn = b.number ? parseInt(b.number, 10) : Number.MAX_SAFE_INTEGER;
      return an - bn;
    });
  }, [changes]);

  const count = changes?.length ?? 0;

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <History size={15} className="text-green-800" aria-hidden="true" />
        <h3 className="font-serif text-green-800 text-sm">Change history</h3>
        <span className="text-[11px] text-muted">
          {count > 0 ? `${count} change${count === 1 ? '' : 's'}` : 'no changes yet'}
        </span>
      </div>

      {changes === null ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : changes.length === 0 ? (
        <p className="text-sm text-muted">
          No changes recorded yet. Edits to fields and terms show here as they happen.
        </p>
      ) : (
        /* BUNDLED BY SECTION — the number appears ONCE, on the group header, and
           every change inside belongs to it. Subsection numbers stay on the rows. */
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.key}>
              <p className="text-[12px] mb-1.5 flex items-baseline gap-2">
                {g.number && (
                  <span className="tabular-nums font-semibold text-gold-ink">{g.number}.</span>
                )}
                <span className="text-green-900 font-medium">{g.title}</span>
                <span className="text-[11px] text-muted">
                  {g.rows.length} change{g.rows.length === 1 ? '' : 's'}
                </span>
              </p>
              <ContractDrawer accent="history" openKey={open} unbounded={inDrawer}>
                {g.rows.map(({ c, n }) => {
                  const kind = KIND_LABEL[c.change_kind] ?? c.change_kind;
                  const title = c.field_label ?? c.field_key ?? kind;
                  return (
                    <div key={c.id} data-row-key={c.id}>
                      <DrawerRow
                        accent="history"
                        open={open === c.id}
                        onToggle={() => setOpen((k) => (k === c.id ? null : c.id))}
                        /* the finer subsection number where the row has one,
                           else the sequential change number */
                        number={c.clause_number ?? `#${n}`}
                        title={title}
                        subtitle={`${kind} · ${actorName(c)} · ${when(c.created_at)}`}
                      >
                        <div className="flex flex-col gap-1.5 pt-1.5">
                          {(c.clause_number || c.clause_title) && (
                            <p className="text-[11px] text-muted">
                              In{' '}
                              <span className="text-green-900 font-medium">
                                {[c.clause_number, c.clause_title].filter(Boolean).join(' ')}
                              </span>
                            </p>
                          )}
                          {(c.old_value || c.new_value)
                            ? <Diff oldValue={c.old_value} newValue={c.new_value} />
                            : <p className="text-[13px] text-muted italic">{kind}.</p>}
                          {c.owner_role && (
                            <p className="text-[11px] text-muted">
                              {c.owner_role.charAt(0) + c.owner_role.slice(1).toLowerCase()}&rsquo;s field
                            </p>
                          )}
                        </div>
                      </DrawerRow>
                    </div>
                  );
                })}
              </ContractDrawer>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default ContractChangeHistory;
