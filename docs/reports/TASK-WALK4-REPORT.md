# TASK-WALK4 — REPORT

**Can the owner run his business on this tomorrow? Partly.** Contracts: **yes** — a lease was
authored, filled, a date saved, the horse confirmed, locked, and signed by both real people with
**zero direct database writes**, for the first time. Staff calendar operations (manual bookings,
cancellations): **yes**, with correct notifications. Three things still stop him:

1. **A party can finish activating and never know it.** The very first activation attempt in this
   walk silently succeeded server-side while the screen told WALKTEST *"We could not finish
   activating your account."* Nothing in the UI ever told them otherwise.
2. **A customer who buys a recurring membership — 2x Weekly Lessons, $880, paid — can never get it
   onto the calendar**, through any door, client or staff. Not the order-page link. Not the
   permanent Calendar bar. Not the staff dossier control SLOTREACH built for exactly this. The
   staff booking form does not even list this customer as a bookable client. The single common
   cause: no `clients` row exists for their contact, and nothing in the entire purchase, checkout,
   onboarding, or staff-dossier path ever creates one.
3. **Claire's lesson plans never advance.** The plan correctly heads today's Riding Lesson — that
   part works. But **"Record progress & update the plan" fires zero network requests when
   clicked** — confirmed twice, full traffic capture, button not disabled, every field filled. The
   plan stays on version 1 forever. The task brief said it plainly: *"That roll-forward is the
   whole feature — if it does not happen, nothing else in §E matters."* It does not happen.

Identities: `admin@fhequestrian.com` (staff) · `cjzigs+walk4-202608211621@icloud.com`, last name
**WALKTEST**, first name Walk4 (fresh, this walk). §D and §E additionally used the pre-existing
**Walk3 WALKTEST** test fixture (not a real client — created by TASK-WALK3) after Walk4 WALKTEST
was found unbookable by any means — disclosed at each use below. Site
`https://www.frenchheritageequestrian.com` (production), run 2026-08-21, 16:20–17:53 PDT. Branch
`task/walk4`, worktree `~/Downloads/claude-code-repo/wt-walk4`. Committed, **not pushed**.

---

## Every row this walk created (purge list)

