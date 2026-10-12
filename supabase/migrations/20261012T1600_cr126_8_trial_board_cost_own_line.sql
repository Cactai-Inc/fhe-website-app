-- CR-126 round 2 fix — the trial board-cost allocation (cost_split) was embedded
-- mid-sentence, so its multi-row control broke the long "Buyer shall use…" sentence
-- in the editor and printed its label inline. Move the allocation to its OWN short
-- line: the control then has a clean home and the long sentence is left intact. The
-- composer joins lines with spaces, so the merged body still reads as one paragraph.
--
-- Unsigned drafts only (D33); template already at v4 — this is a wording refinement,
-- so v5 is minted after.

UPDATE contract_clause_defs
   SET body = 'Buyer may keep and ride the Horse on trial from {{TXN.TRIAL_START}} to {{TXN.TRIAL_END}} at {{TXN.TRIAL_LOCATION}}.
During the trial period, the costs of the Horse''s board, care, and routine maintenance are borne by {{TXN.TRIAL_BOARD_COST}}.
Buyer shall use the Horse only for ordinary riding and evaluation consistent with the Horse''s training and shall not compete, breed, transport offsite (other than for veterinary care, which is always permitted), or permit third parties to ride the Horse without Seller''s written consent, and Buyer assumes all risk of injury to persons arising from the Horse during the trial period as provided in the Risk, Release, and Indemnification section of this Agreement. Seller bears the risk of loss of the Horse while Seller holds title. If the Horse dies or is injured before Closing, Buyer is entitled to the return of all amounts paid to Seller and may decline to complete the purchase by not executing the Bill of Sale, in which case Seller returns to Buyer all amounts paid and Buyer returns possession of the Horse to Seller. Nothing in this section limits Seller''s remedies for damage to the Horse caused by Buyer''s gross negligence, reckless conduct, or intentional misconduct. Unless written notice is given and approved by Seller, Buyer must return the Horse in substantially the condition received on or before {{TXN.TRIAL_END}} or execute this Agreement.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'TRIAL.TERMS';

-- #7 (editor): the transport sentence lived as line 2 of DELIVERY.TERMS. The EDITOR
-- renders every body line (it does not line-gate like the SQL composer), so the
-- sentence showed even when transport doesn't apply. Split DELIVERY.TERMS so each
-- part can gate/order independently: the delivery-location sentence stays as
-- DELIVERY.TERMS (s=10); the transport sentence becomes its own gated clause (s=11);
-- the two delay sentences follow (s=12). Both new clauses are render_as_subitem
-- continuations, so the merged body still reads as one flowing paragraph in the
-- original order (location → transport → delays).
UPDATE contract_clause_defs
   SET body = 'The Horse shall be delivered to Buyer at {{TXN.DELIVERY_LOCATION}} on or about {{TXN.DELIVERY_DATE}}.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'DELIVERY.TERMS';

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
SELECT 'HORSE_SALE_V2','DELIVERY','DELIVERY.TRANSPORT', NULL,
       'Transport is arranged by {{TXN.TRANSPORT_RESPONSIBLE}} and paid for by {{TXN.TRANSPORT_COST_RESPONSIBLE}}.',
       'prose', 11, false,
       '{"equals":["YES"],"field_key":"TXN.TRANSPORT_APPLIES"}'::jsonb, true
 WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='DELIVERY.TRANSPORT');

INSERT INTO contract_clause_defs (template_key, section_key, clause_key, heading, body, clause_type, sort_order, is_optional, conditional_on, render_as_subitem)
SELECT 'HORSE_SALE_V2','DELIVERY','DELIVERY.DELAYS', NULL,
       'If Buyer fails to take delivery within 7 days of the agreed date other than due to Seller''s delay, Buyer shall pay board and care for the Horse at {{TXN.BOARD_RATE_AFTER}} per day until delivery occurs. If Seller delays delivery by more than 7 days, Seller shall pay {{TXN.SELLER_DELAY_PENALTY}} penalty to Buyer per day until delivery occurs.',
       'prose', 12, false, NULL, true
 WHERE NOT EXISTS (SELECT 1 FROM contract_clause_defs WHERE template_key='HORSE_SALE_V2' AND clause_key='DELIVERY.DELAYS');

-- Re-home the transport responsibility fields onto the new clause (their tokens now
-- live in its body) so they render inline there, not as orphans under DELIVERY.TERMS.
UPDATE contract_field_defs SET clause_key = 'DELIVERY.TRANSPORT'
 WHERE template_key = 'HORSE_SALE_V2'
   AND field_key IN ('TXN.TRANSPORT_RESPONSIBLE','TXN.TRANSPORT_COST_RESPONSIBLE');
