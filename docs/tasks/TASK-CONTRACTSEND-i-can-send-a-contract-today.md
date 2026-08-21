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

## §4 — WHY IS `my_roles` EMPTY? (diagnosis — the feature is BUILT, do not rebuild it)

⚠️ **The orchestrator twice claimed the disposition did not exist. It does. Everything below is
built and wired — this section is a bug hunt, not construction.**

`resolve_clause(p_addendum_id, p_accept boolean)` (accept/reject, guarded by `caller_may_resolve`
so a proposer cannot resolve their own) · `resolve_field_edit` · `withdraw_clause` ·
`withdraw_field_edit` · `update_contract_composition` (edit an added item, staff-or-author via
`added_by_contact_id`). **Live UI call sites: `ContractPage.tsx:214-243`** (Accept · Reject ·
Withdraw) and **`ClauseDocument.tsx:809/823`** (edit · remove).

**WALK3 saw a proposal card with no controls on BOTH sessions.** The controls are conditional:
```
isOwnerSide || (hasPartyRole && !mine)  -> Accept / Reject
mine                                     -> Withdraw
otherwise                                -> the text "Pending review"
```
Both sessions hit the last branch. `isOwnerSide = isStaff && !viewAsSigner`;
`hasPartyRole = myRoles.length > 0`, from `detail.my_roles`.

**THE JOB: find why `contract_document_detail` returns empty `my_roles` for a counterparty**, and
fix it. ⚠️ **The same identity gates the edit controls** (`isOwnerSide || f.added_by_me`) — **one
identity bug presenting as two missing features.** Prove both clear together.
⚠️ Related: **counterparty-side Suggest fails silently.** Check `caller_may_propose(p_document_id,
p_control)` for that case. **A silent failure is never acceptable — it says why.**
⚠️ **REVISE (counter-offer) is genuinely absent.** **Do NOT build it in this task** — report it.
⚠️ **D29:** a *change* is seen-is-approved; a *proposal* has accept/reject. **Do not add an accept
button to the change flow, and do not remove disposition from proposals.**

---

# 3. THE TEST THIS MUST PASS
1. **A date is typed, saved, and survives a reload** — shown in the DB.
2. **Every `input_kind` round-trips**, listed one by one, pass or fail.
3. **The horse-confirmation control renders and can be clicked**, screenshot.
4. **A complete lease is authored, filled, locked and signed by both parties entirely through the
   browser, with ZERO direct database writes.** That is the acceptance criterion for this task.
5. **New Contract creates no orphans**, and existing orphans are listed.
6. **`my_roles` resolves for a counterparty**, and BOTH the proposal controls (Accept/Reject/
   Withdraw) and the added-item edit controls render for them — **shown in a browser, screenshot.**
   Suggest either works from both sides or fails loudly with a reason.
7. **No real client document touched** — the original 55 verified untouched by id.
8. `typecheck` 0 · lint identical to main.

# 4. REPORT
`docs/reports/TASK-CONTRACTSEND-REPORT.md`. Lead with: **can the owner send a contract today,
yes or no.**
