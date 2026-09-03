# TASK-SIGNFLOW-H — no period after a signature line

**Spec by `FHE-TASK-SIGNFLOW-F` (DSNR profile), 2026-09-02. Change order: `CR-101 · A1`.**
**Thread name: `FHE-TASK-SIGNFLOW-H`.** *(F is the authoring thread; letters continue.)*
**A SHORT spec for a one-clause production migration. Short is not optional-to-read.**

> ## READ THESE, BY PATH — nothing else is handed to you
> - `docs/method/TASK-ROLE.md` — the standing requirements, **including §5 "Migrations" and "THE SIGNING FREEZE".**
> - `docs/method/CLNR-ROLE.md` §3 — your zeroth act.
> - `docs/method/THE-RUNNING-RECORD.md` — open `docs/reports/FHE-TASK-SIGNFLOW-H-LEDGER.md` FIRST.
> - `CLAUDE.md` §"Migration convention" (`:120-135`) — BEGIN/ROLLBACK dry-run → apply → verify → commit;
>   and the in-place-rewrite caveat.
> - `CLAUDE.md` **D32** (`:780`), **D33** (`:807`) — executed documents are evidence.
> - `docs/reference/CHANGE-ORDER-LEDGER.md` §"CR-101 · A1" (`:4411`) — the ruling and ORCH's constraints.
> - `docs/reports/TASK-SIGNFLOW-A-REPORT.md` §5 (`:165-230`) — where the period was found. ⚠️ **Two of
>   its counts are wrong; §2 below corrects them.**
> - `supabase/migrations/20260804120001_authored_line_punctuation.sql` — **the migration idiom you copy**
>   (read `pg_get_functiondef`, assert the anchor is found exactly once, replace, `EXECUTE`).
> - `supabase/migrations/20260820T0940_partyemail_p4b_regenerate_on_open_and_redemption.sql` header —
>   why regeneration on open is the normal path, and why the evidence is the execution SNAPSHOT.
> - `supabase/migrations/20260902T0010_the_retired_kiosk_closes_the_last_anonymous_signing_door.sql`
>   header — the DROP + CREATE ACL trap.
> - `src/lib/documentBody.ts:18-43` — the display-time resolver that turns the token into nothing.

---

## 1. THE OWNER'S WORDS
> *"we dont need a (.) at the end of a line that has a signature in it. that doesnt even make sense to
> be there in the first place. remove it and the issue you raised is no longer an issue."*
> — owner, 2026-09-02, `CHANGE-ORDER-LEDGER.md` §CR-101·A1

**ORCH's constraints, same entry:** *"executed bodies are evidence and are never rewritten (D32/D33);
the three unsigned bodies (incl. the live Pamela lease) re-compose through the normal remerge path only."*

## 2. WHAT WAS MEASURED — by DSNR on 2026-09-02, **against production** (`pg_get_functiondef`, `SELECT` only)

