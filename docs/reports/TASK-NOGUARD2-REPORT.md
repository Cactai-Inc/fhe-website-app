# TASK NOGUARD2 — report: making the identity checks take effect

Branch `task/noguard2`, worktree `~/Downloads/claude-code-repo/wt-noguard2`, off `origin/main`
@ `1928e98`. All work measured against production (`lrstswfxfsezdmvkvukc`) on 2026-08-10.

**Phase A is APPLIED to production.** Commit `6192208`.
**Phase B is APPLIED to production**, owner-approved 2026-08-10 with both flags accepted
(revoke `authenticated` on the set; keep the `org_id` predicate in the guard). Commit `e7953a3`
delivered it dry-run; applied unchanged.

---

## Headline

Phase A removed the worst finding outright and closed the last three "guard present, no effect"
cases. Phase B closed **27 more** of NOGUARD1's 76, in five separately revertable migrations.

Three claims in the input documents did not survive verification against production. All three
made the target list **wrong in composition** — two functions on it are not reachable at all, one
that belongs on it was missing, and the stated reason for guarding rather than revoking is false
in this codebase. Details in *Corrections* below. All three reproduce and are recorded at the top
of `TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md`; the third changed the strategy from "write seven guards"
to "revoke six, guard one".

| | count |
|---|---|
| NOGUARD1 **DOES NOT ENFORCE** | 76 |
| closed by Phase A | **4** |
| closed by Phase B | **27** |
| **remaining** | **45** |

Measured against production after both phases:

```
                | NOGUARD1 baseline | after A+B
                |    2026-08-07/08  | 2026-08-10
----------------+-------------------+-----------
definer_total   |        441        |    441
anon_exec       |        319        |    291
trigger_fns     |         34        |     34
anon_callable   |        285        |    257
auth_callable   |        396        |    370
```

`anon_callable` 285 → 257 is 27 revokes plus the one drop. `auth_callable` 396 → 370 is the 26
functions that also lost `authenticated` (one of the 27, `fill_party_fields_from_contacts`, keeps
it and is guarded instead). `definer_total` holds at 441 because another thread added
`compose_insurance_allocation` during this task — see *Out of scope*.

### A correction to my own arithmetic

I reported "23 functions lose `authenticated`", "24 closed by Phase B", "28 total", "48 remaining"
in the Phase B review summary. Those figures were computed before migration `20260810T0700` was
written and were not recomputed. The correct figures are **26 / 27 / 31 / 45**. The *set* of
functions was never wrong — all 27 are named in the tables below, and `0700` is described in full —
only the counts were stale.

---

# PHASE A — applied to production

## A1. `void_signatures_on_edit(uuid)` — DROPPED

### Before (raw)

```
proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,
         authenticated=X/postgres,service_role=X/postgres}

rolname       | can_exec
--------------+---------
anon          | t
authenticated | t
service_role  | t
postgres      | t

public_grant_present | t
```

### Blast radius — larger than the audit recorded

The audit measured 55 documents / 56 signatures on 2026-08-08. On 2026-08-10:

```
documents with live signatures : 61
live signature rows            : 62
```

### It had never fired

```
documents.signatures_voided_at IS NOT NULL :  0
total documents                            : 81
```

This is the strongest evidence available that nothing depended on it, and it is a fact neither
input document reports.

### Caller check — four ways, all zero

| method | result |
|---|---|
| `grep` over `src/` | 0 |
| `grep` over `api/` | 0 |
| `pg_proc.prosrc` scan of every other function | 0 |
| `pg_depend` (`deptype <> 'n'`) | 0 — no trigger, view, default or RLS policy |

Exactly one overload. Six historical migrations reference it (its creation and rewrites), which is
where the body is recoverable from besides the migration header.

The migration asserts all four of those conditions **before** dropping, and uses `DROP FUNCTION`
with **no `CASCADE`**, so any dependency at all would have aborted it.

### After (raw)

```
remaining overloads in public          : 0
matches in ANY schema                  : 0
to_regprocedure('...void_signatures_on_edit(uuid)') : NULL
```

The three-grant trap is moot, exactly as the task predicted: there is no grant left to get wrong,
and no `has_function_privilege()` row to print because the signature no longer resolves.

## A2. `gift_claim_link`, `gift_mark_sent`, `gift_reschedule` — fail closed

### Before / after (raw, `pg_get_functiondef`)

```
                  BEFORE                                     AFTER
gift_claim_link | IF NOT (has_staff_access()      | IF NOT coalesce(has_staff_access()
gift_mark_sent  |   OR v_g.buyer_user_id          |   OR v_g.buyer_user_id
gift_reschedule |   = auth.uid()) THEN            |   = auth.uid(), false) THEN
gift_transfer   | (already correct)               | (unchanged)
```

