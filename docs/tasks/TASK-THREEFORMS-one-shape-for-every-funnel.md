# TASK THREEFORMS — one shape for all three funnels, with a real confirmation at step 3

> ⚠️ **THE DATE-PICKER RULE BELOW IS WRONG.** Owner, 2026-08-16: **only the LESSONS funnel has a
> date picker.** Horse care does NOT — staff set the date on the call. Acquisition never did.
> Every table in this file that gives horse care a date/availability control is superseded by
> `TASK-ASKRIGHT` §A6b. **The act word is "inquire", not "request"** — see `ASKRIGHT` §A6.
>
> ⚠️ **SUPERSEDED FOR THE HORSE-CARE FUNNEL by `TASK-CAREPATH` (2026-08-16).** The owner reviewed
> horse care and specified that lane in full detail — four steps, a Continue Shopping modal, a
> personal-information-only submit screen, lead + horse-owner + order on submission, staff
> provisioning, then activation. **Build `CAREPATH` first.** Acquisition and lessons follow as their
> own specs. What survives here is **F1b (the combined mixed-cart form)**, which remains unbuilt and
> is explicitly out of scope for `CAREPATH`.

**Owner, 2026-08-16, verbatim:**

> *"switching to this format for all three is ideal, the only difference is that aquisition support
> doesnt get a booking date picker, they complete the form and submit it and we reach out to them.
> so we just need to review what each of the 3 forms collect for information. and then we swap out
> the 'data collection page' on the checkout flow for the two that have it and the page 3 shows
> them the confirmation of the items they selected for their order, the things they input and
> selected on their form, and a confirmation of the email sent to us and them and that we try to
> respond within a few hours using their preferred contact method."*

**The target shape, all three funnels:**

| step | what it is |
|---|---|
| 1 | choose the services |
| 2 | **the form** — who you are, plus the questions we would ask on the call, plus a date/time you want (**lessons and horse care only** — acquisition has no date picker) |
| 3 | **confirmation** — the items chosen, everything they entered, and confirmation that emails went to them and to staff, with the promise of a reply within a few hours by their preferred contact method |

# THE REVIEW HE ASKED FOR — what each form collects today (measured 2026-08-16)

**The three are not variations of one form. Two of them are missing the identifying half entirely.**

| | **Lessons** (`/lessons` → `/checkout`) | **Horse care** (`/horse`) | **Acquisition** (`/acquisition`) |
|---|---|---|---|
| first / last name | ✅ | ❌ | ❌ |
| email | ✅ | ❌ | ❌ |
| phone | ✅ | ❌ | ❌ |
| preferred contact method | ✅ | ❌ | ❌ |
| free-text notes | ✅ | ❌ | ❌ |
| wanted date/time | ✅ (`proposed_times`) | ❌ | — (correct: none wanted) |
| qualifying questions | ❌ **none** | ✅ `horse_reason`, `horse_duration` | ✅ `experience`, `how_many_horses`, `wants_lessons` |

**Read across and the gap is exactly inverted.** Lessons collects the person and asks nothing.
Horse care and acquisition ask good questions and collect no person — their contact details are
picked up later at `/checkout`, which is why their step 2 looks so thin.

**Also relevant:**
- `Checkout.tsx` already owns every contact field and the availability picker — **that is the
  component to move, not to rewrite.**
- Rider qualifying questions already exist, orphaned, on `/book/rider` (see `RIDERQUALIFY`).
- `QualifierGroup` is the shared component for the questions. One implementation already.

# THE BUILD

## F1 — one step-2 form, three configurations
- Build step 2 once and configure it per funnel, rather than three near-identical pages.
- **Every funnel collects the person**: name, email, phone, preferred contact method, notes.
  Today only the rider path does.
- **Each funnel keeps its own questions**: lessons gets the `/book/rider` set (`RIDERQUALIFY`
  decides which), horse care keeps `horse_reason` + `horse_duration`, acquisition keeps its three.
- **The date/time picker appears for lessons and horse care only.** Acquisition submits without
  one — owner's ruling, and it is right: there is nothing to schedule yet.

## F1b — A MIXED CART GETS ONE COMBINED FORM

> ⚠️ **SUPERSEDED BY `TASK-ASKRIGHT` §A2 (2026-08-16).** The owner has since specified this
> precisely, and it is **per OFFERING, not per category**: an initial section holding the questions
> that overlap across everything selected, then **one section per offering** with its remaining
> questions. Build it from `ASKRIGHT`. What follows is the earlier, coarser sketch.

