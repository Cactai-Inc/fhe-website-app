# TASK-WALK2 — the company side, and the booking lifecycle, on the LIVE SITE

**RUN WITH: Sonnet 5 · thinking ON · effort MEDIUM.** High-stakes calls are pre-decided in §3.
**Escalate, do not diagnose.**

⚠️ **RUNS AGAINST PRODUCTION.** Read §3 before opening a browser.

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-walk2` (**already created; `.env.test` is
already in it**), branch `task/walk2` · report to `docs/reports/TASK-WALK2-REPORT.md` · commit,
**do not push** · no subagents · **TEARDOWN:** kill every browser; process census in the report.

---

# 1. WHY

`TASK-WALK1` proved the client half and stopped dead at the company half. **`TASK-BUYANDBOOK` has
since landed** — declaring payment now opens the order, a member can buy, a weekly membership is a
standing slot, and a declared order shows **Payment pending — Zelle/Cash**. **All of it is
server-proven only, NOT VERIFIED in a browser.** This walk is where it meets a human.

**WALK1 left two real orders waiting:** `PUR-000238` (Zelle, $170) and `PUR-000245` (cash, $460,
the recurring one). Both now read a payment-pending status. **Confirming them is §A.**

---

# 2. PHASE 0 — TOOLING (commit alone)
Playwright, worktree-local at `wt-walk2/walk2-tooling/` with its own `package.json` and a
`.gitignore` containing `*`. ⚠️ **Never touch the repo's `package.json`** — it deploys.
`.env.test` is in the worktree root: `FHE_SITE_URL` + `FHE_ADMIN_PASSWORD` (durable). **Never echo a
credential, including into screenshots.** Screenshots → `docs/reports/walk2-shots/`, decision points
only, one per step, **no full-page DOM dumps.**

---

# 3. RULES OF ENGAGEMENT
1. **Identities:** `admin@fhequestrian.com` for the company side; the **existing WALK1 client**
   (`cjzigs+walk1-202608201634@icloud.com`, last name `Walk1 WALKTEST`) for the client side. Create a
   fresh `cjzigs+walk2-<yyyymmddHHMM>@icloud.com` only if you need a second client.
2. ⚠️ **NEVER act on a real client's booking, order, account or document.** Read them; never write.
   Every write must be traceable to a WALKTEST identity. **List every row you create or change.**
3. **Money: Zelle and cash only, never a card. Stripe is out.**
4. **Escalate, do not diagnose** — record what you saw, what you expected, the step; do not open
   `src/` or query the DB to explain behaviour.
5. **Stop** for anything touching a real client, or anything you cannot classify as safe.

---

# 4. THE WALK

## §A — confirm the two waiting payments
Confirm `PUR-000238` (Zelle) and `PUR-000245` (cash) from the staff side.
- **Where does a staff member go to find them?** Record the path — if it is hard to find, that is a
  finding (D17).
- After each confirmation: **what changed for the client** — status, credits, slot, notification.
- ⚠️ **D23/D24: confirmation must NOT be what unblocks the client** — they were already unblocked by
  declaring. **Confirm that confirming changes delivery, not access.**
- ⚠️ **Minting must be idempotent** — confirming must not mint a second time. **Record the credit
  and slot counts before and after.**

## §B — the standing slot, seen for the first time
`PUR-000245` is the recurring $460 purchase. **Verify the client has a standing weekly slot**, not a
credit balance:
- Do the standing bookings appear on the calendar as theirs?
- **`remaining` should be 0** with no spendable credit — **that is correct, not a defect.**
- **A 2x-weekly entitlement must yield two days per week**, not one (the known
  `generate_monthly_lessons` defect BUYANDBOOK was told to fix).
- **Do slots continue beyond the first month?** No scheduler exists — this is the acceptance test
  that matters most here.

## §C — the company side, in the owner's words
*"confirming, revising, cancelling, and authoring and inviting for bookings, contracts, accounts."*
For **bookings** and **accounts** (contracts are WALK3's): confirm · revise · cancel · author ·
invite. **Record for each: where it lives, what it does, what the client sees, and whether it can be
undone (D19).**

## §D — reschedule and cancel, per lesson type
Owner: *"reschedule a lesson for each lesson type, cancel a lesson for each lesson type."*
Cover both shapes, because they behave differently:
- **`scheduled`** (Single · Evaluation · 4-/8-Lesson Punch Card) — credit-backed.
- **`recurring`** (1x/2x Weekly) — standing slot.
⚠️ **On the recurring side this is the credit rule in action:** cancelling a standing session
**mints** a credit via `_refund_booking_credit`; rescheduling holds one transiently. **Show
`remaining` before and after each.**

## §E — notifications, throughout
Client dashboard · admin dashboard · **email to both**. ⚠️ **`emailed_at` is always NULL and proves
nothing** — its only writers are crons that cannot run. Email works (owner-confirmed). **List every
message that should have arrived — step, subject, recipient, time — for the owner to confirm.**

---

# 5. OUT OF SCOPE
Contracts (**WALK3**) · any code change or fix · Stripe · installing anything into the repo's
`package.json`.

# 6. THE TEST THIS MUST PASS
1. **Both waiting orders confirmed**, with before/after state shown.
2. **Confirming minted nothing twice** — counts identical.
3. **The standing slot is visible to the client as bookings**, `remaining` = 0, and **slots exist
   beyond the first month with no scheduler running.**
4. **A 2x-weekly entitlement yields two days per week.**
5. **Reschedule and cancel exercised for both shapes**, with `remaining` before and after — proving
   a cancelled recurring session mints a credit.
6. **Every company-side action recorded** with where it lives, what the client sees, and whether it
   is undoable.
7. **No real client's row was written** — assert it and list every row you touched.
8. Every notification recorded on three channels; every expected email listed.

# 7. REPORT
`docs/reports/TASK-WALK2-REPORT.md` — lead with: can staff run the business from these screens, yes
or no. Then **flagged-not-fixed**, then teardown.
