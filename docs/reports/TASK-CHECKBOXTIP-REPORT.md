# TASK CHECKBOXTIP — ownership affordance on fields the viewer cannot edit

Branch: `task/checkboxtip` · Worktree: `wt-checkboxtip` (off `main` @ `2a8b056`)
Date: 2026-08-06

## Scope delivered

One file changed under the approved freeze exception —
`src/components/app/ClauseDocument.tsx`, ownership affordance only. Plus a new
regression test (`test/ui/`) and its live-data fixtures. No migrations, no DB
writes, no other source file touched.

---

## 1. Was the diagnosis confirmed independently?

**Yes — every claim in it, and it was accurate.** I read the whole file before
touching it and verified each line reference against the code, then verified
against the live database that the reported fields really do take the
un-guarded path.

| Diagnosis claim | Verified | Evidence |
|---|---|---|
| 3 call sites render field controls | ✅ | lines 402 / 784 / 898 in the pre-fix file |
| ~402 passes `cb.editable && selfGateMet && mine` | ✅ | exact text matched |
| ~413 wraps non-owned in `opacity-55 cursor-help` + `otherPartyTip()` | ✅ | exact text matched |
| ~784 (custom rows) passes `editable={cb.editable}`, no `mine` | ✅ | exact text matched |
| ~898 (orphan fields) passes `editable={cb.editable}`, no `mine` | ✅ | exact text matched |
| the insurance `*_NOT_REQUIRED` checkboxes live in the orphan path | ✅ | proved from the DB, below |

**Proof the checkboxes are orphans.** All three carry a `clause_key`, and the
matching `contract_clause_defs.body` contains no `{{token}}` for them — so
`bodyTokens` never holds their key, they fall into `orphanFields`, and they
render through `renderOrphan`:

```
       field_key       | owner_role | format_type |            clause_key
-----------------------+------------+-------------+----------------------------------
 TXN.GL_NOT_REQUIRED   | LESSOR     | certify     | INSURANCE_RISK.GENERAL_LIABILITY
 TXN.MED_NOT_REQUIRED  | LESSOR     | certify     | INSURANCE_RISK.MEDICAL
 TXN.MORT_NOT_REQUIRED | LESSOR     | certify     | INSURANCE_RISK.MORTALITY

clause_key                       | body_has_NOT_REQUIRED_token
---------------------------------+----------------------------
 INSURANCE_RISK.GENERAL_LIABILITY | f
 INSURANCE_RISK.MEDICAL           | f
 INSURANCE_RISK.MORTALITY         | f
```

### One thing the diagnosis did not mention, and it mattered

Threading `mine` alone would **not** have fixed the pointer cursor.

