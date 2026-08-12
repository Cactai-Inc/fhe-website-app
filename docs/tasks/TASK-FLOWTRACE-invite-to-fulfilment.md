# TASK FLOWTRACE — trace the flow from invitation to fulfilment and name every failure

**⚠️ THIS TASK FIXES NOTHING.** `git diff` must show `docs/` only. **The owner will review the
findings with the orchestrator before any repair is specced.** A thread that fixes something here
has destroyed the evidence of what the flow actually does.

**Read `docs/reference/OWNER-TEST-RUN-2026-08-12.md` first.** It is the owner's own walkthrough
and it is the reason this task exists.

---

# WHAT HE DID, AND WHAT HE SAW

He provisioned a **rider + horse owner** with **a purchase in each of three categories** — riding
lesson, horse exercise, hair clipping — **$1,000 total**. Claimed the invite, created a login,
signed the documents, added the horse. Then:

```
ORDER / PAYMENT
  · the order "sort of shows up"
  · the payment screen lists only the FIRST item but shows the TOTAL
      -> three items, $1,000, looked like "a $1000 riding lesson"
  · the memo says it "will generate later" — ON THE SCREEN REQUESTING PAYMENT
  · it claims booking happens after payment is confirmed  ("completely inaccurate")
  · the calendar is never surfaced so bookings can be requested

CREDITS
  · the account shows the items as credits ACCURATELY        <- the one thing that worked

CALENDAR / BOOKING
  · booking auto-selected its subject by CHRONOLOGICAL ORDER of the order summary
  · every booking entered the calendar as the SAME KIND (a lesson)
  · credits were consumed in chronological order — one from each of the three categories
  · the booking shows BOOKED, not REQUESTED / PENDING
  · NOTHING surfaced on the company side to confirm, reject, or propose an alternative
  · the credit counts were wrong — the price covered multi-unit items

PAYMENT
  · nothing prompted him to look for the payment
  · Zelle-notification monitoring is not built, so no company-side alert is possible
```

## ⚠️ THE REQUIREMENT THE FLOW INVERTS

> *"it should have them select the bookings and then process payment as the last step."*

**Bookings first. Payment last.** The built flow does the reverse **and** tells the user booking
is gated on payment. **Establish where that ordering is enforced and by what** — a route, a
component, a status check, or merely copy on a screen. **The distinction matters enormously for
what a repair costs.**

---

# WHAT TO TRACE — the whole path, in order

For each stage: **the routes, the components, the RPCs, the tables written, and what the user
sees.** Where it diverges from the owner's account, say so — his run was on 2026-08-12 and
several merges have landed since.

1. **Provisioning** — admin-initiated. `provision_client_invitation` and its three entry points.
2. **Invite claim → login → documents signed → horse added.** *(The owner deferred the UI/flow
   failures here — **note what you see, do not investigate deeply**.)*
3. **The order** — how it is created, what it holds, what renders it.
4. **The payment screen** — the item list, the total, the memo, the copy about booking.
5. **The memo** — **where is it generated, when, and why does the screen say "later"?** This is
   the key to Zelle matching and it is the sharpest single failure.
6. **Credits** — how `purchase_items` become `lesson_credits` and `fulfillment_units`, and
   whether **multi-unit items produce the right count**. Item 12.
7. **The calendar** — what a client can request, and **how the subject of a booking is chosen.**
8. **Booking state** — is it `booked` or `requested/pending`, and **is there a company-side
   review queue at all?**
9. **Consumption** — which unit a booking claims. **See the cross-reference below.**
10. **Payment confirmation** — what marks a purchase paid, what should alert the company, and
    what actually does.
11. **Fulfilment** — what happens after a booking is delivered.

## ⚠️ CROSS-REFERENCE `TASK-BOOKWRITE`, MERGED THE SAME DAY

BOOKWRITE found and repaired **exactly** the "wrong credit consumed" defect:

> `consume_unit_for_booking` took the **lowest-seq open unit of the purchase, whatever it was
> for** — a Single Lesson booking claimed the Single Class unit on live order PUR-000059. It now
> prefers a unit whose `purchase_item.offering_id` matches the booking's offering.

