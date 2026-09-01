# TASK-SIGNFLOW-C — the decorative/functional rule, and the global gold classes

**Spec by `FHE-DSNR-SIGNFLOW`, 2026-09-01. Change order: `CR-102`, chunk 1 of 4.**
**Thread name: `FHE-TASK-SIGNFLOW-C`.**
🔒 **`TASK-SIGNFLOW-D`, `-E` AND `-F` ALL DEPEND ON THIS FILE'S §3 TABLE. You are writing the rule they
execute. Getting the table right matters more than the diff.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements. **§2a is this task's whole risk: code that
>   reports success while emitting no CSS.**
> - `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-SIGNFLOW-C-LEDGER.md` FIRST.
> - `docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 3 — the discovery, the owner's scope ruling,
>   and the optical mechanism behind it.
> - `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-102 — the owner's full verbatim ruling.
> - `tailwind.config.js:63-108` — the green and gold scales. **Both are already complete; you are
>   adding no colour.**
> - `src/index.css` — **read the whole component layer (`:100-340`) before you edit one line of it.**

---

## 1. THE OWNER'S WORDS

> *"change the brown used on the things like icons, strikethru, checkmarks, text, boarders,
> highlights, and buttons in the doc signing flow to the company green color."*
> — owner, `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-102

🔒 **AND THE SCOPE RULING HE GAVE WHEN DISCO ASKED (2026-09-01) — this is the whole task:**
**The rule is DECORATIVE vs FUNCTIONAL, applied EVERYWHERE, not "the signing flow only".**
- **KEEPS GOLD — decorative accents:** the avatar ring on contact cards, the nav selected state, the
  notification count. *"the acceptable uses for the nice gold color."*
- **GOES GREEN — functional:** *"anything that is a functional action element or something like an
  icon or text."* Buttons, icons, text, borders, highlights — in the signing flow *"and any other
  places its used."*

⚠️ **DISCO offered him "signing flow only" vs "app-wide", and he rejected the framing. Do not
re-introduce it. The axis is what the element DOES, not where it sits.**

## 2. WHAT WAS MEASURED — re-run by DSNR on 2026-09-01

⚠️ **DISCO's inventory does not reproduce. Use these numbers; re-run them yourself before you start.**

| Fact | Query | Result |
|---|---|---|
| Total numeric gold refs | `grep -rEo 'gold-[0-9]+' src \| wc -l` | **568** across **96 files** (DISCO said 590 — it used `gold-[0-9]*`, zero-or-more, which also counts `gold-ink` and prose) |
| Non-numeric gold class tokens | `grep -rEo 'gold-[a-z]+' src \| sed 's/.*://' \| sort \| uniq -c` | `gold-ink` ×55 · `gold-accent` ×2 · rest is prose in comments |
| By shade | `grep -rEo 'gold-[0-9]+' src \| sed 's/.*://' \| sort \| uniq -c \| sort -rn` | gold-800 ×159 · gold-50 ×104 · gold-600 ×80 · gold-400 ×74 · gold-900 ×56 · gold-200 ×24 · gold-700 ×19 · gold-500 ×19 · gold-300 ×19 · gold-100 ×14 |
| The brown IS the gold scale | `tailwind.config.js:99-108` | `gold-600 #ba9935` "Brand gold"; text-safe `gold-800 #7a6421` / `gold-900 #5c4a18` **read brown** |
| Company green | `tailwind.config.js:64-76` | `green-800 #143321` "Brand green" (the `.btn-primary` fill); `green-900 #0d2118`; `green-700 #1a4429`; `green-600 #215531` |
| The built CSS is greppable | `grep -o '#7a6421\|#5c4a18\|#ba9935' dist/assets/*.css \| sort \| uniq -c` | `#7a6421` ×4 · `#5c4a18` ×4 · `#ba9935` ×17. **This is your T1 proof mechanism.** |

**Adopter counts for every global class you will touch** (`grep -rl "\bCLASS\b" src --exclude=index.css`):

| Class | files | hits |
|---|---:|---:|
| `focus-ring` | 122 | 416 |
| `btn-primary` | 116 | 209 |
| `form-input` | 95 | 478 |
| `eyebrow` | 57 | 135 |
| `btn-outline-gold` | 44 | 80 |
| `text-gold-ink` | 30 | 53 |
| `link-underline` | 23 | 45 |
| `eyebrow-on-dark` | 4 | 7 |
| `rule-gold` | 3 | 3 |
| `btn-sign` | 3 | 3 |
| `step-complete` | 3 | 3 |
| `selectable-card` | 1 | 4 |
| `text-gold-accent` | **0** | **0** |

**And the split of the 568 across the four chunks, so you can see where your 34 sit:**
`C` (this task, `index.css` + `app-header.css`) **34** · `D` (18 document/contract files) **210** ·
`E` (4 app-shell/keeper files) **47** · `F` (the remaining 70 files) **277**. ⚠️ **34 + 210 + 47 + 277 = 568.**

