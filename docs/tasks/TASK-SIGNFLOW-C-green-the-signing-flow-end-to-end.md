# TASK-SIGNFLOW-C — the signing flow goes green, first page through last. Nothing else moves.

**Spec by `FHE-DSNR-SIGNFLOW`, 2026-09-01. Change order: `CR-102`.**
**Thread name: `FHE-TASK-SIGNFLOW-C`.**
🔒 **MUST NOT START UNTIL `TASK-SIGNFLOW-A` AND `-B` HAVE MERGED** — they edit three of your files.
⚠️ **If `docs/reports/TASK-SIGNFLOW-A-REPORT.md` and `-B-REPORT.md` do not both exist, stop and ask
`ORCH` through the owner.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements. **§2a is this task's whole risk: code that
>   reports success while emitting no CSS.**
> - `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-SIGNFLOW-C-LEDGER.md` FIRST.
> - `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-102 — the owner's ruling.
> - `docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 3 — the research. ⚠️ **Its numbers do not
>   reproduce and its scope framing is superseded. Use §2 below.**
> - `docs/archive/TASK-SIGNFLOW-{C,D,E,F}-*-SUPERSEDED-2026-09-01.md` — **the app-wide version of this
>   change order, killed before dispatch. Read the banner on any one of them so you do not
>   accidentally rebuild it.** ⚠️ **Do not follow their file lists.**
> - `tailwind.config.js:63-110` — the green and gold scales. **You add no colour.**

---

## 1. THE OWNER'S WORDS

