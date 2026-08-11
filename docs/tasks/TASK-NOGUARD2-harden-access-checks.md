# TASK NOGUARD2 — make identity checks take effect

**UNBLOCKED 2026-08-08. `NOGUARD1` has run.** Two documents produce your target list, and
you must read both:

- `docs/reports/TASK-NOGUARD1-REPORT.md` — the thread's inventory and method.
- `docs/reports/TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md` — the independent verification, which
  **corrects the report in three places**. Where they disagree, the audit is authoritative;
  it was run against production.

---

## YOUR TARGET LIST — verified against production 2026-08-08

Ordered by consequence. Do them in this order.

### 1. `void_signatures_on_edit(uuid)` — do this first

`SECURITY DEFINER`, anon **and** authenticated hold EXECUTE, **no identity check of any
kind**, and **no caller anywhere** — not in `src/`, not in `api/`, not in `pg_proc`.

Any unauthenticated caller with a document id soft-deletes every signature on that document
and resets its status. On an `EXECUTED` document the status survives and the signatures do
not, which produces a contract that reads as executed with nothing signing it.

### SETTLED 2026-08-10: DROP IT. Do not guard it, do not ask again.

The owner framed the question correctly — *"if this is used to void someone elses signature
when i edit a document they signed, i suppose that is best answered by if we want the
signature to lock the doc or not. We've gone back and forth on this topic and reversed the
decision at least twice."*

**The lock already won, and it is live.** `assert_not_signature_locked(document_id)` raises on
any document carrying a signature:

> `this document is signed by {names} and is read-only — ask them to remove their signature
> before making changes`

It is enforced by four functions: `set_contract_field`, `set_field_structured`,
`set_document_co_buyer`, `remove_document_co_buyer`.

**`void_signatures_on_edit` is the OTHER policy** — edit freely, signatures silently void. It
was never wired because the lock won. Keeping it is not keeping dead code; it is keeping a
live, unauthenticated switch into the model that lost, and one that voids signatures while
leaving `status = EXECUTED` intact — a contract that reads as executed with nothing signing it.

**Dropping is reversible.** The full body is recorded in
`docs/reports/TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md` §2 and in six migrations. If the auto-void
model is ever wanted, it gets rebuilt deliberately with a guard.

**A DROP also moots the three-grant trap below** — there is nothing left to revoke. That is
one more argument for it.

**Not blocked on anything. Do this first.**

**Two facts added by the orchestrator's own re-verification against production, 2026-08-08.**
Neither report states them and both change how you execute this item.

**a. Blast radius — the whole executed corpus.** Not a theoretical class of document:

```
documents with live signatures : 55
live signature rows            : 56
```

Every executed document in the system is in range of one anonymous call.

**b. There are THREE grants on this function, not one.** Raw `proacl`:

```
{=X/postgres, postgres=X/postgres, anon=X/postgres,
 authenticated=X/postgres, service_role=X/postgres}
```

`=X/postgres` is the **PUBLIC** grant. If you revoke `anon` only,
`has_function_privilege('anon', …)` still returns **true**, because PUBLIC still grants it —
and the revoke reports success. That is precisely trap §2 below, and this function carries
the exact grant shape that produced it in `SECFIX` S3. **Revoke `PUBLIC`, `anon` and
`authenticated` separately, and print `has_function_privilege()` for all three afterwards.**
If the ruling is DROP, this is moot — which is one more argument for dropping.

### 2. The nine anon-reachable `contract_fields` writers with no check

28 functions write to `contract_fields`; 22 are anon-executable; these nine have no identity
check at all:

`apply_field_formats` · `bos_generate_document` · `contract_split_deductible_sync` ·
`fill_party_fields_from_contacts` · `recompose_document_fields` · `regroup_contract_subjects` ·
`seed_cascade_fields` · `sync_contract_fields_from_defs` · `sync_horse_fields_to_documents`

**Four have in-database callers and must be GUARDED, not revoked** — revoking breaks the
caller:

