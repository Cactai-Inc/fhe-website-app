# TASK-SIGNFLOW-D — green the document, contract and signing surfaces

**Spec by `FHE-DSNR-SIGNFLOW`, 2026-09-01. Change order: `CR-102`, chunk 2 of 4.**
**Thread name: `FHE-TASK-SIGNFLOW-D`.**
🔒 **MUST NOT START UNTIL `TASK-SIGNFLOW-A`, `-B` AND `-C` HAVE MERGED.** A and B edit three of your
files; C writes the rule you execute. ⚠️ **If `docs/reports/TASK-SIGNFLOW-C-REPORT.md` does not exist,
stop and ask `ORCH` through the owner.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements. **§2a is this task's whole risk.**
> - `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-SIGNFLOW-D-LEDGER.md` FIRST.
> - 🔒 **`docs/tasks/TASK-SIGNFLOW-C-the-decorative-functional-rule-and-the-global-classes.md` §3 and
>   §3a — THE CLASSIFICATION TABLE AND THE MAPPING. You execute it; you do not re-derive it.**
> - 🔒 **`docs/reports/TASK-SIGNFLOW-C-REPORT.md` — C's report carries the mapping block verbatim and
>   any deviation C had to make. Read it before your first edit.**
> - `docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 3 — the owner's ruling and the optics behind it.
> - `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-102 — the owner's full verbatim ruling.

---

## 1. THE OWNER'S WORDS

> *"change the brown used on the things like icons, strikethru, checkmarks, text, boarders,
> highlights, and buttons in the doc signing flow to the company green color."*

**This chunk IS the sentence he wrote.** `C` did the global classes; `E` and `F` do the rest of the
app; **you do the surfaces he was actually looking at.**

And the rule, from `C` §3a: **FUNCTIONAL → GREEN. DECORATIVE → STAYS GOLD.**

## 2. WHAT WAS MEASURED — re-run by DSNR on 2026-09-01

🔒 **YOUR FILE LIST, AND IT IS EXHAUSTIVE. 18 files, 210 numeric `gold-*` refs, 9 `gold-ink`.**
⚠️ **A file not on this list belongs to `E` or `F`. Editing one is a merge conflict with a live thread.**

| File | `gold-[0-9]+` | `gold-ink` |
|---|---:|---:|
| `src/pages/app/ContractPage.tsx` | 41 | 2 |
| `src/components/app/ContractCascade.tsx` | 40 | 0 |
| `src/components/app/AddElementModal.tsx` | 34 | 0 |
| `src/pages/app/Onboarding.tsx` | 16 | 1 |
| `src/components/ops/editor/DocumentSurface.tsx` | 13 | 0 |
| `src/components/app/ContractChangeRequests.tsx` | 12 | 2 |
| `src/components/app/ClauseDocument.tsx` | 11 | 0 |
| `src/components/ops/editor/FormSurface.tsx` | 10 | 0 |
| `src/components/app/ContractActivityCard.tsx` | 6 | 0 |
| `src/components/app/ContractDrawer.tsx` | 5 | 1 |
| `src/components/app/ContractSubheader.tsx` | 5 | 0 |
| `src/pages/app/ops/DocumentsQueuePage.tsx` | 4 | 0 |
| `src/components/app/PartyDocumentView.tsx` | 3 | 0 |
| `src/components/ops/editor/EmailSurface.tsx` | 3 | 0 |
| `src/components/ops/templates/TokenPicker.tsx` | 3 | 0 |
| `src/components/app/DocumentsContent.tsx` | 2 | 3 |
| `src/components/ops/documents/DocumentQueueTable.tsx` | 1 | 0 |
| `src/components/ops/editor/SurfaceVersions.tsx` | 1 | 0 |
| **total** | **210** | **9** |

**Query:** `for f in <list>; do grep -oE 'gold-[0-9]+' "$f" | wc -l; done` — re-run it and reconcile
before you start. ⚠️ **DISCO's per-file numbers do not reproduce** (it said ContractPage 43, Onboarding
17, ClauseDocument 12, DocumentsContent 5); **these are DSNR's, measured 2026-09-01, and `A` and `B`
will have moved lines by the time you read this. Re-grep; trust no line number.**