> *"change the brown used on the things like icons, strikethru, checkmarks, text, boarders,
> highlights, and buttons in the doc signing flow to the company green color."*
> — `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-102

🔒 **AND THE SCOPE, NARROWED BY HIM ON 2026-09-01, WHICH IS THE WHOLE SHAPE OF THIS TASK:**
> *"just change the items to green, leave the gold used in the app nav and other accents throughout
> the app in their light gold color. **the signing flow from first page through the last should switch
> the gold to green for sure.** other pages can be evaluated on a case by case basis when i have the
> opportunity to view them. **dont change things in the app arbitrarily.**"*

**Two instructions, and they pull against each other in exactly one place — §4. Everything else follows:**
- 🔒 **INSIDE the signing flow: every gold goes green. All of it. No exceptions, no keepers.**
- 🔒 **OUTSIDE it: NOTHING CHANGES.** ⚠️ **Not the nav, not the badges, not the avatar rings, not the
  marketing pages, not the ops tools, not the booking flow's step dots or divider rules.**
  **A diff that touches a file outside §3's list is this task failing, however good the reason.**

⚠️ **AND THE PREMISE HE STRUCK, so no thread re-derives it:** an earlier draft argued the gold wash on
contract fields was load-bearing — that it signalled *"this is a control, not the document."* **He
rejected that:** *"the document is set inside a contained box that is clearly differentiated from the
app surface. and green vs gold would not change how the viewer interprets whether or not the content
is an app surface."* 🔒 **He is right: containment does that work, not hue. So there is no affordance
to preserve. Change the colours.**

## 2. WHAT WAS MEASURED — re-run by DSNR on 2026-09-01

⚠️ **DISCO's numbers do not reproduce.** It reported 590 app-wide gold refs; the real figure is **568**
(it used `gold-[0-9]*`, zero-or-more, which also counts `gold-ink` and prose). Its per-file counts are
off by one or two nearly everywhere. **Use the table in §3 and re-run it yourself.**

**Of those 568, this task changes 175 — about 31%. The other 393 stay gold** and are the owner's
"nav and other accents throughout the app."

⚠️ **The finding that decides this task's shape:** `grep -oE 'gold-[0-9]+'` on the **public** signing
door returns **ZERO**.

| Door | inline `gold-*` | `eyebrow` | `btn-outline-gold` | `btn-sign` |
|---|---:|---:|---:|---:|
| `src/pages/SignStart.tsx` | **0** | 1 | 1 | 0 |
| ~~`src/pages/DocsParticipantFlow.tsx`~~ | 0 | 5 | 0 | 0 | 🔻 **OUT — retiring** |
| ~~`src/pages/Release.tsx`~~ | 0 | 5 | 2 | 1 | 🔻 **OUT — retiring** |

🔒 **THEREFORE: replacing inline `gold-*` classes ALONE leaves `/sign/...` — the public door, and the
one the owner has ruled will become the single pathway — completely unchanged.** **All of its brown
arrives through GLOBAL CLASSES in `src/index.css`.** **That is why §4 exists, and it is the part of
this task that is not find-and-replace.**

### 🔻 TWO PAGES CUT FROM THIS TASK ON 2026-09-01 — DO NOT PAINT THEM
**Owner:** *"we dont use docs/release-participant nor /release … the /sign/ flow should be the single
pathway we use."* 🔒 **`TASK-SIGNFLOW-D` retires them. Greening a page that is being deleted is waste
and creates a merge conflict with `D`.** ⚠️ **`Release.tsx:466` uses `.btn-sign`, which you flip
anyway (§5.2) — that is incidental and costs you nothing. Do not apply `.flow-green` to either page
and do not open either file.**

## 3. 🔒 THE FILE LIST — exhaustive. 15 files, 175 inline refs, 9 `gold-ink`.
⚠️ **A file not on this list is out of scope. Re-grep every count before you start.**

| File | `gold-[0-9]+` | `gold-ink` | Role in the flow |
|---|---:|---:|---|
| `src/pages/app/ContractPage.tsx` | 41 | 2 | the contract surface a party lands on |
| `src/components/app/ContractCascade.tsx` | 40 | 0 | the document body + its fields |
| `src/components/app/AddElementModal.tsx` | 34 | 0 | Add Item, on the contract surface |
| `src/pages/app/Onboarding.tsx` | 16 | 1 | **the flow's first page** |
| `src/components/app/ContractChangeRequests.tsx` | 12 | 2 | on the contract surface |
| `src/components/app/ClauseDocument.tsx` | 11 | 0 | the clause body renderer |
| `src/components/app/ContractActivityCard.tsx` | 6 | 0 | on the contract surface |
| `src/components/app/ContractDrawer.tsx` | 5 | 1 | on the contract surface |
| `src/components/app/ContractSubheader.tsx` | 5 | 0 | on the contract surface |
| `src/components/app/PartyDocumentView.tsx` | 3 | 0 | the party's read of a document |
| `src/components/app/DocumentsContent.tsx` | 2 | 3 | `/app/documents` + the Account panel |
| `src/pages/SignStart.tsx` | **0** | 0 | **the public door** — §4 only |
| `src/pages/app/ops/DocumentViewerPage.tsx` | **0** | 0 | staff doc viewer — **verified clean, nothing to do** |
| **total** | **175** | **9** | |

**Plus `src/index.css`** — §4 and §5 only. **That is the complete set: 14 files.**

### ⚠️ WHAT IS DELIBERATELY *NOT* HERE, AND WHY
An earlier draft of this change order included the staff **template and queue tooling** —
`DocumentSurface.tsx` (13), `FormSurface.tsx` (10), `EmailSurface.tsx` (3), `SurfaceVersions.tsx` (1),
`TokenPicker.tsx` (3), `DocumentsQueuePage.tsx` (4), `DocumentQueueTable.tsx` (1) — **35 refs.**
🔒 **They are staff authoring tools, not the signing flow.** They fall under *"other pages can be
evaluated on a case by case basis."* ⚠️ **Leave them brown. Do not open them.**

## 4. 🔒 THE SHAPE — how the flow's SHARED classes go green without touching the rest of the app

**The problem, precisely:** five global classes in `src/index.css` paint the flow brown, and every one
of them is used far outside it. Measured 2026-09-01
(`grep -rl "\bCLASS\b" src --exclude=index.css | wc -l`):

| Class | brown token | files app-wide | uses **inside the flow** |
|---|---|---:|---:|
| `.eyebrow` (`index.css:163`) | `text-gold-800` | 57 | **15** |
| `.btn-outline-gold` (`:220`) | border + text + hover fill `gold-800` | 44 | **18** |
| `.focus-ring` (`:204`) | `ring-gold-800` | 122 | dozens |
| `.form-input` (`:282`) | `focus:border-gold-800` + `focus:ring-gold-800/40` | 95 | dozens |
| `.text-gold-ink` (`:155`) | `text-gold-800` | 30 | **9** |

🔒 **THE DECISION, AND IT IS DSNR'S — DO NOT RE-OPEN IT: A SCOPE CLASS, NOT 42 CALL-SITE SWAPS AND NOT
A GLOBAL FLIP.**

Add **one** scope class to `src/index.css` — call it **`.flow-green`** — that re-declares those five
tokens **for its descendants only**, and apply it at the root of the six signing surfaces.

**Why this and not the alternatives:**
- **A global flip** (change `.eyebrow` to `text-green-800`) repaints 57 files the owner has not looked
  at. ⚠️ **That is literally *"changing things in the app arbitrarily."*** Ruled out.
- **Green sibling classes** (`.eyebrow-green`, `.btn-outline-green`) means **42+ call-site edits** for
  eyebrow and outline-gold alone, and gives no answer at all for `.focus-ring` / `.form-input`, which
  are on nearly every element in the flow. Ruled out.
- **The scope class is ~6 application points**, covers all five classes at once, is greppable, affects
  exactly nothing outside the flow, and 🔒 **is the cheapest possible thing to unwind when the owner
  later evaluates the other pages: flip the base classes and delete the scope.**

**Specificity is why it works, and you must confirm it rather than assume it:** a descendant selector
`.flow-green .eyebrow` (0,2,0) beats `.eyebrow` (0,1,0); `.flow-green .focus-ring:focus-visible`
(0,3,0) beats `.focus-ring:focus-visible` (0,2,0). ⚠️ **Do not reach for `!important`. If you find
yourself needing it, the selector is wrong — say so and stop.**

**The FOUR application points** (⚠️ re-grep; `A` and `B` have moved lines):
`Onboarding.tsx` · `SignStart.tsx` · `ContractPage.tsx` · `DocumentsContent.tsx`.
🔻 **`DocsParticipantFlow.tsx` and `Release.tsx` were the fifth and sixth and are CUT — retiring.**
⚠️ **`SignStart.tsx` returns a FRAGMENT (`<>`), not an element** — see `:507`. **Wrap its sections in
a `div className="flow-green"`, or put the class on each top-level `<section>`. Check every one of the
six for this before assuming there is a single root to decorate.**
⚠️ **`DocumentsContent.tsx` is a COMPONENT, not a page** — it renders inside the Account panel as well
as `/app/documents`. **Scoping it at its own root is correct and greens it in both places.**

## 5. WHAT CHANGES IN `src/index.css`

1. **`.flow-green`** — the new scope block from §4, with a comment carrying the owner's narrowing
   verbatim and stating plainly that **it exists because the rest of the app stays gold on purpose.**
2. 🔒 **`.btn-sign` (`index.css:245-256`) — FLIP THE CLASS ITSELF. Do not scope it.**
   **Verified: it has exactly three adopters and all three are the signing flow** —
   `Onboarding.tsx:2046`, `ContractPage.tsx:2307`, and `Release.tsx:466` (retiring — incidental, and it
   costs you nothing since you change the class, not the call site). **Zero collateral.**
   `bg/border-gold-800` → `green-800` · `hover:gold-700` → `green-700` · `active:gold-600` →
   `green-600` · `ring-gold-800` → `ring-green-800`.
   ⚠️ **`index.css:228-245` records the owner's 2026-08-24 design for this button verbatim** —
   *"make it a full fill color so they know its active … the full fill can then lighten on click"* and
   *"lighten on mouseover"*. 🔒 **ARMED fills · HOVER lifts · PRESS lifts again · DISABLED is a muted
   outline, not a dimmer fill. Change ONLY the hue. If your green version collapses two of those three
   steps into one visible state, you have broken a locked design — say so and stop.**
   ⚠️ **Update that comment block to say green.** Leaving it saying "ARMED fills gold-800" recreates
   the lying-comment defect `TASK-SIGNFLOW-A` is fixing next door.
3. **The file header** (`index.css:4-22`) documents the palette and tokens. **Add one line** noting
   that the signing flow runs green under `.flow-green` while the app's accents stay gold. **Do not
   rewrite the gold token descriptions — they are still true everywhere else.**

🔒 **NOTHING ELSE IN `index.css` MOVES.** ⚠️ **Specifically: `.eyebrow`, `.eyebrow-on-dark`,
`.text-gold-ink`, `.text-gold-accent`, `.rule-gold`, `.focus-ring`, `.form-input`, `.btn-primary`,
`.btn-outline-gold`, `.step-complete`, `.selectable-card`, `.link-underline` keep their gold
definitions.** They are the owner's accents everywhere the flow is not.

## 6. THE MAPPING for the 175 inline refs — same numeric step

Both scales run dark→light in the same direction (`tailwind.config.js:64-76`, `:99-110`:
`green-900 #0d2118` … `green-50 #edf7f0`; `gold-900 #5c4a18` … `gold-50 #fbf8ee`).

