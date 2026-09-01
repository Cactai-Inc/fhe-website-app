# TASK-AR6 — should Activity and Oversight be one page?

⚠️ **READ `docs/method/ADMIN-REVIEW-ANALYSIS-STANDARD.md` FIRST.** **You are writing a report. You are
fixing nothing.**

**Owner, 2026-08-29:**
> *"7) Review and evaluate if Activity and Oversight can be merged into one page with a better ui
> design for a more functional layout."*

⚠️ **This is the one item phrased as a QUESTION, not an instruction.** *"Review and evaluate if"* —
**so "no, and here is why" is a legitimate and welcome answer.** Do not merge them to satisfy the
prompt. **The deliverable is a recommendation with evidence.**

---

## 1. WHAT THEY ARE TODAY

`/app/ops/activity` — `community.activity`, label **Activity**
`/app/ops/oversight` — `community.oversight`, label **Oversight**

Both sit in the `community` group, which `TASK-AR4` is renaming to **Admin**.

**Establish for each, before evaluating anything:** what it reads, what it shows, who it is for, what
a person does with it, whether it has any write capability, and **whether anyone can reach it** —
the standard's §2 state matrix applies here as everywhere.

## 2. ⚠️ THE FINDING THAT MOST LIKELY DECIDES THIS — D19

**D19 records the corollary the app fails completely:**
> *"four ledgers (`audit_logs`, `notifications`, `document_deliveries`, `status_events`) are written
> and none is ever read back to a human, so no staff member can answer 'what does this client see?'"*

⚠️ **Activity and Oversight are the two surfaces most likely to be attempts at that answer.** So the
real question may not be *"can these two pages merge"* but **"is there ONE surface here that finally
reads those four ledgers back, and are these two its unfinished halves?"**

**That reframing is available to you and you should test it.** ⚠️ **But test it — do not assume it.**
If they turn out to serve genuinely different audiences or questions, say so plainly and recommend
keeping both.

## 3. THE QUESTIONS YOUR REPORT MUST ANSWER

1. **What question does each page answer**, in one plain sentence, with no function names?
   ⚠️ **If you cannot write that sentence for a page, that is itself the finding.**
2. **Do they overlap in data, in audience, or in neither?** Overlapping data with different audiences
   argues for two views over one read; overlapping audience with different data argues for tabs.
3. **Are either of them reachable and used?** Registry row, nav row, inbound links, and whether
   anything writes what they read. ⚠️ **`ORCHESTRATOR.md` §3b lists eight features that work and that
   nothing reaches. Establish whether these are the ninth and tenth.**
4. **Which of the four D19 ledgers does each already read**, and **which of the four is read by
   nothing at all?**
5. **If merged: what is the layout?** The owner asked for *"a better ui design for a more functional
   layout"* — so a recommendation without a layout is incomplete. ⚠️ **CR-74 governs the shape:** an
   expanding full-width card in place beats a deeper page; a modal is for quick view and quick
   action; a page is for a record with more than its own fields.
6. **If not merged: what makes each one better on its own?** Same standard of evidence.

## 4. THE TRAPS

⚠️ **EMPTY IS NOT A FINDING.** These pages read ledgers that may be nearly empty because **nobody is
in the app yet**. The owner has been shown that as news repeatedly and it is not. **A finding is
something that would still be wrong once the app is used.** ⚠️ **But a ledger that nothing WRITES is
a real finding** — that is different from one that is merely unpopulated. **Distinguish the two
carefully; this is the exact distinction the owner has corrected threads on.**

⚠️ **D27 is a settled ruling about activity records** and it is probably relevant: evaluations,
riding and exercise logs, reports, notes, photos and video **live on the rider or horse record**, not
on a documents or money surface. *"An activity log is the minimum; clicking an entry opens the
content."* And: **never locked, always logged** — editable forever with every change recorded.
⚠️ **So an "Activity" page that is a destination may be at odds with a ruling that activity belongs
on the record it describes.** Test that against what the page actually is.

⚠️ **CR-30 demoted Activity once already:** the account-history surface *"REPLACES the Activity Log
as a dedicated page"* and **the activity log becomes a link from account history, top right.**
⚠️ **That is an owner ruling from 2026-08-25 and it bears directly on whether Activity should exist
as a page at all. Surface it; do not quietly override it.**

⚠️ **`TASK-AR4` is renaming the section both pages live in.** Report the dependency.

## 5. OUT OF SCOPE

Building anything · the section rename (AR4) · the other four pages in that section.

## 6. REPORT

`docs/reports/TASK-AR6-REPORT.md`, standard §4 shape. Worktree `wt-ar6`, branch `task/ar6`.
**Commit the report only. Do not push.**
