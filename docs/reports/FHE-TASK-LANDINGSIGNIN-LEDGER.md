# FHE-TASK-LANDINGSIGNIN — running record

## RESUME
Role / thread   FHE-TASK-LANDINGSIGNIN · wt-1 · branch `task/landingsignin`
Merge-base      `0ae5855f`. ⚠️ **origin/main HAS MOVED since — now `d6eb5691` (ORCH's CR-106/CR-107
                capture in `docs/reference/CHANGE-ORDER-LEDGER.md`, docs only). NOT rebased: that file
                is ORCH's (D40) and merging is ORCH's act. Diff against `0ae5855f`, not origin/main.**
DONE            1. Worktree guard immediately before checkout: wt-1 detached HEAD, porcelain EMPTY.
                   Claimed `task/landingsignin` off origin/main; cleaned inherited dist/ + dist-ssr/.
                2. CLNR pass — clean. `494151fb` opened this ledger.
                3. Spec read back + all §2 premises re-verified (below). Spec was accurate.
                4. `1567d24c` — the build: `isLanding` gate + the vertical stack in Header.tsx.
                5. `npm run build` exit 0; prerender proven; CSS rules proven compiled.
                6. Full §8 acceptance sweep in Playwright against the built dist. 11/11 pass.
                7. Report + 4 screenshots written and committed.
IN FLIGHT       Nothing. **COMPLETE.**
NEXT            ORCH verifies and merges. Nothing is waiting on this thread.
DECIDED         (a) The landing header grows 17px (105→122) with an empty cart — inherent to stacking
                    a second line under a 40px button; NOT hidden with absolute positioning, because
                    that breaks exactly when Say Hello stands down (TRAP 4's own failure mode).
                (b) Cart glyph shifts LEFT 62.9px @940 in the full-cart state — the link's 46.9px plus
                    one 16px gap. Unavoidable in a right-anchored row. Reported, not claimed away.
                (c) `items-center` — Sign In centred under Say Hello, not flush to the right rail.
                (d) The wrapper carries the 940px breakpoint AND is only rendered when it has a child.
                (e) Two now-false comments in Header.tsx amended; the 2026-08-16 ruling left readable.
                (f) 4 screenshots at 1200px (~1.0MB) committed, not the full 13 (CLNR-1's 57MB finding).
BLOCKED         —
DO NOT          ⚠️ **Do NOT gate presence on `overDark`.** PROVEN on this branch: `/story` scrolled to
                y=1200 puts a `data-header-tone="dark"` section under the header and `overDark` becomes
                true. Gate on `location.pathname === '/'`.
                ⚠️ **Do NOT render the stack wrapper unconditionally.** An empty div is still a flex
                item and the row's `gap-4` gives it 16px — dead air below 940px and on inner pages with
                a full cart.
                ⚠️ **Do NOT try to click a real add-to-cart in a worktree.** No network route to
                Supabase (`ERR_NAME_NOT_RESOLVED`); `/shop` and `/lessons` render empty. Seed
                `sessionStorage['fhe-cart-v1']` — the app's own store (`CartContext.tsx:69-86`).
                ⚠️ **Do NOT trust `git diff --name-only origin/main` here** — origin/main moved
                mid-flight and the diff invents a `CHANGE-ORDER-LEDGER.md` deletion.
                ⚠️ **Do NOT kill the vite on port 5199** — it is `wt-2`'s (SITECOPY-B, live).

---

## LOG

### 2026-09-02 — thread opened
- `git worktree list` at claim: canonical `main` @ `0ae5855f`; wt-1/wt-2/wt-3 all detached @ `0ae5855f`.
  BOARD's RESUME said "wt-1 = SIGNBOOK (running)" — **stale**: wt-1 was detached and clean. Guard passed
  on the evidence, not the board (D20). *(By teardown, wt-2 = `task/sitecopy-b`, wt-3 = `task/signflow-a`
  — all three of wave 2 live.)*
- Dispatch authority: the prompt carried no settings line; `docs/orch/BOARD.md` Wave 2 names
  `FHE-TASK-LANDINGSIGNIN` · Opus · HIGH · thinking ON · **wt-1**. Not self-selected (D36).

### CLNR pass — clean
| §4 trigger | Result |
|---|---|
| loose files at `docs/` root > 20 | **0** |
| a folder outside §2a | 5 (`contract-content`, `contract-exports`, `proposed`, `staged`, `ui-orders`) — **already censused by CLNR-1 on 2026-09-01**, not new |
| worktrees over the cap of 3 | **3**, at cap |
| §2b resumability, per role | ORCHESTRATOR **PASS** · DISCO **PASS** · DSNR **PASS** · TASK **PASS** · CLNR **PASS** · RNR present · CODR-PROFILE present · THE-RUNNING-RECORD present; `docs/orch/BOARD.md` findable; my own spec findable from the identifier alone |
| nothing swept in ~2 weeks | CLNR-1 swept **2026-09-01**, one day ago |
**Nothing moved** — `SITECOPY-B` and `SIGNFLOW-A` were dispatched into wt-2/wt-3 in the same wave, and
"never move a file under a running thread" outranks tidiness. One drift line to ORCH: BOARD's RESUME.

### Premises re-verified (D20) — every one held
`Header.tsx` `:54` location · `:55` itemCount · `:73` overDark init from pathname · `:157/:159` cart
gated on `itemCount > 0` only, → `/checkout` · `:258` right cluster · `:314` `{cart('')}` · `:334`
`{itemCount === 0 && (` · `:342` `hidden min-[940px]:inline-flex` · `:407/:410` mobile `/login` +
label exactly `Sign In` · `Footer.tsx:91,94` `user ? '/app' : '/login'` / `Member sign-in` ·
`Story.tsx:223,512` two dark sections · `App.tsx:215` (spec said 217) · `Landing.tsx:7` Header, `:31-35`
qs-no-scroll · `scripts/prerender.mjs` renders `/`.
`dist/index.html` `site-footer` = **0**; `dist/ride/index.html` = **1**.
⚠️ Spec's `:373` for the mobile breakpoint is the menu SHEET; the hamburger BUTTON is `:356`. Both carry
`min-[940px]:hidden`, so the claim holds.

### The measurements, as taken
```
@940 cluster BEFORE (/about, empty cart) 574px  →  AFTER (/, empty cart) 574px   DELTA 0px
@940 headerH 105px → 122px (+17px);  wordmark y +8.5px          ← the one visible consequence
@940 full cart: cluster 490.4 → 553.3 (+62.9 = SignIn 46.9 + gap 16); headerH 105 → 105 (unchanged)
wrapper − SignIn width slack, full cart: 0px @940 and @1440      ← no reserved Say Hello slot
cart→SignIn gap: 16px @940 (= gap-4), 22.5px @1440 (= xl:gap-5, measured)
navRows = 1 at 940/1000/1100/1280/1440/1920; horizontalOverflow = false at all six
/story scrolled y=1200 → navColour rgb(255,255,255), dark section under band = true, SignIn count = 0
widths 320/768/939 → hamburger only; 940/1440 → link only. Never both.
gates: typecheck 0 · typecheck:api 0 · lint 45 warnings 0 errors (45 on the UNMODIFIED base file too)
       · build exit 0 · eslint on Header.tsx: 0 problems
```

### Complete
Report at `docs/reports/TASK-LANDINGSIGNIN-REPORT.md`; screenshots in
`docs/reports/TASK-LANDINGSIGNIN-shots/`. Teardown done — port 4181 down, 0 chromium, no scratch
worktree. Nothing in flight.
