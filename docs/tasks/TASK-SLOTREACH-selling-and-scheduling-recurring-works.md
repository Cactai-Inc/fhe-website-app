# TASK-SLOTREACH — the owner can sell and schedule a recurring lesson today

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** **APPLY YOUR WORK. Do not hold.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-slotreach`, branch `task/slotreach`
(**copy `.env.db` and `.env.test` in — gitignored files do NOT propagate to a worktree**) ·
report to `docs/reports/TASK-SLOTREACH-REPORT.md` · commit, **do not push** · no subagents.

---

# 1. WHY

> **Owner, 2026-08-21:** *"i need this entire project finished today… i need to start using the
> calendar and lesson scheduling."*

**`TASK-WALK2`: "the standing-slot recurring feature is unreachable, full stop."** Tested two
independent ways — confirming an existing 1x Weekly purchase, and a brand-new client buying 2x
Weekly through the in-app catalog — **both dead-ended at zero bookings and zero credits.**

**You cannot sell anything recurring today.** That is the monthly membership product.

**The machinery is BUILT — this is a reach failure, the eleventh in this project.**
`BUYANDBOOK` added a `'slots'` step to `Onboarding.tsx`'s step machine (`type Step = 'order' |
'details' | 'horse' | 'sign' | 'payment' | 'slots' | 'done'`), `src/lib/standingSlots.ts` exists
with `standingSlotSummary`/`standingSlotSentence`, and `fetchMyStandingSlots` is wired.

**The break, located:** `OrderDetail.tsx:103` renders **"Pick your weekly time"** as
`<Link to="/app/onboarding">` — **a hardcoded link to the wizard's root, not to its `slots` step.**
WALK2: the wizard *"just says 'nothing to do here' once paperwork is signed."* **And no staff screen
has any alternative control.**

---

# 2. THE WORK

## §1 — the client can reach their slot picker, always
The link must land on the **`slots` step**, and the wizard must **show that step whenever an
unchosen recurring slot exists** — regardless of paperwork state. ⚠️ **Paperwork completion
currently short-circuits the whole wizard; a signed client with an unchosen slot must still get
there.** Fix the condition, not the link alone.
⚠️ **The slot picker must also be reachable from a permanent place** — the client's calendar or
account — not only from an order page they may never revisit. **Answer THE REACH explicitly.**

## §2 — staff can set it too
Owner (D26): Claire runs the day from her own surface. **Staff need a control to set or change a
client's standing slot** without the client. ⚠️ **Converge with `AgreedLessonPanel`** — it already
sits on every provisioning surface and `provision_client_invitation.p_agreed_lesson` already carries
an agreed time. **Do not build a second way to set a standing time (D18).**

## §3 — choosing a slot produces real bookings
The acceptance test. **A 2x-weekly entitlement yields TWO standing days per week, not one** —
`generate_monthly_lessons` books one weekday while `set_recurring_days` computes several.
**Fix that convergence; do not write a second generator.**
⚠️ **No scheduler exists** (`pg_cron` absent, Vercel crons never created). **Prove bookings exist
beyond the first month with nothing waking up** — a rolling horizon materialised on read is the
likely shape.
⚠️ **D23:** the slot exists on **declaration**, never gated on staff confirmation.
⚠️ **Zero spendable credits** — `remaining = 0` is correct. A credit appears **only** on cancellation
via `_refund_booking_credit`, or transiently while rescheduling (D23 corollary).

## §4 — the names are right (D25)
**"Booking" is internal taxonomy and must not appear in client- or staff-facing copy.**
Riding lessons name **high**: *"Riding Lesson"*, never 1x/2x/evaluation/à la carte. *"Select the day
and time for your weekly Riding Lesson(s)"* · *"Reschedule your Riding Lesson"*.
**Fix the copy on every surface this task touches.** Do not sweep the whole app — report what you
see elsewhere.

## §5 — reschedule and cancel notify
WALK2: reschedule and cancel work correctly for credit-backed lessons but **fire zero
notifications**. Fix that for both shapes. ⚠️ Email works (owner-confirmed); **`emailed_at` is always
NULL and proves nothing** — its only writers are crons that cannot run.

---

# 3. THE TEST THIS MUST PASS
1. **A client who bought 2x Weekly picks two days and times, entirely through the browser**, and
   **two standing bookings per week appear on their calendar.** Screenshot plus rows.
2. **A signed client with an unchosen slot can still reach the picker** — the paperwork
   short-circuit no longer hides it.
3. **Bookings exist in a month far enough ahead that a monthly top-up would have been required**,
   with no scheduler running.
4. **Staff can set a client's standing slot** without the client, through the existing agreed-lesson
   surface.
5. **`remaining` is 0 after purchase**, 1 after cancelling one standing session, 0 after rebooking.
6. **Reschedule and cancel each fire a notification**, listed by channel.
7. **No surface this task touches says "booking" to a human.**
8. `typecheck` 0 · lint identical to main.

# 4. REPORT
`docs/reports/TASK-SLOTREACH-REPORT.md`. Lead with: **can the owner sell and schedule a recurring
lesson today, yes or no.**
