# Parallel Workflow — fan-out → integrate → preview → main

Companion to PARALLEL_MANIFEST.md. This is the exact git choreography for running
several Claude Code sessions in parallel and landing their work cleanly. Branch
model is **preview + main only** for long-lived branches; every `feat/*` and
`integration/*` branch is short-lived and deleted after merge. Auto-deploys are
restricted to `preview` + `main` by `vercel.json` (`git.deploymentEnabled`), so
pushing `feat/*` / `integration/*` branches will NOT trigger Vercel.

Set once per batch:
```bash
BASE=feat/phase-2-contract-layer      # trunk today; use `preview` after reconciliation
BATCH=crm-cat-3-intake                # from the manifest
```

## 1. Fan out — one isolated worktree per lane
Worktrees give each agent a real, separate checkout of the same repo (no clobbering,
no branch-switch races) while sharing one object store.

```bash
git fetch origin
git worktree add ../fhe-$BATCH-a -b feat/$BATCH-a origin/$BASE
git worktree add ../fhe-$BATCH-b -b feat/$BATCH-b origin/$BASE
git worktree add ../fhe-$BATCH-c -b feat/$BATCH-c origin/$BASE
```
Point one Claude Code session at each directory (native app: open the folder;
Claude Code on web: one task per branch). Give each session the manifest and its
lane row. Each session, when done:
```bash
npx vitest run                 # its area must be green
git add -A && git commit -m "..."   # tidy, meaningful commits
git push -u origin feat/$BATCH-<lane>
```

## 2. Fan in — integrate and test as a unit
```bash
git fetch origin
git switch -c integration/$BATCH origin/$BASE
git merge --no-ff origin/feat/$BATCH-a origin/feat/$BATCH-b origin/feat/$BATCH-c
# resolve any conflicts here — this is the ONLY place they should appear
npx vitest run                 # FULL suite must pass as a unit
git push -u origin integration/$BATCH
```
If a lane needs rework, fix on its branch, re-push, and re-merge into a fresh
`integration/$BATCH` (cheap — it's disposable).

## 3. Promote to preview (live test) — squash for clean history
```bash
git switch preview
git merge --squash integration/$BATCH
git commit -m "$BATCH: <one-line summary of the batch>"
git push origin preview        # Vercel auto-deploys the preview URL
```
Test on the live preview deployment.

## 4. Promote to main (production)
```bash
git switch main
git merge --ff-only preview    # or: git merge --squash preview && commit
git push origin main           # Vercel deploys production
```

## 5. Clean up
```bash
git worktree remove ../fhe-$BATCH-a && git branch -D feat/$BATCH-a
# ...repeat per lane...
git push origin --delete feat/$BATCH-a feat/$BATCH-b feat/$BATCH-c integration/$BATCH
```

## Which Claude access point for the lanes
- **Claude Code on the web** — best fit: each task is its own isolated cloud sandbox
  on its own branch and pushes automatically. Steps 2–4 done from your integration desk.
- **Native app on the Mac mini** — open one worktree folder per session; all local.
- **One orchestrator + worktree subagents** — for a supervised fan-out inside a single
  session (I spawn the lanes and merge them for you).

## Golden rules
- One owner per path (manifest enforces it). Conflicts only ever resolved at step 2.
- Only `integration/*` and `preview`/`main` ever run the FULL suite gate.
- Squash at step 3 keeps `preview`/`main` history to one clean commit per batch.
- Delete short-lived branches immediately — the two-branch model stays clean.
