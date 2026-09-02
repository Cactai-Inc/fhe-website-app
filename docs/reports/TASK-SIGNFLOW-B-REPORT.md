# TASK-SIGNFLOW-B — REPORT

**Thread:** `FHE-TASK-SIGNFLOW-B` · **Spec:** `docs/tasks/TASK-SIGNFLOW-B-address-inputs-normalize-on-blur.md` (CR-100)
**Worktree:** `wt-3` · **Branch:** `task/signflow-b` · **Merge-base:** `c23dc022`
**Commits:** `2ab6005c` (the normaliser) · `c3b607b9` (the doors) · docs commit below.
**Ledger:** `docs/reports/FHE-TASK-SIGNFLOW-B-LEDGER.md`
⚠️ **NOT PUSHED. ORCH merges.**

---

## 0. CLNR PASS (zeroth act)
**Not clean, and NOTHING WAS MOVED** — `task/signflow-d` is checked out in `wt-1` and `SITECOPY-A` is
dispatched to `wt-2` (BOARD Wave 1); CLNR-ROLE §3 forbids moving a file under a running thread, and
ORCH6's standing HOLD parks `CLNR-REPO-STATE` until no build thread is mid-flight. Findings, reported:

- **Resumability test (§2b): PASS for all five roles** — `ORCHESTRATOR.md` · `DISCO-ROLE.md` ·
  `DSNR-ROLE.md` · `TASK-ROLE.md` · `CLNR-ROLE.md`. State findable at `docs/orch/BOARD.md`; my spec
  findable from my identifier alone; no two files in `docs/orch/` claim to be the live version of one thing.
- **Loose files at `docs/` root: 0** (trigger is >20).
- **Folders outside CLNR §2a:** `contract-content/` · `contract-exports/` · `proposed/` · `staged/` ·
  `ui-orders/`. Pre-existing; `CLNR-REPO-STATE`'s job.
- ⚠️ **`docs/method/` holds STATE, which THE-RUNNING-RECORD §4 says it never should:**
  `03-REMAINING-WORK.md` · `04-OPEN-QUESTIONS.md` · `ORCH6-FOR-REVIEW-2026-09-01.md` · `BENCH-TEST-2026-09-01.md`.
- ⚠️ **10 of the 12 most recent `TASK-*-REPORT.md` carry no `## VALIDATION` block** — SIGNSTRIP,
  SIGNDOOR, AR4, REAPER, MODAL2, CR85, BOOKS1, BACKDATE, ZELLECLOSE, WALLSYNC. CLNR §2c calls a report
  with no ORCH validation a finding: it means a self-reported done was merged unchecked.

---

## 1. THE HEADLINE
`street` · `city` · `region` · `postal` are now four kinds in the one shared normaliser, and
`normalizeKindForField` matches them on **exact keys, ahead of the substring arms**.
**Four doors are wired, not three:** onboarding, the `/sign` deal branch, and the staff dossier — plus
**`CaptureInfoModal`, which the spec's §5 said had no address fields and which has five.**
`.toUpperCase()` is off both state boxes, so `ca` stays `ca` while a person types.
**No verification service, no lookup, no autocomplete, no DB write, no migration, no new required field.**

---

## 2. CRITERION BY CRITERION AGAINST §8

⚠️ **Items 1–6 are RENDER criteria. I have no staff login and I did not simulate one** — they are the
owner's numbered checklist in §8 below, and the values there are what the transforms return, proven by
unit test, not by me watching a screen.

### 7. Unit tests — `src/lib/normalize.test.ts`, extended, not replaced
**Pass count BEFORE: 18. AFTER: 42.**
```
$ npx vitest run src/lib/normalize.test.ts
 Test Files  1 passed (1)
      Tests  42 passed (42)
```
Covered: every row of §3b's table · every "must not change" case in item 6 · `921091234` → `92109-1234` ·
`normalizeKindForField` for **all 17** keys in §3c (see §6 — the spec says 15; the list is 17).
🔒 **The two `toBeNull()` assertions at the old `:130-131` are REWRITTEN, not deleted**, to
`expect(normalizeKindForField('city')).toBe('city')` and `…('address_line1')).toBe('street')`, with a
comment recording that CR-100 is the owner taking his own escape hatch. Five extra collision
assertions were added that the spec did not ask for — `capacity`, `estate`, `statement`, `zipline`,
`street_view_url` all → `null` — because they are what proves §3c's exact-key rule rather than
asserting it.

