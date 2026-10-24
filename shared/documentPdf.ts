/* documentPdf (shared core) — render a document's plain-text merged_body to a
 * clean PDF with pdf-lib (pure JS — no headless browser, serverless-safe).
 *
 * ONE module, imported by BOTH the client (src/lib/documentPdf.ts) and the
 * server (api/_lib/documentPdf.ts). It previously existed as two hand-synced
 * copies that had already drifted (margins, an inline signature-token resolver,
 * type syntax). To make one module compile under both tsconfig projects, the
 * folder `shared/` is added to the `include` of tsconfig.app.json AND
 * tsconfig.api.json. Constraints this module HONORS so it typechecks in both:
 *   - no DOM (api lib is ES2020 only): no Blob, document, URL — those stay in the
 *     client wrapper; this core returns bytes.
 *   - no Node globals (app has no "node" types): pdf-lib only, which is pure JS.
 *   - app strictness (noUnusedLocals/Parameters) is the stricter bar; satisfy it.
 * Surface-specific helpers (browser download; signer-attributed party filename)
 * stay in the per-project files and import from here.
 *
 * Layout is deliberately plain-text with professional pagination; it is NOT an
 * HTML renderer. The one structured element is the disclosure block: where a
 * section's disclosed entries belong, merged_body carries a readable text block
 * followed by a DISCLOSURE MARKER line. The marker never prints: this renderer
 * draws the entries as boxes from the document's stored structured field values
 * (passed in `entries`), and every text surface drops the marker line.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont } from 'pdf-lib';

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
/* 0.64" — reduced from 0.75" on 2026-08-24. Owner: "lets reduce the size of the
   margins to make it so the signature fits on the last page with content."
   Measured, not guessed: at this value Company Policies drops from four pages to
   three and its signature block joins the content page. Still a proper legal
   margin — well clear of the 0.5" most print shops treat as the floor.
   ⚠️ MARGIN ALONE DOES NOT DELIVER THE GOAL. Measuring all four onboarding
   documents showed the reduction fixing Company Policies and BREAKING Human
   Emergency Medical — pulling more body onto earlier pages left its signature
   block alone on the last one, which it had not been at 0.75". Shrinking the
   page is a coin flip; the guarantee is the keep-group rule below. */
const MARGIN = 46;
const FONT_SIZE = 10;
const LINE_H = 14;
const HEADING_SIZE = 11;

// ─── Disclosure markers ──────────────────────────────────────────────────────
// A disclosed section's body in merged_body is wrapped as:
//     [[DISCLOSURE:KNOWN_CONDITIONS]]
//     <readable "Entry N: Label: value" text block — the fallback>
//     [[/DISCLOSURE]]
// Neither marker ever prints. A surface that can render the structured entries
// (the PDF here; the on-screen boxed component) draws boxes from the document's
// stored structured field value and DROPS the text block between the markers. A
// surface that cannot (the executed-snapshot text, any plain reader) drops only
// the two marker lines and keeps the readable text block. Kept in sync with
// src/lib/disclosureMarker.ts (screen side).
// Tolerate trailing punctuation/whitespace: the clause composer appends a
// sentence-terminal "." to the last line of a clause body, which lands on the
// close marker ("[[/DISCLOSURE]]."). Match the marker regardless.
const DISCLOSURE_OPEN = /^\[\[DISCLOSURE:([A-Z_]+)\]\][.\s]*$/;
const DISCLOSURE_CLOSE = /^\[\[\/DISCLOSURE\]\][.\s]*$/;
export function disclosureMarkerSection(line: string): string | null {
  const m = DISCLOSURE_OPEN.exec(line.trim());
  return m ? m[1] : null;
}
export function isDisclosureClose(line: string): boolean {
  return DISCLOSURE_CLOSE.test(line.trim());
}