**The ops signing surfaces have ZERO gold** — verified: `DocumentViewerPage.tsx` 0, `MergedBodyView.tsx`
0, `ConfirmNameModal.tsx` 0, `SigningPanel.tsx`, `SignPartyRow.tsx`. **Nothing to do there. Do not go
looking for work in them.**

## 3. THE INCUMBENT, NAMED (D18) — you are replacing a SYSTEM, not recolouring 210 strings

⚠️ **THE FINDING THAT MAKES THIS CHUNK HARDER THAN IT LOOKS, AND DISCO DID NOT REPORT IT.**
These files do not merely *use* gold. They use `bg-gold-50` + `border-gold-400/500` + `text-gold-800/900`
as **the authoring affordance** — the one visual language that says *"this is not the document, this
is a thing you fill in or a thing that needs you."* Measured:

| The affordance | Where |
|---|---|
| every inline fillable field | `ContractCascade.tsx:1074-1076` (`inlineBase`), `:490`, `:532` — `bg-gold-50/70 border-b border-gold-400/70 focus:border-gold-600` |
| the ⟦NEEDS:…⟧ "still unfilled" mark | `ContractCascade.tsx:350` — `bg-gold-100 text-gold-900 border border-gold-400/60 border-dashed` |
| every "Add …" dashed control | `ContractCascade.tsx:615`, `:736`, `:845`, `:1613`, `:1683` |
| the insurance callout | `ContractCascade.tsx:1698-1701` |
| proposed-change and amendment cards | `ContractPage.tsx:221`, `:248` — `border-l-4 border-gold-400 bg-gold-50/60` |
| the page's banner strips | `ContractPage.tsx:138`, `:1551`, `:1589` |
| the "unsaved draft" dot and the element pills | `AddElementModal.tsx:447`, `:289`, `:443-444` |
| the surface-editor notice blocks | `DocumentSurface.tsx:128`, `FormSurface.tsx:50`, `:107`, `:310` |
| the onboarding "needs you" panels | `Onboarding.tsx:1351`, `:1758`, `:1789`, `:2158`, `:2167` |

🔒 **Gold-vs-green IS the signal today.** Greening it removes a distinction, so the replacement must
put that distinction back somewhere. **See §4 THE SHAPE. It is ruled; execute it.**

## 4. 🔒 THE SHAPE — ruled by DSNR after the owner's review. Execute it; do not improve it.

### 4a. THE MAPPING: SAME NUMERIC STEP, gold-N → green-N
Both scales run dark→light in the same direction (`tailwind.config.js:64-76` and `:99-110`:
`green-900 #0d2118` … `green-50 #edf7f0`; `gold-900 #5c4a18` … `gold-50 #fbf8ee`).

🔒 **THEREFORE THE DEFAULT IS MECHANICAL: `gold-N` → `green-N`, keeping the opacity suffix exactly.**
`bg-gold-50/70` → `bg-green-50/70`. `border-gold-400/60` → `border-green-400/60`.
`text-gold-800` → `text-green-800`. `text-gold-ink` → **no edit** (C already made that class green).

⚠️ **A same-step map is the rule BECAUSE 210 sites cannot survive per-site taste.** Deviating is
allowed only for the cases in §4c, and **every deviation must be listed in your report with its
reason.**

### 4b. WHAT THAT DOES TO THE AFFORDANCE, AND WHY IT STILL WORKS
The surrounding chrome in these files is `bg-white` with `border-green-800/10` – `/20` hairlines. A
marked region becomes `bg-green-50` (`#edf7f0`, distinctly cooler than the `#faf8f4` page) with a
`border-green-400` (`#3d8f58`) edge — **a saturated mid-green border is nothing else on these pages.**
🔒 **After CR-102 the affordance is carried by the WASH AND THE BORDER, not by the text colour.** The
`text-gold-900` inside a callout becomes `text-green-900`, which equals body text — **that is
accepted.** Do not invent a tint to keep the text distinct.

