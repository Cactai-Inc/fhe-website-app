# TASK SECFIX2 — REPORT

**Branch** `task/secfix2` off `origin/main` @ `0635acb`
**Worktree** `~/Downloads/claude-code-repo/wt-secfix2`
**Database** `db.lrstswfxfsezdmvkvukc` (prod)
**Date** 2026-08-07

Both items are **applied to production and verified**. Two migrations, each revertable alone.

| | Item | Migration | State |
|---|---|---|---|
| G1 | `ensure_gift_buyer_account` anon path | `20260807190000_secfix2_g1_ensure_gift_buyer_account_execute.sql` | applied, verified |
| G2 | `member_directory` RLS bypass | `20260807191000_secfix2_g2_member_directory_rpc.sql` | applied, verified |

---

## Baseline captured before any change

```
        t         | count
------------------+-------
 clients          |    15
 contacts         |    26
 documents        |    68
 member_directory |     6
 profiles         |    10
```

The directory's 6 rows are the 6 active-member profiles that are neither suspended nor
`SUPER_ADMIN`. That is the number every "legitimate use survives" check below is measured
against.

---

# G1 — `ensure_gift_buyer_account`

## The hole was real, and I reproduced it

Not inferred from the ACL. Executed against prod inside `BEGIN … ROLLBACK`, as `anon`,
with `auth.uid()` null:

```
 running_as | auth_uid
------------+----------
 anon       |

NOTICE:  HOLE OPEN — anon executed it. returned: {"ok": true, "contact_id": "505c532e-c3df-46ea-9a56-a2558b766211"}

 contacts_after_anon_call
--------------------------
                       27
                  id                  |             email             |                org_id
--------------------------------------+-------------------------------+--------------------------------------
 505c532e-c3df-46ea-9a56-a2558b766211 | secfix2-g1-probe@example.test | e656f20b-ef43-4725-9029-19e7f0190d9c
```

An unauthenticated caller created a contact in the real FHE org (26 → 27), through the
`_ensure_client_account` spine that S3 had locked. Rolled back; nothing persisted.

The function's body contains **no caller check of any kind** — no `auth.uid`, no `is_admin`,
no `has_staff_access`. It takes a gift id and provisions from that gift's `buyer_email`.

## Why one revoke would not have been enough

The pre-change ACL carried **three** independent grants, not one:

```
 ensure_gift_buyer_account(uuid) | =X/postgres              <- PUBLIC
                                 | postgres=X/postgres
                                 | anon=X/postgres          <- explicit role grant
                                 | authenticated=X/postgres <- explicit role grant
                                 | service_role=X/postgres
```

`REVOKE … FROM anon` alone leaves the PUBLIC grant; `REVOKE … FROM PUBLIC` alone leaves the
two role grants. Both prior traps in this repo were exactly this shape. All three were
revoked in one statement.

## Post-revoke privilege check — raw output, not the REVOKE's word

```
                              func                              |           acl
----------------------------------------------------------------+-------------------------
 ensure_gift_buyer_account(uuid)                                | postgres=X/postgres    +
                                                                | service_role=X/postgres

    rolname    | gift_buyer_exec | redeem_gift_exec | ensure_client_exec
---------------+-----------------+------------------+--------------------
 anon          | f               | t                | f
 authenticated | f               | t                | f
 service_role  | t               | t                | t
 postgres      | t               | t                | t
```

**PUBLIC is proven revoked two ways:** the `=X/postgres` entry is gone from the ACL, *and*
`has_function_privilege` is false for `anon` — a live PUBLIC grant would make that true for
every role. That is the specific check the earlier silent no-op would have failed.

Live re-execution attempts after apply:

```
NOTICE:  PASS — anon denied
NOTICE:  PASS — authenticated denied
```

`service_role` still executes it successfully (dry-run step 10), so no server-side path was
broken.

## Two corrections to the task brief

**1. Nothing calls this function at all.** The brief said "only other database functions do".
None do. Verified four independent ways rather than assumed:

