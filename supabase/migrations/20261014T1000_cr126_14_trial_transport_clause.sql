-- CR-126 — a transport clause for the TRIAL leg. When the trial location differs
-- from the horse's current location (TXN.TRIAL_AT_CURRENT = NO), the horse must be
-- transported to the trial location, so a transport sentence appears in the Trial
-- section with who-arranges / who-pays selectors — mirroring the delivery leg.
--
-- Reuses the already-computed TXN.TRIAL_AT_CURRENT (recompose + editor), so no new
-- derived field. Unsigned drafts (D33); template bumped after (D34).

-- who arranges / pays the trial-leg transport (parallel to the delivery-leg fields).
INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, options, conditional_on, required, is_optional, sort_order, closed)
SELECT 'HORSE_SALE_V2','TXN.TRIAL_TRANSPORT_RESPONSIBLE','Trial transport arranged by','TRIAL','DEAL',
       'select','select','select',
       '[{"label":"Buyer","value":"BUYER"},{"label":"Seller","value":"SELLER"}]'::jsonb,
       '{"all":[{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"},{"equals":["NO"],"field_key":"TXN.TRIAL_AT_CURRENT"}]}'::jsonb,
       true, false, 392, false
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_SALE_V2' AND field_key='TXN.TRIAL_TRANSPORT_RESPONSIBLE');

INSERT INTO contract_field_defs
  (template_key, field_key, label, section, owner_role, input_kind, value_type,
   format_type, options, conditional_on, required, is_optional, sort_order, closed)
SELECT 'HORSE_SALE_V2','TXN.TRIAL_TRANSPORT_COST_RESPONSIBLE','Trial transport paid for by','TRIAL','DEAL',
       'select','select','select',
       '[{"label":"Buyer","value":"BUYER"},{"label":"Seller","value":"SELLER"}]'::jsonb,
       '{"all":[{"equals":["YES"],"field_key":"TXN.TRIAL_ENABLED"},{"equals":["NO"],"field_key":"TXN.TRIAL_AT_CURRENT"}]}'::jsonb,
       true, false, 394, false
 WHERE NOT EXISTS (SELECT 1 FROM contract_field_defs
                    WHERE template_key='HORSE_SALE_V2' AND field_key='TXN.TRIAL_TRANSPORT_COST_RESPONSIBLE');

-- The transport sentence lives as a LINE inside TRIAL.TERMS — the only trial variant
-- shown when the trial is NOT at the current location — placed right after the
-- location/board-cost lines and before "Buyer shall use…". It is driven by its token
-- fields' gate (TRIAL_AT_CURRENT = NO), so the whole line drops when the trial IS at
-- the current location (nothing to transport). The TERMS_CURRENT variant never
-- carries it (that variant only shows when the trial IS at the current location).
UPDATE contract_clause_defs
   SET body = 'Buyer may keep and ride the Horse on trial from {{TXN.TRIAL_START}} to {{TXN.TRIAL_END}} at {{TXN.TRIAL_LOCATION}}.
Board and care costs borne by: {{TXN.TRIAL_BOARD_COST}}
The Horse shall be transported to the trial location from the Horse''s current location. Transport is arranged by {{TXN.TRIAL_TRANSPORT_RESPONSIBLE}} and paid for by {{TXN.TRIAL_TRANSPORT_COST_RESPONSIBLE}}.
Buyer shall use the Horse only for ordinary riding and evaluation consistent with the Horse''s training and shall not compete, breed, transport offsite (other than for veterinary care, which is always permitted), or permit third parties to ride the Horse without Seller''s written consent, and Buyer assumes all risk of injury to persons arising from the Horse during the trial period as provided in the Risk, Release, and Indemnification section of this Agreement. Seller bears the risk of loss of the Horse while Seller holds title. If the Horse dies or is injured before Closing, Buyer is entitled to the return of all amounts paid to Seller and may decline to complete the purchase by not executing the Bill of Sale, in which case Seller returns to Buyer all amounts paid and Buyer returns possession of the Horse to Seller. Nothing in this section limits Seller''s remedies for damage to the Horse caused by Buyer''s gross negligence, reckless conduct, or intentional misconduct. Unless written notice is given and approved by Seller, Buyer must return the Horse in substantially the condition received on or before {{TXN.TRIAL_END}} or execute this Agreement.'
 WHERE template_key = 'HORSE_SALE_V2' AND clause_key = 'TRIAL.TERMS';

-- home the selectors on TRIAL.TERMS so, in the editor, they also render as orphan
-- controls there when the trial-transport line applies (the line's tokens render
-- them inline; the home keeps them grouped with the clause for the author).
UPDATE contract_field_defs SET clause_key = 'TRIAL.TERMS'
 WHERE template_key = 'HORSE_SALE_V2'
   AND field_key IN ('TXN.TRIAL_TRANSPORT_RESPONSIBLE','TXN.TRIAL_TRANSPORT_COST_RESPONSIBLE');
