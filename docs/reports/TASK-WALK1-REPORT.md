# TASK-WALK1 — REPORT

**Test identity: `cjzigs+walk1-202608201634@icloud.com` · Walk1 WALKTEST**
Site: `https://www.frenchheritageequestrian.com` (production) · walk run 2026-08-20, 16:34–17:05 PDT
Branch `task/walk1`, worktree `~/Downloads/claude-code-repo/wt-walk1`. Committed, not pushed.

---

## The three answers, up front

### 1. Does mail send from this system? — **UNPROVEN, AND THE COUNTER IS STILL ZERO.**

**`notifications` went 46 → 64 during this walk. `emailed_at` is NULL on all 64.** Not one row was
ever stamped, including the 18 created by real actions in the last half hour.

But `emailed_at` is **not** the only mail path, and the walk found the other one. Two Vercel API
routes returned **200** at the moment of submission — `api/inquiry-confirmation` and
`api/request-received` — and the confirmation screen stated outright: *"Your inquiry has been
emailed to the barn. A copy of everything you sent has been emailed to you."*

So the honest answer is: **the app claims mail was sent, the send endpoints returned 200, and the
database records no send.** Whether anything landed is the owner's to confirm — §4 of the spec
makes him the verifier. **The list of messages that should have arrived is in §E below, with
times.** If those messages are in the inbox, mail works and `emailed_at` is simply never written.
If they are not, mail is dead and the 200s are meaningless. **That question is now one inbox
check away, and it is the highest-value thing the owner can do with this report.**

### 2. The single most important finding.

> **Declaring payment does not unblock booking. The user is told it does, twice, and it does not.**

§3.3 makes "nothing blocks after declaring payment" an acceptance test, and this fails it.

- The order page says: *"You can pick your times on the Calendar whenever you're ready —
  scheduling doesn't wait on payment."*
- The onboarding payment step says: *"finish now and pay later; either way you can book your
  sessions on the Calendar."*
- **After declaring BOTH payments** — Zelle on PUR-000238 and cash on PUR-000245 — clicking
  **BOOK THIS TIME** renders the literal string **`NO_CREDITS`** on the page and books nothing.

Credits mint only on staff confirmation. Confirmation is WALK2's job. So the real control the
owner described — *"the lesson never happens without payment being verified"* — has been
implemented as a **hard block on booking**, not as an operational check. Two promises in the UI
are false as written.

### 3. Runner-up, because it is silent and it reaches staff.

That same failed click **fired a staff notification anyway**: `booking_time_requested — "A client
claimed Aug 16, 08:00 AM"`, visible on the admin dashboard right now. **`bookings` contains zero
rows for this identity.** Staff are being told a client claimed a time that does not exist, while
the client was shown an error code.

---

## Every row the WALKTEST identity created (purge list)

| type | id / code | created |
|---|---|---|
| contact | `3f611380-0dfa-469b-b40c-d2a406c0e33e` | 16:36:46 |
| request (Evaluation Lesson) | `1ee3c6b5-1a5c-4533-98e2-4cc16c01970a` | 16:36:46 |
| **purchase PUR-000238** ($170, Zelle claimed) | `965d33ab-5a58-449a-8eb5-7abd5b7d75e6` | 16:36:46 |
| invitation | `79483d4d-fb9b-4457-9ddd-8ca4cd315059` | 16:38:35 |
| auth.user | `03c14c97-6fae-4dba-80b4-c9ae47602f90` | 16:39:38 |
| request (1x Weekly Lesson) | `128cb31c-8bf8-4ee2-a23e-0772379543e6` | 17:00:24 |
| **purchase PUR-000245** ($460, cash claimed) | `3688a09a-10a8-4eab-92ab-1b8b8f486037` | 17:00:24 |

Plus: 4 executed documents + 12 draft duplicates (see F-B9), 18 notifications, 1 `signup_attempts`
row, 0 bookings, 0 credits.

⚠️ **The two purchases are deliberately left UNCONFIRMED for WALK2**, per §3.3 — see §F.

---

## §A — the web visitor books a lesson

