import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TemplateEditorToken } from '../../../lib/templateEditor';

/**
 * TOKEN PICKER (TASK-TEXTEDIT) — the 307-row template_tokens library, grouped
 * by namespace, insert-at-cursor. The table is the data (not
 * docs/design/TOKEN_DICTIONARY.md): each row shows its TOKENAUDIT-authored note and
 * what it resolves to (source_table.source_column, or "computed"). Two honesty
 * badges the owner asked for in effect if not in words:
 *   party-scoped   — meaningless where no party context exists; dropping one
 *                    into a partyless document renders blank and looks broken.
 *   source retired — TOKENAUDIT found 59 tokens pointing at tables that no
 *                    longer exist; presenting that wiring as live would be the
 *                    surface-reports-success failure this codebase repeats.
 * Global tokens and template-specific tokens are both shown, distinguished;
 * specific tokens of OTHER templates are filtered out of this editor.
 */

interface TokenPickerProps {
  tokens: TemplateEditorToken[];
  /** template_key of the template being edited — filters template-bound tokens. */
  templateKey: string;
  /** Insert the literal {{TOKEN}} text at the caret of the active editor. */
  onInsert: (tokenText: string) => void;
  /** No textarea focused yet — insertion has nowhere to go. */
  insertDisabled: boolean;
}

function TokenRow({ t, onInsert, insertDisabled }: {
  t: TemplateEditorToken; onInsert: (s: string) => void; insertDisabled: boolean;
}) {
  const resolves = t.computed
    ? 'computed at merge time'
    : t.source_table
      ? `${t.source_table}.${t.source_column ?? '?'}`
      : 'no source recorded';
  return (
    <div className="px-3 py-2 border-t border-green-800/5 first:border-t-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={insertDisabled}
          onClick={() => onInsert(t.token)}
          title={insertDisabled ? 'Click into the text first, then insert' : `Insert ${t.token}`}
          className="font-mono text-[12px] text-green-900 bg-green-50 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed px-1.5 py-0.5 rounded border border-green-800/15 focus-ring text-left break-all"
        >
          {t.token}
        </button>
        {t.party_scoped && (
          <span className="text-[9px] tracking-wide uppercase px-1 py-0.5 rounded bg-gold-800/10 text-gold-800 border border-gold-800/25 shrink-0"
            title="Only meaningful where the document has parties — renders blank otherwise.">
            party-scoped
          </span>
        )}
        {!t.computed && t.source_table && !t.source_live && (
          <span className="text-[9px] tracking-wide uppercase px-1 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 shrink-0"
            title={`Recorded source ${t.source_table} no longer exists (TOKENAUDIT).`}>
            source retired
          </span>
        )}
        {t.template_key && (
          <span className="text-[9px] tracking-wide uppercase px-1 py-0.5 rounded bg-cream-100 text-muted border border-green-800/10 shrink-0"
            title={`Belongs to ${t.template_key} only.`}>
            this template
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-muted mt-1 leading-snug">
        <span className="text-secondary">→ {resolves}</span>
        {t.notes ? ` — ${t.notes}` : ''}
      </p>
    </div>
  );
}

export function TokenPicker({ tokens, templateKey, onInsert, insertDisabled }: TokenPickerProps) {
  const [query, setQuery] = useState('');
  const [openNs, setOpenNs] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tokens
      .filter((t) => t.template_key === null || t.template_key === templateKey)
      .filter((t) => !q
        || t.token.toLowerCase().includes(q)
        || (t.notes ?? '').toLowerCase().includes(q)
        || (t.source_table ?? '').toLowerCase().includes(q));
  }, [tokens, templateKey, query]);

  const namespaces = useMemo(() => {
    const by = new Map<string, TemplateEditorToken[]>();
    for (const t of visible) {
      const list = by.get(t.namespace) ?? [];
      list.push(t);
      by.set(t.namespace, list);
    }
    return Array.from(by.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const searching = query.trim().length > 0;

  return (
    <div className="bg-white border border-green-800/10 rounded-xl overflow-hidden">
      <div className="px-3 py-3 border-b border-green-800/10">
        <p className="text-[10px] tracking-widest uppercase text-muted font-semibold mb-2">Tokens</p>
        <input
          type="search"
          className="form-input w-full text-[13px]"
          placeholder="Search tokens…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="text-[11px] text-muted mt-1.5">
          Click into the text where the value belongs, then click a token to insert it.
        </p>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {namespaces.length === 0 && (
          <p className="text-[12px] text-muted px-3 py-3">No tokens match.</p>
        )}
        {namespaces.map(([ns, list]) => {
          const open = searching || openNs[ns] === true;
          return (
            <div key={ns}>
              <button
                type="button"
                onClick={() => setOpenNs((m) => ({ ...m, [ns]: !open }))}
                className="w-full flex items-center justify-between px-3 py-2 bg-cream-100/60 border-t border-green-800/10 text-left focus-ring"
              >
                <span className="text-[11px] tracking-wide uppercase font-semibold text-green-900">
                  {ns} <span className="text-muted font-normal">({list.length})</span>
                </span>
                {open ? <ChevronDown size={14} className="text-muted" /> : <ChevronRight size={14} className="text-muted" />}
              </button>
              {open && list.map((t) => (
                <TokenRow key={t.id} t={t} onInsert={onInsert} insertDisabled={insertDisabled} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
