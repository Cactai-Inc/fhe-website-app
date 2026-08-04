# TASK R11 — Heading-derived numbering + Add-item rebuild

Branch: `task/r11-numbering-additem` (from current main).
Scope: exactly this document. Supersedes the deleted TASK-R10 (never executed);
its still-valid pieces are folded in below.
Two phases, one commit per phase.

════════════════════════════════════════════════════════════════════════════
PHASE A — NUMBERING DERIVES FROM HEADINGS (enforceability fix)
════════════════════════════════════════════════════════════════════════════

## The model (owner ruling, final)
- A section Title (`contract_section_defs.heading`) declares N → "3. The Horse".
- A Header (a clause WITH a non-empty heading) increments the sub-number → "3.1".
- A clause WITHOUT a heading is CONTINUATION of the item above it: no number,
  no increment. If headingless clauses precede the first header in a section,
  they are section preamble under "N. Title", unnumbered.
- Muted (gated-off) preview clauses NEVER number and NEVER increment.
- A heading that duplicates its section heading still numbers but suppresses
  the repeated words (existing behavior — keep).
- Numbers are order-derived, so insertion/renumbering is automatic.

## A1 — renderer: src/components/app/ClauseDocument.tsx
In the section clause loop: increment clauseNo ONLY for gated-ON clauses with a
non-empty heading. Gated-on headingless clauses render their content with no
number line (they visually attach to the item above). Muted previews render
title-only + gold caption, never a number. The active [Pending] placeholder of a
variant group HAS a heading after A3 below, so it numbers normally.

## A2 — merge: remerge_contract_from_clauses
Same rule in SQL. Currently v_cl_no increments per clause and headingless
clauses get '§CLAUSENUM§.<n>' prefixed onto their first body line — that is the
defect. Change: headed clause → emit "§CLAUSENUM§.<m> <heading>" then body;
headingless clause → emit body lines with NO number (continuation). The existing
render_as_subitem append-to-previous behavior stays as-is for rows that use it.
Procedure: dump live function via pg_get_functiondef, patch with anchored
replaces (paste live body in report before replacing), ship as a new migration,
apply, remerge live draft `215bac09-9f66-43ce-8655-85fd05fea1e2` (admin jwt
psql pattern — copy from migration 20260804050000), paste the §3 and §9-§10
regions before/after in the report.

## A3 — data pass (one idempotent migration, guarded verify-first UPDATEs)
Template HORSE_LEASE_V2, contract_clause_defs:
1. HORSE.IDENTITY heading: 'Horse' → 'Horse Details'.
2. Variant groups — placeholder sorts FIRST and gets the group heading; variants
   follow headingless (they inherit no number; captions identify them):
   - HORSE.INJURY_HISTORY_PENDING: sort before NONE/DISCLOSED; heading
     'Serious Injury History'; body →
     '[This section is completed by the Lessor's selection above. The
     applicable statement replaces this placeholder once the selection is
     made; signing is blocked until then.]'
     NONE and DISCLOSED: keep headings (they render as muted titles via
     captions) — but set them headingless? NO: keep their headings; the
     renderer numbers only gated-ON headed clauses, and when one variant is
     active it takes the number, which is correct (exactly one is ever active).
   - Same pattern for: TRAINING_LESSONS.PENDING (heading 'Lessons'),
     LESSEE_REPS.PENDING (heading "Lessee's Representations"), the PURPOSE
     pending clause, DEFINITIONS.LESSOR_PENDING / LESSEE_PENDING (these are
     preamble-position variants: headingless section content — placeholder
     first, no headings on any of the definitions variants).
   Verify each group's live rows (sort_order, heading, body) BEFORE updating;
   guard every UPDATE on current values; report any group whose live shape
   differs and adapt to the same pattern.
3. LOCATION block (now inside HORSE section): one header total. LOCATION.MAIN
   heading → 'Location'; MOVE_CHOICE, NEW, INSPECTION stay headingless
   (continuation under 3.x Location).
4. Verify (report-only) that no OTHER gated-ON headingless clause in
   HORSE_LEASE_V2, HORSE_SALE_V2, HORSE_BILL_OF_SALE ends up orphaned as
   preamble where it reads wrongly — list each headingless clause and the
   header it will attach under; flag any that read wrong, do not fix beyond
   this spec.

## A done-checks
- Remerged live draft: every number corresponds to a heading; multi-line blocks
  share one number; paste regions as evidence.
- Editor reasoning: paste changed loop; walk the three variant states.
- typecheck 0, lint 0. Commit Phase A.

════════════════════════════════════════════════════════════════════════════
PHASE B — ADD-ITEM REBUILD (three rows + inline elements)
════════════════════════════════════════════════════════════════════════════

## B0 — verify-first
Trace the existing add surface: src/components/app/AddElementModal.tsx, its
RPCs (addContractElement / proposeClause in src/lib/contracts.ts), and how
custom sections/fields store (CUSTOM.* contract_fields; customBySection in
ClauseDocument). Report what exists. REUSE the storage/RPCs; extend them only
where this spec requires; never a parallel system.

