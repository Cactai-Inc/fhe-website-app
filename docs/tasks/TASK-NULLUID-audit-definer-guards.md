# TASK NULLUID — the "NULL uid means trusted" guard hole

**A fourth vulnerability of the same family, confirmed live in production.** Found by the
`TASK-LEASEFORK` thread in its own function, which correctly warned it was unlikely to be
the only one. It was not.

---

## The bug pattern

`service_role` has a NULL `auth.uid()`. So a guard gets written to let it through:

```sql
IF NOT is_super_admin() AND auth.uid() IS NOT NULL THEN
  RAISE EXCEPTION '… restricted to SUPER_ADMIN / the billing service';
END IF;
```

**`anon` also has a NULL `auth.uid()`.** So for an unauthenticated caller the second
condition is false, the whole `AND` is false, the exception never fires, and
`SECURITY DEFINER` does the rest.

### Confirmed exploitable: `set_org_module`

Orchestrator-verified against production, 2026-08-07. As `anon`:

- with a bad org id → *"unknown organization"* (line 11)
- with a **valid** org id → *"unknown module: PROOF_OF_CONCEPT"* (line 14)

It passed authorisation entirely and failed on **data validation**. With a valid module
key an unauthenticated caller could enable or disable org modules. Verification stopped
there deliberately — no module was flipped.

### Also compounding it: the grant

`REVOKE ALL ON FUNCTION … FROM public` **does not remove a grant held by the role `anon`**,
and Supabase's `pg_default_acl` grants EXECUTE on every new public function to `anon`. So a
function can be "revoked from public" and still be anon-executable. This is the third
distinct way a revoke has silently failed in this codebase:

| Where | Why the revoke did nothing |
|---|---|
| `TASK-SECFIX` S2 | column revoke against a **table-level** grant |
| `TASK-SECFIX` S3 | anon revoke against a **PUBLIC** (`=X/postgres`) grant |
| here | public revoke against a **role-held** (`anon`) grant |

**The rule, now three times over: after any revoke, re-check `has_*_privilege()` and put
the raw output in the report. Never trust the `REVOKE` output.**

---

## Scope

**326 `SECURITY DEFINER` functions in `public` are anon-executable.** Most are fine —
Supabase grants by default, and some are legitimately public (`redeem_gift` is reached from
the unauthenticated `/redeem` route; see `TASK-SECFIX2`).

You are hunting the dangerous subset. A narrow first pass found two candidates:

- **`set_org_module`** — confirmed exploitable, above.
- **`record_invitation_failure`** — its `auth.uid() IS NOT NULL` is used to look up an
  email, not as a guard. Assess it; it appears low risk.

**That pass was deliberately narrow** — it matched one spelling of the idiom and required a
literal `INSERT|UPDATE|DELETE` in the body. It would miss: guards spelled differently
(`coalesce(auth.uid(), …)`, `auth.role()`, a `v_uid` variable), functions that write via
another function, and anything using `IS NULL` on the other side of the comparison.
**Widen it.**

## What to do

1. **Audit.** Find every `SECURITY DEFINER` function in `public` that `anon` can execute
   **and** whose authorisation depends on `auth.uid()` being NULL, in any spelling. Report
   the full list with a risk read on each — exploitable, harmless, or intentional.
2. **Fix the confirmed one.** `set_org_module` must deny by default. `TASK-LEASEFORK`
   solved this correctly in `clone_contract_template` — **read that migration and follow
   its shape**: `SECURITY DEFINER` leaves `session_user` as the real session role while
   `current_user` reports the function owner, so `session_user` is what distinguishes a
   direct trusted session from an anon web caller.
3. **Fix the grants.** Revoke EXECUTE from `anon` and `authenticated` **explicitly by
   role** on anything that should not be publicly callable. `FROM public` is not enough.
4. **Do not revoke what is intentionally public.** `redeem_gift` is reached anonymously by
   design. Check each before revoking; where you are unsure, report rather than revoke.

## Verification

For each function you touch:

1. Reproduce the hole as `anon` **before** fixing, and capture it.
2. After fixing: `anon` gets `permission denied`, and **the legitimate caller still works**
   — including `service_role` / the billing path, which is what the NULL-uid check was
   protecting in the first place. Breaking that is the likeliest way to cause an outage
   here.
3. Post-revoke `has_function_privilege()` output for `anon`, `authenticated` and PUBLIC.

## Constraints

- Own git worktree off `origin/main`.
- Separate migrations for the audit fixes vs any grant sweep, each revertable alone.
- Dry-run in `BEGIN … ROLLBACK` with raw output, then apply.
- **Do not flip real data to prove a hole.** Reaching data validation past the guard is
  sufficient proof, as it was for `set_org_module`.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.

## Reporting

`docs/reports/TASK-NULLUID-REPORT.md`. The full audit list with a risk read on each, raw
before/after for every fix, and an explicit statement of what you checked versus what your
search would have missed.
