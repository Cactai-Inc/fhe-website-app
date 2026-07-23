import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Info, MessageSquarePlus } from 'lucide-react';
import { clauseConditionMet, type ContractField, type FieldStructured, type PartyChoice } from '../../lib/contracts';

/**
 * CONTRACT CASCADE — the living-document field renderer.
 *
 * Renders a subject's fields as a CASCADE: a field surfaces its children only when
 * it has content (or is included); a child gated by `conditional_on` shows only
 * when its controlling field holds a matching value. Each field renders per its
 * `input_kind` (text / longtext / select / buttons / responsibility / contact /
 * currency / date / percent). Free-text carries a guidance hint; any field with
 * `guidance` gets an ⓘ info popover. Optional fields sit collapsed behind an
 * "＋ Include" until added.
 *
 * onSave(field_key, value) persists a scalar; onSaveResponsibility persists the
 * structured party object. The component is presentational + calls back.
 */

type SaveFn = (fieldKey: string, value: string) => void | Promise<void>;
type SaveRespFn = (fieldKey: string, resp: ContractField['responsibility']) => void | Promise<void>;
type SaveStructFn = (fieldKey: string, structured: FieldStructured | null) => void | Promise<void>;
type IncludeFn = (fieldKey: string, included: boolean) => void | Promise<void>;
type NaFn = (fieldKey: string, isNa: boolean) => void | Promise<void>;
type ControlFn = (fieldKey: string, override: ContractField['control_override']) => void | Promise<void>;
/** A party proposes an edit to a field they can't directly change (redline). */
type SuggestFn = (field: ContractField) => void;
/** Open a comment anchored to a specific field. */
type CommentFn = (field: ContractField) => void;

/** Party options. The manage side offers Care Provider; the cost side offers a
 *  "same as responsible party" default plus specific parties / shared split. */
const PARTY_OPTS = [
  { value: 'LESSOR', label: 'Lessor' },
  { value: 'LESSEE', label: 'Lessee' },
  { value: 'CARE_PROVIDER', label: 'Care Provider' },
  { value: 'SHARED', label: 'Shared' },
];
/** Responsibility party sets by kind (the FHE model):
 *   financial → who PAYS: Lessor / Lessee / Shared%  (FHE never financial unless named)
 *   care      → who DOES/oversees: Lessor / Lessee / FHE / Shared  (FHE is care-giver) */
const FINANCIAL_PARTY_OPTS = [
  { value: 'LESSOR', label: 'Lessor' },
  { value: 'LESSEE', label: 'Lessee' },
  { value: 'SHARED', label: 'Shared (split %)' },
];
const CARE_PARTY_OPTS = [
  { value: 'LESSOR', label: 'Lessor' },
  { value: 'LESSEE', label: 'Lessee' },
  { value: 'FHE', label: 'French Heritage Equestrian (care & oversight)' },
  { value: 'SHARED', label: 'Shared' },
];
const COST_PARTY_OPTS = [
  { value: 'LESSOR', label: 'Lessor' },
  { value: 'LESSEE', label: 'Lessee' },
  { value: 'SHARED', label: 'Shared (split %)' },
];

/** The structured party picker: a dropdown, plus the sub-inputs it reveals —
 *  Care Provider → discrete contact fields; Shared → per-party % rows + a note.
 *  Everything writes into one PartyChoice object (structured, reusable). */
function PartyPicker({
  value, placeholder, opts, onChange, disabled, allowProvider = true,
}: {
  value: PartyChoice;
  placeholder: string;
  opts: { value: string; label: string }[];
  onChange: (v: PartyChoice) => void;
  disabled: boolean;
  allowProvider?: boolean;
}) {
  const party = value.party ?? '';
  const set = (patch: Partial<PartyChoice>) => onChange({ ...value, ...patch });
  const parties = value.parties ?? [{ party: 'LESSOR', pct: '50' }, { party: 'LESSEE', pct: '50' }];
  const setPct = (i: number, pct: string) => {
    const next = parties.map((p, j) => (j === i ? { ...p, pct } : p));
    set({ parties: next });
  };
  return (
    <div className="flex flex-col gap-1.5">
      <select className={inputCls} disabled={disabled} value={party}
        onChange={(e) => set({ party: e.target.value })}>
        <option value="">{SELECT_PLACEHOLDER}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {/* ELS gives every allocation an "Other (please specify)" escape. */}
        <option value="OTHER">Other (specify)…</option>
      </select>
      {party === 'OTHER' && (
        <input className={inputCls} disabled={disabled}
          placeholder="Describe the arrangement (e.g. a specific split, a third party, conditions)"
          value={value.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
      )}
      {party === 'CARE_PROVIDER' && allowProvider && (
        <div className="grid grid-cols-2 gap-1.5">
          <input className={inputCls} disabled={disabled} placeholder="Contact name"
            value={value.provider?.name ?? ''} onChange={(e) => set({ provider: { ...value.provider, name: e.target.value } })} />
          <input className={inputCls} disabled={disabled} placeholder="Company"
            value={value.provider?.company ?? ''} onChange={(e) => set({ provider: { ...value.provider, company: e.target.value } })} />
          <input type="tel" className={inputCls} disabled={disabled} placeholder="Phone"
            value={value.provider?.phone ?? ''} onChange={(e) => set({ provider: { ...value.provider, phone: e.target.value } })} />
          <input type="email" className={inputCls} disabled={disabled} placeholder="Email"
            value={value.provider?.email ?? ''} onChange={(e) => set({ provider: { ...value.provider, email: e.target.value } })} />
        </div>
      )}
      {party === 'SHARED' && (
        <div className="flex flex-col gap-1.5 bg-cream-100/40 rounded-lg p-2">
          {parties.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-secondary">
              <span className="w-28 truncate">{p.party === 'LESSOR' ? 'Lessor' : p.party === 'LESSEE' ? 'Lessee' : p.party}</span>
              <input type="number" min={0} max={100} className={`${inputCls} w-20`} disabled={disabled}
                value={p.pct ?? ''} onChange={(e) => setPct(i, e.target.value)} />
              <span>%</span>
            </div>
          ))}
          <input className={inputCls} disabled={disabled} placeholder="Optional note (e.g. Lessee covers routine, Owner covers major)"
            value={value.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
        </div>
      )}
    </div>
  );
}

/** The paired manage↔cost mini-block. Left = who manages (placeholder guidance),
 *  right = who pays (defaults to "Same as responsible party"; diverges only when
 *  changed). One structured value: { manage: PartyChoice, cost: {...} }. */
