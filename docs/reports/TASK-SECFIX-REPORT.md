# TASK SECFIX — report

Worktree `/Users/Cactai/Desktop/fhe-worktree-secfix`, branch `task/secfix` off `origin/main`
(`4319a9a`). All database work against prod `db.lrstswfxfsezdmvkvukc.supabase.co`.

**Status: all three applied and verified — S2, then S1, then S3, in three separate
migrations, each revertable alone.**

One gap is deliberately left open and needs a decision: `member_directory` cannot take
`security_invoker` without a policy change, which this task forbids. See "S1 — the one
view that could not take the primary fix".

Everything below labelled "verified" was run by me against prod and the raw output is
pasted. Where I am reasoning rather than observing, it says so.

---

## Re-verification of the three findings (before any change)

I reproduced all three myself rather than accepting the task doc.

### S1 — confirmed, exactly as described

```
       view       |  owner   | invoker_opt | barrier_opt | anon_select | auth_select
------------------+----------+-------------+-------------+-------------+-------------
 clients_overview | postgres | (none)      | (none)      | t           | t
 inbound_queue    | postgres | (none)      | (none)      | t           | t
 member_directory | postgres | (none)      | (none)      | t           | t
 memberships      | postgres | (none)      | (none)      | t           | t
 service_credits  | postgres | (none)      | (none)      | t           | t

    rolname    | rolbypassrls | rolsuper
---------------+--------------+----------
 anon          | f            | f
 authenticated | f            | f
 postgres      | t            | f
 service_role  | t            | f
```

`SET LOCAL ROLE anon` — row counts match the task doc exactly:

```
       view       | count
------------------+-------
 clients_overview |    14
 inbound_queue    |    11
 member_directory |     6
 memberships      |     9
 service_credits  |     0
```

The content is real (masked here; read unmasked during verification):

```
--- inbound_queue, as anon ---
 email_masked | phone_masked | staff_notes_head
--------------+--------------+------------------
 ash***       | (50***       | []
 aud***       | (61***       | []
 bri***       | (85***       | []
 cry***       | (91***       | []

--- member_directory, as anon ---
 name_masked | email_masked | mobile_masked | whatsapp_masked
-------------+--------------+---------------+-----------------
 (n***       | sar***       | (nu***        | (nu***
 (n***       | cjz***       | (nu***        | (nu***
 (n***       | mad***       | (nu***        | (nu***
 (n***       | mae***       | (nu***        | (nu***
 (n***       | hel***       | (85***        | (nu***
 CJ***       | adm***       | (nu***        | (nu***
```

**One correction to the task doc.** It lists `inbound_queue` as leaking "contact
emails/phones **plus `staff_notes`**". The `staff_notes` *column* is exposed, but every
row's value is an empty JSON array (`[]`) today, so no note text is actually readable
right now. Emails and phone numbers are real and readable. The defect is identical either
way; only the "what an attacker gets today" claim needed narrowing.

### S2 — confirmed, and worse than described

Grants and policy, before:

```
--- profiles: grants held by anon/authenticated ---
    grantee    | privilege_type | n_columns
---------------+----------------+-----------
 anon          | INSERT         |        29
 anon          | UPDATE         |        29
 authenticated | INSERT         |        29
 authenticated | UPDATE         |        29

--- full table ACL: one table-level entry per role, no PUBLIC grant, no role inheritance ---
 postgres=arwdDxtm/postgres
 anon=arwdDxtm/postgres
 authenticated=arwdDxtm/postgres
 service_role=arwdDxtm/postgres

--- column-level ACLs: none (this matters, see "the task doc's literal fix" below) ---
 attname | attacl
---------+--------
(0 rows)

--- policies ---
       polname       | polcmd | check_expr
---------------------+--------+-----------------------------------------------------------
 profiles_insert_own | a      | (user_id = auth.uid())
 profiles_update_own | w      | ((user_id = auth.uid()) OR (app_role() = 'SUPER_ADMIN') OR
                     |        |  (is_admin() AND (org_id = current_org()) AND …))
```

Neither policy constrains the *value* of `contact_id`, and `current_contact_id()` is
literally `SELECT contact_id FROM profiles WHERE user_id = auth.uid()`.

**Live exploit, as an ordinary `USER`-role member, inside `BEGIN … ROLLBACK`:**

