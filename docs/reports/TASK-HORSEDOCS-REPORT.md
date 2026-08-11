# TASK HORSEDOCS — report

**Branch:** `task/horsedocs` (worktree `~/Downloads/claude-code-repo/wt-horsedocs`, off `origin/main` @ 359e363)
**Migration:** `supabase/migrations/20260810T1500_horsedocs_signed_docs_never_swept.sql` — **applied to prod**
**Date:** 2026-08-10
**Status:** DONE — applied, verified, committed. **Not pushed.**

---

## 1. THE SUPERSEDE DECISION — asked, answered, implemented

**My recommendation was: skip and supersede.** Not "skip and adopt", even though adopt is what
SENDGUARD §3 chose for the sibling sweep and would have been the consistent-looking answer.

The reason is a fact I found in the two at-risk documents' bodies and did not assume:

```
HORSE INFORMATION

Horse Name:
Microchip: {{HORSE.MICROCHIP}}
Barn Name:
...
```

**Both signed documents merged with an EMPTY Horse Name.** `{{HORSE.REGISTERED_NAME}}` was
substituted with an empty string — which is precisely why they slip past the sweep's
`merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'` test: the token is *gone*, not *filled*. Both
have `horse_id IS NULL` and zero `document_horses` rows. They are signed authorizations for
**emergency veterinary care of no identified horse**.

Adopting them would therefore have left FHE holding a horse-blank vet authorization as the live
record for Secret Tattoo. Onboarding documents have no horse dimension, so adopt is right there
and wrong here. That is the whole difference.

**Owner's answer: skip and supersede**, with one instruction attached — report, do not fix, a
latent bug the answer exposes. See §6.

**What went in:** the sweep skips signed documents and **still generates** the horse-bound
replacement. Supersession is **not** stamped by this migration. The existing
`documents_apply_supersession` trigger marks the prior EXECUTED document `superseded` when the
replacement is *executed*, which is the codebase's standing opinion (CLAUDE.md: "A newer version
executing marks the prior one superseded") and means a signed authorization is never demoted in
favour of an unsigned draft. Between generation and execution the owner sees one EXECUTED
document and one AWAITING_SIGNATURE document, distinguished by status.

---

## 2. Verified vs assumed

**Verified against production, raw output in this report:**

- The sweep has no status filter and no signature check (live `pg_get_functiondef`).
- Both named documents are EXECUTED, live, and carry one live signature each.
- Both are **reachable**: a rolled-back call returned `"voided": 2` and stamped `deleted_at` on
  both.
- The caller does **not** have to be staff — the reproduction ran as **Sarah Morgan's own
  account** (`d226273d`, `has_staff_access() = f`), against **her own horse**. `src/lib/horses.ts:231`
  exposes this RPC to any authenticated owner.
- Exactly **2** documents are at risk system-wide (§4 query) — matches the task doc.
- Both are `current_status = 'signed'`, neither already superseded.
- `apply_document_supersession` fires on execution and matches contact + template_key.
- CJ Z owns 2 horses; every contact currently has at most 1 executed live doc per template.
- The 61 EXECUTED documents and 62 live signatures are unchanged after apply.

**Assumed / not verified:**

- **No browser click-through.** Everything here is proven at the database layer. I did not drive
  the Documents page to see how the surviving signed document plus its pending replacement render
  side by side. That is the one user-visible consequence of the chosen shape and it is untested.
- I did not verify what a **staff** caller sees differently; the authorization branch was not
  exercised for `has_staff_access() = t`.
- The `{{HORSE.MICROCHIP}}`-style leftover tokens in the signed bodies are a **separate**
  pre-existing merge gap. I observed them; I did not investigate or fix them.

---

## 3. The defect, reproduced

`ensure_horse_documents` swept with no status and no signature predicate:

```sql
UPDATE documents d
   SET deleted_at = now(), deleted_by = auth.uid()
 WHERE d.contact_id = v_owner
   AND d.template_id = (SELECT id FROM tmpl)
   AND d.deleted_at IS NULL
   AND (d.horse_id IS NULL
        OR (d.horse_id = p_horse_id AND d.merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'));
```