🔒 **`gold-N` → `green-N`, keeping the opacity suffix exactly.** `bg-gold-50/70` → `bg-green-50/70`.
`border-gold-400/60` → `border-green-400/60`. `text-gold-900` → `text-green-900`.
⚠️ **A same-step rule is the point: 175 sites cannot survive per-site taste.**

**Two deviations are allowed. Each must be listed in your report with its reason:**
1. **Placeholder / hint text.** `ContractCascade.tsx:1076` `placeholder:text-gold-700/70`, and `:1231`,
   `:1360`, `:1715`, `:1718`. A same-step green is **darker** than the page's own hint token.
   **Converge on the incumbent instead — `text-muted` (`index.css:153`) for hint glyphs,
   `placeholder:text-green-800/40` (`index.css:282`) for placeholders.**
2. **Contrast on a filled control.** White text on `gold-500`/`600` becomes white on
   `green-500 #2d7043` / `green-600 #215531`. **Compute the ratio and state it.** Under 4.5:1, step
   one darker and say so.

**`text-gold-ink` needs NO edit** at its 9 sites — `.flow-green` re-points it. ⚠️ **Replacing it
inline deletes a semantic token for no gain.**

## 7. THE TRAPS
- 🔒 **T1 — THE ARBITRARY-VALUE TRAP, TWICE BITTEN IN THIS REPO.** `border-green-900/12` emitted **no
  CSS rule at all** because `/12` is not in the scale (`docs/method/TASK-ROLE.md` §2a,
  `tailwind.config.js:13-22`). ⚠️ **You will write ~60 opacity suffixes.** **A missing rule looks like
  "no border", which reads as a deliberate design choice — nobody catches it by eye.** **Prove it in
  the BUILT CSS**, §10 item 3.
