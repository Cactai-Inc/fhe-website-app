-- Phase 26: Part 3.3 (lease ownership restrictions) and Part 3.4 (sale financing).
-- Runs after disc_18-25. Hand-authored per the approved package (2026-10-23).
-- No clause moves: new clauses take the vacated/adjacent sort positions.

-- ── Part 3.3  Lease ownership restrictions ──
-- Replace the free-form question line (HORSE.OWNERSHIP_LIMITS_Q) with a none clause
-- and a disclosed clause, both gated on TXN.HAS_OWNERSHIP_LIMITS, plus a pending
-- placeholder. The field becomes required (pending placeholder blocks signing).
-- The disclosed clause keeps the existing free-text field {{TXN.OWNERSHIP_LIMITATIONS}}.

-- The question-line clause is replaced in place (its sort_order 25 is reused by NONE).
UPDATE contract_clause_defs
   SET body = 'Lessor represents that there are no ownership related restrictions on leasing the Horse.',
       conditional_on = '{"equals": ["NO"], "field_key": "TXN.HAS_OWNERSHIP_LIMITS"}'::jsonb
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.OWNERSHIP_LIMITS_Q';
-- rename the clause key to reflect it is now the NONE clause (keep sort 25). Its
-- only field (TXN.HAS_OWNERSHIP_LIMITS) is moved to the gate carrier below, so the
-- NONE clause ends up field-free, as a none representation should be.
UPDATE contract_clause_defs SET clause_key='HORSE.OWNERSHIP_LIMITS_NONE' WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.OWNERSHIP_LIMITS_Q';

-- Gate carrier: a dedicated empty-body clause that always shows and holds the
-- Yes/No selector, so the author can answer it regardless of which branch prints.
-- (Same pattern as the disclosure gates / PPE.CHOICE_GATE.) Sort 23, before pending.
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_LEASE_V3','HORSE','HORSE.OWNERSHIP_LIMITS_GATE', NULL, '', 'input', 23, false, NULL, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- The yesno field moves to the gate carrier and becomes required (pending blocks sign).
UPDATE contract_field_defs
   SET required = true, clause_key='HORSE.OWNERSHIP_LIMITS_GATE'
 WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.HAS_OWNERSHIP_LIMITS';

-- Disclosed clause: approved wording.
UPDATE contract_clause_defs
   SET body = 'Lessor discloses the following ownership related leasing restrictions: {{TXN.OWNERSHIP_LIMITATIONS}}.'
 WHERE template_key='HORSE_LEASE_V3' AND clause_key='HORSE.OWNERSHIP_LIMITS';

-- Pending placeholder (shown only while the selector is blank), sort just before NONE.
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_LEASE_V3','HORSE','HORSE.OWNERSHIP_LIMITS_PENDING', NULL,
        '[Pending — select whether any ownership related leasing restrictions apply. This placeholder is replaced by the applicable statement and blocks signing.]',
        'input', 24, false, '{"equals": [""], "field_key": "TXN.HAS_OWNERSHIP_LIMITS"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- ── Part 3.4  Sale financing: three options ──
-- Included (existing contingency), Not conditional (existing clause, regated), Not
-- applicable (prints nothing). Required, pending placeholder.
UPDATE contract_field_defs
   SET required = true,
       options = '[{"label":"Included","value":"INCLUDED"},{"label":"Not conditional on financing","value":"NOT_CONDITIONAL"},{"label":"Not applicable","value":"NA"}]'::jsonb
 WHERE template_key='HORSE_SALE_V3' AND field_key='TXN.FINANCING_ELECTION';

-- Regate the existing "not contingent on financing" clause from the dead __RETIRED__
-- sentinel to NOT_CONDITIONAL.
UPDATE contract_clause_defs
   SET conditional_on = '{"equals": ["NOT_CONDITIONAL"], "field_key": "TXN.FINANCING_ELECTION"}'::jsonb
 WHERE template_key='HORSE_SALE_V3' AND clause_key='PRICE.FINANCING_DECLINED';

-- Pending placeholder for financing, just before the INCLUDED clause (sort 69).
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_SALE_V3','PRICE','PRICE.FINANCING_PENDING', NULL,
        '[Pending — select the financing arrangement. This placeholder is replaced by the applicable term and blocks signing.]',
        'input', 69, false, '{"equals": [""], "field_key": "TXN.FINANCING_ELECTION"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;