| step | what the visitor saw | shot |
|---|---|---|
| A1 | Homepage 200 in 4.4s. Nav: Our Community / Horse Care / Find a Horse / Book a Lesson / Say Hello | `A1-homepage.png` |
| A2 | `/lessons` — **all 9 lesson offerings render**, prices exact | `A2-lessons-page.png` |
| A3 | Selected *Evaluation Lesson*; CTA reads **CONTINUE TO SUBMIT INQUIRY** | `A3-evaluation-selected.png` |
| A4 | `/checkout` — the question engine. *"Tell us a little about you and we will call…"* | `A4-inquiry-step1.png` |
| A5 | Filled. **Plus-addressing preserved in the field** | `A5-inquiry-filled.png` |
| A6 | **First submit rejected**: *"Please tell us the rider's experience level."* | — |
| A6b | Submitted. *"We Are So Glad You Reached Out"* | `A6-inquiry-submitted.png` |

**The public funnel is an inquiry, not a purchase.** No payment is ever offered to an anonymous
visitor. *"Nothing is scheduled yet; we will agree the timing together."*

**Plus-addressing survives end to end** — form field, confirmation copy, `requests.contact_email`,
`contacts.email`, `auth.users.email`. No step normalised or rejected the `+`. §3.1's verification
requirement is **met**.

---

## §B — `/sign/rider`, opened cold

**This URL had 0 `signup_attempts` rows in production, ever. It now has 1 — mine.**

| step | result | shot |
|---|---|---|
| B1 | Page 200. Lists **11** purchasable items (the 9 lessons **+ Single Class + 4-Class Pack**) | `B1-sign-rider-cold.png` |
| B2 | Submitted → `api/sign-start` **200**. *"Your activation email is on its way to cjzigs+walk1-…"* | `B2-sign-rider-submitted.png` |
| B3 | Activation link **built from `invitations.token`** → `rpc/validate_invitation` 200 | `B3-activate-page.png` |
| B4 | Password set → `api/register-invited` 200, `redeem_invitation` 200 | `B4-activated-landing.png` |

