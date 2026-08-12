### ITEM [batch1.md#105]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: Cross-thread collision found and fixed: ADMINSWEEP P2's test mocked useOpenLeads as a bare array; this task changed the hook's return shape, breaking InstructorHome under the mock — caught by rebasing, fixed in a22b03e.
- quote: "This task changes that hook's return to `{ open, converted, reload }` and `InstructorHome` destructures `.open`, so the bare-array mock made the component read `.length` of `undefined`."
- kind: process
- artifacts: test/ui/adminsweep_instructor_preview.test.tsx, useOpenLeads, InstructorHome
- decision-mention: none

### ITEM [batch2.md#58]
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: Flagged: Review rows are deliberately excluded from the page registry because nav position is their acceptance status; the real pages behind them are registered under their permanent homes marked PARKED_IN_REVIEW.
- quote: "**Review rows are deliberately excluded from the registry.** Nav position IS their status"
- kind: process
- artifacts: src/lib/pageRegistry.ts
- decision-mention: none

### ITEM [batch2.md#59]
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: Flagged: Lessons' three child pages (packages, credits, sessions) and the two parameterised Records routes have no nav rows and are therefore not in the registry — they need rows first if the owner wants them in the nav.
- quote: "**Lessons' three child pages** (`packages`, `credits`, `sessions`) and the two parameterised Records routes have **no nav rows and are therefore not in the registry.**"
- kind: blocked-on-owner
- artifacts: src/lib/pageRegistry.ts, /app/ops/lessons
- decision-mention: none

### ITEM [batch2.md#63]
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: The render is NOT VERIFIED — no staff browser session exists in the environment; a 9-step browser checklist is provided for the owner.
- quote: "No staff browser session exists in this environment. Everything above is proved by SQL against prod or by tests. **The render is NOT VERIFIED.**"
- kind: not-verified
- artifacts: /app/ops/admin/pages, AdminPageVisibilityPage.tsx, OpsDashboard.tsx
- decision-mention: none

### ITEM [batch2.md#66]
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Judgment call flagged: Calendar's "+ Booking" had no existing blank-slate flow to reuse, so nextBookableSlot() was written to interpolate a default start time and route into the two existing flows — the one surface where interpolation was needed rather than an existing control.
- quote: "**This is a judgment call**, not a literal reading of the task's \"the existing booking flow\" — flagging it as the one surface where I had to interpolate"
- kind: process
- artifacts: src/pages/app/CalendarPage.tsx, nextBookableSlot, CalendarItemPanel, RequestTimePanel
- decision-mention: none

### ITEM [batch2.md#67]
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: The exact business-hours computation against live calendar_free_busy data was not exercised — tests used empty hours, the page's own not-yet-loaded fallback.
- quote: "**Assumed**: exact business-hours computation against live `calendar_free_busy` data (not exercised ...)"
- kind: not-verified
- artifacts: CalendarPage.tsx, calendar_free_busy
- decision-mention: none

