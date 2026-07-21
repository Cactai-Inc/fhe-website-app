import { useMemo, type ReactNode } from 'react';
import {
  clauseConditionMet,
  type ContractField, type SectionDef, type ClauseDef,
} from '../../lib/contracts';
import { InlineFieldControl, InfoDot } from './ContractCascade';

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

/** Auto-fill tokens that IMPORT from the party contact or horse record — they are
 *  never hand-filled in the document, so an empty one shows a muted "imports from…"
 *  hint (not a fillable blank). Value present → the value. */
const AUTOFILL_HINT: Record<string, string> = {
  'LESSOR.FULL_NAME': 'Lessor name on file', 'LESSOR.ADDRESS': 'Lessor address on file',
  'LESSOR.PRINTED_NAME': 'Lessor name on file',
  'LESSEE.FULL_NAME': 'Lessee name on file', 'LESSEE.ADDRESS': 'Lessee address on file',
  'LESSEE.PRINTED_NAME': 'Lessee name on file',
};

/** An auto-fill / signature token (no editable field) → its current value or a hint. */
function TokenValue({ token, value }: { token: string; value: string }) {
  if (token.startsWith('SIG.')) {
    // signature ceremony token — a marker, filled at signing
    return <span className="text-muted italic">［signature］</span>;
  }
  if (value.trim()) return <span className="font-medium text-green-900">{value}</span>;
  // party/horse imports show a muted "on file" hint instead of a fillable blank —
  // they're changed on the contact / horse record, not typed into the contract.
  const hint = AUTOFILL_HINT[token] ?? (token.startsWith('HORSE.') ? 'from horse record' : null);
  if (hint) return <span className="text-muted italic text-[12.5px]">{hint}</span>;
  return (
    <mark className="bg-gold-100 text-gold-900 rounded px-1.5 border border-gold-400/60 border-dashed text-[13px]">
      ____
    </mark>
  );
}

/** A field's value resolved to its option label (for read-only display). */
function optionLabel(f: ContractField): string {
  const v = f.value ?? '';
  if (!v) return '';
  if (f.options && f.options.length) {
    const opt = f.options.find((o) => o.value === v);
    if (opt) return opt.label;
  }
  return v;
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
    // HORSE.* imports read-only from the horse record — shown as a value, never an
    // editable control. To change one, the horse record is edited (by owner/staff),
    // not the contract. Its display value resolves option codes to labels.
    const isHorseImport = token.startsWith('HORSE.');
    if (field && field.can_edit !== undefined && !isHorseImport) {
      // an editable field lives here → drop its control inline
      nodes.push(
        <InlineFieldControl key={`f${i++}`} f={field} editable={cb.editable}
          onSave={cb.onSave} onSaveStructured={cb.onSaveStructured as never}
          onSaveResponsibility={cb.onSaveResponsibility as never}
          onCommentField={cb.onCommentField} onSuggestEdit={cb.onSuggestEdit} canSuggest={cb.canSuggest} />,
      );
    } else {
      // auto-fill / signature / horse-record import → value (label-resolved) or hint
      const display = field ? optionLabel(field) : (valueByKey[token] ?? '');
      nodes.push(<TokenValue key={`t${i++}`} token={token} value={display} />);
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
              {section.guidance && <InfoDot text={section.guidance} />}
            </h2>
            <div className="flex flex-col gap-4">
              {visibleClauses.map((clause) => {
                clauseNo += 1;
                const num = `${secNum}.${clauseNo}`;
                const bodyTokens = new Set(
                  [...(clause.body ?? '').matchAll(TOKEN_RE)].map((mm) => mm[1]),
                );
                // Authoring-gate fields: a field attached to an EMPTY-body clause
                // (e.g. a yes/no enable gate) renders as an authoring control. A
                // field on a clause that HAS prose but whose token isn't in that
                // prose is stale/misconfigured and is NOT rendered here — its value
                // belongs wherever its token appears, or the field should be removed.
                const orphanFields = !clause.body
                  ? (fieldsByClause.get(clause.clause_key) ?? []).filter((f) => !bodyTokens.has(f.field_key))
                  : [];
                return (
                  <div key={clause.clause_key}>
                    {clause.heading && (
                      <p className="text-[13px] font-semibold text-green-900 mb-1 flex items-center gap-1.5">
                        <span className="text-muted tabular-nums">{num}</span>{clause.heading}
                        {clause.guidance && <InfoDot text={clause.guidance} />}
                      </p>
                    )}
                    {clause.body
                      ? <ClauseProse body={clause.body} fieldByKey={fieldByKey} valueByKey={valueByKey} cb={cb} />
                      : null}
                    {orphanFields.length > 0 && (
                      // Fields attached to the clause but not placed by a {{token}}
                      // in its prose — e.g. a yes/no authoring gate. These are
                      // authoring controls (they don't print in the final document),
                      // so they render on a muted line with the field label as the
                      // prompt: "Any exceptions to note? [Yes] [No]".
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1 pl-1 text-[12.5px] text-muted">
                        {orphanFields.map((f) => (
                          <span key={f.field_key} className="inline-flex items-baseline gap-1.5">
                            <span className="italic">{f.label ?? f.field_key}</span>
                            <InlineFieldControl f={f} editable={cb.editable}
                              onSave={cb.onSave} onSaveStructured={cb.onSaveStructured as never}
                              onSaveResponsibility={cb.onSaveResponsibility as never}
                              onCommentField={cb.onCommentField} onSuggestEdit={cb.onSuggestEdit} canSuggest={cb.canSuggest} />
                          </span>
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
