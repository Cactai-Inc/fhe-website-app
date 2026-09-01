-- §6 The Horse — reorder clauses: move Ownership (was 6.5) to 6.2, Behavior
-- (was 6.4) to 6.3, and renumber the rest accordingly. New order:
--   6.1 Horse · 6.2 Ownership of Horse · 6.3 Behavior · 6.4 Physical Condition ·
--   6.5 Pre-Lease Veterinary Examination · 6.6 Disclaimer of Warranties.
-- Each gated follow-on (_EXC / _LIMITS) keeps its slot right after its parent.
UPDATE contract_clause_defs SET sort_order = CASE clause_key
    WHEN 'HORSE.IDENTITY'        THEN 10   -- 6.1
    WHEN 'HORSE.OWNERSHIP'       THEN 20   -- 6.2
    WHEN 'HORSE.OWNERSHIP_LIMITS' THEN 22
    WHEN 'HORSE.BEHAVIOR'        THEN 30   -- 6.3
    WHEN 'HORSE.BEHAVIOR_EXC'    THEN 32
    WHEN 'HORSE.CONDITION'       THEN 40   -- 6.4
    WHEN 'HORSE.CONDITION_EXC'   THEN 42
    WHEN 'HORSE.VET_CHECK'       THEN 50   -- 6.5
    WHEN 'HORSE.WARRANTY'        THEN 60   -- 6.6
    ELSE sort_order END
 WHERE template_key = 'HORSE_LEASE_V2' AND section_key = 'HORSE';
