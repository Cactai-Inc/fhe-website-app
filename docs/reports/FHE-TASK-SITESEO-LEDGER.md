# FHE-TASK-SITESEO — running ledger

## RESUME
Role / thread   FHE-TASK-SITESEO · wt-2 · branch task/siteseo
Merge-base      b846b227 — origin/main has NOT moved (re-fetched at close)
DONE            CLNR sweep (clean) · claim · code commit ed275312 (seo-config.mjs new; prerender.mjs, seo-files.mjs derive from ROUTE_SEO; seo.ts flags + /faq entry; vercel.json redirects) · fresh build + tests 1-5,7,8,10 proven · report written docs/reports/TASK-SITESEO-REPORT.md
IN FLIGHT       nothing — complete
NEXT            ORCH: merge, deploy, then run the two curl proofs in report §2.6 / §2.9; release wt-2
DECIDED         Vite-SSR loader for seo.ts (file's idiom; Vercel Node not pinned) · /faq priority 0.5 · sitemap in ROUTE_SEO order · priority printed with 2dp trimmed · /shop,/ride priorities untouched
BLOCKED         tests 6 and 9 need a deployment (no vercel CLI, no push from a task thread) · sameAs URLs not supplied → left []
DO NOT          do not try `node --experimental-strip-types` for the scripts — works on local Node 22.19 but Vercel's build Node is unpinned; do not put a route literal back in either script

## LOG
- 2026-09-02 claim: `git checkout -b task/siteseo origin/main` at b846b227; `git clean -xdf -e node_modules -e .env -e .env.db` removed 0 files.
- premises re-measured: 3 lists ✓ · /services absent from prerender ✓ · /faq no entry ✓ · vercel.json no redirects ✓ · live /ride /shop /membership /services all HTTP/2 200, no Location ✓ · dist is gitignored (spec said committed — wrong, immaterial) · App.tsx lines are 171/177/190 not 173/179/192.
- HOW settled: scripts load seo.ts via a Vite SSR build (scripts/seo-config.mjs → dist-ssr/seo.js, emptyOutDir:false so entry-server.js survives).
- ed275312: code. Build: 8 prerendered (/, about, story, services, faq, lessons, horse, acquisition); all titles non-empty; mains 2722-14500B except / (bare by design); sitemap = same 8; 0 hits for ride/shop/membership.
- test 5: /about flipped false → prerender lost /about, sitemap lost its <url> block; reverted, porcelain clean, rebuilt.
- typecheck 0 · typecheck:api 0 · lint 0 err/45 warn (= main) · build green.
- census: no processes started by this thread.