## B1 — modal: three rows, helper text above each
Row 1 SECTION: combo — select an existing section (name + number) OR type a new
Title; when new, a position selector (1..N+1) chooses its number; existing
sections shift (order-derived, so this is just sort placement).
Row 2 HEADER: combo scoped to the chosen section — select existing header
(number + words) OR type a new Header; position selector for new (default: end
of section).
Row 3 CONTENT: a STACK of independently-authored lines, not one textarea.
Starts with one blank line. Below the stack, a [+] button offering exactly two
choices: 'Add a line' (new blank content line) and 'Add a condition' (a
CONDITION SEPARATOR). Lines can be reordered (up/down) and removed.
Default insertion point of the whole addition: end of that header's content.

## B2 — inline elements (chip model)
Above Row 3, three buttons: [Dropdown] [Buttons] [Text field]. Clicking inserts
an ATOMIC CHIP inline at the cursor — one object, not editable text; backspace
removes the whole chip (this is the error-proofing: element syntax can never be
half-deleted or hand-mangled). Typing around chips is plain typing. No closing
period required — the composer already appends terminal punctuation (R5 rule).
Config opens in a POPOVER on the chip (click chip → panel), never a stack below
the row, so config is unambiguous with multiple elements per line:
- Dropdown: '+ menu item' rows (label + position), repeatable; placeholder-text
  input for the collapsed state.
- Buttons (multi-select): '+ button' rows, same shape, no placeholder.
- Text field: placeholder-text input; 'Required' toggle (offerable only for a
  text field).
'Other' assist: when a menu item/button is labeled Other (case-insensitive),
show a one-click '+ details field for Other' that appends a Text-field chip
after the element.
LIVE PREVIEW below Row 3: render the line through the SAME components the
contract editor uses (ClauseProse + inline field controls) — the preview is the
real render path, not a simulation.
Storage: each element becomes a CUSTOM field with input_kind select|buttons|text,
options from the config rows, placeholder as guidance, required as flagged;
the content line stores the text with {{CUSTOM.<key>}} tokens where elements
sit — matching how template clauses embed fields. If the existing custom-field
storage cannot hold options/placeholder/required, extend the RPC minimally.

## B3 — conditional visibility via CONDITION SEPARATORS (owner model)
A condition is a SEPARATOR block in the Row-3 stack, not a per-line setting.
- Inserting one (via [+] → 'Add a condition') places a separator line that
  reads like the template's own gold captions: 'Only when [driver] is
  [value(s)]' — driver picked from the Dropdown/Buttons elements already in
  THIS addition, value(s) picked from that element's configured items.
- SCOPE: the separator gates every line BELOW it, until the next separator or
  the end of the stack. Lines above any separator are unconditional. This is
  visually self-evidencing — the stack reads exactly like the rendered
  template does. Multiple lines under one separator = multiple INDEPENDENT
  revealed items from one selection (e.g. 'Yes' reveals three questions).
- GOLD TEXT: the separator carries the caption shown in the document (the gold
  'This is included when…' line). Default: auto-generated from the condition
  ('This is included when “<driver label>” is “<value(s)>”.') and kept in sync
  if the condition changes. An editable text input on the separator lets the
  author override it; an authored override is stored verbatim and no longer
  auto-syncs. Storage: the gated lines' guidance/caption field the renderer
  already displays for gated clauses — reuse it, do not add a parallel one.
- VALUE PICKER RULES: a separator may select ONE OR MORE values of its driver
  ('A or B' → equals/contains list). Values already used by another separator
  stay selectable and are marked 'already used' — the same value may
  legitimately gate more than one block (reading order matters); never hide
  used values.
- Storage: each gated line's conditional_on gets the separator's gate —
  {"equals":[...]} for a dropdown driver, {"contains":[...]} for buttons,
  field_key = the driver's CUSTOM key. No composites, no negation, no
  template-field drivers. The engine (clauseConditionMet /
  clause_condition_met) already evaluates these — write the JSON, add nothing
  to the engine.
- Editor + merge honor it automatically once stored; verify, don't rebuild.

## B4 — executed rendering rule
An empty element at execution renders 'N/A' in the merged/PDF output (composer:
when a CUSTOM field is blank at execution time, substitute 'N/A'). Required
text fields block signing via the existing required-fields lock blocker —
verify CUSTOM fields participate; if not, wire them in.

## B done-checks
- Build a custom addition on the live draft 215bac09… via the new modal path
  (RPC-level is acceptable if UI cannot be driven headless): new header in an
  existing section containing one dropdown (2 items) + one required text field
  + one line gated on the dropdown's second item (B3); remerge twice — driver
  unset, then driver = item 2 — and paste both rendered regions proving the
  gated line appears only in the second; then delete the custom rows and show
  zero residue.
- typecheck 0, lint 0. Commit Phase B. Push branch.

## Report
docs/reports/TASK-R11-REPORT.md: per phase — file:line changes, live-body
pastes before function replacement, raw outputs, retries/failures, deviations.
Print only report path + branch.