/** One disclosure entry = ordered [label, value] pairs (value '' when empty). */
export type DisclosureField = { label: string; value: string };
export type DisclosureEntry = DisclosureField[];
/** section key (e.g. 'KNOWN_CONDITIONS') -> its entries, in record order. */
export type DisclosureEntries = Record<string, DisclosureEntry[]>;

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
 *  matches the emailed copy's signature styling. Returns [label, value], or null. */
const SIGNATURE_LINE = /^(\s*(?:Signature|By \(signature\)):\s*)(.+)$/;
function signatureSplit(line: string): [string, string] | null {
  const m = SIGNATURE_LINE.exec(line);
  return m ? [m[1], m[2]] : null;
}

/** Greedy word-wrap `text` to fit `maxWidth` at `size` using `font`. */
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

/** An unsigned body still carries its literal {{SIG.*}} tokens. The date is a
 *  fact we know (today); the signature is the one thing we must not invent (it
 *  renders empty). THE ONE copy for the whole app — the client screen renderers
 *  reach it through src/lib/documentBody.ts, which only adds the `today` seam. */
export function resolveUnsignedSignatureTokens(body: string, today: Date = new Date()): string {
  const stamp = today.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  return body
    .replace(/\{\{SIG\.[A-Z_]+\.DATE\}\}/g, stamp)
    .replace(/\{\{SIG\.[A-Z_]+\.(?!DATE)[A-Z_]+\}\}/g, '');
}

/** Render one document body to a PDF, returned as bytes (Uint8Array).
 *  `entries` supplies the structured disclosure data drawn at each marker; omit
 *  it and markers simply render nothing (the readable text block above the marker
 *  stays, which is the fallback for any caller without the structured data). */
