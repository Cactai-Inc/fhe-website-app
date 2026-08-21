# TASK-CONTRACTSEND — the owner can send a contract today

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** **APPLY YOUR WORK. Do not hold.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-contractsend`, branch `task/contractsend`
(**copy `.env.db` and `.env.test` into the worktree — they are gitignored and do NOT propagate**) ·
report to `docs/reports/TASK-CONTRACTSEND-REPORT.md` · commit, **do not push** · no subagents.

⚠️ **55 executed documents are EVIDENCE — never edit, sign, void or supersede a real client's
document.** Contract 60 and the 5 new ones are WALK3's test artefacts and are yours to use.

---

# 1. WHY — the owner cannot send a contract, and every blocker is proven

> **Owner, 2026-08-21:** *"i need this entire project finished today, i need to send contracts."*

`TASK-WALK3` executed the first contract in this production database — **but only by working around
two defects with direct database writes.** Without those workarounds **no lease can ever be
completed through the browser.** Both are confirmed:

| # | defect | proof |
|---|---|---|
| **1** | **No date field saves through the browser.** `TXN.LEASE_START` is always-required; the typed value appears on screen and **no save call is ever fired.** | WALK3, confirmed four ways with full network logging |
| **2** | **The horse-confirmation control can never render.** The DB stores `section = 'HORSE'`; `ContractPage.tsx:781` and `:1906` both compare against `'Horse'`. | orchestrator, verified in source and prod 2026-08-21 |

⚠️ **#2 disproves `CONTRACTWALK`'s claim that the control was "reachable and clearly labelled."**
That was read off the source. **Never conclude reach from source again — render it.**

---

# 2. THE WORK — fix, prove in a browser, and prove it in the DATA

## §1 — dates save (highest priority; nothing ships without it)
Find why the date input never fires its save and fix it. **Every field type must save** — do not fix
only `TXN.LEASE_START`. **Enumerate every `input_kind` in `contract_field_defs`** (text, select,
longtext, buttons, yesno, number, certify, **date**, currency, share_amount, location, add_text,
week_grid, med_schedule, contacts_list, fee_schedule, reveal_text, percent) and **prove each one
round-trips**: type a value, reload the page, the value is still there.

## §2 — the horse confirmation renders
Fix the `'Horse'` / `'HORSE'` mismatch in **both** sites. ⚠️ **Do not fix it by changing the
data** — `section = 'HORSE'` is what every template uses. **Fix the comparison, and make it
case-insensitive so this cannot recur.** Then **grep the whole codebase for the same class of
literal-section and literal-role comparison** and report any others.

## §3 — New Contract stops orphaning rows
WALK3: *"a 'New Contract' creation bug leaves orphaned real database rows when Document Controls are
left at their shown defaults — very likely why production had 0 contracts before this walk."*
**Reproduce it, fix it, and list the orphans already in production** (do not delete them; report
them).

## §4 — the change-request controls are reachable from BOTH sides
⚠️ **The mechanism EXISTS and is WIRED — this is diagnosis, not construction.**
`contract_change_requests_list` · `mark_change_request_seen` · `edit_change_request_entry` (**revise**)
· `agree_change_request` (**accept**) are all called from `src/lib/contracts.ts:1127,1199,1240,1273`
and rendered by `ContractChangeRequests.tsx`.
**WALK3 reported "no accept/reject control anywhere" and counterparty-side Suggest failing
silently.** Establish which it is: **controls genuinely not rendering for that party, or present but
unrecognised** (they are labelled *Agree* and *Edit*, not *Accept* and *Reject*). **Check
`caller_may_propose(p_document_id, p_control)` for the counterparty case** — that function exists to
gate exactly this.
**D29 governs:** a **change** is seen-is-approved (no accept button, by design); a **proposal**
needs accept · revise. **Do not remove the disposition from proposals**, and **do not add an accept
button to the change flow.**
⚠️ **A silent failure is never acceptable** — if Suggest fails, it says why.

---

# 3. THE TEST THIS MUST PASS
1. **A date is typed, saved, and survives a reload** — shown in the DB.
2. **Every `input_kind` round-trips**, listed one by one, pass or fail.
3. **The horse-confirmation control renders and can be clicked**, screenshot.
4. **A complete lease is authored, filled, locked and signed by both parties entirely through the
   browser, with ZERO direct database writes.** That is the acceptance criterion for this task.
5. **New Contract creates no orphans**, and existing orphans are listed.
6. **Both parties can see and act on a change request**, and Suggest either works from both sides or
   fails loudly with a reason.
7. **No real client document touched** — the original 55 verified untouched by id.
8. `typecheck` 0 · lint identical to main.

# 4. REPORT
`docs/reports/TASK-CONTRACTSEND-REPORT.md`. Lead with: **can the owner send a contract today,
yes or no.**
