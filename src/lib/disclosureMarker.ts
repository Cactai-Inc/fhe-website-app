/* Disclosure markers on the screen side — the twin of the regex in
 * shared/documentPdf.ts. A disclosed section's body in merged_body is bracketed:
 *     [[DISCLOSURE:KNOWN_CONDITIONS]]
 *     <readable "Entry N: Label: value" fallback block>
 *     [[/DISCLOSURE]]
 * Neither marker ever prints. A renderer that can show the structured entries
 * draws the boxed component from the document's stored entries and DROPS the block
 * between the markers; a renderer that cannot drops only the two marker lines and
 * keeps the readable block. This module splits a body into ordered segments so a
 * renderer can do exactly that.
 *
 * The structured entries themselves come from the document's own stored field
 * values (contract_fields.structured for HORSE.<SECTION>), which freeze at
 * execution — never re-read from the horse — so a signed document shows what was
 * signed. See parseDisclosureEntries in lib/contracts.ts.
 */

export type DisclosureField = { label: string; value: string };
export type DisclosureEntry = DisclosureField[];
export type DisclosureEntries = Record<string, DisclosureEntry[]>;

// Tolerate trailing punctuation/whitespace: the clause composer appends a
// sentence-terminal "." to a clause body's last line, which lands on the close
// marker ("[[/DISCLOSURE]]."). Match the marker regardless. Kept in step with
// shared/documentPdf.ts.
const OPEN = /^\[\[DISCLOSURE:([A-Z_]+)\]\][.\s]*$/;
const CLOSE = /^\[\[\/DISCLOSURE\]\][.\s]*$/;

export type BodySegment =
  | { kind: 'text'; text: string }
  | { kind: 'disclosure'; section: string; fallback: string };

/** Split a merged body into text segments and disclosure regions. The text of a
 *  disclosure segment is the readable fallback block between the markers (markers
 *  themselves excluded), so a renderer with no structured entries can show it. */
export function splitDisclosureSegments(body: string): BodySegment[] {
  const lines = body.split('\n');
  const out: BodySegment[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) { out.push({ kind: 'text', text: buf.join('\n') }); buf = []; }
  };
  for (let i = 0; i < lines.length; i += 1) {
    const open = OPEN.exec(lines[i].trim());
    if (open) {
      flush();
      const section = open[1];
      const block: string[] = [];
      i += 1;
      while (i < lines.length && !CLOSE.test(lines[i].trim())) { block.push(lines[i]); i += 1; }
      out.push({ kind: 'disclosure', section, fallback: block.join('\n') });
      // i is at the close marker; loop ++ steps past it
      continue;
    }
    if (CLOSE.test(lines[i].trim())) continue; // stray close — never prints
    buf.push(lines[i]);
  }
  flush();
  return out;
}

/** True when the body carries any disclosure region. */
export function hasDisclosureMarkers(body: string): boolean {
  return body.split('\n').some((l) => OPEN.test(l.trim()));
}

/* ── Record-side entry building ───────────────────────────────────────────────
 * The field order + labels per section, mirroring disclosure_section_spec in
 * supabase/migrations/…disc_20… so the record view, the contract, and the PDF all
 * show the same fields in the same order. The record view builds entries from the
 * raw record lists with buildRecordEntries; the contract/PDF read the entries the
 * DB already stored on the document. Keep these two specs in step. */
type OccurrenceKind = 'text' | 'occurrence' | 'bool';
type FieldSpec = { k: string; label: string; kind: OccurrenceKind };
const SECTION_FIELD_SPEC: Record<string, FieldSpec[]> = {
  KNOWN_CONDITIONS: [
    { k: 'description', label: 'Description', kind: 'text' },
    { k: 'trigger', label: 'Trigger', kind: 'text' },
    { k: 'last_occurrence', label: 'Current or Date of last occurrence', kind: 'occurrence' },
    { k: 'accommodations', label: 'Accommodations', kind: 'text' },
  ],
  MEDICAL_HISTORY: [
    { k: 'description', label: 'Description', kind: 'text' },
    { k: 'date', label: 'Date', kind: 'text' },
    { k: 'type', label: 'Type', kind: 'text' },
    { k: 'status', label: 'Status', kind: 'text' },
  ],
  BEHAVIORAL_HISTORY: [
    { k: 'description', label: 'Description', kind: 'text' },
    { k: 'trigger', label: 'Trigger', kind: 'text' },
    { k: 'last_occurrence', label: 'Current or Date of last occurrence', kind: 'occurrence' },
  ],
  INJURIES_TO_HORSE: [
    { k: 'description', label: 'Description', kind: 'text' },
    { k: 'date', label: 'Date or date range', kind: 'text' },
    { k: 'outcome', label: 'Outcome', kind: 'text' },
    { k: 'status', label: 'Status', kind: 'text' },
  ],
};

/** Build the boxed entries for a record list section, from the raw record entries. */
export function buildRecordEntries(
  section: string, items: Record<string, unknown>[] | undefined,
): DisclosureEntry[] {
  const spec = SECTION_FIELD_SPEC[section];
  if (!spec || !items) return [];
  return items.map((it) => spec.map((fd) => {
    if (fd.kind === 'occurrence') {
      const value = it.current === true ? 'Current' : String(it[fd.k] ?? '').trim();
      return { label: fd.label, value };
    }
    return { label: fd.label, value: String(it[fd.k] ?? '').trim() };
  }));
}
