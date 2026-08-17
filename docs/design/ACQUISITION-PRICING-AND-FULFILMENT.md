# DESIGN RECORD — acquisition pricing and fulfilment

**Owner, 2026-08-16. This is a RECORD, not a build order.** Two pricing algorithms are the owner's
to design and **do not exist yet**. Nothing here is to be built except where marked **BUILDABLE NOW**.

---

# 1. THE THREE SERVICES PRICE DIFFERENTLY

## Horse Finder — flat fee, up front, win or lose
> *"we charge a fee for the finder service up front win or lose. we wil search for you for the flat
> fee and send you horses (specifics on how long or how many we send and pricing go hand in hand and
> that is going to be an algorithm i have not yet designed but it will be set staff side during the
> call so we can invoice them appropriately."*

- Paid **before** the work, and **not contingent on finding a horse**.
- **Duration and volume are coupled to price** — how long we search, how many horses we send.
- ⚠️ **The algorithm does not exist.** Staff set the number **on the call**.

## Horse Evaluation — finite scope, priced on location and count
> *"the evaluation is finite and we charge based on where the horse is, how many horses (3 at the
> same facility is cheaper than 3 purchased separately or 3 at different facilities spread
> throughout our service area)"*

- Drivers: **where the horse is**, and **how many horses** — with a **clustering discount**: three at
  one facility costs less than three scattered across the service area.
- **This is why "Where is the horse located?" is on the evaluation form** (`ASKRIGHT` §A4 Q1) — it is
  a pricing input, not an administrative detail.

## Acquisition Assistance — priced by scope, sold as a fixed fee
> *"acquisition assistance is priced based on if its transaction only or all 3 parts or only the
> latter 2… usually this involves a price dictated by % of the deal but that is a commission and
> since we dont handle the payment its hard to ensure we get paid on that so we will offer a fixed
> price for that too based on budget for the horse, again an algorithm i have not yet built."*

- Scope tiers: **transaction only**, **all three parts**, or **the latter two**.
- **A percentage commission is the industry norm and is being deliberately rejected** — the business
  does not handle the money, so a commission is hard to collect.
- **Sold instead as a FIXED FEE derived from the horse's budget.** ⚠️ **Algorithm not built.**
- **This is why the budget band is on the finder form** (`ASKRIGHT` Q6: `$2–5k · $5–7k · $7–10k ·
  $10k+ · Not sure`) — also a pricing input.

---

# 2. WHAT WAS MEASURED (2026-08-16 — verify before building anything)

| | state |
|---|---|
| quote-priced offerings | **exist and provision** — `20260816T2800_provision_handles_quote_priced_offerings.sql` coalesces a null price to 0 so they no longer crash |
| the public surface | renders **"Price on inquiry"** for them (`ServiceSelector`, `priceOnEnquiry`) |
| **staff setting a price** | ⚠️ **ONLY AT CATALOG LEVEL** — `AdminProductsPage` edits `offerings.price_amount`, which changes the price **for everyone**. **There is no per-order-line price entry.** |

**So a quote-priced acquisition order can be taken and provisioned, but there is nowhere to record
what this client was actually quoted.** It sits at 0.

---

# 3. BUILDABLE NOW — and it needs neither algorithm

**The algorithms decide *what number* to charge. The system's missing capability is *recording the
number staff chose* and invoicing it.** Those are independent, and the second is the blocker.

**Scope of that work:**
- **Set a price on an individual order line**, on the order — never by editing the catalog.
- **Applies to any quote-priced item**, not only acquisition.
- The order then totals and invoices normally: `draft` → `awaiting_payment` per `CAREPATH` §C5b.
- **Record who set it and when** — a quoted price is a commitment made by a person on a call.
- ⚠️ **Editing `offerings.price_amount` to price one client is a data-corruption bug**, not a
  workaround. The catalog price is the list price.

**This pairs naturally with `CAREPATH` §C5c's staff order tools** (split an order, hold it as a
draft) — same surface, same moment in the workflow, same person doing it.

---

# 4. STILL TO DESIGN — owner's, not a thread's

1. **The finder algorithm** — flat fee ↔ search duration ↔ number of horses sent.
2. **The assistance algorithm** — fixed fee derived from the horse's budget band and scope tier.
3. **Staff-side provisioning for acquisition orders** — what staff fill in when converting one of
   these inquiries.
4. **Post-sale fulfilment forms** — *"forms for the search, forms for the evaluation, etc."* These
   are the working documents the service actually runs on.
   ⚠️ **Related finding:** `form_definitions` already holds `INTAKE_HORSE_FINDER` and
   `INTAKE_HORSE_EVALUATION`, generated from the paper forms — **but nothing in the app renders
   them** (`ASKRIGHT` §A7). They may be the starting point rather than a blank page.

---

# 5. CONTRACTS — mostly done, never tested end to end

> *"contracts are mostly complete so we can handle that today, but we still need to test the contract
> flow from start to finish to make sure they are working properly."*

**Measured:** the DB suite already carries `contract_workflow.test.ts`, `e2e_contract.test.ts`,
`esign_hardening.test.ts`, `documents_signatures_deliveries.test.ts`, `contract_bodies*.test.ts`,
`contract_templates_tokens.test.ts`.

⚠️ **Existing tests are not the same as a proven flow** — and this project's own history is the
argument: `INBOUNDALERT` found a notification path with **zero real call sites**, and `PAYLOCK`'s
migration had never been applied to production. **Green unit tests have coexisted with a dead
feature here before.**

**What is actually wanted is a walked flow** — author → send → sign → execute → deliver, on real
data, reporting what breaks. **That is its own task and should be scheduled deliberately**, not
folded into a flow-program thread.

---

**Nothing in this document is scheduled.** §3 is the one piece ready to spec when the owner wants it;
§5 is a task waiting to be written.
