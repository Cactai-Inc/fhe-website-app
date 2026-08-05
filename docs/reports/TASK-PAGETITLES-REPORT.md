# TASK PAGETITLES — page title restructure + copy pass (owner spec 2026-08-05)

Branch `task/pagetitles`, own worktree (`wt-pagetitles`), off `origin/main` at
`1164cd2`. `AppLayout.tsx` and `ClauseDocument.tsx` not touched.

## Scope delivered

New app-wide default title model: a USER-facing page shows only the small
all-caps gold eyebrow by default; the large dark-green display line is no
longer a default title — it's an optional per-page intro. Applied to the four
named pages; no shared title component exists in the codebase (every page
hand-rolls its own header block from two CSS utility classes, `.eyebrow` and
`.heading-section`, in `src/index.css`), so each page was edited individually.

1. **Community Feed** (`Home.tsx`) — gold eyebrow now shows the view's title
   (`meta.title`, unchanged source). On the default/all view only: large
   dark-green intro "Welcome new members!", and the description below it
   replaced with the owner's exact new copy. Filtered views (Social,
   Discussions, For Sale, etc.) keep their own existing per-view description
   under the eyebrow, with no forced "Welcome new members!" line — the task
   doc's exact copy reads as specific to the all/default view, and nothing in
   the spec asked to change the other seven filters' copy.
   - Old tagline (shipped by TASK-UIPOLISH, `FEED_VIEW_META.all.description`
     in `seed.ts`) is now dead for the `all` view's render path (the new copy
     is written inline in `Home.tsx` instead of edited into `seed.ts`, since
     `seed.ts` is documented as temporary preview-only data and `.description`
     for `all` had exactly one consumer — confirmed by grep). Left `seed.ts`
     itself unedited to avoid scope creep on a file marked for deletion.
2. **Dashboard** (`DashboardHome.tsx`) — swapped: gold eyebrow "Dashboard"
   (renders DASHBOARD via the `.eyebrow` class's `uppercase`), large
   dark-green "Good {daypart}{, name}". Daypart now uses the existing
   **shared, owner-directed** `timeOfDayWord()` utility
   (`src/lib/formatDateTime.ts`, boundaries set 2026-07-22) instead of the
   page's own ad hoc 3-bucket inline calculation — `DashboardPanel.tsx`
   already used this same utility for its "Enjoy your {word}!" sign-off, so
   this also fixes a latent inconsistency where the page header and its own
   child panel computed time-of-day on two different bucket schemes.
   `timeOfDayWord()` has a fourth `'night'` bucket (21:00–03:59) the task's
   Morning/Afternoon/Evening spec doesn't cover; mapped `night → "Evening"`
   for the greeting since "Good Night" reads wrong as a page heading. First
   name source unchanged (`profile?.first_name || profile?.display_name`).
3. **Calendar** — no changes, per spec.
4. **Catalog** (`CatalogPage.tsx`) — swapped: gold eyebrow "Catalog", large
   dark-green "Shop". Description line under the header (services blurb) left
   as-is; task doc didn't ask to change or remove it.
   - **Imageless offering-card placeholder text removed.** `CoverPlaceholder`
     in `OfferingCatalog.tsx` no longer renders the `SWAP · {label} image`
     span (both call sites: category grid card + category modal header); the
     neutral green gradient/grain/border background is untouched. The
     component's now-unused `label` prop was dropped rather than left dead.
   - **"Transaction Assistance" → "Acquisition Assistance" — checked both
     possible sources, per the doc's instruction:**
     - `offerings` table (the actual purchasable SKU, `slug =
       'acquisition-assistance'`): live-queried production DB — **already**
       named "Acquisition Assistance" (seeded that way back in migration
       `20260713110000_acquisition_catalog.sql`). No write needed; confirmed,
       not assumed, via a live `SELECT`.
     - `service_types` table (the category card's `display_name`/
       `description`, code `HORSE_PURCHASE_ASSISTANCE`): **was** still
       "Transaction Assistance" (renamed to that by an earlier migration,
       `20260719114000_transaction_assistance.sql`). This is what the
       customer-facing catalog card and modal header actually render
       (`OfferingCatalog.tsx`'s `<h3>`/`<h2>` read `category.display_name`
       from `service_types`, not from `offerings`). **This one needed the
       write** — done, logged below.
     - Also fixed a third, non-DB, non-rendered reference for consistency:
       `SERVICE_TYPES` in `src/lib/serviceCatalog.ts` had its own hardcoded
       `label: 'Transaction Assistance'` for the same code. Grepped for all
       consumers of that table/lookup — none exist anywhere in `src/`, so
       this is dead code, but updated the string anyway since leaving a
       second, contradicting copy of the same label in the repo serves no
       purpose.

## Production DB write (exactly the one write authorized by the task doc)

```sql
UPDATE public.service_types
SET display_name = 'Acquisition Assistance',
    description = 'Full service assistance for acquisition and lease transactions.'
WHERE code = 'HORSE_PURCHASE_ASSISTANCE';
```

Executed directly against production (`lrstswfxfsezdmvkvukc`, connection
string from `.env.db`) and verified by re-`SELECT` immediately after — row
count 1, new values confirmed. Also captured as migration
`supabase/migrations/20260805180000_pagetitles_acquisition_assistance_rename.sql`
so the change is tracked in version control alongside the code change that
depends on it. No other tables/rows touched; the `offerings` row was read-only
verified, never written.

## Other pages still carrying a large dark-green title as their DEFAULT (owner ruling needed)

Per the new rule, a page's large dark-green line should only appear as an
optional per-page intro — not be the default title. These pages weren't in
this task's scope (only Community Feed / Dashboard / Calendar / Catalog were
named) but currently pair a small eyebrow with a large title as their
out-of-the-box default, same idiom as Catalog/Dashboard had before this pass:

