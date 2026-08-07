# TASK-ACCOUNTSURFACE — Phase 2 report (build)

Worktree: `/Users/Cactai/Desktop/fhe-worktree-accountsurface`, branch `task/accountsurface`,
rebased onto `origin/main` at merge `bec0e6f` (post file-ownership-split ruling, `c5dfe6c`).
PLUSPASS confirmed merged (`80849b0` is an ancestor). File ownership honored throughout:
**`AppLayout.tsx` was not opened, let alone edited.** Everything below is in the five owned
locations — `AccountHub.tsx`, `AccountPanels.tsx`, the new stable page, `App.tsx` routes, and
(implicitly, to do the §3 extraction at all) the five subject page/content files themselves.

17 files changed, +1,562/−1,349.

---

## §1 — The four rows that navigated now expand

My Posts, My Lessons, My Orders, My Gifts no longer call `navigate(...)`. `AccountHub.tsx`
has zero `navigate()` calls left anywhere — every one of its ten rows now goes through the
same `toggle(section)` accordion the four already-expanding rows used.

## §2 — `/app/stable`

Added `src/pages/app/Stable.tsx` at route `stable` (`App.tsx`), following the same pattern
as `/app/my-posts` and `/app/lessons` (thin page, gold eyebrow + heading + description,
content below). The content is `StableSection`, moved out of `AccountHub.tsx` into its own
file (`src/components/app/StableSection.tsx`) **unchanged** — same three loads, same
add-item modal, same `HorseIntakeForm` (which owns the microchip-dedup path) — imported by
both the new page and the Account panel.

**`/app/account?section=stable` redirects to `/app/stable`** rather than pre-opening the
panel (`AccountHub.tsx`, `Navigate` placed after all hooks so the redirect doesn't violate
hooks ordering on the query-changes-without-remount case). This is the ONLY behavior change
to how `?section=` is read — `profile`/`saved`/`documents` keep working exactly as before.

**Known interim state, expected, not a bug:** the two nav call sites in `AppLayout.tsx`
still point at `/app/account?section=stable` — that file is ONEMENU's, not touched here.
Until ONEMENU repoints them, clicking "Stable" in the nav still works (it hits the redirect
above and lands on `/app/stable`), it just isn't a direct link yet.

My Stable still expands inline on the Account page (`StableSection` rendered bare, same as
before — just imported from its new location).

## §3 — Duplication: the shared-component extraction

One shared component per subject, exactly as Phase 1 recommended, split by actual cost:

**Mechanical extractions (My Stable, My Posts, My Lessons, Orders, Gifts)** — each subject's
list/detail logic moved into `src/components/app/<Subject>Content.tsx` unchanged; the nav
page became a thin header-plus-content wrapper; the Account panel renders the same content
bare. No logic was rewritten — I diffed each new `*Content.tsx` against the code it came
from and the only deletions are the outer page shell (the `max-w-3xl` wrapper, eyebrow/h1,
back button) that doesn't belong in an Account-page panel.

One exception worth flagging: **My Posts' "+ Post" button (PLUSPASS) stays page-only** — I
did not add a create control to the Account panel's inline version. Nothing in the task
asked for it, Orders and Gifts never got one from PLUSPASS either, and inventing new create
affordances the task didn't request felt like exactly the kind of unrequested scope the
"don't rewrite, move" instruction is guarding against. Flagging it as a considered omission,
not an oversight, in case the owner wants it added.

**My Lessons gained a fix as a side effect of the move, not a separate change:** its shared
content now carries its own `ModuleGate('mod.lessons')` inline, same as the nav page always
had. Phase 1 found the Account row had **no** `lessonsOn` check at all — a lessons-OFF
tenant would see the row, click it, and navigate to a page that just showed the lock. Now
that the row expands the same gated content the nav page always used, that gap closes by
construction; I didn't add a special case, the shared component just IS the gate.

**Documents — the reconciliation, not an extraction.** This is where Phase 1's warning
mattered. The old `DocumentsPanel` (`AccountPanels.tsx`) was missing what the old
`Documents.tsx` had: self-sign (typed-name e-sign + the contract-doc deep link), "email me
a copy," the two-source pending/assigned/executed list (`myDocuments()`, not just
`listMySignableDocuments()`), and the supersede badge. Per the owner's ruling, the fuller
behavior won: `DocumentsContent.tsx` **is** the old `Documents.tsx` body, moved essentially
verbatim (`SelfSignRow`, `EmailMeACopyButton`, the two-source fetch, the awaiting/sealed/
pending/executed rendering — all unchanged).

