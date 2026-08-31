# TASK-FIX4 — input is never lost, and closing never submits

⚠️ **THIS IS A BUILD TASK.** Report to `docs/reports/TASK-FIX4-REPORT.md`.

**Builds `CR-83` and `CR-84` from `docs/CHANGE-ORDER-LEDGER.md`.** ⚠️ **Read BOTH in full, including
CR-84's three correction entries — the design changed twice and the earlier entries are wrong.** This
file is the settled version.

---

## 1. THE PRINCIPLE

**The app never loses what a person typed, never silently alters it, and never submits it without
being told to.**

⚠️ **THE DISTINCTION EVERYTHING RESTS ON — persisting a draft and committing a record are different
acts:**

| Trigger | Persists the draft | Commits the record |
|---|---|---|
| **auto-save after input** *(and after normalisation)* | ✅ | ❌ |
| **the affirmative action** — Continue · Send · Save · Done · Next | ✅ | ✅ **the ONLY commit trigger** |
| ⚠️ **Close · X · Escape · backdrop** | ✅ *(already persisted)* | ⚠️ **NEVER. Closing is not consent.** |
| **Clear form** | deliberately discards | ❌ |

**Owner:** *"commits on continue/send/commit/done...etc... not a close button click, no user would
input data and click close and expect the form submitted."*

## 2. ⚠️ START HERE — A SHIPPED FIX HAS THE BEHAVIOUR THIS TASK FORBIDS

`ContactDossierModal.tsx:248`:
```
commitRef.current = async () => { if (await commit()) onClose(); };
const requestClose  = () => { void commitRef.current(); };
```
**Every exit — the X, Escape, the backdrop — runs `commit()` then closes. Clicking close SUBMITS the
form.** It solved accidental-close by trading a data-loss bug for an unintended-write bug.

⚠️ **THIS IS A DELIBERATE BEHAVIOUR CHANGE ON A FIX THAT SHIPPED DAYS AGO AND THE OWNER ASKED FOR
TWICE.** **Do not rewrite it silently.** Change it, and **state in your report what changed, why, and
what happens to a record edited between the two behaviours.**

**KEEP its failure handling** — *"if the save fails the record stays open with the edits still in the
boxes and the reason on screen."* ⚠️ **That instinct is right and belongs in the shared component.**
**REPLACE** the commit-on-exit trigger with auto-save-on-input plus an affirmative action.

⚠️ **AND DO NOT ROLL `requestClose` OUT TO THE OTHER MODALS.** That spreads the defect.

## 3. THE GLOBAL SOLUTION — measured, and it is convergence

> *"implement a global solution rather than updating each modal with the fix directly."*

**Measured 2026-08-31:** **33** modals close on backdrop-click or Escape · **17** of those carry
`<input>`, `<textarea>` or `<select>` · ⚠️ **ZERO of the 17 use the shared `src/components/ops/kit/Modal.tsx`,
which already has a `disableBackdropClose` flag and no adopters.**

⚠️ **17 hand-rolled implementations of one component. Converge them.** A patch applied 17 times is the
failure this repo keeps repeating — and CR-37 measured the same shape from the other side (33 screens
build their own overlay against 7 using the shared one).

**Behaviour of the shared component after this task:**
- **a modal containing any input does NOT close on a backdrop click** — the accidental-close case
- **an information or empty modal still closes on click-out**
- **every modal has a Close button**; ⚠️ **there is NO Save button — do not add one**
- **every input form and modal has Clear form**
- ⚠️ **an auto-save indicator, because *"we need to show auto-save so the user knows the inputs are
  saved"*.** **Without it, auto-save is indistinguishable from data loss.**

## 4. NORMALISATION — shown, never silent

**Owner:** *"silent correction is not the way to do it … we should show the normalization by
normalizing after they click out of the input field."*

**ON BLUR**, in front of them, then auto-save the **normalised** value.
⚠️ **ORDER MATTERS AND IS EASY TO INVERT: normalise FIRST, then save.** Saving raw and normalising
later leaves the stored and displayed values disagreeing until the next read.

**Applies to names, phone numbers, and email lowercasing — ⚠️ everywhere a value is typed, staff
surfaces included** *(owner: "yes staff-entered inputs normalize too")*.

**The name rule, four cases:**
| Input | Becomes | Why |
|---|---|---|
| `fiszer` | **`Fiszer`** | a leading lowercase letter is capitalised |
| `labuzetta` | **`Labuzetta`** | better than nothing; they fix the interior capital themselves |
| `LaBuzetta` | ⚠️ **`LaBuzetta`** | **an interior capital is NEVER touched** |
| `la buzetta` | **`La Buzetta`** | per WORD, not per field |

⚠️ **NORMALISE ON ENTRY, NEVER ON EVERY SAVE.** *"if the person corrects it to La buzetta that is ok
we shouldnt recorrect it."* **A field that re-normalises overwrites a deliberate correction and the
person cannot win.**

