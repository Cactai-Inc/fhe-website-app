# TASK TITLESWEEP — page-name eyebrows + conversational intros (owner spec 2026-08-05)

Branch `task/titlesweep`, own worktree (`wt-titlesweep`), off `origin/main` at
`800b352`. Pure copy pass — no layout/behaviour changes, no DB. `AppLayout.tsx`
and `ClauseDocument.tsx` not touched.

## Scope delivered

Extends TASK-PAGETITLES' model (gold eyebrow = page name; large dark-green
line = conversational message, never a label) to the nine pages I11 flagged
for owner ruling.

| Page | File | Change |
|---|---|---|
| Account | `AccountHub.tsx` | Eyebrow "Your account" → "Account". Intro "Account" → "Here's everything that's yours." |
| Support | `Support.tsx` | **No change** — eyebrow already renders "Support" (→ SUPPORT via `.eyebrow`), intro already "How can we help?" with the `LifeBuoy` icon. Matched spec as-is. |
| Schedule | `Schedule.tsx` | Eyebrow already "Schedule", unchanged. Intro "What's coming up." → "Here's what's coming up." |
| My Lessons | `MyLessons.tsx` | Eyebrow already "My Lessons", unchanged. Intro "Your lesson credits." → "Your riding, at a glance." |
| Gifts | `Gifts.tsx` | Eyebrow "My Gifts" → "Gifts". Intro "Gifts you can use." → "Gifts you've received — and given." (static both-direction line — see note below) |
| Horse care | `CareHome.tsx` | **No change** — eyebrow already "Horse care", intro already `Welcome, {first}` with the `Your horse care` fallback when no first name. Matched spec as-is. |
| Documents | `Documents.tsx` | Eyebrow "My Documents" → "Documents". Intro "Everything you've agreed to." → "Everything you've agreed to, all in one place." |
| My Posts | `MyPosts.tsx` | Eyebrow "Community" → "My Posts". Large title `<h1>My Posts</h1>` removed entirely; existing description line ("Review, edit, or delete anything you've posted.") kept unchanged. |
| Orders | `Orders.tsx` | Eyebrow "My Orders" → "Orders". Intro "Your purchases." → "Everything you've purchased." **Owner did not explicitly name Orders in the spec table — applied by pattern for consistency with the other list pages. Flagging prominently per the task doc's instruction; easy to revert (2-line diff) if vetoed.** |

## Gifts — both-direction line, detection not wired

The task doc allowed narrowing to a single-direction line ("Gifts you've
received." / "Gifts you've given.") only if detectable "cheaply... from data
already loaded." Checked: `Gifts.tsx` (the page/header) does not itself load
any gift data — the fetch (`listMyGifts()`, filtered into `received`/`given`
arrays) lives entirely inside the child `GiftsContent` component
(`src/components/app/GiftsContent.tsx`), which owns its own `useState`/
`useEffect`. Lifting that fetch (or its result) up to the page component to
drive the header would be a structural change, not a copy edit, and the doc
is explicit that structural work should be reported rather than done in this
pass. Implemented the static both-direction line only, as instructed as the
fallback.

**Flag for owner/future task:** if a single-direction header is wanted, it
requires either lifting the gift-direction data up to `Gifts.tsx` or passing
a callback down from `GiftsContent`, and the same `GiftsContent` component is
also reused inline on the Account page's expandable panel — so a fix here
should be designed for the shared component, not a one-off in `Gifts.tsx`.

## Rules honored

- No layout/behaviour changes — every edit is either a text-content swap
  inside an existing `<p className="eyebrow">...` / `<h1 className="heading-
  section"...>` (or page-specific equivalent) element, or (My Posts) removal
  of one `<h1>` element with no surrounding structural change.
- Existing eyebrow/heading CSS classes reused verbatim at every site — no new
  visual patterns introduced. `.eyebrow` already applies `uppercase`, so
  eyebrow values in code are written in the page's existing title-case
  convention (e.g. `"Account"`, `"My Posts"`) rather than hardcoded caps.
- Onboarding not touched (out of scope per doc).
- `AppLayout.tsx` / `ClauseDocument.tsx` not touched.

## Done-checks

- `npm run typecheck` — clean.
- `npm run typecheck:api` — clean.
- `npm run lint` — **36 warnings / 0 errors.** The task doc's stated baseline
  (29 warnings) is stale — verified by stashing this task's changes and
  re-running lint against unmodified `origin/main` (`800b352`): same 36/0.
  None of the 36 are in any file this task touched; warning count is
  unchanged by this pass.

## Not done / needs a real browser

All edits are code-complete but not visually verified in a running browser
(no dev server session run in this pass), consistent with how prior UI-copy
tasks in this tracker (I1–I11, K1–K5) have reported status. Every change here
is a plain string/element-removal edit inside markup that already rendered
correctly before this task, so visual risk is limited to the intended copy
changes.
