# TASK-BUYANDBOOK — a member can buy, and declaring payment unblocks everything

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** It changes when money-bearing entitlements are
created and opens an RLS write path on a table `anon` already holds grants on. Both are security-
adjacent.

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-buyandbook`, branch `task/buyandbook` ·
report to `docs/reports/TASK-BUYANDBOOK-REPORT.md` · commit, **do not push** · no subagents ·
migrations dry-run inside `BEGIN … ROLLBACK` with the rollback proven, then applied and verified ·
render claims **NOT VERIFIED**. **TEARDOWN:** process census in the report.

---

# 1. THE RULING — D23, and it is not open to redesign

> **Owner, 2026-08-20:** *"nothing blocks them from any action because the lesson never happens
> without payment being verified."* And, on being shown the app does the opposite:
> **"the app needs to follow my instruction that you quoted back to me, nothing blocks them."**

> *"fix the catalog purchase route for authenticated sessions."*

**Credits mint on DECLARATION. Staff confirmation controls whether the lesson happens, not whether
the client can act.** Read **D23** in `CLAUDE.md` first.

---

# 2. WHAT WAS MEASURED (orchestrator, prod, 2026-08-20 — WALK1 evidence)

- **The 403.** `purchases` RLS: `purchases_org_boundary` is **RESTRICTIVE** (`polpermissive = f`);
  the only **permissive** policy covering INSERT is `purchases_staff_all` (`has_staff_access()`).
  `purchases_member_own_select` is **SELECT-only**. ⇒ **A member has no INSERT path at all.**
- **The mint gate.** `purchases_mint_credits` = `AFTER UPDATE OF status` →
  `trg_mint_credits_when_order_opens`, whose body opens with
  `IF coalesce(OLD.status,'')='draft' AND coalesce(NEW.status,'')<>'draft'`.
  Plus `purchase_items_mint_credits` `AFTER INSERT ON purchase_items`.
- **WALK1's two purchases:** `PUR-000238` = `awaiting_payment`/`zelle`/`pending`;
  **`PUR-000245` = `draft`/`cash`/`unpaid`** — the cash declaration never moved it out of draft.
- **`pg_cron` is NOT installed** — 0 rows in `pg_extension`, no `cron` schema. **A $460 recurring
  purchase minted nothing** (`lesson_credits` unchanged).
- **The `NO_CREDITS` leak.** `CalendarPage.tsx:570-583`'s `book()` maps `NO_CREDITS` to a proper
  panel (`:734-737`, *"You don't have any lesson credits"* + a **Buy lessons** button). **That UI
  already exists and works.** WALK1 saw the raw token, so **a second path throws it unmapped** —
  start at `api-calendar.ts:233` (the flexible-open claim).
- **A failed booking still notified staff:** a `booking_time_requested` notification exists with
  **zero** matching `bookings` rows.

---

# 3. THE WORK

## §1 — a member can create a purchase (the 403)
Give members a write path. **Decide and justify: a permissive INSERT policy, or an RPC.**
⚠️ **`anon` holds INSERT/UPDATE/DELETE on `purchases` through the repo-wide default grant — RLS is
the ONLY thing denying it** (`OPEN-ITEMS` §7). **Whatever you add must not widen anon.** Prove it:
show `anon` still refused after the change, with output.
⚠️ Keep the restrictive org boundary intact.

## §2 — mint on declaration
A Zelle or cash declaration mints the entitlement immediately. **Reuse the existing engine** —
`_mint_credits_for_purchase_item` and the `trg_mint_*` spine. **Do NOT write `lesson_credits`
directly from the client or from a new second path (D18).**
⚠️ **Minting must be idempotent.** Declaration then staff confirmation must not mint twice. Prove
double-mint is impossible with a query.

## §3 — the cash path leaves the purchase in `draft`
`PUR-000245` proves declaring cash never advances the status, so **no status-transition trigger can
ever fire for it.** Fix so both methods reach the same declared state through one spine
(`mark_purchase_paid` is the existing convergence point — **converge, do not add a fourth door**).

## §4 — a weekly membership is a STANDING SLOT, not a credit balance

> **Owner, 2026-08-20:** *"mint into eternity the weekly schedule and its gated on did they pay at
> the staff fullfilment level."* And, sharpening it: *"its not like we get paid and then issue them
> credits and then they have to go schedule them, that would be a monthly riding punch card, not a
> weekly paid monthly riding slot."*

⚠️ **The orchestrator got this wrong twice** — first "mint one period then ask about month 2", then
"mint credits forever". **Both are withdrawn. Recurring does not mint credits at all.**

**THE TWO SHAPES, AND THEY ARE NOT THE SAME PRODUCT:**

| `config_kind` | offerings | what the client gets | who schedules |
|---|---|---|---|
| **`scheduled`** | Single Lesson · Evaluation · 4- and 8-Lesson Punch Cards | **credits they spend** | the client, whenever |
| **`recurring`** | 1x/2x Weekly Lesson (± *With your horse*) | **a standing weekly SLOT** — a reserved recurring time that is theirs | chosen once, then it recurs |

**A weekly membership client never "has credits" and never goes hunting for a time.** Their slot
exists. **`weekly_frequency` is how many slots per week** — 2x weekly means two standing times, not
two credits. Billing is monthly; **the slot is the product.**

**THE MODEL ALREADY EXISTS — CONVERGE ON IT, DO NOT INVENT ONE.** `CAREPLANS` established exactly
this for horse care: *the chosen days ARE the entitlement; the month opens with bookings and **zero
spendable credits**.* **Weekly lessons are the same product shape and must use the same mechanism.**
`set_recurring_days` already computes a multi-day allowance. ⚠️ **Known defect to fix, not to work
around: `generate_monthly_lessons` books ONE weekday while the entitlement allows several** — a
2x-weekly client must get two standing days.

**Consequences to build to:**
1. **Zero spendable credits** for a recurring purchase. If `lesson_credits` rows appear for one,
   that is the defect, not the feature.
2. **The client picks their day(s) and time(s) DURING ONBOARDING** — owner, 2026-08-20: *"they pick
   the day or days for their weekly booking along with the time(s) for each at the time they
   onboard."* **Not at checkout, and not left to staff.** A 2x-weekly client picks **two** days and
   a time for **each**. Those become their standing bookings.
   ⚠️ **The surface exists: `src/pages/app/Onboarding.tsx`**, whose steps are already data-driven
   (`type Step = 'order' | 'details' | 'horse' | 'sign' | 'payment' | 'done'`) and already skip
   steps that do not apply (§C10a skips the horse step). **Add the slot step to that machine** —
   shown only when the order contains a `recurring` item. **Do not build a separate scheduling
   page.**
   ⚠️ **Converge with the staff-side incumbent, do not duplicate it.** `AgreedLessonPanel.tsx`
   already exists on every provisioning surface (`AccountInvitePage`, `ContactDossierModal`,
   `Admin`) and `provision_client_invitation` already accepts `p_agreed_lesson` — that is the
   phone-agreed path CLOSEOUT §3.5 built. **The client-chosen path must land in the same place**;
   two ways to set a standing time that disagree is precisely the failure this project keeps
   repeating (D18).
   ⚠️ `Onboarding.tsx:108-111` currently renders a recurring purchase as a **cadence line**
   (*"1 lessons/week"*). Once the slot is chosen, the honest summary is **the days and times that
   are theirs**, not a cadence string.
3. **It continues without any scheduled job.** `pg_cron` is not installed and the Vercel crons do
   not exist. **Prove the slots keep existing beyond the first month with nothing waking up** —
   a rolling horizon materialised on read is the likely shape. **Do not build a scheduler.**
4. **"Did they pay" is answered by STAFF AT FULFILMENT** — not at purchase, not at booking. The
   standing slot exists regardless; whether the lesson is delivered is the operational control (D23).

⚠️ **The order page tells a recurring buyer no count, no period, no expiry, no renewal terms.** For a
standing slot the honest statement is *which days and times are theirs, and that it recurs until
cancelled* — not a lesson count. State the wording; build it only if small.

## §5 — the unmapped `NO_CREDITS`
Route the second path's error to the **existing** panel. **Do not build a second no-credits UI.**

## §6 — the false notification
A booking that creates no row must not tell staff a time was claimed. Either the notification moves
inside the successful path, or it is withdrawn when the booking fails.

---

# 4. OUT OF SCOPE
Stripe (out, permanently, per the owner) · installing any scheduler · the 3 offering **name**
mismatches (public strips *"(With your horse)"*) · WALK2's confirmations · any UI redesign.

# 5. THE TEST THIS MUST PASS
1. **An authenticated member creates a purchase** — the 403 is gone, shown by query.
2. **`anon` is still refused** on `purchases` INSERT, shown by query.
3. **Declare Zelle ⇒ credits exist ⇒ `Book this time` books**, proven end to end server-side, with
   the booking row.
4. Same for **cash**, and the purchase leaves `draft`.
5. **Confirming afterwards mints nothing further** — counts identical before and after.
6. **A recurring purchase yields an OPEN-ENDED weekly entitlement**, and bookable weeks continue to
   be available beyond the first month **with no scheduled job running** — proven by showing
   bookable capacity in a month far enough ahead that a monthly top-up would have been required.
   **A 2x-weekly entitlement must yield two days per week, not one.**
7. **No path surfaces a raw `NO_CREDITS`** — every throw site maps to the existing panel.
8. **A failed booking produces no `booking_time_requested`.**
9. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file (46 red baseline).

# 6. THE REACH
What a member clicks to buy from the catalog, and what they click to book with no credits. State
whether each is the only way.

# 7. THE TELL
What the member sees after declaring payment, and what staff see that tells them a payment awaits
confirmation. **Both must be true at once — the client is unblocked AND staff know.**

# 8. REPORT
`docs/reports/TASK-BUYANDBOOK-REPORT.md`, with **flagged-not-fixed**.
