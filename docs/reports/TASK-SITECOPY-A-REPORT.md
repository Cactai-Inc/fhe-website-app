# TASK-SITECOPY-A — REPORT

**Worktree:** `wt-2` · branch `task/sitecopy-a` · merge-base `c23dc022` (origin/main at checkout) ·
commit `0e65023e`.

**CLNR: clean.** `docs/` root has 0 loose files. Pre-existing extra top-level folders
(`docs/contract-exports`, `docs/ui-orders`, `docs/staged`, `docs/proposed`, `docs/contract-content`)
are known, longstanding drift outside `CLNR-ROLE.md` §2a's canonical set — not new, not caused by or
blocking this task. Reported per §4, not fixed: a full sweep of that drift is its own unit of work.

## 1. Headline

All 10 strings from spec §2 swapped: `hunter/jumper` → `jumper`, and `barn` → `program … at Carmel
Creek Ranch` (the one line carrying both). Smallest-diff edits only, four files, one commit
(`0e65023e`). `typecheck`, `lint`, `build` all pass with no new warnings. Three of the ten edits are
production-inert per TRAP 1's mechanism — not four, see §6 below.

## 2. THE TEST, criterion by criterion

**1. `/` in a real browser at production build.**
No browser tool is available to me (`TASK-ROLE.md` §3: renders are not verified by this role, no
staff login exists — and no headless browser is installed in this worktree; confirmed no `playwright`
binary in `node_modules/.bin`). I instead read the exact bytes Vite's prerender step wrote to
`dist/`, which **is** the DOM a browser receives before hydration, for the routes that are
prerendered:
```
$ grep -o '<title[^<]*</title>' dist/index.html
<title data-rh="true">French Heritage Equestrian — Jumper Lessons &amp; Training | Coastal San Diego</title>
```
Title: **PASS**, reads "Jumper," not "Hunter/Jumper."
Description: **the spec's own target text for this criterion cannot appear.** `dist/index.html`'s
rendered `<meta name="description">` is Helmet's, sourced from `ROUTE_SEO['/'].description` —
`"Join our community of riders, where camaraderie, enjoyment, and a love for horses come together."`
— a wholly different, pre-existing string that never contained "hunter/jumper" or "barn" and was never
in this task's 10-string scope. The index.html:19 edit (which *does* read "a family-run jumper program
… at Carmel Creek Ranch") is real and correct in the source, but per TRAP 1 it is stripped by
`scripts/prerender.mjs:47-50` before any production browser sees it. **MADE — NOT
BROWSER-VERIFIABLE**, and additionally: even the *target text* named in this test criterion is not
achievable in production, because the field it names is a different field than the one that renders.

**2. `/about`, `/lessons`, `/acquisition` — rendered meta description.** Read from `dist/`:
```
$ grep -o 'name="description" content="[^"]*"' dist/about/index.html
name="description" content="A family story that began in Europe and came home to coastal San Diego. Classical jumper horsemanship, patient teaching, and the horse first — always."
$ grep -o 'name="description" content="[^"]*"' dist/lessons/index.html
name="description" content="Private jumper riding lessons in coastal San Diego — book a single lesson or a multi-pack. Classical instruction for returning and adult-amateur riders."
$ grep -o 'name="description" content="[^"]*"' dist/acquisition/index.html
name="description" content="Expert jumper horse acquisition: search, pre-purchase and lease evaluation, and full brokering, drawn from years in the discipline. Serving San Diego."
```
**PASS**, all three match §2's target text exactly, read from the built DOM.

**3. `/services` — services list and acquisition paragraph.** `/services` is not prerendered (confirmed
below, §6), and no browser tool is available to render its client-side output. Verified at the source
instead — the only two rendered strings this task touches on that page:
```
src/pages/Services.tsx:34:      'Jumper training',
src/pages/Services.tsx:63:      "...drawing on years in the jumper world to find the right horse..."
```
No other transform sits between this array/string literal and the rendered `<li>`/paragraph text.
**MADE — NOT BROWSER-VERIFIABLE** (no rendering tool, and the route ships no static HTML to inspect
either). **Owner checklist item below.**

**4. `/about` body copy.**
```
$ grep -o 'classical jumper tradition' dist/about/index.html
classical jumper tradition
$ grep -o 'best barns are not really about the riding at all' dist/about/index.html
best barns are not really about the riding at all
```
**PASS on both** — the swap landed, and `About.tsx:88`'s unrelated "best barns" sentence is
untouched, present verbatim in the built DOM.

**5. `index.html:18` / `src/lib/seo.ts:63` byte-identity.**
```python
>>> title from index.html:18: 'French Heritage Equestrian — Jumper Lessons & Training | Coastal San Diego'
>>> title from seo.ts:63:      'French Heritage Equestrian — Jumper Lessons & Training | Coastal San Diego'
IDENTICAL
```
**PASS.**

