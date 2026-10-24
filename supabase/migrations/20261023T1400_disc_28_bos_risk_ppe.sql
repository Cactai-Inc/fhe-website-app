-- Phase 28: Bill of Sale — Part 3.7 (risk/release rewrite in BOS terms), the
-- Part 3.6 "no encumbrances" NONE clause, and the Part 3.6 PPE statement.
-- Runs after disc_18-27. Hand-authored per the approved package (2026-10-23).

-- ── Part 3.7  Rewrite the two BOS clauses that reference undefined "Buyer/Seller
--    Parties" and "this Agreement" (the BOS is "this Bill of Sale"; it defines no
--    "Parties" terms). Approved verbatim. ──
UPDATE contract_clause_defs SET body =
  'Each party understands that horseback riding and handling horses are inherently dangerous activities, and that horses are unpredictable by nature and may buck, rear, bite, kick, spook, stumble, or otherwise react unpredictably to their environment, which can result in severe injury, paralysis, or death. In connection with any examination, handling, riding, transport, or delivery of the Horse under this Bill of Sale, each party, on behalf of itself and anyone claiming by, through, or under it — including its family and household members, and its owners, principals, employees, agents, and contractors — expressly and voluntarily assumes all inherent risks of equine activities, and acknowledges that the other party, together with that party''s family, household members, owners, principals, employees, agents, and contractors, owes no duty to protect it from those inherent risks.'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_RISK.ASSUMPTION_INHERENT';

UPDATE contract_clause_defs SET body =
  'Seller, on behalf of Seller and anyone claiming by, through, or under Seller, completely releases, forever discharges, and agrees to hold harmless Buyer, together with Buyer''s family and household members and Buyer''s owners, principals, employees, agents, and contractors, to the fullest extent permitted by law, from any and all claims, demands, causes of action, liabilities, or damages for personal injury, property damage, or wrongful death arising out of Seller''s riding or handling of the Horse or Seller''s presence at any facility where the Horse is kept in connection with this Bill of Sale, whether caused by the ordinary negligence of any of them or otherwise. This release does not apply to gross negligence, reckless conduct, intentional misconduct, or fraud.'
 WHERE template_key='HORSE_BILL_OF_SALE' AND clause_key='BOS_RELEASE.SELLER';

-- ── Part 3.6a  "No encumbrances" NONE clause (standalone + answered No). ──
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_DISCLOSURES.ENCUMBRANCES_NONE', NULL,
        'Seller represents that the Horse is free of any liens, leases, co-ownership interests, or other encumbrances.',
        'input', 65, false,
        '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": ["NO"], "field_key": "TXN.HAS_ENCUMBRANCES"}]}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

-- ── Part 3.6b  BOS pre-purchase examination statement ──
-- A three-state selector (TXN.BOS_PPE), each printing a clause followed by a Buyer
-- initials line (per Part 1.4). When an accompanying sale agreement exists, the
-- state is derived from the sale's PPE election and locked (handled at attach/compose
-- time — see the derive note below); standalone, it is author-answered with a
-- pending placeholder. Placed at the end of the disclosures section (sort 150+).

-- The selector (a gate carrier clause holds the field so it always shows standalone).
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_PPE_GATE', NULL, '', 'input', 150, false,
        '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;

INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, options, guidance)
VALUES ('HORSE_BILL_OF_SALE','TXN.BOS_PPE','Pre-purchase examination status','BOS_DISCLOSURES','DEAL','select','select',
        true, false, 'select', 'BOS_PPE_GATE',
        '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb,
        '[{"label":"Seller did not permit a pre-purchase examination","value":"SELLER_DECLINED"},{"label":"Buyer was permitted one and declined to have one performed","value":"BUYER_DECLINED"},{"label":"An examination was performed and its results were acceptable to the Buyer","value":"PERFORMED"}]'::jsonb,
        'Select the pre-purchase examination status. When an accompanying sale agreement exists, this is taken from the sale and locked.')
ON CONFLICT (template_key, field_key) DO NOTHING;

-- The three statement clauses (each shown only standalone + its value), each with a
-- Buyer initials line beneath it (Part 1.4). Pending placeholder when blank.
DO $ppe$
DECLARE
  v_std jsonb := '{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}'::jsonb;
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('SELLER_DECLINED', 151, 'The Seller did not permit a pre-purchase veterinary examination of the Horse.'),
      ('BUYER_DECLINED',  153, 'The Buyer was permitted to obtain a pre-purchase veterinary examination of the Horse at the Buyer''s expense and declined to have one performed.'),
      ('PERFORMED',       155, 'A pre-purchase veterinary examination of the Horse was performed, and its results were acceptable to the Buyer.')
    ) AS t(val, srt, body)
  LOOP
    -- statement clause
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_PPE_'||rec.val, NULL, rec.body, 'input', rec.srt, false,
            jsonb_build_object('all', jsonb_build_array(v_std,
              jsonb_build_object('equals', jsonb_build_array(rec.val), 'field_key', 'TXN.BOS_PPE'))), false)
    ON CONFLICT (template_key, clause_key) DO NOTHING;
    -- buyer initials line beneath it, with its OWN initials field + token so the
    -- editor renders the control for whichever statement is showing.
    INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
    VALUES ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_PPE_'||rec.val||'_ACK', NULL,
            'Buyer acknowledges the pre-purchase examination statement above. Initialed: {{ACK.BOS_PPE_'||rec.val||'}}', 'input', rec.srt+1, false,
            jsonb_build_object('all', jsonb_build_array(v_std,
              jsonb_build_object('equals', jsonb_build_array(rec.val), 'field_key', 'TXN.BOS_PPE'))), false)
    ON CONFLICT (template_key, clause_key) DO NOTHING;

    INSERT INTO contract_field_defs (template_key, field_key, label, section, owner_role, input_kind, value_type, required, is_optional, format_type, clause_key, conditional_on, guidance)
    VALUES ('HORSE_BILL_OF_SALE','ACK.BOS_PPE_'||rec.val,'Buyer initials','BOS_DISCLOSURES','BUYER','text','text', true, false, 'initials',
            'BOS_PPE_'||rec.val||'_ACK',
            jsonb_build_object('all', jsonb_build_array(v_std,
              jsonb_build_object('equals', jsonb_build_array(rec.val), 'field_key', 'TXN.BOS_PPE'))),
            'Type your initials to acknowledge this statement. Your initials must match your name on this document.')
    ON CONFLICT (template_key, field_key) DO NOTHING;
  END LOOP;
END $ppe$;

-- Pending placeholder for the PPE selector (standalone + blank).
INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
VALUES ('HORSE_BILL_OF_SALE','BOS_DISCLOSURES','BOS_PPE_PENDING', NULL,
        '[Pending — select the pre-purchase examination status. This placeholder is replaced by the applicable statement and blocks signing.]',
        'input', 149, false,
        '{"all": [{"equals": ["NO"], "field_key": "TXN.BOS_HAS_SALE_AGREEMENT"}, {"equals": [""], "field_key": "TXN.BOS_PPE"}]}'::jsonb, false)
ON CONFLICT (template_key, clause_key) DO NOTHING;