```
--- who I am before ---
 app_role |              contact_id              | contacts_i_can_read
----------+--------------------------------------+---------------------
 USER     | d99f1472-48b4-466e-aaa7-f76396745c17 |                   1

--- ATTACK: repoint my profile at the admin's contact ---
               user_id                |              contact_id
--------------------------------------+--------------------------------------
 0a7fc801-5b17-41f5-b379-11982030d182 | 75475f66-8950-4f13-832c-5471070737f8
UPDATE 1

--- who I am now ---
            contact_id_now            | contacts_i_can_read_now | i_am_now
--------------------------------------+-------------------------+----------
 75475f66-8950-4f13-832c-5471070737f8 |                       1 | admin***

--- blast radius, as the admin's contact ---
 required_docs | party_rows | client_rows
---------------+------------+-------------
             0 |          0 |           1
```

`current_contact_id()` moved. That is the value every contact-scoped policy in the system
trusts.

**A second live vector the task doc does not mention.** The same hole exists on INSERT.
`profiles_insert_own` also checks only `user_id = auth.uid()`, and `authenticated` held
table-level INSERT. Any auth user with no `profiles` row can create one aimed at any
contact:

```
--- auth users with no profiles row ---
 7d622c47-2dbc-4eca-9020-ddfdbedc3a29 | cjzig***
 bf70739c-bfe1-4a83-b3fb-04854e493ddc | ashla***

--- INSERT my own profile row, aimed at the ADMIN contact ---
               user_id                |              contact_id
--------------------------------------+--------------------------------------
 7d622c47-2dbc-4eca-9020-ddfdbedc3a29 | 75475f66-8950-4f13-832c-5471070737f8
INSERT 0 1

--- who am I now? ---
            contact_after             |
--------------------------------------+
 75475f66-8950-4f13-832c-5471070737f8 |
```

This matters more than the row count suggests: ACCTEVAL already found that no `auth.users`
trigger creates `profiles` rows, so **every brand-new signup passes through that window**.
Fixing only UPDATE would have left the takeover fully available to anyone who can create an
account. I closed both vectors in the S2 migration — see "Scope decision" below.

**`anon`'s identical grant is dormant, not exploitable.** Both write paths are stopped by
RLS, because `anon` has no `auth.uid()`:

```
--- anon UPDATE ---
UPDATE 0

--- anon INSERT ---
ERROR:  new row violates row-level security policy for table "profiles"
```

I left `anon`'s grant alone deliberately. Reported, not fixed — see "Not fixed".

### S3 — confirmed, and it writes real rows

`_ensure_client_account(uuid,text,text,text,text[],text[],text)`, SECURITY DEFINER, owner
`postgres`. One overload only — the 6-argument call sites work because `p_template_keys`
and `p_marker` have defaults, so a single revoke covers every call.

No caller check of any kind. Verified mechanically rather than by reading:

```
NO auth/caller check anywhere in the body
```

(the body contains no reference to `is_admin`, `has_staff_access`, `auth.uid`, `app_role`,
`current_org` or `current_user` — it validates only `p_org` non-null, email non-empty, and
`p_marker IN ('CLIENT','CUSTOMER')`.)

**Live exploit as `anon`, unauthenticated, inside `BEGIN … ROLLBACK`:**

```
 acting_as
-----------
 anon

--- unauthenticated call, targeting the real FHE org by id ---
 {"client_id": "9a00e53e-676b-4999-8d13-fff84bf3be8a", "contact_id": "4d19a47a-cbb2-456f-b9bf-10e32e95c92e"}

--- rows it created ---
 4d19a47a-… | e656f20b-ef43-4725-9029-19e7f0190d9c | secfix-anon-probe@example.test | CONTACT
 client_rows_created   = 1
 required_docs_created = 4
```

An unauthenticated caller created a contact, a client and four required-document
assignments in the production org. Rolled back; nothing persisted.

---

## The task doc's literal fix for S2 is a silent no-op

This is the most important thing in this report.

The doc says `REVOKE UPDATE (contact_id) ON profiles FROM authenticated`. Because the
grant is **table-level**, a column-scoped REVOKE does nothing — and PostgreSQL reports
success:

```
BEGIN
REVOKE                     <-- reported as successful
 still_can_update
------------------
 t                         <-- has_column_privilege() unchanged
ROLLBACK
```

