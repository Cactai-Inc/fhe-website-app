# TASK REQTRIGGER — `requests_capture_contact` has never linked a request

**Plan of attack item 21.** Small, precise, and already fully diagnosed by `TASK-LEADCLEAN` —
which found it, worked out the repair, and deliberately did not apply it because it changes
behaviour on a live path.

---

# THE DEFECT

`requests_capture_contact` is an **`AFTER INSERT`** trigger whose final act is:

```sql
NEW.contact_id := v_contact;
```

**Assigning to `NEW` in an `AFTER` trigger does nothing.** The row is already written. The
assignment is discarded silently and the function returns success.

**Its own migration comment claims the opposite** — `20260802000000_lead_trust_notifications.sql`
says *"ITEM 2: keep the link. Both paths … persist the id."* **It does not.**

## The evidence is decisive

`requests.contact_id` was added **2026-08-02**. **Every request created on or after that date has
NULL** — Marissa Robertson, Emmy Castro, Kit Garcin. **Every earlier row has a value**, because
those were filled by a one-off backfill.

**LEADCLEAN's backfill was the second one-off. Without this fix there will be a third.**

**This is the seventh instance of the project's recurring failure mode** — code that reports
success while doing nothing. See `docs/method/ORCHESTRATOR.md` §3 for the full table.

---

# THE REPAIR — LEADCLEAN worked it out; verify it, then apply it

**Keep the trigger `AFTER` and persist explicitly:**

```sql
UPDATE requests SET contact_id = v_contact
 WHERE id = NEW.id AND contact_id IS NULL;
```

## ⚠️ Why NOT to move it to `BEFORE`, which is the obvious fix

**Triggers fire in name order.** `requests_capture_contact_trg` sorts **before**
`requests_normalise_phone_trg`. Moving it to `BEFORE` would make it capture the
**un-normalised** phone, creating a second defect while fixing the first.

**The `UPDATE` above avoids it entirely** — it does not touch `contact_phone`, so the
`UPDATE OF contact_phone` trigger never fires.

**Verify both claims before applying:** confirm the trigger timing and the name ordering
yourself, and confirm the `UPDATE` does not re-enter any trigger. **LEADCLEAN's reasoning is
sound but unexercised.**

---

# WHAT ELSE TO CHECK

- **Is the same pattern anywhere else?** Sweep for `AFTER` triggers that assign to `NEW`. It is
  a mistake that repeats. **Report what you find; fix only this one** unless another is trivially
  the same and you say so.
- **`contact_id IS NULL` in the WHERE is deliberate** — it must never overwrite a link a human or
  a later process established. Keep that condition.
- **Do not backfill.** LEADCLEAN already did, twice-over. **If rows are still NULL after the fix
  lands, that is a finding about the fix, not a reason to backfill again.**

## ⚠️ Kit Garcin

**`kitgarcin@gmail.com` is the owner's single reserved acceptance case** for the whole
lead-promotion chain — `status = new`, `contact_id` **NULL on purpose**, excluded from LEADCLEAN's
backfill by request id with a comment naming why.

**Your change must not alter that row.** It only fires on INSERT, so it should not — **prove it,
and re-check the row after applying.**

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-reqtrigger`, branch `task/reqtrigger`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **Do not touch `DashboardPanel.tsx`, `LeadWorkDrawer.tsx` or `ops/IntakePage.tsx`** — LEADCLEAN's
  shipped design. This is a database change only.
- **Change nothing else in the trigger.** It also sends notifications; **leave that alone.**
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.** Dry-run in `BEGIN; … ROLLBACK;`, apply, verify.
- **~31 migrations rewrite function bodies in place and are not safe to replay on a fresh
  database.** This is pre-existing; **follow the convention, do not try to fix it.**
- **`test:db` is broken** (60 of 68 files fail) — do not cite it as proof. Verify against
  production.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. A **new** request inserted with a matching contact comes out with `contact_id` **populated** —
   proven by inserting one and showing the row.
2. A new request with an **ambiguous or absent** match comes out NULL, not wrongly linked.
3. **`contact_phone` is normalised exactly as before** — the ordering hazard did not materialise.
4. **Kit Garcin's row is byte-identical before and after.**
5. No existing row was backfilled by this task.
6. Any other `AFTER`-trigger-assigns-to-`NEW` instances are reported.

Report to `docs/reports/TASK-REQTRIGGER-REPORT.md`.
