# FHE-TASK-SIGNFLOW-B — RUNNING LEDGER

**Spec:** `docs/tasks/TASK-SIGNFLOW-B-address-inputs-normalize-on-blur.md` (CR-100)
**Opened:** 2026-09-01

## RESUME
Role / thread   FHE-TASK-SIGNFLOW-B · wt-3 · branch task/signflow-b
Merge-base      c23dc022 (origin/main at fetch time; not moved since)
DONE            wt-3 guard (detached + clean) passed; branch claimed; ledger opened
IN FLIGHT       CLNR pass (zeroth act)
NEXT            CLNR sweep → spec read-back → verify §2 premises
DECIDED         —
BLOCKED         —
DO NOT          —

## LOG
- 2026-09-01 — wt-3 guard: `git status -sb` = `## HEAD (no branch)`, `git status --porcelain` empty. PASS.
- 2026-09-01 — `git checkout -b task/signflow-b origin/main` at `c23dc022`. `git clean -xdf -e node_modules -e .env -e .env.db` run. `.env` + `.env.db` present.
- 2026-09-01 — Worktree assignment `wt-3` taken from `docs/orch/BOARD.md` "Wave 1" table (`FHE-TASK-SIGNFLOW-B` | Opus · HIGH · thinking ON | `wt-3`). Not self-selected.
- 2026-09-01 — CLNR pass run (zeroth act). NOT clean, but NO MOVES MADE — `task/signflow-d` is checked
  out in `wt-1` and `SITECOPY-A` is dispatched to `wt-2` (BOARD Wave 1), and CLNR-ROLE §3 forbids
  moving files under a running thread. Also ORCH6's standing HOLD parks `CLNR-REPO-STATE` until no
  build thread is mid-flight. Findings reported, not fixed:
  - docs root loose files: 0 (trigger is >20). PASS.
  - Folders outside CLNR §2a: `contract-content/`, `contract-exports/`, `proposed/`, `staged/`,
    `ui-orders/`. Pre-existing; owned by the held `CLNR-REPO-STATE`.
  - `docs/method/` holds STATE, which §4 of THE-RUNNING-RECORD says it never should:
    `03-REMAINING-WORK.md`, `04-OPEN-QUESTIONS.md`, `ORCH6-FOR-REVIEW-2026-09-01.md`,
    `BENCH-TEST-2026-09-01.md`.
  - 10 of the 12 most recent `TASK-*-REPORT.md` carry no `## VALIDATION` block (CLNR §2c finding):
    SIGNSTRIP, SIGNDOOR, AR4, REAPER, MODAL2, CR85, BOOKS1, BACKDATE, ZELLECLOSE, WALLSYNC.
  - Resumability test (§2b): ORCH `ORCHESTRATOR.md` PASS · DISCO `DISCO-ROLE.md` PASS ·
    DSNR `DSNR-ROLE.md` PASS · TASK `TASK-ROLE.md` PASS · CLNR `CLNR-ROLE.md` PASS ·
    state findable (`docs/orch/BOARD.md`) PASS · spec findable from identifier PASS.
  - No two files claim to be the live version of the same thing in `docs/orch/`.

## PREMISE VERIFICATION (TASK-ROLE second act) — 2026-09-01
Every §2 fact re-run in wt-3 at `c23dc022`:
- `src/lib/normalize.ts:27` — `export type NormalizeKind = 'name' | 'phone' | 'email'`. ✅
- `src/lib/formState.ts:367` `useFieldNormalizer`, `lastOutput` Map keyed per field. ✅
- `src/lib/normalize.ts:127` `normalizeKindForField`, three substring arms. ✅
- `grep -n "normalize(" src/pages/app/Onboarding.tsx` → 5 hits: 1526, 1534, 1558, 1564, 1592. ✅
- Onboarding address inputs at **1632 / 1637 / 1641 / 1645**, `onChange` only. ✅ (spec exact)
- `SignStart.tsx` deal branch address block **641–712**; `.toUpperCase()` on change at **690**. ✅
- `ContactDossierModal.tsx:526` derives kind from key; `FIELD_GROUPS` "Mailing address" at **122–124**
  = `address_line1, address_line2, city, state, postal_code, country`. ✅ zero call-site edits needed.
- §3e: `text_only_phone` input is at **1613** (spec says 1615 — that is the `placeholder` line of the
  same element). Same element, no normalizer. ✅

### ⚠️ SPEC ERROR FOUND — §5's "CaptureInfoModal … verified: no address fields" IS FALSE
`src/components/app/CaptureInfoModal.tsx` has FIVE address inputs — `196` (line1), `202` (line2),
`207` (city), `212` (state, and it carries its own `.toUpperCase()` on change), `218` (zip) — and
writes `patch.address_line1 / address_line2 / city / state / postal_code` (`:123-127`) straight onto
the **contact record**, i.e. the same D22 source of truth the three named doors write. It already
imports `useFieldNormalizer` (`:5`, `:44`) and already wires name/phone/email (`:159, :164, :175,
:186`). It is a FOURTH DOOR of exactly the same class.

