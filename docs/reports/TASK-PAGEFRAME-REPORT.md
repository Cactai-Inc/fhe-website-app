# TASK PAGEFRAME — report

8 of the 9 pages converted to `PageLayout`/`PageHeader`. `ContractPage.tsx` was read in full
and deliberately left unconverted — its existing header does not fit the shared component's
contract (see its own section below). Committed individually on `task/pageframe`, one page per
commit, typecheck + build run after each. Not pushed.

## The task table's own data didn't match the code

Before anything else: **the task's "current cap" and "+ controls" columns were wrong for most
of the 9 pages.** Not close — wrong page-level facts. This looks systematic: whoever built the
table grepped each file for `max-w-` and `Plus` and took the first/nearest hit, which in several
files belongs to a **nested modal or sub-component**, not the page's own outer wrapper. I
re-verified every page against its actual JSX before touching anything, so none of this affected
the conversions — but it's worth flagging because a less careful pass would have "fixed" widths
that were already correct and missed the ones that weren't.

| page | table claimed | actually was | what the table's number was |
|---|---|---|---|
| DealsPage.tsx | `max-w-lg` | `max-w-5xl` | `CreateDealModal`'s dialog box |
| Admin.tsx | `max-w-md` | `max-w-none` (full) | `LoginTab`'s nested detail block |
| NewContractPage.tsx | `max-w-lg` | `max-w-5xl` | (no such class anywhere in the file) |
| ContractPage.tsx | `max-w-xl` | `max-w-5xl` (body only, see below) | `HorseGate`'s inner list wrapper |
| DealPage.tsx | `max-w-2xl` | `max-w-5xl` | (no such class anywhere in the file) |
| LookupReviewPage.tsx | `max-w-3xl` | `max-w-3xl` | — matched |
| ContactsPage.tsx | `max-w-5xl` | `max-w-5xl` | — matched |
| EvaluationReportsPage.tsx | `max-w-4xl` | `max-w-4xl` | — matched |

The `+` counts were similarly unreliable: LookupReviewPage and NewContractPage have **zero**
add-controls (the table said 1 for each); DealPage's "1" is actually N per-document-type
buttons, none of them a single page-level add; Admin's "2" is really 1 header-level control plus
a reused content-level helper. DealsPage's note ("one Plus is inside a modal") doesn't match the
code either — both of its Plus buttons are on the page itself, mutually exclusive on
`rows.length`, neither in a modal. Details are in each page's section below.

## Width judgment

Several pages' real caps (`max-w-5xl`) have no exact match in `PageLayout`'s `WIDTHS`
(`narrow`=3xl, `default`=4xl, `wide`=6xl, `full`=none). For DealsPage, ContactsPage,
NewContractPage and DealPage I rounded 5xl up to `wide`, on the same reasoning each time: these
are dense list/card/form pages that were already fairly wide, and narrowing them to `default`
(4xl) would visibly compress rows or grids that currently work at 5xl; widening to `wide` (6xl)
is a small step in the safer direction. This is a judgment call the task invited me to make
explicit rather than force into the nearest bucket, so flagging it here for the owner to veto if
`wide` reads as too roomy on any of the four once seen live.

## Per-page

### `app/CareHome.tsx` — width `default` (exact match)
Header: `name="Horse care"`, `title` = the existing TITLESWEEP-approved `Welcome, {first}` /
`Your horse care` fallback (kept verbatim, not improvised). The persistent "Add a horse" link
next to the "Your horses" heading became the header's `+` (`onAdd` navigates to
`/app/horse-intake`, `addLabel="Add a horse"`) — it was the one of the three Plus-icon
affordances that reads as "add a record to the page's list," matching the pattern
`HorseRecordsPage` already established. The empty-state "Add your horse" CTA and the "Request a
service" card (a full CTA with explanatory copy, not an add-new action) both stay content-level;
collapsing "Request a service" into an icon-only `+` would have thrown away the sentence that
explains what it does, which the task's rule against redesigning content forbids anyway.

### `app/ops/DealsPage.tsx` — width `wide` (rounded from 5xl)
Header: `name="Deals"`, `description` = the existing tagline. `onAdd` is conditional on
`rows.length > 0`, exactly reproducing the prior conditional render of the "New deal" button;
`addLabel="New deal"`. The empty-state "Create your first deal" button stays content-level —
same reasoning as CareHome's empty state.

