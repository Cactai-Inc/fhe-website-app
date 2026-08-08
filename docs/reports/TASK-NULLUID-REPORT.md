# TASK NULLUID — report

Branch `task/nulluid`, worktree off `origin/main` @ `8facc04`. All four migrations are
**applied to production** (`lrstswfxfsezdmvkvukc`) and verified.

---

## Headline

`set_org_module` was confirmed exploitable, and is fixed. But it was **not** the
interesting finding. Widening the search as instructed turned up a **second, larger
family with the same root cause and a different spelling** — and one member of it was a
live, unauthenticated read of the tenant's entire admin dossier.

The narrow first pass looked for `auth.uid()` in the guard. The bigger hole never
mentions `auth.uid()` at all:

```sql
IF NOT has_staff_access() THEN RAISE EXCEPTION 'staff access required'; END IF;
```

`has_staff_access()` is built on `app_role()` = `SELECT role FROM profiles WHERE user_id
= auth.uid()`. For anon there is no row, so `app_role()` is NULL, so the predicate is
**NULL** — and `NOT NULL` is NULL, which is not TRUE, so **the IF body never runs**. The
guard reads like a deny and behaves like an allow. Same root cause (a NULL `auth.uid()`),
one layer of indirection away.

Measured in prod as `anon`, before any change:

```
 uid | is_admin | is_super_admin | has_staff_access | app_role | not_supadmin | guard_would_fire
-----+----------+----------------+------------------+----------+--------------+------------------
     | f        |                |                  |          |              | f
```

`is_admin()` is `f` because it already had `COALESCE(…, false)`. The other three are
blank — NULL. `guard_would_fire` = **f**.

---

## What was found — the full list

**52 functions** in the family: anon-executable, `SECURITY DEFINER`, authorisation
depending on `auth.uid()` being NULL in some spelling, with no preceding
`auth.uid() IS NULL` deny.

### 1. Confirmed exploitable, direct spelling — `set_org_module` (FIXED)

```sql
IF NOT is_super_admin() AND auth.uid() IS NOT NULL THEN RAISE …
```

Reproduced independently as `anon` over the real PostgREST endpoint, project anon key
only, before the fix:

```
POST /rest/v1/rpc/set_org_module {"p_org":"00000000-…0000","p_key":"PROOF_OF_CONCEPT"}
  → HTTP 400 {"code":"P0001","message":"unknown organization: 00000000-0000-0000-0000-000000000000"}
POST /rest/v1/rpc/set_org_module {"p_org":"e656f20b-…","p_key":"PROOF_OF_CONCEPT"}
  → HTTP 400 {"code":"P0001","message":"unknown module: PROOF_OF_CONCEPT"}
```

Authorisation passed entirely; it failed on **data validation**. No module was flipped.

### 2. The NULL-propagating-predicate family — 49 exposed (FIXED at the root)

Guard shapes and whether they fired for anon, evaluated against prod under the pre-fix
semantics:

| Guard shape | Fires for anon? | Verdict |
|---|---|---|
| `IF NOT has_staff_access()` | **no** | exposed |
| `IF NOT (has_staff_access() AND v_org = current_org())` | **no** (`current_org()` is NULL too) | exposed |
| `IF NOT (has_staff_access() OR caller_is_document_party(…))` | **no** | exposed |
| `IF app_role() <> 'SUPER_ADMIN'` | **no** (`NULL <> 'x'` is NULL) | exposed |
| `IF NOT (has_staff_access() AND is_admin())` | **yes** | already safe |
| `IF is_super_admin() IS NOT TRUE` | **yes** | already safe (`provision_tenant`) |

**Exploit proven, not merely inferred.** As `anon`, unauthenticated, before the fix:

```
POST /rest/v1/rpc/platform_tenant_detail {"p_org_id":"e656f20b-…"}
  → HTTP 200
  → {"org":{"id":"e656f20b-…","name":"French Heritage Equestrian","slug":"fhe",
             "status":"ACTIVE","display_code":"ORG-000001",…},
     "usage":{"horses":3,"members":9,"contacts":26,"documents":66,"engagements":7},
     "admins":[{"name":"CJ Z","role":"ADMIN","email":"admin@fhequestrian.com",
                "user_id":"b45a5503-…"},
               {"name":"Claire Bourdon","role":"ADMIN","email":"hello@fhequestrian.com",
                "user_id":"fdbdfe89-…"}],
     "modules":[…]}
```

