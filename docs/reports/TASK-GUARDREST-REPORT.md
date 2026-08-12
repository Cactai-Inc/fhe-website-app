# TASK-GUARDREST — report

**Branch** `task/guardrest`, worktree `~/Downloads/claude-code-repo/wt-guardrest`, rebased onto
`origin/main` @ `62abef0` (D14). **Applied to production.** Not pushed.

Two migrations:

- `supabase/migrations/20260812T1200_guardrest_coalesce_bare_definer_guards.sql`
- `supabase/migrations/20260812T1210_guardrest_staff_rls_matches_the_nav.sql`

---

## The count, and a correction to the premise

**The query returns 15, as the task said.** But **the real number is 19**, and the reason the
query under-reports matters more than the number: its filter is `prosrc !~ 'coalesce'`, so **one
unrelated `coalesce` anywhere in a function body hides every bare guard in it.** Four functions
with the exact dangerous shape were invisible to it:

```
mark_comment_review · request_contract_termination · set_horse_locations · set_horse_medications
```

All four carry `IF NOT ((v_staff AND v_org = current_org()) OR …)` — the CONTRACTORPHAN pattern,
un-repaired. They are fixed here too. A shape-based query finds them:

```sql
select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname='public' and p.prosecdef
   and p.prosrc ~ '(has_staff_access\(\)|v_staff|v_is_staff) AND [^,]{0,80}current_org\(\)'
   and p.prosrc !~ 'coalesce\((has_staff_access\(\)|v_staff|v_is_staff) AND [^,]{0,120}current_org\(\), *false\)';
```

### The stated rationale is wrong, and the correction sharpens the defect

The task says a NULL-auth caller makes `has_staff_access() AND v_org = current_org()` go NULL and
the `RAISE` is skipped. **That is not what production does.** Both helpers already coalesce
internally:

```
has_staff_access() → SELECT COALESCE(app_role() IN ('SUPER_ADMIN','ADMIN','MANAGER','EMPLOYEE'), false)
is_admin()         → SELECT COALESCE(app_role() IN ('ADMIN','SUPER_ADMIN'), false)
```

So with no JWT they return **false, never NULL**, and `false AND <anything>` is `false` — the guard
fires. Measured, not reasoned: all 15 were probed as `anon` with no JWT **before** the change.
None fell through. Seven were stopped by their own guard, the rest by the EXECUTE grant.

**The hole is one step in from there: a caller who IS staff but whose `org_id` is NULL.** Then
`true AND NULL` = **NULL**, the `IF` skips, and execution falls through. That is exactly
`admin@cactai.io` — SUPER_ADMIN, `org_id` NULL by design (D1a). D1a states this precisely; the
task's anon framing does not.

The second family is NULL **data**, not NULL auth: `v_b.client_id = v_client` where `client_id`
is NULL, and `current_setting(…, true) = '1'` where the setting is unset.

---

## Three live holes, proven before and after

### 1. `attach_horse_to_document` — the platform owner writes to a tenant document

Same document, same horse, two callers. Neither is FHE staff, a party to the document, or the
horse's owner:

```
BEFORE
  A1. ordinary member            => not authorized for this document
  A2. platform owner (org NULL)  => ADMITTED (no error)
      BEFORE horse_id=a8e82033-cf9e-48aa-8ea5-a856f2ede597
      AFTER  horse_id=b33646c6-5129-4dd8-a7e4-87a787e3af8a   ← the write landed

AFTER
  A1. ordinary member            => not authorized for this document
  A2. platform owner (org NULL)  => not authorized for this document
      BEFORE horse_id=a8e82033-…   AFTER horse_id=a8e82033-…  ← unchanged
```

Guard expression measured directly as the platform owner: `guard_expr=NULL`.

### 2. `request_booking_change` — any member can act on 294 bookings that are not theirs

`bookings.client_id` is nullable and **294 rows are NULL**. For a member with a `clients` row,
`v_client IS NOT NULL AND v_b.client_id = v_client` → `true AND NULL` → NULL → guard skipped.

```
BEFORE  member vs booking 4a904dc1 (client_id NULL) => ADMITTED   change requests created: 1
AFTER   member vs booking 4a904dc1 (client_id NULL) => not your booking   change requests created: 0
AFTER   member vs booking 77e2f887 (their own)      => ADMITTED   rows_after=1   ← unbroken
```

It also flipped the booking's status to `pending`, so this was write access, not just a read.

### 3. `purge_account` — the structural gate goes NULL on the proof domain

`current_setting('app.purge_proof', true)` returns NULL when unset, so for a
`@purge-proof.invalid` address `false OR (true AND NULL)` = NULL → **the `RAISE` is skipped and
the purge proceeds.** Five scenarios, on a synthetic account, all inside `BEGIN … ROLLBACK`:

```
1. proof-domain, flag UNSET   => DENIED: … is not on the allowlist — refusing   account survived: true
2. proof-domain, flag SET     => ADMITTED (purge ran)                           account survived: false
3. sarahrosengard@gmail.com   => DENIED: … is not on the allowlist — refusing
4. admin@cactai.io            => DENIED: … is not on the allowlist — refusing
5. no PURGE token             => DENIED: purge_account: confirmation token required
post-rollback: auth.users count 12, unchanged
```

