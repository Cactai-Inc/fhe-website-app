# TASK ADDITEM — report

**Branch** `task/additem` (worktree `~/Downloads/claude-code-repo/wt-additem`), off `origin/main`
`d7ec6a5`. Not pushed.

**Applied to production:** one migration,
`supabase/migrations/20260812T1200_additem_line_position.sql` — dry-run in `BEGIN … ROLLBACK`
first, applied, verified. **No production data was written or changed.** `contract_fields`
still holds **zero** author-added rows, before and after.

---

## THE HEADLINE — no composition has ever landed in production

Before touching anything, per the instruction to *"prove the row landed in the database before
you touch the UI"*:

```
select document_id, custom_kind, count(*) from contract_fields
 where custom_kind is not null group by 1,2;
→ (0 rows)

select count(*) from contract_fields where field_key like 'CUSTOM.%';
→ 0
```

**Not one authored item, of any kind, has ever been saved.** So S5 is not "it saves and does not
reappear" — nothing has ever saved. See S5 below for what stopped it, which is not what the
diagnosis expected.

---

## WHERE THE DIAGNOSIS WAS WRONG

Four corrections. Everything else in the task doc was right, and S2 in particular was exactly
right, down to the mechanism.

**1. `caret.current` is not a band-aid, and nothing was "restored after render."**
The task says *"A ref tracks the caret's line/segment/offset and is restored after render.
Someone hit the focus loss and worked around the symptom."* There is no restore pass — there
never was. The ref had five uses ([AddElementModal.tsx:190,218,446,447,448](../../src/components/app/AddElementModal.tsx) on main) and every one
of them is write-or-read-for-insertion. It exists because **the chip toolbar lives outside the
inputs**: pressing `[Dropdown]` blurs whatever you were typing in, so without a record of where
the caret was, the editor cannot know which sentence — or where in it — the chip belongs to.
That is a feature of the chips-in-prose model, not compensation for the remount.
**Kept, renamed `insertAt`, and documented as what it is.** It is now fed by one handler
(`onSelect`) instead of three overlapping ones, and it advances past the chip it just placed so a
second chip does not land back in the first half of the split segment.

**2. The chip popover was NOT being closed by clicks on its own fields.**
S3 asks to *"verify whether the popover survives a click on its own fields."* It did. The
popover's `onClick={(ev) => ev.stopPropagation()}` sat on a React child of the modal body, and
React's synthetic `stopPropagation` does stop the parent's synthetic handler — so the catch-all
at `:580` never fired for clicks inside the popover. **What made the config surface unusable was
S2**: the popover is one of the three remounted components, so its Name field was destroyed after
every character, exactly like the line input. The catch-all was still the wrong mechanism and is
gone; the surface itself was never missing.

**3. "The ordering column `contract_clause_defs` already carries" is not the column in play.**
For author-added content the ordering column is **`contract_fields.sort_order`** — on the `header`
row for an item's place in its section, and on each `line` row for its place within the item.
`contract_clause_defs.sort_order` only supplies the *template's* side of the comparison
(`sort_order * 1000`) inside `remerge_contract_from_clauses`, and no client writes it. The fix
uses `contract_fields.sort_order`, which is the same single ordering concept the composer and
`ClauseDocument` already read.

**4. S4 is not only a missing control — the existing behaviour is actively broken.**
`add_contract_composition` numbered its lines 10, 20, 30 … **from scratch on every call**, so a
second addition to the same header wrote the same `sort_orders` as the first and
`remerge_contract_from_clauses` had nothing to break the tie. Proven in production (rolled back):

```
first  composition: "line A", "line B"    → sort_order 10, 20
second composition: "line C", "line D"    → sort_order 10, 20
composed:  Second C / First A / Second D / First B
```

Interleaved, in neither authoring order. Appending was already broken before anyone asked for a
position control.

---

## WHAT WAS DONE, IN THE ORDER THE TASK REQUIRED

### 1. S2 — the three components are at module scope

`LineEditor`, `ChipView` and `ChipPopover` are now module-scope declarations. The prop contract,
rather than a props bag:

* `LineEditor({ line, chips, focusReq, onFocusDone, onChange, onCaret })` — the line's data, the
  chip API, the one-shot caret request, and two callbacks.
