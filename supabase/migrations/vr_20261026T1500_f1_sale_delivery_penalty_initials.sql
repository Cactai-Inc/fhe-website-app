-- VALIDATION ROUND — F1 (sale agreement): obligation initials for the delivery
-- delay penalties on HORSE_SALE_V3.
--
-- The sale's DELIVERY.DELAYS clause carries two penalties:
--   · {{TXN.BOARD_RATE_AFTER}}    — buyer pays board/day on a buyer-caused late pickup
--   · {{TXN.SELLER_DELAY_PENALTY}} — seller pays/day on a seller-caused late delivery
-- F1: when a penalty amount is above zero the obligated party initials a line
-- accepting that obligation. Board rate obligates the BUYER (+ co-buyer alongside);
-- the seller-delay penalty obligates the SELLER. Initials are required to sign when
-- their line is present.
--
-- Ownership of the amount fields is unchanged (BOARD_RATE_AFTER = SELLER sets it,
-- SELLER_DELAY_PENALTY = BUYER sets it) — F1 touches who *initials*, not who *sets*.
--
-- "Above zero" is a comparison, and a clause gate does equals/contains only
-- (clause_condition_met). So two derived NONE-owned YES/NO fields are computed in
-- recompose_document_fields (the TXN.TRANSPORT_APPLIES / TXN.LEASE_FEE_PAYABLE
-- precedent) and the ack clauses gate on those. money_numeric() parses the stored
-- currency text to a number.
--
-- Wording/composition changed → version bump + composition snapshot (D34), run as
-- the admin test account, AFTER the DML.

BEGIN;