But the reconciliation runs **both directions**, not just toward the page's capability set.
The old panel had something the old page didn't: `PaperViewer`, an in-app paginated reading
view of a document's full merged text. `Documents.tsx` had no such thing — it only offered
"Download signed PDF," never a way to read the document without downloading it. Leveling
toward the page alone would have silently dropped that. So `PaperViewer` (and its
pagination helper, both lifted unchanged from the old `AccountPanels.tsx`) is folded back
in: a small "Read" button now appears next to any row with a resolvable body — every
self-sign row via its own `SignableDocument`, and every plain executed row via a new
`document_id`-keyed lookup into the `signables` list (since `myDocuments()`'s rows carry no
body text on their own; that only exists on the `SignableDocument` side). Both surfaces now
have the union of what either had, not the maximum of one axis at the expense of the other.

`AccountPanels.tsx` now holds only `SavedPanel` (67 lines, down from 200) — the old
`DocumentsPanel`/`PaperViewer` are gone from there, superseded by `DocumentsContent.tsx`.

## §4 — Ten sections, "My" labels

Applied **on the Account page only**, per the file-split ruling — `AppLayout.tsx`'s labels
are ONEMENU's to change. All ten rows in `AccountHub.tsx` now read exactly per the task's
table: My Profile, My Preferences, My Login, My Posts, My Lessons, My Saved Items, My
Documents, My Stable, My Orders, My Gifts. "Account" itself stays plain.

**Order — today's relative order, preserved, not invented.** The eight pre-existing rows
keep their exact relative order. The two brand-new rows (My Preferences, My Login) have no
"before" position to preserve, since they didn't exist as separate rows — I placed them
immediately after My Profile, where the single old "Profile & preferences" row used to sit,
rather than inventing a position elsewhere. Final order:

1. My Profile 2. My Preferences 3. My Login 4. My Posts 5. My Lessons 6. My Saved Items
7. My Documents 8. My Stable 9. My Orders 10. My Gifts

**This still needs the owner's ranking** — I did not decide a final order, only preserved
what exists plus the one placement call above (which I don't think counts as "inventing an
order" for anything that already had one, but flagging the reasoning so it can be
overruled).

### My Profile splits in two

