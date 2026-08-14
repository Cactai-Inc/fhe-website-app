# FLAGHARVEST pass 2 — verified slice: UI

Worktree: /Users/cactai/Downloads/claude-code-repo/wt-flagharvest (branch task/flagharvest, HEAD 86283dc, = origin/main 6a58c0f + extraction commit).
Read-only pass. No code changed.

**Environment facts that back every "not verified in a browser" verdict below** (checked once, cited by reference):
- `ls -a` in the worktree shows only `.env.db` — there is no `.env`, so no Supabase URL/key, so no dev server and no authenticated session.
- `ls -d node_modules` → *No such file or directory*. Vite, vitest and Playwright cannot be run at all in this worktree.
- Per the instructions, `test:db` is broken and is never cited.

---

## UI-01: useOpenLeads return-shape change broke ADMINSWEEP's InstructorHome test
- item: LEADCLEAN changed `useOpenLeads` from returning a bare array to `{ open, converted, reload }`, which broke ADMINSWEEP P2's mock in the InstructorHome preview test; caught on rebase and fixed.
- sources: TASK-LEADCLEAN-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: CLOSED BY LATER WORK
- evidence: `git log --oneline -1 a22b03e` → "leadclean: follow the hook's new shape in ADMINSWEEP's InstructorHome preview test". Current code agrees: `src/lib/ops/useOpenLeads.ts:90` returns `LeadQueueState`; `test/ui/adminsweep_instructor_preview.test.tsx:37` mocks `useOpenLeads: () => ({ open: [], converted: [], reload: () => {} })`; `src/pages/app/InstructorHome.tsx:114` destructures `{ open: requests }`. Every other mock in `test/ui/` (leadclean_dashboard_leads.test.tsx:50, inboundalert_lead_card_warning.test.tsx:55) uses the object shape too.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing to do. Keep as the precedent it is — a hook shape change must be swept across `test/ui/` mocks, which are not type-checked against the real module.

## UI-02: Review nav rows are deliberately absent from the page registry
- item: The temporary Review section's rows are excluded from `PAGE_REGISTRY` on purpose — nav position is their acceptance status — while the real pages behind them are registered under their permanent homes and marked `PARKED_IN_REVIEW`.
- sources: TASK-PAGEVIS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: `src/lib/pageRegistry.ts:119-121` — the "Not listed, deliberately" block still names "the Review rows themselves — nav position IS their status, and hiding one would falsify the acceptance signal." `src/lib/pageRegistry.ts:84-89` — `PARKED_IN_REVIEW` = `{mgmt.dashboard, mgmt.horses, records.hub, settings.team}`, with the three people.* keys removed 2026-08-12 by TASK-RECORDS. Nothing has changed the arrangement.
- decision-note: D13 (owner must be able to change it without a developer) may bear — a row the owner cannot hide is a gap in that principle, but the item is recorded as a design choice, not a defect.
- cost-rank: 3
- recommendation: Leave as-is until the owner accepts or rejects the Review pages; the exclusion self-resolves when Review empties. Worth an explicit owner confirmation that he is content not to be able to hide a Review row.

## UI-03: Lessons' three child pages and the two parameterised Records routes have no nav rows and no registry entries
- item: `/app/ops/lessons/{packages,credits,sessions}` and the two parameterised Records routes are routed but have no nav rows, so they are absent from the page registry and cannot be shown or hidden by the owner.
- sources: TASK-PAGEVIS-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: Routes exist — `src/App.tsx:347-349` register `ops/lessons/packages`, `ops/lessons/credits`, `ops/lessons/sessions`. `grep -n "ops/lessons/packages|credits|sessions" src/components/app/AppLayout.tsx src/lib/*.ts` → zero hits, so no nav row. `grep -n "lessons" src/lib/pageRegistry.ts` → only `lessons.hub` (line 157) and the `mod.lessons` label; no child entries. The registry's own header comment (`pageRegistry.ts:41-46`) says the no-cascade rule is only safe *because* children have their own rows — which these three do not.
- decision-note: D13 may bear (owner-controllable surfaces), recorded only.
- cost-rank: 3
- recommendation: Owner decides whether these three are real pages. If yes, add nav rows first, then registry keys under `lessons.hub`; if no, retire the routes. Until then the registry's no-cascade safety argument has a documented hole.

## UI-04: Nothing in this slice has ever been verified in a browser
- item: Across eleven separate UI tasks the render was never confirmed on a screen — no authenticated staff session, no device, no screenshot — so every visual and interactive claim in those reports rests on code reading and mocked tests.
- sources: TASK-PAGEVIS-REPORT.md (2026-08-12); TASK-PLUSPASS-REPORT.md (2026-08-06, admin-surface inventory); TASK-REVIEWNAV-REPORT.md (2026-08-12); TASK-PAGETITLES-REPORT.md (2026-08-05); TASK-ADMINSWEEP-PHASE2.md (2026-08-11, preview route); TASK-HORSEINTAKE-REPORT.md (no date); TASK-ADMINSWEEP-PHASE1.md (2026-08-11, all admin nav pages); TASK-NAVMOTION-REPORT.md (2026-08-11, 13-item checklist); TASK-ONEMENU-REPORT.md (2026-08-07); TASK-ONEMENU-REPORT.md (2026-08-07, drawer over real content at 390px); TASK-PAGEFRAME-REPORT.md (2026-08-11, nine pages + rendered aria-labels)
- raised: 2026-08-05
- status: STILL OPEN
- evidence: The environment has not changed and has in fact regressed. `ls -a` → only `.env.db`, no `.env` (no Supabase URL/key). `ls -d node_modules` → does not exist, so Vite/vitest cannot even start. The surfaces named are all still live: `/app/ops/admin/pages` + `AdminPageVisibilityPage`, `/app/ops/review` + `ReviewIndexPage` (31 rows), `/app/ops/preview/instructor-home` (`src/App.tsx:286`, `src/pages/app/ops/InstructorHomePreview.tsx`), `PageLayout`/`PageHeader` on 11 pages, the mobile drawer (`AppLayout.tsx:2131`), `HorseIntakeForm.tsx`. Every named checklist is therefore still unrun.
- decision-note: none
- cost-rank: 4
- recommendation: This is the single highest-leverage item in the slice — eleven tasks' worth of "not verified" collapses into one session. Provision one worktree with a real `.env` and `npm ci`, then run the accumulated checklists (PAGEVIS 9-step, REVIEWNAV, NAVMOTION 13-item, PAGEFRAME nine-page screenshot, ONEMENU 390px drawer) in a single browser pass rather than re-opening each task.

## UI-05: Two footer links pointed at the same page
- item: The site footer had "Ways to Ride" and "Book a Lesson" both linking to `/shop`.
- sources: TASK-REVIEWNAV-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: CLOSED BY LATER WORK
- evidence: `src/components/layout/Footer.tsx:40-41` now reads `{ label: 'Ways to Ride', href: '/shop' }` and `{ label: 'Book a Lesson', href: '/lessons' }`, with a comment at :37 naming the fix. `git log --oneline -S"'Book a Lesson', href: '/lessons'" -- src/components/layout/Footer.tsx` → `ffbb296 COUNTFIX 1.5 + 1.2 + 1.3: one definition per number`. Residue: `src/lib/reviewSection.ts:251` still asserts the old state ("site footer — 'Ways to Ride' AND 'Book a Lesson', Footer.tsx:37-38, two links to this one page") and is now false copy shown on the Review page.
- decision-note: none
- cost-rank: 6
- recommendation: Fix the stale sentence in `reviewSection.ts:251` — it is rendered to the owner on the Review page and now contradicts the code.

