/* documentBody — display-time repairs to a document's plain-text body.
 *
 * Pure string → string. No React, no DOM, no network. It lives here because
 * three different kinds of consumer need the identical transform: the on-screen
 * body renderers (`ContractBody` in components/app/ContractCascade.tsx and
 * `BodyWithSignatures` in components/ops/documents/MergedBodyView.tsx) and the
 * client PDF writer (lib/documentPdf.ts).
 *
 * ⚠️ NOTHING HERE IS EVER STORED. The stored `documents.merged_body` keeps its
 * literal tokens; this only changes what a person is shown.
 *
 * ⚠️ api/_lib/documentPdf.ts KEEPS ITS OWN COPY ON PURPOSE. The `api` and `src`
 * tsconfig projects share no module — see the note at the top of
 * lib/documentPdf.ts — so the server twin cannot import this file. A change to
 * the behaviour below MUST be made there too.
 */

/* ⚠️ AN UNSIGNED DOCUMENT MUST NOT SHOW ITS SIGNATURE TOKENS.
   Owner, 2026-08-24: "on the signable docs we dont need to show the date token we
   should show the actual date and we shouldnt show anything in the signature
   space its showing the signature token there."

   `generate_document` substitutes every token EXCEPT `kind = 'signature'` — on
   purpose: a signature is written by `record_signature` at the moment somebody
   signs, not composed in advance. So an unsigned body carries the literal
   {{SIG.CLIENT.NAME}} and {{SIG.CLIENT.DATE}} until then, and the reader was
   being shown the machinery.

   Two different answers, because they are two different things:
     · the DATE is a fact we already know — this document is being signed today —
       so it renders as today's date, in the same "August 24, 2026" shape
       generate_document produces, so nothing changes appearance on execution;
     · the SIGNATURE is the one thing we must NOT invent. It renders as empty
       space, which is what an unsigned signature line is.

   Only ever touches tokens that are still literal. Once signed, the body holds
   the real name and date and there is nothing here left to match. */
const UNSIGNED_SIG_DATE = /\{\{SIG\.[A-Z_]+\.DATE\}\}/g;
const UNSIGNED_SIG_NAME = /\{\{SIG\.[A-Z_]+\.(?!DATE)[A-Z_]+\}\}/g;

export function resolveUnsignedSignatureTokens(body: string, today = new Date()): string {
  const stamp = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return body.replace(UNSIGNED_SIG_DATE, stamp).replace(UNSIGNED_SIG_NAME, '');
}
