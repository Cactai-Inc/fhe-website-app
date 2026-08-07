# TASK SECFIX2 — close the last anon path, and fix member_directory properly

Two items left over from `TASK-SECFIX` (merged, `6b643f1`). Neither is as urgent as the
three that task closed, but the first is a live path around a fix we just applied.

---

## The rule that must carry forward

**`REVOKE` reporting success proves nothing.** Both fixes prescribed in SECFIX were silent
no-ops as written:

- **S2** — `REVOKE UPDATE (contact_id)` did nothing, because the grant was **table-level**.
- **S3** — `REVOKE … FROM anon` did nothing, because the ACL carried **`=X/postgres`**, a
  grant to **PUBLIC**.

Both would have committed cleanly, reported `REVOKE`, and left the hole open.

**After every revoke in this task, re-check `has_table_privilege()` /
`has_column_privilege()` / `has_function_privilege()` and put the raw output in the
report.** Do not trust the command's own output.

---

## G1 — `ensure_gift_buyer_account` is a live path around S3

`_ensure_client_account` was locked down in S3 — its ACL is now `postgres` and
`service_role` only. But `ensure_gift_buyer_account(p_gift_id uuid)` is:

- `SECURITY DEFINER`,
- **executable by PUBLIC** (`=X/postgres` in its ACL, so `anon` and `authenticated` both
  reach it), and
- **a caller of `_ensure_client_account`.**

So `anon` can still reach the locked function indirectly.

**It has no client caller.** Nothing in `src/` or `api/` invokes it — only other database
functions do, and those run with their own rights and do not depend on the PUBLIC grant.
**Confirm that yourself**, then revoke `EXECUTE` from `PUBLIC`, `anon` and `authenticated`.

### `redeem_gift` is DIFFERENT — do not revoke it

It carries the same PUBLIC grant and also calls `_ensure_client_account`, but its exposure
is **intentional**:

- called from `src/lib/gifts.ts` as `supabase.rpc('redeem_gift', { p_code })`,
- `/redeem` is an **unauthenticated route**, and
- a gift recipient by definition may not have an account yet — provisioning one is the
  point.

Revoking it breaks gift redemption. **Verify this reading before you accept it**, and if
you conclude otherwise, stop and report rather than revoking.

---

## G2 — `member_directory` still bypasses RLS

The other four views took `security_invoker = true`. This one could not: with RLS applied,
an ordinary member's directory collapses **6 rows → 1**, because `profiles_select_own` and
`contacts_select` restrict a non-admin to their own row. It would break
`fetchMemberDirectory()` and `fetchMemberProfile()` — every other member's profile page
would 404.

SECFIX revoked `anon`'s SELECT, so it is no longer publicly readable. But it remains
`postgres`-owned with `security_invoker` off, so **any authenticated caller reads every
row, and RLS never runs.**

### The fix: a `SECURITY DEFINER` RPC — not new SELECT policies

**Orchestrator's decision.** The alternative — directory-scoped SELECT policies on
`profiles` and `contacts` — was considered and rejected:

> A policy granting members read access to other members' `profiles` and `contacts` rows
> applies **everywhere those tables are read**, not only in the directory. Those rows carry
> dates of birth, home addresses, emergency contacts, and the `hide_*` flags that
> `TASK-ACCTEVAL` found have no UI to set. Widening table-level access to solve one view's
> problem is the larger risk.

A definer RPC returns exactly the directory's columns for exactly the directory's purpose.
It also matches the pattern already in use — `my_documents()` and
`contract_document_detail()` are both definer RPCs solving this same "cross-row read that
RLS cannot express" problem.

Requirements:

1. A definer RPC returning the directory rows, **exposing only the columns the directory
   actually needs.**
2. It must **enforce the `hide_*` flags itself.** They are the only thing that ever gated
   the legacy `contacts.mobile` / `.whatsapp` / `.email` columns, and with RLS bypassed
   nothing else does.
3. Repoint `fetchMemberDirectory()` and `fetchMemberProfile()` at it.
4. **Then drop the view, or set `security_invoker = true` on it** so nothing can read it
   the old way. Leaving both paths alive re-creates the hole.
5. Must **require an authenticated caller** — no anonymous reads.

---

## Verification

For each item, prove **both** that the hole is closed **and** that legitimate use survives.
A lockout is worse than the exposure.

1. **G1:** `has_function_privilege` for `anon`, `authenticated` and PUBLIC on
   `ensure_gift_buyer_account` — all false. Then exercise the gift flows that call it
   indirectly and confirm each still completes.
2. **G1 negative:** `redeem_gift` still executes for `anon`, and gift redemption still works
   end to end from the public `/redeem` route.
3. **G2:** the directory returns the same rows to a real member as it does today
   (**6**, verified against production before you start). Confirm a member can still open
   another member's profile.
4. **G2:** the `hide_*` flags are honoured — set one in a rolled-back transaction and
   confirm the column disappears from the RPC's output.
5. **G2:** `anon` gets nothing from the RPC and nothing from the view.
6. Row counts unchanged across `contacts`, `clients`, `profiles`, `documents`.

## Constraints

- Own git worktree off `origin/main`.
- **Separate migrations for G1 and G2**, each revertable alone.
- Dry-run every migration in `BEGIN … ROLLBACK` with raw output shown, then apply.
- **Do not add SELECT policies to `profiles` or `contacts`.** That is the rejected approach.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.

## Reporting

`docs/reports/TASK-SECFIX2-REPORT.md`, with the post-revoke `has_*_privilege()` output for
every revoke, and before/after row counts for the directory.