## UI-06: /app/ops/directory was a live nav entry on an empty page
- item: `/app/ops/directory` had zero rows in production while carrying a live nav entry.
- sources: TASK-REVIEWNAV-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: CLOSED BY LATER WORK
- evidence: `d7b9f49 TASK RECORDS: one page — Leads, Clients, Partners, Vendors, Horses`. The nav row is gone: the only occurrence of `/app/ops/directory` in `AppLayout.tsx` is line 560, inside the comment block at :555-568 recording the three retired rows; the live row is `{ to: '/app/records', label: 'Records', icon: BookOpen }` (:569). The route now redirects: `src/App.tsx:304` → `<Navigate to="/app/records/vendors" replace />`. There is no `DirectoryPage.tsx` left (`find src -name "*Directory*"` → nothing). Separately, the emptiness itself no longer holds: `select count(*) from member_directory` → **9**.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing to do.

## UI-07: Calendar's "+ Booking" interpolates a default start time
- item: `nextBookableSlot()` was invented for Calendar's "+ Booking" because no blank-slate booking flow existed to reuse — the one surface where the PLUSPASS task interpolated rather than wiring an existing control, flagged for the owner.
- sources: TASK-PLUSPASS-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: `src/pages/app/CalendarPage.tsx:64` `function nextBookableSlot(openHour: number, closeHour: number): Date` and its single call site at :208 (`const start = nextBookableSlot(openHour, closeHour);`). Unchanged since the report; no commit in gitlog.txt touches it. No owner ruling recorded anywhere in the worktree.
- decision-note: none
- cost-rank: 3
- recommendation: Owner ruling: is a synthesised default start time acceptable for "+ Booking", or should that control open an empty date/time picker? One function either way.

## UI-08: Business-hours computation was never exercised against live calendar_free_busy
- item: The exact business-hours arithmetic behind the calendar's "+ Booking" default was tested only with empty hours (the page's own not-yet-loaded fallback), never against real `calendar_free_busy` data.
- sources: TASK-PLUSPASS-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: The seam still exists and is still only reachable at runtime: `src/lib/ops/api-calendar.ts:68` calls `supabase.rpc('calendar_free_busy', …)`; `src/pages/app/CalendarPage.tsx:34` documents the page as a read over it. I could not exercise it here — `calendar_free_busy` is an RLS/role-aware RPC and this psql connection has NULL `auth.uid()`, so calling it would prove nothing (per the instructions, an empty RPC result is not evidence). No node_modules, so no component test run either.
- decision-note: none
- cost-rank: 4
- recommendation: Fold into the UI-04 browser pass — open the calendar as staff with real business hours loaded and confirm the default slot lands inside them.

## UI-09: CreateModal gained initialStep and a CreateModalContext beyond the task's literal scope
- item: PLUSPASS added an `initialStep` prop to `CreateModal` and a `CreateModalContext`, disclosed as plumbing rather than a new flow.
- sources: TASK-PLUSPASS-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: Both still present and now load-bearing beyond the original surfaces. `src/components/app/CreateModal.tsx:376` `export function CreateModal({ onClose, initialStep = 'destination' }…)`; `:379` `const [step, setStep] = useState<Step>(initialStep)`. `src/contexts/CreateModalContext` is imported by `AppLayout.tsx:32` (`CreateModalTriggerContext`), `src/pages/app/Home.tsx:8` and `src/pages/app/MyPosts.tsx:6`. `AppLayout.tsx:2199` passes `initialStep={createStep}`. The disclosed deviation was never ruled on; it has since been built upon.
- decision-note: none
- cost-rank: 6
- recommendation: Ratify it. Two more pages now depend on the context; reversing it is no longer a one-line change, and the original disclosure was sound.

## UI-10: The <main> overflow-x-clip backstop was specified but not applied
- item: FRAMESCROLL specified a one-line `overflow-x-clip` backstop on `<main>` and deliberately left it unapplied for the orchestrator to land at merge.
- sources: TASK-FRAMESCROLL-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: CLOSED BY LATER WORK
- evidence: `git log --oneline -S"overflow-x-clip px-4" -- src/components/app/AppLayout.tsx` → `bab6fdd fix(framescroll): apply the <main> overflow-x:clip backstop, proven emitting`. Current code: `src/components/app/AppLayout.tsx:2041` — `<main className="flex-1 min-w-0 overflow-x-clip px-4 sm:px-8 xl:px-12 pt-10 sm:py-9 pb-24">`, with the rationale comment at :2031-2040 (rails are siblings of `<main>`, `clip` avoids the scroll-anchoring regression).
- decision-note: none
- cost-rank: 6
- recommendation: Nothing to do.

## UI-11: `npm run build` fails at the SSR prerender step
- item: The full build pipeline fails at prerender with "supabaseUrl is required" — reported as a pre-existing environment limitation (no `.env` in the worktree), not a code regression.
- sources: TASK-FRAMESCROLL-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: CANNOT DETERMINE
- evidence: I could not reproduce or refute it. `scripts/prerender.mjs` exists. The precondition the report blames is still true — `ls -a` shows `.env.db` only, no `.env`. But `node_modules` does not exist in this worktree either, so `npm run build` cannot reach the prerender step at all; a failure here would prove nothing about the reported cause. Whether Vercel's build (which has real env vars) succeeds is not observable from here.
- decision-note: none
- cost-rank: 4
- recommendation: Confirm against the deploy log rather than locally — if production deploys are green, this is purely a worktree-provisioning gap and belongs with UI-04's "give one worktree a real `.env`".

## UI-12: PostModal's author row lacks the min-w-0 wrapper its sibling has
- item: `PostModal` renders the author name in a bare `<span>` with no `min-w-0`, missing the truncation guard that `CommunityFeed`'s identical pattern carries.
- sources: TASK-FRAMESCROLL-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `src/components/feed/PostModal.tsx:330-338` — `<div className="flex items-center gap-2 mb-2 text-xs text-muted">` containing `{card.author && (<span className="text-green-900"><span className="font-semibold">{card.author}</span>…)`. No `min-w-0` anywhere in that row. The established pattern is intact next door: `src/components/feed/CommunityFeed.tsx:203` `<div className="min-w-0">` wrapping the author paragraph. Unchanged since the report.
- decision-note: none
- cost-rank: 5
- recommendation: One-line fix — wrap PostModal's author/when group in `<div className="min-w-0">` to match CommunityFeed. Low risk, matches an existing local pattern.