- **T2 — `@apply` inside a descendant selector.** `.flow-green .eyebrow { @apply text-green-800; }`
  must actually compile under this Tailwind setup. ⚠️ **Prove the rule exists in `dist/assets/*.css`
  before you go on.** If `@apply` misbehaves there, write the plain CSS declaration instead and say
  which you used and why.
- **T3 — you are the third thread in three of these files.** `A` edited `ContractCascade.tsx` and
  `DocumentsContent.tsx`; `B` edited `Onboarding.tsx`. **Both merged before you.** ⚠️ **Re-grep every
  line number in this spec before using it. None is guaranteed.**
- **T4 — do not blind-`sed`.** `text-gold-ink` contains `gold-`. `grep -oE 'gold-[0-9]+'` is the
  boundary; check every hit. ⚠️ **A `sed s/gold-/green-/g` breaks `text-gold-ink` and any comment
  prose in these files.**
- **T5 — the scope class must not leak.** ⚠️ **A modal, drawer or toast rendered through a React
  PORTAL is not a DOM descendant of the page root**, so `.flow-green` will not reach it. **Check
  `AddElementModal`, `ContractDrawer` and any `Modal` used in the flow: if they portal to `body`, the
  scope class must be applied on the portal's own content root too.** **This is the most likely way
  this task ships looking done and is not.**
- **T6 — hue only.** No layout, spacing, radius, border-style, weight, tracking or state-logic change
  anywhere. ⚠️ **`border-dashed`, `border-l-4` and every size stay exactly as they are.**
- **T7 — strikethrough is ALREADY correct.** The owner listed it. `Onboarding.tsx:1969` renders the
  completed-document strikethrough as `text-muted line-through` — green-toned, no brown.
  🔒 **Report "already correct". Do not invent a change to have something to show.**
- **T8 — do not report the tangential** (CR-94). A finding outside this task gets **ONE LINE** under
  "flagged, not fixed."

## 8. OUT OF SCOPE — and this is half the spec
🔒 **THE OWNER'S WORDS ARE THE BOUNDARY: *"dont change things in the app arbitrarily."***
- **Any file not in §3's 15 + `src/index.css`.** ⚠️ **`git diff --stat` naming a 17th file is a
  failure of this task regardless of how right the change is.**
- **The nav, the badges, the avatar rings, the header, the footer** — `AppLayout.tsx`, `Header.tsx`,
  `Footer.tsx`, `RosterCard.tsx`. **The owner named these as staying gold.**
- **The staff template + queue tooling** — the seven files in §3's note. **Case by case, later.**
- **The marketing pages, the feed, the ops pages, the booking flow** (including its `.step-complete`
  dots and `.rule-gold` dividers in `BookRider`/`BookHorse`/`BookSupport`). **Untouched.**
- **`tailwind.config.js`.** 🔒 **The gold scale stays — 393 refs still use it.**
- **Renaming any class.** `.btn-outline-gold` keeps its name and its gold.
- **Any DB write, migration, RPC, copy or template change.** This task is CSS classes only.

## 9. THE REACH — the flow, first page through last

