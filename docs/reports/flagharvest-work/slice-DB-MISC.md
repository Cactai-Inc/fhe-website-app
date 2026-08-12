### ITEM [batch1.md#13]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: /acquisition and /shop are public pages left for the owner to confirm visually; the three cards are proven in SQL but nobody has seen the page.
- quote: "**`/acquisition` and `/shop` are public and are the owner's to confirm** ... nobody has seen the page."
- kind: blocked-on-owner
- artifacts: /acquisition, /shop
- decision-mention: none

### ITEM [batch1.md#17]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Flagged not fixed: DashboardPanel has no loading and no error branch — every fetch is `.catch(() => …)`, so a failed read renders "you're all caught up"; the census recommendation to port OpsDashboard's per-tile error branch stands.
- quote: "**`DashboardPanel` has no loading and no error branch** — every fetch is `.catch(() => …)`, so a failed read renders \"you're all caught up\"."
- kind: defect
- artifacts: src/components/app/DashboardPanel.tsx, src/pages/app/ops/OpsDashboard.tsx
- decision-mention: none

### ITEM [batch1.md#21]
- report: TASK-COUNTFIX-REPORT.md
- date: 2026-08-12
- item: Process note: the worktree was deleted and recreated by another process mid-session, losing the first pass of uncommitted edits; everything was redone and committed immediately.
- quote: "The worktree was **deleted and recreated by another process mid-session**, taking the first pass of the uncommitted edits with it."
- kind: process
- artifacts: wt-countfix
- decision-mention: none

### ITEM [batch1.md#22]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Global caveat: no browser was used; every appearance claim is NOT VERIFIED and every judgement is derived from code markers.
- quote: "**I have not seen these pages.** No browser was used. Every appearance claim is marked **NOT VERIFIED**"
- kind: not-verified
- artifacts: (all surfaces in the census)
- decision-mention: none

### ITEM [batch1.md#23]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Not reached: api/ (serverless) and supabase/migrations/ were not swept for duplication — only src/ and the DB functions those surfaces call.
- quote: "**`api/` (serverless) and `supabase/migrations/`** were not swept for duplication."
- kind: inventory
- artifacts: api/, supabase/migrations/
- decision-mention: none

