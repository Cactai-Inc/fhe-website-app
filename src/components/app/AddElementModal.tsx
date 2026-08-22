import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, ChevronUp, ChevronDown, Trash2, ListFilter, ToggleLeft, Type as TypeIcon } from 'lucide-react';
import {
  addContractComposition, proposeClause, proposeContractComposition, removeContractComposition,
  type CompositionElement, type CompositionLine, type CompositionSpec,
  type ContractField, type FieldConditional, type TemplateStructure,
} from '../../lib/contracts';
import { toErrorMessage } from '../../lib/ops/errors';
import { ClauseProse } from './ClauseDocument';

/**
 * ADD ITEM — the one surface for adding authored content to a live contract.
 *
 * It asks the three questions a contract addition actually has, in the order the
 * document itself is built:
 *   ROW 1  SECTION — which numbered section is this going in? (or name a new one
 *          and choose its number)
 *   ROW 2  HEADER  — which numbered item inside it? (or name a new header), and
 *          where among that item's existing lines the new content lands
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
 *
 * ── TASK ADDITEM (2026-08-12) — the mechanics repair ────────────────────────
 * The concept above was right and the editing surface was unusable. Four things
 * were structurally wrong and are fixed here:
 *
 *  S2  LineEditor / ChipView / ChipPopover were declared INSIDE the modal's
 *      render body. A component declared inside another component's body is a
 *      NEW FUNCTION IDENTITY on every render, so React unmounted and remounted
 *      the whole subtree on each keystroke and focus died after one character.
 *      All three now live at MODULE SCOPE and take an explicit prop contract.
 *  S1  Every text segment was sized to its own content, so an empty line was a
 *      6ch input sitting at the left edge of a full-width box and everything to
 *      its right was dead container. The TRAILING segment now grows to fill the
 *      row, and a click that lands on the container itself is routed into it.
 *  S3  The modal body carried `onClick={… setOpenChip(null)}`, so any click
 *      anywhere closed the open chip popover. Dismissal now belongs to the
 *      POPOVER, which listens for a mousedown outside itself. No catch-all.
 *  S6  The backdrop closed on mouse-UP, so a text selection dragged past the
 *      modal edge closed it — and the draft lived in modal-local state, so it
 *      was destroyed. Closing now requires a gesture that STARTED on the
 *      backdrop, and the draft is persisted per document (see DRAFTS below), so
 *      an accidental close costs nothing.
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

const KIND_ICON = { select: ListFilter, buttons: ToggleLeft, text: TypeIcon } as const;

// ── DRAFTS (S6 + S7) ─────────────────────────────────────────────────────────
/* The editor's state used to live and die with the modal, so closing it — by
 * accident or on purpose — destroyed an authored clause silently. It is now
 * persisted per DOCUMENT: one draft, restored the next time the modal opens,
 * cleared when the item is added or the author explicitly discards it. That is
 * what makes an accidental close harmless, and it is also the whole of S7 —
 * "access a draft" is the same store, surfaced on the button that opens it. */
type Draft = {
  mode: Mode;
  clauseText: string;
  sectionKey: string; newSection: string; sectionPos: number;
  headerKey: string; newHeader: string; headerPos: number | '';
  linePos: number | '';
  stack: StackEntry[];
  els: Record<string, ElConfig>;
};
const draftKey = (documentId: string) => `fhe.additem.draft.${documentId}`;

function readDraft(documentId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(documentId));
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || !Array.isArray(d.stack) || !d.stack.length || typeof d.els !== 'object') return null;
    return d;
  } catch { return null; }
}
function writeDraft(documentId: string, d: Draft) {
  try { window.localStorage.setItem(draftKey(documentId), JSON.stringify(d)); } catch { /* quota / private mode */ }
}
function clearDraft(documentId: string) {
  try { window.localStorage.removeItem(draftKey(documentId)); } catch { /* ignore */ }
}
/** Restored ids ("l3", "e7") were minted by a previous page load, when `_uid`
 *  was a different number. Advance the counter past every id in the draft so a
 *  newly-minted element can never collide with a restored one. */
function adoptIds(d: Draft) {
  let max = 0;
  const scan = (s: string) => { const m = /(\d+)$/.exec(s); if (m) max = Math.max(max, Number(m[1])); };
  const scanLine = (l: Line) => { scan(l.id); for (const s of l.segs) if (s.t === 'el') scan(s.id); };
  for (const e of d.stack) {
    scan(e.id);
    if (e.kind === 'line') scanLine(e); else e.lines.forEach(scanLine);
  }
  Object.keys(d.els).forEach(scan);
  if (max > _uid) _uid = max;
}
/** Is there anything in this draft worth keeping? An untouched editor is not a
 *  draft — persisting it would mean every open leaves litter behind. */
function draftHasContent(d: Draft): boolean {
  if (d.clauseText.trim() || d.newSection.trim() || d.newHeader.trim()) return true;
  const written = (l: Line) => l.segs.some((s) => (s.t === 'text' ? s.v.trim() !== '' : true));
  return d.stack.some((e) => (e.kind === 'line' ? written(e) : e.lines.some(written)));
}

