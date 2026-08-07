# TASK LEASEGATE — restriction gates on the standard lease

Add the insurance **restriction gates** to `HORSE_LEASE_STANDARD` — the blocks that stop
an illegal selection being made. Scoped to the **three insurance types that have real
sections today**: General Liability, Major Medical, Equine Mortality.

**Care, Custody & Control is explicitly out of scope.** It is one gated clause, not a
section with elections, and its rework belongs to the comprehensive version.

**Prerequisite:** `TASK-LEASEFORK` must have run. This task operates on
`HORSE_LEASE_STANDARD` and must not touch `HORSE_LEASE_V2`, `HORSE_LEASE_FULL` or
`HORSE_LEASE_SIMPLE`.

---

## What a "block" is, and why it is not a hide

The engine gates **visibility** today: `conditional_on` decides whether a field renders.
A block is different — the control **renders, and refuses**, with the reason shown.

Hiding is the wrong behaviour here and would be worse than doing nothing: a Lessor who
simply cannot see an option never learns why it is unavailable, then meets it again on the
next lease with no explanation. **Show it, refuse it, say why.**

This mirrors the ownership treatment already shipped (a field you don't own is dimmed,
`cursor-help`, with a tooltip naming the owner). Reuse that pattern — no new UI vocabulary.

### The engine change

Two columns on `contract_field_defs`, reusing the **existing** expression evaluator:

| Column | Type | Meaning |
|---|---|---|
| `blocked_when` | `jsonb` | Same grammar as `conditional_on`. True → control renders disabled |
| `blocked_reason` | `text` | Shown on the disabled control |

Our grammar, for the avoidance of doubt — confirm against live rows before writing:

```json
{"equals": ["PARTIAL"], "field_key": "TXN.LEASE_TYPE"}
{"all": [ {...}, {...} ]}
{"any": [ {...}, {...} ]}
```

Do **not** invent `{"field":…,"operator":…,"value":…}` or an `action`/`render_message`
shape. That is not this system's grammar and will not evaluate.

---

## The three blocks in scope

| # | Applies to | Condition | Reason text (verbatim) |
|---|---|---|---|
| B1 | Lessor requiring Lessee to carry **mortality** | `TXN.LEASE_TYPE = PARTIAL` | *Prohibited: Underwriting guidelines prevent partial lessees from establishing a sole insurable interest for third-party mortality placement.* |
| B2 | Lessee **holding** mortality | `TXN.LEASE_TYPE = PARTIAL` | as B1 |
| B6 | The **GL policy type** offered to the Lessee | `LESSEE.PARTY_TYPE = INDIVIDUAL` | Not a block — an **option filter**. See below. |

**B3 and B4 are CCC and are OUT OF SCOPE.**
**B5 (insurable interest) is OUT OF SCOPE** — owner direction. Do not add
`TXN.LESSOR_INSURABLE_INTEREST` or any question about pecuniary interest.

*Consequence, stated so it is not a surprise:* B5 was the only block touching **major
medical**, so this task ships gates on **mortality (B1, B2)** and **general liability
(B6)** only. Medical elections stay unrestricted. That is intended — the medical gate
needs a new question the owner does not want asked yet.

### B6 is deliberately different in kind

Commercial GL is not sold to individual hobbyists, so it must not appear as a choice. But
the *field itself* remains legitimately selectable — the Lessor may still require personal
horse-owner or private-rider liability. So B6 **narrows the option list**; it does not
disable the control. Conflating the two would refuse a field the Lessor is entitled to use.

### This task adds NO new fields

Every gate here restricts a control that already exists. If you conclude a block cannot be
built without adding a field, **stop and report** — do not add one.

---

## Out of scope — do not build

- **CCC** in any form.
- **Mandatory elections** (forcing an election *on*). This task only prevents illegal
  selections; it never forces one.
- The **high-value asset matrix**, the **no-fault expense allocation**, **policy detail
  capture**, **lapse remedies**, **new disclosures**. All belong to the comprehensive
  version.
- The three known field defects (jump height free text, split-percentage validation,
  `Other` follow-ups) — real, but separately queued. Do not repair them here; the
  blocks do not depend on them.

If you believe a block cannot be built without something on this list, **stop and report**
rather than widening scope.

---

## Verification

The failure mode is silent — a gate that never fires looks exactly like a gate that
works. Prove each of the three, and prove the negative:

1. **Each block fires.** Set the triggering condition; confirm the control renders,
   is disabled, and shows the exact reason text.
2. **Each block stays off when it should.** Change the condition; confirm the control is
   fully usable. A block that is always on is as broken as one that never fires.
3. **B6 filters rather than disables.** With an individual Lessee, commercial GL is absent
   from the options *and* the field is still selectable.
4. **The other three templates are untouched.** `HORSE_LEASE_V2`, `HORSE_LEASE_FULL` and
   `HORSE_LEASE_SIMPLE` — same row counts, same checksums as before you started.
5. **Render a sample lease** on `HORSE_LEASE_STANDARD` in a configuration where blocks
   fire, and one where none do. Both go in the report. This is the owner's review artifact.

## Constraints

- Own git worktree off `origin/main`.
- **`ClauseDocument.tsx` is FROZEN.** If the disabled-control rendering genuinely requires
  changing it, **stop and report with the exact diff you would need** — do not apply it.
- Migrations: dry-run in `BEGIN … ROLLBACK` with raw output shown, then apply.
- Sarah's document `704c8d2d-…` is a live negotiation — read-only, never write.
- Typecheck and lint clean.

## Reporting

`docs/reports/TASK-LEASEGATE-REPORT.md`. Raw output for every claim. State what you
verified with your own eyes versus what you assume.
