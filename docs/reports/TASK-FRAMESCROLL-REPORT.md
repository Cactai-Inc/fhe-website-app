# TASK FRAMESCROLL — report

**Status: root-cause fix built, applied, committed on `task/framescroll` (not pushed). Backstop specified, not applied — `AppLayout.tsx` is untouched. Wider audit done: 28 findings across `src/`, none fixed (none is owned by this task). All renders are NOT VERIFIED — no browser session was available.**

---

## 1. Root cause — verified against source, not assumed

The task doc's claim was checked line-by-line before writing any code:

- `src/components/ops/kit/DataTable.tsx:60` (pre-fix) was a bare `<table className="w-full text-left text-sm border-collapse">` — no ancestor of the `<table>`, down to `<main>`, set any `overflow-x`. Confirmed by reading the whole file (114 lines) before editing.
- `src/components/app/AppLayout.tsx:1470` is exactly `<main className="flex-1 min-w-0 px-4 sm:px-8 xl:px-12 pt-10 sm:py-9 pb-24">` — `min-w-0`, no `overflow-x`. Read directly, not inferred.
- `src/components/app/app-header.css:41-44` confirms `.oh-hdr { position: sticky; top: 0; z-index: 40; ... }`.
- `src/components/app/AppHeader.tsx:68` confirms `<header className="oh-hdr">` is the element carrying that class.
- Traced the JSX tree in `AppLayout.tsx`: `<AppHeader />` (~line 1309) and the `<div className="w-full max-w-[120rem] mx-auto flex">` wrapping the nav `<aside>`s and `<main>` (~line 1315) are **siblings** at the top level of the layout, both children of the same root. The header is not nested inside the scrolling flex row — it sits above it and scrolls with the document like everything else, which is exactly why a horizontally-widened document drags it sideways with the rest of the page.
- **21 direct JSX consumers of `DataTable`** were grepped (`grep -rl "DataTable" src --include="*.tsx"`) and confirmed against the task doc's list — all 21 match. Together with the `lib/ops/index.ts` re-export and the `portal/kit-contract.ts` contract test, that's the stated 23.
- Confirmed **no consumer pre-wraps `<DataTable>` in a scroll container**: `grep -B3 "<DataTable"` across all 19 non-DocumentQueueTable/non-HorseTable consumer pages found zero `overflow-` classes near the call site.

Root cause confirmed as stated. Built the fix described in the task doc.

---

## 2. The fix — `DataTable.tsx`

```diff
--- a/src/components/ops/kit/DataTable.tsx
+++ b/src/components/ops/kit/DataTable.tsx
@@ -1,4 +1,4 @@
-import type { ReactNode } from 'react';
+import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
 import { EmptyState } from './EmptyState';
@@ -44,6 +44,24 @@ export function DataTable<T>({
   emptyMessage,
   onRowClick,
 }: DataTableProps<T>) {
+  const scrollRef = useRef<HTMLDivElement>(null);
+  const [overflowing, setOverflowing] = useState(false);
+
+  useLayoutEffect(() => {
+    const el = scrollRef.current;
+    if (!el) return;
+    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth);
+    measure();
+    const ro = new ResizeObserver(measure);
+    ro.observe(el);
+    return () => ro.disconnect();
+  }, [rows, columns, rowActions]);
+
   if (loading) { ... }
   if (rows.length === 0) { ... }

   return (
-    <table className="w-full text-left text-sm border-collapse">
-      ...
-    </table>
+    <div
+      ref={scrollRef}
+      className="overflow-x-auto"
+      tabIndex={overflowing ? 0 : undefined}
+      role={overflowing ? 'region' : undefined}
+      aria-label={overflowing ? 'Scroll to see more columns' : undefined}
+    >
+      <table className="w-full text-left text-sm border-collapse">
+        ...
+      </table>
+    </div>
   );
 }
```
(Full diff is in the git history on this branch; this is the shape of it.)

The table gets a single wrapper `<div className="overflow-x-auto">`. Inside an `overflow-x: auto` box, the table's used width is still governed by its min-content columns (that mechanism is unchanged — it's *why* the table needs a scroll container at all), but now that overflow resolves against the wrapper's own scrollport instead of the document's, so the page itself never widens.

