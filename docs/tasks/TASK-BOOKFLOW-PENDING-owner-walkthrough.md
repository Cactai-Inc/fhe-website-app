# TASK BOOKFLOW — booking and order-view errors from the Claire walkthrough

**PLACEHOLDER, 2026-08-10. Detail not yet sent.** The owner flagged the area so it would not be
lost if he forgot. **Do not start this.**

> *"i want to send you some more issues i saw today when i went through the new client invite
> and onboarding flow with claire as a horse owner and rider… its related to the calendar and
> booking of things purchased, and the order view and what admin sees when the client selects
> booking slots, as well as what the client sees. there are big errors in those features that
> need to be addressed before i can turn this over to clients to use."*

## Why this outranks most of the queue once the detail lands

**It is a launch blocker in his own words** — *"before i can turn this over to clients to use."*

**And it was found by walking the real flow**, not reading code: a new client invite plus
onboarding, with Claire as **both horse owner and rider** — the dual-category case, which is the
same shape that surfaced the affiliation wipe earlier the same day.

## Named surfaces

- the **calendar**
- **booking of things already purchased** — the purchase-to-booking path
- the **order view**
- **what ADMIN sees when a client selects booking slots**
- **what the CLIENT sees** — named separately, so the two views may disagree

**That last pair is the shape to expect.** An admin view and a client view of the same booking
that do not agree is exactly `WALLSYNC`'s shape, and that one locked a client out of her account.

## Known context — do not re-derive

- **`fulfillment_units` is nearly empty** — 12 rows. `ADMINSWEEP` flagged that generation may
  not be firing at all. **Establish whether it fires before concluding anything about booking
  behaviour**: a view over an empty ledger looks broken rather than empty, and the new page gets
  blamed.
- **`bookings` holds 321 rows** — 39 scheduled, 282 open slots. The calendar has real data even
  where the commerce spine does not.
- **`purchases` = 2, `purchase_items` = 6.** Almost nothing has been bought through the app, so
  the purchase-to-booking path is close to untravelled — which is consistent with big errors
  surviving in it unnoticed.
- The signing freeze (`docs/reference/SIGNING-FREEZE.md`) does not restrict booking work.

## When the detail arrives

**Spec it properly rather than folding it into an existing thread.** It spans the calendar, the
order view and two different viewers — wider than any current thread's file ownership.