An unauthenticated reader obtained the tenant record, per-table row counts, and **every
staff account's name, email address and user id**. `inbound_open_count()` likewise
returned `0`/HTTP 200 rather than raising. Both are reads, so nothing was written to
prove it — consistent with the instruction not to flip real data.

The other two `platform_*` functions carry the identical guard and are **writes**:
`platform_set_tenant_module` (entitlements for any org) and `platform_set_tenant_status`
(can SUSPEND or ARCHIVE a tenant). Neither was exercised.

The 49 exposed:

`add_contact_location`, `archive_contract`, `assign_horse_section`,
`capture_horse_record_info`, `claim_document_origination`, `contact_dossier`,
`contract_event_log`, `create_contract_note`, `create_evaluation_report`,
`deal_activity`, `deal_detail`, `deal_record_export`, `deliver_evaluation_report`,
`document_parties_summary`, `gift_claim_link`, `gift_mark_sent`, `gift_reschedule`,
`gift_transfer`, `hard_delete_contract`, `horse_page_detail`, `inbound_open_count`,
`lease_edit_guard`, `link_contract_to_purchase`, `platform_set_tenant_module`,
`platform_set_tenant_status`, `platform_tenant_detail`, `post_contract_note_message`,
`propose_community_event`, `publish_open_slots`, `require_resign_from`,
`resolve_version_decision`, `save_evaluation_report`, `set_contact_required_documents`,
`set_contact_type`, `set_field_included`, `set_field_na`, `set_form_required`,
`set_lesson_progress_note`, `set_org_module`, `sign_start_register_attempt`,
`staff_assign_documents`, `staff_assign_horse_party`, `staff_end_horse_relationship`,
`staff_request_horse_record_completion`, `staff_update_horse`,
`transfer_payment_responsibility`, `update_contact_record`, `update_horse_record`,
`update_purchase_payment_method`

Many would have returned little once past the guard, because they also scope reads by
`current_org()`, which is NULL for anon — `inbound_open_count` returning `0` is that
effect. That limits the blast radius of some; it is not a defence, and the writers in the
list are not limited that way.

### 3. Not exploitable — assessed and left alone

