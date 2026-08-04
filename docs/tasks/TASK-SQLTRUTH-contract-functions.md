# TASK SQLTRUTH — recapture the live contract SQL functions into version control

Context: an audit (2026-08-04) proved the LIVE production bodies of the contract-engine SQL
functions have drifted from the committed migration files — the live
`remerge_contract_from_clauses` is ~276 logic lines vs ~226 in the last committed migration
(`20260804110000_numbering_derives_from_headings.sql`), with whole live features (execution-time
blank-CUSTOM→"N/A", author header/line UNION ordering via ord1/ord2, element option-label merge,
CUSTOM.% terminal punctuation) absent from git history. The repo currently lies about what runs
in prod. This task makes git truthful again. It changes NO behavior.

## Work items

1. From the live DB (`psql "$(cat .env.db)"`, project lrstswfxfsezdmvkvukc), dump
   `pg_get_functiondef(oid)` for each of:
   - `remerge_contract_from_clauses`
   - `clause_condition_met`
   - `clause_cut_kept`
   - `contract_template_structure`
   If any name is overloaded, dump every overload and note it.
2. Write ONE migration `supabase/migrations/<timestamp>_sql_truth_recapture.sql` containing the
   live bodies verbatim as `CREATE OR REPLACE FUNCTION` statements, headed by a comment block:
   "SQL TRUTH RECAPTURE <date>: these bodies are copied byte-for-byte from live prod, which had
   drifted from committed migrations. Behavior-neutral by construction. See
   docs/reports/TASK-SQLTRUTH-REPORT.md for the drift diff."
   Verbatim means verbatim — no reformatting, no cleanup, no improvements, even where the code
   is ugly. Behavior-neutrality is the entire point.
3. Apply the migration live. It must be a no-op. Prove it: capture
   `md5(pg_get_functiondef(oid))` for each function BEFORE and AFTER applying — the hashes must
   be identical. Raw output of both captures in the report.
4. In the report, include a unified diff of each function: last-committed-migration version vs
   live version, so the drift is permanently documented (this diff is the input to the renderer
   rebuild's spec).
5. Drift scan for neighbors (report-only, no recapture unless drifted): run the same
   live-vs-repo comparison for `record_signature`, `send_executed_document_email`,
   `resend_executed_document_email`, `apply_category_documents`, `add_contract_element`,
   `remove_contract_composition`, `set_contract_field`. For each: MATCHES or DRIFTED with a
   one-line description. If any of those are DRIFTED, add them to the same recapture migration
   the same verbatim way, and note it.

## Rules
- Branch `task/sqltruth` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-sqltruth -b task/sqltruth origin/main`).
  Copy this doc + `.env.db` from the shared checkout (both untracked there).
- ZERO behavior changes. The only live DB write is applying the recapture migration, which the
  md5 proof must show changed nothing. If a hash differs after apply, that is a FAILURE — revert
  by re-applying the pre-capture body, diagnose, log per the retry rule.
- `src/components/app/ClauseDocument.tsx` is FROZEN; you touch no TSX at all in this task.
- Done-checks: the md5 before/after proof; `npm run typecheck` + `lint` still clean (nothing
  should have changed, run them anyway).
- Report: `docs/reports/TASK-SQLTRUTH-REPORT.md` committed + pushed on the branch, containing
  the raw dumps' hashes, the drift diffs, and the neighbor scan table. Print ONLY the report
  path in chat.
- Honesty rule: nothing described as done that was not observed.
