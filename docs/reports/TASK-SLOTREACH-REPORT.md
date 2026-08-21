# TASK-SLOTREACH — REPORT

## Can the owner sell and schedule a recurring lesson today — yes or no?

**Yes in code, and NOT YET IN PRODUCTION, because this session had no database and no browser.**

The container this task ran in has **no `.env.db` and no `.env.test`** — they are gitignored and do
not travel. So:

- **Every code change is complete and merged-ready.** Typecheck 0, api-typecheck 0, lint identical
  to main (46 problems / 0 errors before and after).
- **The database work is proven, not assumed.** I could not reach prod, but this repo ships a real
  Postgres test harness (PGlite, `test/db/harness.ts`), so the migration and the acceptance
  arithmetic were run against actual Postgres: `test/db/slotreach_standing_slot_reach.test.ts`,
  **19 tests, all passing.** That covers acceptance items 3, 5, 6 and 7 outright and the database
  half of items 1, 2 and 4.
- **What is NOT done: the migration is written and tested but NOT APPLIED to production**, and no
  browser walk was run. `supabase/migrations/20260821T1400_slotreach_the_standing_slot_is_reachable_and_a_change_is_announced.sql`
  must be applied by someone with `.env.db` before any of this is live. **Until it is applied, §2
  and §5 do nothing** — §1, §3 and §4's client-side copy work without it.

The honest one-liner: **the reach failure is fixed and the fix is tested; a human with the database
password has to run one migration to finish it.**

---

# 1. WHAT WAS ACTUALLY BROKEN

`TASK-WALK2` was right that the product is unsellable and right about the cause, and **the task
doc's §3 premise was partly stale** — which matters, because it would have led to a second
generator.

| the claim | what I measured | verdict |
|---|---|---|
| `OrderDetail.tsx:103` links to the wizard root, not the slot step | true, verbatim | **real** |
| paperwork completion short-circuits the whole wizard | true — `Onboarding.tsx`, `if (!s.needed) setStep('done')`, **plus a second one** after the last signature, **plus** the `Nothing to do here` guard | **real, and there were three of them, not one** |
| no staff screen has any alternative control | true, and structurally so: `my_standing_slots` is caller-scoped (`buyer_user_id = auth.uid()`), so **staff could not even READ a client's standing slot**, let alone set one | **real** |
| *"`generate_monthly_lessons` books one weekday while `set_recurring_days` computes several"* | **already converged.** `generate_monthly_lessons` delegates to `_generate_plan_month` (CAREPLANS m3), which loops the plural `recurring_days` and resolves a per-day time from `recurring_times`. Proven: a 2x plan lays down Tue **and** Thu, each at its own time | **STALE — no fix needed, and none written** |
| no scheduler, so prove bookings beyond month one | true (`pg_cron` absent, asserted in the test). `_ensure_plan_horizon` already materialises **on read** out to `current_date + 90`, month by month. Proven: sessions exist ≥ 2 whole months ahead, and re-reading writes nothing new | **already built — verified, not rebuilt** |
| reschedule/cancel fire zero notifications | **half true, and the half matters.** The CLIENT-initiated path (`request_booking_change` → `decide_booking_change`) always notified. The **STAFF** writers — `save_calendar_item`'s edit branch and `delete_calendar_item` — notified **nobody**, and staff is how WALK2 performed both actions | **real, now fixed** |

**So the shape of this task was not "build the standing slot". It was: make the built thing
reachable, give staff a door onto it, make a staff-side change announce itself, and stop the app
saying "booking" to people.**

---

# 2. THE REACH — answered explicitly (D17)

## §1 · The client

**Three doors, and the two permanent ones are new.**

