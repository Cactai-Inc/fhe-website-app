import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Info, MessageSquarePlus } from 'lucide-react';
import { clauseConditionMet, type ContractField, type FieldStructured, type PartyChoice } from '../../lib/contracts';
import { fieldSourceTip } from '../../lib/fieldSources';
import { listHorseMedications, type HorseMedication } from '../../lib/horses';
import { ExplainTip } from './ExplainTip';
import { resolveUnsignedSignatureTokens } from '../../lib/documentBody';

/**
 * THE HORSE THIS DOCUMENT IS ABOUT — TASK-PAMELA §B rule 6.
 *
 * Owner, 2026-08-23: *"they should still be at least accessible as options to
 * select from the horse record before resorting to hand writing things in."*
 * The medication builder is the one control in this file that needs a fact from
 * OUTSIDE the field it renders, and threading a horse id through
 * ClauseDocument → InlineFieldControl → FieldControl → MedicationBuilder would put
 * an optional prop on four signatures that have nothing else to do with horses.
 * Context instead: `ContractPage` provides it once, one consumer reads it, and a
 * document with no horse simply reads null and the picker does not render.
 */
const ContractHorseContext = createContext<string | null>(null);
export function ContractHorseProvider(
  { horseId, children }: { horseId: string | null; children: ReactNode },
) {
  return <ContractHorseContext.Provider value={horseId}>{children}</ContractHorseContext.Provider>;
}

/* ── U5 / F1-F2: insurance responsibility elections ────────────────────────────
 * Each insurance section (GL / MORT / MED) resolves to exactly one end-state
 * before signing. When BOTH parties declare NONE and neither has accepted
 * responsibility, the section is UNRESOLVED: signing is blocked server-side
 * (contract_lock_blockers) until one party checks their own box.
 *
 * Only the party inheriting responsibility may elect. The other box stays
 * VISIBLE but disabled and labeled with whose it is — per spec, never hidden.
 * Editability itself is authoritative from the server (`can_edit`, which
 * mirrors set_contract_field's carve-out); this map only supplies the copy. */
const INSURANCE_ELECTIONS: Record<string, { side: 'Lessor' | 'Lessee'; section: string }> = {
  'TXN.GL_NOT_REQUIRED': { side: 'Lessor', section: 'GL' },
  'TXN.GL_LESSEE_RESPONSIBLE': { side: 'Lessee', section: 'GL' },
  'TXN.MORT_NOT_REQUIRED': { side: 'Lessor', section: 'MORT' },
  'TXN.MORT_LESSEE_RESPONSIBLE': { side: 'Lessee', section: 'MORT' },
  'TXN.MED_NOT_REQUIRED': { side: 'Lessor', section: 'MED' },
  'TXN.MED_LESSEE_RESPONSIBLE': { side: 'Lessee', section: 'MED' },
};

/** Spec F2 — tooltip copy, verbatim. Also the notification body (D5). */
const INSURANCE_TOOLTIP =
  'Neither party currently has this coverage. The contract cannot be signed '
  + 'until one party accepts financial responsibility for it. Only the accepting '
  + 'party can check their box: the Lessor checks the first, the Lessee checks '
  + 'the second. Checking a box is that party’s election and appears in the contract.';

/** True when this election's section is in the UNRESOLVED state: both statuses
 *  NONE and neither certify accepted. Mirrors the server's blocker predicate. */
function insuranceUnresolved(fieldKey: string, byKey: Map<string, ContractField>): boolean {
  const e = INSURANCE_ELECTIONS[fieldKey];
  if (!e) return false;
  const v = (k: string) => (byKey.get(`TXN.${e.section}_${k}`)?.value ?? '').trim().toUpperCase();
  return v('LESSOR_STATUS') === 'NONE'
    && v('LESSEE_STATUS') === 'NONE'
    && v('NOT_REQUIRED') !== 'YES'
    && v('LESSEE_RESPONSIBLE') !== 'YES';
}

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
/** Open a comment anchored to a specific field. */

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
  // placeholder is part of the API (callers pass it) but this variant renders a
  // labelled select, so it isn't shown — accept and ignore it.
  value, placeholder: _placeholder, opts, onChange, disabled, allowProvider = true,
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

/** ⓘ info popover — click/tap to toggle. The wrapper carries the GLOBAL spacing
 *  (mx-1.5 ≈ the §Allowing-Others-to-Ride reference gap) so an info dot never
 *  touches its neighbours anywhere in the cascade — fixed here at the shared
 *  component, not per call site. */
