# TASK-TRIGGERSWEEP — prove every `UPDATE OF` trigger actually fires

**RUN WITH: Sonnet 5 · thinking ON · effort MEDIUM.** The trap is fully understood and written out
below; this is bounded breadth with a proven technique, not judgement. **Escalate anything
ambiguous rather than reasoning about it.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-triggersweep`, branch `task/triggersweep` ·
report to `docs/reports/TASK-TRIGGERSWEEP-REPORT.md` · commit, **do not push** · no subagents ·
**every claim is query output.** **TEARDOWN:** process census in the report.

---

# 1. WHY — the same defect three times in two days

**A trigger declared `UPDATE OF a, b` fires only when the UPDATE *statement's target list* mentions
`a` or `b`.** It does **not** fire because a `BEFORE` trigger assigned the column, and it does
**not** fire because the stored value changed.

⚠️ **The stored data always ends up correct. That is why nobody catches it** — there is no wrong
value to find, only an event that silently never happened.

| found in | the statement named | what silently never fired |
|---|---|---|
| `sign_release` (PARTYEMAIL P0) | `status` only, while a BEFORE trigger set `workflow_state` | all three execution triggers, incl. `snapshot_execution_audit` — **kiosk executions had no archived copy of what was signed** |
| `deal_autocomplete_on_execution` (FLOWMAP X4) | — | the same mechanism; CONTRACTWALK had misdiagnosed it as a "trapped branch" |
| `status_purchases` (BUYANDBOOK) | `status, payment_status`, while `report_my_payment` sets **neither** | **every status event for a declared payment**, on every order past `draft` |

**All three were found by accident, one at a time.** This task finds the rest on purpose.

---

# 2. WHAT WAS MEASURED (orchestrator, prod, 2026-08-20)

- **133** non-internal triggers. **32 of them use a column list** (`UPDATE OF …`). **Those 32 are
  the candidate set — the other 101 are out of scope**, because a trigger with no column list fires
  on every UPDATE and cannot exhibit this defect.
- Enumerate them yourself; do not trust this list to be current:
```sql
SELECT c.relname, t.tgname,
       substring(pg_get_triggerdef(t.oid) from 'UPDATE OF ([^ ]+(?:, [^ ]+)*) ON') AS watches
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal AND pg_get_triggerdef(t.oid) ILIKE '%update of%'
ORDER BY 1, 2;
```
- **Known-high-consequence members of the set**, named so they are not skimmed:
  `documents_send_executed_email_trg` (status) · `contract_execution_effects_trg` (workflow_state) ·
  `freeze_signed_template_version_trg` (status) · `documents_apply_affiliations` (status) ·
  `status_documents` · `status_bookings` · `booking_form_lifecycle` ·
  `sync_profile_name_from_contact_trg`.

---

# 3. THE METHOD — per trigger, three questions

**One grounding read, then batch-judge.** Read the trigger list once, and the set of writers once —
do not re-query per trigger.

For each of the 32:
1. **Who is supposed to fire it?** Find every statement that writes the table — DB functions
   (`pg_get_functiondef` ILIKE the table name), and `src/**` PostgREST writes (`.update(`/`.upsert(`
   on that table). **One grep pass for all of them, not one per trigger.**
2. **Does each writer's target list name a watched column?** A writer that sets only unwatched
   columns **cannot** fire it. That is the defect.
3. **Classify:** **FIRES** (at least one real writer names a watched column) · **DEAD** (no writer
   does) · **PARTIAL** (some paths fire it, others silently do not — **this is the most dangerous
   class and the one the three known instances belong to**).

⚠️ **`BEFORE` triggers that assign the watched column are a trap, not a firing.** If
`trg_documents_sync_workflow` sets `NEW.workflow_state`, that does **not** fire a
`UPDATE OF workflow_state` trigger. Check the **statement**, never the resulting row.

## Proving a firing — use the technique PARTYEMAIL proved
Inside `BEGIN … ROLLBACK`, either a probe trigger with the **identical event clause**, or
`track_functions='pl'` + `pg_stat_user_functions` call counts. **Never infer a firing from a correct
stored value.**

---

# 4. WHAT TO FIX, AND WHAT NOT TO

**Fix only the unambiguous ones: a trigger classified DEAD or PARTIAL where the missing firing is
plainly a defect, and the fix is to add the column the writer actually sets to the trigger's list.**
Prove each **both directions** in a rolled-back transaction — 0 firings before, 1 after — exactly as
PARTYEMAIL did for `sign_release`.

⚠️ **DO NOT fix any trigger where firing more often could double-act.** Widening a watch list makes
a trigger fire on paths it never did. **`documents_send_executed_email_trg` is the sharp example: a
wrong widening sends a client a duplicate executed-document email.** Anything that sends, charges,
mints, notifies or writes evidence goes in **flagged-not-fixed with the proposed diff**, and the
orchestrator specs it. **When in doubt, flag it.**

⚠️ **The sibling trap, same family:** `CREATE OR REPLACE FUNCTION` with **new defaulted parameters
OVERLOADS rather than replaces** — old call sites keep resolving to the old body, which looks exactly
like a fix that did nothing. **Drop the old signature explicitly** and prove the old one is gone.

---

# 5. OUT OF SCOPE
The 101 triggers with no column list · any UI · any new feature · `test:db` (46 red baseline, cite
nothing from it) · rewriting a trigger's *body* — this task changes **event clauses**, not logic.

# 6. THE TEST THIS MUST PASS
1. **All 32 appear in the report**, each classified FIRES / DEAD / PARTIAL with the writer list that
   justifies it.
2. **Every classification is proven by query output**, not by reading the trigger definition.
3. **Every fix shows 0 firings before and 1 after**, in a rolled-back transaction.
4. **Every deliberate non-fix is in flagged-not-fixed with its proposed diff and the reason** —
   naming what would double-act.
5. The three known instances (`sign_release`, `deal_autocomplete`, `status_purchases`) are
   **re-verified as now FIRING** — they are the calibration set. If the method says any of them is
   dead, the method is wrong.
6. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file.

# 7. REPORT
`docs/reports/TASK-TRIGGERSWEEP-REPORT.md`. Lead with **the count of DEAD and PARTIAL triggers** —
that number is the answer to *"how much else is silently not happening."*
