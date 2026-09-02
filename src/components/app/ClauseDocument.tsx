import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { toErrorMessage } from '../../lib/ops/errors';
import {
  clauseConditionMet, removeContractComposition, resolvePendingComposition,
  updateContractComposition, withdrawPendingComposition,
  type ContractField, type SectionDef, type RedlinePendingComposition,
} from '../../lib/contracts';
import { InlineFieldControl } from './ContractCascade';
import { ExplainTip } from './ExplainTip';

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
  /** The viewer's own party role(s) on this document — 'LESSOR', 'LESSEE',
   *  'SELLER', 'BUYER', 'COBUYER'. Fields owned by another role render
   *  inactive with a role-named tooltip; the viewer's own render highlighted
   *  (owner directive 2026-08-04). Staff authoring see everything as theirs. */
  myRoles?: string[];
  /** RETIRED 2026-08-03 (owner directive): imported party-contact and
   *  horse-record tokens are LOCKED at the document — they render read-only
   *  with a tooltip naming the source record, never as inline write-back
   *  inputs. These two callbacks are accepted for caller compatibility but no
   *  longer used. */
  onEditPartyContact?: (token: string, value: string) => void | Promise<void>;
  onEditHorseRecord?: (token: string, value: string) => void | Promise<void>;
};

/** Party CONTACT tokens editable in the Notice/Contact block. Map token → the
 *  human field name (for placeholder/aria). */
const PARTY_CONTACT_TOKENS: Record<string, string> = {
  'LESSOR.FULL_NAME': 'Lessor name', 'LESSOR.ADDRESS': 'Lessor address',
  'LESSOR.PHONE': 'Lessor phone', 'LESSOR.EMAIL': 'Lessor email',
  'LESSEE.FULL_NAME': 'Lessee name', 'LESSEE.ADDRESS': 'Lessee address',
  'LESSEE.PHONE': 'Lessee phone', 'LESSEE.EMAIL': 'Lessee email',
  'SELLER.FULL_NAME': 'Seller name', 'SELLER.ADDRESS': 'Seller address',
  'SELLER.PHONE': 'Seller phone', 'SELLER.EMAIL': 'Seller email',
  'BUYER.FULL_NAME': 'Buyer name', 'BUYER.ADDRESS': 'Buyer address',
  'BUYER.PHONE': 'Buyer phone', 'BUYER.EMAIL': 'Buyer email',
  'COBUYER.FULL_NAME': 'Co-Buyer name', 'COBUYER.ADDRESS': 'Co-Buyer address',
  'COBUYER.PHONE': 'Co-Buyer phone', 'COBUYER.EMAIL': 'Co-Buyer email',
};

/** HORSE-record tokens that are editable inline in the Care section. An empty one
 *  renders as a fillable blank (not a "from horse record" hint); the typed value is
 *  written back to the horse record. Map token → the input PLACEHOLDER — descriptive
 *  of what to type, NOT a restatement of the field label already shown on the line
 *  (so "Farrier:" gets a "name" placeholder, not "Farrier"). */
const HORSE_RECORD_TOKENS: Record<string, string> = {
  'HORSE.FARRIER_NAME': 'name', 'HORSE.FARRIER_PHONE': 'phone number',
  'HORSE.VET_NAME': 'name', 'HORSE.VET_PHONE': 'phone number',
  'HORSE.VET_BUSINESS': 'name', 'HORSE.VET_ADDRESS': 'street, city, state, ZIP',
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
  'SELLER.FULL_NAME': 'Seller name on file', 'SELLER.ADDRESS': 'Seller address on file',
  'SELLER.PRINTED_NAME': 'Seller name on file',
  'SELLER.PHONE': 'Seller phone on file', 'SELLER.EMAIL': 'Seller email on file',
  'BUYER.FULL_NAME': 'Buyer name on file', 'BUYER.ADDRESS': 'Buyer address on file',
  'BUYER.PRINTED_NAME': 'Buyer name on file',
  'BUYER.PHONE': 'Buyer phone on file', 'BUYER.EMAIL': 'Buyer email on file',
  'COBUYER.FULL_NAME': 'Co-Buyer name on file', 'COBUYER.ADDRESS': 'Co-Buyer address on file',
  'COBUYER.PRINTED_NAME': 'Co-Buyer name on file',
  'COBUYER.PHONE': 'Co-Buyer phone on file', 'COBUYER.EMAIL': 'Co-Buyer email on file',
};

/** An auto-fill / signature token (no editable field) → its current value or a
 *  hint. `tip` (imported data only) is the lock tooltip naming where the value
 *  is actually edited — every imported field carries it, per the 2026-08-03
 *  owner directive. */
function TokenValue({ token, value, tip }: { token: string; value: string; tip?: string }) {
  if (token.startsWith('SIG.')) {
    // signature-ceremony tokens — placeholders filled at signing. A *.DATE token
    // is the date the party signs; everything else is the signature itself.
    const marker = token.endsWith('.DATE') ? '［date signed］' : '［signature］';
    return <span className="text-muted italic">{marker}</span>;
  }
  // The effective date is inserted automatically when the contract is signed — it is
  // never hand-filled, so show a clear placeholder, not an empty fillable blank
  // (which looked like it needed input and blocked nothing).
  if (token === 'DOC.EFFECTIVE_DATE' && !value.trim()) {
    return <span className="text-muted italic">［date of signing］</span>;
  }
  // whitespace-pre-line: composed values can be multi-line (e.g. the horse
  // location renders facility address + "Barn, Stall" on its own line) — the
  // editor must show the same line break the merged document prints. Imported
  // values carry the lock tooltip (dotted cue) naming where they are edited.
  if (value.trim()) {
    return (
      <ExplainTip text={tip} className="font-medium text-green-900 whitespace-pre-line break-words">
        {value}
      </ExplainTip>
    );
  }
  // party/horse imports show a muted "on file" hint instead of a fillable blank —
  // they're changed on the contact / horse record, not typed into the contract.
  const hint = AUTOFILL_HINT[token] ?? (token.startsWith('HORSE.') ? 'from horse record' : null);
  if (hint) {
    return (
      <ExplainTip text={tip} className="text-muted italic text-[12.5px]">
        {hint}
      </ExplainTip>
    );
  }
  return (
    <mark className="bg-green-100 text-green-900 rounded px-1.5 border border-green-400/60 border-dashed text-[13px]">
      ____
    </mark>
  );
}

/** The human name of a party role, for the imported-data tooltip when the
 *  party's name field is still blank. */
const ROLE_NAME: Record<string, string> = {
  LESSOR: 'the Lessor', LESSEE: 'the Lessee', SELLER: 'the Seller',
  BUYER: 'the Buyer', COBUYER: 'the Co-Buyer',
};

/** Role words as the INSTRUMENT says them — never a person or company name:
 *  the contract's own text says "Lessor"/"Lessee", the UI should speak the
 *  same vocabulary, and a role label stays true when a signer is reassigned
 *  (owner directive 2026-08-04). */
const ROLE_WORD: Record<string, string> = {
  LESSOR: 'the Lessor', LESSEE: 'the Lessee', SELLER: 'the Seller',
  BUYER: 'the Buyer', COBUYER: 'the Co-Buyer',
};

