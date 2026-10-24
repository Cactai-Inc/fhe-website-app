/* documentPdf (client) — the browser surface over the shared PDF core.
 *
 * The layout engine lives in shared/documentPdf.ts, imported by BOTH this file
 * and api/_lib/documentPdf.ts so the in-app "Download PDF" and the emailed copy
 * are byte-for-byte one implementation (they used to be two hand-synced copies
 * that drifted). This file adds only the browser-only piece — triggering a
 * download — which cannot live in the shared core because the api tsconfig has
 * no DOM lib.
 *
 * pdf-lib is pulled in transitively through the shared module; callers should
 * still DYNAMIC-import this file (`await import('../lib/documentPdf')`) so the
 * whole chain code-splits out of the main bundle.
 */
export {
  renderDocumentPdf, pdfFileName, disclosureMarkerSection,
} from '../../shared/documentPdf';
export type {
  DisclosureField, DisclosureEntry, DisclosureEntries,
} from '../../shared/documentPdf';

import { renderDocumentPdf, pdfFileName, type DisclosureEntries } from '../../shared/documentPdf';

/** Render `body` and trigger a browser download named from `title`. */
export async function downloadDocumentPdf(
  title: string, body: string, entries?: DisclosureEntries,
): Promise<void> {
  const bytes = await renderDocumentPdf(title, body, entries);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFileName(title);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
