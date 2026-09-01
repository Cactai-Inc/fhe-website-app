# TASK-SIGNSTRIP — VERIFICATION · ORCH6 · 2026-09-01

**Merged. typecheck 0 · lint 46 · build clean.**

| Claim | Check | Result |
|---|---|---|
| the block is gone from all funnels | grep `SignStart.tsx` for the two headings and `PATH_SEGMENTS` | ✅ **zero hits** |
| footprint only | diff scope | ✅ **one source file + its report** |
| `deal` untouched | its own guard | ✅ per the thread, and nothing in the diff reaches it |

⚠️ **NOT VERIFIED BY ORCH: the render.** The thread ran a real-Chromium harness across five paths;
**ORCH did not open a browser.** **Owner check: load `/sign/rider` and confirm the block is gone and
nothing below it looks orphaned.**

**Flagged, not fixed:** the worktree had no `node_modules`/Chromium and the thread installed them to
run the browser checks — **not in the commit.** ⚠️ **Pool worktrees carry deps by design; a
`wt-signstrip` created outside the pool did not.** **Use `wt-1`…`wt-5`.**