Had I applied the doc's statement as written, the migration would have committed cleanly,
the report would have said "S2 fixed", and the takeover would still work. The only way to
remove one column from a table-level grant is to drop the table-level grant and re-grant
the columns that should remain, which is what the migration does.

---

## Scope decision (stated plainly)

The task scopes S2 to "revoke UPDATE (contact_id) from authenticated". I did that, and
**also** revoked INSERT of the same column from the same role, because it is the same hole
reached through a second verb and closing one without the other does not close the
vulnerability. Both are grant changes, within the "grants and view options only"
constraint, and both revert together with the single line in the migration header. No
policy body, no function, and no trigger was rewritten.

I did **not** widen scope to `anon` (dormant, blocked by RLS) or to any other table.

---

## The fix

`supabase/migrations/20260807120000_secfix_s2_profiles_contact_id_grant.sql`

```sql
BEGIN;
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE ( …28 columns, every column except contact_id… ) ON public.profiles TO authenticated;
REVOKE INSERT ON public.profiles FROM authenticated;
GRANT INSERT ( …the same 28 columns… ) ON public.profiles TO authenticated;
COMMIT;
```

Revert: `GRANT INSERT, UPDATE ON public.profiles TO authenticated;`

Accepted maintenance consequence, noted in the migration header: the column list is
explicit, so a column added to `profiles` later will not be writable by `authenticated`
until it is added there. That fails visibly on write rather than silently reopening the
hole.

### Legitimate paths checked BEFORE applying

- No code in `src/` or `api/` writes `profiles.contact_id` at all.
- The only client INSERT path is `upsertMyProfile()` (`src/lib/api.ts:421`); its two call
  sites (`src/pages/Account.tsx:77`, `src/components/app/profile/ProfileCard.tsx:161`)
  pass only first/last name, email, display_name, bio, avatar_url, riding_level.
- `adminUpdateProfile()` (`src/lib/admin.ts:115`) explicitly destructures contact data out
  and never sends `contact_id`.
- Every `api/` route that writes `profiles` uses `getSupabaseAdmin()` (service_role);
  bearer tokens there are used only for `auth.getUser()` identity checks, never as the DB
  client. service_role's grant is untouched.
- All 32 DB functions whose bodies touch `profiles` + `contact_id` are `SECURITY DEFINER`
  owned by `postgres`; zero are INVOKER. Definer functions and trigger-assigned columns are
  not subject to the caller's column privileges.

## Dry run

Applied in `BEGIN … ROLLBACK` first. Privileges moved and reverted:

```
--- BEFORE ---
 upd_contact_id | ins_contact_id | upd_display_name | upd_bio | upd_avatar
----------------+----------------+------------------+---------+------------
 t              | t              | t                | t       | t
--- AFTER (inside the transaction) ---
 f              | f              | t                | t       | t
--- other roles untouched ---
 svc_upd | pg_upd | anon_upd_unchanged
---------+--------+--------------------
 t       | t      | t
ROLLBACK
--- post-rollback ---
 upd_contact_id
----------------
 t
```

A full behavioural suite was also dry-run under the new grants (both takeover vectors
refused, all legitimate writes succeeding) before applying. Same results as the post-apply
run below, so they are not duplicated here.

## Applied

```
BEGIN
REVOKE
GRANT
REVOKE
GRANT
COMMIT
exit=0
```

---

## Post-apply verification — live prod

### Privileges

```
 auth_upd_contact_id | auth_ins_contact_id | auth_upd_display_name | auth_sel_contact_id | service_role_untouched
---------------------+---------------------+-----------------------+---------------------+------------------------
 f                   | f                   | t                     | t                   | t
```

`SELECT` on `contact_id` is deliberately still granted — the app reads it constantly
(`src/lib/contact.ts`, `api/deliver-my-document.ts`, and others).

### The hole is closed — negative cases

```
=== 2. the exact takeover that worked 20 minutes ago ===
ERROR:  permission denied for table profiles
HINT:  Grant the required privileges to the current role with: GRANT UPDATE ON public.profiles TO authenticated;

=== 3. nulling my own contact_id ===
ERROR:  permission denied for table profiles

=== 4. the INSERT variant, profile-less user ===
ERROR:  permission denied for table profiles
HINT:  Grant the required privileges to the current role with: GRANT INSERT ON public.profiles TO authenticated;

=== 5. an ADMIN cannot repoint another member either ===
ERROR:  permission denied for table profiles
```

