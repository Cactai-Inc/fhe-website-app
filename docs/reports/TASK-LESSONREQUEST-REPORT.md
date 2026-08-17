# TASK-LESSONREQUEST — report

**Branch `task/lessonrequest`, off `origin/main` = `d64b742`. Committed, NOT pushed.**
Built 2026-08-17, Opus 5, thinking on, high effort. One thread, no subagents.

- **Typecheck** (app + api): clean. **Build:** clean. **Lint:** 0 errors, 46 warnings —
  `main`'s 40 plus **6 new, all `react-refresh/only-export-components`**, the pre-existing
  pattern ~30 files in this repo already carry. They are on the three new/changed files that
  export a helper beside a component **so the helper can be unit-tested** — which is what
  §L3's range checking needed.
- **`src/` unit tests: 127 passing** (96 before, **31 new**, all for the availability round trip).
- **`test/db` (PGlite): `46 failed | 25 passed (71)`, `203 failed | 453 passed | 107 skipped (763)`** —
  **byte-identical to the documented baseline** (ASKRIGHT and CAREPATH both record the same
  numbers). Four migrations landed and the number did not move.
- **Four migrations**, each dry-run inside `BEGIN … ROLLBACK` **with the rollback proven by
  query**, then applied to prod, then re-verified. No `BEGIN`/`COMMIT` inside any file.

`CAREPATH` had merged (`1de6599`), so §C5b's order model and §C8's one act were both live to
build on, exactly as this task's header requires.

---

## 0. THE OWNER QUESTIONS — asked before building §L3, as instructed

| # | question | answer | what it changed |
|---|---|---|---|
| 1 | Does the client get anything in writing confirming the agreed slot? | **"One message, one link, and the agreed date and time in writing at the top. A second email is a second thing that can fail independently."** | **No confirmation email was built.** The invitation that already sends in the same act names the slot in its first paragraph. One template, one send, one failure surface. |
| 2 | Is the agreed lesson confirmed when staff set it, or held until the order is paid? | **"The phone call is the agreement — that's the whole design… Unpaid-ness already lives on the order, which is exactly where §C5b put it."** | ⚠️ **This overrides §L3's own text.** The booking lands **`scheduled`**, not `pending`. See §2 — it means **no new booking status became reachable and no client-facing status sweep was needed.** |

---

## 1. Verification of the doc's own measurements

Everything was re-checked against live code and the live database before being built on. **The
doc's table was right about every row**, and understated one thing.

| doc says | verified? | what is actually true |
|---|---|---|
| Step 2 EXISTS — `Checkout.tsx` collects name/email/phone/method/experience/notes/`proposed_times` | ✅ | It is `InquiryForm.tsx` now (CAREPATH extracted it), rendered by `/checkout`. All of it is there. |
| Step 3 EXISTS — `submitRequest` writes a `requests` row carrying `proposed_times` | ✅ | And CAREPATH §C5 added the draft order beside it. |
| **Step 4 is THE BREAK** | ⚠️ **worse than described** | The doc says *"nothing takes the offered availability and turns it into a real booking."* In fact **a lesson-booking path existed in the lead drawer all along** — `ScheduleSessionForm` → `schedule_lesson_session` — but it is gated on `status === 'invited' \|\| 'converted'`, i.e. **it only appears AFTER the invitation has already gone out.** So the break is not "no booking path"; it is **"the booking path is on the wrong side of the invitation"**, which is why the invitation email could never name the time. §2 below. |
| Step 5 activation link EXISTS | ✅ | Untouched. |
| Step 6 onboarding ends at payment (ONBOARD) | ✅ | Untouched. §5. |
| Step 7 app + overview modal (ONBOARD) | ✅ | Untouched. §5. |
| `provision_client_invitation` takes `p_request_id` | ✅ | It is the seam this task turned on, exactly as predicted. |
| §L2: the ranges are weeks/days/AM-PM, never a slot | ✅ | Confirmed in code **and in prod**: **6 of 6** live lesson requests carry ranges, in the `{date,end,label,days,time}` shape. |
| §L2: use `proposed_times`, do not add another column | ✅ | **No column was added and none was written to.** §3. |
| §L2: the act word is "inquire" | ✅ | `inquiryLabel()` already says *"Inquire about booking"* (ASKRIGHT §A6). Not touched. |
| §L2: confirm a person will be in touch, imply no hold | ✅ | `/confirmation` already reads *"Nothing is scheduled yet; we will agree the timing together."* Not touched. |
| §L1: a signed-in member must not be re-asked | ✅ | `Checkout.tsx` branches on `user` — a member gets the purchase panel, never the form. Not touched. |

