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

## §4 — a recurring purchase mints the weekly schedule INTO ETERNITY

> **Owner, 2026-08-20, correcting the orchestrator's first draft of this section:** *"mint into
> eternity the weekly schedule and its gated on did they pay at the staff fullfilment level."*

⚠️ **The orchestrator originally specced "mint the first period at purchase, then stop and ask the
owner about month 2." That is WRONG and is withdrawn.** There is no month-2 event to design,
because **the entitlement does not expire into a gap that something must refill.**

**A recurring purchase creates an ONGOING WEEKLY ENTITLEMENT that keeps producing**, indefinitely,
until it is cancelled. **`weekly_frequency` is the entitlement** — 1x or 2x weekly, forever — in the
same shape as `CAREPLANS`' ruling that *the chosen days ARE the entitlement*.

**And that is exactly why no scheduler is needed.** `pg_cron` is not installed and the Vercel crons
do not exist, but **an open-ended schedule needs neither**: nothing has to wake up monthly to top up
a balance that was designed never to run out.

**The gate is at STAFF FULFILMENT, not at minting and not at booking.** *"Did they pay"* is a
question staff answer **when the lesson is fulfilled** — consistent with D23: the client is never
blocked, and the lesson is the control.

⚠️ **You cannot write infinite rows** — so state your mechanism explicitly and justify it. The
likely shape is a **rolling horizon generated on demand** (bookable weeks materialise as the client
looks forward, and the entitlement itself is open-ended and stored once), **not** a monthly batch.
**Whatever you choose, prove that no scheduled job is required for it to keep working**, because
none exists.

⚠️ **Reuse what is there.** `set_recurring_days` already computes a multi-day allowance and
`generate_monthly_lessons` already books — but a known defect is that the generator **books ONE
weekday while the entitlement allows several.** Fix the convergence; **do not write a second
generator (D18).**

⚠️ The order page currently tells a recurring buyer **no lesson count, no period, no expiry, no
renewal terms.** With an open-ended entitlement the honest statement is different from a package —
state what it should say. Build it only if it is small.

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