function PairControl({
  f, onSaveStructured, disabled,
}: { f: ContractField; onSaveStructured: SaveStructFn; disabled: boolean }) {
  const s = f.structured ?? {};
  const manage: PartyChoice = s.manage ?? {};
  const cost = s.cost ?? { same_as_manage: true };
  const subject = (f.label ?? f.field_key).replace(/responsibility/i, '').trim().toLowerCase() || 'this item';
  const commit = (next: FieldStructured) => void onSaveStructured(f.field_key, next);
  const setManage = (m: PartyChoice) => commit({ ...s, manage: m, cost });
  const sameAs = cost.same_as_manage !== false;
  const costChoice: PartyChoice = { party: cost.party, parties: cost.parties, note: cost.note };
  return (
    <div className="grid sm:grid-cols-2 gap-3 bg-white border border-green-800/10 rounded-lg p-3">
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Who manages it</p>
        <PartyPicker value={manage} disabled={disabled} opts={PARTY_OPTS}
          placeholder={`Select the party responsible for managing ${subject}`}
          onChange={setManage} />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted mb-1">Who pays for it</p>
        <select className={inputCls} disabled={disabled}
          value={sameAs ? 'SAME' : (cost.party ?? '')}
          onChange={(e) => {
            if (e.target.value === 'SAME') commit({ ...s, manage, cost: { same_as_manage: true } });
            else commit({ ...s, manage, cost: { same_as_manage: false, party: e.target.value, parties: cost.parties, note: cost.note } });
          }}>
          <option value="SAME">Same as responsible party</option>
          {COST_PARTY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {!sameAs && cost.party === 'SHARED' && (
          <div className="mt-1.5">
            <PartyPicker value={{ party: 'SHARED', ...costChoice }} disabled={disabled} opts={COST_PARTY_OPTS}
              placeholder="Shared" allowProvider={false}
              onChange={(v) => commit({ ...s, manage, cost: { same_as_manage: false, party: 'SHARED', parties: v.parties, note: v.note } })} />
          </div>
        )}
      </div>
    </div>
  );
}

const NA = 'N/A';
const filled = (v?: string | null) => !!v && v.trim() !== '' && v.trim() !== NA;

/** ⓘ info popover — click/tap to toggle. */
export function InfoDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block">
      <button type="button" aria-label="More info" onClick={() => setOpen((v) => !v)}
        className="inline-grid place-items-center w-[18px] h-[18px] rounded-full border border-gold-500 text-gold-700 hover:bg-gold-50 focus-ring align-middle">
        <Info size={11} aria-hidden="true" />
      </button>
      {open && (
        <span className="absolute z-20 left-0 top-6 w-64 max-w-[75vw] bg-white border border-green-800/15 shadow-md rounded-lg p-3 text-xs text-secondary font-sans leading-relaxed">
          {text}
        </span>
      )}
    </span>
  );
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white disabled:bg-cream-100 disabled:text-muted';

/** Renders the composed contract body, turning the composer's ⟦NEEDS:label⟧text⟧
 *  markers into a highlighted "needs input" span (the blank shows AND is flagged),
 *  so unfinished parts of the document stand out instead of reading as complete.
 *
 *  When `onSelectSpan` is provided, selecting text inside the body surfaces a
 *  floating "Comment" button; clicking it reports the selected quote (plus a
 *  little preceding context to disambiguate) so a pinned span-comment can be
 *  anchored to it. This is the single body renderer used across the app (m-5). */
const NEEDS_RE = /⟦NEEDS:(.*?)⟧(.*?)⟧/g;
export function ContractBody({
  body, onSelectSpan,
}: {
  body: string | null;
  onSelectSpan?: (span: { quote: string; quotePrefix: string }) => void;
}) {
  const [sel, setSel] = useState<{ x: number; y: number; quote: string; quotePrefix: string } | null>(null);

  const onMouseUp = () => {
    if (!onSelectSpan) return;
    const s = window.getSelection();
    const text = s?.toString().trim() ?? '';
    if (!text || text.length < 2) { setSel(null); return; }
    // a little preceding context (up to 40 chars) to help relocate after re-merge
    let prefix = '';
    try {
      const range = s!.getRangeAt(0);
      const pre = range.startContainer.textContent?.slice(0, range.startOffset) ?? '';
      prefix = pre.slice(-40);
      const rect = range.getBoundingClientRect();
      setSel({ x: rect.left + rect.width / 2, y: rect.top - 8, quote: text, quotePrefix: prefix });
    } catch { setSel({ x: 0, y: 0, quote: text, quotePrefix: '' }); }
  };

  if (!body) return null;
  const nodes: ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  NEEDS_RE.lastIndex = 0;
  while ((m = NEEDS_RE.exec(body))) {
    if (m.index > last) nodes.push(body.slice(last, m.index));
    nodes.push(
      <mark key={`n${i++}`} title={`Needs: ${m[1]}`}
        className="bg-gold-100 text-gold-900 rounded px-1 border border-gold-400/60 border-dashed">
        {m[2]}
      </mark>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) nodes.push(body.slice(last));

  if (!onSelectSpan) return <>{nodes}</>;

  return (
    <span onMouseUp={onMouseUp} className="relative">
      {nodes}
      {sel && (
        <button type="button"
          style={{ position: 'fixed', left: sel.x, top: sel.y, transform: 'translate(-50%, -100%)' }}
          className="z-30 inline-flex items-center gap-1 bg-green-800 text-white text-xs rounded-full px-2.5 py-1 shadow-md hover:bg-green-700 focus-ring"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { onSelectSpan({ quote: sel.quote, quotePrefix: sel.quotePrefix }); setSel(null); window.getSelection()?.removeAllRanges(); }}>
          <MessageSquarePlus size={12} aria-hidden="true" /> Comment
        </button>
      )}
    </span>
  );
}

/** A dropdown that offers its options first, plus an "Other (specify)…" choice
 *  that reveals a free-text box. This is the house pattern for structured-first
 *  capture: options are the primary path, open text stays available as an escape.
 *  A stored value that matches no option is shown as a custom entry. */
const OTHER_VALUE = '__other__';
/** Uniform empty-state prompt for every dropdown. */
const SELECT_PLACEHOLDER = 'MAKE A SELECTION';
function SelectWithOther({ f, onSave, disabled }: { f: ContractField; onSave: SaveFn; disabled: boolean }) {
  const opts = f.options ?? [];
  // Use the field's own "Other" option when it defines one; only synthesize a
  // second when it doesn't (prevents the "Other" + "Other (specify)…" dupe).
  const ownOther = opts.find((o) => o.value === 'OTHER' || /^other\b/i.test(o.label));
  const otherVal = ownOther?.value ?? OTHER_VALUE;
  const stored = f.value ?? '';
  const storedIsCustom = stored !== '' && !opts.some((o) => o.value === stored);
  const [otherMode, setOtherMode] = useState(storedIsCustom);
  const [custom, setCustom] = useState(storedIsCustom ? stored : '');
  useEffect(() => {
    if (stored !== '' && !opts.some((o) => o.value === stored)) { setOtherMode(true); setCustom(stored); }
  }, [stored]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-1.5">
      <select className={inputCls} disabled={disabled}
        value={otherMode || stored === otherVal ? otherVal : stored}
        onChange={(e) => {
          if (e.target.value === otherVal) { setOtherMode(true); setCustom(''); void onSave(f.field_key, ''); }
          else { setOtherMode(false); setCustom(''); void onSave(f.field_key, e.target.value); }
        }}>
        <option value="">{SELECT_PLACEHOLDER}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {!ownOther && <option value={OTHER_VALUE}>Other (specify)…</option>}
      </select>
      {otherMode && (
        <input className={inputCls} disabled={disabled} placeholder="Enter a custom value"
          value={custom} onChange={(e) => setCustom(e.target.value)}
          onBlur={() => void onSave(f.field_key, custom.trim())} />
      )}
    </div>
  );
}

/** A yes/no question whose "Yes" reveals a free-text input. Structured value:
 *  { enabled, text }. Yes and No are ALWAYS shown as selectable pills with a clear
 *  selected state — choosing No collapses the input (and clears it); the answer can
 *  be changed any time before signing. The composed sentence appears only when Yes
 *  with text; No / unanswered → the clause is omitted from the final document. */
