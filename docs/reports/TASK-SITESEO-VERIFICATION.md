# TASK-SITESEO — VERIFICATION (ORCH, 2026-09-02)
**Verdict: VERIFIED AND MERGED** (6dbc0471). Checked independently in wt-2 before merge: `vercel.json`
carries the three permanent redirects to `/lessons`; both build scripts read `ROUTE_SEO` through
`scripts/seo-config.mjs` (the hardcoded arrays are gone); the built `dist/` has NO `ride/`,
`shop/` or `membership/` directory and DOES have `services/` and `faq/`; the sitemap lists
exactly the eight indexable routes. Re-confirmed on `main` after merge: zero redirect dirs in
`dist`. Gates: typecheck 0 · typecheck:api 0 · lint 45w/0e · build clean · test:api 7/7.
**Owed after deploy (report §2 criteria 6 and 9, need production):** `curl -I` the three URLs for a
301 and `/services` for its own cold HTML — ORCH runs them once Vercel deploys `6dbc0471`.
**Owner:** the Business Profile URL + socials still empty in `seo.ts` `sameAs` (spec §4c.7,
conditional) — ships the moment he supplies them.
