# TASK NOGUARD3 — report: `authenticated` is not an identity

Branch `task/noguard3`, worktree `~/Downloads/claude-code-repo/wt-noguard3`, off `origin/main`
@ `2f5f5d2`. Measured against production (`lrstswfxfsezdmvkvukc`) on 2026-08-11.

**Phase A is APPLIED to production.** Commit `f4e59d8`.
**Phase B is DRY-RUN ONLY. Three migrations delivered unapplied.** Nothing in Phase B has run
against production outside a transaction that ended `ROLLBACK`.

---

## Headline

The question was whether one signed-in person can act on another signed-in person's data.
**One case is real, live and exploitable today; it is fixed.** The larger result is a negative
one, and it is the finding I would read first:

> **The NULL propagation is not an accident in most places — it is what makes the org-less
> SUPER_ADMIN account work.** A blind `coalesce(…, false)` sweep across the 48 functions that
> carry the house guard idiom would have locked `admin@cactai.io` out of the entire contract
> surface. The naive execution of this task breaks the owner's own account.

That is why Phase A is two functions and not fifty. Every other NULL I found is load-bearing.

| | count |
|---|---|
| definer functions callable by `authenticated` (snapshot at task start) | **371** |
| deny-guards evaluated under three-valued logic | 256 |
| guards that **fail open** for a signed-in caller | **12** — 2 exploitable, 10 explained below |
| the inverted `auth.uid() IS NOT NULL AND NOT (…)` shape | **2**, both reported, both in Phase B |
| closed by Phase A (applied) | **2** |
| proposed by Phase B (dry run, unapplied) | **25** — 23 revokes + 2 guard rewrites |

---

## The attacker, established before anything else

`has_staff_access()`, `is_admin()`, `is_org_admin()`, `is_super_admin()` and `is_active_member()`
all `coalesce(…, false)` internally and return **false**, never NULL — NULLUID's fix is holding.
But `current_contact_id()` and `current_org()` are bare `SELECT`s over `profiles`:

```sql
current_contact_id() := SELECT p.contact_id FROM profiles p WHERE p.user_id = auth.uid();
current_org()        := SELECT org_id       FROM profiles   WHERE user_id   = auth.uid();
```

Both return **NULL** for a signed-in user with no `profiles` row. Live, as that caller:

```
 uid                                  | role          | app_role | contact | org | staff | admin
--------------------------------------+---------------+----------+---------+-----+-------+------
 7d622c47-2dbc-4eca-9020-ddfdbedc3a29 | authenticated |          |         |     | f     | f
```

**This population is real, not hypothetical.** Two of ten `auth.users` have no `profiles` row —
`cjzigs+averify2@icloud.com` and `ashlanalexis22@gmail.com`, both email-confirmed. And:

```
triggers on auth.users: (0 rows)
```

**Nothing provisions a profile at signup.** A profile is created later by application code, so
**every fresh signup begins in exactly this state**: `auth.uid()` non-NULL, `current_contact_id()`
NULL, `current_org()` NULL. Signing up is free, and the free signup starts as the NULL caller.

---

# PHASE A — applied to production

## The finding: `feed_post_delete` / `feed_post_update`

Both bodies read:

```sql
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
SELECT author_id INTO v_author FROM feed_posts WHERE id = p_id;
IF NOT FOUND THEN … END IF;
IF v_author <> auth.uid() AND NOT is_admin() THEN
  RAISE EXCEPTION 'not your post';
END IF;
```

`feed_posts.author_id` is **nullable**, and **9 of the 18 live posts have `author_id IS NULL`**.
For those rows `NULL <> auth.uid()` is NULL, `NULL AND true` is NULL, and the `IF` body is
skipped. **Any signed-in account could delete or rewrite those 9 posts.**

This is not the anon hole NOGUARD1/2 addressed — `auth.uid() IS NOT NULL` is already asserted
above it, so anon is refused. The NULL enters through the *stored column*, which is why it
survives a correctly-behaving `auth.uid()`.

Evaluated live as a signed-in non-admin, definer-rights read (the function's own view; RLS does
not apply inside `SECURITY DEFINER`), predicate only — no function executed, no row written:

```
 total | guard_NULL_skipped | guard_denies | denies_after_fix
-------+--------------------+--------------+------------------
    18 |                  9 |            9 |               18
```

### The repair, and proof only the undetermined case moves

```sql
-- before
IF v_author <> auth.uid() AND NOT is_admin() THEN
-- after
IF NOT coalesce(v_author = auth.uid() OR is_admin(), false) THEN
```

| caller | post kind | deny BEFORE | deny AFTER |
|---|---|---|---|
| the post's real author | real author | `f` | `f` |
| a signed-in stranger | real author | `t` | `t` |
| an admin | real author | `f` | `f` |
| an admin | **author_id NULL** | `f` | `f` |
| the post's real author | **author_id NULL** | **NULL** | `t` |
| **a signed-in stranger** | **author_id NULL** | **NULL** | **`t`** |

Only the NULL rows change, and only to denied. **Admins keep access to the 9 orphan posts**, so
none of them is stranded and no moderation path is lost.

### Callers, listed before the repair was chosen

```
src/lib/feed.ts:123  feedPostUpdate()  -> feed_post_update
src/lib/feed.ts:134  feedPostDelete()  -> feed_post_delete
api/     : none
pg_proc  : none
```

Both `src/` helpers already document the rule as *"author or admin only"*. The fix makes the
body match its own stated contract. **Grants deliberately untouched** — this follows the task's
instruction to prefer fixing the check, and mirrors `contact_dossier` / `inbound_open_count`.

### Applied state, re-read from `pg_proc` independently of the migration's verify block

```
feed_post_delete  ->  IF NOT coalesce(v_author = auth.uid() OR is_admin(), false) THEN
feed_post_update  ->  IF NOT coalesce(v_author = auth.uid() OR is_admin(), false) THEN

     proname      | anon | authed | svc |                       acl
------------------+------+--------+-----+--------------------------------------------------
 feed_post_delete | t    | t      | t   | =X/postgres postgres=X/postgres anon=X/postgres …
 feed_post_update | t    | t      | t   | (identical before and after)

live evaluation, applied state, signed-in stranger:
 total | denied_now | still_undetermined
    18 |         18 |                  0
```

### Row counts, t0 → t1 tight around the apply — identical

```
docs 81 | sigs 62 | contacts 28 | profiles 11 | purchases 2 | members 10 | feed_posts 18
```

**Caveat stated rather than glossed:** production is not quiescent. `contacts` reads 28 and
`purchases` 2 here, against NOGUARD2's 34 and 5 on 2026-08-10 — other threads and the live app
work against the same instance. The t0/t1 pair above is taken tightly around the apply and is
identical; the migration contains **no DML at all** (verb census: `CREATE OR REPLACE FUNCTION`
via `EXECUTE`, plus two `DO` blocks — no `INSERT`, `UPDATE` or `DELETE`).

---

# THE CENTRAL NEGATIVE RESULT — why Phase A is not fifty functions

**48 functions** carry the house guard idiom:

```sql
IF NOT ((has_staff_access() AND v_org = current_org()) OR caller_is_document_party(p_doc)) THEN
```

Every one of them **already denies the contactless attacker correctly**, and the reason is a
piece of SQL three-valued logic that is easy to get backwards: `false AND NULL` is **`false`**,
not NULL. `has_staff_access()` is false for a non-staff caller, so the org comparison never gets
to propagate its NULL. *(My first-pass classifier flagged all 48 as failing open. That was
wrong, and it was wrong in the dangerous direction — toward changing working code.)*

They fail open for exactly one caller: **staff whose `current_org()` is NULL.**

```
profiles with NULL org_id : 1
their role                : SUPER_ADMIN
documents.org_id nullable : NO      (so v_org is never NULL — only current_org() is)
organizations             : 1
```

That account is **`admin@cactai.io`** — the owner's own platform-operator login,
`staff_active = f`, last sign-in 2026-07-10. Evaluated live as that user against real documents:

```
 doc      | staff_branch | deny_now | deny_if_blind_coalesce
----------+--------------+----------+------------------------
 5cdf57ee | (NULL)       | (NULL)   | t
 a353eab0 | (NULL)       | (NULL)   | t
 a0f3a4f0 | (NULL)       | (NULL)   | t
 3fc29f1e | (NULL)       | (NULL)   | t
```

`true AND (org_id = NULL)` is NULL, the guard is skipped, **and that skip is currently how the
platform operator gets access**. `coalesce(…, false)` turns every one of those into a denial.

**This is the trap the task names — "locking out a legitimate user is worse than the exposure
being fixed" — and it is not hypothetical here. It is the owner's own account, across 48
functions.**

### It is already biting, applied, in production

`caller_is_document_party_or_staff()` — the predicate NOGUARD2 chose for its
`fill_party_fields_from_contacts` guard, and the obvious choice for the readers in group (d) —
puts its staff test inside `EXISTS (… AND has_staff_access() AND d.org_id = current_org())`.
That is EXISTS-based so it returns `false` rather than NULL, which is correct and fail-closed —
**and it therefore excludes the org-less operator outright**:

```
who                                          | role        | staff | org | party_or_staff
---------------------------------------------+-------------+-------+-----+----------------
 platform operator (SUPER_ADMIN, org_id NULL)| SUPER_ADMIN | t     |     | f
 ordinary staff (org_id set)                 | ADMIN       | t     | t   | t
```

So NOGUARD2's applied guard **denies the platform operator today** on every document they are
not personally a party to:

```
 doc      | fill_party_fields_DENIES_operator
----------+-----------------------------------
 1c8bedd1 | t     9d501f79 | t     3624ee05 | t     8b897df5 | t
```

NOGUARD2 flagged this as residual risk *"under multi-tenancy"* and judged it "inert today"
because it tested with an ordinary staff account. **It is not inert; it is live.** It has gone
unnoticed because the account has not signed in since 2026-07-10 and day-to-day work runs
through `admin@fhequestrian.com` / `hello@fhequestrian.com`, which both have `org_id` set.

### The decision this forces — B4, for the owner

This is a policy question, not a code question, and it **sequences before** any coalesce sweep
or any new party-or-staff guard:

- **Option 1 — the operator is org-scoped.** Set `profiles.org_id` for `admin@cactai.io` to the
  single organization. **One row.** Every one of the 48 coalesce repairs then becomes a safe
  no-op for every real user, and `caller_is_document_party_or_staff` starts admitting the
  operator again. Cheapest by a wide margin. *(Not done here: the task forbids modifying real
  data to demonstrate a fix.)*
- **Option 2 — the operator is a platform role with explicit cross-org rights.** Change the
  idiom to `coalesce(is_super_admin() OR (has_staff_access() AND v_org = current_org()) OR …,
  false)` across 48 functions plus the shared predicate. Makes the intent explicit; 49 bodies to
  touch and re-verify.
- **Option 3 — leave it.** The org-scoping is unenforced for one dormant account under a single
  organization. It costs nothing today and breaks the day multi-tenancy arrives.

I recommend **Option 1**, and I did not take it, because it is a data change to a real row and
the decision is the owner's.

### The idiom is still being written

Three `SECURITY DEFINER` functions were added by another thread **during this session**
(`definer_total` 442 → 445, `auth_callable` 371 → 374):

```
can_cleanup_document | anon f | authenticated t
cleanup_document     | anon f | authenticated t
document_integrity   | anon f | authenticated t
```

They are careful work — `anon` correctly revoked, signature-aware, and `cleanup_document`
re-checks the guard rather than trusting the UI. And `can_cleanup_document` still ends:

```sql
RETURN has_staff_access() AND v_org = current_org();
```

which is NULL for the platform operator, so `IF NOT can_cleanup_document(...)` is skipped for
them. **A brand-new, well-written, security-conscious function lands in the same NULL class,
because the idiom is the house style.** That is the systemic finding: this class regenerates
faster than it can be audited one function at a time. Fixing the idiom at the root (Option 1 or
2) is worth more than any number of per-function repairs.

---

# The inverted guard — swept across all 371, as asked

