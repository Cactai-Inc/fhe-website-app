# TASK-SIGNSTRIP — the unauthorised purchase block comes off every `/sign/*` page

**Source:** CR-98 (G1 · URGENT), first half only. **Authored by DSGN-2, 2026-09-01.**
**Standing requirements:** `docs/method/TASK-ROLE.md` — not restated here.
⚠️ **This spec is deliberately surgical so it can merge TODAY.** The rest of CR-98 (email-only
intake, the full flow) is separate specs behind it — **do not reach for them from here.**

## 1 · THE OWNER'S WORDS
> *"on the page for /sign/rider remove the block of shit that says 'what youll be able to purchase' I
> never authorized this design … it looks broken because the block of shit you added to the page
> looks like buttons that dont click. if any of the other /sign pages have this same block of 'what
> youll be able to buy' shit it needs to be removed immediately."*

## 2 · MEASURED (2026-09-01, main @ 475f1724 — re-run these, don't trust them)
- `wc -l src/pages/SignStart.tsx` → **1047**. Routed `/sign/:path` (`src/App.tsx:188`) — guest ·
  rider · horse · rider+horse (`deal` also lands here but never renders the block).
- `grep -n "able to purchase" src/pages/SignStart.tsx` → **:662 only.** The rendering guard at :680
  is `!outcome && path !== 'deal'`, so the block is on **all four funnels**, not just `/sign/rider`.
  On `guest` the same block wears the heading *"Services we offer once you're onboarded"* (:660–662).
- `grep -rln "able to purchase\|Services we offer once" src/` → **SignStart.tsx is the only file.**
  (`CalendarPage.tsx:1240` matches on a different string — leave it alone.)
- **The block's full footprint in SignStart.tsx** (everything below exists ONLY for the block):
  - `:82` `import { fetchPublicCatalog }` · `:83` `Offering, Segment` types
  - `:122–130` `PATH_SEGMENTS` map
  - `:440–441` `offerings` + `catalogState` state
  - `:443–455` the `useEffect` that fetches the catalog on every page load
  - `:660–662` `catalogHeading`
  - `:680–710` the rendered `<section>`
  - `:29` and `:64` — **stale comment references to `PATH_SEGMENTS`** in the file header

## 3 · THE INCUMBENT
The block itself. **This is a deletion, not a convergence** — nothing replaces it. The guest-path
heading variant is the SAME block and goes with it (DSGN decision: his complaint is the block —
offering names styled as unclickable buttons — not the heading string; the guard makes them one unit).

## 4 · THE TRAPS
1. ⚠️ **Deleting only the JSX leaves a dead catalog fetch firing on every `/sign/*` load.** The
   strip is the whole footprint in §2 — state, effect, map, imports, heading. A "removed the block"
   report with `fetchPublicCatalog` still imported in this file has not done the task.
2. ⚠️ **`fetchPublicCatalog` / `src/lib/publicCatalog.ts` has six OTHER consumers** (ServiceSelector,
   BookHorse, BookRider, BookSupport, Lessons). **Touch nothing outside SignStart.tsx.**
3. ⚠️ **The 14-input intake form directly below the block is a KNOWN DEFECT with its own upcoming
   spec.** Do not "improve" it, trim it, or reflow it here — a subtraction beyond the named footprint
   is how NOSTRIP-class breakage happens. The diff must show the footprint removed and nothing else.
4. **`Segment` and `Offering` type imports:** remove only if this file's last use goes with the
   block — verify with grep, don't assume.
5. **Browser tests render this page:** `test/browser/sign-start.tsx` / `.html`,
   `test/browser/probe-sign-minor.mjs`. They must pass after the strip; if one asserts the catalog
   block exists, fixing THAT assertion is in scope.
6. **Stale comments** (`:29`, `:64`) name `PATH_SEGMENTS` as part of the page's per-path machinery —
   update them or they lie to the next reader (MOBILEPASS precedent).

## 5 · OUT OF SCOPE
Everything else in CR-98: the email-only reduction, `api/sign-start.ts`, SendStateScreen, auth
setup, onboarding, booking, payment. Also CR-99 entirely. **One file changes: `src/pages/SignStart.tsx`
(plus a test file only if trap 5 bites).**

## 6 · THE REACH
Visit `/sign/rider` (and `/sign/guest`, `/sign/horse`, `/sign/rider+horse`) — no login, public
pages. That is the only way the block was ever reached.

## 7 · THE TELL
The page goes: welcome heading → intake form. No catalog section between them, no loading flash of
it, on any of the four paths. `deal` is byte-identical to before. **Undo:** `git revert` of the one
commit — nothing else depends on the block.

## 8 · THE TEST THIS MUST PASS
1. All four funnel paths render **no** catalog section and issue **no** public-catalog network
   request (verify in devtools or by grep proving the effect is gone).
2. `grep -n "catalog\|offerings\|Offering\|PATH_SEGMENTS\|fetchPublicCatalog\|Segment\|able to purchase\|Services we offer once" src/pages/SignStart.tsx`
   → **zero hits** (or only hits the thread can justify line-by-line in the report).
3. `/sign/deal` behaviour unchanged; the intake form and SendStateScreen behaviour unchanged —
   submit still works end to end against a dev target.
4. Typecheck + build clean; the `test/browser` sign pages still pass.
5. The diff contains **only** the §2 footprint (and trap-5/6 lines) — nothing added, nothing else
   removed.

## 9 · THE REPORT
`docs/reports/TASK-SIGNSTRIP-REPORT.md` — each §8 item proven with the command run and its output.
Build in a worktree from the first edit (canonical checkout blocks code commits).