## 3. 🔒 THE CLASSIFICATION TABLE — the deliverable, and `D`/`E` execute it

**Every gold site in `src/index.css` and `src/components/app/app-header.css`, classified.**
⚠️ **This table is DSNR's ruling. Execute it. If a row is wrong, say so and STOP — do not improve it
silently (`docs/method/TASK-ROLE.md` §1).**

| # | Site | What it is | Verdict | Change to |
|---|---|---|---|---|
| 1 | `index.css:155` `.text-gold-ink` → `text-gold-800` | **TEXT** on light. 30 files. | 🟢 **GREEN** | `text-green-800` |
| 2 | `index.css:163` `.eyebrow` → `text-gold-800` | label **TEXT** on light. 57 files. | 🟢 **GREEN** | `text-green-800` |
| 3 | `index.css:204` `.focus-ring` → `ring-gold-800` | **functional affordance**. 122 files. | 🟢 **GREEN** | `ring-green-800` |
| 4 | `index.css:215` `.btn-primary` focus ring | same | 🟢 **GREEN** | `ring-green-800` |
| 5 | `index.css:220-226` `.btn-outline-gold` — border, text, hover fill, disabled hover, focus ring | **A BUTTON.** Named by the owner. 44 files. | 🟢 **GREEN** | `border-green-800` · `text-green-800` · `hover:bg-green-800` · `disabled:hover:text-green-800` · `ring-green-800` |
| 6 | `index.css:246-256` `.btn-sign` — `bg/border-gold-800`, `hover:gold-700`, `active:gold-600`, focus ring | **THE SIGN BUTTON.** The most functional control in the app. | 🟢 **GREEN** | `bg/border-green-800` · `hover:bg/border-green-700` · `active:bg/border-green-600` · `ring-green-800`. ⚠️ **Preserve the three-step lighten and the disabled outline exactly** — see §4 T3 |
| 7 | `index.css:270` `.link-underline` focus ring | **functional affordance**. 23 files. | 🟢 **GREEN** | `ring-green-800` |
| 8 | `index.css:282` `.form-input` `focus:border-gold-800` + `focus:ring-gold-800/40` | **functional affordance**. 95 files. | 🟢 **GREEN** | `focus:border-green-800` · `focus:ring-green-800/40` |
| 9 | `index.css:318` `.step-complete` → `bg-gold-600` | a **completion state marker** — the owner named "checkmarks". | 🟢 **GREEN** | `bg-green-600` ⚠️ **not `green-800`** — `.step-active` (`:314`) is already `bg-green-800` and the two must stay distinguishable |
| 10 | `index.css:328` `.selectable-card` focus ring | **functional affordance**. | 🟢 **GREEN** | `ring-green-800` |
| 11 | `app-header.css:309` `outline: 2px solid #7a6421` | the avatar button's **focus outline** — the same token as #3, written as raw hex | 🟢 **GREEN** | `#143321`, and update the trailing comment to say `green-800` |
| 12 | `index.css:159` `.text-gold-accent` → `text-gold-400` | light gold **on dark**. **Zero adopters.** | 🟡 **KEEP, and FLAG** | no change. ⚠️ Add a one-line comment that it has no adopters, and put one line in your report. **Do not delete it** — that is `CLNR`'s call, not yours |
| 13 | `index.css:167` `.eyebrow-on-dark` → `text-gold-400` | light gold **on dark**. The decorative case the owner blessed. | 🟡 **KEEP** | no change |
| 14 | `index.css:193-195` `.rule-gold` → `border-gold-600/30` | a **decorative divider hairline**, light gold at 30%, same family as the nav hairline the owner named a keeper. 3 files. | 🟡 **KEEP** | no change. ⚠️ **This is the one row the owner may reverse — see §7 SHAPE** |

### 🔒 3a. THE MAPPING `D`, `E` AND `F` WILL APPLY — write it down where they can read it

**Add this as a comment block at the top of `src/index.css`'s component layer, and reproduce it
verbatim in your report.** It is the artefact, not the diff.

```
CR-102 — the decorative/functional rule (owner, 2026-09-01).
FUNCTIONAL → GREEN. An action element, an icon, text, a border, a highlight, a focus
  affordance, a state marker.
    gold-900 → green-900      gold-800 → green-800      gold-700 → green-700
    gold-600 (as a fill/border on a functional element) → green-600
    gold-50/100/200 (as a functional highlight or field wash) → the green equivalent
DECORATIVE → STAYS GOLD. A small light-gold accent, almost always on a DARK green surface.
    the avatar ring · the nav selected state and its underline · the notification count
    · light-gold text on dark (gold-300/400) · decorative hairline rules
THE OPTICAL TELL that agrees with the rule: dark gold (800/900) at TEXT weight on the light
  cream page reads BROWN. Light gold (300/400/600) as a small accent on dark reads GOLD.
  Classify by FUNCTION; the optics confirm the call.
```

