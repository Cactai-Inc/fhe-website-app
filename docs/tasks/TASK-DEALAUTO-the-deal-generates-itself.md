# TASK-DEALAUTO — the deal generates itself, the bundle signs itself in, one email carries both

**RUN WITH: Opus 5 · thinking ON · effort HIGH.** Real architectural judgment: when a deal
should come into existence, how a signing flow sequences a second document set, and how
delivery unifies across two currently-separate systems. **APPLY YOUR WORK. Do not hold.**

**HOW TO RUN:** worktree `~/Downloads/claude-code-repo/wt-dealauto` (copy `.env.db`/`.env.test`
in — gitignored, do not propagate), branch `task/dealauto` · report to
`docs/reports/TASK-DEALAUTO-REPORT.md` · commit, **do not push** · no subagents. ⚠️ Check for
live threads before touching `deal_autocomplete_on_execution`, `contract_role_documents`, or
anything in `wt-archive`/`wt-errsweep`'s likely surface — read recent `git log` first.

---

# 1. WHY — the owner's words, and what they overturn

> **Owner, 2026-08-22:** *"all of those are bundled together to be signed after the contract is
> signed by both parties. if lessor is last to sign which is typically the case, the documents
> are to be surfaced in sequence immediately after the signature is captured on the contract.
> and then the whole document set, contract + bundle are sent in one email and captured as a
> deal. deals should auto generate now that i think about it so that page should be
> self-populating not manually authored as the first step before a contract nor after."*

**Three rulings, and each corrects something real that exists today:**

1. **The whole bundle — every document a contract role owes via
   `contract_role_document_requirements`, not only the horse-owner ones — signs AFTER both
   contract parties have signed, sequenced immediately following the final signature.**
   Consistent with (not a new exception to) `deal_completion_state`'s own existing comment:
   *"ONLY the governing document gates completion… an optional agreement the parties chose not
   to sign is their business."*
2. **Contract execution + the bundle deliver as ONE email**, not the contract's own execution
   email and the bundle's onboarding-document email as two separate sends.
3. **Deals auto-generate. `create_deal` is real and correct and has ZERO callers** — verified
   2026-08-22, 0 rows in `deals` in production. Today a deal can only exist if staff manually
   author one first via `DealsPage`/`NewContractPage` — the owner is ruling that out entirely.
   `deal_autocomplete_on_execution` already exists and is proven firing (FLOWMAP X4-adjacent),
   but it only **completes an already-existing pending deal** — `SELECT … FROM deals WHERE
   contract_id = … AND status = 'pending'; IF NOT FOUND THEN RETURN NEW;` — it never creates one.

---

# 2. WHAT WAS MEASURED (orchestrator, prod, 2026-08-22)

- `deals`: **0 rows.** `create_deal` exists, is correct, has no caller anywhere in `src/` or
  in any DB function.
- `deal_completion_state(deal_id)`: already gates purely on the governing document (the
  lease/sale itself), already treats companion documents as non-blocking. **Do not rebuild
  this — it already says what the owner just ruled.**
- `deal_autocomplete_on_execution`: fires on `documents` `AFTER UPDATE OF workflow_state` →
  `'executed'`. Marks the `contracts` row executed for lease/sale templates, then looks for a
  **pending** deal on that `contract_id` and completes it if nothing is outstanding. **The seam
  to extend is here** — this is where deal auto-CREATION belongs, immediately before the
  auto-COMPLETE logic that already exists.
- `contract_role_document_requirements(document_id)`: today's read-time bundle computation
  (ROLEBUNDLE, same day). LESSEE's bundle is now `COMPANY_POLICIES` + `FACILITY_RULES`; the
  horse-owner documents attach separately via `ensure_horse_documents`, execution-triggered.
  **This function is the source of "what the bundle contains" — read from it, do not
  re-derive.**
- Delivery today: `deliver-documents.ts` already batches multiple documents into one email
  (proven correct behavior, D25). **The gap is not the batching mechanism — it is that nothing
  calls it with BOTH the contract and the bundle in one list**, because the bundle isn't
  generated/signed until some later, currently-undefined moment.

---

# 3. THE WORK