### 4c. THE THREE DEVIATIONS, AND THEY ARE THE ONLY ONES
1. **Placeholder / hint text.** `ContractCascade.tsx:1076` `placeholder:text-gold-700/70` and `:1231`,
   `:1360`, `:1715`, `:1718` (`text-gold-700`, `text-gold-700/80`). A same-step `text-green-700/70` is
   **darker** than the page's own hint token. **Use the page's existing token instead:
   `placeholder:text-green-800/40` for placeholders, `text-muted` for hint/tooltip glyphs.**
   ⚠️ **This is convergence on an incumbent (`src/index.css:153`), which is why it is allowed.**
2. **The ⟦NEEDS⟧ mark** (`ContractCascade.tsx:350`). Same-step gives
   `bg-green-100 text-green-900 border-green-400/60 border-dashed`. 🔒 **Keep `border-dashed` — after
   the hue change the DASH is what separates "unfilled" from every solid-bordered green block on the
   page.** ⚠️ **If you remove or solidify it you have deleted the last distinguishing feature of the
   most important mark in the file.**
3. **Contrast on a filled control.** Any site that puts white or near-white text on `gold-500`/`600`
   becomes white on `green-500 #2d7043` / `green-600 #215531`. **Compute the ratio and state it.**
   If it lands under 4.5:1, step one darker and say you did.

### 4d. WHAT IS ALREADY CORRECT — report it, do not change it
The owner listed **strikethrough**. `Onboarding.tsx:1969` renders the completed-document strikethrough
as `text-muted line-through` — **green-toned already, no brown anywhere in it.**
🔒 **Report "already correct" for strikethrough. Do not invent a change to have something to show.**

## 5. THE TRAPS
- 🔒 **T1 — THE ARBITRARY-VALUE TRAP, TWICE BITTEN.** `border-green-900/12` emitted **no CSS at all**
  because `/12` is not in the scale (`docs/method/TASK-ROLE.md` §2a, `tailwind.config.js:13-22`).
  ⚠️ **You are about to write ~60 opacity suffixes.** Every one must be a value Tailwind emits.
  **Prove it in the BUILT CSS** — §8 item 2. **A screenshot of a page that looks fine is not proof; a
  missing rule usually looks like "no border", which reads as a design choice.**
- **T2 — you are the third thread in three of these files.** `A` edited `ContractCascade.tsx` and
  `DocumentsContent.tsx`; `B` edited `Onboarding.tsx`. **Both merged before you.** ⚠️ **Re-grep every
  line number in §3 before using it.**
- **T3 — `text-gold-ink` needs no edit.** `C` made the class green. ⚠️ **If you "helpfully" replace
  `text-gold-ink` with `text-green-800` at the 9 sites in your files, you have deleted a semantic
  token and made `C`'s work partly pointless.** **Leave it. Count it as done.**
- **T4 — `focus-ring` and `form-input` need no edit either.** Same reason.
- **T5 — there are NO decorative keepers in your file list.** DSNR verified: every named keeper
  (`RosterCard.tsx:83`, `Header.tsx:151`/`:165`, `AppLayout.tsx:120`/`:163`/`:253`) lives in `E`'s
  files, not yours. 🔒 **So in these 18 files, every gold site goes green.** ⚠️ **If you believe you
  have found a decorative keeper here, STOP and report it as a question — do not decide it yourself.
  That is the strongest signal that the rule has an exception nobody has seen.**
- **T6 — `FormSurface`/`DocumentSurface`/`EmailSurface` are the template AUTHORING tools**, not the
  signing flow. They are in your list because they share the affordance system in §3 and must move
  with it. **Their notice blocks are functional. Green.**
- **T7 — do not change behaviour, layout, spacing, radius, border style or state logic.** Hue only,
  plus the three deviations in §4c. ⚠️ **`border-dashed`, `border-l-4`, `rounded-*` and every size
  stay exactly as they are.**

## 6. OUT OF SCOPE — do not touch
- **Any file not in §2's table.** `E` owns the app shell and the keepers; `F` owns the remaining 70
  files; `C` owns `src/index.css` and `app-header.css`.
- `tailwind.config.js`. **The gold scale stays** — the keepers still use it.
- The token resolver, `paginateBody`, the normalize spine — `A` and `B` own those and have merged.
- Any DB write, migration, RPC or template change. **This chunk is CSS classes only.**

## 7. THE REACH — what a person clicks