**Where it lands, and whether that is right.**
It lands on **`/app/onboarding`** — a 5-step wizard (Your order · Your details · Review & sign ·
Payment · You're all set) — **not** a dashboard. Waiting there was **PUR-000238, the Evaluation
Lesson from the inquiry 2 minutes earlier**, already priced at $170.

**That part is right, and it is the best-working thing in this walk:** a cold texted link turned a
public inquiry into an identified, priced, signed-up client without a human touching it.

**What is not right:** `/app`, `/app/dashboard` and `/app/orders` **all redirect to
`/app/onboarding`** — the user is hard-gated into the wizard while the full nav menu still
advertises every destination. And the wizard **restarts at step 1 on every reload** (field values
persist, position does not), so a user who closes the tab re-walks it.

Documents signed: 4 of 4 (Company Policies, Facility Rules, Participant Liability Release, Human
Emergency Medical Authorization v2), `record_signature` 200 each.

---

## §C — the authenticated calendar, both credit states

### C.1 — no credits: **it does NEITHER.**

The owner's requirement was *"if the user clicks the book button and doesnt have credits they add
credits, no need to make them go through the catalog."*

Clicking an open slot correctly warns: *"You have no credits left. Booking this time will prompt
you to buy."* **Then clicking BOOK THIS TIME prints `NO_CREDITS` on the page and stops.**

**No purchase flow appears in place. No deflection to the catalog either.** The spec anticipated
two outcomes and called the second a defect; the actual behaviour is a third and worse one — a raw
error token shown to the customer. Reproduced twice (`C3-no-credits-purchase-prompt.png`,
`G2-book-after-payment-declared.png`), before and after payment was declared.

### C.2 — with credits: **UNREACHABLE, and that is itself the finding.**

Credits mint only when staff confirm payment. §3.3 requires both claims to be left unconfirmed for
WALK2. **These two requirements cannot both be satisfied**, because this build has no path from
"client has paid" to "client has credits" that the client can walk alone. `lesson_credits` and
`service_credits` are both **0 rows** for this identity after two purchases and two declarations.

**§C.2 is therefore blocked on WALK2's confirmation step**, and the booking half of §C cannot be
proven until then. Recorded, not forced — forcing it would have meant confirming a payment, which
§3.3 reserves for WALK2.

---

## §D — every lesson choice, website vs app

**All 9 present in both surfaces. All 9 prices match exactly.**

| # | offering (DB) | price | website | app | match |
|---|---|---|---|---|---|
| 1 | Single Lesson | 150.00 | $150 | $150 | ✅ |
| 2 | Single Lesson (With your horse) | 120.00 | $120 — shown as **"Single Lesson"** | $120 — full name | ⚠️ name |
| 3 | Evaluation Lesson | 170.00 | $170 | $170 | ✅ |
| 4 | 4-Lesson Punch Card | 500.00 | $500 | $500 | ✅ |
| 5 | 8-Lesson Punch Card | 950.00 | $950 | $950 | ✅ |
| 6 | 1x Weekly Lesson | 460.00 | $460 | $460 | ✅ |
| 7 | 1x Weekly Lesson (With your horse) | 420.00 | $420 — shown as **"1x Weekly Lesson"** | $420 — full name | ⚠️ name |
| 8 | 2x Weekly Lessons | 880.00 | $880 | $880 | ✅ |
| 9 | 2x Weekly Lessons (With your horse) | 780.00 | $780 — shown as **"2x Weekly Lessons"** | $780 — full name | ⚠️ name |

**The three name mismatches are the same defect.** The public page strips the *"(With your horse)"*
suffix and relies on a section heading — *"Already leasing or own a horse? These lessons are for
you."* — to disambiguate. So the website shows **"Single Lesson" twice, at $150 and $120**, and
"1x Weekly Lesson" twice, and "2x Weekly Lessons" twice. The app names all three in full.
`/sign/rider` also names them in full. **The public lessons page is the only surface that hides
the distinction, and it is the one anonymous visitors buy from.**

### ⚠️ D-recurring — the four "monthly memberships"

**The answer to the question §4 called the most valuable available in this walk:**

> **Nothing is minted. Not at purchase, not at declaration. And `pg_cron` is not installed on this
> database — the `cron` schema does not exist.**

I bought **1x Weekly Lesson ($460, `recurring`, freq 1)** as PUR-000245 and declared cash on it.

| question | answer |
|---|---|
| what is minted | **nothing** — `lesson_credits` 0 rows, `service_credits` 0 rows |
| over what period | n/a — no row, so no `period_start` |
| with what expiry | n/a — no row, so no `expires_at` |
| does it need the cron | the entitlement never arrived at purchase, so **yes, it waits on `mint-monthly-allotments`** |
| does that cron exist | **`cron.job` does not exist — pg_cron is not installed.** No schedule was observed anywhere in the database. |

**What the user is told they have bought:** the order page says *"1x Weekly Lesson · $460 / mo"*
and nothing more. **No lesson count, no period, no expiry, no start date, no renewal terms.** The
catalog card adds *"One lesson every week — billed the 1st of each month; 30 days notice to
cancel."* The order page — the last screen before money — repeats none of it.

So a customer can buy a $460/month membership and receive: no credits, no stated entitlement, and
a booking button that answers `NO_CREDITS`. **If a scheduler exists outside Postgres (Vercel cron,
a Supabase scheduled function), it was not observable from here — that is the orchestrator's to
confirm, and it is the single thing most worth confirming next.**

---

## §E — notifications, all three channels

**`notifications`: 46 → 64 across the walk. `emailed_at` NULL on every one of the 64.**

| time | kind | title | user dash | admin dash | email row |
|---|---|---|---|---|---|
| 16:36:46 | `request_new` | New inquiry from Walk1 WALKTEST | — | ✅ (link `/app/ops/intake`) | NULL ×2 |
| 16:48–16:49 | `party_signed` ×4 | *"<doc> — fully executed; signed by Walk1 WALKTEST (CLIENT)"* | — | ✅ | NULL |
| 16:58:58 | `payment_reported` | *"…paid Evaluation Lesson by Zelle (ref WALK1-ZELLE-TEST) — not yet confirmed"* | ❌ | ✅ | NULL ×2 |
| 17:00:24 | `request_new` | New inquiry from Walk1 WALKTEST | — | ✅ | NULL ×2 |
| 17:01:02 | `payment_reported` | *"…paid 1x Weekly Lesson in cash — not yet confirmed"* | ❌ | ✅ | NULL ×2 |
| 17:01:59 | `booking_time_requested` | *"A client claimed Aug 16, 08:00 AM"* | ❌ | ✅ | NULL ×2 |

**Channel 1 — the user's dashboard** shows only two soft suggestions: *"1 pending request —
awaiting confirmation from our team"* and *"Book your next lesson — Paperwork done — pick a time
that suits you."* **Neither payment declaration appears anywhere on the user's own dashboard.**
The client has no on-screen record that they told the barn they paid. The second card invites them
into the `NO_CREDITS` dead end.

**Channel 2 — the admin dashboard** is the one that works. Both claims are there, correctly worded
and correctly marked *not yet confirmed*, alongside the phantom booking claim.

**Channel 3 — email.** Every row above has `emailed_at` NULL.

### Messages the owner should look for in his inbox (he is the verifier)

| # | expected message | to | fired at | evidence |
|---|---|---|---|---|
| 1 | inquiry copy — Evaluation Lesson $170 | `cjzigs+walk1-202608201634@icloud.com` | 16:36:46 | `api/inquiry-confirmation` **200** |
| 2 | new-inquiry notice — Walk1 WALKTEST | `admin@` / `hello@fhequestrian.com` | 16:36:46 | `api/request-received` **200** |
| 3 | **activation email** for `/sign/rider` | `cjzigs+walk1-…@icloud.com` | 16:38:35 | `api/sign-start` **200**; UI said *"on its way"* |
| 4 | executed-document copies ×4 | `cjzigs+walk1-…@icloud.com` | 16:48–16:49 | UI: *"Your emailed copies are on their way."* |
| 5 | inquiry copy — 1x Weekly Lesson $460 | `cjzigs+walk1-…@icloud.com` | 17:00:24 | `api/inquiry-confirmation` **200** |
| 6 | new-inquiry notice ×2 | `admin@` / `hello@` | 17:00:24 | `api/request-received` **200** |

**Message 3 is the decisive one.** I never needed it — the activation link was rebuilt from
`invitations.token` per §2 — so its arrival or absence is a clean, uncontaminated test of whether
this system can send mail to a real person.

---

## §F — payment: Zelle and cash, both exercised, both left unconfirmed

**No card was ever submitted. No card option was ever offered on any payment surface** — onboarding
step 4, `/order/<id>`, and the app checkout all present Zelle and cash only. **The owner's "Stripe
is out" ruling is correctly implemented in the UI.**

| purchase | offering | amount | method declared | `client_claim_status` | `payment_status` | `paid_at` |
|---|---|---|---|---|---|---|
| **PUR-000238** | Evaluation Lesson | $170.00 | **Zelle**, ref `WALK1-ZELLE-TEST` | `pending` | `pending` | NULL |
| **PUR-000245** | 1x Weekly Lesson | $460.00 | **cash** | `pending` | `unpaid` | NULL |

**Both are unconfirmed and waiting for WALK2.** Zelle showed a proper memo code
(`FRENCHHERITAGEEQUESTRIAN-61BC3D`), the payee address, and the exact amount.

⚠️ **But the contract the client signs contradicts the ruling.** *Company Policies*, §2 PAYMENT
METHODS, which every new client executes during onboarding, reads: *"COMPANY accepts payment by
Zelle and by credit card… Credit card payments are processed through Stripe and are subject to a
processing fee."* **Stripe is not configured.** The UI is right; the executed legal document
promises a payment method that does not exist.

Two asymmetries worth noting: the Zelle path fired `finalize_purchase_payment` **and**
`report_my_payment`; the cash path fired only `report_my_payment`. And PUR-000238 moved to
`awaiting_payment`/`pending` while PUR-000245 stayed `draft`/`unpaid`.

---

## Flagged, not fixed

Ranked. No application code was changed (§5).

| # | finding | where |
|---|---|---|
| **F-1** | **Booking is gated on payment confirmation** despite two UI promises that it is not — §3.3's acceptance test fails | `G2` |
| **F-2** | **`NO_CREDITS` raw token shown to the customer**; no in-place purchase, no catalog deflection | `C3`, `G2` |
| **F-3** | **Recurring purchase mints nothing**, and **`pg_cron` is not installed** (`cron.job` missing) | DB |
| **F-4** | **Failed booking still notifies staff** — `booking_time_requested` fired with **0 `bookings` rows** | admin dash |
| **F-5** | **In-app catalog checkout is broken: `403` on `POST /rest/v1/purchases`**, surfaced as *"Something went wrong starting your order."* A logged-in member cannot buy from the catalog at all | `D8` |
| **F-6** | **Executed *Company Policies* promises Stripe card payments**; Stripe is out and unconfigured | signed doc |
| **F-7** | **`emailed_at` NULL on all 64 notifications** while send endpoints return 200 — the two halves disagree | DB |
| **F-8** | **Recurring order page states no entitlement** — no lesson count, period, expiry or renewal terms before purchase | `F2` |
| **F-9** | **Public `/lessons` strips "(With your horse)"** — shows "Single Lesson" twice at two prices | `A2` |
| **F-10** | **Payment declarations never appear on the user's own dashboard** | `I1` |
| **F-11** | **Onboarding wizard restarts at step 1 on reload** (values persist, position does not) | `B9` |
| **F-12** | **All routes redirect to `/app/onboarding`** while the full nav still advertises them | `B6` |
| **F-13** | **SIGN is inert until an unlabelled ack checkbox + typed name are filled** — no hint why | `B11` |
| **F-14** | **Activation password fields render `type=text`** — the password is visible as typed | `B3` |
| **F-15** | **`rpc/my_property_term` returns 404** on every authenticated page load | all |
| **F-16** | **React hydration errors #418 and #423 on every page**, public and authenticated | all |
| **F-17** | **Riding experience is required but not marked `*`** — submission fails with no prior signal | `A6` |
| **F-18** | **Calendar opens on a past week** (Aug 16–17 offered as bookable on Aug 20) | `C1` |
| **F-19** | **Repeated onboarding passes duplicate draft documents** — 12 DRAFT rows beside 4 EXECUTED. *Caveat: I ran the wizard several times; a normal user would not* | DB |
| **F-20** | **Cart does not survive a page load** — checkout empties to *"Your inquiry is empty"* | `D5` |

---

## Stops and deviations

**No stop condition was hit.** No card payment was ever the only option; no real client's record
was written; no verification-code screen appeared (consistent with §2's note that no MFA factor is
enrolled).

⚠️ **One deviation, self-reported.** At step D6 a generic "find the next button" matcher I wrote
matched **"Sign out"**, logged the WALKTEST session out, then matched **"Continue with Google"**
and navigated to Google's OAuth identifier page — which §2 forbids. **No credentials were entered,
nothing was submitted, and no Google account was touched**; the script had no further match and
ended on the identifier screen. I then added a hard denylist (`sign out`, `log out`, `continue
with google`, `google`) to the click helper so no matcher can reach those controls, and
re-authenticated WALKTEST through the email/password path. **The forbidden screen was reached by
accident and the guard now makes it unreachable, but it happened and it is recorded.**

**Not reached:** §C.2 (booking with credits) — blocked by design, see §C above.

---

## Teardown

**Browser processes: none left running.** Every Playwright script closed its browser; final census
found no `chromium`, `headless_shell` or Playwright processes. Google Chrome instances present are
the owner's own.

**Dev processes started by this thread: none.** No dev server was run. `psql` sessions were
one-shot and exited. The stray `vitest` from an earlier session (PID 50025) is gone.

| process | owner | disposition |
|---|---|---|
| Playwright / Chromium / headless_shell | this thread | **none running** |
| `psql` | this thread | **none running** — one-shot per query |
| Google Chrome | the owner | left running |
| `claude` CLI sessions | parallel threads | left running |

**Tooling** (§2): Playwright 1.62.1 + Chromium 151.0.7922.34, installed **worktree-local** in
`wt-walk1/walk1-tooling/` via `npm install --no-save`, with a `.gitignore` containing `*` so it
self-ignores. **The repo's `package.json` is untouched** — nothing deploys to Vercel from it.
Browser binaries live in `~/Library/Caches/ms-playwright`.

**Credential hygiene.** No credential appears in this report, in any commit, or in any screenshot.
`FHE_ADMIN_PASSWORD` was read from `.env.test` into a process variable and never printed. The
`invitations.token` was written to a gitignored file and passed to the browser without being
echoed. The WALKTEST password was generated locally and stored gitignored. **40 screenshots were
reviewed before commit; none contains third-party personal data** — the admin dashboard shot was
taken on the payments-review page (queue empty), and the community feed shows only *"French
Heritage Equestrian posted"* and *"Member posted"*, no member names.

---

## What WALK2 inherits

1. **Two unconfirmed claims waiting to be confirmed** — PUR-000238 (Zelle, ref `WALK1-ZELLE-TEST`)
   and PUR-000245 (cash). Both on the admin dashboard now.
2. **Confirming PUR-000238 answers §C.2** — it is the only way to find out whether credits mint on
   confirmation and whether booking then works.
3. **Confirming PUR-000245 answers the recurring question properly** — whether a $460/mo
   membership mints its first month on confirmation, or genuinely waits for a cron that this
   database has no scheduler for.
4. **A phantom `booking_time_requested` to triage** — it names a claim with no booking behind it.
