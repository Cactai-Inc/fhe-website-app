-- CR-126 fix — the trial board-cost allocation.
--   (1) STRAY PERIOD: the inline "{{TXN.TRIAL_BOARD_COST}}" sentence ended with a
--       period that, with the multi-row control, dangled as ". Buyer shall use…".
--   (2) NO SELECTION GATE: the inline token rendered awkwardly and the split was not
--       settable cleanly.
-- Fix: make the board-cost its OWN labelled line — "Board and care costs borne by:
-- {{TXN.TRIAL_BOARD_COST}}" — the same label:value pattern the lease uses for its
-- care responsibilities (CARE.FARRIER etc.). The cost_split control then renders as a
-- clean matrix cell beside its label (its vertical % / $ layout), NOT embedded in the
-- flowing sentence, so the "Buyer shall use…" prose starts clean with no stray period.
-- Applied to both trial variants (TERMS and TERMS_CURRENT). Unsigned drafts (D33);
-- template bumped after (D34).

UPDATE contract_clause_defs
   SET body = 'Buyer may keep and ride the Horse on trial from {{TXN.TRIAL_START}} to {{TXN.TRIAL_END}} at {{TXN.TRIAL_LOCATION}}.
Board and care costs borne by: {{TXN.TRIAL_BOARD_COST}}
Buyer shall use the Horse only for ordinary riding and evaluation consistent with the Horse''s training and shall not compete, breed, transport offsite (other than for veterinary care, which is always permitted), or permit third parties to ride the Horse without Seller''s written consent, and Buyer assumes all risk of injury to persons arising from the Horse during the trial period as provided in the Risk, Release, and Indemnification section of this Agreement. Seller bears the risk of loss of the Horse while Seller holds title. If the Horse dies or is injured before Closing, Buyer is entitled to the return of all amounts paid to Seller and may decline to complete the purchase by not executing the Bill of Sale, in which case Seller returns to Buyer all amounts paid and Buyer returns possession of the Horse to Seller. Nothing in this section limits Seller''s remedies for damage to the Horse caused by Buyer''s gross negligence, reckless conduct, or intentional misconduct. Unless written notice is given and approved by Seller, Buyer must return the Horse in substantially the condition received on or before {{TXN.TRIAL_END}} or execute this Agreement.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'TRIAL.TERMS';

UPDATE contract_clause_defs
   SET body = 'Buyer may keep and ride the Horse on trial from {{TXN.TRIAL_START}} to {{TXN.TRIAL_END}} at the Horse''s current location.
Current Location: {{TXN.TRIAL_LOCATION}}
Board and care costs borne by: {{TXN.TRIAL_BOARD_COST}}
Buyer shall use the Horse only for ordinary riding and evaluation consistent with the Horse''s training and shall not compete, breed, transport offsite (other than for veterinary care, which is always permitted), or permit third parties to ride the Horse without Seller''s written consent, and Buyer assumes all risk of injury to persons arising from the Horse during the trial period as provided in the Risk, Release, and Indemnification section of this Agreement. Seller bears the risk of loss of the Horse while Seller holds title. If the Horse dies or is injured before Closing, Buyer is entitled to the return of all amounts paid to Seller and may decline to complete the purchase by not executing the Bill of Sale, in which case Seller returns to Buyer all amounts paid and Buyer returns possession of the Horse to Seller. Nothing in this section limits Seller''s remedies for damage to the Horse caused by Buyer''s gross negligence, reckless conduct, or intentional misconduct. Unless written notice is given and approved by Seller, Buyer must return the Horse in substantially the condition received on or before {{TXN.TRIAL_END}} or execute this Agreement.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'TRIAL.TERMS_CURRENT';