### 3b. THE NAMED KEEPERS — verified by DSNR. **They all live in `E`'s four files;** `D` and `F` must never reach them
- `src/components/app/RosterCard.tsx:83` `ring-gold-600`. ⚠️ **It is SEMANTIC, not decorative:**
  `:76-78` proves gold = client, green = account, grey = guest. **Greening it destroys a distinction.**
- `src/components/layout/Header.tsx:151` nav underline `bg-gold-300` / `bg-gold-700`.
- `src/components/layout/Header.tsx:165` notification count badge `bg-gold-600`.
- `src/components/app/AppLayout.tsx:120`, `:163` nav underline `decoration-gold-600`; `:253`
  `NAV_BADGE = 'bg-gold-500 text-green-950'`; `:954`, `:1790`, `:1816` count badges `bg-gold-600/70`.

## 4. THE TRAPS
- 🔒 **T1 — THE ARBITRARY-VALUE TRAP, AND IT HAS BITTEN THIS REPO TWICE.**
  `border-green-900/12` emitted **no CSS rule at all** because `/12` is not in the scale
  (`docs/method/TASK-ROLE.md` §2a; `tailwind.config.js:13-22`). **Every opacity suffix you write must
  already exist in the config or in Tailwind's default alpha set.** ⚠️ **`focus:ring-green-800/40`
  (row 8) is exactly this shape — prove it emitted.** See §8 item 2. **A screenshot is not proof; the
  built CSS is.**
- **T2 — a class change is invisible in the diff and enormous on screen.** Row 3 alone repaints the
  focus ring in 122 files. **That is intended** (the owner ruled app-wide) **but your report must
  state the blast radius per row**, from the table in §2.
- **T3 — `.btn-sign` carries a locked design you must preserve.** `index.css:228-245` records the
  owner's 2026-08-24 ruling verbatim: *"when the name matches and the sign button becomes active, make
  it a full fill color so they know its active … and the full fill can then lighten on click"*, plus
  *"lighten on mouseover"*. **ARMED fills · HOVER lifts · PRESS lifts again · DISABLED is a muted
  outline, not a dimmer fill.** ⚠️ **Change only the hue. If your green version collapses two of those
  three steps into one visible state, you have broken a locked design — say so and stop.**
  ⚠️ **Update that comment block to say green** — leaving it saying "ARMED fills gold-800" recreates
  exactly the lying-comment defect `TASK-SIGNFLOW-A` is fixing in `ContractCascade.tsx`.
- **T4 — `.btn-sign` will now look very like `.btn-primary`** (`bg-green-800`, `hover:bg-green-700`).
  🔒 **That is accepted, deliberately, by DSNR.** They are both "the committing button"; the sign
  button keeps its own class for its armed/disabled behaviour, which `.btn-primary` does not have.
  **Do not invent a differentiating tint to avoid it.**
- **T5 — the file header lies after you edit it.** `index.css:4-22` documents the palette and the
  semantic tokens, including `Gold Text: #7a6421 (gold-800, the gold-for-text token on light, 5.39:1
  on cream)` and `.text-gold-ink gold-800`. **Rewrite it.** Also `app-header.css:309`'s trailing
  comment (row 11).
- **T6 — the class NAMES become half-lies, and you are NOT renaming them.**
  `.btn-outline-gold` will paint green; `.text-gold-ink` will paint green; `.rule-gold` stays gold.
  🔒 **DSNR's ruling: DO NOT RENAME.** 80 + 53 call sites across 74 files, touched by `D` and `E`
  concurrently, is a merge conflict with no design value. **Add a comment at each renamed-in-spirit
  class saying it is CR-102-green and kept under its old name deliberately**, and put the rename in
  your report as **one line** under "flagged, not fixed" for a later `CLNR` pass.
- **T7 — contrast.** `gold-800 #7a6421` is 5.39:1 on cream. `green-800 #143321` is far darker, so
  every GREEN row **improves** contrast on light. ⚠️ **The one to check is row 9**: white text on
  `green-600 #215531`. Compute it and state the ratio; if it is under 4.5:1, use `green-700` and say
  you did.

## 5. OUT OF SCOPE — do not touch
- 🔒 **ANY `.tsx` FILE.** ⚠️ **You edit exactly two files: `src/index.css` and
  `src/components/app/app-header.css`.** Inline `gold-*` refs in components belong to **`D`** (the 18
  document/contract/signing files), **`E`** (the 4 app-shell files that hold every keeper) and **`F`**
  (the remaining 70). **All three run against your table; if you also start editing components you
  will collide with all three.**
