# TASK NOGUARD3 — `authenticated` is not an identity

**Signing up is free.** Anyone who creates an account holds the `authenticated` role, and that
role currently holds EXECUTE on **370** callable `SECURITY DEFINER` functions. The question
this task answers is not *"can a stranger reach this function"* — it is **"can one signed-in
person act on another signed-in person's data."**

## Read these first — they are the inputs, not background

- `docs/reports/TASK-NOGUARD1-REPORT.md` — the original inventory of 76 unguarded functions
- `docs/reports/TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md` — **corrects that report in three places;
  where they disagree, the audit is authoritative**
- `docs/reports/TASK-NOGUARD2-REPORT.md` — what Phase A and Phase B already closed, and two
  specific inputs it hands you (below)

```
                   NOGUARD1 baseline    after NOGUARD2
definer_total            441                441
anon_callable            285                257
auth_callable            396                370      <- YOUR SURFACE
```

**45 of NOGUARD1's original 76 remain unguarded.**

---

# THE CENTRAL DIFFERENCE FROM NOGUARD2 — READ THIS TWICE

NOGUARD2 could mostly **revoke**, because its targets were internal-by-construction: nothing
outside the database called them, and the in-database callers were postgres-owned
`SECURITY DEFINER` functions that reach them regardless of the invoker's grants.

**That will not work here.** Most of these 370 have **real browser callers**. Revoking breaks
the app for legitimate users. **A grant cannot fix these — they need predicates that tell one
signed-in somebody from another.**

Expect the ratio to invert: NOGUARD2 was mostly revokes and a few guards. **This is mostly
guards and a few revokes.**

## The repair pattern — proven twice in production

With no signed-in user, `auth.uid()` and `current_contact_id()` are NULL, so identity
comparisons return NULL rather than false. `false OR NULL OR NULL` is NULL, `NOT NULL` is
NULL, and **an `IF` on NULL skips its body — the check never runs.**

```sql
-- before
IF NOT (has_staff_access() OR v_p.buyer_user_id = auth.uid()) THEN

-- after
IF NOT coalesce(has_staff_access() OR v_p.buyer_user_id = auth.uid(), false) THEN
```

An undetermined result becomes a denial. Every caller that currently works evaluates the
predicate to true and is unaffected; **only the undetermined case changes, and only to denied.**

## The second failure shape — handed over by NOGUARD2, and it is worse

```sql
IF auth.uid() IS NOT NULL AND NOT ( … ) THEN raise …
```

**This exempts the unidentified caller by construction.** The guard reads as present, passes
review, and cannot fire for exactly the caller it should stop. NOGUARD2 found **2 instances**,
neither anon-reachable, and did not fix them because they were out of its scope.

**Sweep for this shape across all 370 and report every instance**, including ones you do not
change. A guard that cannot fire is more dangerous than no guard, because it stops anyone from
looking again.

## Also inherited

`compose_insurance_allocation` was added mid-NOGUARD2 with `anon`/PUBLIC correctly revoked and
**`authenticated` deliberately left on** — it is in your scope, not a mistake to report.

---

# METHOD

1. **Classify before you change anything.** For each of the 370: does it read or write data
   belonging to a *specific* person? If yes, does its predicate distinguish that person from
   any other signed-in user? Publish the classification — it is the deliverable even for
   functions you do not touch.
2. **Rank by consequence, not by count.** A function that exposes one row of someone's contact
   details and one that rewrites a contract are not the same finding.
3. **List callers before choosing a repair.** If it is called from `api/`, it has a server-side
   path that must keep working.
4. **Prefer fixing the check over removing the grant.** The most durable result from the
   earlier review was `contact_dossier` and `inbound_open_count` — **never revoked**, yet they
   began enforcing correctly once the predicate was repaired.

## Two things that will break if you are careless

**`service_role` looks exactly like an unidentified caller.** `api/_lib/supabaseAdmin.ts`
reaches the database through PostgREST with the service key, so `service_role` also reports
`session_user = 'authenticator'`. **A check written on `session_user` alone locks out every
server-side path.** Use `auth.role() = 'service_role'` where a server path must be allowed.

**A revoke that reports success may have done nothing.** Three separate times in this repo:
a column-level revoke against a table-level grant; `FROM anon` against a PUBLIC
(`=X/postgres`) grant; `FROM public` against a role-held `anon` grant. **After every revoke,
re-read `has_function_privilege()` and put the raw output in the report. Never trust the
command's own output.**

## Leave these alone

- **`redeem_gift`** — self-enforcing (`IF auth.uid() IS NULL THEN RETURN 'not_authenticated'`)
- **`open_gift`** — the gift code IS the credential; this is what lets a recipient view a gift
  before having an account. Do not add an identity gate.
- The public catalog read path — the marketing site has no session.

**Where you are unsure, report rather than change. Locking out a legitimate user is worse than
the exposure being fixed.**

---

# APPLY MODE — split, and the split is not negotiable

**PHASE A — apply in-thread.** Only `coalesce(…, false)` repairs on functions that **already
have a predicate**, where the fix changes nothing except turning an undetermined result into a
denial, and where you have listed the callers. Each one must be justifiable in one line.

**Report Phase A before starting Phase B.**

**PHASE B — DRY-RUN ONLY. Stop for review. Do not apply.** Everything that adds a *new* check,
changes *which* users a function admits, or removes a grant. Deliver migrations unapplied,
`BEGIN … ROLLBACK` raw output, `has_function_privilege()` for `anon` / `authenticated` /
PUBLIC before and after, and the caller list behind every decision.

**Why B is not applied in-thread:** a new predicate on a function with browser callers breaks
real users rather than attackers, and that is a different risk class from Phase A.

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-noguard3`, branch `task/noguard3`, off
  `origin/main`. **NEVER any clone under `~/Desktop`.**
- **A migration must not contain its own `COMMIT;`** — it ends your dry-run wrapper and
  applies for real while you believe you are testing. This has already happened twice, and
  **every one of NOGUARD2's seven migrations carries a self-contained `BEGIN…COMMIT`** — safe
  standalone, lethal inside an outer wrapper. Do not copy that shape without understanding it.
- **Migrations that rewrite function bodies must assert the rewrite matched.** ~31 migrations
  here read `pg_get_functiondef`, string-replace and re-execute; a replacement matching nothing
  silently no-ops and reports success. `20260808T0300` shows the assertion pattern.
- **Do not modify real data to demonstrate a fix.** Evaluating the predicate is sufficient.
- **Row counts unchanged** across `documents`, `signatures`, `contacts`, `profiles`,
  `purchases`, `members` — measured tightly around any apply. Note that **production is not
  quiescent**: other threads and the live app work against the same instance, so a count that
  moves is not automatically yours. NOGUARD2 proved this exact point and used it as evidence.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.** Sarah's `704c8d2d…` is a SAMPLE under review.
- **THE SIGNING FREEZE IS IN FORCE.**

# REPORT

`docs/reports/TASK-NOGUARD3-REPORT.md`. The full classification of all 370, raw before/after
per function changed, every instance of the `IF auth.uid() IS NOT NULL AND NOT (…)` shape, the
caller list behind each decision, and an explicit split of verified versus assumed.
