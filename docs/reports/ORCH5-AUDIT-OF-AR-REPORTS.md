# ORCH5 AUDIT OF THE SIX AR REPORTS — 2026-08-30

**Every URGENT finding re-verified against production with my own queries before ORCH6 inherits any
of it.** Branches `task/ar1` … `task/ar6`, reports committed, none pushed. **All six are report-only
as instructed — no code, no migrations.**

## ✅ CONFIRMED — four URGENT findings, all real

**AR1 · editing a session silently reassigns its instructor.** `calendar_free_busy` **never returns
`instructor_user_id` in any branch** (verified against the live body). `save_calendar_item:67` does
`IF v_instr IS NULL AND v_kind IN ('lesson','care') THEN v_instr := auth.uid()` then updates
unconditionally at `:113`. **`all_day` has the identical shape at `:123`.** The panel cannot send
what the read never gave it. ⚠️ **Two clicks from the dashboard's Today zone.**

**AR2 · a paid $880 plan placed nothing — and it is five of six.** Measured:

| Client | Order | Payment | Bookings | Credits | Config |
|---|---|---|---|---|---|
| *(Steph)* | PUR-000320 | paid | **27** | 4 | configured |
| **Madeline Do** | **PUR-000319** | **PAID** | **0** | **0** | **EMPTY** |
| Madeline Do | PUR-000230 | unpaid | 4 | 1 | EMPTY |
| Rachel Page | PUR-000302 | unpaid | 0 | 0 | EMPTY |
| Evan LaBuzetta | PUR-000330 | unpaid | 1 | 0 | EMPTY |
| Gabriella Olenik | PUR-000106 | unpaid | 1 | 0 | EMPTY |

⚠️ **Worse than the summary states: Madeline's four bookings hang off the UNPAID order while the PAID
one placed nothing.** The single working plan is the only one with a non-empty `config`.

**AR3 · the dashboard's "People waiting" Open link is dead.** Confirmed by running
`admin_client_accounts()`: **Rachel Page, Casey Caddell AND Rachel Engelhorn are all absent from the
Clients tab**, so `?open=<id>` silently no-ops for every row on the board. ⚠️ **AR3 named two; there
are three.**

**AR6 · `admin_oversight()` reads `audit_logs` with no WHERE clause.** Verified: `audit_logs` has
**no `org_id` column at all** (0 rows in `information_schema`), the function is `SECURITY DEFINER`,
and its audit branch is a bare `SELECT … FROM audit_logs ORDER BY occurred_at DESC LIMIT 50`. **Every
sibling count in the same function is correctly scoped to `current_org()`** — which is what makes it
stand out rather than look like a convention. Harmless at one tenant; a cross-tenant disclosure the
moment there are two, with no code change needed to trigger it. ⚠️ **This one is a schema change, not
a query fix.**

## ⚠️ THE FINDING I RATE HIGHEST, AND IT IS NOT MARKED URGENT

**AR4 and AR5 independently found that Settings and Modules were never removed from the sidebar.**
Confirmed: **no filter exists anywhere**, and `navGroups` is rendered whole at `AppLayout.tsx:1682`,
`:1935` and `:2168` — desktop rail, pinned rail and mobile drawer.

⚠️ **THE COMMENT AT `AppLayout.tsx:636` ASSERTS THE FIX AND QUOTES THE OWNER TWICE:**
> *"Settings and Modules stay in THIS array and are filtered out of the SIDEBAR at the render site
> below — they are not nav rows any more (owner 2026-08-15: "modules and settings should all be
> inside of the account page", then on finding them still there: "the settings and modules sections
> are still in the nav and they still show pages")."*

**So the owner reported this defect, a fix was recorded in prose, the filter was never written, and he
has now hit it a second time — which is why it is item 8 on the 2026-08-29 list.** ⚠️ **This is the
purest instance yet of a comment asserting a behaviour the code does not have** — the same class as
`Onboarding.tsx:773`'s false claim that `record_signature` enforces the name server-side.

**The comment also names the real constraint, and it is load-bearing:** the entries cannot simply be
deleted, because `/app/ops/settings` and `/app/ops/modules` render their own contents by calling
`manageNavGroups()` and looking themselves up by key. **The destination and the discarded nav row are
fed by one source, deliberately.**

## CORRECTIONS THE THREADS MADE TO MY BRIEFS — all accepted

1. **AR2:** the tabs do not "render against nothing" — `Admin.tsx:1018/:1033` gate the rail and body
   on `selected.kind === 'account'`, so they do not render at all. **My §1 was wrong.**
2. **AR2:** the standing slot was never settable from `ProvisionClientForm`. `AgreedLessonSection`
   books ONE lesson; the real control is `StaffStandingSlotSection`, which mounts only on
   `ContactDossierModal`. ⚠️ **So CR-81's "no surface exists" was stale — the surface exists on a page
   the Clients list cannot open.** **My AR2 brief and my report to the owner both said otherwise.**
3. **AR1:** the calendar is **not** parked in Review — restored 2026-08-15, hardcoded in both rails.
   The missing registry row costs exactly one thing: it is the only nav destination a tenant cannot
   toggle. **My brief said D17's original instance was still open. It is not.**
4. **AR1:** the tenant timezone is **not** missing — it is set in five Supabase settings outside the
   repo, which is why `lesson_plans_for_day`'s unconverted date cast is correct.
5. **AR4:** `GROUP_LABEL` is **not** dead — it renders as section headers on `/app/ops/admin/pages`.
   ⚠️ **I put "GROUP_LABEL is read by NOTHING" in the shared analysis standard, in AR3's brief, in
   AR4's brief and in the ORCH6 brief. It is wrong in all four.** Both label sources must be edited in
   lockstep or that admin page goes stale.
6. **AR1:** the furniture has a **live regenerator** — `/api/calendar-reminders` runs hourly and calls
   `publish_open_slots_all`, ~12 rows/day since 2026-08-23. ⚠️ **This overturns the standing "no Vercel
   cron has ever run" assumption recorded in D23 and in memory.** A migration deleting the 587 rows
   without touching that call reports success and is undone within the hour.

## SCHEDULING — what ORCH6 must not get wrong

- ⚠️ **AR4 and AR5 edit the same lines in four files.** Both say so. **One PR or fully sequenced —
  never parallel.**
- **AR6's P4/P5 also take `AppLayout.tsx` and `pageRegistry.ts`.** Same constraint.
- **AR2's P1+P2 must land together; AR6's P2+P3+P4 must land together.**
- **AR3 must not remove the Leads tab before AR2's P2 opens a new door** — Leads is currently the last
  general entrance onto the record surface.
- **AR1's furniture removal and its regenerator must be one change.**

## OWNER RULINGS THESE REPORTS ARE WAITING ON

1. **Madeline Do's paid plan** — what is owed and how it is placed. **A decision, not a build.**
2. **Where an offering status row links to** (AR6) — 138 of 200 feed rows; decides whether the feed is
   62 useful rows or 200 mostly-noise.
3. **Is Oversight admin-only or all-staff?** (AR6 — an instructor currently gets a heading and a red
   error, with a working panel hidden behind a failed sibling call.)
4. **Supersede or void** for the LaBuzetta signatures — still open from the AR7 work.
