import { useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
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
  /** Commit a typed value for a party CONTACT token (LESSOR/LESSEE . ADDRESS /
   *  PHONE / EMAIL / FULL_NAME) — writes to that party's contact record. Absent =
   *  the tokens render read-only (reviewer without edit rights). */
  onEditPartyContact?: (token: string, value: string) => void | Promise<void>;
  /** Commit a typed value for an editable HORSE-record token (farrier / vet
   *  details) — writes to the horse record. Absent = read-only. */
  onEditHorseRecord?: (token: string, value: string) => void | Promise<void>;
};

/** Party CONTACT tokens editable in the Notice/Contact block. Map token → the
 *  human field name (for placeholder/aria). */
const PARTY_CONTACT_TOKENS: Record<string, string> = {
  'LESSOR.FULL_NAME': 'Lessor name', 'LESSOR.ADDRESS': 'Lessor address',
  'LESSOR.PHONE': 'Lessor phone', 'LESSOR.EMAIL': 'Lessor email',
  'LESSEE.FULL_NAME': 'Lessee name', 'LESSEE.ADDRESS': 'Lessee address',
  'LESSEE.PHONE': 'Lessee phone', 'LESSEE.EMAIL': 'Lessee email',
};

/** HORSE-record tokens that are editable inline in the Care section. An empty one
 *  renders as a fillable blank (not a "from horse record" hint); the typed value is
 *  written back to the horse record. Map token → the human field name. */
const HORSE_RECORD_TOKENS: Record<string, string> = {
  'HORSE.FARRIER_NAME': 'Farrier', 'HORSE.FARRIER_PHONE': 'Farrier phone',
  'HORSE.VET_NAME': 'Veterinarian', 'HORSE.VET_PHONE': 'Veterinarian phone',
  'HORSE.VET_BUSINESS': 'Practice', 'HORSE.VET_ADDRESS': 'Practice address',
};

const TOKEN_RE = /\{\{([A-Z0-9_.]+)\}\}/g;

/** Auto-fill tokens that IMPORT from the party contact or horse record — they are
 *  never hand-filled in the document, so an empty one shows a muted "imports from…"
 *  hint (not a fillable blank). Value present → the value. */