Case 5 is intentional and consistent with `CLAUDE.md`: `promote_contact_to_account` is
documented as the sole writer of `profiles.contact_id`. No client code path relied on an
admin writing it directly (`MemberProfilePatch` excludes it).

### Legitimate access still works — positive cases

```
=== P1 — member edits their own profile (ProfileCard.save) ===
 user_id                              | display_name | bio        | avatar_url                 | riding_level
 0a7fc801-5b17-41f5-b379-11982030d182 | VERIFY name  | VERIFY bio | https://example.test/a.jpg | intermediate
UPDATE 1

=== P2 — member edits name/email (Account.tsx saveProfile) ===
 0a7fc801-5b17-41f5-b379-11982030d182 | VERIFY | Member | cjzigs@gmail.com
UPDATE 1

=== P3 — upsertMyProfile shape (INSERT .. ON CONFLICT DO UPDATE) ===
 0a7fc801-5b17-41f5-b379-11982030d182 | VERIFY upsert
INSERT 0 1

=== P4 — admin edits another member (adminUpdateProfile patch shape) ===
 ac3aecb9-bc96-4b1c-8eda-bc47b10965e8 | VERIFY | VERIFY
UPDATE 1

=== P5 — staff employment fields (create/updateStaffProfile) ===
 ac3aecb9-bc96-4b1c-8eda-bc47b10965e8 | VERIFY title | hourly | t
UPDATE 1

=== P6 — admin role/suspension actions (setUserRole / setSuspended) ===
 ac3aecb9-bc96-4b1c-8eda-bc47b10965e8 | f
UPDATE 1
 ac3aecb9-bc96-4b1c-8eda-bc47b10965e8 | USER | f
UPDATE 1

=== P7 — a new signup still gets a contact linked, via the DEFINER path ===
INSERT 0 1
 contact_linked |     linked_contact
----------------+------------------------
 t              | verify-secfix@example.
```

P7 is the load-bearing one: `authenticated` can no longer write `contact_id`, yet the
`profiles_link_contact` AFTER-INSERT trigger → `ensure_contact_for_profile` →
`promote_contact_to_account` chain still fills it, because those run as `postgres`. That
is the "no lockout" proof for account creation.

P8 — `promote_contact_to_account` still completes, invoked the way it actually is
(service_role):

```
 {"groups": ["HORSE_OWNER", "RIDER"], "contact_id": "d99f1472-…", "dissolved_contact_id": null}
```

All of the above ran inside `BEGIN … ROLLBACK`; nothing was left behind.

### A false alarm I chased down, so it is on the record

My first P7 attempt showed `contact_linked = f` and looked like a lockout I had caused. It
was not. A control run with the **unchanged, pre-migration grants** produced the identical
`f`, which ruled my change out. The real cause was my own test SQL: I sourced `org_id` from
a subquery that RLS filtered to NULL for that caller, and `ensure_contact_for_profile`
returns early when org is null. With a literal `org_id` the link succeeds both before and
after the fix. Reporting it because "verify before asserting" is the standing rule here and
the first reading was wrong.

### Nothing was written

```
--- row counts, baseline vs after (identical) ---
 clients                    |    15
 contact_required_documents |    30
 contacts                   |    26
 documents                  |    68
 profiles                   |    10

--- every profiles.contact_id value unchanged; no identity moved ---
 0a7fc801-… | d99f1472-…      3c5d6af1-… | 8795c065-…      aaaa1111-…0001 | 48addb61-…
 aaaa1111-…0002 | 753f5b74-…  aaaa1111-…0003 | 20ab79ef-…  ac3aecb9-… | a349d66c-…
 b45a5503-… | 75475f66-…      d226273d-… | b996dd2c-…      d9f57a2f-… | bce1bcf7-…
 fdbdfe89-… | 862b7936-…
```

Sarah's document `704c8d2d-…` was never read or written by any statement in this task.

---

## Not fixed — reported, awaiting a decision

1. **`anon` holds the same table-level INSERT/UPDATE grant on `profiles`.** Dormant today:
   RLS refuses both (raw output above). It is one migration to revoke, but it is a
   different role and a different blast radius, so it does not belong inside the S2 revert
   unit. My read is that it should be revoked as defence in depth; it is not urgent.
