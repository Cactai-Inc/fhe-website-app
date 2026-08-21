# TASK-NOSTRIP — narrowing a category must never destroy required paperwork

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** It governs what legal paperwork a person is
recorded as owing. **The thing being destroyed today is evidence of an obligation.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-nostrip`, branch `task/nostrip` ·
report to `docs/reports/TASK-NOSTRIP-REPORT.md` · commit, **do not push** · no subagents ·
migrations dry-run in `BEGIN … ROLLBACK` with the rollback proven, then applied and verified ·
render claims **NOT VERIFIED**. **TEARDOWN:** process census in the report.

---

# 1. WHY — a proven, live, silent destruction

`TASK-CATEGORISE` proved this on production (rolled back):

```
trigger assigned:  6 documents, correct, derived from the cart
staff read "lessons" on the row and tick Rider  ->  ["RIDER"]
after:             4 documents.  HORSE_EMERGENCY_VET and RELEASE_HORSE_CARE DESTROYED
```

**No `audit_logs` row. No reason. No undo. No trace it ever happened.** This is D19's class applied
to **legal documents** — sharper than the credits page, because what is destroyed is the record of
what a person was obliged to sign before being on the property or handling a horse.

**CATEGORISE fixed the DERIVED path** — `request_onboarding_categories()` unions with what the
contact already holds, so a derived set can only ADD. **It did not and could not fix a human
deliberately choosing a narrower set.** That is this task.

---

# 2. WHAT WAS MEASURED (orchestrator, prod, 2026-08-21)

**The whole strip is four lines, and it has no guard of any kind:**

```sql
DELETE FROM contact_required_documents crd
 WHERE crd.contact_id = p_contact_id
   AND crd.template_key NOT IN (SELECT template_key FROM _wanted);
```

The **only** existing protection is upstream: if `_wanted` is empty, it deletes nothing (*"A
re-invite with empty categories must never strip the requirements an earlier invite established"*).
**A non-empty narrower set deletes freely** — including a requirement whose document is already
**EXECUTED**. 23 requirement rows exist in production.

## ⚠️ THE FIX IS ALREADY HALF-BUILT — CONVERGE, DO NOT INVENT

`contact_required_documents` already carries **`skipped_at` · `skipped_by` · `skip_reason`**, and a
whole mechanism reads them: `skip_required_document` · `unskip_required_document` (**an undo already
exists**) · `staff_assign_documents` · `required_templates_for_contact` ·
`contact_required_documents_state` · `contact_document_wall_state` · `my_onboarding_state` ·
`wall_onboarding_invariant_violations`.

**That is exactly the right shape: the row is RETAINED and marked, with a reason, a who, and an
undo.** CLOSEOUT built it for *"remove at provisioning AND skip afterwards."*
**A narrowing should SKIP, never DELETE.**

⚠️ **One thing to check first, because it decides whether skipping is sufficient:**
`my_wall_state` does **NOT** reference `skipped_at`, while `contact_document_wall_state` does.
**Establish which one actually gates a member's session**, and whether a skipped document correctly
stops blocking them. **If the wall ignores skips, skipping alone does not release the person and
this task must reconcile the two** — but do not "fix" the wall beyond what this requires; report it.

---

# 3. THE WORK

## §1 — never destroy an executed requirement
A requirement whose document has been **EXECUTED must never be removed by any path**, narrowing
included. It is evidence that an obligation existed and was met. **Refuse, and say so.**

## §2 — narrowing skips, it does not delete
Replace the DELETE with the existing skip mechanism. The row stays, marked with `skipped_at`,
`skipped_by` and a **`skip_reason` that is required, not optional** (D19: capture a reason).
⚠️ **Reuse `skip_required_document`. Do not write a second skipping path** (D18).
⚠️ **`unskip_required_document` already exists — that is the undo.** Make sure the narrowing path
is reversible through it, and prove the round trip.

## §3 — record it
Every narrowing writes an **`audit_logs`** row naming the contact, the templates affected, who did
it and why. **`lesson_credits` and `bookings` are already absent from `audit_logs` (W10); do not add
a third silent table.**

## §4 — say it before doing it
The staff surface states **which documents will be removed, by name**, before the action commits
(D19). ⚠️ **The mitigation CATEGORISE shipped is informational only** — it explains, it does not
gate. This replaces it.

## §5 — the derived path must stay additive
CATEGORISE's union guarantee must survive this change. **Prove it again** — a derived set still
cannot strip.

---

# 4. OUT OF SCOPE
The category taxonomy itself (settled — **D28**: the general release is for visitors and does not
stack; rider and owner releases do) · document contents · the missing editor for
`category_document_requirements` (real D13 debt, separate task) · rebuilding the wall.

# 5. THE TEST THIS MUST PASS
1. **Reproduce the CATEGORISE case**: 6 documents from a mixed cart, staff narrow to Rider →
   **all 6 rows still exist**, two marked skipped with a reason and an actor.
2. **The person is not blocked by a skipped document** — prove it through whichever wall function
   actually gates the session.
3. **`unskip_required_document` restores it**, proven as a round trip.
4. **An EXECUTED requirement cannot be removed by any path** — attempt it, show the refusal.
5. **An `audit_logs` row exists** for the narrowing, naming templates, actor and reason.
6. **A narrowing with no reason is refused.**
7. **The derived path still cannot strip** — CATEGORISE's guarantee re-proven.
8. **The 23 live requirement rows are unchanged** by the migration itself.
9. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file (46 red baseline).

# 6. THE REACH
Where staff narrow a person's categories, and where they see and undo a skip.

# 7. THE TELL
What staff see before and after, and what the client sees — **a document they no longer owe should
stop being demanded of them.**

# 8. REPORT
`docs/reports/TASK-NOSTRIP-REPORT.md`, with **flagged-not-fixed**.
