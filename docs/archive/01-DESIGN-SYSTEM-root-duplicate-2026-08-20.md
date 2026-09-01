# FHE UI SYSTEM — the standard every surface builds to

**Status: proposed, awaiting owner sign-off. Version 1, 2026-08-20.**
**Consumed by:** every UI task spec, and shipped into the repo as `.claude/skills/fhe-ui/SKILL.md`
so every build thread inherits it automatically.

The brand layer is settled and inherits untouched: the green/gold/cream token set, the
compensated-glass method, Libre Caslon + Inter, the opacity and motion tokens, the semantic text
classes, and the rem root-scaling ladder in `index.css`. Nothing below redesigns those. What has
never existed is the layer above them — how a page is assembled — and that absence is measured:
943 arbitrary bracket values across pages and components, `PageHeader` imported by 1 of 117 page
files, and a kit (`components/ops/kit`) used by some ops pages and nothing else. This document is
that missing layer.

---

## 1. The three laws

**L1 — No page invents layout.** Every page is a composition of the primitives in §4. A page file
contains content, data wiring, and primitive composition — never a hand-rolled grid, never a
bespoke header row, never local spacing decisions.

**L2 — No arbitrary values.** Bracket syntax (`w-[347px]`, `top-[13%]`, `duration-[320ms]`) is
banned in page and component code. If a value is needed, it is added to the theme as a named token
first. Enforced by lint (see §9) — this codebase has shipped silent no-op CSS twice from exactly
this syntax.

**L3 — Width responds to content, not to device names.** Layout adapts through fluid primitives —
auto-fit grids, clamp() type, flex wrap, container queries — not through per-page `md:`/`lg:`
overrides. The only viewport breakpoints in the app are global: the root font ladder (already in
`index.css`) and the nav collapse. A page that needs its own breakpoint is a page using the wrong
primitive.

---

## 2. Spacing and rhythm

One scale, rem-based so the root ladder scales it on large displays. Tailwind's default 4px scale
is kept; what is new is the **rhythm tokens** — named roles pages must use instead of raw numbers:

- `space-page` — outer page padding: `clamp(1rem, 3vw, 2.5rem)`
- `space-section` — vertical gap between sections: `2.5rem`
- `space-block` — gap between blocks inside a section: `1.25rem`
- `space-tight` — related elements (label→input, icon→text): `0.5rem`
- `space-inline` — horizontal gap in toolbars and chip rows: `0.75rem`

Declared in `tailwind.config` under `spacing` as `page/section/block/tight/inline`. Rule of use:
a page file may use rhythm tokens and nothing else for macro spacing; micro spacing inside a
primitive belongs to the primitive.

Content measures: `measure-prose` 65ch (documents, descriptions), `measure-form` 40rem (single
column forms), `measure-full` none (tables, calendar). Every page declares one via its shell.

## 3. Type roles

Six roles, mapped once, used by name. No page sets a raw text size.

- `type-display` — Caslon, clamp(2rem, 4vw, 3rem), heading leading. Landing/marketing only.
- `type-title` — Caslon, clamp(1.5rem, 2.5vw, 2rem). The page title line in PageHeader.
- `type-eyebrow` — Inter 500, 0.75rem, tracked-wide, uppercase, gold-ink. Page name / section labels.
- `type-section` — Inter 600, 1.125rem, green-900. Section headings inside pages.
- `type-body` — Inter 400, 1rem, leading-body, text-secondary.
- `type-caption` — Inter 400, 0.8125rem, text-muted. Metadata, helper text, timestamps.

Text on wrapping: headings and cell text use `text-wrap: balance` / `pretty`; truncation is opt-in
per cell with a title attribute, never the default. The "wrapping when there's plenty of room"
complaint is L3 + this rule: fixed-width columns are banned, minimum-content widths are the norm.

## 4. The layout primitives

The complete set. Built once in `src/ui/` (new home; the ops kit's DataTable/Modal/FormField/
EmptyState migrate in and generalize — they are incumbents to improve, never to duplicate).

**AppShell** — already exists as AppLayout; retained, re-skinned, nav from §IA. Owns the only
viewport breakpoint (rail ↔ sheet).

**Page** — the shell of every routed surface. Props: `name` (eyebrow), `title`, `description?`,
`actions?` (slot, right-aligned, bottom-aligned per the settled PageHeader ruling — "+ Add New"
uniform), `measure`, `children`. Absorbs `PageHeader` and makes it structurally unavoidable: the
Page primitive renders it, so "imported by 1 of 117" cannot recur.

**Section** — titled block inside a Page: `label?` (eyebrow style), `children`, optional
`aside` slot. Provides section rhythm.

**CardGrid** — `repeat(auto-fit, minmax(var(--card-min), 1fr))`, card-min per variant (stat 11rem,
record 16rem, module 20rem). Never a column-count prop. This single primitive replaces most
`grid-cols-1 md:grid-cols-2 lg:grid-cols-4` hand-rolls in the codebase.

**FormGrid** — CSS grid, `auto-fill, minmax(14rem, 1fr)`; a field can span via `wide`/`full`.
Labels above inputs always. Pairs with the existing FormField (kept, generalized).

**Toolbar** — filter/search/action row above tables and lists: wraps, never scrolls horizontally,
`space-inline` gaps. Owns the FilterChip and SearchInput.