export function InfoDot({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-block mx-1.5 align-middle">
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
 *  anchored to it.
 *
 *  ⚠️ IT IS NOT THE ONLY BODY RENDERER. `BodyWithSignatures`
 *  (components/ops/documents/MergedBodyView.tsx) is the other one, and the claim
 *  that this was "the single body renderer used across the app" is what produced
 *  CR-101: three surfaces rendered a body without ever coming through here. */
const NEEDS_RE = /⟦NEEDS:(.*?)⟧(.*?)⟧/g;
// A signature line: "Signature: Jane Doe" / "By (signature): Jane Doe". Matched per
// line (no /g). The label passes through; the typed name gets the script face.
const SIGNATURE_LINE_RE = /^(Signature|By \(signature\)):\s*(.+)$/m;
/* The unsigned-signature-token resolution lives in lib/documentBody.ts, because
   two renderers need it and neither owns the other — see the note there and the
   one above `body = resolveUnsignedSignatureTokens(body)` below. Re-exported here
   so the importers that predate the move keep working. */
export { resolveUnsignedSignatureTokens } from '../../lib/documentBody';

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
  /* ⚠️ THERE ARE EXACTLY TWO RESOLUTION POINTS, AND THIS IS ONE OF THEM.
     The sentence that used to sit here — "every frame that shows a document body
     comes through here" — was FALSE, and believing it is why CR-101 exists: the
     onboarding signing step, the ops document viewer and the /app/documents paper
     reader all rendered a body and none of them came through `ContractBody`.

     The two points are:
       · `ContractBody`, here — the contract page's flat/read-only/executed frames
         and the party view;
       · `BodyWithSignatures` (components/ops/documents/MergedBodyView.tsx) — the
         onboarding signing step, the ops viewer, and the paper reader.
     Both call the SAME function from lib/documentBody.ts, so they cannot drift.

     🔒 A NEW BODY RENDERER MUST CALL `resolveUnsignedSignatureTokens` ITSELF, or
     reuse one of those two. Adding a third renderer that skips it re-opens CR-101. */
  body = resolveUnsignedSignatureTokens(body);
  const nodes: ReactNode[] = [];
  let last = 0; let m: RegExpExecArray | null; let i = 0;
  NEEDS_RE.lastIndex = 0;
  // Plain-string segments (between NEEDS marks) get signature styling applied to
  // any "Signature: <name>" / "By (signature): <name>" line — the typed name shows
  // in a cursive script face, matching the emailed PDF. Non-signature text passes
  // through untouched (whitespace preserved by the pre-line container).
  const pushText = (text: string) => {
    if (!text) return;
    if (!SIGNATURE_LINE_RE.test(text)) { nodes.push(text); return; }
    const lines = text.split('\n');
    lines.forEach((line, li) => {
      const sm = SIGNATURE_LINE_RE.exec(line);
      if (sm) {
        nodes.push(
          <span key={`s${i++}`}>{sm[1]}: <span className="signature-script">{sm[2]}</span></span>,
        );
      } else {
        nodes.push(line);
      }
      if (li < lines.length - 1) nodes.push('\n');
    });
  };
  while ((m = NEEDS_RE.exec(body))) {
    if (m.index > last) pushText(body.slice(last, m.index));
    nodes.push(
      <ExplainTip key={`n${i++}`} text={`Needs: ${m[1]}`} underline={false} as="mark"
        className="bg-gold-100 text-gold-900 rounded px-1 border border-gold-400/60 border-dashed">
        {m[2]}
      </ExplainTip>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) pushText(body.slice(last));

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

/** Toggle a value in a multi-select, with "NONE" as an EXCLUSIVE choice: picking
 *  NONE clears every real option; picking any real option clears NONE. */
function nextMultiSelect(selected: string[], val: string): string[] {
  if (val === 'NONE') return selected.includes('NONE') ? [] : ['NONE'];
  const base = selected.filter((s) => s !== 'NONE');
  return base.includes(val) ? base.filter((s) => s !== val) : [...base, val];
}
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
        {!ownOther && !f.closed && <option value={OTHER_VALUE}>Other (specify)…</option>}
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
/** LEASEFIX G1 (owner-approved 2026-08-11): the share composite. A unit slot on
 *  each side of a number — picking one LOCKS the other, so a share is either $100
 *  or 100% and never both, and never a bare number whose unit has to be guessed.
 *  Stores {unit, amount}; compose_field_prose renders "$100.00" or "100%".
 *  A fixed contribution and a proportion are different agreements, so the unit is
 *  stored rather than inferred. Follows the existing composite pattern (structured
 *  in, composed text out) — see RevealText / MedSchedule below. */
function ShareAmount({
  f, onSaveStructured, disabled,
}: { f: ContractField; onSaveStructured: SaveStructFn; disabled: boolean }) {
  const s = f.structured ?? {};
  const unit = (s.unit as string | undefined) ?? '';
  const set = (patch: Partial<FieldStructured>) =>
    void onSaveStructured(f.field_key, { ...s, ...patch });
  const slot = 'text-sm rounded-lg border border-green-800/15 px-1.5 py-1 focus-ring bg-white'
    + ' disabled:bg-cream-100 disabled:text-muted';
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <select className={slot} aria-label="Amount in dollars"
        disabled={disabled || unit === 'PCT'} value={unit === 'USD' ? 'USD' : ''}
        onChange={(e) => set({ unit: e.target.value })}>
        <option value="">&mdash;</option>
        <option value="USD">$</option>
      </select>
      <input className={inputCls} inputMode="decimal" placeholder="number"
        disabled={disabled} value={(s.amount as string | undefined) ?? ''}
        onChange={(e) => set({ amount: e.target.value })} />
      <select className={slot} aria-label="Amount as a percentage"
        disabled={disabled || unit === 'USD'} value={unit === 'PCT' ? 'PCT' : ''}
        onChange={(e) => set({ unit: e.target.value })}>
        <option value="">&mdash;</option>
        <option value="PCT">%</option>
      </select>
    </span>
  );
}

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

/** ADD-TEXT — a button (labeled by the field, e.g. "Add Restrictions") that
 *  reveals a free-text input. The plain field value IS the text; empty = collapsed
 *  to the button. Once text exists it stays open (with a way to clear it). */
function AddText({ f, onSave, disabled }: { f: ContractField; onSave: SaveFn; disabled: boolean }) {
  const has = (f.value ?? '').trim() !== '';
  const [open, setOpen] = useState(has);
  const [text, setText] = useState(f.value ?? '');
  const editingRef = useRef(false);
  useEffect(() => { if (!editingRef.current) { setText(f.value ?? ''); setOpen((f.value ?? '').trim() !== '' || open); } }, [f.value]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (v: string) => { editingRef.current = false; if (v !== (f.value ?? '')) void onSave(f.field_key, v); };

  // Collapsed: a compact "+ <label>" button. The label is the field's label
  // (e.g. "Add Restrictions"); the clause line it sits on provides any lead-in.
  if (!open) {
    return (
      <button type="button" disabled={disabled}
        className="inline-flex items-center gap-1.5 text-[13px] text-green-800 border border-green-800/25 rounded-lg px-3 py-1.5 hover:bg-green-50 focus-ring align-baseline"
        onClick={() => setOpen(true)}>
        + {f.label ?? 'Add'}
      </button>
    );
  }
  // Open: the remove-✕ sits on the LEFT (with a little padding) so it never
  // collides with the ⓘ affordances at the end of the row, and the input takes
  // the full usable width of the line (flex-1 on this root; the parent row in
  // InlineFieldControl is a flex container).
  return (
    <span className="flex items-center gap-2 flex-1 w-full min-w-0">
      <button type="button" disabled={disabled}
        className="shrink-0 px-1.5 text-[12px] text-muted hover:text-red-700 focus-ring rounded"
        title="Remove" onClick={() => { setText(''); setOpen(false); commit(''); }}>✕</button>
      <input className="flex-1 min-w-0 px-1 py-0.5 text-[13.5px] text-green-900 bg-gold-50/70 border-b border-gold-400/70 focus:outline-none focus:border-gold-600 rounded-sm"
        disabled={disabled} value={text} placeholder="list any restrictions"
        onFocus={() => { editingRef.current = true; }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)} />
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

/** CONTACTS LIST — repeatable First / Last / Phone / Email rows. Structured
 *  { coOwners:[{first,last,phone,email}] }. Used for co-owners (§7): the button
 *  adds a row directly below it. Each row is removable. */
function ContactsList({
  f, onSaveStructured, disabled, addLabel = 'Add another',
}: { f: ContractField; onSaveStructured: SaveStructFn; disabled: boolean; addLabel?: string }) {
  const { draft, setLocal, commit, beginEdit, flush } = useStructuredDraft(f, onSaveStructured);
  const rows = draft.coOwners ?? [];
  const add = () => commit({ ...draft, coOwners: [...rows, { first: '', last: '', phone: '', email: '' }] });
  const editLocal = (i: number, patch: Partial<NonNullable<FieldStructured['coOwners']>[number]>) =>
    setLocal({ ...draft, coOwners: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const remove = (i: number) => commit({ ...draft, coOwners: rows.filter((_, j) => j !== i) });
  const cell = 'px-2 py-1 rounded border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white disabled:bg-cream-100';
  return (
    <div className="flex flex-col gap-2 w-full max-w-2xl">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_9rem_1fr_auto] gap-2 items-center">
          <input className={cell} disabled={disabled} placeholder="First name"
            value={r.first ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { first: e.target.value })} />
          <input className={cell} disabled={disabled} placeholder="Last name"
            value={r.last ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { last: e.target.value })} />
          <input type="tel" className={cell} disabled={disabled} placeholder="Phone"
            value={r.phone ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { phone: e.target.value })} />
          <input type="email" className={cell} disabled={disabled} placeholder="Email"
            value={r.email ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { email: e.target.value })} />
          {!disabled && (
            <button type="button" className="text-muted hover:text-red-700 text-xs shrink-0"
              onClick={() => remove(i)} title="Remove">✕</button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button" onClick={add}
          className="self-start text-sm text-gold-800 border border-dashed border-gold-400 rounded-lg px-3 py-1.5 hover:bg-gold-50 focus-ring">
          ＋ {addLabel}
        </button>
      )}
    </div>
  );
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
  /* ⚠️ THE HORSE'S OWN RECORD IS THE FIRST PLACE TO LOOK (PAMELA §B rule 6).
     Medications and supplements live on `horse_medications`, entered once through
     the intake form. Naming one in the contract meant retyping its name, dose and
     schedule from memory — the same failure mode breed/color already solved with a
     list, applied to the table that never had one. Hand-typing stays available: the
     picker seeds the three fields and every one of them is still editable, because
     a contract obligation may well differ from the standing regimen. */
  const horseId = useContext(ContractHorseContext);
  const [onRecord, setOnRecord] = useState<HorseMedication[]>([]);
  useEffect(() => {
    if (!horseId) { setOnRecord([]); return; }
    let active = true;
    listHorseMedications(horseId)
      .then((rows) => { if (active) setOnRecord(rows.filter((r) => (r.name ?? '').trim())); })
      .catch(() => { if (active) setOnRecord([]); });
    return () => { active = false; };
  }, [horseId]);
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
          {onRecord.length > 0 && !disabled && (
            <label className="flex flex-col gap-0.5 text-[11px] text-muted mb-2">
              From this horse’s record
              <select className={cell}
                value={onRecord.some((m) => m.name === it.name) ? (it.name ?? '') : ''}
                onChange={(e) => {
                  const picked = onRecord.find((m) => m.name === e.target.value);
                  if (!picked) return;
                  editNow(i, {
                    name: picked.name ?? '',
                    dose: picked.dosage ?? '',
                    schedule: picked.instructions ?? '',
                  });
                }}>
                <option value="">Choose one on file, or type it below…</option>
                {onRecord.map((m, k) => (
                  <option key={m.id ?? k} value={m.name ?? ''}>
                    {m.name}{m.kind === 'SUPPLEMENT' ? ' (supplement)' : ''}
                    {m.dosage ? ` — ${m.dosage}` : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="flex flex-col gap-0.5 text-[11px] text-muted">Name
              <input className={cell} disabled={disabled} value={it.name ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { name: e.target.value })} /></label>
            <label className="flex flex-col gap-0.5 text-[11px] text-muted">Dose
              <input className={cell} disabled={disabled} value={it.dose ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { dose: e.target.value })} /></label>
            <label className="flex flex-col gap-0.5 text-[11px] text-muted">Schedule
              <input className={cell} disabled={disabled} value={it.schedule ?? ''} onFocus={beginEdit} onBlur={flush} onChange={(e) => editLocal(i, { schedule: e.target.value })} /></label>
          </div>
          {/* Three separate responsible-party selections — administering, ordering,
              and cost — because they aren't always the same party (e.g. a vet may
              administer but rarely bears the cost). Same options for all three.
              Falls back to the legacy single `party` value for older items. */}
          <div className="grid sm:grid-cols-3 gap-2 mt-2">
            {([
              ['administer', 'Party responsible for administering'],
              ['order', 'Party responsible for ordering'],
              ['cost', 'Party responsible for cost'],
            ] as const).map(([key, label]) => {
              const pKey = `${key}_party` as const;
              const nKey = `${key}_note` as const;
              // legacy fallback: an old item's single `party` seeds all three
              const cur = (it[pKey] ?? it.party ?? '') as string;
              const note = (it[nKey] ?? (it.party ? it.party_note : '') ?? '') as string;
              return (
                <label key={key} className="flex flex-col gap-0.5 text-[11px] text-muted">
                  {label}
                  <select className={cell} disabled={disabled} value={cur}
                    onChange={(e) => editNow(i, { [pKey]: e.target.value })}>
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {MED_PARTY_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  {cur === 'OTHER' && (
                    <input className={`${cell} mt-1`} disabled={disabled} placeholder="Specify"
                      value={note} onFocus={beginEdit} onBlur={flush}
                      onChange={(e) => editLocal(i, { [nKey]: e.target.value })} />
                  )}
                </label>
              );
            })}
          </div>
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
      {/* INITIAL PAYMENT — same shape as the fee options below it: a $-prefixed
          amount and a terms box. It used to be ONE free-text field whose width
          was driven by its own placeholder, which is why it rendered at an
          arbitrary size that matched nothing around it.

          `initial_due` keeps holding the amount, so existing records and the
          composer's `s->>'initial_due'` continue to work unchanged; the terms
          live alongside in `initial_terms`. */}
      <label className="flex items-center gap-2 text-[13.5px] text-green-950">
        <span className="whitespace-nowrap shrink-0">Initial payment due:</span>
        <span className="inline-flex items-center shrink-0">
          <span className="text-green-900 mr-0.5">$</span>
          <input className="w-24 px-2 py-1 rounded border border-green-800/15 text-sm text-green-900 focus-ring bg-white disabled:bg-cream-100"
            disabled={locked} value={draft.initial_due ?? ''} placeholder="amount"
            onFocus={beginEdit} onBlur={flush}
            onChange={(e) => setLocal({ ...draft, initial_due: e.target.value })} />
        </span>
        <input className="flex-1 min-w-0 px-2 py-1 rounded border border-green-800/15 text-sm text-green-900 placeholder:text-muted focus-ring bg-white disabled:bg-cream-100"
          disabled={locked} value={(draft as { initial_terms?: string }).initial_terms ?? ''}
          placeholder="List any special conditions/terms for the initial payment"
          onFocus={beginEdit} onBlur={flush}
          onChange={(e) => setLocal({ ...draft, initial_terms: e.target.value } as FieldStructured)} />
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
  // What this control has already sent — see InlineInput's sentRef: the date
  // path below commits on change, and without this a later blur would send the
  // same value a second time while the server copy was still catching up.
  const sentRef = useRef(f.value ?? '');
  useEffect(() => { sentRef.current = f.value ?? ''; }, [f.value]);
  const fmt = f.format_type ?? '';
  const kind = f.input_kind ?? 'text';
  const save = () => {
    editingRef.current = false;
    if (local !== (f.value ?? '') && local !== sentRef.current) {
      sentRef.current = local;
      void onSave(f.field_key, local);
    }
  };

  // ── structured formats (source of truth = f.structured) ──
  if (fmt === 'share_amount') {
    return <ShareAmount f={f} onSaveStructured={onSaveStructured} disabled={disabled} />;
  }
  if (fmt === 'reveal_text') {
    return <RevealText f={f} onSaveStructured={onSaveStructured} disabled={disabled} />;
  }
  if (fmt === 'med_schedule') {
    return <MedicationBuilder f={f} onSaveStructured={onSaveStructured} disabled={disabled} />;
  }
  if (fmt === 'contacts_list') {
    return <ContactsList f={f} onSaveStructured={onSaveStructured} disabled={disabled}
      /* Was f.guidance, which doubled as this button's LABEL rather than being
         a help bubble. Guidance is being cleared template-wide, so the label
         comes from the field's own name instead of borrowing a column that is
         about to be emptied. */
      addLabel={f.label ? `Add ${f.label.replace(/^Add /i, '')}` : 'Add another'} />;
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
      placeholder="Select the responsible party"
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
  if (fmt === 'add_text') {
    return <AddText f={f} onSave={onSave} disabled={disabled} />;
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
    return <WeekGrid f={f} onSaveStructured={onSaveStructured} disabled={disabled} />;
  }
  if (kind === 'select') {
    return <SelectWithOther f={f} onSave={onSave} disabled={disabled} />;
  }
  if (kind === 'buttons') {
    const single = f.value_type === 'select';
    const selected = (f.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const toggle = (val: string) => {
      if (single) { void onSave(f.field_key, selected.includes(val) ? '' : val); return; }
      void onSave(f.field_key, nextMultiSelect(selected, val).join(','));
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
      /* Was f.guidance used as placeholder text. Guidance is cleared
         template-wide, so the field's own label carries the hint instead. */
      placeholder={f.label ?? undefined} />;
  }
  const type = kind === 'date' ? 'date' : kind === 'currency' || kind === 'percent' ? 'text' : 'text';
  /* Dates commit on change here too — same reason as InlineInput above: the value
     is atomic, and blur is not a reliable commit point for a picker that holds
     focus. Keeping the two renderers in step matters because a flat-template
     document uses THIS one. */
  return <input type={type} className={inputCls} disabled={disabled}
    value={local} onFocus={() => { editingRef.current = true; }}
    onChange={(e) => {
      const v = e.target.value;
      setLocal(v);
      if (type === 'date' && v !== (f.value ?? '') && v !== sentRef.current) {
        sentRef.current = v;
        void onSave(f.field_key, v);
      }
    }}
    onBlur={save}
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
  /* What this control has already sent, so a later blur cannot send it twice.
     `value` is the SERVER's copy and only catches up after the page reloads —
     comparing against it alone made the commit-on-change path below fire again
     on the way out, i.e. two writes for one edit whenever the reload lagged. */
  const sentRef = useRef(value);
  useEffect(() => { sentRef.current = value; }, [value]);
  const commit = () => {
    editingRef.current = false;
    if (local !== value && local !== sentRef.current) { sentRef.current = local; onCommit(local); }
  };
  /* DATES COMMIT ON CHANGE, NOT ON BLUR (TASK-CONTRACTSEND, WALK3 F-1).
     A date input was the ONE control on the page that could never be saved: it
     committed only on blur, and Enter — the commit shortcut every other input
     honours — explicitly skipped it (see onKeyDown below, which used to read
     `&& type !== 'date'`). Chrome's date field keeps focus through the whole
     picker interaction, so a user could pick a date, watch it appear in the
     document, and leave with nothing written. WALK3 proved it four ways and had
     to write TXN.LEASE_START straight into the database to finish a lease.

     Committing on change is safe HERE and not for free text: a date input's
     value is atomic — the browser reports '' until every segment is valid, then
     a complete ISO date — so there is no half-typed state to protect, which is
     the only reason the text path waits for blur. This makes a date behave like
     the select and yes/no controls, which have always saved on choice. */
  const commitNow = (v: string) => {
    setLocal(v);
    if (v !== value && v !== sentRef.current) { sentRef.current = v; onCommit(v); }
  };
  /* Width driver: the field sizes to its CONTENT — the entered value, or the
     full placeholder while empty (owner directive 2026-08-04). The old 18-char
     cap was the cause of the clipped placeholders ("Signing individual — nar",
     "Lessee's share of the cost"): it sized the box to a fixed prefix of the
     hint instead of the hint itself. A long placeholder no longer wraps into
     stacked words because the flex row wraps at the LINE level and the input
     keeps max-w-full — the natural end of the line, not an invented width.
     Short values keep short boxes (a "Days notice" field stays two characters
     wide rather than reserving room it never needs). */
  const sizer = (prefix ?? '') + (local || placeholder);
  return (
    <span className="inline-flex items-baseline align-baseline relative max-w-full">
      {prefix && local && <span className="text-green-900">{prefix}</span>}
      <span className="inline-grid">
        {/* invisible sizer sets the column width; the input overlays it */}
        {/* ⚠️ THE SIZER CARRIES A TRAILING SPACE, exactly as InlineTextarea's
            does below. Without it the column is measured to the text's own
            width and the input's content box lands on the same figure, so
            sub-pixel rounding clips the final glyph — the "cutting off the
            last letter n" the owner reported on the lease's printed name
            (2026-08-26). A textarea wraps out of that; an input cannot. */}
        <span className="col-start-1 row-start-1 invisible whitespace-pre px-1 text-[13.5px] max-w-full overflow-hidden" aria-hidden="true">
          {(sizer || placeholder) + ' '}
        </span>
        <input
          type={type}
          className={`${inlineBase} col-start-1 row-start-1 w-full min-w-[3ch]`}
          disabled={disabled}
          value={local}
          placeholder={placeholder}
          onFocus={() => { editingRef.current = true; }}
          onChange={(e) => (type === 'date' ? commitNow(e.target.value) : setLocal(e.target.value))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } }}
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
  /* THE STICKY-OTHER BUG (fixed 2026-07-31). This only ever set otherMode TRUE
     and never cleared it. Choosing "Other" saves '' (the free-text box owns the
     value from then on), and on the next render stored === '' — but the guard
     `stored !== ''` meant the effect simply did not run, leaving otherMode stuck
     on. With otherMode true, selectValue is pinned to the Other value, so
     picking Lessor or Split changed nothing visible and never saved: the field
     appeared frozen on Other.
     Now it CLEARS whenever the stored value is a listed option, and sets when it
     is a custom string. An empty value is left alone: that is the state right
     after choosing Other, before anything has been typed, and clearing there
     would bounce the control straight back out of Other mode. */
  useEffect(() => {
    if (stored === '') return;                       // mid-Other entry — leave as is
    setOtherMode(!opts.some((o) => o.value === stored));
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
          {!ownOther && !f.closed && <option value={OTHER_VALUE}>Other (specify)…</option>}
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

/** Inline chips (buttons kind not in a dropdown) — rendered inline. Single-select
 *  when value_type is 'select' (pick one; click again to clear); multi-select
 *  (comma-joined) otherwise. */
function InlineChips({ f, disabled, onSave }: { f: ContractField; disabled: boolean; onSave: SaveFn }) {
  const single = f.value_type === 'select';
  const selected = (f.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const toggle = (val: string) => {
    if (single) { void onSave(f.field_key, selected.includes(val) ? '' : val); return; }
    void onSave(f.field_key, nextMultiSelect(selected, val).join(','));
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
  f: rawField, editable, onSave, onSaveResponsibility, onSaveStructured,
}: {
  f: ContractField;
  editable: boolean;
  onSave: SaveFn;
  onSaveResponsibility: SaveRespFn;
  onSaveStructured: SaveStructFn;
  /** Accepted for call-site compatibility; the inline comment bubble was removed. */
}) {
  /* ⚠️ A RETIRED VALUE IS FILTERED HERE, IN THE ONE COMPONENT EVERY PICKER GOES
     THROUGH — NOT AT THE CALL SITES (TASK-CONTRACTOPTIONS §1).

     The sweep found FOUR call sites and only two of them filtered: two in
     ClauseDocument wrapped the field in `fieldWithAvailableOptions`,
     `renderCustom` did not, and `PartyDocumentView` — the panel the COUNTERPARTY
     answers in — did not either. Patching four call sites leaves the fifth
     author to remember; putting it here means they cannot get it wrong.

     `active` needs no sibling context, which is exactly why it can live here.
     The `when` gate does (it reads other fields' values), so that one stays in
     `fieldWithAvailableOptions` at the ClauseDocument call sites.
     ⚠️ Consequently PartyDocumentView still does not evaluate `when` gates —
     a PRE-EXISTING gap this build did not create and is not in scope to close,
     recorded in the report rather than left to be rediscovered.

     An already-SELECTED retired value stays visible so it can be unselected —
     the same escape hatch the `when` filter uses, and the reason the option is
     deactivated rather than deleted. */
  const f = useMemo(() => {
    const opts = rawField.options;
    if (!opts?.some((o) => o.active === false)) return rawField;
    const selected = (rawField.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return { ...rawField, options: opts.filter((o) => o.active !== false || selected.includes(o.value)) };
  }, [rawField]);

  const disabled = !editable || !f.can_edit;
  const fmt = f.format_type ?? '';
  const kind = f.input_kind ?? 'text';
  const label = f.label ?? f.field_key;

  // affordances — a required mark, the ⓘ guidance popover, and a suggest-edit
  // affordance for parties who can't directly edit. The per-field comment bubble
  // was removed (it cluttered the prose and its scroll-on-click was disruptive).
  /* SOURCE TIP replaces the per-field guidance bubble. Guidance said what a
     field MEANT; the tip says where its value comes FROM — the more useful fact,
     and the one that answers "this is wrong, where do I fix it?". Editing an
     imported value here would edit a copy that the next regeneration overwrites,
     so the tip names the real home instead of offering a control that cannot
     stick. Hover or focus, no click, so it never covers the prose. */
  const srcTip = fieldSourceTip(f.field_key);
  const marks = (
    <>
      {f.required && <span className="text-red-700 align-super text-[9px]">*</span>}
      {srcTip && (
        <ExplainTip text={srcTip} underline={false} className="ml-1 align-super text-[9px] text-gold-700/80">
          ⟲
        </ExplainTip>
      )}
    </>
  );

  // Structured / multi-part formats can't collapse to a single inline token —
  // render the block control, but inline-block and compact so it stays in flow.
  const isStructured = ['party', 'contact', 'person', 'address', 'location', 'pair', 'fee_schedule', 'med_schedule', 'contacts_list', 'reveal_text', 'certify', 'add_text', 'share_amount'].includes(fmt)
    || kind === 'responsibility' || kind === 'week_grid';
  if (isStructured) {
    // add_text renders as a FLEX row: collapsed it's the "+ Add …" button with
    // its marks right beside it; open, the AddText root declares flex-1 so the
    // input takes the full usable line width and the marks sit at the row end.
    if (fmt === 'add_text') {
      return (
        <span className="flex flex-wrap items-center gap-1.5 my-1 w-full min-w-0">
          <FieldControl f={f} onSave={onSave} onSaveResponsibility={onSaveResponsibility}
            onSaveStructured={onSaveStructured} disabled={disabled} />{marks}
        </span>
      );
    }
    // reveal_text and certify self-label (the control shows its own question /
    // statement), so render as a block with no label above.
    if (fmt === 'reveal_text' || fmt === 'certify') {
      return (
        <span className="block my-1">
          <FieldControl f={f} onSave={onSave} onSaveResponsibility={onSaveResponsibility}
            onSaveStructured={onSaveStructured} disabled={disabled} />{marks}
        </span>
      );
    }
    /* week_grid is a full-width BLOCK on its own line. It was still rendering
       INSIDE the clause's inline text run, so although `block` gave it its own
       line, that line started where the prose left off — which read as an indent
       and pushed the day pills right. `clear-both` plus a left-reset takes it out
       of the run, and mt-3 separates it from the sentence above rather than
       having the grid sit flush against the text.

       The label is dropped here: the clause prose already introduces it
       ("Reserved days of use:"), so repeating it above the grid was the same
       words twice. */
    if (kind === 'week_grid') {
      return (
        <span className="block clear-both w-full mt-3 mb-1.5 ml-0 pl-0">
          {/* Label ABOVE the array (owner): as an inline lead-in it pushed the
              whole grid right and left the pills crowded into what remained. */}
          <span className="block text-[13.5px] text-green-950 mb-1.5">{label}{marks}</span>
          <FieldControl f={f} onSave={onSave} onSaveResponsibility={onSaveResponsibility}
            onSaveStructured={onSaveStructured} disabled={disabled} />
        </span>
      );
    }
    return (
      /* MULTI-ROW controls (address, location, contact, person, party…) render
         as their own block. As `inline-block` they began where the prose left
         off, so every input row sat indented under the tail of the sentence —
         the same defect the week_grid had. `clear-both` with a left reset takes
         them out of the run; mt-3 keeps the first input off the line above
         instead of flush against it.

         Genuinely inline formats (yesno, select, chips, plain inputs) fall
         through below and stay in the sentence, which is where they belong. */
      <span className="block clear-both w-full mt-3 mb-1.5 ml-0 pl-0">
        <span className="block text-[11px] text-muted mb-1">{label}{marks}</span>
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

/* ⚠️ RETRACTED IN PLACE — TASK-SURFACEEDITOR, 2026-08-26.
 *
 * TASK-CONTRACTOPTIONS' report (§7.5) named these as "a second source of
 * vocabulary outside the option-list system entirely", and TASK-SURFACEEDITOR's
 * handoff carried that forward as a thing the new editor would show fields it
 * did not govern.
 *
 * MEASURED ON PRODUCTION, AND IT IS NOT TRUE TODAY: zero rows in
 * contract_field_defs and zero rows in contract_fields carry
 * input_kind = 'responsibility' or format_type = 'party'. Every one of the 212
 * live option lists is stored data, governed by contract_menu_*, and editable in
 * the Editor. These four constants are the fallback for a field kind nothing
 * uses — the comment above ResponsibilityControl's caller already says "legacy
 * responsibility (kept for any field still on input_kind)", and there is none.
 *
 * So they are DEAD DEFAULTS, not a rival vocabulary. Left in place under D32's
 * spirit rather than deleted, because a template author could still create such
 * a field and would then get sensible options instead of an empty picker — but
 * if that ever happens, THE FIX IS TO GIVE THAT FIELD REAL OPTIONS, not to edit
 * this file. */
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
const DEFAULT_WEEK: WeekState = {
  // Owner side (Lessor) first, then Lessee — matches the party order used across
  // the rest of the contract UI. The composer renders rows in this array order.
  parties: ['Lessor', 'Lessee'], days: { Lessor: [], Lessee: [] },
  timeframes: false, windows: [{ start: '06:00', end: '12:00' }, { start: '12:00', end: '18:00' }],
};
/** Read the week state from `structured` (new home). Falls back to parsing legacy
 *  JSON out of `value` for any field not yet migrated. */
function readWeek(f: ContractField): WeekState {
  const s = f.structured as WeekState | undefined;
  if (s && s.days) return s;
  if (f.value) { try { const p = JSON.parse(f.value); if (p && p.days) return p; } catch { /* fall through */ } }
  return DEFAULT_WEEK;
}
function WeekGrid({ f, onSaveStructured, disabled }: { f: ContractField; onSaveStructured: SaveStructFn; disabled: boolean }) {
  const [w, setW] = useState<WeekState>(() => readWeek(f));
  // Store the grid in `structured` (like every other structured builder); the
  // composer renders it to prose from there. Never write raw JSON into `value`.
  const commit = (next: WeekState) => { setW(next); void onSaveStructured(f.field_key, next as unknown as FieldStructured); };
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
  /* FULL-WIDTH block, no scrollbox (owner mandate: no scrollable boxes inside
     the document). One row per party: the name box hard LEFT, then the seven day
     toggles filling the rest of the line.

     The pills were fixed-width and clustered beside the name, leaving most of the
     row empty. They now share the remaining space equally (flex-1 inside a
     flexed span), so they grow to fill the line and stay comfortable to hit
     rather than sitting as a tight little group. */
  return (
    <div className="w-full max-w-full">
      <div className="flex flex-col gap-1.5">
        {w.parties.map((p, i) => (
          <div key={i} className="flex items-center gap-2 w-full">
            <input className="w-24 shrink-0 px-1.5 py-1 rounded border border-green-800/15 text-xs font-medium text-green-900 bg-white disabled:bg-cream-100"
              disabled={disabled} value={p} aria-label={`Party ${i + 1} name`}
              onChange={(e) => renameParty(i, e.target.value)} />
            <span className="flex flex-1 min-w-0 items-center gap-1">
              {DAYS.map((d) => {
                const on = (w.days[p] ?? []).includes(d);
                return (
                  <button key={d} type="button" disabled={disabled} onClick={() => toggleDay(p, d)}
                    aria-pressed={on}
                    className={`flex-1 min-w-0 text-[11px] rounded-full px-1 py-1 border focus-ring ${
                      on ? 'bg-green-800 text-white border-green-800'
                         : 'border-green-800/25 text-secondary hover:bg-green-50'} ${disabled ? 'opacity-70' : ''}`}>
                    {d}
                  </button>
                );
              })}
            </span>
            {!disabled && w.parties.length > 1 && (
              <button type="button" className="text-muted hover:text-red-700 text-xs"
                onClick={() => removeParty(i)} title="Remove this party">✕</button>
            )}
          </div>
        ))}
      </div>
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
  // Feed the evaluator every sibling's value so composite (all/any) gates see
  // the same map the SQL side does — a single-key map breaks them.
  const vals: Record<string, string> = {};
  for (const [key, ctrl] of byKey) vals[key] = ctrl?.responsibility?.party ?? ctrl?.value ?? '';
  return clauseConditionMet(c, vals);
}

/** One field + its cascading children. */
function FieldNode({
  f, childrenByParent, byKey, onSave, onSaveResponsibility, onSaveStructured, onInclude, onNa, onControl, canSetControl, editable,
}: {
  f: ContractField;
  childrenByParent: Map<string, ContractField[]>;
  byKey: Map<string, ContractField>;
  onSave: SaveFn; onSaveResponsibility: SaveRespFn; onSaveStructured: SaveStructFn; onInclude: IncludeFn; onNa: NaFn; onControl: ControlFn;
  canSetControl: boolean;
  editable: boolean;
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

  // F1: an insurance election whose section is unresolved gets the highlight,
  // the tooltip, and — when it isn't the viewer's to check — a label naming the
  // party it belongs to. The box is never hidden.
  const election = INSURANCE_ELECTIONS[f.field_key];
  const electionUnresolved = !!election && insuranceUnresolved(f.field_key, byKey);
  const notMine = !!election && !f.can_edit;

  return (
    <div className={`mb-3${electionUnresolved
      ? ' border-l-2 border-gold-500 bg-gold-50/50 pl-3 py-2 rounded-r' : ''}`}
      data-testid={election ? `insurance-election-${f.field_key}` : undefined}>
      {electionUnresolved && (
        <p role="status" className="text-[11px] text-gold-900 mb-1.5 leading-relaxed">
          {INSURANCE_TOOLTIP}
        </p>
      )}
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[13.5px] font-medium text-green-900">{f.label ?? f.field_key}</span>
        {f.required && <span className="text-red-700 text-xs">*</span>}
        {election && (
          <span className={`text-[10px] rounded px-1.5 py-0.5 border ${
            notMine ? 'text-muted border-green-800/15' : 'text-green-800 border-green-800/30'}`}>
            {notMine ? `${election.side}’s election` : `Your election (${election.side})`}
          </span>
        )}
        {electionUnresolved && (
          <ExplainTip text={INSURANCE_TOOLTIP} underline={false} className="text-[10px] text-gold-700">ⓘ</ExplainTip>
        )}
        {fieldSourceTip(f.field_key) && (
          <ExplainTip text={fieldSourceTip(f.field_key)} underline={false} className="text-[10px] text-gold-700/80">⟲</ExplainTip>
        )}
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
              onControl={onControl} canSetControl={canSetControl} editable={editable} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders one subject-section's cascading fields. */
export function ContractCascade({
  fields, onSave, onSaveResponsibility, onSaveStructured, onInclude, onNa, onControl, canSetControl = false, editable,
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
          onControl={onControl} canSetControl={canSetControl} editable={editable} />
      ))}
    </div>
  );
}