| Fact | How it was measured |
|---|---|
| The composer is **276 lines** in production and its last full definition in the repo (`20260804130000_sql_truth_recapture.sql`) is **stale** — 10 later migrations rewrote it in place | `select pg_get_functiondef('public.remerge_contract_from_clauses'::regproc)`; `grep -l remerge_contract_from_clauses supabase/migrations/*.sql \| xargs grep -l pg_get_functiondef` → 10 files |
| **The composer already knows which lines carry a signature token.** Per line, `v_has_sig` is set at `:128-134` (`IF v_tok LIKE 'SIG.%' THEN v_has_sig := true`), used at `:135` to keep the line, and SIG tokens are skipped at `:144` so they survive to display time | prod definition, numbered with `cat -n`. ⚠️ SIGNFLOW-A said `:171-174`; **in production the period site is `:176-178` and the colon guard `:179`**, in the same per-line loop as `v_has_sig` |
| The period site, verbatim (`:176-178`) | `IF btrim(v_line) <> '' AND btrim(v_line) !~ '[.!?:;)"'']$' THEN` / `v_line := v_line \|\| '.';` / `END IF;` |
| There is a SECOND period site (`:113-115`) for **authored `CUSTOM.*` lines with no token** — not in play: a signature line always carries a token | prod definition `:108-118` |
| Signature tokens live on exactly **4 clause lines** for the lease, all in `SIGNATURES.BLOCK`, token last on the line; **across ALL templates no SIG line carries text after the token** | `select clause_key, l from contract_clause_defs c, regexp_split_to_table(c.body, E'\n') l where template_key='HORSE_LEASE_V2' and l ~ '\{\{SIG\.'` → `Signature: {{SIG.LESSEE.NAME}}` · `Date: {{SIG.LESSEE.DATE}}` · `Signature: {{SIG.LESSOR.NAME}}` · `Date: {{SIG.LESSOR.DATE}}`; the all-templates query for `\{\{SIG\.[A-Z_.]+\}\}\s*\S` → **0 rows** |
| **Exactly ONE document is affected: the live Pamela lease** `7adcd08f` (`HORSE_LEASE_V2`, `AWAITING_SIGNATURE` / `in_review`, **0 signatures**) — its 4 signature-block lines end `}}.` | `select status, count(*) filter (where merged_body ~ '\{\{SIG\.[A-Z_]+\.(NAME\|DATE)\}\}\.') … group by status` → AWAITING_SIGNATURE **1**, DRAFT **0**, EXECUTED **0** |
| ⚠️ **SIGNFLOW-A §5 was wrong about the other two.** The two DRAFTs (`55de3433` RELEASE_PARTICIPANT, `2d315746` HUMAN_EMERGENCY_MEDICAL) are **flat templates** — `contract_id IS NULL`, no `contract_clause_defs` rows — and their lines read `Signature: {{SIG.CLIENT.NAME}}` **with no period**. The composer never touches them and nothing about them changes | the join to `contract_templates` + `exists(select 1 from contract_clause_defs …)`; the per-line listing |
| **The composer cannot reach any executed document today.** All **81** executed documents have `contract_id IS NULL`; `regenerate_contract_document` returns the stored body at its `:24` before composing. There is exactly **1** contract-engine document in production, the lease | `select workflow_state, count(*) filter (where contract_id is null) … where status='EXECUTED'` → 81 of 81; engine docs by status → `AWAITING_SIGNATURE \| in_review \| 1` |
| The evidence for an executed contract is the SNAPSHOT, not the live row | `contract_execution_audit` — 61 rows; the 0940 header: *"the evidence is the SNAPSHOT, not the live row"* |
| Signing writes the name INTO the stored body by replacing the token only | `record_signature` `:136-138`: `replace(replace(merged_body, '{{SIG.'\|\|v_ns\|\|'.NAME}}', p_typed_name), '{{SIG.'\|\|v_ns\|\|'.DATE}}', to_char(now(), 'FMMonth FMDD, YYYY'))` — so whatever punctuation the composer left after the token is what the signed line keeps |
| The normal recompose path | `ContractPage.tsx:485` → `regenerateContractDocument` (`contracts.ts:740`) → `regenerate_contract_document` → `remerge_contract_from_clauses` (`:57`) → `UPDATE documents SET merged_body` (`:92`) — **on every first open of a document in a page session**, for a party or staff |
| ACL today | `proacl = {postgres=X, authenticated=X, service_role=X}` — **no `anon`**. `CREATE OR REPLACE` keeps it; a `DROP` would reset it |
| The display side needs no change | `documentBody.ts:41-43` replaces `{{SIG.*.NAME}}` with `''` and `{{SIG.*.DATE}}` with today; with no period the line becomes `Signature: ` and `SIGNATURE_LINE`'s `(.+)` no longer matches — **the plain-text outcome SIGNFLOW-A's T4 wanted** |
| Tests | `test/db` runs from `fixtures/schema_snapshot.sql` (a dump of LIVE function bodies, regenerated 2026-08-21); the migration-replay path is broken at `20260709160000` (snapshot header). **`test:db` is red at baseline.** |

## 3. THE INCUMBENT, NAMED (D18) — CONVERGENCE. One condition, in the function that owns the rule.
The composer owns terminal punctuation (R5, `:165-171`), and it already computes `v_has_sig` for the
line it is punctuating. **The fix is to make the period site respect the flag it already has:**

