# TASK R10 — Variant-group presentation: placeholder first, previews unnumbered

Branch: `task/r10-variant-groups` (from current main).
Scope: exactly this document.

## Problem
Mutually-exclusive clause variants (e.g. HORSE injury history: NONE / DISCLOSED /
PENDING placeholder) render in the contract editor as three consecutively
NUMBERED items (3.10, 3.11, 3.12) with the [Pending …] placeholder LAST. In the
merged document exactly ONE of them exists and takes the single number, so the
editor numbering is wrong, and the ordering reads backwards to a reviewing party.

## Fix 1 — data: placeholder sorts FIRST in each variant group
In `contract_clause_defs` (template HORSE_LEASE_V2), for each pending-placeholder
clause (body starts with `[Pending`), set its sort_order to come immediately
BEFORE its sibling variants (same section, same driving field). Known groups:
- HORSE.INJURY_HISTORY_PENDING before HORSE.INJURY_HISTORY_NONE / _DISCLOSED
- TRAINING_LESSONS.PENDING before TRAINING_LESSONS.LESSONS / LESSONS_ENTITY
- LESSEE_REPS.PENDING before MAIN_INDIVIDUAL / MAIN_ENTITY
- DEFINITIONS.LESSOR_PENDING before LESSOR_IND / LESSOR_ENT; same for LESSEE_*
- PURPOSE section: find the purpose pending clause and its variants the same way.
Verify each group's live sort orders with psql (`psql "$(cat .env.db)"`) BEFORE
updating; write one idempotent migration with guarded UPDATEs (WHERE current
sort_order = expected). If a group's live shape differs from the list above,
report it and adjust to the same pattern rather than stopping.

## Fix 2 — renderer: muted previews consume NO number
`src/components/app/ClauseDocument.tsx`, in the section clause loop:
- A clause that is gated OFF (rendered as muted preview) must NOT increment
  clauseNo and must NOT display a number. Only gated-ON clauses consume
  numbers. (This restores editor↔merge number correspondence; the previous
  behavior of skipping numbers entirely for gated-on headingless clauses was
  already fixed and must stay fixed — gated-ON clauses always number.)
- The ACTIVE placeholder (unanswered question) IS gated on, so it takes the
  group's number — correct and desired.
- Muted preview headings render title-only (no number), keeping their gold
  caption above them.

## Fix 3 — placeholder copy
Update the three [Pending …] bodies for the KNOWN groups above (clause bodies in
contract_clause_defs, same migration) to this pattern, preserving meaning:
"[This section is completed by the <role word> selection above. The applicable
statement below replaces this placeholder once the selection is made; signing is
blocked until then.]"
Use the actual driving question's role owner word (Lessor/Lessee) per group.
Do NOT touch any other clause bodies.

## Done-checks (raw output in report)
- psql: per group, placeholder sort < variants' sorts, all unchanged elsewhere
  (paste before/after rows).
- Remerge the live draft `215bac09-9f66-43ce-8655-85fd05fea1e2` (RPC
  remerge_contract_from_clauses under the admin jwt pattern used in migrations
  20260803* — see 20260804050000 for the psql session shape) and paste the §3
  region showing a single correctly-numbered item where the injury group is.
- typecheck 0 errors, lint 0 errors.
- Editor logic: paste the changed ClauseDocument lines and reason through the
  three states (unanswered → placeholder numbered active, variants muted
  unnumbered below; answered → chosen variant numbered, others muted unnumbered,
  placeholder suppressed entirely — suppression already exists via
  isUnansweredPlaceholder, do not break it).

## Report
docs/reports/TASK-R10-REPORT.md on your branch; file:line per change, raw
outputs, retries/failures, deviations. Print only report path + branch.