## UI-13: The I4 gold-ring vs fill-only active state was judged from hex values
- item: The choice between a gold ring and a fill-only active state for nav rows was made by reading hex values, never by looking at a rendered screen.
- sources: TASK-I-REPORT.md (2026-08-04)
- raised: 2026-08-04
- status: SUPERSEDED BY EVENTS
- evidence: The thing being judged no longer exists. The selected state is no longer a fill or a ring — `src/components/app/AppLayout.tsx:167` `const NAV_ROW_ACTIVE = 'text-green-900 font-medium underline decoration-gold-600 decoration-4 underline-offset-4 …'`. The removal is documented in the same file: `:113` ("THE FIX IS `decoration-gold-600` MOVED INTO THE IDLE HALF") and the RailLink comment at :826-833 ("§B removes that block, so the recorded reason is gone"). `grep -n "ring-gold\|ring-1" src/components/app/AppLayout.tsx` → no nav-row hits. There is no ring and no fill left to compare.
- decision-note: none
- cost-rank: 6
- recommendation: Drop it. The successor question is live as UI-46 (the gold underline's contrast) and UI-47 (what the collapsed rail shows instead).

## UI-14: Twelve findings against the shelved cardstock header
- item: Twelve separate caveats, defects and unverified claims were recorded against `CardstockHeader.tsx` / `header-cardstock.css` — the closed drawer-tab chevron direction, the `.cs-mark svg` stretch trap that would reintroduce BP410's resampling defect, `--cs-tab-right` drift when the avatar grows, the `.tab::after` `translateY(-100%)` deviation from the mockup, iOS-Safari rendering never checked, a 500px overflow, a ≤404px overflow (~2.6px avatar clip at 390px), sub-perceptual pixel residue below 1024px, the `@supports not backdrop-filter` fallback never exercised, the edge-to-edge sheet with no `max-w-[120rem]` cap, the drawer-tab 44px hit-slop reasoned from box math only, and `--cs-hdr-h`/`--cs-tab-right` confirmed by computed style because AppLayout was never mounted.
- sources: TASK-ONEMENU-PHASE1-PLAN.md (2026-08-07, ×3); TASK-BP410-REPORT.md (2026-08-07, ×3); TASK-HEADER-REPORT.md (2026-08-06, ×5); TASK-ONEMENU-REPORT.md (2026-08-07, hit-slop)
- raised: 2026-08-06
- status: SUPERSEDED BY EVENTS
- evidence: Both files are deleted. `git log --oneline --diff-filter=D -- '*CardstockHeader*' '*header-cardstock*'` → `ff10e1d fix(mobilepass): correct stale scrim comment, delete dead cardstock files`. `ls src/components/app/CardstockHeader.tsx src/components/app/header-cardstock.css` → No such file or directory. The stylesheet is no longer imported (`AppLayout.tsx:2064-2065`: "The `.cs-drawer-tab` rules ride out with the shelved cardstock stylesheet, which is no longer imported"), and the drawer tab itself is gone — `grep -rn "drawer-tab\|DrawerTab" src` returns only that comment. The replacement is `src/components/app/AppHeader.tsx` + `app-header.css`, which independently answers three of the twelve: it declares **no** `backdrop-filter` at all (`app-header.css:54-57`, so there is no fallback branch to exercise), it runs edge-to-edge **by design** (`:45` "the surface runs edge to edge"), and it has explicit narrow tiers at 600/400px and a landscape tier (`:473, :503, :522`) written to survive 320px. The source is preserved, not lost: `docs/reference/shelved-cardstock-header/` holds `CardstockHeader.tsx.txt`, `header-cardstock.css.txt` and a README.
- decision-note: none
- cost-rank: 6
- recommendation: Close all twelve — but attach this list to `docs/reference/shelved-cardstock-header/README.md`. If the owner ever un-shelves the cardstock nameplate, these twelve are the known-defect list it comes back with, and rediscovering them would cost another BP410.

## UI-15: The drawer header row would look off-balance after the Close button was removed
- item: Removing the tenant Close button left the drawer's header row a single child under `justify-between`, a layout cleanup deferred to a later phase.
- sources: TASK-ONEMENU-PHASE1-PLAN.md (2026-08-07)
- raised: 2026-08-07
- status: CLOSED BY LATER WORK
- evidence: `git log --oneline -S'<span aria-hidden="true" />' -- src/components/app/AppLayout.tsx` → `1f562b6 fix(nav): tooltip portal, panel surface, selected state, and the small items`. Current code, `src/components/app/AppLayout.tsx:2146-2154`: the row is `<div className="flex items-center justify-between px-1 pt-1 pb-4">` with an explicit `<span aria-hidden="true" />` spacer as the first child and the Close button rendered only `{isSuperAdmin && …}`. The single-child imbalance is resolved by the spacer; for tenants the row is a deliberate top spacer.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing to do, though the tenant row is now a pure spacer with `pb-4` — if the browser pass (UI-04) shows dead space at the drawer top, it collapses to a padding change on the `<nav>`.

## UI-16: RailLink sets no explicit aria-current
- item: `RailLink` relies on React Router's `NavLink` to emit `aria-current="page"` implicitly; the assumption was flagged rather than tested at runtime.
- sources: TASK-ONEMENU-PHASE1-PLAN.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: Still exactly as reported. `src/components/app/AppLayout.tsx:803-816` — `RailLink` renders `<NavLink to={to} end={end} aria-label={…} className={({isActive}) => …}>` with no `aria-current`. Every *other* nav component in the same file sets it explicitly: `:876` (`Link … aria-current={isActive ? 'page' : undefined}`), `:898` AccountNavLink, `:966` and `:1023` CommunityNav, `:1076`. So RailLink is the lone exception, which is the shape of an oversight rather than a deliberate reliance. I could not confirm the library's behaviour here — `node_modules` does not exist, so React Router's source is not readable and no runtime test can be run.
- decision-note: none
- cost-rank: 5
- recommendation: Assert it rather than infer it — either add `aria-current` explicitly for consistency with the file's other five components, or add one render test. Cheaper than depending on a library internal nobody in this repo has checked.

## UI-17: timeOfDayWord's fourth 'night' bucket was mapped to "Evening"
- item: `timeOfDayWord()` has a fourth `night` bucket (21:00–03:59) that the Dashboard greeting spec (Morning/Afternoon/Evening) does not cover, so it was mapped to "Evening" — a disclosed deviation.
- sources: TASK-PAGETITLES-REPORT.md (2026-08-05)
- raised: 2026-08-05
- status: STILL OPEN
- evidence: Both halves unchanged. `src/lib/formatDateTime.ts:26-32` still returns four values including `'night'` for 21:00–03:59. `src/pages/app/DashboardHome.tsx:13-18` — `DAYPART_LABEL` maps `night: 'Evening', // greeting has no "night" bucket — falls back to Evening`. Consumed at `:25`. No owner ruling recorded.
- decision-note: none
- cost-rank: 6
- recommendation: Ask the owner for the fourth word (or confirm "Evening"). Note `src/components/app/DashboardPanel.tsx:380` renders the raw word — "Enjoy your night!" — so the two surfaces already disagree at 22:00.

## UI-18: The rail's X-axis box-shadow may be clipped by the same nav's overflow-x-hidden
- item: UIO-001's new rail shadow projects on exactly the axis the `<nav>` carrying it clips with `overflow-x-hidden`; if it is invisible in a browser the fix is structural.
- sources: TASK-UIBUILD-LOG.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: The exact combination is still on both rails. `src/components/app/AppLayout.tsx:1261` — `<nav className="sticky top-[var(--cs-hdr-h)] … overflow-y-auto overflow-x-hidden … oh-rail-shadow">`, and `:1853` the staff rail, identically `overflow-x-hidden … oh-rail-shadow`. The rule is `src/components/app/app-header.css:104-107` — `.oh-rail-shadow { box-shadow: 2px 0 4px …, 6px 0 18px …; }`, both offsets purely +X. Nothing between the report and HEAD touches either. I did not resolve whether the clip actually bites (an element's own `overflow` clips its descendants, not its own outer box-shadow — the risk is an *ancestor's* clip, and `<main>` now carries `overflow-x-clip` at :2041 though it is a sibling, not an ancestor), so the report's premise is neither confirmed nor refuted without a render.
- decision-note: none
- cost-rank: 5
- recommendation: One screenshot in the UI-04 pass settles it. If the shadow is missing, the ancestor chain is the thing to inspect, not the nav's own overflow.

## UI-19: The :active gradient-alpha transition's smoothness is inferred, not seen
- item: `button.oh-avatar` animates a `linear-gradient`'s alpha via `transition: background`; whether it reads as a smooth press was inferred from CSS interpolation rules.
- sources: TASK-UIBUILD-LOG.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: `src/components/app/app-header.css:273-279` — `button.oh-avatar { background: linear-gradient(rgba(255,255,255,.14), rgba(255,255,255,.14)), theme('colors.green.800'); … transition: background .18s ease; }`. Unchanged. The file itself records at :299-305 that the `:active`/open pairing makes the click "invisible" and that the fix is "a design choice the order asks to see rendered rather than have picked here — see docs/reference/uio-006-open-state-options.html". So there are now two unrendered questions stacked on this one control.
- decision-note: none
- cost-rank: 6
- recommendation: Bundle with UI-21 — the avatar's hover, active and open states are one visual decision the owner should see together (the options file already exists), not three separate flags.

## UI-20: Whether overscroll-behavior contains the drawer's iOS scroll chaining is unconfirmed
- item: The mobile drawer's body-scroll lock was removed in favour of `overscroll-behavior`; whether that actually contains scroll chaining on iOS Safari — the entire reason the lock existed — is unconfirmed in either direction.
- sources: TASK-UIBUILD-LOG.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: The lock is gone and the replacement is in place: `grep -n "document.body.style" src/components/app/AppLayout.tsx` → zero hits; the drawer at `:2131` carries `overflow-y-auto overscroll-contain`, and `:1567` documents the same choice for the rail. No iOS device is reachable from this environment (no `.env`, no node_modules, no dev server). The order's instruction was to STOP and report rather than reinstate the lock if it fails — so no code change is pending, only a device check.
- decision-note: none
- cost-rank: 4
- recommendation: This one genuinely needs a physical iPhone, not a browser emulator — `overscroll-behavior` on iOS Safari is exactly where emulators lie. Highest-value single item in the UI-04 checklist to do on real hardware.

## UI-21: 7% hover fill was an interpretation of an unspecified value
- item: The avatar's hover fill shipped at 7% white — the arithmetic midpoint of the specified 14%/0% ramp — as a principled interpolation of an unspecified value, flagged in case the read was wrong.
- sources: TASK-UIBUILD-LOG.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: `src/components/app/app-header.css:294-297` — `button.oh-avatar:hover { background: linear-gradient(rgba(255,255,255,.07), rgba(255,255,255,.07)), theme('colors.green.800'); }`, inside the `@media` hover guard, with the UIO-006 rationale at :280-293. Value unchanged; no owner ruling recorded.
- decision-note: none
- cost-rank: 6
- recommendation: One number. Show it to the owner alongside UI-19's open-state options in the same pass.

## UI-22: The apple-touch-icon PNG's font resolution is machine-specific
- item: The apple-touch-icon was rendered by the build machine's Chrome, so which face in the `Big Caslon` stack actually resolved — and how it renders for end users — is unknown.
- sources: TASK-UIBUILD-LOG.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: Both artifacts still ship as reported. `public/apple-touch-icon.png` (2902 bytes) and `public/favicon.svg` (403 bytes), the latter at line 5 carrying `font-family="'Big Caslon', 'Libre Caslon Text', Georgia, serif"`. `app-header.css:142-146` shows the same stack is the app's own. The PNG is a raster, so whatever face resolved at generation time is now baked in and cannot be inspected from the file.
- decision-note: none
- cost-rank: 6
- recommendation: If it matters, regenerate the PNG from an explicitly-embedded font rather than a font-stack lookup — that removes the class of problem instead of verifying one instance of it. Otherwise accept: it is a 180px home-screen icon.

## UI-23: The NAV_DIVIDER colour was only confirmed to have stopped being wrong
- item: Six `NAV_DIVIDER` sites went from silently rendering `currentColor` (a failed `border-green-900/12`) to the declared faint wash; whether the declared colour actually reads right at each site was never checked.
- sources: TASK-UIBUILD-LOG.md (2026-08-10)
- raised: 2026-08-10
- status: STILL OPEN
- evidence: `src/components/app/AppLayout.tsx:254` — `const NAV_DIVIDER = 'border-green-900/12';`, unchanged. Live render sites today: `:1205`, `:1890`, `:1915`, `:1945`, `:2167` — five, not six (the count moved with TASK-RECORDS' nav consolidation); `:1252` is a comment referencing the constant. The two rails use their own literals (`border-green-900/12` at :1261, `border-green-950/20` at :1853), so the divider weight is *not* actually uniform across the nav — which is a second, unreported inconsistency at the same sites.
- decision-note: none
- cost-rank: 6
- recommendation: Add to the UI-04 checklist, and while there resolve the rail literals — one nav should not carry two divider weights (`green-900/12` vs `green-950/20`) as hand-written values next to a constant that exists for exactly this reason.

## UI-24: name_needs_confirmation can never be raised again
- item: Only the one-time 2026-07-30 backfill ever set `name_needs_confirmation` true; no live path re-arms it when a name conflict arises after that date, so the confirm-name modal can never fire for a new conflict.
- sources: TASK-ACCTEVAL-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: STILL OPEN
- evidence: Prod SQL. Column location: `select table_name from information_schema.columns where column_name='name_needs_confirmation'` → `contacts`. Every function referencing it: `select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc ilike '%name_needs_confirmation%'` → `confirm_my_legal_name`, `my_name_confirmation_state` — a clearer and a reader, no setter. Every function that *raises* it: `select p.proname from pg_proc p where p.prosrc ~* 'name_needs_confirmation\s*=\s*(true|TRUE)'` → **zero rows**. Only migration touching it: `supabase/migrations/20260730150000_name_consolidation_s7.sql` (the backfill). Current state: `select count(*) filter (where name_needs_confirmation), count(*) from contacts` → **1 of 32** still flagged. The UI is live and wired: `src/components/app/ConfirmNameModal.tsx:20`, mounted at `src/pages/app/ContractPage.tsx:2301`, reading/writing via `src/lib/api.ts:783,793`.
- decision-note: none
- cost-rank: 2
- recommendation: Decide whether the mechanism is meant to be ongoing. If yes, it needs a trigger or a call site that raises the flag on a name conflict — right now a working modal guards a flag nothing can ever set, and one contact is stranded holding the last one from July.

## UI-25: "Horse records" may wrap at the narrowest viewports
- item: A two-line wrap of the "Horse records" page name at 320–375px could not be ruled out — a wrap, not a horizontal scrollbar — and was named as the one page worth a manual look.
- sources: TASK-ADDNEW-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: STILL OPEN
- evidence: The exact configuration is unchanged. `src/pages/app/ops/HorseRecordsPage.tsx:230-235` renders `<PageLayout name="Horse records" addLabel="horse" onAdd={…} description=…>`; `PageLayout` delegates to `PageHeader` (`src/components/app/PageLayout.tsx:2,45`). `src/components/app/PageHeader.tsx:78-95` — row 1 is `<div className="flex items-end justify-between gap-4 min-h-[40px] mb-3">` with `<p className="eyebrow">{name}</p>` beside a `shrink-0` 40px-tall "Add New" button. The eyebrow has no `shrink-0` and no `whitespace-nowrap`, so it is the element that gives — a wrap, exactly as reported, and unfalsifiable without a render.
- decision-note: none
- cost-rank: 6
- recommendation: One line in the UI-04 pass at 320px. If it wraps and that reads badly, the fix is on `PageHeader` (`min-w-0` + a narrower type step), not on this page — 11 pages share the component.

## UI-26: InstructorHome rendered availability slots as lessons
- item: `listLessonSessions` did not filter by status, so InstructorHome showed 279 open availability slots among 318 rows as "Scheduled" lessons — overstating a trainer's day roughly fivefold, and wrong in the flattering direction.
- sources: TASK-ADMINSWEEP-PHASE2.md (2026-08-11)
- raised: 2026-08-11
- status: CLOSED BY LATER WORK
- evidence: `git log --oneline -S"neq('status', 'available')" -- src/lib/ops/api-lessons.ts` → `ffbb296 COUNTFIX 1.5 + 1.2 + 1.3: one definition per number`. Current code, `src/lib/ops/api-lessons.ts:317-326`: the query is `.from('bookings').select(LESSON_BOOKING_COLS).eq('kind','lesson').neq('status','available').order('starts_at')`. The complement was given its own named function rather than folded in — `:328-334` documents "The COMPLEMENT of `listLessonSessions()`… so a staff surface can say '39 lessons · 279 open slots' instead of quietly folding the slots into the lesson count, which is what produced COUNTFIX 1.3", with `countOpenLessonSlots()` at `:335`. InstructorHome consumes the fixed reader at `src/pages/app/InstructorHome.tsx:118`.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing to do. The counts on the page itself are still unrendered — that part sits in UI-04.

## UI-27: App.tsx is a shared route-registration file claimed by no branch
- item: `App.tsx` is a shared surface that no live branch owns, flagged because route registration is where parallel UI threads collide.
- sources: TASK-ADMINSWEEP-PHASE2.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: Still one shared route table with no owner recorded. `src/App.tsx` registers everything in this slice — `:286` the instructor-home preview, `:304` the directory redirect, `:306` `ops/horses`, `:326` the availability redirect, `:347-349` the three lesson children. No `CODEOWNERS` file and no ownership note in `CLAUDE.md` for it. `AppLayout.tsx` carries an explicit shared-file note (`:1810`, and see UI-30) but `App.tsx` carries none.
- decision-note: none
- cost-rank: 3
- recommendation: Give it the same treatment `AppLayout.tsx` got — a header comment naming it a shared surface and the merge rule for it. Cheap, and it is the file most likely to silently lose a route in a bad merge.

## UI-28: glass.nav in tailwind.config.js has no reader
- item: After `NAV_GLASS` was removed, the `glass.nav` theme colour has no consumer; it was left in place because removing a theme colour was called a separate decision.
- sources: TASK-ONEHEADER-REPORT.md (2026-08-08)
- raised: 2026-08-08
- status: STILL OPEN
- evidence: `tailwind.config.js:86-88` still declares `glass: { nav: '#09975e' }` with a hue-compensation comment above it at :82-85. `grep -rn "NAV_GLASS" src` → **zero hits**. `grep -rn "glass-nav\|glass\.nav" src test` → one hit, `src/components/app/AppLayout.tsx:56`, and it is prose in a comment ("`glass.nav` in tailwind.config.js was the compensated base"), not a class. So the token is genuinely dead and its only remaining trace is documentation of why it existed.
- decision-note: D15 (a linked file is never removed from the system) is about files, not theme tokens — recorded only, and it does not bear on a config key with no readers.
- cost-rank: 6
- recommendation: Delete the token and keep the comment. The hue-compensation *method* documented above it is the valuable part and should move to wherever the nav fill colours are now derived.

## UI-29: Superadmin chrome is 56px while the rails stick at 76px
- item: Superadmin's chrome is `h-14` (56px) but the nav rails position themselves at the tenant header height (76px), leaving a 20px gap — pre-existing, and left alone because superadmin chrome was explicitly out of scope.
- sources: TASK-ONEHEADER-REPORT.md (2026-08-08)
- raised: 2026-08-08
- status: STILL OPEN
- evidence: `src/components/app/AppLayout.tsx:1752` — the superadmin bar is `… px-4 sm:px-8 h-14`, the only `h-14` in the file. `src/components/app/app-header.css:39` — `:root { --cs-hdr-h: 76px; }`. Both rails key off the variable regardless of which chrome is above them: `:1261` `sticky top-[var(--cs-hdr-h)] h-[calc(100dvh-var(--cs-hdr-h))]` and `:1853` identically. So under superadmin chrome the rails start 20px below its bottom edge and run 20px past the viewport. Unchanged since the report.
- decision-note: D1a (the platform owner is not a tenant) bears on *why* superadmin chrome is separate — recorded only; it is not a reason to leave a 20px gap.
- cost-rank: 5
- recommendation: Either set `--cs-hdr-h: 56px` on the superadmin branch (the variable already exists for exactly this) or give the rails a superadmin-aware offset. The variable indirection means this is a one-line scoped override, not a refactor.

## UI-30: AppLayout.tsx is a contended shared file
- item: `AppLayout.tsx`, `CardstockHeader.tsx` and `header-cardstock.css` were shared between concurrent branches, with ONEHEADER holding them and only `AppLayout.tsx` a real conflict surface.
- sources: TASK-ONEHEADER-REPORT.md (2026-08-08)
- raised: 2026-08-08
- status: STILL OPEN
- evidence: Two of the three files are gone (see UI-14: deleted in `ff10e1d`), so the contention narrowed to the one file the report already named as the real risk — and that file has grown into the largest surface in the slice. `ls -la src/components/app/AppLayout.tsx` → **133,918 bytes**, ~2,200 lines. It is touched by essentially every family here: UI-02/03 (nav rows), UI-06, UI-13, UI-15, UI-16, UI-18, UI-20, UI-23, UI-29, UI-31, UI-43, UI-46/47/48, UI-50, UI-51. `:1810` carries the shelved-cardstock note; nothing records current ownership.
- decision-note: none
- cost-rank: 3
- recommendation: The file-split-vs-ONEMENU question was raised and honoured once before (per the ACCOUNTSURFACE session). At 134KB with fifteen open items pointing into it, it is worth re-asking the owner — but as a scheduled task with a merge freeze, never opportunistically alongside another change.

## UI-31: Nav resize was not built because the drawer's dimensions are recorded nowhere
- item: ONEHEADER §5's "nav resize — the drawer's dimensions, per the owner" was not built: the dimensions exist in no document, and the author declined to invent a number.
- sources: TASK-ONEHEADER-REPORT.md (2026-08-08)
- raised: 2026-08-08
- status: STILL OPEN
- evidence: The drawer is still at the original values — `src/components/app/AppLayout.tsx:2131`: `className="absolute inset-y-0 left-0 w-72 max-w-[85vw] …"`. `w-72` = 288px. No dimension is recorded in `CLAUDE.md` (D1–D15 contain none) and `grep` finds no drawer-width note in the task docs. Still blocked on the same missing input.
- decision-note: none
- cost-rank: 3
- recommendation: Ask the owner for one number, or close the item as "current width accepted". It has been blocked for five days on a question nobody has put to him directly.

## UI-32: The header drop shadow was shipped as-is pending owner judgement
- item: The cardstock header shipped with `0 6px 18px rgba(24,38,32,.14)` and the shadow decision was deferred for judgement against real scrolling content.
- sources: TASK-HEADER-REPORT.md (2026-08-06)
- raised: 2026-08-06
- status: CLOSED BY LATER WORK
- evidence: The owner made the call and it is implemented. `src/components/app/app-header.css:58-63` records it verbatim — "UIO-001, owner 2026-08-10: 'the line will look better [than the drop shadow], and then we can use the drop shadow on the sidebar nav and subheader… because the drop shadow over the sidebar coming down from the header looks weird'". The header is now flat and opaque with a hairline (`:50-57`, `background-color: #f5f0e8`, no `backdrop-filter`), and the shadow moved to the rails as `.oh-rail-shadow` (`:104-107`), consumed at `AppLayout.tsx:1261,1853`.
- decision-note: none
- cost-rank: 6
- recommendation: Nothing to do — but note the relocated shadow is itself unverified, which is UI-18.

## UI-33: A pre-existing UI test was reported failing on origin/main
- item: ADDITEM reported that `test/ui/wallreturn_applayout.test.tsx`'s "defaults to the destination menu" fails on origin/main and still fails — not that task's doing.
- sources: TASK-ADDITEM-REPORT.md (2026-08-12)
- raised: 2026-08-12
- status: CANNOT DETERMINE
- evidence: The report misattributes the test. `grep -n "it(\|describe(" test/ui/wallreturn_applayout.test.tsx` → five tests, all about the signing wall's redirect and destination capture; **none** is named "defaults to the destination menu". `grep -rn "defaults to the destination menu" test src` → exactly one hit: `test/ui/pluspass_create_controls.test.tsx:61` — `it('defaults to the destination menu (unchanged header behavior)', …)`, which is PLUSPASS's header-behaviour assertion (see UI-09). Whether it currently fails I could not establish: `node_modules` does not exist, so vitest cannot run, and per instructions `test:db` is not citable.
- decision-note: none
- cost-rank: 4
- recommendation: Re-run `test/ui/pluspass_create_controls.test.tsx` — not the wallreturn file — once a worktree has dependencies. Given UI-09 shows `CreateModal` grew an `initialStep` prop after that test was written, a genuine failure there is plausible and would mean the header's default step regressed.

## UI-34: SessionNotesView's optimistic append invents no id or created_at
- item: The optimistic append after a successful note submit mirrors ReportCard's pattern including its limitation — the appended row carries no real id or timestamp.
- sources: TASK-F3-REPORT.md (no header date)
- raised: unknown (report carries no date; sits in the 2026-08 window)
- status: STILL OPEN
- evidence: `src/components/app/SessionNotesView.tsx:43-45` — the optimistic entry is `{ author_role: 'rider', author_name: 'You', phase, body: text.trim(), created_at: '' }`. The empty-string timestamp is still there, and there is no id field at all. The authoritative reload path exists at `:30` (`setNotes(r.notes ?? [])`) but is not triggered by the append.
- decision-note: none
- cost-rank: 5
- recommendation: Low-priority, but the empty `created_at` will render as an invalid date the moment any consumer formats it. Either omit the field and have the renderer treat "no timestamp" as "just now", or refetch after submit.

## UI-35: About.tsx's "The Facility" eyebrow collides with the tenant's chosen word
- item: About.tsx's "The Facility" eyebrow sits next to FHE's chosen facility word ("ranch") — the same collision the owner ruled on for "barn", but outside the literal grep scope, so left as-is.
- sources: TASK-FACILITYTERM-REPORT.md (no explicit header date)
- raised: unknown (FACILITYTERM landed 2026-08-11)
- status: STILL OPEN
- evidence: `src/pages/App… ` — `src/pages/About.tsx:120` `<p className="eyebrow mb-5">The Facility</p>`, with the section comment at `:110`. Unchanged. The tenant-word mechanism FACILITYTERM built does not reach it: this is a literal string on a public marketing page, not a token.
- decision-note: none
- cost-rank: 6
- recommendation: Sweep it with the deferred barnops-family rename rather than alone — the same question ("which surfaces take the tenant word and which are fixed marketing copy") answers both.

## UI-36: seed.ts's feed description says "around the stables"
- item: `FEED_VIEW_META.all.description` in seed.ts already said "around the stables" — a pre-existing facility-word inconsistency outside FACILITYTERM's scope.
- sources: TASK-FACILITYTERM-REPORT.md (no explicit header date)
- raised: unknown (FACILITYTERM landed 2026-08-11)
- status: STILL OPEN
- evidence: `src/lib/seed.ts:35` — `all: { title: 'Community Feed', navLabel: 'All posts', description: 'A place to welcome new members, share your experiences or views from around the stables, and helpful links, tack, or gear you no longer use that others may need' }`. Unchanged.
- decision-note: none
- cost-rank: 6
- recommendation: Same sweep as UI-35. Note this one is seed copy, so it may reach a real screen on an empty feed — slightly more visible than the About eyebrow.

## UI-37: The N/A disabled-field colour is blocked on an owner choice
- item: HorseIntakeForm step 3's N/A treatment is blocked — the tan `cream-100` disabled background was not replaced because the author would not pick among four verified options without the owner.
- sources: TASK-HORSEINTAKE-REPORT.md (no explicit header date)
- raised: unknown (2026-08 window)
- status: STILL OPEN
- evidence: `src/components/app/HorseIntakeForm.tsx:34` — `const input = 'w-full px-3 py-2 rounded-lg border border-green-800/15 … disabled:bg-cream-100 disabled:text-muted';`. Still `cream-100`, still the shared `input` constant used by every field in the form. The N/A mechanism it applies to is at `:47-77` and `:35` (`const NA = 'N/A'`).
- decision-note: none
- cost-rank: 3
- recommendation: One class, four options already prepared, owner has not been asked since. Put it in the same question as UI-38 — they are one colour conversation about one form.

## UI-38: border-red-400 may be too quiet as the error state
- item: The form's error border (`border-red-400`) was left unchanged because whether it is too quiet is a colour decision belonging with the owner.
- sources: TASK-HORSEINTAKE-REPORT.md (no explicit header date)
- raised: unknown (2026-08 window)
- status: STILL OPEN
- evidence: `src/components/app/HorseIntakeForm.tsx` — four independent error-state sites all still on `border-red-400`: `:71` (`RequiredField`), `:131` (the coded/Other field), `:182` (the contact block), `:227` (the paired-column block). Unchanged.
- decision-note: none
- cost-rank: 3
- recommendation: Ask alongside UI-37 in one pass, and note it is four sites sharing one token — so the answer is a token change, not four edits.

## UI-39: New-records-only vs existing for the euthanasia change
- item: An open owner question — whether the euthanasia-authorization change applies to new records only or existing ones too; nothing needed migrating either way because every horse on file was already option B.
- sources: TASK-HORSEINTAKE-REPORT.md (no explicit header date)
- raised: unknown (2026-08 window)
- status: STILL OPEN
- evidence: Prod SQL: `select euthanasia_authorization, count(*) from horses group by 1` → `B|4`. The premise still holds (all horses are B) and the herd has grown from 3 to 4 without changing the answer, so no migration is owed yet — but the question is still unanswered. The form still requires the choice: `src/components/app/HorseIntakeForm.tsx:688` (`euthanasiaAnswered`), enforced at `:700`, `:717` and `:754-755` ("Please choose an emergency euthanasia authorization (Option A or B).").
- decision-note: none
- cost-rank: 3
- recommendation: Answer it while the answer is still free — it costs nothing at 4 horses and becomes a migration the first time someone records an A.

## UI-40: Which of six save failures the user actually hit is unknowable
- item: Six distinct failure modes in `create_horse_record` were fixed rather than guessed between, because a failed INSERT leaves no row and no audit entry, so which one Claire hit cannot be recovered from the database.
- sources: TASK-HORSEINTAKE-REPORT.md (no explicit header date)
- raised: unknown (2026-08 window)
- status: CANNOT DETERMINE
- evidence: The claim is unfalsifiable by construction, and I confirmed the premise rather than the answer: `select proname from pg_proc where proname='create_horse_record'` → the function exists, and it is a write path — a rejected INSERT writes nothing to `horses` and nothing to `audit_logs` (audit rows are written by triggers on successful writes). There is no error-capture table to query. Fixing all six was the correct response to an unanswerable question.
- decision-note: none
- cost-rank: 6
- recommendation: Close it as answered-by-construction. The reusable lesson is the gap it exposes: failed writes are invisible in this system. If that recurs, the fix is an error-capture path, not better forensics.

## UI-41: The three material languages (MOBILEPASS C2) were never implemented
- item: C2 — giving the header, nav and buttons three distinct material languages — was correctly not implemented because the owner said it goes last, and its premise partly changed when ONEHEADER landed.
- sources: TASK-MOBILEPASS-REPORT.md (2026-08-08)
- raised: 2026-08-08
- status: STILL OPEN
- evidence: Not built. `grep -rn "material language\|three material" src` → zero hits in source (only the task doc `docs/tasks/TASK-MOBILEPASS-nav-header-material.md`, the report, and this harvest's own working files). `grep -rn "leather" src/components/app/app-header.css` → zero hits, so the leather track (paused per the 2026-08-06 session) never reached the app header. The premise did change as predicted: the cardstock material is shelved entirely (UI-14) and the header is now flat opaque `#f5f0e8` (`app-header.css:57`).
- decision-note: none
- cost-rank: 3
- recommendation: Re-specify before building. The task doc predates the cardstock shelving and the ONEHEADER adoption, so "three material languages" no longer describes the surfaces that exist — building it from the current doc would implement a header that is gone.

## UI-42: /app/ops/horses is a third horse surface nobody can open
- item: `HorsesPage` at `/app/ops/horses` has zero references anywhere outside its route registration — a third horse page over the same handful of horses, reachable only by typing the URL.
- sources: TASK-ADMINSWEEP-PHASE1.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `grep -rn "HorsesPage" src` → four hits: `src/App.tsx:83` (import), `:306` (the route), `src/components/ops/horses/HorseForm.tsx:13` (a comment), `src/pages/app/ops/HorsesPage.tsx:30` (the definition itself). `grep -n "ops/horses" src/components/app/AppLayout.tsx` → **zero** — no nav row. The only thing that names it as a candidate is `src/lib/reviewSection.ts:107`, which describes it as "Routed, but nothing has linked to it since. It is the only one that resolves breed/colour lookups to names." So it is in the Review queue as Horses slot C, awaiting the owner's pick — not merely orphaned.
- decision-note: D15 (a linked file is never removed from the system) does not bear — this is an unlinked page, not a stored file. Recorded only.
- cost-rank: 4
- recommendation: Owner picks one of the three horse surfaces in the Review queue. Its one distinguishing feature (resolving breed/colour codes to names) should be harvested into the winner before the losers are retired, or it is lost with them.

## UI-43: mod.brokerage is enabled with no nav entry and no hub page
- item: `mod.brokerage` is entitled for the tenant but has no nav row and no hub page — an enabled module with no surface.
- sources: TASK-ADMINSWEEP-PHASE1.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: Prod: `select module_key, enabled from org_modules` → `mod.brokerage | t` (along with barnops, boarding, employees, horserecords, lessons — all `t`). Code: `src/components/app/AppLayout.tsx:587-589` — `MODULES_GROUP` opens with the comment "Brokerage has no staff hub page yet (mod.brokerage's live surfaces are the client-lane engagement reads) — the entry linked to an unregistered route and 404'd for every staff user with the module on. Re-add with the hub." So the nav row was *removed* because it 404'd; the module is still on and still surface-less. `src/pages/app/ops/OpsDashboard.tsx:106` records the same ("mod.brokerage has no hub page, so the registry yields no entry for it"), while `:113` still lists `{ moduleKey: 'mod.brokerage', label: 'Brokerage' }`.
- decision-note: D13 (owner changes it without a developer) bears — an entitlement the owner can toggle that produces no surface is a gap in that model. Recorded only.
- cost-rank: 4
- recommendation: Two coherent options: build the hub, or gate the entitlement so a module with no registered hub cannot be enabled. The current state — on, listed on the dashboard, unreachable in the nav — is the worst of the three.

## UI-44: /app/ops/availability is a dormant legacy redirect
- item: `/app/ops/availability` is a redirect with no nav entry and no inbound links; its target moved to the calendar long ago.
- sources: TASK-ADMINSWEEP-PHASE1.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `src/App.tsx:325-326` — `{/* ops/availability retired — staff manage availability on the full calendar (Phase 6) */}` then `<Route path="ops/availability" element={<Navigate to="/app/calendar" replace />} />`. `grep -rn "ops/availability" src` returns only those two lines: no nav row, no in-app link. Genuinely dormant, and harmless — it costs one route entry and serves any surviving bookmark.
- decision-note: D15 recorded only; it concerns files, not routes.
- cost-rank: 6
- recommendation: Leave it. A one-line redirect that catches old bookmarks is cheaper than the broken link deleting it would create. Worth listing in a "retired routes" note so it is not rediscovered as dead code a third time.

## UI-45: Horse-care offerings exist in the database with no page, nav entry, label or module
- item: The horse-care offerings are correctly segmented in the database but have no page, no nav entry, no label and no module — inventory with no surface.
- sources: TASK-ADMINSWEEP-PHASE1.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: Prod: `select segment, count(*) from offerings group by 1` → `acquisition|11`, `horse|16`, `rider|16`. The horse segment has **grown from the reported 12 to 16** while remaining surface-less. `grep -n "segment.*horse\|'horse'" src/components/app/AppLayout.tsx` → zero hits, so still no nav row and no module gate for it. (A public-side funnel exists — `src/pages/BookHorse.tsx`, `src/pages/app/CareHome.tsx` — but that is the client lane, not the staff surface the finding is about.)
- decision-note: D13 bears — the owner is adding horse-care SKUs he cannot see or manage in the app. Recorded only.
- cost-rank: 4
- recommendation: Raise the priority. This is no longer static inventory: four SKUs were added since the finding, so someone is maintaining a catalogue through a surface that does not exist. Worth confirming with the owner where he is editing them today.

## UI-46: The gold underline measures 2.66:1, below the 3:1 non-text contrast floor
- item: The gold rule used for both hover and the selected indicator measures 2.66:1 against the nav panel, under WCAG's 3:1 floor for non-text contrast; `decoration-gold-800` (5.58:1) is a one-token alternative that was deliberately not taken.
- sources: TASK-NAVMOTION-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `src/components/app/AppLayout.tsx:167` — `NAV_ROW_ACTIVE = 'text-green-900 font-medium underline decoration-gold-600 decoration-4 underline-offset-4 …'`. `:124` — `NAV_ROW_IDLE` carries the same `decoration-gold-600` on hover. The alternative is recorded in the file at `:164` ("to clear 3:1, `decoration-gold-800` measures 5.58:1 and is a one-token change") and not taken. `gold-600` is also used at `:1024` for the community row. Unchanged since the report.
- decision-note: none
- cost-rank: 5
- recommendation: Owner call, and worth pressing: since UIO-013 removed the fill, this underline is the *only* carrier of the selected state on labelled rows — an indicator below the contrast floor is a different risk than a decorative hover was. One token, three sites.

## UI-47: The collapsed 56px rail's selected state is icon tone alone
- item: In the collapsed rail the underline has no text to sit under, so the selected state is carried by icon tone alone — the one surface where the removed fill was doing work nothing replaced.
- sources: TASK-NAVMOTION-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `src/components/app/AppLayout.tsx:1440` — `const staffRailWidthClass = staffRailPinned ? 'w-60 xl:w-64' : 'w-14';` (`w-14` = 56px). `RailLink` at `:826` renders the label only when open — `{open && <span className="flex-1">{label}</span>}` — while the row class still applies `NAV_ROW_ACTIVE`, whose entire selected treatment is `underline decoration-gold-600`. With no label, `text-decoration` has nothing to draw on. The only remaining differentiator is `:821`, `className={isActive ? NAV_ICON_ACTIVE : NAV_ICON_IDLE}` — i.e. `text-green-900` (`:193`) vs `text-green-800/70` (`:176`). That is a tone step on an icon, and it is the whole indicator.
- decision-note: none
- cost-rank: 5
- recommendation: This is the strongest of the three nav-contrast items (UI-46, UI-47, UI-48) and I would raise it first: green-900 against green-800/70 is a very small step to carry "you are here" alone. Options are a left edge-marker, a dot, or restoring a subtle fill in the collapsed state only.

## UI-48: The growing-underline animation was not built
- item: NAVMOTION §A's optional growing-underline animation was not built — `text-decoration` cannot animate, so it needs a `background-image` gradient with a `background-size` transition on every nav label span across nine row components.
- sources: TASK-NAVMOTION-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: Not built. `grep -n "background-size\|bg-\[length\]" src/components/app/AppLayout.tsx` → zero hits. The selected/hover treatment is still pure `text-decoration`: `:167` (`NAV_ROW_ACTIVE`), `:124` (`NAV_ROW_IDLE` hover), `:1024` (community row). The nine row components named in the report are all still separate (`RailLink` :803, the `:876` link, `AccountNavLink` :893, `CommunityNav` :966/:1023/:1076, `NavFooter`). Reported per the order's instruction, correctly.
- decision-note: none
- cost-rank: 6
- recommendation: Do not build it as specified. Nine components each needing a gradient span is a large change for an optional flourish, and it would collide with UI-46 and UI-47 (both of which may change what the indicator *is*). Settle the indicator first; animate whatever survives.

## UI-49: The landscape header tier has the tightest clearance in the file
- item: The phone-landscape header tier gives 42px marks only ~7px of clearance in a 56px header — the smallest in the file — and if it reads cramped the sanctioned fix is raising that tier's height, not shrinking the mark.
- sources: TASK-NAVMOTION-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `src/components/app/app-header.css:517-530` — `@media (max-height: 500px) and (orientation: landscape) and (pointer: coarse) { :root { --cs-hdr-h: 56px; } … }` with the file's own note: "THIS IS THE TIGHT TIER and the order names it: 42px in a 56px header leaves 7px above and 6px below (the 1px bottom border is inside the border-box). It clears — but 6.5px is the smallest clearance in the file, so it is the one tier to look at first". The marks hold 42px at every width per §G (`:447-452`, `:473+`, `:503+`). Arithmetic confirmed, appearance unconfirmed — and phone-landscape is the hardest state to reach in any browser emulator.
- decision-note: none
- cost-rank: 5
- recommendation: Add explicitly to the UI-04 device pass — this needs a real phone rotated, and the media query is deliberately keyed on `pointer: coarse` so a resized desktop window will never trigger it. The fix, if needed, is pre-authorised (raise that tier's height).

## UI-50: The drawer moving left costs thumb reach on large phones
- item: With the drawer moved to the left for everyone, top-left links became a longer thumb reach from the avatar on a large phone — an accepted cost, recorded in code so it is not rediscovered as a surprise.
- sources: TASK-NAVMOTION-REPORT.md (2026-08-11)
- raised: 2026-08-11
- status: STILL OPEN
- evidence: `src/components/app/AppLayout.tsx:2113-2127` — the §E comment records the owner's reasoning and then, verbatim: "THE ACCEPTED COST, recorded so it is not rediscovered as a surprise: on a large phone the links are now a reach across from the avatar. The rows are full-width down the whole panel, so the lower ones stay thumb-reachable; the top-left ones are a longer reach than they were. The owner has taken this trade." Implemented at `:2131` — `absolute inset-y-0 left-0 …` with the `isSuperAdmin ? 'left-0' : 'right-0'` conditional gone. The trade is live and unmeasured on a device.
- decision-note: none
- cost-rank: 6
- recommendation: No action — the owner took this trade explicitly. Keep it on the UI-04 device checklist only as a confirmation, not a question, and revert (one class) only if he says otherwise.

## UI-51: The drawer scrim and mobile padding were applied unconditionally, including superadmin
- item: ONEMENU's B4 scrim colour and B5 mobile top padding were applied to every surface including superadmin's, reasoned as shared-component fixes rather than tenant branding — flagged as a judgment call.
- sources: TASK-ONEMENU-REPORT.md (2026-08-07)
- raised: 2026-08-07
- status: STILL OPEN
- evidence: Still unconditional, and the reasoning that justified it no longer holds. The scrim is applied at `src/components/app/AppLayout.tsx:2100-2108` with no `isSuperAdmin` branch — but its colour is no longer the neutral `bg-black/40` the report defended. `:326` — `const SCRIM_TINT = 'bg-green-950/30';`, changed by `7533d31 navmotion: the nav stops flickering, starts sliding, and says what it is`. `green-950` is a tenant brand colour, so superadmin's drawer now dims to FHE's green on the strength of an argument that it was *not* branding. The drawer body itself is correctly branched (`:2155` `{!isSuperAdmin && …}`, `:2148` `{isSuperAdmin && …}` for Close), which shows the file knows how to make the distinction.
- decision-note: D1a (the platform owner is not a tenant) bears directly — recorded only, per the rule, but it is the decision this contradicts.
- cost-rank: 5
- recommendation: Worth raising as a small but real finding: the scrim silently became tenant-branded on a superadmin surface, and the original judgment call was accepted on the opposite basis. Either scope `SCRIM_TINT` to tenants and give superadmin a neutral one, or re-take the judgment knowingly.

---

# SLICE SUMMARY
- raw items in slice: 72
- families after dedup: 51
- status counts: CLOSED 7 / OPEN 39 / SUPERSEDED 2 / CANNOT-DETERMINE 3
- possible cross-domain overlaps:
  - **UI-24 (name_needs_confirmation can never be raised again)** — the modal is UI but the defect is in the identity/contacts spine; almost certainly also in slice-IDENTITY.
  - **UI-39 (euthanasia new-vs-existing records)** and **UI-40 (six create_horse_record save failures)** — HORSEINTAKE items whose substance is the `create_horse_record` RPC and the `horses` table; likely also in slice-DB-MISC.
  - **UI-45 (horse-care offerings have no surface)** — the DB-side segmentation half may appear in slice-DB-MISC.
  - **UI-43 (mod.brokerage enabled with no surface)** — module entitlement is shared with the contracts/brokerage domain; may appear in slice-CONTRACT-A/B.
  - **UI-11 (build fails at SSR prerender)** — an environment/tooling fact, not UI-specific; may appear in any slice that tried to build.
  - **UI-04 (nothing verified in a browser)** — the "no browser session" caveat is domain-independent and near-certainly recurs in every other slice; worth reconciling as one global item rather than eight.
- items you could not process: none — all 72 raw items are assigned to a family.
