/* documentPdf (client) — render a document's plain-text merged_body to a PDF in
 * the browser and trigger a download. This is the client twin of
 * api/_lib/documentPdf.ts (same pdf-lib layout) so the in-app "Download PDF"
 * matches the emailed copy. Render-on-demand: the DB merged_body (+ its
 * execution_hash) is the canonical record; the PDF is produced on the fly.
 *
 * This module imports pdf-lib, so callers should DYNAMIC-import it
 * (`await import('../lib/documentPdf')`) — pdf-lib then code-splits out of the
 * main bundle and only loads when a member actually clicks Download.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN = 54; // 0.75"
const FONT_SIZE = 10;
const LINE_H = 14;
const HEADING_SIZE = 11;

function isHeading(line: string): boolean {
  const t = line.trim();
  if (t === '') return false;
  if (/^\d+\.\s+[A-Z]/.test(t)) return true;
  if (t.length <= 60 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true;
  return false;
}

const SIGNATURE_LINE = /^(\s*(?:Signature|By \(signature\)):\s*)(.+)$/;
function signatureSplit(line: string): [string, string] | null {
  const m = SIGNATURE_LINE.exec(line);
  return m ? [m[1], m[2]] : null;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (text === '') return [''];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur === '' ? w : `${cur} ${w}`;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      cur = trial;
    } else {
      if (cur !== '') lines.push(cur);
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let chunk = '';
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        cur = chunk;
      } else {
        cur = w;
      }
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

/** Render one document body to PDF bytes. The body already carries the title;
 *  the title param is kept for signature parity with the server twin. */
export async function renderDocumentPdf(_title: string, body: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const maxWidth = PAGE_W - MARGIN * 2;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newlineIfNeeded = () => {
    if (y < MARGIN + LINE_H) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };
  const drawLine = (text: string, whichFont: PDFFont, size: number) => {
    newlineIfNeeded();
    if (text !== '') {
      page.drawText(text, { x: MARGIN, y, size, font: whichFont, color: rgb(0.1, 0.12, 0.1) });
    }
    y -= size === HEADING_SIZE ? LINE_H + 2 : LINE_H;
  };
  const drawSignatureLine = (label: string, value: string) => {
    newlineIfNeeded();
    const labelW = font.widthOfTextAtSize(label, FONT_SIZE);
    page.drawText(label, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0.1, 0.12, 0.1) });
    page.drawText(value, { x: MARGIN + labelW, y: y - 1, size: FONT_SIZE + 3, font: italic, color: rgb(0.12, 0.14, 0.28) });
    y -= LINE_H + 2;
  };

  for (const raw of (body || '').replace(/\r\n/g, '\n').split('\n')) {
    if (raw.trim() === '') { y -= LINE_H * 0.5; continue; }
    const sig = signatureSplit(raw);
    if (sig) { drawSignatureLine(sig[0], sig[1]); continue; }
    const heading = isHeading(raw);
    const size = heading ? HEADING_SIZE : FONT_SIZE;
    const useFont = heading ? bold : font;
    for (const wrapped of wrap(raw, useFont, size, maxWidth)) drawLine(wrapped, useFont, size);
  }

  return pdf.save();
}

export function pdfFileName(title: string): string {
  const base = (title || 'Document').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return `${base || 'Document'}.pdf`;
}

/** Render `body` and trigger a browser download named from `title`. */
export async function downloadDocumentPdf(title: string, body: string): Promise<void> {
  const bytes = await renderDocumentPdf(title, body);
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
