-- TASK LOCFIX defect 2: "Location of the Horse: {{HORSE.CURRENT_LOCATION}}" ran the
-- (potentially long, multi-part) read-only address value onto the SAME line as
-- its intro text. HORSE.CURRENT_LOCATION is a HORSE.* token, so it renders as a
-- plain read-only TokenValue (owner directive 2026-08-03, imported-record tokens
-- are locked/read-only) with no self-label — the ONLY visible label is this
-- clause body's own intro text. The clause matched ClauseDocument.tsx's
-- MATRIX_LINE ("Label: {{token}}" on one line), which lays label + value out as
-- a single flex row (see ClauseDocument.tsx isWideCell/cell()) — correct for the
-- short HORSE.* values it was designed for (Breed, Color, …), wrong for a
-- multi-part facility+street+city/state/zip value.
--
-- Fix: split the clause body onto two lines. The intro text becomes its own
-- prose line (no token -> not a MATRIX_LINE); the token becomes its own
-- token-only prose line, which renders as its own paragraph below the intro,
-- left-aligned, full width. No component/rendering-layer change.
--
-- Verified content-neutral: remerge_contract_from_clauses (composer) processes
-- clause body ONE LINE AT A TIME already (see 20260804020001_trailing_period_at_compose.sql)
-- and appends terminal punctuation per-line at compose time (R5, 2026-08-04) —
-- splitting this body onto two lines does not change the composed legal text
-- beyond the added line break; the value and its punctuation compose exactly as
-- before, just on the next line.
UPDATE contract_clause_defs
   SET body = 'Location of the Horse:' || E'\n' || '{{HORSE.CURRENT_LOCATION}}'
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key = 'LOCATION.MAIN'
   AND body = 'Location of the Horse: {{HORSE.CURRENT_LOCATION}}';
