# TASK LESSONREQUEST — a lesson enquiry becomes a booked, paid first lesson

**Owner, 2026-08-16, verbatim — this is the flow:**

> *"for lessons, this is the most important place to collect information about the person, the same
> information used on the contact form should be collected from the person in step 2. the question
> is what should happen in step 3… so far every website visitor who submitted a form has converted
> to something. so i would say they submit a booking request with enough information that we can
> respond with a text or phone call and then an approval or reschedule the selected date and time
> to a new one agreed upon with them in the conversation and they get the activation link, then
> click it and go through the flow that ends with the payment page and they exit into the app with
> the overview modal and then they see their purchase and up coming schedule and then they can go
> wherever they want."*

**The principle, in his words:** *"every website visitor who submitted a form has converted to
something."* A lesson enquiry is not a lead to be scored — it is a customer who has already
decided. The software's job is to capture enough to have a real conversation, then get out of the
way until payment.

# THE FLOW, AS SPECIFIED

1. **Step 1 — choose** the lesson or package (exists today).
2. **Step 2 — tell us about you.** The same information the contact form collects.
3. **Step 3 — submit a booking request**, including the date/time they want.
4. **Staff respond by text or phone.** Then either approve the requested slot, or agree a new one
   in that conversation.
5. **The client gets an activation link**, clicks it, and runs the onboarding flow.
6. **That flow ends at the payment page.**
7. **They exit into the app** with the overview modal, see their purchase and their upcoming
   schedule, and go wherever they want.

# WHAT WAS MEASURED (2026-08-16 — verify, then build)

**Most of this chain exists. There is one clear break.**

| step | state |
|---|---|
| 2 — the information | **EXISTS.** `Checkout.tsx` already collects first/last name, email, phone, preferred contact method, riding experience, notes, and structured availability (`proposed_times`) |
| 3 — the request | **EXISTS.** `submitRequest` writes a `requests` row carrying `proposed_times` and `status` |
| 4 — approve / reschedule | **⚠️ THE BREAK.** `provision_client_invitation` takes `p_request_id`, so a request can become an account — but nothing takes the requested slot and turns it into a real booking, agreed or amended. `request_open_time` and `book_open_slot` exist for members booking inside the app, not for staff converting an enquiry |
| 5 — activation link | **EXISTS.** The invitation lifecycle, live |
| 6 — onboarding ending at payment | **EXISTS.** `ONBOARD` built this |
| 7 — app with overview modal | **EXISTS.** Landing, modal and profile notice all built by `ONBOARD` |

**So the work is step 4, plus making step 2 unmissable on the lesson path.**

# THE BUILD

## L1 — step 2 asks what the contact form asks
- The lesson path presents the same fields the contact form does, at step 2. **They already exist
  in `Checkout.tsx`** — the task is to make the rider path collect them deliberately rather than as
  a byproduct of checkout, and to make sure a signed-out lesson buyer cannot slip past them.
- **Coordinate with `RIDERQUALIFY` and `SESSIONBOOK`** — all three touch this page. A signed-in
  member must not be re-asked what is already on file.

## L2 — step 3 submits a booking REQUEST with a wanted time
- The request carries the date/time they want. `requests.proposed_times` is the existing column —
  **use it, do not add another.**
- Confirm to the visitor that a person will contact them. **Do not imply the slot is confirmed.**

## L3 — staff approve or amend, and a real booking results  ← THE MISSING PIECE
- A staff surface that shows the request with everything from step 2, and lets staff **approve the
  requested time, or set the agreed time from the phone call**.
- On approval it creates the actual booking, linked to the client — **through the existing writers
  (`REVIEWQ`'s decision path and `BOOKLINK`'s client+item linkage), never a new one.**
- The booking should land `pending` per `REVIEWQ`, and become confirmed on approval. **Establish
  the exact status transition and state it.**
- **Then issue the activation link** through `provision_client_invitation(p_request_id => …)`, which
  already accepts the request id. That is the seam this whole task turns on.

## L4 — the client's path after the link is already built
Verify end to end, do not rebuild: activation → onboarding → **payment page** → app with the
overview modal, purchase visible, upcoming schedule visible. **`ONBOARD` built all of it.** Report
any break you find rather than patching around it.

# TRAPS
- **Do not build a second booking writer, request store, or provisioning path.** Every one exists.
- **`proposed_times` is what the visitor WANTED, not what was agreed.** Do not overwrite it with
  the agreed time — keep the ask and the agreement distinguishable, or the phone conversation
  becomes unauditable.
- **A request is not a purchase.** Payment happens at step 6, after activation. Do not create a
  paid order at step 3.
- **`RIDERQUALIFY` and `SESSIONBOOK` both touch `/lessons`.** Sequence deliberately.
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run and **prove the rollback**.
- **`REVOKE … FROM PUBLIC` does not remove a direct grant** — prove with `has_function_privilege()`.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes). Not a green
  baseline — 46 pre-existing red files; diff against `main`.

# THE TEST THIS MUST PASS
1. A signed-out lesson buyer cannot reach step 3 without giving the step-2 information.
2. Submitting creates a `requests` row carrying the wanted date/time, and the visitor is told a
   person will be in touch — not that they are booked.
3. Staff can see the request in full and either approve the wanted slot or set an agreed one.
4. Approval produces a real booking linked to that client, through the existing writers — prove
   which functions ran.
5. The activation link issues from the same request, through `provision_client_invitation`.
6. Following it end to end reaches the payment page, then the app with the overview modal, the
   purchase, and the upcoming lesson — prove each, or report the break.
7. What was wanted and what was agreed are both still readable afterwards.
8. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

# OWNER QUESTION — ask before building L3
When staff change the time on the phone, should the client get an email confirming the agreed slot,
or is the phone call itself the confirmation? (The owner has said elsewhere he controls delivery
in person and does not want software enforcing what he handles by hand — this may be the same.)

Report to `docs/reports/TASK-LESSONREQUEST-REPORT.md`. Do not push; the orchestrator merges.