* `ChipView({ id, chips })`, `ChipPopover({ e, chips })`.
* `chips` is a **`ChipApi`**: `{ els, openChip, setOpenChip, patchEl, removeEl, addOtherDetails }`
  — the element registry plus the operations on it. That is one coherent domain object (every
  chip needs all of it, and these three components are its only readers), not a bag of unrelated
  props threaded through.
* `normalise`, `KIND_ICON` and the line controls also moved out; `lineControls` became a
  `LineControls` component.

**Proof, `test/ui/additem_add_element_modal.test.tsx`:** the assertion is **DOM node identity** —
the same `<input>` object must still be in the document, and still be `document.activeElement`,
after `"The Lessee shall provide 48 hours notice."` has been typed into it. A class-name or value
assertion would pass on the broken version too, because the replacement input carries the same
classes and (for the first character) the same value.

### 2. S1 — the click target

**Chosen: give the trailing segment the remaining width**, with the container-click route as the
remainder. Both, because they cover different gestures and neither is sufficient alone:

* The **last** text segment is `flex: 1 1 auto` with `width` as its basis (so it is never narrower
  than its own text) and `maxWidth: 100%` (so a long segment stays inside the box). It fills the
  rest of the row, so clicking anywhere in the empty space hits the input and the **browser**
  places the caret at the click point — no synthetic caret arithmetic.
* Interior segments stay content-sized. They have to: text segments and chips share one line, and
  a greedy interior segment would push every chip off the row.
* A `mousedown` whose target is the **container itself** (the gap under a wrapped row, the padding
  beside a chip) focuses the trailing segment with the caret at its end. Guarded on
  `ev.target === ev.currentTarget`, so it never steals a click aimed at an input or a chip.
* The box gets `cursor-text`, so it reads as typeable before you click it.

### 3. S6 — closing cannot destroy work

Both halves, as the task requires:

* **Mousedown-target check.** The backdrop records, on `mousedown`, whether the gesture started on
  it; `onClick` only closes if it did. Selecting text inside the modal and releasing outside no
  longer closes it.
* **The draft is lifted out.** Chosen over "make an accidental close impossible", because S7 asks
  for drafts anyway and because a confirm dialog on every close is a tax on the common case. The
  editor state — mode, both rows' selections, the line stack and the element registry — is
  persisted to `localStorage` under `fhe.additem.draft.<documentId>` on every change, restored
  when the modal reopens, and cleared when the item is added or the author presses **Discard
  draft**. An *untouched* editor writes nothing, so opening the modal and closing it leaves no
  litter. Restored element ids advance the module id counter, so a newly minted element can never
  collide with a restored one.
* Escape now closes — the open chip popover first, then the modal.
* The footer button is **Close**, not Cancel, and says `Closing keeps your draft — it reopens
  where you left off.`

### 4. S3 — the chip config surface

The modal body's `onClick={(e) => { e.stopPropagation(); setOpenChip(null); }}` is **deleted**,
and with it the popover's defensive `stopPropagation`. Dismissal now belongs to the popover: a
`mousedown` outside the popover and outside the chip that owns it closes it. Mousedown, not click,
for the same reason as S6 — releasing a drag-selection outside the box must not count.
That is the mechanism, not another `stopPropagation`.

### 5. S5 — the state gate, which is the real save failure

`add_contract_composition` accepts only `workflow_state IN ('editable','editing')`.
`ContractPage` gated the **Add item** button on `editablePhase`, which **includes `in_review`**.