Scenario 1 is the repair. Scenario 2 proves the deliberate proof path still works. Nothing else
in the function was touched.

---

## The five acceptance tests

**1. The bare-guard query returns zero rows.**

```
BEFORE (15)                                    AFTER
add_contact_location                            proname
admin_account_action                           ---------
admin_delete_invitation                        (0 rows)
admin_expire_invitation
attach_booking_horse                           and the shape-based query, which the
attach_horse_to_document                       task's query cannot see:
clone_contract_template
deal_autocomplete_on_execution                  proname
lease_edit_guard                               ---------
propose_community_event                        (0 rows)
purge_account
request_booking_change
resend_executed_document_email
set_form_required
update_contact_record
```

**2. Each still denies who it denied before, and denies a NULL-auth caller.** The 14 executable
NULL-auth probes return byte-identical results before and after — no denial gained or lost. A
legitimate FHE tenant admin was re-tested against every behaviour-changing function and is still
ADMITTED: `attach_horse_to_document`, `set_horse_locations`, `set_horse_medications`,
`request_booking_change`, `update_contact_record`, `add_contact_location`, `lease_edit_guard`,
`resend_executed_document_email`, `propose_community_event`; `admin_expire_invitation` and
`set_form_required` reach their own not-found errors, i.e. past the guard. `purge_account` proven
explicitly above.

**3. The MANAGER/EMPLOYEE mismatch — resolved by widening RLS.** Below.

**4. The three `anon` grants are gone.** Raw output, not the revoke's say-so:

```
                                      sig                                      |    grantee    | execute_priv
-------------------------------------------------------------------------------+---------------+--------------
 public.add_contract_composition(uuid,jsonb)                                   | anon          | f
 public.add_contract_composition(uuid,jsonb)                                   | authenticated | t
 public.add_contract_composition(uuid,jsonb)                                   | public        | f
 public.add_contract_element(uuid,text,text,text,integer,text,text,jsonb,text) | anon          | f
 public.add_contract_element(uuid,text,text,text,integer,text,text,jsonb,text) | authenticated | t
 public.add_contract_element(uuid,text,text,text,integer,text,text,jsonb,text) | public        | f
 public.remove_contract_composition(uuid,text)                                 | anon          | f
 public.remove_contract_composition(uuid,text)                                 | authenticated | t
 public.remove_contract_composition(uuid,text)                                 | public        | f

                                   fn                                   |                                 proacl
------------------------------------------------------------------------+------------------------------------------------------------------------
 add_contract_composition(uuid,jsonb)                                   | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
 add_contract_element(uuid,text,text,text,integer,text,text,jsonb,text) | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
 remove_contract_composition(uuid,text)                                 | {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

The signatures in the task's source note were stale — the live ones are
`add_contract_composition(uuid,jsonb)` and the 9-arg `add_contract_element`. `authenticated` is
retained deliberately: these are the RPCs D14 has TASK-ADDITEM widening to `in_review`.

**5. The signup trigger is diagnosed, and NOT built.** Below.

---

## The MANAGER/EMPLOYEE gap — resolved by widening RLS

**`mod.employees` is already enabled** for the FHE org, `enabled_at 2026-08-12 15:02:21 UTC`,
source `GRANT`. So this is not pending; it is one account away.

**Decision: the three RLS SELECT policies move to `has_staff_access()`. The frontend gate does not
change.** The layer counts decide it:

| gate | where it is used |
|---|---|
| `has_staff_access()` | **185** SECURITY DEFINER functions **+ the frontend route gate** |
| `is_admin()` | 27 SECURITY DEFINER functions **+ these 3 RLS policies** |

Those 185 already let a MANAGER run `contact_dossier`, `staff_update_horse`, `credits_roster`,
`confirm_booking` and the rest of barn ops. **Narrowing the frontend to `is_admin()` would leave
every one of them open while locking the UI** — it relocates the incoherence instead of closing
it, and would need ~185 further guard edits to become honest. It would also contradict the owner's
reversal of the InstructorHome retirement (ADMINSWEEP M-6, *"wire up, don't retire"*), which says
instructor accounts are arriving, not leaving. **The three policies are the outlier, so they move.**

Proven by temporarily promoting one account inside `BEGIN … ROLLBACK`:

```
  as USER (role=USER)                  documents=  4  contacts=  1  horses=  0
  role now=MANAGER  has_staff_access=true  is_admin=false
  as MANAGER (after GUARDREST)         documents= 82  contacts= 31  horses=  4
  as tenant ADMIN (the full queue)     documents= 82  contacts= 31  horses=  4
