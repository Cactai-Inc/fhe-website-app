-- Fix round 3, item 7(i) — on the bill of sale, put the delivery-delay penalties
-- behind one include gate, default not included.
--
--   · new field TXN.BOS_INCLUDE_DELIVERY_TIMELINE (Yes/No, default No) — "Include
--     delivery timeline terms".
--   · a new clause BOS_DELIVERY.TIMELINE renders the delay terms, gated on the sale
--     having no accompanying agreement AND the include being Yes.
--   · TXN.BOARD_RATE_AFTER moves out of the plain delivery sentence into that gated
--     clause, owner SELLER (same as the sale: the seller sets it).
--   · TXN.SELLER_DELAY_PENALTY is added, owner BUYER (same as the sale: the buyer
--     sets it), gated the same way.
--
-- The sale's own BOARD_RATE_AFTER / SELLER_DELAY_PENALTY are left as they are
-- (unchanged — HORSE_SALE_V3). Wording changed, so the template version is bumped
-- and snapshotted (D34).

BEGIN;

-- 1. the include gate field
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, clause_key, owner_role, input_kind,
   value_type, format_type, options, required, is_optional, sort_order,
   conditional_on, guidance, system_settable)
VALUES
  ('HORSE_BILL_OF_SALE', 'TXN.BOS_INCLUDE_DELIVERY_TIMELINE',
   'Include delivery timeline terms', 'BOS_DELIVERY', 'BOS_DELIVERY.TIMELINE',
   'DEAL', 'select', 'select', 'select',
   '[{"label":"Yes","value":"YES"},{"label":"No","value":"NO"}]'::jsonb,
   false, true, 6105,
   '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb,
   'Add board-rate-on-late-delivery and seller-delay penalty terms. Off by default.',
   true)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- 2. the gated clause carrying both penalties
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order,
   is_optional, conditional_on)
VALUES
  ('HORSE_BILL_OF_SALE', 'BOS_DELIVERY', 'BOS_DELIVERY.TIMELINE',
   'Delivery timeline',
   'If Buyer fails to take delivery within 7 days of the agreed date other than due to Seller''s delay, Buyer shall pay board and care for the Horse at {{TXN.BOARD_RATE_AFTER}} per day until delivery occurs, and risk of loss passes to Buyer on the 8th day. If Seller fails to deliver the Horse within 7 days of the agreed date other than due to Buyer''s delay, Seller shall pay Buyer {{TXN.SELLER_DELAY_PENALTY}} per day until delivery occurs.',
   'input', 15, true,
   '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.BOS_INCLUDE_DELIVERY_TIMELINE"}]}'::jsonb)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- 3. drop the board-rate sentence from the plain delivery clause (it now lives in
--    the gated clause). Idempotent: the exact sentence is removed if present.
UPDATE contract_clause_defs
   SET body = replace(body,
     ' If Buyer fails to take delivery within 7 days of the agreed date other than due to Seller''s delay, Buyer shall pay board and care for the Horse at {{TXN.BOARD_RATE_AFTER}} per day until delivery occurs, and risk of loss passes to Buyer on the 8th day.',
     '')
 WHERE template_key = 'HORSE_BILL_OF_SALE' AND clause_key = 'BOS_DELIVERY.TERMS';

-- 4. re-home BOARD_RATE_AFTER into the gated clause, owner SELLER
UPDATE contract_field_defs
   SET owner_role = 'SELLER', clause_key = 'BOS_DELIVERY.TIMELINE', sort_order = 6106,
       conditional_on = '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.BOS_INCLUDE_DELIVERY_TIMELINE"}]}'::jsonb
 WHERE template_key = 'HORSE_BILL_OF_SALE' AND field_key = 'TXN.BOARD_RATE_AFTER';

-- 5. add SELLER_DELAY_PENALTY, owner BUYER
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, clause_key, owner_role, input_kind,
   value_type, format_type, required, is_optional, sort_order, conditional_on,
   system_settable)
VALUES
  ('HORSE_BILL_OF_SALE', 'TXN.SELLER_DELAY_PENALTY', 'Seller-delay penalty (per day)',
   'BOS_DELIVERY', 'BOS_DELIVERY.TIMELINE', 'BUYER', 'currency', 'currency', 'currency',
   false, true, 6107,
   '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["YES"], "field_key": "TXN.BOS_INCLUDE_DELIVERY_TIMELINE"}]}'::jsonb,
   true)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- 6. wording changed → snapshot + version bump (D34). save_contract_template_version
--    snapshots the outgoing version, increments to the next, and snapshots the new
--    composition (clause/field defs) — so it must run AFTER the DML above. It
--    requires admin; run it as the admin test account for this one call.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b85d562f-aad0-4cd7-9df9-6fbc58caff13', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT save_contract_template_version('HORSE_BILL_OF_SALE', NULL, NULL, NULL);
RESET ROLE;

COMMIT;
