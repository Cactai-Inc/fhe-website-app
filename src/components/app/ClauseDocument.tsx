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
  /** True for the document's AUTHOR (staff / owner) building it — they see gated-off
   *  clauses (muted, toggleable) so they never lose the ability to change their
   *  mind. A reviewing party sees only active clauses, matching the final document. */
  authorView?: boolean;
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
    // signature-ceremony tokens — placeholders filled at signing. A *.DATE token
    // is the date the party signs; everything else is the signature itself.
    const marker = token.endsWith('.DATE') ? '［date signed］' : '［signature］';
    return <span className="text-muted italic">{marker}</span>;
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

/** Render a single {{token}} → an inline editable control, or a read-only value
 *  (horse-record imports, auto-fill, signatures). */
function renderToken(
  token: string, key: string,
  fieldByKey: Map<string, ContractField>, valueByKey: Record<string, string>, cb: FieldCallbacks,
): ReactNode {
  const field = fieldByKey.get(token);
  // HORSE.* imports read-only from the horse record — to change one, the horse
  // record is edited, not the contract. Label-resolved for display.
  const isHorseImport = token.startsWith('HORSE.');
  if (field && field.can_edit !== undefined && !isHorseImport) {
    return (
      <InlineFieldControl key={key} f={field} editable={cb.editable}
        onSave={cb.onSave} onSaveStructured={cb.onSaveStructured as never}
        onSaveResponsibility={cb.onSaveResponsibility as never}
        onCommentField={cb.onCommentField} onSuggestEdit={cb.onSuggestEdit} canSuggest={cb.canSuggest} />
    );
  }
  const display = field ? optionLabel(field) : (valueByKey[token] ?? '');
  return <TokenValue key={key} token={token} value={display} />;
}

// A line that is purely "Label: {{TOKEN}}" — rendered as a matrix cell (bold
// label + value) rather than a sentence.
const MATRIX_LINE = /^([^{}:]{1,40}):\s*\{\{([A-Z0-9_.]+)\}\}\s*$/;

/** Render a clause body. Consecutive "Label: {{token}}" lines become a compact
 *  bold-label matrix (e.g. the horse identity block); other lines render as prose
 *  with controls/values inline at each token. */
