import { useMemo } from 'react';
import {
  clauseConditionMet, type ContractField, type SectionDef,
} from '../../lib/contracts';
import { ContractBody, InlineFieldControl } from './ContractCascade';

/**
 * P1 ITEM 3 — A PARTY SEES THE DOCUMENT, NOT THE AUTHORING SURFACE.
 *
 * Owner, 2026-08-25: *"her view of the contract should show the selections made
 * and the text that renders along with that selection, she should not see the text
 * that doesnt render in the finished document, if she makes a change to a selection
 * then the content should change to the appropriately shown text immediately."*
 *
 * WHAT SHE USED TO SEE. `<ClauseDocument>` is the AUTHOR's surface: numbered
 * clause boxes, "＋ Include" affordances, N/A toggles, per-field guidance, and —
 * the part the owner objected to — conditional clauses rendered MUTED as a preview
 * of what a pending choice would produce (the 2026-08-04 "party decision support"
 * directive). The 2026-08-25 instruction reverses that for the party view: text
 * that will not appear in the finished document must not be visible to her AT ANY
 * POINT, including while the selection controlling it is unset.
 *
 * WHAT SHE SEES NOW. `documents.merged_body` — the composed instrument, which
 * already resolves every conditional server-side: a gated-off clause is not in it,
 * and a line whose fillable tokens are all empty is not in it. So the rule is
 * satisfied BY CONSTRUCTION rather than by a second set of client-side gates that
 * could disagree with the composer. It renders through `ContractBody`, the one
 * renderer the read-only frame, the executed frame and the flat renderer all use,
 * so her screen cannot drift from the emailed PDF.
 *
 * HER SELECTIONS STAY HERS. The document is prose; her own controls are attached
 * to the section they belong to, so a choice sits beside the text it governs. Only
 * fields the SERVER says she may edit (`can_edit`, which already encodes her party
 * role, her party controls and the workflow phase) and whose own gate is currently
 * met — never a question the document is not asking.
 *
 * ⚠️ NO CLIENT-SIDE MERGE. Changing a selection re-runs the SERVER composer
 * (`regenerate_contract_document`, which dispatches to
 * `remerge_contract_from_clauses` for a clause template and to
 * `remerge_contract_from_fields` for a flat one) and re-renders what comes back.
 * Approximating the merge here is how the screen and the PDF start to disagree.
 */

/** A top-level heading in the composed body: "3. THE HORSE".
 *  Sub-items ("3.1 Horse Details") do NOT match — a digit follows the dot, not a
 *  space — which is what keeps a section from being split at every clause. */
const SECTION_HEADING_RE = /^(\d+)\.[ \t]+(\S.*)$/;

interface Chunk {
  /** The section heading text as the DOCUMENT prints it, or null for anything
   *  above the first heading (a preamble, or a whole flat document). */
  heading: string | null;
  text: string;
}

/** Split the composed body at its own top-level headings. Nothing is rewritten:
 *  each chunk still carries its heading line, so the reader sees the document
 *  exactly as it composed, and we only learn where the seams are. */