| type | id | note |
|---|---|---|
| contact | `ef06aeb1-…` | Walk4 WALKTEST |
| auth.user | `e77e0852-…` | Walk4 WALKTEST's account |
| invitation ×2 | `209b98b4-…`, `872b606a-…` | contract invites, both redeemed |
| document (the lease, **EXECUTED**) | `88574645-…` | zero direct DB writes — see §A |
| document (doc2, request/suggest test only) | `375efff8-…` | never locked, never signed |
| document ×4 (onboarding, auto-signed) | Company Policies, Facility Rules, Participant Liability Release, Human Emergency Medical Auth v2 | executed as part of Walk4's account activation |
| contract_note (change request) | `62d1fd1b-…` | on doc2 — see §B |
| purchase | `e91b1dfc-…` | 2x Weekly Lessons, $880, cash-declared, **never reached the calendar** — see §C |
| booking ×3 (on **Walk3 WALKTEST**, pre-existing fixture) | `aa7113b6-…` (today's lesson), `ffdfb217-…` (next lesson), `bde693a1-…` (created→rescheduled→**cancelled**, §D) | Walk3 WALKTEST is not a real client; reused per rule 1's precedent (WALK3 itself reused it as a placeholder) |
| lesson_plan | `3ea51e9c-…` | on Walk3 WALKTEST, version 1, **never advanced** — see §E |

**No real client's row was read for a write, and none was written.** Executed-document count:
**60 → 65** (55 original + WALK3's 5 + this walk's 5, all disjoint by id — verified). The 2
pre-existing zero-controls orphans found below are auto-created companion documents from WALK3's
lease, not new.

---

## §A — a contract, end to end, ZERO database writes

**PASSED — first time this specific acceptance test has been met.** WALK3 needed two direct DB
writes to get a lease signed at all; CONTRACTSEND fixed the two bugs that forced that but was
never run against production. This walk is the production proof.

1. `/app/ops/contracts/new` → LESSOR = French Heritage Equestrian, LESSEE = a placeholder (`Get
   started` requires both parties chosen — a company-only NewContractPage limitation, not a bug),
   horse = an existing WALK3 test fixture. **Created cleanly, no orphan, no "Could not start the
   contract" error** — CONTRACTSEND's §3 fix holds. `A3-after-get-started.png`.
2. **Parties & Horse → Edit → "or add by email…"** — typed the fresh Walk4 WALKTEST address,
   reassigned the placeholder LESSEE to it in one click (PARTYEMAIL's `reassign_document_party`
   path). `A5-lessee-added-by-email.png`.
3. Filled every reachable field: 25 selects, 9 Yes/No pairs, both dates, the entity-signer fields
   (Lessor is a company), the activities/fee-schedule chip groups. The only fields left blank were
   ones the app itself marked `disabled` behind a `pointer-events-none` inert wrapper — CONTRACTSEND's
   documented "deliberate non-interactive preview" behavior for gated fields, confirmed by direct
   DOM inspection, not assumed.
4. **The date bug is fixed, in production, proven by a real reload.** Typed `09/01/2026` into both
   "This Agreement begins on" and "…continues until," reloaded the page from a fresh navigation
   (not a soft refresh), and both values were still there.
   `A11-dates-filled.png` (as typed) · `A11b-dates-after-reload.png` (implicit — value read back
   `['2026-09-01','2026-09-01']` after a hard reload).
5. **The horse-confirmation control renders and works, in production.** Clicked **"I reviewed the
   horse info — it's accurate"** — the card flipped to **"✓ Confirmed accurate · ↺ reopen."**
   `A12-before-horse-confirm.png` → `A13-after-horse-confirm.png`. This is the control WALK3 found
   never rendered.
6. **Send → Send to Lessee only** → status flips to `in_review`. Built the activation link from
   `invitations.token` per rule 5, **with `&kind=contract` appended** (WALK3's F-7 finding: the
   task brief's own link formula omits it and lands on the wrong path — corrected here from the
   start, not rediscovered the hard way).
7. **WALKTEST clicked "Accept & sign"** (after a self-service name fix via Account → My Profile,
   WALK3's F-6 still standing — see §A-flag below) and got: **"Approved — the contract is locked
   and ready to sign below."** No blocker list. Every required field passed
   `contract_lock_blockers` on the first try.
8. **WALKTEST signed as LESSEE.** Staff (French Heritage Equestrian has no individual signer)
   **signed on behalf of the company.** Both signatures landed within the same session →
   **`status = EXECUTED`.** `A23-executed-top.png` — badge reads **Executed**, hash
   `414ee69064d9…`, the real merged body with real names.

**Zero direct database writes were used anywhere in this sequence.** Every state change — party
reassignment, all field saves, the horse confirmation, the lock, both signatures — went through
the real browser UI against the real RPCs.

### The one real defect found in getting here: **a party can finish activating and be told they failed**

The **first** attempt to activate Walk4 WALKTEST's account (password set, Continue clicked) showed:
*"We could not finish activating your account."* `B2-after-activation-landing.png`. A retry then
said *"an account already exists for this email — sign in instead"* — with no sign-in form on that
page. `B3-retry-activation.png`.

**The first attempt had actually succeeded.** Queried the invitation immediately after: `status =
redeemed`, `redeemed_at` set, `document_parties.contact_id` correctly pointing at the new WALKTEST
contact. The auth account was real (its password worked at `/login`). **Something client-side
after the successful redemption threw and showed a generic failure message, on the one screen a
brand-new party sees.** A real invited counterparty, following the app exactly as built, would see
their signing invitation report failure and have no way to know it actually worked — no retry path
recovers cleanly (`B4`, `B5` — a login-then-revisit sequence surfaces the real
`redeem_contract_invitation` 400 as *"This link isn't valid anymore… you've already activated this
account"*, equally unhelpful). **Escalated, not diagnosed** — no `src/` file was opened to explain
this; it was established entirely from the screen and from read-only queries against
`invitations`/`auth.users`.

### Orphans

Ran CONTRACTSEND's own query. **This walk's document has 2 controls (not an orphan).** Two
pre-existing rows remain flagged — **not new, and not the "New Contract" bug**:

```
id                                   | title                                              | workflow_state | controls
3f52d678-3ac1-496f-a119-3a966cfd0459 | Horse Emergency Veterinary Authorization           | editable       | 0
0c9adaac-e58e-4e33-ad74-c397f2ad67e4 | Horse Handling and Routine Care Liability Release  | editable       | 0
```

These are the two **auto-created companion documents** from WALK3's lease (still unsigned,
CONTRACTWALK's B2 finding, reconfirmed present) — they simply don't carry party controls by
design, unrelated to CONTRACTSEND's orphan mechanism. **Not deleted, per D11/D16.**

WALK3's three original orphans (`2f18d3ea…`, `6f073fbd…`, `ada59382…`) **still exist, still
`editable`, but no longer match the orphan query** — each now has 2 `document_party_controls`
rows. Reported as measured; not investigated further (rule 4).

---

## §B — the counterparty's side

**WALKTEST saw the contract, saw and acted on a change request, and Suggest was reproduced with
definitive proof of what the network does.** Used a second, lightweight document (`375efff8-…`)
sent to `in_review` (not locked/executed) so the Requests and Add-Item surfaces stayed reachable —
§A's document lost both once it executed (confirmed: staff and WALKTEST toolbars on the executed
lease shrink to `Resend copies`/`Terminate`/`Add a comment` only, `B22`/`B23`).

### The "change request" mechanism: **not labelled Agree/Edit — labelled "Add entry" / "Resolve"**

The task brief expected Accept/Reject/Withdraw, "labelled Agree and Edit." **Neither pair is what's
on screen.** As staff: **Requests → CHOOSE WHAT TO REQUEST A CHANGE TO** → picked a field → typed
free text → **NOTIFY**. `B29`–`B32`. As WALKTEST: the request appeared on their **Dashboard**
(*"CONTRACT CHANGE REQUESTED — CJ Z submitted 1 change request…"*, `F1`) and on the contract's own
**Requests** tab, with exactly two controls: **"Add entry"** (reply into the thread) and
**"Resolve"** (clicking it closes the thread, offering **"Reopen"** afterward). `B37`, `B40`. **No
Accept, no Reject, no Agree, no Edit, no Withdraw anywhere in this feature.** It is a discussion
thread with a done/not-done toggle, not a proposal-with-disposition system. WALKTEST used it —
resolved the request — satisfying "sees and acts on" as written, just not with the labels assumed.

### Suggest — reproduced precisely, with full network capture

Set `Lessee: can_suggest = true`. As WALKTEST: **Add item → section "1. Parties" → wrote free text
in the compose box → the live "HOW IT WILL READ" preview showed the exact text back correctly**
(the form was genuinely filled, not empty) → clicked **"ADD TO THE CONTRACT."**

**Zero `/rest/v1/rpc/*` requests fired.** Confirmed twice — once with a section that had no
existing item to attach to (a legitimate reason the button might no-op), and once, deliberately,
with a section that had a real target item and the compose box visibly holding the typed text.
**Both times: the modal just closed. No error, no toast, nothing in `contract_notes` or anywhere
else.** `B49-after-careful-submit.png`. This is WALK3's F-4, now reproduced with the exact repro
steps and proof it is a pure client-side no-op, not a server rejection — the click handler simply
never calls anything.

---

## §C — sell and schedule a recurring lesson: **the product still cannot be scheduled**

Bought **2x Weekly Lessons** ($880/mo) through **Catalog → Riding Lesson → BOOK IT → GO TO
CHECKOUT → CONTINUE TO YOUR ORDER**, all in one unbroken visit (WALK1's cart-survives-a-reload
caveat still applies and was respected). `C9`. Declared **cash** — the order page correctly read
**"Payment pending — cash"** with the exact D23/D25 copy BUYANDBOOK shipped: *"Nothing is waiting
on that. Your sessions are yours now — pick your times on the Calendar whenever you like."` `C12`.

**Both required reach paths exist and render correctly:**
1. **The order-page link** — *"Select the day and time for your weekly Riding Lessons"* → lands
   exactly on `/app/onboarding?step=slots` (SLOTREACH's fix; WALK2's dead link is gone). `C13`.
2. **The permanent Calendar bar** — *"Your weekly Riding Lessons — No day and time chosen yet"*,
   opens the identical picker inline, confirmed present on a fresh `/app/calendar` visit. `C37`.

Picked **Tuesdays 4:00 PM + Thursdays 5:00 PM** — the summary line read back correctly: *"Tuesdays
at 4:00 PM and Thursdays at 5:00 PM — held for you every week from now on."* `C19`.

### But submitting it always fails — `set_my_standing_schedule` → **`"not your plan"`**

```
POST …/rpc/set_my_standing_schedule
{"p_purchase_item_id":"6fc3301a-…","p_slots":[{"day":"Tue","time":"16:00"},{"day":"Thu","time":"17:00"}],…}
→ 400 {"code":"P0001","message":"not your plan"}
```

Confirmed the purchase genuinely belongs to WALKTEST — `purchases.buyer_user_id` matches
WALKTEST's `auth.uid()` exactly. The rejection comes from one specific check:
`set_my_standing_schedule` requires a `clients` row for the buyer's contact
(`current_client_id()`), and **`select * from clients where contact_id = '…'` returns zero rows.**
Walk4 WALKTEST was provisioned entirely through a **CONTRACT invitation** (`add_document_party_by_email`
→ `reassign_document_party`), never through any path that creates a `clients` row.

**Completing the entire self-service onboarding wizard does not create one either.** Walked
rider-details → all 4 onboarding documents signed → payment step, start to finish, in one
continuous session (the wizard resets to step 1 on any fresh page load — WALK1/WALK2's F-11/F-19,
reproduced again, `C24`). Reached step 5 a second time and resubmitted the identical slot choice:
**same 400, same `"not your plan"`.** `clients` table still empty for this contact afterward —
checked directly.

This closes the loop §D opens from the other side — see there for the staff-side half of the same
gap.

---

## §D — staff sets a slot, and changes announce themselves

### The dossier control **exists** — and is **also blocked**, by the same root cause, one layer deeper

`Records → Walk4 WALKTEST → Orders tab → "THEIR STANDING WEEKLY TIME"` — exactly the control
SLOTREACH built. `D4`. Picked the same Tue 4pm / Thu 5pm, clicked **"SET THIS WEEKLY TIME."**

```
POST …/rpc/set_my_standing_schedule → 400 {"message":"no client for purchase item 6fc3301a-…"}
```

**A different, more specific error than the client-side one** — staff clear the first ownership
gate (`has_staff_access()` short-circuits it), but the call still delegates to
`_generate_plan_month`, which needs an actual `clients` row to attach the generated bookings to,
and there is none. **Staff cannot set this client's schedule either.**

**Worse: staff cannot even manually book this client at all.** Opened **Calendar → Calendar item →
Session** to author a one-off lesson by hand (WALK2's own fallback for exactly this situation).
**Walk4 WALKTEST does not appear in the CLIENT dropdown** — only Walk1/Walk2/Walk3 WALKTEST and
every contact that does have a `clients` row are listed. `D9`. A contact with no `clients` row is
invisible to the one remaining staff workaround too. Reading the offending guard in
`set_my_standing_schedule`/`set_recurring_days`/`_generate_plan_month` was the minimum needed to
name what to escalate (rule 4); no fix was attempted.

### Reschedule and cancel, tested on **Walk3 WALKTEST** (pre-existing fixture, substituted because Walk4 WALKTEST is unbookable by any means — disclosed here, not silently swapped)

Staff-authored a one-off **Single Lesson** for Walk3 WALKTEST, Fri Aug 21, 10:00 AM
(`aa7113b6-…`, doubled as §E's "today's lesson" — see there).

| step | booking status | notification |
|---|---|---|
| create | `scheduled` | — |
| **reschedule** (staff panel, changed date+time, clicked Submit) | flipped to **`draft`** | **none fired** |
| **cancel** (Delete, on the now-draft item) | `cancelled`, `deleted_at` set | **fired**, exact D25 wording |

The cancel notification: *"Your Riding Lesson on Tuesday Aug 25 at 2:00 PM is cancelled — that
session is back on your account, so pick a new time whenever you like."* — **SLOTREACH's fix
confirmed working in production**, word for word.

The reschedule result is **reported, not asserted as a regression**: editing this
booking's time through the staff panel moved it to `draft` status in the same action, and no
`booking_rescheduled` notification fired for that specific transition. This booking had no
purchase/credit behind it (a bare staff-authored session), unlike the credit-backed booking WALK2
originally tested — whether a scheduled→draft transition is meant to notify is a real open
question this walk cannot answer without reading `save_calendar_item`'s edit branch, which rule 4
rules out. **Flagged for a follow-up walk on a credit-backed booking**, not claimed as broken.

---

## §E — the lesson-plan loop: **half works, and the broken half is the whole point**

Authored a plan for **Walk3 WALKTEST** at `/app/ops/lessons/plans` (Walk4 WALKTEST does not
appear on this roster either — no bookings, for the same reason as §C/§D). Focus: *"WALK4 TEST
focus: build confidence at the trot."* Objective: *"Sit the trot without stirrups for 30 seconds."*
Saved as version 1. `E7`.

### ✅ The day's Riding Lesson carries the plan — confirmed two ways

- **Ops Dashboard → "Today's Riding Lessons"**: *"6:00 PM – 7:00 PM PDT · Walk3 WALKTEST · WALK4
  TEST focus… · Lead with: Sit the trot without stirrups for 30 seconds."* `E9`.
- **The Calendar item panel itself**, opened on that exact booking: *"THE PLAN FOR THIS RIDING
  LESSON — Version 1 · current"*, same text. `E14` (screenshot).

### ❌ "Record progress & update the plan" is a silent no-op — **confirmed twice, full network capture**

Opened that lesson's **Plan & record** panel, marked the objective **Achieved**, marked
**Attended**, checked two activities, **attached a photo** (uploaded successfully — the button
changed from *"Add a photo or video"* to *"Add more,"* confirming the upload itself worked), typed
an instructor log and a rider-visible note, then clicked **"RECORD PROGRESS & UPDATE THE PLAN."**

```
(button.isDisabled() === false)
→ click
→ zero /rest/v1/rpc/* requests of any kind
```

Repeated with a fresh page load to rule out a fluke: same result. **`booking_forms.answers` for
that booking is still `{}`, `plan_id` is still `NULL`.** The plan is still version 1 — checked
directly in `lesson_plans` after the attempt. `E17` shows the fully-filled form immediately before
the click; the button is visibly a lighter shade than the `SUBMIT` button beneath it, consistent
with something silently gating the click though the DOM does not report it disabled.

**The plain "Save" button, by contrast, works mechanically** — clicked it separately and it fired a
real `save_booking_form` call (200, confirmed). But per the app's own copy, plain Save
*"keeps the per-objective results with the form and leaves the plan alone"* — it is explicitly not
the roll-forward action.

**The loop does not close.** The next lesson (`ffdfb217-…`, Aug 24) still leads with version 1,
unchanged, because no progress was ever recorded through the one button built to record it. Per
the task's own framing: *"That roll-forward is the whole feature — if it does not happen, nothing
else in §E matters."* It does not happen.

---

## §F — naming and notifications throughout

### D25 — "booking" never reached a person, everywhere checked

Swept every WALKTEST-facing page visited this walk (`/app/dashboard`, `/app/calendar`,
`/app/my-lessons`, `/app/orders`, `/app/documents`) for the word "booking" in visible text: **zero
matches on all five.** Every surface said **Riding Lesson(s)** or **Session** consistently —
order-page line, onboarding copy, Calendar bar, calendar chip labels, the staff **"Calendar item"**
button (not "+ Booking"), the panel's type toggle (**Session / Appointment / Unavailable**), and
every notification title below. SLOTREACH's D25 pass holds under a second, independent check.

### Every notification this walk produced, in order (24 rows, `emailed_at` NULL throughout — expected, proves nothing either way per §4)

| time (PDT) | kind | title | channel(s) confirmed |
|---|---|---|---|
| 16:54:57 | `party_signed` ×2 | Horse Lease Agreement — signed by Walk4 WALKTEST (LESSEE) | staff bells |
| 16:55:26 | `document_executed` | Horse Lease Agreement — Standard is signed | client dashboard card (`F1`) |
| 17:01:48 | `contract_in_review` ×3 | Horse Lease Agreement — Standard is ready for your review | client dashboard card |
| 17:05:09 | `contract_change_requested` | CJ Z submitted 1 change request on Horse Lease Agreement — Standard | client dashboard card (`F1`) |
| 17:15:40 | `payment_reported` ×2 | Walk4 WALKTEST says they paid 2x Weekly Lessons in cash — not yet confirmed | staff Payment Review queue (BUYANDBOOK, reconfirmed by the order page's own state) |
| 17:27:36–17:27:49 | `party_signed` ×4 (×2 rows each) | the 4 onboarding documents — fully executed | — |
| 17:35:03 / 17:43:41 | `purchase_unpaid` ×5 | Single Lesson — awaiting payment / payment due | — (staff-authored unpaid Riding Lessons on Walk3 WALKTEST, §D/§E) |
| 17:40:39 | `booking_cancelled` | Your Riding Lesson on Tuesday Aug 25 at 2:00 PM is cancelled — that session is back on your account, so pick a new time whenever you like. | client-facing wording confirmed D25-correct |
| — | **(none)** | the reschedule at 17:38ish | **no notification fired** — see §D |
| — | **(none)** | the plan advancing | **never happened at all** — see §E |

**Messages the owner should look for in his own inbox** (since `emailed_at` proves nothing, per
§4's warning):
1. Activation email, `cjzigs+walk4-202608211621@icloud.com`, ~16:44.
2. Lease-executed copy + the 4 onboarding-document copies, same address, ~16:55–17:27.
3. A `contract_change_requested` and a `contract_in_review` notice, same address.
4. A `payment_reported` (cash) notice — internal, to staff — ~17:15.
5. A `booking_cancelled` notice, same address, ~17:40.

**Client dashboard (channel 1):** confirmed directly, live — every card above rendered correctly
on `/app/dashboard`, in D25-correct language. `F1`.
**Admin dashboard (channel 2):** Payment Review's queue is the confirmed reliable signal
(BUYANDBOOK); this walk did not separately re-check the general staff inbox for a parallel copy.
**Email (channel 3):** unproven by design, per §4 — this session cannot open an inbox.

---

## The test this must pass — answered item by item

| # | requirement | result |
|---|---|---|
| 1 | a lease signed by both parties, **zero direct database writes** | **PASS** — §A, first time this has been achieved |
| 2 | counterparty Suggest **reproduced**, exactly what happened | **PASS** — §B, zero network calls, captured twice |
| 3 | two standing lessons a week, a month out, reachable both ways | **FAIL** — both paths reachable and render correctly; the submit call itself is refused for any contact with no `clients` row, client- and staff-side alike (§C, §D) |
| 4 | staff reschedule and cancel each produce a notification | **HALF** — cancel: **PASS**, exact wording confirmed. Reschedule: no notification fired, but on a booking with no credit behind it — flagged, not asserted as broken |
| 5 | the plan loop closes — next lesson shows the update | **FAIL** — the day's lesson correctly shows the plan (half the loop); the record-and-advance button is a confirmed silent no-op (the other half, and per the brief, the half that matters) |
| 6 | every "booking" said to a human is listed | **PASS, trivially — zero found** across every page swept |
| 7 | no real client row touched; executed count 60 + only what was created | **PASS** — 60 → 65, all 5 new rows accounted for by id |
| 8 | every stop recorded with its reason | **PASS** — see below |

---

## Stops and deviations

- **Walk4 WALKTEST could not be used for §D/§E** because it cannot appear in any booking surface —
  substituted **Walk3 WALKTEST**, a pre-existing test fixture (not a real client, created by
  TASK-WALK3), disclosed at first use in each section.
- **No real client's record, booking, order, or document was opened for a write.** Records search
  was scoped to "Walk4 WALKTEST" / "Walk3 WALKTEST" by name at every use; no roster-wide screenshot
  was taken or kept.
- **One direct DB read-only investigation beyond a simple orphan/purge query**: read
  `set_my_standing_schedule`, `set_recurring_days`, and `current_client_id()`'s definitions to name
  the exact guard blocking §C/§D (rule 4 permits this — it is what "escalate" requires; nothing was
  changed, and no other function body was opened).
- **A photo was uploaded** to a **staff-authored test booking on Walk3 WALKTEST** as part of §E
  (a 4×4 solid-color PNG, generated locally, never a real photo) — recorded here per rule 2's
  "list every row you create," even though the record action that would have attached it to a plan
  version never fired.

---

## Teardown

**Browser processes:** none left running — Playwright closed every browser on script exit;
`ps aux | grep -Ei "chromium|headless_shell|playwright"` empty at report time.
**Dev processes:** none started this walk — no `npm run dev`, no vitest.
**Database sessions:** all `psql` calls were one-shot `-c` invocations; none left open.
**Tooling:** Playwright 1.62.1 + the machine's cached Chromium, installed worktree-local at
`wt-walk4/walk4-tooling/` via `npm install --no-save`, `.gitignore` containing `*`. **The repo's
own `package.json` was never touched.**
**Credential hygiene:** `FHE_ADMIN_PASSWORD` read from `.env.test` into a Node process, never
printed or screenshotted. WALKTEST's generated password lives only in
`walk4-tooling/state/walktest-password.txt`, gitignored. 143 screenshots reviewed before writing
this report; the login screen was captured post-auth throughout, and no credential appears in any
of them.