---

## 2. What was built

### L1 — step 2 stops being optional on the lesson path

**The fields existed. The obligation did not.** `intake_requirements` shipped with
`availability` **and** `experience` set to **NOT required**, so a signed-out lesson buyer could
send an inquiry that told staff nothing about when they can ride — the one fact the phone call
is for. That is not a rendering gap; it is the feature being switched off in data.

**Two halves, deliberately different in kind:**

1. **DATA — both flags flip to required.** They stay owner-editable in
   Ops → Intake → *"Booking form — required fields"* (D13). Both are gated client-side on
   `showLessonFields`, so **a horse-care buyer is untouched by either**: this is a lesson-path
   obligation expressed through a channel-wide flag, not a new obligation on every booking.
2. **CODE — the availability half is ALSO enforced server-side**, inside `submit_public_request`.
   A client-side gate is what the visitor sees; it is not what the record guarantees. **It runs
   before anything is written**, so a refused inquiry leaves no request, no lead and no order
   behind.

The lesson test is **`offerings.segment = 'rider'`** — the catalog's own field, matching the
frontend's `LESSON_SERVICE_TYPES` exactly today, and covering a **new** lesson SKU under a new
service type on the day it is created rather than after a code change.

⚠️ **Riding experience is NOT enforced server-side, and that is named rather than faked.** It
travelled only as prose inside `requests.notes` (`"Riding experience: 1–2 years"`), and a gate
built on a regex over free text fails open the first time the wording changes. **It is now
also written into `requests.details`** by the form — the same deliberate duplication the page-2
answers already carry — so the guard can be widened honestly once live rows have it. §4, G2.

### L2 — nothing needed building, and one thing needed reading

The submission already carried the ranges, already said "inquire", and already promised a
person rather than a slot. What §L3 needed was the **inverse**: reading `proposed_times` back
so staff can see the ranges beside the picker.

**`parseProposedTimes()` parses the prose, and no second representation was created.** `days`
and `time` are written by `daysSummary()` / `timePreferenceSummary()` in the same file — a
closed vocabulary this codebase owns both ends of, not free text — so this is a round trip, not
a guess. **The alternative (writing structured copies of the same facts into the same jsonb)
creates two representations that can disagree**, and the 6 live production rows would only ever
have had the prose anyway.

That is only safe if it is exactly inverse, so **the tests assert it exhaustively**: all 16
time-preference combinations, every day case, multi-week selections, the legacy `{date,time}`
shape, empty input, and **a row copied verbatim out of production**. 31 tests.

### L3 — THE MISSING PIECE: the agreed time and the link are one act

**`provision_client_invitation` gained one parameter, `p_agreed_lesson jsonb`.** When it is
set, the same call that already confirmed the order and promoted the lead **also books the
lesson**, and then sends the invitation. Set it to null and the function does exactly what it
did yesterday.

⚠️ **NOTHING HERE IS A SECOND BOOKING WRITER.** `schedule_lesson_session` is the incumbent staff
lesson writer and remains the only one this path uses. What it gained is **BOOKLINK's
accounting** — see below. There is no new `INSERT INTO bookings` anywhere in this diff.

⚠️ **AND THERE IS NO APPROVE BUTTON, because there is nothing to approve.** The panel is headed
*"Set the time you agreed on the call"*. The ranges sit **beside** the picker, and a choice
outside them is named in words — *"They did not offer Tue — they said Mon, Wed"* — **as a
warning that never blocks.** The phone call decides, and someone may perfectly well have agreed
to a time they never listed.

⚠️ **`proposed_times` is never read for the booking, never copied, and never overwritten.** What
was WANTED lives on the request; what was AGREED lives on the booking. Both are readable
afterwards — proven in §3, test 7.

