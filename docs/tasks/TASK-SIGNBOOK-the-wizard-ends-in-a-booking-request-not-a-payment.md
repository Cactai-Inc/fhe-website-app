# TASK-SIGNBOOK — the wizard ends in a booking REQUEST, not a payment

**Source:** CR-98 steps 3–10. **Authored by DSGN-2, 2026-09-01.**
**Standing requirements:** `docs/method/TASK-ROLE.md`.
**Must merge first:** `TASK-SIGNDOOR` (owns the `details` step) **and `TASK-LIFECYCLE`** (owns the
six-state machine this flow's `requested` state belongs to — building this without it recreates the
second state machine D18 exists to prevent).
⚠️ **Blocked on ASK-OWNER §A1 (docs-by-path vs the OFFERINGDOCS ruling) — see the DSGN-2 handoff.
ORCH: do not dispatch until that answer is back.**

## 1 · THE OWNER'S WORDS — steps 3–10 of the CR-98 flow, verbatim criteria
3. First page after auth: personal info, *"the MINIMUM the DOCUMENTS require, and WHICH documents is
   decided by the `/sign/*` path"*. 4. *"Then the documents to read and sign."* 5. *"Then select the
   offering."* 6. *"Then pick a day and time from the calendar."* 7. *"Then submit the booking
   request."* 8. Email: *"copies of every signed document, plus the order contents and the booking
   request in the body."* 9. *"They exit onto the app's overview modal over the community feed."*
10. Company side: *"a notification AND an email showing the order and the date/time selected."*

> *"if you find that the current implementation already does these things we need to investigate
> what is blocking a new visitor from signing up."*

## 2 · MEASURED (2026-09-01, main @ 475f1724 — re-run, don't trust)
- The wizard exists: `src/pages/app/Onboarding.tsx`, step machine at `:90`:
  `'order' | 'details' | 'horse' | 'shop' | 'sign' | 'payment' | 'slots' | 'done'` — **sign comes
  AFTER shop, and payment sits INSIDE the wizard before the calendar step.** The owner's order is
  details → **sign → shop → calendar → submit request**, with payment gone from the wizard entirely
  (it happens post-approval — TASK-REQCARDS).
