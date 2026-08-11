# TASK FRAMESCROLL — wide content scrolls inside its frame; the app header never moves

**Owner, 2026-08-11:**

> *"i noticed that the documents page which has wider content rows than the view allows for
> doesnt scroll in frame but rather it uses a wider content surface than the header meaning i
> scroll sideways to see the row's content and the whole page and header move but the header is
> cut off at the edge of the browser. The content needs to scroll and the app header remains
> locked. If you can quickly audit the code for each page to find other incidences of this that
> is more efficient than waiting for the page by page audit to find them."*

**This is not a Documents-page bug. It is one shared component with 23 consumers, and the
Documents page is simply the first one whose rows got wide enough to expose it.**

---

# THE ROOT CAUSE — found, and it is in one file

`src/components/ops/kit/DataTable.tsx:59-112` returns a bare table with **no scroll
container of any kind**:

```jsx
return (
  <table className="w-full text-left text-sm border-collapse">
```

**The mechanism, and why the header moves with it:**

1. `w-full` is `width: 100%`. A table's *used* width can never fall below its **min-content
   width** — the sum of what its columns need. With enough columns, or a `whitespace-nowrap`
   cell, min-content exceeds the container.
2. The table's overflow is `visible` (nothing declares otherwise), so it does not clip and it
   does not scroll. It **paints outside its box and extends the document's scroll width.**
3. `<main>` is `flex-1 min-w-0` (`AppLayout.tsx:1470`) — correct, and irrelevant here.
   `min-w-0` lets `main` *shrink*; it does not stop a `visible`-overflow child painting past
   its edge.
4. `.oh-hdr` is `position: sticky; top: 0` (`app-header.css:42`). **Sticky pins on the block
   axis only.** On horizontal document scroll a sticky-top header translates with the page like
   any other element — so it slides left and its right edge runs out of surface.

The owner's description matches this mechanism in every particular. **Verify it before
building** — if the actual cause is different, report that instead of implementing this.

---

# THE AUDIT — done, and here is the result. Confirm it, then widen it.

**`DataTable` has 23 consumers. NOT ONE of them wraps it in a scroll container.**

```
src/components/ops/documents/DocumentQueueTable.tsx      src/pages/app/ops/barnops/ResourcesPage.tsx
src/components/ops/horses/HorseTable.tsx                 src/pages/app/ops/boarding/BoardAgreementsPage.tsx
src/pages/app/ops/DocumentViewerPage.tsx                 src/pages/app/ops/boarding/BoardChargesPage.tsx
src/pages/app/ops/IntakePage.tsx                         src/pages/app/ops/boarding/FacilitiesPage.tsx
src/pages/app/ops/PaymentReviewPage.tsx                  src/pages/app/ops/employees/SchedulePage.tsx
src/pages/app/ops/admin/AdminModulesPage.tsx             src/pages/app/ops/employees/StaffPage.tsx
src/pages/app/ops/admin/AdminProductsPage.tsx            src/pages/app/ops/hubs/RecordsHubPage.tsx
src/pages/app/ops/barnops/AllocationRulesPage.tsx        src/pages/app/ops/lessons/LessonCreditsPage.tsx
src/pages/app/ops/barnops/ConsumptionLogPage.tsx         src/pages/app/ops/lessons/LessonPackagesPage.tsx
src/pages/app/ops/records/HorseHealthPage.tsx            src/pages/app/ops/superadmin/OrganizationsPage.tsx
src/pages/app/ops/records/HorsePartiesPage.tsx           src/lib/ops/index.ts  (re-export)
                                                          src/portal/kit-contract.ts  (contract test)
```

**`DataTable` is the only `<table>` in `src/`.** Every other tabular surface is a grid or a
flex list.

**Exactly three files in the whole tree carry `overflow-x-auto` / `overflow-auto`, and none of
them is a table wrapper** — checked individually, because the grep result alone would have
suggested otherwise:

- `HorsePage.tsx:137` — a **tab strip**, not a table
- `CalendarPage.tsx:306` — the **calendar grid**, correctly wrapped
- `PaymentReviewPage.tsx:177` — on a **`<pre>`**, not on the `DataTable` that page also renders

So the correct fix is **one edit in `DataTable.tsx`**, and 23 pages are fixed at once.

---

# WHAT TO BUILD

## 1. The scroll container goes in `DataTable`

Wrap the `<table>` so that horizontal overflow becomes a scroll *inside the table's own frame*.
The page must not widen.

**Get these right, because a naive wrapper introduces new defects:**

- **Vertical must not be clipped.** A bare `overflow-x-auto` computes `overflow-y` to `auto`,
  which creates a scroll container on both axes and will clip or trap anything that hangs out
  of a row — dropdowns, popovers, tooltips. **Check whether any cell renders such a thing**
  (`rowActions` renders buttons; some consumers pass rich `render` functions) and say what you
  found. If something does escape the row, `overflow-x` alone is not enough and you must say so
  rather than clipping it silently.
- **Keyboard reachability.** A scroll container holding focusable cells is fine, but a scroll
  container the *keyboard* cannot reach is a WCAG 2.1.1 failure. Give the wrapper `tabindex="0"`
  and an accessible name **only if** the table can actually overflow — an always-focusable
  wrapper adds a dead tab stop to all 23 pages.
- **Do not set `table-layout: fixed`.** It would stop the overflow by squeezing columns instead,
  changing how every existing table renders. Out of scope.