### ITEM [batch2.md#70]
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: The admin-surface inventory (every staff create page already has its own visible control; no admin follow-up looks necessary) is a single read-only research pass, not a click-through — flagged for the owner to sanity-check, not a closed conclusion.
- quote: "**No admin-facing follow-up task looks necessary** — flagging this as a finding for you to sanity-check rather than a closed conclusion, since it wasn't hands-verified."
- kind: not-verified
- artifacts: /app/ops/* staff pages, CreateModal
- decision-mention: none

### ITEM [batch2.md#74]
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Deviation disclosed: CreateModal gained an initialStep prop and a CreateModalContext beyond the literal surface list — plumbing, not a new flow; header behavior confirmed untouched.
- quote: "**`CreateModal` gained an `initialStep` prop and `CreateModalContext`.** The task said \"build buttons, not flows\" — this isn't a new flow, it's plumbing"
- kind: process
- artifacts: CreateModal.tsx, CreateModalContext.tsx, AppLayout.tsx
- decision-mention: none

---

### ITEM [batch2.md#85]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Defect written down, not fixed: two footer links ("Ways to Ride" and "Book a Lesson") both point at /shop.
- quote: "**Two footer links point at one page** — \"Ways to Ride\" and \"Book a Lesson\", both `/shop`, `Footer.tsx:37-38`. One line."
- kind: defect
- artifacts: Footer.tsx:37-38, /shop
- decision-mention: none

### ITEM [batch2.md#88]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Defect written down, not fixed: /app/ops/directory has zero rows in production — a live nav entry on an empty page.
- quote: "**`/app/ops/directory` has zero rows in production** — a live nav entry on an empty page."
- kind: defect
- artifacts: /app/ops/directory, DirectoryPage
- decision-mention: none

### ITEM [batch2.md#93]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: The render is NOT VERIFIED — nobody has looked at this in a browser; what the 18 tests do not cover: how it looks, whether 31 rows is usable in the rail, whether the collapsed 56px strip is legible with 31 identical icons, and whether each live page loads against real data.
- quote: "**No staff browser session exists in this environment, so the render is NOT VERIFIED.** Nobody has looked at this in a browser."
- kind: not-verified
- artifacts: AppLayout.tsx, ReviewIndexPage.tsx, /app/ops/review
- decision-mention: none

### ITEM [batch3.md#9]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: The `<main>` overflow-x-clip backstop was specified but NOT applied — AppLayout.tsx is untouched; the exact one-line diff is left for the orchestrator to apply at merge.
- quote: "Backstop specified, not applied — `AppLayout.tsx` is untouched. ... The exact one-line diff, for the orchestrator to apply at merge"
- kind: deferred
- artifacts: src/components/app/AppLayout.tsx:1470
- decision-mention: none

### ITEM [batch3.md#11]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: `npm run build` (full pipeline) fails at the SSR prerender step with "supabaseUrl is required" — pre-existing environment limitation (no .env in worktree), not a regression.
- quote: "`npm run build` (full pipeline, includes SSR prerender...) **fails at the prerender step** with `Error: supabaseUrl is required.` — **this is a pre-existing environment limitation, not a regression.**"
- kind: known issue
- artifacts: scripts/prerender.mjs
- decision-mention: none

### ITEM [batch3.md#13]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 1, confirmed Yes, not fixed): PostModal author row lacks the min-w-0 wrapper that CommunityFeed's identical pattern has.
- quote: "`src/components/feed/PostModal.tsx:330-337` ... renders `card.author` in a bare `<span>`, no `min-w-0` ... this is a miss of an established local pattern."
- kind: defect
- artifacts: src/components/feed/PostModal.tsx:330-337, src/components/feed/CommunityFeed.tsx:203
- decision-mention: none

### ITEM [batch3.md#24]
- report: TASK-I-REPORT.md
- date: 2026-08-04
- item: The I4 gold-ring vs fill-only active-state call was made from hex values, not a rendered screenshot — needs eyes in a browser; the revert is one line.
- quote: "**The gold-ring vs. fill-only call for I4** ... is a visual judgment from hex values, not a rendered screenshot — worth a look once the branch is viewable in a browser"
- kind: not-verified
- artifacts: RailLink, src/components/app/AppLayout.tsx
- decision-mention: none

### ITEM [batch3.md#69]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: The closed drawer-tab chevron's pointing direction was not hand-verified from the CSS geometry — Phase 2 must screenshot the closed state and confirm it reads left-pointing before relying on "no change needed".
- quote: "I did not hand-verify which way the un-rotated chevron actually points from the CSS alone ... Phase 2 should screenshot the closed state and confirm it reads as **left**-pointing"
- kind: not-verified
- artifacts: header-cardstock.css:374-384 (.cs-arrow)
- decision-mention: none

### ITEM [batch3.md#70]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: B0 trap: the generic `.cs-mark svg { inset:0; width/height:100% }` rule will stretch the avatar's 50×50 SVG if its wrapper grows to 56px — reintroducing the resampling defect BP410 fixed; Phase 2 must land a scoped override alongside the width change.
- quote: "this rule will stretch the avatar's still-50×50 (still-42×42) SVG to fill the new wrapper — which is exactly the resampling defect BP410 already fixed once"
- kind: caveat
- artifacts: header-cardstock.css:98 (.cs-mark svg), .cs-avatar
- decision-mention: none

### ITEM [batch3.md#71]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: B0 second cross-effect: the desktop Create tab's position (--cs-tab-right) is derived from the avatar's 50px width; growing the avatar 6px without recalculating drifts the tab out of visual center.
- quote: "Growing the avatar wrapper by 6px (50→56) without recalculating `--cs-tab-right` will drift the Create tab ~6px out of its intended visual center."
- kind: caveat
- artifacts: header-cardstock.css:258-264 (.cs-tab, --cs-tab-right)
- decision-mention: none

### ITEM [batch3.md#72]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: B2 leaves a layout cleanup: after removing the Close button the drawer header row is single-child under justify-between and will look off-balance — a Phase 2 styling call.
- quote: "The only real work in B2 is the layout cleanup of the now-single-child header row (`justify-between` with one child left will look off-balance...)"
- kind: cosmetic
- artifacts: src/components/app/AppLayout.tsx:1031-1037
- decision-mention: none

### ITEM [batch3.md#73]
- report: TASK-ONEMENU-PHASE1-PLAN.md
- date: 2026-08-07
- item: RailLink sets no explicit aria-current; the assumption that React Router's NavLink covers it implicitly is flagged, not tested at runtime.
- quote: "I'd rather flag the assumption than assert it against a library internal I didn't test at runtime."
- kind: not-verified
- artifacts: RailLink, src/components/app/AppLayout.tsx:284-314
- decision-mention: none

### ITEM [batch3.md#77]
- report: TASK-PAGETITLES-REPORT.md
- date: 2026-08-05
- item: All four page changes are code-complete but not visually verified in a running browser.
- quote: "All four page changes are code-complete but not visually verified in a running browser (no dev server session run in this pass)"
- kind: not-verified
- artifacts: Home.tsx, DashboardHome.tsx, CatalogPage.tsx, OfferingCatalog.tsx
- decision-mention: none

### ITEM [batch3.md#78]
- report: TASK-PAGETITLES-REPORT.md
- date: 2026-08-05
- item: Deviation from spec: timeOfDayWord()'s fourth 'night' bucket (21:00–03:59) was mapped to "Evening" for the Dashboard greeting since the spec only covers Morning/Afternoon/Evening.
- quote: "`timeOfDayWord()` has a fourth `'night'` bucket (21:00–03:59) the task's Morning/Afternoon/Evening spec doesn't cover; mapped `night → \"Evening\"`"
- kind: deviation
- artifacts: src/lib/formatDateTime.ts (timeOfDayWord), DashboardHome.tsx
- decision-mention: none

---

### ITEM [batch3.md#99]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-001: the new X-axis rail box-shadow sits on the same `<nav>` that carries overflow-x-hidden, which commonly clips an element's own shadow — conflicts with the guidance received when asked; if invisible in a browser the fix is structural and should go back through UIREVIEW as its own order.
- quote: "**Whether the rail shadow is actually visible, or clipped.** ... my new shadow projects exactly on the X axis that `overflow-x-hidden` clips."
- kind: defect
- artifacts: .oh-rail-shadow, src/components/app/AppLayout.tsx (`<nav>` rails)
- decision-mention: none

### ITEM [batch3.md#102]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-002: whether the :active gradient-alpha transition reads as smooth is inference from CSS interpolation rules, not something seen rendering.
- quote: "Whether the `:active` transition reads as smooth. `transition: background` is animating a `linear-gradient`'s alpha ... this is inference from the CSS, not something I've seen render."
- kind: not-verified
- artifacts: button.oh-avatar, src/components/app/app-header.css
- decision-mention: none

### ITEM [batch3.md#106]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-007: whether overscroll-behavior actually contains the drawer's scroll chaining on iOS Safari — the entire reason the removed body-lock existed — is unconfirmed in either direction; the order says STOP and report rather than reinstate the lock if it fails on a real device.
- quote: "**The iOS-specific caveat, which is the entire reason the old lock existed:** whether `overscroll-behavior` actually contains the drawer's scroll chaining on iOS Safari ... this is unconfirmed in either direction, not passing."
- kind: not-verified
- artifacts: src/components/app/AppLayout.tsx (app-nav-drawer, body-lock effect removed)
- decision-mention: none

### ITEM [batch3.md#108]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-006: shipping 7% as the hover fill (arithmetic midpoint of the 14%/0% ramp) was an interpretation of an unspecified value — flagged in case the read was wrong; one number to change.
- quote: "treated 7% (the exact arithmetic midpoint...) as a principled interpolation of a fully-specified mechanism, not a new invented value, and shipped it. Flagging the reasoning explicitly in case that read was wrong"
- kind: deviation
- artifacts: button.oh-avatar:hover, src/components/app/app-header.css
- decision-mention: none

### ITEM [batch3.md#114]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-005: the apple-touch-icon PNG was rendered by this machine's Chrome — cannot confirm which font in the Big Caslon stack actually resolved, or how it renders for end users.
- quote: "the apple-touch-icon PNG was rendered by this machine's Chrome, which may or may not have resolved `Big Caslon` the same way an end user's browser/OS will"
- kind: not-verified
- artifacts: public/favicon.svg, apple-touch-icon.png
- decision-mention: none

### ITEM [batch3.md#116]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-014 side effect needs eyes: six NAV_DIVIDER sites went from rendering currentColor (silent T1 failure of border-green-900/12) to the declared faint wash — whether the declared colour reads right at all six sites is unchecked.
- quote: "I only confirmed they went from \"wrong colour\" to \"the declared colour,\" not that the declared colour is definitely right everywhere it's used. Worth a specific look at all six"
- kind: not-verified
- artifacts: NAV_DIVIDER, src/components/app/AppLayout.tsx:827,873,1362,1387,1417,1542, tailwind.config.js (opacity 8/12)
- decision-mention: none

### ITEM [batch4.md#27]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: name_needs_confirmation can never be raised again — only the one-time 2026-07-30 backfill ever set it true; no live path re-arms it when a name conflict arises after that date.
- quote: "`name_needs_confirmation` can never be raised again ... no live path re-arms it when a name conflict arises after 2026-07-30."
- kind: correctness
- artifacts: name_needs_confirmation, confirm_my_legal_name, my_name_confirmation_state, ConfirmNameModal
- decision-mention: none

### ITEM [batch4.md#45]
- report: TASK-ADDNEW-REPORT.md
- date: 2026-08-12
- item: Overflow at the narrowest viewport for "Horse records" could not be ruled out — a two-line wrap (not horizontal scroll) is possible at 320-375px on that page; needs a manual look.
- quote: "I can't rule out a wrap to two lines on the *narrowest* real devices for that specific page name — but a wrap, not a horizontal scrollbar ... **This is the one page worth a manual look**"
- kind: not-verified
- artifacts: HorseRecordsPage.tsx, PageHeader.tsx
- decision-mention: none

### ITEM [batch4.md#51]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-4 — InstructorHome renders availability slots as lessons (listLessonSessions doesn't filter status: 318 rows, 279 available), overstating a trainer's day ~5x, all chipped "Scheduled".
- quote: "D-4 · Availability slots render as lessons. ... the page is not merely empty-looking, it is **wrong**, and wrong in the flattering direction."
- kind: defect
- artifacts: InstructorHome, listLessonSessions
- decision-mention: D-4

### ITEM [batch4.md#56]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: App.tsx is a shared route-registration file not claimed by any live branch; flagged since route registration is a shared surface.
- quote: "`App.tsx` is not claimed by any live branch ... Flagged here anyway since route registration is a shared file."
- kind: process
- artifacts: App.tsx
- decision-mention: none

### ITEM [batch4.md#57]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: Browser render of the preview route is NOT VERIFIED — no staff session; proven only by 4 passing tests.
- quote: "Browser render is still NOT VERIFIED — see the checklist at the end."
- kind: not-verified
- artifacts: InstructorHomePreview.tsx, /app/ops/preview/instructor-home
- decision-mention: none

### ITEM [batch4.md#59]
- report: TASK-BP410-REPORT.md
- date: 2026-08-07
- item: Real-device rendering (iOS Safari specifically, where the original jagged-outline defect appeared) was not verified; everything checked in Chrome only.
- quote: "Not verified: real-device rendering (iOS Safari specifically, where the original jagged-outline defect actually showed up before). Everything above was checked in Chrome only"
- kind: not-verified
- artifacts: CardstockHeader.tsx, header-cardstock.css
- decision-mention: none

### ITEM [batch4.md#60]
- report: TASK-BP410-REPORT.md
- date: 2026-08-07
- item: Out-of-scope, not fixed — 500px viewport also overflows (scrollWidth 582 vs 500), pre-existing on origin/main, unrelated to the ≤410 budget.
- quote: "Out-of-scope observation (not fixed) ... **500px also overflows** ... flagging it since I noticed it, not fixing it since it's out of this task's scope"
- kind: defect
- artifacts: CardstockHeader.tsx, header-cardstock.css
- decision-mention: none

### ITEM [batch4.md#62]
- report: TASK-BP410-REPORT.md
- date: 2026-08-07
- item: The live drawer tab and AppLayout were not mounted/screenshotted (out of scope); confirmed only by computed style that dependent variables resolve identically.
- quote: "I did not mount `AppLayout` (out of scope ...) so I couldn't screenshot the live drawer tab; instead I confirmed by computed style that the variable it depends on ... resolves identically before and after."
- kind: not-verified
- artifacts: AppLayout, --cs-hdr-h, --cs-tab-right
- decision-mention: none

### ITEM [batch4.md#104]
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: "Nav resize — the drawer's dimensions, per the owner" was NOT built because the dimensions are recorded nowhere; drawer left at w-72 max-w-[85vw].
- quote: "**'Nav resize — the drawer's dimensions, per the owner' (§5).** The dimensions are not recorded ... I did not invent a number."
- kind: blocked-on-owner
- artifacts: AppLayout.tsx drawer
- decision-mention: none

### ITEM [batch4.md#109]
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: glass.nav in tailwind.config.js now has no reader after NAV_GLASS removal; left in place because removing a theme colour is a separate call.
- quote: "`glass.nav` in `tailwind.config.js` ... now has no reader. Left in place; removing a theme colour is a separate call."
- kind: inventory
- artifacts: tailwind.config.js glass.nav, NAV_GLASS
- decision-mention: none

### ITEM [batch4.md#111]
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: Pre-existing defect found not fixed — superadmin chrome is h-14 (56px) but rails stick at 76px, a 20px gap; superadmin chrome explicitly untouched.
- quote: "**One pre-existing defect found, not fixed** ... a 20px gap. This predates the task ... and superadmin chrome is explicitly 'deliberately untouched', so I left it."
- kind: defect
- artifacts: AppLayout.tsx, --cs-hdr-h
- decision-mention: none

### ITEM [batch4.md#113]
- report: TASK-ONEHEADER-REPORT.md
- date: 2026-08-08
- item: AppLayout.tsx, CardstockHeader.tsx and header-cardstock.css are shared with TASK-MOBILEPASS; this branch holds them (only AppLayout.tsx is a real conflict surface).
- quote: "**Shared-file note:** `AppLayout.tsx`, `CardstockHeader.tsx` and `header-cardstock.css` are shared with `TASK-MOBILEPASS`. This branch holds them."
- kind: process
- artifacts: AppLayout.tsx, CardstockHeader.tsx, header-cardstock.css
- decision-mention: none

### ITEM [batch5.md#58]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The @supports-not backdrop-filter fallback path was never exercised (Chrome always rendered the glass branch).
- quote: "**The `backdrop-filter` fallback path** (`@supports not …`) was not exercised — Chrome supports `backdrop-filter`, so only the glass branch rendered."
- kind: not-verified
- artifacts: header-cardstock.css, NAV_GLASS
- decision-mention: none

### ITEM [batch5.md#59]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Sub-perceptual pixel residue below 1024px (≤4/255 on ~0.25% of pixels, bottom-left corner) attributed to rasterisation; cause not isolated further.
- quote: "I did not isolate the cause further; at 2/255 it is not visible."
- kind: cosmetic
- artifacts: CardstockHeader.tsx
- decision-mention: none

### ITEM [batch5.md#65]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: At ≤404px the header content overflows the viewport (~2.6px avatar clip at 390px) — faithfully reproduced from the mockup, not "improved"; flagged for the owner's judgement since it is real on the most common phone width.
- quote: "At **≤404px the header content overflows the viewport.** ... **The mockup does exactly the same thing** — I reproduced it faithfully rather than \"improving\" it"
- kind: blocked-on-owner
- artifacts: CardstockHeader.tsx
- decision-mention: none

### ITEM [batch5.md#66]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The cardstock sheet runs edge-to-edge with no max-w-[120rem] cap unlike the old header — the wordmark centres across the full viewport on ultrawide; flagged as a visible change per the mockup.
- quote: "The cardstock sheet runs edge-to-edge with no `max-w-[120rem]` cap, unlike the old header. ... flagging since it is a visible change."
- kind: cosmetic
- artifacts: CardstockHeader.tsx
- decision-mention: none

### ITEM [batch5.md#68]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: The header drop shadow shipped as-is, deferred for owner judgement against real scrolling content.
- quote: "Header drop shadow shipped as-is (`0 6px 18px rgba(24,38,32,.14)`), deferred for judgement against real scrolling content."
- kind: blocked-on-owner
- artifacts: header-cardstock.css
- decision-mention: none

### ITEM [batch5.md#70]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Deviation flagged for owner eyes — the mockup's Create-tab background never renders (scaleY(-1) maps the layer outside the clip); a translateY(-100%) was added ahead of the flip, the one behavioural change to a mockup value.
- quote: "This is the one behavioural change to a mockup value, and it is the item most worth your eyes."
- kind: deviation
- artifacts: header-cardstock.css (.tab::after), CardstockHeader.tsx
- decision-mention: none

### ITEM [batch6.md#23]
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: One pre-existing UI test fails on origin/main and still fails — wallreturn_applayout "defaults to the destination menu"; not mine, not touched.
- quote: "One pre-existing UI test fails on origin/main and still fails — test/ui/wallreturn_applayout.test.tsx, 'defaults to the destination menu'. Not mine, not touched."
- kind: known-issue
- artifacts: test/ui/wallreturn_applayout.test.tsx
- decision-mention: none

### ITEM [batch6.md#33]
- report: TASK-F3-REPORT.md
- date: (no header date)
- item: Optimistic append after submit mirrors ReportCard's pattern including its limitation of no invented id/created_at.
- quote: "Optimistic append after successful submit, mirroring ReportCard's pattern (including its limitation of no invented id/created_at)."
- kind: caveat
- artifacts: SessionNotesView.tsx, ReportCard
- decision-mention: none

### ITEM [batch6.md#38]
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: About.tsx's "The Facility" eyebrow label sits next to FHE's chosen word "ranch" — same collision risk the owner ruled on; left as-is, flagged for possible follow-up.
- quote: "About.tsx's 'The Facility' eyebrow ... doesn't contain the word 'barn' so it was outside the literal 160-mention scope, but it's the same collision risk ... Left as-is"
- kind: cosmetic
- artifacts: About.tsx
- decision-mention: none

### ITEM [batch6.md#39]
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: seed.ts's FEED_VIEW_META.all.description already says "around the stables" — a pre-existing, unrelated inconsistency (not "barn," not in grep scope).
- quote: "seed.ts's FEED_VIEW_META.all.description already says 'around the stables' — a pre-existing, unrelated inconsistency"
- kind: cosmetic
- artifacts: seed.ts (FEED_VIEW_META)
- decision-mention: none

### ITEM [batch6.md#46]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Step 3 N/A field colour BLOCKED — author did not pick a replacement for the tan (cream-100) disabled background; four verified options presented, awaiting owner choice.
- quote: "Step 3 — the N/A treatment (F4). BLOCKED, nothing changed. ... I did not pick a replacement. ... Say which and I will apply it — it is one class."
- kind: blocked-on-owner
- artifacts: HorseIntakeForm.tsx, disabled:bg-cream-100
- decision-mention: none

### ITEM [batch6.md#49]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Which of the six save failures Claire actually hit is unknown and not knowable from the database (failed INSERT leaves no row/audit); all six were fixed rather than guessed.
- quote: "Which one did Claire actually hit? Unknown, and not knowable from the database — a failed INSERT leaves no row and no audit entry"
- kind: not-verified
- artifacts: create_horse_record
- decision-mention: none

### ITEM [batch6.md#50]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Nothing is browser-verified — the form was not rendered; every UI claim is about code and compiled CSS, not the screen.
- quote: "Nothing is browser-verified. I did not render this form. Every UI claim is a claim about the code and the compiled CSS, not about what the screen looks like."
- kind: not-verified
- artifacts: HorseIntakeForm.tsx
- decision-mention: none

### ITEM [batch6.md#52]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Open owner question — new records only or existing too for the euthanasia change (all 3 horses on file already B, so nothing needs migrating either way, but confirm).
- quote: "New records only, or existing too? All 3 horses on file are already B, so nothing needs migrating either way — but confirm"
- kind: blocked-on-owner
- artifacts: euthanasia_authorization, horses
- decision-mention: none

### ITEM [batch6.md#53]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Did not change border-red-400 — F5 suggests it may be too quiet, but that is a colour decision belonging with the owner's question 2.
- quote: "I did not change border-red-400 — F5 suggests it may be too quiet, but that is a colour decision and belongs with question 2."
- kind: blocked-on-owner
- artifacts: HorseIntakeForm.tsx, border-red-400
- decision-mention: none

---

### ITEM [batch6.md#70]
- report: TASK-MOBILEPASS-REPORT.md
- date: 2026-08-08
- item: C2 (three material languages) not implemented, correctly — owner said LAST, everything else first; the premise partly changed since ONEHEADER; left for the owner.
- quote: "Not implemented, correctly. ... 'LAST. Everything else first.' ... Left for the owner; not attempted."
- kind: blocked-on-owner
- artifacts: header, nav, buttons
- decision-mention: none

### ITEM [batch7.md#16]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: R-2 — /app/ops/horses (HorsesPage) has zero references outside its route; a third horse surface over the same 4 horses that nobody can open.
- quote: "`/app/ops/horses` — a third horse page nobody can open. `HorsesPage` ... has zero references in the entire codebase outside its route registration."
- kind: inventory
- artifacts: /app/ops/horses, HorsesPage
- decision-mention: none

### ITEM [batch7.md#18]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: mod.brokerage is enabled for the tenant but has no nav entry and no hub page — an enabled module with no surface.
- quote: "`mod.brokerage` is enabled for this tenant but has no nav entry and no hub page ... An enabled module with no surface."
- kind: inventory
- artifacts: mod.brokerage, AppLayout.tsx
- decision-mention: none

### ITEM [batch7.md#20]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: X-3 — /app/ops/availability is a dormant legacy redirect with no nav and no links; target long since moved to the calendar.
- quote: "`/app/ops/availability` redirect | No nav, no links, target long since moved to the calendar | Dormant"
- kind: inventory
- artifacts: /app/ops/availability
- decision-mention: none

### ITEM [batch7.md#23]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-2 — Horse care: 12 offerings exist and are DB-segmented but there is no page, nav entry, label or module for them.
- quote: "Horse care | The 12 offerings exist and are correctly segmented in the DB ... but there is no page, no nav entry, no label and no module."
- kind: inventory
- artifacts: offerings (segment='horse')
- decision-mention: none

### ITEM [batch7.md#34]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: Runtime rendering not verified — every page verified by reading its data path, not by opening it; "renders real data" means calls a live API with no seed fallback, not a visual confirmation.
- quote: "Runtime rendering. Every page was verified by reading its data path, not by opening it in a browser. No admin surface was clicked through."
- kind: not-verified
- artifacts: all admin nav pages
- decision-mention: none

### ITEM [batch8.md#51]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: The gold underline rule measures 2.66:1 against the panel, under the 3:1 non-text contrast floor — pre-existing from UIO-013's hover and now also the selected indicator; decoration-gold-800 (5.58:1) is the one-token alternative, deliberately not taken.
- quote: "**The gold rule measures 2.66:1** against the panel — pre-existing from UIO-013's hover, now also the selected indicator. `decoration-gold-800` (5.58:1) is the one-token alternative; not taken"
- kind: cosmetic
- artifacts: src/components/app/AppLayout.tsx (NAV_ROW_ACTIVE)
- decision-mention: none

### ITEM [batch8.md#52]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: In the collapsed 56px staff rail the selected state is icon tone alone — the underline has no text to sit under; flagged as the one surface where the removed fill was doing irreplaceable work.
- quote: "**The collapsed 56px rail's selected state is icon tone only** — the underline has no text to sit under there."
- kind: cosmetic
- artifacts: src/components/app/AppLayout.tsx (collapsed staff rail)
- decision-mention: none

### ITEM [batch8.md#54]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: Everything visual is NOT VERIFIED — no staff browser session existed, no animation was watched; a 13-item owner checklist covers what must be confirmed on screen.
- quote: "No staff browser session exists and none was used. **No animation was watched.** ... **These are not:** how any of it looks or moves on a real screen."
- kind: not-verified
- artifacts: AppLayout.tsx, AppHeader.tsx, app-header.css
- decision-mention: none

### ITEM [batch8.md#55]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: The optional growing-underline animation (§A) was not built — it requires background-image gradients on every nav label span across nine row components; reported per the order's instruction.
- quote: "**Not built, and reported per the order's instruction.** It cannot be done with `text-decoration`; it needs a `background-image` linear-gradient with a `background-size` transition"
- kind: deferred
- artifacts: AppLayout.tsx nav row components
- decision-mention: none

### ITEM [batch8.md#58]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: The landscape header tier is the tightest clearance (7px above the 42px marks); if it reads cramped the sanctioned fix is raising that tier's height, not shrinking the mark.
- quote: "**The landscape tier is the tight one and the order named it.** ... **If it reads cramped, the sanctioned fix is to raise that one tier's height, not to shrink the mark back.**"
- kind: caveat
- artifacts: app-header.css (--cs-hdr-h landscape tier)
- decision-mention: none

### ITEM [batch8.md#61]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: Accepted cost recorded — with the drawer moved left, top-left links become a longer thumb reach from the avatar on a large phone; the mechanism to revert is one class.
- quote: "**The accepted cost, recorded in the code so it is not rediscovered as a surprise:** on a large phone the links are a reach across from the avatar."
- kind: caveat
- artifacts: AppLayout.tsx mobile drawer
- decision-mention: none

### ITEM [batch8.md#62]
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Nothing was verified on a real device or in the real running app with real authentication — no Supabase credentials in any worktree; verification was via a throwaway Vite harness with mocked data.
- quote: "**Nothing was verified on a real device or in the real running app with real authentication** — this environment has no Supabase credentials"
- kind: not-verified
- artifacts: AppLayout.tsx, CardstockHeader.tsx, header-cardstock.css
- decision-mention: none

### ITEM [batch8.md#64]
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: The drawer layered over real page content at 390px unscrolled was never screenshotted — named as the one item most wanting a real screenshot before calling this done.
- quote: "not screenshotted inside the real app ... it's the one item I'd most want a real screenshot of before calling this fully done."
- kind: not-verified
- artifacts: AppLayout.tsx mobile drawer, cs-drawer-tab
- decision-mention: none

### ITEM [batch8.md#66]
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Drawer-tab touch-target size (B1 hit-slop, ≥44px) was reasoned by box math, never measured with an actual touch simulator or touchscreen.
- quote: "Not tested with an actual touch simulator, but the box math clears the 44×44 guideline on the previously-short width axis."
- kind: not-verified
- artifacts: header-cardstock.css (.cs-drawer-tab::before)
- decision-mention: none

### ITEM [batch8.md#68]
- report: TASK-ONEMENU-REPORT.md
- date: 2026-08-07
- item: Judgment call flagged — B4's neutral scrim color (bg-black/40) and B5's mobile top padding were applied unconditionally including superadmin's surfaces, reasoned as shared-component fixes rather than tenant branding.
- quote: "Applied unconditionally, including superadmin's drawer ... flagged as a judgment call, not silently assumed"
- kind: process
- artifacts: AppLayout.tsx (scrim, <main> padding)
- decision-mention: none

### ITEM [batch8.md#73]
- report: TASK-PAGEFRAME-REPORT.md
- date: 2026-08-11
- item: No authenticated browser click-through or cross-page screenshot was done — the task's verification ask (screenshot all nine, confirm rendered aria-labels) is unmet; no browser automation or credentials available.
- quote: "**No authenticated browser click-through, and no cross-page screenshot.** The task's verification section asks to screenshot all nine together and confirm every `+`'s rendered `aria-label`."
- kind: not-verified
- artifacts: 8 converted pages, PageHeader.tsx
- decision-mention: none