Rolled-back reproduction, as Sarah Morgan, against her own horse Secret Tattoo:

```
uid                                  | contact                              | staff
d226273d-b3a6-4fff-95aa-393160976c70 | b996dd2c-ad05-41d7-a5eb-3a5807ff0eb6 | f

--- CALL ensure_horse_documents(Secret Tattoo, NULL, include_care=true) ---
{"voided": 2, "generated": [...], "owner_contact_id": "b996dd2c-..."}

--- AFTER (inside txn) ---
id        | template_key        | status   | deleted_at                    | deleted_by
152912dd  | HORSE_EMERGENCY_VET | EXECUTED | 2026-08-11 02:57:44.268612+00 | d226273d-...
a8623897  | RELEASE_HORSE_CARE  | EXECUTED | 2026-08-11 02:57:44.268612+00 | d226273d-...

--- AFTER ROLLBACK (fresh txn, proves rollback) ---
152912dd  | HORSE_EMERGENCY_VET | EXECUTED | (null)
a8623897  | RELEASE_HORSE_CARE  | EXECUTED | (null)
```

Note the reachability detail: with `p_include_care` left at its default, only
`HORSE_EMERGENCY_VET` is swept, because `owner_has_executed_template` requires
`horse_id IS NOT NULL` and Sarah's care release has none. Both templates come into range when
`p_include_care => true`, **which is what every DB-trigger caller passes** — lease execution,
sale execution, and the review-workflow lock all call
`ensure_horse_documents(v_horse, NEW.contract_id, true)`.

---

## 4. Scope: exactly two documents at risk

```sql
SELECT d.id, t.template_key, d.status, d.current_status, c.first_name||' '||c.last_name, h.registered_name
  FROM documents d
  JOIN contract_templates t ON t.id=d.template_id
  JOIN contacts c ON c.id=d.contact_id
  JOIN horses h ON h.deleted_at IS NULL AND h.current_owner_contact_id=d.contact_id
 WHERE t.template_key IN ('HORSE_EMERGENCY_VET','RELEASE_HORSE_CARE')
   AND d.deleted_at IS NULL
   AND EXISTS (SELECT 1 FROM signatures s WHERE s.document_id=d.id AND s.deleted_at IS NULL)
   AND (d.horse_id IS NULL OR (d.horse_id=h.id AND d.merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'));
```
```
152912dd | HORSE_EMERGENCY_VET | EXECUTED | signed | Sarah Morgan | Secret Tattoo
a8623897 | RELEASE_HORSE_CARE  | EXECUTED | signed | Sarah Morgan | Secret Tattoo
```

---

## 5. The fix and its proofs

Two predicates added to the sweep UPDATE, **deliberately the same shape** as the guard SENDGUARD
put live in `generate_my_onboarding_documents`:

```sql
       AND d.status <> 'EXECUTED'
       AND NOT EXISTS (SELECT 1 FROM signatures s
                        WHERE s.document_id = d.id AND s.deleted_at IS NULL)
```

Nothing else in the body changed. The migration is a full `CREATE OR REPLACE` (the convention
for this function — see `20260714335000`, `20260714390000`, `20260714400000`), so it is
replay-safe rather than a string-rewrite, and it ends in a `DO` block that **raises** unless the
live definition contains both guards *and* still contains the horse-scoped predicate and the
generation path. A no-op cannot report success.

The migration file contains **no `BEGIN;` / `COMMIT;` / `ROLLBACK;` of its own** — verified by
grep before the dry run, so the dry-run wrapper could not be terminated early.

### Proof 1 — the two named documents survive a call that previously deleted them

```
call_1: {"voided": 0, "generated": [HORSE_EMERGENCY_VET 75d1147a, RELEASE_HORSE_CARE 36f617b5], ...}

id       | template_key        | status   | deleted_at | current_status
152912dd | HORSE_EMERGENCY_VET | EXECUTED | (null)     | signed
a8623897 | RELEASE_HORSE_CARE  | EXECUTED | (null)     | signed
```

