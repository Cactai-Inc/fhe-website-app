# FHE-DISCO-SIGNFLOW HANDOFF — for DSNR

**From FHE-DISCO-SIGNFLOW, 2026-09-01. Subject: the doc-signing flow — CR-100, CR-101, CR-102.**
**Everything below is researched and LOCKED with the owner; validation criteria agreed 2026-09-01.**
Working ledger with every query behind these numbers: `docs/reports/FHE-DISCO-SIGNFLOW-LEDGER.md`.

---

## ITEM 1 · CR-101 — the signing-flow readers still show {{SIG.*}} tokens

**Verbatim (CHANGE-ORDER-LEDGER §CR-101):** *"noticed that the docs in the signing flow still show
the tokens for date and signature, we previously ran a task thread that was supposed to remove the
visibility of the signature token and insert the real date rather than show the token."*

### The trace — this is an UNREACHED FIX (D17), not a regression
- The prior fix exists, merged, never reverted: **commit 71993bb2 (2026-08-24)**, carrying the
  owner's 8-24 ruling verbatim. It added `resolveUnsignedSignatureTokens` — `SIG.*.DATE` → today's
  date in the "August 24, 2026" shape `generate_document` produces; `SIG.*.<anything else>` →
  empty — applied inside `ContractBody` (`src/components/app/ContractCascade.tsx:322`), plus a
  copy in `api/_lib/documentPdf.ts` (and `src/lib/documentPdf.ts:89`).
- **The renderer's own comment ("every frame that shows a document body comes through here") is
  FALSE.** Three readers render `documents.merged_body` raw, never touching `ContractBody`:
  1. **`src/pages/app/Onboarding.tsx:1963`** — the onboarding signing reader renders
     `<BodyWithSignatures text={body}>` (imported from ops `MergedBodyView`). This is the exact
     surface the owner was looking at. `BodyWithSignatures` only script-faces already-signed
     "Signature: Name" lines; it never resolves tokens.
  2. **`src/components/app/DocumentsContent.tsx:167`** (`PaperViewer`) — the "Read" reader used by
     /app/documents and the Account panel renders `{doc.pages[page]}` — raw text, no token
     resolution AND no signature script-face styling at all.
  3. **`src/pages/app/ops/DocumentViewerPage.tsx:200`** via `MergedBodyView` — staff doc viewer,
     same gap.
- Not TASK-SIGNSTRIP (that was the catalog block — confirmed different scope).

### The incumbent (D18)
`resolveUnsignedSignatureTokens` is already exported from `ContractCascade.tsx`. The fix is REACH:
route the three readers' text through the same resolution (whether by resolver call or by
converging on the shared renderer is DSNR's shape call). While in `PaperViewer`, note it also lacks
the signature script-face styling the other readers have — same convergence decision.

### Freeze safety (D32/D33)
Display-time only. The resolver matches only still-literal tokens; an executed body holds real
values and nothing matches. Kiosk `Release.tsx` uses `BodyWithSignatures` on an executed body —
unaffected. No stored document is touched.

### 🔒 VALIDATION CRITERIA (agreed 2026-09-01)
Open an UNSIGNED doc in (a) the onboarding reader, (b) the Documents "Read" paper viewer, (c) the
ops document viewer: no `{{SIG...}}` anywhere; the date position shows today's date in
"September 1, 2026" shape; the signature space is empty. Open an EXECUTED doc in all three:
unchanged — real name in script face, real date.

**THE REACH:** onboarding → document reader is the primary path. **THE TELL:** a `{{SIG.` visible
in any of the three readers on an unsigned doc.

---

## ITEM 2 · CR-100 — address inputs normalize on blur

**Verbatim (§CR-100):** *"we need the address fields to normalize the inputs, when i enter my
address, 752 windemere ct san diego ca 92109, it stays looking like that it should normalize to
capitalize and it should make sure its a valid address somehow."*

### 🔒 LOCKED (owner, mid-run 2026-09-01, verbatim)
> *"just normalize the inputs dont want to setup google api for paid lookup functionality, i know
> youre going to need a decision on this while running this task and i can tell you now that is my
> answer."*

