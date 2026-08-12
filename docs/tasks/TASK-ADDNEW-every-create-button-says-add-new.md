# TASK ADDNEW — the page create control says `+ Add New`

**Owner, 2026-08-11. This supersedes A6.**

> *"I previously told you to make the + icon the button on the pages where i can create
> something, i revert that and supersede the decision to the documents page version it looks the
> best, + Add New"*

---

# WHAT IS BEING REVERTED, AND WHY THE REVERT IS BETTER

`src/components/app/PageHeader.tsx:32-38` records the decision being overturned:

> *"A6 — the control is a SQUARE, ICON-ONLY `+`. The label is dropped: `+` is the universal
> add-new affordance, and **the words made every button a different width, which is part of why
> the rows never lined up.**"*

**A6's stated problem does not survive this change.** It dropped labels because the labels
*varied* — "New deal", "New contract", "Add a horse", "Add a new client" — so every button was a
different width. **If every button reads the same two words, they are all identical widths.**
The alignment problem A6 existed to solve is solved by uniformity, not by silence.

**Say this in the report.** A later reader finding A6's comment must understand it was
superseded on its own terms, not overruled in spite of them.

---

# THE CHANGE

## 1. `PageHeader` — the page-level control gets its label back

Today: a 40×40 square, `Plus` icon only, `addLabel` used as `aria-label` + `title`.
**Becomes: `+ Add New`** — the plus glyph plus those words, matching
`DocumentsQueuePage.tsx:345`, which the owner named as the one that looks best.

**Callers, verified 2026-08-11** — six real pages plus one passthrough:

```
src/components/app/PageLayout.tsx:50      addLabel={addLabel}          (passthrough)
src/pages/app/CareHome.tsx:37             "Add a horse"
src/pages/app/Admin.tsx:790               "Add a new client"
src/pages/app/ops/DealsPage.tsx:233       "New deal"
src/pages/app/ops/HorseRecordsPage.tsx:215 "Add a horse"
src/pages/app/ops/ContactsPage.tsx:258    MODE_COPY[mode].newLabel
```

**`ContractCascade.tsx:794` also passes an `addLabel` and IS NOT AFFECTED** — that prop goes to
`ContactsList`, a different component, and produces *"Add another"* inside contract authoring.
**Do not touch it.** Renaming that to "Add New" would be wrong at every call site.

## 2. ⚠️ THE ACCESSIBILITY TRAP — do not simply delete `addLabel`

Today `addLabel` IS the accessible name, because there is no visible text. Make the visible text
"Add New" and keep `aria-label="Add a horse"` and you have **broken WCAG 2.5.3 Label in Name**:
the accessible name no longer contains the visible label, so a voice-control user saying *"click
Add New"* activates nothing.

**Two acceptable resolutions. Pick one, state which and why:**

- **The accessible name CONTAINS the visible text** — e.g. visible `Add New`, accessible
  `Add New horse` / `Add New client`. Keeps per-page specificity for screen readers *and*
  satisfies 2.5.3.
- **The visible text IS the accessible name** — drop `aria-label`, let "Add New" speak for
  itself, and rely on the page context. Simpler; loses specificity.

**Recommended: the first.** A screen-reader user landing on a button that only ever says "Add
New" on every page has lost real information that the icon-only version gave them.

**Do not leave `addLabel` as an `aria-label` that contradicts the visible words.** That is the
worst of the three and it is what a careless diff produces.

## 3. Casing — normalise to `Add New`

Three spellings are live today:

```
AppLayout.tsx (nav)                 "Add New"    ← the established form
DocumentsQueuePage.tsx:345          "+ Add new"
DocumentQueuePicker.tsx:120         "Add new"    (the picker's own heading)
```

**Use `Add New`** — the owner's own spelling in this ruling, and what the nav already says.
Normalise the Documents page button to match. **The picker's `<h2>` heading is a title, not a
button** — decide whether it follows and say what you chose.

## 4. `PageCreateButton` — REPORT, do not change without saying so

`src/components/app/PageCreateButton.tsx` is a *different* control and **already renders icon +
label**. It was never icon-only, so it is not what A6 changed and not what this ruling reverts.
Its five callers pass a noun:

```
StableSection.tsx:72   "Horse"      Messages.tsx:299    "Message"
Home.tsx:59            "Post"       CalendarPage.tsx:225 "Booking"
MyPosts.tsx:34         "Post"
```

Some of these are section-level ("+ Horse" inside the Stable section, "+ Booking" on the
calendar toolbar), where a specific noun is more useful than "Add New". Others (Messages, Home,
MyPosts) look page-level and arguably should match.

**Do not decide this unilaterally.** Change `PageHeader` — that is the ruling. Then **list all
five with a recommendation each and let the owner rule.** The distinction that matters: is this
the page's one create control, or one of several controls inside a page?

## 5. Layout consequences — check, do not assume

`PageHeader` aligns the eyebrow and the control with `items-end` and reserves
`min-h-[40px]`. A wider button changes that row.

- **The row must still bottom-align** and pages *without* a control must keep the same rhythm —
  that is the drift this component was built to stop. Re-read its comment before editing.
- **At narrow widths the eyebrow and the button now compete for space.** The row is
  `flex … justify-between gap-4`; a longer button plus a long page name can overflow. **Check
  the longest page name against the narrowest breakpoint** — and note that
  `TASK-FRAMESCROLL` is concurrently fixing horizontal overflow, so do not *create* an instance
  of the bug it is removing.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-addnew`, branch `task/addnew`, off `origin/main`.
  **Never `~/Desktop`.** Do not push.
- **Do not edit `AppLayout.tsx`** (`TASK-NAVMOTION` owns it — the nav's own "Add New" is already
  correct and needs nothing), **`DataTable.tsx`** (`TASK-FRAMESCROLL`), or the documents queue
  table (`TASK-DOCCOLS`). All are running.
  **`DocumentsQueuePage.tsx:345` is a one-word casing fix** — coordinate by keeping the diff to
  that single string.
- **`ClauseDocument.tsx` and `ContractCascade.tsx` are not in scope.**
- **Delete nothing.**
- **T1 — arbitrary Tailwind values have silently emitted no rule at all in this repo, twice.**
  Use declared scale steps; grep anything you add out of the built CSS.
- No staff browser session exists and you will not be given one. Prove the emitted classes and
  the accessible-name computation; report the render as **NOT VERIFIED** with a numbered
  checklist naming each of the six pages to look at.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. All six `PageHeader` pages show **`+ Add New`**, identical width on every page.
2. The accessible name **contains** the visible text on every one of them.
3. `ContractCascade`'s "Add another" is untouched.
4. Casing is `Add New` everywhere it is a button.
5. Pages with no create control keep their existing vertical rhythm.
6. Nothing overflows horizontally at the narrowest breakpoint.

Report to `docs/reports/TASK-ADDNEW-REPORT.md`.
