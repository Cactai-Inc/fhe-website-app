# Extraction instructions (FLAGHARVEST)

You are extracting flagged items from task reports in /Users/cactai/Downloads/claude-code-repo/wt-flagharvest/docs/reports/. READ EVERY ASSIGNED FILE IN FULL (use Read, in chunks if large). Do not skim. Do not verify anything against code or DB — extraction only.

## What counts as an item
Anything the report's author flagged, reported, deliberately left alone, could not verify, or surfaced for the owner. Sweep the WHOLE document, not just headed sections. Trigger phrases and near variants:
"Flagged, not fixed", "Reported, not fixed", "did not fix", "left alone", "worth a closer look", "for the owner", "owner ruling needed", "NOT VERIFIED", "out of scope", "I did not", "not built", "found and NOT fixed", "deviation", "correction", "reported rather than changed", "open question", "deferred", "blocked", "known issue", "caveat", "landmine", "TODO", "follow-up".

## Per item, output exactly this format
```
### ITEM
- report: <filename>
- date: <report date — from the doc header; if absent run `git log --follow --format=%as -- docs/reports/<file> | tail -1` from the worktree root>
- item: <one plain-language sentence>
- quote: <short verbatim quote from the report, ≤3 lines>
- kind: <defect | security | data-integrity | blocked-on-owner | not-verified | inventory | correctness | cosmetic | process>
- artifacts: <comma-separated file paths / RPC names / table names / component names the item concerns, if any>
- decision-mention: <D-number if the report ties it to a decision, else none>
```

## Also: unviewed inventory
Separately collect every component, page, route, email template, email body, or copy string the report describes as unreachable, unused, dead, orphaned, "retired behind a boolean", "no callers", shelved, or preview-only. Format:
```
### INVENTORY
- report: <filename>
- what: <one sentence>
- where: <exact file path(s) or DB row identifiers as given in the report>
- quote: <short verbatim quote>
```

Be exhaustive rather than tidy — near-duplicates within your batch are fine, dedup happens later. If a file is a prompt/plan doc rather than a report, still sweep it for flagged/open items.

Write your full output to the file named in your prompt. Your final text reply should be ONLY: the count of ITEM entries, count of INVENTORY entries, and any assigned file you could not fully read.