### ITEM [batch1.md#25]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Not reached: the three superadmin pages were inventoried but not quality-scored (platform-owner surfaces, out of tenant UI scope).
- quote: "**The three superadmin pages** (`/app/ops/superadmin/*`) were inventoried but not quality-scored"
- kind: inventory
- artifacts: /app/ops/superadmin/*
- decision-mention: none

### ITEM [batch1.md#27]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Not reached: CSS/token duplication beyond counting arbitrary Tailwind values per file.
- quote: "**CSS/token duplication** beyond counting arbitrary Tailwind values per file."
- kind: inventory
- artifacts: (Tailwind/CSS tokens)
- decision-mention: none

### ITEM [batch1.md#30]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Process finding: a code comment (useOpenLeads.ts:38 at 33525cd) asserted a guarantee the code did not provide for a month and nothing caught it — the clearest example of the false-comment failure mode.
- quote: "**a comment asserted a guarantee the code did not provide, for a month, and nothing caught it.**"
- kind: process
- artifacts: src/lib/ops/useOpenLeads.ts
- decision-mention: none

### ITEM [batch1.md#32]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 1.3: listLessonSessions() has no status filter, serving 318 rows where 39 lessons exist; the 279 available-slot rows carry a status (AVAILABLE) with no key in the label map, so no code path can label them — NOT VERIFIED visually.
- quote: "`listLessonSessions` upper-cases the booking status ... producing `AVAILABLE`, which is **not a key in that map** ... **NOT VERIFIED visually** — but there is no code path that produces a label for those 279 rows."
- kind: defect
- artifacts: src/lib/ops/api-lessons.ts, src/pages/app/Schedule.tsx, src/pages/app/ops/lessons/SessionsPage.tsx
- decision-mention: none

### ITEM [batch1.md#35]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 1.5: /acquisition (in the marketing site's primary nav as "Find a Horse") renders 0 of 3 services because fetchPublicCatalog filters price_amount != null and all three acquisition SKUs are unpriced; there is no empty branch so the funnel cannot be completed and does not say why — NOT VERIFIED visually.
- quote: "**A page in the marketing site's primary nav is a funnel that cannot be completed and does not say why.** **NOT VERIFIED visually; derived from the code paths and the data.**"
- kind: defect
- artifacts: src/lib/publicCatalog.ts, src/pages/BookSupport.tsx, src/pages/BookHorse.tsx, /acquisition
- decision-mention: none

### ITEM [batch1.md#36]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: The site footer carries two adjacent labels pointing at one destination — "Ways to Ride" and "Book a Lesson" both link to /shop (Footer.tsx:37-38); one-line fix.
- quote: "the footer's Navigation list contains **`{ label: 'Ways to Ride', href: '/shop' }` and `{ label: 'Book a Lesson', href: '/shop' }` as adjacent entries**"
- kind: defect
- artifacts: src/components/layout/Footer.tsx
- decision-mention: none

### ITEM [batch1.md#38]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: TASK-HORSEONE is HELD pending this review; the census agrees with its conclusion but adds that breed/colour lookup resolution (listHorseBreeds/listHorseColors) must be carried across from HorsesPage before it is retired — the one feature only the losing page has.
- quote: "**Carry across before B is retired:** **breed/colour lookup resolution** ... This is the single feature that would be silently lost."
- kind: blocked-on-owner
- artifacts: src/pages/app/ops/HorsesPage.tsx, listHorseBreeds, listHorseColors, src/pages/app/ops/HorseRecordsPage.tsx
- decision-mention: none

### ITEM [batch1.md#39]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: HorseRecordsPage hand-rolls its own modal (fixed inset-0 ... z-[60]) beside the app's own Modal component — should be replaced on the way through any consolidation.
- quote: "a **hand-rolled modal** (`fixed inset-0 … z-[60]`, `HorseRecordsPage.tsx:257-269`) sitting beside the app's own `Modal`"
- kind: defect
- artifacts: src/pages/app/ops/HorseRecordsPage.tsx, Modal
- decision-mention: none

### ITEM [batch1.md#42]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: The module launcher (six entitlement-gated tiles) exists only on OpsDashboard (/app/ops, URL-only) — it must be carried across before B is retired; there is no other module launcher in the app.
- quote: "the **module launcher** — six entitlement-gated tiles ... There is no other module launcher in the app."
- kind: inventory
- artifacts: src/pages/app/ops/OpsDashboard.tsx, MODULE_TILES, MODULE_HUB_ROUTES, ModuleGate
- decision-mention: none

### ITEM [batch1.md#50]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: DashboardPanel's two "Coming up" tiles link to /app/schedule (a URL-only page); they should link to wherever the time-surface consolidation lands.
- quote: "**Also fix:** `DashboardPanel`'s two \"Coming up\" tiles link to `/app/schedule`; they should link to wherever this lands."
- kind: defect
- artifacts: src/components/app/DashboardPanel.tsx, /app/schedule
- decision-mention: none

### ITEM [batch1.md#59]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.2: serviceCatalog.ts claims "Every UI that names a service reads from here" but has zero importers in src/ (fourth false comment); it also says 13 services where both it and the DB hold 14; delete it or wire serviceLabel() in.
- quote: "**Reality:** the only file in the repo that imports it is `test/db/service_catalog.test.ts` ... **No UI reads it.** Fourth false comment found."
- kind: correctness
- artifacts: src/lib/serviceCatalog.ts, test/db/service_catalog.test.ts
- decision-mention: none

### ITEM [batch1.md#60]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Finding 3.4: CareHome's primary CTA ("Request a service") links to /horse-care, a route that does not exist in App.tsx — it falls through to the branded 404.
- quote: "**`CareHome` contains a dead link:** `CareHome.tsx:70` → `/horse-care`. **That route does not exist in `App.tsx`** — it falls through to the branded 404. It is the page's primary CTA"
- kind: defect
- artifacts: src/pages/app/CareHome.tsx, App.tsx
- decision-mention: none

### ITEM [batch1.md#65]
- report: TASK-DUPECENSUS-REPORT.md
- date: 2026-08-12
- item: Separate report: 71 of 80 in-app pages do not use PageLayout/PageHeader (63 hand-roll an h1, 2 routed pages have no title at all); the frame is four days old, so this is a backfill need, not a discipline problem — measured, not fixed.
- quote: "**71 of 80 pages predate the shared frame** — this is not 71 pages ignoring a convention, it is a convention that arrived after the pages ... it is a **backfill**, not a discipline problem."
- kind: inventory
- artifacts: src/components/PageLayout.tsx, src/components/PageHeader.tsx, src/pages/app/**
- decision-mention: none

### ITEM [batch1.md#96]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: Render NOT VERIFIED — no staff browser session existed; every count proven by SQL and interactions by 8 jsdom UI tests, but nobody has looked at the actual page.
- quote: "**Render status: NOT VERIFIED.** No staff browser session exists and none was given ... Nobody has looked at the actual page."
- kind: not-verified
- artifacts: src/components/app/DashboardPanel.tsx, src/components/app/LeadWorkDrawer.tsx
- decision-mention: none

### ITEM [batch1.md#106]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: A real migration bug the harness caught: Postgres has no min(uuid) aggregate — the first draft would have rolled back the whole migration; replaced with (array_agg(c.id ORDER BY c.created_at))[1].
- quote: "**Postgres has no `min()` aggregate for `uuid`** — confirmed against production directly, not just PGlite"
- kind: process
- artifacts: 20260811T1900_leadclean_open_queue.sql
- decision-mention: none

### ITEM [batch1.md#120]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Self-correction: the Phase B review summary's counts (23/24/28/48) were stale — correct figures are 26 lose authenticated / 27 closed by B / 31 total / 45 remaining; the set of functions was never wrong.
- quote: "The correct figures are **26 / 27 / 31 / 45**. The *set* of functions was never wrong"
- kind: correction
- artifacts: Phase B migrations 20260810T0300–T0700
- decision-mention: none

### ITEM [batch1.md#133]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Assumed, not proven: the 45 remainder are still unguarded — NOGUARD1's classification carried forward without re-reading all 45 bodies; a BEFORE trigger, CHECK or NOT NULL outside the body may already stop some, so 76 may be an over-count.
- quote: "**The 45 remainder are still unguarded.** I did not re-read all 45 bodies; I carried NOGUARD1's classification forward."
- kind: not-verified
- artifacts: (45 remaining functions)
- decision-mention: none

### ITEM [batch1.md#138]
- report: TASK-NOGUARD2-REPORT.md
- date: 2026-08-10
- item: Deliberately left alone on instruction: the intentionally-public set — redeem_gift (self-enforcing), open_gift (the gift code is the credential), and the public catalog read path — confirmed untouched.
- quote: "**Separately, left alone on instruction** ... Confirmed untouched."
- kind: process
- artifacts: redeem_gift, open_gift
- decision-mention: none

### ITEM [batch2.md#14]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: pending_fee_candidates is already broken in production — `p.mobile` should be `c.mobile` (executing it live errors); pre-existing defect found during the Stage 5 sweep, reported not fixed.
- quote: "`pending_fee_candidates`' `p.mobile` is **already broken in production** ... `ERROR: column p.mobile does not exist, HINT: did you mean c.mobile`"
- kind: defect
- artifacts: pending_fee_candidates
- decision-mention: none

### ITEM [batch2.md#18]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: Harness Fix 3 (DROP FUNCTION in 20260710160000_my_stable_lessee.sql) is not safe to re-run against production and never will be — it fails there today on `column h.barn_name does not exist` (renamed to nickname by a later migration); correct only for from-empty replay.
- quote: "**Not safe to re-run against production, and never will be** — tested in a rolled-back transaction and it fails there *today* on `column h.barn_name does not exist`"
- kind: process
- artifacts: supabase/migrations/20260710160000_my_stable_lessee.sql
- decision-mention: none

### ITEM [batch2.md#45]
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: gifts.order_id is a vestigial, unconstrained uuid column — its FK to orders(id) was removed by the CASCADE drop of the orders table; not touched, not read or written by anything added.
- quote: "`gifts.order_id` is a vestigial, unconstrained `uuid` column — its FK to `orders(id)` survived a `CASCADE` drop of the `orders` table itself"
- kind: data-integrity
- artifacts: gifts.order_id
- decision-mention: none

### ITEM [batch2.md#49]
- report: TASK-GIFTCREDITS-REPORT.md
- date: 2026-08-11
- item: Verification item 2 (recipient books against the gifted credit and the booking consumes it) was not re-verified end-to-end in the browser — relies on lesson_credits being the same table book_open_slot already debits.
- quote: "Not re-verified end-to-end in the browser this session (no browser access in this environment)"
- kind: not-verified
- artifacts: lesson_credits, book_open_slot
- decision-mention: none

### ITEM [batch2.md#57]
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: Flagged for owner: the App-pages block (Messages, and Calendar/Catalog while in Review) is not hideable — hand-written JSX in StaffNavItems, not a NavItem[] table, so the filter has no row to remove; making them hideable requires restructuring that block.
- quote: "**The App-pages block is not hideable.** Messages (and Calendar/Catalog while they sit in Review) are hand-written JSX in `StaffNavItems`, not a `NavItem[]` table"
- kind: blocked-on-owner
- artifacts: src/components/app/AppLayout.tsx (StaffNavItems)
- decision-mention: none

### ITEM [batch2.md#71]
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: Catalog deliberately got no "+" button, per the task's own instruction — the page is a pure browse grid where every item carries its own inline action; a page-level "+" would duplicate or be meaningless.
- quote: "**No button added, per the task's own instruction to say so instead of forcing one.**"
- kind: process
- artifacts: CatalogPage.tsx, OfferingCatalog
- decision-mention: none

### ITEM [batch2.md#73]
- report: TASK-PLUSPASS-REPORT.md
- date: 2026-08-06
- item: test/db (the repo's DB-level suite) was not run — no backend changes were made, but this branch has not re-confirmed that suite.
- quote: "**`test/db/*`** (the repo's DB-level suite) was not run — this task made no backend/migration changes, so it's out of scope, but it also means I have not re-confirmed that against this branch."
- kind: not-verified
- artifacts: test/db
- decision-mention: none

### ITEM [batch2.md#86]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: Defect written down, not fixed: /acquisition renders zero offerings — all three acquisition SKUs have price_amount = NULL and the reader filters them out; a primary-nav marketing page that cannot be completed.
- quote: "**`/acquisition` renders zero offerings** — all three acquisition SKUs have `price_amount = NULL` and the reader filters them out."
- kind: defect
- artifacts: /acquisition, offerings.price_amount
- decision-mention: none

### ITEM [batch2.md#90]
- report: TASK-REVIEWNAV-REPORT.md
- date: 2026-08-12
- item: D13 conflict stated plainly: accepting a page out of Review requires a code change (a thread), not a button — no editor is proposed since the acceptance action is inherently the re-bucketing work, but the owner should know and can name a real follow-up if unacceptable.
- quote: "the owner should know that \"move it out of Review\" is a request he has to make, not a button he can press. If that is unacceptable, the follow-up is a real one and should be named."
- kind: blocked-on-owner
- artifacts: src/lib/reviewSection.ts, AppLayout.tsx
- decision-mention: D13

### ITEM [batch3.md#10]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: The new DataTable scroll wrapper forces overflow-y:auto, so any future popover/menu added inside a DataTable cell will get clipped — a real component constraint marked only by a code comment.
- quote: "This is a real constraint on the *component*, though, not a non-issue in general — I added a one-line code comment (`FRAMESCROLL: ...`) at the wrapper so a future author adding a popover/menu inside a `DataTable` cell has a pointer to why it would get clipped."
- kind: caveat
- artifacts: src/components/ops/kit/DataTable.tsx
- decision-mention: none

### ITEM [batch3.md#17]
- report: TASK-FRAMESCROLL-REPORT.md
- date: 2026-08-11
- item: Audit finding (driver 4, confirmed Yes, not fixed): OrderPayment's CopyRow value span (Zelle payment_reference) lacks break-all, unlike Footer's equivalent guard.
- quote: "`src/components/order/OrderPayment.tsx:24-28,157-159` ... `CopyRow`'s value `<span>` (renders `order.payment_reference`, a Zelle memo code) has no `break-all`"
- kind: defect
- artifacts: src/components/order/OrderPayment.tsx:24-28
- decision-mention: none

### ITEM [batch3.md#97]
- report: TASK-TIPTAP-REPORT.md
- date: 2026-08-07
- item: The throwaway interaction test that caught the mount-deadlock bug (a permanently-broken tooltip that typecheck/lint/build all passed cleanly on) was deleted, not committed — reconstructable on request; the bug class is invisible to every committed check.
- quote: "Nothing in typecheck, lint, or the production build would have caught it — all three passed cleanly on the broken version too."
- kind: process
- artifacts: src/components/app/ExplainTip.tsx
- decision-mention: none

---

### ITEM [batch3.md#101]
- report: TASK-UIBUILD-LOG.md
- date: 2026-08-10
- item: UIO-002 correction: the order's stated desktop contrast (13.4:1 for #0d2118 on #f5f0e8) doesn't match the shipped colours — independently computed 14.83:1; the order appears to have reused an unrelated figure. Not a safety regression; flagged for UIREVIEW to correct.
- quote: "**Desktop, `#0d2118` on the header `#f5f0e8`: I compute 14.83:1, not the 13.4 the order's table states.**"
- kind: correction
- artifacts: .oh-avatar, src/components/app/app-header.css
- decision-mention: none

### ITEM [batch4.md#41]
- report: TASK-ACCTEVAL-REPORT.md
- date: 2026-08-06
- item: Browser behaviour was not verified — all click-depth figures counted from routing/component source, app not run.
- quote: "Browser behaviour. Everything in §7 was counted from the routing and component source. I did not run the app or click through it."
- kind: not-verified
- artifacts: none
- decision-mention: none

### ITEM [batch4.md#55]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: The nav-entry diff for /app/ops was specified but NOT applied (AppLayout.tsx is NAVMOTION's); flagged with a sequencing warning that it duplicates what LEADCLEAN is removing.
- quote: "The nav entry — exact diff, NOT applied ... this is flagged rather than decided: **apply it for the evaluation window, and expect to remove it in the same motion that resolves LEADCLEAN.**"
- kind: blocked-on-owner
- artifacts: AppLayout.tsx
- decision-mention: none

### ITEM [batch4.md#88]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: The classification of all 371 functions is an evaluation of guard text, not execution; the "86 no identity check" is an over-count of real exposure by an unknown amount (a trigger/CHECK/FK could stop an unguarded function).
- quote: "**The classification of all 371 is an evaluation of guard *text*, not an execution.** ... **My 86 'no identity check' is therefore an over-count of the real exposure, in an unknown amount.**"
- kind: not-verified
- artifacts: none
- decision-mention: none

### ITEM [batch4.md#89]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: No unguarded function was executed and no PostgREST HTTP probe was made — "no effective guard" is a claim about the code, not a demonstrated exploit.
- quote: "**I did not execute any of the unguarded functions.** 'No effective guard' is a claim about the code and the predicate, not a demonstration of a completed exploit. ... **No PostgREST HTTP probe.**"
- kind: not-verified
- artifacts: none
- decision-mention: none

### ITEM [batch4.md#92]
- report: TASK-NOGUARD3-REPORT.md
- date: 2026-08-11
- item: Phase B was held as dry-run-only pending the owner decision, then applied later by the orchestrator; the delay is called out as an orchestrator failure (threads set to stop-for-review, loop not closed).
- quote: "**Why this sat unapplied:** the orchestrator sets threads to stop-for-review and had not been closing the loop. That is the mechanism behind work being specified and never shipping, and it is an orchestrator failure rather than a thread failure."
- kind: process
- artifacts: 20260811T0200, 20260811T0300, 20260811T0400
- decision-mention: D1a

### ITEM [batch4.md#132]
- report: TASK-WALLSYNC-REPORT.md
- date: 2026-08-07
- item: The two WALLSYNC migrations rewrite function bodies and are not replayable on a fresh database (standing CLAUDE.md caveat), like ~31 existing migrations.
- quote: "Standing caveat from `CLAUDE.md` applies: like ~31 existing migrations these rewrite function bodies and are not replayable on a fresh database."
- kind: process
- artifacts: 20260807T1500, 20260807T1510
- decision-mention: none

### ITEM [batch5.md#2]
- report: PROMPT_A_STAGES_1-3.md
- date: 2026-08-01
- item: U2.7(b) golden-render suite is blocked because the PGlite test harness cannot build a database — one broken migration (20260709160000_enforce_launch_modules.sql) fails on an org_modules FK, making every test/db/*.test.ts file unrunnable.
- quote: "U2.7(b) is blocked ... The PGlite harness cannot build a database ... The blocker is one broken migration. Repairing it is its own unit with its own verification, deliberately not improvised here."
- kind: blocked
- artifacts: supabase/migrations/20260709160000_enforce_launch_modules.sql, test/db/harness.ts, test/db/*.test.ts
- decision-mention: D8 (report's internal decision numbering)

### ITEM [batch5.md#60]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Flagged for TYPEPASS, not fixed — Libre Caslon Text ships only 400 and 700; the app's font-medium (500) on .heading-display/.heading-section/.heading-card will synthesise or snap to 400, and those rules' Cormorant-justifying comments are dead; weights need re-picking.
- quote: "**Libre Caslon Text ships 400 and 700 only — there is no 500.** ... that rationale is dead and the weights need re-picking."
- kind: known issue
- artifacts: src/index.css, tailwind.config.js
- decision-mention: none

### ITEM [batch5.md#61]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Flagged for TYPEPASS — Libre Caslon runs larger/heavier than Cormorant at the same px, so headings across the app will read bigger than before.
- quote: "Libre Caslon runs larger and heavier than Cormorant at the same px, so headings across the app will read bigger than before."
- kind: known issue
- artifacts: src/index.css, tailwind.config.js
- decision-mention: none

### ITEM [batch5.md#62]
- report: TASK-HEADER-REPORT.md
- date: 2026-08-06
- item: Flagged for TYPEPASS — the app-wide `-webkit-font-smoothing: antialiased` on <html> is measurably thinning display type and is worth revisiting.
- quote: "`-webkit-font-smoothing: antialiased` on `<html>` is worth revisiting app-wide now that it is measurably thinning display type."
- kind: known issue
- artifacts: src/index.css
- decision-mention: none

### ITEM [batch6.md#27]
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: lint baseline drifted — 39 warnings vs CLAUDE.md's "~26"; identical count before and after the diff.
- quote: "0 errors, 39 warnings, identical count before and after the diff (the repo's baseline has drifted from CLAUDE.md's '~26')."
- kind: process
- artifacts: eslint baseline
- decision-mention: none

---

### ITEM [batch6.md#36]
- report: TASK-FACILITYTERM-REPORT.md
- date: (no explicit header date)
- item: Open owner question — confirm mod.barnops is renamed in production org_modules rows or kept as a stable internal key forever.
- quote: "barnops module rename: confirm the plan above once AppLayout.tsx is free, including whether mod.barnops gets renamed in production org_modules rows or kept as a stable internal key forever"
- kind: blocked-on-owner
- artifacts: mod.barnops, org_modules
- decision-mention: none

### ITEM [batch6.md#44]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Defect B (reported, not fixed) — breed and colour cannot hold a typed-in value at all (FKs into horse_breeds/horse_colors); "Other (enter manually)" can only fail; owner call, DB change.
- quote: "breed and colour cannot hold a typed-in value at all ... The 'Other (enter manually)…' escape ... writes the typed text straight into the column, which can only ever fail. ... Owner call, DB change, outside this task."
- kind: defect
- artifacts: horses.breed, horses.color, horse_breeds, horse_colors, SelectOrOther, horse_field_token_value
- decision-mention: none

### ITEM [batch6.md#45]
- report: TASK-HORSEINTAKE-REPORT.md
- date: (no explicit header date)
- item: Consequence for the owner to see — on the six N/A-able columns 'N/A' is stored as NULL, so {{HORSE.*}} tokens (now incl. breed/colour) render blank on the vet authorization; clean fix is in the DB.
- quote: "On those six columns 'N/A' is stored as NULL, so the corresponding {{HORSE.*}} token renders blank on the vet authorization rather than 'N/A'."
- kind: data-integrity
- artifacts: HORSE_SENTINEL_UNSAFE_KEYS, {{HORSE.*}} tokens
- decision-mention: none

### ITEM [batch6.md#80]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Multi-line guards may have slipped through — line-level extraction; mitigated with whole-body regexes but did not read all 326 function bodies.
- quote: "Multi-line guards. Line-level extraction; a guard split across lines such that no single line holds both the predicate and the negation could slip through. I mitigated with whole-body regexes but did not read all 326 bodies."
- kind: not-verified
- artifacts: pg_proc function bodies
- decision-mention: none

### ITEM [batch6.md#86]
- report: TASK-NULLUID-REPORT.md
- date: (no explicit header date)
- item: Deviation — author synced seven changed function bodies into test/db/fixtures/schema_snapshot.sql (repo convention is batch regeneration, not per-migration); made deliberately to exercise the real guard against the PGlite hazard.
- quote: "I also synced the seven changed bodies into test/db/fixtures/schema_snapshot.sql ... The repo's convention is batch regeneration, not per-migration, so this is a small deviation"
- kind: process
- artifacts: test/db/fixtures/schema_snapshot.sql
- decision-mention: none

### ITEM [batch7.md#26]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-5 — Marketing entirely missing at the schema level; no campaign/audience/schedule/post-performance table exists.
- quote: "Marketing, entirely | No campaign, post-performance, or planning surface, and no tables to build one on."
- kind: inventory
- artifacts: content_posts, feed_posts, content_resources, content_blocks
- decision-mention: none

### ITEM [batch7.md#29]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: F-1 — half the fulfillment-unit ledger is orphaned: 6 of 12 units point at purchase_id/purchase_item_id that no longer exist despite ON DELETE CASCADE, evidencing ~57 hard-deleted purchases.
- quote: "Half the ledger is orphaned. 6 of the 12 units point at `purchase_id` and `purchase_item_id` values that no longer exist, despite both FKs being `ON DELETE CASCADE`"
- kind: data-integrity
- artifacts: fulfillment_units, purchases, purchase_items
- decision-mention: none

### ITEM [batch7.md#31]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: Could not determine why the 6 orphaned units survived a validated cascade — mechanism inferable but the specific event is unrecoverable; any obligations page needs an orphan filter.
- quote: "Why the 6 orphaned units survived a validated cascade (F-1). The mechanism is inferable ... but the specific event is not recoverable"
- kind: data-integrity
- artifacts: fulfillment_units
- decision-mention: none

### ITEM [batch7.md#32]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: Could not determine whether the 39 scheduled bookings should have carried purchase links (F-2), i.e. wiring bug vs legacy data; needs the booking-creation path traced before M-3.
- quote: "Whether the 39 scheduled bookings should have carried purchase links (F-2) ... needs the booking-creation path traced end to end — out of scope"
- kind: data-integrity
- artifacts: bookings
- decision-mention: none

### ITEM [batch7.md#36]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: The 6 orphaned fulfillment units (purchase and item GONE despite ON DELETE CASCADE) were reported and left untouched; ~71 purchases were removed with referential integrity suppressed; owner has not ruled.
- quote: "The 6 orphaned units — reported, untouched ... The owner has not ruled on them and they are left exactly as found."
- kind: data-integrity
- artifacts: fulfillment_units, purchases, purchase_items
- decision-mention: none

### ITEM [batch7.md#37]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: A backfill of the 319 existing bookings is recommended against — purchase_id/credit_id/horse_id mostly unrecoverable; the 39 real bookings are a hand-kept record whose supporting rows were deleted.
- quote: "Recommend no backfill. Fix forward; let the existing rows be what they are."
- kind: data-integrity
- artifacts: bookings, lesson_credits
- decision-mention: none

### ITEM [batch7.md#38]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #1 — createLessonCredit is duplicated across src/lib/api.ts:1814 and src/lib/ops/api-lessons.ts:251; a future change made in one will be missed in the other.
- quote: "`createLessonCredit` is duplicated ... the duplication means a future change will be made in one and missed in the other."
- kind: defect
- artifacts: src/lib/api.ts, src/lib/ops/api-lessons.ts
- decision-mention: none

### ITEM [batch7.md#43]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Flagged #6 — listLessonSessions() reads 318 where 39 exist; TASK-COUNTFIX owns the read path, not touched.
- quote: "`listLessonSessions()` reads 318 where 39 exist — TASK-COUNTFIX owns the read path. Not touched."
- kind: defect
- artifacts: listLessonSessions()
- decision-mention: none

### ITEM [batch7.md#44]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Changed bookings.purchase_id FK from ON DELETE CASCADE to SET NULL because BOOKWRITE writers now populate it and a purchase delete would otherwise destroy booking history; an armed cascade this task closed.
- quote: "leaving that armed was not acceptable. Changed to `ON DELETE SET NULL` ... A cascade this task armed, and closed."
- kind: data-integrity
- artifacts: bookings.purchase_id
- decision-mention: D11

### ITEM [batch7.md#93]
- report: TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md
- date: 2026-08-08
- item: Open question — may NOGUARD2 apply migrations to production in-thread, or stop at dry-run for review.
- quote: "May NOGUARD2 apply migrations to production in-thread, or stop at dry-run for review?"
- kind: blocked-on-owner
- artifacts: none
- decision-mention: none

### ITEM [batch7.md#106]
- report: TASK-NOGUARD1-REPORT.md
- date: 2026-08-07
- item: Limitation — dynamic SQL (org_public_config, rls_auto_enable use EXECUTE format) is invisible to every method used; cannot generalise from two.
- quote: "A guard assembled at runtime is invisible to every method I used. Neither of those two hides a guard, but I cannot generalise from two."
- kind: not-verified
- artifacts: org_public_config, rls_auto_enable
- decision-mention: none

### ITEM [batch7.md#117]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: D-1 (real, live) — block_settled_billable_line_update() trigger references NEW.transaction_id, a column dropped with the transactions retirement; any UPDATE to a SETTLED billable_lines row raises a misleading error and blocks legitimate updates (e.g. deleted_at). Reported, not patched.
- quote: "a seal trigger references a dropped column ... a legitimate update to a settled row (e.g. stamping `deleted_at`) fails too."
- kind: defect
- artifacts: block_settled_billable_line_update(), billable_lines
- decision-mention: none

### ITEM [batch7.md#119]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Correction — a first looser scan suggested nine functions referencing dropped tables; eight were false (JSON keys/comments), only owns_order genuinely queries a dropped table.
- quote: "a first, looser scan suggested nine functions referencing dropped tables. Eight were false ... I nearly reported eight defects that do not exist."
- kind: correctness
- artifacts: owns_order(uuid)
- decision-mention: none

### ITEM [batch8.md#28]
- report: TASK-DASHLEADS-REPORT.md
- date: 2026-08-11
- item: Browser render of the new dashboard leads band was not verified — no staff session available; correctness checked by reading only.
- quote: "**Browser render: NOT VERIFIED.** No staff session available in this worktree, per the task's own constraint."
- kind: not-verified
- artifacts: src/components/app/DashboardPanel.tsx, src/lib/ops/useOpenLeads.ts, src/pages/app/InstructorHome.tsx
- decision-mention: none

### ITEM [batch8.md#57]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: Correction — CLAUDE.md's stated "~26" lint-warning baseline is stale; the measured baseline on origin/main is 36.
- quote: "36 warnings, 0 errors — **identical to the count on `origin/main`, measured, so this change adds none** (CLAUDE.md's '~26' is stale)"
- kind: correction
- artifacts: CLAUDE.md
- decision-mention: none

### ITEM [batch1.md#102]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: F5: the "more waiting" expand control cannot be exercised against live data (five open leads against a six-card preview = zero remainder, so it never renders today) — proven by UI test only.
- quote: "**F5 — the \"more waiting\" control cannot be exercised against live data.** ... the control does not render at all today."
- kind: not-verified
- artifacts: DashboardPanel.tsx (LEAD_PREVIEW)
- decision-mention: none

### ITEM [batch1.md#104]
- report: TASK-LEADCLEAN-REPORT.md
- date: 2026-08-11
- item: Known issue: most test/db suites fail at setup on both trees — the snapshot postdates the offering_tiers removal ("relation offering_tiers does not exist"); organizations and service_catalog fail assertions identically on main.
- quote: "Most suites fail at setup on both trees (`relation \"offering_tiers\" does not exist` — the snapshot postdates the tiers removal)"
- kind: process
- artifacts: test/db
- decision-mention: none

### ITEM [batch1.md#144]
- report: TASK-PROFILE-REPORT.md
- date: 2026-08-05
- item: Disk-space incident disclosed: volume at 99%; deleted only node_modules of 19 already-merged worktrees (8GB reclaimed); flagged for whoever owns worktree hygiene — it will hit the same wall again soon.
- quote: "Flagging this for whoever owns worktree hygiene — it will hit the same wall again soon."
- kind: process
- artifacts: claude-code-repo worktrees
- decision-mention: none

### ITEM [batch2.md#1]
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: golden_render.test.ts calls a nonexistent `.sql()` method on the test harness (should be `.q()`) at all three call sites; reported and deliberately not fixed as out of Task 4's scope.
- quote: "Only `golden_render.test.ts` calls a nonexistent `.sql()` method, at all three of its call sites."
- kind: defect
- artifacts: test/db/golden_render.test.ts, test/db/harness.ts
- decision-mention: D21

### ITEM [batch2.md#9]
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: The governing spec hardening-unit-spec.md was found in ~/Downloads rather than the repo — flagged and located per instruction.
- quote: "`hardening-unit-spec.md` (found in `~/Downloads`, not the repo — flagged and located per instruction)"
- kind: process
- artifacts: hardening-unit-spec.md
- decision-mention: none

### ITEM [batch2.md#10]
- report: POST_RUN_CLOSEOUT.md
- date: 2026-08-02
- item: fhequestrian.com is a separate Namecheap-parked redirect domain, out of scope per instruction, not touched or tested this run.
- quote: "`fhequestrian.com` is the separate Namecheap-parked redirect domain, out of scope per instruction, not touched or tested this run"
- kind: inventory
- artifacts: fhequestrian.com
- decision-mention: none

### ITEM [batch2.md#16]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: U2.8 deductible gating remains staged only, not applied; its JSON should be updated to the any/equals positive form (the engine has no not_equals) before it is ever applied.
- quote: "**U2.8 deductible gating** — staged only, per the Stage 1–3 report; U2.8's JSON should be updated to the `any`/`equals` positive form per D12 before it is ever applied."
- kind: process
- artifacts: U2.8 gating JSON
- decision-mention: D12

### ITEM [batch2.md#19]
- report: PROMPT_A_STAGES_4-5.md
- date: 2026-08-02
- item: fhequestrian.com does not serve the application — it is Namecheap-parked with port 443 refusing connections; a DNS/registrar configuration issue reported as a finding, out of scope.
- quote: "**DOM/domain**: `fhequestrian.com` is Namecheap-parked, not serving the app — a DNS/registrar issue, reported, out of scope."
- kind: defect
- artifacts: fhequestrian.com
- decision-mention: D9

### ITEM [batch2.md#64]
- report: TASK-PAGEVIS-REPORT.md
- date: 2026-08-12
- item: One pre-existing failing test in test/ui (pluspass_create_controls.test.tsx:63) fails identically on a clean tree — not touched, not fixed here.
- quote: "**1 failed** — `pluspass_create_controls.test.tsx:63`. **Pre-existing**: `git stash -u` and re-run gives the same single failure on a clean tree."
- kind: defect
- artifacts: test/ui/pluspass_create_controls.test.tsx
- decision-mention: none

### ITEM [batch3.md#84]
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: Judgment call stated as such: /app/ops/directory redirects to the Vendors tab (not Partners) because the old Directory blurb (farriers, vets, suppliers) reads as Vendor.
- quote: "**Vendor chosen over Partner** because most of the old Directory blurb ... reads as Vendor ... stated here as a judgment call, not a neutral fact"
- kind: deviation
- artifacts: /app/ops/directory, /app/records/vendors
- decision-mention: none

### ITEM [batch3.md#86]
- report: TASK-RECORDS-REPORT.md
- date: 2026-08-12
- item: test:db is broken independent of this task, per the standing note, and was not cited.
- quote: "`test:db` not cited, per the standing note that it is broken independent of this task."
- kind: known issue
- artifacts: test/db
- decision-mention: none

---

### ITEM [batch4.md#8]
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: Lint shows 29 warnings vs CLAUDE.md's stated ~26 baseline; reconciled by re-running lint on clean main to confirm 29 is the real baseline.
- quote: "CLAUDE.md's stated baseline is '~26 pre-existing warnings'; 29 is close enough that I re-ran lint on a clean `origin/main` checkout ... 29 pre-existing warnings on main"
- kind: process
- artifacts: none
- decision-mention: none

### ITEM [batch4.md#9]
- report: TASK-A8B-REPORT.md
- date: 2026-08-04
- item: api/request-received.ts shows as modified in git status but was pre-existing uncommitted work, left untouched and excluded from the commit.
- quote: "`api/request-received.ts` shows as modified in `git status` but was not touched by this task — it was already modified, uncommitted, in the working tree before this session started ... left untouched and excluded"
- kind: process
- artifacts: api/request-received.ts
- decision-mention: none

### ITEM [batch4.md#47]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: M-6 reversed as directed — nothing was retired, gated or deleted; removal candidates X-1…X-4 remain untouched and unruled.
- quote: "M-6 was reversed as directed: **nothing was retired, gated or deleted.** The removal candidates X-1 … X-4 are untouched and remain unruled."
- kind: blocked-on-owner
- artifacts: X-1, X-2, X-3, X-4
- decision-mention: M-6

### ITEM [batch4.md#50]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: D-3 — InstructorHome's status chip is keyed lowercase but statuses are uppercased, so the lookup never matches and every row falls through to "Scheduled"; a cancelled lesson renders as Scheduled.
- quote: "D-3 · The status chip always says 'Scheduled', whatever the real status is. ... The lookup therefore **never matches** ... A cancelled lesson renders as 'Scheduled'. The chip is decorative."
- kind: defect
- artifacts: InstructorHome, lessonSessionFromBooking, STATUS_CHIP
- decision-mention: D-3

### ITEM [batch4.md#54]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: Recommendation (not implemented): OpsDashboard should not replace DashboardPanel and InstructorHome should not ship as-is; the call is the owner's, downstream of LEADCLEAN.
- quote: "`OpsDashboard` should not replace `DashboardPanel`, and `InstructorHome` should not ship as-is. ... **Not implemented, per the direction.** The call is the owner's and it is downstream of LEADCLEAN landing."
- kind: blocked-on-owner
- artifacts: OpsDashboard, DashboardPanel, InstructorHome
- decision-mention: none

### ITEM [batch4.md#58]
- report: TASK-ADMINSWEEP-PHASE2.md
- date: 2026-08-11
- item: Pre-existing test failure in pluspass_create_controls.test.tsx reproduces on clean main; unrelated to this work.
- quote: "The pre-existing failure in `test/ui/pluspass_create_controls.test.tsx` (1 failed / 10 passed) reproduces identically on clean `origin/main` and is unrelated to this work."
- kind: process
- artifacts: test/ui/pluspass_create_controls.test.tsx
- decision-mention: none

### ITEM [batch6.md#25]
- report: TASK-ADDITEM-REPORT.md
- date: 2026-08-12
- item: npm run test:db is nondeterministic on this machine (three runs gave 20, 25, 6 failures); pre-existing and unrelated.
- quote: "npm run test:db is nondeterministic on this machine: three consecutive runs of the identical tree gave 20, 25 and 6 failures. ... The suite's variance is pre-existing and unrelated."
- kind: known-issue
- artifacts: test:db
- decision-mention: none

### ITEM [batch7.md#24]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-3 — no obligations view of Lessons; neither the KPI hub nor the sessions board shows what the business is carrying.
- quote: "Obligations view of Lessons ... Neither shows what the business is carrying."
- kind: inventory
- artifacts: /app/ops/lessons, lesson_packages, lesson_credits
- decision-mention: none

### ITEM [batch7.md#27]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-6 — a staff landing surface (OpsDashboard, InstructorHome) is built but unreachable; owner reversed the InstructorHome retirement ("wire up, don't retire").
- quote: "A landing surface for staff | `OpsDashboard` and `InstructorHome` are both built and both unreachable (R-1)."
- kind: inventory
- artifacts: OpsDashboard, InstructorHome
- decision-mention: none

### ITEM [batch7.md#28]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: M-7 — a brokerage surface is missing; mod.brokerage is on with nothing behind it.
- quote: "A brokerage surface | `mod.brokerage` is on with nothing behind it."
- kind: inventory
- artifacts: mod.brokerage
- decision-mention: none

### ITEM [batch7.md#33]
- report: TASK-ADMINSWEEP-PHASE1.md
- date: 2026-08-11
- item: Could not determine whether "Horse care" (M-2) is a module or a section — a Phase 2 structure decision.
- quote: "Whether "Horse care" (M-2) is a module or a section. The catalog segmentation ... supports either. This is a Phase 2 structure decision."
- kind: blocked-on-owner
- artifacts: offerings (segment='horse')
- decision-mention: none

### ITEM [batch7.md#45]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: NOT VERIFIED — the UI (instructor picker, purchase auto-link, service picker, consumed/open transitions) has not been exercised in a browser; 9-step checklist outstanding.
- quote: "The UI has not been exercised in a browser. Checklist: ..."
- kind: not-verified
- artifacts: CalendarItemPanel.tsx, ScheduleSessionForm.tsx
- decision-mention: none

### ITEM [batch7.md#47]
- report: TASK-BOOKWRITE-REPORT.md
- date: 2026-08-12
- item: Rolled-back proofs consumed display-code sequence numbers (purchase_code_seq at 95, booking_code_seq at 438), so the next real rows will have visible gaps; no rows were created.
- quote: "Display-code sequences are non-transactional, so the rolled-back proof runs consumed numbers without creating rows ... leaving visible gaps."
- kind: process
- artifacts: purchase_code_seq, booking_code_seq
- decision-mention: none

### ITEM [batch7.md#50]
- report: TASK-C10-REPORT.md
- date: 2026-08-04
- item: deliver-evaluation-report.ts's minor branch could not be exercised against live data — no evaluation report belongs to a minor; reasoned, not exercised.
- quote: "no evaluation report exists for Gabriella or any minor today ... this specific file's minor branch was reasoned, not exercised."
- kind: not-verified
- artifacts: api/deliver-evaluation-report.ts
- decision-mention: none

### ITEM [batch7.md#83]
- report: TASK-I1B-REPORT.md
- date: 2026-08-05
- item: The build's prerender step fails with supabaseUrl is required; confirmed pre-existing on origin/main (worktree has no .env), not a regression.
- quote: "The build script's prerender step (`scripts/prerender.mjs`) fails with `supabaseUrl is required` — confirmed this is pre-existing on `origin/main` ... not a regression"
- kind: process
- artifacts: scripts/prerender.mjs
- decision-mention: none

### ITEM [batch7.md#124]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Stale premise cluster — tests assert FHE has mod.barnops/mod.employees OFF but production has all six mod.* enabled; the gate mechanism is fine, the tests need a rival org as the OFF case.
- quote: "Tests assert FHE has `mod.barnops`/`mod.employees` OFF. Production has all six `mod.*` enabled. The gate mechanism is fine; the vehicle is out of date"
- kind: correctness
- artifacts: org_modules
- decision-mention: none

### ITEM [batch7.md#125]
- report: TASK-TESTDB-REPORT.md
- date: 2026-08-12
- item: Recommendation not applied — capping maxWorkers to 4 cuts internal test time (1201s→680s) with identical pass results but was deliberately left out of committed config so bigger machines stay fast; set on memory-constrained CI.
- quote: "Recommendation, not applied: capping `maxWorkers` to 4 ... I deliberately left it out of the committed config so bigger machines stay fast."
- kind: process
- artifacts: vitest.config.ts
- decision-mention: none

### ITEM [batch8.md#12]
- report: HANDOFF_DEAL_SALE_BUILD_2026-08-04.md
- date: 2026-08-04
- item: start_bill_of_sale_standalone has no UI caller and its distinct standalone behavior was never exercised end to end.
- quote: "**`start_bill_of_sale_standalone` has no UI caller** and its distinct behavior (`BOS_HAS_SALE_AGREEMENT=NO`, standalone ownership transfer) was never exercised end to end."
- kind: not-verified
- artifacts: start_bill_of_sale_standalone
- decision-mention: none

### ITEM [batch8.md#27]
- report: TASK-DASHLEADS-REPORT.md
- date: 2026-08-11
- item: Open question for the owner — should the unreachable /app/ops surface (InstructorHome/OpsDashboard) be retired ("hidden, not deleted") or reconnected as what staff see at /app/dashboard; the routing decision was deliberately not made.
- quote: "**Open question for the owner/orchestrator:** is `InstructorHome`/`OpsDashboard` (the `/app/ops` surface) meant to be retired ... or reconnected as what a trainer/admin sees at `/app/dashboard` ... I did not make it unasked."
- kind: blocked-on-owner
- artifacts: src/pages/app/InstructorHome.tsx, OpsDashboard, OpsHome, /app/ops, DashboardHome.tsx
- decision-mention: none

### ITEM [batch8.md#56]
- report: TASK-NAVMOTION-REPORT.md
- date: 2026-08-11
- item: Deviation — the order's named branch point 3d6663b was five commits stale (one later commit was the task's own amendments); branched off current origin/main instead. Not pushed.
- quote: "Branching at the named SHA would have built the superseded bounce. Branched off current `origin/main` instead. Not pushed."
- kind: deviation
- artifacts: branch task/navmotion
- decision-mention: none
