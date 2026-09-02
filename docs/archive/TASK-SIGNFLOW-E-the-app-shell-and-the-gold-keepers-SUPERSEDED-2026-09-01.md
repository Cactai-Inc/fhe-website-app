> # ⚠️ SUPERSEDED 2026-09-01, BEFORE IT WAS EVER DISPATCHED — DO NOT BUILD THIS
> **The owner narrowed CR-102 the same day it was specced.** Verbatim: *"just change the items to
> green, leave the gold used in the app nav and other accents throughout the app in their light gold
> color. the signing flow from first page through the last should switch the gold to green for sure.
> other pages can be evaluated on a case by case basis when i have the opportunity to view them.
> dont change things in the app arbitrarily."*
> 🔒 **The four-chunk app-wide split (C/D/E/F) is void. The live spec is
> `docs/tasks/TASK-SIGNFLOW-C-green-the-signing-flow-end-to-end.md`.**
> ⚠️ **He also rejected this spec's central premise** — that gold-vs-green carries the "this is a
> fillable control, not the document" signal. *"the document is set inside a contained box that is
> clearly differentiated from the app surface. and green vs gold would not change how the viewer
> interprets whether or not the content is an app surface."* **He is right; the containment does
> that work, not the hue.** Kept only for its measurements.

---

# TASK-SIGNFLOW-E — the app shell, and the gold that must SURVIVE

**Spec by `FHE-DSNR-SIGNFLOW`, 2026-09-01. Change order: `CR-102`, chunk 3 of 4.**
**Thread name: `FHE-TASK-SIGNFLOW-E`.**
🔒 **MUST NOT START UNTIL `TASK-SIGNFLOW-C` HAS MERGED.** ⚠️ **If
`docs/reports/TASK-SIGNFLOW-C-REPORT.md` does not exist, stop and ask `ORCH` through the owner.**

🔒 **THIS IS A SMALL CHUNK ON PURPOSE. Four files. It exists SEPARATELY from the 70-file sweep
(`TASK-SIGNFLOW-F`) because EVERY gold the owner said to KEEP lives in these four files.** ⚠️ **Buried
at file 60 of a mechanical sweep, one of them gets greened and a semantic distinction dies silently.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` · `docs/method/CLNR-ROLE.md` §3 · `docs/method/THE-RUNNING-RECORD.md`
>   (open `docs/reports/FHE-TASK-SIGNFLOW-E-LEDGER.md` FIRST).
> - 🔒 **`docs/tasks/TASK-SIGNFLOW-C-the-decorative-functional-rule-and-the-global-classes.md` §3, §3a,
>   §3b — the rule, the mapping, and the keeper list.**
> - 🔒 **`docs/reports/TASK-SIGNFLOW-C-REPORT.md` — the mapping block verbatim, plus C's deviations.**
> - `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-102 — the owner's full verbatim ruling.

---

## 1. THE OWNER'S WORDS — and this chunk is the half he said NOT to change

> **KEEPS GOLD:** *"the avatar ring on contact cards, nav selected state, notification count — the
> acceptable uses for the nice gold color."*
> **GOES GREEN:** *"anything that is a functional action element or something like an icon or text."*
> — owner, 2026-09-01, `docs/reference/CHANGE-ORDER-LEDGER.md` §CR-102

**Every one of the three things he named to keep is in your four files.**

## 2. WHAT WAS MEASURED — re-run by DSNR on 2026-09-01

🔒 **YOUR FILE LIST, EXHAUSTIVE. 4 files, 47 numeric `gold-*` refs, 0 `gold-ink`.**

| File | `gold-[0-9]+` |
|---|---:|
| `src/components/app/AppLayout.tsx` | 27 |
| `src/components/layout/Header.tsx` | 13 |
| `src/components/layout/Footer.tsx` | 5 |
| `src/components/app/RosterCard.tsx` | 2 |
| **total** | **47** |

## 3. 🔒 THE SITE-BY-SITE RULING — DSNR has classified all 47. Execute it.
⚠️ **Re-grep every line number before you use it. If a ruling is wrong, say so and STOP —
`docs/method/TASK-ROLE.md` §1.**

### 3a. 🟡 KEEPERS — DO NOT TOUCH. Named by the owner, or semantic.