function ClauseProse({
  body, fieldByKey, valueByKey, cb,
}: {
  body: string;
  fieldByKey: Map<string, ContractField>;
  valueByKey: Record<string, string>;
  cb: FieldCallbacks;
}) {
  const lines = body.split('\n');
  const blocks: ReactNode[] = [];
  let matrix: { label: string; token: string }[] = [];
  let bi = 0;

  // A "wide" cell holds an editable control that needs room (a dropdown/select,
  // party/responsibility picker, or other structured control). Those get their own
  // full row so they never collide. Compact cells (short text values, read-only
  // record imports like the Horse block) pack into a responsive grid.
  const isWideCell = (token: string) => {
    const f = fieldByKey.get(token);
    if (!f) return false;                         // read-only import → compact
    if (f.field_key.startsWith('HORSE.')) return false;  // horse-record import → compact
    const fmt = f.format_type ?? '';
    const kind = f.input_kind ?? 'text';
    return kind === 'select' || kind === 'buttons' || kind === 'responsibility'
      || ['party', 'contact', 'person', 'address', 'location', 'pair', 'fee_schedule', 'med_schedule', 'reveal_text'].includes(fmt);
  };

  const flushMatrix = () => {
    if (matrix.length === 0) return;
    const cells = matrix;
    matrix = [];
    // A cell keeps its label and value on ONE line (never wraps the value under the
    // label). When it can't fit, the grid drops to fewer columns and the whole cell
    // moves together — see the wider minmax() below.
    const cell = (c: { label: string; token: string }, j: number) => (
      <div key={j} className="flex items-baseline gap-x-1.5 text-[13.5px] text-green-950 min-w-0">
        <span className="font-semibold whitespace-nowrap">{c.label}:</span>
        <span className="min-w-0">{renderToken(c.token, `mx${bi}-${j}`, fieldByKey, valueByKey, cb)}</span>
      </div>
    );
    // A signature triple — Signature / Printed Name / Date for one party — lays out
    // as a fixed 3-column row (the classic signature-block look), not the packed
    // grid, so it never wraps to one-per-line.
    const isSigTriple = cells.length === 3
      && cells.some((c) => c.token.startsWith('SIG.'))
      && cells.map((c) => c.label.toLowerCase()).join('|') === 'signature|printed name|date';
    if (isSigTriple) {
      const key = bi++;
      blocks.push(
        <div key={`sig${key}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)] gap-x-6 gap-y-1 my-1 items-baseline">
          {cells.map((c, j) => cell(c, j))}
        </div>,
      );
      return;
    }
    // group consecutive compact cells into a packed grid; wide cells break out to
    // their own full-width row. This keeps the Horse identity grid AND avoids the
    // Farrier/Vet dropdown collision.
    const groups: { wide: boolean; items: { label: string; token: string }[] }[] = [];
    for (const c of cells) {
      const wide = isWideCell(c.token);
      const last = groups[groups.length - 1];
      if (last && last.wide === wide && !wide) last.items.push(c);
      else groups.push({ wide, items: [c] });
    }
    const key = bi++;
    blocks.push(
      <div key={`mx${key}`} className="flex flex-col gap-1 my-1">
        {groups.map((g, gi) =>
          g.wide ? (
            <div key={gi} className="flex flex-col gap-1">{g.items.map((c, j) => cell(c, gi * 100 + j))}</div>
          ) : (
            <div key={gi} className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-x-6 gap-y-1">
              {g.items.map((c, j) => cell(c, gi * 100 + j))}
            </div>
          ),
        )}
      </div>,
    );
  };

  for (const line of lines) {
    const mm = line.match(MATRIX_LINE);
    if (mm) { matrix.push({ label: mm[1].trim(), token: mm[2] }); continue; }
    flushMatrix();
    if (line.trim() === '') { continue; }
    // prose line: interleave text and inline tokens
    const nodes: ReactNode[] = [];
    let last = 0; let m: RegExpExecArray | null; let ti = 0;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(line))) {
      if (m.index > last) nodes.push(line.slice(last, m.index));
      nodes.push(renderToken(m[1], `p${bi}-${ti++}`, fieldByKey, valueByKey, cb));
      last = m.index + m[0].length;
    }
    if (last < line.length) nodes.push(line.slice(last));
    blocks.push(<p key={`p${bi++}`} className="text-[13.5px] leading-[1.9] text-green-950">{nodes}</p>);
  }
  flushMatrix();
  return <>{blocks}</>;
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

  // Author-added fields (CUSTOM.*) grouped by their section value. A field whose
  // section matches a template section renders at the end of that section; the
  // rest (custom sections) render as their own sections after the template ones.
  const sectionKeys = useMemo(() => new Set(sections.map((s) => s.section_key)), [sections]);
  const customBySection = useMemo(() => {
    const m = new Map<string, ContractField[]>();
    for (const f of fields) {
      if (!f.field_key.startsWith('CUSTOM.')) continue;
      const k = f.section ?? '';
      (m.get(k) ?? m.set(k, []).get(k)!).push(f);
    }
    return m;
  }, [fields]);
  const customSectionNames = useMemo(
    () => [...customBySection.keys()].filter((k) => k && !sectionKeys.has(k)).sort(),
    [customBySection, sectionKeys],
  );

  const renderCustom = (f: ContractField, num: string) => (
    <div key={f.field_key} className="flex items-baseline gap-1.5">
      <span className="text-muted tabular-nums text-[13px]">{num}</span>
      <span className="text-[13.5px] font-semibold text-green-900">{f.label ?? f.field_key}:</span>
      <InlineFieldControl f={f} editable={cb.editable}
        onSave={cb.onSave} onSaveStructured={cb.onSaveStructured as never}
        onSaveResponsibility={cb.onSaveResponsibility as never}
        onCommentField={cb.onCommentField} onSuggestEdit={cb.onSuggestEdit} canSuggest={cb.canSuggest} />
    </div>
  );

  let sectionNo = 0;
  return (
    <div className="flex flex-col gap-7">
      {sections.map((section) => {
        // Gated-off clauses are shown (muted, toggleable) ONLY to a user who can
        // actually edit — so the author never loses the ability to change their mind
        // before signing. A REVIEWING party (or anyone who can't edit) sees only the
        // active clauses, matching the final/locked document — no confusing
        // "optional, not included" content. The composed merged_body always omits
        // gated-off clauses.
        const clausesToShow = section.clauses.filter((c) => {
          if (clauseConditionMet(c.conditional_on, valueByKey)) return true;
          if (!cb.authorView) return false;   // reviewers/parties see only active clauses
          const hasFields = (fieldsByClause.get(c.clause_key) ?? []).length > 0;
          return !!(c.body && c.body.trim()) || hasFields;
        });
        const sectionCustom = customBySection.get(section.section_key) ?? [];
        if (clausesToShow.length === 0 && sectionCustom.length === 0) return null;
        sectionNo += 1;
        const secNum = sectionNo;
        let clauseNo = 0;
        return (
          <section key={section.section_key}>
            <h2 className="font-serif text-green-900 text-2xl mb-3 flex items-baseline gap-2 border-b border-green-800/10 pb-1.5">
              <span className="text-gold-ink tabular-nums">{secNum}.</span>
              {section.heading}
              {section.guidance && <InfoDot text={section.guidance} />}
            </h2>
            <div className="flex flex-col gap-4">
              {clausesToShow.map((clause) => {
                const gatedOff = !clauseConditionMet(clause.conditional_on, valueByKey);
                // Only clauses that WILL appear in the final document consume a
                // number, so the visible numbering matches the executed form. A
                // gated-off clause shows without a number, muted.
                if (!gatedOff) clauseNo += 1;
                const num = gatedOff ? '' : `${secNum}.${clauseNo}`;
                const bodyTokens = new Set(
                  [...(clause.body ?? '').matchAll(TOKEN_RE)].map((mm) => mm[1]),
                );
                // Authoring-control fields for this clause not placed by a {{token}}
                // in its prose — e.g. a yes/no enable gate ("Any exceptions?"), the
                // lease-type selector, etc. These are the field's DESIGNATED clause
                // (clause_key), so they're intentional and render below the prose as
                // authoring controls. (Stale fields are removed at the data layer,
                // not hidden here.)
                const orphanFields = (fieldsByClause.get(clause.clause_key) ?? [])
                  .filter((f) => !bodyTokens.has(f.field_key));
                return (
                  <div key={clause.clause_key} className={gatedOff ? 'opacity-55' : ''}>
                    {gatedOff && (
                      <p className="text-[10.5px] uppercase tracking-wide text-gold-700/80 mb-0.5">
                        Optional — included in the final agreement only if selected
                      </p>
                    )}
                    {clause.heading && (
                      <p className="text-[13px] font-semibold text-green-900 mb-1 flex items-center gap-1.5">
                        {num && <span className="text-muted tabular-nums">{num}</span>}{clause.heading}
                        {clause.guidance && <InfoDot text={clause.guidance} />}
                      </p>
                    )}
                    {clause.body
                      ? <ClauseProse body={clause.body} fieldByKey={fieldByKey} valueByKey={valueByKey} cb={cb} />
                      : null}
                    {orphanFields.length > 0 && (
                      // Fields attached to the clause but not placed by a {{token}}
                      // in its prose — e.g. a yes/no authoring gate ("Any exceptions
                      // to note? [Yes] [No]"). Rendered at the same size/colour as the
                      // clause prose so the section reads uniformly.
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1 text-[13.5px] text-green-950 leading-[1.9]">
                        {orphanFields.map((f) => (
                          <span key={f.field_key} className="inline-flex items-baseline gap-1.5">
                            <span>{f.label ?? f.field_key}</span>
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
              {/* author-added fields appended to this template section */}
              {sectionCustom.map((f) => renderCustom(f, `${secNum}.${++clauseNo}`))}
            </div>
          </section>
        );
      })}

      {/* custom sections (author-added, not in the template) — rendered after the
          template sections, each with its own fields. */}
      {customSectionNames.map((name) => {
        sectionNo += 1;
        const secNum = sectionNo;
        let clauseNo = 0;
        return (
          <section key={`custom:${name}`}>
            <h2 className="font-serif text-green-900 text-2xl mb-3 flex items-baseline gap-2 border-b border-green-800/10 pb-1.5">
              <span className="text-gold-ink tabular-nums">{secNum}.</span>
              {name}
            </h2>
            <div className="flex flex-col gap-4">
              {(customBySection.get(name) ?? []).map((f) => renderCustom(f, `${secNum}.${++clauseNo}`))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default ClauseDocument;
