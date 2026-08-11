> ## THIS AUDIT WAS WRONG IN THREE PLACES. Corrected 2026-08-10 by NOGUARD2, verified by the orchestrator.
>
> NOGUARD2 tested what this document asserted. All three corrections reproduce against
> production. **Two of them changed the fix strategy**, so they matter more than a fact count.
>
> **1. "Nine unguarded anon-reachable `contract_fields` writers" — it is SEVEN.**
> `contract_split_deductible_sync` and `sync_horse_fields_to_documents` are `RETURNS trigger`
> and cannot be invoked directly (`ERROR: trigger functions can only be called as triggers`).
> §3's query dropped NOGUARD1's `rettype <> 'trigger'` filter, which is exactly how they got
> on the list.
>
> **2. "All three [lock-carrying functions] are `anon = false`" — WRONG, and one was missed.**
> ```
> set_contract_field        anon f   <- correct
> set_document_co_buyer     anon t   <- WRONG
> remove_document_co_buyer  anon t   <- WRONG
> set_field_structured      anon t   <- a FOURTH lock-caller, omitted entirely
> ```
> `remove_document_co_buyer` has no identity check and deletes BUYER parties on any document
> id. This audit corrected the thread's report using a fact that was itself wrong.
>
> **3. "A function with an internal caller must be GUARDED, not revoked — revoking would break
> the caller." FALSE.** Proven in a rolled-back transaction:
> ```
> anon -> inner directly         ERROR: permission denied for function
> anon -> definer outer -> inner "inner reached"
> ```
> `SECURITY DEFINER` runs as its owner, so an inner call is checked against `postgres`, not
> the session role. Every in-database caller in scope is postgres-owned and definer. **This is
> why six of seven are revoked rather than given six new guards — fewer new predicates is less
> risk.** NOGUARD1's category-5 argument was right; this audit contradicted it and the task doc
> inherited the error.
>
> **The lesson, and it is the standing one:** each wrong claim came from a test adjacent to the
> question — a DML pattern match instead of a signature check, a remembered grant instead of a
> queried one, and a plausible privilege model instead of a rolled-back experiment.

# NOGUARD1 — orchestrator's independent audit

**Audited 2026-08-08 against production (`lrstswfxfsezdmvkvukc`), read-only.** This is the
check on `docs/reports/TASK-NOGUARD1-REPORT.md`, not a summary of it. Read the thread's
report for the method; read this for what survived verification and what did not.

**Verdict: the report holds. Its worst finding is real. It understates the contract-field
surface by 3×.**

Everything below was run as SQL against the live database. No function was executed, no row
was written, and Sarah's document was never touched.

---

## 1. The population counts reproduce exactly

Not estimates — the denominators are real.

```sql
SELECT count(*) AS definer_total,
       count(*) FILTER (WHERE anon_x) AS anon_exec,
       count(*) FILTER (WHERE rettype='trigger') AS trigger_fns,
       count(*) FILTER (WHERE anon_x AND rettype<>'trigger') AS anon_callable,
       count(*) FILTER (WHERE auth_x AND rettype<>'trigger') AS auth_callable
FROM (SELECT p.oid, p.prorettype::regtype::text AS rettype,
             has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_x,
             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_x
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef) f;
```

| | report | verified |
|---|---|---|
| `SECURITY DEFINER` in `public` | 441 | **441** |
| anon-executable | 319 | **319** |
| trigger functions | 34 | **34** |
| directly callable by anon | 285 | **285** |
| directly callable by **authenticated** | not measured | **396** |

That last row is the largest single fact in this audit. See §5.

## 2. `void_signatures_on_edit` — CONFIRMED, and it is the priority

```
proname                 | definer | anon_can_run | auth_can_run | identity_check
void_signatures_on_edit | t       | t            | t            | NONE
```

Body, read in full from `pg_get_functiondef`:

```sql
CREATE OR REPLACE FUNCTION public.void_signatures_on_edit(p_document_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_roles text[];
BEGIN
  SELECT array_agg(DISTINCT s.party_role) INTO v_roles
    FROM signatures s
   WHERE s.document_id = p_document_id AND s.deleted_at IS NULL;

  IF v_roles IS NULL OR array_length(v_roles, 1) IS NULL THEN RETURN; END IF;

  UPDATE signatures SET deleted_at = now()
   WHERE document_id = p_document_id AND deleted_at IS NULL;

  UPDATE documents
     SET signatures_voided_at = now(),
         signatures_voided_roles = coalesce(signatures_voided_roles, '{}') || v_roles,
         status = CASE WHEN status = 'EXECUTED' THEN status ELSE 'AWAITING_SIGNATURE' END
   WHERE id = p_document_id;
END
$function$
```

**There is no identity check of any kind.** The only conditional is "does this document have
signatures" — which is a precondition, not a guard.

**It has no caller.** Verified three ways: no hit in `src/`, no hit in `api/`, and no other
function in `pg_proc` references it. Nothing in the system invokes it.

**Impact.** Any unauthenticated caller holding a document id voids every signature on that
document and flips its status to `AWAITING_SIGNATURE`. The soft-delete preserves the
evidence record — consistent with the standing rule that executed documents are never
destroyed — but the signatures stop being in force. On an `EXECUTED` document the status is
preserved and the signatures are voided anyway, which is the worst combination: a contract
that still reads as executed with nothing signing it.

Document ids appear in invite links and in party-facing URLs. This is not a hard secret.

**Recommendation: DROP it, do not guard it.** A guard preserves a function that nothing
calls. If it is wanted later it can be recreated with a check. Owner's call — see the open
question at the end.