| Site | What it is | Why it survives |
|---|---|---|
| `RosterCard.tsx:83` `gold: 'ring-gold-600'` | the contact-card **avatar ring** | ⚠️ **SEMANTIC, not decorative.** `RosterCard.tsx:76-78`: gold = client, green = account, grey = guest. **Greening it collapses three states into two.** The owner named it too |
| `Header.tsx:151` `overDark ? 'bg-gold-300' : 'bg-gold-700'` | the public **nav underline** | the owner's "nav selected state" |
| `Header.tsx:165` `bg-gold-600` | the **notification count** badge | named |
| `Header.tsx:344-345` `border-gold-300/70 text-gold-300` / `border-gold-700/60 text-gold-800` and `:342` `hover:bg-gold-600 hover:text-green-950 hover:border-gold-600` | the header's sign-in / CTA button | 🔒 **DSNR's call: KEEP.** `Header.tsx:319-323` records the owner's 2026-08-16 design for it verbatim — *"outlined in gold, and the outline FILLS gold on hover"* — with `overDark` swapping the resting ink between the light and deep gold. **A locked design, and the "nav" region he blessed.** ⚠️ **See §7 SHAPE: this is the one he may reverse** |
| `Header.tsx:179` `border-b border-gold-600/25`, `:373` `border-t border-gold-600/20` | the frosted header/menu **hairline rules** | decorative, light gold, same family as `.rule-gold` (which `C` kept) |
| `AppLayout.tsx:120`, `:163`, `:1111`, `:1120` `decoration-gold-600` | the app nav row's **underline**, idle + hover + selected | the owner's "nav selected state". ⚠️ `AppLayout.tsx:83-163` records a long, hard-won ruling about this exact token (*"it renders a color dark first and then it lightens to gold"*). **Do not touch it** |
| `AppLayout.tsx:253` `NAV_BADGE = 'bg-gold-500 text-green-950'`; `:954`, `:1790`, `:1816` `bg-gold-600/70 text-white` | the nav **count badges** | the owner's "notification count" |
| `AppLayout.tsx:1933` `bg-green-950 text-gold-400` | the tenant monogram tile — **light gold on a dark green surface** | the blessed decorative case, and the optics agree |
| `Footer.tsx:54`, `:123`, `:140`, `:149`, `:158` `text-gold-400` | the footer eyebrow and its 4 contact **icons**, all on the **dark** footer | ⚠️ **These ARE icons, which the owner listed as functional — but `gold-400` on dark green is his blessed decorative case, and greening them would make them nearly invisible on a green ground.** 🔒 **DSNR's call: KEEP.** **See §7 SHAPE** |

### 3b. 🟢 GOES GREEN — apply `C` §3a's mapping, same numeric step (`gold-N` → `green-N`)

| Site | What it is |
|---|---|
| `AppLayout.tsx:1726` `className="btn-outline-gold"` | ⚠️ **NO EDIT** — `C` already made that class green. **Count it as done; do not replace the class name** |
| `AppLayout.tsx:1875` `bg-gold-50 border-b border-gold-500/40`, `:1878`, `:1883`, `:1892` `text-gold-900*` | a **banner strip with an action** — functional → `bg-green-50 border-green-500/40 text-green-900` |
| `AppLayout.tsx:1905` `bg-gold-50 border-b border-gold-600/40 text-gold-900` | same shape, same treatment |
| `AppLayout.tsx:2118`, `:2338` `text-gold-800` | the group's one-line **note text** on the light nav panel — **text on light → `text-green-800`** |
| any remaining site in your four files not listed in §3a | **green, same numeric step** |

⚠️ **The two lists above must together account for all 47.** **Reconcile them in your report:
`kept + greened + no-edit = 47`. A number that does not add up is a site nobody classified.**

## 4. THE TRAPS
- 🔒 **T1 — THE ARBITRARY-VALUE TRAP.** `border-green-900/12` emitted **no CSS at all** because `/12`
  is not in the scale (`docs/method/TASK-ROLE.md` §2a). **Prove every new class in the BUILT CSS** — §8.
- **T2 — `AppLayout.tsx` and `Header.tsx` carry the most heavily-commented design decisions in the
  repo.** `AppLayout.tsx:83-163`, `:251-253`, `:987`, `:1111-1112`; `Header.tsx:19`, `:150`, `:319-323`.
  ⚠️ **Read each comment before touching the line under it. Several are the owner's own words about
  why that exact token is that exact value.**
