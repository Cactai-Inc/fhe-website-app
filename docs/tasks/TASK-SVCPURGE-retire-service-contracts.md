# TASK SVCPURGE — retire the six service contract templates (owner ruling 2026-08-05)

Owner ruling: services contracts are not in use and will not be — their language was
redrafted into the standalone categorical documents (releases/policies/authorizations).
Verified by the orchestrator: HORSE_TRAINING, HORSE_EXERCISE, HORSEMANSHIP_TRAINING,
HORSE_EVALUATION, RIDER_LESSON, RIDER_LESSON_JUMPER — all six have ZERO documents ever
generated. Full removal (git history is the archive).

## Work items
1. Read-first: for each of the six keys, list every DB artifact (contract_templates row +
   contract_section_defs/contract_clause_defs/contract_field_defs rows + anything else keyed
   by template_key — check token dictionary/sync tables and any seed/config referencing
   them). Confirm zero `documents` rows per key yourself (raw output).
2. Migration: DELETE the defs + template rows for exactly those six keys (defensive: the
   migration ASSERTS zero documents per key before deleting; aborts loudly otherwise).
   EVALUATION_LIABILITY_WAIVER is a RELEASE, not a service contract — DO NOT touch it.
3. Repo: delete `supabase/contract_templates/{RIDER_LESSON_JUMPER,HORSEMANSHIP_TRAINING,
   HORSE_TRAINING,RIDER_LESSON,HORSE_EVALUATION,HORSE_EXERCISE}.md` (and their copies under
   `Archive/` if the same six exist there — list what you removed). Grep src/ + api/ for any
   reference to the six keys (start_* helpers, catalogs, seeds) — remove dead references,
   report anything live-looking instead of removing it.
4. Live proof: post-migration, the six keys absent from contract_templates; defs count 0;
   dry-run first (BEGIN/ROLLBACK), then apply.
5. Update `docs/BUILD_TRACKER.md` (cleanup note) and note in the report that Service
   Definition documents (the replacement concept) are a SEPARATE upcoming build — this task
   only removes.

## Rules
- Branch `task/svcpurge` off `origin/main`, own worktree
  (`git worktree add ~/Downloads/claude-code-repo/wt-svcpurge -b task/svcpurge origin/main`).
  Copy this doc + `.env.db` from the shared checkout (untracked there).
- Production DB: the one migration with its zero-docs asserts + rolled-back dry-run.
  Signed/generated documents never touched (there are none for these keys — the asserts
  guarantee it).
- `ClauseDocument.tsx` FROZEN. Do not touch the other 23 templates.
- Done-checks: `npm run typecheck`, `npm run typecheck:api`, `npm run lint` (baseline 29
  warnings / 0 errors).
- Report: `docs/reports/TASK-SVCPURGE-REPORT.md`, committed + pushed. Print ONLY the report
  path.