### Grants — deliberately NOT touched

```
fn                            | anon | authed | svc | PUBLIC | raw_acl
------------------------------+------+--------+-----+--------+-------------------------------------
gift_claim_link(uuid)         | t    | t      | t   | t      | {=X/postgres,postgres=X/postgres,
gift_reschedule(uuid,date)    | t    | t      | t   | t      |  anon=X/postgres,
gift_transfer(uuid,text,text) | t    | t      | t   | t      |  authenticated=X/postgres,
gift_mark_sent(uuid)          | t    | t      | t   | t      |  service_role=X/postgres}
```

Identical before and after. This follows the task's instruction to prefer fixing the check, and
mirrors NOGUARD1's `contact_dossier` / `inbound_open_count` result: the function stays reachable
and starts denying correctly.

### Verification — exercised, not reasoned about

The task asks that the legitimate caller be exercised. `gifts` holds **0 rows** and no INSERT path
into it exists in `pg_proc`, `src/` or `api/`, so this was done against a synthetic gift created
and destroyed inside `BEGIN … ROLLBACK`. `gifts` held 0 rows before and holds 0 rows now.

| caller | `gift_claim_link` | `gift_mark_sent` | `gift_reschedule` |
|---|---|---|---|
| `anon` | `ERROR: not your gift` | `ERROR: not your gift` | `ERROR: not your gift` |
| the buyer (`role=USER`) | returns `/redeem?code=…` | succeeds, `send_count` 0→1 | succeeds, `deliver_on` moved |
| staff (`role=ADMIN`) | returns `/redeem?code=…` | — | — |
| a different `role=USER` | `ERROR: not your gift` | — | — |

Predicate evaluation, the shape the task asks for, with an attacker-chosen **non-NULL**
`buyer_user_id` (the worst case):

```
as anon:                          old_deny_fires | new_deny_fires
                                  ---------------+---------------
                                  (NULL)         | t
```

`NULL` means the `IF` body is skipped and the caller proceeds; `t` means the `RAISE` runs.

And the four-way matrix for a signed-in caller, showing that only the undetermined case moved:

| case | old | new |
|---|---|---|
| A. buyer_user_id = me (legitimate) | `f` | `f` |
| B. buyer_user_id = someone else | `t` | `t` |
| C. buyer_user_id IS NULL | **NULL** | **t** |
| D. staff | `f` | `f` |

Only row C changes, and only to denied.

### One behaviour change worth naming

Row C is not only anon. The predicate is also NULL for a *signed-in non-staff* caller when
`buyer_user_id IS NULL` — the column is nullable, so a future guest-checkout gift would be
actionable today by any account holder, and afterwards by staff only. That is a correction rather
than a regression (such a caller was never matched on identity, only unmatched by a guard that
never ran), and it is currently moot at 0 gift rows. Recorded because it is a real difference and
it will matter when the gift subsystem is finished.

## Phase A verification ledger

| check | result |
|---|---|
| row counts, t0 → t1 around the apply | `documents` 81, `signatures` 62, live 62, `contacts` 34, `profiles` 11, `purchases` 5, `members` 10, `gifts` 0 — identical |
| signatures deleted | 0 |
| documents voided | 0 |
| Sarah's document `704c8d2d-…` | never read, never written; excluded by predicate from every query that selected a document |
| objects left behind | none — `noguard2_probe_wrapper` and `void_signatures_on_edit` both resolve to NULL |

**Caveat, stated rather than glossed:** the production database is not quiescent. `contacts` read
34, then 35, then 34 again during read-only reconnaissance — other worktrees/threads are live on
the same database. The t0/t1 counts above are taken tightly around the apply and are identical; my
only writes were inside transactions that rolled back.

**Not reproduced:** NOGUARD1's PostgREST `22P02` reachability probe. The local `.env` contains
placeholder values (`https://placeh…`, a 20-character key) and `fhequestrian.com` timed out, so no
real `anon` key was available. The database-level proof stands in its place and is conclusive for
the drop: PostgREST derives its RPC surface from `pg_proc`, and the function is no longer there.
For the gift functions the substitute is stronger than the HTTP probe — the bodies were executed
under `SET LOCAL ROLE anon` with the same `request.jwt.claims` a PostgREST anon request carries.

---

# CORRECTIONS TO THE INPUT DOCUMENTS

The task states the audit is authoritative where it and the report disagree. Neither is
authoritative over production, and three things did not survive checking.

## 1. The "nine anon-reachable `contract_fields` writers" are SEVEN