DECIDED: **wire it**, per TASK-ROLE §2 ("if a premise is wrong … continue against reality, not
against the spec") and spec §6 ("an unwired door is this task shipping half-done"). §5 excluded it
*because* it was believed to hold no address fields; the exclusion does not survive its false reason.
Collision check run first: `CaptureInfoModal` appears in **no** sibling spec (A / C / D / SITECOPY-A /
LANDINGSIGNIN). `DocsParticipantFlow` and `ContractPage` ARE claimed by SIGNFLOW-A/C/D — **not touched.**

## STEP 1 — the normaliser. COMMIT `2ab6005c`
- `NormalizeKind` widened to 7: `name|phone|email|street|city|region|postal`.
- `normalizeStreet` / `normalizeCity` both `return normalizeName(raw)` (D18: reuse, not a second rule).
- `normalizeRegion`: `/^\p{L}{2}$/u` → uppercase, else trimmed-as-typed.
- `normalizePostal`: `^\d{5}$` / `^\d{5}-\d{4}$` pass through trimmed; `^\d{9}$` → `12345-6789`; else as typed.
- `normalizeValue` switch extended by four cases. `normalizeOnBlur` + `useFieldNormalizer` NOT touched.
- `normalizeKindForField`: exact-key `switch (f)` for the 17 address keys, placed BEFORE the three
  substring arms. Docstring + the §3a narrowing comment rewritten to name CR-100 and quote the owner;
  `po box 12` kept as a WORKED EXAMPLE. Header comment names CR-100 and the "no paid lookup" bound.
- Tests: **18 → 42 passing** in `src/lib/normalize.test.ts`. The two `toBeNull()` assertions at old
  `:130-131` are REWRITTEN to `'city'` / `'street'` with a comment recording why they flipped.
- `npx tsc --noEmit` clean.

DECIDED (spec did not decide): `normalizeRegion` uses `\p{L}{2}` (Unicode letters) not `[A-Za-z]{2}`,
matching the file's existing `UPPER`/`LOWER_FIRST` Unicode regexes. Effect is identical for US states.
DECIDED: §3c's key list is **17 keys**, not the 15 the spec's §8.7 says. All 17 are tested.

## STEP 2 — the doors. COMMIT `c3b607b9`
- `Onboarding.tsx` 1637/1643/1651/1656 wired street/city/region/postal, keys = the input ids.
  §3e's `ob-text-phone` wired at 1615.
- `SignStart.tsx` 659/672/687/710/725 wired; `.toUpperCase()` REMOVED from the state box's `onChange`.
  Verified nothing downstream assumed uppercase: `addressFilled` (:402), `addressStarted` (:410) and
  `ZIP_RE` (:442) are all case-insensitive and unchanged.
- `CaptureInfoModal.tsx` 206/213/219/230/236 wired; its own `.toUpperCase()` removed too. Its
  `validate()` (:75-81) has no case assumption either.
- `ContactDossierModal.tsx` NOT edited — proven by `git diff --stat` against the merge-base.
- T6 (saved == shown): Onboarding submits `{ ...form }` (`:1061`) — the normalised value IS the payload.
  SignStart submits `line1.trim()` etc. from live state at `:461-465`, in a handler re-created each
  render, so no stale closure.

## GATES
tsc 0 · typecheck:api 0 · eslint 0 errors (1 pre-existing warning) · build exit 0 ·
normalize.test 42/42 (was 18) · test:api 7/7 · `src` suite 168 pass / 1 fail (questionSets, red at
baseline on origin/main — verified by stashing).

## DO NOT
- **DO NOT trust a pooled worktree to build.** `wt-3`'s `node_modules` predated the ANALYTICS merge and
  `npm run build` died on `@vercel/analytics/react`. `npm ci` is REQUIRED on entry, not optional.
- **DO NOT report `npm run test`** — the script does not exist. `npx vitest run <path>` / `test:api`.
- **DO NOT re-narrow `normalizeKindForField`.** The owner's own words are in the file now.

## RESUME
Role / thread   FHE-TASK-SIGNFLOW-B · wt-3 · branch task/signflow-b
Merge-base      c23dc022 — ⚠️ origin/main HAS MOVED to 77f9c2f2 (D41, docs only, changes nothing here)
DONE            CLNR pass · premise verification · normaliser `2ab6005c` · doors `c3b607b9` · report
IN FLIGHT       nothing
NEXT            ORCH verifies and merges. I do not push.
DECIDED         Wired CaptureInfoModal against spec §5 (its stated reason is factually false).
                Did NOT wire ProvisionClientForm / ContractIntake / ContractPage co-buyer — that is
                scope, not a HOW, so it goes up as the question in the report §5.
BLOCKED         nothing
DO NOT          see above
