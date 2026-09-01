# TASK-MODAL2 — the close rule, the trigger source, and where the save state sits

**Authored 2026-08-31 by ORCH6. Builds `CR-93` — the owner's corrections to what `TASK-FIX4` shipped
hours earlier.** ⚠️ **Small, surgical, and it lands in a component every dialog in the app now
renders. Read `src/components/ops/kit/Modal.tsx` end to end before changing a line.**

⚠️ **THIS IS NOT A REDESIGN.** FIX4's convergence is correct and stays: 26 hand-rolled overlays became
one shared `Modal`, and backdrop-close is decided from the live DOM. **Four specific deltas, below.**

---

## 1. THE REQUIREMENT, VERBATIM

> *"The request is that a modal cannot be accidentally closed by clicking ouside of it when there is
> content inside of it that the user input or selected. the close button/icon is the only way to close
> it once they engage with it. information only modals should close if they are user triggered but if
> they are not user triggered and they are system triggered they should be harder to close to prevent
> accidental closure since the user cannot simply reopen it if they accidentally close it. auto save
> is good, auto save along with each input field being clicked out of is the spec, for normalizing
> fields we auto save after the normalization and the normalization runs after the user clicks out of
> the input field. save state is always shown up next to the close button/icon as a green checkmark
> with the word saved in green (light green) persistent until inputs that arent saved are entered.
> shown when the state is true."* — owner, 2026-08-31

---

## 2. WHAT IS ALREADY TRUE — measured on `main`, 2026-08-31, by ORCH6. Do not rebuild these

| ✅ | Where |
|---|---|
| **Backdrop click cannot close a dialog holding a field** — decided from the **live DOM** at click time, so no call site can forget a flag, and a dialog whose fields appear on step 2 is protected on step 2 | `Modal.tsx:196-215` |
| **A drag that starts inside and ends on the backdrop is not a backdrop click** | `Modal.tsx:145` |
| **An information dialog with no field DOES close on click-out** | same |
| **Normalisation runs on blur, then the normalised value is auto-saved — that order** | `src/lib/normalize.ts`, `formState.ts` |
| **A deliberate correction is never re-normalised** | `normalizeOnBlur`'s memory of its own last output |
| **The indicator reports the truth**, including a refused write | `AutoSaveIndicator.tsx` |
| **Closing never commits, and never discards** | D34 |

⚠️ **FIX4's backdrop rule is STRICTER than the request** — it protects a dialog with an *empty* field,
not only one already typed into. **That is deliberate and it stays:** "has the user engaged yet" is a
judgement a component would get wrong, and being wrong loses their work.

---

## 3. 🔒 THE FIVE DELTAS — ⚠️ REWRITTEN 2026-08-31 AFTER THE OWNER SIMPLIFIED THE RULE

> *"just make all modals only close on click of button or link, dont let them close on click-out since
> you cant determine which ones the user can reopen and which ones they cant."*
> *"the side drawer i specd as eliminated. center modal is the only version to use."*
> *"the back control should apply to saving state on all things any user inputs, not just the
> onboarding flow steps."*

### D1 · ⚠️ NO MODAL CLOSES ON CLICK-OUT. NO MODAL CLOSES ON ESCAPE. EVER.
**A control — a button or a link — is the only way out of any modal, whether it holds a field or not.**
⚠️ **This REPLACES the live-DOM field test and both escape hatches.** `allowBackdropClose` and
`disableBackdropClose` **both go**: there is nothing left for them to express.
⚠️ **The owner's reasoning is the spec and it settles the question a component cannot answer from
inside: you cannot tell whether the person can reopen what they just dismissed.**
**Every dialog must therefore have a visible, reachable close control** — FIX4 already guarantees one
on every modal, titled or not. ⚠️ **Verify that is still true of all 37 after your change; a modal with
no control is now a trap with no exit.**

### D2 · ⚠️ ONE VARIANT. THE DRAWER AND THE SHEET ARE ELIMINATED.
**Measured on `main`: `variant="drawer"` at 4 call sites** *(`CalendarPage` ×3, `TeamPage`,
`CalendarSettingsPanel`, `CalendarItemPanel`)* **and `variant="sheet"` at 8** *(`HorseRecordsPage`,
`EvaluationsPage`, `DocumentQueuePicker`, `StableSection`, `StableEditors`, `EmailChangeModal`,
`CreateModal`, `ClientRecordActions`)*.
🔒 **All become the centre modal. Remove the `variant` prop entirely** — a prop with one legal value is
a prop nobody needs. ⚠️ **FIX4's report defends the three shapes; that defence is superseded by the
owner's ruling. Do not re-argue it.**
⚠️ **The four calendar panels are the ones most likely to look wrong as boxes** — they were built full
height. **Report how they read; do not re-introduce a variant to fix it.**

### D3 · ⚠️ THE SAVE STATE MOVES TO THE HEADER, BESIDE THE CLOSE ICON
**Today it renders in the FOOTER bar (`Modal.tsx:270`); the close control is at `Modal.tsx:239`.**
**Green checkmark + the word `Saved`, LIGHT green** *(today `text-green-700`; pick the lighter token
this system already uses and ⚠️ **grep it out of the BUILT css** — T1)*. ⚠️ **`Saved`, not `Saved to
the record`** — the dossier passes a custom label and the owner named the word. **Persistent while
true, clearing when unsaved input is entered** *(already the behaviour — pin it with a test)*.
**`saving` and `error` keep their current honest wording.**