- `AppOverviewModal` is imported there already (step 9's incumbent exists).
- WALK1 (2026-08-20) found booking gated on payment confirmation; BUYANDBOOK made the weekly
  membership a standing slot; LESSONREQUEST folded the agreed time into one act. Those are the
  parts; the ORDER of the parts is what changes.
- Delivery email spine exists (`DEALAUTO`, fixed 2026-08-22, Vercel cron confirmed running by AR1);
  the inbound alert spine exists (`submitRequest` — GIFTPATH routed the last bypass through it).

## 3 · THE INCUMBENT — convergence
`Onboarding.tsx` and its RPC spine (`my_onboarding_state`, `generateMyOnboardingDocuments`,
`createDraftOrder`, `signMyDocument`, `StandingSlotPicker`). **This is a RESEQUENCING of a built
wizard plus a new final act (submit-request), not a new flow.** Greenfield only where named: the
booking-request submission end-cap and the step-8 email bundle.

## 4 · WHY THIS IS ONE CHUNK AND NOT TWO
Steps 3–10 are one state machine walked by one person in one sitting — the wizard. Splitting (say)
"docs+offering" from "calendar+submit" would put the wizard's step order in two specs, and the two
would disagree within a week. The staff response (11–14) is a different actor on a different
surface — that IS a second chunk (TASK-REQCARDS).

## 5 · THE WORK
1. **Re-order the step machine** to: `details → horse (horse paths) → sign → shop → slots/time →
   submit → done`. `payment` leaves the wizard (its component, `OrderPayment`, is REUSED by
   TASK-REQCARDS — move, don't delete). `order` step remains only for the staff-provisioned
   already-paid entry (its original purpose) — path-gate it, don't strip it.
2. **Docs by path** (pending ASK-OWNER §A1): the doc set for step-4 signing derives from the
   `/sign/*` path's categories, not from a purchased offering — there is no order yet at signing time.
3. **The offering step builds a draft order** (`createDraftOrder` exists); **the calendar step
   captures the day/time** (one-off) or the weekly slot (recurring — `StandingSlotPicker`, the
   BUYANDBOOK shape).
4. **"Submit the booking request" is one act**: order + requested time become a `requested` booking
   in TASK-LIFECYCLE's machine, routed through the alert spine so staff hear about it (step 10:
   notification AND email, showing order + date/time).
5. **The step-8 email**: every signed document attached, order contents and booking request in the
   body. Reuse the delivery spine; one email, not four.
6. **Exit lands on `AppOverviewModal`** over the community feed (step 9 — verify, likely built).
7. **The blocker hunt** (owner's closing sentence): before changing anything, WALK the current
   funnel end-to-end as a fresh visitor in dev and record where it actually breaks today. STABILIZE
   fixed the activation/clients-row bug on 2026-08-22; prove it stayed fixed. The walk's findings go
   in the report even where this task doesn't fix them.

## 6 · THE TRAPS
1. ⚠️ **The second state machine.** `requested` here MUST be TASK-LIFECYCLE's `requested`. If
   LIFECYCLE hasn't merged, stop — do not stub your own status column. (D18; CR-99 names this trap
   from the staff side.)
2. ⚠️ **Payment removal is subtractive mid-flow** (NOSTRIP): the staff-provisioned pay-first
   onboarding (the page's original job, `:59`) must keep working. Gate by entry path; prove both
   entries in the test.
3. ⚠️ **Credits mint on payment, not on request** (CREDITFIX ×3, CREDITGRANT: the engine once gated
   on `status` not `payment_status`). A `requested` booking must mint NOTHING. Query the ledger in
   the test.
4. ⚠️ **An offering can carry doc requirements** (OFFERINGDOCS ruling) — if the step-5 offering
   needs a doc the step-4 path-set didn't include, the wizard must loop back to sign it, not skip
   it. This is the concrete edge behind ASK-OWNER §A1.
5. ⚠️ **No tenant timezone exists** (LESSONREQUEST finding) — the day/time captured must not shift
   when staff read it. Whatever LIFECYCLE decided about time display binds here.
6. ⚠️ **Silent RPC surface changes**: any `CREATE OR REPLACE` → remember DROP+CREATE resets ACLs and
   default privileges re-grant anon (BOOKS1 trap). Fresh functions need explicit REVOKE.

## 7 · OUT OF SCOPE
Everything staff-side (approve, suggest-time, mark-paid — TASK-REQCARDS). The payment modal.
The door (TASK-SIGNDOOR). Card styling. `deal`.

## 8 · THE REACH
The emailed activation link → auth → `/app/onboarding`. That is the only way a new visitor enters;
the staff-provisioned entry is the same page's other door and must still work.

## 9 · THE TELL
The wizard's last screen says the request was SENT — not that anything is paid or booked. The
overview modal opens over the feed. Their inbox holds the signed-docs bundle. Staff inbox + bell
holds the order and requested time. **Undo:** the request is a `requested` booking — staff decline
or the client withdraws; nothing money-shaped happened yet.

## 10 · THE TEST THIS MUST PASS *(numbered to the owner's steps)*
1. Fresh visitor from `/sign/rider`: after auth the steps run details → docs → offering → time →
   submit, in that order, with no payment step. *(3–7)*
2. The confirmation email arrives with every signed doc attached and order + booking in the body —
   one email. *(8)*
3. Exit lands on the overview modal over the feed. *(9)*
4. Staff get the notification AND the email with order + date/time. *(10)*
5. The created booking is `requested` in the LIFECYCLE machine — query it; and the credit ledger
   shows zero mint for it.
6. The staff-provisioned already-paid onboarding still completes (both doors proven).
7. The blocker-walk findings are in the report, each with what was observed.

## 11 · THE REPORT
`docs/reports/TASK-SIGNBOOK-REPORT.md`. Worktree from the first edit.

---

# ⚠️ REQUIRED READING ADDED 2026-09-01 BY ORCH6 — read these before you build

1. 🔒 **`CR-98` ASK-OWNER **A1** IS ANSWERED** in `/Users/cactai/Downloads/claude-code-repo/fhe-website-app/docs/reference/CHANGE-ORDER-LEDGER.md` — search `## CR-98 · A1`.
   **TWO DOORS: the `/sign/*` path decides the documents when there is NO order; the OFFERING
   decides them when there is one.** ⚠️ **AND ASSIGNMENT HAS TWO TRIGGERS, not two alternatives:
   activation-by-path, AND first-purchase-if-none-yet.** **A build that wires only the first
   leaves every manually-created client permanently paperless.** ⚠️ **It also dissolves the wizard
   loop-back question: an offering picked at step 5 carrying a document the path-set did not
   include assigns under the general first-purchase rule — no special case.**
2. **`TASK-SIGNDOOR` HAS MERGED** — `docs/reports/TASK-SIGNDOOR-REPORT.md` and its
   `-VERIFICATION.md`. ⚠️ **Its migration `20260901T1120` is applied to production, and the path
   now rides the INVITATION, not standing categories.** **Read that before assuming where the
   path lives.**
3. ⚠️ **THAT THREAD PROVED ONE OF ITS OWN SPEC'S TRAPS WRONG against production.** **Verify this
   spec's premises the same way — every number here is a hypothesis until you re-run it (D20).**