**Normalize-only. No external verification service, ever, for this CR.** "Valid somehow" =
format-level shaping only.

### The incumbent (D18) — address is a missing KIND, not a missing system
`src/lib/normalize.ts` + `useFieldNormalizer` (`src/lib/formState.ts`) — the CR-83/84 spine:
normalize ON BLUR, in front of the person, save AFTER normalizing, never re-correct a deliberate
edit (`lastOutput` guard), never touch DB-loaded values. Kinds today: `name | phone | email`.
`normalizeKindForField()` derives kind from the field name — address fields return null today.

### Where address inputs live (all structured street/line2/city/state/zip; contact record is the
source of truth per D22; contracts compose `{{...ADDRESS}}` via `compose_address`)
1. **`src/pages/app/Onboarding.tsx:1601-1614`** (`address_street/city/state/zip`) — no normalize
   on any of the four; name/phone/email on the same page all have it. This is where the owner's
   example stays lowercase.
2. **`src/pages/SignStart.tsx:640-705`**, deal branch only — line1/line2/city/state/zip. State
   already `.toUpperCase()`s on change (the app's only address normalization); rest raw.
3. **`ContactDossierModal` FIELD_GROUPS "Mailing address"** (`address_line1/2, city, state,
   postal_code, country`) — auto-wired through `normalizeKindForField`, so extending that function
   covers the dossier with ZERO call-site edits (the FIX4 §4 design paying off).
4. CaptureInfoModal / StableEditors — no address fields.

### Shape that fits the incumbent (research finding, for DSNR to spec)
Add address kinds to `normalize.ts`: street/city word-capitalize under the CR-83 rules (a word
already carrying a capital is never touched — "McAllister Ave" survives); state → 2-letter
uppercase; ZIP left as typed unless recognizably 5 or 5+4 digits (the `normalizePhone` precedent:
format what is recognizable, never mangle what is not). Owner's example becomes:
**752 Windemere Ct · San Diego · CA · 92109.**

### 🔒 VALIDATION CRITERIA (agreed 2026-09-01)
Type the owner's example lowercase into (a) onboarding details, (b) the deal door, (c) the staff
dossier — blur each field → the capitalized/uppercased forms above, and the SAVED value equals the
SHOWN value. Correct "Ct" back to "ct" and blur → it stays "ct" (the no-refight guard).

**THE REACH:** all three entry points, not just onboarding. **THE TELL:** a lowercase address
surviving blur, or a saved value differing from the shown one.

---

## ITEM 3 · CR-102 — brown → company green, by the decorative/functional rule, APP-WIDE

**Verbatim (§CR-102):** *"change the brown used on the things like icons, strikethru, checkmarks,
text, boarders, highlights, and buttons in the doc signing flow to the company green color."*

### 🔒 SCOPE RULING (owner, 2026-09-01 — full verbatim now under §CR-102 in the change-order ledger)
**Where DISCO was wrong and he corrected it:** DISCO presented this as "signing flow only vs
app-wide gold→green." Both framings were wrong. The rule is **DECORATIVE vs FUNCTIONAL, applied
everywhere:**
- **KEEPS GOLD (decorative accents):** the avatar ring on contact cards, nav selected state,
  notification count — *"the acceptable uses for the nice gold color."*
- **GOES GREEN (functional):** *"anything that is a functional action element or something like an
  icon or text."* Buttons, icons, text, borders, highlights — in the signing flow *"and any other
  places its used."*

### The palettes
- **The brown IS the gold scale.** `tailwind.config.js`: `gold-600 #ba9935` ("Brand gold");
  text-safe `gold-800 #7a6421` / `gold-900 #5c4a18` read brown.
- **Company green** = the green scale: `green-800 #143321` ("Brand green", the `.btn-primary`
  fill); text idiom `green-900` / semantic tokens in `src/index.css`.

### The MECHANISM behind "shows up properly" vs "shit brown" — hand this to the classifier
Gold looks good where the owner says it does because those sites use **light gold (gold-300/400/600)
as small accents, mostly on DARK green surfaces** (nav underline `bg-gold-300` on dark, notification
badge `bg-gold-600`, avatar `ring-gold-600`). It reads brown where **dark text-safe gold
(gold-800/900) is used as TEXT, ICONS or BORDERS on the light cream page** — dark gold at text
weight is optically brown. The decorative/functional rule and this optical split agree almost
everywhere; classify by FUNCTION (his rule), and the optics confirm the call.

### Inventory (grep -o 'gold-[0-9]*', src, 2026-09-01)
- **590 inline gold refs app-wide.** By shade: gold-800 ×138 · gold-50 ×104 · gold-600 ×72 ·
  gold-400 ×72 · gold-900 ×56 · gold-200 ×24 · others ×124.
- **Signing flow (the owner's original scope):** ContractPage 43 · ContractCascade 40 (incl. the
  ⟦NEEDS⟧ "needs input" highlight `bg-gold-100 text-gold-900 border-gold-400`) · Onboarding 17 ·
  ClauseDocument 12 · DocumentsContent 5 · PartyDocumentView 3. Ops signing surfaces
  (DocumentViewerPage, SigningPanel, SignPartyRow, ConfirmNameModal, MergedBodyView): ZERO.
- **Global classes in `src/index.css`:** `btn-outline-gold` (44 files — a BUTTON → green),
  `text-gold-ink` (30 files — TEXT → green), `.eyebrow` (`text-gold-800`, 57 files — text on
  light), focus rings `ring-gold-800`, the gold-armed button state. Changing a class changes every
  adopter at once — with the app-wide ruling that is now a feature, but DSNR must walk the
  adopters of each class against the decorative/functional rule before flipping it.
- **Known keepers found:** `RosterCard.tsx:83` `ring-gold-600` (avatar ring — and it is SEMANTIC:
  gold ring = client, vs green = account, grey = guest; do not touch), Header nav underline
  (`bg-gold-300`/`bg-gold-700`), notification count badge (`Header.tsx:165` `bg-gold-600`), nav
  selected state.
- **Judgment calls to spec explicitly, not silently:** the ⟦NEEDS⟧ highlight (functional flag →
  green family, but it must stay visually distinct from ordinary green body text); `.eyebrow`
  (label text on light — text rule says green; its dark-surface variant uses gold-400 as accent);
  focus rings (functional affordance). Strikethrough in the signing flow is ALREADY green-toned
  (`text-muted` on Onboarding.tsx:1937) — the owner listed it, nothing brown found there; report
  "already correct," do not invent a change.
- ⚠️ **T1 TRAP (two prior incidents):** arbitrary Tailwind values here have silently emitted
  nothing. Any spec must require grepping the BUILT CSS for the emitted green values.

### 🔒 VALIDATION CRITERIA (agreed 2026-09-01)
Walk the signing flow (onboarding docs list → reader → sign, plus /app/contracts/:id as a party):
zero brown on icons, checkmarks, text, borders, highlights, buttons. The named keepers (avatar
ring, nav selected state, notification count, nav underline) still gold. Built CSS greps clean for
the new green classes. App-wide: no functional action element, icon, or text remains in
gold-800/900 brown.

**THE REACH:** the signing flow first, then every adopter of the global gold classes.
**THE TELL:** a brown button/icon/text anywhere, or a gold avatar ring that turned green.

---

## FOR DSNR — sequencing note (advice, not authority)
The three are independent; none blocks another. CR-101 is the smallest and a pure reach fix;
CR-100 rides an existing spine; CR-102 is the widest and now app-wide — it likely wants its own
task, chunked (global classes first, then per-file inline refs), with the keeper list embedded in
the spec so a build thread cannot "helpfully" green the avatar rings.

## ASKED AND ANSWERED — never re-ask
- Address verification service? → 🔒 NO (owner, mid-run, verbatim above).
- CR-102 scope? → 🔒 decorative/functional rule, app-wide (verbatim in §CR-102).
- Which task was the token fix / did it merge? → 71993bb2, 2026-08-24, merged, live, unreached.
- Validation criteria for all three → agreed as written above ("agree", owner, 2026-09-01).

## WAITING ON THE OWNER
Nothing. All three items are locked.