| # | Path | Surfaces |
|---|---|---|
| 1 | **the owner's own walk** — `/app/onboarding` → the documents list → the reader → sign | `Onboarding.tsx` |
| 2 | `/app/contracts/:id` **as a party** | `ContractPage.tsx`, `ContractCascade.tsx`, `ClauseDocument.tsx`, `ContractSubheader.tsx`, `ContractDrawer.tsx`, `ContractActivityCard.tsx`, `ContractChangeRequests.tsx`, `PartyDocumentView.tsx` |
| 3 | `/app/contracts/:id` **as staff, authoring** → *Add Item* | `AddElementModal.tsx` |
| 4 | `/app/documents` → **Read** | `DocumentsContent.tsx` |
| 5 | staff → the documents queue | `DocumentsQueuePage.tsx`, `DocumentQueueTable.tsx` |
| 6 | staff → template/surface editor → a document surface, a form surface, an email surface | `DocumentSurface.tsx`, `FormSurface.tsx`, `EmailSurface.tsx`, `SurfaceVersions.tsx`, `TokenPicker.tsx` |

⚠️ **Path 6 is the one nobody walks by habit and it is 30 of your 210 refs.** **It must be in the
owner's checklist explicitly**, or this chunk ships looking done and is not.

## 8. THE TEST THIS MUST PASS
**Built from the validation criteria the owner agreed on 2026-09-01
(`docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 3): *"Walk the signing flow (onboarding docs list →
reader → sign, plus /app/contracts/:id as a party): zero brown on icons, checkmarks, text, borders,
highlights, buttons."*** ⚠️ **Renders are NOT verified by you. Items 4–9 are the numbered checklist you
hand the owner, and it must name the phone.**

1. 🔒 **`grep -rE 'gold-[0-9]+' <your 18 files>` returns ZERO.** State the command and its output.
   `grep -rE 'gold-[0-9]+' src | wc -l` drops from 568 to **358** (568 − 210), assuming `C` merged and
   `E`/`F` have not. ⚠️ **If the number is not what you predict, find out why before reporting.**
2. 🔒 **THE T1 PROOF — THE BUILT CSS.** After `npm run build`, for **every distinct green class you
   introduced**, prove a rule exists in `dist/assets/*.css`. The cheap complete form:
   list your distinct new classes, then grep the built CSS for each one's selector or its emitted
   colour value. ⚠️ **Report the list and the per-class result. "The build succeeded" is not this test.**
   Also: `grep -o '#ba9935\|#7a6421\|#5c4a18' dist/assets/*.css | sort | uniq -c` — must still be
   **non-zero**, because the keepers in `E`'s files use it.
3. `npx tsc --noEmit` clean; `npm run build` succeeds. ⚠️ **`npm run test:db` is red at baseline and
   proves nothing** — do not report it either way.
4. **`/app/onboarding`, the whole flow**: the documents list, the reader, the e-sign consent, the sign
   button, every "needs you" panel — **zero brown**. The completed-document **strikethrough is
   unchanged** (§4d).
5. **`/app/contracts/:id` as a party**: banner strips, proposed-change cards, amendment cards, the
   activity card, the drawer, the subheader — **zero brown**.
6. 🔒 **THE AFFORDANCE TEST, and it is the one that matters.** On a contract with unfilled fields:
   **can you still tell, at a glance, which parts of the page you are meant to fill in?**
   Specifically — the inline field underlines, the ⟦NEEDS⟧ dashed marks, and the "Add …" controls must
   each still read as *"this is a control"* against the green page. ⚠️ **Answer this in words in your
   report, with a screenshot. If the answer is no, say so — that is a finding, not a failure.**
7. **Staff authoring**: *Add Item* → the element pills, the unsaved-draft dot, the buttons — **zero
   brown**, and the unsaved-draft dot is still visible against its background.
8. **The surface editors** (path 6): notice blocks, badges, the token picker — **zero brown**.
9. **The keepers are untouched** — the avatar ring on a contact card, the selected nav row, the
   notification count are **still gold**. ⚠️ **You did not edit those files; this item proves you did
   not reach them by accident.**
10. **Every §4c deviation is listed in your report with its reason and, for item 3, its contrast ratio.**

## 9. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-D-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-D-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies your claims itself. **You do not push.**