| Page | File | Current eyebrow | Current large title |
|---|---|---|---|
| Account | `AccountHub.tsx` | "Your account" | "Account" |
| My Posts | `MyPosts.tsx` | "Community" | "My posts" |
| Documents | `Documents.tsx` | "Your documents" | "Everything you've agreed to." |
| Orders | `Orders.tsx` | "Orders" | "Your purchases." |
| Schedule | `Schedule.tsx` | "Schedule" | "What's coming up." |
| Support | `Support.tsx` | "Support" | "How can we help?" |
| My Lessons | `MyLessons.tsx` | "My lessons" | "Your lesson credits." |
| Gifts | `Gifts.tsx` | "Gifts" | "Gifts you can use." |
| Onboarding | `Onboarding.tsx` | "Onboarding" / "Welcome aboard" | "Nothing to do here." (+ others) |
| Horse-care home | `CareHome.tsx` | "Horse care" | "Welcome, {first}" / "Your horse care" |
| Acquisition/Deal home | `DealHome.tsx` | "Acquisition" | "Welcome, {first}" / "Your acquisition" |

None of these were touched — flagging per the task doc's instruction to note
which other pages still carry a large title so the owner can rule on them.
Several of these (Documents, Orders, Schedule, Support, My Lessons, Gifts) are
arguably fine as-is since their "large title" is really a page-specific
tagline, not a repeat of the eyebrow — same shape the new rule allows, just
always-on instead of conditional. Worth an explicit owner call on whether any
of these need to become conditional/removable too, or whether the new
default-title rule is meant to apply only to the four pages named in this
task.

## Done-checks

- `npm run typecheck` — clean (`node_modules` didn't exist in this fresh
  worktree; ran `npm install` first, no other issue).
- `npm run typecheck:api` — clean.
- `npm run lint` — 29 warnings / 0 errors, matches the stated baseline exactly
  (spot-checked: none of the 29 are in any file this task touched).

## Not done / needs a real browser

All four page changes are code-complete but not visually verified in a
running browser (no dev server session run in this pass) — CSS class names
(`.eyebrow`, `font-serif text-green-800 text-3xl font-semibold`) were reused
verbatim from the existing pattern at each site, so visual regressions should
be limited to the intended eyebrow⇄title swaps, but real-browser confirmation
is still outstanding, consistent with how prior UI-only tasks in this
tracker (I1–I10, K1–K5) have reported status.