### 8. `tsc` and `build`
```
$ npx tsc --noEmit          → 0 errors
$ npm run typecheck:api     → 0 errors
$ npm run build             → exit 0, all 8 routes prerendered, sitemap + robots written
$ npx eslint <the 5 files>  → 0 errors, 1 warning (Onboarding.tsx:923 exhaustive-deps,
                              PRE-EXISTING — proven by stashing my diff and re-running)
$ npm run test:api          → 7 passed (7)
```
⚠️ **`npm run test` DOES NOT EXIST** — see §6. `test:db` not run and not reported, per §8.8.

⚠️ **THE BUILD FAILED THE FIRST TIME AND IT WAS NOT MY DIFF.** `wt-3` came out of the pool with a
`node_modules` older than the ANALYTICS merge, so `vite build` died on
`Rollup failed to resolve import "@vercel/analytics/react"`. `npm ci` fixed it. **A pooled worktree is
not build-ready on entry** — see "flagged, not fixed."

### 3. The dossier, with NO edit to `ContactDossierModal.tsx`
```
$ git diff --stat $(git merge-base HEAD origin/main)..HEAD
 src/components/app/CaptureInfoModal.tsx |  22 +++-
 src/lib/normalize.test.ts               | 193 +++++++++++++++++++++++++++++++-
 src/lib/normalize.ts                    | 105 ++++++++++++++++-
 src/pages/SignStart.tsx                 |  22 +++-
 src/pages/app/Onboarding.tsx            |  20 +++-
 5 files changed, 344 insertions(+), 18 deletions(-)
```
**`ContactDossierModal.tsx` is not in the diff.** Its `onBlur` at `:526` calls `normalizeKindForField(k)`
over `FIELD_GROUPS`, whose "Mailing address" group is `address_line1, address_line2, city, state,
postal_code, country` — all six are now exact keys, so all six wired themselves. ⚠️ **This is a
mechanism argument, not an observation.** The owner's item 3 is what proves it on screen.

