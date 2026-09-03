# TASK-SITESEO — REPORT

**Thread:** `FHE-TASK-SITESEO` · **worktree** `wt-2` · branch `task/siteseo` · merge-base `b846b227`
(origin/main at claim; unchanged at close) · commits `ed275312` (code) + ledger/report commits.
**Spec:** `docs/tasks/TASK-SITESEO-three-indexed-urls-prerender-a-blank-page.md` · **ledger:**
`docs/reports/FHE-TASK-SITESEO-LEDGER.md`.

**CLNR: clean.** wt-2 guard passed (detached HEAD, `git status --porcelain` empty) immediately before
the checkout; `git clean -xdf -e node_modules -e .env -e .env.db` removed 0 files. No file this task
cites was moved. The known `docs/` top-level drift (contract-exports, ui-orders, staged, proposed,
contract-content) is unchanged and already recorded by SITECOPY-A.

## 1. Headline
- **One route list.** `scripts/prerender.mjs` and `scripts/seo-files.mjs` now both read
  `ROUTE_SEO` from `src/lib/seo.ts` through one new loader, `scripts/seo-config.mjs`, and filter on
  `indexable`. The two hardcoded arrays are gone; `indexable` now decides both prerender and sitemap.
- **The three blank pages are gone.** `/ride`, `/shop`, `/membership` are `indexable: false`, are not
  prerendered, are not in the sitemap, and are host-level `301`s to `/lessons` in `vercel.json`.
- **`/services` and `/faq` are prerendered and sitemapped** — `/services` because its existing
  `indexable: true` now means something; `/faq` via a new `ROUTE_SEO` entry copied from `Faq.tsx`.
- ⚠️ **Two criteria (6 and 9) need the deploy.** No Vercel CLI exists in this tree and I do not push;
  the `301` and the `/services` cold-HTML proofs run against production after ORCH merges. Commands
  are in §2 below.

## 2. THE TEST, criterion by criterion (every measurement from a fresh `rm -rf dist dist-ssr && npm run build` at `ed275312`)

**1. No prerendered file has an empty title.** All 8 `dist/**/index.html`:

| file | `<title data-rh="true">` (first 70 chars) | `<main>` bytes |
|---|---|---|
| `dist/about/index.html` | Our Story — A Lifetime of Classical Horsemanship | French Heritage Equ | 9907 |
| `dist/acquisition/index.html` | Horse Search, Evaluation &amp; Brokering | French Heritage Equestrian, | 2928 |
| `dist/faq/index.html` | Frequently Asked Questions | French Heritage Equestrian, San Diego | 2722 |
| `dist/horse/index.html` | Mobile Horse Training, Turnout &amp; Care | French Heritage Equestrian | 2831 |
| `dist/index.html` | French Heritage Equestrian — Jumper Lessons &amp; Training | Coastal S | 0 |
| `dist/lessons/index.html` | Riding Lessons — Single &amp; Multi-Pack | French Heritage Equestrian, | 3645 |
| `dist/services/index.html` | Ways to Ride — Lessons, Horse Care &amp; Acquisition | French Heritage | 7761 |
| `dist/story/index.html` | Come Ride With Us — A Women’s Riding Community in Coastal San Diego |  | 14500 |

**2. No prerendered file has an empty `<main>`.** Seven are 2,722–14,500 bytes. `dist/index.html` is
the one known exception (`Landing.tsx` renders bare, no `<main>` element at all — 0 bytes matched);
its title is the real `/` title above.

**3. Every sitemap `<loc>` resolves to a prerendered file, and none of the three redirect URLs appear.**
```
 -> dist/index.html EXISTS
/about -> dist/about/index.html EXISTS
/story -> dist/story/index.html EXISTS
/services -> dist/services/index.html EXISTS
/faq -> dist/faq/index.html EXISTS
/lessons -> dist/lessons/index.html EXISTS
/horse -> dist/horse/index.html EXISTS
/acquisition -> dist/acquisition/index.html EXISTS
```
`grep -c "ride\|shop\|membership" dist/sitemap.xml` → `0`. `ls -d dist/ride dist/shop dist/membership` → all
three "No such file or directory".