const AUTOFILL_HINT: Record<string, string> = {
  'LESSOR.FULL_NAME': 'Lessor name on file', 'LESSOR.ADDRESS': 'Lessor address on file',
  'LESSOR.PRINTED_NAME': 'Lessor name on file',
  'LESSOR.PHONE': 'Lessor phone on file', 'LESSOR.EMAIL': 'Lessor email on file',
  'LESSEE.FULL_NAME': 'Lessee name on file', 'LESSEE.ADDRESS': 'Lessee address on file',
  'LESSEE.PRINTED_NAME': 'Lessee name on file',
  'LESSEE.PHONE': 'Lessee phone on file', 'LESSEE.EMAIL': 'Lessee email on file',
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

/** An editable RECORD token — a party CONTACT token (LESSOR/LESSEE . ADDRESS /
 *  PHONE / EMAIL / FULL_NAME) or a HORSE-record token (farrier / vet details).
 *  Unlike a false "on file" / "from horse record" hint, an empty one is a real
 *  editable input the contract creator can fill; the value is written back to the
 *  underlying record (contact or horse). When not editable it renders the value
 *  (or a muted "not provided"). */
function EditableRecordToken({
  token, value, editable, placeholder, onCommit,
}: { token: string; value: string; editable: boolean; placeholder: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  const editingRef = useRef(false);
  useEffect(() => { if (!editingRef.current) setLocal(value); }, [value]);
  const kind = token.endsWith('.EMAIL') ? 'email' : token.endsWith('.PHONE') ? 'tel' : 'text';

  if (!editable) {
    return value.trim()
      ? <span className="font-medium text-green-900">{value}</span>
      : <span className="text-muted italic text-[12.5px]">not provided</span>;
  }
  const commit = () => { editingRef.current = false; if (local !== value) onCommit(local); };
  return (
    <input
      type={kind}
      className="align-baseline min-w-[8rem] max-w-full px-1 text-[13.5px] text-green-900 bg-gold-50/70 border-b border-gold-400/70 focus:outline-none focus:border-gold-600 rounded-sm"
      value={local}
      placeholder={placeholder}
      aria-label={placeholder}
      onFocus={() => { editingRef.current = true; }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
    />
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

/** Every field_key referenced anywhere in a gate (including composite all/any).
 *  Used so a clause's own controlling toggle stays interactive even when the
 *  clause is gated off — otherwise you could never turn it on (chicken-and-egg). */
function gateTriggerKeys(
  cond: import('../../lib/contracts').FieldConditional | null | undefined,
): Set<string> {
  const keys = new Set<string>();
  const walk = (c: typeof cond) => {
    if (!c) return;
    if (c.field_key) keys.add(c.field_key);
    c.all?.forEach(walk);
    c.any?.forEach(walk);
  };
  walk(cond);
  return keys;
}

/** Map a raw gate value to its human label using the trigger field's options. */
function gateValueLabel(f: ContractField | undefined, raw: string): string {
  const opt = f?.options?.find((o) => o.value === raw);
  return opt?.label ?? raw;
}

/** A plain-English description of a clause/section's gate for authors, e.g.
 *  "This is included when the Lease type is Partial lease." Resolves the trigger
 *  field's label and the expected option's label from the field defs. Falls back
 *  to a generic phrase when the gate is composite or the field isn't found. */
function describeGate(
  cond: import('../../lib/contracts').FieldConditional | null | undefined,
  fieldByKey: Map<string, ContractField>,
): string {
  const generic = 'This is included when the option above is selected.';
  if (!cond) return generic;
  // composite (all/any) → too complex to phrase simply; keep it generic
  if (cond.all || cond.any || !cond.field_key) return generic;
  const f = fieldByKey.get(cond.field_key);
  const fieldName = f?.label ?? 'selection above';
  if (cond.equals && cond.equals.length) {
    const vals = cond.equals.map((v) => gateValueLabel(f, v));
    // a Yes gate reads better as "is enabled"
    if (vals.length === 1 && vals[0].toLowerCase() === 'yes') {
      return `This is included when ${fieldName} is enabled.`;
    }
    return `This is included when ${fieldName} is ${vals.join(' or ')}.`;
  }
  if (cond.contains && cond.contains.length) {
    const vals = cond.contains.map((v) => gateValueLabel(f, v));
    return `This is included when ${fieldName} includes ${vals.join(' or ')}.`;
  }
  return generic;
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
  // Party contact tokens: editable inputs (write to the party's contact record),
  // not a false "on file" hint. Only when a handler is provided (author/editor).
  if (PARTY_CONTACT_TOKENS[token] && cb.onEditPartyContact) {
    return (
      <EditableRecordToken key={key} token={token} value={valueByKey[token] ?? ''}
        editable={cb.editable} placeholder={PARTY_CONTACT_TOKENS[token]}
        onCommit={(v) => { void cb.onEditPartyContact!(token, v); }} />
    );
  }
  // Editable horse-record tokens (farrier / vet details): fillable blanks that write
  // back to the horse record, not a "from horse record" hint. Only when a handler is
  // provided (author/editor); otherwise they fall through to the read-only value.
  if (HORSE_RECORD_TOKENS[token] && cb.onEditHorseRecord) {
    return (
      <EditableRecordToken key={key} token={token} value={valueByKey[token] ?? ''}
        editable={cb.editable} placeholder={HORSE_RECORD_TOKENS[token]}
        onCommit={(v) => { void cb.onEditHorseRecord!(token, v); }} />
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
    // moves together — see the wider minmax() below. A long value wraps within the
    // value span (break-words) and pushes the cell taller rather than overflowing
    // sideways onto a neighbouring cell/label.
    const cell = (c: { label: string; token: string }, j: number) => (
      <div key={j} className="flex items-baseline gap-x-1.5 text-[13.5px] text-green-950 min-w-0">
        <span className="font-semibold whitespace-nowrap">{c.label}:</span>
        <span className="min-w-0 break-words">{renderToken(c.token, `mx${bi}-${j}`, fieldByKey, valueByKey, cb)}</span>
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
    // Farrier/Vet dropdown collision. A party-contact cell (Name / Address / Phone
    // / Email in the Notice block) is ALSO forced to its own full-width row so a
    // long address can never run under the next field's label, and each field sits
    // on its own line on narrow/mobile screens (the value wraps within its own row
    // rather than pushing the next field to the end of the wrapped text).
    const forceOwnRow = (token: string) => isWideCell(token) || !!PARTY_CONTACT_TOKENS[token];
    const groups: { wide: boolean; items: { label: string; token: string }[] }[] = [];
    for (const c of cells) {
      const wide = forceOwnRow(c.token);
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

  // Self-labeling block controls (a button that reveals a field, a Yes/No that
  // reveals text, a certification checkbox) can't render inside a compact matrix
  // cell — they need their own full-width line and carry their own label, so a
  // "Label: {{token}}" line pointing at one is NOT treated as a matrix cell.
  const isSelfLabelBlock = (token: string) => {
    const fmt = fieldByKey.get(token)?.format_type ?? '';
    return fmt === 'add_text' || fmt === 'reveal_text' || fmt === 'certify';
  };

  for (const line of lines) {
    const mm = line.match(MATRIX_LINE);
    if (mm && !isSelfLabelBlock(mm[2])) { matrix.push({ label: mm[1].trim(), token: mm[2] }); continue; }
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
        // A section is ENTIRELY OPTIONAL (a preview block) when every clause it
        // would show is gated off — i.e. the whole section shares one trigger and
        // none of it is active. Then the section reads as a single optional unit:
        // the title is greyed and carries ONE "optional" note (not repeated per
        // clause), and it keeps its number so it looks like a real section-3 that
        // simply isn't included yet.
        const sectionAllOptional = clausesToShow.length > 0
          && sectionCustom.length === 0
          && clausesToShow.every((c) => !clauseConditionMet(c.conditional_on, valueByKey));
        return (
          <section key={section.section_key} className={sectionAllOptional ? 'opacity-50' : ''}>
            <h2 className="font-serif text-green-900 text-2xl mb-3 flex items-baseline flex-wrap gap-x-2 gap-y-1 border-b border-green-800/10 pb-1.5">
              <span className="text-gold-ink tabular-nums">{secNum}.</span>
              {section.heading}
              {section.guidance && <InfoDot text={section.guidance} />}
              {sectionAllOptional && (
                <span className="text-[11px] text-gold-700/90 font-sans font-medium self-center normal-case tracking-normal">
                  {describeGate(clausesToShow[0]?.conditional_on, fieldByKey)}
                </span>
              )}
            </h2>
            <div className="flex flex-col gap-4">
              {clausesToShow.map((clause) => {
                const gatedOff = !clauseConditionMet(clause.conditional_on, valueByKey);
                // Only clauses that WILL appear in the final document consume a
                // number, so the visible numbering matches the executed form. A
                // gated-off clause shows without a number, muted — EXCEPT in a
                // wholly-optional section, where the whole block reads as one
                // numbered-but-optional section (3.1, 3.2 …) under a greyed title.
                if (!gatedOff || sectionAllOptional) clauseNo += 1;
                const num = (gatedOff && !sectionAllOptional) ? '' : `${secNum}.${clauseNo}`;
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
                // A clause can be gated by a field that lives ON the clause itself
                // (a self-enabling toggle, e.g. "Include 3rd party exercise"). That
                // control MUST stay clickable when the clause is gated off — freezing
                // it would make the clause impossible to turn on. Split it out.
                const triggerKeys = gateTriggerKeys(clause.conditional_on);
                const gateControls = orphanFields.filter((f) => triggerKeys.has(f.field_key));
                const previewFields = orphanFields.filter((f) => !triggerKeys.has(f.field_key));
                // certify / add_text / reveal_text controls render their own label
                // (the checkbox statement / button text), so we must NOT also print
                // a prefix label — otherwise it shows twice.
                const renderOrphan = (f: ContractField) => {
                  const selfLabels = f.format_type === 'certify'
                    || f.format_type === 'add_text' || f.format_type === 'reveal_text';
                  return (
                    <span key={f.field_key} className="inline-flex items-baseline gap-1.5">
                      {!selfLabels && <span>{f.label ?? f.field_key}</span>}
                      <InlineFieldControl f={f} editable={cb.editable}
                        onSave={cb.onSave} onSaveStructured={cb.onSaveStructured as never}
                        onSaveResponsibility={cb.onSaveResponsibility as never}
                        onCommentField={cb.onCommentField} onSuggestEdit={cb.onSuggestEdit} canSuggest={cb.canSuggest} />
                    </span>
                  );
                };
                return (
                  <div key={clause.clause_key}>
                    {/* A per-clause "optional" note appears only for a clause that's
                        individually gated off within an OTHERWISE-ACTIVE section. When
                        the WHOLE section is optional, the greyed section title carries
                        the single note instead (no per-clause repetition). */}
                    {gatedOff && !sectionAllOptional && (
                      <p className="text-[11px] text-gold-700/90 mb-0.5">
                        {describeGate(clause.conditional_on, fieldByKey)}
                      </p>
                    )}
                    {/* The clause's own enabling control(s) — ALWAYS interactive, even
                        when the clause is gated off, so it can be turned on. Rendered
                        above the (possibly frozen) preview. */}
                    {gatedOff && gateControls.length > 0 && (
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1.5 text-[13.5px] text-green-950 leading-[1.9]">
                        {gateControls.map(renderOrphan)}
                      </div>
                    )}
                    {/* A gated-off clause is a non-interactive PREVIEW: muted and
                        pointer-events-none so its inputs can't be edited (its content
                        only enters the contract once the controlling selection turns
                        it on). Shown only to the author — reviewers never see it. */}
                    <div className={
                      gatedOff
                        ? `pointer-events-none select-none${sectionAllOptional ? '' : ' opacity-50'}`
                        : ''
                    }>
                      {clause.heading && (
                        <p className="text-[13px] font-semibold text-green-900 mb-1 flex items-center gap-1.5">
                          {num && <span className="text-muted tabular-nums">{num}</span>}{clause.heading}
                          {clause.guidance && <InfoDot text={clause.guidance} />}
                        </p>
                      )}
                      {clause.body
                        ? <ClauseProse body={clause.body} fieldByKey={fieldByKey} valueByKey={valueByKey} cb={cb} />
                        : null}
                      {/* Non-gate orphan fields. When the clause is active, its gate
                          control (if any) renders here too so it stays in place. */}
                      {(gatedOff ? previewFields : orphanFields).length > 0 && (
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mt-1 text-[13.5px] text-green-950 leading-[1.9]">
                          {(gatedOff ? previewFields : orphanFields).map(renderOrphan)}
                        </div>
                      )}
                    </div>
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