- **T3 — `text-gold-ink`, `focus-ring`, `btn-outline-gold`, `form-input`, `eyebrow` need NO edit.**
  `C` moved them. ⚠️ **Replacing a global class with an inline green is deleting a token and undoing
  `C`'s work.**
- **T4 — the "icons go green" rule and the "light gold on dark is decorative" rule COLLIDE in the
  footer**, and the collision is resolved in §3a: **keep.** ⚠️ **Do not re-litigate it in the build.**
  It is flagged to the owner in §7; if he reverses it, that comes back as an amended spec.
- **T5 — hue only.** No layout, spacing, radius, weight, tracking, or state-logic change anywhere.

## 5. OUT OF SCOPE — do not touch
- Any file not in §2's table. `C` owns `src/index.css` + `app-header.css`; `D` owns the 18
  document/contract files; `F` owns the remaining 70.
- `tailwind.config.js`. 🔒 **The gold scale STAYS — your four files are the main reason it exists.**
- `src/components/app/app-header.css` — **`C`'s file**, even though it is the same header.

## 6. THE REACH
| Path | Proves |
|---|---|
| the public site (`/`, `/about`) — scroll so the header goes frosted, hover a nav item | `Header.tsx` keepers + the hairline |
| the public header's sign-in / CTA button, over the hero **and** over a cream page | `Header.tsx:342-345` — both `overDark` states |
| the footer, on any public page | `Footer.tsx` — the eyebrow and the four icons |
| `/app` — the nav rail, a selected row, a row with an unread count | `AppLayout.tsx` keepers |
| `/app` → Records/Clients → a contact card for **a client, an account holder and a guest** | ⚠️ `RosterCard.tsx` — **all three ring colours, or the test proves nothing** |
| `/app` with an impersonation / verify-email banner showing | `AppLayout.tsx:1875-1905` — the greened strips |

## 7. ⚠️ THE SHAPE — `ORCH`: THE OWNER SHOULD SEE THESE TWO
**Per `docs/method/DSNR-ROLE.md` §4. Both are DSNR ruling against the literal text of his list, on the
strength of the rest of his sentence. Each is a small reversal if he disagrees.**

1. **The footer's four contact ICONS stay gold** (`Footer.tsx:123`, `:140`, `:149`, `:158`). He listed
   "icons" as functional. **But they are `gold-400` on the dark green footer — his own blessed
   decorative case — and green icons on a green ground would nearly vanish.** *If he wants them
   changed, the answer is white/`text-on-dark`, not green — four lines.*
2. **The public header's sign-in button stays gold** (`Header.tsx:342-345`). He listed "buttons" as
   functional. **But `Header.tsx:319-323` carries his own 2026-08-16 design for this specific control,
   and it sits in the nav region he named as a keeper.** *If he wants it green, it is three lines.*

## 8. THE TEST THIS MUST PASS
⚠️ **Renders are NOT verified by you. Items 4–8 are the numbered checklist you hand the owner, and it
must name the phone.**

1. `git diff --stat` shows **exactly the four files in §2**, and no others.
2. 🔒 **`kept + greened + no-edit = 47`**, reconciled per file in your report.
3. 🔒 **THE T1 PROOF — THE BUILT CSS.** After `npm run build`, for every distinct green class you
   introduced, show a rule exists in `dist/assets/*.css`. **And `grep -o '#ba9935' dist/assets/*.css |
   wc -l` must still be non-zero** — the keepers depend on it. **Report both greps and their output.**
4. `npx tsc --noEmit` clean; `npm run build` succeeds. ⚠️ **`npm run test:db` is red at baseline and
   proves nothing** — do not report it either way.
5. 🔒 **THE KEEPERS, EACH NAMED AND EACH CONFIRMED GOLD:** the contact-card avatar ring **for a client**
   (and green for an account holder, grey for a guest — **all three**); the selected `/app` nav row's
   underline; a nav count badge; the public nav underline; the public notification count; the frosted
   header hairline; the tenant monogram tile; the footer icons.
   ⚠️ **This is the item this whole chunk exists for. Report each one individually, not as a group.**
6. **The greened sites**: the `/app` banner strips and the nav group notes are green, not brown.
7. **The public header CTA renders correctly in BOTH `overDark` states** — over the hero and over a
   cream page.
8. **The whole app still has gold in it.** ⚠️ **An app with no gold left anywhere means a keeper was
   greened, whichever chunk did it. Say so plainly if that is what you see.**

## 9. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-E-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-E-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies your claims itself. **You do not push.**
