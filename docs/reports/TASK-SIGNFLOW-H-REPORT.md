# TASK-SIGNFLOW-H — REPORT: no period after a signature line

**Thread `FHE-TASK-SIGNFLOW-H` · 2026-09-03 · wt-2 · branch `task/signflow-h` from `main` @ d45edb72.**
**Spec:** `docs/tasks/TASK-SIGNFLOW-H-no-period-after-a-signature-line.md` (CR-101·A1).

## HEADLINE
1. **Applied to production:** `remerge_contract_from_clauses` R5 period site now reads `IF NOT v_has_sig AND …`. One clause, in-place rewrite, `CREATE OR REPLACE` via the function's own idiom. No `DROP`; `proacl` unchanged.
2. **No document row was written.** The live lease `7adcd08f` body is byte-identical before and after (`md5 4483958d866c6c4837b8c0643b922d45`) and still carries its 4 `}}.` lines until its next normal open.
3. **Dry-run proved the outcome:** in a rolled-back transaction the recomposed lease has all 4 signature-block lines ending at the token, and ordinary token lines still end in `.`.
4. **Test assertion added and RED-UNTIL-SNAPSHOT** (T5): 4 fixtures fail ONLY on the new assertion. All other gates green.

**Deviations from the spec, stated:** (a) filename is `20260903T0416_…` not `20260902T<HHMM>_…` — the spec was written on 09-02 and the convention is the day of writing; nothing else about the shape differs. (b) I added a second guard to the idiom: `RAISE EXCEPTION` if the anchor matches more than once (T3 says "exactly once"; the 2026-08-04 idiom only checked "at least once"). The pre-apply count was 1.

## §8 — THE TEST THIS MUST PASS

### 1. Before (re-run 2026-09-03, `SELECT` only)
```
       status       | sig_period | count
--------------------+------------+-------
 AWAITING_SIGNATURE |          1 |     1
 DRAFT              |          0 |     2
 EXECUTED           |          0 |    81

 executed | no_contract
----------+-------------
       81 |          81

 id                                   | status             | workflow_state | md5
 7adcd08f-fd5d-40f9-b726-634074266d7c | AWAITING_SIGNATURE | in_review      | 4483958d866c6c4837b8c0643b922d45
```
`proacl` before: `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`.
Prod composer read with `pg_get_functiondef`, `cat -n`: `v_has_sig` at `:128-134`, period site `:176-178`, colon guard `:179`, authored site `:113-115` — identical to §2 of the spec. Anchor (R5 comment block + the `IF` at `:176`) counted in prod before apply: **1**.

### 2. Dry-run, rolled back (`BEGIN; <migration>; SELECT remerge_contract_from_clauses('7adcd08f…'); …; ROLLBACK;`)
```
BEGIN
DO
---- signature/date lines in the FRESH composition
 Signature: {{SIG.LESSEE.NAME}}
 Date: {{SIG.LESSEE.DATE}}
 Signature: {{SIG.LESSOR.NAME}}
 Date: {{SIG.LESSOR.DATE}}
(4 rows)
---- ordinary token lines in the same fresh composition still end in "." (R5 survives) — from the returned body:
 The Lessor notes the following known exceptions to the physical condition of the Horse: Arthritis.
 Reserved days of use: Lessor: Mon, Wed, Thu, Fri, Sun; Lessee: Tue, Sat.
 Lessor will provide the following equipment for the Horse: Bell boots.
---- new guard present in txn / :113 authored site untouched
 new_guard | authored_site
         1 |             1
ROLLBACK
---- AFTER ROLLBACK: stored body still carries the 4 "}}." lines, md5 unchanged, guard absent from prod
 Signature: {{SIG.LESSEE.NAME}}.
 Date: {{SIG.LESSEE.DATE}}.
 Signature: {{SIG.LESSOR.NAME}}.
 Date: {{SIG.LESSOR.DATE}}.
 4483958d866c6c4837b8c0643b922d45
 new_guard_in_prod_after_rollback: 0
```
(My "ordinary line" probe pattern `^Lessee: |^Lessor: |^Horse: ` returned 0 rows because those labels are not line-initial in this template; the three lines above are quoted from the returned body in the same dry-run, and each ends in `.`.)

