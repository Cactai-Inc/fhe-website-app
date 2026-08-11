import { useState } from 'react';
import { ContractBody } from './ContractCascade';

/**
 * FLAT DOCUMENT — the body renderer for a document with no clause structure.
 *
 * TASK ONEAUTHOR. The one authoring page keeps everything AROUND the document —
 * drawers, history, parties, send, signing — and chooses only the body renderer:
 *
 *   structure present → <ClauseDocument>   (fields, clauses, Add New Item)
 *   structure null    → <FlatDocument>     (this: read/verify the composed text)
 *
 * `ContractPage.tsx:498` already produced that null: `contract_template_structure`
 * returns zero sections for a flat template and the page stores null. What was
 * missing was a renderer that occupies the same slot. Fourteen of the twenty
 * active templates are flat, so this is the majority case, not the fallback.
 *
 * It is READ-ONLY BY CONSTRUCTION, and that is a property of the document rather
 * than a decision made here: a flat template has no `contract_field_defs`, so
 * there is nothing to author. Any field a flat document does carry is rendered by
 * the page's own grouped-field sections ABOVE this — fill the fields, then read
 * what they composed.
 *
 * It reuses `ContractBody`, the SAME renderer the read-only and executed frames
 * use, so one document does not change appearance as it moves through its states.
 * (`MergedBodyView` in components/ops/documents is the other renderer in the
 * codebase; it styles signature lines but not the `NEEDS:` marks that tell an
 * author what is still unfilled, so it is the weaker of the two here.)
 *
 * COLLAPSIBLE, EXPANDED BY DEFAULT. A release runs to 12,000 characters and can
 * push the signature block off the bottom of a long page, so it folds — but it
 * opens showing the document, because you sign what you see.
 */
export function FlatDocument({
  body, title, defaultOpen = true,
}: {
  body: string | null;
  /** The document's own name, so the disclosure reads as the document rather
   *  than as a generic "Review the document text" control. */
  title?: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Nothing composed yet. Say so plainly rather than rendering an empty frame —
  // a card around nothing is the same defect as a drawer that can never fill.
  if (!body || !body.trim()) {
    return (
      <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
        <p className="text-sm text-muted">
          This document has no composed text yet. It appears once the document is generated.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-green-800/10 rounded-lg p-5 mb-4">
      <button type="button" aria-expanded={open}
        className="font-serif text-green-800 underline-offset-4 hover:underline"
        onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'Show'} {title?.trim() || 'the document'}
      </button>
      {open && (
        <div className="document-paper mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-green-950">
          <ContractBody body={body} />
        </div>
      )}
    </section>
  );
}
