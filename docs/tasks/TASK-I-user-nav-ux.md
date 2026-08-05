# TASK I — USER-account nav & mobile UX pass (tracker I1–I5)

All five items live in the same file cluster (`src/components/app/AppLayout.tsx` + avatar
menu + nav styling), so they run as ONE task. Owner-authored spec, 2026-08-04. The tracker
rows (section I) are the checklist; this doc adds the decisions and constraints.

## I1 — sidebar collapse toggle: staff/admin only
The left-sidebar collapse/expand control currently shows for all account types. Gate it
`isStaff` (the layout already computes staff-ness — reuse the exact same gate the ops nav
items use). USER accounts get a fixed (non-collapsible) sidebar.

## I2 — dynamic USER sidebar + avatar-menu links
Links: **Orders, Documents, Stable, My Posts, Saved Content.** Each appears in the USER
left sidebar AND the avatar dropdown ONLY when that page has ≥1 entry for the account;
while empty, the page stays reachable only through the Account page (no dead links, no
empty-state pages pushed into nav).

Locked design for presence detection: ONE new RPC `my_nav_presence()` returning
`{orders bool, documents bool, stable bool, posts bool, saved bool}` — five cheap EXISTS
checks scoped to the caller (reuse the same scoping each page's own list RPC uses: orders =
whatever the Orders page queries by buyer/contact; documents = same visibility as
`my_documents()` — post-DOCVIS this includes party documents; stable = `my_stable_horses()`
scope; posts = the caller's community posts; saved = the saved/bookmarked-content table the
Saved page reads). READ each page's existing query first and mirror its scope exactly —
a nav link must never appear when the page it opens would render empty, and vice versa.
SECURITY DEFINER, `authenticated` may execute (it leaks nothing but five booleans about
yourself). One call on layout mount, cached in state; refresh on route change is NOT
required (next mount picks it up).

Documents will be true for effectively every account (all accounts start with documents) —
that's intended; it's the flagship discoverability win.

Route targets: use the pages' real existing routes (find them in App.tsx — do not invent
new routes; if a "page" only exists as an Account-page section, link to the Account page
with the section param pattern A11 added, e.g. `/app/account?section=stable`).

## I3 — mobile close button + header padding
- The mobile sidebar's close control becomes the word **"Close"** (keep the icon if it
  reads well — text first, icon after; if it crowds, drop the icon).
- Make it visually prominent: larger hit target, and per I4 it uses the same
  darker-panel-shade treatment to indicate the open menu is the active state; clicking
  closes.
- Add breathing room: more padding in the menu header zone so the Close control clears the
  first nav item (currently the highlighted Community button sits too close).

## I4 — selected-page indicator (replace dark-green fill)
The current dark-green fill is overpowering on the light UI and small light text reads
poorly on it at mobile sizes. Replace with: background = a slightly darker shade of the
nav panel's own color (same hue family, just darker — derive from the existing tailwind
palette in `tailwind.config.js`, do not invent a new hex if a scale step exists), plus a
**gold outline** (matches the gold link icons). Build it WITH the gold outline first; then
render both variants' class strings in the report and note which the code ships — if the
darker shade alone is clearly legible, shipping without the outline is acceptable, but the
outline version must be one-line revertable (leave the class string in a comment). Apply
the same treatment consistently at every nav render site (the rail has more than one —
find them all; the B-task audit noted RailLink render sites around AppLayout.tsx:736/813,
line numbers will have drifted).

## I5 — Community-feed expand affordance
Replace the right arrow: collapsed = down arrow + small helper text "show"; expanded =
up arrow + "hide". (Owner note 2026-08-04: "show"/"hide", NOT "expand" — shorter word,
fits better.) Helper text smaller than the label, muted color, consistent with the app's
existing muted-text classes.

## Verification
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors).
- `my_nav_presence()` live proof via psql simulated sessions (technique in prior reports):
  a USER with a stable horse → `stable=true`; one without → `false`; documents true for
  both. Rolled back where any setup data is needed; zero residue.
- UI is browser-pending as usual — state it honestly; per-item status goes to tracker
  section I ("code-complete, browser pending" where true).

## Rules
- Branch `task/i-user-nav-ux` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-inav -b task/i-user-nav-ux origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB: the ONLY write is the one `my_nav_presence` migration (+ rolled-back
  proofs). REVOKE from public/anon, GRANT authenticated + service_role (see C10's report
  for the default-grant gotcha — do not leave the default grants in place).
- `ClauseDocument.tsx` FROZEN (not implicated). Do not restyle staff/ops nav beyond what
  I1/I4 require — this task is the USER experience.
- Report: `docs/reports/TASK-I-REPORT.md`, committed + pushed. Print ONLY the report path.
