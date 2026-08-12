# TASK ADDITEM — the "Add New Item" editor is unusable; fix the mechanics before anything else

**Owner, 2026-08-12:**

> *"the implementation of the add new feature in contract authoring page doesnt work. here are
> the obvious visible failures: input text box is only activated when you click all the way to
> the left of it, it only accepts 1 character input at a time after which you need to click
> inside the box right next to the previous character, the insertable elements have no config
> surface, there is no way to specify where in a section the new item is inserted, insertion of
> the authored element doesnt show up in the contract after saving it. I have not tried the
> condition logic configuration yet. Also, clicking out of the modal closes it and it wipes the
> inputs, they dont appear when the modal is activated again. There is no way to access a draft
> of a new item, and likely no way to edit or remove items after adding them."*

**`TASK-ONEAUTHOR` called this component an asset — *"the thing that makes new document types
buildable without a developer."* It is, and it does not work.** The concept is right. The
editing surface is broken in ways that make the rest impossible to evaluate.

**Every symptom below was diagnosed in source and in production on 2026-08-12. Verify each
diagnosis before implementing it, and say in the report where I was wrong.**

---

# THE DIAGNOSIS

## S1 + S2 — one character at a time, and the box only responds at the far left

**These are two separate bugs that compound. Fix both.**

### S2's cause: three components are declared INSIDE the parent's render body

```
src/components/app/AddElementModal.tsx:438   function LineEditor({ line })
src/components/app/AddElementModal.tsx:471   function ChipView({ id })
src/components/app/AddElementModal.tsx:488   function ChipPopover({ e })
```

A component declared inside another component's body is **a new function identity on every
render**. React compares types by identity, sees a different type, and **unmounts the entire
subtree and mounts a fresh one.** Every keystroke destroys the `<input>` and creates a new one,
so focus is lost after exactly one character. That is the owner's symptom, precisely.

**Hoist all three to module scope** and pass what they need as props. **They currently close
over parent state** (`caret`, `updateLine`, `removeElement`, `openChip`, `setOpenChip`, …), so
this is not a cut-and-paste — the closures become an explicit prop contract. **That contract is
the work of this fix; get it right rather than threading a giant props bag.**

**⚠️ `caret.current` is a band-aid over this bug, not a feature.** A ref tracks the caret's
line/segment/offset and is restored after render. Someone hit the focus loss and worked around
the symptom instead of fixing the remount. **Once the components are hoisted, re-evaluate
whether the caret machinery is still needed** — if the input is no longer destroyed, most of it
should be unnecessary. **Do not keep it "just in case"**; leftover compensation for a fixed bug
is how the next reader gets misled.

### S1's cause: the input is 6 characters wide inside a full-width box

```jsx
// :442-445
<input key={`${line.id}-t${i}`} value={s.v}
  className="bg-transparent outline-none text-[13.5px] text-green-950 py-0.5"
  style={{ width: `${Math.max(6, s.v.length + 2)}ch` }} />
```

The input is sized to its own content. **Empty, it is 6ch wide**, sitting at the left edge of a
`min-h-[38px]` bordered container that spans the whole row. **Everything to the right of those
six characters is the container `div`, not the input** — clicking there hits nothing.

And because the width tracks `s.v.length`, after one character the input has moved and grown —
which is why the owner has to click *"right next to the previous character."* **S1 and S2
produce each other's symptoms.**

**Content-width inputs are the right idea** — they have to be, because text segments and chips
share a line. **The fix is the click target, not the sizing model.** Make the container route
clicks into the nearest text segment (and place the caret sensibly), or give the trailing
segment the remaining width. **State which you chose.**

## S3 — the config surface exists and is being closed out from under you

`ChipPopover` (`:488`) **is** the config surface: label (`:506`), placeholder (`:513`), required
(`:517`), and per-item labels for select/buttons (`:526-527`). It is not missing.

Two things stop it working:

1. It is one of the three remounted components (S2) — so its own inputs lose focus too.
2. **`:580` — the modal body carries `onClick={(e) => { e.stopPropagation(); setOpenChip(null); }}`.**
   Any click inside the modal closes the open chip popover. `:496` re-stops propagation on the
   popover itself, so **verify whether the popover survives a click on its own fields** — but
   the owner reports no usable config surface, so something in this chain fails. **Establish
   exactly what, and fix the mechanism rather than adding another `stopPropagation`.**

## S6 — clicking outside wipes everything

```jsx
// :578
<div className="fixed inset-0 … " onClick={onClose}>
```

Two defects in one line:

1. **`onClick` fires on mouse-UP.** Select text inside the modal, drag past its edge, release —
   the backdrop's handler runs and the modal closes. **Use a mousedown-target check** so a
   close only happens when the gesture *started* on the backdrop.
2. **All editor state is local `useState` in the modal**, so unmounting discards it — hence
   *"they dont appear when the modal is activated again."*

