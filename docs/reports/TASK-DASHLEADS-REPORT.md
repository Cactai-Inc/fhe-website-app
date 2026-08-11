# TASK DASHLEADS — report

Branch `task/dashleads` off `origin/main`, commit `8f70710`. Not pushed.

## What "done" required, and what shipped

> "The owner opens the dashboard and sees new inbound leads as entries, with one
> badge count that includes them, without visiting a second page."

Built:

1. **`src/lib/ops/useOpenLeads.ts` (new)** — reads `requests` (status `new`) and
   `support_requests` (status `<> resolved`) directly, no notification table
   involved, and returns dashboard-ready entries (title, summary, link to the
   full workflow). These are the exact two conditions `inbound_open_count()`
   already sums for the nav badge, so the entry list and the badge number can
   never disagree.
2. **`src/components/app/DashboardPanel.tsx`** — new staff-only "New leads" band,
   rendered above "Needs your attention," using the same `TileCard` visual
   language already on that page (gold-bordered card, title, summary, CTA that
   opens the full request/support workflow). Capped at 6 with a "N more
   waiting →" link into `/app/ops/intake` for the rest.
3. **Removed a duplicate-rendering bug this surfaced**: `DashboardPanel` already
   had a *second*, pre-existing path that could show the same lead —
   `request_new`/`support_new` rows in the personal `notifications` table,
   rendered as dismissable tiles under "Needs your attention" (`notify_staff()`
   inserts one such row per staff member on every new request/support ticket).
   Left alone, a lead would appear twice, and the notification tile's "×"
   (which deletes the *notification* row) would look like it closed the lead
   while the underlying `requests` row sat untouched. Filtered those two kinds
   out of that band — leads now live in exactly one place.
4. **`src/pages/app/InstructorHome.tsx`** — the file the task doc names directly:
   its subtitle already claimed "Lessons, clients, and requests you're
   servicing" while rendering none. Added a real "Requests" section (same
   `useOpenLeads` hook) between Today and Upcoming, and wired the existing
   "Requests" quick-action tile's count to the same data instead of a separate
   `listIntake()` filter that used a looser status match (`new` **or**
   `contacted`, vs. the badge's `new`-only) — one source, one number, everywhere.

`LeadsPage` (`/app/ops/leads`, contact-type `LEAD` — the marketing/campaign
list) is untouched, per the task's explicit instruction. It is a different
"leads" than this task's subject (booking/support requests from `requests`);
nothing here reads or writes `contacts.contact_type`.

`IntakePage.tsx` / `/app/ops/intake` is untouched. Its nav entry was already
removed (commit `cefaad7`, UIBUILD); the route still builds and is exactly
where the new dashboard entries link out to for full triage (notes, checklist,
invite). Nothing needed changing there.

## A finding that changes where the fix had to live

The task doc's "Where things are today" section names `InstructorHome.tsx` as
"Dashboard." I built that section (#4 above) because the doc is explicit and the
technical claim in it was true. But I could not verify that fixing
`InstructorHome.tsx` alone would make "done" true, and traced why:

- `AppLayout.tsx`'s staff nav "Dashboard" link has pointed at `/app/dashboard`
  since before this task — it was hardcoded there even prior to commit
  `cefaad7` (the nav-half commit this task follows). `cefaad7` moved *which
  group heading* that link sits under (App-pages group → Management group); it
  did not change, and never had changed, the `href`.
- `/app/dashboard` (`App.tsx`) renders `DashboardHome` → `DashboardPanel`
  unconditionally — no `isStaff` branch. Every signed-in account, staff or
  member, lands on the same component.
- `InstructorHome.tsx` is only reachable through `OpsHome` at `/app/ops`
  (`isAdmin ? OpsDashboard : InstructorHome`). I grepped the whole `src/` tree
  for any link, `<Navigate>`, or `navigate()` call targeting `/app/ops` exactly
  (excluding its many `/app/ops/*` sub-routes) — there are none. `OpsHome`,
  `InstructorHome`, and `OpsDashboard` are not reachable from any in-app
  control today. This predates this task; it is not a regression I caused.

So the page the task doc names is currently dead code from the owner's
perspective — he cannot click to it. Building leads into it alone would not
have satisfied "the owner opens the dashboard and sees leads." That is why the
real, load-bearing fix (#2/#3 above) went into `DashboardPanel.tsx`, the
component actually rendered at the one nav-reachable `/app/dashboard`.

**I did not touch routing to reconnect `/app/ops`/`InstructorHome`/`OpsDashboard`
to the nav-reachable path.** That would mean either editing `AppLayout.tsx`
(off-limits — UIBUILD's file, active edits confirmed: a `wt-uibuild` diff exists
against `origin/main` touching nav hover states) or making `DashboardHome.tsx`
branch on `isStaff` to embed `OpsHome`'s content, which is itself a nav-adjacent
UX decision ("what page does clicking Dashboard show a trainer vs. an admin vs.
a rider") that reads like exactly the kind of call this task's "do NOT redesign
the decision" instruction reserves for the owner. Flagging it rather than
guessing:

**Open question for the owner/orchestrator:** is `InstructorHome`/`OpsDashboard`
(the `/app/ops` surface) meant to be retired (same "hidden, not deleted" pattern
already applied to `IntakePage`'s nav entry and `ContactsPage`/`LeadsPage`), or
reconnected as what a trainer/admin sees at `/app/dashboard` instead of the
generic member `DashboardPanel`? Either answer is a one-line decision; I did not
make it unasked.

## Verification

- `npm run typecheck` (`tsconfig.app.json`): 0 errors.
- `npm run lint`: 0 errors, 35 warnings — identical set to before this change
  (none of the three touched/added files appear in the warning list).
- `npm run build`: `vite build` succeeds (2,107 modules, bundle emitted). The
  subsequent prerender step failed on a missing `VITE_SUPABASE_URL` — this
  worktree has no `.env` and no DB credentials (expected per this task's own
  constraints: "no staff browser session exists and you will not be given
  one"). Re-ran with placeholder `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` to
  confirm the *pipeline* is sound end to end: full build + prerender of all 10
  public marketing routes + sitemap/robots generation completed cleanly. (The
  prerender step only touches public marketing routes — `/`, `/about`, etc. —
  never `/app/*`, so it exercises none of this task's actual code paths; it's
  included only as proof the build script itself isn't broken.)
- **Browser render: NOT VERIFIED.** No staff session available in this
  worktree, per the task's own constraint. Data correctness (query shape
  matching `inbound_open_count()`'s definition) and component wiring were
  checked by reading, not by clicking.

## Everything not done

Nothing outside the report above was attempted. No migrations were written or
needed (`requests`/`support_requests` already hold everything, unchanged
schema). No nav change was made — see the open question above for the one
routing decision this surfaced.