function RevealText({
  f, onSaveStructured, disabled,
}: { f: ContractField; onSaveStructured: SaveStructFn; disabled: boolean }) {
  const s = f.structured ?? {};
  const yes = s.enabled === true || (s.text ?? '') !== '';
  const no = s.enabled === false && (s.text ?? '') === '';
  const [text, setText] = useState(s.text ?? '');
  const editingRef = useRef(false);
  useEffect(() => { if (!editingRef.current) setText(s.text ?? ''); }, [s.text]);
  const pill = (active: boolean) =>
    `text-[12px] rounded-full px-2.5 py-0.5 border align-baseline focus-ring ${
      active ? 'bg-green-800 text-white border-green-800' : 'border-green-800/25 text-secondary hover:bg-green-50'} ${disabled ? 'opacity-70' : ''}`;
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2 gap-y-1 align-baseline">
      <span className="text-[13.5px] text-green-950">{f.label ?? 'Add details?'}</span>
      <button type="button" disabled={disabled} className={pill(yes)}
        onClick={() => void onSaveStructured(f.field_key, { ...s, enabled: true })}>Yes</button>
      <button type="button" disabled={disabled} className={pill(no)}
        onClick={() => void onSaveStructured(f.field_key, { enabled: false, text: '' })}>No</button>
      {yes && (
        <span className="inline-flex items-baseline gap-1 w-full mt-1">
          <span className="text-[13.5px] text-green-950 whitespace-nowrap">Lessee is prohibited from using these items:</span>
          <input className="flex-1 min-w-[8rem] px-1 text-[13.5px] text-green-900 bg-gold-50/70 border-b border-gold-400/70 focus:outline-none focus:border-gold-600 rounded-sm"
            disabled={disabled} value={text} placeholder="list the prohibited tack / equipment"
            onFocus={() => { editingRef.current = true; }}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => { editingRef.current = false; if (text !== (s.text ?? '')) void onSaveStructured(f.field_key, { ...s, enabled: true, text }); }} />
        </span>
      )}
    </span>
  );
}

const MED_PARTY_OPTS = [
  { value: 'LESSOR', label: 'Lessor' },
  { value: 'LESSEE', label: 'Lessee' },
  { value: 'TRAINER', label: 'Trainer/Instructor' },
  { value: 'BOARDING', label: 'Boarding Staff' },
  { value: 'VETERINARIAN', label: 'Veterinarian' },
  { value: 'OTHER', label: 'Other' },
];

/** Local-draft for a structured builder. Typing updates the DRAFT only (no server
 *  round-trip per keystroke — that reload was resetting the controlled value mid-
 *  type and dropping characters). Text inputs call setLocal + flush(onBlur);
 *  structural actions call commit (immediate). The draft re-seeds from the server
 *  value only when it changes AND the user isn't mid-edit. */
function useStructuredDraft(
  f: ContractField, onSaveStructured: SaveStructFn,
): {
  draft: FieldStructured;
  setLocal: (next: FieldStructured) => void;
  commit: (next: FieldStructured) => void;
  beginEdit: () => void;
  flush: () => void;
} {
  const [draft, setDraft] = useState<FieldStructured>(f.structured ?? {});
  const editingRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (editingRef.current) return;
    if (JSON.stringify(f.structured ?? {}) !== JSON.stringify(draftRef.current)) setDraft(f.structured ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.structured]);
  return {
    draft,
    setLocal: (next) => setDraft(next),
    commit: (next) => { setDraft(next); void onSaveStructured(f.field_key, next); },
    beginEdit: () => { editingRef.current = true; },
    flush: () => { editingRef.current = false; void onSaveStructured(f.field_key, draftRef.current); },
  };
}

/** §11 MEDICATIONS & SUPPLEMENTS builder. Structured { medItems:[{name,dose,
 *  schedule,party,party_note}] }. A single "add a medication or supplement" button
 *  appends a formatted block: Name / Dose / Schedule (free text) + a responsible-
 *  party dropdown (Other reveals a free-text note). Each block is removable. */
