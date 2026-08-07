# TASK LEASEFORK — fork the lease into three selectable versions

Build the mechanism to fork `HORSE_LEASE_V2`, produce three forks, and let the author
**choose which version at write time**.

**This task does NOT change any lease content.** The three forks start as faithful,
byte-identical copies. Differentiating them is separate work with its own specs. What you
are building is the *machinery* plus the selection path — so that content work can happen
on a fork without ever touching the version currently signing real leases.

---

## Verified ground truth (orchestrator, against prod 2026-08-06)

Do not re-derive these, but do confirm them before relying on them:

- `contract_templates.template_key` is **UNIQUE** → each version is its own template key.
- `contract_kind = 'HORSE_LEASE'` is what groups lease templates. This is the field a
  picker filters on.
- `HORSE_LEASE_V2` content: **22 sections, 144 clauses, 117 fields.**
- `HORSE_LEASE_V2` has **zero satellite rows** — `template_variants`,
  `contract_requirements`, `contract_role_documents`, `category_document_requirements`,
  `contact_required_documents`, `template_version_events` are all 0 for it. The fork is
  four tables, not ten. **Re-check this before cloning; if any is non-zero by then, stop
  and report rather than silently skipping it.**
- **4 live documents** reference the template by `documents.template_id` →
  `contract_templates.id`. A clone creates a new row with a new id, so those documents are
  untouched. This is why cloning is safe and editing in place is not.
- `start_lease_contract_v2(p_lessee_contact_id, p_lessor_contact_id, p_horse_id,
  p_responsible_role)` **hardcodes `HORSE_LEASE_V2`** and takes no template argument.
- No clone/duplicate helper exists anywhere in the database. No template authoring UI
  exists under `src/pages/app/ops/`.

---

## Phase 1 — the clone mechanism

A reusable database function, because this runs three times now and again later:

```
clone_contract_template(p_source_key text, p_new_key text, p_new_title text)
```

It must copy, in one transaction:

1. the `contract_templates` row (new id, new key, new title, `version` reset to 1)
2. all `contract_section_defs`
3. all `contract_clause_defs`
4. all `contract_field_defs`

**Fidelity requirements — these are the whole point:**

- `field_key`, `clause_key` and `section_key` values are **preserved verbatim**. They are
  namespaced by `template_key`, so `conditional_on` gates copy across unchanged and keep
  working. Do not rename or re-prefix anything.
- `conditional_on` JSON copies byte-identical.
- `{{TOKEN}}` bodies copy byte-identical.
- Ordering (`ord` or equivalent) is preserved exactly.
- The function **refuses** if `p_new_key` already exists, rather than merging or
  overwriting.

**Prove fidelity, do not assert it.** After each clone, produce a diff showing: counts
match per table; every `conditional_on` matches its source; every clause body matches its
source. A checksum over the ordered content of each table is the cleanest evidence. Put
the raw output in your report.

## Phase 2 — the three forks

| New key | Title | Intended eventual role |
|---|---|---|
| `HORSE_LEASE_STANDARD` | Horse Lease Agreement — Standard | Where the insurance gates get added. Becomes the everyday lease once proven. |
| `HORSE_LEASE_FULL` | Horse Lease Agreement — Comprehensive | The robust version built on the insurance research. |
| `HORSE_LEASE_SIMPLE` | Horse Lease Agreement — Simple | Stripped down, lightweight. |

**`HORSE_LEASE_V2` is not modified, not renamed, and not deactivated.** It stays exactly
as it is and remains the default. Its retirement is a later decision for the owner.

All three forks are byte-identical to the source when this task ends. Their content
diverges in separate tasks.

## Phase 3 — selection at write time

`start_lease_contract_v2` gains an optional template argument:

```
start_lease_contract_v2(..., p_template_key text DEFAULT 'HORSE_LEASE_V2')
```

- **Defaulting to `HORSE_LEASE_V2` is mandatory** — every existing caller must behave
  exactly as before. This is a live RPC that has signed real leases.
- Validate the argument: it must exist, be active, be `contract_kind = 'HORSE_LEASE'`, and
  not be soft-deleted. Reject anything else with a clear error rather than falling back
  silently.
- Add the picker to the UI where a lease is started. It lists active `HORSE_LEASE`
  templates by title. Staff-facing only.

**Stop and report between Phase 2 and Phase 3.** The clone is additive and safe; changing
a live RPC is not. Report the Phase 1–2 evidence and wait for the orchestrator before
touching `start_lease_contract_v2`.

---

## Explicitly out of scope

- **Any content change to any version.** No clauses added, removed, reworded or re-gated.
  Not even obvious improvements. If you spot something wrong, report it.
- **The insurance gates.** They are specified in `docs/INSURANCE_CONTROL_SET.md` but are
  **not** built here, and that spec is still awaiting attorney review of its blocking
  rules.
- **Deciding what "simple" means.** `HORSE_LEASE_SIMPLE` is created as a full copy and
  trimmed later, once the owner specs it.
- **Retiring `HORSE_LEASE_V2`.**

## Constraints

- Work in your **own git worktree** off `origin/main`.
- **`ClauseDocument.tsx` is FROZEN.** Nothing here should need it.
- Migrations: dry-run in `BEGIN … ROLLBACK` and show the raw output, then apply.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.
- Typecheck and lint clean before reporting.

## Verification before reporting

1. Fidelity evidence for all three clones (counts + checksums + gate comparison), raw.
2. Confirm the original `HORSE_LEASE_V2` row, its content rows, and the 4 live documents
   are **unchanged** — same id, same counts, same checksums as before you started.
3. Confirm a lease started with no template argument still produces `HORSE_LEASE_V2`.
4. (After Phase 3 approval) Confirm a lease started against each fork produces a document
   with that fork's content.

## Reporting

`docs/reports/TASK-LEASEFORK-REPORT.md`. State what you verified with your own eyes
versus what you assume. Raw output for every fidelity and safety claim.