**Backfill: `contacts` ONLY.** ⚠️ **Documents are untouched and a signature's `typed_name` is sealed
evidence** — `block_signed_signature_update` refuses it, by design. **Four executed signatures carry
an uncapitalised surname (`"Brian olenik"`, three × `"Elisheva fiszer"`). They stay.**

## 5. SIGNING STAYS AN EXACT MATCH — two gates, two jobs

⚠️ **`TASK-FIX1` §4.4 relaxed `Onboarding.tsx`'s browser gate to case-insensitive. The owner's ruling
reverses that for the BROWSER only:**
- **BROWSER gate: EXACT.** *"Signing must require exact match so they catch any typo or
  capitalization error before signing the documents."* **It is the last moment a wrong name is
  visible.**
- **SERVER gate (`record_signature`): stays case-insensitive.** ⚠️ **It must keep accepting the four
  legitimate executed variants. Do not make them the same rule.**

⚠️ **And the exact gate is only safe WITH §6** — a normalisation the person cannot revise before
signing is worse than none.

## 6. LOSSLESS — reload, browser-back, and resume

**Owner:** *"i was using the word refresh to indicate a reload, i fail to see the distinction between
them nor a difference."* ⚠️ **He is right: one requirement, one fix.** A reload and a browser-back
destroy React state identically, **so the draft must live somewhere that outlives the page.**

⚠️ **THIS IS THE LARGEST PIECE OF THIS TASK — persisted per-user draft state, not a modal detail.**
**Recommend the storage seam with the trade-off named** (per-user server-side draft vs browser
storage, and what happens on a shared machine). **Say what you chose and why.**

## 7. A BACK BUTTON ON EVERY FLOW

⚠️ **A FLOW, not every page** — *"on pages, a back button for anything that is a flow like the
onboarding, orders, etc"*.

**Measured:** `Onboarding.tsx` has **eight** steps (`order · details · horse · shop · sign · payment ·
slots · done`) and **two** `Back` controls — one on the *done* screen pointing at the dashboard, one
inside the horse sub-flow. ⚠️ **From `sign` there is NO route back to the field holding the name**,
which is what makes §4 unsafe without this.

**`TASK-AR5` found 20+ hand-rolled back affordances and no shared component. ⚠️ Build ONE**, and
honour CR-53's *"top left area of the page"*.

## 8. OUT OF SCOPE

`TASK-FIX3` (nav) · the `anon` grant on `record_signature` *(owner ruling pending — see the ORCH6
handoff)* · restoring booking `f7881be9`'s instructor *(the owner's data pass)* · Madeline's
provisioning.

## 9. CONSTRAINTS

- **Worktree `wt-fix4`, branch `task/fix4`**, from `origin/main`. ⚠️ **Copy `.env.db` and `.env` in.**
- ⚠️ **`TASK-FIX3` owns `AppLayout.tsx` and `pageRegistry.ts`. You own forms, modals and
  `Onboarding.tsx`.** ⚠️ **Both touch `ContactDossierModal`'s neighbourhood — FIX3 must merge first.
  Rebase on it; do not run before it.**
- **Migrations:** `BEGIN; … ROLLBACK;` → apply → verify → commit.
- ⚠️ **A LIVE LEASE IS IN PRODUCTION** — do not touch `7adcd08f-fd5d-40f9-b726-634074266d7c`.
- **`test:db` red is the baseline and proves nothing.** Lint baseline **46**.
- ⚠️ **CSS values must be grepped out of the BUILT css** (T1).
- **COMMIT AS YOU GO. DO NOT PUSH.** ⚠️ **TEARDOWN: census pasted.**

## 10. THE TEST THIS MUST PASS

1. ⚠️ **Closing a modal with unsaved input does NOT commit** — paste the record before and after.
2. **The affirmative action DOES commit.**
3. **A backdrop click on an input-bearing modal does not close it; on an empty one it does.**
4. **Auto-save fires after input**, and the indicator shows it.
5. ⚠️ **A reload mid-form restores what was typed.** **Prove it in Chromium, not by reading code.**
6. **Browser-back likewise.**
7. `fiszer`→`Fiszer` · `labuzetta`→`Labuzetta` · **`LaBuzetta`→`LaBuzetta`** · `la buzetta`→`La Buzetta`.
8. ⚠️ **A person's correction is NOT re-normalised** — `La buzetta` survives a save.
9. **The browser signing gate is exact; `record_signature` still accepts `"brian olenik"`.**
10. **A back control exists on every onboarding step and reaches the name field from `sign`.**
11. **The 17 modals are converged** — paste the count using the shared component.
12. `typecheck` · `typecheck:api` · lint ≤46 · `npm run build`.
13. **Renders NOT VERIFIED by you** — numbered checklist for the owner.