### D4 · ⚠️ AUTO-SAVE AND NORMALISATION BOTH RUN ON FIELD EXIT
> *"the auto save and normalize functions are supposed to run when the user clicks out of the field
> they entered the input into."*

**Blur normalises, then saves, immediately** — the person does not wait out a timer. **The debounce
stays as mid-typing insurance.** ⚠️ **Prove both: a blur saves at once, and typing without blurring
still saves.**
🔒 **AND THE ENTRY RULE IS UNCHANGED AND ABSOLUTE:** *"a save or submit or confirm button is the only
way something is entered as an entry, closing doesnt submit."* **(D34.)**

### D5 · ⚠️ THE BACK CONTROL IS NOT AN ONBOARDING FEATURE — THE SWEEP IS NOW IN SCOPE
**`TASK-FIX4` built `BackControl.tsx` and deliberately did NOT sweep the ~18 remaining hand-rolled
back affordances** *(AR5 found 20+ instances and no shared component)*. **The owner has now ruled it
applies to *"all things any user inputs."***
- **Inventory every hand-rolled back affordance**, and **convert each one that sits on a surface where
  a person enters input.** ⚠️ **Paste the inventory with a verdict per row** — converted, or left with
  a one-line reason.
- ⚠️ **The back control must not lose input.** Going back is a navigation, not a discard: the draft
  survives, exactly as it does on the onboarding steps FIX4 already did.

## 4. ⚠️ THE TRAPS

- ⚠️ **`ops/kit/Modal.tsx` IS NOW RENDERED BY 37 FILES.** A regression here is 37 surfaces wide.
  **Every change is a rule in one place; no per-call-site special cases.**
- ⚠️ **`ContactDossierModal` is the ONE deliberate non-adopter** — a tab-railed record surface, not a
  box around a form. **It obeys the RULES, not the markup.** ⚠️ **All four deltas apply to it too, by
  hand.** *(Its indicator must move; its `savedLabel` must become `Saved`.)*
- ⚠️ **Do NOT reintroduce a Save button.** The component deliberately offers no way to render one
  (D34).
- ⚠️ **Do NOT make closing commit or discard** (D34). **Three behaviours have already shipped in this
  area; the owner has lived through two defects here.**
- **T1 — arbitrary Tailwind values.** Grep any new class out of `dist/assets/*.css` and paste it.
- **Lint baseline 46** · typecheck 0 · typecheck:api 0 · `test:db` red is baseline and proves nothing.
- ⚠️ **FIX4's tests are the guard rail, not an obstacle** — `fix4_close_does_not_commit.test.tsx` and
  `fix4_modal_three_way_rule.test.tsx`. **If one must change, the change is a RULE change and the file
  says so in a comment**, exactly as FIX4 did when it inverted a superseded assertion.

## 5. OUT OF SCOPE

The modal convergence itself *(done)* · the draft storage seam *(`localStorage`, per user — ruled,
and the `/sign/*` case makes it non-negotiable)* · the normalisation rules *(`van der Berg` included —
the rule working as specified)* · the back-control sweep · anything outside `ops/kit/Modal.tsx`,
`AutoSaveIndicator.tsx`, `formState.ts`, `ContactDossierModal.tsx` and the call sites D2's inventory
turns up.

## 6. CONSTRAINTS

- **Worktree `~/Downloads/claude-code-repo/wt-modal2`, branch `task/modal2`, from `origin/main`.**
  ⚠️ **Copy `.env.db` AND `.env` in.** ⚠️ **NEVER `~/Desktop`.**
- ⚠️ **YOU OWN `ops/kit/Modal.tsx`, `AutoSaveIndicator.tsx`, `formState.ts`.** Nothing else may.
  **`TASK-CR85` owns the nav; `TASK-BOOKS1` owns the money functions; `TASK-FIX6` owns the dashboards.**
- **COMMIT AS YOU GO. DO NOT PUSH.** **Stage explicit paths.** ⚠️ **TEARDOWN: paste a process census.**

## 7. THE TEST THIS MUST PASS

1. ⚠️ **NO modal closes on click-out or Escape** — asserted on a dialog WITH a field and one WITHOUT.
   **FIX4's assertions that a fieldless dialog closes on the backdrop are INVERTED, with the rule
   change named in the file**, exactly as FIX4 did when it superseded an older assertion.
2. ⚠️ **Every one of the 37 dialogs has a visible close control.** Paste the list — a modal without
   one is now unexitable.
3. ⚠️ **`variant` is gone**, and all 12 former drawer/sheet call sites render the centre modal.
4. ⚠️ **The D5 inventory, pasted, with a verdict per row.**
5. **The save state renders in the header, beside Close**, reads **`Saved`**, and is light green.
   ⚠️ **Paste the built-CSS grep.**
6. **Clicking out of a field saves immediately** — no waiting on the debounce — **and the indicator
   turns true.**
7. **Normalisation still runs on blur BEFORE the save**, and a deliberate correction still survives.
8. **Closing still writes nothing, and the record still saves.** ⚠️ **Both halves** — a test asserting
   only the first passes on a dialog that loses everything.
9. `typecheck` · `typecheck:api` · **lint ≤ 46** · `npm run build`.
10. ⚠️ **Renders NOT VERIFIED by you** — a numbered checklist, **naming the phone explicitly**.

## 8. WHERE THE REPORT GOES

`docs/reports/TASK-MODAL2-REPORT.md`. **Include "flagged, not fixed."**
