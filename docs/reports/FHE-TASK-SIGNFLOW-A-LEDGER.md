# FHE-TASK-SIGNFLOW-A — RUNNING RECORD

**Opened 2026-09-02.** Spec: `docs/tasks/TASK-SIGNFLOW-A-an-unsigned-document-shows-no-signature-machinery.md`
Change order: `CR-101`. Worktree: `wt-3` (assigned, `docs/orch/BOARD.md:57`). Branch: `task/signflow-a` from `origin/main` `0ae5855f`.

## RESUME BLOCK
- **Where I am:** worktree claimed, ledger opened. Next: CLNR pass (§3 of CLNR-ROLE), then read spec back, then verify premises.
- **Nothing edited yet.**

## LOG
- Claimed `wt-3`: guard passed (detached HEAD, clean), `git checkout -b task/signflow-a origin/main`, `git clean -xdf` removed `dist/` + `dist-ssr/`.
- ⚠️ PREMISE ALREADY KNOWN STALE: spec §5 says "TASK-SIGNFLOW-D merges after you". **D merged BEFORE me** (`e2f3dabf`, in `origin/main`). Readers 3 and 4 may already be gone. To re-measure.

## CLNR PASS — 2026-09-02
Census: `docs/` root loose files **0**; four role files present in `docs/method/` (`ORCHESTRATOR.md`,
`DISCO-ROLE.md`, `TASK-ROLE.md`, `CLNR-ROLE.md`) → §2b resumability **PASS** for all four; SIGNFLOW
lineage clean (A/B/C/D live in `docs/tasks/`, superseded C/D/E/F archived with `-SUPERSEDED-` suffix,
no two files claiming the same live version); worktree pool `wt-1`/`wt-2`/`wt-3` all detached+clean at
`0ae5855f`, none merged-and-stranded; no new folder under `docs/`; process census empty.
**Result: CLNR clean.** Drift reported not fixed (pre-existing, one line each in the report).

## SPEC PREMISES RE-MEASURED — 3 CORRECTIONS
1. 🔴 **Readers 3 and 4 NO LONGER EXIST.** `src/pages/DocsParticipantFlow.tsx` and `src/pages/Release.tsx`
   are both deleted — `TASK-SIGNFLOW-D` merged at `e2f3dabf`, i.e. BEFORE me, not after as §5 states.
   The reader list is **three**, not five. No conflict risk with D remains.
2. 🟡 **Onboarding reader is at `:2006`**, not `:1994` (spec) and not `:1963` (DISCO). Spec predicted this.
3. 🟡 **T5's grep is wrong.** `UNSIGNED_SIG_DATE` is a named const ONLY in `ContractCascade.tsx`; both
   `documentPdf.ts` twins use inline regex literals. `grep -rn UNSIGNED_SIG_DATE src api` returns
   2 hits in src, **0 in api**. Correct test = one DEFINITION of `resolveUnsignedSignatureTokens` per project.

## RESOLVED: ClauseDocument is NOT a fourth reader
Zero migrations touch both `contract_clauses` and `{{SIG.` — clause bodies never carry a SIG token.
`ClauseDocument`/`ClauseProse` render clause source, never `merged_body`. Not in scope, not a gap.

## RESUME BLOCK (updated)
- Next: build §3 steps 1–5. `api/_lib/documentPdf.ts` untouched (§3.6).
