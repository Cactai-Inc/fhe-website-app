# TASK-SITECOPY-A — jumper only, program not barn, in the public marketing copy

**Spec by `FHE-DSNR-SITE-PUBLIC`, 2026-09-01.**
**Thread name: `FHE-TASK-SITECOPY-A`.**
**Supersedes `docs/tasks/TASK-SITECOPY-jumper-only-program-not-barn.md`** (the owner's 2026-08-24
chat-thread draft), which is split into `-A` (this file) and `-B`. That file is retained, marked
superseded, and is **not** your source — this one is.

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements. **Not repeated here.**
> - `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-SITECOPY-A-LEDGER.md` FIRST.
> - `CLAUDE.md` **D17** (`:365`) — reachable, or it is not done. ⚠️ **§4 TRAP 1 is a D17 trap: four of
>   the seven strings below are edits nothing renders. You are told which, so you do not report a
>   false pass.**
> - `CLAUDE.md` **D20** (`:406`) — *"a state claim in a doc is a hypothesis."* Including this spec's.
> - `docs/design/refactor/CHAT-THREAD-ADMIN-REFACTOR-2026-08-26.md` **ruling 12** (`:104-112`) — the
>   two standing wording rulings this task applies. ⚠️ **They are NOT D-rules; that relay line is the
>   only place they are written down.**

---

## 1. THE OWNER'S WORDS

From ruling 12 of the planning-thread relay, owner-confirmed 2026-08-24:

> *"FHE is jumper-only, never hunter or hunter/jumper; FHE is a program operating out of Carmel Creek
> Ranch, not a barn; the brand tagline and Landing hero h1 are owner-confirmed and never touched."*

**Two rules. This chunk applies them to the public marketing copy. `-B` applies the second to the
transactional funnel, where the mechanism is different.**

## 2. WHAT WAS MEASURED — re-run by DSNR on 2026-09-01, nothing inherited

`grep -rn -i "hunter" index.html src/ --include="*.ts" --include="*.tsx" --include="*.html"` and the
same for `barn`, both run 2026-09-01 on `main` at `4297345a`.

### The seven strings in scope, each verified present today

| # | `file:line` | Today | Becomes |
|---|---|---|---|
| 1 | `index.html:18` | `<title>… — Hunter/Jumper Lessons & Training \| Coastal San Diego` | `… — Jumper Lessons & Training \| Coastal San Diego` |
| 2 | `index.html:19` | `A family-run hunter/jumper barn and community in coastal San Diego — …` | `A family-run jumper program and community at Carmel Creek Ranch in coastal San Diego — …` |
| 3 | `src/lib/seo.ts:63` | `'/'` title, byte-identical to #1 | the same fix as #1, **verbatim** |
| 4 | `src/lib/seo.ts:73` | `/about` desc — `Classical hunter/jumper horsemanship, …` | `Classical jumper horsemanship, …` |
| 5 | `src/lib/seo.ts:98` | `/ride` desc — `Classical hunter/jumper riding — …` | `Classical jumper riding — …` |
| 6 | `src/lib/seo.ts:142` | `/lessons` desc — `Private hunter/jumper riding lessons …` | `Private jumper riding lessons …` |
| 7 | `src/lib/seo.ts:160` | `/acquisition` desc — `Expert hunter/jumper horse acquisition: …` | `Expert jumper horse acquisition: …` |
| 8 | `src/pages/Services.tsx:34` | `'Hunter/jumper training'` | `'Jumper training'` |
| 9 | `src/pages/Services.tsx:63` | `… drawing on years in the hunter/jumper world …` | `… drawing on years in the jumper world …` |
| 10 | `src/pages/About.tsx:76` | `… the classical hunter/jumper tradition …` | `… the classical jumper tradition …` |

**#2 absorbs BOTH rules in one edit** — it is the only line in the repo carrying `hunter/jumper` and
`barn` together. **One edit, not two; do not sequence them.**