**Establish whether the owner's run predates that merge.** **Do not assume it is fixed. Do not
assume it is not.** Re-run the scenario against current `main` and report what happens now.

**Also relevant:** BOOKWRITE recorded that **15 of 39 real bookings carry a hand-typed punch-card
count in the notes field** (`Melanie 3/8`, `Maddie 6/8`) — a manual fulfilment ledger kept beside
an automated one that had never been consumed. **Check whether that is still necessary.**

---

# THE SECOND INITIATION POINT — the kiosk

**One unified flow, two initiation points: admin-manual and kiosk.**

> *"the kiosk flow which i havent used and dont know whether the requirements and requests and
> specs i laid out for it have been authored, implemented, shelved, or worse…forgotten."*

**Determine which of those four is true, with evidence.**

- Search `docs/` for kiosk specs, and `src/` for kiosk routes and components.
- **If specs exist, list what they required and what was built against each.**
- **If nothing exists, say so plainly** — that is a finding, not a gap in your search.
- **Report where the two initiation points diverge** and what a unified flow would have to
  reconcile.

**`RELEASE_GENERAL` gates physical visits and is described in D8 as "signed at visit,
kiosk-style"** — so some kiosk intent is already in the settled decisions. **Start there.**

---

# HOW TO REPORT

**One document. Ordered by the owner's journey, not by subsystem** — he will read it against his
own walkthrough, and a report organised by table will not map onto what he saw.

Per failure:

| field | content |
|---|---|
| **What he saw** | his words |
| **What actually happens** | the route, component, RPC, table |
| **Why** | the mechanism — not "it is broken" |
| **Is it still true?** | verified against current `main` and current production |
| **Cost to repair** | copy change · one component · a schema change · a redesign |
| **Blocks what** | which of his requirements it prevents |

**Separate the categories, because they cost wildly different things:**

- **COPY** — a screen says something untrue (e.g. "booking after payment is confirmed").
- **WIRING** — the data is right, the surface does not show it (e.g. one item, the whole total).
- **MISSING** — never built (e.g. the company-side booking review queue).
- **WRONG BY DESIGN** — built to do the opposite of the requirement (e.g. payment before
  booking).

**The owner needs to know which failures are one line and which are a rebuild.** That
distinction is the most valuable thing this report produces.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-flowtrace`, branch `task/flowtrace`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **CHANGE NO CODE.** `git diff` shows `docs/` only. **Not a copy fix, not a one-liner, nothing.**
- **Do not create test data in production** beyond what you can do inside
  `BEGIN; … ROLLBACK;`. **Do not send email to anyone.** **Do not touch Kit Garcin or Kylie
  Pinion** — one is the reserved acceptance case, the other a live prospect.
- **THE SIGNING FREEZE IS IN FORCE.** Trace the signing path; sign nothing.
- **61 EXECUTED documents are evidence.**
- **`test:db` has 203 failures remaining** — do not cite it as proof. Verify against production.
- **Read production for every claim.** `.env.db` line 1. A direct psql connection has NULL auth,
  so org-scoped RPCs legitimately return zero rows — **know the difference between "returns
  nothing because unauthenticated" and "returns nothing because broken."**
- No staff browser session exists and you will not be given one. **Much of this is a UI story**,
  so read the components and say plainly what is inferred from code versus proven from data.
  **Report every render as NOT VERIFIED.**
- **`TASK-FLAGHARVEST` is running and also changes no code.** No collision.

# THE TEST THIS MUST PASS

1. Every failure the owner listed is traced to a mechanism, or shown to be already fixed.
2. Each is categorised **COPY / WIRING / MISSING / WRONG BY DESIGN** with a repair cost.
3. The booking-before-payment inversion is located — **what enforces it, and is it structure or
   copy?**
4. The memo's generation point is found, and **why the payment screen says "later"** is
   explained.
5. Whether a company-side booking review queue exists **at all** is answered.
6. The kiosk's status is one of: **authored · implemented · shelved · never existed** — with
   evidence.
7. **`git diff` shows `docs/` only.**

Report to `docs/reports/TASK-FLOWTRACE-REPORT.md`.
