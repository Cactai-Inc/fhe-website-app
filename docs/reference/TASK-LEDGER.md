# TASK LEDGER — every task that has shipped, one line each

**Started 2026-09-01 by ORCH6, per `CR-96`.** ⚠️ **ORCH writes a line here at every merge, and a
`## VALIDATION` block into that task's own report. An audit that lives only in a merge commit message
or a chat reply is not the record.**

**Verdict vocabulary:** `MERGED` — claims verified, taken as reported · `MERGED, CORRECTED` — merged
with a change ORCH made or reversed, named in the report · `REVERTED` · `OPEN`.

| Task | Date | What changed | Verdict | Commit |
|---|---|---|---|---|
| `TASK-FIX4` | 2026-08-31 | input is never lost; 26 hand-rolled overlays → 1; closing never commits (D34); normalisation on blur; persisted drafts | **MERGED** — counts re-measured on both branches, `normalize_person_name` verified live, 12 failing UI tests identical before and after | `a9ffcdcd` |
| `TASK-FIX5` | 2026-09-01 | one type per folder; `docs/` root is folders only; 566 migrations archived; `DB-SCHEMA.md` + `DB-MAP.md` generated | ⚠️ **MERGED, CORRECTED** — step 8 reversed: the 56 red `test/db` files are back in the run. A green suite missing 72% of its files is a worse signal than an honest red one | `4d9a9351` + the revert |
