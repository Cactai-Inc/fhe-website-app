# TASK GIFTPATH — every gift is a conversation, not a self-serve purchase

**RUN WITH: Sonnet 5 · thinking ON · effort MEDIUM — after `CAREPATH` merges** (CAREPATH
restructures `/horse` and `/acquisition`, the pages where P1 adds the gift links).

**This SUPERSEDES the earlier ONECHECKOUT plan** (folding gifting into `Checkout.tsx`). That is
no longer the design. **Do not build a gift checkout.**

**Owner, 2026-08-16, in order:**

> *"we need to standardize and unify and make the gift option part of the checkout page, instead
> of having it be a separate route."*

then, on reflection:

> *"Maybe we just use the gift path for all gifts, that contact form is a better way to handle it
> than letting them try to buy online."*

and the reason, which is the ruling:

> **"no i want the chance to talk to a person buying a gift."**

**Gifts are deliberately NOT self-serve.** A gift buyer is usually a stranger to the business,
buying for someone who is not. The owner wants that conversation — it is the point, not friction
to be engineered away.

# WHAT WAS MEASURED (2026-08-16 — verify, then build)

- **`/gift` (`Gift.tsx`) is already a contact form**, not a checkout. Its submit calls
  `requestGift`, which inserts one row into `requests`; it never creates a purchase and never
  reaches payment. **What looked like a broken checkout turns out to be the correct design for
  this ruling** — the work is to make it reachable and reliable, not to replace it.
- **Exactly ONE inbound link exists:** `Lessons.tsx:255` → `/gift?item=lessons`.
- **Prod holds ZERO gift enquiries** (`requests where notes like 'GIFT%'`). Nothing is stranded.
- `Checkout.tsx` is **untouched by this task**.

# THE BUILD — small, mostly reach and reliability

## P1 — reachable from everywhere a gift makes sense
- Only the lessons page links to it today. Add the same entry to **horse care** (`/horse`) and
  **find a horse** (`/acquisition`), and consider the footer.
- **The owner's wording:** *"Gift our services to the horse lover in your life."*
- Carry context through as the existing link does (`?item=lessons`), so the form arrives pre-set
  to whatever the buyer was looking at.

## P2 — collect enough to start a good conversation, and no more
Existing fields: buyer name, buyer email, recipient name, recipient email, message. **Ask the
owner before adding any** (see the question at the end) — a long form defeats the purpose as
surely as a checkout would. Candidates worth putting to him:
- **a phone number**, since the point is to talk;
- **when the occasion is**, which is softer and more useful than a delivery date;
- **what they have in mind** — a service, an amount, or "not sure yet".

## P3 — the enquiry provably reaches a human
**This is the part that must not be got wrong.** A gift enquiry that silently fails is a lost sale
from a stranger who will never follow up.
- It must produce a **staff alert — dashboard and email** — through the existing notification
  spine, with **one row per attempt** recording the outcome.
- ⚠️ **This exact bug has already happened here:** real inbound leads were dropped silently
  because the send was fire-and-forget behind a best-effort 200 (`orchestration/lessons/LESSONS.md`).
  **Prove the alert fires. Do not assume it.**
- The buyer must see a real confirmation reflecting what actually happened, not an optimistic one.

## P4 — record the ruling where a future thread will trip over it
- **No gift purchase exists in checkout, deliberately.** Put a short note in `Checkout.tsx`'s
  header comment so nobody "fixes" the missing gift toggle later.
- `gift_claim_link` / `redeem_gift` **already exist in the database** and stay — they are how a
  gift is redeemed once staff create the order by hand, and **D8 still governs the recipient's
  account auto-creation**. Report their state; do not modify or delete them.

# TRAPS
- **Do not build a gift checkout.** That is the plan this task replaces.
- **Do not delete `/gift` or `Gift.tsx`** — this task makes them the primary path, not a legacy one.
- **`SESSIONBOOK` is queued against `/lessons`**, where the gift link lives. Coordinate.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths.**
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes before reporting).
  Not a green baseline — 46 pre-existing red files; diff against `main`.

# THE TEST THIS MUST PASS
1. A gift enquiry can be started from lessons, horse care, and acquisition — name each click path.
2. Submitting one creates the `requests` row **and** produces a staff alert, with a provable
   per-attempt row showing its outcome. **Prove the alert fires.**
3. The buyer's confirmation reflects what actually happened.
4. Checkout is unchanged — prove no purchase path was touched.
5. `gift_claim_link` / `redeem_gift` are reported on, not modified.
6. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

# OWNER QUESTION — ask before building P2
Which fields does he actually want? The ruling is that he wants to talk to the buyer, so the form
should collect just enough to make that conversation good.

Report to `docs/reports/TASK-GIFTPATH-REPORT.md`. Do not push; the orchestrator merges.
