# FHE-TASK-SITECOPY-B — RUNNING LEDGER

## RESUME
Role / thread   TASK-SITECOPY-B · wt-2 · branch `task/sitecopy-b` — **COMPLETE, NOTHING IN FLIGHT**
Merge-base      `0ae5855f`. ⚠️ **origin/main MOVED to `d6eb5691` mid-task** (ORCH's CR-106/107 ledger
                entries). `git diff --stat 0ae5855f d6eb5691 -- src/ test/` is EMPTY — no code
                conflict. ⚠️ **Diff against the MERGE-BASE, not origin/main, or the report lists
                ORCH's `CHANGE-ORDER-LEDGER.md` as if it were mine.**
DONE            claim+guard `fb5c4072` · CLNR clean · premises re-measured · three src files edited
                `5875ead5` · probe `4f01c7c6` + lint fix · report committed. Gates: typecheck 0,
                typecheck:api 0, lint 45 (= the real baseline), build exit 0. Probe **30/30 ALL PASS**
                across a singular AND a plural tenant term.
IN FLIGHT       nothing
NEXT            ORCH verifies and merges. Report: `docs/reports/TASK-SITECOPY-B-REPORT.md`
DECIDED         (1) `agree()` deliberately NOT used on the activation sentence — the property term
                sits in a prepositional phrase and never governs the verb; the COUNT does. TRAP 2's
                explanation of the mechanism is wrong; its TEST §8.5 is right, and I built to the test.
                (2) subject+verb picked in ONE expression, module-scope `toldSentence()` — not two
                ternaries, not a nested component (TRAP 6).
                (3) `/app/onboarding` NOT faked: the payment step has had no router since SIGNBOOK
                removed `enterPayment` (`Onboarding.tsx:649-653`). The retired markup is mounted
                directly and the probe SAYS SO.
                (4) a NEW harness entry rather than editing SIGNBOOK's `onboarding-flow.tsx` — that
                lineage is live in `wt-1`/`wt-3`.
BLOCKED         nothing. Two items belong to DSNR/ORCH, not to me: the §8.1-vs-§5 contradiction (five
                RENDERED `the barn` strings on staff Barn-Ops surfaces, which §5 forbids me to touch),
                and `src/App.tsx:509`.