**Decide, and say which:** either lift the draft out so it survives a close, or make an
accidental close impossible and confirm before discarding real work. **Given S7 asks for drafts
anyway, the first is probably the answer — but a stray click must never silently destroy an
authored clause either way.**

## S5 — it saves. It does not reappear. The backend is NOT the problem.

**Verified in production 2026-08-12:** `add_contract_composition` persists **and** calls
`remerge_contract_from_clauses(p_document_id)` at its line 180, so `merged_body` is rebuilt
before the RPC returns.

**So the failure is on the client**: the page does not refetch, or refetches something stale, or
the new content lands in a section the owner is not looking at. `ContractPage` uses a `changeKey`
bump for exactly this kind of refresh — its own comment says *"Append-only surfaces … just bump
`changeKey`, which the drawers already watch."*

**Find out which, and prove the row landed in the database before you touch the UI.** If the
insert is correct and the render is stale, this is a refresh bug, not a save bug — do not
"fix" the save path.

## S4 — position control is partial

Section-level position exists (`:617-631`, *"before <heading>"*) and header-level position exists
(`:667`, *"Before <n> <words>"*). **What the owner reports missing is position WITHIN a
section** — where the new item lands among the lines already there.

**Establish exactly which levels have a control and which do not**, then add the missing one.
`contract_clause_defs` already carries an ordering column that `remerge_contract_from_clauses`
respects — **use it; do not invent a second ordering concept.**

## S8 — removal exists in the database and has no UI

```
remove_contract_composition   EXISTS in production
removeContractComposition     EXISTS in src/lib/contracts.ts:853
callers in src/                ZERO
```

Its own doc comment: *"Remove an authored item. A header takes its lines and elements with it; a
section takes everything the author added to it."* **The capability is built and unreachable.**
Wire it up.

**⚠️ Removal must respect the standing rules.** A composition on an **EXECUTED** document is part
of a signed instrument — **61 executed documents are evidence and are never rewritten.** Confirm
what `remove_contract_composition` does about document state before exposing a button, and **if
it does not refuse on executed/void/terminated documents, report that and gate the UI** rather
than relying on the RPC.

## S7 — drafts

Nothing persists. Falls out of S6: once the draft survives a close, "access a draft" is mostly a
matter of surfacing it. **Do not build a draft store before S6 is decided** — the answer to S6
determines what a draft even is.

## Not yet tried by the owner: condition logic

> *"I have not tried the condition logic configuration yet."*

**Exercise it and report what you find. Do not redesign it in this task.** If it is broken too,
that is a separate spec — this task is already large.

---

# ORDER OF WORK — this matters

**1. S2 (hoist the components) → 2. S1 (click target) → 3. S6 (close behaviour).**

**Nothing else can be assessed until typing works.** Every remaining symptom was observed
through a broken editor, and at least one of them may dissolve once the remount stops. **After
those three land, re-test S3, S4, S5 and S8 and report which ones survived** — then fix what
remains.

**Do not fix these in parallel or in a different order.** The owner's list is a list of
observations, not a work breakdown.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-additem`, branch `task/additem`, off `origin/main`.
  **Never `~/Desktop`.** Do not push.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE** — minimal diff plus orchestrator approval. You
  own `AddElementModal.tsx`; you probably need nothing in the renderer.
- **`AppLayout.tsx`** may be contended (`TASK-PAGEVIS`, `TASK-REVIEWNAV`). Do not edit it.
- **THE SIGNING FREEZE IS IN FORCE.** Nothing here lifts it.
- **61 EXECUTED documents are evidence and are never rewritten.**
- **Sarah's `704c8d2d…` is a SAMPLE under review**, not a live negotiation — safe to exercise
  against. **Do not test against an executed document.**
- **Delete nothing.**
- **Keep the concept whole.** ONEAUTHOR is right that this component is an asset. **This is a
  repair, not a redesign** — do not replace the chips-in-prose model with a form.
- **T1 — arbitrary Tailwind values have silently emitted no rule at all here twice.** Grep
  anything you add out of the built CSS.
- No staff browser session exists and you will not be given one. **This is a task about
  interaction, so say so loudly**: prove what can be proven — the component tree, that a hoisted
  component keeps identity across renders, the RPC's effect in the database — and report every
  interaction claim as **NOT VERIFIED**, with a numbered checklist the owner can run in the
  order above.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. Typing a sentence into a line keeps focus for the whole sentence.
2. Clicking anywhere in the line box puts the caret in the text.
3. A chip's config surface opens, accepts input, and stays open while being edited.
4. Clicking the backdrop cannot silently destroy authored work.
5. A saved item appears in the contract without a manual reload — and the database row is shown
   to have existed before the UI was touched.
6. Position within a section is selectable, using the existing ordering column.
7. An authored item can be removed from the UI, and **cannot** be removed from an executed
   document.
8. The condition-logic configuration has been exercised, and its state is reported.

Report to `docs/reports/TASK-ADDITEM-REPORT.md`.