### Why the wrapper does not just naively `overflow-x-auto`

**Vertical clipping (checked, not assumed).** Per the CSS Overflow spec, once `overflow-x` is anything other than `visible`/`clip`, the browser forces the *used* value of `overflow-y` to `auto` if it was `visible` — you cannot keep one axis clipped/scrollable and the other genuinely `visible` at the same time. So the wrapper **does** become a vertical scroll container too, in the sense that anything overflowing it vertically would be clipped/scrollable rather than freely visible. I checked whether this can currently bite:

- Read all 21 consumer files' column `render` functions and every `rowActions` array for anything that escapes a row's box: dropdown menus, popovers, tooltips, custom comboboxes. Grepped for `Popover|Dropdown|Menu|Tooltip|Overlay|Portal|absolute|z-\[|z-50|Listbox|Combobox` (case-insensitive) across all 21 files. **Zero matches** — the only "dropdown" hits were a code comment in `IntakePage.tsx` about an unrelated page-level filter UI, not inside a `DataTable` cell.
- `rowActions` renders plain `<button>` elements inline in a `<td>` — no escaping content.
- Native `<select>` popups and the `title=` tooltip attribute are excluded from this concern by construction: browsers render both outside normal layout/painting (a "top layer" the CSS overflow property doesn't clip), so they wouldn't be affected even if a cell used them.

**Conclusion: nothing currently escapes a `DataTable` row, so the forced `overflow-y: auto` has no observable effect today.** This is a real constraint on the *component*, though, not a non-issue in general — I added a one-line code comment (`FRAMESCROLL: ...`) at the wrapper so a future author adding a popover/menu inside a `DataTable` cell has a pointer to why it would get clipped. I did not add any extra CSS to work around it (there is nothing to work around yet, and doing so speculatively would be exactly the kind of unrequested abstraction the task doc doesn't ask for).

**Keyboard reachability.** The wrapper gets `tabIndex={0}` **only** when a `ResizeObserver`-driven measurement (`scrollWidth > clientWidth`) proves the table is actually wider than its frame — `role="region"` and an `aria-label` go with it so a screen-reader user landing on the new tab stop knows why it's focusable and interactive, per the standard "scrollable region" pattern (a `tabindex="0"` + `role="region"` + accessible name wrapper, the same shape recommended in the W3C table-scrolling techniques). When the table fits, all three attributes are `undefined` (not rendered), so the other 22-ish pages where the table never overflows pick up **no new tab stop**. The check re-runs via `ResizeObserver` (an existing pattern in this codebase — `ContractDrawer.tsx:140` already uses it the same way) on the wrapper's own box, plus a `useLayoutEffect` dependency on `[rows, columns, rowActions]` so a data-driven width change (e.g. a `loading` → populated transition) re-measures without needing a window resize.

**`table-layout: fixed` — not used.** Confirmed by inspection: the diff adds no `table-layout` class anywhere. Out of scope, as instructed.

**Scrollbar policy — `auto`, never `scroll`.** The wrapper uses Tailwind's `overflow-x-auto` utility, which compiles to `overflow-x: auto`. No `overflow-x-scroll` anywhere in the change.

### T1 check — no arbitrary Tailwind values used, but verified anyway

The only class added is `overflow-x-auto` — a declared Tailwind core utility, not an arbitrary value, so T1 (arbitrary values silently emitting nothing) does not apply here by construction. Verified anyway, per the constraint to grep the built CSS:

```
$ grep -o '\.overflow-x-auto{[^}]*}' dist/assets/index-*.css
.overflow-x-auto{overflow-x:auto}
```

Also spot-checked `overflow-x-clip` and `overflow-x-hidden` (needed for the backstop reasoning below, §3) the same way, in a throwaway scratch file inside `src/` that was built once and then deleted before the real build — never committed:

```
$ grep -o '\.overflow-x-clip{[^}]*}\|\.overflow-x-hidden{[^}]*}' dist/assets/index-*.css
.overflow-x-hidden{overflow-x:hidden}
.overflow-x-clip{overflow-x:clip}
```

### Build/typecheck proof

- `npm run typecheck` — clean, no errors.
- `npx eslint src/components/ops/kit/DataTable.tsx` — clean, no warnings (including no `jsx-a11y` complaints about the conditional `tabIndex`/`role`).
- `npm run build:client` (`vite build`) — succeeds, CSS output confirmed above.
- `npm run build` (full pipeline, includes SSR prerender of the public marketing routes) **fails at the prerender step** with `Error: supabaseUrl is required.` — **this is a pre-existing environment limitation, not a regression.** Verified by `git stash`-ing this change and re-running `npm run build` against unmodified `origin/main` HEAD: identical failure, identical stack trace. No `.env` file exists in this worktree (nor in a sibling worktree checked for comparison) — the ops/app routes this task touches are explicitly excluded from prerendering anyway (`scripts/prerender.mjs` only prerenders `/`, `/about`, `/story`, `/shop`, `/faq`, `/ride`, `/membership`, `/lessons`, `/horse`, `/acquisition` — none of them render `DataTable`). `vite build` (the step that actually produces the CSS/JS this task changes) completes successfully.
- No test file references `DataTable` or `kit-contract` (`find src -iname "*.test.*" | xargs grep -l "DataTable"` → no matches), so there's no existing test suite this change could break.

---

## 3. The `<main>` backstop — specified only, NOT applied

**`AppLayout.tsx` is untouched in this branch.** `git diff --stat f4b84d0` (this branch's fork point off `origin/main`) touches only `DataTable.tsx` (74 insertions, 48 deletions) plus this report as an untracked addition — confirmed with `git status --short` showing exactly those two paths. (`origin/main` itself has since advanced past `f4b84d0` — `TASK-NAVMOTION` merged while this task was in progress — so a diff against the *current* `origin/main` HEAD would misleadingly include NAVMOTION's own `AppLayout.tsx`/`AppHeader.tsx` changes; the fork point is the correct baseline for what this task changed.)

### The exact one-line diff, for the orchestrator to apply at merge

```diff
--- a/src/components/app/AppLayout.tsx
+++ b/src/components/app/AppLayout.tsx
@@ -1470 +1470 @@
-        <main className="flex-1 min-w-0 px-4 sm:px-8 xl:px-12 pt-10 sm:py-9 pb-24">
+        <main className="flex-1 min-w-0 overflow-x-clip px-4 sm:px-8 xl:px-12 pt-10 sm:py-9 pb-24">
```

### The reasoning, proven against source

**Must be `overflow-x: clip`, not `overflow-x: hidden` — checked, not assumed:**

1. `overflow: hidden` (and `auto`/`scroll`) makes the element a *scroll container*. `position: sticky` resolves its stuck position against the nearest ancestor scroll container's scrollport, not the viewport. If `main` becomes a scroll container, any sticky descendant sticks relative to `main`'s box instead.
2. Whether that actually breaks anything hinges on whether `main`'s box **itself** moves with page scroll. I traced this: `main` is an ordinary block child of `<div className="w-full max-w-[120rem] mx-auto flex">` (`AppLayout.tsx:1315`), which has no `overflow`/`position: fixed` of its own — so the whole page (not `main`) is what scrolls vertically; `main`'s border box moves up the screen exactly in step with page scroll. A sticky descendant's containing scroll container in that case never has a *nonzero internal scroll offset* of its own (the container's own box is what's moving, not its content sliding inside it), so the browser's "am I past my sticky threshold" test relative to that container's scrollport is permanently satisfied at zero offset — the element just renders at its static in-flow position and scrolls away with the page like a normal element. That is the mechanism, worked out from the box model, not restated from the task doc.
3. Found the specific victim: `src/components/app/ContractSubheader.tsx:178` — `<div className="sticky top-[var(--cs-hdr-h)] z-30 ...">`. Traced its call site: `src/pages/app/ContractPage.tsx:1145` renders `<ContractSubheader ...>` directly in the page body, with **no** intervening `overflow`/`position` wrapper between it and `<main>` — confirmed by reading `ContractPage.tsx:1140-1230` directly, not by assumption. `ContractPage` is a route component reached via `<Outlet />`, which `AppLayout.tsx:1471-1473` renders directly inside `<main>`. So `ContractSubheader` is a genuine descendant of `main`, and `overflow-x: hidden` on `main` would silently un-stick it — the contract action bar would scroll away under the header instead of staying pinned, on every contract page.
4. Checked the two nav rails the task doc named as the contrast case: `AppLayout.tsx:880` (`ClientRail`'s `<nav className="sticky top-[var(--cs-hdr-h)] ...">`) sits inside an `<aside>` at `AppLayout.tsx:868`; `AppLayout.tsx:1338` (staff rail's `<nav>`) sits inside an `<aside>` at `AppLayout.tsx:1328`. Both `<aside>`s and `<main>` (`:1470`) are traced as direct siblings under the same `<div className="w-full max-w-[120rem] mx-auto flex">` (`:1315`) — confirmed by reading the indentation/JSX structure from `:1315` through `:1473`, not inferred. Neither `<nav>` is a descendant of `main`, so `overflow-x` on `main` cannot touch either rail regardless of `clip` vs `hidden`.
5. `overflow-x: clip` clips paint without making the element a scroll container. Per the CSS Overflow spec, the "if one axis is non-`visible`, the other's `visible` is coerced to `auto`" rule is specifically triggered by values *other than* `visible` **or `clip`** — `clip` is exempted alongside `visible`. So `main` with `overflow-x: clip` and no `overflow-y` set keeps `overflow-y: visible` for real (not coerced to `auto`), meaning `main` never becomes a scroll container on *either* axis, and the sticky-descendant problem in points 1-3 above cannot occur with `clip`.

**One more thing I checked, not in the task doc:** `src/index.css:41-58` shows the owner deliberately **removed** `overflow-x: clip` from `<html>` on 2026-08-08, with an explicit comment: *"Setting overflow on the root element disturbs SCROLL ANCHORING... If a child ever does overflow horizontally, clip it on THAT element rather than on the document root."* Two things follow from reading that comment against the mechanism above: (a) it directly instructs exactly what this backstop does — clip a scrolling *child*, not the root — so the backstop is consistent with a decision the owner already made, not a new pattern; and (b) because `overflow-x: clip` on `main` does not turn `main` into a scroll container (point 5), it does not reintroduce the scroll-anchoring regression the owner fixed on `<html>` — that regression was specifically about a scroll container's anchoring boundary, and `main` never becomes one under this change.

**I did not find a reason to recommend against the backstop.** The one-line diff above is safe by this analysis. It is still the orchestrator's call per the task doc.

---

## 4. Header reachability (§3 of the task)

With the `DataTable` fix in place, the only remaining way for the document to widen is one of the drivers audited in §5 below — and none of those are inside `DataTable`, so they're independent of this fix. I did not find, anywhere in the static audit, a case that would currently push the *document itself* wider than the viewport outside of `DataTable` (the widest independent risk — `ContractCascade.tsx:546`, driver 2 below — is a bounded 9rem+3×1fr+auto grid inside a `max-w-2xl` card, not literally unbounded). So: **the header should not currently be reachable by horizontal document scroll, on the pages audited.** This is a static conclusion, not a rendered one — see §6, nothing here was opened in a browser. `.oh-hdr` was not touched, and I did not consider changing it to `position: fixed` (the task doc's constraint against that is intact — untouched).

---

## 5. Confirmation the 21 consumers and `DocumentQueueTable.tsx` are unaffected

- `HorseTable.tsx` and `DocumentQueueTable.tsx` (the two components that themselves wrap `DataTable`, rather than pages calling it directly) were **read, not edited**. Neither adds its own `overflow`/scroll wrapper around `<DataTable>`, so there is no double-wrapping and no conflict with `TASK-DOCQUEUE`'s concurrent edits to `DocumentQueueTable.tsx` — confirmed by reading the file's current `DataTable` call site, not modifying it.
- All 19 remaining page-level consumers were grepped for pre-existing `overflow-` classes near their `<DataTable>` call site — none found, so none of them had a conflicting wrapper to reconcile with this change.

---

## 6. THE WIDER AUDIT — `src/` static sweep for the five named drivers

**Method:** parallel static sweeps across `src/components/**` (95 files), `src/pages/app/ops/*.tsx` (21 files), `src/pages/app/ops/**/*.tsx` subdirectories (28 files), `src/pages/*.tsx` + `src/portal/**` + `src/contexts/**` (32 files), and `src/pages/app/*.tsx` non-ops (29 files) — 205 files total, effectively all of `src/` outside `src/lib` (which is pure `.ts` logic, no JSX/layout, confirmed zero `.tsx` files in it). Every candidate grep hit was read in context (JSX ancestor chain, actual content bound to the element) before being reported — raw grep hits with no real overflow mechanism were discarded rather than reported as findings. I then independently re-verified 7 of the highest-confidence findings myself by reading the exact source lines and, for the CSS-grid finding, the compiled output — all 7 checked out exactly as reported (details inline in the table below).

**28 findings: 19 driver-1 (flex missing `min-w-0`), 3 driver-2 (fixed widths), 2 driver-3 (bad `whitespace-nowrap`), 4 driver-4 (unbroken strings), 0 driver-5 (escaping elements).** Driver 1 is the largest category by a wide margin, as predicted. Driver 5 (negative margins / `w-screen` / mispositioned `absolute`) turned up **zero** genuine findings anywhere in `src/` — every negative-margin hit was a deliberate padding-cancellation pattern (e.g. `ContractPage.tsx`'s `-mx-4 sm:-mx-8 xl:-mx-12` exactly cancels `main`'s own padding to bleed a banner full-width), and every `absolute`-positioned element had a correctly `relative`/`sticky`-positioned ancestor.

**None of these are fixed in this branch** — none is `DataTable.tsx` or the `<main>` backstop, so none is owned by this task. Ranked below, most-confident/highest-impact first within each driver.

| File:Line | Driver | Can it actually overflow? | Fix (not applied) |
|---|---|---|---|
| `src/pages/app/Admin.tsx:163-164` ✓verified | 1 | **Yes** — row is `flex justify-between gap-3`, value span has `truncate` but no `min-w-0`; `truncate` requires `min-w-0` on a flex child to do anything (`white-space:nowrap` alone just sets the item's intrinsic-width floor to the full text). One of the bound values is `p.email`, unbounded. Below `sm:` this is full document width. | Add `min-w-0` to the row `div` at line 163. |
| `src/components/feed/PostModal.tsx:330-337` ✓verified | 1 | **Yes** — `flex items-center gap-2` row renders `card.author` in a bare `<span>`, no `min-w-0`. `src/components/feed/CommunityFeed.tsx:203` renders the *identical* author-header shape but correctly wraps it `<div className="min-w-0">` — confirmed by reading both files; this is a miss of an established local pattern. | Wrap the author `<span>` in `<div className="min-w-0">`, matching `CommunityFeed.tsx`. |
| `src/pages/app/ops/superadmin/TenantDetailPage.tsx:175-179` ✓verified | 1 | **Yes** — `flex items-center justify-between` row, two `<span>`s, neither `min-w-0`; second span always renders `{a.email} · {role}`, unbounded. Not inside `DataTable` or `Modal`. | Add `min-w-0`+`truncate`/`break-all` to both spans. |
| `src/components/app/ContractCascade.tsx:546` ✓verified | 2 | **Yes** — `grid-cols-[1fr_1fr_9rem_1fr_auto]` is an arbitrary value; confirmed in the compiled CSS it emits literal `grid-template-columns:1fr 1fr 9rem 1fr auto`, **not** `minmax(0,1fr)`. Bare `1fr` tracks carry an implicit `auto` minimum in CSS Grid, so each of the 4 unguarded `<input>`s (co-owner name/phone/email fields) floors the row at its own intrinsic width. `ClauseDocument.tsx:577` uses `minmax(0,1fr)` for exactly this reason (own comment references a prior mobile-crush bug) — this is the same file family missing that established fix. | Wrap tracks: `grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,9rem)_minmax(0,1fr)_auto]`. |
| `src/components/app/ClauseDocument.tsx:606` | 2 | **Yes** — `repeat(auto-fill,minmax(17rem,1fr))`, 272px hard floor per column. **STOP-AND-PROPOSE per task constraints — not touched, reported only** (already flagged in the task doc itself). | Change to `minmax(min(17rem,100%),1fr)`. Needs owner sign-off — file is out of scope. |
| `src/components/order/OrderPayment.tsx:24-28,157-159` ✓ (pattern cross-checked against `Footer.tsx`) | 4 | **Yes** — `CopyRow`'s value `<span>` (renders `order.payment_reference`, a Zelle memo code) has no `break-all`, inside `flex justify-between`. `Footer.tsx` applies `break-all` to the same `BRAND.email` value — this instance lacks the equivalent guard. | Add `break-all` to the value span at line 28. |
| `src/pages/app/ops/admin/AdminRegistryPage.tsx:159-160` | 1 | Maybe — `flex items-end gap-3`, `flex-1` div (no `min-w-0`) renders raw `entry.key` (upper-snake registry key, e.g. `COMMISSION_PURCHASE_RATE` — underscore-joined, no break point) plus arbitrary per-module keys per the file's own comment. | Add `min-w-0` to the `flex-1` div, `break-all`/`truncate` on the key label. |
| `src/pages/app/ops/PaymentReviewPage.tsx:166-176` | 1 | Maybe — info `div` (no className) in a `flex items-start justify-between gap-4` row holds `parsed_sender` (a parsed email address, single unbroken token) and `raw_subject`, no `min-w-0`. | Add `min-w-0` to the info `div`, `break-words` on sender/subject. |
| `src/pages/app/ops/PaymentReviewPage.tsx:210-217` | 1 | Maybe — `<li className="flex items-center justify-between gap-4 py-2.5">`, amount/reference `div` has no `min-w-0`; `order.payment_reference` can be a long unbroken code. | Add `min-w-0` to the reference `div`. |
| `src/pages/app/ops/DealPage.tsx:281-287` | 1 | Maybe — activity `<li className="... flex gap-2">` (not wrapping), `flex-1` span (no `min-w-0`) can render underscored template keys like `HORSE_BILL_OF_SALE`. | Add `min-w-0` to the `flex-1` span. |
| `src/pages/ForgotPassword.tsx:41` (root: `src/components/auth/AuthLayout.tsx:22-23`) | 1 | Maybe — `AuthLayout`'s `flex items-center justify-center` centers a `w-full max-w-md` div with no `min-w-0`; the "sent" state renders the entered `{email}` raw. Every password-reset submission hits this exact structure. | Add `min-w-0` to `AuthLayout`'s `max-w-md` wrapper, or `break-all` on the email. |
| `src/pages/Register.tsx:269` (+274, 282) | 1 | Maybe — same `flex items-center justify-center` → `max-w-md` (no `min-w-0`) shape, renders `invitation?.email` raw twice. Primary invite-activation screen every new member hits. | Add `min-w-0` to the `max-w-md` div, or `break-all` on the email spans. |
| `src/pages/RegisterComplete.tsx:157` (+162-163) | 1 | Maybe — same shape, two raw emails inline in body text; only hit on a Google-account-mismatch edge case. | Add `min-w-0`, or `break-all` on the two email spans. |
| `src/pages/app/ops/superadmin/TenantDetailPage.tsx:107-108` | 1 | Maybe — `flex items-start justify-between gap-4`, unlabeled div holding `org.name`/`org.slug`, no `min-w-0`. Names/slugs usually have break points, but not guaranteed. | Add `min-w-0` to the wrapping div. |
| `src/components/app/StableSection.tsx:101` | 1 | Maybe — gear-vendor `<a>` is `shrink-0` with no `truncate`, sibling correctly has `min-w-0`. Vendor names are usually short brand names. | Add `truncate max-w-[8rem]`, or drop `shrink-0`. |
| `src/components/app/StableSection.tsx:119` | 1 | Maybe — identical pattern, supplies-vendor link. | Same fix as line 101. |
| `src/components/ServiceSelector.tsx:93-94` | 1 | Maybe — `flex items-start justify-between gap-3` row, `o.name` (admin/catalog-entered, can be long) in a bare span next to a fixed `w-4 h-4` radio. Cards are 1-up on mobile. | Add `min-w-0` to the name span. |
| `src/pages/app/ops/admin/AdminBrandingPage.tsx:215` | 4 | Maybe — `logoPath` (`${orgId}/${file.name}`) in a plain `<code>`, not in a flex row; filename after the `/` (e.g. `CompanyLogoFinalVersion2024.png`) has no reliable break point and nothing clips it. | Add `break-all` to the `<code>`. |
| `src/pages/SignStart.tsx:74-76` | 4 | Maybe — plain (non-flex) `<p>{brand.email} · {brand.phoneDisplay}</p>`, no `break-words`. `brand.email` is org-configurable (whitelabel), so not literally unbounded. | Add `break-all` to the `<p>`. |
| `src/components/feed/PostModal.tsx:276` | 1 | Maybe, lower risk — `inline-flex items-center gap-2` row renders `card.location` as bare text, no `min-w-0`. Addresses are usually short. | Wrap in a `min-w-0` span, or allow normal wrap. |
| `src/pages/app/MemberProfile.tsx:85-88` | 1 | Maybe, low — `flex items-center justify-center gap-2` renders `h.name` (horse name, free text) in a bare span. Horse names are normally short and space-separated (default wrap applies), so only an unusually long single-word name would actually force it. | Add `min-w-0`/`truncate`, defensively. |
| `src/pages/app/ops/SupportPage.tsx:80-84` | 1 | Maybe, low — `flex items-start justify-between gap-3 mb-1`, `<p>` holding `r.subject` (free-typed) has no `min-w-0`/`truncate`; usually short prose. | Add `min-w-0 truncate` (or `break-words`). |
| `src/pages/app/ops/DocumentViewerPage.tsx:156-159` | 1 | Maybe, low — `flex items-center justify-between gap-4`, `<h1>` holding `document.title` has no `min-w-0`/`truncate` — unlike `DealPage.tsx`'s comparable title `<h1>`, which does have `truncate`. | Add `min-w-0 truncate` to the `<h1>`. |
| `src/pages/app/Account.tsx:96-99` | 1 | Maybe, low — `flex items-start justify-between` row, plain div holds `<h1>Welcome, {greetingName}.</h1>` where `greetingName` is free-text `profile.first_name`, no length validation. | Add `min-w-0` to the greeting div, or `truncate` the `<h1>`. |
| `src/components/app/ContractCascade.tsx:436-438` | 3 | Yes, structural (fixed hardcoded label, not data-driven) — `RevealText`'s row pairs a `whitespace-nowrap` label (~45 chars) with an `input` floored at `min-w-[8rem]`; combined minimum exceeds a 320px column deterministically. | Drop `whitespace-nowrap` on the label, or make the row `flex-wrap`. |
| `src/components/app/ClauseDocument.tsx:561` | 3 | Maybe — matrix-cell label `whitespace-nowrap`, labels can run ~40 chars per an inline comment, sits inside the driver-2 `minmax(17rem,1fr)` grid above. **Same STOP-AND-PROPOSE file — reported only.** | Drop `whitespace-nowrap`, or cap/truncate long labels. Needs owner sign-off. |
| `src/components/app/InvitationHistoryPanel.tsx:155` | 2 | Maybe — `min-w-[16rem]` (256px) floor on an activation-link `<code>` in a `flex flex-wrap` row; wrap prevents dragging siblings, but the element itself is close to that floor on a ~320px viewport. `break-all` is already present on the text. | Reduce the floor (e.g. `min-w-[12rem]`), or drop it in favor of `w-full` on wrap. |
| `src/components/ops/documents/DeliveryPanel.tsx:298-300` | 4 (+1) | Maybe — `<li className="flex items-center justify-between ...">` shows a raw 36-char UUID in a `font-mono` span, no `min-w-0`/`break-all`. UUID hyphens are a recognized line-break opportunity in default text layout (most engines wrap on them without help), so this is relying on implicit behavior rather than an explicit guard. | Add `break-all` (or `min-w-0`) so it doesn't depend on implicit hyphen-wrap. |

**Swept clean, no findings:** all of `src/components/ops/**` (including `DataTable.tsx` itself, post-fix), `AppLayout.tsx`'s nav/header subtree, `HorseTable.tsx`/`DocumentQueueTable.tsx` (consume the fixed `DataTable` correctly), `Header.tsx`/`Footer.tsx` (public chrome — already `break-all` on the email), `CommunityFeed.tsx` (the reference-correct pattern cited above), `CalendarPage.tsx` (its one fixed-width grid is already `overflow-x-auto`-wrapped, matching the `DataTable` fix's own pattern), `ContractPage.tsx` itself (independent of the `ClauseDocument.tsx` findings — ~34 flex rows checked, all with genuinely unbounded content are already `min-w-0`/`truncate`/`shrink-0`-guarded), `Onboarding.tsx`'s horse-picker rows (correctly `min-w-0`-guarded, verified directly), `Messages.tsx` (message-bubble overflow is contained by its own `overflow-y-auto` list, matching the excluded-modal-body pattern), and roughly 170 other files with no qualifying hits. Full per-directory file lists are in the sub-audit transcripts if a future thread wants them; omitted here to keep this table the deliverable rather than a file census.

---

## 7. Verification status — **NOT VERIFIED**

No staff browser session exists in this environment and none was made available. Every claim about rendered behavior above is a static, source- and compiled-CSS-level analysis (`npm run build:client` + grepping the emitted `dist/assets/index-*.css`), not a screenshot or a live DOM measurement. Treat every "yes"/"maybe" verdict in §6 and every mechanism claim in §3 as **NOT VERIFIED in a browser** until someone opens these pages.

### Checklist for the owner (or next thread) to actually verify in a browser

1. **Documents page** (`/app/ops/documents` — wherever `DocumentQueueTable` mounts), desktop width (~1440px): the row set should now be wide enough to require scrolling. Confirm the **table scrolls horizontally inside its own card**, the app header stays fixed and fully visible including its right edge, and the page itself does not gain a horizontal scrollbar.
2. **Same page, ~375px (mobile) width**: confirm the table still scrolls in-frame, not the page; confirm no vertical clipping of any row content (there shouldn't be any escaping content per §2, but confirm).
3. **Same page, keyboard only**: Tab through the page. When focus reaches the table wrapper (only if it's actually overflowing at your viewport width), confirm you can scroll it with arrow keys and that a visible focus ring appears on the wrapper. At a viewport width where the table fits, confirm Tab does **not** stop on the table at all (no dead tab stop).
4. **Any of the other 20 ops pages listed in §5** with enough columns to overflow at your viewport (`AdminProductsPage`, `StaffPage`, `OrganizationsPage` are good bets) — same three checks as #1.
5. **A contract page** (`/app/contracts/:id`) with the change-requests/comments bar visible: scroll the page vertically and confirm `ContractSubheader` (the drawer button bar) **stays pinned under the app header** — this is the sticky element the backstop reasoning in §3 depends on; it should behave identically whether or not the backstop is applied (the backstop is a horizontal clip and shouldn't touch vertical sticky behavior at all, but confirm).
6. **After the orchestrator applies the `<main>` backstop diff from §3**: repeat #5, plus open a page with one of the two nav rails visible (any `/app/*` page, desktop width) and confirm the rail is still sticky/pinned — it should be unaffected since it's a sibling of `main`, not a descendant, but confirm.
7. **`Admin.tsx` "Overview" panel** (superadmin/staff org detail view) with a long email in the profile pairs grid: confirm whether it currently overflows the page (driver-1 finding, §6) — this one is left unfixed and ranked, so confirming it reproduces would help the next thread prioritize.

---

## 8. Constraints — compliance

- Worktree `~/Downloads/claude-code-repo/wt-framescroll`, branch `task/framescroll`, branched off `origin/main` (this repo's `origin/main` had advanced to `f4b84d0` by the time this task started; `3d6663b`, the commit named in the task doc, is an ancestor of it — confirmed with `git merge-base --is-ancestor`). Nothing touched outside this worktree. Not pushed.
- Only `src/components/ops/kit/DataTable.tsx` was edited (plus this report). `AppLayout.tsx` was read but never written to — `git diff --stat f4b84d0` (this branch's fork point) proves it; see §3 for why the fork point, not current `origin/main`, is the right comparison.
- `ClauseDocument.tsx` was read (for the audit) and never written to.
- `DocumentQueueTable.tsx` was read (for §5) and never written to.
- Nothing was deleted.
- T1: only one class was added to the actual fix (`overflow-x-auto`, a declared core utility) and its emission was grepped out of the built CSS (§2). `overflow-x-clip`/`overflow-x-hidden`, needed only for the backstop's reasoning, were verified the same way via a throwaway scratch file that was deleted before the final build — not part of the committed diff.
- Applied, not held: the `DataTable.tsx` fix is committed on `task/framescroll`.