`ProfileAndPreferences.tsx` already built `ProfileCard` ("Profile", badge "Visible to the
community") and `AccountInfoCard` ("Account information", badge "Staff only") as genuinely
separate cards — TASK-PROFILE had already done the real work. My Profile's row now renders
both stacked (`MyProfileContent`), which is exactly what "splits internally" describes; I
didn't rename or restyle either card's own heading.

### My Login

`LoginSecurityCard` already had the login-email row, the password-reset modal, and a
Google-connect row — but the Google row's visibility didn't match the spec. The task says
it should show **only** when the member already has a password set AND is either using a
Google email or switching to one.

I implemented the determinable half of that: `showGoogleSwitch = !googleConnected &&
hasPassword && isGoogleHostedEmail`, where `hasPassword` reads `'email'` off
`listLinkedProviders()` (a password-based identity) and `isGoogleHostedEmail` checks the
current sign-in email against `@gmail.com` (the same heuristic `EmailChangeModal` already
uses for its own Google-path detection). **"Or is switching to one" I did not implement** —
I found no client-observable signal for an in-flight email-change-to-Google anywhere in the
codebase; `EmailChangeModal`'s own "this is a Google-hosted email" checkbox is local,
unpersisted state inside that modal, not a fact this card can read. Rather than invent a
new backend signal inside an already-large task, I left it out — the conservative reading of
"do not show it otherwise" means the gap defaults to *not showing* the switch during an
in-flight change, which is the safe direction to be wrong in, not the unsafe one.

---

## Verification (against the task's own checklist)

1. **Every account row expands in place — verified by reading `AccountHub.tsx`**: zero
   `navigate()` calls remain. "Every nav item opens its own page" is ONEMENU's half of this
   claim (it owns `AppLayout.tsx`); not verified here.
2. **`/app/stable` loads** — route registered, page builds, typechecks. Not click-tested
   live (see the blocker below).
3. **My Stable still expands inline** — `StableSection` unchanged, imported by both surfaces.
4. **Horse/gear/supply adds, incl. microchip-dedup** — `StableSection`/`HorseIntakeForm`
   moved without modification; the dedup path lives entirely inside `HorseIntakeForm`,
   which I didn't touch. Verified by code inspection (identical imports, identical call),
   **not** runtime-tested — see the blocker below.
5. **Old `?section=stable` links land sensibly** — redirect to `/app/stable`, implemented
   and hooks-order-safe; not click-tested live.
6. **Labels match between nav and account page** — the Account-page half is done exactly
   per the task's table (listed above). The nav half is ONEMENU's; when it lands, its
   labels need to match this same table — I'd treat this table as the diff to check against.
7. **390px screenshot with heavy panels expanded** — **NOT DONE.** See below.
8. **Typecheck and lint clean** — confirmed: `npm run typecheck` (0 errors) and `npm run
   lint` (0 errors, 30 warnings, all pre-existing and none in a file this task touched).
   `npm run build:client` also succeeds.

### The blocker on 7 (and the runtime half of 2/4/5)

This worktree has **no Supabase credentials** — no `.env`, `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` unset anywhere I could find in the repo, the home directory, or
sibling worktrees. `npm run dev` starts the Vite server fine, but the app throws
`supabaseUrl is required` at the Supabase client's construction and the React tree never
mounts past that — confirmed with a headless Playwright load of `/app/account`
(`console`/`pageerror` captured, not guessed at). There is no demo/offline mode that
bypasses this. I could not log in, could not click through, and could not take the
requested screenshot. This is not a gap I can close myself — it needs Supabase credentials
supplied to this environment. Flagging rather than skipping silently, and rather than
fabricating a result.

Given that, everything above is verified by **reading the diff and the surrounding code**,
plus `typecheck`/`lint`/`build` passing — not by operating the running app. Treat the
runtime halves of items 2, 4, 5, and 7 as outstanding until someone (with credentials) can
click through and screenshot at 390px.

---

## Things worth a second look, flagged rather than silently decided

- **My Posts' create button stays page-only** (§3, above) — a scope call, not an oversight.
- **The Google-switch "or is switching to one" clause is unimplemented** (§4, above) — no
  signal exists to implement it against.
- **My Lessons' icon changed from `Boxes` to `GraduationCap`** on the Account row. The old
  code used `Boxes` for both "My lessons" and "My Stable" — two rows with the same icon,
  sitting a few rows apart in the same list. Since I was already touching every row's
  props, I picked `GraduationCap` (matching the icon `MyLessonsContent` itself uses for
  "Credits remaining," and matching what the nav rail already uses for the same
  destination) instead of leaving the duplicate. Small, but flagging it as a deliberate
  change rather than something that crept in.
- **Nav-page eyebrow/document-title copy** on all five subject pages (My Documents/My
  Lessons/My Posts/My Orders/My Gifts/My Stable) now matches the §4 table exactly, not just
  the Account row. This is page content, not a nav link or label in `AppLayout.tsx`, so I
  read it as inside this task's scope even though the file-split note singles out "the
  Account page" — flagging the reasoning in case that reading is wrong: without it, the
  nav page's own on-screen heading (e.g. "My lessons," lowercase) would disagree with both
  its Account-page row and its own browser tab title, which seemed like exactly the kind of
  drift this task exists to remove.
- **Order is not owner-ranked** (§4, above) — today's relative order plus one placement
  call for the two new rows, not a final answer.

## What I verified myself vs. assumed

**Verified directly:** every file in the diff, read in full both before and after editing.
`npm run typecheck`, `npm run lint`, `npm run build:client` all run and their output quoted
above is real, not summarized from memory. The Supabase-credentials blocker is verified via
an actual headless-browser load with console/error capture, not inferred from a missing
`.env` alone. `DocumentsPanel`/old `ProfileAndPreferences` have zero remaining references
(`grep`-checked). Git status confirms the touched-file set matches the ownership table
exactly — `AppLayout.tsx` does not appear in `git status`.

**Assumed, not runtime-verified:** everything gated behind an authenticated session —
`/app/stable` actually rendering, the horse/gear/supply add flows, the `?section=stable`
redirect firing correctly in a real browser, all ten Account rows visually behaving as an
accordion at 390px. These rest on the code being correct (typechecked, structurally
unchanged from working originals) rather than on having watched them run.

---

**Stopping here per Phase 2 scope.**
