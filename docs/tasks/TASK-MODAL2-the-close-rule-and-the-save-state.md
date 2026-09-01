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

## 3. 🔒 THE FOUR DELTAS

### D1 · ⚠️ ESCAPE MUST NOT CLOSE AN INPUT-BEARING DIALOG
**Today `Modal.tsx:152` closes on Escape, unconditionally.** The owner: *"the close button/icon is the
only way to close it once they engage with it."*
**Escape must obey the SAME live-DOM test the backdrop already obeys** — no field, Escape closes; a
field present, Escape does nothing. ⚠️ **One rule, one code path, asked once.** *(An earlier thread
kept Escape open on a11y grounds. That was a deviation from an instruction, not a decision to make —
the a11y concern is answered by the close control always being present and focusable, which FIX4
already guarantees on every dialog, titled or not.)*

### D2 · ⚠️ A SYSTEM-TRIGGERED DIALOG IS HARDER TO CLOSE THAN A USER-TRIGGERED ONE
**The component cannot currently tell who opened it, and that is the gap.**
- **User-triggered + information only** → click-out closes. *(Today's behaviour, correct.)*
- ⚠️ **System-triggered** *(it appeared on its own — an alert, a notice, a prompt the person did not
  ask for)* → **click-out must NOT close it. The close control does.**
  **The owner's reason is the spec: *"the user cannot simply reopen it if they accidentally close
  it."***
- **Add an explicit `trigger: 'user' | 'system'` input.** ⚠️ **Choose the DEFAULT so that forgetting
  it is safe** — and say in the report which you chose and why.
- ⚠️ **INVENTORY EVERY DIALOG THAT OPENS WITHOUT A CLICK** and set it. **A default nobody applies is
  the same as no feature** — this repo's dominant failure mode is correct code nothing reaches.

### D3 · ⚠️ THE SAVE STATE MOVES TO THE HEADER, BESIDE THE CLOSE ICON
**Today it renders in the FOOTER bar (`Modal.tsx:270`).** The owner: *"save state is always shown up
next to the close button/icon."* **Move it beside the header Close control (`Modal.tsx:239`).**
- **Green checkmark + the word `Saved`** — ⚠️ **light green.** Today it is `text-green-700`; pick the
  lighter token this design system already uses and **grep it out of the BUILT css** (T1 — arbitrary
  values have silently emitted nothing here twice).
- ⚠️ **`Saved`, not `Saved to the record`.** The dossier passes a custom `savedLabel`; the owner named
  the word. **One word, everywhere.**
- **Persistent while true**, clearing when unsaved input is entered. *(Already the behaviour — pin it
  with a test rather than rebuilding it.)*
- ⚠️ **`saving` and `error` states keep their current wording and stay honest.** *"Not saved — your
  input is still here"* is doing real work.

### D4 · ⚠️ AUTO-SAVE FIRES ON FIELD EXIT, NOT ONLY ON A DEBOUNCE
*"auto save along with each input field being clicked out of is the spec."*
**Blur must flush the pending write** — normalise, then save, then the indicator turns true — rather
than leaving the person to wait out a timer. ⚠️ **The debounce stays for mid-typing safety; blur is an
additional, immediate flush.** **Prove both: a blur saves at once, and typing without blurring still
saves.**

---

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

1. ⚠️ **Escape does NOT close a dialog holding a field; it DOES close one with none.** Both asserted.
2. **The backdrop rule is unchanged** — FIX4's seven assertions still pass.
3. ⚠️ **A system-triggered information dialog does not close on click-out; a user-triggered one does.**
4. ⚠️ **The inventory from D2, pasted** — every dialog that opens without a click, and what you set it
   to. **A dialog you could not classify is a finding, not a silent default.**
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