| Check | Result |
|---|---|
| `grep` over `src/ api/ supabase/functions/` | 0 hits (only migrations, docs, schema snapshot) |
| `SELECT count(*) FROM pg_proc WHERE prosrc ILIKE '%gift_buyer%'` | **0** |
| Positive control: `prosrc ILIKE '%_ensure_client_account%'` | 4 rows — `redeem_gift`, `redeem_contract_invitation`, `provision_client_invitation`, `ensure_gift_buyer_account` |
| `pg_depend` non-normal deps on the function oid | **0** |

The positive control matters: it proves the `prosrc` search was not silently returning
nothing. The function is dead code in production, so this revoke cannot break a gift flow —
there is no flow to break. Gift redemption runs through `redeem_gift`, which does **not**
call this function; it calls `_ensure_client_account` directly under its own definer rights.

**2. `redeem_gift`'s anon exposure was already neutralised by its own body.** The brief's
reasoning was that a gift recipient may have no account yet, so anon must be able to call it.
The body says otherwise — its first statement is:

```sql
IF auth.uid() IS NULL THEN RETURN 'not_authenticated'; END IF;
```

So `anon` calling `redeem_gift` reaches nothing; it bails before touching
`_ensure_client_account`. This matches the client: `Redeem.tsx` sends a signed-out visitor to
register/login first (`if (!user)`, button reads "Create my account"), and `src/lib/gifts.ts`
comments it as "Redeem the gift for the signed-in user". The `/redeem` **page** is publicly
routed; the **RPC call** only happens post-login.

**I did not revoke it**, per instruction. I do not conclude it should be revoked. Recording
the nuance because the stated justification for keeping the grant is not the real one — the
grant is harmless, but it is harmless because of the guard, not because anon needs it.

## G1 negative test — redemption still works end to end

```
    rolname    | can_execute
---------------+-------------
 anon          | t
 authenticated | t

 redeem_result
---------------
 redeemed

                  id                  |  status  | has_redeemer
--------------------------------------+----------+--------------
 00000000-0000-4000-8000-000000000003 | redeemed | t
```

A gift was seeded, redeemed by a real member's JWT, and came back `redeemed` with the
redeemer stamped. Rolled back.

---

# G2 — `member_directory`

## The hole was real, and I reproduced it

The brief framed this as "any authenticated caller reads every row". I confirmed that with a
concrete account rather than in the abstract. Of the 10 profiles, **3 hold no `members` row
at all**. One of them:

```
 nonmember_member_rows
-----------------------
                     0

  running_as   |                caller
---------------+--------------------------------------
 authenticated | aaaa1111-0000-4000-8000-000000000001

 rows_a_nonmember_can_read
---------------------------
                         6
```

A non-member account read the entire members-only directory. RLS never ran, because the view
is postgres-owned with `security_invoker` off.

