# TASK TITLESWEEP — page-name eyebrows + conversational intros (owner spec 2026-08-05)

Extends TASK-PAGETITLES' model to the remaining USER pages. Rule: the gold all-caps eyebrow
is the PAGE NAME; the large dark-green line is a warm, conversational message to the user —
never a label, never a duplicate of the page name. Pure UI/copy; no DB; `AppLayout.tsx` and
`ClauseDocument.tsx` untouched.

## Per-page (eyebrow → intro). Copy is DRAFT-approved: implement exactly, owner will tune by
eye afterward — do not improvise different wording.

| Page | Eyebrow | Large conversational intro |
|---|---|---|
| Account (`AccountHub.tsx`) | ACCOUNT | "Here's everything that's yours." |
| Support (`Support.tsx`) | SUPPORT | "How can we help?" (existing line already fits — keep, icon may stay) |
| Schedule (`Schedule.tsx`) | SCHEDULE | "Here's what's coming up." |
| My Lessons (`MyLessons.tsx`) | MY LESSONS | "Your riding, at a glance." |
| Gifts (`Gifts.tsx`) | GIFTS | "Gifts you've received — and given." (must honor BOTH directions the page can show; if the page can cheaply detect it shows only one kind for this user, it MAY narrow to "Gifts you've received." / "Gifts you've given." — implement the static both-direction line first, add detection only if trivially available from data already loaded) |
| Horse care (`CareHome.tsx`) | HORSE CARE | keep existing "Welcome, {first}" (already conversational); fallback stays |
| Documents (`Documents.tsx`) | DOCUMENTS | "Everything you've agreed to, all in one place." (refined wording, same sentiment — owner-directed) |
| My Posts (`MyPosts.tsx`) | MY POSTS | drop the large title entirely; the existing description line ("Review, edit, or delete anything you've posted.") stays and is sufficient |
| Orders (`Orders.tsx`) | ORDERS | "Everything you've purchased." — NOTE: owner did not explicitly name Orders; implement it for consistency but list it prominently in the report as applied-by-pattern for easy veto |

Onboarding: NOT in scope (state-dependent; owner reviewing separately).

## Rules
- Branch `task/titlesweep` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-titlesweep -b task/titlesweep origin/main`).
  Copy this doc from the shared checkout (untracked). No .env.db needed.
- Match each page's existing eyebrow/heading classes (the PAGETITLES precedent) — no new
  visual patterns; the `.eyebrow` class already uppercases.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors).
- Update `docs/archive/BUILD_TRACKER.md` section I row honestly.
- Report: `docs/reports/TASK-TITLESWEEP-REPORT.md`, committed + pushed. Print ONLY the
  report path.