post-rollback role check: USER
```

A MANAGER now sees exactly the full queue, with `is_admin()` still false. Before this, they would
have seen 4/1/0 on a page that says it is the whole queue — the defect as described.

**This does not re-open D1a.** Each of the three tables carries a **RESTRICTIVE**
`org_id = current_org()` policy that is AND-ed with the permissive one. `admin@cactai.io` has
`org_id` NULL, so that test is NULL and it still reads zero FHE rows. Verified: the platform owner
had no direct table read before or after — the definer fall-through this task closed was its only
way in.

**Read only.** `documents_admin_write` / `contacts_admin_write` / `horses_admin_write` stay
`is_admin()`. Staff writes already travel through definer RPCs that bypass RLS and gate on
`has_staff_access()`, so that is the existing architecture, not a new gap.

---

## No trigger provisions `profiles` at signup — diagnosed, NOT built

**There are zero triggers on `auth.users`.** Only three functions ever insert a `profiles` row:
`provision_tenant`, `redeem_gift`, `redeem_invitation`. Any account created by another path gets
an `auth.users` row and no profile. Both orphans are real, and they are two *different* paths:

| account | provider | invitation | what happened |
|---|---|---|---|
| `ashlanalexis22@gmail.com` (2026-07-16) | google | **none at all** | OAuth signup straight past the invite spine |
| `cjzigs+averify2@icloud.com` (2026-08-05) | email | **2, both still `sent`, neither redeemed** | account made directly ~35 min after the invites, so `redeem_invitation` never ran |

The open door is [src/lib/auth.ts:32](src/lib/auth.ts#L32) — `signUpWithPassword` calls
`supabase.auth.signUp()` and nothing follows it; OAuth has the same shape.

Such an account is inert rather than dangerous: `app_role()` NULL → `has_staff_access()` and
`is_admin()` false; `current_org()` / `current_contact_id()` / `current_client_id()` all NULL; and
the RESTRICTIVE `org_id = current_org()` gives it no rows anywhere. It can log in and see nothing.

**Not built, deliberately — it is not small.** A signup trigger has to decide org, contact linkage,
role and membership for an arbitrary self-service signup, which is a security decision, not a
default. It also collides with three settled rules: `promote_contact_to_account` is the **sole**
writer of `profiles.contact_id` (D5); CLIENT vs CUSTOMER marking is attached at invitation or
purchase (D8); and auto-granting an org to anyone who signs up is the same class of mistake as
giving `admin@cactai.io` an org, which D1a refuses. Guessing here would auto-provision tenant
membership for any stranger. **Recommend a separate task with an owner ruling on what a
self-service signup with no invitation is entitled to.**

---

## Flagged, not fixed

1. **A document points at a contract that does not exist.** `documents.contract_id` on
   `0360f829-4c31-4dc0-9b95-3489ee9a71cb` is `ae4ffe95-4662-4813-a16c-e7b5b5f325a4`, with no such
   `contracts` row. Any `attach_horse_to_document` on it dies on `documents_contract_id_fkey`
   inside the recompose. This is the armed defect TASK-SUPERSEDE recorded (docs referencing a
   vanished contract); it surfaced here as an incidental error during the proof. Out of scope —
   guard-only.
2. **294 bookings have `client_id` NULL.** The guard is now safe, but the data question stands:
   should staff-created bookings carry a client, and what is a NULL one for? Worth a ruling.
3. **The owner cannot create an instructor account.** `TeamPage` invites staff as `ADMIN` only
   (`const role = 'ADMIN' as const`), and the role dropdown offers MANAGER/EMPLOYEE *only if the
   account already holds one*. With zero such accounts, that path is unreachable — so the roles
   this RLS change just made real cannot be granted without a developer. **A D13 gap**: it now
   needs SQL. Small fix (add the options back), but it is a role/permission change, so it is the
   owner's call, not mine.
4. **`clone_contract_template` is not executable by `authenticated`** (`proacl` =
   `{postgres, service_role}`). Pre-existing and deliberate — `20260807130000_leasefork_clone_grant_hardening.sql`
   made it a psql/migration-only tool. Its `is_admin() OR session_user IN (…)` guard is coalesced
   here regardless. Not a regression.
5. **Write policies remain `is_admin()`** while reads are now `has_staff_access()`. Intentional
   (above), but recorded so the asymmetry is not rediscovered as a bug.

---

## Notes on method and limits

- **The guards were rewritten by exact-substring replacement of the live body, never re-typed.**
  Every replacement asserts its expected occurrence count *before* writing and re-reads
  `pg_get_functiondef` *after* to confirm the new text landed and the old text is gone; any
  mismatch aborts the migration. This is what makes "change the guard, never the logic"
  structurally true rather than a promise — it matters most on `purge_account`, which is
  destructive and 140 lines long. Both migrations were dry-run in `BEGIN … ROLLBACK` first
  (confirmed the rollback held: the query still returned 15), then applied, then verified.
- **`test:db` was not used and is not cited.** Everything above is measured against production.
- **The signing freeze was respected.** Every probe that could write ran inside
  `BEGIN … ROLLBACK`; the 61 EXECUTED documents were never touched. Post-run sanity checks
  confirm `auth.users` = 12 and the promoted role reverted to `USER`.
- **No frontend files changed**, so typecheck/lint/build were not run — there is nothing in this
  diff for them to check. The resolution direction (RLS widens, frontend stays) is what makes that
  true; had it gone the other way, ~25 routes would have changed.
- **Not pushed**, per the constraint.
