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

### Getting the ID into the thread's title

The VS Code thread title is **auto-generated from the prompt's content**, and it discards a
`THREAD ID: X` header as metadata — confirmed live on `WALLSYNC`, which auto-titled itself
"Fix version-blind satisfaction predicate for wall and onboarding".

**So the ID goes in the first natural-language sentence**, where the summarizer has to carry
it:

```
WALLSYNC — fix the wall/onboarding deadlock.

Read docs/tasks/TASK-WALLSYNC-…md in full before doing anything.
```

Not `THREAD ID: WALLSYNC` on its own line. That gets dropped.

If the extension turns out to support renaming a thread manually, use that instead — it is
exact, and this convention is only a workaround for not having it.

### The ID is stamped in three places that do NOT depend on the title

Even when a title goes astray, a thread is identifiable by its **branch** (`task/<id>`),
its **worktree** (`wt-<id>`) and its **report** (`TASK-<ID>-REPORT.md`). Ask a thread what
branch it is on and you have its ID.

---

## NOT RUN — 8 specs written, waiting

| ID | What it does | Priority |
|---|---|---|
| **WALLSYNC** | Wall and onboarding page disagree; Madeline Do is locked out of her account today, 8 more latent | **1 — a person is blocked** |
| **LEASEGATE** | Restriction gates on the lease. Unblocked (LEASEFORK + TIPTAP merged) | 2 — live docs wrong |
| **LEASESIMPLE** | Strip the worksheet. Unblocked (LEASEFORK merged) | 2 |
| **NULLUID** | Audit every SECURITY DEFINER guard that trusts a NULL `auth.uid()` | 3 — security |
| **SECFIX2** | `ensure_gift_buyer_account` anon path + `member_directory` RLS bypass | 3 — security |
| **GOOGLEAUTH** | Self-serve "Activate Sign in with Google" | 4 |
| **PURPOSEFIX** | Deal field select | 4 |
| **TITLESWEEP** | Conversational page intros | 4 |

## MERGED — done, in `main`, nothing outstanding

`ACCOUNTSURFACE` · `ONEMENU` · `LEASEFORK` · `WALLRETURN` · `TIPTAP` · `LEASEMAP` ·
`SECFIX` · `ACCTEVAL` · `BP410` · `SIGREAD` · `PLUSPASS` · `PARTYRLS` · `DOCVIS` ·
`PROFILE` · `COSIGN` · `HEADER` · `LOCFIX` · `SQLTRUTH` · `SVCPURGE` · `UIPOLISH` ·
`PARTYCTRL` · `COMPANYFIX` · `PAGETITLES` · `C10` · `I1B` · `R11` · `F3` · `A8` · `A8B` ·
`A11` · `A12` · `A13` · `A14` · `A15` · `A16` · `A` (party-verify 1 & 2) · `B` · `C` · `I`

## REPORTS NEVER REVIEWED BY THE OWNER

| ID | Report | Why it matters |
|---|---|---|
| **LEASEMAP** | `TASK-LEASEMAP-REPORT.md` | 5 findings; 2 mean live lease documents print contradictory risk terms |
| **ACCTEVAL** | `TASK-ACCTEVAL-REPORT.md` | 932 lines, the account-system audit |
| TIPTAP, BP410, PLUSPASS, SECFIX | — | merged, reports unread |

## OPEN DECISIONS — blocked on the owner

| # | Question | Recommendation |
|---|---|---|
| 1 | Send `WALLSYNC`? | Yes |
| 2 | Does the password survive Google linking? (`GOOGLEAUTH`) | Keep it |
| 3 | Is manual identity linking enabled in Supabase Auth? (`GOOGLEAUTH`) | Owner must check the dashboard |
| 4 | Lease picker shows "Default" and "Horse Lease Agreement" as two routes to one template (`LEASEFORK`) | Owner supplies a label |

---

## Counts as of 2026-08-07

- 43 distinct task branches · 47 reports filed · 49 task docs written
- Prompts run: **more than 43** — phased threads took 2–3 each. Not exactly knowable from
  the repo; ~55–65.
