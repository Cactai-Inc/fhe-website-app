-- ─────────────────────────────────────────────────────────────────────────────
-- REMOVE ALL GUIDANCE BUBBLES (2026-07-31, owner)
--
-- 97 info bubbles across sections, clauses and fields are cleared. The UI that
-- rendered them is gone in the same commit, so this removes the data behind a
-- surface that no longer exists rather than orphaning it.
--
-- Imported fields keep a source TIP instead — on hover/focus, naming the record
-- the value comes from. That is the fact worth surfacing: guidance said what a
-- field meant, the tip says where to go when it is wrong.
--
-- THREE FIELDS USED `guidance` AS FUNCTIONAL TEXT, not as a bubble — a button
-- label ("Add Co-Owner"), a party-picker placeholder, and a textarea
-- placeholder. Those three read from `label` now, so clearing this column does
-- not silently blank a control's text. Found by grepping every reader before
-- touching the data, not after.
--
-- The COLUMN stays: AddElementModal still authors guidance when staff add a new
-- field, and the owner is rewriting these as one consolidated block per section.
-- Dropping it would remove the place that work lands.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE contract_section_defs SET guidance = NULL
 WHERE template_key = 'HORSE_LEASE_V2' AND guidance IS NOT NULL;

UPDATE contract_clause_defs SET guidance = NULL
 WHERE template_key = 'HORSE_LEASE_V2' AND guidance IS NOT NULL;

UPDATE contract_field_defs SET guidance = NULL
 WHERE template_key = 'HORSE_LEASE_V2' AND guidance IS NOT NULL;
