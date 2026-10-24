-- Phase 30: Part 3.2 — lease type (add Full lease) + sublease. After disc_18-29.
--
-- Full lease hides the usage schedule section automatically: every SCHEDULE clause
-- is already gated on TXN.LEASE_TYPE = PARTIAL, so a FULL value simply does not
-- satisfy them. A sublease selector (sublease only — never "assign") appears only
-- when Full lease is selected, with three states and a pending placeholder.

-- Add the Full lease option.
UPDATE contract_field_defs
   SET options = '[{"label":"Partial lease (shared or limited access)","value":"PARTIAL"},{"label":"Full lease (exclusive use)","value":"FULL"}]'::jsonb
 WHERE template_key='HORSE_LEASE_V3' AND field_key='TXN.LEASE_TYPE';

-- Pending placeholder for lease type (it is required).
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_LEASE_V3','PURPOSE','PURPOSE.LEASE_TYPE_PENDING', NULL,
        '[Pending — select whether this is a partial or full lease. This placeholder is replaced by the applicable term and blocks signing.]',
        'input', (SELECT sort_order FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V3' AND clause_key='PURPOSE.LEASE_TYPE') - 1,
        false, '{"equals": [""], "field_key": "TXN.LEASE_TYPE"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- Sublease selector + gate carrier, shown only when Full lease. Required, pending.
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_LEASE_V3','PURPOSE','PURPOSE.SUBLEASE_GATE', NULL, '', 'input',
        (SELECT sort_order FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V3' AND clause_key='PURPOSE.LEASE_TYPE') + 1,
        false, '{"equals": ["FULL"], "field_key": "TXN.LEASE_TYPE"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, options, guidance)
VALUES ('HORSE_LEASE_V3','TXN.SUBLEASE','Subleasing','PURPOSE','DEAL','select','select', true, false, 'select', 'PURPOSE.SUBLEASE_GATE',
        '{"equals": ["FULL"], "field_key": "TXN.LEASE_TYPE"}'::jsonb,
        '[{"label":"Permitted without restriction","value":"PERMITTED"},{"label":"Permitted on stated conditions","value":"CONDITIONAL"},{"label":"Not permitted","value":"NOT_PERMITTED"}]'::jsonb,
        'Whether the Lessee may sublease the Horse (applies to a full lease only).')
ON CONFLICT (template_key, field_key) DO NOTHING;

INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
VALUES ('HORSE_LEASE_V3','TXN.SUBLEASE_CONDITIONS','Sublease conditions','PURPOSE','DEAL','longtext','text', false, true, 'longtext', 'PURPOSE.SUBLEASE_CONDITIONAL',
        '{"all": [{"equals": ["FULL"], "field_key": "TXN.LEASE_TYPE"}, {"equals": ["CONDITIONAL"], "field_key": "TXN.SUBLEASE"}]}'::jsonb,
        'The conditions under which subleasing is permitted.')
ON CONFLICT (template_key, field_key) DO NOTHING;

-- The three sublease clauses + a pending placeholder. Each shown only when Full
-- lease AND its value (or blank for pending).
DO $sub$
DECLARE v_base int;
BEGIN
  SELECT sort_order + 2 INTO v_base FROM contract_clause_defs WHERE template_key='HORSE_LEASE_V3' AND clause_key='PURPOSE.LEASE_TYPE';
  INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem) VALUES
   ('HORSE_LEASE_V3','PURPOSE','PURPOSE.SUBLEASE_PENDING', NULL,
    '[Pending — select whether subleasing is permitted. This placeholder is replaced by the applicable term and blocks signing.]',
    'input', v_base, false,
    '{"all": [{"equals": ["FULL"], "field_key": "TXN.LEASE_TYPE"}, {"equals": [""], "field_key": "TXN.SUBLEASE"}]}'::jsonb, false),
   ('HORSE_LEASE_V3','PURPOSE','PURPOSE.SUBLEASE_PERMITTED', NULL,
    'Lessee may sublease the Horse without Lessor''s further consent.',
    'input', v_base+1, false,
    '{"all": [{"equals": ["FULL"], "field_key": "TXN.LEASE_TYPE"}, {"equals": ["PERMITTED"], "field_key": "TXN.SUBLEASE"}]}'::jsonb, false),
   ('HORSE_LEASE_V3','PURPOSE','PURPOSE.SUBLEASE_CONDITIONAL', NULL,
    'Lessee may sublease the Horse only on the following conditions: {{TXN.SUBLEASE_CONDITIONS}}.',
    'input', v_base+2, false,
    '{"all": [{"equals": ["FULL"], "field_key": "TXN.LEASE_TYPE"}, {"equals": ["CONDITIONAL"], "field_key": "TXN.SUBLEASE"}]}'::jsonb, false),
   ('HORSE_LEASE_V3','PURPOSE','PURPOSE.SUBLEASE_NOT_PERMITTED', NULL,
    'Lessee may not sublease the Horse, in whole or in part, without Lessor''s prior written consent.',
    'input', v_base+3, false,
    '{"all": [{"equals": ["FULL"], "field_key": "TXN.LEASE_TYPE"}, {"equals": ["NOT_PERMITTED"], "field_key": "TXN.SUBLEASE"}]}'::jsonb, false)
  ON CONFLICT (template_key, clause_key) DO NOTHING;
END $sub$;
