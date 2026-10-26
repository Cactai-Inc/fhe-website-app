-- VALIDATION ROUND — HORSE_SALE_V3 did not allow a co-buyer, but it is built for one.
--
-- The live sale template (HORSE_SALE_V3, what start_sale_contract uses) carries the
-- full co-buyer machinery: TXN.CO_BUYER_ENABLED, 16 COBUYER-owned fields, the co-buyer
-- acknowledgment/initials clauses (DISC-25 + F1). But contract_templates.allows_co_buyer
-- was FALSE on it, while its predecessor HORSE_SALE_V2 and HORSE_BILL_OF_SALE are both
-- TRUE — so the co-buyer capture card on the contract page (gated on allows_co_buyer)
-- never rendered, and a co-buyer could not be named on a V3 sale even though every
-- field for one exists. Set the flag to match the template's own capability.

BEGIN;

UPDATE contract_templates
   SET allows_co_buyer = true
 WHERE template_key = 'HORSE_SALE_V3' AND allows_co_buyer IS DISTINCT FROM true;

COMMIT;