**One parameter, not seven.** A new parameter forces `DROP` + `CREATE` (PostgREST resolves RPCs
by argument *name*, so an overload is ambiguous for every existing caller — ONBOARD hit this
exact wall adding `p_phone`). A single jsonb means **this is the last time that signature has
to change**; `save_calendar_item(p jsonb)` is the same decision for the same reason. **And the
trap that comes with a DROP was handled: `REVOKE … FROM PUBLIC, anon` by name**, because this
database's `ALTER DEFAULT PRIVILEGES` hands `anon` a *direct* grant that a PUBLIC revoke does
not remove. Proven both ways in §3.

**`schedule_lesson_session` learned to debit — and this was not optional.** It resolved its
purchase with the pre-BOOKLINK `_unambiguous_purchase_for_client` and **debited nothing**.
Survivable while it only ever ran after provisioning; **not survivable now**, because
confirming the enquiry order (`draft → awaiting_payment`) is the transition
`trg_mint_credits_when_order_opens` watches, so **the credit for that lesson already exists by
the time the booking is made** (CAREPATH F3 flagged this minting moment). Without a debit the
client would end up holding a booked lesson **and** an unspent credit for the same purchase —
the double-count `CREDITALIGN` was reverted three times over. It now goes through
`_debit_or_create_for_booking`, BOOKLINK's writer, unchanged, and populates `bookings.credit_id`.

⚠️ **The no-service case is byte-identical to before.** With no offering named,
`_debit_or_create_for_booking` returns immediately with whatever purchase it was handed, and
the `coalesce` falls through to the same `_unambiguous_purchase_for_client` call this function
has always made. Behaviour changes **only** when staff name a service — which is precisely the
case BOOKWRITE added and BOOKLINK made accounting-correct everywhere else.

**The status, and why it is not `pending`.** §L3 asked for `pending`, becoming confirmed on
approval. **The owner overrode that** (§0, question 2). It lands `scheduled`, like every other
staff-made booking — REVIEWQ left staff-made bookings alone deliberately, and `pending` means
*"waiting on the company to decide"*, which is false here: **the company decided on the phone.**
`pending_payment` was considered and refused for the reason the owner gave — Zelle and cash take
days to reconcile, and a client who has genuinely paid would watch their lesson sit unconfirmed.
**Consequence: no new booking status became reachable, so no client-facing status sweep was
needed.** The exact transition is: *nothing → `scheduled`, once, in the one act.*

**The email names it, at the top.** `MSG.AGREED_TIME` is a new token on the existing `INVITATION`
template (v1 → v2), prepended inside `{{#if}}` so **every invitation without a lesson is
unchanged**. It is **owner-editable in the Templates editor** (D13) — wording, placement, or
deletion, no deploy.

⚠️ **The time is formatted in the BROWSER, not the server, and that is not cosmetic.** §5, F2.

