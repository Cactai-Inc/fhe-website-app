# THE OWNER'S END-TO-END TEST RUN — what he saw, 2026-08-12

**This is the owner's own walkthrough of the flow he cannot ship without.** Captured verbatim in
substance, because it is the only end-to-end observation anyone has made of this path.

**The setup:** he provisioned a **rider + horse owner** with **a purchase in each category** —
a riding lesson item, a horse exercise item, and a hair clipping item. Total **$1,000**. He then
claimed the invite, created the login, signed the documents, and added the horse.

> *"we can ignore the failures of the ui and flow for now and skip to the order, payment, and
> booking"* — **the UI/flow failures before the order are real and deferred, not absent.**

---

# WHAT HE OBSERVED

## Order and payment

1. **The order "sort of shows up."**
2. **The payment screen lists only the FIRST item but shows the TOTAL.** Three items, $1,000 —
   *"the order looked like i bought a $1000 riding lesson."*
3. **The memo is not generated when it is needed.** A memo is supposed to be produced for every
   order so the user can paste it into Zelle's memo field, **so the payment can be matched from
   the Zelle notification email.** The field instead says a memo *will be generated later* —
   **on the same screen that is requesting payment.**
4. **It says booking can happen after payment is confirmed. That is "completely inaccurate."**
5. **The calendar is never surfaced for the user to request bookings.**

## ⚠️ THE FLOW IS BACKWARDS — the owner's stated requirement

> *"it should have them select the bookings and then process payment as the last step."*

**Bookings are chosen first. Payment is last.** The built flow does the reverse and then tells
the user booking is gated on payment.

## Credits and the calendar

6. **The account shows the items as credits accurately.** *(The one thing that worked.)*
7. **Booking auto-selected what it was booking for by chronological order of the order summary**
   — not by what the user chose.
8. **Every booking entered the calendar as the same kind (a lesson)**, regardless of category.
9. **Credits were consumed in chronological order**, so three bookings consumed one credit from
   each of the three categories.
10. **The booking shows as BOOKED, not as REQUESTED and PENDING.**
11. **Nothing surfaced on the company side** to review, confirm, reject, or propose an
    alternative.
12. **The credit counts were wrong** — the price paid clearly covered items with multiple units,
    but the credits did not reflect that.

## Payment monitoring

13. **Nothing prompted him to look for the payment.**
14. **The Zelle-notification monitoring is not built**, so no company-side payment alert is
    possible.

---

# ⚠️ CROSS-REFERENCE: `TASK-BOOKWRITE` (merged 2026-08-12) FIXED PART OF THIS

**Items 7 and 9 are the defect BOOKWRITE found and repaired**, and the investigation must
establish whether the owner's run predates the fix:

> `consume_unit_for_booking` took the **lowest-seq open unit of the purchase, whatever it was
> for.** On live order PUR-000059 a **Single Lesson booking claimed the Single Class unit.**
> The claim now prefers a unit whose `purchase_item.offering_id` matches the booking's offering.

**Do not assume it is fixed. Do not assume it is not. Re-run the scenario.**

BOOKWRITE also found the manual ledger this flow forced on the owner: **15 of 39 real bookings
carry a hand-typed punch-card count in the notes field** — `Melanie 3/8`, `Maddie 6/8` — *"the
fulfillment ledger, being maintained by hand in a free-text field, next to an automated ledger
that had never been consumed."*

---

# THE ONBOARDING FLOW REQUIREMENT

**One unified flow with exactly two initiation points:**

1. **Admin-initiated** — the owner provisions someone manually.
2. **User-initiated** — the kiosk flow.

> *"the kiosk flow which i havent used and dont know whether the requirements and requests and
> specs i laid out for it have been authored, implemented, shelved, or worse…forgotten."*

**Establishing which of those four is true is part of the investigation.**

---

# THE IN-APP INBOX — the owner's clarification

> *"I didnt intend for the inbox to be a full inbox. i thought of it as purely a window into my
> inbox so i can see what has arrived. most emails are notices and alerts and they are there just
> for awareness or confirmation. for any of those that the system can take further action on, the
> inbox is useful and my visiblity of it inside the app gives me audit and triage power id need
> to open my email client to for."*

**So: a READ-ONLY window on what arrived, with an action affordance where the system can act on
it.** Not compose, not reply, not threading, not folders.

**This supersedes the orchestrator's "build ingestion, not an inbox" framing** — the owner's
version is narrower than a mail client and broader than pure ingestion, and it is coherent:
awareness plus triage, without leaving the app.

**Deferred by the owner to after the compaction**, together with Zelle.
