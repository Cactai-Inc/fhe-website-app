# TASK-FIX2 — REPORT · the instructor stamp, the plan that placed nothing, and the reach

**Worktree** `~/Downloads/claude-code-repo/wt-fix2` · **branch** `task/fix2` · **base** `b0e677ab`
**Method** live function bodies read before every change; every migration run inside
`BEGIN; … ROLLBACK;` against **production** with the row pasted before and after, then applied,
then verified. **6 commits. Not pushed.** Nothing in production was mutated outside a rolled-back
transaction except the four function bodies listed in §8.

⚠️ **Three of the brief's factual claims did not survive measurement.** They are corrected in §1.3,
§4.1 and §7 — each with the query. The corrections changed the shape of the P0 fix.

---

## 0. WHAT SHIPPED, IN ONE TABLE

| § | Change | Where | Proven by |
|---|---|---|---|
| 1 | An edit never moves an instructor stamp, and never un-closes a day | `save_calendar_item` ×2 migrations | T1a/T1b/T1c/T2, §1.5 |
| 1 | The panel STATES the instructor on an existing session; no picker built | `CalendarItemPanel` + `calendar_free_busy` | §1.4 |
| 2 | Selling a weekly plan and placing it are one act | `AttachOfferingPanel` | T3, §2.3 |
| 2 | A weekly plan says which order it is and whether it is paid | `client_standing_slots` + `StandingSlotPicker` | §2.4 |
| 2 | A recurring line with no day is visibly marked | `ContactDossierModal` Orders | §2.5 |
| 3 | ONE record surface, reachable for all 24 | `Admin.tsx` → `ContactDossierModal` | T4/T5, §3.4 |
| 3 | All 14 provisioning + invitation capabilities carried | `ClientInvitationSection` (new) | T6, §3.3 |
| 3 | Closing the record SAVES; no Save button | `ContactDossierModal` | §3.5 |
| 4 | `?open=` lands on the person, list or no list | `Admin.tsx` | T8, §4.1 |
| 4 | Order count agrees between header and tab | `admin_client_overview` | T9, §4.2 |
| 4 | Month view shows the day's real sessions, clickably | `CalendarPage` `MonthGrid` | §4.3 |
| 4 | A week-strip session links to itself | `TrainerZones` `WeekZone` | §4.4 |
| 4 | Two retired revenue functions say so in their own bodies | `COMMENT ON FUNCTION` ×2 | §4.5 |
| 5 | The furniture regenerator: **untouched**, reported | — | §5 |

**Not built, deliberately:** the availability inversion, durations and the clash-aware picker
(specced in §6), the nav rows, Madeline's data pass.

---

## 1. ⚠️ P0 — THE INSTRUCTOR STAMP

### 1.1 The defect, reproduced

The mechanism was confirmed by running it. Inside `BEGIN … ROLLBACK` on production, signed in as
`admin@`, editing one of Claire's lessons and changing only the notes:

```
=== BEFORE (live body) ===
82797a1f-0776-4a54-aee1-f336fe6f4fdb | hello@fhequestrian.com | all_day f | notes (null)
=== AFTER (live body) ===
82797a1f-0776-4a54-aee1-f336fe6f4fdb | admin@fhequestrian.com | all_day f | notes 'typo fixed'
```

`calendar_free_busy` returned no `instructor_user_id` in any branch, so `CalendarItemPanel`
initialised its picker from `undefined`, always rendered *"You (whoever books it)"* and always sent
NULL. `save_calendar_item` did `IF v_instr IS NULL AND v_kind IN ('lesson','care') THEN v_instr :=
auth.uid()` and then `UPDATE bookings SET … instructor_user_id = v_instr` unconditionally.
`all_day` had the identical shape — `coalesce((p->>'all_day')::boolean, false)` against a payload
that never sends the key — so editing a closed day turned it back into an ordinary block.

### 1.2 The fix, and why there is no picker

Owner ruling: *"This is only one instructor, the head trainer/owner, Claire, this means we dont need
a selection method for this until we add another instructor in the future."* **No picker was built.**
The rule is:

```
instructor_user_id = coalesce( explicitly named,          -- a future picker wins
                               what is stored,            -- NEVER moved. this is the fix.
                               the acting staff member )  -- only when blank, and only on a
                                                          -- client-bound lesson/care item
all_day            = coalesce( what the payload said, what is stored )   -- on an edit
                     coalesce( what the payload said, false )            -- on a create
```

### 1.3 ⚠️ CORRECTION — the two `admin@` rows are not proof, and that changed the fix

The brief states *"45 of 47 stamps are `hello@` and 2 are `admin@` — the 2 are the damage, and they
are the proof."* The distribution is exact (measured 2026-08-31: 45 / 2 / 629 unstamped). **The
inference is not.** Both `admin@` rows:

| booking | client | session | created_at | updated_at | created as |
|---|---|---|---|---|---|
| `f7881be9…` | Audrey Slater | 2026-08-24 14:00, scheduled | `2026-08-03 21:52:21.826408-07` | `2026-08-24 23:34:46` | `available`, cron batch |
| `1807d041…` | Kit Garcin | 2026-08-25 14:00, **cancelled** | `2026-08-03 21:52:21.826408-07` | `2026-08-25 13:16:55` | `available`, cron batch |

Both were created **inside the publish cron's `2026-08-03 21:52:21` batch** — `status='available'`,
`client_id` NULL, `instructor_user_id` NULL, `created_by` NULL, alongside dozens of siblings still
sitting there as furniture today. Both were updated three weeks later, when staff opened a generated
slot and turned it into a real lesson for a named client.

**So `v_instr := auth.uid()` filled a blank on those two rows. It did not move Claire's name onto
CJ's login.** The overwrite mechanism is real — §1.1 is the proof — but **production holds no
demonstrated instance of it.** AR1 U1 said exactly this and was right to hedge: *"consistent with
this path having already fired, though it is not proof of it."* The brief hardened the hedge into a
fact; the report is the fact.

⚠️ **This is not a footnote — it changed the code.** The first migration (`20260831T0900`) moved the
whole default to CREATE, so an edit stamped nothing. But *claiming a published open slot* is an
edit, and it is how **12 of the 45 `hello@` rows and both `admin@` rows came to exist**
(`created_by IS NULL` — the cron made them, staff claimed them). Under that migration alone every
future lesson made that way would land with **no instructor at all**. Fixing a silent overwrite by
silently dropping the field is not a fix. `20260831T1100` is the corrected body.

### 1.4 What the panel does now

`calendar_free_busy`'s **staff branch** returns `instructor_user_id` (no client branch gains a key).
`CalendarItemPanel` therefore:

- on an **existing** session, prints *"Instructor · Claire — Who is delivering this. Saving this
  session does not change it."* — a statement, not a control;
- on a **new** one, keeps the picker, because there it is a create-time default and not an overwrite;
- **never sends `instructor_user_id` on an edit at all.** The DB would coalesce a NULL safely now,
  but sending the key on an edit is the shape that caused this, so it is not sent.

### 1.5 The test, pasted

All four run inside one `BEGIN … ROLLBACK` on production against the applied body.

```
=== T1a · a STAMPED lesson, edited by the other login ===
BEFORE  hello@fhequestrian.com | notes (null)
AFTER   hello@fhequestrian.com | notes 'typo fixed'        ← preserved

=== T1c · an UNSTAMPED generated slot turned into a real lesson ===
BEFORE  (none) | available | client NULL
AFTER   admin@fhequestrian.com | scheduled                 ← blank still filled

=== T1b · all_day survives an edit ===
close_day(+30) → all_day t
edit through the panel payload → all_day t | notes 'edited the reason'   ← preserved

=== T2 · CREATE still stamps the acting staff member ===
new lesson, instructor_user_id null in payload → admin@fhequestrian.com

=== T2b · an EDIT that NAMES an instructor still moves it (a future picker works) ===
explicit 'b45a5503…' → admin@fhequestrian.com
```

### 1.6 ⚠️ THE DATA REPAIR — recommended, NOT performed

**Nothing was changed.** Per the brief, this is a recommendation.

The two `admin@` rows are **not** a reversible overwrite (§1.3) — they are a first stamp, applied by
whoever was signed in as `admin@` when a generated slot was turned into a lesson. Correcting them is
therefore a *judgement about who delivered those two sessions*, not an undo.

