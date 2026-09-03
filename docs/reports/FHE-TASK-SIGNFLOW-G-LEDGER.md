## RESUME
Role / thread   TASK-SIGNFLOW-G · wt-1 · branch task/signflow-g
Merge-base      origin/main @ d45edb72 (spec authored against b846b227; nothing spec-relevant moved)
DONE            worktree claimed · CLNR pass (clean) · spec premises re-verified (0 hits pre-change,
                line numbers matched) · all three writers wired (commit 31e8b958) · tsc/typecheck:api/
                lint/build/test:api/normalize.test.ts all green · report written
IN FLIGHT       nothing — task complete, report at docs/reports/TASK-SIGNFLOW-G-REPORT.md
NEXT            ORCH verifies, runs the render checklist (or hands it to the owner), merges
DECIDED         ContractIntake.tsx uses the dossier's derivation IIFE (normalizeKindForField(k) per
                call site), not ProvisionClientForm's explicit-kind idiom — spec's item 2 said "same
                derivation" for it, item 3 said explicit was "fine" only for ProvisionClientForm.
                See report §5.
BLOCKED         nothing
DO NOT          n/a — no dead ends hit
