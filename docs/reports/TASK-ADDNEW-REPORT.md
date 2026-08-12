# TASK ADDNEW — report

**Thread:** ADDNEW · **Branch:** `task/addnew` · **Worktree:** `wt-addnew`
**Base:** `origin/main` @ `fcb434b`.

`npm run typecheck` — 0 errors. `npm run lint` — 0 errors, 39 warnings (all pre-existing,
none in touched files). `npm run build` — succeeds; prerender fails only on the missing
`SUPABASE_URL` env var in this worktree, which is expected (no creds here) and unrelated
to this change — the Vite build itself, which is what emits the CSS I needed to check, is
clean.

---

## 1. The revert, stated plainly

`PageHeader.tsx` (`src/components/app/PageHeader.tsx:36-38`) recorded A6: icon-only `+`,
label dropped, because varying labels ("New deal", "Add a horse", "Add a new client")
made every button a different width. **That reasoning doesn't survive this change.** If
every button now reads the identical two words "Add New", every button is the identical
width — uniformity solves what A6 used silence to solve. The comment block in
`PageHeader.tsx` now records this explicitly, so a later reader who finds A6's original
comment (git blame or memory) sees it was superseded on its own terms, not overruled
in spite of them.

## 2. What changed

**`PageHeader.tsx`** — the control is now `+ Add New` (Plus icon, 16px, + the literal
words), `h-10 px-4` (was `w-10 h-10` square), on a `bg-green-800` pill matching the
existing icon+label button convention already used elsewhere in this app (e.g.
`DealsPage.tsx:245`'s "Create your first deal" button — same `Plus` + text pattern, not
a hand-invented style).

I did **not** copy `DocumentsQueuePage.tsx:345`'s exact markup (a literal `+` text
character, no SVG). I kept the `lucide-react` `Plus` glyph because it's the established
icon+label convention already used elsewhere in this codebase, and it reads identically
as "+ Add New" — the owner's naming of the Documents page was about the *look* (label
back, not icon-only), which this achieves. **Flagging this substitution explicitly** in
case the owner meant the literal glyph specifically.

**The accessibility trap (§2 of the task) — I chose resolution 1**, per the task's own
recommendation: the accessible name **contains** the visible text.

- Visible text: always `"Add New"`.
- `addLabel`'s **meaning changed** from "the full accessible sentence" to "the object
  noun" (`"horse"`, `"client"`, `"deal"`, `"lead"`, `"contact"`, `"directory entry"` —
  not `"Add a horse"` anymore).
- `PageHeader` composes `aria-label="Add New {addLabel}"` — e.g. `"Add New horse"`,
  `"Add New client"`. `"Add New"` is an exact prefix of the accessible name, satisfying
  WCAG 2.5.3, and the screen-reader user still hears which page they're on.
- I removed the `title` attribute. It existed only because there was no visible text to
  serve as a tooltip; there now is, so a `title` duplicating it would be redundant.
- If `addLabel` is omitted, `aria-label` is `undefined` and the accessible name falls
  back to the visible text alone (resolution 2) — no page does this today, but the
  fallback exists for a future page with nothing more specific to say.

This required editing the five real callers' `addLabel` strings (all five are page files
already listed as callers in the task, not new scope):

```
CareHome.tsx:37             "Add a horse"       → "horse"
Admin.tsx:790               "Add a new client"  → "client"
DealsPage.tsx:233           "New deal"          → "deal"
HorseRecordsPage.tsx:215    "Add a horse"       → "horse"
ContactsPage.tsx MODE_COPY  "New directory entry" / "New lead" / "New contact"
                             → "directory entry" / "lead" / "contact"
```

`PageLayout.tsx:50` needed no code change — it's a pure passthrough of `addLabel`.

**Casing normalised to `Add New`:**
- `DocumentsQueuePage.tsx:345` — `"+ Add new"` → `"+ Add New"`. Single-string diff, as
  constrained. (Its surrounding comment referenced the same string twice more —
  `DocumentQueuePicker.tsx:2,6` — updated to match so the comment doesn't lie about the
  button text it documents.)
- `DocumentQueuePicker.tsx:120` — the picker's `<h2>` heading, `"Add new"` → `"Add New"`.
  **This is a title, not a button**, so it wasn't required by the accessible-name work,
  but I chose to normalise it anyway: it's the same phrase describing the same action one
  screen away from the button that opens it, and leaving it out of step would read as an
  inconsistency the very next person to touch this page would "fix" without context.

**`ContractCascade.tsx:794`** — confirmed untouched. It passes `addLabel` to
`ContactsList`, a different component producing "Add another" inside contract authoring.
Not `PageHeader`, not in scope, not touched.

## 3. `PageCreateButton` — reported, not changed

`src/components/app/PageCreateButton.tsx` already renders icon + label (`Plus` + text)
and was never icon-only — it isn't what A6 changed and isn't what this ruling reverts.
Untouched, per the task. Its five callers, with a recommendation each:

| caller | current label | context | recommendation |
|---|---|---|---|
| `StableSection.tsx:72` | `"Horse"` | one of several controls inside the Stable section of a larger page | **keep as-is** — section-level, a specific noun is more useful here than a generic "Add New" |
| `CalendarPage.tsx:225` | `"Booking"` | sits in the calendar toolbar next to a week/month view switcher — one of several controls | **keep as-is** — same reasoning, it's a toolbar item, not the page's one create action |
| `Messages.tsx:299` | `"Message"` | the page's *only* create control, next to the page's own `<h1>` | **arguably should match "Add New"** — this is the page-level control by the distinction the task draws, it just isn't built on `PageHeader`/`PageLayout` |
| `Home.tsx:59` | `"Post"` | the feed's only create control, gated behind `hasFeed && createModal` | **arguably should match "Add New"** — same reasoning as Messages |
| `MyPosts.tsx:34` | `"Post"` | the page's only create control, gated behind `surfaces.has_feed && createModal` | **arguably should match "Add New"** — same reasoning |

I did not act on any of these — the task is explicit that this is the owner's call, not
mine, and none of these three pages use `PageHeader`/`PageLayout` today, so "matching"
would mean either migrating them onto `PageHeader` (a bigger, unscoped change) or
hand-copying the label/styling onto `PageCreateButton` call sites (which would make
`PageCreateButton` mean two different things depending on caller). Flagging the design
question rather than picking one.

## 4. Layout consequences

`PageHeader`'s row is `flex items-end justify-between gap-4 min-h-[40px]`. The button
stays `h-10` (40px, unchanged), so `min-h-[40px]` still exactly matches it — pages
without a control keep the same row height they had before.

**Bottom alignment holds.** `items-end` aligns the flex items' box edges, not text
baselines — a wrapped two-line eyebrow (see below) still bottom-aligns with the button.

**Overflow at the narrowest breakpoint — checked, not just assumed.** The eyebrow
`<p className="eyebrow">` has no `whitespace-nowrap` or `truncate` (confirmed in
`src/index.css:162-164` — `text-xs font-sans font-medium tracking-widest uppercase`,
nothing constraining wrap). It has no `shrink-0`, so at a narrow viewport it is the
flex item that yields: text wraps onto a second line before the row would ever need
a horizontal scrollbar, because a text flex item's minimum width is bounded by its
longest unbreakable *word*, not its full string. The button has `shrink-0` and does not
compress.

I checked the longest `name` among the six `PageHeader`/`PageLayout` pages —
`"Horse records"` (`HorseRecordsPage.tsx:214`) — against a 320px viewport (`px-4` app
gutters either side, 288px content width). Eyebrow text at `text-xs uppercase
tracking-widest` plus the `"+ Add New"` button plus `gap-4` is close enough to that
budget that I can't rule out a wrap to two lines on the *narrowest* real devices for that
specific page name — but a wrap, not a horizontal scrollbar, which is the failure mode
this task is checking for. **This is the one page worth a manual look** (see the NOT
VERIFIED checklist below, item 4).

No arbitrary Tailwind values were added — `h-10`, `px-4`, `gap-2`, `text-sm`,
`font-medium` are all declared scale steps already used elsewhere in this file/app. I
built the project and grepped the emitted CSS to confirm each rule actually landed
(T1's silent-no-op failure mode):

```
.h-10{height:2.5rem}
.px-4{padding-left:1rem;padding-right:1rem}
.gap-2{gap:.5rem}
.text-sm{font-size:.875rem;line-height:1.25rem}
```

All present in `dist/assets/index-*.css` after `npm run build`.

`TASK-FRAMESCROLL` (concurrent, owns horizontal-overflow fixes) — I did not touch
`DataTable.tsx` and did not add any new overflow source; the wrap behavior above is the
row's existing overflow-avoidance mechanism, unchanged by this task.

## 5. NOT VERIFIED — no browser session available

No staff browser session exists in this worktree (no Supabase creds; matches the
standing constraint). The following is proven by diff, typecheck, lint, and built-CSS
inspection only. **Someone with a browser should look at:**

1. `src/pages/app/CareHome.tsx` ("Horse care") — button reads `+ Add New`, hover has no
   tooltip, `aria-label` computes to `"Add New horse"` (inspect via devtools
   Accessibility pane).
2. `src/pages/app/Admin.tsx` ("Clients") — same, `aria-label` = `"Add New client"`. Only
   renders when no client is selected (`!selected`) — check both list and detail states.
3. `src/pages/app/ops/DealsPage.tsx` ("Deals") — same, `aria-label` = `"Add New deal"`.
   Only renders when `rows.length > 0` — check both empty and populated states.
4. `src/pages/app/ops/HorseRecordsPage.tsx` ("Horse records") — same, `aria-label` =
   `"Add New horse"`. **This is the page name to check at the narrowest real viewport
   (320-375px) for the wrap-vs-overflow question in §4.**
5. `src/pages/app/ops/ContactsPage.tsx` — three modes (`directory` / `leads` /
   `contacts`), each with a different `aria-label`: `"Add New directory entry"`,
   `"Add New lead"`, `"Add New contact"`. Check all three tabs.
6. `src/pages/app/ops/DocumentsQueuePage.tsx` ("Documents") — casing-only change, button
   still reads `+ Add New` (was `+ Add new`), opens the same picker; picker heading now
   also reads `Add New`.

All six should show visually identical button width (`+ Add New` is the same string on
every one). None should show a hover tooltip anymore (removed `title`).

## 6. What I did not do

- Did not touch `AppLayout.tsx`, `DataTable.tsx`, or the documents queue table body.
- Did not touch `ClauseDocument.tsx` or `ContractCascade.tsx`.
- Deleted nothing.
- Did not decide the `PageCreateButton` question — reported it (§3) for the owner.

Applied to the worktree; not pushed, per constraint.
