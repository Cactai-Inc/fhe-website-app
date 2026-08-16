# TASK ONBOARD — one signup spine: /sign → email → activate → onboard → account → order → pay → book

**SUPERSEDES `TASK-FUNNELDOORS`.** That task proposed adding links to the existing funnels. The
owner has since specified the whole path end to end and it is a **refactor into one flow**, not
a linking exercise. Do not run FUNNELDOORS; its findings are folded in below.

**Owner, 2026-08-15, verbatim — this is the spec. Quote it back before deviating:**

> *"the /sign url opens to a page with options for what a person is signing for. they pick the
> right one (based on what we tell them) and then they see an input form that captures first and
> last name, phone, email. they click continue and they see a screen that renders the actual
> email sending state with outcome, on successful send it prints a message to them that instructs
> them to go to their email find the email we sent them and click the link to activate their
> account, and also prints a note saying if they dont see the email to check spam, and below that
> is a link they can click if they never received it and it notifies us, that link being clicked
> prints a confirmation that customer support was notified and will reach out to them. When that
> link is clicked i need to receive an in app dashboard notice and an email telling me what
> happened, hopefully an error code for the email not sending or something."*
>
> *"when they open the email and click the link their browser opens and loads the page with the
> google button or create a password input based on what email address they used. they do that and
> they are in the onboarding flow for the button they picked (guest, rider, rider + horse owner,
> horse owner, deal party). from there once the last document is signed … it sends ONE email with
> all the signed documents as a pdf in rich text form and professional looking."*
>
> *"after the sent signed copies confirmation page is shown, the user is taken to a page where they
> see their account. they see their dashboard the onboarding modal and they have a notice to
> complete their profile which when clicked takes them to the profile page … then they can go to
> the community feed."*
>
> *"once the account is activated we can go in and add their order with their purchased items or
> the items they want to purchase and then they will see that as a notice on their dashboard for
> them to click on, review, and then see the payment screen. since we are using zelle there isnt
> really anything we can do to know they made the payment until we get a payment email from zelle,
> so we just show them the payment information screen so they have what they need to send us the
> payment and they can insert a payment confirmation number when they click the button to confirm
> they made the payment to us but if they leave it blank thats ok. we see they said they made
> payment and we can monitor for it alongside the automated monitoring system we still need to
> build. if they pay cash they need to be able to have an option on the payment page to click a
> button for that so its marked paid by cash."*
>
> *"either way, they then go to the booking calendar where they see the available credits for the
> items they purchased and they see the open slots and they can click on a slot, then select what
> they are requesting that slot for from the items they purchased and then submit to us for
> confirmation and until that is confirmed by us it stays pending and its fully editable by the
> user until its confirmed, once its confirmed its editable up to 48hrs prior to the booking and
> the same process plays out if they want to make a change within the 48hrs we have a fee schedule
> and the booking doesnt submit to us until they confirm they made the payment with zelle or say
> they will pay cash."*

**⚠️ ONE INPUT IS MISSING AND THE OWNER IS GETTING IT: the fee schedule.** See §7. Build
everything else; leave the fee amounts data-driven and do not invent numbers.

---

# WHAT ALREADY EXISTS (measured on prod + main, 2026-08-15 — verify, then REUSE)

**Most of this is built. This task is mostly rewiring, not greenfield. Do not build a second
anything.**

| piece | what exists | where |
|---|---|---|
| the four funnels | `/sign/:path` → `SignStart.tsx`, live, routed, **email-only, no name/phone** | `App.tsx:170` |
| its server half | `/api/sign-start` → rate-limits, then calls `provision_client_invitation` — the SAME spine the admin invite uses | `api/sign-start.ts` |
| visit-day kiosk | `/release` → `Release.tsx`, 4-stage flow, hardened `/api/sign-release` | `App.tsx:200` |
| **inbound links to either** | **ZERO.** The only `/release` link is inside `/release`'s own error branch | verified |
| activation | invitation → activate → password/Google | existing invitation lifecycle |
| onboarding wizard | 5-step, per-category documents | `Onboarding.tsx` |
| doc delivery | `api/deliver-documents.ts` **already batches**: `allAttachments` = every PDF in ONE email, plus a company copy | `api/deliver-documents.ts:161` |
| DOCPACKET | collapsed the six onboarding docs into one packet row | `docs/reports/TASK-DOCPACKET-REPORT.md` |
| payment screen | Zelle instructions + memo generation, fixed by PAYLOCK | `OrderPayment.tsx` |
| cash | `PaymentMethod = 'zelle' \| 'stripe' \| 'cash'` **already in the type**; BOOKLINK added staff-side cash marking | `types.ts:23` |
| pending bookings | `bookings_status_check` **already permits `pending`** | verified in prod |
| booking requests | `request_booking_change` / `decide_booking_change` / `booking_change_requests` | prod |
| **48-hour rule + fee** | **`reschedule_fee(org, start)` EXISTS**: returns `calendar_settings.reschedule_fee` when `start - now() < 48h`, else 0. **Currently 0.00.** Single flat amount — NOT a tiered schedule | prod |
| fee payment marking | `mark_change_fee_paid`, `pending_fee_candidates` | prod |