### Verified correct today — DO NOT TOUCH
| Thing | The measurement |
|---|---|
| `src/lib/seo.ts:89` — `/shop` description | already reads `jumper training`. **No change.** |
| `BUSINESS.description`, `src/lib/seo.ts:19-22` | already jumper-only, already program-framed. Its own comment (`:13-18`) explains why it deliberately differs from `ROUTE_SEO[].description`. **Leave the divergence.** |
| `BRAND.tagline`, `src/lib/brand.ts` | owner-confirmed. `brand.ts:19-22` says the live `BRAND.TAGLINE` row in `config_values` wins and this constant is byte-identical to it on purpose. **Editing it here would desynchronise the prerender path from the tenant config.** |
| `src/pages/Landing.tsx:126-127` — hero `h1` | `Join Our Riding Community / California Days Are Made For This`. Owner-confirmed. |
| `src/components/layout/Footer.tsx` | already jumper-only, already program-framed. |
| `src/pages/About.tsx:88` — *"the best barns are not really about the riding at all"* | **generic, about barns in general, not a claim FHE is one.** The 2026-08-24 draft flagged it so it would not be missed, not so it would be changed. ⚠️ **It stays. Do not "finish the sweep" here.** |
| `src/lib/serviceCatalog.ts:62` (`'hunter-jumper'` alias key), `src/lib/inquiry.ts:29,75` (matching legacy `service_type` string) | data-layer backward-compat. **Never rendered.** Changing them breaks stored rows. |
| `src/lib/acquisition.ts:48`, `src/lib/intakeCategoryFields.ts:26` | discipline-field placeholders describing what a **client** wants. Different context. |
| `src/lib/seed.ts:76,195`, `src/portal/__fixtures__/portalFixtures.ts:31` | dev/test fixtures. |
| `src/pages/Checkout.tsx:258` — `placeholder="Barn / property address"` | asks for the **client's** barn. |

## 3. THE INCUMBENT, NAMED (D18) — CONVERGENCE, and there is only one authority

**There is no second copy engine to converge.** `src/lib/seo.ts` `ROUTE_SEO` is the single per-route
title/description list; `seoForPath()` (`:170`) is its only reader, and every public page calls it.
**Do not add a page-local title.**

⚠️ **But name the real duplicate you are standing next to:** `index.html:18-19` and
`src/lib/seo.ts:63` hold **byte-identical strings by design** — the static tag is the pre-hydration
fallback for `/`. **They must still match after your edit.** If you change one and not the other you
have created exactly the divergence the pair exists to avoid.

## 4. THE TRAPS

**TRAP 1 — ⚠️ FOUR OF THESE TEN EDITS ARE INERT IN PRODUCTION, AND YOU MUST NOT REPORT THEM AS
VERIFIED.** Measured 2026-09-01 against the committed `dist/` (built today 17:19):