`contract_split_deductible_sync` and `sync_horse_fields_to_documents` are **`RETURNS trigger`**.

```
fn                              | returns | not_directly_callable
--------------------------------+---------+----------------------
contract_split_deductible_sync  | trigger | t
sync_horse_fields_to_documents  | trigger | t
```

Proven the same way NOGUARD1 proved it for the trigger class, as `anon` against production:

```
anon=> SELECT contract_split_deductible_sync();
ERROR:  trigger functions can only be called as triggers
anon=> SELECT sync_horse_fields_to_documents();
ERROR:  trigger functions can only be called as triggers
```

They back real triggers (`contract_fields_split_sync` on `contract_fields`,
`horses_sync_contract_fields` on `horses`) and are not an anon-reachable entry point.

**How they got on the list:** NOGUARD1's population query filtered `rettype <> 'trigger'`. The
audit's §3 `contract_fields` query did not. Two of the nine are an artifact of that dropped filter.

## 2. `remove_document_co_buyer` IS anon-reachable, and belongs on the list

The audit §3 says the three functions carrying `assert_not_signature_locked` are
"**All three are `anon = false`.**" Production:

```
fn                                        | anon | authed | PUBLIC
------------------------------------------+------+--------+-------
set_contract_field(uuid,text,text)        | f    | t      | f      <- audit correct
set_document_co_buyer(uuid,uuid,…)        | t    | t      | t      <- audit incorrect
remove_document_co_buyer(uuid)            | t    | t      | t      <- audit incorrect
set_field_structured(uuid,text,jsonb)     | t    | t      | t      <- a FOURTH lock-caller
                                                                      the audit omits
```

`set_document_co_buyer` and `set_field_structured` carry their own identity guards (NOGUARD1
classes both ENFORCES), so they are not holes. **`remove_document_co_buyer` carries no identity
check at all** — it deletes `BUYER` rows from `document_parties` and `contract_parties` and clears
every `COBUYER.*` value, given only a document id. It is NOGUARD1's write **#2**, and the audit's
list of nine omitted it while including two functions anon cannot call.

The audit's framing — that the lock is "applied exactly where it is least needed", all three being
unreachable — is therefore not right either. Two of the three are anon-reachable.

**Also flagged, not fixed:** `remove_document_co_buyer` calls `assert_not_signature_locked`
**after** its `DELETE`s and its `UPDATE`, not before. NOGUARD1 reported this; the audit dismissed
it. It is not currently exploitable — a `RAISE` rolls the statement back — but any caller wrapping
it in an `EXCEPTION` handler would keep the deletes and swallow the lock, and this codebase has
exactly such a handler (`sync_horse_fields_to_documents` does `EXCEPTION WHEN OTHERS THEN NULL`).
Reordering is a body rewrite and belongs in its own reviewed change; it is not in these migrations.

## 3. "Revoking breaks the in-database caller" is false here

The task doc says four of the nine "must be GUARDED, not revoked — revoking breaks the caller".
That is worth testing rather than accepting, because it drives the whole treatment. Tested against
production inside `BEGIN … ROLLBACK`:

```
-- revoke all three grants on apply_field_formats
REVOKE EXECUTE … FROM PUBLIC;  FROM anon;  FROM authenticated;
proacl now: {postgres=X/postgres,service_role=X/postgres}
anon f | authenticated f

-- (a) anon calling it DIRECTLY
SET LOCAL ROLE anon; SELECT apply_field_formats('…');
ERROR:  permission denied for function apply_field_formats

-- (b) anon calling it THROUGH a postgres-owned SECURITY DEFINER wrapper,
--     which is the shape of every real in-database caller
SET LOCAL ROLE anon; SELECT noguard2_probe_wrapper('…');
result: "inner function was reached"
```

A `SECURITY DEFINER` function executes as its owner, so the privilege check on the inner call is
made against `postgres`, which keeps EXECUTE. Every in-database caller of every function in scope
is `postgres`-owned and `SECURITY DEFINER` (checked via `pg_get_userbyid(proowner)` and
`prosecdef`). **Revoking closes the HTTP surface and leaves the internal call graph untouched.**

This is NOGUARD1's own category-5 argument, which the audit and the task doc both contradicted.
NOGUARD1 was right. It is why Phase B revokes six of the seven rather than writing six new guards —
fewer new predicates is strictly less risk.

---

# PHASE B — APPLIED to production

Five migrations, each revertable alone. Before approval, all five were dry-run individually **and**
all five together in one transaction; every run ended `ROLLBACK` with no error and no warning, and
production was re-read afterwards unchanged. They were then applied in order, unmodified.