function splitBodyIntoSections(body: string): Chunk[] {
  const lines = body.split('\n');
  const chunks: Chunk[] = [];
  let heading: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    if (buf.length === 0 && heading === null) return;
    chunks.push({ heading, text: buf.join('\n') });
  };
  for (const line of lines) {
    const m = SECTION_HEADING_RE.exec(line.trim());
    if (m) {
      flush();
      heading = m[2].trim();
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  flush();
  return chunks;
}

/** Case- and punctuation-insensitive heading match: the composed heading is the
 *  template's `heading`, but a document that has been re-titled or a heading that
 *  picked up a trailing colon must still find its section. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function PartyDocumentView({
  body, sections, fields, editable, onSave, onSaveStructured, onSaveResponsibility,
}: {
  body: string | null;
  /** The template's section defs, used only to map a printed heading back to the
   *  `section` key her fields carry. Empty for a flat document — then every field
   *  she owns renders in the one block below the text, which is right: a flat
   *  document has no sections to attach them to. */
  sections: SectionDef[];
  fields: ContractField[];
  editable: boolean;
  onSave: (key: string, value: string) => void | Promise<void>;
  onSaveStructured: (key: string, s: unknown) => void | Promise<void>;
  onSaveResponsibility: (key: string, r: unknown) => void | Promise<void>;
}) {
  const valueMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const f of fields) m[f.field_key] = f.responsibility?.party ?? f.value ?? '';
    return m;
  }, [fields]);

  /** Hers to answer, and asked by the document as it currently stands. */
  const mine = useMemo(() => fields.filter((f) => (
    f.can_edit
    // Structural author rows (a section, a header, a line of prose) are not
    // questions; their content is already IN the composed text above.
    && !f.custom_kind
    // A cost child is rendered by its manage field, never as a row of its own —
    // the same rule ClauseDocument applies.
    && !f.pair_manage_key
    // Never a question the document is not asking right now.
    && clauseConditionMet(f.conditional_on, valueMap)
    && f.is_na !== true
    && f.included !== false
  )), [fields, valueMap]);

  const chunks = useMemo(() => (body ? splitBodyIntoSections(body) : []), [body]);

  /** section_key → the heading the composed body prints for it. */
  const headingForKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sections) m.set(s.section_key, s.heading);
    return m;
  }, [sections]);

  /** Her fields, bucketed by the printed heading they belong under. */
  const { bySection, unplaced } = useMemo(() => {
    const printed = new Set(chunks.map((c) => (c.heading ? norm(c.heading) : '')).filter(Boolean));
    const byHeading = new Map<string, ContractField[]>();
    const rest: ContractField[] = [];
    for (const f of mine) {
      const key = (f.section ?? '').trim();
      const candidates = [headingForKey.get(key), key].filter(Boolean) as string[];
      const hit = candidates.map(norm).find((h) => printed.has(h));
      if (hit) {
        (byHeading.get(hit) ?? byHeading.set(hit, []).get(hit)!).push(f);
      } else {
        rest.push(f);
      }
    }
    return { bySection: byHeading, unplaced: rest };
  }, [mine, chunks, headingForKey]);

  if (!body || !body.trim()) {
    return (
      <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
        <p className="text-sm text-muted">
          This document has no composed text yet. It appears once the document is generated.
        </p>
      </section>
    );
  }

  const controls = (list: ContractField[], key: string) => (
    <div key={`c-${key}`} className="bg-green-50 border border-green-500/40 rounded-lg px-5 py-4 my-4">
      <p className="text-[11px] font-sans uppercase tracking-wide text-green-800 mb-3">
        {list.length === 1 ? 'Your answer' : 'Your answers'}
      </p>
      <div className="flex flex-col gap-3">
        {list.map((f) => (
          <div key={f.field_key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[13.5px] font-semibold text-green-900">
              {f.label ?? f.field_key}:
            </span>
            <InlineFieldControl
              f={f} editable={editable}
              onSave={onSave}
              onSaveStructured={onSaveStructured as never}
              onSaveResponsibility={onSaveResponsibility as never}
            />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4"
      aria-label="The contract">
      <div className="document-paper whitespace-pre-line text-[13.5px] leading-relaxed text-green-950">
        {chunks.map((c, i) => {
          const list = c.heading ? bySection.get(norm(c.heading)) : undefined;
          return (
            <div key={`s${i}`}>
              <ContractBody body={c.text} />
              {list && list.length > 0 && controls(list, c.heading ?? String(i))}
            </div>
          );
        })}
      </div>
      {/* Hers to answer, but belonging to a section the composed document is not
          currently printing — a question whose whole section is gated off, or a
          flat document with no sections at all. It still has to be askable, or she
          could never turn that part of the contract on. */}
      {unplaced.length > 0 && controls(unplaced, 'unplaced')}
    </section>
  );
}