**Owner, 2026-08-16:**
> *"this means if a person selects something from each category we need to generate a combined but
> category separated form to collect the relevant information about the user and their selections
> on one screen."*

**This is not hypothetical — the cart is shared and mixed carts are DELIBERATE.** Measured:
`CartContext`'s `SET_FUNNEL` explicitly preserves items across funnel switches, with the comment
*"Preserve selected items across funnel switches so cross-sell is real… This fixes the 'cart wipe'
bug."* So someone can hold lessons + horse care + acquisition at once, and today they would be
asked one funnel's questions and lose the rest.

**The shape:**
- **The person is asked ONCE.** Name, email, phone, preferred contact, notes — one block at the
  top, never repeated per category.
- **Then one section per category present in the cart**, each carrying that category's own
  questions and its own date/time picker where it has one (lessons ✅, horse care ✅,
  acquisition ❌). Sections appear only for categories actually in the cart.
- **One screen**, per the owner — not a wizard that walks category by category.
- **The date pickers are separate**: a lesson time and a horse-care time are different
  appointments and must not be collapsed into one answer.

**Order the sections by what the visitor picked first**, so the screen mirrors their own path
through the site rather than an internal category order.

## F2 — step 3 is a real confirmation, not a receipt stub
It must show, in the owner's words: *"the items they selected for their order, the things they
input and selected on their form, and a confirmation of the email sent to us and them and that we
try to respond within a few hours using their preferred contact method."*

- **The items chosen**, with prices.
- **Everything they entered**, including their answers to the questions — so they can see what was
  submitted on their behalf.
- **Confirmation that both emails were sent** — to them and to staff.
- **The promise**: a reply within a few hours, *naming the method they chose* ("we'll text you",
  "we'll call you"), not a generic line.

⚠️ **Only claim what actually happened.** Do not print "we've emailed you" from an optimistic
client-side assumption — the send must be confirmed. **Two real leads were lost here before**,
because a fire-and-forget send behind a best-effort 200 could not report failure
(`orchestration/lessons/LESSONS.md`). If a send fails, say so and give them a way to reach you.

## F3 — the checkout's data-collection page is retired into step 2
- Its fields move to step 2 for all three funnels. `Checkout.tsx` keeps the purchase itself.
- **A signed-in member must not be re-asked** what is already on file — coordinate with
  `SESSIONBOOK`.
- **Nothing about the paid-purchase path changes.** This is where the information is gathered, not
  how money moves.

## F4 — what a submission produces
- One `requests` row per submission, carrying the answers and (where present) the wanted times in
  `proposed_times` — **the existing column, not a new one.**
- **Acquisition ends here**: they submit, staff reach out. No booking, no date.
- **Lessons and horse care** continue into `LESSONREQUEST`'s staff approve/amend step.

# TRAPS
- **Do not build three forms.** One component, three configurations — the duplication this project
  has paid for repeatedly (3 horse rosters, 3 lead lists) started exactly this way.
- **Do not invent a second store for answers or times.** `requests` + `proposed_times` exist.
- **Four queued tasks touch these pages** — `SESSIONBOOK`, `RIDERQUALIFY`, `LESSONREQUEST` and this
  one. **Sequence them; do not run them in parallel.** This one is the natural first, because the
  other three build on the shape it establishes.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths.**
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes). Not a green
  baseline — 46 pre-existing red files; diff against `main`.

# THE TEST THIS MUST PASS
1. All three funnels collect name, email, phone, preferred contact method and notes at step 2 —
   prove each, since two collect none today.
2. Each funnel shows its own questions, and lessons is no longer question-less.
3. The date/time picker appears on lessons and horse care, and **not** on acquisition.
4. Step 3 shows the items, every answer given, and a send confirmation naming their chosen contact
   method.
5. **A failed send is reported honestly** — prove the failure path, not just the happy one.
6. One `requests` row per submission, with answers and wanted times in the existing columns.
7. A signed-in member is not re-asked what is on file.
8. **A mixed cart** (one item from each category) produces ONE screen: the person asked once, then
   a section per category with its own questions, with date pickers on lessons and horse care and
   none on acquisition — and every answer survives to the request.
8. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

# OWNER QUESTION
Should acquisition still reach `/checkout` at all? It creates no booking and takes no payment —
it may be cleaner for it to end at step 3 entirely, with staff building the order after the
conversation. **Ask; do not assume.**

Report to `docs/reports/TASK-THREEFORMS-REPORT.md`. Do not push; the orchestrator merges.
