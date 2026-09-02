# FHE-TASK-SITECOPY-B — RUNNING LEDGER

## RESUME
Role / thread   TASK-SITECOPY-B · wt-2 · branch `task/sitecopy-b`
Merge-base      `0ae5855f` (origin/main at claim, 2026-09-02). origin/main has NOT moved since.
DONE            claim + guard (`fb5c4072` ledger) · CLNR pass: clean · spec premises re-measured · all three files edited and committed (`5875ead5`) · typecheck 0 / typecheck:api 0 / lint 45 (= baseline) / build exit 0
IN FLIGHT       render proofs (§8 tests 2-6) in a real browser
NEXT            probe `/confirmation` three states, `/order/:id`, `/app/onboarding`, the activation panel at reached=1 and reached>1, then the plural-override substitution proof
DECIDED         (1) `agree()` is NOT used on the activation sentence — the property term is in a prepositional phrase and never governs the verb; the COUNT does. Using agree() there would render "someone at the stables have been told". The spec's TRAP 2 says agree() "handles the second" verb; there is no second verb. Its TEST §8.5 is right and TRAP 2's explanation is not.
                (2) subject+verb picked in ONE expression in a module-scope helper `toldSentence()` — not two ternaries, and not a nested component (TRAP 6).
BLOCKED         —
DO NOT          ⚠️ Do NOT "fix" the activation verb with `agree(propertyTerm, 'has', 'have')`. It compiles, it looks like the spec's instruction, and it is grammatically wrong for every plural tenant term.

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