`voided` fell from **2 to 0**, and the horse-bound replacements were still generated — the
decided behaviour, not adopt.

### Proof 2 — idempotent, no duplicate pile-up

```
call_2: {"voided": 0, "generated": [], "owner_contact_id": "b996dd2c-..."}

template_key        | live_docs_for_owner
HORSE_EMERGENCY_VET | 2
RELEASE_HORSE_CARE  | 2
```

Two per template: the retained signed one, and the horse-bound replacement. A third call adds
nothing — the existing `CONTINUE` branch catches the now-correctly-merged replacement.

### Proof 3 — the working path still works

An **unsigned** document for the same contact and template (`horse_id NULL`,
`AWAITING_SIGNATURE`, 0 signatures) was created in the transaction, then the function was called:

```
call_with_stray: {"voided": 1, "generated": [HORSE_EMERGENCY_VET 9e96381b, RELEASE_HORSE_CARE ba88e57c], ...}

which           | id       | status             | swept
unsigned stray  | 01062c2a | AWAITING_SIGNATURE | t
signed 152912dd | 152912dd | EXECUTED           | f
signed a8623897 | a8623897 | EXECUTED           | f
```

The guard discriminates on signature, not on template: unsigned strays are still swept and
regenerated. The guard did not stop the function doing its job.

### Proof the dry run rolled back

Re-queried **after** `ROLLBACK`, in a fresh transaction, both times:

```
guard_live_in_prod    | f          <- the migration had NOT applied
sarah_live_horse_docs | 2          <- no generated documents leaked
152912dd / a8623897   | deleted_at (null)
```

### Post-apply verification

```
executed_guard | signature_guard | generation_intact | horse_predicate_intact
t              | t               | t                 | t

live call (rolled back): {"voided": 0, ...}   152912dd swept=f   a8623897 swept=f

executed_live   | 61
live_signatures | 62
```

61 EXECUTED documents and 62 live signatures — nothing rewritten.

### Build health

`npm install` run in this worktree first (`node_modules/.bin/tsc` 5.6.3 — not a fetched
stranger). `npm run typecheck` **0 errors**, `npm run typecheck:api` **0 errors**,
`npm run lint` **0 errors / 30 warnings**. The diff contains no TypeScript, so the warnings are
inherited from `main`, not introduced here.

---

## 6. REPORTED, NOT FIXED — `apply_document_supersession` ignores `horse_id`

**Raised by the owner when approving the decision; confirmed against the live trigger. Not
widened into this task. It needs its own spec.**

```sql
FOR r IN
  SELECT d.id FROM documents d
  JOIN contract_templates ct_old ON ct_old.id = d.template_id
  JOIN contract_templates ct_new ON ct_new.id = NEW.template_id
 WHERE d.contact_id = NEW.contact_id
   AND d.id <> NEW.id
   AND d.deleted_at IS NULL
   AND d.status = 'EXECUTED'
   AND coalesce(d.current_status, '') <> 'superseded'
   AND ct_old.template_key = ct_new.template_key
LOOP
  UPDATE documents SET current_status = 'superseded' WHERE id = r.id;
```

The predicate is **contact_id + template_key with no `horse_id` comparison**. That is harmless
while horse documents are not horse-bound. It stops being harmless the moment they are — which
is the state this fix now produces. Executing a vet authorization for one horse will mark the
executed vet authorization for a **different horse owned by the same contact** `superseded`.

Evidence that it is reachable and not yet fired:

```
contact                              | who            | horses_owned | names
d99f1472-48b4-466e-aaa7-f76396745c17 | CJ Z           |            2 | Peep Show, Beaumont de Cactai
8c413fd4-e30b-4ceb-96ef-96afca5dccdb | Claire Bourdon |            1 | TIZ love
b996dd2c-ad05-41d7-a5eb-3a5807ff0eb6 | Sarah Morgan   |            1 | Secret Tattoo

who            | template_key        | executed_live
CJ Z           | HORSE_EMERGENCY_VET | 1
CJ Z           | RELEASE_HORSE_CARE  | 1
Claire Bourdon | HORSE_EMERGENCY_VET | 1
Claire Bourdon | RELEASE_HORSE_CARE  | 1
Sarah Morgan   | HORSE_EMERGENCY_VET | 1
Sarah Morgan   | RELEASE_HORSE_CARE  | 1
```