DO NOT          ⚠️ Do NOT "fix" the activation verb with `agree(propertyTerm, 'has', 'have')`. It
                compiles, it matches TRAP 2's wording, and it renders "someone at the stables HAVE
                been told" for every plural tenant.
                ⚠️ Do NOT trust `git diff --name-only origin/main` in this branch — see Merge-base.
                ⚠️ Do NOT go looking for the spec's "zero consumers" D17 finding. There were 16,
                at DSNR's own measured commit. It does not exist.
                ⚠️ Chromium is NOT at `/opt/pw-browsers` on this machine (the README's path). It is in
                `~/Library/Caches/ms-playwright`, and leaving `CHROMIUM_PATH` UNSET is what works —
                setting it to an empty string also works, setting it to a guessed path does not.
                ⚠️ `npm i -D playwright --no-save` is required per tree; it is NOT in `package.json`.

---

## LOG

### 2026-09-02 · claim
- `wt-2` assigned by `docs/orch/BOARD.md` wave 2 (`FHE-TASK-SITECOPY-B` · Opus · HIGH · thinking ON · `wt-2`).
  The prompt did not name a worktree; the BOARD did, and the BOARD is ORCH's dispatch record. Not self-selected.
- Guard, run immediately before checkout in the same turn:
  - `git rev-parse --abbrev-ref HEAD` → `HEAD` (detached) ✅
  - `git status --porcelain` → empty ✅
- `git fetch origin && git checkout -b task/sitecopy-b origin/main` → `0ae5855f`
- `git clean -xdf -e node_modules -e .env -e .env.db` → removed inherited `dist/`, `dist-ssr/`
- `.env` and `.env.db` both present in the tree.
- ⚠️ Sibling threads live in the pool: `wt-1` = `task/landingsignin`, `wt-3` = `task/signflow-a`.

### 2026-09-02 · CLNR pass (zeroth act) — CLEAN
- `docs/` root: **0 loose files**, 12 entries, all directories. Trigger "> 20 loose" does not fire.
- Five folders sit outside `CLNR-ROLE.md` §2a: `contract-content/`, `contract-exports/`, `proposed/`,
  `staged/`, `ui-orders/`. **Long-standing, not new, and owned by the queued `CLNR-REPO-STATE`, which
  `BOARD.md` HOLDS while build threads run.** Three build threads are live right now (`wt-1`
  landingsignin, `wt-2` this, `wt-3` signflow-a) → **reported, not fixed** (§3 non-negotiable: never
  move a file under a running thread).
- §2b resumability: `docs/method/` holds `ORCHESTRATOR.md` · `DISCO-ROLE.md` · `TASK-ROLE.md` ·
  `CLNR-ROLE.md` (+ `DSNR-ROLE.md`, `CODR-PROFILE.md`, `RNR-ROLE.md`) → **PASS, all roles.**
  `docs/orch/` newest = `ORCH7-BRIEF.md` + `BOARD.md` → **PASS.** `docs/tasks/TASK-SITECOPY-B-*.md`
  findable from the identifier alone → **PASS.**
- Two-live-lineages check on my own subject: `docs/tasks/TASK-SITECOPY-jumper-only-program-not-barn.md`
  still sits beside `-A` and `-B`, **but it opens with `🔒 SUPERSEDED 2026-09-01 … DO NOT BUILD FROM
  THIS FILE` and names both superseders.** That is supersede-in-place, which is the rule, not a
  violation. It is cited by 5 live files. **Left alone.**
- **CLNR: clean.**

### 2026-09-02 · the spec's premises, re-run (D20)
⚠️ **THE SPEC'S HEADLINE FINDING IS FALSE.** §2 claims *"Consumers today: ZERO … Nothing renders it"*
and asks me to report a D17 finding that `TASK-FACILITYTERM` shipped with no adopter.

```
$ git grep -l "usePropertyTerm" 4297345a -- src/ | wc -l     # the spec's OWN measured commit
17
$ grep -rl "usePropertyTerm" src/ | wc -l                    # main today, 0ae5855f
17
```
**16 consumer files + the definition, and that was already true at `4297345a` when DSNR measured.**
`PublicIntakeForm` · `HorseIntakeForm` · `AppOverviewModal` · `SessionFields` · `CreateModal` ·
`CommunityFeed` · `NotFound` · `HorsePage` · `Visit` · `Schedule` · `ContractPage` · `HorsesPage` ·
`Onboarding` · `AdminBrandingPage` · `LessonPackagesPage` · `SchedulePage`.
⚠️ **`ContractPage.tsx:1830` already uses `withArticleCapitalized` + `agree` together** — the exact
idiom this task was told nobody had ever used. **There is no D17 finding here. This is an ordinary
adoption of a well-adopted mechanism.**

Everything else in §2 verified true:
| Premise | Result |
|---|---|
| 5 strings at the stated lines | ✅ all five exact, unmoved |
| `BrandProvider` wraps the whole route tree | ✅ `src/App.tsx:149-150` |
| `usePropertyTerm()` cannot throw outside a provider | ✅ `BrandProvider.tsx:139-141`, `?? DEFAULT_PROPERTY_TERM` |
| `/confirmation` route | ⚠️ `src/App.tsx:214`, not `:216` |
| `OrderPayment` renders on two surfaces | ✅ `OrderDetail.tsx:152` and `Onboarding.tsx:2256` (spec said `Onboarding.tsx:29` — that is the IMPORT) |
| `ActivationOrderPanel` mounted at `Onboarding.tsx:1453` | ✅ exact |
| `/confirmation` not prerendered | ✅ absent from `scripts/prerender.mjs` |

### 2026-09-02 · the edits (`5875ead5`)
- `Confirmation.tsx` — hook hoisted into `Confirmation()`; the three `SendLine` props become template
  literals over `withArticle()`. `SendLine` itself is untouched and stays a module-scope
  presentational component that takes finished sentences (TRAP 6 satisfied by construction).
- `OrderPayment.tsx` — hook at the top of the component body; `&mdash;` entities preserved verbatim
  (TRAP 5); `or cash {withPreposition(propertyTerm)}`.
- `ActivationOrderPanel.tsx` — module-scope `toldSentence(reached, term)`; subject and verb chosen in
  one destructuring, `withPreposition()` for the phrase.
- Gates: typecheck **0** · typecheck:api **0** · lint **45 warnings, 0 errors** — ⚠️ **and 45 is the
  BASELINE on `origin/main`, measured by stashing `src/` and re-running. `BOARD.md` says 46; it is one
  step stale.** My three files produce **zero** eslint output. `npm run build` **exit 0**.

### 2026-09-02 · the probe — 30/30 ALL PASS
`test/browser/sitecopy-b.{tsx,html}` + `test/browser/probe-sitecopy-b.mjs`, on SIGNBOOK's harness
(`npx vite --config test/browser/vite.config.ts --port 5199`). Two full runs: FHE's default term, and
a PLURAL override installed through the real `my_property_term` → `AuthContext` → `BrandProvider` →
`usePropertyTerm` seam. Every sentence read off the rendered page; the activation one reached by
CLICKING the real controls. Full transcript in the report §2.

⚠️ **FINDING, recorded before chasing it:** `Onboarding.tsx` mounts `OrderPayment` at `:2256` behind
`step === 'payment'`, and **no `setStep('payment')` exists anywhere in the file.** `:649-653` says why
(SIGNBOOK removed `enterPayment`; CR-98 moved payment after approval; the markup is kept under
NOSTRIP for REQCARDS). **So TRAP 4's "two surfaces" is one live surface + one retired one**, and
`:106-108` / `:621` still claim otherwise — stale, another thread's file, flagged not fixed.

⚠️ **FINDING:** the spec's §5 claim that every other `barn` is a comment is false. **Five RENDER**
(`ConsumptionLogPage:210`, `AllocationRulesPage:102`+`:413`, `BarnopsHubPage:88`,
`ContactsPage:607`) — all staff surfaces, four of them inside a module NAMED "Barn Ops". §5 forbids
touching them, so §8's test 1 is unpassable as written. Routed to DSNR in the report.

### 2026-09-02 · TEARDOWN — census
- `pkill -f "vite --config test/browser/vite.config.ts"` → **port 5199 free** (`lsof -i :5199` empty).
- Chromium/playwright processes: **none** (`ps aux | grep -iE "vite|chromium|playwright"` → no rows).
- `rm -rf node_modules/playwright node_modules/playwright-core node_modules/.bin/playwright` — the
  `--no-save` install is OUT of the tree again. **`git status --porcelain -- package.json
  package-lock.json` is EMPTY**, so neither file was touched (TASK-ROLE §5's `--no-save` trap).
- `git clean -xdf -e node_modules -e .env -e .env.db` → removed `dist/`, `dist-ssr/`.
- `git status --porcelain` → **empty**. All work committed on `task/sitecopy-b`. **NOT PUSHED.**
- Worktrees: `wt-1` `task/landingsignin` · `wt-2` `task/sitecopy-b` (mine) · `wt-3` `task/signflow-a`.
  **No worktree created or moved by me.**