```sql
IF auth.uid() IS NOT NULL AND NOT ( … ) THEN RAISE EXCEPTION …
```

**Exactly two instances, both in deny position**, confirming NOGUARD2's count against the full
`authenticated` surface rather than its anon subset:

| function | anon | authenticated | in Phase B |
|---|---|---|---|
| `remerge_contract_from_fields(uuid)` | f | t | `20260811T0400` |
| `invite_contract_counterparty(uuid,uuid,text)` | f | t | `20260811T0400` |

A broadened sweep — for the same shape hidden behind a local variable holding
`auth.uid()`/`current_contact_id()` — returned **9** candidates. The other seven are
`<identity> IS NOT NULL AND EXISTS (…)` in **filter** position, which is the correct
fail-closed idiom (it yields `false`, not NULL) and is left alone: `caller_is_document_party`,
`caller_owns_document`, `caller_owns_horse`, `caller_party_roles`, `can_void_document`,
`client_can_read_horse`, `contract_caller_is_originator`.

**Neither of the two is currently exploitable, and I would rather say so than dress it up:**
`anon` cannot execute either, and for an authenticated caller `auth.uid() IS NOT NULL` is true,
so the guard reduces to `NOT (…)` and fires. The change is defensive — a guard that cannot fire
for the caller it names stops anyone from looking again.

**The codebase already knows the correct idiom.** `provision_tenant` carries it with the reason
written down:

```sql
-- `IS NOT TRUE` (not `NOT …`) so anon/outsider (is_super_admin() → NULL) is denied,
-- not silently admitted by NULL propagation.
IF is_super_admin() IS NOT TRUE THEN
```

---

# PHASE B — dry run only, NOT applied

Three migrations, each revertable alone, each carrying **no transaction control of its own**
(verified: `grep -cE '^(BEGIN|COMMIT);'` = 0 for all three) so they are safe inside an outer
`BEGIN … ROLLBACK`. **This is deliberately unlike NOGUARD2's seven, every one of which carries a
self-contained `BEGIN…COMMIT` — safe standalone, lethal inside a wrapper.**

| migration | what | functions |
|---|---|---|
| `20260811T0200` | revoke internal helpers | 18 |
| `20260811T0300` | revoke the five `generate_document` helpers | 5 |
| `20260811T0400` | remove the inverted guard | 2 |

All three were dry-run together in one transaction ending `ROLLBACK`, no error, no warning.

## Raw before / after — `has_function_privilege()`, re-read, never the REVOKE's own output

```
BEFORE                                      AFTER
 fn                                | anon | authed | svc | PUBLIC      anon | authed | svc | PUBLIC
-----------------------------------+------+--------+-----+-------      -----+--------+-----+-------
 _provision_purchase_for_offerings | f    | t      | t   | f            f   | f      | t   | f
 assert_horse_care_eligible        | t    | t      | t   | t            f   | f      | t   | f
 assert_not_signature_locked       | t    | t      | t   | t            f   | f      | t   | f
 change_request_is_frozen          | t    | t      | t   | t            f   | f      | t   | f
 compose_insurance_allocation      | f    | t      | t   | f            f   | f      | t   | f
 contact_document_satisfied        | t    | t      | t   | t            f   | f      | t   | f
 contact_document_wall_state       | t    | t      | t   | t            f   | f      | t   | f
 deal_status                       | t    | t      | t   | t            f   | f      | t   | f
 derive_affiliations               | t    | t      | t   | t            f   | f      | t   | f
 document_changes_frozen           | t    | t      | t   | t            f   | f      | t   | f
 ensure_staff_profile              | t    | t      | t   | t            f   | f      | t   | f
 lease_sublease_allowed            | f    | t      | t   | f            f   | f      | t   | f
 member_display_name               | t    | t      | t   | t            f   | f      | t   | f
 next_custom_field_key             | t    | t      | t   | f            f   | f      | t   | f
 owner_has_executed_template       | t    | t      | t   | t            f   | f      | t   | f
 party_user_ids                    | t    | t      | t   | t            f   | f      | t   | f
 send_executed_document_email      | t    | t      | t   | f            f   | f      | t   | f
 undelivered_executed_documents    | t    | t      | t   | f            f   | f      | t   | f
 -- 20260811T0300, kept separate --
 document_horse_ids                | t    | t      | t   | t            f   | f      | t   | f
 expand_horse_blocks               | t    | t      | t   | t            f   | f      | t   | f
 horse_medication_component        | t    | t      | t   | t            f   | f      | t   | f
 horse_medications_prose           | t    | t      | t   | t            f   | f      | t   | f
 location_full_label               | t    | t      | t   | t            f   | f      | t   | f

all 23 after:  acl = {postgres=X/postgres,service_role=X/postgres}
totals:        anon 20 -> 0    authenticated 23 -> 0    service_role 23 -> 23    PUBLIC 17 -> 0
auth_callable: 374 -> 351
```