- **Do not add a horizontal scrollbar where none is needed.** `auto`, never `scroll`.

## 2. The backstop on `<main>` — and it must be `clip`, not `hidden`

Even with `DataTable` fixed, any future wide child re-creates the bug. Add a defensive
horizontal clip to `<main>` (`AppLayout.tsx:1470`).

**⚠️ IT MUST BE `overflow-x: clip`. `overflow-x: hidden` WILL BREAK STICKY POSITIONING.**

`overflow: hidden` makes an element a **scroll container**. Any `position: sticky` descendant
then sticks relative to *that* box instead of the viewport — and because the box does not
itself scroll, the sticky element simply stops sticking. **`ContractSubheader` is sticky at
`top: var(--cs-hdr-h)` and lives inside page content, inside `<main>`.** `overflow-x: hidden`
on `main` would break it.

`overflow-x: clip` clips without creating a scroll container, so sticky descendants continue to
resolve against the real scrollport. It is also the only value that permits `overflow-y:
visible` on the other axis.

**Prove it, do not assume it:** after adding the clip, confirm `ContractSubheader` still sticks
and that the two nav rails (both `sticky top-[var(--cs-hdr-h)]`, `AppLayout.tsx:880` and
`:1338`) are unaffected. The rails are **siblings of `main`, not descendants** — state that
you checked rather than inferring it.

If `overflow-x: clip` turns out to break something, **report it and ship §1 alone.** The
root-cause fix is the deliverable; the backstop is insurance.

## 3. The header must not be reachable by horizontal scroll

With §1 and §2 the document should never exceed the viewport width, so the question is moot.
**Confirm that rather than assuming it**, and if any page still scrolls sideways, find that
page's own driver and fix it — do not paper over it by changing the header's positioning.

**Do not change `.oh-hdr` to `position: fixed`.** Four things read `--cs-hdr-h` for their
sticky offsets and the header currently occupies real layout space; making it fixed removes
that space and shifts every page up by the header's height.

---

# 4. THE WIDER AUDIT — the owner asked for it, so do it properly

> *"If you can quickly audit the code for each page to find other incidences of this…"*

**Static audit, `src/` only. Report findings as a table: file, line, driver, whether it can
actually overflow, and the fix.** Do not fix anything outside `DataTable.tsx` and `main`
without saying why in the report first.

Sweep for each of these five drivers by name:

1. **Flex children missing `min-w-0`.** A flex item's default `min-width: auto` refuses to
   shrink below its content, so one long word, email address or ID in a flex row pushes the
   whole layout wide. **This is the single most common cause of horizontal overflow in a
   flexbox app and it will be the largest category here.** `main` itself already carries
   `min-w-0` — check its descendants.
2. **Fixed widths that cannot shrink**: `w-[NNNpx]`, `min-w-[NNNpx]`, and `grid-cols-[…]` with
   fixed or `minmax(Xrem, …)` tracks. `ClauseDocument.tsx:606` uses
   `repeat(auto-fill, minmax(17rem, 1fr))` — that overflows below 17rem of container, which a
   320px phone with page gutters can reach. **Report it; do not edit that file** (it is
   STOP-AND-PROPOSE).
3. **`whitespace-nowrap` on content of unbounded length.** Fine on a short badge or a date,
   a defect on a name, email or title.
4. **Long unbroken strings with no `break-words` / `truncate`**: email addresses, URLs, UUIDs,
   order codes. UUIDs appear in ops surfaces and are 36 characters with no break opportunity.
5. **Elements escaping their container**: negative margins, `w-screen`, and absolutely
   positioned children of a container that is not itself positioned.

**Report every finding. Fix only what this task owns.** The rest becomes a ranked list the next
thread picks up — a long accurate list is the deliverable here, not a wide diff.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-framescroll`, branch `task/framescroll`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **You own `src/components/ops/kit/DataTable.tsx`.** Your only permitted edit in
  `AppLayout.tsx` is the `overflow-x` on `<main>` at line 1470 — **that file belongs to
  `TASK-NAVMOTION`, which is running concurrently.** One property, one line, nothing else. If
  you need more, **report it and stop.**
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE** — report, never edit.
- **`DocumentQueueTable.tsx` is being edited right now by `TASK-DOCQUEUE`**, which is adding
  person/horse/type columns to this exact table — the change that makes this bug worse. **Do
  not touch that file.** Fixing `DataTable` fixes it for them without a conflict, which is the
  point of fixing it at the root.
- **Delete nothing.**
- **T1 — arbitrary Tailwind values have silently emitted nothing in this repo, twice.** Use
  declared scale steps; grep anything you add out of the built CSS and paste the match.
- No staff browser session exists and you will not be given one. **`npm run build` and read the
  emitted CSS. Report every render as NOT VERIFIED**, and give the owner a numbered checklist:
  which pages to open, at what width, and what should and should not scroll.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. A `DataTable` wider than its container **scrolls horizontally inside its own frame.**
2. **The document does not scroll horizontally**, so the app header stays put and its right
   edge never leaves the viewport.
3. `ContractSubheader` and both nav rails **still stick** after the `main` change — stated as
   checked, not assumed.
4. Nothing that hangs out of a table row is newly clipped — or, if something is, it is named in
   the report.
5. The audit table lists every overflow driver found in `src/`, with the ones left unfixed
   ranked.

Report to `docs/reports/TASK-FRAMESCROLL-REPORT.md`.
