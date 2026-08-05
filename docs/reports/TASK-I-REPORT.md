# TASK I — USER-account nav & mobile UX pass (tracker I1–I5)

Branch `task/i-user-nav-ux`, own worktree off `origin/main`. All five items
touched the same file cluster as the doc predicted: `AppLayout.tsx` (all
five), `AccountPanels.tsx` (one found-during-verification fix for I2), and
`api.ts` + one new migration (I2's RPC). `ClauseDocument.tsx` was not
touched. Every done-check passes; every DB write is disclosed in §8.

## Orchestrator ruling applied mid-task (I5)

Mid-session the orchestrator corrected the I5 helper text from "expand" to
**"show"** ("shorter word, fits better") — the shared checkout's task doc had
already been updated; the worktree copy was re-synced from it before any I5
code was written, so the code below reflects "show"/"hide" throughout, not
"expand"/"hide".

## I1 — sidebar collapse toggle: staff/admin only

`ClientRail` (the USER/non-staff desktop rail) previously expanded on hover
and carried a pin toggle (`PanelLeft`/`PanelLeftClose`, "Keep open"/
"Collapse", `localStorage`-persisted) that let it shrink to a 56px icon
strip. Per the tracker's own wording ("removed entirely for USER accounts")
and the doc's "USER accounts get a fixed (non-collapsible) sidebar": removed
the pin/hover state, the toggle button, and every `open`-conditional render
branch. The rail is now `<aside className="... w-60">` unconditionally —
always the full 240px, no toggle anywhere on it.

Staff's own rail (the `showRail` `<aside>` in `AppLayout`) never had an
equivalent collapse control to begin with — it was already a fixed width.
So after this change **no account type has a sidebar-collapse toggle**,
which is the literal end state "staff/admin only" plus "removed entirely for
USER" reduces to here, since staff had none to begin with and gained none.

**Dead-code consequence, cleaned up as part of I1, not a separate redesign:**
`CommunityNav` had a `open?: boolean` prop and an `if (!open) {...}` branch
rendering a collapsed icon-only strip — the ONLY caller that ever passed
`open={false}` was `ClientRail` in its unpinned/unhovered state. Every other
caller (avatar dropdown ×2, staff aside, mobile drawer) never passed `open`
at all (always defaulted `true`). Removing I1's hover-collapse makes that
branch permanently unreachable, so the prop and branch are removed rather
than left as dead code.

## I2 — dynamic USER sidebar + avatar-menu links

### The RPC — `supabase/migrations/20260805030000_user_nav_presence.sql`

`my_nav_presence()` — `SECURITY DEFINER`, `STABLE`, returns `jsonb`
(matching the codebase's established single-status-object convention, e.g.
`my_wall_state()` — not `RETURNS TABLE`, so the frontend gets a plain object
back from `.rpc()`, no array-unwrapping). Read each page's own query before
writing the check, per the doc's instruction:

| key | mirrors | how |
|---|---|---|
| `orders` | `Orders.tsx` → `listMyOrders()` → `purchases` table, RLS-only (no explicit filter in the JS query) | Reproduced the RLS condition directly: `purchases_member_own_select` (`buyer_user_id = auth.uid() OR buyer_contact_id = current_contact_id()`) **AND** the restrictive `purchases_org_boundary` (`org_id = current_org()`) — both are needed since `SECURITY DEFINER` bypasses RLS entirely, so neither policy applies on its own inside this function. |
| `documents` | `Documents.tsx` → `myDocuments()` → RPC `my_documents()` (post-DOCVIS party-read scope) | `EXISTS (SELECT 1 FROM public.my_documents() LIMIT 1)` — calls the real function directly rather than reproducing its logic, so the two can never drift out of sync. |
| `stable` | Account page's Stable section → `listStableHorses()` → RPC `my_stable_horses()` | `EXISTS (SELECT 1 FROM public.my_stable_horses() LIMIT 1)` — locked design says "stable = `my_stable_horses()` scope", so this deliberately does **not** also check the Stable section's gear/supplies rows, even though the page itself shows those too. |
| `posts` | `MyPosts.tsx` → `feedMyPosts()` → RPC `feed_my_posts()` | **Not** called directly — `feed_my_posts()` returns a single aggregated `jsonb` array (`RETURNS jsonb`, `jsonb_agg(...)`), not a table, so `EXISTS(...LIMIT 1)` on it wouldn't short-circuit the way it does for the two `RETURNS TABLE` functions above. Reproduced its one-line `WHERE` clause instead: `EXISTS (SELECT 1 FROM feed_posts fp WHERE fp.author_id = auth.uid())` — byte-identical scope, cheaper. |
| `saved` | — | Hardcoded `false`. See next section. |

**Grants** — this project's `public` schema auto-grants `EXECUTE` on every
new function to `anon`/`authenticated`/`service_role` via a default
privilege (per-role, not just a `PUBLIC` grant — confirmed in
`TASK-C10-REPORT.md` §2, "Found and fixed mid-verification"). `REVOKE ALL
... FROM public, anon` alone would **not** remove it; the migration revokes
from `public, anon, authenticated` explicitly, then re-grants `authenticated`
+ `service_role`. Verified live post-apply:

```sql
SELECT
  has_function_privilege('anon', 'public.my_nav_presence()', 'EXECUTE') AS anon_can,
  has_function_privilege('authenticated', 'public.my_nav_presence()', 'EXECUTE') AS auth_can,
  has_function_privilege('service_role', 'public.my_nav_presence()', 'EXECUTE') AS svc_can,
  has_function_privilege('public', 'public.my_nav_presence()', 'EXECUTE') AS public_can;
```
```
 anon_can | auth_can | svc_can | public_can
----------+----------+---------+------------
 f        | t        | t       | f
```

### Judgment call, surfaced to the orchestrator before writing any migration code: "Saved Content" has no backing data model

`SavedPanel` (`AccountPanels.tsx`) rendered `SEED_SAVED` — four hardcoded
fake items ("Building an independent seat", "Antares saddle", etc.) — to
**every account**, unconditionally. No `bookmark`/`saved_item`/`favorite`/
`watchlist` table exists in any migration; the "Saved" account section has
never had real per-user data behind it. This directly conflicts with the
locked design's assumption ("saved = the saved/bookmarked-content table the
Saved page reads") and with the task's own hard rule that a nav link must
never appear when its page would render empty, and vice versa — there was
nothing real to check presence against, and the page wasn't even honestly
empty (it was showing fake content to everyone due to a second, independent
bug: `SavedPanel` skipped the `SEED_ENABLED` gate every other seed-fallback
section applies, e.g. `StableSection`).

Stopped and asked rather than deciding silently, since this affects what
ships in a production migration. **Orchestrator ruling**: hardcode
`saved=false` in `my_nav_presence()`, and fix the `SEED_ENABLED` gate in
`SavedPanel` in the same commit so the page stops showing fake content —
otherwise the (permanently hidden) nav link and the (never-empty) page would
contradict each other, which is exactly the hard rule this task is supposed
to protect. The real saved/bookmark feature is deliberately **not** built
here; it's back on the tracker as its own future item (not re-added to
Section I — that section is this task's scope, not the backlog).

`AccountPanels.tsx` diff: `SavedPanel` now computes `const items =
SEED_ENABLED ? SEED_SAVED : []` (mirroring `StableSection`'s existing
pattern) instead of reading `SEED_SAVED` directly — since `SEED_ENABLED =
false`, the section now correctly renders its empty state for real users.

### Wiring — three render sites, one shared active-match component

Route targets are the real routes in `App.tsx` — none invented:

| Link | Route | Why |
|---|---|---|
| Orders | `/app/orders` | Real dedicated route (`Orders.tsx`). |
| Documents | `/app/documents` | Real dedicated route (`Documents.tsx`) — **not** the Account page's separate "documents" section (which uses a different function, `listMySignableDocuments()`, an older path); the doc says use the page's real route, and Documents has one. |
| Stable | `/app/account?section=stable` | No dedicated route — only exists as an Account-page section (the `?section=` pattern A11 added). |
| My Posts | `/app/my-posts` | Real dedicated route (`MyPosts.tsx`). |
| Saved Content | `/app/account?section=saved` | No dedicated route — Account-page section only. |

Icons match what `AccountHub`'s own `Row` already uses for that destination
(`Boxes` for Stable, `Bookmark` for Saved, etc.) for visual continuity
between the nav and the Account page.

Wired into all three USER-visible nav surfaces:
1. **Desktop rail** (`ClientRail`) — appended after the existing QUICK list.
2. **Avatar dropdown** (header, non-admin branch) — dropdown-shaped (matches
   the existing QUICK buttons' full-width row style, not the rail's rounded
   inset style).
3. **Mobile drawer** (the in-content "Menu" button's overlay, non-staff
   branch) — this is the mobile presentation of the same rail content
   (`ClientRail` itself is `hidden lg:block`), so it gets the same five
   links.

One subtlety worth calling out: Stable and Saved both route to
`/app/account` with a different `?section=` each. `NavLink`'s built-in
`isActive` only compares `pathname`, so it would show **both** as "selected"
simultaneously whenever on `/app/account`, regardless of which section is
open. Wrote `PresenceLink` (plus a small `useActiveAccountSection()` hook,
mirroring the existing `useActiveCommunityView()` pattern for `?filter=`) to
compute active state itself instead of delegating to `NavLink`, so only the
genuinely-open section highlights.

`my_nav_presence()` is called once on `AppLayout` mount (`useNavPresence`,
gated `!isStaff`) and cached in state — matching the locked design exactly
("refresh on route change is NOT required — next mount picks it up").

## I3 — mobile close button + header padding

- Close control now reads **"Close"** (text first) with the `PanelLeftClose`
  icon after, per the doc's ordering.
- Larger hit target: `p-2` icon-only button → `pl-3 pr-3 py-2.5` text+icon
  button.
- Same darker-panel-shade treatment as I4 (`bg-cream-200`, dark green text)
  to mark the open menu as the active state.
- Header zone: `mb-2` (8px) → `pt-1 pb-4` (16px bottom) so the close control
  clears the Community Feed button below it, per the doc's specific
  complaint.

## I4 — selected-page indicator

Old: `bg-green-800 text-white` (dark-green fill, white text) at every
active-state render site. New: `bg-cream-200 text-green-800 font-medium` +
`ring-1 ring-inset ring-gold-400`.

- **`bg-cream-200`** — cream is the nav panels' own color family
  (`bg-cream-100` on `ClientRail`'s `<nav>` and the mobile drawer's
  `<nav>`); `tailwind.config.js`'s cream scale is `DEFAULT/50/100/200` — 200
  is the only darker step that exists, so nothing was invented.
- **`text-green-800`** replaces `text-white` — this directly fixes the
  doc's complaint ("small light text reads poorly... at mobile sizes"): dark
  text on a light fill instead of light text on a dark fill.
- **`ring-1 ring-inset ring-gold-400`** — matches the gold already used for
  the active-state icon (`text-gold-400`, unchanged). `ring-inset` (not a
  plain `border`) so it never expands the box outward — important for the
  avatar-dropdown's full-width rows, which have no side gutter to absorb an
  outer ring.
- Badge pills (`bg-white/20 text-white` when active vs `bg-gold-600
  text-white` when not) are now **always** `bg-gold-600 text-white` — the
  old active variant was designed for a white badge to sit legibly on a dark
  fill; now that the fill is light, that variant would be nearly invisible,
  and there's no longer a reason for two variants.

**Both variants, as the doc requires**, so the outline is a one-line revert
(left in a comment at `RailLink`, the canonical definition):
```
// ring variant (ships): 'bg-cream-200 text-green-800 font-medium ring-1 ring-inset ring-gold-400'
// fill-only revert:     'bg-cream-200 text-green-800 font-medium'
```
**Shipped WITH the ring.** Judgment call: `cream-200` (`#ede5d5`) sits very
close in lightness to `cream-100` (`#f5f0e8`) and the page's white content
area — both are pale neutral tones — so the fill alone read as a faint tint
rather than a clear "this is selected" signal reasoning from the hex values;
the ring gives it a definite edge. This is a visual call that ultimately
needs eyes on it in a browser (§9) — if it reads as too heavy in practice,
dropping to the fill-only variant is the one-line change above.

**Every render site found and updated** (grepped `bg-green-800` across the
whole file to enumerate, not just the two the B-task audit flagged — those
line numbers had drifted as expected):
1. `RailLink` (shared — staff aside, staff mobile groups, member mobile
   drawer, avatar-dropdown staff groups all render through this one
   component).
2. `MenuLink` (avatar-dropdown staff nav-group list).
3. `PresenceLink` (new, I2's five links).
4. `CommunityNav` parent row (`isAll`).
5. `CommunityNav` nested sublinks (`isActive`).
6. `ClientRail`'s inline QUICK `NavLink`.
7. Avatar-dropdown's inline I2 links.

`CommunityNav` is used by both staff and USER layouts (staff's rail also
shows "Community Feed" at the top), so this fix reaches staff nav too —
that's I4 requiring it, not extra restyling of staff/ops nav beyond what the
task allows.

## I5 — Community-feed expand affordance

The "right arrow" the doc means is `CommunityNav`'s sublink toggle: it used
to be a single `ChevronDown` rotated `-rotate-90` when collapsed (visually a
right-pointing chevron — the classic collapsed-chevron convention) and
un-rotated (pointing down) when expanded, no label. Replaced with an
explicit `ChevronDown`/`ChevronUp` pair plus a helper label, smaller than the
row's own text and in the app's `text-muted` class:
- Collapsed: `ChevronDown` + "show"
- Expanded: `ChevronUp` + "hide"

(Per the mid-session correction — see top of this report — "show", not
"expand".)

## Verification

### Done-checks
- `npm install` (fresh worktree).
- `npm run typecheck` — 0 errors.
- `npm run typecheck:api` — 0 errors.
- `npm run lint` — **0 errors, 29 warnings**, matching the documented
  baseline exactly. Both AppLayout-file warnings are pre-existing
  (`MANAGE_NAV`/`manageNavGroups` fast-refresh warnings, untouched by this
  task) — confirmed by reading those exact lines before trusting the count.

### `my_nav_presence()` live proof (all simulated sessions rolled back)

Simulation technique per prior reports: `SET LOCAL ROLE authenticated; SET
LOCAL request.jwt.claims = '{"sub":"<user_id>"}'` inside `BEGIN;…ROLLBACK;`.

**Dry run** (`BEGIN; \i <migration>; ROLLBACK;`) — `CREATE FUNCTION` /
`REVOKE` / `GRANT` × 2 all succeeded, `prosecdef=t` (SECURITY DEFINER),
`provolatile=s` (STABLE); rolled back, nothing persisted. **Applied for
real**: `psql -v ON_ERROR_STOP=1 -f
supabase/migrations/20260805030000_user_nav_presence.sql` — same four
statements, no errors.

**Positive — stable=true** (`cjzigs@icloud.com` test profile,
`user_id 0a7fc801-…`, owns/leases a horse — the same fixture DOCVIS used):
```
 current_contact_id = d99f1472-48b4-466e-aaa7-f76396745c17
 presence = {"posts": true, "saved": false, "orders": true, "stable": true, "documents": true}
```

**Negative — stable=false, documents also false** (`zz-test-buyer@example.invalid`,
a bare synthetic fixture never onboarded — `user_id aaaa1111-…-002`):
```
 presence = {"posts": false, "saved": false, "orders": false, "stable": false, "documents": false}
 my_stable_horses() direct EXISTS check = f   (independently confirms agreement)
```
This contact genuinely has zero rows in both `documents` and
`contact_required_documents` (checked directly) — not a bug, just an
unonboarded synthetic fixture. Since the doc's verification section
specifically asks for "documents true for both", found a second, properly-
onboarded negative-stable account:

**Negative — stable=false, documents=true** (`madelinedo@gmail.com`, has a
real document assignment, no horse):
```
 presence = {"posts": false, "saved": false, "orders": false, "stable": false, "documents": true}
```

Combined with the positive proof above: stable flips true/false correctly
across two real accounts, and documents reads true for both — matching the
doc's verification requirement exactly. All three blocks ran inside
`BEGIN;…ROLLBACK;`; nothing was written by any of them.

### UI — honestly browser-pending

No browser was opened this session (SQL + TypeScript only, verified via
typecheck/lint/live-psql). Everything above is "code-complete, browser
pending" — `BUILD_TRACKER.md` section I now says so per item, per the doc's
own instruction not to overclaim.

## Production writes (everything logged)

1. The one migration, `20260805030000_user_nav_presence.sql` — dry-run in
   `BEGIN;…ROLLBACK;`, then applied live via `psql -v ON_ERROR_STOP=1 -f …`
   (§ above). This is the only schema/function change.

Everything else against production was either read-only (`has_function_
privilege`, `pg_proc`, table-existence checks while investigating the Saved-
content gap) or ran inside `BEGIN;…ROLLBACK;` blocks that were rolled back —
zero residue, no data touched, no row inserted/updated/deleted anywhere.

## Honesty notes / known limitations

- **The `?section=` cross-page pattern has a pre-existing SPA quirk**,
  unrelated to this task: `AccountHub` reads `?section=` only in its
  `useState` initializer, which doesn't re-run on a query-string-only
  navigation while already mounted on `/app/account`. So if a USER account
  is already on the Account page (rail still visible on desktop) and clicks
  "Stable" while a different section is open, the URL and the nav's
  highlight both update correctly, but the visible panel may not switch
  without a fresh mount. This is a property of A11's already-shipped
  `?section=` pattern (confirmed pre-existing via `CalendarPage.tsx`, which
  already links to `/app/account?section=stable`), not something this task
  introduced or was asked to fix — noted for visibility, not fixed.
- **`saved=false` is permanent until a real feature is built** — this task
  deliberately does not create a saved/bookmark table. The Saved Content nav
  link will never appear until that's built as its own item.
- **The gold-ring vs. fill-only call for I4** (§ above) is a visual judgment
  from hex values, not a rendered screenshot — worth a look once the branch
  is viewable in a browser; the revert is one line if it reads wrong.
- Every command output quoted above is what psql actually returned against
  `db.lrstswfxfsezdmvkvukc.supabase.co` — nothing paraphrased from
  assumption.
