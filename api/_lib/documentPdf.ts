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
/** An unsigned body still carries its literal {{SIG.*}} tokens — generate_document
 *  leaves `kind = 'signature'` alone because a signature is written when somebody
 *  signs. The working-copy PDF is exactly that document, so it gets the same
 *  treatment the on-screen renderer gives it: the date is a fact we know, the
 *  signature is the one thing we must not invent. */
function resolveUnsignedSignatureTokens(body: string): string {
  const stamp = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  return body
    .replace(/\{\{SIG\.[A-Z_]+\.DATE\}\}/g, stamp)
    .replace(/\{\{SIG\.[A-Z_]+\.(?!DATE)[A-Z_]+\}\}/g, '');
}

export async function renderDocumentPdf(title: string, body: string): Promise<Uint8Array> {
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

  /* ⚠️ THE BOTTOM MARGIN IS MEASURED TO THE BASELINE (owner, 2026-08-24:
     "check out the way this document page break splits the last section and
     signature block — can you get this onto the page above?").

     This test used to be `y < MARGIN + LINE_H`, which reserved a full empty line
     BELOW the last baseline on every page. The declared margin is 46pt but the
     effective bottom margin was 60pt, so every page ran a line short and the
     page was visibly unbalanced — more white at the foot than at the head. A
     baseline sitting exactly on MARGIN puts the descenders ~2pt lower, still
     0.6" clear of the paper edge. Measured across all seven live documents: the
     lowest baseline any of them now reaches is 47pt. */
  const newlineIfNeeded = () => {
    if (y < MARGIN) {
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

  /* ⚠️ KEEP A HEADING WITH ITS CONTENT (owner, 2026-08-24).
     "facility rules doc page 2 has section 11 title on the page but the content
     is on page 3", and earlier the same for sections 8 and 15 of the participant
     release.

     The renderer only ever broke when it RAN OUT of room — `y < MARGIN + LINE_H`
     — so a heading that happened to fit on the last line of a page took it, and
     its first sentence started the next one. Nothing was wrong with any
     individual section; it is where the text happened to fall.

     Nudging one heading would just move the orphan somewhere else, which is why
     the owner's follow-up question ("then check to see if that affected section
     19") is the right one to ask and the wrong one to have to ask. So this is a
     RULE: before drawing a heading, look ahead at what follows it and break
     FIRST unless the heading and the opening of its content fit together. Every
     section is covered, including ones nobody has looked at yet. */
  const KEEP_LINES_WITH_HEADING = 2;
  /* ⚠️ THE SIGNATURE BLOCK IS NEVER ALONE ON A PAGE. Owner, 2026-08-24: "client
     signature block is on its own page as the only item."

     A signature that has drifted away from everything it relates to reads as an
     afterthought on a legal instrument, and no margin is guaranteed to prevent
     it — the measurement above proved a smaller page can cause it as easily as
     cure it. So the block and the closing text before it are laid out as ONE
     group: if they do not fit together, the break happens before the closing
     text, and the last page carries both. */
  const KEEP_LINES_BEFORE_SIGNATURE = 2;
  const isSignatureBlockLine = (t: string) =>
    /^(CLIENT|COMPANY|LESSEE|LESSOR|BUYER|SELLER)$/.test(t.trim())
    || /^(Date|Printed Name|Signature|By \(signature\)|Phone|Email|Title):/.test(t.trim());

  /** Index of the first line of the signature block, or -1. */
  const signatureStart = (() => {
    const ls = body.replace(/\r\n/g, '\n').split('\n');
    for (let k = 0; k < ls.length; k += 1) {
      if (!isSignatureBlockLine(ls[k])) continue;
      // A heading-shaped party word only starts the block when signature lines
      // actually follow — "CLIENT" appears in prose throughout these templates.
      let n = k + 1; let sawField = false;
      while (n < ls.length && n <= k + 4) {
        if (/^(Date|Printed Name|Signature):/.test(ls[n].trim())) { sawField = true; break; }
        n += 1;
      }
      if (sawField) return k;
    }
    return -1;
  })();

  const sourceLines = resolveUnsignedSignatureTokens(body).replace(/\r\n/g, '\n').split('\n');

  /** The vertical space lines [from, to) occupy if drawn as one run, measured
   *  the way `drawLine` will actually draw them. The final line's own advance is
   *  NOT counted: only its BASELINE has to clear the margin, and reserving the
   *  empty line-height beneath it is what pushed the closing group off the page. */
  const measureRun = (from: number, to: number): number => {
    let needed = 0;
    for (let k = from; k < to; k += 1) {
      const t = sourceLines[k];
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

  /* ⚠️ THE CLOSING GROUP INCLUDES THE HEADING THAT INTRODUCES IT.
     The previous rule kept the signature block with the closing sentence but
     stopped there, so on Company Policies it broke between "16. GOVERNING LAW
     AND SEVERABILITY" and the one paragraph under it — the heading was left
     alone at the foot of page 3 and its own content opened page 4. Fixing the
     signature orphan had created a heading orphan four lines above it.

     So the group runs from the heading through the last signature field, and
     the break decision is taken ONCE, at its first line. */
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
    if (raw.trim() === '') {
      y -= LINE_H * 0.5; // blank line = half-line of vertical space
      continue;
    }
    if (i === tailStart && y - measureRun(i, sourceLines.length) < MARGIN) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
    const sig = signatureSplit(raw);
    if (sig) {
      drawSignatureLine(sig[0], sig[1]);
      continue;
    }
    const heading = isHeading(raw);
    const size = heading ? HEADING_SIZE : FONT_SIZE;
    const useFont = heading ? bold : font;
    const headingLines = wrap(raw, useFont, size, maxWidth);

    if (heading) {
      // The next non-blank source line is this heading's content. Measure the
      // opening of it, wrapped exactly as it will be drawn — an estimate would
      // be wrong for precisely the long headings that cause the problem.
      let j = i + 1;
      while (j < sourceLines.length && sourceLines[j].trim() === '') j += 1;
      const followLines = j < sourceLines.length && !isHeading(sourceLines[j])
        ? wrap(sourceLines[j], font, FONT_SIZE, maxWidth) : [];
      const keep = Math.min(KEEP_LINES_WITH_HEADING, followLines.length);
      const needed = headingLines.length * (LINE_H + 2)
        + keep * LINE_H
        + (j > i + 1 ? LINE_H * 0.5 : 0)    // the blank line between them
        - LINE_H;                           // the last kept baseline, not the space under it
      // Break BEFORE the heading rather than after it.
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

/** A filesystem-safe base name from a document title, e.g.
 *  "Participant Liability Release" -> "Participant-Liability-Release". */
export function pdfFileName(title: string): string {
  const base = (title || 'Document')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${base || 'Document'}.pdf`;
}

/** The signer-attributed party-copy filename (owner spec, 2026-08-02), e.g.
 *  "General Visitor Liability Release" + "CJ Z" + 2026-08-02 ->
 *  "General_Visitor_Liability_Release_cjz_08_02_26.pdf". Underscored title,
 *  lowercase signer initials, MM_DD_YY execution date — distinct from
 *  pdfFileName (used by the multi-document/company sends, unchanged). */
export function partyPdfFileName(
  title: string,
  signerFirstName: string | null | undefined,
  signerLastName: string | null | undefined,
  executedAt: Date,
  /** The tenant's own name. Owner, 2026-08-24: "we lost the file name
   *  personalization, the names are generic, it doesnt have our company name nor
   *  the persons name." Optional so the one-argument callers keep working. */
  brandName?: string | null,
): string {
  const slug = (v: string, max: number) => (v || '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
  const base = slug(title || 'Document', 60) || 'Document';
  /* ⚠️ THE PERSON'S NAME, not their initials. The 2026-08-02 spec used lowercase
     initials ("cjz"), which is unreadable in a Downloads folder six months later
     and is what the owner is describing as missing. Full name where we have it,
     falling back to initials, falling back to nothing. */
  const who = slug([signerFirstName, signerLastName].filter(Boolean).join(' '), 40)
    || [signerFirstName, signerLastName].map((n) => (n || '').trim().charAt(0)).join('').toLowerCase();
  const brand = slug(brandName ?? '', 40);
  const mm = String(executedAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(executedAt.getUTCDate()).padStart(2, '0');
  const yy = String(executedAt.getUTCFullYear()).slice(-2);
  // Document first — it is what the reader is looking for; then who signed it,
  // then whose paperwork it is, then when.
  return [base, who, brand, `${mm}_${dd}_${yy}`].filter(Boolean).join('_') + '.pdf';
}