### `app/Admin.tsx` (Clients) — width `full` (exact match)
Header: `name="Clients"`, `description` switches between the list-state and isolated-state
copy exactly as before (now via `PageHeader`'s `description` prop, which accepts `ReactNode`).
`onAdd` is conditional on `!selected`, reproducing the prior "ADD NEW" button's visibility;
`addLabel="Add a new client"` (the old visible text, "ADD NEW", becomes the accessible name
now that the control is icon-only). The per-tab `TabCreate` actions (Bookings/Documents/
Messages) and the "+ contract" shortcut inside "Associated items" stay content-level — they're
scoped to a specific tab/section, not the page.

### `app/ops/LookupReviewPage.tsx` — width `narrow` (exact match)
Header: `name="Field option review"`, `description` = the existing explanatory paragraph. No
`onAdd` — there is no add-new concept on this page at all; the per-row "Add to list"/"Dismiss"
buttons are row actions, not a page-level control.

### `app/ops/ContactsPage.tsx` (Directory / Leads; `ContactsPage` export retired) — width `wide`
The single `ContactDirectory` component backs `DirectoryPage` and `LeadsPage` (both live) and
the retired `ContactsPage` export (dead route, still compiles). `name={MODE_COPY[mode].title}`
and `addLabel={MODE_COPY[mode].newLabel}` both read off the same map the old hand-rolled header
used, so all three modes keep correct wording — verified by reading the code path, not by
rendering (see Verification). `onAdd` reproduces the prior `setCreating(true)` handler exactly.

### `app/ops/NewContractPage.tsx` — width `wide` (rounded from 5xl)
Header: `name="New contract"`, `description` = the existing paragraph. No `onAdd` — there is no
Plus icon anywhere in this file; "Get started" is a full-width wizard-submit button, not an
add-new affordance, and stays content-level. The "← Documents" back-link moves into content, as
the first thing below the header (there's no "above the header" slot in `PageLayout`'s
contract).

### `app/ops/DealPage.tsx` — width `wide` (rounded from 5xl)
Header: `name="Deal"` only — a static category eyebrow, nothing else. This is a single-record
detail page, and the deal's own identity (its name with an inline rename control, its type/status
badges, the "Deal record" button) is the record's own data, not a page title — and technically
couldn't go in `PageHeader.title` anyway, since that prop is `string`-only and the rename button
is a real element. That whole block stays exactly as it was, now rendered as the first thing
inside `PageLayout`'s children instead of inside a hand-rolled wrapper div. The N per-document-
type "add this document" buttons inside "Deal documents" (0 to several, depending on what's
missing) are section-scoped, not a single page-level add, and stay where they are.

