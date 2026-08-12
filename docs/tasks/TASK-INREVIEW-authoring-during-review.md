# TASK INREVIEW — structural authoring works while a contract is in review

**Owner ruling, 2026-08-12 — recorded as `CLAUDE.md` D14. Read D14 before starting.**

**This closes `TASK-ADDITEM`'s one flagged question.** ADDITEM repaired the Add Item editor and
then found the owner could not use it: **both live leases are `in_review`, and five RPCs refuse
that state.** The feature is built and unreachable.

---

# WHY THE LOCK IS WRONG — the owner had already ruled

> *"we already ruled on this, we said yes, we removed the lock for signing machinery from the
> contracts and have it signable only when everything is completed."*

**The safeguard is not a lock. It is forced visibility of what changed** — D14's review flow,
which runs when the other party clicks the signature section, before they sign.

**A lock stops the work. The review flow lets the work continue and makes the other party see it
before they commit.** The orchestrator recommended keeping the lock and was overruled; the
owner's reasoning is the better one and D14 records it in full.

---

# THE CHANGE — widen five RPCs to accept `in_review`

```
add_contract_composition
remove_contract_composition
add_contract_element
propose_clause
set_field_included
```

**All five.** `propose_clause` was ambiguous and is now settled: **it is the Add Item modal's
self-authoring path** (`AddElementModal.tsx:763`, `mode === 'clause'`), *"a way to handle
requests that require adding something"* — **not** a propose-an-idea mechanism. The
propose-an-idea surface was removed from the UI; what remains is authoring, and it belongs with
the other four.

## Measured 2026-08-12

```
workflow_state   status               documents
executed         EXECUTED             61
editable         DRAFT                 6
editable         AWAITING_SIGNATURE    3
in_review        AWAITING_SIGNATURE    2      <- the two live leases
void             VOID                  2
```

**`in_review` means the document is out with the counterparty awaiting signature.** That is
exactly when the owner needs to add a clause, and exactly when D14's review flow protects the
other side.

## What must NOT change

- **`executed` and `void` stay refused.** Widening is to `in_review` only. **61 EXECUTED
  documents are evidence and are never rewritten** — an executed document changes by
  **supersession**, per D14 §5, never by edit.
- **The signature rules are not in scope.** D14 §3 and §4 (a signed party may keep editing; the
  other party's signature must come off for them to edit; both must agree once both have signed)
  are **a separate build.** Do not implement them here.
- **The review flow is not in scope.** `ReviewChangesModal.tsx` exists but triggers on *"since
  this party's signature came off"* with explicit Accept/Reject; D14 needs the trigger at the
  signature click plus a login check, and **seen-is-approved** instead of Accept/Reject.
  **That is its own task — report the delta, build none of it.**

---

# ALSO — two findings to report, not fix

1. **`propose_clause` is a misleading name.** It self-authors a clause; "propose" implies a
   request awaiting agreement, which is what `contract_change_requests` does. **The name cost
   three exchanges to disambiguate and will do it again.** Report a rename recommendation; **do
   not rename it here** — it is called from `AddElementModal` and `lib/contracts.ts`, and a
   rename during a widening muddies both.
2. **`ContractChangeRequests` says comments and change requests were "merged into one threaded
   model" on `contract_change_requests` — yet `ContractNotes.tsx` still exists.** Establish
   whether that is a deliberate simpler view over the same data or a leftover second surface.
   **Report only.** *(Owner: the requests thread mirrors the document structure for geolocating;
   comments are for general conversation or a simpler chat UI. So it may well be deliberate —
   confirm which, with evidence.)*

---

# CONSTRAINTS

- Worktree `~/Downloads/claude-code-repo/wt-inreview`, branch `task/inreview`, off
  `origin/main`. **Never `~/Desktop`.** Do not push.
- **Change the state check and nothing else in any of the five functions.** If a function needs
  more than a widened state test, **report it and stop.**
- **THE SIGNING FREEZE IS IN FORCE.** This changes authoring, not signing.
- **`ClauseDocument.tsx` is STOP-AND-PROPOSE.**
- **Sarah's `704c8d2d…` is a SAMPLE under review** — safe to exercise against. **Never test
  against an executed document.**
- **Several threads are running** — TESTDB, COUNTFIX, BOOKWRITE, GUARDREST, EMAILEXTRACT,
  REQTRIGGER, RECORDS. **`GUARDREST` also touches definer function bodies**, including
  `lease_edit_guard`. **Rebase before you finish and check for overlap on any function you
  edit.**
- Migration: **no self-contained `COMMIT;`**; **do not reuse another migration's temp table
  name.** Dry-run in `BEGIN; … ROLLBACK;`, apply, verify.
- **`test:db` is broken** (60 of 68 files fail) — do not cite it as proof. Verify against
  production.
- Apply your proven work. **Do not leave it held.**

# THE TEST THIS MUST PASS

1. All five RPCs succeed against a document whose `workflow_state` is `in_review` — **proven
   against one of the two live leases**, or against Sarah's sample.
2. All five still **refuse** `executed` and `void`. Prove each.
3. **Add Item is usable on both live leases** without unlocking them first — the owner's stated
   blocker, gone.
4. No other behaviour in any of the five functions changed — show the diff.
5. The two findings above are reported and neither is fixed.

Report to `docs/reports/TASK-INREVIEW-REPORT.md`.