| Function | Shape | Read |
|---|---|---|
| `admin_account_action`, `admin_delete_invitation`, `admin_expire_invitation` | `NOT (has_staff_access() AND is_admin())` | **Safe already.** `NULL AND false` is `false`, so the guard fired. Revoked anyway (defence in depth). |
| `provision_tenant` | `IF is_super_admin() IS NOT TRUE` | **Safe already** — written correctly and commented as such. This is the pattern the rest should have used. |
| `record_invitation_failure` | `IF auth.uid() IS NOT NULL THEN` | **Low risk, as expected.** The NULL branch is a *lookup* (fetch the caller's email), not a guard; a NULL uid makes the recorded reason *less* specific, not the call more permissive. It has no caller check at all, but it is reached from the unauthenticated invite flow by design and the token is the credential. A token holder can burn that invitation and raise a staff notification — worth knowing, not a NULL-uid hole. Unchanged. |
| `redeem_gift` | `IF auth.uid() IS NULL THEN RETURN 'not_authenticated'` | Deny direction, and **intentionally public**. Explicitly not revoked. |
| `current_org()` | `WHEN auth.uid() IS NULL THEN <GUC>` | NULL-uid dependent but not an authorisation decision. Anon cannot set `app.current_org` through an RPC, so it yields NULL. Harmless. |
| `payer_candidates()` | `AND auth.uid() IS NOT NULL` in a `WHERE` | Restrictive direction — NULL uid returns no rows. Harmless. |
| `profiles_role_guard()` | `IF auth.uid() IS NULL THEN RETURN NEW` (trigger) | The dangerous shape, but a **trigger**, not directly callable. Second-order reachability checked: the six anon-executable definers that write `profiles` are `mark_tour_seen`, `redeem_invitation`, `provision_tenant`, `admin_account_action`, `ensure_staff_profile`, `sync_profile_name_from_contact` — all either guarded or trigger/internal, and RLS `profiles_update_own` evaluates false for anon. **Left as-is and flagged**: it is a latent hazard, not a live one, and changing a trigger on `profiles` deserves its own task. |
| ~50 functions with `IF auth.uid() IS NULL THEN RAISE 'authentication required'` | deny direction | Correct. No action. |

---

## What was changed

Four migrations, each revertable alone.

| Migration | What |
|---|---|
| `20260807150000_nulluid_set_org_module_deny_by_default.sql` | `set_org_module` deny-by-default, LEASEFORK shape |
| `20260807160000_nulluid_predicates_fail_closed.sql` | `has_staff_access` / `is_org_admin` / `is_super_admin` → `COALESCE(…, false)` |
| `20260807170000_nulluid_platform_app_role_guards.sql` | the three `platform_*` guards → `coalesce(app_role(),'') <> 'SUPER_ADMIN'` |
| `20260807180000_nulluid_revoke_platform_admin_execute.sql` | revoke EXECUTE from PUBLIC **and** anon on 8 platform/admin functions |

The `set_org_module` guard:

```sql
IF NOT (
     coalesce(is_super_admin(), false)
  OR coalesce(auth.role(), '') = 'service_role'
  OR (session_user IN ('postgres','supabase_admin') AND coalesce(auth.role(),'') = '')
) THEN
  RAISE EXCEPTION 'set_org_module is restricted to SUPER_ADMIN / the billing service'
    USING errcode = 'insufficient_privilege';
END IF;
```

**Why `session_user` alone would have caused the outage.** The task pointed at
`session_user`, and it is the right signal — measured in prod, an anon web request inside
a `SECURITY DEFINER` sees:

```
{"auth_uid": null, "auth_role": "anon", "current_user": "postgres", "session_user": "authenticator"}
```

`current_user` reports the owner and is useless; `session_user` is the real session role.
But `api/_lib/supabaseAdmin.ts` reaches Postgres through PostgREST with the service_role
key, so **the billing path also has `session_user = 'authenticator'`**. Guarding on
`session_user` alone would have denied it. The `auth.role() = 'service_role'` term is what
keeps the billing seam working — it is the honest spelling of what the old NULL-uid check
was reaching for.

**Why the `coalesce(auth.role(),'') = ''` half is load-bearing.** The DB test harness is
PGlite, whose `session_user` is always `postgres` — measured, not assumed:

```
PGlite: [{"su":"postgres","cu":"postgres"}]
```

Without that half, `session_user IN ('postgres',…)` would be true for *every* test caller
and `provision_tenant.test.ts`'s "rejects a non-super authenticated caller" would stop
rejecting. A real psql session has no `request.jwt.*` GUC, so `auth.role()` is NULL;
anything through PostgREST always carries a verified role claim. That distinction is what
the branch now tests. **Note for TASK-LEASEFORK: `clone_contract_template` uses the bare
`session_user IN (…)` form and has the same PGlite property** — not exploitable in prod
(a web caller is `authenticator`), but worth the same tightening.

---

## Verification

### Before → after, as `anon`, over the real PostgREST endpoint

| Call | Before | After |
|---|---|---|
| `set_org_module` (valid org, bogus module) | `400 unknown module: PROOF_OF_CONCEPT` — **past authz** | `401 42501 permission denied for function set_org_module` |
| `set_org_module` (valid org, **real** module `mod.boarding`) | — | `401 42501 permission denied` |
| `platform_tenant_detail` | `200` + full admin dossier | `401 42501 permission denied` |
| `platform_set_tenant_module` | (same guard) | `401 42501 permission denied` |
| `inbound_open_count` | `200 → 0` — **guard did not fire** | `400 P0001 staff access required` |
| `contact_dossier` | (same guard) | `400 P0001 staff access required` |

The last two are **not revoked** — anon still holds EXECUTE. They now deny purely because
of the predicate fix, which is the proof that migration 2 closes the family independently
of grants.

### Predicates as `anon`, live, post-apply

```
 has_staff | is_org_admin | is_super | is_admin | app_role | staff_guard_fires
-----------+--------------+----------+----------+----------+-------------------
 f         | f            | f        | f        |          | t
```

### The billing path — the thing most likely to break

Real write, as `service_role` with `auth.uid()` NULL, rolled back:

```
  acting_as   | uid
--------------+-----
 service_role |

 set_org_module
----------------

  module_key  | enabled |    source
--------------+---------+--------------
 mod.boarding | t       | SUBSCRIPTION     ← write succeeded

-- after ROLLBACK, baseline intact:
  module_key  | enabled | source |          updated_at
--------------+---------+--------+-------------------------------
 mod.boarding | f       | GRANT  | 2026-07-09 14:09:00.379279+00
```

Also verified, all four caller shapes:

| Caller | Result |
|---|---|
| `service_role` (billing) | **writes** ✓ |
| `SUPER_ADMIN` (authenticated) | **writes** ✓ (`mod.boarding → t / SUBSCRIPTION`, rolled back) |
| plain authenticated user | `denied -> set_org_module is restricted to SUPER_ADMIN / the billing service` ✓ |
| `anon` | `denied -> permission denied for function set_org_module` ✓ |
| tenant `ADMIN` (authenticated staff) | `has_staff_access = t`, `inbound_open_count() = 8` — unaffected ✓ |
| `SUPER_ADMIN` → `platform_tenant_detail` | still returns the dossier ✓ |

**No production data was modified.** `org_modules` baseline is byte-identical
(`mod.boarding`, `enabled=f`, `source=GRANT`, `updated_at 2026-07-09`). Every write was
inside `BEGIN … ROLLBACK`. Every exploit proof stopped at data validation or was a read.

### The grants — raw `has_function_privilege()`, not the REVOKE output

Every one of these carried **both** trap grants at once: a PUBLIC `=X/postgres` *and* a
role-held `anon=X/postgres`. Revoking either alone is a silent no-op.

**Before:**

```
          proname           | anon | authed | svc | public_grant
----------------------------+------+--------+-----+--------------
 admin_account_action       | t    | t      | t   | t
 admin_delete_invitation    | t    | t      | t   | t
 admin_expire_invitation    | t    | t      | t   | t
 platform_set_tenant_module | t    | t      | t   | t
 platform_set_tenant_status | t    | t      | t   | t
 platform_tenant_detail     | t    | t      | t   | t
 provision_tenant           | t    | t      | t   | t
 redeem_gift                | t    | t      | t   | t
 set_org_module             | t    | t      | t   | t
```

**After:**

```
          proname           | anon | authed | svc | public_grant
----------------------------+------+--------+-----+--------------
 admin_account_action       | f    | t      | t   | f
 admin_delete_invitation    | f    | t      | t   | f
 admin_expire_invitation    | f    | t      | t   | f
 platform_set_tenant_module | f    | t      | t   | f
 platform_set_tenant_status | f    | t      | t   | f
 platform_tenant_detail     | f    | t      | t   | f
 provision_tenant           | f    | t      | t   | f
 redeem_gift                | t    | t      | t   | t     ← untouched, intentionally public
 set_org_module             | f    | t      | t   | f
```

Full ACL, showing the PUBLIC entry is genuinely gone:

```
    proname     |           acl
----------------+--------------------------
 redeem_gift    | =X/postgres             +      ← PUBLIC grant intact by design
                | postgres=X/postgres     +
                | anon=X/postgres         +
                | authenticated=X/postgres+
                | service_role=X/postgres
 set_org_module | postgres=X/postgres     +      ← no `=X/`, no `anon=`
                | authenticated=X/postgres+
                | service_role=X/postgres
```

`authenticated` is deliberately kept: `set_org_module` is called from
`src/pages/app/ops/admin/AdminModulesPage.tsx`, `provision_tenant` from
`ProvisionTenantPage.tsx`, the `platform_*` trio from `TenantDetailPage.tsx` — all by
authenticated staff. Those are now fenced by guards that actually fire.

### Test suite

`npm run test:db` is **broken on `main` before this change** — 55 of 64 files fail in
`beforeAll` setup (`duplicate key … organizations_display_code_key`, `products_module_key_fkey`).
That is pre-existing and unrelated.

To avoid claiming more than I checked, I diffed the suite with and without my change:

- `provision_tenant.test.ts` / `entitlements.test.ts` / `roles.test.ts`: identical results
  both ways (2 failed, 1 passed; same setup errors).
- `business_identity.test.ts` (the only file that looked like a new failure in a
  whole-suite run): **3 failed on the unmodified baseline too** — the delta was vitest
  scheduling, not my change.
- Full suite both ways: same 55 failed / 9 passed files.

**Net new test failures from this change: zero.** The `set_org_module` assertions could
not actually be exercised, because that file already fails at setup on `main`.

I also synced the seven changed bodies into `test/db/fixtures/schema_snapshot.sql` so the
fixture matches prod. The repo's convention is batch regeneration, not per-migration, so
this is a small deviation — made because the PGlite/`session_user` hazard above lives
exactly in that fixture, and I wanted the harness to exercise the real guard.

---

## What this search would still miss

Stated plainly, because the last pass was too narrow and this one has its own edges.

1. **Anon-callable definers with no identity check at all.** A different bug family, and
   probably the larger one — `TASK-SECFIX` S3 (`_ensure_client_account`) was exactly this.
   My queries all keyed on a guard *existing*. A function with no guard never matches.
   **Not audited here. This is the single biggest remaining gap.**
2. **Other NULL-propagating helpers.** I enumerated zero-arg, non-volatile boolean
   predicates and tested each as anon, which found `has_staff_access`, `is_org_admin`,
   `is_super_admin`. Predicates **taking arguments** (`caller_is_document_party(uuid)`,
   `caller_owns_horse(uuid)`, `is_platform_profile(text,uuid)`) were not evaluated —
   they need real arguments. If any returns NULL for anon, the same `NOT …` trap applies.
3. **Multi-line guards.** Line-level extraction; a guard split across lines such that no
   single line holds both the predicate and the negation could slip through. I mitigated
   with whole-body regexes but did not read all 326 bodies.
4. **Guards in RLS policies rather than function bodies.** I checked policies for
   *negated* use of the three predicates (none) but did not audit all 70 for NULL logic.
5. **Dynamic SQL.** Nothing in-scope used `EXECUTE format(...)` for a guard, but a
   body-text search cannot see a guard that is assembled at runtime.
6. **`authenticated` as the threat model.** Everything here is about `anon`. Several of
   these functions remain callable by any signed-up account, fenced only by the guard. A
   pass with "one signup away" as the attacker is a separate and worthwhile task.
7. **Supabase default grants.** `pg_default_acl` still grants EXECUTE on every *new*
   public function to `anon`. Until that default changes, this class regenerates itself
   with each new function. I did not change it — it is a project-wide decision, and
   changing it silently would surprise the next migration author.

---

## Recommended follow-ups

1. **Audit the no-guard family** (gap 1) — likely bigger than this one.
2. **`profiles_role_guard`'s `auth.uid() IS NULL → RETURN NEW`** — latent, deserves its own task.
3. **Tighten `clone_contract_template`** with the same `auth.role()` half (PGlite hazard).
4. **Fix the `test:db` setup breakage on `main`** — 55/64 files failing means this suite
   is currently not protecting anything.
5. **Decide on `pg_default_acl`** for new public functions.

---

## Unrelated incident during this session — worktrees moved to Trash

At ~17:09 the Desktop directory was emptied into `~/Library/Mobile Documents/.Trash`:
`fhe-website-app` (the main repo, including its `.git`) and all five sibling worktrees —
`accountsurface`, `bp410`, `onemenu`, `secfix`, `tiptap`. Desktop is iCloud-synced, which
is the likely cause; **no command in this session touched those paths.**

I restored all six to `~/Desktop` and verified `git worktree list` — all seven worktrees
are intact and on their expected branches (main `795114c`, plus `task/accountsurface`
`02efb58`, `task/bp410` `cefb173`, `task/onemenu` `91ea92e`, `task/secfix` `a7ccf43`,
`task/tiptap-tooltips` `74c1e98`). Flagged because other threads are working in those
worktrees and because the trigger is unexplained and may recur.