- **`index.html:18-19` (#1, #2) never reach a production browser.** `scripts/prerender.mjs:47-50`
  **strips** `<title>…</title>` and `<meta name="description">` out of the template, then injects
  Helmet's. Every route a visitor can load is served either from a prerendered directory or from
  `dist/index.html` — which is itself the prerender of `/`. Confirmed: `dist/index.html` contains
  exactly one title, `<title data-rh="true">`, i.e. Helmet's. **These two edits are correct and worth
  making — the dev server shows them, and the pair-with-`seo.ts` rule above depends on them — but do
  NOT claim you saw them in a browser.**
- **`seo.ts:98` (`/ride`, #5) and the `/shop` entry are dead.** `src/App.tsx:179` makes `/ride` a
  `<Navigate to="/lessons" replace />`, and `:173` does the same for `/shop`. The prerender renders
  the router, so `dist/ride/index.html` and `dist/shop/index.html` come out with
  **`<title data-rh="true"></title>` — empty — and a 29-byte empty `<main>`.** Measured on both files.
  **Make the `/ride` edit anyway** (the string is wrong, and it must already be right if those routes
  are ever revived) **and report it as UNVERIFIABLE, not as passed.**
  ⚠️ **The blank-page defect itself is NOT yours** — it is `TASK-SITESEO`
  (`docs/tasks/TASK-SITESEO-three-indexed-urls-prerender-a-blank-page.md`), and it is owner-gated.
  **Do not fix routing or the prerender list in this thread.**

**TRAP 2 — the word is "program", and the ranch is named.** #2's replacement adds `at Carmel Creek
Ranch`. **Do not write "barn", do not write "stable", and do not invent a shorter phrasing.** The
address block in `src/components/layout/Footer.tsx` already prints `Carmel Creek Ranch` above
`11500 Clews Ranch Rd, Ste A` — the description must agree with it.

**TRAP 3 — the ~155-character ceiling on `ROUTE_SEO[].description`.** `src/lib/seo.ts:13-18` states
it. #2 **grows** — it drops `hunter/` (7 chars) and adds `at Carmel Creek Ranch ` (22). ⚠️ **Measure
the final length of every description you touch and put the number in your report.** If #2 lands over
~160, say so and stop rather than trimming words the owner chose; that is an ASK-OWNER, not a
judgement call.

**TRAP 4 — smallest correct diff.** Swap the wrong word inside the existing sentence. **Do not
rewrite a sentence, re-order a clause, or "improve" adjacent copy.** Every one of these strings has
been through owner review; the only thing under review is the two wrong words.

**TRAP 5 — `Services.tsx:34` is an array item inside a services list, not prose.** Check that
capitalisation still matches its siblings after the swap (`'Jumper training'`, not `'jumper
training'`), and that nothing keys off the string value.

## 5. OUT OF SCOPE, EXPLICITLY

- **Everything in `-B`** — `src/pages/Confirmation.tsx` and `src/components/order/OrderPayment.tsx`.
- **Everything in `TASK-SITESEO`** — `src/App.tsx` routes, `scripts/prerender.mjs`,
  `scripts/seo-files.mjs`, `indexable` flags, the sitemap.
- **`About.tsx:88`.** See §2.
- **Any schema, migration, RPC, or admin surface.** This chunk is text in four files.
- **Adding `/about` or `/services` to a nav.** See §6 — their reach is thin, and that is a finding for
  your report, not a change.

## 6. THE REACH — what a person clicks, and whether it is the only way

| Route | How a person gets there | Prerendered? | In `sitemap.xml`? |
|---|---|---|---|
| `/` | the front door; brand-mark in `Header` | ✅ `dist/index.html` | ✅ |
| `/about` | ⚠️ **one link in the whole app** — `src/pages/Confirmation.tsx:206`, after an inquiry. **Not in the header nav, not in the footer nav.** | ✅ | ✅ |
| `/services` | `Checkout.tsx:121`, `NotFound.tsx:24`, `About.tsx:206`, `Account.tsx:114`. **Not in either nav.** | ❌ **not in `scripts/prerender.mjs:21`, despite `indexable: true`** | ❌ |
| `/lessons` | header nav *"Book a Lesson"*, footer nav | ✅ | ✅ |
| `/acquisition` | header nav *"Find a Horse"*, footer *"Acquisition Support"* | ✅ | ✅ |
| `/ride`, `/shop` | **no link anywhere** — `grep` for `to="/ride"` / `to="/shop"` returns 0 | ⚠️ blank page | ✅ ⚠️ |

⚠️ **Report the `/services` row.** `scripts/prerender.mjs:20` claims its list *"must match the
indexable paths in `src/lib/seo.ts`"*. It does not: `/services` is `indexable: true` and absent, and
`/membership` is `indexable: false` and present. **Do not fix it here — record it, so `TASK-SITESEO`
inherits a measured fact rather than a suspicion.**

## 7. THE TELL, AND HOW IT IS UNDONE (D19)

**No D19 flags.** Nothing here moves value, writes a row, or sends anything. **The tell is the
rendered page; the undo is `git revert`.** ⚠️ **Say that plainly in your report rather than leaving
the D19 section blank** — a reader must be able to see the question was asked.

## 8. THE TEST THIS MUST PASS

Numbered, and built from the owner's own 2026-08-24 acceptance line — *"verify by loading each route
in a real browser and reading the rendered title/meta/body text, not just the source"* — corrected for
what §4 TRAP 1 proves is actually loadable.

1. **`/` in a real browser at production build.** Rendered `<title>` reads `Jumper`, not
   `Hunter/Jumper`. Rendered `<meta name="description">` reads `a family-run jumper program and
   community at Carmel Creek Ranch`. **Read them from the DOM (devtools / `document.title`), not
   from the source file.**
2. **`/about`, `/lessons`, `/acquisition` in a real browser.** Each rendered meta description matches
   §2's target text exactly.
3. **`/services` in a real browser.** The services list shows `Jumper training`; the acquisition
   paragraph reads `years in the jumper world`. **Screenshot or quote the rendered text.**
4. **`/about` body copy.** Reads `the classical jumper tradition`. **And `About.tsx:88`'s "the best
   barns" sentence is still there, unchanged** — prove you did not over-sweep.
5. **`index.html:18` and `src/lib/seo.ts:63` are byte-identical after your edit.** Prove it with a
   command whose output is in the report (e.g. `diff <(...) <(...)`, or quote both lines).
6. **Character count of every `ROUTE_SEO` description you touched**, stated as a number. None over
   ~160 without an explicit flag.
7. **`grep -rn -i "hunter" index.html src/pages src/lib/seo.ts src/components`** returns **zero** hits
   outside the §2 do-not-touch list. Paste the output.
8. **`grep -rn -i "barn" index.html src/lib/seo.ts src/pages/About.tsx src/pages/Services.tsx`**
   returns only `About.tsx:88`. Paste the output.
9. **The four inert edits are reported as `MADE — NOT BROWSER-VERIFIABLE`**, with §4 TRAP 1's reason
   restated in one line each. ⚠️ **A report that claims to have seen `/ride`'s new description in a
   browser is a failed report**, because that page renders empty.
10. **`npm run build` completes** and `dist/` regenerates without new warnings.

## 9. WHERE THE REPORT GOES

`docs/reports/TASK-SITECOPY-A-REPORT.md`, plus the running ledger at
`docs/reports/FHE-TASK-SITECOPY-A-LEDGER.md`.
**Carry into the report, as its own section:** the `/services` prerender-list divergence (§6) and the
final character counts (§8.6). `TASK-SITESEO` reads both.