/** Is this field the viewer's to fill? DEAL-owned (shared) fields belong to
 *  everyone; staff authoring (no myRoles given) own everything. */
function fieldIsMine(f: ContractField, cb: FieldCallbacks): boolean {
  const owner = (f.owner_role ?? '').toUpperCase();
  if (!owner || owner === 'DEAL') return true;
  if (!cb.myRoles || cb.myRoles.length === 0) return true;   // staff author view
  return cb.myRoles.includes(owner);
}

/** "This item is set by the Lessor." (owner wording 2026-08-06) — shown on a
 *  field the viewer does not own, so responsibility is legible without
 *  guessing. Symmetric by construction: the role word comes from the field's
 *  own owner_role, so the Lessee reads "…by the Lessor" and the Lessor reads
 *  "…by the Lessee" on the mirror fields. */
function otherPartyTip(f: ContractField): string {
  const owner = (f.owner_role ?? '').toUpperCase();
  const who = ROLE_WORD[owner] ?? 'the other party';
  return `This item is set by ${who}.`;
}

/** OWNERSHIP AFFORDANCE (2026-08-04; consolidated to one wrapper 2026-08-06).
 *  A field the viewer does NOT own reads inactive and says whose it is on
 *  hover; a field they DO own is highlighted, so a party can scan the document
 *  for their own responsibilities. Staff authoring (no myRoles) see neither
 *  treatment — everything is theirs. `active` is the field's own gate: an
 *  inoperable field gets no treatment.
 *
 *  EVERY field control in this document routes through here — inline tokens,
 *  authored custom rows, and orphan controls alike. Wrapping (rather than
 *  styling each control) is what makes the tooltip zone cover the WHOLE entry,
 *  its label text included, with no dead spot where the explanation vanishes.
 *  `[&_*]:cursor-help` has to reach nested elements because some controls set
 *  their own cursor — a `certify` checkbox renders a <label className=
 *  "cursor-pointer">, which by specificity beats an inherited cursor — and an
 *  entry the viewer cannot make must never advertise itself as clickable. */
function OwnedField({
  f, cb, active = true, block = false, children,
}: {
  f: ContractField;
  cb: FieldCallbacks;
  active?: boolean;
  /** Render the wrapper as a <div> — for call sites whose content is block-level. */
  block?: boolean;
  children: ReactNode;
}) {
  const show = !!cb.myRoles && cb.myRoles.length > 0 && cb.editable && active;
  if (!show) return <>{children}</>;
  const Tag = block ? 'div' : 'span';
  if (!fieldIsMine(f, cb)) {
    const tip = otherPartyTip(f);
    // asButton=false: children carry the field's own (disabled, since this
    // branch only renders when the viewer doesn't own the field) input
    // control — a role="button" wrapper around real form controls can make a
    // screen reader stop exposing them individually, which title= never did.
    return (
      <ExplainTip text={tip} as={Tag} asButton={false} className="opacity-55 [&_*]:cursor-help">
        {children}
      </ExplainTip>
    );
  }
  return (
    <Tag className="rounded-sm bg-green-100/70 ring-1 ring-green-300/70 px-0.5">{children}</Tag>
  );
}

/** The lock tooltip for an IMPORTED token (owner directive 2026-08-03): any
 *  value imported from a party's account or the horse record is locked at the
 *  document, and the tooltip names where the change is actually made. */
function importedSourceTip(token: string, valueByKey: Record<string, string>): string {
  const role = token.split('.')[0];
  if (role === 'HORSE') {
    const horse = (valueByKey['HORSE.BARN_NAME'] || valueByKey['HORSE.REGISTERED_NAME'] || '').trim();
    const who = horse ? `${horse}'s` : "the horse's";
    return `Changes to this information must be made on ${who} record on the Horses page.`;
  }
  const name = (valueByKey[`${role}.FULL_NAME`] || '').trim() || ROLE_NAME[role] || 'the party';
  return `Changes to this information must be made on ${name}'s account on the Contacts page.`;
}

/** A RECORD token imported from a party's contact record or the horse record —
 *  LOCKED at the document (owner directive 2026-08-03; this replaces the
 *  earlier inline-editable write-back inputs, whose fixed-width boxes also
 *  truncated long values like the veterinary address). Renders the full value,
 *  wrapping freely, with a dotted-underline lock cue and a tooltip naming
 *  where the information is actually edited. Empty → a muted hint carrying the
 *  same tooltip. */
