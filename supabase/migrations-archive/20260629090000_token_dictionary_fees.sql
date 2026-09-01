/*
  # FHE CRM — Token Dictionary Extension: brokerage fees (migration 16)

  Additive. The brokering contracts (representation, search/acquisition retainer)
  state a retainer plus a placement/success fee that is "$ flat OR % of value".
  The percentage is the existing {{TXN.COMMISSION_RATE}} (with {{TXN.COMMISSION_MIN}}
  as the floor); this adds the two missing flat-amount tokens. Per the merge
  dictionary's rule, a new field is added to the dictionary before it is used.

  These are per-deal values entered in the Part B engagement form (config holds
  the standard defaults / preset suggestions; the deal may override with a real
  negotiated number). source_table 'transactions' is documentation — that table
  arrives with the Phase 3 flow.
*/

INSERT INTO template_tokens (namespace, field, token, kind, source_table, source_column, computed, required, party_scoped, notes) VALUES
  ('TXN','RETAINER_FEE', '{{TXN.RETAINER_FEE}}', 'field', 'transactions', 'retainer_fee', false, false, false, 'search/representation retainer (Part B engagement form)'),
  ('TXN','SERVICE_FEE',  '{{TXN.SERVICE_FEE}}',  'field', 'transactions', 'service_fee',  false, false, false, 'flat placement/success/representation fee (Part B); the flat alternative to TXN.COMMISSION_RATE')
ON CONFLICT DO NOTHING;