**Where the fields came from.** `SessionFields` was **extracted** from `ScheduleSessionForm`,
not copied beside it. Two surfaces now ask for the same eight facts about one lesson with
different frames (the ops modal has a client picker and a submit; the agreed-time panel has
neither, because the act creates the client and the invitation's button is the submit).
`ScheduleSessionForm`'s props and submitted shape are unchanged, so **both existing callers are
untouched**.

### L4 — verified end to end, and one gap closed rather than reported

§L4 says report breaks rather than patch around them. **One break is created by §L3 itself, so
it is closed here, not reported.**

The booking is made at the moment staff agree it — **before the client has clicked anything**.
At that instant there is no `auth.users` row, so `schedule_lesson_session`'s
`SELECT p.user_id … WHERE p.contact_id = v_contact` correctly finds nothing and the booking
lands with **`account_user_id` NULL**. Nothing anywhere filled it in later:
`promote_contact_to_account` re-anchors documents, parties and signatures, but **never bookings**.

**What that costs, precisely.** The member's own calendar and My Lessons both read
`client_id = current_client_id()`, so **the lesson is visible either way** (checked in
`calendar_free_busy` and `my_lesson_sessions`, and proven in §3). What breaks is **notification**:
`confirm_booking`, `decide_booking_change`, `cancel_lesson_session`, `propose_booking_time` and
`apply_booking_fee` all address the member through `account_user_id`, each written as
`IF … IS NOT NULL THEN notify`. **A staff reschedule or cancellation of the client's very first
lesson would have silently reached nobody** — the one lesson they most need telling about.

**A trigger on the link, not an edit to the promotion spine.** `promote_contact_to_account` is
the sole writer of `profiles.contact_id` and carries a structural denylist; reissuing 200 lines
of it to add one `UPDATE` is a far larger risk, and would cover only that one path. A trigger
on `profiles (AFTER INSERT OR UPDATE OF contact_id)` covers **every** way a profile ever comes
to point at a contact. It **fills a blank and never overwrites**, so it can never move somebody
else's booking onto a new account. **No backfill statement**: prod holds 5 bookings with an
`account_contact_id` and **zero** of them are missing a linkable user id.

---

## 3. THE TEST THIS MUST PASS — evidence

Every DB claim is query output from this session, run against **the live functions after they
were applied**, inside `BEGIN … ROLLBACK`. **Every render claim is marked NOT VERIFIED** and
appears in §6's click-through instead.

| # | claim | status | evidence |
|---|---|---|---|
| 1 | A signed-out lesson buyer cannot reach step 3 without step 2 | ✅ **proven server-side** | Test 1 below — refused by the RPC, not merely by the form. Plus a horse-care control that must still be accepted. |
| 2 | Submitting creates a `requests` row carrying the ranges; the visitor is told a person will be in touch, not that they are booked | ✅ **(DB half)** | Test 2 below. The wording is CAREPATH's, unchanged and re-read: *"Nothing is scheduled yet; we will agree the timing together."* Render §6.1. |
| 3 | Staff see the request in full and set an agreed time | ⚠️ **half by design** | **"Approve the wanted slot" was NOT built — §L3 forbids it in terms** (*"Do not build an approve-this-slot button; there is no slot to approve"*). Staff **set** an agreed time, with the ranges beside it and out-of-range called out. Render §6.2–6.4. |
| 4 | Approval produces a real booking linked to the client, through the existing writers — prove which ran | ✅ | Test 4 below, incl. the returned payload naming the booking, and 4b proving the credit was consumed. Functions that ran: `provision_client_invitation` → `schedule_lesson_session` → `_debit_or_create_for_booking`. |
| 5 | The activation link issues from the same request via `provision_client_invitation` | ✅ | Test 5 below — one request, one order, one booking, one invitation. |
| 6 | End to end reaches payment, then the app with the modal, purchase and upcoming lesson | ⚠️ **DB half proven, render NOT VERIFIED** | Test 6 below proves the member's own `my_lesson_sessions` returns the lesson as `SCHEDULED` after activation. The screens are ONBOARD's and were not opened. §6.6–6.8. |
| 7 | What was wanted and what was agreed are both readable afterwards | ✅ | Test 7 below — side by side, from one query. |
| 8 | Every DB claim is query output; render claims marked NOT VERIFIED with a checklist | ✅ | This section and §6. |

### Test 1 — the gate, and its control

```
t1_lesson_no_availability            | REFUSED: please tell us when you are available
                                     |          before sending a lesson inquiry
t1_control_horsecare_no_availability | ACCEPTED (correct) request c6eb4f90-…
```

The refusal comes from `submit_public_request` itself, called **as `anon`**. A horse-care buyer
with no availability is still accepted — the gate is lesson-path only.

### Test 2 — the inquiry, its ranges, and its DRAFT order

```
 status | category | channel | ranges |         week          |   days   |    times     | lead_type
--------+----------+---------+--------+-----------------------+----------+--------------+-----------
 new    | lessons  | booking |      1 | Aug 23 – Aug 29, 2026 | Mon, Wed | Weekdays PM  | LEAD

 display_code | status | payment_status | amount | current_status | no_account_yet
--------------+--------+----------------+--------+----------------+----------------
 PUR-000200   | draft  | unpaid         | 150.00 | enquiry        | t
```

### Test 4 — the ONE ACT, and what it returned

```
{
    "amount": 150.00,
    "labels": ["Single Lesson"],
    "client_id": "66612d11-…",
    "categories": ["RIDER"],
    "contact_id": "36a14025-…",
    "request_id": "75468f1a-…",
    "purchase_id": "7886a6a5-…",
    "agreed_lesson": {
        "ends_at":    "2026-08-27T00:00:00+00:00",
        "credit_id":  "6d2c47e7-…",
        "starts_at":  "2026-08-26T23:00:00+00:00",
        "booking_id": "60f8fe36-…",
        "offering_id": "1eb2202d-…"
    },
    "invitation_id": "ca598336-…",
    "confirmed_orders": ["7886a6a5-…"]
}
```

```
  status   |  kind  |    agreed_local     | linked_client | linked_request | linked_order | debited_a_credit |    service
-----------+--------+---------------------+---------------+----------------+--------------+------------------+---------------
 scheduled | lesson | Wed Aug 26 04:00 PM | t             | t              | t            | t                | Single Lesson
```

### Test 4b — the credit minted by confirmation was CONSUMED, not left beside the booking

```
  package_key  | credits_total | credits_remaining
---------------+---------------+-------------------
 Single Lesson |             1 |                 0
```

**This is the test that would have failed without the `_debit_or_create_for_booking` change** —
the client would have held a booked lesson and a spare credit for the same $150.

### Test 5 — one inquiry, one of everything

```
 display_code |      status      | current_status
--------------+------------------+----------------
 PUR-000200   | awaiting_payment | submitted

 contact_type | request_status | invitations | orders | bookings
--------------+----------------+-------------+--------+----------
 CONTACT      | invited        |           1 |      1 |        1
```

The order's own timeline:

```
   status    |                                      detail
-------------+-----------------------------------------------------------------------------------
 time_agreed | The first lesson was booked in the same act — see the calendar entry for the slot
 submitted   | Confirmed with the client — the invitation to activate was sent in the same act
 enquiry     | Opened by a website inquiry — nothing is owed until it is confirmed
```

### Test 6 — §L4: the booking finds its account, and the member can see it

```
before activation:  account_user_id IS NULL = t   knows_the_person = t
-- an auth user appears and a profile points at the contact (i.e. they activate)
after  activation:  claimed_after_activation = t  still_theirs = t

-- read AS THAT MEMBER (my_lesson_sessions, their own RPC):
 lessons_visible_to_the_member |   badge
-------------------------------+-----------
                             1 | SCHEDULED
```

### Test 7 — the ask and the agreement, side by side, afterwards

```
      wanted_week      | wanted_days | wanted_times |     agreed_slot
-----------------------+-------------+--------------+----------------------
 Aug 23 – Aug 29, 2026 | Mon, Wed    | Weekdays PM  | Wed Aug 26, 04:00 PM
```

### The security boundary, both halves

```
                proname          | anon | auth | svc | proacl
---------------------------------+------+------+-----+------------------------------------------------
 provision_client_invitation     | f    | t    | t   | {postgres=X,authenticated=X,service_role=X}
 schedule_lesson_session         | f    | t    | t   | {postgres=X,authenticated=X,service_role=X}
 bookings_claim_on_account_link  | f    | f    | f   | (trigger only)
 overloads: provision_client_invitation = 1,  schedule_lesson_session = 1
```

```
-- the trigger function is not reachable even before the revoke:
SET LOCAL ROLE anon; SELECT bookings_claim_on_account_link();
ERROR:  trigger functions can only be called as triggers
```

### The rollback, proven

Run after every dry-run **and** after the final live probe:

```
 probe_requests | probe_contacts | probe_bookings | probe_users | vocab_leaked | trigger_fn_leaked
----------------+----------------+----------------+-------------+--------------+-------------------
              0 |              0 |              0 |           0 |            0 |                 0
```

---

## 4. GAPS — what this task did NOT deliver, and why

### ⚠️ G1 — no live email was sent from this thread

The token, the template block, the `{{#if}}` guard and the endpoint wiring are applied and
version-bumped (`INVITATION` v1 → v2). **What is not proven is a real send**, because doing so
means mailing a real address from a build thread. What IS proven: the endpoint names
`MSG.AGREED_TIME` **only when the RPC reported it actually booked something** — the caller's
display string alone is never enough to make that claim — and the drawer's success panel reads
the same returned fact, so **there is no path where a screen or an email claims a lesson the
act did not book.** §6.5 is the owner's live check, and it is the one I would run first.

### ⚠️ G2 — riding experience is required client-side only

The flag is flipped and the form enforces it; the **server** does not, because the value lives
in prose. It is now also written to `requests.details`, so the guard can be widened once live
rows carry it — **but that is a follow-up, not something this task shipped.** Availability, the
half that matters most to §L3, **is** enforced server-side.

### ⚠️ G3 — a mixed cart containing one lesson must now supply availability

ASKRIGHT §A0's union rule is unchanged: a cart with a lesson in it shows the lesson fields. Now
that availability is required, **a horse-care buyer who adds a single lesson must give ranges to
submit.** That is consistent with the rule and with the form they already saw, but it is a real
behaviour change for mixed carts and is named rather than discovered later. Untick *Availability*
in Ops → Intake to reverse it.

### ⚠️ G4 — the agreed-time panel is on the LEAD path only

`ProvisionClientForm` is also rendered by the new-client page, the client-detail page and the
dossier modal. **None of them pass `agreedLesson`**, so all three behave exactly as before —
correctly, because there is no inquiry behind them and therefore **no ranges to show beside a
picker.** A staff member creating a client from scratch still books the lesson afterwards
through the existing `ScheduleSessionForm`. Deliberate, not an oversight.

### ⚠️ G5 — the render is NOT VERIFIED

No browser was opened. §6.

---

## 5. Findings — things that were not what the docs said

### ⚠️ F1 — **THERE IS NO TENANT TIMEZONE ANYWHERE IN THIS DATABASE, and clients are being told the wrong times**

**The sharpest thing this task found, and it is pre-existing, live, and client-facing.**

No table carries a timezone column — checked across `information_schema` for every
`timezone`/`tz`-shaped name: **zero rows.** So every server-side `to_char()` over a
`timestamptz` renders in the database session's zone, which on Supabase is **UTC**.

I hit it in my own first draft: the order-timeline line for a **4:00 PM** lesson printed
**"Wednesday August 26, 11:00 PM"**. I removed the time from that sentence rather than invent a
timezone constant with no editor (D13). **But twelve live functions do the same thing**, and
several of them put the result **in front of a client**:

```
appointment_notify        book_open_slot            calendar_reminder_sweep
cancel_lesson_session     confirm_booking           decide_booking_change
request_booking_change    request_horse_intake      request_open_time
schedule_lesson_session   swap_booking_item         withdraw_my_pending_booking
```

`confirm_booking` sends *"Your session on Aug 26, 11:00 PM is confirmed"* for a 4pm lesson.
`schedule_lesson_session` sends *"Your lesson is booked — August 26, 11:00 PM"*.
`decide_booking_change` puts it in a decline notification.

**Not fixed — it is a system-wide defect well outside this task**, and the honest fix is a
tenant timezone setting with an editor, not a hardcoded string. **Worked around in this task's
own output**: the agreed slot is formatted in the staff member's **browser**, in the barn's own
timezone, from the very picker they agreed it in — so what the client reads in the invitation is
the same words the person who booked it saw. That is why `AgreedLesson` carries a `display`
string beside the timestamps.

### ⚠️ F2 — the break was a SEQUENCING break, not a missing capability

The task describes step 4 as *"nothing takes the offered availability and turns it into a real
booking."* A booking path **did** exist — `ScheduleSessionForm` in the lead drawer — but behind
`selected.status === 'invited' || 'converted'`, i.e. only **after** the invitation had already
been sent. So the capability was there and **on the wrong side of the link**, which is exactly
why the invitation email could never mention the time. Worth recording because "build the
missing surface" and "move the existing surface into the act" are different jobs, and this was
the second.

### ⚠️ F3 — `schedule_lesson_session` was a third lesson writer that debited nothing

Alongside `save_calendar_item` (staff) and `book_open_slot`/`request_open_time` (client), and it
used the pre-BOOKLINK `_unambiguous_purchase_for_client` with **no credit debit at all**. So
**every lesson ever scheduled from the lead drawer left the client's credit unspent.** Extended
here rather than duplicated; the no-service path is byte-identical to before. **This also
half-closes a BOOKLINK gap** — `bookings.credit_id` is now written by a second writer.

### F4 — `schedule_lesson_session` carried `PUBLIC` and `anon` EXECUTE grants

The same class REVIEWQ and ONBOARD both found. **Not exploitable** — proven under
`SET ROLE anon` that its own guard evaluates to a hard `true` and raises, so nothing was
reachable. Revoked anyway while reissuing, and `coalesce(has_staff_access(), false)` added to
both functions per D1a so a NULL can never fall through the `IF`.

### F5 — the availability feature shipped switched off

`intake_requirements` had `availability` **and** `experience` at `required = false` since
2026-07-14. All 6 live lesson requests happen to carry ranges, but **nothing guaranteed it** —
the entire step-2 obligation §L1 is about was one unticked box.

### F6 — `status_events` on an order carries blank-detail duplicates

The timeline query returns a second `submitted` and a `pending` with NULL detail, written by the
`trg_status_purchases` trigger beside the explicit `log_status_event` calls. Pre-existing, cosmetic,
**not fixed** — it would mean touching a trigger every order in the system depends on.

---

## 6. ⚠️ NOT VERIFIED — the render. A numbered click-through for the owner.

Everything in §3 is query or test output. **No screen was opened and no browser was started.**

1. **THE GATE.** Private window → `/lessons` → pick **Single Lesson** → Continue. Try to submit
   with the availability block untouched: it must refuse with *"Please share when you're
   available."* Fill the weeks/days/times and the experience, submit — the confirmation screen
   should still say **"Nothing is scheduled yet"**.
2. **THE LEAD.** Ops → Intake → open that lead. Above the invitation fields there should be a
   panel headed **"Set the time you agreed on the call"**, with a grey box listing **the weeks,
   days and times they gave you**, and their riding experience.
3. **IN RANGE.** Tick the whole Lesson fit checklist → **Send confirmation & invite** → in the
   panel pick a date and time **inside** what they offered. **No warning should appear**, and the
   button should now read **"Book the lesson & send invitation"**.
4. ⚠️ **OUT OF RANGE — the one to test properly.** Change the date to a day they did **not**
   offer, or a morning when they said afternoons. An **amber block** should appear naming each
   mismatch in words (*"They did not offer Tue — they said Mon, Wed"*), and it must **still let
   you submit** — it is a warning, never a block.
5. ⚠️ **THE ONE ACT — RUN THIS ONE FIRST.** Press the button. Expect, from one click: the lead
   flips to **invited**, the order goes to **awaiting_payment**, a green panel says **"Their
   first lesson is booked for …"**, and **the invitation email's first paragraph names that same
   date and time**. Check the mailbox. If the email arrives without the slot at the top, that is
   gap **G1** showing you something real.
6. **THE CALENDAR.** Ops → Calendar, that date. The lesson should be there, green/booked, with
   the client's name on it — not a grey block.
7. **THE CLIENT'S SIDE.** Follow the activation link → set a password → run the onboarding
   through to the payment screen → exit into the app. On the dashboard you should get the
   overview modal, **their order**, and **the lesson in their upcoming schedule**, badged
   **SCHEDULED** (not "REQUESTED").
8. **WITHOUT A TIME.** Do the whole thing again on another lead but **leave the date blank**.
   Everything should behave exactly as it did before this task: invitation sent, no booking, no
   agreed-time line in the email.
9. **THE OFF SWITCH (D13).** Ops → Intake → *"Booking form — required fields"* → untick
   **Availability**. A lesson inquiry should submit without ranges again. Tick it back on.

---

## 7. Migrations applied to prod (all dry-run + rollback proven first)

| file | what |
|---|---|
| `20260817T1200_lessonrequest_l1_lesson_step2_required.sql` | `availability` + `experience` flipped to required; `submit_public_request` refuses a lesson inquiry with no ranges, before writing anything |
| `20260817T1300_lessonrequest_l3_agreed_lesson_is_one_act.sql` | `order/time_agreed` vocab; `schedule_lesson_session` debits through `_debit_or_create_for_booking` and writes `credit_id`; `provision_client_invitation` DROP+CREATE with `p_agreed_lesson jsonb`; grants restored and revoked from `anon` by name |
| `20260817T1400_lessonrequest_l3_invitation_names_the_agreed_time.sql` | `MSG.AGREED_TIME` block prepended to the `INVITATION` template (v1 → v2), owner-editable |
| `20260817T1500_lessonrequest_l4_booking_claims_its_account.sql` | `bookings_claim_on_account_link` trigger on `profiles` — a booking made before the account finds it at activation |

---

## 8. TEARDOWN

No dev server, no watcher. `vitest run` only, `--maxWorkers=2`, every run exited on its own;
`psql` invocations are one-shot; the one `npm run build` completed and exited. The worktree
carries a `node_modules` **symlink to the canonical checkout at the same-case path**
(`/Users/Cactai/…`), matching `wt-askright` and `wt-carepath` — not the case-variant symlink
that loaded React twice on 2026-08-16. Scratch probe scripts live in the session scratchpad,
not in the repo. Process census confirmed clean before reporting.
