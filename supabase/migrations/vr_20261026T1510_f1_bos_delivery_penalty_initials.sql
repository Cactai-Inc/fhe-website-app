-- VALIDATION ROUND — F1 (bill of sale): obligation initials for the delivery
-- delay penalties on HORSE_BILL_OF_SALE's gated delivery timeline clause.
--
-- BOS_DELIVERY.TIMELINE is itself gated (shown only when the sale has no
-- accompanying agreement AND the delivery-timeline terms are included). It carries
-- the same two penalties as the sale:
--   · {{TXN.BOARD_RATE_AFTER}}    — buyer pays board/day on a buyer-caused late pickup
--   · {{TXN.SELLER_DELAY_PENALTY}} — seller pays/day on a seller-caused late delivery
-- F1: when a penalty is above zero the obligated party initials a line accepting it.
-- Board rate → BUYER (+ co-buyer alongside); seller-delay penalty → SELLER.
--
-- The derived ">0" gate fields (TXN.HAS_BOARD_RATE_AFTER / TXN.HAS_SELLER_DELAY_PENALTY)
-- are computed in recompose_document_fields by the sale F1 migration
-- (vr_20261026T1500) — that function is shared across all clause-engine templates,
-- so this migration only adds the BOS clauses/fields and gates them on the SAME
-- derived fields, ANDed with the TIMELINE clause's own include gate so an ack line
-- never shows when the timeline clause is hidden.
--
-- Ownership of the amount fields is unchanged. Wording/composition changed →
-- version bump + snapshot (D34).

BEGIN;

-- Guard: the derived gates must already be computed in recompose_document_fields.
DO $guard$
BEGIN
  IF position('TXN.HAS_BOARD_RATE_AFTER' IN pg_get_functiondef('public.recompose_document_fields'::regproc)) = 0 THEN
    RAISE EXCEPTION 'apply vr_20261026T1500 (sale F1) first — it adds the derived >0 gates to recompose_document_fields';
  END IF;
END $guard$;

-- The TIMELINE clause's own include gate, reused on each ack line.
-- (TXN.BOS_HAS_SALE_AGREEMENT = NO AND TXN.BOS_INCLUDE_DELIVERY_TIMELINE = YES)
-- BOS_DELIVERY has a gap: TIMELINE=15, RISK=20 → ack lines slot at 16, 17, 18.

-- ── Buyer initials line — board rate above zero ─────────────────────────────────
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES
  ('HORSE_BILL_OF_SALE', 'BOS_DELIVERY', 'BOS_DELIVERY.TIMELINE_BOARD_ACK', NULL,
   'Buyer acknowledges and accepts the obligation to pay board and care for the Horse at the rate stated above if Buyer fails to take delivery on time. Initialed: {{ACK.BOS_DELIVERY_BOARD}}',
   'input', 16, false,
   '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.BOS_INCLUDE_DELIVERY_TIMELINE"}, {"equals": ["YES"], "field_key": "TXN.HAS_BOARD_RATE_AFTER"}]}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, sort_order, guidance, system_settable)
VALUES
  ('HORSE_BILL_OF_SALE', 'ACK.BOS_DELIVERY_BOARD', 'Buyer initials', 'BOS_DELIVERY', 'BUYER',
   'text', 'text', true, false, 'initials', 'BOS_DELIVERY.TIMELINE_BOARD_ACK',
   '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.BOS_INCLUDE_DELIVERY_TIMELINE"}, {"equals": ["YES"], "field_key": "TXN.HAS_BOARD_RATE_AFTER"}]}'::jsonb, 16,
   'Type your initials to accept this obligation. Your initials must match your name on this document.', true)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- Co-buyer alongside the buyer — board rate above zero AND co-buyer exists.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES
  ('HORSE_BILL_OF_SALE', 'BOS_DELIVERY', 'BOS_DELIVERY.TIMELINE_BOARD_ACK_CB', NULL,
   'Co-Buyer acknowledges and accepts the same obligation. Initialed: {{ACK.BOS_DELIVERY_BOARD_COBUYER}}',
   'input', 17, false,
   '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.BOS_INCLUDE_DELIVERY_TIMELINE"}, {"equals": ["YES"], "field_key": "TXN.HAS_BOARD_RATE_AFTER"}, {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}]}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, sort_order, guidance, system_settable)
VALUES
  ('HORSE_BILL_OF_SALE', 'ACK.BOS_DELIVERY_BOARD_COBUYER', 'Co-Buyer initials', 'BOS_DELIVERY', 'COBUYER',
   'text', 'text', true, false, 'initials', 'BOS_DELIVERY.TIMELINE_BOARD_ACK_CB',
   '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.BOS_INCLUDE_DELIVERY_TIMELINE"}, {"equals": ["YES"], "field_key": "TXN.HAS_BOARD_RATE_AFTER"}, {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}]}'::jsonb, 17,
   'Type your initials to accept this obligation. Your initials must match your name on this document.', true)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- ── Seller initials line — seller-delay penalty above zero ──────────────────────
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES
  ('HORSE_BILL_OF_SALE', 'BOS_DELIVERY', 'BOS_DELIVERY.TIMELINE_SELLER_ACK', NULL,
   'Seller acknowledges and accepts the obligation to pay the per-day penalty stated above if Seller delays delivery of the Horse. Initialed: {{ACK.BOS_DELIVERY_SELLER}}',
   'input', 18, false,
   '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.BOS_INCLUDE_DELIVERY_TIMELINE"}, {"equals": ["YES"], "field_key": "TXN.HAS_SELLER_DELAY_PENALTY"}]}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, sort_order, guidance, system_settable)
VALUES
  ('HORSE_BILL_OF_SALE', 'ACK.BOS_DELIVERY_SELLER', 'Seller initials', 'BOS_DELIVERY', 'SELLER',
   'text', 'text', true, false, 'initials', 'BOS_DELIVERY.TIMELINE_SELLER_ACK',
   '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.BOS_INCLUDE_DELIVERY_TIMELINE"}, {"equals": ["YES"], "field_key": "TXN.HAS_SELLER_DELAY_PENALTY"}]}'::jsonb, 18,
   'Type your initials to accept this obligation. Your initials must match your name on this document.', true)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- ── Version bump + composition snapshot (D34), as the admin test account ─────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b85d562f-aad0-4cd7-9df9-6fbc58caff13', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT save_contract_template_version('HORSE_BILL_OF_SALE', NULL, NULL, NULL);
RESET ROLE;

COMMIT;
