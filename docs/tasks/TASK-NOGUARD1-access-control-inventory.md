# TASK NOGUARD1 — inventory: which functions enforce their access rules

**Read-only. This task changes nothing.** It produces a classified list. Hardening is
`TASK-NOGUARD2`, which depends on this.

---

## Why this inventory is needed

Our database functions run with elevated rights (`SECURITY DEFINER`) and are expected to
check the caller's identity before acting. Earlier reviews confirmed each function's
identity check was *written correctly*, but they all searched for functions that **have** a
check. A function with **no** check matches none of those searches, so that group has never
been reviewed.

A second issue makes written checks unreliable too. The standard pattern is:

```sql
IF NOT (has_staff_access() OR v_row.buyer_user_id = auth.uid()
        OR v_row.buyer_contact_id = current_contact_id()) THEN
  RAISE EXCEPTION 'not your purchase';
END IF;
```

When there is no signed-in user, `auth.uid()` and `current_contact_id()` are NULL, so both
comparisons evaluate to NULL rather than false. `false OR NULL OR NULL` is **NULL**,
`NOT NULL` is **NULL**, and an `IF` on NULL does not run its body. **The check is skipped
entirely.** Three payment functions were repaired for exactly this on 2026-08-07
(`20260808T0300_payment_guards_fail_closed.sql`) — the repair is
`coalesce(<predicate>, false)`, so an undetermined result becomes a denial.

**So a function can look guarded and not be.** This inventory must judge whether each check
actually takes effect, not merely whether one is present.

## Starting measurements (orchestrator, production, 2026-08-07)

| | count |
|---|---|
| `SECURITY DEFINER` functions in `public` executable by the `anon` role | **320** |
| …containing no identity-check token anywhere | **111** |
| …of those, trigger functions (`RETURNS trigger`) | 27 |
| …remaining, directly callable | **84** |
| …of those 84, that also modify data | **28** |

**These numbers came from a keyword scan and are wrong in both directions.** They over-count
functions that are safe by construction, and under-count functions that mention
`auth.uid()` while using it to look up a value rather than to authorise — the NULL problem
above means several of those are effectively unguarded too. **Re-derive the list with your
own method; treat 84 as a floor, not an answer.**

## What to produce

A single classified table covering every `SECURITY DEFINER` function in `public` reachable
by `anon`, each marked:

- **ENFORCES** — the check is present *and* takes effect for an unidentified caller
  (evaluate the predicate; confirm it returns false rather than NULL).
- **DOES NOT ENFORCE** — no check, or a check that does not take effect. **Say which.**
- **INTENTIONALLY PUBLIC** — reachable without a session by design. Give the reason.

For every **DOES NOT ENFORCE** row, add:

1. **What the function does** — reads, or modifies which tables.
2. **Consequence ranking.** Functions touching `documents`, `signatures`, `contacts`,
   `profiles`, `purchases` or `members` rank above ones touching log tables.
3. **Callers** — from `src/`, `api/`, and other database functions
   (`pg_proc.prosrc`). A function with no callers is dead code; say so.

### Already established — carry these, don't re-derive

- **`redeem_gift` — INTENTIONALLY PUBLIC and self-enforcing.** Its body opens
  `IF auth.uid() IS NULL THEN RETURN 'not_authenticated'`. The grant is harmless. Note that
  the older rationale ("`/redeem` needs anonymous execution") is **wrong** and should not be
  repeated.
- **`open_gift` — INTENTIONALLY PUBLIC by design.** It takes a gift code; knowing the code
  is the authorisation, which is what lets a recipient view a gift before having an account.
  A wrong code returns nothing.
- The public catalog read path (`public_offerings` and similar) — the marketing site has no
  session.
- **Trigger functions are not directly callable** — PostgreSQL refuses a direct call.
  Confirm that yourself, then set them aside as low priority.

## How to determine whether a check takes effect

Evaluate the predicate, not the function. For each candidate, run its identity condition
directly under `SET LOCAL ROLE anon` inside `BEGIN … ROLLBACK` and record whether it returns
**true**, **false**, or **NULL**. NULL means the check does not take effect.

**This task does not call the functions themselves and does not modify data.** Reading the
body and evaluating the predicate is sufficient and is what is wanted.

## Constraints

- Own git worktree off `origin/main`, at `~/Downloads/claude-code-repo/wt-noguard1`.
  **Never `~/Desktop`** — iCloud moved that directory to the Trash on 2026-08-07 and
  destroyed a clone's `.git`.
- **No migrations. No function changes. No grant changes.** Inventory only.
- All queries read-only, inside `BEGIN … ROLLBACK`.
- Sarah's document `704c8d2d-…` is a live negotiation — do not query or write it.

## Reporting

`docs/reports/TASK-NOGUARD1-REPORT.md`. The full classified table, the consequence ranking
for everything that does not enforce, and a closing section on **what your method would
still miss.** That closing section is the most valuable part — the previous review's
equivalent section is what caused this task to exist.
