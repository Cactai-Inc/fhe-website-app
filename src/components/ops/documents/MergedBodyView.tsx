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
import { resolveUnsignedSignatureTokens } from '../../../lib/documentBody';

export interface MergedBodyViewProps {
  /** The already-merged contract body. Null/empty when nothing was generated. */
  body: string | null;
  className?: string;
}

/**
 * A signature line in the merged plain text, e.g.
 *   "Signature: Jane Doe"  or  "By (signature): Jane Doe"
 * The stored text is NEVER altered — this is display-time styling only.
 */
const SIGNATURE_LINE = /^(Signature|By \(signature\)):\s*(.+)$/;

/**
 * Render the merged plain-text body with signature values styled in a script
 * face. Non-signature lines pass through untouched (whitespace preserved by
 * the surrounding pre-wrap container).
 *
 * Exported because three surfaces render a body WITHOUT going through
 * `ContractBody`: the onboarding signing step (pages/app/Onboarding.tsx), the
 * ops document viewer (via `MergedBodyView` below), and the paper reader on
 * /app/documents (`PaperViewer` in components/app/DocumentsContent.tsx).
 * (It also used to serve the kiosk confirmation, Release.tsx — that page was
 * retired by TASK-SIGNFLOW-D and no longer exists.)
 *
 * 🔒 SO THIS IS THE SECOND OF THE APP'S TWO UNSIGNED-TOKEN RESOLUTION POINTS,
 * `ContractBody` being the first. CR-101: those three surfaces showed a reader
 * the literal {{SIG.CLIENT.NAME}} / {{SIG.CLIENT.DATE}} on a document they were
 * being asked to sign, because the resolution lived only in the other renderer.
 * Resolving HERE fixes all three at once, and both points call the same function.
 *
 * ⚠️ An unsigned "Signature: {{SIG.CLIENT.NAME}}" resolves to "Signature: " —
 * `SIGNATURE_LINE`'s `(.+)` then finds nothing to capture, so the line falls
 * through as plain text with no script face. THAT IS CORRECT: there is no name
 * to set in a signature hand yet. Do not "fix" it.
 */
export function BodyWithSignatures({ text }: { text: string }) {
  const lines = resolveUnsignedSignatureTokens(text).split('\n');
  return (
    <>
      {lines.map((line, i) => {
        const m = SIGNATURE_LINE.exec(line);
        const rendered = m ? (
          <>
            {m[1]}: <span className="signature-script">{m[2]}</span>
          </>
        ) : (
          line
        );
        return (
          <span key={i}>
            {rendered}
            {i < lines.length - 1 ? '\n' : null}
          </span>
        );
      })}
    </>
  );
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
      {/* Read-only: whitespace-preserved plain text, no inputs, no editing.
          Signature values are styled (display-only) in a script face. */}
      <pre className="whitespace-pre-wrap break-words font-serif text-sm leading-relaxed text-green-900">
        <BodyWithSignatures text={text} />
      </pre>
    </article>
  );
}