| # | Path | Who | Files |
|---|---|---|---|
| 1 | `/app/onboarding` → details → documents list → the reader → sign | member | `Onboarding.tsx` |
| 2 | `/app/documents` **and** Account → Documents → **Read** | member | `DocumentsContent.tsx` |
| 3 | `/app/contracts/:id` **as a party** | member / counterparty | `ContractPage.tsx` + the 8 contract components |
| 4 | `/app/contracts/:id` → **Add Item** | staff, on the signing surface | `AddElementModal.tsx` |
| 5 | `/sign/...` **all four funnels + the deal branch** | visitor / counterparty, **often logged out** | `SignStart.tsx` — **§4 only** |
| 6 | `/app/ops/documents/:id` | staff | `DocumentViewerPage.tsx` — **verified zero gold, nothing to do** |

⚠️ **Path 5 changes ONLY through `.flow-green`.** 🔒 **If the scope class does not land, `/sign/...` is
untouched and the flow is not green end to end — and `/sign/` is the pathway the owner has ruled
everything will funnel into. It is the proof this task worked.**

## 10. THE TEST THIS MUST PASS
**Built from the validation criteria the owner agreed on 2026-09-01
(`docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 3), as narrowed by his ruling in §1.**
⚠️ **Renders are NOT verified by you** (`docs/method/TASK-ROLE.md` §3). **Items 5–10 are the numbered
checklist you hand the owner, and it must name the phone.**

1. 🔒 **`git diff --stat` shows at most 14 files** — the 13 in §3 (minus the two zero-gold ones you did
   not need to touch) plus `src/index.css`. ⚠️ **List them. A 15th is a failure, and
   `DocsParticipantFlow.tsx` or `Release.tsx` appearing at all is a failure.**
2. 🔒 **`grep -rE 'gold-[0-9]+'` across §3's files returns ZERO.**
   `grep -rEo 'gold-[0-9]+' src | wc -l` goes **568 → 393**. ⚠️ **If it is not 393, find out why before
   you report.** State both numbers.
3. 🔒 **THE T1 PROOF — THE BUILT CSS, NOT THE SOURCE.** After `npm run build`:
   - for **every distinct** green class you introduced, show a rule exists in `dist/assets/*.css`.
     **Report the distinct-class list and the per-class result.** ⚠️ **"The build succeeded" is not
     this test.**
   - **the `.flow-green` block emitted** — grep the built CSS for its descendant selectors and paste
     what you found. **This is T2 and it is the one that silently produces nothing.**
   - `grep -o '#ba9935\|#7a6421\|#5c4a18' dist/assets/*.css | sort | uniq -c` — **all three must still
     be NON-ZERO.** 🔒 **A zero here means you greened the app's accents, which is the one thing the
     owner said not to do.**
4. `npx tsc --noEmit` clean; `npm run build` succeeds. ⚠️ **`npm run test:db` is red at baseline and
   proves nothing** — do not report it either way.
5. **`/app/onboarding`, whole flow**: documents list, reader, e-sign consent, sign button, every panel
   — **zero brown**. The completed-document **strikethrough unchanged** (T7).
6. **The sign button, all four states**: unarmed = muted outline · armed = filled green · hover
   lightens · press lightens again. ⚠️ **Name each state separately.**
7. 🔒 **The public door — `/sign/guest`, `/sign/rider`, `/sign/horse`, `/sign/rider+horse` and the
   deal branch.** **Eyebrow label green, outline button green, focus rings green when tabbing, input
   focus borders green when typing.** ⚠️ **This proves `.flow-green` landed. Test it LOGGED OUT.**
   🔻 **Do NOT test `/release` or `/docs/release-participant` — they are out of scope and retiring.**
8. **`/app/contracts/:id` as a party**, plus **Add Item** and the drawer: banner strips, change and
   amendment cards, activity card, subheader, inline fields, ⟦NEEDS⟧ marks, "Add …" controls —
   **zero brown**. ⚠️ **Open the modal and the drawer specifically — that is T5.**
9. 🔒 **THE REST OF THE APP IS UNCHANGED. This item carries equal weight to the rest.**
   Check and report individually: the `/app` nav selected row and its underline · a nav count badge ·
   the notification count · a contact card avatar ring (**for a client — it must still be gold**) ·
   the public header and footer · one marketing page · one ops page · the booking flow's step dots and
   divider rule. ⚠️ **Any of these turning green is a defect to revert, not a bonus.**
10. **The staff template editors** (`DocumentSurface`, `FormSurface`, `EmailSurface`, `TokenPicker`)
    and the **documents queue** are **still brown, on purpose.** ⚠️ **Confirm it. That is the "case by
    case, later" set and it must survive this task intact.**
11. **Your §6 deviations are listed with reasons**, and the contrast ratio is stated for any
    white-on-fill case.

## 11. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-C-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-C-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies your claims itself and writes
`TASK-SIGNFLOW-C-VERIFICATION.md` beside it. **You do not push.**