**Both trap grants are handled.** 17 of 23 carry a PUBLIC `=X/postgres` grant *and* a role-held
one; 6 carry only the role grant. Every grant is revoked **by name** (PUBLIC, `anon`,
`authenticated` separately), and each migration's verify block re-reads
`has_function_privilege()` and **raises** if any target is still reachable or if `service_role`
was lost. A revoke that silently did nothing cannot be reported as success.

## The caller list behind every revoke

Each of the 23 was checked three ways: `grep` for `rpc('name')` and `rpc("name")` over `src/`
and `api/`; a **loose** grep for the bare identifier to catch a dynamically built call; and a
`pg_proc` scan for in-database callers with their `prosecdef` and owner.

**Every loose hit on this list resolved to a comment or to a different function.** Specifically:

- **Correction to NOGUARD1:** it lists `src/pages/app/ContractPage.tsx` as a caller of
  `document_changes_frozen`. That is a comment, not a call.
- `send_executed_document_email` — the four `src/` hits are `resend_executed_document_email`.
- `undelivered_executed_documents` — the `api/` hits are `sweep_undelivered_executed_documents`.
- `_provision_purchase_for_offerings` — its one `src/` hit is a comment in
  `ClientRecordActions.tsx:229` describing the spine.

**The highest-consequence item is `_provision_purchase_for_offerings`**: it creates a purchase
for a caller-supplied contact/client/org with a caller-supplied `p_mark_paid`, so any free
signup could mint a purchase marked **paid**. Its only callers are `attach_offerings_to_client`
and `provision_client_invitation`, both staff/`service_role` gated. The leading underscore
states the intent; the grant contradicts it.

## Why `20260811T0300` is a separate migration — a limit on NOGUARD2's clearance argument

NOGUARD2 established that revoking never breaks an in-database caller, because every caller is a
postgres-owned `SECURITY DEFINER` function and the inner privilege check is made against
`postgres`. **That argument does not cover an INVOKER caller, and there is one here.**

```
 callee                     | caller            | is_definer | owner
----------------------------+-------------------+------------+----------
 document_horse_ids         | generate_document | f          | postgres
 expand_horse_blocks        | generate_document | f          | postgres
 horse_medication_component | generate_document | f          | postgres
 horse_medications_prose    | generate_document | f          | postgres
 location_full_label        | generate_document | f          | postgres
```

`generate_document` is `SECURITY INVOKER`. Tested rather than reasoned about, with a
three-function probe inside `BEGIN … ROLLBACK` (probe objects confirmed gone afterwards:
`0` rows matching `ng3\_%`):

```
definer_outer -> invoker -> target (revoked from authenticated), called as authenticated
  -> "target reached"                              SURVIVES

invoker -> target (revoked from authenticated),    called as authenticated
  -> ERROR: permission denied for function         BREAKS
```

So the revoke is safe for the real path and unsafe for a direct one:

- `generate_document` has **no** direct browser or `api/` RPC caller.
- **All 10** of its in-database callers are `SECURITY DEFINER`, so in every real invocation
  `current_user` is already `postgres` and the five inner calls resolve against `postgres`.
- But `generate_document` is itself granted to `anon` **and** `authenticated`, so a direct
  PostgREST call is possible today and would, after this migration, fail partway instead of
  completing.