export async function renderDocumentPdf(
  title: string, body: string, entries?: DisclosureEntries,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic); // signature script
  const maxWidth = PAGE_W - MARGIN * 2;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  // Document title — centered heading at the very top, then a little gap.
  const titleText = (title || 'Document').trim();
  if (titleText) {
    const TITLE_SIZE = 16;
    const tw = bold.widthOfTextAtSize(titleText, TITLE_SIZE);
    page.drawText(titleText, {
      x: Math.max(MARGIN, (PAGE_W - tw) / 2),
      y, size: TITLE_SIZE, font: bold, color: rgb(0.1, 0.12, 0.1),
    });
    y -= TITLE_SIZE + 10;
  }

  /* ⚠️ THE BOTTOM MARGIN IS MEASURED TO THE BASELINE (owner, 2026-08-24). A
     baseline sitting exactly on MARGIN puts the descenders ~2pt lower, still
     0.6" clear of the paper edge. */
  const newlineIfNeeded = () => {
    if (y < MARGIN) {
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
    page.drawText(value, {
      x: MARGIN + labelW, y: y - 1, size: FONT_SIZE + 3, font: italic,
      color: rgb(0.12, 0.14, 0.28),
    });
    y -= LINE_H + 2;
  };

  // ─── Disclosure entry boxes ────────────────────────────────────────────────
  // Each field is its own outlined box with its label (small, muted) above the
  // value; boxes flow left-to-right and wrap to the next row; empty fields draw
  // as empty boxes; entries are separated by a gap and a thin rule. Professional
  // styling independent of the screen component.
  const BOX_GAP = 6;        // gap between boxes and between rows
  const BOX_PAD = 4;        // inner padding of a box
  const LABEL_SIZE = 7;
  const VALUE_SIZE = 9;
  const ENTRY_GAP = 8;      // vertical gap + rule between entries
  // Measure one field box: its width (clamped to the content width) and height.
  const measureBox = (f: DisclosureField) => {
    const valLines = wrap(f.value || '', font, VALUE_SIZE, maxWidth - BOX_PAD * 2);
    const w = Math.min(
      maxWidth,
      Math.max(
        bold.widthOfTextAtSize(f.label, LABEL_SIZE),
        ...valLines.map((l) => font.widthOfTextAtSize(l, VALUE_SIZE)),
        40,
      ) + BOX_PAD * 2,
    );
    const h = BOX_PAD + LABEL_SIZE + 2 + valLines.length * (VALUE_SIZE + 2) + BOX_PAD;
    return { valLines, w, h };
  };
  // Draw one field box with its TOP-LEFT at (bx, topY) and the given size.
  const drawBox = (f: DisclosureField, bx: number, topY: number, w: number, h: number, valLines: string[]) => {
    page.drawRectangle({
      x: bx, y: topY - h, width: w, height: h,
      borderColor: rgb(0.78, 0.8, 0.78), borderWidth: 0.75, color: rgb(0.985, 0.99, 0.985),
    });
    page.drawText(f.label, {
      x: bx + BOX_PAD, y: topY - BOX_PAD - LABEL_SIZE,
      size: LABEL_SIZE, font: bold, color: rgb(0.42, 0.46, 0.42),
    });
    valLines.forEach((vl, vi) => {
      page.drawText(vl, {
        x: bx + BOX_PAD, y: topY - BOX_PAD - LABEL_SIZE - 2 - vi * (VALUE_SIZE + 2) - VALUE_SIZE,
        size: VALUE_SIZE, font, color: rgb(0.1, 0.12, 0.1),
      });
    });
  };
  const drawDisclosureEntries = (section: string) => {
    const list = entries?.[section] ?? [];
    if (list.length === 0) return;
    y -= 2;
    list.forEach((entry, idx) => {
      if (idx > 0) {
        // thin separator rule between entries
        if (y - ENTRY_GAP < MARGIN) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
        y -= ENTRY_GAP / 2;
        page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: rgb(0.85, 0.87, 0.85) });
        y -= ENTRY_GAP / 2;
      }
      // Lay the entry's boxes out in wrapping rows. A row's height is the tallest
      // box in it; y advances by that height. Page-break BEFORE a row that would
      // not fit, so a box is never split.
      let i = 0;
      while (i < entry.length) {
        // pack boxes into this row until the width runs out
        const row: { f: DisclosureField; w: number; h: number; valLines: string[] }[] = [];
        let rowW = 0;
        while (i < entry.length) {
          const m = measureBox(entry[i]);
          const add = (row.length === 0 ? 0 : BOX_GAP) + m.w;
          if (row.length > 0 && rowW + add > maxWidth) break;
          row.push({ f: entry[i], ...m });
          rowW += add;
          i += 1;
        }
        const rowH = Math.max(...row.map((b) => b.h));
        if (y - rowH < MARGIN) { page = pdf.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; }
        let bx = MARGIN;
        for (const b of row) {
          drawBox(b.f, bx, y, b.w, b.h, b.valLines);
          bx += b.w + BOX_GAP;
        }
        y -= rowH + BOX_GAP;
      }
    });
    y -= 2;
  };

  const KEEP_LINES_WITH_HEADING = 2;
  const KEEP_LINES_BEFORE_SIGNATURE = 2;
  const isSignatureBlockLine = (t: string) =>
    /^(CLIENT|COMPANY|LESSEE|LESSOR|BUYER|SELLER)$/.test(t.trim())
    || /^(Date|Printed Name|Signature|By \(signature\)|Phone|Email|Title):/.test(t.trim());

  const sourceLines = resolveUnsignedSignatureTokens(body).replace(/\r\n/g, '\n').split('\n');

  const signatureStart = (() => {
    for (let k = 0; k < sourceLines.length; k += 1) {
      if (!isSignatureBlockLine(sourceLines[k])) continue;
      let n = k + 1; let sawField = false;
      while (n < sourceLines.length && n <= k + 4) {
        if (/^(Date|Printed Name|Signature):/.test(sourceLines[n].trim())) { sawField = true; break; }
        n += 1;
      }
      if (sawField) return k;
    }
    return -1;
  })();

  const measureRun = (from: number, to: number): number => {
    let needed = 0;
    for (let k = from; k < to; k += 1) {
      const t = sourceLines[k];
      if (disclosureMarkerSection(t) !== null) {
        // skip the whole disclosure region; boxes are measured at draw time
        k += 1;
        while (k < to && !isDisclosureClose(sourceLines[k])) k += 1;
        continue;
      }
      if (isDisclosureClose(t)) continue;
      if (t.trim() === '') { needed += LINE_H * 0.5; continue; }
      if (signatureSplit(t)) { needed += LINE_H + 2; continue; }
      const h = isHeading(t);
      needed += wrap(t, h ? bold : font, h ? HEADING_SIZE : FONT_SIZE, maxWidth).length
        * (h ? LINE_H + 2 : LINE_H);
    }
    let last = to - 1;
    while (last >= from && sourceLines[last].trim() === '') last -= 1;
    if (last >= from) {
      const t = sourceLines[last];
      needed -= (signatureSplit(t) || isHeading(t)) ? LINE_H + 2 : LINE_H;
    }
    return needed;
  };

  const tailStart = (() => {
    if (signatureStart < 0) return -1;
    let k = signatureStart - 1;
    let kept = 0;
    let first = signatureStart;
    while (k >= 0 && kept < KEEP_LINES_BEFORE_SIGNATURE) {
      if (sourceLines[k].trim() !== '') { kept += 1; first = k; }
      k -= 1;
    }
    while (k >= 0 && sourceLines[k].trim() === '') k -= 1;
    if (k >= 0 && isHeading(sourceLines[k])) first = k;
    return first;
  })();

  for (let i = 0; i < sourceLines.length; i += 1) {
    const raw = sourceLines[i];
    const markerSection = disclosureMarkerSection(raw);
    if (markerSection !== null) {
      // Draw boxes from the stored structured entries, then skip the readable
      // text block (the fallback) through to the closing marker. Both markers and
      // the block between are replaced by the boxes here.
      drawDisclosureEntries(markerSection);
      i += 1;
      while (i < sourceLines.length && !isDisclosureClose(sourceLines[i])) i += 1;
      continue; // i now at the close marker (or end); loop's ++ steps past it
    }
    if (isDisclosureClose(raw)) continue; // stray close — never prints
    if (raw.trim() === '') {
      y -= LINE_H * 0.5; // blank line = half-line of vertical space
      continue;
    }
    if (i === tailStart && y - measureRun(i, sourceLines.length) < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    const sig = signatureSplit(raw);
    if (sig) { drawSignatureLine(sig[0], sig[1]); continue; }
    const heading = isHeading(raw);
    const size = heading ? HEADING_SIZE : FONT_SIZE;
    const useFont = heading ? bold : font;
    const headingLines = wrap(raw, useFont, size, maxWidth);

    if (heading) {
      let j = i + 1;
      while (j < sourceLines.length && sourceLines[j].trim() === '') j += 1;
      const followLines = j < sourceLines.length && !isHeading(sourceLines[j])
        && disclosureMarkerSection(sourceLines[j]) === null
        ? wrap(sourceLines[j], font, FONT_SIZE, maxWidth) : [];
      const keep = Math.min(KEEP_LINES_WITH_HEADING, followLines.length);
      const needed = headingLines.length * (LINE_H + 2)
        + keep * LINE_H
        + (j > i + 1 ? LINE_H * 0.5 : 0)
        - LINE_H;
      if (keep > 0 && y - needed < MARGIN) {
        page = pdf.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
    }

    for (const wrapped of headingLines) {
      drawLine(wrapped, useFont, size);
    }
  }

  return pdf.save();
}

/** A filesystem-safe base name from a document title. */
export function pdfFileName(title: string): string {
  const base = (title || 'Document')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'Document'}.pdf`;
}
