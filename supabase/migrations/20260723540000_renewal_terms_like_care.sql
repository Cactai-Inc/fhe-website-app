-- Renewal terms: make the "Include renewal terms" checkbox behave like the CARE
-- section toggles — the checkbox drives whether the Renewal Terms clause appears,
-- but the checkbox statement itself is NOT rendered as its own numbered line in the
-- final document. Move the checkbox field onto the content clause as its authoring
-- control and retire the toggle-only clause.

-- The renewal content clause is already gated on TXN.RENEWAL_INCLUDE = YES; just
-- re-home the checkbox field onto it (so authors can still toggle it there).
UPDATE contract_field_defs
   SET clause_key = 'TERM.RENEWAL'
 WHERE template_key='HORSE_LEASE_V2' AND field_key='TXN.RENEWAL_INCLUDE';

-- Retire the toggle-only clause (its bare {{TXN.RENEWAL_INCLUDE}} statement).
DELETE FROM contract_clause_defs
 WHERE template_key='HORSE_LEASE_V2' AND clause_key='TERM.RENEWAL_TOGGLE';
