/* documentPdf — render a document's plain-text merged_body to a clean PDF.
 *
 * The contract bodies are plain text (sections separated by blank lines). We lay
 * them out with pdf-lib (pure JS — no headless browser, serverless-safe): a
 * standard serif face, word-wrapped to the page width, with automatic
 * pagination. Section headings (short ALL-CAPS / numbered lines) are rendered in
 * bold. This is deliberately simple, matching the plain-text nature of the
 * documents; it is not an HTML renderer.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN = 54; // 0.75"
const FONT_SIZE = 10;
const LINE_H = 14;
const HEADING_SIZE = 11;

/** A line that reads as a section heading: a numbered heading ("6. TITLE") or a
 *  short ALL-CAPS label. Used only to pick the bold font — never alters text. */
function isHeading(line: string): boolean {
  const t = line.trim();
  if (t === '') return false;
  if (/^\d+\.\s+[A-Z]/.test(t)) return true; // "6. RULES AND CONDUCT"
  if (t.length <= 60 && t === t.toUpperCase() && /[A-Z]/.test(t)) return true; // "PARTICIPANT INFORMATION"
  return false;
}

/** A signature line: "Signature: Jane Doe" / "By (signature): Jane Doe". The
 *  VALUE after the label is rendered in a script-style (italic) face so the PDF
 *  matches the emailed copy's signature styling (owner: signatures must look
 *  signed, not typed). Returns the [label, value] split, or null. */
const SIGNATURE_LINE = /^(\s*(?:Signature|By \(signature\)):\s*)(.+)$/;
function signatureSplit(line: string): [string, string] | null {
  const m = SIGNATURE_LINE.exec(line);
  return m ? [m[1], m[2]] : null;
}

/** Greedy word-wrap `text` to fit `maxWidth` at `size` using `font`. */
function wrap(text: string, font: import('pdf-lib').PDFFont, size: number, maxWidth: number): string[] {
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
      // a single word longer than the line: hard-break it
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

/** Render one document body to a PDF, returned as bytes (Uint8Array). */
export async function renderDocumentPdf(title: string, body: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic); // signature script
  const maxWidth = PAGE_W - MARGIN * 2;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newlineIfNeeded = () => {
    if (y < MARGIN + LINE_H) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  const drawLine = (text: string, whichFont: import('pdf-lib').PDFFont, size: number) => {
    newlineIfNeeded();
    if (text !== '') {
      page.drawText(text, { x: MARGIN, y, size, font: whichFont, color: rgb(0.1, 0.12, 0.1) });
    }
    y -= size === HEADING_SIZE ? LINE_H + 2 : LINE_H;
  };

  // Draw a signature line: label in the normal face, the signed name in italic
  // (script-style), a bit larger — matching the emailed copy's signature look.
  const drawSignatureLine = (label: string, value: string) => {
    newlineIfNeeded();
    const labelW = font.widthOfTextAtSize(label, FONT_SIZE);
    page.drawText(label, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0.1, 0.12, 0.1) });
    page.drawText(value, {
      x: MARGIN + labelW,
      y: y - 1,
      size: FONT_SIZE + 3,
      font: italic,
      color: rgb(0.12, 0.14, 0.28),
    });
    y -= LINE_H + 2;
  };

  const sourceLines = body.replace(/\r\n/g, '\n').split('\n');
  for (const raw of sourceLines) {
    if (raw.trim() === '') {
      y -= LINE_H * 0.5; // blank line = half-line of vertical space
      continue;
    }
    const sig = signatureSplit(raw);
    if (sig) {
      drawSignatureLine(sig[0], sig[1]);
      continue;
    }
    const heading = isHeading(raw);
    const size = heading ? HEADING_SIZE : FONT_SIZE;
    const useFont = heading ? bold : font;
    for (const wrapped of wrap(raw, useFont, size, maxWidth)) {
      drawLine(wrapped, useFont, size);
    }
  }

  return pdf.save();
}

/** A filesystem-safe base name from a document title, e.g.
 *  "Participant Liability Release" -> "Participant-Liability-Release". */
export function pdfFileName(title: string): string {
  const base = (title || 'Document')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'Document'}.pdf`;
}