| function | called by |
|---|---|
| `recompose_document_fields` | `remerge_contract_from_clauses`, `remerge_contract_from_fields`, `set_field_structured` |
| `sync_contract_fields_from_defs` | `capture_horse_record_info` |

**List callers for the other five individually before choosing** — the query is in the audit.

**Also add `assert_not_signature_locked`** where the function mutates a document that can be
signed. Three functions already call it — `set_contract_field`, `set_document_co_buyer`,
`remove_document_co_buyer` — and **all three are the ones anon cannot reach.** The lock
exists; it was never pushed out to the reachable surface. Reuse it, do not invent one.

### 3. `lease_expiry_nudge` — and the wrapper class it belongs to

Its entire body is `RETURN lease_reminder_sweep();`. The inner function is **not**
anon-executable; the wrapper is, has no guard, and is `SECURITY DEFINER`, so the inner call
runs as owner. **The wrapper launders the missing privilege.**

**This is a class, not an instance.** Sweep for other definer functions whose body is
substantially a call to a function the caller could not reach directly, and report the list
even for ones you do not change.

### 4. The three `gift_*` coalesce fixes — trivial, ship with the rest

`gift_claim_link`, `gift_mark_sent`, `gift_reschedule` all carry
`IF NOT (has_staff_access() OR v_g.buyer_user_id = auth.uid())`, which evaluates to NULL for
an anonymous caller and skips its own body. **`gift_transfer` already has the correct
`coalesce(…, false)` shape — copy it.** Same file, same table, ten lines away.

### 5. The remainder

Work down NOGUARD1's own ranked table. Anything you deliberately leave, list with the reason.

### NOT in scope, but say so in your report

`authenticated` holds EXECUTE on **396** callable definer functions — more than anon's 285,
and every one of the 76 unguarded functions is in that set. Signing up is free. **That is a
separate audit (NOGUARD3), not this task.** Do not expand into it; do note anything you trip
over.

---

## The repair pattern — already proven in production

Applied 2026-08-07 in `20260808T0300_payment_guards_fail_closed.sql` to three payment
functions. Follow its shape.

The problem: with no signed-in user, `auth.uid()` and `current_contact_id()` are NULL, so
identity comparisons return NULL rather than false. `false OR NULL OR NULL` is NULL,
`NOT NULL` is NULL, and an `IF` on NULL skips its body — the check never runs.

The repair:

```sql
-- before
IF NOT (has_staff_access() OR v_p.buyer_user_id = auth.uid()
        OR v_p.buyer_contact_id = current_contact_id()) THEN

-- after
IF NOT coalesce(has_staff_access() OR v_p.buyer_user_id = auth.uid()
        OR v_p.buyer_contact_id = current_contact_id(), false) THEN
```

**An undetermined result becomes a denial.** Nothing else in the body changes, and every
caller that currently works evaluates the predicate to true and is unaffected — only the
undetermined case changes, and only to denied.

For functions with **no** check at all, add one appropriate to the function's purpose. Do
not paste a staff check onto something meant to be used by ordinary members.

## Two things that will break if you are careless

### 1. `service_role` looks the same as an unidentified caller

`api/_lib/supabaseAdmin.ts` reaches the database through PostgREST with the service key, so
**`service_role` also reports `session_user = 'authenticator'`**. A check written on
`session_user` alone will lock out server-side work. Use `auth.role() = 'service_role'` where
a server path must be allowed.

**Before changing any function, list its callers.** If it is called from `api/`, it has a
server-side path that must keep working. The three payment functions repaired on 2026-08-07
had **no** `api/` callers, which is why that fix was safe — do not assume the same here.

### 2. A revoke that reports success may have done nothing

Three separate times in this repo a `REVOKE` reported success and changed nothing:

| case | why |
|---|---|
| column-level revoke against a **table-level** grant | `SECFIX` S2 |
| `FROM anon` against a **PUBLIC** (`=X/postgres`) grant | `SECFIX` S3 |
| `FROM public` against a **role-held `anon`** grant | `NULLUID` |

