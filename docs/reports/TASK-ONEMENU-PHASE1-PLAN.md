# TASK ONEMENU — Phase 1 plan

Branch `task/onemenu`, own worktree (`fhe-worktree-onemenu`), off `origin/main` at
`b8b078a`. **No code changed in this pass** — this is the plan the task doc asked for.
`TASK-NAVFIX-drawer-polish.md` no longer exists in the repo (confirmed via search) — the
supersession is already complete on disk, not just declared. `ClauseDocument.tsx` was not
opened; nothing in AppLayout/CardstockHeader references it.

Files read in full: `src/components/app/AppLayout.tsx` (1083 lines), `CardstockHeader.tsx`,
`header-cardstock.css` (506 lines). Line numbers below are from that read and drift a
little from the task doc's own approximations (doc ~1024 for the Close button is 1033
here, etc.) — citing the numbers I actually saw rather than reconciling them.

---

## A1 — confirming Option B

Recommendation stands, and it holds up against the code, not just the reasoning already
in the doc. One finding worth flagging: the chevron's rotate-180-on-open mechanism
(`.cs-arrow` / `.is-open .cs-arrow { transform: rotate(180deg); }`, `header-cardstock.css`
374–384) is direction-agnostic — it doesn't encode "left edge" anywhere. Mirroring the tab
only requires changing **position** (`left:0` → `right:0`), **slide direction**
(`translateX(min(288px,85vw))` → `translateX(-min(...))`, since the tab now needs to travel
left to reach the drawer's edge) and the **corner radius** (`0 10px 10px 0` → `10px 0 0
10px`, so the tab still looks cut from the edge it now hangs off). The arrow's own rotation
CSS can very likely be reused unchanged. I did not hand-verify which way the un-rotated
chevron actually points from the CSS alone (two 45°-rotated segments pivoting on
non-coincident right-anchors — the geometry doesn't reduce to an obvious "<" by inspection,
and I'm not going to assert a direction I only half-trust). Phase 2 should screenshot the
closed state and confirm it reads as **left**-pointing per A1's spec before relying on
"no change needed."

---

## A2 — the avatar-menu migration list

The starting table in the doc undercounts the real gap. The avatar dropdown's content
**differs by role** (member vs. instructor vs. admin take different branches in
`AppLayout.tsx` 733–813), and the mobile drawer's current content also differs by role
(`ClientNavItems` for members, `RailLink`×2 + `navGroups` for staff) — so "does X belong,
and where" has a different answer per role, not one universal answer. Table below marks
each item **DUP** (already reachable in that role's current drawer — dropping it loses
nothing) or **NET-NEW** (only reachable via the avatar menu today — must land somewhere in
the merged drawer or it's lost).

| Item | Destination | Member | Instructor (staff, !admin) | Admin (staff) |
|---|---|---|---|---|
| Name header (`{name}`, line 735) | — (static) | not present today | not present today | not present today |
| Account (`MenuLink`, line 736) | `/app/account` | **DUP** (`AccountNavLink`, canonical order, last) | **NET-NEW** — staff drawer has no personal Account link anywhere | **NET-NEW** — same gap |
| "Pending agreements" (admin only, 741–745) | `/app/ops/documents` | n/a | n/a | **DUP** — identical route, no query params, to Management group's existing "Documents" item. Confirmed by reading the `onClick`, not assumed. |
| Company "Quick access" › CommunityNav (749) | — | n/a | n/a | **DUP** |
| Company "Quick access" › Dashboard (750–754) | `/app/dashboard` | n/a | n/a | **DUP** (hardcoded `RailLink` already in staff drawer) |
| Company "Quick access" › Catalog (755–758) | `/app/catalog` | n/a | n/a | **NET-NEW** — Catalog is nowhere in `MANAGEMENT_GROUP`/`ACCOUNTS_GROUP`/etc. |
| Client "Quick access" › CommunityNav (765) | — | **DUP** | **DUP** | n/a (admin takes the other branch) |
| QUICK: Dashboard (766–777) | `/app/dashboard` | **DUP** | **DUP** | n/a |
| QUICK: Calendar | `/app/calendar` | **DUP** | **DUP** (hardcoded `RailLink`) | n/a |
| QUICK: Catalog | `/app/catalog` | **DUP** | **NET-NEW** | n/a |
| QUICK: Messages | `/app/messages` | **DUP** | **NET-NEW** — and note, admins never got this link even in the old dropdown (asymmetric — see note below) | n/a |
| navLinks: Orders/Documents/My Posts (presence-gated, 779–788) | various | **DUP** (same presence gate as `ClientNavItems`) | n/a — presence hook is disabled for staff (`useNavPresence(!isStaff)`), so this list renders empty for staff regardless | n/a |
| navLinks: **My Stable** | `/app/account?section=stable` | **DUP** | n/a | n/a |
| navLinks: **Saved Content** | `/app/account?section=saved` | **NET-NEW** — see callout below | n/a | n/a |
| `navGroups` (staff management sections, `lg:hidden`, 791–802) | various | n/a | **100% DUP** — identical `navGroups.map` already renders in the drawer | **100% DUP** |
| App tour (803–807) | opens modal | **NET-NEW** | **NET-NEW** | **NET-NEW** |
| **Sign out** (808–811) | `handleSignOut` | **NET-NEW — the only path** | **NET-NEW — the only path** | **NET-NEW — the only path** |

### Two gaps the starting table didn't name

- **Staff have no personal Account link in the mobile drawer today, at all.** The
  `!showRail` branch (members) ends in `AccountNavLink`; the `showRail` branch (staff)
  goes straight from the two hardcoded `RailLink`s into `navGroups` — no `/app/account`
  link. Removing the avatar dropdown without adding one strands instructors and admins
  from their own account page on mobile.
- **Saved Content is a real loss for members, not just a dedup.** The I6 comment at
  475–490 documents that Saved Content was *deliberately* excluded from the canonical drawer
  order — "it stays reachable from the Account page only; the avatar menu's own quick-access
  section … still lists it." That was fine while the avatar menu existed as a second surface.
  Once it's gone, that sentence's premise is gone too: Saved Content becomes unreachable from
  mobile nav entirely (Account page still has it as a section, just not linked from any menu).
  This needs an explicit call: add it to the drawer (breaking the I6 decision), or accept the
  loss.

### One asymmetry worth a flag, not a fix

Admins and instructors get different avatar-menu content today even though both are
`isStaff`: instructors fall into the `!isAdmin && !isSuperAdmin` branch (765–788) and get
Calendar/Catalog/Messages; admins get the separate "Company" branch (738–760), which omits
Calendar and Messages entirely. I don't think this was a deliberate design choice — it reads
like the two branches drifted — but it's pre-existing behavior, not something this task
introduced, so I'm reporting it rather than quietly equalizing it. If the merged drawer gives
every staff member the same net-new items (Account, Catalog, App tour, Sign out) regardless
of admin/instructor, this asymmetry disappears as a side effect. Worth confirming that's
acceptable rather than assuming it.

---

## Phase 1 questions

### Q1 — Sign out placement

My recommendation: a footer block at the very bottom of the drawer, below every nav group,
separated by its own `border-t` — reusing the exact treatment it already has in the current
dropdown (line 808–811: plain button row, `LogOut` icon, no active-state styling, no hover
tint shared with nav links). Concretely, I'd land the trailing block as **Account → App
tour → Sign out**, with Sign out getting an *additional* divider beyond the one separating
the block from the nav groups above it — so it reads as two tiers: "other things you can do"
(Account, Tour) and then, set apart again, the one destructive-adjacent action. This mirrors
the current dropdown's own relative order (Account first, Tour and Sign out both trailing
with their own border-t) rather than inventing a new arrangement.

### Q2 — the avatar's fate

There's a tension in the doc itself worth surfacing before I answer: the "Known, and NOT
this task's to fix" section already refers to "**the monogram**" as an established noun
("Gilding the monogram for mobile legibility is an owner-led design pass"), and commit
`bd1b820`'s message states a firm ruling — "the avatar is neither menu trigger nor link
… All interaction comes out: press, hover, pointer, tap-highlight, and the menu ARIA
semantics." But that commit's actual diff never touched Q2's text, and Q2 as it reads
today still frames it as a live choice between inert and a direct link, with the link
option positively argued for. I'd want that reconciled explicitly rather than picked by
whoever builds Phase 2, since the two readings produce different components (a `<span>`
with zero handlers vs. a `<Link>`).

Taking the question as posed: if a direct link, `onAvatarClick`'s current toggle
(`setMenuOpen((v) => !v)`) becomes `navigate('/app/account')`; the `is-pressed` state and
its pointer handlers (129–134) could stay exactly as they are since they're already
decoupled from the menu-toggle logic; `aria-expanded`/`aria-label="Account menu"` need to
change since it would no longer be a disclosure control. If inert, all of `onClick`,
`onPointerDown/Up/Leave/Cancel`, the `is-pressed` class, `aria-label`, `aria-expanded`, and
`cursor:pointer` (header-cardstock.css:200) come out, and the element likely stops being a
`<button>` at all. Given the commit-message ruling reads as the more recent and more
specific signal, I'd lean inert unless the owner actively wants the link — but I'm
flagging the contradiction rather than resolving it myself, per "answer, don't decide."

### Q3 — superadmin

Confirmed structurally isolated, not just by convention. The `isSuperAdmin` branch
(825–885) renders its own `<header>` from scratch — no `CardstockHeader` import, no
`NAV_GLASS`, no `.cs-*` classes — and keeps its own mobile nav button (`PanelLeftOpen`,
846–854) and its own `ChevronDown`-carrying avatar (871–880). Every mobile-drawer render
site in AppLayout is already guarded with `!isSuperAdmin` (1004, 1038, and the `accountMenu`
JSX itself is shared but superadmin renders a different avatar button that opens it, not the
drawer tab). None of Part A's changes touch code superadmin's branch executes. Answer: no,
this task doesn't need to touch superadmin, and the existing guards already keep it that way
— confirming the doc's own recommendation rather than overriding it.

### Q4 — desktop

This one has a hard constraint the doc's phrasing ("probably a separate task") doesn't
quite convey: **the avatar dropdown cannot be removed on desktop without a replacement**,
because desktop currently has no other path to sign out at all. `ClientRail` (desktop
member rail, 524–538) has no sign-out. The staff desktop rail (912–971) has no sign-out
either, and — same gap as mobile — no personal Account link. `CardstockHeader` renders the
avatar + `menu` unconditionally; nothing in it or in `AppLayout` hides the dropdown at any
breakpoint today (only the *drawer* is `lg:hidden`-gated, not the dropdown). So "does the
dropdown disappear only on mobile" isn't really optional — it has to survive on desktop
untouched, at least until a desktop-specific replacement for sign-out (and staff's Account
link) exists. Answer: yes, scope Part A's dropdown removal to `<lg` only; leave
`CardstockHeader`'s `menu`/`accountMenu` rendering exactly as-is at `lg+`. Desktop
consolidation is real follow-on work, not a nice-to-have deferral.

---

## B0 — equalise the header's side columns

Confirms the doc's own math independently: `.cs-hdr` is `grid-template-columns: 1fr auto
1fr` with symmetric padding at every breakpoint (33px / 25px / 12px / 8px, always applied to
both `padding-left` and `padding-right` together). `.cs-left`/`.cs-right` are
`justify-content: flex-start`/`flex-end`, so each mark sits flush against its column's outer
edge and the column's *inner* edge (facing the wordmark) is exactly `column-width −
mark-width` from center. Since the columns are equal (`1fr` = `1fr`) but `.cs-logo` is 56px
and `.cs-avatar` is 50px (header-cardstock.css:150, 200), the gaps differ by exactly 6px —
confirmed, not assumed. The same pattern repeats at ≤410px with the BP410 pair: `.cs-logo`
48px / `.cs-avatar` 42px (468–469), same 6px gap.

**One technical obstacle the doc doesn't mention, that Phase 2 will hit immediately:**
`.cs-mark svg { position: absolute; inset: 0; width: 100%; height: 100%; }` (line 98) is a
*generic* rule covering both marks' SVGs. If `.cs-avatar`'s wrapper grows to 56px (48px at
≤410) to match the logo, this rule will stretch the avatar's still-50×50 (still-42×42) SVG
to fill the new wrapper — which is exactly the resampling defect BP410 already fixed once,
now reintroduced through the back door of a bigger wrapper instead of a smaller drawing.
The fix needs a scoped override — something like giving `.cs-avatar svg` (both the
`.cs-mark-lg` and `.cs-mark-sm` variants) explicit pixel width/height matching their own
viewBox (50×50 / 42×42) plus `top:50%; left:50%; transform: translate(-50%,-50%)` instead
of `inset:0; width/height:100%` — so it's centered in the larger box without being resized.
This is a plan note, not code; Phase 2 needs to land this alongside the wrapper-width change
or B0 will silently violate its own "do not resize either SVG" constraint.

**Second cross-effect:** the desktop Create tab's horizontal position is derived from the
avatar's current width. `.cs-tab`'s comment (header-cardstock.css:258–260) states it plainly:
"the avatar sits at the padding edge (33px) and is 50px wide, so its inner edge is 83px
in; the tab centre sits ~46px further left" → `--cs-tab-right: calc(112px + …)`
(line 261). `.cs-tab` is unconditional at `lg+` (only hidden below `lg`, line 264/281), and
`.cs-avatar`'s *unconditional* (non-≤410) width is what changes under B0 — both apply at
desktop widths simultaneously. Growing the avatar wrapper by 6px (50→56) without
recalculating `--cs-tab-right` will drift the Create tab ~6px out of its intended visual
center. The ≤410 pair doesn't need a matching fix — `.cs-tab` never renders below `lg`
(1024px), so the 42→48 change at that breakpoint never coexists with it. Flagging so Phase
2 doesn't ship a B0 that looks correct in the header and wrong at the Create tab.

---

## B1 — enlarge the drawer tab's touch target

`.cs-drawer-tab` is 34×46px (header-cardstock.css:359–369) against the 44×44 guideline —
height already clears it, only width is short (by 10px). There's already a working
precedent for the "invisible pseudo-element, not padding" technique in this exact file:
`.cs-tab::before` (the Create tab's own hit-slop layer, line 323) does precisely this —
`content:''; position:absolute; left:-8px; right:-8px; top:0; bottom:-14px; z-index:2;`,
asymmetric slop with no visible box. `.cs-drawer-tab` has no existing `::before`/`::after`
of its own (only its `.cs-arrow` child uses pseudo-elements, for the arrow lines), so
there's no collision to work around — the same pattern can be reused directly, sized to
close the ~10px width shortfall (plus a margin of safety) on the content-facing edge, since
the opposite edge sits at the screen boundary and can't usefully extend further. Exact
pixel values are a Phase 2 decision once the tab's mirrored (right-edge) position is
in place.

---

## B2 — remove the Close button

Located at 1033–1036 (button) inside the header row at 1031–1037; the `Menu` label
(1032) stays. Pre-verified all four close paths independently of the button, since this
doesn't require writing code to check:

- **Scrim** — `onClick={closeMobileNav}` on the backdrop div, line 1018. Independent of the
  button.
- **Escape** — `useEffect` at 671–676, keyed off `mobileNavOpen`, calls `setMobileNavOpen(false)`
  directly. Independent.
- **Route change** — `useEffect(() => setMobileNavOpen(false), [location.pathname])`, line 677.
  Independent.
- **Link selection** — the `<nav>`'s own `onClick` at 1021–1024 closes on any click that
  `.closest('a')` finds. Independent.

All four are wired to `mobileNavOpen`/`closeMobileNav` directly and don't reference the
Close button in any way — removing it doesn't touch any of these paths. The only real work
in B2 is the layout cleanup of the now-single-child header row (`justify-between` with one
child left will look off-balance; needs a simpler `justify-start` or equivalent), which is
a Phase 2 styling call, not a functional risk.

---

## B3 — replace the active-page fill

`RailLink` (284–314) is the named target, and it's confirmed shared with the desktop rail
(both `ClientRail` and the staff `<aside>` render it) — so this change is visible in four
places: mobile member drawer, mobile staff drawer, desktop member rail, desktop staff
rail. Screenshot all of those, not just mobile.

**Consistency risk the doc doesn't call out:** the identical `bg-cream-200 text-green-800
font-medium` active-state convention is *also* hand-copied into three other components in
this same file — `PresenceLink` (340–354, renders My Stable in the member drawer),
`AccountNavLink` (361–373, renders Account in the member drawer), and the nested
community-view links inside `CommunityNav` (447–455). None of these are `RailLink`, so B3's
instruction ("replace it in `RailLink`") doesn't touch them by its literal scope. If only
`RailLink` changes, a member's own drawer will show **two different active-state styles
side by side in one list** — Dashboard/Calendar/etc. get a left gold bar, but My Stable and
Account (rendered immediately after them in the same `ClientNavItems` list) keep the opaque
cream fill, and the nested community-filter sublinks keep it too. That reads as an
inconsistency introduced by this task, not a pre-existing one. I'm reporting this rather
than silently expanding scope to all four components, per the same "report rather than
rework" allowance the doc already grants for the `pl-9` indent collision — but it's the
same shape of problem and probably wants the same answer (all four, for consistency)
rather than a different one for each.

`aria-current` — `RailLink` doesn't set it explicitly today; `NavLink`'s `isActive` render
prop is used for styling only. Worth a note: if "keep `aria-current` intact" implies it
should already be there and must not be lost, I didn't find it set anywhere in this
component — worth confirming whether `NavLink`'s implicit behavior already covers this
(React Router's `NavLink` does set `aria-current="page"` automatically when active, without
the app needing to set it manually) or whether the doc expected an explicit prop the code
doesn't have. Read-only check, not a defect — react-router's default behavior likely
already satisfies this, but I'd rather flag the assumption than assert it against a library
internal I didn't test at runtime.

---

## B4 — neutralise the overlay

Scrim is `bg-green-950/50` at line 1018, `<div className="absolute inset-0 bg-green-950/50"
onClick={closeMobileNav} aria-hidden="true" />`. `inset-0` means no positional change is
needed when the drawer mirrors to the right — it already covers the full viewport regardless
of which edge the panel opens from. The click-to-close behavior lives on this same element
and needs no change either way (tint-only edit, or removed-but-transparent per the doc's
fallback). Straightforward; no cross-effects found.

---

## B5 — more space above the page title

`<main>` line 973: `className="flex-1 min-w-0 px-4 sm:px-8 xl:px-12 py-6 sm:py-9 pb-24"`.
Worth noting for Phase 2: `py-6`/`sm:py-9` set *both* top and bottom padding, but `pb-24`
(same class list, later-defined Tailwind utility) already wins the cascade for
`padding-bottom` — so today's *effective* mobile padding is 24px top / 96px bottom, not
24px/24px. Increasing `py-6` directly would also change the top-vs-bottom relationship in a
way the task doesn't ask for. The clean fix is splitting the axis utility into an explicit
`pt-*` (bumped up) while leaving `pb-24` untouched — e.g. `pt-10 sm:py-9 pb-24` as a
starting point, not a final value; the doc doesn't specify a target number, only "too
tight," so the exact px is a feel call for Phase 2.

Distinct from A1's overlap point, worth keeping separate in Phase 2's own head: B5 is about
resting-state breathing room under the title; A1's no-gutter rule is about the tab
overlapping content *while scrolling*, which stays untouched. Increasing top padding here
doesn't add a gutter or inset content against the tab — it's normal vertical rhythm, not a
tab-avoidance measure, even though the two facts (more top padding + tab lands in newly
roomy space) are related in the doc's own reasoning.

---

## B6 — leave page titles left-justified

No code change — this section exists purely to override a withdrawn instruction, and the
current code already matches the "leave alone" outcome: I had an Explore pass check every
page carrying the eyebrow/heading/description pattern, and **all of them are already
left-aligned** — no `text-center`, no `items-center`+`flex-col`, no `justify-center` on any
title wrapper, anywhere. Where `mx-auto` appears (`MyPosts.tsx`, `AccountHub.tsx`), it's on
an outer page-width container, never on the title block itself — so it isn't the thing B6
warns against adding.

**One correction to the doc's own count:** B6 says "the other six pages using the title
model." The actual count, searched fresh rather than trusted from the doc, is **twelve**
other pages, not six: Catalog, Dashboard, Schedule, My Posts, Care Home, Orders, Deal Home,
Gifts, My Lessons, Support, Documents, Account Hub (all in `src/pages/app/`) — plus two more
near-identical instances in the staff `ops/` subdirectory (Payment Review, Documents Queue)
that are probably out of the count's intent but do exist. This doesn't change B6's action —
"leave everything as it is" is correct regardless of whether it's six pages or twelve, since
none of them need touching — but the doc's own inventory was stale (this looks like a
leftover from the original centring instruction's scope, carried over into its withdrawal
without being re-checked), and since Phase 1's whole job includes verifying inventories
rather than trusting them, flagging it felt more honest than quietly matching the doc's
number.

---

## Summary — what needs an owner decision before Phase 2 starts

1. **Q2, reconciled**: is the avatar inert, or a link to `/app/account`? The doc and the
   commit history disagree with each other right now.
2. **Saved Content**: added to the merged drawer, or accepted as a mobile-nav loss (still
   reachable via the Account page)?
3. **B3's real scope**: `RailLink` only (as literally written), or all four components
   sharing the cream-fill convention (`RailLink`, `PresenceLink`, `AccountNavLink`,
   `CommunityNav`'s nested links), to avoid a mixed-style drawer?
4. **Staff Account link placement**: confirmed net-new, needs a spot in the merged drawer —
   proposing "same trailing position as members' `AccountNavLink`," but staff never had this
   link anywhere before, so there's no existing position to preserve.
5. **The admin/instructor avatar-menu asymmetry** (Calendar/Messages present for instructors,
   absent for admins, in the current code) — confirm it's fine for both to converge on the
   same net-new item set in the merged drawer, since that quietly resolves the asymmetry
   either way.
6. **Q1/Q4/Q3 answers above** — presented as recommendations, not commitments; need explicit
   sign-off since Phase 2 will build against whichever reading is confirmed.

Everything else — B0, B1, B2, B4, B5, B6, A1's mechanical mirroring — has a clear technical
path already and mostly needs Phase 2 to execute rather than further owner input, modulo the
cross-effects flagged above (the SVG-stretch trap in B0, the Create-tab drift in B0, the
`--cs-tab-right` recalculation).