### 9. The reach inventory — §3 below.
### 10. CR-100 named in the file — `normalize.ts:2` (header line), `:26-33` (header block, both owner
quotes including the "no paid lookup" bound), `:97-101` (the address section), `:190-204`
(`normalizeKindForField`'s rewritten narrowing note). **The next thread cannot re-narrow this without
deleting the owner's own words.**

---

## 3. THE REACH — every input element in `src` that writes an address field

**Method:** `grep -rn 'address_line1\|address_street\|postal_code\|address_zip\|address_city\|address_state\|address_line2' src`,
then each hit opened and classified. ⚠️ **§6 of the spec asked "is that the only way?" — IT IS NOT.
There are TEN address doors, not three.**

| # | Surface (file:line) | Writes | State |
|---|---|---|---|
| 1 | `Onboarding.tsx:1637, 1643, 1651, 1656` | **contact** (`address_street/city/state/zip`) | ✅ **WIRED — this task** |
| 2 | `SignStart.tsx:655, 669, 683, 697, 720` (deal branch) | **contact** | ✅ **WIRED — this task** |
| 3 | `ContactDossierModal.tsx:521-527` over `FIELD_GROUPS:122-124` | **contact** (6 fields) | ✅ **WIRED by the derivation, zero edits** |
| 4 | `CaptureInfoModal.tsx:206, 213, 219, 230, 236` | **contact** (`captureContactInfo`, `:123-127`) | ✅ **WIRED — this task, NOT in the spec (§6 below)** |
| 5 | `ProvisionClientForm.tsx:558, 561, 564, 566` | **contact** — staff provisioning a client | ❌ **NOT WIRED** |
| 6 | `ContractIntake.tsx:193-204` | **contact** — the "Mailing address" fieldset | ❌ **NOT WIRED** |
| 7 | `ContractPage.tsx:1973-1979` — the co-buyer entry grid | **contact** — 4 of its 8 fields are address | ❌ **NOT WIRED** |
| 8 | `DocsParticipantFlow.tsx:331, 335, 339, 347` | participant → `address_line1…postal_code` | ❌ **NOT WIRED** — ⚠️ **owned by `SIGNFLOW-A/C/D`, deliberately untouched** |
| 9 | `AccountInfoCard.tsx:138-153` | **the TENANT's own** mailing address, not a contact | ❌ **NOT WIRED** — and different in kind: its `onBlur` already COMMITS, so wiring it means normalise-then-commit in one handler (T1), not a one-liner |
| 10 | `HorseIntakeForm.tsx:319` (vet business) · `:426` (a horse's location) | **not a person's address** — a vet's premises, a horse's yard | ❌ **NOT WIRED**, and arguably should not be |

**Rows 5, 6, 7 are the honest gap: three surfaces that write the SAME contact record my four doors
write, left inconsistent with them.** They are in no sibling spec, they are not in my §3d, and
TASK-ROLE §5 says a change outside my owned files is reported, not made. 🔒 **This is a QUESTION for
ORCH, stated in §5.** Row 8 is another thread's file. Rows 9 and 10 are different entities.

**Doors 1 and 2, walked as a person (§6 of the spec):**
1. signed-in client → `/app/onboarding` → details step → Street / City / State / ZIP.
2. counterparty, **usually not signed in** → `/sign/<path>` where `isDeal` → Street / Apt / City / State / ZIP.
3. staff → Records/Clients → a person → Contact dossier → *Mailing address*.
4. staff → a contract with a party missing an address → **"Add address"** on the Parties & Horse card,
   or the auto-prompt when locking a contract with gaps → `CaptureInfoModal`.

---

## 3b. §2c — THE THREE QUESTIONS

⚠️ **This task CAPTURES no new value.** It changes the SHAPE of values four existing surfaces already
captured. Nothing is stored that was not stored before, and no column, key or array was added.

1. **CAPTURE → WHERE IS IT SEEN?** In the box itself, immediately, before anything saves — that is the
   whole design (`normalize.ts:4-5`). Then: the contact record (`ContactDossierModal`'s *Mailing
   address*), and **on every contract that prints a party address**, because `compose_address`
   (`api.ts:2397-2412`) composes `{{…ADDRESS}}` from exactly these columns. **There is no stored value
   here without a reader.**
2. **SEEN → WHERE IS IT ACTED ON?** On the contract. ⚠️ **T7 is the real consequence and it is the
   intended one: a lowercase address typed today prints capitalised on tomorrow's paperwork.** Nothing
   is time-bound — no alert, no queue, no bell. **Existing rows are NOT backfilled** (§5 of the spec),
   so a contract regenerated from an old contact still prints what is stored.
3. **WHAT ELSE DOES THIS OUTCOME NEED THAT NOBODY ASKED FOR?** **Rows 5, 6 and 7 of the reach table.**
   The outcome the owner asked for is "addresses look right"; three staff-facing doors still write the
   same record without shaping it, so an address entered through *Provision client* or *Contract
   intake* still prints as typed. ⚠️ **Presented here BEFORE the work is called done, per §2c.**

---

## 4. FLAGGED, NOT FIXED — one line each
- **`ProvisionClientForm` / `ContractIntake` / `ContractPage` co-buyer write contact addresses with no normalizer** — the same defect this task fixed elsewhere; see §5.
- **`AccountInfoCard.tsx:138-153`** — the tenant's own address is unnormalised, and its `onBlur` commits, so it needs normalise-then-commit rather than a one-liner.
- **A pooled worktree is NOT build-ready:** `wt-3`'s `node_modules` predated the ANALYTICS merge and `npm run build` failed until `npm ci`. TASK-ROLE §5 implies the pool saves this step; it does not.
- **`src/lib/questionSets.test.ts` is red at baseline on `origin/main`** (1 failed | 83 passed) — verified by stashing my diff; not mine, not touched.
- **`origin/main` moved under me mid-run** to `77f9c2f2` (D41 — five roles consolidate to ORCH + TASK-with-profiles). Docs only; nothing in it changes this build. My branch is behind by two docs commits.
- **`Onboarding.tsx:923` exhaustive-deps warning** — pre-existing, untouched.

---

## 5. WHAT I DECIDED THAT THE SPEC DID NOT

🔒 **1. I WIRED `CaptureInfoModal.tsx`, WHICH §5 LISTED AS OUT OF SCOPE.**
**Why:** §5's entry reads *"CaptureInfoModal / StableEditors — verified: no address fields."* **For
`CaptureInfoModal` that is false.** It has five address inputs, it already imports `useFieldNormalizer`
and already wires name/phone/email, it carried its own `.toUpperCase()` on the state box, and it writes
`address_line1 / address_line2 / city / state / postal_code` straight onto the **contact record** — the
same D22 record the three named doors write. The exclusion was conditional on a fact that is not true,
so it does not survive its reason (TASK-ROLE: *"if a premise is wrong … continue against reality"*),
and §6 says an unwired door is this task shipping half-done. **Collision check run first:
`CaptureInfoModal` appears in NO sibling spec** (SIGNFLOW-A/C/D, SITECOPY-A, LANDINGSIGNIN).
`StableEditors` I re-verified separately: **it genuinely has no address fields.**

**2. I did NOT wire rows 5–7 of the reach table.** That is a scope decision, not a HOW, and TASK-ROLE
sends it up rather than letting me make it. 🔒 **ORCH: this is the question — do rows 5, 6 and 7 get a
follow-up task, or do they ride in a SIGNFLOW-B amendment?** The edit is five one-liners per surface in
the idiom now used in four files; it is small, and it is not mine to authorise.

**3. `normalizeRegion` uses `/^\p{L}{2}$/u`, not `[A-Za-z]{2}`** — matching the file's existing
`UPPER` / `LOWER_FIRST` Unicode regexes. Identical behaviour for US states.

**4. Five collision assertions added to the test file** (`capacity`, `estate`, `statement`, `zipline`,
`street_view_url`) beyond what §8.7 listed, because they are what makes §3c's exact-key rule a proof.

**5. `git clean -xdf` + `npm ci` in `wt-3`** — required to get a green build, see §4.

---

## 6. WHERE THE SPEC WAS WRONG

1. 🔒 **§5: *"CaptureInfoModal / StableEditors — verified: no address fields"* — FALSE for
   `CaptureInfoModal`.** Five address inputs at `:196, 202, 207, 212, 218` (pre-edit), writing the
   contact record at `:123-127`, with its own `.toUpperCase()` at `:213`. **This is the miss that
   would have shipped a fourth door correcting nothing while three others corrected.** ⚠️ **It also
   means §6's "three doors" framing was wrong, and §8's items 1–6 covered three of four.**
2. **§8.7: *"`npm run test` green"* — that script does not exist.** `package.json` has `test:api` and
   `test:db` only; unit tests run under `npx vitest run <path>`. Reported both.
3. **§8.7: *"all 15 keys in §3c"* — §3c lists 17** (street 6 incl. `country`, city 2, region 4,
   postal 5). All 17 are tested.
4. **§3e cites `Onboarding.tsx:1615` for `text_only_phone`** — the element opens at `:1613`; `:1615`
   was its `placeholder` line. Same element, no consequence.
5. **Everything else in §2 re-measured EXACTLY right**, including all four address line numbers, the
   `.toUpperCase()` at `SignStart.tsx:690`, and `FIELD_GROUPS:122-124`.

---

## 6b. THE ADJACENT ONE-LINER (§3e), DONE — reported under its own heading as instructed
`src/pages/app/Onboarding.tsx:1615` now carries
`onBlur={normalize('ob-text-phone', 'phone', form.text_only_phone, (v) => setForm((f) => ({ ...f, text_only_phone: v })))}`.
**Authorised by the spec's own author in §3e; not drift.** The texts-only number and the mobile number
beside it now behave identically.

---

## 7. THE GATES
| | |
|---|---|
| `npx tsc --noEmit` | **0** |
| `npm run typecheck:api` | **0** |
| `eslint` (5 touched files) | **0 errors**, 1 pre-existing warning |
| `npm run build` | **exit 0** — 8 routes prerendered, sitemap + robots written |
| `npx vitest run src/lib/normalize.test.ts` | **42/42** (was 18/18) |
| `npm run test:api` | **7/7** |
| `npx vitest run src` | 168 passed, **1 failed — `questionSets.test.ts`, red at baseline on `origin/main`** |
| `npm run test:db` | not run, proves nothing (§8.8) |

---

## 8. THE OWNER'S CHECKLIST — ⚠️ RENDERS ARE NOT VERIFIED BY ME

**Type everything lowercase, exactly as you wrote it:** `752 windemere ct` / `san diego` / `ca` / `92109`.
📱 **Items 1 and 2 are worth doing ON YOUR PHONE** — door 2 is a stranger on a phone, and the state box
is 16px wide there.

1. **Onboarding** — `/app/onboarding` → the details step. Blur each of the four. Expect
   `752 Windemere Ct` · `San Diego` · `CA` · `92109`. **Submit, come back, and check the saved value
   equals the shown value on all four.**
2. **The deal door** — `/sign/…`, deal branch. Same four results. ⚠️ **AND WHILE YOU TYPE `ca` THE BOX
   MUST SAY `ca`, NOT `CA` — it only changes when you click away.** That is the `.toUpperCase()`
   removal and it is a PASS, not a regression.
3. **The staff dossier** — Records → a person → Contact dossier → *Mailing address*. Same four on
   `Street` / `City` / `State` / `ZIP`, **with no edit to that file** (proven in §2, item 3).
4. ⚠️ **NEW — THE FOURTH DOOR THE SPEC MISSED.** Open a contract whose party has no address → **"Add
   address"** on the Parties & Horse card (or just lock a contract with gaps and let it prompt). Same
   four results, and the same "`ca` stays `ca` while typing" check as item 2.
5. **`country`** → type `united states`, expect `United States`. **`address_line2`** → type `apt 4b`,
   expect **`Apt 4b`** (not `4B` — we never guess a capital nobody typed).
6. 🔒 **THE NO-REFIGHT GUARD — the promise, and the reason nothing needs an undo button.** In the same
   session, after step 1: change `Ct` back to `ct` and click away. **It must stay `ct`.** Then change
   `San Diego` back to `san diego` and click away — **stays.** ⚠️ **Run this on all four doors.**
7. **THE THINGS THAT MUST NOT CHANGE — one blur each, and tell me what you actually saw:**
   `California` → `California` · `Baja California` → `Baja California` · `SW1A 1AA` → `SW1A 1AA` ·
   `PO BOX 12` → `PO BOX 12` · `SAN DIEGO` → `SAN DIEGO` · and a UK-style `SW1A 1AA` typed into the
   **ZIP** box must not block the field (the deal door's submit still refuses it, which is unchanged
   and correct).

---

## 9. TEARDOWN
No dev server, no browser, no scratch worktree started. `wt-3` stays claimed on `task/signflow-b`
until ORCH merges.
```
$ ps -Ao comm | grep -E "vite|node .*dev|playwright" | grep -v grep
(nothing — the only chrome hits are VS Code's and the desktop browser's crashpad
 helpers, neither started by this thread)
$ git worktree list
…/fhe-website-app  77f9c2f2 [main]
…/wt-1             e6d58cb6 [task/signflow-d]   ← SIGNFLOW-D, running
…/wt-2             8821a336 [task/sitecopy-a]   ← SITECOPY-A, running
…/wt-3             c3b607b9 [task/signflow-b]   ← mine
```
**All three Wave-1 threads are live and file-disjoint as the board planned.** ⚠️ **`wt-2` was idle and
detached when I censused it at open; it is now claimed by `SITECOPY-A` — the board's Wave 1 is fully
dispatched.**

---
## VALIDATION — ORCH, 2026-09-02
See TASK-SIGNFLOW-B-VERIFICATION.md beside this report — independently verified and merged; details there.