A later review found **both** of the last two present simultaneously on all eight functions
it touched. **After every revoke, re-check `has_function_privilege()` and put the raw output
in the report. Never trust the command's own output.**

Also: `CREATE FUNCTION` grants EXECUTE to PUBLIC by default, so a newly created function
needs an explicit `REVOKE … FROM PUBLIC, anon` or it ships publicly reachable.

## Prefer fixing the check over removing the grant

The most durable result from the previous review was that `contact_dossier` and
`inbound_open_count` were **never revoked**, yet began enforcing correctly once the
underlying predicate was repaired. **Fix the check first; adjust grants second, and only
where a function should not be reachable at all.**

## Leave these alone

- **`redeem_gift`** — self-enforcing (`IF auth.uid() IS NULL THEN RETURN 'not_authenticated'`).
  Keep its grant. Do not repeat the older, incorrect rationale about `/redeem`.
- **`open_gift`** — the gift code is the credential; this is what lets a recipient view a
  gift before having an account. Do not add an identity gate.
- The public catalog read path — the marketing site has no session.

**Where you are unsure, report rather than change.** Locking out a legitimate user is worse
than the exposure being fixed.

## Verification

For every function changed:

1. The identity check now returns **false**, not NULL, for an unidentified caller — show the
   predicate evaluation.
2. **The legitimate caller still works** — exercise it, do not reason about it. Include staff
   and ordinary-member paths as applicable, and any `api/` path.
3. Post-change `has_function_privilege()` for `anon`, `authenticated` and PUBLIC, raw.
4. Row counts unchanged across `documents`, `signatures`, `contacts`, `profiles`,
   `purchases`, `members`.
5. Re-run NOGUARD1's classification and show the **DOES NOT ENFORCE** list shrinking, with
   anything deliberately left listed and justified.

## Constraints

- Own git worktree off `origin/main`, at `~/Downloads/claude-code-repo/wt-noguard2`.
  **Never `~/Desktop`.**
- Separate migrations per logical group, each revertable alone.
- Dry-run in `BEGIN … ROLLBACK` with raw output shown, then apply.

### APPLY MODE — SETTLED 2026-08-10. Split, and the split is not negotiable.

**PHASE A — apply to production in-thread.** Only these, and only because each has no caller
and a blast radius you can state in one line:

1. `DROP FUNCTION void_signatures_on_edit(uuid)`
2. the three `gift_*` `coalesce(…, false)` fixes — copied from `gift_transfer`, which already
   carries the correct shape

**Then report Phase A before starting Phase B.**

**PHASE B — DRY-RUN ONLY. Stop for review. Do not apply.** Everything else: the nine
anon-reachable `contract_fields` writers, `lease_expiry_nudge` and the definer-wrapper sweep,
and the remaining unguarded set.

Deliver migrations unapplied, plus `BEGIN … ROLLBACK` raw output, plus
`has_function_privilege()` for `anon`, `authenticated` and PUBLIC before and after each change,
plus the caller list for every function you would revoke.

**Why B is not applied in-thread:** four of the nine `contract_fields` writers have
in-database callers. A revoke there breaks contract authoring in production rather than
breaking an attacker. That is a different risk class from Phase A and it gets a review.
- **Migrations that rewrite function bodies must assert the rewrite matched.** This repo has
  ~31 body-rewriting migrations, and a replacement that matches nothing silently no-ops and
  reports success. `20260808T0300` shows the assertion pattern.
- **Do not modify real data to demonstrate a fix.** Evaluating the predicate is sufficient.
- `ClauseDocument.tsx` is FROZEN. Sarah's document `704c8d2d-…` is a live negotiation —
  read-only, never write.

## Reporting

`docs/reports/TASK-NOGUARD2-REPORT.md`. Raw before/after per function, the caller list you
based each decision on, and an explicit statement of what you verified yourself versus
assumed.