2. **`anon` also holds table-level DELETE/INSERT/UPDATE on `profiles`** more broadly, and
   `authenticated` holds DELETE. Same reasoning as above — out of S2's scope, unexamined.
3. Everything the task doc lists under "Also found by ACCTEVAL — NOT in this task" is
   untouched.

---

---

# S1 — five views leaking to `anon`

`supabase/migrations/20260807130000_secfix_s1_view_security_invoker.sql`

```sql
ALTER VIEW public.clients_overview SET (security_invoker = true);
ALTER VIEW public.inbound_queue    SET (security_invoker = true);
ALTER VIEW public.memberships      SET (security_invoker = true);
ALTER VIEW public.service_credits  SET (security_invoker = true);
-- member_directory deliberately keeps definer semantics — see below.
REVOKE SELECT ON public.clients_overview, public.inbound_queue, public.memberships,
                 public.member_directory, public.service_credits FROM anon;
```

## S1 — the one view that could not take the primary fix

**This is the open item.** `security_invoker` is applied to four views. It is **not**
applied to `member_directory`, because measuring it first showed it would break the
community directory.

Dry run, all five switched on at once, counted per role:

```
=== AS ANON (target: 0 rows everywhere) ===
 clients_overview |     0
 inbound_queue    |     0
 member_directory |     0
 memberships      |     0
 service_credits  |     0

=== AS AN ORDINARY MEMBER 0a7fc801 (community directory was 6 rows) ===
 clients_overview |     1
 inbound_queue    |     0
 member_directory |     1        <-- was 6
 memberships      |     1
 service_credits  |     0

=== AS STAFF/ADMIN b45a5503 ===
 inbound_queue    |    11
 member_directory |     6
 clients_overview |    14
 memberships      |     9
 service_credits  |     0
```

`member_directory` collapses **6 → 1** for an ordinary member. The cause is structural, not
incidental: the directory is by definition a cross-member read, while the base tables
restrict a non-admin to their own row —

```
 profiles | profiles_select_own | r | ((user_id = auth.uid()) OR (app_role() = 'SUPER_ADMIN') OR (is_admin() AND …))
 contacts | contacts_select     | r | (is_admin() OR ((deleted_at IS NULL) AND (id = current_contact_id())))
```

Both consumers would break, not just one:

- `fetchMemberDirectory()` (`src/lib/community.ts:27`) — the community directory would show
  a member only themselves.
- `fetchMemberProfile(userId)` (`src/lib/community.ts:40`, used by
  `src/pages/app/MemberProfile.tsx` and `ProfileCard.tsx`) — every *other* member's profile
  page would return null.

