# TASK-ERRSWEEP — `instanceof Error` hides the real reason, everywhere it still does

**RUN WITH: Sonnet 5 · thinking ON · effort MEDIUM.** The trap and the fix are both fully
written out below and in the codebase's own doc comment. Bounded breadth, not judgment.

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-errsweep` (copy `.env.db` and
`.env.test` in — gitignored, do not propagate), branch `task/errsweep` · report to
`docs/reports/TASK-ERRSWEEP-REPORT.md` · commit, **do not push** · no subagents. **APPLY your
work. Do not hold.**

---

# 1. WHY — this has already cost two separate incidents

**`src/lib/ops/errors.ts`'s own doc comment on `toErrorMessage` already names the mechanism:**

> *"Supabase/PostgREST rejections are plain objects (`{ message, details, hint, code }`), not
> Error instances… A branch written as `e instanceof Error ? e.message : ''` sees an EMPTY
> STRING… the fallback prints the raw message — which is the machine token itself. That is what
> WALK1 photographed: the literal string `NO_CREDITS` on the calendar, with the mapped panel
> sitting right there, unreachable."*

**`TASK-STABILIZE` (2026-08-22) found the same class again, independently**, at
`RegisterComplete.tsx:102`: `redeemInvitation()` throws the raw PostgREST error object
(`throw error` in `src/lib/api.ts:176`, no wrapping), and `err instanceof Error ? err.message :
'We could not finish setting up your account.'` is always false for it — so the ONE screen a
brand-new contract counterparty sees on failure has never once shown the real reason, in this
codebase's entire history. STABILIZE fixed the trigger (a missing `clients` row); this trap
itself was left standing and will hide the next failure just as completely.

**The fix already exists, is mature, and is already the majority pattern**: `toErrorMessage()`
in `src/lib/ops/errors.ts`, already used at **55 call sites**. **54 call sites still use the raw
`instanceof Error` anti-pattern.** This task converges the stragglers onto the existing helper —
**do not write a second normalizer (D18).**

---

# 2. THE METHOD — one grounding read, then judge each site

1. Read `src/lib/ops/errors.ts` in full once. That is the entire fix.
2. `grep -rn "instanceof Error" src/` once → the 54-site candidate list.
3. **Per site, one judgment call:** does this catch block wrap a call that can throw a
   Supabase/PostgREST rejection (any `.rpc(`, `.from(`, `.auth.` call upstream in the same
   try block, or a function like `redeemInvitation`/`redeemContractInvitation` that itself
   wraps one)? **If yes, it is in scope.** If the catch is genuinely only ever going to see a
   real JS `Error` (e.g., a `JSON.parse` failure, a thrown `new Error(...)` from local code with
   no network call in between), it is **not** in scope — leave it, and say so in the report
   rather than touching it needlessly.

## The fix, per in-scope site

Replace the pattern:
```ts
err instanceof Error ? err.message : '<fallback text>'
```
with:
```ts
toErrorMessage(err, '<fallback text>')
```
**Keep the existing fallback text verbatim** — this task fixes error SURFACING, not error
WORDING. Import `toErrorMessage` from `src/lib/ops/errors.ts` (check the relative path per
file; it is already imported at 55 other sites — match the existing import style in each
directory rather than inventing a new one).

---

# 3. THE TRAPS

- **Not every `instanceof Error` is a bug.** A site with no Supabase/RPC/auth call anywhere in
  its try block is not in scope. **Counting the wrong number is worse than fixing fewer.**
- **`toErrorMessage` itself must never be modified** unless you find it producing a genuinely
  wrong result on a real payload — it is tested, mature, and cited by name in two prior
  incidents. Report a defect in it rather than patching around it.
- **Some of the 55 existing correct call sites may sit in the SAME FILE as a broken one** —
  don't assume a file is fully converted just because it imports `toErrorMessage` somewhere.
- **`RegisterComplete.tsx:102` is the confirmed, proven case** — fix it first, and prove the fix
  the same way STABILIZE proved the trigger: reproduce a real activation failure (an already-
  redeemed token is the easiest repeatable case — `redeem_contract_invitation` genuinely raises
  for it) and confirm the SCREEN now shows the real Postgres message, not the generic fallback.

---

# 4. OUT OF SCOPE

- Any change to `toErrorMessage`'s own logic.
- Fallback wording changes — same text, better plumbing only.
- Sites confirmed not to wrap a Supabase/RPC/auth call.
- Any UI redesign around how the message is displayed (toast vs. inline vs. banner) — this task
  fixes WHAT is shown, never WHERE.

# 5. THE TEST THIS MUST PASS

1. **Every one of the 54 candidate sites is dispositioned** — fixed, or explicitly justified as
   out of scope — in the report. None silently skipped.
2. **`RegisterComplete.tsx`'s activation failure now shows the real reason**, proven by
   reproducing an actual failure (e.g., redeeming an already-redeemed token) and reading the
   screen, not just the code.
3. **Zero new call sites of the raw `instanceof Error` anti-pattern remain wrapping a
   Supabase/RPC/auth call.**
4. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file (baseline, not green).

# 6. REPORT
`docs/reports/TASK-ERRSWEEP-REPORT.md` — a table, one row per candidate site: file:line,
in-scope Y/N, fixed Y/N, reason if not fixed.
