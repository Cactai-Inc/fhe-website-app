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

## §4 — recurring mints its first period at purchase
**There is no scheduler.** The first period's entitlement mints at purchase, with a real
`period_start` and `expires_at`. **Do NOT build a scheduler** and do not install `pg_cron` — say in
the report what would still be needed for month 2, and leave it to the owner.
⚠️ The order page currently tells a recurring buyer **no lesson count, no period, no expiry, no
renewal terms.** State what it should say; build it only if it is small.

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
6. **A recurring purchase mints its first period at purchase**, with `period_start` and
   `expires_at` shown.
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
