# TASK SUPERSEDE — signing one horse's document supersedes another horse's

**ARMED, not latent.** Two documents sit at `ready_to_sign` right now whose signature will
silently revoke a different horse's authorization.

Found by `HORSEDOCS`; confirmed against production by the orchestrator, 2026-08-10.

---

## The defect

`apply_document_supersession` matches on **contact + template key. There is no horse
comparison.**

```sql
WHERE d.contact_id = NEW.contact_id
  AND d.id <> NEW.id
  AND d.deleted_at IS NULL
  AND d.status = 'EXECUTED'
  AND coalesce(d.current_status, '') <> 'superseded'
  AND ct_old.template_key = ct_new.template_key
```

Any executed document of the same template for the same person is superseded — **including one
belonging to a different horse.**

## It fires on the next signature

```
HORSE_EMERGENCY_VET  e659e722  EXECUTED signed      Peep Show           CJ Z
HORSE_EMERGENCY_VET  fb6abc6c  AWAITING_SIGNATURE   Beaumont de Cactai  CJ Z

RELEASE_HORSE_CARE   aa319499  EXECUTED signed      Peep Show           CJ Z
RELEASE_HORSE_CARE   0360f829  AWAITING_SIGNATURE   Beaumont de Cactai  CJ Z
```

**Signing either Beaumont document supersedes the matching Peep Show one.** Peep Show loses its
emergency vet authorization silently, with a status event logged as though it were intended.

CJ is a test identity, but the mechanism is not test-specific — it is **the ordinary state of
any client with two horses**, and horse-bound documents are now the norm because `HORSEDOCS`
made them so.

## THE NULL SIDE IS NOT AN EDGE CASE — it is the state the last fix produced

**Do not fix this with a naive `horse_id` equality.** `HORSEDOCS` deliberately retained two
signed documents that have **no horse at all**:

```
HORSE_EMERGENCY_VET  152912dd  EXECUTED signed  (NO HORSE)  Sarah Morgan
RELEASE_HORSE_CARE   a8623897  EXECUTED signed  (NO HORSE)  Sarah Morgan
```

Their `{{HORSE.REGISTERED_NAME}}` merged blank — they authorize care for no identified horse,
which is exactly why the earlier sweep could reach them.

**Under `d.horse_id = NEW.horse_id` these are never superseded**, because `NULL = <uuid>` is
NULL. Sarah is left permanently holding two live documents per template — one naming a horse,
one naming none.

**The retention `HORSEDOCS` created and this fix must be designed together.** The NULL side is
the common case for every document predating horse-binding, not an exception bolted on after.

## What the predicate must express — ASK, DO NOT GUESS

| existing | new | supersede? |
|---|---|---|
| same horse | same horse | **yes** — plainly a replacement |
| **no horse** | a horse | **probably yes** — an untargeted authorization replaced by a targeted one. This is Sarah. |
| horse A | horse B | **no** — different obligations. This is CJ, and it is the bug. |

**Row two is the judgement.** A blank-horse authorization may be the *only* coverage a person
has, potentially across several horses — replacing it with one naming a single horse quietly
**narrows** it. **Put that to the owner before implementing.**

## Verification — prove BOTH directions

1. **The bug is closed.** Execute Beaumont's document in a rolled-back transaction; show Peep
   Show's stays `signed`, not `superseded`.
2. **Real replacement still works.** Execute a same-horse replacement; show the prior one IS
   superseded. **A predicate tightened carelessly stops supersession firing at all** — which is
   worse than the bug, because it leaves two live documents for one obligation everywhere.
3. **The NULL side behaves as ruled**, demonstrated on Sarah's two.
4. Re-query after `ROLLBACK` and show the change is absent.

## Constraints

- Own worktree off `origin/main`. **Never the canonical checkout** — a pre-commit hook refuses
  code commits there.
- **A migration must NEVER contain its own `BEGIN;`/`COMMIT;`.** The file's COMMIT ends the
  dry-run wrapper. **Two threads applied to production this way on 2026-08-10**, and both read
  past the psql warning. Grep the file first; prove the rollback by re-querying after it.
- `npm install` in the worktree before claiming a typecheck. **`npx tsc` with no `node_modules`
  fetches an unrelated package and exits 0.**
- A body-rewriting migration must **assert the rewrite matched** — a replacement matching
  nothing silently no-ops and reports success.
- **61 EXECUTED documents are evidence. Nothing here rewrites one.** This changes which
  documents are *marked* superseded going forward; it does not revisit past markings unless the
  owner asks.

## Reporting

`docs/reports/TASK-SUPERSEDE-REPORT.md`. Carry the blank-horse decision to the top with your
recommendation, and state what you verified versus assumed.
