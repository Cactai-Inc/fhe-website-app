# TASK-SIGNSTRIP — report

Built in worktree `wt-signstrip`, branch `task/signstrip`, base `origin/main@475f1724` (matches
the spec's own measured commit). One file touched: `src/pages/SignStart.tsx`. No test file needed
editing — trap 5 did not bite (see item 4 below).

## What came out

- `:82` `import { fetchPublicCatalog }` and `:83` `import type { Offering, Segment }`
- `:122–130` the `PATH_SEGMENTS` constant map
- `:440–441` `offerings` / `catalogState` state
- `:443–455` the catalog-fetching `useEffect`
- `:660–662` `catalogHeading`
- `:680–710` the rendered `<section>` (both the "What you'll be able to purchase" and
  "Services we offer once you're onboarded" variants — same guarded block)
- `:29` and `:64` stale comments naming `PATH_SEGMENTS` as one of this page's per-path constant
  maps, corrected to drop the removed name

`git diff --stat`: 1 file changed, 2 insertions(+), 67 deletions(-). Full diff is exactly the
above footprint plus the two comment fixes — nothing else touched.

## §8 items, each proven

**1. All four funnel paths render no catalog section and issue no public-catalog network request.**

Ran the real `SignStart` in a real Chromium (test/browser harness) against all five paths
(`guest`, `rider`, `horse`, `rider+horse`, `deal`), asserting on rendered body text and on every
network request matching `offering|catalog|public_catalog`:

```
PASS  /sign/guest — no catalog heading text in rendered body
PASS  /sign/guest — no catalog/offering network request fired (saw: [])
PASS  /sign/rider — no catalog heading text in rendered body
PASS  /sign/rider — no catalog/offering network request fired (saw: [])
PASS  /sign/horse — no catalog heading text in rendered body
PASS  /sign/horse — no catalog/offering network request fired (saw: [])
PASS  /sign/rider+horse — no catalog heading text in rendered body
PASS  /sign/rider+horse — no catalog/offering network request fired (saw: [])
PASS  /sign/deal — no catalog heading text in rendered body
PASS  /sign/deal — no catalog/offering network request fired (saw: [])

ALL PASS
```

(Ad hoc probe against the existing `test/browser/sign-start.html` harness — written for this
verification, run, then deleted; not added to the repo since `test/browser/probe-sign-minor.mjs`
already covers the harness's standing assertions.)

**2. `grep -n "catalog\|offerings\|Offering\|PATH_SEGMENTS\|fetchPublicCatalog\|Segment\|able to purchase\|Services we offer once" src/pages/SignStart.tsx`**

```
$ grep -n "catalog\|offerings\|Offering\|PATH_SEGMENTS\|fetchPublicCatalog\|Segment\|able to purchase\|Services we offer once" src/pages/SignStart.tsx
$ echo "exit: $?"
exit: 1
```

Zero hits, as required.

**3. `/sign/deal` behaviour unchanged; intake form and SendStateScreen behaviour unchanged; submit works end to end.**

The removed block was already guarded `path !== 'deal'`, so nothing in the diff touches
deal-specific code — confirmed by the diff itself (no lines inside the `deal`-only branches
changed). `test/browser/probe-sign-minor.mjs` (below) exercises the intake form and drives a real
submit through to `SendStateScreen` rendering (`waitForFunction` on `[role="status"]` after
`button[type="submit"]` is clicked) against the harness's Supabase shim — all 15 assertions pass,
unchanged from before the strip.

**4. Typecheck + build clean; `test/browser` sign pages still pass.**

```
$ npm run typecheck
> tsc --noEmit -p tsconfig.app.json
(no output — clean)

$ npm run build:client
> vite build
✓ 2190 modules transformed.
✓ built in 4.53s
(pre-existing chunk-size warning only, unrelated to this change)

$ VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=anon \
    npx vite --config test/browser/vite.config.ts --port 5199 --strictPort &
$ CHROMIUM_PATH=".../chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
    node test/browser/probe-sign-minor.mjs
PASS  /sign/guest — minor question PRESENT (radios=2) [Who is visiting? *]
PASS  /sign/rider — minor question PRESENT (radios=2) [Who will be riding? *]
PASS  /sign/rider+horse — minor question PRESENT (radios=2) [Who will be riding? *]
PASS  /sign/horse — minor question ABSENT (radios=0)
PASS  /sign/deal — minor question ABSENT (radios=0)
PASS  /sign/rider — the rider block is hidden until the question is answered
PASS  /sign/rider "Me" — no rider block, no second name (the self-serving adult is unchanged)
PASS  /sign/rider "Me" — the name field is still just "First name"
PASS  /sign/rider "My child" — the account holder's field says YOUR first name
PASS  /sign/rider "My child" — the rider block renders: first, last, date of birth
PASS  /sign/rider "My child" — a DOB of 18+ is refused at the field
PASS  /sign/rider "My child" — submit stays disabled while the DOB is 18+
PASS  payload — the ACCOUNT HOLDER is the parent
PASS  payload — the MINOR travels separately, with a date of birth
PASS  payload — switching back to "Me" sends NO minor, even after one was typed

ALL PASS
```

`test/browser/sign-start.tsx`/`.html` needed no code changes — they were only ever a harness
entry, and their comment about the catalog fetch shim describes a codepath that no longer runs
but asserts nothing about it, so it was left alone per the OUT OF SCOPE clause (touch nothing
beyond the named footprint unless an assertion actually fails — none did).

**5. The diff contains only the §2 footprint (and trap-5/6 lines) — nothing added, nothing else
removed.**

`git diff --stat`: `src/pages/SignStart.tsx | 69 ++-----------------------------------------------`
— 2 insertions (the two corrected comment lines), 67 deletions (the block's full footprint). No
other file in the working tree is modified.

## Note on trap 2 (six other `fetchPublicCatalog` consumers)

Confirmed untouched — only `src/pages/SignStart.tsx` was edited; `src/lib/publicCatalog.ts` and
its other callers (ServiceSelector, BookHorse, BookRider, BookSupport, Lessons) are unchanged in
this diff.

## Environment note

This sandbox had no `node_modules`, no `playwright`, and no cached Chromium for the worktree
initially — `npm ci` was run to install dependencies (matching main's lockfile, not committed),
and `npm i -D playwright --no-save` + `npx playwright install chromium` were run to get a working
browser for the harness (Chromium was already cached at
`~/Library/Caches/ms-playwright/chromium-1234`, so no download was needed). Neither is reflected
in the diff — `package.json`/`package-lock.json` are unchanged (`git status` confirms).
