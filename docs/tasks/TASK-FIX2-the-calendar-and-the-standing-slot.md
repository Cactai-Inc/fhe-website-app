# TASK-FIX2 — the instructor stamp, the recurring plan that places nothing, and the reach

⚠️ **THIS IS A BUILD TASK.** Report to `docs/reports/TASK-FIX2-REPORT.md`.

**Sources of truth, read both first:** `docs/reports/TASK-AR1-REPORT.md` (`task/ar1`, 991 lines) and
`docs/reports/TASK-AR2-REPORT.md` (`task/ar2`). ⚠️ **Both corrected the orchestrator on points of
fact. Their findings are the specification; this file is scope, rulings and traps.**

⚠️ **TWO OF THESE ARE LIVE DEFECTS DAMAGING PRODUCTION DATA TODAY.** They come first.

---

## 1. ⚠️ P0 — EDITING ANY SESSION SILENTLY REASSIGNS ITS INSTRUCTOR

**Confirmed against the live function bodies by the orchestrator.**
`calendar_free_busy` **never returns `instructor_user_id` in any branch**, so the panel's picker
always renders "You" and always sends NULL. `save_calendar_item:67` then does
`IF v_instr IS NULL AND v_kind IN ('lesson','care') THEN v_instr := auth.uid()` and updates
unconditionally at `:113`. ⚠️ **`all_day` has the identical shape at `:123` and is reset the same way.**

**Open a session to fix a typo, press Submit, and it becomes yours.** The dashboard's Today zone
deep-links straight into that panel — two clicks from *"look at today"* to corrupting the record.

### ⚠️ THE OWNER'S RULING CHANGES THE FIX — read it before designing anything
> *"This is only one instructor, the head trainer/owner, Claire, this means we dont need a selection
> method for this until we add another instructor in the future."*

**So do NOT build an instructor picker.** ⚠️ **The correct fix is that an edit must never CHANGE an
existing stamp** — preserve what is stored, default only on create. **Claire being the only
instructor is why a picker is unnecessary; it is not a reason to let an edit overwrite the field.**
**45 of 47 stamps are `hello@` and 2 are `admin@` — the 2 are the damage, and they are the proof.**

⚠️ **Fix `all_day` in the same change.** Same shape, same cause.
⚠️ **Decide and state whether the 2 wrong stamps are corrected** — that is a data repair on real
sessions. **Recommend; do not perform without saying so in the report.**

## 2. ⚠️ P0 — A PAID $880 PLAN PLACED NOTHING, AND IT IS FIVE OF SIX

**Measured by the orchestrator against production:**

| Client | Order | Payment | Bookings | Credits | Config |
|---|---|---|---|---|---|
| *(Steph)* | PUR-000320 | paid | **27** | 4 | **configured** |
| **Madeline Do** | **PUR-000319** | **PAID** | **0** | **0** | **EMPTY** |
| Madeline Do | PUR-000230 | unpaid | 4 | 1 | EMPTY |
| Rachel Page | PUR-000302 | unpaid | 0 | 0 | EMPTY |
| Evan LaBuzetta | PUR-000330 | unpaid | 1 | 0 | EMPTY |
| Gabriella Olenik | PUR-000106 | unpaid | 1 | 0 | EMPTY |

⚠️ **The only plan that placed anything is the only one with a non-empty `config`.** Madeline's four
bookings hang off her **UNPAID** order while the **PAID** one placed nothing.

**Your job is the MECHANISM: a recurring purchase must place its standing slots wherever it is
bought, not only where it happened to be configured.** ⚠️ **AR2 found the surface that works —
`StaffStandingSlotSection`, which mounts ONLY on `ContactDossierModal`** — and the Clients list
cannot open that page for any of its 24 people. **That is the reach half; §3 fixes it.**

⚠️ **RULED, AND NOT YOURS TO TOUCH:**
> *"the second order is to be fully expunged, the original order was paid and recorded legitimately,
> likely not the right timestamps, and needs proper provisioning when the system is made fully
> functional which will happen after the fixes land, then i will hand a list of timestamps."*

**Change no purchase, place no booking, expunge nothing.** ⚠️ **The owner does the data pass with his
own timestamps AFTER this lands. Build the mechanism so that pass is possible; do not pre-empt it.**
**Say in your report exactly what a staff member will need to do to provision Madeline once you are
done** — that sentence is what he will act on.

⚠️ **D23 GOVERNS THE SHAPE:** a recurring purchase gives **a standing weekly slot, not a credit
balance.** `weekly_frequency` is slots per week. **A recurring purchase producing a spendable credit
is defective** — except as the holding form for a session owed but not delivered. **An orchestrator
reported the zero balance as a defect and was corrected; do not report it again.**

## 3. THE REACH — the record page 17 of 24 clients cannot open

**AR2 corrected two of the orchestrator's premises. Build on the corrections, not the brief:**
- The nine tabs **do not render at all** — `Admin.tsx:1018` and `:1033` gate the rail and body on
  `selected.kind === 'account'`. `:739` merely skips the fetch.
- **It is not age. It is which tab you entered through.** All 24 Clients-list people are
  `contact_type='CONTACT'`; the dossier's live doors are Leads, Horses and Archived. **Not one of the
  24 can reach it.**