```
IF NOT v_has_sig AND btrim(v_line) <> '' AND btrim(v_line) !~ '[.!?:;)"'']$' THEN
```

🔒 **That is the whole change. `v_has_sig` covers `SIG.*.NAME` AND `SIG.*.DATE` — the whole signature
block — by construction, and that is the intent: the owner's "a line that has a signature in it" is the
block, and a `Date:` line ending `2026.` beside a bare `Signature:` line would be the half-done version.**
The colon guard at `:179` and everything else stays exactly as it is.

**And rewrite the R5 comment above it (`:165-175`)** — do not delete it — so it records: CR-101·A1 (owner,
2026-09-02, quoted), that signature-block lines are exempt because their tokens resolve at signing/display
time where this guard cannot see them, and that `v_has_sig` is the flag.

### 🔒 3a. THE MIGRATION SHAPE — the function's own idiom, not a full re-issue
`supabase/migrations/20260902T<HHMM>_no_period_after_a_signature_line.sql`, written exactly like
`20260804120001_authored_line_punctuation.sql`: a `DO` block that reads `pg_get_functiondef`, asserts the
**anchor string is present exactly once** (`RAISE EXCEPTION` otherwise — the anchor is the verbatim `IF`
line in §2 plus the comment block above it), replaces it, and `EXECUTE`s the result. **Keep the idiom's idempotency guard** (`IF position(v_new in v_src) > 0 THEN RETURN`) so a re-run is a no-op, and its `$q$` dollar-quoting for the two anchors.
⚠️ **Why not a full `CREATE OR REPLACE` with the body pasted from the 2026-08-04 file:** that file is
stale by 10 rewrites (§2) and would silently roll them back. **Why not paste today's production body:**
276 lines of diff for a one-clause change makes ORCH's review harder, not easier. **The in-place rewrite is
what every other change to this function has done since August.**
- **`CREATE OR REPLACE` via the rewritten definition preserves the ACL** (§2). ⚠️ **No `DROP`.**
  Verify `proacl` after apply and put the before/after in the report.
- ⚠️ **The migration does NOT touch `documents.merged_body`.** No `UPDATE`, no backfill, no `PERFORM
  remerge…` outside a rolled-back dry-run. **The lease recomposes when it is next opened (§6).**

## 4. THE TRAPS
- **T1 — the signing freeze.** The lease is LIVE (`7adcd08f-fd5d-40f9-b726-634074266d7c`). Your dry-run
  is `BEGIN; … ROLLBACK;`. **Never leave a transaction open against production; never sign anything.**
- **T2 — D32/D33 are satisfied by measurement, not by hope.** 0 executed documents are contract-engine
  documents (§2), so the composer cannot reach any of the 81. **Re-run that count yourself on the day**
  and put it in the report. If it is ever non-zero, STOP and ask ORCH — the standing rule (0940 header) is
  that the snapshot is the evidence and the live row may re-render, but that is ORCH's call to reaffirm,
  not yours to assume.
- **T3 — the anchor must be found exactly once.** The `!~ '[.!?:;)"'']$'` pattern appears at BOTH period
  sites (`:113-115` and `:176-178`). Anchor on the `:172-178` comment-plus-IF block, not on the pattern
  alone — the authored-line site at `:113` must be left alone.
- **T4 — the dollar-quoting.** The body carries `$function$`; the idiom file shows the safe way to
  re-`EXECUTE` it. Copy it; do not improvise a quoting scheme.
- **T5 — the snapshot.** `test/db` will not see your change until `fixtures/schema_snapshot.sql` is
  regenerated from production (its header says how it was made). ⚠️ **Do not regenerate it in this
  task** — it is a 44,000-line fixture shared by every DB test and TASK-TESTREPAIR owns that act. Write
  the assertion (§8 item 5), report it as **red-until-snapshot**, and say so plainly.
- **T6 — `remerge_contract_from_clauses` has other callers.** `regenerate_contract_document` (open,
  intake, horse capture), `saveContract` (`contracts.ts:907`), and 2 more in the snapshot (`:2180`,
  `:2297`, `:2988`). All of them get the new behaviour for free and none needs an edit. **Do not touch them.**

