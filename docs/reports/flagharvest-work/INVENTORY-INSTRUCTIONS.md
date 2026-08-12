# Unviewed-inventory instructions (FLAGHARVEST)

Goal: the owner has never seen these artifacts. "An artifact the owner has never seen is not dead code — it is unreviewed inventory." Your job is to SHOW him each one so he can judge stub vs golden egg. RECOMMEND NOTHING FOR DELETION. Change no code.

Worktree: /Users/cactai/Downloads/claude-code-repo/wt-flagharvest. Prod DB: `psql "$(head -1 /Users/cactai/Downloads/claude-code-repo/wt-flagharvest/.env.db)" -tAc "<SQL>"` — SELECT-only.

Input: /private/tmp/claude-504/-Users-Cactai/5a47bfcc-2691-47a7-b539-4d95f2da8aa9/scratchpad/flagharvest/master-inventory.txt — entries tagged [INV batchN.md#k]. Process ONLY entries from the batch files named in your prompt. Dedupe by artifact (same path/row = one entry).

Per artifact:
1. Confirm it still exists in CURRENT code (or prod DB for email templates / copy rows). If deleted since, say so and show the deleting commit (`git log --diff-filter=D -- <path>` or gitlog.txt in the same dir).
2. PASTE ENOUGH ACTUAL CONTENT TO JUDGE IT — not a description. For a component/page: the rendered structure and every user-visible copy string (paste the key JSX/render section, ~20-60 lines). For an email template: the FULL subject + body. For copy strings: the strings themselves. For a DB-row template: SELECT the row and paste it.
3. Say how it is unreachable (no route, boolean off, no callers — verify with grep, name the flag/file).

Output format:
```
## <artifact name> (<path or table row>)
- reported by: <report files>
- reachability: <verified: how it is unreachable now, with the gate/flag file:line>
- exists: <yes | deleted in <commit>>
- content:
<pasted content, fenced>
```
Write to the output file named in your prompt. Final reply: artifact count, deduped count, any entries you could not resolve.