function ImportedRecordToken({
  value, tip,
}: { value: string; tip: string }) {
  if (!value.trim()) {
    return (
      <ExplainTip text={tip} className="text-muted italic text-[12.5px]">
        not on file
      </ExplainTip>
    );
  }
  return (
    <ExplainTip text={tip} className="font-medium text-green-900 whitespace-pre-line break-words">
      {value}
    </ExplainTip>
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
  if (opt?.label) return opt.label;
  /* R8 (2026-08-04): yesno fields carry no options list, so a gate on them
     printed the STORED CODE — 'is "YES"' / 'is "NO"'. Present the vocabulary
     the way the control shows it. */
  const up = raw.toUpperCase();
  if (up === 'YES') return 'Yes';
  if (up === 'NO') return 'No';
  return raw;
}

/** A plain-English description of a clause/section's gate for authors, e.g.
 *  'This is included when "Lease type" is "Partial lease".' Field labels are
 *  quoted verbatim (many are questions or sentence fragments like "Lessor is
 *  an" — quoting keeps the caption grammatical either way), values resolve to
 *  their option labels, composites unwrap recursively (and/or), and an empty
 *  expected value reads as "not yet answered" instead of a dangling "is .". */
function describeGatePart(
  cond: import('../../lib/contracts').FieldConditional,
  fieldByKey: Map<string, ContractField>,
): string | null {
  if (cond.all?.length) {
    const parts = cond.all.map((c) => describeGatePart(c, fieldByKey));
    return parts.every(Boolean) ? parts.join(' and ') : null;
  }
  if (cond.any?.length) {
    const parts = cond.any.map((c) => describeGatePart(c, fieldByKey));
    if (!parts.every(Boolean)) return null;
    return parts.length === 1 ? parts[0] : `(${parts.join(' or ')})`;
  }
  if (!cond.field_key) return null;
  const f = fieldByKey.get(cond.field_key);
  const fieldName = `“${f?.label ?? 'the selection above'}”`;
  if (cond.equals && cond.equals.length) {
    const answered = cond.equals.filter((v) => v !== '').map((v) => `“${gateValueLabel(f, v)}”`);
    const acceptsBlank = cond.equals.some((v) => v === '');
    if (!answered.length) return `${fieldName} has not been answered yet`;
    const tail = acceptsBlank ? ' or is not yet answered' : '';
    return `${fieldName} is ${answered.join(' or ')}${tail}`;
  }
  if (cond.contains && cond.contains.length) {
    const vals = cond.contains.map((v) => `“${gateValueLabel(f, v)}”`);
    return `${fieldName} includes ${vals.join(' or ')}`;
  }
  if (typeof cond.gte === 'number') return `${fieldName} is at least ${cond.gte}`;
  return null;
}

function describeGate(
  cond: import('../../lib/contracts').FieldConditional | null | undefined,
  fieldByKey: Map<string, ContractField>,
): string {
  const generic = 'This is included when the option above is selected.';
  if (!cond) return generic;
  const phrase = describeGatePart(cond, fieldByKey);
  return phrase ? `This is included when ${phrase}.` : generic;
}

/** A "[Pending — …]" placeholder clause: gated to show only while its driving
 *  question is UNANSWERED (an equals-[''] leaf somewhere in the gate). Once the
 *  question is answered such a clause can never apply again except by clearing
 *  the answer — previewing it muted in the author view is pure noise, so the
 *  author view suppresses it when gated off (unlike real alternative clauses,
 *  which stay visible so the author can change their mind). */
function isUnansweredPlaceholder(
  cond: import('../../lib/contracts').FieldConditional | null | undefined,
): boolean {
  if (!cond) return false;
  if (cond.equals && cond.equals.length && cond.equals.every((v) => v === '')) return true;
  return !!(cond.all?.some(isUnansweredPlaceholder) || cond.any?.some(isUnansweredPlaceholder));
}

/** Does this gate hinge on a selection the VIEWER still has to make? True when
 *  at least one driver field is unanswered AND owned by the viewer. Drives the
 *  party-side preview rule: decision support for your own pending choice, and
 *  silence about everyone else's. */
function gateIsPendingForViewer(
  cond: import('../../lib/contracts').FieldConditional | null | undefined,
  fieldByKey: Map<string, ContractField>,
  valueByKey: Record<string, string>,
  cb: FieldCallbacks,
): boolean {
  const keys = gateTriggerKeys(cond);
  for (const k of keys) {
    const f = fieldByKey.get(k);
    if (!f) continue;
    const answered = (valueByKey[k] ?? '').trim() !== '';
    if (!answered && fieldIsMine(f, cb)) return true;
  }
  return false;
}

/** The duration-unit convention: a CLOSED select whose options are exactly the
 *  singular/plural day-week-month set. The paired number field is the one named
 *  by its conditional_on (a gte gate), which also locks the unit until a number
 *  is entered. */
const DURATION_UNIT_VALUES = new Set(['DAY', 'DAYS', 'WEEK', 'WEEKS', 'MONTH', 'MONTHS']);
function isDurationUnitField(f: ContractField): boolean {
  const opts = f.options ?? [];
  return (f.input_kind ?? '') === 'select' && opts.length >= 2
    && opts.every((o) => DURATION_UNIT_VALUES.has(o.value));
}

/** Availability-filter a field's options: an option with a `when` gate is only
 *  offered while the gate holds — EXCEPT when it's already selected (it must
 *  stay visible so it can be unselected). Duration-unit selects additionally
 *  narrow to singular options when the paired number is 1, plural when ≥ 2.
 *
 *  ⚠️ THE `when` GATE LIVES HERE AND `active` DOES NOT (TASK-CONTRACTOPTIONS §1).
 *  A `when` gate reads OTHER fields' values, so it can only be evaluated where
 *  `valueByKey` exists — here. A retired value needs no such context, so it is
 *  filtered inside `InlineFieldControl` instead, which is the one component
 *  every picker goes through and therefore the only place a future call site
 *  cannot forget it. The sweep found four call sites and two that had already
 *  forgotten this one.
 *
 *  ⚠️ AND NEITHER FILTER TOUCHES THE LABEL RESOLVERS. `optionLabel`,
 *  `gateValueLabel` and the control's own value lookup must keep seeing the
 *  FULL list, or a retired historic selection renders as a raw code — the exact
 *  failure that deactivate-never-delete exists to prevent. */
function fieldWithAvailableOptions(
  f: ContractField, valueByKey: Record<string, string>,
): ContractField {
  let opts = f.options;
  if (!opts || opts.length === 0) return f;
  const selected = (f.value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (opts.some((o) => o.when)) {
    opts = opts.filter((o) => !o.when || selected.includes(o.value)
      || clauseConditionMet(o.when, valueByKey));
  }
  if (isDurationUnitField(f)) {
    const lenKey = f.conditional_on?.field_key;
    const n = lenKey ? parseFloat(valueByKey[lenKey] ?? '') : NaN;
    if (!Number.isNaN(n)) {
      const plural = n !== 1;
      opts = opts.filter((o) => (o.value.endsWith('S') === plural) || selected.includes(o.value));
    }
  }
  return opts === f.options ? f : { ...f, options: opts };
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
  /* ⚠️ A PRINTED NAME IS IMPORTED, NEVER TYPED INTO THE CONTRACT.
     Owner, 2026-08-26, twice: "the printed name section needs to be made wider
     ... its cutting off the last letter n", and after the first attempt widened
     the signature grid, "the contract still cuts the name short ... 'French
     Heritage Equestria' is all thats visible."

     WIDENING WAS THE WRONG FIX AND WOULD ALWAYS HAVE BEEN. A `contract_fields`
     row exists for LESSEE.PRINTED_NAME, so this branch rendered it as an inline
     INPUT, and an input cannot wrap: InlineInput sizes itself with a hidden
     `max-w-full overflow-hidden` sizer, so whenever the value is wider than the
     track it is CLIPPED rather than wrapped, and the last glyph is what falls
     off. Any width I pick is one long name away from the same bug.

     It is also wrong on the merits, per D22. `.PRINTED_NAME` is one of the five
     party tokens `fill_party_fields_from_contacts` writes FROM the contact
     record, and D22 §3 makes the name the one value that locks with the
     signature, because it is what the signature attests to. `AUTOFILL_HINT`
     below already declares every *.PRINTED_NAME an import ("Lessee name on
     file"). Rendering it as a fillable blank let a party type a printed name
     that differs from the record their signature is bound to.

     So it takes the imported-record path: a span that wraps freely, with the
     dotted-underline lock cue and the tooltip naming where the name is actually
     edited. The clipping cannot recur at any width, on any template. */
  const isPrintedName = /\.PRINTED_NAME$/.test(token);
  if (isPrintedName) {
    return (
      <ImportedRecordToken key={key} value={valueByKey[token] ?? ''}
        tip={importedSourceTip(token, valueByKey)} />
    );
  }
  if (field && field.can_edit !== undefined && !isHorseImport) {
    // A field whose OWN conditional_on is unmet is INOPERABLE — the composer
    // drops its line, so accepting input there would be a lie. (This is also
    // what locks a duration UNIT until its number is entered — the gte gate.)
    const selfGateMet = clauseConditionMet(field.conditional_on, valueByKey);
    const mine = fieldIsMine(field, cb);
    return (
      <OwnedField key={key} f={field} cb={cb} active={selfGateMet}>
        <InlineFieldControl f={fieldWithAvailableOptions(field, valueByKey)}
          editable={cb.editable && selfGateMet && mine}
          onSave={cb.onSave} onSaveStructured={cb.onSaveStructured as never}
          onSaveResponsibility={cb.onSaveResponsibility as never} />
      </OwnedField>
    );
  }
  // Imported record tokens — party contact info and horse-record details
  // (farrier / vet) — are LOCKED at the document (owner directive 2026-08-03):
  // the contract displays them; changing them happens on the source record,
  // and the tooltip says exactly where. This replaced the inline write-back
  // inputs, whose fixed widths also cut off long values (vet address).
  if (PARTY_CONTACT_TOKENS[token] || HORSE_RECORD_TOKENS[token]) {
    return (
      <ImportedRecordToken key={key} value={valueByKey[token] ?? ''}
        tip={importedSourceTip(token, valueByKey)} />
    );
  }
  const display = field ? optionLabel(field) : (valueByKey[token] ?? '');
  return <TokenValue key={key} token={token} value={display} tip={
    (AUTOFILL_HINT[token] || token.startsWith('HORSE.')) && !token.startsWith('SIG.')
      ? importedSourceTip(token, valueByKey) : undefined
  } />;
}

// A line that is purely "Label: {{TOKEN}}" — rendered as a matrix cell (bold
// label + value) rather than a sentence.
const MATRIX_LINE = /^([^{}:]{1,40}):\s*\{\{([A-Z0-9_.]+)\}\}\s*$/;

/** Render a clause body. Consecutive "Label: {{token}}" lines become a compact
 *  bold-label matrix (e.g. the horse identity block); other lines render as prose
 *  with controls/values inline at each token. */
export function ClauseProse({
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
    // `week_grid` added 2026-07-31: the reserved-days editor is a multi-row
    // control (a party name plus seven day pills, per party). Treated as a
    // COMPACT cell it sat inline beside its label, so on a phone the whole grid
    // was pushed into a narrow indented column with the pills wrapping raggedly.
    // A control this size needs the full width of the clause.
    return kind === 'select' || kind === 'buttons' || kind === 'responsibility' || kind === 'week_grid'
      || ['party', 'contact', 'person', 'address', 'location', 'pair', 'fee_schedule', 'med_schedule', 'reveal_text', 'week_grid', 'share_amount'].includes(fmt);
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
    const cell = (c: { label: string; token: string }, j: number) => {
      // week_grid: the flex row put the nowrap label first and squeezed the
      // whole grid (per-party name boxes + seven day pills) into the width
      // left over, so the buttons collapsed inside an indented column. The
      // grid takes the clause's full width, flush with the document's left
      // content edge. NO label here: the inline control renders its own label
      // above the grid, and printing the clause line's label too produced the
      // doubled "Reserved days of use" heading.
      const wf = fieldByKey.get(c.token);
      /* R4 (2026-08-04): a LONGTEXT in a compact matrix cell was squeezed into
         whatever width the bold label left over, so its placeholder wrapped into
         stacked words ("Additional / schedule / terms"). Identical field
         definitions rendered fine elsewhere purely because their clause body put
         the token on its own line. Route them to the same TWO-LINE layout the
         week-grid uses: label on its own line, control full width beneath. */
      const isLong = !!wf && (wf.input_kind === 'longtext' || wf.format_type === 'longtext');
      if (isLong) {
        return (
          <div key={j} className="w-full min-w-0 text-[13.5px] text-green-950">
            <span className="block font-semibold mb-0.5">{c.label}:</span>
            <div className="w-full">{renderToken(c.token, `mx${bi}-${j}`, fieldByKey, valueByKey, cb)}</div>
          </div>
        );
      }
      if (wf && (wf.input_kind === 'week_grid' || wf.format_type === 'week_grid')) {
        return (
          <div key={j} className="w-full min-w-0 text-[13.5px] text-green-950">
            {renderToken(c.token, `mx${bi}-${j}`, fieldByKey, valueByKey, cb)}
          </div>
        );
      }
      /* TASK LOCFIX (2026-08-05): 'location'/'address' controls already print
         their OWN label above the widget via InlineFieldControl's structured
         branch — printing the matrix line's bold label too doubled the text,
         and the widget's own full-width block being a flex-sibling of that
         label squeezed it into whatever width the label left, reading as
         right-justified. Same shape as the week_grid fix above. HORSE.* tokens
         are excluded: those are read-only record imports (a plain value, no
         self-label), so the matrix label is their only label and must stay. */
      if (wf && !wf.field_key.startsWith('HORSE.')
          && (wf.format_type === 'location' || wf.format_type === 'address')) {
        return (
          <div key={j} className="w-full min-w-0 text-[13.5px] text-green-950">
            {renderToken(c.token, `mx${bi}-${j}`, fieldByKey, valueByKey, cb)}
          </div>
        );
      }
      return (
        <div key={j} className="flex items-baseline gap-x-1.5 text-[13.5px] text-green-950 min-w-0">
          <span className="font-semibold whitespace-nowrap">{c.label}:</span>
          <span className="min-w-0 break-words">{renderToken(c.token, `mx${bi}-${j}`, fieldByKey, valueByKey, cb)}</span>
        </div>
      );
    };
    // A signature triple — Signature / Printed Name / Date for one party.
    // DESKTOP keeps the classic 3-column signature-block row. MOBILE stacks it:
    // three columns inside ~320px crushed each cell so a long printed name
    // ("French Heritage Equestrian") overlapped the Date beside it. A signature
    // block that renders unreadably is worse than one that takes three lines.
    /* ⚠️ THE PRINTED-NAME TRACK IS SIZED FOR THE COMPANY'S OWN NAME (owner,
       2026-08-26: "the printed name section needs to be made wider… its cutting
       off the last letter n"). ⚠️ THAT DIAGNOSIS WAS WRONG AND IS RETRACTED —
       the name was CLIPPED because it rendered as an inline INPUT, which cannot
       wrap; see the *.PRINTED_NAME branch above, which is the actual fix. This
       width change is retained only because a wider middle track is a reasonable
       default for every OTHER signature-block value — NOT because it solves the
       clipping, which it never did. ⚠️ The Date track was narrowed to 0.7fr to
       pay for it; if Date ever reads cramped, this is the trade to undo first.
       The middle track was 1.4fr, which on the live
       HORSE_LEASE_V2 left "French Heritage Equestrian" (26 chars, the real
       LESSEE.PRINTED_NAME) a few pixels short — and the value renders in an
       inline input whose sizer is `max-w-full overflow-hidden`, so an input
       cannot wrap the overflow the way prose does: it clips, and the trailing
       "n" is what falls off. Widened to 1.9fr, taken from the Date track, which
       only ever holds a short date and had the most slack. The tenant's own
       name is the longest string this block ever has to hold, so it is the one
       to size against. */
    const isSigTriple = cells.length === 3
      && cells.some((c) => c.token.startsWith('SIG.'))
      && cells.map((c) => c.label.toLowerCase()).join('|') === 'signature|printed name|date';
    if (isSigTriple) {
      const key = bi++;
      blocks.push(
        <div key={`sig${key}`} className="grid grid-cols-1 gap-y-1.5 my-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)_minmax(0,0.7fr)] sm:gap-x-6 sm:gap-y-1 sm:items-baseline">
          {cells.map((c, j) => cell(c, j))}
        </div>,
      );
      return;
    }
    // group consecutive compact cells into a packed grid; wide cells break out to
    // their own full-width row. This keeps the Horse identity grid AND avoids the
    // Farrier/Vet dropdown collision. A party-contact cell (Name / Address / Phone
    // / Email in the Notice block) and an editable horse-record cell (Farrier /
    // Farrier phone / Veterinarian / Practice / Address / Phone in Care) are ALSO
    // forced to their own full-width row so each field sits on its own line and a
    // long value wraps within its own row rather than running under the next field.
    const forceOwnRow = (token: string) =>
      isWideCell(token) || !!PARTY_CONTACT_TOKENS[token] || !!HORSE_RECORD_TOKENS[token];
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

/** A suggest-tier "Add item" proposal, rendered in place at the header it
 *  targets (owner spec, verbatim):
 *   - open:    a highlight box — "{author} suggested adding this to the
 *              contract, review it carefully and choose one of the options
 *              below.", then Include / Reject / Revise on the next line,
 *              then the item itself below. It is temporary until resolved.
 *   - Include: the box disappears; the item becomes a normal permanent part
 *              of the contract; the author is notified.
 *   - Reject:  grayed out, stays visible (never disappears), Reject renders
 *              as the selected control; the author is notified.
 *   - Revise:  opens the Requests drawer on this item's section — revision
 *              is proposed through that surface, not a separate editor here.
 *  The proposer sees Withdraw instead of the three buttons; anyone who is
 *  neither the proposer nor eligible to resolve it sees it read-only.
 *
 *  Preview scope: renders each line's raw body text, not the merged
 *  {{TOKEN}} substitution ClauseProse gives an accepted line — the server
 *  restricts a suggestion to an existing header with no new inline elements
 *  precisely so this preview never needs the full token/gating machinery.
 *  Once included, the item renders through the normal pipeline like any
 *  other authored line. */
function PendingCompositionBox({
  pending, isOwnerSide, hasPartyRole, onChanged, onRevise,
}: {
  pending: RedlinePendingComposition;
  isOwnerSide: boolean;
  hasPartyRole: boolean;
  onChanged?: () => void;
  onRevise: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canResolve = isOwnerSide || (hasPartyRole && !pending.mine);
  const rejected = pending.status === 'rejected';
  const who = pending.proposed_by ?? 'The other party';

  async function decide(decision: 'include' | 'reject') {
    setBusy(true); setErr(null);
    try { await resolvePendingComposition(pending.id, decision); onChanged?.(); }
    catch (e) { setErr(toErrorMessage(e, 'That failed.')); }
    finally { setBusy(false); }
  }
  async function withdraw() {
    setBusy(true); setErr(null);
    try { await withdrawPendingComposition(pending.id); onChanged?.(); }
    catch (e) { setErr(toErrorMessage(e, 'That failed.')); }
    finally { setBusy(false); }
  }

  const btn = 'text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50 disabled:pointer-events-none';
  return (
    <div className={`rounded-lg border-l-4 p-4 ${rejected ? 'border-gray-300 bg-gray-50' : 'border-green-400 bg-green-50/60'}`}>
      <p className="text-[13px] text-green-900 mb-2">
        {rejected
          ? `${who}'s suggestion was not included.`
          : `${who} suggested adding this to the contract, review it carefully and choose one of the options below.`}
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {canResolve || rejected ? (
          <>
            <button type="button" disabled={busy || rejected}
              className={`${btn} border-green-800 bg-green-800 text-white`}
              onClick={() => void decide('include')}>Include</button>
            <button type="button" disabled={busy || rejected}
              className={`${btn} ${rejected ? 'bg-red-600 text-white border-red-600' : 'border-red-300 text-red-700 hover:bg-red-50'}`}
              onClick={() => void decide('reject')}>Reject</button>
            <button type="button" disabled={busy || rejected}
              className={`${btn} border-green-800/20 text-green-900 hover:bg-green-800/5`}
              onClick={onRevise}>Revise</button>
          </>
        ) : pending.mine ? (
          <button type="button" disabled={busy} className="text-xs underline text-secondary"
            onClick={() => void withdraw()}>Withdraw</button>
        ) : (
          <span className="text-xs text-muted">Pending review</span>
        )}
      </div>
      {err && <p role="alert" className="form-error text-[12px] mb-2">{err}</p>}
      <div className={rejected ? 'opacity-50 grayscale pointer-events-none' : ''}>
        {pending.spec.lines.map((l, i) => (
          <p key={i} className="text-[13.5px] leading-[1.9] text-green-950">{l.body}</p>
        ))}
      </div>
    </div>
  );
}

/** Small pencil/trash pair for an author-owned custom row (section, header,
 *  or line) — visible to its author or staff. Edit is offered only for a
 *  plain line (see the note on ClauseDocument's edit state above); a
 *  header/section gets remove only, since removing one cascades to
 *  everything the author added under it. Declared at module scope, not
 *  inside ClauseDocument's render body — this file's own AddElementModal
 *  comment (S2) already documents why an inline-declared component remounts
 *  its whole subtree every render. */
function AuthorItemControls({
  f, canEdit, isOwnerSide, busy, onEdit, onRemove,
}: {
  f: ContractField;
  canEdit: boolean;
  isOwnerSide: boolean;
  busy: boolean;
  onEdit: (f: ContractField) => void;
  onRemove: (f: ContractField) => void;
}) {
  if (!f.custom_kind || !(isOwnerSide || f.added_by_me)) return null;
  return (
    <span className="inline-flex items-center gap-1 ml-1.5 align-middle">
      {canEdit && (
        <button type="button" disabled={busy} aria-label="Edit"
          className="text-muted hover:text-green-800 disabled:opacity-40"
          onClick={() => onEdit(f)}><Pencil size={12} /></button>
      )}
      <button type="button" disabled={busy} aria-label="Remove"
        className="text-muted hover:text-red-700 disabled:opacity-40"
        onClick={() => onRemove(f)}><Trash2 size={12} /></button>
    </span>
  );
}

export function ClauseDocument({
  sections, fields, cb: cbIn, documentId, isOwnerSide = false, hasPartyRole = false,
  pendingCompositions = [], onChanged, onRevise,
}: {
  sections: SectionDef[];
  fields: ContractField[];
  cb: FieldCallbacks;
  documentId: string;
  /** Staff/company authoring. */
  isOwnerSide?: boolean;
  /** The viewer is one of the document's own parties (not staff, not a
   *  bystander) — together with isOwnerSide, who may resolve a pending item:
   *  anyone but the proposer themselves. */
  hasPartyRole?: boolean;
  /** Suggest-tier "Add item" proposals awaiting review, from contract_redline_state. */
  pendingCompositions?: RedlinePendingComposition[];
  /** A pending item was resolved, or an already-added item was edited/removed. */
  onChanged?: () => void;
  /** "Revise" — open the Requests drawer scoped to this section. */
  onRevise?: (sectionKey: string) => void;
}) {
  /* Author-only edit/remove of an already-added item (owner requirement — a
     prerequisite for the suggest/edit split, not optional). Edit is scoped to
     a LINE's raw text only: reconstructing the full chip/condition authoring
     state from a flat contract_fields row is real additional work left for a
     later pass, and isn't needed for the common case of fixing a typo or
     tightening wording. Section/header removal cascades (server-enforced);
     line removal deletes just that one row. */
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [itemBusy, setItemBusy] = useState(false);
  const [itemErr, setItemErr] = useState<string | null>(null);

  function startEdit(f: ContractField) {
    setEditingKey(f.field_key);
    setEditText(f.body ?? '');
    setItemErr(null);
  }
  async function saveEdit(f: ContractField) {
    if (!editText.trim()) { setItemErr('The line needs some text.'); return; }
    setItemBusy(true); setItemErr(null);
    try {
      await updateContractComposition(documentId, f.field_key, {
        section: f.section ?? '', section_new: false,
        header: { clause_key: f.clause_key ?? undefined },
        elements: [], lines: [{ body: editText.trim(), conditional_on: f.conditional_on ?? null, caption: f.guidance ?? null }],
      });
      setEditingKey(null);
      onChanged?.();
    } catch (e) { setItemErr(toErrorMessage(e, 'Could not save that.')); }
    finally { setItemBusy(false); }
  }
  async function removeItem(f: ContractField) {
    if (!window.confirm(f.custom_kind === 'section' ? 'Remove this whole section?'
      : f.custom_kind === 'header' ? 'Remove this item and everything under it?' : 'Remove this line?')) return;
    setItemBusy(true); setItemErr(null);
    try { await removeContractComposition(documentId, f.field_key); onChanged?.(); }
    catch (e) { setItemErr(toErrorMessage(e, 'Could not remove that.')); }
    finally { setItemBusy(false); }
  }
  // Keep a duration UNIT's stored plurality in step with its paired number:
  // saving a length also re-saves the unit as its singular/plural twin when
  // needed, so the stored value (and the composed text) always agree ("1 month",
  // "2 months").
  const onSaveWithDurationSync = useCallback(async (key: string, value: string) => {
    await cbIn.onSave(key, value);
    const n = parseFloat(value);
    if (Number.isNaN(n)) return;
    for (const f of fields) {
      if (!isDurationUnitField(f) || f.conditional_on?.field_key !== key) continue;
      const cur = (f.value ?? '').trim();
      if (!cur) continue;
      const fixed = n === 1 ? cur.replace(/S$/, '') : cur.endsWith('S') ? cur : `${cur}S`;
      if (fixed !== cur) await cbIn.onSave(f.field_key, fixed);
    }
  }, [cbIn, fields]);
  const cb = useMemo<FieldCallbacks>(
    () => ({ ...cbIn, onSave: onSaveWithDurationSync }),
    [cbIn, onSaveWithDurationSync]);

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

  /* AUTHOR-ADDED CONTENT (R11). An addition is stored as CUSTOM.* rows carrying
     a `custom_kind`, and it must render through THIS component — the editor's
     real render path — not a lookalike: a header is a header, a line is prose
     with its controls inline, and a gated line mutes and captions exactly like a
     template clause. So authored rows are folded into the same ordered item list
     the template clauses produce, and everything downstream (numbering, gating,
     ownership affordances, required markers) applies to them unchanged.
     Placement uses the x1000 insertion space the DB writes: a template row sorts
     at sort_order*1000, an authored row at its stored sort_order, so an authored
     item can always sit between two template ones. */
  const customRows = useMemo(
    () => fields.filter((f) => !!f.custom_kind), [fields]);
  const customSectionRows = useMemo(
    () => customRows.filter((f) => f.custom_kind === 'section'), [customRows]);
  const customLinesByHeader = useMemo(() => {
    const m = new Map<string, ContractField[]>();
    for (const f of customRows) {
      if (f.custom_kind !== 'line') continue;
      const k = f.clause_key ?? '';
      (m.get(k) ?? m.set(k, []).get(k)!).push(f);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.sort_order - b.sort_order);
    return m;
  }, [customRows]);

  /** One thing to render inside a section — a template clause or an authored
   *  header/line. `clauseKey` is what fieldsByClause is keyed on. */
  type RenderItem = {
    clauseKey: string;
    heading: string | null;
    body: string | null;
    conditional_on: import('../../lib/contracts').FieldConditional | null;
    caption: string | null;      // authored caption override (the green caption line)
    ord1: number; ord2: number;
    /** A suggest-tier proposal targeting this header, rendered in place
     *  instead of a normal item — see PendingCompositionBox below. */
    pending?: RedlinePendingComposition;
  };
  /** Pending proposals anchored to this header, sorted after its real lines
   *  (a high ord2 sentinel) — where they'd really land is only resolved for
   *  real once accepted; until then "right after the existing content" is
   *  close enough to be legible and never wrong about WHICH header. */
  const pendingFor = useCallback((headerKey: string, ord1: number): RenderItem[] =>
    pendingCompositions
      .filter((p) => p.spec.header?.clause_key === headerKey)
      .map((p, i) => ({
        clauseKey: `pending:${p.id}`, heading: null, body: null,
        conditional_on: null, caption: null, ord1, ord2: 1_000_000 + i, pending: p,
      })), [pendingCompositions]);
  const lineItems = useCallback((headerKey: string, ord1: number): RenderItem[] =>
    (customLinesByHeader.get(headerKey) ?? []).map((l) => ({
      clauseKey: l.field_key, heading: null, body: l.body ?? '',
      conditional_on: l.conditional_on ?? null, caption: l.guidance ?? null,
      ord1, ord2: l.sort_order,
    })), [customLinesByHeader]);

  // Legacy custom fields — the pre-R11 add surface produced bare "Label: value"
  // rows with no custom_kind. They keep rendering exactly as they did.
  const sectionKeys = useMemo(() => new Set(sections.map((s) => s.section_key)), [sections]);
  const customBySection = useMemo(() => {
    const m = new Map<string, ContractField[]>();
    for (const f of fields) {
      if (!f.field_key.startsWith('CUSTOM.') || f.custom_kind) continue;
      const k = f.section ?? '';
      (m.get(k) ?? m.set(k, []).get(k)!).push(f);
    }
    return m;
  }, [fields]);
  const customSectionNames = useMemo(
    () => [...customBySection.keys()]
      .filter((k) => k && !sectionKeys.has(k) && !customSectionRows.some((s) => s.section === k))
      .sort(),
    [customBySection, sectionKeys, customSectionRows],
  );

  /** Template sections and authored sections in one order, each with its items. */
  const renderSections = useMemo(() => {
    const secs: { key: string; sectionKey: string; heading: string; ord: number; items: RenderItem[] }[] = [];
    const headersFor = (sectionKey: string) => customRows
      .filter((f) => f.custom_kind === 'header' && f.section === sectionKey)
      .sort((a, b) => a.sort_order - b.sort_order);
    for (const s of sections) {
      const items: RenderItem[] = [];
      for (const c of s.clauses) {
        const ord1 = c.sort_order * 1000;
        items.push({
          clauseKey: c.clause_key, heading: c.heading, body: c.body,
          conditional_on: c.conditional_on, caption: null, ord1, ord2: 0,
        });
        items.push(...lineItems(c.clause_key, ord1));
        items.push(...pendingFor(c.clause_key, ord1));
      }
      for (const h of headersFor(s.section_key)) {
        items.push({
          clauseKey: h.field_key, heading: h.label ?? 'Item', body: null,
          conditional_on: null, caption: null, ord1: h.sort_order, ord2: 0,
        });
        items.push(...lineItems(h.field_key, h.sort_order));
        items.push(...pendingFor(h.field_key, h.sort_order));
      }
      items.sort((a, b) => a.ord1 - b.ord1 || a.ord2 - b.ord2);
      secs.push({ key: s.section_key, sectionKey: s.section_key, heading: s.heading, ord: s.sort_order * 1000, items });
    }
    for (const cs of customSectionRows) {
      const name = cs.section ?? '';
      const items: RenderItem[] = [];
      for (const h of headersFor(name)) {
        items.push({
          clauseKey: h.field_key, heading: h.label ?? 'Item', body: null,
          conditional_on: null, caption: null, ord1: h.sort_order, ord2: 0,
        });
        items.push(...lineItems(h.field_key, h.sort_order));
        items.push(...pendingFor(h.field_key, h.sort_order));
      }
      items.sort((a, b) => a.ord1 - b.ord1 || a.ord2 - b.ord2);
      secs.push({ key: `custom-section:${name}`, sectionKey: name, heading: cs.label ?? name, ord: cs.sort_order, items });
    }
    secs.sort((a, b) => a.ord - b.ord);
    return secs;
  }, [sections, customRows, customSectionRows, lineItems, pendingFor]);

  /* ⚠️ THE THIRD CALL SITE, AND IT WAS THE ONE THAT DID NOT FILTER
     (found by TASK-CONTRACTOPTIONS' reader sweep, 2026-08-26). `InlineFieldControl`
     is rendered from three places in this file; the other two wrap the field in
     `fieldWithAvailableOptions` and this one passed `f` straight through. So an
     author-added custom field ignored option-level `when` gates already, and
     would have ignored `active` too — a retired value would have kept being
     offered here and nowhere else, which is the worst shape of the bug because
     it looks like the sweep succeeded. */
  const renderCustom = (f: ContractField, num: string) => (
    <OwnedField key={f.field_key} f={f} cb={cb} block>
      <div className="flex items-baseline gap-1.5">
        <span className="text-muted tabular-nums text-[13px]">{num}</span>
        <span className="text-[13.5px] font-semibold text-green-900">{f.label ?? f.field_key}:</span>
        <InlineFieldControl f={fieldWithAvailableOptions(f, valueByKey)} editable={cb.editable && fieldIsMine(f, cb)}
          onSave={cb.onSave} onSaveStructured={cb.onSaveStructured as never}
          onSaveResponsibility={cb.onSaveResponsibility as never} />
      </div>
    </OwnedField>
  );

  let sectionNo = 0;
  return (
    <div className="document-paper flex flex-col gap-7">
      {renderSections.map((section) => {
        // Gated-off clauses are shown (muted, toggleable) ONLY to a user who can
        // actually edit — so the author never loses the ability to change their mind
        // before signing. A REVIEWING party (or anyone who can't edit) sees only the
        // active clauses, matching the final/locked document — no confusing
        // "optional, not included" content. The composed merged_body always omits
        // gated-off clauses.
        const clausesToShow = section.items.filter((c) => {
          if (clauseConditionMet(c.conditional_on, valueByKey)) return true;
          // A gated-off "[Pending — …]" placeholder is dead weight once its
          // question is answered — never preview it muted.
          if (isUnansweredPlaceholder(c.conditional_on)) return false;
          const hasFields = (fieldsByClause.get(c.clauseKey) ?? []).length > 0;
          const hasContent = !!(c.body && c.body.trim()) || hasFields;
          if (!hasContent) return false;
          if (cb.authorView) return true;     // staff author sees every branch
          /* PARTY DECISION SUPPORT (owner directive 2026-08-04). A gated-off
             clause is previewed to a PARTY only while the selection that
             controls it is still UNMADE, and only to the party who owns that
             selection — so a reviewer sees what their own pending choice will
             produce, and nothing about anyone else's resolved or pending
             decisions. Once answered, the preview has done its job. */
          return gateIsPendingForViewer(c.conditional_on, fieldByKey, valueByKey, cb);
        });
        const sectionCustom = customBySection.get(section.sectionKey) ?? [];
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
          <section key={section.key} className={sectionAllOptional ? 'opacity-50' : ''}>
            <h2 className="font-serif text-green-900 text-2xl mb-3 flex items-baseline flex-wrap gap-x-2 gap-y-1 border-b border-green-800/10 pb-1.5">
              <span className="text-green-800 tabular-nums">{secNum}.</span>
              {section.heading}
              {sectionAllOptional && (
                <span className="text-[11px] text-green-700/90 font-sans font-medium self-center normal-case tracking-normal">
                  {describeGate(clausesToShow[0]?.conditional_on, fieldByKey)}
                </span>
              )}
            </h2>
            <div className="flex flex-col gap-4">
              {clausesToShow.map((clause) => {
                // A suggest-tier proposal renders as its own review box — it
                // never enters the numbering/gating machinery below, since it
                // isn't part of the composed document until included.
                if (clause.pending) {
                  return (
                    <PendingCompositionBox key={clause.clauseKey} pending={clause.pending}
                      isOwnerSide={isOwnerSide} hasPartyRole={hasPartyRole}
                      onChanged={onChanged} onRevise={() => onRevise?.(section.sectionKey)} />
                  );
                }
                const gatedOff = !clauseConditionMet(clause.conditional_on, valueByKey);
                // Only ever set for an author-added section/header/line — a
                // template clause's clauseKey never resolves to a row with
                // custom_kind, so AuthorItemControls no-ops for it below.
                const authoredField = fieldByKey.get(clause.clauseKey);
                /* NUMBERING DERIVES FROM HEADINGS (R11, owner ruling 2026-08-04;
                   supersedes the "every rendered clause consumes a number" rule).
                   A number is an ENFORCEABLE cross-reference, so it may exist only
                   where there is a titled thing to reference — a HEADER, i.e. a
                   clause carrying its own heading — and only when that header is
                   actually part of the instrument:
                     • headed + gated-on      → takes the next sub-number (3.1, 3.2…)
                     • headingless + gated-on → CONTINUATION of the item above it:
                       no number, no increment (more prose under the same header;
                       before the first header it is section preamble under "N.")
                     • gated-off (muted preview) → never numbers, never increments,
                       so the editor's numbering always equals the executed form's.
                   Numbers are order-derived, so insertion/removal renumbers itself.
                   The mirror of this rule lives in remerge_contract_from_clauses. */
                const isHeader = !!(clause.heading && clause.heading.trim());
                const numbered = isHeader && !gatedOff;
                if (numbered) clauseNo += 1;
                const num = numbered ? `${secNum}.${clauseNo}` : '';
                const bodyTokens = new Set(
                  [...(clause.body ?? '').matchAll(TOKEN_RE)].map((mm) => mm[1]),
                );
                // A clause can be gated by a field that lives ON the clause itself
                // (a self-enabling toggle, e.g. "Include 3rd party exercise"). That
                // control MUST stay clickable when the clause is gated off — freezing
                // it would make the clause impossible to turn on. Split it out.
                const triggerKeys = gateTriggerKeys(clause.conditional_on);
                // Authoring-control fields for this clause not placed by a {{token}}
                // in its prose — e.g. a yes/no enable gate ("Any exceptions?"), the
                // lease-type selector, etc. These are the field's DESIGNATED clause
                // (clause_key), so they're intentional and render below the prose as
                // authoring controls. (Stale fields are removed at the data layer,
                // not hidden here.) A NON-trigger orphan whose OWN conditional_on is
                // unmet is hidden + inoperable — this is what kept phantom duplicate
                // deductible sub-fields from disappearing when Lessor was selected.
                // Authored rows (headers / lines / inline elements) are NEVER orphans:
                // an element is placed by its {{token}} inside a line, so listing it
                // here too would print the same control twice.
                const orphanFields = (fieldsByClause.get(clause.clauseKey) ?? [])
                  .filter((f) => (!bodyTokens.has(f.field_key) || (gatedOff && triggerKeys.has(f.field_key)))
                    && !f.custom_kind)
                  .filter((f) => triggerKeys.has(f.field_key)
                    || clauseConditionMet(f.conditional_on, valueByKey));
                const gateControls = orphanFields.filter((f) => triggerKeys.has(f.field_key));
                const previewFields = orphanFields.filter((f) => !triggerKeys.has(f.field_key));
                // certify / add_text / reveal_text controls render their own label
                // (the checkbox statement / button text), so we must NOT also print
                // a prefix label — otherwise it shows twice.
                const renderOrphan = (f: ContractField) => {
                  const selfLabels = f.format_type === 'certify'
                    || f.format_type === 'add_text' || f.format_type === 'reveal_text';
                  return (
                    /* The label rides INSIDE the ownership wrapper with its
                       control, so a checkbox and the statement it belongs to
                       are one hover target — the insurance "not required"
                       certifications are exactly this shape. */
                    <OwnedField key={f.field_key} f={f} cb={cb}>
                      {/* Owner, 2026-08-09: 13.3's label rendered one word per line
                          in a narrow column beside the dropdown. InlineSelect sizes
                          itself to its WIDEST option through an invisible
                          whitespace-pre sizer, and 13.3's widest option is a full
                          sentence ("Lessor requires Lessee to have Care, Custody and
                          Control insurance for the duration of this lease
                          agreement"). In a non-wrapping flex row with no shrink
                          floor, that greedy control squeezed the label to its
                          minimum content width — one word wide.
                          shrink-0 gives the label its natural width, and flex-wrap
                          lets the control drop to its own full-width line when it
                          cannot sit beside it. Short labels are unchanged: they
                          still share the line, because wrapping only happens when
                          the row genuinely will not fit. */}
                      <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-1 max-w-full">
                        {!selfLabels && <span className="shrink-0">{f.label ?? f.field_key}</span>}
                        <InlineFieldControl f={fieldWithAvailableOptions(f, valueByKey)}
                          editable={cb.editable && fieldIsMine(f, cb)}
                          onSave={cb.onSave} onSaveStructured={cb.onSaveStructured as never}
                          onSaveResponsibility={cb.onSaveResponsibility as never} />
                      </span>
                    </OwnedField>
                  );
                };
                return (
                  <div key={clause.clauseKey}>
                    {/* A per-clause "optional" note appears only for a clause that's
                        individually gated off within an OTHERWISE-ACTIVE section. When
                        the WHOLE section is optional, the greyed section title carries
                        the single note instead (no per-clause repetition). */}
                    {/* R1 (2026-08-04): the QUESTION renders live and at full
                        opacity, ABOVE the muted consequence — previously the
                        control that answers a gate sat inside the greyed block it
                        gated, so the author was asked to interact with something
                        that read as disabled. The caption now introduces the muted
                        preview below it rather than floating above the question,
                        where it read as if the question itself were conditional. */}
                    {gatedOff && gateControls.length > 0 && (
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1.5 text-[13.5px] text-green-950 leading-[1.9]">
                        {gateControls.map(renderOrphan)}
                      </div>
                    )}
                    {gatedOff && !sectionAllOptional && (
                      <p className="text-[11px] text-green-700/90 mb-0.5">
                        {clause.caption || describeGate(clause.conditional_on, fieldByKey)}
                      </p>
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
                      {/* R7 (2026-08-04): a clause whose heading merely repeats its
                          section heading printed the same words twice ("6. Governing
                          Law and Venue / 6.1 Governing Law and Venue"). The NUMBER is
                          retained — it is the clause's stable identity and a
                          cross-reference target — only the echoed words are dropped.
                          R6: the required marker now rides the TITLE line, so it can
                          no longer collide with sentence punctuation mid-prose. */}
                      {(() => {
                        const echoesSection = !!clause.heading
                          && clause.heading.trim().toLowerCase() === section.heading.trim().toLowerCase();
                        const clauseRequired = (fieldsByClause.get(clause.clauseKey) ?? [])
                          .some((f) => f.required && clauseConditionMet(f.conditional_on, valueByKey)
                                       && (f.value ?? '').trim() === '');
                        /* The words are dropped when the heading merely echoes its
                           section title (R7) — the NUMBER still stands, being the
                           clause's stable identity. A headingless continuation has
                           neither, so it prints no title line at all and reads as
                           more prose under the header above it; a muted preview
                           prints its title but never a number (R11). */
                        const showWords = isHeader && !echoesSection;
                        if (!num && !showWords && !clauseRequired) return null;
                        return (
                          <p className="text-[13px] font-semibold text-green-900 mb-1 flex items-center gap-1.5">
                            {num ? <span className="text-muted tabular-nums">{num}</span> : null}
                            {showWords ? clause.heading : null}
                            {clauseRequired && (
                              <ExplainTip text="Needs an answer before signing" underline={false} className="text-green-700">*</ExplainTip>
                            )}
                            {isHeader && authoredField && (
                              <AuthorItemControls f={authoredField} canEdit={false} isOwnerSide={isOwnerSide}
                                busy={itemBusy} onEdit={startEdit} onRemove={(f) => void removeItem(f)} />
                            )}
                          </p>
                        );
                      })()}
                      {!isHeader && clause.body && editingKey === clause.clauseKey ? (
                        <div className="mb-1">
                          <textarea rows={2} className="form-input resize-y text-[13.5px]"
                            value={editText} onChange={(e) => setEditText(e.target.value)} />
                          {itemErr && <p role="alert" className="form-error text-[12px] mt-1">{itemErr}</p>}
                          <div className="flex gap-2 mt-1.5">
                            <button type="button" className="btn-primary text-xs" disabled={itemBusy}
                              onClick={() => authoredField && void saveEdit(authoredField)}>Save</button>
                            <button type="button" className="text-xs underline text-secondary" disabled={itemBusy}
                              onClick={() => setEditingKey(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : clause.body ? (
                        <div className="flex items-start gap-1">
                          <div className="flex-1 min-w-0">
                            <ClauseProse body={clause.body} fieldByKey={fieldByKey} valueByKey={valueByKey} cb={cb} />
                          </div>
                          {!isHeader && authoredField && (
                            <AuthorItemControls f={authoredField} canEdit isOwnerSide={isOwnerSide}
                              busy={itemBusy} onEdit={startEdit} onRemove={(f) => void removeItem(f)} />
                          )}
                        </div>
                      ) : null}
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
              <span className="text-green-800 tabular-nums">{secNum}.</span>
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
