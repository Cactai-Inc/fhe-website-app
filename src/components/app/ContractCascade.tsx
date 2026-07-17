import { useMemo, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import type { ContractField, FieldStructured, PartyChoice } from '../../lib/contracts';

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

/** Party options. The manage side offers Care Provider; the cost side offers a
 *  "same as responsible party" default plus specific parties / shared split. */
const PARTY_OPTS = [
  { value: 'LESSOR', label: 'Owner (Lessor)' },
  { value: 'LESSEE', label: 'Lessee' },
  { value: 'CARE_PROVIDER', label: 'Care Provider' },
  { value: 'SHARED', label: 'Shared' },
];
const COST_PARTY_OPTS = [
  { value: 'LESSOR', label: 'Owner (Lessor)' },
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
        <option value="">{placeholder}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
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
              <span className="w-28 truncate">{p.party === 'LESSOR' ? 'Owner' : p.party === 'LESSEE' ? 'Lessee' : p.party}</span>
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
function InfoDot({ text }: { text: string }) {
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
 *  so unfinished parts of the document stand out instead of reading as complete. */
const NEEDS_RE = /⟦NEEDS:(.*?)⟧(.*?)⟧/g;
export function ContractBody({ body }: { body: string | null }) {
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
  return <>{nodes}</>;
}

/** A single field's control, chosen by format_type (preferred) or input_kind. */
function FieldControl({
  f, onSave, onSaveResponsibility, onSaveStructured, disabled,
}: { f: ContractField; onSave: SaveFn; onSaveResponsibility: SaveRespFn; onSaveStructured: SaveStructFn; disabled: boolean }) {
  const [local, setLocal] = useState(f.value ?? '');
  const fmt = f.format_type ?? '';
  const kind = f.input_kind ?? 'text';
  const save = () => { if (local !== (f.value ?? '')) void onSave(f.field_key, local); };

  // ── structured formats (source of truth = f.structured) ──
  if (fmt === 'pair') {
    return <PairControl f={f} onSaveStructured={onSaveStructured} disabled={disabled} />;
  }
  if (fmt === 'party') {
    const val = (f.structured ?? {}) as PartyChoice;
    return <PartyPicker value={val} disabled={disabled} opts={PARTY_OPTS}
      placeholder={f.guidance ?? 'Select the responsible party'}
      onChange={(v) => void onSaveStructured(f.field_key, v as FieldStructured)} />;
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

  // ── legacy responsibility (kept for any field still on input_kind) ──
  if (kind === 'responsibility') {
    return <ResponsibilityControl f={f} onSaveResponsibility={onSaveResponsibility} disabled={disabled} />;
  }
  if (kind === 'week_grid') {
    return <WeekGrid f={f} onSave={onSave} disabled={disabled} />;
  }
  if (kind === 'select') {
    return (
      <select className={inputCls} disabled={disabled} value={f.value ?? ''}
        onChange={(e) => void onSave(f.field_key, e.target.value)}>
        <option value="">Select…</option>
        {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
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
      value={local} onChange={(e) => setLocal(e.target.value)} onBlur={save}
      placeholder={f.guidance ?? undefined} />;
  }
  const type = kind === 'date' ? 'date' : kind === 'currency' || kind === 'percent' ? 'text' : 'text';
  return <input type={type} className={inputCls} disabled={disabled}
    value={local} onChange={(e) => setLocal(e.target.value)} onBlur={save}
    placeholder={kind === 'currency' ? '$' : kind === 'percent' ? '%' : undefined} />;
}

const COST_OPTS = [
  { value: 'OWNER', label: 'Owner' }, { value: 'LESSEE', label: 'Lessee' },
  { value: 'SHARED', label: 'Shared (split %)' },
];
const DUTY_OPTS = [
  { value: 'OWNER', label: 'Owner' }, { value: 'LESSEE', label: 'Lessee' },
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
        <option value="">Choose…</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {party === 'SHARED' && sharedIsSplit && (
        <div className="flex items-center gap-2 text-sm text-secondary">
          Owner <input type="number" min={0} max={100} className={`${inputCls} w-20`} disabled={disabled}
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
  return { parties: ['Lessee', 'Owner'], days: { Lessee: [], Owner: [] },
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
  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left px-2 py-1 text-muted font-semibold">Party</th>
            {DAYS.map((d) => <th key={d} className="px-2 py-1 text-green-800 font-semibold text-center">{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {w.parties.map((p) => (
            <tr key={p}>
              <td className="px-2 py-1 font-medium text-green-900 whitespace-nowrap">{p}</td>
              {DAYS.map((d) => (
                <td key={d} className="px-2 py-1 text-center">
                  <input type="checkbox" className="accent-green-700" disabled={disabled}
                    checked={(w.days[p] ?? []).includes(d)} onChange={() => toggleDay(p, d)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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

/** Is `f` currently revealed, given its conditional_on gate against sibling values? */
function conditionMet(f: ContractField, byKey: Map<string, ContractField>): boolean {
  const c = f.conditional_on;
  if (!c) return true;
  const ctrl = byKey.get(c.field_key);
  const v = ctrl?.responsibility?.party ?? ctrl?.value ?? '';
  return c.equals.includes(v);
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
