# Thread registry — the ID lookup

**Every thread has an ID. The ID is the thread's label, its branch, and its report name.**
Say an ID and there is no ambiguity about which thread is meant.

Generated from repo state 2026-08-07. `main` = `267fc97`.

## Naming rule

| thing | form | example |
|---|---|---|
| thread label (what you name the VS Code thread) | `ID` | `WALLSYNC` |
| second/third prompt into the SAME thread | `ID-P2`, `ID-P3` | `ONEMENU-P2` |
| task doc | `docs/tasks/TASK-<ID>-*.md` | `TASK-WALLSYNC-…md` |
| branch | `task/<id>` lowercase | `task/wallsync` |
| report | `docs/reports/TASK-<ID>-REPORT.md` | `TASK-WALLSYNC-REPORT.md` |

## MANDATORY PREAMBLE — every prompt starts with this

Threads were finding a **second clone on `~/Desktop`** and working in it. Two of them
nearly lost work that way: NULLUID's four migrations and its report survived only because
they were copied off the disk by hand after that clone's `.git` was destroyed by an iCloud
sync.

The cause was **the prompts, not the threads** — they said "your own worktree off
`origin/main`" and never named the repo, so each thread discovered whatever clone it found.

**The canonical repo is `/Users/Cactai/Downloads/claude-code-repo/fhe-website-app`. There
is no other. Never `~/Desktop`.**

Paste this at the top of every prompt, above the task instruction:

```
Repo: /Users/Cactai/Downloads/claude-code-repo/fhe-website-app

STEP 1 — cd to that exact path. Verify it is a git repo and that `git remote -v`
shows Cactai-Inc/fhe-website-app. Create your worktree from THERE.
Do NOT use any clone under ~/Desktop. None is valid. If you find one, STOP and
say so — do not read from it and do not work in it.
Then print: CONFIRM 1

STEP 2 — read the task doc named below, in full, before doing anything else.
Then print: CONFIRM 2

If you cannot print either CONFIRM, STOP and state the problem. Do not proceed
past a CONFIRM you could not print.
```

### Getting the ID into the thread's title — two approaches DISPROVEN

The VS Code thread title is **auto-generated from the prompt**, and it is fixed from the
opening content before the task doc is ever read. **The doc is not the source** — proven by
`WALLSYNC`, whose doc is titled "TASK WALLSYNC — one satisfaction predicate" while the tab
read something else entirely.

Renaming by hand is not an escape: the tab does not update until the thread is closed and
reopened, **and reopening stops the run.**

| # | attempt | result |
|---|---|---|
| 1 | `THREAD ID: WALLSYNC` as a header line | ✗ **discarded as metadata** → "Fix version-blind satisfaction predicate for wall and onboarding" |
| 2 | `NOGUARD — audit anon-callable SECURITY DEFINER functions…` | ✗ **ID dropped, description kept** → "Audit unguarded SECURITY DEFINER functions" |
| 3 | **ID alone on its own line, no description** | ✓ **WORKS** → "Complete **SECFIX2** gift grant and directory task" |

The pattern: the summarizer treats `ID:` and `ID —` as discardable prefixes and titles from
the task description that follows. **Give it no description and the only substantive content
left is the doc filename — which contains the ID, so the ID survives into the title.**

This also means **task doc filenames must carry the ID**, since that is what the title is
built from. `TASK-<ID>-<slug>.md` already does.

### THE STANDARD SHAPE — confirmed working, use it every time

```
SECFIX2

Read docs/tasks/TASK-SECFIX2-gift-grant-and-directory.md and do exactly what it says.
Worktree: ~/Downloads/claude-code-repo/wt-secfix2, branch task/secfix2, off origin/main.
```

**This is the better prompt shape regardless of naming.** The task doc is the spec; a prose
prompt that restates it duplicates the spec in two places that can drift, and it is exactly
what feeds the summarizer. Prompt = pointer. Doc = everything.

### The reliable identifier: make the THREAD announce itself

The owner sees a thread list. **Branch names are useless to them** — that would mean running
git by hand, which the thread is doing, not the owner. So the fallback of "identify by
branch" does not solve the owner's actual problem.

What does: **every prompt instructs the thread to open its first reply with the ID.**

```
SECFIX2

Begin your first reply with "SECFIX2" alone on the first line.

Read docs/tasks/TASK-SECFIX2-gift-grant-and-directory.md and do exactly what it says.
Worktree: ~/Downloads/claude-code-repo/wt-secfix2, branch task/secfix2, off origin/main.
```

That yields three identifiers with different reliability:

| identifier | when visible | reliable? |
|---|---|---|
| tab title | immediately | **no** — auto-generated, ID often dropped |
| **first line of the thread's own output** | on opening the thread | **yes** |
| report filename | at completion | yes, but late |

**This is the standard prompt shape.** Use it for every handoff.

### The ID is stamped in three places that do NOT depend on the title