`format_type = 'certify'` renders its own
`<label className="flex items-start gap-2.5 cursor-pointer">`
([ContractCascade.tsx:812](../../src/components/app/ContractCascade.tsx#L812)).
A `cursor-help` on an *ancestor* is only inherited, and an element's own
`.cursor-pointer` rule beats inheritance — so the existing wrapper at line 413
had this latent hole too, for every `certify` / `reveal_text` / button-style
control it wrapped. The wrapper therefore also needed `[&_*]:cursor-help`,
whose generated rule `.\[\&_\*\]\:cursor-help *{cursor:help}` has specificity
(0,1,1) against `.cursor-pointer`'s (0,1,0) and wins regardless of source
order. I did not take that on argument — I measured it (§4).

This stays inside the brief: it is the same one mechanism, and it is what makes
"the cursor must be `cursor-help`, never a pointer" actually true. **No change
was made to `ContractCascade.tsx`.**

---

## 2. The fix

One helper, `OwnedField`, now owns the entire affordance, and **all three** call
sites route through it:

| Call site | Before | After |
|---|---|---|
| `renderToken` (inline `{{token}}`) | inline if/else, `opacity-55 cursor-help` | `<OwnedField active={selfGateMet}>` |
| `renderCustom` (authored rows) | `editable={cb.editable}` | `<OwnedField block>` + `editable={cb.editable && fieldIsMine(f, cb)}` |
| `renderOrphan` (the insurance checkboxes) | `editable={cb.editable}` | `<OwnedField>` + `editable={cb.editable && fieldIsMine(f, cb)}` |

Design points, all directly from the brief:

- **No special case for checkboxes.** `OwnedField` knows nothing about
  `certify`; it wraps whatever it is given.
- **Label inside the tooltip zone.** At the orphan site the wrapper goes
  *outside* the `inline-flex` span that already held both the label and the
  control, so the statement text and its checkbox are one hover target. Rendered
  markup, dumped from the real document:

  ```html
  <span class="opacity-55 cursor-help [&_*]:cursor-help"
        title="This item is set by the Lessor." aria-label="This item is set by the Lessor.">
    <span class="inline-flex items-baseline gap-1.5">
      <span class="block my-1">
        <label class="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" ... disabled="">
          <span ...>General liability insurance is not required for or by either party under this Agreement.</span>
  ```

- **Tooltip, not grey-out.** The control is disabled so the click the server
  refuses cannot be made, but nothing is hidden and the field stays hoverable.
- **Wording** — `otherPartyTip()` now returns `This item is set by ${who}.`
  The mirror needed no code: `who` comes from the field's own `owner_role`, so
  a Lessor viewing Lessee fields reads "This item is set by the Lessee."
  (verified in §3).
- **Staff authoring unchanged.** With no `myRoles`, `OwnedField` returns its
  children in a fragment — byte-identical DOM to today.

---

## 3. What I verified with my own eyes

Everything below is measured output, not inference. Testing used the AVERIFY2
document `9a56b738-36f7-4a55-a813-cdd17fe4d753`. **Sarah's document
`704c8d2d-…` was never queried, read, or written at any point** — it does not
appear in a single command I ran. All database access this task was `SELECT` /
`\d` only.

### 3a. Before / after on the exact reported defect

I ran an identical probe against the **unmodified** file (via `git stash`) and
then the fixed one, rendering the real document as a LESSEE viewer with the
app's real production stylesheet loaded:

| | checkbox `disabled` | label cursor | tooltip |
|---|---|---|---|
| **before** | `false` | `pointer` | `NONE` |
| **after** | `true` | `help` | `"This item is set by the Lessor."` |

Identical for all three (`GL`, `MED`, `MORT`). This is the owner's report
reproduced and then closed.

### 3b. Reach of the fix across the whole document

Rendering all 125 live field rows against the real `HORSE_LEASE_V2` structure:

- **Lessee viewer** — 50 not-mine zones, every one with all controls
  `disabled` and `[&_*]:cursor-help` applied; 27 own-field highlights.
- **Lessor viewer** — 13 not-mine zones, 76 own-field highlights.
- **Mirror confirmed**: the Lessor sees `LESSEE.PARTY_TYPE` ("Lessee is an",
  also an orphan field) with `title="This item is set by the Lessee."` — the
  fixed call site working in both directions.

### 3c. The cursor, measured rather than asserted

Class-name assertions would pass while the UI still showed a pointer, so I
built the app (`npm run build:client`), loaded the emitted
`dist/assets/index-*.css` into the DOM, and read `getComputedStyle`:

```
elements still carrying .cursor-pointer inside a not-mine zone: 19
computed cursor !== 'help': none
"General liability insurance is not required…"  label cursor=help  box cursor=help  disabled=true
"Medical insurance is not required…"            label cursor=help  box cursor=help  disabled=true
"Mortality insurance is not required…"          label cursor=help  box cursor=help  disabled=true
```

All 19 elements that still *carry* `.cursor-pointer` *compute* `help`.

### 3d. Regression test

`test/ui/clause_ownership_affordance.test.tsx` — 5 tests, all passing. Fixtures
are live prod data (the real template structure + all 125 field rows of the
test document), so it exercises the actual document rather than a hand-made
shape.

**Identity values in the fixture are scrubbed.** The raw dump carried real
names, a home address, phone numbers and emails, plus a farrier's and a vet's
contact details — third parties with no stake in this task. I replaced 18
identity/contact *values* with `example.test` placeholders before committing.
Nothing structural changed (keys, `owner_role`, `clause_key`, `format_type`,
`options`, `conditional_on` are all untouched), and I confirmed no
`conditional_on` anywhere references those keys, so no gate reads them. Tests
pass identically before and after the scrub. `LESSOR/LESSEE.PARTY_TYPE`
(`INDIVIDUAL`) was deliberately kept — the mirror test depends on it.

I checked the test is not vacuous: against the unmodified file, **2 of 5 fail**
(the defect test and the mirror test) and pass only with the fix.

### 3e. Repo health

| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 31 warnings — **identical count to baseline**, none in changed/new files |
| `npm run build:client` | succeeds |
| `npx vitest run test/ui` | 5/5 pass |

---

## 4. What I did NOT verify

Stated plainly so it is not mistaken for coverage:

- **No real-browser click-through of the party view.** The test document's
  LESSEE (`AVERIFY2 Tester`, `cjzigs+averify2@icloud.com`) has **no login** —
  `profiles.user_id` is null — so there is no account to sign in as and see the
  Lessee view. Substituted: jsdom rendering of the real component with the real
  data under the real production stylesheet, which is what let me measure the
  computed cursor. Someone with a Lessee login should still eyeball it.
- **Hover-tooltip delivery on a disabled input** is browser behaviour I could
  not measure in jsdom. The mitigation is structural: the `title` sits on an
  ancestor that also covers the always-enabled statement text, so the tooltip
  has a live hover target either way.

---

## 5. Flagged for the orchestrator

1. **`opacity-55` retained.** The brief said the owner "explicitly prefers a
   tooltip over graying out", but also said to route through the *same* wrapper
   as line 413 — which has always carried `opacity-55`. I read that as "don't
   invent a hard disabled/grey treatment; use the tooltip mechanism", and kept
   the existing wrapper exactly. If the owner meant drop the dimming, it is now
   a one-line change in `OwnedField` affecting all three sites at once.
2. **Trailing period.** Owner wording was quoted as "This item is set by the
   Lessor" with no full stop. I shipped `This item is set by the Lessor.` — every
   neighbouring tooltip in the file is a punctuated sentence. Trivial to revert.
3. **`SYSTEM` and unknown owner roles read as "the other party."** Pre-existing
   in `otherPartyTip`'s fallback, and unchanged here. On this document the
   `SYSTEM`-owned rows are auto-fill party tokens with no `clause_key`, so they
   route to `ImportedRecordToken` and are untouched by this change — but the
   generic phrasing does surface on the imported contact tokens. Out of scope;
   raising it rather than widening the diff.
4. **First UI test in the repo.** `test/ui/` is new (`test/db/` was the only
   suite). It needs `npm run build:client` to have run, and says so with a clear
   error if not. The `test:db` script is path-scoped and is unaffected.

## Commands to reproduce

```bash
cd wt-checkboxtip
npm run build:client          # required — the test reads the emitted CSS
npx vitest run test/ui
npm run typecheck && npm run lint
```