**4. One list, not three.** `grep -n "ROUTES\|routes\|ROUTE_SEO\|'/" scripts/prerender.mjs scripts/seo-files.mjs`:
```
scripts/seo-files.mjs:17:const { SITE_URL, ROUTE_SEO } = await loadSeo();
scripts/seo-files.mjs:18:const routes = indexableRoutes(ROUTE_SEO);
scripts/seo-files.mjs:22:const urls = routes
scripts/seo-files.mjs:24:    const loc = `${SITE_URL}${r.path === '/' ? '' : r.path}`;
scripts/prerender.mjs:43:  const { ROUTE_SEO } = await loadSeo();
scripts/prerender.mjs:44:  const ROUTES = indexableRoutes(ROUTE_SEO).map((r) => r.path);
scripts/prerender.mjs:46:  for (const url of ROUTES) {
scripts/prerender.mjs:59:    const outPath = url === '/'
```
No route literal remains in either script. `SITE_URL` also now comes from `seo.ts` instead of a
second copy in `seo-files.mjs`. The loader (`scripts/seo-config.mjs`) bundles `src/lib/seo.ts` with
Vite's SSR build into `dist-ssr/seo.js` and imports it — the same mechanism `prerender.mjs` already
used for `entry-server.tsx`. Chosen over Node's `--experimental-strip-types` because the Vercel build
image's Node version is not pinned (`package.json` has no `engines`, no `.nvmrc`).

**5. `indexable` now decides something.** Flipped `/about` to `indexable: false`, rebuilt: the prerender
log lost `/about`, `dist/about` was not written, and `diff` of the sitemap before/after:
```
9,13d8
<     <loc>https://www.frenchheritageequestrian.com/about</loc>
<     <lastmod>2026-09-03</lastmod>
<     <priority>0.7</priority>
<   </url>
<   <url>
```
Then `git checkout src/lib/seo.ts` → porcelain empty; rebuilt to the committed state for the tables above.

**6. `curl -sI` on `/ride`, `/shop`, `/membership` returns `301` + `Location: /lessons`.**
⚠️ **NOT PROVABLE FROM THIS WORKTREE.** No `vercel` CLI is installed (`which vercel` → not found,
none in `node_modules/.bin`) and a task thread does not push, so no preview deployment exists.
What IS proven: `vercel.json` parses, and its keys are now
`, buildCommand, outputDirectory, crons, redirects, rewrites, git` with
```
[{"source": "/ride", "destination": "/lessons", "permanent": true},
 {"source": "/shop", "destination": "/lessons", "permanent": true},
 {"source": "/membership", "destination": "/lessons", "permanent": true}]
```
Both `rewrites` entries untouched. **Baseline measured 2026-09-02 before merge:** all three return `HTTP/2 200`
with no `Location` header (the client-side redirect, i.e. the defect). **ORCH runs after deploy:**
```
for p in /ride /shop /membership; do curl -sI https://www.frenchheritageequestrian.com$p | grep -iE '^HTTP|^location'; done
```
Expected: `HTTP/2 301` and `location: /lessons` ×3 (Vercel emits the header lowercase).

**7. `/services` IS prerendered and IS in the sitemap** — `dist/services/index.html`, title
*"Ways to Ride — Lessons, Horse Care & Acquisition | …"*, `<main>` 7,761 bytes, `<loc>…/services</loc>`
present. It got there because its pre-existing `indexable: true` (`seo.ts`, untouched) now drives the
list; the `/services` entry has no diff.

**8. SITECOPY-A's strings are unchanged.** `git diff origin/main -- src/lib/seo.ts` touches: the
`indexable` doc-comment; `/shop` flag `true→false` + comment; `/ride` flag `true→false` + comment;
`/membership` comment only; and one NEW `/faq` entry whose title and description are byte-for-byte the
strings `src/pages/Faq.tsx:49-50` already emits. **No existing `title` or `description` value changed.**

**9. `/services` no longer serves the landing page** — ⚠️ **post-deploy, same reason as 6.** Proven locally:
`dist/services/index.html` exists (before this task it did not, so the SPA catch-all served
`dist/index.html`'s landing title). **ORCH runs after deploy:**
```
curl -s https://www.frenchheritageequestrian.com/services | grep -o '<title[^>]*>[^<]*'
```
Expected: the *"Ways to Ride — Lessons, Horse Care & Acquisition"* title, not *"Jumper Lessons & Training"*.

**10. `sameAs` is still `[]`.** No Google Business Profile or social URLs were supplied with the
dispatch. Per spec §4c.7, nothing was invented. **Open item for the owner: supply the URLs; it is one
line at `src/lib/seo.ts:44`.**

## 3. THE REACH
Reach here is a crawler, not a click. The artefact is `dist/`:
- Prerender list: `scripts/prerender.mjs:43-44` ← `scripts/seo-config.mjs` `loadSeo()`/`indexableRoutes()` ← `src/lib/seo.ts` `ROUTE_SEO[].indexable`.
- Sitemap list: `scripts/seo-files.mjs:17-18` ← same loader, same filter.
- Wired by `package.json:8` `"build": "vite build && node scripts/prerender.mjs && node scripts/seo-files.mjs"`, which is `vercel.json`'s `buildCommand`.
- The 301s: `vercel.json` `redirects[]`, evaluated by Vercel before `rewrites` and before the filesystem.
- In-app navigation to the old paths still lands on `/lessons` via the untouched `<Navigate>` routes at `src/App.tsx:171,177,190`.

## 3b. §2c's three questions
Nothing is captured from a person by this task; no new stored value exists.
1. **Seen:** the sitemap and prerendered HTML are seen by crawlers; humans see nothing different.
2. **Acted on:** Google acts on the 301s and the sitemap over its own crawl cadence — nothing for staff to do.
3. **What else the outcome needs that nobody asked for:** (a) `sameAs` URLs from the owner (§2.10);
   (b) after the merge, resubmitting `sitemap.xml` in Search Console speeds up the re-crawl — an owner
   action, one click, if the property is verified there (not determinable from the repo, spec §4a).

## 4. FLAGGED, NOT FIXED
- `src/pages/Shop.tsx` still exists, is unrouted, and still calls `seoForPath('/shop')!` — deleting it is a separate decision (spec §5). **Carried forward as an open item.**
- `/contact`, `/visit`, `/gift`, `/questions` are still not prerendered (the first two are `indexable: false` by design; the last two have no `ROUTE_SEO` entry), so a no-JS crawler still receives the landing page's HTML for them (spec §2.4's class). The spec scoped only `/services`; whether form pages should get a prerendered shell is a DSNR call.
- `sitemap.xml` `<lastmod>` prints the UTC date (`2026-09-03` on a 2026-09-02 evening build) — pre-existing.
- `/questions` is routed (`App.tsx:209`) but in neither `ROUTE_SEO` nor `robots.txt`.
- Whether the three old URLs ever earned ranking is in Vercel Analytics / Search Console, not the repo (spec §4a) — unchanged, owner's to read.