**Recommendation: correct both to `hello@`.** The reasoning, stated so it can be refused:
Claire is the only instructor (the owner's own ruling, this task); under the shared-login reality
`admin@` is CJ's login and CJ does not teach; so a lesson recorded against `admin@` names the person
who did the data entry, not the person who taught. One of the two is already `cancelled`, so the
practical effect is one row.

```sql
-- NOT RUN. Requires the owner's word.
UPDATE bookings SET instructor_user_id = 'fdbdfe89-76d7-486b-b734-8e23b09e0353', updated_at = now()
 WHERE id IN ('f7881be9-0a32-4d78-880e-3c2f508ab0bf',   -- Audrey Slater, 2026-08-24, scheduled
              '1807d041-d52b-4f9d-b433-00fe6c46b6a3');  -- Kit Garcin,    2026-08-25, cancelled
```

**The 629 unstamped `lesson`/`care` rows are out of scope and should stay unstamped** — most are
generated furniture that was never delivered by anybody.

---

## 2. ⚠️ P0 — THE PAID PLAN THAT PLACED NOTHING

### 2.1 What is true today, measured 2026-08-31

| Order | Buyer | Plan | Status | Paid | Days chosen | Bookings |
|---|---|---|---|---|---|---|
| PUR-000330 | Evan LaBuzetta | 1x Weekly Lesson | awaiting_payment | unpaid | **no** | 1 |
| PUR-000320 | Steph | 2x Weekly Lessons | paid | **paid** | **yes** | **27** |
| **PUR-000319** | **Madeline Do** | **2x Weekly Lessons** | **paid** | **PAID $880** | **no** | **0** |
| PUR-000302 | Rachel Page | 2x Weekly Lessons | draft | unpaid | no | 0 |
| PUR-000230 | Madeline Do | 2x Weekly Lessons | awaiting_payment | unpaid | no | 4 |
| PUR-000106 | Gabriella Olenik | 1x Weekly Lesson | awaiting_payment | unpaid | no | 1 |

**The only plan that placed anything is the only one with days on it.** Unchanged from the brief.

### 2.2 The mechanism, named

`attach_offerings_to_client → _provision_purchase_for_offerings` takes **no schedule argument** and
writes **no `config`**. It writes a `purchases` row, `purchase_items` rows, mints credits and
notifies — and stops. Under **D23** the chosen days ARE the entitlement for a `recurring` SKU: a
weekly plan is a reserved time, not a credit balance. **So the sale produced an order line and no
entitlement, and it looked identical to one that had worked.**

Proven, on a throwaway contact inside `BEGIN … ROLLBACK`:

```
-- 1. sell it, exactly as AttachOfferingPanel did
attach_offerings_to_client(contact, ['2x Weekly Lessons'], paid) → purchase
-- 2. what the sale ALONE produced — this is the PUR-000319 shape
purchase_item f0d38cb8… | config {} | bookings 0
```

### 2.3 What was built — the ask, at the point of sale

`AttachOfferingPanel` now asks the question the plan exists to answer, in the same act as the sale.
When a picked offering is `config_kind = 'recurring'` it collects **one day and time per
`weekly_frequency` session**, attaches, resolves the purchase item the attach just created through
`client_standing_slots`, and calls **`setMyStandingSchedule`**.

⚠️ **It is not a second writer (D18).** `set_my_standing_schedule` is the same RPC the member's
Calendar bar, the onboarding wizard's slots step and the staff record all call. This panel holds no
scheduling arithmetic; it collects the answer and hands it to the one engine.

⚠️ **Staff can still decline to answer** — a plan awaiting a day is a real state (the client may be
picking it on the phone tomorrow). What is no longer possible is doing it **silently**: the attach
says so out loud, the order line carries a *"no day chosen yet"* mark, and the standing-slot section
re-reads and opens underneath with the question already in it.

**T3 — the same transaction, continued. THE BOOKINGS CREATED:**

```
-- 3. what the panel reads back (client_standing_slots)
   purchase_item f0d38cb8… | 2x Weekly Lessons | weekly_frequency 2 | chosen false
-- 4. and places, through the ONE writer
   set_my_standing_schedule(item, [Tue 17:00, Sat 14:00], 60)
     → {"ok": true, "minted": 26, "months": 4, "created": 26, "through": "2026-11-29"}
-- 5. THE BOOKINGS
   26 sessions | 2026-09-01 → 2026-11-28
   Tue 2026-09-01 17:00  scheduled      Sat 2026-09-05 14:00  scheduled
   Tue 2026-09-08 17:00  scheduled      Sat 2026-09-12 14:00  scheduled
   Tue 2026-09-15 17:00  scheduled      Sat 2026-09-19 14:00  scheduled
   Tue 2026-09-22 17:00  scheduled      Sat 2026-09-26 14:00  scheduled …
   config → days ["Tue","Sat"] · times {"Tue":"17:00","Sat":"14:00"} · horizon 2026-11-29
```

**Every surface that can sell a recurring plan now reaches its slot:**

| Surface | How the plan gets placed |
|---|---|
| `AttachOfferingPanel` (record → Orders) | **asks in the same act** (new) |
| `ProvisionClientForm` (offering_ids, four call sites) | plan lands unchosen; the record's standing-slot section opens on it — and that record is now reachable for all 24 (§3) |
| Member's own Calendar bar / onboarding wizard | unchanged, already worked |
| Shop checkout | unchanged; lands in the member's picker |

### 2.4 ⚠️ Madeline is shown two identical plans — fixed

`client_standing_slots` returned only the offering NAME, so Claire opening Madeline's record saw
**two rows both reading "2x Weekly Lessons · not chosen"** and no way to tell which one the $880 is
on. Placing 26 sessions against the wrong one is a value-moving mistake nobody could see coming.
The read now returns the order code, status, payment status, amount and date, and the staff picker
prints them:

```
PUR-000319 | 2x Weekly Lessons | paid             | paid   | 880.00 | chosen false
PUR-000230 | 2x Weekly Lessons | awaiting_payment | unpaid | 880.00 | chosen false
```

The member's own read (`my_standing_slots`) is a different function and is **unchanged** — a client
has one plan in front of them and does not think in order codes. The stamp renders for staff only.

### 2.5 ⚠️ EXACTLY WHAT A STAFF MEMBER DOES TO PROVISION MADELINE

**Nothing was changed on any purchase, no booking was placed, nothing was expunged.** Per the
owner's ruling, the data pass is his, with his timestamps, after this lands. This is the sentence he
asked for:

> **Records → Clients → Madeline Do → Orders (or Account) → "Their standing weekly time" → pick the
> row stamped `PUR-000319 · $880.00 · PAID` → choose two days and two times → "Set this weekly
> time".** That places the month and rolls it forward; the row stamped `PUR-000230 · unpaid` is the
> duplicate and is left alone until he decides what happens to it.

Proven against her **real paid purchase item**, inside `BEGIN … ROLLBACK`, then rolled back:

```
set_my_standing_schedule(PUR-000319's item, [Wed 16:30, Sun 10:00], 60)
  → {"ok": true, "minted": 26, "months": 4, "created": 26, "through": "2026-11-29"}
  → 26 bookings:  Wed 2026-09-02 16:30 · Sun 2026-09-06 10:00 · Wed 2026-09-09 16:30 …
ROLLBACK
```

⚠️ **The days and times above are placeholders chosen to prove the mechanism.** They are not
Madeline's. **The zero spendable credit balance is correct under D23 and is not reported as a
defect.**

⚠️ **Still no UI can void the duplicate `PUR-000230`.** That is AR2's S4 and it is not this task's.
It matters here because until it exists, Madeline's own Calendar bar continues to offer her a choice
between two identical plans.

---

## 3. THE REACH — one record surface

### 3.1 What was measured before

| | count |
|---|---|
| People on Records › Clients | **24** |
| …who could render the nine tabs | **7** (`Admin.tsx:1018` / `:1033`, gated `kind === 'account'`) |
| …who had a provisioning surface | **15** (the form closes when the invitation goes out AND again when they sign in) |
| …who could open `ContactDossierModal` | **0** — its live doors are Leads, Horses, Archived; all 24 are `contact_type='CONTACT'` |
| Behind **both** gates | **Pamela Godde, Charlotte Caddell** |

### 3.2 What was built

**The Clients list stays. The second surface goes.** A roster card opens **the record** — the same
component Records › Horses and Records › Leads open. `Admin.tsx` went **1093 → 297 lines**; it is now
a list, its filters, and one modal mount.

### 3.3 T6 — all fourteen of AR2's F5 capabilities, enumerated and located

New shared module **`src/components/app/ClientInvitationSection.tsx`** — `Admin.tsx`'s `InvitePanel`,
lifted out and re-keyed on the **contact** instead of a row of `admin_client_accounts()`.

| # | Capability | Where it lives now |
|---|---|---|
| 1 | Save-without-send (draft round-trips `categories`/`offering_ids`/`template_keys`) | `ProvisionClientForm`, mounted by `ClientInvitationSection` |
| 2 | Identity block written to the contact (`update_contact_record`, D22) | same |
| 3 | Evaluation-first lock (`lessonsLocked`) | same |
| 4 | Paperwork narrowing with a mandatory reason (NOSTRIP §2) | same |
| 5 | Payment status at point of sale | same |
| 6 | The scheduling gate (`schedulingNeeded`) | same |
| 7 | The agreed lesson in one act, named in the email | `AgreedLessonSection`, passed as `scheduling` |
| 8 | `InviteResultPanel` (claim URL when email fails) | `ProvisionClientForm` **and** `ClientInvitationSection` |
| 9 | **Resend the same link** | `ClientInvitationSection` |
| 10 | **Regenerate, behind a two-press confirm** | `ClientInvitationSection` |
| 11 | **Expire now** | `ClientInvitationSection` |
| 12 | **Delete invite** | `ClientInvitationSection` |
| 13 | **`InvitationHistoryPanel`** — every link ever issued, with its URL | `ClientInvitationSection` |
| 14 | **The invitation timeline** (`entityStatusLog('account', invite_id)`) | `ClientInvitationSection` |

**And these came across too, so the retirement is not a loss:** Bookings · Payments · Messages ·
sign-in detail (providers, last seen, email verified, created) · Posts · suspend / reinstate ·
remove / reactivate · archive · hard delete · "New contract" · the horse card in the pre-invitation
state. Bookings and Payments were `user_id`-keyed and now read `bookings.account_contact_id` /
`purchases.buyer_contact_id`, so **they exist for people with no login** — which is where Claire
most needs them.

⚠️ **One capability improved rather than moved:** `ClientInvitationSection` **derives** its state
from `adminInvitationHistory` instead of `useState(false)`. The dossier used to offer a bare
*"Send invitation"* to anyone with an email and no login — including Pamela, whose link went out
2026-08-25 — and `adminSendInvitation` defaults to `mode: 'new'`, which leaves the prior link
working. **That act minted a second live claim link with no warning.** It cannot now.

⚠️ **And one state that had NO surface at all now does:** Steph and Gabriella Olenik hold weekly
plans and have **no email on file**. The old dossier branch was
`!c.email ? "Add an email address on the Record tab first" : <ProvisionClientForm/>` — so there was
no screen on which one could be added and the invitation sent. `ProvisionClientForm` has its own
email field and already disables its own submit until it is filled, so it now renders.

### 3.4 T4 / T5 — the proof

Run as `hello@` (ADMIN) inside `BEGIN … ROLLBACK`:

```
=== T4 · every person on the Clients list can open the record ===
people_on_list | have_a_contact_id | record_opens
      24       |        24         |      24

=== T5 · Pamela Godde and Charlotte Caddell, named ===
person             | kind    | invite  | opens | documents | orders | horses | no_login
Pamela Godde       | pending | sent    |  t    |     1     |   0    |   1    |    t
Charlotte Caddell  | pending | sent    |  t    |     0     |   0    |   0    |    t
```

**Pamela's record opens with her horse (Sundance) and her document on it** — CR-31 was *"i have no
way to add a horse to pamela godde's client record."* The horse card is on the Documents section and
she can now reach it. **Her live lease `7adcd08f-…` was not read, referenced or touched.**

### 3.5 CR-75 — closing saves, and the Save button is gone

`ContactDossierModal.tsx:243` carried `onClick={onClose}` on the backdrop and `:170` closed on
Escape, and `dirty` was never committed — so the two easiest ways to leave the record were the two
ways to lose the work. There was also a *"Save changes"* button. **Both halves were backwards.**

Every exit — backdrop, Escape, the X, the footer button — now runs through `requestClose`, which
commits first. ⚠️ **If the save is refused the record stays open** with the edits still in the boxes
and the reason on screen; closing over a failed write would lose the work just as surely, only more
quietly. The footer reads *"N changes — saved when you close"* → *"Save and close"*, and there is no
separate save control. Held in a ref so the document-level Escape listener never closes over a stale
`dirty`.

`h-[85vh]` → `h-[85dvh]` (AR2 F14) — on iOS `vh` measures the chrome-less viewport, so the footer
went under the browser bar on the owner's working device.

---

## 4. THE SMALLER DEFECTS

### 4.1 ⚠️ CORRECTION — "People waiting" is two people, not three, and Rachel Engelhorn is not one

The brief: *"Rachel Page, Casey Caddell AND Rachel Engelhorn are all absent from it — the
orchestrator found a third beyond AR3's two."* Measured:

```
=== dash_people_waiting() ===                 === admin_client_accounts() ===
Rachel Page    28712509…  LEAD, 208h          Rachel Engelhorn → PRESENT (kind 'pending')
Casey Caddell  1d88cfc6…  LEAD,  59h          Rachel Page      → absent (contact_type LEAD)
(2 rows — she is not on the zone)             Casey Caddell    → absent (contact_type LEAD)
```

**Rachel Engelhorn is `contact_type='CONTACT'` with a `clients` row, so she is on the list via arm 2,
and she is not on the People-waiting zone at all.** The two who ARE on it are both `LEAD`, and
`admin_client_accounts()`'s third arm admits only `contact_type = 'CONTACT' OR NULL` — which is why
every Open link on that zone was dead.

**The fix does not touch either function.** `contact_dossier` keys on the contact and already serves
every kind (AR2 F12), so `?open=<id>` now opens the record whether or not the person is on the list:

```
person        | contact_id  | on_clients_list | record_opens
Rachel Page   | 28712509…   |       f         |      t
Casey Caddell | 1d88cfc6…   |       f         |      t
```

⚠️ **This is stronger than fixing the list**, because it is stage-independent: any inbound
`?open=<contactId>` from anywhere in the app now lands, including the two other senders AR2 named
(`DocumentQueueTable.tsx:94`, `dashboard/registry.ts:177`). The deep link is consumed **once** — a
save calls `load()`, which replaces `members`, and without the guard the record would reopen the
moment staff closed it.

### 4.2 T9 — the order count

`admin_client_overview.counts.orders` matched `buyer_user_id`, which is **NULL on all 13 live
purchases** — the staff provisioning spine writes `buyer_contact_id` only. Now
`buyer_contact_id OR buyer_user_id`, the same predicate `admin_client_accounts().order_count` and
`Admin.tsx`'s `buyerFilter()` already used.

```
                              BEFORE              AFTER
                          header | tab        header | tab
evanlabuzetta@gmail.com      0   |  2            2   |  2
madelinedo@gmail.com         0   |  2            2   |  2
(seven others)               0   |  0            0   |  0
```

### 4.3 The month view

`MonthGrid` rendered `dayItems.slice(0, 3)` in `calendar_free_busy`'s order, which is start time.
The publish cron guarantees one `available` row per business hour, so the three visible chips were
always 8:00 / 9:00 / 10:00 Open and every real lesson sat inside a **`+N more` that was not
clickable**. Now: real items take the visible ranks (`available` sorts last, chronological within
each band), **each chip is its own button** — the exact shape `WeekGrid` already uses, so a chip in
the month view opens the same panel a chip in the week view does — and the overflow line says
`+11 more open` when what is hidden is only open time.

### 4.4 The week strip

`WeekZone` wrapped the whole day card in one `Link` to `?on=<day>`, so clicking a **named session**
landed on that day's grid and left Claire to find it again. The day header keeps `?on=`; each
session is now its own link via `bookingHref` (`?item=`) — the helper its sibling `TodayZone`
already imports two lines above.

### 4.5 The two retired revenue functions (D32)

`calendar_revenue` reads **$18,320** for August where `revenue_summary` reads **$1,880** — 9.7×,
because one sums scheduled value at start time (counting every session of a monthly plan at the
plan's full price) and the other sums money received at `paid_at`. **`revenue_summary` is the single
source and the calendar ribbon and dashboard tile both already call it.** `calendar_revenue` and
`calendar_money_items` have **zero call sites** in `src/`, `api/` and `test/`.

Neither is dropped (D32). Both now carry a `COMMENT ON FUNCTION` in the database stating what they
are, what they disagree with, and that they must not be wired — so the next thread that greps
"revenue" and finds a function whose name matches the surface it is working on is told before it
reads a line. **There is no call site to put a flag on; the comment is the retirement.**

⚠️ **`calendar_money_items` also carries an unfixed D25 breach (AR1 F12) that has never been seen
because nothing renders it.** Named in the comment: if it is ever wired, fix the naming first.

---

## 5. ⚠️ THE FURNITURE — NOT TOUCHED, AND HERE IS WHY IT MUST NOT BE

**Re-verified 2026-08-31. AR1 F3 is correct and the cron is still firing:**

```
status      rows          available rows created, by hour
available    599          2026-08-31 00:00 → 12
scheduled     77          2026-08-30 05:00 → 11
cancelled      2          2026-08-29 02:00 → 12
completed      1          2026-08-28 00:00 → 12
                          2026-08-27 06:00 → 12
```

**87.7% of `bookings` is generated availability, and it grew from 587 to 599 in the day since AR1
measured it.** `vercel.json` runs `/api/calendar-reminders` at `0 * * * *` and
`api/calendar-reminders.ts:73` calls `publish_open_slots_all({p_weeks: 4, p_slot_minutes: 60})`.

⚠️ **This corrects the recorded "no Vercel cron has ever run" belief in D23 and in project memory.**
It has run daily since 2026-08-23.

⚠️ **A migration that deletes the 587 (now 599) rows without touching that call reports success and
is undone within the hour** — `ORCHESTRATOR.md` §3 exactly.

⚠️ **AND THE REPLACEMENT IS NOT READY.** Neither `request_open_time` nor `confirm_booking` debits a
`lesson_credits` row; only `book_open_slot` does, and `book_open_slot` can only claim a pre-existing
generated row. **So the request path books for free**, and deleting the furniture before the
replacement can charge for a lesson would be worse than leaving it. **The availability inversion
(CR-03 / CR-06) is out of scope here, reported, not attempted.**

---

## 6. SPECS FOR WORK NOT DONE

### 6.1 Duration + the clash-aware picker (CR-07) — **specced, not built**

**The gap.** There is no session duration anywhere. `offerings` has `weekly_frequency` and
`unit_count` but no `duration_minutes`; the panel derives a length from the two datetime boxes;
`set_my_standing_schedule` takes `p_duration_minutes` and every caller passes the literal `60`;
`api/calendar-reminders.ts` passes `p_slot_minutes: 60`. **Sixty minutes is asserted in four places
and configurable in none.**

**The build, in order — and it is three landings, not one:**

1. **`offerings.duration_minutes int`**, nullable, default NULL meaning "not a timed offering".
   Backfill 60 for every `config_kind IN ('scheduled','recurring')` SKU **as a data act with the
   owner watching**, because it is a claim about each product.
2. ⚠️ **Its D21 editor, in the same landing.** *"An algorithm is configuration, not code. It ships
   with an editor."* The catalog admin (`/app/ops/admin/products`) gets a minutes field per offering.
   **A migration that adds the column and leaves no editor is the pattern D21 exists to stop.**
3. **Readers switch off the literal**, one at a time, each proven: `StandingSlotPicker`'s
   `open.duration_minutes || 60` → the offering's; `AttachOfferingPanel`'s `slot.duration_minutes ||
   60` → the same; `CalendarItemPanel` pre-fills the end box from the picked offering.
4. **Only then CR-07, the clash-aware picker.** It needs a length to test overlap with, so it is
   blocked on 1–3. `horse_time_conflict` is the existing shape to copy for the instructor/room
   dimension; it must ask `business_hours` about closed days and must exclude the item being edited
   (`v_row.id`, `v_row.series_id`) exactly as `horse_time_conflict` already does.

⚠️ **It must not run concurrently with the CR-82 horizon/proration work** — both land on
`StandingSlotPicker` and `_ensure_plan_horizon`.

### 6.2 Flagged, not fixed

- **S1 — no UI can void an order line.** Madeline's duplicate unpaid `PUR-000230` cannot be retired
  from any surface, and until it is she is shown two identical plans on her own Calendar bar. AR2's
  S4; still unrouted.
- **S2 — `bookings.purchase_id` is NULL on 9 of Madeline's 13 sessions.** A lesson that cannot be
  traced to what paid for it. AR1's territory.
- **S3 — a weekly plan cannot be PAUSED.** The picker cancels or changes; there is no "skip a month,
  my rider is injured". Owner question.
- **S4 — the barn has no timezone column.** 26 assertions of `America/Los_Angeles` in the repo and
  **5 more in Supabase-side `pg_db_role_setting` that no migration sets and nobody reading the code
  can see.** `WeekGrid` places items with the *viewer's* local hours against business hours that are
  naked Pacific `time` values. In Los Angeles they agree; anywhere else sessions fall outside the
  drawn band with no error.
- **S5 — `_publish_open_slots_for_org` never retires a past slot.** 266 of the 587 AR1 counted were
  already in the past and will sit there forever under D32. The table grows ~84 rows a week whether
  or not anyone books anything.
- **S6 — the Calendar has no `pageRegistry` row**, so it is the only nav destination a tenant cannot
  show or hide from Page visibility (D13 hole). `pageRegistry.ts` and `AppLayout.tsx` are
  **`TASK-FIX3`'s files** and were not touched. **No nav row was needed or added by this task.**

---

## 7. ⚠️ WHERE THE BRIEF WAS WRONG

Three, each with the query in the section named. Recording them because the next thread will read
this file as its specification.

1. **§1.3 — *"the 2 are the damage, and they are the proof."*** They are not proof. Both `admin@`
   rows were created as unstamped cron furniture and claimed later; the line filled a blank rather
   than moving Claire's name. The mechanism is proven by reproduction, not by those rows. **This
   changed the code** — the first migration had to be superseded.
2. **§4.1 — *"Rachel Page, Casey Caddell AND Rachel Engelhorn are all absent from it."*** Rachel
   Engelhorn is present on `admin_client_accounts()` (arm 2, `kind='pending'`) and is not on the
   People-waiting zone at all. The zone has two rows today, both `LEAD`.
3. **`test:db` red is the baseline and proves nothing** — confirmed: **51 files red**, identical to
   AR2's measurement on `main`. §8 records the UI-test baseline too, which the brief did not mention
   and which **does** discriminate.

---

## 8. VERIFICATION

| Check | Result |
|---|---|
| `npm run typecheck` | **clean** |
| `npm run typecheck:api` | **clean** |
| `npm run lint` | **46 warnings, 0 errors** (baseline 48 — two fewer, both from the retired `Admin.tsx` bodies) |
| `npm run build` | **succeeds**, prerender included |
| `npm run test:db` | **51 files red** — unchanged from the `main` baseline, proves nothing either way |
| `npx vitest run test/ui` | ⚠️ **identical to `main`, file for file** — see below |

The UI suite **does** discriminate, so it was baselined properly against a clean `origin/main`
checkout with the same `.env`:

```
main      4 files failing: dealauto_delivery_recipient_scope(5) · adminsweep_instructor_preview(1)
                           · pluspass_create_controls(3) · wallreturn_onboarding(2)   = 11 tests
task/fix2 4 files failing: dealauto_delivery_recipient_scope(5) · adminsweep_instructor_preview(1)
                           · pluspass_create_controls(3) · wallreturn_onboarding(2)   = 11 tests
```

**Same files, same tests, same counts. No regression.** (`pluspass_create_controls` fails on a
missing *"+ Booking"* button and a *"Create"* heading — neither is anything this task touched.)

### Migrations applied to production

| File | What | ACL after |
|---|---|---|
| `20260831T0900_an_edit_never_reassigns_the_instructor.sql` | `save_calendar_item` — first pass | preserved |
| `20260831T0930_one_number_for_a_persons_orders.sql` | `admin_client_overview` · `calendar_free_busy` · 2 `COMMENT ON` | preserved |
| `20260831T1000_a_weekly_plan_names_the_order_it_belongs_to.sql` | `client_standing_slots` | preserved |
| `20260831T1100_a_blank_instructor_is_still_filled_on_an_edit.sql` | `save_calendar_item` — **supersedes T0900**, §1.3 | preserved |

All four are `CREATE OR REPLACE`, so no function ACL was reset. Verified after each apply — the
`DROP + CREATE` trap from TASK-ORIGIN was not hit.

### Commits (6, not pushed)

```
04b5c5f4  §1  a blank instructor is still filled on an edit — corrected by the production data
e3d0aab6      the provisioning form renders without an email and says why
1263e534  §2  selling a weekly plan and placing it are one act, and the plan says which order it is
4cd8d7e7  §3  one record surface, reachable at every stage of a person's life
cef28f28  §4  the month view shows the day's real sessions, and a week-strip session links to itself
18dc74be  §4  one number for a person's orders, the instructor stamp is readable, two retired fns say so
72764a94  §1  an edit never reassigns the instructor, and never un-closes a day
```

---

## 9. ⚠️ RENDERS — NOT VERIFIED BY ME. THE OWNER'S CHECKLIST

**No browser was opened and no dev server was started.** Everything above is proven at the database
or by the compiler. These are the twelve things only a person looking at the screen can confirm.

1. **Records → Clients.** The grid of cards is unchanged. Click any card — **a record opens as a
   modal over the list**, not a full-page isolated view. Click three or four different people,
   including someone with no login. *(§3.2)*
2. **Pamela Godde.** Open her. She has an invitation that went out on 2026-08-25 — the Account tab
   should say **"Their link works until …"** with **Resend the same link** leading, and a
   **Regenerate** that asks twice. It must **not** say a bare "Send invitation". *(§3.3)*
3. **Pamela's horse.** Documents tab → the horse card lists **Sundance**, with **Add a horse**.
   *(CR-31)*
4. **Charlotte Caddell.** Open her. Every tab renders; the ones with no data say so rather than
   being absent. *(§3.4)*
5. **Type into a field and click the grey backdrop.** Reopen the person. **The value is there.**
   Repeat with **Escape**. **There must be no "Save changes" button** — the footer says
   *"N changes — saved when you close"* and *"Save and close"*. *(§3.5)*
6. **Madeline Do → Orders.** Two `2x Weekly Lessons` lines. The paid one should carry a gold
   **"no day chosen yet"** mark, and the standing-slot section below should print
   **`PUR-000319 · $880.00 · PAID`** on one row and **`PUR-000230 · unpaid`** on the other. **Do not
   set anything yet** — that is your pass with your own timestamps. *(§2.4, §2.5)*
7. **Add offerings → tick `2x Weekly Lessons`** on a test contact. Two **day + time** rows should
   appear inside the panel with the sentence *"held every week from now on"* once both are filled.
   Attach, and the sessions should be on the calendar immediately. *(§2.3)*
8. **Attach a recurring plan and leave the days blank.** It should attach, say which plan has no
   time yet, and the standing-slot section below should open on that question. *(§2.3)*
9. **Calendar → Month.** A day with real lessons should show **the lessons**, not three "Open"
   chips. **Click a lesson chip** — the panel opens. *(§4.3)*
10. **Open any existing session.** Where the Instructor dropdown was, there should be a **line of
    text** naming who is delivering it, and *"Saving this session does not change it."* Change the
    notes, submit, reopen: **the name has not moved.** *(§1.4)*
11. **Dashboard → "People waiting on a reply" → Open** on Rachel Page and on Casey Caddell.
    Both should land on that person's record. *(§4.1)*
12. **Dashboard → "This week".** Click a named session inside a day card — it should open **that
    session** on the calendar, not just that day. The weekday name at the top of the card still opens
    the day. *(§4.4)*

---

## 10. TEARDOWN

- Every `psql` invocation was a one-shot heredoc that exited on completion. **No session left open,
  no dev server started, no watcher, no browser harness.**
- Every migration was proven inside `BEGIN; … ROLLBACK;` before being applied, and re-verified from
  the live body afterwards. Every data experiment — the throwaway contact, Madeline's real paid
  item, the closed day, the claimed open slot — was **rolled back**. **No production row was
  mutated by this task.**
- The temporary `origin/main` worktree created to baseline the UI suite was **removed** and
  `git worktree prune` run.
- ⚠️ **Pamela Godde's lease `7adcd08f-fd5d-40f9-b726-634074266d7c` was not read, referenced or
  touched.** Her contact record was read; her document was not.

**Process census, after the work:**

```
$ ps -Ao pid,stat,etime,command | grep -Ei "psql|vite|node .*dev|nodemon|esbuild|chromium|playwright" | grep -v grep
15964 SN  15:15  npm exec vite --config test/browser/vite.config.ts --port 5199 --strictPort
15980 SN  15:15  node /…/wt-fix1/node_modules/.bin/vite --config test/browser/vite.config.ts --port 5199 --strictPort
15981 SN  15:15  /…/fhe-website-app/node_modules/@esbuild/darwin-arm64/bin/esbuild --service=0.21.5 --ping
```

⚠️ **All three belong to `wt-fix1`, not to this thread** — `TASK-FIX1`'s browser harness on port
5199, running concurrently. **This task started no process that outlives it and killed none of
theirs.** Nothing of mine is in this list; reported rather than cleaned, because cleaning another
thread's harness mid-run is how a concurrent build loses its evidence.

**Worktree** `/Users/cactai/Downloads/claude-code-repo/wt-fix2` · **branch** `task/fix2` ·
**6 commits. NOT PUSHED.**
