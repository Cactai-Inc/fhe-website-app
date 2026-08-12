# TASK BOOKWRITE — a booking is created without any of its relationships

**Plan of attack item 7.**

**Owner, 2026-08-12:** *"yea i know the order summary is a fucking disaster, and that feeds right
into the booking shitshow, and all of that contributes to mass confusion, skipped steps,
misleading information abounds."*

**It is not diffuse rot. It is one broken write path, and everything downstream is starved by
it.**

---

# MEASURED IN PRODUCTION, 2026-08-12

```
bookings                        319 rows
  with purchase_id                0        <- ZERO
  with credit_id                  0        <- ZERO
  with contract_id                0        <- ZERO
  with instructor_user_id         0        <- ZERO
  with horse_id                   0        <- ZERO
  with offering_id               22        (17 of the 39 REAL bookings have none)
  with client_id                 25

  status: available 280 · scheduled 39
```

**And no `fulfillment_unit` carries a `booking_id`.**

The obligations ledger generates **correctly** — ADMINSWEEP proved every one of the 6 live
`purchase_items` has its units, 100% coverage. **It has never once been consumed.** Every unit
reads `open` forever because nothing ever links a booking back to what it fulfils.

**So the order summary, the item page both parties see, the purchase detail and the activity log
are all rendering from links that were never written.** That is why it reads as mass confusion
rather than as one bug.

---

# THE JOB

**Find every path that creates a booking and make it record what it knows.**

Start from the writers — `save_calendar_item`, the schedule-a-lesson path in the lead work
drawer, `_provision_purchase_for_offerings`, and anything else that inserts into `bookings`.
**Enumerate them in the report before changing any of them.**

For each, establish **what is knowable at creation time** and whether it is being dropped:

- **`offering_id`** — what service is this? **17 of 39 real bookings do not say.**
- **`purchase_id` / `credit_id`** — what paid for it? **This is the link that closes the
  ledger.**
- **`instructor_user_id`** — who is delivering it? **Not one booking names anybody.**
- **`horse_id`** — which horse? **Not one booking names one.**
- **`contract_id`** — where a lease or agreement is the reason for it.

**Some of these are genuinely unknowable at creation** — an availability slot has no client, no
purchase and no horse, and that is correct. **Say which are legitimately null and why.** The
finding is not "everything must be filled"; it is that fields which *are* knowable are being
discarded.

## Close the loop on the ledger

`fulfillment_units` are generated from `purchase_items` by `config_kind` and are **consumed by
bookings** (D6). Nothing consumes them today.

**Establish what "consumed" should mean** — does a booking claim a unit at creation, at
completion, or at payment? — **and state it before implementing.** Getting this wrong writes bad
data into an evidence spine.

## ⚠️ The orphans — report, do not clean

**6 of the 12 fulfillment units point at `purchase_id` and `purchase_item_id` values that no
longer exist**, despite both FKs being `ON DELETE CASCADE`. The `purchases` display-code sequence
has reached **PUR-000059 with 2 rows surviving** — roughly 57 purchases were hard-deleted with FK
triggers suppressed.

**Do not delete or repair those 6 rows in this task.** They are evidence of something that
happened to this database and the owner has not ruled on them. **Report them.**

---

# WHAT THIS TASK IS NOT

- **Not the Bookings page.** The owner's *"Bookings should be the page and calendar lives inside
  it as a view"* is recorded in `docs/reference/BOOKINGS-PAGE-DESIGN-2026-08-12.md` and
  **deliberately sequenced after this**, because a list view and a booking-type view over today's
  data would render 88% empty slots and 44% "unknown type". **Fix the writes; the views become
  worth building.**
- **Not a backfill of the 319 existing rows.** Establish what *new* bookings record. **Then
  report what a backfill would involve and what is unrecoverable** — a booking whose purchase was
  hard-deleted cannot be relinked.
- **Not BOOKFLOW.** The owner ranked the full booking workflow last. This is the write path
  only.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-bookwrite`, branch `task/bookwrite`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **`TASK-COUNTFIX` owns `listLessonSessions()`** — the query that reads 318 where 39 exist.
  **You own what WRITES a booking; it owns what READS one.** Do not fix the read path here.
- **`DashboardPanel.tsx` and `ops/IntakePage.tsx` carry LEADCLEAN's shipped design**, including
  the schedule-a-lesson path. **You may need to touch that writer — do it minimally and say so.**
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.**
- **Delete nothing. Repair no existing row.** This changes what gets written next.
- **Money paths are involved** — `finalize_purchase_payment`, `create_gift` and
  `_provision_purchase_for_offerings` all read `offerings.price_amount`. **Do not change pricing
  behaviour.** If a booking's link requires touching one, **report before you change it.**
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.** Dry-run in `BEGIN; … ROLLBACK;`, apply, verify.
- **`test:db` is broken** (60 of 68 files failing) — **do not cite it as proof.** Verify against
  production with direct SQL.
- No staff browser session exists. Report renders as **NOT VERIFIED** with a numbered checklist.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. Every writer that inserts into `bookings` is enumerated in the report, with what each one
   knows at creation.
2. A newly created lesson booking records its **offering**, its **instructor**, its **horse**
   where one applies, and the **purchase or credit** that paid for it — proven by creating one
   and showing the row.
3. Fields that are legitimately null are **named, with the reason**.
4. A booking claims its fulfillment unit, and the rule for when it does is stated before it is
   built.
5. The 6 orphaned units are reported and **untouched**.
6. No pricing behaviour changed.

Report to `docs/reports/TASK-BOOKWRITE-REPORT.md`.
