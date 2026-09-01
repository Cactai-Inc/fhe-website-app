-- §6 Payment Method: add the reverse direction (Lessor → Lessee).
--
-- The section only covered how the LESSEE pays the Lessor. When the Lessor owes
-- the Lessee money (e.g. a prorated refund on early termination, a reimbursement),
-- the accepted method may differ — so mirror the same clause + card-processing
-- detail for the Lessor's payments. The Lessee sets which methods THEY accept
-- (owner_role = LESSEE), mirroring how the Lessor sets theirs.

-- clause: how the Lessor pays the Lessee
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order)
VALUES
  ('HORSE_LEASE_V2', 'PAYMENT_METHOD', 'PAYMENT_METHOD.MAIN_LESSOR', NULL,
   'The Lessor may pay amounts owed under this Agreement by the following method(s): {{TXN.LESSOR_PAYMENT_METHODS}}.',
   30)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key = EXCLUDED.section_key, body = EXCLUDED.body, sort_order = EXCLUDED.sort_order;

-- clause: card processing for the Lessor's card payments (gated the same way)
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, sort_order, conditional_on)
VALUES
  ('HORSE_LEASE_V2', 'PAYMENT_METHOD', 'PAYMENT_METHOD.CARD_LESSOR', NULL,
   'Credit card payments are processed as follows: {{TXN.LESSOR_CARD_PROCESSOR}}.',
   40,
   '{"contains": ["CREDIT_CARD"], "field_key": "TXN.LESSOR_PAYMENT_METHODS"}'::jsonb)
ON CONFLICT (template_key, clause_key) DO UPDATE
  SET section_key = EXCLUDED.section_key, body = EXCLUDED.body,
      sort_order = EXCLUDED.sort_order, conditional_on = EXCLUDED.conditional_on;

-- field: accepted methods for the Lessor's payments — the LESSEE sets these.
INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type,
   owner_role, options, sort_order)
VALUES
  ('HORSE_LEASE_V2', 'TXN.LESSOR_PAYMENT_METHODS', 'PAYMENT_METHOD.MAIN_LESSOR', 'PAYMENT_METHOD',
   'Accepted payment methods', 'buttons', 'checkbox', 'buttons',
   'LESSEE',
   '[{"label":"Cash","value":"CASH"},{"label":"Zelle","value":"ZELLE"},{"label":"Credit Card","value":"CREDIT_CARD"}]'::jsonb,
   30)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, input_kind = EXCLUDED.input_kind, value_type = EXCLUDED.value_type,
      format_type = EXCLUDED.format_type, clause_key = EXCLUDED.clause_key,
      owner_role = EXCLUDED.owner_role, options = EXCLUDED.options, sort_order = EXCLUDED.sort_order;

-- field: card processor & instructions for the Lessor's card payments (Lessee's)
INSERT INTO contract_field_defs
  (template_key, field_key, clause_key, section, label, input_kind, value_type, format_type,
   owner_role, sort_order)
VALUES
  ('HORSE_LEASE_V2', 'TXN.LESSOR_CARD_PROCESSOR', 'PAYMENT_METHOD.CARD_LESSOR', 'PAYMENT_METHOD',
   'Card processor & instructions', 'longtext', 'longtext', 'longtext',
   'LESSEE', 40)
ON CONFLICT (template_key, field_key) DO UPDATE
  SET label = EXCLUDED.label, input_kind = EXCLUDED.input_kind, value_type = EXCLUDED.value_type,
      format_type = EXCLUDED.format_type, clause_key = EXCLUDED.clause_key,
      owner_role = EXCLUDED.owner_role, sort_order = EXCLUDED.sort_order;
