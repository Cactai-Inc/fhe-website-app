# THE SPAWN PROMPT

**Give the incoming orchestrator exactly this. Nothing else goes in the prompt.**

```
FHE-ORCH-NEXT

cd /Users/cactai/Downloads/claude-code-repo/fhe-website-app
Read docs/method/00-START-HERE.md, then docs/method/ORCHESTRATOR.md, and take over.
```

⚠️ **The handoff comes first and the role second, deliberately** — the role is stable, the state is
not, and a thread that reads the role first spends its opening turns on rules it has no situation for.

⚠️ **The `cd` line is mandatory.** A fresh session starts in `/Users/Cactai` or `~/Downloads`, so a
prompt whose first path is relative fails on line one.

**Model:** Opus. **Thinking:** ON. **Effort:** HIGH.
An orchestrator's work is judgement, auditing and writing — not breadth-first search — so MAX buys
little. Spend MAX on build threads whose job is finding what is not written down.
