# FHE-DSNR-SIGNFLOW-F — HANDOFF TO ORCH

**From `FHE-TASK-SIGNFLOW-F` (DSNR profile), 2026-09-02, wt-3, branch `task/signflow-f-specs` off `main` @ `b846b227`.**
**Charge:** `TASK-SIGNFLOW-B-VERIFICATION.md` §"three remaining writers" + `CHANGE-ORDER-LEDGER.md` §CR-101·A1.
**Ledger:** `docs/reports/FHE-TASK-SIGNFLOW-F-LEDGER.md`. **Nothing built; nothing written to production.**

## 1. THE CHUNKS, IN DEPENDENCY ORDER
| # | Spec | Owns | Must merge before it | Why one chunk |
|---|---|---|---|---|
| G | `docs/tasks/TASK-SIGNFLOW-G-the-last-three-contact-writers-normalize-on-blur.md` | `ProvisionClientForm.tsx` · `ContractIntake.tsx` · `ContractPage.tsx` (client only; zero `src/lib` edits) | nothing — B and C are merged | three doors, one contact record, one idiom; splitting would be three half-days for one grep |
| H | `docs/tasks/TASK-SIGNFLOW-H-no-period-after-a-signature-line.md` | one migration (in-place rewrite of `remerge_contract_from_clauses`) + one assertion in `test/db/sale_golden_render.test.ts` | nothing | one condition in one function; the display side already does the right thing once the period is gone |

**G and H are independent** — different files, different layers, no shared state. They can run concurrently
in two worktrees. Neither depends on RANCHWORD, TACKROOM or SITESEO.

## 2. CONTENTION I CAN SEE
- **`ContractPage.tsx`** (G) — `RANCHWORD`'s build will sweep `barn` → `ranch` app-wide (D43); the file has
  3 hits. Whichever runs second re-greps. G's spec forbids cosmetic/text edits so the overlap is line-level
  only.
- **H touches production.** The signing freeze and the live lease are named in its T1/T2. It writes no
  document; the lease recomposes on its next open — **ORCH or the owner does that open at verification**,
  not the thread.
- **`test/db/fixtures/schema_snapshot.sql`** — H's new assertion stays red until the snapshot is regenerated
  from production. That regeneration is deliberately NOT in H (a 44k-line shared fixture; TESTREPAIR's act).
  **Queue it, or fold it into CLNR-REPO-STATE.**

## 3. MODEL AND EFFORT — a recommendation
| Chunk | Tier | Effort | Thinking | Why |
|---|---|---|---|---|
| G | Sonnet | MEDIUM | on | pure wiring in a locked idiom; the judgement was made in the spec; the risk is line-number drift, which the spec tells it to re-grep |
| H | Opus | HIGH | on | a production migration under the signing freeze, an anchor-replace on a 276-line function, a rolled-back dry-run to reason about; small diff, high cost of a slip |

## 4. ASK-OWNER — none blocking.
Nothing in either spec needs the owner before build. One thing for him to KNOW at H's verification: the
live lease's four signature-block lines will change on its next open (`Signature:` bare, `Date:` bare) —
that is the fix landing by the normal path, not a stray write.

## 5. WHAT I DECIDED THAT THE CHARGE DID NOT
1. **Naming: the build threads are G and H, not "F".** ORCH's verification called the follow-up
   `FHE-TASK-SIGNFLOW-F` and then launched THIS authoring thread under that name. Two threads on one
   letter would collide on `FHE-TASK-SIGNFLOW-F-LEDGER.md`/`-REPORT.md`. DSNR-ROLE: letters continue after
   the last that ran.
2. **G wires every contact field on the three surfaces, not only the address ones.** Measured: none of the
   three files imports the normalizer at all — name, phone and email are raw too. D39: the outcome is one
   consistently-shaped contact record. Stated in G §3b; the build reports it under its own heading.
3. **G leaves the vet-premises fields (`ContractIntake.tsx:238-246`, `HorseIntakeForm.tsx`) unwired**, by
   design: they write the HORSE record and `normalizeKindForField` returns `null` for `vet_*` keys. Widening
   the derivation is a separate decision; G forbids it. **Queue it as a question if the owner wants
   vet addresses shaped too** — it is a five-key change in `normalize.ts` plus two files.
4. **H exempts the whole signature block (`SIG.*.NAME` AND `SIG.*.DATE`)**, not just the `Signature:`
   line. The owner said "a line that has a signature in it"; `v_has_sig` is the composer's own flag for
   exactly that block, and a `Date: … 2026.` beside a bare `Signature:` would be half the fix.
5. **H uses the in-place rewrite idiom** (10 precedents on this function) rather than a full
   `CREATE OR REPLACE` — the last full definition in the repo is stale by 10 rewrites and would roll
   them back; pasting today's 276-line prod body would bury a one-clause diff.
6. **H does not backfill.** ORCH's constraint ("the normal remerge path only") is honoured literally:
   the migration touches no `merged_body`; the lease recomposes on open (`ContractPage.tsx:485`).

## 6. WHERE THE INPUTS WERE WRONG (D20 — measured against production and `main` today)
- **SIGNFLOW-A §5 "on all three unsigned documents the line ends in a period":** false for 2 of 3. The two
  DRAFTs are FLAT templates (`contract_id IS NULL`, no clause defs) whose lines read
  `Signature: {{SIG.CLIENT.NAME}}` with no period. **Exactly one document has the defect: the lease.**
  ORCH's verification carried the "3 unsigned bodies" count forward; H §2 corrects it.
- **SIGNFLOW-A §5 "`remerge_contract_from_clauses` lines 171-174":** the production definition puts the
  period site at `:176-178` (colon guard `:179`). Same code, different numbering.
- **ORCH's "0 of 81 executed affected — anyway":** true, and for a stronger reason than stated — all 81
  executed documents are non-engine (`contract_id IS NULL`), so the composer cannot reach them through
  regeneration at all. There is exactly ONE contract-engine document in production.
- **The B verification's three line numbers** (`:558`, `:193`, `:1973`) — `:558` holds; ContractIntake's
  address fieldset opens at `:191` with the first input at `:194`; ContractPage's grid array is `:1977`.
  Both specs carry today's numbers and tell the thread to re-grep.

## 7. SHAPES THAT NEED THE OWNER'S EYES BEFORE BUILD
None. No new page, state or layout. G changes what a box shows after blur (already the app's behaviour on
five other doors); H removes one character from four lines.

## 8. OBSERVED, NOT ACTED ON
- `contract_execution_audit` holds **61** rows against **81** executed documents. Not in either charge;
  the 0940 header says Phase 0 made kiosk executions snapshot too, so the gap predates it or is releases.
  **A fact for RECONCILE, not a finding.**
- `docs/reports/FHE-TASK-TACKROOM-LEDGER.md` is untracked in the canonical checkout (another thread's
  open ledger; D40 — not mine to stage).

## 9. TEARDOWN
No server, browser, or scratch worktree started. `wt-3` holds `task/signflow-f-specs` until ORCH merges.
Production access: `psql … -c "select …"` reads only; no transaction opened.