## 5. Decided that the spec did not decide
- **Loader mechanism** (Vite SSR bundle of `seo.ts`, new file `scripts/seo-config.mjs`) — the file's own idiom; see §2.4.
- **`/faq` priority `0.5`** — the spec gave the strings but no priority; it was never in the old sitemap, so there was no value to carry. Lowest of the content pages.
- **`/shop` and `/ride` keep their old `priority` values** (0.85, 0.9) — inert while `indexable: false`, and the spec said flags only.
- **Sitemap order = `ROUTE_SEO` order**, not priority-sorted as the old hardcoded list was. Order carries no meaning in the sitemap protocol.
- **`<priority>` formatting:** `toFixed(1)` → `toFixed(2)` with a trailing zero trimmed, so a two-decimal priority like 0.85 prints as written rather than rounded to 0.8. No current sitemap entry has two decimals, so today's output is byte-identical in shape to before.

## 6. Where the spec was wrong (all minor, none changed the work)
- "the committed `dist/`": `dist` and `dist-ssr` are gitignored (`.gitignore:10-11`); nothing is committed. The measurement was on a local build.
- `src/App.tsx:173, :179, :192` are `:171, :177, :190` on this `main`.
- `scripts/seo-files.mjs:13-24` is `:12-23`. Everything else re-measured true: three lists, `/services` absent from prerender, `/faq` without an entry, no `redirects` key, `sameAs: []`, live 200s on the three URLs.

## 7. Numbers
| check | result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run typecheck:api` | exit 0 |
| `npm run lint` | 0 errors, 45 warnings — identical to `main` (45); none in `scripts/` |
| `npm run build` | green; 8 routes prerendered (was 10: −`/shop` −`/ride` −`/membership` +`/services` +`/faq`) |

## 8. Owner's checklist (post-merge, on the phone is fine — none of these need JavaScript off)
1. Open `frenchheritageequestrian.com/ride` — the address bar should change to `/lessons` and the lessons page loads. Same for `/shop` and `/membership`.
2. Open `frenchheritageequestrian.com/sitemap.xml` — eight entries, none of them ride/shop/membership, and `/services` and `/faq` present.
3. Open `/services` and `/faq` — the right page, with the right tab title.
4. If you have the Google Business Profile URL and any social profile URLs, send them; `sameAs` is one line.
ORCH runs the two `curl` proofs (§2.6, §2.9) — those are the ones a browser cannot show.

## 9. The one thing `git revert` does not undo
The `301`s live in `vercel.json` and take effect on deploy. A revert commit that removes the
`redirects` key and redeploys DOES remove them at the host — but crawlers and browsers cache a
`301` (`permanent: true`), so an already-seen redirect may persist client-side after the config is
gone. That is the intended property of a 301 and the reason the owner's "keep and redirect" ruling was
required before this shipped.

## 10. TEARDOWN census
No dev server, browser, or scratch worktree was started by this thread. `ps` matching
`vite|node scripts|playwright|chrom` shows only Chrome, VS Code's helper and five `claude` native-binary
processes belonging to the IDE, all older than this thread. `git worktree list` → `wt-2 [task/siteseo]`
occupied by this branch, for ORCH to merge and release. `dist/`, `dist-ssr/` left in wt-2 (gitignored;
ORCH's `git clean` on the next claim removes them).
