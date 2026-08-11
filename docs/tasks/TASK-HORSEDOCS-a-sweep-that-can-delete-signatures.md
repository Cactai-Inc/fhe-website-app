# TASK HORSEDOCS — `ensure_horse_documents` can soft-delete signed documents

**Found by `SENDGUARD` while doing something else, and correctly left alone.** It refused to
widen its own task because the fix contains a supersede decision, not a one-line guard.

**Independently confirmed against production by the orchestrator, 2026-08-10.**

---

## The defect

`ensure_horse_documents` soft-deletes documents with **no status filter and no signature
check**:

```sql
UPDATE documents d
   SET deleted_at = now(), deleted_by = auth.uid()
 WHERE d.contact_id = v_owner
   AND d.template_id = (SELECT id FROM tmpl)
   AND d.deleted_at IS NULL
   AND (d.horse_id IS NULL
        OR (d.horse_id = p_horse_id AND d.merged_body LIKE '%{{HORSE.REGISTERED_NAME}}%'));
```

Nothing about `status`. Nothing about `signatures`.

## It is NOT safe by circumstance — two signed documents are in range today

```
152912dd  HORSE_EMERGENCY_VET  EXECUTED  1 live signature  horse_id NULL
a8623897  RELEASE_HORSE_CARE   EXECUTED  1 live signature  horse_id NULL
```

**This is the difference from SENDGUARD §3.** That sweep was safe only because onboarding
documents have a single signer, so signing takes them straight to `EXECUTED` and out of range.
**This one has no status filter at all**, so `EXECUTED` is no protection and the documents
above are reachable on the next call.

**The third member of a family.** `void_signatures_on_edit` (NOGUARD2 is dropping it), the
onboarding sweep (SENDGUARD §3 fixed it), and this one.

## THE DECISION THIS CONTAINS — ASK, DO NOT GUESS

Excluding signed documents from the sweep is one line. **What that one line leaves behind is
the question:** the signed document stays live, and the function then generates a new one for
the same contact and template. **Two live documents for one obligation.**

That is a supersede problem, and the codebase already has an opinion about it elsewhere — a
newer version executing marks the prior one `superseded`, retained as evidence. Three shapes:

1. **Skip and generate anyway.** Simplest. Leaves two live documents; the Documents page shows
   both and neither is marked as superseding the other.
2. **Skip and adopt.** Do not generate a replacement — treat the signed document as satisfying
   the requirement. This is what SENDGUARD §3 chose for the onboarding sweep, so it is the
   consistent answer, but it assumes the signed document is still correct for the new horse.
3. **Skip and supersede.** Generate the replacement and mark the signed one `superseded`,
   preserving it as evidence and making the relationship explicit.

**The owner decides.** Do not pick the one that is easiest to implement.

## Verification

- **Prove the two named documents survive a call** that would previously have deleted them.
  Rolled-back transaction, raw before/after.
- **Prove the working path still works** — an unsigned document for the same contact and
  template is still swept and regenerated. A guard added carelessly stops the function doing
  its job.
- **Sweep for siblings.** `ensure_horse_documents` was found by accident. Query every
  `SECURITY DEFINER` function that sets `deleted_at` on `documents` and report whether each
  checks signatures — the list was `ensure_horse_documents`, `generate_my_onboarding_documents`,
  `promote_contact_to_account`, `void_deal`, `void_signatures_on_edit`. **Two are already
  handled; report on the other two.**

## Constraints

- Own worktree off `origin/main`. **Never the canonical checkout** — a pre-commit hook refuses
  code commits there.
- Run `npm install` in the worktree before claiming a typecheck. **`npx tsc` with no
  `node_modules` fetches an unrelated package and exits 0.**
- **61 EXECUTED documents are evidence.** Nothing here rewrites one.
- Dry-run in `BEGIN … ROLLBACK` with raw output, then apply, then verify, then commit.
  **Do not push.**
- **A migration that rewrites a function body must assert the rewrite matched.** A string
  replacement matching nothing silently no-ops and reports success; ~31 migrations in this
  repo have that shape.

## Reporting

`docs/reports/TASK-HORSEDOCS-REPORT.md`. State what you verified versus assumed, and carry the
supersede decision to the top with your recommendation.