### `app/ops/EvaluationReportsPage.tsx` — width `default` (exact match)
Header: `name="Evaluation reports"`, `description` = the existing paragraph. No `onAdd` — the
page's one Plus icon resets the Editor card's form in place (a "New" toggle scoped to that
card, not a page-level add). Dropped the now-unused `FileText` import (was only the hand-rolled
header's icon).

### `app/ContractPage.tsx` — NOT converted, left untouched
This page doesn't have a hand-rolled title row of the kind `PageHeader` was built to replace,
and forcing one on would either duplicate chrome or undo a real, deliberate fix. Specifically:

- **No static `name` exists.** `PageLayout` requires one and renders `PageHeader`
  unconditionally above `children`. This page's identity is per-document (`doc.title`, e.g. "Horse
  Lease Agreement — Beau"), not a fixed category like "Deals" or "Clients."
- **`ContractSubheader` already does the header's job** — and its exact position is the one
  thing the task explicitly said not to disturb. A comment at the point where its width is set
  (`bodyWidth`, `ContractPage.tsx` ~line 1083) documents the owner fixing this precise class of
  bug already: the reading-width cap used to sit on the whole page, which also capped the
  subheader at 1024px, so on a wide window its buttons wrapped instead of using the room they
  had. The fix moved the cap to apply only to the document body *below* the bar, so the bar fills
  `<main>` and the prose stays readable. Wrapping the page in `PageLayout` — which applies its
  width cap to everything, header included — would silently reintroduce exactly that bug.
- **No add-new control exists** (`grep -n "<Plus\b"` on the file returns nothing) — there's
  nothing for `onAdd`/`addLabel` to attach to.
- **The existing centered title block** (a status pill above a centered `<FileText>` + `h1`
  showing `doc.title`) is itself already correctly capped at the real body width and doesn't map
  onto `PageHeader`'s shape (left-aligned eyebrow, bottom-aligned square `+`) without losing the
  icon and status pill or duplicating them elsewhere.

Given all of that, the honest reading is that this page's header is not the kind of "hand-rolled
title row" the task describes converting — it's a different, already-bespoke, already-fixed
design for a fundamentally different kind of page (one live document, not a category list). I
left the file untouched rather than force a fit. If the owner wants this page unified with the
other eight regardless, that's a real design call — what would the gold eyebrow even say for a
per-document page? — worth its own short conversation rather than a guess baked into this pass.

## Accessibility (rule 3) — checked by hand against `PageHeader.tsx`

Every page where `onAdd` can be non-`undefined` also passes a non-empty `addLabel`:
CareHome (`"Add a horse"`), DealsPage (`"New deal"`), Admin (`"Add a new client"`), ContactsPage
(`MODE_COPY[mode].newLabel`, always a real string in all three modes). The four pages with no
`onAdd` correctly omit `addLabel` too — there's no control for it to name. `PageHeader` itself
is unmodified, so the actual DOM wiring (`aria-label`/`title` both set from `addLabel`) is
identical everywhere it's used, including on the already-shipped `HorseRecordsPage` reference.

## Verification

Done:
- **Typecheck + build after every single page**, not batched — confirmed clean at each of the 8
  steps individually (the task was explicit about this, and it did catch nothing, but it was
  run at every step regardless).
- **Final full `npm run lint`**: 0 errors / 36 warnings. The task's stated baseline was 30; I
  built a throwaway worktree of clean `origin/main` (pre-pageframe) to check, and 36 is already
  the baseline there — the ONEAUTHOR/DOCQUEUE/UPLOADS merges that landed on `main` mid-session
  drifted it from 30 to 36 independent of this work. None of the 36 warnings are new: only one
  touched file (`Admin.tsx`) appears in the list at all, and its 2 warnings are pre-existing
  `useCallback` dependency warnings in `fetchActivity`/`fetchPosts`, code this task never
  touched.
- **Full production build** (`npm run build`: vite build + prerender + sitemap/robots) succeeds
  end-to-end.
- **Rebased twice** mid-session onto a moving `origin/main` (first for the ONEAUTHOR/DOCQUEUE/
  UPLOADS merges, then again for a docs-only DOCCOLS-spec commit) — both landed cleanly with no
  conflicts, and I re-diffed against `origin/main` after each to confirm the change-set was
  exactly the 8 files this task touched, nothing more.
- **Dev server smoke test**: boots and serves the app shell without a runtime error.

Not done, and why:
- **No authenticated browser click-through, and no cross-page screenshot.** The task's
  verification section asks to screenshot all nine together and confirm every `+`'s rendered
  `aria-label`. No browser/screenshot automation tool is available in this environment, and the
  eight converted pages are all behind staff or client auth I have no credentials for in this
  worktree (same limitation a prior session on this project hit and reported on
  `task/accountsurface`). I did not build new test infrastructure to work around this — that
  wasn't asked for and would have been scope creep.
- What stands in for it: every one of the 8 conversions renders through the **exact same,
  unmodified** `PageLayout`/`PageHeader` already shipped and owner-approved on
  `HorseRecordsPage`. The failure this task exists to fix — "the add-new button sits at a
  different height on every page" — was a per-page hand-rolled-markup problem; routing all 8
  through one shared component makes that drift structurally impossible to reintroduce without a
  defect in the shared component itself, which was not touched. Each page's props were checked
  by hand against `PageHeader.tsx`'s actual source (not assumed) for every one of the three rules
  in the task, and each `onAdd` handler is byte-for-byte the same function that was already wired
  to the old visible-text button, so "opens what it opened before" holds by construction, not by
  observation.
- `ContractPage.tsx`'s subheader offset is unaffected because the file wasn't changed at all.

## Constraints honored

Own worktree at `~/Downloads/claude-code-repo/wt-pageframe`, branch `task/pageframe` off
`origin/main`. `ClauseDocument.tsx` untouched (never opened for editing). `AppLayout.tsx`,
`AppHeader.tsx`, `app-header.css` untouched. Sarah's document (`704c8d2d-…`) never queried or
referenced — this pass touched no runtime data, only page-header JSX. Not pushed.