Even when a title goes astray, a thread is identifiable by its **branch** (`task/<id>`),
its **worktree** (`wt-<id>`) and its **report** (`TASK-<ID>-REPORT.md`). Ask a thread what
branch it is on and you have its ID.

---

## NOT RUN — CORRECTED 2026-08-08

**The previous "NOT RUN — 8 specs written" table was STALE and wrong.** Five of its eight
entries had already run and merged by the time it was read: `WALLSYNC`, `LEASEGATE`,
`LEASESIMPLE`, `NULLUID` and `SECFIX2` all have filed reports and all are ancestors of
`main` (verified with `git merge-base --is-ancestor`, 2026-08-08). Anyone reading that table
would have re-run finished work, including a "person is blocked" item that was already fixed.

**The test used to build this list:** a task doc with no matching
`docs/reports/TASK-<ID>-REPORT.md` has not run. That test is what the table below applies.

| ID | What it does | State |
|---|---|---|
| **ADMINSWEEP** | Full admin refactor. Phase 1 = inventory only, hard stop | not run — largest remaining piece |
| **PARTYJOURNEY** | Invite → auth → contract → capture → assignment → signature → PDF | not run — large, must be phased |
| **INVITELINK** | Existing members get an activation link they do not need | not run |
| **PAGEFRAME** | Nine pages onto the shared header (closes A5/A6) | not run |
| **TITLESWEEP** | Conversational page intros — run AFTER `PAGEFRAME` | not run, gated |
| **PURPOSEFIX** | Deal field select — a live defect, reported twice | not run |
| **GIFTCREDITS** | Redemption delivers value | not run |
| **GOOGLEAUTH** | Self-serve "Activate Sign in with Google" | not run |
| **FACILITYTERM** | Tenant chooses the facility word | not run — blocked on the owner's word list |
| **MOBILEPASS** | Nav/header material pass — **owns `AppLayout.tsx`** | not run |
| ~~**NOGUARD1**~~ | Access-control inventory of the anon-reachable definer surface | **DONE 2026-08-08.** Report merged at `9679006`; independently audited at `docs/reports/TASK-NOGUARD1-ORCHESTRATOR-AUDIT.md`. Findings confirmed against prod; the report understates the contract-field surface 3× |
| **NOGUARD2** | Harden the access checks NOGUARD1 found | **UNBLOCKED, ready, highest-priority open item.** Verified target list now in its task doc. Starts with `void_signatures_on_edit` — a live hole |
| **NOGUARD3** | Audit the `authenticated` surface (396 callable definer fns) | not specced — larger than the anon surface, never measured |

Unspecced and outranking most of the above: **the contract issues the owner found after the
reload fix.** Never described, so no doc exists. Ask before ordering anything around it.

## MERGED — done, in `main`, nothing outstanding

`ACCOUNTSURFACE` · `ONEMENU` · `LEASEFORK` · `WALLRETURN` · `TIPTAP` · `LEASEMAP` ·
`SECFIX` · `ACCTEVAL` · `BP410` · `SIGREAD` · `PLUSPASS` · `PARTYRLS` · `DOCVIS` ·
`PROFILE` · `COSIGN` · `HEADER` · `LOCFIX` · `SQLTRUTH` · `SVCPURGE` · `UIPOLISH` ·
`PARTYCTRL` · `COMPANYFIX` · `PAGETITLES` · `C10` · `I1B` · `R11` · `F3` · `A8` · `A8B` ·
`A11` · `A12` · `A13` · `A14` · `A15` · `A16` · `A` (party-verify 1 & 2) · `B` · `C` · `I` ·
`WALLSYNC` · `LEASEGATE` · `LEASESIMPLE` · `NULLUID` · `SECFIX2` · `ONEHEADER`

## REPORTS NEVER REVIEWED BY THE OWNER

| ID | Report | Why it matters |
|---|---|---|
| **LEASEMAP** | `TASK-LEASEMAP-REPORT.md` | 5 findings; 2 mean live lease documents print contradictory risk terms |
| **ACCTEVAL** | `TASK-ACCTEVAL-REPORT.md` | 932 lines, the account-system audit |
| TIPTAP, BP410, PLUSPASS, SECFIX | — | merged, reports unread |

## OPEN DECISIONS — blocked on the owner

| # | Question | Recommendation |
|---|---|---|
| 1 | ~~Send `WALLSYNC`?~~ **CLOSED 2026-08-08 — it ran and merged.** | — |
| 2 | Does the password survive Google linking? (`GOOGLEAUTH`) | Keep it |
| 3 | Is manual identity linking enabled in Supabase Auth? (`GOOGLEAUTH`) | Owner must check the dashboard |
| 4 | Lease picker shows "Default" and "Horse Lease Agreement" as two routes to one template (`LEASEFORK`) | Owner supplies a label |

---

## Counts as of 2026-08-07

- 43 distinct task branches · 47 reports filed · 49 task docs written
- Prompts run: **more than 43** — phased threads took 2–3 each. Not exactly knowable from
  the repo; ~55–65.