**6. Character counts, every `ROUTE_SEO` description touched:**
| Line | Length |
|---|---|
| `seo.ts:73` (`/about`) | **150** |
| `seo.ts:98` (`/ride`) | **150** |
| `seo.ts:142` (`/lessons`) | **152** |
| `seo.ts:160` (`/acquisition`) | **150** |

All four under the ~155-char ceiling. **`index.html:19` is not a `ROUTE_SEO` entry and TRAP 3's
ceiling does not name it** — but for the record, it measures **178 characters**. Flagging this as
information, not a violation: TRAP 3 and this test item both scope the ceiling to `ROUTE_SEO[].description` only, and index.html:19 is additionally inert per §4/criterion 1 above, so its length has no SEO consequence today.

**7. `grep -rn -i "hunter" index.html src/pages src/lib/seo.ts src/components`:**
```
(zero output)
```
**PASS — zero hits.**

**8. `grep -rn -i "barn" index.html src/lib/seo.ts src/pages/About.tsx src/pages/Services.tsx`:**
```
src/pages/About.tsx:88:                riding. And the best barns are not really about the riding at all. They are about
```
**PASS — only `About.tsx:88`, as required.**

**9. The inert edits, reported as `MADE — NOT BROWSER-VERIFIABLE`:**
- `index.html:18` (title) — stripped by `scripts/prerender.mjs:47-50`; Helmet's title from `seo.ts:63`
  renders instead (and is identical text, so the *visible result* is correct, but not because of this
  line).
- `index.html:19` (description) — stripped the same way; Helmet's `/` description renders instead,
  and — see criterion 1 — that field is a *different string* that was never in scope.