**The more interesting finding is the one I did not act on:** `generate_document` is a
`SECURITY INVOKER` function that creates documents and is granted to `anon`. It is left alone
because changing it is a larger decision than this migration should make. (Its practical
protection today is that invoker rights mean RLS applies to it — `documents` has RLS enabled
with 2 INSERT/ALL policies — but that is a different guarantee from the one the other 441 rely
on, and it deserves its own look.)

## `20260811T0400` — before / after, raw

```
BEFORE  invite_contract_counterparty :: IF auth.uid() IS NOT NULL AND NOT (has_staff_access()
                                          AND v_doc.org_id = current_org()) THEN
BEFORE  remerge_contract_from_fields :: IF auth.uid() IS NOT NULL AND NOT (
                                          (has_staff_access() AND v_doc.org_id = current_org())
                                          OR caller_is_document_party(p_document_id) …

AFTER   invite_contract_counterparty :: IF NOT (has_staff_access() AND v_doc.org_id = current_org()) THEN
AFTER   remerge_contract_from_fields :: IF NOT ( (has_staff_access() AND v_doc.org_id = current_org())
                                          OR caller_is_document_party(p_document_id) ) THEN

has_inverted_shape:  BEFORE t/t  ->  AFTER f/f
instances left anywhere in the schema: 0
```

**What `20260811T0400` deliberately does NOT do:** both inner predicates contain
`has_staff_access() AND <row>.org_id = current_org()`, which is NULL for the platform operator.
Wrapping them in `coalesce(…, false)` would deny that account. The migration removes the anon
exemption and **preserves the existing NULL behaviour**, because B4 sequences first.

---

# The full classification of the 371

Snapshot at task start. `GUARD_FIRES` means: I evaluated the guard under three-valued logic for
the contactless-authenticated caller and the deny fires.

| class | count | meaning |
|---|---|---|
| `GUARD_FIRES` | **144** | deny-guard present and it denies the attacker |
| `IDENTITY_NO_DENY_GUARD` | **117** | identity used, but not in a deny — 87 of these in **filter** position (`WHERE`/`EXISTS`/`CASE`), which fails **closed** |
| `NO_IDENTITY_LOGIC` | **56** | no identity logic anywhere in the body |
| `GUARD_PRESENT_OTHER` | **34** | guard present, evaluates `false` for this caller (an allow-branch, not a deny) |
| `GUARD_FAILS_OPEN` | **12** | deny-guard evaluates to NULL — enumerated below |
| `GUARDED_BY_DELEGATION` | **8** | no own guard; calls a guarded function **before** its first write |

Restating the halves that matter: of the **173** with no deny-guard, **87** use identity in
filter position and fail closed; **86** have no identity check at all, and **28 of those write**.

### The 12 that fail open, every one accounted for

| function | verdict |
|---|---|
| `feed_post_delete` | **REAL — exploitable, 9 live rows. FIXED in Phase A.** |
| `feed_post_update` | **REAL — exploitable, 9 live rows. FIXED in Phase A.** |
| `admin_account_action` | Real but narrow: `v_org IS NULL OR v_org <> current_org()` is NULL only for the platform operator, and `IF NOT (has_staff_access() AND is_admin())` gates it first. **coalesce would lock the operator out → B4.** |
| `set_contact_required_documents` | Same shape, same reasoning, `has_staff_access()` gates it first. **→ B4.** |
| `create_horse_record` | Safe. `auth.uid() IS NULL OR v_me IS NULL` → `false OR true` = **true** → raises. Fail-closed. |
| `my_wall_state` | Safe. Same early-return shape; returns an empty state. |
| `my_standing_categories` | Safe. Returns `ARRAY[]::text[]`. |
| `my_name_confirmation_state` | Safe. Returns `needs_confirmation: false`. |
| `propose_community_event` | Safe. `IF v_org IS NULL THEN RAISE 'no org context'` fires **first**. |
| `provision_tenant` | Safe. `is_super_admin() IS NOT TRUE` — deliberately, with the reason in a comment. |
| `request_booking_change` | Safe. `v_client := current_client_id()` is NULL, so `v_client IS NOT NULL` is **false**, and `false AND …` is false — the author guarded it explicitly. |
| `feed_post_create` | Safe in effect, **by accident**: a caller passing `p_as_company => NULL` skips `p_as_company AND NOT is_admin()`, and is then stopped only by the `NOT NULL` constraint on `feed_posts.as_company`. NOGUARD1's "safe only because of a column constraint" class. Flagged, not changed. |

