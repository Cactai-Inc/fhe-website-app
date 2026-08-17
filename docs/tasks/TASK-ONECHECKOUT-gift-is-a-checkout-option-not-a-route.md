# TASK ONECHECKOUT — gifting becomes an option inside checkout, not a separate route

**Owner, 2026-08-16, verbatim:**

> *"when they buy as a gift, do they go down a different route? it appears to me we have 3
> checkout routes right now; 1) booking page for riding lessons for the participant, 2) booking
> page for riding lessons for a gift, and 3) horse care/acquisition. we need to standardize and
> unify and make the gift option part of the checkout page, instead of having it be a separate
> route."*

# THE ANSWER TO THE OWNER'S QUESTION (measured, 2026-08-16)

**Yes — and it is worse than a different route. `/gift` is not a checkout at all.**

- `/gift` (`Gift.tsx`, 114 lines) renders a **contact form**. Its submit calls `requestGift`,
  which does one thing: `supabase.from('requests').insert(...)` with the gift details written as
  **free text in a `notes` field** — `"GIFT for <name> <email>"`.
- It never touches `createDraftOrder`, never creates a purchase, never creates purchase_items,
  and never reaches the checkout. **A gift buyer cannot pay.** Staff have to read the note and
  build the order by hand.
- The real checkout (`Checkout.tsx`) calls `submitRequest` + `createDraftOrder` — an actual
  purchase on the spine, with items, a total, and a payment path.

**So the count is not three checkouts. It is ONE checkout, plus a lead form wearing a gift
label.** The correction matters for scoping: this task is not "merge three flows", it is "make
gifting a real purchase, expressed as a choice inside the one checkout that exists."

**Also measured:** gift machinery already exists on the DB side — `gift_claim_link`,
`redeem_gift`, and D8's ruling that *"a gift purchase auto-creates the account through the single
spine (no manual provisioning) with order visibility, repurchase, community access."* **The
back end anticipated this; the front end never connected to it.**

# THE BUILD

## G1 — one checkout, with a "this is a gift" choice
- `Checkout.tsx` gains a gift toggle. Off (the default) is exactly today's flow — do not change
  it. On, the form additionally collects **recipient name**, **recipient email (optional)**, and
  **a message**.
- The order is created by the **same `createDraftOrder` path** as any other purchase. A gift is
  the same purchase with a recipient attached — **not a second write path** (D6: one spine).
- The buyer pays through the existing payment flow. **This is the thing that does not work
  today** and is the point of the task.

## G2 — the recipient is data, not a sentence in a notes field
- Recipient name/email/message become **real columns or a typed relation** on the purchase, not
  `notes` text. Anything downstream — the claim link, the account auto-creation, staff surfaces —
  needs to read them without parsing prose. **Establish where they belong and say why**;
  `gift_claim_link` / `redeem_gift` already exist and should tell you the expected shape.
- **D8 governs what happens next:** a gift purchase auto-creates the recipient's account through
  the single provisioning spine. **Wire to it; do not invent a parallel path.**

## G3 — retire `/gift` without breaking anything
- The entry points stay ("Buy as a gift" on the lessons page, and anywhere else that links there
  — **enumerate them**). They should lead into the unified flow.
- **`/gift` REDIRECTS, it is not deleted** — bookmarks and any printed/shared link must still
  land somewhere sensible, the same treatment `/shop` got on 2026-08-16.
- **The existing `requests`-based gift enquiries in prod are real leads.** Do not delete or
  migrate them without an owner ruling; report how many there are.

## G4 — say what happened to the three "routes"
The owner's mental model is three checkouts. Your report should state plainly what each actually
was and where it ended up:
1. rider funnel (`/lessons` → `/checkout`) — the real checkout,
2. `/gift` — a lead form, now folded in as an option,
3. `/horse` and `/acquisition` — the SAME checkout, reached from a different catalogue.
**If (3) turns out to diverge anywhere, that is a finding — report it.**

# TRAPS
- **`SESSIONBOOK` is also queued against `/lessons`** and changes what that page renders when
  signed in. Coordinate; do not both restructure the same funnel entry.
- **Do not build a second purchase path.** `createDraftOrder` is the one door.
- **Do not parse names out of `notes`.** That field is where this problem started.
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run and **prove the rollback**.
- **`REVOKE … FROM PUBLIC` does not remove a direct grant** — prove with `has_function_privilege()`;
  `anon` false on anything new.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths.**
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes). Not a green
  baseline — 46 pre-existing red files; diff against `main`.

# THE TEST THIS MUST PASS
1. A gift purchase creates a real purchase + purchase_items through `createDraftOrder` — prove
   the rows, and prove it is the same function a normal purchase uses.
2. **A gift buyer can complete payment.** Today they cannot; show that they now can.
3. Recipient details are structured data, readable without parsing text.
4. A non-gift checkout is byte-identical in behaviour to today — prove nothing regressed.
5. `/gift` redirects; every inbound link is enumerated and repointed.
6. Existing `requests`-based gift leads are untouched, and counted in the report.
7. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

# OWNER QUESTIONS — ask, do not guess
1. Can a gift be bought for something requiring a horse (own-horse lessons, horse care), or is
   gifting limited to services the recipient can use without one?
2. Does the recipient get the claim email immediately on purchase, or only once payment is
   confirmed? (Payment is Zelle/cash and confirmed by hand — so "immediately" means before you
   have the money.)

Report to `docs/reports/TASK-ONECHECKOUT-REPORT.md`. Do not push; the orchestrator merges.