## 3. Where the report is too kind — the contract-field surface

The report describes "a family of seven `contract_fields` mutators." The real figure:

```sql
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND pg_get_functiondef(p.oid) ~* '(INSERT INTO|UPDATE|DELETE FROM)[[:space:]]+(public\.)?contract_fields';
```

**28 functions write to `contract_fields`. 22 of them are anon-executable.**

Nine are anon-executable **and** carry no identity check at all:

- `apply_field_formats`
- `bos_generate_document`
- `contract_split_deductible_sync`
- `fill_party_fields_from_contacts`
- `recompose_document_fields`
- `regroup_contract_subjects`
- `seed_cascade_fields`
- `sync_contract_fields_from_defs`
- `sync_horse_fields_to_documents`

Four of those nine have in-database callers (`recompose_document_fields` is called by
`remerge_contract_from_clauses`, `remerge_contract_from_fields` and `set_field_structured`;
`sync_contract_fields_from_defs` by `capture_horse_record_info`). **A function with an
internal caller must be guarded, not revoked** — revoking would break the caller. The others
should be checked for callers individually before choosing.

### The report is also wrong that none check `assert_not_signature_locked`

Three do: `set_contract_field`, `set_document_co_buyer`, `remove_document_co_buyer`.

The pattern is worse than "missing" — it is **applied exactly where it is least needed**.
All three are `anon = false`. The nine that anon can reach have none of it. The lock exists;
it was simply never pushed outward to the reachable surface.

## 4. `lease_expiry_nudge` — the transitive path is real, the mechanism described is not

The report says `lease_reminder_sweep` is unguarded and anon-reachable. **`lease_reminder_sweep`
is not anon-executable.** But:

```sql
CREATE OR REPLACE FUNCTION public.lease_expiry_nudge(p_days_ahead integer DEFAULT 30)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN RETURN lease_reminder_sweep(); END; $function$
```

`lease_expiry_nudge` **is** anon-executable, has no guard, and its entire body is a call to
the function anon cannot reach directly. Because it is `SECURITY DEFINER`, the inner call
runs as the owner. **The wrapper launders the missing privilege.** The finding stands; the
count of 76 stands; the explanation in the report does not.

This is a class, not an instance. Any audit that checks direct grants only will miss every
definer wrapper of this shape.

## 5. The gap the report itself names, and I agree with

`authenticated` holds EXECUTE on **396** callable definer functions — 111 more than `anon`.

All 76 unguarded functions are in that set. Signing up is free and self-serve. And most of
the 199 that "enforce" only distinguish *nobody* from *somebody* — not one somebody from
another.

**NOGUARD1 measured the anonymous surface. The authenticated surface is larger and has never
been measured.** That is a separate audit, and on consequence it outranks the residue of
this one.

## 6. Verified as reported, no correction needed

**`is_platform_profile` is a false positive** — and not even `SECURITY DEFINER`:

```sql
CREATE OR REPLACE FUNCTION public.is_platform_profile(p_role text, p_org uuid)
 RETURNS boolean LANGUAGE sql IMMUTABLE
AS $function$ SELECT p_role = 'SUPER_ADMIN' OR p_org IS NULL $function$
```

A pure classifier of its own arguments. It returns true for anon because it returns true for
those *inputs*. Correctly excluded.

**The three `gift_*` NULL-propagating guards** — confirmed verbatim:

| function | predicate | fires for anon? |
|---|---|---|
| `gift_claim_link` | `IF NOT (has_staff_access() OR v_g.buyer_user_id = auth.uid())` | **no** |
| `gift_mark_sent` | same shape | **no** |
| `gift_reschedule` | same shape | **no** |
| `gift_transfer` | `IF NOT coalesce(has_staff_access() OR v_g.buyer_user_id = auth.uid(), false)` | yes — correct |

For an anonymous caller `auth.uid()` is NULL, so `buyer_user_id = NULL` is NULL,
`false OR NULL` is NULL, `NOT NULL` is NULL, and the `IF` body is skipped. `gift_transfer`
already carries the fix. **Three functions, one `coalesce(…, false)` each, copied from a
sibling ten lines away.**

---

## Ranked target list for NOGUARD2

Ordered by consequence, not by convenience.

1. **`void_signatures_on_edit`** — drop or guard (owner decides). Signed legal instruments.
2. **The nine unguarded anon-reachable `contract_fields` writers** — guard the four with
   internal callers; revoke or guard the rest after listing callers individually.
3. **`lease_expiry_nudge`** — and sweep for other definer wrappers of the same shape.
4. **The three `gift_*` coalesce fixes** — trivial, ship with the rest.
5. **The remaining unguarded set** from the thread's own table, working down its ranking.

Both trap grants (`PUBLIC =X/postgres` and role-held `anon=X/postgres`) are present across
this surface, so **revoke `anon`, `authenticated` and `PUBLIC` separately and re-check
`has_function_privilege()` after each.**

## Open questions for the owner

1. **Drop `void_signatures_on_edit`, or guard it?** It has no caller anywhere. Guarding
   preserves dead code; dropping is cleaner and reversible.
2. **May NOGUARD2 apply migrations to production in-thread, or stop at dry-run for review?**
   The `20260808T0300` payment-guard fix applied in-thread and was correct; this touches
   more functions.

## Provenance

`docs/reports/TASK-NOGUARD1-REPORT.md` was committed on `task/noguard1` (`d54e50a`) and left
unmerged. Merged to `main` at `9679006` so the findings are not stranded on a branch — the
same failure mode that nearly lost NULLUID's migrations.