// ── the line editor and its chips — MODULE SCOPE (S2) ────────────────────────
/** The element registry plus every operation a chip performs on it. Bundled
 *  deliberately: this is one coherent thing (the elements of this addition and
 *  how they are edited), not a props bag — every chip needs all of it, and the
 *  three components below are the only readers. */
type ChipApi = {
  els: Record<string, ElConfig>;
  openChip: string | null;
  setOpenChip: (id: string | null) => void;
  patchEl: (id: string, patch: Partial<ElConfig>) => void;
  removeEl: (id: string) => void;
  addOtherDetails: (afterId: string) => void;
};
/** A one-shot request to put the text caret somewhere — used after inserting a
 *  chip and after adding a line, so the author keeps typing where they were
 *  looking. Cleared by the editor the moment it is honoured. */
type FocusReq = { lineId: string; segIdx: number; offset: number } | null;

function LineEditor({ line, chips, focusReq, onFocusDone, onChange, onCaret }: {
  line: Line;
  chips: ChipApi;
  focusReq: FocusReq;
  onFocusDone: () => void;
  onChange: (fn: (l: Line) => Line) => void;
  /** Remember where the caret is, so the toolbar knows where a chip goes. */
  onCaret: (segIdx: number, offset: number) => void;
}) {
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const setInput = (i: number) => (el: HTMLInputElement | null) => {
    if (el) inputs.current.set(i, el); else inputs.current.delete(i);
  };

  useEffect(() => {
    if (!focusReq || focusReq.lineId !== line.id) return;
    const el = inputs.current.get(focusReq.segIdx);
    if (!el) return;
    el.focus();
    const off = Math.min(focusReq.offset, el.value.length);
    el.setSelectionRange(off, off);
    onFocusDone();
  }, [focusReq, line.id, onFocusDone]);

  const lastTextIdx = (() => {
    for (let i = line.segs.length - 1; i >= 0; i -= 1) if (line.segs[i].t === 'text') return i;
    return -1;
  })();

  /* S1 — THE CLICK TARGET. The trailing text segment grows to fill the rest of
     the row (below), which covers the ordinary "click in the empty space and
     type" gesture: the browser places the caret at the click point itself. This
     handler is the remainder — a click that lands on the CONTAINER (the gap
     under a wrapped row, the padding beside a chip) is routed into the trailing
     segment with the caret at its end. Only fires when the container itself was
     hit, so it never steals a click aimed at an input or a chip. */
  const onContainerDown = (ev: React.MouseEvent<HTMLDivElement>) => {
    if (ev.target !== ev.currentTarget) return;
    const el = inputs.current.get(lastTextIdx);
    if (!el) return;
    ev.preventDefault();
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  };

  return (
    <div onMouseDown={onContainerDown}
      className="flex flex-wrap items-center gap-y-1 rounded-lg border border-green-800/15 bg-white px-2 py-1.5 min-h-[38px] cursor-text">
      {line.segs.map((s, i) => s.t === 'text' ? (
        <input key={`t${i}`} ref={setInput(i)} value={s.v}
          aria-label="Line text"
          className="bg-transparent outline-none text-[13.5px] text-green-950 py-0.5"
          /* Content-width is the right sizing model — text segments and chips
             share one line, so a segment cannot claim the row. The LAST one is
             the exception: it grows into whatever is left, which is what makes
             the box clickable. `width` is the flex basis, so the input is never
             narrower than its own text; maxWidth keeps a long segment inside
             the box instead of overflowing it. */
          style={i === lastTextIdx
            ? { flex: '1 1 auto', width: `${Math.max(6, s.v.length + 2)}ch`, maxWidth: '100%' }
            : { width: `${Math.max(6, s.v.length + 2)}ch`, maxWidth: '100%' }}
          onFocus={(ev) => onCaret(i, ev.currentTarget.selectionStart ?? s.v.length)}
          onSelect={(ev) => onCaret(i, ev.currentTarget.selectionStart ?? 0)}
          onKeyDown={(ev) => {
            /* THE ERROR-PROOFING: a chip is one object. Backspace at offset 0
               removes the WHOLE element before it — element syntax can never
               be partially deleted or left half-written in the prose. */
            if (ev.key === 'Backspace' && (ev.currentTarget.selectionStart ?? 0) === 0
                && (ev.currentTarget.selectionEnd ?? 0) === 0) {
              const prev = line.segs[i - 1];
              if (prev && prev.t === 'el') { ev.preventDefault(); chips.removeEl(prev.id); }
            }
          }}
          onChange={(ev) => onChange((l) => {
            const segs = [...l.segs];
            segs[i] = { t: 'text', v: ev.target.value };
            return { ...l, segs };
          })} />
      ) : (
        <ChipView key={`e${s.id}`} id={s.id} chips={chips} />
      ))}
    </div>
  );
}

