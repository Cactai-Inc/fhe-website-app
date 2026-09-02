# TASK-SITESEO — three URLs in the sitemap prerender to a blank, titleless page

**Spec by `FHE-DSNR-SITE-PUBLIC`, 2026-09-01.**
**Thread name: `FHE-TASK-SITESEO`.**

> # 🔒 RULED 2026-09-01 — THE GATE IS CLOSED. THIS IS READY TO DISPATCH.
> > *"for site seo, can we determine if any of those three pages are helping seo and our ranking?
> > either way, keep and redirect to the booking page the CTA links to."* — owner, 2026-09-01
>
> 🔒 **KEEP AND REDIRECT. The fork in §4 is resolved to Option A and the alternative is struck.**
> **His first question is answered in §4a — it cannot be determined from this repo, and it does not
> change the work.**
> **Suggested TASK-thread settings: Opus · effort HIGH · thinking ON** — build scripts, three route
> lists to converge, and a host-level redirect a `git revert` does not undo.

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` · `docs/method/CLNR-ROLE.md` §3 · `docs/method/THE-RUNNING-RECORD.md`
>   (ledger: `docs/reports/FHE-TASK-SITESEO-LEDGER.md`).
> - `CLAUDE.md` **D17** (`:365`) — **this is a pure D17 defect, pointed outward at Google instead of
>   inward at a user: three routed, sitemapped, high-priority URLs that reach nothing.**
> - `docs/reports/TASK-SITECOPY-A-REPORT.md` — **must exist first.** It carries the measured
>   `/services` prerender-list divergence and the final description lengths.

---

## 1. WHY THIS EXISTS

**It was not requested.** `FHE-DSNR-SITE-PUBLIC` found it on 2026-09-01 while rebasing
`TASK-SITECOPY`: two of that draft's edits turned out to change strings **nothing renders**, and the
reason turned out to be a live defect in what the site publishes to crawlers.

⚠️ **It is raised rather than absorbed because the fix needs a business answer, not a technical one.**

## 2. WHAT WAS MEASURED — 2026-09-01, `main` at `4297345a`, against the committed `dist/` built 17:19 today

### The defect
`src/App.tsx:173`, `:179`, `:192` make three routes client-side redirects:
```
/shop       → <Navigate to="/lessons" replace />
/ride       → <Navigate to="/lessons" replace />
/membership → <Navigate to="/lessons" replace />
```
`scripts/prerender.mjs:21` still lists all three in `ROUTES`, and renders them **through the router**
(`:41`, `const { html, head } = render(url)`). A `<Navigate>` renders nothing and emits no Helmet head.

**The output, measured on the three built files:**

| Route | `<title>` in `dist/<route>/index.html` | `<main>` size | In `dist/sitemap.xml`? | `priority` |
|---|---|---|---|---|
| `/shop` | `<title data-rh="true"></title>` — **empty** | **29 bytes** (`<main class="flex-1"></main>`) | ✅ | 0.85 |
| `/ride` | **empty** | **29 bytes** | ✅ | 0.90 |
| `/membership` | **empty** | **29 bytes** | ✅ | 0.80 |

Compare a healthy one: `/story` → title *"Come Ride With Us — A Women's Riding Community…"*, `<main>`
**14,500 bytes**.

🔒 **So the sitemap advertises three URLs, one at the second-highest priority on the site, that serve
a titleless page with an empty `<main>` to any crawler that does not execute JavaScript.**

### Three further divergences found in the same pass
1. **`scripts/prerender.mjs:20` states its list *"must match the indexable paths in `src/lib/seo.ts`"*.
   It does not.** `/services` is `indexable: true` and **absent** from `ROUTES`; `/membership` is
   `indexable: false` and **present**. `/faq` is in `ROUTES` and has **no `ROUTE_SEO` entry at all**
   (its head comes from `src/pages/Faq.tsx`'s own `<Seo>`).
2. **`scripts/seo-files.mjs:13-24` hardcodes the sitemap route list a THIRD time**, with its own
   priorities. `/membership` is `0.8` there and `0.3` in `seo.ts`. **Three lists, no shared source.**
3. **`src/lib/seo.ts`'s `indexable` flag is read by nothing.** `grep -rn "indexable" src/ scripts/`
   → only the interface (`seo.ts:56`) and the twelve literals. **A field that documents an intent no
   code enforces.**
4. 🔒 **AND THE ONE THAT MAKES `/services` URGENT RATHER THAN TIDY.** `vercel.json`'s catch-all
   rewrite is `{"source": "/((?!api/).*)", "destination": "/index.html"}`. **Vercel checks the
   filesystem before applying a rewrite, so prerendered directories are served — but any public route
   with NO prerendered directory falls through to `dist/index.html`.**
   ⚠️ **And `dist/index.html` IS the prerender of `/`.** So a crawler hitting **`/services`,
   `/contact`, `/visit`, `/gift` or `/questions`** receives **the LANDING page's markup and the
   LANDING page's `<title>`** as the initial HTML, and only sees the right page after executing
   JavaScript. **Verified: `dist/services/` does not exist; `dist/index.html` carries
   `<title data-rh="true">French Heritage Equestrian — …Lessons & Training…</title>`.**
   🔒 **This is the same class of defect as the three blank pages, and it is why §4d prerenders
   `/services` rather than merely flipping a flag.**

### What is NOT wrong
- **`/` is fine.** `dist/index.html` carries the real `/` Helmet title. Its `<main>` is absent because
  `Landing.tsx` renders bare by design (`Landing.tsx:9-23`), not because it failed.
- **The redirects themselves work** for a human with JavaScript. **This is a crawler-facing defect
  only** — which is exactly why it has survived.

## 3. THE INCUMBENT, NAMED (D18)

**Three route lists exist where there should be one:** `ROUTE_SEO` (`src/lib/seo.ts:60`),
`ROUTES` (`scripts/prerender.mjs:21`), `routes` (`scripts/seo-files.mjs:14`).
🔒 **Whatever §4 the owner picks, the deliverable converges these onto `ROUTE_SEO` as the single
source, with `indexable` finally meaning something.** **That half is not in question and is not part
of the gate.**

## 4. 🔒 THE RULING — KEEP AND REDIRECT

> *"either way, keep and redirect to the booking page the CTA links to."* — owner, 2026-09-01

**`/ride`, `/shop` and `/membership` stay as public URLs and serve a real redirect.**
⚠️ **The alternative — retiring them to `404` — is STRUCK. Do not build it, do not re-open it.**

### 4a. His other question: are they helping our ranking? — 🔒 NOT DETERMINABLE FROM THIS REPO

**Say this plainly in your report rather than guessing. There are TWO instruments and they answer
two different questions — and one of them IS already installed.**

| Question | Instrument | Status, measured 2026-09-01 |
|---|---|---|
| **Does anyone actually LAND on these three URLs?** | **Vercel Web Analytics** | 🔒 **ALREADY LIVE.** `src/main.tsx:6` imports `@vercel/analytics/react`, `:16` renders `<Analytics />` inside `HelmetProvider` — **on every page**. `package.json:24`, `@vercel/analytics ^2.0.1`. **The data exists; it is in the Vercel dashboard, not in this repo.** |
| **Does Google SHOW them, and at what position?** | **Google Search Console → Performance → filter by page** | ⚠️ **No verification meta tag in `index.html`** (`grep -rn "google-site-verification"` → zero). May be verified by DNS or the Vercel integration — **not determinable from the repo.** |
| **Is the Business Profile even linked?** | `ORG_JSONLD.sameAs` | ⚠️ **`src/lib/seo.ts:44` — `sameAs: []`, empty.** No Business Profile, no socials. |

⚠️ **Both dashboards are the owner's to read. Neither is a build task and neither blocks this one.**
🔒 **And the answer does not change the build** — see the two determinable facts below.

**But two things ARE determinable from here, and they matter:**
1. **Whatever those three URLs rank for, they are not ranking on their content — they have none.**
   All three serve an empty `<title>` and a 29-byte `<main>` (§2). **A blank indexed page is the worst
   of both worlds: it holds the URL without earning anything for it.**
2. 🔒 **So the 301 strictly improves the position either way.** A redirect passes signal to `/lessons`;
   a blank page passes none. **This is why his "either way" is right and why the GSC number, whatever
   it says, would not change the build.**

### 4b. The target, verified — it is `/lessons`

**The CTA he means, measured 2026-09-01:**
| The CTA | `file:line` | Target |
|---|---|---|
| the big central landing CTA | `src/pages/Landing.tsx:138` | **`/lessons`** |
| header nav *"Book a Lesson"* | `src/components/layout/Header.tsx:47` | **`/lessons`** |
| footer nav *"Book a Lesson"* | `src/components/layout/Footer.tsx:76` | **`/lessons`** |

🔒 **All three agree: `/lessons`. The existing `<Navigate>` target is already correct — it is the
MECHANISM that is wrong, not the destination.** ⚠️ **Do not change where they point.**

### 4c. What that means concretely
1. **A real `301` at the host** — `vercel.json` — for `/ride`, `/shop`, `/membership` → `/lessons`.
   ⚠️ **Server-side, so it works with no JavaScript.** This is the whole point.
   **Measured 2026-09-01: `vercel.json` has NO `redirects` key today.** You add one. It has
   `buildCommand`, `outputDirectory`, `crons` (5), `rewrites` (2) and `git`.
   ⚠️ **`permanent: true` — that is what makes it a `301` rather than a `308`/`307`.**
   🔒 **`redirects` are evaluated BEFORE `rewrites` and before the filesystem on Vercel, so the new
   rules will win over the existing SPA catch-all. Do not remove either `rewrites` entry.**
2. **All three leave `scripts/prerender.mjs`.** A redirect has nothing to prerender. **This deletes the
   three blank pages.**
3. **All three leave the sitemap.** ⚠️ **You do not sitemap a redirect** — you let the 301 carry the
   old URL's signal and you advertise the destination.
4. **All three flip to `indexable: false` in `ROUTE_SEO`** — which, once §3's convergence lands, is
   what removes them from both lists automatically rather than by a second hardcoded exception.
5. ⚠️ **The `<Navigate>` routes in `src/App.tsx:173,179,192` STAY.** The host 301 catches a cold hit;
   the client route catches an in-app navigation. **Removing them would break any in-app link that
   still uses the old path. Belt and braces is correct here.**
6. **`ROUTE_SEO`'s `/shop` entry stays** even though the flag flips — `src/pages/Shop.tsx:12` calls
   `seoForPath('/shop')!` with a **non-null assertion**, so deleting the entry crashes that page.
7. ⚠️ **CONDITIONAL, and only if the owner has supplied it by the time you start:** populate
   `src/lib/seo.ts:44` `sameAs: []` with the **Google Business Profile URL** and any social profiles.
   It feeds `ORG_JSONLD`, the `LocalBusiness` structured data. **It is one line.**
   🔒 **If the URLs have NOT arrived, DO NOT invent, guess, or search for them — leave `sameAs` empty
   and name it as an open item in your report.** **A wrong `sameAs` tells Google the business is a
   different entity, which is worse than an empty one.**

### 4d. `/services` — DSNR resolved this, no owner call needed
The second call I flagged answers itself once §3's convergence lands: **`/services` is
`indexable: true`, so deriving the prerender list from `ROUTE_SEO` puts it in.** It is a real page with
real content, reached from `Checkout.tsx:121`, `NotFound.tsx:24`, `About.tsx:206`, `Account.tsx:114`.
🔒 **Prerender it. Sitemap it. No flag change.** ⚠️ **This is the convergence working as intended —
one list, and the exceptions disappear.**

## 5. OUT OF SCOPE, EXPLICITLY

- ⚠️ **All copy.** `TASK-SITECOPY-A` owns every string in `src/lib/seo.ts`, and **must merge first** —
  you will be editing the same file. **You change the route LIST and the flags; you never change a
  `title` or `description` value.**
- **`src/pages/Shop.tsx`.** It still exists and `seoForPath('/shop')` is still called from it
  (`Shop.tsx:12`) even though nothing routes to it. **Deleting a page is a separate decision. Record
  it as a finding.**
- **The `/faq` page's content.** See `TASK-POLICIESANDFAQ`. ⚠️ **But `/faq` has no `ROUTE_SEO` entry
  at all while being prerendered — so §3's convergence WILL affect it. Give it an entry with the title
  and description `src/pages/Faq.tsx`'s own `<Seo>` already emits; do not invent new copy, and do not
  touch the questions.**
- **Anything behind auth.** `robots.txt` already disallows `/app`, `/admin`, `/checkout`,
  `/confirmation`, `/login`, `/register`, `/account`, `/order` (`scripts/seo-files.mjs:38-48`).

## 6. THE REACH · 7. THE TELL (D19)

**Reach is a crawler, not a click** — which is why D17's usual test does not apply and a stricter one
replaces it: **the artefact under test is the built `dist/`, not the dev server.**
**No D19 flags** — nothing moves value. **The tell is `dist/sitemap.xml` plus the built HTML; the undo
is `git revert` and a rebuild.** ⚠️ **A live `301` added at the host is the one thing here that is not
undone by a revert — say so in the report and name where it lives.**

## 8. THE TEST THIS MUST PASS

⚠️ **Every test runs against a fresh `npm run build` output, never the dev server.**

1. **No prerendered file has an empty title.** For every `dist/**/index.html`:
   `<title data-rh="true">` is non-empty. Paste the per-file table.
2. **No prerendered file has an empty `<main>`.** Every one over 1,000 bytes, or explicitly justified
   (`/` is the one known exception — `Landing.tsx` renders bare).
3. **Every `<loc>` in `dist/sitemap.xml` resolves to a prerendered file with real content**, and
   **none of the three redirect URLs appears in it.** Paste the list, matched one-to-one.
4. **One list, not three.** `scripts/prerender.mjs` and `scripts/seo-files.mjs` both derive from
   `ROUTE_SEO`. `grep -n` both files in the report showing no hardcoded route array remains.
5. **`indexable` now decides something.** Flip one route's flag, rebuild, show the sitemap changed.
6. 🔒 **`curl -sI` each of `/ride`, `/shop`, `/membership` returns `301` with `Location: /lessons`.**
   ⚠️ **`curl`, not a browser — a client-side redirect is exactly the defect, so proving it in a
   browser with JavaScript on proves nothing.** Paste all three response headers.
7. **`/services` IS prerendered and IS in the sitemap**, with a real title and a non-empty `<main>`.
   ⚠️ **And it got there because `indexable: true` put it there — not because you added it by hand.**
8. **`TASK-SITECOPY-A`'s ten strings are unchanged.** `git diff src/lib/seo.ts` shows route-list and
   flag changes only. ⚠️ **A diff touching a `title` or `description` value is a failed report.**
9. 🔒 **`/services` no longer serves the landing page.** `curl -s https://…/services | grep -o '<title[^>]*>[^<]*'` returns the **services** title, not the landing one — **with JavaScript never
   executed.** ⚠️ **This is §2.4's defect and it is the one a browser cannot show you.**
10. **`sameAs` is either populated with the owner's real URLs or still `[]`** — and the report says
    which, explicitly. ⚠️ **Never a placeholder.**

## 9. WHERE THE REPORT GOES

`docs/reports/TASK-SITESEO-REPORT.md`, ledger at `docs/reports/FHE-TASK-SITESEO-LEDGER.md`.
**Carry forward:** the disposition of `src/pages/Shop.tsx` (§5) as a named open item.