1. **The order page** — `/account/orders/:id`. An unchosen weekly line now reads *"Select the day
   and time for your weekly Riding Lessons"* and links to **`/app/onboarding?step=slots`**.
   *(Was: `/app/onboarding`, the wizard's root — the entire bug.)*
2. **The member's own Calendar** — `/app/calendar`, **permanent, on every visit, forever.** A
   standing-time bar sits above the credits strip. It states what they hold in the barn's own words,
   opens the picker **by itself** when a slot is unchosen, and carries *"Change your day and time"*
   when one is set. **This is the answer to "not only from an order page they may never revisit."**
3. **The wizard step itself** — reached in the normal buy-then-onboard flow.

**The short-circuit is fixed at the condition, in all three places it existed:**

| where | before | after |
|---|---|---|
| mount (`Onboarding.tsx`) | `if (!s.needed) setStep('done')` | reads standing slots **at mount, unfiltered**; `?step=slots` wins outright; otherwise `!s.needed` → `slots` when a slot is unchosen, `done` when not |
| after the last signature | `setStep('done')` when the order was already paid | re-reads slots, then `slots` or `done` |
| the dead-end render | `!state.needed && !state.purchase` → *"Nothing to do here"* | `… && standing.length === 0`. **Anyone holding a weekly plan gets the wizard** — to choose the time, or to see what they hold |

⚠️ The mount read is **unfiltered by purchase** on purpose. It used to be read only when the payment
step was entered, and filtered to one order — so the single fact that decides whether to
short-circuit was unknown at the exact moment the wizard decided to short-circuit.

## §2 · Staff

**Records → a client → the Orders tab (or the Account tab) → "Their standing weekly time".**
`/app/records` carries a `pageRegistry.ts` row (`people.records`, group `accounts`) and is in the
nav, so this is reachable, not merely routed.

**It mounts in three places on the dossier** so it cannot be missed: the Orders tab (where the plan's
purchase lives), the Account tab for a contact **with** an account, and the same tab for one
**without** — a contact can hold a weekly purchase before they ever have a login.

**It renders nothing at all for a contact with no weekly plan**, so it is not noise on every record.

### Convergence with `AgreedLessonPanel`, and why it is adjacency rather than merger

The task said converge, and D18 says never build a second write path. Here is what I did and why.

- **The writer is unchanged and singular.** Staff write through **`set_my_standing_schedule`** —
  the identical RPC the member's own picker calls, which has always authorised
  `has_staff_access() OR the plan's own client`. Same function, same `set_recurring_days` +
  `_ensure_plan_horizon` pair, same materialisation. **Proven in the test: staff set Mon/Wed through
  it and the client read comes back Mon/Wed.**
- **The only new database object on this path is a READ** — `client_standing_slots(contact_id)`,
  staff-gated, the same JSON shape as `my_standing_slots`. Without it there was no staff control
  that *could* exist.
- **The UI is one component.** `StandingSlotPicker` is the picker for the client wizard, the client
  calendar and the staff dossier. `audience` changes the words and nothing else.
- **It is NOT folded into `p_agreed_lesson`, and that is deliberate, reported, not silent.**
  `provision_client_invitation(p_agreed_lesson => …)` writes **one `bookings` row** — the first
  lesson agreed on a phone call. A standing weekly slot is a different fact, in a different place
  (`purchase_items.config`), with a different lifetime (it recurs until cancelled). Routing the
  membership through the agreed lesson would **book one lesson and leave the membership with no slot
  at all** — which is very nearly the bug this task exists to fix. BUYANDBOOK's migration reached the
  same conclusion in its own header. So the two controls are **deliberately adjacent and deliberately
  distinct**, and both files now say so in their headers.
- **Not mounted on the lead drawer**, and this is a real limit rather than an oversight: a lead is a
  `requests` row with no contact and no purchase, so there is no `purchase_item` to hang a standing
  time on. The moment provisioning creates the contact and the order, the dossier control applies.
  **If the owner wants the weekly time settable in the same act as the invitation, that needs
  `provision_client_invitation` to accept the slots — named here, not built.**

---

# 3. THE TEST THIS MUST PASS — item by item

`test/db/slotreach_standing_slot_reach.test.ts` · **19 tests, 19 passing**, real Postgres.

| # | requirement | result |
|---|---|---|
| 1 | a 2x Weekly buyer picks two days and times → **two standing sessions a week** | ✅ **proven in the DB.** Tue 16:00 + Thu 17:30, every session on one of the two chosen days, each carrying **its own** time. ⚠️ **The browser half is not proven** — no browser in this container. No screenshot. |
| 2 | a signed client with an unchosen slot can still reach the picker | ✅ **code**, all three short-circuits closed (§2 above). ⚠️ **not walked in a browser.** |
| 3 | sessions exist far enough ahead that a monthly top-up would have been required, **no scheduler** | ✅ **proven.** Sessions exist ≥ 2 whole calendar months out; `pg_cron` asserted absent; re-reading is idempotent (count unchanged). |
| 4 | staff can set a client's standing slot without the client | ✅ **proven at the RPC** (staff set Mon/Wed, staff read confirms Mon/Wed; a client is refused `operator access required`). ⚠️ **the dossier UI is not walked.** |
| 5 | `remaining` 0 after purchase → 1 after cancelling one → 0 after rebooking | ✅ **proven, exactly those three numbers.** Plus a 10× cancel/rebook loop that asserts the month never inflates. |
| 6 | reschedule and cancel each fire a notification, **listed by channel** | ✅ **proven** — see the channel table below. |
| 7 | no surface this task touches says "booking" to a human | ✅ for the surfaces touched; **survey of what is left is below.** A DB assertion checks no notification title contains the word. |
| 8 | typecheck 0 · lint identical to main | ✅ `typecheck` 0, `typecheck:api` 0, lint **46 problems / 0 errors** measured **both** on a stashed tree and on the change. |

### And the whole suite, measured both ways

The `test/db` suite has a **large pre-existing failure population** in this environment, so a raw
"46 files failed" would be alarming and meaningless. Both runs, same machine, minutes apart:

| | files | tests |
|---|---|---|
| **baseline** (`git stash`, clean tree) | 46 failed · 27 passed (73) | 203 failed · 498 passed · 107 skipped (808) |
| **with this change** | 46 failed · **28** passed (74) | 203 failed · **517** passed · 107 skipped (827) |

**Identical failure counts. The delta is exactly +1 file and +19 tests, all passing — this task's
own.** `test/ui` is likewise identical: 6 failed / 11 passed, 95 tests passing, 10 errors, before and
after. **Zero regressions, and the pre-existing failures are not mine to claim credit or blame for.**

## §5 — the notification channels, named

| what happens | who is told | channel 1 — in-app | channel 2 — email | channel 3 — ops |
|---|---|---|---|---|
| **staff moves a session** (`save_calendar_item`, edit branch) | the client | ✅ **new** — `booking_rescheduled`, *"Your Riding Lesson has moved to Tuesday Sep 2 at 4:00 PM (was Aug 26)"*, links `/app/calendar` | ✅ `api/calendar-reminders.ts` selects `kind.like.booking_%` on its hourly sweep — **writing the row IS the email wiring** | — |
| **staff cancels a session** (`delete_calendar_item`) | the client | ✅ **new** — `booking_cancelled`, and when a credit came back it says so: *"— that session is back on your account, so pick a new time whenever you like."* | ✅ same sweep | — |
| **client asks** (`request_booking_change`) | staff | ✅ already worked — `booking_change_requested` | ✅ same sweep | ✅ staff dashboards |
| **staff decides** (`decide_booking_change`) | the client | ✅ already worked; **titles rewritten for D25** | ✅ same sweep | — |

⚠️ **Three honest caveats on §5.**
1. **An edit that does not MOVE the session says nothing** — a changed note, price or location is not
   news. Asserted in the test.
2. **Re-deleting an already-cancelled session says nothing** — housekeeping, not a second alarm.
   Asserted.
3. **A staff member is never notified about their own calendar entry** (`v_to <> auth.uid()`).
4. **I did not send an email.** `emailed_at` proves nothing (its only writers are crons), so the
   claim I am making is the one I can support: **the rows are written with the prefix the existing
   emailer already selects on.** Whether that Vercel cron actually runs in this deployment is
   unchanged by this task and is not something I could check from here.

---

# 4. §4 — the names (D25)

**One decision, made twice in the same words** so the two halves cannot drift:
`serviceLabel()` in `src/lib/standingSlots.ts`, and `booking_service_label(kind, offering_id)` in the
database for notification titles.

- **Riding lessons name HIGH — always.** `"Riding Lesson"` / `"Riding Lessons"`. **1x, 2x,
  evaluation, single and à la carte never reach the client.**
- **Horse care names LOW, stopping above frequency.** `"2x Weekly Turnout"` → **`"Turnout"`**. The
  frequency prefix is **stripped by pattern, not by a lookup table** — the SKU names are the owner's
  to edit (D13) and a curated table would go stale the first time he renames one. Asserted in the DB
  test for both segments.
- `serviceNoun()` carries D25's other half (turnout/training = *service*, clipping = *appointment*)
  and is available where a sentence needs the category rather than the name.

### Fixed on the surfaces this task touches

| surface | before | after |
|---|---|---|
| order line + link | *"2x Weekly Lessons"* · *"Pick your weekly time"* | *"Riding Lessons"* · *"Select the day and time for your weekly Riding Lessons"* |
| onboarding purchase card | the SKU title | the service, at the right altitude |
| calendar chip | *"Your booking"* / *"Booking"* | *"Your Riding Lesson"* / *"Your session"* / *"Reserved"* |
| calendar create button | **"+ Booking"** | *"+ Calendar item"* (staff) · *"+ Request a time"* (client) |
| calendar detail panel | *"Cancel this booking"*, *"Reschedule"*, *"This is a recurring booking"*, *"What are you booking?"*, *"staff confirm your bookings"* | *"Cancel this Riding Lesson"*, *"Reschedule your Riding Lesson"*, *"This is a weekly Riding Lesson"*, *"What is this time for?"*, *"we confirm each session"* |
| calendar item panel (staff) | tab labelled **"Booking"** | *"Session"* |
| every notification title on the four changed RPCs | *"Your booking on Aug 24 is cancelled"* | *"Your Riding Lesson on Sunday Aug 24 at 4:00 PM is cancelled"* |

### NOT swept — reported, per the task

The task said do not sweep the whole app. **What is left, so nobody has to re-find it:**

- `IntakePage.tsx` — *"Booking request"*, *"Booking requests"*, *"No booking requests in this
  status"*, *"lesson booking"*. **The largest remaining cluster, and it is client-derived: it names
  the thing a visitor submits.**
- `SelectionBar.tsx` — *"Continue to Booking Request"* (**public site**, so a visitor reads it).
- `LeadWorkDrawer.tsx` — *"Booking request"* badge.
- `CalendarSettingsPanel.tsx` — *"Hours before the booking"*.
- `SessionFields.tsx` — two helper texts, *"Recorded on the booking"* / *"the booking records
  whoever schedules it"*.
- `AdminProductsPage.tsx` — *"… and booking{s}"*.
- `Admin.tsx` — a *"Bookings"* tab label.
- `Redeem.tsx` — *"then your booking unlocks"*.
- `CalendarPage.tsx:853` — **`"Booking…"`**, left deliberately: it is the busy state of the verb
  *"Book this time"*, and the owner's own app copy uses *book* as a verb (*"you can book your
  sessions on the Calendar"*). D25 is about the noun.

**A `Booking request` is arguably its own product noun and not the internal taxonomy D25 bans — that
is an owner call, not mine, so I left it and flagged it.**

---

# 5. WHAT CHANGED

## Database — ONE migration, additive, **NOT YET APPLIED**

`supabase/migrations/20260821T1400_slotreach_the_standing_slot_is_reachable_and_a_change_is_announced.sql`

| object | what it is |
|---|---|
| `booking_service_label(kind, offering_id)` | **new.** D25's naming, in the database, for notification titles |
| `_announce_booking_change(org, user, kind, title)` | **new**, internal (service_role only). One insert into the incumbent `notifications` spine — no new table, no new channel |
| `client_standing_slots(contact_id)` | **new**, staff-gated **READ**. The thing whose absence made a staff control impossible |
| `save_calendar_item(p jsonb)` | **rewritten verbatim from `20260815T1600_booklink_b2`** + one addition: a MOVE (or a panel cancellation) announces itself |
| `delete_calendar_item(id, scope)` | **rewritten verbatim from `20260815T2500_reviewq_m4`** + the cancellation announcement, which names the credit it gave back |
| `decide_booking_change(...)` | **rewritten verbatim from `20260817T1730_careplans_m4`** — **titles only.** Authorisation, scope arithmetic and the `_refund_booking_credit` seam untouched |

⚠️ **On rewriting three existing function bodies.** I copied the current journal definitions
character-for-character and added to them; I did **not** hand-retype them. Each rewrite is the last
definition in the journal for that function (verified by grepping every migration that so much as
mentions the name). **But I could not diff against the live database**, and this repo has ~31
migrations that rewrite bodies in place, so a live body could in principle carry a patch the journal
does not. **Before applying, run the repo's own discipline: `BEGIN; … ROLLBACK;` first, and diff
`pg_get_functiondef` for those three functions against what the migration installs.** If they differ,
port the addition onto the live body rather than applying mine.

The migration parses clean (`pglast`, 18 statements) and all four plpgsql bodies parse clean, and the
whole file executes against real Postgres in the test.

## Front end

| file | change |
|---|---|
| `src/components/app/StandingSlotPicker.tsx` | **new.** The picker, extracted from the wizard, plus `StaffStandingSlotSection`. One component, four surfaces, one writer |
| `src/lib/standingSlots.ts` | `serviceLabel()` + `serviceNoun()` — D25 in one place |
| `src/lib/ops/api-calendar.ts` | `fetchClientStandingSlots()` — the staff read |
| `src/pages/app/Onboarding.tsx` | the three short-circuits; `?step=slots`; slots loaded at mount, unfiltered; the inline picker replaced by the shared one (−188 lines net of comments) |
| `src/pages/OrderDetail.tsx` | the link lands on the step; D25 on the line and the link |
| `src/pages/app/CalendarPage.tsx` | the permanent standing-time bar; D25 across the client panel |
| `src/components/app/ContactDossierModal.tsx` | the staff control, three mounts |
| `src/components/app/AgreedLessonPanel.tsx` | header: why the standing slot is beside it and not inside it |
| `src/pages/app/CalendarItemPanel.tsx` | *"Booking"* → *"Session"*; a pointer to where the standing time is actually set |
| `test/db/slotreach_standing_slot_reach.test.ts` | **new**, 19 tests |

---

# 6. WHAT I DID NOT DO, AND WHAT I FOUND

**Not done, and it is the thing standing between this and "yes":**
1. **The migration is not applied to production.** No `.env.db` in this container. Nothing in §2 or
   §5 is live until it is.
2. **No browser walk, no screenshots.** No `.env.test`, no credentials. Acceptance items 1, 2 and 4
   are proven at the database and complete in code but **have not been clicked through**.

**Found on the way, not fixed:**
- **A draft order still produces no sessions**, correctly (`_ensure_plan_horizon` returns
  `{ok:false, reason:'draft'}` — a basket is a basket), and the picker says so honestly. But
  **WALK2's Attempt 2 was a client buying 2x Weekly through the in-app catalog**, and that path
  creates a *draft*. So a catalog buyer must still declare payment before their slot materialises.
  That is D23-correct and the copy is honest about it, but **it is the remaining half of "buy it
  yourself in the browser"** and it belongs to the order-declaration flow, not here.
- **`standingSlots.ts` carries a stale comment** claiming the database has no timezone and renders
  UTC. It has had one since `20260817T1600` (`ALTER DATABASE … SET timezone TO 'America/Los_Angeles'`).
  Client-side formatting is still correct, so I left the code and am flagging the comment.
- **Changing days mid-month does not resize that month's minted budget** —
  `_mint_credits_for_purchase_item` hits `ON CONFLICT DO NOTHING` on the period unique index.
  `set_recurring_days` re-trues the current month by its own route, so this is probably fine, but it
  is the seam I would look at first if a month ever comes out short.
- **`request_booking_change` refuses a recurring reschedule across a month boundary**
  (*"no carryover to next month"*). With a 90-day horizon a client can now see sessions three months
  out and cannot move one of them into the next month. **Correct under CREDITALIGN's month rule, and
  possibly surprising to the person looking at it.** Owner call.
