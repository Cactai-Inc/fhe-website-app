# TASK GUARDREST — the last 15 bare definer guards, and the RLS gap that goes live with `mod.employees`

**Plan of attack item 20.** Finishes the NULL-guard work CONTRACTORPHAN started.

---

# MEASURED IN PRODUCTION, 2026-08-12

**15 `SECURITY DEFINER` functions still contain `IF NOT (…)` with no `coalesce`.**
*(The plan said 29 — that number was stale; CONTRACTORPHAN closed more than was recorded.
**Re-run the query yourself before starting** and report the count you find.)*

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.prosecdef
   and p.prosrc ~ 'IF NOT \(' and p.prosrc !~ 'coalesce' order by 1;
```

```
add_contact_location · admin_account_action · admin_delete_invitation
admin_expire_invitation · attach_booking_horse · attach_horse_to_document
clone_contract_template · deal_autocomplete_on_execution · lease_edit_guard
propose_community_event · purge_account · request_booking_change
resend_executed_document_email · set_form_required · update_contact_record
```

## Why this is a defect and not style

**With no signed-in user, `auth.uid()` and `current_org()` are NULL.** So
`IF NOT (has_staff_access() AND v_org = current_org())` evaluates to NULL — **and an `IF` whose
condition is NULL does not run its body.** The `RAISE` is skipped and execution **falls through
to the operation the guard was protecting.**

**This is not theoretical.** CONTRACTORPHAN proved the platform owner deleting an FHE tenant
document through exactly this hole. **`purge_account` is on the list above.**

**The repair is `coalesce(…, false)`** — and **D1a proves it is safe**: `admin@cactai.io` has
`org_id` NULL **by design**, so being denied is the *correct* outcome. Three threads reported
that denial as breakage; all three were wrong.

---

# ALSO IN SCOPE

## The MANAGER/EMPLOYEE RLS gap — **it goes live the day `mod.employees` gets a user**

```
documents_select = is_admin() OR caller_owns_document(id) OR caller_is_document_party(id) OR …
```

`is_admin()` is **ADMIN or SUPER_ADMIN only**. The frontend's `requireStaff` is
`has_staff_access()` — **ADMIN, SUPER_ADMIN, MANAGER, EMPLOYEE**. So a MANAGER walks through the
frontend gate onto `/app/ops/documents` and RLS returns only what they personally own or are a
party to — **a near-empty queue on a page that says it is the full queue.** Same shape on
`contacts_select` and `horses_select`.

**Dormant today** — production is ADMIN(2), SUPER_ADMIN(1), USER(10), zero MANAGER, zero
EMPLOYEE. **`TASK-PAGEVIS` is enabling `mod.employees`**, which is what makes those roles real.

**Decide and state which is right**, then make them agree: either RLS widens to
`has_staff_access()`, or the frontend gate narrows to `is_admin()`. **A nav that admits someone
to a page RLS will not fill is the defect, whichever way it is resolved.**

## `anon` holds EXECUTE on three composition RPCs

ADDITEM found: `anon` holds EXECUTE on `add_contract_composition`,
`remove_contract_composition` and `add_contract_element`; the last also still grants `PUBLIC`.
**Not exploitable — all three raise `authentication required` on NULL auth** — but the grants
should not be there.

**⚠️ `CREATE FUNCTION` grants EXECUTE to PUBLIC by default, and direct grants SURVIVE
`REVOKE … FROM PUBLIC`.** A revoke that reports success may have changed nothing — **that has
happened three times in this repo.** After every revoke, **re-read `has_function_privilege()`
for `anon`, `authenticated` and PUBLIC and paste the raw output.**

## No trigger provisions `profiles` at signup

**2 of 10 auth users have no `profiles` row.** So a fresh signup starts as exactly the NULL-org
caller this whole task hardens against. **Diagnose it and report — do not build the trigger
here** unless it is genuinely small, and say which you did.

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-guardrest`, branch `task/guardrest`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **Change the guard, never the logic.** `coalesce(x, false)` and nothing else. If a function
  needs more than that, **report it**.
- **D1a — never give `admin@cactai.io` an org.** Denial is correct for it.
- **`purge_account` is on the list and is destructive.** Fix its guard; **change nothing else in
  it.**
- **`lease_edit_guard` and `deal_autocomplete_on_execution` sit on the contract path** —
  `TASK-TEXTEDIT` is running there. Coordinate: guard-only changes should not collide, but
  **rebase before you finish**.
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.** Dry-run in `BEGIN; … ROLLBACK;`, apply, verify.
- **`test:db` is broken** (60 of 68 files fail) — **do not cite it as proof.** Verify against
  production.
- **61 EXECUTED documents are evidence.** THE SIGNING FREEZE IS IN FORCE.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. The bare-guard query returns **zero rows** — pasted before and after.
2. **Each of the 15 is shown to still deny the caller it denied before**, and to now deny a
   NULL-auth caller. Prove at least `purge_account` explicitly.
3. The MANAGER/EMPLOYEE mismatch is resolved in **one** direction, stated, with RLS and the
   frontend gate agreeing.
4. The three `anon` grants are gone, proven by `has_function_privilege()` output pasted raw —
   **not by the revoke reporting success**.
5. The missing signup trigger is diagnosed and either built or reported, explicitly.

Report to `docs/reports/TASK-GUARDREST-REPORT.md`.