- `tailwind.config.js`. **The gold scale stays.** It is still used by every keeper. **Adding or
  removing a colour is not part of this task.**
- The named keepers in §3b.
- Any behaviour, layout, spacing, radius, font or state logic. **Hue only.**

## 6. THE REACH — what a person clicks
⚠️ **This task has no new surface and no new control. Its "reach" is that every existing adopter of
the classes in §3 changes appearance at once.** The paths that prove it:

| Path | Proves |
|---|---|
| `/app/onboarding` → the signing step | `.btn-sign` (rows 6, and the focus ring on every control) |
| any page with a form (`/sign/...`, `/app/onboarding`) | `.form-input` focus (row 8), `.eyebrow` (row 2) |
| tab through any page | `.focus-ring` (row 3) — **use the keyboard; a mouse never shows it** |
| the public marketing pages (`/`, `/about`, `/services`) | `.btn-outline-gold` (row 5), `.eyebrow` (row 2), `.rule-gold` (row 14, unchanged) |
| any multi-step flow with a step indicator | `.step-complete` (row 9) |
| `/app` nav + a contact card | the **keepers** — §3b must be unchanged |

## 7. ⚠️ THE SHAPE — `ORCH`: THE OWNER SHOULD SEE THESE TWO BEFORE THIS BUILDS
**Per `docs/method/DSNR-ROLE.md` §4, a changed visible state is a shape and needs his eyes.**
Both are one-line reversals if he rules otherwise; neither blocks `A`, `B`, `D` or `E`.

1. **`.eyebrow` in 57 files goes from gold to green** (row 2). It becomes tonally very close to
   `.form-label` (`green-800/85`, also uppercase and tracked). The eyebrow keeps its identity from
   `tracking-widest` + size, not colour. **DSNR's call: green, because the owner's rule says text.**
   *If he wants eyebrows kept as a decorative flourish, that is row 2 reverting — one line.*
2. **`.rule-gold` stays gold** (row 14). It is a decorative divider, but the owner's list did say
   "boarders". **DSNR's call: KEEP, because it is a light gold hairline in the same family as the nav
   hairline he explicitly blessed, and it is not attached to any action.** *If he wants it green, that
   is one line and 3 adopters.*

## 8. THE TEST THIS MUST PASS
**Built from the validation criteria the owner agreed on 2026-09-01
(`docs/reports/FHE-DISCO-SIGNFLOW-HANDOFF.md` §ITEM 3).** ⚠️ **Renders are NOT verified by you. Items
4–7 are the numbered checklist you hand the owner, and it must name the phone.**

1. `git diff --stat` shows **exactly two files changed**: `src/index.css`,
   `src/components/app/app-header.css`. ⚠️ **Any third file is a failure of this chunk.**
2. 🔒 **THE T1 PROOF — THE BUILT CSS, NOT THE SOURCE.** After `npm run build`:
   - `grep -c '#7a6421' dist/assets/*.css` — was **4**; report the new number and account for every
     remaining occurrence by which keeper produces it.
   - `grep -o '#143321' dist/assets/*.css | wc -l` — report before and after; it must **rise**.
   - ⚠️ **`grep -o 'rgba(20, 51, 33' dist/assets/*.css`** (or whatever form the compiler emits for
     `green-800/40`) — **prove row 8's `focus:ring-green-800/40` emitted an actual rule.** If the
     alpha form emits nothing, that is the T1 trap firing and the row must use a scale value that
     does emit. **State the exact grep you ran and its output.**
   - `grep -o '#ba9935' dist/assets/*.css | wc -l` — was **17**; it must still be **non-zero**, because
     the keepers use it. **Zero here means you greened a keeper.**
3. `npx tsc --noEmit` clean; `npm run build` succeeds. ⚠️ **`npm run test:db` is red at baseline and
   proves nothing** — do not report it either way.
4. **Tab through `/app/onboarding` with the keyboard**: every focus ring is green, none is brown.
5. **The signing step**: with the typed name not yet matching, the sign button is a **muted outline**;
   when it matches it becomes a **filled green**; hovering lightens it; pressing lightens it again.
   ⚠️ **All four states, named individually in the report.**
6. **The keepers, on `/app`**: the contact-card avatar ring is still **gold**; the selected nav row's
   underline is still **gold**; the notification count is still **gold**. ⚠️ **If any of these turned
   green, revert and report — it means a keeper was reached through a global class.**
7. **The public pages** (`/`, `/about`): outline buttons are green, eyebrow labels are green, the
   divider hairlines are still gold.
8. **The §3a mapping block is in `src/index.css` and verbatim in your report.** `D`, `E` and `F` read
   it from your report; **if it is not there, none of them can run.**
9. **The blast radius per row from §2's adopter table is in your report.**

## 9. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-C-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-C-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies your claims itself. **You do not push.**