-- ── 1. Derived ">0" gates, computed in recompose_document_fields ────────────────
-- Added right before the final PERFORM compose_insurance_allocation(...). The block
-- is a no-op on any document that has neither penalty field.
DO $recompose$
DECLARE v_def text; v_anchor text; v_add text;
BEGIN
  SELECT pg_get_functiondef('public.recompose_document_fields'::regproc) INTO v_def;
  IF position('TXN.HAS_BOARD_RATE_AFTER' IN v_def) > 0 THEN RETURN; END IF;

  v_anchor := 'PERFORM compose_insurance_allocation(p_document_id);';
  v_add := $q$  -- F1: derived ">0" gates for the delivery-penalty obligation initials.
  -- A clause gate does equals/contains only, so the "above zero" question is answered
  -- once here and written as an ordinary YES/NO field the gate can read. NONE-owned:
  -- the renderer fills it, no party edits it.
  DECLARE
    v_f1_org uuid; v_f1_board text; v_f1_seller text;
  BEGIN
    SELECT org_id INTO v_f1_org FROM documents WHERE id = p_document_id;
    SELECT value INTO v_f1_board  FROM contract_fields
      WHERE document_id = p_document_id AND field_key = 'TXN.BOARD_RATE_AFTER';
    SELECT value INTO v_f1_seller FROM contract_fields
      WHERE document_id = p_document_id AND field_key = 'TXN.SELLER_DELAY_PENALTY';
    IF v_f1_org IS NOT NULL AND v_f1_board IS NOT NULL THEN
      INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value,
                                   value_type, is_optional, included, sort_order)
      VALUES (v_f1_org, p_document_id, 'TXN.HAS_BOARD_RATE_AFTER', 'NONE',
              CASE WHEN coalesce(money_numeric(v_f1_board), 0) > 0 THEN 'YES' ELSE 'NO' END,
              'text', true, false, 0)
      ON CONFLICT (document_id, field_key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
        WHERE contract_fields.value IS DISTINCT FROM EXCLUDED.value;
    END IF;
    IF v_f1_org IS NOT NULL AND v_f1_seller IS NOT NULL THEN
      INSERT INTO contract_fields (org_id, document_id, field_key, owner_role, value,
                                   value_type, is_optional, included, sort_order)
      VALUES (v_f1_org, p_document_id, 'TXN.HAS_SELLER_DELAY_PENALTY', 'NONE',
              CASE WHEN coalesce(money_numeric(v_f1_seller), 0) > 0 THEN 'YES' ELSE 'NO' END,
              'text', true, false, 0)
      ON CONFLICT (document_id, field_key) DO UPDATE
        SET value = EXCLUDED.value, updated_at = now()
        WHERE contract_fields.value IS DISTINCT FROM EXCLUDED.value;
    END IF;
  END;

  PERFORM compose_insurance_allocation(p_document_id);$q$;

  IF position(v_anchor IN v_def) = 0 THEN
    RAISE EXCEPTION 'recompose_document_fields anchor not found';
  END IF;
  v_def := replace(v_def, v_anchor, v_add);
  EXECUTE v_def;
END $recompose$;

-- ── 2. Open room in the sale DELIVERY section for the ack lines under DELAYS ─────
-- DELAYS is sort 12; the next clause (TRANSPORT_GATE) is 13, with no integer gap.
-- Shift everything after DELAYS up by 10 so 13,14,15 are free for the ack lines.
-- sort_order is section-local presentation only — instances key on clause_key.
UPDATE contract_clause_defs SET sort_order = sort_order + 10
 WHERE template_key = 'HORSE_SALE_V3' AND section_key = 'DELIVERY' AND sort_order >= 13;

-- ── 3. Buyer initials line — board rate above zero ──────────────────────────────
-- Gate: TXN.HAS_BOARD_RATE_AFTER = YES. (DELAYS itself is always shown on the sale.)
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES
  ('HORSE_SALE_V3', 'DELIVERY', 'DELIVERY.DELAYS_BOARD_ACK', NULL,
   'Buyer acknowledges and accepts the obligation to pay board and care for the Horse at the rate stated above if Buyer fails to take delivery on time. Initialed: {{ACK.DELIVERY_BOARD}}',
   'input', 13, false,
   '{"equals": ["YES"], "field_key": "TXN.HAS_BOARD_RATE_AFTER"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, sort_order, guidance, system_settable)
VALUES
  ('HORSE_SALE_V3', 'ACK.DELIVERY_BOARD', 'Buyer initials', 'DELIVERY', 'BUYER',
   'text', 'text', true, false, 'initials', 'DELIVERY.DELAYS_BOARD_ACK',
   '{"equals": ["YES"], "field_key": "TXN.HAS_BOARD_RATE_AFTER"}'::jsonb, 13,
   'Type your initials to accept this obligation. Your initials must match your name on this document.', true)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- Co-buyer initials alongside the buyer's — board rate above zero AND a co-buyer exists.
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES
  ('HORSE_SALE_V3', 'DELIVERY', 'DELIVERY.DELAYS_BOARD_ACK_CB', NULL,
   'Co-Buyer acknowledges and accepts the same obligation. Initialed: {{ACK.DELIVERY_BOARD_COBUYER}}',
   'input', 14, false,
   '{"all": [{"equals": ["YES"], "field_key": "TXN.HAS_BOARD_RATE_AFTER"}, {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}]}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, sort_order, guidance, system_settable)
VALUES
  ('HORSE_SALE_V3', 'ACK.DELIVERY_BOARD_COBUYER', 'Co-Buyer initials', 'DELIVERY', 'COBUYER',
   'text', 'text', true, false, 'initials', 'DELIVERY.DELAYS_BOARD_ACK_CB',
   '{"all": [{"equals": ["YES"], "field_key": "TXN.HAS_BOARD_RATE_AFTER"}, {"equals": ["YES"], "field_key": "TXN.CO_BUYER_ENABLED"}]}'::jsonb, 14,
   'Type your initials to accept this obligation. Your initials must match your name on this document.', true)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- ── 4. Seller initials line — seller-delay penalty above zero ───────────────────
INSERT INTO contract_clause_defs
  (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES
  ('HORSE_SALE_V3', 'DELIVERY', 'DELIVERY.DELAYS_SELLER_ACK', NULL,
   'Seller acknowledges and accepts the obligation to pay the per-day penalty stated above if Seller delays delivery of the Horse. Initialed: {{ACK.DELIVERY_SELLER}}',
   'input', 15, false,
   '{"equals": ["YES"], "field_key": "TXN.HAS_SELLER_DELAY_PENALTY"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, sort_order, guidance, system_settable)
VALUES
  ('HORSE_SALE_V3', 'ACK.DELIVERY_SELLER', 'Seller initials', 'DELIVERY', 'SELLER',
   'text', 'text', true, false, 'initials', 'DELIVERY.DELAYS_SELLER_ACK',
   '{"equals": ["YES"], "field_key": "TXN.HAS_SELLER_DELAY_PENALTY"}'::jsonb, 15,
   'Type your initials to accept this obligation. Your initials must match your name on this document.', true)
ON CONFLICT (template_key, field_key) DO NOTHING;

-- ── 5. Version bump + composition snapshot (D34), as the admin test account ──────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'b85d562f-aad0-4cd7-9df9-6fbc58caff13', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT save_contract_template_version('HORSE_SALE_V3', NULL, NULL, NULL);
RESET ROLE;

COMMIT;