Making `security_invoker` work there needs a new SELECT policy on `profiles` and
`contacts`. That is a policy change, which this task explicitly forbids ("grants and view
options only… if a fix appears to need more, stop and report"). Given "a lockout is a worse
outcome than the exposure", I left the view option off.

**What I did instead, and why I judged it in scope:** revoked `anon`'s SELECT. The task
sanctions exactly this "where nothing legitimate reads the view as anon" — verified nothing
does: both consumers are under `/app` and go through `community.ts`, whose `uid()` helper
throws without a session. This closes the anon exposure on the most sensitive of the five
(email, mobile, whatsapp for 6 real members) and leaves authenticated reads at 6 rows.

It is **not** the primary fix. `member_directory` still executes with `postgres`'s rights
and still bypasses RLS for any caller that can reach it. **Decision needed:** add a
directory-scoped SELECT policy to `profiles` and `contacts` (then turn `security_invoker`
on), or convert the directory to a SECURITY DEFINER RPC. Neither is in this task's scope.

### The other four — confirmed unused before revoking anon

- `clients_overview` — 0 references in `src/` or `api/`
- `service_credits` — 0 references
- `memberships` — 0 real references; the only two hits (`api/hard-delete-client.ts:12,48`)
  are prose comments about the `members` **table** cascade, not view reads
- `inbound_queue` — staff only, `src/lib/ops/api-intake.ts:135`

## S1 — dry run

The real migration body, then rolled back. anon is refused outright:

```
=== ANON ===
ERROR:  permission denied for view clients_overview
ERROR:  permission denied for view inbound_queue
ERROR:  permission denied for view memberships
ERROR:  permission denied for view member_directory
ERROR:  permission denied for view service_credits

=== ORDINARY MEMBER 0a7fc801 ===
 member_directory_rows
                     6
--- fetchMemberProfile(another member) still resolves ---
 d9f57a2f-d009-46dd-a77c-bcc2803c7e85 | Mary

=== STAFF/ADMIN b45a5503 ===
 inbound_queue_rows
                 11
```

## S1 — applied, and verified live

```
BEGIN / ALTER VIEW ×4 / REVOKE ×5 / COMMIT   exit=0
```

End state:

```
       view       |        invoker        | anon_select | auth_select
------------------+-----------------------+-------------+-------------
 clients_overview | security_invoker=true | f           | t
 inbound_queue    | security_invoker=true | f           | t
 member_directory | (none)                | f           | t
 memberships      | security_invoker=true | f           | t
 service_credits  | security_invoker=true | f           | t
```

**Negative — anon gets nothing from any of the five:**

```
ERROR:  permission denied for view clients_overview
ERROR:  permission denied for view inbound_queue
ERROR:  permission denied for view memberships
ERROR:  permission denied for view member_directory
ERROR:  permission denied for view service_credits
```

**Positive — a real member still gets the community directory (6 rows):**

```
 directory_rows
              6

   who    | is_horse_owner | preferred_contact
----------+----------------+-------------------
 CJ       | f              | none
 Sarah    | t              | none
 CJ       | t              | sms
 Madeline | f              | none
 Mary     | f              | none
 Claire   | f              | none
```

A second, different member (`d9f57a2f`) sees the same 6, and can still resolve another
member's profile page:

```
 directory_rows
              6
 d226273d-b3a6-4fff-95aa-393160976c70 | Sarah
```

**Positive — staff still get `inbound_queue`'s 11 rows**, with the computed columns intact:

```
 inbound_queue_rows
                 11

      email       |  status   | days_open | already_converted | overdue
------------------+-----------+-----------+-------------------+---------
 elishou@gmail.co | new       |        24 | t                 | f
 ashlanalexis22@g | new       |        22 | t                 | f
 rkthicklin@gmail | new       |        20 | t                 | f
 audrey.j.brennan | new       |        18 | f                 | t
 hannah.dryden14@ | contacted |        16 | f                 | f
 naomi.pouliot@ic | contacted |        14 | f                 | f
 serenalee1732@gm | contacted |        13 | t                 | f
 brian@brianoleni | new       |        12 | t                 | f
 melanie619@hotma | new       |        10 | t                 | f
 mrober0618@gmail | new       |         5 | t                 | f
 crystal.a0719@ou | new       |         5 | f                 | t
```

The second admin (Claire, `fdbdfe89`) also gets 11 / 14 / 9 on inbound_queue /
clients_overview / memberships.

---

# S3 — `anon` executing a SECURITY DEFINER writer

`supabase/migrations/20260807140000_secfix_s3_ensure_client_account_execute.sql`

```sql
REVOKE EXECUTE ON FUNCTION
  public._ensure_client_account(uuid,text,text,text,text[],text[],text)
  FROM PUBLIC, anon, authenticated;
```

## The task doc's literal fix for S3 is also a silent no-op

Second instance of the same class of trap. The function's ACL was:

```
 =X/postgres                <-- this is a grant to PUBLIC
 postgres=X/postgres
 anon=X/postgres
 authenticated=X/postgres
 service_role=X/postgres
```

Revoking from `anon` alone leaves the PUBLIC grant in place:

```
BEGIN
REVOKE
 anon_still_can_execute
------------------------
 t
ROLLBACK
```

So `REVOKE … FROM anon` would have committed cleanly and left `anon` able to execute. PUBLIC
must go too.

## Scope decision (stated plainly)

Once PUBLIC and `anon` are revoked, `authenticated` still held an explicit grant — the same
unauthorised cross-org write, one signup away. Nothing legitimate uses it (no direct call
anywhere in `src/` or `api/`; all four real callers are DEFINER), so I revoked that as well.
`postgres` and `service_role` keep EXECUTE. Same judgement call as S2's INSERT, flagged
rather than done quietly.

## S3 — dry run and applied

Dry-run first with all four callers exercised, then applied:

```
BEGIN / REVOKE / COMMIT   exit=0
```

ACL now:

```
 postgres=X/postgres
 service_role=X/postgres

 anon | authenticated | service_role
------+---------------+--------------
 f    | f             | t
```

**Negative — the exact call that created rows an hour earlier:**

```
=== as anon ===
ERROR:  permission denied for function _ensure_client_account

=== as a logged-in member ===
ERROR:  permission denied for function _ensure_client_account
```

## S3 — all four callers still complete

Two of the four (`redeem_gift`, `redeem_contract_invitation`) wrap the call in
`EXCEPTION WHEN others THEN NULL` — "never block redemption on provisioning". So **their
return value proves nothing**: if the revoke had broken provisioning they would still have
reported success and silently skipped it. Every caller below is therefore verified by its
side effects, not its return value.

```
--- 1/4 provision_client_invitation (as an authenticated ADMIN) ---
 contact_id = 48bd8350-053b-47ab-8529-f9c59bf84377
 contact | client | req_docs
       1 |      1 |        4

--- 2/4 ensure_gift_buyer_account ---
 {"ok": true, "contact_id": "d9cef898-46b7-4cec-b6a6-96856f4aab64"}
 buyer_contact_created = 1

--- 3/4 redeem_gift ---
 gift_status | client_row_recreated
 redeemed    |                    1

--- 4/4 redeem_contract_invitation ---
 invitation_status | client_row_recreated
 redeemed          |                    1
```

For callers 3 and 4 the client row was **deleted inside the transaction first**, so its
reappearance is positive proof that `_ensure_client_account` actually ran. In caller 4's
path `promote_contact_to_account` is skipped (profile.contact_id equals
invitation.contact_id), so `_ensure_client_account` is the only thing that can recreate it.
A control run of the identical scenario **without** the revoke produced the same result,
confirming the test discriminates rather than passing trivially:

```
########## RUN A — WITH the revoke ##########
 client_rows_after_delete = 0
 invitation_status | client_row_recreated
 redeemed          |                    1

########## RUN B — control, revoke NOT applied ##########
 client_row_recreated_control = 1
```

---

# Final state — nothing was written

```
=== row counts (baseline vs after all three migrations: identical) ===
 clients                    |    15
 contact_required_documents |    30
 contacts                   |    26
 documents                  |    68
 gifts                      |     0
 invitations                |    35
 profiles                   |    10

=== no probe rows escaped any rolled-back test ===
 probe_contacts    = 0
 probe_gifts       = 0
 probe_invitations = 0

=== all three fixes hold simultaneously ===
 S2: auth UPDATE contact_id = f | auth INSERT contact_id = f
 S1: 4 views security_invoker=true, anon SELECT revoked on all 5
 S3: anon EXECUTE = f

=== Sarah's live negotiation document — read-only, untouched ===
 704c8d2d-d179-43f9-8a4a-7ea8cb920ab9 | sent_for_review | 2026-08-05 04:24:07.803698+00
```

`updated_at` predates this session. It was never written by any statement in this task.

---

# Open items

1. **`member_directory` still bypasses RLS** (definer-side). anon is locked out, but the
   primary fix is blocked on a policy decision. This is the one thing from the original
   three findings that is not fully closed. **Needs a decision.**
2. **`anon` holds table-level INSERT/UPDATE/DELETE on `profiles`**, and `authenticated`
   holds DELETE. Dormant behind RLS (proven), out of S2's revert unit.
3. **`redeem_gift` and `ensure_gift_buyer_account` are PUBLIC-executable** (`=X/postgres`
   in their ACLs), noticed while checking the callers. Not examined — outside this task,
   but the same shape as S3 and worth a look.
4. Everything under "Also found by ACCTEVAL — NOT in this task" remains untouched.

# Reverts

Each migration reverts alone, in any order:

```sql
-- S2
GRANT INSERT, UPDATE ON public.profiles TO authenticated;

-- S1
ALTER VIEW public.clients_overview SET (security_invoker = false);
ALTER VIEW public.inbound_queue    SET (security_invoker = false);
ALTER VIEW public.memberships      SET (security_invoker = false);
ALTER VIEW public.service_credits  SET (security_invoker = false);
GRANT SELECT ON public.clients_overview, public.inbound_queue, public.memberships,
                public.member_directory, public.service_credits TO anon;

-- S3
GRANT EXECUTE ON FUNCTION public._ensure_client_account(uuid,text,text,text,text[],text[],text)
  TO PUBLIC, anon, authenticated;
```
