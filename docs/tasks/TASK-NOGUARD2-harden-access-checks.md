# TASK NOGUARD2 — make identity checks take effect

**Depends on `TASK-NOGUARD1`.** Do not start until its report exists — it produces the list
this task acts on, ranked by consequence.

---

## The repair pattern — already proven in production

Applied 2026-08-07 in `20260808T0300_payment_guards_fail_closed.sql` to three payment
functions. Follow its shape.

The problem: with no signed-in user, `auth.uid()` and `current_contact_id()` are NULL, so
identity comparisons return NULL rather than false. `false OR NULL OR NULL` is NULL,
`NOT NULL` is NULL, and an `IF` on NULL skips its body — the check never runs.

The repair:

```sql
-- before
IF NOT (has_staff_access() OR v_p.buyer_user_id = auth.uid()
        OR v_p.buyer_contact_id = current_contact_id()) THEN

-- after
IF NOT coalesce(has_staff_access() OR v_p.buyer_user_id = auth.uid()
        OR v_p.buyer_contact_id = current_contact_id(), false) THEN
```

**An undetermined result becomes a denial.** Nothing else in the body changes, and every
caller that currently works evaluates the predicate to true and is unaffected — only the
undetermined case changes, and only to denied.

For functions with **no** check at all, add one appropriate to the function's purpose. Do
not paste a staff check onto something meant to be used by ordinary members.

## Two things that will break if you are careless

### 1. `service_role` looks the same as an unidentified caller

`api/_lib/supabaseAdmin.ts` reaches the database through PostgREST with the service key, so
**`service_role` also reports `session_user = 'authenticator'`**. A check written on
`session_user` alone will lock out server-side work. Use `auth.role() = 'service_role'` where
a server path must be allowed.

**Before changing any function, list its callers.** If it is called from `api/`, it has a
server-side path that must keep working. The three payment functions repaired on 2026-08-07
had **no** `api/` callers, which is why that fix was safe — do not assume the same here.

### 2. A revoke that reports success may have done nothing

Three separate times in this repo a `REVOKE` reported success and changed nothing:

| case | why |
|---|---|
| column-level revoke against a **table-level** grant | `SECFIX` S2 |
| `FROM anon` against a **PUBLIC** (`=X/postgres`) grant | `SECFIX` S3 |
| `FROM public` against a **role-held `anon`** grant | `NULLUID` |

A later review found **both** of the last two present simultaneously on all eight functions
it touched. **After every revoke, re-check `has_function_privilege()` and put the raw output
in the report. Never trust the command's own output.**

Also: `CREATE FUNCTION` grants EXECUTE to PUBLIC by default, so a newly created function
needs an explicit `REVOKE … FROM PUBLIC, anon` or it ships publicly reachable.

## Prefer fixing the check over removing the grant

The most durable result from the previous review was that `contact_dossier` and
`inbound_open_count` were **never revoked**, yet began enforcing correctly once the
underlying predicate was repaired. **Fix the check first; adjust grants second, and only
where a function should not be reachable at all.**

## Leave these alone

- **`redeem_gift`** — self-enforcing (`IF auth.uid() IS NULL THEN RETURN 'not_authenticated'`).
  Keep its grant. Do not repeat the older, incorrect rationale about `/redeem`.
- **`open_gift`** — the gift code is the credential; this is what lets a recipient view a
  gift before having an account. Do not add an identity gate.
- The public catalog read path — the marketing site has no session.

**Where you are unsure, report rather than change.** Locking out a legitimate user is worse
than the exposure being fixed.

## Verification

For every function changed:

1. The identity check now returns **false**, not NULL, for an unidentified caller — show the
   predicate evaluation.
2. **The legitimate caller still works** — exercise it, do not reason about it. Include staff
   and ordinary-member paths as applicable, and any `api/` path.
3. Post-change `has_function_privilege()` for `anon`, `authenticated` and PUBLIC, raw.
4. Row counts unchanged across `documents`, `signatures`, `contacts`, `profiles`,
   `purchases`, `members`.
5. Re-run NOGUARD1's classification and show the **DOES NOT ENFORCE** list shrinking, with
   anything deliberately left listed and justified.

## Constraints

- Own git worktree off `origin/main`, at `~/Downloads/claude-code-repo/wt-noguard2`.
  **Never `~/Desktop`.**
- Separate migrations per logical group, each revertable alone.
- Dry-run in `BEGIN … ROLLBACK` with raw output shown, then apply.
- **Migrations that rewrite function bodies must assert the rewrite matched.** This repo has
  ~31 body-rewriting migrations, and a replacement that matches nothing silently no-ops and
  reports success. `20260808T0300` shows the assertion pattern.
- **Do not modify real data to demonstrate a fix.** Evaluating the predicate is sufficient.
- `ClauseDocument.tsx` is FROZEN. Sarah's document `704c8d2d-…` is a live negotiation —
  read-only, never write.

## Reporting

`docs/reports/TASK-NOGUARD2-REPORT.md`. Raw before/after per function, the caller list you
based each decision on, and an explicit statement of what you verified yourself versus
assumed.
