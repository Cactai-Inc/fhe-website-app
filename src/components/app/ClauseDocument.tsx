import { useMemo, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import {
  clauseConditionMet,
  type ContractField, type SectionDef, type ClauseDef,
} from '../../lib/contracts';
import { InlineFieldControl } from './ContractCascade';

/**
 * CLAUSE DOCUMENT — the numbered Section › Clause › Field authoring surface, as a
 * LIVING DOCUMENT: the document IS the form. Each clause's legal prose is rendered,
 * and where a {{TOKEN}} appears the field's input control is dropped inline in the
 * sentence — so the author fills fields in the context of the surrounding text.
 * Tokens with no editable field (auto-fill party/horse tokens, {{SIG.*}}) render as
 * their current value or a highlighted blank.
 *
 * Numbering (1, 1.1, 1.2, 2…) is display-only and recomputed on every render from
 * what's visible, so it matches the composed body. Clauses gate in real time:
 * a clause whose conditional_on isn't met is hidden; a section with no visible
 * clauses is suppressed.
 */

type FieldCallbacks = {
  editable: boolean;
  onSave: (key: string, value: string) => void | Promise<void>;
  onSaveStructured: (key: string, s: unknown) => void | Promise<void>;
  onSaveResponsibility: (key: string, r: unknown) => void | Promise<void>;
  onInclude: (key: string, inc: boolean) => void | Promise<void>;
  onNa: (key: string, na: boolean) => void | Promise<void>;
  onControl: (key: string, ov: unknown) => void | Promise<void>;
  canSetControl: boolean;
  canSuggest: boolean;
  onSuggestEdit?: (f: ContractField) => void;
  onCommentField?: (f: ContractField) => void;
};

const TOKEN_RE = /\{\{([A-Z0-9_.]+)\}\}/g;

/** An auto-fill / signature token (no editable field) → its current value or a blank. */
function TokenValue({ token, value }: { token: string; value: string }) {
  if (token.startsWith('SIG.')) {
    // signature ceremony token — a marker, filled at signing
    return <span className="text-muted italic">［signature］</span>;
  }
  if (value.trim()) return <span className="font-medium text-green-900">{value}</span>;
  return (
    <mark className="bg-gold-100 text-gold-900 rounded px-1.5 border border-gold-400/60 border-dashed text-[13px]">
      ____
    </mark>
  );
}

/** Render a clause's prose with input controls dropped inline at each {{token}}. */
function ClauseProse({
  body, fieldByKey, valueByKey, cb,
}: {
  body: string;
  fieldByKey: Map<string, ContractField>;
  valueByKey: Record<string, string>;
  cb: FieldCallbacks;
}) {
  const nodes: ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(body))) {
    if (m.index > last) nodes.push(body.slice(last, m.index));
    const token = m[1];
    const field = fieldByKey.get(token);
    if (field && field.can_edit !== undefined) {
      // an editable field lives here → drop its control inline
      nodes.push(
        <InlineFieldControl key={`f${i++}`} f={field} editable={cb.editable}
          onSave={cb.onSave} onSaveStructured={cb.onSaveStructured as never}
          onSaveResponsibility={cb.onSaveResponsibility as never}
          onCommentField={cb.onCommentField} onSuggestEdit={cb.onSuggestEdit} canSuggest={cb.canSuggest} />,
      );
    } else {
      // auto-fill / signature token → current value or blank
      nodes.push(<TokenValue key={`t${i++}`} token={token} value={valueByKey[token] ?? ''} />);
    }
    last = m.index + m[0].length;
  }
  if (last < body.length) nodes.push(body.slice(last));
  // preserve paragraph breaks in the prose
  return <p className="text-[13.5px] leading-[1.9] text-green-950 whitespace-pre-wrap">{nodes}</p>;
}

export function ClauseDocument({
  sections, fields, cb,
}: {
  sections: SectionDef[];
  fields: ContractField[];
  cb: FieldCallbacks;
}) {
  // current field values for gating + auto-fill token rendering (multi-selects
  // comma-joined) — mirrors how the SQL composer reads them.
  const valueByKey = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of fields) m[f.field_key] = f.responsibility?.party ?? f.value ?? '';
    return m;
  }, [fields]);

  const fieldByKey = useMemo(() => {
    const m = new Map<string, ContractField>();
    for (const f of fields) m.set(f.field_key, f);
    return m;
  }, [fields]);

  // fields grouped by clause — for clauses whose body has NO token for a field
  // (e.g. an added custom field), we still render those below the prose.
  const fieldsByClause = useMemo(() => {
    const m = new Map<string, ContractField[]>();
    for (const f of fields) {
      const k = f.clause_key ?? '';
      if (!k) continue;
      (m.get(k) ?? m.set(k, []).get(k)!).push(f);
    }
    return m;
  }, [fields]);

  const clauseVisible = (c: ClauseDef) => clauseConditionMet(c.conditional_on, valueByKey);

  let sectionNo = 0;
  return (
    <div className="flex flex-col gap-7">
      {sections.map((section) => {
        const visibleClauses = section.clauses.filter(clauseVisible);
        if (visibleClauses.length === 0) return null;
        sectionNo += 1;
        const secNum = sectionNo;
        let clauseNo = 0;
        return (
          <section key={section.section_key}>
            <h2 className="font-serif text-green-900 text-lg mb-3 flex items-baseline gap-2 border-b border-green-800/10 pb-1.5">
              <span className="text-gold-ink tabular-nums">{secNum}.</span>
              {section.heading}
              {section.guidance && (
                <span title={section.guidance} className="text-muted cursor-help">
                  <Info size={14} className="inline align-middle" aria-hidden="true" />
                </span>
              )}
            </h2>
            <div className="flex flex-col gap-4">
              {visibleClauses.map((clause) => {
                clauseNo += 1;
                const num = `${secNum}.${clauseNo}`;
                const bodyTokens = new Set(
                  [...(clause.body ?? '').matchAll(TOKEN_RE)].map((mm) => mm[1]),
                );
                // any fields for this clause NOT already placed inline via a token
                const orphanFields = (fieldsByClause.get(clause.clause_key) ?? [])
                  .filter((f) => !bodyTokens.has(f.field_key));
                return (
                  <div key={clause.clause_key}>
                    {clause.heading && (
                      <p className="text-[13px] font-semibold text-green-900 mb-1 flex items-center gap-1.5">
                        <span className="text-muted tabular-nums">{num}</span>{clause.heading}
                        {clause.guidance && (
                          <span title={clause.guidance} className="text-muted cursor-help">
                            <Info size={13} className="inline align-middle" aria-hidden="true" />
                          </span>
                        )}
                      </p>
                    )}
                    {clause.body
                      ? <ClauseProse body={clause.body} fieldByKey={fieldByKey} valueByKey={valueByKey} cb={cb} />
                      : null}
                    {orphanFields.length > 0 && (
                      <div className="flex flex-wrap gap-3 mt-1.5 pl-1">
                        {orphanFields.map((f) => (
                          <InlineFieldControl key={f.field_key} f={f} editable={cb.editable}
                            onSave={cb.onSave} onSaveStructured={cb.onSaveStructured as never}
                            onSaveResponsibility={cb.onSaveResponsibility as never}
                            onCommentField={cb.onCommentField} onSuggestEdit={cb.onSuggestEdit} canSuggest={cb.canSuggest} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default ClauseDocument;