**The owner's report that Claire received each document as a SEPARATE email** contradicts
`deliver-documents.ts` batching them. **Establish which path her signing actually took** — there
are several senders (`deliver-document.ts` singular, `deliver-my-document.ts`, `delivery-sweep.ts`)
and the onboarding flow may call the wrong one, or call the singular one in a loop. **Find the
actual call site before changing anything.** This is §4's core bug.

# THE BUILD

## 1 — `/sign` becomes a chooser
- `/sign` (no path) currently does not exist — only `/sign/:path`. Add the chooser page: **four**
  options, each explained in the owner's words so a visitor can self-identify: **guest · rider ·
  rider + horse owner · horse owner**.
- **"Deal party" is NOT one of the chooser options** (owner ruling 2026-08-15: *"fine dont include
  deal party"*). It is a different entry shape — see §1b.
- Existing `/sign/:path` deep links keep working — they skip the chooser.

## 1b — the contract counterparty who has no account yet

**Owner, 2026-08-15:** *"they need to be able to be added to a contract before they have an
account and then need to be able to sign a contract and create an account in one step. so this
would be a path for them to do that if they need it."*

**MEASURED — most of this exists; establish what is actually missing before building:**
- **A party without an account is already normal**: 50 of 131 `document_parties` rows have no
  linked account. Being added to a contract pre-account already works.
- **`/api/contract-invite` already exists**: staff-only, calls `invite_contract_counterparty`,
  emails a branded register link carrying a token; the register flow redeems it via
  `redeem_contract_invitation` **and lands the counterparty on the contract**. That is the
  sign-and-create-account-in-one-step path, already built.
- **`record_signature` does not hard-require auth** (no `auth.uid() IS NULL` guard).

**So the likely gap is reachability and sequence, not capability — the same story as the funnels.**
Determine and report: (a) can staff actually trigger `/api/contract-invite` from a screen, or is
it another built-but-unreachable endpoint; (b) does the counterparty land on the contract *and*
get a real account, or only one of the two; (c) is the account they get in the right shape (the
one spine, D5). **Fix the gap you find. Do not rebuild the invite path that exists.**

## 2 — capture first name, last name, phone, email
- Today `SignStart` is deliberately email-only ("no name capture … captured at first-login
  intake"). **The owner has overridden that.** Capture all four; pass them through
  `provision_client_invitation` so the invitation and contact carry the real name from the start.
- Keep the existing rate-limiting and the "same response regardless" anti-enumeration behavior.

## 3 — the send-state screen, and the "I never got it" escape hatch
- After Continue: a screen that **renders the actual send state and outcome** — not an optimistic
  "check your email". On success: the go-check-your-email instruction, the spam note, and below
  it a link for "I never received it".
- **That link fires a support alert**, and the user sees a confirmation that support was notified.
- **The owner gets BOTH an in-app dashboard notice AND an email**, carrying whatever diagnostic
  exists — the send outcome, provider error code, invitation id, the email address.
  **`request_alert_sends` and the notification spine are the model — one row per attempt,
  provable.** (LESSONS.md: fire-and-forget + best-effort-200 is how two real leads were lost.)

## 4 — ONE email with ALL signed documents (the bug the owner hit)
- After the last document is signed, exactly one email goes out with every signed PDF attached,
  **rich text, professional**. Not one email per document.
- **Diagnose first** (see the note above): find which sender the onboarding completion actually
  calls. `deliver-documents.ts` already batches — if the flow calls a singular sender in a loop,
  the fix is the call site, not the sender.

## 5 — account landing, profile nudge, feed
- After the signed-copies confirmation: land on the account/dashboard with the onboarding modal,
  plus a **"complete your profile" notice** linking to the profile page. Community feed reachable
  from there. Reuse the existing dashboard notice mechanism.

## 6 — order → dashboard notice → payment screen
- Staff add the order after activation (BOOKLINK made this real). The client sees it as a
  **dashboard notice** → review → payment screen.
- Zelle: show the payment information they need. **A "I sent the payment" button with an OPTIONAL
  confirmation number** (blank is fine) marks it client-reported-paid for staff monitoring —
  this is NOT payment confirmation, and must not be presented to staff as one.
- **Cash: a button on the payment page marks it paid by cash.** The type already supports it.
- Both write the same provable trail (`status_events` / `receipt_sends`). One payment spine.

## 7 — booking: credits, slots, subject picker, pending, edit windows, change fee
- The calendar shows **available credits from purchased items** and the open slots.
- Click a slot → **pick which purchased item this booking is against** (the `offeringId`
  parameter already exists end-to-end and the call site never passes it — FLOWTRACE §9).
- Submit → **`pending`** until staff confirm. **Fully client-editable while pending.**
- Once confirmed: client-editable **up to 48h before**. Inside 48h, a change runs the same
  request flow **and incurs the change fee**.
- **The fee gate**: a change requiring a fee **does not submit until the client confirms they
  paid by Zelle or chose cash** — same affordances as §6.
- **⚠️ REUSE `reschedule_fee()` — the 48h boundary is already implemented there.** It currently
  returns a single flat `calendar_settings.reschedule_fee`, set to **0.00**.
  **THE OWNER IS SUPPLYING A TIERED FEE SCHEDULE AND TIMEFRAME BREAKDOWN.** Until it arrives:
  build the mechanism to read a schedule from data (not hardcoded numbers), keep the existing
  flat-fee behavior working, and **state clearly in your report exactly where the schedule
  plugs in** so it is a data change, not a code change (D13).

# TRAPS
- **One spine.** `provision_client_invitation` is the only account-creation path (D5). Do not
  add a second. Do not build a second document sender, payment path, or booking writer.
- **The staff-side of §6/§7 is BOOKLINK's and REVIEWQ's.** REVIEWQ owns the company
  confirm/decline/propose queue and the hard-delete fix. **Coordinate; do not duplicate.**
  If REVIEWQ has not run, build the client half against `pending` and say so.
- **Do not touch** `ContractPage.tsx`, `ClauseDocument.tsx`, `AddElementModal.tsx`,
  `PartyControlsCard.tsx` — a concurrent thread owns them. Report diffs you need.
- Migrations: **never** contain `BEGIN`/`COMMIT`; dry-run and PROVE the rollback (a thread
  committed to prod believing it was dry-running, twice).
- **`REVOKE … FROM PUBLIC` does not remove a direct grant** — prove with
  `has_function_privilege()`. This bit again on 2026-08-15.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- Records absorbed Lessons/Documents/Files/Deals as tabs; the Review nav group is gone. Rebase.

# THE TEST THIS MUST PASS
1. A stranger reaches `/sign`, picks an option, enters name/phone/email, and sees a real send
   outcome — not an optimistic message.
2. Clicking "I never received it" produces a support alert with a diagnostic, **an owner dashboard
   notice AND an owner email**, both proven by query, plus a user-facing confirmation.
3. Activation → the right onboarding flow for the chosen option.
3b. A contract counterparty with no account can be invited from a real staff screen, signs, and ends up with an account through the one spine — or the specific gap is named with evidence.
4. Completing onboarding sends **exactly one** email containing **every** signed document —
   prove the count (one send row, N attachments), and name the call site that used to be wrong.
5. The user lands on their account with the onboarding modal and a profile-completion notice.
6. An order appears as a dashboard notice → payment screen shows Zelle details, accepts an
   optional confirmation number, and offers a cash button; both write a provable trail.
7. A client books a slot against a chosen purchased item; it is `pending` and fully editable;
   after confirmation it is editable until 48h before; inside 48h the change flow demands the
   fee and does not submit until payment is confirmed or cash is chosen.
8. Every DB claim is query output. Every render claim is **NOT VERIFIED** with a numbered
   owner checklist.

Report to `docs/reports/TASK-ONBOARD-REPORT.md`. Do not push; the orchestrator merges.