Every contact holds at most **one** executed live document per template today, so no
cross-horse supersession has occurred. CJ Z's second horse-bound execution is the trigger.

**The spec this needs to decide:** the fix is a `horse_id` comparison, but that comparison has to
answer the NULL case — what happens when one side has `horse_id IS NULL`, which is exactly the
state Sarah's two retained documents are in. Does a horse-bound execution supersede a horse-blank
prior for the same contact (arguably yes — the blank one is the thing being replaced), and does a
horse-blank execution supersede horse-bound priors (almost certainly no)? `IS NOT DISTINCT FROM`
would answer neither correctly on its own.

Note the interaction with this fix: with `horse_id` added naively, Sarah's retained horse-blank
documents would **never** be superseded by the horse-bound replacements, and she would hold two
live documents per template indefinitely. That is the case to design for.

---

## 7. Sibling sweep — every SECURITY DEFINER function that soft-deletes documents

Query used (broadened past the task's list — it finds any `SECURITY DEFINER` function that
assigns `deleted_at` anywhere in a body that names `documents`):

```sql
SELECT p.proname, p.prosecdef,
       (pg_get_functiondef(p.oid) ~* 'UPDATE[^;]*\mdocuments\M[^;]*SET[^;]*deleted_at') AS updates_documents_deleted_at
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f'
   AND pg_get_functiondef(p.oid) ~* 'deleted_at\s*=' AND pg_get_functiondef(p.oid) ~* '\mdocuments\M';
```

| function | soft-deletes documents? | signature-aware? | verdict |
|---|---|---|---|
| `ensure_horse_documents` | yes | **now yes** | **FIXED HERE** |
| `generate_my_onboarding_documents` | yes | yes | already fixed (SENDGUARD §3) — confirmed live |
| `promote_contact_to_account` | **no** | n/a | **SAFE** |
| `void_deal` | **no** | n/a | **SAFE** |
| `void_signatures_on_edit` | — | — | **GONE** — 0 rows in `pg_proc` (NOGUARD2 dropped it) |

The two the task asked me to report on:

**`promote_contact_to_account` — SAFE.** It sets `deleted_at` only on `clients` and on the
dissolved `contacts` row. It never touches `documents.deleted_at` or `signatures.deleted_at` — it
**re-anchors** them to the survivor (`UPDATE documents SET contact_id = v_survivor …`,
`UPDATE signatures SET signer_contact_id = v_survivor …`). Its only hard delete is
`DELETE FROM contact_required_documents WHERE contact_id = v_dissolved`, which runs *after* those
rows are re-pointed at the survivor, and which is an assignment table, not evidence.

**`void_deal` — SAFE, and explicitly so.** It voids the `deals` row and sets the `contracts` row
to `void`. It never touches `documents` at all, and it says why in a comment already in the body:
`-- executed documents are never swept; void the deal around them`.

**Confirmed live, not assumed:** `generate_my_onboarding_documents` carries
`d.status <> 'EXECUTED' AND NOT EXISTS (SELECT 1 FROM signatures s WHERE s.document_id = d.id AND s.deleted_at IS NULL)`.
It resolves the leftover by **adopting** the signed document as `v_doc` and generating nothing —
the shape deliberately *not* used here, for the horse-blank reason in §1.

---

## 8. Follow-ups (not done, not in scope)

1. **`apply_document_supersession` horse_id + NULL semantics** — §6. Needs an owner spec.
2. **Browser click-through** of the Documents page with one retained signed document plus one
   pending replacement for the same template. Untested; it is the visible face of this decision.
3. **Leftover merge tokens** in the two retained bodies (`{{HORSE.MICROCHIP}}`,
   `{{HORSE.FARRIER_NAME}}`, `{{CLIENT.EMERGENCY_CONTACT_2_NAME}}`, …) — a separate merge gap,
   observed only. Those two documents are executed evidence and must not be rewritten to fix it.