- `seo.ts:98` (`/ride`, #5) — `App.tsx:179` redirects `/ride` to `/lessons`; the prerendered
  `dist/ride/index.html` has an empty `<title data-rh="true"></title>`, no description meta at all,
  and a 29-byte empty `<main>`. Confirmed:
  ```
  $ grep -n '<title' dist/ride/index.html
  <title data-rh="true"></title>
  $ grep -o 'name="description" content="[^"]*"' dist/ride/index.html
  (no output)
  ```

⚠️ **Correcting the spec: TRAP 1 claims FOUR of the ten edits are inert. Measurement finds THREE** —
the three above. `seo.ts:63` (#3, `/`'s title) is **not** inert: it is the exact string Helmet renders
on `/` in production (proven in criterion 1/test 5), unlike its paired `index.html:18`. TRAP 1 never
names a fourth inert edit explicitly (it names #1, #2, and #5 by number, plus "the `/shop` entry,"
which isn't one of this task's ten edits — `/shop`'s description was already correct and untouched
per §2's do-not-touch table). I could not find a fourth. Flagging per D20/TASK-ROLE §7 ("where the
spec was wrong") rather than reporting a false count.

**10. `npm run build` completes, no new warnings.**
Completes in 4.52s. Warnings present (chunk-size >500kB, `caniuse-lite` outdated, `documentPdf.ts`
dual-import, `<Navigate>` on initial render for `/shop`/`/ride`) are all structural/pre-existing and
unrelated to the four files this task touched — none reference `index.html`, `seo.ts`, `Services.tsx`,
or `About.tsx`. **PASS.**

## 3. THE REACH

No new surface — this task edits copy on existing, already-reachable routes:
- `/` — front door, brand-mark in `Header`. Reachable.
- `/about` — one link in the app, `Confirmation.tsx:206`, post-inquiry. Not in header/footer nav
  (pre-existing condition, unchanged by this task).
- `/lessons` — header nav "Book a Lesson," footer nav. Reachable.
- `/acquisition` — header nav "Find a Horse," footer "Acquisition Support." Reachable.
- `/services` — linked from `Checkout.tsx:121`, `NotFound.tsx:24`, `About.tsx:206`, `Account.tsx:114`.
  Not in either nav (pre-existing).
- `/ride` — no link anywhere in the app; renders blank regardless of this edit (TRAP 1, `TASK-SITESEO`
  owns the defect).

Nothing in this task changes reach; it only corrects text on routes that already exist and are
already linked exactly as they were before.

## 3b. §2c's three questions

This task captures no new value — it edits static copy strings, writes nothing to a database, and
sends nothing. **CAPTURE / SEEN / ACTED-ON are not applicable.** The one thing an outcome-lens adds
that nobody asked for: **the spec's own acceptance test (criterion 1) names a target that cannot be
seen in production**, because it conflates two different fields (`ROUTE_SEO['/'].description` vs.
`index.html:19`). That is called out in criterion 1 rather than silently passed.

## 4. FLAGGED, NOT FIXED

- **`/services` prerender-list divergence** (§6 of the spec, carried forward per §9): `/services` is
  `indexable: true` in `ROUTE_SEO` and absent from `scripts/prerender.mjs:21`'s `ROUTES` list, which
  claims to "match the indexable paths in `src/lib/seo.ts`." It does not — confirmed again in this
  task's own build log (`prerendered / -> ... /about -> ... /story -> ... /shop -> ... /faq -> ...
  /ride -> ... /membership -> ... /lessons -> ... /horse -> ... /acquisition ->`, no `/services`
  line). `/membership` is present and `indexable: false`. Not fixed here — belongs to
  `TASK-SITESEO`.
- **`docs/` has known extra folders outside `CLNR-ROLE.md` §2a** (`contract-exports`, `ui-orders`,
  `staged`, `proposed`, `contract-content`). Pre-existing, not new, not blocking. One line per §4 of
  `TASK-ROLE.md`.

## 5. Decided, not in the spec

- **Worktree self-assignment.** No ORCH dispatch line named a `wt-<n>` for this thread — the owner
  invoked directly. `wt-1` and `wt-3` were occupied by live threads (`task/signflow-d`,
  `task/signflow-b`) at the moment checked in-turn; `wt-2` was clean and detached (confirmed
  immediately before checkout, same turn, per the guard). Self-assigned `wt-2` rather than stopping,
  since the "ask ORCH through the owner" escalation path resolves to the owner directly in this
  session and the choice was mechanical (only one idle slot existed), not a judgment call.
- **How criteria 1 and 3 of THE TEST were verified.** The spec asks for "a real browser." None is
  available to this role (`TASK-ROLE.md` §3, and no headless-browser tool is installed in this
  worktree). Substituted the built `dist/` DOM output for every prerendered route (byte-identical to
  what a browser's initial paint receives) and flagged the two routes (`/services`'s live render,
  and the fact that `/`'s literal target description text is unreachable regardless of tooling) as
  not browser-verifiable, rather than fabricating a browser check.

## 6. Where the spec was wrong

**TRAP 1's "FOUR of the ten edits are inert" is an overcount.** Measured: three are inert
(`index.html:18`, `index.html:19`, `seo.ts:98`). `seo.ts:63` — paired with `index.html:18` as "the
same fix, verbatim" — is *not* inert; it is the exact title Helmet renders on `/` in production,
confirmed against `dist/index.html`. See §2, test 9, for the full account. No fourth inert edit is
identifiable from the spec's own text.

**Test criterion 1's description clause is unmeetable as written.** It names target text that lives
at `index.html:19`, but the field that actually renders on `/` (`ROUTE_SEO['/'].description`) is a
different, unedited string. This isn't a defect in the edit — both fields are now internally correct
for what each contains — but the criterion cannot pass as literally stated in a real browser, for the
same TRAP-1 reason index.html:19 itself is inert.

## 7. `typecheck` · `lint` · `build`

- `typecheck` (`tsc --noEmit -p tsconfig.app.json`): **0 errors.**
- `lint`: **46 warnings, 0 errors** — all pre-existing (`react-refresh/only-export-components`,
  `react-hooks/exhaustive-deps`), none in the four touched files.
- `build`: **succeeds, 4.52s**, `dist/` regenerated. No new warnings (see §2, test 10).

## 8. The owner's render checklist

On your phone or laptop, in an actual browser tab (not devtools' "view source" — the rendered page):
1. Load `frenchheritageequestrian.com/`. Browser tab title should read "…— Jumper Lessons & Training
   | Coastal San Diego" (no "Hunter/").
2. Load `/about`. View page source or devtools Elements → `<head>` → confirm the description meta
   starts "A family story that began in Europe… Classical jumper horsemanship…". Scroll to the
   paragraph starting "French Heritage Equestrian is a family story" — should read "the classical
   jumper tradition," and further down, the "best barns are not really about the riding at all"
   sentence should still be there, unchanged.
3. Load `/lessons` and `/acquisition`, check the `<head>` description meta on each (devtools →
   Elements → `<head>`) — no "hunter" in either.
4. Load `/services`. Confirm the services list shows "Jumper training" (not "Hunter/jumper training")
   and the acquisition-path paragraph reads "drawing on years in the jumper world." **This is the one
   page nobody but you can confirm** — it isn't prerendered and I have no browser to check it with.

## 9. TEARDOWN census

- No dev/preview server started or left running.
- No browser session opened.
- `wt-2` retained on branch `task/sitecopy-a`, commit `0e65023e`, not pushed — this is the
  deliverable worktree, not scratch; leaving it for ORCH's audit diff.
- No other scratch worktrees created.

---
## VALIDATION — ORCH, 2026-09-02
See TASK-SITECOPY-A-VERIFICATION.md beside this report — independently verified and merged; details there.