- `InvitePanel` sits inside `PendingClientView`, so **a signed-in client gets no provisioning surface
  either.** 9 of 24 have neither; **Pamela Godde and Charlotte Caddell are stranded with both gates
  shut.**

**Deliver: ONE record surface reachable at every stage of a person's life** — no account, invited,
signed in, archived. ⚠️ **AR2's F5 names all 14 capabilities that exist only on the provisioning
path, including six invitation-lifecycle controls (resend vs regenerate, expire, link history,
timeline). Retire the layout; keep the fourteen. Losing any is a regression.**

⚠️ **CR-75 and CR-74 are settled owner rulings and govern the shape:** the client record is an
**expanding row**, closing **saves**, and there is no separate save button. ⚠️ **AR2's F7 found the
dossier destroys unsaved edits on backdrop-click and Escape AND has a Save button — both halves
backwards. Fix that here.**

## 4. THE SMALLER CONFIRMED DEFECTS — cheap, and all verified

- ⚠️ **The dashboard's "People waiting" Open link is dead for everyone on it.** `?open=<id>` targets
  the Clients tab, fed by `admin_client_accounts()`. **Rachel Page, Casey Caddell AND Rachel
  Engelhorn are all absent from it** — the orchestrator found a third beyond AR3's two.
- **`admin_client_overview.counts.orders` reads `buyer_user_id`, NULL on all 13 live purchases** — it
  shows 0 while the Orders tab beside it shows 2.
- **The dossier's `invited` is `useState(false)`**, so it offers "Send invitation" to someone holding
  a live link and mints a second one.
- **Month view renders `dayItems.slice(0,3)` in start-time order**, so generated "Open" slots occupy
  every visible rank and real lessons sit at 10 and 11, **invisible and unopenable**.
- **`calendar_revenue` and `revenue_summary` disagree 9.7× — $18,320 vs $1,880 for August.**
  `revenue_summary` is right, the calendar already calls it, and **`calendar_revenue` and
  `calendar_money_items` now have zero call sites.** Retire behind a flag (D32).
- **`WeekZone` links `?on=<day>` while its sibling `TodayZone` already uses `bookingHref` (`?item=`)**
  — the helper is two files away.

## 5. ⚠️ THE FURNITURE HAS A LIVE REGENERATOR — do not delete without it

**AR1 overturned a standing assumption and it is load-bearing:** `/api/calendar-reminders` runs
**hourly** and calls `publish_open_slots_all(4 weeks, 60 min)`. **It is firing — ~12 new rows/day
since 2026-08-23, provable from `created_at` batches.**

⚠️ **This corrects the recorded "no Vercel cron has ever run" belief in D23 and in memory.**
⚠️ **A migration deleting the 587 rows without touching that call reports success and is undone
within the hour** — exactly `ORCHESTRATOR.md` §3.

⚠️ **AND THE REPLACEMENT IS NOT READY.** AR1 found that **neither `request_open_time` nor
`confirm_booking` debits a credit** — the request path books for free. **So the availability
inversion (CR-03/CR-06) is OUT OF SCOPE here.** Report it; do not attempt it. **Deleting the
furniture before the replacement can charge for a lesson would be worse than leaving it.**

## 6. OUT OF SCOPE

The availability inversion (§5) · durations and the clash-aware picker (needs `offerings.duration_minutes`
+ its D21 editor — **spec it, do not build it**) · the nav sections (`TASK-FIX3`) · Madeline's data
(§2) · anything in `TASK-FIX1`.

## 7. CONSTRAINTS

- **Worktree `wt-fix2`, branch `task/fix2`**, from `origin/main`. ⚠️ **Copy `.env.db` and `.env` in.**
- ⚠️ **`Admin.tsx`, `ContactDossierModal.tsx` and `RecordsPage.tsx` are YOURS. `AppLayout.tsx` and
  `pageRegistry.ts` are `TASK-FIX3`'s.** **If you need a nav row, report the diff and stop.**
- **Migrations:** `BEGIN; … ROLLBACK;` → apply → verify → commit.
- ⚠️ **A LIVE LEASE IS IN PRODUCTION** — do not touch `7adcd08f-fd5d-40f9-b726-634074266d7c`.
- **`test:db` red is the baseline and proves nothing.** Lint baseline **48**.
- **COMMIT AS YOU GO. DO NOT PUSH.** ⚠️ **TEARDOWN: census pasted.**

## 8. THE TEST THIS MUST PASS

1. ⚠️ Editing a session **preserves** its instructor stamp — in `BEGIN; … ROLLBACK;`, **paste the row
   before and after**. Same for `all_day`.
2. Creating a session still stamps correctly.
3. A recurring purchase places its standing slots **from every surface that can sell one**. Paste the
   bookings created.
4. **All 24 Clients-list people can open the full record surface.** Paste the count.
5. Pamela Godde and Charlotte Caddell specifically. **Name them in the proof.**
6. All 14 of AR2's capabilities still reachable. **Enumerate them.**
7. Closing the record **saves**; backdrop-click and Escape do not destroy input.
8. "People waiting" Open lands on the person — **all three of them.**
9. Order counts agree between the tab and the header.
10. `typecheck`, `typecheck:api`, lint at 48.
11. **Renders NOT VERIFIED by you** — numbered checklist for the owner.
