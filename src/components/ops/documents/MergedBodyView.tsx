/**
 * OPS-DOC-VIEW — read-only renderer for a document's merged contract body.
 *
 * The body arrives already token-merged (tenant-correct) from the
 * `generate_document` RPC and is stored on `documents.merged_body`. This
 * component is PURELY presentational and READ-ONLY: it renders the text of the
 * contract inside a non-interactive region. There is deliberately NO editable
 * field, form, or input here — a merged contract body is immutable from the
 * viewer's perspective (edits happen upstream via template/merge, not here).
 */
export interface MergedBodyViewProps {
  /** The already-merged contract body. Null/empty when nothing was generated. */
  body: string | null;
  className?: string;
}

export function MergedBodyView({ body, className }: MergedBodyViewProps) {
  const text = (body ?? '').trim();

  if (!text) {
    return (
      <div
        className={`rounded-lg border border-green-800/15 bg-white/60 p-6 text-sm text-green-800/70 ${className ?? ''}`}
        data-testid="merged-body-empty"
      >
        No merged body has been generated for this document yet.
      </div>
    );
  }

  return (
    <article
      className={`rounded-lg border border-green-800/15 bg-white/60 p-6 ${className ?? ''}`}
      aria-label="Merged contract body"
      data-testid="merged-body"
    >
      {/* Read-only: whitespace-preserved plain text, no inputs, no editing. */}
      <pre className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed text-green-900">
        {text}
      </pre>
    </article>
  );
}
