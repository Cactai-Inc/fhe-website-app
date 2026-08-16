# TASK DEPENDENT — the guardian buys, the dependent rides

**Owner, 2026-08-16, verbatim:**

> *"Gabriella is a real client but her purchases and orders should belong to her parent and extend
> to her account by proxy as the rider (dependent) so we might need to clean that account up and
> review the process for how those credits and orders are handled."*

**This is a first real client, not test data.** Gabriella Olenik, DOB 2013-03-31 — thirteen years
old. Whatever is built here is the pattern for every minor rider that follows.

# WHAT WAS MEASURED (prod, 2026-08-16 — verify, then build)

**The identity half is already correct. The commerce half does not know guardians exist.**

- `contacts.guardian_contact_id` exists and **is correctly set**: Gabriella →
  Brian Olenik (`brian@brianolenik.com`). `date_of_birth` is populated on the child.
- **Seven functions reference `guardian_contact_id`** — `contact_dossier`,
  `generate_my_onboarding_documents`, `my_onboarding_state`, `purge_account`, `sign_release`,
  `update_contact_record`, `update_my_onboarding_profile`. **Every one is identity, documents, or
  onboarding. NOT ONE is in the commerce path.**
- **`purchases`, `lesson_credits`, `bookings` have no guardian concept at all.** Confirmed:
  `PUR-000106` (unpaid, 1 booking) has `buyer_contact_id = Gabriella` — **the 13-year-old is
  recorded as the buyer.**
- Neither Olenik has an account yet (`profiles` count 0 for both).
- C10 (`is_minor_contact` + guardian-addressed delivery) already exists for **email delivery** —
  a minor's mail goes to the guardian. **That is the precedent to extend, not reinvent.**

**So the bug is narrow and specific: a minor can be recorded as the buyer of a paid service.**

# THE MODEL TO BUILD

**The guardian is the customer. The dependent is the rider.** One purchase, two roles:

- **`buyer_contact_id` = the guardian.** They owe the money, they get the receipt, the order
  appears on their account, they make the payment claim.
- **The rider/participant = the dependent.** The booking is theirs, the credit is spent on their
  lesson, the activity form and lesson history are about them.
- **Credits extend by proxy**: a credit bought by the guardian is bookable for the dependent.
  Whether it is *also* bookable for the guardian themselves is an owner question — **ask, do not
  assume.** (A parent buying an 8-pack for one child is the common case; a family sharing a pack
  across two siblings is a different product.)

## D1 — a purchase for a minor books to the guardian
- Provisioning or checkout for a dependent sets `buyer_contact_id` to the **guardian**, and records
  the **dependent** as the rider on the purchase line and on every booking it produces.
- **Establish where the rider is recorded.** `bookings.client_id` exists; purchases may need a
  participant/rider reference. **Do not invent a parallel identity table** — reuse
  `guardian_contact_id` as the source of truth for the relationship.
- **A minor must never end up as `buyer_contact_id`.** Guard it at the write path, not just the UI.

## D2 — the dependent's account is a proxy, not a wallet
- When Gabriella eventually has an account, she sees **her** lessons, bookings, credits-available
  and activity forms. She does **not** see her father's payment screen, order totals, or other
  children's records.
- Brian sees the orders, the money, the receipts — and his dependents' schedules.
- **RLS must express this.** A dependent reading a guardian's purchase, or a guardian reading an
  unrelated adult's, are both failures. Prove both directions.

## D3 — fix Gabriella's existing record
- `PUR-000106` moves to Brian as buyer, with Gabriella as the rider; her booking stays hers.
- It is **unpaid**, so no money or receipt trail is disturbed — this is the cheapest possible moment
  to correct it. Do it as a **data migration with the before/after shown**, not a hand-edit.
- Brian has no account. Whether he gets one now is an owner call; the contact and the link exist
  either way. **Do not auto-provision without saying so.**

## D4 — the paths that create this situation
- Staff provisioning, self-signup, and gift purchase all need to handle "buying for my child."
  **Report which of the three currently can, and what each does today** before building. The
  provisioning spine (`provision_client_invitation`) is the one door (D5) — extend it.
- Onboarding already asks guardian questions (`update_my_onboarding_profile` knows guardians) —
  **that is where the relationship should be captured**, not a new form.

# TRAPS
- **C10's guardian-addressed delivery already exists** — a minor's email goes to the guardian.
  Extend that precedent; do not build a second guardian mechanism.
- **`is_minor_contact` already exists** — use it, do not recompute age from `date_of_birth` in a
  new place.
- **CREDITALIGN owns `lesson_credits` and its two seams** (`book_open_slot`,
  `_refund_booking_credit`). Proxy consumption must go through them — **not a third path.**
- **REVIEWQ owns booking status**; **LESSONFORM** puts a form on every booking — a dependent's form
  is about the dependent, addressed to the guardian.
- **Executed documents are evidence**: Gabriella's signed paperwork stays hers and is never
  re-anchored to Brian (D1/D11 and the executed-docs rule).
- **Migrations never contain `BEGIN`/`COMMIT`**; dry-run and **prove the rollback**.
- **`REVOKE … FROM PUBLIC` does not remove a direct grant** — prove with `has_function_privilege()`.
- `assertWrote()` on every write; RLS silently zeroes UPDATEs.
- **Never symlink `node_modules` across case-variant paths.**
- **Run the PGlite suite** (`vitest run`, capped workers, kill your processes). The suite is **not a
  green baseline** — 46 pre-existing red files; diff against `main`.

# THE TEST THIS MUST PASS
1. A purchase made for a dependent records the **guardian** as buyer and the **dependent** as rider
   — prove both columns.
2. A minor can never be written as `buyer_contact_id` — prove the guard refuses.
3. A credit bought by the guardian is bookable for the dependent, through `book_open_slot`, not a
   new path.
4. The dependent sees their own lessons and not the guardian's money; the guardian sees the orders
   and the dependent's schedule. Prove both RLS directions, including the negative case.
5. `PUR-000106` is corrected with before/after shown, its booking still Gabriella's, and no
   executed document re-anchored.
6. The three creation paths (staff provisioning, self-signup, gift) are each reported: handles it,
   or does not, with what happens today.
7. Every DB claim is query output; render claims **NOT VERIFIED** with a numbered owner checklist.

# OWNER QUESTIONS — ask, do not guess
1. Can a guardian-bought credit be used by the guardian too, or only by the named dependent?
2. Can one guardian's credits be shared across two siblings?
3. Does Brian get an account provisioned now, or stay a contact until he needs to log in?
4. At 18, does a dependent's account become independent — and what happens to unused credits?

Report to `docs/reports/TASK-DEPENDENT-REPORT.md`. Do not push; the orchestrator merges.
