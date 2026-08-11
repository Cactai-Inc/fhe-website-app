import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, ChevronUp, ChevronDown, Trash2, ListFilter, ToggleLeft, Type as TypeIcon } from 'lucide-react';
import {
  addContractComposition, proposeClause,
  type CompositionElement, type CompositionLine, type CompositionSpec,
  type ContractField, type FieldConditional, type TemplateStructure,
} from '../../lib/contracts';
import { ClauseProse } from './ClauseDocument';

/**
 * ADD ITEM — the one surface for adding authored content to a live contract.
 *
 * It asks the three questions a contract addition actually has, in the order the
 * document itself is built:
 *   ROW 1  SECTION — which numbered section is this going in? (or name a new one
 *          and choose its number)
 *   ROW 2  HEADER  — which numbered item inside it? (or name a new header)
 *   ROW 3  CONTENT — the words, as a STACK of independently-authored lines.
 *
 * Two things make the content row different from a textarea:
 *
 * • INLINE ELEMENTS ARE CHIPS. [Dropdown] [Buttons] [Text field] insert an
 *   ATOMIC object at the cursor — never editable text. A line is modelled as a
 *   list of segments (text | element), so element syntax cannot be half-deleted
 *   or hand-mangled: backspace at the start of a text segment removes the whole
 *   chip before it. Each chip configures itself in a POPOVER on the chip, so
 *   several elements on one line stay unambiguous.
 *
 * • CONDITIONS ARE SEPARATORS, NOT LINE SETTINGS. Inserting a condition drops a
 *   self-contained block that holds its own gate, its own gold caption, and its
 *   own content zone. It gates ONLY the lines inside that zone — a line added
 *   after the block at top level is independent, unconditional content.
 *
 * The preview under Row 3 renders through ClauseProse — the real document render
 * path, the same components the contract editor uses — so what the author sees
 * is what the clause will be, not a mock-up of it.
 *
 * Everything is written by ONE RPC (add_contract_composition) into the SAME
 * CUSTOM.* contract_fields storage the add surface has always used, and gates
 * are written as ordinary conditional_on JSON for the existing
 * clauseConditionMet / clause_condition_met engine. No parallel machinery.
 */

type Mode = 'compose' | 'clause';

// ── the authored model ───────────────────────────────────────────────────────
type ElKind = 'select' | 'buttons' | 'text';
type ElConfig = {
  id: string;
  kind: ElKind;
  label: string;
  placeholder: string;
  required: boolean;
  items: { value: string; label: string }[];   // select / buttons
};
type Seg = { t: 'text'; v: string } | { t: 'el'; id: string };
type Line = { id: string; segs: Seg[] };
type Condition = {
  id: string;
  kind: 'condition';
  driver: string | null;          // element id
  values: string[];
  caption: string | null;         // authored override; null = auto-generated
  lines: Line[];
};
type StackEntry = ({ kind: 'line' } & Line) | Condition;

let _uid = 0;
const uid = (p: string) => `${p}${++_uid}`;
const newLine = (): Line => ({ id: uid('l'), segs: [{ t: 'text', v: '' }] });

/** The prose of a line, with each chip as its {{CUSTOM.@id}} token — exactly the
 *  shape the RPC resolves and the composer reads. */
function lineBody(line: Line): string {
  return line.segs.map((s) => (s.t === 'text' ? s.v : `{{CUSTOM.@${s.id}}}`)).join('');
}
const optValue = (label: string) => label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

