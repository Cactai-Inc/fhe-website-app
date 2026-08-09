# TASK PAGEFRAME — put every page on the shared header, one page at a time

Owner, 2026-08-08: **"have the pages authored individually, since there is very little
repeatability for the current pages' layouts."**

**This is not a sweep.** Nine pages, nine separate conversions, each read and judged on its
own. A find-replace across them is the wrong instinct and will produce nine subtly broken
pages.

---

## What already exists — do not rebuild it

Both shipped and proven against `Horse records`, the page the owner named as the reference:

| component | owns |
|---|---|
| `src/components/app/PageLayout.tsx` | the page's outer rhythm — gap under the sticky header, gutters, width cap — and renders the header |
| `src/components/app/PageHeader.tsx` | the header row itself |

`src/pages/app/ops/HorseRecordsPage.tsx` is the **worked example**. Read it before starting.

### The header's shape — settled, do not redesign

```
PAGE NAME (gold eyebrow) ················  [ + ]   ← bottoms aligned
Page title, large and green
Description, one size down
```

Owner's words: *"the top right corner is where the + button goes, the page name is bottom
aligned with that button, and the page title is below those, and the description is below
that."*

### Three rules that are easy to get wrong

1. **`name` and `title` are different things.** `name` is the gold eyebrow — what the page
   IS. `title` is a large green line written to the reader and **never a duplicate of the
   name** (`TASK-PAGETITLES`).
2. **`title` is OPTIONAL — leave it out unless approved copy exists.** `TASK-TITLESWEEP`
   holds draft-approved copy for the **user** pages only and explicitly forbids improvising
   wording. **Do not invent a conversational line for any ops page.** Pass `name` and
   `description`; TITLESWEEP fills titles in later without touching layout.
3. **`addLabel` is REQUIRED whenever `onAdd` is passed.** The visible text is gone, so that
   prop is the only accessible name the control has. A page that omits it ships a button
   screen readers announce as nothing.

## The nine pages, with what is already known

Each has a different width today. **The current value is evidence of intent, not gospel** —
some are wrong. Judge each against its content.

| page | current cap | `+` controls | note |
|---|---|---|---|
| `app/CareHome.tsx` | `max-w-4xl` | 3 | **Most complex.** Three add-controls; work out which belongs in the header and which are content-level. TITLESWEEP has approved copy: eyebrow `HORSE CARE`, and it says keep the existing "Welcome, {first}" line. |
| `app/ops/DealsPage.tsx` | `max-w-lg` | 2 | Very narrow for a list page. One of the two `Plus` hits is inside a modal — **only the page-level control belongs in the header.** |
| `app/Admin.tsx` | `max-w-md` | 2 | Narrowest of all. Check whether that is deliberate. |
| `app/ops/LookupReviewPage.tsx` | `max-w-3xl` | 1 | |
| `app/ops/ContactsPage.tsx` | `max-w-5xl` | 1 | Title is driven by `MODE_COPY[mode].title` — the page serves directory / leads / contacts. **`name` must follow the mode**, not be hardcoded. |
| `app/ops/NewContractPage.tsx` | `max-w-5xl` | 1 | |
| `app/ContractPage.tsx` | `max-w-xl` | 1 | **Carries `ContractSubheader`, which sticks at `--cs-hdr-h`.** Converting the page must not change where that bar lands. Verify the sticky offset after. |
| `app/ops/DealPage.tsx` | `max-w-2xl` | 1 | |
| `app/ops/EvaluationReportsPage.tsx` | `max-w-4xl` | 1 | |

`PageLayout`'s `width` prop maps: `narrow` = `max-w-3xl`, `default` = `max-w-4xl`,
`wide` = `max-w-6xl`, `full` = `max-w-none`. **Where a page's current cap has no equivalent
(`max-w-md`, `lg`, `xl`, `2xl`, `5xl`), decide whether the page genuinely wants that measure
— and if it does, say so in the report rather than forcing it into the nearest bucket.**

## Method — per page, in this order

1. **Read the page.** What is the content? What does the `+` actually do?
2. **Convert the header only.** Replace the hand-rolled title row with `PageLayout`.
3. **Leave the content layout alone.** The owner: *unique content layouts based on the page
   content.* `PageLayout` deliberately has no opinion below `children`; do not give it one,
   and do not restructure a page's body to match another page's.
4. **Typecheck and build after EACH page**, not once at the end. A broken conversion is
   trivial to find at page N and miserable to find at page 9.
5. Remove now-unused imports (`Plus`, and any header-only helpers).

## What NOT to do

- Do not convert all nine in one pass and build once.
- Do not standardise content, spacing or card styles below the header.
- Do not invent page titles.
- Do not move a modal's add-button into the page header because it matched a grep.
- Do not change `ContractSubheader`'s sticky offset.

## Verification

1. All nine render, each with the header in the same place — **screenshot them together** so
   the alignment the owner reported is visibly fixed.
2. Every `+` still opens what it opened before.
3. Every `+` has an accessible name — check the rendered `aria-label`, not the source.
4. `ContractPage`'s subheader still sticks flush under the app header.
5. `ContactsPage` shows the right name in all three modes.
6. Typecheck, lint, build clean — lint baseline is 0 errors / 30 warnings.

## Constraints

- Own git worktree off `origin/main`, at `~/Downloads/claude-code-repo/wt-pageframe`.
  **Never `~/Desktop`.**
- `ClauseDocument.tsx` is FROZEN. `ContractPage.tsx` may be edited; the document renderer may
  not.
- Do not touch `AppLayout.tsx`, `AppHeader.tsx` or `app-header.css`.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only.

## Reporting

`docs/reports/TASK-PAGEFRAME-REPORT.md`. Per page: what changed, the width chosen and why,
and anything that did not fit the template — that last part is the most useful thing in the
report, because it is where the template is wrong.
