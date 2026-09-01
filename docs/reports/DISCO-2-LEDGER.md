# DISCO-2 — LEDGER

Subject: the doc-signing flow — CR-100 (address normalize/validate), CR-101 (date/signature tokens
still visible), CR-102 (brown → company green). Opened 2026-09-01 on the owner's prompt: read
CHANGE-ORDER-LEDGER §CR-100–102 and run them.

## RESUME
Role / thread   DISCO-2 · canonical checkout (docs only; no code, no writes)
Merge-base      n/a — docs-only thread on main (main == origin/main at open, 2fa1f7b9)
DONE            steps 1-3 COMPLETE on all three CRs. All locks in. Handoff written:
                docs/reports/DISCO-2-HANDOFF.md. Owner's CR-102 ruling appended verbatim to
                CHANGE-ORDER-LEDGER.md §CR-102.
IN FLIGHT       nothing — complete, nothing in flight
NEXT            owner carries the ticket to DSNR (prompt handed). This thread stays open for
                follow-ups on the signing-flow subject.
DECIDED         🔒 CR-100 NORMALIZE-ONLY (owner, mid-run: "just normalize the inputs dont want to
                setup google api for paid lookup functionality"). 🔒 CR-102 scope = decorative vs
                functional rule, APP-WIDE, not signing-flow-only (owner's verbatim in
                CHANGE-ORDER-LEDGER §CR-102: decorative accents — avatar ring, nav selected state,
                notification count — keep gold; functional action elements, icons, text → green).
                🔒 Validation criteria for all three agreed as proposed ("agree").
CORRECTED       DISCO framed CR-102 as "flow only vs app-wide gold→green" — both wrong; the owner's
                rule is by FUNCTION, not by surface. Recorded in the handoff §Item 3.
DO NOT          do not treat CR-101 as a regression — the 8-24 fix never reverted; it merged and
                still sits in ContractBody. The defect is UNREACHED PATHS (D17), see §CR-101.

## CAPTURE (verbatim already in docs/reference/CHANGE-ORDER-LEDGER.md §CR-100/101/102)
- CR-100: "we need the address fields to normalize the inputs, when i enter my address, 752
  windemere ct san diego ca 92109, it stays looking like that it should normalize to capitalize and
  it should make sure its a valid address somehow."
- CR-101: "noticed that the docs in the signing flow still show the tokens for date and signature,
  we previously ran a task thread that was supposed to remove the visibility of the signature token
  and insert the real date rather than show the token."
- CR-102: "change the brown used on the things like icons, strikethru, checkmarks, text, boarders,
  highlights, and buttons in the doc signing flow to the company green color."

---

## CR-101 — THE TRACE (done first; it was the claimed regression)

The prior fix EXISTS and MERGED. Commit 71993bb2 (2026-08-24, "docs: an unsigned document stops
showing its signature machinery") — carries the owner's 8-24 quote verbatim. It touched exactly two
files: src/components/app/ContractCascade.tsx (added resolveUnsignedSignatureTokens: SIG.*.DATE →
today's date in "August 24, 2026" shape; SIG.*.NAME etc → empty) and api/_lib/documentPdf.ts.
src/lib/documentPdf.ts also carries its own private copy (line 89). Never reverted:
resolveUnsignedSignatureTokens is applied inside ContractBody (ContractCascade.tsx:322).

WHO IS COVERED: every renderer that goes through ContractBody — ContractPage merged-body frames
(1795/2195/2215), FlatDocument, PartyDocumentView. The comment at ContractCascade.tsx:319 claims
"every frame that shows a document body comes through here." THAT CLAIM IS FALSE. Three readers
render documents.merged_body WITHOUT ContractBody, so the literal {{SIG.*}} tokens show:

1. src/pages/app/Onboarding.tsx:1963 — the onboarding signing flow's inline reader renders
   <BodyWithSignatures text={body}> (imported from ops MergedBodyView), body = merged_body raw.
   THIS IS "the docs in the signing flow." BodyWithSignatures only styles already-signed
   "Signature: Name" lines; it never resolves tokens.
2. src/components/app/DocumentsContent.tsx:167 (PaperViewer) — the "Read" reader used by
   /app/documents and the Account panel renders {doc.pages[page]} — raw text, no token
   resolution, not even the signature script-face styling.
3. src/pages/app/ops/DocumentViewerPage.tsx:200 via MergedBodyView — the staff doc viewer,
   same gap.

So: NOT a regression, an UNREACHED FIX (D17 pattern, exactly as the CR-101 ledger entry warned).
It was not TASK-SIGNSTRIP (that was the catalog block — confirmed different scope).

Signing freeze: the fix is display-time only (resolveUnsignedSignatureTokens only matches
still-literal tokens; an executed body holds real values and nothing matches). Extending the same
resolution to the three readers touches no stored document — D32/D33 safe. Kiosk Release.tsx uses
BodyWithSignatures on an EXECUTED body (real values) — unaffected either way.

PROPOSED VALIDATION CRITERIA (to agree with owner): open an UNSIGNED doc in (a) the onboarding
reader, (b) the Documents "Read" paper viewer, (c) the ops document viewer — no {{SIG...}} anywhere;
the date position shows today's date in "September 1, 2026" shape; the signature space is empty.
Open an EXECUTED doc in all three — unchanged, real name in script face, real date.

## CR-100 — ADDRESS NORMALIZE (🔒 normalize-only per owner's mid-run ruling)

THE INCUMBENT (D18): src/lib/normalize.ts + useFieldNormalizer (src/lib/formState.ts) — the CR-83/84
on-blur idiom: normalize on blur, in front of the person, save after normalizing, never re-correct
a deliberate edit (lastOutput guard), never touch DB-loaded values. Kinds today: name | phone |
email. normalizeKindForField() derives kind from field name (email/phone/name substrings), which is
how ContactDossierModal auto-wires — address fields return null today.

WHERE ADDRESS INPUTS LIVE (all structured street/line2/city/state/zip; contact record is the
source of truth, D22; contracts compose {{...ADDRESS}} via compose_address — nothing types an
address into a contract twice):
1. Onboarding.tsx:1601-1614 (address_street/city/state/zip) — NO normalize on any of the four
   (name/phone/email on the same page all have it). This is where "752 windemere ct" stays as typed.
2. SignStart.tsx:640-705, deal branch only — line1/line2/city/state/zip; state already
   .toUpperCase()s on change (the only address normalization in the app); street/city/zip raw.
3. ContactDossierModal FIELD_GROUPS "Mailing address" (address_line1/2, city, state, postal_code,
   country) — auto-wired through normalizeKindForField, so extending THAT function covers the
   dossier with zero call-site edits (the FIX4 §4 design paying off).
4. CaptureInfoModal / StableEditors — no address fields.

SHAPE THAT FITS THE INCUMBENT (for DSNR, not re-opened with owner): add address kinds to
normalize.ts — street/city word-capitalize under the CR-83 rules (a word already carrying a capital
is never touched, so "McAllister Ave" survives); state → 2-letter uppercase; ZIP left as typed
unless it is recognizably 5 or 5+4 digits (the normalizePhone precedent: format what is
recognizable, never mangle what is not). "Valid somehow" = these format-level shapes only — 🔒 no
external lookup (owner, mid-run). Owner's example becomes: 752 Windemere Ct · San Diego · CA · 92109.

PROPOSED VALIDATION CRITERIA: type the owner's example lowercase into (a) onboarding details,
(b) the deal door, (c) the staff dossier — blur each field → capitalized/uppercased forms above,
and the SAVED value equals the SHOWN value; correct "Ct" back to "ct" and blur → it stays "ct".

## CR-102 — BROWN → COMPANY GREEN

THE BROWN IS THE GOLD SCALE. tailwind.config.js: gold-600 #ba9935 is "Brand gold"; the text-safe
gold-800 #7a6421 reads brown on screen. COMPANY GREEN is the green scale, green-800 #143321
("Brand green" — the .btn-primary fill; text idiom green-900/green-800 per index.css tokens).

WHERE IT LIVES IN THE SIGNING FLOW (gold-* class counts, grep -o 'gold-[0-9]*' per file):
- ContractPage.tsx 43 · ContractCascade.tsx 40 (incl. the ⟦NEEDS⟧ "needs input" highlight
  bg-gold-100/text-gold-900/border-gold-400) · Onboarding.tsx 17 (sign pointer, typed-name hint,
  eval-lesson outline, FileText icons text-gold-ink, btn-outline-gold buttons) ·
  ClauseDocument.tsx 12 · DocumentsContent.tsx 5 (doc cards, awaiting-signature text) ·
  PartyDocumentView.tsx 3 ("Your answers" gold box). Total 120 refs.
- The ops-side signing surfaces (DocumentViewerPage, SigningPanel, SignPartyRow, ConfirmNameModal,
  MergedBodyView) have ZERO gold refs — the brown is entirely on the client-facing flow.
- ⚠️ THE SEAM: part of the brown arrives via GLOBAL index.css classes — btn-outline-gold,
  text-gold-ink, gold-armed, focus rings ring-gold-800 — used app-wide. Recoloring the CLASS
  recolors the whole app; honoring "in the doc signing flow" means green variants applied at the
  signing-flow call sites (or scoped wrappers). ASK-OWNER: does the rest of the app keep its gold,
  or is this the first step of gold→green everywhere?
- Strikethrough in the flow (Onboarding.tsx:1937 executed-doc titles) is already text-muted
  (green-tinted), not brown — listed by the owner, but nothing brown found on strikethrough in this
  flow. Say so rather than inventing a change.
- T1 TRAP carried forward: arbitrary Tailwind values have silently emitted nothing here twice —
  any spec must require grepping the BUILT css for the emitted green values.

PROPOSED VALIDATION CRITERIA: walk the signing flow (onboarding docs list → reader → sign, plus
/app/contracts/:id as a party) — zero brown/gold on icons, checkmarks, text, borders, highlights,
buttons; focus rings and "needs input" highlights render in green family; built CSS greps clean
for the new classes; surfaces OUTSIDE the flow unchanged (pending owner's scope answer).

---

## ASK-OWNER — what genuinely remains
1. CR-102 scope: signing flow only (global gold classes stay gold elsewhere), or the start of
   gold→green app-wide? His words scope it to the flow; the seam makes it worth one confirmation.
2. The three validation-criteria blocks above — agree or amend.
(CR-100's only open question was answered mid-run: 🔒 normalize-only, no paid lookup.)

## ANSWERED BY RESEARCH (never re-ask)
- "Which task was the token fix, did it merge?" → commit 71993bb2, 2026-08-24, merged, live.
- "Is CR-101 a regression?" → no; three readers never routed through the fixed renderer.
- "Is there a normalize idiom?" → yes, CR-83/84 on-blur spine; address is a missing KIND, not a
  missing system.
- "What is company green / the brown?" → green-800 #143321 · the gold scale (text at gold-800
  #7a6421).