| migration | what | functions |
|---|---|---|
| `20260810T0300` | revoke internal contract writers | 7 |
| `20260810T0400` | guard + partial revoke `fill_party_fields_from_contacts` | 1 |
| `20260810T0500` | revoke the laundering wrapper `lease_expiry_nudge` | 1 |
| `20260810T0600` | revoke category-5 internal helpers | 15 |
| `20260810T0700` | revoke two roster dumps + the billing seam | 3 |

## Safety clearance done before designing anything

**No `api/` path reaches any of the seven `contract_fields` writers**, even transitively. Computed
as a 6-deep call-graph closure over `pg_proc.prosrc` starting from all **25** RPC names invoked
anywhere under `api/`:

```
reached_target | depth | path
---------------+-------+------
(0 rows)
```

So for that group there is no `service_role` path to preserve and the `session_user` trap does not
arise. Where an `api/` caller *does* exist (`lease_expiry_nudge`, `publish_open_slots_all`,
`confirm_booking_for_purchase`), `service_role` is retained and the separation is made **by role,
never by `session_user`** — no such predicate is written anywhere in Phase B.

## The caller list every decision rests on

`db` = `pg_proc.prosrc`; `src`/`api` = grepped twice, once for the quoted RPC form and once loosely
for the bare identifier, to catch a dynamically built call.

| function | db | src | api | treatment |
|---|---|---|---|---|
| `apply_field_formats` | 0 | 0 | 0 | revoke PUBLIC+anon+authenticated |
| `regroup_contract_subjects` | 0 | 0 | 0 | revoke |
| `seed_cascade_fields` | 0 | 0 | 0 | revoke |
| `bos_generate_document` | 2 | 0 | 0 | revoke (definer chain proven safe) |
| `recompose_document_fields` | 3 | 0 | 0 | revoke |
| `sync_contract_fields_from_defs` | 1 | 0 | 0 | revoke |
| `remove_document_co_buyer` | 1 | 0 | 0 | revoke |
| `fill_party_fields_from_contacts` | 7 | **1** | 0 | **guard**, revoke PUBLIC+anon, keep `authenticated` |
| `lease_expiry_nudge` | 0 | 0 | **1** | revoke, keep `service_role` |
| 15 category-5 helpers | 1–6 | 0 | 0/1 | revoke, keep `service_role` |
| `affiliation_reconciliation` | 0 | 0 | 0 | revoke |
| `wall_onboarding_invariant_violations` | 0 | 0 | 0 | revoke |
| `confirm_booking_for_purchase` | 0 | 0 | **2** | revoke, keep `service_role` |

`fill_party_fields_from_contacts` is the only one that cannot be revoked from `authenticated`:

```
src/lib/contracts.ts  captureContactInfo()
  supabase.from('contacts').update(patch)
  supabase.rpc('fill_party_fields_from_contacts', { p_document_id })
  supabase.rpc('remerge_contract_from_clauses',   { p_document_id })
```

A document party correcting their own contact details from inside the contract. It gets the guard.

## The guard, and proof it admits the right people

Reused, not invented — `caller_is_document_party_or_staff()` is the existing predicate for exactly
this question and is `EXISTS`-based, so it returns `false` and never NULL:

```sql
IF NOT coalesce(caller_is_document_party_or_staff(p_document_id), false) THEN
  RAISE EXCEPTION 'not authorized to write party fields on document %', p_document_id;
END IF;
```

