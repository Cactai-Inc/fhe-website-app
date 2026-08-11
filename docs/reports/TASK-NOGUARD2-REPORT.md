# TASK NOGUARD2 — report: making the identity checks take effect

Branch `task/noguard2`, worktree `~/Downloads/claude-code-repo/wt-noguard2`, off `origin/main`
@ `1928e98`. All work measured against production (`lrstswfxfsezdmvkvukc`) on 2026-08-10.

**Phase A is APPLIED to production.** Commit `6192208`.
**Phase B is DRY-RUN ONLY and is NOT applied.** Five migrations delivered unapplied, awaiting review.

---

## Headline

Phase A removed the worst finding outright and closed the last three "guard present, no effect"
cases. Phase B is dry-run and proposes closing **24 more** of NOGUARD1's 76, in five separately
revertable migrations.

Three claims in the input documents did not survive verification against production. All three
made the target list **wrong in composition** — two functions on it are not reachable at all, one
that belongs on it was missing, and the stated reason for guarding rather than revoking is false
in this codebase. Details in *Corrections* below.

| | count |
|---|---|
| NOGUARD1 **DOES NOT ENFORCE** | 76 |
| closed by Phase A (applied) | **4** |
| proposed closed by Phase B (dry-run) | **24** |
| remaining after both | **48** |

Anon-callable definer functions moved **285 → 284** with Phase A. Phase B would take it to **260**.

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

# PHASE B — dry-run only, NOT applied

Five migrations, each revertable alone. All five were dry-run individually **and** all five
together in one transaction; every run ended `ROLLBACK` with no error and no warning. Production
was re-read afterwards and is unchanged (`anon=t, PUBLIC=t, guarded=f` on every target).

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

---

# The remainder — 48 still DOES NOT ENFORCE, and why

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

**e. Horse/member readers (6).** `horse_medications_prose`, `horse_medication_component`,
`member_horses`, `member_display_name`, `location_full_label`, `expand_horse_blocks`,
`horse_time_conflict`, `caller_may_use_horse`. Animal medical data and name/address lookups by id.
Same reasoning as (d).

**f. Writers needing a designed guard, not a grant change (8).** `complete_deal`,
`assert_horse_care_eligible` (creates documents despite the name),
`send_executed_document_email`, `undelivered_executed_documents`, `supersede_invitations`,
`ensure_staff_profile`, `insurance_resolution_sync`, `reap_expired_holds`,
`affiliation_reconciliation`-adjacent sweeps. Several have `src/` or `api/` callers; each needs a
purpose-appropriate predicate, and the task explicitly warns against pasting a staff check onto
something meant for ordinary members.

**g. Left alone on instruction (3).** `redeem_gift` (self-enforcing —
`IF auth.uid() IS NULL THEN RETURN 'not_authenticated'`), `open_gift` (the gift code is the
credential), and the public catalog read path. Confirmed untouched.

---

# Out of scope, but tripped over

**`authenticated` is still 396.** Unchanged by Phase A. Every one of the 76 is in that set and
signing up is free. Phase B would incidentally close 24 of them for `authenticated` too, because
revoking a function with no browser caller costs nothing — but the real NOGUARD3 question (the
functions that *do* have browser callers and only distinguish *nobody* from *somebody*) is
untouched.

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
- The `fill_party_fields_from_contacts` guard, exercised as anon / party / stranger.
- That all five Phase B migrations run clean and roll back clean, singly and together.

**Assumed, and flagged rather than proven:**

- **The 48 remainder are still unguarded.** I did not re-read all 48 bodies; I carried NOGUARD1's
  classification forward. Its method was sound and its own caveats apply — including that a
  `BEFORE` trigger, `CHECK` or `NOT NULL` outside the body may already stop some of them, which
  would make 76 an over-count.
- **Phase B breaks nothing.** Proven for the privilege mechanics, for the guard's predicate, and for
  the absence of `api/` paths. Not proven by running the seven guarded/revoked functions through
  every one of their in-database callers end-to-end — several of those write real contract rows,
  and the task forbids modifying real data to demonstrate a fix. This is the specific residual risk
  the Phase B review exists to accept or reject.
- **`current_org()` multi-tenancy.** The `fill_party_fields_from_contacts` guard's staff branch
  requires an org match. Verified correct for the single organization that exists; not verified
  under multi-tenancy, because multi-tenancy does not exist yet to test against.
- **The PostgREST HTTP layer.** Not probed, for want of a real anon key. All anon behaviour was
  demonstrated at the database layer with the role and JWT claim PostgREST sets.