### 3. Apply + verify the function
`psql -v ON_ERROR_STOP=1 -f supabase/migrations/20260903T0416_no_period_after_a_signature_line.sql` → `DO`.
```
 113 |             IF v_cl.clause_key LIKE 'CUSTOM.%' AND btrim(v_line) <> ''
 114 |                AND btrim(v_line) !~ '[.!?:;)"'']$' THEN                      ← untouched
 165-175 | (R5 comment + "Only punctuate" comment, verbatim as before)
 176 |           /* CR-101·A1 (owner, 2026-09-02): "we dont need a (.) at the end of a
 177 |              line that has a signature in it." A signature-block line keeps its
 178 |              SIG.* token here (skipped above) and resolves it at signing time
 179 |              (record_signature) or display time (documentBody.ts), where this
 180 |              guard cannot see the result — so the "." it would add became
 181 |              "Signature: ." unsigned and "Name." signed. v_has_sig, computed
 182 |              above for this very line, is the flag: the whole block (NAME and
 183 |              DATE lines) is exempt. Every other token line keeps its period. */
 184 |           IF NOT v_has_sig AND btrim(v_line) <> '' AND btrim(v_line) !~ '[.!?:;)"'']$' THEN
 185 |             v_line := v_line || '.';
 186 |           END IF;
 187 |           v_line := regexp_replace(v_line, ':\s*\.\s*$', ':');              ← colon guard untouched
```
`proacl` after: `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — unchanged, no `anon`.
Idempotency: re-running the migration file → `DO`, guard count still 1.

### 4. After apply, before anyone opens the lease
```
 md5                              | status
 4483958d866c6c4837b8c0643b922d45 | AWAITING_SIGNATURE     ← identical to §8.1
 Signature: {{SIG.LESSEE.NAME}}.   Date: {{SIG.LESSEE.DATE}}.   Signature: {{SIG.LESSOR.NAME}}.   Date: {{SIG.LESSOR.DATE}}.
```
The migration wrote no document. **The lease has not been opened by this thread.**

### 5. `test/db/sale_golden_render.test.ts` — RED-UNTIL-SNAPSHOT (T5)
Added `expectNoPeriodAfterSignatureLines(body)` and called it in all 4 composed fixtures (A, B, unset-gates, BOS).
`npx vitest run test/db/sale_golden_render.test.ts`:
```
 × fixture A (co-buyer YES, JTWROS) composes every elected branch
 × fixture B (co-buyer NO) omits the co-buyer branch entirely
 × unset gates render pending placeholders (blocks-signing surface)
 × paid in full + co-buyer YES + agent/notary NOT_INCLUDED
AssertionError: signature line ends with a period: "Signature: {{SIG.BUYER.NAME}}.": expected … not to match /\.$/
AssertionError: signature line ends with a period: "Signature: {{SIG.SELLER.NAME}}.": …
 Test Files  1 failed (1) · Tests  4 failed (4)
```
Each failure is at the new assertion (line 103) — every pre-existing assertion in each test passed first, and setup (PGlite + snapshot load + fixture insert) succeeded. The snapshot (`fixtures/schema_snapshot.sql`, dumped 2026-08-21) carries the old composer; it was **not** regenerated here (TASK-TESTREPAIR owns that). Once regenerated from production this assertion goes green with no further change.

### 6. Gates
| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors, exit 0 |
| `npm run typecheck:api` | exit 0 |
| `npm run build` | clean, exit 0 |
| `npm run test:api` | 7/7 passed |
| `git diff --stat` (vs main) | `supabase/migrations/20260903T0416_no_period_after_a_signature_line.sql` (new) + `test/db/sale_golden_render.test.ts` (+15) + this report + the ledger |

### 7. The owner's checklist (for ORCH / owner — not done by this thread)
1. Open `/app/contracts/7adcd08f-fd5d-40f9-b726-634074266d7c` as staff → signature block shows `Signature:` bare and `Date: <today>` with no period, on the page and in the PDF.
2. Then: `select l from documents d, regexp_split_to_table(d.merged_body, E'\n') l where d.id='7adcd08f-fd5d-40f9-b726-634074266d7c' and l ~ '^(Signature|Date): ';` → 4 lines, none ending `}}.`.

## THE REACH
`src/pages/app/ContractPage.tsx:485` → `regenerateContractDocument` (`src/lib/contracts.ts:740`) → `regenerate_contract_document` → `remerge_contract_from_clauses` → `UPDATE documents SET merged_body`. Fires on first open of the lease in a page session, for staff or Pamela. Other callers (`saveContract` `contracts.ts:907`, intake/horse-capture regenerate) reach the same composer; none was edited.

## THE THREE QUESTIONS (§2c) — nothing is captured by this task
No value is captured. The change is a rule inside the single function that authors terminal punctuation. Seen: the signature block on the contract page and PDF. Acted on: `record_signature` replaces the token only, so the signed line now reads `Signature: Pamela Godde` with no period. Needed but unasked: nothing — the display resolver (`documentBody.ts:41-43`) already turns the bare token into nothing, and `SIGNATURE_LINE`'s `(.+)` then stops matching, which is the plain-text outcome SIGNFLOW-A wanted.

## D32/D33 (T2)
81 of 81 executed documents have `contract_id IS NULL` (re-measured today, §8.1). The composer cannot reach any of them; `regenerate_contract_document` returns the stored body before composing. No executed body was or can be rewritten by this change.

## OUT OF SCOPE — confirmed untouched
`regenerate_contract_document`, `record_signature`, `remerge_contract_body`, `remerge_contract_from_fields`, `documentBody.ts`, `documentPdf.ts`, `SIGNATURE_LINE`, the two flat DRAFTs, all templates/clauses, all client code.

## TEARDOWN
No servers, browsers or scratch worktrees started. wt-2 remains on `task/signflow-h` (committed, not pushed). No open transactions against production (dry-run ended in `ROLLBACK`; apply was a single autocommitted `DO`).

---
## VALIDATION — ORCH, 2026-09-03
Independently verified and merged; see TASK-SIGNFLOW-H-VERIFICATION.md.