export function AddElementButton({
  structure, fields, documentId, disabled, onAdded,
  canAddStructure = true, canAddClause = false, className,
}: {
  structure: TemplateStructure;
  fields: ContractField[];
  documentId: string;
  disabled?: boolean;
  onAdded: () => void;
  canAddStructure?: boolean;
  canAddClause?: boolean;
  /** Lets a caller impose its own sizing. The subheader passes SUBHEADER_BTN so
   *  this control matches the row: with its own hardcoded classes it had no
   *  whitespace-nowrap, so "Add item" wrapped to two lines, and it sized itself
   *  independently of every button beside it. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!canAddStructure && !canAddClause) return null;
  const label = canAddStructure ? 'Add item' : 'Propose a clause';
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)}
        className={className
          ? `${className} border-gold-400/60 bg-white text-gold-800 hover:bg-gold-50 disabled:opacity-50`
          : 'inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-gold-800 border border-gold-400/60 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring disabled:opacity-50'}>
        <Plus size={13} /> {label}
      </button>
      {open && (
        <AddElementModal structure={structure} fields={fields} documentId={documentId}
          canAddStructure={canAddStructure} canAddClause={canAddClause}
          onClose={() => setOpen(false)}
          onAdded={onAdded} />
      )}
    </>
  );
}

function AddElementModal({
  structure, fields, documentId, onClose, onAdded, canAddStructure, canAddClause,
}: {
  structure: TemplateStructure;
  fields: ContractField[];
  documentId: string;
  onClose: () => void;
  onAdded: () => void;
  canAddStructure: boolean;
  canAddClause: boolean;
}) {
  const modes: Mode[] = [
    ...(canAddStructure ? (['compose'] as Mode[]) : []),
    ...(canAddClause ? (['clause'] as Mode[]) : []),
  ];
  const [mode, setMode] = useState<Mode>(modes[0] ?? 'compose');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [clauseText, setClauseText] = useState('');

  /* THE DOCUMENT'S CURRENT SHAPE, numbered the way the document numbers it: a
     section counts, and inside it only a HEADER (a clause with a heading) takes
     a sub-number (R11). Author-added sections/headers already on the document
     are folded in at their stored position, so the numbers offered here are the
     numbers the author is looking at. */
  const customRows = useMemo(() => fields.filter((f) => !!f.custom_kind), [fields]);
  const docSections = useMemo(() => {
    const secs = [
      ...structure.sections.map((s) => ({
        key: s.section_key, heading: s.heading, ord: s.sort_order * 1000,
        headers: s.clauses.filter((c) => !!(c.heading && c.heading.trim()))
          .map((c) => ({ key: c.clause_key, words: c.heading as string, ord: c.sort_order * 1000 })),
      })),
      ...customRows.filter((f) => f.custom_kind === 'section').map((f) => ({
        key: f.section ?? '', heading: f.label ?? (f.section ?? ''), ord: f.sort_order, headers: [] as
          { key: string; words: string; ord: number }[],
      })),
    ];
    for (const s of secs) {
      for (const h of customRows) {
        if (h.custom_kind !== 'header' || h.section !== s.key) continue;
        s.headers.push({ key: h.field_key, words: h.label ?? 'Item', ord: h.sort_order });
      }
      s.headers.sort((a, b) => a.ord - b.ord);
    }
    secs.sort((a, b) => a.ord - b.ord);
    return secs.map((s, i) => ({
      ...s, number: i + 1,
      headers: s.headers.map((h, j) => ({ ...h, number: `${i + 1}.${j + 1}` })),
    }));
  }, [structure, customRows]);

  // ── ROW 1: section ─────────────────────────────────────────────────────────
  const [sectionKey, setSectionKey] = useState<string>(docSections[0]?.key ?? '');
  const [newSection, setNewSection] = useState('');          // non-empty = create it
  const [sectionPos, setSectionPos] = useState<number>(docSections.length + 1);
  const creatingSection = newSection.trim() !== '';
  const section = docSections.find((s) => s.key === sectionKey);

  // ── ROW 2: header ──────────────────────────────────────────────────────────
  const [headerKey, setHeaderKey] = useState<string>('');
  const [newHeader, setNewHeader] = useState('');
  const [headerPos, setHeaderPos] = useState<number | ''>('');   // '' = end of section
  const creatingHeader = creatingSection || newHeader.trim() !== '';
  useEffect(() => { setHeaderKey(section?.headers[0]?.key ?? ''); }, [section]);

  // ── ROW 3: content ─────────────────────────────────────────────────────────
  const [stack, setStack] = useState<StackEntry[]>(() => [{ kind: 'line', ...newLine() }]);
  const [els, setEls] = useState<Record<string, ElConfig>>({});
  const [openChip, setOpenChip] = useState<string | null>(null);
  /** Where the next chip lands: which line, which text segment, which offset. */
  const caret = useRef<{ lineId: string; segIdx: number; offset: number } | null>(null);

  const allLines = useMemo(() => {
    const out: { line: Line; cond: Condition | null }[] = [];
    for (const e of stack) {
      if (e.kind === 'line') out.push({ line: e, cond: null });
      else for (const l of e.lines) out.push({ line: l, cond: e });
    }
    return out;
  }, [stack]);

  /** Elements available as a condition DRIVER — the dropdowns and button sets
   *  already placed in THIS addition. Nothing else can drive a gate here. */
  const drivers = useMemo(() => {
    const ids: string[] = [];
    for (const { line } of allLines) for (const s of line.segs) {
      if (s.t === 'el' && els[s.id] && els[s.id].kind !== 'text') ids.push(s.id);
    }
    return ids.map((id) => els[id]);
  }, [allLines, els]);

  const updateLine = (lineId: string, fn: (l: Line) => Line) => setStack((st) => st.map((e) => {
    if (e.kind === 'line') return e.id === lineId ? { kind: 'line', ...fn(e) } : e;
    return { ...e, lines: e.lines.map((l) => (l.id === lineId ? fn(l) : l)) };
  }));

  /** Insert a chip at the caret, splitting the text segment it sits in. */
  function insertElement(kind: ElKind) {
    const at = caret.current ?? (allLines.length
      ? { lineId: allLines[allLines.length - 1].line.id, segIdx: 0, offset: Number.MAX_SAFE_INTEGER }
      : null);
    if (!at) return;
    const id = uid('e');
    setEls((m) => ({
      ...m,
      [id]: {
        id, kind, required: false, placeholder: '',
        label: kind === 'select' ? 'Selection' : kind === 'buttons' ? 'Choices' : 'Entry',
        items: kind === 'text' ? [] : [{ value: 'OPTION_1', label: 'Option 1' }],
      },
    }));
    updateLine(at.lineId, (l) => {
      const segs = [...l.segs];
      const seg = segs[at.segIdx];
      if (!seg || seg.t !== 'text') { segs.push({ t: 'el', id }, { t: 'text', v: '' }); return { ...l, segs }; }
      const off = Math.min(at.offset, seg.v.length);
      segs.splice(at.segIdx, 1,
        { t: 'text', v: seg.v.slice(0, off) },
        { t: 'el', id },
        { t: 'text', v: seg.v.slice(off) });
      return { ...l, segs };
    });
    setOpenChip(id);
  }

  /** Append a text-field chip right after `afterId` — the 'Other' assist. */
  function addOtherDetails(afterId: string) {
    const id = uid('e');
    setEls((m) => ({
      ...m,
      [id]: { id, kind: 'text', label: 'Details', placeholder: 'please specify', required: false, items: [] },
    }));
    setStack((st) => st.map((e) => {
      const patch = (l: Line): Line => {
        const i = l.segs.findIndex((s) => s.t === 'el' && s.id === afterId);
        if (i < 0) return l;
        const segs = [...l.segs];
        segs.splice(i + 1, 0, { t: 'text', v: ' ' }, { t: 'el', id }, { t: 'text', v: '' });
        return { ...l, segs };
      };
      return e.kind === 'line' ? { kind: 'line', ...patch(e) } : { ...e, lines: e.lines.map(patch) };
    }));
  }

  function removeElement(id: string) {
    setStack((st) => st.map((e) => {
      const patch = (l: Line): Line => ({ ...l, segs: normalise(l.segs.filter((s) => !(s.t === 'el' && s.id === id))) });
      return e.kind === 'line' ? { kind: 'line', ...patch(e) } : { ...e, lines: e.lines.map(patch) };
    }));
    setEls((m) => { const n = { ...m }; delete n[id]; return n; });
    setOpenChip((c) => (c === id ? null : c));
    // a separator whose driver just disappeared loses its gate, not its content
    setStack((st) => st.map((e) => (e.kind === 'condition' && e.driver === id
      ? { ...e, driver: null, values: [] } : e)));
  }

  /** Keep the segment list canonical: text/el alternating, no adjacent texts. */
  function normalise(segs: Seg[]): Seg[] {
    const out: Seg[] = [];
    for (const s of segs) {
      const last = out[out.length - 1];
      if (s.t === 'text' && last && last.t === 'text') last.v += s.v;
      else out.push(s.t === 'text' ? { ...s } : s);
    }
    if (!out.length || out[0].t !== 'text') out.unshift({ t: 'text', v: '' });
    if (out[out.length - 1].t !== 'text') out.push({ t: 'text', v: '' });
    return out;
  }

  // ── stack operations ───────────────────────────────────────────────────────
  const addTopLine = () => setStack((st) => [...st, { kind: 'line', ...newLine() }]);
  const addCondition = () => setStack((st) => [...st, {
    id: uid('c'), kind: 'condition', driver: drivers[0]?.id ?? null, values: [],
    caption: null, lines: [newLine()],
  }]);
  const moveEntry = (i: number, d: -1 | 1) => setStack((st) => {
    const j = i + d; if (j < 0 || j >= st.length) return st;
    const n = [...st]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const removeEntry = (i: number) => setStack((st) => (st.length === 1 ? st : st.filter((_, k) => k !== i)));
  const moveNested = (cid: string, i: number, d: -1 | 1) => setStack((st) => st.map((e) => {
    if (e.kind !== 'condition' || e.id !== cid) return e;
    const j = i + d; if (j < 0 || j >= e.lines.length) return e;
    const n = [...e.lines]; [n[i], n[j]] = [n[j], n[i]]; return { ...e, lines: n };
  }));
  const removeNested = (cid: string, i: number) => setStack((st) => st.map((e) => (
    e.kind === 'condition' && e.id === cid && e.lines.length > 1
      ? { ...e, lines: e.lines.filter((_, k) => k !== i) } : e)));

  // ── captions ───────────────────────────────────────────────────────────────
  /** The gold line the document shows for the gated content. Auto-generated from
   *  the condition and kept in step with it; an authored override wins and stops
   *  syncing (it is stored verbatim). */
  function autoCaption(c: Condition): string {
    const d = c.driver ? els[c.driver] : null;
    if (!d || !c.values.length) return 'This is included when the option above is selected.';
    const words = c.values.map((v) => `“${d.items.find((i) => i.value === v)?.label ?? v}”`);
    return `This is included when “${d.label}” is ${words.join(' or ')}.`;
  }
  /** Values a DIFFERENT separator already gates on. They stay selectable — the
   *  same answer may legitimately reveal more than one block — but they are
   *  marked so the author knows the reading order matters. */
  function usedElsewhere(c: Condition): Set<string> {
    const used = new Set<string>();
    for (const e of stack) {
      if (e.kind !== 'condition' || e.id === c.id || e.driver !== c.driver) continue;
      e.values.forEach((v) => used.add(v));
    }
    return used;
  }

  // ── live preview: the REAL render path ─────────────────────────────────────
  /* Preview keys stand in for the CUSTOM keys the RPC will mint. TOKEN_RE only
     accepts A-Z0-9_. so the local '@id' form cannot be previewed directly. */
  const previewKey = (id: string) => `CUSTOM.PREVIEW_${id.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
  const previewFields = useMemo(() => {
    const out = new Map<string, ContractField>();
    for (const e of Object.values(els)) {
      out.set(previewKey(e.id), {
        field_key: previewKey(e.id), label: e.label, section: null, owner_role: 'DEAL',
        value: null, value_type: e.kind === 'select' ? 'select' : 'text',
        required: e.kind === 'text' && e.required, sort_order: 0, can_edit: true,
        input_kind: e.kind, options: e.kind === 'text' ? null : e.items,
        guidance: e.placeholder || null, format_type: e.kind === 'text' ? 'text' : e.kind,
      } as ContractField);
    }
    return out;
  }, [els]);
  const previewBody = (l: Line) => l.segs
    .map((s) => (s.t === 'text' ? s.v : `{{${previewKey(s.id)}}}`)).join('');
  const noopCb = useMemo(() => ({
    editable: false, onSave: () => {}, onSaveStructured: () => {}, onSaveResponsibility: () => {},
    onInclude: () => {}, onNa: () => {}, onControl: () => {}, canSetControl: false,
  }), []);

  // ── submit ─────────────────────────────────────────────────────────────────
  async function submit() {
    setErr(null); setBusy(true);
    try {
      if (mode === 'clause') {
        if (!clauseText.trim()) throw new Error('Write the clause to propose.');
        await proposeClause(documentId, clauseText.trim());
        setAdded((a) => [...a, 'Clause proposed']);
        setClauseText('');
        onAdded();
        return;
      }
      if (creatingSection && !newSection.trim()) throw new Error('Name the new section.');
      if (!creatingSection && !sectionKey) throw new Error('Choose a section.');
      if (creatingHeader && !creatingSection && !newHeader.trim()) throw new Error('Name the new header.');
      if (!creatingHeader && !headerKey) throw new Error('Choose a header, or name a new one.');
      if (creatingSection && !newHeader.trim()) throw new Error('A new section needs a header.');

      const usedIds = new Set<string>();
      const lines: CompositionLine[] = [];
      for (const e of stack) {
        if (e.kind === 'line') {
          const body = lineBody(e).trim();
          if (!body) continue;
          e.segs.forEach((s) => s.t === 'el' && usedIds.add(s.id));
          lines.push({ body, conditional_on: null, caption: null });
          continue;
        }
        if (!e.driver || !e.values.length) throw new Error('Every condition needs a question and at least one answer.');
        const driver = els[e.driver];
        const gate: FieldConditional = driver.kind === 'buttons'
          ? { field_key: `@${e.driver}`, contains: e.values }
          : { field_key: `@${e.driver}`, equals: e.values };
        const caption = e.caption ?? autoCaption(e);
        for (const l of e.lines) {
          const body = lineBody(l).trim();
          if (!body) continue;
          l.segs.forEach((s) => s.t === 'el' && usedIds.add(s.id));
          lines.push({ body, conditional_on: gate, caption });
        }
      }
      if (!lines.length) throw new Error('Write at least one line of content.');

      const elements: CompositionElement[] = Object.values(els)
        .filter((e) => usedIds.has(e.id))
        .map((e) => ({
          id: e.id, kind: e.kind, label: e.label.trim() || 'Entry',
          placeholder: e.placeholder.trim() || null,
          required: e.kind === 'text' ? e.required : false,
          options: e.kind === 'text' ? [] : e.items,
        }));
      // a gate must reference an element that actually survived
      for (const l of lines) {
        const fk = l.conditional_on?.field_key ?? '';
        if (fk.startsWith('@') && !usedIds.has(fk.slice(1))) {
          throw new Error('A condition points at a question that is no longer on any line.');
        }
      }

      const spec: CompositionSpec = {
        section: creatingSection ? newSection.trim() : sectionKey,
        section_new: creatingSection,
        section_position: creatingSection ? sectionPos : null,
        header: creatingHeader
          ? { text: newHeader.trim(), position: headerPos === '' ? null : Number(headerPos) }
          : { clause_key: headerKey },
        elements, lines,
      };
      await addContractComposition(documentId, spec);
      setAdded((a) => [...a, `${creatingHeader ? newHeader.trim() : (section?.headers.find((h) => h.key === headerKey)?.words ?? 'Item')} — ${lines.length} line(s)`]);
      // reset the content row; keep the section so the author can keep building
      setStack([{ kind: 'line', ...newLine() }]);
      setEls({});
      setNewHeader(''); setNewSection(''); setHeaderPos('');
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add that.');
    } finally { setBusy(false); }
  }

  // ── chip + line rendering ──────────────────────────────────────────────────
  const KIND_ICON = { select: ListFilter, buttons: ToggleLeft, text: TypeIcon } as const;

  function LineEditor({ line }: { line: Line }) {
    return (
      <div className="flex flex-wrap items-center gap-y-1 rounded-lg border border-green-800/15 bg-white px-2 py-1.5 min-h-[38px]">
        {line.segs.map((s, i) => s.t === 'text' ? (
          <input key={`${line.id}-t${i}`} value={s.v}
            aria-label="Line text"
            className="bg-transparent outline-none text-[13.5px] text-green-950 py-0.5"
            style={{ width: `${Math.max(6, s.v.length + 2)}ch` }}
            onFocus={(ev) => { caret.current = { lineId: line.id, segIdx: i, offset: ev.target.selectionStart ?? s.v.length }; }}
            onKeyUp={(ev) => { caret.current = { lineId: line.id, segIdx: i, offset: ev.currentTarget.selectionStart ?? 0 }; }}
            onClick={(ev) => { caret.current = { lineId: line.id, segIdx: i, offset: ev.currentTarget.selectionStart ?? 0 }; }}
            onKeyDown={(ev) => {
              /* THE ERROR-PROOFING: a chip is one object. Backspace at offset 0
                 removes the WHOLE element before it — element syntax can never
                 be partially deleted or left half-written in the prose. */
              if (ev.key === 'Backspace' && (ev.currentTarget.selectionStart ?? 0) === 0
                  && (ev.currentTarget.selectionEnd ?? 0) === 0) {
                const prev = line.segs[i - 1];
                if (prev && prev.t === 'el') { ev.preventDefault(); removeElement(prev.id); }
              }
            }}
            onChange={(ev) => updateLine(line.id, (l) => {
              const segs = [...l.segs];
              segs[i] = { t: 'text', v: ev.target.value };
              return { ...l, segs };
            })} />
        ) : (
          <ChipView key={`${line.id}-e${s.id}`} id={s.id} />
        ))}
      </div>
    );
  }

  function ChipView({ id }: { id: string }) {
    const e = els[id];
    if (!e) return null;
    const Icon = KIND_ICON[e.kind];
    const isOpen = openChip === id;
    return (
      <span className="relative inline-flex">
        <button type="button" onClick={() => setOpenChip(isOpen ? null : id)}
          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 mx-0.5 text-[12px] whitespace-nowrap focus-ring ${
            isOpen ? 'border-gold-500 bg-gold-100 text-gold-900' : 'border-gold-400/60 bg-gold-50 text-gold-800 hover:bg-gold-100'}`}>
          <Icon size={11} /> {e.label || e.kind}
        </button>
        {isOpen && <ChipPopover e={e} />}
      </span>
    );
  }

  function ChipPopover({ e }: { e: ElConfig }) {
    const set = (patch: Partial<ElConfig>) => setEls((m) => ({ ...m, [e.id]: { ...m[e.id], ...patch } }));
    const setItem = (i: number, label: string) => set({
      items: e.items.map((it, j) => (j === i ? { value: optValue(label) || `OPTION_${i + 1}`, label } : it)),
    });
    const hasOther = e.items.some((i) => i.label.trim().toLowerCase() === 'other');
    return (
      <div className="absolute z-10 top-full left-0 mt-1 w-72 rounded-lg border border-green-800/15 bg-white shadow-lg p-3"
        onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">
            {e.kind === 'select' ? 'Dropdown' : e.kind === 'buttons' ? 'Buttons (multi-select)' : 'Text field'}
          </span>
          <button type="button" aria-label="Remove this element" className="text-muted hover:text-red-700 focus-ring rounded"
            onClick={() => removeElement(e.id)}><Trash2 size={13} /></button>
        </div>
        <label className="block mb-2">
          <span className="form-label">Name</span>
          <input className="form-input" value={e.label} onChange={(ev) => set({ label: ev.target.value })}
            placeholder="What this asks for" />
        </label>
        {e.kind === 'text' ? (
          <>
            <label className="block mb-2">
              <span className="form-label">Placeholder</span>
              <input className="form-input" value={e.placeholder}
                onChange={(ev) => set({ placeholder: ev.target.value })} placeholder="Guidance shown in the box" />
            </label>
            <label className="flex items-center gap-2 text-[13px] text-green-950">
              <input type="checkbox" checked={e.required} onChange={(ev) => set({ required: ev.target.checked })} />
              Required — signing is blocked until this is filled
            </label>
          </>
        ) : (
          <>
            <span className="form-label">{e.kind === 'select' ? 'Menu items' : 'Buttons'}</span>
            <div className="flex flex-col gap-1 mb-2">
              {e.items.map((it, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input className="form-input flex-1" value={it.label} onChange={(ev) => setItem(i, ev.target.value)} />
                  <button type="button" aria-label="Move up" disabled={i === 0} className="text-muted disabled:opacity-30 focus-ring rounded"
                    onClick={() => set({ items: e.items.map((x, j) => (j === i - 1 ? e.items[i] : j === i ? e.items[i - 1] : x)) })}>
                    <ChevronUp size={13} /></button>
                  <button type="button" aria-label="Move down" disabled={i === e.items.length - 1} className="text-muted disabled:opacity-30 focus-ring rounded"
                    onClick={() => set({ items: e.items.map((x, j) => (j === i + 1 ? e.items[i] : j === i ? e.items[i + 1] : x)) })}>
                    <ChevronDown size={13} /></button>
                  <button type="button" aria-label="Remove item" className="text-muted hover:text-red-700 focus-ring rounded"
                    onClick={() => set({ items: e.items.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            <button type="button" className="text-[12px] text-gold-800 hover:underline focus-ring rounded"
              onClick={() => set({ items: [...e.items, { value: `OPTION_${e.items.length + 1}`, label: `Option ${e.items.length + 1}` }] })}>
              + {e.kind === 'select' ? 'menu item' : 'button'}
            </button>
            {e.kind === 'select' && (
              <label className="block mt-2">
                <span className="form-label">Placeholder (collapsed state)</span>
                <input className="form-input" value={e.placeholder}
                  onChange={(ev) => set({ placeholder: ev.target.value })} placeholder="Choose one…" />
              </label>
            )}
            {hasOther && (
              <button type="button" className="mt-2 text-[12px] text-gold-800 hover:underline focus-ring rounded"
                onClick={() => { addOtherDetails(e.id); setOpenChip(null); }}>
                + details field for “Other”
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  const lineControls = (up: () => void, down: () => void, del: () => void, canDel: boolean) => (
    <div className="flex flex-col items-center pt-1 text-muted">
      <button type="button" aria-label="Move line up" onClick={up} className="hover:text-green-800 focus-ring rounded"><ChevronUp size={14} /></button>
      <button type="button" aria-label="Move line down" onClick={down} className="hover:text-green-800 focus-ring rounded"><ChevronDown size={14} /></button>
      <button type="button" aria-label="Remove line" onClick={del} disabled={!canDel}
        className="hover:text-red-700 disabled:opacity-30 focus-ring rounded"><Trash2 size={13} /></button>
    </div>
  );

  // PORTAL TO <body> (2026-08-04). The trigger lives in the contract subheader,
  // which is `sticky` + `backdrop-blur` — and a backdrop-filter creates a
  // CONTAINING BLOCK, so `fixed inset-0` resolved against that thin bar instead
  // of the viewport: the modal rendered clipped, its header and Name field cut
  // off above the fold with no way to scroll to them. Rendering through a
  // portal puts it back on the viewport where `fixed` means what it says.
  return createPortal((
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-green-950/40 p-4 overflow-y-auto overscroll-contain" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[88vh] overflow-y-auto overscroll-contain p-6 my-auto"
        onClick={(e) => { e.stopPropagation(); setOpenChip(null); }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-lg text-green-900">Add to this contract</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-green-800 focus-ring rounded"><X size={18} /></button>
        </div>

        {modes.length > 1 && (
          <div className="flex gap-1.5 mb-4">
            {modes.map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-sans focus-ring ${
                  mode === m ? 'bg-green-800 text-white' : 'bg-green-800/10 text-green-800 hover:bg-green-800/20'}`}>
                {m === 'compose' ? 'Write an item' : 'Propose a clause'}
              </button>
            ))}
          </div>
        )}

        {err && <p role="alert" className="form-error mb-3">{err}</p>}

        {mode === 'clause' ? (
          <div className="flex flex-col gap-2">
            <span className="form-label">New clause</span>
            <textarea rows={4} className="form-input resize-y" value={clauseText} onChange={(e) => setClauseText(e.target.value)}
              placeholder="Write the clause you want to propose. It's highlighted for the other party to accept or reject." />
            <p className="form-hint">Proposed clauses don't change the contract until accepted — they appear under Proposed changes for review.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* ── ROW 1 — SECTION ─────────────────────────────────────────── */}
            <div>
              <p className="form-hint mb-1">Which section does this belong in? Pick one, or name a new section and choose its number.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="form-label">Section</span>
                  <select className="form-input" value={creatingSection ? '' : sectionKey} disabled={creatingSection}
                    onChange={(e) => setSectionKey(e.target.value)}>
                    {docSections.map((s) => <option key={s.key} value={s.key}>{s.number}. {s.heading}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="form-label">…or a new section</span>
                  <input className="form-input" value={newSection} onChange={(e) => setNewSection(e.target.value)}
                    placeholder="e.g. Special Provisions" />
                </label>
              </div>
              {creatingSection && (
                <label className="block mt-2 max-w-[16rem]">
                  <span className="form-label">Its number</span>
                  <select className="form-input" value={sectionPos} onChange={(e) => setSectionPos(Number(e.target.value))}>
                    {Array.from({ length: docSections.length + 1 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n}{n <= docSections.length ? ` — before “${docSections[n - 1].heading}”` : ' — last'}</option>
                    ))}
                  </select>
                  <p className="form-hint mt-1">The sections after it shift down automatically.</p>
                </label>
              )}
            </div>

            {/* ── ROW 2 — HEADER ──────────────────────────────────────────── */}
            <div>
              <p className="form-hint mb-1">
                Which item inside that section? Add to an existing one, or name a new header —
                a header is what carries the number.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block">
                  <span className="form-label">Header</span>
                  <select className="form-input" value={creatingHeader ? '' : headerKey} disabled={creatingHeader}
                    onChange={(e) => setHeaderKey(e.target.value)}>
                    {(section?.headers ?? []).map((h) => <option key={h.key} value={h.key}>{h.number} {h.words}</option>)}
                    {(section?.headers ?? []).length === 0 && <option value="">— none yet —</option>}
                  </select>
                </label>
                <label className="block">
                  <span className="form-label">…or a new header</span>
                  <input className="form-input" value={newHeader} onChange={(e) => setNewHeader(e.target.value)}
                    placeholder="e.g. Turnout" />
                </label>
              </div>
              {creatingHeader && !creatingSection && (
                <label className="block mt-2 max-w-[16rem]">
                  <span className="form-label">Its position</span>
                  <select className="form-input" value={headerPos}
                    onChange={(e) => setHeaderPos(e.target.value === '' ? '' : Number(e.target.value))}>
                    <option value="">End of the section</option>
                    {(section?.headers ?? []).map((h, i) => (
                      <option key={h.key} value={i + 1}>Before {h.number} {h.words}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* ── ROW 3 — CONTENT ─────────────────────────────────────────── */}
            <div>
              <p className="form-hint mb-1">
                Write the content. Each line stands on its own; a condition reveals only the lines inside it.
                Place a dropdown, buttons or a text field right where it belongs in the sentence.
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button type="button" className="inline-flex items-center gap-1 text-[12px] border border-gold-400/60 text-gold-800 rounded-lg px-2.5 py-1 hover:bg-gold-50 focus-ring"
                  onClick={() => insertElement('select')}><ListFilter size={12} /> Dropdown</button>
                <button type="button" className="inline-flex items-center gap-1 text-[12px] border border-gold-400/60 text-gold-800 rounded-lg px-2.5 py-1 hover:bg-gold-50 focus-ring"
                  onClick={() => insertElement('buttons')}><ToggleLeft size={12} /> Buttons</button>
                <button type="button" className="inline-flex items-center gap-1 text-[12px] border border-gold-400/60 text-gold-800 rounded-lg px-2.5 py-1 hover:bg-gold-50 focus-ring"
                  onClick={() => insertElement('text')}><TypeIcon size={12} /> Text field</button>
              </div>

              <div className="flex flex-col gap-2">
                {stack.map((entry, i) => entry.kind === 'line' ? (
                  <div key={entry.id} className="flex gap-1.5">
                    <div className="flex-1 min-w-0"><LineEditor line={entry} /></div>
                    {lineControls(() => moveEntry(i, -1), () => moveEntry(i, 1), () => removeEntry(i), stack.length > 1)}
                  </div>
                ) : (
                  <div key={entry.id} className="flex gap-1.5">
                    <div className="flex-1 min-w-0 rounded-lg border border-gold-400/50 bg-gold-50/40 p-2.5">
                      <div className="flex flex-wrap items-end gap-2 mb-2">
                        <label className="block">
                          <span className="form-label">Include the content below when</span>
                          <select className="form-input" value={entry.driver ?? ''}
                            onChange={(ev) => setStack((st) => st.map((x) => (x.id === entry.id && x.kind === 'condition'
                              ? { ...x, driver: ev.target.value || null, values: [] } : x)))}>
                            <option value="">— choose a question —</option>
                            {drivers.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                          </select>
                        </label>
                      </div>
                      {entry.driver && els[entry.driver] && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {els[entry.driver].items.map((it) => {
                            const on = entry.values.includes(it.value);
                            const used = usedElsewhere(entry).has(it.value);
                            return (
                              <button key={it.value} type="button"
                                className={`text-[12px] rounded-full px-2.5 py-1 border focus-ring ${
                                  on ? 'bg-green-800 text-white border-green-800' : 'bg-white text-green-900 border-green-800/25 hover:bg-green-800/5'}`}
                                onClick={() => setStack((st) => st.map((x) => (x.id === entry.id && x.kind === 'condition'
                                  ? { ...x, values: on ? x.values.filter((v) => v !== it.value) : [...x.values, it.value] } : x)))}>
                                {it.label}{used && <span className="opacity-70"> · already used</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <label className="block mb-2">
                        <span className="form-label">Note shown in the document</span>
                        <input className="form-input" value={entry.caption ?? autoCaption(entry)}
                          onChange={(ev) => setStack((st) => st.map((x) => (x.id === entry.id && x.kind === 'condition'
                            ? { ...x, caption: ev.target.value } : x)))} />
                        <p className="form-hint mt-1">
                          {entry.caption === null
                            ? 'Written for you from the condition, and kept in step with it. Type here to set your own.'
                            : 'Your wording — it no longer follows the condition.'}
                        </p>
                      </label>
                      <div className="flex flex-col gap-2">
                        {entry.lines.map((l, li) => (
                          <div key={l.id} className="flex gap-1.5">
                            <div className="flex-1 min-w-0"><LineEditor line={l} /></div>
                            {lineControls(() => moveNested(entry.id, li, -1), () => moveNested(entry.id, li, 1),
                              () => removeNested(entry.id, li), entry.lines.length > 1)}
                          </div>
                        ))}
                      </div>
                      <button type="button" className="mt-2 text-[12px] text-gold-800 hover:underline focus-ring rounded"
                        onClick={() => setStack((st) => st.map((x) => (x.id === entry.id && x.kind === 'condition'
                          ? { ...x, lines: [...x.lines, newLine()] } : x)))}>
                        + line inside this condition
                      </button>
                    </div>
                    {lineControls(() => moveEntry(i, -1), () => moveEntry(i, 1), () => removeEntry(i), stack.length > 1)}
                  </div>
                ))}
              </div>

              <div className="flex gap-1.5 mt-2">
                <button type="button" onClick={addTopLine}
                  className="inline-flex items-center gap-1 text-[12px] border border-green-800/25 text-green-900 rounded-lg px-2.5 py-1 hover:bg-green-800/5 focus-ring">
                  <Plus size={12} /> Add a line
                </button>
                <button type="button" onClick={addCondition}
                  className="inline-flex items-center gap-1 text-[12px] border border-gold-400/60 text-gold-800 rounded-lg px-2.5 py-1 hover:bg-gold-50 focus-ring">
                  <Plus size={12} /> Add a condition
                </button>
              </div>

              {/* LIVE PREVIEW — rendered by ClauseProse, the document's own path */}
              <div className="mt-4 rounded-lg border border-green-800/10 bg-green-50/40 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted mb-1.5">How it will read</p>
                <div className="document-paper">
                  <p className="text-[13px] font-semibold text-green-900 mb-1 flex items-center gap-1.5">
                    <span className="text-muted tabular-nums">
                      {creatingHeader
                        ? `${section?.number ?? docSections.length + 1}.${(section?.headers.length ?? 0) + 1}`
                        : (section?.headers.find((h) => h.key === headerKey)?.number ?? '')}
                    </span>
                    {creatingHeader ? (newHeader.trim() || 'New header')
                      : section?.headers.find((h) => h.key === headerKey)?.words}
                  </p>
                  {allLines.map(({ line, cond }) => (
                    <div key={line.id} className={cond ? 'opacity-60' : ''}>
                      {cond && (
                        <p className="text-[11px] text-gold-700/90 mb-0.5">{cond.caption ?? autoCaption(cond)}</p>
                      )}
                      <ClauseProse body={previewBody(line)} fieldByKey={previewFields}
                        valueByKey={{}} cb={noopCb as never} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* running log of what's been added — build out a section without reopening */}
        {added.length > 0 && (
          <div className="mt-4 rounded-lg bg-green-50/60 border border-green-800/10 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Added this session</p>
            <ul className="text-sm text-green-900 list-disc list-inside space-y-0.5">
              {added.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            {added.length > 0 ? 'Done' : 'Cancel'}
          </button>
          <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void submit()}>
            <Plus size={14} /> {mode === 'clause' ? 'Propose' : 'Add to the contract'}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