## §1 — a deal comes into existence with no staff action
Extend `deal_autocomplete_on_execution` (or the earliest correct point before it — investigate
whether contract-START is more correct than contract-EXECUTION for creation, since the owner
says *"not... as the first step before a contract nor after,"* which reads as: the deal is not a
precondition and not a follow-up chore, it is a **byproduct that simply exists**, and the
natural moment for that is wherever the contract itself first becomes real). **Call `create_deal`
if none exists for this `contract_id` yet.** ⚠️ **Do not write a second deal-creation path** —
`create_deal` is correct; call it, do not reimplement it inline.
⚠️ `deal_party_roles(deal_type)` and the SALE/LEASE branching in `deal_completion_state` imply
`deal_type` must be inferred correctly at creation (lease vs. sale vs. bill-of-sale) — get this
from the same `contract_templates.contract_kind`/`is_horse_lease_template` logic
`deal_autocomplete_on_execution` already uses, do not guess a new classification.

## §2 — the bundle is sequenced right after the deciding signature
When the **second and final** contract-party signature lands (lessor, typically last, per the
owner — but **derive "last" from who actually signs second, do not hardcode a role**), the
signer's own bundle from `contract_role_document_requirements` is presented **in sequence,
immediately**, in the same session. ⚠️ **This is a UX/flow requirement, not just a data
computation** — trace the actual post-signature screen (`ContractPage.tsx`'s signing flow) and
add the sequencing there. **Prove it in a browser**, per this project's standing rule that a
reachability claim from source alone is not proof.
⚠️ **Horse-owner documents remain execution-triggered via `ensure_horse_documents` — do not fold
them into this same UI sequencing mechanism if they already attach correctly on their own.**
Confirm they still surface to the right party at the right time either way.

## §3 — one email, contract + bundle together
Once the bundle for a given party is complete (or once the deal's `can_complete` check from
`deal_completion_state` is satisfied — decide which and say why), send ONE email carrying the
executed contract **and** every bundle document, via the existing `deliver-documents.ts` batching
path. ⚠️ **Do not build a second delivery mechanism.** If the contract's own execution email
already fires separately today, this task's job is to make it wait for and include the bundle,
not to add a second send alongside it.

## §4 — Deals becomes a read surface
`DealsPage`'s manual-creation entry point is retired (D32: retire behind a flag, never delete
the page/table). The page becomes **read-only reporting** over auto-generated deals — status,
parties, completion state, all already computable from what exists. ⚠️ **Do not remove
`create_deal`** — it may still be a legitimate escape hatch for a deal with no governing
document yet (ask, or leave it callable but unreachable from the retired manual UI, and say so
in the report).

---

# 4. THE TRAPS

- **`deal_completion_state`'s existing comment IS the owner's ruling, already written down
  before today.** Do not add a check that makes companion documents block completion — that
  would directly contradict code that already says the opposite.
- **`deal_autocomplete_on_execution` fires on `workflow_state`, not `status`** — the same
  `UPDATE OF <col>` trap named in `ORCHESTRATOR.md` §3c. If you extend this function or add a
  sibling trigger, **prove it actually fires** with a probe trigger in a rolled-back
  transaction, never by reading the row afterward.
- **Do not assume LESSOR is always last.** The owner said "typically" — derive the actual
  second signer from the real signing sequence on the document, every time.
- **D16/D32 govern the email too** — sending is not a mutation of the documents themselves;
  nothing about unifying delivery may touch `contract_execution_audit` or re-execute anything.

---

# 5. OUT OF SCOPE
Redesigning `deal_completion_state`'s existing logic · retiring `contract_role_documents` or
`ensure_horse_documents` · any change to horse-document ownership (settled, same day) · building
a scheduler (D23's standing rule: none exists, none is needed here either — this is all
trigger/session-driven, not time-based).

# 6. THE TEST THIS MUST PASS
1. **Author and sign a real lease end to end** (test identity): a `deals` row exists **before
   anyone touched a Deals page**, with the correct `deal_type`.
2. **The second signer sees their bundle immediately after signing**, in the same session,
   proven in a browser.
3. **Exactly one email** carries the executed contract and every bundle document together —
   show the send, its attachment list.
4. **The deal reaches `complete` status** once the governing document and (per §1's finding)
   the bundle are done, matching `deal_completion_state`'s existing `can_complete` logic.
5. `DealsPage` shows this deal with no manual entry anywhere in the flow.
6. `typecheck` 0 · lint identical to main · `test/db` diffed file-for-file (baseline).

# 7. THE REACH
What a person clicks to sign their bundle (should be: nothing extra — it simply appears), and
where staff go to see a deal's state (the retired-to-read-only Deals page).

# 8. THE TELL
What the signer sees confirming their bundle is done, and what both parties see in the one email
they receive.

# 9. REPORT
`docs/reports/TASK-DEALAUTO-REPORT.md`, with **flagged-not-fixed**.