The two live lease documents are both `in_review`
(`704c8d2d…` — Sarah's sample — and `e1052bae…`). Proven in production (rolled back):

```
ADD ON in_review SAMPLE refused: document is not editable
ADD ON EXECUTED       refused: document is not editable
REMOVE ON EXECUTED    refused: document is not editable
```

So on the documents the owner had, the button was live and the save threw. The error rendered
`role="alert"` at the **top** of a modal that scrolls, while the submit button that produced it is
at the **bottom** — press it, nothing visible happens. That is *"insertion of the authored element
doesnt show up in the contract after saving it"*, and it matches zero authored rows in production.

**The gate is not a bug in the RPC.** It is consistent across the whole structural family —
`add_contract_composition`, `remove_contract_composition`, `add_contract_element`,
`propose_clause`, `set_field_included` all require `editable | editing`, while
`set_contract_field` allows `in_review`. Reading it plainly: **once a document is in review with
the counterparty you may answer it, not restructure it.** That is a defensible rule, so the client
was changed to match the server rather than the other way round. **Flagged for a ruling below.**

Two changes:

* `ContractPage` gains `structuralPhase = editable | editing` and passes
  `disabled={!structuralPhase}` plus a `disabledReason`. The button stays **visible** while the
  document is in review and explains itself on hover — a control that vanishes teaches nothing,
  and this one used to fail silently.
* The error moved to **directly above the footer buttons** and scrolls itself into view.

**The refresh path was already correct** and was not touched: `onAdded` → `act()` →
`load({ blank: false })` → `contract_document_detail`, which returns `custom_kind` and `body`;
`ClauseDocument` folds authored rows into the same ordered item list as template clauses
([ClauseDocument.tsx:698-800](../../src/components/app/ClauseDocument.tsx)). Nothing in the save
path was "fixed".

### 6. S4 — position within a section

**Which levels had a control, established:**

| level | before | after |
| --- | --- | --- |
| new **section**'s number among sections | ✅ `section_position` | unchanged |
| new **header**'s position among a section's headers | ✅ `header.position` | unchanged |
| new **lines**' position within the chosen item | ❌ none, *and colliding* | ✅ `header.line_position` |
| lines relative to a template item's own drafted prose | always after | unchanged (stated in the UI) |

`header.line_position` (1-based among the lines already authored under that header; null or out of
range = after all of them) splices the new lines into the header's existing run, and the whole run
is **renumbered 10, 20, 30 …** as one ordered list. Existing lines keep their relative order.
Renumbering rather than midpointing is deliberate: `sort_order` is an `int` and a 10-step gap
exhausts after four insertions.

Same column, same ordering concept `remerge_contract_from_clauses` and `ClauseDocument` already
read. Row 2 of the modal grows a **"Where in that item"** select listing the existing lines by
snippet, shown only when the chosen item actually has authored lines to sit among.

### 7. S8 — removal is wired up

`remove_contract_composition` had zero callers. The modal now carries **"Items you have added to
this contract"**, built from the `fields` prop and grouped the way the document reads: section →
header → lines, plus a separate group for lines added under a *template* item (which have no
authored header row of their own). Remove is offered on a section, a header and a single line —
**not** on an inline element, because the RPC's `ELSE` branch deletes just that row and would
leave a dangling `{{CUSTOM.…}}` token in a line's prose.

Every remove is two-step: the first press swaps the trash icon for the consequence in words
(*"Removes this item, its lines and its questions."*) and a **Remove / Keep** pair.

**On the standing rule:** `remove_contract_composition` **does** refuse a non-editable document —
verified in production against the executed `a353eab0…` (`document is not editable`). The 61
executed documents cannot be rewritten through it. The UI is gated too, and more tightly: the
modal only opens at all when `structuralPhase` holds, so the button is never rendered on an
executed, void, terminated, locked *or in-review* document.

### 8. Condition logic — exercised, not redesigned

Exercised end to end against production (rolled back), on the editable test lease `215bac09…`:

* a **select** driver with `equals`, and a **buttons** driver with `contains`, both written by the
  modal's own gate-building code;
* `@localId` references resolved to the minted `CUSTOM.*` keys **in the prose tokens and inside the
  gate JSON** — `{"equals": ["LESSEE"], "field_key": "CUSTOM.TRAILERING_ARRANGED_BY_2"}`;
* the gold caption stored on the line's `guidance`;
* with nothing answered, both gated lines are **absent** from the composed body; answering
  `LESSEE` + `SHOWS,TRAILS` brings both in, with values resolved to their **labels**
  (`"Permitted destinations are Shows, Trails."`); flipping the select to `LESSOR` drops the fuel
  line and keeps the shows line.

**It works.** Not redesigned, as instructed. One cosmetic wrinkle noted below.

---

## VERIFICATION

**Proven, and re-provable by anyone:**

* `npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 39 warnings, **identical count before
  and after** the diff (the repo's baseline has drifted from CLAUDE.md's "~26"). `npm run build` —
  clean.
* **T1** — every class the modal uses was grepped **out of the built CSS**, including the arbitrary
  ones: `cursor-text`, `w-1.5`, `h-1.5`, `bg-gold-500`, `shrink-0`, `min-h-[38px]`, `text-[13.5px]`,
  `text-[13px]`, `text-[12px]`, `text-[11px]`, `z-[60]`, `max-h-[88vh]`, `max-w-[16rem]`, `w-72`,
  `overscroll-contain`. All present. No new arbitrary value was introduced — the two new sizing
  rules are inline `style`, not Tailwind.
* **`test/ui/additem_add_element_modal.test.tsx` — 16 tests, all passing.** They discriminate:
  swapped against `origin/main`'s component, **14 of 16 fail**. (The two that pass either way are
  "a click that starts and ends on the backdrop closes it" — true of the old code too — and "an
  untouched editor leaves no draft behind", trivially true when there is no draft store.)
* **`test/db/additem_line_position.test.ts` — 8 tests, all passing**, on PGlite. The committed
  snapshot is dated 2026-08-03, the day *before* the add-item feature, so it has no `custom_kind`
  and no composition RPCs; the test applies `20260804120000_add_item_composition.sql` first, then
  the new migration **twice** (the second pass is the replay-safety proof). Without the new
  migration, **5 of 8 fail** — including the interleaving one.
* Whole `test/ui` suite: 98 passed, 1 failed — `wallreturn_applayout` "defaults to the destination
  menu", **failing identically on `origin/main`**. Pre-existing, untouched by this work.
* `npm run test:db` is **nondeterministic on this machine**: three consecutive runs of the
  *identical* tree gave 20, 25 and 6 failures. No DB test references
  `add_contract_composition` / `remove_contract_composition` / `custom_kind` at all, and the
  default harness path loads the snapshot rather than replaying migrations, so a new migration file
  cannot reach it. The suite's variance is pre-existing and unrelated.

**NOT VERIFIED — every interaction claim.** There is no staff browser session and I was not given
one. jsdom has no layout engine, so anything geometric is asserted on the style contract, not on
measured pixels. The checklist below is what a human has to run, **in this order**.

---

## THE OWNER'S CHECKLIST — run in this order

Use the **editable** test lease `215bac09-9f66-43ce-8655-85fd05fea1e2` (LESSOR = `cjzigs@icloud.com`,
a D1 test identity). **Sarah's `704c8d2d…` is `in_review`, so step 0 is what you will see there.**

0. **The button now explains itself.** Open `704c8d2d…` (in review). *Add item* is present but
   **greyed**; hover it → *"This document is in review. Reopen it for editing to add or remove
   items."* Previously it was live here and the save failed with the error off-screen.
1. **Typing.** Open `215bac09…` → *Add item*. Click once in the line box and type a whole
   sentence. **Expected:** every character lands, focus never leaves, no clicking between letters.
2. **The click target.** Click in the **far right** of an empty line box, and in the space **below
   a wrapped line**. **Expected:** the caret goes into the text both times.
3. **The chip config surface.** Press *Dropdown*. The popover opens on the new chip. Rename it,
   add two menu items, rename one. **Expected:** the popover stays open throughout and every field
   accepts full words. Then click anywhere else in the modal — **expected:** it closes (that is
   correct outside-click dismissal, not the old bug).
4. **The backdrop.** With text in a line, select some of it and drag the mouse **past the modal
   edge** before releasing. **Expected:** the modal stays open. Then click the dark backdrop
   cleanly — **expected:** it closes. Reopen *Add item* — **expected:** *"Picked up where you left
   off"* and your text is back. There is a **gold dot** on the *Add item* button while a draft
   exists.
5. **Saving, and the row.** Fill Row 1 (section) and Row 2 (name a new header), write a line, press
   **Add to the contract**. **Expected:** the item appears in the contract with no manual reload,
   and *Added this session* lists it. Then prove the row first:
   ```sql
   select field_key, custom_kind, clause_key, sort_order, body
     from contract_fields
    where document_id = '215bac09-9f66-43ce-8655-85fd05fea1e2'
      and custom_kind is not null
    order by custom_kind, sort_order;
   ```
6. **Position within the item.** Reopen *Add item*, choose that same header in Row 2. **Expected:**
   a **"Where in that item"** select appears listing the line you just wrote. Choose *Before "…"*,
   write a second line, save. **Expected:** the new line reads **above** the first.
7. **Removal.** In the same modal, scroll to **Items you have added to this contract**. Press the
   trash on the header. **Expected:** a sentence saying what will go, plus **Remove / Keep**.
   Press *Remove* — **expected:** the item and its lines disappear from the contract.
   Then open any executed document — **expected:** no *Add item* button at all.
8. **Condition logic.** Place a *Dropdown* in a line, give it two options, press *Add a condition*,
   choose that dropdown as the question and one option as the answer, write a line inside the
   condition, save. On the contract, choose that option in the dropdown — **expected:** the gated
   line appears with its gold caption; choose the other — **expected:** it disappears.

---

## FLAGGED, NOT FIXED

1. **Should structural authoring be allowed during `in_review`? — owner ruling needed.**
   This is the one design question the repair raises. Today: fields yes, structure no, and the
   client now matches. But both live leases are `in_review`, so **as shipped, the owner cannot
   exercise Add item on either of them** without reopening one for editing (the "Unlock to edit"
   path). If the answer is "review is exactly when I add a clause", the fix is to widen five RPCs
   (`add_contract_composition`, `remove_contract_composition`, `add_contract_element`,
   `propose_clause`, `set_field_included`) to `in_review` — one migration, and I would rather be
   told than guess. `propose_clause` refusing `in_review` looks the most questionable of the five:
   proposing a clause is a review activity by definition.
2. **`anon` holds EXECUTE on `add_contract_composition`, `remove_contract_composition` and
   `add_contract_element`; the last also still grants `PUBLIC`.** Pre-existing — direct grants
   survive `REVOKE … FROM PUBLIC`, and my migration re-asserts only the intended
   `authenticated, service_role`. Not exploitable: every one of them raises
   `authentication required` when `auth.uid()` is null. Reported rather than changed, because
   revoking grants is a security-surface decision that deserves its own pass (`SECFIX` territory).
3. **`remove_contract_composition` on an `element` leaves a dangling token.** Deleting an element
   row leaves `{{CUSTOM.NAME_3}}` in the prose of any line that placed it, which then composes as
   the literal token (or `N/A` after execution). The UI does not offer element removal for exactly
   this reason. A proper fix strips the token from every referencing line body inside the RPC.
4. **A line whose only token is unanswered composes as a bare sentence with a full stop** —
   `"Off-site transport is arranged by."`. Pre-existing behaviour of
   `remerge_contract_from_clauses` for every clause, not specific to authored content, and it does
   not affect the editor (where the token renders as a live control). Noted because it shows up
   immediately when you exercise the feature.
5. **The draft is per browser, not per account.** `localStorage`, keyed by document id. Two staff
   on the same document keep independent drafts and neither sees the other's; clearing site data
   loses it. That is the right size for "don't lose my work to a stray click", but it is not a
   shared server-side draft, and if the owner wants one that is a separate spec.
6. **One pre-existing UI test fails on `origin/main` and still fails** —
   `test/ui/wallreturn_applayout.test.tsx`, "defaults to the destination menu". Not mine, not
   touched.

## FILES

```
src/components/app/AddElementModal.tsx                       rewritten in place (S1–S8)
src/pages/app/ContractPage.tsx                               structuralPhase gate + disabledReason
src/lib/contracts.ts                                         CompositionSpec.header.line_position
supabase/migrations/20260812T1200_additem_line_position.sql  NEW — applied to production
test/ui/additem_add_element_modal.test.tsx                   NEW — 16 tests
test/db/additem_line_position.test.ts                        NEW — 8 tests
```

`ClauseDocument.tsx` was **read and not modified** — the renderer already folds authored rows into
the template's ordered item list correctly, and nothing here needed it. `AppLayout.tsx` untouched.
Nothing deleted.