Exercised inside the dry-run transaction against a real document (**not** Sarah's):

| caller | predicate | result |
|---|---|---|
| `anon` | — | `ERROR: permission denied for function` (stopped at the grant) |
| the real party (`d226273d…`) | `t` | call **succeeds** |
| a signed-in stranger (`ac3aecb9…`) | `f` | `ERROR: not authorized to write party fields on document 152912dd…` |

**Why the seven in-database callers still work:** each of them is itself staff-gated
(`IF NOT has_staff_access() THEN RAISE`), so the caller reaching `fill_party_fields_from_contacts`
is staff, and the staff branch of the predicate resolves:

```
uid b45a5503… | staff t | current_org e656f20b…
doc 8b897df5… | org_matches t | guard_passes t
```

`auth.uid()` / `current_contact_id()` read the request JWT and are **not** rewritten by
`SECURITY DEFINER`, so a legitimate user arriving through any in-database caller is still evaluated
as themselves.

**Residual risk, flagged for the review:** the staff branch additionally requires
`d.org_id = current_org()`, which is marginally tighter than the callers' own bare
`has_staff_access()`. There is exactly one row in `organizations`, and it matched on every document
tested, so this is inert today — but it is a real difference and would matter under multi-tenancy.

## `lease_expiry_nudge` and the wrapper class

The instance is confirmed:

```
lease_expiry_nudge(integer)  anon t  authenticated t  service_role t  PUBLIC t
lease_reminder_sweep()       anon f  authenticated t  service_role t  PUBLIC f
body: BEGIN RETURN lease_reminder_sweep(); END;
```

anon cannot call the callee, can call the wrapper, and the wrapper is `SECURITY DEFINER`. No guard
is proposed — the correct authorization for the wrapper is exactly the callee's, and the way to say
that is to stop granting the wrapper more. `service_role` is retained for
`api/notifications-nudge.ts:70`.

### The class sweep the task asked for

Definition: `SECURITY DEFINER`, non-trigger, anon-executable, whose body calls a public function
anon cannot execute. That yields **49** functions. Most are **not** holes — a guarded RPC calling an
internal helper is what a definer boundary is *for*.

Intersecting the 49 with NOGUARD1's own 76 DOES-NOT-ENFORCE set leaves the **nine** that both
launder privilege and have no guard of their own:

| wrapper | reaches (anon-unreachable) | covered by |
|---|---|---|
| `lease_expiry_nudge` | `lease_reminder_sweep` | `20260810T0500` |
| `recompose_document_fields` | `compose_insurance_allocation` | `20260810T0300` |
| `remove_document_co_buyer` | `remerge_contract_from_clauses` | `20260810T0300` |
| `fill_party_fields_from_contacts` | `remerge_contract_from_fields` | `20260810T0400` |
| `_publish_open_slots_for_org` | `business_hours` | `20260810T0600` |
| `publish_open_slots_all` | `business_hours` | `20260810T0600` |
| `contract_lock_blockers` | `open_change_requests` | `20260810T0600` |
| `ensure_contact_for_profile` | `promote_contact_to_account` | `20260810T0600` |
| `notify_purchase_unpaid` | `notify_staff`, `notify_user` | `20260810T0600` |

`lease_expiry_nudge` is the only **pure** case — a body that is one call and nothing else.

**Swept and deliberately not changed:**

- `my_onboarding_checklist` → `contact_checklist`. Looks identical, is not. Its body is
  `CASE WHEN has_staff_access() … WHEN current_contact_id() IS NULL THEN '[]' ELSE contact_checklist(current_contact_id()) END`
  — identity in **filter position**, so it fails closed (anon gets `'[]'`), and it passes
  `current_contact_id()` rather than a caller-supplied id, so it can only ever return the caller's
  own checklist. Correctly in NOGUARD1's ENFORCES list.
- The other ~38 of the 49 are all in ENFORCES: they carry their own identity guard, so the inner
  call is authorized before it happens.

### A second, distinct failure shape found while sweeping

Two functions carry a guard that **explicitly exempts the unidentified caller** — the inverse of
the NULL-propagation bug, and something NOGUARD1's shape analysis would not flag:

```sql
IF auth.uid() IS NOT NULL AND NOT ( … ) THEN RAISE EXCEPTION …
```

For anon, `auth.uid() IS NOT NULL` is `false`, so the whole condition is false and the deny never
runs — by construction, not by NULL accident.

```
fn                                           | anon | authed
---------------------------------------------+------+-------
remerge_contract_from_fields(uuid)           | f    | t
invite_contract_counterparty(uuid,uuid,text) | f    | t
```

**Neither is anon-executable**, so this is not an anon hole and nothing here changes them. It is an
`authenticated` exposure and belongs to NOGUARD3. Recorded because the shape is a distinct class
worth grepping for in that audit.

## Raw before/after for every Phase B function

**Before** (all 24 anon-reachable; note two carry no PUBLIC grant, which is exactly why each grant
is revoked by name):

```
fn                                                | anon | authed | svc | PUBLIC | db_callers
--------------------------------------------------+------+--------+-----+--------+-----------
apply_field_formats(uuid)                         | t    | t      | t   | t      | 0
regroup_contract_subjects(uuid)                   | t    | t      | t   | t      | 0
seed_cascade_fields(uuid)                         | t    | t      | t   | t      | 0
bos_generate_document(uuid,uuid,uuid,jsonb)       | t    | t      | t   | t      | 2
recompose_document_fields(uuid)                   | t    | t      | t   | t      | 3
sync_contract_fields_from_defs(uuid)              | t    | t      | t   | t      | 1
remove_document_co_buyer(uuid)                    | t    | t      | t   | t      | 1
fill_party_fields_from_contacts(uuid)             | t    | t      | t   | t      | 7
lease_expiry_nudge(integer)                       | t    | t      | t   | t      | 0
_publish_open_slots_for_org(uuid,integer,integer) | t    | t      | t   | f      | 2
_resolve_location(uuid,uuid,jsonb)                | t    | t      | t   | t      | 1
apply_affiliations(uuid)                          | t    | t      | t   | t      | 5
apply_category_documents(uuid,text[])             | t    | t      | t   | t      | 3
consume_unit_for_booking(uuid)                    | t    | t      | t   | t      | 1
contract_lock_blockers(uuid)                      | t    | t      | t   | t      | 2
contract_notify(uuid,uuid,text,text,text)         | t    | t      | t   | t      | 5
ensure_contact_for_profile(uuid)                  | t    | t      | t   | t      | 4
generate_fulfillment_units(uuid)                  | t    | t      | t   | t      | 1
log_status_event(text,uuid,text,text,uuid)        | t    | t      | t   | t      | 5
notify_purchase_unpaid(uuid)                      | t    | t      | t   | t      | 1
publish_open_slots_all(integer,integer)           | t    | t      | t   | f      | 0
redline_notify(uuid,text,text)                    | t    | t      | t   | t      | 2
resolve_notifications_for_link(text,uuid,text)    | t    | t      | t   | t      | 6
set_unit_status(uuid,text,text)                   | t    | t      | t   | t      | 3
affiliation_reconciliation()                      | t    | t      | t   | t      | 0
wall_onboarding_invariant_violations()            | t    | t      | t   | t      | 0
confirm_booking_for_purchase(uuid)                | t    | t      | t   | t      | 0
```

**After** (from the dry runs; every function re-read with `has_function_privilege()`, never trusting
the `REVOKE` output):

```
23 of 24  -> anon=f authenticated=f service_role=t PUBLIC=f
             acl={postgres=X/postgres,service_role=X/postgres}

fill_party_fields_from_contacts
          -> anon=f authenticated=t PUBLIC=f guarded=t
             acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

Each migration's verify block **raises** if any target is still reachable, and separately raises if
`service_role` was lost where it was meant to be retained. A revoke that silently did nothing
cannot be reported as success.

## Post-apply verification

Re-read independently of the migrations' own verify blocks, so the check does not depend on the
thing it is checking:

```
 total | still_anon | still_authed | still_public | svc_kept
-------+------------+--------------+--------------+----------
    27 |          0 |            1 |            0 |       27
```

The one retaining `authenticated` is the guarded one:

```
fill_party_fields_from_contacts(uuid) | anon f | authed t | guarded t
  {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

**Row counts, t0 → t1 tight around the apply — identical**, including the tables these functions
write to:

```
docs 81 | sigs 62 | live_sigs 62 | contacts 34 | profiles 11 | purchases 5
members 10 | contract_fields 654 | document_parties 127 | bookings 319
```

**anon is now refused at the grant** (sample, run against the applied state):

```
ERROR:  permission denied for function recompose_document_fields
ERROR:  permission denied for function remove_document_co_buyer
ERROR:  permission denied for function affiliation_reconciliation
ERROR:  permission denied for function confirm_booking_for_purchase
ERROR:  permission denied for function lease_expiry_nudge
```

**A free signup is refused too**, which is the point of taking `authenticated` as well:

```
as authenticated (role USER):
ERROR:  permission denied for function affiliation_reconciliation
ERROR:  permission denied for function confirm_booking_for_purchase
```

**The guard, on a real document (not Sarah's), post-apply:**

| caller | result |
|---|---|
| `anon` | `permission denied for function` — stopped at the grant |
| signed-in stranger | `not authorized to write party fields on document 152912dd…` — stopped by the guard |
| the real document party | **succeeds** |
| staff | **succeeds** |

**The three `service_role` paths survive** (privilege checked; deliberately NOT executed, because
`lease_expiry_nudge` sends notifications to every lessee and `publish_open_slots_all` writes
availability across every tenant):

```
confirm_booking_for_purchase(uuid)      | svc_can_run t
lease_expiry_nudge(integer)             | svc_can_run t
publish_open_slots_all(integer,integer) | svc_can_run t
```

## The last-mile residual: two chains closed, the rest accepted

The residual named at review was that the privilege *mechanics* were proven but the revoked
functions had not been run through their real in-database callers end-to-end. That was accepted
rather than closed. Two chains have since been closed against the applied state, both inside
`BEGIN … ROLLBACK`:

**Chain 1 — horse-record capture** (`capture_horse_record_info` → `sync_contract_fields_from_defs`
[revoked] → `fill_party_fields_from_contacts` [revoked from anon, guarded] →
`remerge_contract_from_fields`), acting as staff:

```
capture_horse_record_info('a353eab0-…','{}')  -> chain_completed
sync_contract_fields_from_defs('a353eab0-…')  -> ERROR: permission denied
```

Same user, same session: the chain completes, the direct call is refused.

**Chain 2 — the browser "Save" button** (`src/lib/contracts.ts saveContract` →
`remerge_contract_from_clauses` → `recompose_document_fields` [revoked]), on a live
`HORSE_LEASE_V2` document:

```
remerge_contract_from_clauses('e1052bae-…') -> composed_body_chars 26510
recompose_document_fields('e1052bae-…')     -> ERROR: permission denied
```

The highest-traffic contract path in the app composes a 26,510-character body normally while its
inner function is unreachable directly.

Row counts were re-read after every chain test and are unchanged (`contract_fields` 654,
`document_parties` 127, `documents` 81, `signatures` 62, `horses` 4, `bookings` 319).

**Still accepted, not closed:** the remaining in-database callers were not each exercised —
`start_bill_of_sale`, `start_bill_of_sale_standalone`, `start_sale_contract`,
`start_lease_contract_v2`, `add_deal_document`, `reassign_document_party`, `set_document_co_buyer`,
and the trigger-borne paths into `apply_affiliations`, `generate_fulfillment_units`,
`consume_unit_for_booking`, `log_status_event`, `set_unit_status`, `_resolve_location`,
`_publish_open_slots_for_org`. Each creates or mutates real contract, fulfillment or calendar rows,
and the task forbids modifying real data to demonstrate a fix. The two chains above exercise the
same mechanism these rely on — a postgres-owned `SECURITY DEFINER` caller reaching a revoked
callee — across four of the revoked functions, and the mechanism is uniform: it does not vary by
which caller invokes it. This is the accepted residual, stated as accepted.

---

# The remainder — 45 still DOES NOT ENFORCE, and why

Deliberately left, grouped by reason. Nothing here is left for lack of time; each has a reason it
should not be changed by this task.

**a. Safe by construction (7) — NOGUARD1 verified them and I did not re-litigate.**
`admin_client_documents` (guarded in `WHERE`, both UNION arms), `booking_notifies_client`,
`booking_service_type`, `horse_field_token_value` (composite-row arguments — they answer about what
the caller already holds), `intake_requirements` (scoped by `current_org()`, empty for anon),
`document_changes_frozen`, `change_request_is_frozen` (status oracles over data the party already
sees).

**b. Configuration reads with no personal data (4).** `config_required_missing`,
`invitation_expiry_days`, `reschedule_fee`, `next_custom_field_key`. Low value to an attacker; two
have `api/` callers. Revoking is defensible but is not free of risk, and the task's rule is to
report rather than change where unsure.

**c. `api/`-called log writers (4).** `log_evaluation_report_access`, `log_mirror_delivery`,
`log_receipt_send`, `claim_receipt_send`. All reached from `api/` via `service_role`. The same
grant-only treatment used in `20260810T0700` would work, but each touches the receipt/idempotency
seam (`log_receipt_send` burning an idempotency key can suppress a real receipt), so they want the
same review the billing seam got rather than being bundled in.

**d. Document/deal readers reachable by document id (14).** `contract_notes_for_document`,
`document_signature_state`, `document_changes_since_signature`, `party_user_ids`, `deal_status`,
`deal_completion_state`, `deal_document_status`, `document_horse_ids`, `contact_document_satisfied`,
`contact_document_wall_state`, `required_templates_for_contact`, `owner_has_executed_template`,
`derive_affiliations`, `assert_not_signature_locked`. These are genuine information leaks, but four
have `src/` callers on live party-facing surfaces and the right fix is a
`caller_is_document_party_or_staff()` guard **per function**, each needing its own caller check.
That is a coherent third phase, not a tail to bolt onto this one.

**e. Horse/member readers (8).** `horse_medications_prose`, `horse_medication_component`,
`member_horses`, `member_display_name`, `location_full_label`, `expand_horse_blocks`,
`horse_time_conflict`, `caller_may_use_horse`. Animal medical data and name/address lookups by id.
Same reasoning as (d).

**f. Writers needing a designed guard, not a grant change (8).** `complete_deal`,
`assert_horse_care_eligible` (creates documents despite the name),
`send_executed_document_email`, `undelivered_executed_documents`, `supersede_invitations`,
`ensure_staff_profile`, `insurance_resolution_sync`, `reap_expired_holds`. Several have `src/` or
`api/` callers; each needs a purpose-appropriate predicate, and the task explicitly warns against
pasting a staff check onto something meant for ordinary members.

7 + 4 + 4 + 14 + 8 + 8 = **45**.

**Separately, left alone on instruction** (these are in NOGUARD1's *intentionally public* 10, not
in the 76, so they are not part of the 45): `redeem_gift` (self-enforcing —
`IF auth.uid() IS NULL THEN RETURN 'not_authenticated'`), `open_gift` (the gift code is the
credential), and the public catalog read path. Confirmed untouched.

---

# Out of scope, but tripped over

**`authenticated` went 396 → 370, and that is not NOGUARD3 being done.** Phase A left it at 396;
Phase B closed 26 incidentally, because revoking a function with no browser caller costs nothing
and leaving it would leave the finding open to anyone who signs up. The real NOGUARD3 question is
untouched: **370** definer functions are still callable by any free signup, and most of them *do*
have browser callers, so they cannot be fixed by a grant — they need predicates that distinguish
*this* somebody from *that* one. On consequence that still outranks what this task closed.

**A new `SECURITY DEFINER` function landed during this task.** `definer_total` is still 441 after I
dropped one, so one was added since the audit: `compose_insurance_allocation(uuid)`, from the
leasefix thread on 2026-08-09.

```
anon f | PUBLIC f | authenticated t
{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

That thread **did** revoke `anon` and PUBLIC — good hygiene against NOGUARD1's caveat #8, and worth
noting as the pattern to copy. It is `authenticated`-reachable, which is NOGUARD3's surface.

**Two Phase B targets were rewritten mid-task.** The leasefix migrations of 2026-08-09 replaced
`recompose_document_fields` and `sync_contract_fields_from_defs`. Their bodies are newer than the
audit's snapshot, so both were re-read from production rather than taken from the audit. Neither
had gained a guard. This is NOGUARD1's caveat #9 (point-in-time snapshot) actually biting, twice,
within three days.

---

# What I verified myself vs what I assumed

**Verified against production, first-hand:**

- Every grant figure, every `proacl`, every `has_function_privilege()` in this report — read, not
  copied from the input documents.
- That `void_signatures_on_edit` had no caller (4 methods) and had never fired.
- That the two trigger functions cannot be called by anon — by calling them as anon.
- That `remove_document_co_buyer`, `set_document_co_buyer` and `set_field_structured` are
  anon-reachable, contradicting the audit.
- That revoking does not break a `SECURITY DEFINER` caller — by revoking and calling through one.
- That no `api/` path reaches the seven contract writers — 6-deep closure from all 25 `api/` RPCs.
- The gift guards, exercised as anon / buyer / staff / stranger, before and after.
- The `fill_party_fields_from_contacts` guard, exercised as anon / party / stranger / staff — both
  in dry run and again against the applied state.
- That all five Phase B migrations run clean and roll back clean, singly and together, and then
  apply clean.
- Post-apply: all 27 re-read independently of the migrations' own verify blocks; anon and
  authenticated refused by direct call; the three `service_role` paths still privileged.
- Two real in-database definer chains run end-to-end against the applied state — horse-record
  capture and the browser `saveContract` path — each completing while the same user's direct call
  to the revoked inner function is refused.

**Assumed, and flagged rather than proven:**

- **The 45 remainder are still unguarded.** I did not re-read all 45 bodies; I carried NOGUARD1's
  classification forward. Its method was sound and its own caveats apply — including that a
  `BEFORE` trigger, `CHECK` or `NOT NULL` outside the body may already stop some of them, which
  would make 76 an over-count.
- **The remaining in-database callers.** Two chains are closed (above). The rest —
  `start_bill_of_sale`, `start_bill_of_sale_standalone`, `start_sale_contract`,
  `start_lease_contract_v2`, `add_deal_document`, `reassign_document_party`,
  `set_document_co_buyer`, and the trigger-borne paths into `apply_affiliations`,
  `generate_fulfillment_units`, `consume_unit_for_booking`, `log_status_event`, `set_unit_status`,
  `_resolve_location`, `_publish_open_slots_for_org` — were not exercised, because each creates or
  mutates real contract, fulfillment or calendar rows. The mechanism they depend on is the same one
  the two closed chains demonstrate and does not vary by caller. **Owner-accepted at review as a
  residual, not closed.**
- **`current_org()` multi-tenancy.** The `fill_party_fields_from_contacts` guard's staff branch
  requires an org match. Verified correct for the single organization that exists; not verified
  under multi-tenancy, because multi-tenancy does not exist yet to test against.
- **The PostgREST HTTP layer.** Not probed, for want of a real anon key. All anon behaviour was
  demonstrated at the database layer with the role and JWT claim PostgREST sets.
- **The `service_role` sweeps were not executed**, only privilege-checked. Running
  `lease_expiry_nudge` would notify every lessee and `publish_open_slots_all` would write
  availability across every tenant; neither is an acceptable way to prove a grant.