## 5. OUT OF SCOPE — do not touch
- `regenerate_contract_document`, `record_signature`, `remerge_contract_body`, `remerge_contract_from_fields`,
  `resolveUnsignedSignatureTokens` (`documentBody.ts`), the PDF twins in `documentPdf.ts`, `SIGNATURE_LINE`.
- **The two flat DRAFTs** — nothing to fix (§2).
- **Any template or clause wording** — zero clause rows carry `}}.`; this is composer-only.
- **The R5 rule for every other line** — a filled token still gets its period.
- **Any client code. Any colour. Any second migration.**

## 6. THE REACH — how the fix reaches the one document that has the defect
Staff (or Pamela) opens `/app/contracts/7adcd08f…` → `ContractPage.tsx:485` regenerates → the composer
runs with the new guard → `UPDATE documents SET merged_body` (status is `AWAITING_SIGNATURE`, not
executed, not void) → the 4 lines read `Signature: {{SIG.LESSEE.NAME}}` … with no period → the display
resolver shows `Signature:` with nothing after it, and `Date: September 2, 2026` with no period.
**That open is the ONLY way the stored body changes, and it is the normal way (ORCH's constraint).**
⚠️ **You do not open it. ORCH or the owner does, at verification** — you prove the outcome in a
rolled-back transaction (§8 item 2).

**Is that the only way?** `saveContract` (`contracts.ts:907`) and `captureContactInfo` also recompose —
same composer, same result. No path composes without it.

## 7. THE TELL (D19)
On the lease, the signature block goes from `Signature: .` (a lone full stop in the cursive face, the
defect SIGNFLOW-A found) to `Signature:` followed by nothing. When signed, `Signature: Pamela Godde`
with no period, in the script face. **Undo:** none needed and none built — the composer is the single
author of that punctuation and this is its rule now.

## 8. THE TEST THIS MUST PASS
1. **Before:** the §2 count query, re-run, showing `AWAITING_SIGNATURE 1 / DRAFT 0 / EXECUTED 0` and the
   executed `contract_id IS NULL` count **81 of 81**. Both in the report verbatim.
2. 🔒 **Dry-run, rolled back:** `BEGIN;` → run the migration → `SELECT remerge_contract_from_clauses('7adcd08f-fd5d-40f9-b726-634074266d7c')`
   → list its lines matching `^(Signature|Date): ` → **all 4 end at the token, none ends `.`** → also
   assert one ordinary token line still ends in `.` (the R5 rule survives) → `ROLLBACK;`. Paste the output.
   Then prove the rollback: the stored `merged_body` still carries the 4 `}}.` lines.
3. **Apply. Verify the function:** `pg_get_functiondef` shows the new `IF`, the rewritten comment, and
   `:113-115` untouched; `proacl` unchanged (`postgres`, `authenticated`, `service_role`; no `anon`).
4. **After apply, before anyone opens the lease:** the stored body is byte-identical to before (prove by
   `md5(merged_body)` before and after). **The migration wrote no document.**
5. **`test/db/sale_golden_render.test.ts`** — add one assertion to each composed fixture: every line
   matching `/^(Signature|Date): /` ends without `.`. **Report it red-until-snapshot (T5)** with the
   failing output, and confirm `npx vitest run test/db/sale_golden_render.test.ts` fails ONLY on that
   assertion and not on setup.
6. Gates: `npx tsc --noEmit` 0 · `npm run typecheck:api` 0 · `npm run build` clean · `npm run test:api` 7/7.
   `git diff --stat` = the migration + the one test file. ⚠️ `test:db` red at baseline — report only item 5.
7. **The owner's checklist, two lines:** open the lease at `/app/contracts/7adcd08f…` as staff → the
   signature block shows `Signature:` bare and `Date: <today>` with no period, in both the page and the
   PDF; then the stored body's 4 lines carry no `}}.` (ORCH's query).

## 9. WHERE THE REPORT GOES
`docs/reports/TASK-SIGNFLOW-H-REPORT.md`. Ledger: `docs/reports/FHE-TASK-SIGNFLOW-H-LEDGER.md`.
**Open the ledger with your first action.** `ORCH` verifies. **You do not push.**