### What I would fix next, and why it is not in this task

**Group (d)/(e) from NOGUARD2 — the document, deal, horse and member readers reachable by id**
(`contract_notes_for_document`, `contract_comments_list`, `document_signature_state`,
`document_changes_since_signature`, `deal_completion_state`, `deal_document_status`,
`member_horses`, `required_templates_for_contact`, `suggested_category_for_contact`,
`complete_deal`, `remerge_contract_from_clauses`). These are genuine information leaks and
several write. **They are not in Phase B because the obvious guard —
`caller_is_document_party_or_staff()` — denies the platform operator, as proven above.** Adding
it to eleven browser-facing functions before B4 is settled would convert a latent problem into
eleven live ones. **B4 first, then this group as a coherent Phase C.**

---

# What I verified myself vs what I assumed

**Verified against production, first-hand:**

- Every grant, `proacl` and `has_function_privilege()` in this report — read, not carried over.
- That two real `auth.users` rows have no `profiles` row, and that **no trigger exists on
  `auth.users`**, so every fresh signup starts contactless.
- The identity primitives' return values for that caller, and that `has_staff_access` and its
  siblings return `false` rather than NULL.
- That `feed_posts.author_id` is nullable and 9 of 18 rows are NULL; the guard's NULL result on
  those rows; and the full before/after matrix — all by **evaluating the predicate**, never by
  executing `feed_post_delete`.
- That the platform operator is `admin@cactai.io`, `org_id IS NULL`, `SUPER_ADMIN`, and that the
  48-function idiom evaluates NULL for them while a blind coalesce would deny them.
- That `caller_is_document_party_or_staff()` already returns `false` for that account and `true`
  for ordinary staff — i.e. that NOGUARD2's applied guard denies them **today**.
- That `generate_document` is `SECURITY INVOKER`, and both halves of the invoker/definer
  privilege behaviour, by building and running a probe and confirming its removal.
- That all three Phase B migrations run clean and roll back clean, singly and together, with the
  before/after privileges re-read independently.
- That the inverted shape has exactly 2 deny-position instances and 0 remain after `0400`.
- Three new definer functions appeared mid-session; I read their bodies.

**Assumed, or established by method rather than by execution — flagged rather than proven:**

- **The classification of all 371 is an evaluation of guard *text*, not an execution.** I built a
  three-valued evaluator and corrected it twice against live checks (once for `false AND NULL`,
  once for DECLARE-section variable extraction), but a `BEFORE` trigger, `CHECK`, foreign key or
  `NOT NULL` outside the body could still stop a function I class as unguarded — as
  `feed_post_create` shows. **My 86 "no identity check" is therefore an over-count of the real
  exposure, in an unknown amount.**
- **I did not execute any of the unguarded functions.** "No effective guard" is a claim about the
  code and the predicate, not a demonstration of a completed exploit.
- **The 23 Phase B revokes were not exercised through every real in-database caller.** The
  mechanism is the one NOGUARD2 demonstrated and I re-demonstrated for the invoker case, and it
  does not vary by caller — but the individual chains were not run, because each creates or
  mutates real contract, purchase or document rows.
- **No PostgREST HTTP probe.** `.env` carries a real anon key but all behaviour here was
  demonstrated at the database layer with the role and JWT claim PostgREST sets.
- **`current_org()` under multi-tenancy** is untested, because multi-tenancy does not exist to
  test against — there is exactly 1 row in `organizations`.
- **The snapshot moved under me.** `definer_total` 442 → 445 and `auth_callable` 371 → 374
  during this session. The classification is of the 371; the Phase B arithmetic (374 − 23 = 351)
  is against the live number. NOGUARD1's caveats #8 and #9 are not theoretical — they bit twice
  in one session.