**Table** — DataTable v2. Column model gains `priority: 1|2|3` and `min` (ch units). Narrow
containers drop priority-3 columns into an expandable row detail (chevron), then priority-2 —
container-query driven, so the same table is correct in a drawer and full-bleed. Row actions
become an overflow menu past two. Keeps loading/empty wiring. This is the CRUD workhorse: list
surfaces are Table + Toolbar + Page and nothing else.

**RecordList** — the card alternative for person/horse-shaped rows on narrow containers; Table and
RecordList consume one column model so pages define columns once.

**DetailDrawer** — right-side panel, 440ms glide, for row inspection and inline edit. Standard
width `min(28rem, 100vw)`. Replaces the ad-hoc modals-for-everything pattern; Modal is reserved
for interruptions (confirmation, capture) not for reading.

**Commit** — the D19 primitive; §6.

**StatusChip** — renders a `status_events_vocab` code with its display label and tone. Bound to
vocabulary; free-text status strings in JSX are a lint error. Fixes the writer/reader drift class
(X8) at the display layer.

**LedgerList** — a timeline renderer for the read-back surfaces (§7): rows of
{when, actor, what, reference-link}, virtualized past 100. One component answers X3 everywhere.

**EmptyState / ErrorState / ForbiddenState / Skeleton** — the four non-content states, one look.
Every async surface renders exactly one of: Skeleton, ErrorState (with retry), EmptyState (with
the one action that fills it), ForbiddenState (module gate — absorbs ModuleGate), or content.
"Empty is not a finding" becomes literal: EmptyState copy states what will appear here and how.

**Toast** — kept from kit; gains an `undo` slot (§6).

## 5. Interaction states

Every interactive element has all five, from tokens: rest, hover (green-800/66 rule and navfill
math inherited), focus-visible (2px gold-600 ring, offset 2px — keyboard parity is not optional),
active, disabled (opacity-50 + cursor). Motion: 320 glide for color/fill, 440 glide for panels,
`prefers-reduced-motion` collapses both to 0 — currently unhandled anywhere, now handled once in
the primitives.

## 6. Commit — the D19 pattern, extracted not invented

Source of the pattern: `ContractPage` (5 confirm sites, 59 reason/note sites, withdraw/reopen/
decline paths) and `DealPage` (`voidDeal`). Codified as one component + one rule.

Tiers (adopting the orchestrator's recommendation, pending your ruling — see rulings file):

- **Tier 1 — moves money, credits, documents, or a person's status.** All four: the Commit dialog
  states the exact effect in one sentence before acting ("This debits 1 credit from Client A's
  October allotment"), requires a reason (select from vocabulary + optional note), shows the
  reference it will record (booking, purchase, document — a chip, linked), and on success raises a
  Toast with the reversal action when a named engine reversal exists (`_refund_booking_credit`,
  `voidDeal`, withdraw). No reversal RPC → the dialog says "This cannot be undone."
- **Tier 2 — reversible configuration** (rename, toggle, reorder): confirmation only, inline,
  no reason field. The undo is the toggle itself.
- **Tier 3 — additive content** (notes, posts, messages): no dialog; Toast confirms, edit/delete
  is the undo.

Hard rule riding on it: **Commit's action prop takes an ENGINE-RPC.** The component's type
signature refuses a raw table write — D18 enforced at the seam where it was violated. The 76
raw-write functions in `src/lib/` get triaged in the sequence doc: each becomes an RPC call, is
blessed as legitimately raw (pure content tables), or dies.

## 7. The answerability surfaces (X3)

Not a component — a required placement, stated here because every area spec cites it:

- **Contact timeline** — a tab on every contact/client dossier rendering LedgerList over
  `notifications` + `document_deliveries` + `status_events` + `audit_logs` filtered to that
  person, merged and time-ordered. This is the literal answer to "what is she seeing."
- **Send log** — every surface that triggers mail shows its per-attempt outcome rows inline
  (the `receipt_sends` pattern), never fire-and-forget.
- **Obligation ledger** — fulfillment units get a routed home (Money area) rendering LedgerList
  over `fulfillment_units` + `status_events`.

## 8. CRUD standard

Every record surface, uniformly: list (Table/RecordList + Toolbar), create ("+ Add New" →
DetailDrawer form), inspect (row → DetailDrawer), edit (inline in drawer, `assertWrote` on every
write), archive not delete (D11/D15 — the destructive verb is "Archive," it is Tier 2, and
archived rows are one filter away, never gone), bulk select where the list exceeds a screen.
A tab or page shipping with fewer than these is not done — the "virtually no CRUD in Records"
state becomes structurally impossible because the record surface is one composition, written once.

## 9. Enforcement

- ESLint: ban bracket-arbitrary Tailwind values; ban `.insert/.update/.delete/.upsert` outside
  `src/lib` engine wrappers; ban raw status strings where StatusChip applies.
- Build check: grep the compiled CSS for every token class added in a diff (the T1 rule, automated).
- The fhe-ui skill carries §1–§8 plus the component APIs, so threads load the system instead of
  specs restating it.
- Acceptance rider on every UI task: composes primitives only · zero arbitrary values · all five
  interaction states · one of the four non-content states wired · Commit tier declared for every
  mutation · reach stated (D17) · `npm run typecheck && lint` clean.