function ChipView({ id, chips }: { id: string; chips: ChipApi }) {
  const e = chips.els[id];
  if (!e) return null;
  const Icon = KIND_ICON[e.kind];
  const isOpen = chips.openChip === id;
  return (
    <span className="relative inline-flex">
      <button type="button" onClick={() => chips.setOpenChip(isOpen ? null : id)}
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 mx-0.5 text-[12px] whitespace-nowrap focus-ring ${
          isOpen ? 'border-gold-500 bg-gold-100 text-gold-900' : 'border-gold-400/60 bg-gold-50 text-gold-800 hover:bg-gold-100'}`}>
        <Icon size={11} /> {e.label || e.kind}
      </button>
      {isOpen && <ChipPopover e={e} chips={chips} />}
    </span>
  );
}

function ChipPopover({ e, chips }: { e: ElConfig; chips: ChipApi }) {
  const { setOpenChip, patchEl, removeEl, addOtherDetails } = chips;
  const box = useRef<HTMLDivElement>(null);

  /* S3 — DISMISSAL BELONGS TO THE POPOVER. It used to belong to the modal body,
     which called setOpenChip(null) on every click it saw; the popover then
     re-stopped propagation to defend itself, and the two cancelled out into
     something nobody could reason about. One rule now: a MOUSEDOWN outside this
     popover and outside the chip that owns it closes it. Mousedown, not click,
     so releasing a drag-selection outside the box does not count. */
  useEffect(() => {
    const onDown = (ev: MouseEvent) => {
      const n = box.current;
      if (!n) return;
      const t = ev.target as Node | null;
      // n.parentElement is the wrapper holding both the chip button and this
      // popover — clicking the chip is a toggle, not an outside click.
      if (t && (n.contains(t) || n.parentElement?.contains(t))) return;
      setOpenChip(null);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [setOpenChip]);

  const set = (patch: Partial<ElConfig>) => patchEl(e.id, patch);
  const setItem = (i: number, label: string) => set({
    items: e.items.map((it, j) => (j === i ? { value: optValue(label) || `OPTION_${i + 1}`, label } : it)),
  });
  const hasOther = e.items.some((i) => i.label.trim().toLowerCase() === 'other');
  return (
    <div ref={box} className="absolute z-10 top-full left-0 mt-1 w-72 rounded-lg border border-green-800/15 bg-white shadow-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase tracking-wide text-muted">
          {e.kind === 'select' ? 'Dropdown' : e.kind === 'buttons' ? 'Buttons (multi-select)' : 'Text field'}
        </span>
        <button type="button" aria-label="Remove this element" className="text-muted hover:text-red-700 focus-ring rounded"
          onClick={() => removeEl(e.id)}><Trash2 size={13} /></button>
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

function LineControls({ up, down, del, canDel }: {
  up: () => void; down: () => void; del: () => void; canDel: boolean;
}) {
  return (
    <div className="flex flex-col items-center pt-1 text-muted">
      <button type="button" aria-label="Move line up" onClick={up} className="hover:text-green-800 focus-ring rounded"><ChevronUp size={14} /></button>
      <button type="button" aria-label="Move line down" onClick={down} className="hover:text-green-800 focus-ring rounded"><ChevronDown size={14} /></button>
      <button type="button" aria-label="Remove line" onClick={del} disabled={!canDel}
        className="hover:text-red-700 disabled:opacity-30 focus-ring rounded"><Trash2 size={13} /></button>
    </div>
  );
}

export function AddElementButton({
  structure, fields, documentId, disabled, disabledReason, onAdded,
  canAddStructure = true, canAddClause = false, canApplyDirectly = true, className,
}: {
  structure: TemplateStructure;
  fields: ContractField[];
  documentId: string;
  disabled?: boolean;
  /** Why the control is unavailable — shown on hover instead of a dead button
   *  with no explanation. `add_contract_composition` accepts only `editable` /
   *  `editing`, so a document in review must say so rather than fail on save. */
  disabledReason?: string;
  onAdded: () => void;
  canAddStructure?: boolean;
  canAddClause?: boolean;
  /** Edit-tier (document_party_controls.can_edit_deal, or staff): submitting
   *  applies immediately. Suggest-tier (can_suggest): stages for the actual
   *  counterparty to review, and is restricted to an existing section/header
   *  with no new elements — the server enforces this too. */
  canApplyDirectly?: boolean;
  /** Lets a caller impose its own sizing. The subheader passes SUBHEADER_BTN so
   *  this control matches the row: with its own hardcoded classes it had no
   *  whitespace-nowrap, so "Add item" wrapped to two lines, and it sized itself
   *  independently of every button beside it. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // S7: a draft is only useful if you can tell it is there.
  const [hasDraft, setHasDraft] = useState(() => !!readDraft(documentId));
  useEffect(() => { setHasDraft(!!readDraft(documentId)); }, [documentId, open]);
  if (!canAddStructure && !canAddClause) return null;
  const label = canAddStructure ? 'Add item' : 'Propose a clause';
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)}
        title={disabled ? disabledReason : hasDraft ? 'You have an unsaved draft on this contract.' : undefined}
        className={className
          ? `${className} border-gold-400/60 bg-white text-gold-800 hover:bg-gold-50 disabled:opacity-50`
          : 'inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-gold-800 border border-gold-400/60 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring disabled:opacity-50'}>
        <Plus size={13} /> {label}
        {hasDraft && !disabled && (
          <span aria-label="unsaved draft" className="inline-block w-1.5 h-1.5 rounded-full bg-gold-500" />
        )}
      </button>
      {open && (
        <AddElementModal structure={structure} fields={fields} documentId={documentId}
          canAddStructure={canAddStructure} canAddClause={canAddClause} canApplyDirectly={canApplyDirectly}
          onClose={() => setOpen(false)}
          onAdded={onAdded} />
      )}
    </>
  );
}

function AddElementModal({
  structure, fields, documentId, onClose, onAdded, canAddStructure, canAddClause, canApplyDirectly,
}: {
  structure: TemplateStructure;
  fields: ContractField[];
  documentId: string;
  onClose: () => void;
  onAdded: () => void;
  canAddStructure: boolean;
  canAddClause: boolean;
  canApplyDirectly: boolean;
}) {
  const modes: Mode[] = [
    ...(canAddStructure ? (['compose'] as Mode[]) : []),
    ...(canAddClause ? (['clause'] as Mode[]) : []),
  ];
  /* The draft is read ONCE, at open. Everything below seeds from it. */
  const restored = useRef<Draft | null>(null);
  if (restored.current === null) {
    const d = readDraft(documentId);
    if (d) adoptIds(d);
    restored.current = d ?? ({} as Draft);
  }
  const seed = restored.current as Partial<Draft>;
  const [draftRestored, setDraftRestored] = useState(() => !!seed.stack);

  const [mode, setMode] = useState<Mode>(seed.mode ?? modes[0] ?? 'compose');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState<string[]>([]);
  const [clauseText, setClauseText] = useState(seed.clauseText ?? '');

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

  /** Author-added LINES already on the document, per header, in stored order —
   *  the list Row 2's position control offers, and the list the removal panel
   *  lists. `sort_order` is the ordering column the composer reads. */
  const authoredLinesByHeader = useMemo(() => {
    const m = new Map<string, ContractField[]>();
    for (const f of customRows) {
      if (f.custom_kind !== 'line') continue;
      const k = f.clause_key ?? '';
      (m.get(k) ?? m.set(k, []).get(k)!).push(f);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [customRows]);

  // ── ROW 1: section ─────────────────────────────────────────────────────────
  const [sectionKey, setSectionKey] = useState<string>(seed.sectionKey ?? docSections[0]?.key ?? '');
  const [newSection, setNewSection] = useState(seed.newSection ?? '');          // non-empty = create it
  const [sectionPos, setSectionPos] = useState<number>(seed.sectionPos ?? docSections.length + 1);
  const creatingSection = newSection.trim() !== '';
  const section = docSections.find((s) => s.key === sectionKey);

  // ── ROW 2: header ──────────────────────────────────────────────────────────
  const [headerKey, setHeaderKey] = useState<string>(seed.headerKey ?? '');
  const [newHeader, setNewHeader] = useState(seed.newHeader ?? '');
  const [headerPos, setHeaderPos] = useState<number | ''>(seed.headerPos ?? '');   // '' = end of section
  /** S4 — WHERE INSIDE THE ITEM. '' = after everything already there. */
  const [linePos, setLinePos] = useState<number | ''>(seed.linePos ?? '');
  const creatingHeader = creatingSection || newHeader.trim() !== '';
  /* Seed the header from the section on FIRST render only when there is no
     restored draft — otherwise this effect would immediately overwrite the
     header the author had chosen before the modal closed. */
  const headerSeeded = useRef(!!seed.stack);
  useEffect(() => {
    if (headerSeeded.current) { headerSeeded.current = false; return; }
    setHeaderKey(section?.headers[0]?.key ?? '');
    setLinePos('');
  }, [section]);

  /** The lines already sitting under the chosen existing header. */
  const targetLines = useMemo(
    () => (creatingHeader ? [] : (authoredLinesByHeader.get(headerKey) ?? [])),
    [creatingHeader, authoredLinesByHeader, headerKey],
  );

  // ── ROW 3: content ─────────────────────────────────────────────────────────
  const [stack, setStack] = useState<StackEntry[]>(() => seed.stack ?? [{ kind: 'line', ...newLine() }]);
  const [els, setEls] = useState<Record<string, ElConfig>>(() => seed.els ?? {});
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [focusReq, setFocusReq] = useState<FocusReq>(null);
  const onFocusDone = useCallback(() => setFocusReq(null), []);
  /** WHERE THE NEXT CHIP LANDS — line, text segment, offset.
   *  This is NOT focus-loss compensation (there is no restore-after-render pass
   *  and never was): the toolbar buttons live outside the inputs, so pressing
   *  one blurs whatever you were typing in. Without this the editor would have
   *  no idea which sentence, or which point in it, the chip belongs to. */
  const insertAt = useRef<{ lineId: string; segIdx: number; offset: number } | null>(null);

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

  const updateLine = useCallback((lineId: string, fn: (l: Line) => Line) => setStack((st) => st.map((e) => {
    if (e.kind === 'line') return e.id === lineId ? { kind: 'line', ...fn(e) } : e;
    return { ...e, lines: e.lines.map((l) => (l.id === lineId ? fn(l) : l)) };
  })), []);

  const patchEl = useCallback((id: string, patch: Partial<ElConfig>) =>
    setEls((m) => ({ ...m, [id]: { ...m[id], ...patch } })), []);

  const removeElement = useCallback((id: string) => {
    setStack((st) => st.map((e) => {
      const patch = (l: Line): Line => ({ ...l, segs: normalise(l.segs.filter((s) => !(s.t === 'el' && s.id === id))) });
      return e.kind === 'line' ? { kind: 'line', ...patch(e) } : { ...e, lines: e.lines.map(patch) };
    }));
    setEls((m) => { const n = { ...m }; delete n[id]; return n; });
    setOpenChip((c) => (c === id ? null : c));
    // a separator whose driver just disappeared loses its gate, not its content
    setStack((st) => st.map((e) => (e.kind === 'condition' && e.driver === id
      ? { ...e, driver: null, values: [] } : e)));
  }, []);

  /** Append a text-field chip right after `afterId` — the 'Other' assist. */
  const addOtherDetails = useCallback((afterId: string) => {
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
  }, []);

  const chips: ChipApi = useMemo(
    () => ({ els, openChip, setOpenChip, patchEl, removeEl: removeElement, addOtherDetails }),
    [els, openChip, patchEl, removeElement, addOtherDetails],
  );

  /** Insert a chip at the caret, splitting the text segment it sits in. */
  function insertElement(kind: ElKind) {
    const at = insertAt.current ?? (allLines.length
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
    /* The chip split the segment in two: typing continues in the half AFTER it,
       and the caret record has to follow, or a second chip would land back in
       the first half. */
    insertAt.current = { lineId: at.lineId, segIdx: at.segIdx + 2, offset: 0 };
    setFocusReq({ lineId: at.lineId, segIdx: at.segIdx + 2, offset: 0 });
    setOpenChip(id);
  }

  // ── stack operations ───────────────────────────────────────────────────────
  const addTopLine = () => {
    const l = newLine();
    setStack((st) => [...st, { kind: 'line', ...l }]);
    setFocusReq({ lineId: l.id, segIdx: 0, offset: 0 });
  };
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

  // ── the draft, written on every change ─────────────────────────────────────
  const draft: Draft = useMemo(() => ({
    mode, clauseText, sectionKey, newSection, sectionPos,
    headerKey, newHeader, headerPos, linePos, stack, els,
  }), [mode, clauseText, sectionKey, newSection, sectionPos, headerKey, newHeader, headerPos, linePos, stack, els]);
  useEffect(() => {
    if (draftHasContent(draft)) writeDraft(documentId, draft);
    else clearDraft(documentId);
  }, [documentId, draft]);

  function resetContent() {
    setStack([{ kind: 'line', ...newLine() }]);
    setEls({});
    setNewHeader(''); setNewSection(''); setHeaderPos(''); setLinePos('');
    setClauseText('');
    setDraftRestored(false);
    clearDraft(documentId);
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
        const { applied } = await proposeClause(documentId, clauseText.trim());
        setAdded((a) => [...a, applied ? 'Clause added' : 'Clause proposed']);
        setClauseText('');
        clearDraft(documentId);
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
          : { clause_key: headerKey, line_position: linePos === '' ? null : Number(linePos) },
        elements, lines,
      };
      if (canApplyDirectly) {
        await addContractComposition(documentId, spec);
      } else {
        await proposeContractComposition(documentId, spec);
      }
      const itemLabel = creatingHeader ? newHeader.trim() : (section?.headers.find((h) => h.key === headerKey)?.words ?? 'Item');
      setAdded((a) => [...a, canApplyDirectly
        ? `${itemLabel} — ${lines.length} line(s)`
        : `${itemLabel} — ${lines.length} line(s), suggested for review`]);
      // reset the content row; keep the section so the author can keep building
      resetContent();
      onAdded();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not add that.'));
    } finally { setBusy(false); }
  }

  // ── removal of items already on the document (S8) ──────────────────────────
  /* remove_contract_composition has existed since the add surface shipped and
     had ZERO callers. It refuses a document that is not `editable`/`editing`
     (verified against production 2026-08-12), so an EXECUTED instrument cannot
     be rewritten through it — but the modal only opens on an editable document
     anyway, so the button is never offered on one. */
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  async function removeItem(fieldKey: string) {
    setErr(null); setBusy(true);
    try {
      await removeContractComposition(documentId, fieldKey);
      setConfirmRemove(null);
      onAdded();
    } catch (e) {
      setErr(toErrorMessage(e, 'Could not remove that.'));
    } finally { setBusy(false); }
  }
  /** Everything the author has already added, grouped the way the document
   *  reads it: section → header → lines. */
  const authoredItems = useMemo(() => {
    const headers = customRows.filter((f) => f.custom_kind === 'header');
    const sectionsWithWork = new Map<string, { heading: string; ownRow: ContractField | null;
      headers: { row: ContractField; lines: ContractField[] }[] }>();
    const headingFor = (key: string) => docSections.find((s) => s.key === key)?.heading ?? key;
    for (const cs of customRows) {
      if (cs.custom_kind !== 'section') continue;
      const k = cs.section ?? '';
      sectionsWithWork.set(k, { heading: cs.label ?? k, ownRow: cs, headers: [] });
    }
    for (const h of headers.slice().sort((a, b) => a.sort_order - b.sort_order)) {
      const k = h.section ?? '';
      if (!sectionsWithWork.has(k)) sectionsWithWork.set(k, { heading: headingFor(k), ownRow: null, headers: [] });
      sectionsWithWork.get(k)!.headers.push({ row: h, lines: authoredLinesByHeader.get(h.field_key) ?? [] });
    }
    // lines written under a TEMPLATE header have no authored header row of
    // their own — they belong to the template item they extend.
    const templateHosted: { key: string; words: string; sectionKey: string; lines: ContractField[] }[] = [];
    for (const [clauseKey, lns] of authoredLinesByHeader) {
      if (headers.some((h) => h.field_key === clauseKey)) continue;
      const sec = docSections.find((s) => s.headers.some((h) => h.key === clauseKey));
      const hd = sec?.headers.find((h) => h.key === clauseKey);
      templateHosted.push({
        key: clauseKey, words: hd ? `${hd.number} ${hd.words}` : clauseKey,
        sectionKey: sec?.key ?? (lns[0]?.section ?? ''), lines: lns,
      });
    }
    return { sections: [...sectionsWithWork.entries()], templateHosted };
  }, [customRows, authoredLinesByHeader, docSections]);
  const anythingAuthored = authoredItems.sections.length > 0 || authoredItems.templateHosted.length > 0;

  const lineSnippet = (f: ContractField) => {
    const t = (f.body ?? '').replace(/\{\{[^}]+\}\}/g, '…').trim();
    return t.length > 60 ? `${t.slice(0, 60)}…` : (t || '(empty line)');
  };
  const removeRow = (f: ContractField, label: string, note: string) => (
    <div key={f.field_key} className="flex items-start gap-2 text-[13px] text-green-950">
      <span className="flex-1 min-w-0">{label}</span>
      {confirmRemove === f.field_key ? (
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <span className="text-[11px] text-muted">{note}</span>
          <button type="button" disabled={busy} className="text-[12px] text-red-700 hover:underline focus-ring rounded"
            onClick={() => void removeItem(f.field_key)}>Remove</button>
          <button type="button" className="text-[12px] text-muted hover:underline focus-ring rounded"
            onClick={() => setConfirmRemove(null)}>Keep</button>
        </span>
      ) : (
        <button type="button" aria-label={`Remove ${label}`} className="text-muted hover:text-red-700 focus-ring rounded shrink-0"
          onClick={() => setConfirmRemove(f.field_key)}><Trash2 size={13} /></button>
      )}
    </div>
  );

  // ── the error, put where the author is actually looking ────────────────────
  /* It used to render at the TOP of a modal that scrolls, while the button that
     produces it is at the BOTTOM — so a failed save looked exactly like a
     silent no-op. It now sits above the footer and scrolls itself into view. */
  const errBox = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (err) errBox.current?.scrollIntoView({ block: 'nearest' }); }, [err]);

  /* S6 — CLOSING ON THE BACKDROP. `onClick` alone fires on mouse-UP, so
     selecting text inside the modal and releasing outside it closed the modal.
     A close now requires the gesture to have STARTED on the backdrop. */
  const downOnBackdrop = useRef(false);

  // Escape: dismiss the open chip popover first, then the modal.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      if (openChip) setOpenChip(null); else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openChip, onClose]);

  // PORTAL TO <body> (2026-08-04). The trigger lives in the contract subheader,
  // which is `sticky` + `backdrop-blur` — and a backdrop-filter creates a
  // CONTAINING BLOCK, so `fixed inset-0` resolved against that thin bar instead
  // of the viewport: the modal rendered clipped, its header and Name field cut
  // off above the fold with no way to scroll to them. Rendering through a
  // portal puts it back on the viewport where `fixed` means what it says.
  return createPortal((
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-green-950/40 p-4 overflow-y-auto overscroll-contain"
      onMouseDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget && !openChip; }}
      onClick={(e) => {
        if (e.target === e.currentTarget && downOnBackdrop.current) onClose();
        downOnBackdrop.current = false;
      }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[88vh] overflow-y-auto overscroll-contain p-6 my-auto">
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

        {/* Only while the restored draft still HAS something in it — emptying it
            (or adding it to the contract) should take the notice with it. */}
        {draftRestored && draftHasContent(draft) && (
          <div className="flex items-center justify-between gap-3 mb-3 rounded-lg border border-gold-400/50 bg-gold-50/60 p-2.5">
            <p className="text-[13px] text-green-950">
              Picked up where you left off — this is your unsaved draft for this contract.
            </p>
            <button type="button" className="text-[12px] text-muted hover:text-red-700 hover:underline focus-ring rounded whitespace-nowrap"
              onClick={resetContent}>Discard draft</button>
          </div>
        )}

        {mode === 'clause' ? (
          <div className="flex flex-col gap-2">
            <span className="form-label">New clause</span>
            <textarea rows={4} className="form-input resize-y" value={clauseText} onChange={(e) => setClauseText(e.target.value)}
              placeholder="Write the clause you want to propose. It's highlighted for the other party to accept or reject." />
            <p className="form-hint">
              {canApplyDirectly
                ? 'This adds directly to the contract.'
                : 'Proposed clauses don\'t change the contract until accepted — they appear under Proposed changes for review.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* ── ROW 1 — SECTION ─────────────────────────────────────────── */}
            <div>
              <p className="form-hint mb-1">
                {canApplyDirectly
                  ? 'Which section does this belong in? Pick one, or name a new section and choose its number.'
                  : 'Which section does this belong in? A suggestion goes into an existing section.'}
              </p>
              <div className={canApplyDirectly ? 'grid sm:grid-cols-2 gap-3' : ''}>
                <label className="block">
                  <span className="form-label">Section</span>
                  <select className="form-input" value={creatingSection ? '' : sectionKey} disabled={creatingSection}
                    onChange={(e) => setSectionKey(e.target.value)}>
                    {docSections.map((s) => <option key={s.key} value={s.key}>{s.number}. {s.heading}</option>)}
                  </select>
                </label>
                {canApplyDirectly && (
                  <label className="block">
                    <span className="form-label">…or a new section</span>
                    <input className="form-input" value={newSection} onChange={(e) => setNewSection(e.target.value)}
                      placeholder="e.g. Special Provisions" />
                  </label>
                )}
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
                {canApplyDirectly
                  ? 'Which item inside that section? Add to an existing one, or name a new header — a header is what carries the number.'
                  : 'Which item inside that section? A suggestion goes into an existing one.'}
              </p>
              <div className={canApplyDirectly ? 'grid sm:grid-cols-2 gap-3' : ''}>
                <label className="block">
                  <span className="form-label">Header</span>
                  <select className="form-input" value={creatingHeader ? '' : headerKey} disabled={creatingHeader}
                    onChange={(e) => { setHeaderKey(e.target.value); setLinePos(''); }}>
                    {(section?.headers ?? []).map((h) => <option key={h.key} value={h.key}>{h.number} {h.words}</option>)}
                    {(section?.headers ?? []).length === 0 && <option value="">— none yet —</option>}
                  </select>
                </label>
                {canApplyDirectly && (
                  <label className="block">
                    <span className="form-label">…or a new header</span>
                    <input className="form-input" value={newHeader} onChange={(e) => setNewHeader(e.target.value)}
                      placeholder="e.g. Turnout" />
                  </label>
                )}
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
              {/* S4 — POSITION WITHIN THE ITEM. Only meaningful once the chosen
                  item already has authored lines to sit among; the composer
                  always keeps them after the item's own drafted prose. */}
              {!creatingHeader && targetLines.length > 0 && (
                <label className="block mt-2">
                  <span className="form-label">Where in that item</span>
                  <select className="form-input" value={linePos}
                    onChange={(e) => setLinePos(e.target.value === '' ? '' : Number(e.target.value))}>
                    <option value="">After everything already there</option>
                    {targetLines.map((l, i) => (
                      <option key={l.field_key} value={i + 1}>Before “{lineSnippet(l)}”</option>
                    ))}
                  </select>
                  <p className="form-hint mt-1">
                    Added content always follows the item's own drafted wording.
                  </p>
                </label>
              )}
            </div>

            {/* ── ROW 3 — CONTENT ─────────────────────────────────────────── */}
            <div>
              <p className="form-hint mb-1">
                {canApplyDirectly
                  ? 'Write the content. Each line stands on its own; a condition reveals only the lines inside it. Place a dropdown, buttons or a text field right where it belongs in the sentence.'
                  : 'Write the content. Each line stands on its own. A suggestion is plain text — no new questions.'}
              </p>
              {canApplyDirectly && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <button type="button" className="inline-flex items-center gap-1 text-[12px] border border-gold-400/60 text-gold-800 rounded-lg px-2.5 py-1 hover:bg-gold-50 focus-ring"
                    onClick={() => insertElement('select')}><ListFilter size={12} /> Dropdown</button>
                  <button type="button" className="inline-flex items-center gap-1 text-[12px] border border-gold-400/60 text-gold-800 rounded-lg px-2.5 py-1 hover:bg-gold-50 focus-ring"
                    onClick={() => insertElement('buttons')}><ToggleLeft size={12} /> Buttons</button>
                  <button type="button" className="inline-flex items-center gap-1 text-[12px] border border-gold-400/60 text-gold-800 rounded-lg px-2.5 py-1 hover:bg-gold-50 focus-ring"
                    onClick={() => insertElement('text')}><TypeIcon size={12} /> Text field</button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {stack.map((entry, i) => entry.kind === 'line' ? (
                  <div key={entry.id} className="flex gap-1.5">
                    <div className="flex-1 min-w-0">
                      <LineEditor line={entry} chips={chips} focusReq={focusReq} onFocusDone={onFocusDone}
                        onChange={(fn) => updateLine(entry.id, fn)}
                        onCaret={(segIdx, offset) => { insertAt.current = { lineId: entry.id, segIdx, offset }; }} />
                    </div>
                    <LineControls up={() => moveEntry(i, -1)} down={() => moveEntry(i, 1)}
                      del={() => removeEntry(i)} canDel={stack.length > 1} />
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
                            <div className="flex-1 min-w-0">
                              <LineEditor line={l} chips={chips} focusReq={focusReq} onFocusDone={onFocusDone}
                                onChange={(fn) => updateLine(l.id, fn)}
                                onCaret={(segIdx, offset) => { insertAt.current = { lineId: l.id, segIdx, offset }; }} />
                            </div>
                            <LineControls up={() => moveNested(entry.id, li, -1)} down={() => moveNested(entry.id, li, 1)}
                              del={() => removeNested(entry.id, li)} canDel={entry.lines.length > 1} />
                          </div>
                        ))}
                      </div>
                      <button type="button" className="mt-2 text-[12px] text-gold-800 hover:underline focus-ring rounded"
                        onClick={() => setStack((st) => st.map((x) => (x.id === entry.id && x.kind === 'condition'
                          ? { ...x, lines: [...x.lines, newLine()] } : x)))}>
                        + line inside this condition
                      </button>
                    </div>
                    <LineControls up={() => moveEntry(i, -1)} down={() => moveEntry(i, 1)}
                      del={() => removeEntry(i)} canDel={stack.length > 1} />
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

        {/* WHAT IS ALREADY ON THE DOCUMENT (S8) — the other half of authoring.
            remove_contract_composition has always existed and has never had a
            caller, so an item added by mistake could not be taken back. */}
        {mode === 'compose' && anythingAuthored && (
          <div className="mt-5 rounded-lg border border-green-800/10 bg-white p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted mb-2">Items you have added to this contract</p>
            <div className="flex flex-col gap-3">
              {authoredItems.sections.map(([key, s]) => (
                <div key={`sec-${key}`}>
                  <div className="flex items-start gap-2 mb-1">
                    <span className="flex-1 min-w-0 text-[13px] font-semibold text-green-900">{s.heading}</span>
                    {s.ownRow && confirmRemove !== s.ownRow.field_key && (
                      <button type="button" aria-label={`Remove the section ${s.heading}`}
                        className="text-muted hover:text-red-700 focus-ring rounded shrink-0"
                        onClick={() => setConfirmRemove(s.ownRow!.field_key)}><Trash2 size={13} /></button>
                    )}
                    {s.ownRow && confirmRemove === s.ownRow.field_key && (
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-[11px] text-muted">Removes the section and everything in it.</span>
                        <button type="button" disabled={busy} className="text-[12px] text-red-700 hover:underline focus-ring rounded"
                          onClick={() => void removeItem(s.ownRow!.field_key)}>Remove</button>
                        <button type="button" className="text-[12px] text-muted hover:underline focus-ring rounded"
                          onClick={() => setConfirmRemove(null)}>Keep</button>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 pl-3 border-l border-green-800/10">
                    {s.headers.map((h) => (
                      <div key={h.row.field_key} className="flex flex-col gap-1">
                        {removeRow(h.row, h.row.label ?? 'Item', 'Removes this item, its lines and its questions.')}
                        <div className="flex flex-col gap-1 pl-3">
                          {h.lines.map((l) => removeRow(l, lineSnippet(l), 'Removes this line.'))}
                        </div>
                      </div>
                    ))}
                    {s.headers.length === 0 && <p className="text-[12px] text-muted">No items yet.</p>}
                  </div>
                </div>
              ))}
              {authoredItems.templateHosted.map((t) => (
                <div key={`tpl-${t.key}`}>
                  <p className="text-[13px] font-semibold text-green-900 mb-1">
                    Added under {t.words}
                  </p>
                  <div className="flex flex-col gap-1 pl-3 border-l border-green-800/10">
                    {t.lines.map((l) => removeRow(l, lineSnippet(l), 'Removes this line.'))}
                  </div>
                </div>
              ))}
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

        {err && <p role="alert" ref={errBox} className="form-error mt-4">{err}</p>}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" className="btn-secondary text-sm" onClick={onClose}>
            {added.length > 0 ? 'Done' : 'Close'}
          </button>
          <button type="button" className="btn-primary text-sm" disabled={busy} onClick={() => void submit()}>
            <Plus size={14} /> {mode === 'clause' ? 'Propose' : 'Add to the contract'}
          </button>
        </div>
        <p className="form-hint text-right mt-1">Closing keeps your draft — it reopens where you left off.</p>
      </div>
    </div>
  ), document.body);
}