(SECFIX had already closed anon: the view's ACL shows `anon=awdDxtm` — no `r`.)

## The fix

`member_directory_list(p_user_id uuid DEFAULT NULL)` — `SECURITY DEFINER`, `STABLE`,
`SET search_path TO public`. One function serves both call sites (`NULL` → whole directory,
set → one member) so the column set and the gate cannot drift apart. Same pattern as
`my_documents()`, `contract_document_detail()`, `member_horses()`.

**No SELECT policy was added to `profiles` or `contacts`.** That approach was rejected in the
task doc and is not used here.

Three things it does that the view could not:

1. **Gates itself in the body** — returns zero rows if `auth.uid()` is null, and zero rows if
   the *caller* is suspended. EXECUTE is additionally granted only to `authenticated` and
   `service_role`.
2. **Enforces the `hide_*` flags** character-for-character as the view did, including
   degrading `preferred_contact` to `'none'` when the channel it names is hidden or empty.
   With RLS bypassed these flags are the only thing gating those columns.
3. **Sends a narrower payload.** The view returned 20 columns; the RPC returns 17.

```
  dropped_from_payload   | view_col_count | rpc_col_count
-------------------------+----------------+---------------
 email, mobile, whatsapp |             20 |            17
```

Those three are the legacy `contacts` columns kept through a "Stage A deprecation window".
`community-types.ts` never declared them, so the compiler already proved nothing *read* them
— but `select('*')` shipped them over the wire anyway. Not selecting them is strictly
stronger than gating them behind `hide_email` / `hide_mobile` / `hide_whatsapp`: the data now
never leaves the database.

## The old path is closed both ways

```
     relname      |      reloptions       |              acl
------------------+-----------------------+--------------------------------
 member_directory | security_invoker=true | postgres=arwdDxtm/postgres    +
                  |                       | anon=awdDxtm/postgres         +
                  |                       | authenticated=awdDxtm/postgres+
                  |                       | service_role=arwdDxtm/postgres
```

`authenticated` went `arwdDxtm` → `awdDxtm` — the `r` is gone. The view is both
`security_invoker = true` (so it can no longer bypass RLS even if reached) and unreadable by
every web role. The task allowed "drop the view **or** set security_invoker"; both were done
because leaving either path alive re-creates the hole. The definition is retained as
documentation of the shape. Nothing depends on it — 0 dependent views/rules via
`pg_depend`/`pg_rewrite`, 0 function bodies referencing it in `pg_proc.prosrc`.

## Post-revoke privilege check — raw output

```
    rolname    | view_select | rpc_execute
---------------+-------------+-------------
 anon          | f           | f
 authenticated | f           | t
 service_role  | t           | t
 postgres      | t           | t

            func             |           acl
-----------------------------+--------------------------
 member_directory_list(uuid) | postgres=X/postgres     +
                             | authenticated=X/postgres+
                             | service_role=X/postgres
```

The RPC's ACL has **no `=X/postgres` entry**. `CREATE FUNCTION` grants EXECUTE to PUBLIC by
default, so the `REVOKE ALL … FROM PUBLIC, anon` in the migration is load-bearing, not
decorative — without it the new RPC would have shipped anon-callable and this task would have
replaced one hole with another.

## Legitimate use survives — the directory still returns 6

```
 full_directory_rows      6      <- same as baseline
 other_members_profile    1      <- a member can open another member's profile
 own_profile              1
```

And the payload is byte-identical to what the view produced, both directions:

```
 rows_in_rpc_not_matching_view    0
 rows_in_view_not_matching_rpc    0
```

(A set `EXCEPT` over all 17 shared columns, in both directions, with the RPC read under a
real member's JWT and the view read as owner. Zero drift.)

## `hide_*` is honoured

Set inside a rolled-back transaction, re-read through the RPC:

```
          phase           |  mobile_text   | hide_mobile_text | preferred_contact
--------------------------+----------------+------------------+-------------------
 BEFORE (real prod value) | (858) 414-2124 | f                | none

         phase          | mobile_text | preferred_contact
------------------------+-------------+-------------------
 hide_mobile_text=FALSE | +1-555-0199 | sms

         phase         | mobile_text | preferred_contact
-----------------------+-------------+-------------------
 hide_mobile_text=TRUE | (null)      | none

     phase      |  mobile_text   | hide_mobile_text | preferred_contact
----------------+----------------+------------------+-------------------
 AFTER ROLLBACK | (858) 414-2124 | f                | none
```

The column disappears when the flag is set, **and** `preferred_contact` degrades `sms` →
`none` so the UI does not offer a channel it cannot show. Production value restored by the
rollback.

## anon gets nothing

```
 anon_rpc_execute | anon_view_select | authed_view_select | authed_rpc_execute
------------------+------------------+--------------------+--------------------
 f                | f                | f                  | t

NOTICE:  PASS — anon denied EXECUTE on RPC
NOTICE:  PASS — anon denied SELECT on the view
NOTICE:  PASS — authenticated denied SELECT on the view
```

And the in-body gate holds independently of the grant — the `authenticated` role with no JWT:

```
 caller | rows_returned
--------+---------------
 NULL   |             0
```

---

## Frontend

`src/lib/community.ts` — `fetchMemberDirectory()` and `fetchMemberProfile()` now call
`supabase.rpc('member_directory_list')`. Ordering (`display_name NULLS LAST`) moved into the
RPC, so the client `.order()` is gone. `fetchMemberProfile` takes `[0] ?? null` in place of
`.maybeSingle()`.

Comments corrected in `contact.ts`, `communityFeed.ts` and `community-types.ts` where they
stated that *the view* enforces hiding, or that the legacy columns are still returned. Both
are now false.

`ClauseDocument.tsx` was not touched.

```
typecheck      0 errors
typecheck:api  0 errors
lint           0 errors, 30 warnings
```

30 warnings is exactly the count on `origin/main` with my changes stashed — I added none.
(CLAUDE.md says "~26"; the actual pre-existing count is 30. All are `react-refresh` /
unused-disable warnings in files this task did not touch.)

---

## Row counts unchanged

```
 contacts | clients | profiles | documents | gifts | member_directory
----------+---------+----------+-----------+-------+------------------
       26 |      15 |       10 |        68 |     0 |                6
```

Identical to baseline. `gifts` was empty before this task and is empty after — every gift used
in testing was seeded inside a transaction that rolled back.

Sarah's live negotiation, read-only check:

```
                  id                  | current_status  |          updated_at
--------------------------------------+-----------------+-------------------------------
 704c8d2d-d179-43f9-8a4a-7ea8cb920ab9 | sent_for_review | 2026-08-05 04:24:07.803698+00
```

`updated_at` is 2026-08-05, two days before this session. Never written.

---

## Verified vs assumed

**Verified by execution against prod:**

- Both holes reproduced live before fixing — anon creating a real contact row (G1), a real
  non-member account reading all 6 directory rows (G2).
- Every revoke re-checked with `has_function_privilege` / `has_table_privilege` **and** raw
  ACL inspection, after apply, in a fresh connection.
- Both fixes re-attacked after apply (`anon`, `authenticated`, role-without-JWT) — all denied.
- `ensure_gift_buyer_account` has zero callers — grep, `prosrc` scan with a positive control,
  and `pg_depend`.
- `redeem_gift` still anon-executable; a full redemption returned `redeemed`.
- Directory returns 6 rows to a real member and is byte-identical to the view across all 17
  shared columns.
- `hide_*` enforcement, in both states, through the RPC.
- Row counts before and after.

**Assumed / not verified:**

- **No browser click-through.** Everything above is SQL-level plus typecheck/lint. I did not
  run the app and load `/app/community` or a member profile page. The RPC returns the same
  rows and the same columns the view did, and `MemberDirectoryEntry` is unchanged, so the
  React layer has nothing new to handle — but that is reasoning, not observation.
- **PostgREST schema cache.** Supabase normally reloads it on DDL. If `member_directory_list`
  404s from the client immediately after deploy, `NOTIFY pgrst, 'reload schema';` is the fix.
  I did not restart or poke PostgREST.
- **The 3 non-member accounts** (`aaaa1111-…0001/2/3`) look like seed rows from their uuids.
  I did not confirm they are test data rather than real people.

---

## Flagged for the orchestrator — one decision I did not make

**The RPC gates on "authenticated", not on membership.** A non-member account holder can
still read the member directory, exactly as today.

`is_active_member()` is the tighter gate, it is what RLS on ~10 other community tables uses,
and it would still return 6 rows to a real member — so it would pass every acceptance check
in the task doc. I did not use it, for three reasons:

1. Requirement 5 says "must require an authenticated caller". That is what I implemented.
   Adding a membership gate is beyond the stated requirement.
2. Owner decision **D8** (CLAUDE.md, owner-final): "Community access is gated by ACCOUNT, not
   documents — any account holder views and participates." A membership gate on the directory
   would contradict that.
3. "A lockout is worse than the exposure." Tightening the gate changes who can read the
   directory; the permissive gate cannot lock anyone out.

There is a genuine drift here between D8 (community = account-gated) and the implementation
(`is_active_member()` gates the other community tables). That is a pre-existing contradiction,
not one this task introduced, and resolving it is an owner call. If the answer is "the
directory is members-only", the change is one line in the migration:

```sql
IF NOT is_active_member() THEN RETURN; END IF;
```

Say the word and I will add it as a third migration.

---

## Revert

Each migration reverts alone.

**G1:**
```sql
GRANT EXECUTE ON FUNCTION public.ensure_gift_buyer_account(uuid) TO PUBLIC, anon, authenticated;
```

**G2:**
```sql
ALTER VIEW public.member_directory RESET (security_invoker);
GRANT SELECT ON public.member_directory TO authenticated;   -- anon had no SELECT
DROP FUNCTION public.member_directory_list(uuid);
```
(plus reverting the `src/lib/community.ts` change — the view read still works once SELECT is
restored.)