function MedicationBuilder({
  f, onSaveStructured, disabled,
}: { f: ContractField; onSaveStructured: SaveStructFn; disabled: boolean }) {
  const { draft, setLocal, commit, beginEdit, flush } = useStructuredDraft(f, onSaveStructured);
  const items = draft.medItems ?? [];
  const add = () => commit({ ...draft, medItems: [...items, { name: '', dose: '', schedule: '', party: '' }] });
  // text edits: local only (commit on blur). the party select commits immediately.
  const editLocal = (i: number, patch: Partial<NonNullable<FieldStructured['medItems']>[number]>) =>
    setLocal({ ...draft, medItems: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const editNow = (i: number, patch: Partial<NonNullable<FieldStructured['medItems']>[number]>) =>
    commit({ ...draft, medItems: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  const remove = (i: number) => commit({ ...draft, medItems: items.filter((_, j) => j !== i) });
  const cell = 'w-full px-2 py-1 rounded border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white disabled:bg-cream-100';
  return (
    <div className="flex flex-col gap-3 w-full max-w-2xl">
      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-green-800/15 p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-[11px] uppercase tracking-wide text-muted">Medication / supplement {i + 1}</p>
            {!disabled && (
              <button type="button" className="text-muted hover:text-red-700 text-xs"
                onClick={() => remove(i)} title="Remove">✕</button>
            )}
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="flex flex-col gap-0.5 text-[11px] text-muted">Name
              <input className={cell} disabled={disabled} value={it.name ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { name: e.target.value })} /></label>
            <label className="flex flex-col gap-0.5 text-[11px] text-muted">Dose
              <input className={cell} disabled={disabled} value={it.dose ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { dose: e.target.value })} /></label>
            <label className="flex flex-col gap-0.5 text-[11px] text-muted">Schedule
              <input className={cell} disabled={disabled} value={it.schedule ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { schedule: e.target.value })} /></label>
          </div>
          <label className="flex flex-col gap-0.5 text-[11px] text-muted mt-2">
            Party responsible for ordering, administering, and cost
            <select className={cell} disabled={disabled} value={it.party ?? ''} onChange={(e) => editNow(i, { party: e.target.value })}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {MED_PARTY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          {it.party === 'OTHER' && (
            <input className={`${cell} mt-1.5`} disabled={disabled} placeholder="Specify the responsible party"
              value={it.party_note ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { party_note: e.target.value })} />
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={add}
          className="self-start text-sm text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">
          ＋ Add a medication or supplement
        </button>
      )}
    </div>
  );
}

/** §3.1 LEASE-FEE builder. One structured value { initial_due, options:[{amount,
 *  notes}], selected }. An "Initial payment due" free-text, then a repeatable list
 *  of monthly fee options ("$<amount> due on the first day of each month. <notes>").
 *  With ≥2 options a radio appears on each so one can be selected; a selection can
 *  be cleared while still editable (i.e. before signing → `disabled`). Options are
 *  editable/removable and new ones can be added until one is selected. */
function LeaseFeeBuilder({
  f, onSaveStructured, disabled,
}: { f: ContractField; onSaveStructured: SaveStructFn; disabled: boolean }) {
  // LOCAL draft so typing never round-trips to the server per keystroke (which
  // caused the "character replaced/dropped" glitch — a save-then-reload reset the
  // controlled value mid-type). Text edits commit on blur; structural actions
  // (add / remove / select) commit immediately. The draft re-seeds from the server
  // value only when it actually differs AND the user isn't mid-edit.
  const [draft, setDraft] = useState<FieldStructured>(f.structured ?? {});
  const editingRef = useRef(false);
  useEffect(() => {
    if (editingRef.current) return;
    const incoming = JSON.stringify(f.structured ?? {});
    if (incoming !== JSON.stringify(draft)) setDraft(f.structured ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.structured]);

  const options = draft.options ?? [];
  const selected = draft.selected ?? null;
  const locked = disabled;
  const multi = options.length > 1;
  const commit = (next: FieldStructured) => { setDraft(next); void onSaveStructured(f.field_key, next); };

  // local (uncommitted) edits — update draft only; commit happens on blur
  const setLocal = (next: FieldStructured) => setDraft(next);
  const editOptionLocal = (i: number, patch: { amount?: string; notes?: string }) =>
    setLocal({ ...draft, options: options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const flush = () => { editingRef.current = false; void onSaveStructured(f.field_key, draft); };
  const beginEdit = () => { editingRef.current = true; };

  const addOption = () => { if (selected == null) commit({ ...draft, options: [...options, { amount: '', notes: '' }] }); };
  const removeOption = (i: number) => commit({
    ...draft,
    options: options.filter((_, j) => j !== i),
    selected: selected == null ? null : selected === i ? null : selected > i ? selected - 1 : selected,
  });
  const toggleSelect = (i: number) => commit({ ...draft, selected: selected === i ? null : i });

  return (
    <div className="flex flex-col gap-2 w-full max-w-2xl">
      <label className="flex items-baseline gap-2 text-[13.5px] text-green-950">
        <span className="whitespace-nowrap">Initial payment due:</span>
        <input className={`${inputCls} flex-1`} disabled={locked} value={draft.initial_due ?? ''}
          placeholder="e.g. upon signing, or a specific date"
          onFocus={beginEdit} onBlur={flush}
          onChange={(e) => setLocal({ ...draft, initial_due: e.target.value })} />
      </label>

      {options.map((o, i) => (
        <div key={i} className="flex items-stretch gap-2">
          {multi && (
            <input type="radio" className="mt-3 accent-green-700 shrink-0" disabled={locked}
              checked={selected === i} onChange={() => toggleSelect(i)}
              aria-label={`Select fee option ${i + 1}`} />
          )}
          <div className={`flex-1 flex items-center gap-2 rounded-lg border p-2 ${
            selected === i ? 'border-green-700 bg-green-50/50' : 'border-green-800/15'}`}>
            <span className="inline-flex items-center shrink-0">
              <span className="text-green-900 mr-0.5">$</span>
              <input className="w-24 px-2 py-1 rounded border border-green-800/15 text-sm text-green-900 focus-ring bg-white disabled:bg-cream-100"
                disabled={locked || selected === i} value={o.amount ?? ''} placeholder="amount"
                onFocus={beginEdit} onBlur={flush}
                onChange={(e) => editOptionLocal(i, { amount: e.target.value })} />
            </span>
            {/* Notes fills the space between the amount and the card edge. */}
            <input className="flex-1 min-w-0 px-2 py-1 rounded border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white disabled:bg-cream-100"
              disabled={locked || selected === i} value={o.notes ?? ''} placeholder="Notes"
              onFocus={beginEdit} onBlur={flush}
              onChange={(e) => editOptionLocal(i, { notes: e.target.value })} />
          </div>
          {!locked && selected !== i && (
            <button type="button" className="self-center text-muted hover:text-red-700 text-xs shrink-0"
              onClick={() => removeOption(i)} title="Delete this fee option">✕</button>
          )}
        </div>
      ))}

      {!locked && selected == null && (
        <button type="button" onClick={addOption}
          className="self-start text-sm text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">
          ＋ Add fee option
        </button>
      )}
      {multi && selected == null && (
        <p className="text-[11px] text-muted">Select the fee option that applies. It can be changed until the contract is signed.</p>
      )}
    </div>
  );
}

/** A single field's control, chosen by format_type (preferred) or input_kind. */
function FieldControl({
  f, onSave, onSaveResponsibility, onSaveStructured, disabled,
}: { f: ContractField; onSave: SaveFn; onSaveResponsibility: SaveRespFn; onSaveStructured: SaveStructFn; disabled: boolean }) {
  const [local, setLocal] = useState(f.value ?? '');
  const editingRef = useRef(false);
  // Re-sync local input state when the server value changes (after a save + parent
  // reload, or a redline/recompose that normalizes the value) — but NOT while the
  // user is mid-edit, or a background reload would reset the input and drop the
  // characters being typed. Committed on blur.
  useEffect(() => { if (!editingRef.current) setLocal(f.value ?? ''); }, [f.value]);
  const fmt = f.format_type ?? '';
  const kind = f.input_kind ?? 'text';
  const save = () => { editingRef.current = false; if (local !== (f.value ?? '')) void onSave(f.field_key, local); };

  // ── structured formats (source of truth = f.structured) ──
  if (fmt === 'reveal_text') {
    return <RevealText f={f} onSaveStructured={onSaveStructured} disabled={disabled} />;
  }
  if (fmt === 'med_schedule') {
    return <MedicationBuilder f={f} onSaveStructured={onSaveStructured} disabled={disabled} />;
  }
  if (fmt === 'fee_schedule') {
    return <LeaseFeeBuilder f={f} onSaveStructured={onSaveStructured} disabled={disabled} />;
  }
  if (fmt === 'pair') {
    return <PairControl f={f} onSaveStructured={onSaveStructured} disabled={disabled} />;
  }
  if (fmt === 'party') {
    const val = (f.structured ?? {}) as PartyChoice;
    // option set by responsibility_kind: financial = who pays (no FHE);
    // care = who does/oversees (FHE is the default care party).
    const partyOpts = f.responsibility_kind === 'financial' ? FINANCIAL_PARTY_OPTS
      : f.responsibility_kind === 'care' ? CARE_PARTY_OPTS
      : PARTY_OPTS;
    return <PartyPicker value={val} disabled={disabled} opts={partyOpts}
      placeholder={f.guidance ?? 'Select the responsible party'}
      onChange={(v) => void onSaveStructured(f.field_key, v as FieldStructured)} />;
  }
  if (fmt === 'contact') {
    // A full reusable contact block: name · business · address · phone · email · website.
    // Used for trainer / instructor / farrier / vet / care provider (ELS §11-13).
    const s = f.structured ?? {};
    const set = (patch: Partial<FieldStructured>) => void onSaveStructured(f.field_key, { ...s, ...patch });
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <input className={inputCls} disabled={disabled} placeholder="Name" value={s.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
        <input className={inputCls} disabled={disabled} placeholder="Business" value={s.company ?? ''} onChange={(e) => set({ company: e.target.value })} />
        <input className={`${inputCls} col-span-2`} disabled={disabled} placeholder="Street address" value={s.line1 ?? ''} onChange={(e) => set({ line1: e.target.value })} />
        <input className={inputCls} disabled={disabled} placeholder="City" value={s.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
        <div className="grid grid-cols-2 gap-1.5">
          <input className={inputCls} disabled={disabled} placeholder="State" value={s.state ?? ''} onChange={(e) => set({ state: e.target.value })} />
          <input className={inputCls} disabled={disabled} placeholder="ZIP" value={s.postal ?? ''} onChange={(e) => set({ postal: e.target.value })} />
        </div>
        <input type="tel" className={inputCls} disabled={disabled} placeholder="Phone" value={s.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
        <input type="email" className={inputCls} disabled={disabled} placeholder="Email" value={s.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
        <input className={`${inputCls} col-span-2`} disabled={disabled} placeholder="Website (optional)" value={s.website ?? ''} onChange={(e) => set({ website: e.target.value })} />
      </div>
    );
  }
  if (fmt === 'yesno') {
    const cur = f.value ?? '';
    return (
      <div className="flex gap-1.5">
        {[['YES', 'Yes'], ['NO', 'No']].map(([v, label]) => (
          <button key={v} type="button" disabled={disabled} onClick={() => void onSave(f.field_key, v)}
            className={`text-sm rounded-lg px-4 py-1.5 border focus-ring ${
              cur === v ? 'bg-green-800 text-white border-green-800' : 'border-green-800/15 text-secondary hover:bg-green-50'}`}>
            {label}
          </button>
        ))}
      </div>
    );
  }
  if (fmt === 'certify') {
    // A single must-check certification. Stores YES when checked, NO/'' otherwise;
    // the label is the certification statement itself.
    const checked = (f.value ?? '').toUpperCase() === 'YES';
    return (
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input type="checkbox" className="accent-green-700 w-4 h-4 mt-0.5 shrink-0" disabled={disabled}
          checked={checked} onChange={(e) => void onSave(f.field_key, e.target.checked ? 'YES' : 'NO')} />
        <span className="text-[13px] text-green-900 leading-relaxed">{f.label}</span>
      </label>
    );
  }
  if (fmt === 'person') {
    const s = f.structured ?? {};
    const set = (patch: Partial<FieldStructured>) => void onSaveStructured(f.field_key, { ...s, ...patch });
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <input className={inputCls} disabled={disabled} placeholder="Contact name" value={s.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
        <input className={inputCls} disabled={disabled} placeholder="Company" value={s.company ?? ''} onChange={(e) => set({ company: e.target.value })} />
        <input type="tel" className={inputCls} disabled={disabled} placeholder="Phone" value={s.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
        <input type="email" className={inputCls} disabled={disabled} placeholder="Email" value={s.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
      </div>
    );
  }
  if (fmt === 'address') {
    const s = f.structured ?? {};
    const set = (patch: Partial<FieldStructured>) => void onSaveStructured(f.field_key, { ...s, ...patch });
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <input className={`${inputCls} col-span-2`} disabled={disabled} placeholder="Street address" value={s.line1 ?? ''} onChange={(e) => set({ line1: e.target.value })} />
        <input className={inputCls} disabled={disabled} placeholder="City" value={s.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
        <div className="grid grid-cols-2 gap-1.5">
          <input className={inputCls} disabled={disabled} placeholder="State" value={s.state ?? ''} onChange={(e) => set({ state: e.target.value })} />
          <input className={inputCls} disabled={disabled} placeholder="ZIP" value={s.postal ?? ''} onChange={(e) => set({ postal: e.target.value })} />
        </div>
      </div>
    );
  }
  if (fmt === 'location') {
    // A location is a named place + its address — e.g. a boarding facility.
    // Structured so it reads back as "Name — Street, City, ST ZIP".
    const s = f.structured ?? {};
    const set = (patch: Partial<FieldStructured>) => void onSaveStructured(f.field_key, { ...s, ...patch });
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <input className={`${inputCls} col-span-2`} disabled={disabled} placeholder="Facility / place name (e.g. Willow Creek Stables)" value={s.name ?? ''} onChange={(e) => set({ name: e.target.value })} />
        <input className={`${inputCls} col-span-2`} disabled={disabled} placeholder="Street address" value={s.line1 ?? ''} onChange={(e) => set({ line1: e.target.value })} />
        <input className={inputCls} disabled={disabled} placeholder="City" value={s.city ?? ''} onChange={(e) => set({ city: e.target.value })} />
        <div className="grid grid-cols-2 gap-1.5">
          <input className={inputCls} disabled={disabled} placeholder="State" value={s.state ?? ''} onChange={(e) => set({ state: e.target.value })} />
          <input className={inputCls} disabled={disabled} placeholder="ZIP" value={s.postal ?? ''} onChange={(e) => set({ postal: e.target.value })} />
        </div>
      </div>
    );
  }

  // ── legacy responsibility (kept for any field still on input_kind) ──
  if (kind === 'responsibility') {
    return <ResponsibilityControl f={f} onSaveResponsibility={onSaveResponsibility} disabled={disabled} />;
  }
  if (kind === 'week_grid') {
    return <WeekGrid f={f} onSave={onSave} disabled={disabled} />;
  }
  if (kind === 'select') {
    return <SelectWithOther f={f} onSave={onSave} disabled={disabled} />;
  }
  if (kind === 'buttons') {
    const selected = (f.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const toggle = (val: string) => {
      const next = selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val];
      void onSave(f.field_key, next.join(','));
    };
    return (
      <div className="flex flex-wrap gap-1.5">
        {(f.options ?? []).map((o) => (
          <button key={o.value} type="button" disabled={disabled} onClick={() => toggle(o.value)}
            className={`text-xs rounded-lg px-3 py-1.5 border focus-ring ${
              selected.includes(o.value) ? 'bg-green-800 text-white border-green-800' : 'border-green-800/15 text-secondary hover:bg-green-50'}`}>
            {o.label}
          </button>
        ))}
      </div>
    );
  }
  if (kind === 'longtext' || kind === 'contact') {
    return <textarea rows={kind === 'contact' ? 3 : 2} className={`${inputCls} resize-y`} disabled={disabled}
      value={local} onFocus={() => { editingRef.current = true; }} onChange={(e) => setLocal(e.target.value)} onBlur={save}
      placeholder={f.guidance ?? undefined} />;
  }
  const type = kind === 'date' ? 'date' : kind === 'currency' || kind === 'percent' ? 'text' : 'text';
  return <input type={type} className={inputCls} disabled={disabled}
    value={local} onFocus={() => { editingRef.current = true; }} onChange={(e) => setLocal(e.target.value)} onBlur={save}
    placeholder={kind === 'currency' ? '$' : kind === 'percent' ? '%' : undefined} />;
}

// ───────────────────────────── INLINE CONTROLS ──────────────────────────────
// Rendering for the "document is the form" authoring view: controls sit ON the
// text baseline inside the clause sentence, the field LABEL is the input's
// placeholder (never a stacked label above/below), inputs auto-size to their
// content, and multi-selects render as inline chips. Guidance stays behind the ⓘ
// dot. This keeps the document reading like prose while every blank is fillable.

const inlineBase =
  'inline text-[13.5px] text-green-900 bg-gold-50/70 border-b border-gold-400/70 ' +
  'focus:outline-none focus:border-gold-600 focus:bg-gold-50 rounded-sm px-1 align-baseline ' +
  'placeholder:text-gold-700/70 placeholder:italic disabled:bg-transparent disabled:border-dotted disabled:text-green-900';

/** An inline text/date/currency input that grows with its content. A hidden
 *  sizing span mirrors the text (or the placeholder) so the input is exactly as
 *  wide as it needs to be — no fixed-width boxes floating over the prose. */
function InlineInput({
  value, placeholder, type = 'text', disabled, onCommit, prefix,
}: {
  value: string; placeholder: string; type?: 'text' | 'date';
  disabled: boolean; onCommit: (v: string) => void; prefix?: string;
}) {
  const [local, setLocal] = useState(value);
  const editingRef = useRef(false);
  // Re-seed from the server value ONLY when not mid-edit — otherwise a background
  // reload (triggered by any other field's save) could reset the input while the
  // user is typing, dropping characters.
  useEffect(() => { if (!editingRef.current) setLocal(value); }, [value]);
  const commit = () => { editingRef.current = false; if (local !== value) onCommit(local); };
  // width driver: the longer of the value or placeholder, plus the prefix
  const sizer = (prefix ?? '') + (local || placeholder);
  return (
    <span className="inline-flex items-baseline align-baseline relative">
      {prefix && local && <span className="text-green-900">{prefix}</span>}
      <span className="inline-grid">
        {/* invisible sizer sets the column width; the input overlays it */}
        <span className="col-start-1 row-start-1 invisible whitespace-pre px-1 text-[13.5px]" aria-hidden="true">
          {sizer || placeholder}
        </span>
        <input
          type={type}
          className={`${inlineBase} col-start-1 row-start-1 w-full min-w-[3ch]`}
          disabled={disabled}
          value={local}
          placeholder={placeholder}
          onFocus={() => { editingRef.current = true; }}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter' && type !== 'date') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
        />
      </span>
    </span>
  );
}

/** An inline longtext control — auto-growing textarea that reads as inline text. */
function InlineTextarea({
  value, placeholder, disabled, onCommit,
}: { value: string; placeholder: string; disabled: boolean; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  const editingRef = useRef(false);
  useEffect(() => { if (!editingRef.current) setLocal(value); }, [value]);
  return (
    <span className="inline-grid align-baseline w-full max-w-full">
      <span className="col-start-1 row-start-1 invisible whitespace-pre-wrap break-words px-1 text-[13.5px] leading-[1.9]" aria-hidden="true">
        {(local || placeholder) + ' '}
      </span>
      <textarea
        className={`${inlineBase} col-start-1 row-start-1 w-full resize-none overflow-hidden leading-[1.9]`}
        rows={1}
        disabled={disabled}
        value={local}
        placeholder={placeholder}
        onFocus={() => { editingRef.current = true; }}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => { editingRef.current = false; if (local !== value) onCommit(local); }}
      />
    </span>
  );
}

/** True when an option is the field's own "Other" escape (value OTHER, or a label
 *  beginning with "Other"). When a field already defines one, we must NOT append
 *  a second synthetic one — that was the "Other" + "Other (specify)…" duplication. */
const isOtherOpt = (o: { value: string; label: string }) =>
  o.value === 'OTHER' || /^other\b/i.test(o.label);

/** Inline select: shows the chosen option's label as text; the label is the
 *  placeholder while empty. An "Other" choice (the field's own, or a synthetic
 *  one when the field defines none) reveals an inline text input for free text. */
function InlineSelect({ f, disabled, onSave }: { f: ContractField; disabled: boolean; onSave: SaveFn }) {
  const opts = f.options ?? [];
  const ownOther = opts.find(isOtherOpt);            // the field's own Other option, if any
  const otherVal = ownOther?.value ?? OTHER_VALUE;   // the value that means "specify free text"
  const stored = f.value ?? '';
  // a stored value that matches no listed option is a saved custom entry
  const storedIsCustom = stored !== '' && !opts.some((o) => o.value === stored);
  const [otherMode, setOtherMode] = useState(storedIsCustom);
  useEffect(() => {
    if (stored !== '' && !opts.some((o) => o.value === stored)) setOtherMode(true);
  }, [stored]); // eslint-disable-line react-hooks/exhaustive-deps
  const placeholder = SELECT_PLACEHOLDER;   // "MAKE A SELECTION" in the empty state
  const selectValue = otherMode || stored === otherVal ? otherVal : stored;
  const shownLabel = otherMode
    ? (ownOther?.label ?? 'Other…')
    : (opts.find((o) => o.value === stored)?.label ?? placeholder);
  return (
    <span className="inline-flex items-baseline gap-1 align-baseline">
      <span className="inline-grid">
        <span className="col-start-1 row-start-1 invisible whitespace-pre px-5 text-[13.5px]" aria-hidden="true">
          {shownLabel}
        </span>
        <select
          className={`${inlineBase} col-start-1 row-start-1 w-full cursor-pointer pr-4 ${stored || otherMode ? '' : 'text-gold-700/80 italic'}`}
          disabled={disabled}
          value={selectValue}
          onChange={(e) => {
            if (e.target.value === otherVal) { setOtherMode(true); void onSave(f.field_key, ''); }
            else { setOtherMode(false); void onSave(f.field_key, e.target.value); }
          }}>
          <option value="">{placeholder}</option>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          {/* only add a synthetic Other when the field doesn't define its own */}
          {!ownOther && <option value={OTHER_VALUE}>Other (specify)…</option>}
        </select>
      </span>
      {otherMode && (
        <InlineInput value={storedIsCustom ? stored : ''} placeholder="specify…" disabled={disabled}
          onCommit={(v) => void onSave(f.field_key, v.trim())} />
      )}
    </span>
  );
}

/** Inline yes/no — a small pair of pills sitting on the baseline. */
function InlineYesNo({ f, disabled, onSave }: { f: ContractField; disabled: boolean; onSave: SaveFn }) {
  const cur = f.value ?? '';
  return (
    <span className="inline-flex items-baseline gap-1 align-baseline mx-0.5">
      {[['YES', 'Yes'], ['NO', 'No']].map(([v, label]) => (
        <button key={v} type="button" disabled={disabled} onClick={() => void onSave(f.field_key, v)}
          className={`text-[12px] rounded-full px-2.5 py-0.5 border align-baseline focus-ring ${
            cur === v ? 'bg-green-800 text-white border-green-800' : 'border-green-800/25 text-secondary hover:bg-green-50'} ${disabled ? 'opacity-70' : ''}`}>
          {label}
        </button>
      ))}
    </span>
  );
}

/** Inline multi-select chips (buttons kind not in a dropdown) — rendered inline. */
function InlineChips({ f, disabled, onSave }: { f: ContractField; disabled: boolean; onSave: SaveFn }) {
  const selected = (f.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const toggle = (val: string) => {
    const next = selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val];
    void onSave(f.field_key, next.join(','));
  };
  return (
    <span className="inline-flex flex-wrap items-baseline gap-1 align-baseline mx-0.5">
      {(f.options ?? []).map((o) => (
        <button key={o.value} type="button" disabled={disabled} onClick={() => toggle(o.value)}
          className={`text-[12px] rounded-full px-2.5 py-0.5 border align-baseline focus-ring ${
            selected.includes(o.value) ? 'bg-green-800 text-white border-green-800' : 'border-green-800/25 text-secondary hover:bg-green-50'} ${disabled ? 'opacity-70' : ''}`}>
          {o.label}
        </button>
      ))}
    </span>
  );
}

/** Read the current display value of a field (for the inline value renderer). */
function fieldDisplayValue(f: ContractField): string {
  if (f.options && f.value) {
    const opt = f.options.find((o) => o.value === f.value);
    if (opt) return opt.label;
  }
  return f.value ?? '';
}

/** A single field's control, for rendering INLINE within clause prose (the
 *  "document is the form" authoring view). The label is the placeholder, the
 *  value sits on the text baseline, guidance hides behind ⓘ. Structured formats
 *  (party / contact / pair / location) fall back to the block FieldControl inside
 *  a compact inline-block wrapper, since they can't collapse to a single word. */
export function InlineFieldControl({
  f, editable, onSave, onSaveResponsibility, onSaveStructured, onSuggestEdit, canSuggest = false,
}: {
  f: ContractField;
  editable: boolean;
  onSave: SaveFn;
  onSaveResponsibility: SaveRespFn;
  onSaveStructured: SaveStructFn;
  /** Accepted for call-site compatibility; the inline comment bubble was removed. */
  onCommentField?: (f: ContractField) => void;
  onSuggestEdit?: (f: ContractField) => void;
  canSuggest?: boolean;
}) {
  const disabled = !editable || !f.can_edit;
  const fmt = f.format_type ?? '';
  const kind = f.input_kind ?? 'text';
  const label = f.label ?? f.field_key;

  // affordances — a required mark, the ⓘ guidance popover, and a suggest-edit
  // affordance for parties who can't directly edit. The per-field comment bubble
  // was removed (it cluttered the prose and its scroll-on-click was disruptive).
  const marks = (
    <>
      {f.required && <span className="text-red-700 align-super text-[9px]">*</span>}
      {f.guidance && <InfoDot text={f.guidance} />}
      {onSuggestEdit && !f.can_edit && canSuggest && (
        <button type="button" className="text-gold-700 hover:text-gold-900 underline align-super text-[10px]"
          title="Suggest a change" onClick={() => onSuggestEdit(f)}>✎</button>
      )}
    </>
  );

  // Structured / multi-part formats can't collapse to a single inline token —
  // render the block control, but inline-block and compact so it stays in flow.
  const isStructured = ['party', 'contact', 'person', 'address', 'location', 'pair', 'fee_schedule', 'med_schedule', 'reveal_text', 'certify'].includes(fmt)
    || kind === 'responsibility' || kind === 'week_grid';
  if (isStructured) {
    // reveal_text and certify self-label (the control shows its own question /
    // certification statement), so render inline with no extra label above.
    if (fmt === 'reveal_text' || fmt === 'certify') {
      return (
        <span className="block my-1">
          <FieldControl f={f} onSave={onSave} onSaveResponsibility={onSaveResponsibility}
            onSaveStructured={onSaveStructured} disabled={disabled} />{marks}
        </span>
      );
    }
    return (
      <span className="inline-block align-top mx-0.5 my-0.5 min-w-[14rem] max-w-full">
        <span className="text-[11px] text-muted">{label}{marks}</span>
        <FieldControl f={f} onSave={onSave} onSaveResponsibility={onSaveResponsibility}
          onSaveStructured={onSaveStructured} disabled={disabled} />
      </span>
    );
  }

  let control: ReactNode;
  if (fmt === 'yesno') control = <InlineYesNo f={f} disabled={disabled} onSave={onSave} />;
  else if (kind === 'buttons') control = <InlineChips f={f} disabled={disabled} onSave={onSave} />;
  else if (kind === 'select') control = <InlineSelect f={f} disabled={disabled} onSave={onSave} />;
  else if (kind === 'longtext') {
    control = <InlineTextarea value={f.value ?? ''} placeholder={label} disabled={disabled}
      onCommit={(v) => void onSave(f.field_key, v)} />;
  } else {
    const type = kind === 'date' ? 'date' : 'text';
    const prefix = kind === 'currency' ? '$' : undefined;
    control = <InlineInput value={fieldDisplayValue(f)} placeholder={label} type={type}
      disabled={disabled} prefix={prefix} onCommit={(v) => void onSave(f.field_key, v)} />;
  }

  return <span className="align-baseline">{control}{marks}</span>;
}

const COST_OPTS = [
  { value: 'LESSOR', label: 'Lessor' }, { value: 'LESSEE', label: 'Lessee' },
  { value: 'SHARED', label: 'Shared (split %)' },
];
const DUTY_OPTS = [
  { value: 'LESSOR', label: 'Lessor' }, { value: 'LESSEE', label: 'Lessee' },
  { value: 'CARE_PROVIDER', label: 'Care Provider' }, { value: 'SHARED', label: 'Shared' },
];

/** Owner / Lessee / Care Provider / Shared, with a %-split when Shared+cost.
 *  Falls back to sensible default options: cost fields → Owner/Lessee/Shared(split),
 *  other responsibility fields → the full four. */
function ResponsibilityControl({
  f, onSaveResponsibility, disabled,
}: { f: ContractField; onSaveResponsibility: SaveRespFn; disabled: boolean }) {
  const resp = f.responsibility ?? {};
  const party = resp.party ?? '';
  const isCost = f.field_key.endsWith('_COST') || /\.COST$/.test(f.field_key) || /cost/i.test(f.label ?? '');
  const opts = (f.options && f.options.length) ? f.options : (isCost ? COST_OPTS : DUTY_OPTS);
  const set = (patch: Partial<NonNullable<ContractField['responsibility']>>) =>
    void onSaveResponsibility(f.field_key, { ...resp, ...patch });
  const sharedIsSplit = opts.some((o) => o.value === 'SHARED' && /split/i.test(o.label));
  return (
    <div className="flex flex-col gap-2">
      <select className={inputCls} disabled={disabled} value={party}
        onChange={(e) => set({ party: e.target.value })}>
        <option value="">{SELECT_PLACEHOLDER}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {party === 'SHARED' && sharedIsSplit && (
        <div className="flex items-center gap-2 text-sm text-secondary">
          Lessor <input type="number" min={0} max={100} className={`${inputCls} w-20`} disabled={disabled}
            value={resp.split?.owner ?? 50}
            onChange={(e) => { const o = Number(e.target.value); set({ split: { owner: o, lessee: 100 - o } }); }} />%
          · Lessee {(resp.split?.lessee ?? 50)}%
        </div>
      )}
      {party === 'SHARED' && !sharedIsSplit && (
        <textarea rows={2} className={`${inputCls} resize-y`} disabled={disabled}
          placeholder="List of responsible parties by name, days/dates, time(s), etc."
          value={resp.detail ?? ''} onChange={(e) => set({ detail: e.target.value })} />
      )}
      {party === 'CARE_PROVIDER' && (
        <textarea rows={2} className={`${inputCls} resize-y`} disabled={disabled}
          placeholder="Contact name, phone, email, company name."
          value={resp.detail ?? ''} onChange={(e) => set({ detail: e.target.value })} />
      )}
    </div>
  );
}

/** Weekly schedule grid: one row per party, a checkbox per day, and an optional
 *  timeframes toggle that splits each day into presets (default 6a–12p / 12p–6p,
 *  editable). Value serializes to JSON so it's structured for downstream use. The
 *  context label ("responsible" / "entitled" / "authorized") comes from the field. */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
type WeekState = {
  parties: string[];
  days: Record<string, string[]>;           // party -> ['Mon','Wed',...]
  timeframes?: boolean;
  windows?: { start: string; end: string }[];  // default two 6h windows
};
function parseWeek(v?: string | null): WeekState {
  if (v) { try { const p = JSON.parse(v); if (p && p.days) return p; } catch { /* fall through */ } }
  return { parties: ['Lessee', 'Lessor'], days: { Lessee: [], Lessor: [] },
    timeframes: false, windows: [{ start: '06:00', end: '12:00' }, { start: '12:00', end: '18:00' }] };
}
function WeekGrid({ f, onSave, disabled }: { f: ContractField; onSave: SaveFn; disabled: boolean }) {
  const [w, setW] = useState<WeekState>(() => parseWeek(f.value));
  const commit = (next: WeekState) => { setW(next); void onSave(f.field_key, JSON.stringify(next)); };
  const toggleDay = (party: string, day: string) => {
    if (disabled) return;
    const cur = w.days[party] ?? [];
    const nextDays = cur.includes(day) ? cur.filter((d) => d !== day) : [...cur, day];
    commit({ ...w, days: { ...w.days, [party]: nextDays } });
  };
  // rename a party row (keeps its day selections)
  const renameParty = (i: number, name: string) => {
    const old = w.parties[i];
    const nextParties = w.parties.map((p, j) => (j === i ? name : p));
    const nextDays = { ...w.days };
    if (name !== old) { nextDays[name] = nextDays[old] ?? []; delete nextDays[old]; }
    commit({ ...w, parties: nextParties, days: nextDays });
  };
  const addParty = () => {
    let n = 1; let name = `Party ${w.parties.length + 1}`;
    while (w.parties.includes(name)) { n += 1; name = `Party ${w.parties.length + n}`; }
    commit({ ...w, parties: [...w.parties, name], days: { ...w.days, [name]: [] } });
  };
  const removeParty = (i: number) => {
    const name = w.parties[i];
    const nextDays = { ...w.days }; delete nextDays[name];
    commit({ ...w, parties: w.parties.filter((_, j) => j !== i), days: nextDays });
  };
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-muted font-semibold">Party</th>
            {DAYS.map((d) => <th key={d} className="px-2 py-1 text-green-800 font-semibold text-center">{d}</th>)}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {w.parties.map((p, i) => (
            <tr key={i}>
              <td className="px-2 py-1">
                <input className="w-28 px-1.5 py-0.5 rounded border border-green-800/15 text-xs font-medium text-green-900 bg-white disabled:bg-cream-100"
                  disabled={disabled} value={p} aria-label={`Party ${i + 1} name`}
                  onChange={(e) => renameParty(i, e.target.value)} />
              </td>
              {DAYS.map((d) => (
                <td key={d} className="px-2 py-1 text-center">
                  <input type="checkbox" className="accent-green-700" disabled={disabled}
                    checked={(w.days[p] ?? []).includes(d)} onChange={() => toggleDay(p, d)} />
                </td>
              ))}
              <td className="px-1">
                {!disabled && w.parties.length > 1 && (
                  <button type="button" className="text-muted hover:text-red-700 text-xs"
                    onClick={() => removeParty(i)} title="Remove this party">✕</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!disabled && (
        <button type="button" onClick={addParty}
          className="mt-1.5 text-[11px] text-gold-800 border border-dashed border-gold-400 rounded px-2 py-1 hover:bg-gold-50 focus-ring">
          ＋ Add party
        </button>
      )}
      <label className="flex items-center gap-1.5 text-[11px] text-muted mt-2 cursor-pointer select-none">
        <input type="checkbox" disabled={disabled} checked={w.timeframes ?? false}
          onChange={(e) => commit({ ...w, timeframes: e.target.checked })} /> Add timeframes
      </label>
      {w.timeframes && (
        <div className="flex flex-wrap gap-2 mt-1.5">
          {(w.windows ?? []).map((win, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[11px] text-secondary">
              <input type="time" className="border border-green-800/15 rounded px-1 py-0.5" disabled={disabled}
                value={win.start} onChange={(e) => { const ws = [...(w.windows ?? [])]; ws[i] = { ...ws[i], start: e.target.value }; commit({ ...w, windows: ws }); }} />
              –
              <input type="time" className="border border-green-800/15 rounded px-1 py-0.5" disabled={disabled}
                value={win.end} onChange={(e) => { const ws = [...(w.windows ?? [])]; ws[i] = { ...ws[i], end: e.target.value }; commit({ ...w, windows: ws }); }} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Is `f` currently revealed, given its conditional_on gate against sibling values?
 *  Uses the shared clauseConditionMet evaluator (equals + contains) so field-level
 *  and clause-level gating behave identically. */
function conditionMet(f: ContractField, byKey: Map<string, ContractField>): boolean {
  const c = f.conditional_on;
  if (!c) return true;
  const ctrl = byKey.get(c.field_key);
  const v = ctrl?.responsibility?.party ?? ctrl?.value ?? '';
  return clauseConditionMet(c, { [c.field_key]: v });
}

/** One field + its cascading children. */
function FieldNode({
  f, childrenByParent, byKey, onSave, onSaveResponsibility, onSaveStructured, onInclude, onNa, onControl, canSetControl, editable,
  onSuggestEdit, onCommentField, canSuggest,
}: {
  f: ContractField;
  childrenByParent: Map<string, ContractField[]>;
  byKey: Map<string, ContractField>;
  onSave: SaveFn; onSaveResponsibility: SaveRespFn; onSaveStructured: SaveStructFn; onInclude: IncludeFn; onNa: NaFn; onControl: ControlFn;
  canSetControl: boolean;
  editable: boolean;
  onSuggestEdit?: SuggestFn; onCommentField?: CommentFn; canSuggest?: boolean;
}) {
  // A pair COST child is rendered inside its manage field's mini-block, never as its
  // own row — hide it here.
  if (f.pair_manage_key) return null;
  const kids = childrenByParent.get(f.field_key) ?? [];
  const included = f.is_optional ? (f.included ?? false) : true;
  const hasContent = filled(f.value) || !!f.responsibility?.party || !!f.structured?.manage?.party || !!f.structured?.party;
  // children surface when the parent has content (or is a non-optional container)
  const showKids = included && (hasContent || !f.is_optional);
  const na = f.is_na === true;
  const ov = f.control_override ?? {};
  const toggleControl = (key: 'lock' | 'edit' | 'suggest') => {
    // lock is exclusive with edit/suggest; edit+suggest may coexist
    const next = key === 'lock'
      ? { lock: !ov.lock, edit: false, suggest: false }
      : { ...ov, lock: false, [key]: !ov[key] };
    void onControl(f.field_key, next);
  };

  if (f.is_optional && !included) {
    return (
      <button type="button" disabled={!editable} onClick={() => void onInclude(f.field_key, true)}
        className="text-sm text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-2 hover:bg-gold-50 focus-ring inline-flex items-center gap-1.5">
        ＋ Include: {f.label ?? f.field_key}
      </button>
    );
  }

  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[13.5px] font-medium text-green-900">{f.label ?? f.field_key}</span>
        {f.required && <span className="text-red-700 text-xs">*</span>}
        {f.guidance && <InfoDot text={f.guidance} />}
        {editable && (
          <label className="ml-auto flex items-center gap-1 text-[10px] text-muted cursor-pointer select-none">
            <input type="checkbox" checked={na} onChange={(e) => void onNa(f.field_key, e.target.checked)} /> N/A
          </label>
        )}
        {f.is_optional && included && editable && (
          <button type="button" className="text-[10px] text-muted underline"
            onClick={() => void onInclude(f.field_key, false)}>remove</button>
        )}
        {/* Always-on comment affordance; suggest-a-change appears when the field
            isn't directly editable by the caller but suggestions are allowed. */}
        {onCommentField && (
          <button type="button" className={`text-[10px] text-muted hover:text-green-800 ${f.is_optional && included && editable ? '' : 'ml-auto'}`}
            onClick={() => onCommentField(f)} title="Comment on this field">💬</button>
        )}
        {onSuggestEdit && !f.can_edit && canSuggest && (
          <button type="button" className="text-[10px] text-gold-700 hover:text-gold-900 underline"
            onClick={() => onSuggestEdit(f)} title="Suggest a change to this field">suggest</button>
        )}
      </div>
      {!na && <FieldControl f={f} onSave={onSave} onSaveResponsibility={onSaveResponsibility} onSaveStructured={onSaveStructured} disabled={!editable || !f.can_edit} />}
      {na && <p className="text-xs text-muted italic">Marked not applicable.</p>}
      {/* per-field control override (author only, on a filled field): overrides the
          document-global control. lock is exclusive; edits + suggestions may coexist. */}
      {canSetControl && !na && hasContent && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          <span className="text-[10px] uppercase tracking-wide text-muted">This field:</span>
          {(['lock', 'edit', 'suggest'] as const).map((k) => (
            <button key={k} type="button" onClick={() => toggleControl(k)}
              className={`text-[10px] rounded px-2 py-0.5 border focus-ring ${
                ov[k] ? 'bg-green-800 text-white border-green-800' : 'border-green-800/15 text-muted hover:bg-green-50'}`}>
              {k === 'lock' ? 'Lock' : k === 'edit' ? 'Allow edits' : 'Allow suggestions'}
            </button>
          ))}
        </div>
      )}
      {showKids && kids.length > 0 && (
        <div className="mt-2 ml-3 pl-3 border-l-2 border-gold-200 flex flex-col gap-1">
          {kids.filter((k) => conditionMet(k, byKey)).map((k) => (
            <FieldNode key={k.field_key} f={k} childrenByParent={childrenByParent} byKey={byKey}
              onSave={onSave} onSaveResponsibility={onSaveResponsibility} onSaveStructured={onSaveStructured} onInclude={onInclude} onNa={onNa}
              onControl={onControl} canSetControl={canSetControl} editable={editable}
              onSuggestEdit={onSuggestEdit} onCommentField={onCommentField} canSuggest={canSuggest} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders one subject-section's cascading fields. */
export function ContractCascade({
  fields, onSave, onSaveResponsibility, onSaveStructured, onInclude, onNa, onControl, canSetControl = false, editable,
  onSuggestEdit, onCommentField, canSuggest = false,
}: {
  fields: ContractField[];
  onSave: SaveFn;
  onSaveResponsibility: SaveRespFn;
  onSaveStructured: SaveStructFn;
  onInclude: IncludeFn;
  onNa: NaFn;
  onControl: ControlFn;
  canSetControl?: boolean;
  editable: boolean;
  onSuggestEdit?: SuggestFn;
  onCommentField?: CommentFn;
  canSuggest?: boolean;
}) {
  const { roots, childrenByParent, byKey } = useMemo(() => {
    const byKey = new Map(fields.map((f) => [f.field_key, f]));
    const childrenByParent = new Map<string, ContractField[]>();
    const roots: ContractField[] = [];
    for (const f of [...fields].sort((a, b) => a.sort_order - b.sort_order)) {
      if (f.parent_field_key) {
        (childrenByParent.get(f.parent_field_key) ?? childrenByParent.set(f.parent_field_key, []).get(f.parent_field_key)!).push(f);
      } else roots.push(f);
    }
    return { roots, childrenByParent, byKey };
  }, [fields]);

  return (
    <div className="flex flex-col gap-2">
      {roots.filter((f) => conditionMet(f, byKey)).map((f) => (
        <FieldNode key={f.field_key} f={f} childrenByParent={childrenByParent} byKey={byKey}
          onSave={onSave} onSaveResponsibility={onSaveResponsibility} onSaveStructured={onSaveStructured} onInclude={onInclude} onNa={onNa}
          onControl={onControl} canSetControl={canSetControl} editable={editable}
          onSuggestEdit={onSuggestEdit} onCommentField={onCommentField} canSuggest={canSuggest} />
      ))}
    </div>
  );
}
