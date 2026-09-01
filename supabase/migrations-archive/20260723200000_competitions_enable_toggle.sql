-- §15 Competitions: add an in-section enable checkbox.
--
-- The Competitions clauses were gated only on "Competitions" being checked back in
-- §11 Permitted Activities — a remote, non-obvious control, so from §15 the whole
-- section reads as grayed-out with no way to enable it. Add a checkbox at the top
-- of the section (like the §13 care toggles) that includes the section directly.
-- Gate the clauses on EITHER the checkbox OR the §11 activity, so an existing doc
-- that selected Competitions in §11 still shows the section.

-- toggle clause (control token renders empty; first line of the section)
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order)
VALUES
  ('HORSE_LEASE_V2', 'COMPETITIONS', 'COMPETITIONS.TOGGLE', NULL, '{{TXN.COMPETITIONS_INCLUDE}}', 1)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key = EXCLUDED.section_key, body = EXCLUDED.body, sort_order = EXCLUDED.sort_order;

INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type,
   owner_role, required, is_optional, sort_order, guidance)
VALUES
  ('HORSE_LEASE_V2', 'TXN.COMPETITIONS_INCLUDE', 'COMPETITIONS.TOGGLE', 'COMPETITIONS',
   'Include competition terms in this lease.',
   'certify', 'checkbox', 'certify',
   'LESSOR', false, true, 1,
   'Checking this box adds the Competitions section (permission to compete, plus expenses and winnings). Leaving it unchecked omits it.')
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, input_kind = EXCLUDED.input_kind, value_type = EXCLUDED.value_type,
      format_type = EXCLUDED.format_type, clause_key = EXCLUDED.clause_key, guidance = EXCLUDED.guidance,
      sort_order = EXCLUDED.sort_order, required = EXCLUDED.required, is_optional = EXCLUDED.is_optional;

-- gate the competition clauses on the checkbox OR the §11 Competitions activity
UPDATE contract_clause_defs
   SET conditional_on = '{"any": [{"equals": ["YES"], "field_key": "TXN.COMPETITIONS_INCLUDE"}, {"contains": ["COMPETITIONS"], "field_key": "TXN.PERMITTED_ACTIVITIES"}]}'::jsonb
 WHERE template_key = 'HORSE_LEASE_V2' AND clause_key IN ('COMPETITIONS.INTRO','COMPETITIONS.TERMS');
