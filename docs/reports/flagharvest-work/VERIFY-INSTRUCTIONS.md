# Verification instructions (FLAGHARVEST pass 2)

You verify flagged items for one domain slice. Repo worktree: /Users/cactai/Downloads/claude-code-repo/wt-flagharvest (branch task/flagharvest, = origin/main 6a58c0f). CHANGE NO CODE — you are read-only except for writing your output file to the scratchpad.

## Inputs
- Your slice file (named in your prompt) in /private/tmp/claude-504/-Users-Cactai/5a47bfcc-2691-47a7-b539-4d95f2da8aa9/scratchpad/flagharvest/ — read it IN FULL.
- gitlog.txt in the same dir — every commit since 2026-08-01 (709). grep it for relevant task names/keywords.
- supabase/migrations/ in the worktree — 746 files, filenames are dated and named by task.
- Production DB: run `psql "$(head -1 /Users/cactai/Downloads/claude-code-repo/wt-flagharvest/.env.db)" -tAc "<SQL>"`. SELECT-only, never any write. NOTE: this connection has NULL auth.uid(), so org-scoped/RLS-gated RPCs legitimately return 0 rows — query tables/pg_catalog directly (pg_policies, pg_proc, information_schema) instead of calling app RPCs, and never conclude "broken" from an empty RPC result.
- CLAUDE.md in the worktree holds decisions D1–D15.
- test:db is broken (203 failures) — NEVER cite it as evidence.

## Step 1 — dedupe within your slice
The same finding appears in several ITEM entries (different reports, different wording). Collapse into FAMILIES. Keep EVERY source report listed. Do not merge things that are merely similar — merge only same-fact items.

## Step 2 — verify each family, factually
Assign exactly one status:
- CLOSED BY LATER WORK — a later commit/migration demonstrably fixed it. NAME the commit hash (from gitlog.txt / `git log -S`) or migration filename, AND confirm the fix is real by reading the current code or querying prod (e.g. the policy/function/column now exists). "Probably fixed" is not allowed.
- STILL OPEN — you checked current code/prod and the issue is still there. Show what you checked.
- SUPERSEDED BY EVENTS — the thing it concerned no longer exists (file deleted, table retired, page removed). Show it is gone (e.g. `git log --diff-filter=D`, ls fails, grep zero hits).
- CANNOT DETERMINE — acceptable and better than a guess. Say what you tried.

CRITICAL RULE FROM THE OWNER: a decision (D1–D15) is NEVER a reason to close or drop an item. If a decision seems to bear, record it in decision-note and leave the item's status purely factual.

## Step 3 — output format, one entry per family
```
## <DOMAIN>-<nn>: <short title>
- item: <one plain-language sentence>
- sources: <report file (date); report file (date); ...>
- raised: <earliest date>
- status: <one of the four>
- evidence: <exactly what you checked: file:line, SQL text + result, commit hash, migration filename>
- decision-note: <D-numbers that may bear on it, noted only, or none>
- cost-rank: <1 live defect | 2 security/data-integrity | 3 blocking/owner-decision-owed | 4 unviewed inventory | 5 correctness/consistency | 6 cosmetic/cleanup>
- recommendation: <what you would do — you did NOT do it>
```
At the end add:
```
# SLICE SUMMARY
- raw items in slice: N
- families after dedup: M
- status counts: CLOSED x / OPEN y / SUPERSEDED z / CANNOT-DETERMINE w
- possible cross-domain overlaps: <families that may also appear in another domain slice, by title>
- items you could not process: <list or none>
```
Write output to the file named in your prompt. Final reply text: just the summary numbers.
